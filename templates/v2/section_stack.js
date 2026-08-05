// v2 template — section-stack (style: infographic). M1 modern family, batch
// C: the org's split-poster language on a LIGHT canvas — a full-height photo
// column (~38% wide) on the left, and a right column of stacked brand-color
// section cards. Each card carries an underlined uppercase section label, a
// measured body, and a thin outline-icon motif (circle + polygon) in its top
// corner; a QR-style white rounded chip sits over the photo column (pure
// decor, no real QR). Portrait stacks the cards; landscape is a REAL
// relayout — the cards re-grid into two columns beside a wider photo column.
// All copy is measured (fitTextBlock) inside fixed card budgets.

import {
  textbox, rect, circle, polygon, imageSlot, backgroundImageSlot,
  fitTextBlock, pickTextColor,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO, PV_LAND_W, PV_LAND_H,
  legibilityScrim
} from './decor.js';

const BG_HINT = 'clean bright office atmosphere, soft neutral tones, minimal texture, no text';
const SLOT_HINT = 'full-height candid photo of a professional concentrating at a laptop, warm natural light, no text';

const CARD_R = 26;
const CARD_PAD = 40;

/** QR-style white rounded chip (decor only — finder squares, no real QR). */
function qrChip(o, palette, { x, y, s }) {
  o.push(rect({ x: x + 6, y: y + 6, w: s, h: s, fill: palette.dark, opacity: 0.18, rx: 22, layerRole: 'decor' }));
  o.push(rect({ x, y, w: s, h: s, fill: '#FFFFFF', rx: 22, layerRole: 'decor' }));
  const f = Math.round(s * 0.24);
  const inset = Math.round(s * 0.14);
  const finder = (fx, fy) => {
    o.push(rect({ x: fx, y: fy, w: f, h: f, fill: 'transparent', stroke: palette.dark, strokeWidth: 6, rx: 6, layerRole: 'decor' }));
    o.push(rect({ x: fx + Math.round(f * 0.3), y: fy + Math.round(f * 0.3), w: Math.round(f * 0.4), h: Math.round(f * 0.4), fill: palette.dark, rx: 3, layerRole: 'decor' }));
  };
  finder(x + inset, y + inset);
  finder(x + s - inset - f, y + inset);
  finder(x + inset, y + s - inset - f);
  // scattered data dots
  const d = Math.round(f * 0.28);
  for (const [dx, dy] of [[0.56, 0.56], [0.72, 0.62], [0.6, 0.74], [0.76, 0.78]]) {
    o.push(rect({ x: Math.round(x + s * dx), y: Math.round(y + s * dy), w: d, h: d, fill: palette.dark, rx: 2, layerRole: 'decor' }));
  }
}

/** Headline (+optional sub) at the top of the content column. */
function headlineZone(o, content, palette, fonts, { x, y, w, headBudget, headMax }) {
  const head = fitTextBlock(content.headline, { width: w, height: headBudget, maxSize: headMax, minSize: 46, lineHeight: 1.05 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark,
    lineHeight: 1.05, charSpacing: -10, layerRole: 'headline', bgRef: palette.background
  }));
  let cursor = y + head.height;
  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, { width: w, height: 100, maxSize: 32, minSize: 16, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: Math.round(cursor + 24), w, fontSize: sub.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: palette.background
    }));
    cursor += 24 + sub.height;
  }
  return Math.round(cursor);
}

/**
 * One brand-color section card: underlined uppercase label, measured body,
 * thin outline icon motif (circle + triangle) in the top-right corner.
 */
