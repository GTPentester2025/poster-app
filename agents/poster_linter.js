// Poster Linter (deterministic, zero model calls). The last line of defence on
// COMPILED canvases: whatever path produced a design (template apply, dynamic
// loop, autopilot candidate), the linter checks the actual objects that will
// render and repairs what it safely can:
//
//   contrast   — Textbox fill vs its declared bgRef below WCAG (4.5:1 normal,
//                3:1 for large bold ≥32px). AUTO-FIXED: fill flipped via
//                pickTextColor(bgRef).
//   min-font   — fontSize below MIN_FONT_PX (unreadable at print). AUTO-FIXED:
//                raised to the floor (fitTextBlock floors normally prevent
//                this; the fix guards hand-built/dynamic specs).
//   overflow   — estimated text box breaches canvas bounds. Reported only —
//                geometry belongs to the template/compiler.
//   overlap    — two content text boxes intersect >20% of the smaller.
//                Reported only.
//
// Also used as a candidate JUDGE: lintScore() turns a report into a 0-100
// quality score the autopilot uses to compare compiled candidates.

import { contrastRatio, pickTextColor, estTextHeight } from '../templates/helpers.js';

export const AGENT_ID = 'poster-linter';
export const skills = ['lint_canvas'];

export const MIN_FONT_PX = 14;
const CONTENT_ROLES = new Set(['headline', 'subheadline', 'message', 'message-label', 'cta']);
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function isHex(v) { return typeof v === 'string' && HEX_RE.test(v); }

function textBox(o) {
  const w = o.width ?? 0;
  const h = estTextHeight(o.text, o.fontSize ?? 0, w, o.lineHeight || 1.16);
  return { x: o.left ?? 0, y: o.top ?? 0, w, h };
}

/**
 * Lint one canvas; repairs contrast + min-font violations IN PLACE.
 * @returns {{fixes: Array, violations: Array}} fixes = repaired issues,
 *   violations = remaining (reported, not repairable here).
 */
export function lintCanvas(canvas) {
  const fixes = [];
  const violations = [];
  if (!canvas || !Array.isArray(canvas.objects)) {
    return { fixes, violations: [{ kind: 'no-canvas', role: '-', detail: 'missing canvas/objects' }] };
  }
  const { width: W = 0, height: H = 0 } = canvas;
  const texts = canvas.objects.filter(
    (o) => o.type === 'Textbox' && CONTENT_ROLES.has(o.layerRole || '') && typeof o.text === 'string' && o.text
  );

  for (const o of texts) {
    // contrast vs declared background
    if (isHex(o.fill) && isHex(o.bgRef)) {
      const large = (o.fontSize ?? 0) >= 32 && Number(o.fontWeight) >= 700;
      const need = large ? 3 : 4.5;
      const ratio = contrastRatio(o.fill, o.bgRef);
      if (ratio < need) {
        const fixed = pickTextColor(o.bgRef);
        if (contrastRatio(fixed, o.bgRef) >= need) {
          fixes.push({ kind: 'contrast', role: o.layerRole, detail: `${o.fill}→${fixed} on ${o.bgRef} (${ratio.toFixed(2)}:1 < ${need}:1)` });
          o.fill = fixed;
        } else {
          violations.push({ kind: 'contrast', role: o.layerRole, detail: `${ratio.toFixed(2)}:1 < ${need}:1 on ${o.bgRef} (unfixable)` });
        }
      }
    }
    // readable floor
    if ((o.fontSize ?? 0) > 0 && o.fontSize < MIN_FONT_PX) {
      fixes.push({ kind: 'min-font', role: o.layerRole, detail: `${o.fontSize}px→${MIN_FONT_PX}px` });
      o.fontSize = MIN_FONT_PX;
    }
    // bounds
    const b = textBox(o);
    if (b.x < -2 || b.y < -2 || b.x + b.w > W + 2 || b.y + b.h > H + 2) {
      violations.push({ kind: 'overflow', role: o.layerRole, detail: `right=${Math.round(b.x + b.w)}/${W} bottom=${Math.round(b.y + b.h)}/${H}` });
    }
  }

  // pairwise overlap of content text
  const boxes = texts.map((o) => ({ ...textBox(o), role: o.layerRole, msgId: o.msgId || null }));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]; const b = boxes[j];
      const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      const area = ox * oy;
      const minA = Math.min(a.w * a.h, b.w * b.h) || 1;
      // label+text pairs of the SAME block legitimately sit close; only flag
      // cross-block or same-role collisions
      if (area > 0.2 * minA && !(a.msgId && a.msgId === b.msgId)) {
        violations.push({ kind: 'overlap', role: `${a.role}~${b.role}`, detail: `${Math.round(100 * area / minA)}%` });
      }
    }
  }
  return { fixes, violations };
}

/**
 * Lint a whole design (portrait + optional landscape) in place.
 * @returns {{score, fixes, violations, orientations}} summary stored on design.lint
 */
export function lintDesign(design) {
  const orientations = {};
  let fixes = [];
  let violations = [];
  if (design?.canvas) {
    const r = lintCanvas(design.canvas);
    orientations.portrait = { fixes: r.fixes.length, violations: r.violations.length };
    fixes = fixes.concat(r.fixes);
    violations = violations.concat(r.violations.map((v) => ({ ...v, orientation: 'portrait' })));
  }
  if (design?.landscape?.canvas) {
    const r = lintCanvas(design.landscape.canvas);
    orientations.landscape = { fixes: r.fixes.length, violations: r.violations.length };
    fixes = fixes.concat(r.fixes);
    violations = violations.concat(r.violations.map((v) => ({ ...v, orientation: 'landscape' })));
  }
  return { score: lintScore({ fixes, violations }), fixes, violations, orientations };
}

/** 0-100 canvas-quality score: violations weigh heavy, applied fixes lightly. */
export function lintScore({ fixes = [], violations = [] }) {
  return Math.max(0, 100 - violations.length * 15 - fixes.length * 2);
}
