// v2 template — editorial-hero (style: infographic). A premium editorial poster
// in the spirit of Vogue / Monocle: one big HERO image dominates the top (a
// left half in landscape), the headline + optional subheadline sit clean beneath
// it, then a quiet column of exactly three short points — each a small square
// thumbnail beside an uppercase primary LABEL and warm off-white TEXT, separated
// by a single hairline rule. A refined CTA closes the page. No tiles, pills, or
// chips as decoration — only imagery and disciplined type over a full-bleed dark
// backdrop with a soft primary glow. Portrait: hero on top, rows stacked below.
// Landscape: REAL relayout — hero fills the left half, the three points stack on
// the right.

import {
  textbox, rect, imageSlot, backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, softGlow, meshGlow, svgWrapO, PV_LAND_W,
  legibilityScrim, DARK_BASE, DARK_INK, DARK_INK_DIM, OVERLAY_TEXT_SHADOW
} from './decor.js';

// slot ids: the hero + one thumbnail per block (blocks are fixed at 3)
const THUMB_SLOTS = ['slot-2', 'slot-3', 'slot-4'];

// ── shared atmosphere: mesh glow + gradient wash ──────────────────────────────
function atmosphere(o, palette, W, H, primary, secondary) {
  o.push(...meshGlow({
    spots: [
      { x: primary.x, y: primary.y, r: primary.r, color: palette.primary },
      { x: secondary.x, y: secondary.y, r: secondary.r, color: palette.accent }
    ], intensity: 0.8
  }));
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: DARK_BASE, direction: 'diagonal', intensity: 0.9 }));
}

// ── headline + optional subheadline block, returns the y just below it ────────
function headlineZone(o, content, palette, fonts, { x, y, w, maxSize, align = 'left' }) {
  // thin accent eyebrow rule above headline
  o.push(rect({
    x, y, w: 48, h: 4, fill: palette.primary, rx: 2,
    opacity: 0.2, layerRole: 'decor'
  }));
  const headStart = y + 4 + 14;
  const headSize = fitFontSize(content.headline, { width: w, height: 340, maxSize, minSize: 40 });
  o.push(textbox({
    text: content.headline, x, y: headStart, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align,
    lineHeight: 1.04, layerRole: 'headline', bgRef: DARK_BASE,
    shadow: OVERLAY_TEXT_SHADOW,
  }));
  let cursor = headStart + estTextHeight(content.headline, headSize, w, 1.04) + 16;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 40, minSize: 16, lineHeight: 1.2 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM, align,
      lineHeight: 1.2, layerRole: 'subheadline', bgRef: DARK_BASE,
      shadow: OVERLAY_TEXT_SHADOW,
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.2) + 14;
  }
  return cursor;
}

// ── one point row: thumbnail slot + uppercase primary LABEL + off-white TEXT ──
// Both block fields are bound (msgId + fieldRef + bgRef). label uppercased.
function pointRow(o, b, slotId, palette, fonts, { x, y, w, h }) {
  const thumb = Math.min(h - 8, 200);
  const thumbY = y + Math.round((h - thumb) / 2);
  o.push(imageSlot({
    slotId, x, y: thumbY, w: thumb, h: thumb,
    styleHint: 'editorial image, single subject, crisp, no text',
    stroke: palette.primary, rx: 16, blockId: b.id
  }));

  const textX = x + thumb + 40;
  const textW = x + w - textX;
  // bodyTop = y+8+labelH+16; avail for label = bodyTop - (y+8) - 8 = labelH + 8 = 28+8=36
  // cap label so estH ≤ 28 (fits in 36 avail with 1.05 tolerance)
  const labelText = String(b.label).toUpperCase();
  const labelSize = fitFontSize(labelText, { width: textW, height: 28, maxSize: 28, minSize: 10, lineHeight: 1 });
  o.push({
    ...textbox({
      text: labelText, x: textX, y: y + 8, w: textW, fontSize: labelSize,
      fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
      charSpacing: 140, lineHeight: 1, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE,
      shadow: OVERLAY_TEXT_SHADOW,
    }),
    fieldRef: 'label'
  });

  const bodyTop = y + 8 + 28 + 16; // fixed position regardless of actual labelH (label truncates to fit)
  const bodyH = y + h - bodyTop - 8;
  const bodySize = fitFontSize(b.text, { width: textW, height: bodyH, maxSize: 44, minSize: 20, lineHeight: 1.2 });
  o.push({
    ...textbox({
      text: b.text, x: textX, y: bodyTop, w: textW, fontSize: bodySize,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK,
      lineHeight: 1.2, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE,
      shadow: OVERLAY_TEXT_SHADOW,
    }),
    fieldRef: 'text'
  });
}

