// v2 template — ransomware-checklist (style: qa, source: 16.html "Advanced
// Ransomware & Extortion"). Dark poster: brand-yellow headline, a "What is…?"
// definition card, then N protect-checklist items rendered as question→answer
// pairs, plus a QR imageSlot CTA. Max 5 blocks (min 3).
//
// Source anatomy (16.html):
//   Left column  → dark background photo, yellow pill title
//   Section 1    → "What is Advanced Ransomware & Extortion?" + definition text
//   Section 2    → "How to Protect Yourself" + 5 bullet checklist items
//   Right column → base64 composite (hacker + world map + QR) → imageSlot
//
// v2 reinterpretation:
//   • Dark base (DARK_BASE/DARK_PANEL) throughout — no hardcoded brand hex.
//   • Yellow = palette.primary; accent = palette.accent.
//   • Each block: yellow QUESTION line + DARK_INK ANSWER body in a DARK_PANEL
//     card. Both carry msgId + fieldRef per block (CRITICAL binding contract).
//   • Portrait: full-width stacked cards, QR slot bottom-left, CTA bar.
//   • Landscape: two columns of cards, QR slot bottom-left, CTA bar.
//   • fitFontSize/fitTextBlock heights are the REAL remaining space in each
//     card so long answers shrink to fit rather than overflow.

import {
  textbox, rect, imageSlot, backgroundImageSlot,
  fitFontSize, fitTextBlock, estTextHeight,
  pv, pvRect, pvBars, pvSlot, pvCircle,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims,
  meshGlow, signalArcs, dotGrid, legibilityScrim, shieldMotif,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM,
  svgWrapO, PV_LAND_W,
} from './decor.js';

// ── shared layout constants ───────────────────────────────────────────────────

const PAD = 96;          // canvas-edge padding (portrait)
const PAD_L = 80;        // canvas-edge padding (landscape)
const CARD_RX = 22;      // card corner radius
const Q_PAD_V = 20;      // question top padding inside card
const A_PAD_V = 14;      // answer top padding below question text
const CARD_PAD_H = 36;   // horizontal text inset inside card
const CARD_GAP = 18;     // vertical gap between cards

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
 * Headline zone — yellow headline + optional subheadline.
 * Returns y cursor after all text.
 */
