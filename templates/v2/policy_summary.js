// v2 template — policy-summary (style: infographic). Single-page policy
// highlight sheet: a header band over a grid of key-point cards, each led by a
// rounded icon badge (icon bullet), a bold key label, and a short policy note.
// Professional document look — navy header, white cards, slate ink, an accent
// rail on each card. Portrait: 2-column card grid under the header. Landscape:
// 3-column grid with the header spanning the top. 3–6 cells blocks {label,
// text}, 0 image slots (icon bullets are drawn vector, not photographic).

import {
  textbox, rect,
  backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, dotGrid,
  legibilityScrim, svgWrapO, PV_LAND_W
} from './decor.js';

const PAPER = '#EEF1F5';    // light document ground
const CARD = '#FFFFFF';     // key-point card surface
const NAVY = '#1B2A4A';     // header band + ink
const SLATE = '#475569';    // body text
const BORDER = '#D3DAE3';   // card hairline
// professional accent cycle for icon badges + card rails
const ACCENTS = ['#0D9488', '#1B2A4A', '#334155', '#0E7490', '#4338CA', '#0F766E'];

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 128, fill: NAVY, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: palette.primary, opacity: 0.9, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 200, height: 88, maxSize: 44, minSize: 28 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((128 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: '#FFFFFF', align: 'center', layerRole: 'cta', bgRef: NAVY
  }));
}

// header band with eyebrow + headline + optional subheadline. Returns band bottom.
function headerBand(o, content, palette, fonts, { W, top, bandH, x, w, maxSize, align }) {
  o.push(rect({ x: 0, y: top, w: W, h: bandH, fill: NAVY, layerRole: 'background' }));
  o.push(rect({ x: 0, y: top + bandH - 6, w: W, h: 6, fill: palette.primary, opacity: 0.9, layerRole: 'decor' }));

  o.push(textbox({
    text: 'POLICY SUMMARY', x, y: top + 44, w,
    fontSize: 24, fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
    align, charSpacing: 220, lineHeight: 1, layerRole: 'message-label', bgRef: NAVY
  }));
  let cursor = top + 84;
  const headSize = fitFontSize(content.headline, { width: w, height: 200, maxSize, minSize: 40 });
  o.push(textbox({
    text: content.headline, x, y: cursor, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: '#FFFFFF',
    align, lineHeight: 1.06, layerRole: 'headline', bgRef: NAVY
  }));
  cursor += estTextHeight(content.headline, headSize, w, 1.06) + 12;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 80, maxSize: 32, minSize: 18, lineHeight: 1.3 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: '#C7D2E0',
      align, lineHeight: 1.3, layerRole: 'subheadline', bgRef: NAVY
    }));
  }
  return top + bandH;
}

// icon bullet: a rounded accent square with a nested lighter chip (clean, flat
// "policy chip" glyph). cx,cy = badge top-left; s = badge size.
function iconBadge(o, x, y, s, color) {
  o.push(rect({ x, y, w: s, h: s, fill: color, rx: Math.round(s * 0.28), layerRole: 'decor' }));
  const inset = Math.round(s * 0.26);
  o.push(rect({
    x: x + inset, y: y + inset, w: s - inset * 2, h: s - inset * 2,
    fill: 'transparent', stroke: '#FFFFFF', strokeWidth: Math.max(3, Math.round(s * 0.08)),
    rx: Math.round(s * 0.16), layerRole: 'decor', opacity: 0.92
  }));
  o.push(rect({
    x: x + Math.round(s * 0.42), y: y + Math.round(s * 0.42),
    w: Math.round(s * 0.16), h: Math.round(s * 0.16),
    fill: '#FFFFFF', rx: Math.round(s * 0.05), layerRole: 'decor', opacity: 0.92
  }));
}

