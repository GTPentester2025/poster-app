// v2 template — photo-essay (style: infographic). Premium documentary magazine
// photo-essay spread: 3-4 large photo cards, each a full honest image slot with
// a dark legibility scrim strip at the bottom holding the block's heading and
// body text. An editorial kicker + headline runs across the top. blockId binds
// each slot to its content block. Portrait: editorial header, then 2-col photo
// card grid. Landscape: REAL relayout — editorial header left column, photo
// card grid right (2-col). Feel: premium documentary feature.

import {
  textbox, rect, imageSlot, backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, softGlow, legibilityScrim,
  linearGradientFill, svgWrapO, PV_LAND_W, OVERLAY_TEXT_SHADOW,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM
} from './decor.js';

const CARD_R = 16;

const PHOTO_HINTS = [
  'documentary editorial photograph, dramatic natural lighting, reportage style, no text',
  'photojournalistic image, candid moment, rich contrast, authentic, no text',
  'magazine feature photograph, cinematic composition, moody atmosphere, no text',
  'editorial documentary photograph, sharp focus, powerful subject, no text'
];

// ── backdrop: subtle diagonal wash + soft glow (>=2 translucent decor) ───────
function backdrop(o, palette, W, H) {
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: DARK_BASE, direction: 'diagonal', intensity: 0.8 }));
  o.push(...softGlow({ x: Math.round(W * 0.85), y: Math.round(H * 0.15), r: Math.round(W * 0.32), color: palette.accent, intensity: 0.75 }));
}

// ── caption scrim strip on a photo card ──────────────────────────────────────
// A dark gradient that sits over the bottom of a photo slot, holding the
// block's heading and text. layerRole 'scrim' → exempt from the 0.2 cap.
function captionScrim(o, { x, y, w, h }) {
  const scrimH = Math.round(h * 0.45);
  o.push(rect({
    x, y: y + h - scrimH, w, h: scrimH,
    fill: linearGradientFill({
      x1: 0, y1: 0, x2: 0, y2: scrimH,
      stops: [{ offset: 0, color: 'rgba(0,0,0,0)' }, { offset: 1, color: DARK_BASE }]
    }),
    opacity: 0.58, layerRole: 'scrim', rx: CARD_R
  }));
}

// ── one photo card: slot + scrim + heading + text overlaid ────────────────────
function photoCard(o, b, palette, fonts, { x, y, w, h, slotId, hint }) {
  // thin card frame
  o.push(rect({
    x, y, w, h, fill: DARK_PANEL, rx: CARD_R,
    shadow: { color: 'rgba(0,0,0,0.5)', blur: 32, offsetX: 0, offsetY: 12 },
    layerRole: 'background'
  }));

  // honest image slot covers the full card
  o.push(imageSlot({ slotId, x, y, w, h, styleHint: hint, stroke: palette.primary, rx: CARD_R, blockId: b.id }));

  // caption scrim over bottom of the slot
  captionScrim(o, { x, y, w, h });

  // caption text over the scrim
  const padX = 24;
  const innerW = w - padX * 2;
  const scrimH = Math.round(h * 0.45);
  const captionTop = y + h - scrimH + 20;

  // heading (bold, primary)
  const headSize = fitFontSize(b.heading, { width: innerW, height: Math.round(scrimH * 0.45), maxSize: 52, minSize: 20 });
  const headH = estTextHeight(b.heading, headSize, innerW, 1.06);
  o.push({
    ...textbox({
      text: b.heading, x: x + padX, y: captionTop, w: innerW, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
      lineHeight: 1.06, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE,
      shadow: OVERLAY_TEXT_SHADOW
    }),
    fieldRef: 'heading'
  });

  // body text (off-white dim)
  const bodyTop = captionTop + headH + 12;
  const bodyH = y + h - bodyTop - 20;
  const bodySize = fitFontSize(b.text, { width: innerW, height: Math.max(bodyH, 60), maxSize: 40, minSize: 20 });
  o.push({
    ...textbox({
      text: b.text, x: x + padX, y: bodyTop, w: innerW, fontSize: bodySize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
      lineHeight: 1.18, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE,
      shadow: OVERLAY_TEXT_SHADOW
    }),
    fieldRef: 'text'
  });
}

