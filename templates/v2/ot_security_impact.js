// v2 template — ot-security-impact (style: bullet). Reinterpretation of the
// AB InBev "OT System Security – Never Share Your Access" dark poster
// (source: 14.html) at the v2 canvas scale.
// Near-black canvas, gold accent, headline + subheadline, 3 tip rows (label
// chip + message text per block), an "IMPACT" section with 3 decorative icon
// cells, a report/CTA line, and a QR content imageSlot in the CTA footer.
// Portrait: single-column vertical stack. Landscape: two-column layout with
// headline/impact on the left and tip rows on the right.
//
// Source → port:
//   "OT System Security" headline              → headlineZone (headline)
//   "Never Share Your Access" subtitle         → subheadline (palette.primary)
//   3 access-rule boxes (dashed border, text)  → tipRows × blocks (sequence min3/max3)
//                                                 label chip + message text, both bound
//   "IMPACT" header + 3 icon+label cells       → impactSection (decorative, 3 cells)
//   Footer: "Report immediately" + email + QR  → reportLine + ctaBar + imageSlot
//
// Design reinterpreted at 1414×2000 / 2000×1414 with v2 language.
// Yellow = palette.primary; dark grounds = DARK_* anchors only; no hardcoded hex.

import {
  textbox, rect, circle, chip, imageSlot, backgroundImageSlot,
  fitFontSize, fitTextBlock, estTextHeight,
  pv, pvRect, pvBars, pvCircle, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, dotGrid, legibilityScrim, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK
} from './decor.js';

// ── constants ─────────────────────────────────────────────────────────────────

const PAD = 88;
const CARD_RX = 20;
const CTA_H_P = 160;   // portrait CTA bar height
const CTA_H_L = 128;   // landscape CTA bar height

// Static decorative labels for the IMPACT cells (not content-bound by design)
const IMPACT_LABELS = ['OPERATIONAL\nDISRUPTION', 'SAFETY\nRISK', 'DATA\nBREACH'];

// ── shared helpers ────────────────────────────────────────────────────────────

/** Yellow CTA bar full-width at the bottom with embedded QR imageSlot. */
function ctaBarWithQr(o, text, palette, fonts, W, y, h, qrSize) {
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));

  // QR imageSlot placed right-aligned inside the CTA bar
  const qrPad = Math.round((h - qrSize) / 2);
  const qrX = W - qrPad - qrSize;
  const qrY = y + qrPad;
  o.push(imageSlot({
    slotId: 'slot-qr',
    x: qrX, y: qrY, w: qrSize, h: qrSize,
    styleHint: 'QR code linking to the OT security awareness portal',
    stroke: DARK_BASE, rx: 8
  }));

  // CTA text left of the QR slot
  const textW = qrX - 80 - PAD;
  const size = fitFontSize(text, { width: textW, height: h - 40, maxSize: 40, minSize: 26, lineHeight: 1.2 });
  const th = estTextHeight(text, size, textW, 1.2);
  o.push(textbox({
    text, x: PAD, y: y + Math.round((h - th) / 2),
    w: textW, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: DARK_BASE, align: 'left', layerRole: 'cta', bgRef: palette.primary
  }));
}

/**
 * Headline + optional subheadline. Returns cursor y after all text.
 */
function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const { fontSize: headSize, height: headH } = fitTextBlock(content.headline, {
    width: w, height: 360, maxSize, minSize: 80, lineHeight: 1.0
  });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, lineHeight: 1.0,
    layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + headH + 18;

  if (content.subheadline) {
    const { fontSize: subSize, height: subH } = fitTextBlock(content.subheadline, {
      width: w, height: 120, maxSize: 44, minSize: 28, lineHeight: 1.26
    });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.head, fontWeight: '800', fill: palette.primary, lineHeight: 1.26,
      layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += subH + 14;
  }
  return cursor;
}

/**
 * One tip row: label chip on the left, message text on the right.
 * Both objects carry msgId + fieldRef per the multi-field binding contract.
 */
