// v2 template — passwords-stat-tips (style: stats). Reinterpretation of the
// AB InBev "Strong Passwords – Your First Line of Defense" dark poster
// (source: 13.html) as a native v2 content-driven template. Architecture:
// near-black canvas, a padlock-motif ghost behind the headline, a horizontal
// row of stat blocks (each block = big figure + caption), a "Did You Know"
// report/CTA accent line, and a QR content imageSlot at the foot.
//
// Source → port:
//   dark background (#0a0c0e)          → DARK_BASE canvas + backgroundImageSlot
//   yellow (#f5c400) brand colour      → palette.primary (yellow ABI yellow)
//   neon-highlight on stat callout     → palette.accent (NOT hardcoded)
//   .main-header-banner "STRONG …"     → headlineZone (palette.primary text)
//   .stay-cyber-title                  → subheadline
//   .ribbon-item rows (3–4)            → content blocks (figure + caption)
//   .did-you-know-box callout          → reportLine (accent border)
//   .footer-email / CTA               → ctaBar (palette.primary bar)
//   .qr-wrapper QR code (base64)      → content imageSlot slotId 'slot-qr'
//
// CRITICAL binding:
//   Each block → TWO bound objects:
//     figure textbox: layerRole 'message', msgId: b.id, fieldRef: 'figure'
//     caption textbox: layerRole 'message', msgId: b.id, fieldRef: 'caption'
//   At least one object per block is layerRole 'message' (spec requirement).
//   Both fontSize values satisfy the ≥38 floor.

import {
  textbox, rect, imageSlot, backgroundImageSlot,
  fitFontSize, fitTextBlock, estTextHeight,
  pv, pvRect, pvCircle, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, dotGrid, padlockMotif, cornerFrame,
  svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM,
  legibilityScrim
} from './decor.js';

// ── constants ─────────────────────────────────────────────────────────────────

const PAD = 88;
const CTA_H = 148;
const CARD_RX = 20;

// ── shared helpers ────────────────────────────────────────────────────────────

/** Yellow CTA bar across full width. */
function ctaBar(o, text, palette, fonts, W, y, h = CTA_H) {
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 200, height: h - 40, maxSize: 42, minSize: 28 });
  const th = estTextHeight(text, size, W - 200);
  o.push(textbox({
    text, x: 100, y: y + Math.round((h - th) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, align: 'center', layerRole: 'cta', bgRef: palette.primary
  }));
}

/**
 * Headline + subheadline zone.
 * Returns cursor (y) after the last placed text.
 */
function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const { fontSize: headSize, height: headH } = fitTextBlock(content.headline, {
    width: w, height: 340, maxSize, minSize: 80, lineHeight: 1.0
  });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.primary, lineHeight: 1.0,
    layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + headH + 18;

  if (content.subheadline) {
    const { fontSize: subSize, height: subH } = fitTextBlock(content.subheadline, {
      width: w, height: 120, maxSize: 44, minSize: 28, lineHeight: 1.26
    });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.head, fontWeight: '700', fill: DARK_INK, lineHeight: 1.26,
      layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += subH + 14;
  }
  return cursor;
}

/**
 * One stat block: big figure (fieldRef:'figure') + caption (fieldRef:'caption').
 * Both objects are layerRole:'message' and carry msgId + fieldRef.
 * Returns the total height consumed.
 */
