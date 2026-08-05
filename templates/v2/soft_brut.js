// v2 template — soft-brut (style: bullet). M1 modern family: refined
// neo-brutalism on a LIGHT warm canvas — thick 3px dark outlines, hard 8px
// offset solid shadows behind every card, flat accent/primary color blocks,
// chunky rounded corners (rx 20) and numbered squares. Modern and friendly:
// the brutal shadow language is softened by generous padding and a warm
// paper field. Portrait stacks the numbered cards under the headline;
// landscape is a REAL relayout — headline + CTA column left, card stack
// right. All text measured via fitTextBlock so stress copy shrinks in place.

import {
  textbox, rect, backgroundImageSlot,
  fitTextBlock, pickTextColor,
  pv, pvRect, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO, PV_LAND_W, PV_LAND_H,
  legibilityScrim
} from './decor.js';

const R = 20;        // chunky rounded corners
const SHADOW = 8;    // hard offset solid shadow
const SQ = 88;       // numbered square size
const PAD = 40;      // card inner padding

const BG_HINT = 'warm flat paper background, subtle riso print texture, bold minimal shapes, no text';

/** One numbered brut card: hard shadow, thick outline, flat number square. */
function brutCard(o, b, i, palette, fonts, { x, y, w, h }) {
  const textX = x + PAD + SQ + 32;
  const textW = w - (PAD + SQ + 32) - PAD;
  const fit = fitTextBlock(b.text, {
    width: textW, height: Math.max(52, h - PAD * 2), maxSize: 36, minSize: 15, lineHeight: 1.34
  });
  const cardH = Math.min(h, Math.round(Math.max(fit.height, SQ) + PAD * 2));

  o.push(rect({ x: x + SHADOW, y: y + SHADOW, w, h: cardH, fill: palette.dark, rx: R, layerRole: 'background', msgId: b.id }));
  o.push(rect({ x, y, w, h: cardH, fill: '#FFFFFF', rx: R, stroke: palette.dark, strokeWidth: 3, layerRole: 'background', msgId: b.id }));

  const sqFill = i % 2 === 0 ? palette.primary : palette.accent;
  o.push(rect({ x: x + PAD, y: y + PAD - 4, w: SQ, h: SQ, fill: sqFill, rx: 14, stroke: palette.dark, strokeWidth: 3, layerRole: 'background', msgId: b.id }));
  o.push(textbox({
    text: String(i + 1), x: x + PAD, y: y + PAD + 14, w: SQ, fontSize: 48,
    fontFamily: fonts.head, fontWeight: '900', fill: pickTextColor(sqFill),
    align: 'center', lineHeight: 1, layerRole: 'decor'
  }));

  o.push({
    ...textbox({
      text: b.text, x: textX, y: y + PAD, w: textW, fontSize: fit.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.34, layerRole: 'message', msgId: b.id, bgRef: '#FFFFFF'
    }),
    fieldRef: 'text'
  });
}

/** Chunky headline + subheadline + thick rule; returns flow cursor. */
function headZone(o, content, palette, fonts, { x, y, w, headMax, headBudget }) {
  const head = fitTextBlock(content.headline, {
    width: w, height: headBudget, maxSize: headMax, minSize: 44, lineHeight: 1.06
  });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark, lineHeight: 1.06,
    charSpacing: -20, layerRole: 'headline', bgRef: palette.background
  }));
  let cursor = y + head.height;
  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, { width: w, height: 100, maxSize: 34, minSize: 16, lineHeight: 1.32 });
    o.push(textbox({
      text: content.subheadline, x, y: Math.round(cursor + 24), w,
      fontSize: sub.fontSize, fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.32, layerRole: 'subheadline', bgRef: palette.background
    }));
    cursor += 24 + sub.height;
  }
  o.push(rect({ x, y: Math.round(cursor + 32), w: 200, h: 10, fill: palette.dark, rx: 5, layerRole: 'decor' }));
  return Math.round(cursor + 42);
}

/** Flat decorative brut squares (accent + primary, offset shadows). */
function brutSquares(o, palette, { x, y, size = 64 }) {
  o.push(rect({ x: x + 6, y: y + 6, w: size, h: size, fill: palette.dark, rx: 14, layerRole: 'decor' }));
  o.push(rect({ x, y, w: size, h: size, fill: palette.accent, rx: 14, stroke: palette.dark, strokeWidth: 3, layerRole: 'decor' }));
  o.push(rect({ x: x + size + 30, y: y + 32, w: size, h: size, fill: palette.dark, rx: 14, layerRole: 'decor' }));
  o.push(rect({ x: x + size + 24, y: y + 26, w: size, h: size, fill: palette.primary, rx: 14, stroke: palette.dark, strokeWidth: 3, layerRole: 'decor' }));
}

