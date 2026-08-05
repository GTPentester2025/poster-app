// v2 template — keyword-dark (style: statement). M1 modern family, batch C:
// the org's dark two-tone poster language — a stacked headline whose SECOND
// line renders in the brand primary (both lines share one fitted size), and
// the points run as rows where a brand-primary bold lead-in label sits above
// white body copy, each fronted by a thin outline icon circle. Minimal decor
// (floating dots + hairline dividers) keeps the type in charge. Portrait
// stacks hero over rows; landscape is a REAL relayout — hero + CTA in a left
// column, rows right. All copy measured (fitTextBlock) inside slot budgets.

import {
  textbox, rect, circle, backgroundImageSlot,
  fitTextBlock, estTextHeight, pickTextColor,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO, PV_LAND_W, PV_LAND_H,
  legibilityScrim
} from './decor.js';

const BG_HINT = 'moody dark office at night, faint city lights bokeh, deep shadow atmosphere, no text';

/** Two-tone stacked headline: line 1 light, line 2 brand primary. */
function keywordHeadline(o, content, palette, fonts, { x, y, w, maxSize, budget }) {
  const onDark = pickTextColor(palette.dark);
  const words = String(content.headline).trim().split(/\s+/).filter(Boolean);
  const cut = Math.ceil(words.length / 2);
  const l1 = words.slice(0, cut).join(' ');
  const l2 = words.slice(cut).join(' ');
  const lineBudget = Math.round((budget - 18) / 2);

  const f1 = fitTextBlock(l1, { width: w, height: lineBudget, maxSize, minSize: 52, lineHeight: 1.04 });
  let size = f1.fontSize;
  if (l2) {
    const f2 = fitTextBlock(l2, { width: w, height: lineBudget, maxSize, minSize: 52, lineHeight: 1.04 });
    size = Math.min(size, f2.fontSize);
  }
  const h1 = estTextHeight(l1, size, w, 1.04);
  o.push(textbox({
    text: l1, x, y, w, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: onDark, lineHeight: 1.04, charSpacing: -20, layerRole: 'headline', bgRef: palette.dark
  }));
  let cursor = y + h1;
  if (l2) {
    const y2 = Math.round(cursor + 18);
    o.push(textbox({
      text: l2, x, y: y2, w, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
      fill: palette.primary, lineHeight: 1.04, charSpacing: -20, layerRole: 'headline', bgRef: palette.dark
    }));
    cursor = y2 + estTextHeight(l2, size, w, 1.04);
  }
  return Math.round(cursor);
}

/** Subheadline in dimmed light ink; returns updated cursor. */
function subLine(o, content, palette, fonts, { x, y, w }) {
  if (!content.subheadline) return y;
  const onDark = pickTextColor(palette.dark);
  const sub = fitTextBlock(content.subheadline, { width: w, height: 96, maxSize: 32, minSize: 16, lineHeight: 1.35 });
  o.push(textbox({
    text: content.subheadline, x, y: Math.round(y + 30), w, fontSize: sub.fontSize,
    fontFamily: fonts.body, fontWeight: '500', fill: onDark,
    lineHeight: 1.35, layerRole: 'subheadline', bgRef: palette.dark
  }));
  return Math.round(y + 30 + sub.height);
}

/** Thin outline icon circle with an inner brand dot. */
function iconRing(o, palette, cx, cy) {
  o.push(circle({ x: cx, y: cy, r: 28, fill: 'transparent', stroke: palette.primary, strokeWidth: 3, layerRole: 'decor' }));
  o.push(circle({ x: cx, y: cy, r: 8, fill: palette.primary, layerRole: 'decor' }));
}

/**
 * One keyword row: brand-primary bold lead-in label above white body text,
 * outline icon ring at the left, hairline divider below.
 */
