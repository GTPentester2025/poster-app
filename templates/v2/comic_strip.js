// v2 template — comic-strip (style: comic). A framed panel strip: every
// panel is an honest image slot + a bold heading + a one-line caption inside
// a rounded comic frame. Portrait stacks the panels; landscape runs them in
// one row. 3–4 panels blocks {heading, text}, up to 3 image slots (one per
// panel, the fourth panel is a text-only punchline), decor = halftone dot
// grids + gradient wash + mesh glow corner accents.
//
// 2026 redesign: dark near-black canvas (DARK_BASE/DARK_PANEL), warm off-white
// headlines, accent-color node numbers on panels, generous 88px outer margins,
// DARK_PANEL cards with a 1px primary hairline stroke, no tilt (no rotated
// Rect), mesh glow blooms for depth.

import {
  textbox, rect, imageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars, pvSlot,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, dotGrid, meshGlow,
  svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM,
  legibilityScrim,
} from './decor.js';

const FRAME_R = 24;
const MAX_SLOTS = 3;      // schema imageSlots — panel 4 goes text-only

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_PANEL, layerRole: 'background' }));
  // thin accent hairline on top edge of CTA bar
  o.push(rect({ x: 0, y, w: W, h: 4, fill: palette.accent, opacity: 0.18, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 176, height: 96, maxSize: 46, minSize: 30 });
  o.push(textbox({
    text, x: 88, y: y + Math.round((144 - estTextHeight(text, size, W - 176)) / 2),
    w: W - 176, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
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
    const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 40, minSize: 28, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x,
      y: y + estTextHeight(content.headline, headSize, w, 1.06) + 20,
      w, fontSize: subSize, fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM,
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
  }
}

/** Frosted DARK_PANEL card frame — no rotation, clean elevation. */
function panelFrame(o, b, palette, { x, y, w, h, panelIndex }) {
  o.push(rect({
    x, y, w, h, fill: DARK_PANEL, rx: FRAME_R,
    shadow: { color: 'rgba(0,0,0,0.5)', blur: 28, offsetX: 0, offsetY: 12 },
    layerRole: 'background', msgId: b.id
  }));
  // 1px primary hairline stroke (decor, explicit opacity)
  o.push(rect({
    x, y, w, h, fill: 'transparent', stroke: palette.primary, strokeWidth: 2,
    rx: FRAME_R, opacity: 0.12, layerRole: 'decor'
  }));
  // top accent bar — thin rule along the top inside edge
  o.push(rect({
    x: x + FRAME_R, y: y + 12, w: w - FRAME_R * 2, h: 4,
    fill: panelIndex % 2 === 0 ? palette.primary : palette.accent,
    rx: 2, opacity: 0.18, layerRole: 'decor'
  }));
}

/** Heading + caption stack; both bind msgId + fieldRef. */
function panelText(o, b, palette, fonts, { x, w, y, budgetH, headMax }) {
  const headSize = fitFontSize(b.heading, { width: w, height: 140, maxSize: headMax, minSize: 20 });
  o.push({
    ...textbox({
      text: b.heading, x, y, w, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
      lineHeight: 1.08, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'heading'
  });
  const textY = y + Math.round(estTextHeight(b.heading, headSize, w, 1.08)) + 16;
  const capH = Math.max(48, budgetH - (textY - y));
  const size = fitFontSize(b.text, {
    width: w, height: capH,
    maxSize: Math.min(46, headSize - 4), minSize: 20
  });
  o.push({
    ...textbox({
      text: b.text, x, y: textY, w, fontSize: size,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM,
      lineHeight: 1.4, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
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

  // background atmosphere: diagonal wash + two halftone dot fields + mesh glow
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'diagonal', intensity: 0.6 }));
  o.push(...dotGrid({ x: 1040, y: 360, cols: 6, rows: 4, gap: 48, dotR: 5, color: palette.primary, intensity: 0.7 }));
  o.push(...dotGrid({ x: 88, y: 1570, cols: 5, rows: 3, gap: 48, dotR: 5, color: palette.accent, intensity: 0.6 }));
  o.push(...meshGlow({
    spots: [
      { x: W - 180, y: 300, r: 380, color: palette.primary },
      { x: 200, y: H - 400, r: 340, color: palette.accent }
    ],
    intensity: 0.9
  }));

  headlineZone(o, content, palette, fonts, { x: 88, y: 96, w: 1238, maxSize: 112 });

  const blocks = content.blocks || [];
  const top = 540;
  const bottom = 1816;
  const gap = 32;
  const panelH = Math.round((bottom - top - gap * (blocks.length - 1)) / Math.max(blocks.length, 1));

  blocks.forEach((b, i) => {
    const y = top + i * (panelH + gap);
    panelFrame(o, b, palette, { x: 88, y, w: 1238, h: panelH, panelIndex: i });

    const hasSlot = i < MAX_SLOTS;
    if (hasSlot) {
      const s = Math.min(panelH - 72, 220);
      o.push(imageSlot({
        slotId: `slot-${i + 1}`, x: 120, y: y + 36, w: s, h: s,
        styleHint: 'single comic-panel moment, bold flat vector, thick outlines, no text',
        stroke: palette.primary
      }));
      panelText(o, b, palette, fonts, {
        x: 160 + s, w: 1238 - (160 + s) - 40, y: y + 40, budgetH: panelH - 80, headMax: 56
      });
    } else {
      // final punchline panel — text spans the frame
      panelText(o, b, palette, fonts, { x: 120, w: 1166, y: y + 40, budgetH: panelH - 80, headMax: 56 });
    }
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

  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'horizontal', intensity: 0.6 }));
  o.push(...dotGrid({ x: 1560, y: 120, cols: 6, rows: 3, gap: 48, dotR: 5, color: palette.primary, intensity: 0.7 }));
  o.push(...dotGrid({ x: 88, y: 1080, cols: 5, rows: 2, gap: 48, dotR: 5, color: palette.accent, intensity: 0.6 }));
  o.push(...meshGlow({
    spots: [
      { x: W - 260, y: 200, r: 360, color: palette.primary },
      { x: 180, y: H - 280, r: 300, color: palette.accent }
    ],
    intensity: 0.9
  }));

  headlineZone(o, content, palette, fonts, { x: 88, y: 80, w: 1400, maxSize: 100 });

  // one row of panels
  const blocks = content.blocks || [];
  const top = 460;
  const panelH = 750;
  const gap = 32;
  const colW = Math.round((1824 - gap * (blocks.length - 1)) / Math.max(blocks.length, 1));

  blocks.forEach((b, i) => {
    const x = 88 + i * (colW + gap);
    panelFrame(o, b, palette, { x, y: top, w: colW, h: panelH, panelIndex: i });

    let textY = top + 40;
    if (i < MAX_SLOTS) {
      o.push(imageSlot({
        slotId: `slot-${i + 1}`, x: x + 28, y: top + 28, w: colW - 56, h: 220,
        styleHint: 'single comic-panel moment, bold flat vector, thick outlines, no text',
        stroke: palette.primary
      }));
      textY = top + 270;
    }
    panelText(o, b, palette, fonts, {
      x: x + 28, w: colW - 56, y: textY, budgetH: top + panelH - 32 - textY, headMax: 48
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [pvBars({ x: pv(88), y: pv(110), w: pv(1238), lines: 2, barH: 8, gap: 5, fill: DARK_INK })];
  for (let i = 0; i < 3; i++) {
    const y = 540 + i * 418;
    parts.push(pvRect(pv(88), pv(y), pv(1238), pv(382), DARK_PANEL, { rx: 3 }));
    parts.push(pvSlot(pv(120), pv(y + 36), pv(220), pv(220), palette.primary));
    parts.push(pvRect(pv(370), pv(y + 40), pv(220), 6, palette.primary, { rx: 3 }));
    parts.push(pvBars({ x: pv(370), y: pv(y + 120), w: pv(870), lines: 2, barH: 4.5, gap: 3, fill: DARK_INK_DIM }));
  }
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [pvBars({ x: pv(88), y: pv(95), w: pv(1400), lines: 2, barH: 8, gap: 5, fill: DARK_INK })];
  for (let i = 0; i < 3; i++) {
    const x = 88 + i * 608;
    parts.push(pvRect(pv(x), pv(460), pv(576), pv(750), DARK_PANEL, { rx: 3 }));
    parts.push(pvSlot(pv(x + 28), pv(488), pv(520), pv(220), palette.primary));
    parts.push(pvRect(pv(x + 28), pv(728), pv(220), 5, palette.primary, { rx: 2.5 }));
    parts.push(pvBars({ x: pv(x + 28), y: pv(796), w: pv(520), lines: 3, barH: 4, gap: 3, fill: DARK_INK_DIM }));
  }
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_PANEL));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'comic-strip',
  name: 'Comic strip',
  style: 'comic',
  description: 'Framed comic panels with a bold heading and one-line caption each, image slot per panel, on a deep near-black canvas with mesh-glow atmosphere. Stacked in portrait, one row in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'panels', min: 3, max: 4, fields: ['heading', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 3
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
