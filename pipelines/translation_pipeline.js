// Translation pipeline (spec §B.11): English-first poster → 9 per-language
// canvas variants, each held to the translationFidelity 95 gate (fidelity
// back-check is built INTO the translator agent; this layer routes its verdict
// through the harness loop, max 4 attempts (3 reworks) per language).
//
// Orchestration rules honored here (mirrors content_pipeline):
//   - stage transitions validated via harness.validateHandoff; stage_start /
//     stage_end / user_action / memory_write events emitted by this layer
//     (pipeline 'translation'); the harness emits the loop's stage/gate/rework
//     events itself
//   - the EDITOR is the source of truth for English copy: the source content
//     is extracted from doc.design.canvas (extractContentFromCanvas), so text
//     the user edited in the Canva editor rides into every translation
//   - one hard language must never dead-end the batch: GATE_EXHAUSTED /
//     TRANSLATION_INVALID / FIDELITY_INVALID for a language is recorded in
//     doc.translationFailures and the loop continues; anything else rethrows
//   - user edits to a variant are applied VERBATIM (shape-validated only,
//     never re-reviewed — user has final word); terminology learning runs
//     fire-and-forget through the terminology-validator agent (spec: validate
//     first — a raw user preference never corrupts the glossary)
//   - batch sync re-translates every OTHER language FROM ENGLISH carrying the
//     edit's style preference; the edited variant itself stays untouched
//   - SAFE VIEW: list state carries per-language metadata only — content and
//     canvas (big) ship exclusively through getTranslationVariant

import { withPosterLock } from './content_pipeline.js';
import { translateContent, extractStylePreference } from '../agents/translator.js';
import { validateAndStoreTermSwaps } from '../agents/terminology_validator.js';
import { applyContentToCanvas, extractContentFromCanvas, diffTextFields, pruneOrphanedExtras } from '../translation/canvas_text.js';
import { TARGET_LANGUAGE_IDS, getLanguage, BASE_LANGUAGE } from '../translation/languages.js';
import { validatePosterContent, normalizePosterContent } from '../agents/content_generator.js';
import { qaStage } from '../agents/stage_qa.js';
import { refineContext } from '../agents/context_refiner.js';
import { reviewPrompting } from '../agents/overseer.js';

const PROJECT = 'poster-app';
const PIPELINE = 'translation';
// Pipeline-level stage events ride under this agent so the viz can light the
// translation stage on BOTH the start-translation and sync paths (the harness
// quality-loop events use agent 'harness'; per-language they are 'translate:<lang>').
const TRANSLATION_AGENT = 'translation-agent';
const MAX_TRANSLATION_REWORKS = 4; // spec §B.11 — tighter than the harness default

// translatable = designed or saved (post-design) or already translated
// (adding languages / re-translating is allowed)
const TRANSLATABLE_PHASES = ['designed', 'saved', 'translated'];

// Per-language failures that must NOT abort the batch (recorded + continue).
const RECOVERABLE_CODES = new Set(['GATE_EXHAUSTED', 'TRANSLATION_INVALID', 'FIDELITY_INVALID']);

function codedError(message, code, status) {
  const err = new Error(message);
  err.code = code;
  if (status) err.status = status;
  return err;
}

// ── poster persistence (same discipline as content_pipeline) ────────────────

function loadPoster(db, posterId) {
  const row = db.prepare('SELECT * FROM posters WHERE poster_id = ?').get(posterId);
  if (!row) throw codedError(`Poster ${posterId} not found`, 'POSTER_NOT_FOUND', 404);
  return { row, doc: JSON.parse(row.doc) };
}

function savePoster(db, posterId, { status = null, doc }) {
  const now = new Date().toISOString();
  if (status) {
    db.prepare('UPDATE posters SET status = ?, updated_at = ?, doc = ? WHERE poster_id = ?')
      .run(status, now, JSON.stringify(doc), posterId);
  } else {
    db.prepare('UPDATE posters SET updated_at = ?, doc = ? WHERE poster_id = ?')
      .run(now, JSON.stringify(doc), posterId);
  }
}

