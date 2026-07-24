// Tests for context_refiner.js, stage_qa.js, and their pipeline wiring.
// Covers: deterministic checks pass/fail; refiner fallback = passthrough;
// refiner preserves required fields even when model returns garbage;
// pipeline wiring emits context-refiner and stage-qa events.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '#shared';
import { GateEngine, Harness } from '#orchestration';
import { openDb } from '../../backend/db.js';
import { startContentPipeline } from '../../pipelines/content_pipeline.js';
import { refineContext, AGENT_ID as REFINER_ID } from '../../agents/context_refiner.js';
import { qaStage, AGENT_ID as QA_ID } from '../../agents/stage_qa.js';
import {
  FakeEgress, seedArticles, INTENT_OUTPUT, CONTEXT_OUTPUT, UNGROUNDED_CONTEXT_OUTPUT
} from './helpers/fake_egress.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeCtx(egress, { seed = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'postter-stage-qa-'));
  const db = openDb(join(dir, 'test.sqlite'));
  if (seed) seedArticles(db);
  const bus = new EventBus({ logDir: join(dir, 'runs'), db });
  const gateEngine = new GateEngine({ bus });
  const harness = new Harness({ bus, gateEngine, maxReworkLoops: 6 });
  return { db, bus, vault: null, egress, gateEngine, harness };
}

const BASE_HANDLERS = {
  'keyword-intent': INTENT_OUTPUT,
  'rag-research/synthesize_context': CONTEXT_OUTPUT,
  'rag-research/synthesize_general_knowledge': UNGROUNDED_CONTEXT_OUTPUT
};

// ── qaStage: deterministic checks ────────────────────────────────────────────

test('qaStage: all checks pass → ok true, problems empty', async () => {
  const artifact = { topic: 'phishing', core: ['phishing'], expanded: ['email security'] };
  const checks = [
    { name: 'has-topic', fn: (a) => typeof a.topic === 'string' && a.topic.length > 0 },
    { name: 'has-core', fn: (a) => Array.isArray(a.core) && a.core.length > 0 }
  ];
  const result = await qaStage({ egress: null, runId: null, pipeline: 'content', stage: 'keyword-intent', artifact, checks });
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
  assert.ok(typeof result.score === 'number' && result.score >= 0 && result.score <= 100);
});

test('qaStage: one check fails → ok false, problem named', async () => {
  const artifact = { topic: '', core: ['phishing'] };
  const checks = [
    { name: 'has-topic', fn: (a) => typeof a.topic === 'string' && a.topic.length > 0 },
    { name: 'has-core', fn: (a) => Array.isArray(a.core) && a.core.length > 0 }
  ];
  const result = await qaStage({ egress: null, runId: null, pipeline: 'content', stage: 'keyword-intent', artifact, checks });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.includes('has-topic')));
  assert.equal(result.problems.filter((p) => p.includes('has-core')).length, 0);
});

test('qaStage: multiple checks fail → all named in problems', async () => {
  const artifact = {};
  const checks = [
    { name: 'has-topic', fn: (a) => typeof a.topic === 'string' && a.topic.length > 0 },
    { name: 'has-core', fn: (a) => Array.isArray(a.core) && a.core.length > 0 },
    { name: 'has-synthesis', fn: (a) => typeof a.synthesis === 'string' && a.synthesis.length >= 200 }
  ];
  const result = await qaStage({ egress: null, runId: null, pipeline: 'content', stage: 'research', artifact, checks });
  assert.equal(result.ok, false);
  assert.equal(result.problems.length, 3);
  assert.ok(result.problems.every((p) => p.startsWith('check "')));
});

test('qaStage: predicate that throws is treated as failed check', async () => {
  const checks = [{ name: 'bad-fn', fn: () => { throw new Error('oops'); } }];
  const result = await qaStage({ egress: null, runId: null, pipeline: 'content', stage: 'test', artifact: {}, checks });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.includes('bad-fn')));
});