function keyCard(o, b, i, fonts, { x, y, w, h }) {
  const accent = ACCENTS[i % ACCENTS.length];
  o.push(rect({ x, y, w, h, fill: CARD, rx: 18, layerRole: 'background', msgId: b.id }));
  o.push(rect({ x, y, w, h, fill: 'transparent', stroke: BORDER, strokeWidth: 2, rx: 18, layerRole: 'decor' }));
  // left accent rail
  o.push(rect({ x, y: y + 16, w: 8, h: h - 32, fill: accent, rx: 4, layerRole: 'decor' }));

  const pad = 32;
  const badgeS = 68;
  iconBadge(o, x + pad, y + pad, badgeS, accent);

  const innerX = x + pad + badgeS + 24;
  const innerW = w - (pad + badgeS + 24) - pad;
  let textY = y + pad;
  if (b.label) {
    const titleBudget = Math.round(h * 0.30);
    const tSize = fitFontSize(b.label, { width: innerW, height: titleBudget, maxSize: 38, minSize: 18 });
    o.push({
      ...textbox({
        text: b.label, x: innerX, y: textY, w: innerW, fontSize: tSize,
        fontFamily: fonts.head, fontWeight: '800', fill: NAVY,
        lineHeight: 1.1, layerRole: 'message', msgId: b.id, bgRef: CARD
      }),
      fieldRef: 'label'
    });
    textY += estTextHeight(b.label, tSize, innerW, 1.1) + 12;
  }
  // body spans full width below the badge row
  const bodyX = x + pad;
  const bodyW = w - pad * 2;
  const bodyTop = Math.max(textY, y + pad + badgeS + 8);
  const bodyBudget = Math.max(48, y + h - bodyTop - pad);
  const bSize = fitFontSize(b.text, { width: bodyW, height: bodyBudget, maxSize: 28, minSize: 15 });
  o.push({
    ...textbox({
      text: b.text, x: bodyX, y: bodyTop, w: bodyW, fontSize: bSize,
      fontFamily: fonts.body, fontWeight: '500', fill: SLATE,
      lineHeight: 1.35, layerRole: 'message', msgId: b.id, bgRef: CARD
    }),
    fieldRef: 'text'
  });
}

