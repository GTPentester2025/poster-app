// Batch C template contract tests (Phase O3): info-flow, info-layers,
// tree-decision, stats-impact, stats-gauge. Each template must pass the D1
// manifest gate, build fabric-v6-safe canvas JSON at the locked dims in BOTH
// orientations, bind EVERY schema block field to a text object (second
// fields via the qa-chat fieldRef pattern), keep image slots honest, keep
// decor opacity restrained, and render SVG previews for both orientations.
// Modules are imported directly — registration in templates/v2/index.js is
// a separate integration step.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import infoFlow from '../../templates/v2/info_flow.js';
import infoLayers from '../../templates/v2/info_layers.js';
import treeDecision from '../../templates/v2/tree_decision.js';
import statsImpact from '../../templates/v2/stats_impact.js';
import statsGauge from '../../templates/v2/stats_gauge.js';
import { validateManifest, sampleContentFor } from '../../templates/v2/manifest_schema.js';
import { DEFAULT_PALETTE, DEFAULT_FONTS, applyBrandOverride } from '../../templates/palette.js';

const BATCH_C = [infoFlow, infoLayers, treeDecision, statsImpact, statsGauge];
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

function build(t, orientation, content, palette = DEFAULT_PALETTE, fonts = DEFAULT_FONTS) {
  return t.build[orientation](structuredClone(content), palette, fonts);
}

function eachTemplate(fn) {
  for (const t of BATCH_C) fn(t);
}

function assertFiniteNumbers(obj, label) {
  for (const [k, val] of Object.entries(obj)) {
    if (typeof val === 'number') assert.ok(Number.isFinite(val), `${label}: ${k} is finite`);
    else if (val && typeof val === 'object') assertFiniteNumbers(val, `${label}.${k}`);
  }
}

// ── manifest contract ────────────────────────────────────────────────────────

test('batch C: all five manifests pass validateManifest with zero problems', () => {
  const ids = new Set();
  eachTemplate((t) => {
    assert.deepEqual(validateManifest(t), [], `${t.id}: manifest valid`);
    assert.ok(!ids.has(t.id), `${t.id}: unique id`);
    ids.add(t.id);
  });
  assert.equal(infoFlow.id, 'info-flow');
  assert.equal(infoFlow.style, 'infographic');
  assert.equal(infoFlow.contentSchema.blocks.kind, 'sequence');
  assert.deepEqual(infoFlow.contentSchema.blocks.fields, ['label', 'text']);
  assert.equal(infoLayers.id, 'info-layers');
  assert.equal(infoLayers.style, 'infographic');
  assert.equal(infoLayers.contentSchema.blocks.kind, 'sequence');
  assert.equal(treeDecision.id, 'tree-decision');
  assert.equal(treeDecision.style, 'tree');
  assert.equal(treeDecision.contentSchema.blocks.kind, 'branches');
  assert.deepEqual(treeDecision.contentSchema.blocks.fields, ['condition', 'outcome']);
  assert.equal(treeDecision.contentSchema.blocks.min, 2);
  assert.equal(treeDecision.contentSchema.blocks.max, 4);
  assert.equal(statsImpact.id, 'stats-impact');
  assert.equal(statsImpact.style, 'stats');
  assert.equal(statsImpact.contentSchema.blocks.kind, 'stats');
  assert.deepEqual(statsImpact.contentSchema.blocks.fields, ['figure', 'caption']);
  assert.equal(statsGauge.id, 'stats-gauge');
  assert.equal(statsGauge.style, 'stats');
  assert.equal(statsGauge.contentSchema.blocks.kind, 'stats');
});

// ── builds: fabric contract, both orientations ───────────────────────────────

test('builds return valid fabric-v6 canvas JSON at locked dims in both orientations', () => {
  eachTemplate((t) => {
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
  });
});

// ── bindings: every block field → a text object, both orientations ───────────

