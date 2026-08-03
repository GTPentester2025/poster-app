// v2 template — governance-pillars (style: tree). Three-pillar governance
// model with connected nodes branching from a central root concept. Portrait:
// root card at top, three pillars below with connector lines and sub-nodes.
// Landscape: root left, three pillars fanning right. Slate navy palette with
// teal accent connectors. 3-5 branches blocks {condition, outcome}.

import {
  textbox, rect, vline, hline, circle,
  backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, dotGrid, meshGlow,
  legibilityScrim, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM
} from './decor.js';

const SLATE = '#1A2332';
const TEAL = '#00B4A5';

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 128, fill: SLATE, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 3, fill: TEAL, opacity: 0.2, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 200, height: 88, maxSize: 42, minSize: 26 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((128 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: SLATE
  }));
}

function rootCard(o, content, palette, fonts, { x, y, w, maxSize }) {
  const headSize = fitFontSize(content.headline, { width: w - 64, height: 240, maxSize, minSize: 40 });
  const cardH = Math.round(estTextHeight(content.headline, headSize, w - 64)) + 72;
  o.push(rect({ x, y, w, h: cardH, fill: DARK_PANEL, rx: 24, layerRole: 'background' }));
  o.push(rect({
    x, y, w, h: cardH, fill: 'transparent', stroke: TEAL, strokeWidth: 2, rx: 24,
    opacity: 0.15, layerRole: 'decor'
  }));
  o.push(rect({ x: x + 20, y: y + 1, w: w - 40, h: 3, fill: TEAL, rx: 2, opacity: 0.18, layerRole: 'decor' }));
  o.push(textbox({
    text: content.headline, x: x + 32, y: y + 36, w: w - 64, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    align: 'center', lineHeight: 1.06, layerRole: 'headline', bgRef: DARK_PANEL
  }));
  return { bottom: y + cardH, midY: y + Math.round(cardH / 2) };
}

