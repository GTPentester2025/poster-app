// Library pipeline (spec §B.10): save-as, rename, feedback, suggestions.
// No model calls here — pure product wiring over the posters + learning tables.
// Private helpers duplicate the ~12-line discipline from content_pipeline.js
// (same pattern as design_pipeline.js) so callers share one lock export.

import { withPosterLock } from './content_pipeline.js';

const PROJECT = 'poster-app';
const PIPELINE = 'library';

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

function savePoster(db, posterId, { status = null, name = null, doc }) {
  const now = new Date().toISOString();
  if (status && name) {
    db.prepare('UPDATE posters SET status = ?, name = ?, updated_at = ?, doc = ? WHERE poster_id = ?')
      .run(status, name, now, JSON.stringify(doc), posterId);
  } else if (status) {
    db.prepare('UPDATE posters SET status = ?, updated_at = ?, doc = ? WHERE poster_id = ?')
      .run(status, now, JSON.stringify(doc), posterId);
  } else if (name) {
    db.prepare('UPDATE posters SET name = ?, updated_at = ? WHERE poster_id = ?')
      .run(name, now, posterId);
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

// ── learning memory (same discipline as content_pipeline) ───────────────────

function recordLearning(db, bus, runId, { kind, topic, angle = null, detail, weight = 1.0 }) {
  const detailJson = JSON.stringify(detail);
  const info = db.prepare(
    'INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(new Date().toISOString(), kind, topic, angle, detailJson, weight);
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'learning-memory',
    agent: 'learning-memory', skill: 'store_learning', type: 'memory_write',
    payload: { kind, topic, angle, learningId: Number(info.lastInsertRowid) }
  });
  return Number(info.lastInsertRowid);
}

// ── name validation ──────────────────────────────────────────────────────────

function validateName(name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed || trimmed.length > 120) {
    throw codedError('name must be a non-empty string of 1-120 characters', 'INVALID_NAME', 400);
  }
  return trimmed;
}

// ── safe library view ────────────────────────────────────────────────────────

/**
 * Library-safe state: subset of poster fields safe to send to the library UI.
 * Never includes contextFile internals or canvases.
 */
export function librarySafeState(row, doc) {
  return {
    posterId: row.poster_id,
    name: row.name,
    status: row.status,
    phase: doc.phase,
    savedAt: doc.savedAt || null,
    topic: doc.contextFile?.topic ?? null,
    headline: doc.content?.headline || null
  };
}

// ── public API ───────────────────────────────────────────────────────────────

const SAVE_PHASES = ['designed', 'translated', 'saved'];

/**
 * Save a poster under a custom name (spec §B.10 save flow).
 * Sets phase='saved', status='saved', doc.savedAt. Inserts an 'approval'
 * learning row ONLY on the FIRST save (doc.savedAt previously absent).
 */
export function savePosterAs(args) {
  return withPosterLock(args.posterId, () => savePosterAsUnlocked(args));
}

function savePosterAsUnlocked({ ctx, posterId, name }) {
  const { db, bus } = ctx;
  const trimmedName = validateName(name);
  const { row, doc } = loadPoster(db, posterId);
  requirePhase(doc, SAVE_PHASES, 'save poster');

  const isFirstSave = !doc.savedAt;
  doc.savedAt = new Date().toISOString();
  doc.phase = 'saved';

  pushSnapshot(doc, { trigger: 'save', name: trimmedName });
  savePoster(db, posterId, { status: 'saved', name: trimmedName, doc });

  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'save',
    agent: 'user', skill: 'save_poster', type: 'user_action',
    payload: { posterId, name: trimmedName }
  });

  // First save only: approval signal for this topic
  if (isFirstSave && doc.contextFile?.topic) {
    recordLearning(db, bus, doc.runId, {
      kind: 'approval',
      topic: doc.contextFile.topic,
      angle: null,
      detail: { posterId, headline: doc.content?.headline, event: 'saved' },
      weight: 1.0
    });
  }

  return librarySafeState({ ...row, name: trimmedName, status: 'saved' }, doc);
}

