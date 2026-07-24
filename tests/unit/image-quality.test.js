// Image Aesthetic QA agent tests (Phase D): scores above/below the threshold,
// background role adds a legibility criterion, and the gate fails OPEN on
// missing egress or unparseable output (never blocks a poster).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewImage, AESTHETIC_THRESHOLD } from '../../agents/image_quality_reviewer.js';
import { FakeEgress, IMAGE_BASE64 } from './helpers/fake_egress.js';

const BRIEF = { lighting: 'cyan bloom', texture: ['circuitry', 'grid'], backgroundConcept: 'neon horizon', slotDirective: 'glossy neon object' };

test('reviewImage: score >= threshold → accepted', async () => {
  const egress = new FakeEgress({ 'image-quality-reviewer/review_aesthetics': { score: 84 } });
  const v = await reviewImage({ egress, runId: 'r', imageBase64: IMAGE_BASE64, brief: BRIEF });
  assert.equal(v.status, 'accepted');
  assert.equal(v.score, 84);
});

test('reviewImage: score below threshold → rework with the model critique', async () => {
  const egress = new FakeEgress({ 'image-quality-reviewer/review_aesthetics': { score: 45, issues: 'warped and flat' } });
  const v = await reviewImage({ egress, runId: 'r', imageBase64: IMAGE_BASE64, brief: BRIEF });
  assert.equal(v.status, 'rework');
  assert.ok(v.score < AESTHETIC_THRESHOLD);
  assert.match(v.feedback, /warped and flat/);
});

test('reviewImage: a point adds a RELEVANCE criterion naming the point', async () => {
  const egress = new FakeEgress({ 'image-quality-reviewer/review_aesthetics': { score: 90 } });
  await reviewImage({ egress, runId: 'r', imageBase64: IMAGE_BASE64, brief: BRIEF, point: 'Report the email to the SOC' });
  const p = egress.calls[0].opts.prompt;
  assert.match(p, /Report the email to the SOC/, 'the point is named in the review prompt');
  assert.match(p, /RELEVANCE|depict/i, 'a relevance criterion is present');
});

test('reviewImage: background role adds a text-legibility criterion to the prompt', async () => {
  const egress = new FakeEgress({ 'image-quality-reviewer/review_aesthetics': { score: 90 } });
  await reviewImage({ egress, runId: 'r', imageBase64: IMAGE_BASE64, brief: BRIEF, slotRole: 'background' });
  assert.match(egress.calls[0].opts.prompt, /BACKGROUND|readable|calm|low-detail/i);
});

test('reviewImage: no egress → accepted (fail open)', async () => {
  const v = await reviewImage({ runId: 'r', imageBase64: IMAGE_BASE64 });
  assert.equal(v.status, 'accepted');
});

test('reviewImage: unparseable model output → accepted (fail open)', async () => {
  const egress = new FakeEgress({ 'image-quality-reviewer/review_aesthetics': 'I think it looks nice!' });
  const v = await reviewImage({ egress, runId: 'r', imageBase64: IMAGE_BASE64 });
  assert.equal(v.status, 'accepted');
});

test('reviewImage: vision error → accepted (fail open), never throws', async () => {
  const egress = new FakeEgress({ 'image-quality-reviewer/review_aesthetics': () => { throw new Error('vision down'); } });
  const v = await reviewImage({ egress, runId: 'r', imageBase64: IMAGE_BASE64 });
  assert.equal(v.status, 'accepted');
});

// ── Job D: brand-palette adherence criterion ────────────────────────────────

const PALETTE = { primary: '#1F1A17', accent: '#E3AF32', background: '#0D0C12', dark: '#000000' };

test('reviewImage: a palette adds a MANDATORY palette-adherence criterion naming the hexes', async () => {
  const egress = new FakeEgress({ 'image-quality-reviewer/review_aesthetics': { score: 90 } });
  await reviewImage({ egress, runId: 'r', imageBase64: IMAGE_BASE64, palette: PALETTE });
  const p = egress.calls[0].opts.prompt;
  assert.match(p, /BRAND PALETTE/i, 'palette criterion present');
  assert.match(p, /#E3AF32/, 'accent hex named in the prompt');
  assert.match(p, /PALETTE ADHERENCE IS MANDATORY|palette adherence/i);
  assert.match(p, /50 or below/, 'off-palette dominant hues capped at 50');
});

test('reviewImage: an off-palette rework whose issue names "palette" → reason:"palette"', async () => {
  const egress = new FakeEgress({ 'image-quality-reviewer/review_aesthetics': { score: 40, issues: 'palette violation — dominant saturated blues' } });
  const v = await reviewImage({ egress, runId: 'r', imageBase64: IMAGE_BASE64, palette: PALETTE });
  assert.equal(v.status, 'rework');
  assert.equal(v.reason, 'palette');
});

test('reviewImage: a non-palette rework carries no palette reason', async () => {
  const egress = new FakeEgress({ 'image-quality-reviewer/review_aesthetics': { score: 40, issues: 'flat and low detail' } });
  const v = await reviewImage({ egress, runId: 'r', imageBase64: IMAGE_BASE64, palette: PALETTE });
  assert.equal(v.status, 'rework');
  assert.equal(v.reason, undefined);
});

test('reviewImage: no palette → no palette criterion in the prompt (unchanged behaviour)', async () => {
  const egress = new FakeEgress({ 'image-quality-reviewer/review_aesthetics': { score: 90 } });
  await reviewImage({ egress, runId: 'r', imageBase64: IMAGE_BASE64 });
  assert.doesNotMatch(egress.calls[0].opts.prompt, /BRAND PALETTE/i);
});
