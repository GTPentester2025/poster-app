// v2 template — impact-burst (style: stats). One HERO mega-statistic detonating
// on black: the first block's FIGURE is enormous (300–420px, palette.primary),
// centered over a radial BURST — a soft-glow bloom, a light-beams sweep, a
// starburst of thin rotated Rect rays, and concentric signalArcs. The hero
// caption sits directly beneath it (DARK_INK, large). The remaining blocks are
// supporting mini-stat chips — smaller figures (>=120px, alternating
// primary/accent) with captions on small DARK_PANEL cards. One honest image
// slot is a corner emblem/vignette. Portrait: hero upper-middle, mini-stats in a
// row across the lower third. Landscape is a REAL relayout — the hero burst
// fills the LEFT half, the mini-stats stack down the RIGHT half. CTA bar
// (DARK_PANEL) bottom, palette.primary text. 3–5 stats blocks {figure, caption};
// figures are short strings sized by EXPLICIT fontSize, never word-wrapped. Dark
// template: near-black base, light ink, brand color reserved for figures + glow.

import {
  textbox, rect, imageSlot, backgroundImageSlot,
  fitFontSize, estTextHeight, estTextWidth, estLines,
  pv, pvRect, pvCircle, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, softGlow, lightBeams, signalArcs, svgWrapO,
  legibilityScrim,
  PV_LAND_W, DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM
} from './decor.js';

// Explicitly size a short figure string so it never word-wraps and always fits
// its box: step down from desired until the text fits in a SINGLE line within
// boxW. Falls back to floor when no single-line size ≥ floor can fit.
function figureSize(text, boxW, desired, floor = 120) {
  let size = desired;
  while (size >= floor && estLines(String(text), size, boxW) > 1) size -= 2;
  // Also check raw glyph width to catch long single-word figures.
  const maxW = boxW * 0.94;
  while (size >= floor && estTextWidth(String(text), size) > maxW) size -= 2;
  return Math.max(size, floor);
}

// A starburst of thin rotated Rect rays radiating from (cx,cy). Pure decor
// (opacity <= 0.2); Rects may rotate (Textboxes never do). Each ray is a long
// thin bar whose top anchors near the center and is angled around the circle.
function starburst(cx, cy, len, color, { rays = 16, thickness = 6, inner = 40 } = {}) {
  const o = [];
  for (let i = 0; i < rays; i++) {
    const deg = (360 / rays) * i;
    const rad = (deg * Math.PI) / 180;
    // start point pushed out from center by `inner` along the ray direction
    const sx = cx + Math.sin(rad) * inner;
    const sy = cy - Math.cos(rad) * inner;
    o.push(rect({
      x: Math.round(sx - thickness / 2), y: Math.round(sy),
      w: thickness, h: len, fill: color, rx: thickness / 2,
      angle: deg, opacity: i % 2 === 0 ? 0.14 : 0.08, layerRole: 'decor'
    }));
  }
  return o;
}

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_PANEL, layerRole: 'background', opacity: 1 }));
  const size = fitFontSize(text, { width: W - 180, height: 96, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text, x: 90, y: y + Math.round((144 - estTextHeight(text, size, W - 180)) / 2),
    w: W - 180, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize, align = 'left' }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 300, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align,
    layerRole: 'headline', bgRef: DARK_BASE
  }));
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 40, minSize: 16, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: y + estTextHeight(content.headline, headSize, w) + 22,
      w, fontSize: subSize, fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM, align,
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
  }
}

/**
 * The HERO mega-statistic: a radial BURST (soft glow + light beams + starburst
 * rays + concentric signal arcs) with the enormous FIGURE (fieldRef 'figure',
 * palette.primary, explicit size) centered on it, and its caption (fieldRef
 * 'caption', DARK_INK, large) directly beneath. Figures are short — sized by
 * figureSize(), never word-wrapped.
 */
