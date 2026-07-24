// v2 template — orbit-path (style: timeline). A DARK luminous orbital timeline:
// a glowing curved "orbit" path — approximated as a run of small palette.primary
// dots/segments — sweeps down (portrait) or across (landscape) the canvas from a
// lit "planet" hub that cradles the ONE honest image slot behind a softGlow halo.
// Each sequence step is a STATION ON the orbit: a numbered node disc (primary
// ring on DARK_PANEL) with the block's LABEL (uppercase primary chip) + TEXT
// (light DARK_INK, >=38px) in a small translucent DARK_PANEL card beside it.
// Portrait: the orbit is a gentle vertical arc and stations alternate LEFT/RIGHT
// of the path. Landscape is a REAL relayout — the orbit sweeps horizontally and
// stations alternate ABOVE/BELOW the path. A DARK_PANEL CTA bar with
// palette.primary text seals the bottom. 4–6 sequence blocks {label, text}.

import {
  textbox, rect, circle, imageSlot, backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvCircle, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, meshGlow, softGlow, svgWrapO, PV_LAND_W, legibilityScrim,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM
} from './decor.js';

const CARD_R = 22;

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_PANEL, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 5, fill: palette.primary, opacity: 0.18, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 180, height: 96, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text, x: 90, y: y + Math.round((144 - estTextHeight(text, size, W - 180)) / 2),
    w: W - 180, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize, headMaxH = 280, subMaxH = 120, align = 'left' }) {
  const headSize = fitFontSize(content.headline, { width: w, height: headMaxH, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align,
    layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w) + 20;
  if (content.subheadline && subMaxH > 0) {
    // Guard: only emit the subheadline when there is enough vertical room for at
    // least one line at minSize (16px * 1.35 = 21.6px).  Long headlines can push
    // the cursor so close to the first station-card that a sub would overlap it.
    const minSubH = estTextHeight(content.subheadline, 16, w, 1.35);
    if (subMaxH * 1.05 >= minSubH) {
      const subSize = fitFontSize(content.subheadline, { width: w, height: subMaxH, maxSize: 38, minSize: 16, lineHeight: 1.35 });
      o.push(textbox({
        text: content.subheadline, x, y: cursor, w, fontSize: subSize,
        fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM, align,
        lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE
      }));
      cursor += estTextHeight(content.subheadline, subSize, w, 1.35) + 16;
    }
  }
  return cursor;
}

/**
 * The orbit "planet" hub: a soft primary glow halo cradling the ONE honest
 * dashed image slot at the orbit's origin. (cx, cy) is the hub center; slot is
 * the image-slot side.
 */
function hubZone(o, palette, { cx, cy, slot }) {
  o.push(...softGlow({ x: cx, y: cy, r: Math.round(slot * 1.05), color: palette.primary, intensity: 1 }));
  o.push(circle({ x: cx, y: cy, r: Math.round(slot * 0.62), fill: palette.primary, opacity: 0.09, layerRole: 'decor' }));
  o.push(imageSlot({
    slotId: 'slot-1', x: Math.round(cx - slot / 2), y: Math.round(cy - slot / 2), w: slot, h: slot,
    styleHint: 'central orbit hub emblem — planet or guarded core, flat vector, no text',
    stroke: palette.primary
  }));
}

/**
 * Glowing orbit path — a run of small primary dots (with a faint scatter of
 * larger blooms) laid along a straight segment from (x1,y1) to (x2,y2). This is
 * the decor "orbit": every dot is a low-opacity primary Circle, so the path
 * reads as a luminous arc without any Path serialization. Returns nothing;
 * pushes onto o.
 */
function orbitPath(o, palette, { x1, y1, x2, y2, dots = 26 }) {
  for (let i = 0; i <= dots; i++) {
    const t = i / dots;
    const x = Math.round(x1 + (x2 - x1) * t);
    const y = Math.round(y1 + (y2 - y1) * t);
    o.push(circle({ x, y, r: 5, fill: palette.primary, opacity: 0.18, layerRole: 'decor' }));
    if (i % 4 === 0) {
      o.push(circle({ x, y, r: 12, fill: palette.primary, opacity: 0.08, layerRole: 'decor' }));
    }
  }
}

/**
 * A numbered station node disc sitting ON the orbit at (nx, ny): a soft primary
 * halo, a DARK_PANEL core ringed in primary, and the 1..N index in primary.
 */
function stationNode(o, n, palette, fonts, { nx, ny }) {
  o.push(circle({ x: nx, y: ny, r: 46, fill: palette.primary, opacity: 0.1, layerRole: 'decor' }));
  o.push(circle({ x: nx, y: ny, r: 32, fill: DARK_PANEL, layerRole: 'decor' }));
  o.push(circle({ x: nx, y: ny, r: 32, fill: 'transparent', stroke: palette.primary, strokeWidth: 4, layerRole: 'decor' }));
  o.push(textbox({
    text: String(n), x: nx - 32, y: ny - 22, w: 64, fontSize: 34,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.primary, align: 'center',
    lineHeight: 1, layerRole: 'decor'
  }));
}

/**
 * A station card beside a node: a translucent DARK_PANEL card + primary tint +
 * hairline rim, carrying the block's LABEL (uppercase primary chip, fieldRef
 * 'label') and TEXT (light DARK_INK, fieldRef 'text'). A short connector
 * hairline (a rotated Rect) links the node to the card.
 */
function stationCard(o, b, palette, fonts, { cardX, cardY, cardW, cardH, nx, ny }) {
  // connector hairline node → card (drawn first, under the card)
  const targetX = nx < cardX ? cardX : cardX + cardW;
  const dx = targetX - nx;
  const dy = (cardY + cardH / 2) - ny;
  const len = Math.max(1, Math.round(Math.hypot(dx, dy)));
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  o.push(rect({
    x: nx, y: ny - 2, w: len, h: 4, fill: palette.primary,
    angle, opacity: 0.16, layerRole: 'decor'
  }));

  // translucent DARK_PANEL card
  o.push(rect({
    x: cardX, y: cardY, w: cardW, h: cardH, fill: DARK_PANEL, rx: CARD_R,
    shadow: { color: 'rgba(0,0,0,0.45)', blur: 24, offsetX: 0, offsetY: 9 },
    layerRole: 'background', msgId: b.id
  }));
  o.push(rect({
    x: cardX, y: cardY, w: cardW, h: cardH, fill: palette.primary, rx: CARD_R,
    opacity: 0.06, layerRole: 'decor'
  }));
  o.push(rect({
    x: cardX, y: cardY, w: cardW, h: cardH, fill: 'transparent',
    stroke: palette.primary, strokeWidth: 2, rx: CARD_R, opacity: 0.2, layerRole: 'decor'
  }));

  // label chip — uppercase primary text on a DARK_BASE pill (bound label)
  const pillX = cardX + 30;
  const pillY = cardY + 24;
  const pillW = cardW - 60;
  const pillH = 46;
  // label avail = bodyY - (pillY + (pillH-labelH)/2) - 8 = 100 - (24 + ~10) - 8 = 58
  // cap label font so estH ≤ 50 (58*1.05=60.9, 50 safe)
  const labelInnerW = pillW - 44;
  const labelSize = fitFontSize(String(b.label).toUpperCase(), { width: labelInnerW, height: 50, maxSize: 22, minSize: 10, lineHeight: 1.16 });
  o.push(rect({ x: pillX, y: pillY, w: pillW, h: pillH, fill: DARK_BASE, rx: pillH / 2, layerRole: 'message-label', msgId: b.id }));
  o.push({
    ...textbox({
      text: String(b.label).toUpperCase(), x: pillX + 22, y: pillY + Math.round((pillH - labelSize * 1.16) / 2),
      w: labelInnerW, fontSize: labelSize,
      fontFamily: fonts.head, fontWeight: '800', fill: palette.primary, align: 'left',
      charSpacing: 60, lineHeight: 1.16, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'label'
  });

  // block text — light ink on the DARK_PANEL card, >=38px
  const textX = cardX + 40;
  const bodyY = cardY + 100;
  const bodyW = cardW - 80;
  const size = fitFontSize(b.text, { width: bodyW, height: cardH - (bodyY - cardY) - 26, maxSize: 44, minSize: 38 });
  o.push({
    ...textbox({
      text: b.text, x: textX, y: bodyY, w: bodyW, fontSize: size,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK,
      layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'text'
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of a luminous orbital starfield sweep with glowing arcs and distant nebula, deep near-black, cyan and gold glow, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // atmosphere
  o.push(...meshGlow({
    spots: [
      { x: 250, y: 360, r: 460, color: palette.primary },
      { x: 1180, y: 1560, r: 520, color: palette.accent }
    ],
    intensity: 0.9
  }));

  // hubZone imageSlot top at cy-slot/2; sub must clear by 8px.
  // hubCy=640: slot top=515, avail for headline=411 → 4 lines at 80px (371px) fits.
  // headMaxH:200 → headEnd≤296 for normal content; subMaxH computed dynamically.
  const hubCx = Math.round(W / 2);
  const hubCy = 640;
  const slotTop = hubCy - 125;  // slot = 250, cy - slot/2
  const headSizeP = fitFontSize(content.headline, { width: 1234, height: 200, maxSize: 104, minSize: 80 });
  const headHP = estTextHeight(content.headline, headSizeP, 1234);
  const subMaxHP = Math.max(0, slotTop - (96 + headHP + 20) - 8);
  headlineZone(o, content, palette, fonts, { x: 90, y: 96, w: 1234, maxSize: 104, headMaxH: 200, subMaxH: subMaxHP, align: 'center' });
  hubZone(o, palette, { cx: hubCx, cy: hubCy, slot: 250 });

  // the orbit sweeps down the vertical centre from the hub to the CTA
  const orbitX = hubCx;
  const orbitTop = hubCy + 150;
  const orbitBottom = 1800;
  orbitPath(o, palette, { x1: orbitX, y1: orbitTop, x2: orbitX, y2: orbitBottom, dots: 30 });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const bandH = (orbitBottom - orbitTop) / n;
  const cardW = 560;
  const gap = 60;                      // node-to-card gutter
  blocks.forEach((b, i) => {
    const ny = Math.round(orbitTop + bandH * (i + 0.5));
    const left = i % 2 === 0;          // alternate sides of the orbit
    const cardH = Math.round(bandH) - 40;
    const cardY = Math.round(ny - cardH / 2);
    const cardX = left ? orbitX - gap - cardW : orbitX + gap;
    stationCard(o, b, palette, fonts, { cardX, cardY, cardW, cardH, nx: orbitX, ny });
    stationNode(o, i + 1, palette, fonts, { nx: orbitX, ny });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1856);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of a luminous orbital starfield sweep with glowing arcs and distant nebula, deep near-black, cyan and gold glow, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({
    spots: [
      { x: 300, y: 500, r: 520, color: palette.primary },
      { x: 1640, y: 1080, r: 560, color: palette.accent }
    ],
    intensity: 0.9
  }));

  // planet hub at the orbit's origin, left side
  const hubCx = 300;
  const hubCy = 720;

  // Above-orbit cards: cardY = orbitY - gap - cardH = 720-70-360=290.
  // First card body text (bodyY) = cardY + 100 = 390.
  // Compute subMaxH from the actual headline height so long headlines
  // don't push the subheadline into the first card's body zone.
  const LS_CARD_H = 360;
  const LS_GAP = 70;
  const firstCardBodyTop = hubCy - LS_GAP - LS_CARD_H + 100;  // = 390
  const headSizeL = fitFontSize(content.headline, { width: 1500, height: 150, maxSize: 92, minSize: 80 });
  const headHL = estTextHeight(content.headline, headSizeL, 1500);
  const subMaxHL = Math.max(0, firstCardBodyTop - (80 + headHL + 20) - 8);
  headlineZone(o, content, palette, fonts, { x: 90, y: 80, w: 1500, maxSize: 92, headMaxH: 150, subMaxH: subMaxHL, align: 'left' });

  hubZone(o, palette, { cx: hubCx, cy: hubCy, slot: 240 });

  // the orbit sweeps horizontally across the middle from the hub to the right edge
  const orbitY = hubCy;
  const orbitLeft = hubCx + 220;
  const orbitRight = 1900;
  orbitPath(o, palette, { x1: orbitLeft, y1: orbitY, x2: orbitRight, y2: orbitY, dots: 34 });

  const blocks = content.blocks || [];
  const n = Math.max(blocks.length, 1);
  const bandW = (orbitRight - orbitLeft) / n;
  const cardW = Math.round(bandW) - 40;
  const cardH = LS_CARD_H;
  const gap = LS_GAP;                   // node-to-card gutter (vertical)
  blocks.forEach((b, i) => {
    const nx = Math.round(orbitLeft + bandW * (i + 0.5));
    const above = i % 2 === 0;         // alternate above/below the orbit
    const cardX = Math.round(nx - cardW / 2);
    const cardY = above ? orbitY - gap - cardH : orbitY + gap;
    stationCard(o, b, palette, fonts, {
      cardX, cardY, cardW, cardH,
      nx, ny: orbitY
    });
    stationNode(o, i + 1, palette, fonts, { nx, ny: orbitY });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

// ── previews ─────────────────────────────────────────────────────────────────

function pvOrbit(parts, palette, { x1, y1, x2, y2, dots }) {
  for (let i = 0; i <= dots; i++) {
    const t = i / dots;
    parts.push(pvCircle(pv(x1 + (x2 - x1) * t), pv(y1 + (y2 - y1) * t), 1.4, palette.primary, { opacity: 0.2 }));
  }
}

function pvNode(parts, palette, { nx, ny }) {
  parts.push(pvCircle(pv(nx), pv(ny), pv(46), palette.primary, { opacity: 0.1 }));
  parts.push(pvCircle(pv(nx), pv(ny), pv(32), DARK_PANEL, { stroke: palette.primary }));
}

function pvCard(parts, palette, { x, y, w, h }) {
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), DARK_PANEL, { rx: 4 }));
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), 'none', { rx: 4, stroke: palette.primary, opacity: 0.4 }));
  parts.push(pvRect(pv(x + 30), pv(y + 24), pv(w * 0.5), pv(34), DARK_BASE, { rx: 3 }));
  parts.push(pvBars({ x: pv(x + 40), y: pv(y + 100), w: pv(w - 80), lines: 2, barH: 4.5, gap: 3, fill: DARK_INK }));
}

function previewPortrait(palette) {
  const parts = [
    pvCircle(pv(250), pv(360), pv(120), palette.primary, { opacity: 0.1 }),
    pvCircle(pv(1180), pv(1560), pv(130), palette.accent, { opacity: 0.1 }),
    pvBars({ x: pv(90), y: pv(110), w: pv(1234), lines: 2, barH: 8, gap: 5, fill: DARK_INK, align: 'center' })
  ];
  const hubCx = 707;
  const hubCy = 560;
  parts.push(pvCircle(pv(hubCx), pv(hubCy), pv(155), palette.primary, { opacity: 0.09 }));
  parts.push(pvSlot(pv(hubCx - 125), pv(hubCy - 125), pv(250), pv(250), palette.primary));
  const orbitTop = hubCy + 150;
  const orbitBottom = 1800;
  pvOrbit(parts, palette, { x1: hubCx, y1: orbitTop, x2: hubCx, y2: orbitBottom, dots: 30 });
  const n = 4;
  const bandH = (orbitBottom - orbitTop) / n;
  const cardW = 560;
  const gap = 60;
  for (let i = 0; i < n; i++) {
    const ny = orbitTop + bandH * (i + 0.5);
    const left = i % 2 === 0;
    const cardH = bandH - 40;
    const cardY = ny - cardH / 2;
    const cardX = left ? hubCx - gap - cardW : hubCx + gap;
    pvCard(parts, palette, { x: cardX, y: cardY, w: cardW, h: cardH });
    pvNode(parts, palette, { nx: hubCx, ny });
  }
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_PANEL));
  parts.push(pvRect(0, pv(1856), 200, pv(5), palette.primary, { opacity: 0.18 }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvCircle(pv(300), pv(500), pv(130), palette.primary, { opacity: 0.1 }),
    pvCircle(pv(1640), pv(1080), pv(140), palette.accent, { opacity: 0.1 }),
    pvBars({ x: pv(90), y: pv(90), w: pv(1500), lines: 2, barH: 8, gap: 5, fill: DARK_INK })
  ];
  const hubCx = 300;
  const hubCy = 720;
  parts.push(pvCircle(pv(hubCx), pv(hubCy), pv(149), palette.primary, { opacity: 0.09 }));
  parts.push(pvSlot(pv(hubCx - 120), pv(hubCy - 120), pv(240), pv(240), palette.primary));
  const orbitLeft = hubCx + 220;
  const orbitRight = 1900;
  pvOrbit(parts, palette, { x1: orbitLeft, y1: hubCy, x2: orbitRight, y2: hubCy, dots: 34 });
  const n = 4;
  const bandW = (orbitRight - orbitLeft) / n;
  const cardW = bandW - 40;
  const cardH = 360;
  const gap = 70;
  for (let i = 0; i < n; i++) {
    const nx = orbitLeft + bandW * (i + 0.5);
    const above = i % 2 === 0;
    const cardX = nx - cardW / 2;
    const cardY = above ? hubCy - gap - cardH : hubCy + gap;
    pvCard(parts, palette, { x: cardX, y: cardY, w: cardW, h: cardH });
    pvNode(parts, palette, { nx, ny: hubCy });
  }
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_PANEL));
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(5), palette.primary, { opacity: 0.18 }));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'orbit-path',
  name: 'Orbit path',
  style: 'timeline',
  description: 'A dark luminous orbital timeline: a glowing dotted orbit path sweeps out from a lit planet hub that cradles the image slot, and each step is a numbered station node on the orbit with its label chip and message in a translucent charcoal card. Stations alternate left/right of a vertical orbit in portrait; the orbit sweeps horizontally with stations alternating above/below in landscape.',
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
