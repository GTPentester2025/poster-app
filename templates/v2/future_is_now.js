// v2 template — future-is-now (style: infographic). A faithful port of the AB
// InBev "The Future Is Now" cyber-readiness poster: near-black canvas, gold
// branding. A header kicker, a big multi-line headline (white/white/gold) over
// a hero image bleeding to the right, a subheadline, a gold chevron statement
// banner, then a row of icon cells (icon + gold label + description), a
// silver/charcoal statement bar with a lock badge, and a gold report bar at the
// foot. Portrait runs the icon cells as one 5-wide row; landscape keeps the
// headline column left and the icon cells as a right-hand row.
//
// Source → port: "Security Compliance & Awareness" kicker → decor textbox;
// "THE FUTURE IS NOW :" headline + hero image → headlineZone + imageSlot;
// "STAY CYBER READY" → subheadline; "STAY AHEAD OF TOMORROW'S RISKS" chevron
// banner → chevronBar; 5 icon columns {label, text} with icons → iconCell +
// per-block imageSlots; "SECURE TODAY. SAFER TOMORROW." silver bar → statement
// bar; gold footer → ctaBar.

import {
  textbox, rect, circle, imageSlot, polygon,
  fitFontSize, estTextHeight, backgroundImageSlot,
  pv, pvRect, pvBars, pvCircle, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, dotGrid, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, legibilityScrim
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
  const headSize = fitFontSize(content.headline, { width: w, height: 400, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, lineHeight: 1.02,
    layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.02) + 20;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 48, minSize: 30, lineHeight: 1.24 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.head, fontWeight: '800', fill: DARK_INK, lineHeight: 1.24,
      layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.24) + 16;
  }
  return cursor;
}

// gold chevron statement banner with arrow flourishes
function chevronBar(o, text, palette, fonts, x, y, w, h = 96) {
  const t = String(text).toUpperCase();
  // arrow chevrons at both ends (decor)
  const chev = (cx, dir) => polygon(
    [{ x: cx, y: y + 12 }, { x: cx + dir * 36, y: y + h / 2 }, { x: cx, y: y + h - 12 }],
    { fill: palette.primary, layerRole: 'decor', opacity: 0.2 }
  );
  o.push(chev(x, 1));
  o.push(chev(x + w, -1));
  const barX = x + 56;
  const barW = w - 112;
  o.push(rect({ x: barX, y, w: barW, h, fill: palette.primary, rx: 8, layerRole: 'decor', opacity: 0.2 }));
  o.push(rect({ x: barX, y, w: barW, h, fill: 'transparent', stroke: palette.primary, strokeWidth: 3, rx: 8, layerRole: 'decor', opacity: 0.2 }));
  const size = fitFontSize(t, { width: barW - 60, height: h - 28, maxSize: 40, minSize: 22 });
  o.push(textbox({
    text: t, x: barX + 30, y: y + Math.round((h - estTextHeight(t, size, barW - 60)) / 2),
    w: barW - 60, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_INK, align: 'center', layerRole: 'decor', bgRef: DARK_PANEL
  }));
}

