// Override console + listing routes over the real server (X-Session-Token
// auth): pause/resume flip harness state and emit attributed override events;
// force-decision is logged; rollback restores by label, never leaks the
// snapshot, and 404s on unknown checkpoints; GET /api/posters returns the
// list shape without doc contents; GET /api/events/runs aggregates the event
// mirror newest-first.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../../backend/server.js';
import { createAppContext } from '../../backend/app-context.js';
import {
  FakeEgress, seedArticles, INTENT_OUTPUT, CONTEXT_OUTPUT, POSTER_CONTENT, ACCEPT_REVIEW
} from './helpers/fake_egress.js';

function startServer(egress = new FakeEgress({}) /* no model calls by default — any call would throw */) {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-override-routes-'));
  const ctx = createAppContext({
    dataDir, logDir: join(dataDir, 'runs'), dbPath: join(dataDir, 'test.sqlite'), egress
  });
  const { app, token } = createServer(ctx, { dataDir });
  return new Promise((resolvePromise) => {
    const srv = app.listen(0, '127.0.0.1', () => {
      resolvePromise({ srv, ctx, token, base: `http://127.0.0.1:${srv.address().port}` });
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

test('pause → state paused → resume → state running, both emitted as override events', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    const runId = 'run_ovr_pause';

    let res = await req(base, token, `/api/override/${runId}/state`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'running', checkpoints: [], overrides: [] });

    res = await req(base, token, `/api/override/${runId}/pause`, 'POST', { reason: 'operator audit of research output' });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).status, 'paused');

    res = await req(base, token, `/api/override/${runId}/state`);
    assert.equal((await res.json()).status, 'paused');

    // paused runs really block harness hand-offs
    assert.throws(() => ctx.harness.validateHandoff({
      runId, project: 'poster-app', pipeline: 'content',
      fromStage: 'research', toStage: 'content-loop',
      fromAgent: 'rag-research', toAgent: 'content-generator',
      payload: { summary: 'context ready', contextId: 'ctx1' }
    }), /paused/);

    res = await req(base, token, `/api/override/${runId}/resume`, 'POST', {});
    assert.equal(res.status, 200);
    assert.equal((await res.json()).status, 'running');

    const overrides = ctx.bus.eventsForRun(runId).filter((e) => e.type === 'override');
    assert.deepEqual(overrides.map((e) => JSON.parse(e.payload).action), ['pause', 'resume']);
  } finally { srv.close(); }
});

test('force decision: logged in run state and emitted as an attributed override event', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    const runId = 'run_ovr_decision';
    const res = await req(base, token, `/api/override/${runId}/decision`, 'POST', {
      pipeline: 'content', stage: 'content-loop', decision: 'accepted',
      reason: 'reviewer stuck on tone nitpicks — draft is fine', operator: 'gt'
    });
    assert.equal(res.status, 200);
    const state = await res.json();
    assert.equal(state.overrides.length, 1);
    assert.equal(state.overrides[0].operator, 'gt');
    assert.equal(state.overrides[0].decision, 'accepted');

    const events = ctx.bus.eventsForRun(runId).filter((e) => e.type === 'override');
    assert.equal(events.length, 1);
    const payload = JSON.parse(events[0].payload);
    assert.equal(payload.action, 'override');
    assert.equal(payload.decision, 'accepted');
    assert.equal(payload.operator, 'gt');
    assert.equal(events[0].stage, 'content-loop');
  } finally { srv.close(); }
});

test('rollback: restores checkpoint by label without leaking the snapshot; 404 on unknown index', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    const runId = 'run_ovr_rollback';
    ctx.harness.checkpoint(runId, 'after-content', { content: 'SNAPSHOT-INTERNAL-v1' });
    ctx.harness.checkpoint(runId, 'after-design', { content: 'SNAPSHOT-INTERNAL-v1', design: 'd1' });

    // state lists checkpoints as {label, ts} only
    let res = await req(base, token, `/api/override/${runId}/state`);
    const state = await res.json();
    assert.equal(state.checkpoints.length, 2);
    assert.deepEqual(Object.keys(state.checkpoints[0]).sort(), ['label', 'ts']);
    assert.ok(!JSON.stringify(state).includes('SNAPSHOT-INTERNAL'), 'snapshot leaked into state view');

    res = await req(base, token, `/api/override/${runId}/rollback`, 'POST', {
      checkpointIndex: 0, reason: 'design pass corrupted the layout'
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.restored, 'after-content');
    assert.ok(!JSON.stringify(body).includes('SNAPSHOT-INTERNAL'), 'snapshot leaked into rollback response');
    assert.equal(body.checkpoints.length, 1, 'later checkpoints are discarded on rollback');

    res = await req(base, token, `/api/override/${runId}/rollback`, 'POST', { checkpointIndex: 7, reason: 'no such checkpoint' });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'CHECKPOINT_NOT_FOUND');
  } finally { srv.close(); }
});

