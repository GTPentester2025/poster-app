// v2 template — sam-policy-numbered (style: infographic). Reinterpretation of
// the AB InBev "GISP Software Asset Management Policy" poster (source: 17.html)
// at the v2 canvas scale. The archetype is a tall dark policy infographic with a
// diagonal-split hero (yellow left zone over a dark polygon slant), a context
// strip (SCOPE / PURPOSE definition band), numbered key-principle cards (each
// block = a bold two-digit auto-number badge + heading chip + body text), an
// ISMS footer with a QR content imageSlot, and a primary-colour CTA bar.
//
// Source → port:
//   .header (yellow bg, diagonal clip, title, logo)   → diagonal hero (palette.primary left)
//   .header-bg + .laptop-img (embedded base64 image)  → backgroundImageSlot (bg) — no baked bitmap
//   .qr-code-banner (bottom-right QR)                → imageSlot in footer (slot-qr)
//   .intro-section (black band, paragraph text)       → context strip (definition/scope)
//   .badge-title + .card-text / .bullet-list (grid)  → numbered key-principle cards
//     each card = heading chip (fieldRef:'heading') + body text (fieldRef:'text')
//   .key-principles-header (right column)             → section label in context strip
//   background #1a1a1a / #000                         → DARK_BASE / DARK_PANEL
//   brand-yellow #f2ba13                              → palette.primary
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
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM
} from './decor.js';

// ── constants ─────────────────────────────────────────────────────────────────

const PAD = 64;
const GAP = 18;
const CARD_RX = 20;

// Hero zone heights
const HERO_H_P = 420;       // portrait hero height
const HERO_H_L = 300;       // landscape hero height

// Context strip heights (SCOPE/PURPOSE band)
const CTX_H_P = 110;        // portrait context strip
const CTX_H_L = 88;         // landscape context strip

// Footer heights
const FOOTER_H_P = 170;     // portrait footer
const FOOTER_H_L = 130;     // landscape footer

// CTA bar heights
const CTA_H_P = 120;        // portrait CTA bar
const CTA_H_L = 96;         // landscape CTA bar

// Number badge dimensions
const BADGE_W = 110;        // portrait number badge width
const BADGE_H = 110;        // portrait number badge height
const BADGE_W_L = 84;       // landscape number badge width
const BADGE_H_L = 84;       // landscape number badge height

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
// Yellow left field; dark right panel with diagonal clip (polygon); policy title
// + SAM definition / subheadline in the yellow zone.

