// Editor save API (spec §B.8). Editor edits are USER changes: applied
// verbatim after shape/safety validation, logged as user_action events, and
// NEVER re-reviewed by agents (unlike the pre-design content loops). No
// pipeline module behind this route on purpose — there is no agent stage
// here, just guarded persistence of the canvas the user edited.
//
// Safety on the way in:
//   - canvas must be an object with an objects array (<= 300 objects), the
//     serialized JSON capped at 3MB (413 above it)
//   - every `src` property anywhere in the object tree must be a relative
//     /api/images/file/ URL or a data:image URI — anything else (absolute
//     remote URLs = exfil / tracking pixels riding a saved canvas) is
//     stripped, recursively (clipPath etc. included)
//   - text objects carry strings only (a non-string `text` is rejected)
//   - width/height/version are pinned server-side (1414x2000 design model)
//
// Orientation (T3): `?orientation=portrait|landscape` picks the save target.
// portrait (the default, and the only option for v1/dynamic designs) targets
// design.canvas / variant.canvas pinned 1414x2000 — exactly the pre-T3
// behavior. landscape targets design.landscape.canvas / variant.landscapeCanvas
// pinned 2000x1414 through the SAME sanitiser, and 404s (NO_LANDSCAPE_CANVAS)
// when the design/variant never built one (v1 and dynamic posters are
// portrait-only). The terminology memory hook stays PORTRAIT-variant-only:
// landscape text mirrors portrait (same layerRole/msgId bindings), so
// learning from both orientations would double-count every user term swap.
// Saving keeps doc.phase — editing never regresses a poster; the explicit
// save-with-name flow (spec §B.10, Phase 10) owns the 'saved' transition.

import { Router } from 'express';
import { withPosterLock } from '../../pipelines/content_pipeline.js';
import { safeDesignState } from '../../pipelines/design_pipeline.js';
import { CANVAS_W, CANVAS_H } from '../../templates/helpers.js';
import { LANDSCAPE_W, LANDSCAPE_H } from '../../templates/v2/decor.js';
import { TARGET_LANGUAGE_IDS } from '../../translation/languages.js';
import { extractContentFromCanvas, diffTextFields } from '../../translation/canvas_text.js';
import { validateAndStoreTermSwaps } from '../../agents/terminology_validator.js';

const PROJECT = 'poster-app';
const PIPELINE = 'editor';
const MAX_OBJECTS = 300;
const MAX_CANVAS_BYTES = 3 * 1024 * 1024; // 3MB serialized
const EDITABLE_PHASES = ['designed', 'saved', 'translated'];
// Raster-only: svg+xml is script-capable (onload= etc.) and must be blocked.
// Case-insensitive so "Data:Image/PNG" variants are handled uniformly.
const SAFE_SRC = /^(\/api\/images\/file\/|data:image\/(png|jpe?g|gif|webp);base64,)/i;
// editor images should be library refs; data URIs bloat every snapshot
const DATA_URI_MAX_LEN = 512 * 1024;

function codedError(message, code, status) {
  const err = new Error(message);
  err.code = code;
  if (status) err.status = status;
  return err;
}

function handle(res, next, err) {
  if (err && err.status) {
    return res.status(err.status).json({ error: err.code || 'BAD_REQUEST' });
  }
  next(err);
}

// ── poster persistence (same discipline as the pipelines) ───────────────────

function loadPoster(db, posterId) {
  const row = db.prepare('SELECT * FROM posters WHERE poster_id = ?').get(posterId);
  if (!row) throw codedError(`Poster ${posterId} not found`, 'POSTER_NOT_FOUND', 404);
  return { row, doc: JSON.parse(row.doc) };
}

function savePoster(db, posterId, { doc }) {
  db.prepare('UPDATE posters SET updated_at = ?, doc = ? WHERE poster_id = ?')
    .run(new Date().toISOString(), JSON.stringify(doc), posterId);
}

function pushSnapshot(doc, state) {
  doc.snapshots.push({ version: doc.snapshots.length + 1, capturedAt: new Date().toISOString(), state });
}

// ── canvas validation + sanitisation ────────────────────────────────────────

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Recursively strip every property named `src` whose value is not a relative
 * /api/images/file/ URL or a data:image URI. Returns the number of stripped
 * srcs (surfaced in the user_action payload for auditability).
 */
