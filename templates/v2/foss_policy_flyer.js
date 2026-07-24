// v2 template — foss-policy-flyer (style: infographic). Reinterpretation of
// the AB InBev "FOSS Policy" A4-portrait flyer (source: 18.html) at the v2
// canvas scale. The archetype is a light-surface A4-portrait policy document:
// a primary-colour header band (title), a cream/white About-intro card, a
// column of objective rows (each block = bold label chip + descriptive text),
// a Scope/Support context strip, and a footer row (tagline text + QR
// content imageSlot). The source is a LIGHT sheet; we honour that spirit with
// a LIGHT legibility scrim (subtle, near-white top wash) over the background
// image slot, giving a well-lit document feel while meeting the bg contract.
//
// Source → port:
//   yellow header + title "FOSS POLICY"      → primary-colour header band (palette.primary)
//   "About Free and Open Source Software"    → headline verbatim in header
//   intro/definition paragraph               → about-card (DARK_PANEL / light panel)
//   numbered Objectives (1-N rows)           → block rows — label chip (fieldRef:'label') +
//                                              body text (fieldRef:'text')
//   Scope + Support sections                 → context strip (DARK_PANEL)
//   tagline / signature                      → decor tagline text
//   QR code (embedded in source)             → imageSlot slotId:'slot-qr'
//   white A4 background                      → backgroundImageSlot + light scrim
//   Montserrat → fonts.head; Open Sans → fonts.body
//
// Design reinterpreted at 1414×2000 / 2000×1414 with v2 language.
// Yellow = palette.primary; dark grounds = DARK_* anchors; no hardcoded hex.

import {
  textbox, rect, chip, imageSlot, backgroundImageSlot,
  fitFontSize, fitTextBlock, estTextHeight,
  pv, pvRect, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, dotGrid, legibilityScrim,
  svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM
} from './decor.js';

// ── constants ─────────────────────────────────────────────────────────────────

const PAD = 72;
const GAP = 16;
const CARD_RX = 20;

// Header band heights (contains title/headline)
const HEADER_H_P = 320;   // portrait
const HEADER_H_L = 220;   // landscape

// About intro card heights
const ABOUT_H_P = 220;    // portrait
const ABOUT_H_L = 160;    // landscape

// Context strip (Scope/Support) heights
const CTX_H_P = 130;      // portrait
const CTX_H_L = 100;      // landscape

// Footer heights
const FOOTER_H_P = 160;   // portrait
const FOOTER_H_L = 130;   // landscape

// CTA bar heights
const CTA_H_P = 120;      // portrait
const CTA_H_L = 96;       // landscape

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

// ── header band ───────────────────────────────────────────────────────────────
// Primary-colour full-width band: top accent rule, the FOSS Policy label
// (decorative), and the main headline from content.headline.

