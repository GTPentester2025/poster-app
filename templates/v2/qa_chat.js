// v2 template — qa-chat (style: qa). Chat-bubble Q&A: question bubbles
// right-aligned in the brand primary, answer bubbles left on white with an
// accent border bar. Portrait stacks the conversation; landscape splits it
// into two columns. 3–4 qa-pairs blocks {question, answer}, no image slot,
// decor = soft glows + ripple wave arcs.
//
// 2026 redesign: elevated bubble panels with richer depth, refined soft-glow
// atmosphere, improved typographic weight contrast, generous padding.

import {
  textbox, rect, pickTextColor,
  backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, softGlow, signalArcs, meshGlow, svgWrapO, PV_LAND_W,
  legibilityScrim
} from './decor.js';

const BUBBLE_PAD_V = 28;   // vertical text inset inside a bubble
const BUBBLE_PAD_H = 52;   // horizontal text inset
const BUBBLE_R = 28;        // bubble corner radius
const GAP = 24;             // question→answer gap inside a pair

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 152, fill: palette.dark, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 200, height: 100, maxSize: 46, minSize: 30 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((152 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: palette.dark
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 300, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark,
    lineHeight: 1.06,
    layerRole: 'headline', bgRef: palette.background
  }));
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 40, minSize: 28, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: y + estTextHeight(content.headline, headSize, w, 1.06) + 28,
      w, fontSize: subSize, fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.35,
      layerRole: 'subheadline', bgRef: palette.background
    }));
  }
}

/**
 * One Q&A pair: right-aligned question bubble (primary fill) + left-aligned
 * answer bubble (white, accent border bar). Returns the y just below the
 * answer bubble. Every text object binds msgId=blk-N + fieldRef.
 */
function qaPair(o, b, palette, fonts, { areaX, areaW, y, budgetH }) {
  const bubW = Math.round(areaW * 0.88);
  const textW = bubW - BUBBLE_PAD_H * 2;

  // question — right aligned, brand primary
  const qX = areaX + areaW - bubW;
  const qSize = fitFontSize(b.question, { width: textW, height: Math.max(90, budgetH * 0.38), maxSize: 44, minSize: 38 });
  const qBubH = Math.round(estTextHeight(b.question, qSize, textW, 1.38)) + BUBBLE_PAD_V * 2;
  // question bubble with soft shadow feel via a slightly darker behind-rect
  o.push(rect({ x: qX + 4, y: y + 4, w: bubW, h: qBubH, fill: palette.dark, rx: BUBBLE_R,
    opacity: 0.08, layerRole: 'background', msgId: b.id }));
  o.push(rect({ x: qX, y, w: bubW, h: qBubH, fill: palette.primary, rx: BUBBLE_R,
    layerRole: 'background', msgId: b.id }));
  // tail nub
  o.push(rect({ x: qX + bubW - 52, y: y + qBubH - 5, w: 32, h: 20, fill: palette.primary,
    rx: 5, skewX: -32, layerRole: 'decor' }));

  o.push({
    ...textbox({
      text: b.question, x: qX + BUBBLE_PAD_H, y: y + BUBBLE_PAD_V, w: textW, fontSize: qSize,
      fontFamily: fonts.body, fontWeight: '700', fill: pickTextColor(palette.primary),
      lineHeight: 1.38,
      layerRole: 'message', msgId: b.id, bgRef: palette.primary
    }),
    fieldRef: 'question'
  });

  // answer — left aligned, near-white with accent border bar
  const aY = y + qBubH + GAP;
  const aSize = fitFontSize(b.answer, {
    width: textW, height: Math.max(84, budgetH - qBubH - GAP - 24), maxSize: 42, minSize: 38
  });
  const aBubH = Math.round(estTextHeight(b.answer, aSize, textW, 1.38)) + BUBBLE_PAD_V * 2;
  o.push(rect({ x: areaX + 4, y: aY + 4, w: bubW, h: aBubH, fill: palette.dark, rx: BUBBLE_R,
    opacity: 0.06, layerRole: 'background', msgId: b.id }));
  o.push(rect({
    x: areaX, y: aY, w: bubW, h: aBubH, fill: '#FFFFFF', rx: BUBBLE_R,
    stroke: palette.accent, strokeWidth: 2, layerRole: 'background', msgId: b.id
  }));
  // left accent bar
  o.push(rect({ x: areaX, y: aY + 12, w: 8, h: aBubH - 24, fill: palette.accent, rx: 4, layerRole: 'decor' }));
  // tail nub
  o.push(rect({ x: areaX + 20, y: aY + aBubH - 5, w: 32, h: 20, fill: '#FFFFFF',
    rx: 5, skewX: 32, stroke: palette.accent, strokeWidth: 2, layerRole: 'decor' }));

  o.push({
    ...textbox({
      text: b.answer, x: areaX + BUBBLE_PAD_H, y: aY + BUBBLE_PAD_V, w: textW, fontSize: aSize,
      fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.38,
      layerRole: 'message', msgId: b.id, bgRef: '#FFFFFF'
    }),
    fieldRef: 'answer'
  });

  return aY + aBubH;
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.background);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // decor: mesh glows + ripple waves
  o.push(...meshGlow({ spots: [
    { x: 1220, y: 300, r: 380, color: palette.primary },
    { x: 180, y: 1600, r: 340, color: palette.accent }
  ], intensity: 0.85 }));
  o.push(...signalArcs({ x: 1414, y: 2000, r: 500, rings: 4, color: palette.primary, strokeWidth: 10, intensity: 0.8 }));

  headlineZone(o, content, palette, fonts, { x: 96, y: 104, w: 1160, maxSize: 112 });

  const blocks = content.blocks || [];
  const top = 540;
  const bottom = 1832;
  const pairH = (bottom - top) / Math.max(blocks.length, 1);
  blocks.forEach((b, i) => {
    qaPair(o, b, palette, fonts, {
      areaX: 96, areaW: W - 192, y: Math.round(top + i * pairH), budgetH: pairH - 24
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1848);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.background);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({ spots: [
    { x: 1760, y: 240, r: 360, color: palette.primary },
    { x: 240, y: 1200, r: 320, color: palette.accent }
  ], intensity: 0.85 }));
  o.push(...signalArcs({ x: 0, y: 1414, r: 460, rings: 4, color: palette.primary, strokeWidth: 10, intensity: 0.8 }));

  headlineZone(o, content, palette, fonts, { x: 96, y: 88, w: 1440, maxSize: 104 });

  // two-column conversation: first half of the pairs left, rest right
  const blocks = content.blocks || [];
  const leftCount = Math.ceil(blocks.length / 2);
  const cols = [
    { x: 96, blocks: blocks.slice(0, leftCount) },
    { x: 1060, blocks: blocks.slice(leftCount) }
  ];
  const top = 512;
  const bottom = 1232;
  for (const col of cols) {
    const pairH = (bottom - top) / Math.max(col.blocks.length, 1);
    col.blocks.forEach((b, i) => {
      qaPair(o, b, palette, fonts, {
        areaX: col.x, areaW: 904, y: Math.round(top + i * pairH), budgetH: pairH - 24
      });
    });
  }

  ctaBar(o, content.callToAction, palette, fonts, W, 1262);
  return canvas;
}