function pushSnapshot(doc, state) {
  doc.snapshots.push({ version: doc.snapshots.length + 1, capturedAt: new Date().toISOString(), state });
}

function requirePhase(doc, phases, action) {
  if (!phases.includes(doc.phase)) {
    throw codedError(`Cannot ${action}: poster is in phase "${doc.phase}" (requires ${phases.join(' or ')})`, 'WRONG_PHASE', 409);
  }
}

// ── safe view ────────────────────────────────────────────────────────────────

/**
 * SAFE VIEW: what a client may see of the translation state. NEVER includes
 * variant content or canvases (canvases are big; list payloads stay small) —
 * those ship only through getTranslationVariant, one language at a time.
 */
export function safeTranslationState(row, doc) {
  const translations = doc.translations || {};
  return {
    posterId: row.poster_id,
    name: row.name,
    status: row.status,
    phase: doc.phase,
    runId: doc.runId,
    baseLanguage: BASE_LANGUAGE,
    languages: Object.entries(translations).map(([lang, v]) => ({
      lang,
      label: getLanguage(lang)?.label || lang,
      status: v.status,
      fidelityScore: v.fidelityScore,
      attempts: v.attempts,
      updatedAt: v.updatedAt
    })),
    // A language can appear in BOTH lists: a failed RE-translation keeps the
    // prior (still valid) variant in languages[] while the retry failure is
    // reported in failed[]. Intentional — clients show "up to date? retry?".
    failed: (doc.translationFailures || []).map(({ lang, code }) => ({ lang, code }))
  };
}

// ── language selection ───────────────────────────────────────────────────────

function resolveLanguages(languages) {
  if (languages === 'all') return [...TARGET_LANGUAGE_IDS];
  const valid = Array.isArray(languages) && languages.length > 0 &&
    languages.every((l) => TARGET_LANGUAGE_IDS.includes(l));
  if (!valid) {
    throw codedError(`languages must be 'all' or a non-empty array of ${TARGET_LANGUAGE_IDS.join(', ')}`, 'INVALID_LANGUAGES', 400);
  }
  return [...new Set(languages)];
}

// ── per-language quality loop (translationFidelity gate, threshold 95) ──────

/**
 * One language through the produce → review → gate loop. The translator agent
 * back-checks its own output, so review() simply routes the fidelity verdict
 * of THIS attempt to the gate engine — `last` closes over the produce result
 * because the deliverable handed to review() is the content alone.
 */
async function translateOne({ ctx, doc, lang, sourceContent, seedFeedback = [] }) {
  const { db, egress, harness } = ctx;
  let last = null; // translateContent returns {content, fidelity} — review() needs the fidelity of THIS attempt
  const result = await harness.runQualityLoop({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE,
    stage: `translate:${lang}`, gateName: 'translationFidelity',
    maxReworkLoops: MAX_TRANSLATION_REWORKS,
    produce: async (attempt, history) => {
      last = await translateContent({
        egress, db, runId: doc.runId, content: sourceContent, targetLang: lang,
        priorFeedback: [...seedFeedback, ...history]
      });
      return last.content;
    },
    review: async () => [{ reviewer: 'translation-fidelity', ...last.fidelity }]
  });
  return {
    content: result.deliverable,
    fidelityScore: result.verdicts[0].score,
    attempts: result.attempts
  };
}

// ── variant assembly (shared by startTranslation + syncTranslationEdit) ─────