test('rollback restores the checkpointed poster doc in SQLite', async () => {
  const egress = new FakeEgress({
    'keyword-intent': INTENT_OUTPUT,
    'rag-research/synthesize_context': CONTEXT_OUTPUT,
    'content-generator': [POSTER_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW],
    // inline edit fires edit-learning; feed it garbage-free but irrelevant output
    'edit-learning': { changeType: 'stylistic-preference', summary: 'headline shortened', guidance: 'prefer shorter headlines' }
  });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    seedArticles(ctx.db);

    // create a poster via the real routes — pipeline checkpoints as it goes
    let res = await req(base, token, '/api/pipeline/start', 'POST', { prompt: 'stop phishing emails' });
    assert.equal(res.status, 200);
    const started = await res.json();
    res = await req(base, token, `/api/pipeline/${started.posterId}/angles`, 'POST', { angleIds: ['angle-1'] });
    assert.equal(res.status, 200);

    // both pipeline checkpoints exist ({label, ts} view only)
    res = await req(base, token, `/api/override/${started.runId}/state`);
    const state = await res.json();
    assert.deepEqual(state.checkpoints.map((c) => c.label), ['after-research', 'after-content']);
    assert.ok(!JSON.stringify(state).includes(POSTER_CONTENT.headline), 'snapshot leaked into state view');

    // mutate the poster after the checkpoint (inline edit, applied verbatim)
    const editedHeadline = 'A Headline The Operator Wants Rolled Back';
    res = await req(base, token, `/api/pipeline/${started.posterId}/edit`, 'POST', {
      content: { ...POSTER_CONTENT, headline: editedHeadline }
    });
    assert.equal(res.status, 200);
    let doc = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(started.posterId).doc);
    assert.equal(doc.content.headline, editedHeadline);

    // rollback to 'after-content' via the API → SQLite doc actually restored
    res = await req(base, token, `/api/override/${started.runId}/rollback`, 'POST', {
      checkpointIndex: 1, reason: 'inline edit corrupted the draft'
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.restored, 'after-content');
    assert.ok(!JSON.stringify(body).includes(POSTER_CONTENT.headline), 'snapshot leaked into rollback response');
    doc = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(started.posterId).doc);
    assert.equal(doc.content.headline, POSTER_CONTENT.headline, 'poster doc must be restored to the checkpoint');
    assert.equal(doc.phase, 'content-approval');
  } finally { srv.close(); }
});

test('validation: missing reasons, bad decision, bad checkpointIndex all 400', async () => {
  const { srv, base, token } = await startServer();
  try {
    const cases = [
      ['/api/override/run_v/pause', {}],
      ['/api/override/run_v/pause', { reason: '   ' }],
      ['/api/override/run_v/pause', { reason: 'x'.repeat(1001) }],
      ['/api/override/run_v/resume', { reason: 42 }],
      ['/api/override/run_v/resume', { reason: '' }],
      ['/api/override/run_v/decision', { stage: 'content-loop', decision: 'maybe', reason: 'not a decision' }],
      ['/api/override/run_v/decision', { stage: '', decision: 'accepted', reason: 'missing stage' }],
      ['/api/override/run_v/decision', { stage: 'content-loop', decision: 'accepted' }],
      ['/api/override/run_v/decision', { stage: 'content-loop', decision: 'accepted', reason: 'ok reason', operator: '' }],
      ['/api/override/run_v/rollback', { checkpointIndex: 'zero', reason: 'bad index' }],
      ['/api/override/run_v/rollback', { checkpointIndex: -1, reason: 'bad index' }],
      ['/api/override/run_v/rollback', { checkpointIndex: 0 }]
    ];
    for (const [path, body] of cases) {
      const res = await req(base, token, path, 'POST', body);
      assert.equal(res.status, 400, `${path} ${JSON.stringify(body).slice(0, 60)} must be rejected`);
    }
  } finally { srv.close(); }
});

test('GET /api/posters: list shape (no doc contents), newest update first', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    const insert = ctx.db.prepare(
      'INSERT INTO posters (poster_id, name, status, created_at, updated_at, doc) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insert.run('p-1', 'phishing poster', 'draft', '2026-07-14T09:00:00Z', '2026-07-14T09:00:00Z',
      JSON.stringify({ contextFile: { synthesis: 'INTERNAL-SYNTHESIS-TEXT' } }));
    insert.run('p-2', 'usb safety poster', 'content-approved', '2026-07-14T10:00:00Z', '2026-07-15T08:00:00Z',
      JSON.stringify({ contextFile: { synthesis: 'INTERNAL-SYNTHESIS-TEXT' } }));

    const res = await req(base, token, '/api/posters');
    assert.equal(res.status, 200);
    const { posters } = await res.json();
    assert.equal(posters.length, 2);
    assert.deepEqual(posters.map((p) => p.posterId), ['p-2', 'p-1']); // updated_at DESC
    assert.deepEqual(Object.keys(posters[0]).sort(),
      ['createdAt', 'headline', 'languages', 'name', 'posterId', 'previewSvg', 'savedAt', 'status', 'topic', 'updatedAt']);
    assert.ok(!JSON.stringify(posters).includes('INTERNAL-SYNTHESIS-TEXT'), 'poster doc leaked into the library list');
  } finally { srv.close(); }
});

test('GET /api/events/runs: distinct runs with first/last ts + counts, newest first', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    const emit = (runId, ts, type = 'stage_start') => ctx.bus.emit({
      runId, ts, project: 'poster-app', pipeline: 'content', stage: 'keyword-intent',
      agent: 'keyword-intent', skill: 'extract_keywords', type, payload: {}
    });
    emit('run_a', '2026-07-15T08:00:00.000Z');
    emit('run_a', '2026-07-15T08:01:00.000Z', 'stage_end');
    emit('run_b', '2026-07-15T09:00:00.000Z');

    const res = await req(base, token, '/api/events/runs');
    assert.equal(res.status, 200);
    const { runs } = await res.json();
    assert.deepEqual(runs.map((r) => r.runId), ['run_b', 'run_a']); // newest last-activity first
    const runA = runs.find((r) => r.runId === 'run_a');
    assert.equal(runA.eventCount, 2);
    assert.equal(runA.firstTs, '2026-07-15T08:00:00.000Z');
    assert.equal(runA.lastTs, '2026-07-15T08:01:00.000Z');
  } finally { srv.close(); }
});

