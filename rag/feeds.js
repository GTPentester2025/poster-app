// 35 credible RSS feeds across 3 tiers — FEEDS array ported VERBATIM from
// reference js/rss_fetcher.js (Government CERTs + Enterprise Vendors +
// Security Journalism). Custom feed CRUD is ported too, with persistence
// moved from localStorage to the SQLite `custom_feeds` table (migration 2).

export const FEEDS = [
  // ══ TIER 1: Government CERTs & National Agencies ══
  { id: 'cisa', name: 'CISA (US)', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', urlAlternatives: ['https://www.cisa.gov/news.xml'], site: 'cisa.gov', icon: '🇺🇸', tier: 1 },
  { id: 'ncsc', name: 'NCSC (UK)', url: 'https://www.ncsc.gov.uk/api/1/services/v1/report-rss-feed.xml', site: 'ncsc.gov.uk', icon: '🇬🇧', tier: 1 },
  { id: 'enisa', name: 'ENISA (EU)', url: 'https://www.enisa.europa.eu/rss.xml', site: 'enisa.europa.eu', icon: '🇪🇺', tier: 1 },
  { id: 'certin', name: 'CERT-In (India)', url: 'https://www.cert-in.org.in/s2cMainServlet?pageid=RSSADVISORY', site: 'cert-in.org.in', icon: '🇮🇳', tier: 1 },
  { id: 'acsc', name: 'ACSC (Australia)', url: 'https://www.cyber.gov.au/rss.xml', urlAlternatives: ['https://www.cyber.gov.au/rss-feeds/rss.xml'], site: 'cyber.gov.au', icon: '🇦🇺', tier: 1 },
  { id: 'jpcert', name: 'JPCERT (Japan)', url: 'https://www.jpcert.or.jp/english/rss/jpcert-en.rdf', site: 'jpcert.or.jp', icon: '🇯🇵', tier: 1 },
  { id: 'sansisc', name: 'SANS ISC', url: 'https://isc.sans.edu/rssfeed.xml', site: 'isc.sans.edu', icon: '🎓', tier: 1 },
  { id: 'nist', name: 'NIST Cybersecurity', url: 'https://csrc.nist.gov/CSRC/media/Publications/feeds/nist-publications-rss.xml', urlAlternatives: ['https://www.nist.gov/news-events/rss.xml'], site: 'nist.gov', icon: '📐', tier: 1 },

  // ══ TIER 2: Enterprise Security Vendors (threat research blogs) ══
  { id: 'checkpoint', name: 'Check Point Research', url: 'https://research.checkpoint.com/feed/', site: 'research.checkpoint.com', icon: '🇮🇱', tier: 2 },
  { id: 'cybereason', name: 'Cybereason', url: 'https://www.cybereason.com/blog/rss.xml', site: 'cybereason.com', icon: '🇮🇱', tier: 2 },
  { id: 'crowdstrike', name: 'CrowdStrike Blog', url: 'https://www.crowdstrike.com/blog/feed/', site: 'crowdstrike.com', icon: '🦅', tier: 2 },
  { id: 'proofpoint', name: 'Proofpoint Blog', url: 'https://www.proofpoint.com/us/blog/rss.xml', urlAlternatives: ['https://proofpoint.com/us/blog/rss.xml'], site: 'proofpoint.com', icon: '✉️', tier: 2 },
  { id: 'knowbe4', name: 'KnowBe4 Blog', url: 'https://blog.knowbe4.com/rss.xml', urlAlternatives: ['https://www.knowbe4.com/rss.xml'], site: 'knowbe4.com', icon: '🎓', tier: 2 },
  { id: 'cofense', name: 'Cofense Blog', url: 'https://cofense.com/blog/feed/', urlAlternatives: ['https://cofense.com/feed/'], site: 'cofense.com', icon: '🐟', tier: 2 },
  { id: 'tenable', name: 'Tenable Blog', url: 'https://www.tenable.com/blog/feed', site: 'tenable.com', icon: '🔎', tier: 2 },
  { id: 'qualys', name: 'Qualys Blog', url: 'https://blog.qualys.com/feed', site: 'blog.qualys.com', icon: '🔬', tier: 2 },
  { id: 'mssecurity', name: 'Microsoft Security', url: 'https://www.microsoft.com/en-us/security/blog/feed/', urlAlternatives: ['https://www.microsoft.com/security/blog/feed/'], site: 'microsoft.com/security', icon: '🪟', tier: 2 },
  { id: 'sentinelone', name: 'SentinelOne Blog', url: 'https://www.sentinelone.com/blog/feed/', site: 'sentinelone.com', icon: '🤖', tier: 2 },
  { id: 'kaspersky', name: 'Securelist (Kaspersky)', url: 'https://securelist.com/feed/', site: 'securelist.com', icon: '🛡️', tier: 2 },
  { id: 'talosintel', name: 'Cisco Talos', url: 'https://blog.talosintelligence.com/feeds/posts/default', urlAlternatives: ['https://blog.talosintelligence.com/feeds/posts/default?alt=rss'], site: 'talosintelligence.com', icon: '🌊', tier: 2 },
  { id: 'unit42', name: 'Palo Alto Unit 42', url: 'https://unit42.paloaltonetworks.com/feed/', site: 'unit42.paloaltonetworks.com', icon: '🔥', tier: 2 },
  { id: 'mandiant', name: 'Mandiant (Google)', url: 'https://www.mandiant.com/resources/blog/rss.xml', urlAlternatives: ['https://www.mandiant.com/resources/blog?format=rss'], site: 'mandiant.com', icon: '🔴', tier: 2 },

  // ══ TIER 3: Security Journalism & Awareness ══
  { id: 'bleeping', name: 'Bleeping Computer', url: 'https://www.bleepingcomputer.com/feed/', site: 'bleepingcomputer.com', icon: '💻', tier: 3 },
  { id: 'hackernews', name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews', site: 'thehackernews.com', icon: '🔐', tier: 3 },
  { id: 'krebs', name: 'KrebsOnSecurity', url: 'https://krebsonsecurity.com/feed/', site: 'krebsonsecurity.com', icon: '🔍', tier: 3 },
  { id: 'darkreading', name: 'Dark Reading', url: 'https://www.darkreading.com/rss.xml', site: 'darkreading.com', icon: '🌑', tier: 3 },
  { id: 'secweek', name: 'SecurityWeek', url: 'https://feeds.feedburner.com/securityweek', site: 'securityweek.com', icon: '🛡️', tier: 3 },
  { id: 'infosec', name: 'Infosecurity Magazine', url: 'https://www.infosecurity-magazine.com/rss/news/', site: 'infosecurity-magazine.com', icon: '📰', tier: 3 },
  { id: 'graham', name: 'Graham Cluley', url: 'https://grahamcluley.com/feed/', urlAlternatives: ['https://www.grahamcluley.com/feed/'], site: 'grahamcluley.com', icon: '🎯', tier: 3 },
  { id: 'schneier', name: 'Schneier on Security', url: 'https://www.schneier.com/feed/atom/', site: 'schneier.com', icon: '🧠', tier: 3 },
  { id: 'welivesec', name: 'WeLiveSecurity (ESET)', url: 'https://www.welivesecurity.com/en/feed/', site: 'welivesecurity.com', icon: '🦠', tier: 3 },
  { id: 'malwarebytes', name: 'Malwarebytes Blog', url: 'https://www.malwarebytes.com/blog/feed', site: 'malwarebytes.com', icon: '🧹', tier: 3 },
  { id: 'helpnet', name: 'Help Net Security', url: 'https://www.helpnetsecurity.com/feed/', site: 'helpnetsecurity.com', icon: '🌐', tier: 3 },
  { id: 'csoonline', name: 'CSO Online', url: 'https://www.csoonline.com/feed/', site: 'csoonline.com', icon: '🏢', tier: 3 },
  { id: 'phishtank', name: 'PhishTank Blog', url: 'https://www.phishtank.com/blog/feed/', urlAlternatives: ['https://phishtank.org/blog/feed/'], site: 'phishtank.com', icon: '🎣', tier: 3 }
];

// ── URL normalization helpers (ported unchanged) ──

export function normalizeUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) throw new Error('Feed URL is required.');
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Invalid URL format. Use a full http(s) URL.');
  }
  if (!/^https?:$/i.test(parsed.protocol)) throw new Error('Only http(s) feed URLs are allowed.');
  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

