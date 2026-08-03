// v2 template — annual-report (style: stats). A clean corporate annual-metrics
// report: an off-white ground under a solid slate header bar, then a set of big
// stat figures — each paired with a small colour-coded bar chart and a trend
// arrow (green ▲ up / red ▼ down). Reads like a boardroom one-pager.
// Portrait: header bar top, stats as full-width rows (figure + arrow + chart),
// slate CTA band bottom.
// Landscape: REAL relayout — stats become side-by-side columns (figure over its
// own bar chart), hairline dividers between, slate CTA band bottom.

import {
  textbox, rect,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO
} from './decor.js';

// Self-contained corporate palette (unique to this template).
const CANVAS = '#FAFAFA';       // clean off-white ground
const HEADER = '#334155';       // slate header + CTA bar
const INK = '#0F172A';          // near-black primary text on white
const INK_DIM = '#475569';      // slate secondary text
const HAIR = '#E2E8F0';         // hairline dividers / baselines
const BAR = ['#2563EB', '#7C3AED', '#0891B2', '#DB2777']; // per-stat accents
const UP = '#16A34A';           // green — positive trend
const DOWN = '#DC2626';         // red — negative trend

// ── small colour-coded bar chart under a stat ────────────────────────────────
function barChart(o, { x, y, w, h, color, seed }) {
  const pattern = [0.45, 0.62, 0.5, 0.8, 1.0];
  const count = pattern.length;
  const gap = Math.max(4, Math.round(w * 0.06));
  const bw = Math.max(4, Math.floor((w - gap * (count - 1)) / count));
  o.push(rect({ x, y: y + h, w: bw * count + gap * (count - 1), h: 3, fill: HAIR, layerRole: 'decor' }));
  for (let i = 0; i < count; i++) {
    // rotate the pattern by seed so adjacent stats read differently
    const f = pattern[(i + seed) % count];
    const bh = Math.max(6, Math.round(h * f));
    o.push(rect({
      x: x + i * (bw + gap), y: y + h - bh, w: bw, h: bh,
      fill: color, rx: 3, opacity: 0.9, layerRole: 'decor'
    }));
  }
}

// ── trend arrow — even index trends up (green), odd trends down (red) ─────────
function trendArrow(o, idx, x, y, size, fonts) {
  const up = idx % 2 === 0;
  o.push(textbox({
    text: up ? '▲' : '▼', x, y, w: Math.round(size * 1.6), fontSize: size,
    fontFamily: fonts.head, fontWeight: '700', fill: up ? UP : DOWN,
    align: 'left', lineHeight: 1, layerRole: 'decor'
  }));
}

// ── portrait stat row: figure + arrow left, label/text below, chart right ────
function statRow(o, b, idx, fonts, { x, y, w, budget }) {
  const color = BAR[idx % BAR.length];
  const figW = Math.round(w * 0.5);

  const figSize = fitFontSize(b.figure, { width: figW - 70, height: Math.round(budget * 0.5), maxSize: 150, minSize: 40 });
  const figH = estTextHeight(b.figure, figSize, figW - 70, 1.0);
  o.push({
    ...textbox({
      text: b.figure, x, y, w: figW - 70, fontSize: figSize, fontFamily: fonts.head,
      fontWeight: '900', fill: color, lineHeight: 1.0, layerRole: 'message',
      msgId: b.id, bgRef: CANVAS
    }),
    fieldRef: 'figure'
  });
  trendArrow(o, idx, x + figW - 60, y + 8, Math.min(56, Math.round(figSize * 0.4)), fonts);

  const labelTop = y + figH + 14;
  const labelSize = fitFontSize(b.label, { width: figW, height: 48, maxSize: 40, minSize: 16 });
  const labelH = estTextHeight(b.label, labelSize, figW, 1.1);
  o.push({
    ...textbox({
      text: b.label, x, y: labelTop, w: figW, fontSize: labelSize, fontFamily: fonts.head,
      fontWeight: '800', fill: INK, lineHeight: 1.1, layerRole: 'message',
      msgId: b.id, bgRef: CANVAS
    }),
    fieldRef: 'label'
  });

  const textTop = labelTop + labelH + 8;
  const textBudget = Math.max(y + budget - textTop, 14);
  const textSize = fitFontSize(b.text, { width: figW, height: textBudget, maxSize: 28, minSize: 14 });
  o.push({
    ...textbox({
      text: b.text, x, y: textTop, w: figW, fontSize: textSize, fontFamily: fonts.body,
      fontWeight: '500', fill: INK_DIM, lineHeight: 1.25, layerRole: 'message',
      msgId: b.id, bgRef: CANVAS
    }),
    fieldRef: 'text'
  });

  const chartX = x + figW + 40;
  const chartW = w - figW - 40;
  const chartH = Math.min(Math.round(budget * 0.6), 220);
  const chartY = y + Math.round((budget - chartH) / 2);
  barChart(o, { x: chartX, y: chartY, w: chartW, h: chartH, color, seed: idx });
}

