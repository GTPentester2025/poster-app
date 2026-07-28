// v2 template — cyber-month-agenda (style: infographic). Reinterpretation of
// the AB InBev "Cybersecurity Awareness Month" event-card poster (source: 9.html)
// at the v2 canvas scale.
//
// The source is a 16:9 landscape event card: a clipped radial red+yellow "tech
// hero" region on the right, a yellow arrow-banner title on the left, checkmark
// agenda list items, a prizes/CTA ribbon, and a QR code bottom-right.
//
// Source → port:
//   .tech-art-section (radial red+yellow clip-path)  → heroRegion (meshGlow + signalArcs + gradientWash)
//   .main-arrow-banner (yellow clip-path, title)      → headline zone with yellow chevron band
//   .list-container (checkmark agenda items)         → agendaRows × blocks (sequence min3/max4)
//                                                       label chip + message text, both bound
//   .price-tag-ribbon (white ribbon, prizes text)    → prizesBar (callToAction, palette.primary)
//   .bottom-right-container / QR .qr-wrapper         → imageSlot slot-qr
//   logo (base64 PNG)                                → dropped (brand asset, not template content)
//   shield (base64 PNG)                              → reinterpreted as decor (signalArcs motif)
//   background #000000                               → DARK_BASE
//   yellow #f5c400                                   → palette.primary
//   red #e60000                                      → palette.accent
//
// Design: buildLandscape is the strong/primary layout (faithful 16:9 archetype);
// buildPortrait is a genuine portrait re-flow (single column, tall hero banner).
// Canvas: portrait 1414×2000, landscape 2000×1414.
// Yellow = palette.primary; red accent = palette.accent; darks = DARK_* only.
// No hardcoded brand hex.

import {
  textbox, rect, chip, imageSlot, backgroundImageSlot,
  fitFontSize, fitTextBlock, estTextHeight,
  pv, pvRect, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, signalArcs, gradientWash, legibilityScrim,
  svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM
} from './decor.js';

// ── layout constants ──────────────────────────────────────────────────────────

const PAD = 72;
const GAP = 16;
const CARD_RX = 16;

// Landscape zones
const HERO_W_L = 860;     // tech-hero panel width (right column)
const HERO_H_L = 960;     // tech-hero panel height (top portion)
const TITLE_H_L = 200;    // yellow headline band height (landscape)
const PRIZES_H_L = 120;   // prizes / CTA bar height
const QR_SIZE_L = 160;    // content imageSlot (QR) square size

// Portrait zones
const HERO_H_P = 480;     // tech-hero panel height (top strip)
const TITLE_H_P = 280;    // yellow headline band height (portrait)
const PRIZES_H_P = 160;   // prizes / CTA bar height
const QR_SIZE_P = 180;    // content imageSlot (QR) square size

// ── tech-hero region (decor) ──────────────────────────────────────────────────

/**
 * Radial tech-hero panel: a dark panel with meshGlow radial blooms, signal-arc
 * rings, and a gradientWash — reinterpreting the source's clip-path radial-
 * gradient red section. Returns objects for push.
 */
function heroRegion(o, palette, { x, y, w, h }) {
  // Panel background (dark, slightly raised)
  o.push(rect({ x, y, w, h, fill: DARK_PANEL, layerRole: 'background' }));

  // gradientWash: diagonal red→dark sweep over the panel area
  // (simulate radial red from source)
  o.push(...gradientWash({
    w, h,
    from: palette.accent,
    to: DARK_BASE,
    direction: 'diagonal',
    intensity: 0.75
  }).map(r => ({ ...r, left: x + r.left, top: y + r.top })));

  // meshGlow: accent bloom near centre, primary bloom upper-right
  o.push(...meshGlow({
    spots: [
      { x: x + Math.round(w * 0.55), y: y + Math.round(h * 0.35), r: Math.round(w * 0.45), color: palette.accent },
      { x: x + Math.round(w * 0.85), y: y + Math.round(h * 0.15), r: Math.round(w * 0.30), color: palette.primary }
    ],
    intensity: 0.75
  }));

  // signalArcs: concentric rings (broadcast / radial tech motif)
  o.push(...signalArcs({
    x: x + Math.round(w * 0.55), y: y + Math.round(h * 0.38),
    r: Math.round(Math.min(w, h) * 0.5),
    rings: 5, color: palette.accent, strokeWidth: 6, intensity: 0.80
  }));

  // secondary smaller arcs, offset
  o.push(...signalArcs({
    x: x + Math.round(w * 0.80), y: y + Math.round(h * 0.20),
    r: Math.round(Math.min(w, h) * 0.28),
    rings: 3, color: palette.primary, strokeWidth: 4, intensity: 0.65
  }));
}

