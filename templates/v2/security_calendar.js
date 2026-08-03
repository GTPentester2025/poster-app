// v2 template — security-calendar (style: infographic). Monthly security awareness
// calendar displayed as a clean 4-week grid with day cells. Awareness events are
// highlighted as colored badges placed in their corresponding day cells. Each event
// carries a label + descriptive text. Clean white canvas with soft dot-grid texture
// and subtle color accents.
// Portrait: headline top, calendar grid below, CTA at bottom.
// Landscape: headline top-left, larger calendar grid, CTA bottom-right.

import {
  textbox, rect, circle, backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, dotGrid, legibilityScrim, svgWrapO
} from './decor.js';

// Color palette: clean white + soft blue accents
const CANVAS = '#FFFFFF';           // clean white ground
const INK = '#0F172A';              // dark navy primary text
const INK_DIM = '#64748B';          // slate secondary text
const GRID_LINE = '#E2E8F0';        // light gray grid lines
const ACCENT_PRIMARY = '#3B82F6';   // bright blue
const EVENT_COLORS = ['#F97316', '#EC4899', '#8B5CF6', '#06B6D4', '#10B981', '#EAB308']; // warm palette

// ── shared background: white + subtle gradient wash + dot-grid texture ───────────
function backdrop(o, palette, W, H) {
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: CANVAS, direction: 'diagonal', intensity: 0.08 }));
  o.push(...dotGrid({
    x: 30, y: 30,
    cols: Math.ceil(W / 96), rows: Math.ceil(H / 96),
    gap: 96, dotR: 2, color: INK, intensity: 0.12
  }));
}

// ── calendar grid: draw 4 weeks × 7 days with optional event badges ─────────────
function drawCalendarGrid(o, blocks, gridX, gridY, cellSize, fonts) {
  const cols = 7;
  const rows = 4;
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Header row: day abbreviations
  const headerH = 40;
  dayLabels.forEach((day, i) => {
    o.push(textbox({
      text: day, x: gridX + i * cellSize, y: gridY - headerH + 8,
      w: cellSize, fontSize: 16, fontFamily: fonts.head, fontWeight: '700',
      fill: INK, align: 'center', lineHeight: 1, layerRole: 'decor'
    }));
  });

  // Day cells: 4 rows × 7 cols
  const eventMap = {};
  blocks.forEach((b, idx) => {
    eventMap[b.dayNumber] = { ...b, colorIdx: idx % EVENT_COLORS.length };
  });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dayNum = r * cols + c + 1;
      const x = gridX + c * cellSize;
      const y = gridY + r * cellSize;

      // Cell background
      o.push(rect({
        x, y, w: cellSize, h: cellSize,
        fill: 'transparent', stroke: GRID_LINE, strokeWidth: 2,
        layerRole: 'decor'
      }));

      // Day number (top-left corner)
      o.push(textbox({
        text: String(dayNum), x: x + 8, y: y + 6,
        w: cellSize - 16, fontSize: 18, fontFamily: fonts.head, fontWeight: '700',
        fill: INK, align: 'left', lineHeight: 1
      }));

      // Event badge (if present for this day)
      if (eventMap[dayNum]) {
        const evt = eventMap[dayNum];
        const badgeW = cellSize - 16;
        const badgeH = 22;
        const badgeY = y + cellSize - badgeH - 6;
        const badgeX = x + 8;
        const badgeColor = EVENT_COLORS[evt.colorIdx];

        o.push(rect({
          x: badgeX, y: badgeY, w: badgeW, h: badgeH,
          fill: badgeColor, opacity: 0.9, rx: 4, layerRole: 'decor'
        }));

        const labelSize = Math.max(10, Math.round(badgeH * 0.5));
        o.push({
          ...textbox({
            text: evt.label, x: badgeX + 6, y: badgeY + 2,
            w: badgeW - 12, fontSize: labelSize,
            fontFamily: fonts.body, fontWeight: '600',
            fill: '#FFFFFF', align: 'left', lineHeight: 1,
            layerRole: 'message', msgId: evt.id, bgRef: badgeColor
          }),
          fieldRef: 'label'
        });
      }
    }
  }
}

