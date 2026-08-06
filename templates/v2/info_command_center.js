// v2 template — info-command-center (style: infographic). A layered "security
// operations wall": a central hero zone (concentric signal arcs radiating
// behind an honest image slot) with sequence blocks rendered as translucent
// stacked cards orbiting it at staggered depths — tint + soft shadow layering
// implies depth — each wired back to the hero by a thin connector hairline and
// tagged with a numbered node disc. Portrait: hero centred in the upper third,
// cards in two columns below. Landscape: REAL relayout — hero pinned to the
// left third full-height, a card grid filling the right two-thirds. 4–6
// sequence blocks {label, text}, one honest image slot, decor = gradient wash
// + hero signal arcs + one ghost padlock.

import {
  textbox, rect, circle, vline, imageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvCircle, pvBars, pvSlot,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, signalArcs, padlockMotif, meshGlow,
  DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM,
  svgWrapO, PV_LAND_W,
  legibilityScrim,
} from './decor.js';

// Staggered card depth: alternating cards sit "deeper" (fainter tint, softer
// shadow) so the wall reads as layered glass, never a flat grid.
const CARD_R = 22;
const DEPTHS = [
  { tint: 0.10, shadowBlur: 28, shadowOffset: 10 },
  { tint: 0.06, shadowBlur: 18, shadowOffset: 6 }
];

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y: y - 2, w: W, h: 2, fill: palette.primary, opacity: 0.14, layerRole: 'decor' }));
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_BASE, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 180, height: 96, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text, x: 90, y: y + Math.round((144 - estTextHeight(text, size, W - 180)) / 2),
    w: W - 180, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_BASE
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize, align = 'left', subAvailH = 200 }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 300, maxSize, minSize: 40 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align,
    lineHeight: 1.06, layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + Math.round(estTextHeight(content.headline, headSize, w, 1.06)) + 20;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: Math.max(40, subAvailH), maxSize: 38, minSize: 16 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM, align,
      layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += Math.round(estTextHeight(content.subheadline, subSize, w)) + 16;
  }
  return cursor;
}

/**
 * The central hero: concentric signal arcs radiating behind an honest dashed
 * image slot, ringed by a soft primary halo. (cx, cy) is the hero center; r is
 * the outer arc radius, slot is the square image-slot side.
 */
function heroZone(o, palette, { cx, cy, r, slot }) {
  // Mesh glow behind the arcs
  o.push(...meshGlow({
    spots: [{ x: cx, y: cy, r: Math.round(r * 1.1), color: palette.primary }],
    intensity: 0.9
  }));
  o.push(...signalArcs({ x: cx, y: cy, r, rings: 5, color: palette.primary, strokeWidth: 10, intensity: 0.9 }));
  // A faint halo disc to lift the slot off the arcs
  o.push(circle({ x: cx, y: cy, r: Math.round(slot * 0.60), fill: palette.accent, opacity: 0.06, layerRole: 'decor' }));
  o.push(imageSlot({
    slotId: 'slot-1', x: Math.round(cx - slot / 2), y: Math.round(cy - slot / 2), w: slot, h: slot,
    styleHint: 'security operations centre hero emblem — shield or console, flat vector, no text',
    stroke: palette.primary
  }));
}

/**
 * One orbiting card: connector hairline from the hero anchor to the card, a
 * translucent tinted panel with a soft depth shadow, a numbered node disc, and
 * the block's label (chip) + text — both bound to msgId + fieldRef.
 */