function heroBurst(o, b, palette, fonts, { cx, cy, boxW, figSize, capMax }) {
  // radial burst behind the figure (all decor <= 0.2 opacity)
  o.push(...softGlow({ x: Math.round(cx), y: Math.round(cy), r: Math.round(figSize * 1.7), color: palette.primary, intensity: 1 }));
  o.push(...signalArcs({ x: Math.round(cx), y: Math.round(cy), r: Math.round(figSize * 1.9), rings: 4, color: palette.accent, strokeWidth: 8, intensity: 0.9 }));
  o.push(...starburst(Math.round(cx), Math.round(cy), Math.round(figSize * 1.5), palette.primary, {
    rays: 18, thickness: 7, inner: Math.round(figSize * 0.5)
  }));

  // enormous figure centered on the burst
  const figH = Math.round(figSize * 1.12);
  o.push({
    ...textbox({
      text: b.figure, x: Math.round(cx - boxW / 2), y: Math.round(cy - figH / 2), w: boxW,
      fontSize: figSize, fontFamily: fonts.head, fontWeight: '900', fill: palette.primary,
      align: 'center', lineHeight: 1.02, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'figure'
  });

  // hero caption directly under the figure
  const capW = Math.round(boxW * 0.92);
  const capSize = fitFontSize(b.caption, { width: capW, height: 200, maxSize: capMax, minSize: 40 });
  o.push({
    ...textbox({
      text: b.caption, x: Math.round(cx - capW / 2), y: Math.round(cy + figH / 2 + 30), w: capW,
      fontSize: capSize, fontFamily: fonts.body, fontWeight: '700', fill: DARK_INK, align: 'center',
      layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'caption'
  });
}

/**
 * A supporting mini-stat chip on a small DARK_PANEL card: a smaller FIGURE
 * (fieldRef 'figure', alternating primary/accent, >=120px explicit) over a
 * caption (fieldRef 'caption', DARK_INK, >=38px).
 */
function miniStat(o, b, palette, fonts, { x, y, w, h, figSize, accent }) {
  o.push(rect({ x, y, w, h, fill: DARK_PANEL, rx: 20, layerRole: 'background', opacity: 1 }));
  const surface = DARK_PANEL;
  const figColor = accent ? palette.accent : palette.primary;

  const fs = figureSize(b.figure, w - 24, figSize, 90);
  const figH = Math.round(fs * 1.1);
  o.push({
    ...textbox({
      text: b.figure, x: x + 12, y: y + 26, w: w - 24, fontSize: fs,
      fontFamily: fonts.head, fontWeight: '900', fill: figColor, align: 'center',
      lineHeight: 1.02, layerRole: 'message', msgId: b.id, bgRef: surface
    }),
    fieldRef: 'figure'
  });

  const capSize = fitFontSize(b.caption, { width: w - 40, height: h - figH - 60, maxSize: 42, minSize: 38 });
  o.push({
    ...textbox({
      text: b.caption, x: x + 20, y: y + 26 + figH + 14, w: w - 40, fontSize: capSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK, align: 'center',
      layerRole: 'message', msgId: b.id, bgRef: surface
    }),
    fieldRef: 'caption'
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of a radial energy burst in deep space with shockwave light rays, deep near-black, cyan and gold glow, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  const blocks = content.blocks || [];
  const [hero, ...rest] = blocks;

  // atmosphere: a light-beams sweep behind everything
  o.push(...lightBeams({ w: W, h: H, color: palette.primary, count: 3, angle: 22, intensity: 0.6 }));

  // corner emblem / vignette (honest dashed slot, top-right)
  o.push(imageSlot({
    slotId: 'slot-1', x: 1070, y: 96, w: 254, h: 254,
    styleHint: 'bold abstract impact burst emblem, flat vector, no text', stroke: palette.primary
  }));

  // second supporting emblem — top-right band just below slot-1, right of the
  // headline and above the hero figure box (empty region, decor only)
  o.push(imageSlot({
    slotId: 'slot-2', x: 1094, y: 360, w: 260, h: 240,
    styleHint: 'high-tech supporting emblem illustration, flat vector, no text', stroke: palette.primary
  }));

  headlineZone(o, content, palette, fonts, { x: 90, y: 120, w: 940, maxSize: 104 });

  // HERO mega-figure detonating upper-middle
  if (hero) {
    const figSize = figureSize(hero.figure, 1180, 380, 300);
    heroBurst(o, hero, palette, fonts, { cx: W / 2, cy: 820, boxW: 1234, figSize, capMax: 64 });
  }

  // supporting mini-stats in a row across the lower third
  const cardY = 1360;
  const cardH = 380;
  const n = Math.max(rest.length, 1);
  const gap = 30;
  const marginX = 70;
  const totalW = W - marginX * 2 - gap * (n - 1);
  const cardW = totalW / n;
  rest.forEach((b, i) => {
    const x = Math.round(marginX + i * (cardW + gap));
    const w = Math.round(marginX + i * (cardW + gap) + cardW) - x; // exact partition
    miniStat(o, b, palette, fonts, {
      x, y: cardY, w, h: cardH, figSize: 150, accent: i % 2 === 0
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, H - 144);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of a radial energy burst in deep space with shockwave light rays, deep near-black, cyan and gold glow, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  const blocks = content.blocks || [];
  const [hero, ...rest] = blocks;

  // atmosphere: a light-beams sweep behind everything
  o.push(...lightBeams({ w: W, h: H, color: palette.primary, count: 3, angle: 18, intensity: 0.6 }));

  // corner emblem / vignette (honest dashed slot, top-right)
  o.push(imageSlot({
    slotId: 'slot-1', x: 1660, y: 96, w: 234, h: 234,
    styleHint: 'bold abstract impact burst emblem, flat vector, no text', stroke: palette.primary
  }));

  // second supporting emblem — top-center band between the headline and slot-1,
  // above the mini-stat column and the hero figure box (empty region, decor only)
  o.push(imageSlot({
    slotId: 'slot-2', x: 1180, y: 70, w: 260, h: 260,
    styleHint: 'high-tech supporting emblem illustration, flat vector, no text', stroke: palette.primary
  }));

  headlineZone(o, content, palette, fonts, { x: 90, y: 96, w: 900, maxSize: 92 });

  // REAL relayout — hero burst fills the LEFT half
  if (hero) {
    const leftCx = 560;
    const figSize = figureSize(hero.figure, 900, 360, 300);
    heroBurst(o, hero, palette, fonts, { cx: leftCx, cy: 760, boxW: 960, figSize, capMax: 58 });
  }

  // mini-stats stack down the RIGHT half
  const colX = 1120;
  const colW = W - colX - 80;
  const stackTop = 420;
  const stackBottom = H - 144 - 40;
  const n = Math.max(rest.length, 1);
  const gap = 28;
  const cardH = (stackBottom - stackTop - gap * (n - 1)) / n;
  rest.forEach((b, i) => {
    const y = Math.round(stackTop + i * (cardH + gap));
    const h = Math.round(stackTop + i * (cardH + gap) + cardH) - y; // exact partition
    miniStat(o, b, palette, fonts, {
      x: colX, y, w: colW, h, figSize: 132, accent: i % 2 === 0
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, H - 144);
  return canvas;
}

// ── previews ─────────────────────────────────────────────────────────────────

function pvBurst(parts, cx, cy, r, palette, rays = 12) {
  parts.push(pvCircle(pv(cx), pv(cy), pv(r * 1.6), palette.primary, { opacity: 0.1 }));
  parts.push(pvCircle(pv(cx), pv(cy), pv(r * 1.9), 'none', { stroke: palette.accent, opacity: 0.12 }));
  for (let i = 0; i < rays; i++) {
    const rad = ((360 / rays) * i * Math.PI) / 180;
    const x2 = cx + Math.sin(rad) * r * 1.5;
    const y2 = cy - Math.cos(rad) * r * 1.5;
    parts.push(`<line x1="${pv(cx)}" y1="${pv(cy)}" x2="${pv(x2)}" y2="${pv(y2)}" stroke="${palette.primary}" stroke-width="0.8" opacity="0.14"/>`);
  }
}

function previewPortrait(palette) {
  const W = 1414;
  const cx = W / 2;
  const cy = 820;
  const parts = [
    pvSlot(pv(1070), pv(96), pv(254), pv(254), palette.primary),
    pvBars({ x: pv(90), y: pv(120), w: pv(940), lines: 2, barH: 8, gap: 5, fill: DARK_INK })
  ];
  pvBurst(parts, cx, cy, 300, palette, 14);
  parts.push(pvRect(pv(cx - 200), pv(cy - 90), pv(400), pv(170), palette.primary, { rx: 6 }));
  parts.push(pvBars({ x: pv(cx - 300), y: pv(cy + 110), w: pv(600), lines: 1, barH: 6, gap: 4, fill: DARK_INK, align: 'center' }));

  const cardY = 1360;
  const cardH = 380;
  const n = 2;
  const gap = 30;
  const marginX = 70;
  const cardW = (W - marginX * 2 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = marginX + i * (cardW + gap);
    parts.push(pvRect(pv(x), pv(cardY), pv(cardW), pv(cardH), DARK_PANEL, { rx: 6 }));
    parts.push(pvRect(pv(x + cardW / 2 - 90), pv(cardY + 40), pv(180), pv(110), i % 2 === 0 ? palette.accent : palette.primary, { rx: 4 }));
    parts.push(pvBars({ x: pv(x + 24), y: pv(cardY + 200), w: pv(cardW - 48), lines: 2, barH: 4, gap: 3, fill: DARK_INK, align: 'center' }));
  }
  parts.push(pvRect(0, pv(2000 - 144), 200, pv(144), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000;
  const H = 1414;
  const parts = [
    pvSlot(pv(1660), pv(96), pv(234), pv(234), palette.primary),
    pvBars({ x: pv(90), y: pv(96), w: pv(900), lines: 2, barH: 7, gap: 5, fill: DARK_INK })
  ];
  const cx = 560;
  const cy = 760;
  pvBurst(parts, cx, cy, 300, palette, 14);
  parts.push(pvRect(pv(cx - 190), pv(cy - 85), pv(380), pv(160), palette.primary, { rx: 6 }));
  parts.push(pvBars({ x: pv(cx - 280), y: pv(cy + 100), w: pv(560), lines: 1, barH: 6, gap: 4, fill: DARK_INK, align: 'center' }));

  const colX = 1120;
  const colW = W - colX - 80;
  const stackTop = 420;
  const stackBottom = H - 144 - 40;
  const n = 2;
  const gap = 28;
  const cardH = (stackBottom - stackTop - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const y = stackTop + i * (cardH + gap);
    parts.push(pvRect(pv(colX), pv(y), pv(colW), pv(cardH), DARK_PANEL, { rx: 6 }));
    parts.push(pvRect(pv(colX + colW / 2 - 80), pv(y + 30), pv(160), pv(90), i % 2 === 0 ? palette.accent : palette.primary, { rx: 4 }));
    parts.push(pvBars({ x: pv(colX + 24), y: pv(y + 150), w: pv(colW - 48), lines: 1, barH: 4, gap: 3, fill: DARK_INK, align: 'center' }));
  }
  parts.push(pvRect(0, pv(1414 - 144), PV_LAND_W, pv(144), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'impact-burst',
  name: 'Impact burst',
  style: 'stats',
  description: 'One hero mega-statistic detonating on black: the lead figure is enormous over a radial burst of glow, light beams, starburst rays and concentric arcs, its caption directly beneath, while supporting mini-stats sit on small dark cards. Hero upper-middle with a mini-stat row across the lower third in portrait; the hero burst fills the left half with mini-stats stacked down the right in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'stats', min: 3, max: 5, fields: ['figure', 'caption'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 2
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
