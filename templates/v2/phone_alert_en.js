// v2 template — phone-alert-en (style: bullet). English variant of the phone-alert
// template, specifically designed for phishing-alert messaging. Built around a
// phone-frame motif: a yellow headline band at the top, a styled phone mockup
// holding three stacked instruction cards (one per step), and a bold yellow CTA footer.

import {
  textbox, rect, circle, imageSlot,
  fitFontSize, fitTextBlock, estTextHeight, backgroundImageSlot,
  pv, pvRect, pvBars, pvCircle, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, signalArcs, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK,
  legibilityScrim, cornerFrame
} from './decor.js';

// ── shared layout constants ──────────────────────────────────────────────────

const PAD = 96;   // outer margin
const GAP = 24;   // standard gap between zones
const CARD_RX = 20; // instruction card corner radius
const PHONE_RX = 60; // phone body corner radius
const NOTCH_H = 54;  // phone notch height

// ── CTA bar ──────────────────────────────────────────────────────────────────

function ctaBar(o, text, palette, fonts, W, y, h = 160) {
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 200, height: h - 48, maxSize: 44, minSize: 28, lineHeight: 1.2 });
  const th = estTextHeight(text, size, W - 200, 1.2);
  o.push(textbox({
    text, x: 100, y: y + Math.round((h - th) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: DARK_BASE, align: 'center', layerRole: 'cta', bgRef: palette.primary
  }));
}

// ── phone frame chrome ───────────────────────────────────────────────────────
// Draws the phone body (rect), notch bar (rect), speaker (rect), and camera
// (circle) as decor. Returns the y offset of the content area start
// (i.e. top of the scrollable region inside the phone).

function phoneFrame(o, { x, y, w, h, palette }) {
  // body
  o.push(rect({
    x, y, w, h,
    fill: DARK_PANEL, rx: PHONE_RX,
    stroke: DARK_INK, strokeWidth: 6,
    layerRole: 'decor'
  }));
  // notch bar (centered at top)
  const notchW = Math.round(w * 0.44);
  const notchX = x + Math.round((w - notchW) / 2);
  o.push(rect({
    x: notchX, y, w: notchW, h: NOTCH_H,
    fill: DARK_BASE, rx: Math.round(NOTCH_H / 2),
    layerRole: 'decor'
  }));
  // speaker slot (inner, smaller)
  const spkW = Math.round(notchW * 0.4);
  const spkX = x + Math.round((w - spkW) / 2);
  const spkH = 10;
  o.push(rect({
    x: spkX, y: y + Math.round((NOTCH_H - spkH) / 2),
    w: spkW, h: spkH,
    fill: DARK_PANEL_2, rx: spkH / 2,
    layerRole: 'decor'
  }));
  // camera dot (right of speaker inside notch)
  const camR = 10;
  const camX = notchX + notchW - camR - 12;
  const camY = y + Math.round(NOTCH_H / 2);
  o.push(circle({ x: camX, y: camY, r: camR, fill: DARK_PANEL_2, layerRole: 'decor' }));

  // screen glow inside the phone body
  o.push(...meshGlow({
    spots: [{ x: x + w / 2, y: y + h * 0.45, r: Math.round(w * 0.55), color: palette.primary }],
    intensity: 0.25
  }));

  return y + NOTCH_H + 24; // content area top
}

// ── instruction cards (one per block) ────────────────────────────────────────

