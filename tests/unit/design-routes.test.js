// Design route tests over the real server (X-Session-Token auth) with a fake
// egress: full flow start → angles → approve → template gallery (recommended
// ordering) → apply → GET design; the dynamic 90-gate loop; retry with a
// prompt; validation and phase errors map to 400/404/409; auth is enforced.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from '../../backend/server.js';
import { createAppContext } from '../../backend/app-context.js';
import {
  FakeEgress, seedArticles, INTENT_OUTPUT, CONTEXT_OUTPUT, POSTER_CONTENT, ACCEPT_REVIEW,
  DESIGN_SPEC, DESIGN_SPEC_V2, DESIGN_ACCEPT_REVIEW
} from './helpers/fake_egress.js';

function startServer(egress) {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-design-routes-'));
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

const CONTENT_HANDLERS = {
  'keyword-intent': INTENT_OUTPUT,
  'rag-research/synthesize_context': CONTEXT_OUTPUT,
  'content-generator': () => structuredClone(POSTER_CONTENT),
  'content-reviewer': ACCEPT_REVIEW
};

/** start → angles('ai') → approve; returns the approved safe state. */
async function approvedPoster(base, token) {
  const started = await (await req(base, token, '/api/pipeline/start', 'POST', { prompt: 'stop phishing emails' })).json();
  await req(base, token, `/api/pipeline/${started.posterId}/angles`, 'POST', { angleIds: 'ai' });
  const res = await req(base, token, `/api/pipeline/${started.posterId}/approve`, 'POST', {});
  assert.equal(res.status, 200);
  return res.json();
}

test('full flow: approve → template gallery (recommended first) → apply → GET design', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, base, token } = await startServer(egress);
  try {
    const approved = await approvedPoster(base, token);

    // gallery: 12 v1 templates (recommended-first for the content shape)
    // merged with 64 v2 templates, all source-marked
    let res = await req(base, token, `/api/design/templates?posterId=${approved.posterId}`);
    assert.equal(res.status, 200);
    const gallery = await res.json();
    assert.equal(gallery.contentShape, 'red-flags');
    assert.equal(gallery.templates.length, 76, '12 v1 + 64 v2');
    const v1Templates = gallery.templates.filter((t) => t.source === 'v1');
    const v2Templates = gallery.templates.filter((t) => t.source === 'v2');
    assert.equal(v1Templates.length, 12);
    assert.equal(v2Templates.length, 64);
    assert.ok(gallery.templates[0].recommended, 'first template must be recommended');
    assert.ok(gallery.templates[0].suitedFor.includes('red-flags'));
    const flags = v1Templates.map((t) => t.recommended);
    assert.ok(!flags.slice(flags.indexOf(false)).includes(true), 'recommended v1 templates come first');
    for (const t of v1Templates) {
      assert.ok(t.previewSvg.startsWith('<svg'), `${t.id}: palette-resolved preview`);
      assert.ok(t.id && t.name && t.description, `${t.id}: gallery metadata`);
    }
    for (const t of v2Templates) {
      assert.ok(t.previews.portrait.startsWith('<svg'), `${t.id}: portrait preview`);
      assert.ok(t.previews.landscape.startsWith('<svg'), `${t.id}: landscape preview`);
      assert.ok(t.id && t.name && t.style && t.description && t.contentSchema, `${t.id}: v2 gallery metadata`);
    }
    // gallery requires a posterId
    assert.equal((await req(base, token, '/api/design/templates')).status, 400);

    // apply a predefined template
    res = await req(base, token, `/api/design/${approved.posterId}/apply`, 'POST', { templateId: gallery.templates[0].id });
    assert.equal(res.status, 200);
    const designed = await res.json();
    assert.equal(designed.status, 'designed');
    assert.equal(designed.design.templateSource, 'predefined');
    assert.equal(designed.design.templateId, gallery.templates[0].id);
    const msgIds = new Set(designed.design.canvas.objects.filter((o) => o.layerRole === 'message').map((o) => o.msgId));
    assert.deepEqual(msgIds, new Set(['msg-1', 'msg-2', 'msg-3', 'msg-4']));

    // GET design state
    res = await req(base, token, `/api/design/${approved.posterId}`);
    assert.equal(res.status, 200);
    const fetched = await res.json();
    assert.equal(fetched.design.templateId, designed.design.templateId);
    assert.equal(fetched.phase, 'designed');

    // validation + coded errors
    res = await req(base, token, `/api/design/${approved.posterId}/apply`, 'POST', {});
    assert.equal(res.status, 400);
    res = await req(base, token, `/api/design/${approved.posterId}/apply`, 'POST', { templateId: 'not-a-template' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'UNKNOWN_TEMPLATE');
    res = await req(base, token, '/api/design/00000000-0000-4000-8000-000000000000');
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'POSTER_NOT_FOUND');
    res = await req(base, token, `/api/design/${approved.posterId}/dynamic`, 'POST', { prompt: 'x'.repeat(2001) });
    assert.equal(res.status, 400);
  } finally { srv.close(); }
});

