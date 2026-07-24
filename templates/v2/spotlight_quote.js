// v2 template — spotlight-quote (style: statement). A CINEMATIC dark pull-quote
// poster. A big duotone hero image slot dominates one side/top (full-bleed) with
// a palette.primary→transparent gradient wash laid over it for a duotone feel;
// a giant oversized quotation-mark glyph (a Polygon motif, opacity <= 0.2) sits
// behind the quote. The single statement TEXT is the hero pull-quote in DARK_INK,
// very large, with a palette.primary accent bar to its left. The headline is a
// kicker/masthead above the quote, the subheadline sits below it. lightBeams +
// softGlow rake the quote like a raking stage light. Portrait: image top third,
// quote dominating the middle, cta bottom. Landscape is a REAL relayout — the
// full-bleed image owns the LEFT half, quote + headline own the RIGHT half, and
// a DARK_PANEL cta bar (palette.primary text) runs across the bottom. Dark
// template: near-black base, light ink, brand color reserved for accents + glow.

import {
  textbox, rect, vline, imageSlot, backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvCircle, pvPoly, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, linearGradientFill, gradientWash,
  lightBeams, softGlow, svgWrapO, PV_LAND_W, legibilityScrim,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM
} from './decor.js';

// A giant open-quote glyph as a filled Polygon (two stacked comma-blobs), used
// purely as ghost decor behind the pull-quote. Returns ONE Polygon (opacity
// capped in (0,0.2]). (x,y) is the glyph's top-left; s scales it.
function quoteGlyph({ x, y, s, color, opacity = 0.12 }) {
  const u = s / 100;
  // one comma tail: a rounded wedge. Two of them side by side read as a 66/99.
  const comma = (ox) => [
    { x: x + ox + 6 * u, y: y },
    { x: x + ox + 44 * u, y: y },
    { x: x + ox + 44 * u, y: y + 44 * u },
    { x: x + ox + 30 * u, y: y + 78 * u },
    { x: x + ox + 4 * u, y: y + 78 * u },
    { x: x + ox + 20 * u, y: y + 44 * u },
    { x: x + ox, y: y + 44 * u },
    { x: x + ox, y: y + 12 * u }
  ];
  return [...comma(0), ...comma(52 * u)];
}

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 144, fill: DARK_PANEL, layerRole: 'background', opacity: 1 }));
  const size = fitFontSize(text, { width: W - 180, height: 96, maxSize: 44, minSize: 30 });
  o.push(textbox({
    text, x: 90, y: y + Math.round((144 - estTextHeight(text, size, W - 180)) / 2),
    w: W - 180, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: DARK_PANEL
  }));
}

/** Headline kicker/masthead above the quote (uppercase-feel heading face). */
function headlineZone(o, content, palette, fonts, { x, y, w, maxSize, headMaxH = 300, align = 'left' }) {
  const headSize = fitFontSize(content.headline, { width: w, height: headMaxH, maxSize, minSize: 80 });
  o.push(textbox({
    text: content.headline, x, y, w, fontSize: headSize, lineHeight: 1.04,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align,
    charSpacing: 20, layerRole: 'headline', bgRef: DARK_BASE
  }));
  return y + estTextHeight(content.headline, headSize, w) + 24;
}

/**
 * The hero pull-quote: a giant quotation-mark glyph ghosted behind, a
 * palette.primary accent bar to its left, and the statement TEXT (fieldRef
 * 'text') set very large in DARK_INK. Returns the y just below the quote.
 */
