// v2 template — ticker-tape (style: bullet). A terminal / stock-ticker readout
// on near-black: scanlines() lay a CRT texture across the whole canvas, a top
// "status bar" (DARK_PANEL strip) carries the headline as a terminal title with
// a status glyph and a blinking-cursor block, and each sequence block is a
// "ticker row" — a leading primary prompt glyph (▸ drawn as a Polygon), an
// uppercase LABEL in palette.primary (like a ticker symbol) and the block TEXT
// in DARK_INK (>=38px, the headline crawl) on a DARK_PANEL row band under a thin
// primary underline. Rows stack like a live feed. Portrait: full-width stacked
// ticker rows. Landscape is a REAL relayout — a left status sidebar (headline +
// prompt) with the feed rows spread across two columns on the right. CTA bar
// (DARK_PANEL) bottom, palette.primary text. Dark template: near-black base,
// light ink, brand color reserved for the prompt/label/underline accents.

import {
  textbox, rect, polygon,
  fitFontSize, estTextHeight, backgroundImageSlot,
  pv, pvRect, pvPoly, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, scanlines, meshGlow, svgWrapO, legibilityScrim,
  PV_LAND_W, DARK_BASE, DARK_PANEL, DARK_PANEL_2, DARK_INK, DARK_INK_DIM
} from './decor.js';