// ── yellow headline band ──────────────────────────────────────────────────────

/**
 * Yellow chevron/arrow headline band with the event title.
 * x/y/w/h define the band rectangle; skewX gives the "arrow" feel via a polygon.
 */
function headlineBand(o, content, palette, fonts, { x, y, w, h }) {
  // Yellow band background
  o.push(rect({ x, y, w, h, fill: palette.primary, rx: 0, layerRole: 'background' }));

  // Dark left-edge accent stripe
  o.push(rect({ x, y, w: 8, h, fill: DARK_BASE, opacity: 0.30, layerRole: 'decor' }));

  // Headline text
  const textX = x + PAD;
  const textW = w - PAD - 48;

  // Optional subheadline strip (small label above headline). Reserve its space
  // at the top of the band so the headline never collides with it.
  let subReserve = 0;
  if (content.subheadline) {
    const subY = y + 10;
    const { fontSize: subSize, height: subH } = fitTextBlock(content.subheadline, {
      width: textW, height: 60, maxSize: 30, minSize: 18, lineHeight: 1.1
    });
    o.push(textbox({
      text: content.subheadline,
      x: textX, y: subY,
      w: textW, fontSize: subSize,
      fontFamily: fonts.head, fontWeight: '800',
      fill: DARK_BASE, lineHeight: 1.1, align: 'left',
      layerRole: 'subheadline', bgRef: palette.primary
    }));
    subReserve = 10 + Math.round(subH) + 10;
  }

  const headBudget = h - 24 - subReserve;
  const { fontSize: headSize, height: headH } = fitTextBlock(content.headline, {
    width: textW, height: headBudget,
    maxSize: 100, minSize: 30, lineHeight: 1.0
  });
  o.push(textbox({
    text: content.headline,
    x: textX, y: y + subReserve + Math.max(0, Math.round((headBudget - headH) / 2)),
    w: textW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, lineHeight: 1.0, align: 'left',
    layerRole: 'headline', bgRef: palette.primary
  }));
}

// ── agenda row (one block = label chip + message text) ───────────────────────

/**
 * One agenda row: a dark card panel with a yellow check-pill label and message
 * text. BOTH label AND text carry msgId + fieldRef per the multi-field spec.
 */
function agendaRow(o, b, palette, fonts, { x, y, w, h }) {
  // Card background
  o.push(rect({
    x, y, w, h, fill: DARK_PANEL, rx: CARD_RX,
    stroke: palette.primary, strokeWidth: 2,
    layerRole: 'background'
  }));

  // Left accent stripe (yellow)
  o.push(rect({
    x, y: y + CARD_RX, w: 6, h: h - CARD_RX * 2,
    fill: palette.primary, layerRole: 'decor'
  }));

  const innerPad = 20;
  const chipMaxW = Math.min(220, Math.round(w * 0.28));
  const chipMaxH = Math.min(50, Math.round(h * 0.50));

  // Label chip — bound (fieldRef: 'label')
  const [pill, labelTb] = chip({
    text: b.label || 'ITEM',
    x: x + innerPad + 8, y: y + Math.round((h - Math.min(chipMaxH, 44)) / 2),
    fontSize: 22, bg: palette.primary, color: DARK_BASE,
    font: fonts.head, maxW: chipMaxW, maxH: chipMaxH,
    msgId: b.id
  });
  o.push(pill);
  o.push({ ...labelTb, fieldRef: 'label' });

  // Message text — right of chip (fieldRef: 'text')
  const chipRight = pill.left + pill.width + 20;
  const textX = chipRight;
  const textW = x + w - textX - innerPad;
  const textH = h - innerPad * 2;

  const { fontSize: msgSize } = fitTextBlock(b.text, {
    width: textW, height: Math.max(textH, 38 * 1.22),
    maxSize: 50, minSize: 38, lineHeight: 1.22
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
      layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'text'
  });
}

