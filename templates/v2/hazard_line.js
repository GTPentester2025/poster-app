// v2 template — hazard-line (style: bullet). M1 modern family, batch C: the
// org's hazard-stripe poster language on a LIGHT canvas — alternating 45°
// brand+dark stripe bars border the top and bottom edges, a strong centered
// headline owns the upper field, and the points run as wide outlined white
// rows, each fronted by a numbered warning-triangle badge. The CTA sits on a
// dark band just above the bottom stripes. Portrait stacks the rows;
// landscape is a REAL relayout — the rows re-grid into two columns. Stripes
// are individual skewed rects (decor), all copy is measured (fitTextBlock)
// inside fixed row budgets.

import {
  textbox, rect, polygon, backgroundImageSlot,
  fitTextBlock, pickTextColor,
  pv, pvRect, pvBars, pvPoly
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO, PV_LAND_W, PV_LAND_H,
  legibilityScrim
} from './decor.js';

const BG_HINT = 'industrial safety-briefing wall, bright neutral concrete, clean corporate lighting, no text';

/** Hazard bar: dark base + separate 45°-skewed brand stripes across it. */
function hazardBar(o, palette, { y, w, h }) {
  o.push(rect({ x: 0, y, w, h, fill: palette.dark, layerRole: 'decor' }));
  for (let x = -h; x < w + h; x += h * 2) {
    o.push(rect({ x, y, w: h, h, fill: palette.primary, skewX: -45, layerRole: 'decor' }));
  }
}

/** Strong centered headline (+optional sub); returns the y below the block. */
function headlineZone(o, content, palette, fonts, { x, y, w, headBudget, headMax }) {
  const head = fitTextBlock(content.headline, { width: w, height: headBudget, maxSize: headMax, minSize: 52, lineHeight: 1.04 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark, align: 'center',
    lineHeight: 1.04, charSpacing: -10, layerRole: 'headline', bgRef: palette.background
  }));
  let cursor = y + head.height;
  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, { width: w, height: 96, maxSize: 34, minSize: 16, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: Math.round(cursor + 26), w, fontSize: sub.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: palette.dark, align: 'center',
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: palette.background
    }));
    cursor += 26 + sub.height;
  }
  return Math.round(cursor);
}

/** Numbered warning-triangle badge centered on (cx, cy). Numeral is decor. */
function triangleBadge(o, i, palette, fonts, cx, cy) {
  o.push(polygon([
    { x: cx, y: cy - 52 }, { x: cx - 56, y: cy + 42 }, { x: cx + 56, y: cy + 42 }
  ], { fill: palette.primary, stroke: palette.dark, strokeWidth: 5, layerRole: 'decor' }));
  o.push(textbox({
    text: String(i + 1), x: cx - 40, y: cy - 8, w: 80, fontSize: 36,
    fontFamily: fonts.head, fontWeight: '900', fill: pickTextColor(palette.primary),
    align: 'center', lineHeight: 1.1, layerRole: 'decor'
  }));
}

/** One wide outlined row: white plate, triangle badge, measured text. */
function warningRow(o, b, i, palette, fonts, { x, y, w, h }) {
  o.push(rect({ x: x + 5, y: y + 5, w, h, fill: palette.dark, opacity: 0.12, rx: 20, layerRole: 'background', msgId: b.id }));
  o.push(rect({ x, y, w, h, fill: '#FFFFFF', stroke: palette.dark, strokeWidth: 3, rx: 20, layerRole: 'background', msgId: b.id }));
  triangleBadge(o, i, palette, fonts, x + 88, Math.round(y + h / 2));

  const textX = x + 176;
  const textW = w - 176 - 36;
  const fit = fitTextBlock(b.text, {
    width: textW, height: Math.max(44, h - 56), maxSize: 38, minSize: 16, lineHeight: 1.34
  });
  o.push({
    ...textbox({
      text: b.text, x: textX, y: Math.round(y + (h - fit.height) / 2), w: textW,
      fontSize: fit.fontSize, fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.34, layerRole: 'message', msgId: b.id, bgRef: '#FFFFFF'
    }),
    fieldRef: 'text'
  });
}

