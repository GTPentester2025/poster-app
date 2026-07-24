// v2 template — gisp-release-numbered (style: infographic). Reinterpretation of
// the AB InBev "GISP H2 Release" poster (source: 7.html) at the v2 canvas scale.
// The archetype is a dark infographic with a diagonal-split hero (yellow left
// panel over a dark right polygon), an intro strip, then numbered update cards
// (each block = a bold two-digit auto-number badge + label chip + body text),
// and a content imageSlot for a QR code at the bottom-right of the footer.
//
// Source → port:
//   .hero-section (yellow background, left text)   → diagonal hero (palette.primary left)
//   .hero-dark-slant (dark polygon clip-path)       → polygon dark slant (DARK_BASE fill)
//   .hero-content (GISP title + main title + desc)  → headline + subheadline in hero
//   .qr-ribbon (yellow diagonal, QR + text)         → imageSlot in footer (slot-qr)
//   .update-row (numbered update cards)             → numbered cards (01,02,…)
//     .update-left (.number, .label)                → auto-number badge (decor) + label chip (fieldRef:'label')
//     .update-right (.update-bullets)               → message textbox (fieldRef:'text')
//   background #12161f                             → DARK_BASE / DARK_PANEL
//   brand-yellow #f5c400                            → palette.primary
//   unresolved image placeholders in source         → dropped; hero region = content decor
//
// Design reinterpreted at 1414×2000 / 2000×1414 with v2 language.
// Yellow = palette.primary; dark grounds = DARK_* anchors; no hardcoded hex.

import {
  textbox, rect, polygon, chip, imageSlot, backgroundImageSlot,
  fitFontSize, fitTextBlock, estTextHeight,
  pv, pvRect, pvBars, pvSlot, pvPoly
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, dotGrid, legibilityScrim,
  svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK
} from './decor.js';

// ── constants ─────────────────────────────────────────────────────────────────

const PAD = 64;
const GAP = 20;
const CARD_RX = 20;

// Hero zone heights
const HERO_H_P = 480;     // portrait hero height
const HERO_H_L = 340;     // landscape hero height

// Intro strip heights
const INTRO_H_P = 100;    // portrait intro strip
const INTRO_H_L = 80;     // landscape intro strip

// Footer heights
const FOOTER_H_P = 160;   // portrait footer
const FOOTER_H_L = 130;   // landscape footer

// CTA bar heights
const CTA_H_P = 120;      // portrait CTA bar
const CTA_H_L = 96;       // landscape CTA bar

// Number badge dimensions
const BADGE_W = 120;      // portrait number badge width
const BADGE_H = 120;      // portrait number badge height
const BADGE_W_L = 90;     // landscape number badge width
const BADGE_H_L = 90;     // landscape number badge height

// ── CTA bar ────────────────────────────────────────────────────────────────────

function ctaBar(o, text, palette, fonts, W, y, h) {
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 200, height: h - 36, maxSize: 44, minSize: 28, lineHeight: 1.2 });
  const th = estTextHeight(text, size, W - 200, 1.2);
  o.push(textbox({
    text, x: 100, y: y + Math.round((h - th) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, align: 'center', layerRole: 'cta', bgRef: palette.primary
  }));
}

// ── diagonal-split hero ───────────────────────────────────────────────────────
// Yellow left field; dark right panel with diagonal clip (polygon); headline +
// subheadline in the yellow zone. The slant divides at ~52% width from left.

