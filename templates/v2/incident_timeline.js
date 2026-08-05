// v2 template — incident_timeline (style: timeline). Security incident breach
// timeline with dark red-black canvas, severity color progression (red→amber),
// bg slot + scrim, and a CTA footer.
// Portrait: a REAL timeline — left vertical rail at x=150 with severity-colored
// node circles ON the rail, event cards to the RIGHT of the rail (cards start
// x=260) connected by short horizontal ticks; small time labels (block label)
// sit above each card.
// Landscape: horizontal rail across the upper third with nodes; one event-card
// column per block hangs below the rail, connected by short vertical ticks.

import { textbox, rect, circle, backgroundImageSlot, fitTextBlock, pv, pvRect, pvCircle, pvBars } from '../helpers.js';
import { canvasDims, gradientWash, legibilityScrim, svgWrapO, PV_LAND_W } from './decor.js';

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

// ── severity node (ON the rail) ───────────────────────────────────────────────
function severityDot(o, palette, severity, x, y) {
  const c = colors(palette);
  const sev = c.severity[severity] || c.severity.amber;
  o.push(circle({ x, y, r: 20, fill: sev, opacity: 0.25 }));
  o.push(circle({ x, y, r: 11, fill: sev }));
}

const SEVERITY_INDEX = ['red', 'orange', 'amber', 'yellow'];

// ── CTA footer (thin rule + uppercase line) ───────────────────────────────────
function ctaFooter(objects, content, palette, fonts, { x, w, lineY, textY }) {
  if (!content.callToAction) return;
  const c = colors(palette);
  const text = String(content.callToAction).toUpperCase();
  const { fontSize } = fitTextBlock(text, { width: w, height: 52, maxSize: 24, minSize: 12, lineHeight: 1.16 });
  objects.push(rect({ x, y: lineY, w, h: 2, fill: c.red, opacity: 0.4 }));
  objects.push(textbox({
    text, x, y: textY, w, fontSize, fontFamily: fonts.head, fontWeight: '700',
    fill: c.red, layerRole: 'cta', bgRef: c.darkRedBlack
  }));
}

// ── portrait build ────────────────────────────────────────────────────────────
const RAIL_X = 150;   // vertical rail center
const CARD_X = 260;   // event cards start right of the rail

