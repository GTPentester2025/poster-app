// Batch D template contract test (Phase O3): info-command-center. This one
// template must pass the D1 manifest gate, build fabric-v6-safe canvas JSON at
// the locked dims in BOTH orientations, bind EVERY sequence block's label AND
// text to a Textbox (via the qa-chat fieldRef pattern), keep its single image
// slot honest, keep all decor opacity restrained (<= 0.2), and render SVG
// previews for both orientations. Imported directly — registration in
// templates/v2/index.js is exercised by templates-v2.test.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import infoCommandCenter from '../../templates/v2/info_command_center.js';
import magEditorial from '../../templates/v2/mag_editorial.js';
import chatDeepdive from '../../templates/v2/chat_deepdive.js';
import comicSaga from '../../templates/v2/comic_saga.js';
import statsHorizon from '../../templates/v2/stats_horizon.js';
import layeredBriefing from '../../templates/v2/layered_briefing.js';
import { validateManifest, sampleContentFor } from '../../templates/v2/manifest_schema.js';
import { DEFAULT_PALETTE, DEFAULT_FONTS, applyBrandOverride } from '../../templates/palette.js';

const T = infoCommandCenter;
const KNOWN_V6_TYPES = new Set(['Textbox', 'Rect', 'Circle', 'Polygon', 'Line', 'Ellipse', 'Triangle', 'Path', 'Group']);
const ORIENTATIONS = ['portrait', 'landscape'];
const DIMS = {
  portrait: { w: 1414, h: 2000 },
  landscape: { w: 2000, h: 1414 }
};
const TEXT_ROLES = new Set(['headline', 'subheadline', 'message', 'message-label', 'cta']);
const PREVIEW_VIEWBOX = {
  portrait: 'viewBox="0 0 200 283"',
  landscape: 'viewBox="0 0 283 200"'
};

function build(orientation, content, palette = DEFAULT_PALETTE, fonts = DEFAULT_FONTS) {
  return T.build[orientation](structuredClone(content), palette, fonts);
}

function assertFiniteNumbers(obj, label) {
  for (const [k, val] of Object.entries(obj)) {
    if (typeof val === 'number') assert.ok(Number.isFinite(val), `${label}: ${k} is finite`);
    else if (val && typeof val === 'object') assertFiniteNumbers(val, `${label}.${k}`);
  }
}

// ── manifest contract ────────────────────────────────────────────────────────

test('info-command-center: manifest passes validateManifest with zero problems', () => {
  assert.deepEqual(validateManifest(T), [], 'manifest valid');
  assert.equal(T.id, 'info-command-center');
  assert.equal(T.style, 'infographic');
  assert.equal(T.contentSchema.blocks.kind, 'sequence');
  assert.deepEqual(T.contentSchema.blocks.fields, ['label', 'text']);
  assert.equal(T.contentSchema.blocks.min, 4);
  assert.equal(T.contentSchema.blocks.max, 6);
  assert.equal(T.contentSchema.imageSlots, 1);
});

// ── builds: fabric contract, both orientations ───────────────────────────────

test('info-command-center: builds valid fabric-v6 JSON at locked dims in both orientations', () => {
  const content = sampleContentFor(T.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = build(orientation, content);
    assert.equal(canvas.width, DIMS[orientation].w, `${orientation}: width`);
    assert.equal(canvas.height, DIMS[orientation].h, `${orientation}: height`);
    assert.ok(typeof canvas.background === 'string' && canvas.background, `${orientation}: background`);
    assert.ok(Array.isArray(canvas.objects) && canvas.objects.length > 5, `${orientation}: objects`);

    const round = JSON.parse(JSON.stringify(canvas));
    assert.equal(round.objects.length, canvas.objects.length, `${orientation}: JSON round-trip`);

    for (const o of canvas.objects) {
      assert.ok(KNOWN_V6_TYPES.has(o.type), `${orientation}: whitelisted fabric v6 type (got "${o.type}")`);
      assert.ok(typeof o.layerRole === 'string' && o.layerRole, `${orientation}: layerRole on every object`);
      assertFiniteNumbers(o, `${orientation}/${o.type}`);
    }

    // text + slots stay inside the canvas
    for (const o of canvas.objects.filter((x) => TEXT_ROLES.has(x.layerRole) || x.layerRole === 'image-slot')) {
      assert.ok(o.left >= 0 && o.top >= 0, `${orientation}: ${o.layerRole} inside canvas`);
      assert.ok(o.left + (o.width || 0) <= DIMS[orientation].w, `${orientation}: ${o.layerRole} right edge inside`);
      assert.ok(o.top <= DIMS[orientation].h, `${orientation}: ${o.layerRole} top inside`);
    }
  }
});

// ── bindings: every block's label AND text → a Textbox, both orientations ─────

test('info-command-center: every blk-N label AND text binds to a Textbox in both orientations', () => {
  const content = sampleContentFor(T.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = build(orientation, content);
    for (const b of content.blocks) {
      for (const field of ['label', 'text']) {
        const bound = canvas.objects.find(
          (o) => o.type === 'Textbox' && o.msgId === b.id && o.fieldRef === field
        );
        assert.ok(bound, `${orientation}: ${b.id}.${field} bound to a Textbox`);
        // labels render uppercase — compare case-insensitively
        assert.equal(
          String(bound.text).toUpperCase(), String(b[field]).toUpperCase(),
          `${orientation}: ${b.id}.${field} verbatim`
        );
        assert.ok(bound.bgRef, `${orientation}: ${b.id}.${field} carries bgRef`);
        assert.ok(bound.fontSize >= 38 || field === 'label', `${orientation}: ${b.id}.text >= 38px floor`);
      }
    }
    // every msgId points back at a real block
    const blockIds = new Set(content.blocks.map((b) => b.id));
    for (const o of canvas.objects.filter((x) => x.msgId)) {
      assert.ok(blockIds.has(o.msgId), `${orientation}: msgId "${o.msgId}" points at a block`);
    }
    // headline/cta present with readability floors, subheadline placed
    const headline = canvas.objects.find((o) => o.layerRole === 'headline');
    assert.ok(headline && headline.type === 'Textbox', `${orientation}: headline Textbox`);
    assert.equal(headline.text, content.headline, `${orientation}: headline verbatim`);
    assert.ok(headline.fontSize >= 80, `${orientation}: headline >= 80px (got ${headline.fontSize})`);
    assert.ok(canvas.objects.some((o) => o.layerRole === 'subheadline'), `${orientation}: subheadline placed`);
    const cta = canvas.objects.find((o) => o.layerRole === 'cta');
    assert.ok(cta && cta.type === 'Textbox', `${orientation}: cta placed`);
    assert.equal(cta.text, content.callToAction, `${orientation}: cta verbatim`);
    assert.ok(cta.fontSize >= 30, `${orientation}: cta legible`);
  }
});

// ── image slot: honest + dashed, count 1 in both orientations ────────────────

test('info-command-center: one honest dashed image slot in both orientations', () => {
  const content = sampleContentFor(T.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = build(orientation, content);
    const slots = canvas.objects.filter((o) => o.layerRole === 'image-slot' && o.slotId !== 'bg');
    assert.equal(slots.length, 1, `${orientation}: exactly one image slot`);
    const s = slots[0];
    assert.equal(s.fill, 'transparent', `${orientation}: empty frame, not a fake image`);
    assert.ok(Array.isArray(s.strokeDashArray), `${orientation}: dashed frame`);
    assert.ok(s.slotSpec?.slotId && s.slotSpec?.styleHint, `${orientation}: slot spec present`);
    assert.equal(s.slotId, s.slotSpec.slotId, `${orientation}: slotId consistent`);
  }
});

