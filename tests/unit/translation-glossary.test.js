// Unit tests for glossary.js: static lock, DB override, case-preservation,
// upsert semantics, and null-DB fallback.
// In-memory DB with terminology table created via migrate() — matching the
// pattern in rag-keyword-store.test.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migrate } from '../../backend/db.js';
import {
  buildGlossaryFor,
  applyGlossaryLock,
  upsertTerminology,
  GLOSSARY_LOCK_TERM_LIST
} from '../../translation/glossary.js';

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

// ── Case 1: applyGlossaryLock preserves leading-letter case ──────────────────

test('applyGlossaryLock: "Phishing" stays capitalised; "phishing" stays lower', () => {
  // Default glossary list → 'phishing' canonical (same-spelling lock).
  // The case-preservation rule: if the matched word starts with an uppercase
  // letter, return canonical.charAt(0).toUpperCase() + canonical.slice(1),
  // otherwise return canonical as-is.
  const result = applyGlossaryLock('Fishing for Phishing? phishing…');
  // 'Phishing' starts with 'P' (uppercase) → canonical 'phishing' → 'Phishing'
  // 'phishing' starts with 'p' (lowercase) → canonical 'phishing' → 'phishing'
  assert.equal(result, 'Fishing for Phishing? phishing…');
});

// ── Case 2: 'mfa' and 'MFA' both normalise to 'MFA' ──────────────────────────

test('applyGlossaryLock: "mfa" → "MFA"; "MFA" stays "MFA"', () => {
  // 'mfa' matched (case-insensitive): first char 'm' is NOT uppercase
  //   → leadUpper = false → return canonical 'MFA' unchanged → 'MFA'
  // 'MFA' matched: first char 'M' IS uppercase
  //   → leadUpper = true → canonical.charAt(0).toUpperCase() + canonical.slice(1)
  //   → 'M' + 'FA' → 'MFA'
  const result = applyGlossaryLock('mfa and MFA');
  assert.equal(result, 'MFA and MFA');
});

// ── Case 3: DB override — row wins over static entry for same source term ─────

test('buildGlossaryFor: terminology row overrides static lock for same source term', () => {
  const db = freshDb();
  upsertTerminology(db, {
    lang: 'de',
    sourceTerm: 'phishing',
    approvedTerm: 'Phishing-Betrug',
    validatedBy: 'test',
    validationNote: 'validated German rendering'
  });

  const glossary = buildGlossaryFor(db, 'de');

  // The static entry for 'phishing' should be REPLACED by the DB row.
  const phishEntry = glossary.find((e) => e.match.toLowerCase() === 'phishing');
  assert.ok(phishEntry, 'phishing entry should exist in glossary');
  assert.equal(phishEntry.canonical, 'Phishing-Betrug', 'DB row should override static canonical');

  // Longer matches should sort before shorter ones.
  for (let i = 0; i < glossary.length - 1; i++) {
    assert.ok(
      glossary[i].match.length >= glossary[i + 1].match.length,
      `entry[${i}] ("${glossary[i].match}") should be >= entry[${i + 1}] ("${glossary[i + 1].match}") in length`
    );
  }
});

// ── Case 4: DB row for a NEW source term extends the glossary ─────────────────

test('buildGlossaryFor: new source term from DB is added to glossary', () => {
  const db = freshDb();
  const staticCount = buildGlossaryFor(null, null).length;

  upsertTerminology(db, {
    lang: 'es',
    sourceTerm: 'incident response',
    approvedTerm: 'respuesta ante incidentes',
    validatedBy: 'test',
    validationNote: 'security term translation'
  });

  const glossary = buildGlossaryFor(db, 'es');
  assert.equal(glossary.length, staticCount + 1, 'new DB term should extend the glossary by one');

  const newEntry = glossary.find((e) => e.match.toLowerCase() === 'incident response');
  assert.ok(newEntry, '"incident response" should be in the extended glossary');
  assert.equal(newEntry.canonical, 'respuesta ante incidentes');
});

// ── Case 5: upsertTerminology is idempotent — second write wins ───────────────

