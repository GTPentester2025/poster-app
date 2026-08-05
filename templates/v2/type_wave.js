// v2 template — type-wave (style: statement). M1 modern family: an elastic
// typography hero on a LIGHT editorial canvas. The headline splits into two
// word-groups on alternating baselines — the second line is indented and
// carries a rounded accent highlight pill behind it. Blocks are minimal
// numbered lines with thin underline strokes and generous whitespace; big
// margins throughout. Portrait stacks hero over the numbered lines;
// landscape is a REAL relayout — hero + CTA left, numbered lines right.
// Both headline lines share one fitted size (min of the two fits) and the
// pill is sized from measured text, so stress copy shrinks in place.

import {
  textbox, rect, backgroundImageSlot,
  fitTextBlock, estTextHeight, estTextWidth, pickTextColor,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO, PV_LAND_W, PV_LAND_H,
  legibilityScrim, softGlow
} from './decor.js';

const BG_HINT = 'minimal bright studio backdrop, soft warm light, subtle grain, lots of empty space, no text';

/** Two-baseline elastic headline with an accent highlight pill behind line 2. */
function waveHeadline(o, content, palette, fonts, { x, y, w, indent, maxSize, budget }) {
  const words = String(content.headline).trim().split(/\s+/).filter(Boolean);
  const cut = Math.ceil(words.length / 2);
  const l1 = words.slice(0, cut).join(' ');
  const l2 = words.slice(cut).join(' ');
  const lineBudget = Math.round((budget - 20) / 2);

  const f1 = fitTextBlock(l1, { width: w, height: lineBudget, maxSize, minSize: 52, lineHeight: 1.04 });
  let size = f1.fontSize;
  if (l2) {
    const f2 = fitTextBlock(l2, { width: w - indent, height: lineBudget, maxSize, minSize: 52, lineHeight: 1.04 });
    size = Math.min(size, f2.fontSize);
  }
  const h1 = estTextHeight(l1, size, w, 1.04);
  o.push(textbox({
    text: l1, x, y, w, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: palette.dark, lineHeight: 1.04, charSpacing: -20,
    layerRole: 'headline', bgRef: palette.background
  }));
  let cursor = y + h1;
  if (l2) {
    const y2 = Math.round(cursor + 16);
    const h2 = estTextHeight(l2, size, w - indent, 1.04);
    const pillH = Math.round(h2 + 28);
    const pillW = Math.min(w - indent + 56, Math.round(estTextWidth(l2, size) * 1.1) + 72);
    o.push(rect({
      x: x + indent - 36, y: y2 - 14, w: pillW, h: pillH, fill: palette.accent,
      rx: Math.min(Math.round(pillH / 2), 48), layerRole: 'background'
    }));
    o.push(textbox({
      text: l2, x: x + indent, y: y2, w: w - indent, fontSize: size,
      fontFamily: fonts.head, fontWeight: '900', fill: pickTextColor(palette.accent),
      lineHeight: 1.04, charSpacing: -20, layerRole: 'headline', bgRef: palette.accent
    }));
    cursor = y2 + h2;
  }
  return Math.round(cursor);
}

/** One minimal numbered line: accent index, measured text, thin underline. */
function lineRow(o, b, i, palette, fonts, { x, y, w, h }) {
  const numW = 92;
  const gap = 44;
  const textX = x + numW + gap;
  const textW = w - numW - gap;
  const fit = fitTextBlock(b.text, {
    width: textW, height: Math.max(48, h - 64), maxSize: 38, minSize: 16, lineHeight: 1.38
  });
  o.push(textbox({
    text: String(i + 1).padStart(2, '0'), x, y: y + 2, w: numW, fontSize: 40,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.accent,
    lineHeight: 1.1, layerRole: 'message-label', msgId: b.id, bgRef: palette.background
  }));
  o.push({
    ...textbox({
      text: b.text, x: textX, y, w: textW, fontSize: fit.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.38, layerRole: 'message', msgId: b.id, bgRef: palette.background
    }),
    fieldRef: 'text'
  });
  o.push(rect({ x: textX, y: Math.round(y + fit.height + 24), w: textW, h: 2, fill: palette.dark, opacity: 0.22, layerRole: 'decor' }));
}

/** Subheadline under the hero; returns updated cursor. */
function subLine(o, content, palette, fonts, { x, y, w }) {
  if (!content.subheadline) return y;
  const sub = fitTextBlock(content.subheadline, { width: w, height: 100, maxSize: 34, minSize: 16, lineHeight: 1.35 });
  o.push(textbox({
    text: content.subheadline, x, y: Math.round(y + 36), w, fontSize: sub.fontSize,
    fontFamily: fonts.body, fontWeight: '500', fill: palette.dark,
    lineHeight: 1.35, layerRole: 'subheadline', bgRef: palette.background
  }));
  return Math.round(y + 36 + sub.height);
}

