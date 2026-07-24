// v2 template — incident-policy-severity (style: tabular). Reinterpretation of
// the AB InBev "Information Security Incident & Threat Management Policy"
// A4-portrait poster (source: 20.html) at the v2 canvas scale.
//
// The archetype is a policy document with:
//   – a bold yellow-header band (title / headline)
//   – a stacked SEVERITY-LEVEL TABLE (each block = one severity level:
//       label chip  → severity name (e.g. CRITICAL, HIGH, MEDIUM, LOW)
//       text cell   → description of that level)
//   – a "REPORT IMMEDIATELY" danger callout in accent colour
//   – a tagline strip
//   – QR content imageSlot + CTA bar
//
// Source → port:
//   yellow header band + angled logo tab  → primary-colour header band (palette.primary)
//   "Information Security Incident…"      → headline verbatim in header
//   4 severity-level rows (coloured)      → block rows — label chip (fieldRef:'label')
//                                            + body text (fieldRef:'text')
//   red "REPORT IMMEDIATELY" callout      → danger callout (palette.accent)
//   tagline / motto                       → decor tagline text
//   QR code (base64 in source)            → imageSlot slotId:'slot-qr' (NOT embedded)
//   white A4 background                   → backgroundImageSlot + light legibility scrim
//   Montserrat → fonts.head; Open Sans → fonts.body
//
// Design reinterpreted at 1414×2000 / 2000×1414 with v2 language.
// Yellow = palette.primary; danger/accent = palette.accent; darks = DARK_*; no hardcoded hex.
// CRITICAL: blocks MULTI-FIELD ['label','text'] — label carries msgId+fieldRef:'label';
//           text layerRole:'message' (≥38) carries msgId+fieldRef:'text'.
// CRITICAL: row text height = REAL remaining row space; no overflow at max(4).

import {
  textbox, rect, chip, imageSlot, backgroundImageSlot,
  fitFontSize, fitTextBlock, estTextHeight,
  pv, pvRect, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, dotGrid, legibilityScrim,
  svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK
} from './decor.js';

// ── constants ─────────────────────────────────────────────────────────────────

const PAD = 72;
const GAP = 14;
const CARD_RX = 20;
const CHIP_ZONE_W = 320; // label chip zone width in portrait row

// Portrait zone heights
const HEADER_H_P = 300;
const CALLOUT_H_P = 148;
const FOOTER_H_P = 150;
const CTA_H_P = 116;

// Landscape zone heights
const HEADER_H_L = 200;
const CALLOUT_H_L = 110;
const FOOTER_H_L = 118;
const CTA_H_L = 92;

// ── CTA bar ────────────────────────────────────────────────────────────────────

function ctaBar(o, text, palette, fonts, W, y, h) {
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 200, height: h - 28, maxSize: 44, minSize: 28, lineHeight: 1.2 });
  const th = estTextHeight(text, size, W - 200, 1.2);
  o.push(textbox({
    text, x: 100, y: y + Math.round((h - th) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, align: 'center', layerRole: 'cta', bgRef: palette.primary
  }));
}

// ── header band ───────────────────────────────────────────────────────────────

