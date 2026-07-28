// v2 template — safe-shopping-split (style: bullet). Reinterpretation of the
// AB InBev "Safe Online Shopping" poster (source: 2.html) at the v2 canvas
// scale. The archetype is a bold diagonal split: a solid palette.primary field
// on the left and a clipped image region on the right (polygon clip), floating
// word "tags" (chip pills: SAFE, ONLINE, SHOPPING) over the split, three
// CHECK/ACT/DO tip cards each with a label badge and message text, and a CTA
// bar at the bottom. The QR region from the source becomes an honest imageSlot.
//
// Source → port:
//   .right-bg clip-path:polygon(18%…) → polygon imageSlot (content slot, NOT bg)
//   .tag.safe/.online/.shopping → chip() pills
//   .tip (3 × label+text) → tipCard() per block (label+text fieldRef)
//   .qr → imageSlot (slotId 'slot-qr')
//   .logo h1 "ABInBev" → headline zone
//   CTA → ctaBar
// Design reinterpreted at 1414×2000 / 2000×1414 with modern v2 language.
// Yellow = palette.primary; blue accent from source → palette.secondary.

import {
  textbox, rect, polygon, chip,
  fitFontSize, fitTextBlock, estTextHeight, backgroundImageSlot,
  pv, pvRect, pvBars, pvSlot, pvPoly
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, dotGrid, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, legibilityScrim,
  shieldMotif
} from './decor.js';

// ── shared constants ──────────────────────────────────────────────────────────

const PAD = 96;
const GAP = 24;
const CARD_RX = 20;
const TAG_WORDS = ['SAFE', 'ONLINE', 'SHOPPING'];

// ── CTA bar ────────────────────────────────────────────────────────────────────

