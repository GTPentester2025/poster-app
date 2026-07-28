// Library pipeline tests (spec §B.10): save-as, rename, feedback, suggestions,
// buildLearningHints feedback extension, and HTTP route discipline.
// Scaffolding pattern from translation-pipeline.test.js (makeCtx/seedPoster),
// HTTP pattern from translation-routes.test.js (createServer / session-token).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newRunId } from '#shared';
import { EventBus } from '#shared';
import { GateEngine, Harness } from '#orchestration';
import { openDb } from '../../backend/db.js';
import { savePosterAs, renamePoster, recordPosterFeedback, getSuggestions } from '../../pipelines/library.js';
import { buildLearningHints } from '../../pipelines/content_pipeline.js';
import { createServer } from '../../backend/server.js';
import { createAppContext } from '../../backend/app-context.js';
import { FakeEgress } from './helpers/fake_egress.js';

// ── scaffolding ──────────────────────────────────────────────────────────────

function makeCtx(egress = null) {
  const dir = mkdtempSync(join(tmpdir(), 'postter-library-'));
  const db = openDb(join(dir, 'test.sqlite'));
  const bus = new EventBus({ logDir: join(dir, 'runs'), db });
  const gateEngine = new GateEngine({ bus });
  const harness = new Harness({ bus, gateEngine });
  return { db, bus, vault: null, egress, gateEngine, harness };
}

function seedPoster(db, {
  phase = 'designed', status = 'designed', topic = 'phishing',
  headline = 'Stay Safe Online', savedAt = undefined,
  templateId = null, translations = {}
} = {}) {
  const posterId = randomUUID();
  const runId = newRunId('poster');
  const doc = {
    prompt: 'stop phishing emails', runId, phase, grounded: true,
    contextFile: { topic, angles: [] },
    content: { headline, messages: [], callToAction: null, format: 'dos-donts' },
    design: { canvas: { version: '6.0.0', objects: [] }, ...(templateId ? { templateId } : {}) },
    translations,
    snapshots: [],
    ...(savedAt !== undefined ? { savedAt } : {})
  };
  const now = new Date().toISOString();
  db.prepare('INSERT INTO posters (poster_id, name, status, created_at, updated_at, doc) VALUES (?, ?, ?, ?, ?, ?)')
    .run(posterId, `${topic} poster`, status, now, now, JSON.stringify(doc));
  return { posterId, runId };
}

function loadDoc(db, posterId) {
  return JSON.parse(db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc);
}

function loadRow(db, posterId) {
  return db.prepare('SELECT * FROM posters WHERE poster_id = ?').get(posterId);
}

// ── HTTP server helpers ──────────────────────────────────────────────────────

function startServer(egress = null) {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-library-routes-'));
  const ctx = createAppContext({
    dataDir, logDir: join(dataDir, 'runs'), dbPath: join(dataDir, 'test.sqlite'),
    egress: egress || new FakeEgress({})
  });
  const { app, token } = createServer(ctx, { dataDir });
  return new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => {
      resolve({ srv, ctx, token, base: `http://127.0.0.1:${srv.address().port}` });
    });
  });
}

function req(base, token, path, method = 'GET', body = undefined) {
  return fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}

// ── Test group 1: savePosterAs happy path ────────────────────────────────────