/**
 * Assemble a language variant from an accepted translation result.
 *
 * Re-translating an existing language applies the fresh text onto ITS OWN
 * canvas(es) — mirroring the sync path — so per-language layout edits
 * survive; user-text boxes deleted from the English source are pruned first,
 * against the variant's translation-time sourceExtraIds snapshot, NOT
 * content.extras (editor saves re-extract content and would contaminate it
 * with variant-local ids, deleting the user's language-local text). Only NEW
 * languages start from the English design canvas(es). Legacy variants
 * without a snapshot prune nothing.
 *
 * O10 (plan D2): when the poster has a landscape design
 * (doc.design.landscape.canvas — v2 template-first posters) the variant
 * carries BOTH orientations: `canvas` STAYS the portrait key (every existing
 * consumer unbroken) and `landscapeCanvas` rides alongside it, built from
 * the same translated content (both orientations share the same
 * layerRole/msgId/extraId bindings). v1 posters (no landscape design) never
 * gain a landscapeCanvas key.
 */
function buildVariant({ doc, existing, r }) {
  const baseCanvas = existing
    ? pruneOrphanedExtras(existing.canvas, existing.sourceExtraIds || [], r.content.extras)
    : doc.design.canvas;
  const variant = {
    content: r.content,
    canvas: applyContentToCanvas(baseCanvas, r.content),
    sourceExtraIds: (r.content.extras || []).map((e) => e.id),
    fidelityScore: r.fidelityScore,
    attempts: r.attempts,
    status: 'translated',
    updatedAt: new Date().toISOString(),
    lastEditChanges: null
  };
  const landscapeDesign = doc.design.landscape?.canvas;
  if (landscapeDesign) {
    // Same base rule as portrait: an existing variant's OWN landscape canvas
    // (per-language landscape layout edits survive; orphans pruned against
    // the same sourceExtraIds snapshot). A new language — or a variant
    // translated before the landscape design existed — starts from the
    // English landscape design canvas.
    const landscapeBase = existing?.landscapeCanvas
      ? pruneOrphanedExtras(existing.landscapeCanvas, existing.sourceExtraIds || [], r.content.extras)
      : landscapeDesign;
    variant.landscapeCanvas = applyContentToCanvas(landscapeBase, r.content);
  }
  return variant;
}

// ── translation boundary: stage-qa + context-refiner + overseer ─────────────

/** Every text field bound in a translated content object (for the QA checks). */
function boundTexts(content) {
  const out = [];
  if (content == null || typeof content !== 'object') return out;
  if (content.headline != null) out.push(content.headline);
  if (content.subheadline != null && content.subheadline !== '') out.push(content.subheadline);
  const msgs = Array.isArray(content.messages) ? content.messages
    : Array.isArray(content.blocks) ? content.blocks : [];
  for (const m of msgs) {
    if (m && m.text != null) out.push(m.text);
    else if (m && m.label != null) out.push(m.label);
  }
  if (content.callToAction != null) out.push(content.callToAction);
  for (const e of content.extras || []) if (e && e.text != null) out.push(e.text);
  return out;
}

/**
 * Translation boundary sub-agents (Job B): after a translation completes,
 * stage-qa checks {every bound text translated (present), no empty strings};
 * the context-refiner passes a translations summary forward; the overseer
 * reviews the translate stage's outbound prompting. Log-only / fire-and-forget —
 * never blocks or fails the batch. `succeeded` is the list of {lang, content}.
 */
