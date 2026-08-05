// v2 template — glass-layers (style: statement). M1 modern family: a dark
// luxe canvas with glassmorphism as the supporting accent — soft translucent
// white panels (0.05–0.11 opacity) with a hairline white stroke and an inner
// highlight line, stacked with slight alternating offsets over layered mesh
// glows. An elastic oversized headline owns the top; each block is a glass
// card with a glowing index dot; the CTA is a solid brand pill. Portrait
// stacks the cards under the headline; landscape is a REAL relayout —
// headline + CTA column left, glass card stack right. All text measured via
// fitTextBlock budgets so stress copy shrinks instead of colliding.

import {
  textbox, rect, circle, backgroundImageSlot,
  fitTextBlock, pickTextColor,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO, PV_LAND_W, PV_LAND_H,
  legibilityScrim, meshGlow,
  DARK_BASE, DARK_PANEL_2, DARK_INK, DARK_INK_DIM
} from './decor.js';

const CARD_R = 26;
const CARD_PAD = 44;
const NUM_ZONE = 104;   // index dot gutter inside a card

const BG_HINT = 'deep night atmosphere, blurred bokeh glass reflections, dark luxe gradients, no text';

/** Glass panel: ghost offset layer + translucent pane + hairline stroke + inner highlight. */
function glassPanel(o, { x, y, w, h, msgId = null }) {
  o.push(rect({ x: x + 16, y: y + 16, w, h, fill: '#FFFFFF', opacity: 0.05, rx: CARD_R, layerRole: 'background', msgId }));
  o.push(rect({ x, y, w, h, fill: '#FFFFFF', opacity: 0.11, rx: CARD_R, layerRole: 'background', msgId }));
  o.push(rect({ x, y, w, h, fill: 'transparent', rx: CARD_R, stroke: '#FFFFFF', strokeWidth: 1.5, opacity: 0.35, layerRole: 'background', msgId }));
  o.push(rect({ x: x + 28, y: y + 8, w: w - 56, h: 2, fill: '#FFFFFF', opacity: 0.4, rx: 1, layerRole: 'decor' }));
}

/** One glass card: glowing index dot + measured body text, centered in its slot. */
function glassCard(o, b, i, palette, fonts, { x, y, w, h }) {
  const textX = x + CARD_PAD + NUM_ZONE;
  const textW = w - CARD_PAD * 2 - NUM_ZONE;
  const fit = fitTextBlock(b.text, {
    width: textW, height: Math.max(56, h - CARD_PAD * 2), maxSize: 38, minSize: 16, lineHeight: 1.36
  });
  const cardH = Math.min(h, Math.round(Math.max(fit.height, 60) + CARD_PAD * 2));
  const top = Math.round(y + (h - cardH) / 2);
  glassPanel(o, { x, y: top, w, h: cardH, msgId: b.id });

  const cy = top + CARD_PAD + 26;
  o.push(circle({ x: x + CARD_PAD + 26, y: cy, r: 36, fill: palette.primary, opacity: 0.2, layerRole: 'decor' }));
  o.push(circle({ x: x + CARD_PAD + 26, y: cy, r: 24, fill: palette.primary, layerRole: 'decor' }));
  o.push(textbox({
    text: String(i + 1), x: x + CARD_PAD + 2, y: cy - 17, w: 48, fontSize: 30,
    fontFamily: fonts.head, fontWeight: '900', fill: pickTextColor(palette.primary),
    align: 'center', lineHeight: 1.1, layerRole: 'decor'
  }));

  o.push({
    ...textbox({
      text: b.text, x: textX, y: top + CARD_PAD, w: textW, fontSize: fit.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
      lineHeight: 1.36, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL_2
    }),
    fieldRef: 'text'
  });
}

/** Elastic headline + dim subheadline + thin accent rule; returns flow cursor. */
function headZone(o, content, palette, fonts, { x, y, w, headMax, headBudget }) {
  const head = fitTextBlock(content.headline, {
    width: w, height: headBudget, maxSize: headMax, minSize: 58, lineHeight: 1.02
  });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, lineHeight: 1.02,
    charSpacing: -25, layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + head.height;
  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, { width: w, height: 110, maxSize: 36, minSize: 16, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: Math.round(cursor + 26), w,
      fontSize: sub.fontSize, fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += 26 + sub.height;
  }
  o.push(rect({ x, y: Math.round(cursor + 30), w: 180, h: 4, fill: palette.primary, rx: 2, layerRole: 'decor' }));
  return Math.round(cursor + 34);
}

