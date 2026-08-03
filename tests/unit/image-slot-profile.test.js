// Tests for slot-profile classification (slotProfileFor), hexToColorWord,
// brandPaletteClause, and the effect of slot profile + palette on the generated
// image prompt (conceptForPoint slot-class rules, generateAsset palette clause).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRunId } from '#shared';
import { slotProfileFor } from '../../pipelines/image_pipeline.js';
import { hexToColorWord, brandPaletteClause, generateAsset } from '../../agents/image_generator.js';
import { conceptForPoint, fallbackConceptForProfile } from '../../agents/image_concept.js';
import { FakeEgress, GEN_IMAGE_1024 } from './helpers/fake_egress.js';

// Standard canvas dims used throughout
const CANVAS = { width: 1414, height: 2000 }; // total area 2 828 000

// ── hexToColorWord ────────────────────────────────────────────────────────────

test('hexToColorWord: known brand hex values map to expected words', () => {
  assert.equal(hexToColorWord('#E3AF32'), 'gold',        'AB InBev gold');
  assert.equal(hexToColorWord('#C8102E'), 'deep red',    'AB InBev red accent');
  assert.equal(hexToColorWord('#F5F0E8'), 'warm off-white', 'AB InBev background');
  assert.equal(hexToColorWord('#1F1A17'), 'charcoal',    'AB InBev near-black dark');
  assert.equal(hexToColorWord('#000000'), 'black',       'pure black');
  assert.equal(hexToColorWord('#FFFFFF'), 'white',       'pure white');
});

test('hexToColorWord: case-insensitive and trims whitespace', () => {
  assert.equal(hexToColorWord('#e3af32'), 'gold');
  assert.equal(hexToColorWord('  #E3AF32  '), 'gold');
  assert.equal(hexToColorWord('#1d4ed8'), 'strong blue');
});

test('hexToColorWord: invalid / missing values return neutral', () => {
  assert.equal(hexToColorWord(''), 'neutral');
  assert.equal(hexToColorWord(null), 'neutral');
  assert.equal(hexToColorWord(undefined), 'neutral');
  assert.equal(hexToColorWord('not-a-color'), 'neutral');
  assert.equal(hexToColorWord('#GGG'), 'neutral');
  assert.equal(hexToColorWord('#12345'), 'neutral', '5-digit hex is invalid');
});

test('hexToColorWord: picks nearest for cyan-ish values', () => {
  const w = hexToColorWord('#22D3EE');
  assert.ok(w.includes('cyan') || w.includes('blue'), `expected cyan/blue family, got "${w}"`);
});

// ── brandPaletteClause ───────────────────────────────────────────────────────

test('brandPaletteClause: includes STRICT COLOR PALETTE header', () => {
  const clause = brandPaletteClause({ primary: '#E3AF32', accent: '#C8102E', background: '#F5F0E8', dark: '#1F1A17' });
  assert.ok(clause.includes('STRICT COLOR PALETTE'), 'clause starts with the strict header');
});

test('brandPaletteClause: includes hex AND word for each palette key', () => {
  const clause = brandPaletteClause({ primary: '#E3AF32', accent: '#C8102E', background: '#F5F0E8', dark: '#1F1A17' });
  assert.ok(clause.includes('#E3AF32'), 'primary hex present');
  assert.ok(clause.includes('gold'), 'primary word present');
  assert.ok(clause.includes('#C8102E'), 'accent hex present');
  assert.ok(clause.includes('deep red') || clause.includes('red'), 'accent word present');
  assert.ok(clause.includes('#F5F0E8'), 'background hex present');
  assert.ok(clause.includes('#1F1A17'), 'dark hex present');
  assert.ok(clause.includes('charcoal'), 'dark word present');
});

test('brandPaletteClause: includes "do NOT introduce" stray-color guard', () => {
  const clause = brandPaletteClause({ primary: '#E3AF32', accent: '#C8102E', background: '#F5F0E8' });
  assert.ok(clause.toLowerCase().includes('do not'), 'stray-color guard present');
  assert.ok(clause.toLowerCase().includes('clash'), 'clash warning present');
});

