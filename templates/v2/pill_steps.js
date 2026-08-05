// v2 template — pill-steps (style: timeline). Modern app-onboarding steps on
// a LIGHT canvas: every step is a full-width capsule pill (rx = height/2)
// alternating solid-primary / outlined-white, with a numbered circle sunk into
// the left end and a thin-outline arrow chip at the right end; three connector
// dots bridge the pills. Portrait: headline over a stacked pill run;
// landscape: REAL relayout — headline + CTA column left, pill run right. Pill
// text is measured (fitTextBlock) inside fixed slots so stress content
// shrinks type instead of colliding.

import {
  textbox, rect, circle, polygon, backgroundImageSlot,
  fitTextBlock, pickTextColor,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO,
  legibilityScrim
} from './decor.js';

const NUM_R = 44;         // numbered circle radius
const TEXT_X = 150;       // pill left inset (number circle zone)
const ARROW_ZONE = 130;   // pill right inset (arrow chip zone)
const PAD_V = 32;         // vertical text inset inside a pill
const BG_HINT = 'soft light abstract gradient waves, pastel minimal backdrop, generous negative space, no text';

/** One capsule step pill: number circle left, label+text middle, arrow right. */
function stepPill(o, b, i, palette, fonts, { x, y, w, h }) {
  const solid = i % 2 === 0;
  const textW = w - TEXT_X - ARROW_ZONE;
  const labelFit = b.label
    ? fitTextBlock(b.label, { width: textW, height: 46, maxSize: 30, minSize: 14, lineHeight: 1.15 })
    : null;
  const labelSpace = labelFit ? Math.round(labelFit.height) + 10 : 0;
  const textFit = fitTextBlock(b.text, {
    width: textW, height: Math.max(44, h - PAD_V * 2 - labelSpace), maxSize: 32, minSize: 14, lineHeight: 1.3
  });
  const pillH = Math.max(132, Math.min(h, Math.round(PAD_V * 2 + labelSpace + textFit.height)));
  const top = Math.round(y + (h - pillH) / 2);
  const rx = Math.round(pillH / 2);
  const fill = solid ? palette.primary : '#FFFFFF';
  const ink = solid ? pickTextColor(palette.primary) : palette.dark;

  // soft shadow + capsule
  o.push(rect({ x: x + 6, y: top + 8, w, h: pillH, fill: palette.dark, opacity: 0.12, rx, layerRole: 'background', msgId: b.id }));
  o.push(rect({
    x, y: top, w, h: pillH, fill, rx,
    stroke: solid ? null : palette.accent, strokeWidth: solid ? 0 : 2,
    layerRole: 'background', msgId: b.id
  }));

  // numbered circle at the left end
  const cy = top + Math.round(pillH / 2);
  o.push(circle({ x: x + 78, y: cy, r: NUM_R, fill: solid ? '#FFFFFF' : palette.accent, layerRole: 'decor' }));
  o.push(textbox({
    text: String(i + 1), x: x + 78 - NUM_R, y: cy - 28, w: NUM_R * 2, fontSize: 44,
    fontFamily: fonts.head, fontWeight: '900',
    fill: solid ? palette.primary : pickTextColor(palette.accent),
    align: 'center', lineHeight: 1.1, layerRole: 'decor'
  }));

  // thin-outline arrow chip at the right end
  const ax = x + w - 74;
  o.push(circle({ x: ax, y: cy, r: 30, fill: 'transparent', stroke: ink, strokeWidth: 2, layerRole: 'decor' }));
  o.push(polygon(
    [{ x: ax - 6, y: cy - 12 }, { x: ax + 10, y: cy }, { x: ax - 6, y: cy + 12 }],
    { fill: ink, layerRole: 'decor' }
  ));

  let cursorY = top + Math.round((pillH - (labelSpace + textFit.height)) / 2);
  if (labelFit) {
    o.push({
      ...textbox({
        text: b.label, x: x + TEXT_X, y: cursorY, w: textW, fontSize: labelFit.fontSize,
        fontFamily: fonts.head, fontWeight: '800', fill: ink, charSpacing: 60,
        lineHeight: 1.15, layerRole: 'message-label', msgId: b.id, bgRef: fill
      }),
      fieldRef: 'label'
    });
    cursorY += labelSpace;
  }
  o.push({
    ...textbox({
      text: b.text, x: x + TEXT_X, y: cursorY, w: textW, fontSize: textFit.fontSize,
      fontFamily: fonts.body, fontWeight: '600', fill: ink,
      lineHeight: 1.3, layerRole: 'message', msgId: b.id, bgRef: fill
    }),
    fieldRef: 'text'
  });
}

/** Three connector dots centred on a slot boundary. */
function connectorDots(o, palette, cx, yb) {
  for (const dy of [-14, 0, 14]) {
    o.push(circle({ x: cx, y: yb + dy, r: 4, fill: palette.accent, opacity: 0.7, layerRole: 'decor' }));
  }
}

