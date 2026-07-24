// Ingest tests: RSS + Atom parsing from fixture strings, per-item filtering
// (CVE exclusion / MIN_SCORE), dedup (URL + Jaccard near-dup titles), and
// upsert enrichment-preservation semantics ported from the reference db.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migrate } from '../../backend/db.js';
import {
  parseFeedXml, dedupArticles, upsertArticles, ingestAllFeeds,
  stripTags, truncate, classify, urlHash
} from '../../rag/ingest.js';

const RSS_FEED = { id: 'hackernews', name: 'The Hacker News', tier: 3 };
const ATOM_FEED = { id: 'schneier', name: 'Schneier on Security', tier: 3 };

const RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
<title>The Hacker News</title>
<item>
  <title>New Phishing Campaign Uses Fake Microsoft 365 Login Pages to Steal Credentials</title>
  <link>https://thehackernews.com/2026/07/phishing-fake-m365-login.html</link>
  <description><![CDATA[<p>Researchers have uncovered a large-scale <b>phishing</b> operation that clones Microsoft 365 sign-in pages and harvests employee passwords. The campaign relays MFA one-time codes in real time, defeating push-based approval.</p>]]></description>
  <pubDate>Mon, 13 Jul 2026 08:30:00 GMT</pubDate>
</item>
<item>
  <title>SharePoint Flaw CVE-2026-31892 Exploited in the Wild</title>
  <link>https://thehackernews.com/2026/07/sharepoint-cve-2026-31892.html</link>
  <description>Attackers are exploiting a remote code execution vulnerability in on-premises SharePoint servers to deploy webshells.</description>
  <pubDate>Sun, 12 Jul 2026 10:00:00 GMT</pubDate>
</item>
<item>
  <title>Understanding the eBPF Verifier: A Deep-Dive Tutorial</title>
  <link>https://thehackernews.com/2026/07/ebpf-verifier-deep-dive.html</link>
  <description>A tutorial walking through kernel eBPF verifier design, instruction analysis, and program safety guarantees.</description>
  <dc:date>2026-07-11T09:00:00Z</dc:date>
</item>
</channel>
</rss>`;

const ATOM_XML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Schneier on Security</title>
  <entry>
    <title>AI Voice Cloning Used in Deepfake Fraud Against Finance Teams</title>
    <link rel="alternate" type="text/html" href="https://www.schneier.com/blog/archives/2026/07/ai-voice-cloning-fraud.html"/>
    <summary>Criminals are using deepfake audio of company executives to pressure finance employees into approving urgent wire transfers. Several recent fraud cases show the calls reference real vendor invoices scraped from breached mailboxes.</summary>
    <updated>2026-07-10T14:00:00Z</updated>
  </entry>
</feed>`;

test('RSS parsing: extracts fields, strips CDATA/HTML, filters CVE and noise items', () => {
  const { articles, rawCount } = parseFeedXml(RSS_XML, RSS_FEED);
  assert.equal(rawCount, 3);
  assert.equal(articles.length, 1); // CVE item excluded, tutorial item scores below MIN_SCORE
  const a = articles[0];
  assert.equal(a.title, 'New Phishing Campaign Uses Fake Microsoft 365 Login Pages to Steal Credentials');
  assert.equal(a.url, 'https://thehackernews.com/2026/07/phishing-fake-m365-login.html');
  assert.equal(a.pubDate, '2026-07-13');
  assert.equal(a.type, 'Phishing');
  assert.equal(a.source, 'The Hacker News');
  assert.equal(a.tier, 3);
  assert.ok(a.relevanceScore >= 5);
  // CDATA + tags stripped, entities decoded
  assert.ok(a.description.startsWith('Researchers have uncovered a large-scale phishing operation'));
  assert.ok(!a.description.includes('<'));
});

test('Atom parsing: entry/link[rel=alternate]/summary/updated field priorities', () => {
  const { articles, rawCount } = parseFeedXml(ATOM_XML, ATOM_FEED);
  assert.equal(rawCount, 1);
  assert.equal(articles.length, 1);
  const a = articles[0];
  assert.equal(a.url, 'https://www.schneier.com/blog/archives/2026/07/ai-voice-cloning-fraud.html');
  assert.equal(a.pubDate, '2026-07-10');
  // classify(): 'deepfake' hits the Social Engineering rule before Scam & Fraud
  assert.equal(a.type, 'Social Engineering');
});

test('description is truncated to 600 chars at a word boundary', () => {
  const longBody = 'Phishing crews are rotating lure themes weekly. ' +
    'The latest run impersonates a corporate travel-booking portal and asks staff to reconfirm payment cards before an invented deadline. '.repeat(6);
  const xml = `<rss><channel><item>
    <title>Phishing Lures Impersonate Travel Portal to Harvest Payment Cards</title>
    <link>https://example-news.test/travel-phish</link>
    <description>${longBody}</description>
    <pubDate>Thu, 09 Jul 2026 12:00:00 GMT</pubDate>
  </item></channel></rss>`;
  const { articles } = parseFeedXml(xml, RSS_FEED);
  assert.equal(articles.length, 1);
  assert.ok(articles[0].description.length <= 601); // 600 + ellipsis
  assert.ok(articles[0].description.endsWith('…'));
});