test('brandPaletteClause: returns empty string for null/empty/missing palette', () => {
  assert.equal(brandPaletteClause(null), '');
  assert.equal(brandPaletteClause(undefined), '');
  assert.equal(brandPaletteClause({}), '');
  assert.equal(brandPaletteClause({ primary: null, accent: null, background: null }), '');
});

// ── slotProfileFor: size class ───────────────────────────────────────────────

// canvas area = 1414 * 2000 = 2 828 000
// 8% threshold  = 226 240 px²
// 25% threshold = 707 000 px²

test('slotProfileFor: accent — slot area < 8% of canvas', () => {
  // 400 * 520 = 208 000 px² → 7.36% → accent
  const p = slotProfileFor({ left: 100, top: 200, width: 400, height: 520 }, CANVAS);
  assert.equal(p.sizeClass, 'accent', '7.36% should be accent');
});

test('slotProfileFor: card — slot area 8-25% of canvas', () => {
  // 500 * 800 = 400 000 px² → 14.1% → card
  const p = slotProfileFor({ left: 200, top: 300, width: 500, height: 800 }, CANVAS);
  assert.equal(p.sizeClass, 'card', '14.1% should be card');
});

test('slotProfileFor: hero — slot area > 25% of canvas', () => {
  // 900 * 1200 = 1 080 000 px² → 38.2% → hero
  const p = slotProfileFor({ left: 50, top: 100, width: 900, height: 1200 }, CANVAS);
  assert.equal(p.sizeClass, 'hero', '38.2% should be hero');
});

test('slotProfileFor: exact boundary — 8% is card (≤ 0.08 is accent, > 0.08 → card)', () => {
  // 8% exactly: 226240 / 2828000 = 0.08 → areaRatio < 0.08 is accent, 0.08 is NOT < 0.08 → card
  const px = Math.sqrt(0.08 * 1414 * 2000);
  const side = Math.ceil(px); // slightly over 8%
  const p = slotProfileFor({ left: 0, top: 0, width: side, height: side }, CANVAS);
  assert.equal(p.sizeClass, 'card', 'just over 8% should be card');
});

// ── slotProfileFor: aspect ───────────────────────────────────────────────────

test('slotProfileFor: aspect — tall/wide/square', () => {
  // tall: h/w > 1.2, i.e. w/h < 0.83
  const tall = slotProfileFor({ left: 0, top: 0, width: 200, height: 400 }, CANVAS);
  assert.equal(tall.aspect, 'tall', 'w/h = 0.5 → tall');

  const wide = slotProfileFor({ left: 0, top: 0, width: 600, height: 300 }, CANVAS);
  assert.equal(wide.aspect, 'wide', 'w/h = 2 → wide');

  const sq = slotProfileFor({ left: 0, top: 0, width: 400, height: 400 }, CANVAS);
  assert.equal(sq.aspect, 'square', 'w/h = 1 → square');

  // near-square: ratio 0.9 (within 0.83–1.2 band)
  const nearSq = slotProfileFor({ left: 0, top: 0, width: 360, height: 400 }, CANVAS);
  assert.equal(nearSq.aspect, 'square', 'w/h = 0.9 → square (within band)');
});

// ── slotProfileFor: position ──────────────────────────────────────────────────

test('slotProfileFor: position — nine-zone grid', () => {
  const C = CANVAS; // 1414 x 2000

  // top-left: center at (235, 333) → cx=0.166, cy=0.166 → both < 1/3 → top-left
  const tl = slotProfileFor({ left: 0, top: 0, width: 470, height: 666 }, C);
  assert.equal(tl.position, 'top-left');

  // center: slot center exactly at (707, 1000) → cx=0.5, cy=0.5 → center
  const ctr = slotProfileFor({ left: 607, top: 900, width: 200, height: 200 }, C);
  assert.equal(ctr.position, 'center');

  // bottom-right: center at (1200, 1700) → cx=0.848, cy=0.85 → bottom-right
  const br = slotProfileFor({ left: 1100, top: 1600, width: 200, height: 200 }, C);
  assert.equal(br.position, 'bottom-right');

  // top-center: cx in middle third, cy in top third
  const tc = slotProfileFor({ left: 550, top: 0, width: 400, height: 300 }, C);
  assert.equal(tc.position, 'top-center');

  // center-left: cx in left third, cy in middle third
  const cl = slotProfileFor({ left: 0, top: 700, width: 400, height: 400 }, C);
  assert.equal(cl.position, 'center-left');
});

