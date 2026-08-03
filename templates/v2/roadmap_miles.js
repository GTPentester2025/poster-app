// v2 template — roadmap-miles (style: timeline). A milestone road: a wide
// rounded roadway with a dashed centre line runs through the poster, numbered
// milestone badges sit ON the road, and each step's card alternates sides so
// the eye zig-zags along the journey. Portrait: vertical road, cards left/
// right. Landscape: REAL relayout — horizontal road across the middle, cards
// alternating above/below. Cards are measured (fitTextBlock) inside fixed
// per-milestone slots, so stress content shrinks type instead of colliding.

import {
  textbox, rect, circle, backgroundImageSlot,
  fitTextBlock, pickTextColor,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO, PV_LAND_W, PV_LAND_H,
  legibilityScrim
} from './decor.js';

const ROAD_W = 72;         // roadway thickness
const DASH_L = 34;         // centre-line dash length
const BADGE_R = 46;        // milestone badge radius
const CARD_PAD = 40;

/** Dashed centre line along the road (vertical or horizontal). */
function centerDashes(o, palette, { x, y, len, vertical }) {
  const step = DASH_L * 2;
  for (let d = DASH_L / 2; d + DASH_L < len; d += step) {
    o.push(rect(vertical
      ? { x: x - 4, y: y + d, w: 8, h: DASH_L, fill: pickTextColor(palette.dark), opacity: 0.7, rx: 4, layerRole: 'decor' }
      : { x: x + d, y: y - 4, w: DASH_L, h: 8, fill: pickTextColor(palette.dark), opacity: 0.7, rx: 4, layerRole: 'decor' }));
  }
}

/** Numbered milestone badge centred on (cx, cy). */
function badge(o, i, palette, fonts, cx, cy) {
  o.push(circle({ x: cx, y: cy, r: BADGE_R + 8, fill: palette.background, opacity: 0.9 }));
  o.push(circle({ x: cx, y: cy, r: BADGE_R, fill: palette.primary, stroke: palette.background, strokeWidth: 4 }));
  o.push(textbox({
    text: String(i + 1), x: cx - BADGE_R, y: cy - 30, w: BADGE_R * 2, fontSize: 46,
    fontFamily: fonts.head, fontWeight: '900', fill: pickTextColor(palette.primary),
    align: 'center', lineHeight: 1.1, layerRole: 'decor'
  }));
}

/** One milestone card (label + text) fitted inside a fixed slot budget. */
function card(o, b, palette, fonts, { x, y, w, h }) {
  const innerW = w - CARD_PAD * 2;
  const labelFit = b.label
    ? fitTextBlock(b.label, { width: innerW, height: 54, maxSize: 34, minSize: 16, lineHeight: 1.15 })
    : null;
  const labelSpace = labelFit ? labelFit.height + 14 : 0;
  const textFit = fitTextBlock(b.text, {
    width: innerW, height: Math.max(50, h - CARD_PAD * 2 - labelSpace), maxSize: 34, minSize: 14, lineHeight: 1.3
  });
  const cardH = Math.min(h, Math.round(CARD_PAD * 2 + labelSpace + textFit.height));
  const top = Math.round(y + (h - cardH) / 2);

  o.push(rect({ x: x + 6, y: top + 6, w, h: cardH, fill: palette.dark, opacity: 0.14, rx: 20, layerRole: 'background', msgId: b.id }));
  o.push(rect({ x, y: top, w, h: cardH, fill: '#FFFFFF', rx: 20, layerRole: 'background', msgId: b.id }));
  o.push(rect({ x, y: top + 14, w: 10, h: cardH - 28, fill: palette.accent, rx: 5, layerRole: 'decor' }));

  let cursor = top + CARD_PAD;
  if (labelFit) {
    o.push({
      ...textbox({
        text: b.label, x: x + CARD_PAD, y: cursor, w: innerW, fontSize: labelFit.fontSize,
        fontFamily: fonts.head, fontWeight: '800', fill: palette.accent, charSpacing: 40,
        lineHeight: 1.15, layerRole: 'message-label', msgId: b.id, bgRef: '#FFFFFF'
      }),
      fieldRef: 'label'
    });
    cursor += labelSpace;
  }
  o.push({
    ...textbox({
      text: b.text, x: x + CARD_PAD, y: cursor, w: innerW, fontSize: textFit.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.3, layerRole: 'message', msgId: b.id, bgRef: '#FFFFFF'
    }),
    fieldRef: 'text'
  });
}

