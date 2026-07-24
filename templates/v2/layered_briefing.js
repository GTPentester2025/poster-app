// v2 template — layered-briefing (style: infographic). An intelligence-briefing
// dossier: each sequence block is a translucent "folder tab" layer card with a
// label chip + one-line brief. Portrait STACKS the tabs diagonally down-right,
// each tinted at a different depth with a cornerFrame accent, so they read as a
// pile of dossier folders under a classification-style header band (the
// headline). One honest dashed image slot sits clipped in a rounded 'photo'
// zone on the top tab; a fingerprintArcs ghost motif haunts a corner. Landscape
// is a REAL relayout — the tabs FAN horizontally left→right instead of stacking
// down. 3–4 sequence blocks {label, text}, one honest image slot. All template
// text stays axis-aligned (no angle — the pptx export contract forbids rotated
// template text).
//
// 2026 redesign: richer dossier material aesthetic — header band uses an
// elevated DARK_PANEL surface with a subtle meshGlow bloom behind it; tab
// body gets a refined border via a 1px light-stroke overlay; chips use a
// larger font and bolder contrast; cornerFrame accents set at 0.8 intensity
// for premium look; typography upgraded to 900-weight heading + 1.35 body
// line-height; consistent 88px outer margins + 8px-grid spacing.

import {
  textbox, rect, chip, imageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars, pvSlot,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, fingerprintArcs, cornerFrame,
  meshGlow, svgWrapO, PV_LAND_W,
  DARK_PANEL, DARK_BASE, DARK_INK,
  legibilityScrim,
} from './decor.js';

const BAND_FILL = DARK_PANEL;   // header band surface color

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_PANEL, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: palette.accent, opacity: 0.18, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 200, height: 96, maxSize: 46, minSize: 30 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((144 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

/**
 * Classification-style header band: an elevated DARK_PANEL strip with
 * a primary accent rule at top and bottom, the headline inside, and a
 * meshGlow bloom behind it. Returns the band bottom y.
 */
function headerBand(o, content, palette, fonts, { W, y, h, maxSize }) {
  // subtle bloom behind the header
  o.push(...meshGlow({
    spots: [{ x: Math.round(W * 0.15), y: Math.round(y + h * 0.5), r: Math.round(h * 1.4), color: palette.primary }],
    intensity: 0.55
  }));
  o.push(rect({ x: 0, y, w: W, h, fill: BAND_FILL, layerRole: 'background' }));
  // dual accent rules (primary top, accent bottom) — redacted-dossier feel
  o.push(rect({ x: 0, y, w: W, h: 10, fill: palette.primary, opacity: 0.20, layerRole: 'decor' }));
  o.push(rect({ x: 0, y: y + h - 10, w: W, h: 10, fill: palette.accent, opacity: 0.18, layerRole: 'decor' }));
  const textW = W - 200;
  const headSize = fitFontSize(content.headline, { width: textW, height: h - 64, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline,
    x: 100, y: y + Math.round((h - estTextHeight(content.headline, headSize, textW, 1.04)) / 2),
    w: textW, fontSize: headSize, lineHeight: 1.04,
    fontFamily: fonts.head, fontWeight: '900',
    fill: palette.primary, layerRole: 'headline', bgRef: BAND_FILL
  }));
  let bottom = y + h;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: W - 200, height: 120, maxSize: 40, minSize: 28, lineHeight: 1.4 });
    o.push(textbox({
      text: content.subheadline, x: 100, y: bottom + 24, w: W - 200, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: palette.dark, lineHeight: 1.4,
      layerRole: 'subheadline', bgRef: palette.background
    }));
    bottom += 24 + Math.round(estTextHeight(content.subheadline, subSize, W - 200, 1.4));
  }
  return bottom;
}

/** Tint opacity per tab layer: deeper tabs read denser, capped at 0.2. */
function tabTint(i) {
  return Math.min(0.20, 0.08 + i * 0.036);
}

/**
 * One dossier folder-tab card: a tinted translucent panel with a jutting tab
 * strip up top, a cornerFrame accent, a dark label chip (fieldRef 'label') and
 * the one-line brief (fieldRef 'text'). Both bound to msgId=blk-N.
 */