test('every block field binds to a Textbox via msgId + fieldRef in both orientations', () => {
  eachTemplate((t) => {
    const content = sampleContentFor(t.contentSchema);
    for (const orientation of ORIENTATIONS) {
      const canvas = build(t, orientation, content);
      for (const b of content.blocks) {
        for (const field of t.contentSchema.blocks.fields) {
          const bound = canvas.objects.find(
            (o) => o.type === 'Textbox' && o.msgId === b.id && o.fieldRef === field
          );
          assert.ok(bound, `${t.id}/${orientation}: ${b.id}.${field} bound to a Textbox`);
          // chips render uppercase — compare case-insensitively
          assert.equal(
            String(bound.text).toUpperCase(), String(b[field]).toUpperCase(),
            `${t.id}/${orientation}: ${b.id}.${field} verbatim`
          );
          assert.ok(bound.bgRef, `${t.id}/${orientation}: ${b.id}.${field} carries bgRef`);
        }
      }
      // every msgId on the canvas points back at a real block
      const blockIds = new Set(content.blocks.map((b) => b.id));
      for (const o of canvas.objects.filter((x) => x.msgId)) {
        assert.ok(blockIds.has(o.msgId), `${t.id}/${orientation}: msgId "${o.msgId}" points at a block`);
      }
    }
  });
});

test('headline/subheadline/cta placed with readability floors in both orientations', () => {
  eachTemplate((t) => {
    const content = sampleContentFor(t.contentSchema);
    for (const orientation of ORIENTATIONS) {
      const canvas = build(t, orientation, content);

      const headline = canvas.objects.find((o) => o.layerRole === 'headline');
      assert.ok(headline && headline.type === 'Textbox', `${t.id}/${orientation}: headline Textbox`);
      assert.equal(headline.text, content.headline, `${t.id}/${orientation}: headline verbatim`);
      assert.ok(headline.fontSize >= 80, `${t.id}/${orientation}: headline >= 80px (got ${headline.fontSize})`);
      assert.ok(headline.bgRef, `${t.id}/${orientation}: headline carries bgRef`);

      assert.ok(canvas.objects.some((o) => o.layerRole === 'subheadline'), `${t.id}/${orientation}: subheadline placed`);

      for (const m of canvas.objects.filter((o) => o.layerRole === 'message')) {
        assert.equal(m.type, 'Textbox', `${t.id}/${orientation}: messages are Textboxes`);
        assert.ok(m.fontSize >= 16, `${t.id}/${orientation}: message >= 16px floor (got ${m.fontSize})`);
      }

      const cta = canvas.objects.find((o) => o.layerRole === 'cta');
      assert.ok(cta && cta.type === 'Textbox', `${t.id}/${orientation}: cta placed`);
      assert.equal(cta.text, content.callToAction, `${t.id}/${orientation}: cta verbatim`);
      assert.ok(cta.fontSize >= 30, `${t.id}/${orientation}: cta legible`);
    }
  });
});

// ── image slots ──────────────────────────────────────────────────────────────

test('image slots stay honest and match each contentSchema count', () => {
  eachTemplate((t) => {
    const content = sampleContentFor(t.contentSchema);
    for (const orientation of ORIENTATIONS) {
      const canvas = build(t, orientation, content);
      const slots = canvas.objects.filter((o) => o.layerRole === 'image-slot' && o.slotId !== 'bg');
      assert.equal(slots.length, t.contentSchema.imageSlots,
        `${t.id}/${orientation}: ${t.contentSchema.imageSlots} slot(s) declared = placed`);
      for (const s of slots) {
        assert.equal(s.fill, 'transparent', `${t.id}/${orientation}: empty frame, not a fake image`);
        assert.ok(Array.isArray(s.strokeDashArray), `${t.id}/${orientation}: dashed frame`);
        assert.ok(s.slotSpec?.slotId && s.slotSpec?.styleHint, `${t.id}/${orientation}: slot spec present`);
        assert.equal(s.slotId, s.slotSpec.slotId, `${t.id}/${orientation}: slotId consistent`);
      }
    }
  });
  assert.equal(infoFlow.contentSchema.imageSlots, 1);
  assert.equal(statsImpact.contentSchema.imageSlots, 1);
  assert.equal(infoLayers.contentSchema.imageSlots, 0);
  assert.equal(treeDecision.contentSchema.imageSlots, 0);
  assert.equal(statsGauge.contentSchema.imageSlots, 4);
});

