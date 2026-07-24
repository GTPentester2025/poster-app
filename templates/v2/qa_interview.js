// v2 template — qa-interview (style: qa). A formal interview/FAQ layout,
// deliberately distinct from qa-chat's bubbles: each pair opens with a large
// brand-primary index numeral ('01'…), a heavy display-face question, and an
// indented answer set off by a thin accent rule — editorial, not
// conversational. One honest image slot beside the headline. Decor =
// horizontal gradient wash + a fingerprint whorl anchoring a corner.
// Portrait stacks the pairs with hairline dividers; landscape splits them
// into two columns of alternating tint panels.
//
// 2026 redesign: oversized numerals with hairline aesthetic, elegant panel
// cards in landscape, richer decor mesh-glow atmosphere, improved spacing.

import {
  textbox, rect, vline, hline,
  fitFontSize, estTextHeight, imageSlot,
  pv, pvRect, pvBars, pvSlot, pvCircle,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, fingerprintArcs, meshGlow,
  svgWrapO, PV_LAND_W,
  legibilityScrim,
} from './decor.js';

// ── shared helpers ────────────────────────────────────────────────────────────

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 152, fill: palette.dark, layerRole: 'background' }));
  const size = fitFontSize(text, { width: W - 200, height: 100, maxSize: 46, minSize: 30 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((152 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: palette.dark
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize, headMaxH = 300, subMaxH = 120 }) {
  const headSize = fitFontSize(content.headline, { width: w, height: headMaxH, maxSize, minSize: 40 });
  const headH = estTextHeight(content.headline, headSize, w, 1.06);
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark,
    lineHeight: 1.06,
    layerRole: 'headline', bgRef: palette.background
  }));
  let cursor = y + headH + 28;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: Math.max(40, subMaxH), maxSize: 40, minSize: 16, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor,
      w, fontSize: subSize, fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.35,
      layerRole: 'subheadline', bgRef: palette.background
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.35) + 16;
  }
  return cursor;
}

/** Two-digit interview index: '01', '02', … */
function indexNumeral(i) {
  return String(i + 1).padStart(2, '0');
}

/**
 * One interview pair: oversized thin primary numeral, heavy question, indented
 * answer behind a thin accent rule.
 * - numeral: layerRole 'message-label', msgId bound
 * - question: layerRole 'message', fieldRef 'question'
 * - answer: layerRole 'message', fieldRef 'answer'
 * answer.left > question.left AND answer.top > question.top (test assertion).
 */
function interviewPair(o, b, i, palette, fonts, { x, y, w, budgetH, bg, numSize = 64 }) {
  // oversized index numeral
  const numW = Math.round(numSize * 2.2);
  o.push({
    ...textbox({
      text: indexNumeral(i), x, y, w: numW, fontSize: numSize,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.primary,
      lineHeight: 1, align: 'left',
      layerRole: 'message-label', msgId: b.id, bgRef: bg
    }),
    fieldRef: 'label'
  });

  // hairline rule beneath the numeral (editorial accent)
  o.push(hline({ x, y: y + Math.round(numSize * 1.15), w: numW, thickness: 2, fill: palette.primary, layerRole: 'decor' }));

  const textX = x + numW + 32;
  const textW = w - numW - 32;

  // question
  const qSize = fitFontSize(b.question, {
    width: textW, height: Math.max(100, budgetH * 0.44), maxSize: 48, minSize: 20
  });
  o.push({
    ...textbox({
      text: b.question, x: textX, y, w: textW, fontSize: qSize,
      fontFamily: fonts.head, fontWeight: '800', fill: palette.dark,
      lineHeight: 1.2,
      layerRole: 'message', msgId: b.id, bgRef: bg
    }),
    fieldRef: 'question'
  });

  // answer — indented right and below the question
  const aY = y + Math.round(estTextHeight(b.question, qSize, textW, 1.2)) + 28;
  const aIndent = 40;
  const aX = textX + aIndent;
  const aW = textW - aIndent;
  const aSize = fitFontSize(b.answer, {
    width: aW, height: Math.max(80, y + budgetH - aY - 16), maxSize: 42, minSize: 20
  });
  const aH = Math.round(estTextHeight(b.answer, aSize, aW, 1.4));
  // accent rule beside the answer
  o.push(vline({ x: textX, y: aY + 4, h: aH, thickness: 5, fill: palette.accent, layerRole: 'decor' }));
  o.push({
    ...textbox({
      text: b.answer, x: aX, y: aY, w: aW, fontSize: aSize,
      fontFamily: fonts.body, fontWeight: '500', fill: palette.dark,
      lineHeight: 1.4,
      layerRole: 'message', msgId: b.id, bgRef: bg
    }),
    fieldRef: 'answer'
  });
}

