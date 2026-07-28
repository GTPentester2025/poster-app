// Pipeline route tests over the real server (X-Session-Token auth) with a
// fake egress injected through createAppContext's egress override: full flow
// start → angles → content-approval → approve; inline edit is verbatim,
// stores learning, and never triggers a re-review; safe views never leak
// contextFile.synthesis/sources; validation and phase errors map to
// 400/404/409.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from '../../backend/server.js';
import { createAppContext } from '../../backend/app-context.js';
import {
  FakeEgress, seedArticles, INTENT_OUTPUT, CONTEXT_OUTPUT,
  POSTER_CONTENT, POSTER_CONTENT_V2, ACCEPT_REVIEW, REWORK_REVIEW, EDIT_CLASSIFICATION
} from './helpers/fake_egress.js';

function startServer(egress) {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-pipeline-routes-'));
  const ctx = createAppContext({
    dataDir, logDir: join(dataDir, 'runs'), dbPath: join(dataDir, 'test.sqlite'), egress
  });
  seedArticles(ctx.db);
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

function assertNoInternalLeaks(body) {
  const s = JSON.stringify(body);
  assert.ok(!s.includes(CONTEXT_OUTPUT.synthesis.slice(0, 40)), 'contextFile.synthesis leaked to client');
  assert.ok(!s.includes('Proofpoint') && !s.includes('thehackernews'), 'contextFile.sources leaked to client');
  assert.ok(!s.includes('"contextFile"') && !s.includes('"sources"') && !s.includes('"synthesis"'));
}

test('full flow: start → angles → content-approval → approve → inline edit (no re-review)', async () => {
  const egress = new FakeEgress({
    'keyword-intent': INTENT_OUTPUT,
    'rag-research/synthesize_context': CONTEXT_OUTPUT,
    'content-generator': [POSTER_CONTENT, POSTER_CONTENT_V2],
    'content-reviewer': [REWORK_REVIEW, ACCEPT_REVIEW],
    'edit-learning': EDIT_CLASSIFICATION
  });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    // start
    let res = await req(base, token, '/api/pipeline/start', 'POST', { prompt: 'stop phishing emails' });
    assert.equal(res.status, 200);
    const started = await res.json();
    assert.ok(started.posterId && started.runId);
    assert.equal(started.phase, 'angles');
    assert.equal(started.topic, 'phishing');
    assert.equal(started.grounded, true);
    assert.equal(started.angles.length, 3);
    assertNoInternalLeaks(started);

    // angles → content loop (one rework, then accept)
    res = await req(base, token, `/api/pipeline/${started.posterId}/angles`, 'POST', { angleIds: ['angle-1'] });
    assert.equal(res.status, 200);
    const withContent = await res.json();
    assert.equal(withContent.phase, 'content-approval');
    assert.equal(withContent.content.headline, POSTER_CONTENT_V2.headline);
    assert.deepEqual(withContent.reviewHistory.map((h) => h.status), ['rework', 'accepted']);
    assertNoInternalLeaks(withContent);

    // GET safe state
    res = await req(base, token, `/api/pipeline/${started.posterId}`);
    assert.equal(res.status, 200);
    assertNoInternalLeaks(await res.json());

    // approve → learning row + status transition
    res = await req(base, token, `/api/pipeline/${started.posterId}/approve`, 'POST', {});
    assert.equal(res.status, 200);
    const approved = await res.json();
    assert.equal(approved.status, 'content-approved');
    assert.equal(ctx.db.prepare("SELECT COUNT(*) c FROM learning WHERE kind = 'approval'").get().c, 1);

    // inline edit: verbatim (even beyond generator length limits), no re-review
    const reviewerCallsBefore = egress.callsFor('content-reviewer').length;
    const edited = {
      ...POSTER_CONTENT_V2,
      headline: 'A Deliberately Longer Headline The User Insisted On Keeping Anyway',
      messages: POSTER_CONTENT_V2.messages
    };
    res = await req(base, token, `/api/pipeline/${started.posterId}/edit`, 'POST', { content: edited });
    assert.equal(res.status, 200);
    const afterEdit = await res.json();
    assert.equal(afterEdit.content.headline, edited.headline); // user has the final word
    assert.equal(egress.callsFor('content-reviewer').length, reviewerCallsBefore, 'inline edit must NOT trigger re-review');
    assertNoInternalLeaks(afterEdit);

    // edit-learning is fire-and-forget — poll briefly for the stored row
    let editRows = 0;
    for (let i = 0; i < 40 && !editRows; i++) {
      editRows = ctx.db.prepare("SELECT COUNT(*) c FROM learning WHERE kind = 'edit_learning'").get().c;
      if (!editRows) await delay(50);
    }
    assert.equal(editRows, 1, 'inline edit must store an edit_learning row');
  } finally { srv.close(); }
});