/** Editorial CTA: thin accent rule + fitted dark text, anchored to `bottom`. */
function ctaLine(o, content, palette, fonts, { x, w, bottom }) {
  const fit = fitTextBlock(content.callToAction, { width: w, height: 96, maxSize: 40, minSize: 20, lineHeight: 1.2 });
  const y = bottom - fit.height;
  o.push(rect({ x, y: y - 28, w: 120, h: 4, fill: palette.accent, rx: 2, layerRole: 'decor' }));
  o.push(textbox({
    text: content.callToAction, x, y, w, fontSize: fit.fontSize,
    fontFamily: fonts.head, fontWeight: '800', fill: palette.dark,
    lineHeight: 1.2, layerRole: 'cta', bgRef: palette.background
  }));
  return y;
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.background);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  // LIGHT scrim (paper-colored): this is a light editorial design — the wash
  // must lighten a filled background image, not darken it; the default dark
  // scrim would kill the airy whitespace this layout depends on.
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  o.push(...softGlow({ x: 1310, y: 260, r: 300, color: palette.primary, intensity: 0.7 }));
  o.push(rect({ x: 130, y: 96, w: 60, h: 3, fill: palette.dark, opacity: 0.5, layerRole: 'decor' }));

  const M = 130;
  const innerW = W - M * 2;
  let cursor = waveHeadline(o, content, palette, fonts, {
    x: M, y: 170, w: innerW, indent: 150, maxSize: 170, budget: 520
  });
  cursor = subLine(o, content, palette, fonts, { x: M, y: cursor, w: Math.round(innerW * 0.8) });

  const ctaY = ctaLine(o, content, palette, fonts, { x: M, w: innerW, bottom: H - 140 });

  const blocks = content.blocks || [];
  const top = Math.max(cursor + 80, 900);
  const areaH = ctaY - 70 - top;
  const n = Math.max(blocks.length, 1);
  const slotH = areaH / n;
  blocks.forEach((b, i) => {
    lineRow(o, b, i, palette, fonts, {
      x: M, y: Math.round(top + i * slotH), w: innerW, h: Math.round(slotH - 24)
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

  o.push(...softGlow({ x: 1880, y: 1180, r: 300, color: palette.primary, intensity: 0.7 }));
  o.push(rect({ x: 110, y: 100, w: 60, h: 3, fill: palette.dark, opacity: 0.5, layerRole: 'decor' }));

  const M = 110;
  let cursor = waveHeadline(o, content, palette, fonts, {
    x: M, y: 150, w: 900, indent: 120, maxSize: 150, budget: 640
  });
  cursor = subLine(o, content, palette, fonts, { x: M, y: cursor, w: 780 });
  ctaLine(o, content, palette, fonts, { x: M, w: 780, bottom: H - 120 });

  const blocks = content.blocks || [];
  const gx = 1120;
  const gw = W - M - gx;
  const top = 140;
  const areaH = H - 140 - top;
  const n = Math.max(blocks.length, 1);
  const slotH = areaH / n;
  blocks.forEach((b, i) => {
    lineRow(o, b, i, palette, fonts, {
      x: gx, y: Math.round(top + i * slotH), w: gw, h: Math.round(slotH - 24)
    });
  });
  return canvas;
}

function pvRow(parts, palette, { x, y, w }) {
  parts.push(pvBars({ x: pv(x), y: pv(y), w: pv(80), lines: 1, barH: 8, gap: 4, fill: palette.accent }));
  parts.push(pvBars({ x: pv(x + 136), y: pv(y), w: pv(w - 136), lines: 2, barH: 6, gap: 4, fill: palette.dark }));
  parts.push(pvRect(pv(x + 136), pv(y + 66), pv(w - 136), 0.8, palette.dark, { opacity: 0.25 }));
}

function previewPortrait(palette) {
  const parts = [
    pvCircle(pv(1310), pv(260), pv(300), palette.primary, { opacity: 0.06 }),
    pvBars({ x: pv(130), y: pv(190), w: pv(1000), lines: 1, barH: 16, gap: 8, fill: palette.dark }),
    pvRect(pv(244), pv(330), pv(760), pv(120), palette.accent, { rx: 8.5 }),
    pvBars({ x: pv(280), y: pv(360), w: pv(660), lines: 1, barH: 16, gap: 8, fill: pickTextColor(palette.accent) }),
    pvBars({ x: pv(130), y: pv(560), w: pv(760), lines: 1, barH: 6, gap: 4, fill: palette.dark })
  ];
  for (let i = 0; i < 4; i++) pvRow(parts, palette, { x: 130, y: 920 + i * 200, w: 1154 });
  parts.push(pvRect(pv(130), pv(1770), pv(120), pv(4), palette.accent, { rx: 0.6 }));
  parts.push(pvBars({ x: pv(130), y: pv(1800), w: pv(700), lines: 1, barH: 7, gap: 4, fill: palette.dark }));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvCircle(pv(1880), pv(1180), pv(300), palette.primary, { opacity: 0.06 }),
    pvBars({ x: pv(110), y: pv(170), w: pv(780), lines: 1, barH: 15, gap: 8, fill: palette.dark }),
    pvRect(pv(194), pv(300), pv(640), pv(110), palette.accent, { rx: 7.8 }),
    pvBars({ x: pv(230), y: pv(328), w: pv(560), lines: 1, barH: 15, gap: 8, fill: pickTextColor(palette.accent) }),
    pvBars({ x: pv(110), y: pv(520), w: pv(640), lines: 1, barH: 6, gap: 4, fill: palette.dark }),
    pvRect(pv(110), pv(1160), pv(120), pv(4), palette.accent, { rx: 0.6 }),
    pvBars({ x: pv(110), y: pv(1190), w: pv(560), lines: 1, barH: 7, gap: 4, fill: palette.dark })
  ];
  for (let i = 0; i < 4; i++) pvRow(parts, palette, { x: 1120, y: 180 + i * 283, w: 770 });
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'type-wave',
  name: 'Type wave',
  style: 'statement',
  description: 'Elastic typography hero on an airy light canvas: the headline rides two alternating baselines with a rounded accent highlight pill behind the second line, and the points are minimal numbered lines with thin underline strokes and generous editorial whitespace. Hero over lines in portrait; hero column beside the line stack in landscape.',
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