function pillarNode(o, b, i, palette, fonts, { cx, y, w, h, subY, subGap }) {
  // pillar label card
  const conditionSize = fitFontSize(b.condition, { width: w - 48, height: 48, maxSize: 32, minSize: 18 });
  o.push(rect({
    x: Math.round(cx - w / 2), y, w, h, fill: TEAL, rx: 12,
    layerRole: 'message-label', msgId: b.id
  }));
  o.push({
    ...textbox({
      text: String(b.condition).toUpperCase(), x: Math.round(cx - w / 2) + 24, y: y + Math.round((h - estTextHeight(b.condition, conditionSize, w - 48, 1.1)) / 2),
      w: w - 48, fontSize: conditionSize, fontFamily: fonts.head, fontWeight: '800',
      fill: '#FFFFFF', align: 'center', lineHeight: 1.1,
      layerRole: 'message-label', msgId: b.id, bgRef: TEAL
    }),
    fieldRef: 'condition'
  });

  // sub-node card for outcome
  const subCardW = w - 16;
  const outcomeSize = fitFontSize(b.outcome, { width: subCardW - 48, height: 120, maxSize: 36, minSize: 18 });
  const subCardH = Math.round(estTextHeight(b.outcome, outcomeSize, subCardW - 48, 1.3)) + 48;

  o.push(rect({
    x: Math.round(cx - subCardW / 2), y: subY, w: subCardW, h: subCardH, fill: DARK_PANEL, rx: 14,
    stroke: TEAL, strokeWidth: 1, opacity: 0.08, layerRole: 'background', msgId: b.id
  }));
  o.push(rect({
    x: Math.round(cx - subCardW / 2), y: subY, w: subCardW, h: subCardH, fill: 'transparent', stroke: TEAL, strokeWidth: 1, rx: 14,
    opacity: 0.12, layerRole: 'background', msgId: b.id
  }));
  o.push(rect({
    x: Math.round(cx - subCardW / 2), y: subY + 14, w: 4, h: subCardH - 28,
    fill: TEAL, rx: 2, layerRole: 'decor'
  }));

  o.push({
    ...textbox({
      text: b.outcome, x: Math.round(cx - subCardW / 2) + 24, y: subY + 24, w: subCardW - 48, fontSize: outcomeSize,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK,
      lineHeight: 1.3, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'outcome'
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark corporate governance backdrop, subtle geometric pattern, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  o.push(...gradientWash({ w: W, h: H, from: TEAL, to: SLATE, direction: 'diagonal', intensity: 0.6 }));
  o.push(...meshGlow({ spots: [
    { x: Math.round(W * 0.5), y: 300, r: 400, color: TEAL },
    { x: Math.round(W * 0.5), y: 1600, r: 360, color: palette.primary }
  ], intensity: 0.7 }));
  o.push(...dotGrid({ x: 80, y: 40, cols: 3, rows: 5, gap: 56, dotR: 4, color: TEAL, intensity: 0.5 }));

  const root = rootCard(o, content, palette, fonts, { x: 160, y: 104, w: W - 320, maxSize: 72 });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const colW = (W - 120) / n;
  const centers = blocks.map((_, i) => Math.round(60 + colW * (i + 0.5)));
  const barY = root.bottom + 56;
  const pillarTop = barY + 80;
  const pillarH = 56;
  const subTop = pillarTop + pillarH + 48;

  // trunk
  o.push(vline({ x: Math.round(W / 2) - 1, y: root.bottom + 4, h: barY - root.bottom - 4, thickness: 3, fill: TEAL, layerRole: 'decor' }));
  // distribution bar
  if (centers.length > 1) {
    o.push(hline({
      x: centers[0], y: barY, w: centers[centers.length - 1] - centers[0], thickness: 3, fill: TEAL, layerRole: 'decor'
    }));
  }

  blocks.forEach((b, i) => {
    const cx = centers[i];
    o.push(vline({ x: cx, y: barY, h: pillarTop - barY, thickness: 3, fill: TEAL, layerRole: 'decor' }));
    pillarNode(o, b, i, palette, fonts, {
      cx, y: pillarTop, w: colW - 40, h: pillarH,
      subY: subTop, subGap: 48
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1872);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark corporate governance backdrop, subtle geometric pattern, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  o.push(...gradientWash({ w: W, h: H, from: TEAL, to: SLATE, direction: 'horizontal', intensity: 0.6 }));
  o.push(...meshGlow({ spots: [
    { x: 200, y: Math.round(H / 2), r: 360, color: TEAL },
    { x: W - 200, y: Math.round(H / 2), r: 340, color: palette.primary }
  ], intensity: 0.7 }));

  const root = rootCard(o, content, palette, fonts, { x: 60, y: 80, w: 420, maxSize: 56 });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const trunkX = 560;
  const barX = trunkX + 48;
  const pillarW = Math.round((W - barX - 60) / n);
  const pillarTop = 80;
  const pillarH = 48;

  o.push(hline({ x: 480, y: root.midY, w: trunkX - 480, thickness: 3, fill: TEAL, layerRole: 'decor' }));
  o.push(vline({ x: trunkX, y: pillarTop + pillarH / 2, h: root.midY - pillarTop - pillarH / 2, thickness: 3, fill: TEAL, layerRole: 'decor' }));

  blocks.forEach((b, i) => {
    const cx = Math.round(barX + pillarW * i + pillarW / 2);
    o.push(hline({ x: trunkX, y: pillarTop + pillarH / 2, w: cx - trunkX, thickness: 3, fill: TEAL, layerRole: 'decor' }));
    const subTop = pillarTop + pillarH + 48;
    pillarNode(o, b, i, palette, fonts, {
      cx, y: pillarTop, w: pillarW - 20, h: pillarH,
      subY: subTop, subGap: 48
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1286);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvRect(pv(160), pv(104), pv(1094), pv(200), DARK_PANEL, { rx: 4 }),
    pvBars({ x: pv(220), y: pv(180), w: pv(974), lines: 2, barH: 7, gap: 4, fill: DARK_INK, align: 'center' }),
    pvRect(pv(706), pv(304), 1, pv(56), TEAL, { opacity: 0.7 })
  ];
  for (let i = 0; i < 3; i++) {
    const cx = 60 + (1414 - 120) / 3 * (i + 0.5);
    parts.push(pvRect(pv(cx - 1), pv(360), 1, pv(80), TEAL, { opacity: 0.7 }));
    parts.push(pvRect(pv(cx - 90), pv(440), pv(180), pv(30), TEAL, { rx: 3 }));
    parts.push(pvRect(pv(cx - 100), pv(518), pv(200), pv(240), DARK_PANEL, { rx: 2, stroke: TEAL, opacity: 0.5 }));
    parts.push(pvBars({ x: pv(cx - 80), y: pv(560), w: pv(160), lines: 3, barH: 3, gap: 2, fill: DARK_INK }));
  }
  parts.push(pvRect(pv(295), pv(360), pv(824), 1, TEAL, { opacity: 0.7 }));
  parts.push(pvRect(0, pv(1872), 200, pv(128), SLATE));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvRect(pv(60), pv(80), pv(420), pv(280), DARK_PANEL, { rx: 3 }),
    pvBars({ x: pv(100), y: pv(180), w: pv(340), lines: 2, barH: 6, gap: 4, fill: DARK_INK, align: 'center' })
  ];
  for (let i = 0; i < 3; i++) {
    const cx = 608 + (2000 - 668) / 3 * (i + 0.5);
    parts.push(pvRect(pv(560), pv(104), pv(cx - 560), 1, TEAL, { opacity: 0.6 }));
    parts.push(pvRect(pv(cx - 80), pv(80), pv(160), pv(28), TEAL, { rx: 3 }));
    parts.push(pvRect(pv(cx - 90), pv(156), pv(180), pv(220), DARK_PANEL, { rx: 2, stroke: TEAL, opacity: 0.5 }));
    parts.push(pvBars({ x: pv(cx - 70), y: pv(190), w: pv(140), lines: 3, barH: 3, gap: 2, fill: DARK_INK }));
  }
  parts.push(pvRect(0, pv(1286), PV_LAND_W, pv(128), SLATE));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'governance-pillars',
  name: 'Governance pillars',
  style: 'tree',
  description: 'Three-pillar governance model with connected nodes branching from a central root concept. Teal accent connectors link pillar labels to sub-node outcome cards on a dark slate navy canvas. Portrait fans upward-to-downward; landscape fans left-to-right. Ideal for governance frameworks and compliance models.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'branches', min: 3, max: 5, fields: ['condition', 'outcome'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
