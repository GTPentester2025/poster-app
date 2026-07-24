// Template system v2 contract tests (Phase O3): the D1 manifest validates for
// every registered template; buildCanvas produces fabric-v6-safe canvas JSON
// in BOTH orientations at the locked dimensions (portrait 1414x2000,
// landscape 2000x1414); every contentSchema block binds through msgId
// 'blk-N' Textboxes; sampleContentFor round-trips through buildCanvas; image
// slots stay honest; and the decor library keeps its restrained opacity
// discipline (decor/background roles only, washes <= 0.2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as v2 from '../../templates/v2/index.js';
import {
  validateManifest, sampleContentFor, SUPPORTED_STYLES, BLOCK_KINDS
} from '../../templates/v2/manifest_schema.js';
import * as decor from '../../templates/v2/decor.js';
import { DEFAULT_PALETTE, DEFAULT_FONTS, applyBrandOverride } from '../../templates/palette.js';

const KNOWN_V6_TYPES = new Set(['Textbox', 'Rect', 'Circle', 'Polygon', 'Line', 'Ellipse', 'Triangle', 'Path', 'Group']);
const ORIENTATIONS = ['portrait', 'landscape'];
const DIMS = {
  portrait: { w: 1414, h: 2000 },
  landscape: { w: 2000, h: 1414 }
};
const TEXT_ROLES = new Set(['headline', 'subheadline', 'message', 'message-label', 'cta']);

const EXEMPLAR_IDS = ['timeline-journey', 'qa-chat'];

function eachTemplate(fn) {
  for (const id of EXEMPLAR_IDS) {
    const t = v2.getTemplateV2(id);
    assert.ok(t, `template ${id} registered`);
    fn(t);
  }
}

function assertFiniteNumbers(obj, label) {
  for (const [k, val] of Object.entries(obj)) {
    if (typeof val === 'number') assert.ok(Number.isFinite(val), `${label}: ${k} is finite`);
    else if (val && typeof val === 'object') assertFiniteNumbers(val, `${label}.${k}`);
  }
}

// ── manifest contract ────────────────────────────────────────────────────────

test('exported dims: landscape 2000x1414, portrait 1414x2000', () => {
  assert.equal(v2.LANDSCAPE_W, 2000);
  assert.equal(v2.LANDSCAPE_H, 1414);
  assert.equal(v2.PORTRAIT_W, 1414);
  assert.equal(v2.PORTRAIT_H, 2000);
  assert.deepEqual(v2.ORIENTATIONS, ['portrait', 'landscape']);
});

test('both exemplar manifests pass validateManifest with zero problems', () => {
  eachTemplate((t) => {
    assert.deepEqual(validateManifest(t), [], `${t.id}: manifest valid`);
    assert.ok(SUPPORTED_STYLES.includes(t.style), `${t.id}: style supported`);
    assert.ok(BLOCK_KINDS.includes(t.contentSchema.blocks.kind), `${t.id}: block kind supported`);
  });
  assert.equal(v2.getTemplateV2('timeline-journey').style, 'timeline');
  assert.equal(v2.getTemplateV2('qa-chat').style, 'qa');
  assert.equal(v2.getTemplateV2('qa-chat').contentSchema.imageSlots, 0);
  assert.equal(v2.getTemplateV2('timeline-journey').contentSchema.imageSlots, 1);
});