function orbitCard(o, b, n, palette, fonts, { cardX, cardY, cardW, cardH, anchorX, anchorY, depth }) {
  const d = DEPTHS[depth % DEPTHS.length];
  const nodeCx = cardX + 44;
  const nodeCy = cardY + 44;

  // connector hairlines removed (product decision 2026-08-06) — cards float
  // free on the wall; the numbered node discs alone mark the sequence.

  // The translucent card panel — DARK_PANEL_2 at varied depth tint
  o.push(rect({
    x: cardX, y: cardY, w: cardW, h: cardH, fill: DARK_PANEL_2, rx: CARD_R,
    opacity: d.tint,
    shadow: { color: 'rgba(0,0,0,0.32)', blur: d.shadowBlur, offsetX: 0, offsetY: d.shadowOffset },
    layerRole: 'background', msgId: b.id
  }));
  // 1px accent perimeter so the glass panel keeps a readable edge
  o.push(rect({
    x: cardX, y: cardY, w: cardW, h: cardH, fill: 'transparent',
    stroke: palette.primary, strokeWidth: 1, rx: CARD_R, opacity: 0.12, layerRole: 'decor'
  }));

  // Numbered node disc (over the connector, at the card's top-left)
  o.push(circle({ x: nodeCx, y: nodeCy, r: 28, fill: DARK_BASE, layerRole: 'decor' }));
  o.push(circle({ x: nodeCx, y: nodeCy, r: 28, fill: 'transparent', stroke: palette.primary, strokeWidth: 3, opacity: 0.18, layerRole: 'decor' }));
  o.push(textbox({
    text: String(n), x: nodeCx - 28, y: nodeCy - 20, w: 56, fontSize: 30,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.primary, align: 'center',
    lineHeight: 1, layerRole: 'decor'
  }));

  // Label pill (to the right of the node): bound to fieldRef 'label'
  const pillX = nodeCx + 44;
  const pillY = cardY + 20;
  const pillW = cardW - (pillX - cardX) - 28;
  const pillH = 44;
  o.push(rect({ x: pillX, y: pillY, w: pillW, h: pillH, fill: DARK_BASE, rx: Math.round(pillH / 2), layerRole: 'message-label', msgId: b.id }));
  const labelInnerW = pillW - 36;
  const labelFontSize = fitFontSize(String(b.label).toUpperCase(), { width: labelInnerW, height: pillH - 10, maxSize: 22, minSize: 12, lineHeight: 1.16 });
  o.push({
    ...textbox({
      text: String(b.label).toUpperCase(), x: pillX + 18, y: pillY + Math.round((pillH - labelFontSize * 1.16) / 2),
      w: labelInnerW, fontSize: labelFontSize,
      fontFamily: fonts.head, fontWeight: '800', fill: palette.primary, align: 'left',
      charSpacing: 60, lineHeight: 1.16, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'label'
  });

  const bodyY = cardY + 106;
  const bodyW = cardW - 80;
  const bodyH = cardH - (bodyY - cardY) - 24;
  const size = fitFontSize(b.text, { width: bodyW, height: Math.max(60, bodyH), maxSize: 44, minSize: 20 });
  o.push({
    ...textbox({
      text: b.text, x: cardX + 40, y: bodyY, w: bodyW, fontSize: size,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
      lineHeight: 1.38, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'text'
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // Decor: two-colour gradient wash + ghost padlock
  o.push(...gradientWash({ w: W, h: 2000, from: palette.primary, to: palette.accent, direction: 'diagonal', intensity: 0.7 }));
  o.push(...padlockMotif({ x: 150, y: 1640, size: 160, color: palette.primary, intensity: 0.75 }));

  headlineZone(o, content, palette, fonts, { x: 88, y: 96, w: 1238, maxSize: 108, align: 'center' });

  // Hero centred in the upper third
  const heroCx = Math.round(W / 2);
  const heroCy = 640;
  heroZone(o, palette, { cx: heroCx, cy: heroCy, r: 370, slot: 304 });

  // Cards in two columns below the hero
  const blocks = content.blocks || [];
  const gridTop = 960;
  const gridBottom = 1840;
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
    orbitCard(o, b, i + 1, palette, fonts, {
      cardX, cardY, cardW, cardH,
      anchorX: heroCx, anchorY: heroCy, depth: (col + row) % 2
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1856);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'horizontal', intensity: 0.7 }));
  o.push(...padlockMotif({ x: 320, y: 1120, size: 160, color: palette.primary, intensity: 0.75 }));

  // Hero pinned to the left third, full height; a vertical divider hairline
  const heroBandW = 640;
  const heroCx = 330;
  // heroCy=700 → imageSlot top at 700-142=558, giving subheadline ~160px of
  // vertical space after the headline (vs 37px when heroCy was 570).
  const heroCy = 700;
  o.push(rect({ x: heroBandW - 1, y: 60, w: 2, h: 1120, fill: palette.primary, opacity: 0.12, layerRole: 'decor' }));

  headlineZone(o, content, palette, fonts, { x: 80, y: 90, w: heroBandW - 130, maxSize: 88, align: 'left', subAvailH: 160 });
  heroZone(o, palette, { cx: heroCx, cy: heroCy, r: 330, slot: 284 });

  // Card grid fills the right two-thirds
  const blocks = content.blocks || [];
  const gridX = heroBandW + 56;
  const gridTop = 120;
  const gridBottom = 1240;
  const gridW = W - gridX - 68;
  const colGap = 40;
  const cols = 2;
  const cardW = Math.round((gridW - colGap) / cols);
  const rows = Math.ceil(blocks.length / cols);
  const rowH = Math.round((gridBottom - gridTop) / Math.max(rows, 1));
  const cardH = rowH - 30;

  blocks.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const lastAlone = i === blocks.length - 1 && blocks.length % cols === 1;
    const cardX = lastAlone
      ? Math.round(gridX + (gridW - cardW) / 2)
      : gridX + col * (cardW + colGap);
    const cardY = gridTop + row * rowH;
    orbitCard(o, b, i + 1, palette, fonts, {
      cardX, cardY, cardW, cardH,
      anchorX: heroCx + 142, anchorY: heroCy, depth: (col + row) % 2
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

// ── previews ─────────────────────────────────────────────────────────────────

function pvCard(parts, palette, { x, y, w, h }) {
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), DARK_PANEL_2, { rx: 4, opacity: 0.08 }));
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), 'none', { rx: 4, stroke: palette.primary, opacity: 0.12 }));
  parts.push(pvCircle(pv(x + 44), pv(y + 44), pv(28), DARK_BASE));
  parts.push(pvRect(pv(x + 100), pv(y + 22), pv(w * 0.38), pv(32), DARK_BASE, { rx: 3 }));
  parts.push(pvBars({ x: pv(x + 40), y: pv(y + 106), w: pv(w - 80), lines: 2, barH: 4.5, gap: 3, fill: DARK_INK_DIM }));
}

function pvHero(parts, palette, { cx, cy, r, slot }) {
  for (let i = 1; i <= 5; i++) {
    parts.push(pvCircle(pv(cx), pv(cy), pv((r * i) / 5), 'none', { stroke: palette.primary, opacity: 0.10 }));
  }
  parts.push(pvSlot(pv(cx - slot / 2), pv(cy - slot / 2), pv(slot), pv(slot), palette.primary));
}

function previewPortrait(palette) {
  const parts = [
    pvBars({ x: pv(88), y: pv(110), w: pv(1238), lines: 2, barH: 8, gap: 5, fill: DARK_INK, align: 'center' })
  ];
  pvHero(parts, palette, { cx: 707, cy: 640, r: 370, slot: 304 });
  const gridTop = 960;
  const rowH = Math.round((1840 - gridTop) / 3);
  const cardW = Math.round((1238 - 40) / 2);
  for (let i = 0; i < 6; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    pvCard(parts, palette, {
      x: 88 + col * (cardW + 40), y: gridTop + row * rowH, w: cardW, h: rowH - 36
    });
  }
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_BASE));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const heroBandW = 640;
  const parts = [
    pvBars({ x: pv(80), y: pv(100), w: pv(heroBandW - 130), lines: 2, barH: 8, gap: 5, fill: DARK_INK }),
    pvRect(pv(heroBandW - 1), pv(60), pv(2), pv(1120), palette.primary, { opacity: 0.12 })
  ];
  pvHero(parts, palette, { cx: 330, cy: 570, r: 330, slot: 284 });
  const gridX = heroBandW + 56;
  const gridW = 2000 - gridX - 68;
  const cardW = Math.round((gridW - 40) / 2);
  const rowH = Math.round((1240 - 120) / 3);
  for (let i = 0; i < 6; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    pvCard(parts, palette, {
      x: gridX + col * (cardW + 40), y: 120 + row * rowH, w: cardW, h: rowH - 30
    });
  }
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_BASE));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'info-command-center',
  name: 'Security command center',
  style: 'infographic',
  description: 'A layered security-operations wall: a signal-arc hero zone with an image slot at its core, surrounded by numbered translucent cards wired back to the hero at staggered depths. Two-column cards beneath the hero in portrait; a full-height hero beside a right-hand card grid in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'sequence', min: 4, max: 6, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
