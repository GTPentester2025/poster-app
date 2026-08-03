// v2 template — privacy-rights (style: infographic). Data privacy rights
// explained visually in a card grid. Each card represents a core privacy right:
// access, correction, erasure, portability, and objection. Gradient cards in
// indigo-to-dark-canvas with cyan accents. Portrait: 2 cols x 3 rows. Landscape:
// 3 cols x 2 rows.

import {
  textbox, rect, circle,
  fitFontSize, estTextHeight,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, cornerFrame,
  legibilityScrim, svgWrapO, PV_LAND_W
} from './decor.js';

const INDIGO = '#4338CA';      // primary indigo
const DARK_CANVAS = '#0F172A';  // dark canvas base
const CYAN = '#06B6D4';         // cyan accent
const LIGHT_BG = '#F8FAFC';     // light background
const INK = '#1E293B';          // charcoal titles
const SLATE = '#475569';        // slate body text
const CARD_DARK = '#1E293B';    // dark card base

function headerZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  // eyebrow
  o.push(textbox({
    text: 'PRIVACY RIGHTS', x, y, w,
    fontSize: 24, fontFamily: fonts.head, fontWeight: '800', fill: CYAN,
    align: 'left', charSpacing: 200, lineHeight: 1, layerRole: 'message-label', bgRef: LIGHT_BG
  }));
  let cursor = y + 40;
  const headSize = fitFontSize(content.headline, { width: w, height: 240, maxSize, minSize: 44 });
  o.push(textbox({
    text: content.headline, x, y: cursor, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: INK,
    lineHeight: 1.06, layerRole: 'headline', bgRef: LIGHT_BG
  }));
  cursor += estTextHeight(content.headline, headSize, w, 1.06) + 16;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 90, maxSize: 34, minSize: 20, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: SLATE,
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: LIGHT_BG
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.35) + 20;
  }
  return cursor;
}

