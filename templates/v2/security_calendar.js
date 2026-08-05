// v2 template — security-calendar (style: infographic). Monthly security
// awareness calendar: a clean 4-week grid with day cells and colored event
// badges, plus an event agenda list below the grid — each event's label chip
// and description get a full agenda row, so the block text is visible and the
// canvas fills edge to edge (SP-B layout-tightening pass). Clean white canvas
// with soft dot-grid texture. Portrait: headline, grid, agenda rows, CTA bar.
// Landscape: REAL relayout — headline + agenda left, grid right.

import {
  textbox, rect, chip, backgroundImageSlot,
  fitTextBlock, fitFontSize, estTextHeight,
  pv, pvRect, pvBars
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

// ── shared background: white + subtle gradient wash + dot-grid texture ───────
function backdrop(o, palette, W, H) {
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: CANVAS, direction: 'diagonal', intensity: 0.08 }));
  o.push(...dotGrid({
    x: 30, y: 30,
    cols: Math.ceil(W / 96), rows: Math.ceil(H / 96),
    gap: 96, dotR: 2, color: INK, intensity: 0.12
  }));
}

/** Default day numbers when content omits them: spread across the month. */
function dayFor(b, idx) {
  const n = Number(b.dayNumber);
  if (Number.isInteger(n) && n >= 1 && n <= 28) return n;
  return 3 + idx * 5; // 3, 8, 13, 18, 23, 28
}

// ── calendar grid: 4 weeks × 7 days with event badges ────────────────────────
function drawCalendarGrid(o, blocks, gridX, gridY, cellSize, fonts) {
  const cols = 7;
  const rows = 4;
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const headerH = 48;
  dayLabels.forEach((day, i) => {
    o.push(textbox({
      text: day.toUpperCase(), x: gridX + i * cellSize, y: gridY - headerH + 8,
      w: cellSize, fontSize: 18, fontFamily: fonts.head, fontWeight: '700',
      fill: INK_DIM, align: 'center', lineHeight: 1, charSpacing: 60, layerRole: 'decor'
    }));
  });

  const eventMap = {};
  blocks.forEach((b, idx) => {
    eventMap[dayFor(b, idx)] = { ...b, colorIdx: idx % EVENT_COLORS.length };
  });

  // rounded frame around the whole grid
  o.push(rect({
    x: gridX - 8, y: gridY - 8, w: cols * cellSize + 16, h: rows * cellSize + 16,
    fill: 'transparent', stroke: GRID_LINE, strokeWidth: 2, rx: 20, layerRole: 'decor'
  }));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dayNum = r * cols + c + 1;
      const x = gridX + c * cellSize;
      const y = gridY + r * cellSize;

      o.push(rect({
        x, y, w: cellSize, h: cellSize,
        fill: 'transparent', stroke: GRID_LINE, strokeWidth: 2,
        layerRole: 'decor'
      }));

      o.push(textbox({
        text: String(dayNum), x: x + 12, y: y + 10,
        w: cellSize - 24, fontSize: 22, fontFamily: fonts.head, fontWeight: '700',
        fill: INK, align: 'left', lineHeight: 1, layerRole: 'decor'
      }));

      if (eventMap[dayNum]) {
        const evt = eventMap[dayNum];
        const badgeColor = EVENT_COLORS[evt.colorIdx];
        // tinted cell wash marks the event day
        o.push(rect({ x: x + 2, y: y + 2, w: cellSize - 4, h: cellSize - 4, fill: badgeColor, opacity: 0.12, layerRole: 'decor' }));
        const badgeW = cellSize - 20;
        const badgeH = 34;
        const badgeY = y + cellSize - badgeH - 10;
        const badgeX = x + 10;
        o.push(rect({
          x: badgeX, y: badgeY, w: badgeW, h: badgeH,
          fill: badgeColor, opacity: 0.95, rx: 10, layerRole: 'decor'
        }));
        const labelSize = fitFontSize(evt.label, { width: badgeW - 16, height: badgeH - 10, maxSize: 18, minSize: 10, lineHeight: 1.05 });
        o.push({
          ...textbox({
            text: evt.label, x: badgeX + 8, y: badgeY + Math.round((badgeH - estTextHeight(evt.label, labelSize, badgeW - 16, 1.05)) / 2),
            w: badgeW - 16, fontSize: labelSize,
            fontFamily: fonts.body, fontWeight: '700',
            fill: '#FFFFFF', align: 'center', lineHeight: 1.05,
            layerRole: 'message', msgId: evt.id, bgRef: badgeColor
          }),
          fieldRef: 'label'
        });
      }
    }
  }
  return { bottom: gridY + rows * cellSize };
}