function headerBand(o, content, palette, fonts, W, y, h) {
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));
  // Dark top accent rule
  o.push(rect({ x: 0, y, w: W, h: 7, fill: DARK_BASE, opacity: 0.22, layerRole: 'decor' }));
  // Dot grid atmosphere — right side
  o.push(...dotGrid({
    x: W - 240, y: y + 50,
    cols: 4, rows: 4, gap: 48, dotR: 5,
    color: DARK_BASE, intensity: 0.16
  }));

  const innerX = PAD;
  const innerW = W - PAD * 2;
  let cursor = y + PAD;

  // Supra label "INCIDENT MANAGEMENT POLICY" (decorative)
  const supraLabel = 'INCIDENT MANAGEMENT POLICY';
  const supraSize = fitFontSize(supraLabel, {
    width: innerW * 0.75, height: Math.round(h * 0.14), maxSize: 34, minSize: 24, lineHeight: 1.1
  });
  const supraH = estTextHeight(supraLabel, supraSize, innerW * 0.75, 1.1);
  o.push(textbox({
    text: supraLabel, x: innerX, y: cursor, w: Math.round(innerW * 0.75),
    fontSize: supraSize, fontFamily: fonts.head, fontWeight: '800',
    fill: DARK_BASE, lineHeight: 1.1, align: 'left',
    layerRole: 'decor', bgRef: palette.primary
  }));
  cursor += supraH + 8;

  // Thin rule
  o.push(rect({ x: innerX, y: cursor, w: Math.round(innerW * 0.5), h: 4, fill: DARK_BASE, opacity: 0.20, layerRole: 'decor' }));
  cursor += 16;

  // Headline — verbatim, fontSize ≥ 80
  const headBudget = h - (cursor - y) - PAD * 0.8;
  const { fontSize: headSize, height: headH } = fitTextBlock(content.headline, {
    width: innerW, height: Math.max(headBudget, 80 * 1.1),
    maxSize: 92, minSize: 80, lineHeight: 1.05
  });
  o.push(textbox({
    text: content.headline, x: innerX, y: cursor, w: innerW,
    fontSize: headSize, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, lineHeight: 1.05, align: 'left',
    layerRole: 'headline', bgRef: palette.primary
  }));
  cursor += headH + 12;

  // Optional subheadline
  const subText = content.subheadline || 'Severity Levels & Escalation Guidance';
  const subBudget = h - (cursor - y) - 8;
  if (subBudget > 32) {
    const subSize = fitFontSize(subText, {
      width: innerW, height: Math.min(subBudget, 70), maxSize: 34, minSize: 24, lineHeight: 1.25
    });
    o.push(textbox({
      text: subText, x: innerX, y: cursor, w: innerW,
      fontSize: subSize, fontFamily: fonts.body, fontWeight: '600',
      fill: DARK_BASE, lineHeight: 1.25, align: 'left',
      layerRole: 'subheadline', bgRef: palette.primary
    }));
  }
}

// ── column-header strip (table header) ───────────────────────────────────────

function tableHeader(o, palette, fonts, { x, y, w, h }) {
  o.push(rect({ x, y, w, h, fill: DARK_BASE, rx: CARD_RX, layerRole: 'background' }));
  o.push(rect({ x: x + CARD_RX, y, w: w - CARD_RX * 2, h: 5, fill: palette.primary, layerRole: 'decor' }));

  const chipZoneW = CHIP_ZONE_W;
  const textZoneX = x + chipZoneW + 32;
  const textZoneW = w - chipZoneW - 32 - 28;
  const labelText = 'SEVERITY LEVEL';
  const textColText = 'DESCRIPTION';
  const innerY = y + Math.round((h - 28) / 2);

  const lSize = fitFontSize(labelText, { width: chipZoneW - 40, height: h - 16, maxSize: 28, minSize: 20, lineHeight: 1.1 });
  o.push(textbox({
    text: labelText, x: x + 28, y: innerY,
    w: chipZoneW - 40, fontSize: lSize, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, lineHeight: 1.1, align: 'left',
    layerRole: 'decor', bgRef: DARK_BASE
  }));

  const tSize = fitFontSize(textColText, { width: textZoneW, height: h - 16, maxSize: 28, minSize: 20, lineHeight: 1.1 });
  o.push(textbox({
    text: textColText, x: textZoneX, y: innerY,
    w: textZoneW, fontSize: tSize, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, lineHeight: 1.1, align: 'left',
    layerRole: 'decor', bgRef: DARK_BASE
  }));

  // Vertical divider
  o.push(rect({ x: x + chipZoneW + 8, y: y + 10, w: 3, h: h - 20, fill: palette.primary, rx: 1, opacity: 0.4, layerRole: 'decor' }));
}

// ── single severity row (one block) ──────────────────────────────────────────
// CRITICAL: label carries msgId + fieldRef:'label'; text carries msgId + fieldRef:'text'.