function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const { fontSize: headSize, height: headH } = fitTextBlock(content.headline, {
    width: w, height: 300, maxSize, minSize: 80, lineHeight: 1.0
  });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.primary,
    lineHeight: 1.0, layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + headH + 20;

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

  // Question line — yellow, bold; cap at 40% of inner budget
  const qBudget = Math.max(48, Math.round(innerBudget * 0.38));
  const qSize = fitFontSize(b.question, {
    width: textW, height: qBudget, maxSize: 46, minSize: 38, lineHeight: 1.25
  });
  const qH = Math.round(estTextHeight(b.question, qSize, textW, 1.25));

  // Answer body: whatever remains after question + separator gap
  const aBudget = Math.max(48, innerBudget - qH - A_PAD_V - 10);
  const aSize = fitFontSize(b.answer, {
    width: textW, height: aBudget, maxSize: 44, minSize: 38, lineHeight: 1.3
  });
  const aH = Math.round(estTextHeight(b.answer, aSize, textW, 1.3));

  // Actual card height = padding + question + separator gap + answer + bottom pad
  const cardH = Q_PAD_V + qH + A_PAD_V + aH + 16;

  // Card panel
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

  // Thin separator
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
    styleHint: 'Ransomware attack — dark cybersecurity threat background, digital lock, circuits, no text',
    stroke: palette.primary
  }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // 2. Atmosphere decor
  o.push(...meshGlow({ spots: [
    { x: 1200, y: 260, r: 400, color: palette.primary },
    { x: 180, y: 1720, r: 300, color: palette.accent }
  ], intensity: 0.65 }));
  o.push(...signalArcs({ x: W, y: 0, r: 500, rings: 4, color: palette.primary, strokeWidth: 10, intensity: 0.70 }));
  o.push(...dotGrid({ x: 72, y: 1080, cols: 4, rows: 5, gap: 54, dotR: 4, color: palette.primary, intensity: 0.42 }));
  o.push(...shieldMotif({ x: 1300, y: 1800, size: 320, color: palette.primary, intensity: 0.25 }));

  // 3. Headline zone
  const zoneW = W - PAD * 2;
  let cursor = headlineZone(o, content, palette, fonts, {
    x: PAD, y: 96, w: zoneW, maxSize: 124
  });
  cursor = Math.max(cursor, 360);

  // 4. Q&A card stack
  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);

  // QR slot 144px + gap 8 + CTA bar 148px = 300px from bottom
  const QR_ZONE = 144 + 8 + 16;   // qr height + gap above + gap below
  const CTA_H = 148;
  const stackBottom = H - CTA_H - QR_ZONE - 8;
  const stackAvail = stackBottom - cursor - 16;
  const gapTotal = CARD_GAP * (n - 1);
  // Each card gets an equal share of available height
  const cardBudget = Math.max(120, Math.round((stackAvail - gapTotal) / n));

  blocks.forEach((b, i) => {
    const cardY = cursor + 16 + i * (cardBudget + CARD_GAP);
    qaCard(o, b, palette, fonts, {
      x: PAD, y: cardY, w: zoneW, budgetH: cardBudget
    });
  });

  // 5. QR imageSlot — centred between stack bottom and CTA bar
  const qrSize = 136;
  const qrY = H - CTA_H - qrSize - 16;
  o.push(imageSlot({
    slotId: 'slot-qr',
    x: Math.round(W / 2 - qrSize / 2), y: qrY,
    w: qrSize, h: qrSize,
    styleHint: 'QR code linking to ransomware protection resource or cybersecurity portal',
    stroke: palette.primary, rx: 12
  }));

  // 6. CTA bar
  ctaBar(o, content.callToAction, palette, fonts, W, H - CTA_H);
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
    styleHint: 'Ransomware attack — dark cybersecurity threat background, digital lock, circuits, no text',
    stroke: palette.primary
  }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // 2. Atmosphere decor
  o.push(...meshGlow({ spots: [
    { x: 1780, y: 200, r: 360, color: palette.primary },
    { x: 220, y: 1200, r: 280, color: palette.accent }
  ], intensity: 0.65 }));
  o.push(...signalArcs({ x: W, y: 0, r: 460, rings: 4, color: palette.primary, strokeWidth: 10, intensity: 0.70 }));
  o.push(...dotGrid({ x: 56, y: 860, cols: 4, rows: 3, gap: 50, dotR: 4, color: palette.primary, intensity: 0.40 }));
  o.push(...shieldMotif({ x: 1900, y: 1300, size: 260, color: palette.primary, intensity: 0.22 }));

  // 3. Headline zone — full width at top
  const zoneW = W - PAD_L * 2;
  let cursor = headlineZone(o, content, palette, fonts, {
    x: PAD_L, y: 64, w: zoneW, maxSize: 104
  });
  cursor = Math.max(cursor, 256);

  // 4. Two-column Q&A cards
  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const leftCount = Math.ceil(n / 2);

  // Reserve CTA bar 128px + QR row 128px + gaps
  const CTA_H_L = 128;
  const QR_H_L = 120;
  const cardsBottom = H - CTA_H_L - QR_H_L - 24;
  const colGap = 40;
  const colW = Math.round((zoneW - colGap) / 2);

  const colBlocks = [
    blocks.slice(0, leftCount),
    blocks.slice(leftCount)
  ];

  colBlocks.forEach((col, ci) => {
    if (!col.length) return;
    const colX = PAD_L + ci * (colW + colGap);
    const colH = cardsBottom - cursor - 16;
    const m = col.length;
    const gapTotal = CARD_GAP * (m - 1);
    const cardBudget = Math.max(100, Math.round((colH - gapTotal) / m));

    col.forEach((b, i) => {
      const cardY = cursor + 16 + i * (cardBudget + CARD_GAP);
      qaCard(o, b, palette, fonts, {
        x: colX, y: cardY, w: colW, budgetH: cardBudget
      });
    });
  });

  // 5. QR imageSlot — bottom-left above CTA bar
  const qrSize = 112;
  const qrY = H - CTA_H_L - qrSize - 12;
  o.push(imageSlot({
    slotId: 'slot-qr',
    x: PAD_L, y: qrY,
    w: qrSize, h: qrSize,
    styleHint: 'QR code linking to ransomware protection resource or cybersecurity portal',
    stroke: palette.primary, rx: 12
  }));

  // 6. CTA bar
  ctaBar(o, content.callToAction, palette, fonts, W, H - CTA_H_L, CTA_H_L);
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
  const n = 5; // preview at max blocks
  const CTA_H = 148;
  const QR_ZONE = 144 + 8 + 16;
  const stackBottom = H - CTA_H - QR_ZONE - 8;
  const stackTop = 360 + 16;
  const gapTotal = CARD_GAP * (n - 1);
  const cardBudget = Math.max(120, Math.round((stackBottom - stackTop - gapTotal) / n));

  const parts = [
    pvCircle(pv(1200), pv(260), pv(400), palette.primary, { opacity: 0.07 }),
    pvCircle(pv(180), pv(1720), pv(300), palette.accent, { opacity: 0.06 }),
    // headline
    pvBars({ x: pv(PAD), y: pv(104), w: pv(zoneW), lines: 2, barH: 9, gap: 5, fill: palette.primary })
  ];

  for (let i = 0; i < n; i++) {
    const cardY = stackTop + i * (cardBudget + CARD_GAP);
    pvCard(parts, palette, { x: PAD, y: cardY, w: zoneW, h: cardBudget });
  }

  // QR slot
  const qrSize = 136;
  const qrY = H - CTA_H - qrSize - 16;
  parts.push(pvSlot(pv(W / 2 - qrSize / 2), pv(qrY), pv(qrSize), pv(qrSize), palette.primary));
  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H), PV_LAND_W, pv(CTA_H), palette.primary));

  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000;
  const H = 1414;
  const zoneW = W - PAD_L * 2;
  const n = 5; // max blocks preview (3 left + 2 right)
  const leftCount = Math.ceil(n / 2);
  const colGap = 40;
  const colW = Math.round((zoneW - colGap) / 2);
  const CTA_H_L = 128;
  const QR_H_L = 120;
  const cardsBottom = H - CTA_H_L - QR_H_L - 24;
  const cursor = 256;
  const gapTotal = CARD_GAP * (leftCount - 1);
  const colH = cardsBottom - cursor - 16;
  const cardBudget = Math.max(100, Math.round((colH - gapTotal) / leftCount));

  const parts = [
    pvCircle(pv(1780), pv(200), pv(360), palette.primary, { opacity: 0.07 }),
    pvCircle(pv(220), pv(1200), pv(280), palette.accent, { opacity: 0.06 }),
    // headline
    pvBars({ x: pv(PAD_L), y: pv(72), w: pv(zoneW), lines: 2, barH: 8, gap: 5, fill: palette.primary })
  ];

  for (let ci = 0; ci < 2; ci++) {
    const colX = PAD_L + ci * (colW + colGap);
    const colBlocks = ci === 0 ? leftCount : n - leftCount;
    const cb = Math.max(100, Math.round((colH - CARD_GAP * (colBlocks - 1)) / colBlocks));
    for (let i = 0; i < colBlocks; i++) {
      const cardY = cursor + 16 + i * (cb + CARD_GAP);
      pvCard(parts, palette, { x: colX, y: cardY, w: colW, h: cb });
    }
  }

  // QR slot
  const qrSize = 112;
  const qrY = H - CTA_H_L - qrSize - 12;
  parts.push(pvSlot(pv(PAD_L), pv(qrY), pv(qrSize), pv(qrSize), palette.primary));
  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H_L), PV_LAND_W, pv(CTA_H_L), palette.primary));

  return svgWrapO(parts, DARK_BASE, 'landscape');
}

// ── export ────────────────────────────────────────────────────────────────────

export default {
  id: 'ransomware-checklist',
  name: 'Ransomware Checklist',
  style: 'qa',
  description: 'Dark Q&A checklist for ransomware awareness: brand-yellow headline, N question→answer cards (definition + protect steps) stacked in portrait / two columns in landscape, QR imageSlot CTA. Reinterprets the Advanced Ransomware & Extortion dark poster at poster scale.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'qa-pairs', min: 3, max: 5, fields: ['question', 'answer'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
