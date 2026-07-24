// v2 template — mag-editorial (style: statement). A magazine-cover editorial
// treatment: the headline runs BOTH as a big horizontal masthead zone AND as
// an oversized side band climbing the left edge — a tall, narrow spine column
// that stacks the headline vertically up the margin (also bound to the
// headline; unrotated so the pptx export contract holds — every v2 template
// Textbox stays axis-aligned). The single statement block is set as a large
// framed pull-quote inset ringed by cornerFrame accents, with a hero image
// slot top-right and a smaller inset slot lower, over a masthead/dateline
// footer band above the CTA. Landscape is a REAL relayout — a split cover:
// headline + statement column on the left ~45%, a full-bleed hero image slot
// filling the right, the inset slot as a corner overlay. One statement block
// {text}, subheadline required, 2 honest image slots, decor = gradient wash +
// light beams + a soft glow.

import {
  textbox, rect, imageSlot,
  fitFontSize, estTextHeight, pickTextColor,
  pv, pvRect, pvBars, pvSlot,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, lightBeams, softGlow, cornerFrame, meshGlow,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM,
  svgWrapO, PV_LAND_W,
  legibilityScrim,
} from './decor.js';

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y: y - 2, w: W, h: 2, fill: palette.primary, opacity: 0.15, layerRole: 'decor' }));
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_BASE, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 180, height: 96, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text, x: 90, y: y + Math.round((144 - estTextHeight(text, size, W - 180)) / 2),
    w: W - 180, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_BASE
  }));
}

/**
 * The oversized side band: the headline stacked vertically up the left margin
 * like a magazine spine. Axis-aligned, never rotated. Bound to the headline
 * (layerRole 'headline' + fieldRef 'sideband'). A faint tinted backing rail
 * gives it presence.
 */
function sideBand(o, content, palette, fonts, { x, y, colW, colH }) {
  // Faint backing rail — dark panel stripe
  o.push(rect({
    x: x - 16, y: y - 20, w: colW + 32, h: colH + 40, fill: DARK_PANEL,
    rx: 16, opacity: 0.08, layerRole: 'decor'
  }));
  // Thin accent edge rule on the right of the spine
  o.push(rect({
    x: x + colW + 14, y: y - 20, w: 3, h: colH + 40,
    fill: palette.primary, rx: 1, opacity: 0.14, layerRole: 'decor'
  }));
  const size = fitFontSize(content.headline, { width: colW, height: colH, maxSize: 92, minSize: 80, lineHeight: 1.05 });
  o.push({
    ...textbox({
      text: content.headline, x, y, w: colW, fontSize: size, lineHeight: 1.05,
      fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align: 'center',
      layerRole: 'headline', bgRef: DARK_BASE
    }),
    fieldRef: 'sideband'
  });
}

/** Horizontal masthead headline zone + the required subheadline dateline. */
function mastheadZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 320, maxSize, minSize: 40 });
  o.push({
    ...textbox({
      text: content.headline, x, y, w, fontSize: headSize, lineHeight: 1.04,
      fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
      layerRole: 'headline', bgRef: DARK_BASE
    }),
    fieldRef: 'masthead'
  });
  let cursor = y + Math.round(estTextHeight(content.headline, headSize, w, 1.04)) + 22;
  // Subheadline is REQUIRED for this template — always placed
  const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 40, minSize: 28, lineHeight: 1.35 });
  o.push(textbox({
    text: content.subheadline, x, y: cursor, w, fontSize: subSize,
    fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
    lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE
  }));
  cursor += Math.round(estTextHeight(content.subheadline, subSize, w, 1.35)) + 20;
  return cursor;
}

/**
 * The framed pull-quote inset: the single statement block set large inside a
 * tinted panel with cornerFrame accents. Text bound to the block via msgId +
 * fieldRef 'text'.
 */
