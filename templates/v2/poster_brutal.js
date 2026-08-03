// v2 template — poster-brutal (style: statement). Big-type brutalism: a giant
// condensed headline fills the upper half on a stark palette.dark slab, raw
// exposed grid rules run the full canvas, and the blocks are numbered BARE
// rows — oversized index numerals in the brand primary, heavy dark rules
// between rows, zero boxes, zero chrome. Two-colour blocking (dark slab /
// paper field) with primary reserved for numerals + CTA. Portrait stacks the
// rows under the slab; landscape is a REAL relayout — full-height dark column
// left (headline + CTA), numbered rows right.

import {
  textbox, rect, backgroundImageSlot,
  fitTextBlock, estTextHeight, pickTextColor,
  pv, pvRect, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO, PV_LAND_W, PV_LAND_H,
  legibilityScrim
} from './decor.js';

const RULE_H = 10;         // heavy row rule
const NUM_COL_W = 200;     // index numeral column width
const NUM_GAP = 40;        // numeral column → text gap

/** Exposed raw grid: full-height verticals + faint cross rules. */
function rawGrid(o, palette, W, H, xs) {
  for (const x of xs) {
    o.push(rect({ x, y: 0, w: 4, h: H, fill: palette.primary, opacity: 0.18, layerRole: 'decor' }));
  }
}

/** One numbered bare row: heavy rule, oversized numeral, raw text. */
function numberedRow(o, b, i, palette, fonts, { x, y, w, rowH, onColor, bgRef }) {
  // heavy rule across the whole row top
  o.push(rect({ x, y, w, h: RULE_H, fill: onColor, layerRole: 'background', msgId: b.id }));

  const padTop = 36;
  // oversized index numeral — brutal, primary, filling the row
  const num = String(i + 1).padStart(2, '0');
  const numFit = fitTextBlock(num, {
    width: NUM_COL_W - 20, height: Math.max(60, rowH - padTop - 28), maxSize: 150, minSize: 40, lineHeight: 1
  });
  o.push({
    ...textbox({
      text: num, x, y: y + padTop, w: NUM_COL_W - 20, fontSize: numFit.fontSize,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.primary,
      lineHeight: 1, layerRole: 'message-label', msgId: b.id, bgRef
    })
  });

  // bare row text — no box, just type
  const textX = x + NUM_COL_W + NUM_GAP;
  const textW = w - NUM_COL_W - NUM_GAP;
  const fit = fitTextBlock(b.text, {
    width: textW, height: Math.max(48, rowH - padTop - 30), maxSize: 46, minSize: 16, lineHeight: 1.28
  });
  o.push({
    ...textbox({
      text: b.text, x: textX, y: y + padTop, w: textW, fontSize: fit.fontSize,
      fontFamily: fonts.body, fontWeight: '700', fill: onColor,
      lineHeight: 1.28, layerRole: 'message', msgId: b.id, bgRef
    }),
    fieldRef: 'text'
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.background);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'raw concrete texture, harsh monochrome grain, brutalist print feel, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  const M = 96;
  const innerW = W - M * 2;

  // measure the slab content first, then paint the slab beneath it
  const head = fitTextBlock(content.headline, { width: innerW, height: 520, maxSize: 190, minSize: 80, lineHeight: 1.0 });
  const headY = 120;
  let slabCursor = headY + head.height;
  let sub = null;
  if (content.subheadline) {
    sub = fitTextBlock(content.subheadline, { width: innerW, height: 120, maxSize: 40, minSize: 16, lineHeight: 1.3 });
    slabCursor += 36 + sub.height;
  }
  const slabH = Math.round(slabCursor + 80);

  o.push(rect({ x: 0, y: 0, w: W, h: slabH, fill: palette.dark, layerRole: 'background' }));
  rawGrid(o, palette, W, H, [M - 28, W - M + 24]);

  const onSlab = pickTextColor(palette.dark);
  o.push(textbox({
    text: content.headline, x: M, y: headY, w: innerW, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: onSlab, lineHeight: 1.0,
    charSpacing: -20, layerRole: 'headline', bgRef: palette.dark
  }));
  if (sub) {
    o.push(textbox({
      text: content.subheadline, x: M, y: Math.round(headY + head.height + 36), w: innerW,
      fontSize: sub.fontSize, fontFamily: fonts.body, fontWeight: '700', fill: palette.primary,
      lineHeight: 1.3, layerRole: 'subheadline', bgRef: palette.dark
    }));
  }

  // numbered bare rows on the paper field
  const blocks = content.blocks || [];
  const rowsTop = slabH + 44;
  const ctaY = H - 152;
  const availH = ctaY - rowsTop - 24;
  const n = Math.max(blocks.length, 1);
  const rowH = Math.floor(availH / n);
  blocks.forEach((b, i) => {
    numberedRow(o, b, i, palette, fonts, {
      x: M, y: rowsTop + i * rowH, w: innerW, rowH: rowH - 12,
      onColor: palette.dark, bgRef: palette.background
    });
  });
  // closing heavy rule
  o.push(rect({ x: M, y: ctaY - 22, w: innerW, h: RULE_H, fill: palette.dark, layerRole: 'decor' }));

  // CTA slab
  o.push(rect({ x: 0, y: ctaY, w: W, h: H - ctaY, fill: palette.dark, layerRole: 'background' }));
  const cta = fitTextBlock(content.callToAction, { width: innerW, height: 108, maxSize: 46, minSize: 30, lineHeight: 1.16 });
  o.push(textbox({
    text: content.callToAction, x: M, y: ctaY + Math.round((H - ctaY - cta.height) / 2),
    w: innerW, fontSize: cta.fontSize, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: palette.dark
  }));
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.background);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'raw concrete texture, harsh monochrome grain, brutalist print feel, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // full-height dark column left
  const colW = 880;
  o.push(rect({ x: 0, y: 0, w: colW, h: H, fill: palette.dark, layerRole: 'background' }));
  rawGrid(o, palette, W, H, [colW + 24, W - 64]);

  const onSlab = pickTextColor(palette.dark);
  const leftX = 80;
  const leftW = colW - leftX * 2;
  const head = fitTextBlock(content.headline, { width: leftW, height: 640, maxSize: 170, minSize: 80, lineHeight: 1.0 });
  o.push(textbox({
    text: content.headline, x: leftX, y: 110, w: leftW, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: onSlab, lineHeight: 1.0,
    charSpacing: -20, layerRole: 'headline', bgRef: palette.dark
  }));
  let cursor = 110 + head.height + 32;
  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, { width: leftW, height: 120, maxSize: 38, minSize: 16, lineHeight: 1.3 });
    o.push(textbox({
      text: content.subheadline, x: leftX, y: Math.round(cursor), w: leftW, fontSize: sub.fontSize,
      fontFamily: fonts.body, fontWeight: '700', fill: palette.primary,
      lineHeight: 1.3, layerRole: 'subheadline', bgRef: palette.dark
    }));
    cursor += sub.height;
  }

  // CTA pinned to the column base, clear of the subheadline
  const cta = fitTextBlock(content.callToAction, { width: leftW, height: 120, maxSize: 44, minSize: 30, lineHeight: 1.2 });
  const ctaY = Math.max(H - 110 - cta.height, cursor + 40);
  o.push(rect({ x: leftX, y: ctaY - 26, w: 220, h: RULE_H, fill: palette.primary, layerRole: 'decor' }));
  o.push(textbox({
    text: content.callToAction, x: leftX, y: Math.round(ctaY), w: leftW, fontSize: cta.fontSize,
    fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
    lineHeight: 1.2, layerRole: 'cta', bgRef: palette.dark
  }));

  // numbered rows on the paper field, right
  const blocks = content.blocks || [];
  const rx = colW + 60;
  const rw = W - rx - 80;
  const top = 100;
  const availH = H - top - 100;
  const n = Math.max(blocks.length, 1);
  const rowH = Math.floor(availH / n);
  blocks.forEach((b, i) => {
    numberedRow(o, b, i, palette, fonts, {
      x: rx, y: top + i * rowH, w: rw, rowH: rowH - 12,
      onColor: palette.dark, bgRef: palette.background
    });
  });
  o.push(rect({ x: rx, y: top + n * rowH - 2, w: rw, h: RULE_H, fill: palette.dark, layerRole: 'decor' }));
  return canvas;
}

