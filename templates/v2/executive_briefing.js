// v2 template — executive-briefing (style: timeline). C-suite security briefing
// with a left timeline rail, severity-color-coded event cards, and an executive
// summary header. Corporate navy palette with gold accents.
// Portrait: timeline rail on left, event cards stacked right.
// Landscape: horizontal timeline across top, cards below in 2-column grid.

import { textbox, rect, circle, pv, pvRect } from '../helpers.js';
import { makeCanvasV2, canvasDims, gradientWash, svgWrapO, DARK_BASE, DARK_INK } from './decor.js';

// ── palette derivation ────────────────────────────────────────────────────────
function colors(palette) {
  return {
    navy: '#1B2A4A',
    slate: '#334155',
    charcoal: '#1E293B',
    white: '#F8FAFC',
    gold: palette.primary || '#E3AF32',
    accent: palette.accent || '#C8102E',
    dark: palette.dark || '#1F1A17',
    bg: palette.background || '#F5F0E8',
    severity: { green: '#10B981', amber: '#F59E0B', red: '#EF4444', dark: '#6B21A8' }
  };
}

// ── backdrop ──────────────────────────────────────────────────────────────────
function backdrop(o, palette, W, H) {
  const c = colors(palette);
  o.push(rect({ x: 0, y: 0, w: W, h: H, fill: c.navy }));
  o.push(rect({ x: 0, y: 0, w: 80, h: H, fill: c.charcoal, opacity: 0.3 }));
  o.push(...gradientWash({ w: W, h: H, from: c.gold, to: c.navy, direction: 'diagonal', intensity: 0.25 }));
}

// ── timeline rail ─────────────────────────────────────────────────────────────
function rail(o, palette, W, H) {
  const c = colors(palette);
  o.push(rect({ x: 78, y: 0, w: 4, h: H, fill: c.gold, opacity: 0.5 }));
}

// ── severity dot ──────────────────────────────────────────────────────────────
function severityDot(o, palette, severity, x, y) {
  const c = colors(palette);
  const sev = c.severity[severity] || c.severity.green;
  o.push(circle({ cx: x, cy: y, r: 10, fill: sev }));
  o.push(circle({ cx: x, cy: y, r: 6, fill: sev, opacity: 0.4 }));
}

const SEVERITY_INDEX = ['green', 'amber', 'red', 'dark'];

// ── portrait build ────────────────────────────────────────────────────────────
function buildPortrait(content, palette, fonts) {
  const { w: W, h: H } = canvasDims('portrait');
  const c = colors(palette);
  const objects = [];
  backdrop(objects, palette, W, H);
  rail(objects, palette, W, H);

  // Executive header
  const headerW = W - 140;
  objects.push(textbox({ text: String(content.headline || 'ExecutiveBriefing').toUpperCase(), x: 120, y: 60, w: headerW, fontSize: 44, fontFamily: fonts.head, fontWeight: '900', fill: c.gold }));

  if (content.subheadline) {
    objects.push(textbox({ text: String(content.subheadline), x: 120, y: 120, w: headerW, fontSize: 22, fontFamily: fonts.body, fontWeight: '400', fill: c.white, opacity: 0.7 }));
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
    objects.push(rect({ x: cardX, y: yBase, w: cardW, h: blockH, fill: c.charcoal, rx: 8, ry: 8, opacity: 0.6 }));

    // Severity bar on card left
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
      objects.push(textbox({ text: String(b.text), x: cardX + 20, y: yBase + 70, w: cardW - 40, fontSize: 15, fontFamily: fonts.body, fontWeight: '400', fill: c.white, opacity: 0.85 }));
    }
  });

  // Footer CTA
  if (content.callToAction) {
    objects.push(rect({ x: 120, y: H - 90, w: headerW, h: 2, fill: c.gold, opacity: 0.4 }));
    objects.push(textbox({ text: String(content.callToAction).toUpperCase(), x: 120, y: H - 75, w: headerW, fontSize: 16, fontFamily: fonts.head, fontWeight: '700', fill: c.gold }));
  }

  return { version: '6.7.1', width: W, height: H, background: c.navy, objects };
}

