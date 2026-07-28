// v2 template — data-privacy-panels (style: bullet). Reinterpretation of the
// AB InBev "Data Privacy" poster (source: saksham.html) at the v2 canvas
// scale. The archetype is a full-bleed photo background with two translucent
// rounded panels side-by-side: a left "definition" panel (big display
// headline + description body text) and a right "bullet-list" panel (a
// stacked list of label-chip + text rows for the content blocks), plus a
// mail/CTA strip at the bottom. A content imageSlot sits in the lower-left
// text-free corner (outside both panels).
//
// Source → port:
//   background photo (Unsplash laptop/data scene) → backgroundImageSlot (slotId:'bg')
//   dark overlay                                   → legibilityScrim
//   .logo                                          → decor (not baked)
//   .left h1+h2 "DATA PRIVACY"                    → headline/subheadline in left panel
//   .left p (definition paragraph)                → ambient decor body text in left panel
//   .left .mail "REPORT TO SOC-SUPPORT…"          → ctaBar (callToAction verbatim)
//   .right .heading "EXAMPLES:" + ul              → blocks (label+text chip+message rows)
//   content imageSlot (imageSlots:1)              → lower-left corner, text-free region
//
// Design reinterpreted at 1414×2000 / 2000×1414 with v2 language.
// Yellow = palette.primary; dark grounds = DARK_* anchors; no hardcoded hex.

import {
  textbox, rect, chip, imageSlot,
  fitFontSize, fitTextBlock, estTextHeight, backgroundImageSlot,
  pv, pvRect, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, dotGrid, legibilityScrim, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM, OVERLAY_TEXT_SHADOW
} from './decor.js';

// ── constants ─────────────────────────────────────────────────────────────────

const PAD = 72;
const GAP = 28;
const CARD_RX = 28;
const CTA_H_P = 160;  // portrait CTA bar height
const CTA_H_L = 128;  // landscape CTA bar height
const PANEL_OPACITY = 0.78;

// ── CTA bar ────────────────────────────────────────────────────────────────────

