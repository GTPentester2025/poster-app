// v2 template — training-module (style: infographic). Clean instructional
// training layout: numbered learning steps down a progress rail, each with a
// circular step badge, a checkpoint marker, and a bold step title + body on a
// light card. A segmented progress bar under the header signals module length.
// Portrait: vertical progress rail with stacked step cards. Landscape:
// horizontal progress rail with step cards hanging beneath each badge.
// Corporate teal accent on a clean off-white ground, charcoal/slate ink.
// 3–5 sequence blocks {label, text}, 1 emblem image slot.

import {
  textbox, rect, circle, imageSlot,
  backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvCircle, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, dotGrid, cornerFrame,
  legibilityScrim, svgWrapO, PV_LAND_W
} from './decor.js';

const PAPER = '#F4F6F8';   // clean off-white instructional ground
const CARD = '#FFFFFF';    // step card surface
const TEAL = '#0D9488';    // progress / accent
const INK = '#1E293B';     // charcoal — titles
const SLATE = '#475569';   // slate — body text
const RAIL_BG = '#D5DCE3'; // unfilled rail

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 128, fill: INK, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: TEAL, opacity: 1, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 200, height: 88, maxSize: 44, minSize: 28 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((128 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: '#FFFFFF', align: 'center', layerRole: 'cta', bgRef: INK
  }));
}

function headerZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  // eyebrow
  o.push(textbox({
    text: 'TRAINING MODULE', x, y, w,
    fontSize: 24, fontFamily: fonts.head, fontWeight: '800', fill: TEAL,
    align: 'left', charSpacing: 200, lineHeight: 1, layerRole: 'message-label', bgRef: PAPER
  }));
  let cursor = y + 40;
  const headSize = fitFontSize(content.headline, { width: w, height: 240, maxSize, minSize: 44 });
  o.push(textbox({
    text: content.headline, x, y: cursor, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: INK,
    lineHeight: 1.06, layerRole: 'headline', bgRef: PAPER
  }));
  cursor += estTextHeight(content.headline, headSize, w, 1.06) + 16;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 90, maxSize: 34, minSize: 20, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: SLATE,
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: PAPER
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.35) + 20;
  }
  return cursor;
}

// segmented progress bar — one filled teal segment per step
function progressBar(o, n, { x, y, w, seg }) {
  const count = Math.max(n, 1);
  const gap = 10;
  const segW = (w - gap * (count - 1)) / count;
  for (let i = 0; i < count; i++) {
    const sx = Math.round(x + i * (segW + gap));
    o.push(rect({ x: sx, y, w: Math.round(segW), h: 10, fill: i < seg ? TEAL : RAIL_BG, rx: 5, layerRole: 'decor' }));
  }
}

// checkpoint marker — small teal ring with a filled core (a "completed" dot)
function checkpoint(o, cx, cy, r) {
  o.push(circle({ x: cx, y: cy, r, fill: 'transparent', stroke: TEAL, strokeWidth: 4, layerRole: 'decor', opacity: 0.55 }));
  o.push(circle({ x: cx, y: cy, r: Math.round(r * 0.42), fill: TEAL, layerRole: 'decor', opacity: 0.7 }));
}