// ── landscape stat column: figure + arrow, chart, label, text (stacked) ──────
function statColumn(o, b, idx, fonts, { x, y, w, budget }) {
  const color = BAR[idx % BAR.length];

  const figSize = fitFontSize(b.figure, { width: w, height: Math.round(budget * 0.32), maxSize: 130, minSize: 36 });
  const figH = estTextHeight(b.figure, figSize, w, 1.0);
  o.push({
    ...textbox({
      text: b.figure, x, y, w, fontSize: figSize, fontFamily: fonts.head,
      fontWeight: '900', fill: color, align: 'left', lineHeight: 1.0,
      layerRole: 'message', msgId: b.id, bgRef: CANVAS
    }),
    fieldRef: 'figure'
  });
  trendArrow(o, idx, x + w - 64, y + 6, Math.min(52, Math.round(figSize * 0.4)), fonts);

  let cur = y + figH + 20;
  const chartH = Math.min(Math.round(budget * 0.28), 180);
  barChart(o, { x, y: cur, w, h: chartH, color, seed: idx });
  cur += chartH + 24;

  const labelSize = fitFontSize(b.label, { width: w, height: 46, maxSize: 34, minSize: 16 });
  const labelH = estTextHeight(b.label, labelSize, w, 1.1);
  o.push({
    ...textbox({
      text: b.label, x, y: cur, w, fontSize: labelSize, fontFamily: fonts.head,
      fontWeight: '800', fill: INK, lineHeight: 1.1, layerRole: 'message',
      msgId: b.id, bgRef: CANVAS
    }),
    fieldRef: 'label'
  });
  cur += labelH + 8;

  const textBudget = Math.max(y + budget - cur, 14);
  const textSize = fitFontSize(b.text, { width: w, height: textBudget, maxSize: 26, minSize: 13 });
  o.push({
    ...textbox({
      text: b.text, x, y: cur, w, fontSize: textSize, fontFamily: fonts.body,
      fontWeight: '500', fill: INK_DIM, lineHeight: 1.25, layerRole: 'message',
      msgId: b.id, bgRef: CANVAS
    }),
    fieldRef: 'text'
  });
}

// ── slate CTA band at the foot of the canvas ─────────────────────────────────
function ctaBand(o, text, fonts, W, H, ctaY, innerW, margin) {
  o.push(rect({ x: 0, y: ctaY, w: W, h: H - ctaY, fill: HEADER, layerRole: 'background' }));
  const size = fitFontSize(text, { width: innerW, height: 90, maxSize: 44, minSize: 24 });
  const ty = ctaY + Math.round((H - ctaY - estTextHeight(text, size, innerW, 1.1)) / 2);
  o.push(textbox({
    text, x: margin, y: ty, w: innerW, fontSize: size, fontFamily: fonts.head,
    fontWeight: '800', fill: '#FFFFFF', align: 'center', layerRole: 'cta', bgRef: HEADER
  }));
}

