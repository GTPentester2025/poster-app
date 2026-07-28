// v2 template — lock-it-down (style: infographic). A faithful port of the AB
// InBev "Lock It Down" physical-security poster: near-black canvas, gold
// branding. A centered kicker with diamond/dash flourishes, a big headline
// paired with a lock-badge image, a centered two-tone statement, then a row of
// icon cells (each: circular icon slot + two-tone label + description), a
// statement bar with a lock badge, and a gold report bar at the foot. Portrait
// runs the icon cells as one 5-wide row; landscape keeps the headline column
// left and the icon cells as a right-hand row.
//
// Source → port: "Physical Security" centered kicker → flourish kicker;
// "LOCK IT DOWN" headline + brewery-lock badge → headlineZone + imageSlot;
// "STRONG ACCESS. STRONG BREWERY." → statement line; 5 icon columns
// {label, text} each with icon → iconCell + per-block imageSlots; "LOCK TODAY.
// PROTECT TOMORROW." → statement bar; gold footer → ctaBar.

import {
  textbox, rect, circle, imageSlot, hline, polygon,
  fitFontSize, estTextHeight, backgroundImageSlot,
  pv, pvRect, pvBars, pvCircle, pvPoly
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

// centered kicker with diamond + dash flourishes
function flourishKicker(o, text, palette, fonts, x, y, w) {
  const t = String(text).toUpperCase();
  const size = 34;
  const cy = y + 20;
  const diaR = 8;
  const dia = (dx) => polygon(
    [{ x: dx, y: cy - diaR }, { x: dx + diaR, y: cy }, { x: dx, y: cy + diaR }, { x: dx - diaR, y: cy }],
    { fill: palette.primary, layerRole: 'decor' }
  );
  o.push(dia(x + 40), dia(x + w - 40));
  o.push(hline({ x: x + 60, y: cy - 2, w: 80, thickness: 4, fill: palette.primary, layerRole: 'decor' }));
  o.push(hline({ x: x + w - 140, y: cy - 2, w: 80, thickness: 4, fill: palette.primary, layerRole: 'decor' }));
  o.push(textbox({
    text: t, x: x + 160, y: cy - Math.round(estTextHeight(t, size, w - 320) / 2),
    w: w - 320, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: DARK_INK, align: 'center', charSpacing: 40, layerRole: 'decor', bgRef: DARK_BASE
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 320, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, lineHeight: 1.0, align: 'center',
    layerRole: 'headline', bgRef: DARK_BASE
  }));
  return y + estTextHeight(content.headline, headSize, w, 1.0) + 16;
}

function statementLine(o, text, palette, fonts, x, y, w) {
  const t = String(text).toUpperCase();
  const size = fitFontSize(t, { width: w, height: 96, maxSize: 52, minSize: 30 });
  o.push(textbox({
    text: t, x, y, w, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_INK, align: 'center', layerRole: 'subheadline', bgRef: DARK_BASE
  }));
  return y + estTextHeight(t, size, w) + 16;
}

// one icon cell: circular icon slot, two-tone label, description
function iconCell(o, b, palette, fonts, { x, y, w, h }) {
  const iconR = Math.min(64, Math.round(w * 0.28));
  const cx = x + w / 2;
  o.push(circle({ x: cx, y: y + iconR, r: iconR, fill: DARK_PANEL, stroke: palette.primary, strokeWidth: 4, layerRole: 'background' }));
  o.push(imageSlot({
    slotId: `slot-${b.id}`, x: Math.round(cx - iconR * 0.62), y: Math.round(y + iconR - iconR * 0.62),
    w: Math.round(iconR * 1.24), h: Math.round(iconR * 1.24),
    styleHint: `flat gold line icon representing "${b.label}" physical security action, no text`,
    stroke: palette.primary, rx: 8, blockId: b.id
  }));

  let cy = y + iconR * 2 + 20;
  // label (two-word style) — gold, centered
  const labSize = fitFontSize(b.label, { width: w, height: 90, maxSize: 34, minSize: 22, lineHeight: 1.1 });
  o.push({
    ...textbox({
      text: String(b.label).toUpperCase(), x, y: cy, w, fontSize: labSize,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.primary, align: 'center', lineHeight: 1.1,
      layerRole: 'message-label', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'label'
  });
  cy += estTextHeight(b.label, labSize, w, 1.1) + 14;

  const descH = Math.max(40, h - (cy - y) - 10);
  const descSize = fitFontSize(b.text, { width: w, height: descH, maxSize: 42, minSize: 22, lineHeight: 1.26 });
  o.push({
    ...textbox({
      text: b.text, x, y: cy, w, fontSize: descSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK, align: 'center', lineHeight: 1.26,
      layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'text'
  });
}

// statement bar with a lock badge + rule
function lockStatementBar(o, text, palette, fonts, x, y, w, h = 132) {
  o.push(rect({ x, y, w, h, fill: DARK_PANEL, rx: 16, layerRole: 'background' }));
  const badgeR = Math.round(h * 0.36);
  const bx = x + 40 + badgeR;
  o.push(circle({ x: bx, y: y + h / 2, r: badgeR, fill: palette.primary, layerRole: 'decor', opacity: 0.2 }));
  o.push(circle({ x: bx, y: y + h / 2, r: badgeR, fill: 'transparent', stroke: palette.primary, strokeWidth: 4, layerRole: 'decor', opacity: 0.2 }));
  const textX = bx + badgeR + 40;
  const textW = x + w - textX - 40;
  const t = String(text).toUpperCase();
  const size = fitFontSize(t, { width: textW, height: h - 40, maxSize: 42, minSize: 26 });
  o.push(hline({ x: textX, y: y + 24, w: textW, thickness: 3, fill: palette.primary, layerRole: 'decor' }));
  o.push(textbox({
    text: t, x: textX, y: y + Math.round((h - estTextHeight(t, size, textW)) / 2) + 8,
    w: textW, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_INK, align: 'left', layerRole: 'decor', bgRef: DARK_PANEL
  }));
}

function iconRow(o, blocks, palette, fonts, { x, y, w, h }) {
  const gap = 16;
  const n = Math.max(blocks.length, 1);
  const cellW = Math.round((w - gap * (n - 1)) / n);
  blocks.forEach((b, i) => {
    iconCell(o, b, palette, fonts, { x: x + i * (cellW + gap), y, w: cellW, h });
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark brewery facility at night, deep near-black, warm gold rim light on tanks, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({ spots: [
    { x: 1160, y: 340, r: 420, color: palette.primary },
    { x: 240, y: 1520, r: 380, color: palette.accent }
  ], intensity: 0.7 }));
  o.push(...dotGrid({ x: 96, y: 980, cols: 6, rows: 4, gap: 52, dotR: 4, color: palette.primary, intensity: 0.6 }));

  flourishKicker(o, 'Physical Security', palette, fonts, 96, 110, W - 192);

  const headCursor = headlineZone(o, content, palette, fonts, { x: 96, y: 200, w: 820, maxSize: 156 });
  o.push(imageSlot({
    slotId: 'slot-badge', x: 960, y: 200, w: 358, h: 320,
    styleHint: 'circular gold brewery crest with a padlock, emblem, no text',
    stroke: palette.primary
  }));

  const stmtY = Math.max(headCursor + 24, 560);
  const afterStmt = statementLine(o, content.subheadline || 'Strong access. Strong brewery.', palette, fonts, 96, stmtY, W - 192);

  const iconRowTop = afterStmt + 24;
  const iconRowH = Math.max(560, 1540 - iconRowTop);
  iconRow(o, content.blocks || [], palette, fonts, { x: 96, y: iconRowTop, w: W - 192, h: iconRowH });

  lockStatementBar(o, 'Lock today. Protect tomorrow.', palette, fonts, 96, 1560, W - 192, 140);

  ctaBar(o, content.callToAction, palette, fonts, W, 1848);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark brewery facility at night, deep near-black, warm gold rim light on tanks, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({ spots: [
    { x: 320, y: 320, r: 420, color: palette.primary },
    { x: 1720, y: 1120, r: 400, color: palette.accent }
  ], intensity: 0.7 }));
  o.push(...dotGrid({ x: 96, y: 980, cols: 5, rows: 3, gap: 50, dotR: 4, color: palette.primary, intensity: 0.6 }));

  const colW = 720;
  flourishKicker(o, 'Physical Security', palette, fonts, 96, 100, colW);
  const headCursor = headlineZone(o, content, palette, fonts, { x: 96, y: 180, w: colW, maxSize: 128 });
  o.push(imageSlot({
    slotId: 'slot-badge', x: 96 + Math.round((colW - 320) / 2), y: Math.max(headCursor + 20, 560), w: 320, h: 300,
    styleHint: 'circular gold brewery crest with a padlock, emblem, no text',
    stroke: palette.primary
  }));
  statementLine(o, content.subheadline || 'Strong access. Strong brewery.', palette, fonts, 96, Math.max(headCursor + 340, 900), colW);

  const rightX = 96 + colW + 48;
  const rightW = W - rightX - 96;
  iconRow(o, content.blocks || [], palette, fonts, { x: rightX, y: 140, w: rightW, h: 660 });
  lockStatementBar(o, 'Lock today. Protect tomorrow.', palette, fonts, rightX, 820, rightW, 140);

  ctaBar(o, content.callToAction, palette, fonts, W, 1290, 124);
  return canvas;
}

// ── previews ────────────────────────────────────────────────────────────────

function iconRowPreview(parts, blocks, x, y, w, h, palette) {
  const gap = 16, n = 5;
  const cellW = (w - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const cx = x + i * (cellW + gap) + cellW / 2;
    const r = Math.min(64, cellW * 0.28);
    parts.push(pvCircle(pv(cx), pv(y + r), pv(r), DARK_PANEL, { stroke: palette.primary }));
    parts.push(pvRect(pv(x + i * (cellW + gap) + cellW * 0.2), pv(y + r * 2 + 20), pv(cellW * 0.6), 6, palette.primary, { rx: 2 }));
    parts.push(pvBars({ x: pv(x + i * (cellW + gap)), y: pv(y + r * 2 + 44), w: pv(cellW), lines: 3, barH: 4, gap: 3, fill: DARK_INK, align: 'center' }));
  }
}

function previewPortrait(palette) {
  const W = 1414;
  const parts = [
    pvPoly([{ x: pv(136), y: pv(122) }, { x: pv(144), y: pv(130) }, { x: pv(136), y: pv(138) }, { x: pv(128), y: pv(130) }], palette.primary),
    pvBars({ x: pv(300), y: pv(200), w: pv(820), lines: 2, barH: 12, gap: 8, fill: DARK_INK, align: 'center' }),
    pvRect(pv(960), pv(200), pv(358), pv(320), 'none', { rx: 3, stroke: palette.primary, dash: '4 3' }),
    pvBars({ x: pv(96), y: pv(560), w: pv(W - 192), lines: 1, barH: 10, gap: 5, fill: DARK_INK, align: 'center' })
  ];
  iconRowPreview(parts, null, 96, 640, W - 192, 560, palette);
  parts.push(pvRect(pv(96), pv(1560), pv(W - 192), pv(140), DARK_PANEL, { rx: 4 }));
  parts.push(pvRect(0, pv(1848), 200, pv(152), palette.primary));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const colW = 720;
  const parts = [
    pvBars({ x: pv(96), y: pv(180), w: pv(colW), lines: 2, barH: 11, gap: 7, fill: DARK_INK, align: 'center' }),
    pvRect(pv(96 + (colW - 320) / 2), pv(560), pv(320), pv(300), 'none', { rx: 3, stroke: palette.primary, dash: '4 3' })
  ];
  const rightX = 96 + colW + 48;
  const rightW = 2000 - rightX - 96;
  iconRowPreview(parts, null, rightX, 140, rightW, 620, palette);
  parts.push(pvRect(pv(rightX), pv(820), pv(rightW), pv(140), DARK_PANEL, { rx: 4 }));
  parts.push(pvRect(0, pv(1290), PV_LAND_W, pv(124), palette.primary));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'lock-it-down',
  name: 'Lock It Down',
  style: 'infographic',
  description: 'A near-black, gold-branded physical-security poster: a flourished kicker, a big headline paired with a lock badge, a centered statement, then a row of icon cells (icon + two-tone label + description), a lock statement bar, and a gold report bar at the foot.',
  contentSchema: {
    headline: { required: true, maxWords: 5 },
    subheadline: { required: false, maxWords: 8 },
    blocks: { kind: 'cells', min: 5, max: 5, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 6,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