// ── decor discipline: every decor/background object opacity <= 0.2 ───────────

test('info-command-center: all decor opacity <= 0.2 in both orientations', () => {
  const content = sampleContentFor(T.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = build(orientation, content);
    let translucent = 0;
    for (const o of canvas.objects.filter((x) => ['decor', 'background'].includes(x.layerRole))) {
      if (typeof o.opacity === 'number') {
        assert.ok(o.opacity > 0 && o.opacity <= 0.2,
          `${orientation}: ${o.type} decor opacity ${o.opacity} in (0, 0.2]`);
        translucent += 1;
      }
    }
    assert.ok(translucent >= 2, `${orientation}: atmosphere decor present`);
  }
});

// ── template geometry: signal-arc hero + numbered node discs + connectors ────

test('info-command-center: signal-arc hero with a numbered node disc per card', () => {
  const content = sampleContentFor(T.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = build(orientation, content);
    // node numbers 1..N present as decor Textboxes
    for (let i = 1; i <= content.blocks.length; i++) {
      assert.ok(
        canvas.objects.some((o) => o.type === 'Textbox' && o.layerRole === 'decor' && o.text === String(i)),
        `${orientation}: node number ${i} present`);
    }
    // concentric hero arcs: transparent stroked circles behind the slot
    const arcs = canvas.objects.filter(
      (o) => o.type === 'Circle' && o.fill === 'transparent' && o.stroke && o.layerRole === 'decor'
    );
    assert.ok(arcs.length >= 4, `${orientation}: concentric signal arcs present`);
  }
});

// ── previews ─────────────────────────────────────────────────────────────────

test('info-command-center: previews render SVG for both orientations', () => {
  for (const orientation of ORIENTATIONS) {
    const svg = T.preview[orientation](DEFAULT_PALETTE);
    assert.ok(typeof svg === 'string' && svg.includes('<svg'), `${orientation}: contains <svg`);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${orientation}: svg markup`);
    assert.ok(svg.includes(PREVIEW_VIEWBOX[orientation]), `${orientation}: orientation-true viewBox`);
    assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${orientation}: no broken values`);
  }
});

// ── robustness: min/max block counts + palette override ──────────────────────

test('info-command-center: min and max block counts build clean with every field bound', () => {
  const cs = T.contentSchema;
  const base = sampleContentFor(cs);
  for (const count of [cs.blocks.min, cs.blocks.max]) {
    const blocks = [];
    for (let i = 0; i < count; i++) blocks.push({ ...base.blocks[i % base.blocks.length], id: `blk-${i + 1}` });
    const content = { ...base, subheadline: count === cs.blocks.min ? null : base.subheadline, blocks };
    for (const orientation of ORIENTATIONS) {
      const canvas = build(orientation, content);
      for (const b of blocks) {
        for (const field of cs.blocks.fields) {
          assert.ok(
            canvas.objects.some((o) => o.type === 'Textbox' && o.msgId === b.id && o.fieldRef === field),
            `${orientation}: ${b.id}.${field} bound at ${count} blocks`);
        }
      }
      JSON.parse(JSON.stringify(canvas));
    }
  }
});

