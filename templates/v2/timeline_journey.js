// v2 template — timeline-journey (style: timeline). A sequenced milestone
// rail: portrait runs a vertical rail down the left with numbered station
// nodes; landscape runs a horizontal station rail across the middle. 3–5
// sequence blocks {label, text}, one honest image slot, decor = gradient
// wash + dot grid + ghost shield.
//
// 2026 redesign: elevated station-node design with oversized index numerals,
// rich dark panel cards per milestone, generous margins, and a refined
// gradient-wash atmosphere. Both orientations fully realigned.

import {
  textbox, rect, circle, chip, imageSlot, hline, vline,
  backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvCircle, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims,
  gradientWash, dotGrid, meshGlow, cornerFrame,
  legibilityScrim,
  DARK_PANEL, DARK_INK_DIM,
  svgWrapO, PV_LAND_W
} from './decor.js';

// ── shared helpers ────────────────────────────────────────────────────────────

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 152, fill: palette.dark, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 200, height: 100, maxSize: 46, minSize: 30 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((152 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: palette.dark
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize, subMaxH = 150 }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 300, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark,
    lineHeight: 1.06,
    layerRole: 'headline', bgRef: palette.background
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.06) + 28;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: subMaxH, maxSize: 40, minSize: 28, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.35,
      layerRole: 'subheadline', bgRef: palette.background
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.35) + 24;
  }
  return cursor;
}