function stripUnsafeSrcs(node) {
  let stripped = 0;
  if (Array.isArray(node)) {
    for (const item of node) stripped += stripUnsafeSrcs(item);
    return stripped;
  }
  if (!isPlainObject(node)) return 0;
  if ('src' in node) {
    const s = node.src;
    const unsafe = !(typeof s === 'string' && SAFE_SRC.test(s))
      || (typeof s === 'string' && s.startsWith('data:') && s.length > DATA_URI_MAX_LEN);
    if (unsafe) {
      delete node.src;
      stripped += 1;
    }
  }
  for (const value of Object.values(node)) stripped += stripUnsafeSrcs(value);
  return stripped;
}

/** Shape problems that reject the save outright (400). */
function canvasProblems(canvas) {
  if (!isPlainObject(canvas)) return ['canvas must be a JSON object'];
  if (!Array.isArray(canvas.objects)) return ['canvas.objects must be an array'];
  const problems = [];
  canvas.objects.forEach((obj, i) => {
    if (!isPlainObject(obj)) {
      problems.push(`objects[${i}] must be an object`);
      return;
    }
    if (typeof obj.type !== 'string' || !obj.type.trim()) {
      problems.push(`objects[${i}].type must be a non-empty string`);
    }
    if ('text' in obj && typeof obj.text !== 'string') {
      problems.push(`objects[${i}].text must be a string`);
    }
  });
  return problems;
}

// ── save (holds the poster mutation lock) ────────────────────────────────────

// dimension pinning is orientation-aware (T3): portrait 1414x2000, landscape 2000x1414
const PIN_DIMS = {
  portrait: { width: CANVAS_W, height: CANVAS_H },
  landscape: { width: LANDSCAPE_W, height: LANDSCAPE_H }
};

/**
 * Shared sanitisation body: clone → strip unsafe srcs → pin dimensions/version.
 * Returns { sanitized, srcStripped }. The caller provides `previous` canvas for
 * version/background pinning (design canvas for English saves, variant canvas
 * for language variant saves — each in the matching orientation).
 */
function sanitizeCanvas(canvas, previous, orientation = 'portrait') {
  const sanitized = structuredClone(canvas);
  const srcStripped = stripUnsafeSrcs(sanitized);
  sanitized.width = PIN_DIMS[orientation].width;
  sanitized.height = PIN_DIMS[orientation].height;
  sanitized.version = previous.version;
  if (typeof sanitized.background !== 'string') sanitized.background = previous.background;
  return { sanitized, srcStripped };
}

/**
 * The shared save tail for all four canvas targets (design/variant ×
 * portrait/landscape): sanitize-pin against `previous`, hand the sanitized
 * canvas to `assign` (which mutates the doc and may return extra user_action
 * payload fields, e.g. changedFields on the portrait variant path), then
 * snapshot → persist → emit the single user_action a save produces.
 * `extra` rides in BOTH the snapshot state and the event payload (lang,
 * orientation). Returns { sanitized, srcStripped }.
 */
function commitCanvasSave({ db, bus, doc, posterId, canvas, previous, orientation, trigger, extra = {}, assign }) {
  const { sanitized, srcStripped } = sanitizeCanvas(canvas, previous, orientation);
  const eventExtra = assign(sanitized) || {};
  pushSnapshot(doc, { trigger, ...extra, objects: sanitized.objects.length });
  savePoster(db, posterId, { doc }); // phase + status untouched — editing never regresses
  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'editor-save',
    agent: 'user', skill: 'editor_save', type: 'user_action',
    payload: { posterId, action: 'editor-save', ...extra, objects: sanitized.objects.length, srcStripped, ...eventExtra }
  });
  return { sanitized, srcStripped };
}

