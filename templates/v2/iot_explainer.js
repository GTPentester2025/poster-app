// v2 template — iot-explainer (style: qa, source: 15.html "Exploitation of
// IoT Vulnerabilities"). Dark landscape-first explainer: a vivid brand-yellow
// headline, then N question→answer cards stacked in portrait / split into two
// columns in landscape, plus a QR imageSlot CTA. Design reinterprets the
// source's split-column dark layout at poster scale.
//
// Source anatomy (15.html):
//   Left column  → full-bleed IoT photo + angled slant (→ backgroundImageSlot)
//   Right column → yellow title, 3 Q&A info blocks, threats pills, protect grid
//   Bottom-left  → QR code (→ imageSlot slotId:'slot-qr')
//   Bottom-right → CTA text
//
// v2 reinterpretation:
//   • Dark base (DARK_BASE/DARK_PANEL) throughout — no hardcoded brand hex.
//   • Yellow = palette.primary; accent = palette.accent.
//   • Each block: a left-aligned yellow QUESTION line + a body ANSWER line in
//     DARK_INK on a DARK_PANEL card. Both carry msgId + fieldRef per block.
//   • Tight left-aligned headline with an accent underline.
//   • Portrait: 2-wide DEVICE-CARD GRID (staggered column heights), QR slot
//     centred above the CTA bar.
//   • Landscape: a single 1-row × N-column strip of cards under the headline,
//     QR slot top-right beside the headline, CTA bar.

import {
  textbox, rect, imageSlot, backgroundImageSlot,
  fitFontSize, fitTextBlock, estTextHeight,
  pv, pvRect, pvBars, pvSlot, pvCircle,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims,
  meshGlow, signalArcs, dotGrid, legibilityScrim,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM,
  svgWrapO, PV_LAND_W,
} from './decor.js';

// ── shared layout constants ───────────────────────────────────────────────────

const PAD = 96;          // canvas-edge padding (portrait)
const PAD_L = 80;        // canvas-edge padding (landscape)
const CARD_RX = 20;      // card corner radius
const Q_PAD_V = 20;      // question top padding inside card
const A_PAD_V = 16;      // answer top padding below question
const CARD_PAD_H = 36;   // horizontal text inset inside card

// ── shared helpers ────────────────────────────────────────────────────────────

/** Full-width CTA bar at the bottom. */
function ctaBar(o, text, palette, fonts, W, y, h = 148) {
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - PAD * 2, height: h - 40, maxSize: 44, minSize: 30 });
  const th = estTextHeight(text, size, W - PAD * 2, 1.18);
  o.push(textbox({
    text, x: PAD, y: y + Math.round((h - th) / 2),
    w: W - PAD * 2, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: DARK_BASE, align: 'center', layerRole: 'cta', bgRef: palette.primary
  }));
}

/**
 * Headline zone — tight, left-aligned, with an accent underline bar between
 * headline and subheadline. Returns y cursor after all text.
 */
function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const { fontSize: headSize, height: headH } = fitTextBlock(content.headline, {
    width: w, height: 320, maxSize, minSize: 80, lineHeight: 1.0
  });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.primary,
    lineHeight: 1.0, layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + headH + 14;

  // accent underline anchoring the left-aligned headline
  o.push(rect({
    x, y: cursor, w: 260, h: 10,
    fill: palette.accent || palette.primary, rx: 5, layerRole: 'decor'
  }));
  cursor += 26;

  if (content.subheadline) {
    const { fontSize: subSize, height: subH } = fitTextBlock(content.subheadline, {
      width: w, height: 100, maxSize: 40, minSize: 28, lineHeight: 1.3
    });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM, lineHeight: 1.3,
      layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += subH + 12;
  }
  return cursor;
}

/**
 * One Q&A card: dark panel, yellow question line, DARK_INK answer body.
 * Both text objects carry msgId === b.id and their respective fieldRef.
 * budgetH is the REAL remaining vertical space for this card (card height
 * minus top/bottom paddings), so fitFontSize never exceeds its zone.
 * Returns card bottom y.
 */
