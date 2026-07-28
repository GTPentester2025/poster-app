// v2 template — comic-saga (style: comic). A richer graphic-novel spread than
// comic-strip/comic-reveal: a large establishing panel (full-width image slot
// with the opening heading + a caption BAR beneath it), then a grid of smaller
// action panels, each an honest image slot with a bold heading and a one-line
// caption bar UNDER the panel (captions as bars, never chips). Portrait stacks
// the establishing panel over the action grid; landscape is a REAL relayout —
// a cinematic filmstrip with the establishing panel filling the left half and
// the action panels in a right-side grid. 4–5 panels blocks {heading, text}:
// the FIRST 4 map to the 4 image slots (slot-1..slot-4); an optional 5th block
// is a text-only closing panel (no slot). Decor = halftone dot grids + gradient
// wash + a subtle accent burst (polygon) behind the final panel. All template
// text stays axis-aligned — panels are offset + tinted for energy, never tilted
// (the pptx export contract forbids rotated template text).
//
// 2026 redesign: premium graphic-novel aesthetic — elevated panel surfaces with
// deeper rx and 1px dark hairlines; caption bars in DARK_PANEL for richer
// contrast; accent burst opacity lifted to max 0.18; dot-grid placed tastefully
// in corner zones; heading typography at 900-weight with 1.04 lineHeight.

import {
  textbox, rect, polygon, imageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvPoly, pvBars, pvSlot,
  backgroundImageSlot,
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, dotGrid, meshGlow, svgWrapO, PV_LAND_W,
  DARK_PANEL, DARK_INK,
  legibilityScrim,
} from './decor.js';

const FRAME_STROKE = 5;   // panel border weight — refined from 6
const FRAME_R = 24;       // panel corner radius (2026: rounder feel)
const CAP_H = 96;         // caption bar height
const MAX_SLOTS = 4;      // schema imageSlots — a 5th block is text-only

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_PANEL, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 4, fill: palette.primary, opacity: 0.18, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 200, height: 96, maxSize: 46, minSize: 30 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((144 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

function headlineZone(o, content, palette, fonts, { x, y, w, maxSize }) {
  const headSize = fitFontSize(content.headline, { width: w, height: 280, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize, lineHeight: 1.04,
    fontFamily: fonts.head, fontWeight: '900', fill: palette.dark,
    layerRole: 'headline', bgRef: palette.background
  }));
  let cursor = y + Math.round(estTextHeight(content.headline, headSize, w, 1.04)) + 20;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 40, minSize: 16, lineHeight: 1.4 });
    o.push(textbox({
      text: content.subheadline, x, y: cursor,
      w, fontSize: subSize, fontFamily: fonts.body, fontWeight: '600',
      fill: palette.dark, lineHeight: 1.4,
      layerRole: 'subheadline', bgRef: palette.background
    }));
    cursor += Math.round(estTextHeight(content.subheadline, subSize, w, 1.4)) + 20;
  }
  return cursor;
}

/** Five-point accent burst polygon (graphic-novel energy) behind a focal panel. */
function burst(cx, cy, r, color) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : Math.round(r * 0.52);
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push({ x: Math.round(cx + rad * Math.cos(a)), y: Math.round(cy + rad * Math.sin(a)) });
  }
  return polygon(pts, { fill: color, opacity: 0.14, layerRole: 'decor' });
}

/** Graphic-novel panel border — clean, axis-aligned, energy via offset + tint. */
function panelFrame(o, b, palette, { x, y, w, h }) {
  o.push(rect({
    x, y, w, h, fill: '#FFFFFF', rx: FRAME_R,
    stroke: palette.dark, strokeWidth: FRAME_STROKE,
    layerRole: 'background', msgId: b.id
  }));
  // subtle inner primary tint strip on top edge for graphic-novel register marks
  o.push(rect({
    x: x + FRAME_R, y: y, w: w - FRAME_R * 2, h: 6,
    fill: palette.primary, rx: 3, opacity: 0.12, layerRole: 'decor'
  }));
}

/**
 * Caption BAR under a panel (DARK_PANEL bar + caption text). Binds the
 * block's msgId + fieldRef 'text'. Text fills the bar; stays on the 38px floor.
 */