// A small right-pointing "prompt" triangle (▸) drawn as a Polygon — shapes may
// rotate/point; text never does. (x, y) is the glyph's top-left; s its size.
function promptGlyph(x, y, s, color, msgId = null) {
  return polygon([
    { x, y },
    { x: x + s, y: y + s / 2 },
    { x, y: y + s }
  ], { fill: color, layerRole: 'decor', msgId });
}

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_PANEL, layerRole: 'background', opacity: 1 }));
  // a leading prompt glyph on the CTA, terminal-command style
  o.push(promptGlyph(70, y + 56, 32, palette.primary));
  const size = fitFontSize(text, { width: W - 260, height: 96, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text, x: 130, y: y + Math.round((144 - estTextHeight(text, size, W - 260)) / 2),
    w: W - 260, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'left', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

/**
 * The top status bar: a raised DARK_PANEL strip carrying the headline as a
 * terminal title, a small primary status glyph on the left and a blinking-
 * cursor block on the right. Returns the y just below the bar.
 */
function statusBar(o, content, palette, fonts, { x, y, w, h, maxSize, align = 'left' }) {
  o.push(rect({ x, y, w, h, fill: DARK_PANEL, rx: 14, layerRole: 'background', opacity: 1 }));
  // primary status glyph (a small prompt triangle) + a hairline under-rule
  o.push(promptGlyph(x + 34, y + Math.round(h / 2 - 22), 40, palette.primary));
  o.push(rect({ x: x + 34, y: y + h - 20, w: w - 68, h: 5, fill: palette.primary, rx: 2, opacity: 0.18, layerRole: 'decor' }));

  const textX = x + 100;
  const textW = w - 100 - 70;
  const headSize = fitFontSize(content.headline, { width: textW, height: h - 48, maxSize, minSize: 40 });
  o.push(textbox({
    text: content.headline, x: textX,
    y: y + Math.round((h - estTextHeight(content.headline, headSize, textW)) / 2) - 6,
    w: textW, fontSize: headSize, fontFamily: fonts.head, fontWeight: '900',
    fill: DARK_INK, align, layerRole: 'headline', bgRef: DARK_PANEL
  }));
  // blinking-cursor block on the right edge of the bar
  o.push(rect({ x: x + w - 54, y: y + Math.round(h / 2 - 26), w: 26, h: 52, fill: palette.primary, opacity: 0.16, layerRole: 'decor' }));
  return y + h;
}

/**
 * One ticker row (a live-feed line): DARK_PANEL band, a leading primary prompt
 * glyph, the uppercase LABEL (fieldRef 'label', palette.primary — the ticker
 * symbol), the block TEXT (fieldRef 'text', DARK_INK >=38px — the crawl), and a
 * thin primary underline at the band's foot. Both fields bind msgId + fieldRef.
 */
function tickerRow(o, b, palette, fonts, { x, y, w, h, alt = false }) {
  o.push(rect({
    x, y, w, h, fill: alt ? DARK_PANEL_2 : DARK_PANEL, rx: 12,
    layerRole: 'background', msgId: b.id, opacity: 1
  }));
  // leading prompt glyph (a shape — may point; carries the block msgId)
  const glyphS = 34;
  o.push(promptGlyph(x + 30, y + Math.round(h / 2 - glyphS / 2), glyphS, palette.primary, b.id));

  const padL = x + 92;
  const innerW = x + w - padL - 40;

  // uppercase LABEL — the ticker symbol (palette.primary). Short field: exempt
  // from the 38px floor, so a compact symbol reads tight. bodyY at y+68 → label
  // avail = 68-22-8 = 38px; cap budget to 36 so label never overruns into body.
  const labelSize = fitFontSize(String(b.label).toUpperCase(), { width: innerW, height: 36, maxSize: 28, minSize: 10, lineHeight: 1 });
  o.push({
    ...textbox({
      text: String(b.label).toUpperCase(), x: padL, y: y + 22, w: innerW, fontSize: labelSize,
      fontFamily: fonts.head, fontWeight: '800', fill: palette.primary, align: 'left',
      charSpacing: 90, lineHeight: 1, layerRole: 'message', msgId: b.id, bgRef: alt ? DARK_PANEL_2 : DARK_PANEL
    }),
    fieldRef: 'label'
  });

  // block TEXT — the headline crawl (DARK_INK, >=38px)
  const bodyY = y + 68;
  const bodyH = h - (bodyY - y) - 26;
  const size = fitFontSize(b.text, { width: innerW, height: Math.max(76, bodyH), maxSize: 46, minSize: 20 });
  o.push({
    ...textbox({
      text: b.text, x: padL, y: bodyY, w: innerW, fontSize: size,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK, align: 'left',
      layerRole: 'message', msgId: b.id, bgRef: alt ? DARK_PANEL_2 : DARK_PANEL
    }),
    fieldRef: 'text'
  });

  // thin primary underline at the band's foot (the ticker rule)
  o.push(rect({ x: x + 30, y: y + h - 12, w: w - 60, h: 5, fill: palette.primary, rx: 2, opacity: 0.16, layerRole: 'decor' }));
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of a dark CRT terminal data-stream backdrop with faint scanlines and glowing code rain, deep near-black, cyan and gold glow, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  const blocks = content.blocks || [];

  // atmosphere: a faint primary/accent mesh bloom …
  o.push(...meshGlow({
    spots: [
      { x: 180, y: 260, r: 420, color: palette.primary },
      { x: W - 160, y: 1580, r: 440, color: palette.accent }
    ],
    intensity: 0.85
  }));
  // … and CRT scanlines across the whole canvas (the ticker texture)
  o.push(...scanlines({ x: 0, y: 0, w: W, h: H, gap: 16, color: palette.primary, thickness: 2, intensity: 0.8 }));

  // top status bar carrying the headline as a terminal title
  let cursor = statusBar(o, content, palette, fonts, { x: 70, y: 96, w: W - 140, h: 300, maxSize: 108 });
  cursor += 40;

  // optional subheadline (terminal sub-title) beneath the status bar
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: W - 184, height: 120, maxSize: 40, minSize: 16, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x: 92, y: cursor, w: W - 184, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM, align: 'left',
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, W - 184, 1.35) + 30;
  }

  // stacked ticker rows filling the feed to just above the CTA bar
  const feedTop = cursor;
  const feedBottom = H - 144 - 40;
  const gap = 26;
  const n = Math.max(blocks.length, 1);
  const rowH = Math.round((feedBottom - feedTop - gap * (n - 1)) / n);
  blocks.forEach((b, i) => {
    const y = feedTop + i * (rowH + gap);
    tickerRow(o, b, palette, fonts, { x: 70, y, w: W - 140, h: rowH, alt: i % 2 === 1 });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, H - 144);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of a dark CRT terminal data-stream backdrop with faint scanlines and glowing code rain, deep near-black, cyan and gold glow, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  const blocks = content.blocks || [];

  // atmosphere: mesh bloom + full-canvas CRT scanlines
  o.push(...meshGlow({
    spots: [
      { x: 320, y: 320, r: 440, color: palette.primary },
      { x: W - 280, y: 1120, r: 460, color: palette.accent }
    ],
    intensity: 0.85
  }));
  o.push(...scanlines({ x: 0, y: 0, w: W, h: H, gap: 16, color: palette.primary, thickness: 2, intensity: 0.8 }));

  // REAL relayout: left status sidebar (headline title, full height) …
  const sidebarW = 640;
  const sbX = 70;
  o.push(rect({ x: sbX, y: 96, w: sidebarW, h: H - 96 - 144 - 40, fill: DARK_PANEL, rx: 16, layerRole: 'background', opacity: 1 }));
  o.push(promptGlyph(sbX + 40, 150, 44, palette.primary));
  o.push(rect({ x: sbX + 40, y: 210, w: sidebarW - 80, h: 5, fill: palette.primary, rx: 2, opacity: 0.18, layerRole: 'decor' }));

  const headW = sidebarW - 88;
  const headSize = fitFontSize(content.headline, { width: headW, height: 520, maxSize: 96, minSize: 40 });
  o.push(textbox({
    text: content.headline, x: sbX + 44, y: 250, w: headW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align: 'left',
    layerRole: 'headline', bgRef: DARK_PANEL
  }));
  let subCursor = 250 + estTextHeight(content.headline, headSize, headW) + 28;
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: headW, height: 200, maxSize: 40, minSize: 16, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x: sbX + 44, y: subCursor, w: headW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM, align: 'left',
      lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_PANEL
    }));
    subCursor += estTextHeight(content.subheadline, subSize, headW, 1.35) + 20;
  }
  // blinking-cursor block low in the sidebar
  o.push(rect({ x: sbX + 44, y: subCursor + 8, w: 30, h: 56, fill: palette.primary, opacity: 0.16, layerRole: 'decor' }));

  // … the feed rows in TWO columns on the right
  const feedX = sbX + sidebarW + 50;
  const feedRight = W - 70;
  const colGap = 40;
  const colW = Math.round((feedRight - feedX - colGap) / 2);
  const feedTop = 120;
  const feedBottom = H - 144 - 40;
  const n = Math.max(blocks.length, 1);
  const rows = Math.ceil(n / 2);
  const rowGap = 24;
  const rowH = Math.round((feedBottom - feedTop - rowGap * (rows - 1)) / rows);
  blocks.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = feedX + col * (colW + colGap);
    const y = feedTop + row * (rowH + rowGap);
    tickerRow(o, b, palette, fonts, { x, y, w: colW, h: rowH, alt: (col + row) % 2 === 1 });
  });

  ctaBar(o, content.callToAction, palette, fonts, W, H - 144);
  return canvas;
}

