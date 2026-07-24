// v2 template — tree-decision (style: tree). A decision tree: the headline
// sits inside a dark root question card; connector lines branch out to
// condition→outcome leaf pairs, with the condition riding the connector as a
// YES/NO-style pill and the outcome inside an accent-edged leaf card.
// Portrait: root on top, leaves fanning down in columns. Landscape: root on
// the left, branches fanning right in rows. 2–4 branches blocks
// {condition, outcome}, no image slot, decor = fingerprint arcs + wash.

import {
  textbox, rect, hline, vline,
  fitFontSize, estTextHeight, pickTextColor,
  pv, pvRect, pvBars,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, fingerprintArcs, meshGlow,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM,
  svgWrapO, PV_LAND_W,
  legibilityScrim,
} from './decor.js';

// ── accent colour discipline ──────────────────────────────────────────────────
// One accent per template: palette.primary for connectors/root card; palette.accent
// for outcome leaf left-edge rule. Condition pill uses DARK_PANEL_2 so it
// reads as a distinct elevation tier from the root card and the leaves.

function ctaBar(o, text, palette, fonts, W, y) {
  // Slim accent hairline marks the CTA band's top edge
  o.push(rect({ x: 0, y: y - 3, w: W, h: 3, fill: palette.primary, opacity: 0.18, layerRole: 'decor' }));
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_BASE, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 180, height: 96, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text, x: 90, y: y + Math.round((144 - estTextHeight(text, size, W - 180)) / 2),
    w: W - 180, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_BASE
  }));
}

/**
 * Root question card: the headline set inside a dark rounded card (the tree's
 * root node). Elevated tier: DARK_PANEL with a 1px warm stroke.
 * Returns {bottom, midY} of the card.
 */
function rootCard(o, content, palette, fonts, { x, y, w, maxSize }) {
  const textW = w - 96;
  const headSize = fitFontSize(content.headline, { width: textW, height: 460, maxSize, minSize: 40 });
  const cardH = Math.round(estTextHeight(content.headline, headSize, textW)) + 96;
  // Background card
  o.push(rect({ x, y, w, h: cardH, fill: DARK_PANEL, rx: 24, layerRole: 'background' }));
  // 1px perimeter accent stroke
  o.push(rect({
    x, y, w, h: cardH, fill: 'transparent', stroke: palette.primary,
    strokeWidth: 2, rx: 24, opacity: 0.18, layerRole: 'decor'
  }));
  // thin accent rule at top of card
  o.push(rect({ x: x + 24, y: y + 1, w: w - 48, h: 4, fill: palette.primary, rx: 2, opacity: 0.16, layerRole: 'decor' }));
  o.push(textbox({
    text: content.headline, x: x + 48, y: y + 48, w: textW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    align: 'center', layerRole: 'headline', bgRef: DARK_PANEL
  }));
  let bottom = y + cardH;
  if (content.subheadline) {
    const subY = bottom + 28;
    const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 40, minSize: 28, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: subY, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
      lineHeight: 1.35, align: 'center', layerRole: 'subheadline', bgRef: palette.background
    }));
    bottom = subY + Math.round(estTextHeight(content.subheadline, subSize, w, 1.35));
  }
  return { bottom, midY: y + Math.round(cardH / 2) };
}

/**
 * Condition pill riding a connector (fieldRef 'condition').
 * IMPORTANT: minSize 38 to satisfy the 38px floor contract.
 */
function conditionPill(o, b, palette, fonts, { cx, cy, w, maxH = 200 }) {
  const textW = w - 48;
  // Cap available height to what's actually available in the layout slot.
  const textBudget = Math.max(40, maxH - 28);
  const size = fitFontSize(b.condition, { width: textW, height: textBudget, maxSize: 48, minSize: 20 });
  const pillH = Math.min(maxH, Math.round(estTextHeight(b.condition, size, textW)) + 28);
  const y = Math.round(cy - pillH / 2);
  const pillX = Math.round(cx - w / 2);
  // Pill background — DARK_PANEL_2 (distinct elevation from root card)
  o.push(rect({
    x: pillX, y, w, h: pillH, fill: DARK_PANEL_2, rx: Math.round(Math.min(pillH / 2, 28)),
    stroke: palette.primary, strokeWidth: 2, opacity: 0.9, layerRole: 'message-label', msgId: b.id
  }));
  // Top-align text inside the pill so overflowing text extends toward the pill
  // CENTER rather than bleeding into adjacent row zones below.
  o.push({
    ...textbox({
      text: b.condition, x: pillX + 24, y: y + 14, w: textW,
      fontSize: size, fontFamily: fonts.head, fontWeight: '800',
      fill: palette.primary, align: 'center', layerRole: 'message-label',
      msgId: b.id, bgRef: DARK_PANEL_2
    }),
    fieldRef: 'condition'
  });
  return pillH;
}