/** Measured headline (+ optional subheadline); returns the y below them. */
function headlineZone(o, content, palette, fonts, { x, y, w, headBudget, headMax }) {
  const head = fitTextBlock(content.headline, { width: w, height: headBudget, maxSize: headMax, minSize: 48, lineHeight: 1.05 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark,
    lineHeight: 1.05, layerRole: 'headline', bgRef: palette.background
  }));
  let cursor = y + head.height;
  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, { width: w, height: 130, maxSize: 36, minSize: 16, lineHeight: 1.3 });
    o.push(textbox({
      text: content.subheadline, x, y: Math.round(cursor + 22), w,
      fontSize: sub.fontSize, fontFamily: fonts.body, fontWeight: '600', fill: palette.primary,
      lineHeight: 1.3, layerRole: 'subheadline', bgRef: palette.background
    }));
    cursor += 22 + sub.height;
  }
  return Math.round(cursor);
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
  // LIGHT scrim: this design reads dark-on-paper — wash a filled background
  // image back toward the paper tone instead of darkening it.
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  const M = 96;
  const cursor = headlineZone(o, content, palette, fonts, { x: M, y: 110, w: W - M * 2, headBudget: 300, headMax: 116 });

  const ctaTop = ctaCapsule(o, content.callToAction, palette, fonts, { cx: W / 2, w: 1060, bottomY: H - 56 });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const top = Math.max(cursor + 48, 560);
  const bottom = ctaTop - 44;
  const slotH = (bottom - top) / n;
  blocks.forEach((b, i) => {
    stepPill(o, b, i, palette, fonts, {
      x: M, y: Math.round(top + slotH * i + 10), w: W - M * 2, h: Math.round(slotH - 20)
    });
    if (i > 0) connectorDots(o, palette, Math.round(W / 2), Math.round(top + slotH * i));
  });
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.background);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: BG_HINT, stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H, color: palette.background }));

  // left column: headline + CTA
  const M = 90;
  const colW = 560;
  headlineZone(o, content, palette, fonts, { x: M, y: 120, w: colW, headBudget: 400, headMax: 96 });
  ctaCapsule(o, content.callToAction, palette, fonts, { cx: M + colW / 2, w: colW, bottomY: H - 90 });

  // right: the pill run
  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const x0 = 730;
  const pillW = W - x0 - 96;
  const top = 110;
  const bottom = H - 100;
  const slotH = (bottom - top) / n;
  blocks.forEach((b, i) => {
    stepPill(o, b, i, palette, fonts, {
      x: x0, y: Math.round(top + slotH * i + 10), w: pillW, h: Math.round(slotH - 20)
    });
    if (i > 0) connectorDots(o, palette, Math.round(x0 + pillW / 2), Math.round(top + slotH * i));
  });
  return canvas;
}

function pvPill(parts, palette, i, { x, y, w, h }) {
  const solid = i % 2 === 0;
  const fill = solid ? palette.primary : '#FFFFFF';
  const ink = solid ? pickTextColor(palette.primary) : palette.dark;
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), fill, { rx: pv(h) / 2, stroke: solid ? null : palette.accent }));
  parts.push(pvCircle(pv(x + 78), pv(y + h / 2), pv(44), solid ? '#FFFFFF' : palette.accent));
  parts.push(pvBars({ x: pv(x + 150), y: pv(y + h / 2 - 30), w: pv(w - 300), lines: 2, barH: 5, gap: 4, fill: ink }));
  parts.push(pvCircle(pv(x + w - 74), pv(y + h / 2), pv(30), 'none', { stroke: ink }));
}

function previewPortrait(palette) {
  const parts = [
    pvBars({ x: pv(96), y: pv(122), w: pv(1222), lines: 2, barH: 12, gap: 6, fill: palette.dark })
  ];
  for (let i = 0; i < 4; i++) {
    pvPill(parts, palette, i, { x: 96, y: 585 + i * 300, w: 1222, h: 240 });
    if (i > 0) parts.push(pvCircle(pv(707), pv(575 + i * 300), 1.4, palette.accent));
  }
  parts.push(pvRect(pv(177), pv(1838), pv(1060), pv(106), palette.dark, { rx: 7 }));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvBars({ x: pv(90), y: pv(132), w: pv(560), lines: 3, barH: 10, gap: 6, fill: palette.dark }),
    pvRect(pv(90), pv(1190), pv(560), pv(104), palette.dark, { rx: 7 })
  ];
  for (let i = 0; i < 4; i++) {
    pvPill(parts, palette, i, { x: 730, y: 125 + i * 301, w: 1174, h: 240 });
    if (i > 0) parts.push(pvCircle(pv(1317), pv(115 + i * 301), 1.4, palette.accent));
  }
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'pill-steps',
  name: 'Pill steps',
  style: 'timeline',
  description: 'App-onboarding capsule steps on a light canvas: each step is a full-width pill alternating solid brand color and outlined white, with a numbered circle at the left end, a thin-outline arrow chip at the right, and connector dots between pills. Stacked run under the headline in portrait; headline + CTA column with the pill run beside it in landscape.',
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