function saveCanvas({ ctx, posterId, canvas, lang, orientation }) {
  const { db, bus, egress } = ctx;
  const { row, doc } = loadPoster(db, posterId);
  if (!EDITABLE_PHASES.includes(doc.phase)) {
    throw codedError(
      `Cannot save editor canvas: poster is in phase "${doc.phase}" (requires ${EDITABLE_PHASES.join(' or ')})`,
      'WRONG_PHASE', 409
    );
  }

  // ── Language variant save ──────────────────────────────────────────────────
  if (lang) {
    // Rule 1: lang must be a known target language id
    if (!TARGET_LANGUAGE_IDS.includes(lang)) {
      throw codedError(`Unknown target language: ${lang}`, 'INVALID_LANGUAGE', 400);
    }
    // Rule 2: variant must exist (translation pipeline must have run first)
    const variant = doc.translations?.[lang];
    if (!variant) {
      throw codedError(`No translation variant found for lang "${lang}"`, 'TRANSLATION_NOT_FOUND', 404);
    }
    // Rule 3: phase must be 'translated' for variant saves
    if (doc.phase !== 'translated') {
      throw codedError(
        `Cannot save variant canvas: poster phase is "${doc.phase}" (requires translated)`,
        'WRONG_PHASE', 409
      );
    }

    // ── Landscape variant save (T3) ──────────────────────────────────────────
    // Persists ONLY variant.landscapeCanvas. variant.content stays derived
    // from the PORTRAIT canvas and the terminology memory hook below runs
    // ONLY on the portrait path: landscape text mirrors portrait (same
    // layerRole/msgId bindings), so diffing both orientations would learn
    // every user term swap twice.
    if (orientation === 'landscape') {
      if (!variant.landscapeCanvas) {
        throw codedError(
          `Variant "${lang}" has no landscape canvas (poster was translated without a landscape design)`,
          'NO_LANDSCAPE_CANVAS', 404
        );
      }
      commitCanvasSave({
        db, bus, doc, posterId, canvas, previous: variant.landscapeCanvas, orientation,
        trigger: 'editor-save-variant', extra: { lang, orientation },
        assign: (sanitized) => {
          variant.landscapeCanvas = sanitized;
          variant.status = 'edited';
          variant.updatedAt = new Date().toISOString();
        }
      });
      // no text diff on landscape → nothing to offer the batch-sync flow
      return { ...safeDesignState(row, doc), syncAvailable: false };
    }

    // ── Portrait variant save (existing behavior) ────────────────────────────
    // Rule 4: Memory hook — diff text fields to detect terminology changes.
    // `before` is captured pre-commit (variant.canvas is still the previous
    // canvas); `after`/`changes` need the sanitized canvas, so they compute
    // inside assign.
    const before = extractContentFromCanvas(variant.canvas, variant.content);
    let changes = [];
    commitCanvasSave({
      db, bus, doc, posterId, canvas, previous: variant.canvas, orientation: 'portrait',
      trigger: 'editor-save-variant', extra: { lang },
      assign: (sanitized) => {
        const after = extractContentFromCanvas(sanitized, variant.content);
        changes = diffTextFields(before, after);
        // Apply variant save — content is re-extracted from the saved canvas so
        // variant.content and variant.canvas can never drift apart.
        // O10 (D2): portrait variant saves overwrite only variant.canvas;
        // variant.landscapeCanvas (v2 dual-orientation posters) is
        // intentionally left untouched. Text drift between the orientations
        // after a canvas-text edit here is acceptable and gets reconciled on
        // the next re-translate/sync (buildVariant re-applies fresh text to
        // BOTH).
        variant.canvas = sanitized;
        variant.content = after;
        variant.status = 'edited';
        variant.updatedAt = new Date().toISOString();
        if (changes.length > 0) {
          variant.lastEditChanges = changes;
        }
        return { changedFields: changes.map((c) => c.field) };
      }
    });

    // Fire-and-forget terminology learning (never delays or fails the save)
    if (changes.length > 0) {
      validateAndStoreTermSwaps({ egress, db, runId: doc.runId, lang, changes })
        .then((result) => {
          if (result.stored && result.stored.length > 0) {
            bus.emit({
              runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'editor-save',
              agent: 'terminology-validator', skill: 'store_terminology', type: 'memory_write',
              payload: { posterId, lang, stored: result.stored.map((s) => s.sourceTerm) }
            });
          }
          if (result.failed) {
            try {
              bus.emit({
                runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'editor-save',
                agent: 'terminology-validator', skill: 'store_terminology', type: 'error',
                payload: { posterId, lang, code: 'TERMINOLOGY_VALIDATION_FAILED' }
              });
            } catch { /* bus failure must not crash the fire-and-forget chain */ }
          }
        })
        .catch(() => {
          try {
            bus.emit({
              runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'editor-save',
              agent: 'terminology-validator', skill: 'store_terminology', type: 'error',
              payload: { posterId, lang, code: 'TERMINOLOGY_VALIDATION_FAILED' }
            });
          } catch { /* bus failure must not crash the fire-and-forget chain */ }
        });
    }

    // syncAvailable: true when text changed AND other translated variants exist
    const otherVariants = Object.keys(doc.translations || {}).filter((l) => l !== lang);
    const syncAvailable = changes.length > 0 && otherVariants.length > 0;

    return { ...safeDesignState(row, doc), syncAvailable };
  }

  // ── English (design) landscape save (T3) ───────────────────────────────────
  // Only v2 template-first posters build doc.design.landscape.canvas; v1 and
  // dynamic designs are portrait-only and 404 here.
  if (orientation === 'landscape') {
    if (!doc.design?.landscape?.canvas) {
      throw codedError(
        'Poster has no landscape canvas (v1/dynamic designs are portrait-only)',
        'NO_LANDSCAPE_CANVAS', 404
      );
    }
    commitCanvasSave({
      db, bus, doc, posterId, canvas, previous: doc.design.landscape.canvas, orientation,
      trigger: 'editor-save', extra: { orientation },
      assign: (sanitized) => { doc.design.landscape.canvas = sanitized; }
    });
    return safeDesignState(row, doc);
  }

  // ── English (design) portrait canvas save — existing behavior ─────────────
  // spec §B.8: editor edits are logged as user changes, not agent-reviewed —
  // the user_action inside commitCanvasSave is the ONLY event a save produces.
  commitCanvasSave({
    db, bus, doc, posterId, canvas, previous: doc.design.canvas, orientation: 'portrait',
    trigger: 'editor-save',
    assign: (sanitized) => { doc.design.canvas = sanitized; }
  });
  return safeDesignState(row, doc);
}