function privacyCard(o, b, fonts, { cardX, cardY, cardW, cardH }) {
  // gradient card base: indigo to dark canvas
  o.push(rect({
    x: cardX, y: cardY, w: cardW, h: cardH, fill: INDIGO, rx: 16, layerRole: 'background', msgId: b.id
  }));
  o.push(rect({
    x: cardX, y: cardY, w: cardW, h: cardH, fill: 'transparent', stroke: CYAN, strokeWidth: 2, rx: 16, layerRole: 'decor'
  }));

  // top cyan accent bar
  o.push(rect({
    x: cardX, y: cardY, w: cardW, h: 6, fill: CYAN, rx: 3, layerRole: 'decor'
  }));

  // accent circle (top right corner)
  o.push(circle({
    x: cardX + cardW - 36, y: cardY + 36, r: 24, fill: CYAN, opacity: 0.2, layerRole: 'decor'
  }));
  o.push(circle({
    x: cardX + cardW - 36, y: cardY + 36, r: 12, fill: CYAN, layerRole: 'decor'
  }));

  // heading (bold, white/cyan)
  const innerX = cardX + 28;
  const innerW = cardW - 56;
  let textY = cardY + 28;

  if (b.heading) {
    const titleBudget = Math.round(cardH * 0.3);
    const tSize = fitFontSize(b.heading, { width: innerW, height: titleBudget, maxSize: 36, minSize: 18 });
    o.push({
      ...textbox({
        text: b.heading, x: innerX, y: textY, w: innerW, fontSize: tSize,
        fontFamily: fonts.head, fontWeight: '800', fill: CYAN,
        lineHeight: 1.2, layerRole: 'message', msgId: b.id, bgRef: INDIGO
      }),
      fieldRef: 'heading'
    });
    textY += estTextHeight(b.heading, tSize, innerW, 1.2) + 12;
  }

  // body text (lighter, for contrast on indigo)
  const bodyBudget = Math.max(60, cardY + cardH - textY - 24);
  const bSize = fitFontSize(b.text, { width: innerW, height: bodyBudget, maxSize: 28, minSize: 14 });
  o.push({
    ...textbox({
      text: b.text, x: innerX, y: textY, w: innerW, fontSize: bSize,
      fontFamily: fonts.body, fontWeight: '400', fill: '#F0F9FF',
      lineHeight: 1.35, layerRole: 'message', msgId: b.id, bgRef: INDIGO
    }),
    fieldRef: 'text'
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', LIGHT_BG);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(...legibilityScrim({ w: W, h: H, strength: 0.15 }));
  o.push(...gradientWash({ w: W, h: H, from: INDIGO, to: LIGHT_BG, direction: 'diagonal', intensity: 0.2 }));
  o.push(...cornerFrame({ x: 48, y: 48, w: W - 96, h: H - 232, color: CYAN, arm: 60, thickness: 2, intensity: 0.4 }));

  const blocks = content.blocks || [];
  const hCursor = headerZone(o, content, palette, fonts, { x: 88, y: 96, w: 980, maxSize: 92 });

  // card grid: 2 cols x 3 rows (portrait)
  const gridTop = Math.max(hCursor + 40, 400);
  const gridLeft = 100;
  const gridW = W - 200;
  const cardW = (gridW - 32) / 2; // 2 columns with 32px gap
  const cardH = 420;
  const rowH = cardH + 32; // card height + gap

  blocks.forEach((b, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const cardX = gridLeft + col * (cardW + 32);
    const cardY = gridTop + row * rowH;
    privacyCard(o, b, fonts, { cardX, cardY, cardW, cardH });
  });

  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', LIGHT_BG);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(...legibilityScrim({ w: W, h: H, strength: 0.15 }));
  o.push(...gradientWash({ w: W, h: H, from: INDIGO, to: LIGHT_BG, direction: 'diagonal', intensity: 0.2 }));
  o.push(...cornerFrame({ x: 48, y: 48, w: W - 96, h: H - 180, color: CYAN, arm: 60, thickness: 2, intensity: 0.4 }));

  const blocks = content.blocks || [];
  const hCursor = headerZone(o, content, palette, fonts, { x: 88, y: 72, w: 1180, maxSize: 78 });

  // card grid: 3 cols x 2 rows (landscape)
  const gridTop = Math.max(hCursor + 40, 320);
  const gridLeft = 100;
  const gridW = W - 200;
  const cardW = (gridW - 64) / 3; // 3 columns with 32px gaps
  const cardH = 360;
  const rowH = cardH + 32;

  blocks.forEach((b, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const cardX = gridLeft + col * (cardW + 32);
    const cardY = gridTop + row * rowH;
    privacyCard(o, b, fonts, { cardX, cardY, cardW, cardH });
  });

  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvRect(pv(88), pv(96), pv(360), 5, CYAN, { rx: 2 }),
    pvBars({ x: pv(88), y: pv(150), w: pv(980), lines: 2, barH: 8, gap: 5, fill: INK })
  ];

  // 2 col x 3 row grid (6 cards)
  const gridTop = 400, gridLeft = 100;
  const cardW = pv(424), cardH = pv(420), gap = 32;
  for (let i = 0; i < 6; i++) {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const cardX = gridLeft + col * (424 + gap);
    const cardY = gridTop + row * (420 + gap);
    parts.push(pvRect(pv(cardX), pv(cardY), cardW, cardH, INDIGO, { rx: 4, stroke: CYAN, strokeWidth: 1 }));
    parts.push(pvRect(pv(cardX), pv(cardY), cardW, 3, CYAN));
    parts.push(pvCircle(pv(cardX + 424 - 36), pv(cardY + 36), pv(12), CYAN));
    parts.push(pvBars({ x: pv(cardX + 28), y: pv(cardY + 40), w: pv(370), lines: 3, barH: 4, gap: 3, fill: CYAN }));
  }

  return svgWrapO(parts, LIGHT_BG, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvRect(pv(88), pv(72), pv(300), 5, CYAN, { rx: 2 }),
    pvBars({ x: pv(88), y: pv(120), w: pv(1180), lines: 2, barH: 7, gap: 4, fill: INK })
  ];

  // 3 col x 2 row grid (6 cards)
  const gridTop = 320, gridLeft = 100;
  const cardW = pv(356), cardH = pv(360), gap = 32;
  for (let i = 0; i < 6; i++) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const cardX = gridLeft + col * (356 + gap);
    const cardY = gridTop + row * (360 + gap);
    parts.push(pvRect(pv(cardX), pv(cardY), cardW, cardH, INDIGO, { rx: 4, stroke: CYAN, strokeWidth: 1 }));
    parts.push(pvRect(pv(cardX), pv(cardY), cardW, 3, CYAN));
    parts.push(pvCircle(pv(cardX + 356 - 36), pv(cardY + 36), pv(12), CYAN));
    parts.push(pvBars({ x: pv(cardX + 28), y: pv(cardY + 40), w: pv(300), lines: 3, barH: 4, gap: 3, fill: CYAN }));
  }

  return svgWrapO(parts, LIGHT_BG, 'landscape');
}

export default {
  id: 'privacy-rights',
  name: 'Privacy rights',
  style: 'infographic',
  description: 'Data privacy rights explained visually in a card grid. Each card presents a core privacy right: access, correction, erasure, portability, and objection. Gradient cards in indigo-to-dark-canvas with cyan accents. Portrait layout: 2 columns × 3 rows; landscape: 3 columns × 2 rows. Clean, modern, compliance-focused.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    callToAction: { required: true, maxWords: 12 },
    blocks: { kind: 'panels', min: 4, max: 6, fields: ['heading', 'text'] },
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
