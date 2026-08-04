// PNG export planning. Rasterization itself happens where a real canvas lives
// (the browser: a Fabric StaticCanvas → toDataURL at `scale`), so this module
// stays a PURE, dependency-free, testable planner: it decides WHICH canvases
// render, at what pixel size, and in what order. The browser export wiring
// feeds each plan entry's canvas JSON to Fabric and calls toDataURL — no Node
// image lib, no new deps.

import { planDeck } from './pptx.js';

export const DEFAULT_SCALE = 2; // 2× → crisp at print/retina without huge files

/**
 * buildPngPlan(design, opts) → PURE:
 *   { images: [ { orientation, lang, widthPx, heightPx, scale, canvas } ], count }
 * One entry per orientation (default portrait) and, when includeTranslations,
 * per translation variant — same slide set as the PPTX deck so exports agree.
 * Options: orientations, includeTranslations, scale (default 2).
 */
export function buildPngPlan(design, opts = {}) {
  const scale = Number.isFinite(opts.scale) && opts.scale > 0 ? opts.scale : DEFAULT_SCALE;
  const images = planDeck(design, opts).map(({ orientation, lang, canvas }) => ({
    orientation,
    lang,
    widthPx: Math.round((canvas.width || 0) * scale),
    heightPx: Math.round((canvas.height || 0) * scale),
    scale,
    canvas
  }));
  return { images, count: images.length };
}

/**
 * Browser helper (only runs where Fabric + document exist). Renders one plan
 * entry's canvas JSON to a PNG data URL at the entry's scale. Kept here so the
 * UI wiring is a one-liner; guarded so importing this module in Node is safe.
 * @param {object} entry  a buildPngPlan().images[i]
 * @param {Function} FabricStaticCanvas  fabric.StaticCanvas ctor
 * @returns {Promise<string>} data:image/png;base64,...
 */
export async function renderEntryToPng(entry, FabricStaticCanvas) {
  if (typeof document === 'undefined' || typeof FabricStaticCanvas !== 'function') {
    throw new Error('renderEntryToPng requires a browser + fabric.StaticCanvas');
  }
  const el = document.createElement('canvas');
  el.width = entry.canvas.width;
  el.height = entry.canvas.height;
  const fc = new FabricStaticCanvas(el, { enableRetinaScaling: false });
  await new Promise((resolve) => fc.loadFromJSON(entry.canvas, resolve));
  fc.renderAll();
  return fc.toDataURL({ format: 'png', multiplier: entry.scale });
}

export default buildPngPlan;