/**
 * Rename a poster (spec §B.10). Allowed in any phase (poster must exist).
 * Only updates the name row field; never touches doc or status.
 */
export function renamePoster(args) {
  return withPosterLock(args.posterId, () => renamePosterUnlocked(args));
}

function renamePosterUnlocked({ ctx, posterId, name }) {
  const { db, bus } = ctx;
  const trimmedName = validateName(name);
  const { doc } = loadPoster(db, posterId);

  // Update name only — doc and status are untouched
  savePoster(db, posterId, { name: trimmedName, doc }); // doc write avoids, but name is updated via the name path
  // Re-read row to get updated name
  const updatedRow = db.prepare('SELECT * FROM posters WHERE poster_id = ?').get(posterId);

  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'rename',
    agent: 'user', skill: 'rename_poster', type: 'user_action',
    payload: { posterId, name: trimmedName }
  });

  return librarySafeState(updatedRow, doc);
}

/**
 * Record poster feedback rating (spec §B.10). rating ∈ {'good','bad'}.
 * Inserts a 'feedback' learning row; memory_write event.
 * Poster must have content (phase not 'angles').
 */
export function recordPosterFeedback({ ctx, posterId, rating, remarks }) {
  const { db, bus } = ctx;

  if (rating !== 'good' && rating !== 'bad') {
    throw codedError("rating must be 'good' or 'bad'", 'INVALID_FEEDBACK', 400);
  }

  const remarksStr = String(remarks ?? '').trim().slice(0, 2000);

  const { doc } = loadPoster(db, posterId);
  if (doc.phase === 'angles') {
    throw codedError('Cannot record feedback: poster has no content yet (phase "angles")', 'WRONG_PHASE', 409);
  }

  const topic = doc.contextFile?.topic ?? '';
  const learningId = recordLearning(db, bus, doc.runId, {
    kind: 'feedback',
    topic,
    angle: null,
    detail: { posterId, rating, remarks: remarksStr, headline: doc.content?.headline },
    weight: rating === 'good' ? 1.0 : -1.0
  });

  return { ok: true, learningId };
}

/**
 * Get "what worked best" suggestions for a topic (spec §B.10).
 * Newest 5 approval or good-feedback rows for the topic; falls back to global
 * when the topic has nothing. Returns mapped suggestion objects.
 */
export function getSuggestions({ ctx, topic }) {
  const { db } = ctx;
  const trimmedTopic = String(topic ?? '').trim();
  if (!trimmedTopic || trimmedTopic.length > 120) {
    throw codedError('topic must be a non-empty string of 1-120 characters', 'INVALID_TOPIC', 400);
  }

  // 'feedback' rows require an EXPLICIT rating='good': the Phase-4 content
  // loop also inserts kind='feedback' rows (corrective user remarks about a
  // draft, default weight 1.0, no rating field) — weight alone would surface
  // the criticized draft's headline as "rated good", inverting the signal.
  const POSITIVE = `((kind = 'approval')
       OR (kind = 'feedback' AND weight > 0 AND json_extract(detail, '$.rating') = 'good'))`;
  const topicRows = db.prepare(
    `SELECT topic, kind, angle, detail, weight FROM learning
     WHERE topic = ? AND ${POSITIVE}
     ORDER BY ts DESC, id DESC LIMIT 5`
  ).all(trimmedTopic);

  const source = topicRows.length > 0 ? topicRows : db.prepare(
    `SELECT topic, kind, angle, detail, weight FROM learning
     WHERE ${POSITIVE}
     ORDER BY ts DESC, id DESC LIMIT 5`
  ).all();

  // data minimization: only what the UIs render (+ the row's REAL topic,
  // which differs from the requested one on the global fallback) — never the
  // raw detail (it can carry 2000-char remarks / Phase-4 feedback prose)
  const suggestions = source.map((r) => {
    let detail = null;
    try { detail = JSON.parse(r.detail); } catch { /* legacy */ }
    return {
      headline: detail?.headline ?? null,
      topic: r.topic,
      angle: r.angle ?? null,
      signal: r.kind === 'approval' ? 'approved' : 'rated-good'
    };
  });

  return { topic: trimmedTopic, suggestions };
}
