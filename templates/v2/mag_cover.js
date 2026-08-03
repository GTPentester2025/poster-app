// v2 template — mag-cover (style: statement, image-first). Magazine cover:
// a masthead band across the top (the subheadline set small and letterspaced
// as the brand line), a HUGE cover-line headline anchored lower-left over the
// full-bleed background image, the blocks pinned down the right edge as short
// cover lines with accent ticks, and a barcode motif in the CTA strip's
// corner. The photography does the talking — text zones are pinned to the
// edges the way a news-stand cover composes them.

import {
  textbox, rect, backgroundImageSlot,
  fitTextBlock, pickTextColor,
  pv, pvRect, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO, PV_LAND_W, PV_LAND_H,
  legibilityScrim, OVERLAY_TEXT_SHADOW, DARK_BASE, DARK_INK
} from './decor.js';

/** Masthead band: subheadline as the letterspaced brand line. Returns band bottom. */
function masthead(o, content, palette, fonts, W) {
  const on = pickTextColor(palette.primary);
  if (!content.subheadline) {
    o.push(rect({ x: 0, y: 0, w: W, h: 26, fill: palette.primary, layerRole: 'background' }));
    o.push(rect({ x: 0, y: 26, w: W, h: 6, fill: palette.accent, layerRole: 'background' }));
    return 32;
  }
  const textW = W - 260;
  const sub = fitTextBlock(content.subheadline, { width: textW, height: 76, maxSize: 34, minSize: 16, lineHeight: 1.25 });
  const bandH = Math.max(96, Math.round(sub.height) + 48);
  o.push(rect({ x: 0, y: 0, w: W, h: bandH, fill: palette.primary, layerRole: 'background' }));
  o.push(rect({ x: 0, y: bandH, w: W, h: 6, fill: palette.accent, layerRole: 'background' }));
  o.push(textbox({
    text: content.subheadline, x: 130, y: Math.round((bandH - sub.height) / 2), w: textW,
    fontSize: sub.fontSize, fontFamily: fonts.head, fontWeight: '800', fill: on,
    align: 'center', charSpacing: 140, lineHeight: 1.25,
    layerRole: 'subheadline', bgRef: palette.primary
  }));
  return bandH + 6;
}

/** Cover lines pinned down the right edge with accent ticks. */
function coverLines(o, blocks, palette, fonts, { x, w, startY, lineBudget }) {
  let y = startY;
  for (const b of blocks) {
    const fit = fitTextBlock(b.text, { width: w, height: lineBudget, maxSize: 34, minSize: 16, lineHeight: 1.3 });
    o.push(rect({
      x: x - 30, y: y + 4, w: 12, h: Math.max(30, Math.min(56, Math.round(fit.height) - 6)),
      fill: palette.accent, layerRole: 'background', msgId: b.id
    }));
    o.push({
      ...textbox({
        text: b.text, x, y: Math.round(y), w, fontSize: fit.fontSize,
        fontFamily: fonts.body, fontWeight: '700', fill: DARK_INK,
        lineHeight: 1.3, shadow: OVERLAY_TEXT_SHADOW,
        layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
      }),
      fieldRef: 'text'
    });
    y += fit.height + 42;
  }
}

/** Barcode motif: deterministic bar pattern, bottom corner of the CTA strip. */
function barcode(o, { x, y, h, color }) {
  const widths = [4, 10, 5, 4, 12, 6, 4, 9, 5, 11, 4, 6, 10, 4, 7, 5, 9, 4];
  let bx = x;
  for (const bw of widths) {
    o.push(rect({ x: bx, y, w: bw, h, fill: color, layerRole: 'decor' }));
    bx += bw + 6;
  }
}

/** Huge cover-line headline anchored so its BOTTOM sits just above the CTA. */
function coverHeadline(o, content, palette, fonts, { x, w, bottomY, budget }) {
  const head = fitTextBlock(content.headline, { width: w, height: budget, maxSize: 170, minSize: 80, lineHeight: 1.02 });
  o.push(textbox({
    text: content.headline, x, y: Math.round(bottomY - head.height), w,
    fontSize: head.fontSize, fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    lineHeight: 1.02, shadow: OVERLAY_TEXT_SHADOW,
    layerRole: 'headline', bgRef: DARK_BASE
  }));
}