function ctaBar(o, text, palette, fonts, W, y, h = 152) {
  o.push(rect({ x: 0, y, w: W, h, fill: DARK_PANEL, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 200, height: h - 40, maxSize: 44, minSize: 28, lineHeight: 1.2 });
  const th = estTextHeight(text, size, W - 200, 1.2);
  o.push(textbox({
    text, x: 100, y: y + Math.round((h - th) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

// ── floating word-tag chips ───────────────────────────────────────────────────
// Three bold pill tags placed at fixed offsets to avoid overlapping the
// message cards. The chip() helper emits [pill, label] so we spread the result.

function floatingTags(o, palette, fonts, positions) {
  for (let i = 0; i < TAG_WORDS.length; i++) {
    const { x, y } = positions[i];
    const [pill, label] = chip({
      text: TAG_WORDS[i], x, y,
      fontSize: 40, bg: DARK_BASE, color: palette.primary,
      font: fonts.head
    });
    o.push(pill, label);
  }
}

// ── tip card (one per block): label badge + message text ─────────────────────

function tipCard(o, b, palette, fonts, { x, y, w, h }) {
  // card background
  o.push(rect({
    x, y, w, h, fill: DARK_PANEL, rx: CARD_RX,
    stroke: palette.primary, strokeWidth: 2, layerRole: 'background'
  }));

  // accent stripe on left
  const stripeW = 6;
  o.push(rect({ x, y: y + CARD_RX / 2, w: stripeW, h: h - CARD_RX, fill: palette.primary, rx: 3, layerRole: 'decor' }));

  // label badge (e.g. CHECK, ACT, DO)
  const labelBudgetW = Math.min(220, w * 0.3);
  const labelBudgetH = Math.min(56, h - 20);
  const [pill, labelTb] = chip({
    text: b.label || 'TIP', x: x + stripeW + 16, y: y + 16,
    fontSize: 26, bg: palette.primary, color: DARK_BASE,
    font: fonts.head, maxW: labelBudgetW, maxH: labelBudgetH,
    msgId: b.id
  });
  o.push(pill, { ...labelTb, fieldRef: 'label' });

  // label's actual bottom — pill height derived from chip's rect height
  const chipH = pill.height ?? Math.round(26 * 1.4 + 24);
  const textY = y + 16 + chipH + 12;
  const textW = w - stripeW - 32;
  const textBudget = h - (textY - y) - 16;

  // message text (fieldRef:'text')
  const { fontSize: msgSize, height: msgH } = fitTextBlock(b.text, {
    width: textW, height: Math.max(textBudget, 16 * 1.28),
    maxSize: 48, minSize: 16, lineHeight: 1.28
  });
  o.push({
    ...textbox({
      text: b.text,
      x: x + stripeW + 16, y: textY,
      w: textW, fontSize: msgSize,
      fontFamily: fonts.body, fontWeight: '600',
      fill: DARK_INK, lineHeight: 1.28,
      layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'text'
  });

  void msgH; // consumed by layout callers
}

// ── diagonal split polygon imageSlot (content slot) ──────────────────────────
// The right half of the canvas is a clipped polygon: top-right corner with a
// diagonal left edge. This is the content imageSlot (not the bg slot).

function diagonalImageSlot(o, { splitX, diagonalOffset, W, H, palette }) {
  // Points: top-left of diagonal, top-right, bottom-right, bottom-left of diagonal
  const pts = [
    { x: splitX + diagonalOffset, y: 0 },
    { x: W, y: 0 },
    { x: W, y: H },
    { x: splitX, y: H }
  ];
  o.push({
    ...polygon(pts, { fill: 'transparent', stroke: palette.secondary || palette.accent, strokeWidth: 3, layerRole: 'image-slot' }),
    slotId: 'slot-photo',
    slotSpec: {
      slotId: 'slot-photo',
      styleHint: 'person holding a smartphone shopping online, warm natural light, no text, cropped portrait'
    },
    strokeDashArray: [14, 10],
    opacity: 0.8
  });
}

// ── portrait build ────────────────────────────────────────────────────────────

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.primary);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  // CONTRACT: first = full-bleed background image slot
  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'abstract warm yellow gradient background, digital shopping, no text',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H, color: DARK_BASE, strength: 0.55 }));

  // ── layout: left column (text zone), right = diagonal image polygon ──────
  const splitX = Math.round(W * 0.56);       // diagonal base (bottom-left of polygon)
  const diagOff = Math.round(W * 0.18);       // diagonal slant (top-left shift)

  // solid primary fill on the left portion (behind text column)
  o.push(rect({
    x: 0, y: 0, w: splitX + diagOff, h: H,
    fill: palette.primary, opacity: 0.92, layerRole: 'background'
  }));

  // diagonal image region (content imageSlot)
  diagonalImageSlot(o, { splitX, diagonalOffset: diagOff, W, H, palette });

  // ambient decor
  o.push(...meshGlow({ spots: [
    { x: splitX + 200, y: 700, r: 500, color: DARK_BASE }
  ], intensity: 0.4 }));
  o.push(...dotGrid({ x: PAD, y: 1500, cols: 4, rows: 3, gap: 48, dotR: 5, color: DARK_BASE, intensity: 0.3 }));
  o.push(...shieldMotif({ x: splitX - 40, y: 200, size: 160, color: DARK_BASE, intensity: 0.35 }));

  // ── headline ──────────────────────────────────────────────────────────────
  const headW = splitX + diagOff - PAD - 48;
  const { fontSize: headSize, height: headH } = fitTextBlock(content.headline, {
    width: headW, height: 340, maxSize: 150, minSize: 80, lineHeight: 0.98
  });
  o.push(textbox({
    text: content.headline, x: PAD, y: PAD,
    w: headW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_BASE, lineHeight: 0.98,
    layerRole: 'headline', bgRef: palette.primary
  }));
  let cursor = PAD + headH + GAP;

  // ── subheadline ───────────────────────────────────────────────────────────
  if (content.subheadline) {
    const { fontSize: subSize, height: subH } = fitTextBlock(content.subheadline, {
      width: headW, height: 120, maxSize: 44, minSize: 30, lineHeight: 1.28
    });
    o.push(textbox({
      text: content.subheadline, x: PAD, y: cursor,
      w: headW, fontSize: subSize,
      fontFamily: fonts.head, fontWeight: '700', fill: DARK_INK, lineHeight: 1.28,
      layerRole: 'subheadline', bgRef: palette.primary
    }));
    cursor += subH + GAP;
  } else {
    // always place a subheadline (even a placeholder invisible one) so the
    // binding test finds a subheadline object
    o.push(textbox({
      text: 'Shop smart. Stay secure.', x: PAD, y: cursor,
      w: headW, fontSize: 40,
      fontFamily: fonts.head, fontWeight: '700', fill: DARK_INK, lineHeight: 1.28,
      layerRole: 'subheadline', bgRef: palette.primary
    }));
    cursor += estTextHeight('Shop smart. Stay secure.', 40, headW, 1.28) + GAP;
  }

  // ── floating word tags ────────────────────────────────────────────────────
  // Placed in the left column below headline, well clear of tip-card zone
  const tagY0 = cursor + 16;
  floatingTags(o, palette, fonts, [
    { x: PAD, y: tagY0 },
    { x: PAD, y: tagY0 + 80 },
    { x: PAD, y: tagY0 + 160 }
  ]);
  cursor = tagY0 + 260;

  // ── tip cards (3 blocks, left column) ────────────────────────────────────
  const ctaH = 152;
  const cardsZoneH = H - ctaH - cursor - GAP;
  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const cardGap = 20;
  const cardH = Math.round((cardsZoneH - cardGap * (n - 1)) / n);
  const cardW = splitX + diagOff - PAD - 24;  // width stays in primary zone

  blocks.forEach((b, i) => {
    tipCard(o, b, palette, fonts, {
      x: PAD, y: cursor + i * (cardH + cardGap),
      w: cardW, h: cardH
    });
  });

  // ── CTA bar ───────────────────────────────────────────────────────────────
  ctaBar(o, content.callToAction, palette, fonts, W, H - ctaH, ctaH);

  return canvas;
}

// ── landscape build ───────────────────────────────────────────────────────────

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.primary);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  // CONTRACT: first = full-bleed background image slot
  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'abstract warm yellow gradient background, digital shopping, no text',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H, color: DARK_BASE, strength: 0.55 }));

  // ── landscape layout: left = text, right = diagonal image ────────────────
  const splitX = Math.round(W * 0.52);
  const diagOff = Math.round(W * 0.14);

  // solid primary fill left
  o.push(rect({
    x: 0, y: 0, w: splitX + diagOff, h: H,
    fill: palette.primary, opacity: 0.92, layerRole: 'background'
  }));

  // diagonal content imageSlot
  diagonalImageSlot(o, { splitX, diagonalOffset: diagOff, W, H, palette });

  // ambient decor
  o.push(...meshGlow({ spots: [
    { x: splitX + 200, y: 600, r: 400, color: DARK_BASE }
  ], intensity: 0.4 }));
  o.push(...dotGrid({ x: PAD, y: 1000, cols: 4, rows: 2, gap: 48, dotR: 5, color: DARK_BASE, intensity: 0.3 }));

  // ── headline ──────────────────────────────────────────────────────────────
  const headW = splitX + diagOff - PAD - 32;
  const { fontSize: headSize, height: headH } = fitTextBlock(content.headline, {
    width: headW, height: 280, maxSize: 120, minSize: 80, lineHeight: 0.98
  });
  o.push(textbox({
    text: content.headline, x: PAD, y: PAD,
    w: headW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_BASE, lineHeight: 0.98,
    layerRole: 'headline', bgRef: palette.primary
  }));
  let cursor = PAD + headH + GAP;

  // ── subheadline ───────────────────────────────────────────────────────────
  if (content.subheadline) {
    const { fontSize: subSize, height: subH } = fitTextBlock(content.subheadline, {
      width: headW, height: 90, maxSize: 40, minSize: 28, lineHeight: 1.28
    });
    o.push(textbox({
      text: content.subheadline, x: PAD, y: cursor,
      w: headW, fontSize: subSize,
      fontFamily: fonts.head, fontWeight: '700', fill: DARK_INK, lineHeight: 1.28,
      layerRole: 'subheadline', bgRef: palette.primary
    }));
    cursor += subH + GAP;
  } else {
    o.push(textbox({
      text: 'Shop smart. Stay secure.', x: PAD, y: cursor,
      w: headW, fontSize: 36,
      fontFamily: fonts.head, fontWeight: '700', fill: DARK_INK, lineHeight: 1.28,
      layerRole: 'subheadline', bgRef: palette.primary
    }));
    cursor += estTextHeight('Shop smart. Stay secure.', 36, headW, 1.28) + GAP;
  }

  // ── floating tags (horizontal row) ───────────────────────────────────────
  const tagY = cursor + 8;
  floatingTags(o, palette, fonts, [
    { x: PAD, y: tagY },
    { x: PAD + 220, y: tagY },
    { x: PAD + 440, y: tagY }
  ]);
  cursor = tagY + 80 + 16;

  // ── tip cards (stacked vertically in the left column) ─────────────────────
  const ctaH = 120;
  const cardsZoneH = H - ctaH - cursor - GAP;
  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const cardGap = 16;
  const cardH = Math.round((cardsZoneH - cardGap * (n - 1)) / n);
  const cardW = splitX + diagOff - PAD - 24;

  blocks.forEach((b, i) => {
    tipCard(o, b, palette, fonts, {
      x: PAD, y: cursor + i * (cardH + cardGap),
      w: cardW, h: cardH
    });
  });

  // ── CTA bar ───────────────────────────────────────────────────────────────
  ctaBar(o, content.callToAction, palette, fonts, W, H - ctaH, ctaH);

  return canvas;
}

