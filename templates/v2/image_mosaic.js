// v2 template — image-mosaic (style: infographic). A bold IMAGE-FIRST poster
// where FOUR large editorial images ARE the layout: the images tile the canvas
// edge-to-edge and each carries one block's short HEADING + LINE woven directly
// over it (magazine cover treatment). No code-drawn tiles/pills/chips as
// decoration — the picture regions and clean type do all the work. A dark
// gradient strip fades up from the bottom of each cell so the type stays
// readable over any art. A full-bleed background image sits behind a legibility
// scrim; a compact headline band rides the top and a clean CTA line the bottom.
// Portrait: a 2x2 grid of big image cells. Landscape: a REAL relayout — a
// 4-wide filmstrip of tall image cells.

import {
  textbox, imageSlot, backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, softGlow, svgWrapO, PV_LAND_W,
  legibilityScrim, linearGradientFill,
  DARK_BASE, DARK_INK, DARK_INK_DIM, OVERLAY_TEXT_SHADOW
} from './decor.js';

const CELL_R = 20;

// ── per-cell legibility strip ────────────────────────────────────────────────
// A strong dark gradient that fades UP from the bottom of an image cell, so the
// heading + text woven over the lower part of the picture stay readable. Uses
// layerRole 'scrim' (like the full-bleed legibility scrim) so it is exempt from
// the <=0.2 decor-opacity rule — a per-cell strip must be strong to do its job.
function cellScrim(o, { x, y, w, h }) {
  const stripH = Math.round(h * 0.52);
  const top = y + h - stripH;
  o.push({
    type: 'Rect', left: x, top, width: w, height: stripH,
    fill: linearGradientFill({
      x1: 0, y1: stripH, x2: 0, y2: 0,
      stops: [
        { offset: 0, color: DARK_BASE },
        { offset: 0.55, color: DARK_BASE },
        { offset: 1, color: DARK_BASE }
      ]
    }),
    rx: CELL_R, ry: CELL_R,
    opacity: 0.82, layerRole: 'scrim'
  });
}

// ── one image cell: slot + scrim strip + woven HEADING and TEXT ──────────────
// The image slot IS the cell. Text is anchored to the lower band (over the
// scrim strip) and clamped inside the cell bounds.
function imageCell(o, b, palette, fonts, { x, y, w, h }) {
  o.push(imageSlot({
    slotId: `slot-${b.slotIdx}`, x, y, w, h, rx: CELL_R,
    styleHint: 'bold editorial full-frame image for this point, dramatic subject, deep dark tones, no text',
    stroke: palette.primary, blockId: b.id
  }));
  cellScrim(o, { x, y, w, h });

  const padX = 34;
  const innerW = w - padX * 2;
  // Budget each text field to a fraction of the cell's lower scrim zone (52% of h).
  // Audit avail = distance to next content below the textbox (within cell h).
  // headBudget: allow up to 22% of cell h so heading fits without overflowing into body.
  // bodyBudget: allow up to 20% of cell h, keeping it above cell bottom.
  const headBudget = Math.round(h * 0.22);
  const bodyBudget = Math.round(h * 0.20);
  const headSize = fitFontSize(b.heading, { width: innerW, height: headBudget, maxSize: 60, minSize: 20 });
  const bodySize = fitFontSize(b.text, { width: innerW, height: bodyBudget, maxSize: 46, minSize: 14 });

  const headH = estTextHeight(b.heading, headSize, innerW, 1.05);
  const bodyH = estTextHeight(b.text, bodySize, innerW, 1.16);
  const gap = 14;
  const botPad = 32;
  // stack heading above text, bottom-anchored inside the cell
  let bodyTop = y + h - botPad - bodyH;
  let headTop = bodyTop - gap - headH;
  const minTop = y + Math.round(h * 0.34);
  if (headTop < minTop) {
    headTop = minTop;
    bodyTop = headTop + headH + gap;
  }

  o.push({
    ...textbox({
      text: b.heading, x: x + padX, y: headTop, w: innerW, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.primary,
      lineHeight: 1.05, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE,
      shadow: OVERLAY_TEXT_SHADOW
    }),
    fieldRef: 'heading'
  });
  o.push({
    ...textbox({
      text: b.text, x: x + padX, y: bodyTop, w: innerW, fontSize: bodySize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
      lineHeight: 1.16, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE,
      shadow: OVERLAY_TEXT_SHADOW
    }),
    fieldRef: 'text'
  });
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize, headMaxH = 185, align = 'left' }) {
  const headSize = fitFontSize(content.headline, { width: w, height: headMaxH, maxSize, minSize: 20 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align,
    lineHeight: 1.16, layerRole: 'headline', bgRef: DARK_BASE, shadow: OVERLAY_TEXT_SHADOW
  }));
  // Use 1.16 to match audit's tbHeight (textbox lineHeight default = 1.16).
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.16) + 14;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 40, minSize: 16, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM, align,
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE, shadow: OVERLAY_TEXT_SHADOW
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.35) + 12;
  }
  return cursor;
}

