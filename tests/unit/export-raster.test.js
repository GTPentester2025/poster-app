// PNG + PDF export planners: pure geometry + slide-set parity with the deck.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPngPlan, DEFAULT_SCALE } from '../../lib/export/png.js';
import { buildPdfPlan } from '../../lib/export/pdf.js';
import { pxToIn } from '../../lib/export/canvas_to_pptx_spec.js';

function design() {
  return {
    canvas: { width: 1414, height: 2000, background: '#FFFFFF', objects: [] },
    landscape: { canvas: { width: 2000, height: 1414, background: '#FFFFFF', objects: [] } },
    translations: {
      de: { canvas: { width: 1414, height: 2000, background: '#FFFFFF', objects: [] } },
      fr: { canvas: { width: 1414, height: 2000, background: '#FFFFFF', objects: [] } }
    }
  };
}

test('buildPngPlan: default portrait only, 2x scale, correct pixel size', () => {
  const { images, count } = buildPngPlan(design());
  assert.equal(count, 1);
  assert.equal(images[0].scale, DEFAULT_SCALE);
  assert.equal(images[0].widthPx, 1414 * DEFAULT_SCALE);
  assert.equal(images[0].heightPx, 2000 * DEFAULT_SCALE);
});

test('buildPngPlan: both orientations + translations = same slide set as deck', () => {
  const { count } = buildPngPlan(design(), { orientations: ['portrait', 'landscape'], includeTranslations: true, scale: 3 });
  // portrait: en+de+fr = 3 ; landscape: en = 1 (no landscape translation variants) → 4
  assert.equal(count, 4);
});

test('buildPdfPlan: trim size in inches at 96dpi; bleed grows the page by 2x bleed', () => {
  const noBleed = buildPdfPlan(design());
  assert.equal(noBleed.pages[0].trimWIn, pxToIn(1414));
  assert.equal(noBleed.pages[0].pageWIn, +pxToIn(1414).toFixed(4));

  const withBleed = buildPdfPlan(design(), { bleed: true, cropMarks: true });
  assert.equal(withBleed.bleed, 0.125);
  assert.equal(withBleed.cropMarks, true);
  assert.equal(withBleed.pages[0].pageWIn, +(pxToIn(1414) + 0.25).toFixed(4));
  assert.equal(withBleed.pages[0].pageHIn, +(pxToIn(2000) + 0.25).toFixed(4));
});

test('buildPdfPlan: page count matches selected orientations + translations', () => {
  const { count } = buildPdfPlan(design(), { orientations: ['portrait', 'landscape'], includeTranslations: true });
  assert.equal(count, 4);
});