function heroSection(o, content, palette, fonts, W, y, h) {
  // Yellow full-width background behind hero
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));

  // Dark right slant polygon — clips at ~48% from left at top, ~38% from left at bottom
  const slantTopX = Math.round(W * 0.48);
  const slantBotX = Math.round(W * 0.38);
  o.push(polygon(
    [
      { x: slantTopX, y },
      { x: W, y },
      { x: W, y: y + h },
      { x: slantBotX, y: y + h }
    ],
    { fill: DARK_BASE, layerRole: 'background' }
  ));

  // Subtle dot grid on dark slant zone
  o.push(...dotGrid({
    x: slantTopX + 80, y: y + 40,
    cols: 3, rows: 5, gap: 40, dotR: 3,
    color: palette.primary, intensity: 0.4
  }));

  // Thin accent accent rule at bottom of hero
  o.push(rect({ x: 0, y: y + h - 6, w: W, h: 6, fill: DARK_BASE, opacity: 0.25, layerRole: 'decor' }));

  // ── left content zone ─────────────────────────────────────────────────────
  const contentW = Math.round(W * 0.44) - PAD;
  const innerX = PAD;
  let cursor = y + PAD;

  // "GISP" outline-style super-label
  const superLabel = 'GISP';
  const superSize = fitFontSize(superLabel, { width: contentW, height: Math.round(h * 0.22), maxSize: 120, minSize: 80, lineHeight: 0.9 });
  const superH = estTextHeight(superLabel, superSize, contentW, 0.9);
  o.push(textbox({
    text: superLabel, x: innerX, y: cursor, w: contentW,
    fontSize: superSize, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, lineHeight: 0.9, align: 'left',
    layerRole: 'decor', bgRef: palette.primary
  }));
  cursor += superH + 12;

  // Headline — the main title (verbatim from content.headline)
  const headBudget = h - (cursor - y) - PAD - 90;
  const { fontSize: headSize, height: headH } = fitTextBlock(content.headline, {
    width: contentW, height: Math.max(headBudget, 80 * 1.1),
    maxSize: 80, minSize: 80, lineHeight: 1.05
  });
  o.push(textbox({
    text: content.headline, x: innerX, y: cursor, w: contentW,
    fontSize: headSize, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, lineHeight: 1.05, align: 'left',
    layerRole: 'headline', bgRef: palette.primary
  }));
  cursor += headH + 16;

  // Subheadline strip (optional intro / tagline)
  const subText = content.subheadline || 'H2 Platform Updates';
  const subBudget = h - (cursor - y) - 20;
  if (subBudget > 40) {
    const subSize = fitFontSize(subText, { width: contentW, height: Math.min(subBudget, 80), maxSize: 38, minSize: 28, lineHeight: 1.2 });
    o.push(textbox({
      text: subText, x: innerX, y: cursor, w: contentW,
      fontSize: subSize, fontFamily: fonts.head, fontWeight: '700',
      fill: DARK_BASE, lineHeight: 1.2, align: 'left',
      layerRole: 'subheadline', bgRef: palette.primary
    }));
  }
}

// ── intro strip (dark band below hero) ───────────────────────────────────────

function introStrip(o, palette, fonts, W, y, h) {
  o.push(rect({ x: 0, y, w: W, h, fill: DARK_PANEL, layerRole: 'background' }));
  // left accent bar
  o.push(rect({ x: 0, y, w: 8, h, fill: palette.primary, layerRole: 'decor' }));
  // intro label text (decor — not content-bound)
  const label = 'MAJOR PLATFORM UPDATES';
  const lSize = fitFontSize(label, { width: W - 100, height: h - 24, maxSize: 34, minSize: 24, lineHeight: 1.2 });
  const lH = estTextHeight(label, lSize, W - 100, 1.2);
  o.push(textbox({
    text: label, x: 40, y: y + Math.round((h - lH) / 2),
    w: W - 100, fontSize: lSize, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, lineHeight: 1.2, align: 'left',
    layerRole: 'decor', bgRef: DARK_PANEL
  }));
}

// ── single numbered update card ───────────────────────────────────────────────
// CRITICAL: both 'label' and 'text' fields carry msgId + fieldRef.
// The number badge (01, 02, …) is decorative — NOT a bound field.

