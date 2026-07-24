// v2 template — tabular-matrix (style: tabular). A clean do/don't/check
// matrix: a dark header band (carrying the subheadline as the table title),
// then 3–5 rows of label chip + text cell on alternating row tints. No image
// slot — the table IS the layout. Decor = a quiet dot grid + one ghosted
// padlock anchor. Landscape is the TRANSPOSED table: labels become column
// headers over alternating column tints.
//
// 2026 redesign: elevated row/column cards with rounded panels, richer header
// band with primary accent stripe, oversized accent numerals alongside label
// chips, mesh-glow corner atmosphere, improved typography hierarchy.

import {
  textbox, rect, chip, hline,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, dotGrid, padlockMotif, meshGlow,
  svgWrapO, PV_LAND_W,
  legibilityScrim,
} from './decor.js';

// ── shared helpers ────────────────────────────────────────────────────────────

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 152, fill: palette.dark, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 200, height: 100, maxSize: 46, minSize: 30 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((152 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: palette.dark
  }));
}

/** Solid blend of two #rrggbb colors (t = share of `a`) — row/column tints. */
function mixHex(a, b, t) {
  const ch = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const mixed = [0, 1, 2]
    .map((i) => Math.round(ch(a, i) * t + ch(b, i) * (1 - t)))
    .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
    .join('');
  return `#${mixed.toUpperCase()}`;
}

function headlineSection(o, content, palette, fonts, { x, y, w, maxSize }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 300, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark,
    lineHeight: 1.06,
    layerRole: 'headline', bgRef: palette.background
  }));
}

/** Dark header band — the table's title bar; the subheadline lives inside. */
function headerBand(o, content, palette, fonts, { x, y, w, h }) {
  o.push(rect({ x, y, w, h, fill: palette.dark, rx: 20, layerRole: 'background' }));
  // accent stripe at top of band
  o.push(rect({ x: x + 16, y, w: w - 32, h: 5, fill: palette.primary, rx: 2, layerRole: 'decor' }));
  if (content.subheadline) {
    const size = fitFontSize(content.subheadline, { width: w - 96, height: h - 24, maxSize: 40, minSize: 30 });
    o.push(textbox({
      text: content.subheadline, x: x + 48,
      y: y + Math.round((h - estTextHeight(content.subheadline, size, w - 96)) / 2),
      w: w - 96, fontSize: size, fontFamily: fonts.body, fontWeight: '600',
      fill: '#FFFFFF', lineHeight: 1.35,
      layerRole: 'subheadline', bgRef: palette.dark
    }));
  }
}

