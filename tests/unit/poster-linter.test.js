// Poster linter: deterministic canvas QA — contrast + font-floor auto-fix,
// overflow/overlap reporting, whole-design lint, and the candidate score.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintCanvas, lintDesign, lintScore, MIN_FONT_PX } from '../../agents/poster_linter.js';
import { pickTextColor } from '../../templates/helpers.js';

function tb(over = {}) {
  return {
    type: 'Textbox', left: 100, top: 100, width: 600, text: 'Report suspicious emails',
    fontSize: 40, fontFamily: 'Inter', fontWeight: '600', fill: '#1F1A17',
    lineHeight: 1.2, layerRole: 'message', bgRef: '#FFFFFF', ...over
  };
}

function canvasWith(objects) {
  return { version: '6.7.1', width: 1414, height: 2000, background: '#FFFFFF', objects };
}

test('low-contrast text is repaired in place via pickTextColor', () => {
  const bad = tb({ fill: '#F0F0F0', bgRef: '#FFFFFF' }); // near-white on white
  const c = canvasWith([bad]);
  const { fixes, violations } = lintCanvas(c);
  assert.equal(fixes.length, 1);
  assert.equal(fixes[0].kind, 'contrast');
  assert.equal(bad.fill, pickTextColor('#FFFFFF'), 'fill flipped to the readable color');
  assert.equal(violations.length, 0);
});

test('large bold text uses the 3:1 threshold', () => {
  // #767676 on white is ~4.54:1 — passes normal AND large; use a hue at ~3.6:1
  // (#8A8A8A ≈ 3.5:1): fails 4.5 normal, passes 3.0 large-bold.
  const normal = tb({ fill: '#8A8A8A', fontSize: 20 });
  const large = tb({ fill: '#8A8A8A', fontSize: 40, fontWeight: '800', top: 600 });
  const { fixes } = lintCanvas(canvasWith([normal, large]));
  assert.equal(fixes.length, 1, 'only the normal-size text is repaired');
  assert.equal(large.fill, '#8A8A8A', 'large bold untouched');
});

test('sub-floor font sizes are raised to the minimum', () => {
  const tiny = tb({ fontSize: 9 });
  const { fixes } = lintCanvas(canvasWith([tiny]));
  assert.ok(fixes.some((f) => f.kind === 'min-font'));
  assert.equal(tiny.fontSize, MIN_FONT_PX);
});

test('overflow + cross-block overlap are reported, same-block label/text pair is not', () => {
  const off = tb({ left: 1300, width: 600 }); // right edge 1900 > 1414
  const a = tb({ top: 500, msgId: 'blk-1' });
  const b = tb({ top: 510, msgId: 'blk-2' }); // heavy overlap, different blocks
  const label = tb({ top: 900, msgId: 'blk-3', layerRole: 'message-label' });
  const text = tb({ top: 905, msgId: 'blk-3' }); // same block — tolerated
  const { violations } = lintCanvas(canvasWith([off, a, b, label, text]));
  assert.ok(violations.some((v) => v.kind === 'overflow'));
  assert.ok(violations.some((v) => v.kind === 'overlap' && v.role === 'message~message'));
  assert.ok(!violations.some((v) => v.kind === 'overlap' && v.role.includes('message-label')));
});

test('decor/scrim/background text-free objects are ignored', () => {
  const c = canvasWith([
    { type: 'Rect', left: 0, top: 0, width: 1414, height: 2000, fill: '#000000', layerRole: 'background' },
    tb()
  ]);
  const { fixes, violations } = lintCanvas(c);
  assert.equal(fixes.length + violations.length, 0);
});

test('lintDesign covers both orientations and scores the whole design', () => {
  const design = {
    canvas: canvasWith([tb({ fill: '#F0F0F0' })]),
    landscape: { canvas: { ...canvasWith([tb({ left: 1900, width: 400 })]), width: 2000, height: 1414 } }
  };
  const lint = lintDesign(design);
  assert.equal(lint.orientations.portrait.fixes, 1);
  assert.equal(lint.orientations.landscape.violations, 1);
  assert.equal(lint.violations[0].orientation, 'landscape');
  assert.equal(lint.score, 100 - 15 - 2);
});

test('lintScore: clean=100, floors at 0', () => {
  assert.equal(lintScore({ fixes: [], violations: [] }), 100);
  assert.equal(lintScore({ fixes: [], violations: new Array(10).fill({}) }), 0);
});
