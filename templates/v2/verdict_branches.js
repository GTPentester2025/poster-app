// v2 template — verdict-branches (style: tree). A glowing DECISION FORK on
// black: a palette.primary diamond "decision" node sits at the top with a soft
// glow and faint signal arcs behind it, then GLOWING branch lines (rotated Rect
// connectors) fan out to each branch. Each branch is a DARK_PANEL card reading
// as a flow — a CONDITION zone ("IF…" accent chip + condition text) leads via a
// small arrow into an OUTCOME zone (primary chip + outcome text). Portrait: the
// fork fans downward, branch cards stacked. Landscape is a REAL relayout — the
// decision node sits LEFT and the branch cards fan to the RIGHT in a column.
// 3–4 branches blocks {condition, outcome}, no image slot, meshGlow atmosphere.

import {
  textbox, rect, polygon, chip,
  fitFontSize, fitTextBlock, estTextHeight,
  pv, pvRect, pvPoly, pvBars, backgroundImageSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, signalArcs, softGlow, svgWrapO,
  legibilityScrim,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM, PV_LAND_W
} from './decor.js';

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_PANEL, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 180, height: 96, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text, x: 90, y: y + Math.round((144 - estTextHeight(text, size, W - 180)) / 2),
    w: W - 180, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

/**
 * The decision node: a palette.primary diamond (Polygon) with a soft glow and
 * faint signal arcs behind it. (cx, cy) is the diamond center; `r` its radius.
 */
function decisionNode(o, palette, { cx, cy, r }) {
  o.push(...signalArcs({ x: cx, y: cy, r: Math.round(r * 2.4), rings: 4, color: palette.accent, strokeWidth: 10, intensity: 0.8 }));
  o.push(...softGlow({ x: cx, y: cy, r: Math.round(r * 2.1), color: palette.primary, intensity: 1 }));
  o.push(polygon([
    { x: cx, y: cy - r }, { x: cx + r, y: cy }, { x: cx, y: cy + r }, { x: cx - r, y: cy }
  ], { fill: palette.primary, layerRole: 'decor' }));
  o.push(polygon([
    { x: cx, y: cy - r * 0.5 }, { x: cx + r * 0.5, y: cy },
    { x: cx, y: cy + r * 0.5 }, { x: cx - r * 0.5, y: cy }
  ], { fill: DARK_BASE, opacity: 0.14, layerRole: 'decor' }));
}

/** Branch connectors removed (product decision 2026-08-06) — the decision
 * node + cards carry the layout without linking lines. Kept as a no-op so
 * both build paths stay unchanged. */
function branchLine() { /* intentionally draws nothing */ }

// Zone geometry constants for a branch card (cursor layout). `tight` shrinks
// the chrome (chips, pads, arrow) when the card budget is small so the two
// bodies still get room without the card overflowing its span.
const BC_PAD_X = 44;

function bcChrome(budgetH) {
  const xtight = budgetH < 220;      // 4 fat cards in a short landscape span
  const tight = budgetH < 300;
  return {
    condPad: xtight ? 10 : tight ? 14 : 20,   // top/bottom pad
    chipGap: xtight ? 8 : tight ? 10 : 12,     // gap between chip row and its body
    arrowH: xtight ? 14 : tight ? 20 : 36,     // arrow zone between condition and outcome
    zoneGap: xtight ? 8 : tight ? 10 : 16,      // gap around the arrow
    chipFs: budgetH >= 300 ? 22 : xtight ? 14 : 16
  };
}

/**
 * Measure the content height a branch card needs, and the fitted font sizes for
 * its condition/outcome bodies, at a shared body font floor `bodyMin`. Returns
 * { need, condSize, outSize, chrome }. The build lays cards out by these ACTUAL
 * heights (cursor advance) instead of assuming a fixed card height, so long
 * bodies never collide with the chips, the arrow, or the next card.
 */
