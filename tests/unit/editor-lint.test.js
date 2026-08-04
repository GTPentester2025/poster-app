// Editor live-lint bridge tests (Phase O8). ui/js/editor_lint.js is a PURE,
// dual-loaded module (browser via <script type="module">; here imported
// directly). These tests pin the two things the editor relies on:
//   1. serializeForLint() flattens a fabric toObject() dump into the exact flat
//      canvas-JSON shape agents/poster_linter.js reads (scaleX/scaleY folded
//      into width/height; capitalized type preserved).
//   2. lintFabricSerialization() reproduces the SERVER linter's verdicts
//      (contrast auto-fix, min-font auto-fix, overflow/overlap reported) AND
//      tags every fix/violation with the source object index so the editor can
//      map it back onto the live fabric object.
//
// The server linter (agents/poster_linter.js) is imported too, so a drift
// between the browser twin and the server module fails the build.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeForLint, lintCanvas, lintFabricSerialization, contrastRatio, MIN_FONT_PX
} from '../../ui/js/editor_lint.js';
import { lintCanvas as serverLintCanvas } from '../../agents/poster_linter.js';

const CANVAS_W = 1414;
const CANVAS_H = 2000;

/** A fabric-style serialized Textbox (as fc.toObject() would emit it). */
function fabricText(over = {}) {
  return {
    type: 'Textbox', left: 100, top: 100, width: 800, height: 120,
    scaleX: 1, scaleY: 1, fontSize: 48, fontWeight: '700',
    fill: '#1f1a17', bgRef: '#ffffff', layerRole: 'headline',
    text: 'Stay alert to phishing', lineHeight: 1.16, ...over
  };
}

test('serializeForLint folds fabric scale into width/height and keeps linter fields', () => {
  const serialized = { objects: [fabricText({ width: 400, height: 100, scaleX: 2, scaleY: 1.5 })] };
  const flat = serializeForLint(serialized, CANVAS_W, CANVAS_H);
  assert.equal(flat.width, CANVAS_W);
  assert.equal(flat.height, CANVAS_H);
  const o = flat.objects[0];
  assert.equal(o.type, 'Textbox');
  assert.equal(o.width, 800, 'width = 400 * scaleX(2)');
  assert.equal(o.height, 150, 'height = 100 * scaleY(1.5)');
  assert.equal(o.layerRole, 'headline');
  assert.equal(o.bgRef, '#ffffff');
  assert.equal(o._index, 0);
});

test('contrast violation is auto-fixed in place and reported as a fix with the object index', () => {
  // white text on white bg → 1:1, far below 4.5 → fixable via pickTextColor
  const serialized = { objects: [
    fabricText({ layerRole: 'subheadline', fontSize: 24, fontWeight: 'normal', fill: '#ffffff', bgRef: '#ffffff' })
  ] };
  const report = lintFabricSerialization(serialized, CANVAS_W, CANVAS_H);
  assert.equal(report.fixes.length, 1);
  const fix = report.fixes[0];
  assert.equal(fix.kind, 'contrast');
  assert.equal(fix.index, 0);
  assert.ok(/^#[0-9a-fA-F]{6}$/.test(fix.fill), 'fix carries a concrete hex fill to apply');
  // the fixed color must actually pass 4.5:1 on white
  assert.ok(contrastRatio(fix.fill, '#ffffff') >= 4.5);
});

test('min-font violation is auto-fixed to the floor with the object index', () => {
  const serialized = { objects: [
    fabricText({ layerRole: 'message', fontSize: 9, fill: '#000000', bgRef: '#ffffff' })
  ] };
  const report = lintFabricSerialization(serialized, CANVAS_W, CANVAS_H);
  const mf = report.fixes.find((f) => f.kind === 'min-font');
  assert.ok(mf, 'a min-font fix is emitted');
  assert.equal(mf.index, 0);
  assert.equal(mf.fontSize, MIN_FONT_PX);
});

test('overlap of two content boxes is reported (not fixed) with both indices', () => {
  const serialized = { objects: [
    fabricText({ layerRole: 'headline', msgId: 'a', left: 100, top: 100, width: 600, height: 400, fill: '#000', bgRef: '#fff' }),
    fabricText({ layerRole: 'subheadline', msgId: 'b', left: 120, top: 120, width: 600, height: 400, fill: '#000', bgRef: '#fff' })
  ] };
  const report = lintFabricSerialization(serialized, CANVAS_W, CANVAS_H);
  const ov = report.violations.find((v) => v.kind === 'overlap');
  assert.ok(ov, 'overlap reported');
  assert.equal(ov.index, 0);
  assert.equal(ov.index2, 1);
});

test('a clean canvas yields zero fixes and zero violations', () => {
  const serialized = { objects: [
    fabricText({ layerRole: 'headline', left: 100, top: 100, width: 800, height: 120, fontSize: 60, fontWeight: '700', fill: '#1f1a17', bgRef: '#ffffff', text: 'Clean headline' })
  ] };
  const report = lintFabricSerialization(serialized, CANVAS_W, CANVAS_H);
  assert.equal(report.fixes.length, 0);
  assert.equal(report.violations.length, 0);
});

test('browser twin matches the server linter verdict counts', () => {
  // Build a flat canvas both linters accept (server takes the flat shape too).
  const flat = {
    width: CANVAS_W, height: CANVAS_H,
    objects: [
      { type: 'Textbox', layerRole: 'headline', left: 100, top: 100, width: 800, fontSize: 24, fontWeight: 'normal', fill: '#ffffff', bgRef: '#ffffff', text: 'Low contrast' },
      { type: 'Textbox', layerRole: 'message', left: 120, top: 120, width: 600, fontSize: 8, fill: '#000000', bgRef: '#ffffff', text: 'Tiny text sample here' }
    ]
  };
  // clone per linter (both mutate in place)
  const a = structuredClone(flat);
  const b = structuredClone(flat);
  const mine = lintCanvas(a);
  const server = serverLintCanvas(b);
  assert.equal(mine.fixes.length, server.fixes.length, 'same fix count as server');
  assert.equal(mine.violations.length, server.violations.length, 'same violation count as server');
});