function iconCell(o, b, palette, fonts, { x, y, w, h }) {
  const iconR = Math.min(60, Math.round(w * 0.26));
  const cx = x + w / 2;
  o.push(circle({ x: cx, y: y + iconR, r: iconR, fill: DARK_PANEL, stroke: palette.primary, strokeWidth: 4, layerRole: 'background' }));
  o.push(imageSlot({
    slotId: `slot-${b.id}`, x: Math.round(cx - iconR * 0.62), y: Math.round(y + iconR - iconR * 0.62),
    w: Math.round(iconR * 1.24), h: Math.round(iconR * 1.24),
    styleHint: `flat gold line icon representing "${b.label}" cyber-readiness action, no text`,
    stroke: palette.primary, rx: 8, blockId: b.id
  }));

  let cy = y + iconR * 2 + 18;
  const labSize = fitFontSize(b.label, { width: w, height: 110, maxSize: 32, minSize: 22, lineHeight: 1.12 });
  o.push({
    ...textbox({
      text: String(b.label).toUpperCase(), x, y: cy, w, fontSize: labSize,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.primary, align: 'center', lineHeight: 1.12,
      layerRole: 'message-label', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'label'
  });
  cy += estTextHeight(b.label, labSize, w, 1.12) + 12;

  const descH = Math.max(120, y + h - cy);
  const descSize = fitFontSize(b.text, { width: w, height: descH, maxSize: 42, minSize: 16, lineHeight: 1.24 });
  o.push({
    ...textbox({
      text: b.text, x, y: cy, w, fontSize: descSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK, align: 'center', lineHeight: 1.24,
      layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'text'
  });
}

function iconRow(o, blocks, palette, fonts, { x, y, w, h }) {
  const gap = 14;
  const n = Math.max(blocks.length, 1);
  const cellW = Math.round((w - gap * (n - 1)) / n);
  blocks.forEach((b, i) => iconCell(o, b, palette, fonts, { x: x + i * (cellW + gap), y, w: cellW, h }));
}

// silver/charcoal statement bar with a lock badge + hazard accent
function silverBar(o, text, palette, fonts, x, y, w, h = 140) {
  o.push(rect({ x, y, w, h, fill: DARK_PANEL_2, rx: 16, layerRole: 'background' }));
  const badgeR = Math.round(h * 0.34);
  const bx = x + 40 + badgeR;
  o.push(circle({ x: bx, y: y + h / 2, r: badgeR, fill: palette.primary, layerRole: 'decor', opacity: 0.2 }));
  o.push(circle({ x: bx, y: y + h / 2, r: badgeR, fill: 'transparent', stroke: palette.primary, strokeWidth: 4, layerRole: 'decor', opacity: 0.2 }));
  const textX = bx + badgeR + 36;
  const textW = x + w - textX - 40;
  const t = String(text).toUpperCase();
  const size = fitFontSize(t, { width: textW, height: h - 36, maxSize: 44, minSize: 26 });
  o.push(textbox({
    text: t, x: textX, y: y + Math.round((h - estTextHeight(t, size, textW)) / 2),
    w: textW, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_INK, align: 'left', layerRole: 'decor', bgRef: DARK_PANEL_2
  }));
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'futuristic smart brewery with robotic arms and glowing data screens, deep near-black, gold and teal light, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({ spots: [
    { x: 1160, y: 340, r: 440, color: palette.primary },
    { x: 240, y: 1520, r: 380, color: palette.accent }
  ], intensity: 0.7 }));
  o.push(...dotGrid({ x: 96, y: 900, cols: 6, rows: 4, gap: 52, dotR: 4, color: palette.primary, intensity: 0.6 }));

  o.push(textbox({
    text: 'Security Compliance & Awareness', x: W - 620, y: 96, w: 524,
    fontSize: 30, fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
    align: 'right', layerRole: 'decor', bgRef: DARK_BASE
  }));

  headlineZone(o, content, palette, fonts, { x: 96, y: 200, w: 720, maxSize: 140 });

  // hero image bleeding to the right of the headline column
  o.push(imageSlot({
    slotId: 'slot-hero', x: 856, y: 200, w: 462, h: 560,
    styleHint: 'futuristic brewery control room, shields and locks over data, robotic arm, cinematic, no text',
    stroke: palette.primary
  }));

  chevronBar(o, 'Stay ahead of tomorrow’s risks', palette, fonts, 96, 840, W - 192, 100);

  iconRow(o, content.blocks || [], palette, fonts, { x: 96, y: 1000, w: W - 192, h: 500 });

  silverBar(o, 'Secure today. Safer tomorrow.', palette, fonts, 96, 1580, W - 192, 150);

  ctaBar(o, content.callToAction, palette, fonts, W, 1848);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'futuristic smart brewery with robotic arms and glowing data screens, deep near-black, gold and teal light, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({ spots: [
    { x: 340, y: 320, r: 440, color: palette.primary },
    { x: 1720, y: 1120, r: 400, color: palette.accent }
  ], intensity: 0.7 }));
  o.push(...dotGrid({ x: 96, y: 980, cols: 5, rows: 3, gap: 50, dotR: 4, color: palette.primary, intensity: 0.6 }));

  const colW = 760;
  o.push(textbox({
    text: 'Security Compliance & Awareness', x: 96, y: 96, w: colW,
    fontSize: 30, fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
    align: 'left', layerRole: 'decor', bgRef: DARK_BASE
  }));
  const headCursor = headlineZone(o, content, palette, fonts, { x: 96, y: 172, w: colW, maxSize: 124 });
  o.push(imageSlot({
    slotId: 'slot-hero', x: 96, y: Math.max(headCursor + 16, 700), w: colW, h: 380,
    styleHint: 'futuristic brewery control room, shields and locks over data, robotic arm, cinematic, no text',
    stroke: palette.primary
  }));

  const rightX = 96 + colW + 48;
  const rightW = W - rightX - 96;
  chevronBar(o, 'Stay ahead of tomorrow’s risks', palette, fonts, rightX, 130, rightW, 92);
  iconRow(o, content.blocks || [], palette, fonts, { x: rightX, y: 262, w: rightW, h: 560 });
  silverBar(o, 'Secure today. Safer tomorrow.', palette, fonts, rightX, 870, rightW, 130);

  ctaBar(o, content.callToAction, palette, fonts, W, 1290, 124);
  return canvas;
}

