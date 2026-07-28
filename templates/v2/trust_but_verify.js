// v2 template — trust-but-verify (style: infographic). A faithful port of the
// AB InBev "Trust, But Verify" insider-threat poster: near-black canvas, gold
// branding. A header kicker + gold hairline, a two-tone headline, a subheadline
// + supporting body line, a hero image to the right, a gold rule, a centered
// two-tone statement, then a 3-column × 2-row grid of icon cells (icon + gold
// label + description), and a gold report bar at the foot. Portrait stacks the
// header/statement then the 3×2 grid; landscape keeps the headline column left
// and the icon grid on the right.
//
// Source → port: "Security & Compliance Awareness" kicker → decor textbox;
// "Trust, But Verify" headline → headlineZone; "Insider Threat Manipulation" +
// body → subheadline; access-vestibule hero image → imageSlot; "ATTACKERS DON'T
// BREAK IN. THEY BLEND IN." → statement; 6 icon cells {label, text} with icons
// → iconCell grid + per-block imageSlots; gold footer → ctaBar.

import {
  textbox, rect, circle, imageSlot, hline,
  fitFontSize, estTextHeight, backgroundImageSlot,
  pv, pvRect, pvBars, pvCircle
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, dotGrid, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, legibilityScrim
} from './decor.js';

function ctaBar(o, text, palette, fonts, W, y, h = 152) {
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 200, height: h - 48, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((h - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: DARK_BASE, align: 'center', layerRole: 'cta', bgRef: palette.primary
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 300, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, lineHeight: 1.02,
    layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.02) + 22;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 160, maxSize: 42, minSize: 30, lineHeight: 1.3 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.head, fontWeight: '800', fill: palette.primary, lineHeight: 1.3,
      layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.3) + 16;
  }
  return cursor;
}

// centered two-tone statement (two lines)
function statement(o, text, palette, fonts, x, y, w) {
  const t = String(text).toUpperCase();
  const size = fitFontSize(t, { width: w, height: 200, maxSize: 60, minSize: 34, lineHeight: 1.14 });
  o.push(textbox({
    text: t, x, y, w, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_INK, align: 'center', lineHeight: 1.14, layerRole: 'decor', bgRef: DARK_BASE
  }));
  return y + estTextHeight(t, size, w, 1.14) + 16;
}

