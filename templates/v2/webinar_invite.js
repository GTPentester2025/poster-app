// v2 template — webinar-invite (style: statement). Reinterpretation of
// the AB InBev "GISP Awareness Webinar" invite card (source: 10.html)
// at the v2 canvas scale.
//
// The source is a 16:9 landscape card: white/light background, a yellow
// top-right corner blob accent, a bold uppercase title on the left, a yellow
// pill badge ("What's Inside"), a description text, a yellow ribbon with
// date/time info, detail rows (Date/Duration/Speaker), a QR code, and
// decorative yellow dots. The source uses a base64 background watermark (faint
// grey hands/folders) which is dropped; the logo is base64 embedded — dropped
// as a brand asset; the QR is an imageSlot.
//
// Source → port (reinterpreted as a DARK invite card):
//   background (white/light)              → DARK_BASE ground (dark event card)
//   .yellow-corner-blob (yellow circle)   → meshGlow primary bloom top-right
//   .bg-watermark (faint base64 img)      → backgroundImageSlot (slotId:'bg')
//   .main-title ("GISP AWARENESS…")       → headline (verbatim, ≥80px)
//   .pill-badge ("What's Inside")         → subheadline chip band (palette.primary)
//   .description-text (intro paragraph)  → ambient decor/subheadline text
//   .info-ribbon (yellow, date/time)      → dropped; detail carried by blocks
//   .detail-row (label + value pairs)    → blocks sequence min3/max4 label+text
//   .qr-section / QR                     → imageSlot slot-qr
//   .logo-wrapper (base64 logo)           → dropped (brand asset)
//   yellow #f5c400                        → palette.primary
//   dark #222222                          → DARK_BASE / DARK_PANEL
//   dot accents                           → dotGrid (palette.primary, decor)
//
// Design: dark event/invite card — strong headline zone at top, "What's Inside"
// subheadline pill/band, stacked detail rows (each = label chip + value text),
// QR imageSlot at the bottom. Portrait is the primary layout; landscape
// reflows to a two-column arrangement.
// Canvas: portrait 1414×2000, landscape 2000×1414.
// Yellow = palette.primary; darks = DARK_* only; no hardcoded brand hex.

import {
  textbox, rect, chip, imageSlot, backgroundImageSlot,
  fitFontSize, fitTextBlock, estTextHeight,
  pv, pvRect, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, dotGrid, legibilityScrim,
  svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM
} from './decor.js';

// ── layout constants ──────────────────────────────────────────────────────────

const PAD = 72;
const GAP = 20;
const CARD_RX = 20;

// Portrait zone heights
const HEADER_H_P = 360;   // headline zone height (portrait)
const SUB_H_P = 120;      // subheadline pill band height (portrait)
const CTA_H_P = 160;      // bottom CTA / QR bar height (portrait)

// Landscape zone heights
const HEADER_H_L = 280;   // headline zone height (landscape)
const SUB_H_L = 100;      // subheadline pill band height (landscape)
const CTA_H_L = 140;      // bottom CTA / QR bar height (landscape)

// Image slot sizes
const QR_SIZE_P = 180;    // QR slot height/width (portrait CTA bar)
const QR_SIZE_L = 156;    // QR slot height/width (landscape CTA bar)

// ── subheadline pill band ─────────────────────────────────────────────────────

/**
 * "What's Inside" pill band — a yellow accent strip below the headline zone,
 * acting as a visual separator and section label. Reinterprets the source's
 * yellow pill badge + "What's Inside" copy.
 */