test('savePosterAs from "designed": status+phase saved, savedAt set, name updated, snapshot appended, user_action emitted, approval learning row inserted', async () => {
  const ctx = makeCtx();
  const { posterId, runId } = seedPoster(ctx.db, { phase: 'designed', status: 'designed' });

  const result = await savePosterAs({ ctx, posterId, name: 'My Phishing Poster' });

  // status + phase
  assert.equal(result.status, 'saved');
  assert.equal(result.phase, 'saved');
  assert.ok(result.savedAt, 'savedAt must be set');
  assert.equal(result.name, 'My Phishing Poster');

  // DB row
  const row = loadRow(ctx.db, posterId);
  assert.equal(row.status, 'saved');
  assert.equal(row.name, 'My Phishing Poster');

  // doc state
  const doc = loadDoc(ctx.db, posterId);
  assert.equal(doc.phase, 'saved');
  assert.ok(doc.savedAt, 'doc.savedAt set');

  // snapshot appended
  assert.ok(doc.snapshots.length >= 1, 'snapshot appended');
  const snap = doc.snapshots.find((s) => s.state?.trigger === 'save');
  assert.ok(snap, 'save snapshot present');
  assert.equal(snap.state.name, 'My Phishing Poster');

  // user_action event
  const events = ctx.bus.eventsForRun(runId);
  assert.ok(events.some((e) => e.type === 'user_action' && e.skill === 'save_poster'));

  // approval learning row
  const learningRow = ctx.db.prepare("SELECT * FROM learning WHERE kind = 'approval' ORDER BY id DESC LIMIT 1").get();
  assert.ok(learningRow, 'approval learning row inserted');
  assert.equal(learningRow.topic, 'phishing');
  const detail = JSON.parse(learningRow.detail);
  assert.equal(detail.posterId, posterId);
  assert.equal(detail.event, 'saved');
});

test('savePosterAs: second save (re-save) does NOT insert a second approval learning row', async () => {
  const ctx = makeCtx();
  const { posterId } = seedPoster(ctx.db, { phase: 'designed', status: 'designed' });

  // First save
  await savePosterAs({ ctx, posterId, name: 'First Name' });
  const countAfterFirst = ctx.db.prepare("SELECT COUNT(*) AS c FROM learning WHERE kind = 'approval'").get().c;

  // Second save (re-save from 'saved' phase)
  await savePosterAs({ ctx, posterId, name: 'Second Name' });
  const countAfterSecond = ctx.db.prepare("SELECT COUNT(*) AS c FROM learning WHERE kind = 'approval'").get().c;

  assert.equal(countAfterFirst, countAfterSecond, 'second save must not insert another approval row');
});

// ── Test group 2: savePosterAs phase validation + name validation ─────────────

test('savePosterAs from "translated" works', async () => {
  const ctx = makeCtx();
  const { posterId } = seedPoster(ctx.db, { phase: 'translated', status: 'translated' });
  const result = await savePosterAs({ ctx, posterId, name: 'Translated Save' });
  assert.equal(result.phase, 'saved');
  assert.equal(result.status, 'saved');
});

test('savePosterAs from "angles" → 409 WRONG_PHASE', async () => {
  const ctx = makeCtx();
  const { posterId } = seedPoster(ctx.db, { phase: 'angles', status: 'draft' });
  await assert.rejects(
    savePosterAs({ ctx, posterId, name: 'Too Early' }),
    (err) => err.code === 'WRONG_PHASE' && err.status === 409
  );
});

test('savePosterAs with empty name → 400 INVALID_NAME', async () => {
  const ctx = makeCtx();
  const { posterId } = seedPoster(ctx.db);
  await assert.rejects(
    savePosterAs({ ctx, posterId, name: '   ' }),
    (err) => err.code === 'INVALID_NAME' && err.status === 400
  );
});

test('savePosterAs with 121-char name → 400 INVALID_NAME', async () => {
  const ctx = makeCtx();
  const { posterId } = seedPoster(ctx.db);
  const longName = 'a'.repeat(121);
  await assert.rejects(
    savePosterAs({ ctx, posterId, name: longName }),
    (err) => err.code === 'INVALID_NAME' && err.status === 400
  );
});

test('savePosterAs with unknown poster → 404 POSTER_NOT_FOUND', async () => {
  const ctx = makeCtx();
  await assert.rejects(
    savePosterAs({ ctx, posterId: randomUUID(), name: 'Ghost' }),
    (err) => err.code === 'POSTER_NOT_FOUND' && err.status === 404
  );
});

// ── Test group 3: renamePoster ───────────────────────────────────────────────

