// Asset recommender + deterministic asset-tag tests (client escalation #3).
// The recommender makes ONE cheap model call over an SQL-prefiltered shortlist
// and returns {imageId|null, confidence, reason}; only confidence >= 0.75 is
// honored by the pipeline. Deterministic fallback: exact conceptHash match else
// null. Every NEW asset gets meta.description + meta.tags derived with no model.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  recommendAsset, fallbackRecommendation, RECOMMEND_CONFIDENCE_THRESHOLD,
  scoreCandidate, rankCandidates, GENERATE_SCORE_THRESHOLD
} from '../../agents/asset_recommender.js';
import { deriveAssetTags } from '../../image-library/store.js';
import { FakeEgress } from './helpers/fake_egress.js';

const CANDIDATES = [
  { imageId: 'img-a', description: 'a magnifying glass over an email sender-address bar', tags: ['sender address', 'domain', 'magnifying glass', 'foreground', 'card'], conceptHash: 'hash-a' },
  { imageId: 'img-b', description: 'a padlock on a laptop', tags: ['padlock', 'laptop', 'foreground', 'card'], conceptHash: 'hash-b' }
];

test('recommendAsset: model picks a candidate above threshold', async () => {
  const egress = new FakeEgress({
    'asset-recommender/recommend_asset': JSON.stringify({ imageId: 'img-a', confidence: 0.9, reason: 'same sender-address signal' })
  });
  const rec = await recommendAsset({
    egress, runId: 'r',
    need: { point: 'check the sender address', concept: 'magnifying glass over a sender bar', treatment: 'fg', sizeClass: 'card', paletteWord: 'gold' },
    candidates: CANDIDATES
  });
  assert.equal(rec.imageId, 'img-a');
  assert.ok(rec.confidence >= RECOMMEND_CONFIDENCE_THRESHOLD, 'confidence at/above threshold');
});

test('recommendAsset: low-confidence recommendation is returned as-is (pipeline rejects it below 0.75)', async () => {
  const egress = new FakeEgress({
    'asset-recommender/recommend_asset': JSON.stringify({ imageId: 'img-b', confidence: 0.5, reason: 'only topical overlap' })
  });
  const rec = await recommendAsset({ egress, runId: 'r', need: {}, candidates: CANDIDATES });
  assert.equal(rec.imageId, 'img-b');
  assert.ok(rec.confidence < RECOMMEND_CONFIDENCE_THRESHOLD, 'confidence below threshold — pipeline will not reuse');
});

test('recommendAsset: null recommendation when nothing fits', async () => {
  const egress = new FakeEgress({
    'asset-recommender/recommend_asset': JSON.stringify({ imageId: null, confidence: 0.2, reason: 'no match' })
  });
  const rec = await recommendAsset({ egress, runId: 'r', need: {}, candidates: CANDIDATES });
  assert.equal(rec.imageId, null);
});

test('recommendAsset: a hallucinated imageId (not in candidates) is rejected', async () => {
  const egress = new FakeEgress({
    'asset-recommender/recommend_asset': JSON.stringify({ imageId: 'img-ghost', confidence: 0.99, reason: 'made up' })
  });
  const rec = await recommendAsset({ egress, runId: 'r', need: {}, candidates: CANDIDATES });
  assert.equal(rec.imageId, null, 'unknown imageId dropped');
  assert.equal(rec.confidence, 0);
});

test('recommendAsset: no egress → deterministic fallback matches exact conceptHash', async () => {
  const rec = await recommendAsset({
    runId: 'r', need: { conceptHash: 'hash-b' }, candidates: CANDIDATES
  });
  assert.equal(rec.imageId, 'img-b');
  assert.equal(rec.confidence, 1);
});

test('recommendAsset: no egress + no hash match → null', async () => {
  const rec = await recommendAsset({ runId: 'r', need: { conceptHash: 'nope' }, candidates: CANDIDATES });
  assert.equal(rec.imageId, null);
});

test('recommendAsset: empty candidate set → null with no model call', async () => {
  const egress = new FakeEgress({});
  const rec = await recommendAsset({ egress, runId: 'r', need: {}, candidates: [] });
  assert.equal(rec.imageId, null);
  assert.equal(egress.calls.length, 0, 'no model call for empty candidates');
});

test('recommendAsset: model error → deterministic fallback', async () => {
  const egress = new FakeEgress({
    'asset-recommender/recommend_asset': () => { throw new Error('boom'); }
  });
  const rec = await recommendAsset({ egress, runId: 'r', need: { conceptHash: 'hash-a' }, candidates: CANDIDATES });
  assert.equal(rec.imageId, 'img-a', 'fell back to hash match on model error');
});