/** Solid brand CTA pill anchored to `bottom`; returns the pill's top y. */
function ctaPill(o, content, palette, fonts, { x, w, bottom }) {
  const innerW = w - 120;
  const fit = fitTextBlock(content.callToAction, { width: innerW, height: 100, maxSize: 40, minSize: 20, lineHeight: 1.2 });
  const pillH = Math.round(fit.height + 52);
  const y = bottom - pillH;
  o.push(rect({ x, y, w, h: pillH, fill: palette.primary, rx: Math.min(Math.round(pillH / 2), 44), layerRole: 'background' }));
  o.push(textbox({
    text: content.callToAction, x: x + 60, y: y + 26, w: innerW, fontSize: fit.fontSize,
    fontFamily: fonts.head, fontWeight: '800', fill: pickTextColor(palette.primary),
    align: 'center', lineHeight: 1.2, layerRole: 'cta', bgRef: palette.primary
  }));
  return y;
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  // dark design — the default dark scrim is the right wash here
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({
    spots: [
      { x: 1160, y: 320, r: 420, color: palette.primary },
      { x: 220, y: 1480, r: 380, color: palette.accent },
      { x: 1260, y: 1860, r: 300, color: palette.primary }
    ],
    intensity: 0.9
  }));

  const M = 100;
  const innerW = W - M * 2;
  const contentTop = headZone(o, content, palette, fonts, {
    x: M, y: 130, w: innerW, headMax: 168, headBudget: 440
  });

  const ctaY = ctaPill(o, content, palette, fonts, { x: M, w: innerW, bottom: H - 90 });

  const blocks = content.blocks || [];
  const top = Math.max(contentTop + 40, 730);
  const areaH = ctaY - 50 - top;
  const n = Math.max(blocks.length, 1);
  const slotH = areaH / n;
  blocks.forEach((b, i) => {
    glassCard(o, b, i, palette, fonts, {
      x: M + (i % 2) * 52, y: Math.round(top + i * slotH), w: innerW - 52, h: Math.round(slotH - 20)
    });
  });
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  // dark design — default dark scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({
    spots: [
      { x: 1780, y: 220, r: 380, color: palette.primary },
      { x: 200, y: 1220, r: 340, color: palette.accent },
      { x: 1100, y: 1350, r: 280, color: palette.primary }
    ],
    intensity: 0.9
  }));

  const M = 90;
  headZone(o, content, palette, fonts, {
    x: M, y: 120, w: 760, headMax: 150, headBudget: 560
  });
  ctaPill(o, content, palette, fonts, { x: M, w: 700, bottom: H - 90 });

  const blocks = content.blocks || [];
  const gx = 950;
  const gw = W - M - gx;
  const top = 100;
  const areaH = H - 100 - top;
  const n = Math.max(blocks.length, 1);
  const slotH = areaH / n;
  blocks.forEach((b, i) => {
    glassCard(o, b, i, palette, fonts, {
      x: gx + (i % 2) * 40, y: Math.round(top + i * slotH), w: gw - 40, h: Math.round(slotH - 20)
    });
  });
  return canvas;
}

function pvGlass(parts, palette, { x, y, w, h }) {
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), '#FFFFFF', { rx: 3.6, opacity: 0.11, stroke: '#FFFFFF' }));
  parts.push(pvCircle(pv(x + 70), pv(y + 70), pv(24), palette.primary));
  parts.push(pvBars({ x: pv(x + 148), y: pv(y + 48), w: pv(w - 200), lines: 2, barH: 6, gap: 4, fill: DARK_INK }));
}

function previewPortrait(palette) {
  const parts = [
    pvCircle(pv(1160), pv(320), pv(420), palette.primary, { opacity: 0.08 }),
    pvCircle(pv(220), pv(1480), pv(380), palette.accent, { opacity: 0.07 }),
    pvBars({ x: pv(100), y: pv(150), w: pv(1214), lines: 3, barH: 14, gap: 7, fill: DARK_INK }),
    pvRect(pv(100), pv(600), pv(180), pv(4), palette.primary, { rx: 0.6 })
  ];
  for (let i = 0; i < 4; i++) {
    pvGlass(parts, palette, { x: 100 + (i % 2) * 52, y: 740 + i * 260, w: 1162, h: 232 });
  }
  parts.push(pvRect(pv(100), pv(1794), pv(1214), pv(116), palette.primary, { rx: 4.1 }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvCircle(pv(1780), pv(220), pv(380), palette.primary, { opacity: 0.08 }),
    pvCircle(pv(200), pv(1220), pv(340), palette.accent, { opacity: 0.07 }),
    pvBars({ x: pv(90), y: pv(140), w: pv(760), lines: 4, barH: 12, gap: 6, fill: DARK_INK }),
    pvRect(pv(90), pv(1194), pv(700), pv(120), palette.primary, { rx: 4.2 })
  ];
  for (let i = 0; i < 4; i++) {
    pvGlass(parts, palette, { x: 950 + (i % 2) * 40, y: 110 + i * 303, w: 920, h: 270 });
  }
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'glass-layers',
  name: 'Glass layers',
  style: 'statement',
  description: 'Dark luxe glassmorphism: translucent white glass panels with hairline strokes and inner highlights stack with slight offsets over mesh glows, under an elastic oversized headline; each point is a glass card with a glowing index dot. Stacked cards in portrait; headline column plus card stack in landscape.',
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