// ── CTA zone ───────────────────────────────────────────────────────────────────
function ctaZone(o, text, fonts, { x, y, w }) {
  o.push(rect({ x, y: y - 12, w, h: 3, fill: ACCENT_PRIMARY, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: w, height: 80, maxSize: 42, minSize: 24 });
  o.push(textbox({
    text, x, y, w, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: INK, align: 'left', layerRole: 'cta', bgRef: CANVAS
  }));
}

// ── portrait ──────────────────────────────────────────────────────────────────
function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', CANVAS);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'soft light abstract texture, pale paper grain, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H, color: CANVAS, strength: 0.9 }));
  backdrop(o, palette, W, H);

  const margin = 60;
  const innerW = W - margin * 2;

  const headSize = fitFontSize(content.headline, { width: innerW, height: 200, maxSize: 80, minSize: 36 });
  const headH = estTextHeight(content.headline, headSize, innerW, 1.08);
  o.push(textbox({
    text: content.headline, x: margin, y: 80, w: innerW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: INK, align: 'left',
    lineHeight: 1.08, layerRole: 'headline', bgRef: CANVAS
  }));
  let cursor = 80 + headH + 24;

  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: innerW, height: 60, maxSize: 28, minSize: 14 });
    const subH = estTextHeight(content.subheadline, subSize, innerW, 1.2);
    o.push(textbox({
      text: content.subheadline, x: margin, y: cursor, w: innerW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: INK_DIM,
      lineHeight: 1.2, layerRole: 'subheadline', bgRef: CANVAS
    }));
    cursor += subH + 20;
  }

  const ctaY = H - 110;
  const gridTop = cursor + 20;
  const gridBottom = ctaY - 40;
  const gridH = gridBottom - gridTop;
  // cell size is capped by BOTH the vertical budget (4 rows) and the
  // horizontal budget (7 columns inside innerW) so the grid never runs
  // off the right edge of the canvas
  const cellSize = Math.min(Math.floor(gridH / 4), Math.floor(innerW / 7));

  const blocks = content.blocks || [];
  drawCalendarGrid(o, blocks, margin, gridTop, cellSize, fonts);

  ctaZone(o, content.callToAction, fonts, { x: margin, y: ctaY, w: innerW });
  return canvas;
}

// ── landscape ─────────────────────────────────────────────────────────────────
function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', CANVAS);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'soft light abstract texture, pale paper grain, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H, color: CANVAS, strength: 0.9 }));
  backdrop(o, palette, W, H);

  const margin = 80;
  const innerW = W - margin * 2;

  const headW = Math.round(innerW * 0.55);
  const headSize = fitFontSize(content.headline, { width: headW, height: 160, maxSize: 72, minSize: 32 });
  const headH = estTextHeight(content.headline, headSize, headW, 1.08);
  o.push(textbox({
    text: content.headline, x: margin, y: 80, w: headW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: INK, align: 'left',
    lineHeight: 1.08, layerRole: 'headline', bgRef: CANVAS
  }));
  let topCursor = 80 + headH + 16;

  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: headW, height: 60, maxSize: 24, minSize: 14 });
    const subH = estTextHeight(content.subheadline, subSize, headW, 1.2);
    o.push(textbox({
      text: content.subheadline, x: margin, y: topCursor, w: headW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: INK_DIM,
      lineHeight: 1.2, layerRole: 'subheadline', bgRef: CANVAS
    }));
    topCursor += subH + 16;
  }

  const ctaY = H - 100;
  const gridTop = 80;
  const gridBottom = ctaY - 20;
  const gridH = gridBottom - gridTop;
  const gridX = margin + headW + 40;
  // cap by the vertical budget AND the horizontal room right of the headline
  const gridAvailW = W - margin - gridX;
  const cellSize = Math.min(Math.floor(gridH / 4), Math.floor(gridAvailW / 7));
  const blocks = content.blocks || [];
  drawCalendarGrid(o, blocks, gridX, gridTop, cellSize, fonts);

  ctaZone(o, content.callToAction, fonts, { x: margin, y: ctaY, w: headW });
  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────