function ctaBar(o, text, palette, fonts, W, y, h) {
  o.push(rect({ x: 0, y, w: W, h, fill: palette.primary, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 200, height: h - 40, maxSize: 44, minSize: 28, lineHeight: 1.2 });
  const th = estTextHeight(text, size, W - 200, 1.2);
  o.push(textbox({
    text, x: 100, y: y + Math.round((h - th) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_BASE, align: 'center', layerRole: 'cta', bgRef: palette.primary
  }));
}

// ── definition (left) panel ───────────────────────────────────────────────────
// Holds the big stacked "DATA / PRIVACY" headline + subheadline + a short
// definition body. The headline comes from content.headline; the subheadline
// from content.subheadline (or a sensible default).

function definitionPanel(o, content, palette, fonts, { x, y, w, h }) {
  // panel background
  o.push(rect({
    x, y, w, h,
    fill: DARK_BASE, rx: CARD_RX,
    opacity: PANEL_OPACITY, layerRole: 'background'
  }));

  // accent top-left rule
  const ruleH = 6;
  o.push(rect({ x: x + CARD_RX, y, w: w - CARD_RX * 2, h: ruleH, fill: palette.primary, opacity: 0.9, layerRole: 'decor' }));

  const innerX = x + 36;
  const innerW = w - 72;
  let cursor = y + ruleH + 32;

  // headline — big display ("DATA PRIVACY" or whatever content.headline is)
  const { fontSize: headSize, height: headH } = fitTextBlock(content.headline, {
    width: innerW, height: Math.round(h * 0.38), maxSize: 160, minSize: 80, lineHeight: 0.94
  });
  o.push(textbox({
    text: content.headline, x: innerX, y: cursor, w: innerW,
    fontSize: headSize, fontFamily: fonts.head, fontWeight: '900',
    fill: palette.primary, lineHeight: 0.94,
    layerRole: 'headline', bgRef: DARK_BASE, shadow: OVERLAY_TEXT_SHADOW
  }));
  cursor += headH + 16;

  // subheadline
  const subText = content.subheadline || 'Protecting what matters most';
  const { fontSize: subSize, height: subH } = fitTextBlock(subText, {
    width: innerW, height: Math.round(h * 0.14), maxSize: 44, minSize: 30, lineHeight: 1.2
  });
  o.push(textbox({
    text: subText, x: innerX, y: cursor, w: innerW,
    fontSize: subSize, fontFamily: fonts.head, fontWeight: '700',
    fill: DARK_INK, lineHeight: 1.2,
    layerRole: 'subheadline', bgRef: DARK_BASE, shadow: OVERLAY_TEXT_SHADOW
  }));
  cursor += subH + 20;

  // thin accent divider
  o.push(rect({ x: innerX, y: cursor, w: Math.round(innerW * 0.55), h: 3, fill: palette.primary, opacity: 0.7, layerRole: 'decor' }));
  cursor += 18;

  // body definition text (decor — not content-bound)
  const bodyText = 'Data privacy, also called information privacy, is an aspect of data protection addressing proper storage, access, retention, and security of sensitive data.';
  const bodyBudget = h - (cursor - y) - 24;
  if (bodyBudget > 60) {
    const bodySize = fitFontSize(bodyText, { width: innerW, height: bodyBudget, maxSize: 32, minSize: 22, lineHeight: 1.4 });
    o.push(textbox({
      text: bodyText, x: innerX, y: cursor, w: innerW,
      fontSize: bodySize, fontFamily: fonts.body, fontWeight: '600',
      fill: DARK_INK_DIM, lineHeight: 1.4,
      layerRole: 'decor', bgRef: DARK_BASE
    }));
  }
}

// ── bullet-list (right) panel ─────────────────────────────────────────────────
// Stacked rows — each block → a label chip + message text row.
// CRITICAL: both label AND text carry msgId + fieldRef.

function bulletPanel(o, blocks, palette, fonts, { x, y, w, h }) {
  // panel background
  o.push(rect({
    x, y, w, h,
    fill: DARK_PANEL, rx: CARD_RX,
    stroke: palette.primary, strokeWidth: 2,
    opacity: PANEL_OPACITY, layerRole: 'background'
  }));

  // panel heading strip in accent color
  const headingText = 'DATA BEST PRACTICES';
  const headingFontSize = fitFontSize(headingText, { width: w - 48, height: 56, maxSize: 36, minSize: 24, lineHeight: 1.2 });
  const headingH = estTextHeight(headingText, headingFontSize, w - 48, 1.2);
  o.push(textbox({
    text: headingText, x: x + 24, y: y + 24, w: w - 48,
    fontSize: headingFontSize, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, layerRole: 'decor', bgRef: DARK_PANEL
  }));

  // rule under heading
  o.push(rect({ x: x + 24, y: y + 24 + headingH + 6, w: w - 48, h: 3, fill: palette.primary, opacity: 0.6, layerRole: 'decor' }));

  // rows zone
  const listTop = y + 24 + headingH + 6 + 3 + 18;
  const listH = h - (listTop - y) - 20;
  const n = Math.max(blocks.length, 1);
  const rowGap = Math.min(18, Math.round(listH * 0.05));
  const rowH = Math.floor((listH - rowGap * (n - 1)) / n);

  blocks.forEach((b, i) => {
    const ry = listTop + i * (rowH + rowGap);

    // label chip — passes msgId so the chip is bound to this block
    const chipMaxW = Math.min(220, Math.round(w * 0.38));
    const chipMaxH = Math.min(44, Math.round(rowH * 0.45));
    const [pill, labelTb] = chip({
      text: b.label || 'TIP',
      x: x + 24, y: ry + 8,
      fontSize: 22, bg: palette.primary, color: DARK_BASE,
      font: fonts.head, maxW: chipMaxW, maxH: chipMaxH,
      msgId: b.id
    });
    o.push(pill);
    // spread fieldRef:'label' onto the label textbox
    o.push({ ...labelTb, fieldRef: 'label' });

    // Derive the actual label textbox height (audit uses estTextHeight) so the
    // body text starts AFTER the label text ends, not just after the pill rect.
    // The pill may be shorter than the label textbox when the label wraps.
    const chipPillH = pill.height ?? Math.round(22 * 1.4 + 22);
    const labelBoxH = labelTb
      ? Math.round(estTextHeight(String(b.label || 'TIP').toUpperCase(), labelTb.fontSize ?? 22, labelTb.width ?? 190, labelTb.lineHeight ?? 1.2))
      : chipPillH;
    const textY = ry + 8 + Math.max(chipPillH, labelBoxH) + 8;
    const textW = w - 48;
    const textBudget = rowH - (textY - ry) - 4;

    // message text (fieldRef:'text')
    const { fontSize: msgSize } = fitTextBlock(b.text, {
      width: textW, height: Math.max(textBudget, 22 * 1.28),
      maxSize: 40, minSize: 22, lineHeight: 1.28
    });
    o.push({
      ...textbox({
        text: b.text,
        x: x + 24, y: textY,
        w: textW, fontSize: msgSize,
        fontFamily: fonts.body, fontWeight: '600',
        fill: DARK_INK, lineHeight: 1.28,
        layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
      }),
      fieldRef: 'text'
    });
  });
}

// ── portrait build ────────────────────────────────────────────────────────────

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  // CONTRACT: first = full-bleed bg image slot
  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'data center server room with soft blue lighting, digital privacy concept, no text, cinematic depth of field',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ambient decor
  o.push(...meshGlow({ spots: [
    { x: 200, y: 400, r: 450, color: palette.primary },
    { x: W - 200, y: H - 600, r: 400, color: palette.accent ?? palette.primary }
  ], intensity: 0.6 }));
  o.push(...dotGrid({ x: W - 260, y: 200, cols: 3, rows: 6, gap: 54, dotR: 4, color: palette.primary, intensity: 0.5 }));

  // ── layout ────────────────────────────────────────────────────────────────
  // Portrait: two columns, side by side.
  //   Left column: definition panel (headline + subheadline + body text)
  //   Right column: bullet list panel (blocks)
  //   Below both panels and above CTA: content imageSlot (text-free zone)
  //   Bottom: CTA bar

  const panelTop = PAD;
  const panelBottom = H - CTA_H_P - GAP * 2 - 160;  // leave 160px slot+gap above CTA
  const panelH = panelBottom - panelTop;

  const leftW = Math.round(W * 0.46) - PAD - Math.round(GAP / 2);
  const leftX = PAD;
  const rightX = PAD + leftW + GAP;
  const rightW = W - rightX - PAD;

  // left: definition panel
  definitionPanel(o, content, palette, fonts, { x: leftX, y: panelTop, w: leftW, h: panelH });

  // right: bullet panel
  bulletPanel(o, content.blocks || [], palette, fonts, { x: rightX, y: panelTop, w: rightW, h: panelH });

  // content imageSlot — below both panels, above CTA bar, in the centre (text-free region)
  const slotH = 140;
  const slotW = 200;
  const slotY = panelBottom + GAP;
  const slotX = Math.round((W - slotW) / 2);
  o.push(imageSlot({
    slotId: 'slot-logo',
    x: slotX, y: slotY, w: slotW, h: slotH,
    styleHint: 'company logo or QR code, clean white on transparent, square format',
    stroke: palette.primary, rx: 12
  }));

  // CTA bar
  ctaBar(o, content.callToAction, palette, fonts, W, H - CTA_H_P, CTA_H_P);

  return canvas;
}

// ── landscape build ───────────────────────────────────────────────────────────

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  // CONTRACT: first = full-bleed bg image slot
  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'data center server room with soft blue lighting, digital privacy concept, no text, cinematic depth of field',
    stroke: palette.primary, slotId: 'bg'
  }));
  // CONTRACT: immediately after = legibility scrim
  o.push(...legibilityScrim({ w: W, h: H }));

  // ambient decor
  o.push(...meshGlow({ spots: [
    { x: 300, y: 300, r: 380, color: palette.primary },
    { x: W - 300, y: H - 300, r: 320, color: palette.accent ?? palette.primary }
  ], intensity: 0.6 }));
  o.push(...dotGrid({ x: W - 280, y: PAD, cols: 3, rows: 4, gap: 50, dotR: 4, color: palette.primary, intensity: 0.45 }));

  // ── landscape layout ─────────────────────────────────────────────────────
  // Landscape: left column (narrower) = definition panel; right column (wider) = bullet panel.
  // Content imageSlot: top-right corner, above where text starts in the right column (text-free).
  // CTA bar at bottom.

  const panelTop = PAD;
  const panelBottom = H - CTA_H_L - GAP;
  const panelH = panelBottom - panelTop;

  // content imageSlot — top-right corner, in the far right, above right panel text (text-free zone)
  const slotW = 130;
  const slotH = 130;
  const slotX = W - PAD - slotW;
  const slotY = PAD;
  o.push(imageSlot({
    slotId: 'slot-logo',
    x: slotX, y: slotY, w: slotW, h: slotH,
    styleHint: 'company logo or QR code, clean white on transparent, square format',
    stroke: palette.primary, rx: 12
  }));

  // left = definition panel (narrower column — 40% of width)
  const leftW = Math.round(W * 0.40) - PAD - Math.round(GAP / 2);
  const leftX = PAD;
  const rightX = PAD + leftW + GAP;
  // right panel avoids the imageSlot — it starts at panelTop and the slot is
  // placed at the very top-right corner with slotX = W - PAD - slotW, ensuring
  // the slot is fully to the RIGHT of the right panel's content.
  const rightW = slotX - rightX - GAP;

  definitionPanel(o, content, palette, fonts, { x: leftX, y: panelTop, w: leftW, h: panelH });
  bulletPanel(o, content.blocks || [], palette, fonts, { x: rightX, y: panelTop, w: rightW, h: panelH });

  // CTA bar
  ctaBar(o, content.callToAction, palette, fonts, W, H - CTA_H_L, CTA_H_L);

  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────

