// Template batch B contract tests (Phase O3): comic-strip, comic-reveal,
// statement-bold, scenario-response. Each template must pass the D1 manifest
// gate, build fabric-v6-safe canvas JSON in BOTH orientations at the locked
// dims, bind every contentSchema block (comic: heading AND text; scenario:
// situation AND response — via msgId + fieldRef, the qa_chat idiom), keep
// image slots honest at the schema's declared count, keep decor opacity
// restrained, and render SVG previews for both orientations.
//
// Modules are imported directly (registry registration is a separate,
// one-line-per-template change in templates/v2/index.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import comicStrip from '../../templates/v2/comic_strip.js';
import comicReveal from '../../templates/v2/comic_reveal.js';
import statementBold from '../../templates/v2/statement_bold.js';
import scenarioResponse from '../../templates/v2/scenario_response.js';
import { validateManifest, sampleContentFor } from '../../templates/v2/manifest_schema.js';
import { DEFAULT_PALETTE, DEFAULT_FONTS, applyBrandOverride } from '../../templates/palette.js';

const BATCH_B = [comicStrip, comicReveal, statementBold, scenarioResponse];
const KNOWN_V6_TYPES = new Set(['Textbox', 'Rect', 'Circle', 'Polygon', 'Line', 'Ellipse', 'Triangle', 'Path', 'Group']);
const ORIENTATIONS = ['portrait', 'landscape'];
const DIMS = {
  portrait: { w: 1414, h: 2000 },
  landscape: { w: 2000, h: 1414 }
};
const TEXT_ROLES = new Set(['headline', 'subheadline', 'message', 'message-label', 'cta']);

// expected honest slot count per template given its content
const EXPECTED_SLOTS = {
  'comic-strip': (t, content) => Math.min(t.contentSchema.imageSlots, content.blocks.length),
  'comic-reveal': () => 3,
  'statement-bold': () => 0,
  'scenario-response': () => 1
};

function build(t, orientation, content, palette = DEFAULT_PALETTE, fonts = DEFAULT_FONTS) {
  return t.build[orientation](content, palette, fonts);
}

function assertFiniteNumbers(obj, label) {
  for (const [k, val] of Object.entries(obj)) {
    if (typeof val === 'number') assert.ok(Number.isFinite(val), `${label}: ${k} is finite`);
    else if (val && typeof val === 'object') assertFiniteNumbers(val, `${label}.${k}`);
  }
}

// ── manifest contract ────────────────────────────────────────────────────────

test('batch B: all four manifests pass validateManifest with zero problems', () => {
  for (const t of BATCH_B) {
    assert.deepEqual(validateManifest(t), [], `${t.id}: manifest valid`);
  }
  assert.equal(new Set(BATCH_B.map((t) => t.id)).size, 4, 'unique ids');

  assert.equal(comicStrip.style, 'comic');
  assert.equal(comicStrip.contentSchema.blocks.kind, 'panels');
  assert.deepEqual(comicStrip.contentSchema.blocks.fields, ['heading', 'text']);
  assert.equal(comicStrip.contentSchema.imageSlots, 3);

  assert.equal(comicReveal.style, 'comic');
  assert.equal(comicReveal.contentSchema.blocks.kind, 'panels');
  assert.equal(comicReveal.contentSchema.blocks.min, 3);
  assert.equal(comicReveal.contentSchema.blocks.max, 3);
  assert.equal(comicReveal.contentSchema.imageSlots, 3);

  assert.equal(statementBold.style, 'statement');
  assert.equal(statementBold.contentSchema.blocks.kind, 'single');
  assert.equal(statementBold.contentSchema.blocks.min, 1);
  assert.equal(statementBold.contentSchema.blocks.max, 1);
  assert.deepEqual(statementBold.contentSchema.blocks.fields, ['text']);
  assert.equal(statementBold.contentSchema.imageSlots, 0);

  assert.equal(scenarioResponse.style, 'scenario');
  assert.equal(scenarioResponse.contentSchema.blocks.kind, 'scenario');
  assert.deepEqual(scenarioResponse.contentSchema.blocks.fields, ['situation', 'response']);
  assert.equal(scenarioResponse.contentSchema.blocks.min, 2);
  assert.equal(scenarioResponse.contentSchema.blocks.max, 3);
  assert.equal(scenarioResponse.contentSchema.imageSlots, 1);
});

// ── builds: fabric contract, both orientations ───────────────────────────────

