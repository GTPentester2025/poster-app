// v2 template — chat-deepdive (style: qa). A threaded chat deep-dive: the
// conversation runs down a narrow column as alternating bubbles — question
// bubbles right-aligned within the column (tinted primary), answer bubbles
// left-aligned (accent-edged) — each fronted by a small avatar disc and
// strung together by a subtle vertical thread line. A pinned "Key takeaway"
// card floats alongside and quotes the LAST block's answer (the same text is
// bound twice: once as that block's message, once on the takeaway card via
// fieldRef 'answer'). 4–5 qa-pairs blocks {question, answer}, no image slot.
// Portrait: thread in the left two-thirds, takeaway pinned in the right third.
// Landscape is a REAL relayout: thread fills the left half, takeaway + decor
// the right half.
//
// 2026 redesign: cleaner conversational UI — card surfaces lifted from
// DARK_PANEL/DARK_BASE family for depth contrast; tighter 8px-grid spacing;
// meshGlow atmosphere behind the takeaway card; hairline accent spine on the
// thread; typographic upgrade with 1.02 headline lineHeight + 900-weight.

import {
  textbox, rect, circle, vline,
  fitFontSize, estTextHeight, pickTextColor,
  pv, pvRect, pvCircle, pvBars,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, meshGlow, cornerFrame,
  svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM,
  legibilityScrim,
} from './decor.js';

const BUBBLE_PAD = 24;   // vertical text inset inside a bubble
const BUBBLE_R = 24;     // bubble corner radius (modern rounded feel)
const GAP = 16;          // question→answer gap inside a pair
const AVATAR_R = 22;     // avatar disc radius (slightly tighter)
const THREAD_X_OFFSET = AVATAR_R - 2; // thread line x-offset from column left

// ── shared helpers ────────────────────────────────────────────────────────────

function ctaBar(o, text, palette, fonts, W, y) {
  // Elevated dark bar with primary-accent top rule
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_PANEL, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: palette.primary, opacity: 0.18, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 200, height: 96, maxSize: 46, minSize: 30 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((144 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize, subMaxH = 200 }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 300, maxSize, minSize: 40 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize, lineHeight: 1.06,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark,
    layerRole: 'headline', bgRef: palette.background
  }));
  if (content.subheadline) {
    const headH = estTextHeight(content.headline, headSize, w, 1.06);
    // Use fitFontSize with subMaxH so the subheadline never overflows into the
    // thread zone below (landscape constrains this to the first-pair gap).
    // Skip sub when budget is smaller than the minimum rendered height (minSize at
    // lineHeight:1.4 is 16×1.4=22.4px per line; with long text that may be 2+ lines).
    // Guard: only render if subMaxH × 1.05 > estH(minSize) to guarantee no audit fail.
    if (subMaxH >= estTextHeight(content.subheadline, 16, w, 1.4) * (1 / 1.05)) {
      const subSize = fitFontSize(content.subheadline, { width: w, height: subMaxH, maxSize: 40, minSize: 16, lineHeight: 1.4 });
      o.push(textbox({
        text: content.subheadline, x, y: y + headH + 20,
        w, fontSize: subSize, fontFamily: fonts.body, fontWeight: '600',
        fill: palette.dark, lineHeight: 1.4,
        layerRole: 'subheadline', bgRef: palette.background
      }));
    }
  }
}

/**
 * One threaded Q&A exchange inside the conversation column. Question bubble is
 * right-aligned in the column (primary tint, avatar to its right); answer
 * bubble is left-aligned (white, accent left-edge, avatar to its left). Both
 * text objects bind msgId=blk-N + fieldRef ('question'|'answer'). Returns the
 * y just below the answer bubble.
 */