function previewPortrait(palette) {
  const W = 1414;
  const H = 2000;

  const panelTop = PAD;
  const panelBottom = H - CTA_H_P - GAP * 2 - 160;
  const panelH = panelBottom - panelTop;
  const leftW = Math.round(W * 0.46) - PAD - Math.round(GAP / 2);
  const leftX = PAD;
  const rightX = PAD + leftW + GAP;
  const rightW = W - rightX - PAD;

  const slotH = 140;
  const slotW = 200;
  const slotY = panelBottom + GAP;
  const slotX = Math.round((W - slotW) / 2);

  const parts = [
    // background tint
    pvRect(0, 0, pv(W), pv(H), DARK_BASE, { opacity: 0.5 }),
    // left definition panel
    pvRect(pv(leftX), pv(panelTop), pv(leftW), pv(panelH), DARK_BASE, { rx: 4, opacity: 0.78 }),
    pvRect(pv(leftX + 20), pv(panelTop + 36), pv(Math.round(leftW * 0.8)), pv(14), palette.primary),
    pvBars({ x: pv(leftX + 36), y: pv(panelTop + 60), w: pv(leftW - 72), lines: 3, barH: 12, gap: 7, fill: palette.primary }),
    pvBars({ x: pv(leftX + 36), y: pv(panelTop + 190), w: pv(leftW - 72), lines: 1, barH: 6, gap: 0, fill: DARK_INK }),
    pvRect(pv(leftX + 36), pv(panelTop + 210), pv(Math.round((leftW - 72) * 0.55)), pv(2), palette.primary, { opacity: 0.7 }),
    pvBars({ x: pv(leftX + 36), y: pv(panelTop + 228), w: pv(leftW - 72), lines: 4, barH: 3, gap: 4, fill: DARK_INK_DIM }),
    // right bullet panel
    pvRect(pv(rightX), pv(panelTop), pv(rightW), pv(panelH), DARK_PANEL, { rx: 4, opacity: 0.78, stroke: palette.primary }),
    pvBars({ x: pv(rightX + 24), y: pv(panelTop + 24), w: pv(rightW - 48), lines: 1, barH: 5, gap: 0, fill: palette.primary }),
    pvRect(pv(rightX + 24), pv(panelTop + 44), pv(rightW - 48), pv(2), palette.primary, { opacity: 0.6 })
  ];

  // bullet rows in right panel (4 rows)
  const listTop = panelTop + 68;
  const listH = panelH - 88;
  const rowH = Math.round((listH - 18 * 3) / 4);
  for (let i = 0; i < 4; i++) {
    const ry = listTop + i * (rowH + 18);
    parts.push(pvRect(pv(rightX + 24), pv(ry + 8), pv(80), pv(22), palette.primary, { rx: 3 }));
    parts.push(pvBars({ x: pv(rightX + 24), y: pv(ry + 38), w: pv(rightW - 48), lines: 2, barH: 3, gap: 3, fill: DARK_INK }));
  }

  // content imageSlot (below panels)
  parts.push(pvSlot(pv(slotX), pv(slotY), pv(slotW), pv(slotH), palette.primary));

  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H_P), pv(W), pv(CTA_H_P), palette.primary));
  parts.push(pvBars({ x: pv(100), y: pv(H - CTA_H_P + 56), w: pv(W - 200), lines: 1, barH: 8, gap: 0, fill: DARK_BASE, align: 'center' }));

  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000;
  const H = 1414;

  const panelTop = PAD;
  const panelBottom = H - CTA_H_L - GAP;
  const panelH = panelBottom - panelTop;
  const leftW = Math.round(W * 0.40) - PAD - Math.round(GAP / 2);
  const leftX = PAD;
  const slotW = 130;
  const slotX = W - PAD - slotW;
  const rightX = PAD + leftW + GAP;
  const rightW = slotX - rightX - GAP;

  const parts = [
    pvRect(0, 0, PV_LAND_W, pv(H), DARK_BASE, { opacity: 0.5 }),
    // content imageSlot (top-right)
    pvSlot(pv(slotX), pv(PAD), pv(slotW), pv(130), palette.primary),
    // left panel
    pvRect(pv(leftX), pv(panelTop), pv(leftW), pv(panelH), DARK_BASE, { rx: 4, opacity: 0.78 }),
    pvRect(pv(leftX + 20), pv(panelTop + 28), pv(Math.round(leftW * 0.75)), pv(10), palette.primary),
    pvBars({ x: pv(leftX + 36), y: pv(panelTop + 48), w: pv(leftW - 72), lines: 2, barH: 12, gap: 7, fill: palette.primary }),
    pvBars({ x: pv(leftX + 36), y: pv(panelTop + 130), w: pv(leftW - 72), lines: 1, barH: 5, gap: 0, fill: DARK_INK }),
    pvRect(pv(leftX + 36), pv(panelTop + 148), pv(Math.round((leftW - 72) * 0.55)), pv(2), palette.primary, { opacity: 0.7 }),
    pvBars({ x: pv(leftX + 36), y: pv(panelTop + 162), w: pv(leftW - 72), lines: 3, barH: 3, gap: 4, fill: DARK_INK_DIM }),
    // right panel
    pvRect(pv(rightX), pv(panelTop), pv(rightW), pv(panelH), DARK_PANEL, { rx: 4, opacity: 0.78, stroke: palette.primary }),
    pvBars({ x: pv(rightX + 24), y: pv(panelTop + 24), w: pv(rightW - 48), lines: 1, barH: 5, gap: 0, fill: palette.primary }),
    pvRect(pv(rightX + 24), pv(panelTop + 44), pv(rightW - 48), pv(2), palette.primary, { opacity: 0.6 })
  ];

  // 4 bullet rows in landscape right panel
  const listTop = panelTop + 62;
  const listH = panelH - 82;
  const rowH = Math.round((listH - 14 * 3) / 4);
  for (let i = 0; i < 4; i++) {
    const ry = listTop + i * (rowH + 14);
    parts.push(pvRect(pv(rightX + 24), pv(ry + 6), pv(60), pv(18), palette.primary, { rx: 2 }));
    parts.push(pvBars({ x: pv(rightX + 24), y: pv(ry + 30), w: pv(rightW - 48), lines: 2, barH: 3, gap: 3, fill: DARK_INK }));
  }

  // CTA bar
  parts.push(pvRect(0, pv(H - CTA_H_L), PV_LAND_W, pv(CTA_H_L), palette.primary));
  parts.push(pvBars({ x: pv(100), y: pv(H - CTA_H_L + 44), w: pv(W - 200), lines: 1, barH: 7, gap: 0, fill: DARK_BASE, align: 'center' }));

  return svgWrapO(parts, DARK_BASE, 'landscape');
}

// ── export ────────────────────────────────────────────────────────────────────

export default {
  id: 'data-privacy-panels',
  name: 'Data Privacy Panels',
  style: 'bullet',
  description: 'Full-bleed photo background with two translucent rounded panels: a left definition panel (headline + data-privacy body copy) and a right bullet-list panel (label-chip + text rows per block). A content image slot and a bold primary-colour CTA bar complete the layout.',
  contentSchema: {
    headline: { required: true, maxWords: 4 },
    subheadline: { required: false, maxWords: 8 },
    blocks: { kind: 'sequence', min: 4, max: 6, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 1,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