// ── landscape build ───────────────────────────────────────────────────────────
function buildLandscape(content, palette, fonts) {
  const { w: W, h: H } = canvasDims('landscape');
  const c = colors(palette);
  const objects = [];
  // thin top accent bar instead of left rail
  objects.push(rect({ x: 0, y: 0, w: W, h: 6, fill: c.gold }));
  objects.push(rect({ x: 0, y: 0, w: W, h: H, fill: c.navy }));

  // Header — full width
  objects.push(textbox({ text: String(content.headline || 'ExecutiveBriefing').toUpperCase(), x: 60, y: 50, w: W - 120, fontSize: 48, fontFamily: fonts.head, fontWeight: '900', fill: c.gold }));

  if (content.subheadline) {
    objects.push(textbox({ text: String(content.subheadline), x: 60, y: 112, w: W - 120, fontSize: 22, fontFamily: fonts.body, fontWeight: '400', fill: c.white, opacity: 0.7 }));
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

    objects.push(rect({ x, y, w: colW, h: cardH, fill: c.charcoal, rx: 6, ry: 6, opacity: 0.6 }));
    objects.push(rect({ x, y, w: 6, h: cardH, fill: c.severity[sevColor], rx: 3, ry: 3 }));

    if (b.label) {
      objects.push(textbox({ text: String(b.label).toUpperCase(), x: x + 20, y: y + 12, w: colW - 40, fontSize: 13, fontFamily: fonts.head, fontWeight: '700', fill: c.severity[sevColor] }));
    }
    if (b.text) {
      objects.push(textbox({ text: String(b.text), x: x + 20, y: y + 36, w: colW - 40, fontSize: 14, fontFamily: fonts.body, fontWeight: '400', fill: c.white, opacity: 0.85 }));
    }
  });

  if (content.callToAction) {
    objects.push(rect({ x: 60, y: H - 60, w: W - 120, h: 1, fill: c.gold, opacity: 0.3 }));
    objects.push(textbox({ text: String(content.callToAction).toUpperCase(), x: 60, y: H - 50, w: W - 120, fontSize: 15, fontFamily: fonts.head, fontWeight: '700', fill: c.gold }));
  }

  return { version: '6.7.1', width: W, height: H, background: c.navy, objects };
}

// ── preview SVGs ──────────────────────────────────────────────────────────────
function previewPortrait(palette) {
  const result = buildPortrait({ headline: 'Q3 Security', subheadline: 'Executive Briefing', blocks: [{ label: 'PHISHING', text: '32% reduction in click rates' }, { label: 'MFA', text: '94% adoption across org' }, { label: 'INCIDENTS', text: 'Zero critical breaches Q3' }], callToAction: 'Full report → security@company.com' }, palette, { head: 'Montserrat', body: 'Inter' });
  return svgWrapO(result.objects, '#1B2A4A', 'portrait');
}

function previewLandscape(palette) {
  const result = buildLandscape({ headline: 'Q3 Security', subheadline: 'Executive Briefing', blocks: [{ label: 'PHISHING', text: 'Click rates down 32%' }, { label: 'MFA', text: '94% org adoption' }, { label: 'INCIDENTS', text: 'Zero critical breaches' }, { label: 'TRAINING', text: '98% completion rate' }], callToAction: 'Full report → security@company.com' }, palette, { head: 'Montserrat', body: 'Inter' });
  return svgWrapO(result.objects, '#1B2A4A', 'landscape');
}

// ── manifest ──────────────────────────────────────────────────────────────────
export default {
  id: 'executive-briefing',
  name: 'Executive Briefing',
  description: 'C-suite security briefing with timeline rail, severity-coded cards, and corporate navy palette. Ideal for board updates and executive summaries.',
  style: 'timeline',
  contentSchema: {
    headline: { required: true, maxWords: 15 },
    subheadline: { required: false, maxWords: 20 },
    callToAction: { required: true, maxWords: 12 },
    blocks: { kind: 'sequence', min: 2, max: 6, fields: ['label', 'text'] },
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};