/** Headline (+optional subheadline) block; returns the y where content may start. */
function headlineBlock(o, content, palette, fonts, { x, y, w, headMax, headBudget }) {
  const head = fitTextBlock(content.headline, { width: w, height: headBudget, maxSize: headMax, minSize: 44, lineHeight: 1.05 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: pickTextColor(palette.dark),
    lineHeight: 1.05, layerRole: 'headline', bgRef: palette.dark
  }));
  let cursor = y + head.height;
  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, { width: w, height: 96, maxSize: 34, minSize: 16, lineHeight: 1.3 });
    o.push(textbox({
      text: content.subheadline, x, y: Math.round(cursor + 18), w,
      fontSize: sub.fontSize, fontFamily: fonts.body, fontWeight: '600', fill: palette.primary,
      lineHeight: 1.3, layerRole: 'subheadline', bgRef: palette.dark
    }));
    cursor += 18 + sub.height;
  }
  return Math.round(cursor);
}

function ctaBar(o, content, palette, fonts, { W, y, h }) {
  o.push(rect({ x: 0, y, w: W, h, fill: palette.dark, layerRole: 'background' }));
  const cta = fitTextBlock(content.callToAction, { width: W - 240, height: h - 44, maxSize: 42, minSize: 24, lineHeight: 1.2 });
  o.push(textbox({
    text: content.callToAction, x: 120, y: Math.round(y + (h - cta.height) / 2), w: W - 240,
    fontSize: cta.fontSize, fontFamily: fonts.head, fontWeight: '800',
    fill: pickTextColor(palette.dark), align: 'center', lineHeight: 1.2,
    layerRole: 'cta', bgRef: palette.dark
  }));
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.dark);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'aerial dusk view of a winding road through dark terrain, moody atmosphere, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  const M = 96;
  const contentTop = headlineBlock(o, content, palette, fonts, {
    x: M, y: 104, w: W - M * 2, headMax: 104, headBudget: 300
  });

  const ctaH = 150;
  const roadTop = Math.max(contentTop + 56, 560);
  const roadBottom = H - ctaH - 48;
  const roadX = Math.round(W / 2);

  // roadway + centre line
  o.push(rect({ x: roadX - ROAD_W / 2, y: roadTop, w: ROAD_W, h: roadBottom - roadTop, fill: palette.dark, opacity: 0.85, rx: ROAD_W / 2, layerRole: 'decor' }));
  centerDashes(o, palette, { x: roadX, y: roadTop + 30, len: roadBottom - roadTop - 60, vertical: true });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const slotH = (roadBottom - roadTop) / n;
  const cardW = Math.round(W / 2 - ROAD_W / 2 - M - 44);
  blocks.forEach((b, i) => {
    const cy = Math.round(roadTop + slotH * (i + 0.5));
    badge(o, i, palette, fonts, roadX, cy);
    const left = i % 2 === 0;
    card(o, b, palette, fonts, {
      x: left ? M : roadX + ROAD_W / 2 + 44,
      y: Math.round(roadTop + slotH * i + 8), w: cardW, h: Math.round(slotH - 16)
    });
  });

  ctaBar(o, content, palette, fonts, { W, y: H - ctaH, h: ctaH });
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.dark);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'aerial dusk view of a winding road through dark terrain, moody atmosphere, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  const M = 90;
  headlineBlock(o, content, palette, fonts, {
    x: M, y: 84, w: W - M * 2, headMax: 84, headBudget: 210
  });

  const ctaH = 136;
  const roadY = Math.round(H * 0.55);
  // roadway + centre line
  o.push(rect({ x: M, y: roadY - ROAD_W / 2, w: W - M * 2, h: ROAD_W, fill: palette.dark, opacity: 0.85, rx: ROAD_W / 2, layerRole: 'decor' }));
  centerDashes(o, palette, { x: M + 30, y: roadY, len: W - M * 2 - 60, vertical: false });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const slotW = (W - M * 2) / n;
  const bandH = 330;
  const aboveY = roadY - ROAD_W / 2 - 24 - bandH;
  const belowY = roadY + ROAD_W / 2 + 24;
  blocks.forEach((b, i) => {
    const cx = Math.round(M + slotW * (i + 0.5));
    badge(o, i, palette, fonts, cx, roadY);
    const above = i % 2 === 0;
    card(o, b, palette, fonts, {
      x: Math.round(M + slotW * i + 14), y: above ? aboveY : belowY,
      w: Math.round(slotW - 28), h: bandH
    });
  });

  ctaBar(o, content, palette, fonts, { W, y: H - ctaH, h: ctaH });
  return canvas;
}

