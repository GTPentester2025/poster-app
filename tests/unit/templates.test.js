// Template tests (spec §B.6 Path A): all 12 registry templates compile
// realistic approved content into valid 1414x2000 canvas JSON — every message
// placed, readability floors honored (headline >= 80px, message >= 38px),
// honest image slots present, text inside the canvas — and stay robust for
// the whole 3-5 message range. Registry list/get/recommendFor covered.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as registry from '../../templates/index.js';
import { CANVAS_W, CANVAS_H } from '../../templates/helpers.js';
import { DEFAULT_PALETTE, DEFAULT_FONTS, applyBrandOverride } from '../../templates/palette.js';

// realistic dos-donts content (removable media awareness), 4 messages
const CONTENT = {
  headline: 'Think Before You Plug It In',
  subheadline: 'Found USB drives are a favorite attacker delivery trick',
  messages: [
    { id: 'msg-1', label: 'DO', text: 'Hand found USB sticks to the security team' },
    { id: 'msg-2', label: "DON'T", text: 'Plug in a drive you found in the parking lot' },
    { id: 'msg-3', label: 'DO', text: 'Use only company-issued encrypted drives for work files' },
    { id: 'msg-4', label: "DON'T", text: 'Copy customer data onto a personal USB stick' }
  ],
  callToAction: 'Found a device? Bring it to the SOC — do not check what is on it',
  format: 'dos-donts'
};

const CONTENT_3 = {
  ...CONTENT,
  subheadline: null,
  messages: CONTENT.messages.slice(0, 3),
  format: 'key-messages'
};

const CONTENT_5 = {
  ...CONTENT,
  messages: [
    ...CONTENT.messages,
    { id: 'msg-5', label: 'DO', text: 'Report lost company drives the same day' }
  ]
};

const TEXT_ROLES = new Set(['headline', 'subheadline', 'message', 'message-label', 'cta']);

function build(template, content) {
  return template.build(structuredClone(content), DEFAULT_PALETTE, DEFAULT_FONTS);
}

test('registry: 12 templates, unique ids, uniform module shape', () => {
  const all = registry.list();
  assert.equal(all.length, 12);
  assert.equal(new Set(all.map((t) => t.id)).size, 12);
  for (const t of all) {
    assert.ok(t.id && typeof t.id === 'string', `${t.id}: id`);
    assert.ok(t.name && typeof t.name === 'string', `${t.id}: name`);
    assert.ok(t.description && typeof t.description === 'string', `${t.id}: description`);
    assert.ok(Array.isArray(t.suitedFor) && t.suitedFor.length > 0, `${t.id}: suitedFor`);
    assert.equal(typeof t.build, 'function', `${t.id}: build`);
    assert.equal(typeof t.preview, 'function', `${t.id}: preview`);
  }
  // the required basic option exists
  assert.ok(registry.get('minimal-clean'), 'minimal-clean must exist');
  assert.equal(registry.get('no-such-template'), null);
});

