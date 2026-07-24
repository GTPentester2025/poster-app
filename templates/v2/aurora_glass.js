// v2 template — aurora-glass (style: infographic). Premium fintech dashboard poster:
// 2-3 large low-opacity aurora radial glow washes (via meshGlow/softGlow from decor)
// fill the dark canvas with teal/violet/primary colour cloud, then floating glass
// cards (translucent DARK_PANEL surface, hairline primary stroke, soft highlight)
// hold the content blocks. Each card has a bound image slot (blockId). Portrait: a
// tall headline zone at top, then glass cards in a staggered 2-col grid. Landscape:
// REAL relayout — headline left column, glass card grid right. 3-4 blocks with 1
// image slot each (blockId bound) + 1 bg slot.

import {
  textbox, rect, imageSlot, backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, gradientWash, svgWrapO, PV_LAND_W,
  legibilityScrim, OVERLAY_TEXT_SHADOW,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM
} from './decor.js';

const CARD_R = 24;

// ── aurora wash: 3 large radial blooms ───────────────────────────────────────
function auroraWash(o, palette, W, H) {
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: DARK_BASE, direction: 'vertical', intensity: 0.9 }));
  o.push(...meshGlow({
    spots: [
      { x: Math.round(W * 0.18), y: Math.round(H * 0.28), r: Math.round(W * 0.48), color: palette.primary },
      { x: Math.round(W * 0.82), y: Math.round(H * 0.62), r: Math.round(W * 0.52), color: palette.accent },
      { x: Math.round(W * 0.50), y: Math.round(H * 0.05), r: Math.round(W * 0.38), color: palette.primary }
    ],
    intensity: 1
  }));
}