function heroSection(o, content, palette, fonts, W, y, h) {
  // Yellow full-width background behind hero
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));

  // Dark right slant polygon — clips at ~50% from left at top, ~40% from left at bottom
  const slantTopX = Math.round(W * 0.50);
  const slantBotX = Math.round(W * 0.40);
  o.push(polygon(
    [
      { x: slantTopX, y },
      { x: W, y },
      { x: W, y: y + h },
      { x: slantBotX, y: y + h }
    ],
    { fill: DARK_BASE, layerRole: 'background' }
  ));

  // Subtle dot grid texture on the dark slant zone
  o.push(...dotGrid({
    x: slantTopX + 100, y: y + 40,
    cols: 3, rows: 5, gap: 44, dotR: 3,
    color: palette.primary, intensity: 0.4
  }));

  // Thin accent rule at bottom of hero
  o.push(rect({ x: 0, y: y + h - 5, w: W, h: 5, fill: DARK_BASE, opacity: 0.25, layerRole: 'decor' }));

  // ── left content zone ─────────────────────────────────────────────────────
  const contentW = Math.round(W * 0.46) - PAD;
  const innerX = PAD;
  let cursor = y + PAD;

  // "GISP" top-label (decorative — not content-bound)
  const superLabel = 'GISP';
  const superSize = fitFontSize(superLabel, {
    width: contentW, height: Math.round(h * 0.20), maxSize: 100, minSize: 80, lineHeight: 0.9
  });
  const superH = estTextHeight(superLabel, superSize, contentW, 0.9);
  o.push(textbox({
    text: superLabel, x: innerX, y: cursor, w: contentW,
    fontSize: superSize, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, lineHeight: 0.9, align: 'left',
    layerRole: 'decor', bgRef: palette.primary
  }));
  cursor += superH + 10;

  // SAM label (decorative)
  const samLabel = 'SOFTWARE ASSET MANAGEMENT';
  const samSize = fitFontSize(samLabel, {
    width: contentW, height: Math.round(h * 0.12), maxSize: 28, minSize: 20, lineHeight: 1.1
  });
  const samH = estTextHeight(samLabel, samSize, contentW, 1.1);
  o.push(textbox({
    text: samLabel, x: innerX, y: cursor, w: contentW,
    fontSize: samSize, fontFamily: fonts.head, fontWeight: '700',
    fill: DARK_BASE, lineHeight: 1.1, align: 'left',
    layerRole: 'decor', bgRef: palette.primary
  }));
  cursor += samH + 16;

  // Headline — policy title (verbatim from content.headline)
  const headBudget = h - (cursor - y) - PAD - 80;
  const { fontSize: headSize, height: headH } = fitTextBlock(content.headline, {
    width: contentW, height: Math.max(headBudget, 80 * 1.08),
    maxSize: 80, minSize: 80, lineHeight: 1.05
  });
  o.push(textbox({
    text: content.headline, x: innerX, y: cursor, w: contentW,
    fontSize: headSize, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, lineHeight: 1.05, align: 'left',
    layerRole: 'headline', bgRef: palette.primary
  }));
  cursor += headH + 14;

  // Subheadline (policy definition/tagline)
  const subText = content.subheadline || 'Ensuring responsible use of software assets';
  const subBudget = h - (cursor - y) - 16;
  if (subBudget > 36) {
    const subSize = fitFontSize(subText, {
      width: contentW, height: Math.min(subBudget, 72), maxSize: 34, minSize: 24, lineHeight: 1.25
    });
    o.push(textbox({
      text: subText, x: innerX, y: cursor, w: contentW,
      fontSize: subSize, fontFamily: fonts.head, fontWeight: '600',
      fill: DARK_BASE, lineHeight: 1.25, align: 'left',
      layerRole: 'subheadline', bgRef: palette.primary
    }));
  }
}

// ── context strip (SCOPE / PURPOSE dark band below hero) ─────────────────────

function contextStrip(o, palette, fonts, W, y, h) {
  o.push(rect({ x: 0, y, w: W, h, fill: DARK_PANEL, layerRole: 'background' }));
  // left accent bar
  o.push(rect({ x: 0, y, w: 6, h, fill: palette.primary, layerRole: 'decor' }));

  // Two label badges: SCOPE and PURPOSE, side by side
  const badges = ['SCOPE', 'PURPOSE'];
  const badgeW = Math.round((W - 40 - GAP) * 0.22);
  const badgeH = Math.min(h - 28, 52);
  const startX = 40;
  let bx = startX;
  badges.forEach((label) => {
    const bSize = fitFontSize(label, { width: badgeW - 24, height: badgeH - 16, maxSize: 26, minSize: 18, lineHeight: 1.1 });
    const bH = estTextHeight(label, bSize, badgeW - 24, 1.1);
    o.push(rect({ x: bx, y: y + Math.round((h - badgeH) / 2), w: badgeW, h: badgeH, fill: palette.primary, rx: 8, layerRole: 'decor' }));
    o.push(textbox({
      text: label, x: bx + 12, y: y + Math.round((h - bH) / 2),
      w: badgeW - 24, fontSize: bSize, fontFamily: fonts.head, fontWeight: '800',
      fill: DARK_BASE, align: 'center', lineHeight: 1.1,
      layerRole: 'decor', bgRef: palette.primary
    }));
    bx += badgeW + GAP;
  });

  // Context descriptor text (decorative)
  const descW = W - bx - PAD;
  if (descW > 100) {
    const desc = 'Governs acquisition, deployment, compliance and retirement of all software assets across the organisation.';
    const descSize = fitFontSize(desc, { width: descW, height: h - 20, maxSize: 28, minSize: 20, lineHeight: 1.25 });
    const descH = estTextHeight(desc, descSize, descW, 1.25);
    o.push(textbox({
      text: desc, x: bx, y: y + Math.round((h - descH) / 2),
      w: descW, fontSize: descSize, fontFamily: fonts.body, fontWeight: '500',
      fill: DARK_INK_DIM, lineHeight: 1.25, align: 'left',
      layerRole: 'decor', bgRef: DARK_PANEL
    }));
  }
}