test('renamePoster updates name only; status and phase are untouched (pre-save)', async () => {
  const ctx = makeCtx();
  const { posterId } = seedPoster(ctx.db, { phase: 'designed', status: 'designed' });

  const result = await renamePoster({ ctx, posterId, name: 'New Name Pre-Save' });

  assert.equal(result.name, 'New Name Pre-Save');
  // status + phase must be the original values, unchanged
  assert.equal(result.status, 'designed');
  assert.equal(result.phase, 'designed');

  const row = loadRow(ctx.db, posterId);
  assert.equal(row.name, 'New Name Pre-Save');
  assert.equal(row.status, 'designed');

  // doc is untouched (phase still 'designed')
  const doc = loadDoc(ctx.db, posterId);
  assert.equal(doc.phase, 'designed');
  // No snapshots added by rename
  assert.equal(doc.snapshots.length, 0);
});

test('renamePoster works post-save (phase=saved)', async () => {
  const ctx = makeCtx();
  const { posterId } = seedPoster(ctx.db, { phase: 'designed', status: 'designed' });
  await savePosterAs({ ctx, posterId, name: 'Original Name' });

  const result = await renamePoster({ ctx, posterId, name: 'Renamed After Save' });
  assert.equal(result.name, 'Renamed After Save');
  assert.equal(result.phase, 'saved');
  assert.equal(result.status, 'saved');
});

test('renamePoster with empty name → 400 INVALID_NAME', async () => {
  const ctx = makeCtx();
  const { posterId } = seedPoster(ctx.db);
  await assert.rejects(
    renamePoster({ ctx, posterId, name: '' }),
    (err) => err.code === 'INVALID_NAME' && err.status === 400
  );
});

test('renamePoster trims name whitespace', async () => {
  const ctx = makeCtx();
  const { posterId } = seedPoster(ctx.db);
  const result = await renamePoster({ ctx, posterId, name: '  Trimmed  ' });
  assert.equal(result.name, 'Trimmed');
});

// ── Test group 4: recordPosterFeedback ──────────────────────────────────────

test('recordPosterFeedback "good" → learning row weight 1.0 + memory_write event', () => {
  const ctx = makeCtx();
  const { posterId, runId } = seedPoster(ctx.db, { phase: 'designed' });

  const result = recordPosterFeedback({ ctx, posterId, rating: 'good', remarks: 'Great poster!' });

  assert.ok(result.ok);
  assert.ok(typeof result.learningId === 'number');

  const row = ctx.db.prepare('SELECT * FROM learning WHERE id = ?').get(result.learningId);
  assert.equal(row.kind, 'feedback');
  assert.equal(row.weight, 1.0);
  const detail = JSON.parse(row.detail);
  assert.equal(detail.rating, 'good');
  assert.equal(detail.remarks, 'Great poster!');
  assert.equal(detail.posterId, posterId);

  const events = ctx.bus.eventsForRun(runId);
  assert.ok(events.some((e) => e.type === 'memory_write' && e.skill === 'store_learning'), 'memory_write event emitted');
});

test('recordPosterFeedback "bad" → learning row weight -1.0', () => {
  const ctx = makeCtx();
  const { posterId } = seedPoster(ctx.db, { phase: 'designed' });

  const result = recordPosterFeedback({ ctx, posterId, rating: 'bad', remarks: 'Needs work' });

  assert.ok(result.ok);
  const row = ctx.db.prepare('SELECT * FROM learning WHERE id = ?').get(result.learningId);
  assert.equal(row.weight, -1.0);
  const detail = JSON.parse(row.detail);
  assert.equal(detail.rating, 'bad');
});

test('recordPosterFeedback remarks capped at 2000 chars', () => {
  const ctx = makeCtx();
  const { posterId } = seedPoster(ctx.db, { phase: 'designed' });
  const longRemarks = 'x'.repeat(5000);

  const result = recordPosterFeedback({ ctx, posterId, rating: 'good', remarks: longRemarks });

  const row = ctx.db.prepare('SELECT * FROM learning WHERE id = ?').get(result.learningId);
  const detail = JSON.parse(row.detail);
  assert.equal(detail.remarks.length, 2000, 'remarks capped at 2000 chars');
});

test('recordPosterFeedback invalid rating → 400 INVALID_FEEDBACK', () => {
  const ctx = makeCtx();
  const { posterId } = seedPoster(ctx.db, { phase: 'designed' });
  assert.throws(
    () => recordPosterFeedback({ ctx, posterId, rating: 'meh' }),
    (err) => err.code === 'INVALID_FEEDBACK' && err.status === 400
  );
});

