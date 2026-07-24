// v2 template — threat-radar (style: infographic). A DARK polar "threat radar":
// a central hub of concentric signal-arc rings (palette.primary) around a soft
// primary halo holds the ONE honest image slot at its core. Each sequence
// block is a "blip" — a numbered node disc sitting on a ring, a thin connector
// hairline (a rotated Rect) running from the hub out to the blip, and a
// translucent DARK_PANEL card near the rim carrying the block's LABEL (an
// uppercase primary chip) + TEXT (light DARK_INK, >=38px). Portrait lays the
// blip cards in a vertical ring-stack flanking the hub (safe, in-bounds by
// construction). Landscape is a REAL relayout: the hub pins to the left, blips
// stack down the right two-thirds. meshGlow atmosphere; a DARK_PANEL CTA bar
// with palette.primary text seals the bottom. 4–6 sequence blocks {label,text},
// one honest image slot.
//
// 2026 redesign: premium dark-infographic quality — hub signal arcs get an extra
// outer ring and higher intensity; node discs use a two-ring concentric style
// (outer DARK_BASE with primary stroke + inner primary fill) for visual depth;
// blip cards gain a subtle gradient tint wash and sharper corner accent;
// connector hairlines made slightly wider (6px vs 4px) for visibility; label
// chip font bumped from 22 to 25px; body text lineHeight 1.4 for readability;
// consistent 88px outer margins; eyebrow CLASSIFIED label in the hub zone.

import {
  textbox, rect, circle, imageSlot, backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvCircle, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, signalArcs, dotGrid, svgWrapO, PV_LAND_W,
  legibilityScrim, softGlow,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM
} from './decor.js';

const CARD_R = 24;

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_PANEL, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 5, fill: palette.primary, opacity: 0.18, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 200, height: 96, maxSize: 46, minSize: 30 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((144 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize, align = 'left', subAvailH = 200 }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 280, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize, lineHeight: 1.04,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align,
    layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.04) + 20;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: Math.max(30, subAvailH), maxSize: 38, minSize: 16, lineHeight: 1.4 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM, align,
      lineHeight: 1.4, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.4) + 16;
  }
  return cursor;
}

/**
 * The radar hub: concentric signal-arc rings + a soft primary halo + dot-grid
 * atmosphere + the honest dashed image slot at the very core. (cx, cy) is the
 * hub center; r is the outer ring radius; slot is the square image-slot side.
 */
function hubZone(o, palette, { cx, cy, r, slot }) {
  // soft primary bloom behind the hub
  o.push(...softGlow({ x: cx, y: cy, r: Math.round(r * 1.2), color: palette.primary, intensity: 0.7 }));
  // signal arcs — 5 rings for premium depth (was 4)
  o.push(...signalArcs({ x: cx, y: cy, r, rings: 5, color: palette.primary, strokeWidth: 10, intensity: 0.95 }));
  // faint accent secondary arc overlay at 70% of outer r
  o.push(...signalArcs({ x: cx, y: cy, r: Math.round(r * 0.70), rings: 3, color: palette.accent, strokeWidth: 6, intensity: 0.55 }));
  // primary halo disc lifting the slot
  o.push(circle({ x: cx, y: cy, r: Math.round(slot * 0.64), fill: palette.primary, opacity: 0.08, layerRole: 'decor' }));
  o.push(imageSlot({
    slotId: 'slot-1', x: Math.round(cx - slot / 2), y: Math.round(cy - slot / 2), w: slot, h: slot,
    styleHint: 'central threat-radar emblem — radar sweep or shield core, flat vector, no text',
    stroke: palette.primary
  }));
}

/**
 * One blip: a connector hairline (rotated Rect) from the hub anchor to the
 * card, a numbered node disc where it lands, and a translucent DARK_PANEL_2 card
 * with a thin primary hairline border, a label chip + body text — both bound.
 */