function measureBranchCard(b, fonts, { w, budgetH, bodyMin }) {
  const innerW = w - BC_PAD_X * 2;
  const ch = bcChrome(budgetH);
  const chipH = Math.round(ch.chipFs * 1.2) + Math.round(ch.chipFs * 0.46) * 2; // chip() height
  // per-body available height (half the budget minus chrome)
  const bodyBudget = Math.max(
    bodyMin,
    Math.round((budgetH - ch.condPad * 2 - chipH * 2 - ch.chipGap * 2 - ch.arrowH - ch.zoneGap * 2) / 2)
  );
  const cond = fitTextBlock(String(b.condition), { width: innerW, height: bodyBudget, maxSize: 46, minSize: bodyMin });
  const out = fitTextBlock(String(b.outcome), { width: innerW, height: bodyBudget, maxSize: 46, minSize: bodyMin });
  const need = ch.condPad
    + chipH + ch.chipGap + Math.round(cond.height)
    + ch.zoneGap + ch.arrowH + ch.zoneGap
    + chipH + ch.chipGap + Math.round(out.height)
    + ch.condPad;
  return { need, condSize: cond.fontSize, outSize: out.fontSize, chrome: { ...ch, chipH } };
}

/**
 * One branch card: a DARK_PANEL card holding a CONDITION zone (accent "IF" chip
 * + condition body) that flows via a small arrow into an OUTCOME zone (primary
 * chip + outcome body). condition/outcome bodies are the bound fields. The card
 * lays its content with a vertical cursor from the pre-measured font sizes so
 * the actual wrapped bodies never overlap the chrome or spill past height `h`.
 */