/** CTA on a dark band directly above the bottom stripes. */
function ctaBand(o, content, palette, fonts, { W, y, h }) {
  o.push(rect({ x: 0, y, w: W, h, fill: palette.dark, layerRole: 'background' }));
  const cta = fitTextBlock(content.callToAction, { width: W - 240, height: h - 44, maxSize: 44, minSize: 22, lineHeight: 1.2 });
  o.push(textbox({
    text: content.callToAction, x: 120, y: Math.round(y + (h - cta.height) / 2), w: W - 240,
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
  // background image so the outlined rows keep their contrast.
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  const barH = 64;
  hazardBar(o, palette, { y: 0, w: W, h: barH });
  hazardBar(o, palette, { y: H - barH, w: W, h: barH });

  const M = 96;
  const cursor = headlineZone(o, content, palette, fonts, {
    x: M, y: 210, w: W - M * 2, headBudget: 340, headMax: 118
  });

  const ctaH = 150;
  const ctaY = H - barH - ctaH;
  ctaBand(o, content, palette, fonts, { W, y: ctaY, h: ctaH });

  const blocks = content.blocks || [];
  const top = Math.max(cursor + 56, 700);
  const bottom = ctaY - 44;
  const n = Math.max(blocks.length, 1);
  const slotH = (bottom - top) / n;
  blocks.forEach((b, i) => {
    warningRow(o, b, i, palette, fonts, {
      x: M, y: Math.round(top + i * slotH), w: W - M * 2, h: Math.round(slotH - 22)
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

  const barH = 56;
  hazardBar(o, palette, { y: 0, w: W, h: barH });
  hazardBar(o, palette, { y: H - barH, w: W, h: barH });

  const M = 96;
  const cursor = headlineZone(o, content, palette, fonts, {
    x: M, y: 150, w: W - M * 2, headBudget: 240, headMax: 100
  });

  const ctaH = 130;
  const ctaY = H - barH - ctaH;
  ctaBand(o, content, palette, fonts, { W, y: ctaY, h: ctaH });

  // rows re-grid into two columns
  const blocks = content.blocks || [];
  const top = Math.max(cursor + 50, 520);
  const bottom = ctaY - 36;
  const cols = 2;
  const rows = Math.max(1, Math.ceil(Math.max(blocks.length, 1) / cols));
  const gapX = 36;
  const cw = Math.round((W - M * 2 - gapX) / cols);
  const slotH = (bottom - top) / rows;
  blocks.forEach((b, i) => {
    warningRow(o, b, i, palette, fonts, {
      x: M + (i % cols) * (cw + gapX), y: Math.round(top + Math.floor(i / cols) * slotH),
      w: cw, h: Math.round(slotH - 26)
    });
  });
  return canvas;
}

function pvStripes(parts, palette, { y, w, h }) {
  parts.push(pvRect(0, pv(y), pv(w), pv(h), palette.dark));
  for (let x = 0; x < w; x += h * 2) {
    parts.push(pvRect(pv(x), pv(y), pv(h), pv(h), palette.primary));
  }
}

function pvRow(parts, palette, { x, y, w, h }) {
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), '#FFFFFF', { rx: pv(20), stroke: palette.dark }));
  const cx = pv(x + 88);
  const cy = pv(y + h / 2);
  parts.push(pvPoly([
    { x: cx, y: cy - pv(52) }, { x: cx - pv(56), y: cy + pv(42) }, { x: cx + pv(56), y: cy + pv(42) }
  ], palette.primary));
  parts.push(pvBars({ x: pv(x + 176), y: cy - 6, w: pv(w - 220), lines: 2, barH: 5, gap: 3.5, fill: palette.dark }));
}

function previewPortrait(palette) {
  const parts = [];
  pvStripes(parts, palette, { y: 0, w: 1414, h: 64 });
  pvStripes(parts, palette, { y: 1936, w: 1414, h: 64 });
  parts.push(pvBars({ x: pv(240), y: pv(240), w: pv(934), lines: 2, barH: 12, gap: 6, fill: palette.dark, align: 'center' }));
  for (let i = 0; i < 4; i++) pvRow(parts, palette, { x: 96, y: 710 + i * 260, w: 1222, h: 232 });
  parts.push(pvRect(0, pv(1786), 200, pv(150), palette.dark));
  parts.push(pvBars({ x: pv(300), y: pv(1840), w: pv(814), lines: 1, barH: 6, gap: 4, fill: palette.primary, align: 'center' }));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const parts = [];
  pvStripes(parts, palette, { y: 0, w: 2000, h: 56 });
  pvStripes(parts, palette, { y: 1358, w: 2000, h: 56 });
  parts.push(pvBars({ x: pv(400), y: pv(170), w: pv(1200), lines: 2, barH: 11, gap: 6, fill: palette.dark, align: 'center' }));
  for (let i = 0; i < 4; i++) {
    pvRow(parts, palette, { x: 96 + (i % 2) * 922, y: 530 + Math.floor(i / 2) * 336, w: 886, h: 306 });
  }
  parts.push(pvRect(0, pv(1228), PV_LAND_W, pv(130), palette.dark));
  parts.push(pvBars({ x: pv(500), y: pv(1272), w: pv(1000), lines: 1, barH: 6, gap: 4, fill: palette.primary, align: 'center' }));
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'hazard-line',
  name: 'Hazard line',
  style: 'bullet',
  description: 'Safety-signage poster on a light canvas: alternating 45-degree brand-and-dark hazard stripe bars border the top and bottom, a strong centered headline leads, and the points are wide outlined white rows fronted by numbered warning-triangle badges, with the CTA on a dark band above the bottom stripes. Rows stack in portrait and re-grid into two columns in landscape.',
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
