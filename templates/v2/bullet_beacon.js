// v2 template — bullet-beacon (style: bullet). The classic awareness bullet
// list, done with 2026 restraint: every bullet gets a tall brand-primary
// accent bar, a label chip and generous body text; one honest image slot in
// the top-right corner. Portrait stacks the bullets full-width; landscape is
// a REAL relayout — hero headline column on the left, bullets in a 2-column
// grid on the right. Decor = vertical gradient wash + corner frame + faint
// shield ghost.
//
// 2026 redesign: elevated card panels per bullet with subtle tint fills,
// richer decor atmosphere (mesh glows + corner frame), improved typography
// weight contrast and line-height, wider margins.

import {
  textbox, rect, chip, imageSlot,
  backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims,
  gradientWash, cornerFrame, meshGlow, dotGrid,
  legibilityScrim,
  svgWrapO, PV_LAND_W
} from './decor.js';

// ── shared helpers ────────────────────────────────────────────────────────────

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 152, fill: palette.dark, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 200, height: 100, maxSize: 46, minSize: 30 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((152 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: palette.dark
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize, subMaxH = 150 }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 300, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark,
    lineHeight: 1.06,
    layerRole: 'headline', bgRef: palette.background
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.06) + 28;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: subMaxH, maxSize: 40, minSize: 28, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.35,
      layerRole: 'subheadline', bgRef: palette.background
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.35) + 24;
  }
  return cursor;
}

/**
 * One bullet: tall accent bar + card background + label chip + body text.
 * Both chip label (fieldRef: 'label') and body text (fieldRef: 'text') bound.
 */
function bullet(o, b, palette, fonts, { x, y, w, h, bgFill }) {
  // card background
  o.push(rect({
    x, y, w, h, fill: bgFill || palette.background, rx: 24,
    stroke: palette.primary, strokeWidth: 1,
    opacity: 0.06, layerRole: 'background', msgId: b.id
  }));
  o.push(rect({
    x, y, w, h, fill: 'transparent', rx: 24,
    stroke: palette.primary, strokeWidth: 1,
    layerRole: 'background', msgId: b.id
  }));
  // tall accent bar
  o.push(rect({
    x: x + 1, y: y + 16, w: 8, h: h - 32,
    fill: palette.primary, rx: 4, layerRole: 'decor', msgId: b.id
  }));

  let textY = y + 24;
  if (b.label) {
    const chipBudgetH = Math.round(h * 0.32);
    const [pill, labelTb] = chip({
      text: b.label, x: x + 36, y: textY, fontSize: 24,
      bg: palette.dark, color: palette.primary, font: fonts.head, msgId: b.id,
      maxW: w - 72, maxH: chipBudgetH
    });
    o.push(pill, { ...labelTb, fieldRef: 'label', bgRef: palette.dark });
    textY += pill.height + 12;
  }
  const textW = w - 72;
  const size = fitFontSize(b.text, {
    width: textW, height: Math.max(90, y + h - textY - 24), maxSize: 46, minSize: 20
  });
  o.push({
    ...textbox({
      text: b.text, x: x + 36, y: textY, w: textW, fontSize: size,
      fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.4,
      layerRole: 'message', msgId: b.id, bgRef: palette.background
    }),
    fieldRef: 'text'
  });
}

// ── portrait build ────────────────────────────────────────────────────────────

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.background);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // decor atmosphere
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'vertical', intensity: 0.75 }));
  o.push(...meshGlow({ spots: [
    { x: 1240, y: 340, r: 380, color: palette.primary },
    { x: 200, y: 1660, r: 320, color: palette.accent }
  ], intensity: 0.7 }));
  o.push(...cornerFrame({ x: 56, y: 56, w: 1302, h: 1888, color: palette.dark, arm: 80, thickness: 6, intensity: 0.8 }));
  o.push(...dotGrid({ x: 1040, y: 200, cols: 5, rows: 4, gap: 54, dotR: 4, color: palette.dark, intensity: 0.65 }));

  const headCursor = headlineZone(o, content, palette, fonts, { x: 96, y: 112, w: 900, maxSize: 112 });

  o.push(imageSlot({
    slotId: 'slot-1', x: 1056, y: 104, w: 264, h: 264,
    styleHint: 'beacon or lighthouse emblem, flat vector, no text', stroke: palette.dark
  }));

  const blocks = content.blocks || [];
  const top = Math.max(544, headCursor + 16);
  const bottom = 1800;
  const blockH = (bottom - top) / Math.max(blocks.length, 1);

  blocks.forEach((b, i) => {
    const by = Math.round(top + i * blockH);
    const bh = Math.round(blockH - 20);
    bullet(o, b, palette, fonts, { x: 96, y: by, w: W - 192, h: bh, bgFill: palette.background });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1848);
  return canvas;
}