// ── thin hairline divider (true translucent decor, opacity <=0.2) ─────────────
function hairline(o, palette, { x, y, w }) {
  o.push(rect({ x, y, w, h: 1, fill: palette.primary, opacity: 0.12, layerRole: 'decor' }));
}

// ── CTA — a clean line, refined, no bar ──────────────────────────────────────
function ctaLine(o, text, palette, fonts, { x, y, w, align = 'left' }) {
  const size = fitFontSize(text, { width: w, height: 120, maxSize: 48, minSize: 30 });
  o.push(textbox({
    text, x, y, w, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align, charSpacing: 32, layerRole: 'cta', bgRef: DARK_BASE,
    shadow: OVERLAY_TEXT_SHADOW,
  }));
}

// ── portrait: hero image on top, headline, three stacked point rows, CTA ──────
function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed dark editorial backdrop, deep near-black, soft grain, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  atmosphere(o, palette, W, H,
    { x: W - 200, y: 400, r: 600 },
    { x: 200, y: H - 400, r: 480 }
  );

  const margin = 88;
  const innerW = W - margin * 2;

  // hero image — the big top ~45% band
  const heroY = 88;
  const heroH = 840;
  o.push(imageSlot({
    slotId: 'slot-1', x: margin, y: heroY, w: innerW, h: heroH,
    styleHint: 'editorial hero image, cinematic, single strong subject, no text',
    stroke: palette.primary, rx: 20
  }));

  // headline + subheadline beneath the hero
  const headTop = heroY + heroH + 40;
  const rowsTop = headlineZone(o, content, palette, fonts, { x: margin, y: headTop, w: innerW, maxSize: 108, align: 'left' }) + 24;

  // three point rows filling down to the CTA
  const blocks = content.blocks || [];
  const ctaY = 1872;
  const rowsBottom = ctaY - 56;
  const n = Math.max(blocks.length, 1);
  const rowGap = 24;
  const rowH = Math.round((rowsBottom - rowsTop - rowGap * (n - 1)) / n);

  blocks.forEach((b, i) => {
    const y = rowsTop + i * (rowH + rowGap);
    if (i > 0) hairline(o, palette, { x: margin, y: y - Math.round(rowGap / 2), w: innerW });
    pointRow(o, b, THUMB_SLOTS[i % THUMB_SLOTS.length], palette, fonts, { x: margin, y, w: innerW, h: rowH });
  });

  ctaLine(o, content.callToAction, palette, fonts, { x: margin, y: ctaY, w: innerW, align: 'left' });
  return canvas;
}

// ── landscape: REAL relayout — hero fills the left half, points stack right ───
function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed dark editorial backdrop, deep near-black, soft grain, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  atmosphere(o, palette, W, H,
    { x: 320, y: H - 200, r: 640 },
    { x: W - 320, y: 200, r: 480 }
  );

  const margin = 80;
  const leftW = 920;               // hero column (left half)
  const rightX = leftW + 80;
  const rightW = W - rightX - margin;

  // hero image — fills the left half
  o.push(imageSlot({
    slotId: 'slot-1', x: margin, y: 96, w: leftW - margin, h: H - 192,
    styleHint: 'editorial hero image, cinematic, single strong subject, no text',
    stroke: palette.primary, rx: 20
  }));

  // right column: headline + subheadline, three point rows, CTA
  const rowsTop = headlineZone(o, content, palette, fonts, { x: rightX, y: 96, w: rightW, maxSize: 88, align: 'left' }) + 20;

  const blocks = content.blocks || [];
  const ctaY = 1256;
  const rowsBottom = ctaY - 40;
  const n = Math.max(blocks.length, 1);
  const rowGap = 24;
  const rowH = Math.round((rowsBottom - rowsTop - rowGap * (n - 1)) / n);

  blocks.forEach((b, i) => {
    const y = rowsTop + i * (rowH + rowGap);
    if (i > 0) hairline(o, palette, { x: rightX, y: y - Math.round(rowGap / 2), w: rightW });
    pointRow(o, b, THUMB_SLOTS[i % THUMB_SLOTS.length], palette, fonts, { x: rightX, y, w: rightW, h: rowH });
  });

  ctaLine(o, content.callToAction, palette, fonts, { x: rightX, y: ctaY, w: rightW, align: 'left' });
  return canvas;
}