// ── single numbered principle card ────────────────────────────────────────────
// CRITICAL: both 'heading' and 'text' fields carry msgId + fieldRef.
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
  let cursor = y + 5 + 16;

  // ── number badge (decorative, not content-bound) ──────────────────────────
  const numStr = String(idx + 1).padStart(2, '0');
  o.push(rect({
    x: innerX, y: cursor, w: badgeW, h: badgeH,
    fill: palette.primary, rx: Math.min(Math.round(badgeH / 2), 14),
    layerRole: 'decor'
  }));
  const numSize = fitFontSize(numStr, { width: badgeW - 16, height: badgeH - 16, maxSize: 52, minSize: 30, lineHeight: 1.0 });
  const numH = estTextHeight(numStr, numSize, badgeW - 16, 1.0);
  o.push(textbox({
    text: numStr, x: innerX + 8, y: cursor + Math.round((badgeH - numH) / 2),
    w: badgeW - 16, fontSize: numSize, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, align: 'center', lineHeight: 1.0,
    layerRole: 'decor', bgRef: palette.primary
  }));
  cursor += badgeH + 12;

  // ── heading chip (fieldRef:'heading') ─────────────────────────────────────
  const chipMaxW = Math.min(innerW, Math.round(innerW * 0.95));
  // Reserve space: badge + gap consumed; heading chip; gap; text; bottom pad
  // Estimate chip height ≈ 26px fontSize * 1.4 + padY*2 ≈ 60px max
  const chipBudget = Math.min(56, Math.round((h - (cursor - y) - 20) * 0.30));
  const chipMaxH = Math.max(36, chipBudget);
  const [pill, labelTb] = chip({
    text: b.heading || 'Principle',
    x: innerX, y: cursor,
    fontSize: 24, bg: palette.primary, color: DARK_BASE,
    font: fonts.head, maxW: chipMaxW, maxH: chipMaxH,
    msgId: b.id
  });
  o.push(pill);
  o.push({ ...labelTb, fieldRef: 'heading' });

  const chipH = pill.height ?? Math.round(24 * 1.4 + 24);
  cursor += chipH + 12;

  // ── text message (fieldRef:'text') ────────────────────────────────────────
  // Budget = REAL remaining card space minus bottom padding
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

// ── ISMS footer strip ─────────────────────────────────────────────────────────

