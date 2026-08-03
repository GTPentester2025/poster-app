// v2 template — threat-landscape (style: infographic). Cyber threat-landscape
// map drawn as concentric security rings: an outer ring (broad, opportunistic
// threats like ransomware), a middle ring (targeted lures like phishing), and
// an inner core (the hardest-to-spot insider risk). Each ring is colour-coded
// and numbered; a matching numbered legend on the side carries the heading +
// explanation for every zone. Deep navy ground, radial dot-grid decor.
// Portrait: headline top, rings left / legend right, CTA bottom.
// Landscape: REAL relayout — headline top-left, rings fill the left column,
// legend stacks down the right column, CTA under the rings.

import {
  textbox, rect, circle,
  fitFontSize, estTextHeight,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, dotGrid, svgWrapO
} from './decor.js';

// Self-contained palette (unique to this template): a deep-navy ground with a
// warm→cool threat gradient across the rings (hot outer = broad threats, cool
// core = the quiet insider risk).
const CANVAS = '#0F1923';       // deep navy ground
const INK = '#F1F5F9';          // near-white primary text
const INK_DIM = '#94A3B8';      // slate secondary text
const RING_EDGE = '#0B1620';    // darker navy hairline between ring bands
const ON_ZONE = '#0B1620';      // dark ink used on the bright ring fills
const ZONE = ['#DC2626', '#F97316', '#FACC15', '#38BDF8', '#A78BFA']; // outer→inner

// ── shared background: two washes + a quiet radial dot-grid texture ───────────
function backdrop(o, palette, W, H) {
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: CANVAS, direction: 'vertical', intensity: 0.5 }));
  o.push(...gradientWash({ w: W, h: H, from: palette.accent, to: CANVAS, direction: 'diagonal', intensity: 0.4 }));
  o.push(...dotGrid({
    x: 30, y: 30,
    cols: Math.ceil(W / 72), rows: Math.ceil(H / 72),
    gap: 72, dotR: 3, color: INK, intensity: 0.45
  }));
}

// ── concentric rings: n stacked discs (outer drawn first) with a numeral atop ─
function drawRings(o, blocks, cx, cy, maxR, fonts) {
  const n = Math.max(blocks.length, 1);
  for (let i = 0; i < blocks.length; i++) {
    const R = Math.round(maxR * (n - i) / n);
    const nextR = Math.round(maxR * (n - i - 1) / n);
    const bandThick = R - nextR;
    o.push(circle({ x: cx, y: cy, r: R, fill: ZONE[i % ZONE.length], opacity: 0.92, layerRole: 'decor' }));
    o.push(circle({ x: cx, y: cy, r: R, fill: 'transparent', stroke: RING_EDGE, strokeWidth: 4, opacity: 0.55, layerRole: 'decor' }));
    // zone numeral sits at the top of its own band (short string — overflow-safe)
    const numSize = Math.min(52, Math.max(20, Math.round(bandThick * 0.6)));
    o.push(textbox({
      text: String(i + 1), x: cx - 44, y: cy - R + Math.max(6, Math.round(bandThick * 0.14)),
      w: 88, fontSize: numSize, fontFamily: fonts.head, fontWeight: '900',
      fill: ON_ZONE, align: 'center', lineHeight: 1, layerRole: 'decor'
    }));
  }
}

// ── legend row: numbered colour dot + heading + text, budgeted to its slot ───
function legendRow(o, b, idx, fonts, { x, y, w, budget }) {
  const color = ZONE[idx % ZONE.length];
  const dotR = 20;
  o.push(circle({ x: x + dotR, y: y + dotR, r: dotR, fill: color, layerRole: 'decor' }));
  o.push(textbox({
    text: String(idx + 1), x, y: y + 2, w: dotR * 2, fontSize: 24,
    fontFamily: fonts.head, fontWeight: '900', fill: ON_ZONE, align: 'center',
    lineHeight: 1, layerRole: 'decor'
  }));

  const tx = x + dotR * 2 + 20;
  const tw = w - dotR * 2 - 20;

  const headBudget = Math.max(Math.round(budget * 0.42), 24);
  const headSize = fitFontSize(b.heading, { width: tw, height: headBudget, maxSize: 40, minSize: 16 });
  const headH = estTextHeight(b.heading, headSize, tw, 1.1);
  o.push({
    ...textbox({
      text: b.heading, x: tx, y, w: tw, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '800', fill: INK, lineHeight: 1.1,
      layerRole: 'message', msgId: b.id, bgRef: CANVAS
    }),
    fieldRef: 'heading'
  });

  const textTop = y + headH + 10;
  const textBudget = Math.max(budget - headH - 10 - 6, 14);
  const textSize = fitFontSize(b.text, { width: tw, height: textBudget, maxSize: 30, minSize: 14 });
  o.push({
    ...textbox({
      text: b.text, x: tx, y: textTop, w: tw, fontSize: textSize,
      fontFamily: fonts.body, fontWeight: '500', fill: INK_DIM, lineHeight: 1.25,
      layerRole: 'message', msgId: b.id, bgRef: CANVAS
    }),
    fieldRef: 'text'
  });
}

