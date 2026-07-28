// I4 night-family contract test — the 10 predominantly-black v2 templates
// (neon-grid, threat-radar, glass-stack, hex-cells, case-file, spotlight-quote,
// orbit-path, verdict-branches, ticker-tape, impact-burst). Schema-driven so one
// loop holds every template to the full D1 contract: manifest valid; builds at
// locked dims in BOTH orientations; only whitelisted fabric v6 types + finite
// numbers; text/slots in-bounds; EVERY block field binds to a Textbox
// (msgId + fieldRef + bgRef + fontSize floor); headline>=80 / subheadline /
// cta>=30; image-slot count matches schema and stays honest; >=2 restrained
// decor objects (opacity in (0,0.2]); NO rotated Textbox (pptx export contract);
// min & max block counts build clean; previews are orientation-true SVG; and an
// overridden brand palette is consumed by build + preview.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as v2 from '../../templates/v2/index.js';
import { sampleContentFor, validateManifest } from '../../templates/v2/manifest_schema.js';
import { DEFAULT_PALETTE, DEFAULT_FONTS, applyBrandOverride } from '../../templates/palette.js';

const NIGHT_IDS = [
  'neon-grid', 'threat-radar', 'glass-stack', 'hex-cells', 'case-file',
  'spotlight-quote', 'orbit-path', 'verdict-branches', 'ticker-tape', 'impact-burst',
  // I6 image-first premium family
  'cinematic-cover', 'image-mosaic', 'editorial-hero', 'feature-spread'
];

const KNOWN = new Set(['Textbox', 'Rect', 'Circle', 'Polygon', 'Line', 'Ellipse', 'Triangle', 'Path', 'Group']);
const ORIENTATIONS = ['portrait', 'landscape'];
const DIMS = { portrait: { w: 1414, h: 2000 }, landscape: { w: 2000, h: 1414 } };
const TEXT_ROLES = new Set(['headline', 'subheadline', 'message', 'message-label', 'cta']);
const SHORT_FIELD = /^(label|figure|value|unit)$/;
const VIEWBOX = { portrait: 'viewBox="0 0 200 283"', landscape: 'viewBox="0 0 283 200"' };

function assertFinite(obj, label) {
  for (const [k, val] of Object.entries(obj)) {
    if (typeof val === 'number') assert.ok(Number.isFinite(val), `${label}.${k} finite`);
    else if (val && typeof val === 'object') assertFinite(val, `${label}.${k}`);
  }
}

function contentAt(cs, count) {
  const base = sampleContentFor(cs);
  const blocks = [];
  for (let i = 0; i < count; i++) blocks.push({ ...base.blocks[i % base.blocks.length], id: `blk-${i + 1}` });
  return { ...base, blocks, subheadline: count === cs.blocks.min ? null : base.subheadline };
}

test('night family: all 10 templates are registered', () => {
  for (const id of NIGHT_IDS) assert.ok(v2.getTemplateV2(id), `${id} registered`);
});

