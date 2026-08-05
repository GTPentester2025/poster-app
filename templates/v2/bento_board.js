// v2 template — bento-board (style: infographic). M1 modern family, 2026
// bento modular grid on a LIGHT canvas: an asymmetric arrangement of
// rounded-2xl cells — a hero cell carrying the elastic headline, one
// accent-filled cell, white content cells with soft layered shadows + thin
// outline strokes, small pill chips as cell labels, and one content image
// cell (slotId 'slot-1', linked to blk-1). Portrait: hero row over a two-col
// cell grid; landscape: REAL relayout — hero / CTA / image column left, cell
// grid right. Every text is measured (fitTextBlock) inside its cell budget so
// stress copy shrinks in place instead of colliding.

import {
  textbox, rect, chip, imageSlot, backgroundImageSlot,
  fitTextBlock, pickTextColor,
  pv, pvRect, pvCircle, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO, PV_LAND_W, PV_LAND_H,
  legibilityScrim, softGlow, dotGrid
} from './decor.js';

const R = 28;    // rounded-2xl cell radius
const PAD = 44;  // cell inner padding
const GAP = 28;  // grid gutter

const BG_HINT = 'soft light abstract paper texture, gentle warm gradients, airy minimal, no text';
const SLOT_HINT = 'clean modern editorial photo, bright natural light, generous negative space, no text';

/** Soft layered shadow + thin outline, rounded-2xl cell shell. */
function cellShell(o, { x, y, w, h, fill, stroke, msgId = null }) {
  o.push(rect({ x: x + 6, y: y + 10, w, h, fill: '#1F1A17', opacity: 0.07, rx: R, layerRole: 'background', msgId }));
  o.push(rect({ x, y, w, h, fill, rx: R, stroke, strokeWidth: 2, layerRole: 'background', msgId }));
}

/** Asymmetric-but-tidy grid: rows of two, an odd last block goes full width. */
function cellRects(n, { x, y, w, h }) {
  const rows = Math.ceil(n / 2);
  const rowH = Math.round((h - GAP * (rows - 1)) / rows);
  const colW = Math.round((w - GAP) / 2);
  const rects = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / 2);
    const lastAlone = i === n - 1 && n % 2 === 1;
    rects.push({
      x: lastAlone ? x : x + (i % 2) * (colW + GAP),
      y: y + r * (rowH + GAP),
      w: lastAlone ? w : colW,
      h: rowH
    });
  }
  return rects;
}

/** One content cell: pill chip label + measured body text. Index 1 is the accent-filled cell. */
function contentCell(o, b, i, palette, fonts, { x, y, w, h }) {
  const accent = i === 1;
  const fill = accent ? palette.primary : '#FFFFFF';
  const ink = accent ? pickTextColor(palette.primary) : palette.dark;
  cellShell(o, { x, y, w, h, fill, stroke: palette.dark, msgId: b.id });
  const innerW = w - PAD * 2;
  let cursor = y + PAD;
  if (b.label) {
    const chipBg = accent ? palette.background : palette.accent;
    const chipObjs = chip({
      text: b.label, x: x + PAD, y: cursor, fontSize: 24,
      bg: chipBg, color: pickTextColor(chipBg), font: fonts.head,
      msgId: b.id, maxW: innerW, maxH: 62
    });
    o.push(chipObjs[0], { ...chipObjs[1], fieldRef: 'label', bgRef: chipBg });
    cursor += chipObjs[0].height + 24;
  }
  const fit = fitTextBlock(b.text, {
    width: innerW, height: Math.max(60, y + h - PAD - cursor), maxSize: 40, minSize: 16, lineHeight: 1.32
  });
  o.push({
    ...textbox({
      text: b.text, x: x + PAD, y: Math.round(cursor), w: innerW, fontSize: fit.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: ink,
      lineHeight: 1.32, layerRole: 'message', msgId: b.id, bgRef: fill
    }),
    fieldRef: 'text'
  });
}