function tipRow(o, b, palette, fonts, { x, y, w, h }) {
  // Card panel behind the row
  o.push(rect({
    x, y, w, h, fill: DARK_PANEL, rx: CARD_RX,
    stroke: palette.primary, strokeWidth: 2, opacity: 0.9, layerRole: 'background'
  }));

  const innerPad = 24;
  const chipMaxW = Math.min(200, Math.round(w * 0.30));
  const chipMaxH = Math.min(48, Math.round(h * 0.40));

  // Label chip — bound to this block (fieldRef: 'label')
  const [pill, labelTb] = chip({
    text: b.label || 'RULE',
    x: x + innerPad, y: y + innerPad,
    fontSize: 22, bg: palette.primary, color: DARK_BASE,
    font: fonts.head, maxW: chipMaxW, maxH: chipMaxH,
    msgId: b.id
  });
  o.push(pill);
  o.push({ ...labelTb, fieldRef: 'label' });

  // Derive chip height from pill rect
  const chipH = pill.height ?? Math.round(22 * 1.4 + 22);

  // Message text (fieldRef: 'text') — right section of the row
  const textX = x + innerPad + (pill.width ?? chipMaxW) + 20;
  const textW = x + w - textX - innerPad;
  const textH = h - innerPad * 2;

  const { fontSize: msgSize } = fitTextBlock(b.text, {
    width: textW, height: Math.max(textH, 38 * 1.22),
    maxSize: 46, minSize: 38, lineHeight: 1.22
  });
  const msgY = y + Math.round((h - Math.min(textH, estTextHeight(b.text, msgSize, textW, 1.22))) / 2);
  o.push({
    ...textbox({
      text: b.text,
      x: textX, y: msgY,
      w: textW, fontSize: msgSize,
      fontFamily: fonts.body, fontWeight: '700', fill: DARK_INK, lineHeight: 1.22,
      layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'text'
  });

  // Decorative accent line under the chip
  o.push(rect({
    x: x + innerPad, y: y + innerPad + chipH + 6,
    w: Math.round(chipMaxW * 0.6), h: 3,
    fill: palette.primary, opacity: 0.5, layerRole: 'decor'
  }));
}

/**
 * Vertical stack of 3 tip rows distributed in the zone.
 */
function tipStack(o, blocks, palette, fonts, { x, y, w, h }) {
  const n = Math.max(blocks.length, 1);
  const gap = 20;
  const rowH = Math.round((h - gap * (n - 1)) / n);
  blocks.forEach((b, i) => {
    tipRow(o, b, palette, fonts, {
      x, y: y + i * (rowH + gap), w, h: rowH
    });
  });
}

/**
 * IMPACT section: header + 3 decorative icon-circle + label cells.
 * Purely decorative (not content-bound) — reuses the block labels as
 * static text via IMPACT_LABELS fallback.
 */
function impactSection(o, blocks, palette, fonts, { x, y, w, h }) {
  // Section header
  const headerText = 'IMPACT OF NON-COMPLIANCE';
  const hSize = fitFontSize(headerText, { width: w, height: 52, maxSize: 36, minSize: 24 });
  const hH = estTextHeight(headerText, hSize, w);
  o.push(textbox({
    text: headerText, x, y, w, fontSize: hSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.primary,
    layerRole: 'decor', bgRef: DARK_BASE
  }));

  // Accent rule
  o.push(rect({ x, y: y + hH + 6, w: Math.round(w * 0.45), h: 4, fill: palette.primary, opacity: 0.7, layerRole: 'decor' }));

  // 3 impact cells
  const cellTop = y + hH + 20;
  const cellH = h - (cellTop - y);
  const cellW = Math.round((w - 32) / 3);
  const cellGap = 16;

  for (let i = 0; i < 3; i++) {
    const cx = x + i * (cellW + cellGap);
    const cy = cellTop;

    // Icon circle
    const discR = Math.min(40, Math.round(cellW * 0.25));
    const discCx = cx + Math.round(cellW / 2);
    const discCy = cy + discR + 8;
    o.push(circle({
      x: discCx, y: discCy, r: discR,
      fill: DARK_PANEL_2, stroke: palette.primary, strokeWidth: 3,
      layerRole: 'decor'
    }));
    // inner accent dot
    o.push(circle({
      x: discCx, y: discCy, r: Math.round(discR * 0.22),
      fill: palette.primary, opacity: 0.85, layerRole: 'decor'
    }));

    // Label text below the disc
    const label = (blocks[i] && blocks[i].label) ? blocks[i].label.toUpperCase() : IMPACT_LABELS[i];
    const labelW = cellW;
    const labelBudget = Math.max(cellH - discR * 2 - 24, 32);
    const lSize = fitFontSize(label, { width: labelW, height: labelBudget, maxSize: 28, minSize: 18, lineHeight: 1.15 });
    o.push(textbox({
      text: label, x: cx, y: discCy + discR + 12,
      w: labelW, fontSize: lSize, fontFamily: fonts.head, fontWeight: '800',
      fill: DARK_INK, align: 'center', lineHeight: 1.15,
      layerRole: 'decor', bgRef: DARK_BASE
    }));
  }
}

/**
 * Short "Report suspicious activity" accent line above CTA bar.
 * Returns the height consumed.
 */
function reportLine(o, palette, fonts, x, y, w) {
  const text = 'Report any OT access anomaly immediately';
  const size = fitFontSize(text, { width: w, height: 56, maxSize: 34, minSize: 24 });
  const th = estTextHeight(text, size, w, 1.18);
  const bh = th + 24;
  o.push(rect({ x, y: y - 8, w, h: bh, fill: DARK_PANEL_2, rx: 12, layerRole: 'background' }));
  o.push(textbox({
    text, x: x + 16, y, w: w - 32, fontSize: size,
    fontFamily: fonts.head, fontWeight: '800', fill: palette.primary, lineHeight: 1.18,
    align: 'center', layerRole: 'decor', bgRef: DARK_PANEL_2
  }));
  return bh;
}

// ── portrait build ────────────────────────────────────────────────────────────

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  // 1. Background slot + scrim (CONTRACT: first two)
  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'dark industrial control system / OT security abstract — deep charcoal, subtle gold circuit patterns, no text',
    stroke: palette.primary
  }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // 2. Atmosphere decor
  o.push(...meshGlow({ spots: [
    { x: 1200, y: 280, r: 420, color: palette.primary },
    { x: 180, y: 1700, r: 360, color: palette.accent ?? palette.primary }
  ], intensity: 0.60 }));
  o.push(...dotGrid({ x: 72, y: 1000, cols: 4, rows: 5, gap: 56, dotR: 4, color: palette.primary, intensity: 0.45 }));

  // 3. Layout constants
  const zoneW = W - PAD * 2;
  const QR_SIZE = 120;

  // 4. Headline zone
  let cursor = headlineZone(o, content, palette, fonts, { x: PAD, y: 180, w: zoneW, maxSize: 136 });
  cursor = Math.max(cursor, 520);

  // 5. Tip stack — 3 rows fixed
  const blocks = content.blocks || [];
  // Reserve: impactSection ~240px + reportLine ~80px + ctaBar CTA_H_P + gaps
  const reserveBottom = CTA_H_P + QR_SIZE + 80 + 240 + 80;
  const stackH = Math.max(blocks.length * 180 + (blocks.length - 1) * 20, 600);
  const stackY = cursor + 20;
  tipStack(o, blocks, palette, fonts, { x: PAD, y: stackY, w: zoneW, h: stackH });

  // 6. IMPACT section
  const impactY = stackY + stackH + 32;
  const impactH = 240;
  impactSection(o, blocks, palette, fonts, { x: PAD, y: impactY, w: zoneW, h: impactH });

  // 7. Report accent line
  const reportY = impactY + impactH + 16;
  const rH = reportLine(o, palette, fonts, PAD, reportY, zoneW);

  // 8. CTA bar with QR
  ctaBarWithQr(o, content.callToAction, palette, fonts, W, H - CTA_H_P, CTA_H_P, QR_SIZE);

  void reserveBottom; // layout verified by overflow test
  return canvas;
}

