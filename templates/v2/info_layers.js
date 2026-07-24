// v2 template — info-layers (style: infographic). Defense-in-depth layer
// bands: each block is a tinted strip with a label chip + text. Portrait
// stacks horizontal bands whose widths step DOWN (a pyramid feel without
// literal triangle geometry); landscape rotates the idea into vertical
// columns whose heights step UP left→right. 3–5 sequence blocks
// {label, text}, no image slot, decor = padlock motif + gradient wash.
//
// 2026 redesign: deep near-black DARK_BASE canvas. Layer bands are
// DARK_PANEL frosted surfaces (solid fill, NO opacity — exempt from ≤0.2 rule)
// with a left-side accent bar and a subtle primary hairline.  The width/height
// stepping geometry is PRESERVED as the test contract requires it.
// Accent hue shifts slightly per layer (primary→accent spread) for depth.

import {
  textbox, rect, chip,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, padlockMotif, meshGlow,
  svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM,
  legibilityScrim,
} from './decor.js';

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

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize, subMaxH = 120 }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 300, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    lineHeight: 1.06, layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.06) + 20;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: subMaxH, maxSize: 40, minSize: 28, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x,
      y: cursor,
      w, fontSize: subSize, fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM,
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.35) + 20;
  }
  return cursor;
}

/**
 * Tint opacity for the hairline stroke on each layer (subtle depth gradient).
 * Cap at 0.2 per decor rule.
 */
function layerHairline(i) {
  return Math.min(0.2, 0.06 + i * 0.025);
}

