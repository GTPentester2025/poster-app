// v2 template — breach-cost (style: stats). Data breach cost infographic
// with prominent cost figures, category breakdown bars, and trend comparisons.
// Burgundy palette with gold accents on dark canvas.
// Portrait: stacked stats blocks with breakdown bars. Landscape: 2-column grid.

import { textbox, rect, circle, pv, pvRect } from '../helpers.js';
import { makeCanvasV2, canvasDims, gradientWash, svgWrapO, DARK_BASE, DARK_INK } from './decor.js';

// ── palette derivation ────────────────────────────────────────────────────────
function colors(palette) {
  return {
    burgundy: '#7F1D1D',
    darkCanvas: '#1F0B0B',
    charcoal: '#2D1415',
    white: '#F8FAFC',
    gold: palette.primary || '#F59E0B',
    accent: palette.accent || '#DC2626',
    dark: palette.dark || '#1F0B0B',
    bg: palette.background || '#F5E6E6',
    costs: { primary: '#EF4444', secondary: '#F97316', tertiary: '#FBBF24', trend: '#6366F1' }
  };
}

// ── backdrop ──────────────────────────────────────────────────────────────────
function backdrop(o, palette, W, H) {
  const c = colors(palette);
  o.push(rect({ x: 0, y: 0, w: W, h: H, fill: c.darkCanvas }));
  o.push(rect({ x: 0, y: 0, w: W, h: H, fill: c.burgundy, opacity: 0.15 }));
  o.push(...gradientWash({ w: W, h: H, from: c.gold, to: c.burgundy, direction: 'diagonal', intensity: 0.2 }));
}

// ── breakdown bar (horizontal stack of cost categories) ──────────────────────
function breakdownBar(o, palette, categories, x, y, w, h) {
  const c = colors(palette);
  const total = categories.reduce((sum, cat) => sum + cat.pct, 0) || 100;
  const colors_list = [c.costs.primary, c.costs.secondary, c.costs.tertiary];

  let xPos = x;
  categories.forEach((cat, i) => {
    const barW = (w * cat.pct) / total;
    const col = colors_list[i % colors_list.length];
    o.push(rect({ x: xPos, y, w: barW, h, fill: col, opacity: 0.8 }));
    xPos += barW;
  });

  // Border
  o.push(rect({ x, y, w, h, fill: 'none', stroke: c.gold, strokeWidth: 1, opacity: 0.5 }));
}

// ── trend indicator (mini arrow + text) ────────────────────────────────────────
function trendIndicator(o, palette, trend, value, x, y) {
  const c = colors(palette);
  const isUp = trend === 'up';
  const color = isUp ? c.costs.primary : c.costs.tertiary;
  const arrow = isUp ? '▲' : '▼';

  o.push(textbox({
    text: arrow + ' ' + value,
    x,
    y,
    w: 120,
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: '700',
    fill: color
  }));
}

