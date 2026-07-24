// v2 template — constellation-before-after (style: scenario). Reinterpretation
// of the AB InBev "The Constellation Move" poster (source: 24.html) at the v2
// canvas scale.
//
// The archetype is a before/after "From → To" opposition:
//   – left/top panel: the "FROM" situation (old state)
//   – right/bottom panel: the "TO" response (new/correct state)
//   – a central accent arrow separating the two halves
//   – bold headline + CTA
//
// Source → port:
//   800×800 square     → portrait 1414×2000, landscape 2000×1414
//   purple #512258 bg  → palette.accent (NOT hardcoded)
//   Nunito font        → fonts.head / fonts.body
//   left diagonal half → From column (DARK_PANEL, left)
//   right diagonal half→ To column (accent-tinted panel, right)
//   base64 PNGs        → imageSlot slotId:'slot-1' (NOT embedded)
//   "FROM" / "TO" pill labels → chip text (fieldRef:'situation' / fieldRef:'response')
//
// Design: portrait = stacked FROM→TO rows (each block is a pair); landscape =
// two-column layout, all FROMs left, all TOs right with vertical divider.
// Accent arrow motif between the two panels per block.
//
// CRITICAL: blocks MULTI-FIELD ['situation','response']:
//   situation chip+text → msgId:b.id fieldRef:'situation' layerRole:'message'(≥38)
//   response chip+text  → msgId:b.id fieldRef:'response'  layerRole:'message'(≥38)
//   At least one object per block is layerRole:'message' with msgId===block.id.
// CRITICAL: each field's text height budget = REAL remaining space; no overflow at max(4).
// NO hardcoded brand hex — palette.accent replaces all purple.

import {
  textbox, rect, polygon, chip, imageSlot, backgroundImageSlot,
  fitFontSize, fitTextBlock, estTextHeight,
  pv, pvRect, pvBars, pvSlot, pvPoly,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, legibilityScrim, meshGlow, dotGrid,
  signalArcs, cornerFrame,
  svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK,
} from './decor.js';

// ── constants ─────────────────────────────────────────────────────────────────

const PAD = 80;        // outer margin
const GAP = 20;        // gap between blocks
const CHIP_H = 52;     // label chip zone height
const CARD_RX = 24;    // card corner radius
const ARROW_LEN = 60;  // horizontal arrow length in portrait
const ARROW_HALF = 22; // arrowhead half-height
const MIN_MSG_SIZE = 38; // message fontSize floor

// Portrait zone heights
const HEADER_H_P = 280;   // headline + subheadline
const CTA_H_P   = 120;    // CTA bar
const SLOT_SZ_P = 220;    // image slot (top-right corner)

// Landscape zone heights
const HEADER_H_L = 200;
const CTA_H_L   = 96;
const SLOT_SZ_L = 180;

// ── helper: right-pointing accent arrow ──────────────────────────────────────

function arrowRight(o, palette, { x, midY, len }) {
  o.push(polygon([
    { x,           y: midY - ARROW_HALF },
    { x: x + len,  y: midY },
    { x,           y: midY + ARROW_HALF }
  ], { fill: palette.accent, layerRole: 'decor' }));
}

// ── helper: CTA bar ───────────────────────────────────────────────────────────

function ctaBar(o, text, palette, fonts, W, y, h) {
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: DARK_BASE, opacity: 0.18, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - PAD * 2, height: h - 24, maxSize: 48, minSize: 28, lineHeight: 1.2 });
  const th = estTextHeight(text, size, W - PAD * 2, 1.2);
  o.push(textbox({
    text, x: PAD, y: y + Math.round((h - th) / 2),
    w: W - PAD * 2, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, align: 'center', layerRole: 'cta', bgRef: palette.primary
  }));
}

// ── helper: headline zone ─────────────────────────────────────────────────────

