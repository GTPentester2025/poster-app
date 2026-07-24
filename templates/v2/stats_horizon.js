// v2 template — stats-horizon (style: stats). A data-horizon wall: a single
// hairline horizon line runs across the canvas, and each stat's giant FIGURE
// stands above the line with its caption below while an accent COLUMN (a bar
// of index-varied height) rises behind it like a bar chart. The hero (first)
// figure is enlarged and lit — a soft glow bloom plus a light-beams sweep.
// One honest image slot sits in a corner as a background vignette. Portrait:
// figures spread along a mid-canvas horizon. Landscape is a REAL relayout —
// the horizon runs the full 2000px width with figures spread along it and the
// hero figure enlarged. 4–5 stats blocks {figure, caption}; figures are short
// ("91%") and sized explicitly at 120–260px, never word-wrapped.

import {
  textbox, rect, imageSlot, hline,
  fitFontSize, estTextHeight,
  pv, pvRect, pvCircle, pvBars, pvSlot,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, softGlow, lightBeams, meshGlow,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM,
  svgWrapO, PV_LAND_W,
  legibilityScrim,
} from './decor.js';

// index → relative column height factor (a small, deliberate bar-chart
// rhythm; the hero at index 0 is always the tallest).
const COL_FACTORS = [1, 0.62, 0.82, 0.5, 0.72];