function keywordRow(o, b, i, n, palette, fonts, { x, y, w, slotH }) {
  const onDark = pickTextColor(palette.dark);
  iconRing(o, palette, x + 34, y + 38);
  const textX = x + 104;
  const textW = w - 104;

  const label = fitTextBlock(String(b.label).toUpperCase(), {
    width: textW, height: 46, maxSize: 32, minSize: 16, lineHeight: 1.2
  });
  o.push({
    ...textbox({
      text: String(b.label).toUpperCase(), x: textX, y: y + 8, w: textW,
      fontSize: label.fontSize, fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
      charSpacing: 50, lineHeight: 1.2, layerRole: 'message-label', msgId: b.id, bgRef: palette.dark
    }),
    fieldRef: 'label'
  });

  const textY = Math.round(y + 8 + label.height + 14);
  const fit = fitTextBlock(b.text, {
    width: textW, height: Math.max(44, y + slotH - textY - 40), maxSize: 34, minSize: 16, lineHeight: 1.4
  });
  o.push({
    ...textbox({
      text: b.text, x: textX, y: textY, w: textW, fontSize: fit.fontSize,
      fontFamily: fonts.body, fontWeight: '500', fill: onDark,
      lineHeight: 1.4, layerRole: 'message', msgId: b.id, bgRef: palette.dark
    }),
    fieldRef: 'text'
  });
  if (i < n - 1) {
    o.push(rect({ x: textX, y: Math.round(y + slotH - 22), w: textW, h: 2, fill: onDark, opacity: 0.14, layerRole: 'decor' }));
  }
}

/** Brand pill CTA on the dark field. */
function ctaPill(o, content, palette, fonts, { x, y, w, h }) {
  const onPrimary = pickTextColor(palette.primary);
  o.push(rect({ x, y, w, h, fill: palette.primary, rx: Math.round(h / 2), layerRole: 'background' }));
  const cta = fitTextBlock(content.callToAction, { width: w - 150, height: h - 34, maxSize: 40, minSize: 20, lineHeight: 1.2 });
  o.push(textbox({
    text: content.callToAction, x: x + 75, y: Math.round(y + (h - cta.height) / 2), w: w - 150,
    fontSize: cta.fontSize, fontFamily: fonts.head, fontWeight: '800',
    fill: onPrimary, align: 'center', lineHeight: 1.2, layerRole: 'cta', bgRef: palette.primary
  }));
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.dark);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  // dark design — default dark scrim protects light ink over any image
  o.push(...legibilityScrim({ w: W, h: H }));

  // minimal decor: hairline top rule + floating dots
  o.push(rect({ x: 96, y: 104, w: 72, h: 4, fill: palette.primary, rx: 2, layerRole: 'decor' }));
  o.push(circle({ x: 1290, y: 150, r: 10, fill: palette.primary, opacity: 0.8, layerRole: 'decor' }));
  o.push(circle({ x: 1200, y: 700, r: 7, fill: palette.accent, opacity: 0.7, layerRole: 'decor' }));

  const M = 96;
  let cursor = keywordHeadline(o, content, palette, fonts, {
    x: M, y: 170, w: W - M * 2, maxSize: 140, budget: 460
  });
  cursor = subLine(o, content, palette, fonts, { x: M, y: cursor, w: 980 });

  const ctaH = 108;
  const ctaY = H - M - ctaH;
  ctaPill(o, content, palette, fonts, { x: M, y: ctaY, w: W - M * 2, h: ctaH });

  const blocks = content.blocks || [];
  const top = Math.max(cursor + 56, 790);
  const bottom = ctaY - 44;
  const n = Math.max(blocks.length, 1);
  const slotH = (bottom - top) / n;
  blocks.forEach((b, i) => {
    keywordRow(o, b, i, n, palette, fonts, {
      x: M, y: Math.round(top + i * slotH), w: W - M * 2, slotH: Math.round(slotH)
    });
  });
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.dark);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  // dark design — default dark scrim protects light ink over any image
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(rect({ x: 96, y: 100, w: 72, h: 4, fill: palette.primary, rx: 2, layerRole: 'decor' }));
  o.push(circle({ x: 930, y: 1240, r: 10, fill: palette.primary, opacity: 0.8, layerRole: 'decor' }));
  o.push(circle({ x: 1950, y: 100, r: 7, fill: palette.accent, opacity: 0.7, layerRole: 'decor' }));

  // hero column left: two-tone headline + sub + pinned CTA
  const M = 96;
  let cursor = keywordHeadline(o, content, palette, fonts, {
    x: M, y: 150, w: 880, maxSize: 120, budget: 520
  });
  cursor = subLine(o, content, palette, fonts, { x: M, y: cursor, w: 780 });

  const cta = fitTextBlock(content.callToAction, { width: 700, height: 74, maxSize: 40, minSize: 20, lineHeight: 1.2 });
  const ctaH = Math.round(cta.height + 44);
  const ctaY = Math.max(H - 110 - ctaH, cursor + 50);
  ctaPill(o, content, palette, fonts, { x: M, y: ctaY, w: 810, h: ctaH });

  // keyword rows right
  const blocks = content.blocks || [];
  const rx = 1080;
  const rw = W - rx - M;
  const top = 140;
  const bottom = H - 110;
  const n = Math.max(blocks.length, 1);
  const slotH = (bottom - top) / n;
  blocks.forEach((b, i) => {
    keywordRow(o, b, i, n, palette, fonts, {
      x: rx, y: Math.round(top + i * slotH), w: rw, slotH: Math.round(slotH)
    });
  });
  return canvas;
}