test('v2 template apply over the route: both orientations, portrait at design.canvas, blk-N bindings', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, base, token } = await startServer(egress);
  try {
    const approved = await approvedPoster(base, token);

    // timeline-journey is a v2 sequence template — v1 messages map to blocks
    let res = await req(base, token, `/api/design/${approved.posterId}/apply`, 'POST', { templateId: 'timeline-journey' });
    assert.equal(res.status, 200);
    const designed = await res.json();
    assert.equal(designed.status, 'designed');
    assert.equal(designed.design.templateSource, 'v2');
    assert.equal(designed.design.templateId, 'timeline-journey');
    // portrait canvas at the same key v1 used (editor/translation consumers)
    assert.equal(designed.design.canvas.width, 1414);
    assert.equal(designed.design.canvas.height, 2000);
    // landscape exposed via safeDesignState
    assert.equal(designed.design.landscapeCanvas.width, 2000);
    assert.equal(designed.design.landscapeCanvas.height, 1414);
    for (const canvas of [designed.design.canvas, designed.design.landscapeCanvas]) {
      const msgIds = new Set(canvas.objects.filter((o) => o.layerRole === 'message').map((o) => o.msgId));
      assert.deepEqual(msgIds, new Set(['blk-1', 'blk-2', 'blk-3', 'blk-4']));
    }

    // GET design round-trips the v2 shape
    res = await req(base, token, `/api/design/${approved.posterId}`);
    assert.equal(res.status, 200);
    const fetched = await res.json();
    assert.equal(fetched.design.templateSource, 'v2');
    assert.equal(fetched.design.landscapeCanvas.width, 2000);

    // a v2 template whose block fields v1 content cannot fill → 409
    res = await req(base, token, `/api/design/${approved.posterId}/apply`, 'POST', { templateId: 'qa-chat' });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, 'CONTENT_SCHEMA_MISMATCH');
  } finally { srv.close(); }
});

test('wrong phase: design endpoints refuse before content approval (409 WRONG_PHASE)', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, base, token } = await startServer(egress);
  try {
    const started = await (await req(base, token, '/api/pipeline/start', 'POST', { prompt: 'stop phishing emails' })).json();
    for (const [path, body] of [
      [`/api/design/${started.posterId}/apply`, { templateId: 'minimal-clean' }],
      [`/api/design/${started.posterId}/dynamic`, {}],
      [`/api/design/${started.posterId}/retry`, {}]
    ]) {
      const res = await req(base, token, path, 'POST', body);
      assert.equal(res.status, 409, `${path} must refuse in phase 'angles'`);
      assert.equal((await res.json()).error, 'WRONG_PHASE');
    }
    // GET design is phase-agnostic: null design before the design phase
    const res = await req(base, token, `/api/design/${started.posterId}`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).design, null);
  } finally { srv.close(); }
});

