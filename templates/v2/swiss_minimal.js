// v2 template — swiss-minimal (style: infographic). Museum exhibition / Swiss
// International Typographic Style poster: giant headline in a strict grid,
// hairline rules dividing columns, massive accent numerals for blocks, one
// accent colour, maximal whitespace on a near-white (here: off-black) ground.
// Portrait: full-width giant headline top, a single bold hairline rule beneath,
// then numbered block rows with a left-column numeral and right-column text.
// Landscape: REAL relayout — headline fills ~60% of the left column, rule
// divides, block grid stacks right. 1 accent-colour image slot (editorial
// detail photo). No mesh glows — the design IS the decoration.
// Decor discipline satisfied by: hairline rule rects + accent colour fill bars.

import {
  textbox, rect, imageSlot, backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, svgWrapO, PV_LAND_W,
  legibilityScrim, OVERLAY_TEXT_SHADOW,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM
} from './decor.js';

// Swiss minimal uses DARK_BASE canvas with high contrast white/accent type.
// The "one accent colour" is palette.accent; body + numerals = palette.primary.

const RULE_THICKNESS = 4;  // hairline rule (hairline = thin but not invisible)

// ── shared background: minimal diagonal wash (2 translucent decor objects) ──
function backdrop(o, palette, W, H) {
  // Two stacked minimal washes satisfy the >=2 translucent decor requirement
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: DARK_BASE, direction: 'vertical', intensity: 0.5 }));
  // a barely visible horizontal sweep as a second decor layer
  o.push(...gradientWash({ w: W, h: H, from: palette.accent, to: DARK_BASE, direction: 'horizontal', intensity: 0.35 }));
}