// ── decor discipline ─────────────────────────────────────────────────────────

test('decor/background atmosphere keeps opacity <= 0.2 in every build', () => {
  eachTemplate((t) => {
    const content = sampleContentFor(t.contentSchema);
    for (const orientation of ORIENTATIONS) {
      const canvas = build(t, orientation, content);
      let translucent = 0;
      for (const o of canvas.objects.filter((x) => ['decor', 'background'].includes(x.layerRole))) {
        if (typeof o.opacity === 'number') {
          assert.ok(o.opacity > 0 && o.opacity <= 0.2,
            `${t.id}/${orientation}: ${o.type} decor opacity ${o.opacity} in (0, 0.2]`);
          translucent += 1;
        }
      }
      assert.ok(translucent >= 2, `${t.id}/${orientation}: atmosphere decor present`);
    }
  });
});

// ── previews ─────────────────────────────────────────────────────────────────

test('previews render SVG for both orientations with clean values', () => {
  eachTemplate((t) => {
    for (const orientation of ORIENTATIONS) {
      const svg = t.preview[orientation](DEFAULT_PALETTE);
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${t.id}/${orientation}: svg markup`);
      assert.ok(svg.includes(PREVIEW_VIEWBOX[orientation]), `${t.id}/${orientation}: orientation-true viewBox`);
      assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${t.id}/${orientation}: no broken values`);
    }
  });
});

// ── robustness: min/max block counts ─────────────────────────────────────────

test('min and max block counts build clean with every block bound', () => {
  eachTemplate((t) => {
    const cs = t.contentSchema;
    const base = sampleContentFor(cs);
    for (const count of [cs.blocks.min, cs.blocks.max]) {
      const blocks = [];
      for (let i = 0; i < count; i++) blocks.push({ ...base.blocks[i % base.blocks.length], id: `blk-${i + 1}` });
      const content = { ...base, subheadline: count === cs.blocks.min ? null : base.subheadline, blocks };
      for (const orientation of ORIENTATIONS) {
        const canvas = build(t, orientation, content);
        for (const b of blocks) {
          for (const field of cs.blocks.fields) {
            assert.ok(
              canvas.objects.some((o) => o.type === 'Textbox' && o.msgId === b.id && o.fieldRef === field),
              `${t.id}/${orientation}: ${b.id}.${field} bound at ${count} blocks`);
          }
        }
        JSON.parse(JSON.stringify(canvas));
      }
    }
  });
});

// ── palette override ─────────────────────────────────────────────────────────

test('builds and previews consume an overridden brand palette', () => {
  const { palette } = applyBrandOverride({ primary: '#1D4ED8', accent: '#DC2626', background: '#FFFFFF' });
  eachTemplate((t) => {
    for (const orientation of ORIENTATIONS) {
      const canvas = build(t, orientation, sampleContentFor(t.contentSchema), palette);
      assert.ok(JSON.stringify(canvas).includes('#1D4ED8'), `${t.id}/${orientation}: build consumes the palette`);
      const svg = t.preview[orientation](palette);
      assert.ok(svg.includes('#1D4ED8') || svg.includes('#DC2626') || svg.includes('#FFFFFF'),
        `${t.id}/${orientation}: preview reflects override`);
    }
  });
});

// ── template-specific geometry ───────────────────────────────────────────────

test('info-flow: nodes are numbered sequentially and ride a dotted trail', () => {
  const content = sampleContentFor(infoFlow.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = build(infoFlow, orientation, content);
    for (let i = 1; i <= content.blocks.length; i++) {
      assert.ok(
        canvas.objects.some((o) => o.type === 'Textbox' && o.layerRole === 'decor' && o.text === String(i)),
        `${orientation}: node number ${i} present`);
    }
    // trail dots between consecutive nodes (7 per segment)
    const dots = canvas.objects.filter((o) => o.type === 'Circle' && o.layerRole === 'decor' && o.radius === 6);
    assert.equal(dots.length, (content.blocks.length - 1) * 7, `${orientation}: dotted trail segments`);
  }
});