/** Brut CTA: primary pill with dark outline + hard shadow; returns its top y. */
function ctaBrut(o, content, palette, fonts, { x, w, bottom }) {
  const innerW = w - 100;
  const fit = fitTextBlock(content.callToAction, { width: innerW, height: 96, maxSize: 40, minSize: 18, lineHeight: 1.2 });
  const pillH = Math.round(fit.height + 56);
  const y = bottom - SHADOW - pillH;
  o.push(rect({ x: x + SHADOW, y: y + SHADOW, w, h: pillH, fill: palette.dark, rx: R, layerRole: 'background' }));
  o.push(rect({ x, y, w, h: pillH, fill: palette.primary, rx: R, stroke: palette.dark, strokeWidth: 3, layerRole: 'background' }));
  o.push(textbox({
    text: content.callToAction, x: x + 50, y: y + 28, w: innerW, fontSize: fit.fontSize,
    fontFamily: fonts.head, fontWeight: '800', fill: pickTextColor(palette.primary),
    align: 'center', lineHeight: 1.2, layerRole: 'cta', bgRef: palette.primary
  }));
  return y;
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.background);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  // LIGHT scrim (paper-colored): this design reads dark-on-warm-paper — the
  // wash must lighten a filled background image, not darken it; the default
  // dark scrim would turn the warm field muddy grey.
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  const M = 96;
  const innerW = W - M * 2;
  brutSquares(o, palette, { x: W - M - 170, y: 116 });
  const cursor = headZone(o, content, palette, fonts, { x: M, y: 120, w: innerW - 220, headMax: 116, headBudget: 280 });

  const ctaY = ctaBrut(o, content, palette, fonts, { x: M + 60, w: innerW - 120, bottom: H - 96 });

  const blocks = content.blocks || [];
  const top = Math.max(cursor + 60, 640);
  const areaH = ctaY - 56 - top;
  const n = Math.max(blocks.length, 1);
  const slotH = areaH / n;
  blocks.forEach((b, i) => {
    brutCard(o, b, i, palette, fonts, {
      x: M, y: Math.round(top + i * slotH), w: innerW, h: Math.round(slotH - 28)
    });
  });
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.background);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  // LIGHT scrim (paper-colored) — see portrait note; light design contract.
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  const M = 96;
  const colW = 700;
  const cursor = headZone(o, content, palette, fonts, { x: M, y: 110, w: colW, headMax: 104, headBudget: 460 });
  brutSquares(o, palette, { x: M, y: Math.min(cursor + 60, 900) });
  ctaBrut(o, content, palette, fonts, { x: M, w: 640, bottom: H - 96 });

  const blocks = content.blocks || [];
  const gx = M + colW + 60;
  const gw = W - gx - M;
  const top = 100;
  const areaH = H - 100 - top;
  const n = Math.max(blocks.length, 1);
  const slotH = areaH / n;
  blocks.forEach((b, i) => {
    brutCard(o, b, i, palette, fonts, {
      x: gx, y: Math.round(top + i * slotH), w: gw, h: Math.round(slotH - 28)
    });
  });
  return canvas;
}

function pvCard(parts, palette, { x, y, w, h }, i) {
  parts.push(pvRect(pv(x + SHADOW), pv(y + SHADOW), pv(w), pv(h), palette.dark, { rx: 2.8 }));
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), '#FFFFFF', { rx: 2.8, stroke: palette.dark }));
  parts.push(pvRect(pv(x + 40), pv(y + 36), pv(SQ), pv(SQ), i % 2 === 0 ? palette.primary : palette.accent, { rx: 2, stroke: palette.dark }));
  parts.push(pvBars({ x: pv(x + 160), y: pv(y + 44), w: pv(w - 210), lines: 2, barH: 6, gap: 4, fill: palette.dark }));
}

function previewPortrait(palette) {
  const parts = [
    pvBars({ x: pv(96), y: pv(140), w: pv(1000), lines: 2, barH: 14, gap: 7, fill: palette.dark }),
    pvRect(pv(1160), pv(122), pv(64), pv(64), palette.accent, { rx: 2, stroke: palette.dark }),
    pvRect(pv(1250), pv(148), pv(64), pv(64), palette.primary, { rx: 2, stroke: palette.dark }),
    pvRect(pv(96), pv(500), pv(200), pv(10), palette.dark, { rx: 0.8 })
  ];
  for (let i = 0; i < 4; i++) pvCard(parts, palette, { x: 96, y: 640 + i * 270, w: 1222, h: 236 }, i);
  parts.push(pvRect(pv(156), pv(1766), pv(1102), pv(134), palette.primary, { rx: 2.8, stroke: palette.dark }));
  parts.push(pvBars({ x: pv(300), y: pv(1818), w: pv(814), lines: 1, barH: 6, gap: 4, fill: pickTextColor(palette.primary), align: 'center' }));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvBars({ x: pv(96), y: pv(130), w: pv(700), lines: 3, barH: 12, gap: 6, fill: palette.dark }),
    pvRect(pv(96), pv(560), pv(200), pv(10), palette.dark, { rx: 0.8 }),
    pvRect(pv(96), pv(680), pv(64), pv(64), palette.accent, { rx: 2, stroke: palette.dark }),
    pvRect(pv(186), pv(706), pv(64), pv(64), palette.primary, { rx: 2, stroke: palette.dark }),
    pvRect(pv(96), pv(1176), pv(640), pv(132), palette.primary, { rx: 2.8, stroke: palette.dark })
  ];
  for (let i = 0; i < 4; i++) pvCard(parts, palette, { x: 856, y: 100 + i * 303, w: 1048, h: 268 }, i);
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'soft-brut',
  name: 'Soft brut',
  style: 'bullet',
  description: 'Refined neo-brutalism on a warm light canvas: white cards with thick dark outlines, hard offset solid shadows, flat accent color blocks, chunky rounded corners and numbered squares — modern and friendly. Card stack under the headline in portrait; headline + CTA column beside the stack in landscape.',
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