// ── portrait build ────────────────────────────────────────────────────────────
function buildPortrait(content, palette, fonts) {
  const { w: W, h: H } = canvasDims('portrait');
  const c = colors(palette);
  const objects = [];
  backdrop(objects, palette, W, H);

  // Header
  const headerW = W - 100;
  objects.push(textbox({
    text: String(content.headline || 'BREACH COST').toUpperCase(),
    x: 50,
    y: 50,
    w: headerW,
    fontSize: 44,
    fontFamily: fonts.head,
    fontWeight: '900',
    fill: c.gold
  }));

  if (content.subheadline) {
    objects.push(textbox({
      text: String(content.subheadline),
      x: 50,
      y: 110,
      w: headerW,
      fontSize: 18,
      fontFamily: fonts.body,
      fontWeight: '400',
      fill: c.white,
      opacity: 0.75
    }));
  }

  const blocks = Array.isArray(content.blocks) ? content.blocks : [];
  const blockStartY = 170;
  const maxBlockH = Math.floor((H - blockStartY - 100) / Math.max(blocks.length, 1));
  const blockW = headerW;

  // Stats blocks
  blocks.forEach((b, i) => {
    const yBase = blockStartY + i * (maxBlockH + 15);
    const blockH = maxBlockH - 10;

    // Block background
    objects.push(rect({
      x: 50,
      y: yBase,
      w: blockW,
      h: blockH,
      fill: c.charcoal,
      rx: 6,
      ry: 6,
      opacity: 0.7
    }));

    // Left accent bar
    objects.push(rect({
      x: 50,
      y: yBase,
      w: 5,
      h: blockH,
      fill: c.gold,
      rx: 3,
      ry: 3
    }));

    // Label
    if (b.label) {
      objects.push(textbox({
        text: String(b.label).toUpperCase(),
        x: 70,
        y: yBase + 12,
        w: blockW - 40,
        fontSize: 12,
        fontFamily: fonts.head,
        fontWeight: '700',
        fill: c.gold
      }));
    }

    // Figure (big cost number)
    if (b.figure) {
      objects.push(textbox({
        text: String(b.figure),
        x: 70,
        y: yBase + 34,
        w: blockW - 40,
        fontSize: 32,
        fontFamily: fonts.head,
        fontWeight: '900',
        fill: c.white
      }));
    }

    // Text (breakdown or trend)
    if (b.text) {
      objects.push(textbox({
        text: String(b.text),
        x: 70,
        y: yBase + 70,
        w: blockW - 40,
        fontSize: 13,
        fontFamily: fonts.body,
        fontWeight: '400',
        fill: c.white,
        opacity: 0.8
      }));
    }

    // Breakdown bar (if categories provided)
    if (b.breakdown && Array.isArray(b.breakdown)) {
      breakdownBar(objects, palette, b.breakdown, 70, yBase + blockH - 30, blockW - 40, 12);
    }
  });

  // Footer CTA
  if (content.callToAction) {
    objects.push(rect({
      x: 50,
      y: H - 60,
      w: headerW,
      h: 1,
      fill: c.gold,
      opacity: 0.3
    }));
    objects.push(textbox({
      text: String(content.callToAction).toUpperCase(),
      x: 50,
      y: H - 50,
      w: headerW,
      fontSize: 14,
      fontFamily: fonts.head,
      fontWeight: '700',
      fill: c.gold
    }));
  }

  return { version: '6.7.1', width: W, height: H, background: c.darkCanvas, objects };
}

// ── landscape build ───────────────────────────────────────────────────────────
function buildLandscape(content, palette, fonts) {
  const { w: W, h: H } = canvasDims('landscape');
  const c = colors(palette);
  const objects = [];

  // Top accent bar
  objects.push(rect({ x: 0, y: 0, w: W, h: 6, fill: c.gold }));
  objects.push(rect({ x: 0, y: 6, w: W, h: H - 6, fill: c.darkCanvas }));
  objects.push(rect({ x: 0, y: 6, w: W, h: H - 6, fill: c.burgundy, opacity: 0.1 }));

  // Header
  objects.push(textbox({
    text: String(content.headline || 'BREACH COST').toUpperCase(),
    x: 60,
    y: 50,
    w: W - 120,
    fontSize: 48,
    fontFamily: fonts.head,
    fontWeight: '900',
    fill: c.gold
  }));

  if (content.subheadline) {
    objects.push(textbox({
      text: String(content.subheadline),
      x: 60,
      y: 112,
      w: W - 120,
      fontSize: 20,
      fontFamily: fonts.body,
      fontWeight: '400',
      fill: c.white,
      opacity: 0.75
    }));
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

    // Card background
    objects.push(rect({
      x,
      y,
      w: colW,
      h: cardH,
      fill: c.charcoal,
      rx: 6,
      ry: 6,
      opacity: 0.7
    }));

    // Left accent bar
    objects.push(rect({
      x,
      y,
      w: 5,
      h: cardH,
      fill: c.gold,
      rx: 3,
      ry: 3
    }));

    // Label
    if (b.label) {
      objects.push(textbox({
        text: String(b.label).toUpperCase(),
        x: x + 20,
        y: y + 12,
        w: colW - 40,
        fontSize: 11,
        fontFamily: fonts.head,
        fontWeight: '700',
        fill: c.gold
      }));
    }

    // Figure
    if (b.figure) {
      objects.push(textbox({
        text: String(b.figure),
        x: x + 20,
        y: y + 36,
        w: colW - 40,
        fontSize: 28,
        fontFamily: fonts.head,
        fontWeight: '900',
        fill: c.white
      }));
    }

    // Text
    if (b.text) {
      objects.push(textbox({
        text: String(b.text),
        x: x + 20,
        y: y + 68,
        w: colW - 40,
        fontSize: 12,
        fontFamily: fonts.body,
        fontWeight: '400',
        fill: c.white,
        opacity: 0.8
      }));
    }

    // Breakdown bar
    if (b.breakdown && Array.isArray(b.breakdown)) {
      breakdownBar(objects, palette, b.breakdown, x + 20, y + cardH - 30, colW - 40, 10);
    }
  });

  // Footer CTA
  if (content.callToAction) {
    objects.push(rect({
      x: 60,
      y: H - 60,
      w: W - 120,
      h: 1,
      fill: c.gold,
      opacity: 0.3
    }));
    objects.push(textbox({
      text: String(content.callToAction).toUpperCase(),
      x: 60,
      y: H - 50,
      w: W - 120,
      fontSize: 14,
      fontFamily: fonts.head,
      fontWeight: '700',
      fill: c.gold
    }));
  }

  return { version: '6.7.1', width: W, height: H, background: c.darkCanvas, objects };
}

