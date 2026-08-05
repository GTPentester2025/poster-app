// v2 template — security-stack (style: infographic). Security tool stack
// visualization: horizontal layered bars representing security layers (endpoint,
// network, cloud, data, identity, SIEM). Each layer is a large rounded colour
// card with an index numeral, bold label column and description column, sized
// so the stack fills the full vertical budget between the hero header and the
// pinned CTA bar (SP-B layout-tightening pass: no dead bands, measured y-flow).
// Portrait: hero header, full-width stacked layer cards, CTA bar at bottom.
// Landscape: REAL relayout — same stack with a wider description column.

import {
  textbox, rect, chip, backgroundImageSlot,
  fitTextBlock, estTextHeight,
  pv, pvRect, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, legibilityScrim, svgWrapO, PV_LAND_W,
  dotGrid, gradientWash,
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

// ── one security layer card: rounded colour slab, index, label + description ──
function layerCard(o, block, i, layerColour, fonts, { x, y, w, h, labelW }) {
  // soft shadow + rounded colour slab
  o.push(rect({ x: x + 6, y: y + 8, w, h, fill: '#000000', opacity: 0.18, rx: 28, layerRole: 'decor' }));
  o.push(rect({ x, y, w, h, fill: layerColour, opacity: 0.94, rx: 28, layerRole: 'background', msgId: block.id }));
  // thin inner outline for a modern card edge
  o.push(rect({ x: x + 3, y: y + 3, w: w - 6, h: h - 6, fill: 'transparent', stroke: '#FFFFFF', strokeWidth: 2, rx: 25, opacity: 0.18, layerRole: 'decor' }));

  const padX = 44;
  // index numeral (ghosted, oversized) on the far left
  const num = String(i + 1).padStart(2, '0');
  const numFit = fitTextBlock(num, { width: 130, height: Math.max(60, h - 40), maxSize: Math.min(110, h - 36), minSize: 40, lineHeight: 1 });
  o.push({
    ...textbox({
      text: num, x: x + padX - 12, y: Math.round(y + (h - numFit.height) / 2), w: 130,
      fontSize: numFit.fontSize, fontFamily: fonts.head, fontWeight: '900',
      fill: '#FFFFFF', lineHeight: 1, layerRole: 'decor'
    }),
    opacity: 0.35
  });

  // label column (bold white)
  const labelX = x + padX + 120;
  const labelFit = fitTextBlock(block.label, { width: labelW, height: h - 48, maxSize: 52, minSize: 18, lineHeight: 1.1 });
  o.push({
    ...textbox({
      text: block.label, x: labelX, y: Math.round(y + (h - labelFit.height) / 2),
      w: labelW, fontSize: labelFit.fontSize, fontFamily: fonts.head, fontWeight: '800',
      fill: '#FFFFFF', lineHeight: 1.1, layerRole: 'message-label', msgId: block.id, bgRef: layerColour
    }),
    fieldRef: 'label'
  });

  // vertical divider tick between label and description
  const descX = labelX + labelW + 36;
  o.push(rect({ x: descX - 20, y: y + Math.round(h * 0.22), w: 4, h: Math.round(h * 0.56), fill: '#FFFFFF', rx: 2, opacity: 0.35, layerRole: 'decor' }));

  // description column
  const descW = x + w - descX - padX;
  const descFit = fitTextBlock(block.text, { width: descW, height: h - 44, maxSize: 36, minSize: 16, lineHeight: 1.3 });
  o.push({
    ...textbox({
      text: block.text, x: descX, y: Math.round(y + (h - descFit.height) / 2),
      w: descW, fontSize: descFit.fontSize, fontFamily: fonts.body, fontWeight: '500',
      fill: '#FFFFFF', lineHeight: 1.3, layerRole: 'message', msgId: block.id, bgRef: layerColour
    }),
    fieldRef: 'text'
  });
}

// ── hero header: eyebrow chip + big headline + subheadline; returns bottom y ──
function hero(o, content, palette, fonts, { x, y, w, headMax, headBudget }) {
  o.push(...chip({
    text: 'DEFENSE IN DEPTH', x, y, fontSize: 26,
    bg: palette.primary, color: DARK_BASE, font: fonts.head
  }));
  let cursor = y + 78;
  const head = fitTextBlock(content.headline, { width: w, height: headBudget, maxSize: headMax, minSize: 48, lineHeight: 1.04 });
  o.push(textbox({
    text: content.headline, x, y: cursor, w, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    lineHeight: 1.04, layerRole: 'headline', bgRef: DARK_BASE
  }));
  cursor += head.height;
  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, { width: w, height: 100, maxSize: 34, minSize: 18, lineHeight: 1.3 });
    o.push(textbox({
      text: content.subheadline, x, y: Math.round(cursor + 20), w, fontSize: sub.fontSize,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM,
      lineHeight: 1.3, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += 20 + sub.height;
  }
  // accent underline tick
  o.push(rect({ x, y: Math.round(cursor + 22), w: 180, h: 8, fill: palette.primary, rx: 4, layerRole: 'decor' }));
  return Math.round(cursor + 30);
}

function ctaBar(o, text, palette, fonts, { W, y, h }) {
  o.push(rect({ x: 0, y, w: W, h, fill: '#17161F', layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: palette.primary, opacity: 0.5, layerRole: 'decor' }));
  const cta = fitTextBlock(text, { width: W - 240, height: h - 44, maxSize: 44, minSize: 24, lineHeight: 1.2 });
  o.push(textbox({
    text, x: 120, y: Math.round(y + (h - cta.height) / 2), w: W - 240,
    fontSize: cta.fontSize, fontFamily: fonts.head, fontWeight: '800',
    fill: DARK_INK, align: 'center', lineHeight: 1.2, layerRole: 'cta', bgRef: '#17161F'
  }));
}

// ── portrait ──────────────────────────────────────────────────────────────────
function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark security operations center, technology infrastructure, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: DARK_BASE, direction: 'diagonal', intensity: 0.5 }));
  o.push(...dotGrid({ x: W - 300, y: 90, cols: 4, rows: 6, gap: 52, dotR: 4, color: DARK_INK, intensity: 0.6 }));

  const margin = 90;
  const innerW = W - margin * 2;

  const heroBottom = hero(o, content, palette, fonts, {
    x: margin, y: 96, w: innerW, headMax: 118, headBudget: 320
  });

  // security layer stack fills the space between hero and CTA
  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const ctaH = 150;
  const stackTop = heroBottom + 44;
  const stackBottom = H - ctaH - 44;
  const gap = 22;
  const cardH = Math.floor((stackBottom - stackTop - gap * (n - 1)) / n);
  const labelW = Math.round(innerW * 0.26);

  blocks.forEach((b, i) => {
    const layerColour = LAYER_COLOURS[LAYER_ORDER[i % LAYER_ORDER.length]];
    layerCard(o, b, i, layerColour, fonts, {
      x: margin, y: stackTop + i * (cardH + gap), w: innerW, h: cardH, labelW
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, { W, y: H - ctaH, h: ctaH });
  return canvas;
}

// ── landscape ─────────────────────────────────────────────────────────────────
function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark security operations center, technology infrastructure, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: DARK_BASE, direction: 'horizontal', intensity: 0.5 }));
  o.push(...dotGrid({ x: W - 320, y: 70, cols: 5, rows: 4, gap: 52, dotR: 4, color: DARK_INK, intensity: 0.6 }));

  const margin = 100;
  const innerW = W - margin * 2;

  const heroBottom = hero(o, content, palette, fonts, {
    x: margin, y: 76, w: innerW, headMax: 92, headBudget: 210
  });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const ctaH = 130;
  const stackTop = heroBottom + 36;
  const stackBottom = H - ctaH - 36;
  const gap = 18;
  const cardH = Math.floor((stackBottom - stackTop - gap * (n - 1)) / n);
  const labelW = Math.round(innerW * 0.22);

  blocks.forEach((b, i) => {
    const layerColour = LAYER_COLOURS[LAYER_ORDER[i % LAYER_ORDER.length]];
    layerCard(o, b, i, layerColour, fonts, {
      x: margin, y: stackTop + i * (cardH + gap), w: innerW, h: cardH, labelW
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, { W, y: H - ctaH, h: ctaH });
  return canvas;
}

// ── previews (pv-scaled SVG strings, bars standing in for text) ───────────────
function previewPortrait(palette) {
  const margin = 90;
  const innerW = 1414 - margin * 2;
  const parts = [
    pvRect(pv(margin), pv(96), pv(330), pv(48), palette.primary, { rx: 4 }),
    pvBars({ x: pv(margin), y: pv(190), w: pv(innerW), lines: 2, barH: 15, gap: 8, fill: DARK_INK }),
    pvBars({ x: pv(margin), y: pv(430), w: pv(innerW * 0.7), lines: 1, barH: 6, gap: 4, fill: DARK_INK_DIM }),
    pvRect(pv(margin), pv(492), pv(180), pv(8), palette.primary, { rx: 1 })
  ];
  const colours = Object.values(LAYER_COLOURS);
  const stackTop = 550, stackBottom = 1806, gap = 22, n = 4;
  const cardH = Math.floor((stackBottom - stackTop - gap * (n - 1)) / n);
  for (let i = 0; i < n; i++) {
    const y = stackTop + i * (cardH + gap);
    parts.push(pvRect(pv(margin), pv(y), pv(innerW), pv(cardH), colours[i], { rx: 4, opacity: 0.94 }));
    parts.push(pvBars({ x: pv(margin + 160), y: pv(y + cardH / 2 - 24), w: pv(300), lines: 1, barH: 9, gap: 4, fill: '#FFFFFF' }));
    parts.push(pvBars({ x: pv(margin + 560), y: pv(y + cardH / 2 - 40), w: pv(innerW - 620), lines: 2, barH: 6, gap: 4, fill: '#FFFFFF' }));
  }
  parts.push(pvRect(0, pv(1850), 200, pv(150), '#17161F'));
  parts.push(pvBars({ x: pv(300), y: pv(1908), w: pv(814), lines: 1, barH: 7, gap: 4, fill: DARK_INK, align: 'center' }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const margin = 100;
  const innerW = 2000 - margin * 2;
  const parts = [
    pvRect(pv(margin), pv(76), pv(300), pv(44), palette.primary, { rx: 4 }),
    pvBars({ x: pv(margin), y: pv(160), w: pv(innerW * 0.8), lines: 1, barH: 13, gap: 6, fill: DARK_INK }),
    pvRect(pv(margin), pv(330), pv(180), pv(8), palette.primary, { rx: 1 })
  ];
  const colours = Object.values(LAYER_COLOURS);
  const stackTop = 380, stackBottom = 1248, gap = 18, n = 4;
  const cardH = Math.floor((stackTop === 0 ? 0 : stackBottom - stackTop - gap * (n - 1)) / n);
  for (let i = 0; i < n; i++) {
    const y = stackTop + i * (cardH + gap);
    parts.push(pvRect(pv(margin), pv(y), pv(innerW), pv(cardH), colours[i], { rx: 4, opacity: 0.94 }));
    parts.push(pvBars({ x: pv(margin + 160), y: pv(y + cardH / 2 - 18), w: pv(280), lines: 1, barH: 8, gap: 4, fill: '#FFFFFF' }));
    parts.push(pvBars({ x: pv(margin + 540), y: pv(y + cardH / 2 - 26), w: pv(innerW - 600), lines: 2, barH: 5, gap: 3, fill: '#FFFFFF' }));
  }
  parts.push(pvRect(0, pv(1284), PV_LAND_W, pv(130), '#17161F'));
  parts.push(pvBars({ x: pv(500), y: pv(1332), w: pv(1000), lines: 1, barH: 6, gap: 4, fill: DARK_INK, align: 'center' }));
  return svgWrapO(parts, DARK_BASE, 'landscape');
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