test('recordPosterFeedback poster in "angles" → 409 WRONG_PHASE', () => {
  const ctx = makeCtx();
  const { posterId } = seedPoster(ctx.db, { phase: 'angles' });
  assert.throws(
    () => recordPosterFeedback({ ctx, posterId, rating: 'good' }),
    (err) => err.code === 'WRONG_PHASE' && err.status === 409
  );
});

// ── Test group 5: getSuggestions ─────────────────────────────────────────────

test('getSuggestions: approval + good feedback → both surface newest-first with correct signal labels', () => {
  const ctx = makeCtx();
  const { posterId } = seedPoster(ctx.db, { phase: 'designed', topic: 'phishing' });

  // Insert an approval row
  ctx.db.prepare(
    "INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'approval', 'phishing', null, ?, 1.0)"
  ).run(new Date(Date.now() - 1000).toISOString(), JSON.stringify({ posterId, headline: 'Approved Headline', event: 'saved' }));

  // Insert a good-feedback row (newer)
  ctx.db.prepare(
    "INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'feedback', 'phishing', null, ?, 1.0)"
  ).run(new Date().toISOString(), JSON.stringify({ posterId, rating: 'good', headline: 'Good Feedback Headline', remarks: '' }));

  const { topic, suggestions } = getSuggestions({ ctx, topic: 'phishing' });

  assert.equal(topic, 'phishing');
  assert.ok(suggestions.length >= 2, 'at least 2 suggestions returned');

  const signals = suggestions.map((s) => s.signal);
  assert.ok(signals.includes('approved'), '"approved" signal present');
  assert.ok(signals.includes('rated-good'), '"rated-good" signal present');

  // Newest first — good feedback was inserted after approval
  assert.equal(suggestions[0].signal, 'rated-good', 'newest (feedback) is first');
  assert.equal(suggestions[1].signal, 'approved', 'older (approval) is second');
});

test('getSuggestions: bad feedback NEVER surfaces as a suggestion', () => {
  const ctx = makeCtx();
  const { posterId } = seedPoster(ctx.db, { phase: 'designed', topic: 'phishing' });

  // Insert only bad feedback
  ctx.db.prepare(
    "INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'feedback', 'phishing', null, ?, -1.0)"
  ).run(new Date().toISOString(), JSON.stringify({ posterId, rating: 'bad', headline: 'Bad Headline', remarks: '' }));

  const { suggestions } = getSuggestions({ ctx, topic: 'phishing' });

  assert.ok(!suggestions.some((s) => s.headline === 'Bad Headline'), 'bad feedback must not surface');
});

test('getSuggestions: unknown topic falls back to global rows', () => {
  const ctx = makeCtx();

  // Seed a row for a DIFFERENT topic
  ctx.db.prepare(
    "INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'approval', 'ransomware', null, ?, 1.0)"
  ).run(new Date().toISOString(), JSON.stringify({ headline: 'Global Fallback Headline' }));

  // Query a completely new topic with no rows
  const { suggestions } = getSuggestions({ ctx, topic: 'brand-new-topic' });

  assert.ok(suggestions.length >= 1, 'global fallback returns rows');
  assert.ok(suggestions.some((s) => s.headline === 'Global Fallback Headline'), 'global row surfaced as fallback');
});

test('getSuggestions: empty topic → 400 INVALID_TOPIC', () => {
  const ctx = makeCtx();
  assert.throws(
    () => getSuggestions({ ctx, topic: '   ' }),
    (err) => err.code === 'INVALID_TOPIC' && err.status === 400
  );
});

test('getSuggestions: null/undefined topic → 400 INVALID_TOPIC', () => {
  const ctx = makeCtx();
  assert.throws(
    () => getSuggestions({ ctx, topic: null }),
    (err) => err.code === 'INVALID_TOPIC' && err.status === 400
  );
});

// ── Test group 6: buildLearningHints feedback extension ─────────────────────