function ctaBar(o, text, palette, fonts, W, y) {
  // Hairline accent rule above the CTA band
  o.push(hline({ x: 0, y: y - 2, w: W, thickness: 2, fill: palette.primary, layerRole: 'decor' }));
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_BASE, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 180, height: 96, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text, x: 90, y: y + Math.round((144 - estTextHeight(text, size, W - 180)) / 2),
    w: W - 180, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_BASE
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize, headMaxH = 300, subMaxH = 120 }) {
  const headSize = fitFontSize(content.headline, { width: w, height: headMaxH, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    lineHeight: 1.06, layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + Math.round(estTextHeight(content.headline, headSize, w, 1.06)) + 24;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: Math.max(40, subMaxH), maxSize: 40, minSize: 20, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += Math.round(estTextHeight(content.subheadline, subSize, w, 1.35)) + 16;
  }
  return cursor;
}

/**
 * One horizon stat: accent COLUMN rising to the horizon behind the figure,
 * the giant FIGURE (fieldRef 'figure') sitting above the line, the caption
 * (fieldRef 'caption') below it. Figures are short — sized by an EXPLICIT
 * fontSize, not fitFontSize word-wrap. hero = the lit lead figure.
 */
function horizonStat(o, b, palette, fonts, { x, w, horizonY, figSize, colFactor, hero = false }) {
  const cx = x + w / 2;

  // Accent column rising behind the figure to the horizon line
  const colW = Math.round(w * (hero ? 0.48 : 0.38));
  const colH = Math.round((hero ? 360 : 256) * colFactor);
  o.push(rect({
    x: Math.round(cx - colW / 2), y: horizonY - colH, w: colW, h: colH,
    fill: palette.accent, rx: 8, opacity: 0.14, layerRole: 'decor'
  }));
  // Thin cap rule on top of the column
  o.push(rect({
    x: Math.round(cx - colW / 2), y: horizonY - colH, w: colW, h: 3,
    fill: palette.accent, rx: 2, opacity: 0.18, layerRole: 'decor'
  }));

  // Giant figure above the line (explicit size — figures are short strings)
  const figH = Math.round(figSize * 1.04);
  o.push({
    ...textbox({
      text: b.figure, x, y: horizonY - colH - figH - 16, w, fontSize: figSize,
      fontFamily: fonts.head, fontWeight: '900',
      fill: hero ? palette.accent : DARK_INK, align: 'center',
      lineHeight: 1.04, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'figure'
  });

  // Caption below the horizon line
  const capSize = fitFontSize(b.caption, { width: w - 24, height: 200, maxSize: hero ? 44 : 40, minSize: 38 });
  o.push({
    ...textbox({
      text: b.caption, x: x + 12, y: horizonY + 28, w: w - 24, fontSize: capSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM, align: 'center',
      layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'caption'
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  const blocks = content.blocks || [];
  const horizonY = 1200;

  // Corner background vignette slot (top-right)
  o.push(imageSlot({
    slotId: 'slot-1', x: 1076, y: 96, w: 250, h: 250,
    styleHint: 'abstract data horizon or skyline vignette, flat vector, no text', stroke: palette.primary
  }));

  // Atmospheric depth: mesh glow blooms + light beams
  o.push(...meshGlow({
    spots: [
      { x: W * 0.35, y: horizonY - 220, r: 440, color: palette.primary },
      { x: W - 100, y: horizonY + 200, r: 320, color: palette.accent }
    ],
    intensity: 0.9
  }));
  o.push(...lightBeams({ w: W, h: 2000, color: palette.primary, count: 3, angle: 22, intensity: 0.55 }));

  headlineZone(o, content, palette, fonts, { x: 88, y: 110, w: 950, maxSize: 108, subMaxH: 178 });

  // Hairline horizon rule
  o.push(hline({ x: 0, y: horizonY, w: W, thickness: 3, fill: palette.primary, layerRole: 'decor' }));
  // Subtle glow strip along the horizon
  o.push(rect({ x: 0, y: horizonY - 1, w: W, h: 6, fill: palette.primary, opacity: 0.08, layerRole: 'decor' }));

  const n = Math.max(blocks.length, 1);
  const colW = W / n;
  blocks.forEach((b, i) => {
    const x = Math.round(i * colW);
    const w = Math.round((i + 1) * colW) - x;
    const hero = i === 0;
    if (hero) {
      o.push(...softGlow({ x: Math.round(x + w / 2), y: horizonY - 280, r: 340, color: palette.primary, intensity: 1 }));
    }
    horizonStat(o, b, palette, fonts, {
      x, w, horizonY,
      figSize: hero ? 196 : 136, colFactor: COL_FACTORS[i % COL_FACTORS.length], hero
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

  const blocks = content.blocks || [];
  const horizonY = 960;

  // Corner background vignette slot (top-right)
  o.push(imageSlot({
    slotId: 'slot-1', x: 1658, y: 88, w: 254, h: 254,
    styleHint: 'abstract data horizon or skyline vignette, flat vector, no text', stroke: palette.primary
  }));

  o.push(...meshGlow({
    spots: [
      { x: W * 0.22, y: horizonY - 200, r: 380, color: palette.primary },
      { x: W - 150, y: horizonY + 160, r: 300, color: palette.accent }
    ],
    intensity: 0.9
  }));
  o.push(...lightBeams({ w: W, h: 1414, color: palette.primary, count: 3, angle: 18, intensity: 0.55 }));

  headlineZone(o, content, palette, fonts, { x: 88, y: 88, w: 1400, maxSize: 96, headMaxH: 150, subMaxH: 52 });

  // Horizon runs the FULL width
  o.push(hline({ x: 0, y: horizonY, w: W, thickness: 3, fill: palette.primary, layerRole: 'decor' }));
  o.push(rect({ x: 0, y: horizonY - 1, w: W, h: 6, fill: palette.primary, opacity: 0.08, layerRole: 'decor' }));

  const n = Math.max(blocks.length, 1);
  const colW = W / n;
  blocks.forEach((b, i) => {
    const x = Math.round(i * colW);
    const w = Math.round((i + 1) * colW) - x;
    const hero = i === 0;
    if (hero) {
      o.push(...softGlow({ x: Math.round(x + w / 2), y: horizonY - 250, r: 310, color: palette.primary, intensity: 1 }));
    }
    horizonStat(o, b, palette, fonts, {
      x, w, horizonY,
      figSize: hero ? 248 : 156, colFactor: COL_FACTORS[i % COL_FACTORS.length], hero
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

function previewPortrait(palette) {
  const horizonY = 1200;
  const parts = [
    pvSlot(pv(1076), pv(96), pv(250), pv(250), palette.primary),
    pvBars({ x: pv(88), y: pv(120), w: pv(950), lines: 2, barH: 8, gap: 5, fill: DARK_INK }),
    pvCircle(pv(1414 * 0.35), pv(horizonY - 220), pv(340), palette.primary, { opacity: 0.08 })
  ];
  const n = 4;
  const colW = 1414 / n;
  for (let i = 0; i < n; i++) {
    const x = i * colW;
    const cx = x + colW / 2;
    const hero = i === 0;
    const colH = (hero ? 360 : 256) * [1, 0.62, 0.82, 0.5][i];
    const cw = colW * (hero ? 0.48 : 0.38);
    parts.push(pvRect(pv(cx - cw / 2), pv(horizonY - colH), pv(cw), pv(colH), palette.accent, { rx: 2, opacity: 0.14 }));
    parts.push(pvRect(
      pv(cx - (hero ? 140 : 92)), pv(horizonY - colH - (hero ? 220 : 155)),
      pv(hero ? 280 : 184), pv(hero ? 130 : 95),
      hero ? palette.accent : DARK_INK, { rx: 4 }
    ));
    parts.push(pvBars({ x: pv(x + 16), y: pv(horizonY + 32), w: pv(colW - 32), lines: 2, barH: 4, gap: 3, fill: DARK_INK_DIM, align: 'center' }));
  }
  parts.push(pvRect(0, pv(horizonY), 200, 1.5, DARK_INK));
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_BASE));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const horizonY = 920;
  const parts = [
    pvSlot(pv(1658), pv(88), pv(254), pv(254), palette.primary),
    pvBars({ x: pv(88), y: pv(100), w: pv(1400), lines: 2, barH: 8, gap: 5, fill: DARK_INK }),
    pvCircle(pv(2000 * 0.22), pv(horizonY - 200), pv(300), palette.primary, { opacity: 0.08 })
  ];
  const n = 4;
  const colW = 2000 / n;
  for (let i = 0; i < n; i++) {
    const x = i * colW;
    const cx = x + colW / 2;
    const hero = i === 0;
    const colH = (hero ? 360 : 256) * [1, 0.62, 0.82, 0.5][i];
    const cw = colW * (hero ? 0.48 : 0.38);
    parts.push(pvRect(pv(cx - cw / 2), pv(horizonY - colH), pv(cw), pv(colH), palette.accent, { rx: 2, opacity: 0.14 }));
    parts.push(pvRect(
      pv(cx - (hero ? 170 : 108)), pv(horizonY - colH - (hero ? 260 : 170)),
      pv(hero ? 340 : 216), pv(hero ? 155 : 108),
      hero ? palette.accent : DARK_INK, { rx: 4 }
    ));
    parts.push(pvBars({ x: pv(x + 16), y: pv(horizonY + 34), w: pv(colW - 32), lines: 2, barH: 4, gap: 3, fill: DARK_INK_DIM, align: 'center' }));
  }
  parts.push(pvRect(0, pv(horizonY), PV_LAND_W, 1.5, DARK_INK));
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_BASE));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'stats-horizon',
  name: 'Data horizon',
  style: 'stats',
  description: 'A data-horizon wall: a hairline horizon runs across the poster while each figure stands above it on an accent column that rises like a bar chart, caption beneath. The lead figure is enlarged and lit with a soft glow. Figures spread along a mid-canvas horizon in portrait; the horizon runs the full width with the hero enlarged in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'stats', min: 4, max: 5, fields: ['figure', 'caption'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