function previewPortrait(palette) {
  const on = pickTextColor(palette.dark);
  const parts = [
    pvRect(0, 0, 200, pv(860), palette.dark),
    pvBars({ x: pv(96), y: pv(140), w: pv(1222), lines: 3, barH: 14, gap: 7, fill: on }),
    pvRect(pv(68), 0, 1.4, 283, palette.primary, { opacity: 0.4 }),
    pvRect(pv(1342), 0, 1.4, 283, palette.primary, { opacity: 0.4 })
  ];
  for (let i = 0; i < 4; i++) {
    const y = 905 + i * 230;
    parts.push(pvRect(pv(96), pv(y), pv(1222), 1.6, palette.dark));
    parts.push(pvRect(pv(96), pv(y + 34), pv(120), pv(110), palette.primary, { rx: 1 }));
    parts.push(pvBars({ x: pv(336), y: pv(y + 44), w: pv(962), lines: 2, barH: 6, gap: 4, fill: palette.dark }));
  }
  parts.push(pvRect(0, pv(1848), 200, pv(152), palette.dark));
  parts.push(pvBars({ x: pv(300), y: pv(1900), w: pv(814), lines: 1, barH: 7, gap: 4, fill: palette.primary, align: 'center' }));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const on = pickTextColor(palette.dark);
  const parts = [
    pvRect(0, 0, pv(880), PV_LAND_H, palette.dark),
    pvBars({ x: pv(80), y: pv(130), w: pv(720), lines: 4, barH: 12, gap: 6, fill: on }),
    pvBars({ x: pv(80), y: pv(1230), w: pv(500), lines: 1, barH: 7, gap: 4, fill: palette.primary }),
    pvRect(pv(904), 0, 1.4, PV_LAND_H, palette.primary, { opacity: 0.4 })
  ];
  for (let i = 0; i < 4; i++) {
    const y = 100 + i * 300;
    parts.push(pvRect(pv(940), pv(y), pv(980), 1.6, palette.dark));
    parts.push(pvRect(pv(940), pv(y + 36), pv(110), pv(120), palette.primary, { rx: 1 }));
    parts.push(pvBars({ x: pv(1180), y: pv(y + 48), w: pv(740), lines: 2, barH: 6, gap: 4, fill: palette.dark }));
  }
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'poster-brutal',
  name: 'Brutal type',
  style: 'statement',
  description: 'Big-type brutalist poster: a giant condensed headline fills a stark dark slab, raw grid rules run the full canvas, and the points are numbered bare rows with oversized index numerals and heavy rules — two-colour blocking, zero boxes. Slab-over-rows in portrait, full-height dark column plus row stack in landscape.',
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
