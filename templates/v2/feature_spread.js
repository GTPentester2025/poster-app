// v2 template — feature-spread (style: infographic). A magazine FEATURE SPREAD:
// one big hero image carrying the headline (over a dark gradient scrim strip),
// then a row (portrait) / column (landscape) of three supporting IMAGE cards,
// each an honest image slot with its block HEADING (primary) + TEXT (off-white)
// beneath it. Image-dominant, premium, no code-drawn tiles/pills as decoration —
// real images + clean type only. slot-1 = hero; slot-2..slot-4 = one image per
// block. Portrait: hero across the top ~half, three cards in a row below.
// Landscape: REAL relayout — hero fills the left ~55%, three cards stacked right.

import {
  textbox, rect, imageSlot, backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, softGlow, meshGlow, cornerFrame,
  svgWrapO, PV_LAND_W,
  legibilityScrim, linearGradientFill, OVERLAY_TEXT_SHADOW,
  DARK_BASE, DARK_INK, DARK_INK_DIM
} from './decor.js';

const HERO_HINT = 'full-bleed premium editorial hero photograph, cinematic dramatic lighting, no text';
const CARD_HINTS = [
  'supporting editorial photograph, clean depth of field, no text',
  'supporting editorial photograph, moody focused subject, no text',
  'supporting editorial photograph, bright modern composition, no text'
];

// ── decor: mesh glow + gradient wash ─────────────────────────────────────────
function backdrop(o, palette, W, H) {
  o.push(...meshGlow({
    spots: [
      { x: Math.round(W * 0.72), y: Math.round(H * 0.28), r: Math.round(W * 0.38), color: palette.accent },
      { x: Math.round(W * 0.18), y: Math.round(H * 0.72), r: Math.round(W * 0.28), color: palette.primary }
    ], intensity: 0.75
  }));
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: DARK_BASE, direction: 'diagonal', intensity: 1 }));
}

// A dark gradient strip that sits over the bottom of the hero image so the
// overlaid headline stays legible. layerRole 'scrim' → exempt from the decor cap.
function heroScrimStrip(o, { x, y, w, h }) {
  o.push(rect({
    x, y, w, h,
    fill: linearGradientFill({ x1: 0, y1: 0, x2: 0, y2: h, stops: [{ offset: 0, color: DARK_BASE }, { offset: 1, color: DARK_BASE }] }),
    opacity: 0.60, layerRole: 'scrim'
  }));
}

// Headline (verbatim, DARK_INK) + optional subheadline, laid UP from a baseline
// so it sits in the hero's lower scrim strip. Returns nothing.
function heroHeadline(o, content, palette, fonts, { x, w, bottom }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 360, maxSize: 128, minSize: 40 });
  const headH = estTextHeight(content.headline, headSize, w, 1.04);
  let subH = 0;
  let subSize = 40;
  if (content.subheadline) {
    subSize = fitFontSize(content.subheadline, { width: w, height: 136, maxSize: 44, minSize: 16 });
    subH = estTextHeight(content.subheadline, subSize, w) + 16;
  }
  // eyebrow accent rule above the headline
  const headTop = bottom - headH - subH - 24;
  o.push(rect({
    x, y: headTop - 16, w: 48, h: 4, fill: palette.primary, rx: 2,
    opacity: 0.2, layerRole: 'decor'
  }));
  o.push(textbox({
    text: content.headline, x, y: headTop, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align: 'left',
    lineHeight: 1.04, layerRole: 'headline', bgRef: DARK_BASE,
    shadow: OVERLAY_TEXT_SHADOW
  }));
  if (content.subheadline) {
    o.push(textbox({
      text: content.subheadline, x, y: bottom - subH + 16, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM, align: 'left',
      lineHeight: 1.2, layerRole: 'subheadline', bgRef: DARK_BASE,
      shadow: OVERLAY_TEXT_SHADOW
    }));
  }
}

// One supporting image card: honest image slot on top, HEADING (primary) + TEXT
// (off-white) beneath. Both fields bound (msgId + fieldRef + bgRef = DARK_BASE).
// cardBottom: y-coordinate of the first content item below this card (CTA or next card
// top), used to bound the body text budget so it does not overflow into adjacent content.
function imageCard(o, b, palette, fonts, { x, y, w, imgH, slotId, hint, cardBottom }) {
  o.push(imageSlot({ slotId, x, y, w, h: imgH, styleHint: hint, stroke: palette.primary, blockId: b.id, rx: 20 }));

  const headTop = y + imgH + 24;
  // headBudget: space from headTop to cardBottom minus body placeholder minus gaps
  const headBudget = Math.max(Math.round((cardBottom - headTop) * 0.40), 40);
  const headSize = fitFontSize(b.heading, { width: w, height: headBudget, maxSize: 54, minSize: 16 });
  o.push({
    ...textbox({
      text: b.heading, x, y: headTop, w, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.primary,
      lineHeight: 1.06, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE,
      shadow: OVERLAY_TEXT_SHADOW
    }),
    fieldRef: 'heading'
  });

  const bodyTop = headTop + estTextHeight(b.heading, headSize, w, 1.06) + 12;
  // bodyBudget: from bodyTop to cardBottom minus 8px audit margin
  const bodyBudget = Math.max(cardBottom - bodyTop - 8, 20);
  const bodySize = fitFontSize(b.text, { width: w, height: bodyBudget, maxSize: 42, minSize: 14 });
  o.push({
    ...textbox({
      text: b.text, x, y: bodyTop, w, fontSize: bodySize,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK,
      lineHeight: 1.22, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE,
      shadow: OVERLAY_TEXT_SHADOW
    }),
    fieldRef: 'text'
  });
}

