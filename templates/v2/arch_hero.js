// v2 template — arch-hero (style: statement). M1 modern family, batch C:
// the org's arch-photo language on a LIGHT canvas — a giant brand-primary
// circle blob bleeds off the top-right corner, two arch-shaped (rounded-top
// capsule) content image slots stand side-by-side against it, and a bold
// left-aligned headline owns the opposite corner. The points are clean bare
// rows with brand pill markers under the arches, closed by a dark pill info
// CTA bar. Portrait stacks headline+arches over the rows; landscape is a
// REAL relayout — headline + rows in a left column, staggered arches right.
// Every text is measured (fitTextBlock) inside fixed slot budgets so stress
// copy shrinks in place instead of colliding.

import {
  textbox, rect, circle, imageSlot, backgroundImageSlot,
  fitTextBlock, pickTextColor,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO, PV_LAND_W, PV_LAND_H,
  legibilityScrim
} from './decor.js';

const BG_HINT = 'bright modern corporate interior, soft warm daylight, clean minimal surfaces, gentle depth of field, no text';
const SLOT_HINT = 'portrait of a focused professional at work, natural light, warm corporate tones, no text';

/** Giant brand blob + small floating dots (the org's corner-circle motif). */
function blobAndDots(o, palette, { blob, dots }) {
  o.push(circle({ x: blob.x, y: blob.y, r: blob.r, fill: palette.primary, opacity: 0.92, layerRole: 'decor' }));
  for (const d of dots) {
    o.push(circle({ x: d.x, y: d.y, r: d.r, fill: d.fill, opacity: d.o ?? 0.9, layerRole: 'decor' }));
  }
}

/** Arch-shaped content slot: tall capsule (rx = w/2) approximating the arch. */
function archSlot(o, palette, { slotId, x, y, w, h }) {
  o.push(imageSlot({ slotId, x, y, w, h, rx: Math.round(w / 2), styleHint: SLOT_HINT, stroke: palette.primary }));
}

/** Bold left headline (+optional sub); returns the y below the block. */
function headlineZone(o, content, palette, fonts, { x, y, w, headBudget, headMax }) {
  const head = fitTextBlock(content.headline, { width: w, height: headBudget, maxSize: headMax, minSize: 52, lineHeight: 1.05 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark,
    lineHeight: 1.05, charSpacing: -10, layerRole: 'headline', bgRef: palette.background
  }));
  let cursor = y + head.height;
  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, { width: w, height: 110, maxSize: 34, minSize: 16, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: Math.round(cursor + 28), w, fontSize: sub.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: palette.background
    }));
    cursor += 28 + sub.height;
  }
  return Math.round(cursor);
}

/** One clean row: brand pill marker + measured text + hairline divider. */
function pillRow(o, b, i, n, palette, fonts, { x, y, w, slotH }) {
  o.push(rect({ x, y: y + 12, w: 44, h: 18, fill: i % 2 === 0 ? palette.primary : palette.accent, rx: 9, layerRole: 'decor' }));
  const textX = x + 80;
  const textW = w - 80;
  const fit = fitTextBlock(b.text, {
    width: textW, height: Math.max(44, slotH - 56), maxSize: 40, minSize: 16, lineHeight: 1.34
  });
  o.push({
    ...textbox({
      text: b.text, x: textX, y, w: textW, fontSize: fit.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.34, layerRole: 'message', msgId: b.id, bgRef: palette.background
    }),
    fieldRef: 'text'
  });
  if (i < n - 1) {
    o.push(rect({ x: textX, y: Math.round(y + slotH - 24), w: textW, h: 2, fill: palette.dark, opacity: 0.16, layerRole: 'decor' }));
  }
}

