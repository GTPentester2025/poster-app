// lib/export/pptx.js — native (editable) PPTX deck builder. Takes a `design`
// (portrait canvas + optional design.landscape.canvas + optional translations
// map) and drives PptxGenJS to emit ONE slide per orientation, plus one slide
// per translation-variant canvas. Every slide is built from
// lib/export/canvas_to_pptx_spec.js, so text stays REAL editable text.
//
// The actual PptxGenJS calls are ISOLATED behind a dependency-injected `PptxGenJS`
// ctor + a small emit shim, and `planDeck()` — which decides WHICH canvases
// become slides — is a pure function. That split lets tests assert slide count
// and per-slide specs without loading the (browser-only) vendored library.
//
// Slide size: PPTX forces ONE slide size per file, so a deck can only mix sizes
// by giving each slide its own layout name. PptxGenJS supports exactly one
// active layout per presentation; we therefore group by orientation into
// SEPARATE presentations when both orientations are requested and let the
// caller emit each. The default single-orientation deck defines the layout from
// the first slide's canvas and reuses it for that orientation's variants (all
// same-orientation canvases share dims by the design contract).

import { canvasToPptxSpec } from './canvas_to_pptx_spec.js';

/** Pull the canvas for an orientation from a design object. */
function canvasFor(design, orientation) {
  if (!design) return null;
  if (orientation === 'landscape') {
    return (design.landscape && design.landscape.canvas) || design.landscapeCanvas || null;
  }
  return design.canvas || null;
}

/** Pull a translation variant's canvas for an orientation. */
function variantCanvasFor(variant, orientation) {
  if (!variant) return null;
  if (orientation === 'landscape') return variant.landscapeCanvas || (variant.landscape && variant.landscape.canvas) || null;
  return variant.canvas || null;
}

/**
 * planDeck(design, opts) → an ORDERED list of slide descriptors:
 *   { orientation, lang, canvas }
 * PURE. Drives both the slide count and their order. Options:
 *   orientations        ['portrait','landscape'] (default ['portrait'])
 *   includeTranslations include every translation variant canvas (default false)
 * A missing canvas for an orientation is skipped (never a blank slide).
 */
export function planDeck(design, opts = {}) {
  const orientations = Array.isArray(opts.orientations) && opts.orientations.length
    ? opts.orientations
    : ['portrait'];
  const translations = opts.includeTranslations && design && design.translations
    ? design.translations
    : null;

  const slides = [];
  for (const orientation of orientations) {
    const base = canvasFor(design, orientation);
    if (base) slides.push({ orientation, lang: 'en', canvas: base });
    if (translations) {
      // stable order: sort language keys so decks are deterministic
      for (const lang of Object.keys(translations).sort()) {
        const vc = variantCanvasFor(translations[lang], orientation);
        if (vc) slides.push({ orientation, lang, canvas: vc });
      }
    }
  }
  return slides;
}

/**
 * buildDeckSpec(design, opts) → PURE, fully serializable deck plan:
 *   { slides: [ { orientation, lang, spec } ], slideCount }
 * `spec` is the canvasToPptxSpec output for that slide. This is the unit under
 * test — no PptxGenJS needed.
 */
export function buildDeckSpec(design, opts = {}) {
  const bleed = opts.bleed ? BLEED_IN : 0;
  const slides = planDeck(design, opts).map(({ orientation, lang, canvas }, i) => ({
    orientation,
    lang,
    spec: canvasToPptxSpec(canvas, { layoutName: `POSTER_${orientation}`.toUpperCase(), bleed })
  }));
  return { slides, slideCount: slides.length };
}

const BLEED_IN = 0.125; // 1/8in standard print bleed

/**
 * Apply one spec's items onto a PptxGenJS slide. `resolveImage` (async, may be
 * undefined) turns an image item's src into a base64 data URI when it is not
 * already inline (server refs). cropMarks draws thin registration marks at the
 * four bleed corners when requested.
 */
async function paintSlide(slide, spec, { resolveImage, cropMarks, bleed } = {}) {
  if (spec.background) slide.background = { color: spec.background };
  for (const item of spec.items) {
    if (item.kind === 'text') {
      slide.addText(item.text, item.options);
    } else if (item.kind === 'shape') {
      slide.addShape(item.shapeType, item.options);
    } else if (item.kind === 'image') {
      if (item.data) {
        slide.addImage({ data: item.data, ...item.options });
      } else if (item.path && resolveImage) {
        const data = await resolveImage(item.src || item.path);
        if (data) slide.addImage({ data, ...item.options });
      } else if (item.path) {
        slide.addImage({ path: item.path, ...item.options });
      }
    }
  }
  if (cropMarks && bleed) drawCropMarks(slide, spec.size, bleed);
}

/** Thin L-shaped crop marks just inside each bleed corner (print trim guide). */
function drawCropMarks(slide, size, bleed) {
  const { wIn, hIn } = size;
  const len = 0.2;
  const marks = [
    // top-left
    { x: 0, y: bleed, w: bleed, h: 0 }, { x: bleed, y: 0, w: 0, h: bleed },
    // top-right
    { x: wIn - bleed, y: bleed, w: bleed, h: 0 }, { x: wIn - bleed, y: 0, w: 0, h: bleed },
    // bottom-left
    { x: 0, y: hIn - bleed, w: bleed, h: 0 }, { x: bleed, y: hIn - bleed, w: 0, h: bleed },
    // bottom-right
    { x: wIn - bleed, y: hIn - bleed, w: bleed, h: 0 }, { x: wIn - bleed, y: hIn - bleed, w: 0, h: bleed }
  ];
  for (const m of marks) {
    slide.addShape('line', { ...m, line: { color: '000000', width: 0.5 } });
  }
  void len;
}

/**
 * buildPptx(design, opts) → an object of { orientation → PptxGenJS instance }.
 * Each orientation is its OWN presentation (one slide size per file). Callers
 * emit each (browser: `await pptx.write({outputType:'blob'})`).
 *
 * opts:
 *   PptxGenJS         REQUIRED ctor (browser: window.PptxGenJS). Injected so
 *                     spec-building stays library-free and unit-testable.
 *   orientations, includeTranslations, bleed, cropMarks  (see planDeck/opts)
 *   resolveImage      async (src) → base64 data URI for server image refs
 *
 * Returns { presentations: { portrait?, landscape? }, slideCount }.
 */
export async function buildPptx(design, opts = {}) {
  const PptxGenJS = opts.PptxGenJS;
  if (typeof PptxGenJS !== 'function') {
    throw new Error('buildPptx requires opts.PptxGenJS (the PptxGenJS constructor)');
  }
  const bleed = opts.bleed ? BLEED_IN : 0;
  const { slides } = buildDeckSpec(design, opts);

  const presentations = {};
  for (const { orientation, spec } of slides) {
    let pptx = presentations[orientation];
    if (!pptx) {
      pptx = new PptxGenJS();
      const layout = spec.layout;
      pptx.defineLayout({ name: layout.name, width: layout.width, height: layout.height });
      pptx.layout = layout.name;
      presentations[orientation] = pptx;
    }
    const slide = pptx.addSlide();
    await paintSlide(slide, spec, { resolveImage: opts.resolveImage, cropMarks: opts.cropMarks, bleed });
  }
  return { presentations, slideCount: slides.length };
}

export default buildPptx;