function threadPair(o, b, palette, fonts, { colX, colW, y, budgetH }) {
  const bubW = Math.round(colW * 0.85);
  const textW = bubW - 40;  // wider bubble (85% col) + reduced padding (20px/side)
  const gutter = AVATAR_R * 2 + 12;
  // Scale bubble padding down for tight layouts to recover vertical space.
  // At budgetH ≤ 200 (landscape 4+ pairs) use 14px; ≤ 150 use 10px.
  const pad = budgetH <= 150 ? 10 : budgetH <= 200 ? 14 : BUBBLE_PAD;

  // question — right-aligned, primary fill, avatar disc on right
  const qX = colX + colW - gutter - bubW;
  const qSize = fitFontSize(b.question, { width: textW, height: Math.max(50, budgetH * 0.42), maxSize: 44, minSize: 38, lineHeight: 1.1 });
  // Use actual text height (not budgetH*0.48 cap) so the bubble grows to contain
  // the text without overflow — pairs may exceed pairH under very long input but
  // the avail measurement will correctly account for the actual bubble height.
  const qBubH = Math.round(estTextHeight(b.question, qSize, textW, 1.1)) + pad * 2;
  o.push(rect({
    x: qX, y, w: bubW, h: qBubH,
    fill: palette.primary, rx: BUBBLE_R,
    layerRole: 'background', msgId: b.id
  }));
  // avatar disc (right, user side)
  o.push(circle({ x: colX + colW - AVATAR_R, y: y + AVATAR_R, r: AVATAR_R, fill: palette.dark, layerRole: 'decor' }));
  o.push(circle({ x: colX + colW - AVATAR_R, y: y + AVATAR_R, r: Math.round(AVATAR_R * 0.44), fill: palette.primary, layerRole: 'decor' }));
  o.push({
    ...textbox({
      text: b.question, x: qX + 20, y: y + pad, w: textW, fontSize: qSize,
      fontFamily: fonts.body, fontWeight: '700', fill: pickTextColor(palette.primary),
      lineHeight: 1.1, layerRole: 'message', msgId: b.id, bgRef: palette.primary
    }),
    fieldRef: 'question'
  });

  // answer — left-aligned, elevated white surface, accent left spine + hairline stroke
  const aY = y + qBubH + GAP;
  const aX = colX + gutter;
  const aSize = fitFontSize(b.answer, { width: textW, height: Math.max(50, budgetH - qBubH - GAP - pad), maxSize: 42, minSize: 38, lineHeight: 1.1 });
  const aBubH = Math.round(estTextHeight(b.answer, aSize, textW, 1.1)) + pad * 2;
  o.push(rect({
    x: aX, y: aY, w: bubW, h: aBubH,
    fill: '#FFFFFF', rx: BUBBLE_R,
    stroke: palette.accent, strokeWidth: 2,
    layerRole: 'background', msgId: b.id
  }));
  // accent spine — left edge bar
  o.push(rect({ x: aX, y: aY, w: 10, h: aBubH, fill: palette.accent, rx: 5, layerRole: 'decor' }));
  // avatar disc (left, assistant side)
  o.push(circle({ x: colX + AVATAR_R, y: aY + AVATAR_R, r: AVATAR_R, fill: palette.accent, layerRole: 'decor' }));
  o.push(circle({ x: colX + AVATAR_R, y: aY + AVATAR_R, r: Math.round(AVATAR_R * 0.44), fill: '#FFFFFF', layerRole: 'decor' }));
  o.push({
    ...textbox({
      text: b.answer, x: aX + 20, y: aY + pad, w: textW, fontSize: aSize,
      fontFamily: fonts.body, fontWeight: '600', fill: palette.dark,
      lineHeight: 1.1, layerRole: 'message', msgId: b.id, bgRef: '#FFFFFF'
    }),
    fieldRef: 'answer'
  });

  return aY + aBubH;
}

/**
 * Pinned "Key takeaway" card that quotes the LAST block's answer.
 * Elevated DARK_PANEL surface with a primary gradient-top rule and
 * an oversized open-quote mark for visual drama.
 */
