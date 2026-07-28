// v2 template — incident-photo-hero (style: statement). Reinterpretation of
// the AB InBev "Incident Reporting" poster (source: 4.html) at the v2 canvas
// scale. The archetype is a full-bleed dark-overlay photo background with a
// large right-aligned display headline stack on the right, a translucent dark
// list card on the left holding one message per block (the incident examples),
// and a solid primary-colour footer CTA bar.
//
// Source → port:
//   background photo (Unsplash dark overlay) → backgroundImageSlot (slotId:'bg')
//   scrim dark overlay                        → legibilityScrim
//   .right .top-title "IDENTIFYING AN"        → decor textbox (kicker)
//   .right .main-title "INCIDENT"             → headline textbox (verbatim)
//   .right .sub "& REPORTING IT"              → subheadline textbox
//   .right .text (description paragraph)      → kept as ambient decor / body text
//   .left .card + .card ul                    → translucent list card + message rows
//   .card h2 "EXAMPLES OF INCIDENTS"          → card title (decor)
//   .footer "REPORT TO SOC-SUPPORT…"          → ctaBar (palette.primary)
//   content imageSlot (imageSlots:1)          → logo/QR corner (top-right, text-free)
//
// Design reinterpreted at 1414×2000 / 2000×1414 with v2 language.
// Yellow = palette.primary; dark grounds = DARK_* anchors; no hardcoded hex.

import {
  textbox, rect, imageSlot,
  fitFontSize, fitTextBlock, estTextHeight, backgroundImageSlot,
  pv, pvRect, pvBars, pvSlot, pvCircle
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, dotGrid, legibilityScrim, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_INK, DARK_INK_DIM, OVERLAY_TEXT_SHADOW
} from './decor.js';

// ── constants ─────────────────────────────────────────────────────────────────

const PAD = 80;
const GAP = 20;
const CARD_RX = 24;
const CTA_H_P = 160;  // portrait CTA height
const CTA_H_L = 128;  // landscape CTA height

// ── CTA bar ────────────────────────────────────────────────────────────────────

function ctaBar(o, text, palette, fonts, W, y, h) {
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 200, height: h - 40, maxSize: 44, minSize: 28, lineHeight: 1.2 });
  const th = estTextHeight(text, size, W - 200, 1.2);
  o.push(textbox({
    text, x: 100, y: y + Math.round((h - th) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, align: 'center', layerRole: 'cta', bgRef: palette.primary
  }));
}

// ── kicker + headline + subheadline block ────────────────────────────────────

function headlineBlock(o, content, palette, fonts, { x, y, w, maxHeadSize, align }) {
  // kicker line ("IDENTIFYING AN" / "REPORT AN")
  const kickerText = 'IDENTIFYING AN';
  const kickerSize = fitFontSize(kickerText, { width: w, height: 120, maxSize: 72, minSize: 40, lineHeight: 1.1 });
  const kickerH = estTextHeight(kickerText, kickerSize, w, 1.1);
  o.push(textbox({
    text: kickerText, x, y, w, fontSize: kickerSize,
    fontFamily: fonts.head, fontWeight: '800', fill: palette.primary, align,
    lineHeight: 1.1, layerRole: 'decor', bgRef: DARK_BASE,
    shadow: OVERLAY_TEXT_SHADOW
  }));
  let cursor = y + kickerH + 8;

  // main headline (verbatim content.headline)
  const { fontSize: headSize, height: headH } = fitTextBlock(content.headline, {
    width: w, height: 500, maxSize: maxHeadSize, minSize: 80, lineHeight: 0.94
  });
  o.push(textbox({
    text: content.headline, x, y: cursor, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align,
    lineHeight: 0.94, layerRole: 'headline', bgRef: DARK_BASE,
    shadow: OVERLAY_TEXT_SHADOW
  }));
  cursor += headH + 12;

  // subheadline: use content.subheadline or the source's "& REPORTING IT"
  const subText = content.subheadline || '& REPORTING IT';
  const { fontSize: subSize, height: subH } = fitTextBlock(subText, {
    width: w, height: 160, maxSize: 72, minSize: 36, lineHeight: 1.1
  });
  o.push(textbox({
    text: subText, x, y: cursor, w, fontSize: subSize,
    fontFamily: fonts.head, fontWeight: '800', fill: palette.primary, align,
    lineHeight: 1.1, layerRole: 'subheadline', bgRef: DARK_BASE,
    shadow: OVERLAY_TEXT_SHADOW
  }));
  cursor += subH + 12;

  return cursor;
}

// ── translucent list card ────────────────────────────────────────────────────
// One message row per block. Card title in palette.primary, messages in DARK_INK.