// ── portrait build ────────────────────────────────────────────────────────────

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.background);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'horizontal', intensity: 0.65 }));
  o.push(...meshGlow({ spots: [
    { x: 1260, y: 360, r: 360, color: palette.primary },
    { x: 160, y: 1700, r: 300, color: palette.accent }
  ], intensity: 0.7 }));
  o.push(...fingerprintArcs({ x: 1300, y: 1720, size: 280, color: palette.dark, intensity: 0.75 }));

  const pTop = 508;
  // pass subMaxH = gap between sub's earliest y and first pair top, minus 8px clearance
  // earliest sub y ≈ headline y + minHeadH + 28 ≈ 104 + 40*1.06 + 28 = 174; but use generous 240 gap
  const pSubMaxH = Math.max(40, pTop - 104 - 300 - 28 - 8); // 300=headBudget, 28=gap, 8=clearance
  headlineZone(o, content, palette, fonts, { x: 96, y: 104, w: 940, maxSize: 108, subMaxH: pSubMaxH });

  o.push(imageSlot({
    slotId: 'slot-1', x: 1080, y: 100, w: 248, h: 248,
    styleHint: 'interview or magnifying-glass inspection emblem, flat vector, no text', stroke: palette.dark
  }));

  const blocks = content.blocks || [];
  const top = 508;
  const bottom = 1824;
  const pairH = (bottom - top) / Math.max(blocks.length, 1);

  blocks.forEach((b, i) => {
    const y = Math.round(top + i * pairH);
    if (i > 0) {
      o.push(hline({ x: 96, y: y - 24, w: 1222, thickness: 2, fill: palette.dark, layerRole: 'decor', opacity: 0.15 }));
    }
    interviewPair(o, b, i, palette, fonts, {
      x: 96, y, w: 1222, budgetH: pairH - 48, bg: palette.background
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1848);
  return canvas;
}

// ── landscape build ───────────────────────────────────────────────────────────

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.background);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'horizontal', intensity: 0.65 }));
  o.push(...meshGlow({ spots: [
    { x: 1600, y: 200, r: 320, color: palette.primary },
    { x: 400, y: 1200, r: 280, color: palette.accent }
  ], intensity: 0.7 }));
  o.push(...fingerprintArcs({ x: 1580, y: 220, size: 210, color: palette.dark, intensity: 0.75 }));

  const lsTop = 404;
  const lsHeadMaxH = content.subheadline ? 140 : 300;
  const lsSubMaxH = Math.max(40, lsTop - 84 - lsHeadMaxH - 28 - 8);
  headlineZone(o, content, palette, fonts, { x: 96, y: 84, w: 1360, maxSize: 96, headMaxH: lsHeadMaxH, subMaxH: lsSubMaxH });

  o.push(imageSlot({
    slotId: 'slot-1', x: 1704, y: 90, w: 224, h: 224,
    styleHint: 'interview or magnifying-glass inspection emblem, flat vector, no text', stroke: palette.dark
  }));

  // two columns of alternating tint panels
  const blocks = content.blocks || [];
  const leftCount = Math.ceil(blocks.length / 2);
  const rows = Math.max(leftCount, 1);
  const top = 404;
  const panelH = Math.round((1232 - top) / rows) - 16;

  blocks.forEach((b, i) => {
    const col = i < leftCount ? 0 : 1;
    const row = col === 0 ? i : i - leftCount;
    const px = col === 0 ? 96 : 1040;
    const py = Math.round(top + row * (panelH + 16));
    const fill = i % 2 === 0 ? '#FFFFFF' : palette.background;
    o.push(rect({
      x: px, y: py, w: 904, h: panelH, fill, rx: 24,
      stroke: palette.dark, strokeWidth: i % 2 === 0 ? 0 : 1,
      opacity: i % 2 === 0 ? 1 : 0.08,
      layerRole: 'background', msgId: b.id
    }));
    o.push(rect({
      x: px, y: py, w: 904, h: panelH, fill: 'transparent', rx: 24,
      stroke: palette.dark, strokeWidth: i % 2 === 0 ? 1 : 0,
      layerRole: 'background', msgId: b.id
    }));
    interviewPair(o, b, i, palette, fonts, {
      x: px + 36, y: py + 28, w: 832, budgetH: panelH - 56, bg: fill, numSize: 52
    });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1262);
  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────

function pvPair(parts, palette, { x, y, w, numW = 28 }) {
  parts.push(pvRect(pv(x), pv(y), pv(numW * 4.5), 7, palette.primary, { rx: 2 }));
  parts.push(pvBars({ x: pv(x + 152), y: pv(y), w: pv(w - 152), lines: 1, barH: 5.5, gap: 3, fill: palette.dark }));
  parts.push(pvRect(pv(x + 152), pv(y + 66), 1.2, pv(76), palette.accent));
  parts.push(pvBars({ x: pv(x + 192), y: pv(y + 66), w: pv(w - 192), lines: 2, barH: 4.5, gap: 3, fill: palette.dark }));
}

function previewPortrait(palette) {
  const parts = [
    pvCircle(pv(1300), pv(1720), pv(140), 'none', { stroke: palette.dark, opacity: 0.14 }),
    pvBars({ x: pv(96), y: pv(118), w: pv(940), lines: 2, barH: 8, gap: 5, fill: palette.dark }),
    pvSlot(pv(1080), pv(100), pv(248), pv(248), palette.dark)
  ];
  for (let i = 0; i < 4; i++) {
    const y = 512 + i * 328;
    if (i > 0) parts.push(pvRect(pv(96), pv(y - 24), pv(1222), 0.6, palette.dark, { opacity: 0.25 }));
    pvPair(parts, palette, { x: 96, y, w: 1222 });
  }
  parts.push(pvRect(0, pv(1848), 200, pv(152), palette.dark));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const parts = [
    pvCircle(pv(1580), pv(220), pv(110), 'none', { stroke: palette.dark, opacity: 0.14 }),
    pvBars({ x: pv(96), y: pv(98), w: pv(1360), lines: 2, barH: 8, gap: 5, fill: palette.dark }),
    pvSlot(pv(1704), pv(90), pv(224), pv(224), palette.dark)
  ];
  let i = 0;
  for (const x of [96, 1040]) {
    for (const y of [404, 820]) {
      parts.push(pvRect(pv(x), pv(y), pv(904), pv(400), i % 2 === 0 ? '#FFFFFF' : 'none', {
        rx: 4, stroke: palette.dark, opacity: 0.5
      }));
      pvPair(parts, palette, { x: x + 36, y: y + 36, w: 832, numW: 22 });
      i += 1;
    }
  }
  parts.push(pvRect(0, pv(1262), PV_LAND_W, pv(152), palette.dark));
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'qa-interview',
  name: 'Q&A interview',
  style: 'qa',
  description: 'Editorial interview/FAQ layout — numbered questions in a heavy display face with indented, accent-ruled answers. Stacked with hairline dividers in portrait, two columns of alternating panels in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'qa-pairs', min: 3, max: 4, fields: ['question', 'answer'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