function headlineZone(o, content, palette, fonts, { x, y, w, h }) {
  let cursor = y;
  // Supra "FROM → TO" tag in accent
  const supraTxt = 'FROM  →  TO';
  const supraSize = fitFontSize(supraTxt, { width: w * 0.55, height: 48, maxSize: 34, minSize: 24, lineHeight: 1.1 });
  const supraH = estTextHeight(supraTxt, supraSize, w * 0.55, 1.1);
  o.push(textbox({
    text: supraTxt, x, y: cursor,
    w: Math.round(w * 0.55), fontSize: supraSize, fontFamily: fonts.head, fontWeight: '900',
    fill: palette.accent, lineHeight: 1.1, align: 'left',
    layerRole: 'decor', bgRef: DARK_BASE
  }));
  cursor += supraH + 12;

  // Headline — verbatim, fontSize ≥ 80
  const headBudget = h - (cursor - y) - 32;
  const { fontSize: headSize, height: headH } = fitTextBlock(content.headline, {
    width: w, height: Math.max(headBudget, 80 * 1.1),
    maxSize: 108, minSize: 80, lineHeight: 1.06
  });
  o.push(textbox({
    text: content.headline, x, y: cursor, w,
    fontSize: headSize, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_INK, lineHeight: 1.06, align: 'left',
    layerRole: 'headline', bgRef: DARK_BASE
  }));
  cursor += headH + 12;

  // Optional subheadline
  if (content.subheadline) {
    const subBudget = h - (cursor - y);
    if (subBudget > 36) {
      const subSize = fitFontSize(content.subheadline, {
        width: w, height: Math.max(subBudget, 36), maxSize: 42, minSize: 28, lineHeight: 1.3
      });
      o.push(textbox({
        text: content.subheadline, x, y: cursor, w,
        fontSize: subSize, fontFamily: fonts.body, fontWeight: '500',
        fill: DARK_INK, lineHeight: 1.3, align: 'left',
        layerRole: 'subheadline', bgRef: DARK_BASE, opacity: 0.75
      }));
    }
  }
}

// ── portrait: one block = stacked FROM card → TO card ────────────────────────
// Each pair is a "FROM row" above a "TO row" with an accent arrow between them.
// Heights are derived from the total available zone divided by block count.