// ── preview SVGs ──────────────────────────────────────────────────────────────
function previewPortrait(palette) {
  const result = buildPortrait({
    headline: 'Data Breach Cost',
    subheadline: 'Financial Impact Analysis 2025',
    blocks: [
      { label: 'INCIDENT RESPONSE', figure: '$2.4M', text: 'Forensics, containment, investigation', breakdown: [{ pct: 40 }, { pct: 35 }, { pct: 25 }] },
      { label: 'RECOVERY & REMEDIATION', figure: '$1.8M', text: 'Systems restoration, infrastructure rebuild', breakdown: [{ pct: 45 }, { pct: 30 }, { pct: 25 }] },
      { label: 'NOTIFICATION & LEGAL', figure: '$920K', text: 'Breach notification, regulatory fines, counsel', breakdown: [{ pct: 30 }, { pct: 50 }, { pct: 20 }] },
      { label: 'LOST BUSINESS & DOWNTIME', figure: '$1.2M', text: 'Revenue loss, operational impact, SLA credits', breakdown: [{ pct: 50 }, { pct: 35 }, { pct: 15 }] }
    ],
    callToAction: 'Total cost: $6.3M | +22% YoY'
  }, palette, { head: 'Montserrat', body: 'Inter' });
  return svgWrapO(result.objects, '#1F0B0B', 'portrait');
}

function previewLandscape(palette) {
  const result = buildLandscape({
    headline: 'Data Breach Cost',
    subheadline: 'Financial Impact Analysis 2025',
    blocks: [
      { label: 'INCIDENT RESPONSE', figure: '$2.4M', text: 'Forensics, containment, investigation +22% YoY', breakdown: [{ pct: 40 }, { pct: 35 }, { pct: 25 }] },
      { label: 'RECOVERY & REMEDIATION', figure: '$1.8M', text: 'Systems restoration, infrastructure rebuild +18% YoY', breakdown: [{ pct: 45 }, { pct: 30 }, { pct: 25 }] },
      { label: 'NOTIFICATION & LEGAL', figure: '$920K', text: 'Breach notification, regulatory fines, counsel +15% YoY', breakdown: [{ pct: 30 }, { pct: 50 }, { pct: 20 }] },
      { label: 'LOST BUSINESS & DOWNTIME', figure: '$1.2M', text: 'Revenue loss, operational impact, SLA credits +25% YoY', breakdown: [{ pct: 50 }, { pct: 35 }, { pct: 15 }] }
    ],
    callToAction: 'Total cost: $6.3M | Industry avg: $4.8M'
  }, palette, { head: 'Montserrat', body: 'Inter' });
  return svgWrapO(result.objects, '#1F0B0B', 'landscape');
}

// ── manifest ──────────────────────────────────────────────────────────────────
export default {
  id: 'breach-cost',
  name: 'Breach Cost',
  description: 'Data breach cost infographic with prominent expense figures, category breakdown bars, and trend comparisons. Burgundy palette with gold accents for security briefs and financial impact reports.',
  style: 'stats',
  contentSchema: {
    headline: { required: true, maxWords: 12 },
    subheadline: { required: false, maxWords: 20 },
    callToAction: { required: true, maxWords: 15 },
    blocks: { kind: 'stats', min: 3, max: 5, fields: ['label', 'figure', 'text'] },
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
