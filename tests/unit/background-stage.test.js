// Background-decision stage tests (Phase F): the director picks a valid
// treatment + concept per mode (deterministic fallback + model parse), the
// reviewer scores/threshold/fails-open, and generateAsset shapes the background
// prompt by treatment + director concept.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideBackground, BACKGROUND_TREATMENTS } from '../../agents/background_director.js';
import { reviewBackground, BACKGROUND_THRESHOLD } from '../../agents/background_reviewer.js';
import { generateAsset } from '../../agents/image_generator.js';
import { FakeEgress, GEN_IMAGE_1024, IMAGE_BASE64 } from './helpers/fake_egress.js';

// ── director ─────────────────────────────────────────────────────────────────

test('decideBackground: deterministic per-mode treatment when no model', async () => {
  const f = await decideBackground({ runId: 'r', topics: ['phishing'], visualMode: 'futuristic' });
  const h = await decideBackground({ runId: 'r', topics: ['phishing'], visualMode: 'holographic' });
  const e = await decideBackground({ runId: 'r', topics: ['phishing'], visualMode: 'editorial' });
  assert.equal(f.treatment, 'image');
  assert.equal(h.treatment, 'gradient-mesh');
  assert.equal(e.treatment, 'pattern');
  for (const d of [f, h, e]) {
    assert.ok(BACKGROUND_TREATMENTS.includes(d.treatment));
    assert.ok(d.concept && typeof d.concept === 'string');
  }
});

test('decideBackground: parses a valid model decision; junk → fallback', async () => {
  const good = new FakeEgress({ 'background-director/decide_background': JSON.stringify({ treatment: 'pattern', concept: 'isometric grid of glowing nodes', rationale: 'fits' }) });
  const d = await decideBackground({ egress: good, runId: 'r', topics: ['x'], visualMode: 'futuristic' });
  assert.equal(d.treatment, 'pattern');
  assert.match(d.concept, /isometric grid/);

  const junk = new FakeEgress({ 'background-director/decide_background': 'nope' });
  const d2 = await decideBackground({ egress: junk, runId: 'r', topics: ['x'], visualMode: 'futuristic' });
  assert.equal(d2.treatment, 'image', 'fell back to the deterministic decision');
});

test('decideBackground: an art-direction brief seeds the fallback concept', async () => {
  const d = await decideBackground({ runId: 'r', visualMode: 'holographic', brief: { backgroundConcept: 'a bespoke neon horizon' } });
  assert.equal(d.concept, 'a bespoke neon horizon');
});

// ── reviewer ─────────────────────────────────────────────────────────────────

test('reviewBackground: score >= threshold accepted; below → rework; no egress → accepted', async () => {
  const hi = new FakeEgress({ 'background-reviewer/review_background': { score: 82 } });
  assert.equal((await reviewBackground({ egress: hi, runId: 'r', imageBase64: IMAGE_BASE64, treatment: 'image' })).status, 'accepted');

  const lo = new FakeEgress({ 'background-reviewer/review_background': { score: 40, issues: 'busy center' } });
  const v = await reviewBackground({ egress: lo, runId: 'r', imageBase64: IMAGE_BASE64, treatment: 'gradient-mesh' });
  assert.equal(v.status, 'rework');
  assert.ok(v.score < BACKGROUND_THRESHOLD);
  assert.match(v.feedback, /busy center/);

  assert.equal((await reviewBackground({ runId: 'r', imageBase64: IMAGE_BASE64 })).status, 'accepted');
});

test('reviewBackground: prompt names the treatment + legibility criterion', async () => {
  const egress = new FakeEgress({ 'background-reviewer/review_background': { score: 90 } });
  await reviewBackground({ egress, runId: 'r', imageBase64: IMAGE_BASE64, treatment: 'pattern' });
  assert.match(egress.calls[0].opts.prompt, /pattern/i);
  assert.match(egress.calls[0].opts.prompt, /readable|calm|legib/i);
});

// ── generateAsset treatment shaping ──────────────────────────────────────────

test('generateAsset: background treatment + director concept shape the prompt', async () => {
  const egress = new FakeEgress({ 'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'M' } });
  await generateAsset({ egress, runId: 'r', slotId: 'bg', treatment: 'gradient-mesh', bgConcept: 'flowing cyan aurora field', visualMode: 'holographic', size: '1024x1536' });
  const p = egress.calls[0].opts.prompt;
  assert.match(p, /GRADIENT-MESH/i, 'treatment shapes the render style');
  assert.match(p, /flowing cyan aurora field/i, 'director concept leads the background');
});