async function translationBoundarySubAgents({ ctx, doc, succeeded, failed }) {
  const { db, bus } = ctx;
  const runId = doc.runId;

  const qa = await qaStage({
    egress: null, runId, pipeline: PIPELINE, stage: 'translation',
    artifact: { succeeded, failed },
    checks: [
      { name: 'every-bound-text-translated', fn: (a) =>
        a.succeeded.every(({ content }) => boundTexts(content).length > 0) },
      { name: 'no-empty-strings', fn: (a) =>
        a.succeeded.every(({ content }) => boundTexts(content).every((t) => typeof t === 'string' && t.trim().length > 0)) }
    ]
  });
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'stage-qa',
    agent: 'stage-qa', skill: 'qa_stage', type: 'stage_end',
    payload: { qaStage: 'translation', ok: qa.ok, score: qa.score, problems: qa.problems }
  });

  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'context-refine',
    agent: 'context-refiner', skill: 'refine_context', type: 'stage_start',
    payload: { forStage: 'save' }
  });
  const summary = {
    topic: doc.contextFile?.topic ?? '',
    translated: succeeded.map((s) => s.lang),
    failed: failed.map((f) => f.lang)
  };
  const { notes: refinerNotes } =
    await refineContext({ egress: null, runId, pipeline: PIPELINE, stage: 'save', context: summary });
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'context-refine',
    agent: 'context-refiner', skill: 'refine_context', type: 'stage_end',
    payload: { notes: refinerNotes, forStage: 'save' }
  });

  // overseer: review the translate stage's outbound prompting (non-blocking).
  // Per-language egress rows are stored under stage 'translate:<lang>' — the
  // overseer prefix-matches 'translate'.
  reviewPrompting({
    egress: ctx.egress, runId, db, bus,
    stage: 'translate', pipeline: PIPELINE, topic: doc.contextFile?.topic ?? null
  }).catch(() => { /* overseer is best-effort */ });
}

// ── public API ──────────────────────────────────────────────────────────────

/**
 * Translate the poster into the requested languages ('all' or an array of
 * target ids). Per-language gate loops; a recoverable failure in one language
 * is recorded and the batch continues. After ≥1 success the poster is phase
 * 'translated' (status 'translated').
 */
export function startTranslation(args) {
  return withPosterLock(args.posterId, () => startTranslationUnlocked(args));
}

async function startTranslationUnlocked({ ctx, posterId, languages }) {
  const { db, bus, harness } = ctx;
  const { row, doc } = loadPoster(db, posterId);
  requirePhase(doc, TRANSLATABLE_PHASES, 'translate');
  const langs = resolveLanguages(languages);

  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'translation-start',
    agent: 'user', skill: 'start_translation', type: 'user_action',
    payload: { posterId, action: 'start-translation', languages: langs }
  });
  harness.validateHandoff({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE,
    fromStage: 'editor-save', toStage: 'translation',
    fromAgent: 'user', toAgent: 'translator',
    payload: { summary: `translate into ${langs.join(', ')}`, languages: langs }
  });
  // Job A fix: pipeline-level stage_start under 'translation-agent' — the harness
  // quality-loop events are per-language ('translate:<lang>', agent 'harness'),
  // so the viz had no single translation stage bracket. This supplies it.
  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'translation',
    agent: TRANSLATION_AGENT, skill: 'translate_poster', type: 'stage_start',
    payload: { posterId, languages: langs }
  });

  // The canvas is the source of truth for what the poster actually SAYS —
  // editor text edits ride into translation (doc.content may lag behind).
  // O10 (plan D2): the PORTRAIT canvas (design.canvas) is authoritative for
  // the English copy — the translation SOURCE is always extracted from it,
  // never from design.landscape.canvas (both orientations carry the same
  // bindings, so one source feeds both). When a landscape design exists, the
  // translated text is applied onto BOTH orientations (see buildVariant).
  const sourceContent = extractContentFromCanvas(doc.design.canvas, doc.content);
  doc.translations = doc.translations || {};
  const failed = [];
  const succeeded = [];
  for (const lang of langs) {
    try {
      const r = await translateOne({ ctx, doc, lang, sourceContent });
      // canvas-base + prune + dual-orientation rules live in buildVariant
      doc.translations[lang] = buildVariant({ doc, existing: doc.translations[lang], r });
      succeeded.push({ lang, content: r.content });
    } catch (err) {
      if (!RECOVERABLE_CODES.has(err.code)) throw err;
      failed.push({ lang, code: err.code }); // batch continues — one hard language must not dead-end the rest
    }
  }
  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'translation',
    agent: TRANSLATION_AGENT, skill: 'translate_poster', type: 'stage_end',
    payload: { posterId, translated: succeeded.map((s) => s.lang), failed: failed.map((f) => f.lang) }
  });
  // ── translation boundary (Job B): stage-qa + context-refiner + overseer ────
  await translationBoundarySubAgents({ ctx, doc, succeeded, failed });
  if (Object.keys(doc.translations).length) doc.phase = 'translated';
  // durable failure ledger, MERGED: prior entries for languages in THIS batch
  // are superseded (retried), entries for languages that now have variants are
  // stale — both drop; this batch's failures append.
  doc.translationFailures = [
    ...(doc.translationFailures || []).filter((f) => !langs.includes(f.lang) && !doc.translations[f.lang]),
    ...failed
  ];
  pushSnapshot(doc, { trigger: 'translation', languages: langs, failed: failed.map((f) => f.lang) });
  const status = doc.phase === 'translated' ? 'translated' : row.status;
  savePoster(db, posterId, { status, doc });
  // harness checkpoint (spec §B.9 rollback): restore point right after the batch.
  harness.checkpoint(doc.runId, 'after-translation', { posterId, doc: structuredClone(doc) });
  return safeTranslationState({ ...row, status }, doc);
}