test('future-dated items are dropped, undated items default to today', () => {
  const future = new Date(Date.now() + 7 * 864e5).toUTCString();
  const xml = `<rss><channel>
  <item>
    <title>Ransomware Roundup Webcast Scheduled</title>
    <link>https://example-news.test/upcoming-webcast</link>
    <description>Ransomware trends discussion with incident responders about extortion scams.</description>
    <pubDate>${future}</pubDate>
  </item>
  <item>
    <title>Smishing Texts Pose as Parcel Delivery Fee Requests</title>
    <link>https://example-news.test/parcel-smishing</link>
    <description>A smishing wave asks recipients to pay a small redelivery fee, capturing card numbers and passwords on a spoofed courier site.</description>
  </item>
  </channel></rss>`;
  const { articles } = parseFeedXml(xml, RSS_FEED);
  assert.equal(articles.length, 1);
  assert.equal(articles[0].type, 'Smishing');
  assert.equal(articles[0].pubDate, new Date().toISOString().split('T')[0]);
});

test('dedup: exact URL (protocol/www-insensitive) and Jaccard>0.6 near-dup titles', () => {
  const base = {
    description: 'Stolen patient records published after ransom deadline passed.',
    pubDate: '2026-07-08', type: 'Ransomware', relevanceScore: 10, tier: 3,
    source: 'Bleeping Computer', sourceId: 'bleeping', summary: null, watchouts: null
  };
  const articles = [
    { ...base, title: 'Ransomware Gang Leaks Data From European Hospital Network', url: 'https://www.bleepingcomputer.com/news/hospital-leak/' },
    // same story, different protocol/www/trailing slash -> URL dedup
    { ...base, title: 'Ransomware Gang Leaks Data From European Hospital Network', url: 'http://bleepingcomputer.com/news/hospital-leak' },
    // syndicated retitle, high trigram overlap -> Jaccard dedup
    { ...base, title: 'Ransomware Gang Leaks Stolen Data From European Hospital Network', url: 'https://www.securityweek.com/ransomware-gang-leaks-hospital-data/' },
    // genuinely different story survives
    { ...base, title: 'Vishing Callers Impersonate Bank Anti-Fraud Department', url: 'https://www.securityweek.com/vishing-bank-fraud-dept/', type: 'Vishing' }
  ];
  const deduped = dedupArticles(articles);
  assert.equal(deduped.length, 2);
  assert.deepEqual(deduped.map((a) => a.type), ['Ransomware', 'Vishing']);
});

test('upsert preserves summary/watchouts and keeps max relevance_score', () => {
  const db = new Database(':memory:');
  migrate(db);
  const url = 'https://krebsonsecurity.com/2026/07/payroll-diversion-bec/';
  const first = {
    title: 'BEC Crews Divert Payroll Deposits via HR Portal Phishing',
    source: 'KrebsOnSecurity', sourceId: 'krebs', tier: 3, url,
    description: 'Attackers phish HR portal credentials, then silently change direct-deposit details.',
    pubDate: '2026-07-05', type: 'Phishing', relevanceScore: 25,
    summary: 'Payroll diversion via phished HR credentials; employees should verify deposit-change emails.',
    watchouts: ['Verify any direct-deposit change request by phone', 'Never approve unexpected MFA prompts']
  };
  let r = upsertArticles(db, [first]);
  assert.deepEqual(r, { saved: 1, updated: 0, skipped: 0 });

  // refetch of the same story: no summary/watchouts, lower score
  const refetch = { ...first, summary: null, watchouts: null, relevanceScore: 10, description: 'Attackers phish HR portal credentials.' };
  r = upsertArticles(db, [refetch]);
  assert.deepEqual(r, { saved: 0, updated: 1, skipped: 0 });

  const row = db.prepare('SELECT * FROM articles WHERE url_hash = ?').get(urlHash(url));
  assert.equal(row.summary, first.summary); // enrichment survived
  assert.deepEqual(JSON.parse(row.watchouts), first.watchouts);
  assert.equal(row.relevance_score, 25); // max kept
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM articles').get().n, 1);
});

test('ingestAllFeeds: per-feed failures never abort the batch; results persist', async () => {
  const db = new Database(':memory:');
  migrate(db);
  // fake fetch: hackernews serves RSS, schneier serves Atom, everything else dies
  const fetchImpl = async (url) => {
    if (url.includes('feedburner.com/TheHackersNews')) {
      return { ok: true, text: async () => RSS_XML };
    }
    if (url.includes('schneier.com')) {
      return { ok: true, text: async () => ATOM_XML };
    }
    throw new Error('ECONNREFUSED');
  };
  const result = await ingestAllFeeds({ db, feedIds: ['hackernews', 'schneier', 'krebs'], fetchImpl });
  assert.equal(result.stats.hackernews.ok, true);
  assert.equal(result.stats.schneier.ok, true);
  assert.equal(result.stats.krebs.ok, false); // failed but did not abort
  assert.equal(result.saved, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM articles').get().n, 2);
  assert.equal(result.telemetry.successCount, 2);
});

test('stripTags/truncate/classify behave like the reference utils', () => {
  assert.equal(stripTags('<p>Fake &amp; fraudulent <b>login</b> pages</p>'), 'Fake & fraudulent login pages');
  assert.equal(truncate('one two three four', 10), 'one two…');
  assert.equal(classify('new quishing campaign spotted'), 'Phishing');
  assert.equal(classify('insider risk program gaps'), 'Insider Threat');
  assert.equal(classify('quarterly threat landscape report'), 'Security News');
});
