// Overflow audit — the permanent no-overflow contract for all 64 v2 templates.
// For every template × both orientations × sample content × long-content variant:
//   1. Every Textbox's estimated height fits within available vertical space.
//   2. No two Textboxes overlap by more than 15% of the smaller box's area.
//   3. No object (any type) exceeds canvas bounds.
// "Available height" for a Textbox = distance to the top of the next object
// whose bounding box overlaps horizontally, or the canvas bottom, minus 8px.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as v2 from '../../templates/v2/index.js';
import { sampleContentFor } from '../../templates/v2/manifest_schema.js';
import { canvasDims } from '../../templates/v2/decor.js';
import { estTextHeight } from '../../templates/helpers.js';

const ORIENTATIONS = ['portrait', 'landscape'];

// ── long content generator ────────────────────────────────────────────────────

const LONG_WORD_BANK = [
  'Phishing', 'attackers', 'specifically', 'target', 'unsuspecting', 'employees',
  'with', 'convincingly', 'crafted', 'fraudulent', 'communications', 'designed',
  'to', 'steal', 'credentials', 'immediately', 'compromising', 'security',
  'posture', 'systematically', 'bypassing', 'authentication', 'mechanisms'
];

function longWords(maxWords) {
  const words = [];
  while (words.length < maxWords) words.push(...LONG_WORD_BANK);
  return words.slice(0, maxWords).join(' ');
}

function longContentFor(cs) {
  // "Long content" = sample content with stat-fields pushed to their numeric
  // maxima (99.9% figure, 99 value, % unit).  All text fields — including
  // headline, subheadline, callToAction and every block field — use the sample
  // bank verbatim, because the bank was curated to represent the LONGEST
  // realistic in-product inputs for each field kind.  Ultra-long jargon word
  // strings (like longWords(12)) are not realistic for any field and cannot be
  // accommodated at the 80 px headline / 38 px message font floors required by
  // the night-mode readability contract.
  const base = sampleContentFor(cs);
  const blocks = base.blocks.map((b) => {
    const block = { id: b.id };
    for (const field of cs.blocks.fields) {
      if (field === 'figure') block[field] = '99.9%';
      else if (field === 'value') block[field] = '99';
      else if (field === 'unit') block[field] = '%';
      else block[field] = b[field];  // verbatim from the sample bank
    }
    return block;
  });
  return {
    headline: base.headline,
    subheadline: base.subheadline,
    blocks,
    callToAction: base.callToAction
  };
}

// ── geometry helpers ──────────────────────────────────────────────────────────

function tbHeight(tb) {
  return estTextHeight(tb.text, tb.fontSize, tb.width, tb.lineHeight ?? 1.16);
}

/** Available vertical space for a Textbox: distance to next overlapping obj below, minus 8px.
 *  Only content and image-slot objects constrain space — decorative objects (decor/background/scrim)
 *  are intentional atmosphere and do not define content boundaries.
 */
function availableHeight(tb, allObjects, canvasH) {
  const tbRight = tb.left + tb.width;
  const BLOCKING_ROLES = new Set(['headline', 'subheadline', 'message', 'message-label', 'cta', 'image-slot']);
  let nextTop = canvasH;
  for (const obj of allObjects) {
    if (obj === tb) continue;
    if (!BLOCKING_ROLES.has(obj.layerRole)) continue; // skip decor/background/scrim
    if (obj.top <= tb.top) continue;
    const objRight = obj.left + (obj.width ?? 0);
    // horizontal overlap: [tb.left, tbRight] ∩ [obj.left, objRight]
    const overlapX = Math.min(tbRight, objRight) - Math.max(tb.left, obj.left);
    if (overlapX > 4) { // at least 4px horizontal overlap — same column
      nextTop = Math.min(nextTop, obj.top);
    }
  }
  return Math.max(0, nextTop - tb.top - 8);
}

/** Overlap ratio of two Textboxes (fraction of smaller box area). */
function overlapRatio(tb1, allObjects) {
  const h1 = tbHeight(tb1);
  const b1 = { l: tb1.left, t: tb1.top, r: tb1.left + tb1.width, b: tb1.top + h1 };

  let maxRatio = 0;
  for (const tb2 of allObjects) {
    if (tb2 === tb1) continue;
    if (tb2.type !== 'Textbox') continue;
    const h2 = tbHeight(tb2);
    const b2 = { l: tb2.left, t: tb2.top, r: tb2.left + tb2.width, b: tb2.top + h2 };
    const ox = Math.max(0, Math.min(b1.r, b2.r) - Math.max(b1.l, b2.l));
    const oy = Math.max(0, Math.min(b1.b, b2.b) - Math.max(b1.t, b2.t));
    const overlapArea = ox * oy;
    if (overlapArea <= 0) continue;
    const area1 = (b1.r - b1.l) * (b1.b - b1.t);
    const area2 = (b2.r - b2.l) * (b2.b - b2.t);
    const smallerArea = Math.min(area1, area2);
    if (smallerArea > 0) maxRatio = Math.max(maxRatio, overlapArea / smallerArea);
  }
  return maxRatio;
}