/** Current safe translation state for a poster (GET). */
export function getTranslationState({ ctx, posterId }) {
  const { row, doc } = loadPoster(ctx.db, posterId);
  return safeTranslationState(row, doc);
}

/** One language variant with its content + canvas (the only content/canvas exit). */
export function getTranslationVariant({ ctx, posterId, lang }) {
  const { doc } = loadPoster(ctx.db, posterId);
  const variant = (doc.translations || {})[lang];
  if (!variant) {
    throw codedError(`Poster ${posterId} has no ${lang} translation`, 'TRANSLATION_NOT_FOUND', 404);
  }
  return {
    lang,
    content: variant.content,
    canvas: variant.canvas,
    // O10 (D2): dual-orientation variants carry the landscape canvas too;
    // null for v1 posters (no landscape design) and pre-O10 variants.
    landscapeCanvas: variant.landscapeCanvas || null,
    fidelityScore: variant.fidelityScore,
    status: variant.status,
    updatedAt: variant.updatedAt
  };
}

/**
 * User edit of one variant's content: applied VERBATIM after shape validation
 * (user has final word, same rule as inlineEdit — never re-reviewed). Applied
 * onto the VARIANT's own canvas so per-language layout edits survive.
 * Terminology learning is fire-and-forget: the edit never waits on or fails
 * with it.
 */
export function editTranslation(args) {
  return withPosterLock(args.posterId, () => editTranslationUnlocked(args));
}