/**
 * Caption BAR under a panel. Height is capped at `h` but the bar auto-grows if
 * the text needs more space (using dynamic sizing to keep within h).
 * Minimum font size is 30 for captions (smaller than body — they are secondary
 * context, not the primary message). Text is always top-aligned inside the bar.
 */
function captionBar(o, b, palette, fonts, { x, y, w, h }) {
  const textW = w - 64;
  // lineHeight: 1.0 — tight single-leading for captions in narrow columns.
  // Landscape action panels are 422px wide (textW~306) so even 4 lines at 38px
  // must fit: 4 * 38 * 1.0 = 152, within 5% of avail=150 (152 ≤ 157.5).
  const CAP_LINE_H = 1.0;
  const size = fitFontSize(b.text, { width: textW, height: h - 20, maxSize: 44, minSize: 16 });
  const estH = estTextHeight(b.text, size, textW, CAP_LINE_H);
  // Bar height: at least h, but grows if text still overflows at floor size.
  const barH = Math.max(h, Math.round(estH) + 24);
  o.push(rect({ x, y, w, h: barH, fill: DARK_PANEL, rx: 14, layerRole: 'background', msgId: b.id }));
  // primary left-edge accent marker
  o.push(rect({ x, y: y + Math.round((barH - 40) / 2), w: 8, h: 40, fill: palette.accent, rx: 4, opacity: 0.18, layerRole: 'decor' }));
  o.push({
    ...textbox({
      text: b.text, x: x + 32, y: y + 12,
      w: textW, fontSize: size, fontFamily: fonts.body, fontWeight: '600',
      fill: DARK_INK, lineHeight: CAP_LINE_H,
      layerRole: 'message', msgId: b.id, bgRef: DARK_PANEL
    }),
    fieldRef: 'text'
  });
}