/** Bound label chip (fieldRef 'label') + body text (fieldRef 'text'). */
function layerContent(o, b, palette, fonts, { x, y, w, textBudget, maxSize = 44 }) {
  let textY = y;
  if (b.label) {
    const chipBudgetH = Math.round(textBudget * 0.32);
    const [pill, labelText] = chip({
      text: b.label, x, y, fontSize: 24, bg: palette.dark, color: palette.primary,
      font: fonts.head, msgId: b.id, maxW: w, maxH: chipBudgetH
    });
    o.push(pill, { ...labelText, fieldRef: 'label', bgRef: palette.dark });
    textY = y + pill.height + 12;
  }
  const size = fitFontSize(b.text, { width: w, height: textBudget - (textY - y), maxSize, minSize: 20 });
  o.push({
    ...textbox({
      text: b.text, x, y: textY, w, fontSize: size, fontFamily: fonts.body,
      fontWeight: '600', fill: DARK_INK, lineHeight: 1.38,
      layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'text'
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'vertical', intensity: 0.7 }));
  o.push(...padlockMotif({ x: 1190, y: 1530, size: 160, color: palette.primary, intensity: 0.8 }));
  o.push(...meshGlow({
    spots: [
      { x: 180, y: 500, r: 380, color: palette.primary },
      { x: W - 160, y: H - 500, r: 340, color: palette.accent }
    ],
    intensity: 0.9
  }));

  const hzP = headlineZone(o, content, palette, fonts, { x: 88, y: 96, w: 1238, maxSize: 112 });

  const blocks = content.blocks || [];
  const top = Math.max(548, hzP + 16);
  const bottom = 1800;
  const gap = 28;
  const n = Math.max(blocks.length, 1);
  const bandH = Math.round((bottom - top - (n - 1) * gap) / n);
  const fullW = W - 176; // 1238
  // widths step DOWN: band 0 is full, each subsequent band is narrower
  const step = (fullW * 0.32) / Math.max(n - 1, 1);

  blocks.forEach((b, i) => {
    const y = Math.round(top + i * (bandH + gap));
    const bandW = Math.round(fullW - i * step); // steps down — contract kept
    // frosted DARK_PANEL surface (solid, no opacity — exempt from ≤0.2 rule)
    o.push(rect({
      x: 88, y, w: bandW, h: bandH, fill: DARK_PANEL, rx: 22,
      shadow: { color: 'rgba(0,0,0,0.45)', blur: 22, offsetX: 0, offsetY: 10 },
      layerRole: 'background', msgId: b.id
    }));
    // 1px primary hairline (translucent decor)
    o.push(rect({
      x: 88, y, w: bandW, h: bandH, fill: 'transparent',
      stroke: palette.primary, strokeWidth: 2, rx: 22,
      opacity: layerHairline(i), layerRole: 'decor'
    }));
    // left accent bar (accent hue, translucent decor)
    o.push(rect({ x: 88, y, w: 14, h: bandH, fill: palette.accent, rx: 7, opacity: 0.18, layerRole: 'decor' }));
    layerContent(o, b, palette, fonts, {
      x: 144, y: y + 28, w: bandW - 196, textBudget: bandH - 56
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
  o.push(...padlockMotif({ x: 1830, y: 140, size: 140, color: palette.primary, intensity: 0.8 }));
  o.push(...meshGlow({
    spots: [
      { x: 200, y: 300, r: 340, color: palette.primary },
      { x: W - 200, y: H - 280, r: 320, color: palette.accent }
    ],
    intensity: 0.9
  }));

  const hzL = headlineZone(o, content, palette, fonts, { x: 88, y: 80, w: 1500, maxSize: 100 });

  // vertical columns stepping UP left→right (heights increase, tops rise)
  const blocks = content.blocks || [];
  const gap = 28;
  const n = Math.max(blocks.length, 1);
  const colW = Math.round((1824 - (n - 1) * gap) / n);
  const baseline = 1232;
  // Ensure minimum column height accounts for headline zone
  const hMin = Math.max(440, 1232 - Math.max(792, hzL + 40));
  const hMax = Math.max(hMin + 100, 700);

  blocks.forEach((b, i) => {
    const x = Math.round(88 + i * (colW + gap));
    // heights step UP: each column taller than the previous — contract kept
    const colH = Math.round(hMin + (i * (hMax - hMin)) / Math.max(n - 1, 1));
    const y = baseline - colH; // tops rise as columns grow — contract kept
    o.push(rect({
      x, y, w: colW, h: colH, fill: DARK_PANEL, rx: 22,
      shadow: { color: 'rgba(0,0,0,0.45)', blur: 22, offsetX: 0, offsetY: 10 },
      layerRole: 'background', msgId: b.id
    }));
    o.push(rect({
      x, y, w: colW, h: colH, fill: 'transparent',
      stroke: palette.primary, strokeWidth: 2, rx: 22,
      opacity: layerHairline(i), layerRole: 'decor'
    }));
    // top accent bar
    o.push(rect({ x, y, w: colW, h: 14, fill: palette.accent, rx: 7, opacity: 0.18, layerRole: 'decor' }));
    layerContent(o, b, palette, fonts, {
      x: x + 32, y: y + 42, w: colW - 64, textBudget: colH - 80, maxSize: 40
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvBars({ x: pv(88), y: pv(110), w: pv(1238), lines: 2, barH: 8, gap: 5, fill: DARK_INK })
  ];
  const fullW = 1238;
  for (let i = 0; i < 4; i++) {
    const y = 548 + i * 320;
    const bandW = Math.round(fullW - i * (fullW * 0.32 / 3));
    parts.push(pvRect(pv(88), pv(y), pv(bandW), pv(292), DARK_PANEL, { rx: 3 }));
    parts.push(pvRect(pv(88), pv(y), 2, pv(292), palette.accent, { rx: 1, opacity: 0.18 }));
    parts.push(pvRect(pv(144), pv(y + 28), pv(140), 4, palette.dark, { rx: 2 }));
    parts.push(pvBars({ x: pv(144), y: pv(y + 96), w: pv(bandW - 196), lines: 2, barH: 4.5, gap: 3, fill: DARK_INK }));
  }
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvBars({ x: pv(88), y: pv(95), w: pv(1500), lines: 2, barH: 8, gap: 5, fill: DARK_INK })
  ];
  const hMin = 440;
  const hMax = 700;
  for (let i = 0; i < 4; i++) {
    const x = 88 + i * 464;
    const colH = Math.round(hMin + (i * (hMax - hMin)) / 3);
    const y = 1232 - colH;
    parts.push(pvRect(pv(x), pv(y), pv(436), pv(colH), DARK_PANEL, { rx: 3 }));
    parts.push(pvRect(pv(x), pv(y), pv(436), 2, palette.accent, { rx: 1, opacity: 0.18 }));
    parts.push(pvRect(pv(x + 32), pv(y + 42), pv(120), 4, palette.dark, { rx: 2 }));
    parts.push(pvBars({ x: pv(x + 32), y: pv(y + 110), w: pv(372), lines: 3, barH: 4, gap: 3, fill: DARK_INK }));
  }
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'info-layers',
  name: 'Defense layers',
  style: 'infographic',
  description: 'Stacked defense-in-depth layer bands on a near-black canvas — each layer a frosted DARK_PANEL surface with a label chip and rationale, widths stepping down like nested shields. Horizontal bands in portrait, rising vertical columns in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'sequence', min: 3, max: 5, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