// ── slotProfileFor: handles missing/zero canvas ──────────────────────────────

test('slotProfileFor: uses default canvas dims when canvas omitted', () => {
  // Should not throw and should return a valid profile
  const p = slotProfileFor({ left: 100, top: 100, width: 300, height: 300 }, null);
  assert.ok(['accent', 'card', 'hero'].includes(p.sizeClass));
  assert.ok(['tall', 'wide', 'square'].includes(p.aspect));
  assert.ok(typeof p.position === 'string');
});

// ── generateAsset: palette clause in prompt ───────────────────────────────────

async function promptFromAsset(args) {
  const egress = new FakeEgress({ 'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'M' } });
  await generateAsset({ egress, runId: newRunId('poster'), styleHint: 'a phishing hook', templateStyle: 'minimal-clean', ...args });
  return egress.calls[0].opts.prompt;
}

test('generateAsset: with palette → STRICT COLOR PALETTE clause with hex + words in prompt', async () => {
  const palette = { primary: '#E3AF32', accent: '#C8102E', background: '#F5F0E8', dark: '#1F1A17' };
  const prompt = await promptFromAsset({ palette });
  assert.ok(prompt.includes('STRICT COLOR PALETTE'), 'strict palette header in prompt');
  assert.ok(prompt.includes('#E3AF32'), 'primary hex in prompt');
  assert.ok(prompt.includes('gold'), 'primary word in prompt');
  assert.ok(prompt.includes('#C8102E'), 'accent hex in prompt');
  assert.ok(prompt.includes('#F5F0E8'), 'background hex in prompt');
  assert.ok(prompt.includes('#1F1A17'), 'dark hex in prompt');
  assert.ok(prompt.includes('charcoal'), 'dark word in prompt');
  assert.ok(prompt.toLowerCase().includes('do not'), 'stray-hue guard in prompt');
});

test('generateAsset: without palette → falls back to legacy Color palette: words (no STRICT header)', async () => {
  const prompt = await promptFromAsset({ palette: null, visualMode: '' });
  assert.ok(!prompt.includes('STRICT COLOR PALETTE'), 'no STRICT header when palette absent');
  assert.ok(prompt.includes('Color palette:'), 'falls back to legacy Color palette clause');
});

test('generateAsset: palette clause is appended AFTER subject + style (subject still leads)', async () => {
  const palette = { primary: '#E3AF32', accent: '#C8102E', background: '#F5F0E8' };
  const prompt = await promptFromAsset({ palette, styleHint: 'a tidy cleared desk' });
  const subjectIdx = prompt.indexOf('a tidy cleared desk');
  const paletteIdx = prompt.indexOf('STRICT COLOR PALETTE');
  assert.ok(subjectIdx > -1, 'subject is in prompt');
  assert.ok(paletteIdx > subjectIdx, 'palette clause comes after the subject');
});

test('generateAsset: background slot also gets palette clause', async () => {
  const palette = { primary: '#E3AF32', accent: '#C8102E', background: '#F5F0E8' };
  const prompt = await promptFromAsset({ palette, slotId: 'bg', bgConcept: 'an abstract tech horizon' });
  assert.ok(prompt.includes('STRICT COLOR PALETTE'), 'palette clause present for background slot');
  assert.ok(prompt.includes('#E3AF32'), 'primary hex in bg prompt');
});

// ── generateAsset: slot-profile composition directive in prompt ───────────────

test('generateAsset: accent slot profile → accent composition directive in prompt', async () => {
  const profile = { sizeClass: 'accent', aspect: 'square', position: 'top-right' };
  const prompt = await promptFromAsset({ slotProfile: profile });
  assert.ok(prompt.toLowerCase().includes('accent'), 'accent class name in prompt');
  assert.ok(prompt.toLowerCase().includes('single iconic') || prompt.toLowerCase().includes('iconic'), 'iconic/minimal directive');
  assert.ok(prompt.toLowerCase().includes('no busy scenes') || prompt.toLowerCase().includes('no multiple subjects')
    || prompt.toLowerCase().includes('busy'), 'busy-scene ban in prompt');
});

test('generateAsset: card slot profile → card composition directive in prompt', async () => {
  const profile = { sizeClass: 'card', aspect: 'wide', position: 'center' };
  const prompt = await promptFromAsset({ slotProfile: profile });
  assert.ok(prompt.toLowerCase().includes('card'), 'card class in prompt');
  assert.ok(prompt.toLowerCase().includes('single') || prompt.toLowerCase().includes('clear primary'), 'single-subject directive');
});

test('generateAsset: hero slot profile → hero composition directive in prompt', async () => {
  const profile = { sizeClass: 'hero', aspect: 'tall', position: 'bottom-left' };
  const prompt = await promptFromAsset({ slotProfile: profile });
  assert.ok(prompt.toLowerCase().includes('hero'), 'hero class in prompt');
  assert.ok(prompt.toLowerCase().includes('full') || prompt.toLowerCase().includes('rich scene'), 'full scene directive');
});

test('generateAsset: no slotProfile → no slot class directive injected', async () => {
  const prompt = await promptFromAsset({ slotProfile: null });
  assert.ok(!prompt.includes('SLOT PROFILE'), 'no SLOT PROFILE block when profile is null');
});

test('generateAsset: slot position and aspect names present in profile directive', async () => {
  const profile = { sizeClass: 'card', aspect: 'tall', position: 'top-center' };
  const prompt = await promptFromAsset({ slotProfile: profile });
  assert.ok(prompt.includes('top-center') || prompt.includes('top-center'), 'position in prompt');
  assert.ok(prompt.includes('tall'), 'aspect in prompt');
});

test('generateAsset: subject still leads prompt even with slotProfile + palette', async () => {
  const profile = { sizeClass: 'hero', aspect: 'tall', position: 'center' };
  const palette = { primary: '#E3AF32', accent: '#C8102E', background: '#F5F0E8' };
  const hint = 'a unique descriptive hint that must come first';
  const prompt = await promptFromAsset({ styleHint: hint, slotProfile: profile, palette });
  const subjectIdx = prompt.indexOf(hint);
  const paletteIdx = prompt.indexOf('STRICT COLOR PALETTE');
  const profileIdx = prompt.indexOf('SLOT PROFILE');
  assert.ok(subjectIdx > -1, 'subject in prompt');
  assert.ok(paletteIdx > subjectIdx, 'palette after subject');
  assert.ok(profileIdx > subjectIdx, 'profile after subject');
});

// ── conceptForPoint: slot class rule injected into user prompt ────────────────

test('conceptForPoint: accent slotProfile injects accent class rule into user prompt', async () => {
  const egress = new FakeEgress({ 'image-concept/concept_for_point': JSON.stringify({ concept: 'a minimal padlock icon' }) });
  const slotProfile = { sizeClass: 'accent', aspect: 'square', position: 'top-right' };
  await conceptForPoint({ egress, runId: 'r', point: 'Lock your screen when leaving your desk', topics: [], slotProfile });
  const sent = egress.calls[0].opts.user;
  assert.ok(sent.includes('SLOT CLASS') || sent.includes('accent'), 'slot class rule injected into concept prompt');
  assert.ok(sent.toUpperCase().includes('FORBIDDEN') || sent.includes('EXPLICITLY'), 'busy-scene ban in concept prompt');
});

test('conceptForPoint: card slotProfile injects card class rule', async () => {
  const egress = new FakeEgress({ 'image-concept/concept_for_point': JSON.stringify({ concept: 'x' }) });
  const slotProfile = { sizeClass: 'card', aspect: 'wide', position: 'center' };
  await conceptForPoint({ egress, runId: 'r', point: 'never share your password', topics: [], slotProfile });
  const sent = egress.calls[0].opts.user;
  assert.ok(sent.includes('card') || sent.includes('SLOT CLASS'), 'card slot class present in concept prompt');
});

test('conceptForPoint: no slotProfile → no slot class clause', async () => {
  const egress = new FakeEgress({ 'image-concept/concept_for_point': JSON.stringify({ concept: 'x' }) });
  await conceptForPoint({ egress, runId: 'r', point: 'never share your password', topics: [] });
  const sent = egress.calls[0].opts.user;
  assert.ok(!sent.includes('SLOT CLASS'), 'no slot class clause when profile is null');
});

// ── fallbackConceptForProfile ──────────────────────────────────────────────────

// v2: fallbackConceptForProfile returns a RICH concept object that stringifies
// to the legacy sentence — the sentence assertions run against String(c).

test('fallbackConceptForProfile: accent → iconic-minimal fallback', () => {
  const c = String(fallbackConceptForProfile('lock your screen', { sizeClass: 'accent' }));
  assert.ok(c.includes('iconic') || c.includes('minimal'), 'iconic/minimal in accent fallback');
  assert.ok(c.includes('lock your screen'), 'point text in fallback');
});

test('fallbackConceptForProfile: accent with empty point → generic iconic fallback', () => {
  const c = String(fallbackConceptForProfile('', { sizeClass: 'accent' }));
  assert.ok(c.includes('iconic') || c.includes('symbol'), 'generic iconic fallback for empty point');
  assert.ok(!c.includes(':'), 'no dangling colon from empty point');
});

test('fallbackConceptForProfile: card/hero → standard point-derived fallback', () => {
  const point = 'never plug in a USB stick found in the car park';
  const card = String(fallbackConceptForProfile(point, { sizeClass: 'card' }));
  const hero = String(fallbackConceptForProfile(point, { sizeClass: 'hero' }));
  assert.ok(card.includes(point), 'card fallback contains point text');
  assert.ok(hero.includes(point), 'hero fallback contains point text');
  assert.ok(!card.includes('iconic'), 'card fallback is NOT the iconic-minimal variant');
});

test('fallbackConceptForProfile: null slotProfile → standard fallback', () => {
  const c = String(fallbackConceptForProfile('always verify the sender', null));
  assert.ok(c.includes('always verify the sender'), 'standard fallback used when profile is null');
  assert.ok(!c.includes('iconic'), 'not an iconic fallback');
});

// ── conceptForPoint: accent fallback when no egress ──────────────────────────

test('conceptForPoint: accent slot with no egress → iconic-minimal fallback', async () => {
  const c = String(await conceptForPoint({
    runId: 'r', point: 'a suspicious USB stick on a desk',
    topics: ['usb threats'], slotProfile: { sizeClass: 'accent', aspect: 'square', position: 'top-right' }
    // no egress
  }));
  assert.ok(c.includes('iconic') || c.includes('minimal'), 'iconic-minimal in accent offline fallback');
  // client #1: the accent fallback now leads with the mined SIGNAL (lowercased),
  // not the full raw point — the concrete thing to depict ("usb stick").
  assert.match(c, /usb stick/i, 'mined point signal present in accent fallback');
});

test('conceptForPoint: card slot with no egress → standard point-derived fallback', async () => {
  const c = String(await conceptForPoint({
    runId: 'r', point: 'hover the link before clicking',
    topics: ['phishing'], slotProfile: { sizeClass: 'card', aspect: 'wide', position: 'center' }
  }));
  assert.ok(c.includes('hover the link before clicking'), 'standard fallback for card slot');
  assert.ok(!c.includes('iconic'), 'NOT iconic-minimal for card slot');
});