test('batch B: builds return valid fabric-v6 canvas JSON in both orientations', () => {
  for (const t of BATCH_B) {
    const content = sampleContentFor(t.contentSchema);
    for (const orientation of ORIENTATIONS) {
      const canvas = build(t, orientation, content);
      assert.equal(canvas.width, DIMS[orientation].w, `${t.id}/${orientation}: width`);
      assert.equal(canvas.height, DIMS[orientation].h, `${t.id}/${orientation}: height`);
      assert.ok(typeof canvas.background === 'string' && canvas.background, `${t.id}/${orientation}: background`);
      assert.ok(Array.isArray(canvas.objects) && canvas.objects.length > 5, `${t.id}/${orientation}: objects`);

      const round = JSON.parse(JSON.stringify(canvas));
      assert.equal(round.objects.length, canvas.objects.length, `${t.id}/${orientation}: JSON round-trip`);

      for (const o of canvas.objects) {
        assert.ok(KNOWN_V6_TYPES.has(o.type), `${t.id}/${orientation}: fabric v6 type (got "${o.type}")`);
        assert.ok(typeof o.layerRole === 'string' && o.layerRole, `${t.id}/${orientation}: layerRole on every object`);
        assertFiniteNumbers(o, `${t.id}/${orientation}/${o.type}`);
      }

      // text + slots stay inside the canvas
      for (const o of canvas.objects.filter((x) => TEXT_ROLES.has(x.layerRole) || x.layerRole === 'image-slot')) {
        assert.ok(o.left >= 0 && o.top >= 0, `${t.id}/${orientation}: ${o.layerRole} inside canvas`);
        assert.ok(o.left + (o.width || 0) <= DIMS[orientation].w, `${t.id}/${orientation}: ${o.layerRole} right edge inside`);
        assert.ok(o.top <= DIMS[orientation].h, `${t.id}/${orientation}: ${o.layerRole} top inside`);
      }
    }
  }
});

// ── bindings: every block, both orientations ─────────────────────────────────

test('batch B: headline/subheadline/cta placed verbatim with size floors', () => {
  for (const t of BATCH_B) {
    const content = sampleContentFor(t.contentSchema);
    for (const orientation of ORIENTATIONS) {
      const canvas = build(t, orientation, content);

      const headline = canvas.objects.find((o) => o.layerRole === 'headline');
      assert.ok(headline && headline.type === 'Textbox', `${t.id}/${orientation}: headline Textbox`);
      assert.equal(headline.text, content.headline, `${t.id}/${orientation}: headline verbatim`);
      assert.ok(headline.fontSize >= 80, `${t.id}/${orientation}: headline >= 80px floor`);
      assert.ok(canvas.objects.some((o) => o.layerRole === 'subheadline'), `${t.id}/${orientation}: subheadline placed`);

      const cta = canvas.objects.find((o) => o.layerRole === 'cta');
      assert.ok(cta, `${t.id}/${orientation}: cta placed`);
      assert.equal(cta.text, content.callToAction, `${t.id}/${orientation}: cta verbatim`);

      const msgObjs = canvas.objects.filter((o) => o.layerRole === 'message');
      for (const m of msgObjs) {
        assert.equal(m.type, 'Textbox', `${t.id}/${orientation}: messages are Textboxes`);
        assert.ok(m.fontSize >= 38, `${t.id}/${orientation}: message >= 38px floor`);
        assert.ok(typeof m.bgRef === 'string' && m.bgRef, `${t.id}/${orientation}: message carries bgRef`);
      }
      const placedIds = new Set(msgObjs.map((o) => o.msgId));
      for (const b of content.blocks) {
        assert.ok(placedIds.has(b.id), `${t.id}/${orientation}: ${b.id} bound`);
      }
      // every msgId points at a real block
      const blockIds = new Set(content.blocks.map((b) => b.id));
      for (const o of canvas.objects.filter((x) => x.msgId)) {
        assert.ok(blockIds.has(o.msgId), `${t.id}/${orientation}: msgId "${o.msgId}" points at a block`);
      }
    }
  }
});