function subheadlineBand(o, content, palette, fonts, { x, y, w, h }) {
  // Yellow accent band background
  o.push(rect({ x, y, w, h, fill: palette.primary, rx: 0, layerRole: 'background' }));

  // Narrow dark rule at top for separation
  o.push(rect({ x, y, w, h: 5, fill: DARK_BASE, opacity: 0.18, layerRole: 'decor' }));

  const subText = content.subheadline || "What's Inside";
  const innerPad = Math.round(h * 0.18);
  const textW = w - PAD * 2;
  const { fontSize: subSize } = fitTextBlock(subText, {
    width: textW, height: h - innerPad * 2,
    maxSize: 56, minSize: 28, lineHeight: 1.15
  });
  const subH = estTextHeight(subText, subSize, textW, 1.15);
  o.push(textbox({
    text: subText,
    x: PAD, y: y + Math.round((h - subH) / 2),
    w: textW, fontSize: subSize,
    fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, lineHeight: 1.15, align: 'left',
    layerRole: 'subheadline', bgRef: palette.primary
  }));

  // Decorative right-side accent bar
  o.push(rect({ x: x + w - 8, y: y + CARD_RX, w: 8, h: h - CARD_RX * 2, fill: DARK_BASE, opacity: 0.15, layerRole: 'decor' }));
}

// ── headline zone ─────────────────────────────────────────────────────────────

/**
 * Dark headline zone: deep charcoal background, ambient decor, bold white
 * event title. Reinterprets the source's bold uppercase main-title.
 */
function headlineZone(o, content, palette, fonts, { x, y, w, h }) {
  // Dark header background
  o.push(rect({ x, y, w, h, fill: DARK_PANEL, layerRole: 'background' }));

  // Accent bottom rule (yellow)
  o.push(rect({ x, y: y + h - 6, w, h: 6, fill: palette.primary, layerRole: 'decor' }));

  // Mesh glow: primary bloom top-right (reinterprets source's yellow corner blob)
  o.push(...meshGlow({
    spots: [
      { x: x + w - Math.round(w * 0.25), y: y + Math.round(h * 0.22), r: Math.round(w * 0.42), color: palette.primary }
    ],
    intensity: 0.55
  }));

  // Dot grid: quiet top-left accent
  o.push(...dotGrid({
    x: x + PAD, y: y + Math.round(h * 0.12),
    cols: 5, rows: 3, gap: 36, dotR: 4,
    color: palette.primary, intensity: 0.45
  }));

  // Event type kicker (decor)
  const kickerText = 'WEBINAR INVITE';
  const kickerSize = fitFontSize(kickerText, { width: w - PAD * 2, height: 60, maxSize: 34, minSize: 22, lineHeight: 1.1 });
  const kickerH = estTextHeight(kickerText, kickerSize, w - PAD * 2, 1.1);
  o.push(textbox({
    text: kickerText,
    x: x + PAD, y: y + Math.round(h * 0.12),
    w: w - PAD * 2, fontSize: kickerSize,
    fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, lineHeight: 1.1, align: 'left',
    layerRole: 'decor', bgRef: DARK_PANEL
  }));

  // Main headline (verbatim, ≥80px)
  const headTop = y + Math.round(h * 0.12) + kickerH + 16;
  const headAvailH = h - (headTop - y) - 48;
  const { fontSize: headSize } = fitTextBlock(content.headline, {
    width: w - PAD * 2, height: Math.max(headAvailH, 44 * 1.02),
    maxSize: 120, minSize: 44, lineHeight: 1.02
  });
  const headH = estTextHeight(content.headline, headSize, w - PAD * 2, 1.02);
  o.push(textbox({
    text: content.headline,
    x: x + PAD, y: headTop,
    w: w - PAD * 2, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_INK, lineHeight: 1.02, align: 'left',
    layerRole: 'headline', bgRef: DARK_PANEL
  }));

  return headTop + headH;
}

// ── detail row (one block = label chip + value/text) ─────────────────────────

/**
 * One detail row: dark card with a yellow label chip and value text.
 * BOTH label AND text carry msgId + fieldRef per the multi-field spec.
 */