test('upsertTerminology: upsert twice yields single row; second approved_term wins', () => {
  const db = freshDb();

  upsertTerminology(db, {
    lang: 'fr',
    sourceTerm: 'phishing',
    approvedTerm: 'hameçonnage',
    validatedBy: 'agent-v1',
    validationNote: 'first insert'
  });
  upsertTerminology(db, {
    lang: 'fr',
    sourceTerm: 'phishing',
    approvedTerm: 'hameçonnage amélioré',
    validatedBy: 'agent-v2',
    validationNote: 'second insert — should win'
  });

  const rows = db
    .prepare('SELECT * FROM terminology WHERE lang = ? AND source_term = ?')
    .all('fr', 'phishing');
  assert.equal(rows.length, 1, 'upsert should produce exactly one row');
  assert.equal(rows[0].approved_term, 'hameçonnage amélioré', 'second approved_term should win');
  assert.equal(rows[0].validated_by, 'agent-v2', 'second validated_by should win');
});

// ── Case 6: buildGlossaryFor(null, null) returns the static lock only ─────────

test('buildGlossaryFor(null, null): returns only the static lock entries', () => {
  const staticGlossary = buildGlossaryFor(null, null);

  // Must contain exactly the values from GLOSSARY_LOCK.en.
  assert.ok(staticGlossary.length > 0, 'static glossary should have entries');

  // Every GLOSSARY_LOCK_TERM_LIST term must appear as a canonical with
  // match === canonical (i.e., same-spelling lock, no DB override possible here).
  for (const term of GLOSSARY_LOCK_TERM_LIST) {
    const entry = staticGlossary.find((e) => e.canonical === term);
    assert.ok(entry, `static glossary should contain "${term}"`);
  }

  // DB-side source terms never appear when db/lang are null — the Map is
  // seeded from GLOSSARY_LOCK.en values only.
  const matchSet = new Set(staticGlossary.map((e) => e.match.toLowerCase()));
  // 'incident response' is not a static lock term, must not be present
  assert.ok(!matchSet.has('incident response'), '"incident response" must not be in null-db glossary');
});

// ── Case 7 (finding S2): upsert term-shape guard ──────────────────────────────
// Terminology rows are interpolated into prompt instruction zones — unsafe
// shapes (multi-line, braces, sentinel sequences, oversized) must throw and
// never enter the DB.

test('upsertTerminology: rejects multi-line, brace, sentinel and oversized terms', () => {
  const db = freshDb();
  const base = { lang: 'de', validatedBy: 'test', validationNote: 'shape guard test' };
  const attempt = (sourceTerm, approvedTerm) =>
    () => upsertTerminology(db, { ...base, sourceTerm, approvedTerm });

  // multi-line (either side)
  assert.throws(attempt('phishing', 'Zeile eins\nZeile zwei'), /unsafe term shape/);
  assert.throws(attempt('line one\r\nline two', 'Phishing-Betrug'), /unsafe term shape/);
  // brace characters (placeholder syntax)
  assert.throws(attempt('phishing', 'Betrug {{SOC_EMAIL}}'), /unsafe term shape/);
  assert.throws(attempt('phish}ing', 'Betrug'), /unsafe term shape/);
  // '__' sentinel sequence
  assert.throws(attempt('phishing', 'Betrug __LOCK_0__'), /unsafe term shape/);
  // oversized (> 64 chars)
  assert.throws(attempt('phishing', 'B'.repeat(65)), /unsafe term shape/);
  // empty / whitespace-only
  assert.throws(attempt('   ', 'Betrug'), /unsafe term shape/);

  // nothing entered the DB
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM terminology').get().n, 0);

  // the error is coded so callers can tell shape rejects from DB failures
  try {
    upsertTerminology(db, { ...base, sourceTerm: 'phishing', approvedTerm: 'bad__term' });
    assert.fail('expected upsertTerminology to throw');
  } catch (err) {
    assert.equal(err.code, 'UNSAFE_TERM_SHAPE');
  }

  // a safe 64-char term still passes the cap boundary
  upsertTerminology(db, { ...base, sourceTerm: 'phishing', approvedTerm: 'B'.repeat(64) });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM terminology').get().n, 1);
});
