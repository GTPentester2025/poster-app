// v2 template — guard-your-data (style: bullet). A faithful port of the AB
// InBev "Guard Your Data" poster: near-black canvas, gold branding. A header
// row (kicker) + gold hairline, a big two-tone headline, a full-width hero
// image band, a centered statement line flanked by rule flourishes, then a
// gold "Don't" panel with a side image and a bulleted list of do-not rules.
// A gold report bar anchors the foot. Portrait stacks hero → statement →
// gold list panel; landscape runs the headline + hero column on the left and
// the gold rule panel on the right.
//
// Source → port: "Security & Compliance Awareness" kicker → decor textbox;
// "GUARD YOUR DATA" white/gold headline → headlineZone; wide hero image →
// imageSlot band; "LOCK IT. LIMIT IT. SHARE CAREFULLY." → statement line;
// gold panel with "Don't…" bullets (+ side image) → bulletPanel; gold footer
// report line → ctaBar.

import {
  textbox, rect, circle, imageSlot, hline,
  fitFontSize, estTextHeight, backgroundImageSlot,
  pv, pvRect, pvBars, pvSlot, pvCircle
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, dotGrid, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_INK, legibilityScrim
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
  const headSize = fitFontSize(content.headline, { width: w, height: 320, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, lineHeight: 1.02,
    layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.02) + 20;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 130, maxSize: 42, minSize: 28, lineHeight: 1.3 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '700', fill: palette.primary, lineHeight: 1.3,
      layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.3) + 16;
  }
  return cursor;
}

// centered statement line with rule flourishes on both sides
function statementLine(o, text, palette, fonts, x, y, w) {
  const t = String(text).toUpperCase();
  const size = fitFontSize(t, { width: w - 200, height: 96, maxSize: 48, minSize: 30 });
  const midY = y + 40;
  o.push(hline({ x, y: midY, w: 90, thickness: 4, fill: palette.primary, layerRole: 'decor' }));
  o.push(hline({ x: x + w - 90, y: midY, w: 90, thickness: 4, fill: palette.primary, layerRole: 'decor' }));
  o.push(textbox({
    text: t, x: x + 100, y: midY - Math.round(estTextHeight(t, size, w - 200) / 2),
    w: w - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_INK, align: 'center', layerRole: 'decor', bgRef: DARK_BASE
  }));
}

// gold "Don't" panel: side image + bulleted list of rules
// Uses a running-cursor reflow so long text in any block doesn't collide with the next.
function bulletPanel(o, blocks, palette, fonts, { x, y, w, h }) {
  o.push(rect({ x, y, w, h, fill: palette.primary, rx: 20, layerRole: 'decor', opacity: 0.2 }));
  o.push(rect({ x, y, w, h, fill: 'transparent', stroke: palette.primary, strokeWidth: 3, rx: 20, layerRole: 'decor', opacity: 0.2 }));

  const pad = 40;
  const imgW = Math.round(w * 0.28);
  o.push(imageSlot({
    slotId: 'slot-dont', x: x + pad, y: y + pad, w: imgW, h: h - pad * 2,
    styleHint: 'brewery worker raising a hand in a stop gesture, "do not" warning, cinematic, no text',
    stroke: DARK_BASE
  }));

  const listX = x + pad + imgW + 40;
  const listW = w - (listX - x) - pad;
  const n = Math.max(blocks.length, 1);
  // Compute each row's actual text height so we can derive a uniform font size
  // that fits all blocks within the available panel height (reflow + scale approach).
  const textX = listX + 40;
  const textW = listW - 40;
  const listH = h - pad * 2;
  // Find a font size where the sum of all block text heights fits within listH.
  // Step from maxSize down until the total fits, stopping at minSize=22.
  let chosenSize = 44;
  for (let s = 44; s >= 22; s -= 2) {
    const total = blocks.reduce((acc, b) => acc + estTextHeight(b.text, s, textW, 1.22) + 14, 0);
    if (total <= listH) { chosenSize = s; break; }
    chosenSize = s; // accept even if not perfect — we'll use running cursor
  }
  // Render rows with a running cursor so each row is properly spaced.
  let cursor = y + pad;
  blocks.forEach((b) => {
    const th = estTextHeight(b.text, chosenSize, textW, 1.22);
    const bulletY = Math.round(cursor + th / 2);
    o.push(circle({ x: listX + 12, y: bulletY, r: 9, fill: DARK_BASE, layerRole: 'decor' }));
    o.push({
      ...textbox({
        text: b.text, x: textX, y: Math.round(cursor), w: textW, fontSize: chosenSize,
        fontFamily: fonts.body, fontWeight: '700', fill: DARK_BASE, lineHeight: 1.22,
        layerRole: 'message', msgId: b.id, bgRef: palette.primary
      }),
      fieldRef: 'text'
    });
    cursor += th + 14;
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark industrial brewery data-security backdrop, deep near-black with gold accents, subtle circuitry texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({ spots: [
    { x: 1180, y: 320, r: 420, color: palette.primary },
    { x: 220, y: 1520, r: 380, color: palette.accent }
  ], intensity: 0.7 }));
  o.push(...dotGrid({ x: 96, y: 320, cols: 6, rows: 3, gap: 50, dotR: 4, color: palette.primary, intensity: 0.6 }));

  o.push(textbox({
    text: 'Security & Compliance Awareness', x: W - 620, y: 96, w: 524,
    fontSize: 30, fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
    align: 'right', layerRole: 'decor', bgRef: DARK_BASE
  }));
  o.push(hline({ x: 96, y: 168, w: W - 192, thickness: 4, fill: palette.primary, layerRole: 'decor' }));

  const headCursor = headlineZone(o, content, palette, fonts, { x: 96, y: 200, w: W - 192, maxSize: 148 });

  // hero image band — height capped at 300 to leave sufficient panel space for long content
  const heroY = Math.max(headCursor + 8, 470);
  o.push(imageSlot({
    slotId: 'slot-hero', x: 96, y: heroY, w: W - 192, h: 300,
    styleHint: 'secure data flow through a brewery, glowing shield and padlock over pipelines, operator at controls, cinematic, no text',
    stroke: palette.primary
  }));

  const stmtY = heroY + 300 + 32;
  statementLine(o, content.subheadline || 'Lock it. Limit it. Share carefully.', palette, fonts, 96, stmtY, W - 192);

  const panelY = stmtY + 100;
  bulletPanel(o, content.blocks || [], palette, fonts, { x: 96, y: panelY, w: W - 192, h: 1836 - panelY });

  ctaBar(o, content.callToAction, palette, fonts, W, 1848);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark industrial brewery data-security backdrop, deep near-black with gold accents, subtle circuitry texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({ spots: [
    { x: 320, y: 320, r: 420, color: palette.primary },
    { x: 1720, y: 1120, r: 400, color: palette.accent }
  ], intensity: 0.7 }));
  o.push(...dotGrid({ x: 96, y: 980, cols: 5, rows: 3, gap: 50, dotR: 4, color: palette.primary, intensity: 0.6 }));

  const colW = 820;
  o.push(textbox({
    text: 'Security & Compliance Awareness', x: 96, y: 96, w: colW,
    fontSize: 30, fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
    align: 'left', layerRole: 'decor', bgRef: DARK_BASE
  }));
  o.push(hline({ x: 96, y: 152, w: colW, thickness: 4, fill: palette.primary, layerRole: 'decor' }));

  const headCursor = headlineZone(o, content, palette, fonts, { x: 96, y: 184, w: colW, maxSize: 118 });

  o.push(imageSlot({
    slotId: 'slot-hero', x: 96, y: Math.max(headCursor + 12, 640), w: colW, h: 440,
    styleHint: 'secure data flow through a brewery, glowing shield and padlock over pipelines, operator at controls, cinematic, no text',
    stroke: palette.primary
  }));

  // right column: statement line + gold bullet panel
  const rightX = 96 + colW + 48;
  const rightW = W - rightX - 96;
  statementLine(o, content.subheadline || 'Lock it. Limit it. Share carefully.', palette, fonts, rightX, 176, rightW);
  bulletPanel(o, content.blocks || [], palette, fonts, { x: rightX, y: 300, w: rightW, h: 978 });

  ctaBar(o, content.callToAction, palette, fonts, W, 1290, 124);
  return canvas;
}

