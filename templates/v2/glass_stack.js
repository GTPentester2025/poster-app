// v2 template — glass-stack (style: infographic). Premium glassmorphism on
// black: each block is a frosted glass card — a solid raised charcoal surface
// (DARK_PANEL) carrying a bold primary HEADING and warm off-white TEXT, edged
// with a thin primary hairline and a soft top-edge highlight, floated on a soft
// depth shadow so the cards read as stacked frosted panes. A mesh-glow bloom in
// the primary+accent colors bleeds behind the whole stack. The ONE honest image
// slot rides the top hero card. Portrait: a vertical stack of wide staggered
// cards. Landscape: REAL relayout — a horizontal fan/row of cards with the hero
// card + image slot on the left. CTA bar (DARK_PANEL) at the bottom in primary.
//
// 2026 redesign: elevated glassmorphism quality — card corners at rx 28 (up from
// 26); top-edge highlight now a gentle gradient-height fade (two bars) for more
// realistic glass sheen; primary hairline stroke slightly stronger at opacity
// 0.20; hero card gets an extra accent halo glow for hierarchy; dot-grid accent
// in empty canvas corners; typographic upgrade — heading lineHeight 1.04,
// body lineHeight 1.45 for breathing room; consistent 88px outer margins;
// DARK_PANEL_2 used for the hero card surface to lift it above the stack.

import {
  textbox, rect, imageSlot, backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, dotGrid, svgWrapO, PV_LAND_W,
  legibilityScrim, softGlow,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM
} from './decor.js';

const CARD_R = 28;

// ── shared frosted-card painter ──────────────────────────────────────────────
// Solid surface (layerRole 'background', no forced opacity — exempt from
// the decor <=0.2 rule) + a thin primary hairline + a two-bar top-edge
// highlight simulating glass sheen, both true translucent decor (opacity <=0.2).
// A soft depth shadow floats the pane.
function frostedSurface(o, palette, { x, y, w, h, fill = DARK_PANEL, hero = false }) {
  o.push(rect({
    x, y, w, h, fill, rx: CARD_R,
    shadow: { color: 'rgba(0,0,0,0.50)', blur: 40, offsetX: 0, offsetY: 18 },
    layerRole: 'background'
  }));
  // primary hairline edge (translucent decor)
  o.push(rect({
    x, y, w, h, fill: 'transparent', stroke: palette.primary, strokeWidth: 2,
    rx: CARD_R, opacity: hero ? 0.20 : 0.14, layerRole: 'decor'
  }));
  // two-bar glass-sheen highlight (bright top bar + fainter secondary bar)
  o.push(rect({
    x: x + 28, y: y + 10, w: w - 56, h: 5, fill: palette.primary, rx: 2.5,
    opacity: 0.14, layerRole: 'decor'
  }));
  o.push(rect({
    x: x + 40, y: y + 20, w: w - 80, h: 3, fill: palette.primary, rx: 1.5,
    opacity: 0.08, layerRole: 'decor'
  }));
  // hero gets an extra accent glow bloom behind the card
  if (hero) {
    o.push(rect({
      x: x - 32, y: y - 32, w: w + 64, h: h + 64, fill: palette.accent,
      rx: CARD_R + 20, opacity: 0.05, layerRole: 'decor'
    }));
  }
}

/**
 * One frosted glass card: surface + bold primary HEADING + off-white TEXT.
 * Both text fields bound (msgId + fieldRef + bgRef = the card fill).
 */
function glassCard(o, b, palette, fonts, { x, y, w, h, fill = DARK_PANEL }) {
  frostedSurface(o, palette, { x, y, w, h, fill });

  const padX = 48;
  const innerW = w - padX * 2;
  const headTop = y + 44;
  const headSize = fitFontSize(b.heading, { width: innerW, height: 136, maxSize: 68, minSize: 40 });
  o.push({
    ...textbox({
      text: b.heading, x: x + padX, y: headTop, w: innerW, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.primary,
      lineHeight: 1.04, layerRole: 'message', msgId: b.id, bgRef: fill
    }),
    fieldRef: 'heading'
  });

  const bodyTop = headTop + estTextHeight(b.heading, headSize, innerW, 1.04) + 24;
  const bodyH = y + h - bodyTop - 44;
  const bodySize = fitFontSize(b.text, { width: innerW, height: bodyH, maxSize: 48, minSize: 38 });
  o.push({
    ...textbox({
      text: b.text, x: x + padX, y: bodyTop, w: innerW, fontSize: bodySize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
      lineHeight: 1.45, layerRole: 'message', msgId: b.id, bgRef: fill
    }),
    fieldRef: 'text'
  });
}

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_PANEL, layerRole: 'background' }));
  // two hairline rules at the top of the CTA bar — primary + accent
  o.push(rect({ x: 0, y, w: W, h: 5, fill: palette.primary, opacity: 0.18, layerRole: 'decor' }));
  o.push(rect({ x: 0, y: y + 5, w: W, h: 3, fill: palette.accent, opacity: 0.12, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 200, height: 96, maxSize: 48, minSize: 30 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((144 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize, align = 'left' }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 300, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize, lineHeight: 1.04,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align,
    layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.04) + 20;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 40, minSize: 16, lineHeight: 1.4 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM, align,
      lineHeight: 1.4, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.4) + 18;
  }
  return cursor;
}

