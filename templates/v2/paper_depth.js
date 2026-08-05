// v2 template — paper-depth (style: scenario). Layered paper-cut depth on a
// LIGHT canvas: the headline rides the top white sheet, then each scenario
// step is its own wide sheet with a soft shadow and a colored edge strip
// peeking out from underneath (offset rect behind), the stack progressively
// indenting so it reads as physical depth. Portrait: vertical sheet stack;
// landscape: REAL relayout — headline sheet + CTA left, indented sheet stack
// right. Sheet copy is measured (fitTextBlock) inside fixed slots so stress
// content shrinks type instead of colliding.

import {
  textbox, rect, backgroundImageSlot,
  fitTextBlock, pickTextColor,
  pv, pvRect, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO,
  legibilityScrim
} from './decor.js';

const SHEET_R = 26;       // sheet corner radius
const SHEET_PAD = 40;     // content sheet inner padding
const HEAD_PAD = 56;      // headline sheet inner padding
const BG_HINT = 'soft paper texture, warm light, subtle layered paper craft shadows, minimal, no text';

/** Paper sheet: soft shadow + colored edge strip peeking bottom-left + white sheet. */
function sheet(o, palette, { x, y, w, h, stripColor, msgId = null }) {
  o.push(rect({ x: x + 12, y: y + 18, w, h, fill: palette.dark, opacity: 0.12, rx: SHEET_R, layerRole: 'background', ...(msgId ? { msgId } : {}) }));
  o.push(rect({ x: x - 14, y: y + 14, w, h, fill: stripColor, rx: SHEET_R, layerRole: 'background', ...(msgId ? { msgId } : {}) }));
  o.push(rect({ x, y, w, h, fill: '#FFFFFF', rx: SHEET_R, layerRole: 'background', ...(msgId ? { msgId } : {}) }));
}

/** One content sheet (label + text), centred in its slot. */
function contentSheet(o, b, i, palette, fonts, { x, y, w, h }) {
  const innerW = w - SHEET_PAD * 2;
  const labelFit = b.label
    ? fitTextBlock(b.label, { width: innerW, height: 44, maxSize: 28, minSize: 14, lineHeight: 1.15 })
    : null;
  const labelSpace = labelFit ? Math.round(labelFit.height) + 12 : 0;
  const textFit = fitTextBlock(b.text, {
    width: innerW, height: Math.max(44, h - SHEET_PAD * 2 - labelSpace), maxSize: 34, minSize: 14, lineHeight: 1.3
  });
  const sheetH = Math.max(128, Math.min(h, Math.round(SHEET_PAD * 2 + labelSpace + textFit.height)));
  const top = Math.round(y + (h - sheetH) / 2);
  const stripColor = i % 2 === 0 ? palette.primary : palette.accent;

  sheet(o, palette, { x, y: top, w, h: sheetH, stripColor, msgId: b.id });

  let cursor = top + SHEET_PAD;
  if (labelFit) {
    o.push({
      ...textbox({
        text: b.label, x: x + SHEET_PAD, y: cursor, w: innerW, fontSize: labelFit.fontSize,
        fontFamily: fonts.head, fontWeight: '800', fill: stripColor, charSpacing: 60,
        lineHeight: 1.15, layerRole: 'message-label', msgId: b.id, bgRef: '#FFFFFF'
      }),
      fieldRef: 'label'
    });
    cursor += labelSpace;
  }
  o.push({
    ...textbox({
      text: b.text, x: x + SHEET_PAD, y: cursor, w: innerW, fontSize: textFit.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.3, layerRole: 'message', msgId: b.id, bgRef: '#FFFFFF'
    }),
    fieldRef: 'text'
  });
}

/** Headline sheet: measured headline + subheadline on the top sheet; returns bottom y. */
function headlineSheet(o, content, palette, fonts, { x, y, w, headBudget, headMax }) {
  const innerW = w - HEAD_PAD * 2;
  const head = fitTextBlock(content.headline, { width: innerW, height: headBudget, maxSize: headMax, minSize: 46, lineHeight: 1.05 });
  let innerH = head.height;
  let sub = null;
  if (content.subheadline) {
    sub = fitTextBlock(content.subheadline, { width: innerW, height: 130, maxSize: 34, minSize: 16, lineHeight: 1.3 });
    innerH += 18 + sub.height;
  }
  const sheetH = Math.round(HEAD_PAD * 2 + innerH);
  sheet(o, palette, { x, y, w, h: sheetH, stripColor: palette.primary });
  o.push(textbox({
    text: content.headline, x: x + HEAD_PAD, y: y + HEAD_PAD, w: innerW, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark,
    lineHeight: 1.05, layerRole: 'headline', bgRef: '#FFFFFF'
  }));
  if (sub) {
    o.push(textbox({
      text: content.subheadline, x: x + HEAD_PAD, y: Math.round(y + HEAD_PAD + head.height + 18), w: innerW,
      fontSize: sub.fontSize, fontFamily: fonts.body, fontWeight: '600', fill: palette.primary,
      lineHeight: 1.3, layerRole: 'subheadline', bgRef: '#FFFFFF'
    }));
  }
  return y + sheetH;
}