function pvRow(parts, palette, { x, y, w }) {
  const onDark = pickTextColor(palette.dark);
  parts.push(pvCircle(pv(x + 34), pv(y + 38), pv(28), 'none', { stroke: palette.primary }));
  parts.push(pvBars({ x: pv(x + 104), y: pv(y + 10), w: pv(w * 0.4), lines: 1, barH: 5, gap: 3, fill: palette.primary }));
  parts.push(pvBars({ x: pv(x + 104), y: pv(y + 62), w: pv(w - 104), lines: 2, barH: 4.5, gap: 3.5, fill: onDark }));
}

function previewPortrait(palette) {
  const onDark = pickTextColor(palette.dark);
  const parts = [
    pvRect(pv(96), pv(104), pv(72), pv(4), palette.primary, { rx: 0.6 }),
    pvBars({ x: pv(96), y: pv(190), w: pv(1100), lines: 1, barH: 16, gap: 8, fill: onDark }),
    pvBars({ x: pv(96), y: pv(410), w: pv(900), lines: 1, barH: 16, gap: 8, fill: palette.primary }),
    pvBars({ x: pv(96), y: pv(640), w: pv(760), lines: 1, barH: 6, gap: 4, fill: onDark })
  ];
  for (let i = 0; i < 4; i++) pvRow(parts, palette, { x: 96, y: 800 + i * 250, w: 1222 });
  parts.push(pvRect(pv(96), pv(1796), pv(1222), pv(108), palette.primary, { rx: pv(54) }));
  return svgWrapO(parts, palette.dark, 'portrait');
}

function previewLandscape(palette) {
  const onDark = pickTextColor(palette.dark);
  const parts = [
    pvRect(pv(96), pv(100), pv(72), pv(4), palette.primary, { rx: 0.6 }),
    pvBars({ x: pv(96), y: pv(180), w: pv(820), lines: 1, barH: 15, gap: 8, fill: onDark }),
    pvBars({ x: pv(96), y: pv(400), w: pv(660), lines: 1, barH: 15, gap: 8, fill: palette.primary }),
    pvBars({ x: pv(96), y: pv(620), w: pv(600), lines: 1, barH: 6, gap: 4, fill: onDark }),
    pvRect(pv(96), pv(1180), pv(810), pv(110), palette.primary, { rx: pv(55) })
  ];
  for (let i = 0; i < 4; i++) pvRow(parts, palette, { x: 1080, y: 150 + i * 318, w: 824 });
  return svgWrapO(parts, palette.dark, 'landscape');
}

export default {
  id: 'keyword-dark',
  name: 'Keyword dark',
  style: 'statement',
  description: 'Dark two-tone statement poster: a stacked headline whose second line renders in the brand primary, and rows where a bold brand-color lead-in label tops white body copy, each fronted by a thin outline icon ring — minimal decor, type in charge. Hero over rows in portrait; hero-and-CTA column beside the rows in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'cells', min: 3, max: 4, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