// ── CTA ───────────────────────────────────────────────────────────────────────
function ctaZone(o, text, fonts, { x, y, w }) {
  o.push(rect({ x, y: y - 16, w, h: 4, fill: ZONE[0], opacity: 0.7, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: w, height: 90, maxSize: 44, minSize: 26 });
  o.push(textbox({
    text, x, y, w, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: INK, align: 'left', layerRole: 'cta', bgRef: CANVAS
  }));
}

// ── portrait ──────────────────────────────────────────────────────────────────
function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', CANVAS);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  backdrop(o, palette, W, H);

  const margin = 80;
  const innerW = W - margin * 2;

  const headSize = fitFontSize(content.headline, { width: innerW, height: 300, maxSize: 92, minSize: 40 });
  const headH = estTextHeight(content.headline, headSize, innerW, 1.02);
  o.push(textbox({
    text: content.headline, x: margin, y: 90, w: innerW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: INK, align: 'left',
    lineHeight: 1.02, layerRole: 'headline', bgRef: CANVAS
  }));
  let cursor = 90 + headH + 20;

  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: innerW, height: 90, maxSize: 40, minSize: 16 });
    o.push(textbox({
      text: content.subheadline, x: margin, y: cursor, w: innerW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: INK_DIM,
      layerRole: 'subheadline', bgRef: CANVAS
    }));
    cursor += estTextHeight(content.subheadline, subSize, innerW, 1.2) + 24;
  }

  const blocks = content.blocks || [];
  const ctaY = H - 130;
  const zoneTop = cursor + 10;
  const zoneBottom = ctaY - 40;
  const zoneH = zoneBottom - zoneTop;

  const cx = margin + 360;
  const maxR = Math.min(360, Math.round(zoneH / 2));
  const cy = Math.round(zoneTop + zoneH / 2);
  drawRings(o, blocks, cx, cy, maxR, fonts);

  const legX = cx + maxR + 40;
  const legW = margin + innerW - legX;
  const n = Math.max(blocks.length, 1);
  const rowGap = 20;
  const rowBudget = Math.max(80, Math.floor((zoneH - rowGap * (n - 1)) / n));
  let ry = zoneTop;
  blocks.forEach((b, i) => {
    legendRow(o, b, i, fonts, { x: legX, y: ry, w: legW, budget: rowBudget });
    ry += rowBudget + rowGap;
  });

  ctaZone(o, content.callToAction, fonts, { x: margin, y: ctaY, w: innerW });
  return canvas;
}

// ── landscape ─────────────────────────────────────────────────────────────────
function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', CANVAS);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  backdrop(o, palette, W, H);

  const margin = 80;
  const innerW = W - margin * 2;

  const headW = Math.round(innerW * 0.6);
  const headSize = fitFontSize(content.headline, { width: headW, height: 200, maxSize: 88, minSize: 36 });
  const headH = estTextHeight(content.headline, headSize, headW, 1.02);
  o.push(textbox({
    text: content.headline, x: margin, y: 80, w: headW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: INK, lineHeight: 1.02,
    layerRole: 'headline', bgRef: CANVAS
  }));
  let topCursor = 80 + headH + 16;

  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: headW, height: 80, maxSize: 36, minSize: 16 });
    o.push(textbox({
      text: content.subheadline, x: margin, y: topCursor, w: headW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: INK_DIM,
      layerRole: 'subheadline', bgRef: CANVAS
    }));
    topCursor += estTextHeight(content.subheadline, subSize, headW, 1.2) + 20;
  }

  const blocks = content.blocks || [];
  const ctaY = H - 120;
  const zoneTop = topCursor + 10;
  const zoneBottom = ctaY - 30;
  const zoneH = zoneBottom - zoneTop;

  const cx = margin + 420;
  const maxR = Math.min(430, Math.round(zoneH / 2));
  const cy = Math.round(zoneTop + zoneH / 2);
  drawRings(o, blocks, cx, cy, maxR, fonts);

  const legX = cx + maxR + 60;
  const legW = W - margin - legX;
  const n = Math.max(blocks.length, 1);
  const rowGap = 24;
  const rowBudget = Math.max(80, Math.floor((zoneH - rowGap * (n - 1)) / n));
  let ry = zoneTop;
  blocks.forEach((b, i) => {
    legendRow(o, b, i, fonts, { x: legX, y: ry, w: legW, budget: rowBudget });
    ry += rowBudget + rowGap;
  });

  ctaZone(o, content.callToAction, fonts, { x: margin, y: ctaY, w: headW });
  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────