function buildPortrait(content, palette, fonts) {
  const { w: W, h: H } = canvasDims('portrait');
  const c = colors(palette);
  const objects = [];
  backdrop(objects, palette, W, H);

  const headX = 90;
  const headW = W - headX - 90;

  // Incident header
  const headline = String(content.headline || 'INCIDENT TIMELINE').toUpperCase();
  const { fontSize: headSize, height: headH } = fitTextBlock(headline, {
    width: headW, height: 170, maxSize: 84, minSize: 40, lineHeight: 1.05
  });
  objects.push(textbox({
    text: headline, x: headX, y: 64, w: headW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: c.red, lineHeight: 1.05,
    layerRole: 'headline', bgRef: c.darkRedBlack
  }));
  let cursor = 64 + headH + 14;

  if (content.subheadline) {
    const sub = String(content.subheadline);
    const { fontSize: subSize, height: subH } = fitTextBlock(sub, {
      width: headW, height: 84, maxSize: 30, minSize: 18, lineHeight: 1.25
    });
    objects.push(textbox({
      text: sub, x: headX, y: cursor, w: headW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '400', fill: c.lightGray, lineHeight: 1.25,
      layerRole: 'subheadline', bgRef: c.darkRedBlack
    }));
    cursor += subH + 14;
  }

  const blocks = Array.isArray(content.blocks) ? content.blocks : [];
  const n = Math.max(blocks.length, 1);
  const zoneTop = cursor + 24;
  const zoneBottom = H - 130;

  // left vertical timeline rail
  objects.push(rect({ x: RAIL_X - 3, y: zoneTop - 10, w: 6, h: zoneBottom - zoneTop + 10, fill: c.red, opacity: 0.6 }));

  const gap = 18;
  const LABEL_ZONE = 34;
  const slotH = Math.floor((zoneBottom - zoneTop - gap * (n - 1)) / n);
  const cardW = W - CARD_X - 90;
  const textW = cardW - 56;

  blocks.forEach((b, i) => {
    const slotY = zoneTop + i * (slotH + gap);
    const cardY = slotY + LABEL_ZONE;
    const cardH = slotH - LABEL_ZONE;
    const sevColor = SEVERITY_INDEX[i % SEVERITY_INDEX.length];
    const nodeY = cardY + Math.min(50, Math.round(cardH / 2));

    // node ON the rail + short horizontal tick out to the card
    severityDot(objects, palette, sevColor, RAIL_X, nodeY);
    objects.push(rect({ x: RAIL_X + 14, y: nodeY - 2, w: CARD_X - RAIL_X - 14, h: 4, fill: c.severity[sevColor], opacity: 0.8 }));

    // event card (right of the rail)
    objects.push(rect({ x: CARD_X, y: cardY, w: cardW, h: cardH, fill: c.charcoal, rx: 8, opacity: 0.5, layerRole: 'background', msgId: b.id }));
    objects.push(rect({ x: CARD_X, y: cardY, w: 6, h: cardH, fill: c.severity[sevColor], rx: 3 }));

    // small time label above the card
    if (b.label) {
      const label = String(b.label).toUpperCase();
      const { fontSize: lSize } = fitTextBlock(label, {
        width: cardW, height: LABEL_ZONE - 8, maxSize: 20, minSize: 12, lineHeight: 1.15
      });
      objects.push({
        ...textbox({
          text: label, x: CARD_X, y: slotY + 2, w: cardW, fontSize: lSize,
          fontFamily: fonts.head, fontWeight: '700', fill: c.severity[sevColor],
          lineHeight: 1.15, layerRole: 'message-label', msgId: b.id, bgRef: c.darkRedBlack
        }),
        fieldRef: 'label'
      });
    }

    // event body text inside the card
    if (b.text) {
      const body = String(b.text);
      const { fontSize: tSize } = fitTextBlock(body, {
        width: textW, height: Math.max(40, cardH - 44), maxSize: 30, minSize: 16, lineHeight: 1.3
      });
      objects.push({
        ...textbox({
          text: body, x: CARD_X + 28, y: cardY + 24, w: textW, fontSize: tSize,
          fontFamily: fonts.body, fontWeight: '400', fill: c.lightGray, lineHeight: 1.3,
          layerRole: 'message', msgId: b.id, bgRef: c.charcoal
        }),
        fieldRef: 'text'
      });
    }
  });

  // Footer CTA
  ctaFooter(objects, content, palette, fonts, { x: headX, w: headW, lineY: H - 104, textY: H - 88 });

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

  const PADL = 80;
  const zoneW = W - PADL * 2;

  // Header
  const headline = String(content.headline || 'INCIDENT TIMELINE').toUpperCase();
  const { fontSize: headSize, height: headH } = fitTextBlock(headline, {
    width: zoneW, height: 140, maxSize: 64, minSize: 36, lineHeight: 1.05
  });
  objects.push(textbox({
    text: headline, x: PADL, y: 48, w: zoneW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: c.red, lineHeight: 1.05,
    layerRole: 'headline', bgRef: c.darkRedBlack
  }));
  let cursor = 48 + headH + 10;

  if (content.subheadline) {
    const sub = String(content.subheadline);
    const { fontSize: subSize, height: subH } = fitTextBlock(sub, {
      width: zoneW, height: 64, maxSize: 26, minSize: 16, lineHeight: 1.25
    });
    objects.push(textbox({
      text: sub, x: PADL, y: cursor, w: zoneW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '400', fill: c.lightGray, lineHeight: 1.25,
      layerRole: 'subheadline', bgRef: c.darkRedBlack
    }));
    cursor += subH + 10;
  }

  // horizontal timeline rail across the upper third
  const railY = Math.max(cursor + 46, 320);
  objects.push(rect({ x: PADL, y: railY - 3, w: zoneW, h: 6, fill: c.red, opacity: 0.6 }));

  const blocks = Array.isArray(content.blocks) ? content.blocks : [];
  const n = Math.max(blocks.length, 1);
  const colGap = 24;
  const colW = Math.floor((zoneW - colGap * (n - 1)) / n);
  const labelY = railY + 34;
  const LABEL_ZONE_L = 52;
  const cardY = labelY + LABEL_ZONE_L;
  const cardH = (H - 96) - cardY - 8;

  blocks.forEach((b, i) => {
    const colX = PADL + i * (colW + colGap);
    const center = colX + Math.round(colW / 2);
    const sevColor = SEVERITY_INDEX[i % SEVERITY_INDEX.length];

    // node ON the rail + short vertical tick down toward the card
    severityDot(objects, palette, sevColor, center, railY);
    objects.push(rect({ x: center - 2, y: railY + 14, w: 4, h: 16, fill: c.severity[sevColor], opacity: 0.8 }));

    // time label between rail and card
    if (b.label) {
      const label = String(b.label).toUpperCase();
      const { fontSize: lSize } = fitTextBlock(label, {
        width: colW, height: LABEL_ZONE_L - 8, maxSize: 18, minSize: 12, lineHeight: 1.15
      });
      objects.push({
        ...textbox({
          text: label, x: colX, y: labelY, w: colW, fontSize: lSize,
          fontFamily: fonts.head, fontWeight: '700', fill: c.severity[sevColor],
          lineHeight: 1.15, layerRole: 'message-label', msgId: b.id, bgRef: c.darkRedBlack
        }),
        fieldRef: 'label'
      });
    }

    // hanging event card — one column per block
    objects.push(rect({ x: colX, y: cardY, w: colW, h: cardH, fill: c.charcoal, rx: 6, opacity: 0.5, layerRole: 'background', msgId: b.id }));
    objects.push(rect({ x: colX, y: cardY, w: colW, h: 6, fill: c.severity[sevColor], rx: 3 }));

    if (b.text) {
      const body = String(b.text);
      const { fontSize: tSize } = fitTextBlock(body, {
        width: colW - 40, height: Math.max(40, cardH - 46), maxSize: 26, minSize: 14, lineHeight: 1.3
      });
      objects.push({
        ...textbox({
          text: body, x: colX + 20, y: cardY + 26, w: colW - 40, fontSize: tSize,
          fontFamily: fonts.body, fontWeight: '400', fill: c.lightGray, lineHeight: 1.3,
          layerRole: 'message', msgId: b.id, bgRef: c.charcoal
        }),
        fieldRef: 'text'
      });
    }
  });

  // Footer CTA
  ctaFooter(objects, content, palette, fonts, { x: PADL, w: zoneW, lineY: H - 78, textY: H - 64 });

  return { version: '6.7.1', width: W, height: H, background: c.darkRedBlack, objects };
}