// ── floating glass card with image slot ──────────────────────────────────────
function glassCard(o, b, palette, fonts, { x, y, w, h, slotId, slotHint }) {
  // solid panel surface (no opacity — not a decor object, exempt from cap)
  o.push(rect({
    x, y, w, h, fill: DARK_PANEL, rx: CARD_R,
    shadow: { color: 'rgba(0,0,0,0.48)', blur: 36, offsetX: 0, offsetY: 14 },
    layerRole: 'background'
  }));
  // translucent primary hairline border
  o.push(rect({
    x, y, w, h, fill: 'transparent', stroke: palette.primary, strokeWidth: 2,
    rx: CARD_R, opacity: 0.18, layerRole: 'decor'
  }));
  // soft top highlight (thin bright bar inside top edge)
  o.push(rect({
    x: x + 20, y: y + 8, w: w - 40, h: 5, fill: palette.primary, rx: 2.5,
    opacity: 0.14, layerRole: 'decor'
  }));

  const padX = 36;
  const innerW = w - padX * 2;
  const slotH = slotId ? Math.max(Math.round(h * 0.38), 120) : 0;
  const imgY = y + 24;

  // per-block image slot (only when slotId is provided)
  if (slotId) {
    o.push(imageSlot({
      slotId, x: x + padX, y: imgY, w: innerW, h: slotH,
      styleHint: slotHint, stroke: palette.primary, blockId: b.id
    }));
  }

  // heading (heading field)
  const headTop = slotId ? imgY + slotH + 22 : y + 32;
  const headH = Math.round(h * 0.24);
  const headSize = fitFontSize(b.heading, { width: innerW, height: headH, maxSize: 56, minSize: 20 });
  o.push({
    ...textbox({
      text: b.heading, x: x + padX, y: headTop, w: innerW, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.primary,
      lineHeight: 1.06, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'heading'
  });

  // body text
  const bodyTop = headTop + estTextHeight(b.heading, headSize, innerW, 1.06) + 16;
  const bodyH = y + h - bodyTop - 28;
  const bodySize = fitFontSize(b.text, { width: innerW, height: Math.max(bodyH, 20), maxSize: 44, minSize: 16 });
  o.push({
    ...textbox({
      text: b.text, x: x + padX, y: bodyTop, w: innerW, fontSize: bodySize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
      lineHeight: 1.2, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'text'
  });
}

// ── CTA bar ───────────────────────────────────────────────────────────────────
function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 136, fill: DARK_PANEL, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: palette.primary, opacity: 0.18, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 160, height: 96, maxSize: 46, minSize: 30 });
  o.push(textbox({
    text, x: 80, y: y + Math.round((136 - estTextHeight(text, size, W - 160)) / 2),
    w: W - 160, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

// ── portrait: headline top, glass cards in 2-col staggered grid ──────────────
function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed dark aurora fintech background, soft glowing neon light wisps on near-black, premium atmosphere, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  auroraWash(o, palette, W, H);

  const margin = 80;
  const innerW = W - margin * 2;

  // headline
  const headSize = fitFontSize(content.headline, { width: innerW, height: 300, maxSize: 128, minSize: 40 });
  const headH = estTextHeight(content.headline, headSize, innerW);
  o.push(textbox({
    text: content.headline, x: margin, y: 88, w: innerW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align: 'left',
    lineHeight: 1.04, layerRole: 'headline', bgRef: DARK_BASE,
    shadow: OVERLAY_TEXT_SHADOW
  }));
  let cursor = 88 + headH + 18;

  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: innerW, height: 120, maxSize: 46, minSize: 16 });
    const subH = estTextHeight(content.subheadline, subSize, innerW);
    o.push(textbox({
      text: content.subheadline, x: margin, y: cursor, w: innerW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM, align: 'left',
      layerRole: 'subheadline', bgRef: DARK_BASE, shadow: OVERLAY_TEXT_SHADOW
    }));
    cursor += subH + 18;
  }

  // glass card grid (2 cols for 4 blocks, 1 col for 3)
  const blocks = content.blocks || [];
  const cardsTop = Math.max(cursor + 24, 400);
  const ctaH = 136;
  const ctaY = H - ctaH;
  const gap = 32;
  const n = blocks.length;
  const cols = n >= 4 ? 2 : 1;
  const colW = cols === 2 ? Math.round((innerW - gap) / 2) : Math.round(innerW * 0.8);
  const colX0 = cols === 1 ? Math.round((W - colW) / 2) : margin;
  const availH = ctaY - cardsTop;
  const rows = Math.ceil(n / cols);
  const cardH = Math.max(300, Math.round((availH - gap * (rows - 1)) / rows));

  const CARD_HINTS = [
    'fintech dashboard illustration, premium clean infographic, no text',
    'secure payment visual, modern flat design, no text',
    'data analytics chart abstract, clean blue tones, no text',
    'identity verification icon set, premium minimal, no text'
  ];

  // emit exactly 3 image slots (first 3 blocks) regardless of total count
  blocks.slice(0, 4).forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = colX0 + col * (colW + gap);
    const cy = cardsTop + row * (cardH + gap);
    glassCard(o, b, palette, fonts, {
      x: cx, y: cy, w: colW, h: cardH,
      slotId: i < 3 ? `slot-${i + 1}` : null,
      slotHint: i < 3 ? CARD_HINTS[i % CARD_HINTS.length] : null
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, ctaY);
  return canvas;
}

// ── landscape: REAL relayout — headline left, glass card grid right ───────────
function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed dark aurora fintech background, soft glowing neon light wisps on near-black, premium atmosphere, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  auroraWash(o, palette, W, H);

  const margin = 80;
  const divider = Math.round(W * 0.38);

  // left: headline zone
  const leftW = divider - margin - 24;
  const headSize = fitFontSize(content.headline, { width: leftW, height: H - 200, maxSize: 112, minSize: 40 });
  const headH = estTextHeight(content.headline, headSize, leftW);
  o.push(textbox({
    text: content.headline, x: margin, y: 96, w: leftW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align: 'left',
    lineHeight: 1.04, layerRole: 'headline', bgRef: DARK_BASE, shadow: OVERLAY_TEXT_SHADOW
  }));
  let leftCursor = 96 + headH + 20;

  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: leftW, height: 120, maxSize: 42, minSize: 16 });
    const subH = estTextHeight(content.subheadline, subSize, leftW);
    o.push(textbox({
      text: content.subheadline, x: margin, y: leftCursor, w: leftW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM, align: 'left',
      layerRole: 'subheadline', bgRef: DARK_BASE, shadow: OVERLAY_TEXT_SHADOW
    }));
    leftCursor += subH + 20;
  }

  // CTA in the left column bottom area
  const ctaSize = fitFontSize(content.callToAction, { width: leftW, height: 96, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text: content.callToAction, x: margin, y: H - 120, w: leftW, fontSize: ctaSize,
    fontFamily: fonts.head, fontWeight: '800', fill: palette.primary, align: 'left',
    layerRole: 'cta', bgRef: DARK_BASE, shadow: OVERLAY_TEXT_SHADOW
  }));

  // right: glass card grid
  const blocks = content.blocks || [];
  const gridX = divider + 16;
  const gridW = W - gridX - margin;
  const gridTop = 80;
  const gridBot = H - 80;
  const gap = 24;
  const n = blocks.length;
  const cols = n >= 4 ? 2 : 1;
  const colW = cols === 2 ? Math.round((gridW - gap) / 2) : gridW;
  const rows = Math.ceil(n / cols);
  const cardH = Math.max(200, Math.round((gridBot - gridTop - gap * (rows - 1)) / rows));

  const CARD_HINTS = [
    'fintech dashboard illustration, premium clean infographic, no text',
    'secure payment visual, modern flat design, no text',
    'data analytics chart abstract, clean blue tones, no text',
    'identity verification icon set, premium minimal, no text'
  ];

  // emit exactly 3 image slots (first 3 blocks) regardless of total count
  blocks.slice(0, 4).forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = gridX + col * (colW + gap);
    const cy = gridTop + row * (cardH + gap);
    glassCard(o, b, palette, fonts, {
      x: cx, y: cy, w: colW, h: cardH,
      slotId: i < 3 ? `slot-${i + 1}` : null,
      slotHint: i < 3 ? CARD_HINTS[i % CARD_HINTS.length] : null
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
  // aurora glows
  parts.push(`<circle cx="${pv(W * 0.18)}" cy="${pv(H * 0.28)}" r="${pv(W * 0.48)}" fill="${palette.primary}" opacity="0.08"/>`);
  parts.push(`<circle cx="${pv(W * 0.82)}" cy="${pv(H * 0.62)}" r="${pv(W * 0.52)}" fill="${palette.accent}" opacity="0.07"/>`);
  // headline
  parts.push(pvBars({ x: pv(margin), y: pv(88), w: pv(innerW), lines: 2, barH: 10, gap: 5, fill: DARK_INK }));
  // glass cards 2x2
  const cardsTop = 400;
  const gap = 32;
  const colW = Math.round((innerW - gap) / 2);
  const cardH = 340;
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = margin + col * (colW + gap);
    const cy = cardsTop + row * (cardH + gap);
    parts.push(pvRect(pv(cx), pv(cy), pv(colW), pv(cardH), DARK_PANEL, { rx: 5 }));
    parts.push(pvRect(pv(cx), pv(cy), pv(colW), pv(cardH), 'none', { rx: 5, stroke: palette.primary, opacity: 0.5 }));
    const slotH = Math.round(cardH * 0.38);
    parts.push(pvSlot(pv(cx + 36), pv(cy + 24), pv(colW - 72), pv(slotH), palette.primary));
    parts.push(pvRect(pv(cx + 36), pv(cy + 24 + slotH + 22), pv((colW - 72) * 0.62), pv(18), palette.primary, { rx: 3 }));
    parts.push(pvBars({ x: pv(cx + 36), y: pv(cy + 24 + slotH + 58), w: pv(colW - 72), lines: 2, barH: 4, gap: 3, fill: DARK_INK }));
  }
  // CTA bar
  parts.push(pvRect(0, pv(H - 136), 200, pv(136), DARK_PANEL));
  parts.push(pvRect(pv(margin * 2), pv(H - 136 + 20), pv(innerW - margin * 2), pv(22), palette.primary, { rx: 3 }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000; const H = 1414;
  const margin = 80;
  const divider = Math.round(W * 0.38);
  const parts = [];
  parts.push(`<circle cx="${pv(W * 0.18)}" cy="${pv(H * 0.28)}" r="${pv(W * 0.48)}" fill="${palette.primary}" opacity="0.08"/>`);
  parts.push(`<circle cx="${pv(W * 0.82)}" cy="${pv(H * 0.62)}" r="${pv(W * 0.52)}" fill="${palette.accent}" opacity="0.07"/>`);
  // headline left
  const leftW = divider - margin - 24;
  parts.push(pvBars({ x: pv(margin), y: pv(96), w: pv(leftW), lines: 3, barH: 9, gap: 5, fill: DARK_INK }));
  parts.push(pvRect(pv(margin), pv(H - 120), pv(leftW * 0.6), pv(22), palette.primary, { rx: 3 }));
  // glass cards right 2x2
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
    parts.push(pvRect(pv(cx), pv(cy), pv(colW), pv(cardH), DARK_PANEL, { rx: 5 }));
    parts.push(pvRect(pv(cx), pv(cy), pv(colW), pv(cardH), 'none', { rx: 5, stroke: palette.primary, opacity: 0.5 }));
    const slotH = Math.round(cardH * 0.38);
    parts.push(pvSlot(pv(cx + 36), pv(cy + 24), pv(colW - 72), pv(slotH), palette.primary));
    parts.push(pvRect(pv(cx + 36), pv(cy + 24 + slotH + 16), pv((colW - 72) * 0.55), pv(14), palette.primary, { rx: 3 }));
    parts.push(pvBars({ x: pv(cx + 36), y: pv(cy + 24 + slotH + 42), w: pv(colW - 72), lines: 1, barH: 4, gap: 3, fill: DARK_INK }));
  }
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'aurora-glass',
  name: 'Aurora glass',
  style: 'infographic',
  description: 'Premium fintech dashboard poster: 2-3 large low-opacity aurora radial glow washes (primary + accent mesh) fill the dark canvas with a soft colour cloud, then floating glass cards — translucent DARK_PANEL surfaces with hairline strokes and a soft top highlight — hold the content blocks, each with a bound per-block image slot. Portrait stacks cards in a 2-col grid under a bold headline; landscape splits headline left, card grid right.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'panels', min: 3, max: 4, fields: ['heading', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 3
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
