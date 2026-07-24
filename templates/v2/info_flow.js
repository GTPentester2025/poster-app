// v2 template — info-flow (style: infographic). A flowing numbered process
// path: circular numbered nodes joined by a dotted trail (quadratic arc
// approximated with stacked circles), each node paired with a label chip +
// text card on alternating sides. Portrait snakes the flow down the page;
// landscape runs an S-curve of nodes left→right with cards above/below.
// 3–5 sequence blocks {label, text}, one honest image slot.
//
// 2026 redesign: deep near-black DARK_BASE canvas, DARK_PANEL frosted text
// cards with 1px hairlines, primary-color node discs with DARK_INK numerals
// (oversized, geometric), accent dot trail, generous 88px margins.
// NOTE: trail dots MUST use r=6, layerRole='decor' — test asserts this.
// Node number textboxes MUST use layerRole='decor'.

import {
  textbox, rect, circle, chip, imageSlot,
  fitFontSize, estTextHeight, pickTextColor,
  pv, pvRect, pvCircle, pvBars, pvSlot,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, dotGrid, meshGlow,
  svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM,
  legibilityScrim,
} from './decor.js';

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_PANEL, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: palette.accent, opacity: 0.18, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 176, height: 96, maxSize: 46, minSize: 30 });
  o.push(textbox({
    text, x: 88, y: y + Math.round((144 - estTextHeight(text, size, W - 176)) / 2),
    w: W - 176, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize, subMaxH = 120 }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 300, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    lineHeight: 1.06, layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.06) + 20;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: subMaxH, maxSize: 40, minSize: 28, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x,
      y: cursor,
      w, fontSize: subSize, fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM,
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.35) + 20;
  }
  return cursor;
}

/**
 * Dotted quadratic arc trail between two node centers.
 * Uses exactly 7 dots per segment, r=6, layerRole='decor' — test contract.
 */
function quadDots(o, p0, p1, p2, color) {
  for (let k = 1; k <= 7; k++) {
    const t = 0.12 + (0.76 * (k - 1)) / 6;
    const mt = 1 - t;
    const x = Math.round(mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x);
    const y = Math.round(mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y);
    o.push(circle({ x, y, r: 6, fill: color, layerRole: 'decor' }));
  }
}

/**
 * Numbered station node: halo ring + accent disc + step number.
 * Number textbox: layerRole='decor' — test contract.
 */
function flowNode(o, n, x, y, palette, fonts) {
  // outer halo ring (translucent decor)
  o.push(circle({
    x, y, r: 70, fill: 'transparent', stroke: palette.primary, strokeWidth: 4,
    opacity: 0.15, layerRole: 'decor'
  }));
  // inner solid disc (primary — explicit opacity=1, no opacity field → omitted)
  o.push(circle({ x, y, r: 54, fill: palette.primary, layerRole: 'decor' }));
  // step numeral — oversized, geometric, layerRole='decor'
  o.push(textbox({
    text: String(n), x: x - 50, y: y - 26, w: 100, fontSize: 50,
    fontFamily: fonts.head, fontWeight: '900', fill: pickTextColor(palette.primary),
    align: 'center', lineHeight: 1, layerRole: 'decor', bgRef: palette.primary
  }));
}