// ── preview SVGs (pv-scaled geometry with bars standing in for text) ──────────
const SEV_HEX = ['#DC2626', '#EA580C', '#F59E0B', '#FBBF24'];

function previewPortrait(palette) {
  const c = colors(palette);
  const parts = [
    // header
    pvBars({ x: pv(90), y: pv(64), w: pv(1000), lines: 1, barH: 9, gap: 0, fill: c.red }),
    pvBars({ x: pv(90), y: pv(160), w: pv(700), lines: 1, barH: 4, gap: 0, fill: c.lightGray }),
    // left vertical rail
    pvRect(pv(RAIL_X - 3), pv(230), 1, pv(1640), c.red, { opacity: 0.6 })
  ];
  for (let i = 0; i < 4; i++) {
    const slotY = 241 + i * 411;
    const cardY = slotY + 34;
    const cardH = 360;
    const sev = SEV_HEX[i % SEV_HEX.length];
    // node on the rail + horizontal tick to the card
    parts.push(pvCircle(pv(RAIL_X), pv(cardY + 50), 1.8, sev));
    parts.push(pvRect(pv(RAIL_X + 14), pv(cardY + 48), pv(CARD_X - RAIL_X - 14), 0.6, sev));
    // time label above the card
    parts.push(pvBars({ x: pv(CARD_X), y: pv(slotY + 2), w: pv(320), lines: 1, barH: 2.5, gap: 0, fill: sev }));
    // event card right of the rail
    parts.push(pvRect(pv(CARD_X), pv(cardY), pv(1064), pv(cardH), c.charcoal, { rx: 1.5, opacity: 0.5 }));
    parts.push(pvRect(pv(CARD_X), pv(cardY), 1, pv(cardH), sev));
    parts.push(pvBars({ x: pv(CARD_X + 28), y: pv(cardY + 24), w: pv(1008), lines: 2, barH: 3, gap: 2, fill: c.lightGray }));
  }
  parts.push(pvRect(pv(90), pv(1896), pv(1234), 0.5, c.red, { opacity: 0.4 }));
  parts.push(pvBars({ x: pv(90), y: pv(1912), w: pv(700), lines: 1, barH: 3, gap: 0, fill: c.red }));
  return svgWrapO(parts, c.darkRedBlack, 'portrait');
}

function previewLandscape(palette) {
  const c = colors(palette);
  const railY = 320;
  const parts = [
    pvRect(0, 0, PV_LAND_W, 1, c.red),
    pvBars({ x: pv(80), y: pv(48), w: pv(1000), lines: 1, barH: 8, gap: 0, fill: c.red }),
    pvBars({ x: pv(80), y: pv(150), w: pv(700), lines: 1, barH: 4, gap: 0, fill: c.lightGray }),
    // horizontal rail across the upper third
    pvRect(pv(80), pv(railY - 3), pv(1840), 0.8, c.red, { opacity: 0.6 })
  ];
  const n = 4;
  const colGap = 24;
  const colW = Math.floor((1840 - colGap * (n - 1)) / n);
  const cardY = railY + 86;
  const cardH = 1414 - 96 - cardY - 8;
  for (let i = 0; i < n; i++) {
    const colX = 80 + i * (colW + colGap);
    const center = colX + Math.round(colW / 2);
    const sev = SEV_HEX[i % SEV_HEX.length];
    parts.push(pvCircle(pv(center), pv(railY), 1.6, sev));
    parts.push(pvRect(pv(center - 2), pv(railY + 14), 0.6, pv(16), sev));
    parts.push(pvBars({ x: pv(colX), y: pv(railY + 34), w: pv(colW - 60), lines: 1, barH: 2.5, gap: 0, fill: sev }));
    parts.push(pvRect(pv(colX), pv(cardY), pv(colW), pv(cardH), c.charcoal, { rx: 1, opacity: 0.5 }));
    parts.push(pvRect(pv(colX), pv(cardY), pv(colW), 0.8, sev));
    parts.push(pvBars({ x: pv(colX + 20), y: pv(cardY + 26), w: pv(colW - 40), lines: 4, barH: 2.5, gap: 2, fill: c.lightGray }));
  }
  parts.push(pvRect(pv(80), pv(1336), pv(1840), 0.5, c.red, { opacity: 0.3 }));
  parts.push(pvBars({ x: pv(80), y: pv(1350), w: pv(600), lines: 1, barH: 3, gap: 0, fill: c.red }));
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
