// v2 template — holiday-scams (style: infographic). A faithful port of the
// AB InBev "Holiday Season Scams" awareness poster: a near-black canvas with
// gold branding, a header row (kicker), a headline over a hero image, a full-
// width gold statement bar, then 3 scam panels — each with a gold label, an
// illustrative image slot, a white description, and a green "safe action"
// solution pill. A dark CTA/report bar anchors the foot. Portrait stacks the
// panels in a 3-column row; landscape puts the headline column on the left and
// the panels as a right-hand row.
//
// Source layout → port: header kicker + logo band → kicker textbox top-right;
// "Holiday Season Scams :" white headline + gold "Festive Fraud Awareness"
// subheadline → headlineZone; hero image top-right → imageSlot; gold banner
// "DON'T LET SCAMS DISRUPT OUR OPERATIONS" → statement bar; 3 panels
// {label, text, solution} each with its own image → per-block imageSlots; gold
// footer with report line + QR → ctaBar.

import {
  textbox, rect, imageSlot, chip,
  fitFontSize, estTextHeight, backgroundImageSlot,
  pv, pvRect, pvBars, pvSlot, SEMANTIC_GREEN
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, dotGrid, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, legibilityScrim
} from './decor.js';

// ── shared bits ───────────────────────────────────────────────────────────────

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
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, lineHeight: 1.04,
    layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.04) + 24;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 140, maxSize: 44, minSize: 28, lineHeight: 1.3 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '700', fill: palette.primary, lineHeight: 1.3,
      layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.3) + 20;
  }
  return cursor;
}

// statement bar — full-width gold band with centered dark text
function statementBar(o, text, palette, fonts, x, y, w, h = 96) {
  o.push(rect({ x, y, w, h, fill: palette.primary, rx: 8, layerRole: 'decor', opacity: 0.2 }));
  o.push(rect({ x, y, w, h, fill: 'transparent', stroke: palette.primary, strokeWidth: 3, rx: 8, layerRole: 'decor', opacity: 0.2 }));
  const t = String(text).toUpperCase();
  const size = fitFontSize(t, { width: w - 60, height: h - 28, maxSize: 40, minSize: 22 });
  o.push(textbox({
    text: t, x: x + 30, y: y + Math.round((h - estTextHeight(t, size, w - 60)) / 2),
    w: w - 60, fontSize: size, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_INK, align: 'center', layerRole: 'decor', bgRef: DARK_PANEL
  }));
}