// ── portrait: vertical stack of wide staggered frosted cards ─────────────────
function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of frosted glass panels floating in dark space with soft neon bokeh, deep near-black, cyan and gold glow, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // mesh-glow bloom — primary upper-left, accent center-right, primary lower-right corner
  o.push(...meshGlow({
    spots: [
      { x: 280, y: 540, r: 600, color: palette.primary },
      { x: W - 220, y: 1140, r: 660, color: palette.accent },
      { x: W - 340, y: 280, r: 460, color: palette.primary }
    ],
    intensity: 1
  }));
  // corner dot-grid textures (restrained)
  o.push(...dotGrid({ x: 88, y: 1720, cols: 4, rows: 3, gap: 44, dotR: 4, color: DARK_INK, intensity: 0.55 }));

  const headBottom = headlineZone(o, content, palette, fonts, { x: 88, y: 96, w: 1000, maxSize: 112, align: 'left' });

  // second foreground image slot — top-right corner (breathing room from edges)
  o.push(imageSlot({
    slotId: 'slot-2', x: 1112, y: 112, w: 248, h: 248,
    styleHint: 'sleek high-tech supporting illustration, flat vector, no text',
    stroke: palette.primary
  }));

  const blocks = content.blocks || [];
  const stackTop = Math.max(headBottom + 48, 480);
  const stackBottom = 1832;
  const n = Math.max(blocks.length, 1);
  const gap = 32;
  const fullW = 1238;
  const cardH = Math.round((stackBottom - stackTop - gap * (n - 1)) / n);

  // hero (first) card is elevated — DARK_PANEL_2 surface, slot on its right
  blocks.forEach((b, i) => {
    const y = stackTop + i * (cardH + gap);
    const inset = (i % 2) * 48;
    const x = 88 + inset;
    const w = fullW - inset;
    if (i === 0) {
      const slot = Math.min(cardH - 56, 304);
      const slotX = x + w - slot - 36;
      const slotY = y + Math.round((cardH - slot) / 2);
      frostedSurface(o, palette, { x, y, w, h: cardH, fill: DARK_PANEL_2, hero: true });
      const padX = 48;
      const textW = slotX - x - padX - 28;
      const headTop = y + 44;
      const headSize = fitFontSize(b.heading, { width: textW, height: 136, maxSize: 68, minSize: 40 });
      o.push({
        ...textbox({
          text: b.heading, x: x + padX, y: headTop, w: textW, fontSize: headSize,
          fontFamily: fonts.head, fontWeight: '900', fill: palette.primary,
          lineHeight: 1.04, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL_2
        }),
        fieldRef: 'heading'
      });
      const bodyTop = headTop + estTextHeight(b.heading, headSize, textW, 1.04) + 24;
      const bodyH = y + cardH - bodyTop - 44;
      const bodySize = fitFontSize(b.text, { width: textW, height: bodyH, maxSize: 48, minSize: 38 });
      o.push({
        ...textbox({
          text: b.text, x: x + padX, y: bodyTop, w: textW, fontSize: bodySize,
          fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
          lineHeight: 1.45, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL_2
        }),
        fieldRef: 'text'
      });
      o.push(imageSlot({
        slotId: 'slot-1', x: slotX, y: slotY, w: slot, h: slot,
        styleHint: 'frosted glass security emblem — shield or padlock, flat vector, no text',
        stroke: palette.primary
      }));
      // hero accent glow — softGlow bloom behind the hero slot
      o.push(...softGlow({ x: Math.round(slotX + slot / 2), y: Math.round(slotY + slot / 2), r: Math.round(slot * 0.8), color: palette.accent, intensity: 0.65 }));
    } else {
      glassCard(o, b, palette, fonts, { x, y, w, h: cardH });
    }
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1856);
  return canvas;
}