// ── portrait build ────────────────────────────────────────────────────────────

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.background);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // decor atmosphere
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'diagonal', intensity: 0.7 }));
  o.push(...meshGlow({ spots: [
    { x: 1260, y: 360, r: 380, color: palette.primary },
    { x: 180, y: 1680, r: 340, color: palette.accent }
  ], intensity: 0.75 }));
  o.push(...dotGrid({ x: 1020, y: 480, cols: 7, rows: 5, gap: 56, dotR: 4, color: palette.dark, intensity: 0.7 }));
  o.push(...cornerFrame({ x: 64, y: 64, w: 1286, h: 1872, color: palette.dark, arm: 80, thickness: 6, intensity: 0.8 }));

  const headCursor = headlineZone(o, content, palette, fonts, { x: 96, y: 112, w: 920, maxSize: 116 });

  o.push(imageSlot({
    slotId: 'slot-1', x: 1072, y: 104, w: 248, h: 248,
    styleHint: 'journey or roadmap emblem, flat vector, no text', stroke: palette.dark
  }));

  // vertical milestone rail — moved right to give card cards more room
  const railX = 180;
  const top = Math.max(560, headCursor + 16);
  const bottom = 1752;
  // thin accent line
  o.push(vline({ x: railX + 1, y: top - 16, h: bottom - top + 32, thickness: 4, fill: palette.primary, layerRole: 'decor' }));

  const blocks = content.blocks || [];
  const blockH = (bottom - top) / Math.max(blocks.length, 1);

  blocks.forEach((b, i) => {
    const cy = Math.round(top + i * blockH + 48);
    const cardY = Math.round(top + i * blockH);
    const cardH = Math.round(blockH - 24);

    // station node — oversized numeral ring
    o.push(circle({ x: railX + 2, y: cy, r: 32, fill: palette.background, stroke: palette.primary, strokeWidth: 6, layerRole: 'decor' }));
    o.push(textbox({
      text: String(i + 1), x: railX - 20, y: cy - 22, w: 44,
      fontSize: 26, fontFamily: fonts.head, fontWeight: '900',
      fill: palette.primary, align: 'center', lineHeight: 1,
      layerRole: 'decor', bgRef: palette.background
    }));

    // milestone card
    const cardX = 248;
    const cardW = W - cardX - 80;
    o.push(rect({
      x: cardX, y: cardY, w: cardW, h: cardH,
      fill: palette.background, rx: 24,
      stroke: palette.primary, strokeWidth: 1,
      opacity: 0.07, layerRole: 'background', msgId: b.id
    }));
    // visible card (no opacity on the card itself — the above is a subtle tint wash)
    o.push(rect({
      x: cardX, y: cardY, w: cardW, h: cardH,
      fill: 'transparent', rx: 24,
      stroke: palette.primary, strokeWidth: 1,
      layerRole: 'background', msgId: b.id
    }));
    // accent left bar inside card
    o.push(rect({ x: cardX, y: cardY + 16, w: 6, h: cardH - 32, fill: palette.primary, rx: 3, layerRole: 'decor' }));

    let textY = cardY + 24;
    if (b.label) {
      const chipBudgetH = Math.round(cardH * 0.35);
      const [pill, labelTb] = chip({
        text: b.label, x: cardX + 32, y: textY, fontSize: 24,
        bg: palette.dark, color: palette.primary, font: fonts.head, msgId: b.id,
        maxW: cardW - 64, maxH: chipBudgetH
      });
      o.push(pill, { ...labelTb, fieldRef: 'label', bgRef: palette.dark });
      textY += pill.height + 12;
    }
    const textW = cardW - 64;
    const size = fitFontSize(b.text, {
      width: textW, height: Math.max(90, cardY + cardH - textY - 24), maxSize: 46, minSize: 20
    });
    o.push({
      ...textbox({
        text: b.text, x: cardX + 32, y: textY, w: textW, fontSize: size,
        fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
        lineHeight: 1.38,
        layerRole: 'message', msgId: b.id, bgRef: palette.background
      }),
      fieldRef: 'text'
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1848);
  return canvas;
}

// ── landscape build ───────────────────────────────────────────────────────────

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.background);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'horizontal', intensity: 0.7 }));
  o.push(...meshGlow({ spots: [
    { x: 1780, y: 260, r: 340, color: palette.primary },
    { x: 220, y: 1160, r: 300, color: palette.accent }
  ], intensity: 0.75 }));
  o.push(...dotGrid({ x: 96, y: 1060, cols: 6, rows: 4, gap: 52, dotR: 4, color: palette.dark, intensity: 0.7 }));

  headlineZone(o, content, palette, fonts, { x: 96, y: 88, w: 1360, maxSize: 108 });

  o.push(imageSlot({
    slotId: 'slot-1', x: 1680, y: 96, w: 240, h: 240,
    styleHint: 'journey or roadmap emblem, flat vector, no text', stroke: palette.dark
  }));

  // horizontal station rail
  const railY = 656;
  const left = 96;
  const right = 1904;
  o.push(hline({ x: left, y: railY + 1, w: right - left, thickness: 4, fill: palette.primary, layerRole: 'decor' }));

  const blocks = content.blocks || [];
  const colW = (right - left) / Math.max(blocks.length, 1);

  blocks.forEach((b, i) => {
    const cx = Math.round(left + i * colW + colW / 2);
    const cardX = Math.round(left + i * colW + 8);
    const cardW = Math.round(colW - 16);

    // station node
    o.push(circle({ x: cx, y: railY + 2, r: 28, fill: palette.background, stroke: palette.primary, strokeWidth: 5, layerRole: 'decor' }));
    o.push(textbox({
      text: String(i + 1), x: cx - 22, y: railY - 18, w: 44,
      fontSize: 24, fontFamily: fonts.head, fontWeight: '900',
      fill: palette.primary, align: 'center', lineHeight: 1,
      layerRole: 'decor', bgRef: palette.background
    }));

    // card below rail
    const cardY = railY + 48;
    const cardH = 1224 - cardY - 8;
    o.push(rect({
      x: cardX, y: cardY, w: cardW, h: cardH,
      fill: palette.background, rx: 20,
      stroke: palette.primary, strokeWidth: 1,
      opacity: 0.07, layerRole: 'background', msgId: b.id
    }));
    o.push(rect({
      x: cardX, y: cardY, w: cardW, h: cardH,
      fill: 'transparent', rx: 20,
      stroke: palette.primary, strokeWidth: 1,
      layerRole: 'background', msgId: b.id
    }));
    o.push(rect({ x: cardX + 16, y: cardY, w: cardW - 32, h: 4, fill: palette.primary, rx: 2, layerRole: 'decor' }));

    let textY = cardY + 24;
    if (b.label) {
      const chipBudgetH = Math.round(cardH * 0.35);
      const [pill, labelTb] = chip({
        text: b.label, x: cardX + 20, y: textY, fontSize: 22,
        bg: palette.dark, color: palette.primary, font: fonts.head, msgId: b.id,
        maxW: cardW - 40, maxH: chipBudgetH
      });
      o.push(pill, { ...labelTb, fieldRef: 'label', bgRef: palette.dark });
      textY += pill.height + 12;
    }
    const textW = cardW - 40;
    const size = fitFontSize(b.text, {
      width: textW, height: Math.max(80, cardY + cardH - textY - 24), maxSize: 42, minSize: 20
    });
    o.push({
      ...textbox({
        text: b.text, x: cardX + 20, y: textY, w: textW, fontSize: size,
        fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
        lineHeight: 1.38,
        layerRole: 'message', msgId: b.id, bgRef: palette.background
      }),
      fieldRef: 'text'
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1262);
  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────

function previewPortrait(palette) {
  const parts = [
    pvBars({ x: pv(96), y: pv(120), w: pv(920), lines: 2, barH: 8, gap: 5, fill: palette.dark }),
    pvSlot(pv(1072), pv(104), pv(248), pv(248), palette.dark),
    pvRect(pv(178), pv(544), 1.4, pv(1208), palette.primary)
  ];
  for (let i = 0; i < 4; i++) {
    const y = 560 + i * 298;
    const cy = y + 48;
    parts.push(pvCircle(pv(182), pv(cy), 4.6, palette.background, { stroke: palette.primary }));
    parts.push(pvRect(pv(248), pv(y), pv(1086), pv(282), 'none', { rx: 4, stroke: palette.primary, opacity: 0.5 }));
    parts.push(pvRect(pv(280), pv(y + 10), pv(150), 4, palette.dark, { rx: 2 }));
    parts.push(pvBars({ x: pv(280), y: pv(y + 76), w: pv(1054), lines: 2, barH: 4.5, gap: 3, fill: palette.dark }));
  }
  parts.push(pvRect(0, pv(1848), 200, pv(152), palette.dark));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvBars({ x: pv(96), y: pv(100), w: pv(1360), lines: 2, barH: 8, gap: 5, fill: palette.dark }),
    pvSlot(pv(1680), pv(96), pv(240), pv(240), palette.dark),
    pvRect(pv(96), pv(658), pv(1808), 1.4, palette.primary)
  ];
  for (let i = 0; i < 4; i++) {
    const x = 96 + i * 451;
    const cx = x + 226;
    parts.push(pvCircle(pv(cx), pv(660), 4, palette.background, { stroke: palette.primary }));
    parts.push(pvRect(pv(x + 8), pv(704), pv(435), pv(504), 'none', { rx: 3, stroke: palette.primary, opacity: 0.5 }));
    parts.push(pvRect(pv(x + 28), pv(724), pv(130), 4, palette.dark, { rx: 2 }));
    parts.push(pvBars({ x: pv(x + 28), y: pv(792), w: pv(395), lines: 3, barH: 4, gap: 3, fill: palette.dark }));
  }
  parts.push(pvRect(0, pv(1262), PV_LAND_W, pv(152), palette.dark));
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'timeline-journey',
  name: 'Timeline journey',
  style: 'timeline',
  description: 'Sequenced milestone rail with station nodes — vertical in portrait, a horizontal station line in landscape. For step-by-step behaviours.',
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