// ── previews ────────────────────────────────────────────────────────────────

function iconRowPreview(parts, x, y, w, h, palette) {
  const gap = 14, n = 5;
  const cellW = (w - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const cx = x + i * (cellW + gap) + cellW / 2;
    const r = Math.min(60, cellW * 0.26);
    parts.push(pvCircle(pv(cx), pv(y + r), pv(r), DARK_PANEL, { stroke: palette.primary }));
    parts.push(pvRect(pv(x + i * (cellW + gap) + cellW * 0.15), pv(y + r * 2 + 18), pv(cellW * 0.7), 6, palette.primary, { rx: 2 }));
    parts.push(pvBars({ x: pv(x + i * (cellW + gap)), y: pv(y + r * 2 + 42), w: pv(cellW), lines: 3, barH: 4, gap: 3, fill: DARK_INK, align: 'center' }));
  }
}

function previewPortrait(palette) {
  const W = 1414;
  const parts = [
    pvBars({ x: pv(96), y: pv(200), w: pv(720), lines: 3, barH: 14, gap: 8, fill: DARK_INK }),
    pvSlot(pv(856), pv(200), pv(462), pv(560), palette.primary),
    pvRect(pv(152), pv(840), pv(W - 304), pv(100), palette.primary, { rx: 3 })
  ];
  iconRowPreview(parts, 96, 1000, W - 192, 500, palette);
  parts.push(pvRect(pv(96), pv(1580), pv(W - 192), pv(150), DARK_PANEL_2, { rx: 4 }));
  parts.push(pvRect(0, pv(1848), 200, pv(152), palette.primary));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const colW = 760;
  const parts = [
    pvBars({ x: pv(96), y: pv(172), w: pv(colW), lines: 3, barH: 11, gap: 7, fill: DARK_INK }),
    pvSlot(pv(96), pv(700), pv(colW), pv(380), palette.primary)
  ];
  const rightX = 96 + colW + 48;
  const rightW = 2000 - rightX - 96;
  parts.push(pvRect(pv(rightX + 56), pv(130), pv(rightW - 112), pv(92), palette.primary, { rx: 3 }));
  iconRowPreview(parts, rightX, 262, rightW, 560, palette);
  parts.push(pvRect(pv(rightX), pv(870), pv(rightW), pv(130), DARK_PANEL_2, { rx: 4 }));
  parts.push(pvRect(0, pv(1290), PV_LAND_W, pv(124), palette.primary));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'future-is-now',
  name: 'The Future Is Now',
  style: 'infographic',
  description: 'A near-black, gold-branded cyber-readiness poster: a bold multi-line headline over a hero image, a gold chevron statement banner, then a row of icon cells (icon + gold label + description), a charcoal statement bar with a lock badge, and a gold report bar at the foot.',
  contentSchema: {
    headline: { required: true, maxWords: 6 },
    subheadline: { required: false, maxWords: 6 },
    blocks: { kind: 'cells', min: 5, max: 5, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 6,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