function listCard(o, blocks, palette, fonts, { x, y, w, h }) {
  // card background
  o.push(rect({
    x, y, w, h,
    fill: DARK_BASE, rx: CARD_RX,
    stroke: palette.primary, strokeWidth: 2,
    opacity: 0.82, layerRole: 'background'
  }));

  // card title strip
  const titleText = 'EXAMPLES OF INCIDENTS:';
  const titleFontSize = fitFontSize(titleText, { width: w - 48, height: 64, maxSize: 36, minSize: 24, lineHeight: 1.2 });
  const titleH = estTextHeight(titleText, titleFontSize, w - 48, 1.2);
  o.push(textbox({
    text: titleText, x: x + 24, y: y + 24, w: w - 48,
    fontSize: titleFontSize, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, layerRole: 'decor', bgRef: DARK_BASE
  }));

  // accent rule under title
  o.push(rect({ x: x + 24, y: y + 24 + titleH + 6, w: w - 48, h: 3, fill: palette.primary, opacity: 0.7, layerRole: 'decor' }));

  // message rows
  const listTop = y + 24 + titleH + 6 + 3 + 16;
  const listH = h - (listTop - y) - 20;
  const n = Math.max(blocks.length, 1);
  const rowGap = Math.min(16, Math.round((listH * 0.1) / (n - 1 || 1)));
  const rowH = Math.round((listH - rowGap * (n - 1)) / n);

  blocks.forEach((b, i) => {
    const ry = listTop + i * (rowH + rowGap);
    // bullet dot
    const dotR = Math.min(8, Math.round(rowH * 0.18));
    const dotCX = x + 24 + dotR;
    const textX = dotCX + dotR + 16;
    const textW = x + w - 24 - textX;
    const { fontSize: msgSize } = fitTextBlock(b.text, {
      width: textW, height: rowH,
      maxSize: 44, minSize: 16, lineHeight: 1.28
    });
    const msgH = estTextHeight(b.text, msgSize, textW, 1.28);
    const msgY = ry + Math.max(0, Math.round((rowH - msgH) / 2));

    // bullet
    o.push(rect({ x: dotCX - dotR, y: msgY + Math.round(msgSize * 0.55) - dotR, w: dotR * 2, h: dotR * 2, fill: palette.primary, rx: dotR, layerRole: 'decor' }));

    // message textbox (bound to block)
    o.push({
      ...textbox({
        text: b.text,
        x: textX, y: msgY,
        w: textW, fontSize: msgSize,
        fontFamily: fonts.body, fontWeight: '700',
        fill: DARK_INK, lineHeight: 1.28,
        layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
      }),
      fieldRef: 'text'
    });
  });
}

