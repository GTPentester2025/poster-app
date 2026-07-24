// v2 template — stats-gauge (style: stats). Dark-theme gauge board: every
// stat sits inside a ring of concentric circle strokes (a dial read at a
// glance), caption beneath the ring. Portrait: headline on top, gauges in a
// two-column grid below. Landscape: headline column on the left, a 2x2 ring
// grid on the right. 3–4 stats blocks {figure, caption}, no image slot,
// decor = signal arcs + dot grid.

import {
  textbox, rect, circle, hline,
  fitFontSize, estTextHeight, pickTextColor,
  pv, pvRect, pvCircle, pvBars,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, signalArcs, dotGrid, meshGlow,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM,
  svgWrapO, PV_LAND_W,
  legibilityScrim,
} from './decor.js';

function ctaBar(o, text, palette, fonts, W, y) {
  // Thin primary accent rule marks the CTA band's top edge
  o.push(hline({ x: 0, y: y - 3, w: W, thickness: 3, fill: palette.primary, layerRole: 'decor' }));
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_BASE, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 180, height: 96, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text, x: 90, y: y + Math.round((144 - estTextHeight(text, size, W - 180)) / 2),
    w: W - 180, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_BASE
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 400, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    lineHeight: 1.06, layerRole: 'headline', bgRef: DARK_BASE
  }));
  if (content.subheadline) {
    const subY = y + Math.round(estTextHeight(content.headline, headSize, w, 1.06)) + 24;
    const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 40, minSize: 28, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: subY, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
  }
}

/**
 * One gauge cell: concentric ring strokes + figure (fieldRef 'figure')
 * centered in the dial, caption (fieldRef 'caption') below.
 * Elevated on a DARK_PANEL card with a 1px accent perimeter stroke.
 */
