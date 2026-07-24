// Brand palette enforcement tests (client escalation #2). The forbidden-hue
// helper computes common drift hues minus the palette's own hues; the STRICT
// COLOR PALETTE clause states the dominant field + accents-only + forbidden list
// and is placed EARLY (right after the subject); a paletteRetry hoists the
// forbidden clause to the very first prompt line.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRunId } from '#shared';
import { forbiddenHues, brandPaletteClause, generateAsset } from '../../agents/image_generator.js';
import { FakeEgress, GEN_IMAGE_1024 } from './helpers/fake_egress.js';

const BLACK_GOLD = { primary: '#E3AF32', accent: '#E3AF32', background: '#0D0C12', dark: '#0D0C12' };

test('forbiddenHues: black+gold palette forbids blue/teal/green/purple/pink', () => {
  const f = forbiddenHues(BLACK_GOLD);
  assert.deepEqual([...f].sort(), ['blue', 'green', 'pink', 'purple', 'teal']);
});

test('forbiddenHues: a blue-brand palette does NOT forbid blue', () => {
  const f = forbiddenHues({ primary: '#2563EB', accent: '#E3AF32', background: '#0D0C12' });
  assert.ok(!f.includes('blue'), 'blue is allowed when the brand uses blue');
  assert.ok(f.includes('green') && f.includes('purple'), 'other drift hues still forbidden');
});

test('forbiddenHues: a green-brand palette does NOT forbid green', () => {
  const f = forbiddenHues({ primary: '#16A34A', background: '#0D0C12' });
  assert.ok(!f.includes('green'), 'green allowed when brand is green');
});

test('brandPaletteClause: states dominant field, accents-only, and the forbidden hues', () => {
  const clause = brandPaletteClause(BLACK_GOLD);
  assert.match(clause, /STRICT COLOR PALETTE/, 'strict clause present');
  assert.match(clause, /Dominant field: near-black \(#0D0C12\)/, 'dominant field named with hex');
  assert.match(clause, /Accents ONLY: .*gold \(#E3AF32\)/, 'accents-only list present');
  assert.match(clause, /FORBIDDEN: blue, teal, green, purple, pink hues/, 'dynamic forbidden hue list appended');
});

test('brandPaletteClause: empty for no palette', () => {
  assert.equal(brandPaletteClause(null), '');
  assert.equal(brandPaletteClause({}), '');
});

test('generateAsset: palette clause is placed EARLY — right after the subject, before the style clause', async () => {
  const egress = new FakeEgress({ 'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'm' } });
  await generateAsset({
    egress, runId: newRunId('poster'),
    styleHint: 'a magnifying glass over a sender-address bar', templateStyle: 'minimal-clean',
    topics: ['phishing'], palette: BLACK_GOLD
  });
  const prompt = egress.calls[0].opts.prompt;
  const subjectIdx = prompt.indexOf('A clear, LITERAL illustration');
  const paletteIdx = prompt.indexOf('STRICT COLOR PALETTE');
  const styleIdx = prompt.indexOf('Render it in this visual style');
  assert.ok(subjectIdx >= 0 && paletteIdx > subjectIdx, 'palette clause follows the subject');
  assert.ok(paletteIdx < styleIdx, 'palette clause precedes the style clause');
  assert.match(prompt, /FORBIDDEN: blue, teal, green, purple, pink hues/, 'forbidden hues in the outbound prompt');
});

test('generateAsset: paletteRetry hoists the FORBIDDEN clause to the VERY FIRST line', async () => {
  const egress = new FakeEgress({ 'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'm' } });
  await generateAsset({
    egress, runId: newRunId('poster'),
    styleHint: 'a magnifying glass over a sender-address bar', templateStyle: 'minimal-clean',
    topics: ['phishing'], palette: BLACK_GOLD, paletteRetry: true
  });
  const prompt = egress.calls[0].opts.prompt;
  assert.match(prompt, /^CRITICAL COLOR CONSTRAINT/, 'forbidden constraint is the first line on a palette retry');
  assert.match(prompt, /NO circumstances use blue, teal, green, purple, pink hues/, 'forbidden hues named up front');
});

test('generateAsset: without a palette the forbidden clause is absent (fallback palette words used)', async () => {
  const egress = new FakeEgress({ 'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'm' } });
  await generateAsset({
    egress, runId: newRunId('poster'),
    styleHint: 'a subject', templateStyle: 'minimal-clean', topics: ['phishing'], visualMode: 'futuristic'
  });
  const prompt = egress.calls[0].opts.prompt;
  assert.ok(!prompt.includes('FORBIDDEN:'), 'no forbidden clause without a brand palette');
  assert.match(prompt, /Color palette:/, 'falls back to visual-mode palette words');
});