function detailRow(o, b, palette, fonts, { x, y, w, h }) {
  // Card background
  o.push(rect({
    x, y, w, h,
    fill: DARK_PANEL_2, rx: CARD_RX,
    stroke: palette.primary, strokeWidth: 1,
    layerRole: 'background'
  }));

  // Left yellow accent stripe
  o.push(rect({
    x: x + CARD_RX, y, w: w - CARD_RX * 2, h: 3,
    fill: palette.primary, opacity: 0.70,
    layerRole: 'decor'
  }));

  const innerPad = 24;
  const chipMaxW = Math.min(240, Math.round(w * 0.30));
  const chipMaxH = Math.min(56, Math.round(h * 0.52));

  // Label chip — bound (fieldRef: 'label')
  const chipY = y + Math.round((h - Math.min(chipMaxH, 48)) / 2);
  const [pill, labelTb] = chip({
    text: b.label || 'INFO',
    x: x + innerPad, y: chipY,
    fontSize: 24, bg: palette.primary, color: DARK_BASE,
    font: fonts.head, maxW: chipMaxW, maxH: chipMaxH,
    msgId: b.id
  });
  o.push(pill);
  o.push({ ...labelTb, fieldRef: 'label' });

  // Value/text — right of chip (fieldRef: 'text')
  const chipRight = pill.left + pill.width + 24;
  const textX = chipRight;
  const textW = x + w - textX - innerPad;
  const textH = h - innerPad * 1.5;

  const { fontSize: msgSize } = fitTextBlock(b.text, {
    width: textW, height: Math.max(textH, 38 * 1.22),
    maxSize: 52, minSize: 38, lineHeight: 1.22
  });
  const msgActualH = estTextHeight(b.text, msgSize, textW, 1.22);
  const msgY = y + Math.round((h - Math.min(textH, msgActualH)) / 2);
  o.push({
    ...textbox({
      text: b.text,
      x: textX, y: msgY,
      w: textW, fontSize: msgSize,
      fontFamily: fonts.body, fontWeight: '700',
      fill: DARK_INK, lineHeight: 1.22,
      layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL_2
    }),
    fieldRef: 'text'
  });
}

/** Vertically stacked detail rows distributed evenly within a zone. */
function detailStack(o, blocks, palette, fonts, { x, y, w, h }) {
  const n = Math.max(blocks.length, 1);
  const rowH = Math.floor((h - GAP * (n - 1)) / n);
  blocks.forEach((b, i) => {
    detailRow(o, b, palette, fonts, {
      x, y: y + i * (rowH + GAP), w, h: rowH
    });
  });
}

// ── CTA bar with QR imageSlot ─────────────────────────────────────────────────

/**
 * Bottom CTA bar: dark ground, QR imageSlot on the right, callToAction text
 * on the left. QR is the content imageSlot (imageSlots:1).
 */