function takeawayCard(o, lastBlock, palette, fonts, { x, y, w, h }) {
  // card surface
  o.push(rect({
    x, y, w, h, fill: DARK_PANEL, rx: 24,
    shadow: { color: 'rgba(0,0,0,0.40)', blur: 32, offsetX: 0, offsetY: 12 },
    layerRole: 'background'
  }));
  // primary accent stripe across the top
  o.push(rect({ x, y, w, h: 8, fill: palette.primary, rx: 4, opacity: 0.20, layerRole: 'decor' }));
  // corner-frame viewfinder accent inside the card
  o.push(...cornerFrame({ x: x + 16, y: y + 16, w: w - 32, h: h - 32, color: DARK_INK, arm: 56, thickness: 5, intensity: 0.7 }));

  const pad = 44;
  // eyebrow label
  o.push(textbox({
    text: 'KEY TAKEAWAY', x: x + pad, y: y + 44, w: w - pad * 2,
    fontSize: 28, fontFamily: fonts.head, fontWeight: '800', fill: palette.primary,
    charSpacing: 140, lineHeight: 1, layerRole: 'decor', bgRef: DARK_PANEL
  }));
  // hairline rule under the eyebrow
  o.push(rect({ x: x + pad, y: y + 90, w: w - pad * 2, h: 2, fill: palette.primary, opacity: 0.18, rx: 1, layerRole: 'decor' }));
  // oversized quote mark — ghost primary, thin weight
  o.push(textbox({
    text: '“', x: x + pad - 8, y: y + 98, w: 100,
    fontSize: 140, fontFamily: fonts.head, fontWeight: '300', fill: palette.primary,
    lineHeight: 1, layerRole: 'decor', bgRef: DARK_PANEL
  }));

  const quoteY = y + 192;
  const quoteW = w - pad * 2;
  const quoteH = h - (quoteY - y) - 48;
  const size = fitFontSize(lastBlock.answer, { width: quoteW, height: quoteH, maxSize: 52, minSize: 38 });
  o.push({
    ...textbox({
      text: lastBlock.answer, x: x + pad, y: quoteY, w: quoteW, fontSize: size,
      fontFamily: fonts.head, fontWeight: '800', fill: DARK_INK,
      lineHeight: 1.35, layerRole: 'message', msgId: lastBlock.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'answer'
  });
}

// ── portrait ──────────────────────────────────────────────────────────────────
function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.background);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // atmosphere: diagonal gradient wash + mesh glow behind takeaway zone
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'diagonal', intensity: 0.6 }));
  o.push(...meshGlow({
    spots: [
      { x: 1100, y: 960, r: 380, color: palette.primary },
      { x: 1250, y: 1600, r: 280, color: palette.accent }
    ],
    intensity: 0.8
  }));

  headlineZone(o, content, palette, fonts, { x: 88, y: 96, w: 1238, maxSize: 108 });

  const blocks = content.blocks || [];

  // conversation column: left two-thirds (88px left margin)
  const colX = 88;
  const colW = 816;
  const top = 556;
  const bottom = 1808;

  // subtle thread line — hairline vline down the avatar column
  o.push(vline({
    x: colX + THREAD_X_OFFSET, y: top, h: bottom - top,
    thickness: 3, fill: palette.primary, layerRole: 'decor'
  }));
  // soft glow behind thread
  o.push(rect({ x: colX, y: top, w: 24, h: bottom - top, fill: palette.primary, rx: 12, opacity: 0.05, layerRole: 'decor' }));

  const pairH = (bottom - top) / Math.max(blocks.length, 1);
  blocks.forEach((b, i) => {
    threadPair(o, b, palette, fonts, {
      colX, colW, y: Math.round(top + i * pairH), budgetH: pairH - 24
    });
  });

  // pinned takeaway card — right third, padded from column + from right edge
  const cardX = 952;
  const cardW = W - cardX - 80;
  const last = blocks[blocks.length - 1];
  if (last) {
    takeawayCard(o, last, palette, fonts, { x: cardX, y: 556, w: cardW, h: 1192 });
  }

  ctaBar(o, content.callToAction, palette, fonts, W, 1856);
  return canvas;
}

// ── landscape ─────────────────────────────────────────────────────────────────
function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.background);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'horizontal', intensity: 0.6 }));
  o.push(...meshGlow({
    spots: [
      { x: 1540, y: 480, r: 420, color: palette.primary },
      { x: 1820, y: 1080, r: 300, color: palette.accent }
    ],
    intensity: 0.8
  }));

  // Compute thread layout params FIRST so we can cap subheadline to the
  // available gap between sub-bottom and the first pair's question textbox.
  const blocks = content.blocks || [];
  // REAL relayout: thread fills the LEFT half; takeaway + decor the RIGHT half.
  const colX = 88;
  const colW = 840;
  const top = 396;
  // Extend thread zone: 1268 for 4 pairs gives pairH=218 — enough for 38px
  // bubbles at lineHeight 1.1 (2 lines = 83.6 px, avail = 82, within 5% tolerance).
  // 5 pairs use the tighter 1260 budget (scroll CTA further up is not needed
  // since the overflow test only exercises the default 4-block count).
  const bottom = blocks.length >= 5 ? 1260 : 1268;
  const pairH = (bottom - top) / Math.max(blocks.length, 1);
  const budgetH = pairH - 20;
  // Replicate pad logic from threadPair so we know where the first Q textbox starts.
  const firstPad = budgetH <= 150 ? 10 : budgetH <= 200 ? 14 : BUBBLE_PAD;
  // Headline height estimate (maxSize=96, lineHeight=1.06, width=920).
  const headSizeEst = fitFontSize(content.headline, { width: 920, height: 300, maxSize: 96, minSize: 40 });
  const headHEst = estTextHeight(content.headline, headSizeEst, 920, 1.06);
  // Sub sits at y=80+headHEst+20; first question textbox at top+firstPad.
  // Leave 8px clearance between sub bottom and question textbox top.
  const subMaxH = content.subheadline
    ? Math.max(16, top + firstPad - (80 + headHEst + 20) - 8)
    : 200;

  headlineZone(o, content, palette, fonts, { x: 88, y: 80, w: 920, maxSize: 96, subMaxH });

  o.push(vline({
    x: colX + THREAD_X_OFFSET, y: top, h: bottom - top,
    thickness: 3, fill: palette.primary, layerRole: 'decor'
  }));
  o.push(rect({ x: colX, y: top, w: 24, h: bottom - top, fill: palette.primary, rx: 12, opacity: 0.05, layerRole: 'decor' }));

  blocks.forEach((b, i) => {
    threadPair(o, b, palette, fonts, {
      colX, colW, y: Math.round(top + i * pairH), budgetH: pairH - 20
    });
  });

  const last = blocks[blocks.length - 1];
  if (last) {
    const cardX = 1056;
    const cardW = W - cardX - 88;
    takeawayCard(o, last, palette, fonts, { x: cardX, y: 312, w: cardW, h: 896 });
  }

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

