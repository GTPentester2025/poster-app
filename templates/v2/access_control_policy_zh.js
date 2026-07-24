// v2 template — access-control-policy-zh (style: infographic). Chinese variant of
// the AB InBev "Política de Controle de Acesso – ANX_3" poster (source: 23.html)
// reinterpreted at the v2 canvas scale. The archetype is a dark, near-black
// infographic with a bold yellow header band, a grid of policy section panels
// (each block = one section with a heading chip + body text), a central padlock
// decor motif (reinterpreted from the CSS padlock illustration), and a dark
// footer with a callout (non-compliance + help) and a content imageSlot for a
// QR code / company logo. A yellow CTA tagline bar closes the poster.
//
// Source → port:
//   .header "POLÍTICA DE CONTROLE DE ACESSO – ANX_3" → headlineZone (verbatim)
//   .top .section (PURPOSE, SCOPE)                   → blocks[0..1] heading+text
//   .middle .section (USER RESPONSIBILITIES)         → blocks[2] heading+text
//   .lock/.factory CSS illustration                  → padlockMotif decor
//   .bottom .section (KEY PRINCIPLES)               → blocks[3..4] heading+text
//   .footer (Non-compliance + Help + QR code)        → dark footer bar + imageSlot
//   .tagline                                         → ctaBar (callToAction verbatim)
//   background yellow (#f2c300)                      → palette.primary
//   background black (#111)                          → DARK_BASE / DARK_PANEL
//
// Design reinterpreted at 1414×2000 / 2000×1414 with v2 language.
// Yellow = palette.primary; dark grounds = DARK_* anchors; no hardcoded hex.

import {
  textbox, rect, imageSlot, backgroundImageSlot,
  fitFontSize, fitTextBlock, estTextHeight,
  pv, pvRect, pvBars, pvSlot, chip
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, dotGrid, padlockMotif,
  legibilityScrim, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM
} from './decor.js';

// ── constants ─────────────────────────────────────────────────────────────────

const PAD = 64;
const GAP = 20;
const CARD_RX = 20;
const HEADER_H_P = 180;   // portrait header band height
const HEADER_H_L = 140;   // landscape header band height
const FOOTER_H_P = 260;   // portrait footer height
const FOOTER_H_L = 200;   // landscape footer height
const CTA_H_P = 128;      // portrait CTA bar height
const CTA_H_L = 100;      // landscape CTA bar height

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

function headerBand(o, content, palette, fonts, W, y, h) {
  // yellow band
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));
  // accent left edge stripe
  o.push(rect({ x: 0, y, w: 8, h, fill: DARK_BASE, opacity: 0.35, layerRole: 'decor' }));
  // headline text
  const { fontSize: headSize } = fitTextBlock(content.headline, {
    width: W - 160, height: h - 32, maxSize: 90, minSize: 80, lineHeight: 1.0
  });
  o.push(textbox({
    text: content.headline,
    x: 80, y: y + Math.round((h - estTextHeight(content.headline, headSize, W - 160, 1.0)) / 2),
    w: W - 160, fontSize: headSize, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, lineHeight: 1.0, align: 'left',
    layerRole: 'headline', bgRef: palette.primary
  }));
}

// ── subheadline strip (optional) ──────────────────────────────────────────────