function ctaBar(o, text, palette, fonts, { x, y, w }) {
  const size = fitFontSize(text, { width: w, height: 96, maxSize: 48, minSize: 30 });
  o.push(textbox({
    text, x, y, w, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'left', charSpacing: 32, layerRole: 'cta', bgRef: DARK_BASE,
    shadow: OVERLAY_TEXT_SHADOW
  }));
}

// ── portrait: hero across the top ~half, a row of 3 cards below ───────────────
function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed dark feature backdrop, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  backdrop(o, palette, W, H);

  const margin = 80;
  const innerW = W - margin * 2;

  // hero image slot across the top
  const heroX = margin;
  const heroY = 80;
  const heroW = innerW;
  const heroH = 984;
  o.push(imageSlot({ slotId: 'slot-1', x: heroX, y: heroY, w: heroW, h: heroH, styleHint: HERO_HINT, stroke: palette.primary, rx: 20 }));
  // corner frame accents on the hero (decor, <=0.2)
  o.push(...cornerFrame({ x: heroX, y: heroY, w: heroW, h: heroH, color: palette.primary, arm: 64, thickness: 5, intensity: 0.85 }));
  // dark strip over the hero's lower third + headline overlaid on it
  const stripH = 424;
  heroScrimStrip(o, { x: heroX, y: heroY + heroH - stripH, w: heroW, h: stripH });
  heroHeadline(o, content, palette, fonts, { x: heroX + 40, w: heroW - 80, bottom: heroY + heroH - 40 });

  // row of 3 supporting image cards
  const blocks = content.blocks || [];
  const gap = 40;
  const cardsTop = heroY + heroH + 56;
  const cardW = Math.round((innerW - gap * 2) / 3);
  const imgH = 304;
  const ctaY = 1888;
  blocks.slice(0, 3).forEach((b, i) => {
    imageCard(o, b, palette, fonts, {
      x: margin + i * (cardW + gap), y: cardsTop, w: cardW, imgH,
      slotId: `slot-${i + 2}`, hint: CARD_HINTS[i % CARD_HINTS.length],
      cardBottom: ctaY  // body must not overlap CTA at y=1888
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, { x: margin, y: ctaY, w: innerW });
  return canvas;
}

// ── landscape: REAL relayout — hero fills the left ~55%, 3 cards stacked right ─
function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed dark feature backdrop, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  backdrop(o, palette, W, H);

  const margin = 80;

  // hero fills the left ~55%
  const heroX = margin;
  const heroY = 80;
  const heroW = Math.round(W * 0.55) - margin - 20;
  const heroH = H - 80 - 216;
  o.push(imageSlot({ slotId: 'slot-1', x: heroX, y: heroY, w: heroW, h: heroH, styleHint: HERO_HINT, stroke: palette.primary, rx: 20 }));
  // corner frame accents (decor, <=0.2)
  o.push(...cornerFrame({ x: heroX, y: heroY, w: heroW, h: heroH, color: palette.primary, arm: 56, thickness: 4, intensity: 0.85 }));
  const stripH = 480;
  heroScrimStrip(o, { x: heroX, y: heroY + heroH - stripH, w: heroW, h: stripH });
  heroHeadline(o, content, palette, fonts, { x: heroX + 40, w: heroW - 80, bottom: heroY + heroH - 40 });

  // right column: 3 stacked supporting image cards
  const blocks = content.blocks || [];
  const colX = heroX + heroW + 48;
  const colW = W - colX - margin;
  const colTop = 80;
  const gap = 32;
  const rowH = Math.round((heroH - gap * 2) / 3);
  const imgH = Math.round(rowH * 0.44);
  const lsCtaY = H - 152;
  blocks.slice(0, 3).forEach((b, i) => {
    // cardBottom = top of next card, or CTA y for last card
    const thisCardTop = colTop + i * (rowH + gap);
    const nextCardTop = i < 2 ? colTop + (i + 1) * (rowH + gap) : lsCtaY;
    imageCard(o, b, palette, fonts, {
      x: colX, y: thisCardTop, w: colW, imgH,
      slotId: `slot-${i + 2}`, hint: CARD_HINTS[i % CARD_HINTS.length],
      cardBottom: nextCardTop
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, { x: margin, y: lsCtaY, w: W - margin * 2 });
  return canvas;
}

// ── previews ─────────────────────────────────────────────────────────────────
function pvBackdrop(parts, palette, orientation) {
  const spot = orientation === 'landscape'
    ? { x: 1440, y: 396, r: 760 }
    : { x: 1018, y: 560, r: 537 };
  parts.push(`<circle cx="${pv(spot.x)}" cy="${pv(spot.y)}" r="${pv(spot.r)}" fill="${palette.accent}" opacity="0.1"/>`);
}

function pvCard(parts, palette, { x, y, w, imgH }) {
  parts.push(pvSlot(pv(x), pv(y), pv(w), pv(imgH), palette.primary));
  parts.push(pvRect(pv(x), pv(y + imgH + 24), pv(w * 0.7), pv(24), palette.primary, { rx: 3 }));
  parts.push(pvBars({ x: pv(x), y: pv(y + imgH + 68), w: pv(w), lines: 2, barH: 5, gap: 4, fill: DARK_INK }));
}

function previewPortrait(palette) {
  const parts = [];
  pvBackdrop(parts, palette, 'portrait');
  const margin = 80;
  const innerW = 1414 - margin * 2;
  const heroY = 80;
  const heroH = 984;
  parts.push(pvSlot(pv(margin), pv(heroY), pv(innerW), pv(heroH), palette.primary));
  parts.push(pvRect(pv(margin), pv(heroY + heroH - 424), pv(innerW), pv(424), DARK_BASE, { opacity: 0.55 }));
  // eyebrow + headline bars
  parts.push(pvRect(pv(margin + 40), pv(heroY + heroH - 424 + 32), pv(48), pv(4), palette.primary, { rx: 2 }));
  parts.push(pvBars({ x: pv(margin + 40), y: pv(heroY + heroH - 380), w: pv(innerW - 80), lines: 2, barH: 20, gap: 10, fill: DARK_INK }));
  const gap = 40;
  const cardsTop = heroY + heroH + 56;
  const cardW = Math.round((innerW - gap * 2) / 3);
  for (let i = 0; i < 3; i++) {
    pvCard(parts, palette, { x: margin + i * (cardW + gap), y: cardsTop, w: cardW, imgH: 304 });
  }
  parts.push(pvRect(pv(margin), pv(1888), pv(innerW * 0.58), pv(30), palette.primary, { rx: 3 }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [];
  pvBackdrop(parts, palette, 'landscape');
  const W = 2000;
  const H = 1414;
  const margin = 80;
  const heroX = margin;
  const heroY = 80;
  const heroW = Math.round(W * 0.55) - margin - 20;
  const heroH = H - 80 - 216;
  parts.push(pvSlot(pv(heroX), pv(heroY), pv(heroW), pv(heroH), palette.primary));
  parts.push(pvRect(pv(heroX), pv(heroY + heroH - 480), pv(heroW), pv(480), DARK_BASE, { opacity: 0.55 }));
  // eyebrow + headline bars
  parts.push(pvRect(pv(heroX + 40), pv(heroY + heroH - 480 + 32), pv(48), pv(4), palette.primary, { rx: 2 }));
  parts.push(pvBars({ x: pv(heroX + 40), y: pv(heroY + heroH - 420), w: pv(heroW - 80), lines: 2, barH: 20, gap: 10, fill: DARK_INK }));
  const colX = heroX + heroW + 48;
  const colW = W - colX - margin;
  const gap = 32;
  const rowH = Math.round((heroH - gap * 2) / 3);
  const imgH = Math.round(rowH * 0.44);
  for (let i = 0; i < 3; i++) {
    pvCard(parts, palette, { x: colX, y: 80 + i * (rowH + gap), w: colW, imgH });
  }
  parts.push(pvRect(pv(margin), pv(H - 152), pv((W - margin * 2) * 0.5), pv(30), palette.primary, { rx: 3 }));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'feature-spread',
  name: 'Feature spread',
  style: 'infographic',
  description: 'A magazine feature spread: one big hero image carries the headline over a dark gradient strip, then a row (portrait) or right-hand column (landscape) of three supporting image cards, each a real image slot with a bold primary heading and off-white text beneath. Image-dominant and premium — a diagonal gradient wash and a single accent glow set the backdrop, with the honest hero and card slots doing the visual work. A row of cards under a full-width hero in portrait; a tall hero beside a stacked column of cards in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'panels', min: 3, max: 3, fields: ['heading', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 4
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
