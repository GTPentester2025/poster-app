// v2 template — update-stay-safe (style: bullet). A faithful port of the AB
// InBev "Update To Stay Safe" patching poster: near-black canvas, gold
// branding. A header kicker, a two-tone headline in a left column over a hero
// image bleeding to the right, a gold subheadline, then a left-column checklist
// of icon+text rows (icon disc + wrapped instruction), a dark statement bar,
// and a gold report bar at the foot. Portrait keeps the headline + checklist in
// a left column with the hero image on the right; landscape widens the headline
// column and runs the checklist as a right-hand column.
//
// Source → port: "Security Compliance & Awareness" kicker → decor textbox;
// "UPDATE TO STAY SAFE" headline → headlineZone; brewery-worker hero image →
// imageSlot; "OUR SYSTEMS. OUR BREW. OUR RESPONSIBILITY." → subheadline; 4
// icon+text checklist rows {text} with icons → checklistRow + per-block image
// slots; "SECURE TODAY. SAFE BREWERY TOMORROW." → statement bar; gold footer →
// ctaBar.

import {
  textbox, rect, circle, imageSlot,
  fitFontSize, estTextHeight, backgroundImageSlot,
  pv, pvRect, pvBars, pvCircle, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, dotGrid, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, legibilityScrim
} from './decor.js';

function ctaBar(o, text, palette, fonts, W, y, h = 152) {
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 200, height: h - 48, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((h - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: DARK_BASE, align: 'center', layerRole: 'cta', bgRef: palette.primary
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 340, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, lineHeight: 1.0,
    layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.0) + 20;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 140, maxSize: 42, minSize: 28, lineHeight: 1.26 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.head, fontWeight: '800', fill: palette.primary, lineHeight: 1.26,
      layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.26) + 16;
  }
  return cursor;
}

// one checklist row: icon disc on the left, wrapped instruction on the right
function checklistRow(o, b, palette, fonts, { x, y, w, h }) {
  const iconR = Math.min(48, Math.round(h * 0.32));
  const cx = x + iconR + 8;
  o.push(circle({ x: cx, y: y + h / 2, r: iconR, fill: DARK_PANEL, stroke: palette.primary, strokeWidth: 3, layerRole: 'background' }));
  o.push(imageSlot({
    slotId: `slot-${b.id}`, x: Math.round(cx - iconR * 0.6), y: Math.round(y + h / 2 - iconR * 0.6),
    w: Math.round(iconR * 1.2), h: Math.round(iconR * 1.2),
    styleHint: `flat gold line icon for the security step: "${b.text}", no text`,
    stroke: palette.primary, rx: 8, blockId: b.id
  }));

  const textX = cx + iconR + 32;
  const textW = x + w - textX;
  const size = fitFontSize(b.text, { width: textW, height: h - 8, maxSize: 46, minSize: 38, lineHeight: 1.24 });
  const th = estTextHeight(b.text, size, textW, 1.24);
  o.push({
    ...textbox({
      text: b.text, x: textX, y: Math.round(y + h / 2 - th / 2), w: textW, fontSize: size,
      fontFamily: fonts.body, fontWeight: '700', fill: DARK_INK, lineHeight: 1.24,
      layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'text'
  });
}

function checklist(o, blocks, palette, fonts, { x, y, w, h }) {
  const gap = 16;
  const n = Math.max(blocks.length, 1);
  const rowH = Math.round((h - gap * (n - 1)) / n);
  blocks.forEach((b, i) => checklistRow(o, b, palette, fonts, { x, y: y + i * (rowH + gap), w, h: rowH }));
}

// dark statement bar with centered two-tone text
function statementBar(o, text, palette, fonts, x, y, w, h = 110) {
  o.push(rect({ x, y, w, h, fill: DARK_PANEL, rx: 14, layerRole: 'background' }));
  const t = String(text).toUpperCase();
  const size = fitFontSize(t, { width: w - 60, height: h - 28, maxSize: 46, minSize: 26 });
  o.push(textbox({
    text: t, x: x + 30, y: y + Math.round((h - estTextHeight(t, size, w - 60)) / 2),
    w: w - 60, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_INK, align: 'center', layerRole: 'decor', bgRef: DARK_PANEL
  }));
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'brewery worker in a hard hat and hi-vis vest beside stainless tanks, deep near-black, warm gold light, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({ spots: [
    { x: 1180, y: 360, r: 420, color: palette.primary },
    { x: 220, y: 1500, r: 380, color: palette.accent }
  ], intensity: 0.7 }));
  o.push(...dotGrid({ x: 96, y: 340, cols: 5, rows: 3, gap: 50, dotR: 4, color: palette.primary, intensity: 0.6 }));

  o.push(textbox({
    text: 'Security Compliance & Awareness', x: W - 620, y: 96, w: 524,
    fontSize: 30, fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
    align: 'right', layerRole: 'decor', bgRef: DARK_BASE
  }));

  const colW = 720;
  headlineZone(o, content, palette, fonts, { x: 96, y: 176, w: colW, maxSize: 150 });

  // hero image bleeding right
  o.push(imageSlot({
    slotId: 'slot-hero', x: 856, y: 176, w: 462, h: 900,
    styleHint: 'brewery operator in hard hat and hi-vis vest at OT control panel, cinematic, no text',
    stroke: palette.primary
  }));

  checklist(o, content.blocks || [], palette, fonts, { x: 96, y: 560, w: colW, h: 1000 });

  statementBar(o, 'Secure today. Safe brewery tomorrow.', palette, fonts, 96, 1600, W - 192, 120);

  ctaBar(o, content.callToAction, palette, fonts, W, 1848);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'brewery worker in a hard hat and hi-vis vest beside stainless tanks, deep near-black, warm gold light, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({ spots: [
    { x: 340, y: 320, r: 420, color: palette.primary },
    { x: 1720, y: 1120, r: 400, color: palette.accent }
  ], intensity: 0.7 }));
  o.push(...dotGrid({ x: 96, y: 980, cols: 5, rows: 3, gap: 50, dotR: 4, color: palette.primary, intensity: 0.6 }));

  const colW = 900;
  o.push(textbox({
    text: 'Security Compliance & Awareness', x: 96, y: 96, w: colW,
    fontSize: 30, fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
    align: 'left', layerRole: 'decor', bgRef: DARK_BASE
  }));
  const headCursor = headlineZone(o, content, palette, fonts, { x: 96, y: 172, w: colW, maxSize: 132 });
  o.push(imageSlot({
    slotId: 'slot-hero', x: 96, y: Math.max(headCursor + 16, 640), w: colW, h: 440,
    styleHint: 'brewery operator in hard hat and hi-vis vest at OT control panel, cinematic, no text',
    stroke: palette.primary
  }));

  const rightX = 96 + colW + 48;
  const rightW = W - rightX - 96;
  checklist(o, content.blocks || [], palette, fonts, { x: rightX, y: 140, w: rightW, h: 940 });
  statementBar(o, 'Secure today. Safe brewery tomorrow.', palette, fonts, rightX, 1120, rightW, 130);

  ctaBar(o, content.callToAction, palette, fonts, W, 1290, 124);
  return canvas;
}

