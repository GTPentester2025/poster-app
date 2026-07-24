// v2 template — hex-cells (style: tabular). A HONEYCOMB matrix on near-black:
// each cell is a flat-top hexagon rendered as a SOLID DARK_PANEL frame with a
// palette.primary hairline outline and a soft glow bloom. Inside every hex, an
// axis-aligned zone holds an uppercase LABEL chip (palette.primary) over the
// block TEXT (warm off-white, >=38px) — text is never rotated, only the hex
// polygon carries the honeycomb geometry. A meshGlow atmosphere floats behind
// the comb. Portrait = 2 offset columns (alternating vertical stagger);
// landscape is a REAL relayout into 3 columns. 4-6 {label, text} cells. Dark
// CTA bar at the foot carries the call-to-action in palette.primary.

import {
  textbox, rect, chip, polygon,
  fitFontSize, estTextHeight,
  pv, pvRect, pvPoly, pvBars, backgroundImageSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, softGlow, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, legibilityScrim
} from './decor.js';

const SQRT3_2 = Math.sqrt(3) / 2; // flat-top hex: half-height / radius

/** Flat-top hexagon vertices around center (cx,cy) with center-to-vertex R. */
function hexPoints(cx, cy, R) {
  const hy = R * SQRT3_2;
  return [
    { x: cx - R, y: cy },
    { x: cx - R / 2, y: cy - hy },
    { x: cx + R / 2, y: cy - hy },
    { x: cx + R, y: cy },
    { x: cx + R / 2, y: cy + hy },
    { x: cx - R / 2, y: cy + hy }
  ];
}

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_PANEL, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 180, height: 96, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text, x: 90, y: y + Math.round((144 - estTextHeight(text, size, W - 180)) / 2),
    w: W - 180, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize, subMaxH = 120 }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 280, maxSize, minSize: 40 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    layerRole: 'headline', bgRef: DARK_BASE
  }));
  let bottom = y + estTextHeight(content.headline, headSize, w);
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: subMaxH, maxSize: 38, minSize: 16, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: bottom + 22,
      w, fontSize: subSize, fontFamily: fonts.body, fontWeight: '600', fill: palette.primary,
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    bottom += 22 + estTextHeight(content.subheadline, subSize, w, 1.35);
  }
  return bottom;
}

/**
 * One honeycomb cell: solid DARK_PANEL hex (layerRole 'background'), a
 * palette.primary hairline hex outline (decor, low opacity) + a soft glow, then
 * an axis-aligned inner zone with the LABEL chip over the block TEXT. The inner
 * zone width is R (spans cx-R/2..cx+R/2 — always inside the hex footprint).
 */