test('buildLearningHints: "good" feedback row → positive hint phrasing, fenced in <user_text>', () => {
  const ctx = makeCtx();
  ctx.db.prepare(
    "INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'feedback', 'phishing', null, ?, 1.0)"
  ).run(new Date().toISOString(), JSON.stringify({ rating: 'good', headline: 'Great Security Headline', remarks: '' }));

  const hints = buildLearningHints(ctx.db, 'phishing');
  assert.ok(hints.length >= 1, 'hint produced for good feedback');
  const goodHint = hints.find((h) => h.includes('GOOD'));
  assert.ok(goodHint, '"GOOD" rating hint present');
  assert.ok(goodHint.includes('Great Security Headline'), 'headline in hint');
  assert.ok(goodHint.includes('similar framing works'), 'positive phrasing');
  assert.ok(goodHint.includes('<user_text>'), 'fenced in <user_text>');
});

test('buildLearningHints: "bad" feedback row → avoid-phrasing, fenced in <user_text>', () => {
  const ctx = makeCtx();
  ctx.db.prepare(
    "INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'feedback', 'phishing', null, ?, -1.0)"
  ).run(new Date().toISOString(), JSON.stringify({ rating: 'bad', headline: 'Poor Security Headline', remarks: '' }));

  const hints = buildLearningHints(ctx.db, 'phishing');
  assert.ok(hints.length >= 1, 'hint produced for bad feedback');
  const badHint = hints.find((h) => h.includes('BAD'));
  assert.ok(badHint, '"BAD" rating hint present');
  assert.ok(badHint.includes('Poor Security Headline'), 'headline in hint');
  assert.ok(badHint.includes('avoid repeating that approach'), 'avoid phrasing');
  assert.ok(badHint.includes('<user_text>'), 'fenced in <user_text>');
});

test('buildLearningHints: approval/rejection/edit_learning hints still work after feedback extension', () => {
  const ctx = makeCtx();
  const now = new Date().toISOString();

  ctx.db.prepare(
    "INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'approval', 'phishing', 'Human-first angle', ?, 1.0)"
  ).run(now, JSON.stringify({ headline: 'Approved H' }));

  ctx.db.prepare(
    "INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'rejection', 'phishing', null, ?, 1.0)"
  ).run(now, JSON.stringify({ headline: 'Rejected H' }));

  ctx.db.prepare(
    "INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'edit_learning', 'phishing', null, ?, 1.0)"
  ).run(now, JSON.stringify({ changeType: 'tone', guidance: 'Be more direct' }));

  const hints = buildLearningHints(ctx.db, 'phishing');
  assert.ok(hints.some((h) => h.includes('APPROVED')), 'approval hint present');
  assert.ok(hints.some((h) => h.includes('REJECTED')), 'rejection hint present');
  assert.ok(hints.some((h) => h.includes('Be more direct')), 'edit_learning hint present');
  assert.ok(hints.every((h) => h.includes('<user_text>')), 'all hints fenced');
});

test('buildLearningHints: feedback row without headline produces no hint (skipped gracefully)', () => {
  const ctx = makeCtx();
  // Feedback without a headline should be skipped (no headline to include in hint)
  ctx.db.prepare(
    "INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'feedback', 'phishing', null, ?, 1.0)"
  ).run(new Date().toISOString(), JSON.stringify({ rating: 'good', remarks: '' }));

  const hints = buildLearningHints(ctx.db, 'phishing');
  // No hint should be produced for a feedback row without a headline
  const feedbackHints = hints.filter((h) => h.includes('GOOD') || h.includes('BAD'));
  assert.equal(feedbackHints.length, 0, 'no hint for feedback without headline');
});

// ── Test group 7: Routes ─────────────────────────────────────────────────────


test('POST /api/posters/:id/save happy path → 200 with saved state', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    const { posterId } = seedPoster(ctx.db, { phase: 'designed', status: 'designed' });
    const res = await req(base, token, `/api/posters/${posterId}/save`, 'POST', { name: 'My Saved Poster' });
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    const state = await res.json();
    assert.equal(state.posterId, posterId);
    assert.equal(state.status, 'saved');
    assert.equal(state.phase, 'saved');
    assert.equal(state.name, 'My Saved Poster');
    assert.ok(state.savedAt, 'savedAt in response');
  } finally { srv.close(); }
});