// ── previews ────────────────────────────────────────────────────────────────

function checklistPreview(parts, x, y, w, h, n, palette) {
  const gap = 16;
  const rowH = (h - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const ry = y + i * (rowH + gap);
    const r = Math.min(48, rowH * 0.32);
    const cx = x + r + 8;
    parts.push(pvCircle(pv(cx), pv(ry + rowH / 2), pv(r), DARK_PANEL, { stroke: palette.primary }));
    const textX = cx + r + 32;
    parts.push(pvBars({ x: pv(textX), y: pv(ry + rowH / 2 - 10), w: pv(x + w - textX), lines: 2, barH: 5, gap: 4, fill: DARK_INK }));
  }
}

function previewPortrait(palette) {
  const W = 1414;
  const colW = 720;
  const parts = [
    pvBars({ x: pv(96), y: pv(176), w: pv(colW), lines: 3, barH: 13, gap: 8, fill: DARK_INK }),
    pvSlot(pv(856), pv(176), pv(462), pv(900), palette.primary)
  ];
  checklistPreview(parts, 96, 560, colW, 1000, 4, palette);
  parts.push(pvRect(pv(96), pv(1600), pv(W - 192), pv(120), DARK_PANEL, { rx: 4 }));
  parts.push(pvRect(0, pv(1848), 200, pv(152), palette.primary));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const colW = 900;
  const parts = [
    pvBars({ x: pv(96), y: pv(172), w: pv(colW), lines: 3, barH: 11, gap: 7, fill: DARK_INK }),
    pvSlot(pv(96), pv(640), pv(colW), pv(440), palette.primary)
  ];
  const rightX = 96 + colW + 48;
  const rightW = 2000 - rightX - 96;
  checklistPreview(parts, rightX, 140, rightW, 940, 4, palette);
  parts.push(pvRect(pv(rightX), pv(1120), pv(rightW), pv(130), DARK_PANEL, { rx: 4 }));
  parts.push(pvRect(0, pv(1290), PV_LAND_W, pv(124), palette.primary));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'update-stay-safe',
  name: 'Update To Stay Safe',
  style: 'bullet',
  description: 'A near-black, gold-branded patching poster: a two-tone headline over a hero image, a gold subheadline, then a checklist of icon+text steps, a dark statement bar, and a gold report bar at the foot.',
  contentSchema: {
    headline: { required: true, maxWords: 5 },
    subheadline: { required: false, maxWords: 8 },
    blocks: { kind: 'sequence', min: 4, max: 4, fields: ['text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 5,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