test('every template compiles the 4-message content into valid canvas JSON', () => {
  for (const t of registry.list()) {
    const canvas = build(t, CONTENT);
    assert.equal(canvas.width, CANVAS_W, `${t.id}: canvas width`);
    assert.equal(canvas.height, CANVAS_H, `${t.id}: canvas height`);
    assert.ok(typeof canvas.background === 'string' && canvas.background, `${t.id}: background`);
    assert.ok(Array.isArray(canvas.objects) && canvas.objects.length > 5, `${t.id}: objects`);
    // canvas JSON must round-trip (no functions, no non-finite numbers)
    const round = JSON.parse(JSON.stringify(canvas));
    assert.equal(round.objects.length, canvas.objects.length, `${t.id}: JSON round-trip`);
    assert.ok(!JSON.stringify(canvas).includes('null,null'), `${t.id}: no NaN-serialized coordinates`);

    for (const o of canvas.objects) {
      assert.ok(typeof o.layerRole === 'string' && o.layerRole, `${t.id}: every object carries layerRole`);
      assert.ok(typeof o.type === 'string', `${t.id}: every object carries a fabric type`);
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'number') assert.ok(Number.isFinite(v), `${t.id}: ${o.type}.${k} is finite`);
      }
    }

    // every content role placed
    const headline = canvas.objects.find((o) => o.layerRole === 'headline');
    assert.ok(headline, `${t.id}: headline placed`);
    assert.equal(headline.text, CONTENT.headline, `${t.id}: headline verbatim`);
    assert.ok(headline.fontSize >= 80, `${t.id}: headline ${headline.fontSize}px >= 80px floor`);
    assert.ok(canvas.objects.some((o) => o.layerRole === 'subheadline'), `${t.id}: subheadline placed`);

    const msgObjs = canvas.objects.filter((o) => o.layerRole === 'message');
    const placedIds = new Set(msgObjs.map((o) => o.msgId));
    for (const m of CONTENT.messages) {
      assert.ok(placedIds.has(m.id), `${t.id}: ${m.id} placed`);
      const obj = msgObjs.find((o) => o.msgId === m.id);
      assert.equal(obj.text, m.text, `${t.id}: ${m.id} text verbatim`);
      assert.ok(obj.fontSize >= 38, `${t.id}: ${m.id} ${obj.fontSize}px >= 38px floor`);
    }
    // label chips ride with their message ids (bold-split renders numbered
    // blocks instead of chips — a deliberate, pre-existing design choice)
    const labelObjs = canvas.objects.filter((o) => o.layerRole === 'message-label');
    for (const o of labelObjs) {
      assert.ok(placedIds.has(o.msgId), `${t.id}: label chip tied to a placed message`);
    }
    if (t.id !== 'bold-split') {
      const labelIds = new Set(labelObjs.map((o) => o.msgId));
      for (const m of CONTENT.messages.filter((m) => m.label)) {
        assert.ok(labelIds.has(m.id), `${t.id}: label chip for ${m.id}`);
      }
    }

    const cta = canvas.objects.find((o) => o.layerRole === 'cta');
    assert.ok(cta, `${t.id}: cta placed`);
    assert.equal(cta.text, CONTENT.callToAction, `${t.id}: cta verbatim`);

    // 1-2 HONEST image slots: dashed transparent frames with a slot spec
    const slots = canvas.objects.filter((o) => o.layerRole === 'image-slot');
    assert.ok(slots.length >= 1 && slots.length <= 2, `${t.id}: ${slots.length} image slots (1-2)`);
    for (const s of slots) {
      assert.equal(s.fill, 'transparent', `${t.id}: slot is an empty frame, not a fake image`);
      assert.ok(Array.isArray(s.strokeDashArray), `${t.id}: slot frame is dashed`);
      assert.ok(s.slotSpec?.slotId && s.slotSpec?.styleHint, `${t.id}: slot spec for phase 7`);
      assert.equal(s.slotId, s.slotSpec.slotId, `${t.id}: slotId consistent`);
    }
    assert.equal(new Set(slots.map((s) => s.slotId)).size, slots.length, `${t.id}: slot ids unique`);

    // decor shapes present (poster-like, not a plain text stack)
    assert.ok(canvas.objects.some((o) => o.layerRole === 'decor' || o.layerRole === 'background'),
      `${t.id}: decor/background shapes present`);

    // text and slots stay inside the canvas
    for (const o of canvas.objects.filter((x) => TEXT_ROLES.has(x.layerRole) || x.layerRole === 'image-slot')) {
      assert.ok(o.left >= 0 && o.top >= 0, `${t.id}: ${o.layerRole} inside canvas (left=${o.left}, top=${o.top})`);
      assert.ok(o.left + (o.width || 0) <= CANVAS_W, `${t.id}: ${o.layerRole} right edge inside canvas`);
      assert.ok(o.top <= CANVAS_H, `${t.id}: ${o.layerRole} top inside canvas`);
    }
  }
});