/** Dark pill info bar carrying the CTA. */
function ctaPill(o, content, palette, fonts, { x, y, w, h }) {
  o.push(rect({ x, y, w, h, fill: palette.dark, rx: Math.round(h / 2), layerRole: 'background' }));
  const cta = fitTextBlock(content.callToAction, { width: w - 160, height: h - 36, maxSize: 42, minSize: 20, lineHeight: 1.2 });
  o.push(textbox({
    text: content.callToAction, x: x + 80, y: Math.round(y + (h - cta.height) / 2), w: w - 160,
    fontSize: cta.fontSize, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', lineHeight: 1.2, layerRole: 'cta', bgRef: palette.dark
  }));
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.background);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  // LIGHT scrim (paper-colored): this is a light design — the wash must
  // lighten a filled background image, never darken it.
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  blobAndDots(o, palette, {
    blob: { x: 1430, y: 10, r: 430 },
    dots: [
      { x: 180, y: 640, r: 14, fill: palette.accent },
      { x: 780, y: 84, r: 10, fill: palette.primary },
      { x: 1360, y: 620, r: 12, fill: palette.dark, o: 0.35 }
    ]
  });

  // arches beside the headline, standing on the blob
  archSlot(o, palette, { slotId: 'slot-1', x: 830, y: 140, w: 260, h: 430 });
  archSlot(o, palette, { slotId: 'slot-2', x: 1122, y: 140, w: 260, h: 430 });

  const M = 96;
  const cursor = headlineZone(o, content, palette, fonts, {
    x: M, y: 150, w: 690, headBudget: 440, headMax: 128
  });

  const ctaH = 112;
  const ctaY = H - M - ctaH;
  ctaPill(o, content, palette, fonts, { x: M, y: ctaY, w: W - M * 2, h: ctaH });

  const blocks = content.blocks || [];
  const top = Math.max(cursor + 70, 660);
  const bottom = ctaY - 48;
  const n = Math.max(blocks.length, 1);
  const slotH = (bottom - top) / n;
  blocks.forEach((b, i) => {
    pillRow(o, b, i, n, palette, fonts, {
      x: M, y: Math.round(top + i * slotH), w: W - M * 2, slotH: Math.round(slotH)
    });
  });
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.background);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  // LIGHT scrim (paper-colored) — light design contract, see portrait note.
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  blobAndDots(o, palette, {
    blob: { x: 2010, y: 0, r: 400 },
    dots: [
      { x: 1016, y: 1120, r: 14, fill: palette.accent },
      { x: 1960, y: 1060, r: 12, fill: palette.primary },
      { x: 1040, y: 90, r: 10, fill: palette.dark, o: 0.35 }
    ]
  });

  // staggered arches on the right column
  archSlot(o, palette, { slotId: 'slot-1', x: 1080, y: 150, w: 400, h: 800 });
  archSlot(o, palette, { slotId: 'slot-2', x: 1520, y: 250, w: 400, h: 800 });

  const M = 96;
  const cursor = headlineZone(o, content, palette, fonts, {
    x: M, y: 130, w: 860, headBudget: 420, headMax: 120
  });

  const ctaH = 104;
  const ctaY = H - M - ctaH;
  ctaPill(o, content, palette, fonts, { x: M, y: ctaY, w: 900, h: ctaH });

  const blocks = content.blocks || [];
  const top = Math.max(cursor + 50, 650);
  const bottom = ctaY - 40;
  const n = Math.max(blocks.length, 1);
  const slotH = (bottom - top) / n;
  blocks.forEach((b, i) => {
    pillRow(o, b, i, n, palette, fonts, {
      x: M, y: Math.round(top + i * slotH), w: 900, slotH: Math.round(slotH)
    });
  });
  return canvas;
}

function pvArch(x, y, w, h, stroke) {
  return pvRect(pv(x), pv(y), pv(w), pv(h), 'none', { rx: pv(w / 2), stroke, dash: '4 3' });
}

function previewPortrait(palette) {
  const parts = [
    pvCircle(pv(1430), pv(10), pv(430), palette.primary, { opacity: 0.92 }),
    pvArch(830, 140, 260, 430, palette.primary),
    pvArch(1122, 140, 260, 430, palette.primary),
    pvCircle(pv(180), pv(640), pv(14), palette.accent),
    pvBars({ x: pv(96), y: pv(160), w: pv(690), lines: 3, barH: 12, gap: 6, fill: palette.dark })
  ];
  for (let i = 0; i < 4; i++) {
    const y = 700 + i * 270;
    parts.push(pvRect(pv(96), pv(y + 12), pv(44), pv(18), i % 2 === 0 ? palette.primary : palette.accent, { rx: pv(9) }));
    parts.push(pvBars({ x: pv(176), y: pv(y + 8), w: pv(1142), lines: 2, barH: 5, gap: 4, fill: palette.dark }));
  }
  parts.push(pvRect(pv(96), pv(1792), pv(1222), pv(112), palette.dark, { rx: pv(56) }));
  parts.push(pvBars({ x: pv(300), y: pv(1832), w: pv(814), lines: 1, barH: 6, gap: 4, fill: palette.primary, align: 'center' }));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvCircle(pv(2010), pv(0), pv(400), palette.primary, { opacity: 0.92 }),
    pvArch(1080, 150, 400, 800, palette.primary),
    pvArch(1520, 250, 400, 800, palette.primary),
    pvCircle(pv(1016), pv(1120), pv(14), palette.accent),
    pvBars({ x: pv(96), y: pv(140), w: pv(860), lines: 3, barH: 11, gap: 6, fill: palette.dark })
  ];
  for (let i = 0; i < 4; i++) {
    const y = 670 + i * 135;
    parts.push(pvRect(pv(96), pv(y + 8), pv(44), pv(18), i % 2 === 0 ? palette.primary : palette.accent, { rx: pv(9) }));
    parts.push(pvBars({ x: pv(176), y: pv(y + 6), w: pv(820), lines: 1, barH: 5, gap: 3, fill: palette.dark }));
  }
  parts.push(pvRect(pv(96), pv(1214), pv(900), pv(104), palette.dark, { rx: pv(52) }));
  parts.push(pvBars({ x: pv(200), y: pv(1252), w: pv(692), lines: 1, barH: 6, gap: 4, fill: palette.primary, align: 'center' }));
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'arch-hero',
  name: 'Arch hero',
  style: 'statement',
  description: 'Corporate arch-photo hero on a light canvas: a giant brand circle bleeds off the top corner behind two arch-shaped photo slots, a bold left headline holds the opposite side, the points run as clean pill-marker rows, and a dark pill info bar carries the CTA. Arches over rows in portrait; headline-and-rows column beside staggered arches in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'cells', min: 3, max: 4, fields: ['text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 2
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
