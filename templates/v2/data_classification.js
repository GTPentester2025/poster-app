// v2 template — data-classification (style: tabular). Enterprise data classification matrix:
// a 4-tier vertical classification framework color-coded by sensitivity level (green to red),
// each tier with icon, label, and description. Portrait: title top, tiers stacked center, CTA below.
// Landscape: title left, tiers stacked right. 4 cells blocks {label, text}, 0 image slots, corporate slate background.

import {
  textbox, rect, hline, vline,
  backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, dotGrid, cornerFrame,
  legibilityScrim, svgWrapO, PV_LAND_W
} from './decor.js';

const TIERS = [
  { label: 'Public', color: '#2E7D32', icon: '🔓' },
  { label: 'Internal', color: '#1565C0', icon: '🔒' },
  { label: 'Confidential', color: '#F57C00', icon: '🔐' },
  { label: 'Restricted', color: '#C62828', icon: '⛔' }
];
const SLATE = '#2C3E50';
const SLATE_LIGHT = '#34495E';

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 128, fill: palette.dark, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 200, height: 88, maxSize: 44, minSize: 28 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((128 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: palette.dark
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 200, maxSize, minSize: 48 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: '#FFFFFF',
    lineHeight: 1.06, layerRole: 'headline', bgRef: SLATE
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.06) + 18;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 80, maxSize: 38, minSize: 20, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: '#FFFFFF',
      lineHeight: 1.35, opacity: 0.75, layerRole: 'subheadline', bgRef: SLATE
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.35) + 12;
  }
  return cursor;
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', SLATE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'corporate slate background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H, strength: 0.5 }));
  o.push(...gradientWash({ w: W, h: H, from: SLATE, to: SLATE_LIGHT, direction: 'vertical', intensity: 0.25 }));
  o.push(...dotGrid({ x: W - 240, y: 40, cols: 4, rows: 4, gap: 44, dotR: 3, color: '#FFFFFF', intensity: 0.15 }));
  o.push(...cornerFrame({ x: 48, y: 48, w: W - 96, h: H - 232, color: '#FFFFFF', arm: 64, thickness: 4, intensity: 0.25 }));

  const hCursor = headlineZone(o, content, palette, fonts, { x: 88, y: 96, w: W - 176, maxSize: 80 });

  // 4-tier classification bands
  const blocks = content.blocks || [];
  const tierStartY = Math.max(420, hCursor + 32);
  const tierW = W - 176;
  const tierH = 240;
  const tierGap = 12;
  const tierX = 88;

  TIERS.forEach((tier, tierIdx) => {
    const ty = tierStartY + tierIdx * (tierH + tierGap);
    const b = blocks[tierIdx];
    const bId = b ? b.id : `blk-${tierIdx + 1}`;

    // tier background band
    o.push(rect({ x: tierX, y: ty, w: tierW, h: tierH, fill: tier.color, rx: 8, layerRole: 'background', msgId: bId }));
    o.push(rect({
      x: tierX + 6, y: ty + 6, w: tierW - 12, h: tierH - 12,
      fill: 'transparent', stroke: 'rgba(255,255,255,0.15)', strokeWidth: 2, rx: 6,
      layerRole: 'decor'
    }));

    // icon + tier label
    o.push(textbox({
      text: tier.icon, x: tierX + 24, y: ty + 20, w: 60, fontSize: 36,
      fontFamily: fonts.head, fontWeight: '900', fill: '#FFFFFF',
      align: 'center', lineHeight: 1, layerRole: 'decor', bgRef: tier.color
    }));

    o.push(textbox({
      text: tier.label.toUpperCase(), x: tierX + 96, y: ty + 24, w: tierW - 144, fontSize: 28,
      fontFamily: fonts.head, fontWeight: '800', fill: '#FFFFFF',
      align: 'left', lineHeight: 1.1, layerRole: 'message-label', bgRef: tier.color
    }));

    // block content (label and text)
    if (b) {
      const textW = tierW - 144;
      const labelStr = String(b.label || '').toUpperCase();
      const lblSize = fitFontSize(labelStr, { width: textW, height: 40, maxSize: 20, minSize: 14 });
      o.push({
        ...textbox({
          text: labelStr, x: tierX + 96, y: ty + 70, w: textW, fontSize: lblSize,
          fontFamily: fonts.head, fontWeight: '700', fill: '#FFFFFF',
          align: 'left', lineHeight: 1.1, opacity: 0.95,
          layerRole: 'message', msgId: b.id, bgRef: tier.color
        }),
        fieldRef: 'label'
      });

      const tSize = fitFontSize(b.text, { width: textW, height: 100, maxSize: 20, minSize: 14 });
      o.push({
        ...textbox({
          text: b.text, x: tierX + 96, y: ty + 120, w: textW, fontSize: tSize,
          fontFamily: fonts.body, fontWeight: '500', fill: '#FFFFFF',
          lineHeight: 1.3, opacity: 0.9, layerRole: 'message', msgId: b.id, bgRef: tier.color
        }),
        fieldRef: 'text'
      });
    }
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1872);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', SLATE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'corporate slate background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H, strength: 0.5 }));
  o.push(...gradientWash({ w: W, h: H, from: SLATE, to: SLATE_LIGHT, direction: 'horizontal', intensity: 0.25 }));
  o.push(...dotGrid({ x: W - 200, y: 40, cols: 3, rows: 3, gap: 44, dotR: 3, color: '#FFFFFF', intensity: 0.15 }));

  const leftW = 480;
  headlineZone(o, content, palette, fonts, { x: 88, y: 80, w: leftW, maxSize: 68 });

  // 4-tier classification bands on right
  const blocks = content.blocks || [];
  const tierStartX = 650;
  const tierW = W - tierStartX - 60;
  const tierH = 180;
  const tierGap = 10;
  const tierY = 100;

  TIERS.forEach((tier, tierIdx) => {
    const ty = tierY + tierIdx * (tierH + tierGap);
    const b = blocks[tierIdx];
    const bId = b ? b.id : `blk-${tierIdx + 1}`;

    // tier background band
    o.push(rect({ x: tierStartX, y: ty, w: tierW, h: tierH, fill: tier.color, rx: 8, layerRole: 'background', msgId: bId }));
    o.push(rect({
      x: tierStartX + 4, y: ty + 4, w: tierW - 8, h: tierH - 8,
      fill: 'transparent', stroke: 'rgba(255,255,255,0.15)', strokeWidth: 2, rx: 6,
      layerRole: 'decor'
    }));

    // icon
    o.push(textbox({
      text: tier.icon, x: tierStartX + 16, y: ty + 12, w: 48, fontSize: 32,
      fontFamily: fonts.head, fontWeight: '900', fill: '#FFFFFF',
      align: 'center', lineHeight: 1, layerRole: 'decor', bgRef: tier.color
    }));

    // tier label
    o.push(textbox({
      text: tier.label.toUpperCase(), x: tierStartX + 72, y: ty + 16, w: tierW - 104, fontSize: 24,
      fontFamily: fonts.head, fontWeight: '800', fill: '#FFFFFF',
      align: 'left', lineHeight: 1.05, layerRole: 'message-label', bgRef: tier.color
    }));

    // block content
    if (b) {
      const textW = tierW - 104;
      const tSize = fitFontSize(b.text, { width: textW, height: 60, maxSize: 16, minSize: 12 });
      o.push({
        ...textbox({
          text: b.text, x: tierStartX + 72, y: ty + 52, w: textW, fontSize: tSize,
          fontFamily: fonts.body, fontWeight: '500', fill: '#FFFFFF',
          lineHeight: 1.3, opacity: 0.9, layerRole: 'message', msgId: b.id, bgRef: tier.color
        }),
        fieldRef: 'text'
      });
    }
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1286);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvBars({ x: pv(88), y: pv(110), w: pv(1000), lines: 2, barH: 7, gap: 4, fill: '#FFFFFF' })
  ];
  const tierStartY = 420;
  const tierW = 1000;
  const tierH = 240;
  const tierGap = 12;
  const tierX = 88;

  TIERS.forEach((tier, tierIdx) => {
    const ty = tierStartY + tierIdx * (tierH + tierGap);
    parts.push(pvRect(pv(tierX), pv(ty), pv(tierW), pv(tierH), tier.color, { rx: 2 }));
    // icon placeholder
    parts.push(pvRect(pv(tierX + 24), pv(ty + 20), 20, 20, '#FFFFFF', { rx: 1 }));
    // label bar
    parts.push(pvRect(pv(tierX + 96), pv(ty + 24), pv(200), 5, 'rgba(255,255,255,0.8)', { rx: 1.5 }));
    // text bars
    parts.push(pvBars({ x: pv(tierX + 96), y: pv(ty + 120), w: pv(400), lines: 2, barH: 3, gap: 2, fill: 'rgba(255,255,255,0.7)' }));
  });
  parts.push(pvRect(0, pv(1872), 200, pv(128), palette.dark));
  return svgWrapO(parts, SLATE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvBars({ x: pv(88), y: pv(95), w: pv(480), lines: 2, barH: 7, gap: 4, fill: '#FFFFFF' })
  ];
  const tierStartX = 650;
  const tierW = 640;
  const tierH = 180;
  const tierGap = 10;
  const tierY = 100;

  TIERS.forEach((tier, tierIdx) => {
    const ty = tierY + tierIdx * (tierH + tierGap);
    parts.push(pvRect(pv(tierStartX), pv(ty), pv(tierW), pv(tierH), tier.color, { rx: 2 }));
    // icon placeholder
    parts.push(pvRect(pv(tierStartX + 16), pv(ty + 12), 16, 16, '#FFFFFF', { rx: 1 }));
    // label bar
    parts.push(pvRect(pv(tierStartX + 72), pv(ty + 16), pv(140), 4, 'rgba(255,255,255,0.8)', { rx: 1 }));
    // text bars
    parts.push(pvBars({ x: pv(tierStartX + 72), y: pv(ty + 52), w: pv(300), lines: 1, barH: 3, gap: 2, fill: 'rgba(255,255,255,0.7)' }));
  });
  parts.push(pvRect(0, pv(1286), PV_LAND_W, pv(128), palette.dark));
  return svgWrapO(parts, SLATE, 'landscape');
}

export default {
  id: 'data-classification',
  name: 'Data classification',
  style: 'tabular',
  description: 'Enterprise data classification matrix with four horizontal tiers (Public, Internal, Confidential, Restricted) color-coded from green to red, each with icon, label, and description. Corporate slate background with white accents. Portrait stacks tiers vertically; landscape arranges tiers on the right.',
  contentSchema: {
    headline: { required: true, maxWords: 6 },
    subheadline: { required: false, maxWords: 12 },
    blocks: { kind: 'cells', min: 4, max: 4, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 8 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