function qaCard(o, b, palette, fonts, { x, y, w, budgetH }) {
  const textW = w - CARD_PAD_H * 2;

  // Real budget inside the card after vertical paddings (top + bottom of card)
  const innerBudget = Math.max(80, budgetH - Q_PAD_V - 16); // 16 = bottom pad

  // Question line — yellow, bold; cap at 38% of inner budget
  const qBudget = Math.max(48, Math.round(innerBudget * 0.38));
  const qSize = fitFontSize(b.question, {
    width: textW, height: qBudget, maxSize: 46, minSize: 16, lineHeight: 1.25
  });
  const qH = Math.round(estTextHeight(b.question, qSize, textW, 1.25));

  // Answer body: whatever remains after question + separator gap
  const aBudget = Math.max(48, innerBudget - qH - A_PAD_V - 10);
  const aSize = fitFontSize(b.answer, {
    width: textW, height: aBudget, maxSize: 44, minSize: 16, lineHeight: 1.3
  });
  // Cap aH to aBudget so the card never exceeds its zone allocation even at the 38px floor
  const aH = Math.min(Math.round(estTextHeight(b.answer, aSize, textW, 1.3)), aBudget);

  // Actual card height = padding + question + separator gap + answer + bottom pad
  const cardH = Q_PAD_V + qH + A_PAD_V + aH + 16;

  // Card panel — yellow left accent bar
  o.push(rect({
    x, y, w, h: cardH, fill: DARK_PANEL, rx: CARD_RX,
    layerRole: 'background', msgId: b.id
  }));
  // Yellow left accent bar
  o.push(rect({
    x, y: y + CARD_RX / 2, w: 8, h: cardH - CARD_RX,
    fill: palette.primary, rx: 4, layerRole: 'decor'
  }));

  // Question text — layerRole 'message', fieldRef 'question'
  o.push({
    ...textbox({
      text: b.question,
      x: x + CARD_PAD_H, y: y + Q_PAD_V,
      w: textW, fontSize: qSize,
      fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
      lineHeight: 1.25, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'question'
  });

  // Thin separator between question and answer
  o.push(rect({
    x: x + CARD_PAD_H, y: y + Q_PAD_V + qH + Math.round(A_PAD_V / 2) - 1,
    w: textW, h: 2, fill: DARK_PANEL_2, layerRole: 'decor'
  }));

  // Answer text — layerRole 'message', fieldRef 'answer'
  o.push({
    ...textbox({
      text: b.answer,
      x: x + CARD_PAD_H, y: y + Q_PAD_V + qH + A_PAD_V,
      w: textW, fontSize: aSize,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK,
      lineHeight: 1.3, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'answer'
  });

  return y + cardH;
}

// ── portrait build ────────────────────────────────────────────────────────────

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  // 1. Background slot + scrim
  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'IoT devices network — dark cybersecurity tech background, circuits, no text',
    stroke: palette.primary
  }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // 2. Atmosphere decor
  o.push(...meshGlow({ spots: [
    { x: 1180, y: 280, r: 380, color: palette.primary },
    { x: 200, y: 1700, r: 320, color: palette.accent }
  ], intensity: 0.70 }));
  o.push(...signalArcs({ x: W, y: 0, r: 480, rings: 4, color: palette.primary, strokeWidth: 10, intensity: 0.75 }));
  o.push(...dotGrid({ x: 80, y: 1100, cols: 4, rows: 4, gap: 56, dotR: 4, color: palette.primary, intensity: 0.45 }));

  // 3. Headline zone — tightened, left-aligned, accent underline
  const zoneW = W - PAD * 2;
  let cursor = headlineZone(o, content, palette, fonts, {
    x: PAD, y: 96, w: zoneW, maxSize: 112
  });
  cursor = Math.max(cursor, 400);

  // 4. Device-card grid — 2-wide, staggered column heights
  const blocks = content.blocks || [];
  const gridTop = cursor + 24;

  // Reserve space: QR slot (160px) + CTA bar (148px) + gaps
  const stackBottom = H - 148 - 160 - 56;
  const colGap = 28;
  const colW = Math.floor((zoneW - colGap) / 2);
  const STAGGER = 44; // right column starts lower for a staggered grid rhythm
  const gapBetween = 24;

  const cols = [[], []];
  blocks.forEach((b, i) => cols[i % 2].push(b));

  cols.forEach((colBlocks, ci) => {
    if (!colBlocks.length) return;
    const colX = PAD + ci * (colW + colGap);
    let colCursor = gridTop + ci * STAGGER;
    const m = colBlocks.length;
    const avail = stackBottom - colCursor - 12;
    const cardBudget = Math.round((avail - gapBetween * (m - 1)) / m);
    colBlocks.forEach((b) => {
      const bottom = qaCard(o, b, palette, fonts, {
        x: colX, y: colCursor, w: colW, budgetH: cardBudget
      });
      colCursor = bottom + gapBetween;
    });
  });

  // 5. QR imageSlot — centred between stack and CTA bar
  const qrY = H - 148 - 152 - 8;
  const qrSize = 144;
  o.push(imageSlot({
    slotId: 'slot-qr',
    x: Math.round(W / 2 - qrSize / 2), y: qrY,
    w: qrSize, h: qrSize,
    styleHint: 'QR code linking to IoT security resource or cybersecurity portal',
    stroke: palette.primary, rx: 12
  }));

  // 6. CTA bar
  ctaBar(o, content.callToAction, palette, fonts, W, H - 148);
  return canvas;
}

// ── landscape build ───────────────────────────────────────────────────────────

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  // 1. Background slot + scrim
  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'IoT devices network — dark cybersecurity tech background, circuits, no text',
    stroke: palette.primary
  }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // 2. Atmosphere decor (source = landscape 16:9 dark poster)
  o.push(...meshGlow({ spots: [
    { x: 1760, y: 200, r: 360, color: palette.primary },
    { x: 240, y: 1200, r: 300, color: palette.accent }
  ], intensity: 0.70 }));
  o.push(...signalArcs({ x: W, y: 0, r: 440, rings: 4, color: palette.primary, strokeWidth: 10, intensity: 0.75 }));
  o.push(...dotGrid({ x: 60, y: 900, cols: 4, rows: 3, gap: 52, dotR: 4, color: palette.primary, intensity: 0.45 }));

  // 3. QR imageSlot — top-right beside the headline
  const zoneW = W - PAD_L * 2;
  const qrSize = 132;
  o.push(imageSlot({
    slotId: 'slot-qr',
    x: W - PAD_L - qrSize, y: 72,
    w: qrSize, h: qrSize,
    styleHint: 'QR code linking to IoT security resource or cybersecurity portal',
    stroke: palette.primary, rx: 12
  }));

  // 4. Headline zone — tight, left-aligned, clear of the QR slot
  let cursor = headlineZone(o, content, palette, fonts, {
    x: PAD_L, y: 72, w: zoneW - qrSize - 48, maxSize: 100
  });
  cursor = Math.max(cursor, 320);

  // 5. Device-card strip — one row, one column per block
  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const colGap = 28;
  const colW = Math.floor((zoneW - colGap * (n - 1)) / n);
  const stripTop = cursor + 24;
  const stripBottom = H - 128 - 24;

  blocks.forEach((b, i) => {
    qaCard(o, b, palette, fonts, {
      x: PAD_L + i * (colW + colGap), y: stripTop, w: colW,
      budgetH: stripBottom - stripTop
    });
  });

  // 6. CTA bar
  ctaBar(o, content.callToAction, palette, fonts, W, H - 128, 128);
  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────

function pvCard(parts, palette, { x, y, w, h }) {
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), DARK_PANEL, { rx: 3 }));
  parts.push(pvRect(pv(x), pv(y + 3), 1.2, pv(h - 6), palette.primary));
  parts.push(pvBars({ x: pv(x + CARD_PAD_H), y: pv(y + Q_PAD_V), w: pv(w - CARD_PAD_H * 2), lines: 1, barH: 4.5, gap: 3, fill: palette.primary }));
  parts.push(pvBars({ x: pv(x + CARD_PAD_H), y: pv(y + Q_PAD_V + 40), w: pv(w - CARD_PAD_H * 2), lines: 2, barH: 4, gap: 3, fill: DARK_INK }));
}