function ctaLine(o, text, palette, fonts, { x, y, w, align = 'center' }) {
  const size = fitFontSize(text, { width: w, height: 80, maxSize: 48, minSize: 20 });
  o.push(textbox({
    text, x, y, w, fontSize: size,
    fontFamily: fonts.head, fontWeight: '800', fill: palette.primary, align,
    layerRole: 'cta', bgRef: DARK_BASE, shadow: OVERLAY_TEXT_SHADOW
  }));
}

// ── portrait: 2x2 mosaic of big image cells ──────────────────────────────────
function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed dark textured backdrop, deep near-black editorial paper grain, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // translucent atmosphere (>=2 decor/background objects besides the scrim)
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'diagonal' }));
  o.push(...softGlow({ x: W - 220, y: 260, r: 520, color: palette.primary, intensity: 0.5 }));

  const marginX = 70;
  const headTop = 96;
  const headBottom = headlineZone(o, content, palette, fonts, { x: marginX, y: headTop, w: W - marginX * 2, maxSize: 104, align: 'left' });

  const blocks = (content.blocks || []).map((b, i) => ({ ...b, slotIdx: i + 1 }));

  const gridTop = Math.max(headBottom + 30, 420);
  const gridBottom = 1852;
  const gap = 26;
  const cellW = Math.round((W - marginX * 2 - gap) / 2);
  const cellH = Math.round((gridBottom - gridTop - gap) / 2);

  blocks.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = marginX + col * (cellW + gap);
    const y = gridTop + row * (cellH + gap);
    imageCell(o, b, palette, fonts, { x, y, w: cellW, h: cellH });
  });

  ctaLine(o, content.callToAction, palette, fonts, { x: marginX, y: 1900, w: W - marginX * 2, align: 'center' });
  return canvas;
}

// ── landscape: REAL relayout — 4-wide filmstrip of tall image cells ──────────
function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed dark textured backdrop, deep near-black editorial paper grain, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'horizontal' }));
  o.push(...softGlow({ x: 300, y: 220, r: 480, color: palette.primary, intensity: 0.5 }));

  const marginX = 70;
  const headTop = 74;
  const headBottom = headlineZone(o, content, palette, fonts, { x: marginX, y: headTop, w: W - marginX * 2, maxSize: 92, align: 'left' });

  const blocks = (content.blocks || []).map((b, i) => ({ ...b, slotIdx: i + 1 }));

  const stripTop = Math.max(headBottom + 24, 330);
  const stripBottom = 1290;
  const n = Math.max(blocks.length, 1);
  const gap = 24;
  const cellW = Math.round((W - marginX * 2 - gap * (n - 1)) / n);
  const cellH = stripBottom - stripTop;

  blocks.forEach((b, i) => {
    const x = marginX + i * (cellW + gap);
    imageCell(o, b, palette, fonts, { x, y: stripTop, w: cellW, h: cellH });
  });

  ctaLine(o, content.callToAction, palette, fonts, { x: marginX, y: 1320, w: W - marginX * 2, align: 'center' });
  return canvas;
}