function numberedCard(o, b, idx, palette, fonts, { x, y, w, h, badgeW, badgeH }) {
  // card background
  o.push(rect({
    x, y, w, h,
    fill: DARK_PANEL, rx: CARD_RX,
    stroke: palette.primary, strokeWidth: 2,
    layerRole: 'background'
  }));

  // top accent rule
  o.push(rect({ x: x + CARD_RX, y, w: w - CARD_RX * 2, h: 5, fill: palette.primary, layerRole: 'decor' }));

  const innerX = x + 24;
  const innerW = w - 48;
  let cursor = y + 5 + 18;

  // ── number badge (decorative, not bound) ──────────────────────────────────
  const numStr = String(idx + 1).padStart(2, '0');
  o.push(rect({
    x: innerX, y: cursor, w: badgeW, h: badgeH,
    fill: palette.primary, rx: Math.min(badgeH / 2, 16),
    layerRole: 'decor'
  }));
  const numSize = fitFontSize(numStr, { width: badgeW - 16, height: badgeH - 16, maxSize: 56, minSize: 32, lineHeight: 1.0 });
  const numH = estTextHeight(numStr, numSize, badgeW - 16, 1.0);
  o.push(textbox({
    text: numStr, x: innerX + 8, y: cursor + Math.round((badgeH - numH) / 2),
    w: badgeW - 16, fontSize: numSize, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, align: 'center', lineHeight: 1.0,
    layerRole: 'decor', bgRef: palette.primary
  }));
  cursor += badgeH + 14;

  // ── label chip (fieldRef:'label') ────────────────────────────────────────
  const chipMaxW = Math.min(innerW, Math.round(innerW * 0.95));
  const chipMaxH = Math.min(52, Math.round(h * 0.22));
  const [pill, labelTb] = chip({
    text: b.label || 'Update',
    x: innerX, y: cursor,
    fontSize: 24, bg: DARK_BASE, color: palette.primary,
    font: fonts.head, maxW: chipMaxW, maxH: chipMaxH,
    msgId: b.id
  });
  o.push(pill);
  o.push({ ...labelTb, fieldRef: 'label' });

  const chipH = pill.height ?? Math.round(24 * 1.4 + 24);
  cursor += chipH + 14;

  // ── text message (fieldRef:'text') ────────────────────────────────────────
  // Budget = remaining card space minus bottom padding
  const textBudget = h - (cursor - y) - 20;
  const { fontSize: msgSize } = fitTextBlock(b.text, {
    width: innerW,
    height: Math.max(textBudget, 38 * 1.28),
    maxSize: 42, minSize: 38, lineHeight: 1.28
  });
  o.push({
    ...textbox({
      text: b.text, x: innerX, y: cursor,
      w: innerW, fontSize: msgSize,
      fontFamily: fonts.body, fontWeight: '600',
      fill: DARK_INK, lineHeight: 1.28,
      layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'text'
  });
}

// ── card grid ─────────────────────────────────────────────────────────────────

function cardGrid(o, blocks, palette, fonts, { x, y, w, h, cols, badgeW, badgeH }) {
  const n = blocks.length;
  const rows = Math.ceil(n / cols);
  const colW = Math.floor((w - GAP * (cols - 1)) / cols);
  const rowH = Math.floor((h - GAP * (rows - 1)) / rows);

  blocks.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    numberedCard(o, b, i, palette, fonts, {
      x: x + col * (colW + GAP),
      y: y + row * (rowH + GAP),
      w: colW,
      h: rowH,
      badgeW,
      badgeH
    });
  });
}

// ── footer strip ──────────────────────────────────────────────────────────────

