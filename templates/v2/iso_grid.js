// v2 template — iso-grid (style: infographic). Isometric card grid: each
// block is a 3D-looking slab — a flat front face plus skewed parallelogram
// top face and shaded side face (pure Polygons, no Path quirks), with a soft
// offset shadow for depth. Cards STAGGER diagonally: portrait steps them
// right as they descend; landscape steps a 4-across row downward. Dark
// dashboard base, dot-grid texture, sequence blocks {label, text}.

import {
  textbox, rect, polygon, backgroundImageSlot,
  fitTextBlock,
  pv, pvRect, pvPoly, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, dotGrid, gradientWash, svgWrapO, PV_LAND_H,
  legibilityScrim, DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM
} from './decor.js';

const DEPTH_X = 36;   // isometric extrusion (x)
const DEPTH_Y = 22;   // isometric extrusion (y)

/**
 * One isometric card: shadow → side face → top face → front face → label +
 * text. (x, y) is the front face's top-left; the top face rises DEPTH_Y above.
 */
function isoCard(o, b, palette, fonts, { x, y, w, h }) {
  // soft offset shadow for depth
  o.push(rect({
    x: x + 18, y: y + 20, w: w + DEPTH_X, h, fill: '#000000',
    opacity: 0.18, layerRole: 'decor'
  }));
  // side face (right) — darker shade
  o.push(polygon([
    { x: x + w, y }, { x: x + w + DEPTH_X, y: y - DEPTH_Y },
    { x: x + w + DEPTH_X, y: y + h - DEPTH_Y }, { x: x + w, y: y + h }
  ], { fill: palette.secondary, layerRole: 'background' }));
  // top face — brand primary parallelogram
  o.push(polygon([
    { x, y }, { x: x + DEPTH_X, y: y - DEPTH_Y },
    { x: x + w + DEPTH_X, y: y - DEPTH_Y }, { x: x + w, y }
  ], { fill: palette.primary, layerRole: 'background' }));
  // front face
  o.push(rect({ x, y, w, h, fill: DARK_PANEL, layerRole: 'background', msgId: b.id }));
  o.push(rect({
    x, y, w, h, fill: 'transparent', stroke: palette.primary, strokeWidth: 2,
    opacity: 0.2, layerRole: 'decor'
  }));
  // accent keyline down the left edge of the face
  o.push(rect({ x, y, w: 10, h, fill: palette.accent, layerRole: 'decor' }));

  const padX = 40;
  const innerW = w - padX * 2;
  const label = fitTextBlock(b.label, {
    width: innerW, height: Math.max(40, Math.min(96, Math.round(h * 0.3))),
    maxSize: 40, minSize: 16, lineHeight: 1.15
  });
  o.push({
    ...textbox({
      text: b.label, x: x + padX, y: y + 32, w: innerW, fontSize: label.fontSize,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.primary,
      lineHeight: 1.15, charSpacing: 60, layerRole: 'message-label', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'label'
  });

  const textTop = Math.round(y + 32 + label.height + 18);
  const fit = fitTextBlock(b.text, {
    width: innerW, height: Math.max(44, y + h - textTop - 30), maxSize: 38, minSize: 16, lineHeight: 1.3
  });
  o.push({
    ...textbox({
      text: b.text, x: x + padX, y: textTop, w: innerW, fontSize: fit.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
      lineHeight: 1.3, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'text'
  });
}

function headlineZone(o, content, palette, fonts, { x, y, w, headBudget, maxSize }) {
  const head = fitTextBlock(content.headline, { width: w, height: headBudget, maxSize, minSize: 80, lineHeight: 1.05 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    lineHeight: 1.05, layerRole: 'headline', bgRef: DARK_BASE
  }));
  let bottom = y + head.height;
  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, { width: w, height: 110, maxSize: 40, minSize: 16, lineHeight: 1.3 });
    o.push(textbox({
      text: content.subheadline, x, y: Math.round(bottom + 22), w, fontSize: sub.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
      lineHeight: 1.3, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    bottom += 22 + sub.height;
  }
  return bottom;
}

function ctaBar(o, text, palette, fonts, W, y, h) {
  o.push(rect({ x: 0, y, w: W, h, fill: DARK_PANEL, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 5, fill: palette.primary, opacity: 0.2, layerRole: 'decor' }));
  const cta = fitTextBlock(text, { width: W - 180, height: h - 44, maxSize: 46, minSize: 30, lineHeight: 1.16 });
  o.push(textbox({
    text, x: 90, y: y + Math.round((h - cta.height) / 2), w: W - 180,
    fontSize: cta.fontSize, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark isometric cityscape of glowing cubes, deep navy, subtle, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: DARK_BASE, direction: 'diagonal', intensity: 0.8 }));
  o.push(...dotGrid({ x: 1160, y: 120, cols: 5, rows: 7, gap: 44, dotR: 4, color: palette.primary, intensity: 0.9 }));

  const contentBottom = headlineZone(o, content, palette, fonts, {
    x: 96, y: 100, w: 1100, headBudget: 300, maxSize: 120
  });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const ctaH = 144;
  const top = Math.max(Math.round(contentBottom) + 60, 560);
  const availH = H - ctaH - 20 - top;
  const slotH = Math.floor(availH / n);
  const cardW = 1010;
  blocks.forEach((b, i) => {
    // diagonal stagger: each card steps right as it descends
    const x = 84 + i * 84;
    const y = top + i * slotH + DEPTH_Y;
    isoCard(o, b, palette, fonts, { x, y, w: cardW, h: slotH - DEPTH_Y - 28 });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, H - ctaH, ctaH);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark isometric cityscape of glowing cubes, deep navy, subtle, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: DARK_BASE, direction: 'diagonal', intensity: 0.8 }));
  o.push(...dotGrid({ x: 1720, y: 96, cols: 6, rows: 5, gap: 42, dotR: 4, color: palette.primary, intensity: 0.9 }));

  headlineZone(o, content, palette, fonts, {
    x: 80, y: 84, w: 1840, headBudget: 240, maxSize: 110
  });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const ctaH = 136;
  const gap = 28;
  const colW = Math.floor((W - 160 - gap * (n - 1)) / n);
  const frontW = colW - DEPTH_X;
  const stagger = 34;
  const baseTop = 508;
  const frontH = H - ctaH - 40 - baseTop - stagger * (n - 1) - DEPTH_Y;
  blocks.forEach((b, i) => {
    const x = 80 + i * (colW + gap);
    const y = baseTop + i * stagger + DEPTH_Y;
    isoCard(o, b, palette, fonts, { x, y, w: frontW, h: frontH });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, H - ctaH, ctaH);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvBars({ x: pv(96), y: pv(115), w: pv(1100), lines: 2, barH: 9, gap: 5, fill: DARK_INK })
  ];
  for (let i = 0; i < 4; i++) {
    const x = 84 + i * 84;
    const y = 560 + i * 316 + DEPTH_Y;
    const w = 1010; const h = 260;
    parts.push(pvPoly([
      { x: pv(x), y: pv(y) }, { x: pv(x + DEPTH_X), y: pv(y - DEPTH_Y) },
      { x: pv(x + w + DEPTH_X), y: pv(y - DEPTH_Y) }, { x: pv(x + w), y: pv(y) }
    ], palette.primary));
    parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), DARK_PANEL, { rx: 0.5, stroke: palette.primary }));
    parts.push(pvRect(pv(x), pv(y), pv(10), pv(h), palette.accent));
    parts.push(pvBars({ x: pv(x + 40), y: pv(y + 40), w: pv(w * 0.4), lines: 1, barH: 5, gap: 3, fill: palette.primary }));
    parts.push(pvBars({ x: pv(x + 40), y: pv(y + 110), w: pv(w - 80), lines: 2, barH: 4, gap: 3, fill: DARK_INK_DIM }));
  }
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvBars({ x: pv(80), y: pv(100), w: pv(1840), lines: 2, barH: 9, gap: 5, fill: DARK_INK })
  ];
  const colW = Math.floor((2000 - 160 - 84) / 4);
  for (let i = 0; i < 4; i++) {
    const x = 80 + i * (colW + 28);
    const y = 508 + i * 34 + DEPTH_Y;
    const w = colW - DEPTH_X; const h = 620;
    parts.push(pvPoly([
      { x: pv(x), y: pv(y) }, { x: pv(x + DEPTH_X), y: pv(y - DEPTH_Y) },
      { x: pv(x + w + DEPTH_X), y: pv(y - DEPTH_Y) }, { x: pv(x + w), y: pv(y) }
    ], palette.primary));
    parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), DARK_PANEL, { rx: 0.5, stroke: palette.primary }));
    parts.push(pvRect(pv(x), pv(y), pv(10), pv(h), palette.accent));
    parts.push(pvBars({ x: pv(x + 30), y: pv(y + 36), w: pv(w * 0.55), lines: 1, barH: 5, gap: 3, fill: palette.primary }));
    parts.push(pvBars({ x: pv(x + 30), y: pv(y + 110), w: pv(w - 60), lines: 3, barH: 4, gap: 3, fill: DARK_INK_DIM }));
  }
  parts.push(pvRect(0, pv(1278), 283, pv(136), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'iso-grid',
  name: 'Isometric grid',
  style: 'infographic',
  description: 'Isometric card grid: each step is a 3D-looking slab with a brand-colour top face, shaded side face and soft drop shadow, staggered diagonally across a dark dashboard base — portrait steps the slabs rightward as they descend, landscape steps a four-across row downward.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'sequence', min: 3, max: 4, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