// ── regenerate-text: update one bound text field with a fresh model draft ────
// POST /api/editor/:posterId/regenerate-text
// body { layerRole, msgId?, fieldRef? }
//
// Loads the poster doc, calls ONE egress.completeText (agent: content-generator,
// skill: regenerate_text) prompting with the poster topic + current text + role,
// validates the result (non-empty, ≤ 300 chars), writes it back to the matching
// content binding (headline / subheadline / callToAction, or blocks[].{fieldRef},
// or doc.content.messages[].text where msgId matches), persists via the same
// locked-save path used by the PUT /canvas route, and returns safeDesignState.
//
// On model failure: 502 { error: 'REGENERATE_FAILED' }.
// The canvas itself is NOT recompiled here — the client applies the returned
// text to the canvas object in memory (the user can then let autosave persist
// the updated canvas in the normal way).

const REGENERATE_MAX_CHARS = 300;
const REGEN_ROLES = new Set(['headline', 'subheadline', 'cta', 'message', 'callToAction']);

function currentTextForRole(doc, layerRole, msgId, fieldRef) {
  const c = doc.content;
  if (!c) return '';
  if (layerRole === 'headline') return c.headline || '';
  if (layerRole === 'subheadline') return c.subheadline || '';
  if (layerRole === 'cta' || layerRole === 'callToAction') return c.callToAction || '';
  if (layerRole === 'message' && msgId) {
    // v1 content: doc.content.messages[].id + .text
    const msg = (c.messages || []).find((m) => m.id === msgId);
    if (msg) return fieldRef ? (msg[fieldRef] || '') : (msg.text || '');
    // v2 qa-pair blocks: doc.content.blocks[].id + .[fieldRef]
    const blk = (c.blocks || []).find((b) => b.id === msgId);
    if (blk && fieldRef) return blk[fieldRef] || '';
  }
  return '';
}

function applyRegenText(doc, layerRole, msgId, fieldRef, newText) {
  const c = doc.content;
  if (!c) return;
  if (layerRole === 'headline') { c.headline = newText; return; }
  if (layerRole === 'subheadline') { c.subheadline = newText; return; }
  if (layerRole === 'cta' || layerRole === 'callToAction') { c.callToAction = newText; return; }
  if (layerRole === 'message' && msgId) {
    const msg = (c.messages || []).find((m) => m.id === msgId);
    if (msg) { if (fieldRef) msg[fieldRef] = newText; else msg.text = newText; return; }
    const blk = (c.blocks || []).find((b) => b.id === msgId);
    if (blk && fieldRef) { blk[fieldRef] = newText; }
  }
}