test('comic templates bind heading AND text per block via fieldRef, both orientations', () => {
  for (const t of [comicStrip, comicReveal]) {
    const content = sampleContentFor(t.contentSchema);
    for (const orientation of ORIENTATIONS) {
      const canvas = build(t, orientation, content);
      for (const b of content.blocks) {
        const heading = canvas.objects.find((o) => o.layerRole === 'message' && o.msgId === b.id && o.fieldRef === 'heading');
        const text = canvas.objects.find((o) => o.layerRole === 'message' && o.msgId === b.id && o.fieldRef === 'text');
        assert.ok(heading, `${t.id}/${orientation}: ${b.id} heading bound`);
        assert.ok(text, `${t.id}/${orientation}: ${b.id} text bound`);
        assert.equal(heading.text, b.heading, `${t.id}/${orientation}: ${b.id} heading verbatim`);
        assert.equal(text.text, b.text, `${t.id}/${orientation}: ${b.id} text verbatim`);
        assert.ok(heading.fontSize >= text.fontSize, `${t.id}/${orientation}: ${b.id} heading dominates caption`);
      }
    }
  }
});

test('comic-reveal emphasizes the final panel (~2x the setup panels)', () => {
  const content = sampleContentFor(comicReveal.contentSchema);
  const last = content.blocks[content.blocks.length - 1];
  const first = content.blocks[0];
  for (const orientation of ORIENTATIONS) {
    const canvas = build(comicReveal, orientation, content);
    const frameOf = (id) => canvas.objects.find(
      (o) => o.type === 'Rect' && o.msgId === id && o.layerRole === 'background' && o.stroke
    );
    const f1 = frameOf(first.id);
    const fLast = frameOf(last.id);
    assert.ok(f1 && fLast, `${orientation}: panel frames present`);
    const area = (f) => f.width * f.height;
    assert.ok(area(fLast) >= area(f1) * 1.8, `${orientation}: reveal panel ~2x (${area(fLast)} vs ${area(f1)})`);
  }
});

test('statement-bold sets one massive statement bound to blk-1', () => {
  const content = sampleContentFor(statementBold.contentSchema);
  assert.equal(content.blocks.length, 1, 'single block');
  for (const orientation of ORIENTATIONS) {
    const canvas = build(statementBold, orientation, content);
    const statements = canvas.objects.filter((o) => o.layerRole === 'message');
    assert.equal(statements.length, 1, `${orientation}: exactly one statement`);
    assert.equal(statements[0].msgId, 'blk-1', `${orientation}: bound to blk-1`);
    assert.equal(statements[0].text, content.blocks[0].text, `${orientation}: statement verbatim`);
    assert.ok(statements[0].fontSize >= 80, `${orientation}: statement is massive (>= 80px, got ${statements[0].fontSize})`);
    const headline = canvas.objects.find((o) => o.layerRole === 'headline');
    assert.ok(statements[0].fontSize >= headline.fontSize, `${orientation}: statement dominates the headline`);
    assert.equal(canvas.objects.filter((o) => o.layerRole === 'image-slot' && o.slotId !== 'bg').length, 0, `${orientation}: no image slots`);
  }
});

test('scenario-response binds situation AND response per block via fieldRef, both orientations', () => {
  const content = sampleContentFor(scenarioResponse.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = build(scenarioResponse, orientation, content);
    for (const b of content.blocks) {
      const s = canvas.objects.find((o) => o.layerRole === 'message' && o.msgId === b.id && o.fieldRef === 'situation');
      const r = canvas.objects.find((o) => o.layerRole === 'message' && o.msgId === b.id && o.fieldRef === 'response');
      assert.ok(s, `${orientation}: ${b.id} situation bound`);
      assert.ok(r, `${orientation}: ${b.id} response bound`);
      assert.equal(s.text, b.situation, `${orientation}: ${b.id} situation verbatim`);
      assert.equal(r.text, b.response, `${orientation}: ${b.id} response verbatim`);
      // split card: response panel sits right of the situation panel
      assert.ok(r.left > s.left, `${orientation}: ${b.id} response right of situation`);
      // label chips group with the block
      const labels = canvas.objects.filter((o) => o.layerRole === 'message-label' && o.msgId === b.id);
      assert.ok(labels.length >= 4, `${orientation}: ${b.id} situation+response chips bound`);
    }
  }
});

// ── image slots stay honest ──────────────────────────────────────────────────

