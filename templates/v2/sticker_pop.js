// v2 template — sticker-pop (style: comic). M1 modern family: a playful-but-
// neat sticker/label aesthetic on a LIGHT canvas. Each block is a white
// sticker card — thick white border (inner inset edge) + dark outline + a
// slight rotation (±2.5°) — with a small accent badge chip pinned over its
// top edge. Bold tight-tracked headline; CTA is a chunky brand pill with a
// hard offset shadow. Portrait: headline over a two-col sticker grid;
// landscape: REAL relayout — headline + CTA column left, sticker grid right.
// Rotations stay small and every budget keeps ≥24px clearance between rows
// (the overflow audit measures unrotated boxes; margins absorb the tilt).

import {
  textbox, rect, circle, chip, imageSlot, backgroundImageSlot,
  fitTextBlock, pickTextColor,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO, PV_LAND_W, PV_LAND_H,
  legibilityScrim, softGlow
} from './decor.js';

const PADX = 56;        // sticker horizontal text inset (thick border feel)
const TOP_PAD = 64;     // clears the pinned badge chip
const BOT_PAD = 44;
const GAP = 36;         // grid gutter (≥24px safety for the small rotations)

const BG_HINT = 'bright playful flat-color backdrop, subtle paper grain, soft confetti shapes, no text';

/** Grid: rows of two stickers, an odd last block goes full width. */
function stickerRects(n, { x, y, w, h }) {
  const rows = Math.ceil(n / 2);
  const rowH = Math.round((h - GAP * (rows - 1)) / rows);
  const colW = Math.round((w - GAP) / 2);
  const rects = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / 2);
    const lastAlone = i === n - 1 && n % 2 === 1;
    rects.push({
      x: lastAlone ? x : x + (i % 2) * (colW + GAP),
      y: y + r * (rowH + GAP),
      w: lastAlone ? w : colW,
      h: rowH,
      angle: lastAlone ? 1.2 : (i % 2 === 0 ? 2.2 : -2.2)
    });
  }
  return rects;
}

/** One sticker: tilted white card + dark outline + pinned accent badge chip +
 * an image section band above the text (product decision 2026-08-06: every
 * sticker carries imagery alongside its copy). The image slot stays unrotated
 * inside the tilted card (same convention as the text). */
function sticker(o, b, i, palette, fonts, { x, y, w, h, angle }) {
  const innerW = w - PADX * 2;
  const cardY = y + 30; // headroom for the pinned badge
  const maxCardH = h - 30;
  // image band: ~40% of the card budget, min 120px — measured BEFORE the text
  // budget so both sections always fit the sticker
  const imgH = Math.max(120, Math.round(maxCardH * 0.4));
  const fit = fitTextBlock(b.text, {
    width: innerW, height: Math.max(56, maxCardH - TOP_PAD - BOT_PAD - imgH - 18), maxSize: 36, minSize: 15, lineHeight: 1.34
  });
  const cardH = Math.min(maxCardH, Math.round(TOP_PAD + imgH + 18 + fit.height + BOT_PAD));

  o.push(rect({ x: x + 8, y: cardY + 10, w, h: cardH, fill: palette.dark, opacity: 0.1, rx: 26, angle, layerRole: 'background', msgId: b.id }));
  o.push(rect({ x, y: cardY, w, h: cardH, fill: '#FFFFFF', rx: 26, stroke: palette.dark, strokeWidth: 3, angle, layerRole: 'background', msgId: b.id }));
  // inner inset edge — the "thick white sticker border" read
  o.push(rect({ x: x + 14, y: cardY + 14, w: w - 28, h: cardH - 28, fill: 'transparent', rx: 18, stroke: palette.dark, strokeWidth: 1, opacity: 0.25, angle, layerRole: 'decor' }));

  // image section: rounded slot filling the card's top band
  o.push(imageSlot({
    slotId: `slot-${i + 1}`, x: x + PADX, y: cardY + 24, w: innerW, h: imgH,
    rx: 16, stroke: palette.primary,
    styleHint: `playful sticker-style illustration for: ${b.text.slice(0, 70)}, flat vector, bold shapes, no text`,
    blockId: b.id
  }));

  const badgeBg = i % 2 === 0 ? palette.accent : palette.primary;
  const chipObjs = chip({
    text: b.label, x: x + 30, y: cardY - 26, fontSize: 22,
    bg: badgeBg, color: pickTextColor(badgeBg), font: fonts.head,
    msgId: b.id, maxW: w - 60, maxH: 56
  });
  o.push(chipObjs[0], { ...chipObjs[1], fieldRef: 'label', bgRef: badgeBg });

  o.push({
    ...textbox({
      text: b.text, x: x + PADX, y: cardY + 24 + imgH + 18, w: innerW, fontSize: fit.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.34, layerRole: 'message', msgId: b.id, bgRef: '#FFFFFF'
    }),
    fieldRef: 'text'
  });
}

/** Bold tight-tracked headline + subheadline; returns flow cursor. */
function headZone(o, content, palette, fonts, { x, y, w, headMax, headBudget }) {
  const head = fitTextBlock(content.headline, {
    width: w, height: headBudget, maxSize: headMax, minSize: 44, lineHeight: 1.02
  });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark, lineHeight: 1.02,
    charSpacing: -40, layerRole: 'headline', bgRef: palette.background
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
  return Math.round(cursor);
}