function instructionCards(o, blocks, palette, fonts, { x, y, w, h }) {
  const n = blocks.length;
  const gap = 20;
  const cardH = Math.round((h - gap * (n - 1)) / n);

  for (let i = 0; i < n; i++) {
    const b = blocks[i];
    const cardY = y + i * (cardH + gap);

    // card background
    o.push(rect({
      x, y: cardY, w, h: cardH,
      fill: DARK_BASE, rx: CARD_RX,
      stroke: palette.primary, strokeWidth: 2,
      layerRole: 'background'
    }));

    // accent stripe on left edge
    const stripeW = 6;
    o.push(rect({
      x, y: cardY + CARD_RX / 2, w: stripeW, h: cardH - CARD_RX,
      fill: palette.primary, rx: 3, layerRole: 'decor'
    }));

    // step number badge
    const badgeR = 22;
    const badgeX = x + stripeW + 16 + badgeR;
    const badgeCY = cardY + Math.round(cardH / 2);
    o.push(circle({ x: badgeX, y: badgeCY, r: badgeR, fill: palette.primary, layerRole: 'decor' }));
    o.push(textbox({
      text: String(i + 1), x: badgeX - badgeR, y: badgeCY - badgeR,
      w: badgeR * 2, fontSize: 24, fontFamily: fonts.head, fontWeight: '900',
      fill: DARK_BASE, align: 'center', layerRole: 'decor', bgRef: palette.primary
    }));

    // message text
    const textX = badgeX + badgeR + 16;
    const textW = x + w - textX - 20;
    const textBudget = cardH - 24;
    const { fontSize, height: th } = fitTextBlock(b.text, {
      width: textW, height: textBudget, maxSize: 52, minSize: 38, lineHeight: 1.26
    });
    o.push({
      ...textbox({
        text: b.text, x: textX, y: cardY + Math.round((cardH - th) / 2),
        w: textW, fontSize, fontFamily: fonts.body, fontWeight: '600',
        fill: DARK_INK, lineHeight: 1.26, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
      }),
      fieldRef: 'text'
    });
  }
}

