// v2 template — comic-reveal (style: comic). A three-beat story arc —
// setup → mistake → lesson — where the final "reveal" panel is emphasized at
// roughly twice the size of the first two. Speech-bubble headings (primary
// pill + tail) carry the moment; captions sit below. Every panel has an
// honest image slot. Portrait: two small panels over one large reveal;
// landscape: a filmstrip row with an enlarged last frame.
//
// 2026 redesign: deep near-black canvas (DARK_BASE), DARK_PANEL frosted
// surfaces with 1px primary hairlines, off-white DARK_INK text, accent-
// bubble headings, mesh-glow atmosphere. No tilt (no rotated Rect).

import {
  textbox, rect, imageSlot,
  fitFontSize, estTextHeight, pickTextColor,
  pv, pvRect, pvBars, pvSlot,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, lightBeams, meshGlow,
  svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM,
  legibilityScrim,
} from './decor.js';

const FRAME_R = 24;
const BUBBLE_R = 20;
const BUBBLE_PAD = 20;

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_PANEL, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: palette.accent, opacity: 0.18, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 176, height: 96, maxSize: 46, minSize: 30 });
  o.push(textbox({
    text, x: 88, y: y + Math.round((144 - estTextHeight(text, size, W - 176)) / 2),
    w: W - 176, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 300, maxSize, minSize: 40 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    lineHeight: 1.06, layerRole: 'headline', bgRef: DARK_BASE
  }));
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 40, minSize: 28, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x,
      y: y + estTextHeight(content.headline, headSize, w, 1.06) + 20,
      w, fontSize: subSize, fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM,
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
  }
}

/**
 * Speech-bubble heading (primary pill + tail) with caption below.
 * Both texts bind msgId + fieldRef.
 */