test('fallbackRecommendation: unit — hash hit vs null', () => {
  assert.equal(fallbackRecommendation({ conceptHash: 'hash-a' }, CANDIDATES).imageId, 'img-a');
  assert.equal(fallbackRecommendation({}, CANDIDATES).imageId, null);
});

// ── deterministic description + tags (client #3a) ────────────────────────────

test('deriveAssetTags: concept becomes the description; tags = signals + treatment + sizeClass + palette word', () => {
  const { description, tags } = deriveAssetTags({
    concept: 'a magnifying glass over an email sender-address bar with the domain highlighted',
    point: 'check the sender address and domain',
    signals: ['sender address', 'domain'],
    treatment: '',
    sizeClass: 'card',
    palette: { primary: '#E3AF32', background: '#0D0C12' },
    isBg: false
  });
  assert.match(description, /magnifying glass over an email sender-address bar/, 'concept IS the description');
  assert.ok(tags.length >= 5 && tags.length <= 8, '5-8 tags');
  assert.ok(tags.includes('sender address') || tags.includes('sender'), 'signal tag present');
  assert.ok(tags.includes('card'), 'sizeClass tag present');
  assert.ok(tags.includes('foreground'), 'kind tag present');
  assert.ok(tags.includes('gold') || tags.includes('near-black'), 'palette word tag present');
});

// ── v2 weighted scoring (topic 45% / style 20% / palette 15% / recency 10% /
// learning 10%; hard zero-text filter; sub-0.45 best → generate fresh) ────────

const NOW = Date.parse('2026-08-04T12:00:00Z');
const DAYS = (n) => new Date(NOW - n * 86400000).toISOString();

// The need: a rich concept (as conceptForPoint v2 returns) for a phishing point.
const RICH_NEED = {
  point: 'check the sender address and the real domain',
  concept: {
    subject: 'a magnifying glass over an email sender address bar, domain highlighted',
    styleKeywords: ['flat vector', 'editorial'],
    mood: 'calm, confident'
  },
  topic: 'phishing'
};

const BRAND = { primary: '#E3AF32', background: '#0D0C12' };

const RELEVANT_IMG = {
  imageId: 'img-relevant',
  description: 'a magnifying glass over an email sender address bar',
  tags: ['sender address', 'domain'],
  topics: 'phishing, email, sender address, domain',
  style: 'flat vector editorial illustration',
  palette: ['#D4A017', '#111111'],   // gold-ish + near-black → close to brand hues
  created_at: DAYS(5),               // fresh
  zero_text_passed: 1
};

const IRRELEVANT_IMG = {
  imageId: 'img-irrelevant',
  description: 'a watering can over a flowerbed',
  tags: ['gardening'],
  topics: 'gardening, flowers, watering can',
  style: 'watercolor painting',
  palette: ['#16A34A'],              // green — off-brand
  created_at: DAYS(200),             // stale
  zero_text_passed: 1
};

test('v2 scoring: relevant image beats irrelevant image', () => {
  const rel = scoreCandidate(RICH_NEED, RELEVANT_IMG, { brandPalette: BRAND, now: NOW });
  const irr = scoreCandidate(RICH_NEED, IRRELEVANT_IMG, { brandPalette: BRAND, now: NOW });
  assert.ok(rel.score > irr.score, `relevant (${rel.score}) outranks irrelevant (${irr.score})`);
  assert.ok(rel.breakdown.topicScore > 0.5, 'strong topic overlap for the relevant image');
  assert.equal(irr.breakdown.topicScore, 0, 'zero topic overlap for the irrelevant image');
  const ranked = rankCandidates(RICH_NEED, [IRRELEVANT_IMG, RELEVANT_IMG], { brandPalette: BRAND, now: NOW });
  assert.equal(ranked[0].imageId, 'img-relevant', 'rankCandidates sorts the relevant image first');
});

test('v2 scoring: breakdown parts — palette nearest-hue match and 90-day recency decay', () => {
  const rel = scoreCandidate(RICH_NEED, RELEVANT_IMG, { brandPalette: BRAND, now: NOW });
  assert.ok(rel.breakdown.paletteScore > 0.7, 'gold+near-black palette ≈ brand palette');
  assert.ok(rel.breakdown.recency > 0.9, '5-day-old asset scores near-full recency');
  const stale = scoreCandidate(RICH_NEED, { ...RELEVANT_IMG, created_at: DAYS(120) }, { brandPalette: BRAND, now: NOW });
  assert.equal(stale.breakdown.recency, 0, 'older than ~90 days → zero recency');
  const off = scoreCandidate(RICH_NEED, IRRELEVANT_IMG, { brandPalette: BRAND, now: NOW });
  assert.ok(off.breakdown.paletteScore < rel.breakdown.paletteScore, 'green palette scores below gold');
});