/** Dark capsule CTA anchored above bottomY; returns its top y. */
function ctaCapsule(o, text, palette, fonts, { cx, w, bottomY }) {
  const innerW = w - 120;
  const fit = fitTextBlock(text, { width: innerW, height: 110, maxSize: 38, minSize: 20, lineHeight: 1.2 });
  const pillH = Math.round(fit.height + 52);
  const y = Math.round(bottomY - pillH);
  const x = Math.round(cx - w / 2);
  o.push(rect({ x, y, w, h: pillH, fill: palette.dark, rx: Math.min(Math.round(pillH / 2), 58), layerRole: 'background' }));
  o.push(textbox({
    text, x: x + 60, y: Math.round(y + (pillH - fit.height) / 2), w: innerW,
    fontSize: fit.fontSize, fontFamily: fonts.head, fontWeight: '800',
    fill: pickTextColor(palette.dark), align: 'center', lineHeight: 1.2,
    layerRole: 'cta', bgRef: palette.dark
  }));
  return y;
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.background);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  // LIGHT scrim: paper-cut stack reads dark-on-paper — wash a filled
  // background image back toward the paper tone instead of darkening it.
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  const M = 100;
  const sheetW = W - M * 2;
  const headBottom = headlineSheet(o, content, palette, fonts, { x: M, y: 100, w: sheetW, headBudget: 260, headMax: 104 });

  const ctaTop = ctaCapsule(o, content.callToAction, palette, fonts, { cx: W / 2, w: 1030, bottomY: H - 56 });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const top = headBottom + 40;
  const bottom = ctaTop - 52;
  const slotH = (bottom - top) / n;
  blocks.forEach((b, i) => {
    const indent = (i + 1) * 40; // progressive indent = depth
    contentSheet(o, b, i, palette, fonts, {
      x: M + indent, y: Math.round(top + slotH * i + 12), w: sheetW - indent, h: Math.round(slotH - 24)
    });
  });
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.background);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  // left: headline sheet + CTA
  const M = 96;
  const colW = 760;
  headlineSheet(o, content, palette, fonts, { x: M, y: 96, w: colW, headBudget: 320, headMax: 92 });
  ctaCapsule(o, content.callToAction, palette, fonts, { cx: M + colW / 2, w: colW, bottomY: H - 64 });

  // right: the indented sheet stack (right edge pinned, left edge stepping in)
  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const x0 = 920;
  const w0 = W - x0 - M;
  const top = 96;
  const bottom = H - 96;
  const slotH = (bottom - top) / n;
  blocks.forEach((b, i) => {
    const indent = i * 36;
    contentSheet(o, b, i, palette, fonts, {
      x: x0 + indent, y: Math.round(top + slotH * i + 12), w: w0 - indent, h: Math.round(slotH - 24)
    });
  });
  return canvas;
}

function pvSheet(parts, palette, i, { x, y, w, h }) {
  const strip = i % 2 === 0 ? palette.primary : palette.accent;
  parts.push(pvRect(pv(x - 14), pv(y + 14), pv(w), pv(h), strip, { rx: 4 }));
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), '#FFFFFF', { rx: 4 }));
  parts.push(pvBars({ x: pv(x + 40), y: pv(y + 44), w: pv(w - 80), lines: 2, barH: 5, gap: 4, fill: '#1F1A17' }));
}

function previewPortrait(palette) {
  const parts = [
    pvRect(pv(86), pv(114), pv(1214), pv(430), palette.primary, { rx: 4 }),
    pvRect(pv(100), pv(100), pv(1214), pv(430), '#FFFFFF', { rx: 4 }),
    pvBars({ x: pv(156), y: pv(160), w: pv(1102), lines: 2, barH: 12, gap: 6, fill: palette.dark })
  ];
  for (let i = 0; i < 4; i++) {
    pvSheet(parts, palette, i, { x: 140 + (i + 1) * 40, y: 622 + i * 288, w: 1174 - (i + 1) * 40 - 40, h: 240 });
  }
  parts.push(pvRect(pv(192), pv(1830), pv(1030), pv(114), palette.dark, { rx: 8 }));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvRect(pv(82), pv(110), pv(760), pv(500), palette.primary, { rx: 4 }),
    pvRect(pv(96), pv(96), pv(760), pv(500), '#FFFFFF', { rx: 4 }),
    pvBars({ x: pv(152), y: pv(152), w: pv(648), lines: 3, barH: 11, gap: 6, fill: palette.dark }),
    pvRect(pv(96), pv(1190), pv(760), pv(110), palette.dark, { rx: 8 })
  ];
  for (let i = 0; i < 4; i++) {
    pvSheet(parts, palette, i, { x: 934 + i * 36, y: 118 + i * 305, w: 970 - i * 36, h: 250 });
  }
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'paper-depth',
  name: 'Paper depth',
  style: 'scenario',
  description: 'Layered paper-cut stack on a light canvas: the headline rides the top white sheet and each step is its own wide sheet with a soft shadow and a colored edge strip peeking from underneath, the stack progressively indenting to read as depth. Vertical stack in portrait; headline sheet + CTA beside an indented stack in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'sequence', min: 3, max: 4, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