function ctaBar(o, text, palette, fonts, W, y, h, qrSize) {
  // Dark bar background
  o.push(rect({ x: 0, y, w: W, h, fill: DARK_PANEL, layerRole: 'background' }));

  // Yellow top accent rule
  o.push(rect({ x: 0, y, w: W, h: 5, fill: palette.primary, layerRole: 'decor' }));

  // QR imageSlot — right side, text-free
  const qrActual = Math.min(qrSize, h - 12);
  const qrPad = Math.max(6, Math.round((h - qrActual) / 2));
  const qrX = Math.min(W - qrPad - qrActual, W - qrActual - 8);
  const qrY = y + qrPad;
  o.push(imageSlot({
    slotId: 'slot-qr',
    x: qrX, y: qrY, w: qrActual, h: qrActual,
    styleHint: 'QR code for webinar registration or event link, clean dark on white, square format',
    stroke: palette.primary, rx: 10
  }));

  // CTA text — left of QR, verbatim
  const textX = PAD;
  const textW = qrX - PAD - 24;
  const size = fitFontSize(text, { width: textW, height: h - 36, maxSize: 52, minSize: 28, lineHeight: 1.2 });
  const th = estTextHeight(text, size, textW, 1.2);
  o.push(textbox({
    text, x: textX, y: y + Math.round((h - th) / 2),
    w: textW, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_INK, align: 'left', lineHeight: 1.2,
    layerRole: 'cta', bgRef: DARK_PANEL
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
    styleHint: 'dark professional event background: deep charcoal, subtle geometric grid or circuit pattern, no text, modern corporate atmosphere',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ── headline zone (top) ───────────────────────────────────────────────────
  headlineZone(o, content, palette, fonts, {
    x: 0, y: 0, w: W, h: HEADER_H_P
  });

  // ── subheadline pill band ─────────────────────────────────────────────────
  const subY = HEADER_H_P;
  subheadlineBand(o, content, palette, fonts, {
    x: 0, y: subY, w: W, h: SUB_H_P
  });

  // ── detail stack (blocks) ─────────────────────────────────────────────────
  const stackTop = subY + SUB_H_P + GAP;
  const stackBottom = H - CTA_H_P - GAP;
  const stackH = stackBottom - stackTop;
  const blocks = content.blocks || [];

  detailStack(o, blocks, palette, fonts, {
    x: PAD, y: stackTop, w: W - PAD * 2, h: stackH
  });

  // ── CTA bar (bottom) ──────────────────────────────────────────────────────
  ctaBar(o, content.callToAction, palette, fonts, W, H - CTA_H_P, CTA_H_P, QR_SIZE_P);

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
    styleHint: 'dark professional event background: deep charcoal, subtle geometric grid or circuit pattern, no text, modern corporate atmosphere',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ── two-column layout ─────────────────────────────────────────────────────
  // Left: headline zone + subheadline band stacked, full-height left column
  // Right: detail rows (blocks) + CTA at bottom right

  const splitX = Math.round(W * 0.45);
  const leftW = splitX;
  const rightX = splitX + GAP;
  const rightW = W - rightX - PAD;

  // Left column: headline zone (top) + subheadline band (below)
  headlineZone(o, content, palette, fonts, {
    x: 0, y: 0, w: leftW, h: HEADER_H_L
  });
  subheadlineBand(o, content, palette, fonts, {
    x: 0, y: HEADER_H_L, w: leftW, h: SUB_H_L
  });

  // Left column: ambient dot grid decor below subheadline band
  const leftBottom = HEADER_H_L + SUB_H_L;
  const leftRemainH = H - CTA_H_L - leftBottom - GAP;
  if (leftRemainH > 80) {
    o.push(rect({
      x: 0, y: leftBottom, w: leftW, h: leftRemainH,
      fill: DARK_PANEL, layerRole: 'background'
    }));
    o.push(...dotGrid({
      x: Math.round(leftW * 0.15), y: leftBottom + Math.round(leftRemainH * 0.25),
      cols: 6, rows: 4, gap: 48, dotR: 4,
      color: palette.primary, intensity: 0.40
    }));
    // Secondary info label
    const infoText = 'Cybersecurity awareness — building a resilient digital future together.';
    const infoSize = fitFontSize(infoText, { width: leftW - PAD * 2, height: leftRemainH - 48, maxSize: 32, minSize: 22, lineHeight: 1.3 });
    const infoH = estTextHeight(infoText, infoSize, leftW - PAD * 2, 1.3);
    o.push(textbox({
      text: infoText,
      x: PAD, y: leftBottom + Math.round((leftRemainH - infoH) / 2),
      w: leftW - PAD * 2, fontSize: infoSize,
      fontFamily: fonts.body, fontWeight: '600',
      fill: DARK_INK_DIM, lineHeight: 1.3, align: 'left',
      layerRole: 'decor', bgRef: DARK_PANEL
    }));
  }

  // Right column: detail stack
  const stackTop = PAD;
  const stackBottom = H - CTA_H_L - GAP;
  const stackH = stackBottom - stackTop;
  const blocks = content.blocks || [];

  detailStack(o, blocks, palette, fonts, {
    x: rightX, y: stackTop, w: rightW, h: stackH
  });

  // Full-width CTA bar at bottom
  ctaBar(o, content.callToAction, palette, fonts, W, H - CTA_H_L, CTA_H_L, QR_SIZE_L);

  return canvas;
}

// ── portrait preview ──────────────────────────────────────────────────────────

function previewPortrait(palette) {
  const W = 1414;
  const H = 2000;
  const n = 3; // preview uses min block count

  const stackTop = HEADER_H_P + SUB_H_P + GAP;
  const stackBottom = H - CTA_H_P - GAP;
  const stackH = stackBottom - stackTop;
  const rowH = Math.floor((stackH - GAP * (n - 1)) / n);

  const parts = [
    // headline zone
    pvRect(0, 0, pv(W), pv(HEADER_H_P), DARK_PANEL),
    // meshGlow accent (top-right)
    pvRect(pv(W * 0.62), pv(HEADER_H_P * 0.05), pv(W * 0.38), pv(HEADER_H_P * 0.5), palette.primary, { rx: 999, opacity: 0.09 }),
    pvRect(pv(W * 0.72), pv(HEADER_H_P * 0.10), pv(W * 0.28), pv(HEADER_H_P * 0.36), palette.primary, { rx: 999, opacity: 0.07 }),
    // kicker bar
    pvBars({ x: pv(PAD), y: pv(HEADER_H_P * 0.14), w: pv(W * 0.35), lines: 1, barH: 5, gap: 0, fill: palette.primary }),
    // headline bars
    pvBars({ x: pv(PAD), y: pv(HEADER_H_P * 0.32), w: pv(W - PAD * 2), lines: 3, barH: 14, gap: 8, fill: DARK_INK }),
    // yellow accent bottom rule
    pvRect(0, pv(HEADER_H_P - 6), pv(W), pv(6), palette.primary),

    // subheadline pill band
    pvRect(0, pv(HEADER_H_P), pv(W), pv(SUB_H_P), palette.primary),
    pvBars({ x: pv(PAD), y: pv(HEADER_H_P + SUB_H_P * 0.33), w: pv(W * 0.40), lines: 1, barH: 10, gap: 0, fill: DARK_BASE })
  ];

  // detail rows
  for (let i = 0; i < n; i++) {
    const py = stackTop + i * (rowH + GAP);
    parts.push(pvRect(pv(PAD), pv(py), pv(W - PAD * 2), pv(rowH), DARK_PANEL_2, { rx: 3, stroke: palette.primary }));
    parts.push(pvRect(pv(PAD + CARD_RX), pv(py), pv(W - PAD * 2 - CARD_RX * 2), pv(3), palette.primary, { opacity: 0.70 }));
    parts.push(pvRect(pv(PAD + 24), pv(py + Math.round(rowH * 0.24)), pv(70), pv(18), palette.primary, { rx: 9 }));
    parts.push(pvBars({ x: pv(PAD + 104), y: pv(py + Math.round(rowH * 0.28)), w: pv(W - PAD * 2 - 128), lines: 2, barH: 4, gap: 3, fill: DARK_INK }));
  }

  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H_P), pv(W), pv(CTA_H_P), DARK_PANEL));
  parts.push(pvRect(0, pv(H - CTA_H_P), pv(W), pv(5), palette.primary));
  parts.push(pvBars({ x: pv(PAD), y: pv(H - CTA_H_P + 56), w: pv(W * 0.52), lines: 1, barH: 9, gap: 0, fill: DARK_INK }));
  parts.push(pvSlot(pv(W - PAD - QR_SIZE_P), pv(H - CTA_H_P + 10), pv(QR_SIZE_P), pv(QR_SIZE_P - 20), palette.primary));

  return svgWrapO(parts, DARK_BASE, 'portrait');
}