// ── portrait ──────────────────────────────────────────────────────────────────
function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', CANVAS);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  const margin = 80;
  const innerW = W - margin * 2;
  const headerH = 300;

  o.push(rect({ x: 0, y: 0, w: W, h: headerH, fill: HEADER, layerRole: 'background' }));
  o.push(rect({ x: 0, y: headerH, w: W, h: 8, fill: BAR[0], layerRole: 'decor' }));

  const headSize = fitFontSize(content.headline, { width: innerW, height: 150, maxSize: 82, minSize: 36 });
  o.push(textbox({
    text: content.headline, x: margin, y: 70, w: innerW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: '#FFFFFF', lineHeight: 1.03,
    layerRole: 'headline', bgRef: HEADER
  }));
  if (content.subheadline) {
    const subY = 70 + estTextHeight(content.headline, headSize, innerW, 1.03) + 14;
    const subSize = fitFontSize(content.subheadline, { width: innerW, height: 70, maxSize: 34, minSize: 16 });
    o.push(textbox({
      text: content.subheadline, x: margin, y: subY, w: innerW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: '#CBD5E1',
      layerRole: 'subheadline', bgRef: HEADER
    }));
  }

  const blocks = content.blocks || [];
  const ctaY = H - 150;
  const areaTop = headerH + 60;
  const areaBottom = ctaY - 40;
  const areaH = areaBottom - areaTop;
  const n = Math.max(blocks.length, 1);
  const rowGap = 28;
  const rowBudget = Math.max(180, Math.floor((areaH - rowGap * (n - 1)) / n));

  let ry = areaTop;
  blocks.forEach((b, i) => {
    statRow(o, b, i, fonts, { x: margin, y: ry, w: innerW, budget: rowBudget });
    if (i < blocks.length - 1) {
      o.push(rect({ x: margin, y: ry + rowBudget + Math.round(rowGap / 2) - 1, w: innerW, h: 2, fill: HAIR, layerRole: 'decor' }));
    }
    ry += rowBudget + rowGap;
  });

  ctaBand(o, content.callToAction, fonts, W, H, ctaY, innerW, margin);
  return canvas;
}

// ── landscape ─────────────────────────────────────────────────────────────────
function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', CANVAS);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  const margin = 80;
  const innerW = W - margin * 2;
  const headerH = 250;

  o.push(rect({ x: 0, y: 0, w: W, h: headerH, fill: HEADER, layerRole: 'background' }));
  o.push(rect({ x: 0, y: headerH, w: W, h: 8, fill: BAR[0], layerRole: 'decor' }));

  const headSize = fitFontSize(content.headline, { width: innerW, height: 130, maxSize: 78, minSize: 34 });
  o.push(textbox({
    text: content.headline, x: margin, y: 60, w: innerW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: '#FFFFFF', lineHeight: 1.03,
    layerRole: 'headline', bgRef: HEADER
  }));
  if (content.subheadline) {
    const subY = 60 + estTextHeight(content.headline, headSize, innerW, 1.03) + 12;
    const subSize = fitFontSize(content.subheadline, { width: innerW, height: 60, maxSize: 32, minSize: 16 });
    o.push(textbox({
      text: content.subheadline, x: margin, y: subY, w: innerW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: '#CBD5E1',
      layerRole: 'subheadline', bgRef: HEADER
    }));
  }

  const blocks = content.blocks || [];
  const ctaY = H - 130;
  const colTop = headerH + 70;
  const colBottom = ctaY - 40;
  const colBudget = colBottom - colTop;
  const n = Math.max(blocks.length, 1);
  const colGap = 48;
  const colW = Math.floor((innerW - colGap * (n - 1)) / n);

  let cx = margin;
  blocks.forEach((b, i) => {
    if (i > 0) {
      o.push(rect({ x: cx - Math.round(colGap / 2) - 1, y: colTop, w: 2, h: colBudget, fill: HAIR, layerRole: 'decor' }));
    }
    statColumn(o, b, i, fonts, { x: cx, y: colTop, w: colW, budget: colBudget });
    cx += colW + colGap;
  });

  ctaBand(o, content.callToAction, fonts, W, H, ctaY, innerW, margin);
  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────
