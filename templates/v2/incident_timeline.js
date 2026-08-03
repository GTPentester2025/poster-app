// v2 template — incident_timeline (style: timeline). Security incident breach
// timeline with dark red-black canvas, left timeline rail, severity-coded event
// cards with red-to-amber color progression, and CTA footer.
// Portrait: timeline rail on left, event cards stacked right.
// Landscape: horizontal timeline across top, cards below in 2-column grid.

import { textbox, rect, circle, pv, pvRect } from '../helpers.js';
import { makeCanvasV2, canvasDims, gradientWash, svgWrapO, DARK_BASE, DARK_INK } from './decor.js';

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
  o.push(rect({ x: 0, y: 0, w: W, h: H, fill: c.darkRedBlack }));
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
  // Dark red-black base with thin top accent bar
  objects.push(rect({ x: 0, y: 0, w: W, h: 6, fill: c.red }));
  objects.push(rect({ x: 0, y: 0, w: W, h: H, fill: c.darkRedBlack }));
  objects.push(rect({ x: 0, y: 0, w: W, h: H, fill: c.charcoal, opacity: 0.1 }));

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

// ── preview SVGs ──────────────────────────────────────────────────────────────
const SAMPLE_BLOCKS_A = [{ label: 'INITIAL ACCESS', text: 'Phishing email 09:15 UTC' }, { label: 'LATERAL MOVEMENT', text: 'Credentials compromised 10:42 UTC' }, { label: 'DATA EXFILTRATION', text: '2.1M records accessed 12:05 UTC' }, { label: 'DETECTION', text: 'Anomaly alert triggered 14:33 UTC' }];
const SAMPLE_BLOCKS_B = [{ label: 'INITIAL ACCESS', text: 'Phishing email 09:15 UTC' }, { label: 'LATERAL MOVEMENT', text: 'Credentials compromised 10:42 UTC' }, { label: 'DATA EXFILTRATION', text: '2.1M records accessed 12:05 UTC' }, { label: 'DETECTION', text: 'Anomaly alert triggered 14:33 UTC' }, { label: 'CONTAINMENT', text: 'Systems isolated 15:20 UTC' }, { label: 'RECOVERY', text: 'Services restored 18:45 UTC' }];

function previewPortrait(palette) {
  const result = buildPortrait({ headline: 'Breach Timeline', subheadline: 'Q3 2026 Security Incident', blocks: SAMPLE_BLOCKS_A, callToAction: 'Full incident report → security@company.com' }, palette, { head: 'Montserrat', body: 'Inter' });
  return svgWrapO(result.objects, '#1A0A0A', 'portrait');
}

function previewLandscape(palette) {
  const result = buildLandscape({ headline: 'Breach Timeline', subheadline: 'Q3 2026 Security Incident', blocks: SAMPLE_BLOCKS_B, callToAction: 'Full incident report → security@company.com' }, palette, { head: 'Montserrat', body: 'Inter' });
  return svgWrapO(result.objects, '#1A0A0A', 'landscape');
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
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