// ── previews ─────────────────────────────────────────────────────────────────

function pvScan(parts, palette, { w, h }) {
  for (let cy = 0; cy <= h; cy += 6) {
    parts.push(pvRect(0, cy, w, 0.6, palette.primary, { opacity: 0.12 }));
  }
}

function pvRow(parts, palette, { x, y, w, h, alt }) {
  parts.push(pvRect(pv(x), pv(y), pv(w), pv(h), alt ? DARK_PANEL_2 : DARK_PANEL, { rx: 3 }));
  parts.push(pvPoly([
    { x: pv(x + 30), y: pv(y + h / 2 - 17) },
    { x: pv(x + 64), y: pv(y + h / 2) },
    { x: pv(x + 30), y: pv(y + h / 2 + 17) }
  ], palette.primary));
  parts.push(pvRect(pv(x + 92), pv(y + 22), pv(w * 0.34), pv(30), palette.primary, { rx: 3 }));
  parts.push(pvBars({ x: pv(x + 92), y: pv(y + 70), w: pv(w * 0.72), lines: 2, barH: 4.5, gap: 3, fill: DARK_INK }));
  parts.push(pvRect(pv(x + 30), pv(y + h - 12), pv(w - 60), 1.4, palette.primary, { opacity: 0.5 }));
}

