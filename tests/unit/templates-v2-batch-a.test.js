// Batch-A v2 template contract tests (Phase O3): bullet-beacon,
// bullet-spotlight, qa-interview, tabular-matrix. These templates are
// imported DIRECTLY (they may not be registered in templates/v2/index.js yet
// — the orchestrator wires the registry), so a local buildFor() mirrors the
// registry's buildCanvas normalization (blk-N ids, dims check). Coverage per
// template: validateManifest empty; both orientations build only whitelisted
// fabric v6 types at the locked dims; every sampleContentFor block binds to
// a message Textbox in BOTH orientations; image slots stay honest where the
// schema declares them; decor keeps the <=0.2 opacity discipline; preview
// SVGs render for both orientations.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import bulletBeacon from '../../templates/v2/bullet_beacon.js';
import bulletSpotlight from '../../templates/v2/bullet_spotlight.js';
import qaInterview from '../../templates/v2/qa_interview.js';
import tabularMatrix from '../../templates/v2/tabular_matrix.js';
import { validateManifest, sampleContentFor } from '../../templates/v2/manifest_schema.js';
import { canvasDims, ORIENTATIONS } from '../../templates/v2/decor.js';
import { DEFAULT_PALETTE, DEFAULT_FONTS, applyBrandOverride } from '../../templates/palette.js';

const BATCH_A = [bulletBeacon, bulletSpotlight, qaInterview, tabularMatrix];
const KNOWN_V6_TYPES = new Set(['Textbox', 'Rect', 'Circle', 'Polygon', 'Line', 'Ellipse', 'Triangle', 'Path', 'Group']);
const TEXT_ROLES = new Set(['headline', 'subheadline', 'message', 'message-label', 'cta']);
const SLOT_COUNTS = {
  'bullet-beacon': 1,
  'bullet-spotlight': 0,
  'qa-interview': 1,
  'tabular-matrix': 0
};

function eachTemplate(fn) {
  for (const t of BATCH_A) fn(t);
}

/** Direct-import mirror of the registry's buildCanvas (blk-N normalization + dims). */
function buildFor(t, orientation, content, palette = DEFAULT_PALETTE, fonts = DEFAULT_FONTS) {
  const normalized = structuredClone(content);
  normalized.blocks = (Array.isArray(normalized.blocks) ? normalized.blocks : []).map((b, i) => ({
    ...b, id: typeof b.id === 'string' && b.id ? b.id : `blk-${i + 1}`
  }));
  const canvas = t.build[orientation](normalized, palette, fonts);
  const { w, h } = canvasDims(orientation);
  assert.equal(canvas.width, w, `${t.id}/${orientation}: width`);
  assert.equal(canvas.height, h, `${t.id}/${orientation}: height`);
  return canvas;
}

function assertFiniteNumbers(obj, label) {
  for (const [k, val] of Object.entries(obj)) {
    if (typeof val === 'number') assert.ok(Number.isFinite(val), `${label}: ${k} is finite`);
    else if (val && typeof val === 'object') assertFiniteNumbers(val, `${label}.${k}`);
  }
}

// ── manifest contract ────────────────────────────────────────────────────────

test('batch-a: all four manifests pass validateManifest with zero problems', () => {
  eachTemplate((t) => {
    assert.deepEqual(validateManifest(t), [], `${t.id}: manifest valid`);
  });
  assert.equal(bulletBeacon.id, 'bullet-beacon');
  assert.equal(bulletBeacon.style, 'bullet');
  assert.equal(bulletSpotlight.id, 'bullet-spotlight');
  assert.equal(bulletSpotlight.style, 'bullet');
  assert.equal(qaInterview.id, 'qa-interview');
  assert.equal(qaInterview.style, 'qa');
  assert.deepEqual(qaInterview.contentSchema.blocks.fields, ['question', 'answer']);
  assert.equal(qaInterview.contentSchema.blocks.kind, 'qa-pairs');
  assert.equal(tabularMatrix.id, 'tabular-matrix');
  assert.equal(tabularMatrix.style, 'tabular');
  assert.equal(tabularMatrix.contentSchema.blocks.kind, 'cells');
  for (const t of BATCH_A) {
    assert.equal(t.contentSchema.imageSlots, SLOT_COUNTS[t.id], `${t.id}: declared imageSlots`);
  }
});

// ── build contract: fabric v6 types + dims, both orientations ────────────────