/** One scam panel: label chip, image, description, green solution pill. */
function scamPanel(o, b, palette, fonts, { x, y, w, h }) {
  // panel card surface
  o.push(rect({ x, y, w, h, fill: DARK_PANEL, rx: 18, layerRole: 'background', msgId: b.id }));

  const pad = 24;
  const innerW = w - pad * 2;
  let cy = y + pad;

  // label chip (message-label) + verbatim label binding (decor, exempt)
  const chipParts = chip({
    text: b.label, x: x + pad, y: cy, fontSize: 24,
    bg: palette.primary, color: DARK_BASE, font: fonts.head, msgId: b.id,
    maxW: innerW, maxH: 70
  });
  const [chipPill] = chipParts;
  o.push(...chipParts);
  o.push({
    ...textbox({
      text: b.label, x: x + pad, y: cy, w: innerW, fontSize: 22,
      fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
      layerRole: 'decor', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'label'
  });
  cy += chipPill.height + 16;

  // illustrative image slot
  const imgH = Math.round(h * 0.22);
  o.push(imageSlot({
    slotId: `slot-${b.id}`, x: x + pad, y: cy, w: innerW, h: imgH,
    styleHint: `photographic illustration of the "${b.label}" holiday scam scenario, brewery office, moody, no text`,
    stroke: palette.primary, rx: 12, blockId: b.id
  }));
  cy += imgH + 18;

  // solution pill reserved at the bottom
  const solH = Math.round(h * 0.2);
  const solY = y + h - pad - solH;

  // description text between image and solution
  const descH = Math.max(90, solY - 16 - cy);
  const descSize = fitFontSize(b.text, { width: innerW, height: descH, maxSize: 42, minSize: 22, lineHeight: 1.28 });
  o.push({
    ...textbox({
      text: b.text, x: x + pad, y: cy, w: innerW, fontSize: descSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK, lineHeight: 1.28,
      align: 'center', layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'text'
  });

  // green solution pill (safe action) — the semantic green survives brand override
  if (b.solution) {
    o.push(rect({ x: x + pad, y: solY, w: innerW, h: solH, fill: SEMANTIC_GREEN, rx: 16, layerRole: 'background', msgId: b.id }));
    const solSize = fitFontSize(b.solution, { width: innerW - 24, height: solH - 20, maxSize: 40, minSize: 22, lineHeight: 1.24 });
    o.push({
      ...textbox({
        text: b.solution, x: x + pad + 12, y: solY + Math.round((solH - estTextHeight(b.solution, solSize, innerW - 24, 1.24)) / 2),
        w: innerW - 24, fontSize: solSize, fontFamily: fonts.head, fontWeight: '800',
        fill: '#FFFFFF', align: 'center', lineHeight: 1.24,
        layerRole: 'message', msgId: b.id, bgRef: SEMANTIC_GREEN
      }),
      fieldRef: 'solution'
    });
  }
}

// ── portrait ──────────────────────────────────────────────────────────────────

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark festive brewery security backdrop, deep near-black with warm gold bokeh, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({ spots: [
    { x: 1180, y: 300, r: 420, color: palette.primary },
    { x: 200, y: 1500, r: 380, color: palette.accent }
  ], intensity: 0.7 }));
  o.push(...dotGrid({ x: 96, y: 340, cols: 6, rows: 4, gap: 52, dotR: 4, color: palette.primary, intensity: 0.6 }));

  // kicker top-right
  o.push(textbox({
    text: 'Security Compliance & Awareness', x: W - 560, y: 88, w: 464,
    fontSize: 30, fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
    align: 'right', layerRole: 'decor', bgRef: DARK_BASE
  }));

  const headCursor = headlineZone(o, content, palette, fonts, { x: 96, y: 176, w: 820, maxSize: 128 });

  // hero image top-right (below kicker)
  o.push(imageSlot({
    slotId: 'slot-hero', x: 956, y: 176, w: 362, h: 300,
    styleHint: 'brewery staff at a laptop during the holidays, warning icon, cinematic, no text',
    stroke: palette.primary
  }));

  const barY = Math.max(headCursor + 12, 560);
  statementBar(o, 'Don’t let scams disrupt our operations', palette, fonts, 96, barY, W - 192, 100);

  // 3 scam panels in a row
  const blocks = content.blocks || [];
  const rowY = barY + 128;
  const rowBottom = 1780;
  const gap = 24;
  const n = Math.max(blocks.length, 1);
  const panelW = Math.round((W - 192 - gap * (n - 1)) / n);
  blocks.forEach((b, i) => {
    const x = 96 + i * (panelW + gap);
    scamPanel(o, b, palette, fonts, { x, y: rowY, w: panelW, h: rowBottom - rowY });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1848);
  return canvas;
}

// ── landscape ───────────────────────────────────────────────────────────────

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark festive brewery security backdrop, deep near-black with warm gold bokeh, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({ spots: [
    { x: 300, y: 320, r: 420, color: palette.primary },
    { x: 1720, y: 1120, r: 400, color: palette.accent }
  ], intensity: 0.7 }));
  o.push(...dotGrid({ x: 96, y: 980, cols: 5, rows: 4, gap: 50, dotR: 4, color: palette.primary, intensity: 0.6 }));

  // left headline column
  const colW = 620;
  o.push(textbox({
    text: 'Security Compliance & Awareness', x: 96, y: 96, w: colW,
    fontSize: 30, fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
    align: 'left', layerRole: 'decor', bgRef: DARK_BASE
  }));
  const headCursor = headlineZone(o, content, palette, fonts, { x: 96, y: 168, w: colW, maxSize: 116 });

  o.push(imageSlot({
    slotId: 'slot-hero', x: 96, y: Math.max(headCursor + 8, 720), w: colW, h: 300,
    styleHint: 'brewery staff at a laptop during the holidays, warning icon, cinematic, no text',
    stroke: palette.primary
  }));

  // right: statement bar + 3 panels
  const rightX = 96 + colW + 48;
  const rightW = W - rightX - 96;
  statementBar(o, 'Don’t let scams disrupt our operations', palette, fonts, rightX, 120, rightW, 96);

  const blocks = content.blocks || [];
  const rowY = 248;
  const rowBottom = 1264;
  const gap = 20;
  const n = Math.max(blocks.length, 1);
  const panelW = Math.round((rightW - gap * (n - 1)) / n);
  blocks.forEach((b, i) => {
    const x = rightX + i * (panelW + gap);
    scamPanel(o, b, palette, fonts, { x, y: rowY, w: panelW, h: rowBottom - rowY });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1290, 124);
  return canvas;
}

// ── previews ────────────────────────────────────────────────────────────────

function panelPreview(parts, x, y, w, h, palette) {
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), DARK_PANEL, { rx: 4 }));
  parts.push(pvRect(pv(x + 24), pv(y + 24), pv(w * 0.5), 7, palette.primary, { rx: 2 }));
  parts.push(pvSlot(pv(x + 24), pv(y + 64), pv(w - 48), pv(h * 0.22), palette.primary));
  parts.push(pvBars({ x: pv(x + 24), y: pv(y + 64 + h * 0.22 + 16), w: pv(w - 48), lines: 3, barH: 4, gap: 3, fill: DARK_INK, align: 'center' }));
  parts.push(pvRect(pv(x + 24), pv(y + h - 24 - h * 0.2), pv(w - 48), pv(h * 0.2), SEMANTIC_GREEN, { rx: 4 }));
}

