// Asset recommender + deterministic asset-tag tests (client escalation #3).
// The recommender makes ONE cheap model call over an SQL-prefiltered shortlist
// and returns {imageId|null, confidence, reason}; only confidence >= 0.75 is
// honored by the pipeline. Deterministic fallback: exact conceptHash match else
// null. Every NEW asset gets meta.description + meta.tags derived with no model.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  recommendAsset, fallbackRecommendation, RECOMMEND_CONFIDENCE_THRESHOLD
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

test('deriveAssetTags: background asset uses treatment + bg tags', () => {
  const { tags } = deriveAssetTags({
    concept: 'a calm aurora gradient field', treatment: 'gradient', sizeClass: 'bg',
    palette: { background: '#0D0C12', primary: '#E3AF32' }, isBg: true
  });
  assert.ok(tags.includes('gradient'), 'treatment tag');
  assert.ok(tags.includes('background'), 'background kind tag');
});