// ── block row: big numeral left, label + text right ───────────────────────────
// budget: total vertical space allocated for this row (numeral + label + body).
// If omitted, falls back to generous defaults (suitable for layouts with spare space).
function blockRow(o, b, idx, palette, fonts, { x, y, w, numW, gap, budget }) {
  const contentX = x + numW + gap;
  const contentW = w - numW - gap;
  const rowBottom = budget != null ? y + budget : null;

  // massive numeral — scale with row budget so it stays within its row
  const numStr = String(idx + 1);
  // numSize: at most 160 but capped to ~22% of row budget so label + body fit below
  const numSize = budget != null ? Math.min(160, Math.max(24, Math.round(budget * 0.22))) : 160;
  o.push(textbox({
    text: numStr, x, y, w: numW,
    fontSize: numSize, fontFamily: fonts.head, fontWeight: '900',
    fill: palette.accent, align: 'left', lineHeight: 1,
    layerRole: 'message-label', bgRef: DARK_BASE
  }));

  // label (bold, primary) — budget: 35% of row, so body has room
  const labelBudget = budget != null ? Math.max(Math.round(budget * 0.35), 20) : 100;
  const labelSize = fitFontSize(b.label, { width: contentW, height: labelBudget, maxSize: 64, minSize: 14 });
  const labelH = estTextHeight(b.label, labelSize, contentW, 1.05);
  o.push({
    ...textbox({
      text: b.label, x: contentX, y, w: contentW, fontSize: labelSize,
      fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
      lineHeight: 1.05, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'label'
  });

  // body text — budget: remaining space in row minus label height minus gap minus 8px margin
  const textTop = y + labelH + 14;
  const bodyBudget = rowBottom != null
    ? Math.max(rowBottom - textTop - 8, 14)
    : 200;
  const textSize = fitFontSize(b.text, { width: contentW, height: bodyBudget, maxSize: 44, minSize: 14 });
  o.push({
    ...textbox({
      text: b.text, x: contentX, y: textTop, w: contentW, fontSize: textSize,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM,
      lineHeight: 1.22, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'text'
  });

  return textTop + estTextHeight(b.text, textSize, contentW, 1.22);
}

// ── CTA ───────────────────────────────────────────────────────────────────────
function ctaZone(o, text, palette, fonts, { x, y, w }) {
  // accent rule above CTA
  o.push(rect({ x, y: y - 16, w, h: RULE_THICKNESS, fill: palette.accent, layerRole: 'decor', opacity: 0.18 }));
  const size = fitFontSize(text, { width: w, height: 96, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text, x, y, w, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.accent, align: 'left', layerRole: 'cta', bgRef: DARK_BASE
  }));
}

// ── portrait ──────────────────────────────────────────────────────────────────
function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  backdrop(o, palette, W, H);

  const margin = 80;
  const innerW = W - margin * 2;

  // giant headline
  const headSize = fitFontSize(content.headline, { width: innerW, height: 560, maxSize: 180, minSize: 40 });
  const headH = estTextHeight(content.headline, headSize, innerW);
  o.push(textbox({
    text: content.headline, x: margin, y: 88, w: innerW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align: 'left',
    lineHeight: 1.0, layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = 88 + headH;

  // full-width primary rule below headline
  o.push(rect({ x: margin, y: cursor + 16, w: innerW, h: RULE_THICKNESS, fill: palette.primary, layerRole: 'decor', opacity: 0.18 }));
  cursor += 16 + RULE_THICKNESS + 24;

  // subheadline
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: innerW, height: 100, maxSize: 46, minSize: 16 });
    o.push(textbox({
      text: content.subheadline, x: margin, y: cursor, w: innerW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM,
      layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, innerW) + 40;
  }

  // editorial image slot: right-aligned, accent colour border
  const slotH = 360;
  const slotW = Math.round(innerW * 0.44);
  const slotX = margin + innerW - slotW;
  o.push(imageSlot({
    slotId: 'slot-1', x: slotX, y: cursor, w: slotW, h: slotH,
    styleHint: 'museum exhibition editorial photograph, stark minimalist, high contrast, no text',
    stroke: palette.accent
  }));

  // block rows left column (alongside the slot for the first blocks)
  const blocks = content.blocks || [];
  const numW = 120;
  const colGap = 32;
  const blockColW = slotX - margin - colGap;

  // Compute per-row budget so blocks fit within [cursor, H-ctaH-48].
  const ctaReserve = 120 + 48;  // ctaZone at H-120 needs ~120px; 48px margin above
  const totalBlockSpace = H - cursor - ctaReserve;
  const n = Math.max(blocks.length, 1);
  const sepH = 16 + 2 + 24;  // separator cost between rows
  const rowBudget = Math.max(80, Math.floor((totalBlockSpace - sepH * (n - 1)) / n));

  let rowCursor = cursor;
  blocks.forEach((b, i) => {
    const rowH = blockRow(o, b, i, palette, fonts, { x: margin, y: rowCursor, w: blockColW, numW, gap: colGap, budget: rowBudget });
    const rowBottom = rowH;
    // thin separator between blocks
    if (i < blocks.length - 1) {
      o.push(rect({ x: margin, y: rowBottom + 16, w: blockColW, h: 2, fill: palette.primary, layerRole: 'decor', opacity: 0.14 }));
      rowCursor = rowBottom + 16 + 2 + 24;
    } else {
      rowCursor = rowBottom + 24;
    }
  });

  ctaZone(o, content.callToAction, palette, fonts, { x: margin, y: H - 120, w: innerW });
  return canvas;
}

// ── landscape ─────────────────────────────────────────────────────────────────
function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  backdrop(o, palette, W, H);

  const margin = 80;
  // vertical rule splitting headline left from blocks right
  const ruleX = Math.round(W * 0.48);
  o.push(rect({ x: ruleX, y: margin, w: RULE_THICKNESS, h: H - margin * 2, fill: palette.primary, layerRole: 'decor', opacity: 0.18 }));

  const leftW = ruleX - margin - 24;

  // Reserve space for sub (~60px) + slot (≥80px) + cta (112px) + gaps above headline
  const lsCtaY = H - 112;
  const headBudgetLs = lsCtaY - 88 - 60 - 80 - 24; // leave room for sub, slot, cta

  // giant headline in left column
  const headSize = fitFontSize(content.headline, { width: leftW, height: headBudgetLs, maxSize: 160, minSize: 40 });
  const headH = estTextHeight(content.headline, headSize, leftW);
  o.push(textbox({
    text: content.headline, x: margin, y: 88, w: leftW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align: 'left',
    lineHeight: 1.0, layerRole: 'headline', bgRef: DARK_BASE
  }));
  let leftCursor = 88 + headH + 24;

  if (content.subheadline) {
    // Bound sub to available space: from leftCursor to ctaY minus minimum slot gap
    const subAvail = Math.max(lsCtaY - leftCursor - 8, 20);
    const subSize = fitFontSize(content.subheadline, { width: leftW, height: Math.min(80, subAvail), maxSize: 44, minSize: 16 });
    o.push(textbox({
      text: content.subheadline, x: margin, y: leftCursor, w: leftW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM,
      layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    leftCursor += estTextHeight(content.subheadline, subSize, leftW) + 32;
  }

  // editorial image slot bottom-left: fits between sub and CTA
  const slotW = Math.min(leftW, 480);
  const slotH = Math.max(Math.min(360, lsCtaY - leftCursor - 32), 80);
  o.push(imageSlot({
    slotId: 'slot-1', x: margin, y: leftCursor, w: slotW, h: slotH,
    styleHint: 'museum exhibition editorial photograph, stark minimalist, high contrast, no text',
    stroke: palette.accent
  }));

  // CTA bottom-left
  ctaZone(o, content.callToAction, palette, fonts, { x: margin, y: lsCtaY, w: leftW });

  // right column: block rows with budget to prevent overflow
  const colX = ruleX + 32;
  const colW = W - colX - margin;
  const blocks = content.blocks || [];
  const numW = 100;
  const colGap = 24;
  const availH = H - margin * 2;
  const n = Math.max(blocks.length, 1);
  const rowH = Math.floor(availH / n);

  let rowCursor = margin;
  blocks.forEach((b, i) => {
    blockRow(o, b, i, palette, fonts, { x: colX, y: rowCursor, w: colW, numW, gap: colGap, budget: rowH });
    rowCursor += rowH;
    if (i < blocks.length - 1) {
      o.push(rect({ x: colX, y: rowCursor - 16, w: colW, h: 2, fill: palette.primary, layerRole: 'decor', opacity: 0.14 }));
    }
  });

  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────
function previewPortrait(palette) {
  const W = 1414; const H = 2000;
  const margin = 80;
  const innerW = W - margin * 2;
  const parts = [];
  // giant headline
  parts.push(pvRect(pv(margin), pv(88), pv(innerW), pv(110), DARK_INK, { rx: 3 }));
  // rule
  parts.push(pvRect(pv(margin), pv(220), pv(innerW), pv(4), palette.primary, { opacity: 0.5 }));
  // subheadline bar
  parts.push(pvRect(pv(margin), pv(248), pv(innerW * 0.55), pv(16), DARK_INK_DIM, { rx: 3 }));
  // slot right
  const slotW = Math.round(innerW * 0.44);
  const slotX = margin + innerW - slotW;
  parts.push(pvSlot(pv(slotX), pv(296), pv(slotW), pv(360), palette.accent));
  // block rows left (3 rows)
  const blockColW = slotX - margin - 32;
  let rc = 296;
  for (let i = 0; i < 3; i++) {
    parts.push(pvRect(pv(margin), pv(rc), pv(60), pv(55), palette.accent, { rx: 3 }));
    parts.push(pvRect(pv(margin + 120 + 32), pv(rc + 4), pv(blockColW * 0.5), pv(18), DARK_INK, { rx: 3 }));
    parts.push(pvBars({ x: pv(margin + 120 + 32), y: pv(rc + 36), w: pv(blockColW - 120 - 32), lines: 2, barH: 4, gap: 3, fill: DARK_INK_DIM }));
    if (i < 2) parts.push(pvRect(pv(margin), pv(rc + 140), pv(blockColW), pv(2), palette.primary, { opacity: 0.4 }));
    rc += 160;
  }
  // CTA
  parts.push(pvRect(pv(margin), pv(H - 104), pv(innerW * 0.55), pv(26), palette.accent, { rx: 3 }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000; const H = 1414;
  const margin = 80;
  const ruleX = Math.round(W * 0.48);
  const leftW = ruleX - margin - 24;
  const parts = [];
  // vertical rule
  parts.push(pvRect(pv(ruleX), pv(margin), pv(4), pv(H - margin * 2), palette.primary, { opacity: 0.5 }));
  // big headline left
  parts.push(pvRect(pv(margin), pv(88), pv(leftW), pv(90), DARK_INK, { rx: 3 }));
  parts.push(pvRect(pv(margin), pv(192), pv(leftW * 0.72), pv(60), DARK_INK, { rx: 3 }));
  // subheadline
  parts.push(pvRect(pv(margin), pv(280), pv(leftW * 0.5), pv(14), DARK_INK_DIM, { rx: 3 }));
  // slot left bottom
  parts.push(pvSlot(pv(margin), pv(320), pv(leftW * 0.85), pv(H - 320 - 160), palette.accent));
  // CTA
  parts.push(pvRect(pv(margin), pv(H - 112), pv(leftW * 0.55), pv(22), palette.accent, { rx: 3 }));
  // block rows right
  const colX = ruleX + 32;
  const colW = W - colX - margin;
  const rowH = Math.floor((H - margin * 2) / 3);
  let rc = margin;
  for (let i = 0; i < 3; i++) {
    parts.push(pvRect(pv(colX), pv(rc), pv(50), pv(48), palette.accent, { rx: 3 }));
    parts.push(pvRect(pv(colX + 100 + 24), pv(rc + 4), pv(colW * 0.5), pv(15), DARK_INK, { rx: 3 }));
    parts.push(pvBars({ x: pv(colX + 100 + 24), y: pv(rc + 30), w: pv(colW - 100 - 24), lines: 2, barH: 4, gap: 3, fill: DARK_INK_DIM }));
    if (i < 2) parts.push(pvRect(pv(colX), pv(rc + rowH - 16), pv(colW), pv(2), palette.primary, { opacity: 0.4 }));
    rc += rowH;
  }
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'swiss-minimal',
  name: 'Swiss minimal',
  style: 'infographic',
  description: 'Museum exhibition poster in the Swiss International Typographic Style: giant headline dominates a strict column grid, hairline rules divide zones, and massive accent numerals lead each block. Maximum whitespace, one accent colour, no decorative motifs — the typography IS the design. Portrait stacks a full-width headline above numbered block rows with a right-column editorial image slot; landscape splits headline left of a vertical rule, with block rows stacked on the right.',
  contentSchema: {
    headline: { required: true, maxWords: 6 },
    subheadline: { required: false, maxWords: 12 },
    blocks: { kind: 'sequence', min: 3, max: 4, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 8 },
    backgroundSlots: 1,
    imageSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