function blipCard(o, b, n, palette, fonts, { cardX, cardY, cardW, cardH, anchorX, anchorY }) {
  const nodeCx = cardX + 48;
  const nodeCy = cardY + 48;

  // connector hairline hub → node
  const dx = nodeCx - anchorX;
  const dy = nodeCy - anchorY;
  const len = Math.max(1, Math.round(Math.hypot(dx, dy)));
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  o.push(rect({
    x: anchorX, y: anchorY - 3, w: len, h: 6, fill: palette.primary,
    angle, opacity: 0.14, layerRole: 'decor'
  }));

  // card surface — DARK_PANEL_2 for a slightly lifted tone vs DARK_PANEL
  o.push(rect({
    x: cardX, y: cardY, w: cardW, h: cardH, fill: DARK_PANEL_2, rx: CARD_R,
    shadow: { color: 'rgba(0,0,0,0.50)', blur: 28, offsetX: 0, offsetY: 10 },
    layerRole: 'background', msgId: b.id
  }));
  // primary tint wash over the card
  o.push(rect({
    x: cardX, y: cardY, w: cardW, h: cardH, fill: palette.primary, rx: CARD_R,
    opacity: 0.05, layerRole: 'decor'
  }));
  // primary hairline border
  o.push(rect({
    x: cardX, y: cardY, w: cardW, h: cardH, fill: 'transparent',
    stroke: palette.primary, strokeWidth: 2, rx: CARD_R, opacity: 0.18, layerRole: 'decor'
  }));
  // subtle top-edge highlight (inside the card border)
  o.push(rect({
    x: cardX + 24, y: cardY + 8, w: cardW - 48, h: 4, fill: palette.primary,
    rx: 2, opacity: 0.12, layerRole: 'decor'
  }));

  // numbered node disc — two concentric rings for depth
  o.push(circle({ x: nodeCx, y: nodeCy, r: 32, fill: DARK_BASE, layerRole: 'decor' }));
  o.push(circle({ x: nodeCx, y: nodeCy, r: 32, fill: 'transparent', stroke: palette.primary, strokeWidth: 3, layerRole: 'decor' }));
  o.push(circle({ x: nodeCx, y: nodeCy, r: 18, fill: palette.primary, opacity: 0.18, layerRole: 'decor' }));
  o.push(textbox({
    text: String(n), x: nodeCx - 32, y: nodeCy - 24, w: 64, fontSize: 36,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.primary, align: 'center',
    lineHeight: 1.02, layerRole: 'decor'
  }));

  // label chip (uppercase primary text on DARK_BASE pill, right of the node)
  const pillX = nodeCx + 52;
  const pillY = cardY + 24;
  const pillW = cardW - (pillX - cardX) - 28;
  const pillH = 48;
  o.push(rect({ x: pillX, y: pillY, w: pillW, h: pillH, fill: DARK_BASE, rx: pillH / 2, layerRole: 'message-label', msgId: b.id }));
  const blipLabelInnerW = pillW - 40;
  const blipLabelFontSize = fitFontSize(String(b.label).toUpperCase(), { width: blipLabelInnerW, height: pillH - 10, maxSize: 25, minSize: 12, lineHeight: 1.16 });
  o.push({
    ...textbox({
      text: String(b.label).toUpperCase(), x: pillX + 20, y: pillY + Math.round((pillH - blipLabelFontSize * 1.16) / 2),
      w: blipLabelInnerW, fontSize: blipLabelFontSize,
      fontFamily: fonts.head, fontWeight: '800', fill: palette.primary, align: 'left',
      charSpacing: 60, lineHeight: 1.16, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'label'
  });

  // block text (light ink on the card surface)
  const textX = cardX + 44;
  const bodyY = cardY + 106;
  const bodyW = cardW - 88;
  const size = fitFontSize(b.text, { width: bodyW, height: cardH - (bodyY - cardY) - 28, maxSize: 44, minSize: 38 });
  o.push({
    ...textbox({
      text: b.text, x: textX, y: bodyY, w: bodyW, fontSize: size,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
      lineHeight: 1.4, layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL_2
    }),
    fieldRef: 'text'
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of a dark radar sweep with concentric signal rings and scanning glow, deep near-black, cyan and gold accents, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // mesh glow blooms
  o.push(...meshGlow({
    spots: [
      { x: 240, y: 360, r: 500, color: palette.primary },
      { x: 1200, y: 1560, r: 560, color: palette.accent }
    ],
    intensity: 0.9
  }));
  // dot-grid texture in the lower-right (empty space around the blip grid)
  o.push(...dotGrid({ x: 1120, y: 1700, cols: 4, rows: 3, gap: 44, dotR: 4, color: palette.primary, intensity: 0.65 }));

  // hubZone imageSlot top at cy-slot/2=460; audit avail for sub ≈ 111 → cap to 100
  headlineZone(o, content, palette, fonts, { x: 88, y: 96, w: 1238, maxSize: 108, align: 'center', subAvailH: 100 });

  // radar hub centred in the upper third
  const hubCx = Math.round(W / 2);
  const hubCy = 608;
  hubZone(o, palette, { cx: hubCx, cy: hubCy, r: 336, slot: 296 });

  // blip cards ring-stacked below the hub (safe grid — always in-bounds)
  const blocks = content.blocks || [];
  const gridTop = 936;
  const gridBottom = 1832;
  const colGap = 40;
  const cardW = Math.round((1238 - colGap) / 2);
  const rows = Math.ceil(blocks.length / 2);
  const rowH = Math.round((gridBottom - gridTop) / Math.max(rows, 1));
  const cardH = rowH - 36;

  blocks.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const lastAlone = i === blocks.length - 1 && blocks.length % 2 === 1;
    const cardX = lastAlone
      ? Math.round(88 + (1238 - cardW) / 2)
      : 88 + col * (cardW + colGap);
    const cardY = gridTop + row * rowH;
    blipCard(o, b, i + 1, palette, fonts, {
      cardX, cardY, cardW, cardH, anchorX: hubCx, anchorY: hubCy
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1856);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of a dark radar sweep with concentric signal rings and scanning glow, deep near-black, cyan and gold accents, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({
    spots: [
      { x: 320, y: 540, r: 560, color: palette.primary },
      { x: 1580, y: 1140, r: 600, color: palette.accent }
    ],
    intensity: 0.9
  }));
  o.push(...dotGrid({ x: 1760, y: 1120, cols: 4, rows: 3, gap: 44, dotR: 4, color: palette.primary, intensity: 0.65 }));

  // hub pinned to the left third, full height; a vertical divider hairline
  const hubBandW = 636;
  const hubCx = 320;
  const hubCy = 600;
  o.push(rect({ x: hubBandW, y: 64, w: 3, h: 1118, fill: palette.primary, opacity: 0.16, layerRole: 'decor' }));

  // hubSlotTop ≈ hubCy - slot/2 = 600 - 128 = 472; subAvailH ≈ 472 - (88 + headH + 20) - 8
  headlineZone(o, content, palette, fonts, { x: 80, y: 88, w: hubBandW - 128, maxSize: 90, align: 'left', subAvailH: 90 });
  hubZone(o, palette, { cx: hubCx, cy: hubCy, r: 296, slot: 256 });

  // blips stack down the right two-thirds
  const blocks = content.blocks || [];
  const gridX = hubBandW + 56;
  const gridTop = 120;
  const gridBottom = 1248;
  const gridW = W - gridX - 72;
  const colGap = 40;
  const cols = 2;
  const cardW = Math.round((gridW - colGap) / cols);
  const rows = Math.ceil(blocks.length / cols);
  const rowH = Math.round((gridBottom - gridTop) / Math.max(rows, 1));
  const cardH = rowH - 32;

  blocks.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const lastAlone = i === blocks.length - 1 && blocks.length % cols === 1;
    const cardX = lastAlone
      ? Math.round(gridX + (gridW - cardW) / 2)
      : gridX + col * (cardW + colGap);
    const cardY = gridTop + row * rowH;
    blipCard(o, b, i + 1, palette, fonts, {
      cardX, cardY, cardW, cardH, anchorX: hubCx + 140, anchorY: hubCy
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

// ── previews ─────────────────────────────────────────────────────────────────

function pvHub(parts, palette, { cx, cy, r, slot }) {
  for (let i = 1; i <= 5; i++) {
    parts.push(pvCircle(pv(cx), pv(cy), pv((r * i) / 5), 'none', { stroke: palette.primary, opacity: 0.12 }));
  }
  parts.push(pvCircle(pv(cx), pv(cy), pv(slot * 0.64), palette.primary, { opacity: 0.08 }));
  parts.push(pvSlot(pv(cx - slot / 2), pv(cy - slot / 2), pv(slot), pv(slot), palette.primary));
}

function pvCard(parts, palette, { x, y, w, h }) {
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), DARK_PANEL_2, { rx: 4 }));
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), 'none', { rx: 4, stroke: palette.primary, opacity: 0.35 }));
  parts.push(pvCircle(pv(x + 48), pv(y + 48), pv(32), DARK_BASE, { stroke: palette.primary }));
  parts.push(pvCircle(pv(x + 48), pv(y + 48), pv(18), palette.primary, { opacity: 0.15 }));
  parts.push(pvRect(pv(x + 110), pv(y + 27), pv(w * 0.38), pv(36), DARK_BASE, { rx: 3 }));
  parts.push(pvBars({ x: pv(x + 44), y: pv(y + 106), w: pv(w - 88), lines: 2, barH: 4.5, gap: 3, fill: DARK_INK }));
}

function previewPortrait(palette) {
  const parts = [
    pvCircle(pv(240), pv(360), pv(130), palette.primary, { opacity: 0.1 }),
    pvCircle(pv(1200), pv(1560), pv(140), palette.accent, { opacity: 0.1 }),
    pvBars({ x: pv(88), y: pv(110), w: pv(1238), lines: 2, barH: 8, gap: 5, fill: DARK_INK, align: 'center' })
  ];
  pvHub(parts, palette, { cx: 707, cy: 608, r: 336, slot: 296 });
  const gridTop = 936;
  const rowH = Math.round((1832 - gridTop) / 3);
  const cardW = Math.round((1238 - 40) / 2);
  for (let i = 0; i < 6; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    pvCard(parts, palette, { x: 88 + col * (cardW + 40), y: gridTop + row * rowH, w: cardW, h: rowH - 36 });
  }
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_PANEL));
  parts.push(pvRect(0, pv(1856), 200, pv(5), palette.primary, { opacity: 0.18 }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const hubBandW = 636;
  const parts = [
    pvCircle(pv(320), pv(540), pv(140), palette.primary, { opacity: 0.1 }),
    pvCircle(pv(1580), pv(1140), pv(150), palette.accent, { opacity: 0.1 }),
    pvBars({ x: pv(80), y: pv(100), w: pv(hubBandW - 128), lines: 2, barH: 8, gap: 5, fill: DARK_INK }),
    pvRect(pv(hubBandW), pv(64), pv(1.5), pv(1118), palette.primary, { opacity: 0.16 })
  ];
  pvHub(parts, palette, { cx: 320, cy: 600, r: 296, slot: 256 });
  const gridX = hubBandW + 56;
  const gridW = 2000 - gridX - 72;
  const cardW = Math.round((gridW - 40) / 2);
  const rowH = Math.round((1248 - 120) / 3);
  for (let i = 0; i < 6; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    pvCard(parts, palette, { x: gridX + col * (cardW + 40), y: 120 + row * rowH, w: cardW, h: rowH - 32 });
  }
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_PANEL));
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(5), palette.primary, { opacity: 0.18 }));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'threat-radar',
  name: 'Threat radar',
  style: 'infographic',
  description: 'A dark polar threat radar: a signal-arc hub with an image slot at its core sends thin connector hairlines out to numbered blip cards, each a translucent charcoal panel holding a primary label chip and its message. Blips ring-stack beneath the hub in portrait; the hub pins left with blips down the right in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'sequence', min: 4, max: 6, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 1,
    backgroundSlots: 1,
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