test('info-command-center: builds and previews consume an overridden brand palette', () => {
  const { palette } = applyBrandOverride({ primary: '#1D4ED8', accent: '#DC2626', background: '#FFFFFF' });
  for (const orientation of ORIENTATIONS) {
    const canvas = build(orientation, sampleContentFor(T.contentSchema), palette);
    assert.ok(JSON.stringify(canvas).includes('#1D4ED8'), `${orientation}: build consumes the palette`);
    const svg = T.preview[orientation](palette);
    assert.ok(svg.includes('#1D4ED8') || svg.includes('#DC2626') || svg.includes('#FFFFFF'),
      `${orientation}: preview reflects override`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// mag-editorial (style: statement) — a magazine-cover editorial. A single
// statement block set as a framed pull-quote, headline bound BOTH as a
// horizontal masthead AND an oversized rotated spine, a required subheadline,
// and TWO honest image slots (hero + inset). Landscape is a REAL relayout —
// a split cover: content column left, full-bleed hero right, inset as overlay.
// ═══════════════════════════════════════════════════════════════════════════

const M = magEditorial;
const mBuild = (orientation, content, palette = DEFAULT_PALETTE, fonts = DEFAULT_FONTS) =>
  M.build[orientation](structuredClone(content), palette, fonts);

test('mag-editorial: manifest passes validateManifest with zero problems', () => {
  assert.deepEqual(validateManifest(M), [], 'manifest valid');
  assert.equal(M.id, 'mag-editorial');
  assert.equal(M.style, 'statement');
  assert.equal(M.contentSchema.subheadline.required, true);
  assert.equal(M.contentSchema.blocks.kind, 'single');
  assert.equal(M.contentSchema.blocks.min, 1);
  assert.equal(M.contentSchema.blocks.max, 1);
  assert.deepEqual(M.contentSchema.blocks.fields, ['text']);
  assert.equal(M.contentSchema.imageSlots, 2);
});

test('mag-editorial: builds valid fabric-v6 JSON at locked dims in both orientations', () => {
  const content = sampleContentFor(M.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = mBuild(orientation, content);
    assert.equal(canvas.width, DIMS[orientation].w, `${orientation}: width`);
    assert.equal(canvas.height, DIMS[orientation].h, `${orientation}: height`);
    assert.ok(typeof canvas.background === 'string' && canvas.background, `${orientation}: background`);
    assert.ok(Array.isArray(canvas.objects) && canvas.objects.length > 5, `${orientation}: objects`);

    const round = JSON.parse(JSON.stringify(canvas));
    assert.equal(round.objects.length, canvas.objects.length, `${orientation}: JSON round-trip`);

    for (const o of canvas.objects) {
      assert.ok(KNOWN_V6_TYPES.has(o.type), `${orientation}: whitelisted fabric v6 type (got "${o.type}")`);
      assert.ok(typeof o.layerRole === 'string' && o.layerRole, `${orientation}: layerRole on every object`);
      assertFiniteNumbers(o, `${orientation}/${o.type}`);
    }

    for (const o of canvas.objects.filter((x) => TEXT_ROLES.has(x.layerRole) || x.layerRole === 'image-slot')) {
      assert.ok(o.left >= 0 && o.top >= 0, `${orientation}: ${o.layerRole} inside canvas`);
      assert.ok(o.left + (o.width || 0) <= DIMS[orientation].w, `${orientation}: ${o.layerRole} right edge inside`);
      assert.ok(o.top <= DIMS[orientation].h, `${orientation}: ${o.layerRole} top inside`);
    }
  }
});

test('mag-editorial: headline (masthead + spine), subheadline, block text, and CTA all bind in both orientations', () => {
  const content = sampleContentFor(M.contentSchema);
  const b = content.blocks[0];
  for (const orientation of ORIENTATIONS) {
    const canvas = mBuild(orientation, content);

    // headline appears as BOTH a horizontal masthead and a stacked side spine
    const masthead = canvas.objects.find(
      (o) => o.type === 'Textbox' && o.layerRole === 'headline' && o.fieldRef === 'masthead');
    const spine = canvas.objects.find(
      (o) => o.type === 'Textbox' && o.layerRole === 'headline' && o.fieldRef === 'sideband');
    assert.ok(masthead, `${orientation}: masthead headline bound`);
    assert.ok(spine, `${orientation}: spine headline bound`);
    assert.equal(masthead.text, content.headline, `${orientation}: masthead verbatim`);
    assert.equal(spine.text, content.headline, `${orientation}: spine verbatim`);
    assert.ok(masthead.fontSize >= 80, `${orientation}: masthead >= 80px (got ${masthead.fontSize})`);
    assert.ok(spine.fontSize >= 80, `${orientation}: spine >= 80px (got ${spine.fontSize})`);
    // spine is a narrow axis-aligned column (never rotated — export contract)
    assert.equal(spine.angle, undefined, `${orientation}: spine unrotated (pptx export contract)`);
    assert.ok(spine.width < masthead.width, `${orientation}: spine is a narrow column`);

    // required subheadline placed
    const sub = canvas.objects.find((o) => o.layerRole === 'subheadline');
    assert.ok(sub && sub.type === 'Textbox', `${orientation}: subheadline Textbox`);
    assert.equal(sub.text, content.subheadline, `${orientation}: subheadline verbatim`);

    // the single statement block's text bound as a pull-quote message
    const quote = canvas.objects.find(
      (o) => o.type === 'Textbox' && o.layerRole === 'message' && o.msgId === b.id && o.fieldRef === 'text');
    assert.ok(quote, `${orientation}: block text bound`);
    assert.equal(quote.text, b.text, `${orientation}: block text verbatim`);
    assert.ok(quote.fontSize >= 38, `${orientation}: block text >= 38px floor`);
    assert.ok(quote.bgRef, `${orientation}: block text carries bgRef`);

    // every msgId points back at the real block
    const blockIds = new Set(content.blocks.map((x) => x.id));
    for (const o of canvas.objects.filter((x) => x.msgId)) {
      assert.ok(blockIds.has(o.msgId), `${orientation}: msgId "${o.msgId}" points at a block`);
    }

    // CTA bound
    const cta = canvas.objects.find((o) => o.layerRole === 'cta');
    assert.ok(cta && cta.type === 'Textbox', `${orientation}: cta placed`);
    assert.equal(cta.text, content.callToAction, `${orientation}: cta verbatim`);
    assert.ok(cta.fontSize >= 30, `${orientation}: cta legible`);
  }
});

test('mag-editorial: exactly two honest dashed image slots in both orientations', () => {
  const content = sampleContentFor(M.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = mBuild(orientation, content);
    const slots = canvas.objects.filter((o) => o.layerRole === 'image-slot' && o.slotId !== 'bg');
    assert.equal(slots.length, 2, `${orientation}: exactly two image slots`);
    const ids = new Set();
    for (const s of slots) {
      assert.equal(s.fill, 'transparent', `${orientation}: empty frame, not a fake image`);
      assert.ok(Array.isArray(s.strokeDashArray), `${orientation}: dashed frame`);
      assert.ok(s.slotSpec?.slotId && s.slotSpec?.styleHint, `${orientation}: slot spec present`);
      assert.equal(s.slotId, s.slotSpec.slotId, `${orientation}: slotId consistent`);
      ids.add(s.slotId);
    }
    assert.equal(ids.size, 2, `${orientation}: distinct slot ids`);
  }
});

test('mag-editorial: all decor opacity <= 0.2 in both orientations', () => {
  const content = sampleContentFor(M.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = mBuild(orientation, content);
    let translucent = 0;
    for (const o of canvas.objects.filter((x) => ['decor', 'background'].includes(x.layerRole))) {
      if (typeof o.opacity === 'number') {
        assert.ok(o.opacity > 0 && o.opacity <= 0.2,
          `${orientation}: ${o.type} decor opacity ${o.opacity} in (0, 0.2]`);
        translucent += 1;
      }
    }
    assert.ok(translucent >= 2, `${orientation}: atmosphere decor present`);
  }
});

test('mag-editorial: previews render SVG for both orientations', () => {
  for (const orientation of ORIENTATIONS) {
    const svg = M.preview[orientation](DEFAULT_PALETTE);
    assert.ok(typeof svg === 'string' && svg.includes('<svg'), `${orientation}: contains <svg`);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${orientation}: svg markup`);
    assert.ok(svg.includes(PREVIEW_VIEWBOX[orientation]), `${orientation}: orientation-true viewBox`);
    assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${orientation}: no broken values`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// chat-deepdive (style: qa) — a threaded chat deep-dive. The conversation runs
// down a column as alternating bubbles (questions right-aligned/tinted, answers
// left-aligned/accent-edged) with avatar discs + a vertical thread line, and a
// pinned "Key takeaway" card quotes the LAST block's answer (the same answer
// text bound twice: once in the thread, once on the pin, both msgId=last block
// + fieldRef 'answer'). No image slots. Landscape is a REAL relayout: thread
// left half, takeaway + decor right half. All template text stays axis-aligned
// (no angle — the pptx export contract forbids rotated template text).
// ═══════════════════════════════════════════════════════════════════════════

const C = chatDeepdive;
const cBuild = (orientation, content, palette = DEFAULT_PALETTE, fonts = DEFAULT_FONTS) =>
  C.build[orientation](structuredClone(content), palette, fonts);

test('chat-deepdive: manifest passes validateManifest with zero problems', () => {
  assert.deepEqual(validateManifest(C), [], 'manifest valid');
  assert.equal(C.id, 'chat-deepdive');
  assert.equal(C.style, 'qa');
  assert.equal(C.contentSchema.blocks.kind, 'qa-pairs');
  assert.deepEqual(C.contentSchema.blocks.fields, ['question', 'answer']);
  assert.equal(C.contentSchema.blocks.min, 4);
  assert.equal(C.contentSchema.blocks.max, 5);
  assert.equal(C.contentSchema.imageSlots, 0);
});

test('chat-deepdive: builds valid fabric-v6 JSON at locked dims in both orientations', () => {
  const content = sampleContentFor(C.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = cBuild(orientation, content);
    assert.equal(canvas.width, DIMS[orientation].w, `${orientation}: width`);
    assert.equal(canvas.height, DIMS[orientation].h, `${orientation}: height`);
    assert.ok(typeof canvas.background === 'string' && canvas.background, `${orientation}: background`);
    assert.ok(Array.isArray(canvas.objects) && canvas.objects.length > 5, `${orientation}: objects`);

    const round = JSON.parse(JSON.stringify(canvas));
    assert.equal(round.objects.length, canvas.objects.length, `${orientation}: JSON round-trip`);

    for (const o of canvas.objects) {
      assert.ok(KNOWN_V6_TYPES.has(o.type), `${orientation}: whitelisted fabric v6 type (got "${o.type}")`);
      assert.ok(typeof o.layerRole === 'string' && o.layerRole, `${orientation}: layerRole on every object`);
      assertFiniteNumbers(o, `${orientation}/${o.type}`);
    }

    for (const o of canvas.objects.filter((x) => TEXT_ROLES.has(x.layerRole) || x.layerRole === 'image-slot')) {
      assert.ok(o.left >= 0 && o.top >= 0, `${orientation}: ${o.layerRole} inside canvas`);
      assert.ok(o.left + (o.width || 0) <= DIMS[orientation].w, `${orientation}: ${o.layerRole} right edge inside`);
      assert.ok(o.top <= DIMS[orientation].h, `${orientation}: ${o.layerRole} top inside`);
    }
  }
});

test('chat-deepdive: every block question AND answer binds to a Textbox in both orientations', () => {
  const content = sampleContentFor(C.contentSchema);
  const last = content.blocks[content.blocks.length - 1];
  for (const orientation of ORIENTATIONS) {
    const canvas = cBuild(orientation, content);
    for (const b of content.blocks) {
      for (const field of ['question', 'answer']) {
        const bound = canvas.objects.filter(
          (o) => o.type === 'Textbox' && o.msgId === b.id && o.fieldRef === field);
        assert.ok(bound.length >= 1, `${orientation}: ${b.id}.${field} bound to a Textbox`);
        assert.ok(bound.every((t) => t.text === b[field]), `${orientation}: ${b.id}.${field} verbatim`);
        assert.ok(bound.every((t) => t.bgRef), `${orientation}: ${b.id}.${field} carries bgRef`);
        assert.ok(bound.every((t) => t.fontSize >= 38), `${orientation}: ${b.id}.${field} >= 38px floor`);
      }
    }
    // the pinned takeaway quotes the LAST block's answer — bound a SECOND time
    // (same text, same msgId+fieldRef 'answer'); this is allowed by design
    const lastAnswers = canvas.objects.filter(
      (o) => o.type === 'Textbox' && o.msgId === last.id && o.fieldRef === 'answer');
    assert.ok(lastAnswers.length >= 2, `${orientation}: last answer bound twice (thread + takeaway pin)`);
    assert.ok(lastAnswers.every((t) => t.text === last.answer), `${orientation}: both bindings verbatim`);

    // every msgId points back at a real block
    const blockIds = new Set(content.blocks.map((b) => b.id));
    for (const o of canvas.objects.filter((x) => x.msgId)) {
      assert.ok(blockIds.has(o.msgId), `${orientation}: msgId "${o.msgId}" points at a block`);
    }

    // headline/subheadline/cta present with readability floors
    const headline = canvas.objects.find((o) => o.layerRole === 'headline');
    assert.ok(headline && headline.type === 'Textbox', `${orientation}: headline Textbox`);
    assert.equal(headline.text, content.headline, `${orientation}: headline verbatim`);
    assert.ok(headline.fontSize >= 80, `${orientation}: headline >= 80px (got ${headline.fontSize})`);
    assert.ok(canvas.objects.some((o) => o.layerRole === 'subheadline'), `${orientation}: subheadline placed`);
    const cta = canvas.objects.find((o) => o.layerRole === 'cta');
    assert.ok(cta && cta.type === 'Textbox', `${orientation}: cta placed`);
    assert.equal(cta.text, content.callToAction, `${orientation}: cta verbatim`);
    assert.ok(cta.fontSize >= 30, `${orientation}: cta legible`);
  }
});

test('chat-deepdive: ZERO image slots in both orientations', () => {
  const content = sampleContentFor(C.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = cBuild(orientation, content);
    const slots = canvas.objects.filter(
      (o) => (o.layerRole === 'image-slot' || o.slotId || o.slotSpec) && o.slotId !== 'bg');
    assert.equal(slots.length, 0, `${orientation}: no image-slot objects`);
  }
});

test('chat-deepdive: all decor opacity <= 0.2 in both orientations', () => {
  const content = sampleContentFor(C.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = cBuild(orientation, content);
    let translucent = 0;
    for (const o of canvas.objects.filter((x) => ['decor', 'background'].includes(x.layerRole))) {
      if (typeof o.opacity === 'number') {
        assert.ok(o.opacity > 0 && o.opacity <= 0.2,
          `${orientation}: ${o.type} decor opacity ${o.opacity} in (0, 0.2]`);
        translucent += 1;
      }
    }
    assert.ok(translucent >= 2, `${orientation}: atmosphere decor present`);
  }
});

test('chat-deepdive: no Textbox carries a nonzero angle (pptx export contract)', () => {
  const content = sampleContentFor(C.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = cBuild(orientation, content);
    for (const o of canvas.objects.filter((x) => x.type === 'Textbox')) {
      assert.ok(!o.angle, `${orientation}: Textbox "${String(o.text).slice(0, 20)}" is axis-aligned (angle=${o.angle})`);
    }
  }
});

test('chat-deepdive: min and max block counts build clean with every field bound', () => {
  const cs = C.contentSchema;
  const base = sampleContentFor(cs);
  for (const count of [cs.blocks.min, cs.blocks.max]) {
    const blocks = [];
    for (let i = 0; i < count; i++) blocks.push({ ...base.blocks[i % base.blocks.length], id: `blk-${i + 1}` });
    const content = { ...base, subheadline: count === cs.blocks.min ? null : base.subheadline, blocks };
    for (const orientation of ORIENTATIONS) {
      const canvas = cBuild(orientation, content);
      for (const b of blocks) {
        for (const field of cs.blocks.fields) {
          assert.ok(
            canvas.objects.some((o) => o.type === 'Textbox' && o.msgId === b.id && o.fieldRef === field),
            `${orientation}: ${b.id}.${field} bound at ${count} blocks`);
        }
      }
      JSON.parse(JSON.stringify(canvas));
    }
  }
});

test('chat-deepdive: previews render SVG for both orientations', () => {
  for (const orientation of ORIENTATIONS) {
    const svg = C.preview[orientation](DEFAULT_PALETTE);
    assert.ok(typeof svg === 'string' && svg.includes('<svg'), `${orientation}: contains <svg`);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${orientation}: svg markup`);
    assert.ok(svg.includes(PREVIEW_VIEWBOX[orientation]), `${orientation}: orientation-true viewBox`);
    assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${orientation}: no broken values`);
  }
});

test('chat-deepdive: builds and previews consume an overridden brand palette', () => {
  const { palette } = applyBrandOverride({ primary: '#1D4ED8', accent: '#DC2626', background: '#FFFFFF' });
  for (const orientation of ORIENTATIONS) {
    const canvas = cBuild(orientation, sampleContentFor(C.contentSchema), palette);
    assert.ok(JSON.stringify(canvas).includes('#1D4ED8'), `${orientation}: build consumes the palette`);
    const svg = C.preview[orientation](palette);
    assert.ok(svg.includes('#1D4ED8') || svg.includes('#DC2626') || svg.includes('#FFFFFF'),
      `${orientation}: preview reflects override`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// comic-saga (style: comic) — a graphic-novel spread, richer than comic-strip/
// comic-reveal. A large establishing panel (full-width image slot + heading +
// caption BAR beneath) sits over a grid of smaller action panels, each with an
// image slot, a bold heading, and a caption bar UNDER the panel. Blocks are 4–5
// {heading, text}: the FIRST 4 map to the 4 honest image slots (slot-1..slot-4);
// an optional 5th block is a text-only closing panel (no slot). Landscape is a
// REAL relayout — a cinematic filmstrip (establishing panel left half, action
// panels right-side grid). Decor = halftone dot grids + wash + an accent burst
// polygon behind the finale. All template text stays axis-aligned (no angle —
// the pptx export contract forbids rotated template text).
// ═══════════════════════════════════════════════════════════════════════════

const S = comicSaga;
const sBuild = (orientation, content, palette = DEFAULT_PALETTE, fonts = DEFAULT_FONTS) =>
  S.build[orientation](structuredClone(content), palette, fonts);

// a full 5-block variant (exercises the text-only closing panel + all 4 slots)
function sagaContent(count) {
  const base = sampleContentFor(S.contentSchema);
  const blocks = [];
  for (let i = 0; i < count; i++) blocks.push({ ...base.blocks[i % base.blocks.length], id: `blk-${i + 1}` });
  return { ...base, blocks };
}

test('comic-saga: manifest passes validateManifest with zero problems', () => {
  assert.deepEqual(validateManifest(S), [], 'manifest valid');
  assert.equal(S.id, 'comic-saga');
  assert.equal(S.style, 'comic');
  assert.equal(S.contentSchema.blocks.kind, 'panels');
  assert.deepEqual(S.contentSchema.blocks.fields, ['heading', 'text']);
  assert.equal(S.contentSchema.blocks.min, 4);
  assert.equal(S.contentSchema.blocks.max, 5);
});

test('comic-saga: builds valid fabric-v6 JSON at locked dims in both orientations', () => {
  for (const count of [4, 5]) {
    const content = sagaContent(count);
    for (const orientation of ORIENTATIONS) {
      const canvas = sBuild(orientation, content);
      assert.equal(canvas.width, DIMS[orientation].w, `${orientation}: width`);
      assert.equal(canvas.height, DIMS[orientation].h, `${orientation}: height`);
      assert.ok(typeof canvas.background === 'string' && canvas.background, `${orientation}: background`);
      assert.ok(Array.isArray(canvas.objects) && canvas.objects.length > 5, `${orientation}: objects`);

      const round = JSON.parse(JSON.stringify(canvas));
      assert.equal(round.objects.length, canvas.objects.length, `${orientation}: JSON round-trip`);

      for (const o of canvas.objects) {
        assert.ok(KNOWN_V6_TYPES.has(o.type), `${orientation}: whitelisted fabric v6 type (got "${o.type}")`);
        assert.ok(typeof o.layerRole === 'string' && o.layerRole, `${orientation}: layerRole on every object`);
        assertFiniteNumbers(o, `${orientation}/${o.type}`);
      }

      for (const o of canvas.objects.filter((x) => TEXT_ROLES.has(x.layerRole) || x.layerRole === 'image-slot')) {
        assert.ok(o.left >= 0 && o.top >= 0, `${orientation}: ${o.layerRole} inside canvas`);
        assert.ok(o.left + (o.width || 0) <= DIMS[orientation].w, `${orientation}: ${o.layerRole} right edge inside`);
        assert.ok(o.top <= DIMS[orientation].h, `${orientation}: ${o.layerRole} top inside`);
      }
    }
  }
});

test('comic-saga: every block heading AND text binds to a Textbox in both orientations', () => {
  for (const count of [4, 5]) {
    const content = sagaContent(count);
    for (const orientation of ORIENTATIONS) {
      const canvas = sBuild(orientation, content);
      for (const b of content.blocks) {
        for (const field of ['heading', 'text']) {
          const bound = canvas.objects.find(
            (o) => o.type === 'Textbox' && o.msgId === b.id && o.fieldRef === field);
          assert.ok(bound, `${orientation}@${count}: ${b.id}.${field} bound to a Textbox`);
          assert.equal(bound.text, b[field], `${orientation}@${count}: ${b.id}.${field} verbatim`);
          assert.ok(bound.bgRef, `${orientation}@${count}: ${b.id}.${field} carries bgRef`);
          assert.ok(bound.fontSize >= 38, `${orientation}@${count}: ${b.id}.${field} >= 38px floor`);
        }
      }
      // every msgId points back at a real block
      const blockIds = new Set(content.blocks.map((b) => b.id));
      for (const o of canvas.objects.filter((x) => x.msgId)) {
        assert.ok(blockIds.has(o.msgId), `${orientation}@${count}: msgId "${o.msgId}" points at a block`);
      }
      // headline/subheadline/cta present with readability floors
      const headline = canvas.objects.find((o) => o.layerRole === 'headline');
      assert.ok(headline && headline.type === 'Textbox', `${orientation}@${count}: headline Textbox`);
      assert.equal(headline.text, content.headline, `${orientation}@${count}: headline verbatim`);
      assert.ok(headline.fontSize >= 80, `${orientation}@${count}: headline >= 80px (got ${headline.fontSize})`);
      assert.ok(canvas.objects.some((o) => o.layerRole === 'subheadline'), `${orientation}@${count}: subheadline placed`);
      const cta = canvas.objects.find((o) => o.layerRole === 'cta');
      assert.ok(cta && cta.type === 'Textbox', `${orientation}@${count}: cta placed`);
      assert.equal(cta.text, content.callToAction, `${orientation}@${count}: cta verbatim`);
      assert.ok(cta.fontSize >= 30, `${orientation}@${count}: cta legible`);
    }
  }
});

test('comic-saga: exactly 4 honest dashed image slots (distinct ids) in both orientations', () => {
  // 4 slots at 4 blocks AND at 5 blocks (the 5th block is text-only, no slot)
  for (const count of [4, 5]) {
    const content = sagaContent(count);
    for (const orientation of ORIENTATIONS) {
      const canvas = sBuild(orientation, content);
      const slots = canvas.objects.filter((o) => o.layerRole === 'image-slot' && o.slotId !== 'bg');
      assert.equal(slots.length, 4, `${orientation}@${count}: exactly four image slots`);
      const ids = new Set();
      for (const s of slots) {
        assert.equal(s.fill, 'transparent', `${orientation}@${count}: empty frame, not a fake image`);
        assert.ok(Array.isArray(s.strokeDashArray), `${orientation}@${count}: dashed frame`);
        assert.ok(s.slotSpec?.slotId && s.slotSpec?.styleHint, `${orientation}@${count}: slot spec present`);
        assert.equal(s.slotId, s.slotSpec.slotId, `${orientation}@${count}: slotId consistent`);
        ids.add(s.slotId);
      }
      assert.equal(ids.size, 4, `${orientation}@${count}: distinct slot ids`);
      assert.deepEqual([...ids].sort(), ['slot-1', 'slot-2', 'slot-3', 'slot-4'], `${orientation}@${count}: slot-1..slot-4`);
    }
  }
});

test('comic-saga: all decor opacity <= 0.2 in both orientations (burst + halftone)', () => {
  const content = sagaContent(5);
  for (const orientation of ORIENTATIONS) {
    const canvas = sBuild(orientation, content);
    let translucent = 0;
    for (const o of canvas.objects.filter((x) => ['decor', 'background'].includes(x.layerRole))) {
      if (typeof o.opacity === 'number') {
        assert.ok(o.opacity > 0 && o.opacity <= 0.2,
          `${orientation}: ${o.type} decor opacity ${o.opacity} in (0, 0.2]`);
        translucent += 1;
      }
    }
    assert.ok(translucent >= 2, `${orientation}: atmosphere decor present`);
    // the accent burst is a translucent decor Polygon behind the finale
    assert.ok(
      canvas.objects.some((o) => o.type === 'Polygon' && o.layerRole === 'decor'),
      `${orientation}: accent burst polygon present`);
  }
});

test('comic-saga: no Textbox carries a nonzero angle (pptx export contract)', () => {
  const content = sagaContent(5);
  for (const orientation of ORIENTATIONS) {
    const canvas = sBuild(orientation, content);
    for (const o of canvas.objects.filter((x) => x.type === 'Textbox')) {
      assert.ok(!o.angle, `${orientation}: Textbox "${String(o.text).slice(0, 20)}" is axis-aligned (angle=${o.angle})`);
    }
  }
});

test('comic-saga: previews render SVG for both orientations', () => {
  for (const orientation of ORIENTATIONS) {
    const svg = S.preview[orientation](DEFAULT_PALETTE);
    assert.ok(typeof svg === 'string' && svg.includes('<svg'), `${orientation}: contains <svg`);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${orientation}: svg markup`);
    assert.ok(svg.includes(PREVIEW_VIEWBOX[orientation]), `${orientation}: orientation-true viewBox`);
    assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${orientation}: no broken values`);
  }
});

test('comic-saga: builds and previews consume an overridden brand palette', () => {
  const { palette } = applyBrandOverride({ primary: '#1D4ED8', accent: '#DC2626', background: '#FFFFFF' });
  for (const orientation of ORIENTATIONS) {
    const canvas = sBuild(orientation, sagaContent(5), palette);
    assert.ok(JSON.stringify(canvas).includes('#1D4ED8'), `${orientation}: build consumes the palette`);
    const svg = S.preview[orientation](palette);
    assert.ok(svg.includes('#1D4ED8') || svg.includes('#DC2626') || svg.includes('#FFFFFF'),
      `${orientation}: preview reflects override`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// stats-horizon (style: stats) — a data-horizon wall. A single hairline
// horizon line runs across the canvas; each stat's giant FIGURE stands above
// the line with its caption below, while an accent COLUMN of index-varied
// height rises behind the figure like a bar chart. The hero (first) figure is
// enlarged and lit (soft glow + light-beams sweep). ONE honest dashed image
// slot sits in a corner as a background vignette. Landscape is a REAL relayout
// — the horizon runs the full 2000px width with figures spread along it and the
// hero enlarged. Figures are short and sized explicitly (120–260px, never
// word-wrapped). All template text stays axis-aligned (pptx export contract).
// ═══════════════════════════════════════════════════════════════════════════

const HZ = statsHorizon;
const hzBuild = (orientation, content, palette = DEFAULT_PALETTE, fonts = DEFAULT_FONTS) =>
  HZ.build[orientation](structuredClone(content), palette, fonts);

// exercise both the min (4) and max (5) block counts
function horizonContent(count) {
  const base = sampleContentFor(HZ.contentSchema);
  const blocks = [];
  for (let i = 0; i < count; i++) blocks.push({ ...base.blocks[i % base.blocks.length], id: `blk-${i + 1}` });
  return { ...base, blocks };
}

test('stats-horizon: manifest passes validateManifest with zero problems', () => {
  assert.deepEqual(validateManifest(HZ), [], 'manifest valid');
  assert.equal(HZ.id, 'stats-horizon');
  assert.equal(HZ.style, 'stats');
  assert.equal(HZ.contentSchema.blocks.kind, 'stats');
  assert.deepEqual(HZ.contentSchema.blocks.fields, ['figure', 'caption']);
  assert.equal(HZ.contentSchema.blocks.min, 4);
  assert.equal(HZ.contentSchema.blocks.max, 5);
  assert.equal(HZ.contentSchema.imageSlots, 1);
});

test('stats-horizon: builds valid fabric-v6 JSON at locked dims in both orientations', () => {
  for (const count of [4, 5]) {
    const content = horizonContent(count);
    for (const orientation of ORIENTATIONS) {
      const canvas = hzBuild(orientation, content);
      assert.equal(canvas.width, DIMS[orientation].w, `${orientation}: width`);
      assert.equal(canvas.height, DIMS[orientation].h, `${orientation}: height`);
      assert.ok(typeof canvas.background === 'string' && canvas.background, `${orientation}: background`);
      assert.ok(Array.isArray(canvas.objects) && canvas.objects.length > 5, `${orientation}: objects`);

      const round = JSON.parse(JSON.stringify(canvas));
      assert.equal(round.objects.length, canvas.objects.length, `${orientation}: JSON round-trip`);

      for (const o of canvas.objects) {
        assert.ok(KNOWN_V6_TYPES.has(o.type), `${orientation}: whitelisted fabric v6 type (got "${o.type}")`);
        assert.ok(typeof o.layerRole === 'string' && o.layerRole, `${orientation}: layerRole on every object`);
        assertFiniteNumbers(o, `${orientation}/${o.type}`);
      }

      for (const o of canvas.objects.filter((x) => TEXT_ROLES.has(x.layerRole) || x.layerRole === 'image-slot')) {
        assert.ok(o.left >= 0 && o.top >= 0, `${orientation}: ${o.layerRole} inside canvas`);
        assert.ok(o.left + (o.width || 0) <= DIMS[orientation].w, `${orientation}: ${o.layerRole} right edge inside`);
        assert.ok(o.top <= DIMS[orientation].h, `${orientation}: ${o.layerRole} top inside`);
      }
    }
  }
});

test('stats-horizon: every block figure AND caption binds to a Textbox in both orientations', () => {
  for (const count of [4, 5]) {
    const content = horizonContent(count);
    for (const orientation of ORIENTATIONS) {
      const canvas = hzBuild(orientation, content);
      for (const b of content.blocks) {
        for (const field of ['figure', 'caption']) {
          const bound = canvas.objects.find(
            (o) => o.type === 'Textbox' && o.msgId === b.id && o.fieldRef === field);
          assert.ok(bound, `${orientation}@${count}: ${b.id}.${field} bound to a Textbox`);
          assert.equal(bound.text, b[field], `${orientation}@${count}: ${b.id}.${field} verbatim`);
          assert.ok(bound.bgRef, `${orientation}@${count}: ${b.id}.${field} carries bgRef`);
          assert.ok(bound.fontSize >= 38, `${orientation}@${count}: ${b.id}.${field} >= 38px floor`);
        }
      }
      // figures are sized large and explicit (short strings, not word-wrapped)
      const figures = canvas.objects.filter((o) => o.type === 'Textbox' && o.fieldRef === 'figure');
      assert.ok(figures.every((f) => f.fontSize >= 120), `${orientation}@${count}: figures sized >= 120px`);

      // every msgId points back at a real block
      const blockIds = new Set(content.blocks.map((b) => b.id));
      for (const o of canvas.objects.filter((x) => x.msgId)) {
        assert.ok(blockIds.has(o.msgId), `${orientation}@${count}: msgId "${o.msgId}" points at a block`);
      }

      // headline/subheadline/cta present with readability floors
      const headline = canvas.objects.find((o) => o.layerRole === 'headline');
      assert.ok(headline && headline.type === 'Textbox', `${orientation}@${count}: headline Textbox`);
      assert.equal(headline.text, content.headline, `${orientation}@${count}: headline verbatim`);
      assert.ok(headline.fontSize >= 80, `${orientation}@${count}: headline >= 80px (got ${headline.fontSize})`);
      assert.ok(canvas.objects.some((o) => o.layerRole === 'subheadline'), `${orientation}@${count}: subheadline placed`);
      const cta = canvas.objects.find((o) => o.layerRole === 'cta');
      assert.ok(cta && cta.type === 'Textbox', `${orientation}@${count}: cta placed`);
      assert.equal(cta.text, content.callToAction, `${orientation}@${count}: cta verbatim`);
      assert.ok(cta.fontSize >= 30, `${orientation}@${count}: cta legible`);
    }
  }
});

test('stats-horizon: exactly one honest dashed image slot in both orientations', () => {
  for (const count of [4, 5]) {
    const content = horizonContent(count);
    for (const orientation of ORIENTATIONS) {
      const canvas = hzBuild(orientation, content);
      const slots = canvas.objects.filter((o) => o.layerRole === 'image-slot' && o.slotId !== 'bg');
      assert.equal(slots.length, 1, `${orientation}@${count}: exactly one image slot`);
      const s = slots[0];
      assert.equal(s.fill, 'transparent', `${orientation}@${count}: empty frame, not a fake image`);
      assert.ok(Array.isArray(s.strokeDashArray), `${orientation}@${count}: dashed frame`);
      assert.ok(s.slotSpec?.slotId && s.slotSpec?.styleHint, `${orientation}@${count}: slot spec present`);
      assert.equal(s.slotId, s.slotSpec.slotId, `${orientation}@${count}: slotId consistent`);
    }
  }
});

test('stats-horizon: all decor opacity <= 0.2 in both orientations (horizon + columns + glow)', () => {
  const content = horizonContent(5);
  for (const orientation of ORIENTATIONS) {
    const canvas = hzBuild(orientation, content);
    let translucent = 0;
    for (const o of canvas.objects.filter((x) => ['decor', 'background'].includes(x.layerRole))) {
      if (typeof o.opacity === 'number') {
        assert.ok(o.opacity > 0 && o.opacity <= 0.2,
          `${orientation}: ${o.type} decor opacity ${o.opacity} in (0, 0.2]`);
        translucent += 1;
      }
    }
    assert.ok(translucent >= 2, `${orientation}: atmosphere decor present`);
    // the horizon line: an opaque decor Rect spanning the full canvas width
    assert.ok(
      canvas.objects.some((o) => o.type === 'Rect' && o.layerRole === 'decor' && o.width === DIMS[orientation].w),
      `${orientation}: full-width horizon line present`);
  }
});

test('stats-horizon: no Textbox carries a nonzero angle (pptx export contract)', () => {
  const content = horizonContent(5);
  for (const orientation of ORIENTATIONS) {
    const canvas = hzBuild(orientation, content);
    for (const o of canvas.objects.filter((x) => x.type === 'Textbox')) {
      assert.ok(!o.angle, `${orientation}: Textbox "${String(o.text).slice(0, 20)}" is axis-aligned (angle=${o.angle})`);
    }
  }
});

test('stats-horizon: min and max block counts build clean with every field bound', () => {
  const cs = HZ.contentSchema;
  const base = sampleContentFor(cs);
  for (const count of [cs.blocks.min, cs.blocks.max]) {
    const blocks = [];
    for (let i = 0; i < count; i++) blocks.push({ ...base.blocks[i % base.blocks.length], id: `blk-${i + 1}` });
    const content = { ...base, subheadline: count === cs.blocks.min ? null : base.subheadline, blocks };
    for (const orientation of ORIENTATIONS) {
      const canvas = hzBuild(orientation, content);
      for (const b of blocks) {
        for (const field of cs.blocks.fields) {
          assert.ok(
            canvas.objects.some((o) => o.type === 'Textbox' && o.msgId === b.id && o.fieldRef === field),
            `${orientation}: ${b.id}.${field} bound at ${count} blocks`);
        }
      }
      JSON.parse(JSON.stringify(canvas));
    }
  }
});

test('stats-horizon: previews render SVG for both orientations', () => {
  for (const orientation of ORIENTATIONS) {
    const svg = HZ.preview[orientation](DEFAULT_PALETTE);
    assert.ok(typeof svg === 'string' && svg.includes('<svg'), `${orientation}: contains <svg`);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${orientation}: svg markup`);
    assert.ok(svg.includes(PREVIEW_VIEWBOX[orientation]), `${orientation}: orientation-true viewBox`);
    assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${orientation}: no broken values`);
  }
});

test('stats-horizon: builds and previews consume an overridden brand palette', () => {
  const { palette } = applyBrandOverride({ primary: '#1D4ED8', accent: '#DC2626', background: '#FFFFFF' });
  for (const orientation of ORIENTATIONS) {
    const canvas = hzBuild(orientation, horizonContent(5), palette);
    assert.ok(JSON.stringify(canvas).includes('#1D4ED8'), `${orientation}: build consumes the palette`);
    const svg = HZ.preview[orientation](palette);
    assert.ok(svg.includes('#1D4ED8') || svg.includes('#DC2626') || svg.includes('#FFFFFF'),
      `${orientation}: preview reflects override`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// layered-briefing (style: infographic) — an intelligence-briefing dossier.
// Each sequence block is a translucent folder-tab layer card (label chip +
// one-line brief) under a classification-style header band (the headline). In
// portrait the tabs STACK diagonally down-right, tinted at stepped depths with
// cornerFrame accents + a fingerprintArcs ghost; in landscape they FAN
// horizontally left→right (a REAL relayout). One honest dashed image slot rides
// a rounded photo zone on the top tab. All template text stays axis-aligned
// (no angle — the pptx export contract forbids rotated template text).
// ═══════════════════════════════════════════════════════════════════════════

const LB = layeredBriefing;
const lbBuild = (orientation, content, palette = DEFAULT_PALETTE, fonts = DEFAULT_FONTS) =>
  LB.build[orientation](structuredClone(content), palette, fonts);

// exercise both the min (3) and max (4) block counts
function briefingContent(count) {
  const base = sampleContentFor(LB.contentSchema);
  const blocks = [];
  for (let i = 0; i < count; i++) blocks.push({ ...base.blocks[i % base.blocks.length], id: `blk-${i + 1}` });
  return { ...base, blocks };
}

test('layered-briefing: manifest passes validateManifest with zero problems', () => {
  assert.deepEqual(validateManifest(LB), [], 'manifest valid');
  assert.equal(LB.id, 'layered-briefing');
  assert.equal(LB.style, 'infographic');
  assert.equal(LB.contentSchema.blocks.kind, 'sequence');
  assert.deepEqual(LB.contentSchema.blocks.fields, ['label', 'text']);
  assert.equal(LB.contentSchema.blocks.min, 3);
  assert.equal(LB.contentSchema.blocks.max, 4);
  assert.equal(LB.contentSchema.imageSlots, 1);
});

test('layered-briefing: builds valid fabric-v6 JSON at locked dims in both orientations', () => {
  for (const count of [3, 4]) {
    const content = briefingContent(count);
    for (const orientation of ORIENTATIONS) {
      const canvas = lbBuild(orientation, content);
      assert.equal(canvas.width, DIMS[orientation].w, `${orientation}: width`);
      assert.equal(canvas.height, DIMS[orientation].h, `${orientation}: height`);
      assert.ok(typeof canvas.background === 'string' && canvas.background, `${orientation}: background`);
      assert.ok(Array.isArray(canvas.objects) && canvas.objects.length > 5, `${orientation}: objects`);

      const round = JSON.parse(JSON.stringify(canvas));
      assert.equal(round.objects.length, canvas.objects.length, `${orientation}: JSON round-trip`);

      for (const o of canvas.objects) {
        assert.ok(KNOWN_V6_TYPES.has(o.type), `${orientation}: whitelisted fabric v6 type (got "${o.type}")`);
        assert.ok(typeof o.layerRole === 'string' && o.layerRole, `${orientation}: layerRole on every object`);
        assertFiniteNumbers(o, `${orientation}/${o.type}`);
      }

      for (const o of canvas.objects.filter((x) => TEXT_ROLES.has(x.layerRole) || x.layerRole === 'image-slot')) {
        assert.ok(o.left >= 0 && o.top >= 0, `${orientation}: ${o.layerRole} inside canvas`);
        assert.ok(o.left + (o.width || 0) <= DIMS[orientation].w, `${orientation}: ${o.layerRole} right edge inside`);
        assert.ok(o.top <= DIMS[orientation].h, `${orientation}: ${o.layerRole} top inside`);
      }
    }
  }
});

test('layered-briefing: every block label AND text binds to a Textbox in both orientations', () => {
  for (const count of [3, 4]) {
    const content = briefingContent(count);
    for (const orientation of ORIENTATIONS) {
      const canvas = lbBuild(orientation, content);
      for (const b of content.blocks) {
        for (const field of ['label', 'text']) {
          const bound = canvas.objects.find(
            (o) => o.type === 'Textbox' && o.msgId === b.id && o.fieldRef === field);
          assert.ok(bound, `${orientation}@${count}: ${b.id}.${field} bound to a Textbox`);
          // labels render uppercase — compare case-insensitively
          assert.equal(
            String(bound.text).toUpperCase(), String(b[field]).toUpperCase(),
            `${orientation}@${count}: ${b.id}.${field} verbatim`);
          assert.ok(bound.bgRef, `${orientation}@${count}: ${b.id}.${field} carries bgRef`);
          assert.ok(bound.fontSize >= 38 || field === 'label', `${orientation}@${count}: ${b.id}.text >= 38px floor`);
        }
      }
      // every msgId points back at a real block
      const blockIds = new Set(content.blocks.map((b) => b.id));
      for (const o of canvas.objects.filter((x) => x.msgId)) {
        assert.ok(blockIds.has(o.msgId), `${orientation}@${count}: msgId "${o.msgId}" points at a block`);
      }
      // headline (in the classification band) / subheadline / cta with floors
      const headline = canvas.objects.find((o) => o.layerRole === 'headline');
      assert.ok(headline && headline.type === 'Textbox', `${orientation}@${count}: headline Textbox`);
      assert.equal(headline.text, content.headline, `${orientation}@${count}: headline verbatim`);
      assert.ok(headline.fontSize >= 80, `${orientation}@${count}: headline >= 80px (got ${headline.fontSize})`);
      assert.ok(canvas.objects.some((o) => o.layerRole === 'subheadline'), `${orientation}@${count}: subheadline placed`);
      const cta = canvas.objects.find((o) => o.layerRole === 'cta');
      assert.ok(cta && cta.type === 'Textbox', `${orientation}@${count}: cta placed`);
      assert.equal(cta.text, content.callToAction, `${orientation}@${count}: cta verbatim`);
      assert.ok(cta.fontSize >= 30, `${orientation}@${count}: cta legible`);
    }
  }
});

test('layered-briefing: exactly one honest dashed image slot in both orientations', () => {
  for (const count of [3, 4]) {
    const content = briefingContent(count);
    for (const orientation of ORIENTATIONS) {
      const canvas = lbBuild(orientation, content);
      const slots = canvas.objects.filter((o) => o.layerRole === 'image-slot' && o.slotId !== 'bg');
      assert.equal(slots.length, 1, `${orientation}@${count}: exactly one image slot`);
      const s = slots[0];
      assert.equal(s.fill, 'transparent', `${orientation}@${count}: empty frame, not a fake image`);
      assert.ok(Array.isArray(s.strokeDashArray), `${orientation}@${count}: dashed frame`);
      assert.ok(s.slotSpec?.slotId && s.slotSpec?.styleHint, `${orientation}@${count}: slot spec present`);
      assert.equal(s.slotId, s.slotSpec.slotId, `${orientation}@${count}: slotId consistent`);
    }
  }
});

test('layered-briefing: all decor opacity <= 0.2 in both orientations (tabs + fingerprint + frames)', () => {
  const content = briefingContent(4);
  for (const orientation of ORIENTATIONS) {
    const canvas = lbBuild(orientation, content);
    let translucent = 0;
    for (const o of canvas.objects.filter((x) => ['decor', 'background'].includes(x.layerRole))) {
      if (typeof o.opacity === 'number') {
        assert.ok(o.opacity > 0 && o.opacity <= 0.2,
          `${orientation}: ${o.type} decor opacity ${o.opacity} in (0, 0.2]`);
        translucent += 1;
      }
    }
    assert.ok(translucent >= 2, `${orientation}: atmosphere decor present`);
  }
});

test('layered-briefing: no Textbox carries a nonzero angle (pptx export contract)', () => {
  const content = briefingContent(4);
  for (const orientation of ORIENTATIONS) {
    const canvas = lbBuild(orientation, content);
    for (const o of canvas.objects.filter((x) => x.type === 'Textbox')) {
      assert.ok(!o.angle, `${orientation}: Textbox "${String(o.text).slice(0, 20)}" is axis-aligned (angle=${o.angle})`);
    }
  }
});

test('layered-briefing: min and max block counts build clean with every field bound', () => {
  const cs = LB.contentSchema;
  const base = sampleContentFor(cs);
  for (const count of [cs.blocks.min, cs.blocks.max]) {
    const blocks = [];
    for (let i = 0; i < count; i++) blocks.push({ ...base.blocks[i % base.blocks.length], id: `blk-${i + 1}` });
    const content = { ...base, subheadline: count === cs.blocks.min ? null : base.subheadline, blocks };
    for (const orientation of ORIENTATIONS) {
      const canvas = lbBuild(orientation, content);
      for (const b of blocks) {
        for (const field of cs.blocks.fields) {
          assert.ok(
            canvas.objects.some((o) => o.type === 'Textbox' && o.msgId === b.id && o.fieldRef === field),
            `${orientation}: ${b.id}.${field} bound at ${count} blocks`);
        }
      }
      JSON.parse(JSON.stringify(canvas));
    }
  }
});

test('layered-briefing: previews render SVG for both orientations', () => {
  for (const orientation of ORIENTATIONS) {
    const svg = LB.preview[orientation](DEFAULT_PALETTE);
    assert.ok(typeof svg === 'string' && svg.includes('<svg'), `${orientation}: contains <svg`);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${orientation}: svg markup`);
    assert.ok(svg.includes(PREVIEW_VIEWBOX[orientation]), `${orientation}: orientation-true viewBox`);
    assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${orientation}: no broken values`);
  }
});

test('layered-briefing: builds and previews consume an overridden brand palette', () => {
  const { palette } = applyBrandOverride({ primary: '#1D4ED8', accent: '#DC2626', background: '#FFFFFF' });
  for (const orientation of ORIENTATIONS) {
    const canvas = lbBuild(orientation, briefingContent(4), palette);
    assert.ok(JSON.stringify(canvas).includes('#1D4ED8'), `${orientation}: build consumes the palette`);
    const svg = LB.preview[orientation](palette);
    assert.ok(svg.includes('#1D4ED8') || svg.includes('#DC2626') || svg.includes('#FFFFFF'),
      `${orientation}: preview reflects override`);
  }
});