function pvPair(parts, palette, { areaX, areaW, y }) {
  const bubW = Math.round(areaW * 0.88);
  const onPrimary = pickTextColor(palette.primary);
  parts.push(pvRect(pv(areaX + areaW - bubW), pv(y), pv(bubW), pv(128), palette.primary, { rx: 5 }));
  parts.push(pvBars({ x: pv(areaX + areaW - bubW + 52), y: pv(y + 32), w: pv(bubW - 104), lines: 1, barH: 5, gap: 3, fill: onPrimary }));
  parts.push(pvRect(pv(areaX), pv(y + 148), pv(bubW), pv(128), '#FFFFFF', { rx: 5, stroke: palette.accent }));
  parts.push(pvRect(pv(areaX), pv(y + 148), 1.6, pv(128), palette.accent, { rx: 0.8 }));
  parts.push(pvBars({ x: pv(areaX + 52), y: pv(y + 180), w: pv(bubW - 104), lines: 1, barH: 5, gap: 3, fill: palette.dark }));
}

function previewPortrait(palette) {
  const parts = [
    pvCircle(pv(1220), pv(300), pv(380), palette.primary, { opacity: 0.08 }),
    pvCircle(pv(180), pv(1600), pv(340), palette.accent, { opacity: 0.07 }),
    pvBars({ x: pv(96), y: pv(116), w: pv(1160), lines: 2, barH: 8, gap: 5, fill: palette.dark })
  ];
  for (let i = 0; i < 4; i++) pvPair(parts, palette, { areaX: 96, areaW: 1222, y: 545 + i * 323 });
  parts.push(pvRect(0, pv(1848), 200, pv(152), palette.dark));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvCircle(pv(1760), pv(240), pv(360), palette.primary, { opacity: 0.08 }),
    pvCircle(pv(240), pv(1200), pv(320), palette.accent, { opacity: 0.07 }),
    pvBars({ x: pv(96), y: pv(100), w: pv(1440), lines: 2, barH: 8, gap: 5, fill: palette.dark })
  ];
  for (const x of [96, 1060]) {
    pvPair(parts, palette, { areaX: x, areaW: 904, y: 520 });
    pvPair(parts, palette, { areaX: x, areaW: 904, y: 892 });
  }
  parts.push(pvRect(0, pv(1262), PV_LAND_W, pv(152), palette.dark));
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'qa-chat',
  name: 'Q&A chat',
  style: 'qa',
  description: 'Chat-style question and answer bubbles — questions right in the brand color, answers left with an accent border. Stacked in portrait, two columns in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'qa-pairs', min: 3, max: 4, fields: ['question', 'answer'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
