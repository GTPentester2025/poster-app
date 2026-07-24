// v2 template — tips-card (style: bullet). A faithful port of the AB InBev
// "Phishing Protection – Don't Fall For Scams" dark tips card (source 12.html).
// Near-black canvas, gold accent, vertical stack of 3–4 tip rows each with an
// icon-accent disc and wrapped message text, a report-email line, and a QR
// content imageSlot at the foot. Portrait keeps headline over a centred shield
// motif above the tip stack; landscape runs the headline and shield on the left
// column with the tips on the right.
//
// Source → port:
//   "Phishing Protection" headline → headlineZone
//   "Don't Fall For Scams!" subtitle → subheadline (palette.primary)
//   "Here's how to stay safe:" shield-badge text → decor textbox
//   3 tip rows (click / trick / report) → checklistRow × blocks (sequence min3/max4)
//   Footer QR code (base64 stripped) → content imageSlot slotId 'slot-qr'
//   "BE VIGILANT AND REPORT ANY SUSPICIOUS ACTIVITY TO …" → ctaBar

import {
  textbox, rect, circle, imageSlot,
  fitFontSize, fitTextBlock, estTextHeight, backgroundImageSlot,
  pv, pvRect, pvBars, pvCircle, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, dotGrid, shieldMotif, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, legibilityScrim
} from './decor.js';

// ── shared layout helpers ────────────────────────────────────────────────────

/** Yellow CTA bar full-width at the bottom. */
function ctaBar(o, text, palette, fonts, W, y, h = 152) {
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 200, height: h - 48, maxSize: 40, minSize: 28 });
  const th = estTextHeight(text, size, W - 200);
  o.push(textbox({
    text, x: 100, y: y + Math.round((h - th) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: DARK_BASE, align: 'center', layerRole: 'cta', bgRef: palette.primary
  }));
}

/**
 * Headline + optional subheadline zone. Returns the cursor (y) after
 * all text has been laid out.
 */
function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const { fontSize: headSize, height: headH } = fitTextBlock(content.headline, {
    width: w, height: 360, maxSize, minSize: 80, lineHeight: 1.0
  });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, lineHeight: 1.0,
    layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + headH + 20;

  if (content.subheadline) {
    const { fontSize: subSize, height: subH } = fitTextBlock(content.subheadline, {
      width: w, height: 120, maxSize: 44, minSize: 28, lineHeight: 1.26
    });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.head, fontWeight: '800', fill: palette.primary, lineHeight: 1.26,
      layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += subH + 16;
  }
  return cursor;
}

/**
 * One tip row: a coloured accent disc on the left, wrapped tip text on the
 * right. Returns the Textbox so callers can inspect its y position.
 */