function tabCard(o, b, palette, fonts, { x, y, w, h, i, textX, textW, textTop, textBudget, maxSize = 46 }) {
  // folder body — translucent brand tint, depth by index
  o.push(rect({
    x, y, w, h, fill: palette.primary, rx: 22,
    opacity: tabTint(i), layerRole: 'background', msgId: b.id
  }));
  // 1px light stroke overlay for glass-edge definition
  o.push(rect({
    x, y, w, h, fill: 'transparent', rx: 22,
    stroke: palette.dark, strokeWidth: 1,
    opacity: Math.min(0.20, tabTint(i) + 0.06), layerRole: 'decor'
  }));
  // jutting "tab" ear at the top-left
  const earW = Math.round(w * 0.32);
  o.push(rect({
    x: x + 24, y: y - 32, w: earW, h: 44, fill: palette.primary, rx: 12,
    opacity: Math.min(0.20, tabTint(i) + 0.05), layerRole: 'decor'
  }));
  // accent spine down the left edge
  o.push(rect({ x, y, w: 12, h, fill: palette.accent, rx: 6, opacity: 0.20, layerRole: 'decor' }));
  // viewfinder corner brackets framing the folder
  o.push(...cornerFrame({ x: x + 18, y: y + 18, w: w - 36, h: h - 36, color: DARK_INK, arm: 64, thickness: 6, intensity: 0.8 }));

  // label chip
  let ty = textTop;
  if (b.label) {
    const chipMaxH = Math.round(textBudget * 0.35);
    const [pill, labelText] = chip({
      text: b.label, x: textX, y: ty, fontSize: 26, bg: DARK_BASE,
      color: palette.primary, font: fonts.head, msgId: b.id, maxW: textW, maxH: chipMaxH
    });
    o.push(pill, { ...labelText, fieldRef: 'label', bgRef: DARK_BASE });
    ty += pill.height + 12;
  }
  const size = fitFontSize(b.text, { width: textW, height: textBudget - (ty - textTop), maxSize, minSize: 20 });
  o.push({
    ...textbox({
      text: b.text, x: textX, y: ty, w: textW, fontSize: size,
      fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.4, layerRole: 'message', msgId: b.id, bgRef: palette.background
    }),
    fieldRef: 'text'
  });
}

