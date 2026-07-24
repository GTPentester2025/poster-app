// Overseer (meta-reviewer) tests (Job C): a model call scores the prompting and
// records a 'prompt_review' learning row; deterministic fallback (no egress /
// no rows / parse error) = {score:null, notes:[]} passthrough; the 'overseer'
// stage events are emitted; and low-scoring reviews surface into buildLearningHints.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '#shared';
import { openDb } from '../../backend/db.js';
import { reviewPrompting, AGENT_ID as OVERSEER_ID } from '../../agents/overseer.js';
import { buildLearningHints } from '../../pipelines/content_pipeline.js';
import { FakeEgress } from './helpers/fake_egress.js';

function makeEnv() {
  const dir = mkdtempSync(join(tmpdir(), 'postter-overseer-'));
  const db = openDb(join(dir, 'test.sqlite'));
  const bus = new EventBus({ logDir: join(dir, 'runs'), db });
  return { db, bus };
}

// Seed a couple of egress_log rows for a run+stage so the overseer has heads to read.
function seedEgressLog(db, runId, stage, n = 2) {
  const stmt = db.prepare(`INSERT INTO egress_log
    (ts, run_id, event_id, pipeline, stage, agent, skill, direction, model, masked_system, masked_prompt, masked_response, duration_ms, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (let i = 0; i < n; i++) {
    stmt.run(new Date().toISOString(), runId, `evt-${i}`, 'content', stage, 'keyword-intent', 'extract_keywords',
      'request', 'test-model', 'you are a QA agent', `masked prompt head ${i} for ${stage}`, null, 10, 'ok');
  }
}

test('overseer: model call scores prompting → prompt_review learning row + score returned', async () => {
  const { db, bus } = makeEnv();
  const runId = 'run-ov-1';
  seedEgressLog(db, runId, 'keyword-intent');
  const egress = new FakeEgress({ 'overseer/review_prompting': { score: 72, notes: ['add explicit output schema', 'name the target audience'] } });

  const result = await reviewPrompting({ egress, runId, db, bus, stage: 'keyword-intent', pipeline: 'content', topic: 'phishing' });

  assert.equal(result.score, 72);
  assert.deepEqual(result.notes, ['add explicit output schema', 'name the target audience']);
  const rows = db.prepare("SELECT * FROM learning WHERE kind = 'prompt_review'").all();
  assert.equal(rows.length, 1, 'one prompt_review row recorded');
  assert.equal(rows[0].topic, 'phishing');
  const detail = JSON.parse(rows[0].detail);
  assert.equal(detail.stage, 'keyword-intent');
  assert.equal(detail.score, 72);
  assert.deepEqual(detail.notes, ['add explicit output schema', 'name the target audience']);
});

test('overseer: notes capped at 2', async () => {
  const { db, bus } = makeEnv();
  const runId = 'run-ov-cap';
  seedEgressLog(db, runId, 'keyword-intent');
  const egress = new FakeEgress({ 'overseer/review_prompting': { score: 60, notes: ['a', 'b', 'c', 'd'] } });
  const result = await reviewPrompting({ egress, runId, db, bus, stage: 'keyword-intent', pipeline: 'content', topic: 't' });
  assert.equal(result.notes.length, 2);
});

test('overseer: no egress → {score:null, notes:[]} passthrough, no learning row', async () => {
  const { db, bus } = makeEnv();
  const runId = 'run-ov-2';
  seedEgressLog(db, runId, 'keyword-intent');
  const result = await reviewPrompting({ egress: null, runId, db, bus, stage: 'keyword-intent', pipeline: 'content', topic: 'x' });
  assert.equal(result.score, null);
  assert.deepEqual(result.notes, []);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM learning WHERE kind='prompt_review'").get().c, 0);
});

test('overseer: no egress_log rows for stage → passthrough, no model call, no learning row', async () => {
  const { db, bus } = makeEnv();
  const runId = 'run-ov-3';
  // deliberately seed a DIFFERENT stage — nothing for 'content-loop'
  seedEgressLog(db, runId, 'keyword-intent');
  const egress = new FakeEgress({ 'overseer/review_prompting': { score: 99, notes: [] } });
  const result = await reviewPrompting({ egress, runId, db, bus, stage: 'content-loop', pipeline: 'content', topic: 'x' });
  assert.equal(result.score, null);
  assert.deepEqual(result.notes, []);
  assert.equal(egress.callsFor('overseer').length, 0, 'no model call when no heads to review');
  assert.equal(db.prepare("SELECT COUNT(*) c FROM learning WHERE kind='prompt_review'").get().c, 0);
});

test('overseer: model error → passthrough, never throws, no learning row', async () => {
  const { db, bus } = makeEnv();
  const runId = 'run-ov-4';
  seedEgressLog(db, runId, 'keyword-intent');
  const egress = new FakeEgress({ 'overseer/review_prompting': () => { throw new Error('model down'); } });
  const result = await reviewPrompting({ egress, runId, db, bus, stage: 'keyword-intent', pipeline: 'content', topic: 'x' });
  assert.equal(result.score, null);
  assert.deepEqual(result.notes, []);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM learning WHERE kind='prompt_review'").get().c, 0);
});

test('overseer: emits overseer stage_start + stage_end events (agent "overseer")', async () => {
  const { db, bus } = makeEnv();
  const runId = 'run-ov-5';
  seedEgressLog(db, runId, 'keyword-intent');
  const egress = new FakeEgress({ 'overseer/review_prompting': { score: 85, notes: [] } });
  await reviewPrompting({ egress, runId, db, bus, stage: 'keyword-intent', pipeline: 'content', topic: 'x' });

  const events = bus.eventsForRun(runId).filter((e) => e.agent === 'overseer');
  assert.ok(events.some((e) => e.type === 'stage_start'), 'stage_start emitted');
  assert.ok(events.some((e) => e.type === 'stage_end'), 'stage_end emitted');
  assert.ok(events.some((e) => e.type === 'memory_write'), 'memory_write emitted for the recorded review');
  assert.ok(events.every((e) => e.agent === OVERSEER_ID));
});

test('overseer: translate-prefix stage matches per-language egress_log rows', async () => {
  const { db, bus } = makeEnv();
  const runId = 'run-ov-tr';
  seedEgressLog(db, runId, 'translate:fr');
  seedEgressLog(db, runId, 'translate:de');
  const egress = new FakeEgress({ 'overseer/review_prompting': { score: 70, notes: ['tighten fidelity instruction'] } });
  const result = await reviewPrompting({ egress, runId, db, bus, stage: 'translate', pipeline: 'translation', topic: 'phishing' });
  assert.equal(result.score, 70);
  assert.equal(egress.callsFor('overseer').length, 1, 'one model call over the prefix-matched heads');
});

// ── hint surfacing (self-improvement loop) ──────────────────────────────────

test('buildLearningHints surfaces a low-scoring prompt_review note (< 80) for the topic', async () => {
  const { db } = makeEnv();
  db.prepare('INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, ?, ?, ?, ?, ?)')
    .run(new Date().toISOString(), 'prompt_review', 'phishing', null,
      JSON.stringify({ stage: 'content-loop', score: 65, notes: ['spell out the 95-gate criteria'] }), 1.0);

  const hints = buildLearningHints(db, 'phishing');
  assert.ok(hints.some((h) => /Past prompt review for content-loop/.test(h) && /spell out the 95-gate criteria/.test(h)),
    `expected a prompt_review hint, got: ${JSON.stringify(hints)}`);
});

test('buildLearningHints does NOT surface a prompt_review with score >= 80', async () => {
  const { db } = makeEnv();
  db.prepare('INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, ?, ?, ?, ?, ?)')
    .run(new Date().toISOString(), 'prompt_review', 'phishing', null,
      JSON.stringify({ stage: 'content-loop', score: 90, notes: ['minor: could name audience'] }), 1.0);
  const hints = buildLearningHints(db, 'phishing');
  assert.ok(!hints.some((h) => /prompt review/i.test(h)), 'high-scoring reviews are not surfaced as hints');
});