function sectionCard(o, b, i, palette, fonts, { x, y, w, h }) {
  const fills = [palette.primary, palette.dark, palette.accent];
  const fill = fills[i % fills.length];
  const on = pickTextColor(fill);

  o.push(rect({ x: x + 6, y: y + 6, w, h, fill: palette.dark, opacity: 0.14, rx: CARD_R, layerRole: 'background', msgId: b.id }));
  o.push(rect({ x, y, w, h, fill, rx: CARD_R, layerRole: 'background', msgId: b.id }));

  // outline icon motif — thin circle + small triangle, top-right corner
  const mx = x + w - 62;
  const my = y + 60;
  o.push(circle({ x: mx, y: my, r: 30, fill: 'transparent', stroke: on, strokeWidth: 3, opacity: 0.55, layerRole: 'decor' }));
  o.push(polygon([
    { x: mx, y: my - 12 }, { x: mx - 12, y: my + 9 }, { x: mx + 12, y: my + 9 }
  ], { fill: 'transparent', stroke: on, strokeWidth: 3, opacity: 0.55, layerRole: 'decor' }));

  // uppercase section label + short underline tick
  const labelW = w - CARD_PAD * 2 - 92;
  const label = fitTextBlock(String(b.label).toUpperCase(), {
    width: labelW, height: 76, maxSize: 30, minSize: 16, lineHeight: 1.25
  });
  o.push({
    ...textbox({
      text: String(b.label).toUpperCase(), x: x + CARD_PAD, y: y + 34, w: labelW,
      fontSize: label.fontSize, fontFamily: fonts.head, fontWeight: '800', fill: on,
      charSpacing: 60, lineHeight: 1.25, layerRole: 'message-label', msgId: b.id, bgRef: fill
    }),
    fieldRef: 'label'
  });
  const tickY = Math.round(y + 34 + label.height + 14);
  o.push(rect({ x: x + CARD_PAD, y: tickY, w: 84, h: 6, fill: on, rx: 3, opacity: 0.85, layerRole: 'decor' }));

  // measured body text
  const textY = tickY + 6 + 22;
  const textW = w - CARD_PAD * 2;
  const fit = fitTextBlock(b.text, {
    width: textW, height: Math.max(48, y + h - textY - 34), maxSize: 32, minSize: 16, lineHeight: 1.35
  });
  o.push({
    ...textbox({
      text: b.text, x: x + CARD_PAD, y: textY, w: textW, fontSize: fit.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: on,
      lineHeight: 1.35, layerRole: 'message', msgId: b.id, bgRef: fill
    }),
    fieldRef: 'text'
  });
}

/** Dark pill CTA bar at the base of the content column. */
function ctaPill(o, content, palette, fonts, { x, y, w, h }) {
  o.push(rect({ x, y, w, h, fill: palette.dark, rx: Math.round(h / 2), layerRole: 'background' }));
  const cta = fitTextBlock(content.callToAction, { width: w - 140, height: h - 32, maxSize: 38, minSize: 18, lineHeight: 1.2 });
  o.push(textbox({
    text: content.callToAction, x: x + 70, y: Math.round(y + (h - cta.height) / 2), w: w - 140,
    fontSize: cta.fontSize, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', lineHeight: 1.2, layerRole: 'cta', bgRef: palette.dark
  }));
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.background);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  // LIGHT scrim (paper-colored): light design — the wash lightens a filled
  // background image so the stacked cards stay crisp.
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  // full-height photo column, left 38%
  const colW = Math.round(W * 0.38);
  o.push(imageSlot({ slotId: 'slot-1', x: 0, y: 0, w: colW, h: H, rx: 0, styleHint: SLOT_HINT, stroke: palette.primary }));
  qrChip(o, palette, { x: 48, y: H - 248, s: 200 });

  const rx = colW + 72;
  const rw = W - rx - 84;
  const cursor = headlineZone(o, content, palette, fonts, { x: rx, y: 120, w: rw, headBudget: 330, headMax: 96 });

  const ctaH = 100;
  const ctaY = H - 84 - ctaH;
  ctaPill(o, content, palette, fonts, { x: rx, y: ctaY, w: rw, h: ctaH });

  const blocks = content.blocks || [];
  const top = Math.max(cursor + 44, 480);
  const bottom = ctaY - 36;
  const n = Math.max(blocks.length, 1);
  const slotH = (bottom - top) / n;
  blocks.forEach((b, i) => {
    sectionCard(o, b, i, palette, fonts, {
      x: rx, y: Math.round(top + i * slotH), w: rw, h: Math.round(slotH - 26)
    });
  });
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.background);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  // LIGHT scrim (paper-colored) — light design contract, see portrait note.
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  // full-height photo column, left 38%
  const colW = Math.round(W * 0.38);
  o.push(imageSlot({ slotId: 'slot-1', x: 0, y: 0, w: colW, h: H, rx: 0, styleHint: SLOT_HINT, stroke: palette.primary }));
  qrChip(o, palette, { x: 44, y: H - 234, s: 190 });

  const rx = colW + 64;
  const rw = W - rx - 80;
  const cursor = headlineZone(o, content, palette, fonts, { x: rx, y: 100, w: rw, headBudget: 250, headMax: 88 });

  const ctaH = 96;
  const ctaY = H - 72 - ctaH;
  ctaPill(o, content, palette, fonts, { x: rx, y: ctaY, w: rw, h: ctaH });

  // cards re-grid into two columns
  const blocks = content.blocks || [];
  const top = Math.max(cursor + 40, 510);
  const bottom = ctaY - 30;
  const cols = 2;
  const rows = Math.max(1, Math.ceil(Math.max(blocks.length, 1) / cols));
  const gapX = 28;
  const cw = Math.round((rw - gapX) / cols);
  const slotH = (bottom - top) / rows;
  blocks.forEach((b, i) => {
    const cx = rx + (i % cols) * (cw + gapX);
    const cy = Math.round(top + Math.floor(i / cols) * slotH);
    sectionCard(o, b, i, palette, fonts, { x: cx, y: cy, w: cw, h: Math.round(slotH - 26) });
  });
  return canvas;
}