function pullQuote(o, b, palette, fonts, { x, y, w, h, maxSize }) {
  // Glass card panel — DARK_PANEL_2 at low opacity for depth
  o.push(rect({
    x, y, w, h, fill: DARK_PANEL_2, rx: 24, opacity: 0.09,
    layerRole: 'background', msgId: b.id
  }));
  // 1px accent perimeter on the panel
  o.push(rect({
    x, y, w, h, fill: 'transparent', stroke: palette.accent, strokeWidth: 1,
    rx: 24, opacity: 0.14, layerRole: 'decor'
  }));
  // Corner bracket accents (high intensity — these are the accent discipline here)
  o.push(...cornerFrame({ x, y, w, h, color: palette.accent, arm: 88, thickness: 6, intensity: 1 }));

  const pad = 64;
  const innerW = w - pad * 2;
  const size = fitFontSize(b.text, { width: innerW, height: h - pad * 2, maxSize, minSize: 28 });
  const textH = Math.round(estTextHeight(b.text, size, innerW, 1.1));
  o.push({
    ...textbox({
      text: b.text, x: x + pad, y: y + Math.round((h - textH) / 2), w: innerW,
      fontSize: size, lineHeight: 1.1,
      fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
      layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'text'
  });
}

/** The dateline footer band: a slim primary bar with a repeated kicker text. */
function footerBand(o, palette, fonts, { W, y }) {
  o.push(rect({ x: 0, y, w: W, h: 72, fill: palette.primary, opacity: 0.14, layerRole: 'decor' }));
  o.push(rect({ x: 0, y, w: W, h: 72, fill: DARK_PANEL, layerRole: 'background' }));
  // Accent top rule on the band
  o.push(rect({ x: 0, y, w: W, h: 3, fill: palette.primary, opacity: 0.18, layerRole: 'decor' }));
  const label = 'THE EDITORIAL — VERIFY BEFORE YOU TRUST';
  o.push(textbox({
    text: label, x: 88, y: y + 22, w: W - 176, fontSize: 26,
    fontFamily: fonts.head, fontWeight: '800', fill: DARK_INK_DIM,
    align: 'center', charSpacing: 120, lineHeight: 1, layerRole: 'decor'
  }));
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // Decor: wash + tilted light beams + mesh glow behind the pull-quote
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'diagonal', intensity: 0.75 }));
  o.push(...lightBeams({ w: W, h: H, color: palette.primary, count: 3, angle: 22, intensity: 0.6 }));
  o.push(...meshGlow({
    spots: [
      { x: 500, y: 1200, r: 460, color: palette.accent },
      { x: W - 200, y: 300, r: 360, color: palette.primary }
    ],
    intensity: 0.85
  }));

  // Oversized headline spine — narrow stacked column climbing the left edge
  sideBand(o, content, palette, fonts, { x: 68, y: 520, colW: 152, colH: 1200 });

  // Horizontal masthead headline + required subheadline (right of the spine)
  mastheadZone(o, content, palette, fonts, { x: 296, y: 110, w: 784, maxSize: 112 });

  // Hero image slot top-right, smaller inset slot lower
  o.push(imageSlot({
    slotId: 'slot-1', x: 1100, y: 108, w: 226, h: 304,
    styleHint: 'editorial cover hero photo — a person reviewing a suspicious email, flat vector, no text',
    stroke: palette.primary
  }));
  o.push(imageSlot({
    slotId: 'slot-2', x: 1086, y: 1296, w: 240, h: 240,
    styleHint: 'small inset emblem — a magnifying glass over an inbox, flat vector, no text',
    stroke: palette.primary
  }));

  // Framed pull-quote inset
  const b = (content.blocks || [])[0];
  if (b) {
    pullQuote(o, b, palette, fonts, { x: 296, y: 728, w: 784, h: 512, maxSize: 152 });
  }

  // Dateline footer band above the CTA
  footerBand(o, palette, fonts, { W, y: 1760 });

  ctaBar(o, content.callToAction, palette, fonts, W, 1856);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // REAL relayout — split cover: content column left ~45%, full-bleed hero right
  const colW = Math.round(W * 0.45); // ~900

  // Decor: horizontal wash + light beams + glow on the right hero side
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'horizontal', intensity: 0.75 }));
  o.push(...lightBeams({ w: W, h: H, color: palette.primary, count: 3, angle: 20, intensity: 0.55 }));
  o.push(...meshGlow({
    spots: [
      { x: 1490, y: 700, r: 480, color: palette.accent },
      { x: 160, y: 200, r: 320, color: palette.primary }
    ],
    intensity: 0.85
  }));

  // Full-bleed hero image slot filling the right
  o.push(imageSlot({
    slotId: 'slot-1', x: colW + 40, y: 60, w: W - colW - 100, h: 1120,
    styleHint: 'editorial cover hero photo — a person reviewing a suspicious email, flat vector, no text',
    stroke: palette.primary
  }));
  // Inset slot as a corner overlay on the hero
  o.push(imageSlot({
    slotId: 'slot-2', x: W - 316, y: 896, w: 240, h: 240,
    styleHint: 'small inset emblem — a magnifying glass over an inbox, flat vector, no text',
    stroke: palette.primary
  }));

  // Headline spine — narrow stacked column climbing the far-left edge
  sideBand(o, content, palette, fonts, { x: 58, y: 88, colW: 132, colH: 1084 });

  // Masthead headline + required subheadline in the left column (right of spine)
  mastheadZone(o, content, palette, fonts, { x: 256, y: 88, w: colW - 296, maxSize: 92 });

  // Framed pull-quote inset in the lower-left column
  const b = (content.blocks || [])[0];
  if (b) {
    pullQuote(o, b, palette, fonts, { x: 256, y: 556, w: colW - 296, h: 560, maxSize: 132 });
  }

  // Dateline footer band spanning the left column above the CTA
  footerBand(o, palette, fonts, { W, y: 1180 });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

