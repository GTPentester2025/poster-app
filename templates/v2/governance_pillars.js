// v2 template — governance-pillars (style: tree). Pillar governance model:
// a root concept card feeds connector lines down into 3-5 pillar columns, each
// a condition chip over a full-height outcome card with an index badge and
// large centered outcome text — the columns stretch from the root to the CTA
// bar so the tree fills the whole canvas (SP-B layout-tightening pass).
// Portrait: root top, pillar columns below. Landscape: REAL relayout — root
// card left, pillar columns fanning right. Slate navy + teal connectors.

import {
  textbox, rect, vline, hline, chip,
  backgroundImageSlot,
  fitTextBlock,
  pv, pvRect, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, dotGrid, meshGlow,
  legibilityScrim, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM
} from './decor.js';

const SLATE = '#1A2332';
const TEAL = '#00B4A5';

function ctaBar(o, text, palette, fonts, W, y, h) {
  o.push(rect({ x: 0, y, w: W, h, fill: SLATE, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: TEAL, opacity: 0.4, layerRole: 'decor' }));
  const cta = fitTextBlock(text, { width: W - 200, height: h - 44, maxSize: 44, minSize: 24, lineHeight: 1.2 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((h - cta.height) / 2),
    w: W - 200, fontSize: cta.fontSize, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', lineHeight: 1.2, layerRole: 'cta', bgRef: SLATE
  }));
}

/** Root concept card: headline + subheadline on a raised panel. */
function rootCard(o, content, palette, fonts, { x, y, w, maxSize }) {
  const innerW = w - 72;
  const head = fitTextBlock(content.headline, { width: innerW, height: 260, maxSize, minSize: 44, lineHeight: 1.06 });
  let contentH = head.height;
  let sub = null;
  if (content.subheadline) {
    sub = fitTextBlock(content.subheadline, { width: innerW, height: 110, maxSize: 36, minSize: 18, lineHeight: 1.3 });
    contentH += 18 + sub.height;
  }
  const cardH = Math.round(contentH + 88);
  o.push(rect({ x: x + 6, y: y + 8, w, h: cardH, fill: '#000000', opacity: 0.2, rx: 28, layerRole: 'decor' }));
  o.push(rect({ x, y, w, h: cardH, fill: DARK_PANEL, rx: 28, layerRole: 'background' }));
  o.push(rect({ x, y, w, h: cardH, fill: 'transparent', stroke: TEAL, strokeWidth: 2, rx: 28, opacity: 0.18, layerRole: 'decor' }));
  o.push(rect({ x: x + Math.round(w / 2) - 90, y: y + cardH - 10, w: 180, h: 6, fill: TEAL, rx: 3, opacity: 0.2, layerRole: 'decor' }));
  o.push(textbox({
    text: content.headline, x: x + 36, y: y + 44, w: innerW, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    align: 'center', lineHeight: 1.06, layerRole: 'headline', bgRef: DARK_PANEL
  }));
  if (sub) {
    o.push(textbox({
      text: content.subheadline, x: x + 36, y: Math.round(y + 44 + head.height + 18), w: innerW,
      fontSize: sub.fontSize, fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM,
      align: 'center', lineHeight: 1.3, layerRole: 'subheadline', bgRef: DARK_PANEL
    }));
  }
  return { bottom: y + cardH, midY: y + Math.round(cardH / 2) };
}

/** Measure the tallest condition-chip text across pillars for aligned tops. */
function chipHeights(blocks, palette, fonts, innerW) {
  return blocks.map((b) => {
    const fit = fitTextBlock(b.condition, { width: innerW, height: 150, maxSize: 32, minSize: 16, lineHeight: 1.15 });
    return { fit, h: Math.round(fit.height + 44) };
  });
}