function stepCard(o, b, i, fonts, { cardX, cardY, cardW, cardH, badgeCX, badgeR }) {
  // card surface
  o.push(rect({ x: cardX, y: cardY, w: cardW, h: cardH, fill: CARD, rx: 20, layerRole: 'background', msgId: b.id }));
  o.push(rect({ x: cardX, y: cardY, w: cardW, h: cardH, fill: 'transparent', stroke: RAIL_BG, strokeWidth: 2, rx: 20, layerRole: 'decor' }));
  // left teal accent bar
  o.push(rect({ x: cardX, y: cardY + 18, w: 6, h: cardH - 36, fill: TEAL, rx: 3, layerRole: 'decor' }));

  // numbered badge (floats on the rail, left of card)
  const badgeCY = cardY + Math.round(cardH / 2);
  o.push(circle({ x: badgeCX, y: badgeCY, r: badgeR, fill: TEAL, layerRole: 'decor' }));
  o.push(circle({ x: badgeCX, y: badgeCY, r: badgeR, fill: 'transparent', stroke: PAPER, strokeWidth: 4, layerRole: 'decor' }));
  o.push(textbox({
    text: String(i + 1), x: badgeCX - badgeR, y: badgeCY - Math.round(badgeR * 0.62), w: badgeR * 2,
    fontSize: Math.round(badgeR * 0.95), fontFamily: fonts.head, fontWeight: '900', fill: '#FFFFFF',
    align: 'center', lineHeight: 1, layerRole: 'decor', bgRef: TEAL
  }));

  // checkpoint marker top-right of card
  checkpoint(o, cardX + cardW - 40, cardY + 40, 18);

  // title (label) + body (text)
  const innerX = cardX + 36;
  const innerW = cardW - 36 - 76; // leave room for checkpoint marker on the right
  let textY = cardY + 28;
  if (b.label) {
    const titleBudget = Math.round(cardH * 0.34);
    const tSize = fitFontSize(b.label, { width: innerW, height: titleBudget, maxSize: 40, minSize: 20 });
    o.push({
      ...textbox({
        text: b.label, x: innerX, y: textY, w: innerW, fontSize: tSize,
        fontFamily: fonts.head, fontWeight: '800', fill: INK,
        lineHeight: 1.1, layerRole: 'message', msgId: b.id, bgRef: CARD
      }),
      fieldRef: 'label'
    });
    textY += estTextHeight(b.label, tSize, innerW, 1.1) + 12;
  }
  const bodyW = cardW - 36 - 36;
  const bodyBudget = Math.max(60, cardY + cardH - textY - 24);
  const bSize = fitFontSize(b.text, { width: bodyW, height: bodyBudget, maxSize: 30, minSize: 16 });
  o.push({
    ...textbox({
      text: b.text, x: innerX, y: textY, w: bodyW, fontSize: bSize,
      fontFamily: fonts.body, fontWeight: '500', fill: SLATE,
      lineHeight: 1.35, layerRole: 'message', msgId: b.id, bgRef: CARD
    }),
    fieldRef: 'text'
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', PAPER);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'clean bright corporate training background, soft geometric texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H, strength: 0.3 }));
  o.push(...gradientWash({ w: W, h: H, from: TEAL, to: PAPER, direction: 'vertical', intensity: 0.3 }));
  o.push(...dotGrid({ x: W - 240, y: 60, cols: 4, rows: 4, gap: 44, dotR: 3, color: TEAL, intensity: 0.4 }));
  o.push(...cornerFrame({ x: 48, y: 48, w: W - 96, h: H - 232, color: TEAL, arm: 72, thickness: 4, intensity: 0.5 }));

  const blocks = content.blocks || [];
  const hCursor = headerZone(o, content, palette, fonts, { x: 88, y: 96, w: 980, maxSize: 92 });

  o.push(imageSlot({
    slotId: 'slot-1', x: W - 320, y: 96, w: 240, h: 240,
    styleHint: 'friendly corporate training emblem, graduation or checklist icon, clean flat vector, no text',
    stroke: palette.primary
  }));

  // progress bar under header
  const pbY = Math.max(hCursor + 8, 380);
  progressBar(o, blocks.length, { x: 88, y: pbY, w: W - 176, seg: blocks.length });

  // step rail
  const railX = 156;
  const badgeR = 46;
  const top = pbY + 48;
  const bottom = 1824;
  const rowH = (bottom - top) / Math.max(blocks.length, 1);

  // full rail behind badges
  o.push(rect({ x: railX - 4, y: top + 20, w: 8, h: bottom - top - 40, fill: RAIL_BG, rx: 4, layerRole: 'decor' }));

  const cardX = 236;
  const cardW = W - cardX - 88;
  blocks.forEach((b, i) => {
    const cardY = Math.round(top + i * rowH + 10);
    const cardH = Math.round(rowH - 24);
    stepCard(o, b, i, fonts, { cardX, cardY, cardW, cardH, badgeCX: railX, badgeR });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1872);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', PAPER);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'clean bright corporate training background, soft geometric texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H, strength: 0.3 }));
  o.push(...gradientWash({ w: W, h: H, from: TEAL, to: PAPER, direction: 'horizontal', intensity: 0.3 }));
  o.push(...dotGrid({ x: W - 220, y: 48, cols: 3, rows: 3, gap: 44, dotR: 3, color: TEAL, intensity: 0.4 }));

  const blocks = content.blocks || [];
  const hCursor = headerZone(o, content, palette, fonts, { x: 88, y: 72, w: 1180, maxSize: 78 });

  o.push(imageSlot({
    slotId: 'slot-1', x: W - 280, y: 72, w: 192, h: 192,
    styleHint: 'friendly corporate training emblem, graduation or checklist icon, clean flat vector, no text',
    stroke: palette.primary
  }));

  // progress bar under header, full width
  const pbY = Math.max(hCursor + 8, 300);
  progressBar(o, blocks.length, { x: 88, y: pbY, w: W - 176, seg: blocks.length });

  // horizontal rail with badges, cards hanging below
  const railY = pbY + 90;
  const left = 88;
  const right = W - 88;
  const n = Math.max(blocks.length, 1);
  const colW = (right - left) / n;
  const badgeR = 40;

  // rail line behind badges
  o.push(rect({ x: left + 40, y: railY - 4, w: right - left - 80, h: 8, fill: RAIL_BG, rx: 4, layerRole: 'decor' }));

  const cardTop = railY + 64;
  const cardH = 1240 - cardTop;
  blocks.forEach((b, i) => {
    const cx = Math.round(left + i * colW + colW / 2);
    const cardW = Math.round(colW - 28);
    const cardX = Math.round(cx - cardW / 2);
    stepCard(o, b, i, fonts, { cardX, cardY: cardTop, cardW, cardH, badgeCX: cx, badgeR });
    // badge sits ON the rail (redraw center over the card badge for the rail look)
    o.push(circle({ x: cx, y: railY, r: badgeR, fill: TEAL, layerRole: 'decor' }));
    o.push(circle({ x: cx, y: railY, r: badgeR, fill: 'transparent', stroke: PAPER, strokeWidth: 4, layerRole: 'decor' }));
    o.push(textbox({
      text: String(i + 1), x: cx - badgeR, y: railY - Math.round(badgeR * 0.62), w: badgeR * 2,
      fontSize: Math.round(badgeR * 0.95), fontFamily: fonts.head, fontWeight: '900', fill: '#FFFFFF',
      align: 'center', lineHeight: 1, layerRole: 'decor', bgRef: TEAL
    }));
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1286);
  return canvas;
}

