// v2 template — split-panorama (style: infographic). Modern product-launch keynote:
// a wide panoramic hero image band dominates the top (portrait) or left (landscape),
// with clean numbered-step cards below/right carrying each block. The hero image slot
// spans the full width in portrait and the full left column in landscape. Step cards
// each show a large accent numeral, a bold heading in primary, and off-white body text
// on a DARK_PANEL surface. Image slot per block (blockId bound) when count <= 4.
// Portrait: panoramic hero at top ~45%, numbered step cards in a 2-col grid below.
// Landscape: REAL relayout — hero fills the left ~50%, step cards stack in a right column.

import {
  textbox, rect, imageSlot, backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, softGlow, svgWrapO, PV_LAND_W,
  legibilityScrim, linearGradientFill, OVERLAY_TEXT_SHADOW,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM
} from './decor.js';

const HERO_HINT = 'wide panoramic product-launch hero photograph, cinematic dramatic lighting, clean modern composition, no text';
const BLOCK_HINTS = [
  'step illustration, clean flat product photography, minimal, no text',
  'step illustration, bright modern workspace, depth of field, no text',
  'step illustration, close-up product detail, clean background, no text',
  'step illustration, team collaboration, modern office, no text',
  'step illustration, clean abstract concept, premium look, no text'
];

const CARD_R = 20;

// ── backdrop: diagonal wash + soft accent glow ────────────────────────────────
function backdrop(o, palette, W, H) {
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: DARK_BASE, direction: 'diagonal', intensity: 1 }));
  o.push(...softGlow({ x: Math.round(W * 0.65), y: Math.round(H * 0.25), r: Math.round(W * 0.38), color: palette.accent, intensity: 0.9 }));
}

