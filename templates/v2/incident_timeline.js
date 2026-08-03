// v2 template — incident_timeline (style: timeline). Security incident breach
// timeline with dark red-black canvas, left timeline rail, severity-coded event
// cards with red-to-amber color progression, and CTA footer.
// Portrait: timeline rail on left, event cards stacked right.
// Landscape: horizontal timeline across top, cards below in 2-column grid.

import { textbox, rect, circle, backgroundImageSlot, pv, pvRect, pvCircle, pvBars } from '../helpers.js';
import { makeCanvasV2, canvasDims, gradientWash, legibilityScrim, svgWrapO, PV_LAND_W, DARK_BASE, DARK_INK } from './decor.js';

// ── palette derivation ────────────────────────────────────────────────────────
function colors(palette) {
  return {
    darkRedBlack: '#1A0A0A',
    charcoal: '#2A1515',
    gray: '#4A4A4A',
    white: '#F8FAFC',
    lightGray: '#D1D5DB',
    red: palette.primary || '#DC2626',
    darkRed: palette.accent || '#991B1B',
    white: '#F8FAFC',
    severity: { red: '#DC2626', orange: '#EA580C', amber: '#F59E0B', yellow: '#FBBF24' }
  };
}

// ── backdrop ──────────────────────────────────────────────────────────────────
function backdrop(o, palette, W, H) {
  const c = colors(palette);
  // full-bleed background image slot + legibility scrim first — the canvas
  // `background` field carries the dark base, so no opaque rect hides the image
  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark red-black incident war-room backdrop, subtle texture, no text', stroke: c.red }));
  o.push(...legibilityScrim({ w: W, h: H, color: c.darkRedBlack, strength: 0.9 }));
  o.push(rect({ x: 0, y: 0, w: W, h: H, fill: c.charcoal, opacity: 0.15 }));
  o.push(...gradientWash({ w: W, h: H, from: c.darkRed, to: c.darkRedBlack, direction: 'diagonal', intensity: 0.12 }));
}

// ── timeline rail ─────────────────────────────────────────────────────────────
function rail(o, palette, W, H) {
  const c = colors(palette);
  o.push(rect({ x: 78, y: 0, w: 4, h: H, fill: c.red, opacity: 0.6 }));
}

// ── severity dot ──────────────────────────────────────────────────────────────
function severityDot(o, palette, severity, x, y) {
  const c = colors(palette);
  const sev = c.severity[severity] || c.severity.amber;
  o.push(circle({ cx: x, cy: y, r: 10, fill: sev }));
  o.push(circle({ cx: x, cy: y, r: 6, fill: sev, opacity: 0.3 }));
}

const SEVERITY_INDEX = ['red', 'orange', 'amber', 'yellow'];