function previewPortrait(palette) {
  const W = 1414;
  const H = 2000;
  const parts = [
    pvCircleBloom(palette.primary, pv(180), pv(260), pv(420)),
    pvCircleBloom(palette.accent, pv(1254), pv(1580), pv(440))
  ];
  pvScan(parts, palette, { w: 200, h: 283 });
  // status bar with headline title bars
  parts.push(pvRect(pv(70), pv(96), pv(W - 140), pv(300), DARK_PANEL, { rx: 4 }));
  parts.push(pvPoly([
    { x: pv(104), y: pv(206) }, { x: pv(144), y: pv(226) }, { x: pv(104), y: pv(246) }
  ], palette.primary));
  parts.push(pvBars({ x: pv(170), y: pv(180), w: pv(W - 340), lines: 2, barH: 9, gap: 6, fill: DARK_INK }));
  parts.push(pvRect(pv(W - 124), pv(200), pv(26), pv(52), palette.primary, { opacity: 0.5 }));

  const feedTop = 470;
  const feedBottom = H - 144 - 40;
  const gap = 26;
  const n = 4;
  const rowH = Math.round((feedBottom - feedTop - gap * (n - 1)) / n);
  for (let i = 0; i < n; i++) {
    pvRow(parts, palette, { x: 70, y: feedTop + i * (rowH + gap), w: W - 140, h: rowH, alt: i % 2 === 1 });
  }
  // CTA bar
  parts.push(pvRect(0, pv(H - 144), 200, pv(144), DARK_PANEL));
  parts.push(pvRect(pv(130), pv(H - 92), pv(700), pv(40), palette.primary, { rx: 3 }));
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const W = 2000;
  const H = 1414;
  const parts = [
    pvCircleBloom(palette.primary, pv(320), pv(320), pv(440)),
    pvCircleBloom(palette.accent, pv(1720), pv(1120), pv(460))
  ];
  pvScan(parts, palette, { w: PV_LAND_W, h: 200 });

  const sidebarW = 640;
  const sbX = 70;
  parts.push(pvRect(pv(sbX), pv(96), pv(sidebarW), pv(H - 96 - 144 - 40), DARK_PANEL, { rx: 4 }));
  parts.push(pvPoly([
    { x: pv(sbX + 40), y: pv(150) }, { x: pv(sbX + 84), y: pv(172) }, { x: pv(sbX + 40), y: pv(194) }
  ], palette.primary));
  parts.push(pvBars({ x: pv(sbX + 44), y: pv(250), w: pv(sidebarW - 88), lines: 3, barH: 9, gap: 7, fill: DARK_INK }));

  const feedX = sbX + sidebarW + 50;
  const feedRight = W - 70;
  const colGap = 40;
  const colW = Math.round((feedRight - feedX - colGap) / 2);
  const feedTop = 120;
  const feedBottom = H - 144 - 40;
  const n = 4;
  const rows = Math.ceil(n / 2);
  const rowGap = 24;
  const rowH = Math.round((feedBottom - feedTop - rowGap * (rows - 1)) / rows);
  for (let i = 0; i < n; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    pvRow(parts, palette, {
      x: feedX + col * (colW + colGap), y: feedTop + row * (rowH + rowGap),
      w: colW, h: rowH, alt: (col + row) % 2 === 1
    });
  }
  parts.push(pvRect(0, pv(H - 144), PV_LAND_W, pv(144), DARK_PANEL));
  parts.push(pvRect(pv(130), pv(H - 92), pv(900), pv(40), palette.primary, { rx: 3 }));
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

// faint circular bloom for previews (SVG circle stand-in for the mesh glow)
function pvCircleBloom(color, cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="0.1"/>`;
}

export default {
  id: 'ticker-tape',
  name: 'Security ticker',
  style: 'bullet',
  description: 'A terminal / stock-ticker readout on near-black: CRT scanlines texture the canvas, a top status bar carries the headline as a terminal title with a blinking cursor, and each point is a ticker row — a primary prompt glyph, an uppercase symbol-style label and the body text on a charcoal band under a thin accent rule. Rows stack full-width in portrait; a left status sidebar with a two-column feed in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'sequence', min: 4, max: 6, fields: ['label', 'text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 0,
    backgroundSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