// ── previews ─────────────────────────────────────────────────────────────────
function pvCell(parts, palette, { x, y, w, h }) {
  // the image region IS the cell
  parts.push(pvSlot(pv(x), pv(y), pv(w), pv(h), palette.primary));
  // dark scrim strip fading up from the bottom
  const stripH = h * 0.52;
  parts.push(pvRect(pv(x), pv(y + h - stripH), pv(w), pv(stripH), DARK_BASE, { rx: 3, opacity: 0.82 }));
  // woven heading (primary) + text (ink) bars over the strip
  parts.push(pvRect(pv(x + 34), pv(y + h - stripH * 0.62), pv(w * 0.6), pv(9), palette.primary, { rx: 4 }));
  parts.push(pvBars({ x: pv(x + 34), y: pv(y + h - stripH * 0.34), w: pv(w - 68), lines: 2, barH: 5, gap: 4, fill: DARK_INK }));
}

function pvGlow(parts, x, y, r, color) {
  parts.push(`<circle cx="${pv(x)}" cy="${pv(y)}" r="${pv(r)}" fill="${color}" opacity="0.1"/>`);
}

function previewPortrait(palette) {
  const parts = [];
  pvGlow(parts, 1194, 260, 520, palette.primary);
  parts.push(pvBars({ x: pv(70), y: pv(110), w: pv(1274), lines: 2, barH: 9, gap: 6, fill: DARK_INK }));
  const marginX = 70;
  const gridTop = 420;
  const gridBottom = 1852;
  const gap = 26;
  const cellW = Math.round((1414 - marginX * 2 - gap) / 2);
  const cellH = Math.round((gridBottom - gridTop - gap) / 2);
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    pvCell(parts, palette, {
      x: marginX + col * (cellW + gap), y: gridTop + row * (cellH + gap), w: cellW, h: cellH
    });
  }
  parts.push(pvBars({ x: pv(marginX), y: pv(1900), w: pv(1414 - marginX * 2), lines: 1, barH: 9, gap: 5, fill: palette.primary, align: 'center' }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [];
  pvGlow(parts, 300, 220, 480, palette.primary);
  parts.push(pvBars({ x: pv(70), y: pv(90), w: pv(2000 - 140), lines: 2, barH: 9, gap: 6, fill: DARK_INK }));
  const marginX = 70;
  const stripTop = 330;
  const stripBottom = 1290;
  const n = 4;
  const gap = 24;
  const cellW = Math.round((2000 - marginX * 2 - gap * (n - 1)) / n);
  const cellH = stripBottom - stripTop;
  for (let i = 0; i < n; i++) {
    pvCell(parts, palette, { x: marginX + i * (cellW + gap), y: stripTop, w: cellW, h: cellH });
  }
  parts.push(pvBars({ x: pv(marginX), y: pv(1320), w: pv(2000 - marginX * 2), lines: 1, barH: 9, gap: 5, fill: palette.primary, align: 'center' }));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'image-mosaic',
  name: 'Image mosaic',
  style: 'infographic',
  description: 'An image-first mosaic where four large editorial images ARE the layout: the pictures tile the canvas and each carries one block\'s short heading and line woven directly over its lower band, magazine-cover style. A dark gradient strip fades up from each cell so the type stays readable over any art. A full-bleed background image sits behind a legibility scrim, a compact headline rides the top, and a clean CTA line anchors the bottom. Portrait is a 2x2 grid of big image cells; landscape relayouts into a 4-wide filmstrip of tall cells.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'panels', min: 4, max: 4, fields: ['heading', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 4
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