function footerStrip(o, palette, fonts, W, y, h) {
  o.push(rect({ x: 0, y, w: W, h, fill: DARK_BASE, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: palette.primary, layerRole: 'decor' }));

  // ISMS label + compliance text (left side, text-free from QR slot)
  const textW = Math.round(W * 0.60) - PAD;
  const textX = PAD;
  let cursor = y + 22;

  const ismsLabel = 'ISMS COMPLIANCE';
  const ismsSize = fitFontSize(ismsLabel, { width: textW, height: 40, maxSize: 32, minSize: 22, lineHeight: 1.1 });
  const ismsH = estTextHeight(ismsLabel, ismsSize, textW, 1.1);
  o.push(textbox({
    text: ismsLabel, x: textX, y: cursor, w: textW,
    fontSize: ismsSize, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, lineHeight: 1.1,
    layerRole: 'decor', bgRef: DARK_BASE
  }));
  cursor += ismsH + 8;

  const compNote = 'Non-compliance with this policy may result in disciplinary action. Contact the ISMS team for guidance.';
  const compBudget = h - (cursor - y) - 16;
  const compSize = fitFontSize(compNote, { width: textW, height: Math.max(compBudget, 40), maxSize: 26, minSize: 20, lineHeight: 1.3 });
  o.push(textbox({
    text: compNote, x: textX, y: cursor, w: textW,
    fontSize: compSize, fontFamily: fonts.body, fontWeight: '500',
    fill: DARK_INK_DIM, lineHeight: 1.3,
    layerRole: 'decor', bgRef: DARK_BASE
  }));

  // content imageSlot (QR code) — right side of footer, text-free region
  const slotSide = Math.min(h - 32, 130);
  const slotX = W - PAD - slotSide;
  const slotY = y + Math.round((h - slotSide) / 2);
  o.push(imageSlot({
    slotId: 'slot-qr',
    x: slotX, y: slotY, w: slotSide, h: slotSide,
    styleHint: 'QR code linking to the Software Asset Management policy portal, clean on white background, square format',
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
    styleHint: 'dark technology policy background, abstract circuit board or digital network pattern, deep charcoal, no text, subtle glow',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ambient decor
  o.push(...meshGlow({ spots: [
    { x: 240, y: 480, r: 360, color: palette.primary },
    { x: W - 220, y: H - 580, r: 300, color: palette.accent ?? palette.primary }
  ], intensity: 0.48 }));

  // ── hero ──────────────────────────────────────────────────────────────────
  heroSection(o, content, palette, fonts, W, 0, HERO_H_P);

  // ── context strip ─────────────────────────────────────────────────────────
  const ctxY = HERO_H_P;
  contextStrip(o, palette, fonts, W, ctxY, CTX_H_P);

  // ── numbered card grid ────────────────────────────────────────────────────
  const gridTop = ctxY + CTX_H_P + GAP;
  const gridBottom = H - FOOTER_H_P - CTA_H_P - GAP;
  const gridH = gridBottom - gridTop;
  const blocks = content.blocks || [];

  // Portrait: 2 columns
  cardGrid(o, blocks, palette, fonts, {
    x: PAD, y: gridTop, w: W - PAD * 2, h: gridH,
    cols: 2, badgeW: BADGE_W, badgeH: BADGE_H
  });

  // ── footer ────────────────────────────────────────────────────────────────
  footerStrip(o, palette, fonts, W, H - FOOTER_H_P - CTA_H_P, FOOTER_H_P);

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
    styleHint: 'dark technology policy background, abstract circuit board or digital network pattern, deep charcoal, no text, subtle glow',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ambient decor
  o.push(...meshGlow({ spots: [
    { x: 320, y: 220, r: 320, color: palette.primary },
    { x: W - 300, y: H - 260, r: 280, color: palette.accent ?? palette.primary }
  ], intensity: 0.48 }));

  // ── hero ──────────────────────────────────────────────────────────────────
  heroSection(o, content, palette, fonts, W, 0, HERO_H_L);

  // ── context strip ─────────────────────────────────────────────────────────
  const ctxY = HERO_H_L;
  contextStrip(o, palette, fonts, W, ctxY, CTX_H_L);

  // ── numbered card grid ────────────────────────────────────────────────────
  const gridTop = ctxY + CTX_H_L + GAP;
  const gridBottom = H - FOOTER_H_L - CTA_H_L - GAP;
  const gridH = gridBottom - gridTop;
  const blocks = content.blocks || [];

  // Landscape: 2 columns for min(3) baseline, 2 columns for max(4) (2×2)
  const cols = blocks.length <= 3 ? Math.min(3, blocks.length) : 2;
  cardGrid(o, blocks, palette, fonts, {
    x: PAD, y: gridTop, w: W - PAD * 2, h: gridH,
    cols: cols || 2, badgeW: BADGE_W_L, badgeH: BADGE_H_L
  });

  // ── footer ────────────────────────────────────────────────────────────────
  footerStrip(o, palette, fonts, W, H - FOOTER_H_L - CTA_H_L, FOOTER_H_L);

  // ── CTA bar ───────────────────────────────────────────────────────────────
  ctaBar(o, content.callToAction, palette, fonts, W, H - CTA_H_L, CTA_H_L);

  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────

function previewPortrait(palette) {
  const W = 1414;
  const H = 2000;

  const gridTop = HERO_H_P + CTX_H_P + GAP;
  const gridBottom = H - FOOTER_H_P - CTA_H_P - GAP;
  const gridH = gridBottom - gridTop;
  const cols = 2;
  const colW = Math.floor((W - PAD * 2 - GAP * (cols - 1)) / cols);
  const rows = 2;
  const rowH = Math.floor((gridH - GAP * (rows - 1)) / rows);

  const slantTopX = Math.round(W * 0.50);
  const slantBotX = Math.round(W * 0.40);

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
    pvBars({ x: pv(PAD), y: pv(40), w: pv(W * 0.36), lines: 1, barH: 16, gap: 0, fill: DARK_BASE }),
    // SAM label bar
    pvBars({ x: pv(PAD), y: pv(90), w: pv(W * 0.42), lines: 1, barH: 6, gap: 0, fill: DARK_BASE }),
    // headline bars
    pvBars({ x: pv(PAD), y: pv(120), w: pv(W * 0.40), lines: 2, barH: 10, gap: 6, fill: DARK_BASE }),
    // sub bars
    pvBars({ x: pv(PAD), y: pv(166), w: pv(W * 0.36), lines: 1, barH: 5, gap: 0, fill: DARK_BASE }),
    // context strip
    pvRect(0, pv(HERO_H_P), pv(W), pv(CTX_H_P), DARK_PANEL),
    pvRect(0, pv(HERO_H_P), pv(6), pv(CTX_H_P), palette.primary),
    // SCOPE badge
    pvRect(pv(40), pv(HERO_H_P + 30), pv(120), pv(50), palette.primary, { rx: 4 }),
    // PURPOSE badge
    pvRect(pv(172), pv(HERO_H_P + 30), pv(120), pv(50), palette.primary, { rx: 4 }),
    // desc bars
    pvBars({ x: pv(304), y: pv(HERO_H_P + 36), w: pv(W * 0.48), lines: 2, barH: 4, gap: 4, fill: DARK_INK_DIM })
  ];

  // 4 numbered cards in 2×2 grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = PAD + col * (colW + GAP);
      const cy = gridTop + row * (rowH + GAP);
      parts.push(pvRect(pv(cx), pv(cy), pv(colW), pv(rowH), DARK_PANEL, { rx: 4, stroke: palette.primary }));
      parts.push(pvRect(pv(cx + CARD_RX), pv(cy), pv(colW - CARD_RX * 2), pv(4), palette.primary));
      // number badge
      parts.push(pvRect(pv(cx + 24), pv(cy + 22), pv(BADGE_W), pv(BADGE_H), palette.primary, { rx: 8 }));
      // heading chip
      parts.push(pvRect(pv(cx + 24), pv(cy + 22 + BADGE_H + 12), pv(colW * 0.55), pv(20), palette.primary, { rx: 4 }));
      // text bars
      parts.push(pvBars({ x: pv(cx + 24), y: pv(cy + 22 + BADGE_H + 42), w: pv(colW - 48), lines: 3, barH: 4, gap: 4, fill: DARK_INK }));
    }
  }

  // footer
  const footerY = H - FOOTER_H_P - CTA_H_P;
  parts.push(pvRect(0, pv(footerY), pv(W), pv(FOOTER_H_P), DARK_BASE));
  parts.push(pvRect(0, pv(footerY), pv(W), pv(3), palette.primary));
  parts.push(pvBars({ x: pv(PAD), y: pv(footerY + 22), w: pv(W * 0.4), lines: 1, barH: 6, gap: 0, fill: palette.primary }));
  parts.push(pvBars({ x: pv(PAD), y: pv(footerY + 50), w: pv(W * 0.55), lines: 3, barH: 3, gap: 4, fill: DARK_INK_DIM }));
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

  const gridTop = HERO_H_L + CTX_H_L + GAP;
  const gridBottom = H - FOOTER_H_L - CTA_H_L - GAP;
  const gridH = gridBottom - gridTop;
  // Preview: 3 cols (representative of min(3) layout)
  const cols = 3;
  const colW = Math.floor((W - PAD * 2 - GAP * (cols - 1)) / cols);
  const rowH = gridH;

  const slantTopX = Math.round(W * 0.50);
  const slantBotX = Math.round(W * 0.40);

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
    pvBars({ x: pv(PAD), y: pv(26), w: pv(W * 0.32), lines: 1, barH: 14, gap: 0, fill: DARK_BASE }),
    // headline bars
    pvBars({ x: pv(PAD), y: pv(58), w: pv(W * 0.38), lines: 2, barH: 8, gap: 5, fill: DARK_BASE }),
    // context strip
    pvRect(0, pv(HERO_H_L), PV_LAND_W, pv(CTX_H_L), DARK_PANEL),
    pvRect(0, pv(HERO_H_L), pv(6), pv(CTX_H_L), palette.primary),
    // SCOPE badge
    pvRect(pv(40), pv(HERO_H_L + 24), pv(96), pv(40), palette.primary, { rx: 3 }),
    // PURPOSE badge
    pvRect(pv(148), pv(HERO_H_L + 24), pv(96), pv(40), palette.primary, { rx: 3 }),
    // desc bars
    pvBars({ x: pv(256), y: pv(HERO_H_L + 30), w: pv(W * 0.50), lines: 2, barH: 3, gap: 3, fill: DARK_INK_DIM })
  ];

  // 3 numbered cards in a row
  for (let col = 0; col < cols; col++) {
    const cx = PAD + col * (colW + GAP);
    const cy = gridTop;
    parts.push(pvRect(pv(cx), pv(cy), pv(colW), pv(rowH), DARK_PANEL, { rx: 4, stroke: palette.primary }));
    parts.push(pvRect(pv(cx + CARD_RX), pv(cy), pv(colW - CARD_RX * 2), pv(4), palette.primary));
    // number badge
    parts.push(pvRect(pv(cx + 24), pv(cy + 18), pv(BADGE_W_L), pv(BADGE_H_L), palette.primary, { rx: 6 }));
    // heading chip
    parts.push(pvRect(pv(cx + 24), pv(cy + 18 + BADGE_H_L + 10), pv(colW * 0.52), pv(16), palette.primary, { rx: 3 }));
    // text bars
    parts.push(pvBars({ x: pv(cx + 24), y: pv(cy + 18 + BADGE_H_L + 36), w: pv(colW - 48), lines: 3, barH: 3, gap: 3, fill: DARK_INK }));
  }

  // footer
  const footerY = H - FOOTER_H_L - CTA_H_L;
  parts.push(pvRect(0, pv(footerY), PV_LAND_W, pv(FOOTER_H_L), DARK_BASE));
  parts.push(pvRect(0, pv(footerY), PV_LAND_W, pv(3), palette.primary));
  parts.push(pvBars({ x: pv(PAD), y: pv(footerY + 18), w: pv(W * 0.38), lines: 1, barH: 5, gap: 0, fill: palette.primary }));
  parts.push(pvBars({ x: pv(PAD), y: pv(footerY + 42), w: pv(W * 0.52), lines: 2, barH: 3, gap: 3, fill: DARK_INK_DIM }));
  const slotSide = Math.min(FOOTER_H_L - 32, 130);
  parts.push(pvSlot(pv(W - PAD - slotSide), pv(footerY + (FOOTER_H_L - slotSide) / 2), pv(slotSide), pv(slotSide), palette.primary));

  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H_L), PV_LAND_W, pv(CTA_H_L), palette.primary));
  parts.push(pvBars({ x: pv(100), y: pv(H - CTA_H_L + 32), w: pv(W - 200), lines: 1, barH: 7, gap: 0, fill: DARK_BASE, align: 'center' }));

  return svgWrapO(parts, DARK_BASE, 'landscape');
}

// ── export ────────────────────────────────────────────────────────────────────

export default {
  id: 'sam-policy-numbered',
  name: 'SAM Policy Numbered',
  style: 'infographic',
  description: 'A tall dark policy infographic for Software Asset Management: diagonal-split hero (yellow left zone over dark polygon slant), policy title and definition subheadline, SCOPE/PURPOSE context strip, numbered key-principle cards (auto badge + heading chip + body text per block), ISMS compliance footer with QR image slot, and a primary-colour CTA bar.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 8 },
    blocks: { kind: 'sequence', min: 3, max: 4, fields: ['heading', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