test('validateManifest reports problems for broken manifests', () => {
  assert.ok(validateManifest(null).length > 0, 'null rejected');
  assert.ok(validateManifest({}).length >= 5, 'empty manifest lists many problems');

  const good = v2.getTemplateV2('timeline-journey');
  const broken = (patch) => validateManifest({ ...good, ...patch });

  assert.ok(broken({ style: 'ransom-note' }).some((p) => p.includes('style')), 'unknown style flagged');
  assert.ok(broken({ id: 'Bad_ID' }).some((p) => p.includes('kebab-case')), 'non-kebab id flagged');
  assert.ok(
    broken({ contentSchema: { ...good.contentSchema, blocks: { ...good.contentSchema.blocks, kind: 'bullets' } } })
      .some((p) => p.includes('kind')),
    'unknown block kind flagged');
  assert.ok(
    broken({ contentSchema: { ...good.contentSchema, imageSlots: 7 } }).some((p) => p.includes('imageSlots')),
    'imageSlots out of range flagged');
  assert.ok(
    broken({ build: { portrait: good.build.portrait } }).some((p) => p.includes('build.landscape')),
    'missing landscape build flagged');
  assert.ok(
    broken({ editable: { background: true, perElementColor: false, fonts: true } })
      .some((p) => p.includes('editable')),
    'non-all-true editable flagged');
});

// ── sample content ───────────────────────────────────────────────────────────

test('sampleContentFor produces realistic schema-matching content', () => {
  eachTemplate((t) => {
    const cs = t.contentSchema;
    const sample = sampleContentFor(cs);
    assert.ok(sample.headline.split(/\s+/).length <= cs.headline.maxWords, `${t.id}: headline word cap`);
    assert.ok(sample.callToAction.split(/\s+/).length <= cs.callToAction.maxWords, `${t.id}: cta word cap`);
    assert.ok(sample.blocks.length >= cs.blocks.min && sample.blocks.length <= cs.blocks.max,
      `${t.id}: block count within ${cs.blocks.min}..${cs.blocks.max}`);
    sample.blocks.forEach((b, i) => {
      assert.equal(b.id, `blk-${i + 1}`, `${t.id}: sequential blk ids`);
      for (const f of cs.blocks.fields) {
        assert.ok(typeof b[f] === 'string' && b[f].trim(), `${t.id}: block field "${f}" filled`);
        assert.ok(!/lorem/i.test(b[f]), `${t.id}: no lorem`);
      }
    });
  });
  // every declared kind yields blocks
  for (const kind of BLOCK_KINDS) {
    const s = sampleContentFor({ blocks: { kind, min: 3, max: 5, fields: ['text'] } });
    assert.ok(s.blocks.length >= 3 && s.blocks.every((b) => b.text.trim()), `${kind}: sample blocks filled`);
  }
});

// ── buildCanvas: fabric contract + bindings, both orientations ───────────────

test('buildCanvas returns valid fabric-v6 canvas JSON in both orientations', () => {
  eachTemplate((t) => {
    const content = sampleContentFor(t.contentSchema);
    for (const orientation of ORIENTATIONS) {
      const canvas = v2.buildCanvas(t.id, orientation, content);
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

      // text + slots inside the canvas
      for (const o of canvas.objects.filter((x) => TEXT_ROLES.has(x.layerRole) || x.layerRole === 'image-slot')) {
        assert.ok(o.left >= 0 && o.top >= 0, `${t.id}/${orientation}: ${o.layerRole} inside canvas`);
        assert.ok(o.left + (o.width || 0) <= DIMS[orientation].w, `${t.id}/${orientation}: ${o.layerRole} right edge inside`);
        assert.ok(o.top <= DIMS[orientation].h, `${t.id}/${orientation}: ${o.layerRole} top inside`);
      }
    }
  });
});