test('validation: bad prompts, bad angleIds, unknown poster, wrong phase', async () => {
  const egress = new FakeEgress({
    'keyword-intent': INTENT_OUTPUT,
    'rag-research/synthesize_context': CONTEXT_OUTPUT,
    'content-generator': [POSTER_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW]
  });
  const { srv, base, token } = await startServer(egress);
  try {
    for (const bad of [{}, { prompt: '' }, { prompt: '   ' }, { prompt: 42 }, { prompt: 'x'.repeat(2001) }]) {
      const res = await req(base, token, '/api/pipeline/start', 'POST', bad);
      assert.equal(res.status, 400, `start body ${JSON.stringify(bad).slice(0, 40)} must be rejected`);
    }

    const started = await (await req(base, token, '/api/pipeline/start', 'POST', { prompt: 'stop phishing emails' })).json();

    for (const bad of [{}, { angleIds: [] }, { angleIds: 'all' }, { angleIds: [7] }]) {
      const res = await req(base, token, `/api/pipeline/${started.posterId}/angles`, 'POST', bad);
      assert.equal(res.status, 400, `angleIds ${JSON.stringify(bad)} must be rejected`);
    }
    // unknown angle id: passes route shape check, rejected by the pipeline
    let res = await req(base, token, `/api/pipeline/${started.posterId}/angles`, 'POST', { angleIds: ['angle-99'] });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'INVALID_ANGLES');

    // wrong phase: approve before content exists
    res = await req(base, token, `/api/pipeline/${started.posterId}/approve`, 'POST', {});
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, 'WRONG_PHASE');

    // unknown poster
    res = await req(base, token, '/api/pipeline/00000000-0000-4000-8000-000000000000');
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'POSTER_NOT_FOUND');

    // feedback + edit validation
    await req(base, token, `/api/pipeline/${started.posterId}/angles`, 'POST', { angleIds: 'ai' });
    res = await req(base, token, `/api/pipeline/${started.posterId}/feedback`, 'POST', { feedback: '' });
    assert.equal(res.status, 400);
    res = await req(base, token, `/api/pipeline/${started.posterId}/edit`, 'POST', { content: { headline: 'x' } });
    assert.equal(res.status, 400); // missing messages → INVALID_CONTENT
    assert.equal((await res.json()).error, 'INVALID_CONTENT');
  } finally { srv.close(); }
});

test('concurrent mutation on the same poster: second /angles gets 409 POSTER_BUSY', async () => {
  const egress = new FakeEgress({
    'keyword-intent': INTENT_OUTPUT,
    'rag-research/synthesize_context': CONTEXT_OUTPUT,
    // slow content loop: keeps the first /angles in flight while we fire a second
    'content-generator': async () => { await delay(400); return POSTER_CONTENT; },
    'content-reviewer': ACCEPT_REVIEW
  });
  const { srv, base, token } = await startServer(egress);
  try {
    const started = await (await req(base, token, '/api/pipeline/start', 'POST', { prompt: 'stop phishing emails' })).json();

    const first = req(base, token, `/api/pipeline/${started.posterId}/angles`, 'POST', { angleIds: ['angle-1'] });
    await delay(100); // let the first request take the poster lock
    const second = await req(base, token, `/api/pipeline/${started.posterId}/angles`, 'POST', { angleIds: ['angle-2'] });
    assert.equal(second.status, 409);
    assert.equal((await second.json()).error, 'POSTER_BUSY');

    const firstRes = await first;
    assert.equal(firstRes.status, 200, 'the in-flight mutation must complete normally');
    assert.equal((await firstRes.json()).phase, 'content-approval');

    // the lock is released — a fresh mutation goes through
    const after = await req(base, token, `/api/pipeline/${started.posterId}/approve`, 'POST', {});
    assert.equal(after.status, 200);
  } finally { srv.close(); }
});

test('reviewer echoing the internal synthesis never reaches route responses or bus events', async () => {
  const echoedSentence = CONTEXT_OUTPUT.synthesis.split('. ')[0] + '.';
  const leakMarker = 'shifting phishing delivery away from bare links'; // >= 8 contiguous synthesis words
  const leakyReview = {
    status: 'rework',
    score: 82,
    feedback: `The headline is too vague to act on. ${echoedSentence}`,
    expected: `A sharper draft. ${echoedSentence}`
  };
  const egress = new FakeEgress({
    'keyword-intent': INTENT_OUTPUT,
    'rag-research/synthesize_context': CONTEXT_OUTPUT,
    'content-generator': [POSTER_CONTENT, POSTER_CONTENT_V2],
    'content-reviewer': [leakyReview, ACCEPT_REVIEW]
  });
  const { srv, ctx, base, token } = await startServer(egress);
  const busEvents = [];
  const unsubscribe = ctx.bus.subscribe((e) => busEvents.push(e));
  try {
    const started = await (await req(base, token, '/api/pipeline/start', 'POST', { prompt: 'stop phishing emails' })).json();
    const res = await req(base, token, `/api/pipeline/${started.posterId}/angles`, 'POST', { angleIds: ['angle-1'] });
    assert.equal(res.status, 200);
    const withContent = await res.json();

    // route responses: scrubbed feedback surfaced, synthesis echo withheld
    const body = JSON.stringify(withContent);
    assert.ok(!body.includes(leakMarker), 'synthesis echo leaked into the HTTP response');
    const rework = withContent.reviewHistory.find((h) => h.status === 'rework');
    assert.ok(rework.feedback.includes('The headline is too vague to act on.'), 'legitimate critique must survive scrubbing');
    assert.ok(rework.feedback.includes('[internal research detail withheld]'));
    // older entries carry outcome only; the accepted final entry has no feedback
    assert.deepEqual(Object.keys(withContent.reviewHistory.at(-1)).sort(), ['attempt', 'score', 'status']);

    // GET safe state is equally clean
    const fetched = await (await req(base, token, `/api/pipeline/${started.posterId}`)).json();
    assert.ok(!JSON.stringify(fetched).includes(leakMarker));

    // bus/SSE: no event payload (rework, gate, handoff, ...) may carry the echo
    assert.ok(busEvents.some((e) => e.type === 'rework'), 'the rework event must have been emitted');
    for (const e of busEvents) {
      assert.ok(!JSON.stringify(e).includes(leakMarker), `synthesis echo leaked into bus event ${e.type}:${e.stage}`);
    }
  } finally {
    unsubscribe();
    srv.close();
  }
});