function headerBand(o, content, palette, fonts, W, y, h) {
  // Primary-colour background
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));

  // Subtle dark top accent rule
  o.push(rect({ x: 0, y, w: W, h: 6, fill: DARK_BASE, opacity: 0.18, layerRole: 'decor' }));

  // Subtle dot grid accent on right side (decorative atmosphere)
  o.push(...dotGrid({
    x: W - 220, y: y + 40,
    cols: 4, rows: 4, gap: 44, dotR: 5,
    color: DARK_BASE, intensity: 0.18
  }));

  const innerX = PAD;
  const innerW = W - PAD * 2;
  let cursor = y + PAD;

  // "FOSS POLICY" supra-label (decorative)
  const supraLabel = 'FOSS POLICY';
  const supraSize = fitFontSize(supraLabel, {
    width: innerW * 0.7, height: Math.round(h * 0.16), maxSize: 38, minSize: 26, lineHeight: 1.1
  });
  const supraH = estTextHeight(supraLabel, supraSize, innerW * 0.7, 1.1);
  o.push(textbox({
    text: supraLabel, x: innerX, y: cursor, w: Math.round(innerW * 0.7),
    fontSize: supraSize, fontFamily: fonts.head, fontWeight: '800',
    fill: DARK_BASE, lineHeight: 1.1, align: 'left',
    layerRole: 'decor', bgRef: palette.primary
  }));
  cursor += supraH + 10;

  // Thin dark rule divider
  o.push(rect({ x: innerX, y: cursor, w: Math.round(innerW * 0.5), h: 4, fill: DARK_BASE, opacity: 0.22, layerRole: 'decor' }));
  cursor += 18;

  // Headline — verbatim from content.headline (≥80)
  const headBudget = h - (cursor - y) - PAD;
  const { fontSize: headSize, height: headH } = fitTextBlock(content.headline, {
    width: innerW, height: Math.max(headBudget, 80 * 1.1),
    maxSize: 96, minSize: 80, lineHeight: 1.05
  });
  o.push(textbox({
    text: content.headline, x: innerX, y: cursor, w: innerW,
    fontSize: headSize, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, lineHeight: 1.05, align: 'left',
    layerRole: 'headline', bgRef: palette.primary
  }));
  cursor += headH + 14;

  // Subheadline (tagline / short description)
  const subText = content.subheadline || 'Enabling responsible use of open-source software';
  const subBudget = h - (cursor - y) - 12;
  if (subBudget > 36) {
    const subSize = fitFontSize(subText, {
      width: innerW, height: Math.min(subBudget, 80), maxSize: 36, minSize: 24, lineHeight: 1.25
    });
    o.push(textbox({
      text: subText, x: innerX, y: cursor, w: innerW,
      fontSize: subSize, fontFamily: fonts.body, fontWeight: '600',
      fill: DARK_BASE, lineHeight: 1.25, align: 'left',
      layerRole: 'subheadline', bgRef: palette.primary
    }));
  }
}

// ── about intro card ──────────────────────────────────────────────────────────
// Translucent dark card with "ABOUT / INTRODUCTION" heading + short body text.
// This is a decorative zone (not content-bound), analogous to the source's
// "About Free and Open Source Software" definition paragraph.

function aboutCard(o, palette, fonts, W, y, h) {
  o.push(rect({
    x: PAD, y, w: W - PAD * 2, h,
    fill: DARK_PANEL, rx: CARD_RX,
    stroke: palette.primary, strokeWidth: 2,
    layerRole: 'background'
  }));

  // Primary accent top rule
  o.push(rect({ x: PAD + CARD_RX, y, w: W - PAD * 2 - CARD_RX * 2, h: 5, fill: palette.primary, layerRole: 'decor' }));

  const innerX = PAD + 28;
  const innerW = W - PAD * 2 - 56;
  let cursor = y + 5 + 18;

  // Section heading "ABOUT / INTRODUCTION"
  const headLabel = 'ABOUT / INTRODUCTION';
  const headSize = fitFontSize(headLabel, {
    width: innerW, height: 48, maxSize: 32, minSize: 22, lineHeight: 1.1
  });
  const headLabelH = estTextHeight(headLabel, headSize, innerW, 1.1);
  o.push(textbox({
    text: headLabel, x: innerX, y: cursor, w: innerW,
    fontSize: headSize, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, lineHeight: 1.1, align: 'left',
    layerRole: 'decor', bgRef: DARK_PANEL
  }));
  cursor += headLabelH + 10;

  // Intro body text (decorative — not content-bound)
  const intro = 'Free and Open Source Software (FOSS) is software whose source code is freely available for use, modification, and distribution. This policy governs how FOSS is adopted, used, and contributed to across the organisation, balancing innovation with license compliance and security.';
  const introBudget = h - (cursor - y) - 16;
  if (introBudget > 40) {
    const introSize = fitFontSize(intro, {
      width: innerW, height: Math.max(introBudget, 40), maxSize: 28, minSize: 20, lineHeight: 1.4
    });
    o.push(textbox({
      text: intro, x: innerX, y: cursor, w: innerW,
      fontSize: introSize, fontFamily: fonts.body, fontWeight: '500',
      fill: DARK_INK_DIM, lineHeight: 1.4, align: 'left',
      layerRole: 'decor', bgRef: DARK_PANEL
    }));
  }
}

