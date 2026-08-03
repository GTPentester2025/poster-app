// v2 template — micro-learning (style: bullet). Bite-sized training cards in a
// compact 2-column grid. Each card features a teal top accent bar, a bold heading,
// and concise body text. Clean, scannable layout on white ground — ideal for
// quick reference guides and modular training content. Portrait: 2-column card
// grid; landscape: 3-column grid. 2–4 card blocks {heading, text}.

import {
  textbox, rect,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, legibilityScrim, svgWrapO, PV_LAND_W
} from './decor.js';

const BG = '#FFFFFF';          // clean white ground
const CARD = '#FFFFFF';        // card surface
const ACCENT = '#0D9488';      // teal top bar + accents
const TEXT_HEAD = '#1F2937';   // dark heading
const TEXT_BODY = '#4B5563';   // body text
const BORDER = '#E5E7EB';      // card border

function headerBar(o, text, fonts, W) {
  o.push(rect({ x: 0, y: 0, w: W, h: 96, fill: ACCENT, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 160, height: 64, maxSize: 40, minSize: 24 });
  o.push(textbox({
    text, x: 80, y: Math.round((96 - estTextHeight(text, size, W - 160)) / 2),
    w: W - 160, fontSize: size, fontFamily: fonts.head, fontWeight: '700',
    fill: '#FFFFFF', align: 'left', layerRole: 'headline', bgRef: ACCENT
  }));
}

function microCard(o, b, i, fonts, { x, y, w, h }) {
  o.push(rect({ x, y, w, h, fill: CARD, rx: 12, layerRole: 'background', msgId: b.id }));
  o.push(rect({ x, y, w, h, fill: 'transparent', stroke: BORDER, strokeWidth: 1.5, rx: 12, layerRole: 'decor' }));
  // top accent bar
  o.push(rect({ x, y, w, h: 6, fill: ACCENT, rx: 12, layerRole: 'decor' }));

  const pad = 20;
  let textY = y + pad;

  if (b.heading) {
    const headBudget = Math.round(h * 0.35);
    const hSize = fitFontSize(b.heading, { width: w - pad * 2, height: headBudget, maxSize: 24, minSize: 14 });
    o.push({
      ...textbox({
        text: b.heading, x: x + pad, y: textY, w: w - pad * 2, fontSize: hSize,
        fontFamily: fonts.head, fontWeight: '700', fill: TEXT_HEAD,
        lineHeight: 1.2, layerRole: 'message', msgId: b.id, bgRef: CARD
      }),
      fieldRef: 'heading'
    });
    textY += estTextHeight(b.heading, hSize, w - pad * 2, 1.2) + 8;
  }

  const bodyBudget = Math.max(40, y + h - textY - pad);
  const bSize = fitFontSize(b.text, { width: w - pad * 2, height: bodyBudget, maxSize: 18, minSize: 12 });
  o.push({
    ...textbox({
      text: b.text, x: x + pad, y: textY, w: w - pad * 2, fontSize: bSize,
      fontFamily: fonts.body, fontWeight: '400', fill: TEXT_BODY,
      lineHeight: 1.4, layerRole: 'message', msgId: b.id, bgRef: CARD
    }),
    fieldRef: 'text'
  });
}

function grid(o, blocks, fonts, { x, y, w, h, cols }) {
  const n = blocks.length;
  if (!n) return;
  const rows = Math.ceil(n / cols);
  const gap = 16;
  const cellW = (w - gap * (cols - 1)) / cols;
  const cellH = (h - gap * (rows - 1)) / rows;
  blocks.forEach((b, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const itemsInRow = Math.min(cols, n - r * cols);
    let cx = x + c * (cellW + gap);
    let cw = cellW;
    if (itemsInRow < cols) {
      const rowW = itemsInRow * cellW + (itemsInRow - 1) * gap;
      const offset = Math.round((w - rowW) / 2);
      cx = x + offset + c * (cellW + gap);
    }
    const cy = y + r * (cellH + gap);
    microCard(o, b, i, fonts, { x: Math.round(cx), y: Math.round(cy), w: Math.round(cw), h: Math.round(cellH) });
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', BG);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(...legibilityScrim({ w: W, h: H, strength: 0.08 }));

  headerBar(o, content.headline, fonts, W);

  const blocks = content.blocks || [];
  const gridTop = 140;
  const gridBottom = 1800;
  grid(o, blocks, fonts, { x: 60, y: gridTop, w: W - 120, h: gridBottom - gridTop, cols: 2 });

  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', BG);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(...legibilityScrim({ w: W, h: H, strength: 0.08 }));

  headerBar(o, content.headline, fonts, W);

  const blocks = content.blocks || [];
  const gridTop = 120;
  const gridBottom = 1280;
  grid(o, blocks, fonts, { x: 60, y: gridTop, w: W - 120, h: gridBottom - gridTop, cols: 3 });

  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvRect(0, 0, 200, pv(96), ACCENT),
    pvBars({ x: pv(80), y: pv(32), w: pv(500), lines: 1, barH: 10, gap: 0, fill: '#FFFFFF' })
  ];
  const gridTop = 140, gridBottom = 1800, cols = 2, rows = 2, gap = 16;
  const cw = (1238 - gap) / 2, ch = (gridBottom - gridTop - gap) / rows;
  for (let i = 0; i < 4; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const x = 60 + c * (cw + gap), y = gridTop + r * (ch + gap);
    parts.push(pvRect(pv(x), pv(y), pv(cw), pv(ch), CARD, { rx: 3, stroke: BORDER }));
    parts.push(pvRect(pv(x), pv(y), pv(cw), 1, ACCENT, { rx: 2 }));
    parts.push(pvBars({ x: pv(x + 20), y: pv(y + 20), w: pv(cw - 40), lines: 1, barH: 6, gap: 0, fill: TEXT_HEAD }));
    parts.push(pvBars({ x: pv(x + 20), y: pv(y + 40), w: pv(cw - 40), lines: 2, barH: 3, gap: 3, fill: TEXT_BODY }));
  }
  return svgWrapO(parts, BG, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvRect(0, 0, PV_LAND_W, pv(96), ACCENT),
    pvBars({ x: pv(80), y: pv(32), w: pv(500), lines: 1, barH: 10, gap: 0, fill: '#FFFFFF' })
  ];
  const gridTop = 120, gridBottom = 1280, cols = 3, rows = 1, gap = 16;
  const cw = (1904 - gap * 2) / 3, ch = gridBottom - gridTop;
  for (let i = 0; i < 3; i++) {
    const x = 60 + i * (cw + gap), y = gridTop;
    parts.push(pvRect(pv(x), pv(y), pv(cw), pv(ch), CARD, { rx: 3, stroke: BORDER }));
    parts.push(pvRect(pv(x), pv(y), pv(cw), 1, ACCENT, { rx: 2 }));
    parts.push(pvBars({ x: pv(x + 20), y: pv(y + 20), w: pv(cw - 40), lines: 1, barH: 6, gap: 0, fill: TEXT_HEAD }));
    parts.push(pvBars({ x: pv(x + 20), y: pv(y + 40), w: pv(cw - 40), lines: 2, barH: 3, gap: 3, fill: TEXT_BODY }));
  }
  return svgWrapO(parts, BG, 'landscape');
}

export default {
  id: 'micro-learning',
  name: 'Micro learning',
  style: 'bullet',
  description: 'Bite-sized training cards in a compact grid layout. Each card features a teal top accent bar, bold heading, and concise body text for quick reference and modular learning. Portrait uses a two-column card grid; landscape spans three columns. Clean, scannable design on white ground.',
  contentSchema: {
    headline: { required: true, maxWords: 6 },
    callToAction: { required: true, maxWords: 12 },
    blocks: { kind: 'panels', min: 2, max: 4, fields: ['heading', 'text'] },
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