async function regenerateText({ ctx, posterId, layerRole, msgId, fieldRef }) {
  const { db, bus, egress } = ctx;
  const { row, doc } = loadPoster(db, posterId);
  if (!EDITABLE_PHASES.includes(doc.phase)) {
    throw codedError(
      `Cannot regenerate text: poster is in phase "${doc.phase}"`,
      'WRONG_PHASE', 409
    );
  }
  const topic = doc.contextFile?.topic || doc.content?.headline || 'poster';
  const currentText = currentTextForRole(doc, layerRole, msgId, fieldRef);
  const roleLabel = layerRole === 'cta' ? 'call-to-action' : layerRole;

  let newText;
  try {
    newText = await egress.completeText(
      {
        system: 'You are a concise copywriter for security awareness posters. Write ONE alternative for the given poster element. Same approximate length, same language, plain text only — no quotes, no formatting.',
        prompt: `Poster topic: ${topic}\nElement role: ${roleLabel}\nCurrent text: ${currentText}\n\nWrite ONE alternative for this poster element.`
      },
      { runId: doc.runId, agent: 'content-generator', skill: 'regenerate_text' }
    );
  } catch {
    const err = new Error('Model call failed for regenerate-text');
    err.code = 'REGENERATE_FAILED';
    err.status = 502;
    throw err;
  }

  if (typeof newText !== 'string') newText = String(newText ?? '');
  newText = newText.trim();
  if (!newText || newText.length > REGENERATE_MAX_CHARS) {
    const err = new Error('Model returned empty or overlong text');
    err.code = 'REGENERATE_FAILED';
    err.status = 502;
    throw err;
  }

  applyRegenText(doc, layerRole, msgId, fieldRef, newText);
  pushSnapshot(doc, { trigger: 'editor-regenerate-text', layerRole, msgId: msgId || null, fieldRef: fieldRef || null });
  savePoster(db, posterId, { doc });
  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'editor-regen-text',
    agent: 'content-generator', skill: 'regenerate_text', type: 'user_action',
    payload: { posterId, layerRole, msgId: msgId || null, fieldRef: fieldRef || null }
  });
  return { ...safeDesignState(row, doc), regenText: newText };
}

export function editorRouter(ctx) {
  const router = Router();

  // PUT /api/editor/:posterId/canvas[?orientation=landscape][&lang=de]  body { canvas }
  // Without lang (or lang=en): saves the design canvas (doc.design.canvas, or
  // doc.design.landscape.canvas with orientation=landscape).
  // With lang=<target id>: saves the translation variant canvas for that
  // language (variant.canvas, or variant.landscapeCanvas with
  // orientation=landscape).
  router.put('/:posterId/canvas', async (req, res, next) => {
    try {
      const { canvas } = req.body || {};
      // orientation ∈ {portrait (default), landscape}; anything else is a 400
      const rawOrientation = req.query.orientation;
      const orientation = (rawOrientation === undefined || rawOrientation === '' || rawOrientation === 'portrait')
        ? 'portrait'
        : (rawOrientation === 'landscape' ? 'landscape' : null);
      if (!orientation) {
        return res.status(400).json({ error: 'INVALID_ORIENTATION' });
      }
      const problems = canvasProblems(canvas);
      if (problems.length) {
        return res.status(400).json({ error: `invalid canvas: ${problems.slice(0, 5).join('; ')}` });
      }
      if (canvas.objects.length > MAX_OBJECTS) {
        return res.status(400).json({ error: `canvas exceeds ${MAX_OBJECTS} objects (got ${canvas.objects.length})` });
      }
      if (Buffer.byteLength(JSON.stringify(canvas), 'utf8') > MAX_CANVAS_BYTES) {
        return res.status(413).json({ error: 'CANVAS_TOO_LARGE' });
      }
      // lang=en is treated identically to no lang (English = base, no variant path)
      const rawLang = req.query.lang;
      const lang = (rawLang && rawLang !== 'en') ? rawLang : null;
      res.json(await withPosterLock(req.params.posterId, () => saveCanvas({ ctx, posterId: req.params.posterId, canvas, lang, orientation })));
    } catch (err) { handle(res, next, err); }
  });

  // POST /api/editor/:posterId/regenerate-text
  // body { layerRole, msgId?, fieldRef? }
  router.post('/:posterId/regenerate-text', async (req, res, next) => {
    try {
      const { layerRole, msgId, fieldRef } = req.body || {};
      if (typeof layerRole !== 'string' || !layerRole.trim()) {
        return res.status(400).json({ error: 'layerRole is required' });
      }
      const role = layerRole.trim();
      if (!REGEN_ROLES.has(role)) {
        return res.status(400).json({ error: `unknown layerRole: ${role}` });
      }
      const result = await withPosterLock(req.params.posterId, () =>
        regenerateText({
          ctx,
          posterId: req.params.posterId,
          layerRole: role,
          msgId: typeof msgId === 'string' ? msgId : undefined,
          fieldRef: typeof fieldRef === 'string' ? fieldRef : undefined
        })
      );
      res.json(result);
    } catch (err) {
      if (err.code === 'REGENERATE_FAILED') {
        return res.status(502).json({ error: 'REGENERATE_FAILED' });
      }
      handle(res, next, err);
    }
  });

  return router;
}