function pullQuote(o, b, palette, fonts, { x, w, y, budgetH, maxSize, align = 'left' }) {
  // giant ghost quotation glyph behind the quote (decor, opacity <= 0.2)
  o.push({
    ...({
      type: 'Polygon',
      points: quoteGlyph({ x, y: y - 20, s: 210, color: palette.primary }),
      left: x, top: y - 20, width: 1, height: 1,
      fill: palette.primary, opacity: 0.12, layerRole: 'decor'
    })
  });

  const quoteX = align === 'left' ? x + 70 : x;
  const quoteW = align === 'left' ? w - 70 : w;
  const size = fitFontSize(b.text, { width: quoteW, height: budgetH, maxSize, minSize: 38 });
  const textH = Math.round(estTextHeight(b.text, size, quoteW));
  const quoteY = y + 96;

  // palette.primary accent bar to the LEFT of the quote
  if (align === 'left') {
    o.push(vline({ x, y: quoteY, h: Math.min(budgetH, textH), thickness: 14, fill: palette.primary, layerRole: 'decor' }));
  }

  o.push({
    ...textbox({
      text: b.text, x: quoteX, y: quoteY, w: quoteW, fontSize: size, lineHeight: 1.1,
      fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align,
      layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
    }),
    fieldRef: 'text'
  });

  return quoteY + textH + 30;
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of a cinematic dark spotlight haze with volumetric light and faint neon particles, deep near-black, cyan and gold glow, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // ── hero image: full-bleed top third, with a duotone primary→transparent wash
  const imgH = 700;
  o.push(imageSlot({
    slotId: 'slot-1', x: 0, y: 0, w: W, h: imgH,
    styleHint: 'cinematic duotone portrait of a focused professional, dramatic side light, flat vector, no text',
    stroke: palette.primary, rx: 0
  }));
  // duotone wash over the image (translucent decor)
  o.push(rect({
    x: 0, y: 0, w: W, h: imgH,
    fill: linearGradientFill({ x1: 0, y1: 0, x2: 0, y2: imgH, stops: [{ offset: 0, color: palette.primary }, { offset: 1, color: DARK_BASE }] }),
    opacity: 0.2, layerRole: 'decor'
  }));

  // atmosphere: gradient wash + raking beams + a spotlight pooled over the quote
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'diagonal', intensity: 0.85 }));
  o.push(...lightBeams({ w: W, h: H, color: palette.primary, count: 3, angle: 22, intensity: 0.55 }));
  o.push(...softGlow({ x: 700, y: 1180, r: 520, color: palette.primary, intensity: 1 }));

  // headline kicker over the image band
  headlineZone(o, content, palette, fonts, { x: 90, y: 520, w: 1234, maxSize: 96 });

  const b = (content.blocks || [])[0];
  let cursor = 900;
  if (b) {
    cursor = pullQuote(o, b, palette, fonts, { x: 120, w: 1180, y: 880, budgetH: 720, maxSize: 150, align: 'left' });
  }

  // subheadline below the quote
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: 1110, height: 120, maxSize: 42, minSize: 28, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x: 190, y: Math.min(cursor + 10, 1680),
      w: 1110, fontSize: subSize, fontFamily: fonts.body, fontWeight: '600',
      lineHeight: 1.35, fill: DARK_INK_DIM, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
  }

  // second foreground image: a small cinematic inset in the empty right margin
  // below the hero band and above the CTA (clears quote/subheadline/cta/slot-1)
  o.push(imageSlot({ slotId: 'slot-2', x: 1130, y: 760, w: 240, h: 240, styleHint: 'small cinematic high-tech inset illustration, flat vector, no text', stroke: palette.primary }));

  ctaBar(o, content.callToAction, palette, fonts, W, H - 144);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'full-bleed futuristic ambient background of a cinematic dark spotlight haze with volumetric light and faint neon particles, deep near-black, cyan and gold glow, edge-to-edge, flat vector, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // ── REAL relayout: full-bleed image LEFT half, quote + headline RIGHT half
  const imgW = 900;
  const ctaY = H - 144;
  o.push(imageSlot({
    slotId: 'slot-1', x: 0, y: 0, w: imgW, h: ctaY,
    styleHint: 'cinematic duotone portrait of a focused professional, dramatic side light, flat vector, no text',
    stroke: palette.primary, rx: 0
  }));
  // duotone wash over the left image column (translucent decor)
  o.push(rect({
    x: 0, y: 0, w: imgW, h: ctaY,
    fill: linearGradientFill({ x1: 0, y1: 0, x2: imgW, y2: 0, stops: [{ offset: 0, color: palette.primary }, { offset: 1, color: DARK_BASE }] }),
    opacity: 0.2, layerRole: 'decor'
  }));

  // atmosphere across the whole frame; spotlight pooled over the right-half quote
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'horizontal', intensity: 0.85 }));
  o.push(...lightBeams({ w: W, h: H, color: palette.primary, count: 3, angle: 20, intensity: 0.55 }));
  o.push(...softGlow({ x: 1480, y: 720, r: 440, color: palette.primary, intensity: 1 }));

  const rx = imgW + 90;
  const rw = W - rx - 90;

  // headline kicker on the right — slot-2 at y=300 limits avail to 300-110-8=182
  headlineZone(o, content, palette, fonts, { x: rx, y: 110, w: rw, maxSize: 88, headMaxH: 172 });

  const b = (content.blocks || [])[0];
  let cursor = 460;
  if (b) {
    cursor = pullQuote(o, b, palette, fonts, { x: rx, w: rw, y: 440, budgetH: 620, maxSize: 128, align: 'left' });
  }

  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: rw - 70, height: 120, maxSize: 40, minSize: 28, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x: rx + 70, y: Math.min(cursor + 10, 1120),
      w: rw - 70, fontSize: subSize, fontFamily: fonts.body, fontWeight: '600',
      lineHeight: 1.35, fill: DARK_INK_DIM, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
  }

  // second foreground image: a small cinematic inset tucked in the empty band
  // between the headline kicker and the pull-quote on the right column
  o.push(imageSlot({ slotId: 'slot-2', x: 1660, y: 300, w: 240, h: 120, styleHint: 'small cinematic high-tech inset illustration, flat vector, no text', stroke: palette.primary }));

  ctaBar(o, content.callToAction, palette, fonts, W, ctaY);
  return canvas;
}