function branchCard(o, b, palette, fonts, { x, y, w, h, m }) {
  o.push(rect({ x, y, w, h, fill: DARK_PANEL, rx: 26, layerRole: 'background', msgId: b.id }));
  // accent rail down the left edge (the "flow" spine)
  o.push(rect({ x, y, w: 12, h, fill: palette.accent, rx: 6, layerRole: 'decor' }));

  const innerX = x + BC_PAD_X;
  const innerW = w - BC_PAD_X * 2;
  const { condSize, outSize, chrome } = m;
  const { condPad, chipGap, arrowH, zoneGap, chipFs, chipH } = chrome;

  // CONDITION zone: accent "IF" chip + condition text
  let cursor = y + condPad;
  o.push(...chip({ text: 'if', x: innerX, y: cursor, fontSize: chipFs, bg: palette.accent, color: DARK_BASE, font: fonts.head, msgId: b.id, square: true }));
  cursor += chipH + chipGap;
  const condH = estTextHeight(String(b.condition), condSize, innerW);
  o.push({
    ...textbox({
      text: b.condition, x: innerX, y: cursor, w: innerW, fontSize: condSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
      layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'condition'
  });
  cursor += Math.round(condH) + zoneGap;

  // small arrow between the zones (condition → outcome)
  const ar = Math.min(16, Math.round(arrowH / 2));
  const arrowMid = cursor + Math.round(arrowH / 2);
  o.push(polygon([
    { x: innerX, y: arrowMid - ar }, { x: innerX + ar * 1.6, y: arrowMid }, { x: innerX, y: arrowMid + ar }
  ], { fill: palette.primary, layerRole: 'decor', opacity: 0.18 }));
  cursor += arrowH + zoneGap;

  // OUTCOME zone: primary chip + outcome text
  o.push(...chip({ text: 'then', x: innerX, y: cursor, fontSize: chipFs, bg: palette.primary, color: DARK_BASE, font: fonts.head, msgId: b.id, square: true }));
  cursor += chipH + chipGap;
  o.push({
    ...textbox({
      text: b.outcome, x: innerX, y: cursor, w: innerW, fontSize: outSize,
      fontFamily: fonts.body, fontWeight: '700', fill: DARK_INK,
      layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'outcome'
  });
}

/**
 * Lay branch cards down a vertical span [top, bottom]. Cards size to their
 * measured content; if the content stack can't fit, the per-body font floor is
 * lowered until it does (never drops a card). Returns an array of
 * { y, h, m } placements aligned with `blocks`.
 */
function layoutBranchCards(blocks, fonts, { w, top, bottom, gap }) {
  const n = Math.max(blocks.length, 1);
  const avail = bottom - top;
  for (let bodyMin = 38; bodyMin >= 12; bodyMin -= 2) {
    const budgetH = Math.round((avail - gap * (n - 1)) / n);
    const ms = blocks.map((b) => measureBranchCard(b, fonts, { w, budgetH, bodyMin }));
    const heights = ms.map((m) => Math.max(budgetH, m.need));
    const totalH = heights.reduce((a, c) => a + c, 0) + gap * (n - 1);
    if (totalH <= avail || bodyMin <= 12) {
      const out = [];
      let y = top;
      blocks.forEach((b, i) => {
        out.push({ y, h: heights[i], m: ms[i] });
        y += heights[i] + gap;
      });
      return out;
    }
  }
  return [];
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize, headMaxH = 300, subMaxH = 120 }) {
  const headSize = fitFontSize(content.headline, { width: w, height: headMaxH, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    align: 'center', layerRole: 'headline', bgRef: DARK_BASE
  }));
  let bottom = y + Math.round(estTextHeight(content.headline, headSize, w));
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: subMaxH, maxSize: 38, minSize: 16, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: bottom + 20, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
      align: 'center', layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    bottom += 20 + Math.round(estTextHeight(content.subheadline, subSize, w, 1.35));
  }
  return bottom;
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of glowing branching circuit energy and decision-tree light paths, deep near-black, cyan and gold glow, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({
    spots: [
      { x: 707, y: 620, r: 520, color: palette.primary },
      { x: 220, y: 1500, r: 460, color: palette.accent },
      { x: 1200, y: 1720, r: 420, color: palette.primary }
    ], intensity: 0.8
  }));

  const headBottom = headlineZone(o, content, palette, fonts, { x: 120, y: 96, w: W - 240, maxSize: 100 });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);

  const nodeCY = headBottom + 120;
  decisionNode(o, palette, { cx: 707, cy: nodeCY, r: 78 });

  const cardsTop = nodeCY + 150;
  const cardsBottom = 1830;
  const gap = 30;
  const cardW = W - 240;
  const cardX = 120;

  const placements = layoutBranchCards(blocks, fonts, { w: cardW, top: cardsTop, bottom: cardsBottom, gap });
  blocks.forEach((b, i) => {
    const { y, h, m } = placements[i];
    // glowing connector from the node down to each card's left rail
    branchLine(o, palette, 707, nodeCY + 70, cardX + 40, y + Math.round(h / 2));
    branchCard(o, b, palette, fonts, { x: cardX, y, w: cardW, h, m });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1856);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of glowing branching circuit energy and decision-tree light paths, deep near-black, cyan and gold glow, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({
    spots: [
      { x: 360, y: 620, r: 520, color: palette.primary },
      { x: 1500, y: 380, r: 460, color: palette.accent },
      { x: 1400, y: 1150, r: 440, color: palette.primary }
    ], intensity: 0.8
  }));

  // headline across the top — sub must clear cardsTop(440) minus 8px gap
  headlineZone(o, content, palette, fonts, { x: 120, y: 80, w: W - 240, maxSize: 92, headMaxH: 200, subMaxH: 100 });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);

  // decision node LEFT, branch cards fanning RIGHT in a column
  const nodeCX = 470;
  const nodeCY = 800;
  decisionNode(o, palette, { cx: nodeCX, cy: nodeCY, r: 82 });

  const cardsTop = 440;
  const cardsBottom = 1250;
  const gap = 28;
  const cardX = 860;
  const cardW = W - cardX - 120;

  const placements = layoutBranchCards(blocks, fonts, { w: cardW, top: cardsTop, bottom: cardsBottom, gap });
  blocks.forEach((b, i) => {
    const { y, h, m } = placements[i];
    branchLine(o, palette, nodeCX + 74, nodeCY, cardX, y + Math.round(h / 2));
    branchCard(o, b, palette, fonts, { x: cardX, y, w: cardW, h, m });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

function pvDiamond(cx, cy, r, fill) {
  return pvPoly([
    { x: cx, y: cy - r }, { x: cx + r, y: cy }, { x: cx, y: cy + r }, { x: cx - r, y: cy }
  ], fill);
}

function previewPortrait(palette) {
  const n = 3;
  const parts = [
    pvBars({ x: pv(120), y: pv(110), w: pv(1174), lines: 2, barH: 8, gap: 6, fill: DARK_INK, align: 'center' }),
    pvDiamond(pv(707), pv(470), pv(78), palette.primary)
  ];
  const cardsTop = 620;
  const cardsBottom = 1830;
  const gap = 30;
  const cardH = (cardsBottom - cardsTop - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const y = cardsTop + i * (cardH + gap);
    parts.push(pvRect(pv(120), pv(y), pv(1174), pv(cardH), DARK_PANEL, { rx: 4 }));
    parts.push(pvRect(pv(120), pv(y), pv(12), pv(cardH), palette.accent, { rx: 2 }));
    parts.push(pvRect(pv(164), pv(y + 34), pv(90), pv(40), palette.accent, { rx: 3 }));
    parts.push(pvBars({ x: pv(164), y: pv(y + 96), w: pv(1000), lines: 1, barH: 7, gap: 4, fill: DARK_INK }));
    parts.push(pvRect(pv(164), pv(y + cardH / 2 + 22), pv(110), pv(40), palette.primary, { rx: 3 }));
    parts.push(pvBars({ x: pv(164), y: pv(y + cardH / 2 + 84), w: pv(1000), lines: 1, barH: 7, gap: 4, fill: DARK_INK }));
  }
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const n = 3;
  const parts = [
    pvBars({ x: pv(120), y: pv(90), w: pv(1760), lines: 1, barH: 9, gap: 6, fill: DARK_INK, align: 'center' }),
    pvDiamond(pv(470), pv(800), pv(82), palette.primary)
  ];
  const cardsTop = 440;
  const cardsBottom = 1250;
  const gap = 28;
  const cardH = (cardsBottom - cardsTop - gap * (n - 1)) / n;
  const cardX = 860;
  const cardW = 2000 - cardX - 120;
  for (let i = 0; i < n; i++) {
    const y = cardsTop + i * (cardH + gap);
    parts.push(pvRect(pv(cardX), pv(y), pv(cardW), pv(cardH), DARK_PANEL, { rx: 4 }));
    parts.push(pvRect(pv(cardX), pv(y), pv(12), pv(cardH), palette.accent, { rx: 2 }));
    parts.push(pvRect(pv(cardX + 44), pv(y + 30), pv(90), pv(38), palette.accent, { rx: 3 }));
    parts.push(pvBars({ x: pv(cardX + 44), y: pv(y + 84), w: pv(cardW - 120), lines: 1, barH: 6, gap: 4, fill: DARK_INK }));
    parts.push(pvRect(pv(cardX + 44), pv(y + cardH / 2 + 16), pv(110), pv(38), palette.primary, { rx: 3 }));
    parts.push(pvBars({ x: pv(cardX + 44), y: pv(y + cardH / 2 + 70), w: pv(cardW - 120), lines: 1, barH: 6, gap: 4, fill: DARK_INK }));
  }
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'verdict-branches',
  name: 'Verdict branches',
  style: 'tree',
  description: 'A glowing decision fork on black: a primary diamond decision node presides over DARK_PANEL cards, each reading as a flow from an "IF" condition zone through an arrow to a "THEN" outcome zone. The fork fans downward with cards stacked in portrait; the decision node sits left with cards fanning right in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'branches', min: 3, max: 4, fields: ['condition', 'outcome'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 0,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