function editTranslationUnlocked({ ctx, posterId, lang, content }) {
  const { db, bus, egress } = ctx;
  const { row, doc } = loadPoster(db, posterId);
  requirePhase(doc, ['translated'], 'edit a translation');
  if (!TARGET_LANGUAGE_IDS.includes(lang)) {
    // editing 'en' goes through the content/editor paths, never here
    throw codedError(`lang must be one of ${TARGET_LANGUAGE_IDS.join(', ')} (got "${lang}")`, 'INVALID_LANGUAGE', 400);
  }
  const variant = (doc.translations || {})[lang];
  if (!variant) {
    throw codedError(`Poster ${posterId} has no ${lang} translation to edit`, 'TRANSLATION_NOT_FOUND', 404);
  }

  const problems = validatePosterContent(content, { enforceLengths: false });
  // extras are a translation-only structure (user-added text boxes) that
  // content_generator's shape rules predate — validate them here so a JSON
  // edit can neither strip them (content/canvas drift + phantom diffs) nor
  // rebind them to unknown canvas objects. Absent extras = unchanged.
  const prevExtras = variant.content.extras || [];
  let extras = prevExtras;
  if (content.extras != null) {
    if (!Array.isArray(content.extras)) {
      problems.push('"extras" must be an array when present');
    } else {
      const prevIds = new Set(prevExtras.map((e) => e.id));
      const seen = new Set();
      content.extras.forEach((e, i) => {
        if (!e || typeof e !== 'object' || Array.isArray(e)) {
          problems.push(`extras[${i}] must be an object`);
          return; // null/primitive entries: skip property access entirely
        }
        if (typeof e.id !== 'string' || !prevIds.has(e.id)) {
          problems.push(`extras[${i}].id must be one of the variant's existing extra ids`);
        } else if (seen.has(e.id)) {
          problems.push(`extras[${i}].id "${e.id}" is duplicated`);
        } else {
          seen.add(e.id);
        }
        if (typeof e.text !== 'string' || !e.text.trim()) {
          problems.push(`extras[${i}].text must be a non-empty string`);
        }
      });
      if (content.extras.length !== prevExtras.length) {
        problems.push(`"extras" must contain exactly the variant's ${prevExtras.length} entries (add/remove text boxes in the editor, not here)`);
      }
      if (!problems.length) {
        extras = content.extras.map((e) => ({ id: String(e.id), text: String(e.text).trim() }));
      }
    }
  }
  if (problems.length) {
    throw codedError(`content shape invalid: ${problems.join('; ')}`, 'INVALID_CONTENT', 400);
  }
  const normalized = { ...normalizePosterContent(content), extras };
  const changes = diffTextFields(variant.content, normalized);

  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'variant-edit',
    agent: 'user', skill: 'edit_translation', type: 'user_action',
    payload: { posterId, lang, changedFields: changes.map((c) => c.field) }
  });

  variant.lastEditChanges = changes; // fuels batch sync
  variant.content = normalized; // verbatim — no re-review
  variant.canvas = applyContentToCanvas(variant.canvas, normalized); // VARIANT canvas: layout edits survive
  if (variant.landscapeCanvas) {
    // O10: dual-orientation variants — the verbatim edit lands on BOTH
    // orientations (same bindings, same content); landscape layout edits
    // survive the same way portrait ones do.
    variant.landscapeCanvas = applyContentToCanvas(variant.landscapeCanvas, normalized);
  }
  variant.status = 'edited';
  variant.updatedAt = new Date().toISOString();
  savePoster(db, posterId, { doc });

  // fire-and-forget: terminology learning must never delay or fail the edit
  validateAndStoreTermSwaps({ egress, db, runId: doc.runId, lang, changes })
    .then((result) => {
      if (result.failed) {
        bus.emit({
          runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: `terminology:${lang}`,
          agent: 'terminology-validator', skill: 'store_terminology', type: 'error',
          payload: { posterId, lang, code: 'TERMINOLOGY_VALIDATION_FAILED' }
        });
      } else if (result.stored.length) {
        bus.emit({
          runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: `terminology:${lang}`,
          agent: 'terminology-validator', skill: 'store_terminology', type: 'memory_write',
          payload: { posterId, lang, stored: result.stored.map((s) => s.sourceTerm) }
        });
      }
    })
    .catch((err) => {
      // validateAndStoreTermSwaps never rejects — this shields bus failures
      console.error('[terminology-validator] event emit failed (edit already applied):', err);
    });

  return {
    state: safeTranslationState(row, doc),
    syncAvailable: Object.keys(doc.translations).length > 1 && changes.length > 0
  };
}

/**
 * Batch update (spec §B.11): after editing ONE language, re-translate every
 * OTHER existing language FROM ENGLISH carrying the edit's style preference
 * as seed feedback. The edited variant stays untouched; its pending edit is
 * consumed (lastEditChanges cleared).
 */
export function syncTranslationEdit(args) {
  return withPosterLock(args.posterId, () => syncTranslationEditUnlocked(args));
}

