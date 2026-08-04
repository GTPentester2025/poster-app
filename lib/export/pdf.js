// Print-ready PDF planning. Like png.js this is a PURE planner: it computes the
// page geometry a print pipeline needs (physical page size in inches, bleed,
// crop-mark flag, per-page source canvas) without pulling a PDF engine into the
// bundle. The browser export path renders each page's canvas to an image and
// lays it onto a jsPDF/print sheet; this module owns the deterministic math and
// page ordering so it is unit-testable in Node.

import { planDeck } from './pptx.js';
import { pxToIn } from './canvas_to_pptx_spec.js';

const BLEED_IN = 0.125; // standard 1/8in print bleed

/**
 * buildPdfPlan(design, opts) → PURE:
 *   { pages: [ { orientation, lang, trimWIn, trimHIn, pageWIn, pageHIn,
 *               bleedIn, cropMarks, canvas } ], count, bleed, cropMarks }
 * trim* = the finished poster size; page* = trim + bleed on all sides when
 * bleed is requested (page grows by 2×bleed each axis). Same slide set as the
 * PPTX/PNG exports. Options: orientations, includeTranslations, bleed, cropMarks.
 */
export function buildPdfPlan(design, opts = {}) {
  const bleed = opts.bleed ? BLEED_IN : 0;
  const cropMarks = Boolean(opts.cropMarks);
  const pages = planDeck(design, opts).map(({ orientation, lang, canvas }) => {
    const trimWIn = pxToIn(canvas.width || 0);
    const trimHIn = pxToIn(canvas.height || 0);
    return {
      orientation,
      lang,
      trimWIn,
      trimHIn,
      pageWIn: +(trimWIn + bleed * 2).toFixed(4),
      pageHIn: +(trimHIn + bleed * 2).toFixed(4),
      bleedIn: bleed,
      cropMarks,
      canvas
    };
  });
  return { pages, count: pages.length, bleed, cropMarks };
}

export default buildPdfPlan;
