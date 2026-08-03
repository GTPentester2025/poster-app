// v2 template — mfa-journey (style: timeline). Multi-milestone adoption timeline
// with sequential nodes showing MFA rollout phases, adoption percentages, and
// milestone checkmarks. Teal accent (#0D9488) on slate canvas backdrop with
// gradientWash. Portrait: vertical timeline descending. Landscape: horizontal
// timeline left-to-right. 3–5 blocks {label, text}.

import {
  textbox, rect,
  backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars, pvCircle
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, dotGrid,
  legibilityScrim, svgWrapO, PV_LAND_W
} from './decor.js';

const SLATE_BG = '#1E293B';     // dark canvas ground
const SLATE_LIGHT = '#E2E8F0'; // light text
const TEAL = '#0D9488';        // primary milestone accent
const TEAL_DARK = '#0F766E';   // darker teal for depth
const TEAL_LIGHT = '#14B8A6';  // lighter teal highlight
const CHECKMARK = '#FFFFFF';   // checkmark fill

function headerBand(o, content, palette, fonts, { W, top, bandH, x, w, maxSize, align }) {
  o.push(rect({ x: 0, y: top, w: W, h: bandH, fill: SLATE_BG, layerRole: 'background' }));
  o.push(rect({ x: 0, y: top + bandH - 4, w: W, h: 4, fill: palette.primary, opacity: 1, layerRole: 'decor' }));

  o.push(textbox({
    text: 'MFA ADOPTION JOURNEY', x, y: top + 36, w,
    fontSize: 20, fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
    align, charSpacing: 180, lineHeight: 1, layerRole: 'message-label', bgRef: SLATE_BG
  }));
  let cursor = top + 72;
  const headSize = fitFontSize(content.headline, { width: w, height: 160, maxSize, minSize: 36 });
  o.push(textbox({
    text: content.headline, x, y: cursor, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: SLATE_LIGHT,
    align, lineHeight: 1.06, layerRole: 'headline', bgRef: SLATE_BG
  }));
  cursor += estTextHeight(content.headline, headSize, w, 1.06) + 8;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 60, maxSize: 28, minSize: 16, lineHeight: 1.3 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: '#94A3B8',
      align, lineHeight: 1.3, layerRole: 'subheadline', bgRef: SLATE_BG
    }));
  }
  return top + bandH;
}

// Milestone node: circle with checkmark, label, adoption %, and text.
function milestoneNode(o, b, i, fonts, { cx, cy, r, isVertical }) {
  const nodeR = Math.round(r * 0.8);
  // outer circle (teal)
  o.push(rect({
    x: cx - nodeR, y: cy - nodeR, w: nodeR * 2, h: nodeR * 2,
    fill: i === 0 ? TEAL : TEAL_DARK, rx: nodeR, layerRole: 'decor'
  }));
  // checkmark inner circle (slightly smaller, lighter teal)
  const innerR = Math.round(nodeR * 0.65);
  o.push(rect({
    x: cx - innerR, y: cy - innerR, w: innerR * 2, h: innerR * 2,
    fill: TEAL_LIGHT, rx: innerR, layerRole: 'decor'
  }));
  // checkmark symbol (two segments: ✓)
  const checkW = Math.round(nodeR * 0.35);
  const checkH = Math.round(nodeR * 0.45);
  // left diagonal (going down-right)
  o.push(rect({
    x: cx - checkW, y: cy - Math.round(checkH * 0.3),
    w: Math.round(checkW * 0.5), h: 4,
    fill: CHECKMARK, opacity: 0.9, rx: 2, layerRole: 'decor'
  }));
  // right diagonal (going up-left to down-right)
  o.push(rect({
    x: cx, y: cy - checkH,
    w: Math.round(checkW * 0.8), h: 4,
    fill: CHECKMARK, opacity: 0.9, rx: 2, layerRole: 'decor'
  }));

  // label to the side of node (left if vertical, centered above if horizontal —
  // centering keeps the last node's label inside the right canvas edge)
  const labelW = isVertical ? 280 : 200;
  const labelX = isVertical ? cx + nodeR + 28 : cx - Math.round(labelW / 2);
  const labelY = isVertical ? cy - Math.round(estTextHeight(b.label || '', 18, 200)) / 2 : cy - nodeR - 48;
  const lSize = fitFontSize(b.label || '', { width: labelW, height: 60, maxSize: 22, minSize: 14 });
  if (b.label) {
    o.push({
      ...textbox({
        text: b.label, x: labelX, y: labelY, w: labelW, fontSize: lSize,
        fontFamily: fonts.head, fontWeight: '800', fill: TEAL_LIGHT,
        align: isVertical ? 'left' : 'center',
        lineHeight: 1.1, layerRole: 'message', msgId: b.id, bgRef: SLATE_BG
      }),
      fieldRef: 'label'
    });
  }

  // adoption % text below node (centered under the node in horizontal mode)
  const pctW = isVertical ? 200 : 180;
  const pctX = isVertical ? cx + nodeR + 28 : cx - Math.round(pctW / 2);
  const pctY = isVertical ? cy + nodeR + 16 : cy + nodeR + 12;
  o.push({
    ...textbox({
      text: b.text || '', x: Math.round(pctX), y: Math.round(pctY), w: Math.round(pctW), fontSize: 16,
      fontFamily: fonts.body, fontWeight: '600', fill: SLATE_LIGHT,
      lineHeight: 1.25, layerRole: 'message', msgId: b.id, bgRef: SLATE_BG
    }),
    fieldRef: 'text'
  });
}