// ── editorial header: kicker chip + headline + subheadline ───────────────────
function editorialHeader(o, content, palette, fonts, { x, y, w, maxHeadSize }) {
  // kicker pill (CTA text doubles as the editorial kicker label here)
  const kickerH = 48;
  o.push(rect({ x, y, w: Math.round(w * 0.24), h: kickerH, fill: palette.primary, rx: kickerH / 2, layerRole: 'background' }));

  let cursor = y + kickerH + 24;

  // headline
  const headSize = fitFontSize(content.headline, { width: w, height: 400, maxSize: maxHeadSize, minSize: 40 });
  const headH = estTextHeight(content.headline, headSize, w);
  o.push(textbox({
    text: content.headline, x, y: cursor, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align: 'left',
    lineHeight: 1.04, layerRole: 'headline', bgRef: DARK_BASE, shadow: OVERLAY_TEXT_SHADOW
  }));
  cursor += headH + 16;

  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 44, minSize: 16 });
    const subH = estTextHeight(content.subheadline, subSize, w);
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM, align: 'left',
      layerRole: 'subheadline', bgRef: DARK_BASE, shadow: OVERLAY_TEXT_SHADOW
    }));
    cursor += subH + 16;
  }

  return cursor;
}

// ── CTA ───────────────────────────────────────────────────────────────────────
function ctaZone(o, text, palette, fonts, { x, y, w }) {
  const size = fitFontSize(text, { width: w, height: 80, maxSize: 44, minSize: 16 });
  o.push(textbox({
    text, x, y, w, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'left', layerRole: 'cta', bgRef: DARK_BASE,
    shadow: OVERLAY_TEXT_SHADOW
  }));
}

// ── portrait: editorial header top, 2-col photo card grid below ──────────────
function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed dark documentary editorial backdrop, rich atmospheric, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  backdrop(o, palette, W, H);

  const margin = 80;
  const innerW = W - margin * 2;

  // editorial header
  const headerBottom = editorialHeader(o, content, palette, fonts, { x: margin, y: 80, w: innerW, maxHeadSize: 128 });

  // photo card grid: 2 cols
  const blocks = content.blocks || [];
  const gap = 32;
  const ctaH = 96;
  const cardsTop = headerBottom + 24;
  const cardsBottom = H - ctaH - 48;
  const cols = 2;
  const colW = Math.round((innerW - gap) / 2);
  const rows = Math.ceil(blocks.length / cols);
  const cardH = Math.max(280, Math.round((cardsBottom - cardsTop - gap * (rows - 1)) / rows));

  blocks.slice(0, 4).forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = margin + col * (colW + gap);
    const cy = cardsTop + row * (cardH + gap);
    photoCard(o, b, palette, fonts, {
      x: cx, y: cy, w: colW, h: cardH,
      slotId: `slot-${i + 1}`,
      hint: PHOTO_HINTS[i % PHOTO_HINTS.length]
    });
  });

  ctaZone(o, content.callToAction, palette, fonts, { x: margin, y: H - ctaH, w: innerW });
  return canvas;
}

// ── landscape: REAL relayout — editorial header left, 2-col photo grid right ──
function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed dark documentary editorial backdrop, rich atmospheric, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  backdrop(o, palette, W, H);

  const margin = 80;
  const divider = Math.round(W * 0.36);
  const leftW = divider - margin - 24;

  // editorial header in left column
  const headerBottom = editorialHeader(o, content, palette, fonts, { x: margin, y: 80, w: leftW, maxHeadSize: 104 });

  // CTA left column bottom
  ctaZone(o, content.callToAction, palette, fonts, { x: margin, y: H - 104, w: leftW });

  // photo card grid right: 2 cols
  const blocks = content.blocks || [];
  const gridX = divider + 16;
  const gridW = W - gridX - margin;
  const gap = 24;
  const cols = 2;
  const colW = Math.round((gridW - gap) / 2);
  const rows = Math.ceil(blocks.length / cols);
  const cardH = Math.max(200, Math.round((H - 80 - 80 - gap * (rows - 1)) / rows));

  blocks.slice(0, 4).forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = gridX + col * (colW + gap);
    const cy = 80 + row * (cardH + gap);
    photoCard(o, b, palette, fonts, {
      x: cx, y: cy, w: colW, h: cardH,
      slotId: `slot-${i + 1}`,
      hint: PHOTO_HINTS[i % PHOTO_HINTS.length]
    });
  });

  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────