/** Bold panel heading over a white panel; binds msgId + fieldRef 'heading'. */
function panelHeading(o, b, palette, fonts, { x, y, w, headMax, headH = 130 }) {
  const size = fitFontSize(b.heading, { width: w, height: headH, maxSize: headMax, minSize: 22 });
  o.push({
    ...textbox({
      text: b.heading, x, y, w, fontSize: size, lineHeight: 1.04,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.dark,
      layerRole: 'message', msgId: b.id, bgRef: '#FFFFFF'
    }),
    fieldRef: 'heading'
  });
  return y + Math.round(estTextHeight(b.heading, size, w, 1.04));
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.background);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // decor: subtle wash + dot grids in two corners (screen-tone) + mesh glow
  o.push(...gradientWash({ w: W, h: 2000, from: palette.primary, to: palette.accent, direction: 'vertical', intensity: 0.65 }));
  // top-right corner dot field (airy/sparse)
  o.push(...dotGrid({ x: 1056, y: 88, cols: 6, rows: 4, gap: 48, dotR: 5, color: palette.dark, intensity: 0.75 }));
  // bottom-left corner dot field (accent tint)
  o.push(...dotGrid({ x: 88, y: 1720, cols: 5, rows: 3, gap: 48, dotR: 5, color: palette.accent, intensity: 0.65 }));
  // gentle mesh glow behind the action grid zone
  o.push(...meshGlow({
    spots: [{ x: 1100, y: 1400, r: 420, color: palette.accent }],
    intensity: 0.55
  }));

  const hzCursor = headlineZone(o, content, palette, fonts, { x: 88, y: 96, w: 1238, maxSize: 108 });

  const blocks = content.blocks || [];
  const first = blocks[0];
  const rest = blocks.slice(1);

  // ── establishing panel: full-width slot + heading + caption BAR under it ──
  const estX = 88;
  const estY = Math.max(480, hzCursor + 16);
  const estW = 1238;
  const estH = 560;
  if (first) {
    panelFrame(o, first, palette, { x: estX, y: estY, w: estW, h: estH });
    o.push(imageSlot({
      slotId: 'slot-1', x: estX + 32, y: estY + 32, w: estW - 64, h: 302,
      styleHint: 'wide establishing graphic-novel scene, cinematic, bold flat vector, thick outlines, no text',
      stroke: palette.dark
    }));
    const estPHeadH = Math.max(40, estH - 352 - CAP_H - 28 - 16);
    const hEnd = panelHeading(o, first, palette, fonts, { x: estX + 36, y: estY + 352, w: estW - 72, headMax: 62, headH: estPHeadH });
    captionBar(o, first, palette, fonts, {
      x: estX + 32, y: Math.max(hEnd + 16, estY + estH - CAP_H - 28),
      w: estW - 64, h: CAP_H
    });
  }

  // ── action grid: 2-col grid of smaller panels below ──
  const gridTop = 1088;
  const gridBottom = 1808;
  const gap = 32;
  const colW = Math.round((estW - gap) / 2);
  const rows = Math.max(1, Math.ceil(rest.length / 2));
  const rowH = Math.round((gridBottom - gridTop - gap * (rows - 1)) / rows);

  rest.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = estX + col * (colW + gap);
    const y = gridTop + row * (rowH + gap);
    const slotIndex = i + 1;
    const hasSlot = slotIndex < MAX_SLOTS;

    // accent burst behind the LAST panel of the saga
    if (i === rest.length - 1) o.push(burst(x + colW - 56, y + 56, 148, palette.accent));

    panelFrame(o, b, palette, { x, y, w: colW, h: rowH });

    if (hasSlot) {
      // headAvail = captionText_y - headingText_y - 8
      // captionText_y = y + rowH - CAP_H - 22 + 12; headingText_y = y + 42 + slotH
      // => rowH - CAP_H - slotH - 60
      const slotH = Math.round(rowH * 0.38);
      const headAvail = rowH - CAP_H - slotH - 60;
      o.push(imageSlot({
        slotId: `slot-${slotIndex + 1}`, x: x + 28, y: y + 28, w: colW - 56, h: slotH,
        styleHint: 'single action beat, graphic-novel panel, bold flat vector, thick outlines, no text',
        stroke: palette.dark
      }));
      panelHeading(o, b, palette, fonts, { x: x + 32, y: y + 42 + slotH, w: colW - 64, headMax: Math.max(40, Math.min(46, headAvail - 4)), headH: Math.max(20, headAvail) });
      captionBar(o, b, palette, fonts, { x: x + 28, y: y + rowH - CAP_H - 22, w: colW - 56, h: CAP_H });
    } else {
      // text-only closing panel (5th block, no slot)
      // captionText_y = y + rowH - CAP_H - 22 + 12; headingText_y = y + 44
      // textOnlyHeadH = rowH - CAP_H - 44 - 30 - 8 = rowH - CAP_H - 82
      const textOnlyHeadH = Math.max(20, rowH - CAP_H - 82);
      panelHeading(o, b, palette, fonts, { x: x + 34, y: y + 44, w: colW - 68, headMax: 52, headH: textOnlyHeadH });
      captionBar(o, b, palette, fonts, { x: x + 28, y: y + rowH - CAP_H - 22, w: colW - 56, h: CAP_H });
    }
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1856);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.background);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;


  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark atmospheric background, subtle texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...gradientWash({ w: W, h: 1414, from: palette.primary, to: palette.accent, direction: 'horizontal', intensity: 0.65 }));
  o.push(...dotGrid({ x: 1600, y: 88, cols: 6, rows: 4, gap: 48, dotR: 5, color: palette.dark, intensity: 0.75 }));
  o.push(...dotGrid({ x: 88, y: 1048, cols: 4, rows: 3, gap: 48, dotR: 5, color: palette.accent, intensity: 0.65 }));
  o.push(...meshGlow({
    spots: [{ x: 1600, y: 800, r: 380, color: palette.accent }],
    intensity: 0.55
  }));

  const lsCursor = headlineZone(o, content, palette, fonts, { x: 88, y: 72, w: 1824, maxSize: 100 });

  const blocks = content.blocks || [];
  const first = blocks[0];
  const rest = blocks.slice(1);

  // ── cinematic filmstrip: establishing panel fills the LEFT half ──
  const estX = 88;
  const estY = Math.max(376, lsCursor + 16);
  const estW = 904;
  const estH = 900;  // reduced from 936 so captionBar clears the ctaBar at y=1270
  if (first) {
    panelFrame(o, first, palette, { x: estX, y: estY, w: estW, h: estH });
    o.push(imageSlot({
      slotId: 'slot-1', x: estX + 36, y: estY + 36, w: estW - 72, h: 562,
      styleHint: 'wide establishing graphic-novel scene, cinematic, bold flat vector, thick outlines, no text',
      stroke: palette.dark
    }));
    const lsEstPHeadH = Math.max(40, estH - 618 - CAP_H - 32 - 14);
    const hEnd = panelHeading(o, first, palette, fonts, { x: estX + 40, y: estY + 618, w: estW - 80, headMax: 62, headH: lsEstPHeadH });
    captionBar(o, first, palette, fonts, {
      x: estX + 36, y: Math.max(hEnd + 14, estY + estH - CAP_H - 32),
      w: estW - 72, h: CAP_H
    });
  }

  // ── action panels: right-side grid ──
  const gridX = 1040;
  const gridW = W - gridX - 88;
  const gridTop = 376;
  const gridBottom = 1220; // leave headroom above CTA bar (starts at 1270)
  const gap = 28;
  const colW = Math.round((gridW - gap) / 2);
  const rows = Math.max(1, Math.ceil(rest.length / 2));
  const rowH = Math.round((gridBottom - gridTop - gap * (rows - 1)) / rows);

  rest.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = gridX + col * (colW + gap);
    const y = gridTop + row * (rowH + gap);
    const slotIndex = i + 1;
    const hasSlot = slotIndex < MAX_SLOTS;

    if (i === rest.length - 1) o.push(burst(x + colW - 52, y + 52, 128, palette.accent));

    panelFrame(o, b, palette, { x, y, w: colW, h: rowH });

    if (hasSlot) {
      // headAvail = captionText_y - headingText_y - 8
      // captionText_y = y + rowH - CAP_H - 20 + 12; headingText_y = y + 38 + slotH
      // => rowH - CAP_H - slotH - 54
      const slotH = Math.round(rowH * 0.36);
      const headAvail = rowH - CAP_H - slotH - 54;
      o.push(imageSlot({
        slotId: `slot-${slotIndex + 1}`, x: x + 26, y: y + 26, w: colW - 52, h: slotH,
        styleHint: 'single action beat, graphic-novel panel, bold flat vector, thick outlines, no text',
        stroke: palette.dark
      }));
      panelHeading(o, b, palette, fonts, { x: x + 30, y: y + 38 + slotH, w: colW - 60, headMax: Math.max(40, Math.min(44, headAvail - 4)), headH: Math.max(20, headAvail) });
      captionBar(o, b, palette, fonts, { x: x + 26, y: y + rowH - CAP_H - 20, w: colW - 52, h: CAP_H });
    } else {
      // captionText_y = y + rowH - CAP_H - 20 + 12; headingText_y = y + 38
      // avail = rowH - CAP_H - 54
      const lsTextOnlyHeadH = Math.max(20, rowH - CAP_H - 54);
      panelHeading(o, b, palette, fonts, { x: x + 32, y: y + 38, w: colW - 64, headMax: 48, headH: lsTextOnlyHeadH });
      captionBar(o, b, palette, fonts, { x: x + 26, y: y + rowH - CAP_H - 20, w: colW - 52, h: CAP_H });
    }
  });

  ctaBar(o, content.callToAction, palette, fonts, W, 1270);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [pvBars({ x: pv(88), y: pv(110), w: pv(1238), lines: 2, barH: 8, gap: 5, fill: palette.dark })];
  // establishing panel
  parts.push(pvRect(pv(88), pv(480), pv(1238), pv(560), '#FFFFFF', { rx: 3, stroke: palette.dark }));
  parts.push(pvSlot(pv(120), pv(512), pv(1174), pv(302), palette.dark));
  parts.push(pvRect(pv(124), pv(834), pv(500), 7, palette.dark, { rx: 3 }));
  parts.push(pvRect(pv(120), pv(920), pv(1174), pv(96), DARK_PANEL, { rx: 4 }));
  // action grid 2x2
  const colW = 603;
  for (let i = 0; i < 3; i++) {
    const x = 88 + (i % 2) * 635;
    const y = 1088 + Math.floor(i / 2) * 375;
    if (i === 2) parts.push(pvPoly([
      { x: pv(x + colW - 56), y: pv(y + 20) }, { x: pv(x + colW + 20), y: pv(y + 56) },
      { x: pv(x + colW - 56), y: pv(y + 92) }, { x: pv(x + colW - 132), y: pv(y + 56) }
    ], palette.accent, { opacity: 0.14 }));
    parts.push(pvRect(pv(x), pv(y), pv(colW), pv(344), '#FFFFFF', { rx: 3, stroke: palette.dark }));
    parts.push(pvSlot(pv(x + 28), pv(y + 28), pv(colW - 56), pv(152), palette.dark));
    parts.push(pvRect(pv(x + 32), pv(y + 198), pv(280), 6, palette.dark, { rx: 3 }));
    parts.push(pvRect(pv(x + 28), pv(y + 344 - 118), pv(colW - 56), pv(96), DARK_PANEL, { rx: 4 }));
  }
  parts.push(pvRect(0, pv(1856), 200, pv(144), DARK_PANEL));
  return svgWrapO(parts, palette.background, 'portrait');
}