for (const id of NIGHT_IDS) {
  test(`${id}: manifest passes validateManifest`, () => {
    const t = v2.getTemplateV2(id);
    assert.deepEqual(validateManifest(t), [], `${id}: manifest valid`);
    assert.deepEqual(t.editable, { background: true, perElementColor: true, fonts: true });
  });

  test(`${id}: full build contract in both orientations, at min and max block counts`, () => {
    const t = v2.getTemplateV2(id);
    const cs = t.contentSchema;
    for (const count of [cs.blocks.min, cs.blocks.max]) {
      const content = contentAt(cs, count);
      for (const orientation of ORIENTATIONS) {
        const canvas = v2.buildCanvas(id, orientation, content);
        const D = DIMS[orientation];
        assert.equal(canvas.width, D.w, `${id}/${orientation}: width`);
        assert.equal(canvas.height, D.h, `${id}/${orientation}: height`);
        assert.ok(typeof canvas.background === 'string' && canvas.background, `${id}/${orientation}: background`);
        assert.ok(canvas.objects.length > 5, `${id}/${orientation}: objects`);
        assert.equal(JSON.parse(JSON.stringify(canvas)).objects.length, canvas.objects.length, `${id}/${orientation}: round-trip`);

        for (const o of canvas.objects) {
          assert.ok(KNOWN.has(o.type), `${id}/${orientation}: type ${o.type}`);
          assert.ok(typeof o.layerRole === 'string' && o.layerRole, `${id}/${orientation}: layerRole`);
          assertFinite(o, `${id}/${orientation}/${o.type}`);
          if (o.type === 'Textbox') assert.ok(!o.angle, `${id}/${orientation}: unrotated Textbox`);
        }

        for (const o of canvas.objects.filter((x) => TEXT_ROLES.has(x.layerRole) || x.layerRole === 'image-slot')) {
          assert.ok(o.left >= 0 && o.top >= 0, `${id}/${orientation}: ${o.layerRole} top/left`);
          assert.ok(o.left + (o.width || 0) <= D.w + 0.5, `${id}/${orientation}: ${o.layerRole} right edge`);
          assert.ok(o.top <= D.h, `${id}/${orientation}: ${o.layerRole} bottom`);
        }

        // headline / subheadline / cta
        const headline = canvas.objects.find((o) => o.layerRole === 'headline');
        assert.ok(headline && headline.type === 'Textbox', `${id}/${orientation}: headline Textbox`);
        assert.equal(headline.text, content.headline, `${id}/${orientation}: headline verbatim`);
        assert.ok(headline.fontSize >= 80, `${id}/${orientation}: headline >= 80px`);
        if (content.subheadline) {
          assert.ok(canvas.objects.some((o) => o.layerRole === 'subheadline'), `${id}/${orientation}: subheadline placed`);
        }
        const cta = canvas.objects.find((o) => o.layerRole === 'cta');
        assert.ok(cta && cta.type === 'Textbox', `${id}/${orientation}: cta placed`);
        assert.equal(cta.text, content.callToAction, `${id}/${orientation}: cta verbatim`);
        assert.ok(cta.fontSize >= 30, `${id}/${orientation}: cta >= 30px`);

        // every block field binds
        const blockIds = new Set(content.blocks.map((b) => b.id));
        for (const b of content.blocks) {
          for (const field of cs.blocks.fields) {
            const bound = canvas.objects.find((o) => o.type === 'Textbox' && o.msgId === b.id && o.fieldRef === field);
            assert.ok(bound, `${id}/${orientation}@${count}: ${b.id}.${field} bound`);
            assert.equal(String(bound.text).toUpperCase(), String(b[field]).toUpperCase(), `${id}/${orientation}: ${b.id}.${field} verbatim`);
            assert.ok(bound.bgRef, `${id}/${orientation}: ${b.id}.${field} bgRef`);
            assert.ok(bound.fontSize >= 16 || SHORT_FIELD.test(field), `${id}/${orientation}: ${b.id}.${field} font floor`);
          }
          assert.ok(
            canvas.objects.some((o) => o.layerRole === 'message' && o.msgId === b.id),
            `${id}/${orientation}: ${b.id} has a message textbox`);
        }
        for (const o of canvas.objects.filter((x) => x.msgId)) {
          assert.ok(blockIds.has(o.msgId), `${id}/${orientation}: msgId ${o.msgId} valid`);
        }

        // image slots honest + correct count (foreground vs full-bleed 'bg')
        const slots = canvas.objects.filter((o) => o.layerRole === 'image-slot');
        const fg = slots.filter((s) => s.slotId !== 'bg');
        const bg = slots.filter((s) => s.slotId === 'bg');
        assert.equal(fg.length, cs.imageSlots, `${id}/${orientation}: ${fg.length} foreground slots == ${cs.imageSlots}`);
        assert.equal(bg.length, cs.backgroundSlots || 0, `${id}/${orientation}: ${bg.length} bg slots == ${cs.backgroundSlots || 0}`);
        for (const s of slots) {
          assert.equal(s.fill, 'transparent', `${id}/${orientation}: slot transparent`);
          assert.ok(Array.isArray(s.strokeDashArray), `${id}/${orientation}: slot dashed`);
          assert.ok(s.slotSpec?.slotId && s.slotSpec?.styleHint && s.slotId === s.slotSpec.slotId, `${id}/${orientation}: slot spec`);
        }
        assert.equal(new Set(slots.map((s) => s.slotId)).size, slots.length, `${id}/${orientation}: distinct slot ids`);
        if (bg.length) {
          assert.ok(bg[0].left === 0 && bg[0].top === 0 && bg[0].width === D.w && bg[0].height === D.h, `${id}/${orientation}: bg full-bleed`);
          const bgIdx = canvas.objects.indexOf(bg[0]);
          const contentIdx = canvas.objects.findIndex((o) => ['headline', 'message', 'cta'].includes(o.layerRole));
          assert.ok(bgIdx < contentIdx, `${id}/${orientation}: bg renders before content`);
          assert.ok(canvas.objects.some((o) => o.layerRole === 'scrim'), `${id}/${orientation}: scrim present with bg`);
        }

        // decor discipline
        let translucent = 0;
        for (const o of canvas.objects.filter((x) => ['decor', 'background'].includes(x.layerRole))) {
          if (typeof o.opacity === 'number') {
            assert.ok(o.opacity > 0 && o.opacity <= 0.2, `${id}/${orientation}: decor opacity ${o.opacity}`);
            translucent += 1;
          }
        }
        assert.ok(translucent >= 2, `${id}/${orientation}: atmosphere decor present`);
      }
    }
  });

  test(`${id}: previews are orientation-true SVG and honor a brand override`, () => {
    const t = v2.getTemplateV2(id);
    for (const orientation of ORIENTATIONS) {
      const svg = t.preview[orientation](DEFAULT_PALETTE);
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${id}/${orientation}: svg`);
      assert.ok(svg.includes(VIEWBOX[orientation]), `${id}/${orientation}: viewBox`);
      assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${id}/${orientation}: no broken values`);
    }
    const { palette } = applyBrandOverride({ primary: '#1D4ED8', accent: '#DC2626', background: '#FFFFFF' });
    for (const orientation of ORIENTATIONS) {
      const canvas = v2.buildCanvas(id, orientation, sampleContentFor(t.contentSchema), palette, DEFAULT_FONTS);
      assert.ok(JSON.stringify(canvas).includes('#1D4ED8'), `${id}/${orientation}: build consumes override`);
      const svg = t.preview[orientation](palette);
      assert.ok(svg.includes('#1D4ED8') || svg.includes('#DC2626') || svg.includes('#FFFFFF'), `${id}/${orientation}: preview override`);
    }
  });
}