// ── objective row (single block) ──────────────────────────────────────────────
// Each block renders as a horizontal row: primary-coloured label chip on the
// left, body text to the right.
// CRITICAL: label carries msgId + fieldRef:'label'; text carries msgId + fieldRef:'text'.

function objectiveRow(o, b, idx, palette, fonts, { x, y, w, h }) {
  // Row background card (alternating subtle shade)
  const fill = idx % 2 === 0 ? DARK_PANEL : DARK_BASE;
  o.push(rect({
    x, y, w, h,
    fill, rx: CARD_RX,
    stroke: palette.primary, strokeWidth: 1,
    layerRole: 'background'
  }));

  // Left accent stripe
  o.push(rect({ x, y: y + CARD_RX, w: 5, h: h - CARD_RX * 2, fill: palette.primary, layerRole: 'decor' }));

  const innerX = x + 20;
  // ── label chip (fieldRef:'label') ────────────────────────────────────────
  const chipMaxW = Math.min(260, Math.round(w * 0.30));
  const chipMaxH = Math.min(52, Math.round(h * 0.55));
  const [pill, labelTb] = chip({
    text: b.label || 'Objective',
    x: innerX, y: y + Math.round((h - Math.min(chipMaxH, 44)) / 2),
    fontSize: 24, bg: palette.primary, color: DARK_BASE,
    font: fonts.head, maxW: chipMaxW, maxH: chipMaxH,
    msgId: b.id
  });
  o.push(pill);
  o.push({ ...labelTb, fieldRef: 'label' });

  // ── text message (fieldRef:'text') ────────────────────────────────────────
  const textX = innerX + chipMaxW + GAP;
  const textW = w - (textX - x) - 24;
  // Real remaining height budget
  const textBudget = h - 20;
  const { fontSize: msgSize } = fitTextBlock(b.text, {
    width: textW,
    height: Math.max(textBudget, 38 * 1.28),
    maxSize: 42, minSize: 38, lineHeight: 1.28
  });
  o.push({
    ...textbox({
      text: b.text,
      x: textX, y: y + Math.round((h - estTextHeight(b.text, msgSize, textW, 1.28)) / 2),
      w: textW, fontSize: msgSize,
      fontFamily: fonts.body, fontWeight: '600',
      fill: DARK_INK, lineHeight: 1.28,
      layerRole: 'message', msgId: b.id, bgRef: fill
    }),
    fieldRef: 'text'
  });
}

// ── objectives list ───────────────────────────────────────────────────────────
// Renders all blocks as stacked objective rows. Each row gets an equal slice
// of the available height budget so max(5) still fits without overflow.

function objectivesList(o, blocks, palette, fonts, { x, y, w, h }) {
  const n = blocks.length;
  if (n === 0) return;
  const rowGap = Math.min(GAP, Math.round(h * 0.03));
  const rowH = Math.floor((h - rowGap * (n - 1)) / n);

  blocks.forEach((b, i) => {
    objectiveRow(o, b, i, palette, fonts, {
      x, y: y + i * (rowH + rowGap), w, h: rowH
    });
  });
}

// ── context strip (Scope / Support) ──────────────────────────────────────────