/** One pillar column: condition chip + full-height outcome card. */
function pillarColumn(o, b, i, palette, fonts, { cx, y, w, chipH, chipFit, cardBottom }) {
  const x = Math.round(cx - w / 2);
  const innerW = w - 48;

  // condition chip (teal pill card)
  o.push(rect({ x, y, w, h: chipH, fill: TEAL, rx: 18, layerRole: 'message-label', msgId: b.id }));
  o.push({
    ...textbox({
      text: String(b.condition).toUpperCase(), x: x + 24, y: y + Math.round((chipH - chipFit.height) / 2),
      w: innerW, fontSize: chipFit.fontSize, fontFamily: fonts.head, fontWeight: '800',
      fill: '#FFFFFF', align: 'center', lineHeight: 1.15,
      layerRole: 'message-label', msgId: b.id, bgRef: TEAL
    }),
    fieldRef: 'condition'
  });

  // connector chip → card
  const cardTop = y + chipH + 36;
  o.push(vline({ x: cx - 1, y: y + chipH, h: 36, thickness: 3, fill: TEAL, layerRole: 'decor' }));

  // outcome card fills down to cardBottom
  const cardH = cardBottom - cardTop;
  o.push(rect({ x, y: cardTop, w, h: cardH, fill: DARK_PANEL, rx: 22, opacity: 0.92, layerRole: 'background', msgId: b.id }));
  o.push(rect({ x, y: cardTop, w, h: cardH, fill: 'transparent', stroke: TEAL, strokeWidth: 1.5, rx: 22, opacity: 0.16, layerRole: 'decor' }));
  o.push(rect({ x, y: cardTop + 18, w: 5, h: cardH - 36, fill: TEAL, rx: 2, opacity: 0.6, layerRole: 'decor' }));

  // index badge chip at the card top
  o.push(...chip({
    text: String(i + 1).padStart(2, '0'), x: x + 26, y: cardTop + 28, fontSize: 24,
    bg: TEAL, color: '#FFFFFF', font: fonts.head, msgId: b.id, square: true
  }));
  const badgeBottom = cardTop + 28 + 56;

  // outcome text: large, centered in the remaining card space (biased down so
  // the last text line lands near the CTA)
  const zoneTop = badgeBottom + 20;
  const zoneBottom = cardTop + cardH - 40;
  const fit = fitTextBlock(b.outcome, {
    width: innerW, height: Math.max(80, zoneBottom - zoneTop), maxSize: 54, minSize: 18, lineHeight: 1.3
  });
  const free = Math.max(0, (zoneBottom - zoneTop) - fit.height);
  const textY = Math.round(zoneTop + free * 0.55);
  o.push({
    ...textbox({
      text: b.outcome, x: x + 24, y: textY, w: innerW, fontSize: fit.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
      lineHeight: 1.3, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'outcome'
  });
  // accent tick under the text zone
  o.push(rect({ x: x + 24, y: cardTop + cardH - 26, w: 90, h: 6, fill: TEAL, rx: 3, opacity: 0.5, layerRole: 'decor' }));
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

  const root = rootCard(o, content, palette, fonts, { x: 130, y: 96, w: W - 260, maxSize: 92 });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const colW = (W - 120) / n;
  const centers = blocks.map((_, i) => Math.round(60 + colW * (i + 0.5)));
  const barY = root.bottom + 44;
  const pillarTop = barY + 56;
  const pillW = Math.round(colW - 32);
  const chips = chipHeights(blocks, palette, fonts, pillW - 48);
  const chipH = Math.max(72, ...chips.map((c) => c.h));

  const ctaH = 150;
  const cardBottom = H - ctaH - 48;

  // trunk + distribution bar + drop lines
  o.push(vline({ x: Math.round(W / 2) - 1, y: root.bottom + 4, h: barY - root.bottom - 4, thickness: 3, fill: TEAL, layerRole: 'decor' }));
  if (centers.length > 1) {
    o.push(hline({ x: centers[0], y: barY, w: centers[centers.length - 1] - centers[0], thickness: 3, fill: TEAL, layerRole: 'decor' }));
  }

  blocks.forEach((b, i) => {
    const cx = centers[i];
    o.push(vline({ x: cx, y: barY, h: pillarTop - barY, thickness: 3, fill: TEAL, layerRole: 'decor' }));
    pillarColumn(o, b, i, palette, fonts, {
      cx, y: pillarTop, w: pillW, chipH, chipFit: chips[i].fit, cardBottom
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, H - ctaH, ctaH);
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

  const root = rootCard(o, content, palette, fonts, { x: 60, y: 90, w: 470, maxSize: 64 });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const trunkX = 590;
  const barX = trunkX + 40;
  const pillarSpan = W - barX - 60;
  const colW = pillarSpan / n;
  const pillarTop = 90;
  const pillW = Math.round(colW - 28);
  const chips = chipHeights(blocks, palette, fonts, pillW - 48);
  const chipH = Math.max(64, ...chips.map((c) => c.h));

  const ctaH = 128;
  const cardBottom = H - ctaH - 44;

  o.push(hline({ x: 530, y: root.midY, w: trunkX - 530, thickness: 3, fill: TEAL, layerRole: 'decor' }));
  o.push(vline({ x: trunkX, y: pillarTop + Math.round(chipH / 2), h: root.midY - pillarTop - Math.round(chipH / 2), thickness: 3, fill: TEAL, layerRole: 'decor' }));

  blocks.forEach((b, i) => {
    const cx = Math.round(barX + colW * (i + 0.5));
    o.push(hline({ x: trunkX, y: pillarTop + Math.round(chipH / 2), w: cx - trunkX, thickness: 3, fill: TEAL, layerRole: 'decor' }));
    pillarColumn(o, b, i, palette, fonts, {
      cx, y: pillarTop, w: pillW, chipH, chipFit: chips[i].fit, cardBottom
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, H - ctaH, ctaH);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvRect(0, 0, 200, 3, palette.primary),
    pvRect(pv(130), pv(96), pv(1154), pv(260), DARK_PANEL, { rx: 4 }),
    pvBars({ x: pv(200), y: pv(150), w: pv(1014), lines: 2, barH: 10, gap: 6, fill: DARK_INK, align: 'center' }),
    pvRect(pv(706), pv(356), 1, pv(44), TEAL, { opacity: 0.7 })
  ];
  for (let i = 0; i < 4; i++) {
    const colW = (1414 - 120) / 4;
    const cx = 60 + colW * (i + 0.5);
    const x = cx - (colW - 32) / 2;
    parts.push(pvRect(pv(cx - 1), pv(400), 1, pv(56), TEAL, { opacity: 0.7 }));
    parts.push(pvRect(pv(x), pv(456), pv(colW - 32), pv(110), TEAL, { rx: 3 }));
    parts.push(pvRect(pv(x), pv(600), pv(colW - 32), pv(1200), DARK_PANEL, { rx: 3, stroke: TEAL, opacity: 0.85 }));
    parts.push(pvRect(pv(x + 26), pv(628), pv(56), pv(48), TEAL, { rx: 1.5 }));
    parts.push(pvBars({ x: pv(x + 24), y: pv(1050), w: pv(colW - 80), lines: 4, barH: 5, gap: 4, fill: DARK_INK }));
  }
  parts.push(pvRect(pv(222), pv(400), pv(970), 1, TEAL, { opacity: 0.7 }));
  parts.push(pvRect(0, pv(1850), 200, pv(150), SLATE));
  parts.push(pvBars({ x: pv(300), y: pv(1905), w: pv(814), lines: 1, barH: 6, gap: 4, fill: palette.primary, align: 'center' }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvRect(0, 0, PV_LAND_W, 3, palette.primary),
    pvRect(pv(60), pv(90), pv(470), pv(300), DARK_PANEL, { rx: 3 }),
    pvBars({ x: pv(100), y: pv(170), w: pv(390), lines: 2, barH: 7, gap: 4, fill: DARK_INK, align: 'center' })
  ];
  for (let i = 0; i < 4; i++) {
    const colW = (2000 - 630 - 60) / 4;
    const cx = 630 + colW * (i + 0.5);
    const x = cx - (colW - 28) / 2;
    parts.push(pvRect(pv(590), pv(130), pv(cx - 590), 1, TEAL, { opacity: 0.6 }));
    parts.push(pvRect(pv(x), pv(90), pv(colW - 28), pv(90), TEAL, { rx: 3 }));
    parts.push(pvRect(pv(x), pv(216), pv(colW - 28), pv(1026), DARK_PANEL, { rx: 3, stroke: TEAL, opacity: 0.85 }));
    parts.push(pvBars({ x: pv(x + 22), y: pv(640), w: pv(colW - 72), lines: 4, barH: 5, gap: 4, fill: DARK_INK }));
  }
  parts.push(pvRect(0, pv(1286), PV_LAND_W, pv(128), SLATE));
  parts.push(pvBars({ x: pv(500), y: pv(1330), w: pv(1000), lines: 1, barH: 6, gap: 4, fill: palette.primary, align: 'center' }));
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