test('batch-a: builds emit only whitelisted fabric v6 types at locked dims', () => {
  eachTemplate((t) => {
    const content = sampleContentFor(t.contentSchema);
    for (const orientation of ORIENTATIONS) {
      const canvas = buildFor(t, orientation, content);
      assert.ok(typeof canvas.background === 'string' && canvas.background, `${t.id}/${orientation}: background`);
      assert.ok(Array.isArray(canvas.objects) && canvas.objects.length > 5, `${t.id}/${orientation}: objects present`);
      const round = JSON.parse(JSON.stringify(canvas));
      assert.equal(round.objects.length, canvas.objects.length, `${t.id}/${orientation}: JSON round-trip`);
      for (const o of canvas.objects) {
        assert.ok(KNOWN_V6_TYPES.has(o.type), `${t.id}/${orientation}: fabric v6 type (got "${o.type}")`);
        assert.ok(typeof o.layerRole === 'string' && o.layerRole, `${t.id}/${orientation}: layerRole on every object`);
        assertFiniteNumbers(o, `${t.id}/${orientation}/${o.type}`);
      }
      // text + slots stay inside the canvas
      const { w, h } = canvasDims(orientation);
      for (const o of canvas.objects.filter((x) => TEXT_ROLES.has(x.layerRole) || x.layerRole === 'image-slot')) {
        assert.ok(o.left >= 0 && o.top >= 0, `${t.id}/${orientation}: ${o.layerRole} inside canvas`);
        assert.ok(o.left + (o.width || 0) <= w, `${t.id}/${orientation}: ${o.layerRole} right edge inside`);
        assert.ok(o.top <= h, `${t.id}/${orientation}: ${o.layerRole} top inside`);
      }
    }
  });
});

// ── block bindings ───────────────────────────────────────────────────────────

test('batch-a: every blk-N binds to a message Textbox in BOTH orientations', () => {
  eachTemplate((t) => {
    const content = sampleContentFor(t.contentSchema);
    for (const orientation of ORIENTATIONS) {
      const canvas = buildFor(t, orientation, content);

      const headline = canvas.objects.find((o) => o.layerRole === 'headline');
      assert.ok(headline && headline.type === 'Textbox', `${t.id}/${orientation}: headline Textbox`);
      assert.equal(headline.text, content.headline, `${t.id}/${orientation}: headline verbatim`);
      assert.ok(headline.fontSize >= 80, `${t.id}/${orientation}: headline >= 80px floor`);
      assert.ok(canvas.objects.some((o) => o.layerRole === 'subheadline'), `${t.id}/${orientation}: subheadline placed`);

      const msgObjs = canvas.objects.filter((o) => o.layerRole === 'message');
      const placedIds = new Set(msgObjs.map((o) => o.msgId));
      for (const b of content.blocks) {
        assert.ok(placedIds.has(b.id), `${t.id}/${orientation}: ${b.id} bound`);
      }
      for (const m of msgObjs) {
        assert.equal(m.type, 'Textbox', `${t.id}/${orientation}: messages are Textboxes`);
        assert.ok(m.fontSize >= 16, `${t.id}/${orientation}: message >= 16px floor`);
      }

      // every msgId (chips, cards, panels included) points at a real block
      const blockIds = new Set(content.blocks.map((b) => b.id));
      for (const o of canvas.objects.filter((x) => x.msgId)) {
        assert.ok(blockIds.has(o.msgId), `${t.id}/${orientation}: msgId "${o.msgId}" points at a block`);
      }

      const cta = canvas.objects.find((o) => o.layerRole === 'cta');
      assert.ok(cta, `${t.id}/${orientation}: cta placed`);
      assert.equal(cta.text, content.callToAction, `${t.id}/${orientation}: cta verbatim`);
    }
  });
});

test('batch-a: label-bearing templates place the block text verbatim', () => {
  for (const t of [bulletBeacon, bulletSpotlight, tabularMatrix]) {
    const content = sampleContentFor(t.contentSchema);
    for (const orientation of ORIENTATIONS) {
      const canvas = buildFor(t, orientation, content);
      for (const b of content.blocks) {
        const msg = canvas.objects.find((o) => o.layerRole === 'message' && o.msgId === b.id);
        assert.equal(msg.text, b.text, `${t.id}/${orientation}: ${b.id} text verbatim`);
        const label = canvas.objects.find(
          (o) => o.layerRole === 'message-label' && o.msgId === b.id && o.type === 'Textbox'
        );
        assert.ok(label, `${t.id}/${orientation}: ${b.id} label chip text`);
        assert.equal(label.text, b.label.toUpperCase(), `${t.id}/${orientation}: ${b.id} label verbatim (chip uppercases)`);
      }
    }
  }
});