function severityRow(o, b, idx, palette, fonts, { x, y, w, h }) {
  const fill = idx % 2 === 0 ? DARK_PANEL : DARK_BASE;
  o.push(rect({
    x, y, w, h,
    fill, rx: CARD_RX,
    stroke: palette.primary, strokeWidth: 1,
    layerRole: 'background'
  }));

  // Left accent stripe
  o.push(rect({ x, y: y + CARD_RX, w: 5, h: h - CARD_RX * 2, fill: palette.primary, layerRole: 'decor' }));

  const chipZoneW = CHIP_ZONE_W;
  const innerX = x + 18;

  // ── label chip (fieldRef:'label') ────────────────────────────────────────
  const chipMaxW = chipZoneW - 40;
  const chipMaxH = Math.min(56, Math.round(h - 28));
  const [pill, labelTb] = chip({
    text: b.label || 'Level',
    x: innerX, y: y + Math.round((h - Math.min(chipMaxH, 44)) / 2),
    fontSize: 24, bg: palette.primary, color: DARK_BASE,
    font: fonts.head, maxW: chipMaxW, maxH: chipMaxH,
    msgId: b.id
  });
  o.push(pill);
  o.push({ ...labelTb, fieldRef: 'label' });

  // Vertical divider between chip zone and text zone
  const divX = x + chipZoneW + 8;
  o.push(rect({ x: divX, y: y + 10, w: 3, h: h - 20, fill: palette.primary, rx: 1, opacity: 0.30, layerRole: 'decor' }));

  // ── text cell (fieldRef:'text') ───────────────────────────────────────────
  const textX = divX + 24;
  const textW = w - (textX - x) - 24;
  // REAL remaining row space for the text (vertical budget = row height minus top+bottom padding)
  const textBudget = h - 24;
  const { fontSize: msgSize } = fitTextBlock(b.text, {
    width: textW,
    height: Math.max(textBudget, 38 * 1.3),
    maxSize: 44, minSize: 38, lineHeight: 1.3
  });
  const msgH = estTextHeight(b.text, msgSize, textW, 1.3);
  o.push({
    ...textbox({
      text: b.text,
      x: textX, y: y + Math.round((h - msgH) / 2),
      w: textW, fontSize: msgSize,
      fontFamily: fonts.body, fontWeight: '600',
      fill: DARK_INK, lineHeight: 1.3,
      layerRole: 'message', msgId: b.id, bgRef: fill
    }),
    fieldRef: 'text'
  });
}

// ── severity table (all blocks) ───────────────────────────────────────────────
// The table header is always rendered, then one row per block.
// rowH is derived from the AVAILABLE height divided by block count so max(4)
// never overflows.

function severityTable(o, blocks, palette, fonts, { x, y, w, h }) {
  const n = blocks.length;
  if (n === 0) return;

  const tHeaderH = 60;
  const rowGap = Math.min(GAP, Math.round(h * 0.02));
  const availForRows = h - tHeaderH - rowGap;
  const rowH = Math.floor((availForRows - rowGap * (n - 1)) / n);

  tableHeader(o, palette, fonts, { x, y, w, h: tHeaderH });

  blocks.forEach((b, i) => {
    severityRow(o, b, i, palette, fonts, {
      x, y: y + tHeaderH + rowGap + i * (rowH + rowGap), w, h: rowH
    });
  });
}

// ── danger callout strip ──────────────────────────────────────────────────────
// "REPORT IMMEDIATELY" danger bar — accent colour (danger tone via palette.accent).