function subheadlineStrip(o, text, palette, fonts, W, y, h = 80) {
  o.push(rect({ x: 0, y, w: W, h, fill: DARK_PANEL, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 160, height: h - 20, maxSize: 38, minSize: 28, lineHeight: 1.2 });
  const th = estTextHeight(text, size, W - 160, 1.2);
  o.push(textbox({
    text, x: 80, y: y + Math.round((h - th) / 2),
    w: W - 160, fontSize: size, fontFamily: fonts.head, fontWeight: '700',
    fill: palette.primary, lineHeight: 1.2, align: 'left',
    layerRole: 'subheadline', bgRef: DARK_PANEL
  }));
}

// ── single section panel (one block = heading chip + body text) ───────────────
// CRITICAL: both heading AND text carry msgId + fieldRef per multi-field spec.

function sectionPanel(o, b, palette, fonts, { x, y, w, h }) {
  // panel background
  o.push(rect({
    x, y, w, h,
    fill: DARK_PANEL, rx: CARD_RX,
    stroke: palette.primary, strokeWidth: 2,
    layerRole: 'background'
  }));

  // accent top rule
  o.push(rect({ x: x + CARD_RX, y, w: w - CARD_RX * 2, h: 5, fill: palette.primary, layerRole: 'decor' }));

  const innerX = x + 24;
  const innerW = w - 48;
  let cursor = y + 5 + 16;

  // heading — a chip (message-label role) carrying msgId + fieldRef:'heading'
  const chipMaxW = Math.min(innerW, Math.round(innerW * 0.95));
  const chipMaxH = Math.min(54, Math.round(h * 0.32));
  const [pill, labelTb] = chip({
    text: b.heading || 'Section',
    x: innerX, y: cursor,
    fontSize: 26, bg: palette.primary, color: DARK_BASE,
    font: fonts.head, maxW: chipMaxW, maxH: chipMaxH,
    msgId: b.id
  });
  o.push(pill);
  o.push({ ...labelTb, fieldRef: 'heading' });

  const chipH = pill.height ?? Math.round(26 * 1.4 + 24);
  cursor += chipH + 14;

  // body text — message role, fieldRef:'text'
  const textBudget = h - (cursor - y) - 20;
  const { fontSize: msgSize } = fitTextBlock(b.text, {
    width: innerW, height: Math.max(textBudget, 38 * 1.3),
    maxSize: 44, minSize: 38, lineHeight: 1.3
  });
  o.push({
    ...textbox({
      text: b.text,
      x: innerX, y: cursor,
      w: innerW, fontSize: msgSize,
      fontFamily: fonts.body, fontWeight: '600',
      fill: DARK_INK, lineHeight: 1.3,
      layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'text'
  });
}

// ── grid of section panels ────────────────────────────────────────────────────

function sectionGrid(o, blocks, palette, fonts, { x, y, w, h, cols }) {
  const n = blocks.length;
  const rows = Math.ceil(n / cols);
  const colW = Math.floor((w - GAP * (cols - 1)) / cols);
  const rowH = Math.floor((h - GAP * (rows - 1)) / rows);

  blocks.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    sectionPanel(o, b, palette, fonts, {
      x: x + col * (colW + GAP),
      y: y + row * (rowH + GAP),
      w: colW,
      h: rowH
    });
  });
}

// ── dark footer strip ─────────────────────────────────────────────────────────

function footerStrip(o, palette, fonts, W, y, h, imageSlotY, imageSlotH) {
  o.push(rect({ x: 0, y, w: W, h, fill: DARK_BASE, layerRole: 'background' }));
  // accent top rule
  o.push(rect({ x: 0, y, w: W, h: 4, fill: palette.primary, layerRole: 'decor' }));

  // left text block (non-compliance + help)
  const textW = Math.round(W * 0.62) - PAD * 2;
  const textX = PAD;
  let cursor = y + 28;

  const nc = 'Non-compliance: Violations may result in disciplinary action or legal consequences.';
  const ncSize = fitFontSize(nc, { width: textW, height: 70, maxSize: 34, minSize: 26, lineHeight: 1.3 });
  const ncH = estTextHeight(nc, ncSize, textW, 1.3);
  o.push(textbox({
    text: nc, x: textX, y: cursor, w: textW,
    fontSize: ncSize, fontFamily: fonts.head, fontWeight: '700',
    fill: palette.primary, lineHeight: 1.3,
    layerRole: 'decor', bgRef: DARK_BASE
  }));
  cursor += ncH + 12;

  const help = 'Need help? Contact the Global Security and Compliance Team or email: gisp_support@ab-inbev.com';
  const helpSize = fitFontSize(help, { width: textW, height: h - (cursor - y) - 20, maxSize: 30, minSize: 22, lineHeight: 1.3 });
  o.push(textbox({
    text: help, x: textX, y: cursor, w: textW,
    fontSize: helpSize, fontFamily: fonts.body, fontWeight: '500',
    fill: DARK_INK_DIM, lineHeight: 1.3,
    layerRole: 'decor', bgRef: DARK_BASE
  }));

  // content imageSlot (QR / logo) — right side of footer, text-free region
  const slotW = 180;
  const slotH = Math.min(180, h - 48);
  const slotX = W - PAD - slotW;
  const slotY2 = y + Math.round((h - slotH) / 2);
  o.push(imageSlot({
    slotId: 'slot-qr',
    x: slotX, y: slotY2, w: slotW, h: slotH,
    styleHint: 'QR code for company policy portal, or company logo mark, clean on transparent, square format',
    stroke: palette.primary, rx: 12
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
    styleHint: 'dark industrial office environment with server racks and secure access panels, near-black, moody blue lighting, no text',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ambient decor
  o.push(...meshGlow({ spots: [
    { x: W - 200, y: 400, r: 380, color: palette.primary },
    { x: 200, y: H - 500, r: 340, color: palette.accent ?? palette.primary }
  ], intensity: 0.55 }));
  o.push(...dotGrid({ x: W - 220, y: HEADER_H_P + 100, cols: 3, rows: 5, gap: 48, dotR: 4, color: palette.primary, intensity: 0.45 }));

  // padlock motif — ghosted, upper-right background
  o.push(...padlockMotif({ x: W - 180, y: 320, size: 200, color: palette.primary, intensity: 0.6 }));

  // header band
  headerBand(o, content, palette, fonts, W, 0, HEADER_H_P);

  // optional subheadline strip
  const subText = content.subheadline || 'Access Control Policy — ANX_3';
  const subH = 80;
  subheadlineStrip(o, subText, palette, fonts, W, HEADER_H_P, subH);

  // section panels grid (2 columns)
  const gridTop = HEADER_H_P + subH + GAP;
  const gridBottom = H - FOOTER_H_P - CTA_H_P - GAP;
  const gridH = gridBottom - gridTop;
  const blocks = content.blocks || [];

  sectionGrid(o, blocks, palette, fonts, {
    x: PAD, y: gridTop,
    w: W - PAD * 2, h: gridH,
    cols: 2
  });

  // footer
  footerStrip(o, palette, fonts, W, H - FOOTER_H_P - CTA_H_P, FOOTER_H_P, 0, 180);

  // CTA bar
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
    styleHint: 'dark industrial office environment with server racks and secure access panels, near-black, moody blue lighting, no text',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ambient decor
  o.push(...meshGlow({ spots: [
    { x: W - 300, y: 250, r: 340, color: palette.primary },
    { x: 300, y: H - 300, r: 300, color: palette.accent ?? palette.primary }
  ], intensity: 0.55 }));
  o.push(...dotGrid({ x: W - 260, y: HEADER_H_L + 80, cols: 3, rows: 4, gap: 44, dotR: 4, color: palette.primary, intensity: 0.4 }));

  // padlock motif — ghosted, lower-left
  o.push(...padlockMotif({ x: 160, y: H - 250, size: 180, color: palette.primary, intensity: 0.55 }));

  // header band
  headerBand(o, content, palette, fonts, W, 0, HEADER_H_L);

  // optional subheadline strip
  const subText = content.subheadline || 'Access Control Policy — ANX_3';
  const subH = 64;
  subheadlineStrip(o, subText, palette, fonts, W, HEADER_H_L, subH);

  // section panels grid (3 columns for landscape)
  const gridTop = HEADER_H_L + subH + GAP;
  const gridBottom = H - FOOTER_H_L - CTA_H_L - GAP;
  const gridH = gridBottom - gridTop;
  const blocks = content.blocks || [];

  // landscape: 3 cols for 3-5 blocks
  const cols = Math.min(3, blocks.length);
  sectionGrid(o, blocks, palette, fonts, {
    x: PAD, y: gridTop,
    w: W - PAD * 2, h: gridH,
    cols: cols || 2
  });

  // footer
  footerStrip(o, palette, fonts, W, H - FOOTER_H_L - CTA_H_L, FOOTER_H_L, 0, 160);

  // CTA bar
  ctaBar(o, content.callToAction, palette, fonts, W, H - CTA_H_L, CTA_H_L);

  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────

function previewPortrait(palette) {
  const W = 1414;
  const H = 2000;
  const subH = 80;
  const gridTop = HEADER_H_P + subH + GAP;
  const gridBottom = H - FOOTER_H_P - CTA_H_P - GAP;
  const gridH = gridBottom - gridTop;
  const colW = Math.floor((W - PAD * 2 - GAP) / 2);

  const parts = [
    // header band
    pvRect(0, 0, pv(W), pv(HEADER_H_P), palette.primary),
    pvBars({ x: pv(80), y: pv(60), w: pv(W - 160), lines: 2, barH: 10, gap: 6, fill: DARK_BASE }),
    // subheadline strip
    pvRect(0, pv(HEADER_H_P), pv(W), pv(subH), DARK_PANEL),
    pvBars({ x: pv(80), y: pv(HEADER_H_P + 26), w: pv(W * 0.55), lines: 1, barH: 6, gap: 0, fill: palette.primary })
  ];

  // 4 section panels in 2 columns (2×2)
  const rowH = Math.floor((gridH - GAP) / 2);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const px = PAD + col * (colW + GAP);
      const py = gridTop + row * (rowH + GAP);
      parts.push(pvRect(pv(px), pv(py), pv(colW), pv(rowH), DARK_PANEL, { rx: 4, stroke: palette.primary }));
      parts.push(pvRect(pv(px + 20), pv(py), pv(colW - 40), pv(4), palette.primary));
      parts.push(pvRect(pv(px + 24), pv(py + 14), pv(70), pv(18), palette.primary, { rx: 3 }));
      parts.push(pvBars({ x: pv(px + 24), y: pv(py + 40), w: pv(colW - 48), lines: 2, barH: 4, gap: 3, fill: DARK_INK }));
    }
  }

  // footer
  const footerY = H - FOOTER_H_P - CTA_H_P;
  parts.push(pvRect(0, pv(footerY), pv(W), pv(FOOTER_H_P), DARK_BASE));
  parts.push(pvRect(0, pv(footerY), pv(W), pv(3), palette.primary));
  parts.push(pvBars({ x: pv(PAD), y: pv(footerY + 28), w: pv(W * 0.55), lines: 2, barH: 4, gap: 4, fill: palette.primary }));
  parts.push(pvBars({ x: pv(PAD), y: pv(footerY + 80), w: pv(W * 0.55), lines: 3, barH: 3, gap: 3, fill: DARK_INK_DIM }));
  parts.push(pvSlot(pv(W - PAD - 180), pv(footerY + 40), pv(180), pv(180), palette.primary));

  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H_P), pv(W), pv(CTA_H_P), palette.primary));
  parts.push(pvBars({ x: pv(100), y: pv(H - CTA_H_P + 44), w: pv(W - 200), lines: 1, barH: 8, gap: 0, fill: DARK_BASE, align: 'center' }));

  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000;
  const H = 1414;
  const subH = 64;
  const gridTop = HEADER_H_L + subH + GAP;
  const gridBottom = H - FOOTER_H_L - CTA_H_L - GAP;
  const gridH = gridBottom - gridTop;
  const cols = 3;
  const colW = Math.floor((W - PAD * 2 - GAP * (cols - 1)) / cols);
  const rowH = gridH;

  const parts = [
    // header band
    pvRect(0, 0, PV_LAND_W, pv(HEADER_H_L), palette.primary),
    pvBars({ x: pv(80), y: pv(44), w: pv(W - 160), lines: 1, barH: 10, gap: 0, fill: DARK_BASE }),
    // subheadline strip
    pvRect(0, pv(HEADER_H_L), PV_LAND_W, pv(subH), DARK_PANEL),
    pvBars({ x: pv(80), y: pv(HEADER_H_L + 22), w: pv(W * 0.5), lines: 1, barH: 5, gap: 0, fill: palette.primary })
  ];

  // 3 section panels in a row
  for (let col = 0; col < cols; col++) {
    const px = PAD + col * (colW + GAP);
    const py = gridTop;
    parts.push(pvRect(pv(px), pv(py), pv(colW), pv(rowH), DARK_PANEL, { rx: 4, stroke: palette.primary }));
    parts.push(pvRect(pv(px + 20), pv(py), pv(colW - 40), pv(4), palette.primary));
    parts.push(pvRect(pv(px + 24), pv(py + 12), pv(60), pv(16), palette.primary, { rx: 3 }));
    parts.push(pvBars({ x: pv(px + 24), y: pv(py + 36), w: pv(colW - 48), lines: 3, barH: 3, gap: 3, fill: DARK_INK }));
  }

  // footer
  const footerY = H - FOOTER_H_L - CTA_H_L;
  parts.push(pvRect(0, pv(footerY), PV_LAND_W, pv(FOOTER_H_L), DARK_BASE));
  parts.push(pvRect(0, pv(footerY), PV_LAND_W, pv(3), palette.primary));
  parts.push(pvBars({ x: pv(PAD), y: pv(footerY + 20), w: pv(W * 0.55), lines: 2, barH: 3, gap: 3, fill: palette.primary }));
  parts.push(pvBars({ x: pv(PAD), y: pv(footerY + 60), w: pv(W * 0.55), lines: 2, barH: 3, gap: 3, fill: DARK_INK_DIM }));
  parts.push(pvSlot(pv(W - PAD - 160), pv(footerY + 20), pv(160), pv(FOOTER_H_L - 40), palette.primary));

  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H_L), PV_LAND_W, pv(CTA_H_L), palette.primary));
  parts.push(pvBars({ x: pv(100), y: pv(H - CTA_H_L + 34), w: pv(W - 200), lines: 1, barH: 7, gap: 0, fill: DARK_BASE, align: 'center' }));

  return svgWrapO(parts, DARK_BASE, 'landscape');
}

// ── export ────────────────────────────────────────────────────────────────────

export default {
  id: 'access-control-policy-zh',
  name: 'Access Control Policy (ZH)',
  style: 'infographic',
  description: 'Chinese variant of the dark multi-section policy infographic with yellow header, policy section panels, padlock motif, dark footer with QR/logo slot, and yellow CTA bar.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 8 },
    blocks: { kind: 'panels', min: 3, max: 5, fields: ['heading', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
