// Port-fidelity tests for rag/scoring.js against the reference
// js/feed_scoring.js methodology: exact weights (+5/+2/-3), MIN_SCORE 5,
// CVE exclusion, and the noise-term matching split (substring for multi-word
// or >=5-char terms, word-boundary for short abbreviations).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CRITICAL, DEFAULT_CONTEXT, DEFAULT_NOISE, MIN_SCORE,
  scoreText, hasCveReference, shouldIncludeItem, normalizeSnapshot
} from '../../rag/scoring.js';

test('default keyword lists match the reference verbatim (spot anchors + sizes)', () => {
  assert.equal(MIN_SCORE, 5);
  assert.equal(DEFAULT_CRITICAL.length, 47);
  assert.equal(DEFAULT_CONTEXT.length, 8);
  assert.equal(DEFAULT_NOISE.length, 50);
  // anchors that downstream behavior depends on ('bec'/'poc' are now stored
  // trimmed — word-boundary matching replaced the trailing-space sentinels)
  for (const k of ['phishing', 'ransomware', 'deepfake', 'bec', 'pig butcher']) {
    assert.ok(DEFAULT_CRITICAL.includes(k), `critical missing "${k}"`);
  }
  assert.ok(DEFAULT_CONTEXT.includes('remote work'));
  for (const k of ['cve', 'rce', 'patch tuesday', 'poc', 'disclosure:']) {
    assert.ok(DEFAULT_NOISE.includes(k), `noise missing "${k}"`);
  }
  // no list may reintroduce a trailing/leading-space sentinel: keyword_store
  // normalize() trims on save, so such terms would corrupt after any mutation
  for (const list of [DEFAULT_CRITICAL, DEFAULT_CONTEXT, DEFAULT_NOISE]) {
    for (const k of list) assert.equal(k, k.trim(), `untrimmed keyword "${k}"`);
  }
});

test('scoreText applies reference weights: critical +5, context +2, noise -3', () => {
  // one critical hit
  assert.equal(scoreText('Ransomware crew hits logistics firm'), 5);
  // 'scams' (5 chars, substring) and 'gift card scam' (multi-word, substring)
  // both hit; 'scam' (4 chars) is now word-boundary-matched and does NOT
  // double-count inside "scams"
  assert.equal(scoreText('Gift card scams on the rise'), 5 + 5); // scams + gift card scam
  // context-only stays below the include gate
  assert.equal(scoreText('aws and azure cloud pricing update'), 6); // 3 context terms
  // noise subtracts
  assert.equal(scoreText('phishing tutorial'), 5 + 5 - 3); // phishing + phish - tutorial
});

test('short abbreviations use word boundaries in ALL lists (bec/poc regression)', () => {
  // 'bec' must not substring-match inside 'quebec', nor 'poc' inside 'epoch'
  assert.equal(scoreText('quebec conference on epoch computing'), 0);
  // standalone 'bec' still scores as a critical term (+5)
  assert.equal(scoreText('bec attack wave'), 5);
  // 'phish' is 5 chars -> substring matching, still hits inside 'phishing'
  assert.equal(scoreText('phishing'), 5 + 5); // phishing + phish
});

test('noise matching: word boundary for short terms, substring for long/multi-word', () => {
  assert.equal(scoreText('Task force report on payment fraud'), 5); // 'rce' inside 'force' ignored
  assert.equal(scoreText('New RCE found in mail gateway with password reset fraud angle'), 5 + 5 - 3); // password + fraud - rce (standalone)
  assert.equal(scoreText('Malware campaign uses zero day tricks'), 5 - 3); // malware - 'zero day' (substring, multi-word)
  assert.equal(scoreText('Phishing defense guidebook for staff'), 5 + 5 - 3); // 'guide' (5 chars -> substring) matches inside 'guidebook'
});

test('CVE reference excludes the item outright, regardless of score', () => {
  const title = 'Phishing lures deliver malware exploiting CVE-2026-31007';
  assert.ok(hasCveReference(title));
  assert.ok(scoreText(title) >= MIN_SCORE); // would otherwise pass
  assert.equal(shouldIncludeItem(title, 'Employees tricked into credential theft via fake login pages.'), false);
  assert.ok(!hasCveReference('Phishing wave hits regional banks'));
});

test('shouldIncludeItem gates on MIN_SCORE across title+description', () => {
  // 4 points (two context terms) — below gate
  assert.equal(shouldIncludeItem('Cloud vendor earnings roundup', 'Quarterly results for infrastructure companies.'), false);
  // 7 points (password +5, workplace +2) — above gate, included
  assert.equal(shouldIncludeItem('Password reuse still rampant', 'Survey of workplace habits.'), true);
});

test('custom snapshot overrides defaults; empty lists fall back to defaults', () => {
  const snap = { critical: ['usb drop'], context: ['office'], noise: ['webinar'] };
  assert.equal(scoreText('usb drop attack in office parking webinar', snap), 5 + 2 - 3);
  const normalized = normalizeSnapshot({ critical: [], context: null, noise: undefined });
  assert.deepEqual(normalized.critical, DEFAULT_CRITICAL);
  assert.deepEqual(normalized.context, DEFAULT_CONTEXT);
  assert.deepEqual(normalized.noise, DEFAULT_NOISE);
});