function dangerCallout(o, palette, fonts, W, y, h) {
  // Accent-coloured background (danger/alert colour — palette.accent)
  const danger = palette.accent ?? palette.primary;
  o.push(rect({ x: 0, y, w: W, h, fill: danger, layerRole: 'background' }));
  // Dark inner frame accent
  o.push(rect({ x: 0, y, w: W, h: 5, fill: DARK_BASE, opacity: 0.22, layerRole: 'decor' }));
  o.push(rect({ x: 0, y: y + h - 5, w: W, h: 5, fill: DARK_BASE, opacity: 0.22, layerRole: 'decor' }));

  const innerX = PAD;
  const innerW = W - PAD * 2;
  let cursor = y + 20;

  const warningLabel = '⚠ REPORT IMMEDIATELY';
  const wSize = fitFontSize(warningLabel, {
    width: innerW, height: Math.round(h * 0.42), maxSize: 48, minSize: 32, lineHeight: 1.1
  });
  const wH = estTextHeight(warningLabel, wSize, innerW, 1.1);
  o.push(textbox({
    text: warningLabel, x: innerX, y: cursor, w: innerW,
    fontSize: wSize, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, lineHeight: 1.1, align: 'center',
    layerRole: 'decor', bgRef: danger
  }));
  cursor += wH + 10;

  const subMsg = 'Any suspected security incident must be reported immediately to the Information Security team.';
  const subBudget = h - (cursor - y) - 16;
  if (subBudget > 34) {
    const subSize = fitFontSize(subMsg, {
      width: innerW, height: Math.max(subBudget, 34), maxSize: 30, minSize: 22, lineHeight: 1.3
    });
    o.push(textbox({
      text: subMsg, x: innerX, y: cursor, w: innerW,
      fontSize: subSize, fontFamily: fonts.body, fontWeight: '700',
      fill: DARK_BASE, lineHeight: 1.3, align: 'center',
      layerRole: 'decor', bgRef: danger
    }));
  }
}

// ── footer strip (tagline + QR imageSlot) ─────────────────────────────────────
// imageSlot is placed in the RIGHT side of footer — a text-free region.
// The QR slot never overlaps any Textbox (tagline is left of slot).

function footerStrip(o, palette, fonts, W, y, h) {
  o.push(rect({ x: 0, y, w: W, h, fill: DARK_BASE, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: palette.primary, layerRole: 'decor' }));

  // QR slot — right side, inset from edge
  const slotSide = Math.min(h - 28, 108);
  const slotX = W - PAD - slotSide;
  const slotY = y + Math.round((h - slotSide) / 2);
  o.push(imageSlot({
    slotId: 'slot-qr',
    x: slotX, y: slotY, w: slotSide, h: slotSide,
    styleHint: 'QR code linking to the Incident Management Policy documentation, clean on white background, square format',
    stroke: palette.primary, rx: 8
  }));

  // Tagline — left of QR slot
  const textW = slotX - PAD * 2;
  const tagline = 'Secure. Report. Recover.';
  const tagSize = fitFontSize(tagline, { width: textW, height: h - 16, maxSize: 34, minSize: 22, lineHeight: 1.2 });
  const tagH = estTextHeight(tagline, tagSize, textW, 1.2);
  o.push(textbox({
    text: tagline, x: PAD, y: y + Math.round((h - tagH) / 2),
    w: textW, fontSize: tagSize, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, lineHeight: 1.2, align: 'left',
    layerRole: 'decor', bgRef: DARK_BASE
  }));
}

// ── portrait build ────────────────────────────────────────────────────────────

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  // CONTRACT: first = full-bleed bg image slot
  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'clean white or light parchment document background with subtle paper grain, policy document feel, no text, minimal',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ── layout zones ──────────────────────────────────────────────────────────
  // [0..HEADER_H_P]                      header band (primary, headline)
  // [HEADER_H_P..+tableH]                severity table (blocks)
  // [tableH..+CALLOUT_H_P]               danger callout (accent)
  // [+CALLOUT_H_P..+FOOTER_H_P]          footer (tagline + QR)
  // [footer..H]                          CTA bar

  const headerY   = 0;
  const tableY    = HEADER_H_P + GAP;
  const calloutY  = H - CTA_H_P - FOOTER_H_P - CALLOUT_H_P;
  const footerY   = H - CTA_H_P - FOOTER_H_P;
  const ctaY      = H - CTA_H_P;
  const tableH    = calloutY - tableY - GAP;

  headerBand(o, content, palette, fonts, W, headerY, HEADER_H_P);
  severityTable(o, content.blocks || [], palette, fonts, {
    x: PAD, y: tableY, w: W - PAD * 2, h: tableH
  });
  dangerCallout(o, palette, fonts, W, calloutY, CALLOUT_H_P);
  footerStrip(o, palette, fonts, W, footerY, FOOTER_H_P);
  ctaBar(o, content.callToAction, palette, fonts, W, ctaY, CTA_H_P);

  return canvas;
}