test('batch B: image slots honest — dashed empty frames, count matches schema', () => {
  for (const t of BATCH_B) {
    const content = sampleContentFor(t.contentSchema);
    const expected = EXPECTED_SLOTS[t.id](t, content);
    for (const orientation of ORIENTATIONS) {
      const canvas = build(t, orientation, content);
      const slots = canvas.objects.filter((o) => o.layerRole === 'image-slot' && o.slotId !== 'bg');
      assert.equal(slots.length, expected, `${t.id}/${orientation}: ${expected} slot(s)`);
      assert.ok(slots.length <= t.contentSchema.imageSlots, `${t.id}/${orientation}: never above schema imageSlots`);
      assert.equal(new Set(slots.map((s) => s.slotId)).size, slots.length, `${t.id}/${orientation}: unique slotIds`);
      for (const s of slots) {
        assert.equal(s.fill, 'transparent', `${t.id}/${orientation}: empty frame, not a fake image`);
        assert.ok(Array.isArray(s.strokeDashArray), `${t.id}/${orientation}: dashed frame`);
        assert.ok(s.slotSpec?.slotId && s.slotSpec?.styleHint, `${t.id}/${orientation}: slot spec present`);
        assert.equal(s.slotId, s.slotSpec.slotId, `${t.id}/${orientation}: slotId consistent`);
        assert.ok(/no text/i.test(s.slotSpec.styleHint), `${t.id}/${orientation}: styleHint enforces zero text`);
      }
    }
  }
});

// ── decor discipline ─────────────────────────────────────────────────────────

test('batch B: decor atmosphere keeps explicit opacity <= 0.2 in every build', () => {
  for (const t of BATCH_B) {
    const content = sampleContentFor(t.contentSchema);
    for (const orientation of ORIENTATIONS) {
      const canvas = build(t, orientation, content);
      const atmosphere = canvas.objects.filter(
        (o) => ['decor', 'background'].includes(o.layerRole) && typeof o.opacity === 'number'
      );
      assert.ok(atmosphere.length > 0, `${t.id}/${orientation}: decor atmosphere present`);
      for (const o of atmosphere) {
        assert.ok(o.opacity > 0 && o.opacity <= 0.2,
          `${t.id}/${orientation}: ${o.type} opacity ${o.opacity} in (0, 0.2]`);
      }
      // exactly one full-bleed gradient wash under everything
      const washes = canvas.objects.filter((o) => o.fill && o.fill.type === 'linear' && o.layerRole === 'background');
      assert.equal(washes.length, 1, `${t.id}/${orientation}: one gradient wash`);
    }
  }
});

// ── robustness: min/max block counts ─────────────────────────────────────────

test('batch B: min and max block counts build clean in both orientations', () => {
  for (const t of BATCH_B) {
    const cs = t.contentSchema;
    const base = sampleContentFor(cs);
    for (const count of [cs.blocks.min, cs.blocks.max]) {
      const blocks = [];
      for (let i = 0; i < count; i++) blocks.push({ ...base.blocks[i % base.blocks.length], id: `blk-${i + 1}` });
      const content = { ...base, subheadline: count === cs.blocks.min ? null : base.subheadline, blocks };
      for (const orientation of ORIENTATIONS) {
        const canvas = build(t, orientation, content);
        const placed = new Set(canvas.objects.filter((o) => o.layerRole === 'message').map((o) => o.msgId));
        for (const b of blocks) assert.ok(placed.has(b.id), `${t.id}/${orientation}: ${b.id} placed at ${count} blocks`);
        JSON.parse(JSON.stringify(canvas));
      }
    }
  }
});

// ── previews ─────────────────────────────────────────────────────────────────

test('batch B: previews are orientation-proportioned SVGs with no broken values', () => {
  for (const t of BATCH_B) {
    for (const orientation of ORIENTATIONS) {
      const svg = t.preview[orientation](DEFAULT_PALETTE);
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${t.id}/${orientation}: preview svg`);
      assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${t.id}/${orientation}: no broken values`);
      const viewBox = orientation === 'landscape' ? 'viewBox="0 0 283 200"' : 'viewBox="0 0 200 283"';
      assert.ok(svg.includes(viewBox), `${t.id}/${orientation}: ${viewBox}`);
    }
  }
});

test('batch B: previews and builds honor an overridden palette', () => {
  const { palette, fonts } = applyBrandOverride({ primary: '#1D4ED8', accent: '#DC2626', background: '#FFFFFF' });
  for (const t of BATCH_B) {
    for (const orientation of ORIENTATIONS) {
      const svg = t.preview[orientation](palette);
      assert.ok(svg.includes('#1D4ED8') || svg.includes('#DC2626') || svg.includes('#FFFFFF'),
        `${t.id}/${orientation}: preview reflects override`);
      const canvas = build(t, orientation, sampleContentFor(t.contentSchema), palette, fonts);
      assert.ok(JSON.stringify(canvas).includes('#1D4ED8'), `${t.id}/${orientation}: build consumes the palette`);
    }
  }
});
