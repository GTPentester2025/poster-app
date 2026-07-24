// Keyword CRUD — port of reference js/keyword_store.js with the persistence
// swapped from localStorage ('awareness_feed_scoring_v2') to the SQLite
// `keywords` table created in migration 1. The API surface and semantics are
// unchanged: an empty store yields the scoring.js defaults, and any mutation
// against an empty list first materializes the defaults (the reference's
// load() returned defaults before applying mutations, so removing a default
// keyword must persist "defaults minus one" — not an empty list).

import { DEFAULT_CRITICAL, DEFAULT_CONTEXT, DEFAULT_NOISE } from './scoring.js';

const LIST_TYPES = ['critical', 'context', 'noise'];
const DEFAULTS = {
  critical: DEFAULT_CRITICAL,
  context: DEFAULT_CONTEXT,
  noise: DEFAULT_NOISE
};

// Same normalize as reference: trim, lowercase, drop empties, dedupe (order kept).
function normalize(arr) {
  const seen = new Set();
  return (arr || [])
    .map((v) => String(v || '').trim().toLowerCase())
    .filter((v) => v && !seen.has(v) && (seen.add(v) || true));
}

function loadList(db, listType) {
  return db.prepare('SELECT keyword FROM keywords WHERE list_type = ? ORDER BY rowid').all(listType)
    .map((r) => r.keyword);
}

// Replace one list atomically. Called inside mutations only — reads never write.
function saveList(db, listType, list) {
  const clean = normalize(list);
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare('DELETE FROM keywords WHERE list_type = ?').run(listType);
    const ins = db.prepare('INSERT INTO keywords (list_type, keyword, added_at) VALUES (?, ?, ?)');
    for (const k of clean) ins.run(listType, k, now);
  })();
  return clean;
}

// Mutations must start from what the user currently *sees* (defaults when the
// table is empty), mirroring the reference load()-then-save flow.
function effectiveList(db, listType) {
  const stored = loadList(db, listType);
  return stored.length ? stored : [...DEFAULTS[listType]];
}

/** Current scoring lists; empty table (per list) falls back to defaults. */
export function getScoringSnapshot(db) {
  return {
    critical: effectiveList(db, 'critical'),
    context: effectiveList(db, 'context'),
    noise: effectiveList(db, 'noise')
  };
}

export function addKeyword(db, listType, keyword) {
  const key = String(keyword || '').trim().toLowerCase();
  if (!key || !LIST_TYPES.includes(listType)) return getScoringSnapshot(db);
  saveList(db, listType, [...effectiveList(db, listType), key]);
  return getScoringSnapshot(db);
}

export function removeKeyword(db, listType, keyword) {
  const key = String(keyword || '').trim().toLowerCase();
  if (!LIST_TYPES.includes(listType)) return getScoringSnapshot(db);
  saveList(db, listType, effectiveList(db, listType).filter((k) => k !== key));
  return getScoringSnapshot(db);
}

export function setCriticalKeywords(db, list) {
  saveList(db, 'critical', list);
  return getScoringSnapshot(db);
}

export function setContextKeywords(db, list) {
  saveList(db, 'context', list);
  return getScoringSnapshot(db);
}

export function setNoiseKeywords(db, list) {
  saveList(db, 'noise', list);
  return getScoringSnapshot(db);
}

/** Restore all three lists to the shipped defaults (persisted explicitly). */
export function resetDefaults(db) {
  for (const listType of LIST_TYPES) saveList(db, listType, [...DEFAULTS[listType]]);
  return getScoringSnapshot(db);
}