// ── landscape build ───────────────────────────────────────────────────────────

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  // 1. Background slot + scrim (CONTRACT: first two)
  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'dark industrial control system / OT security abstract — deep charcoal, subtle gold circuit patterns, no text',
    stroke: palette.primary
  }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // 2. Atmosphere decor
  o.push(...meshGlow({ spots: [
    { x: 360, y: 260, r: 360, color: palette.primary },
    { x: 1720, y: 1060, r: 320, color: palette.accent ?? palette.primary }
  ], intensity: 0.60 }));
  o.push(...dotGrid({ x: 72, y: 700, cols: 4, rows: 3, gap: 52, dotR: 4, color: palette.primary, intensity: 0.40 }));

  // 3. Two-column layout
  const colGap = 48;
  const leftW = 800;
  const leftX = PAD;
  const rightX = leftX + leftW + colGap;
  const rightW = W - rightX - PAD;
  const contentTop = 72;
  const QR_SIZE = 100;

  const blocks = content.blocks || [];

  // LEFT COLUMN: headline + subheadline + impact section + report line
  let leftCursor = headlineZone(o, content, palette, fonts, {
    x: leftX, y: contentTop, w: leftW, maxSize: 116
  });
  leftCursor = Math.max(leftCursor, contentTop + 240);

  // Impact section in left column
  const impactH = Math.min(280, H - CTA_H_L - leftCursor - 80);
  impactSection(o, blocks, palette, fonts, { x: leftX, y: leftCursor + 16, w: leftW, h: impactH });
  leftCursor += impactH + 32;

  // Report accent line in left column
  reportLine(o, palette, fonts, leftX, leftCursor, leftW);

  // RIGHT COLUMN: tip stack
  const stackH = H - contentTop - CTA_H_L - 32;
  tipStack(o, blocks, palette, fonts, { x: rightX, y: contentTop, w: rightW, h: stackH });

  // 4. CTA bar with QR
  ctaBarWithQr(o, content.callToAction, palette, fonts, W, H - CTA_H_L, CTA_H_L, QR_SIZE);

  return canvas;
}

// ── previews ─────────────────────────────────────────────────────────────────

