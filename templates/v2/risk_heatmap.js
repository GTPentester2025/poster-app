// v2 template — risk-heatmap (style: tabular). Enterprise risk-assessment matrix:
// a 3x3 grid of risk cells color-coded from green (low) to red (critical),
// with likelihood (rows) and impact (columns) axis labels. Portrait: title top,
// matrix grid in center, CTA below. Landscape: title left, matrix right.
// 3-5 cells blocks {label, text}, 0 image slots, warm paper background.

import {
  textbox, rect, hline, vline,
  backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, dotGrid, cornerFrame,
  legibilityScrim, svgWrapO, PV_LAND_W
} from './decor.js';

const HEAT = [
  ['#1E8A4E', '#4CAF50', '#8BC34A'], // low likelihood
  ['#FFC107', '#FF9800', '#F44336'], // medium likelihood
  ['#E65100', '#D32F2F', '#B71C1C']  // high likelihood
];
const ROW_LABELS = ['Unlikely', 'Possible', 'Likely'];
const COL_LABELS = ['Minor', 'Moderate', 'Severe'];
const PAPER = '#FAF8F3';

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 128, fill: palette.dark, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 200, height: 88, maxSize: 44, minSize: 28 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((128 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: palette.dark
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 200, maxSize, minSize: 48 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark,
    lineHeight: 1.06, layerRole: 'headline', bgRef: PAPER
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.06) + 18;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 80, maxSize: 38, minSize: 20, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.35, opacity: 0.75, layerRole: 'subheadline', bgRef: PAPER
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.35) + 12;
  }
  return cursor;
}