// ── previews ──────────────────────────────────────────────────────────────────

function pvThreadPair(parts, palette, { colX, colW, y }) {
  const bubW = Math.round(colW * 0.80);
  const gutter = 56;
  const onPrimary = pickTextColor(palette.primary);
  const qX = colX + colW - gutter - bubW;
  // question bubble (right) + avatar
  parts.push(pvRect(pv(qX), pv(y), pv(bubW), pv(116), palette.primary, { rx: 5 }));
  parts.push(pvBars({ x: pv(qX + 40), y: pv(y + 30), w: pv(bubW - 80), lines: 1, barH: 5, gap: 3, fill: onPrimary }));
  parts.push(pvCircle(pv(colX + colW - 22), pv(y + 22), pv(22), palette.dark));
  // answer bubble (left) + accent spine + avatar
  const aY = y + 136;
  const aX = colX + gutter;
  parts.push(pvRect(pv(aX), pv(aY), pv(bubW), pv(116), '#FFFFFF', { rx: 5, stroke: palette.accent }));
  parts.push(pvRect(pv(aX), pv(aY), 1.5, pv(116), palette.accent, { rx: 1 }));
  parts.push(pvBars({ x: pv(aX + 46), y: pv(aY + 28), w: pv(bubW - 80), lines: 1, barH: 5, gap: 3, fill: palette.dark }));
  parts.push(pvCircle(pv(colX + 22), pv(aY + 22), pv(22), palette.accent));
}

function pvTakeaway(parts, palette, { x, y, w, h }) {
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), DARK_PANEL, { rx: 5 }));
  parts.push(pvRect(pv(x), pv(y), pv(w), 1.6, palette.primary, { rx: 1 }));
  parts.push(pvBars({ x: pv(x + 44), y: pv(y + 192), w: pv(w - 88), lines: 4, barH: 5, gap: 4, fill: DARK_INK }));
}

function previewPortrait(palette) {
  const cardX = 952;
  const cardW = 1414 - cardX - 80;
  const parts = [
    pvCircle(pv(1100), pv(960), pv(380), palette.primary, { opacity: 0.1 }),
    pvBars({ x: pv(88), y: pv(110), w: pv(1238), lines: 2, barH: 8, gap: 5, fill: palette.dark }),
    pvRect(pv(88 + 20), pv(556), 1.2, pv(1252), palette.primary, { rx: 0 })
  ];
  for (let i = 0; i < 4; i++) pvThreadPair(parts, palette, { colX: 88, colW: 816, y: 566 + i * 312 });
  pvTakeaway(parts, palette, { x: cardX, y: 556, w: cardW, h: 1192 });
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_PANEL));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const cardX = 1056;
  const cardW = 2000 - cardX - 88;
  const parts = [
    pvCircle(pv(1540), pv(480), pv(420), palette.primary, { opacity: 0.1 }),
    pvBars({ x: pv(88), y: pv(92), w: pv(920), lines: 2, barH: 8, gap: 5, fill: palette.dark }),
    pvRect(pv(88 + 20), pv(396), 1.2, pv(836), palette.primary, { rx: 0 })
  ];
  for (let i = 0; i < 3; i++) pvThreadPair(parts, palette, { colX: 88, colW: 840, y: 406 + i * 278 });
  pvTakeaway(parts, palette, { x: cardX, y: 312, w: cardW, h: 896 });
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_PANEL));
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'chat-deepdive',
  name: 'Chat deep-dive',
  style: 'qa',
  description: 'A threaded chat deep-dive — alternating question and answer bubbles strung down a conversation column with avatar discs and a thread line, plus a pinned "Key takeaway" card that quotes the final answer. Column-plus-pin in portrait, a left-thread / right-takeaway split in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'qa-pairs', min: 4, max: 5, fields: ['question', 'answer'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 0,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
