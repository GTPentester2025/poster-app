// Server-side RSS/Atom ingest — port of reference js/rss_fetcher.js fetching
// + parsing + dedup, and js/db.js saveArticles/upsertArticles, adapted for
// Node: native fetch (NO CORS proxies — we are not in a browser), regex-based
// XML extraction (Node has no DOMParser), better-sqlite3 persistence.
// Filtering methodology is untouched: scoring.shouldIncludeItem per item,
// CVE exclusion, MIN_SCORE 5.

import { mapWithConcurrency } from '#shared';
import * as scoring from './scoring.js';
import { getFeeds } from './feeds.js';
import { getScoringSnapshot } from './keyword_store.js';

const FEED_TIMEOUT_MS = 10_000;
const CONCURRENCY = 6;
const MAX_PER_FEED = 25;
const DESCRIPTION_MAX = 600;

/* ── text helpers (DOMParser-textContent equivalents) ── */

// Two-pass decode mirrors the browser pipeline: XML parser decoded entities
// once (textContent), then stripTags() re-parsed via innerHTML which decoded
// again — so "&amp;lt;b&amp;gt;" ends up as plain text, not a tag.
function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function unwrapCdata(s) {
  const m = String(s || '').match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  // CDATA content is literal (parser would not decode it); everything else
  // arrives XML-escaped and needs one decode pass first.
  return m ? m[1] : decodeEntities(s);
}

/** Remove markup and collapse whitespace — the App.Utils.stripTags equivalent. */
export function stripTags(html) {
  const noCdata = unwrapCdata(html);
  const noTags = noCdata.replace(/<[^>]*>/g, ' ');
  return decodeEntities(noTags).replace(/\s+/g, ' ').trim();
}

/** Word-boundary truncation with ellipsis (reference App.Utils.truncate). */
export function truncate(str, len = 160) {
  if (!str || str.length <= len) return str;
  return str.slice(0, len).replace(/\s+\S*$/, '') + '…';
}

/* ── XML field extraction (regex-based; feeds are flat enough for this) ── */

function blockRegex(tag) {
  return new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
}

function tagText(block, tag) {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}