function gaugeCell(o, b, palette, fonts, { cx, cellTop, cellX, cellW, cellH, ringR }) {
  const cy = cellTop + ringR + 48;

  // Card panel behind each gauge — dark elevated surface
  o.push(rect({
    x: cellX + 16, y: cellTop + 12, w: cellW - 32, h: cellH - 24,
    fill: DARK_PANEL, rx: 22, opacity: 0.08, layerRole: 'decor'
  }));
  // 1px accent perimeter
  o.push(rect({
    x: cellX + 16, y: cellTop + 12, w: cellW - 32, h: cellH - 24,
    fill: 'transparent', stroke: palette.primary, strokeWidth: 1,
    rx: 22, opacity: 0.10, layerRole: 'decor'
  }));

  // The dial: outer bold ring (>=16 — the batch-c ring contract) + mid
  // hairline track + ghost fill disc
  o.push(circle({
    x: cx, y: cy, r: ringR, fill: 'transparent',
    stroke: palette.primary, strokeWidth: 16, layerRole: 'decor'
  }));
  o.push(circle({
    x: cx, y: cy, r: ringR - 28, fill: 'transparent',
    stroke: palette.primary, strokeWidth: 3, opacity: 0.14, layerRole: 'decor'
  }));
  o.push(circle({
    x: cx, y: cy, r: ringR - 50, fill: palette.accent,
    opacity: 0.06, layerRole: 'decor'
  }));

  // Figure inside the dial
  const figW = Math.round(ringR * 1.5);
  const figSize = fitFontSize(b.figure, { width: figW, height: Math.round(ringR * 1.1), maxSize: 120, minSize: 44 });
  const figH = Math.round(estTextHeight(b.figure, figSize, figW, 1.04));
  o.push({
    ...textbox({
      text: b.figure, x: Math.round(cx - figW / 2), y: Math.round(cy - figH / 2), w: figW,
      fontSize: figSize, fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
      align: 'center', lineHeight: 1.04, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'figure'
  });

  // Caption below the ring
  const capSpace = cellH - (cy - cellTop) - ringR - 36;
  const capSize = fitFontSize(b.caption, { width: cellW - 64, height: Math.max(80, capSpace), maxSize: 40, minSize: 20 });
  o.push({
    ...textbox({
      text: b.caption, x: cellX + 32, y: cy + ringR + 28, w: cellW - 64,
      fontSize: capSize, fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
      align: 'center', layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'caption'
  });
}

/** Lay blocks into a 2-column grid; an odd last block is centered. */
function gaugeGrid(o, blocks, palette, fonts, { gridX, gridTop, gridW, gridH }) {
  const rows = Math.max(Math.ceil(blocks.length / 2), 1);
  const cellW = Math.round(gridW / 2);
  const cellH = Math.round(gridH / rows);
  const ringR = Math.min(200, Math.round(cellH / 2) - 110);
  blocks.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const lastAlone = i === blocks.length - 1 && blocks.length % 2 === 1;
    const cx = lastAlone
      ? Math.round(gridX + gridW / 2)
      : Math.round(gridX + cellW * col + cellW / 2);
    const cellX = Math.round(cx - cellW / 2);
    gaugeCell(o, b, palette, fonts, {
      cx, cellTop: gridTop + row * cellH, cellX, cellW, cellH, ringR
    });
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // Mesh glow: top-right corner bloom + bottom-left counterpoint
  o.push(...meshGlow({
    spots: [
      { x: W - 80, y: 80, r: 500, color: palette.primary },
      { x: 120, y: 1900, r: 380, color: palette.accent }
    ],
    intensity: 0.85
  }));
  o.push(...signalArcs({ x: W, y: 60, r: 480, rings: 4, color: palette.primary, strokeWidth: 10, intensity: 0.8 }));
  o.push(...dotGrid({ x: 88, y: 380, cols: 8, rows: 2, gap: 48, dotR: 4, color: palette.primary, intensity: 0.7 }));

  headlineZone(o, content, palette, fonts, { x: 88, y: 100, w: 1238, maxSize: 112 });

  gaugeGrid(o, content.blocks || [], palette, fonts, {
    gridX: 88, gridTop: 560, gridW: 1238, gridH: 1240
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

  o.push(...meshGlow({
    spots: [
      { x: 120, y: 1350, r: 460, color: palette.accent },
      { x: W - 100, y: 100, r: 400, color: palette.primary }
    ],
    intensity: 0.85
  }));
  o.push(...signalArcs({ x: 60, y: 1354, r: 440, rings: 4, color: palette.primary, strokeWidth: 10, intensity: 0.8 }));
  o.push(...dotGrid({ x: 120, y: 840, cols: 5, rows: 4, gap: 48, dotR: 4, color: palette.primary, intensity: 0.7 }));

  // Thin vertical divider between headline column and gauge grid
  o.push(rect({ x: 699, y: 80, w: 2, h: 1160, fill: palette.primary, opacity: 0.10, layerRole: 'decor' }));

  // Headline column left
  headlineZone(o, content, palette, fonts, { x: 88, y: 200, w: 560, maxSize: 96 });

  // 2×2 ring grid right
  gaugeGrid(o, content.blocks || [], palette, fonts, {
    gridX: 720, gridTop: 160, gridW: 1212, gridH: 1080
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvBars({ x: pv(88), y: pv(110), w: pv(1238), lines: 2, barH: 8, gap: 5, fill: DARK_INK })
  ];
  for (let i = 0; i < 4; i++) {
    const cx = 88 + 619 * (i % 2) + 310;
    const cy = 560 + Math.floor(i / 2) * 620 + 250;
    parts.push(pvRect(pv(cx - 310 + 16), pv(560 + Math.floor(i / 2) * 620 + 12), pv(619 - 32), pv(620 - 24), DARK_PANEL, { rx: 4, opacity: 0.08 }));
    parts.push(pvCircle(pv(cx), pv(cy), pv(190), 'none', { stroke: palette.primary, strokeWidth: 2 }));
    parts.push(pvCircle(pv(cx), pv(cy), pv(140), palette.accent, { opacity: 0.06 }));
    parts.push(pvRect(pv(cx - 100), pv(cy - 36), pv(200), pv(72), DARK_INK, { rx: 4, opacity: 0.9 }));
    parts.push(pvBars({ x: pv(cx - 200), y: pv(cy + 220), w: pv(400), lines: 1, barH: 4, gap: 3, fill: DARK_INK_DIM, align: 'center' }));
  }
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_BASE));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvBars({ x: pv(88), y: pv(230), w: pv(560), lines: 3, barH: 8, gap: 5, fill: DARK_INK }),
    pvRect(pv(699), pv(80), pv(2), pv(1160), palette.primary, { opacity: 0.1 })
  ];
  for (let i = 0; i < 4; i++) {
    const cx = 720 + 606 * (i % 2) + 303;
    const cy = 160 + Math.floor(i / 2) * 540 + 230;
    parts.push(pvCircle(pv(cx), pv(cy), pv(160), 'none', { stroke: palette.primary, strokeWidth: 2 }));
    parts.push(pvCircle(pv(cx), pv(cy), pv(115), palette.accent, { opacity: 0.06 }));
    parts.push(pvRect(pv(cx - 85), pv(cy - 32), pv(170), pv(64), DARK_INK, { rx: 4, opacity: 0.9 }));
    parts.push(pvBars({ x: pv(cx - 180), y: pv(cy + 186), w: pv(360), lines: 1, barH: 4, gap: 3, fill: DARK_INK_DIM, align: 'center' }));
  }
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_BASE));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'stats-gauge',
  name: 'Gauge board',
  style: 'stats',
  description: 'Dark control-room dashboard: each figure sits inside a concentric gauge ring with its caption beneath. Two-column dial grid under the headline in portrait; headline column beside a 2x2 ring grid in landscape.',
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