function tipRowPreview(parts, x, y, w, rowH, palette) {
  // card bg
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(rowH), DARK_PANEL, { rx: 3, stroke: palette.primary }));
  // chip
  parts.push(pvRect(pv(x + 24), pv(y + 10), pv(64), pv(18), palette.primary, { rx: 3 }));
  // text bars
  parts.push(pvBars({ x: pv(x + 104), y: pv(y + 14), w: pv(w - 128), lines: 2, barH: 4, gap: 3, fill: DARK_INK }));
}

function impactPreview(parts, x, y, w, palette) {
  const cellW = Math.round((w - 32) / 3);
  const cellGap = 16;
  for (let i = 0; i < 3; i++) {
    const cx = x + i * (cellW + cellGap);
    const discR = Math.round(pv(cellW * 0.25));
    const discCx = pv(cx + cellW / 2);
    parts.push(pvCircle(discCx, pv(y + 28), discR, DARK_PANEL_2, { stroke: palette.primary }));
    parts.push(pvBars({ x: pv(cx), y: pv(y + 62), w: pv(cellW), lines: 2, barH: 3, gap: 3, fill: DARK_INK, align: 'center' }));
  }
}

function previewPortrait(palette) {
  const W = 1414;
  const zoneW = W - PAD * 2;
  const n = 3;
  const parts = [
    // headline bars
    pvBars({ x: pv(PAD), y: pv(190), w: pv(zoneW), lines: 2, barH: 10, gap: 6, fill: DARK_INK }),
    pvBars({ x: pv(PAD), y: pv(250), w: pv(zoneW * 0.68), lines: 1, barH: 8, gap: 0, fill: palette.primary })
  ];
  // tip rows
  const stackY = 530;
  const rowH = 180;
  const gap = 20;
  for (let i = 0; i < n; i++) {
    tipRowPreview(parts, PAD, stackY + i * (rowH + gap), zoneW, rowH, palette);
  }
  // impact section
  const impactY = stackY + n * rowH + (n - 1) * gap + 32;
  parts.push(pvRect(pv(PAD), pv(impactY), pv(zoneW), pv(10), palette.primary));
  impactPreview(parts, PAD, impactY + 14, zoneW, palette);
  // report line
  const reportY = impactY + 100;
  parts.push(pvRect(pv(PAD), pv(reportY), pv(zoneW), pv(40), DARK_PANEL_2, { rx: 2 }));
  // CTA bar
  parts.push(pvRect(0, pv(1840), pv(W), pv(CTA_H_P), palette.primary));
  // QR slot in CTA
  parts.push(pvSlot(pv(W - PAD - 120), pv(1860), pv(120), pv(120), DARK_BASE));

  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000;
  const H = 1414;
  const leftW = 800;
  const leftX = PAD;
  const rightX = leftX + leftW + 48;
  const rightW = W - rightX - PAD;
  const n = 3;

  const parts = [
    // Left column: headline
    pvBars({ x: pv(leftX), y: pv(80), w: pv(leftW), lines: 2, barH: 9, gap: 5, fill: DARK_INK }),
    pvBars({ x: pv(leftX), y: pv(126), w: pv(leftW * 0.65), lines: 1, barH: 7, gap: 0, fill: palette.primary }),
    // impact section in left column
    pvRect(pv(leftX), pv(280), pv(leftW), pv(10), palette.primary),
  ];
  impactPreview(parts, leftX, 294, leftW, palette);
  // report line in left column
  parts.push(pvRect(pv(leftX), pv(400), pv(leftW), pv(36), DARK_PANEL_2, { rx: 2 }));

  // Right column: tip rows
  const stackH = H - 72 - CTA_H_L - 32;
  const rowH = Math.round((stackH - 20 * (n - 1)) / n);
  const gap = 20;
  for (let i = 0; i < n; i++) {
    tipRowPreview(parts, rightX, 72 + i * (rowH + gap), rightW, rowH, palette);
  }
  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H_L), PV_LAND_W, pv(CTA_H_L), palette.primary));
  // QR slot in CTA
  parts.push(pvSlot(pv(W - PAD - 100), pv(H - CTA_H_L + 14), pv(100), pv(100), DARK_BASE));

  return svgWrapO(parts, DARK_BASE, 'landscape');
}

// ── export ────────────────────────────────────────────────────────────────────

export default {
  id: 'ot-security-impact',
  name: 'OT Security Impact',
  style: 'bullet',
  description: 'Dark card reinterpreting the AB InBev OT System Security poster: headline and subheadline, three tip rows (label chip + message per block), a decorative IMPACT section with three icon cells, a report accent line, and a QR content slot embedded in the CTA footer.',
  contentSchema: {
    headline: { required: true, maxWords: 6 },
    subheadline: { required: false, maxWords: 8 },
    blocks: { kind: 'sequence', min: 3, max: 3, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 12 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