/** Vertical stack of agenda rows distributed evenly in a zone. */
function agendaStack(o, blocks, palette, fonts, { x, y, w, h }) {
  const n = Math.max(blocks.length, 1);
  const gap = GAP;
  const rowH = Math.floor((h - gap * (n - 1)) / n);
  blocks.forEach((b, i) => {
    agendaRow(o, b, palette, fonts, {
      x, y: y + i * (rowH + gap), w, h: rowH
    });
  });
}

// ── prizes / CTA bar ──────────────────────────────────────────────────────────

/**
 * Prizes/CTA bar: yellow background, dark CTA text left, QR imageSlot right.
 * The callToAction text is verbatim per spec.
 */
function prizesBar(o, text, palette, fonts, W, y, h, qrSize) {
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));

  // Accent top rule
  o.push(rect({ x: 0, y, w: W, h: 5, fill: DARK_BASE, opacity: 0.20, layerRole: 'decor' }));

  // QR imageSlot — right side, text-free region (clamp so slot never exceeds canvas)
  const qrActual = Math.min(qrSize, h - 8);
  const qrPad = Math.max(8, Math.round((h - qrActual) / 2));
  const qrX = Math.min(W - qrPad - qrActual, W - qrActual - 8);
  const qrY = y + qrPad;
  o.push(imageSlot({
    slotId: 'slot-qr',
    x: qrX, y: qrY, w: qrActual, h: qrActual,
    styleHint: 'QR code for cybersecurity awareness event registration or resources portal, clean on white, square format',
    stroke: DARK_BASE, rx: 10
  }));

  // CTA text — left of QR, verbatim
  const textX = PAD;
  const textW = qrX - PAD - 20;
  const size = fitFontSize(text, { width: textW, height: h - 32, maxSize: 48, minSize: 28, lineHeight: 1.2 });
  const th = estTextHeight(text, size, textW, 1.2);
  o.push(textbox({
    text, x: textX, y: y + Math.round((h - th) / 2),
    w: textW, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, align: 'left', lineHeight: 1.2,
    layerRole: 'cta', bgRef: palette.primary
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
    styleHint: 'dark cybersecurity themed background: black base, subtle tech circuit pattern, no text, moody lighting',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ── tech-hero band (top strip, full width) ────────────────────────────────
  heroRegion(o, palette, { x: 0, y: 0, w: W, h: HERO_H_P });

  // ── yellow headline band (below hero, left-anchored) ─────────────────────
  const titleY = HERO_H_P;
  headlineBand(o, content, palette, fonts, {
    x: 0, y: titleY, w: W, h: TITLE_H_P
  });

  // ── agenda stack ──────────────────────────────────────────────────────────
  const stackTop = titleY + TITLE_H_P + GAP;
  const stackBottom = H - PRIZES_H_P - GAP;
  const stackH = stackBottom - stackTop;
  const blocks = content.blocks || [];

  agendaStack(o, blocks, palette, fonts, {
    x: PAD, y: stackTop, w: W - PAD * 2, h: stackH
  });

  // ── prizes / CTA bar (bottom) ─────────────────────────────────────────────
  prizesBar(o, content.callToAction, palette, fonts, W, H - PRIZES_H_P, PRIZES_H_P, QR_SIZE_P);

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
    styleHint: 'dark cybersecurity themed background: black base, subtle tech circuit pattern, no text, moody lighting',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ── layout: left column (content) + right column (tech hero) ─────────────
  const leftW = W - HERO_W_L;    // content column width
  const heroX = leftW;            // hero starts at the right column

  // ── tech-hero region (right column, top portion) ──────────────────────────
  heroRegion(o, palette, {
    x: heroX, y: 0, w: HERO_W_L, h: HERO_H_L
  });

  // ── yellow headline band (left, top) ─────────────────────────────────────
  headlineBand(o, content, palette, fonts, {
    x: 0, y: 0, w: leftW + 80, h: TITLE_H_L
  });

  // ── agenda stack (left column, below title band) ──────────────────────────
  const stackTop = TITLE_H_L + GAP;
  const stackBottom = H - PRIZES_H_L - GAP;
  const stackH = stackBottom - stackTop;
  const blocks = content.blocks || [];

  agendaStack(o, blocks, palette, fonts, {
    x: PAD, y: stackTop, w: leftW - PAD + 40, h: stackH
  });

  // ── dark info strip (right column, below hero) ────────────────────────────
  // Fills the right column bottom area with secondary text / decor
  const infoY = HERO_H_L;
  const infoH = H - HERO_H_L - PRIZES_H_L;
  if (infoH > 0) {
    o.push(rect({ x: heroX, y: infoY, w: HERO_W_L, h: infoH, fill: DARK_PANEL, layerRole: 'background' }));
    o.push(rect({ x: heroX, y: infoY, w: HERO_W_L, h: 4, fill: palette.accent, opacity: 0.7, layerRole: 'decor' }));
    // Dim secondary label in right info area
    const infoText = 'Secure your digital world.';
    const iSize = fitFontSize(infoText, { width: HERO_W_L - PAD * 2, height: infoH - 24, maxSize: 36, minSize: 24 });
    const iH = estTextHeight(infoText, iSize, HERO_W_L - PAD * 2);
    o.push(textbox({
      text: infoText,
      x: heroX + PAD, y: infoY + Math.round((infoH - iH) / 2),
      w: HERO_W_L - PAD * 2, fontSize: iSize,
      fontFamily: fonts.head, fontWeight: '800',
      fill: DARK_INK_DIM, lineHeight: 1.2, align: 'center',
      layerRole: 'decor', bgRef: DARK_PANEL
    }));
  }

  // ── prizes / CTA bar (full width, bottom) ────────────────────────────────
  prizesBar(o, content.callToAction, palette, fonts, W, H - PRIZES_H_L, PRIZES_H_L, QR_SIZE_L);

  return canvas;
}

// ── portrait preview ──────────────────────────────────────────────────────────

function previewPortrait(palette) {
  const W = 1414;
  const H = 2000;
  const n = 3; // preview uses min block count

  const stackTop = HERO_H_P + TITLE_H_P + GAP;
  const stackBottom = H - PRIZES_H_P - GAP;
  const stackH = stackBottom - stackTop;
  const rowH = Math.floor((stackH - GAP * (n - 1)) / n);

  const parts = [
    // tech-hero band (top)
    pvRect(0, 0, pv(W), pv(HERO_H_P), DARK_PANEL),
    // signal-arc accent (decor summary)
    pvRect(pv(W * 0.5 - 40), pv(HERO_H_P * 0.3), pv(80), pv(80), palette.accent, { rx: 40, opacity: 0.18 }),
    pvRect(pv(W * 0.5 - 64), pv(HERO_H_P * 0.3 - 24), pv(128), pv(128), palette.accent, { rx: 64, opacity: 0.10 }),
    pvRect(pv(W * 0.7), pv(HERO_H_P * 0.12), pv(60), pv(60), palette.primary, { rx: 30, opacity: 0.12 }),

    // yellow headline band
    pvRect(0, pv(HERO_H_P), pv(W), pv(TITLE_H_P), palette.primary),
    pvBars({ x: pv(PAD), y: pv(HERO_H_P + TITLE_H_P * 0.28), w: pv(W - PAD * 2), lines: 2, barH: 11, gap: 7, fill: DARK_BASE })
  ];

  // agenda rows
  for (let i = 0; i < n; i++) {
    const py = stackTop + i * (rowH + GAP);
    parts.push(pvRect(pv(PAD), pv(py), pv(W - PAD * 2), pv(rowH), DARK_PANEL, { rx: 3, stroke: palette.primary }));
    parts.push(pvRect(pv(PAD), pv(py + 6), pv(4), pv(rowH - 12), palette.primary));
    parts.push(pvRect(pv(PAD + 18), pv(py + Math.round(rowH * 0.28)), pv(70), pv(18), palette.primary, { rx: 9 }));
    parts.push(pvBars({ x: pv(PAD + 104), y: pv(py + Math.round(rowH * 0.30)), w: pv(W - PAD * 2 - 124), lines: 2, barH: 4, gap: 3, fill: DARK_INK }));
  }

  // prizes/CTA bar
  parts.push(pvRect(0, pv(H - PRIZES_H_P), pv(W), pv(PRIZES_H_P), palette.primary));
  parts.push(pvBars({ x: pv(PAD), y: pv(H - PRIZES_H_P + 34), w: pv(W * 0.56), lines: 1, barH: 9, gap: 0, fill: DARK_BASE }));
  parts.push(pvSlot(pv(W - PAD - QR_SIZE_P), pv(H - PRIZES_H_P + 14), pv(QR_SIZE_P), pv(QR_SIZE_P - 28), DARK_BASE));

  return svgWrapO(parts, DARK_BASE, 'portrait');
}

// ── landscape preview ─────────────────────────────────────────────────────────

function previewLandscape(palette) {
  const W = 2000;
  const H = 1414;
  const n = 3;

  const leftW = W - HERO_W_L;
  const heroX = leftW;

  const stackTop = TITLE_H_L + GAP;
  const stackBottom = H - PRIZES_H_L - GAP;
  const stackH = stackBottom - stackTop;
  const rowH = Math.floor((stackH - GAP * (n - 1)) / n);

  const parts = [
    // tech-hero panel (right)
    pvRect(pv(heroX), 0, pv(HERO_W_L), pv(HERO_H_L), DARK_PANEL),
    pvRect(pv(heroX + HERO_W_L * 0.45), pv(HERO_H_L * 0.25), pv(HERO_W_L * 0.45), pv(HERO_H_L * 0.45), palette.accent, { rx: 999, opacity: 0.12 }),
    pvRect(pv(heroX + HERO_W_L * 0.70), pv(HERO_H_L * 0.08), pv(HERO_W_L * 0.28), pv(HERO_H_L * 0.28), palette.primary, { rx: 999, opacity: 0.09 }),

    // yellow headline band (left, overlaps into hero slightly)
    pvRect(0, 0, pv(leftW + 80), pv(TITLE_H_L), palette.primary),
    pvBars({ x: pv(PAD), y: pv(TITLE_H_L * 0.28), w: pv(leftW - PAD), lines: 2, barH: 10, gap: 6, fill: DARK_BASE }),

    // right info strip (below hero)
    pvRect(pv(heroX), pv(HERO_H_L), pv(HERO_W_L), pv(H - HERO_H_L - PRIZES_H_L), DARK_PANEL),
    pvBars({ x: pv(heroX + PAD), y: pv(HERO_H_L + 14), w: pv(HERO_W_L - PAD * 2), lines: 1, barH: 5, gap: 0, fill: DARK_INK_DIM, align: 'center' })
  ];

  // agenda rows (left column)
  for (let i = 0; i < n; i++) {
    const py = stackTop + i * (rowH + GAP);
    parts.push(pvRect(pv(PAD), pv(py), pv(leftW - PAD + 40), pv(rowH), DARK_PANEL, { rx: 3, stroke: palette.primary }));
    parts.push(pvRect(pv(PAD), pv(py + 4), pv(3), pv(rowH - 8), palette.primary));
    parts.push(pvRect(pv(PAD + 14), pv(py + Math.round(rowH * 0.25)), pv(56), pv(15), palette.primary, { rx: 7 }));
    parts.push(pvBars({ x: pv(PAD + 80), y: pv(py + Math.round(rowH * 0.27)), w: pv(leftW - PAD * 2), lines: 2, barH: 3, gap: 3, fill: DARK_INK }));
  }

  // prizes/CTA bar (full width)
  parts.push(pvRect(0, pv(H - PRIZES_H_L), PV_LAND_W, pv(PRIZES_H_L), palette.primary));
  parts.push(pvBars({ x: pv(PAD), y: pv(H - PRIZES_H_L + 30), w: pv(W * 0.45), lines: 1, barH: 8, gap: 0, fill: DARK_BASE }));
  parts.push(pvSlot(pv(W - PAD - QR_SIZE_L), pv(H - PRIZES_H_L + 12), pv(QR_SIZE_L), pv(QR_SIZE_L - 24), DARK_BASE));

  return svgWrapO(parts, DARK_BASE, 'landscape');
}

// ── export ────────────────────────────────────────────────────────────────────

export default {
  id: 'cyber-month-agenda',
  name: 'Cybersecurity Month Agenda',
  style: 'infographic',
  description: 'A landscape-first event-card infographic reinterpreting the AB InBev Cybersecurity Awareness Month poster: a radial/clip tech-hero region (meshGlow + signalArcs) on the right, a bold yellow headline band, three to four agenda rows (label chip + message per block), a prizes/CTA tagline bar, and a QR content imageSlot. Portrait re-flows to a full-width hero banner above a single-column agenda stack.',
  contentSchema: {
    headline: { required: true, maxWords: 6 },
    subheadline: { required: false, maxWords: 8 },
    blocks: { kind: 'sequence', min: 3, max: 4, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 12 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