// ── portrait build ────────────────────────────────────────────────────────────
function buildPortrait(content, palette, fonts) {
  const { w: W, h: H } = canvasDims('portrait');
  const c = colors(palette);
  const objects = [];
  backdrop(objects, palette, W, H);
  rail(objects, palette, W, H);

  // Incident header
  const headerW = W - 140;
  objects.push(textbox({ text: String(content.headline || 'INCIDENT TIMELINE').toUpperCase(), x: 120, y: 60, w: headerW, fontSize: 44, fontFamily: fonts.head, fontWeight: '900', fill: c.red }));

  if (content.subheadline) {
    objects.push(textbox({ text: String(content.subheadline), x: 120, y: 120, w: headerW, fontSize: 22, fontFamily: fonts.body, fontWeight: '400', fill: c.lightGray, opacity: 0.85 }));
  }

  const blocks = Array.isArray(content.blocks) ? content.blocks : [];
  const blockStartY = 180;
  const blockH = Math.min(300, Math.floor((H - blockStartY - 120) / Math.max(blocks.length, 1)));
  const cardW = headerW;

  // Timeline nodes + cards
  blocks.forEach((b, i) => {
    const yBase = blockStartY + i * (blockH + 20);
    const nodeY = yBase + 50;
    const cardX = 120;
    const sevColor = SEVERITY_INDEX[i % SEVERITY_INDEX.length];

    // Timeline node
    severityDot(objects, palette, sevColor, 80, nodeY);

    // Card background
    objects.push(rect({ x: cardX, y: yBase, w: cardW, h: blockH, fill: c.charcoal, rx: 8, ry: 8, opacity: 0.5 }));

    // Severity bar on card left (red-to-amber gradient effect via color progression)
    objects.push(rect({ x: cardX, y: yBase, w: 6, h: blockH, fill: c.severity[sevColor], rx: 3, ry: 3 }));

    // Card label
    if (b.label) {
      objects.push(textbox({ text: String(b.label).toUpperCase(), x: cardX + 20, y: yBase + 16, w: cardW - 40, fontSize: 14, fontFamily: fonts.head, fontWeight: '700', fill: c.severity[sevColor] }));
    }

    // Card heading/title
    if (b.heading || b.title) {
      objects.push(textbox({ text: String(b.heading || b.title || ''), x: cardX + 20, y: yBase + 38, w: cardW - 40, fontSize: 20, fontFamily: fonts.head, fontWeight: '700', fill: c.white }));
    }

    // Card body text
    if (b.text) {
      objects.push(textbox({ text: String(b.text), x: cardX + 20, y: yBase + 70, w: cardW - 40, fontSize: 15, fontFamily: fonts.body, fontWeight: '400', fill: c.lightGray, opacity: 0.8 }));
    }
  });

  // Footer CTA
  if (content.callToAction) {
    objects.push(rect({ x: 120, y: H - 90, w: headerW, h: 2, fill: c.red, opacity: 0.4 }));
    objects.push(textbox({ text: String(content.callToAction).toUpperCase(), x: 120, y: H - 75, w: headerW, fontSize: 16, fontFamily: fonts.head, fontWeight: '700', fill: c.red }));
  }

  return { version: '6.7.1', width: W, height: H, background: c.darkRedBlack, objects };
}

// ── landscape build ───────────────────────────────────────────────────────────
function buildLandscape(content, palette, fonts) {
  const { w: W, h: H } = canvasDims('landscape');
  const c = colors(palette);
  const objects = [];
  // full-bleed background image slot + scrim first (dark base lives on
  // canvas.background), then the thin top accent bar
  objects.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark red-black incident war-room backdrop, subtle texture, no text', stroke: c.red }));
  objects.push(...legibilityScrim({ w: W, h: H, color: c.darkRedBlack, strength: 0.9 }));
  objects.push(rect({ x: 0, y: 0, w: W, h: H, fill: c.charcoal, opacity: 0.1 }));
  objects.push(rect({ x: 0, y: 0, w: W, h: 6, fill: c.red }));

  // Header — full width
  objects.push(textbox({ text: String(content.headline || 'INCIDENT TIMELINE').toUpperCase(), x: 60, y: 50, w: W - 120, fontSize: 48, fontFamily: fonts.head, fontWeight: '900', fill: c.red }));

  if (content.subheadline) {
    objects.push(textbox({ text: String(content.subheadline), x: 60, y: 112, w: W - 120, fontSize: 22, fontFamily: fonts.body, fontWeight: '400', fill: c.lightGray, opacity: 0.8 }));
  }

  const blocks = Array.isArray(content.blocks) ? content.blocks : [];
  const cols = 2;
  const colW = (W - 180) / cols;
  const cardH = Math.floor((H - 220 - 40 * (Math.ceil(blocks.length / cols) - 1)) / Math.ceil(blocks.length / cols));
  const startY = 170;

  blocks.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 60 + col * (colW + 60);
    const y = startY + row * (cardH + 20);
    const sevColor = SEVERITY_INDEX[i % SEVERITY_INDEX.length];

    objects.push(rect({ x, y, w: colW, h: cardH, fill: c.charcoal, rx: 6, ry: 6, opacity: 0.5 }));
    objects.push(rect({ x, y, w: 6, h: cardH, fill: c.severity[sevColor], rx: 3, ry: 3 }));

    if (b.label) {
      objects.push(textbox({ text: String(b.label).toUpperCase(), x: x + 20, y: y + 12, w: colW - 40, fontSize: 13, fontFamily: fonts.head, fontWeight: '700', fill: c.severity[sevColor] }));
    }
    if (b.text) {
      objects.push(textbox({ text: String(b.text), x: x + 20, y: y + 36, w: colW - 40, fontSize: 14, fontFamily: fonts.body, fontWeight: '400', fill: c.lightGray, opacity: 0.8 }));
    }
  });

  if (content.callToAction) {
    objects.push(rect({ x: 60, y: H - 60, w: W - 120, h: 1, fill: c.red, opacity: 0.3 }));
    objects.push(textbox({ text: String(content.callToAction).toUpperCase(), x: 60, y: H - 50, w: W - 120, fontSize: 15, fontFamily: fonts.head, fontWeight: '700', fill: c.red }));
  }

  return { version: '6.7.1', width: W, height: H, background: c.darkRedBlack, objects };
}