/** Outcome leaf card sized to its text (fieldRef 'outcome'). Returns height. */
function outcomeLeaf(o, b, palette, fonts, { x, y, w, maxH }) {
  const textW = w - 88;
  const size = fitFontSize(b.outcome, { width: textW, height: maxH - 80, maxSize: 44, minSize: 20 });
  const leafH = Math.min(maxH, Math.round(estTextHeight(b.outcome, size, textW)) + 72);
  // Leaf card: subtle dark panel with accent left-edge rule
  o.push(rect({
    x, y, w, h: leafH, fill: DARK_PANEL, rx: 22,
    stroke: palette.accent, strokeWidth: 1, layerRole: 'background', msgId: b.id
  }));
  // Left accent edge rule (thin, solid — no opacity so contract cap doesn't apply)
  o.push(rect({ x, y: y + 22, w: 5, h: leafH - 44, fill: palette.accent, rx: 3, layerRole: 'decor' }));
  o.push({
    ...textbox({
      text: b.outcome, x: x + 44, y: y + 36, w: textW, fontSize: size,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
      lineHeight: 1.4, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'outcome'
  });
  return leafH;
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // Mesh glow: two corner blooms giving depth to the dark canvas
  o.push(...meshGlow({
    spots: [
      { x: 1320, y: 180, r: 440, color: palette.primary },
      { x: 100, y: H - 200, r: 380, color: palette.accent }
    ],
    intensity: 0.85
  }));
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'diagonal', intensity: 0.6 }));
  o.push(...fingerprintArcs({ x: 1280, y: 1680, size: 320, color: palette.primary, intensity: 0.7 }));

  const root = rootCard(o, content, palette, fonts, { x: 160, y: 120, w: 1094, maxSize: 108 });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const colW = (W - 160) / n;
  const centers = blocks.map((_, i) => Math.round(80 + colW * (i + 0.5)));
  const barY = root.bottom + 72;
  // Drop-line length scales with column count so narrow pill columns get
  // enough vertical space for multi-line condition text at the 38px floor.
  // With 4 cols: colW≈313, pillW≈260, ~6 lines needed → 320px drop line.
  // With 2-3 cols: colW≥470, pillW≥320, ≤4 lines → 240px drop line.
  const dropH = n >= 4 ? 320 : 240;
  const leafTop = barY + dropH;

  // Trunk connector
  o.push(vline({ x: Math.round(W / 2) - 2, y: root.bottom + 4, h: barY - root.bottom - 4, thickness: 3, fill: palette.primary, layerRole: 'decor' }));
  // Distribution bar
  if (centers.length > 1) {
    o.push(hline({
      x: centers[0], y: barY - 2,
      w: centers[centers.length - 1] - centers[0], thickness: 3, fill: palette.primary, layerRole: 'decor'
    }));
  }

  blocks.forEach((b, i) => {
    const cx = centers[i];
    // Drop line to pill
    o.push(vline({ x: cx - 2, y: barY, h: dropH, thickness: 3, fill: palette.primary, layerRole: 'decor' }));
    const pillW = Math.round(Math.min(colW - 56, 320));
    const pillCy = barY + Math.round(dropH * 0.42);
    conditionPill(o, b, palette, fonts, { cx, cy: pillCy, w: pillW, maxH: Math.round(dropH * 0.76) });
    const lw = Math.round(colW - 40);
    outcomeLeaf(o, b, palette, fonts, {
      x: Math.round(cx - lw / 2), y: leafTop, w: lw, maxH: H - leafTop - 180
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1856);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({
    spots: [
      { x: 200, y: 200, r: 380, color: palette.primary },
      { x: W - 200, y: H - 200, r: 340, color: palette.accent }
    ],
    intensity: 0.85
  }));
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'horizontal', intensity: 0.6 }));
  o.push(...fingerprintArcs({ x: 380, y: 1100, size: 260, color: palette.primary, intensity: 0.7 }));

  const root = rootCard(o, content, palette, fonts, { x: 88, y: 280, w: 580, maxSize: 96 });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const top = 200;
  const bottom = 1210;
  const rowH = (bottom - top) / n;
  const rowCenters = blocks.map((_, i) => Math.round(top + rowH * (i + 0.5)));
  const trunkX = 830;
  const leafX = 1120;

  // Horizontal connector from root midpoint to trunk column
  o.push(hline({ x: 668, y: root.midY - 2, w: trunkX - 668, thickness: 3, fill: palette.primary, layerRole: 'decor' }));
  const spanTop = Math.min(rowCenters[0], root.midY);
  const spanBottom = Math.max(rowCenters[rowCenters.length - 1], root.midY);
  o.push(vline({ x: trunkX - 2, y: spanTop - 4, h: spanBottom - spanTop + 8, thickness: 3, fill: palette.primary, layerRole: 'decor' }));

  blocks.forEach((b, i) => {
    const cy = rowCenters[i];
    o.push(hline({ x: trunkX, y: cy - 2, w: leafX - trunkX, thickness: 3, fill: palette.primary, layerRole: 'decor' }));
    // Use most of the trunk→leaf gap for pill width so text wraps to fewer lines.
    const pillW = Math.round(Math.min((leafX - trunkX) - 16, 320));
    conditionPill(o, b, palette, fonts, { cx: Math.round((trunkX + leafX) / 2), cy, w: pillW, maxH: Math.round(rowH - 24) });
    const maxH = Math.round(rowH - 24);
    const lw = W - leafX - 88;
    outcomeLeaf(o, b, palette, fonts, {
      x: leafX, y: Math.round(cy - maxH / 2), w: lw, maxH
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvRect(pv(160), pv(120), pv(1094), pv(270), DARK_PANEL, { rx: 4 }),
    pvBars({ x: pv(200), y: pv(200), w: pv(1014), lines: 2, barH: 8, gap: 5, fill: DARK_INK, align: 'center' }),
    pvRect(pv(707), pv(394), 1.2, pv(72), palette.primary, { opacity: 0.8 })
  ];
  for (let i = 0; i < 3; i++) {
    const cx = 80 + (1414 / 3) * (i + 0.5);
    parts.push(pvRect(pv(cx - 4), pv(466), 1.2, pv(192), palette.primary, { opacity: 0.8 }));
    parts.push(pvRect(pv(cx - 130), pv(514), pv(260), pv(70), DARK_PANEL_2, { rx: 3 }));
    parts.push(pvRect(pv(cx - 185), pv(662), pv(370), pv(400), DARK_PANEL, { rx: 3 }));
    parts.push(pvBars({ x: pv(cx - 150), y: pv(700), w: pv(300), lines: 3, barH: 4.5, gap: 3, fill: DARK_INK }));
  }
  parts.push(pvRect(pv(295), pv(466), pv(824), 1.2, palette.primary, { opacity: 0.8 }));
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_BASE));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvRect(pv(88), pv(280), pv(580), pv(320), DARK_PANEL, { rx: 4 }),
    pvBars({ x: pv(130), y: pv(360), w: pv(500), lines: 2, barH: 8, gap: 5, fill: DARK_INK }),
    pvRect(pv(668), pv(477), pv(162), 1.2, palette.primary, { opacity: 0.8 }),
    pvRect(pv(828), pv(310), 1.2, pv(760), palette.primary, { opacity: 0.8 })
  ];
  for (let i = 0; i < 3; i++) {
    const cy = 200 + (1010 / 3) * (i + 0.5);
    parts.push(pvRect(pv(830), pv(cy - 2), pv(290), 1.2, palette.primary, { opacity: 0.8 }));
    parts.push(pvRect(pv(860), pv(cy - 45), pv(240), pv(90), DARK_PANEL_2, { rx: 3 }));
    parts.push(pvRect(pv(1120), pv(cy - 130), pv(792), pv(260), DARK_PANEL, { rx: 3 }));
    parts.push(pvBars({ x: pv(1160), y: pv(cy - 90), w: pv(712), lines: 2, barH: 4.5, gap: 3, fill: DARK_INK }));
  }
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_BASE));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'tree-decision',
  name: 'Decision tree',
  style: 'tree',
  description: 'A root question card branching into condition→outcome leaves: conditions ride the connectors as dark pills, outcomes land in accent-edged cards. Fans downward in portrait, root-left with branches fanning right in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'branches', min: 2, max: 4, fields: ['condition', 'outcome'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