// ── landscape build ───────────────────────────────────────────────────────────

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  // CONTRACT: first = full-bleed bg image slot
  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'clean white or light parchment document background with subtle paper grain, policy document feel, no text, minimal',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ── landscape layout ──────────────────────────────────────────────────────
  // [0..HEADER_H_L]                       header band
  // [HEADER_H_L..+tableH]                 severity table (blocks)
  // [tableH..+CALLOUT_H_L]                danger callout
  // [+CALLOUT_H_L..+FOOTER_H_L]           footer
  // [footer..H]                           CTA bar

  const headerY   = 0;
  const tableY    = HEADER_H_L + GAP;
  const calloutY  = H - CTA_H_L - FOOTER_H_L - CALLOUT_H_L;
  const footerY   = H - CTA_H_L - FOOTER_H_L;
  const ctaY      = H - CTA_H_L;
  const tableH    = calloutY - tableY - GAP;

  headerBand(o, content, palette, fonts, W, headerY, HEADER_H_L);
  severityTable(o, content.blocks || [], palette, fonts, {
    x: PAD, y: tableY, w: W - PAD * 2, h: tableH
  });
  dangerCallout(o, palette, fonts, W, calloutY, CALLOUT_H_L);
  footerStrip(o, palette, fonts, W, footerY, FOOTER_H_L);
  ctaBar(o, content.callToAction, palette, fonts, W, ctaY, CTA_H_L);

  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────

