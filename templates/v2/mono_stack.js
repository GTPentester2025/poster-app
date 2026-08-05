// v2 template — mono-stack (style: qa). Modern dev/tech brand: near-black
// canvas, a quiet dot-grid overlay, an accent left-rail line, and the Q/A
// pairs as thin-outlined charcoal panels with corner ticks. Each row carries a
// monospace-feel label chip ('Q:' / 'A:' — uppercase, wide charSpacing, thin
// outline) beside the measured text. Portrait stacks the panels; landscape is
// a REAL relayout — two panel columns under a wide headline. Panel text is
// measured (fitTextBlock) inside fixed slots so stress content shrinks type
// instead of colliding.

import {
  textbox, rect, backgroundImageSlot,
  fitTextBlock,
  pv, pvRect, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO,
  legibilityScrim, dotGrid,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM
} from './decor.js';

const PAD = 36;           // panel inner padding
const CHIP_W = 66;        // Q:/A: chip width
const CHIP_H = 42;        // Q:/A: chip height
const TEXT_X = 126;       // text inset from panel left (chip zone)
const ROW_GAP = 18;       // question row → answer row gap
const BG_HINT = 'dark terminal aesthetic, subtle code texture, deep charcoal gradients, moody tech atmosphere, no text';

/** Thin-outline monospace-feel chip ('Q:' / 'A:'). */
function techChip(o, label, palette, fonts, { x, y, msgId }) {
  o.push(rect({
    x, y, w: CHIP_W, h: CHIP_H, fill: 'transparent',
    stroke: palette.primary, strokeWidth: 1.5, rx: 8,
    layerRole: 'message-label', msgId
  }));
  o.push(textbox({
    text: String(label).toUpperCase(), x: x + 8, y: y + 8, w: CHIP_W - 16, fontSize: 22,
    fontFamily: fonts.body, fontWeight: '800', fill: DARK_INK, align: 'center',
    charSpacing: 80, lineHeight: 1.2, layerRole: 'message-label', msgId, bgRef: DARK_PANEL
  }));
}

/** Four thin corner ticks tracing a panel's corners. */
function cornerTicks(o, palette, { x, y, w, h }) {
  const t = 3;
  const arm = 22;
  const bar = (bx, by, bw, bh) =>
    rect({ x: bx, y: by, w: bw, h: bh, fill: palette.primary, opacity: 0.9, layerRole: 'decor' });
  o.push(bar(x - 1, y - 1, arm, t), bar(x - 1, y - 1, t, arm));
  o.push(bar(x + w - arm + 1, y - 1, arm, t), bar(x + w - t + 1, y - 1, t, arm));
  o.push(bar(x - 1, y + h - t + 1, arm, t), bar(x - 1, y + h - arm + 1, t, arm));
  o.push(bar(x + w - arm + 1, y + h - t + 1, arm, t), bar(x + w - t + 1, y + h - arm + 1, t, arm));
}

