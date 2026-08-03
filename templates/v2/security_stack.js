// v2 template — security-stack (style: infographic). Security tool stack
// visualization: horizontal layered bars representing security layers (endpoint,
// network, cloud, data, identity, SIEM). Each layer is a colored bar with label
// and description. Corporate infographic design on dark canvas, no gradients,
// clean typography emphasis.
// Portrait: full-width stacked layers with left label + right description.
// Landscape: same stacked layers, optimized for wider text columns.

import {
  textbox, rect, backgroundImageSlot,
  fitFontSize, estTextHeight
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, legibilityScrim,
  DARK_BASE, DARK_INK, DARK_INK_DIM
} from './decor.js';

// Security layer colours (corporate, distinct, accessible)
const LAYER_COLOURS = {
  endpoint: '#EF4444',    // red
  network: '#3B82F6',     // blue
  cloud: '#A855F7',       // purple
  data: '#06B6D4',        // cyan
  identity: '#F59E0B',    // amber
  siem: '#14B8A6'         // teal
};

const LAYER_ORDER = ['endpoint', 'network', 'cloud', 'data', 'identity', 'siem'];

// ── security layer bar: colored bar with label + description ──────────────────
function layerBar(o, block, layerIdx, layerColour, fonts, { x, y, w, h, labelW }) {
  // coloured bar background
  o.push(rect({ x, y, w, h, fill: layerColour, opacity: 0.92, layerRole: 'decor' }));

  // label (bold, left side, white text on color)
  const labelSize = fitFontSize(block.label, { width: labelW - 24, height: h - 16, maxSize: 28, minSize: 14 });
  o.push({
    ...textbox({
      text: block.label, x: x + 16, y: y + (h - estTextHeight(block.label, labelSize, labelW - 24)) / 2,
      w: labelW - 24, fontSize: labelSize, fontFamily: fonts.head, fontWeight: '700',
      fill: '#FFFFFF', layerRole: 'message-label', bgRef: layerColour
    }),
    fieldRef: 'label'
  });

  // description (regular, right side, white text on color)
  const descX = x + labelW + 24;
  const descW = w - labelW - 48;
  const descSize = fitFontSize(block.text, { width: descW, height: h - 16, maxSize: 18, minSize: 12 });
  o.push({
    ...textbox({
      text: block.text, x: descX, y: y + (h - estTextHeight(block.text, descSize, descW)) / 2,
      w: descW, fontSize: descSize, fontFamily: fonts.body, fontWeight: '400',
      fill: '#FFFFFF', lineHeight: 1.3, layerRole: 'message', msgId: block.id, bgRef: layerColour
    }),
    fieldRef: 'text'
  });
}

// ── portrait ──────────────────────────────────────────────────────────────────
function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark security operations center, technology infrastructure, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  const margin = 80;
  const innerW = W - margin * 2;

  // headline
  const headSize = fitFontSize(content.headline, { width: innerW, height: 240, maxSize: 72, minSize: 32 });
  const headH = estTextHeight(content.headline, headSize, innerW);
  o.push(textbox({
    text: content.headline, x: margin, y: 88, w: innerW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align: 'left',
    lineHeight: 1.1, layerRole: 'headline', bgRef: DARK_BASE
  }));

  let cursor = 88 + headH + 32;

  // subheadline
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: innerW, height: 80, maxSize: 24, minSize: 14 });
    o.push(textbox({
      text: content.subheadline, x: margin, y: cursor, w: innerW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '400', fill: DARK_INK_DIM,
      lineHeight: 1.3, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, innerW) + 32;
  }

  // security layers
  const blocks = content.blocks || [];
  const layerH = 72;
  const layerGap = 12;
  const labelW = Math.round(innerW * 0.28);

  blocks.forEach((b, i) => {
    const layerColour = LAYER_COLOURS[LAYER_ORDER[i % LAYER_ORDER.length]];
    layerBar(o, b, i, layerColour, fonts, { x: margin, y: cursor, w: innerW, h: layerH, labelW });
    cursor += layerH + layerGap;
  });

  return canvas;
}

