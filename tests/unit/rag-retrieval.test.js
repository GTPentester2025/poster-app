// Retrieval tests over an in-memory index of realistic security articles:
// FTS matching, keyword-weight + recency blending, ordering, empty-index path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migrate } from '../../backend/db.js';
import { upsertArticles } from '../../rag/ingest.js';
import { retrieve, recencyWeight } from '../../rag/retrieval.js';

function daysAgo(n) {
  return new Date(Date.now() - n * 864e5).toISOString().split('T')[0];
}

function seedIndex(db) {
  upsertArticles(db, [
    {
      title: 'Phishing Emails Impersonate IT Helpdesk to Steal Passwords',
      source: 'Bleeping Computer', sourceId: 'bleeping', tier: 3,
      url: 'https://www.bleepingcomputer.com/news/security/it-helpdesk-phishing-passwords/',
      description: 'A wave of phishing emails claiming to come from internal IT support asks staff to revalidate their passwords on a fake portal before their account is suspended.',
      pubDate: daysAgo(2), type: 'Phishing', relevanceScore: 15
    },
    {
      title: 'Phishing Emails Spoof Payroll Provider to Steal Passwords',
      source: 'The Hacker News', sourceId: 'hackernews', tier: 3,
      url: 'https://thehackernews.com/2026/06/payroll-provider-phishing.html',
      description: 'A phishing run posing as a payroll provider asks employees to confirm their passwords on a cloned portal ahead of a fabricated pay-cycle change.',
      pubDate: daysAgo(45), type: 'Phishing', relevanceScore: 15
    },
    {
      title: 'Ransomware Group Publishes Stolen HR Records After Failed Extortion',
      source: 'SecurityWeek', sourceId: 'secweek', tier: 3,
      url: 'https://www.securityweek.com/ransomware-group-publishes-hr-records/',
      description: 'The gang leaked employee benefit files and salary data when the victim refused to pay, raising identity theft risk for staff.',
      pubDate: daysAgo(6), type: 'Ransomware', relevanceScore: 20
    },
    {
      title: 'Deepfake CEO on Video Call Tricks Employee Into Urgent Transfer',
      source: 'KrebsOnSecurity', sourceId: 'krebs', tier: 3,
      url: 'https://krebsonsecurity.com/2026/07/deepfake-ceo-video-call-transfer/',
      description: 'A finance employee joined a video call with what appeared to be the CEO and CFO; every participant except the victim was an AI-generated deepfake pushing a fraudulent wire.',
      pubDate: daysAgo(1), type: 'Social Engineering', relevanceScore: 18
    },
    {
      title: 'Browsers Begin Shipping Quantum-Resistant TLS Key Exchange',
      source: 'Help Net Security', sourceId: 'helpnet', tier: 3,
      url: 'https://www.helpnetsecurity.com/2026/07/03/quantum-resistant-tls-browsers/',
      description: 'Major browsers enabled hybrid post-quantum key exchange by default, a transparent change for end users and site operators.',
      pubDate: daysAgo(12), type: 'Security News', relevanceScore: 0
    }
  ]);
}

test('retrieve matches via FTS and returns blended scoring fields', () => {
  const db = new Database(':memory:');
  migrate(db);
  seedIndex(db);
  const results = retrieve(db, ['phishing'], { limit: 10 });
  assert.equal(results.length, 2); // only the two phishing stories mention it
  for (const r of results) {
    assert.ok(typeof r.ftsNorm === 'number');
    assert.ok(typeof r.scoringPoints === 'number');
    assert.ok(r.recencyWeight > 0 && r.recencyWeight <= 1);
    assert.equal(r.finalScore, r.ftsNorm + r.scoringPoints + 10 * r.recencyWeight);
    assert.ok(r.title && r.url && r.pub_date); // full article row came through
  }
});

test('recency weighting orders a fresh story above a stale near-equal one', () => {
  const db = new Database(':memory:');
  migrate(db);
  seedIndex(db);
  const results = retrieve(db, ['phishing', 'passwords']);
  const titles = results.map((r) => r.title);
  const fresh = titles.indexOf('Phishing Emails Impersonate IT Helpdesk to Steal Passwords');
  const stale = titles.indexOf('Phishing Emails Spoof Payroll Provider to Steal Passwords');
  assert.ok(fresh !== -1 && stale !== -1);
  assert.ok(fresh < stale, `expected 2-day-old article before 45-day-old (got ${titles.join(' | ')})`);
});

test('recencyWeight follows exp(-ageDays/30)', () => {
  const now = Date.now();
  const at = (days) => new Date(now - days * 864e5).toISOString();
  assert.ok(Math.abs(recencyWeight(at(0), now) - 1) < 0.01);
  assert.ok(Math.abs(recencyWeight(at(30), now) - Math.exp(-1)) < 0.01);
  assert.equal(recencyWeight('not-a-date', now), 0);
});

test('multi-keyword OR retrieval spans topics and respects limit', () => {
  const db = new Database(':memory:');
  migrate(db);
  seedIndex(db);
  const results = retrieve(db, ['deepfake', 'ransomware'], { limit: 1 });
  assert.equal(results.length, 1);
  // deepfake story: fresher AND keyword-richer than the ransomware one
  assert.match(results[0].title, /Deepfake CEO/);
});

test('empty index, no keywords, and unmatched terms all return []', () => {
  const db = new Database(':memory:');
  migrate(db);
  assert.deepEqual(retrieve(db, ['phishing']), []); // empty index
  seedIndex(db);
  assert.deepEqual(retrieve(db, []), []);
  assert.deepEqual(retrieve(db, ['   ']), []);
  assert.deepEqual(retrieve(db, ['juice-jacking']), []); // no article mentions it
});

test('FTS syntax characters in keywords are neutralized by quoting', () => {
  const db = new Database(':memory:');
  migrate(db);
  seedIndex(db);
  // would be a syntax error / column filter if passed unquoted
  assert.deepEqual(retrieve(db, ['title:AND(']), []);
  const ok = retrieve(db, ['deepfake "video call"']);
  assert.ok(Array.isArray(ok)); // must not throw
});