test('PUT /api/posters/:id/name happy path → 200 with renamed state', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    const { posterId } = seedPoster(ctx.db, { phase: 'designed', status: 'designed' });
    const res = await req(base, token, `/api/posters/${posterId}/name`, 'PUT', { name: 'Renamed Poster' });
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    const state = await res.json();
    assert.equal(state.name, 'Renamed Poster');
    assert.equal(state.status, 'designed', 'status unchanged after rename');
  } finally { srv.close(); }
});

test('POST /api/posters/:id/feedback happy path → 200 with learningId', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    const { posterId } = seedPoster(ctx.db, { phase: 'designed', status: 'designed' });
    const res = await req(base, token, `/api/posters/${posterId}/feedback`, 'POST', { rating: 'good', remarks: 'Well done' });
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.ok(typeof body.learningId === 'number');
  } finally { srv.close(); }
});

test('GET /api/posters/suggestions?topic=phishing → 200 with suggestions array (not shadowed by /:posterId)', async () => {
  const { srv, base, token } = await startServer();
  try {
    const res = await req(base, token, '/api/posters/suggestions?topic=phishing');
    assert.equal(res.status, 200, `suggestions must not be shadowed by /:posterId param, got ${res.status}`);
    const body = await res.json();
    assert.equal(body.topic, 'phishing');
    assert.ok(Array.isArray(body.suggestions), 'suggestions is array');
  } finally { srv.close(); }
});

test('GET /api/posters/suggestions without topic → 400 INVALID_TOPIC', async () => {
  const { srv, base, token } = await startServer();
  try {
    const res = await req(base, token, '/api/posters/suggestions');
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'INVALID_TOPIC');
  } finally { srv.close(); }
});

test('POST /api/posters/:id/save with wrong phase → 409 WRONG_PHASE', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    const { posterId } = seedPoster(ctx.db, { phase: 'angles', status: 'draft' });
    const res = await req(base, token, `/api/posters/${posterId}/save`, 'POST', { name: 'Too Early' });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, 'WRONG_PHASE');
  } finally { srv.close(); }
});

test('POST /api/posters/:id/feedback with invalid rating → 400 INVALID_FEEDBACK', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    const { posterId } = seedPoster(ctx.db, { phase: 'designed', status: 'designed' });
    const res = await req(base, token, `/api/posters/${posterId}/feedback`, 'POST', { rating: 'meh' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'INVALID_FEEDBACK');
  } finally { srv.close(); }
});

test('GET /api/posters list includes topic, headline, savedAt fields', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    seedPoster(ctx.db, { phase: 'designed', status: 'designed', topic: 'ransomware', headline: 'Watch Out For Ransomware' });
    const res = await req(base, token, '/api/posters');
    assert.equal(res.status, 200);
    const { posters } = await res.json();
    assert.ok(posters.length >= 1, 'at least one poster');
    const p = posters.find((x) => x.topic === 'ransomware');
    assert.ok(p, 'poster in list');
    assert.equal(p.headline, 'Watch Out For Ransomware');
    assert.equal(p.savedAt, null, 'unsaved poster has null savedAt');
  } finally { srv.close(); }
});

// ── T5: list thumbnails (previewSvg) + languages count ──────────────────────

test('GET /api/posters: v2-template poster carries the template portrait preview SVG', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    seedPoster(ctx.db, { topic: 'gdpr', headline: 'Know Your Data Rights', templateId: 'statement-bold' });
    const res = await req(base, token, '/api/posters');
    assert.equal(res.status, 200);
    const { posters } = await res.json();
    const p = posters.find((x) => x.topic === 'gdpr');
    assert.ok(p, 'poster in list');
    assert.ok(typeof p.previewSvg === 'string' && p.previewSvg.includes('<svg'), 'previewSvg is an SVG string');
    // template previews are pure palette geometry — the headline never enters them
    assert.ok(!p.previewSvg.includes('Know Your Data Rights'), 'template preview carries no headline text');
  } finally { srv.close(); }
});