test('dynamic design then retry with a prompt: 90 gate, fenced instructions, redesign persisted', async () => {
  const egress = new FakeEgress({
    ...CONTENT_HANDLERS,
    'design-recommender/generate_mockup_spec': [structuredClone(DESIGN_SPEC), structuredClone(DESIGN_SPEC_V2)],
    'design-reviewer/validate_mockup': DESIGN_ACCEPT_REVIEW
  });
  const { srv, base, token } = await startServer(egress);
  try {
    const approved = await approvedPoster(base, token);

    // dynamic
    let res = await req(base, token, `/api/design/${approved.posterId}/dynamic`, 'POST', {});
    assert.equal(res.status, 200);
    const dynamic = await res.json();
    assert.equal(dynamic.status, 'designed');
    assert.equal(dynamic.design.templateSource, 'dynamic');
    assert.equal(dynamic.design.layoutType, DESIGN_SPEC.layoutType);
    assert.ok(dynamic.design.rationale, 'the recommendation rationale is surfaced to the user');
    assert.deepEqual(dynamic.design.reviewHistory.map((h) => h.status), ['accepted']);

    // retry with instructions (Option 2)
    res = await req(base, token, `/api/design/${approved.posterId}/retry`, 'POST', { prompt: 'use a dark left rail' });
    assert.equal(res.status, 200);
    const retried = await res.json();
    assert.equal(retried.design.layoutType, DESIGN_SPEC_V2.layoutType);

    const recommenderCalls = egress.callsFor('design-recommender');
    assert.equal(recommenderCalls.length, 2);
    assert.ok(recommenderCalls[1].opts.user.includes('<user_text>use a dark left rail</user_text>'),
      'retry prompt travels inside the data fence');
    assert.ok(recommenderCalls[1].opts.user.includes('rejected the previous design'));

    // persisted redesign
    const fetched = await (await req(base, token, `/api/design/${approved.posterId}`)).json();
    assert.equal(fetched.design.layoutType, DESIGN_SPEC_V2.layoutType);
  } finally { srv.close(); }
});

test('concurrent design mutation: second request gets 409 POSTER_BUSY', async () => {
  const egress = new FakeEgress({
    ...CONTENT_HANDLERS,
    // slow recommender keeps the first /dynamic in flight while we fire more
    'design-recommender/generate_mockup_spec': async () => { await delay(400); return structuredClone(DESIGN_SPEC); },
    'design-reviewer/validate_mockup': DESIGN_ACCEPT_REVIEW
  });
  const { srv, base, token } = await startServer(egress);
  try {
    const approved = await approvedPoster(base, token);

    const first = req(base, token, `/api/design/${approved.posterId}/dynamic`, 'POST', {});
    await delay(100); // let the first request take the poster lock
    const second = await req(base, token, `/api/design/${approved.posterId}/apply`, 'POST', { templateId: 'minimal-clean' });
    assert.equal(second.status, 409);
    assert.equal((await second.json()).error, 'POSTER_BUSY');

    const firstRes = await first;
    assert.equal(firstRes.status, 200, 'the in-flight design run must complete normally');
    assert.equal((await firstRes.json()).status, 'designed');
  } finally { srv.close(); }
});

test('design routes require the session token', async () => {
  const egress = new FakeEgress({});
  const { srv, base } = await startServer(egress);
  try {
    for (const [path, method, body] of [
      ['/api/design/templates?posterId=x', 'GET', undefined],
      ['/api/design/x/apply', 'POST', { templateId: 'minimal-clean' }],
      ['/api/design/x/dynamic', 'POST', {}],
      ['/api/design/x/retry', 'POST', {}]
    ]) {
      const res = await fetch(base + path, {
        method, headers: { 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
      });
      assert.equal(res.status, 401, `${path} must require the token`);
    }
    assert.equal(egress.calls.length, 0);
  } finally { srv.close(); }
});