function previewPortrait(palette) {
  const roadX = pv(707);
  const parts = [
    pvBars({ x: pv(96), y: pv(120), w: pv(1222), lines: 2, barH: 13, gap: 7, fill: pickTextColor(palette.dark) }),
    pvRect(roadX - pv(36), pv(560), pv(72), pv(1240), palette.dark, { rx: 5, opacity: 0.85 })
  ];
  for (let i = 0; i < 4; i++) {
    const cy = 560 + 310 * (i + 0.5);
    parts.push(pvCircle(roadX, pv(cy), pv(46), palette.primary));
    const left = i % 2 === 0;
    const x = left ? pv(96) : roadX + pv(80);
    parts.push(pvRect(x, pv(cy - 120), pv(500), pv(240), '#FFFFFF', { rx: 3 }));
    parts.push(pvRect(x, pv(cy - 106), pv(10), pv(212), palette.accent, { rx: 1 }));
    parts.push(pvBars({ x: x + pv(40), y: pv(cy - 80), w: pv(420), lines: 3, barH: 5, gap: 4, fill: palette.dark }));
  }
  parts.push(pvRect(0, pv(1850), 200, pv(150), palette.dark));
  parts.push(pvBars({ x: pv(300), y: pv(1905), w: pv(814), lines: 1, barH: 6, gap: 4, fill: pickTextColor(palette.dark), align: 'center' }));
  return svgWrapO(parts, palette.dark, 'portrait');
}

function previewLandscape(palette) {
  const roadY = pv(778);
  const parts = [
    pvBars({ x: pv(90), y: pv(96), w: pv(1000), lines: 2, barH: 11, gap: 6, fill: pickTextColor(palette.dark) }),
    pvRect(pv(90), roadY - pv(36), pv(1820), pv(72), palette.dark, { rx: 5, opacity: 0.85 })
  ];
  for (let i = 0; i < 4; i++) {
    const cx = 90 + 455 * (i + 0.5);
    parts.push(pvCircle(pv(cx), roadY, pv(46), palette.primary));
    const above = i % 2 === 0;
    const y = above ? pv(400) : roadY + pv(60);
    parts.push(pvRect(pv(cx - 200), y, pv(400), pv(300), '#FFFFFF', { rx: 3 }));
    parts.push(pvBars({ x: pv(cx - 160), y: y + pv(50), w: pv(320), lines: 3, barH: 5, gap: 4, fill: palette.dark }));
  }
  parts.push(pvRect(0, pv(1278), PV_LAND_W, pv(136), palette.dark));
  return svgWrapO(parts, palette.dark, 'landscape');
}

export default {
  id: 'roadmap-miles',
  name: 'Milestone road',
  style: 'timeline',
  description: 'A milestone roadway: a rounded road with a dashed centre line runs through the poster, numbered badges mark each step, and step cards alternate sides so the journey zig-zags. Vertical road with left/right cards in portrait; horizontal road with above/below cards in landscape.',
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
