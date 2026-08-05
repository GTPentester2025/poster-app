// v2 template — aurora-flow (style: statement). 2026 aurora atmosphere: a
// near-black canvas swept by three large soft mesh-gradient blooms
// (primary/accent, low opacity) flowing diagonally, with floating white
// rounded-2xl cards that step sideways across the canvas to follow the flow.
// Elastic measured headline, capsule CTA. Portrait: diagonal card cascade
// under the headline; landscape: REAL relayout — headline + CTA column left,
// card cascade right. Every card is measured (fitTextBlock) inside a fixed
// slot budget, so stress content shrinks type instead of colliding.

import {
  textbox, rect, circle, backgroundImageSlot,
  fitTextBlock, pickTextColor,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO,
  legibilityScrim, meshGlow, DARK_BASE, DARK_INK, DARK_INK_DIM
} from './decor.js';

const CARD_R = 32;        // rounded-2xl card corners
const CARD_PAD = 44;      // vertical text inset inside a card
const TEXT_INSET = 96;    // card left inset (aurora dot pair + gap)
const BG_HINT = 'aurora borealis night sky, flowing ribbons of color over dark landscape, dreamy soft gradients, no text';

/** One floating white card, offset x to follow the aurora flow. */
function flowCard(o, b, palette, fonts, { x, y, w, h }) {
  const innerW = w - TEXT_INSET - CARD_PAD;
  const fit = fitTextBlock(b.text, {
    width: innerW, height: Math.max(44, h - CARD_PAD * 2), maxSize: 40, minSize: 14, lineHeight: 1.32
  });
  const cardH = Math.max(120, Math.min(h, Math.round(CARD_PAD * 2 + fit.height)));
  const top = Math.round(y + (h - cardH) / 2);
  // soft shadow + paper-white card
  o.push(rect({ x: x + 10, y: top + 12, w, h: cardH, fill: '#000000', opacity: 0.3, rx: CARD_R, layerRole: 'background', msgId: b.id }));
  o.push(rect({ x, y: top, w, h: cardH, fill: '#FFFFFF', rx: CARD_R, layerRole: 'background', msgId: b.id }));
  // aurora dot pair — tiny echo of the mesh gradient on each card
  o.push(circle({ x: x + 46, y: top + Math.round(cardH / 2), r: 11, fill: palette.primary, layerRole: 'decor' }));
  o.push(circle({ x: x + 66, y: top + Math.round(cardH / 2), r: 7, fill: palette.accent, opacity: 0.85, layerRole: 'decor' }));
  o.push({
    ...textbox({
      text: b.text, x: x + TEXT_INSET, y: Math.round(top + (cardH - fit.height) / 2), w: innerW,
      fontSize: fit.fontSize, fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.32, layerRole: 'message', msgId: b.id, bgRef: '#FFFFFF'
    }),
    fieldRef: 'text'
  });
}

/** Solid capsule CTA anchored above bottomY; returns its top y. */
function ctaPill(o, text, palette, fonts, { cx, w, bottomY }) {
  const innerW = w - 120;
  const fit = fitTextBlock(text, { width: innerW, height: 120, maxSize: 40, minSize: 20, lineHeight: 1.2 });
  const pillH = Math.round(fit.height + 52);
  const y = Math.round(bottomY - pillH);
  const x = Math.round(cx - w / 2);
  o.push(rect({ x, y, w, h: pillH, fill: palette.primary, rx: Math.min(Math.round(pillH / 2), 60), layerRole: 'background' }));
  o.push(textbox({
    text, x: x + 60, y: Math.round(y + (pillH - fit.height) / 2), w: innerW,
    fontSize: fit.fontSize, fontFamily: fonts.head, fontWeight: '800',
    fill: pickTextColor(palette.primary), align: 'center', lineHeight: 1.2,
    layerRole: 'cta', bgRef: palette.primary
  }));
  return y;
}

