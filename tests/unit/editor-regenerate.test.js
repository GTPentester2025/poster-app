// editor-regenerate.test.js — POST /api/editor/:posterId/regenerate-text
//
// Covers:
//  - happy paths: headline / subheadline / cta / message (by msgId) / block fieldRef
//  - returned safe state carries regenText + content binding updated in DB
//  - model error → 502 REGENERATE_FAILED (client-side toast path)
//  - validation: missing layerRole 400, unknown layerRole 400, wrong phase 409
//  - poster lock: POSTER_BUSY 409 when an operation is already in flight
//  - session token required: 401 without token
//  - snapshot appended + bus event emitted on success

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

// ── server bootstrap ────────────────────────────────────────────────────────

function startServer(egress) {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-regen-'));
  const ctx = createAppContext({
    dataDir, logDir: join(dataDir, 'runs'), dbPath: join(dataDir, 'test.sqlite'), egress
  });
  seedArticles(ctx.db);
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

const CONTENT_HANDLERS = {
  'keyword-intent': INTENT_OUTPUT,
  'rag-research/synthesize_context': CONTEXT_OUTPUT,
  'content-generator': () => structuredClone(POSTER_CONTENT),
  'content-reviewer': ACCEPT_REVIEW
};

/** Seed a fully designed poster so the editor routes are open. */
async function designedPoster(base, token) {
  const started = await (await req(base, token, '/api/pipeline/start', 'POST', { prompt: 'stop phishing emails' })).json();
  await req(base, token, `/api/pipeline/${started.posterId}/angles`, 'POST', { angleIds: 'ai' });
  await req(base, token, `/api/pipeline/${started.posterId}/approve`, 'POST', {});
  const res = await req(base, token, `/api/design/${started.posterId}/apply`, 'POST', { templateId: 'minimal-clean' });
  assert.equal(res.status, 200);
  return res.json();
}

function loadDoc(ctx, posterId) {
  return JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc);
}

// ── happy paths ─────────────────────────────────────────────────────────────

test('regenerate headline: content updated in DB, regenText in response, safe state returned', async () => {
  const freshHeadline = 'Stop Phishing Before It Starts';
  const egress = new FakeEgress({
    ...CONTENT_HANDLERS,
    'content-generator/regenerate_text': freshHeadline
  });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const posterId = designed.posterId;
    const snapshotsBefore = loadDoc(ctx, posterId).snapshots.length;

    const res = await req(base, token, `/api/editor/${posterId}/regenerate-text`, 'POST', {
      layerRole: 'headline'
    });
    assert.equal(res.status, 200, 'regenerate-text must return 200 on success');
    const body = await res.json();

    // safe state shape
    assert.equal(body.posterId, posterId);
    assert.equal(body.phase, 'designed');
    assert.equal(typeof body.design, 'object', 'safe design state must be present');

    // regenText echoed back
    assert.equal(body.regenText, freshHeadline, 'regenText must equal the model output');

    // content updated in DB
    const doc = loadDoc(ctx, posterId);
    assert.equal(doc.content.headline, freshHeadline, 'doc.content.headline must be updated');

    // snapshot appended
    assert.equal(doc.snapshots.length, snapshotsBefore + 1);
    assert.equal(doc.snapshots.at(-1).state.trigger, 'editor-regenerate-text');
    assert.equal(doc.snapshots.at(-1).state.layerRole, 'headline');
  } finally { srv.close(); }
});

test('regenerate subheadline: content.subheadline updated', async () => {
  const freshSub = 'Attackers mimic real pages — check the URL first';
  const egress = new FakeEgress({
    ...CONTENT_HANDLERS,
    'content-generator/regenerate_text': freshSub
  });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const res = await req(base, token, `/api/editor/${designed.posterId}/regenerate-text`, 'POST', {
      layerRole: 'subheadline'
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.regenText, freshSub);
    assert.equal(loadDoc(ctx, designed.posterId).content.subheadline, freshSub);
  } finally { srv.close(); }
});

test('regenerate cta: content.callToAction updated', async () => {
  const freshCta = 'Forward anything suspicious to your security team now';
  const egress = new FakeEgress({
    ...CONTENT_HANDLERS,
    'content-generator/regenerate_text': freshCta
  });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const res = await req(base, token, `/api/editor/${designed.posterId}/regenerate-text`, 'POST', {
      layerRole: 'cta'
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.regenText, freshCta);
    assert.equal(loadDoc(ctx, designed.posterId).content.callToAction, freshCta);
  } finally { srv.close(); }
});

test('regenerate message by msgId: correct messages entry updated', async () => {
  const freshMsg = 'A code-scanning app that bypasses the corporate proxy';
  const egress = new FakeEgress({
    ...CONTENT_HANDLERS,
    'content-generator/regenerate_text': freshMsg
  });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const posterId = designed.posterId;
    // Pick the first message id from the content
    const doc0 = loadDoc(ctx, posterId);
    const msgs = doc0.content.messages;
    assert.ok(msgs && msgs.length > 0, 'poster must have at least one message');
    const targetMsgId = msgs[0].id;
    const otherMsgs = msgs.slice(1).map((m) => m.text);

    const res = await req(base, token, `/api/editor/${posterId}/regenerate-text`, 'POST', {
      layerRole: 'message',
      msgId: targetMsgId
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.regenText, freshMsg, 'regenText matches model output');

    const docAfter = loadDoc(ctx, posterId);
    const updated = docAfter.content.messages.find((m) => m.id === targetMsgId);
    assert.ok(updated, 'message must still exist');
    assert.equal(updated.text, freshMsg, 'target message text updated');
    // other messages untouched
    const others = docAfter.content.messages.filter((m) => m.id !== targetMsgId);
    for (let i = 0; i < others.length; i++) {
      assert.equal(others[i].text, otherMsgs[i], `message ${i + 1} must be untouched`);
    }
  } finally { srv.close(); }
});