function grid(o, blocks, fonts, { x, y, w, h, cols }) {
  const n = blocks.length;
  if (!n) return;
  const rows = Math.ceil(n / cols);
  const gap = 24;
  const cellW = (w - gap * (cols - 1)) / cols;
  const cellH = (h - gap * (rows - 1)) / rows;
  blocks.forEach((b, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    // last row: if it has fewer items than cols, widen/center them
    const itemsInRow = Math.min(cols, n - r * cols);
    let cx = x + c * (cellW + gap);
    let cw = cellW;
    if (itemsInRow < cols) {
      const rowW = itemsInRow * cellW + (itemsInRow - 1) * gap;
      const offset = Math.round((w - rowW) / 2);
      cx = x + offset + c * (cellW + gap);
    }
    const cy = y + r * (cellH + gap);
    keyCard(o, b, i, fonts, { x: Math.round(cx), y: Math.round(cy), w: Math.round(cw), h: Math.round(cellH) });
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', PAPER);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'clean corporate document background, subtle paper texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H, strength: 0.25 }));
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: PAPER, direction: 'diagonal', intensity: 0.25 }));
  o.push(...dotGrid({ x: W - 220, y: 380, cols: 4, rows: 4, gap: 42, dotR: 3, color: NAVY, intensity: 0.35 }));

  const bandBottom = headerBand(o, content, palette, fonts, {
    W, top: 0, bandH: 380, x: 88, w: W - 176, maxSize: 84, align: 'left'
  });

  const blocks = content.blocks || [];
  const gridTop = bandBottom + 48;
  const gridBottom = 1824;
  grid(o, blocks, fonts, { x: 88, y: gridTop, w: W - 176, h: gridBottom - gridTop, cols: 2 });

  ctaBar(o, content.callToAction, palette, fonts, W, 1872);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', PAPER);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'clean corporate document background, subtle paper texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H, strength: 0.25 }));
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: PAPER, direction: 'horizontal', intensity: 0.25 }));
  o.push(...dotGrid({ x: W - 200, y: 360, cols: 3, rows: 3, gap: 42, dotR: 3, color: NAVY, intensity: 0.35 }));

  const bandBottom = headerBand(o, content, palette, fonts, {
    W, top: 0, bandH: 320, x: 88, w: W - 176, maxSize: 72, align: 'left'
  });

  const blocks = content.blocks || [];
  const gridTop = bandBottom + 44;
  const gridBottom = 1240;
  grid(o, blocks, fonts, { x: 88, y: gridTop, w: W - 176, h: gridBottom - gridTop, cols: 3 });

  ctaBar(o, content.callToAction, palette, fonts, W, 1286);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvRect(0, 0, 200, pv(380), NAVY),
    pvRect(pv(88), pv(84), pv(300), 5, palette.primary, { rx: 2 }),
    pvBars({ x: pv(88), y: pv(150), w: pv(1000), lines: 2, barH: 8, gap: 5, fill: '#FFFFFF' })
  ];
  const gridTop = 428, gridBottom = 1824, cols = 2, rows = 3, gap = 24;
  const cw = (1238 - gap) / 2, ch = (gridBottom - gridTop - gap * 2) / rows;
  for (let i = 0; i < 6; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const x = 88 + c * (cw + gap), y = gridTop + r * (ch + gap);
    parts.push(pvRect(pv(x), pv(y), pv(cw), pv(ch), CARD, { rx: 4, stroke: BORDER }));
    parts.push(pvRect(pv(x), pv(y + 16), 1.5, pv(ch - 32), ACCENTS[i % ACCENTS.length], { rx: 1 }));
    parts.push(pvRect(pv(x + 32), pv(y + 32), pv(68), pv(68), ACCENTS[i % ACCENTS.length], { rx: 4 }));
    parts.push(pvRect(pv(x + 124), pv(y + 40), pv(cw - 180), 5, NAVY, { rx: 2 }));
    parts.push(pvBars({ x: pv(x + 32), y: pv(y + 120), w: pv(cw - 64), lines: 2, barH: 4, gap: 3, fill: SLATE }));
  }
  parts.push(pvRect(0, pv(1872), 200, pv(128), NAVY));
  return svgWrapO(parts, PAPER, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvRect(0, 0, PV_LAND_W, pv(320), NAVY),
    pvRect(pv(88), pv(70), pv(280), 5, palette.primary, { rx: 2 }),
    pvBars({ x: pv(88), y: pv(130), w: pv(1200), lines: 2, barH: 7, gap: 4, fill: '#FFFFFF' })
  ];
  const gridTop = 364, gridBottom = 1240, cols = 3, rows = 2, gap = 24;
  const cw = (1824 - gap * 2) / 3, ch = (gridBottom - gridTop - gap) / rows;
  for (let i = 0; i < 6; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const x = 88 + c * (cw + gap), y = gridTop + r * (ch + gap);
    parts.push(pvRect(pv(x), pv(y), pv(cw), pv(ch), CARD, { rx: 4, stroke: BORDER }));
    parts.push(pvRect(pv(x), pv(y + 16), 1.5, pv(ch - 32), ACCENTS[i % ACCENTS.length], { rx: 1 }));
    parts.push(pvRect(pv(x + 28), pv(y + 28), pv(56), pv(56), ACCENTS[i % ACCENTS.length], { rx: 4 }));
    parts.push(pvBars({ x: pv(x + 28), y: pv(y + 110), w: pv(cw - 56), lines: 2, barH: 4, gap: 3, fill: SLATE }));
  }
  parts.push(pvRect(0, pv(1286), PV_LAND_W, pv(128), NAVY));
  return svgWrapO(parts, PAPER, 'landscape');
}

export default {
  id: 'policy-summary',
  name: 'Policy summary',
  style: 'infographic',
  description: 'Single-page policy highlight sheet with a navy header band over a grid of key-point cards, each led by a rounded icon-bullet badge, a bold key label, and a short policy note on an accent rail. Professional document look on a light ground. Portrait uses a two-column card grid; landscape spans the header across the top over a three-column grid.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'cells', min: 3, max: 6, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
