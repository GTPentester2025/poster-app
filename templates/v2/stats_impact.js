// v2 template — stats-impact (style: stats). Big-number impact board: 3–4
// huge numeric figures (all ≥120px) with captions; the FIRST block is the
// hero — set far larger with a soft glow bloom behind it. Portrait: hero
// figure center stage, supporting figures in a row below. Landscape: all
// figures in one row with the hero taking a 1.5x column. One honest image
// slot, decor = soft glow behind the hero + diagonal light beams.

import {
  textbox, rect, imageSlot, vline,
  fitFontSize, fitTextBlock, estTextHeight,
  pv, pvRect, pvCircle, pvBars, pvSlot,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, softGlow, lightBeams, meshGlow,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM,
  svgWrapO, PV_LAND_W,
  legibilityScrim,
} from './decor.js';

function ctaBar(o, text, palette, fonts, W, y) {
  // Hairline separator above the CTA band
  o.push(rect({ x: 0, y: y - 2, w: W, h: 2, fill: palette.primary, opacity: 0.15, layerRole: 'decor' }));
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_BASE, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 180, height: 96, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text, x: 90, y: y + Math.round((144 - estTextHeight(text, size, W - 180)) / 2),
    w: W - 180, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_BASE
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 300, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    lineHeight: 1.06, layerRole: 'headline', bgRef: DARK_BASE
  }));
  if (content.subheadline) {
    const subY = y + Math.round(estTextHeight(content.headline, headSize, w, 1.06)) + 24;
    const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 40, minSize: 28, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: subY, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
  }
}

/**
 * Hairline divider between supporting stat columns.
 */
function divider(o, x, y, h, palette) {
  o.push(rect({ x: x - 1, y, w: 2, h, fill: palette.primary, opacity: 0.12, layerRole: 'decor' }));
}

/**
 * One stat: giant figure (fieldRef 'figure') + caption (fieldRef 'caption'),
 * both centered in a column. Returns the figure's font size.
 * hero = whether this is the lead/hero stat (accent colour, larger text).
 */
