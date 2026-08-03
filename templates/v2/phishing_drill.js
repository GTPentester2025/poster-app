// v2 template — phishing-drill (style: stats). Phishing simulation results dashboard:
// 3-5 big stat cards (click rate, report rate, repeat offenders, etc.) with colored
// progress bars and metrics. Dark slate canvas. Portrait: title top, stat cards stacked;
// Landscape: title left, stat cards in a row. gradientWash backdrop, no image slots.

import {
  textbox, rect,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash,
  legibilityScrim, svgWrapO, PV_LAND_W
} from './decor.js';

const SLATE = '#2C3E50';
const SLATE_LIGHT = '#34495E';
const COLORS = ['#E74C3C', '#F39C12', '#27AE60', '#3498DB', '#9B59B6'];
const PAPER = '#ECF0F1';

function statCard(o, block, palette, fonts, { x, y, w, h, colorIdx }) {
  const cardColor = COLORS[colorIdx % COLORS.length];
  const isLight = palette.dark === '#FFFFFF';

  o.push(rect({ x, y, w, h, fill: SLATE_LIGHT, rx: 16, layerRole: 'background', msgId: block.id }));

  // top accent bar
  o.push(rect({ x, y, w, h: 8, fill: cardColor, rx: 16, layerRole: 'decor' }));

  if (block) {
    // label (top)
    const labelStr = String(block.label || '').toUpperCase();
    const lblSize = fitFontSize(labelStr, { width: w - 40, height: 48, maxSize: 24, minSize: 14 });
    o.push({
      ...textbox({
        text: labelStr,
        x: x + 20,
        y: y + 20,
        w: w - 40,
        fontSize: lblSize,
        fontFamily: fonts.head,
        fontWeight: '700',
        fill: PAPER,
        align: 'left',
        lineHeight: 1.1,
        layerRole: 'message',
        msgId: block.id,
        bgRef: SLATE_LIGHT
      }),
      fieldRef: 'label'
    });

    // figure (big number, center-ish)
    const figStr = String(block.figure || '—');
    const figSize = fitFontSize(figStr, { width: w - 40, height: 80, maxSize: 72, minSize: 48 });
    o.push({
      ...textbox({
        text: figStr,
        x: x + 20,
        y: y + 60,
        w: w - 40,
        fontSize: figSize,
        fontFamily: fonts.head,
        fontWeight: '900',
        fill: cardColor,
        align: 'left',
        lineHeight: 1,
        layerRole: 'message',
        msgId: block.id,
        bgRef: SLATE_LIGHT
      }),
      fieldRef: 'figure'
    });

    // progress bar (thin horizontal bar below figure)
    const barW = w - 40;
    const barY = y + 160;
    const barH = 6;
    const progressVal = parseInt(block.figure) || 0;
    const progress = Math.min(Math.max(progressVal / 100, 0), 1);

    o.push(rect({
      x: x + 20,
      y: barY,
      w: barW,
      h: barH,
      fill: 'rgba(255,255,255,0.15)',
      rx: 3,
      layerRole: 'decor'
    }));
    o.push(rect({
      x: x + 20,
      y: barY,
      w: barW * progress,
      h: barH,
      fill: cardColor,
      rx: 3,
      layerRole: 'decor'
    }));

    // text (bottom description)
    const textH = h - 185;
    const tSize = fitFontSize(block.text, { width: w - 40, height: textH, maxSize: 16, minSize: 12 });
    o.push({
      ...textbox({
        text: block.text,
        x: x + 20,
        y: barY + 14,
        w: w - 40,
        fontSize: tSize,
        fontFamily: fonts.body,
        fontWeight: '500',
        fill: 'rgba(236,240,241,0.85)',
        lineHeight: 1.35,
        layerRole: 'message',
        msgId: block.id,
        bgRef: SLATE_LIGHT
      }),
      fieldRef: 'text'
    });
  }
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 200, maxSize, minSize: 48 });
  o.push(textbox({
    text: content.headline,
    x,
    y,
    w,
    fontSize: headSize,
    fontFamily: fonts.head,
    fontWeight: '900',
    fill: PAPER,
    lineHeight: 1.06,
    layerRole: 'headline',
    bgRef: SLATE
  }));
  let cursor = y + estTextHeight(content.headline, headSize, w, 1.06) + 18;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 80, maxSize: 32, minSize: 18, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline,
      x,
      y: cursor,
      w,
      fontSize: subSize,
      fontFamily: fonts.body,
      fontWeight: '500',
      fill: 'rgba(236,240,241,0.75)',
      lineHeight: 1.35,
      opacity: 0.8,
      layerRole: 'subheadline',
      bgRef: SLATE
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.35) + 12;
  }
  return cursor;
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', SLATE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(...gradientWash({ w: W, h: H, from: SLATE, to: SLATE_LIGHT, direction: 'vertical', intensity: 0.5 }));
  o.push(...legibilityScrim({ w: W, h: H, strength: 0.3 }));

  const hCursor = headlineZone(o, content, palette, fonts, { x: 80, y: 96, w: W - 160, maxSize: 80 });

  const blocks = content.blocks || [];
  const numCards = Math.min(Math.max(blocks.length, 3), 5);
  const cardW = W - 160;
  const cardH = 280;
  const cardGap = 28;
  const totalH = numCards * cardH + (numCards - 1) * cardGap;
  const startY = Math.max(380, hCursor + 40);

  for (let i = 0; i < numCards; i++) {
    const b = blocks[i % blocks.length];
    const cy = startY + i * (cardH + cardGap);
    statCard(o, b, palette, fonts, { x: 80, y: cy, w: cardW, h: cardH, colorIdx: i });
  }

  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', SLATE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(...gradientWash({ w: W, h: H, from: SLATE, to: SLATE_LIGHT, direction: 'horizontal', intensity: 0.5 }));
  o.push(...legibilityScrim({ w: W, h: H, strength: 0.3 }));

  const leftW = 520;
  headlineZone(o, content, palette, fonts, { x: 80, y: 100, w: leftW, maxSize: 68 });

  const blocks = content.blocks || [];
  const numCards = Math.min(Math.max(blocks.length, 3), 5);
  const cardW = (W - leftW - 140) / numCards - 16;
  const cardH = 400;
  const cardGap = 20;
  const startX = leftW + 80;
  const startY = 80;

  for (let i = 0; i < numCards; i++) {
    const b = blocks[i % blocks.length];
    const cx = startX + i * (cardW + cardGap);
    statCard(o, b, palette, fonts, { x: cx, y: startY, w: cardW, h: cardH, colorIdx: i });
  }

  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvBars({ x: pv(80), y: pv(110), w: pv(1000), lines: 2, barH: 8, gap: 5, fill: PAPER })
  ];

  const cardW = 1000;
  const cardH = 280;
  const gap = 28;

  for (let i = 0; i < 3; i++) {
    const cy = 380 + i * (cardH + gap);
    const color = COLORS[i];

    parts.push(pvRect(pv(80), pv(cy), pv(cardW), pv(cardH), SLATE_LIGHT, { rx: 4 }));
    parts.push(pvRect(pv(80), pv(cy), pv(cardW), pv(8), color, { rx: 4 }));
    parts.push(pvBars({ x: pv(100), y: pv(cy + 30), w: pv(cardW - 40), lines: 1, barH: 6, gap: 0, fill: PAPER }));
    parts.push(pvRect(pv(100), pv(cy + 50), pv((cardW - 40) * 0.65), 4, color, { rx: 2 }));
    parts.push(pvBars({ x: pv(100), y: pv(cy + 70), w: pv(cardW - 40), lines: 2, barH: 3, gap: 2, fill: 'rgba(236,240,241,0.6)' }));
  }

  return svgWrapO(parts, SLATE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvBars({ x: pv(80), y: pv(110), w: pv(440), lines: 2, barH: 8, gap: 5, fill: PAPER })
  ];

  const cardW = 220;
  const cardH = 400;
  const gap = 20;
  const startX = 600;

  for (let i = 0; i < 3; i++) {
    const cx = startX + i * (cardW + gap);
    const color = COLORS[i];

    parts.push(pvRect(pv(cx), pv(80), pv(cardW), pv(cardH), SLATE_LIGHT, { rx: 4 }));
    parts.push(pvRect(pv(cx), pv(80), pv(cardW), pv(8), color, { rx: 4 }));
    parts.push(pvBars({ x: pv(cx + 15), y: pv(110), w: pv(cardW - 30), lines: 1, barH: 5, gap: 0, fill: PAPER }));
    parts.push(pvRect(pv(cx + 15), pv(130), pv((cardW - 30) * 0.6), 3, color, { rx: 1.5 }));
    parts.push(pvBars({ x: pv(cx + 15), y: pv(150), w: pv(cardW - 30), lines: 2, barH: 2, gap: 1.5, fill: 'rgba(236,240,241,0.5)' }));
  }

  parts.push(pvRect(0, pv(80), pv(520), pv(360), SLATE, { rx: 2 }));

  return svgWrapO(parts, SLATE, 'landscape');
}

export default {
  id: 'phishing-drill',
  name: 'Phishing drill',
  style: 'stats',
  description: 'Phishing simulation results dashboard with 3-5 stat cards showing metrics (click rate, report rate, repeat offenders, etc.). Dark slate background with colored accent bars and progress indicators. Portrait stacks cards vertically; landscape arranges in a row with title on left.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 12 },
    callToAction: { required: true, maxWords: 12 },
    blocks: { kind: 'stats', min: 3, max: 5, fields: ['label', 'figure', 'text'] },
    backgroundSlots: 0,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