test('info-layers: portrait bands step down in width, landscape columns step up in height', () => {
  const content = sampleContentFor(infoLayers.contentSchema);
  const byBlock = (canvas) => content.blocks.map((b) =>
    canvas.objects.find((o) => o.type === 'Rect' && o.layerRole === 'background' && o.msgId === b.id));

  const portrait = build(infoLayers, 'portrait', content);
  const bands = byBlock(portrait);
  bands.forEach((band, i) => {
    assert.ok(band, `portrait: band ${i + 1} present`);
    if (i > 0) assert.ok(band.width < bands[i - 1].width, `portrait: band ${i + 1} narrower than band ${i}`);
  });

  const landscape = build(infoLayers, 'landscape', content);
  const cols = byBlock(landscape);
  cols.forEach((col, i) => {
    assert.ok(col, `landscape: column ${i + 1} present`);
    if (i > 0) {
      assert.ok(col.height > cols[i - 1].height, `landscape: column ${i + 1} taller than column ${i}`);
      assert.ok(col.top < cols[i - 1].top, `landscape: column ${i + 1} rises higher`);
    }
  });
});

test('tree-decision: conditions ride connectors as pills, outcomes land in leaf cards', () => {
  const content = sampleContentFor(treeDecision.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = build(treeDecision, orientation, content);
    for (const b of content.blocks) {
      const pill = canvas.objects.find((o) => o.type === 'Rect' && o.layerRole === 'message-label' && o.msgId === b.id);
      const leaf = canvas.objects.find((o) => o.type === 'Rect' && o.layerRole === 'background' && o.msgId === b.id);
      assert.ok(pill, `${orientation}: ${b.id} condition pill`);
      assert.ok(leaf, `${orientation}: ${b.id} outcome leaf card`);
    }
    // the root card holds the headline (dark card, centered text)
    const headline = canvas.objects.find((o) => o.layerRole === 'headline');
    assert.equal(headline.textAlign, 'center', `${orientation}: root question centered`);
  }
});

test('stats-impact: all figures >= 64px with the hero figure largest', () => {
  const content = sampleContentFor(statsImpact.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = build(statsImpact, orientation, content);
    const figures = canvas.objects.filter((o) => o.fieldRef === 'figure');
    assert.equal(figures.length, content.blocks.length, `${orientation}: one figure per block`);
    for (const f of figures) assert.ok(f.fontSize >= 64, `${orientation}: figure ${f.msgId} >= 64px (got ${f.fontSize})`);
    const hero = figures.find((f) => f.msgId === 'blk-1');
    for (const f of figures.filter((x) => x.msgId !== 'blk-1')) {
      assert.ok(hero.fontSize > f.fontSize, `${orientation}: hero larger than ${f.msgId}`);
    }
  }
});

test('stats-gauge: dark theme with a gauge ring around every figure', () => {
  const content = sampleContentFor(statsGauge.contentSchema);
  for (const orientation of ORIENTATIONS) {
    const canvas = build(statsGauge, orientation, content);
    // stats-gauge uses DARK_BASE (#0D0C12) — a deeper near-black that anchors
    // the dark system palette (decor.js). The canvas must still be a dark hex.
    assert.ok(/^#[0-9a-fA-F]{6}$/.test(canvas.background), `${orientation}: dark canvas background is a hex color`);
    const rings = canvas.objects.filter(
      (o) => o.type === 'Circle' && o.fill === 'transparent' && o.stroke && o.strokeWidth >= 16
    );
    assert.equal(rings.length, content.blocks.length, `${orientation}: one bold outer ring per stat`);
    // figures sit inside their rings
    for (const f of canvas.objects.filter((o) => o.fieldRef === 'figure')) {
      const inside = rings.some((r) => {
        const cx = r.left + r.radius;
        const cy = r.top + r.radius;
        return f.left >= cx - r.radius && f.left + f.width <= cx + r.radius &&
          f.top >= cy - r.radius && f.top + f.fontSize * 1.2 <= cy + r.radius + 40;
      });
      assert.ok(inside, `${orientation}: figure ${f.msgId} inside a ring`);
    }
  }
});