function statBlock(o, b, palette, fonts, { x, y, w, figureMax, figureBudget, captionBudget, accent = false }) {
  // Floor at 16 so a worst-case long figure string can shrink enough to stay in
  // its cell (stressed content sets 'figure' to a long label, not a short number).
  const fig = fitTextBlock(b.figure, { width: w, height: figureBudget, maxSize: figureMax, minSize: 16, lineHeight: 1.04 });
  const figSize = fig.fontSize;
  // Thin accent underline below the figure — placed at the ACTUAL wrapped height.
  const figH = Math.round(fig.height);
  o.push({
    ...textbox({
      text: b.figure, x, y, w, fontSize: figSize, fontFamily: fonts.head,
      fontWeight: '900', fill: accent ? palette.accent : DARK_INK,
      align: 'center', lineHeight: 1.04, layerRole: 'message', msgId: b.id,
      bgRef: DARK_BASE
    }),
    fieldRef: 'figure'
  });
  const ruleY = y + figH + 16;
  const ruleW = Math.round(w * (accent ? 0.36 : 0.24));
  o.push(rect({
    x: Math.round(x + (w - ruleW) / 2), y: ruleY, w: ruleW, h: accent ? 4 : 2,
    fill: palette.accent, rx: 2, opacity: accent ? 0.18 : 0.12, layerRole: 'decor'
  }));
  const capY = ruleY + (accent ? 24 : 16);
  const capSize = fitFontSize(b.caption, { width: w, height: captionBudget, maxSize: accent ? 46 : 40, minSize: 16 });
  o.push({
    ...textbox({
      text: b.caption, x, y: capY, w, fontSize: capSize, fontFamily: fonts.body,
      fontWeight: '600', fill: DARK_INK_DIM, align: 'center',
      layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'caption'
  });
  return figSize;
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // Atmospheric depth: two mesh-glow blooms + diagonal light beams
  o.push(...meshGlow({
    spots: [
      { x: W * 0.55, y: 840, r: 500, color: palette.primary },
      { x: 120, y: H - 300, r: 360, color: palette.accent }
    ],
    intensity: 0.9
  }));
  o.push(...lightBeams({ w: W, h: H, color: palette.primary, count: 3, angle: 24, intensity: 0.6 }));

  headlineZone(o, content, palette, fonts, { x: 88, y: 100, w: 980, maxSize: 108 });

  o.push(imageSlot({
    slotId: 'slot-1', x: 1100, y: 96, w: 224, h: 224,
    styleHint: 'bold abstract data or impact emblem, flat vector, no text', stroke: palette.primary
  }));

  const blocks = content.blocks || [];
  const [hero, ...rest] = blocks;

  if (hero) {
    o.push(...softGlow({ x: Math.round(W / 2), y: 820, r: 420, color: palette.primary, intensity: 1 }));
    // Hero stat panel — a subtle dark card behind the figure
    o.push(rect({ x: 88, y: 560, w: W - 176, h: 540, fill: DARK_PANEL, rx: 24, opacity: 0.08, layerRole: 'decor' }));
    statBlock(o, hero, palette, fonts, {
      x: 88, y: 590, w: W - 176, figureMax: 310, figureBudget: 380, captionBudget: 140, accent: true
    });
  }

  const n = Math.max(rest.length, 1);
  const colW = (W - 176) / n;
  rest.forEach((b, i) => {
    const x = Math.round(88 + i * colW);
    if (i > 0) divider(o, x, 1210, 420, palette);
    statBlock(o, b, palette, fonts, {
      x: x + 24, y: 1240, w: Math.round(colW - 48),
      figureMax: 176, figureBudget: 280, captionBudget: 200
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1856);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({
    spots: [
      { x: W * 0.3, y: H * 0.55, r: 440, color: palette.primary },
      { x: W - 200, y: 200, r: 360, color: palette.accent }
    ],
    intensity: 0.9
  }));
  o.push(...lightBeams({ w: W, h: H, color: palette.primary, count: 3, angle: 20, intensity: 0.6 }));

  headlineZone(o, content, palette, fonts, { x: 88, y: 80, w: 1380, maxSize: 100 });

  o.push(imageSlot({
    slotId: 'slot-1', x: 1660, y: 88, w: 252, h: 252,
    styleHint: 'bold abstract data or impact emblem, flat vector, no text', stroke: palette.primary
  }));

  // One row of figures: hero column 1.5x the width of the others
  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const unit = (W - 176) / (n + 0.5);
  const heroW = Math.round(unit * 1.5);

  let x = 88;
  blocks.forEach((b, i) => {
    const colW = i === 0 ? heroW : Math.round(unit);
    if (i === 0) {
      o.push(...softGlow({ x: Math.round(x + colW / 2), y: 840, r: 360, color: palette.primary, intensity: 1 }));
      o.push(rect({ x: x, y: 560, w: colW, h: 520, fill: DARK_PANEL, rx: 24, opacity: 0.08, layerRole: 'decor' }));
      statBlock(o, b, palette, fonts, {
        x: x + 24, y: 590, w: colW - 48, figureMax: 270, figureBudget: 400, captionBudget: 160, accent: true
      });
    } else {
      divider(o, x, 620, 480, palette);
      statBlock(o, b, palette, fonts, {
        x: x + 24, y: 660, w: colW - 48, figureMax: 160, figureBudget: 280, captionBudget: 200
      });
    }
    x += colW;
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvCircle(pv(707), pv(820), pv(420), palette.primary, { opacity: 0.08 }),
    pvBars({ x: pv(88), y: pv(110), w: pv(980), lines: 2, barH: 8, gap: 5, fill: DARK_INK }),
    pvSlot(pv(1100), pv(96), pv(224), pv(224), palette.primary),
    pvRect(pv(260), pv(590), pv(894), pv(190), palette.accent, { rx: 6, opacity: 0.9 }),
    pvBars({ x: pv(380), y: pv(980), w: pv(654), lines: 1, barH: 5, gap: 3, fill: DARK_INK_DIM, align: 'center' })
  ];
  for (let i = 0; i < 3; i++) {
    const x = 88 + i * ((1414 - 176) / 3);
    parts.push(pvRect(pv(x + 60), pv(1270), pv(200), pv(110), DARK_INK, { rx: 4 }));
    parts.push(pvBars({ x: pv(x + 24), y: pv(1540), w: pv(280), lines: 2, barH: 4, gap: 3, fill: DARK_INK_DIM, align: 'center' }));
  }
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_BASE));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const heroW = Math.round((2000 - 176) / 3.5);
  const parts = [
    pvCircle(pv(88 + heroW / 2), pv(840), pv(360), palette.primary, { opacity: 0.08 }),
    pvBars({ x: pv(88), y: pv(95), w: pv(1380), lines: 2, barH: 8, gap: 5, fill: DARK_INK }),
    pvSlot(pv(1660), pv(88), pv(252), pv(252), palette.primary),
    pvRect(pv(110), pv(590), pv(heroW - 48), pv(200), palette.accent, { rx: 6, opacity: 0.9 }),
    pvBars({ x: pv(130), y: pv(990), w: pv(heroW - 90), lines: 1, barH: 5, gap: 3, fill: DARK_INK_DIM, align: 'center' })
  ];
  for (let i = 0; i < 3; i++) {
    const x = 88 + heroW + i * Math.round((2000 - 176) / 3.5);
    parts.push(pvRect(pv(x + 60), pv(700), pv(180), pv(100), DARK_INK, { rx: 4 }));
    parts.push(pvBars({ x: pv(x + 24), y: pv(960), w: pv(240), lines: 2, barH: 4, gap: 3, fill: DARK_INK_DIM, align: 'center' }));
  }
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_BASE));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'stats-impact',
  name: 'Impact numbers',
  style: 'stats',
  description: 'A big-number impact board: the lead figure dominates the poster with a soft glow behind it, supporting figures line up beneath. Hero-on-top in portrait, a single row with a 1.5x hero column in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'stats', min: 3, max: 4, fields: ['figure', 'caption'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