// ── step card: panel surface + large numeral + heading + text ─────────────────
function stepCard(o, b, idx, palette, fonts, { x, y, w, h, slotId, slotHint }) {
  // DARK_PANEL surface
  o.push(rect({
    x, y, w, h, fill: DARK_PANEL, rx: CARD_R,
    shadow: { color: 'rgba(0,0,0,0.40)', blur: 28, offsetX: 0, offsetY: 12 },
    layerRole: 'background'
  }));
  // thin primary hairline
  o.push(rect({
    x, y, w, h, fill: 'transparent', stroke: palette.primary, strokeWidth: 2,
    rx: CARD_R, opacity: 0.16, layerRole: 'decor'
  }));

  const padX = 40;
  const padY = 32;
  const innerW = w - padX * 2;
  const cardBottom = y + h;  // hard lower boundary of this card

  // large accent numeral — scale with card height to stay within card
  const numStr = String(idx + 1).padStart(2, '0');
  // numBudget: space from numStr top to heading top minus 8px; heading occupies ~35% of remaining card
  const numBudget = Math.round(h * 0.22);
  const numSize = Math.min(88, Math.max(24, numBudget));
  o.push(textbox({
    text: numStr, x: x + padX, y: y + padY, w: 120,
    fontSize: numSize, fontFamily: fonts.head, fontWeight: '900',
    fill: palette.accent, align: 'left', lineHeight: 1,
    layerRole: 'message-label', bgRef: DARK_PANEL
  }));

  // heading (label field)
  const headTop = y + padY + numSize + 16;
  // headBudget: from headTop to 50% of remaining card space, so body has room too
  const headBudget = Math.max(Math.round((cardBottom - headTop) * 0.40), 20);
  const headSize = fitFontSize(b.label, { width: innerW, height: headBudget, maxSize: 56, minSize: 14 });
  o.push({
    ...textbox({
      text: b.label, x: x + padX, y: headTop, w: innerW, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.primary,
      lineHeight: 1.05, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'label'
  });

  // body text — bounded strictly to card bottom minus slot reserve
  const bodyTop = headTop + estTextHeight(b.label, headSize, innerW, 1.05) + 16;
  const slotReserve = slotId ? Math.round(h * 0.30) + 16 : padY;
  const bodyBudget = Math.max(cardBottom - bodyTop - slotReserve - 8, 14);
  const bodySize = fitFontSize(b.text, { width: innerW, height: bodyBudget, maxSize: 44, minSize: 14 });
  o.push({
    ...textbox({
      text: b.text, x: x + padX, y: bodyTop, w: innerW, fontSize: bodySize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
      lineHeight: 1.2, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'text'
  });

  // optional per-block image slot at card bottom
  if (slotId) {
    const slotH = Math.max(Math.round(h * 0.28), 120);
    const slotY = y + h - slotH - padY;
    o.push(imageSlot({
      slotId, x: x + padX, y: slotY, w: innerW, h: slotH,
      styleHint: slotHint, stroke: palette.primary, blockId: b.id
    }));
  }
}

// ── CTA bar ───────────────────────────────────────────────────────────────────
function ctaBar(o, text, palette, fonts, { x, y, w }) {
  const size = fitFontSize(text, { width: w, height: 96, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text, x, y, w, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.accent, align: 'left', layerRole: 'cta', bgRef: DARK_BASE,
    shadow: OVERLAY_TEXT_SHADOW
  }));
}

// ── portrait: panoramic hero top ~45%, 2-col step grid below ─────────────────
function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'wide panoramic dark keynote backdrop, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  backdrop(o, palette, W, H);

  const margin = 80;
  const innerW = W - margin * 2;

  // headline zone
  const headSize = fitFontSize(content.headline, { width: innerW, height: 280, maxSize: 120, minSize: 40 });
  const headH = estTextHeight(content.headline, headSize, innerW);
  o.push(textbox({
    text: content.headline, x: margin, y: 88, w: innerW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align: 'left',
    lineHeight: 1.04, layerRole: 'headline', bgRef: DARK_BASE,
    shadow: OVERLAY_TEXT_SHADOW
  }));
  let cursor = 88 + headH + 16;

  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: innerW, height: 120, maxSize: 46, minSize: 16 });
    const subH = estTextHeight(content.subheadline, subSize, innerW);
    o.push(textbox({
      text: content.subheadline, x: margin, y: cursor, w: innerW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM, align: 'left',
      layerRole: 'subheadline', bgRef: DARK_BASE, shadow: OVERLAY_TEXT_SHADOW
    }));
    cursor += subH + 16;
  }

  // step grid geometry (computed first so the hero can size to leave card room)
  const blocks = content.blocks || [];
  const gap = 32;
  const cols = Math.min(2, Math.max(blocks.length, 1));
  const colW = cols === 2 ? Math.round((innerW - gap) / 2) : innerW;
  const rows = Math.ceil(Math.max(blocks.length, 1) / cols);
  const ctaH = 100;
  const cardMinH = 224;
  const cardsNeed = rows * cardMinH + gap * (rows - 1);

  // panoramic hero image slot — height adapts so the card grid + CTA always fit
  const heroY = cursor + 16;
  const heroMax = H - heroY - 40 - cardsNeed - ctaH - 48;
  const heroH = Math.max(260, Math.min(700, heroMax));
  o.push(imageSlot({ slotId: 'slot-1', x: margin, y: heroY, w: innerW, h: heroH, styleHint: HERO_HINT, stroke: palette.primary }));

  // dark gradient overlay on hero bottom so cards blend in
  o.push(rect({
    x: margin, y: heroY + heroH - 200, w: innerW, h: 200,
    fill: linearGradientFill({ x1: 0, y1: 0, x2: 0, y2: 200, stops: [{ offset: 0, color: DARK_BASE }, { offset: 1, color: DARK_BASE }] }),
    opacity: 0.55, layerRole: 'scrim'
  }));

  // step cards in a 2-col grid — card height derived from real available space
  const cardsTop = heroY + heroH + 40;
  const availH = H - cardsTop - ctaH - 48;
  const cardH = Math.max(180, Math.round((availH - gap * (rows - 1)) / rows));

  blocks.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = margin + col * (colW + gap);
    const cy = cardsTop + row * (cardH + gap);
    // No per-block slots in portrait (hero already has slot-1, keep imageSlots = 1)
    stepCard(o, b, i, palette, fonts, { x: cx, y: cy, w: colW, h: cardH, slotId: null, slotHint: null });
  });

  ctaBar(o, content.callToAction, palette, fonts, { x: margin, y: H - 120, w: innerW });
  return canvas;
}