// ── previews ────────────────────────────────────────────────────────────────

function bulletPanelPreview(parts, x, y, w, h, palette) {
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), palette.primary, { rx: 4, opacity: 0.85 }));
  const imgW = w * 0.28;
  parts.push(pvSlot(pv(x + 40), pv(y + 40), pv(imgW), pv(h - 80), DARK_BASE));
  const listX = x + 40 + imgW + 40;
  for (let i = 0; i < 5; i++) {
    const cy = y + 40 + (i + 0.5) * ((h - 80) / 5);
    parts.push(pvCircle(pv(listX + 12), pv(cy), 2, DARK_BASE));
    parts.push(pvRect(pv(listX + 40), pv(cy - 4), pv(w - (listX - x) - 40 - 40), 6, DARK_BASE, { rx: 2 }));
  }
}

function previewPortrait(palette) {
  const W = 1414;
  const parts = [
    pvRect(pv(96), pv(168), pv(W - 192), 4, palette.primary),
    pvBars({ x: pv(96), y: pv(200), w: pv(W - 192), lines: 1, barH: 12, gap: 6, fill: DARK_INK }),
    pvSlot(pv(96), pv(470), pv(W - 192), pv(560), palette.primary),
    pvRect(pv(96), pv(1090), 90 * 0.1414, 4, palette.primary),
    pvRect(pv(W - 96 - 90), pv(1090), 90 * 0.1414, 4, palette.primary)
  ];
  bulletPanelPreview(parts, 96, 1182, W - 192, 1784 - 1182, palette);
  parts.push(pvRect(0, pv(1848), 200, pv(152), palette.primary));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const colW = 820;
  const parts = [
    pvRect(pv(96), pv(152), pv(colW), 4, palette.primary),
    pvBars({ x: pv(96), y: pv(184), w: pv(colW), lines: 2, barH: 9, gap: 5, fill: DARK_INK }),
    pvSlot(pv(96), pv(640), pv(colW), pv(440), palette.primary)
  ];
  const rightX = 96 + colW + 48;
  const rightW = 2000 - rightX - 96;
  parts.push(pvRect(pv(rightX), pv(216), 90 * 0.1414, 4, palette.primary));
  bulletPanelPreview(parts, rightX, 300, rightW, 964, palette);
  parts.push(pvRect(0, pv(1290), PV_LAND_W, pv(124), palette.primary));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'guard-your-data',
  name: 'Guard Your Data',
  style: 'bullet',
  description: 'A near-black, gold-branded data-protection poster: a two-tone headline over a wide hero image band, a centered statement flanked by rule flourishes, then a gold panel with a side image and a bulleted list of do-not rules. A gold report bar anchors the foot.',
  contentSchema: {
    headline: { required: true, maxWords: 6 },
    subheadline: { required: false, maxWords: 8 },
    blocks: { kind: 'sequence', min: 4, max: 6, fields: ['text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 2,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