function iconCell(o, b, palette, fonts, { x, y, w, h }) {
  const iconR = Math.min(56, Math.round(w * 0.2));
  const cx = x + w / 2;
  o.push(circle({ x: cx, y: y + iconR, r: iconR, fill: DARK_PANEL, stroke: palette.primary, strokeWidth: 4, layerRole: 'background' }));
  o.push(imageSlot({
    slotId: `slot-${b.id}`, x: Math.round(cx - iconR * 0.62), y: Math.round(y + iconR - iconR * 0.62),
    w: Math.round(iconR * 1.24), h: Math.round(iconR * 1.24),
    styleHint: `flat gold line icon representing "${b.label}" insider-threat control, no text`,
    stroke: palette.primary, rx: 8, blockId: b.id
  }));

  let cy = y + iconR * 2 + 16;
  const labSize = fitFontSize(b.label, { width: w, height: 80, maxSize: 34, minSize: 22, lineHeight: 1.1 });
  o.push({
    ...textbox({
      text: String(b.label).toUpperCase(), x, y: cy, w, fontSize: labSize,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.primary, align: 'center', lineHeight: 1.1,
      layerRole: 'message-label', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'label'
  });
  cy += estTextHeight(b.label, labSize, w, 1.1) + 12;

  const descH = Math.max(40, h - (cy - y) - 10);
  const descSize = fitFontSize(b.text, { width: w, height: descH, maxSize: 42, minSize: 22, lineHeight: 1.24 });
  o.push({
    ...textbox({
      text: b.text, x, y: cy, w, fontSize: descSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK, align: 'center', lineHeight: 1.24,
      layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'text'
  });
}

// icon grid: `cols` columns, wrapping rows
function iconGrid(o, blocks, palette, fonts, { x, y, w, h, cols }) {
  const gap = 24;
  const n = Math.max(blocks.length, 1);
  const rows = Math.ceil(n / cols);
  const cellW = Math.round((w - gap * (cols - 1)) / cols);
  const cellH = Math.round((h - gap * (rows - 1)) / rows);
  blocks.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    iconCell(o, b, palette, fonts, {
      x: x + col * (cellW + gap), y: y + row * (cellH + gap), w: cellW, h: cellH
    });
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark secure brewery facility corridor with turnstiles, deep near-black, gold rim light, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({ spots: [
    { x: 1160, y: 340, r: 420, color: palette.primary },
    { x: 240, y: 1520, r: 380, color: palette.accent }
  ], intensity: 0.7 }));
  o.push(...dotGrid({ x: 96, y: 900, cols: 6, rows: 4, gap: 52, dotR: 4, color: palette.primary, intensity: 0.6 }));

  o.push(textbox({
    text: 'Security & Compliance Awareness', x: W - 620, y: 96, w: 524,
    fontSize: 30, fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
    align: 'right', layerRole: 'decor', bgRef: DARK_BASE
  }));
  o.push(hline({ x: 96, y: 168, w: W - 192, thickness: 4, fill: palette.primary, layerRole: 'decor' }));

  headlineZone(o, content, palette, fonts, { x: 96, y: 200, w: W - 192, maxSize: 132 });

  o.push(hline({ x: 96, y: 700, w: W - 192, thickness: 4, fill: palette.primary, layerRole: 'decor' }));

  const afterStmt = statement(o, content.statement || 'Attackers don’t break in. They blend in.', palette, fonts, 96, 740, W - 192);

  iconGrid(o, content.blocks || [], palette, fonts, { x: 96, y: afterStmt + 24, w: W - 192, h: 1780 - (afterStmt + 24), cols: 3 });

  ctaBar(o, content.callToAction, palette, fonts, W, 1848);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark secure brewery facility corridor with turnstiles, deep near-black, gold rim light, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({ spots: [
    { x: 340, y: 320, r: 420, color: palette.primary },
    { x: 1720, y: 1120, r: 400, color: palette.accent }
  ], intensity: 0.7 }));
  o.push(...dotGrid({ x: 96, y: 980, cols: 5, rows: 3, gap: 50, dotR: 4, color: palette.primary, intensity: 0.6 }));

  const colW = 780;
  o.push(textbox({
    text: 'Security & Compliance Awareness', x: 96, y: 96, w: colW,
    fontSize: 30, fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
    align: 'left', layerRole: 'decor', bgRef: DARK_BASE
  }));
  o.push(hline({ x: 96, y: 152, w: colW, thickness: 4, fill: palette.primary, layerRole: 'decor' }));
  const headCursor = headlineZone(o, content, palette, fonts, { x: 96, y: 184, w: colW, maxSize: 116 });
  statement(o, content.statement || 'Attackers don’t break in. They blend in.', palette, fonts, 96, Math.max(headCursor + 60, 720), colW);

  const rightX = 96 + colW + 48;
  const rightW = W - rightX - 96;
  iconGrid(o, content.blocks || [], palette, fonts, { x: rightX, y: 130, w: rightW, h: 1134, cols: 3 });

  ctaBar(o, content.callToAction, palette, fonts, W, 1290, 124);
  return canvas;
}

// ── previews ────────────────────────────────────────────────────────────────

function iconGridPreview(parts, x, y, w, h, cols, rows, palette) {
  const gap = 24;
  const cellW = (w - gap * (cols - 1)) / cols;
  const cellH = (h - gap * (rows - 1)) / rows;
  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = x + col * (cellW + gap) + cellW / 2;
    const cy = y + row * (cellH + gap);
    const r = Math.min(56, cellW * 0.2);
    parts.push(pvCircle(pv(cx), pv(cy + r), pv(r), DARK_PANEL, { stroke: palette.primary }));
    parts.push(pvRect(pv(x + col * (cellW + gap) + cellW * 0.2), pv(cy + r * 2 + 16), pv(cellW * 0.6), 6, palette.primary, { rx: 2 }));
    parts.push(pvBars({ x: pv(x + col * (cellW + gap)), y: pv(cy + r * 2 + 40), w: pv(cellW), lines: 2, barH: 4, gap: 3, fill: DARK_INK, align: 'center' }));
  }
}

function previewPortrait(palette) {
  const W = 1414;
  const parts = [
    pvRect(pv(96), pv(168), pv(W - 192), 4, palette.primary),
    pvBars({ x: pv(96), y: pv(200), w: pv(W - 192), lines: 3, barH: 12, gap: 7, fill: DARK_INK }),
    pvRect(pv(96), pv(700), pv(W - 192), 4, palette.primary),
    pvBars({ x: pv(96), y: pv(740), w: pv(W - 192), lines: 2, barH: 9, gap: 6, fill: DARK_INK, align: 'center' })
  ];
  iconGridPreview(parts, 96, 960, W - 192, 820, 3, 2, palette);
  parts.push(pvRect(0, pv(1848), 200, pv(152), palette.primary));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const colW = 780;
  const parts = [
    pvRect(pv(96), pv(152), pv(colW), 4, palette.primary),
    pvBars({ x: pv(96), y: pv(184), w: pv(colW), lines: 3, barH: 10, gap: 6, fill: DARK_INK })
  ];
  const rightX = 96 + colW + 48;
  const rightW = 2000 - rightX - 96;
  iconGridPreview(parts, rightX, 130, rightW, 1134, 3, 2, palette);
  parts.push(pvRect(0, pv(1290), PV_LAND_W, pv(124), palette.primary));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'trust-but-verify',
  name: 'Trust, But Verify',
  style: 'infographic',
  description: 'A near-black, gold-branded insider-threat poster: a two-tone headline with a supporting subheadline, a centered statement, then a three-by-two grid of icon cells (icon + gold label + description). A gold report bar anchors the foot.',
  contentSchema: {
    headline: { required: true, maxWords: 5 },
    subheadline: { required: false, maxWords: 18 },
    blocks: { kind: 'cells', min: 6, max: 6, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 6,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