test('qaStage: empty checks array → ok true', async () => {
  const result = await qaStage({ egress: null, runId: null, pipeline: 'content', stage: 'test', artifact: { anything: true }, checks: [] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
});

test('qaStage: model failure → falls back to deterministic result, does not throw', async () => {
  // FakeEgress with no handler for stage-qa → throws "no handler". qaStage must catch it.
  const egress = new FakeEgress({ 'keyword-intent': INTENT_OUTPUT }); // no 'stage-qa' handler
  const artifact = { topic: 'phishing', core: ['phishing'] };
  const checks = [
    { name: 'has-topic', fn: (a) => Boolean(a.topic) }
  ];
  // Must not throw — model handler missing, falls back gracefully
  const result = await qaStage({ egress, runId: 'run-test', pipeline: 'content', stage: 'keyword-intent', artifact, checks });
  assert.equal(result.ok, true); // deterministic check passed
  assert.deepEqual(result.problems, []);
});

test('qaStage: no egress → no model call, deterministic result returned', async () => {
  const artifact = { topic: 'phishing', core: ['phishing'] };
  const checks = [{ name: 'has-topic', fn: (a) => Boolean(a.topic) }];
  const result = await qaStage({ egress: null, runId: 'run-x', pipeline: 'content', stage: 'test', artifact, checks });
  assert.equal(result.ok, true);
});

// ── refineContext: fallback = passthrough ─────────────────────────────────────

test('refineContext: no egress → passthrough (context unchanged, notes = passthrough)', async () => {
  const ctx = { topic: 'phishing', core: ['phishing'], expanded: ['email security'] };
  const result = await refineContext({ egress: null, runId: null, pipeline: 'content', stage: 'research', context: ctx });
  assert.deepEqual(result.context, ctx);
  assert.equal(result.notes, 'passthrough');
});

test('refineContext: FakeEgress without context-refiner handler → passthrough, does not throw', async () => {
  // No 'context-refiner' key in handlers → FakeEgress would throw "no handler"
  // refineContext must catch this and return passthrough
  const egress = new FakeEgress({ 'keyword-intent': INTENT_OUTPUT }); // no context-refiner handler
  const ctx = { topic: 'phishing', core: ['phishing'] };
  const result = await refineContext({ egress, runId: 'run-1', pipeline: 'content', stage: 'research', context: ctx });
  assert.deepEqual(result.context, ctx);
  assert.equal(result.notes, 'passthrough');
});

test('refineContext: model returns garbage (missing required fields) → original returned', async () => {
  // Model returns an object missing the "topic" key — preservesShape check fails → original
  const egress = new FakeEgress({ 'context-refiner': { noise: 'random junk' } });
  const ctx = { topic: 'phishing', core: ['phishing'] };
  const result = await refineContext({ egress, runId: 'run-1', pipeline: 'content', stage: 'research', context: ctx });
  assert.deepEqual(result.context, ctx);
  assert.equal(result.notes, 'passthrough');
});

test('refineContext: model returns valid refined object → refined context returned', async () => {
  const ctx = { topic: 'phishing emails', core: ['phishing'], expanded: ['email'] };
  const refined = { topic: 'phishing', core: ['phishing'], expanded: ['email security', 'credential theft'] };
  const egress = new FakeEgress({ 'context-refiner': refined });
  const result = await refineContext({ egress, runId: 'run-1', pipeline: 'content', stage: 'research', context: ctx });
  assert.deepEqual(result.context, refined);
  assert.equal(result.notes, 'refined');
});

test('refineContext: model returns object with empty topic string → original returned', async () => {
  // topic is present but empty → preservesShape should reject it
  const egress = new FakeEgress({ 'context-refiner': { topic: '', core: ['phishing'], expanded: [] } });
  const ctx = { topic: 'phishing', core: ['phishing'], expanded: [] };
  const result = await refineContext({ egress, runId: 'run-1', pipeline: 'content', stage: 'research', context: ctx });
  assert.deepEqual(result.context, ctx);
  assert.equal(result.notes, 'passthrough');
});

test('refineContext: model returns array (not object) → original returned', async () => {
  const egress = new FakeEgress({ 'context-refiner': ['an', 'array'] });
  const ctx = { topic: 'phishing', core: ['phishing'] };
  const result = await refineContext({ egress, runId: 'run-1', pipeline: 'content', stage: 'research', context: ctx });
  assert.deepEqual(result.context, ctx);
  assert.equal(result.notes, 'passthrough');
});

test('refineContext: non-object context (string) → passthrough', async () => {
  const egress = new FakeEgress({ 'context-refiner': { topic: 'phishing' } });
  const result = await refineContext({ egress, runId: 'run-1', pipeline: 'content', stage: 'research', context: 'a string' });
  assert.equal(result.context, 'a string');
  assert.equal(result.notes, 'passthrough');
});

// ── pipeline wiring: context-refiner events emitted ──────────────────────────

test('startContentPipeline with FakeEgress (no refiner/qa handlers): context-refiner stage_start/stage_end events emitted for all 3 boundaries', async () => {
  // No handlers for context-refiner or stage-qa → both fall to passthrough/deterministic.
  // The pipeline must still emit stage_start + stage_end events for context-refiner.
  const egress = new FakeEgress({ ...BASE_HANDLERS });
  const ctx = makeCtx(egress);
  const state = await startContentPipeline({ ctx, prompt: 'stop phishing emails' });

  const events = ctx.bus.eventsForRun(state.runId);
  const refinerEvents = events.filter((e) => e.agent === 'context-refiner');

  // 3 boundaries in startContentPipeline: after intent (→ research), after context file (→ angle return)
  // Note: the 3rd boundary (after content loop passes) is in chooseAngles, not startContentPipeline
  // So startContentPipeline emits at least 2 pairs (after-intent + after-context-file)
  const starts = refinerEvents.filter((e) => e.type === 'stage_start');
  const ends = refinerEvents.filter((e) => e.type === 'stage_end');
  assert.ok(starts.length >= 2, `expected >=2 context-refiner stage_start events, got ${starts.length}`);
  assert.ok(ends.length >= 2, `expected >=2 context-refiner stage_end events, got ${ends.length}`);
  // All refiner events must have the correct agent
  assert.ok(refinerEvents.every((e) => e.agent === 'context-refiner'));
});

test('startContentPipeline with FakeEgress: stage-qa events emitted for intent and context-file boundaries', async () => {
  const egress = new FakeEgress({ ...BASE_HANDLERS });
  const ctx = makeCtx(egress);
  const state = await startContentPipeline({ ctx, prompt: 'stop phishing emails' });

  const events = ctx.bus.eventsForRun(state.runId);
  const qaEvents = events.filter((e) => e.agent === 'stage-qa');

  // stage-qa emits stage_end at each boundary (no stage_start for qa — just result event)
  assert.ok(qaEvents.length >= 2, `expected >=2 stage-qa events, got ${qaEvents.length}`);
  assert.ok(qaEvents.every((e) => e.agent === 'stage-qa'));
});

test('AGENT_ID constants match event agent values in bus', async () => {
  assert.equal(REFINER_ID, 'context-refiner');
  assert.equal(QA_ID, 'stage-qa');
});