test('GET /api/posters: template-less poster gets a typographic placeholder SVG with the headline', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    seedPoster(ctx.db, { topic: 'dpdp', headline: 'Handle Personal Data With Care' });
    const res = await req(base, token, '/api/posters');
    const { posters } = await res.json();
    const p = posters.find((x) => x.topic === 'dpdp');
    assert.ok(p.previewSvg.includes('<svg'), 'placeholder is an SVG');
    // wrapped into tspans, so assert word presence rather than the full phrase
    assert.ok(p.previewSvg.includes('Handle'), 'headline text present in the placeholder');
    // persistence check: previewSvg is response-only, never written into the doc
    const doc = loadDoc(ctx.db, p.posterId);
    assert.ok(!JSON.stringify(doc).includes('previewSvg'), 'previewSvg must not be persisted');
  } finally { srv.close(); }
});

test('GET /api/posters: a <script> headline is escaped in the placeholder SVG (XSS)', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    seedPoster(ctx.db, { topic: 'xss-topic', headline: '<script>alert(1)</script>' });
    const res = await req(base, token, '/api/posters');
    const { posters } = await res.json();
    const p = posters.find((x) => x.topic === 'xss-topic');
    assert.ok(p.previewSvg.includes('<svg'), 'still renders an SVG');
    assert.ok(!p.previewSvg.includes('<script'), 'raw <script must never appear in previewSvg');
    assert.ok(p.previewSvg.includes('&lt;script'), 'headline markup is entity-escaped');
  } finally { srv.close(); }
});

test('GET /api/posters: languages counts the translation variants (0 when none)', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    seedPoster(ctx.db, {
      topic: 'multilang', status: 'translated', phase: 'translated',
      translations: { de: { lang: 'de' }, fr: { lang: 'fr' }, hi: { lang: 'hi' } }
    });
    seedPoster(ctx.db, { topic: 'monolang' });
    const res = await req(base, token, '/api/posters');
    const { posters } = await res.json();
    assert.equal(posters.find((x) => x.topic === 'multilang').languages, 3, 'three variants counted');
    assert.equal(posters.find((x) => x.topic === 'monolang').languages, 0, 'no variants → 0');
  } finally { srv.close(); }
});

// ── panel finding 1: Phase-4-shaped feedback rows must never surface ─────────

test('getSuggestions: a Phase-4 content-loop feedback row (weight 1.0, NO rating) never surfaces as rated-good', () => {
  const ctx = makeCtx();
  const { posterId } = seedPoster(ctx.db, { phase: 'designed', topic: 'phishing' });

  // exact shape submitUserFeedback (content_pipeline.js) inserts: corrective
  // remarks about a draft, default weight 1.0, NO rating field
  ctx.db.prepare(
    "INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'feedback', 'phishing', null, ?, 1.0)"
  ).run(new Date().toISOString(), JSON.stringify({
    posterId, feedback: 'this headline is misleading, rewrite it', headline: 'Misleading Draft Headline'
  }));

  const { suggestions } = getSuggestions({ ctx, topic: 'phishing' });
  assert.ok(
    !suggestions.some((s) => s.headline === 'Misleading Draft Headline'),
    'a criticized draft must never surface as a positive suggestion'
  );
  // and the global fallback must not resurrect it either
  const fallback = getSuggestions({ ctx, topic: 'brand-new-topic' });
  assert.ok(!fallback.suggestions.some((s) => s.headline === 'Misleading Draft Headline'));
});

test('getSuggestions: raw detail (remarks/feedback prose) never ships; fallback rows carry their REAL topic', () => {
  const ctx = makeCtx();
  ctx.db.prepare(
    "INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'feedback', 'ransomware', null, ?, 1.0)"
  ).run(new Date().toISOString(), JSON.stringify({ rating: 'good', headline: 'Backups Beat Ransoms', remarks: 'private user remarks here' }));

  const { suggestions } = getSuggestions({ ctx, topic: 'totally-new-topic' });
  assert.equal(suggestions.length, 1);
  assert.deepEqual(Object.keys(suggestions[0]).sort(), ['angle', 'headline', 'signal', 'topic']);
  assert.equal(suggestions[0].topic, 'ransomware', 'fallback row reports its own topic, not the requested one');
  assert.ok(!JSON.stringify(suggestions).includes('private user remarks'), 'remarks must never leave the server');
});