function ctaStrip(o, text, palette, fonts, W, y, h) {
  const on = pickTextColor(palette.accent);
  o.push(rect({ x: 0, y, w: W, h, fill: palette.accent, layerRole: 'background' }));
  const textW = W - 180 - 300;
  const cta = fitTextBlock(text, { width: textW, height: h - 40, maxSize: 44, minSize: 30, lineHeight: 1.16 });
  o.push(textbox({
    text, x: 90, y: y + Math.round((h - cta.height) / 2), w: textW,
    fontSize: cta.fontSize, fontFamily: fonts.head, fontWeight: '800', fill: on,
    layerRole: 'cta', bgRef: palette.accent
  }));
  barcode(o, { x: W - 300, y: y + Math.round(h * 0.2), h: Math.round(h * 0.6), color: on });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dramatic editorial photograph, cinematic light, magazine cover energy, single strong subject, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H, strength: 1 }));

  const bandBottom = masthead(o, content, palette, fonts, W);

  coverLines(o, content.blocks || [], palette, fonts, {
    x: W - 420, w: 340, startY: bandBottom + 84, lineBudget: 200
  });

  const ctaH = 150;
  coverHeadline(o, content, palette, fonts, {
    x: 96, w: 820, bottomY: H - ctaH - 44, budget: 700
  });

  ctaStrip(o, content.callToAction, palette, fonts, W, H - ctaH, ctaH);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dramatic editorial photograph, cinematic light, magazine cover energy, single strong subject, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H, strength: 1 }));

  const bandBottom = masthead(o, content, palette, fonts, W);

  coverLines(o, content.blocks || [], palette, fonts, {
    x: W - 430, w: 350, startY: bandBottom + 64, lineBudget: 180
  });

  const ctaH = 140;
  coverHeadline(o, content, palette, fonts, {
    x: 96, w: 1020, bottomY: H - ctaH - 40, budget: 520
  });

  ctaStrip(o, content.callToAction, palette, fonts, W, H - ctaH, ctaH);
  return canvas;
}

function previewPortrait(palette) {
  const on = pickTextColor(palette.primary);
  const onA = pickTextColor(palette.accent);
  const parts = [
    pvRect(0, 0, 200, pv(110), palette.primary),
    pvRect(0, pv(110), 200, pv(6), palette.accent),
    pvBars({ x: pv(320), y: pv(40), w: pv(774), lines: 1, barH: 5, gap: 3, fill: on, align: 'center' })
  ];
  for (let i = 0; i < 4; i++) {
    const y = 220 + i * 150;
    parts.push(pvRect(pv(1414 - 450), pv(y), pv(12), pv(46), palette.accent));
    parts.push(pvBars({ x: pv(1414 - 420), y: pv(y + 6), w: pv(340), lines: 2, barH: 5, gap: 3, fill: DARK_INK }));
  }
  parts.push(pvBars({ x: pv(96), y: pv(1420), w: pv(820), lines: 3, barH: 14, gap: 8, fill: DARK_INK }));
  parts.push(pvRect(0, pv(1850), 200, pv(150), palette.accent));
  parts.push(pvBars({ x: pv(90), y: pv(1905), w: pv(830), lines: 1, barH: 6, gap: 3, fill: onA }));
  for (let i = 0; i < 9; i++) parts.push(pvRect(pv(1414 - 300 + i * 26), pv(1885), pv(9), pv(84), onA));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const on = pickTextColor(palette.primary);
  const onA = pickTextColor(palette.accent);
  const parts = [
    pvRect(0, 0, PV_LAND_W, pv(100), palette.primary),
    pvRect(0, pv(100), PV_LAND_W, pv(6), palette.accent),
    pvBars({ x: pv(500), y: pv(36), w: pv(1000), lines: 1, barH: 5, gap: 3, fill: on, align: 'center' })
  ];
  for (let i = 0; i < 4; i++) {
    const y = 190 + i * 140;
    parts.push(pvRect(pv(2000 - 460), pv(y), pv(12), pv(44), palette.accent));
    parts.push(pvBars({ x: pv(2000 - 430), y: pv(y + 4), w: pv(350), lines: 2, barH: 5, gap: 3, fill: DARK_INK }));
  }
  parts.push(pvBars({ x: pv(96), y: pv(880), w: pv(1020), lines: 3, barH: 13, gap: 7, fill: DARK_INK }));
  parts.push(pvRect(0, pv(1274), PV_LAND_W, pv(140), palette.accent));
  parts.push(pvBars({ x: pv(90), y: pv(1325), w: pv(1300), lines: 1, barH: 6, gap: 3, fill: onA }));
  for (let i = 0; i < 9; i++) parts.push(pvRect(pv(2000 - 300 + i * 26), pv(1305), pv(9), pv(78), onA));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'mag-cover',
  name: 'Magazine cover',
  style: 'statement',
  description: 'News-stand magazine cover over a full-bleed photograph: a letterspaced masthead band up top, a huge cover-line headline anchored lower-left, short cover lines with accent ticks pinned down the right edge, and a barcode motif in the CTA strip corner.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'cells', min: 3, max: 4, fields: ['text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
