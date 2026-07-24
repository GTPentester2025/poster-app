// v2 template — case-file (style: scenario). A NOIR "case file / dossier" on a
// predominantly-black canvas: a cinematic spotlight cone (light beams + a soft
// glow in palette.primary) rakes across the top, and each scenario block is a
// case row — a raised DARK_PANEL card split into a "SITUATION" zone (accent
// label chip + situation body in warm off-white) and a "RESPONSE" zone
// (primary label chip + response body), separated by a thin divider and joined
// by a small rotated arrow motif. Two honest image slots: an "evidence photo"
// pinned near the header (slot-1) and a case-emblem footer vignette (slot-2).
// cornerFrame viewfinder accents + a ghost light sweep are the only decor.
// Portrait STACKS the case rows; landscape is a REAL relayout — a two-column
// dossier with the header + evidence photo down the left and the case rows
// filling the right. All template text stays axis-aligned (shapes may rotate).

import {
  textbox, rect, polygon, chip, imageSlot, backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvPoly, pvCircle, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, lightBeams, softGlow, cornerFrame, svgWrapO, legibilityScrim,
  PV_LAND_W, DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM
} from './decor.js';

const CARD_R = 22;

// ── CTA bar (DARK_PANEL, primary text) ──────────────────────────────────────
function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_PANEL, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 10, fill: palette.accent, layerRole: 'decor', opacity: 0.2 }));
  const size = fitFontSize(text, { width: W - 180, height: 96, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text, x: 90, y: y + Math.round((144 - estTextHeight(text, size, W - 180)) / 2),
    w: W - 180, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

// ── headline zone (light ink on DARK_BASE) ──────────────────────────────────
function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  // slim primary "CASE FILE" kicker rule above the headline
  o.push(rect({ x, y, w: Math.round(w * 0.28), h: 10, fill: palette.primary, rx: 5, layerRole: 'decor', opacity: 0.2 }));
  const headSize = fitFontSize(content.headline, { width: w, height: 280, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y: y + 30, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + 30 + estTextHeight(content.headline, headSize, w) + 20;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 40, minSize: 16, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.35) + 16;
  }
  return cursor;
}

/** Small rotated arrow motif linking the SITUATION zone to the RESPONSE zone. */
function arrowMotif(o, palette, { x, midY, len = 70, half = 30, angle = 0 }) {
  o.push(polygon([
    { x, y: midY - half },
    { x: x + len, y: midY },
    { x, y: midY + half }
  ], { fill: palette.primary, opacity: 1, layerRole: 'decor' }));
}

/**
 * One case row: a raised DARK_PANEL card split into a SITUATION zone (accent
 * label chip + situation body) and a RESPONSE zone (primary label chip +
 * response body) on a slightly lifted DARK_PANEL_2 surface, joined by a thin
 * divider and a small arrow. Panels/chips/texts bind msgId; the two body
 * Textboxes are distinguished by fieldRef ('situation' / 'response'). The
 * SITUATION/RESPONSE chips are message-label decor, NOT the bound fields.
 */
function caseRow(o, b, palette, fonts, { x, y, w, h, split }) {
  // the case-file card
  o.push(rect({
    x, y, w, h, fill: DARK_PANEL, rx: CARD_R,
    layerRole: 'background', msgId: b.id
  }));
  // accent spine down the left edge (the file's coloured tab)
  o.push(rect({ x, y, w: 14, h, fill: palette.accent, rx: 7, layerRole: 'decor', opacity: 0.2 }));
  // viewfinder corner brackets frame the card
  o.push(...cornerFrame({ x: x + 16, y: y + 16, w: w - 32, h: h - 32, color: palette.primary, arm: 60, thickness: 6, intensity: 0.85 }));

  const pad = 40;
  const situX = x + pad;
  const sW = split - x - pad - 26;                 // situation zone width
  const respX = split + 26;
  const rW = x + w - respX - pad;                   // response zone width

  // RESPONSE zone sits on a slightly lifted surface tier (DARK_PANEL_2)
  o.push(rect({
    x: respX - 22, y: y + 22, w: (x + w - pad + 22) - (respX - 22), h: h - 44,
    fill: DARK_PANEL_2, rx: 16, layerRole: 'background', msgId: b.id
  }));

  // thin vertical divider between the two zones
  o.push(rect({ x: split - 2, y: y + 34, w: 4, h: h - 68, fill: palette.primary, rx: 2, layerRole: 'decor', opacity: 0.16 }));

  // arrow motif crossing the divider (rotated shape — allowed)
  arrowMotif(o, palette, { x: split - 34, midY: y + Math.round(h / 2), len: 68, half: 26 });

  // ── SITUATION zone: accent label chip + situation body ──
  o.push(...chip({
    text: 'Situation', x: situX, y: y + 30, fontSize: 22,
    bg: palette.accent, color: DARK_INK, font: fonts.head, msgId: b.id, square: true
  }));
  const sSize = fitFontSize(b.situation, { width: sW, height: h - 150, maxSize: 44, minSize: 38 });
  o.push({
    ...textbox({
      text: b.situation, x: situX, y: y + 100, w: sW, fontSize: sSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
      layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'situation'
  });

  // ── RESPONSE zone: primary label chip + response body ──
  o.push(...chip({
    text: 'Response', x: respX, y: y + 30, fontSize: 22,
    bg: palette.primary, color: DARK_BASE, font: fonts.head, msgId: b.id, square: true
  }));
  const rSize = fitFontSize(b.response, { width: rW, height: h - 150, maxSize: 44, minSize: 38 });
  o.push({
    ...textbox({
      text: b.response, x: respX, y: y + 100, w: rW, fontSize: rSize,
      fontFamily: fonts.body, fontWeight: '700', fill: DARK_INK,
      layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL_2
    }),
    fieldRef: 'response'
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of a noir surveillance evidence-wall atmosphere with dark haze and faint neon, deep near-black, cyan and gold accents, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // noir decor: a spotlight cone (light beams) + a soft glow bloom top-left,
  // plus a viewfinder corner frame around the whole dossier.
  o.push(...lightBeams({ w: W, h: H, color: palette.primary, count: 3, angle: 22, intensity: 0.7 }));
  o.push(...softGlow({ x: 300, y: 220, r: 520, color: palette.primary, intensity: 0.9 }));
  o.push(...cornerFrame({ x: 44, y: 44, w: W - 88, h: 1770, color: palette.primary, arm: 96, thickness: 8, intensity: 0.9 }));

  headlineZone(o, content, palette, fonts, { x: 90, y: 120, w: 950, maxSize: 104 });

  // evidence photo pinned near the header (slot-1)
  o.push(imageSlot({
    slotId: 'slot-1', x: 1084, y: 120, w: 240, h: 240, rx: 16,
    styleHint: 'redacted dossier evidence photo — envelope or crime-scene tag, flat vector, no text',
    stroke: palette.primary
  }));

  // stacked case rows
  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const top = 560;
  const bottom = 1650;
  const gap = 36;
  const rowH = Math.round((bottom - top - gap * (n - 1)) / n);
  blocks.forEach((b, i) => {
    const y = top + i * (rowH + gap);
    caseRow(o, b, palette, fonts, { x: 90, y, w: W - 180, h: rowH, split: Math.round(W / 2) });
  });

  // case-emblem footer vignette (slot-2), above the CTA bar
  o.push(imageSlot({
    slotId: 'slot-2', x: 90, y: 1680, w: 200, h: 150, rx: 16,
    styleHint: 'case-file emblem — magnifier or file-folder seal, flat vector, no text',
    stroke: palette.accent
  }));

  ctaBar(o, content.callToAction, palette, fonts, W, 1856);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of a noir surveillance evidence-wall atmosphere with dark haze and faint neon, deep near-black, cyan and gold accents, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...lightBeams({ w: W, h: H, color: palette.primary, count: 3, angle: 18, intensity: 0.7 }));
  o.push(...softGlow({ x: 300, y: 300, r: 460, color: palette.primary, intensity: 0.9 }));
  o.push(...cornerFrame({ x: 44, y: 44, w: W - 88, h: 1180, color: palette.primary, arm: 96, thickness: 8, intensity: 0.9 }));

  // REAL relayout: header + evidence photo down the LEFT column, case rows RIGHT
  const leftW = 620;
  headlineZone(o, content, palette, fonts, { x: 80, y: 110, w: leftW - 130, maxSize: 84 });

  // evidence photo pinned in the left dossier column (slot-1)
  o.push(imageSlot({
    slotId: 'slot-1', x: 80, y: 700, w: 380, h: 300, rx: 16,
    styleHint: 'redacted dossier evidence photo — envelope or crime-scene tag, flat vector, no text',
    stroke: palette.primary
  }));
  // case-emblem vignette lower in the left column (slot-2)
  o.push(imageSlot({
    slotId: 'slot-2', x: 80, y: 1030, w: 260, h: 190, rx: 16,
    styleHint: 'case-file emblem — magnifier or file-folder seal, flat vector, no text',
    stroke: palette.accent
  }));

  // vertical divider between the dossier column and the case rows
  o.push(rect({ x: leftW, y: 90, w: 4, h: 1130, fill: palette.primary, rx: 2, layerRole: 'decor', opacity: 0.16 }));

  // case rows fill the right two-thirds — wide horizontal bands
  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const rowsX = leftW + 60;
  const rowsW = W - rowsX - 80;
  const top = 100;
  const bottom = 1240;
  const gap = 30;
  const rowH = Math.round((bottom - top - gap * (n - 1)) / n);
  blocks.forEach((b, i) => {
    const y = top + i * (rowH + gap);
    caseRow(o, b, palette, fonts, { x: rowsX, y, w: rowsW, h: rowH, split: Math.round(rowsX + rowsW / 2) });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

// ── previews ─────────────────────────────────────────────────────────────────

function pvCaseRow(parts, palette, { x, y, w, h, split }) {
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), DARK_PANEL, { rx: 4 }));
  parts.push(pvRect(pv(x), pv(y), 2, pv(h), palette.accent, { rx: 1, opacity: 0.6 }));
  const pad = 40;
  const situX = x + pad;
  const respX = split + 26;
  // response tier surface
  parts.push(pvRect(pv(respX - 22), pv(y + 22), pv((x + w - pad + 22) - (respX - 22)), pv(h - 44), DARK_PANEL_2, { rx: 3 }));
  // divider + arrow
  parts.push(pvRect(pv(split - 2), pv(y + 34), 1.4, pv(h - 68), palette.primary, { opacity: 0.6 }));
  const midY = pv(y + h / 2);
  parts.push(pvPoly([
    { x: pv(split - 34), y: midY - 3 },
    { x: pv(split + 34), y: midY },
    { x: pv(split - 34), y: midY + 3 }
  ], palette.primary));
  // situation chip + bars
  parts.push(pvRect(pv(situX), pv(y + 30), pv(120), pv(38), palette.accent, { rx: 2 }));
  parts.push(pvBars({ x: pv(situX), y: pv(y + 104), w: pv(split - situX - 40), lines: 2, barH: 4.5, gap: 3, fill: DARK_INK }));
  // response chip + bars
  parts.push(pvRect(pv(respX), pv(y + 30), pv(120), pv(38), palette.primary, { rx: 2 }));
  parts.push(pvBars({ x: pv(respX), y: pv(y + 104), w: pv(x + w - pad - respX), lines: 2, barH: 4.5, gap: 3, fill: DARK_INK }));
}

function previewPortrait(palette) {
  const W = 1414;
  const parts = [
    pvCircle(pv(300), pv(220), pv(320), palette.primary, { opacity: 0.12 }),
    pvRect(pv(90), pv(120), pv(266), 5, palette.primary, { rx: 2 }),
    pvBars({ x: pv(90), y: pv(160), w: pv(950), lines: 2, barH: 8, gap: 5, fill: DARK_INK }),
    pvSlot(pv(1084), pv(120), pv(240), pv(240), palette.primary)
  ];
  const n = 3;
  const top = 560; const bottom = 1650; const gap = 36;
  const rowH = Math.round((bottom - top - gap * (n - 1)) / n);
  for (let i = 0; i < n; i++) {
    pvCaseRow(parts, palette, { x: 90, y: top + i * (rowH + gap), w: W - 180, h: rowH, split: Math.round(W / 2) });
  }
  parts.push(pvSlot(pv(90), pv(1680), pv(200), pv(150), palette.accent));
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_PANEL));
  parts.push(pvRect(0, pv(1856), 200, pv(10), palette.accent));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000;
  const leftW = 620;
  const parts = [
    pvCircle(pv(300), pv(300), pv(300), palette.primary, { opacity: 0.12 }),
    pvRect(pv(80), pv(110), pv(200), 5, palette.primary, { rx: 2 }),
    pvBars({ x: pv(80), y: pv(150), w: pv(leftW - 130), lines: 2, barH: 8, gap: 5, fill: DARK_INK }),
    pvSlot(pv(80), pv(700), pv(380), pv(300), palette.primary),
    pvSlot(pv(80), pv(1030), pv(260), pv(190), palette.accent),
    pvRect(pv(leftW), pv(90), 1.4, pv(1130), palette.primary, { opacity: 0.6 })
  ];
  const n = 3;
  const rowsX = leftW + 60;
  const rowsW = W - rowsX - 80;
  const top = 100; const bottom = 1240; const gap = 30;
  const rowH = Math.round((bottom - top - gap * (n - 1)) / n);
  for (let i = 0; i < n; i++) {
    pvCaseRow(parts, palette, { x: rowsX, y: top + i * (rowH + gap), w: rowsW, h: rowH, split: Math.round(rowsX + rowsW / 2) });
  }
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_PANEL));
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(10), palette.accent));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'case-file',
  name: 'Case file',
  style: 'scenario',
  description: 'A noir case-file dossier on black: a spotlight cone rakes the header while each scenario is a raised case row split into a SITUATION zone and a RESPONSE zone, joined by an arrow across a thin divider. Stacked case rows in portrait; a two-column dossier with a left evidence column and right-hand case bands in landscape, with an evidence photo and a case-emblem image slot.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'scenario', min: 3, max: 4, fields: ['situation', 'response'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 2,
    backgroundSlots: 1,
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