function normalizeSite(url) {
  try { return new URL(url).hostname.replace(/^www\./i, ''); }
  catch { return ''; }
}

function normalizeFeedId(url) {
  const seed = String(url || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `custom_${seed.slice(0, 26) || Date.now()}`;
}

// Loose comparable form so "https://www.x.com/feed/" and "http://x.com/feed"
// count as the same source when checking for duplicates.
function toComparableUrl(url) {
  return String(url || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
}

// ── Custom feed CRUD (SQLite-backed) ──

/** User-added feeds only. Always tier 3: user sources rank below curated ones. */
export function getCustomFeeds(db) {
  return db.prepare('SELECT id, name, url, site, icon FROM custom_feeds ORDER BY added_at').all()
    .map((row) => ({ ...row, tier: 3, custom: true }));
}

/** Built-in FEEDS + custom feeds — the full source list ingest iterates. */
export function getFeeds(db) {
  return [...FEEDS, ...getCustomFeeds(db)];
}

export function addCustomFeed(db, { name, url }) {
  const feedName = String(name || '').trim();
  if (!feedName) throw new Error('Source name is required.');
  if (feedName.length > 90) throw new Error('Source name is too long.');
  const normalizedUrl = normalizeUrl(url);
  const targetComparable = toComparableUrl(normalizedUrl);
  if (getFeeds(db).some((f) => toComparableUrl(f.url) === targetComparable)) {
    throw new Error('This source already exists.');
  }
  const next = {
    id: normalizeFeedId(normalizedUrl),
    name: feedName,
    url: normalizedUrl,
    site: normalizeSite(normalizedUrl),
    icon: '➕',
    tier: 3,
    custom: true
  };
  db.prepare('INSERT INTO custom_feeds (id, name, url, site, icon, added_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(next.id, next.name, next.url, next.site, next.icon, new Date().toISOString());
  return next;
}

export function removeCustomFeed(db, feedId) {
  const id = String(feedId || '').trim();
  if (!id) return false;
  return db.prepare('DELETE FROM custom_feeds WHERE id = ?').run(id).changes > 0;
}