/** Chunky CTA pill with hard offset shadow, anchored to `bottom`; returns top y. */
function ctaPill(o, content, palette, fonts, { x, w, bottom }) {
  const innerW = w - 100;
  const fit = fitTextBlock(content.callToAction, { width: innerW, height: 96, maxSize: 40, minSize: 18, lineHeight: 1.2 });
  const pillH = Math.round(fit.height + 52);
  const y = bottom - pillH;
  o.push(rect({ x: x + 8, y: y + 8, w, h: pillH, fill: palette.dark, rx: Math.min(Math.round(pillH / 2), 44), layerRole: 'background' }));
  o.push(rect({ x, y, w, h: pillH, fill: palette.primary, rx: Math.min(Math.round(pillH / 2), 44), stroke: palette.dark, strokeWidth: 3, layerRole: 'background' }));
  o.push(textbox({
    text: content.callToAction, x: x + 50, y: y + 26, w: innerW, fontSize: fit.fontSize,
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
  // LIGHT scrim (paper-colored): this is a light playful design — the wash
  // must lighten a filled background image, not darken it; the default dark
  // scrim would mud the sticker-sheet white.
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  o.push(...softGlow({ x: 1280, y: 240, r: 300, color: palette.accent, intensity: 0.7 }));
  o.push(circle({ x: 150, y: 1960, r: 90, fill: 'transparent', stroke: palette.primary, strokeWidth: 4, opacity: 0.2, layerRole: 'decor' }));
  o.push(rect({ x: 1290, y: 560, w: 54, h: 54, fill: palette.primary, rx: 14, angle: 12, opacity: 0.18, layerRole: 'decor' }));

  const M = 90;
  const innerW = W - M * 2;
  const cursor = headZone(o, content, palette, fonts, { x: M, y: 110, w: innerW, headMax: 120, headBudget: 270 });

  const ctaY = ctaPill(o, content, palette, fonts, { x: M + 70, w: innerW - 140, bottom: H - 100 });

  const blocks = content.blocks || [];
  const rects = stickerRects(Math.max(blocks.length, 1), {
    x: M, y: Math.max(cursor + 70, 620), w: innerW, h: ctaY - 50 - Math.max(cursor + 70, 620)
  });
  blocks.forEach((b, i) => sticker(o, b, i, palette, fonts, rects[i]));
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.background);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  // LIGHT scrim (paper-colored) — see portrait note; light design contract.
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  o.push(...softGlow({ x: 300, y: 1200, r: 300, color: palette.accent, intensity: 0.7 }));
  o.push(circle({ x: 640, y: 130, r: 70, fill: 'transparent', stroke: palette.primary, strokeWidth: 4, opacity: 0.2, layerRole: 'decor' }));

  const M = 90;
  headZone(o, content, palette, fonts, { x: M, y: 120, w: 620, headMax: 104, headBudget: 400 });
  ctaPill(o, content, palette, fonts, { x: M, w: 620, bottom: H - 100 });

  const blocks = content.blocks || [];
  const gx = 770;
  const rects = stickerRects(Math.max(blocks.length, 1), {
    x: gx, y: 90, w: W - M - gx, h: H - 180
  });
  blocks.forEach((b, i) => sticker(o, b, i, palette, fonts, rects[i]));
  return canvas;
}

function pvSticker(parts, palette, { x, y, w, h }, i) {
  parts.push(pvRect(pv(x), pv(y + 30), pv(w), pv(h - 60), '#FFFFFF', { rx: 3.6, stroke: palette.dark }));
  parts.push(pvRect(pv(x + 30), pv(y + 4), pv(170), pv(46), i % 2 === 0 ? palette.accent : palette.primary, { rx: 3.2 }));
  parts.push(pvBars({ x: pv(x + 56), y: pv(y + 100), w: pv(w - 112), lines: 3, barH: 6, gap: 4, fill: palette.dark }));
}

function previewPortrait(palette) {
  const parts = [
    pvCircle(pv(1280), pv(240), pv(300), palette.accent, { opacity: 0.06 }),
    pvBars({ x: pv(90), y: pv(130), w: pv(1234), lines: 2, barH: 14, gap: 7, fill: palette.dark })
  ];
  [[90, 620], [725, 620], [90, 1186], [725, 1186]].forEach(([x, y], i) => {
    pvSticker(parts, palette, { x, y, w: 599, h: 530 }, i);
  });
  parts.push(pvRect(pv(160), pv(1776), pv(1094), pv(130), palette.primary, { rx: 4.6, stroke: palette.dark }));
  parts.push(pvBars({ x: pv(300), y: pv(1826), w: pv(814), lines: 1, barH: 6, gap: 4, fill: pickTextColor(palette.primary), align: 'center' }));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvCircle(pv(300), pv(1200), pv(300), palette.accent, { opacity: 0.06 }),
    pvBars({ x: pv(90), y: pv(140), w: pv(620), lines: 3, barH: 12, gap: 6, fill: palette.dark }),
    pvRect(pv(90), pv(1184), pv(620), pv(130), palette.primary, { rx: 4.6, stroke: palette.dark })
  ];
  [[770, 90], [1358, 90], [770, 725], [1358, 725]].forEach(([x, y], i) => {
    pvSticker(parts, palette, { x, y, w: 552, h: 599 }, i);
  });
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'sticker-pop',
  name: 'Sticker pop',
  style: 'comic',
  description: 'Playful sticker-sheet poster on a light canvas: each point is a white sticker card with a dark outline, inner sticker edge, slight tilt and a small accent badge chip pinned to its top — under a bold tight-tracked headline and a chunky hard-shadow CTA pill. Grid under the headline in portrait; headline column beside the grid in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'cells', min: 3, max: 4, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 4
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
