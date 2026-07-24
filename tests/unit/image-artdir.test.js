// Phase A/B art-direction + quality-foundation tests: aspect-correct sizing,
// real-dim cover-fit, futuristic/mode-aware prompts, background-slot mode, and
// the art-direction brief flowing into the generated prompt.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAsset } from '../../agents/image_generator.js';
import { sizeForSlot } from '../../pipelines/image_pipeline.js';
import { pngDimensions, imageDims } from '../../image-library/store.js';
import { FakeEgress, GEN_IMAGE_1024, pngOfSize } from './helpers/fake_egress.js';

const CTX = { runId: 'run-1' };
function genEgress() {
  return new FakeEgress({ 'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'M' } });
}
async function promptFor(args) {
  const egress = genEgress();
  await generateAsset({ egress, runId: 'run-1', ...args });
  return egress.calls[0].opts;
}

// ── sizeForSlot: aspect-correct render size ──────────────────────────────────

test('sizeForSlot: picks portrait/landscape/square by frame aspect', () => {
  assert.equal(sizeForSlot({ width: 400, height: 1200 }), '1024x1536', 'tall → portrait');
  assert.equal(sizeForSlot({ width: 1200, height: 400 }), '1536x1024', 'wide → landscape');
  assert.equal(sizeForSlot({ width: 500, height: 500 }), '1024x1024', 'square → square');
  assert.equal(sizeForSlot({ width: 300, height: 320 }), '1024x1024', 'near-square → square');
});

// ── pixel-dim tracking ───────────────────────────────────────────────────────

test('pngDimensions: reads IHDR width/height; imageDims reads them from a row meta', () => {
  const buf = Buffer.from(pngOfSize(1024, 1536), 'base64');
  assert.deepEqual(pngDimensions(buf), { width: 1024, height: 1536 });
  assert.equal(pngDimensions(Buffer.from('not a png')), null);
  assert.deepEqual(imageDims({ meta: JSON.stringify({ width: 1536, height: 1024 }) }), { width: 1536, height: 1024 });
  assert.equal(imageDims({ meta: null }), null);
});

// ── futuristic / mode-aware prompts ──────────────────────────────────────────

test('generateAsset: futuristic mode injects high-tech language + neon palette + passes size', async () => {
  const opts = await promptFor({ styleHint: 'a locked laptop', templateStyle: 'stats', visualMode: 'futuristic', size: '1024x1536' });
  assert.match(opts.prompt, /futuristic|high-tech|holographic|neon|circuitry/i, 'high-tech adjectives present');
  assert.match(opts.prompt, /neon|cyan|luminous/i, 'neon palette words present');
  assert.equal(opts.size, '1024x1536', 'aspect-correct size passed to the provider');
});

test('generateAsset: editorial mode reads clean/editorial, not neon', async () => {
  const opts = await promptFor({ styleHint: 'a tidy desk', templateStyle: 'statement', visualMode: 'editorial' });
  assert.match(opts.prompt, /editorial|minimal|magazine/i, 'editorial adjectives');
});

test('generateAsset: background slot (slotId=bg) requests a full-bleed, text-calm backdrop', async () => {
  const opts = await promptFor({
    styleHint: '', templateStyle: 'infographic', visualMode: 'futuristic', slotId: 'bg',
    brief: { backgroundConcept: 'a vast neon data-mesh horizon', lighting: 'cyan volumetric glow', texture: ['circuitry', 'grid'], slotDirective: 'cohesive neon look' }
  });
  assert.match(opts.prompt, /full-bleed|background|edge-to-edge/i, 'background framing');
  assert.match(opts.prompt, /data-mesh|neon/i, 'uses the brief backgroundConcept');
  assert.match(opts.prompt, /readable|calm|low-detail/i, 'text-legibility guidance for backgrounds');
});

test('generateAsset: an art-direction brief injects lighting + motifs + slot directive', async () => {
  const opts = await promptFor({
    styleHint: 'a phishing hook', templateStyle: 'stats', visualMode: 'futuristic',
    brief: { lighting: 'rim light cyan bloom', texture: ['hex grid', 'particles'], slotDirective: 'match the poster neon palette', backgroundConcept: '' }
  });
  assert.match(opts.prompt, /rim light cyan bloom/i, 'lighting from brief');
  assert.match(opts.prompt, /hex grid|particles/i, 'motifs from brief');
  assert.match(opts.prompt, /match the poster neon palette/i, 'slot directive from brief');
});

test('generateAsset: no visualMode/brief keeps the legacy default prompt shape', async () => {
  const opts = await promptFor({ styleHint: 'a shield', templateStyle: 'minimal-clean' });
  assert.match(opts.prompt, /thin-line minimal flat icon/i, 'legacy template family adjective');
  assert.equal(opts.size, '1024x1024', 'default square size');
});