test('robustness: every template handles 3 and 5 messages (and a null subheadline)', () => {
  for (const t of registry.list()) {
    for (const content of [CONTENT_3, CONTENT_5]) {
      const canvas = build(t, content);
      const placedIds = new Set(canvas.objects.filter((o) => o.layerRole === 'message').map((o) => o.msgId));
      for (const m of content.messages) {
        assert.ok(placedIds.has(m.id), `${t.id}: ${m.id} placed with ${content.messages.length} messages`);
      }
      for (const o of canvas.objects.filter((x) => x.layerRole === 'message')) {
        assert.ok(o.fontSize >= 38, `${t.id}: message floor holds at ${content.messages.length} messages`);
      }
      JSON.parse(JSON.stringify(canvas)); // still serializable
    }
  }
});

test('preview(palette) returns a real SVG rendering for default and overridden palettes', () => {
  const override = applyBrandOverride({ primary: '#1D4ED8', accent: '#DC2626', background: '#FFFFFF' }).palette;
  for (const t of registry.list()) {
    for (const palette of [DEFAULT_PALETTE, override]) {
      const svg = t.preview(palette);
      assert.equal(typeof svg, 'string', `${t.id}: preview is a string`);
      assert.ok(svg.startsWith('<svg'), `${t.id}: preview starts with <svg`);
      assert.ok(svg.endsWith('</svg>'), `${t.id}: preview closes the svg`);
      assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${t.id}: preview has no broken values`);
    }
    // previews resolve the palette they are given
    assert.ok(t.preview(override).includes('#1D4ED8') || t.preview(override).includes('#DC2626') || t.preview(override).includes('#FFFFFF'),
      `${t.id}: preview reflects the overridden palette`);
  }
});

test('recommendFor orders suitedFor matches first and never drops templates', () => {
  for (const shape of ['dos-donts', 'red-flags', 'key-messages', 'scenario-response', 'split']) {
    const ordered = registry.recommendFor(shape);
    assert.equal(ordered.length, 12, `${shape}: all 12 present`);
    assert.equal(new Set(ordered.map((t) => t.id)).size, 12, `${shape}: no duplicates`);
    const matchFlags = ordered.map((t) => t.suitedFor.includes(shape));
    assert.ok(matchFlags[0], `${shape}: first template is suited`);
    const firstNonMatch = matchFlags.indexOf(false);
    assert.ok(!matchFlags.slice(firstNonMatch).includes(true),
      `${shape}: all suited templates come before unsuited ones`);
    assert.equal(matchFlags.filter(Boolean).length,
      registry.list().filter((t) => t.suitedFor.includes(shape)).length, `${shape}: match count preserved`);
  }
  // unknown / missing shape → plain gallery order
  assert.deepEqual(registry.recommendFor(null).map((t) => t.id), registry.list().map((t) => t.id));
  assert.deepEqual(registry.recommendFor('unheard-of').map((t) => t.id), registry.list().map((t) => t.id));
});

test('fabric v6 contract: vendored build is 6.x and every emitted type resolves', () => {
  // the templates emit capitalized fabric v6 class names; fabric 7 removes the
  // legacy type alias, so a vendor bump must fail here loudly, not in the browser
  const vendor = readFileSync(
    fileURLToPath(new URL('../../ui/vendor/fabric.min.js', import.meta.url)), 'utf8');
  // minified build carries the release as a bare string constant, e.g. const x="6.9.1"
  assert.match(vendor, /"6\.\d+\.\d+"/, 'vendored fabric must expose a 6.x version string');
  const KNOWN_V6_TYPES = new Set(['Textbox', 'Rect', 'Circle', 'Polygon', 'Line', 'Ellipse', 'Triangle', 'Path', 'Group']);
  for (const t of registry.list()) {
    const canvas = t.build(CONTENT, DEFAULT_PALETTE, DEFAULT_FONTS);
    for (const obj of canvas.objects) {
      assert.ok(KNOWN_V6_TYPES.has(obj.type), `${t.id}: unknown fabric type "${obj.type}"`);
      assert.ok(vendor.includes(`"${obj.type}"`) || vendor.includes(`'${obj.type}'`) || vendor.includes(`${obj.type}`),
        `${t.id}: type "${obj.type}" not present in vendored fabric build`);
    }
  }
});
