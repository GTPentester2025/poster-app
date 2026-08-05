// v2 template — outline-kit (style: bullet). Thin-outline minimal kit on a
// LIGHT canvas: Swiss-modern restraint — content cells drawn ONLY as 2px
// outlined rounded rects (no fill), each with an outlined circle check badge
// (circle + polygon tick), an accent corner dot, and huge whitespace all
// around. Portrait: headline over a stacked cell run (badge left);
// landscape: REAL relayout — headline + CTA column left, a two-column cell
// grid right (badge top). Cell copy is measured (fitTextBlock) inside fixed
// slots so stress content shrinks type instead of colliding.

import {
  textbox, rect, circle, polygon, backgroundImageSlot,
  fitTextBlock,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO,
  legibilityScrim
} from './decor.js';

const CELL_R = 30;        // cell corner radius
const BG_HINT = 'ultra minimal white studio backdrop, soft daylight, faint geometric shadows, generous negative space, no text';

/** Outlined circle check badge: 2px circle + filled polygon tick. */
function checkBadge(o, palette, cx, cy) {
  o.push(circle({ x: cx, y: cy, r: 30, fill: 'transparent', stroke: palette.dark, strokeWidth: 2, layerRole: 'decor' }));
  o.push(polygon([
    { x: cx - 13, y: cy + 1 }, { x: cx - 4, y: cy + 11 }, { x: cx + 14, y: cy - 9 },
    { x: cx + 9, y: cy - 13 }, { x: cx - 4, y: cy + 2 }, { x: cx - 9, y: cy - 3 }
  ], { fill: palette.primary, layerRole: 'decor' }));
}

/** Portrait cell: outline rect, badge left, text beside, accent corner dot. */
function rowCell(o, b, palette, fonts, { x, y, w, h }) {
  const textX = x + 132;
  const textW = w - 132 - 64;
  const fit = fitTextBlock(b.text, {
    width: textW, height: Math.max(44, h - 72), maxSize: 36, minSize: 14, lineHeight: 1.32
  });
  const cellH = Math.max(140, Math.min(h, Math.round(fit.height + 72)));
  const top = Math.round(y + (h - cellH) / 2);

  o.push(rect({
    x, y: top, w, h: cellH, fill: 'transparent',
    stroke: palette.dark, strokeWidth: 2, rx: CELL_R,
    layerRole: 'background', msgId: b.id
  }));
  checkBadge(o, palette, x + 70, top + Math.round(cellH / 2));
  o.push(circle({ x: x + w - 32, y: top + 32, r: 8, fill: palette.accent, layerRole: 'decor' }));
  o.push({
    ...textbox({
      text: b.text, x: textX, y: Math.round(top + (cellH - fit.height) / 2), w: textW,
      fontSize: fit.fontSize, fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.32, layerRole: 'message', msgId: b.id, bgRef: palette.background
    }),
    fieldRef: 'text'
  });
}

/** Landscape grid cell: outline rect, badge top-left, text below. */
function gridCell(o, b, palette, fonts, { x, y, w, h }) {
  const pad = 36;
  const textW = w - pad * 2;
  const fit = fitTextBlock(b.text, {
    width: textW, height: Math.max(44, h - 118 - pad), maxSize: 30, minSize: 14, lineHeight: 1.32
  });
  o.push(rect({
    x, y, w, h, fill: 'transparent',
    stroke: palette.dark, strokeWidth: 2, rx: CELL_R,
    layerRole: 'background', msgId: b.id
  }));
  checkBadge(o, palette, x + 66, y + 66);
  o.push(circle({ x: x + w - 32, y: y + 32, r: 8, fill: palette.accent, layerRole: 'decor' }));
  o.push({
    ...textbox({
      text: b.text, x: x + pad, y: y + 118, w: textW,
      fontSize: fit.fontSize, fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.32, layerRole: 'message', msgId: b.id, bgRef: palette.background
    }),
    fieldRef: 'text'
  });
}

/** Measured headline (+ optional subheadline); returns the y below them. */
function headlineZone(o, content, palette, fonts, { x, y, w, headBudget, headMax }) {
  const head = fitTextBlock(content.headline, { width: w, height: headBudget, maxSize: headMax, minSize: 46, lineHeight: 1.06 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark,
    lineHeight: 1.06, layerRole: 'headline', bgRef: palette.background
  }));
  let cursor = y + head.height;
  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, { width: w, height: 130, maxSize: 34, minSize: 16, lineHeight: 1.3 });
    o.push(textbox({
      text: content.subheadline, x, y: Math.round(cursor + 26), w,
      fontSize: sub.fontSize, fontFamily: fonts.body, fontWeight: '600', fill: palette.primary,
      lineHeight: 1.3, layerRole: 'subheadline', bgRef: palette.background
    }));
    cursor += 26 + sub.height;
  }
  return Math.round(cursor);
}