function footerStrip(o, palette, W, y, h) {
  o.push(rect({ x: 0, y, w: W, h, fill: DARK_BASE, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: palette.primary, layerRole: 'decor' }));

  // content imageSlot — QR code — right side, text-free region
  const slotSide = Math.min(h - 32, 130);
  const slotX = W - PAD - slotSide;
  const slotY = y + Math.round((h - slotSide) / 2);
  o.push(imageSlot({
    slotId: 'slot-qr',
    x: slotX, y: slotY, w: slotSide, h: slotSide,
    styleHint: 'QR code linking to GISP release notes or platform portal, clean on white background, square format',
    stroke: palette.primary, rx: 10
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
    styleHint: 'dark technology platform release background, abstract digital circuit board pattern, deep navy/charcoal, no text, subtle glow',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ambient decor
  o.push(...meshGlow({ spots: [
    { x: 220, y: 500, r: 380, color: palette.primary },
    { x: W - 200, y: H - 600, r: 320, color: palette.accent ?? palette.primary }
  ], intensity: 0.5 }));

  // ── hero ──────────────────────────────────────────────────────────────────
  heroSection(o, content, palette, fonts, W, 0, HERO_H_P);

  // ── intro strip ───────────────────────────────────────────────────────────
  const introY = HERO_H_P;
  introStrip(o, palette, fonts, W, introY, INTRO_H_P);

  // ── numbered card grid ────────────────────────────────────────────────────
  const gridTop = introY + INTRO_H_P + GAP;
  const gridBottom = H - FOOTER_H_P - CTA_H_P - GAP;
  const gridH = gridBottom - gridTop;
  const blocks = content.blocks || [];

  // Portrait: 2 columns
  cardGrid(o, blocks, palette, fonts, {
    x: PAD, y: gridTop, w: W - PAD * 2, h: gridH,
    cols: 2, badgeW: BADGE_W, badgeH: BADGE_H
  });

  // ── footer ────────────────────────────────────────────────────────────────
  footerStrip(o, palette, W, H - FOOTER_H_P - CTA_H_P, FOOTER_H_P);

  // ── CTA bar ───────────────────────────────────────────────────────────────
  ctaBar(o, content.callToAction, palette, fonts, W, H - CTA_H_P, CTA_H_P);

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
    styleHint: 'dark technology platform release background, abstract digital circuit board pattern, deep navy/charcoal, no text, subtle glow',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ambient decor
  o.push(...meshGlow({ spots: [
    { x: 300, y: 240, r: 340, color: palette.primary },
    { x: W - 280, y: H - 280, r: 280, color: palette.accent ?? palette.primary }
  ], intensity: 0.5 }));

  // ── hero ──────────────────────────────────────────────────────────────────
  heroSection(o, content, palette, fonts, W, 0, HERO_H_L);

  // ── intro strip ───────────────────────────────────────────────────────────
  const introY = HERO_H_L;
  introStrip(o, palette, fonts, W, introY, INTRO_H_L);

  // ── numbered card grid ────────────────────────────────────────────────────
  const gridTop = introY + INTRO_H_L + GAP;
  const gridBottom = H - FOOTER_H_L - CTA_H_L - GAP;
  const gridH = gridBottom - gridTop;
  const blocks = content.blocks || [];

  // Landscape: 3 columns for 3–5 blocks (max overflow to 2 rows if 5 blocks)
  const cols = Math.min(3, blocks.length);
  cardGrid(o, blocks, palette, fonts, {
    x: PAD, y: gridTop, w: W - PAD * 2, h: gridH,
    cols: cols || 2, badgeW: BADGE_W_L, badgeH: BADGE_H_L
  });

  // ── footer ────────────────────────────────────────────────────────────────
  footerStrip(o, palette, W, H - FOOTER_H_L - CTA_H_L, FOOTER_H_L);

  // ── CTA bar ───────────────────────────────────────────────────────────────
  ctaBar(o, content.callToAction, palette, fonts, W, H - CTA_H_L, CTA_H_L);

  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────

function previewPortrait(palette) {
  const W = 1414;
  const H = 2000;

  const gridTop = HERO_H_P + INTRO_H_P + GAP;
  const gridBottom = H - FOOTER_H_P - CTA_H_P - GAP;
  const gridH = gridBottom - gridTop;
  const cols = 2;
  const colW = Math.floor((W - PAD * 2 - GAP * (cols - 1)) / cols);
  const rows = 2;
  const rowH = Math.floor((gridH - GAP * (rows - 1)) / rows);

  const slantTopX = Math.round(W * 0.48);
  const slantBotX = Math.round(W * 0.38);

  const parts = [
    // hero yellow bg
    pvRect(0, 0, pv(W), pv(HERO_H_P), palette.primary),
    // dark slant polygon
    pvPoly([
      { x: pv(slantTopX), y: 0 },
      { x: pv(W), y: 0 },
      { x: pv(W), y: pv(HERO_H_P) },
      { x: pv(slantBotX), y: pv(HERO_H_P) }
    ], DARK_BASE),
    // GISP super-label bar
    pvBars({ x: pv(PAD), y: pv(40), w: pv(W * 0.38), lines: 1, barH: 18, gap: 0, fill: DARK_BASE }),
    // headline bars
    pvBars({ x: pv(PAD), y: pv(100), w: pv(W * 0.40), lines: 2, barH: 10, gap: 6, fill: DARK_BASE }),
    // sub bars
    pvBars({ x: pv(PAD), y: pv(146), w: pv(W * 0.36), lines: 1, barH: 6, gap: 0, fill: DARK_BASE }),
    // intro strip
    pvRect(0, pv(HERO_H_P), pv(W), pv(INTRO_H_P), DARK_PANEL),
    pvRect(0, pv(HERO_H_P), pv(8), pv(INTRO_H_P), palette.primary),
    pvBars({ x: pv(40), y: pv(HERO_H_P + 36), w: pv(W * 0.55), lines: 1, barH: 6, gap: 0, fill: palette.primary })
  ];

  // 4 numbered cards in 2×2 grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = PAD + col * (colW + GAP);
      const cy = gridTop + row * (rowH + GAP);
      parts.push(pvRect(pv(cx), pv(cy), pv(colW), pv(rowH), DARK_PANEL, { rx: 4, stroke: palette.primary }));
      parts.push(pvRect(pv(cx + CARD_RX), pv(cy), pv(colW - CARD_RX * 2), pv(4), palette.primary));
      // number badge
      parts.push(pvRect(pv(cx + 24), pv(cy + 24), pv(BADGE_W), pv(BADGE_H), palette.primary, { rx: 8 }));
      // label chip
      parts.push(pvRect(pv(cx + 24), pv(cy + 24 + BADGE_H + 14), pv(colW * 0.55), pv(20), DARK_BASE, { rx: 4 }));
      // text bars
      parts.push(pvBars({ x: pv(cx + 24), y: pv(cy + 24 + BADGE_H + 50), w: pv(colW - 48), lines: 3, barH: 4, gap: 4, fill: DARK_INK }));
    }
  }

  // footer
  const footerY = H - FOOTER_H_P - CTA_H_P;
  parts.push(pvRect(0, pv(footerY), pv(W), pv(FOOTER_H_P), DARK_BASE));
  parts.push(pvRect(0, pv(footerY), pv(W), pv(3), palette.primary));
  const slotSide = Math.min(FOOTER_H_P - 32, 130);
  parts.push(pvSlot(pv(W - PAD - slotSide), pv(footerY + (FOOTER_H_P - slotSide) / 2), pv(slotSide), pv(slotSide), palette.primary));

  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H_P), pv(W), pv(CTA_H_P), palette.primary));
  parts.push(pvBars({ x: pv(100), y: pv(H - CTA_H_P + 40), w: pv(W - 200), lines: 1, barH: 8, gap: 0, fill: DARK_BASE, align: 'center' }));

  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000;
  const H = 1414;

  const gridTop = HERO_H_L + INTRO_H_L + GAP;
  const gridBottom = H - FOOTER_H_L - CTA_H_L - GAP;
  const gridH = gridBottom - gridTop;
  const cols = 3;
  const colW = Math.floor((W - PAD * 2 - GAP * (cols - 1)) / cols);
  const rowH = gridH; // one row

  const slantTopX = Math.round(W * 0.48);
  const slantBotX = Math.round(W * 0.38);

  const parts = [
    // hero yellow bg
    pvRect(0, 0, PV_LAND_W, pv(HERO_H_L), palette.primary),
    // dark slant polygon
    pvPoly([
      { x: pv(slantTopX), y: 0 },
      { x: PV_LAND_W, y: 0 },
      { x: PV_LAND_W, y: pv(HERO_H_L) },
      { x: pv(slantBotX), y: pv(HERO_H_L) }
    ], DARK_BASE),
    // GISP super-label
    pvBars({ x: pv(PAD), y: pv(28), w: pv(W * 0.35), lines: 1, barH: 14, gap: 0, fill: DARK_BASE }),
    // headline bars
    pvBars({ x: pv(PAD), y: pv(60), w: pv(W * 0.38), lines: 2, barH: 8, gap: 5, fill: DARK_BASE }),
    // intro strip
    pvRect(0, pv(HERO_H_L), PV_LAND_W, pv(INTRO_H_L), DARK_PANEL),
    pvRect(0, pv(HERO_H_L), pv(8), pv(INTRO_H_L), palette.primary),
    pvBars({ x: pv(40), y: pv(HERO_H_L + 28), w: pv(W * 0.5), lines: 1, barH: 5, gap: 0, fill: palette.primary })
  ];

  // 3 numbered cards in a row
  for (let col = 0; col < cols; col++) {
    const cx = PAD + col * (colW + GAP);
    const cy = gridTop;
    parts.push(pvRect(pv(cx), pv(cy), pv(colW), pv(rowH), DARK_PANEL, { rx: 4, stroke: palette.primary }));
    parts.push(pvRect(pv(cx + CARD_RX), pv(cy), pv(colW - CARD_RX * 2), pv(4), palette.primary));
    // number badge
    parts.push(pvRect(pv(cx + 24), pv(cy + 18), pv(BADGE_W_L), pv(BADGE_H_L), palette.primary, { rx: 6 }));
    // label chip
    parts.push(pvRect(pv(cx + 24), pv(cy + 18 + BADGE_H_L + 10), pv(colW * 0.52), pv(16), DARK_BASE, { rx: 3 }));
    // text bars
    parts.push(pvBars({ x: pv(cx + 24), y: pv(cy + 18 + BADGE_H_L + 36), w: pv(colW - 48), lines: 3, barH: 3, gap: 3, fill: DARK_INK }));
  }

  // footer
  const footerY = H - FOOTER_H_L - CTA_H_L;
  parts.push(pvRect(0, pv(footerY), PV_LAND_W, pv(FOOTER_H_L), DARK_BASE));
  parts.push(pvRect(0, pv(footerY), PV_LAND_W, pv(3), palette.primary));
  const slotSide = Math.min(FOOTER_H_L - 32, 130);
  parts.push(pvSlot(pv(W - PAD - slotSide), pv(footerY + (FOOTER_H_L - slotSide) / 2), pv(slotSide), pv(slotSide), palette.primary));

  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H_L), PV_LAND_W, pv(CTA_H_L), palette.primary));
  parts.push(pvBars({ x: pv(100), y: pv(H - CTA_H_L + 32), w: pv(W - 200), lines: 1, barH: 7, gap: 0, fill: DARK_BASE, align: 'center' }));

  return svgWrapO(parts, DARK_BASE, 'landscape');
}

// ── export ────────────────────────────────────────────────────────────────────

export default {
  id: 'gisp-release-numbered',
  name: 'GISP Release Numbered',
  style: 'infographic',
  description: 'A dark infographic with a diagonal-split hero (bold yellow left zone over a dark polygon slant), numbered update cards (auto badge + label chip + body text per block), a dark footer with a QR image slot, and a primary-colour CTA bar. Ideal for platform release announcements and numbered update summaries.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 6 },
    blocks: { kind: 'sequence', min: 3, max: 5, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