/** One Q/A panel: bordered charcoal card, Q row + A row, corner ticks. */
function qaPanel(o, b, palette, fonts, { x, y, w, h }) {
  const textW = w - TEXT_X - PAD;
  const rowBudget = Math.max(56, (h - PAD * 2 - ROW_GAP) / 2);
  const qFit = fitTextBlock(b.question, { width: textW, height: rowBudget, maxSize: 34, minSize: 14, lineHeight: 1.34 });
  const aFit = fitTextBlock(b.answer, { width: textW, height: rowBudget, maxSize: 32, minSize: 14, lineHeight: 1.34 });
  const qRow = Math.max(CHIP_H, Math.round(qFit.height));
  const aRow = Math.max(CHIP_H, Math.round(aFit.height));
  const panelH = Math.min(h, PAD * 2 + qRow + ROW_GAP + aRow);
  const top = Math.round(y + (h - panelH) / 2);

  o.push(rect({
    x, y: top, w, h: panelH, fill: DARK_PANEL,
    stroke: DARK_INK_DIM, strokeWidth: 1, rx: 12,
    layerRole: 'background', msgId: b.id
  }));
  cornerTicks(o, palette, { x, y: top, w, h: panelH });

  techChip(o, 'Q:', palette, fonts, { x: x + PAD, y: top + PAD, msgId: b.id });
  o.push({
    ...textbox({
      text: b.question, x: x + TEXT_X, y: top + PAD, w: textW, fontSize: qFit.fontSize,
      fontFamily: fonts.body, fontWeight: '700', fill: DARK_INK,
      lineHeight: 1.34, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'question'
  });

  const aY = top + PAD + qRow + ROW_GAP;
  techChip(o, 'A:', palette, fonts, { x: x + PAD, y: aY, msgId: b.id });
  o.push({
    ...textbox({
      text: b.answer, x: x + TEXT_X, y: aY, w: textW, fontSize: aFit.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
      lineHeight: 1.34, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'answer'
  });
}

/** Measured headline (+ optional subheadline); returns the y below them. */
function headlineZone(o, content, fonts, { x, y, w, headBudget, headMax, subBudget }) {
  const head = fitTextBlock(content.headline, { width: w, height: headBudget, maxSize: headMax, minSize: 46, lineHeight: 1.05 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    lineHeight: 1.05, layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + head.height;
  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, { width: w, height: subBudget, maxSize: 34, minSize: 16, lineHeight: 1.3 });
    o.push(textbox({
      text: content.subheadline, x, y: Math.round(cursor + 18), w,
      fontSize: sub.fontSize, fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
      lineHeight: 1.3, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += 18 + sub.height;
  }
  return Math.round(cursor);
}

/** Thin-outline capsule CTA anchored above bottomY; returns its top y. */
function ctaOutline(o, text, palette, fonts, { cx, w, bottomY }) {
  const innerW = w - 120;
  const fit = fitTextBlock(text, { width: innerW, height: 110, maxSize: 36, minSize: 20, lineHeight: 1.2 });
  const pillH = Math.round(fit.height + 48);
  const y = Math.round(bottomY - pillH);
  const x = Math.round(cx - w / 2);
  o.push(rect({
    x, y, w, h: pillH, fill: 'transparent',
    stroke: palette.primary, strokeWidth: 2, rx: Math.min(Math.round(pillH / 2), 56),
    layerRole: 'background'
  }));
  o.push(textbox({
    text, x: x + 60, y: Math.round(y + (pillH - fit.height) / 2), w: innerW,
    fontSize: fit.fontSize, fontFamily: fonts.body, fontWeight: '800', fill: DARK_INK,
    align: 'center', charSpacing: 40, lineHeight: 1.2, layerRole: 'cta', bgRef: DARK_BASE
  }));
  return y;
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // accent left rail + quiet dot grid
  o.push(rect({ x: 56, y: 0, w: 6, h: H, fill: palette.primary, opacity: 0.9, layerRole: 'decor' }));
  o.push(...dotGrid({ x: 1120, y: 128, cols: 6, rows: 6, gap: 44, dotR: 4, color: DARK_INK_DIM, intensity: 0.8 }));

  const M = 110;
  const cursor = headlineZone(o, content, fonts, { x: M, y: 110, w: W - M - 110, headBudget: 280, headMax: 108, subBudget: 96 });

  const ctaTop = ctaOutline(o, content.callToAction, palette, fonts, { cx: W / 2, w: 1000, bottomY: H - 56 });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const top = Math.max(cursor + 44, 560);
  const bottom = ctaTop - 36;
  const slotH = (bottom - top) / n;
  blocks.forEach((b, i) => {
    qaPanel(o, b, palette, fonts, {
      x: M, y: Math.round(top + slotH * i + 9), w: W - M - 110, h: Math.round(slotH - 18)
    });
  });
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(rect({ x: 56, y: 0, w: 6, h: H, fill: palette.primary, opacity: 0.9, layerRole: 'decor' }));
  o.push(...dotGrid({ x: 1620, y: 96, cols: 7, rows: 4, gap: 44, dotR: 4, color: DARK_INK_DIM, intensity: 0.8 }));

  const M = 110;
  const cursor = headlineZone(o, content, fonts, { x: M, y: 100, w: W - M - 110, headBudget: 200, headMax: 92, subBudget: 84 });

  const ctaTop = ctaOutline(o, content.callToAction, palette, fonts, { cx: W / 2, w: 900, bottomY: H - 48 });

  // two panel columns, row-major
  const blocks = content.blocks || [];
  const colW = Math.round((W - M - 110 - 40) / 2);
  const cols = [M, M + colW + 40];
  const top = Math.max(cursor + 36, 430);
  const bottom = ctaTop - 36;
  const rows = Math.max(Math.ceil(blocks.length / 2), 1);
  const slotH = (bottom - top) / rows;
  blocks.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    qaPanel(o, b, palette, fonts, {
      x: cols[col], y: Math.round(top + slotH * row + 9), w: colW, h: Math.round(slotH - 18)
    });
  });
  return canvas;
}

function pvPanel(parts, palette, { x, y, w, h }) {
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), DARK_PANEL, { rx: 2, stroke: DARK_INK_DIM }));
  parts.push(pvRect(pv(x + 36), pv(y + 36), pv(66), pv(42), 'none', { rx: 1.5, stroke: palette.primary }));
  parts.push(pvBars({ x: pv(x + 126), y: pv(y + 42), w: pv(w - 162), lines: 1, barH: 5, gap: 3, fill: DARK_INK }));
  parts.push(pvRect(pv(x + 36), pv(y + h - 78), pv(66), pv(42), 'none', { rx: 1.5, stroke: palette.primary }));
  parts.push(pvBars({ x: pv(x + 126), y: pv(y + h - 72), w: pv(w - 162), lines: 1, barH: 5, gap: 3, fill: DARK_INK_DIM }));
}

function previewPortrait(palette) {
  const parts = [
    pvRect(pv(56), 0, 1, 283, palette.primary, { opacity: 0.9 }),
    pvBars({ x: pv(110), y: pv(122), w: pv(1194), lines: 2, barH: 12, gap: 6, fill: DARK_INK })
  ];
  for (let i = 0; i < 4; i++) pvPanel(parts, palette, { x: 110, y: 570 + i * 306, w: 1194, h: 270 });
  parts.push(pvRect(pv(207), pv(1826), pv(1000), pv(118), 'none', { rx: 8, stroke: palette.primary }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvRect(pv(56), 0, 1, 200, palette.primary, { opacity: 0.9 }),
    pvBars({ x: pv(110), y: pv(110), w: pv(1780), lines: 1, barH: 12, gap: 6, fill: DARK_INK })
  ];
  for (let i = 0; i < 4; i++) {
    const x = 110 + (i % 2) * 910;
    const y = 440 + Math.floor(i / 2) * 390;
    pvPanel(parts, palette, { x, y, w: 870, h: 350 });
  }
  parts.push(pvRect(pv(550), pv(1250), pv(900), pv(112), 'none', { rx: 8, stroke: palette.primary }));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'mono-stack',
  name: 'Mono stack',
  style: 'qa',
  description: 'Dev-brand Q&A on a near-black canvas: thin-outlined charcoal panels with corner ticks, monospace-feel Q:/A: chips with wide letter spacing, a quiet dot-grid overlay and an accent left rail. Stacked panels in portrait, two panel columns in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'qa-pairs', min: 3, max: 4, fields: ['question', 'answer'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