// note: in landscape the per-card badge (drawn inside stepCard at card center)
// is intentionally re-drawn on the rail; the card-center badge is hidden under
// the card content region — acceptable since the rail badge is the focal one.
// To keep it clean, portrait uses the card-center badge and landscape the rail
// badge; both are numbered identically.

function previewPortrait(palette) {
  const parts = [
    pvRect(pv(88), pv(96), pv(360), 5, TEAL, { rx: 2 }),
    pvBars({ x: pv(88), y: pv(150), w: pv(980), lines: 2, barH: 8, gap: 5, fill: INK }),
    pvSlot(pv(1094), pv(96), pv(240), pv(240), palette.primary)
  ];
  // progress segments
  for (let i = 0; i < 4; i++) {
    parts.push(pvRect(pv(88 + i * 315), pv(400), pv(295), 4, TEAL, { rx: 2 }));
  }
  // rail
  parts.push(pvRect(pv(152), pv(470), 3, pv(1330), RAIL_BG, { rx: 1 }));
  const top = 448, rowH = (1824 - 448) / 4;
  for (let i = 0; i < 4; i++) {
    const cardY = top + i * rowH + 10;
    const cardH = rowH - 24;
    parts.push(pvRect(pv(236), pv(cardY), pv(1090), pv(cardH), CARD, { rx: 4, stroke: RAIL_BG }));
    parts.push(pvRect(pv(236), pv(cardY + 18), 1.5, pv(cardH - 36), TEAL, { rx: 1 }));
    parts.push(pvCircle(pv(156), pv(cardY + cardH / 2), pv(46), TEAL));
    parts.push(pvRect(pv(272), pv(cardY + 28), pv(400), 5, INK, { rx: 2 }));
    parts.push(pvBars({ x: pv(272), y: pv(cardY + 70), w: pv(980), lines: 2, barH: 4, gap: 3, fill: SLATE }));
  }
  parts.push(pvRect(0, pv(1872), 200, pv(128), INK));
  return svgWrapO(parts, PAPER, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvRect(pv(88), pv(72), pv(300), 5, TEAL, { rx: 2 }),
    pvBars({ x: pv(88), y: pv(120), w: pv(1180), lines: 2, barH: 7, gap: 4, fill: INK }),
    pvSlot(pv(1720), pv(72), pv(192), pv(192), palette.primary)
  ];
  for (let i = 0; i < 4; i++) {
    parts.push(pvRect(pv(88 + i * 465), pv(320), pv(445), 4, TEAL, { rx: 2 }));
  }
  const railY = 480, left = 88, colW = (2000 - 176) / 4;
  parts.push(pvRect(pv(128), pv(railY - 4), pv(2000 - 256), 3, RAIL_BG, { rx: 1 }));
  for (let i = 0; i < 4; i++) {
    const cx = left + i * colW + colW / 2;
    const cardW = colW - 28;
    parts.push(pvRect(pv(cx - cardW / 2), pv(railY + 64), pv(cardW), pv(660), CARD, { rx: 4, stroke: RAIL_BG }));
    parts.push(pvCircle(pv(cx), pv(railY), pv(40), TEAL));
    parts.push(pvBars({ x: pv(cx - cardW / 2 + 30), y: pv(railY + 100), w: pv(cardW - 60), lines: 3, barH: 4, gap: 3, fill: SLATE }));
  }
  parts.push(pvRect(0, pv(1286), PV_LAND_W, pv(128), INK));
  return svgWrapO(parts, PAPER, 'landscape');
}

export default {
  id: 'training-module',
  name: 'Training module',
  style: 'infographic',
  description: 'Clean instructional training layout with numbered learning steps on a progress rail, circular step badges, checkpoint markers, and a segmented progress bar signalling module length. Corporate teal accent on a bright off-white ground with charcoal titles and slate body copy. Portrait stacks step cards down a vertical rail; landscape hangs step cards beneath a horizontal progress rail.',
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