// ── portrait build ────────────────────────────────────────────────────────────

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  // CONTRACT: first object = full-bleed background image slot
  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'close-up of a smartphone screen showing a phishing email, dark studio background, dramatic lighting, no text overlay',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ambient decor: signal arcs top-right (wifi/broadcast motif)
  o.push(...signalArcs({ x: W - 80, y: 80, r: 280, rings: 4, color: palette.primary, strokeWidth: 6, intensity: 0.5 }));
  // corner frame accent
  o.push(...cornerFrame({ x: PAD, y: PAD, w: W - PAD * 2, h: H - PAD * 2, color: palette.primary, arm: 80, thickness: 4, intensity: 0.5 }));

  // ── headline zone ──────────────────────────────────────────────────────────
  const headW = W - PAD * 2;
  const headMaxSize = 148;
  const headMinSize = 80;
  const { fontSize: headSize, height: headH } = fitTextBlock(content.headline, {
    width: headW, height: 320, maxSize: headMaxSize, minSize: headMinSize, lineHeight: 1.0
  });
  // yellow accent band behind headline
  o.push(rect({ x: 0, y: PAD, w: W, h: headH + 48, fill: palette.primary, layerRole: 'background' }));
  o.push(textbox({
    text: content.headline, x: PAD, y: PAD + 24,
    w: headW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_BASE, lineHeight: 1.0,
    layerRole: 'headline', bgRef: palette.primary
  }));
  let cursor = PAD + headH + 48 + GAP;

  // subheadline (optional)
  if (content.subheadline) {
    const subBudget = 140;
    const { fontSize: subSize, height: subH } = fitTextBlock(content.subheadline, {
      width: headW, height: subBudget, maxSize: 48, minSize: 32, lineHeight: 1.3
    });
    o.push(textbox({
      text: content.subheadline, x: PAD, y: cursor,
      w: headW, fontSize: subSize,
      fontFamily: fonts.head, fontWeight: '700', fill: palette.primary, lineHeight: 1.3,
      layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += subH + GAP;
  }

  // ── phone frame ────────────────────────────────────────────────────────────
  const ctaH = 160;
  const phoneY = cursor;
  const phoneH = H - ctaH - phoneY - GAP;
  const phoneW = Math.min(800, W - PAD * 2);
  const phoneX = Math.round((W - phoneW) / 2);

  const contentTop = phoneFrame(o, { x: phoneX, y: phoneY, w: phoneW, h: phoneH, palette });
  const contentBot = phoneY + phoneH - 28; // leave bottom padding inside phone
  const cardsH = contentBot - contentTop;

  // ── instruction cards ──────────────────────────────────────────────────────
  const cardPad = 32;
  instructionCards(o, content.blocks || [], palette, fonts, {
    x: phoneX + cardPad, y: contentTop, w: phoneW - cardPad * 2, h: cardsH
  });

  // ── image slot (phone hero) ────────────────────────────────────────────────
  // Placed in the right-margin strip beside the phone frame — the phone is
  // centred at phoneX..phoneX+phoneW (800 px) leaving ~200 px of clear canvas
  // on each side (no headline, card, or CTA text lives there).  This avoids
  // any overlap with the instruction-card message Textboxes.
  const slotMarginX = phoneX + phoneW + 16;          // 16 px gap right of phone
  const slotW = Math.max(60, W - PAD - slotMarginX); // fills margin to PAD edge
  const slotH = Math.min(120, slotW);                 // keep it square-ish
  const slotY = phoneY + Math.round((phoneH - slotH) / 2); // vertically centred in phone zone
  o.push(imageSlot({
    slotId: 'slot-phone-screen',
    x: slotMarginX, y: slotY,
    w: slotW, h: slotH,
    styleHint: 'phishing email screenshot mockup for phone screen, small thumbnail',
    stroke: palette.primary, rx: 10
  }));

  // ── CTA bar ────────────────────────────────────────────────────────────────
  ctaBar(o, content.callToAction, palette, fonts, W, H - ctaH, ctaH);

  return canvas;
}

// ── landscape build ───────────────────────────────────────────────────────────

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  // CONTRACT: first object = full-bleed background image slot
  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'close-up of a smartphone screen showing a phishing email, dark studio background, dramatic lighting, no text overlay',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ambient decor
  o.push(...signalArcs({ x: W - 100, y: 80, r: 220, rings: 3, color: palette.primary, strokeWidth: 5, intensity: 0.45 }));

  // ── layout: left column = headline + subheadline + decor ──────────────────
  const leftW = Math.round(W * 0.46);
  const rightW = W - leftW - PAD * 3;
  const leftX = PAD;
  const rightX = leftX + leftW + PAD * 2;

  // headline yellow band (left column only)
  const headW = leftW - PAD;
  const headBudget = 340;
  const { fontSize: headSize, height: headH } = fitTextBlock(content.headline, {
    width: headW, height: headBudget, maxSize: 128, minSize: 80, lineHeight: 1.0
  });
  o.push(rect({ x: 0, y: PAD, w: leftW + PAD, h: headH + 48, fill: palette.primary, layerRole: 'background' }));
  o.push(textbox({
    text: content.headline, x: leftX, y: PAD + 24,
    w: headW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_BASE, lineHeight: 1.0,
    layerRole: 'headline', bgRef: palette.primary
  }));
  let leftCursor = PAD + headH + 48 + GAP;

  // subheadline (optional)
  if (content.subheadline) {
    const subBudget = 160;
    const { fontSize: subSize, height: subH } = fitTextBlock(content.subheadline, {
      width: headW, height: subBudget, maxSize: 44, minSize: 30, lineHeight: 1.3
    });
    o.push(textbox({
      text: content.subheadline, x: leftX, y: leftCursor,
      w: headW, fontSize: subSize,
      fontFamily: fonts.head, fontWeight: '700', fill: palette.primary, lineHeight: 1.3,
      layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    leftCursor += subH + GAP;
  }

  // left-column image slot below subheadline
  const ctaH = 140;
  const leftImageY = leftCursor + GAP;
  const leftImageH = H - ctaH - leftImageY - 24;
  if (leftImageH > 120) {
    o.push(imageSlot({
      slotId: 'slot-phone-screen',
      x: leftX, y: leftImageY,
      w: headW, h: leftImageH,
      styleHint: 'phishing email screenshot mockup for phone screen, small thumbnail',
      stroke: palette.primary, rx: 16
    }));
  }

  // ── right column = phone frame + instruction cards ─────────────────────────
  const phoneY = PAD;
  const phoneH = H - ctaH - phoneY - GAP;
  const phoneX = rightX;

  const contentTop = phoneFrame(o, { x: phoneX, y: phoneY, w: rightW, h: phoneH, palette });
  const contentBot = phoneY + phoneH - 28;
  const cardsH = contentBot - contentTop;

  const cardPad = 28;
  instructionCards(o, content.blocks || [], palette, fonts, {
    x: phoneX + cardPad, y: contentTop, w: rightW - cardPad * 2, h: cardsH
  });

  // ── CTA bar ────────────────────────────────────────────────────────────────
  ctaBar(o, content.callToAction, palette, fonts, W, H - ctaH, ctaH);

  return canvas;
}

// ── preview helpers ───────────────────────────────────────────────────────────

function phonePreview(parts, x, y, w, h, palette) {
  // phone body
  parts.push(pvRect(x, y, w, h, DARK_PANEL, { rx: Math.round(h * 0.06), stroke: DARK_INK }));
  // notch
  const nw = Math.round(w * 0.44);
  parts.push(pvRect(x + Math.round((w - nw) / 2), y, nw, Math.round(h * 0.06), DARK_BASE, { rx: Math.round(h * 0.03) }));
}

function cardsPreview(parts, x, y, w, h, n, palette) {
  const gap = Math.round(h * 0.04);
  const cardH = Math.round((h - gap * (n - 1)) / n);
  for (let i = 0; i < n; i++) {
    const cy = y + i * (cardH + gap);
    parts.push(pvRect(x, cy, w, cardH, DARK_BASE, { rx: 2, stroke: palette.primary }));
    parts.push(pvCircle(x + 12, cy + Math.round(cardH / 2), 5, palette.primary));
    parts.push(pvBars({ x: x + 22, y: cy + Math.round(cardH / 2) - 6, w: w - 28, lines: 2, barH: 3, gap: 2, fill: DARK_INK }));
  }
}

function previewPortrait(palette) {
  const W = 1414;
  const H = 2000;
  const ctaH = 160;
  const headBandH = 200;
  const phoneW = 800;
  const phoneX = Math.round((W - phoneW) / 2);
  const phoneY = headBandH + 24;
  const phoneH = H - ctaH - phoneY - 24;
  const contentTop = phoneY + Math.round(phoneH * 0.06) + 24;
  const cardsH = phoneH - Math.round(phoneH * 0.06) - 52;

  const parts = [
    pvRect(0, pv(96), pv(W), pv(headBandH), palette.primary),
    pvBars({ x: pv(96), y: pv(96 + 24), w: pv(W - 192), lines: 2, barH: 9, gap: 6, fill: DARK_BASE })
  ];
  phonePreview(parts, pv(phoneX), pv(phoneY), pv(phoneW), pv(phoneH), palette);
  cardsPreview(parts, pv(phoneX + 32), pv(contentTop), pv(phoneW - 64), pv(cardsH), 3, palette);
  parts.push(pvRect(0, pv(H - ctaH), pv(W), pv(ctaH), palette.primary));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000;
  const H = 1414;
  const ctaH = 140;
  const leftW = Math.round(W * 0.46);
  const rightX = leftW + 96 * 2;
  const rightW = W - rightX - 96;
  const phoneY = 96;
  const phoneH = H - ctaH - phoneY - 24;
  const notchH = Math.round(phoneH * 0.06);
  const contentTop = phoneY + notchH + 24;
  const cardsH = phoneH - notchH - 52;

  const parts = [
    pvRect(0, pv(96), pv(leftW + 96), pv(200), palette.primary),
    pvBars({ x: pv(96), y: pv(96 + 24), w: pv(leftW - 96), lines: 2, barH: 9, gap: 6, fill: DARK_BASE }),
    pvSlot(pv(96), pv(96 + 200 + 24), pv(leftW - 96), pv(H - ctaH - 96 - 200 - 48), palette.primary)
  ];
  phonePreview(parts, pv(rightX), pv(phoneY), pv(rightW), pv(phoneH), palette);
  cardsPreview(parts, pv(rightX + 28), pv(contentTop), pv(rightW - 56), pv(cardsH), 3, palette);
  parts.push(pvRect(0, pv(H - ctaH), PV_LAND_W, pv(ctaH), palette.primary));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

// ── export ────────────────────────────────────────────────────────────────────

export default {
  id: 'phone-alert-en',
  name: 'Phishing Alert',
  style: 'bullet',
  description: 'English phishing-alert poster variant: a dark-canvas design built around a phone-frame motif with yellow headline band, styled phone mockup holding three instruction cards, and bold yellow CTA footer.',
  contentSchema: {
    headline: { required: true, maxWords: 5 },
    subheadline: { required: false, maxWords: 10 },
    blocks: { kind: 'sequence', min: 3, max: 3, fields: ['text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