test('qa-interview binds question AND answer Textboxes per block, both orientations', () => {
  const content = sampleContentFor(qaInterview.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = buildFor(qaInterview, orientation, content);
    content.blocks.forEach((b, i) => {
      const q = canvas.objects.find((o) => o.layerRole === 'message' && o.msgId === b.id && o.fieldRef === 'question');
      const a = canvas.objects.find((o) => o.layerRole === 'message' && o.msgId === b.id && o.fieldRef === 'answer');
      assert.ok(q, `${orientation}: ${b.id} question bound`);
      assert.ok(a, `${orientation}: ${b.id} answer bound`);
      assert.equal(q.text, b.question, `${orientation}: ${b.id} question verbatim`);
      assert.equal(a.text, b.answer, `${orientation}: ${b.id} answer verbatim`);
      // answers are indented under their question (interview layout, not bubbles)
      assert.ok(a.left > q.left, `${orientation}: ${b.id} answer indented`);
      assert.ok(a.top > q.top, `${orientation}: ${b.id} answer below question`);
      // numbered index bound to the same block
      const num = canvas.objects.find(
        (o) => o.layerRole === 'message-label' && o.msgId === b.id && o.type === 'Textbox'
      );
      assert.ok(num, `${orientation}: ${b.id} index numeral`);
      assert.equal(num.text, String(i + 1).padStart(2, '0'), `${orientation}: ${b.id} numbered`);
    });
  }
});

// ── image slots stay honest ──────────────────────────────────────────────────

test('batch-a: image slots honest — dashed empty frames exactly where declared', () => {
  eachTemplate((t) => {
    const content = sampleContentFor(t.contentSchema);
    for (const orientation of ORIENTATIONS) {
      const canvas = buildFor(t, orientation, content);
      const slots = canvas.objects.filter((o) => o.layerRole === 'image-slot' && o.slotId !== 'bg');
      assert.equal(slots.length, SLOT_COUNTS[t.id], `${t.id}/${orientation}: slot count matches schema`);
      for (const s of slots) {
        assert.equal(s.fill, 'transparent', `${t.id}/${orientation}: empty frame, not a fake image`);
        assert.ok(Array.isArray(s.strokeDashArray), `${t.id}/${orientation}: dashed frame`);
        assert.ok(s.slotSpec?.slotId && s.slotSpec?.styleHint, `${t.id}/${orientation}: slot spec present`);
        assert.equal(s.slotId, s.slotSpec.slotId, `${t.id}/${orientation}: slotId consistent`);
      }
    }
  });
});

// ── decor discipline ─────────────────────────────────────────────────────────

test('batch-a: decor/background atmosphere keeps opacity <= 0.2', () => {
  eachTemplate((t) => {
    const content = sampleContentFor(t.contentSchema);
    for (const orientation of ORIENTATIONS) {
      const canvas = buildFor(t, orientation, content);
      const translucent = canvas.objects.filter(
        (o) => ['decor', 'background'].includes(o.layerRole) && o.opacity !== undefined
      );
      assert.ok(translucent.length > 0, `${t.id}/${orientation}: decor atmosphere present`);
      for (const o of translucent) {
        assert.ok(o.opacity > 0 && o.opacity <= 0.2,
          `${t.id}/${orientation}: ${o.type} opacity ${o.opacity} in (0, 0.2]`);
      }
    }
  });
});

// ── robustness + previews ────────────────────────────────────────────────────

test('batch-a: min and max block counts build clean in both orientations', () => {
  eachTemplate((t) => {
    const cs = t.contentSchema;
    const base = sampleContentFor(cs);
    for (const count of [cs.blocks.min, cs.blocks.max]) {
      const blocks = [];
      for (let i = 0; i < count; i++) blocks.push({ ...base.blocks[i % base.blocks.length], id: `blk-${i + 1}` });
      const content = { ...base, subheadline: count === cs.blocks.min ? null : base.subheadline, blocks };
      for (const orientation of ORIENTATIONS) {
        const canvas = buildFor(t, orientation, content);
        const placed = new Set(canvas.objects.filter((o) => o.layerRole === 'message').map((o) => o.msgId));
        for (const b of blocks) assert.ok(placed.has(b.id), `${t.id}/${orientation}: ${b.id} placed at ${count} blocks`);
        JSON.parse(JSON.stringify(canvas));
      }
    }
  });
});

test('batch-a: builds honor an overridden brand palette', () => {
  const { palette, fonts } = applyBrandOverride({ primary: '#1D4ED8', accent: '#DC2626', background: '#FFFFFF' });
  eachTemplate((t) => {
    const canvas = buildFor(t, 'landscape', sampleContentFor(t.contentSchema), palette, fonts);
    assert.ok(JSON.stringify(canvas).includes('#1D4ED8'), `${t.id}: build consumes the palette`);
  });
});

test('batch-a: preview SVGs are strings containing <svg for both orientations', () => {
  eachTemplate((t) => {
    for (const orientation of ORIENTATIONS) {
      const svg = t.preview[orientation](DEFAULT_PALETTE);
      assert.ok(typeof svg === 'string' && svg.includes('<svg'), `${t.id}/${orientation}: svg string`);
      assert.ok(svg.endsWith('</svg>'), `${t.id}/${orientation}: closed svg`);
      assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${t.id}/${orientation}: no broken values`);
      const expected = orientation === 'landscape' ? 'viewBox="0 0 283 200"' : 'viewBox="0 0 200 283"';
      assert.ok(svg.includes(expected), `${t.id}/${orientation}: orientation-proportioned viewBox`);
    }
  });
});
