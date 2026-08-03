// v2 template — audit-trail (style: timeline). Enterprise audit event log
// with severity icons, date stamps, status badges, and a left timeline rail.
// Portrait: vertical rail with severity-colored event cards on the right.
// Landscape: horizontal timeline rail with status-coded cards below.
// Dark teal/charcoal palette with severity stripes. 3-5 sequence blocks.

import {
  textbox, rect, circle, chip, vline, hline,
  backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, dotGrid, scanlines, meshGlow,
  legibilityScrim, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM
} from './decor.js';

const TEAL_DARK = '#0A1E1E';
const STATUS_COLORS = ['#1E8A4E', '#F5A623', '#D32F2F', '#7B1FA2'];
const STATUSES = ['COMPLETED', 'IN REVIEW', 'FLAGGED', 'ESCALATED'];
const CATEGORIES = ['Access', 'Change', 'Alert', 'Import'];

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 132, fill: TEAL_DARK, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 3, fill: palette.primary, opacity: 0.15, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 200, height: 92, maxSize: 44, minSize: 28 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((132 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: TEAL_DARK
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 220, maxSize, minSize: 48 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    lineHeight: 1.06, layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.06) + 18;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 88, maxSize: 36, minSize: 20, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM,
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.35) + 14;
  }
  return cursor;
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark teal security backdrop, subtle scanline, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  o.push(...gradientWash({ w: W, h: H, from: palette.accent, to: TEAL_DARK, direction: 'diagonal', intensity: 0.6 }));
  o.push(...meshGlow({ spots: [
    { x: 1200, y: 300, r: 400, color: palette.primary },
    { x: 200, y: 1700, r: 320, color: palette.accent }
  ], intensity: 0.7 }));
  o.push(...scanlines({ y: 80, w: W, h: H - 240, gap: 24, color: palette.primary, thickness: 1, intensity: 0.4 }));
  o.push(...dotGrid({ x: W - 300, y: 40, cols: 5, rows: 4, gap: 44, dotR: 3, color: palette.primary, intensity: 0.5 }));

  const hCursor = headlineZone(o, content, palette, fonts, { x: 88, y: 96, w: 1000, maxSize: 88 });

  const blocks = content.blocks || [];
  const railX = 160;
  const top = Math.max(480, hCursor + 16);
  const bottom = 1820;
  const rowH = (bottom - top) / Math.max(blocks.length, 1);

  blocks.forEach((b, i) => {
    const cy = Math.round(top + i * rowH + rowH / 2);
    const cardY = Math.round(top + i * rowH + 8);
    const cardH = Math.round(rowH - 16);

    if (i < blocks.length - 1) {
      o.push(vline({ x: railX, y: cy + 24, h: top + (i + 1) * rowH + rowH / 2 - cy - 24, thickness: 2, fill: palette.primary, layerRole: 'decor', opacity: 0.14 }));
    }

    // severity node
    const sevColor = STATUS_COLORS[i % STATUS_COLORS.length];
    o.push(circle({ x: railX, y: cy, r: 20, fill: sevColor, stroke: '#FFFFFF', strokeWidth: 3, layerRole: 'decor' }));
    // date stamp
    const dates = ['2024-01-15', '2024-01-16', '2024-01-17', '2024-01-18', '2024-01-19'];
    o.push(textbox({
      text: dates[i % dates.length], x: railX - 100, y: cy - 10, w: 72,
      fontSize: 18, fontFamily: fonts.head, fontWeight: '600',
      fill: DARK_INK_DIM, align: 'right', lineHeight: 1,
      layerRole: 'decor', bgRef: DARK_BASE
    }));

    // event card
    const cardX = 220;
    const cardW = W - cardX - 80;
    o.push(rect({
      x: cardX, y: cardY, w: cardW, h: cardH, fill: DARK_PANEL, rx: 16,
      stroke: palette.primary, strokeWidth: 1, opacity: 0.06, layerRole: 'background', msgId: b.id
    }));
    o.push(rect({
      x: cardX, y: cardY, w: cardW, h: cardH, fill: 'transparent', stroke: sevColor, strokeWidth: 2, rx: 16,
      opacity: 0.12, layerRole: 'background', msgId: b.id
    }));

    // status badge
    const [pill, statTb] = chip({
      text: STATUSES[i % STATUSES.length], x: cardX + 20, y: cardY + 16, fontSize: 20,
      bg: sevColor, color: '#FFFFFF', font: fonts.head, msgId: b.id,
      square: true, maxW: cardW - 40
    });
    o.push(pill, { ...statTb, fieldRef: 'label', bgRef: sevColor });

    const textY = cardY + 16 + pill.height + 14;
    const textW = cardW - 40;
    const tSize = fitFontSize(b.text, {
      width: textW, height: Math.max(80, cardY + cardH - textY - 16), maxSize: 42, minSize: 20
    });
    o.push({
      ...textbox({
        text: b.text, x: cardX + 20, y: textY, w: textW, fontSize: tSize,
        fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
        lineHeight: 1.35, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
      }),
      fieldRef: 'text'
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1868);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark teal security backdrop, subtle scanline, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  o.push(...gradientWash({ w: W, h: H, from: palette.accent, to: TEAL_DARK, direction: 'horizontal', intensity: 0.6 }));
  o.push(...meshGlow({ spots: [
    { x: 1800, y: 200, r: 380, color: palette.primary },
    { x: 200, y: 1200, r: 300, color: palette.accent }
  ], intensity: 0.7 }));

  const hCursor = headlineZone(o, content, palette, fonts, { x: 88, y: 72, w: 1200, maxSize: 72 });

  const blocks = content.blocks || [];
  const railY = 400;
  const left = 88;
  const right = W - 88;
  o.push(hline({ x: left, y: railY, w: right - left, thickness: 2, fill: palette.primary, layerRole: 'decor', opacity: 0.14 }));

  const colW = (right - left) / Math.max(blocks.length, 1);
  const dates = ['2024-01-15', '2024-01-16', '2024-01-17', '2024-01-18', '2024-01-19'];

  blocks.forEach((b, i) => {
    const cx = Math.round(left + i * colW + colW / 2);
    const cardW = Math.round(colW - 20);
    const cardH = 760;
    const cardY = railY + 24;
    const sevColor = STATUS_COLORS[i % STATUS_COLORS.length];

    o.push(circle({ x: cx, y: railY, r: 18, fill: sevColor, stroke: '#FFFFFF', strokeWidth: 3, layerRole: 'decor' }));
    o.push(textbox({
      text: dates[i % dates.length], x: cx - 50, y: railY - 32, w: 100,
      fontSize: 16, fontFamily: fonts.head, fontWeight: '600',
      fill: DARK_INK_DIM, align: 'center', lineHeight: 1,
      layerRole: 'decor', bgRef: DARK_BASE
    }));

    const cardX = Math.round(cx - cardW / 2);
    o.push(rect({
      x: cardX, y: cardY, w: cardW, h: cardH, fill: DARK_PANEL, rx: 16,
      stroke: palette.primary, strokeWidth: 1, opacity: 0.06, layerRole: 'background', msgId: b.id
    }));
    o.push(rect({
      x: cardX, y: cardY, w: cardW, h: cardH, fill: 'transparent', stroke: sevColor, strokeWidth: 2, rx: 16,
      opacity: 0.1, layerRole: 'background', msgId: b.id
    }));

    const [pill, statTb] = chip({
      text: STATUSES[i % STATUSES.length], x: cardX + 14, y: cardY + 14, fontSize: 18,
      bg: sevColor, color: '#FFFFFF', font: fonts.head, msgId: b.id,
      square: true, maxW: cardW - 28
    });
    o.push(pill, { ...statTb, fieldRef: 'label', bgRef: sevColor });

    const textY = cardY + 14 + pill.height + 10;
    const textW = cardW - 28;
    const tSize = fitFontSize(b.text, {
      width: textW, height: Math.max(80, cardY + cardH - textY - 14), maxSize: 38, minSize: 18
    });
    o.push({
      ...textbox({
        text: b.text, x: cardX + 14, y: textY, w: textW, fontSize: tSize,
        fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
        lineHeight: 1.35, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
      }),
      fieldRef: 'text'
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1282);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvBars({ x: pv(88), y: pv(110), w: pv(1000), lines: 2, barH: 7, gap: 4, fill: DARK_INK })
  ];
  for (let i = 0; i < 4; i++) {
    const y = 480 + i * 335;
    const cy = y + 160;
    const sev = STATUS_COLORS[i % 4];
    parts.push(pvCircle(pv(160), pv(cy), 3.5, sev));
    parts.push(pvRect(pv(220), pv(y), pv(1114), pv(319), DARK_PANEL, { rx: 3, stroke: sev, opacity: 0.5 }));
    parts.push(pvRect(pv(240), pv(y + 14), pv(100), 3, sev, { rx: 1.5 }));
    parts.push(pvBars({ x: pv(240), y: pv(y + 60), w: pv(1074), lines: 2, barH: 4, gap: 3, fill: DARK_INK }));
  }
  parts.push(pvRect(0, pv(1868), 200, pv(132), TEAL_DARK));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvBars({ x: pv(88), y: pv(82), w: pv(1200), lines: 2, barH: 6, gap: 4, fill: DARK_INK }),
    pvRect(pv(88), pv(400), pv(1824), 1, palette.primary, { opacity: 0.3 })
  ];
  for (let i = 0; i < 4; i++) {
    const cx = 88 + (2000 - 176) / 4 * (i + 0.5);
    const sev = STATUS_COLORS[i % 4];
    parts.push(pvCircle(pv(cx), pv(400), 2.5, sev));
    parts.push(pvRect(pv(cx - 100), pv(432), pv(200), pv(800), DARK_PANEL, { rx: 3, stroke: sev, opacity: 0.5 }));
    parts.push(pvRect(pv(cx - 86), pv(446), pv(80), 3, sev, { rx: 1.5 }));
    parts.push(pvBars({ x: pv(cx - 86), y: pv(480), w: pv(172), lines: 3, barH: 3, gap: 2, fill: DARK_INK }));
  }
  parts.push(pvRect(0, pv(1282), PV_LAND_W, pv(132), TEAL_DARK));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'audit-trail',
  name: 'Audit trail',
  style: 'timeline',
  description: 'Enterprise audit event log with color-coded severity icons, date stamps, and status badges on a dark teal canvas with scanline texture. Portrait stacks events vertically on a left timeline rail; landscape places them along a horizontal rail with status-coded cards below. Ideal for audit and compliance tracking.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'sequence', min: 3, max: 5, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
