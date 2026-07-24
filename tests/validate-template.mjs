// validate-template.mjs — single-file v2 template contract checker (Phase I4).
// NOT a *.test.js (kept out of the node --test glob). Builder agents run:
//   node poster-app/tests/validate-template.mjs poster-app/templates/v2/<file>.js
// and must see "PASS". It enforces the SAME contract the batch tests enforce,
// schema-driven so it works for any template regardless of style/fields/slots.
//
// Checks: manifest valid; builds both orientations at locked dims; only known
// fabric v6 types; finite numbers; text/slots in-bounds; every block field →
// Textbox (msgId + fieldRef + bgRef + fontSize floor, labels/figures exempt on
// the 38px floor only when short); headline>=80, subheadline placed, cta>=30;
// image-slot count == schema.imageSlots and honest (transparent + dashed +
// slotSpec); >=2 decor/background objects, all opacity in (0,0.2]; NO rotated
// Textbox; min & max block counts build; previews are orientation-true SVG with
// no NaN/undefined; palette override is consumed by build + preview.

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { sampleContentFor, validateManifest } from '../templates/v2/manifest_schema.js';
import { DEFAULT_PALETTE, DEFAULT_FONTS, applyBrandOverride } from '../templates/palette.js';

const KNOWN = new Set(['Textbox', 'Rect', 'Circle', 'Polygon', 'Line', 'Ellipse', 'Triangle', 'Path', 'Group']);
const ORIENTATIONS = ['portrait', 'landscape'];
const DIMS = { portrait: { w: 1414, h: 2000 }, landscape: { w: 2000, h: 1414 } };
const TEXT_ROLES = new Set(['headline', 'subheadline', 'message', 'message-label', 'cta']);
const VIEWBOX = { portrait: 'viewBox="0 0 200 283"', landscape: 'viewBox="0 0 283 200"' };

const problems = [];
const fail = (c, m) => { if (!c) problems.push(m); };

function finite(obj, label) {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number') fail(Number.isFinite(v), `${label}.${k} not finite`);
    else if (v && typeof v === 'object') finite(v, `${label}.${k}`);
  }
}

function contentAt(cs, count) {
  const base = sampleContentFor(cs);
  const blocks = [];
  for (let i = 0; i < count; i++) blocks.push({ ...base.blocks[i % base.blocks.length], id: `blk-${i + 1}` });
  return { ...base, blocks, subheadline: count === cs.blocks.min ? null : base.subheadline };
}