/** Hero cell: elastic headline + subheadline, measured y-flow inside the cell. */
function heroCell(o, content, palette, fonts, { x, y, w, h, headMax }) {
  cellShell(o, { x, y, w, h, fill: '#FFFFFF', stroke: palette.dark });
  const innerW = w - PAD * 2;
  const head = fitTextBlock(content.headline, {
    width: innerW, height: Math.round(h * 0.6), maxSize: headMax, minSize: 44, lineHeight: 1.04
  });
  o.push(textbox({
    text: content.headline, x: x + PAD, y: y + PAD, w: innerW, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark, lineHeight: 1.04,
    charSpacing: -20, layerRole: 'headline', bgRef: '#FFFFFF'
  }));
  const cursor = y + PAD + head.height;
  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, {
      width: innerW, height: Math.max(56, y + h - PAD - cursor - 20), maxSize: 34, minSize: 16, lineHeight: 1.3
    });
    o.push(textbox({
      text: content.subheadline, x: x + PAD, y: Math.round(cursor + 20), w: innerW,
      fontSize: sub.fontSize, fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.3, layerRole: 'subheadline', bgRef: '#FFFFFF'
    }));
  }
  o.push(rect({ x: x + PAD, y: y + h - 26, w: 120, h: 8, fill: palette.accent, rx: 4, layerRole: 'decor' }));
}

/** Image cell: honest dashed slot, blockId-linked so the fill is point-relevant. */
function imageCell(o, palette, { x, y, w, h, blockId }) {
  cellShell(o, { x, y, w, h, fill: '#FFFFFF', stroke: palette.dark });
  o.push(imageSlot({
    slotId: 'slot-1', x: x + 18, y: y + 18, w: w - 36, h: h - 36,
    styleHint: SLOT_HINT, stroke: palette.primary, rx: R - 10, blockId
  }));
}