// Connection line between milestone nodes
function connectionLine(o, x1, y1, x2, y2, isVertical) {
  const lineW = isVertical ? 3 : 4;
  const lineH = isVertical ? Math.abs(y2 - y1) : 2;
  const lineX = isVertical ? x1 - 1 : Math.min(x1, x2);
  const lineY = isVertical ? Math.min(y1, y2) : y1 - 1;
  o.push(rect({
    x: Math.round(lineX), y: Math.round(lineY),
    w: isVertical ? lineW : Math.abs(x2 - x1), h: isVertical ? lineH : lineH,
    fill: TEAL_DARK, opacity: 0.6, layerRole: 'decor'
  }));
}

// Vertical timeline (portrait)
function buildVerticalTimeline(o, blocks, fonts, { x, y, w, h, centerX }) {
  const n = blocks.length;
  if (!n) return;

  const topPad = 80;
  const bottomPad = 60;
  const nodeSpacing = (h - topPad - bottomPad) / (n - 1);
  const nodeR = 44;

  blocks.forEach((b, i) => {
    const cy = y + topPad + i * nodeSpacing;
    milestoneNode(o, b, i, fonts, { cx: centerX, cy, r: nodeR, isVertical: true });
    if (i < n - 1) {
      connectionLine(o, centerX, cy + nodeR, centerX, cy + nodeSpacing - nodeR, true);
    }
  });
}

