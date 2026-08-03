// v2 template — data-ring (style: stats). Donut-ring dashboard: every stat is
// a big ring gauge — a muted full track circle, a bright brand-colour value
// ring inside it, an accent marker dot on the rim, and the figure sitting on
// an accent chip in the ring's centre with the caption beneath. Portrait lays
// the gauges in a 2x2 grid; landscape lines all four up in a single 1x4 row.
// Uses the gallery's stats field convention {figure, caption}.

import {
  textbox, rect, circle, backgroundImageSlot,
  fitTextBlock,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, svgWrapO, PV_LAND_W,
  legibilityScrim, DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM
} from './decor.js';

/**
 * One ring gauge in a cell: panel, track ring, value ring, marker dot,
 * figure on a centred accent chip, caption below the ring.
 */
function ringStat(o, b, palette, fonts, { x, y, w, h, r }, pickOn) {
  // cell panel
  o.push(rect({ x, y, w, h, fill: DARK_PANEL, rx: 28, layerRole: 'background', msgId: b.id }));
  o.push(rect({
    x, y, w, h, fill: 'transparent', stroke: palette.primary, strokeWidth: 2,
    rx: 28, opacity: 0.16, layerRole: 'decor'
  }));

  const cx = x + Math.round(w / 2);
  const ringTop = y + 36;
  const cy = ringTop + r;
  // muted full track
  o.push(circle({
    x: cx, y: cy, r, fill: 'transparent', stroke: DARK_PANEL_2, strokeWidth: 26,
    layerRole: 'background'
  }));
  // bright value ring just inside the track
  o.push(circle({
    x: cx, y: cy, r: r - 26, fill: 'transparent', stroke: palette.primary, strokeWidth: 14,
    layerRole: 'background'
  }));
  // accent marker dot on the rim (suggests the arc's end point)
  o.push(circle({
    x: Math.round(cx + r * 0.707), y: Math.round(cy - r * 0.707), r: 16,
    fill: palette.accent, layerRole: 'decor'
  }));

  // figure on a centred accent chip inside the ring
  const figW = 2 * r - 96;
  const fig = fitTextBlock(b.figure, { width: figW, height: 2 * r - 120, maxSize: 88, minSize: 16, lineHeight: 1.05 });
  const chipH = Math.round(fig.height) + 40;
  const chipW = 2 * r - 64;
  o.push(rect({
    x: cx - Math.round(chipW / 2), y: cy - Math.round(chipH / 2), w: chipW, h: chipH,
    fill: palette.accent, rx: 20, layerRole: 'background', msgId: b.id
  }));
  o.push({
    ...textbox({
      text: b.figure, x: cx - Math.round(figW / 2), y: Math.round(cy - fig.height / 2), w: figW,
      fontSize: fig.fontSize, fontFamily: fonts.head, fontWeight: '900',
      fill: pickOn(palette.accent), align: 'center', lineHeight: 1.05,
      layerRole: 'message', msgId: b.id, bgRef: palette.accent
    }),
    fieldRef: 'figure'
  });

  // caption beneath the ring
  const capY = ringTop + 2 * r + 30;
  const capBudget = Math.max(44, y + h - capY - 28);
  const cap = fitTextBlock(b.caption, { width: w - 56, height: capBudget, maxSize: 34, minSize: 16, lineHeight: 1.3 });
  o.push({
    ...textbox({
      text: b.caption, x: x + 28, y: capY, w: w - 56, fontSize: cap.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM, align: 'center',
      lineHeight: 1.3, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'caption'
  });
}

function headlineZone(o, content, fonts, { x, y, w, headBudget, maxSize }) {
  const head = fitTextBlock(content.headline, { width: w, height: headBudget, maxSize, minSize: 80, lineHeight: 1.05 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    lineHeight: 1.05, layerRole: 'headline', bgRef: DARK_BASE
  }));
  let bottom = y + head.height;
  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, { width: w, height: 100, maxSize: 38, minSize: 16, lineHeight: 1.3 });
    o.push(textbox({
      text: content.subheadline, x, y: Math.round(bottom + 20), w, fontSize: sub.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
      lineHeight: 1.3, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    bottom += 20 + sub.height;
  }
  return bottom;
}

function ctaBar(o, text, palette, fonts, W, y, h) {
  o.push(rect({ x: 0, y, w: W, h, fill: DARK_PANEL, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: palette.primary, opacity: 0.18, layerRole: 'decor' }));
  const cta = fitTextBlock(text, { width: W - 180, height: h - 44, maxSize: 44, minSize: 30, lineHeight: 1.16 });
  o.push(textbox({
    text, x: 90, y: y + Math.round((h - cta.height) / 2), w: W - 180,
    fontSize: cta.fontSize, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

// pickTextColor is imported lazily via closure to keep the ringStat signature tidy
import { pickTextColor } from '../helpers.js';

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark analytics dashboard atmosphere, faint glowing gauges, deep charcoal, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  o.push(...meshGlow({
    spots: [
      { x: 220, y: 320, r: 380, color: palette.primary },
      { x: W - 180, y: H - 500, r: 420, color: palette.accent }
    ],
    intensity: 0.85
  }));

  const contentBottom = headlineZone(o, content, fonts, { x: 96, y: 96, w: 1222, headBudget: 280, maxSize: 116 });

  const blocks = (content.blocks || []).slice(0, 4);
  const ctaH = 148;
  const gap = 32;
  const top = Math.max(Math.round(contentBottom) + 52, 556);
  const gridH = H - ctaH - 20 - top;
  const rows = blocks.length > 2 ? 2 : 1;
  const cols = 2;
  const cellH = Math.floor((gridH - gap * (rows - 1)) / rows);
  const cellW = Math.floor((W - 176 - gap) / 2);
  const r = Math.min(170, Math.floor((cellW - 80) / 2), Math.floor((cellH - 170) / 2));
  blocks.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    ringStat(o, b, palette, fonts, {
      x: 88 + col * (cellW + gap), y: top + row * (cellH + gap), w: cellW, h: cellH, r
    }, pickTextColor);
  });

  ctaBar(o, content.callToAction, palette, fonts, W, H - ctaH, ctaH);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark analytics dashboard atmosphere, faint glowing gauges, deep charcoal, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  o.push(...meshGlow({
    spots: [
      { x: 260, y: 260, r: 360, color: palette.primary },
      { x: W - 240, y: H - 340, r: 400, color: palette.accent }
    ],
    intensity: 0.85
  }));

  const contentBottom = headlineZone(o, content, fonts, { x: 80, y: 80, w: 1840, headBudget: 230, maxSize: 108 });

  const blocks = (content.blocks || []).slice(0, 4);
  const ctaH = 136;
  const gap = 28;
  const n = Math.max(blocks.length, 1);
  const top = Math.max(Math.round(contentBottom) + 48, 496);
  const cellH = H - ctaH - 24 - top;
  const cellW = Math.floor((W - 160 - gap * (n - 1)) / n);
  const r = Math.min(150, Math.floor((cellW - 70) / 2), Math.floor((cellH - 160) / 2));
  blocks.forEach((b, i) => {
    ringStat(o, b, palette, fonts, {
      x: 80 + i * (cellW + gap), y: top, w: cellW, h: cellH, r
    }, pickTextColor);
  });

  ctaBar(o, content.callToAction, palette, fonts, W, H - ctaH, ctaH);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvBars({ x: pv(96), y: pv(110), w: pv(1222), lines: 2, barH: 9, gap: 5, fill: DARK_INK })
  ];
  const cellW = Math.floor((1414 - 176 - 32) / 2);
  const cellH = 620;
  for (let i = 0; i < 4; i++) {
    const x = 88 + (i % 2) * (cellW + 32);
    const y = 556 + Math.floor(i / 2) * (cellH + 32);
    const cx = x + cellW / 2;
    const cy = y + 36 + 170;
    parts.push(pvRect(pv(x), pv(y), pv(cellW), pv(cellH), DARK_PANEL, { rx: 4 }));
    parts.push(`<circle cx="${pv(cx)}" cy="${pv(cy)}" r="${pv(170)}" fill="none" stroke="${DARK_PANEL_2}" stroke-width="3.6"/>`);
    parts.push(`<circle cx="${pv(cx)}" cy="${pv(cy)}" r="${pv(144)}" fill="none" stroke="${palette.primary}" stroke-width="2"/>`);
    parts.push(pvCircle(pv(cx + 120), pv(cy - 120), pv(16), palette.accent));
    parts.push(pvRect(pv(cx - 100), pv(cy - 40), pv(200), pv(80), palette.accent, { rx: 3 }));
    parts.push(pvBars({ x: pv(x + 28), y: pv(y + 36 + 340 + 30), w: pv(cellW - 56), lines: 2, barH: 4, gap: 3, fill: DARK_INK_DIM, align: 'center' }));
  }
  parts.push(pvRect(0, pv(1852), 200, pv(148), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvBars({ x: pv(80), y: pv(95), w: pv(1840), lines: 2, barH: 9, gap: 5, fill: DARK_INK })
  ];
  const cellW = Math.floor((2000 - 160 - 84) / 4);
  for (let i = 0; i < 4; i++) {
    const x = 80 + i * (cellW + 28);
    const y = 496;
    const cx = x + cellW / 2;
    const cy = y + 36 + 150;
    parts.push(pvRect(pv(x), pv(y), pv(cellW), pv(754), DARK_PANEL, { rx: 4 }));
    parts.push(`<circle cx="${pv(cx)}" cy="${pv(cy)}" r="${pv(150)}" fill="none" stroke="${DARK_PANEL_2}" stroke-width="3.4"/>`);
    parts.push(`<circle cx="${pv(cx)}" cy="${pv(cy)}" r="${pv(124)}" fill="none" stroke="${palette.primary}" stroke-width="1.8"/>`);
    parts.push(pvCircle(pv(cx + 106), pv(cy - 106), pv(15), palette.accent));
    parts.push(pvRect(pv(cx - 88), pv(cy - 36), pv(176), pv(72), palette.accent, { rx: 3 }));
    parts.push(pvBars({ x: pv(x + 24), y: pv(y + 36 + 300 + 30), w: pv(cellW - 48), lines: 3, barH: 4, gap: 3, fill: DARK_INK_DIM, align: 'center' }));
  }
  parts.push(pvRect(0, pv(1278), PV_LAND_W, pv(136), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'data-ring',
  name: 'Ring gauges',
  style: 'stats',
  description: 'Donut-ring dashboard: every stat is a big gauge — a muted track circle, a bright brand-colour value ring, an accent marker dot on the rim, the figure on an accent chip in the centre and the caption beneath. 2x2 gauge grid in portrait, a single 1x4 row in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'stats', min: 3, max: 4, fields: ['figure', 'caption'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