function previewPortrait() {
  const W = 1414; const H = 2000; const margin = 80; const innerW = W - margin * 2;
  const parts = [];
  parts.push(pvRect(pv(margin), pv(90), pv(innerW), pv(120), INK, { rx: 4 }));
  parts.push(pvRect(pv(margin), pv(250), pv(innerW * 0.6), pv(24), INK_DIM, { rx: 3 }));
  const cx = margin + 360; const cy = 1120; const maxR = 360; const n = 3;
  for (let i = 0; i < n; i++) {
    const R = Math.round(maxR * (n - i) / n);
    parts.push(pvCircle(pv(cx), pv(cy), pv(R), ZONE[i], { opacity: 0.92 }));
  }
  const legX = cx + maxR + 40; const legW = margin + innerW - legX;
  let ry = 560; const rb = 380;
  for (let i = 0; i < n; i++) {
    parts.push(pvCircle(pv(legX + 20), pv(ry + 20), pv(20), ZONE[i]));
    parts.push(pvRect(pv(legX + 60), pv(ry), pv(legW * 0.7), pv(28), INK, { rx: 3 }));
    parts.push(pvBars({ x: pv(legX + 60), y: pv(ry + 44), w: pv(legW - 60), lines: 2, barH: 6, gap: 5, fill: INK_DIM }));
    ry += rb + 20;
  }
  parts.push(pvRect(pv(margin), pv(H - 140), pv(innerW * 0.6), pv(30), ZONE[0], { rx: 3 }));
  return svgWrapO(parts, CANVAS, 'portrait');
}

function previewLandscape() {
  const W = 2000; const H = 1414; const margin = 80; const innerW = W - margin * 2;
  const parts = [];
  parts.push(pvRect(pv(margin), pv(80), pv(innerW * 0.6), pv(100), INK, { rx: 4 }));
  parts.push(pvRect(pv(margin), pv(200), pv(innerW * 0.4), pv(20), INK_DIM, { rx: 3 }));
  const cx = margin + 420; const cy = 790; const maxR = 430; const n = 3;
  for (let i = 0; i < n; i++) {
    const R = Math.round(maxR * (n - i) / n);
    parts.push(pvCircle(pv(cx), pv(cy), pv(R), ZONE[i], { opacity: 0.92 }));
  }
  const legX = cx + maxR + 60; const legW = W - margin - legX;
  let ry = 340; const rb = 300;
  for (let i = 0; i < n; i++) {
    parts.push(pvCircle(pv(legX + 20), pv(ry + 20), pv(20), ZONE[i]));
    parts.push(pvRect(pv(legX + 60), pv(ry), pv(legW * 0.7), pv(26), INK, { rx: 3 }));
    parts.push(pvBars({ x: pv(legX + 60), y: pv(ry + 42), w: pv(legW - 60), lines: 2, barH: 6, gap: 5, fill: INK_DIM }));
    ry += rb + 24;
  }
  parts.push(pvRect(pv(margin), pv(H - 120), pv(innerW * 0.4), pv(28), ZONE[0], { rx: 3 }));
  return svgWrapO(parts, CANVAS, 'landscape');
}

export default {
  id: 'threat-landscape',
  name: 'Threat landscape',
  style: 'infographic',
  description: 'A cyber threat-landscape map drawn as concentric security rings — a broad outer zone, a targeted middle zone, and a hard-to-spot inner core — each colour-coded, numbered, and explained in a matching numbered legend. Deep-navy ground with a quiet radial dot-grid texture. Portrait sets the rings left with the legend stacked right; landscape moves the headline top-left, fills the left column with the rings, and stacks the legend down the right.',
  contentSchema: {
    headline: { required: true, maxWords: 6 },
    subheadline: { required: false, maxWords: 12 },
    blocks: { kind: 'panels', min: 3, max: 5, fields: ['heading', 'text'] },
    callToAction: { required: true, maxWords: 8 },
    backgroundSlots: 0,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