function previewPortrait(palette) {
  const W = 1414;
  const H = 2000;
  const danger = palette.accent ?? palette.primary;

  const tableY   = HEADER_H_P + GAP;
  const calloutY = H - CTA_H_P - FOOTER_H_P - CALLOUT_H_P;
  const footerY  = H - CTA_H_P - FOOTER_H_P;

  const nBlocks  = 4;
  const tableH   = calloutY - tableY - GAP;
  const tHeaderH = 60;
  const rowGap   = Math.min(GAP, Math.round(tableH * 0.02));
  const availForRows = tableH - tHeaderH - rowGap;
  const rowH = Math.floor((availForRows - rowGap * (nBlocks - 1)) / nBlocks);

  const parts = [
    // header band
    pvRect(0, 0, pv(W), pv(HEADER_H_P), palette.primary),
    pvBars({ x: pv(PAD), y: pv(PAD + 10), w: pv(W * 0.60), lines: 1, barH: 7, gap: 0, fill: DARK_BASE }),
    pvRect(pv(PAD), pv(PAD + 26), pv(W * 0.40), pv(3), DARK_BASE, { opacity: 0.20 }),
    pvBars({ x: pv(PAD), y: pv(PAD + 42), w: pv(W * 0.80), lines: 2, barH: 16, gap: 8, fill: DARK_BASE }),
    pvBars({ x: pv(PAD), y: pv(PAD + 120), w: pv(W * 0.56), lines: 1, barH: 5, gap: 0, fill: DARK_BASE }),
    // table header
    pvRect(pv(PAD), pv(tableY), pv(W - PAD * 2), pv(tHeaderH), DARK_BASE, { rx: 4 }),
    pvBars({ x: pv(PAD + 28), y: pv(tableY + 20), w: pv(CHIP_ZONE_W - 40), lines: 1, barH: 5, gap: 0, fill: palette.primary }),
    pvBars({ x: pv(PAD + CHIP_ZONE_W + 32), y: pv(tableY + 20), w: pv(W * 0.35), lines: 1, barH: 5, gap: 0, fill: palette.primary })
  ];

  // severity rows
  const chipWPv = pv(CHIP_ZONE_W - 40);
  for (let i = 0; i < nBlocks; i++) {
    const ry = tableY + tHeaderH + rowGap + i * (rowH + rowGap);
    const rowFill = i % 2 === 0 ? DARK_PANEL : DARK_BASE;
    parts.push(pvRect(pv(PAD), pv(ry), pv(W - PAD * 2), pv(rowH), rowFill, { rx: 4, stroke: palette.primary }));
    parts.push(pvRect(pv(PAD), pv(ry + CARD_RX), pv(4), pv(rowH - CARD_RX * 2), palette.primary));
    parts.push(pvRect(pv(PAD + 18), pv(ry + Math.round((rowH - 28) / 2)), chipWPv, pv(28), palette.primary, { rx: 4 }));
    const textPvX = pv(PAD + CHIP_ZONE_W + 32);
    parts.push(pvBars({ x: textPvX, y: pv(ry + Math.round((rowH - 36) / 2)), w: pv(W - PAD * 2 - CHIP_ZONE_W - 60), lines: 2, barH: 5, gap: 5, fill: DARK_INK }));
  }

  // danger callout
  parts.push(pvRect(0, pv(calloutY), pv(W), pv(CALLOUT_H_P), danger));
  parts.push(pvBars({ x: pv(PAD), y: pv(calloutY + 22), w: pv(W - PAD * 2), lines: 1, barH: 10, gap: 0, fill: DARK_BASE, align: 'center' }));
  parts.push(pvBars({ x: pv(PAD), y: pv(calloutY + 52), w: pv(W - PAD * 2), lines: 2, barH: 4, gap: 5, fill: DARK_BASE, align: 'center' }));

  // footer
  parts.push(pvRect(0, pv(footerY), pv(W), pv(FOOTER_H_P), DARK_BASE));
  parts.push(pvRect(0, pv(footerY), pv(W), pv(3), palette.primary));
  const slotSide = Math.min(FOOTER_H_P - 28, 108);
  const slotX = W - PAD - slotSide;
  parts.push(pvSlot(pv(slotX), pv(footerY + Math.round((FOOTER_H_P - slotSide) / 2)), pv(slotSide), pv(slotSide), palette.primary));
  parts.push(pvBars({ x: pv(PAD), y: pv(footerY + Math.round(FOOTER_H_P / 2) - 8), w: pv(slotX - PAD * 2), lines: 1, barH: 7, gap: 0, fill: palette.primary }));

  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H_P), pv(W), pv(CTA_H_P), palette.primary));
  parts.push(pvBars({ x: pv(100), y: pv(H - CTA_H_P + 36), w: pv(W - 200), lines: 1, barH: 7, gap: 0, fill: DARK_BASE, align: 'center' }));

  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000;
  const H = 1414;
  const danger = palette.accent ?? palette.primary;

  const tableY   = HEADER_H_L + GAP;
  const calloutY = H - CTA_H_L - FOOTER_H_L - CALLOUT_H_L;
  const footerY  = H - CTA_H_L - FOOTER_H_L;

  const nBlocks  = 4;
  const tableH   = calloutY - tableY - GAP;
  const tHeaderH = 60;
  const rowGap   = Math.min(GAP, Math.round(tableH * 0.02));
  const availForRows = tableH - tHeaderH - rowGap;
  const rowH = Math.floor((availForRows - rowGap * (nBlocks - 1)) / nBlocks);

  const parts = [
    // header band
    pvRect(0, 0, PV_LAND_W, pv(HEADER_H_L), palette.primary),
    pvBars({ x: pv(PAD), y: pv(PAD + 8), w: pv(W * 0.45), lines: 1, barH: 6, gap: 0, fill: DARK_BASE }),
    pvBars({ x: pv(PAD), y: pv(PAD + 28), w: pv(W * 0.72), lines: 2, barH: 13, gap: 7, fill: DARK_BASE }),
    pvBars({ x: pv(PAD), y: pv(PAD + 90), w: pv(W * 0.50), lines: 1, barH: 4, gap: 0, fill: DARK_BASE }),
    // table header
    pvRect(pv(PAD), pv(tableY), pv(W - PAD * 2), pv(tHeaderH), DARK_BASE, { rx: 3 }),
    pvBars({ x: pv(PAD + 28), y: pv(tableY + 20), w: pv(CHIP_ZONE_W - 40), lines: 1, barH: 4, gap: 0, fill: palette.primary }),
    pvBars({ x: pv(PAD + CHIP_ZONE_W + 32), y: pv(tableY + 20), w: pv(W * 0.32), lines: 1, barH: 4, gap: 0, fill: palette.primary })
  ];

  // severity rows
  const chipWPv = pv(CHIP_ZONE_W - 40);
  for (let i = 0; i < nBlocks; i++) {
    const ry = tableY + tHeaderH + rowGap + i * (rowH + rowGap);
    const rowFill = i % 2 === 0 ? DARK_PANEL : DARK_BASE;
    parts.push(pvRect(pv(PAD), pv(ry), pv(W - PAD * 2), pv(rowH), rowFill, { rx: 3, stroke: palette.primary }));
    parts.push(pvRect(pv(PAD), pv(ry + CARD_RX), pv(4), pv(rowH - CARD_RX * 2), palette.primary));
    parts.push(pvRect(pv(PAD + 18), pv(ry + Math.round((rowH - 24) / 2)), chipWPv, pv(24), palette.primary, { rx: 3 }));
    const textPvX = pv(PAD + CHIP_ZONE_W + 32);
    parts.push(pvBars({ x: textPvX, y: pv(ry + Math.round((rowH - 28) / 2)), w: pv(W - PAD * 2 - CHIP_ZONE_W - 60), lines: 2, barH: 4, gap: 4, fill: DARK_INK }));
  }

  // danger callout
  parts.push(pvRect(0, pv(calloutY), PV_LAND_W, pv(CALLOUT_H_L), danger));
  parts.push(pvBars({ x: pv(PAD), y: pv(calloutY + 18), w: pv(W - PAD * 2), lines: 1, barH: 8, gap: 0, fill: DARK_BASE, align: 'center' }));
  parts.push(pvBars({ x: pv(PAD), y: pv(calloutY + 44), w: pv(W - PAD * 2), lines: 1, barH: 4, gap: 0, fill: DARK_BASE, align: 'center' }));

  // footer
  parts.push(pvRect(0, pv(footerY), PV_LAND_W, pv(FOOTER_H_L), DARK_BASE));
  parts.push(pvRect(0, pv(footerY), PV_LAND_W, pv(3), palette.primary));
  const slotSide = Math.min(FOOTER_H_L - 28, 108);
  const slotX = W - PAD - slotSide;
  parts.push(pvSlot(pv(slotX), pv(footerY + Math.round((FOOTER_H_L - slotSide) / 2)), pv(slotSide), pv(slotSide), palette.primary));
  parts.push(pvBars({ x: pv(PAD), y: pv(footerY + Math.round(FOOTER_H_L / 2) - 7), w: pv(slotX - PAD * 2), lines: 1, barH: 6, gap: 0, fill: palette.primary }));

  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H_L), PV_LAND_W, pv(CTA_H_L), palette.primary));
  parts.push(pvBars({ x: pv(100), y: pv(H - CTA_H_L + 28), w: pv(W - 200), lines: 1, barH: 6, gap: 0, fill: DARK_BASE, align: 'center' }));

  return svgWrapO(parts, DARK_BASE, 'landscape');
}

// ── export ────────────────────────────────────────────────────────────────────

export default {
  id: 'incident-policy-severity',
  name: 'Incident Policy Severity Levels',
  style: 'tabular',
  description: 'A4-portrait-feel incident policy tabular layout: a primary-colour header band with the headline, a severity-level table (label chip + description per block on alternating row tints), a danger-accent "Report Immediately" callout, and a dark footer with a tagline and QR content image slot.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 10 },
    blocks: { kind: 'cells', min: 3, max: 4, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
