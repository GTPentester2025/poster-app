// Keyword store (SQLite-backed port of reference keyword_store.js):
// empty table -> defaults, mutations materialize defaults first (removing a
// default keyword must persist "defaults minus one", like the reference's
// localStorage load()-then-save flow).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migrate } from '../../backend/db.js';
import {
  getScoringSnapshot, addKeyword, removeKeyword, setNoiseKeywords, resetDefaults
} from '../../rag/keyword_store.js';
import { DEFAULT_CRITICAL, DEFAULT_NOISE, scoreText } from '../../rag/scoring.js';

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

test('empty table yields the scoring defaults', () => {
  const snap = getScoringSnapshot(freshDb());
  assert.deepEqual(snap.critical, DEFAULT_CRITICAL);
  assert.deepEqual(snap.noise, DEFAULT_NOISE);
});

test('addKeyword materializes defaults then appends (normalized, deduped)', () => {
  const db = freshDb();
  const snap = addKeyword(db, 'critical', '  USB Drop  ');
  assert.equal(snap.critical.length, DEFAULT_CRITICAL.length + 1);
  assert.ok(snap.critical.includes('usb drop'));
  // duplicate add is a no-op
  assert.equal(addKeyword(db, 'critical', 'usb drop').critical.length, DEFAULT_CRITICAL.length + 1);
  // invalid list type leaves everything untouched
  assert.equal(addKeyword(db, 'bogus', 'x').critical.length, DEFAULT_CRITICAL.length + 1);
});

test('removeKeyword persists defaults-minus-one and changes scoring', () => {
  const db = freshDb();
  const snap = removeKeyword(db, 'critical', 'ransomware');
  assert.ok(!snap.critical.includes('ransomware'));
  assert.equal(snap.critical.length, DEFAULT_CRITICAL.length - 1);
  // scoring through the persisted snapshot no longer credits the removed term
  assert.equal(scoreText('ransomware attack on logistics firm', getScoringSnapshot(db)), 0);
});

test('setXKeywords replaces a list; resetDefaults restores everything', () => {
  const db = freshDb();
  setNoiseKeywords(db, ['webinar', 'conference recap']);
  assert.deepEqual(getScoringSnapshot(db).noise, ['webinar', 'conference recap']);
  const snap = resetDefaults(db);
  // Defaults contain no trailing-space sentinels anymore (word-boundary
  // matching in scoring.js replaced them), so the save round-trip is exact.
  assert.deepEqual(snap.noise, DEFAULT_NOISE);
  assert.deepEqual(snap.critical, DEFAULT_CRITICAL);
});