// ── landscape: REAL relayout — hero fills left ~50%, step cards stack right ───
function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'wide panoramic dark keynote backdrop, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  backdrop(o, palette, W, H);

  const margin = 80;
  const divider = Math.round(W * 0.50);

  // left panel: headline + subheadline at top, hero image below
  const heroX = margin;
  const headW = divider - margin - 24;

  // headline at the top of the left column
  const headSize = fitFontSize(content.headline, { width: headW, height: 240, maxSize: 96, minSize: 40 });
  const headH = estTextHeight(content.headline, headSize, headW);
  o.push(textbox({
    text: content.headline, x: heroX, y: 80, w: headW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align: 'left',
    lineHeight: 1.04, layerRole: 'headline', bgRef: DARK_BASE, shadow: OVERLAY_TEXT_SHADOW
  }));
  let leftCursor = 80 + headH + 16;

  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: headW, height: 80, maxSize: 40, minSize: 16 });
    const subH = estTextHeight(content.subheadline, subSize, headW);
    o.push(textbox({
      text: content.subheadline, x: heroX, y: leftCursor, w: headW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM, align: 'left',
      layerRole: 'subheadline', bgRef: DARK_BASE, shadow: OVERLAY_TEXT_SHADOW
    }));
    leftCursor += subH + 16;
  }

  // hero image below headline
  const heroY = leftCursor + 8;
  const heroW = headW;
  const heroH = Math.max(200, H - heroY - 96);
  o.push(imageSlot({ slotId: 'slot-1', x: heroX, y: heroY, w: heroW, h: heroH, styleHint: HERO_HINT, stroke: palette.primary }));

  // scrim strip at bottom of hero
  const scrimH = Math.min(280, Math.round(heroH * 0.35));
  o.push(rect({
    x: heroX, y: heroY + heroH - scrimH, w: heroW, h: scrimH,
    fill: linearGradientFill({ x1: 0, y1: 0, x2: 0, y2: scrimH, stops: [{ offset: 0, color: DARK_BASE }, { offset: 1, color: DARK_BASE }] }),
    opacity: 0.55, layerRole: 'scrim'
  }));

  // right panel: step cards stacked
  const colX = divider + 24;
  const colW = W - colX - margin;
  const colTop = 80;
  const ctaH = 80;
  const blocks = content.blocks || [];
  const gap = 24;
  const colH = H - colTop - ctaH - 48;
  const n = Math.max(blocks.length, 1);
  const cardH = Math.max(180, Math.round((colH - gap * (n - 1)) / n));

  blocks.forEach((b, i) => {
    const cy = colTop + i * (cardH + gap);
    stepCard(o, b, i, palette, fonts, { x: colX, y: cy, w: colW, h: cardH, slotId: null, slotHint: null });
  });

  ctaBar(o, content.callToAction, palette, fonts, { x: margin, y: H - 104, w: W - margin * 2 });
  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────