// ── T2 learning de-bias: topic scoping + fallback provenance labeling ────────

test('getSuggestions: global fallback for a new topic labels legacy phishing rows with their REAL topic (never the requested one)', () => {
  const ctx = makeCtx();
  // legacy rows from pre-fix hijacked runs — keyed 'phishing', internally valid
  ctx.db.prepare(
    "INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'approval', 'phishing', 'urgency angle', ?, 1.0)"
  ).run(new Date().toISOString(), JSON.stringify({ headline: 'Hover Before You Click' }));

  const { topic, suggestions } = getSuggestions({ ctx, topic: 'gdpr' });
  assert.equal(topic, 'gdpr', 'response echoes the requested topic');
  assert.equal(suggestions.length, 1, 'global fallback surfaces the row');
  assert.equal(suggestions[0].topic, 'phishing', 'fallback row carries its REAL topic so the UI can label provenance');
  assert.equal(suggestions[0].headline, 'Hover Before You Click');
});

test('buildLearningHints is strictly topic-scoped: phishing learnings never leak into a gdpr run', () => {
  const ctx = makeCtx();
  const now = new Date().toISOString();
  // every hint-producing kind, all keyed 'phishing' (incl. reroute + rated feedback)
  ctx.db.prepare("INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'approval', 'phishing', 'qr angle', ?, 1.0)")
    .run(now, JSON.stringify({ headline: 'Approved Phish H' }));
  ctx.db.prepare("INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'rejection', 'phishing', null, ?, 1.0)")
    .run(now, JSON.stringify({ headline: 'Rejected Phish H' }));
  ctx.db.prepare("INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'edit_learning', 'phishing', null, ?, 1.0)")
    .run(now, JSON.stringify({ changeType: 'tone', guidance: 'Phishing-specific guidance' }));
  ctx.db.prepare("INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'reroute', 'phishing', null, ?, 1.0)")
    .run(now, JSON.stringify({ adjustments: 'more QR focus' }));
  ctx.db.prepare("INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'feedback', 'phishing', null, ?, 1.0)")
    .run(now, JSON.stringify({ rating: 'good', headline: 'Good Phish H' }));

  assert.deepEqual(buildLearningHints(ctx.db, 'gdpr'), [], 'no phishing hint may reach a gdpr generator prompt');

  // and a gdpr row DOES produce a gdpr hint alongside the phishing noise
  ctx.db.prepare("INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'approval', 'gdpr', 'recipient-check angle', ?, 1.0)")
    .run(now, JSON.stringify({ headline: 'Check The Recipient First' }));
  const hints = buildLearningHints(ctx.db, 'gdpr');
  assert.equal(hints.length, 1);
  assert.ok(hints[0].includes('recipient-check angle'));
  assert.ok(!hints.some((h) => h.includes('Phish')), 'still no phishing contamination');
});

test('buildLearningHints: rating-less Phase-4 feedback rows do not consume hint slots', () => {
  const ctx = makeCtx();
  // 20 rating-less feedback rows (LEARNING_ROW_LIMIT worth of noise)...
  for (let i = 0; i < 20; i++) {
    ctx.db.prepare(
      "INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'feedback', 'phishing', null, ?, 1.0)"
    ).run(new Date(Date.now() - 60000 + i).toISOString(), JSON.stringify({ feedback: `remark ${i}`, headline: `Draft ${i}` }));
  }
  // ...then one older approval that MUST still produce a hint
  ctx.db.prepare(
    "INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, 'approval', 'phishing', 'urgency angle', ?, 1.0)"
  ).run(new Date(Date.now() - 120000).toISOString(), JSON.stringify({ headline: 'Approved Headline' }));

  const hints = buildLearningHints(ctx.db, 'phishing');
  assert.ok(hints.some((h) => h.includes('urgency angle')), 'approval hint must survive the noise');
  assert.ok(!hints.some((h) => h.includes('Draft 3')), 'rating-less rows produce no hints');
});