// ── landscape: REAL relayout — hero card + slot left, fan of cards right ──────
function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of frosted glass panels floating in dark space with soft neon bokeh, deep near-black, cyan and gold glow, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({
    spots: [
      { x: 380, y: 700, r: 660, color: palette.primary },
      { x: 1520, y: 280, r: 600, color: palette.accent },
      { x: 1680, y: 1160, r: 520, color: palette.primary }
    ],
    intensity: 1
  }));
  o.push(...dotGrid({ x: 1780, y: 1040, cols: 4, rows: 3, gap: 44, dotR: 4, color: DARK_INK, intensity: 0.55 }));

  const blocks = content.blocks || [];

  // left band: headline + hero card with the image slot
  const leftW = 768;
  headlineZone(o, content, palette, fonts, { x: 80, y: 88, w: 408, maxSize: 96, align: 'left' });

  // second foreground image slot — top-left band, right of the headline
  o.push(imageSlot({
    slotId: 'slot-2', x: 504, y: 88, w: 248, h: 248,
    styleHint: 'sleek high-tech supporting illustration, flat vector, no text',
    stroke: palette.primary
  }));

  const hero = blocks[0];
  const heroX = 80;
  const heroY = 556;
  const heroW = leftW - 148;
  const heroH = 730;
  if (hero) {
    frostedSurface(o, palette, { x: heroX, y: heroY, w: heroW, h: heroH, fill: DARK_PANEL_2, hero: true });
    const padX = 48;
    const innerW = heroW - padX * 2;
    const slot = Math.min(innerW, 304);
    const slotX = heroX + Math.round((heroW - slot) / 2);
    const slotY = heroY + heroH - slot - 44;
    const headTop = heroY + 44;
    const headSize = fitFontSize(hero.heading, { width: innerW, height: 154, maxSize: 68, minSize: 40 });
    o.push({
      ...textbox({
        text: hero.heading, x: heroX + padX, y: headTop, w: innerW, fontSize: headSize,
        fontFamily: fonts.head, fontWeight: '900', fill: palette.primary,
        lineHeight: 1.04, layerRole: 'message', msgId: hero.id, bgRef: DARK_PANEL_2
      }),
      fieldRef: 'heading'
    });
    const bodyTop = headTop + estTextHeight(hero.heading, headSize, innerW, 1.04) + 22;
    const bodyH = slotY - bodyTop - 28;
    const bodySize = fitFontSize(hero.text, { width: innerW, height: bodyH, maxSize: 48, minSize: 38 });
    o.push({
      ...textbox({
        text: hero.text, x: heroX + padX, y: bodyTop, w: innerW, fontSize: bodySize,
        fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
        lineHeight: 1.45, layerRole: 'message', msgId: hero.id, bgRef: DARK_PANEL_2
      }),
      fieldRef: 'text'
    });
    o.push(imageSlot({
      slotId: 'slot-1', x: slotX, y: slotY, w: slot, h: slot,
      styleHint: 'frosted glass security emblem — shield or padlock, flat vector, no text',
      stroke: palette.primary
    }));
    o.push(...softGlow({ x: Math.round(slotX + slot / 2), y: Math.round(slotY + slot / 2), r: Math.round(slot * 0.8), color: palette.accent, intensity: 0.65 }));
  }

  // right band: a grid of the remaining cards
  const rest = blocks.slice(1);
  const gridX = leftW + 40;
  const gridTop = 104;
  const gridBottom = 1248;
  const gridW = W - gridX - 72;
  const m = Math.max(rest.length, 1);
  const gap = 32;
  const cols = m <= 2 ? 1 : 2;
  const rows = Math.ceil(m / cols);
  const cardW = Math.round((gridW - gap * (cols - 1)) / cols);
  const cardH = Math.round((gridBottom - gridTop - gap * (rows - 1)) / rows);

  rest.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const lastAlone = i === rest.length - 1 && rest.length % cols === 1 && cols === 2;
    const x = lastAlone
      ? Math.round(gridX + (gridW - cardW) / 2)
      : gridX + col * (cardW + gap);
    const y = gridTop + row * (cardH + gap);
    glassCard(o, b, palette, fonts, { x, y, w: cardW, h: cardH });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