function buildBlockPortrait(o, b, palette, fonts, { x, w, y, rowH }) {
  // rowH = total height for this block's from+arrow+to
  const arrowGap  = ARROW_HALF * 2 + 24; // visual gap for the arrow connector
  const cardH     = Math.floor((rowH - arrowGap) / 2);
  const innerPad  = 28;
  const textW     = w - innerPad * 2;

  // ── FROM card (situation) ────────────────────────────────────────────────
  const fromY = y;
  o.push(rect({
    x, y: fromY, w, h: cardH, fill: DARK_PANEL, rx: CARD_RX,
    stroke: palette.accent, strokeWidth: 2, opacity: 1,
    layerRole: 'background'
  }));
  // Left accent stripe
  o.push(rect({ x, y: fromY + CARD_RX, w: 5, h: cardH - CARD_RX * 2, fill: palette.accent, layerRole: 'decor' }));

  // "FROM" chip
  const [fromPill, fromLabel] = chip({
    text: 'FROM', x: x + innerPad, y: fromY + 18, fontSize: 22,
    bg: palette.accent, color: DARK_BASE, font: fonts.head, msgId: b.id
  });
  o.push(fromPill);
  // chip returns message-label role; situation chip does NOT carry fieldRef (it's decorative label)
  o.push(fromLabel);

  // Situation text — layerRole:'message', fieldRef:'situation'
  const sitBudget = cardH - CHIP_H - innerPad * 1.5 - 8;
  const { fontSize: sitSize } = fitTextBlock(b.situation, {
    width: textW, height: Math.max(sitBudget, MIN_MSG_SIZE * 1.3),
    maxSize: 52, minSize: MIN_MSG_SIZE, lineHeight: 1.3
  });
  const sitH = estTextHeight(b.situation, sitSize, textW, 1.3);
  o.push({
    ...textbox({
      text: b.situation,
      x: x + innerPad, y: fromY + CHIP_H + 18, w: textW,
      fontSize: sitSize, fontFamily: fonts.body, fontWeight: '700',
      fill: DARK_INK, lineHeight: 1.3,
      layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'situation'
  });
  void sitH; // used for layout budget confirmation; actual position uses budget

  // ── Arrow connector ───────────────────────────────────────────────────────
  const arrowY = fromY + cardH + Math.floor(arrowGap / 2);
  arrowRight(o, palette, { x: x + Math.round(w / 2) - ARROW_LEN / 2, midY: arrowY, len: ARROW_LEN });

  // ── TO card (response) ────────────────────────────────────────────────────
  const toY = fromY + cardH + arrowGap;
  const toFill = DARK_BASE; // distinct from DARK_PANEL
  o.push(rect({
    x, y: toY, w, h: cardH, fill: toFill, rx: CARD_RX,
    stroke: palette.primary, strokeWidth: 2,
    layerRole: 'background'
  }));
  // Left accent stripe in primary
  o.push(rect({ x, y: toY + CARD_RX, w: 5, h: cardH - CARD_RX * 2, fill: palette.primary, layerRole: 'decor' }));

  // "TO" chip
  const [toPill, toLabel] = chip({
    text: 'TO', x: x + innerPad, y: toY + 18, fontSize: 22,
    bg: palette.primary, color: DARK_BASE, font: fonts.head, msgId: b.id
  });
  o.push(toPill);
  o.push(toLabel);

  // Response text — layerRole:'message', fieldRef:'response'
  const resBudget = cardH - CHIP_H - innerPad * 1.5 - 8;
  const { fontSize: resSize } = fitTextBlock(b.response, {
    width: textW, height: Math.max(resBudget, MIN_MSG_SIZE * 1.3),
    maxSize: 52, minSize: MIN_MSG_SIZE, lineHeight: 1.3
  });
  o.push({
    ...textbox({
      text: b.response,
      x: x + innerPad, y: toY + CHIP_H + 18, w: textW,
      fontSize: resSize, fontFamily: fonts.body, fontWeight: '700',
      fill: DARK_INK, lineHeight: 1.3,
      layerRole: 'message', msgId: b.id, bgRef: toFill
    }),
    fieldRef: 'response'
  });
}

// ── landscape: FROM column (left) vs TO column (right), one row per block ────
// Each row has a FROM cell and a TO cell side by side, connected by an arrow.

function buildBlockLandscape(o, b, palette, fonts, { sx, sw, rx, rw, y, h }) {
  const innerPad = 28;

  // ── FROM cell (left) ──────────────────────────────────────────────────────
  o.push(rect({
    x: sx, y, w: sw, h, fill: DARK_PANEL, rx: CARD_RX,
    stroke: palette.accent, strokeWidth: 2,
    layerRole: 'background'
  }));
  o.push(rect({ x: sx, y: y + CARD_RX, w: 5, h: h - CARD_RX * 2, fill: palette.accent, layerRole: 'decor' }));

  const [fp, fl] = chip({
    text: 'FROM', x: sx + innerPad, y: y + 16, fontSize: 20,
    bg: palette.accent, color: DARK_BASE, font: fonts.head, msgId: b.id
  });
  o.push(fp);
  o.push(fl);

  const textWL = sw - innerPad * 2;
  const sitBudgetL = h - CHIP_H - innerPad * 1.5;
  const { fontSize: sitSizeL } = fitTextBlock(b.situation, {
    width: textWL, height: Math.max(sitBudgetL, MIN_MSG_SIZE * 1.3),
    maxSize: 46, minSize: MIN_MSG_SIZE, lineHeight: 1.3
  });
  o.push({
    ...textbox({
      text: b.situation,
      x: sx + innerPad, y: y + CHIP_H + 14, w: textWL,
      fontSize: sitSizeL, fontFamily: fonts.body, fontWeight: '700',
      fill: DARK_INK, lineHeight: 1.3,
      layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'situation'
  });

  // ── Arrow ─────────────────────────────────────────────────────────────────
  arrowRight(o, palette, { x: sx + sw + 14, midY: y + Math.round(h / 2), len: rx - sx - sw - 28 });

  // ── TO cell (right) ───────────────────────────────────────────────────────
  const toFillL = DARK_BASE;
  o.push(rect({
    x: rx, y, w: rw, h, fill: toFillL, rx: CARD_RX,
    stroke: palette.primary, strokeWidth: 2,
    layerRole: 'background'
  }));
  o.push(rect({ x: rx, y: y + CARD_RX, w: 5, h: h - CARD_RX * 2, fill: palette.primary, layerRole: 'decor' }));

  const [tp, tl] = chip({
    text: 'TO', x: rx + innerPad, y: y + 16, fontSize: 20,
    bg: palette.primary, color: DARK_BASE, font: fonts.head, msgId: b.id
  });
  o.push(tp);
  o.push(tl);

  const textWR = rw - innerPad * 2;
  const resBudgetL = h - CHIP_H - innerPad * 1.5;
  const { fontSize: resSizeL } = fitTextBlock(b.response, {
    width: textWR, height: Math.max(resBudgetL, MIN_MSG_SIZE * 1.3),
    maxSize: 46, minSize: MIN_MSG_SIZE, lineHeight: 1.3
  });
  o.push({
    ...textbox({
      text: b.response,
      x: rx + innerPad, y: y + CHIP_H + 14, w: textWR,
      fontSize: resSizeL, fontFamily: fonts.body, fontWeight: '700',
      fill: DARK_INK, lineHeight: 1.3,
      layerRole: 'message', msgId: b.id, bgRef: toFillL
    }),
    fieldRef: 'response'
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
    styleHint: 'dark moody atmospheric background, subtle abstract constellation pattern, soft starfield, before and after concept, no text, no faces',
    stroke: palette.accent, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // Decor atmosphere: mesh glow + dot grid + signal arcs
  o.push(...meshGlow({
    spots: [
      { x: Math.round(W * 0.18), y: Math.round(H * 0.32), r: 380, color: palette.accent },
      { x: Math.round(W * 0.82), y: Math.round(H * 0.68), r: 340, color: palette.primary }
    ],
    intensity: 0.85
  }));
  o.push(...dotGrid({
    x: W - 220, y: 60,
    cols: 4, rows: 5, gap: 44, dotR: 4,
    color: palette.primary, intensity: 0.15
  }));
  o.push(...signalArcs({ x: Math.round(W * 0.5), y: Math.round(H * 0.5), r: 360, rings: 3, color: palette.accent, strokeWidth: 6, intensity: 0.1 }));
  o.push(...cornerFrame({ x: 32, y: 32, w: W - 64, h: H - 64, color: palette.primary, arm: 80, thickness: 5, intensity: 0.65 }));

  // ── headline zone ──────────────────────────────────────────────────────────
  // Image slot top-right, headline left
  const slotX = W - PAD - SLOT_SZ_P;
  const slotY = 60;
  o.push(imageSlot({
    slotId: 'slot-1',
    x: slotX, y: slotY, w: SLOT_SZ_P, h: SLOT_SZ_P,
    styleHint: 'abstract transformation or metamorphosis emblem, constellation/stars motif, flat vector, no text',
    stroke: palette.accent, rx: 16
  }));

  headlineZone(o, content, palette, fonts, {
    x: PAD, y: 64,
    w: slotX - PAD - 40,
    h: HEADER_H_P - 64
  });

  // ── blocks zone ────────────────────────────────────────────────────────────
  // Stack each block as FROM card → arrow → TO card pairs
  const blocks = content.blocks || [];
  const blocksY  = HEADER_H_P + GAP;
  const blocksH  = H - CTA_H_P - GAP - blocksY;
  const blockW   = W - PAD * 2;
  // Each block gets equal rowH; rowH includes both cards + arrow gap
  const rowH = Math.floor((blocksH - GAP * (blocks.length - 1)) / Math.max(blocks.length, 1));

  blocks.forEach((b, i) => {
    buildBlockPortrait(o, b, palette, fonts, {
      x: PAD,
      w: blockW,
      y: blocksY + i * (rowH + GAP),
      rowH
    });
  });

  // ── CTA bar ────────────────────────────────────────────────────────────────
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
    styleHint: 'dark moody atmospheric background, subtle abstract constellation pattern, soft starfield, before and after concept, no text, no faces',
    stroke: palette.accent, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // Decor atmosphere
  o.push(...meshGlow({
    spots: [
      { x: Math.round(W * 0.15), y: Math.round(H * 0.40), r: 320, color: palette.accent },
      { x: Math.round(W * 0.85), y: Math.round(H * 0.60), r: 300, color: palette.primary }
    ],
    intensity: 0.80
  }));
  o.push(...dotGrid({
    x: W - 200, y: 50,
    cols: 4, rows: 4, gap: 40, dotR: 4,
    color: palette.primary, intensity: 0.14
  }));
  o.push(...cornerFrame({ x: 28, y: 28, w: W - 56, h: H - 56, color: palette.primary, arm: 70, thickness: 4, intensity: 0.60 }));

  // ── headline zone (top band) ───────────────────────────────────────────────
  const slotX = W - PAD - SLOT_SZ_L;
  const slotY = 48;
  o.push(imageSlot({
    slotId: 'slot-1',
    x: slotX, y: slotY, w: SLOT_SZ_L, h: SLOT_SZ_L,
    styleHint: 'abstract transformation or metamorphosis emblem, constellation/stars motif, flat vector, no text',
    stroke: palette.accent, rx: 14
  }));

  headlineZone(o, content, palette, fonts, {
    x: PAD, y: 52,
    w: slotX - PAD - 40,
    h: HEADER_H_L - 52
  });

  // ── blocks zone: FROM column left, TO column right ─────────────────────────
  // Layout: blocks stacked vertically; FROM cell left half, TO cell right half
  const blocks = content.blocks || [];
  const blocksY = HEADER_H_L + GAP;
  const blocksH = H - CTA_H_L - GAP - blocksY;
  const rowH = Math.floor((blocksH - GAP * (blocks.length - 1)) / Math.max(blocks.length, 1));

  // Arrow gap between columns
  const arrowZone = 80;
  const halfW = Math.floor((W - PAD * 2 - arrowZone) / 2);
  const sx = PAD;
  const sw = halfW;
  const rx = PAD + halfW + arrowZone;
  const rw = W - PAD - rx;

  blocks.forEach((b, i) => {
    buildBlockLandscape(o, b, palette, fonts, {
      sx, sw, rx, rw,
      y: blocksY + i * (rowH + GAP),
      h: rowH
    });
  });

  // ── CTA bar ────────────────────────────────────────────────────────────────
  ctaBar(o, content.callToAction, palette, fonts, W, H - CTA_H_L, CTA_H_L);

  return canvas;
}

// ── preview portrait ──────────────────────────────────────────────────────────

function previewPortrait(palette) {
  const W = 1414;
  const H = 2000;
  const nBlocks = 4; // max count for preview

  const blocksY = HEADER_H_P + GAP;
  const blocksH = H - CTA_H_P - GAP - blocksY;
  const rowH = Math.floor((blocksH - GAP * (nBlocks - 1)) / nBlocks);
  const arrowGap = ARROW_HALF * 2 + 24;
  const cardH = Math.floor((rowH - arrowGap) / 2);

  const parts = [];

  // Slot + headline
  parts.push(pvSlot(pv(W - PAD - SLOT_SZ_P), pv(slotY_p()), pv(SLOT_SZ_P), pv(SLOT_SZ_P), palette.accent));
  parts.push(pvBars({ x: pv(PAD), y: pv(72), w: pv(W - PAD * 2 - SLOT_SZ_P - 48), lines: 2, barH: 9, gap: 5, fill: palette.accent }));
  parts.push(pvBars({ x: pv(PAD), y: pv(120), w: pv(W - PAD * 2 - SLOT_SZ_P - 48), lines: 2, barH: 13, gap: 6, fill: DARK_INK }));

  for (let i = 0; i < nBlocks; i++) {
    const y0 = blocksY + i * (rowH + GAP);
    const fY = y0;
    const tY = y0 + cardH + arrowGap;
    // FROM card
    parts.push(pvRect(pv(PAD), pv(fY), pv(W - PAD * 2), pv(cardH), DARK_PANEL, { rx: 4, stroke: palette.accent }));
    parts.push(pvRect(pv(PAD), pv(fY + CARD_RX), pv(4), pv(cardH - CARD_RX * 2), palette.accent));
    parts.push(pvRect(pv(PAD + 28), pv(fY + 18), pv(120), 6, palette.accent, { rx: 3 }));
    parts.push(pvBars({ x: pv(PAD + 28), y: pv(fY + CHIP_H + 18), w: pv(W - PAD * 2 - 56), lines: 2, barH: 4, gap: 4, fill: DARK_INK }));
    // Arrow
    const arrowMid = fY + cardH + Math.floor(arrowGap / 2);
    parts.push(pvPoly([
      { x: pv(W / 2 - ARROW_LEN / 2), y: pv(arrowMid - ARROW_HALF) },
      { x: pv(W / 2 + ARROW_LEN / 2), y: pv(arrowMid) },
      { x: pv(W / 2 - ARROW_LEN / 2), y: pv(arrowMid + ARROW_HALF) }
    ], palette.accent));
    // TO card
    parts.push(pvRect(pv(PAD), pv(tY), pv(W - PAD * 2), pv(cardH), DARK_BASE, { rx: 4, stroke: palette.primary }));
    parts.push(pvRect(pv(PAD), pv(tY + CARD_RX), pv(4), pv(cardH - CARD_RX * 2), palette.primary));
    parts.push(pvRect(pv(PAD + 28), pv(tY + 18), pv(80), 6, palette.primary, { rx: 3 }));
    parts.push(pvBars({ x: pv(PAD + 28), y: pv(tY + CHIP_H + 18), w: pv(W - PAD * 2 - 56), lines: 2, barH: 4, gap: 4, fill: DARK_INK }));
  }

  // CTA
  parts.push(pvRect(0, pv(H - CTA_H_P), pv(W), pv(CTA_H_P), palette.primary));
  parts.push(pvBars({ x: pv(PAD), y: pv(H - CTA_H_P + 30), w: pv(W - PAD * 2), lines: 1, barH: 8, gap: 0, fill: DARK_BASE, align: 'center' }));

  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function slotY_p() { return 60; }

// ── preview landscape ─────────────────────────────────────────────────────────

function previewLandscape(palette) {
  const W = 2000;
  const H = 1414;
  const nBlocks = 4;

  const blocksY = HEADER_H_L + GAP;
  const blocksH = H - CTA_H_L - GAP - blocksY;
  const rowH = Math.floor((blocksH - GAP * (nBlocks - 1)) / nBlocks);

  const arrowZone = 80;
  const halfW = Math.floor((W - PAD * 2 - arrowZone) / 2);
  const sx = PAD;
  const sw = halfW;
  const rx = PAD + halfW + arrowZone;
  const rw = W - PAD - rx;

  const parts = [];

  // Slot + headline
  parts.push(pvSlot(pv(W - PAD - SLOT_SZ_L), pv(48), pv(SLOT_SZ_L), pv(SLOT_SZ_L), palette.accent));
  parts.push(pvBars({ x: pv(PAD), y: pv(56), w: pv(W - PAD * 2 - SLOT_SZ_L - 40), lines: 1, barH: 6, gap: 0, fill: palette.accent }));
  parts.push(pvBars({ x: pv(PAD), y: pv(80), w: pv(W - PAD * 2 - SLOT_SZ_L - 40), lines: 2, barH: 10, gap: 5, fill: DARK_INK }));

  for (let i = 0; i < nBlocks; i++) {
    const y0 = blocksY + i * (rowH + GAP);
    // FROM cell (left)
    parts.push(pvRect(pv(sx), pv(y0), pv(sw), pv(rowH), DARK_PANEL, { rx: 4, stroke: palette.accent }));
    parts.push(pvRect(pv(sx), pv(y0 + CARD_RX), pv(4), pv(rowH - CARD_RX * 2), palette.accent));
    parts.push(pvRect(pv(sx + 28), pv(y0 + 16), pv(100), 5, palette.accent, { rx: 2.5 }));
    parts.push(pvBars({ x: pv(sx + 28), y: pv(y0 + CHIP_H + 14), w: pv(sw - 56), lines: 2, barH: 3.5, gap: 3, fill: DARK_INK }));
    // Arrow
    const midY = y0 + Math.round(rowH / 2);
    parts.push(pvPoly([
      { x: pv(sx + sw + 14), y: pv(midY - ARROW_HALF) },
      { x: pv(rx - 14),      y: pv(midY) },
      { x: pv(sx + sw + 14), y: pv(midY + ARROW_HALF) }
    ], palette.accent));
    // TO cell (right)
    parts.push(pvRect(pv(rx), pv(y0), pv(rw), pv(rowH), DARK_BASE, { rx: 4, stroke: palette.primary }));
    parts.push(pvRect(pv(rx), pv(y0 + CARD_RX), pv(4), pv(rowH - CARD_RX * 2), palette.primary));
    parts.push(pvRect(pv(rx + 28), pv(y0 + 16), pv(70), 5, palette.primary, { rx: 2.5 }));
    parts.push(pvBars({ x: pv(rx + 28), y: pv(y0 + CHIP_H + 14), w: pv(rw - 56), lines: 2, barH: 3.5, gap: 3, fill: DARK_INK }));
  }

  // CTA
  parts.push(pvRect(0, pv(H - CTA_H_L), PV_LAND_W, pv(CTA_H_L), palette.primary));
  parts.push(pvBars({ x: pv(PAD), y: pv(H - CTA_H_L + 24), w: pv(W - PAD * 2), lines: 1, barH: 7, gap: 0, fill: DARK_BASE, align: 'center' }));

  return svgWrapO(parts, DARK_BASE, 'landscape');
}

// ── export ────────────────────────────────────────────────────────────────────

export default {
  id: 'constellation-before-after',
  name: 'Constellation Before & After',
  style: 'scenario',
  description: 'A before/after "From → To" opposition layout on a dark atmospheric canvas: each block pairs a FROM situation panel with a TO response panel connected by an accent arrow. Portrait stacks FROM→TO card pairs per block; landscape shows FROM and TO columns side by side. Reinterprets the Constellation Move source poster at portrait 1414×2000 / landscape 2000×1414.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 12 },
    blocks: { kind: 'scenario', min: 2, max: 4, fields: ['situation', 'response'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