// ── portrait build ────────────────────────────────────────────────────────────

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  // CONTRACT: first = full-bleed bg image slot
  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'modern office worker at a laptop in a dark dramatic environment, cybersecurity incident response, deep near-black tones, no text',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ambient decor
  o.push(...meshGlow({ spots: [
    { x: 1100, y: 400, r: 500, color: palette.primary },
    { x: 200, y: 1600, r: 380, color: palette.accent }
  ], intensity: 0.65 }));
  o.push(...dotGrid({ x: W - 280, y: 600, cols: 4, rows: 6, gap: 52, dotR: 4, color: palette.primary, intensity: 0.55 }));

  // ── layout ────────────────────────────────────────────────────────────────
  // Right column: headline stack (top-right area)
  // Left column: translucent list card
  // Top-right corner: content imageSlot (logo/QR, text-free zone)
  // Footer: CTA bar

  const rightX = Math.round(W * 0.42);
  const rightW = W - rightX - PAD;

  // content imageSlot — top-right corner, well above headline text
  const slotW = 160;
  const slotH = 160;
  const slotX = W - PAD - slotW;
  const slotY = PAD;
  o.push(imageSlot({
    slotId: 'slot-logo',
    x: slotX, y: slotY, w: slotW, h: slotH,
    styleHint: 'company logo or QR code, clean white on transparent, square format',
    stroke: palette.primary, rx: 12
  }));

  // headline block (right column, starts below the imageSlot or from PAD+20)
  const headlineStartY = slotY + slotH + 32;
  const headlineCursor = headlineBlock(o, content, palette, fonts, {
    x: rightX, y: headlineStartY, w: rightW, maxHeadSize: 180, align: 'right'
  });

  // description snippet (ambient body text, right column, below headline)
  const descText = 'Incident Response is the process of detecting, containing, and resolving security threats.';
  const descW = rightW;
  const descSize = fitFontSize(descText, { width: descW, height: 180, maxSize: 32, minSize: 22, lineHeight: 1.32 });
  const descH = estTextHeight(descText, descSize, descW, 1.32);
  if (headlineCursor + descH + 16 < H - CTA_H_P - 200) {
    o.push(textbox({
      text: descText, x: rightX, y: headlineCursor + 8, w: descW,
      fontSize: descSize, fontFamily: fonts.body, fontWeight: '600',
      fill: DARK_INK_DIM, align: 'right', lineHeight: 1.32,
      layerRole: 'decor', bgRef: DARK_BASE, shadow: OVERLAY_TEXT_SHADOW
    }));
  }

  // list card (left column)
  const cardX = PAD;
  const cardW = rightX - PAD - GAP;
  const cardTop = Math.round(H * 0.28);
  const cardBottom = H - CTA_H_P - GAP;
  const cardH = cardBottom - cardTop;
  listCard(o, content.blocks || [], palette, fonts, { x: cardX, y: cardTop, w: cardW, h: cardH });

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
    styleHint: 'modern office worker at a laptop in a dark dramatic environment, cybersecurity incident response, deep near-black tones, no text',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ambient decor
  o.push(...meshGlow({ spots: [
    { x: 1600, y: 300, r: 450, color: palette.primary },
    { x: 300, y: 1000, r: 350, color: palette.accent }
  ], intensity: 0.65 }));
  o.push(...dotGrid({ x: W - 320, y: 200, cols: 4, rows: 5, gap: 50, dotR: 4, color: palette.primary, intensity: 0.5 }));

  // ── layout ────────────────────────────────────────────────────────────────
  // Left column: list card
  // Right column: headline + subheadline
  // Top-right corner: content imageSlot (text-free)
  // Bottom: CTA bar

  const splitX = Math.round(W * 0.42);
  const rightX = splitX + GAP;
  const rightW = W - rightX - PAD;

  // content imageSlot — top-right corner, above headline text
  const slotW = 140;
  const slotH = 140;
  const slotX = W - PAD - slotW;
  const slotY = PAD;
  o.push(imageSlot({
    slotId: 'slot-logo',
    x: slotX, y: slotY, w: slotW, h: slotH,
    styleHint: 'company logo or QR code, clean white on transparent, square format',
    stroke: palette.primary, rx: 12
  }));

  // headline block (right column)
  const headlineStartY = slotY + slotH + 24;
  const headlineCursor = headlineBlock(o, content, palette, fonts, {
    x: rightX, y: headlineStartY, w: rightW - slotW - 24, maxHeadSize: 160, align: 'right'
  });

  // description (optional, if space allows)
  const descText = 'Incident Response is the process of detecting, containing, and resolving security threats.';
  const descW = rightW;
  const descSize = fitFontSize(descText, { width: descW, height: 100, maxSize: 28, minSize: 20, lineHeight: 1.3 });
  const descH = estTextHeight(descText, descSize, descW, 1.3);
  if (headlineCursor + descH + 8 < H - CTA_H_L - 80) {
    o.push(textbox({
      text: descText, x: rightX, y: headlineCursor + 8, w: descW,
      fontSize: descSize, fontFamily: fonts.body, fontWeight: '600',
      fill: DARK_INK_DIM, align: 'right', lineHeight: 1.3,
      layerRole: 'decor', bgRef: DARK_BASE, shadow: OVERLAY_TEXT_SHADOW
    }));
  }

  // list card (left column)
  const cardTop = PAD;
  const cardBottom = H - CTA_H_L - GAP;
  const cardH = cardBottom - cardTop;
  listCard(o, content.blocks || [], palette, fonts, { x: PAD, y: cardTop, w: splitX - PAD - GAP, h: cardH });

  // CTA bar
  ctaBar(o, content.callToAction, palette, fonts, W, H - CTA_H_L, CTA_H_L);

  return canvas;
}

// ── previews ─────────────────────────────────────────────────────────────────

