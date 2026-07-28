// v2 template — neon-grid (style: stats). A neon "data stage": a receding
// perspective grid glows across the lower half like a tron floor, and each
// stat's giant FIGURE stands ON the grid — the hero (first) figure enlarged
// with a soft-glow bloom behind it, the rest spread along a neon baseline. A
// thin neon hline separates the figures from their captions beneath. One honest
// image slot sits in a corner as a vignette; meshGlow (primary + accent spots)
// gives the dark canvas atmosphere. Portrait: figures in a row across the grid
// floor mid-canvas. Landscape is a REAL relayout — the grid floor runs the full
// 2000px width, the hero figure enlarged on the left, the remaining figures
// spread to the right. 4–5 stats blocks {figure, caption}; figures are short
// strings sized by EXPLICIT fontSize (120–240px), never word-wrapped. Dark
// template: near-black base, light ink, brand color reserved for figures + glow.
//
// 2026 redesign: richer neon-stage aesthetic — scanlines added over the grid
// floor for CRT texture; hero figure gets a stronger bloom; caption zone
// elevated with a subtle DARK_PANEL tray; hairline neon baseline thickened to
// 5px; image slot positioned with generous 96px top padding; typography tightened
// with lineHeight 1.02 on figures and 1.4 on captions.

import {
  textbox, rect, imageSlot, hline, backgroundImageSlot,
  fitFontSize, estTextHeight, estTextWidth,
  pv, pvRect, pvCircle, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, perspectiveGrid, meshGlow, softGlow, scanlines,
  svgWrapO, legibilityScrim,
  PV_LAND_W, DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM
} from './decor.js';

// Explicitly size a short figure string so it never word-wraps and always fits
// its column: start from the desired hero/normal size, step down until the
// estimated glyph run fits the column width.
function figureSize(text, colW, desired) {
  let size = desired;
  const maxW = colW * 0.92;
  while (size > 16 && estTextWidth(String(text), size) > maxW) size -= 4;
  return size;
}

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_PANEL, layerRole: 'background', opacity: 1 }));
  // primary glow rule on top edge of the CTA bar
  o.push(rect({ x: 0, y, w: W, h: 5, fill: palette.primary, opacity: 0.18, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 200, height: 96, maxSize: 46, minSize: 30 });
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
  if (content.subheadline) {
    const headH = estTextHeight(content.headline, headSize, w, 1.04);
    const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 40, minSize: 28, lineHeight: 1.4 });
    o.push(textbox({
      text: content.subheadline, x, y: y + headH + 20,
      w, fontSize: subSize, fontFamily: fonts.body, fontWeight: '600',
      fill: DARK_INK_DIM, align, lineHeight: 1.4,
      layerRole: 'subheadline', bgRef: DARK_BASE
    }));
  }
}

/**
 * One stat standing on the grid floor: the giant FIGURE (fieldRef 'figure')
 * sits with its baseline on baselineY, a caption (fieldRef 'caption') below
 * in an elevated DARK_PANEL tray. Figures are explicitly sized short strings.
 */