function statBlock(o, b, palette, fonts, { x, y, w, h, accent = false }) {
  // Figure — large display number
  const figBudget = Math.round(h * 0.52);
  const { fontSize: figSize, height: figH } = fitTextBlock(b.figure, {
    width: w, height: figBudget, maxSize: accent ? 200 : 160, minSize: 80, lineHeight: 1.0
  });
  o.push({
    ...textbox({
      text: b.figure, x, y, w, fontSize: figSize,
      fontFamily: fonts.head, fontWeight: '900',
      fill: accent ? palette.accent : palette.primary,
      align: 'center', lineHeight: 1.0,
      layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'figure'
  });

  // Thin rule below figure
  const ruleY = y + figH + 10;
  const ruleW = Math.round(w * 0.4);
  o.push(rect({
    x: Math.round(x + (w - ruleW) / 2), y: ruleY, w: ruleW, h: 3,
    fill: accent ? palette.accent : palette.primary, rx: 2,
    opacity: accent ? 0.55 : 0.35, layerRole: 'decor'
  }));

  // Caption — descriptive text below the rule
  const capY = ruleY + 16;
  const capBudget = Math.max(38 * 1.3, h - (capY - y) - 4);
  const { fontSize: capSize } = fitTextBlock(b.caption, {
    width: w, height: capBudget, maxSize: 44, minSize: 38, lineHeight: 1.22
  });
  o.push({
    ...textbox({
      text: b.caption, x, y: capY, w, fontSize: capSize,
      fontFamily: fonts.body, fontWeight: '600',
      fill: DARK_INK_DIM, align: 'center', lineHeight: 1.22,
      layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'caption'
  });

  return h;
}

/**
 * Horizontal row of stat cards. Each card = dark panel + statBlock.
 * The first block (index 0) gets accent styling.
 */
function statRow(o, blocks, palette, fonts, { x, y, w, h }) {
  const n = Math.max(blocks.length, 1);
  const gap = 24;
  const colW = Math.floor((w - gap * (n - 1)) / n);

  blocks.forEach((b, i) => {
    const cx = x + i * (colW + gap);
    const accent = i === 0;

    // Card panel
    o.push(rect({
      x: cx, y, w: colW, h,
      fill: accent ? DARK_PANEL_2 : DARK_PANEL,
      rx: CARD_RX,
      stroke: accent ? palette.accent : palette.primary,
      strokeWidth: accent ? 2 : 1,
      opacity: accent ? 0.95 : 0.9,
      layerRole: 'background'
    }));

    // Vertical divider between non-hero columns
    if (i > 0) {
      o.push(rect({
        x: cx - 1, y: y + 32, w: 2, h: h - 64,
        fill: palette.primary, opacity: 0.08, layerRole: 'decor'
      }));
    }

    statBlock(o, b, palette, fonts, {
      x: cx + 20, y: y + 28, w: colW - 40, h: h - 56, accent
    });
  });
}

/**
 * "Did You Know" accent bar — a report/awareness callout line.
 * Returns the height consumed.
 */
function didYouKnowBar(o, palette, fonts, x, y, w) {
  const text = 'Did You Know? Strong passwords are your first line of defense';
  const barH = 80;
  o.push(rect({
    x, y, w, h: barH, fill: DARK_PANEL_2, rx: 14,
    stroke: palette.accent, strokeWidth: 2, opacity: 0.9, layerRole: 'background'
  }));
  const size = fitFontSize(text, { width: w - 48, height: barH - 24, maxSize: 36, minSize: 24 });
  const th = estTextHeight(text, size, w - 48);
  o.push(textbox({
    text, x: x + 24, y: y + Math.round((barH - th) / 2),
    w: w - 48, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.accent, lineHeight: 1.18, align: 'center',
    layerRole: 'decor', bgRef: DARK_PANEL_2
  }));
  return barH;
}

// ── portrait build ────────────────────────────────────────────────────────────

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  // 1. Background slot + scrim (CONTRACT: first two pushed)
  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'dark cybersecurity background — circuit-board traces, deep charcoal, subtle gold highlights, no text',
    stroke: palette.primary
  }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // 2. Atmosphere
  o.push(...meshGlow({ spots: [
    { x: W * 0.72, y: 320, r: 420, color: palette.primary },
    { x: 200, y: H - 400, r: 360, color: palette.accent }
  ], intensity: 0.7 }));
  o.push(...dotGrid({ x: 60, y: H * 0.55, cols: 4, rows: 5, gap: 54, dotR: 4, color: palette.primary, intensity: 0.45 }));
  o.push(...cornerFrame({ x: PAD * 0.5, y: PAD * 0.5, w: W - PAD, h: H - PAD, color: palette.primary, arm: 80, thickness: 6, intensity: 0.55 }));

  // 3. Padlock ghost motif behind headline zone
  o.push(...padlockMotif({ x: W / 2, y: 200, size: 340, color: palette.primary, intensity: 0.45 }));

  // 4. Headline zone
  const zoneX = PAD;
  const zoneW = W - PAD * 2;
  let cursor = headlineZone(o, content, palette, fonts, { x: zoneX, y: 108, w: zoneW, maxSize: 130 });
  cursor = Math.max(cursor, 420);

  // 5. Stat row
  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  // Reserve: didYouKnow 80px + gap 24 + qrSlot 180px + gap 24 + ctaBar CTA_H
  const bottomReserve = 80 + 24 + 180 + 24 + CTA_H + 16;
  const statH = Math.max(n * 60 + 160, Math.round((H - bottomReserve - cursor - 32) * 0.85));
  const statY = cursor + 32;
  statRow(o, blocks, palette, fonts, { x: zoneX, y: statY, w: zoneW, h: statH });

  // 6. "Did You Know" bar
  const dykY = statY + statH + 24;
  const dykH = didYouKnowBar(o, palette, fonts, zoneX, dykY, zoneW);

  // 7. Content QR imageSlot — in the strip above the CTA bar
  const qrAreaY = dykY + dykH + 20;
  const qrSize = Math.min(180, H - CTA_H - qrAreaY - 12);
  if (qrSize >= 80) {
    o.push(imageSlot({
      slotId: 'slot-qr',
      x: Math.round(W / 2 - qrSize / 2), y: qrAreaY,
      w: qrSize, h: qrSize,
      styleHint: 'QR code linking to the password security awareness portal',
      stroke: palette.primary, rx: 12
    }));
  }

  // 8. CTA bar
  ctaBar(o, content.callToAction, palette, fonts, W, H - CTA_H);
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
    styleHint: 'dark cybersecurity background — circuit-board traces, deep charcoal, subtle gold highlights, no text',
    stroke: palette.primary
  }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // 2. Atmosphere
  o.push(...meshGlow({ spots: [
    { x: 380, y: 240, r: 380, color: palette.primary },
    { x: W - 280, y: H - 260, r: 340, color: palette.accent }
  ], intensity: 0.65 }));
  o.push(...dotGrid({ x: W - 300, y: 80, cols: 4, rows: 4, gap: 52, dotR: 4, color: palette.primary, intensity: 0.4 }));
  o.push(...cornerFrame({ x: 40, y: 40, w: W - 80, h: H - 80, color: palette.primary, arm: 70, thickness: 5, intensity: 0.5 }));

  // 3. Two-column layout: left = headline + didYouKnow + QR; right = stat cards stacked
  const colGap = 48;
  const leftW = 680;
  const leftX = PAD;
  const rightX = leftX + leftW + colGap;
  const rightW = W - rightX - PAD;
  const contentTop = 72;

  // Padlock ghost (left column background)
  o.push(...padlockMotif({ x: leftX + leftW / 2, y: contentTop + 80, size: 260, color: palette.primary, intensity: 0.4 }));

  // 4. Headline zone (left column)
  let leftCursor = headlineZone(o, content, palette, fonts, {
    x: leftX, y: contentTop, w: leftW, maxSize: 110
  });
  leftCursor = Math.max(leftCursor, contentTop + 240);

  // 5. "Did You Know" bar (left column)
  const dykH = didYouKnowBar(o, palette, fonts, leftX, leftCursor + 20, leftW);
  leftCursor += 20 + dykH;

  // 6. QR imageSlot (left column, below dyk bar)
  const ctaBarH = 120;
  const qrAreaTop = leftCursor + 20;
  const qrSize = Math.min(160, H - ctaBarH - qrAreaTop - 12);
  if (qrSize >= 80) {
    o.push(imageSlot({
      slotId: 'slot-qr',
      x: Math.round(leftX + leftW / 2 - qrSize / 2), y: qrAreaTop,
      w: qrSize, h: qrSize,
      styleHint: 'QR code linking to the password security awareness portal',
      stroke: palette.primary, rx: 12
    }));
  }

  // 7. Stat cards (right column) — stack vertically for landscape
  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const statAreaH = H - contentTop - ctaBarH - 16;
  const rowGap = 16;
  const rowH = Math.floor((statAreaH - rowGap * (n - 1)) / n);

  blocks.forEach((b, i) => {
    const ry = contentTop + i * (rowH + rowGap);
    const accent = i === 0;

    // Card panel
    o.push(rect({
      x: rightX, y: ry, w: rightW, h: rowH,
      fill: accent ? DARK_PANEL_2 : DARK_PANEL,
      rx: CARD_RX,
      stroke: accent ? palette.accent : palette.primary,
      strokeWidth: accent ? 2 : 1,
      opacity: accent ? 0.95 : 0.9,
      layerRole: 'background'
    }));

    // Inner layout: figure on left portion, caption on right
    const innerPad = 24;
    const figW = Math.round(rightW * 0.38);
    const capX = rightX + innerPad + figW + 20;
    const capW = rightW - innerPad - figW - 20 - innerPad;

    // Figure
    const figBudget = rowH - innerPad * 2;
    const figSize = fitFontSize(b.figure, { width: figW, height: figBudget, maxSize: accent ? 120 : 96, minSize: 56, lineHeight: 1.0 });
    const figH = estTextHeight(b.figure, figSize, figW, 1.0);
    o.push({
      ...textbox({
        text: b.figure,
        x: rightX + innerPad, y: ry + Math.round((rowH - figH) / 2),
        w: figW, fontSize: figSize, fontFamily: fonts.head, fontWeight: '900',
        fill: accent ? palette.accent : palette.primary,
        align: 'center', lineHeight: 1.0,
        layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
      }),
      fieldRef: 'figure'
    });

    // Vertical rule
    o.push(rect({
      x: capX - 14, y: ry + 20, w: 2, h: rowH - 40,
      fill: accent ? palette.accent : palette.primary,
      opacity: 0.25, layerRole: 'decor'
    }));

    // Caption
    const capBudget = rowH - innerPad * 2;
    const { fontSize: capSize } = fitTextBlock(b.caption, {
      width: capW, height: Math.max(capBudget, 38 * 1.25), maxSize: 44, minSize: 38, lineHeight: 1.22
    });
    const capH = estTextHeight(b.caption, capSize, capW, 1.22);
    o.push({
      ...textbox({
        text: b.caption,
        x: capX, y: ry + Math.round((rowH - capH) / 2),
        w: capW, fontSize: capSize, fontFamily: fonts.body, fontWeight: '600',
        fill: DARK_INK, lineHeight: 1.22,
        layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
      }),
      fieldRef: 'caption'
    });
  });

  // 8. CTA bar
  ctaBar(o, content.callToAction, palette, fonts, W, H - ctaBarH, ctaBarH);
  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────

function statRowPreview(parts, x, y, w, h, n, palette) {
  const gap = 3;
  const colW = Math.floor((w - gap * (n - 1)) / n);
  for (let i = 0; i < n; i++) {
    const cx = x + i * (colW + gap);
    const accent = i === 0;
    parts.push(pvRect(pv(cx), pv(y), pv(colW), pv(h), accent ? DARK_PANEL_2 : DARK_PANEL, {
      rx: 3, stroke: accent ? palette.accent : palette.primary
    }));
    // Figure bar (big number)
    parts.push(pvRect(pv(cx + 8), pv(y + 10), pv(colW - 16), pv(accent ? 34 : 26), accent ? palette.accent : palette.primary, { rx: 2 }));
    // Rule
    parts.push(pvRect(pv(cx + colW / 4), pv(y + (accent ? 48 : 40)), pv(colW / 2), pv(1), accent ? palette.accent : palette.primary));
    // Caption bars
    parts.push(pvBars({ x: pv(cx + 6), y: pv(y + (accent ? 52 : 44)), w: pv(colW - 12), lines: 2, barH: 3, gap: 2, fill: DARK_INK_DIM, align: 'center' }));
  }
}

function previewPortrait(palette) {
  const W = 1414;
  const H = 2000;
  const n = 4; // preview at max blocks
  const zoneX = PAD;
  const zoneW = W - PAD * 2;

  const parts = [
    // corner frame hint
    pvRect(pv(44), pv(44), pv(W - 88), pv(H - 88), 'none', { rx: 2, stroke: palette.primary, opacity: 0.18 }),
    // padlock ghost
    pvCircle(pv(W / 2), pv(200), pv(80), 'none', { stroke: palette.primary, opacity: 0.12 }),
    pvRect(pv(W / 2 - 60), pv(240), pv(120), pv(90), palette.primary, { rx: 3, opacity: 0.06 }),
    // headline bars
    pvBars({ x: pv(zoneX), y: pv(118), w: pv(zoneW), lines: 2, barH: 14, gap: 7, fill: palette.primary }),
    pvBars({ x: pv(zoneX), y: pv(175), w: pv(zoneW * 0.65), lines: 1, barH: 8, gap: 0, fill: DARK_INK })
  ];

  // Stat row
  statRowPreview(parts, zoneX, 440, zoneW, 680, n, palette);

  // Did You Know bar
  parts.push(pvRect(pv(zoneX), pv(1140), pv(zoneW), pv(56), DARK_PANEL_2, { rx: 3, stroke: palette.accent }));
  parts.push(pvBars({ x: pv(zoneX + 24), y: pv(1160), w: pv(zoneW - 48), lines: 1, barH: 7, gap: 0, fill: palette.accent, align: 'center' }));

  // QR slot
  parts.push(pvSlot(pv(W / 2 - 90), pv(1216), pv(180), pv(180), palette.primary));

  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H), 200, pv(CTA_H), palette.primary));
  parts.push(pvBars({ x: pv(100), y: pv(H - CTA_H + 52), w: pv(W - 200), lines: 1, barH: 9, gap: 0, fill: DARK_BASE, align: 'center' }));

  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000;
  const H = 1414;
  const n = 4;
  const leftW = 680;
  const leftX = PAD;
  const rightX = leftX + leftW + 48;
  const rightW = W - rightX - PAD;

  const parts = [
    // corner frame hint
    pvRect(pv(40), pv(40), pv(W - 80), pv(H - 80), 'none', { rx: 2, stroke: palette.primary, opacity: 0.18 }),
    // padlock ghost (left column)
    pvCircle(pv(leftX + leftW / 2), pv(260), pv(60), 'none', { stroke: palette.primary, opacity: 0.12 }),
    pvRect(pv(leftX + leftW / 2 - 40), pv(290), pv(80), pv(60), palette.primary, { rx: 2, opacity: 0.06 }),
    // headline bars (left)
    pvBars({ x: pv(leftX), y: pv(80), w: pv(leftW), lines: 2, barH: 11, gap: 6, fill: palette.primary }),
    pvBars({ x: pv(leftX), y: pv(130), w: pv(leftW * 0.6), lines: 1, barH: 7, gap: 0, fill: DARK_INK }),
    // did you know bar (left)
    pvRect(pv(leftX), pv(600), pv(leftW), pv(44), DARK_PANEL_2, { rx: 3, stroke: palette.accent }),
    pvBars({ x: pv(leftX + 20), y: pv(616), w: pv(leftW - 40), lines: 1, barH: 6, gap: 0, fill: palette.accent, align: 'center' }),
    // QR slot (left)
    pvSlot(pv(leftX + leftW / 2 - 80), pv(656), pv(160), pv(160), palette.primary)
  ];

  // Stat rows (right column) stacked
  const ctaBarH = 120;
  const statAreaH = H - 72 - ctaBarH - 16;
  const rowGap = 16;
  const rowH = Math.floor((statAreaH - rowGap * (n - 1)) / n);
  for (let i = 0; i < n; i++) {
    const ry = 72 + i * (rowH + rowGap);
    const accent = i === 0;
    parts.push(pvRect(pv(rightX), pv(ry), pv(rightW), pv(rowH), accent ? DARK_PANEL_2 : DARK_PANEL, {
      rx: 3, stroke: accent ? palette.accent : palette.primary
    }));
    const figW = Math.round(rightW * 0.38);
    parts.push(pvRect(pv(rightX + 8), pv(ry + 8), pv(figW * 0.7), pv(accent ? rowH * 0.55 : rowH * 0.45), accent ? palette.accent : palette.primary, { rx: 2 }));
    parts.push(pvBars({ x: pv(rightX + figW + 24), y: pv(ry + 10), w: pv(rightW - figW - 48), lines: 2, barH: 4, gap: 3, fill: DARK_INK }));
  }

  // CTA bar
  parts.push(pvRect(0, pv(H - ctaBarH), PV_LAND_W, pv(ctaBarH), palette.primary));
  parts.push(pvBars({ x: pv(100), y: pv(H - ctaBarH + 44), w: pv(W - 200), lines: 1, barH: 8, gap: 0, fill: DARK_BASE, align: 'center' }));

  return svgWrapO(parts, DARK_BASE, 'landscape');
}

// ── export ────────────────────────────────────────────────────────────────────

export default {
  id: 'passwords-stat-tips',
  name: 'Password Stats & Tips',
  style: 'stats',
  description: 'A near-black "Strong Passwords" stats card: headline and subheadline over a ghost padlock motif, a horizontal row of 3–4 stat blocks (big figure + caption), a "Did You Know" accent bar, and a QR content slot at the foot.',
  contentSchema: {
    headline: { required: true, maxWords: 6 },
    subheadline: { required: false, maxWords: 9 },
    blocks: { kind: 'stats', min: 3, max: 4, fields: ['figure', 'caption'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