/** Frosted DARK_PANEL card with label chip (fieldRef 'label') + body text (fieldRef 'text'). */
function flowCard(o, b, palette, fonts, { x, y, w, textBudget }) {
  // card surface
  o.push(rect({
    x, y, w, h: textBudget + 16, fill: DARK_PANEL, rx: 20,
    shadow: { color: 'rgba(0,0,0,0.45)', blur: 22, offsetX: 0, offsetY: 10 },
    layerRole: 'background', msgId: b.id
  }));
  o.push(rect({
    x, y, w, h: textBudget + 16, fill: 'transparent',
    stroke: palette.primary, strokeWidth: 2, rx: 20,
    opacity: 0.09, layerRole: 'decor'
  }));

  let textY = y + 16;
  if (b.label) {
    const chipBudgetH = Math.round(textBudget * 0.35);
    const [pill, labelText] = chip({
      text: b.label, x: x + 20, y: textY, fontSize: 24,
      bg: palette.dark, color: palette.primary, font: fonts.head, msgId: b.id,
      maxW: w - 40, maxH: chipBudgetH
    });
    o.push(pill, { ...labelText, fieldRef: 'label', bgRef: palette.dark });
    textY = y + 16 + pill.height + 12;
  }
  const size = fitFontSize(b.text, { width: w - 40, height: textBudget - (textY - y), maxSize: 44, minSize: 20 });
  o.push({
    ...textbox({
      text: b.text, x: x + 20, y: textY, w: w - 40, fontSize: size,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
      lineHeight: 1.38, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'text'
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'diagonal', intensity: 0.7 }));
  o.push(...dotGrid({ x: 1060, y: 370, cols: 5, rows: 3, gap: 50, dotR: 5, color: palette.primary, intensity: 0.7 }));
  o.push(...meshGlow({
    spots: [
      { x: 260, y: 800, r: 440, color: palette.primary },
      { x: W - 220, y: H - 500, r: 380, color: palette.accent }
    ],
    intensity: 0.9
  }));

  const hzCursor = headlineZone(o, content, palette, fonts, { x: 88, y: 96, w: 940, maxSize: 112 });

  o.push(imageSlot({
    slotId: 'slot-1', x: 1086, y: 92, w: 240, h: 240,
    styleHint: 'flowing process or pathway emblem, flat vector, no text', stroke: palette.primary
  }));

  const blocks = content.blocks || [];
  const top = Math.max(560, hzCursor + 16);
  const bottom = 1800;
  const rowH = (bottom - top) / Math.max(blocks.length, 1);
  const nodes = blocks.map((_, i) => ({
    x: i % 2 === 0 ? 256 : 1158,
    y: Math.round(top + i * rowH + 68)
  }));

  // trail first, so nodes sit on top of the dots
  for (let i = 0; i < nodes.length - 1; i++) {
    const p0 = nodes[i];
    const p2 = nodes[i + 1];
    quadDots(o, p0, { x: 707, y: Math.round((p0.y + p2.y) / 2) }, p2, palette.accent);
  }

  blocks.forEach((b, i) => {
    const rowY = Math.round(top + i * rowH);
    flowNode(o, i + 1, nodes[i].x, nodes[i].y, palette, fonts);
    // card on opposite side of node, reasonable width
    const cardX = i % 2 === 0 ? 364 : 88;
    const cardW = i % 2 === 0 ? 948 - 364 + 88 : 256 - 88 - 16; // keep cards wide
    // simpler: alternate cards with good width
    const cx = i % 2 === 0 ? 370 : 88;
    const cw = i % 2 === 0 ? 960 : 960;
    flowCard(o, b, palette, fonts, {
      x: 88, y: rowY + 4, w: 970, textBudget: Math.round(rowH) - 36
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1856);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'horizontal', intensity: 0.7 }));
  o.push(...dotGrid({ x: 1460, y: 400, cols: 5, rows: 2, gap: 50, dotR: 5, color: palette.primary, intensity: 0.7 }));
  o.push(...meshGlow({
    spots: [
      { x: 300, y: 600, r: 380, color: palette.primary },
      { x: W - 300, y: H - 300, r: 360, color: palette.accent }
    ],
    intensity: 0.9
  }));

  const lsHz = headlineZone(o, content, palette, fonts, { x: 88, y: 80, w: 1300, maxSize: 100 });

  o.push(imageSlot({
    slotId: 'slot-1', x: 1660, y: 88, w: 252, h: 252,
    styleHint: 'flowing process or pathway emblem, flat vector, no text', stroke: palette.primary
  }));

  // S-curve: node height alternates high/low across the page
  // Ensure nodes are placed below the headline zone
  const nodeHighBase = Math.max(620, lsHz + 180);
  const nodeLowBase = Math.max(1000, nodeHighBase + 380);
  const blocks = content.blocks || [];
  const left = 140;
  const right = 1900;
  const colW = (right - left) / Math.max(blocks.length, 1);
  const nodes = blocks.map((_, i) => ({
    x: Math.round(left + colW * (i + 0.5)),
    y: i % 2 === 0 ? nodeHighBase : nodeLowBase
  }));

  for (let i = 0; i < nodes.length - 1; i++) {
    const p0 = nodes[i];
    const p2 = nodes[i + 1];
    quadDots(o, p0, {
      x: Math.round((p0.x + p2.x) / 2),
      y: Math.round((p0.y + p2.y) / 2) + (i % 2 === 0 ? 70 : -70)
    }, p2, palette.accent);
  }

  blocks.forEach((b, i) => {
    flowNode(o, i + 1, nodes[i].x, nodes[i].y, palette, fonts);
    const w = Math.round(colW - 64);
    const x = Math.round(nodes[i].x - w / 2);
    // card below high nodes, above low nodes — the free half of the S
    const cardBelowHigh = nodeHighBase + 124;
    const cardAboveLow = Math.max(lsHz + 16, nodeLowBase - 546);
    const cardY = i % 2 === 0 ? cardBelowHigh : cardAboveLow;
    const budget = i % 2 === 0 ? Math.max(100, 1230 - cardY) : Math.max(100, nodeLowBase - 66 - cardY);
    flowCard(o, b, palette, fonts, { x, y: cardY, w, textBudget: budget });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvBars({ x: pv(88), y: pv(110), w: pv(940), lines: 2, barH: 8, gap: 5, fill: DARK_INK }),
    pvSlot(pv(1086), pv(92), pv(240), pv(240), palette.primary)
  ];
  for (let i = 0; i < 4; i++) {
    const y = 560 + i * 310;
    const nodeX = i % 2 === 0 ? 256 : 1158;
    if (i < 3) {
      const nx2 = i % 2 === 0 ? 1158 : 256;
      for (let k = 1; k <= 4; k++) {
        const t = k / 5;
        parts.push(pvCircle(pv(nodeX + (nx2 - nodeX) * t), pv(y + 68 + 310 * t), 1, palette.accent));
      }
    }
    parts.push(pvCircle(pv(nodeX), pv(y + 68), 7.6, palette.primary));
    parts.push(pvRect(pv(88), pv(y + 4), pv(970), pv(24), DARK_PANEL, { rx: 3 }));
    parts.push(pvRect(pv(108), pv(y + 10), pv(120), 4, palette.primary, { rx: 2 }));
    parts.push(pvBars({ x: pv(108), y: pv(y + 82), w: pv(940), lines: 2, barH: 4.5, gap: 3, fill: DARK_INK }));
  }
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvBars({ x: pv(88), y: pv(95), w: pv(1300), lines: 2, barH: 8, gap: 5, fill: DARK_INK }),
    pvSlot(pv(1660), pv(88), pv(252), pv(252), palette.primary)
  ];
  for (let i = 0; i < 4; i++) {
    const cx = 140 + 440 * (i + 0.5);
    const ny = i % 2 === 0 ? 620 : 1000;
    if (i < 3) {
      const ny2 = i % 2 === 0 ? 1000 : 620;
      for (let k = 1; k <= 4; k++) {
        const t = k / 5;
        parts.push(pvCircle(pv(cx + 440 * t), pv(ny + (ny2 - ny) * t), 1, palette.accent));
      }
    }
    parts.push(pvCircle(pv(cx), pv(ny), 7.6, palette.primary));
    const cardY = i % 2 === 0 ? 744 : 454;
    parts.push(pvRect(pv(cx - 190), pv(cardY), pv(380), pv(24), DARK_PANEL, { rx: 3 }));
    parts.push(pvBars({ x: pv(cx - 180), y: pv(cardY + 74), w: pv(360), lines: 3, barH: 4, gap: 3, fill: DARK_INK }));
  }
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'info-flow',
  name: 'Flow path',
  style: 'infographic',
  description: 'Numbered circular stations on a flowing dotted accent trail, each step carrying a label and explanation in a frosted DARK_PANEL card, on a near-black canvas. Snakes down the page in portrait, sweeps left to right as an S-curve in landscape.',
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