async function syncTranslationEditUnlocked({ ctx, posterId, lang }) {
  const { db, bus, egress, harness } = ctx;
  const { row, doc } = loadPoster(db, posterId);
  requirePhase(doc, ['translated'], 'sync a translation edit');
  const variant = (doc.translations || {})[lang];
  if (!variant || !Array.isArray(variant.lastEditChanges) || !variant.lastEditChanges.length) {
    throw codedError(`Poster ${posterId} has no pending ${lang} edit to sync`, 'NOTHING_TO_SYNC', 409);
  }

  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'variant-edit',
    agent: 'user', skill: 'sync_translations', type: 'user_action',
    payload: { posterId, lang, changedFields: variant.lastEditChanges.map((c) => c.field) }
  });

  // Best-effort style signal: null (no reusable preference / extraction
  // failure) simply means the sync proceeds without a style note.
  let pref = null;
  try {
    pref = await extractStylePreference({ egress, runId: doc.runId, lang, changes: variant.lastEditChanges });
  } catch {
    pref = null;
  }

  const seedFeedback = [{
    attempt: 0,
    feedback: `The user refined the ${lang} variant after translation.` +
      (pref ? ` Style preference to honor: ${pref.preference}` : '') +
      ` Changed fields: ${variant.lastEditChanges.map((c) => c.field).join(', ')}`,
    expected: 'A translation that carries the same refinement while staying faithful to the English source.'
  }];
  // English stays the source of truth — translations always come FROM English
  // (the PORTRAIT canvas, same rule as startTranslation; see buildVariant for
  // how the result lands on both orientations).
  const sourceContent = extractContentFromCanvas(doc.design.canvas, doc.content);

  const othersToSync = Object.keys(doc.translations).filter((l) => l !== lang);
  harness.validateHandoff({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE,
    fromStage: 'variant-edit', toStage: 'translation',
    fromAgent: 'user', toAgent: 'translator',
    payload: { summary: `sync ${lang} edit into ${othersToSync.join(', ')}`, lang, languages: othersToSync }
  });
  // Job A fix: pipeline-level stage bracket under 'translation-agent' (sync path).
  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'translation',
    agent: TRANSLATION_AGENT, skill: 'translate_poster', type: 'stage_start',
    payload: { posterId, lang, languages: othersToSync, sync: true }
  });

  const syncSucceeded = [];
  const syncFailed = [];
  for (const other of othersToSync) {
    try {
      const r = await translateOne({ ctx, doc, lang: other, sourceContent, seedFeedback });
      // ITS OWN canvas(es) (layout edits survive), minus user-text boxes
      // deleted from the English source since the last translation — pruning
      // + dual-orientation rules live in buildVariant.
      doc.translations[other] = buildVariant({ doc, existing: doc.translations[other], r });
      // a fresh success supersedes any stale failure entry for this language
      doc.translationFailures = (doc.translationFailures || []).filter((f) => f.lang !== other);
      syncSucceeded.push({ lang: other, content: r.content });
    } catch (err) {
      if (!RECOVERABLE_CODES.has(err.code)) throw err;
      doc.translationFailures = [
        ...(doc.translationFailures || []).filter((f) => f.lang !== other),
        { lang: other, code: err.code }
      ];
      syncFailed.push({ lang: other, code: err.code });
    }
  }
  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'translation',
    agent: TRANSLATION_AGENT, skill: 'translate_poster', type: 'stage_end',
    payload: { posterId, translated: syncSucceeded.map((s) => s.lang), failed: syncFailed.map((f) => f.lang), sync: true }
  });
  // ── translation boundary (Job B): stage-qa + context-refiner + overseer ────
  await translationBoundarySubAgents({ ctx, doc, succeeded: syncSucceeded, failed: syncFailed });

  variant.lastEditChanges = null; // consumed
  pushSnapshot(doc, { trigger: 'translation-sync', lang });
  savePoster(db, posterId, { doc });
  return safeTranslationState(row, doc);
}