function previewPortrait() {
  const W = 1414; const H = 2000; const margin = 80; const innerW = W - margin * 2;
  const parts = [];
  parts.push(pvRect(0, 0, pv(W), pv(300), HEADER));
  parts.push(pvRect(0, pv(300), pv(W), pv(8), BAR[0]));
  parts.push(pvRect(pv(margin), pv(90), pv(innerW * 0.7), pv(70), '#FFFFFF', { rx: 4 }));
  parts.push(pvRect(pv(margin), pv(200), pv(innerW * 0.5), pv(28), '#CBD5E1', { rx: 3 }));
  let ry = 380; const rb = 341;
  for (let i = 0; i < 4; i++) {
    const color = BAR[i % BAR.length];
    parts.push(pvRect(pv(margin), pv(ry), pv(240), pv(90), color, { rx: 6 }));
    parts.push(pvRect(pv(margin), pv(ry + 110), pv(innerW * 0.4), pv(22), INK, { rx: 3 }));
    parts.push(pvBars({ x: pv(margin), y: pv(ry + 150), w: pv(innerW * 0.45), lines: 2, barH: 5, gap: 4, fill: INK_DIM }));
    for (let k = 0; k < 5; k++) {
      parts.push(pvRect(pv(margin + innerW * 0.6 + k * 70), pv(ry + 140 - k * 14), pv(44), pv(k * 14 + 40), color, { rx: 3 }));
    }
    ry += rb;
  }
  parts.push(pvRect(0, pv(H - 150), pv(W), pv(150), HEADER));
  parts.push(pvRect(pv(innerW * 0.3), pv(H - 95), pv(innerW * 0.4), pv(30), '#FFFFFF', { rx: 3 }));
  return svgWrapO(parts, CANVAS, 'portrait');
}

function previewLandscape() {
  const W = 2000; const H = 1414; const margin = 80; const innerW = W - margin * 2;
  const parts = [];
  parts.push(pvRect(0, 0, pv(W), pv(250), HEADER));
  parts.push(pvRect(0, pv(250), pv(W), pv(8), BAR[0]));
  parts.push(pvRect(pv(margin), pv(80), pv(innerW * 0.6), pv(60), '#FFFFFF', { rx: 4 }));
  parts.push(pvRect(pv(margin), pv(170), pv(innerW * 0.45), pv(24), '#CBD5E1', { rx: 3 }));
  const n = 3; const colGap = 48; const colW = Math.floor((innerW - colGap * (n - 1)) / n);
  let cx = margin; const colTop = 380;
  for (let i = 0; i < n; i++) {
    const color = BAR[i % BAR.length];
    parts.push(pvRect(pv(cx), pv(colTop), pv(200), pv(90), color, { rx: 6 }));
    for (let k = 0; k < 5; k++) {
      parts.push(pvRect(pv(cx + k * (colW / 6)), pv(colTop + 300 - (k * 20 + 40)), pv(colW / 8), pv(k * 20 + 40), color, { rx: 3 }));
    }
    parts.push(pvRect(pv(cx), pv(colTop + 360), pv(colW * 0.7), pv(22), INK, { rx: 3 }));
    parts.push(pvBars({ x: pv(cx), y: pv(colTop + 400), w: pv(colW * 0.9), lines: 2, barH: 5, gap: 4, fill: INK_DIM }));
    cx += colW + colGap;
  }
  parts.push(pvRect(0, pv(H - 130), pv(W), pv(130), HEADER));
  parts.push(pvRect(pv(innerW * 0.3), pv(H - 85), pv(innerW * 0.4), pv(28), '#FFFFFF', { rx: 3 }));
  return svgWrapO(parts, CANVAS, 'landscape');
}

export default {
  id: 'annual-report',
  name: 'Annual report',
  style: 'stats',
  description: 'A clean corporate annual-metrics report: an off-white ground under a solid slate header bar, then big stat figures each paired with a colour-coded bar chart and a trend arrow (green up / red down). Portrait stacks the stats as full-width rows with the figure left and its chart right; landscape splits them into side-by-side columns with the figure over its own chart, hairline dividers between, and a slate call-to-action band at the foot.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'stats', min: 3, max: 4, fields: ['label', 'figure', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 0,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
