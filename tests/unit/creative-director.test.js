// Creative-director agent: constrained choice from the curated library, with
// a deterministic fallback that never blocks the pipeline.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directCreative, moodsForTopic, candidateBriefs } from '../../agents/creative_director.js';
import { PALETTES, FONT_PAIRS, getPalette, getFontPair } from '../../data/creative-library.js';
import { applyBrandOverride } from '../../templates/palette.js';
import { FakeEgress } from './helpers/fake_egress.js';

const TEMPLATES = [
  { id: 'stats-impact', name: 'Stats Impact', style: 'stats', blocksKind: 'stats', imageSlots: 1 },
  { id: 'qa-chat', name: 'Q&A Chat', style: 'qa', blocksKind: 'qa-pairs', imageSlots: 0 },
  { id: 'timeline-journey', name: 'Timeline Journey', style: 'timeline', blocksKind: 'sequence', imageSlots: 2 }
];

const BRAND = applyBrandOverride(null);

test('creative library: every palette has full key set and distinct id', () => {
  const ids = new Set();
  for (const p of PALETTES) {
    for (const k of ['primary', 'secondary', 'accent', 'background', 'dark']) {
      assert.match(p[k], /^#[0-9A-F]{6}$/i, `${p.id}.${k}`);
    }
    assert.ok(!ids.has(p.id));
    ids.add(p.id);
    assert.ok(p.moods.length >= 2);
  }
  assert.ok(PALETTES.length >= 10);
  assert.ok(FONT_PAIRS.length >= 6);
});

test('no egress → deterministic brief with valid library picks', async () => {
  const brief = await directCreative({
    egress: null, runId: null, topic: 'ransomware attack response', format: 'steps',
    templates: TEMPLATES, brand: BRAND
  });
  assert.ok(getFontPair(brief.fontPairId));
  assert.ok(getPalette(brief.paletteId), 'palette id resolves in library');
  assert.equal(brief.templateId, 'timeline-journey'); // sequence matches steps
  assert.ok(brief.palette.primary && brief.fonts.head);
  assert.ok(Array.isArray(brief.motifs));
});

test('urgent topic words push urgent/dark moods to the front', () => {
  const moods = moodsForTopic('phishing scam alert', 'qa');
  assert.equal(moods[0], 'urgent');
  assert.ok(moods.includes('dark'));
});

test('model pick honored when ids valid; palette/fonts resolved from library', async () => {
  const egress = new FakeEgress({
    'creative-director': JSON.stringify({
      paletteId: 'midnight-cyan', fontPairId: 'space-ibm', templateId: 'stats-impact',
      visualMode: 'futuristic', motifs: ['circuit lines', 'hex grid'],
      imageStyle: 'dark neon macro photography', rationale: 'tech mood'
    })
  });
  const brief = await directCreative({
    egress, runId: 'run-1', topic: 'mfa adoption stats', format: 'stat',
    templates: TEMPLATES, brand: BRAND
  });
  assert.equal(brief.paletteId, 'midnight-cyan');
  assert.equal(brief.palette.background, getPalette('midnight-cyan').background);
  assert.equal(brief.fonts.head, 'Space Grotesk');
  assert.equal(brief.templateId, 'stats-impact');
  assert.equal(brief.visualMode, 'futuristic');
  assert.deepEqual(brief.motifs, ['circuit lines', 'hex grid']);
});

test('invalid template id from model → falls back to deterministic template', async () => {
  const egress = new FakeEgress({
    'creative-director': JSON.stringify({
      paletteId: 'forest-trust', fontPairId: 'merriweather-lato', templateId: 'nonexistent',
      visualMode: 'editorial', motifs: [], imageStyle: 'x', rationale: 'y'
    })
  });
  const brief = await directCreative({
    egress, runId: 'run-2', topic: 'data privacy policy', format: 'policy',
    templates: TEMPLATES, brand: BRAND
  });
  assert.ok(TEMPLATES.some((t) => t.id === brief.templateId));
  assert.equal(brief.paletteId, 'forest-trust');
});

test('unparseable model output → deterministic fallback', async () => {
  const egress = new FakeEgress({ 'creative-director': 'sorry, cannot help with that' });
  const brief = await directCreative({
    egress, runId: 'run-3', topic: 'passwords', format: 'qa',
    templates: TEMPLATES, brand: BRAND
  });
  assert.ok(getPalette(brief.paletteId));
  assert.equal(brief.templateId, 'qa-chat');
});

test('candidateBriefs: diversifies palette/fonts/template; brandLocked keeps org colors everywhere', async () => {
  const base = await directCreative({
    egress: null, runId: null, topic: 'ransomware alert', format: 'steps',
    templates: TEMPLATES, brand: BRAND
  });
  const cands = candidateBriefs(base, {
    topic: 'ransomware alert', format: 'steps', templates: TEMPLATES, brand: BRAND, count: 3
  });
  assert.equal(cands[0], base);
  assert.ok(cands.length >= 2);
  for (const c of cands.slice(1)) {
    const differs = c.paletteId !== base.paletteId || c.fontPairId !== base.fontPairId || c.templateId !== base.templateId;
    assert.ok(differs, 'each variant differs materially from the base brief');
    assert.ok(c.palette && c.fonts, 'variants are fully resolved');
  }

  const locked = candidateBriefs(base, {
    topic: 'ransomware alert', format: 'steps', templates: TEMPLATES, brand: BRAND, brandLocked: true, count: 3
  });
  for (const c of locked.slice(1)) {
    assert.equal(c.palette.primary, BRAND.palette.primary, 'brand colors locked on every candidate');
  }
});

test('brandLocked keeps org palette; fonts/template still directed', async () => {
  const egress = new FakeEgress({
    'creative-director': JSON.stringify({
      paletteId: 'deep-violet', fontPairId: 'bebas-open', templateId: 'qa-chat',
      visualMode: 'holographic', motifs: ['m'], imageStyle: 's', rationale: 'r'
    })
  });
  const brief = await directCreative({
    egress, runId: 'run-4', topic: 'phishing', format: 'qa',
    templates: TEMPLATES, brand: BRAND, brandLocked: true
  });
  assert.equal(brief.paletteId, 'brand-override');
  assert.equal(brief.palette.primary, BRAND.palette.primary);
  assert.equal(brief.fonts.head, 'Bebas Neue');
  assert.equal(brief.templateId, 'qa-chat');
});