function bubbleAndCaption(o, b, palette, fonts, { x, w, y, budgetH, headMax }) {
  const headW = w - 56;
  const headSize = fitFontSize(b.heading, { width: headW, height: 130, maxSize: headMax, minSize: 20 });
  const bubH = Math.round(estTextHeight(b.heading, headSize, headW, 1.08)) + BUBBLE_PAD * 2;
  // speech bubble pill
  o.push(rect({ x, y, w, h: bubH, fill: palette.primary, rx: BUBBLE_R, layerRole: 'background', msgId: b.id }));
  // bubble tail — small rounded rect, no rotation
  o.push(rect({ x: x + 40, y: y + bubH - 2, w: 28, h: 18, fill: palette.primary, rx: 5, layerRole: 'decor' }));
  o.push({
    ...textbox({
      text: b.heading, x: x + 28, y: y + BUBBLE_PAD, w: headW, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '900', fill: pickTextColor(palette.primary),
      lineHeight: 1.08, layerRole: 'message', msgId: b.id, bgRef: palette.primary
    }),
    fieldRef: 'heading'
  });

  const capY = y + bubH + 24;
  const capH = Math.max(48, budgetH - (capY - y));
  const size = fitFontSize(b.text, {
    width: w, height: capH,
    maxSize: Math.min(46, headSize - 2), minSize: 20
  });
  o.push({
    ...textbox({
      text: b.text, x, y: capY, w, fontSize: size,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM,
      lineHeight: 1.4, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'text'
  });
}

/** Frosted DARK_PANEL card frame with optional accent stroke for reveal. */
function frame(o, b, palette, { x, y, w, h, emphasized = false }) {
  // one rect carries fill + hairline stroke + msgId (the panel-frame contract:
  // a stroked background rect per panel, accent for the reveal)
  o.push(rect({
    x, y, w, h, fill: DARK_PANEL, rx: FRAME_R,
    stroke: emphasized ? palette.accent : palette.primary,
    strokeWidth: emphasized ? 3 : 2,
    shadow: { color: 'rgba(0,0,0,0.55)', blur: 34, offsetX: 0, offsetY: 16 },
    layerRole: 'background', msgId: b.id
  }));
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // decor: diagonal wash + light beams sweeping toward the reveal + mesh glow
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'diagonal', intensity: 0.6 }));
  o.push(...lightBeams({ w: W, h: H, color: palette.primary, count: 3, angle: 22, intensity: 0.7 }));
  o.push(...meshGlow({
    spots: [
      { x: 180, y: 500, r: 360, color: palette.primary },
      { x: W - 160, y: 1400, r: 440, color: palette.accent }
    ],
    intensity: 0.9
  }));

  headlineZone(o, content, palette, fonts, { x: 88, y: 96, w: 1238, maxSize: 108 });

  const blocks = content.blocks || [];
  const small = blocks.slice(0, blocks.length - 1);
  const last = blocks[blocks.length - 1];

  // small setup/mistake panels side by side
  const smallY = 490;
  const smallH = 560;
  const smallW = 580;
  small.forEach((b, i) => {
    const x = 88 + i * (smallW + 56);
    frame(o, b, palette, { x, y: smallY, w: smallW, h: smallH });
    o.push(imageSlot({
      slotId: `slot-${i + 1}`, x: x + 28, y: smallY + 28, w: smallW - 56, h: 196,
      styleHint: 'comic story beat, bold flat vector, thick outlines, no text', stroke: palette.primary
    }));
    bubbleAndCaption(o, b, palette, fonts, {
      x: x + 28, w: smallW - 56, y: smallY + 248, budgetH: smallH - 248 - 28, headMax: 44
    });
  });

  // the reveal — one large emphasized panel (~2x)
  if (last) {
    const y = 1090;
    const h = 720;
    frame(o, last, palette, { x: 88, y, w: 1238, h, emphasized: true });
    o.push(imageSlot({
      slotId: `slot-${blocks.length}`, x: 120, y: y + 36, w: 380, h: 380,
      styleHint: 'comic reveal moment, triumphant, bold flat vector, thick outlines, no text',
      stroke: palette.accent
    }));
    bubbleAndCaption(o, last, palette, fonts, {
      x: 548, w: 750, y: y + 36, budgetH: h - 72, headMax: 62
    });
  }

  ctaBar(o, content.callToAction, palette, fonts, W, 1856);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'horizontal', intensity: 0.6 }));
  o.push(...lightBeams({ w: W, h: H, color: palette.primary, count: 3, angle: 26, intensity: 0.7 }));
  o.push(...meshGlow({
    spots: [
      { x: 200, y: 700, r: 340, color: palette.primary },
      { x: W - 200, y: 300, r: 380, color: palette.accent }
    ],
    intensity: 0.9
  }));

  headlineZone(o, content, palette, fonts, { x: 88, y: 80, w: 1400, maxSize: 100 });

  // filmstrip: equal small frames, last frame doubled in width
  const blocks = content.blocks || [];
  const top = 448;
  const panelH = 762;
  const gap = 32;
  const units = blocks.length + 1; // last frame counts double
  const unitW = Math.round((1824 - gap * (blocks.length - 1)) / Math.max(units, 1));

  let x = 88;
  blocks.forEach((b, i) => {
    const isLast = i === blocks.length - 1;
    const w = isLast ? unitW * 2 : unitW;
    frame(o, b, palette, { x, y: top, w, h: panelH, emphasized: isLast });
    o.push(imageSlot({
      slotId: `slot-${i + 1}`, x: x + (isLast ? 28 : 24), y: top + (isLast ? 28 : 24),
      w: w - (isLast ? 56 : 48), h: isLast ? 296 : 220,
      styleHint: isLast
        ? 'comic reveal moment, triumphant, bold flat vector, thick outlines, no text'
        : 'comic story beat, bold flat vector, thick outlines, no text',
      stroke: isLast ? palette.accent : palette.primary
    }));
    bubbleAndCaption(o, b, palette, fonts, {
      x: x + (isLast ? 28 : 24), w: w - (isLast ? 56 : 48),
      y: top + (isLast ? 348 : 268), budgetH: panelH - (isLast ? 376 : 296),
      headMax: isLast ? 56 : 42
    });
    x += w + gap;
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [pvBars({ x: pv(88), y: pv(110), w: pv(1238), lines: 2, barH: 8, gap: 5, fill: DARK_INK })];
  for (let i = 0; i < 2; i++) {
    const x = 88 + i * 636;
    parts.push(pvRect(pv(x), pv(490), pv(580), pv(560), DARK_PANEL, { rx: 3 }));
    parts.push(pvSlot(pv(x + 28), pv(518), pv(524), pv(196), palette.primary));
    parts.push(pvRect(pv(x + 28), pv(738), pv(280), pv(80), palette.primary, { rx: 5 }));
    parts.push(pvBars({ x: pv(x + 28), y: pv(860), w: pv(524), lines: 2, barH: 4, gap: 3, fill: DARK_INK_DIM }));
  }
  parts.push(pvRect(pv(88), pv(1090), pv(1238), pv(720), DARK_PANEL, { rx: 3, stroke: palette.accent, opacity: 0.18 }));
  parts.push(pvSlot(pv(120), pv(1126), pv(380), pv(380), palette.accent));
  parts.push(pvRect(pv(548), pv(1126), pv(400), pv(96), palette.primary, { rx: 5 }));
  parts.push(pvBars({ x: pv(548), y: pv(1280), w: pv(740), lines: 3, barH: 4.5, gap: 3, fill: DARK_INK_DIM }));
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [pvBars({ x: pv(88), y: pv(95), w: pv(1400), lines: 2, barH: 8, gap: 5, fill: DARK_INK })];
  const unitW = Math.round((1824 - 32 * 2) / 4); // units = 3+1=4
  const widths = [unitW, unitW, unitW * 2];
  let x = 88;
  widths.forEach((w, i) => {
    const last = i === 2;
    parts.push(pvRect(pv(x), pv(448), pv(w), pv(762), DARK_PANEL, { rx: 3 }));
    parts.push(pvSlot(pv(x + 24), pv(476), pv(w - 48), pv(last ? 296 : 220), last ? palette.accent : palette.primary));
    parts.push(pvRect(pv(x + 24), pv(last ? 792 : 712), pv(Math.min(280, w - 80)), pv(78), palette.primary, { rx: 5 }));
    parts.push(pvBars({ x: pv(x + 24), y: pv(last ? 924 : 844), w: pv(w - 48), lines: 2, barH: 4, gap: 3, fill: DARK_INK_DIM }));
    x += w + 32;
  });
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'comic-reveal',
  name: 'Comic reveal',
  style: 'comic',
  description: 'Three-beat story arc — setup, mistake, lesson — with speech-bubble headings and a double-size emphasized reveal panel on a deep near-black canvas. Two-over-one in portrait, a filmstrip with an enlarged last frame in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'panels', min: 3, max: 3, fields: ['heading', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 3
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