/** CTA cell: dark rounded cell with centered, fitted call to action. */
function ctaCell(o, content, palette, fonts, { x, y, w, h }) {
  cellShell(o, { x, y, w, h, fill: palette.dark, stroke: palette.dark });
  const innerW = w - PAD * 2;
  const fit = fitTextBlock(content.callToAction, { width: innerW, height: h - 44, maxSize: 40, minSize: 20, lineHeight: 1.2 });
  o.push(textbox({
    text: content.callToAction, x: x + PAD, y: Math.round(y + (h - fit.height) / 2), w: innerW,
    fontSize: fit.fontSize, fontFamily: fonts.head, fontWeight: '800',
    fill: pickTextColor(palette.dark), align: 'center', lineHeight: 1.2,
    layerRole: 'cta', bgRef: palette.dark
  }));
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.background);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  // LIGHT scrim (paper-colored): this is a light design — the wash must
  // lighten a filled background image, not darken it; the default dark scrim
  // would turn the airy bento field muddy grey.
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  o.push(...softGlow({ x: 1290, y: 210, r: 320, color: palette.primary, intensity: 0.8 }));
  o.push(...dotGrid({ x: 120, y: 1560, cols: 5, rows: 6, gap: 48, dotR: 4, color: palette.dark, intensity: 0.7 }));

  const M = 80;
  const innerW = W - M * 2;

  // hero row: headline cell + image cell
  heroCell(o, content, palette, fonts, { x: M, y: M, w: 772, h: 430, headMax: 92 });
  imageCell(o, palette, { x: M + 772 + GAP, y: M, w: innerW - 772 - GAP, h: 430, blockId: 'blk-1' });

  // content cell grid
  const blocks = content.blocks || [];
  const gridTop = M + 430 + GAP;
  const ctaH = 150;
  const ctaY = H - M - ctaH;
  const rects = cellRects(Math.max(blocks.length, 1), {
    x: M, y: gridTop, w: innerW, h: ctaY - GAP - gridTop
  });
  blocks.forEach((b, i) => contentCell(o, b, i, palette, fonts, rects[i]));

  ctaCell(o, content, palette, fonts, { x: M, y: ctaY, w: innerW, h: ctaH });
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.background);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  // LIGHT scrim (paper-colored) — see portrait note; light design contract.
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  o.push(...softGlow({ x: 1860, y: 180, r: 300, color: palette.primary, intensity: 0.8 }));
  o.push(...dotGrid({ x: 1700, y: 1120, cols: 6, rows: 4, gap: 48, dotR: 4, color: palette.dark, intensity: 0.7 }));

  const M = 80;
  const colW = 640;

  // left column: hero cell, CTA cell, image cell
  heroCell(o, content, palette, fonts, { x: M, y: M, w: colW, h: 620, headMax: 84 });
  ctaCell(o, content, palette, fonts, { x: M, y: M + 620 + GAP, w: colW, h: 140 });
  imageCell(o, palette, { x: M, y: M + 620 + GAP + 140 + GAP, w: colW, h: H - M - (M + 620 + GAP + 140 + GAP), blockId: 'blk-1' });

  // right area: content cell grid
  const blocks = content.blocks || [];
  const gx = M + colW + GAP;
  const rects = cellRects(Math.max(blocks.length, 1), {
    x: gx, y: M, w: W - M - gx, h: H - M * 2
  });
  blocks.forEach((b, i) => contentCell(o, b, i, palette, fonts, rects[i]));
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvCircle(pv(1290), pv(210), pv(320), palette.primary, { opacity: 0.07 }),
    pvRect(pv(80), pv(80), pv(772), pv(430), '#FFFFFF', { rx: 4, stroke: palette.dark }),
    pvBars({ x: pv(124), y: pv(140), w: pv(684), lines: 2, barH: 12, gap: 6, fill: palette.dark }),
    pvRect(pv(880), pv(80), pv(454), pv(430), '#FFFFFF', { rx: 4, stroke: palette.dark }),
    pvSlot(pv(898), pv(98), pv(418), pv(394), palette.primary)
  ];
  [[80, 538], [721, 538], [80, 1154], [721, 1154]].forEach(([cx, cy], i) => {
    const accent = i === 1;
    parts.push(pvRect(pv(cx), pv(cy), pv(613), pv(588), accent ? palette.primary : '#FFFFFF', { rx: 4, stroke: palette.dark }));
    parts.push(pvRect(pv(cx + 44), pv(cy + 44), pv(160), pv(48), accent ? palette.background : palette.accent, { rx: 3.4 }));
    parts.push(pvBars({ x: pv(cx + 44), y: pv(cy + 140), w: pv(525), lines: 3, barH: 6, gap: 4, fill: accent ? pickTextColor(palette.primary) : palette.dark }));
  });
  parts.push(pvRect(pv(80), pv(1770), pv(1254), pv(150), palette.dark, { rx: 4 }));
  parts.push(pvBars({ x: pv(200), y: pv(1830), w: pv(1014), lines: 1, barH: 6, gap: 4, fill: pickTextColor(palette.dark), align: 'center' }));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvCircle(pv(1860), pv(180), pv(300), palette.primary, { opacity: 0.07 }),
    pvRect(pv(80), pv(80), pv(640), pv(620), '#FFFFFF', { rx: 4, stroke: palette.dark }),
    pvBars({ x: pv(124), y: pv(140), w: pv(552), lines: 3, barH: 10, gap: 6, fill: palette.dark }),
    pvRect(pv(80), pv(728), pv(640), pv(140), palette.dark, { rx: 4 }),
    pvRect(pv(80), pv(896), pv(640), pv(438), '#FFFFFF', { rx: 4, stroke: palette.dark }),
    pvSlot(pv(98), pv(914), pv(604), pv(402), palette.primary)
  ];
  [[748, 80], [1348, 80], [748, 721], [1348, 721]].forEach(([cx, cy], i) => {
    const accent = i === 1;
    parts.push(pvRect(pv(cx), pv(cy), pv(572), pv(613), accent ? palette.primary : '#FFFFFF', { rx: 4, stroke: palette.dark }));
    parts.push(pvRect(pv(cx + 44), pv(cy + 44), pv(160), pv(48), accent ? palette.background : palette.accent, { rx: 3.4 }));
    parts.push(pvBars({ x: pv(cx + 44), y: pv(cy + 140), w: pv(484), lines: 3, barH: 6, gap: 4, fill: accent ? pickTextColor(palette.primary) : palette.dark }));
  });
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'bento-board',
  name: 'Bento board',
  style: 'infographic',
  description: 'A 2026 bento modular grid on a light canvas: asymmetric rounded cells with soft layered shadows and thin outlines — a hero headline cell, one accent-filled cell, pill-chip labels, and a linked image cell. Hero row over the grid in portrait; hero/CTA/image column beside the grid in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'cells', min: 3, max: 4, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
