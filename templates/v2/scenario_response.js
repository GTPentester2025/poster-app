// v2 template — scenario-response (style: scenario). Split decision cards:
// each block pairs a "SITUATION" panel (DARK_PANEL, left) with a "RIGHT
// RESPONSE" panel (semantic safety green, right), joined by an accent arrow.
// Green survives brand overrides because safe/danger colors carry meaning
// (helpers.SEMANTIC_GREEN). 2–3 scenario blocks {situation, response}, one
// honest image slot, decor = corner viewfinder frame + ghost shield.
// Portrait runs side-by-side split rows; landscape stacks full-width
// situation→response bands.
//
// 2026 redesign: near-black DARK_BASE canvas, DARK_PANEL frosted situation
// cards with 1px primary hairlines, chips updated to use primary on dark,
// generous 88px outer margins, mesh glow behind the layout, no tacky fills.

import {
  textbox, rect, polygon, chip, imageSlot, SEMANTIC_GREEN,
  fitFontSize, estTextHeight, pickTextColor,
  pv, pvRect, pvPoly, pvBars, pvSlot,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, cornerFrame, shieldMotif, meshGlow,
  svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM,
  legibilityScrim,
} from './decor.js';

const PANEL_R = 22;

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

/** Right-pointing accent arrow between the two panels. */
function arrow(o, palette, { x, midY, len = 76 }) {
  const half = 28;
  o.push(polygon([
    { x, y: midY - half },
    { x: x + len, y: midY },
    { x, y: midY + half }
  ], { fill: palette.accent, layerRole: 'decor' }));
}

/**
 * One split card: SITUATION panel (DARK_PANEL, frosted) → RIGHT RESPONSE
 * panel (semantic green). Both panels + chips + texts bind msgId.
 * NOTE: response text must be positioned to the right of situation text
 * (test asserts r.left > s.left).
 */