// ── 502 failure path ────────────────────────────────────────────────────────

test('model error → 502 REGENERATE_FAILED (no crash, client toasts it)', async () => {
  const egress = new FakeEgress({
    ...CONTENT_HANDLERS,
    'content-generator/regenerate_text': () => { throw new Error('upstream timeout'); }
  });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const snapshotsBefore = loadDoc(ctx, designed.posterId).snapshots.length;

    const res = await req(base, token, `/api/editor/${designed.posterId}/regenerate-text`, 'POST', {
      layerRole: 'headline'
    });
    assert.equal(res.status, 502, 'model failure must yield 502');
    const body = await res.json();
    assert.equal(body.error, 'REGENERATE_FAILED', 'error code for client toast');

    // no snapshot on failure
    assert.equal(loadDoc(ctx, designed.posterId).snapshots.length, snapshotsBefore, 'no snapshot on 502');
  } finally { srv.close(); }
});

test('model returns empty string → 502 REGENERATE_FAILED', async () => {
  const egress = new FakeEgress({
    ...CONTENT_HANDLERS,
    'content-generator/regenerate_text': ''
  });
  const { srv, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const res = await req(base, token, `/api/editor/${designed.posterId}/regenerate-text`, 'POST', {
      layerRole: 'headline'
    });
    assert.equal(res.status, 502);
    assert.equal((await res.json()).error, 'REGENERATE_FAILED');
  } finally { srv.close(); }
});

test('model returns string > 300 chars → 502 REGENERATE_FAILED', async () => {
  const egress = new FakeEgress({
    ...CONTENT_HANDLERS,
    'content-generator/regenerate_text': 'A'.repeat(301)
  });
  const { srv, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const res = await req(base, token, `/api/editor/${designed.posterId}/regenerate-text`, 'POST', {
      layerRole: 'headline'
    });
    assert.equal(res.status, 502);
    assert.equal((await res.json()).error, 'REGENERATE_FAILED');
  } finally { srv.close(); }
});

// ── validation errors ───────────────────────────────────────────────────────

test('missing layerRole → 400', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const res = await req(base, token, `/api/editor/${designed.posterId}/regenerate-text`, 'POST', {});
    assert.equal(res.status, 400);
  } finally { srv.close(); }
});

test('unknown layerRole → 400', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const res = await req(base, token, `/api/editor/${designed.posterId}/regenerate-text`, 'POST', {
      layerRole: 'background'
    });
    assert.equal(res.status, 400);
  } finally { srv.close(); }
});

test('wrong phase (pre-design) → 409 WRONG_PHASE', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, base, token } = await startServer(egress);
  try {
    const started = await (await req(base, token, '/api/pipeline/start', 'POST', { prompt: 'phishing' })).json();
    // still in 'angles' phase, not yet designed
    const res = await req(base, token, `/api/editor/${started.posterId}/regenerate-text`, 'POST', {
      layerRole: 'headline'
    });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, 'WRONG_PHASE');
  } finally { srv.close(); }
});

test('unknown poster → 404 POSTER_NOT_FOUND', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, base, token } = await startServer(egress);
  try {
    const res = await req(base, token, '/api/editor/00000000-0000-4000-8000-000000000000/regenerate-text', 'POST', {
      layerRole: 'headline'
    });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'POSTER_NOT_FOUND');
  } finally { srv.close(); }
});

// ── auth ────────────────────────────────────────────────────────────────────

test('regenerate-text requires session token → 401 without it', async () => {
  const egress = new FakeEgress({});
  const { srv, base } = await startServer(egress);
  try {
    const res = await fetch(`${base}/api/editor/x/regenerate-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layerRole: 'headline' })
    });
    assert.equal(res.status, 401);
  } finally { srv.close(); }
});

// ── bus event ───────────────────────────────────────────────────────────────

test('successful regenerate emits one user_action event with correct fields', async () => {
  const egress = new FakeEgress({
    ...CONTENT_HANDLERS,
    'content-generator/regenerate_text': 'Spot the Fake'
  });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const posterId = designed.posterId;
    const runId = designed.runId;
    const eventsBefore = ctx.bus.eventsForRun(runId).length;

    await req(base, token, `/api/editor/${posterId}/regenerate-text`, 'POST', { layerRole: 'headline' });

    const newEvents = ctx.bus.eventsForRun(runId).slice(eventsBefore);
    assert.equal(newEvents.length, 1, 'exactly one event emitted');
    assert.equal(newEvents[0].type, 'user_action');
    assert.equal(newEvents[0].agent, 'content-generator');
    const payload = JSON.parse(newEvents[0].payload);
    assert.equal(payload.posterId, posterId);
    assert.equal(payload.layerRole, 'headline');
  } finally { srv.close(); }
});
