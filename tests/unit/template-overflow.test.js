// tests/unit/template-overflow.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listTemplatesV2 } from '../../templates/v2/index.js';
import * as v2 from '../../templates/v2/index.js';
import { auditTemplate, auditAll } from '../../templates/v2/overflow_audit.js';
import { sampleContentFor } from '../../templates/v2/manifest_schema.js';
import { canvasDims } from '../../templates/v2/decor.js';

const ORIENTATIONS = ['portrait', 'landscape'];

// One assertion per template so the failure names each offender.
for (const t of listTemplatesV2()) {
  test(`v2 template "${t.id}" has no overflow/overlap under stress content`, () => {
    const v = auditTemplate(t.id);
    assert.equal(v.length, 0, v.map((x) => `${x.orientation} ${x.kind} ${x.role} ${x.detail}`).join(' | '));
  });
}

test('auditAll aggregates cleanly (zero total violations)', () => {
  assert.equal(auditAll().length, 0);
});

// ── test: backgroundSlots contract — every template must have backgroundSlots >= 1 ──

test('background contract: every template has backgroundSlots >= 1', () => {
  const templates = v2.listTemplatesV2();
  const violations = [];
  for (const entry of templates) {
    const bs = entry.contentSchema.backgroundSlots;
    if (!bs || bs < 1) {
      violations.push(`${entry.id}: backgroundSlots=${bs ?? 'undefined'} (expected >= 1)`);
    }
  }
  assert.deepEqual(violations, [], `Templates missing backgroundSlots >= 1:\n${violations.join('\n')}`);
});

// ── test: bg slot object present in canvas ────────────────────────────────────

test('background contract: templates with backgroundSlots=1 emit a bg image-slot as first object', () => {
  const templates = v2.listTemplatesV2();
  const violations = [];
  for (const entry of templates) {
    if (entry.contentSchema.backgroundSlots !== 1) continue;
    const content = sampleContentFor(entry.contentSchema);
    for (const orientation of ORIENTATIONS) {
      let canvas;
      try {
        canvas = v2.buildCanvas(entry.id, orientation, content);
      } catch (e) {
        violations.push(`${entry.id}/${orientation}: BUILD ERROR: ${e.message}`);
        continue;
      }
      const firstSlot = canvas.objects.find((o) => o.layerRole === 'image-slot' && o.slotId === 'bg');
      if (!firstSlot) {
        violations.push(`${entry.id}/${orientation}: backgroundSlots=1 but no image-slot with slotId='bg'`);
      } else {
        const { w, h } = canvasDims(orientation);
        // bg slot must be full-bleed
        if (firstSlot.left !== 0 || firstSlot.top !== 0) {
          violations.push(`${entry.id}/${orientation}: bg slot not at (0,0) — found (${firstSlot.left},${firstSlot.top})`);
        }
        if (firstSlot.width < w - 1 || firstSlot.height < h - 1) {
          violations.push(`${entry.id}/${orientation}: bg slot not full-bleed (${firstSlot.width}×${firstSlot.height}, expected ${w}×${h})`);
        }
      }
      // must also have a scrim
      const hasScrim = canvas.objects.some((o) => o.layerRole === 'scrim');
      if (!hasScrim) {
        violations.push(`${entry.id}/${orientation}: backgroundSlots=1 but no scrim object (layerRole='scrim')`);
      }
    }
  }
  assert.deepEqual(violations, [], `BG slot violations:\n${violations.join('\n')}`);
});