function previewPortrait() {
  const W = 1414; const H = 2000; const margin = 60; const innerW = W - margin * 2;
  const parts = [];
  parts.push(pvRect(pv(margin), pv(80), pv(innerW * 0.8), pv(100), INK, { rx: 4 }));
  parts.push(pvRect(pv(margin), pv(210), pv(innerW * 0.6), pv(20), INK_DIM, { rx: 3 }));

  const gridTop = 320;
  const cellSize = 68;
  const cols = 7;
  const rows = 4;
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Grid lines
  for (let r = 0; r <= rows; r++) {
    parts.push(pvRect(pv(margin), pv(gridTop + r * cellSize), pv(innerW), pv(2), GRID_LINE));
  }
  for (let c = 0; c <= cols; c++) {
    parts.push(pvRect(pv(margin + c * (innerW / cols)), pv(gridTop), pv(2), pv(rows * cellSize), GRID_LINE));
  }

  // Sample badges
  const badges = [
    { day: 5, color: EVENT_COLORS[0] },
    { day: 12, color: EVENT_COLORS[1] },
    { day: 19, color: EVENT_COLORS[2] },
    { day: 26, color: EVENT_COLORS[3] }
  ];
  badges.forEach(b => {
    const cellIdx = b.day - 1;
    const r = Math.floor(cellIdx / 7);
    const c = cellIdx % 7;
    const badgeX = margin + c * (innerW / 7) + 8;
    const badgeY = gridTop + r * cellSize + cellSize - 28;
    parts.push(pvRect(pv(badgeX), pv(badgeY), pv((innerW / 7) - 16), pv(20), b.color, { rx: 3 }));
  });

  parts.push(pvRect(pv(margin), pv(H - 120), pv(innerW * 0.6), pv(28), ACCENT_PRIMARY, { rx: 3 }));
  return svgWrapO(parts, CANVAS, 'portrait');
}

function previewLandscape() {
  const W = 2000; const H = 1414; const margin = 80; const innerW = W - margin * 2;
  const parts = [];
  const headW = Math.round(innerW * 0.55);
  parts.push(pvRect(pv(margin), pv(80), pv(headW * 0.9), pv(80), INK, { rx: 4 }));
  parts.push(pvRect(pv(margin), pv(180), pv(headW * 0.7), pv(18), INK_DIM, { rx: 3 }));

  const gridTop = 80;
  const cellSize = 76;
  const cols = 7;
  const rows = 4;
  const gridX = margin + headW + 40;
  const gridW = innerW - headW - 40;

  // Grid lines
  for (let r = 0; r <= rows; r++) {
    parts.push(pvRect(pv(gridX), pv(gridTop + r * cellSize), pv(gridW), pv(2), GRID_LINE));
  }
  for (let c = 0; c <= cols; c++) {
    parts.push(pvRect(pv(gridX + c * (gridW / cols)), pv(gridTop), pv(2), pv(rows * cellSize), GRID_LINE));
  }

  // Sample badges
  const badges = [
    { day: 3, color: EVENT_COLORS[0] },
    { day: 10, color: EVENT_COLORS[1] },
    { day: 17, color: EVENT_COLORS[2] },
    { day: 24, color: EVENT_COLORS[3] }
  ];
  badges.forEach(b => {
    const cellIdx = b.day - 1;
    const r = Math.floor(cellIdx / 7);
    const c = cellIdx % 7;
    const badgeX = gridX + c * (gridW / 7) + 8;
    const badgeY = gridTop + r * cellSize + cellSize - 30;
    parts.push(pvRect(pv(badgeX), pv(badgeY), pv((gridW / 7) - 16), pv(22), b.color, { rx: 3 }));
  });

  parts.push(pvRect(pv(margin), pv(H - 110), pv(headW * 0.7), pv(26), ACCENT_PRIMARY, { rx: 3 }));
  return svgWrapO(parts, CANVAS, 'landscape');
}

export default {
  id: 'security-calendar',
  name: 'Security calendar',
  style: 'infographic',
  description: 'A monthly security awareness calendar displayed as a clean 4-week grid with day cells. Security awareness events are highlighted as colored badges placed in their corresponding days, each carrying a label and descriptive text. Clean white canvas with subtle dot-grid texture. Portrait arranges the calendar below the headline; landscape places the calendar to the right of the headline for maximum readability.',
  contentSchema: {
    headline: { required: true, maxWords: 5 },
    subheadline: { required: false, maxWords: 10 },
    blocks: { kind: 'cells', min: 4, max: 6, fields: ['label', 'text'], extraFields: { dayNumber: 'number' } },
    callToAction: { required: true, maxWords: 8 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