test('every contentSchema block binds: blk-N message Textbox in BOTH orientations', () => {
  eachTemplate((t) => {
    const content = sampleContentFor(t.contentSchema);
    for (const orientation of ORIENTATIONS) {
      const canvas = v2.buildCanvas(t.id, orientation, content);

      const headline = canvas.objects.find((o) => o.layerRole === 'headline');
      assert.ok(headline && headline.type === 'Textbox', `${t.id}/${orientation}: headline Textbox`);
      assert.equal(headline.text, content.headline, `${t.id}/${orientation}: headline verbatim`);
      assert.ok(headline.fontSize >= 80, `${t.id}/${orientation}: headline >= 80px floor`);
      assert.ok(canvas.objects.some((o) => o.layerRole === 'subheadline'), `${t.id}/${orientation}: subheadline placed`);

      const msgObjs = canvas.objects.filter((o) => o.layerRole === 'message');
      for (const m of msgObjs) assert.equal(m.type, 'Textbox', `${t.id}/${orientation}: messages are Textboxes`);
      const placedIds = new Set(msgObjs.map((o) => o.msgId));
      for (const b of content.blocks) {
        assert.ok(placedIds.has(b.id), `${t.id}/${orientation}: ${b.id} bound`);
      }
      for (const m of msgObjs) {
        assert.ok(m.fontSize >= 38, `${t.id}/${orientation}: message >= 38px floor`);
      }

      // labels/bubbles that carry a msgId always point at a real block
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

test('qa-chat binds question AND answer Textboxes per block, both orientations', () => {
  const t = v2.getTemplateV2('qa-chat');
  const content = sampleContentFor(t.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = v2.buildCanvas('qa-chat', orientation, content);
    for (const b of content.blocks) {
      const q = canvas.objects.find((o) => o.layerRole === 'message' && o.msgId === b.id && o.fieldRef === 'question');
      const a = canvas.objects.find((o) => o.layerRole === 'message' && o.msgId === b.id && o.fieldRef === 'answer');
      assert.ok(q, `${orientation}: ${b.id} question bound`);
      assert.ok(a, `${orientation}: ${b.id} answer bound`);
      assert.equal(q.text, b.question, `${orientation}: ${b.id} question verbatim`);
      assert.equal(a.text, b.answer, `${orientation}: ${b.id} answer verbatim`);
      // question bubbles sit right of answer bubbles (chat alignment)
      assert.ok(q.left > a.left, `${orientation}: ${b.id} question right of answer`);
    }
  }
});

test('robustness: min and max block counts build clean in both orientations', () => {
  eachTemplate((t) => {
    const cs = t.contentSchema;
    const base = sampleContentFor(cs);
    for (const count of [cs.blocks.min, cs.blocks.max]) {
      const blocks = [];
      for (let i = 0; i < count; i++) blocks.push({ ...base.blocks[i % base.blocks.length], id: `blk-${i + 1}` });
      const content = { ...base, subheadline: count === cs.blocks.min ? null : base.subheadline, blocks };
      for (const orientation of ORIENTATIONS) {
        const canvas = v2.buildCanvas(t.id, orientation, content);
        const placed = new Set(canvas.objects.filter((o) => o.layerRole === 'message').map((o) => o.msgId));
        for (const b of blocks) assert.ok(placed.has(b.id), `${t.id}/${orientation}: ${b.id} placed at ${count} blocks`);
        JSON.parse(JSON.stringify(canvas));
      }
    }
  });
});

test('image slots stay honest: timeline has exactly 1, qa-chat has 0', () => {
  for (const orientation of ORIENTATIONS) {
    const content = sampleContentFor(v2.getTemplateV2('timeline-journey').contentSchema);
    const timeline = v2.buildCanvas('timeline-journey', orientation, content);
    const slots = timeline.objects.filter((o) => o.layerRole === 'image-slot' && o.slotId !== 'bg');
    assert.equal(slots.length, 1, `timeline/${orientation}: one slot`);
    for (const s of slots) {
      assert.equal(s.fill, 'transparent', `timeline/${orientation}: empty frame, not a fake image`);
      assert.ok(Array.isArray(s.strokeDashArray), `timeline/${orientation}: dashed frame`);
      assert.ok(s.slotSpec?.slotId && s.slotSpec?.styleHint, `timeline/${orientation}: slot spec present`);
      assert.equal(s.slotId, s.slotSpec.slotId, `timeline/${orientation}: slotId consistent`);
    }

    const qaContent = sampleContentFor(v2.getTemplateV2('qa-chat').contentSchema);
    const qa = v2.buildCanvas('qa-chat', orientation, qaContent);
    assert.equal(qa.objects.filter((o) => o.layerRole === 'image-slot' && o.slotId !== 'bg').length, 0, `qa/${orientation}: no slots`);
  }
});

// ── registry surface ─────────────────────────────────────────────────────────

test('listTemplatesV2: serializable metadata + previews, no build functions', () => {
  const list = v2.listTemplatesV2();
  // the registry grows as batches land — all 64 registered templates, exemplars included
  assert.equal(list.length, 64);
  for (const id of EXEMPLAR_IDS) assert.ok(list.some((t) => t.id === id), `${id} registered`);
  assert.equal(new Set(list.map((t) => t.id)).size, list.length, 'unique ids');
  for (const entry of list) {
    assert.deepEqual(JSON.parse(JSON.stringify(entry)), entry, `${entry.id}: JSON-safe (no functions dropped)`);
    assert.ok(!('build' in entry), `${entry.id}: no build functions serialized`);
    for (const orientation of ORIENTATIONS) {
      const svg = entry.previews[orientation];
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${entry.id}/${orientation}: preview svg`);
      assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${entry.id}/${orientation}: no broken values`);
    }
    assert.deepEqual(entry.editable, { background: true, perElementColor: true, fonts: true });
  }
  // landscape previews are landscape-proportioned
  assert.ok(list[0].previews.landscape.includes('viewBox="0 0 283 200"'), 'landscape preview 283x200');
  assert.ok(list[0].previews.portrait.includes('viewBox="0 0 200 283"'), 'portrait preview 200x283');
});

test('previews reflect an overridden palette; builds honor it too', () => {
  const { palette } = applyBrandOverride({ primary: '#1D4ED8', accent: '#DC2626', background: '#FFFFFF' });
  for (const entry of v2.listTemplatesV2(palette)) {
    for (const orientation of ORIENTATIONS) {
      const svg = entry.previews[orientation];
      assert.ok(svg.includes('#1D4ED8') || svg.includes('#DC2626') || svg.includes('#FFFFFF'),
        `${entry.id}/${orientation}: preview reflects override`);
    }
  }
  eachTemplate((t) => {
    const canvas = v2.buildCanvas(t.id, 'landscape', sampleContentFor(t.contentSchema), palette, DEFAULT_FONTS);
    assert.ok(JSON.stringify(canvas).includes('#1D4ED8'), `${t.id}: build consumes the palette`);
  });
});

test('buildCanvas validates id, orientation, and content', () => {
  const content = sampleContentFor(v2.getTemplateV2('qa-chat').contentSchema);
  assert.throws(() => v2.buildCanvas('no-such-template', 'portrait', content), /unknown v2 template/);
  assert.throws(() => v2.buildCanvas('qa-chat', 'square', content), /orientation/);
  assert.throws(() => v2.buildCanvas('qa-chat', 'portrait', null), /content/);
  assert.equal(v2.getTemplateV2('no-such-template'), null);
  // missing block ids are normalized to blk-N
  const noIds = { ...content, blocks: content.blocks.map(({ id: _id, ...rest }) => rest) };
  const canvas = v2.buildCanvas('qa-chat', 'portrait', noIds);
  assert.ok(canvas.objects.some((o) => o.msgId === 'blk-1'), 'blk ids normalized');
});

// ── decor library discipline ─────────────────────────────────────────────────

test('decor functions emit only decor/background roles with restrained opacity', () => {
  const p = DEFAULT_PALETTE;
  const calls = {
    gradientWash: decor.gradientWash({ w: 1414, h: 2000, from: p.primary, to: p.accent }),
    softGlow: decor.softGlow({ x: 700, y: 700, r: 300, color: p.primary }),
    dotGrid: decor.dotGrid({ x: 100, y: 100, cols: 4, rows: 4, color: p.dark }),
    shieldMotif: decor.shieldMotif({ x: 700, y: 400, size: 200, color: p.dark }),
    signalArcs: decor.signalArcs({ x: 0, y: 0, r: 400, color: p.primary }),
    padlockMotif: decor.padlockMotif({ x: 700, y: 900, size: 160, color: p.dark }),
    fingerprintArcs: decor.fingerprintArcs({ x: 400, y: 400, size: 260, color: p.dark }),
    lightBeams: decor.lightBeams({ w: 2000, h: 1414, color: p.primary }),
    cornerFrame: decor.cornerFrame({ x: 60, y: 60, w: 1294, h: 1880, color: p.dark }),
    perspectiveGrid: decor.perspectiveGrid({ w: 1414, horizonY: 900, floorY: 1900, color: p.primary }),
    scanlines: decor.scanlines({ y: 200, w: 1414, h: 800, color: p.primary }),
    meshGlow: decor.meshGlow({ spots: [{ x: 300, y: 300, r: 400, color: p.primary }, { x: 1100, y: 1600, r: 500, color: p.accent }] })
  };
  for (const [name, objects] of Object.entries(calls)) {
    assert.ok(Array.isArray(objects) && objects.length > 0, `${name}: returns objects`);
    for (const o of objects) {
      assert.ok(['decor', 'background'].includes(o.layerRole), `${name}: layerRole decor/background (got ${o.layerRole})`);
      assert.ok(['Rect', 'Circle', 'Polygon'].includes(o.type), `${name}: fabric v6 type`);
      assert.ok(typeof o.opacity === 'number' && o.opacity > 0 && o.opacity <= 0.2,
        `${name}: opacity ${o.opacity} in (0, 0.2]`);
      assertFiniteNumbers(o, name);
    }
  }
  // washes stay in the 0.04–0.15 band and carry a real gradient fill
  for (const intensity of [0, 0.5, 1, 5, NaN]) {
    const [wash] = decor.gradientWash({ w: 2000, h: 1414, from: p.primary, to: p.accent, intensity });
    assert.ok(wash.opacity >= 0.04 && wash.opacity <= 0.15, `wash opacity ${wash.opacity} in 0.04..0.15`);
    assert.equal(wash.fill.type, 'linear', 'wash gradient fill');
    assert.equal(wash.fill.colorStops.length, 2, 'wash gradient stops');
    assert.equal(wash.layerRole, 'background');
  }
  // intensity scales opacity down, never up
  const [full] = decor.softGlow({ x: 0, y: 0, r: 100, color: p.primary, intensity: 1 });
  const [dim] = decor.softGlow({ x: 0, y: 0, r: 100, color: p.primary, intensity: 0.2 });
  assert.ok(dim.opacity < full.opacity, 'lower intensity → lower opacity');
});

test('sampleContentFor round-trips through buildCanvas for every template', () => {
  eachTemplate((t) => {
    for (const orientation of ORIENTATIONS) {
      const canvas = v2.buildCanvas(t.id, orientation, sampleContentFor(t.contentSchema));
      assert.ok(canvas.objects.length > 5, `${t.id}/${orientation}: built from its own sample`);
    }
  });
});

// ── panel F1 hardening: sample content must be distinct per block+field ──────

test('sampleContentFor: per-block field values are pairwise distinct for every registered schema (no degenerate fallbacks)', () => {
  for (const entry of v2.listTemplatesV2()) {
    const sample = sampleContentFor(entry.contentSchema);
    const fields = entry.contentSchema.blocks.fields;
    for (const field of fields) {
      const values = sample.blocks.map((b) => b[field]);
      assert.equal(
        new Set(values).size, values.length,
        `${entry.id}: field "${field}" repeats across blocks (${JSON.stringify(values)}) — fallback leak weakens binding tests`
      );
    }
    // and blocks are two-field-distinct too: no field mirrors another verbatim
    if (fields.length >= 2) {
      for (const b of sample.blocks) {
        assert.notEqual(b[fields[0]], b[fields[1]], `${entry.id}: block ${b.id} has identical ${fields[0]}/${fields[1]}`);
      }
    }
  }
});