function tipRow(o, b, palette, fonts, { x, y, w, h }) {
  const discR = Math.min(40, Math.round(h * 0.30));
  const cx = x + discR + 8;
  const cy = Math.round(y + h / 2);

  // accent disc
  o.push(circle({
    x: cx, y: cy, r: discR,
    fill: DARK_PANEL_2, stroke: palette.primary, strokeWidth: 3,
    layerRole: 'background'
  }));
  // small decorative dot inside disc
  o.push(circle({ x: cx, y: cy, r: Math.round(discR * 0.22), fill: palette.primary, opacity: 0.9, layerRole: 'decor' }));

  const textX = cx + discR + 28;
  const textW = x + w - textX;
  const { fontSize: msgSize, height: msgH } = fitTextBlock(b.text, {
    width: textW, height: h - 8, maxSize: 48, minSize: 38, lineHeight: 1.22
  });
  const msgY = Math.round(cy - msgH / 2);
  o.push({
    ...textbox({
      text: b.text, x: textX, y: msgY, w: textW, fontSize: msgSize,
      fontFamily: fonts.body, fontWeight: '700', fill: DARK_INK, lineHeight: 1.22,
      layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'text'
  });
}

/**
 * Vertical stack of tip rows. Distributes rows evenly in the zone h.
 */
function tipStack(o, blocks, palette, fonts, { x, y, w, h }) {
  const gap = 20;
  const n = Math.max(blocks.length, 1);
  // Card panel behind all rows
  o.push(rect({ x, y, w, h, fill: DARK_PANEL, rx: 24, layerRole: 'background' }));

  const rowH = Math.round((h - gap * (n - 1) - 48) / n);
  blocks.forEach((b, i) => {
    tipRow(o, b, palette, fonts, {
      x: x + 24, y: y + 24 + i * (rowH + gap), w: w - 48, h: rowH
    });
  });
}

// ── report-email accent line ──────────────────────────────────────────────────

function reportLine(o, palette, fonts, x, y, w) {
  const text = 'Report suspicious activity immediately';
  const size = fitFontSize(text, { width: w, height: 56, maxSize: 36, minSize: 24 });
  const th = estTextHeight(text, size, w, 1.18);
  o.push(rect({ x, y: y - 8, w, h: th + 24, fill: DARK_PANEL_2, rx: 12, layerRole: 'background' }));
  o.push(textbox({
    text, x: x + 16, y: y, w: w - 32, fontSize: size,
    fontFamily: fonts.head, fontWeight: '800', fill: palette.primary, lineHeight: 1.18,
    align: 'center', layerRole: 'decor', bgRef: DARK_PANEL_2
  }));
  return th + 24;
}

// ── portrait build ────────────────────────────────────────────────────────────

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  // 1. Background slot + scrim
  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'dark cybersecurity abstract background — deep charcoal, subtle gold light rays, no text',
    stroke: palette.primary
  }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // 2. Atmosphere decor
  o.push(...meshGlow({ spots: [
    { x: 1180, y: 260, r: 400, color: palette.primary },
    { x: 200, y: 1680, r: 360, color: palette.accent }
  ], intensity: 0.65 }));
  o.push(...dotGrid({ x: 80, y: 1100, cols: 4, rows: 4, gap: 56, dotR: 4, color: palette.primary, intensity: 0.5 }));

  // 3. Shield motif (background decor only — no embedded text, per "never bake")
  o.push(...shieldMotif({ x: W / 2, y: 152, size: 320, color: palette.primary, intensity: 0.55 }));

  // 4. Headline zone — centred, wide
  const PAD = 96;
  const zoneW = W - PAD * 2;
  let cursor = headlineZone(o, content, palette, fonts, { x: PAD, y: 200, w: zoneW, maxSize: 140 });
  cursor = Math.max(cursor, 560);

  // 5. Tip stack — fills the middle zone
  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  // Reserve: reportLine ~80px + imageSlot 200px + ctaBar 152px + gap 48px
  const stackBottom = H - 152 - 200 - 80 - 48 - 24;
  const stackH = Math.max(n * 160 + (n - 1) * 20 + 48, stackBottom - cursor - 24);
  const stackY = Math.min(cursor + 24, stackBottom - stackH);
  tipStack(o, blocks, palette, fonts, { x: PAD, y: stackY, w: zoneW, h: stackH });

  // 6. Report-email accent line
  const afterStack = stackY + stackH + 24;
  const reportH = reportLine(o, palette, fonts, PAD, afterStack + 8, zoneW);

  // 7. Content QR imageSlot — in the yellow footer zone (above ctaBar)
  const qrY = afterStack + reportH + 24;
  const qrSize = Math.min(180, H - 152 - qrY - 16);
  o.push(imageSlot({
    slotId: 'slot-qr',
    x: Math.round(W / 2 - qrSize / 2), y: qrY,
    w: qrSize, h: qrSize,
    styleHint: 'QR code linking to the cybersecurity awareness portal',
    stroke: palette.primary, rx: 12
  }));

  // 8. CTA bar
  ctaBar(o, content.callToAction, palette, fonts, W, H - 152);
  return canvas;
}

// ── landscape build ───────────────────────────────────────────────────────────

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  // 1. Background slot + scrim
  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'dark cybersecurity abstract background — deep charcoal, subtle gold light rays, no text',
    stroke: palette.primary
  }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // 2. Atmosphere decor
  o.push(...meshGlow({ spots: [
    { x: 360, y: 240, r: 380, color: palette.primary },
    { x: 1720, y: 1080, r: 360, color: palette.accent }
  ], intensity: 0.65 }));
  o.push(...dotGrid({ x: 80, y: 880, cols: 4, rows: 3, gap: 56, dotR: 4, color: palette.primary, intensity: 0.5 }));

  // 3. Two-column layout: left = headline/shield/qr; right = tip stack
  const PAD = 80;
  const colGap = 48;
  const leftW = 760;
  const rightX = PAD + leftW + colGap;
  const rightW = W - rightX - PAD;
  const contentTop = 80;

  // Shield motif — left column background decor
  o.push(...shieldMotif({ x: PAD + leftW / 2, y: contentTop + 24, size: 260, color: palette.primary, intensity: 0.50 }));

  // 4. Headline zone (left column)
  let leftCursor = headlineZone(o, content, palette, fonts, {
    x: PAD, y: contentTop + 40, w: leftW, maxSize: 120
  });
  leftCursor = Math.max(leftCursor, contentTop + 280);

  // 5. Report-email accent line (left column)
  const reportH = reportLine(o, palette, fonts, PAD, leftCursor + 16, leftW);
  leftCursor += reportH + 24 + 16;

  // 6. QR imageSlot in left column
  const qrSize = Math.min(160, H - 124 - leftCursor - 16);
  if (qrSize >= 80) {
    o.push(imageSlot({
      slotId: 'slot-qr',
      x: Math.round(PAD + leftW / 2 - qrSize / 2), y: leftCursor,
      w: qrSize, h: qrSize,
      styleHint: 'QR code linking to the cybersecurity awareness portal',
      stroke: palette.primary, rx: 12
    }));
  }

  // 7. Tip stack (right column)
  const blocks = content.blocks || [];
  const stackH = H - contentTop - 124 - 24; // leave room for ctaBar (124px)
  tipStack(o, blocks, palette, fonts, { x: rightX, y: contentTop, w: rightW, h: stackH });

  // 8. CTA bar
  ctaBar(o, content.callToAction, palette, fonts, W, H - 124, 124);
  return canvas;
}