// Atom <link> is an attribute-carrying (often self-closing) element; prefer
// rel="alternate" like the reference querySelector did, else first href.
function atomLink(block) {
  const links = block.match(/<link\b[^>]*>/gi) || [];
  let first = '';
  for (const l of links) {
    const href = (l.match(/href=["']([^"']*)["']/i) || [])[1] || '';
    if (!href) continue;
    if (/rel=["']alternate["']/i.test(l)) return href;
    if (!first) first = href;
  }
  return first;
}

function rssLink(block) {
  // RSS 2.0 puts the URL in element text; some feeds emit <link href="…"/>.
  const text = stripTags(tagText(block, 'link'));
  if (text) return text;
  return atomLink(block);
}

/* ── dates (ported normDate / isFutureDated) ── */

function normDate(s) {
  if (!s) return new Date().toISOString().split('T')[0];
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

// Reject items dated after the end of today (local). Missing/invalid dates are
// kept — normDate defaults those to today, so only genuine future events drop.
export function isFutureDated(s) {
  if (!s) return false;
  const d = new Date(s);
  if (isNaN(d.getTime())) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return d.getTime() > endOfToday.getTime();
}

/* ── classification (ported verbatim; first matching rule wins) ── */

export function classify(t) {
  const rules = [
    { type: 'Phishing', kw: ['phishing', 'phish', 'fake email', 'credential harvest', 'fake login', 'bec', 'business email', 'clickfix', 'quishing'] },
    { type: 'Smishing', kw: ['smishing', 'sms scam', 'text scam', 'sms phish'] },
    { type: 'Vishing', kw: ['vishing', 'voice scam', 'phone scam', 'call scam', 'fake call', 'scam call'] },
    { type: 'Social Engineering', kw: ['social engineer', 'impersonat', 'pretexting', 'baiting', 'tailgating', 'deepfake', 'ai voice'] },
    { type: 'Password & MFA', kw: ['password', 'mfa', 'multi-factor', 'two-factor', '2fa', 'authenticat', 'passkey', 'credential', 'session hijack', 'cookie steal'] },
    { type: 'Data Breach', kw: ['breach', 'data leak', 'leaked', 'exposed', 'stolen data', 'identity theft', 'compromised account'] },
    { type: 'Ransomware', kw: ['ransomware', 'ransom', 'locked files', 'encrypted files'] },
    { type: 'Scam & Fraud', kw: ['scam', 'fraud', 'fake website', 'gift card', 'romance scam', 'pig butcher', 'investment scam', 'lottery'] },
    { type: 'Security Tips', kw: ['security awareness', 'cyber hygiene', 'security training', 'security tip', 'best practice', 'protect your'] },
    { type: 'Insider Threat', kw: ['insider threat', 'insider risk', 'disgruntled'] }
  ];
  for (const r of rules) if (r.kw.some((k) => t.includes(k))) return r.type;
  return 'Security News';
}

// Relevance stored on the record is the raw keyword score clamped to 0..40
// (reference scoreRelevance) — the gate itself uses the unclamped score.
function scoreRelevance(t, snapshot) {
  const base = scoring.scoreText(t, snapshot);
  return Math.min(40, Math.max(0, base));
}

/* ── parse a whole feed document ── */

/**
 * Parse an RSS 2.0 / RDF / Atom document into filtered article objects.
 * Field priorities per format follow the reference parseItem():
 *   RSS:  link text → link href;  description;  pubDate → dc:date
 *   Atom: link[rel=alternate] href;  content → summary;  updated → published
 */
export function parseFeedXml(xmlText, feed, keywordSnapshot = null) {
  let items = String(xmlText || '').match(blockRegex('item')) || [];
  let type = 'rss';
  if (!items.length) {
    items = String(xmlText || '').match(blockRegex('entry')) || [];
    type = 'atom';
  }
  const rawCount = items.length;
  const articles = [];
  for (const block of items) {
    const a = parseItem(block, feed, type, keywordSnapshot);
    if (a) articles.push(a);
  }
  return { articles, rawCount };
}

function parseItem(block, feed, type, keywordSnapshot) {
  const title = tagText(block, 'title');
  if (!title) return null;
  let link, desc, dateStr;
  if (type === 'atom') {
    link = decodeEntities(atomLink(block));
    desc = stripTags(tagText(block, 'content') || tagText(block, 'summary') || '');
    dateStr = stripTags(tagText(block, 'updated') || tagText(block, 'published') || '');
  } else {
    link = decodeEntities(rssLink(block));
    desc = stripTags(tagText(block, 'description') || '');
    dateStr = stripTags(tagText(block, 'pubDate') || '');
    if (!dateStr) dateStr = stripTags(tagText(block, 'dc:date') || '');
  }
  const cleanTitle = stripTags(title);
  const cleanDesc = truncate(desc, DESCRIPTION_MAX);
  if (!scoring.shouldIncludeItem(cleanTitle, cleanDesc, keywordSnapshot)) return null;
  if (isFutureDated(dateStr)) return null;

  return {
    title: cleanTitle, source: feed.name, sourceId: feed.id, tier: feed.tier,
    url: (link || '').trim(), description: cleanDesc, pubDate: normDate(dateStr),
    type: classify((cleanTitle + ' ' + cleanDesc).toLowerCase()),
    relevanceScore: scoreRelevance((cleanTitle + ' ' + cleanDesc).toLowerCase(), keywordSnapshot),
    summary: null, watchouts: null
  };
}

/* ── dedup (ported: URL-key set + title hash + Jaccard 0.6 on trigrams) ── */

/** Reference db.js hashStr: fast 32-bit rolling hash, base-36 encoded. */
export function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

/** Strip protocol/www/query/fragment/trailing slash — dedup canonical form. */
export function normalizeUrl(url) {
  return (url || '')
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .toLowerCase()
    .trim();
}

function normalizeTitle(title) {
  return (title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
}

export function urlHash(url) { return simpleHash(normalizeUrl(url)); }
export function titleHash(title) { return simpleHash(normalizeTitle(title)); }

function jaccard(a, b) {
  const sa = new Set(a.match(/.{1,3}/g) || []), sb = new Set(b.match(/.{1,3}/g) || []);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union ? inter / union : 0;
}

/**
 * In-batch dedup before persistence: exact URL match, then near-duplicate
 * titles (same story syndicated across feeds) via trigram Jaccard > 0.6.
 */
export function dedupArticles(articles) {
  const urls = new Set(), titles = new Map();
  return articles.filter((a) => {
    const uk = normalizeUrl(a.url);
    if (urls.has(uk)) return false;
    urls.add(uk);
    const tk = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
    for (const [ex] of titles) { if (tk === ex || jaccard(tk, ex) > 0.6) return false; }
    titles.set(tk, true);
    return true;
  });
}

/* ── persistence (ported js/db.js upsertArticles semantics onto SQLite) ── */

/**
 * Upsert by url_hash. Merge rules from the reference: enrichment fields
 * (summary, watchouts, threat_level) only overwrite when the incoming article
 * carries them (?? — a refetch must not wipe AI enrichment), relevance_score
 * keeps the max ever seen, and the seeded flag of an existing row survives.
 */
export function upsertArticles(db, articles, { seeded = false } = {}) {
  const selectByUrl = db.prepare('SELECT * FROM articles WHERE url_hash = ?');
  const insert = db.prepare(`INSERT INTO articles
    (title, title_hash, url_hash, source, source_id, url, description, summary, watchouts,
     pub_date, type, threat_level, relevance_score, tier, seeded, fetched_at)
    VALUES (@title, @title_hash, @url_hash, @source, @source_id, @url, @description, @summary,
     @watchouts, @pub_date, @type, @threat_level, @relevance_score, @tier, @seeded, @fetched_at)`);
  const update = db.prepare(`UPDATE articles SET
    title = @title, title_hash = @title_hash, source = @source, source_id = @source_id,
    url = @url, description = @description, summary = @summary, watchouts = @watchouts,
    pub_date = @pub_date, type = @type, threat_level = @threat_level,
    relevance_score = @relevance_score, tier = @tier, fetched_at = @fetched_at
    WHERE id = @id`);

  const now = new Date().toISOString();
  let saved = 0, updated = 0, skipped = 0;

  db.transaction(() => {
    for (const art of articles) {
      if (!art.url || !art.title) { skipped++; continue; }
      const uh = urlHash(art.url);
      const watchoutsJson = art.watchouts == null ? null
        : (typeof art.watchouts === 'string' ? art.watchouts : JSON.stringify(art.watchouts));
      const ex = selectByUrl.get(uh);
      if (ex) {
        update.run({
          id: ex.id,
          title: art.title || ex.title,
          title_hash: titleHash(art.title || ex.title),
          source: art.source ?? ex.source,
          source_id: art.sourceId ?? ex.source_id,
          url: art.url,
          description: art.description || ex.description,
          summary: art.summary ?? ex.summary,
          watchouts: watchoutsJson ?? ex.watchouts,
          pub_date: art.pubDate || ex.pub_date,
          type: art.type || ex.type,
          threat_level: art.threatLevel ?? ex.threat_level,
          relevance_score: Math.max(ex.relevance_score || 0, art.relevanceScore || 0),
          tier: art.tier || ex.tier,
          fetched_at: now
        });
        updated++;
      } else {
        insert.run({
          title: art.title,
          title_hash: titleHash(art.title),
          url_hash: uh,
          source: art.source || '',
          source_id: art.sourceId || '',
          url: art.url,
          description: art.description || '',
          summary: art.summary ?? null,
          watchouts: watchoutsJson,
          pub_date: art.pubDate || now.split('T')[0],
          type: art.type || 'Security News',
          threat_level: art.threatLevel ?? null,
          relevance_score: art.relevanceScore || 0,
          tier: art.tier || 3,
          seeded: seeded ? 1 : 0,
          fetched_at: now
        });
        saved++;
      }
    }
  })();

  return { saved, updated, skipped };
}

/* ── fetching (native fetch, per-feed timeout, urlAlternatives fallback) ── */

async function fetchFeedXml(feed, { timeoutMs = FEED_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const urls = [feed.url, ...(feed.urlAlternatives || [])];
  let lastErr = null;
  for (const url of urls) {
    try {
      const resp = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
          'User-Agent': 'postter-rag/1.0 (+security awareness poster platform)'
        },
        redirect: 'follow'
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      // Same sanity floor as the reference: tiny bodies are proxy/error pages.
      if (!text || text.length < 80) throw new Error('Empty feed body');
      return { xml: text, urlUsed: url };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Feed unreachable');
}

/**
 * Fetch, filter, dedup and persist all (or selected) feeds.
 * Per-feed failures are caught INSIDE the worker — mapWithConcurrency is
 * fail-fast, and one dead feed must never abort the other 34.
 *
 * @returns {Promise<{articles: object[], stats: object, saved: number, updated: number, skipped: number}>}
 */
export async function ingestAllFeeds({
  db,
  feedIds = null,
  maxPerFeed = MAX_PER_FEED,
  timeoutMs = FEED_TIMEOUT_MS,
  fetchImpl = fetch,
  log = () => {}
} = {}) {
  const allFeeds = getFeeds(db);
  const feeds = feedIds ? allFeeds.filter((f) => feedIds.includes(f.id)) : allFeeds;
  // One snapshot for the whole run: consistent scoring even if keywords are
  // edited mid-fetch (reference fetchAllFeeds did the same).
  const keywordSnapshot = getScoringSnapshot(db);
  const feedStats = {};
  let allArticles = [];
  const startedAt = Date.now();

  await mapWithConcurrency(feeds, CONCURRENCY, async (feed) => {
    const feedStart = Date.now();
    try {
      const { xml, urlUsed } = await fetchFeedXml(feed, { timeoutMs, fetchImpl });
      const { articles, rawCount } = parseFeedXml(xml, feed, keywordSnapshot);
      const arts = articles.slice(0, maxPerFeed);
      feedStats[feed.id] = {
        name: feed.name, count: arts.length, rawCount, ok: true,
        elapsedMs: Date.now() - feedStart, urlUsed
      };
      allArticles.push(...arts);
      log(`[rag] ${feed.name}: ${arts.length} relevant (${rawCount} in feed)`);
    } catch (e) {
      feedStats[feed.id] = {
        name: feed.name, count: 0, rawCount: 0, ok: false,
        error: (e && e.message) || 'network', elapsedMs: Date.now() - feedStart, urlUsed: feed.url
      };
      log(`[rag] ${feed.name}: FAILED (${(e && e.message) || 'network'})`);
    }
  });

  allArticles = dedupArticles(allArticles);
  // Reference ordering: curated tier first, then relevance, then freshness.
  allArticles.sort((a, b) =>
    (a.tier - b.tier) || (b.relevanceScore - a.relevanceScore) || (new Date(b.pubDate) - new Date(a.pubDate)));

  const { saved, updated, skipped } = upsertArticles(db, allArticles);
  return {
    articles: allArticles,
    stats: feedStats,
    saved, updated, skipped,
    telemetry: {
      totalElapsedMs: Date.now() - startedAt,
      feedCount: feeds.length,
      successCount: Object.values(feedStats).filter((s) => s.ok).length
    }
  };
}