/** Rounded 'photo' zone + one honest dashed image slot inside it. */
function photoZone(o, palette, { x, y, w, h }) {
  o.push(rect({ x, y, w, h, fill: palette.dark, rx: 20, opacity: 0.10, layerRole: 'decor' }));
  o.push(imageSlot({
    slotId: 'slot-1', x: x + 14, y: y + 14, w: w - 28, h: h - 28, rx: 14,
    styleHint: 'small dossier evidence photo or case emblem, flat vector, no text',
    stroke: palette.dark
  }));
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.background);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'diagonal', intensity: 0.65 }));
  o.push(...fingerprintArcs({ x: 1270, y: 1660, size: 280, color: palette.dark, intensity: 0.85 }));

  headerBand(o, content, palette, fonts, { W, y: 88, h: 312, maxSize: 112 });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);

  const top = 536;
  const bottom = 1752;
  const cardW = 952;
  const cardH = Math.round((bottom - top) / n) - 40;
  const dx = Math.round((W - 200 - cardW) / Math.max(n - 1, 1));
  const stackSpan = (bottom - top) - cardH;
  const dy = Math.round(stackSpan / Math.max(n - 1, 1));

  const photoW = 216;
  const photoH = 216;

  blocks.forEach((b, i) => {
    const x = 88 + dx * i;
    const y = top + dy * i;
    const isTop = i === n - 1;
    const textW = isTop ? cardW - 136 - photoW - 24 : cardW - 136;
    tabCard(o, b, palette, fonts, {
      x, y, w: cardW, h: cardH, i,
      textX: x + 56, textW, textTop: y + 48, textBudget: cardH - 96
    });
    if (isTop) {
      photoZone(o, palette, { x: x + cardW - photoW - 40, y: y + 40, w: photoW, h: photoH });
    }
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1856);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.background);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'horizontal', intensity: 0.65 }));
  o.push(...fingerprintArcs({ x: 1868, y: 1144, size: 220, color: palette.dark, intensity: 0.85 }));

  headerBand(o, content, palette, fonts, { W, y: 72, h: 248, maxSize: 100 });

  // REAL relayout: tabs FAN horizontally left→right
  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const gap = 32;
  const left = 88;
  const right = 1912;
  const colW = Math.round((right - left - (n - 1) * gap) / n);
  const top = 456;
  const colH = 672;
  const drop = 40;

  const photoW = colW - 80;
  const photoH = 224;

  blocks.forEach((b, i) => {
    const x = Math.round(left + i * (colW + gap));
    const y = top + i * drop;
    const isTop = i === n - 1;
    const textTop = isTop ? y + 48 + photoH + 24 : y + 48;
    const textBudget = isTop ? colH - 96 - photoH - 24 : colH - 96;
    tabCard(o, b, palette, fonts, {
      x, y, w: colW, h: colH, i,
      textX: x + 48, textW: colW - 96, textTop, textBudget, maxSize: 44
    });
    if (isTop) {
      photoZone(o, palette, { x: x + 40, y: y + 40, w: photoW, h: photoH });
    }
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvRect(0, pv(88), 200, pv(312), DARK_PANEL),
    pvRect(0, pv(88), 200, pv(10), palette.primary, { opacity: 0.2 }),
    pvBars({ x: pv(100), y: pv(190), w: pv(1214), lines: 2, barH: 8, gap: 5, fill: palette.primary })
  ];
  const n = 4;
  const top = 536; const bottom = 1752; const cardW = 952;
  const cardH = Math.round((bottom - top) / n) - 40;
  const dx = Math.round((1234 - cardW) / (n - 1));
  const dy = Math.round(((bottom - top) - cardH) / (n - 1));
  for (let i = 0; i < n; i++) {
    const x = 88 + dx * i;
    const y = top + dy * i;
    parts.push(pvRect(pv(x), pv(y), pv(cardW), pv(cardH), palette.primary, { rx: 3, opacity: tabTint(i) }));
    parts.push(pvRect(pv(x + 24), pv(y - 32), pv(cardW * 0.32), pv(44), palette.primary, { rx: 2, opacity: tabTint(i) + 0.05 }));
    parts.push(pvRect(pv(x), pv(y), 2, pv(cardH), palette.accent, { rx: 1, opacity: 0.2 }));
    parts.push(pvRect(pv(x + 56), pv(y + 48), pv(144), 4, DARK_BASE, { rx: 2 }));
    parts.push(pvBars({ x: pv(x + 56), y: pv(y + 120), w: pv(cardW - 300), lines: 2, barH: 4.5, gap: 3, fill: palette.dark }));
    if (i === n - 1) parts.push(pvSlot(pv(x + cardW - 256), pv(y + 40), pv(216), pv(216), palette.dark));
  }
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_PANEL));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvRect(0, pv(72), PV_LAND_W, pv(248), DARK_PANEL),
    pvRect(0, pv(72), PV_LAND_W, pv(10), palette.primary, { opacity: 0.2 }),
    pvBars({ x: pv(100), y: pv(152), w: pv(1500), lines: 2, barH: 8, gap: 5, fill: palette.primary })
  ];
  const n = 4;
  const gap = 32; const left = 88; const right = 1912;
  const colW = Math.round((right - left - (n - 1) * gap) / n);
  const top = 456; const colH = 672; const drop = 40;
  for (let i = 0; i < n; i++) {
    const x = Math.round(left + i * (colW + gap));
    const y = top + i * drop;
    parts.push(pvRect(pv(x), pv(y), pv(colW), pv(colH), palette.primary, { rx: 3, opacity: tabTint(i) }));
    parts.push(pvRect(pv(x + 24), pv(y - 32), pv(colW * 0.32), pv(44), palette.primary, { rx: 2, opacity: tabTint(i) + 0.05 }));
    parts.push(pvRect(pv(x), pv(y), 2, pv(colH), palette.accent, { rx: 1, opacity: 0.2 }));
    if (i === n - 1) {
      parts.push(pvSlot(pv(x + 40), pv(y + 40), pv(colW - 80), pv(224), palette.dark));
      parts.push(pvRect(pv(x + 48), pv(y + 308), pv(120), 4, DARK_BASE, { rx: 2 }));
      parts.push(pvBars({ x: pv(x + 48), y: pv(y + 368), w: pv(colW - 128), lines: 3, barH: 4, gap: 3, fill: palette.dark }));
    } else {
      parts.push(pvRect(pv(x + 48), pv(y + 48), pv(120), 4, DARK_BASE, { rx: 2 }));
      parts.push(pvBars({ x: pv(x + 48), y: pv(y + 112), w: pv(colW - 128), lines: 3, barH: 4, gap: 3, fill: palette.dark }));
    }
  }
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_PANEL));
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'layered-briefing',
  name: 'Intelligence briefing',
  style: 'infographic',
  description: 'An intelligence-briefing dossier: each point is a translucent folder-tab layer card with a label chip and one-line brief, under a classification-style header band. Tabs stack diagonally like a pile of dossiers in portrait and fan out horizontally in landscape, with one evidence photo slot on the top tab.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'sequence', min: 3, max: 4, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