/** Measured headline (+ optional subheadline); returns the y below them. */
function headlineFlow(o, content, fonts, { x, y, w, headBudget, headMax }) {
  const head = fitTextBlock(content.headline, { width: w, height: headBudget, maxSize: headMax, minSize: 52, lineHeight: 1.04 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    lineHeight: 1.04, layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + head.height;
  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, { width: w, height: 140, maxSize: 38, minSize: 16, lineHeight: 1.3 });
    o.push(textbox({
      text: content.subheadline, x, y: Math.round(cursor + 24), w,
      fontSize: sub.fontSize, fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
      lineHeight: 1.3, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += 24 + sub.height;
  }
  return Math.round(cursor);
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // aurora: three large soft blooms sweeping the diagonal
  o.push(...meshGlow({ spots: [
    { x: 1120, y: 320, r: 540, color: palette.primary },
    { x: 260, y: 1030, r: 500, color: palette.accent },
    { x: 1080, y: 1760, r: 430, color: palette.primary }
  ], intensity: 0.95 }));

  const M = 96;
  const cursor = headlineFlow(o, content, fonts, { x: M, y: 120, w: W - M * 2, headBudget: 360, headMax: 136 });

  const ctaTop = ctaPill(o, content.callToAction, palette, fonts, { cx: W / 2, w: 1030, bottomY: H - 56 });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const top = Math.max(cursor + 56, 620);
  const bottom = ctaTop - 44;
  const slotH = (bottom - top) / n;
  const cardW = 1010;
  const span = W - M * 2 - cardW; // horizontal travel of the cascade
  blocks.forEach((b, i) => {
    const x = Math.round(M + (n > 1 ? span * i / (n - 1) : span / 2));
    flowCard(o, b, palette, fonts, { x, y: Math.round(top + slotH * i + 8), w: cardW, h: Math.round(slotH - 16) });
  });
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({ spots: [
    { x: 420, y: 280, r: 500, color: palette.primary },
    { x: 1240, y: 860, r: 560, color: palette.accent },
    { x: 1840, y: 260, r: 400, color: palette.primary }
  ], intensity: 0.95 }));

  // left column: headline + CTA
  const M = 96;
  const colW = 640;
  headlineFlow(o, content, fonts, { x: M, y: 120, w: colW, headBudget: 430, headMax: 120 });
  ctaPill(o, content.callToAction, palette, fonts, { cx: M + colW / 2, w: colW, bottomY: H - 96 });

  // right: diagonal card cascade
  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const cardW = 1010;
  const x0 = 820;
  const span = W - M - cardW - x0;
  const top = 110;
  const bottom = H - 96;
  const slotH = (bottom - top) / n;
  blocks.forEach((b, i) => {
    const x = Math.round(x0 + (n > 1 ? span * i / (n - 1) : span / 2));
    flowCard(o, b, palette, fonts, { x, y: Math.round(top + slotH * i + 8), w: cardW, h: Math.round(slotH - 16) });
  });
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvCircle(pv(1120), pv(320), pv(540), palette.primary, { opacity: 0.09 }),
    pvCircle(pv(260), pv(1030), pv(500), palette.accent, { opacity: 0.08 }),
    pvCircle(pv(1080), pv(1760), pv(430), palette.primary, { opacity: 0.08 }),
    pvBars({ x: pv(96), y: pv(130), w: pv(1222), lines: 2, barH: 13, gap: 7, fill: DARK_INK })
  ];
  for (let i = 0; i < 4; i++) {
    const x = 96 + Math.round(212 * i / 3);
    const y = 640 + i * 290;
    parts.push(pvRect(pv(x), pv(y), pv(1010), pv(220), '#FFFFFF', { rx: 4 }));
    parts.push(pvCircle(pv(x + 46), pv(y + 110), pv(22), palette.primary));
    parts.push(pvBars({ x: pv(x + 96), y: pv(y + 60), w: pv(860), lines: 2, barH: 6, gap: 4, fill: '#1F1A17' }));
  }
  parts.push(pvRect(pv(192), pv(1830), pv(1030), pv(114), palette.primary, { rx: 8 }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvCircle(pv(420), pv(280), pv(500), palette.primary, { opacity: 0.09 }),
    pvCircle(pv(1240), pv(860), pv(560), palette.accent, { opacity: 0.08 }),
    pvCircle(pv(1840), pv(260), pv(400), palette.primary, { opacity: 0.08 }),
    pvBars({ x: pv(96), y: pv(140), w: pv(640), lines: 3, barH: 11, gap: 6, fill: DARK_INK }),
    pvRect(pv(96), pv(1180), pv(640), pv(110), palette.primary, { rx: 8 })
  ];
  for (let i = 0; i < 4; i++) {
    const x = 820 + Math.round(74 * i / 3);
    const y = 120 + i * 300;
    parts.push(pvRect(pv(x), pv(y), pv(1010), pv(230), '#FFFFFF', { rx: 4 }));
    parts.push(pvCircle(pv(x + 46), pv(y + 115), pv(22), palette.primary));
    parts.push(pvBars({ x: pv(x + 96), y: pv(y + 66), w: pv(860), lines: 2, barH: 6, gap: 4, fill: '#1F1A17' }));
  }
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'aurora-flow',
  name: 'Aurora flow',
  style: 'statement',
  description: 'Dark aurora atmosphere: large soft mesh-gradient blooms sweep the canvas diagonally while floating white rounded cards step sideways to follow the flow, capped by a capsule CTA. Diagonal cascade under the headline in portrait; headline + CTA column with a card cascade in landscape.',
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