function gridStat(o, b, palette, fonts, { x, w, baselineY, figSize, hero = false }) {
  const cx = x + w / 2;

  // hero bloom: stronger and deeper behind the lead figure
  if (hero) {
    o.push(...softGlow({
      x: Math.round(cx), y: Math.round(baselineY - figSize * 0.52),
      r: Math.round(figSize * 1.7), color: palette.primary, intensity: 1
    }));
    // secondary accent glow for extra depth on the hero
    o.push(...softGlow({
      x: Math.round(cx), y: Math.round(baselineY - figSize * 0.3),
      r: Math.round(figSize * 0.9), color: palette.accent, intensity: 0.6
    }));
  }

  // giant figure on the grid (explicit size — figures are short strings)
  const figH = Math.round(figSize * 1.10);
  o.push({
    ...textbox({
      text: b.figure, x, y: Math.round(baselineY - figH), w, fontSize: figSize,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.primary, align: 'center',
      lineHeight: 1.02, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'figure'
  });

  // caption in a subtle DARK_PANEL tray below the neon baseline
  const capPad = 16;
  const capSize = fitFontSize(b.caption, { width: w - capPad * 2, height: 230, maxSize: hero ? 46 : 42, minSize: 20 });
  const capTrayH = Math.round(estTextHeight(b.caption, capSize, w - capPad * 2, 1.4)) + 32;
  o.push(rect({
    x: x + capPad, y: baselineY + 24, w: w - capPad * 2, h: capTrayH,
    fill: DARK_PANEL, rx: 12, opacity: 0.10, layerRole: 'decor'
  }));
  o.push({
    ...textbox({
      text: b.caption, x: x + capPad, y: baselineY + 40, w: w - capPad * 2,
      fontSize: capSize, fontFamily: fonts.body, fontWeight: '600',
      fill: DARK_INK, align: 'center', lineHeight: 1.4,
      layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'caption'
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of a neon perspective data-grid horizon, deep near-black, glowing cyan and gold lines, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  const blocks = content.blocks || [];

  // mesh glow: primary upper-left, accent lower-right
  o.push(...meshGlow({
    spots: [
      { x: 240, y: 320, r: 440, color: palette.primary },
      { x: W - 220, y: 1480, r: 500, color: palette.accent }
    ],
    intensity: 0.9
  }));

  // receding neon grid floor across the lower half
  const horizonY = 1100;
  const floorY = 1780;
  o.push(...perspectiveGrid({ w: W, horizonY, floorY, color: palette.primary, rows: 8, cols: 9, intensity: 0.9 }));
  // CRT scanlines over the floor zone — restrained decor texture
  o.push(...scanlines({ x: 0, y: horizonY, w: W, h: floorY - horizonY, gap: 18, color: palette.primary, thickness: 2, intensity: 0.5 }));

  // corner image vignette (top-right, with breathing room from edge)
  o.push(imageSlot({
    slotId: 'slot-1', x: 1080, y: 96, w: 248, h: 248,
    styleHint: 'abstract neon data-grid horizon vignette, flat vector, no text', stroke: palette.primary
  }));

  headlineZone(o, content, palette, fonts, { x: 88, y: 120, w: 960, maxSize: 108 });

  // neon baseline across the full width
  const baselineY = 1288;
  o.push(hline({ x: 0, y: baselineY, w: W, thickness: 5, fill: palette.primary, layerRole: 'decor' }));

  const n = Math.max(blocks.length, 1);
  const colW = W / n;
  blocks.forEach((b, i) => {
    const x = Math.round(i * colW);
    const w = Math.round((i + 1) * colW) - x;
    const hero = i === 0;
    const figSize = figureSize(b.figure, w, hero ? 208 : 144);
    gridStat(o, b, palette, fonts, { x, w, baselineY, figSize, hero });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, H - 144);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of a neon perspective data-grid horizon, deep near-black, glowing cyan and gold lines, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  const blocks = content.blocks || [];

  // mesh glow repositioned for the wide frame
  o.push(...meshGlow({
    spots: [
      { x: 380, y: 760, r: 520, color: palette.primary },
      { x: W - 340, y: 300, r: 480, color: palette.accent }
    ],
    intensity: 0.9
  }));

  // grid floor runs the FULL 2000px width
  const horizonY = 768;
  const floorY = 1258;
  o.push(...perspectiveGrid({ w: W, horizonY, floorY, color: palette.primary, rows: 8, cols: 11, intensity: 0.9 }));
  o.push(...scanlines({ x: 0, y: horizonY, w: W, h: floorY - horizonY, gap: 16, color: palette.primary, thickness: 2, intensity: 0.5 }));

  // corner vignette (top-right)
  o.push(imageSlot({
    slotId: 'slot-1', x: 1680, y: 96, w: 248, h: 248,
    styleHint: 'abstract neon data-grid horizon vignette, flat vector, no text', stroke: palette.primary
  }));

  headlineZone(o, content, palette, fonts, { x: 88, y: 96, w: 1400, maxSize: 100 });

  // neon baseline across the full width
  const baselineY = 932;
  o.push(hline({ x: 0, y: baselineY, w: W, thickness: 5, fill: palette.primary, layerRole: 'decor' }));

  const n = Math.max(blocks.length, 1);
  // hero wider left column; remaining stats split the right span
  const heroW = Math.round(W * (n <= 4 ? 0.34 : 0.30));
  const restN = Math.max(n - 1, 1);
  const restSpan = W - heroW;
  const restColW = restSpan / restN;

  blocks.forEach((b, i) => {
    let x; let w;
    if (i === 0) {
      x = 0; w = heroW;
    } else {
      x = Math.round(heroW + (i - 1) * restColW);
      w = Math.round(heroW + i * restColW) - x;
    }
    const hero = i === 0;
    const figSize = figureSize(b.figure, w, hero ? 248 : 156);
    gridStat(o, b, palette, fonts, { x, w, baselineY, figSize, hero });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, H - 144);
  return canvas;
}

// ── previews ─────────────────────────────────────────────────────────────────

function pvGrid(parts, palette, { horizonY, floorY, w, cols }) {
  const rows = 5;
  for (let i = 1; i <= rows; i++) {
    const t = i / rows;
    const y = horizonY + (floorY - horizonY) * (t * t);
    parts.push(pvRect(0, pv(y), pv(w), 1, palette.primary, { opacity: 0.16 }));
  }
  const vx = w / 2;
  for (let c = 0; c <= cols; c++) {
    const nearX = (w / cols) * c;
    parts.push(`<line x1="${pv(vx)}" y1="${pv(horizonY)}" x2="${pv(nearX)}" y2="${pv(floorY)}" stroke="${palette.primary}" stroke-width="0.6" opacity="0.16"/>`);
  }
}

function previewPortrait(palette) {
  const horizonY = 1100;
  const floorY = 1780;
  const baselineY = 1288;
  const parts = [
    pvCircle(pv(240), pv(320), pv(440), palette.primary, { opacity: 0.1 }),
    pvCircle(pv(1194), pv(1480), pv(500), palette.accent, { opacity: 0.1 })
  ];
  pvGrid(parts, palette, { horizonY, floorY, w: 1414, cols: 9 });
  parts.push(pvSlot(pv(1080), pv(96), pv(248), pv(248), palette.primary));
  parts.push(pvBars({ x: pv(88), y: pv(120), w: pv(960), lines: 2, barH: 8, gap: 5, fill: DARK_INK }));

  const n = 4;
  const colW = 1414 / n;
  parts.push(pvCircle(pv(colW / 2), pv(baselineY - 112), pv(300), palette.primary, { opacity: 0.1 }));
  for (let i = 0; i < n; i++) {
    const x = i * colW;
    const cx = x + colW / 2;
    const hero = i === 0;
    const fw = hero ? 156 : 112;
    const fh = hero ? 148 : 100;
    parts.push(pvRect(pv(cx - fw / 2), pv(baselineY - fh), pv(fw), pv(fh), palette.primary, { rx: 4 }));
    parts.push(pvBars({ x: pv(x + 24), y: pv(baselineY + 40), w: pv(colW - 48), lines: 2, barH: 4, gap: 3, fill: DARK_INK, align: 'center' }));
  }
  parts.push(pvRect(0, pv(baselineY), 200, 2, palette.primary));
  parts.push(pvRect(0, pv(2000 - 144), 200, pv(144), DARK_PANEL));
  parts.push(pvRect(0, pv(2000 - 144), 200, 2, palette.primary, { opacity: 0.18 }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const horizonY = 768;
  const floorY = 1258;
  const baselineY = 932;
  const W = 2000;
  const parts = [
    pvCircle(pv(380), pv(760), pv(520), palette.primary, { opacity: 0.1 }),
    pvCircle(pv(1660), pv(300), pv(480), palette.accent, { opacity: 0.1 })
  ];
  pvGrid(parts, palette, { horizonY, floorY, w: W, cols: 11 });
  parts.push(pvSlot(pv(1680), pv(96), pv(248), pv(248), palette.primary));
  parts.push(pvBars({ x: pv(88), y: pv(96), w: pv(1400), lines: 2, barH: 8, gap: 5, fill: DARK_INK }));

  const n = 4;
  const heroW = Math.round(W * 0.34);
  const restColW = (W - heroW) / (n - 1);
  for (let i = 0; i < n; i++) {
    const hero = i === 0;
    const x = hero ? 0 : heroW + (i - 1) * restColW;
    const w = hero ? heroW : restColW;
    const cx = x + w / 2;
    const fw = hero ? 208 : 126;
    const fh = hero ? 178 : 108;
    if (hero) parts.push(pvCircle(pv(cx), pv(baselineY - 92), pv(340), palette.primary, { opacity: 0.1 }));
    parts.push(pvRect(pv(cx - fw / 2), pv(baselineY - fh), pv(fw), pv(fh), palette.primary, { rx: 4 }));
    parts.push(pvBars({ x: pv(x + 24), y: pv(baselineY + 40), w: pv(w - 48), lines: 2, barH: 4, gap: 3, fill: DARK_INK, align: 'center' }));
  }
  parts.push(pvRect(0, pv(baselineY), PV_LAND_W, 2, palette.primary));
  parts.push(pvRect(0, pv(1414 - 144), PV_LAND_W, pv(144), DARK_PANEL));
  parts.push(pvRect(0, pv(1414 - 144), PV_LAND_W, 2, palette.primary, { opacity: 0.18 }));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'neon-grid',
  name: 'Neon data grid',
  style: 'stats',
  description: 'A neon data stage: a receding perspective grid glows across the lower half like a tron floor while each giant figure stands on it, the hero figure enlarged and lit with a soft-glow bloom, captions beneath a thin neon baseline. Figures spread in a row across a mid-canvas grid floor in portrait; the grid runs the full width with the hero enlarged on the left and the rest spread right in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'stats', min: 4, max: 5, fields: ['figure', 'caption'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