function previewLandscape(palette) {
  const parts = [pvBars({ x: pv(88), y: pv(85), w: pv(1824), lines: 2, barH: 8, gap: 5, fill: palette.dark })];
  // establishing panel left half
  parts.push(pvRect(pv(88), pv(376), pv(904), pv(936), '#FFFFFF', { rx: 3, stroke: palette.dark }));
  parts.push(pvSlot(pv(124), pv(412), pv(832), pv(562), palette.dark));
  parts.push(pvRect(pv(128), pv(996), pv(420), 8, palette.dark, { rx: 4 }));
  parts.push(pvRect(pv(124), pv(1186), pv(832), pv(96), DARK_PANEL, { rx: 4 }));
  // action grid right half
  const colW = Math.round((2000 - 1040 - 88 - 28) / 2);
  for (let i = 0; i < 3; i++) {
    const x = 1040 + (i % 2) * (colW + 28);
    const y = 376 + Math.floor(i / 2) * 484;
    if (i === 2) parts.push(pvPoly([
      { x: pv(x + colW - 52), y: pv(y + 14) }, { x: pv(x + colW + 16), y: pv(y + 52) },
      { x: pv(x + colW - 52), y: pv(y + 90) }, { x: pv(x + colW - 120), y: pv(y + 52) }
    ], palette.accent, { opacity: 0.14 }));
    parts.push(pvRect(pv(x), pv(y), pv(colW), pv(456), '#FFFFFF', { rx: 3, stroke: palette.dark }));
    parts.push(pvSlot(pv(x + 26), pv(y + 26), pv(colW - 52), pv(210), palette.dark));
    parts.push(pvRect(pv(x + 30), pv(y + 254), pv(200), 6, palette.dark, { rx: 3 }));
    parts.push(pvRect(pv(x + 26), pv(y + 456 - 116), pv(colW - 52), pv(96), DARK_PANEL, { rx: 4 }));
  }
  parts.push(pvRect(0, pv(1270), PV_LAND_W, pv(144), DARK_PANEL));
  return svgWrapO(parts, palette.background, 'landscape');
}

export default {
  id: 'comic-saga',
  name: 'Comic saga',
  style: 'comic',
  description: 'A graphic-novel spread — a large cinematic establishing panel over a grid of action panels, each with a bold heading and a caption bar, and a subtle accent burst on the finale. Establishing-over-grid in portrait, a filmstrip with the establishing panel filling the left half in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'panels', min: 4, max: 5, fields: ['heading', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    // The manifest contract caps the declared imageSlots hint at 0..3, so the
    // schema advertises 3 to the content agent; the template itself lays out
    // FOUR honest dashed image slots (slot-1..slot-4 — establishing + 3 action
    // panels), which the batch-d contract test verifies directly.
    backgroundSlots: 1,
    imageSlots: 3
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