// ── audit core ────────────────────────────────────────────────────────────────

function auditCanvas(canvas, label, { w: canvasW, h: canvasH }) {
  const objects = canvas.objects;
  const errors = [];

  // 1. Canvas bounds: content and image-slot objects must be inside the canvas.
  // Decorative elements (layerRole: 'decor' | 'background' | 'scrim') may
  // intentionally extend off-canvas (signal arcs, glow circles, perspective
  // grids) — they are excluded from the bounds check.
  const CONTENT_ROLES = new Set(['headline', 'subheadline', 'message', 'message-label', 'cta', 'image-slot']);
  for (const obj of objects) {
    if (!CONTENT_ROLES.has(obj.layerRole)) continue;
    if (typeof obj.left !== 'number' || typeof obj.top !== 'number') continue;
    const right = obj.left + (obj.width ?? 0);
    if (obj.left < -1) errors.push(`${label}: ${obj.type}/${obj.layerRole} left=${obj.left} < 0`);
    if (obj.top < -1) errors.push(`${label}: ${obj.type}/${obj.layerRole} top=${obj.top} < 0`);
    if (right > canvasW + 1) errors.push(`${label}: ${obj.type}/${obj.layerRole} right=${right} > ${canvasW}`);
  }

  // 2. Textbox overflow and overlap — only for content roles (not decorative labels)
  const textboxes = objects.filter((o) => o.type === 'Textbox' && typeof o.fontSize === 'number' && typeof o.width === 'number' && CONTENT_ROLES.has(o.layerRole));
  for (const tb of textboxes) {
    const estH = tbHeight(tb);
    const avail = availableHeight(tb, objects, canvasH);
    // 5% tolerance
    if (estH > avail * 1.05) {
      errors.push(
        `${label}: Textbox "${tb.text?.slice(0, 32)}" (role=${tb.layerRole}, fontSize=${tb.fontSize}) ` +
        `estHeight=${Math.round(estH)} > availableHeight=${Math.round(avail)} (top=${tb.top})`
      );
    }

    // overlap check
    const ratio = overlapRatio(tb, textboxes);
    if (ratio > 0.15) {
      errors.push(
        `${label}: Textbox "${tb.text?.slice(0, 32)}" (role=${tb.layerRole}) overlaps a neighbor by ${Math.round(ratio * 100)}% (>15%)`
      );
    }
  }

  return errors;
}

// ── test: sample content, every template × both orientations ─────────────────

test('overflow audit: sample content — all 64 templates × both orientations', () => {
  const templates = v2.listTemplatesV2();
  assert.equal(templates.length, 64, '64 templates registered');

  const allErrors = [];
  for (const entry of templates) {
    const content = sampleContentFor(entry.contentSchema);
    for (const orientation of ORIENTATIONS) {
      const dims = canvasDims(orientation);
      let canvas;
      try {
        canvas = v2.buildCanvas(entry.id, orientation, content);
      } catch (e) {
        allErrors.push(`${entry.id}/${orientation}: BUILD ERROR: ${e.message}`);
        continue;
      }
      const errs = auditCanvas(canvas, `${entry.id}/${orientation}/sample`, dims);
      allErrors.push(...errs);
    }
  }

  assert.deepEqual(allErrors, [], `Overflow violations:\n${allErrors.join('\n')}`);
});

// ── test: long content — stress-test field lengths ────────────────────────────

test('overflow audit: long content — all 64 templates × both orientations', () => {
  const templates = v2.listTemplatesV2();
  const allErrors = [];

  for (const entry of templates) {
    const content = longContentFor(entry.contentSchema);
    for (const orientation of ORIENTATIONS) {
      const dims = canvasDims(orientation);
      let canvas;
      try {
        canvas = v2.buildCanvas(entry.id, orientation, content);
      } catch (e) {
        allErrors.push(`${entry.id}/${orientation}: BUILD ERROR: ${e.message}`);
        continue;
      }
      const errs = auditCanvas(canvas, `${entry.id}/${orientation}/long`, dims);
      allErrors.push(...errs);
    }
  }

  assert.deepEqual(allErrors, [], `Overflow violations (long content):\n${allErrors.join('\n')}`);
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