test('v2 scoring: learning approval rows mentioning the image topics add the learning boost', () => {
  const rows = [{ kind: 'approval', topic: 'phishing', detail: 'users approved the sender-address magnifier poster', weight: 1 }];
  const withBoost = scoreCandidate(RICH_NEED, RELEVANT_IMG, { brandPalette: BRAND, learningRows: rows, now: NOW });
  const without = scoreCandidate(RICH_NEED, RELEVANT_IMG, { brandPalette: BRAND, learningRows: [], now: NOW });
  assert.equal(withBoost.breakdown.learningBoost, 1, 'approval row matches the image topics');
  assert.ok(withBoost.score > without.score, 'learning boost raises the total score');
  const rejection = [{ kind: 'rejection', topic: 'phishing', detail: 'x' }];
  assert.equal(scoreCandidate(RICH_NEED, RELEVANT_IMG, { learningRows: rejection, now: NOW }).breakdown.learningBoost, 0,
    'non-approval rows never boost');
});

test('v2 hard filter: zero_text_passed=0 candidates are excluded even on a conceptHash match', async () => {
  const failed = { ...RELEVANT_IMG, imageId: 'img-text', conceptHash: 'hash-x', zero_text_passed: 0 };
  const rec = await recommendAsset({
    runId: 'r', need: { ...RICH_NEED, conceptHash: 'hash-x' },
    candidates: [failed], brandPalette: BRAND, now: NOW
  });
  assert.equal(rec.imageId, null, 'gate-failed asset never recommended');
});

test('v2 threshold: best score below 0.45 → recommend GENERATE (imageId null), not a weak library match', async () => {
  const rec = await recommendAsset({
    runId: 'r', need: RICH_NEED, candidates: [IRRELEVANT_IMG], brandPalette: BRAND, now: NOW
  });
  assert.equal(rec.imageId, null, 'weak match rejected');
  assert.equal(rec.action, 'generate', 'explicit generate recommendation');
  assert.ok(rec.confidence < GENERATE_SCORE_THRESHOLD, 'confidence carries the weak score');
  assert.match(rec.reason, /generate/i, 'reason says to generate fresh');
});

test('v2 deterministic path: a strong scored match is recommended when no egress is available', async () => {
  const rows = [{ kind: 'approval', topic: 'phishing email', detail: 'approved sender-address imagery' }];
  const rec = await recommendAsset({
    runId: 'r', need: RICH_NEED,
    candidates: [IRRELEVANT_IMG, RELEVANT_IMG],
    brandPalette: BRAND, learningRows: rows, now: NOW
  });
  assert.equal(rec.imageId, 'img-relevant', 'weighted scoring picks the relevant asset offline');
  assert.ok(rec.confidence >= GENERATE_SCORE_THRESHOLD, 'confidence = weighted score at/above threshold');
  assert.ok(rec.scores, 'score breakdown attached');
});

test('v2 model guard: a model pick whose weighted score is weak is downgraded to generate', async () => {
  const egress = new FakeEgress({
    'asset-recommender/recommend_asset': JSON.stringify({ imageId: 'img-irrelevant', confidence: 0.9, reason: 'looks fine' })
  });
  const rec = await recommendAsset({
    egress, runId: 'r', need: RICH_NEED,
    candidates: [IRRELEVANT_IMG, RELEVANT_IMG], brandPalette: BRAND, now: NOW
  });
  assert.equal(rec.imageId, null, 'weakly-scored model pick rejected');
  assert.equal(rec.action, 'generate');
});

test('v2 compat: legacy candidates without scoring metadata keep the legacy model contract', async () => {
  // no topics/style/created_at/palette on the candidates → the model pick is
  // honored untouched (the pipeline prefilter path).
  const egress = new FakeEgress({
    'asset-recommender/recommend_asset': JSON.stringify({ imageId: 'img-a', confidence: 0.9, reason: 'same signal' })
  });
  const rec = await recommendAsset({ egress, runId: 'r', need: {}, candidates: CANDIDATES });
  assert.equal(rec.imageId, 'img-a', 'legacy candidates never downgraded');
});

test('deriveAssetTags: background asset uses treatment + bg tags', () => {
  const { tags } = deriveAssetTags({
    concept: 'a calm aurora gradient field', treatment: 'gradient', sizeClass: 'bg',
    palette: { background: '#0D0C12', primary: '#E3AF32' }, isBg: true
  });
  assert.ok(tags.includes('gradient'), 'treatment tag');
  assert.ok(tags.includes('background'), 'background kind tag');
});
