// Editor lint helpers (Phase O8) — a PURE, testable bridge between the live
// fabric canvas in the editor and the deterministic agents/poster_linter.js.
//
// The linter runs server-side on COMPILED canvas-JSON (objects with a flat
// shape: type 'Textbox', left/top/width, fontSize, fontWeight, fill, bgRef,
// layerRole, text — see agents/poster_linter.js). The live editor holds fabric
// instances whose serialized form is ALMOST that shape but carries scaleX/
// scaleY and stores width/height pre-scale. serializeForLint() flattens a
// fabric toObject() dump into exactly the shape the linter reads (applying
// scale to width, mapping capitalized fabric types), so lintCanvas() can be
// reused verbatim WITHOUT a server round-trip.
//
// This module is loaded two ways with NO bundler:
//   - browser: editor.html mounts it via <script type="module"> which stashes
//     the exports on window.EditorLint (editor_inline.js, a plain IIFE, reads
//     the global at interaction time — long after module eval).
//   - node test: imported directly (pure functions, zero DOM), so the
//     serialize→lint contract is unit-tested without a headless browser.
//
// The contrast/min-font FIX path is deliberately kept here too: lintCanvas
// repairs `fill` (and fontSize) IN PLACE on the flattened objects, and
// applyLintFixes() maps those repaired fills BACK onto the live fabric objects
// by identity (same index), so the editor's "Fix contrast/fonts" button never
// needs the server.

// ── contrast + text-height math (client twin of templates/helpers.js) ────────
// Inlined (not imported) because templates/ is not served under ui/ — the
// exact same formulas the server linter consumes, kept in sync by hand.

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function isHex(v) { return typeof v === 'string' && HEX_RE.test(v); }

function relLuminance(hex) {
  const h = String(hex).replace('#', '');
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const ch = (i) => parseInt(h.slice(i * 2, i * 2 + 2), 16) / 255;
  return 0.2126 * lin(ch(0)) + 0.7152 * lin(ch(1)) + 0.0722 * lin(ch(2));
}

/** WCAG contrast ratio between two #rrggbb colors (1..21). */
export function contrastRatio(a, b) {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Readable text color (dark or light) for a given background — mirrors pickTextColor. */
export function pickTextColor(bg, dark = '#1F1A17', light = '#FFFFFF') {
  return contrastRatio(bg, dark) >= contrastRatio(bg, light) ? dark : light;
}

const AVG_CHAR_W = 0.54; // mirrors templates/helpers.js

export function estLines(text, fontSize, width) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  const maxChars = Math.max(4, Math.floor(width / (fontSize * AVG_CHAR_W)));
  let lines = 1;
  let lineLen = 0;
  for (const word of words) {
    const add = lineLen === 0 ? word.length : word.length + 1;
    if (lineLen + add > maxChars && lineLen > 0) { lines++; lineLen = word.length; }
    else lineLen += add;
  }
  return lines;
}

export function estTextHeight(text, fontSize, width, lineHeight = 1.16) {
  return estLines(text, fontSize, width, lineHeight) * fontSize * lineHeight;
}

// ── linter (client twin of agents/poster_linter.js lintCanvas) ───────────────
// Same thresholds, same in-place contrast/min-font repair, same reported
// overflow/overlap — kept byte-aligned with the server module by hand.

export const MIN_FONT_PX = 14;
const CONTENT_ROLES = new Set(['headline', 'subheadline', 'message', 'message-label', 'cta']);

function textBox(o) {
  const w = o.width ?? 0;
  const h = estTextHeight(o.text, o.fontSize ?? 0, w, o.lineHeight || 1.16);
  return { x: o.left ?? 0, y: o.top ?? 0, w, h };
}

/**
 * Lint one FLATTENED canvas (see serializeForLint). Repairs contrast + min-font
 * violations IN PLACE on canvas.objects[i]. Every fix/violation carries `index`
 * (position in canvas.objects) so the caller can badge/patch the live fabric
 * object at the same index.
 * @returns {{fixes: Array, violations: Array}}
 */