function checkCanvas(t, orientation, content, palette) {
  const cs = t.contentSchema;
  const canvas = t.build[orientation](structuredClone(content), palette, DEFAULT_FONTS);
  const D = DIMS[orientation];
  fail(canvas.width === D.w && canvas.height === D.h, `${orientation}: dims ${canvas.width}x${canvas.height} != ${D.w}x${D.h}`);
  fail(typeof canvas.background === 'string' && canvas.background, `${orientation}: no background`);
  fail(Array.isArray(canvas.objects) && canvas.objects.length > 5, `${orientation}: too few objects`);
  JSON.parse(JSON.stringify(canvas)); // round-trip must not throw

  for (const o of canvas.objects) {
    fail(KNOWN.has(o.type), `${orientation}: bad type "${o.type}"`);
    fail(typeof o.layerRole === 'string' && o.layerRole, `${orientation}: object missing layerRole`);
    finite(o, `${orientation}/${o.type}`);
    if (o.type === 'Textbox') fail(!o.angle, `${orientation}: rotated Textbox "${String(o.text).slice(0, 18)}" (pptx export forbids)`);
  }

  for (const o of canvas.objects.filter((x) => TEXT_ROLES.has(x.layerRole) || x.layerRole === 'image-slot')) {
    fail(o.left >= 0 && o.top >= 0, `${orientation}: ${o.layerRole} off top/left (${o.left},${o.top})`);
    fail(o.left + (o.width || 0) <= D.w + 0.5, `${orientation}: ${o.layerRole} right edge ${o.left + (o.width || 0)} > ${D.w}`);
    fail(o.top <= D.h, `${orientation}: ${o.layerRole} top ${o.top} > ${D.h}`);
  }

  // headline / subheadline / cta
  const headline = canvas.objects.find((o) => o.layerRole === 'headline');
  fail(headline && headline.type === 'Textbox' && headline.text === content.headline, `${orientation}: headline not bound verbatim`);
  fail(headline && headline.fontSize >= 80, `${orientation}: headline < 80px`);
  if (content.subheadline) fail(canvas.objects.some((o) => o.layerRole === 'subheadline'), `${orientation}: no subheadline placed`);
  const cta = canvas.objects.find((o) => o.layerRole === 'cta');
  fail(cta && cta.type === 'Textbox' && cta.text === content.callToAction, `${orientation}: cta not bound verbatim`);
  fail(cta && cta.fontSize >= 30, `${orientation}: cta < 30px`);

  // every block field bound
  const blockIds = new Set(content.blocks.map((b) => b.id));
  for (const b of content.blocks) {
    for (const field of cs.blocks.fields) {
      const bound = canvas.objects.find((o) => o.type === 'Textbox' && o.msgId === b.id && o.fieldRef === field);
      fail(bound, `${orientation}: ${b.id}.${field} not bound to a Textbox (msgId+fieldRef)`);
      if (bound) {
        fail(String(bound.text).toUpperCase() === String(b[field]).toUpperCase(), `${orientation}: ${b.id}.${field} not verbatim`);
        fail(bound.bgRef, `${orientation}: ${b.id}.${field} missing bgRef`);
        const shortField = /^(label|figure|value|unit)$/.test(field);
        fail(bound.fontSize >= 38 || shortField, `${orientation}: ${b.id}.${field} < 38px floor`);
      }
    }
  }
  for (const o of canvas.objects.filter((x) => x.msgId)) fail(blockIds.has(o.msgId), `${orientation}: msgId "${o.msgId}" points at no block`);

  // at least one message-role Textbox per block (registry test)
  const placed = new Set(canvas.objects.filter((o) => o.layerRole === 'message').map((o) => o.msgId));
  for (const b of content.blocks) fail(placed.has(b.id), `${orientation}: ${b.id} has no layerRole:'message' textbox`);

  // image slots — foreground (counted) vs a full-bleed 'bg' background slot
  const allSlots = canvas.objects.filter((o) => o.layerRole === 'image-slot');
  const fgSlots = allSlots.filter((s) => s.slotId !== 'bg');
  const bgSlots = allSlots.filter((s) => s.slotId === 'bg');
  fail(fgSlots.length === cs.imageSlots, `${orientation}: ${fgSlots.length} foreground slots != schema ${cs.imageSlots}`);
  fail(bgSlots.length === (cs.backgroundSlots || 0), `${orientation}: ${bgSlots.length} bg slots != schema ${cs.backgroundSlots || 0}`);
  for (const s of allSlots) {
    fail(s.fill === 'transparent', `${orientation}: slot not transparent`);
    fail(Array.isArray(s.strokeDashArray), `${orientation}: slot not dashed`);
    fail(s.slotSpec?.slotId && s.slotSpec?.styleHint && s.slotId === s.slotSpec.slotId, `${orientation}: slot spec broken`);
  }
  fail(new Set(allSlots.map((s) => s.slotId)).size === allSlots.length, `${orientation}: duplicate slot ids`);
  // a bg slot must be full-bleed and rendered FIRST (behind the scrim + content)
  if (bgSlots.length) {
    const bg = bgSlots[0];
    fail(bg.left === 0 && bg.top === 0 && bg.width === D.w && bg.height === D.h, `${orientation}: bg slot not full-bleed`);
    const firstSlotIdx = canvas.objects.indexOf(bg);
    const firstContentIdx = canvas.objects.findIndex((o) => ['headline', 'message', 'cta'].includes(o.layerRole));
    fail(firstSlotIdx < firstContentIdx, `${orientation}: bg image must render before content`);
    fail(canvas.objects.some((o) => o.layerRole === 'scrim'), `${orientation}: bg slot requires a legibility scrim`);
  }

  // decor discipline
  let translucent = 0;
  for (const o of canvas.objects.filter((x) => ['decor', 'background'].includes(x.layerRole))) {
    if (typeof o.opacity === 'number') {
      fail(o.opacity > 0 && o.opacity <= 0.2, `${orientation}: decor ${o.type} opacity ${o.opacity} not in (0,0.2]`);
      translucent += 1;
    }
  }
  fail(translucent >= 2, `${orientation}: fewer than 2 translucent decor objects`);
}

async function main() {
  const arg = process.argv[2];
  if (!arg) { console.error('usage: node validate-template.mjs <template-file.js>'); process.exit(2); }
  const mod = await import(pathToFileURL(resolve(arg)).href);
  const t = mod.default;

  fail(t && typeof t === 'object', 'no default export');
  const mProblems = validateManifest(t);
  fail(mProblems.length === 0, `manifest invalid: ${mProblems.join('; ')}`);

  if (t && t.contentSchema) {
    const cs = t.contentSchema;
    for (const count of [cs.blocks.min, cs.blocks.max]) {
      const content = contentAt(cs, count);
      for (const orientation of ORIENTATIONS) checkCanvas(t, orientation, content, DEFAULT_PALETTE);
    }
    // palette override consumed
    const { palette } = applyBrandOverride({ primary: '#1D4ED8', accent: '#DC2626', background: '#FFFFFF' });
    for (const orientation of ORIENTATIONS) {
      const canvas = t.build[orientation](sampleContentFor(cs), palette, DEFAULT_FONTS);
      fail(JSON.stringify(canvas).includes('#1D4ED8'), `${orientation}: build ignores overridden primary`);
      const svg = t.preview[orientation](palette);
      fail(svg.includes('#1D4ED8') || svg.includes('#DC2626') || svg.includes('#FFFFFF'), `${orientation}: preview ignores override`);
    }
    // previews
    for (const orientation of ORIENTATIONS) {
      const svg = t.preview[orientation](DEFAULT_PALETTE);
      fail(typeof svg === 'string' && svg.startsWith('<svg') && svg.endsWith('</svg>'), `${orientation}: preview not svg`);
      fail(svg.includes(VIEWBOX[orientation]), `${orientation}: preview wrong viewBox`);
      fail(!svg.includes('NaN') && !svg.includes('undefined'), `${orientation}: preview has NaN/undefined`);
    }
  }

  if (problems.length) {
    console.error(`FAIL (${problems.length}) — ${t && t.id}`);
    for (const p of problems) console.error('  • ' + p);
    process.exit(1);
  }
  console.log(`PASS — ${t.id} (${t.style}) builds clean in both orientations`);
}

main().catch((e) => { console.error('FAIL (threw): ' + (e && e.stack || e)); process.exit(1); });