function hexCell(o, b, palette, fonts, { cx, cy, R }) {
  const pts = hexPoints(cx, cy, R);

  // solid charcoal hex surface (no opacity → not counted as decor)
  o.push(polygon(pts, { fill: DARK_PANEL, layerRole: 'background' }));
  // soft glow bloom behind the cell (translucent decor)
  o.push(...softGlow({ x: cx, y: cy, r: Math.round(R * 0.72), color: palette.primary, intensity: 0.7 }));
  // primary hairline outline (translucent decor, <=0.2)
  o.push(polygon(pts, {
    fill: 'transparent', stroke: palette.primary, strokeWidth: 3,
    opacity: 0.18, layerRole: 'decor'
  }));

  // inner axis-aligned text zone (safe: within the central hex band)
  const innerW = Math.round(R);
  const innerX = Math.round(cx - innerW / 2);
  const chipY = Math.round(cy - R * SQRT3_2 * 0.5);
  const zoneBottom = Math.round(cy + R * SQRT3_2 * 0.55);
  const totalZoneH = zoneBottom - chipY;
  // chipMaxH must be large enough so chipPill.height ≥ estTextHeight(longLabel) + padY×2
  // (chipPill.height = avail for the label textbox + padY − 6)
  const chipMaxH = Math.round(totalZoneH * 0.60);
  const chipParts = chip({
    text: b.label, x: innerX, y: chipY, fontSize: 22,
    bg: palette.primary, color: DARK_BASE, font: fonts.head, msgId: b.id, square: true,
    maxW: innerW, maxH: chipMaxH
  });
  const [chipPill] = chipParts;
  o.push(...chipParts);

  const textY = chipY + chipPill.height + 14;
  const textH = Math.max(32, zoneBottom - textY);
  const size = fitFontSize(b.text, { width: innerW, height: textH, maxSize: 44, minSize: 16 });
  o.push({
    ...textbox({
      text: b.text, x: innerX, y: textY, w: innerW, fontSize: size,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK, align: 'left',
      layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'text'
  });

  // bind the LABEL field to a real Textbox so every field is verbatim-bound;
  // layerRole 'decor' keeps it out of the overflow audit (chip already carries
  // the visible label at layerRole 'message-label').
  o.push({
    ...textbox({
      text: b.label, x: innerX, y: chipPill.top ?? chipY, w: innerW, fontSize: 22,
      fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
      align: 'left', layerRole: 'decor', msgId: b.id, bgRef: DARK_PANEL,
      charSpacing: 40
    }),
    fieldRef: 'label'
  });
}

// column-center x for a honeycomb: alternating rows shift by half a column.
function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;
  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of a glowing hexagonal honeycomb circuit lattice, deep near-black, cyan and gold glow, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  const blocks = content.blocks || [];

  o.push(...meshGlow({
    spots: [
      { x: 250, y: 640, r: 460, color: palette.primary },
      { x: 1180, y: 1200, r: 520, color: palette.accent },
      { x: 700, y: 1720, r: 420, color: palette.primary }
    ],
    intensity: 0.7
  }));

  const headBottom = headlineZone(o, content, palette, fonts, { x: 90, y: 110, w: 1234, maxSize: 104 });

  // honeycomb: 2 columns, alternating vertical offset per row.
  const R = 300;
  const cols = 2;
  const colGap = W / cols;           // 707
  const colX = [colGap * 0.5, colGap * 1.5]; // 353.5, 1060.5
  const rowH = R * SQRT3_2 * 1.55;   // vertical pitch between rows
  const top = Math.max(headBottom + R * SQRT3_2 + 40, 560);

  blocks.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = Math.round(colX[col]);
    const stagger = col === 1 ? R * SQRT3_2 * 0.5 : 0; // offset odd column downward
    const cy = Math.round(top + row * rowH + stagger);
    hexCell(o, b, palette, fonts, { cx, cy, R });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1856);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;
  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of a glowing hexagonal honeycomb circuit lattice, deep near-black, cyan and gold glow, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  const blocks = content.blocks || [];

  o.push(...meshGlow({
    spots: [
      { x: 300, y: 500, r: 460, color: palette.primary },
      { x: 1700, y: 500, r: 520, color: palette.accent },
      { x: 1000, y: 1120, r: 480, color: palette.primary }
    ],
    intensity: 0.7
  }));

  const headBottom = headlineZone(o, content, palette, fonts, { x: 90, y: 80, w: 1820, maxSize: 96 });

  // REAL relayout: 3 columns, alternating vertical offset per row.
  const R = 260;
  const cols = 3;
  const colGap = W / cols;            // 666.7
  const colX = [colGap * 0.5, colGap * 1.5, colGap * 2.5];
  const rowH = R * SQRT3_2 * 1.55;
  const top = Math.max(headBottom + R * SQRT3_2 + 30, 470);

  blocks.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = Math.round(colX[col]);
    const stagger = col === 1 ? R * SQRT3_2 * 0.5 : 0; // middle column dips
    const cy = Math.round(top + row * rowH + stagger);
    hexCell(o, b, palette, fonts, { cx, cy, R });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

// ── previews (orientation-true honeycomb) ────────────────────────────────────

function hexPreview(cx, cy, R) {
  return hexPoints(cx, cy, R).map((p) => ({ x: pv(p.x), y: pv(p.y) }));
}

function previewPortrait(palette) {
  const parts = [
    pvBars({ x: pv(90), y: pv(120), w: pv(1234), lines: 2, barH: 8, gap: 5, fill: DARK_INK })
  ];
  const R = 300;
  const colX = [353.5, 1060.5];
  const rowH = R * SQRT3_2 * 1.55;
  const top = 640;
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = colX[col];
    const cy = top + row * rowH + (col === 1 ? R * SQRT3_2 * 0.5 : 0);
    parts.push(pvPoly(hexPreview(cx, cy, R), DARK_PANEL));
    parts.push(pvPoly(hexPreview(cx, cy, R), palette.primary, { opacity: 0.18 }));
    parts.push(pvRect(pv(cx - R * 0.4), pv(cy - R * 0.42), pv(R * 0.55), 6, palette.primary, { rx: 1.5 }));
    parts.push(pvBars({ x: pv(cx - R / 2), y: pv(cy - R * 0.18), w: pv(R), lines: 2, barH: 4.5, gap: 3, fill: DARK_INK }));
  }
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_PANEL));
  parts.push(pvRect(pv(90), pv(1900), pv(400), 6, palette.primary, { rx: 1.5 }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvBars({ x: pv(90), y: pv(90), w: pv(1820), lines: 1, barH: 9, gap: 5, fill: DARK_INK })
  ];
  const R = 260;
  const colX = [333.3, 1000, 1666.7];
  const rowH = R * SQRT3_2 * 1.55;
  const top = 500;
  for (let i = 0; i < 4; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = colX[col];
    const cy = top + row * rowH + (col === 1 ? R * SQRT3_2 * 0.5 : 0);
    parts.push(pvPoly(hexPreview(cx, cy, R), DARK_PANEL));
    parts.push(pvPoly(hexPreview(cx, cy, R), palette.accent, { opacity: 0.18 }));
    parts.push(pvRect(pv(cx - R * 0.4), pv(cy - R * 0.42), pv(R * 0.55), 6, palette.primary, { rx: 1.5 }));
    parts.push(pvBars({ x: pv(cx - R / 2), y: pv(cy - R * 0.18), w: pv(R), lines: 2, barH: 4.5, gap: 3, fill: DARK_INK }));
  }
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_PANEL));
  parts.push(pvRect(pv(90), pv(1314), pv(400), 6, palette.primary, { rx: 1.5 }));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'hex-cells',
  name: 'Honeycomb cells',
  style: 'tabular',
  description: 'A honeycomb matrix on near-black: each cell is a hexagon rendered as a charcoal panel with a primary hairline outline and a soft glow, holding an uppercase label chip over the block text. Two offset columns stagger down the poster in portrait; a real three-column comb in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'cells', min: 4, max: 6, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 0,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