export function lintCanvas(canvas) {
  const fixes = [];
  const violations = [];
  if (!canvas || !Array.isArray(canvas.objects)) {
    return { fixes, violations: [{ kind: 'no-canvas', role: '-', index: -1, detail: 'missing canvas/objects' }] };
  }
  const { width: W = 0, height: H = 0 } = canvas;
  // keep the original array index alongside each linted text object
  const texts = canvas.objects
    .map((o, index) => ({ o, index }))
    .filter(({ o }) => o.type === 'Textbox' && CONTENT_ROLES.has(o.layerRole || '') && typeof o.text === 'string' && o.text);

  for (const { o, index } of texts) {
    if (isHex(o.fill) && isHex(o.bgRef)) {
      const large = (o.fontSize ?? 0) >= 32 && Number(o.fontWeight) >= 700;
      const need = large ? 3 : 4.5;
      const ratio = contrastRatio(o.fill, o.bgRef);
      if (ratio < need) {
        const fixed = pickTextColor(o.bgRef);
        if (contrastRatio(fixed, o.bgRef) >= need) {
          fixes.push({ kind: 'contrast', role: o.layerRole, index, fill: fixed, detail: `${o.fill}→${fixed} on ${o.bgRef} (${ratio.toFixed(2)}:1 < ${need}:1)` });
          o.fill = fixed;
        } else {
          violations.push({ kind: 'contrast', role: o.layerRole, index, detail: `${ratio.toFixed(2)}:1 < ${need}:1 on ${o.bgRef} (unfixable)` });
        }
      }
    }
    if ((o.fontSize ?? 0) > 0 && o.fontSize < MIN_FONT_PX) {
      fixes.push({ kind: 'min-font', role: o.layerRole, index, fontSize: MIN_FONT_PX, detail: `${o.fontSize}px→${MIN_FONT_PX}px` });
      o.fontSize = MIN_FONT_PX;
    }
    const b = textBox(o);
    if (b.x < -2 || b.y < -2 || b.x + b.w > W + 2 || b.y + b.h > H + 2) {
      violations.push({ kind: 'overflow', role: o.layerRole, index, detail: `right=${Math.round(b.x + b.w)}/${W} bottom=${Math.round(b.y + b.h)}/${H}` });
    }
  }

  const boxes = texts.map(({ o, index }) => ({ ...textBox(o), role: o.layerRole, msgId: o.msgId || null, index }));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]; const b = boxes[j];
      const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      const area = ox * oy;
      const minA = Math.min(a.w * a.h, b.w * b.h) || 1;
      if (area > 0.2 * minA && !(a.msgId && a.msgId === b.msgId)) {
        violations.push({ kind: 'overlap', role: `${a.role}~${b.role}`, index: a.index, index2: b.index, detail: `${Math.round(100 * area / minA)}%` });
      }
    }
  }
  return { fixes, violations };
}

// ── fabric → linter-shape flattening ─────────────────────────────────────────

/**
 * Flatten a fabric canvas serialization (obj = fc.toObject([...customProps]))
 * into the flat canvas-JSON shape agents/poster_linter.js reads. Pure — takes
 * a plain serialized object, returns a NEW canvas whose objects carry the
 * linter's expected fields with fabric scale folded into width/height. Each
 * output object keeps `_index` = its position in the source objects array so
 * fixes/violations map back onto the live canvas by index.
 *
 * @param {object} serialized fc.toObject() result (objects with fabric props)
 * @param {number} width  canvas width  (linter overflow bound)
 * @param {number} height canvas height (linter overflow bound)
 */
export function serializeForLint(serialized, width, height) {
  const objects = (serialized.objects || []).map((o, index) => {
    const sx = Number.isFinite(o.scaleX) ? o.scaleX : 1;
    const sy = Number.isFinite(o.scaleY) ? o.scaleY : 1;
    const out = {
      _index: index,
      type: o.type,
      left: o.left,
      top: o.top,
      width: (o.width ?? 0) * sx,
      height: (o.height ?? 0) * sy,
      fontSize: o.fontSize,
      fontWeight: o.fontWeight,
      fill: typeof o.fill === 'string' ? o.fill : undefined,
      bgRef: o.bgRef,
      layerRole: o.layerRole,
      msgId: o.msgId,
      lineHeight: o.lineHeight,
      text: o.text
    };
    return out;
  });
  return { width, height, objects };
}

/**
 * Convenience: flatten a fabric canvas serialization AND lint it in one call.
 * Returns the lint report with fix/violation `index` values pointing back into
 * the ORIGINAL objects array (serializeForLint preserves order 1:1).
 */
export function lintFabricSerialization(serialized, width, height) {
  return lintCanvas(serializeForLint(serialized, width, height));
}