// ── landscape ─────────────────────────────────────────────────────────────────
function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark security operations center, technology infrastructure, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  const margin = 100;
  const innerW = W - margin * 2;

  // headline
  const headSize = fitFontSize(content.headline, { width: innerW, height: 180, maxSize: 64, minSize: 28 });
  const headH = estTextHeight(content.headline, headSize, innerW);
  o.push(textbox({
    text: content.headline, x: margin, y: 88, w: innerW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align: 'left',
    lineHeight: 1.1, layerRole: 'headline', bgRef: DARK_BASE
  }));

  let cursor = 88 + headH + 24;

  // subheadline
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: innerW, height: 60, maxSize: 20, minSize: 12 });
    o.push(textbox({
      text: content.subheadline, x: margin, y: cursor, w: innerW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '400', fill: DARK_INK_DIM,
      lineHeight: 1.3, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, innerW) + 24;
  }

  // security layers (landscape: taller bars, wider description area)
  const blocks = content.blocks || [];
  const layerH = 68;
  const layerGap = 10;
  const labelW = Math.round(innerW * 0.22);

  blocks.forEach((b, i) => {
    const layerColour = LAYER_COLOURS[LAYER_ORDER[i % LAYER_ORDER.length]];
    layerBar(o, b, i, layerColour, fonts, { x: margin, y: cursor, w: innerW, h: layerH, labelW });
    cursor += layerH + layerGap;
  });

  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────
function previewPortrait(palette) {
  const W = 1414; const H = 2000;
  const margin = 80;
  const innerW = W - margin * 2;
  const parts = [];

  // headline bar
  parts.push({ tag: 'rect', x: margin, y: 88, w: innerW, h: 60, fill: DARK_INK, rx: 3 });
  // subheadline bar
  parts.push({ tag: 'rect', x: margin, y: 160, w: innerW * 0.7, h: 16, fill: DARK_INK_DIM, rx: 3 });

  // security layer bars (5 layers, portrait)
  const layerH = 72;
  const layerGap = 12;
  const labelW = Math.round(innerW * 0.28);
  const colours = Object.values(LAYER_COLOURS);
  let rc = 220;

  for (let i = 0; i < 5; i++) {
    parts.push({ tag: 'rect', x: margin, y: rc, w: innerW, h: layerH, fill: colours[i], rx: 3, opacity: 0.9 });
    parts.push({ tag: 'rect', x: margin + 16, y: rc + 12, w: labelW - 32, h: 14, fill: '#FFFFFF', rx: 2 });
    parts.push({ tag: 'rect', x: margin + labelW + 24, y: rc + 12, w: Math.round(innerW * 0.5), h: 14, fill: '#FFFFFF', opacity: 0.7, rx: 2 });
    rc += layerH + layerGap;
  }

  return {
    tag: 'svg',
    viewBox: `0 0 ${W} ${H}`,
    xmlns: 'http://www.w3.org/2000/svg',
    children: [
      { tag: 'rect', width: W, height: H, fill: DARK_BASE },
      ...parts
    ]
  };
}

function previewLandscape(palette) {
  const W = 2000; const H = 1414;
  const margin = 100;
  const innerW = W - margin * 2;
  const parts = [];

  // headline bar
  parts.push({ tag: 'rect', x: margin, y: 88, w: innerW, h: 50, fill: DARK_INK, rx: 3 });
  // subheadline bar
  parts.push({ tag: 'rect', x: margin, y: 150, w: innerW * 0.6, h: 14, fill: DARK_INK_DIM, rx: 3 });

  // security layer bars (6 layers, landscape)
  const layerH = 68;
  const layerGap = 10;
  const labelW = Math.round(innerW * 0.22);
  const colours = Object.values(LAYER_COLOURS);
  let rc = 200;

  for (let i = 0; i < 6; i++) {
    parts.push({ tag: 'rect', x: margin, y: rc, w: innerW, h: layerH, fill: colours[i], rx: 3, opacity: 0.9 });
    parts.push({ tag: 'rect', x: margin + 16, y: rc + 12, w: labelW - 32, h: 12, fill: '#FFFFFF', rx: 2 });
    parts.push({ tag: 'rect', x: margin + labelW + 24, y: rc + 12, w: Math.round(innerW * 0.45), h: 12, fill: '#FFFFFF', opacity: 0.7, rx: 2 });
    rc += layerH + layerGap;
  }

  return {
    tag: 'svg',
    viewBox: `0 0 ${W} ${H}`,
    xmlns: 'http://www.w3.org/2000/svg',
    children: [
      { tag: 'rect', width: W, height: H, fill: DARK_BASE },
      ...parts
    ]
  };
}

export default {
  id: 'security-stack',
  name: 'Security stack',
  style: 'infographic',
  description: 'Security tool stack visualization: layered horizontal bars representing security architecture layers (endpoint, network, cloud, data, identity, SIEM). Each layer displays a distinct colour, label, and description on a dark corporate canvas. Clean, structured infographic for security posture overviews, compliance dashboards, and architecture presentations.',
  contentSchema: {
    headline: { required: true, maxWords: 4 },
    subheadline: { required: false, maxWords: 12 },
    callToAction: { required: true, maxWords: 12 },
    blocks: { kind: 'cells', min: 4, max: 6, fields: ['label', 'text'] },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
