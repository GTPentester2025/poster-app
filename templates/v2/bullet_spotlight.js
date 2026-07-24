// v2 template — bullet-spotlight (style: bullet). Dark-theme bullet poster:
// the canvas is the brand secondary (near-black by default), light text, and
// every bullet lives on a glowing card — a soft radial bloom behind a dark
// rounded card with a thin brand-primary stroke. No image slot: the glow IS
// the visual. Decor = diagonal light beams + a quiet dot grid. Portrait
// stacks the cards; landscape lays them out as one horizontal card row.
//
// 2026 redesign: elevated card depth with DARK_PANEL fills, oversized accent
// numerals in cards, refined light beams + mesh glow atmosphere, richer
// typographic weight contrast.

import {
  textbox, rect, chip, pickTextColor,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, lightBeams, dotGrid, meshGlow,
  DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM,
  svgWrapO, PV_LAND_W,
  legibilityScrim,
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
  const ink = pickTextColor(palette.secondary);
  const headSize = fitFontSize(content.headline, { width: w, height: 300, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: ink,
    lineHeight: 1.06,
    layerRole: 'headline', bgRef: palette.secondary
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.06) + 28;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: subMaxH, maxSize: 40, minSize: 28, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor,
      w, fontSize: subSize, fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
      lineHeight: 1.35,
      layerRole: 'subheadline', bgRef: palette.secondary
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.35) + 24;
  }
  return cursor;
}

/**
 * One glowing card: mesh bloom + dark card + oversized accent numeral +
 * chip label (fieldRef 'label') + light body text (fieldRef 'text').
 */
function spotlightCard(o, b, i, palette, fonts, { x, y, w, h }) {
  // glow bloom behind the card
  o.push(...meshGlow({ spots: [
    { x: Math.round(x + w * 0.35), y: Math.round(y + h * 0.5), r: Math.round(Math.min(w * 0.55, h * 0.65)), color: palette.primary }
  ], intensity: 0.65 }));

  // dark panel card
  const cardFill = DARK_PANEL;
  o.push(rect({
    x, y, w, h, fill: cardFill, rx: 24,
    stroke: palette.primary, strokeWidth: 2, layerRole: 'background', msgId: b.id
  }));

  // oversized step numeral (decorative — NOT bound as a block field)
  o.push(textbox({
    text: String(i + 1).padStart(2, '0'), x: x + w - 100, y: y + 16, w: 86,
    fontSize: 72, fontFamily: fonts.head, fontWeight: '900',
    fill: palette.primary, align: 'right', lineHeight: 1,
    layerRole: 'decor', bgRef: cardFill
  }));

  let textY = y + 28;
  if (b.label) {
    const chipBudgetH = Math.round(h * 0.32);
    const [pill, labelTb] = chip({
      text: b.label, x: x + 36, y: textY, fontSize: 24,
      bg: palette.primary, color: pickTextColor(palette.primary), font: fonts.head, msgId: b.id,
      maxW: w - 72, maxH: chipBudgetH
    });
    o.push(pill, { ...labelTb, fieldRef: 'label', bgRef: palette.primary });
    textY += pill.height + 12;
  }
  const textW = w - 72;
  const size = fitFontSize(b.text, {
    width: textW, height: Math.max(84, y + h - textY - 28), maxSize: 44, minSize: 20
  });
  o.push({
    ...textbox({
      text: b.text, x: x + 36, y: textY, w: textW, fontSize: size,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
      lineHeight: 1.4,
      layerRole: 'message', msgId: b.id, bgRef: cardFill
    }),
    fieldRef: 'text'
  });
}

// ── portrait build ────────────────────────────────────────────────────────────

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.secondary);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...lightBeams({ w: W, h: H, color: palette.primary, count: 3, intensity: 0.75 }));
  o.push(...dotGrid({ x: 1100, y: 160, cols: 4, rows: 5, gap: 52, dotR: 4, color: palette.primary, intensity: 0.6 }));

  const hCursor = headlineZone(o, content, palette, fonts, { x: 96, y: 112, w: 1040, maxSize: 108 });

  const blocks = content.blocks || [];
  const top = Math.max(560, hCursor + 16);
  const bottom = 1800;
  const blockH = (bottom - top) / Math.max(blocks.length, 1);

  blocks.forEach((b, i) => {
    spotlightCard(o, b, i, palette, fonts, {
      x: 96, y: Math.round(top + i * blockH), w: W - 192, h: Math.round(blockH - 32)
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1848);
  return canvas;
}

// ── landscape build ───────────────────────────────────────────────────────────

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.secondary);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...lightBeams({ w: W, h: H, color: palette.primary, count: 3, intensity: 0.75 }));
  o.push(...dotGrid({ x: 1700, y: 120, cols: 4, rows: 4, gap: 52, dotR: 4, color: palette.primary, intensity: 0.6 }));

  const lsCursor = headlineZone(o, content, palette, fonts, { x: 96, y: 104, w: 1560, maxSize: 96 });

  // one horizontal card row — real relayout
  const blocks = content.blocks || [];
  const left = 96;
  const colW = (1904 - left) / Math.max(blocks.length, 1);
  const cardTop = Math.max(488, lsCursor + 16);
  const cardH = Math.max(240, 1262 - 144 - cardTop - 24);

  blocks.forEach((b, i) => {
    spotlightCard(o, b, i, palette, fonts, {
      x: Math.round(left + i * colW), y: cardTop, w: Math.round(colW - 24), h: cardH
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1262);
  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────

function pvCard(parts, palette, { x, y, w, h }) {
  const ink = pickTextColor(palette.dark);
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), DARK_PANEL, { rx: 4, stroke: palette.primary }));
  parts.push(pvRect(pv(x + 36), pv(y + 26), pv(130), 4, palette.primary, { rx: 2 }));
  parts.push(pvBars({ x: pv(x + 36), y: pv(y + 96), w: pv(w - 72), lines: 2, barH: 4.5, gap: 3, fill: ink }));
}

function previewPortrait(palette) {
  const ink = pickTextColor(palette.secondary);
  const parts = [
    pvRect(pv(180), pv(-200), pv(200), pv(2600), palette.primary, { opacity: 0.05 }),
    pvBars({ x: pv(96), y: pv(128), w: pv(1040), lines: 2, barH: 8, gap: 5, fill: ink })
  ];
  for (let i = 0; i < 4; i++) pvCard(parts, palette, { x: 96, y: 564 + i * 309, w: 1222, h: 277 });
  parts.push(pvRect(0, pv(1848), 200, pv(152), palette.dark));
  return svgWrapO(parts, palette.secondary, 'portrait');
}

function previewLandscape(palette) {
  const ink = pickTextColor(palette.secondary);
  const parts = [
    pvRect(pv(240), pv(-200), pv(200), pv(2000), palette.primary, { opacity: 0.05 }),
    pvBars({ x: pv(96), y: pv(118), w: pv(1560), lines: 2, barH: 8, gap: 5, fill: ink })
  ];
  for (let i = 0; i < 4; i++) pvCard(parts, palette, { x: 96 + i * 452, y: 488, w: 428, h: 680 });
  parts.push(pvRect(0, pv(1262), PV_LAND_W, pv(152), palette.dark));
  return svgWrapO(parts, palette.secondary, 'landscape');
}

export default {
  id: 'bullet-spotlight',
  name: 'Bullet spotlight',
  style: 'bullet',
  description: 'Dark-theme bullet poster — each point sits on a glowing card with a soft light bloom, light text on the brand secondary. Stacked cards in portrait, one horizontal card row in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'sequence', min: 3, max: 5, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