function pvCard(parts, palette, { x, y, w, h, fill, on }) {
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), fill, { rx: pv(26) }));
  parts.push(pvBars({ x: pv(x + 40), y: pv(y + 38), w: pv(w * 0.5), lines: 1, barH: 5, gap: 3, fill: on }));
  parts.push(pvRect(pv(x + 40), pv(y + 84), pv(84), pv(6), on, { rx: 1 }));
  parts.push(pvBars({ x: pv(x + 40), y: pv(y + 120), w: pv(w - 80), lines: 2, barH: 4.5, gap: 3.5, fill: on }));
  parts.push(pvCircle(pv(x + w - 62), pv(y + 60), pv(30), 'none', { stroke: on, opacity: 0.55 }));
}

function previewPortrait(palette) {
  const colW = Math.round(1414 * 0.38);
  const parts = [
    pvRect(0, 0, pv(colW), pv(2000), 'none', { stroke: palette.primary, dash: '4 3' }),
    pvRect(pv(48), pv(2000 - 248), pv(200), pv(200), '#FFFFFF', { rx: pv(22), stroke: palette.dark }),
    pvBars({ x: pv(colW + 72), y: pv(132), w: pv(700), lines: 2, barH: 10, gap: 6, fill: palette.dark })
  ];
  const fills = [palette.primary, palette.dark, palette.accent, palette.primary];
  for (let i = 0; i < 4; i++) {
    pvCard(parts, palette, {
      x: colW + 72, y: 486 + i * 325, w: 721, h: 299,
      fill: fills[i], on: pickTextColor(fills[i])
    });
  }
  parts.push(pvRect(pv(colW + 72), pv(1816), pv(721), pv(100), palette.dark, { rx: pv(50) }));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const colW = Math.round(2000 * 0.38);
  const parts = [
    pvRect(0, 0, pv(colW), pv(1414), 'none', { stroke: palette.primary, dash: '4 3' }),
    pvRect(pv(44), pv(1414 - 234), pv(190), pv(190), '#FFFFFF', { rx: pv(22), stroke: palette.dark }),
    pvBars({ x: pv(colW + 64), y: pv(112), w: pv(900), lines: 2, barH: 10, gap: 6, fill: palette.dark })
  ];
  const fills = [palette.primary, palette.dark, palette.accent, palette.primary];
  for (let i = 0; i < 4; i++) {
    pvCard(parts, palette, {
      x: colW + 64 + (i % 2) * 562, y: 516 + Math.floor(i / 2) * 353, w: 534, h: 325,
      fill: fills[i], on: pickTextColor(fills[i])
    });
  }
  parts.push(pvRect(pv(colW + 64), pv(1246), pv(1096), pv(96), palette.dark, { rx: pv(48) }));
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'section-stack',
  name: 'Section stack',
  style: 'infographic',
  description: 'Corporate split layout on a light canvas: a full-height photo column on the left, stacked brand-color section cards on the right — each with an underlined uppercase label, measured body copy and a thin outline icon motif in its corner — plus a QR-style white chip over the photo and a dark pill CTA. Cards stack in portrait and re-grid into two columns in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'cells', min: 3, max: 4, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