// ── agenda rows: one card row per event (chip + description) ─────────────────
function agendaRows(o, blocks, fonts, { x, y, w, h }) {
  const n = Math.max(blocks.length, 1);
  const gap = 18;
  const rowH = Math.floor((h - gap * (n - 1)) / n);
  blocks.forEach((b, idx) => {
    const rowY = y + idx * (rowH + gap);
    const color = EVENT_COLORS[idx % EVENT_COLORS.length];
    // row card
    o.push(rect({ x, y: rowY, w, h: rowH, fill: CANVAS, rx: 20, stroke: GRID_LINE, strokeWidth: 2, layerRole: 'background', msgId: b.id }));
    o.push(rect({ x, y: rowY + 12, w: 8, h: rowH - 24, fill: color, rx: 4, layerRole: 'decor' }));

    // day badge
    const day = dayFor(b, idx);
    o.push(rect({ x: x + 32, y: rowY + Math.round(rowH / 2) - 34, w: 68, h: 68, fill: color, opacity: 0.14, rx: 18, layerRole: 'decor' }));
    o.push(textbox({
      text: String(day), x: x + 32, y: rowY + Math.round(rowH / 2) - 16,
      w: 68, fontSize: 30, fontFamily: fonts.head, fontWeight: '800',
      fill: INK, align: 'center', lineHeight: 1, layerRole: 'decor'
    }));

    // label chip + description text, vertically centered as a group
    const textX = x + 128;
    const textW = w - 128 - 32;
    const labelFit = fitTextBlock(String(b.label).toUpperCase(), { width: textW, height: 40, maxSize: 26, minSize: 14, lineHeight: 1.1 });
    const bodyFit = fitTextBlock(b.text, {
      width: textW, height: Math.max(36, rowH - labelFit.height - 52), maxSize: 30, minSize: 14, lineHeight: 1.3
    });
    const groupH = labelFit.height + 10 + bodyFit.height;
    let cy = rowY + Math.round((rowH - groupH) / 2);
    o.push({
      ...textbox({
        text: String(b.label).toUpperCase(), x: textX, y: cy, w: textW, fontSize: labelFit.fontSize,
        fontFamily: fonts.head, fontWeight: '800', fill: color, charSpacing: 60,
        lineHeight: 1.1, layerRole: 'message-label', msgId: b.id, bgRef: CANVAS
      }),
      fieldRef: 'label'
    });
    cy += labelFit.height + 10;
    o.push({
      ...textbox({
        text: b.text, x: textX, y: cy, w: textW, fontSize: bodyFit.fontSize,
        fontFamily: fonts.body, fontWeight: '500', fill: INK_DIM,
        lineHeight: 1.3, layerRole: 'message', msgId: b.id, bgRef: CANVAS
      }),
      fieldRef: 'text'
    });
  });
}