// ── landscape build ───────────────────────────────────────────────────────────

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.background);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'horizontal', intensity: 0.75 }));
  o.push(...meshGlow({ spots: [
    { x: 500, y: 960, r: 360, color: palette.accent },
    { x: 1760, y: 320, r: 300, color: palette.primary }
  ], intensity: 0.7 }));
  o.push(...cornerFrame({ x: 48, y: 48, w: 1904, h: 1318, color: palette.dark, arm: 72, thickness: 6, intensity: 0.8 }));

  // hero headline column on the left
  const lsCursor = headlineZone(o, content, palette, fonts, { x: 96, y: 112, w: 640, maxSize: 96 });

  o.push(imageSlot({
    slotId: 'slot-1', x: 112, y: Math.max(784, lsCursor + 32), w: 340, h: 340,
    styleHint: 'beacon or lighthouse emblem, flat vector, no text', stroke: palette.dark
  }));

  // bullets in a 2-column grid on the right
  const blocks = content.blocks || [];
  const gridX = 800;
  const colW = (1904 - gridX) / 2;
  const rows = Math.max(Math.ceil(blocks.length / 2), 1);
  const top = 136;
  const rowH = (1232 - top) / rows;

  blocks.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = Math.round(gridX + col * colW);
    const cy = Math.round(top + row * rowH);
    const cw = Math.round(colW - 16);
    const ch = Math.round(rowH - 16);
    bullet(o, b, palette, fonts, { x: cx, y: cy, w: cw, h: ch, bgFill: palette.background });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1262);
  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────

function pvBullet(parts, palette, { x, y, w, h }) {
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), 'none', { rx: 4, stroke: palette.primary, opacity: 0.5 }));
  parts.push(pvRect(pv(x + 1), pv(y + 10), 1.2, pv(h - 20), palette.primary, { rx: 0.6 }));
  parts.push(pvRect(pv(x + 36), pv(y + 18), pv(150), 4, palette.dark, { rx: 2 }));
  parts.push(pvBars({ x: pv(x + 36), y: pv(y + 76), w: pv(w - 72), lines: 2, barH: 4.5, gap: 3, fill: palette.dark }));
}

function previewPortrait(palette) {
  const parts = [
    pvRect(pv(56), pv(56), pv(80), 1.2, palette.dark, { opacity: 0.2 }),
    pvRect(pv(56), pv(56), 1.2, pv(80), palette.dark, { opacity: 0.2 }),
    pvBars({ x: pv(96), y: pv(124), w: pv(900), lines: 2, barH: 8, gap: 5, fill: palette.dark }),
    pvSlot(pv(1056), pv(104), pv(264), pv(264), palette.dark)
  ];
  for (let i = 0; i < 4; i++) {
    pvBullet(parts, palette, { x: 96, y: 548 + i * 313, w: 1222, h: 293 });
  }
  parts.push(pvRect(0, pv(1848), 200, pv(152), palette.dark));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvBars({ x: pv(96), y: pv(126), w: pv(640), lines: 3, barH: 8, gap: 5, fill: palette.dark }),
    pvSlot(pv(112), pv(784), pv(340), pv(340), palette.dark)
  ];
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = 800 + col * 552;
    const cy = 136 + row * 548;
    pvBullet(parts, palette, { x: cx, y: cy, w: 536, h: 532 });
  }
  parts.push(pvRect(0, pv(1262), PV_LAND_W, pv(152), palette.dark));
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'bullet-beacon',
  name: 'Bullet beacon',
  style: 'bullet',
  description: 'Classic bullet-point poster with bold brand accent bars per point and one image slot — full-width stack in portrait, hero headline column with a two-column bullet grid in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'sequence', min: 3, max: 5, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
