// v2 template — statement-bold (style: statement). One massive typographic
// statement carries the whole poster: a single block {text} set huge in the
// heading face against a thick accent rule, with the headline as kicker and
// the subheadline as support. No image slot — type IS the image.
//
// 2026 redesign: deep near-black canvas (DARK_BASE), warm off-white headline
// (DARK_INK), oversized accent vertical rule (16px wide, full statement height),
// mesh glow behind the statement zone, off-canvas signal-arc ripple for depth,
// generous 96px left margin with the rule indented to 130px. The statement text
// itself uses the full 190px max in portrait, 160px in landscape.

import {
  textbox, rect, vline,
  fitFontSize, estTextHeight,
  pv, pvRect, pvCircle, pvBars,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, signalArcs, softGlow, meshGlow,
  svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM,
  legibilityScrim,
} from './decor.js';

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_PANEL, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: palette.accent, opacity: 0.18, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 176, height: 96, maxSize: 46, minSize: 30 });
  o.push(textbox({
    text, x: 88, y: y + Math.round((144 - estTextHeight(text, size, W - 176)) / 2),
    w: W - 176, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 300, maxSize, minSize: 40 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    lineHeight: 1.06, layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.06) + 22;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 40, minSize: 28, lineHeight: 1.4 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM,
      lineHeight: 1.4, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.4) + 18;
  }
  return cursor;
}

/** The hero statement: oversized heading-face type against a thick accent rule. */
function statement(o, b, palette, fonts, { x, w, y, budgetH, maxSize }) {
  const size = fitFontSize(b.text, { width: w, height: budgetH, maxSize, minSize: 28 });
  const textH = Math.round(estTextHeight(b.text, size, w, 1.08));
  // thick accent vertical rule (16px) — full statement height
  o.push(vline({
    x: x - 40, y, h: Math.min(budgetH, textH), thickness: 16, fill: palette.accent, layerRole: 'decor'
  }));
  // soft glow bloom behind the statement text
  o.push(...softGlow({ x: Math.round(x + w / 2), y: Math.round(y + textH / 2), r: 400, color: palette.primary, intensity: 0.9 }));
  o.push({
    ...textbox({
      text: b.text, x, y, w, fontSize: size, lineHeight: 1.08,
      fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
      layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'text'
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // atmosphere: diagonal wash, huge ripple from bottom-right, corner glow
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'diagonal', intensity: 0.7 }));
  o.push(...signalArcs({ x: 1500, y: 1880, r: 780, rings: 5, color: palette.accent, strokeWidth: 14, intensity: 0.9 }));
  o.push(...meshGlow({
    spots: [
      { x: 700, y: 1060, r: 520, color: palette.primary },
      { x: W - 200, y: 400, r: 340, color: palette.accent }
    ],
    intensity: 0.9
  }));

  headlineZone(o, content, palette, fonts, { x: 96, y: 104, w: 1222, maxSize: 104 });

  const b = (content.blocks || [])[0];
  if (b) {
    // asymmetric: rule + statement at 130px left, generous right gutter
    statement(o, b, palette, fonts, { x: 170, w: 1110, y: 630, budgetH: 1070, maxSize: 190 });
  }

  ctaBar(o, content.callToAction, palette, fonts, W, 1856);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // statement weighted left 60%; glow + ripple own the right
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'horizontal', intensity: 0.7 }));
  o.push(...signalArcs({ x: 2080, y: 260, r: 700, rings: 5, color: palette.accent, strokeWidth: 14, intensity: 0.9 }));
  o.push(...meshGlow({
    spots: [
      { x: 1660, y: 840, r: 440, color: palette.primary },
      { x: W - 300, y: H - 200, r: 360, color: palette.accent }
    ],
    intensity: 0.9
  }));

  headlineZone(o, content, palette, fonts, { x: 96, y: 80, w: 1200, maxSize: 96 });

  const b = (content.blocks || [])[0];
  if (b) {
    statement(o, b, palette, fonts, { x: 170, w: 1080, y: 476, budgetH: 750, maxSize: 160 });
  }

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvCircle(pv(1500), pv(1880), pv(720), 'none', { stroke: palette.accent, opacity: 0.3 }),
    pvCircle(pv(1500), pv(1880), pv(480), 'none', { stroke: palette.accent, opacity: 0.2 }),
    pvCircle(pv(700), pv(1060), pv(520), palette.primary, { opacity: 0.07 }),
    pvBars({ x: pv(96), y: pv(120), w: pv(1222), lines: 2, barH: 8, gap: 5, fill: DARK_INK }),
    pvRect(pv(130), pv(630), 2.5, pv(760), palette.accent, { rx: 1 }),
    pvBars({ x: pv(170), y: pv(650), w: pv(1110), lines: 4, barH: 18, gap: 10, fill: DARK_INK }),
    pvRect(0, pv(1856), 200, pv(144), DARK_PANEL)
  ];
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvCircle(pv(2080), pv(260), pv(640), 'none', { stroke: palette.accent, opacity: 0.3 }),
    pvCircle(pv(1660), pv(840), pv(440), palette.primary, { opacity: 0.07 }),
    pvBars({ x: pv(96), y: pv(95), w: pv(1200), lines: 2, barH: 8, gap: 5, fill: DARK_INK }),
    pvRect(pv(130), pv(476), 2.5, pv(620), palette.accent, { rx: 1 }),
    pvBars({ x: pv(170), y: pv(496), w: pv(1080), lines: 4, barH: 15, gap: 8, fill: DARK_INK }),
    pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_PANEL)
  ];
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'statement-bold',
  name: 'Bold statement',
  style: 'statement',
  description: 'One massive typographic statement against a 16px accent rule and mesh-glow atmosphere on a near-black canvas — no image, type is the poster. Asymmetric in portrait, left-weighted 60% with the glow on the right in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'single', min: 1, max: 1, fields: ['text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