// Horizontal timeline (landscape)
function buildHorizontalTimeline(o, blocks, fonts, { x, y, w, h, centerY }) {
  const n = blocks.length;
  if (!n) return;

  const leftPad = 100;
  const rightPad = 80;
  const nodeSpacing = (w - leftPad - rightPad) / (n - 1);
  const nodeR = 40;

  blocks.forEach((b, i) => {
    const cx = x + leftPad + i * nodeSpacing;
    milestoneNode(o, b, i, fonts, { cx, cy: centerY, r: nodeR, isVertical: false });
    if (i < n - 1) {
      connectionLine(o, cx + nodeR, centerY, cx + nodeSpacing - nodeR, centerY, false);
    }
  });
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', SLATE_BG);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark slate tech background, subtle gradient, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H, strength: 0.4 }));
  o.push(...gradientWash({ w: W, h: H, from: TEAL_DARK, to: SLATE_BG, direction: 'vertical', intensity: 0.3 }));
  o.push(...dotGrid({ x: W - 180, y: 420, cols: 4, rows: 3, gap: 48, dotR: 2, color: TEAL, intensity: 0.2 }));

  const bandBottom = headerBand(o, content, palette, fonts, {
    W, top: 0, bandH: 360, x: 64, w: W - 128, maxSize: 72, align: 'left'
  });

  const blocks = content.blocks || [];
  const tlTop = bandBottom + 40;
  const tlBottom = 1800;
  buildVerticalTimeline(o, blocks, fonts, {
    x: 80, y: tlTop, w: W - 160, h: tlBottom - tlTop, centerX: Math.round(W / 2)
  });

  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', SLATE_BG);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark slate tech background, subtle gradient, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H, strength: 0.4 }));
  o.push(...gradientWash({ w: W, h: H, from: TEAL_DARK, to: SLATE_BG, direction: 'horizontal', intensity: 0.3 }));
  o.push(...dotGrid({ x: W - 200, y: 320, cols: 3, rows: 2, gap: 60, dotR: 2, color: TEAL, intensity: 0.2 }));

  const bandBottom = headerBand(o, content, palette, fonts, {
    W, top: 0, bandH: 300, x: 64, w: W - 128, maxSize: 60, align: 'left'
  });

  const blocks = content.blocks || [];
  const tlTop = bandBottom + 32;
  const tlBottom = 1140;
  buildHorizontalTimeline(o, blocks, fonts, {
    x: 64, y: tlTop, w: W - 128, h: tlBottom - tlTop, centerY: Math.round((tlTop + tlBottom) / 2)
  });

  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvRect(0, 0, 200, pv(360), SLATE_BG),
    pvRect(pv(64), pv(50), pv(280), 3, palette.primary),
    pvBars({ x: pv(64), y: pv(110), w: pv(600), lines: 2, barH: 7, gap: 5, fill: SLATE_LIGHT })
  ];
  const tlTop = 400, tlBottom = 1800, n = 4, centerX = 100;
  const spacing = (tlBottom - tlTop) / (n - 1);
  for (let i = 0; i < n; i++) {
    const cy = tlTop + i * spacing;
    parts.push(pvCircle(pv(centerX), pv(cy), pv(35), i === 0 ? TEAL : TEAL_DARK));
    parts.push(pvCircle(pv(centerX), pv(cy), pv(23), TEAL_LIGHT));
    parts.push(pvBars({ x: pv(centerX + 50), y: pv(cy - 20), w: pv(200), lines: 1, barH: 6, gap: 3, fill: SLATE_LIGHT }));
    if (i < n - 1) {
      parts.push(pvRect(pv(centerX - 1), pv(cy + 35), 2, pv(spacing - 70), TEAL_DARK, { opacity: 0.5 }));
    }
  }
  return svgWrapO(parts, SLATE_BG, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvRect(0, 0, PV_LAND_W, pv(300), SLATE_BG),
    pvRect(pv(64), pv(45), pv(280), 3, palette.primary),
    pvBars({ x: pv(64), y: pv(100), w: pv(1200), lines: 2, barH: 6, gap: 4, fill: SLATE_LIGHT })
  ];
  const tlTop = 340, tlBottom = 1140, n = 4, centerY = Math.round((tlTop + tlBottom) / 2);
  const leftPad = 150, rightPad = 100, spacing = (PV_LAND_W - leftPad - rightPad) / (n - 1);
  for (let i = 0; i < n; i++) {
    const cx = leftPad + i * spacing;
    parts.push(pvCircle(pv(cx), pv(centerY), pv(32), i === 0 ? TEAL : TEAL_DARK));
    parts.push(pvCircle(pv(cx), pv(centerY), pv(20), TEAL_LIGHT));
    parts.push(pvBars({ x: pv(cx - 40), y: pv(centerY + 50), w: pv(80), lines: 1, barH: 5, gap: 2, fill: SLATE_LIGHT }));
    if (i < n - 1) {
      parts.push(pvRect(pv(cx + 32), pv(centerY - 1), pv(spacing - 64), 2, TEAL_DARK, { opacity: 0.5 }));
    }
  }
  return svgWrapO(parts, SLATE_BG, 'landscape');
}

export default {
  id: 'mfa-journey',
  name: 'MFA adoption journey',
  style: 'timeline',
  description: 'Multi-milestone MFA rollout timeline with sequential adoption nodes featuring teal milestone checkmarks, adoption percentages, and connecting lines. Dark slate canvas with teal accent. Portrait: vertical timeline descending; landscape: horizontal left-to-right.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 12 },
    callToAction: { required: true, maxWords: 12 },
    blocks: { kind: 'sequence', min: 3, max: 5, fields: ['label', 'text'] },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