// ── previews ─────────────────────────────────────────────────────────────────
function pvGlow(parts, palette, spot) {
  parts.push(`<circle cx="${pv(spot.x)}" cy="${pv(spot.y)}" r="${pv(spot.r)}" fill="${palette.primary}" opacity="0.1"/>`);
}

function pvRow(parts, palette, { x, y, w, h }) {
  const thumb = Math.min(h - 8, 200);
  parts.push(pvSlot(pv(x), pv(y + (h - thumb) / 2), pv(thumb), pv(thumb), palette.primary));
  const textX = x + thumb + 40;
  const textW = x + w - textX;
  parts.push(pvRect(pv(textX), pv(y + 8), pv(textW * 0.5), pv(10), palette.primary, { rx: 3 }));
  parts.push(pvBars({ x: pv(textX), y: pv(y + 52), w: pv(textW), lines: 2, barH: 6, gap: 5, fill: DARK_INK }));
}

function previewPortrait(palette) {
  const parts = [];
  pvGlow(parts, palette, { x: 1214, y: 400, r: 600 });
  pvGlow(parts, { primary: palette.accent }, { x: 200, y: 1600, r: 480 });
  const margin = 88;
  const innerW = 1414 - margin * 2;
  // eyebrow rule
  parts.push(pvRect(pv(margin), pv(928), pv(48), pv(4), palette.primary, { rx: 2 }));
  // hero
  parts.push(pvSlot(pv(margin), pv(88), pv(innerW), pv(840), palette.primary));
  // headline
  parts.push(pvBars({ x: pv(margin), y: pv(946), w: pv(innerW), lines: 2, barH: 12, gap: 8, fill: DARK_INK }));
  // three rows
  const rowsTop = 1162;
  const ctaY = 1872;
  const rowsBottom = ctaY - 56;
  const n = 3;
  const rowGap = 24;
  const rowH = Math.round((rowsBottom - rowsTop - rowGap * (n - 1)) / n);
  for (let i = 0; i < n; i++) {
    const y = rowsTop + i * (rowH + rowGap);
    if (i > 0) parts.push(pvRect(pv(margin), pv(y - rowGap / 2), pv(innerW), pv(1), palette.primary, { opacity: 0.3 }));
    pvRow(parts, palette, { x: margin, y, w: innerW, h: rowH });
  }
  parts.push(pvBars({ x: pv(margin), y: pv(ctaY), w: pv(innerW * 0.68), lines: 1, barH: 12, gap: 6, fill: palette.primary }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [];
  pvGlow(parts, palette, { x: 320, y: 1214, r: 640 });
  pvGlow(parts, { primary: palette.accent }, { x: 1680, y: 200, r: 480 });
  const margin = 80;
  const leftW = 920;
  const rightX = leftW + 80;
  const rightW = 2000 - rightX - margin;
  // hero left half
  parts.push(pvSlot(pv(margin), pv(96), pv(leftW - margin), pv(1414 - 192), palette.primary));
  // eyebrow rule
  parts.push(pvRect(pv(rightX), pv(96), pv(48), pv(4), palette.primary, { rx: 2 }));
  // headline right
  parts.push(pvBars({ x: pv(rightX), y: pv(114), w: pv(rightW), lines: 2, barH: 11, gap: 7, fill: DARK_INK }));
  const rowsTop = 390;
  const ctaY = 1256;
  const rowsBottom = ctaY - 40;
  const n = 3;
  const rowGap = 24;
  const rowH = Math.round((rowsBottom - rowsTop - rowGap * (n - 1)) / n);
  for (let i = 0; i < n; i++) {
    const y = rowsTop + i * (rowH + rowGap);
    if (i > 0) parts.push(pvRect(pv(rightX), pv(y - rowGap / 2), pv(rightW), pv(1), palette.primary, { opacity: 0.3 }));
    pvRow(parts, palette, { x: rightX, y, w: rightW, h: rowH });
  }
  parts.push(pvBars({ x: pv(rightX), y: pv(ctaY), w: pv(rightW * 0.68), lines: 1, barH: 11, gap: 6, fill: palette.primary }));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'editorial-hero',
  name: 'Editorial hero',
  style: 'infographic',
  description: 'A premium editorial poster in the spirit of Vogue and Monocle: one big hero image dominates the top (the left half in landscape), the headline and optional subheadline sit clean beneath it, then a quiet column of three short points — each a small square thumbnail beside an uppercase primary label and warm off-white text, parted by a single hairline rule. A refined primary call to action closes the page over a full-bleed dark backdrop with a soft primary glow. No tiles, pills, or chips — only imagery and disciplined type.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'sequence', min: 3, max: 3, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 4,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