function splitCard(o, b, palette, fonts, { sx, sw, rx, rw, y, h }) {
  const innerPad = 32;
  const chipH = 54;

  // ── Situation panel (left) ──────────────────────────────────────────────
  o.push(rect({
    x: sx, y, w: sw, h, fill: DARK_PANEL, rx: PANEL_R,
    shadow: { color: 'rgba(0,0,0,0.5)', blur: 24, offsetX: 0, offsetY: 10 },
    layerRole: 'background', msgId: b.id
  }));
  o.push(rect({
    x: sx, y, w: sw, h, fill: 'transparent', stroke: palette.primary, strokeWidth: 2,
    rx: PANEL_R, opacity: 0.10, layerRole: 'decor'
  }));
  o.push(...chip({
    text: 'Situation', x: sx + innerPad, y: y + 24, fontSize: 22,
    bg: palette.dark, color: palette.primary, font: fonts.head, msgId: b.id
  }));
  const sSize = fitFontSize(b.situation, { width: sw - innerPad * 2, height: h - chipH - 64, maxSize: 44, minSize: 20 });
  o.push({
    ...textbox({
      text: b.situation, x: sx + innerPad, y: y + chipH + 32, w: sw - innerPad * 2,
      fontSize: sSize, fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
      lineHeight: 1.38, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'situation'
  });

  // arrow between panels
  const arrowX = sx + sw + 14;
  const arrowLen = rx - sx - sw - 28;
  arrow(o, palette, { x: arrowX, midY: y + Math.round(h / 2), len: Math.max(20, arrowLen) });

  // ── Right response panel (green, right of situation) ────────────────────
  const onGreen = pickTextColor(SEMANTIC_GREEN);
  o.push(rect({
    x: rx, y, w: rw, h, fill: SEMANTIC_GREEN, rx: PANEL_R,
    shadow: { color: 'rgba(0,0,0,0.4)', blur: 24, offsetX: 0, offsetY: 10 },
    layerRole: 'background', msgId: b.id
  }));
  o.push(...chip({
    text: 'Right response', x: rx + innerPad, y: y + 24, fontSize: 22,
    bg: '#FFFFFF', color: SEMANTIC_GREEN, font: fonts.head, msgId: b.id
  }));
  const rSize = fitFontSize(b.response, { width: rw - innerPad * 2, height: h - chipH - 64, maxSize: 44, minSize: 20 });
  o.push({
    ...textbox({
      text: b.response, x: rx + innerPad, y: y + chipH + 32, w: rw - innerPad * 2,
      fontSize: rSize, fontFamily: fonts.body, fontWeight: '700', fill: onGreen,
      lineHeight: 1.38, layerRole: 'message', msgId: b.id, bgRef: SEMANTIC_GREEN
    }),
    fieldRef: 'response'
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // atmosphere: diagonal wash + corner viewfinder + ghost shield + mesh glow
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'diagonal', intensity: 0.7 }));
  o.push(...cornerFrame({ x: 40, y: 40, w: W - 80, h: 1780, color: palette.primary, arm: 88, thickness: 6, intensity: 0.8 }));
  o.push(...shieldMotif({ x: 707, y: 820, size: 500, color: palette.primary, intensity: 0.4 }));
  o.push(...meshGlow({
    spots: [
      { x: 180, y: 500, r: 380, color: palette.primary },
      { x: W - 160, y: H - 500, r: 360, color: palette.accent }
    ],
    intensity: 0.9
  }));

  headlineZone(o, content, palette, fonts, { x: 88, y: 104, w: 940, maxSize: 108 });

  o.push(imageSlot({
    slotId: 'slot-1', x: 1086, y: 100, w: 240, h: 240,
    styleHint: 'small decision or crossroads emblem, flat vector, no text', stroke: palette.primary
  }));

  const blocks = content.blocks || [];
  const top = 550;
  const bottom = 1800;
  const gap = 40;
  const rowH = Math.round((bottom - top - gap * (blocks.length - 1)) / Math.max(blocks.length, 1));
  // Situation: x=88 w=548. Response: x=760 w=566. Gap ~124px for arrow.
  blocks.forEach((b, i) => {
    splitCard(o, b, palette, fonts, {
      sx: 88, sw: 548, rx: 760, rw: 566, y: top + i * (rowH + gap), h: rowH
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

  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'horizontal', intensity: 0.7 }));
  o.push(...cornerFrame({ x: 40, y: 40, w: W - 80, h: 1190, color: palette.primary, arm: 88, thickness: 6, intensity: 0.8 }));
  o.push(...shieldMotif({ x: 1000, y: 540, size: 440, color: palette.primary, intensity: 0.4 }));
  o.push(...meshGlow({
    spots: [
      { x: 200, y: 300, r: 340, color: palette.primary },
      { x: W - 200, y: H - 300, r: 340, color: palette.accent }
    ],
    intensity: 0.9
  }));

  headlineZone(o, content, palette, fonts, { x: 88, y: 80, w: 1380, maxSize: 96 });

  o.push(imageSlot({
    slotId: 'slot-1', x: 1660, y: 88, w: 252, h: 252,
    styleHint: 'small decision or crossroads emblem, flat vector, no text', stroke: palette.primary
  }));

  // full-width horizontal bands: situation (left) → response (right)
  const blocks = content.blocks || [];
  const top = 460;
  const bottom = 1244;
  const gap = 32;
  const bandH = Math.round((bottom - top - gap * (blocks.length - 1)) / Math.max(blocks.length, 1));
  // Situation: x=88 w=814. Response: x=994 w=830. Arrow gap ~92px.
  blocks.forEach((b, i) => {
    splitCard(o, b, palette, fonts, {
      sx: 88, sw: 814, rx: 994, rw: 830, y: top + i * (bandH + gap), h: bandH
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

function pvSplit(parts, palette, { sx, sw, rx, rw, y, h }) {
  parts.push(pvRect(pv(sx), pv(y), pv(sw), pv(h), DARK_PANEL, { rx: 3 }));
  parts.push(pvRect(pv(sx + 32), pv(y + 24), pv(150), 5, palette.dark, { rx: 2.5 }));
  parts.push(pvBars({ x: pv(sx + 32), y: pv(y + 90), w: pv(sw - 64), lines: 2, barH: 4.5, gap: 3, fill: DARK_INK }));
  const midY = pv(y + h / 2);
  parts.push(pvPoly([
    { x: pv(sx + sw + 14), y: midY - 4 },
    { x: pv(rx - 14), y: midY },
    { x: pv(sx + sw + 14), y: midY + 4 }
  ], palette.accent));
  parts.push(pvRect(pv(rx), pv(y), pv(rw), pv(h), SEMANTIC_GREEN, { rx: 3 }));
  parts.push(pvRect(pv(rx + 32), pv(y + 24), pv(180), 5, '#FFFFFF', { rx: 2.5 }));
  parts.push(pvBars({ x: pv(rx + 32), y: pv(y + 90), w: pv(rw - 64), lines: 2, barH: 4.5, gap: 3, fill: '#FFFFFF' }));
}

function previewPortrait(palette) {
  const parts = [
    pvBars({ x: pv(88), y: pv(118), w: pv(940), lines: 2, barH: 8, gap: 5, fill: DARK_INK }),
    pvSlot(pv(1086), pv(100), pv(240), pv(240), palette.primary)
  ];
  for (let i = 0; i < 3; i++) {
    pvSplit(parts, palette, { sx: 88, sw: 548, rx: 760, rw: 566, y: 550 + i * 420, h: 380 });
  }
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvBars({ x: pv(88), y: pv(95), w: pv(1380), lines: 2, barH: 8, gap: 5, fill: DARK_INK }),
    pvSlot(pv(1660), pv(88), pv(252), pv(252), palette.primary)
  ];
  for (let i = 0; i < 3; i++) {
    pvSplit(parts, palette, { sx: 88, sw: 814, rx: 994, rw: 830, y: 460 + i * 264, h: 232 });
  }
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'scenario-response',
  name: 'Scenario & response',
  style: 'scenario',
  description: 'Split decision cards on a near-black canvas: a frosted SITUATION panel flows through an accent arrow into a RIGHT RESPONSE panel in semantic safety green. Side-by-side rows in portrait, full-width stacked bands in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'scenario', min: 2, max: 3, fields: ['situation', 'response'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