function previewPortrait(palette) {
  const W = 1414; const H = 2000;
  const margin = 80;
  const innerW = W - margin * 2;
  const parts = [];
  // soft glow
  parts.push(`<circle cx="${pv(W * 0.65)}" cy="${pv(H * 0.25)}" r="${pv(W * 0.38)}" fill="${palette.accent}" opacity="0.08"/>`);
  // headline bars
  parts.push(pvBars({ x: pv(margin), y: pv(88), w: pv(innerW), lines: 2, barH: 9, gap: 5, fill: DARK_INK }));
  // hero slot
  const heroY = 280;
  const heroH = 700;
  parts.push(pvSlot(pv(margin), pv(heroY), pv(innerW), pv(heroH), palette.primary));
  parts.push(pvRect(pv(margin), pv(heroY + heroH - 200), pv(innerW), pv(200), DARK_BASE, { opacity: 0.55 }));
  // step cards
  const cardsTop = heroY + heroH + 40;
  const gap = 32;
  const colW = Math.round((innerW - gap) / 2);
  const cardH = 260;
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = margin + col * (colW + gap);
    const cy = cardsTop + row * (cardH + gap);
    parts.push(pvRect(pv(cx), pv(cy), pv(colW), pv(cardH), DARK_PANEL, { rx: 4 }));
    parts.push(pvRect(pv(cx), pv(cy), pv(colW), pv(cardH), 'none', { rx: 4, stroke: palette.primary, opacity: 0.4 }));
    parts.push(pvRect(pv(cx + 40), pv(cy + 32), pv(40), pv(38), palette.accent, { rx: 3 }));
    parts.push(pvRect(pv(cx + 40), pv(cy + 90), pv(colW * 0.55), pv(20), palette.primary, { rx: 3 }));
    parts.push(pvBars({ x: pv(cx + 40), y: pv(cy + 125), w: pv(colW - 80), lines: 2, barH: 4, gap: 4, fill: DARK_INK }));
  }
  // CTA
  parts.push(pvRect(pv(margin), pv(H - 96), pv(innerW * 0.55), pv(28), palette.accent, { rx: 3 }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000; const H = 1414;
  const margin = 80;
  const divider = Math.round(W * 0.50);
  const parts = [];
  parts.push(`<circle cx="${pv(W * 0.65)}" cy="${pv(H * 0.25)}" r="${pv(W * 0.38)}" fill="${palette.accent}" opacity="0.08"/>`);
  // hero slot left
  const heroW = divider - margin - 24;
  const heroH = H - 80 - 200;
  parts.push(pvSlot(pv(margin), pv(80), pv(heroW), pv(heroH), palette.primary));
  parts.push(pvRect(pv(margin), pv(80 + heroH - 280), pv(heroW), pv(280), DARK_BASE, { opacity: 0.55 }));
  // headline left bottom
  parts.push(pvBars({ x: pv(margin), y: pv(80 + heroH + 24), w: pv(heroW), lines: 2, barH: 8, gap: 5, fill: DARK_INK }));
  // right cards
  const colX = divider + 24;
  const colW = W - colX - margin;
  const gap = 24;
  const cardH = Math.round((H - 80 - 80 - 48 - gap * 3) / 4);
  for (let i = 0; i < 4; i++) {
    const cy = 80 + i * (cardH + gap);
    parts.push(pvRect(pv(colX), pv(cy), pv(colW), pv(cardH), DARK_PANEL, { rx: 4 }));
    parts.push(pvRect(pv(colX), pv(cy), pv(colW), pv(cardH), 'none', { rx: 4, stroke: palette.primary, opacity: 0.4 }));
    parts.push(pvRect(pv(colX + 40), pv(cy + 20), pv(36), pv(32), palette.accent, { rx: 3 }));
    parts.push(pvRect(pv(colX + 40), pv(cy + 68), pv(colW * 0.55), pv(16), palette.primary, { rx: 3 }));
    parts.push(pvBars({ x: pv(colX + 40), y: pv(cy + 98), w: pv(colW - 80), lines: 1, barH: 4, gap: 4, fill: DARK_INK }));
  }
  parts.push(pvRect(pv(margin), pv(H - 72), pv((W - margin * 2) * 0.5), pv(28), palette.accent, { rx: 3 }));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'split-panorama',
  name: 'Split panorama',
  style: 'infographic',
  description: 'Modern product-launch keynote: a wide panoramic hero image band dominates the top (portrait) or left column (landscape), with clean numbered step cards below/right. Each card shows a large accent numeral, bold primary heading, and off-white body text on a raised charcoal panel. A diagonal gradient wash and accent glow set the atmospheric backdrop. Portrait stacks cards in a 2-col grid under the hero; landscape splits hero left, step stack right.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'sequence', min: 3, max: 5, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