function previewPortrait(palette) {
  const W = 1414;
  const H = 2000;
  const rightX = Math.round(W * 0.42);
  const rightW = W - rightX - PAD;
  const cardX = PAD;
  const cardW = rightX - PAD - GAP;
  const cardTop = Math.round(H * 0.28);
  const cardBottom = H - CTA_H_P - GAP;
  const cardH = cardBottom - cardTop;

  const parts = [
    // background slot hint
    pvRect(0, 0, pv(W), pv(H), DARK_BASE, { opacity: 0.5 }),
    // content imageSlot (top-right corner)
    pvSlot(pv(W - PAD - 160), pv(PAD), pv(160), pv(160), palette.primary),
    // kicker + headline bars (right column)
    pvBars({ x: pv(rightX), y: pv(PAD + 200), w: pv(rightW), lines: 1, barH: 5, gap: 3, fill: palette.primary, align: 'right' }),
    pvBars({ x: pv(rightX), y: pv(PAD + 220), w: pv(rightW), lines: 2, barH: 14, gap: 6, fill: DARK_INK, align: 'right' }),
    pvBars({ x: pv(rightX), y: pv(PAD + 300), w: pv(rightW), lines: 1, barH: 8, gap: 0, fill: palette.primary, align: 'right' }),
    // list card
    pvRect(pv(cardX), pv(cardTop), pv(cardW), pv(cardH), DARK_BASE, { rx: 3, opacity: 0.82, stroke: palette.primary }),
    pvBars({ x: pv(cardX + 24), y: pv(cardTop + 24), w: pv(cardW - 48), lines: 1, barH: 5, gap: 0, fill: palette.primary }),
    pvRect(pv(cardX + 24), pv(cardTop + 44), pv(cardW - 48), pv(2), palette.primary, { opacity: 0.7 })
  ];
  // 4 message rows in the card
  const listTop = cardTop + 68;
  const listH = cardH - 68 - 20;
  const rowH = Math.round((listH - 16 * 3) / 4);
  for (let i = 0; i < 4; i++) {
    const ry = listTop + i * (rowH + 16);
    parts.push(pvCircle(pv(cardX + 32), pv(ry + rowH / 2), pv(7), palette.primary));
    parts.push(pvBars({ x: pv(cardX + 56), y: pv(ry + 4), w: pv(cardW - 80), lines: 2, barH: 4, gap: 3, fill: DARK_INK }));
  }
  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H_P), pv(W), pv(CTA_H_P), palette.primary));
  parts.push(pvBars({ x: pv(100), y: pv(H - CTA_H_P + 56), w: pv(W - 200), lines: 1, barH: 8, gap: 0, fill: DARK_BASE, align: 'center' }));

  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000;
  const H = 1414;
  const splitX = Math.round(W * 0.42);
  const rightX = splitX + GAP;
  const rightW = W - rightX - PAD;
  const cardTop = PAD;
  const cardH = H - CTA_H_L - GAP - cardTop;

  const parts = [
    pvRect(0, 0, PV_LAND_W, pv(H), DARK_BASE, { opacity: 0.5 }),
    // content imageSlot (top-right corner)
    pvSlot(pv(W - PAD - 140), pv(PAD), pv(140), pv(140), palette.primary),
    // headline bars (right column)
    pvBars({ x: pv(rightX), y: pv(PAD + 160), w: pv(rightW - 140 - 24), lines: 1, barH: 5, gap: 2, fill: palette.primary, align: 'right' }),
    pvBars({ x: pv(rightX), y: pv(PAD + 178), w: pv(rightW - 140 - 24), lines: 2, barH: 12, gap: 5, fill: DARK_INK, align: 'right' }),
    pvBars({ x: pv(rightX), y: pv(PAD + 252), w: pv(rightW - 140 - 24), lines: 1, barH: 7, gap: 0, fill: palette.primary, align: 'right' }),
    // list card (left column)
    pvRect(pv(PAD), pv(cardTop), pv(splitX - PAD - GAP), pv(cardH), DARK_BASE, { rx: 3, opacity: 0.82, stroke: palette.primary }),
    pvBars({ x: pv(PAD + 24), y: pv(cardTop + 24), w: pv(splitX - PAD - GAP - 48), lines: 1, barH: 5, gap: 0, fill: palette.primary }),
    pvRect(pv(PAD + 24), pv(cardTop + 44), pv(splitX - PAD - GAP - 48), pv(2), palette.primary, { opacity: 0.7 })
  ];
  // 4 message rows
  const cardW = splitX - PAD - GAP;
  const listTop = cardTop + 60;
  const listH = cardH - 60 - 20;
  const rowH = Math.round((listH - 14 * 3) / 4);
  for (let i = 0; i < 4; i++) {
    const ry = listTop + i * (rowH + 14);
    parts.push(pvCircle(pv(PAD + 32), pv(ry + rowH / 2), pv(6), palette.primary));
    parts.push(pvBars({ x: pv(PAD + 52), y: pv(ry + 4), w: pv(cardW - 72), lines: 2, barH: 3, gap: 2, fill: DARK_INK }));
  }
  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H_L), PV_LAND_W, pv(CTA_H_L), palette.primary));
  parts.push(pvBars({ x: pv(100), y: pv(H - CTA_H_L + 44), w: pv(W - 200), lines: 1, barH: 7, gap: 0, fill: DARK_BASE, align: 'center' }));

  return svgWrapO(parts, DARK_BASE, 'landscape');
}

// ── export ────────────────────────────────────────────────────────────────────

export default {
  id: 'incident-photo-hero',
  name: 'Incident Photo Hero',
  style: 'statement',
  description: 'Full-bleed photo background with a large display headline stack, a translucent dark list card showing incident examples (one message per block), a content image slot in the top-right corner, and a bold primary-colour CTA bar at the foot.',
  contentSchema: {
    headline: { required: true, maxWords: 4 },
    subheadline: { required: false, maxWords: 6 },
    blocks: { kind: 'sequence', min: 3, max: 5, fields: ['text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