// ── previews ─────────────────────────────────────────────────────────────────

function previewPortrait(palette) {
  const parts = [
    // Spine: faint rail + stacked headline bars up the left margin
    pvRect(pv(52), pv(500), pv(184), pv(1240), DARK_PANEL, { rx: 4, opacity: 0.08 }),
    pvBars({ x: pv(68), y: pv(520), w: pv(152), lines: 6, barH: 11, gap: 8, fill: DARK_INK, align: 'center' }),
    // Masthead headline + dateline
    pvBars({ x: pv(296), y: pv(120), w: pv(784), lines: 2, barH: 9, gap: 5, fill: DARK_INK }),
    pvBars({ x: pv(296), y: pv(340), w: pv(784), lines: 1, barH: 5, gap: 4, fill: DARK_INK_DIM }),
    pvSlot(pv(1100), pv(108), pv(226), pv(304), palette.primary),
    pvSlot(pv(1086), pv(1296), pv(240), pv(240), palette.primary),
    // Pull-quote panel + corner accents
    pvRect(pv(296), pv(728), pv(784), pv(512), DARK_PANEL_2, { rx: 5, opacity: 0.09 }),
    pvRect(pv(296), pv(728), pv(88), pv(6), palette.accent),
    pvRect(pv(296), pv(728), pv(6), pv(88), palette.accent),
    pvRect(pv(296 + 784 - 88), pv(728 + 512 - 6), pv(88), pv(6), palette.accent),
    pvRect(pv(296 + 784 - 6), pv(728 + 512 - 88), pv(6), pv(88), palette.accent),
    pvBars({ x: pv(360), y: pv(844), w: pv(656), lines: 3, barH: 16, gap: 10, fill: DARK_INK }),
    // Footer band
    pvRect(0, pv(1760), 200, pv(72), DARK_PANEL),
    pvRect(0, pv(1856), 200, pv(144), DARK_BASE)
  ];
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const colW = Math.round(2000 * 0.45);
  const parts = [
    pvSlot(pv(colW + 40), pv(60), pv(2000 - colW - 100), pv(1120), palette.primary),
    pvSlot(pv(2000 - 316), pv(896), pv(240), pv(240), palette.primary),
    // Spine: faint rail + stacked headline bars up the far-left margin
    pvRect(pv(42), pv(68), pv(164), pv(1124), DARK_PANEL, { rx: 4, opacity: 0.08 }),
    pvBars({ x: pv(58), y: pv(88), w: pv(132), lines: 6, barH: 10, gap: 7, fill: DARK_INK, align: 'center' }),
    // Masthead headline + dateline (right of spine)
    pvBars({ x: pv(256), y: pv(100), w: pv(colW - 296), lines: 2, barH: 9, gap: 5, fill: DARK_INK }),
    pvBars({ x: pv(256), y: pv(320), w: pv(colW - 296), lines: 1, barH: 5, gap: 4, fill: DARK_INK_DIM }),
    // Pull-quote panel + corner accents
    pvRect(pv(256), pv(556), pv(colW - 296), pv(560), DARK_PANEL_2, { rx: 5, opacity: 0.09 }),
    pvRect(pv(256), pv(556), pv(88), pv(6), palette.accent),
    pvRect(pv(256), pv(556), pv(6), pv(88), palette.accent),
    pvBars({ x: pv(320), y: pv(672), w: pv(colW - 424), lines: 3, barH: 14, gap: 9, fill: DARK_INK }),
    // Footer band
    pvRect(0, pv(1180), PV_LAND_W, pv(72), DARK_PANEL),
    pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_BASE)
  ];
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'mag-editorial',
  name: 'Magazine cover editorial',
  style: 'statement',
  description: 'A magazine-cover editorial: the headline runs as both a horizontal masthead and an oversized spine stacked up the left edge, with the single statement set as a framed pull-quote inset, a hero image and a smaller inset, over a dateline footer band. A split cover in landscape — content column left, a full-bleed hero right with the inset as a corner overlay.',
  contentSchema: {
    headline: { required: true, maxWords: 6 },
    subheadline: { required: true, maxWords: 14 },
    blocks: { kind: 'single', min: 1, max: 1, fields: ['text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 2
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