// ── landscape preview ─────────────────────────────────────────────────────────

function previewLandscape(palette) {
  const W = 2000;
  const H = 1414;
  const n = 3;

  const splitX = Math.round(W * 0.45);
  const rightX = splitX + GAP;
  const rightW = W - rightX - PAD;

  const stackTop = PAD;
  const stackBottom = H - CTA_H_L - GAP;
  const stackH = stackBottom - stackTop;
  const rowH = Math.floor((stackH - GAP * (n - 1)) / n);

  const parts = [
    // left column: headline zone
    pvRect(0, 0, pv(splitX), pv(HEADER_H_L), DARK_PANEL),
    pvRect(pv(splitX * 0.58), pv(HEADER_H_L * 0.06), pv(splitX * 0.45), pv(HEADER_H_L * 0.48), palette.primary, { rx: 999, opacity: 0.09 }),
    pvBars({ x: pv(PAD), y: pv(HEADER_H_L * 0.16), w: pv(splitX * 0.42), lines: 1, barH: 4, gap: 0, fill: palette.primary }),
    pvBars({ x: pv(PAD), y: pv(HEADER_H_L * 0.34), w: pv(splitX - PAD * 2), lines: 2, barH: 11, gap: 6, fill: DARK_INK }),
    pvRect(0, pv(HEADER_H_L - 6), pv(splitX), pv(6), palette.primary),

    // left column: subheadline band
    pvRect(0, pv(HEADER_H_L), pv(splitX), pv(SUB_H_L), palette.primary),
    pvBars({ x: pv(PAD), y: pv(HEADER_H_L + SUB_H_L * 0.34), w: pv(splitX * 0.44), lines: 1, barH: 8, gap: 0, fill: DARK_BASE }),

    // left column: decor remainder
    pvRect(0, pv(HEADER_H_L + SUB_H_L), pv(splitX), pv(H - CTA_H_L - HEADER_H_L - SUB_H_L - GAP), DARK_PANEL)
  ];

  // right column: detail rows
  for (let i = 0; i < n; i++) {
    const py = stackTop + i * (rowH + GAP);
    parts.push(pvRect(pv(rightX), pv(py), pv(rightW), pv(rowH), DARK_PANEL_2, { rx: 3, stroke: palette.primary }));
    parts.push(pvRect(pv(rightX + CARD_RX), pv(py), pv(rightW - CARD_RX * 2), pv(3), palette.primary, { opacity: 0.70 }));
    parts.push(pvRect(pv(rightX + 24), pv(py + Math.round(rowH * 0.24)), pv(64), pv(16), palette.primary, { rx: 8 }));
    parts.push(pvBars({ x: pv(rightX + 100), y: pv(py + Math.round(rowH * 0.26)), w: pv(rightW - 120), lines: 2, barH: 4, gap: 3, fill: DARK_INK }));
  }

  // full-width CTA bar
  parts.push(pvRect(0, pv(H - CTA_H_L), PV_LAND_W, pv(CTA_H_L), DARK_PANEL));
  parts.push(pvRect(0, pv(H - CTA_H_L), PV_LAND_W, pv(5), palette.primary));
  parts.push(pvBars({ x: pv(PAD), y: pv(H - CTA_H_L + 46), w: pv(W * 0.44), lines: 1, barH: 8, gap: 0, fill: DARK_INK }));
  parts.push(pvSlot(pv(W - PAD - QR_SIZE_L), pv(H - CTA_H_L + 10), pv(QR_SIZE_L), pv(QR_SIZE_L - 20), palette.primary));

  return svgWrapO(parts, DARK_BASE, 'landscape');
}

// ── export ────────────────────────────────────────────────────────────────────

export default {
  id: 'webinar-invite',
  name: 'Webinar Invite',
  style: 'statement',
  description: 'A dark event/invite card reinterpreting the AB InBev GISP Awareness Webinar poster: a bold headline zone with ambient decor, a yellow "What\'s Inside" subheadline band, stacked detail rows (each showing a label chip + value text for date/duration/speaker/etc.), a QR code imageSlot, and a verbatim callToAction footer. Portrait flows as a single column; landscape splits the headline zone left and detail rows right.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 6 },
    blocks: { kind: 'sequence', min: 3, max: 4, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 12 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