function previewPortrait(palette) {
  const W = 1414; const H = 2000;
  const margin = 80;
  const innerW = W - margin * 2;
  const parts = [];
  parts.push(`<circle cx="${pv(W * 0.85)}" cy="${pv(H * 0.15)}" r="${pv(W * 0.32)}" fill="${palette.accent}" opacity="0.07"/>`);
  // kicker
  parts.push(pvRect(pv(margin), pv(80), pv(innerW * 0.24), pv(22), palette.primary, { rx: 11 }));
  // headline
  parts.push(pvBars({ x: pv(margin), y: pv(116), w: pv(innerW), lines: 2, barH: 14, gap: 7, fill: DARK_INK }));
  // subheadline
  parts.push(pvRect(pv(margin), pv(175), pv(innerW * 0.55), pv(12), DARK_INK_DIM, { rx: 3 }));
  // photo cards 2x2
  const gap = 32;
  const colW = Math.round((innerW - gap) / 2);
  const cardH = 340;
  const cardsTop = 220;
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = margin + col * (colW + gap);
    const cy = cardsTop + row * (cardH + gap);
    parts.push(pvSlot(pv(cx), pv(cy), pv(colW), pv(cardH), palette.primary));
    const scrimY = cy + Math.round(cardH * 0.55);
    const scrimH = cardH - Math.round(cardH * 0.55);
    parts.push(pvRect(pv(cx), pv(scrimY), pv(colW), pv(scrimH), DARK_BASE, { opacity: 0.55, rx: 4 }));
    parts.push(pvRect(pv(cx + 24), pv(scrimY + 16), pv(colW * 0.55), pv(14), DARK_INK, { rx: 3 }));
    parts.push(pvBars({ x: pv(cx + 24), y: pv(scrimY + 42), w: pv(colW - 48), lines: 2, barH: 4, gap: 3, fill: DARK_INK_DIM }));
  }
  // CTA
  parts.push(pvRect(pv(margin), pv(H - 96), pv(innerW * 0.5), pv(24), palette.primary, { rx: 3 }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000; const H = 1414;
  const margin = 80;
  const divider = Math.round(W * 0.36);
  const leftW = divider - margin - 24;
  const parts = [];
  parts.push(`<circle cx="${pv(W * 0.85)}" cy="${pv(H * 0.15)}" r="${pv(W * 0.32)}" fill="${palette.accent}" opacity="0.07"/>`);
  // header left
  parts.push(pvRect(pv(margin), pv(80), pv(leftW * 0.24), pv(20), palette.primary, { rx: 10 }));
  parts.push(pvBars({ x: pv(margin), y: pv(114), w: pv(leftW), lines: 3, barH: 11, gap: 6, fill: DARK_INK }));
  parts.push(pvRect(pv(margin), pv(168), pv(leftW * 0.5), pv(10), DARK_INK_DIM, { rx: 3 }));
  parts.push(pvRect(pv(margin), pv(H - 104), pv(leftW * 0.5), pv(20), palette.primary, { rx: 3 }));
  // photo cards 2x2 right
  const gridX = divider + 16;
  const gridW = W - gridX - margin;
  const gap = 24;
  const colW = Math.round((gridW - gap) / 2);
  const cardH = Math.round((H - 80 - 80 - gap) / 2);
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = gridX + col * (colW + gap);
    const cy = 80 + row * (cardH + gap);
    parts.push(pvSlot(pv(cx), pv(cy), pv(colW), pv(cardH), palette.primary));
    const scrimY = cy + Math.round(cardH * 0.55);
    const scrimH = cardH - Math.round(cardH * 0.55);
    parts.push(pvRect(pv(cx), pv(scrimY), pv(colW), pv(scrimH), DARK_BASE, { opacity: 0.55, rx: 4 }));
    parts.push(pvRect(pv(cx + 24), pv(scrimY + 14), pv(colW * 0.55), pv(12), DARK_INK, { rx: 3 }));
    parts.push(pvBars({ x: pv(cx + 24), y: pv(scrimY + 36), w: pv(colW - 48), lines: 1, barH: 4, gap: 3, fill: DARK_INK_DIM }));
  }
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'photo-essay',
  name: 'Photo essay',
  style: 'infographic',
  description: 'Premium documentary magazine photo-essay spread: 3-4 large photo cards each hold an honest image slot (blockId bound) with a dark gradient scrim strip over the bottom, overlaid with the block heading and body text. An editorial kicker pill, bold headline, and optional subheadline run across the top. Portrait stacks cards in a 2-col grid under the header; landscape places the editorial column left, card grid right.',
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