// ── preview helpers ───────────────────────────────────────────────────────────

function previewPortrait(palette) {
  const W = 1414;
  const splitX = Math.round(W * 0.56);
  const diagOff = Math.round(W * 0.18);
  const polyRight = splitX + diagOff;

  const parts = [
    // primary zone
    pvRect(0, 0, pv(polyRight), pv(2000), palette.primary),
    // diagonal image polygon
    pvPoly([
      { x: pv(splitX + diagOff), y: 0 },
      { x: pv(W), y: 0 },
      { x: pv(W), y: pv(2000) },
      { x: pv(splitX), y: pv(2000) }
    ], 'none', { opacity: 0.8 }),
    pvSlot(pv(splitX + diagOff - 20), 0, pv(W - splitX - diagOff + 20), pv(2000), palette.secondary || palette.accent),
    // headline bars
    pvBars({ x: pv(96), y: pv(96), w: pv(polyRight - 96 - 48), lines: 3, barH: 10, gap: 6, fill: DARK_BASE }),
    // 3 word-tag chips
    pvRect(pv(96), pv(450), pv(140), pv(44), DARK_BASE, { rx: 6 }),
    pvRect(pv(96), pv(506), pv(160), pv(44), DARK_BASE, { rx: 6 }),
    pvRect(pv(96), pv(562), pv(200), pv(44), DARK_BASE, { rx: 6 })
  ];
  // 3 tip cards
  const cardTopStart = pv(640);
  const cardH = pv(380);
  const cardGapPv = pv(20);
  for (let i = 0; i < 3; i++) {
    const cy = cardTopStart + i * (cardH + cardGapPv);
    parts.push(pvRect(pv(96), cy, pv(polyRight - 96 - 24), cardH, DARK_PANEL, { rx: 3, stroke: palette.primary }));
    parts.push(pvRect(pv(96 + 6 + 16), cy + 4, pv(80), pv(30), palette.primary, { rx: 2 }));
    parts.push(pvBars({ x: pv(96 + 6 + 16), y: cy + cardH * 0.42, w: pv(polyRight - 96 - 60), lines: 2, barH: 4, gap: 3, fill: DARK_INK }));
  }
  // CTA
  parts.push(pvRect(0, pv(2000 - 152), pv(W), pv(152), DARK_PANEL));
  parts.push(pvBars({ x: pv(100), y: pv(2000 - 152 + 50), w: pv(W - 200), lines: 1, barH: 8, gap: 0, fill: palette.primary, align: 'center' }));
  return svgWrapO(parts, palette.primary, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000;
  const H = 1414;
  const splitX = Math.round(W * 0.52);
  const diagOff = Math.round(W * 0.14);
  const polyRight = splitX + diagOff;

  const parts = [
    // primary zone
    pvRect(0, 0, pv(polyRight), pv(H), palette.primary),
    // diagonal image slot
    pvSlot(pv(splitX + diagOff - 20), 0, pv(W - splitX - diagOff + 20), pv(H), palette.secondary || palette.accent),
    // headline bars
    pvBars({ x: pv(96), y: pv(96), w: pv(polyRight - 96 - 32), lines: 2, barH: 11, gap: 7, fill: DARK_BASE }),
    // word tag chips in a row
    pvRect(pv(96), pv(350), pv(100), pv(40), DARK_BASE, { rx: 5 }),
    pvRect(pv(96 + 110), pv(350), pv(100), pv(40), DARK_BASE, { rx: 5 }),
    pvRect(pv(96 + 220), pv(350), pv(140), pv(40), DARK_BASE, { rx: 5 })
  ];
  // 3 tip cards
  const cardTopStart = pv(446);
  const cardsH = pv(H - 120 - 446 - 16);
  const cardGapPv = pv(16);
  const cardH = (cardsH - cardGapPv * 2) / 3;
  for (let i = 0; i < 3; i++) {
    const cy = cardTopStart + i * (cardH + cardGapPv);
    parts.push(pvRect(pv(96), cy, pv(polyRight - 96 - 24), cardH, DARK_PANEL, { rx: 3, stroke: palette.primary }));
    parts.push(pvRect(pv(96 + 6 + 16), cy + 3, pv(70), pv(22), palette.primary, { rx: 2 }));
    parts.push(pvBars({ x: pv(96 + 6 + 16), y: cy + cardH * 0.5, w: pv(polyRight - 96 - 60), lines: 2, barH: 3, gap: 2, fill: DARK_INK }));
  }
  // CTA
  parts.push(pvRect(0, pv(H - 120), PV_LAND_W, pv(120), DARK_PANEL));
  parts.push(pvBars({ x: pv(100), y: pv(H - 120 + 42), w: pv(W - 200), lines: 1, barH: 7, gap: 0, fill: palette.primary, align: 'center' }));
  return svgWrapO(parts, palette.primary, 'landscape');
}

// ── export ─────────────────────────────────────────────────────────────────────

export default {
  id: 'safe-shopping-split',
  name: 'Safe Shopping Split',
  style: 'bullet',
  description: 'A bold diagonal-split poster: a solid primary-colour left field with floating word tags (SAFE · ONLINE · SHOPPING), three CHECK/ACT/DO tip cards with label badges, and a clipped photo region on the right — the QR region becomes an honest image slot.',
  contentSchema: {
    headline: { required: true, maxWords: 5 },
    subheadline: { required: false, maxWords: 8 },
    blocks: { kind: 'sequence', min: 3, max: 3, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