/** Thin-outline capsule CTA anchored above bottomY; returns its top y. */
function ctaOutline(o, text, palette, fonts, { cx, w, bottomY }) {
  const innerW = w - 120;
  const fit = fitTextBlock(text, { width: innerW, height: 110, maxSize: 34, minSize: 20, lineHeight: 1.2 });
  const pillH = Math.round(fit.height + 52);
  const y = Math.round(bottomY - pillH);
  const x = Math.round(cx - w / 2);
  o.push(rect({
    x, y, w, h: pillH, fill: 'transparent',
    stroke: palette.dark, strokeWidth: 2, rx: Math.min(Math.round(pillH / 2), 56),
    layerRole: 'background'
  }));
  o.push(circle({ x: x + 44, y: y + Math.round(pillH / 2), r: 8, fill: palette.accent, layerRole: 'decor' }));
  o.push(textbox({
    text, x: x + 60, y: Math.round(y + (pillH - fit.height) / 2), w: innerW,
    fontSize: fit.fontSize, fontFamily: fonts.head, fontWeight: '800', fill: palette.dark,
    align: 'center', charSpacing: 40, lineHeight: 1.2, layerRole: 'cta', bgRef: palette.background
  }));
  return y;
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.background);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  // LIGHT scrim: Swiss-minimal reads dark-on-paper — wash a filled background
  // image back toward the paper tone instead of darkening it.
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  const M = 140;
  const cursor = headlineZone(o, content, palette, fonts, { x: M, y: 140, w: W - M * 2, headBudget: 300, headMax: 120 });

  const ctaTop = ctaOutline(o, content.callToAction, palette, fonts, { cx: W / 2, w: 1020, bottomY: H - 72 });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const top = Math.max(cursor + 70, 620);
  const bottom = ctaTop - 60;
  const slotH = (bottom - top) / n;
  blocks.forEach((b, i) => {
    rowCell(o, b, palette, fonts, {
      x: M, y: Math.round(top + slotH * i + 20), w: W - M * 2, h: Math.round(slotH - 40)
    });
  });
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.background);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  // left column: headline + CTA, swimming in whitespace
  const M = 140;
  const colW = 600;
  headlineZone(o, content, palette, fonts, { x: M, y: 140, w: colW, headBudget: 420, headMax: 100 });
  ctaOutline(o, content.callToAction, palette, fonts, { cx: M + colW / 2, w: colW, bottomY: H - 110 });

  // right: two-column outline cell grid
  const blocks = content.blocks || [];
  const gridX = 880;
  const gridW = W - gridX - 120;
  const gap = 40;
  const cellW = Math.round((gridW - gap) / 2);
  const rows = Math.max(Math.ceil(blocks.length / 2), 1);
  const top = 140;
  const bottom = H - 120;
  const rowH = (bottom - top) / rows;
  blocks.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    gridCell(o, b, palette, fonts, {
      x: gridX + col * (cellW + gap), y: Math.round(top + rowH * row + 20),
      w: cellW, h: Math.round(rowH - 40)
    });
  });
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvBars({ x: pv(140), y: pv(154), w: pv(1134), lines: 2, barH: 12, gap: 7, fill: palette.dark })
  ];
  for (let i = 0; i < 4; i++) {
    const y = 640 + i * 278;
    parts.push(pvRect(pv(140), pv(y), pv(1134), pv(238), 'none', { rx: 4, stroke: palette.dark }));
    parts.push(pvCircle(pv(210), pv(y + 119), pv(30), 'none', { stroke: palette.dark }));
    parts.push(pvCircle(pv(1242), pv(y + 32), 1.2, palette.accent));
    parts.push(pvBars({ x: pv(272), y: pv(y + 84), w: pv(878), lines: 2, barH: 6, gap: 4, fill: palette.dark }));
  }
  parts.push(pvRect(pv(197), pv(1794), pv(1020), pv(134), 'none', { rx: 9, stroke: palette.dark }));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvBars({ x: pv(140), y: pv(154), w: pv(600), lines: 3, barH: 11, gap: 6, fill: palette.dark }),
    pvRect(pv(140), pv(1170), pv(600), pv(134), 'none', { rx: 9, stroke: palette.dark })
  ];
  for (let i = 0; i < 4; i++) {
    const x = 880 + (i % 2) * 520;
    const y = 160 + Math.floor(i / 2) * 577;
    parts.push(pvRect(pv(x), pv(y), pv(480), pv(497), 'none', { rx: 4, stroke: palette.dark }));
    parts.push(pvCircle(pv(x + 66), pv(y + 66), pv(28), 'none', { stroke: palette.dark }));
    parts.push(pvCircle(pv(x + 448), pv(y + 32), 1.2, palette.accent));
    parts.push(pvBars({ x: pv(x + 36), y: pv(y + 130), w: pv(408), lines: 3, barH: 5, gap: 4, fill: palette.dark }));
  }
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'outline-kit',
  name: 'Outline kit',
  style: 'bullet',
  description: 'Thin-outline Swiss-modern kit on a light canvas: content cells drawn only as 2px outlined rounded rects with an outlined circle check badge, an accent corner dot and huge whitespace. Stacked cells under the headline in portrait; headline + CTA column beside a two-column outline grid in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'cells', min: 3, max: 4, fields: ['text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