// ── preview SVGs (pv-scaled geometry with bars standing in for text) ──────────
const SEV_HEX = ['#DC2626', '#EA580C', '#F59E0B', '#FBBF24'];

function previewPortrait(palette) {
  const c = colors(palette);
  const parts = [
    pvRect(pv(78), 0, 1, 283, c.red, { opacity: 0.6 }),
    pvBars({ x: pv(120), y: pv(60), w: pv(900), lines: 1, barH: 9, gap: 0, fill: c.red }),
    pvBars({ x: pv(120), y: pv(126), w: pv(620), lines: 1, barH: 5, gap: 0, fill: c.lightGray })
  ];
  for (let i = 0; i < 4; i++) {
    const y = 180 + i * 320;
    parts.push(pvCircle(pv(80), pv(y + 50), 1.5, SEV_HEX[i % SEV_HEX.length]));
    parts.push(pvRect(pv(120), pv(y), pv(1154), pv(300), c.charcoal, { rx: 1.5, opacity: 0.5 }));
    parts.push(pvRect(pv(120), pv(y), 1, pv(300), SEV_HEX[i % SEV_HEX.length]));
    parts.push(pvBars({ x: pv(140), y: pv(y + 20), w: pv(400), lines: 1, barH: 3, gap: 0, fill: SEV_HEX[i % SEV_HEX.length] }));
    parts.push(pvBars({ x: pv(140), y: pv(y + 70), w: pv(1080), lines: 2, barH: 3, gap: 2, fill: c.lightGray }));
  }
  parts.push(pvRect(pv(120), pv(1910), pv(1154), 0.5, c.red, { opacity: 0.4 }));
  parts.push(pvBars({ x: pv(120), y: pv(1925), w: pv(700), lines: 1, barH: 3, gap: 0, fill: c.red }));
  return svgWrapO(parts, c.darkRedBlack, 'portrait');
}

function previewLandscape(palette) {
  const c = colors(palette);
  const parts = [
    pvRect(0, 0, PV_LAND_W, 1, c.red),
    pvBars({ x: pv(60), y: pv(50), w: pv(1000), lines: 1, barH: 8, gap: 0, fill: c.red }),
    pvBars({ x: pv(60), y: pv(112), w: pv(700), lines: 1, barH: 4, gap: 0, fill: c.lightGray })
  ];
  for (let i = 0; i < 6; i++) {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 60 + col * 970, y = 170 + row * 380;
    parts.push(pvRect(pv(x), pv(y), pv(910), pv(350), c.charcoal, { rx: 1, opacity: 0.5 }));
    parts.push(pvRect(pv(x), pv(y), 1, pv(350), SEV_HEX[i % SEV_HEX.length]));
    parts.push(pvBars({ x: pv(x + 20), y: pv(y + 12), w: pv(300), lines: 1, barH: 2.5, gap: 0, fill: SEV_HEX[i % SEV_HEX.length] }));
    parts.push(pvBars({ x: pv(x + 20), y: pv(y + 50), w: pv(860), lines: 2, barH: 2.5, gap: 2, fill: c.lightGray }));
  }
  parts.push(pvRect(pv(60), pv(1354), pv(1880), 0.5, c.red, { opacity: 0.3 }));
  return svgWrapO(parts, c.darkRedBlack, 'landscape');
}

// ── manifest ──────────────────────────────────────────────────────────────────
export default {
  id: 'incident-timeline',
  name: 'Incident Timeline',
  description: 'Security incident breach timeline with dark red-black canvas, left timeline rail, severity-coded event cards with red-to-amber progression, and CTA footer. Ideal for incident post-mortems and breach briefings.',
  style: 'timeline',
  contentSchema: {
    headline: { required: true, maxWords: 15 },
    subheadline: { required: false, maxWords: 20 },
    callToAction: { required: true, maxWords: 12 },
    blocks: { kind: 'sequence', min: 3, max: 6, fields: ['label', 'text'] },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