// ── CTA bar (pinned bottom) ──────────────────────────────────────────────────
function ctaBar(o, text, fonts, { W, y, h }) {
  o.push(rect({ x: 0, y, w: W, h, fill: INK, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: ACCENT_PRIMARY, layerRole: 'decor' }));
  const cta = fitTextBlock(text, { width: W - 200, height: h - 40, maxSize: 42, minSize: 22, lineHeight: 1.2 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((h - cta.height) / 2), w: W - 200,
    fontSize: cta.fontSize, fontFamily: fonts.head, fontWeight: '800',
    fill: '#FFFFFF', align: 'center', lineHeight: 1.2, layerRole: 'cta', bgRef: INK
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

  const margin = 70;
  const innerW = W - margin * 2;

  const head = fitTextBlock(content.headline, { width: innerW, height: 230, maxSize: 96, minSize: 40, lineHeight: 1.06 });
  o.push(textbox({
    text: content.headline, x: margin, y: 78, w: innerW, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: INK, align: 'left',
    lineHeight: 1.06, layerRole: 'headline', bgRef: CANVAS
  }));
  let cursor = 78 + head.height + 18;

  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, { width: innerW, height: 80, maxSize: 32, minSize: 16, lineHeight: 1.25 });
    o.push(textbox({
      text: content.subheadline, x: margin, y: cursor, w: innerW, fontSize: sub.fontSize,
      fontFamily: fonts.body, fontWeight: '500', fill: INK_DIM,
      lineHeight: 1.25, layerRole: 'subheadline', bgRef: CANVAS
    }));
    cursor += sub.height + 16;
  }
  o.push(rect({ x: margin, y: cursor + 8, w: 160, h: 8, fill: ACCENT_PRIMARY, rx: 4, layerRole: 'decor' }));

  const blocks = content.blocks || [];
  const gridTop = cursor + 90; // room for the weekday header row
  const cellSize = Math.floor(innerW / 7);
  const grid = drawCalendarGrid(o, blocks, margin, gridTop, cellSize, fonts);

  // agenda rows fill the band between the grid and the CTA bar
  const ctaH = 150;
  const agendaTop = grid.bottom + 48;
  const agendaBottom = H - ctaH - 40;
  agendaRows(o, blocks, fonts, { x: margin, y: agendaTop, w: innerW, h: agendaBottom - agendaTop });

  ctaBar(o, content.callToAction, fonts, { W, y: H - ctaH, h: ctaH });
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
  const leftW = 760;
  const head = fitTextBlock(content.headline, { width: leftW, height: 220, maxSize: 84, minSize: 36, lineHeight: 1.06 });
  o.push(textbox({
    text: content.headline, x: margin, y: 76, w: leftW, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: INK, align: 'left',
    lineHeight: 1.06, layerRole: 'headline', bgRef: CANVAS
  }));
  let cursor = 76 + head.height + 16;

  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, { width: leftW, height: 80, maxSize: 28, minSize: 14, lineHeight: 1.25 });
    o.push(textbox({
      text: content.subheadline, x: margin, y: cursor, w: leftW, fontSize: sub.fontSize,
      fontFamily: fonts.body, fontWeight: '500', fill: INK_DIM,
      lineHeight: 1.25, layerRole: 'subheadline', bgRef: CANVAS
    }));
    cursor += sub.height + 14;
  }
  o.push(rect({ x: margin, y: cursor + 6, w: 140, h: 8, fill: ACCENT_PRIMARY, rx: 4, layerRole: 'decor' }));

  const blocks = content.blocks || [];

  // grid right
  const gridX = margin + leftW + 60;
  const gridAvailW = W - margin - gridX;
  const ctaH = 130;
  const gridTop = 140;
  const cellSize = Math.min(Math.floor(gridAvailW / 7), Math.floor((H - ctaH - gridTop - 60) / 4));
  drawCalendarGrid(o, blocks, gridX, gridTop, cellSize, fonts);

  // agenda rows fill the left column beneath the headline
  const agendaTop = cursor + 48;
  const agendaBottom = H - ctaH - 36;
  agendaRows(o, blocks, fonts, { x: margin, y: agendaTop, w: leftW, h: agendaBottom - agendaTop });

  ctaBar(o, content.callToAction, fonts, { W, y: H - ctaH, h: ctaH });
  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────