// ── portrait build ────────────────────────────────────────────────────────────

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.background);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  const tint = mixHex(palette.primary, palette.background, 0.10);

  // decor atmosphere
  o.push(...meshGlow({ spots: [
    { x: 1280, y: 200, r: 340, color: palette.primary },
    { x: 160, y: 1760, r: 280, color: palette.accent }
  ], intensity: 0.65 }));
  o.push(...dotGrid({ x: 1080, y: 320, cols: 5, rows: 3, gap: 50, dotR: 4, color: palette.dark, intensity: 0.7 }));
  o.push(...padlockMotif({ x: 1240, y: 1600, size: 160, color: palette.dark, intensity: 0.75 }));

  headlineSection(o, content, palette, fonts, { x: 96, y: 104, w: 1222, maxSize: 112 });
  headerBand(o, content, palette, fonts, { x: 96, y: 472, w: 1222, h: 100 });

  const blocks = content.blocks || [];
  const top = 592;
  const bottom = 1800;
  const rowH = (bottom - top) / Math.max(blocks.length, 1);

  blocks.forEach((b, i) => {
    const y = Math.round(top + i * rowH);
    const cellH = Math.round(rowH - 16);
    const rowFill = i % 2 === 0 ? '#FFFFFF' : tint;

    // row card
    o.push(rect({ x: 96, y, w: 1222, h: cellH, fill: rowFill, rx: 20, layerRole: 'background', msgId: b.id }));

    // label area: chip with fieldRef 'label'
    const chipMaxH = Math.round(cellH - 32);
    const [pill, labelTb] = chip({
      text: b.label, x: 136, y: y + 16, fontSize: 24,
      bg: palette.dark, color: palette.primary, font: fonts.head, msgId: b.id, square: true,
      maxW: 268, maxH: chipMaxH  // label zone is x=136 to divider at 420 (minus inner pad)
    });
    o.push(pill, { ...labelTb, fieldRef: 'label', bgRef: palette.dark });

    // subtle vertical divider between label zone and text zone
    o.push(rect({ x: 420, y: y + 12, w: 2, h: cellH - 24, fill: palette.primary, rx: 1, layerRole: 'decor', opacity: 0.15 }));

    // text cell with fieldRef 'text'
    const textW = 856;
    const size = fitFontSize(b.text, { width: textW, height: cellH - 40, maxSize: 44, minSize: 30 });
    o.push({
      ...textbox({
        text: b.text, x: 444, y: y + Math.max(16, Math.round((cellH - estTextHeight(b.text, size, textW)) / 2)),
        w: textW, fontSize: size, fontFamily: fonts.body, fontWeight: '600',
        fill: palette.dark, lineHeight: 1.38,
        layerRole: 'message', msgId: b.id, bgRef: rowFill
      }),
      fieldRef: 'text'
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1848);
  return canvas;
}

// ── landscape build ───────────────────────────────────────────────────────────

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.background);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  const tint = mixHex(palette.primary, palette.background, 0.10);

  o.push(...meshGlow({ spots: [
    { x: 1840, y: 160, r: 300, color: palette.primary },
    { x: 160, y: 1260, r: 240, color: palette.accent }
  ], intensity: 0.65 }));
  o.push(...dotGrid({ x: 1720, y: 112, cols: 4, rows: 2, gap: 50, dotR: 4, color: palette.dark, intensity: 0.7 }));
  o.push(...padlockMotif({ x: 1870, y: 180, size: 120, color: palette.dark, intensity: 0.75 }));

  const headSizeLs = fitFontSize(content.headline, { width: 1500, height: 220, maxSize: 100, minSize: 80 });
  const headHLs = estTextHeight(content.headline, headSizeLs, 1500, 1.06);
  o.push(textbox({
    text: content.headline, x: 96, y: 84, w: 1500, fontSize: headSizeLs,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark,
    lineHeight: 1.06, layerRole: 'headline', bgRef: palette.background
  }));
  const hBandY = Math.max(328, Math.round(84 + headHLs + 16));
  headerBand(o, content, palette, fonts, { x: 96, y: hBandY, w: 1808, h: 88 });

  // transposed table: labels as column headers, one column per block
  const blocks = content.blocks || [];
  const left = 96;
  const top = hBandY + 88;
  const colW = (1904 - left) / Math.max(blocks.length, 1);

  blocks.forEach((b, i) => {
    const x = Math.round(left + i * colW);
    const cellW = Math.round(colW - 16);
    const colFill = i % 2 === 0 ? '#FFFFFF' : tint;

    // column card
    o.push(rect({ x, y: top, w: cellW, h: 790, fill: colFill, rx: 20, layerRole: 'background', msgId: b.id }));

    // column header chip with fieldRef 'label'
    const lsChipMaxH = 72; // cap to 72px so rule + text zone stay clear
    const [pill, labelTb] = chip({
      text: b.label, x: x + 32, y: top + 28, fontSize: 24,
      bg: palette.dark, color: palette.primary, font: fonts.head, msgId: b.id, square: true,
      maxW: cellW - 64, maxH: lsChipMaxH
    });
    o.push(pill, { ...labelTb, fieldRef: 'label', bgRef: palette.dark });
    const ruleY = top + 28 + pill.height + 8;

    // accent rule under header
    o.push(hline({ x: x + 32, y: ruleY, w: cellW - 64, thickness: 3, fill: palette.primary, layerRole: 'decor' }));

    // text cell with fieldRef 'text'
    const textW = cellW - 64;
    const textCellTop = ruleY + 20;
    const size = fitFontSize(b.text, { width: textW, height: Math.max(100, top + 790 - textCellTop - 28), maxSize: 42, minSize: 20 });
    o.push({
      ...textbox({
        text: b.text, x: x + 32, y: textCellTop, w: textW, fontSize: size,
        fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
        lineHeight: 1.4,
        layerRole: 'message', msgId: b.id, bgRef: colFill
      }),
      fieldRef: 'text'
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1262);
  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────

function previewPortrait(palette) {
  const tint = mixHex(palette.primary, palette.background, 0.10);
  const parts = [
    pvBars({ x: pv(96), y: pv(118), w: pv(1222), lines: 2, barH: 8, gap: 5, fill: palette.dark }),
    pvRect(pv(96), pv(472), pv(1222), pv(100), palette.dark, { rx: 4 })
  ];
  for (let i = 0; i < 4; i++) {
    const y = 592 + i * 302;
    parts.push(pvRect(pv(96), pv(y), pv(1222), pv(286), i % 2 === 0 ? '#FFFFFF' : tint, { rx: 4 }));
    parts.push(pvRect(pv(136), pv(y + 114), pv(230), 6, palette.dark, { rx: 1.5 }));
    parts.push(pvBars({ x: pv(444), y: pv(y + 90), w: pv(856), lines: 2, barH: 4.5, gap: 3, fill: palette.dark }));
  }
  parts.push(pvRect(0, pv(1848), 200, pv(152), palette.dark));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const tint = mixHex(palette.primary, palette.background, 0.10);
  const parts = [
    pvBars({ x: pv(96), y: pv(98), w: pv(1500), lines: 1, barH: 9, gap: 5, fill: palette.dark }),
    pvRect(pv(96), pv(328), pv(1808), pv(88), palette.dark, { rx: 4 })
  ];
  for (let i = 0; i < 4; i++) {
    const x = 96 + i * 452;
    parts.push(pvRect(pv(x), pv(440), pv(436), pv(790), i % 2 === 0 ? '#FFFFFF' : tint, { rx: 4 }));
    parts.push(pvRect(pv(x + 32), pv(468), pv(188), 6, palette.dark, { rx: 1.5 }));
    parts.push(pvRect(pv(x + 32), pv(548), pv(372), 1.2, palette.primary));
    parts.push(pvBars({ x: pv(x + 32), y: pv(580), w: pv(372), lines: 3, barH: 4, gap: 3, fill: palette.dark }));
  }
  parts.push(pvRect(0, pv(1262), PV_LAND_W, pv(152), palette.dark));
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'tabular-matrix',
  name: 'Tabular matrix',
  style: 'tabular',
  description: 'Clean checklist matrix — dark title band, then label-chip and text cells on alternating row tints. Rows in portrait; transposed in landscape with the labels as column headers.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'cells', min: 3, max: 5, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