function contextStrip(o, palette, fonts, W, y, h) {
  o.push(rect({ x: 0, y, w: W, h, fill: DARK_PANEL, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: 6, h, fill: palette.primary, layerRole: 'decor' }));

  const badges = ['SCOPE', 'SUPPORT'];
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

  // Context descriptor
  const descW = W - bx - PAD;
  if (descW > 100) {
    const desc = 'Applies to all employees, contractors and third-party contributors who use or contribute to FOSS in any organisational system. Contact the ISMS team for guidance on license compatibility.';
    const descSize = fitFontSize(desc, { width: descW, height: h - 20, maxSize: 26, minSize: 18, lineHeight: 1.3 });
    const descH = estTextHeight(desc, descSize, descW, 1.3);
    o.push(textbox({
      text: desc, x: bx, y: y + Math.round((h - descH) / 2),
      w: descW, fontSize: descSize, fontFamily: fonts.body, fontWeight: '500',
      fill: DARK_INK_DIM, lineHeight: 1.3, align: 'left',
      layerRole: 'decor', bgRef: DARK_PANEL
    }));
  }
}

// ── footer strip (tagline + QR imageSlot) ────────────────────────────────────

function footerStrip(o, palette, fonts, W, y, h) {
  o.push(rect({ x: 0, y, w: W, h, fill: DARK_BASE, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: palette.primary, layerRole: 'decor' }));

  // QR slot: right side of footer
  const slotSide = Math.min(h - 28, 120);
  const slotX = W - PAD - slotSide;
  const slotY = y + Math.round((h - slotSide) / 2);
  o.push(imageSlot({
    slotId: 'slot-qr',
    x: slotX, y: slotY, w: slotSide, h: slotSide,
    styleHint: 'QR code linking to the FOSS Policy documentation portal, clean on white background, square format',
    stroke: palette.primary, rx: 10
  }));

  // Tagline text — left of QR slot
  const textW = slotX - PAD * 2;
  const tagline = 'Open Source. Responsible Innovation.';
  const tagSize = fitFontSize(tagline, { width: textW, height: h - 20, maxSize: 36, minSize: 22, lineHeight: 1.2 });
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
    styleHint: 'clean white or light cream document-texture background with subtle paper grain and faint geometric line pattern, policy document feel, no text, minimal',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim (light/subtle for white-sheet feel)
  o.push(...legibilityScrim({ w: W, h: H }));

  // ── layout zones ─────────────────────────────────────────────────────────
  // Portrait:
  //   [0..HEADER_H_P]         header band (primary colour, headline)
  //   [HEADER_H_P..+ABOUT_H_P] about card
  //   [above..gridBottom]     objectives list (all blocks)
  //   [gridBottom..+CTX_H_P]  context strip (Scope/Support)
  //   [+CTX_H_P..+FOOTER_H_P] footer (tagline + QR)
  //   [footer..H]             CTA bar

  const headerY = 0;
  const aboutY  = HEADER_H_P + GAP;
  const gridY   = aboutY + ABOUT_H_P + GAP;
  const ctxY    = H - CTA_H_P - FOOTER_H_P - CTX_H_P - GAP;
  const footerY = H - CTA_H_P - FOOTER_H_P;
  const ctaY    = H - CTA_H_P;

  // Grid (objectives list) fills the zone between about card and context strip
  const gridH = ctxY - gridY - GAP;

  headerBand(o, content, palette, fonts, W, headerY, HEADER_H_P);
  aboutCard(o, palette, fonts, W, aboutY, ABOUT_H_P);
  objectivesList(o, content.blocks || [], palette, fonts, {
    x: PAD, y: gridY, w: W - PAD * 2, h: gridH
  });
  contextStrip(o, palette, fonts, W, ctxY, CTX_H_P);
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
    styleHint: 'clean white or light cream document-texture background with subtle paper grain and faint geometric line pattern, policy document feel, no text, minimal',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ── landscape layout ─────────────────────────────────────────────────────
  // [0..HEADER_H_L]           header band
  // [HEADER_H_L..+ABOUT_H_L]  about card
  // [above..ctxY]             objectives list
  // [ctxY..+CTX_H_L]          context strip
  // [+CTX_H_L..+FOOTER_H_L]   footer
  // [footer..H]               CTA bar

  const headerY = 0;
  const aboutY  = HEADER_H_L + GAP;
  const gridY   = aboutY + ABOUT_H_L + GAP;
  const ctxY    = H - CTA_H_L - FOOTER_H_L - CTX_H_L - GAP;
  const footerY = H - CTA_H_L - FOOTER_H_L;
  const ctaY    = H - CTA_H_L;

  const gridH = ctxY - gridY - GAP;

  headerBand(o, content, palette, fonts, W, headerY, HEADER_H_L);
  aboutCard(o, palette, fonts, W, aboutY, ABOUT_H_L);
  objectivesList(o, content.blocks || [], palette, fonts, {
    x: PAD, y: gridY, w: W - PAD * 2, h: gridH
  });
  contextStrip(o, palette, fonts, W, ctxY, CTX_H_L);
  footerStrip(o, palette, fonts, W, footerY, FOOTER_H_L);
  ctaBar(o, content.callToAction, palette, fonts, W, ctaY, CTA_H_L);

  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────

function previewPortrait(palette) {
  const W = 1414;
  const H = 2000;

  const aboutY  = HEADER_H_P + GAP;
  const gridY   = aboutY + ABOUT_H_P + GAP;
  const ctxY    = H - CTA_H_P - FOOTER_H_P - CTX_H_P - GAP;
  const footerY = H - CTA_H_P - FOOTER_H_P;

  // Represent 4 blocks (middle of min/max range)
  const nBlocks = 4;
  const gridH = ctxY - gridY - GAP;
  const rowGap = Math.min(GAP, Math.round(gridH * 0.03));
  const rowH = Math.floor((gridH - rowGap * (nBlocks - 1)) / nBlocks);
  const chipW = Math.round((W - PAD * 2) * 0.22);

  const parts = [
    // header band
    pvRect(0, 0, pv(W), pv(HEADER_H_P), palette.primary),
    // FOSS POLICY supra label bar
    pvBars({ x: pv(PAD), y: pv(PAD + 12), w: pv(W * 0.35), lines: 1, barH: 10, gap: 0, fill: DARK_BASE }),
    // rule
    pvRect(pv(PAD), pv(PAD + 34), pv(W * 0.40), pv(3), DARK_BASE, { opacity: 0.22 }),
    // headline bars
    pvBars({ x: pv(PAD), y: pv(PAD + 52), w: pv(W * 0.78), lines: 2, barH: 18, gap: 9, fill: DARK_BASE }),
    // subheadline bar
    pvBars({ x: pv(PAD), y: pv(PAD + 130), w: pv(W * 0.60), lines: 1, barH: 6, gap: 0, fill: DARK_BASE }),
    // about card
    pvRect(pv(PAD), pv(aboutY), pv(W - PAD * 2), pv(ABOUT_H_P), DARK_PANEL, { rx: 5, stroke: palette.primary }),
    pvRect(pv(PAD + CARD_RX), pv(aboutY), pv(W - PAD * 2 - CARD_RX * 2), pv(4), palette.primary),
    pvBars({ x: pv(PAD + 28), y: pv(aboutY + 18), w: pv(W * 0.38), lines: 1, barH: 7, gap: 0, fill: palette.primary }),
    pvBars({ x: pv(PAD + 28), y: pv(aboutY + 42), w: pv(W - PAD * 2 - 56), lines: 4, barH: 4, gap: 4, fill: DARK_INK_DIM })
  ];

  // objective rows
  for (let i = 0; i < nBlocks; i++) {
    const ry = gridY + i * (rowH + rowGap);
    const rowFill = i % 2 === 0 ? DARK_PANEL : DARK_BASE;
    parts.push(pvRect(pv(PAD), pv(ry), pv(W - PAD * 2), pv(rowH), rowFill, { rx: 4, stroke: palette.primary }));
    // accent stripe
    parts.push(pvRect(pv(PAD), pv(ry + CARD_RX), pv(4), pv(rowH - CARD_RX * 2), palette.primary));
    // label chip
    parts.push(pvRect(pv(PAD + 20), pv(ry + Math.round((rowH - 28) / 2)), pv(chipW), pv(28), palette.primary, { rx: 4 }));
    // text bars
    const textX = PAD + 20 + chipW + GAP;
    parts.push(pvBars({ x: pv(textX), y: pv(ry + Math.round((rowH - 36) / 2)), w: pv(W - PAD - textX - 24), lines: 2, barH: 5, gap: 5, fill: DARK_INK }));
  }

  // context strip
  parts.push(pvRect(0, pv(ctxY), pv(W), pv(CTX_H_P), DARK_PANEL));
  parts.push(pvRect(0, pv(ctxY), pv(6), pv(CTX_H_P), palette.primary));
  const bW = Math.round((W - 40 - GAP) * 0.22);
  parts.push(pvRect(pv(40), pv(ctxY + 30), pv(bW), pv(48), palette.primary, { rx: 4 }));
  parts.push(pvRect(pv(40 + bW + GAP), pv(ctxY + 30), pv(bW), pv(48), palette.primary, { rx: 4 }));
  parts.push(pvBars({ x: pv(40 + (bW + GAP) * 2), y: pv(ctxY + 38), w: pv(W * 0.44), lines: 2, barH: 3, gap: 4, fill: DARK_INK_DIM }));

  // footer
  parts.push(pvRect(0, pv(footerY), pv(W), pv(FOOTER_H_P), DARK_BASE));
  parts.push(pvRect(0, pv(footerY), pv(W), pv(3), palette.primary));
  const slotSide = Math.min(FOOTER_H_P - 28, 120);
  const slotX = W - PAD - slotSide;
  parts.push(pvSlot(pv(slotX), pv(footerY + Math.round((FOOTER_H_P - slotSide) / 2)), pv(slotSide), pv(slotSide), palette.primary));
  parts.push(pvBars({ x: pv(PAD), y: pv(footerY + Math.round(FOOTER_H_P / 2) - 10), w: pv(slotX - PAD * 2), lines: 1, barH: 8, gap: 0, fill: palette.primary }));

  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H_P), pv(W), pv(CTA_H_P), palette.primary));
  parts.push(pvBars({ x: pv(100), y: pv(H - CTA_H_P + 40), w: pv(W - 200), lines: 1, barH: 8, gap: 0, fill: DARK_BASE, align: 'center' }));

  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000;
  const H = 1414;

  const aboutY  = HEADER_H_L + GAP;
  const gridY   = aboutY + ABOUT_H_L + GAP;
  const ctxY    = H - CTA_H_L - FOOTER_H_L - CTX_H_L - GAP;
  const footerY = H - CTA_H_L - FOOTER_H_L;

  const nBlocks = 4;
  const gridH = ctxY - gridY - GAP;
  const rowGap = Math.min(GAP, Math.round(gridH * 0.03));
  const rowH = Math.floor((gridH - rowGap * (nBlocks - 1)) / nBlocks);
  const chipW = Math.round((W - PAD * 2) * 0.18);

  const parts = [
    // header band
    pvRect(0, 0, PV_LAND_W, pv(HEADER_H_L), palette.primary),
    pvBars({ x: pv(PAD), y: pv(PAD + 8), w: pv(W * 0.28), lines: 1, barH: 8, gap: 0, fill: DARK_BASE }),
    pvBars({ x: pv(PAD), y: pv(PAD + 30), w: pv(W * 0.65), lines: 2, barH: 14, gap: 7, fill: DARK_BASE }),
    pvBars({ x: pv(PAD), y: pv(PAD + 94), w: pv(W * 0.50), lines: 1, barH: 5, gap: 0, fill: DARK_BASE }),
    // about card
    pvRect(pv(PAD), pv(aboutY), pv(W - PAD * 2), pv(ABOUT_H_L), DARK_PANEL, { rx: 4, stroke: palette.primary }),
    pvRect(pv(PAD + CARD_RX), pv(aboutY), pv(W - PAD * 2 - CARD_RX * 2), pv(4), palette.primary),
    pvBars({ x: pv(PAD + 28), y: pv(aboutY + 16), w: pv(W * 0.28), lines: 1, barH: 6, gap: 0, fill: palette.primary }),
    pvBars({ x: pv(PAD + 28), y: pv(aboutY + 36), w: pv(W - PAD * 2 - 56), lines: 3, barH: 3, gap: 4, fill: DARK_INK_DIM })
  ];

  // objective rows
  for (let i = 0; i < nBlocks; i++) {
    const ry = gridY + i * (rowH + rowGap);
    const rowFill = i % 2 === 0 ? DARK_PANEL : DARK_BASE;
    parts.push(pvRect(pv(PAD), pv(ry), pv(W - PAD * 2), pv(rowH), rowFill, { rx: 4, stroke: palette.primary }));
    parts.push(pvRect(pv(PAD), pv(ry + CARD_RX), pv(4), pv(rowH - CARD_RX * 2), palette.primary));
    parts.push(pvRect(pv(PAD + 20), pv(ry + Math.round((rowH - 24) / 2)), pv(chipW), pv(24), palette.primary, { rx: 3 }));
    const textX = PAD + 20 + chipW + GAP;
    parts.push(pvBars({ x: pv(textX), y: pv(ry + Math.round((rowH - 28) / 2)), w: pv(W - PAD - textX - 24), lines: 2, barH: 4, gap: 4, fill: DARK_INK }));
  }

  // context strip
  parts.push(pvRect(0, pv(ctxY), PV_LAND_W, pv(CTX_H_L), DARK_PANEL));
  parts.push(pvRect(0, pv(ctxY), pv(6), pv(CTX_H_L), palette.primary));
  const bW = Math.round((W - 40 - GAP) * 0.18);
  parts.push(pvRect(pv(40), pv(ctxY + 24), pv(bW), pv(40), palette.primary, { rx: 3 }));
  parts.push(pvRect(pv(40 + bW + GAP), pv(ctxY + 24), pv(bW), pv(40), palette.primary, { rx: 3 }));
  parts.push(pvBars({ x: pv(40 + (bW + GAP) * 2), y: pv(ctxY + 32), w: pv(W * 0.46), lines: 2, barH: 3, gap: 3, fill: DARK_INK_DIM }));

  // footer
  parts.push(pvRect(0, pv(footerY), PV_LAND_W, pv(FOOTER_H_L), DARK_BASE));
  parts.push(pvRect(0, pv(footerY), PV_LAND_W, pv(3), palette.primary));
  const slotSide = Math.min(FOOTER_H_L - 28, 120);
  const slotX = W - PAD - slotSide;
  parts.push(pvSlot(pv(slotX), pv(footerY + Math.round((FOOTER_H_L - slotSide) / 2)), pv(slotSide), pv(slotSide), palette.primary));
  parts.push(pvBars({ x: pv(PAD), y: pv(footerY + Math.round(FOOTER_H_L / 2) - 8), w: pv(slotX - PAD * 2), lines: 1, barH: 7, gap: 0, fill: palette.primary }));

  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H_L), PV_LAND_W, pv(CTA_H_L), palette.primary));
  parts.push(pvBars({ x: pv(100), y: pv(H - CTA_H_L + 32), w: pv(W - 200), lines: 1, barH: 7, gap: 0, fill: DARK_BASE, align: 'center' }));

  return svgWrapO(parts, DARK_BASE, 'landscape');
}

// ── export ────────────────────────────────────────────────────────────────────

export default {
  id: 'foss-policy-flyer',
  name: 'FOSS Policy Flyer',
  style: 'infographic',
  description: 'A4-portrait-feel FOSS policy infographic: a primary-colour header band with the headline, an About/Introduction dark card, a stacked list of objective rows (label chip + body text per block), a Scope/Support context strip, and a footer with a tagline and QR content image slot. Light-surface document feel with a full-bleed background slot.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 10 },
    blocks: { kind: 'sequence', min: 3, max: 5, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