// ── previews ─────────────────────────────────────────────────────────────────
function pvGlow(parts, palette, spots) {
  for (const s of spots) {
    parts.push(`<circle cx="${pv(s.x)}" cy="${pv(s.y)}" r="${pv(s.r)}" fill="${s.color}" opacity="0.1"/>`);
  }
}

function pvCardBox(parts, palette, { x, y, w, h, slot = false, hero = false }) {
  const fill = hero ? DARK_PANEL_2 : DARK_PANEL;
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), fill, { rx: 5 }));
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), 'none', { rx: 5, stroke: palette.primary, opacity: hero ? 0.5 : 0.35 }));
  parts.push(pvRect(pv(x + 28), pv(y + 10), pv(w - 56), pv(5), palette.primary, { rx: 2, opacity: 0.5 }));
  parts.push(pvRect(pv(x + 40), pv(y + 20), pv(w - 80), pv(3), palette.primary, { rx: 1.5, opacity: 0.28 }));
  const textW = slot ? w * 0.52 : w - 96;
  parts.push(pvRect(pv(x + 48), pv(y + 44), pv(textW * 0.68), pv(28), palette.primary, { rx: 3 }));
  parts.push(pvBars({ x: pv(x + 48), y: pv(y + 88), w: pv(textW), lines: 2, barH: 5, gap: 4, fill: DARK_INK }));
  if (slot) {
    const s = Math.min(h - 56, 304);
    parts.push(pvSlot(pv(x + w - s - 36), pv(y + (h - s) / 2), pv(s), pv(s), palette.primary));
  }
}

function previewPortrait(palette) {
  const parts = [];
  pvGlow(parts, palette, [
    { x: 280, y: 540, r: 600, color: palette.primary },
    { x: 1194, y: 1140, r: 660, color: palette.accent },
    { x: 1074, y: 280, r: 460, color: palette.primary }
  ]);
  parts.push(pvBars({ x: pv(88), y: pv(110), w: pv(1238), lines: 2, barH: 8, gap: 5, fill: DARK_INK }));
  const stackTop = 480;
  const stackBottom = 1832;
  const n = 3;
  const gap = 32;
  const cardH = Math.round((stackBottom - stackTop - gap * (n - 1)) / n);
  for (let i = 0; i < n; i++) {
    const inset = (i % 2) * 48;
    pvCardBox(parts, palette, {
      x: 88 + inset, y: stackTop + i * (cardH + gap), w: 1238 - inset, h: cardH,
      slot: i === 0, hero: i === 0
    });
  }
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_PANEL));
  parts.push(pvRect(0, pv(1856), 200, pv(5), palette.primary, { opacity: 0.5 }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [];
  pvGlow(parts, palette, [
    { x: 380, y: 700, r: 660, color: palette.primary },
    { x: 1520, y: 280, r: 600, color: palette.accent },
    { x: 1680, y: 1160, r: 520, color: palette.primary }
  ]);
  const leftW = 768;
  parts.push(pvBars({ x: pv(80), y: pv(100), w: pv(leftW - 128), lines: 2, barH: 8, gap: 5, fill: DARK_INK }));
  pvCardBox(parts, palette, { x: 80, y: 556, w: leftW - 148, h: 730, slot: true, hero: true });
  const gridX = leftW + 40;
  const gridW = 2000 - gridX - 72;
  const gap = 32;
  const cols = 2;
  const rows = 2;
  const cardW = Math.round((gridW - gap) / cols);
  const cardH = Math.round((1248 - 104 - gap) / rows);
  for (let i = 0; i < 3; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    pvCardBox(parts, palette, {
      x: gridX + col * (cardW + gap), y: 104 + row * (cardH + gap), w: cardW, h: cardH
    });
  }
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_PANEL));
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(5), palette.primary, { opacity: 0.5 }));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'glass-stack',
  name: 'Glass stack',
  style: 'infographic',
  description: 'Premium glassmorphism on black: each block is a frosted glass card — a raised charcoal surface with a bold primary heading and off-white text, edged with a thin primary hairline and a soft top highlight, floating on a depth shadow. A primary-plus-accent mesh glow blooms behind the stack and the image slot rides the top hero card. A vertical stack of wide staggered panes in portrait; a hero card beside a horizontal fan of cards in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'panels', min: 3, max: 5, fields: ['heading', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 2
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