function labelAxis(o, labels, palette, fonts, { x, y, cellSize, gap, vertical }) {
  labels.forEach((label, i) => {
    const lx = vertical ? x : x + i * (cellSize + gap);
    const ly = vertical ? y + i * (cellSize + gap) : y;
    const lw = vertical ? 72 : cellSize;
    const lh = vertical ? cellSize : 32;
    o.push(textbox({
      text: label, x: lx + (vertical ? -lw - 12 : 0), y: ly,
      w: lw, h: lh, fontSize: vertical ? 24 : 20,
      fontFamily: fonts.head, fontWeight: '700', fill: palette.dark,
      align: vertical ? 'right' : 'center', lineHeight: 1.1,
      layerRole: 'message-label', bgRef: PAPER
    }));
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', PAPER);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'clean corporate background, subtle paper texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H, strength: 0.4 }));
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: PAPER, direction: 'diagonal', intensity: 0.3 }));
  o.push(...dotGrid({ x: W - 240, y: 40, cols: 4, rows: 4, gap: 44, dotR: 3, color: palette.dark, intensity: 0.4 }));
  o.push(...cornerFrame({ x: 48, y: 48, w: W - 96, h: H - 232, color: palette.dark, arm: 64, thickness: 4, intensity: 0.5 }));

  const hCursor = headlineZone(o, content, palette, fonts, { x: 88, y: 96, w: W - 176, maxSize: 80 });

  // 3x3 risk matrix
  const blocks = content.blocks || [];
  const mx = 152;
  const my = Math.max(440, hCursor + 32);
  const cellSize = 340;
  const cellGap = 8;
  const matrixW = 3 * cellSize + 2 * cellGap;
  const matrixH = 3 * cellSize + 2 * cellGap;

  // axes labels
  labelAxis(o, ROW_LABELS, palette, fonts, { x: mx, y: my + cellSize / 2, cellSize, gap: cellGap, vertical: true });
  labelAxis(o, COL_LABELS, palette, fonts, { x: mx + cellSize / 2, y: my - 52, cellSize, gap: cellGap, vertical: false });

  // axis labels for impact (horizontal)
  o.push(textbox({
    text: 'IMPACT →', x: mx, y: my - 96, w: matrixW,
    fontSize: 20, fontFamily: fonts.head, fontWeight: '700', fill: palette.dark,
    align: 'center', lineHeight: 1, opacity: 0.6, layerRole: 'message-label', bgRef: PAPER
  }));
  // axis label for likelihood (vertical) — drawn as a single rotated concept via text
  o.push(textbox({
    text: 'LIKELIHOOD', x: mx - 152, y: my + matrixH / 2 - 14, w: 60,
    fontSize: 18, fontFamily: fonts.head, fontWeight: '700', fill: palette.dark,
    align: 'center', lineHeight: 1, opacity: 0.6, layerRole: 'message-label', bgRef: PAPER
  }));

  // draw cells
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = mx + col * (cellSize + cellGap);
      const cy = my + row * (cellSize + cellGap);
      const cellColor = HEAT[row][col];
      const blockIdx = row * 3 + col;
      const b = blocks[blockIdx % blocks.length];
      const bId = b ? b.id : `blk-${blockIdx + 1}`;

      o.push(rect({ x: cx, y: cy, w: cellSize, h: cellSize, fill: cellColor, rx: 12, layerRole: 'background', msgId: bId }));
      // subtle inner border
      o.push(rect({
        x: cx + 8, y: cy + 8, w: cellSize - 16, h: cellSize - 16,
        fill: 'transparent', stroke: 'rgba(255,255,255,0.25)', strokeWidth: 2, rx: 8,
        layerRole: 'decor'
      }));

      if (b) {
        const textW = cellSize - 48;
        const labelStr = String(b.label || '').toUpperCase();
        const lblSize = fitFontSize(labelStr, { width: textW, height: 60, maxSize: 28, minSize: 16 });
        o.push({
          ...textbox({
            text: labelStr, x: cx + 24, y: cy + 24, w: textW, fontSize: lblSize,
            fontFamily: fonts.head, fontWeight: '800', fill: '#FFFFFF',
            align: 'left', lineHeight: 1.1, charSpacing: 60,
            layerRole: 'message', msgId: b.id, bgRef: cellColor
          }),
          fieldRef: 'label'
        });

        const textH = cellSize - 100;
        const tSize = fitFontSize(b.text, { width: textW, height: textH, maxSize: 32, minSize: 16 });
        o.push({
          ...textbox({
            text: b.text, x: cx + 24, y: cy + 80, w: textW, fontSize: tSize,
            fontFamily: fonts.body, fontWeight: '600', fill: '#FFFFFF',
            lineHeight: 1.3, layerRole: 'message', msgId: b.id, bgRef: cellColor
          }),
          fieldRef: 'text'
        });
      }
    }
  }

  ctaBar(o, content.callToAction, palette, fonts, W, 1872);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', PAPER);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'clean corporate background, subtle paper texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H, strength: 0.4 }));
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: PAPER, direction: 'horizontal', intensity: 0.3 }));
  o.push(...dotGrid({ x: W - 200, y: 40, cols: 3, rows: 3, gap: 44, dotR: 3, color: palette.dark, intensity: 0.4 }));

  const leftW = 500;
  headlineZone(o, content, palette, fonts, { x: 88, y: 80, w: leftW, maxSize: 68 });

  // 3x3 risk matrix on the right
  const blocks = content.blocks || [];
  const mx = 680;
  const my = 120;
  const cellSize = 360;
  const cellGap = 6;
  const matrixW = 3 * cellSize + 2 * cellGap;
  const matrixH = 3 * cellSize + 2 * cellGap;

  labelAxis(o, ROW_LABELS, palette, fonts, { x: mx, y: my + cellSize / 2, cellSize, gap: cellGap, vertical: true });
  labelAxis(o, COL_LABELS, palette, fonts, { x: mx + cellSize / 2, y: my - 40, cellSize, gap: cellGap, vertical: false });

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = mx + col * (cellSize + cellGap);
      const cy = my + row * (cellSize + cellGap);
      const cellColor = HEAT[row][col];
      const blockIdx = row * 3 + col;
      const b = blocks[blockIdx % blocks.length];
      const bId = b ? b.id : `blk-${blockIdx + 1}`;

      o.push(rect({ x: cx, y: cy, w: cellSize, h: cellSize, fill: cellColor, rx: 12, layerRole: 'background', msgId: bId }));
      o.push(rect({
        x: cx + 6, y: cy + 6, w: cellSize - 12, h: cellSize - 12,
        fill: 'transparent', stroke: 'rgba(255,255,255,0.2)', strokeWidth: 2, rx: 8,
        layerRole: 'decor'
      }));

      if (b) {
        const textW = cellSize - 40;
        const labelStr = String(b.label || '').toUpperCase();
        const lblSize = fitFontSize(labelStr, { width: textW, height: 56, maxSize: 26, minSize: 16 });
        o.push({
          ...textbox({
            text: labelStr, x: cx + 20, y: cy + 20, w: textW, fontSize: lblSize,
            fontFamily: fonts.head, fontWeight: '800', fill: '#FFFFFF',
            align: 'left', lineHeight: 1.1, charSpacing: 50,
            layerRole: 'message', msgId: b.id, bgRef: cellColor
          }),
          fieldRef: 'label'
        });
        const tSize = fitFontSize(b.text, { width: textW, height: cellSize - 100, maxSize: 30, minSize: 16 });
        o.push({
          ...textbox({
            text: b.text, x: cx + 20, y: cy + 72, w: textW, fontSize: tSize,
            fontFamily: fonts.body, fontWeight: '600', fill: '#FFFFFF',
            lineHeight: 1.3, layerRole: 'message', msgId: b.id, bgRef: cellColor
          }),
          fieldRef: 'text'
        });
      }
    }
  }

  ctaBar(o, content.callToAction, palette, fonts, W, 1286);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvBars({ x: pv(88), y: pv(110), w: pv(1000), lines: 2, barH: 7, gap: 4, fill: palette.dark })
  ];
  const mx = 152, my = 440, cs = 340, cg = 8;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      parts.push(pvRect(pv(mx + col * (cs + cg)), pv(my + row * (cs + cg)), pv(cs), pv(cs), HEAT[row][col], { rx: 2 }));
      parts.push(pvRect(pv(mx + col * (cs + cg) + 20), pv(my + row * (cs + cg) + 20), pv(140), 3, '#FFFFFF', { rx: 1.5 }));
      parts.push(pvBars({ x: pv(mx + col * (cs + cg) + 20), y: pv(my + row * (cs + cg) + 60), w: pv(cs - 40), lines: 2, barH: 3, gap: 2, fill: '#FFFFFF' }));
    }
  }
  parts.push(pvRect(0, pv(1872), 200, pv(128), palette.dark));
  return svgWrapO(parts, PAPER, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvBars({ x: pv(88), y: pv(95), w: pv(500), lines: 2, barH: 7, gap: 4, fill: palette.dark })
  ];
  const mx = 680, my = 120, cs = 360, cg = 6;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      parts.push(pvRect(pv(mx + col * (cs + cg)), pv(my + row * (cs + cg)), pv(cs), pv(cs), HEAT[row][col], { rx: 2 }));
      parts.push(pvRect(pv(mx + col * (cs + cg) + 16), pv(my + row * (cs + cg) + 16), pv(130), 3, '#FFFFFF', { rx: 1.5 }));
      parts.push(pvBars({ x: pv(mx + col * (cs + cg) + 16), y: pv(my + row * (cs + cg) + 52), w: pv(cs - 35), lines: 2, barH: 3, gap: 2, fill: '#FFFFFF' }));
    }
  }
  parts.push(pvRect(0, pv(1286), PV_LAND_W, pv(128), palette.dark));
  return svgWrapO(parts, PAPER, 'landscape');
}

export default {
  id: 'risk-heatmap',
  name: 'Risk heatmap',
  style: 'tabular',
  description: 'Enterprise risk assessment matrix with a 3x3 color-coded grid (green to red), likelihood vs impact axis labels, and labeled cells. Warm paper background with subtle gold gradient wash. Portrait centers the matrix; landscape splits title left and matrix right.',
  contentSchema: {
    headline: { required: true, maxWords: 6 },
    subheadline: { required: false, maxWords: 12 },
    blocks: { kind: 'cells', min: 3, max: 5, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 8 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