// ── previews ─────────────────────────────────────────────────────────────────

function tipStackPreview(parts, x, y, w, h, n, palette) {
  const gap = 4;
  const rowH = Math.round((h - gap * (n - 1)) / n);
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), DARK_PANEL, { rx: 3 }));
  for (let i = 0; i < n; i++) {
    const ry = y + i * (rowH + gap);
    const discR = Math.min(12, Math.round(rowH * 0.30));
    const cx = x + discR + 4;
    parts.push(pvCircle(pv(cx), pv(ry + rowH / 2), pv(discR), DARK_PANEL_2, { stroke: palette.primary }));
    const textX = cx + discR + 8;
    parts.push(pvBars({ x: pv(textX), y: pv(ry + rowH / 2 - 8), w: pv(x + w - textX), lines: 2, barH: 4, gap: 3, fill: DARK_INK }));
  }
}

function previewPortrait(palette) {
  const W = 1414;
  const PAD = 96;
  const zoneW = W - PAD * 2;
  const n = 4; // preview at max blocks
  const parts = [
    // shield motif hint
    pvRect(pv(W / 2 - 80), pv(152), pv(160), pv(184), 'none', { rx: 4, stroke: palette.primary, opacity: 0.18 }),
    // headline bars
    pvBars({ x: pv(PAD), y: pv(210), w: pv(zoneW), lines: 2, barH: 11, gap: 6, fill: DARK_INK }),
    pvBars({ x: pv(PAD), y: pv(270), w: pv(zoneW * 0.7), lines: 1, barH: 8, gap: 0, fill: palette.primary })
  ];
  // tip stack
  tipStackPreview(parts, PAD, 590, zoneW, 800, n, palette);
  // report line
  parts.push(pvRect(pv(PAD), pv(1410), pv(zoneW), pv(54), DARK_PANEL_2, { rx: 2 }));
  // QR slot
  parts.push(pvSlot(pv(W / 2 - 90), pv(1480), pv(180), pv(180), palette.primary));
  // CTA bar
  parts.push(pvRect(0, pv(1848), 200, pv(152), palette.primary));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000;
  const PAD = 80;
  const leftW = 760;
  const rightX = PAD + leftW + 48;
  const rightW = W - rightX - PAD;
  const n = 4;
  const parts = [
    // shield motif hint (left column)
    pvRect(pv(PAD + leftW / 2 - 65), pv(80), pv(130), pv(150), 'none', { rx: 3, stroke: palette.primary, opacity: 0.18 }),
    // headline bars (left)
    pvBars({ x: pv(PAD), y: pv(120), w: pv(leftW), lines: 2, barH: 9, gap: 5, fill: DARK_INK }),
    pvBars({ x: pv(PAD), y: pv(164), w: pv(leftW * 0.65), lines: 1, barH: 7, gap: 0, fill: palette.primary }),
    // report line (left)
    pvRect(pv(PAD), pv(640), pv(leftW), pv(44), DARK_PANEL_2, { rx: 2 }),
    // QR slot (left)
    pvSlot(pv(PAD + leftW / 2 - 80), pv(698), pv(160), pv(160), palette.primary)
  ];
  // tip stack (right column)
  tipStackPreview(parts, rightX, 80, rightW, 1290, n, palette);
  // CTA bar
  parts.push(pvRect(0, pv(1290), PV_LAND_W, pv(124), palette.primary));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

// ── export ────────────────────────────────────────────────────────────────────

export default {
  id: 'tips-card',
  name: 'Tips Card',
  style: 'bullet',
  description: 'A near-black phishing-protection tips card: headline and subheadline over a ghost shield motif, a vertical stack of 3–4 icon-accent tip rows, a report-email accent line, and a QR content slot at the foot.',
  contentSchema: {
    headline: { required: true, maxWords: 5 },
    subheadline: { required: false, maxWords: 8 },
    blocks: { kind: 'sequence', min: 3, max: 4, fields: ['text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