function previewPortrait(palette) {
  const W = 1414;
  const H = 2000;
  const zoneW = W - PAD * 2;
  const colGap = 28;
  const colW = Math.floor((zoneW - colGap) / 2);
  const gridTop = 448;

  const parts = [
    pvCircle(pv(1180), pv(280), pv(380), palette.primary, { opacity: 0.07 }),
    pvCircle(pv(200), pv(1700), pv(320), palette.accent, { opacity: 0.06 }),
    // headline — tight, left-aligned, with accent underline
    pvBars({ x: pv(PAD), y: pv(104), w: pv(zoneW), lines: 2, barH: 9, gap: 5, fill: palette.primary }),
    pvRect(pv(PAD), pv(344), pv(260), 1.5, palette.accent || palette.primary, { rx: 0.7 })
  ];

  // 2-wide device grid, staggered column heights
  const colHeights = [[500, 560], [560, 470]];
  for (let ci = 0; ci < 2; ci++) {
    const colX = PAD + ci * (colW + colGap);
    let y = gridTop + ci * 44;
    for (const h of colHeights[ci]) {
      pvCard(parts, palette, { x: colX, y, w: colW, h });
      y += h + 24;
    }
  }

  // QR slot
  const qrY = H - 148 - 152 - 8;
  parts.push(pvSlot(pv(W / 2 - 72), pv(qrY), pv(144), pv(144), palette.primary));
  // CTA bar
  parts.push(pvRect(0, pv(H - 148), PV_LAND_W, pv(148), palette.primary));

  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000;
  const H = 1414;
  const zoneW = W - PAD_L * 2;
  const n = 4; // max blocks preview
  const colGap = 28;
  const colW = Math.floor((zoneW - colGap * (n - 1)) / n);
  const qrSize = 132;

  const parts = [
    pvCircle(pv(1760), pv(200), pv(360), palette.primary, { opacity: 0.07 }),
    pvCircle(pv(240), pv(1200), pv(300), palette.accent, { opacity: 0.06 }),
    // headline — tight, left-aligned, with accent underline
    pvBars({ x: pv(PAD_L), y: pv(80), w: pv(zoneW - qrSize - 48), lines: 2, barH: 8, gap: 5, fill: palette.primary }),
    pvRect(pv(PAD_L), pv(290), pv(260), 1.5, palette.accent || palette.primary, { rx: 0.7 }),
    // QR slot — top-right beside the headline
    pvSlot(pv(W - PAD_L - qrSize), pv(72), pv(qrSize), pv(qrSize), palette.primary)
  ];

  // 1-row × N-column device-card strip under the headline
  for (let i = 0; i < n; i++) {
    pvCard(parts, palette, { x: PAD_L + i * (colW + colGap), y: 420, w: colW, h: 700 });
  }

  // CTA bar
  parts.push(pvRect(0, pv(H - 128), PV_LAND_W, pv(128), palette.primary));

  return svgWrapO(parts, DARK_BASE, 'landscape');
}

// ── export ────────────────────────────────────────────────────────────────────

export default {
  id: 'iot-explainer',
  name: 'IoT Explainer',
  style: 'qa',
  description: 'Dark Q&A explainer for IoT security: tight brand-yellow headline with accent underline, question→answer device cards in a staggered 2-wide grid (portrait) or a single row of columns (landscape), QR imageSlot CTA. Reinterprets the IoT Vulnerabilities dark poster at poster scale.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'qa-pairs', min: 3, max: 4, fields: ['question', 'answer'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