function previewPortrait(palette) {
  const margin = 70; const innerW = 1414 - margin * 2;
  const parts = [
    pvRect(0, 0, 200, 3, palette.primary),
    pvRect(pv(margin), pv(78), pv(innerW * 0.85), pv(90), INK, { rx: 4 }),
    pvRect(pv(margin), pv(196), pv(innerW * 0.6), pv(22), INK_DIM, { rx: 3 }),
    pvRect(pv(margin), pv(258), pv(160), pv(8), ACCENT_PRIMARY, { rx: 1 })
  ];
  const gridTop = 340; const cell = Math.floor(innerW / 7);
  for (let r = 0; r <= 4; r++) parts.push(pvRect(pv(margin), pv(gridTop + r * cell), pv(cell * 7), pv(2), GRID_LINE));
  for (let c = 0; c <= 7; c++) parts.push(pvRect(pv(margin + c * cell), pv(gridTop), pv(2), pv(4 * cell), GRID_LINE));
  [{ d: 3 }, { d: 8 }, { d: 13 }, { d: 18 }].forEach(({ d }, i) => {
    const idx = d - 1, r = Math.floor(idx / 7), c = idx % 7;
    parts.push(pvRect(pv(margin + c * cell + 10), pv(gridTop + r * cell + cell - 44), pv(cell - 20), pv(34), EVENT_COLORS[i], { rx: 3 }));
  });
  const agendaTop = gridTop + 4 * cell + 48;
  const rowH = Math.floor((1810 - agendaTop - 54) / 4);
  for (let i = 0; i < 4; i++) {
    const y = agendaTop + i * (rowH + 18);
    parts.push(pvRect(pv(margin), pv(y), pv(innerW), pv(rowH), CANVAS, { rx: 3, stroke: GRID_LINE }));
    parts.push(pvRect(pv(margin), pv(y + 12), pv(8), pv(rowH - 24), EVENT_COLORS[i], { rx: 1 }));
    parts.push(pvBars({ x: pv(margin + 128), y: pv(y + 24), w: pv(innerW - 200), lines: 2, barH: 5, gap: 4, fill: INK_DIM }));
  }
  parts.push(pvRect(0, pv(1850), 200, pv(150), INK));
  parts.push(pvBars({ x: pv(300), y: pv(1908), w: pv(814), lines: 1, barH: 6, gap: 4, fill: '#FFFFFF', align: 'center' }));
  return svgWrapO(parts, CANVAS, 'portrait');
}

function previewLandscape(palette) {
  const margin = 80; const leftW = 760;
  const parts = [
    pvRect(0, 0, 283, 3, palette.primary),
    pvRect(pv(margin), pv(76), pv(leftW * 0.9), pv(70), INK, { rx: 4 }),
    pvRect(pv(margin), pv(170), pv(leftW * 0.7), pv(18), INK_DIM, { rx: 3 }),
    pvRect(pv(margin), pv(226), pv(140), pv(8), ACCENT_PRIMARY, { rx: 1 })
  ];
  const gridX = margin + leftW + 60; const gridTop = 140;
  const cell = Math.floor((2000 - margin - gridX) / 7);
  for (let r = 0; r <= 4; r++) parts.push(pvRect(pv(gridX), pv(gridTop + r * cell), pv(cell * 7), pv(2), GRID_LINE));
  for (let c = 0; c <= 7; c++) parts.push(pvRect(pv(gridX + c * cell), pv(gridTop), pv(2), pv(4 * cell), GRID_LINE));
  [3, 8, 13, 18].forEach((d, i) => {
    const idx = d - 1, r = Math.floor(idx / 7), c = idx % 7;
    parts.push(pvRect(pv(gridX + c * cell + 8), pv(gridTop + r * cell + cell - 34), pv(cell - 16), pv(26), EVENT_COLORS[i], { rx: 2 }));
  });
  const agendaTop = 300; const rowH = Math.floor((1248 - agendaTop - 54) / 4);
  for (let i = 0; i < 4; i++) {
    const y = agendaTop + i * (rowH + 18);
    parts.push(pvRect(pv(margin), pv(y), pv(leftW), pv(rowH), CANVAS, { rx: 3, stroke: GRID_LINE }));
    parts.push(pvRect(pv(margin), pv(y + 10), pv(8), pv(rowH - 20), EVENT_COLORS[i], { rx: 1 }));
    parts.push(pvBars({ x: pv(margin + 120), y: pv(y + 20), w: pv(leftW - 180), lines: 2, barH: 4, gap: 3, fill: INK_DIM }));
  }
  parts.push(pvRect(0, pv(1284), 283, pv(130), INK));
  parts.push(pvBars({ x: pv(500), y: pv(1330), w: pv(1000), lines: 1, barH: 6, gap: 4, fill: '#FFFFFF', align: 'center' }));
  return svgWrapO(parts, CANVAS, 'landscape');
}

export default {
  id: 'security-calendar',
  name: 'Security calendar',
  style: 'infographic',
  description: 'A monthly security awareness calendar displayed as a clean 4-week grid with day cells. Security awareness events are highlighted as colored badges placed in their corresponding days, and an agenda list pairs each event chip with its description. Clean white canvas with subtle dot-grid texture. Portrait stacks headline, calendar, and agenda; landscape places the agenda left and the calendar right.',
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