function previewPortrait(palette) {
  const parts = [
    pvBars({ x: pv(96), y: pv(176), w: pv(820), lines: 2, barH: 8, gap: 5, fill: DARK_INK }),
    pvSlot(pv(956), pv(176), pv(362), pv(300), palette.primary),
    pvRect(pv(96), pv(572), pv(1222), pv(100), palette.primary, { rx: 3 })
  ];
  const rowY = 700, rowBottom = 1780, gap = 24;
  const panelW = (1222 - gap * 2) / 3;
  for (let i = 0; i < 3; i++) panelPreview(parts, 96 + i * (panelW + gap), rowY, panelW, rowBottom - rowY, palette);
  parts.push(pvRect(0, pv(1848), 200, pv(152), palette.primary));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const colW = 620;
  const parts = [
    pvBars({ x: pv(96), y: pv(168), w: pv(colW), lines: 2, barH: 8, gap: 5, fill: DARK_INK }),
    pvSlot(pv(96), pv(720), pv(colW), pv(300), palette.primary)
  ];
  const rightX = 96 + colW + 48;
  const rightW = 2000 - rightX - 96;
  parts.push(pvRect(pv(rightX), pv(120), pv(rightW), pv(96), palette.primary, { rx: 3 }));
  const rowY = 248, rowBottom = 1264, gap = 20;
  const panelW = (rightW - gap * 2) / 3;
  for (let i = 0; i < 3; i++) panelPreview(parts, rightX + i * (panelW + gap), rowY, panelW, rowBottom - rowY, palette);
  parts.push(pvRect(0, pv(1290), PV_LAND_W, pv(124), palette.primary));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'holiday-scams',
  name: 'Holiday Season Scams',
  style: 'infographic',
  description: 'Festive-fraud awareness in a near-black, gold-branded layout: a headline over a hero image, a full-width statement bar, then three scam panels — each with a label, an illustrative image, a description, and a green safe-action solution. A gold report bar anchors the foot.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 10 },
    blocks: { kind: 'panels', min: 3, max: 3, fields: ['label', 'text', 'solution'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 4,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