// ── previews ─────────────────────────────────────────────────────────────────

function previewPortrait(palette) {
  const imgH = 700;
  const parts = [
    pvSlot(0, 0, 200, pv(imgH), palette.primary),
    pvRect(0, 0, 200, pv(imgH), palette.primary, { opacity: 0.18 }),
    pvCircle(pv(700), pv(1180), pv(520), palette.primary, { opacity: 0.1 }),
    // ghost quote glyph
    pvPoly(quoteGlyph({ x: 120, y: 860, s: 210, color: palette.primary }), palette.primary, { opacity: 0.12 }),
    pvBars({ x: pv(90), y: pv(520), w: pv(1234), lines: 2, barH: 9, gap: 6, fill: DARK_INK }),
    pvRect(pv(120), pv(976), 2.4, pv(560), palette.primary, { rx: 1 }),
    pvBars({ x: pv(190), y: pv(980), w: pv(1110), lines: 4, barH: 15, gap: 10, fill: DARK_INK }),
    pvBars({ x: pv(190), y: pv(1600), w: pv(1110), lines: 2, barH: 6, gap: 5, fill: DARK_INK_DIM }),
    pvRect(0, pv(2000 - 144), 200, pv(144), DARK_PANEL)
  ];
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const imgW = 900;
  const ctaY = 1414 - 144;
  const rx = imgW + 90;
  const rw = 2000 - rx - 90;
  const parts = [
    pvSlot(0, 0, pv(imgW), pv(ctaY), palette.primary),
    pvRect(0, 0, pv(imgW), pv(ctaY), palette.primary, { opacity: 0.18 }),
    pvCircle(pv(1480), pv(720), pv(440), palette.primary, { opacity: 0.1 }),
    pvPoly(quoteGlyph({ x: rx, y: 420, s: 210, color: palette.primary }), palette.primary, { opacity: 0.12 }),
    pvBars({ x: pv(rx), y: pv(110), w: pv(rw), lines: 2, barH: 9, gap: 6, fill: DARK_INK }),
    pvRect(pv(rx), pv(536), 2.4, pv(460), palette.primary, { rx: 1 }),
    pvBars({ x: pv(rx + 70), y: pv(540), w: pv(rw - 70), lines: 4, barH: 14, gap: 9, fill: DARK_INK }),
    pvBars({ x: pv(rx + 70), y: pv(1120), w: pv(rw - 70), lines: 2, barH: 6, gap: 5, fill: DARK_INK_DIM }),
    pvRect(0, pv(ctaY), PV_LAND_W, pv(144), DARK_PANEL)
  ];
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'spotlight-quote',
  name: 'Spotlight quote',
  style: 'statement',
  description: 'A cinematic dark pull-quote poster: a full-bleed duotone hero image (primary→transparent wash) owns one side while a giant ghost quotation glyph sits behind the statement — the hero quote set very large in light ink against a primary accent bar, headline kicker above and subheadline below, raked by light beams and a soft spotlight. Image top third with the quote dominating the middle in portrait; a real relayout puts the image on the left half and the quote on the right in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: true, maxWords: 16 },
    blocks: { kind: 'single', min: 1, max: 1, fields: ['text'] },
    callToAction: { required: true, maxWords: 10 },
    imageSlots: 2,
    backgroundSlots: 1,
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
