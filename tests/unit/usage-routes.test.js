// Token usage tracking tests.
// Covers: migration v5, egress token capture, GET /api/usage/:posterId route.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { EventBus } from '#shared';
import { Vault } from '../../masking/vault.js';
import { MaskingEgress } from '../../masking/egress.js';
import { migrate } from '../../backend/db.js';
import { createServer } from '../../backend/server.js';
import { createAppContext } from '../../backend/app-context.js';
import { FakeEgress } from './helpers/fake_egress.js';

// ── Task 1: migration v5 ─────────────────────────────────────────────────────

test('migration v5: egress_log has prompt_tokens and completion_tokens columns', () => {
  const db = new Database(':memory:');
  migrate(db);
  const cols = db.prepare('PRAGMA table_info(egress_log)').all().map((r) => r.name);
  assert.ok(cols.includes('prompt_tokens'), 'prompt_tokens column present');
  assert.ok(cols.includes('completion_tokens'), 'completion_tokens column present');
});

// ── Task 2: egress token capture ─────────────────────────────────────────────

const ORG_SIMPLE = {
  companyName: 'TestCo', orgDomains: ['testco.com'],
  socEmail: 'soc@testco.com', trainingPortalUrl: 'https://train.testco.com',
  contentPortalUrl: 'https://portal.testco.com', reportingUrl: 'https://report.testco.com',
  itHelpdesk: 'IT x99'
};

function makeEgressWithUsage({ chatUsage = null, imageUsage = null } = {}) {
  const db = new Database(':memory:');
  migrate(db);
  const dir = mkdtempSync(join(tmpdir(), 'postter-usage-egress-'));
  const vault = new Vault({ db });
  vault.setOrgConfig(ORG_SIMPLE);
  const bus = new EventBus({ logDir: dir, db });
  const openai = {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: 'OK' } }],
          usage: chatUsage
        })
      }
    },
    images: {
      generate: async () => ({
        data: [{ b64_json: 'aGVsbG8=' }],
        usage: imageUsage
      })
    }
  };
  return { egress: new MaskingEgress({ vault, bus, db, transports: { openai } }), db };
}

const CTX2 = { runId: 'run_tok', pipeline: 'content', stage: 'content-gen', agent: 'gen', skill: 'write' };

test('egress: completeText writes prompt_tokens + completion_tokens when usage present', async () => {
  const { egress, db } = makeEgressWithUsage({ chatUsage: { prompt_tokens: 150, completion_tokens: 80 } });
  await egress.completeText({ user: 'hello TestCo' }, CTX2);
  const row = db.prepare('SELECT prompt_tokens, completion_tokens FROM egress_log WHERE run_id = ?').get(CTX2.runId);
  assert.equal(row.prompt_tokens, 150);
  assert.equal(row.completion_tokens, 80);
});

test('egress: completeText writes null tokens when usage absent', async () => {
  const { egress, db } = makeEgressWithUsage({ chatUsage: null });
  await egress.completeText({ user: 'hello TestCo' }, CTX2);
  const row = db.prepare('SELECT prompt_tokens, completion_tokens FROM egress_log WHERE run_id = ?').get(CTX2.runId);
  assert.equal(row.prompt_tokens, null);
  assert.equal(row.completion_tokens, null);
});

test('egress: generateImage maps input_tokens/output_tokens to prompt/completion', async () => {
  const { egress, db } = makeEgressWithUsage({
    imageUsage: { input_tokens: 60, output_tokens: 1200 }
  });
  await egress.generateImage({ prompt: 'shield for TestCo' }, CTX2);
  const row = db.prepare('SELECT prompt_tokens, completion_tokens FROM egress_log WHERE run_id = ?').get(CTX2.runId);
  assert.equal(row.prompt_tokens, 60);
  assert.equal(row.completion_tokens, 1200);
});

// ── Task 3: GET /api/usage/:posterId route ───────────────────────────────────

function startUsageServer() {
  const egress = new FakeEgress({});
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-usage-routes-'));
  const ctx = createAppContext({
    dataDir, logDir: join(dataDir, 'runs'),
    dbPath: join(dataDir, 'test.sqlite'),
    egress
  });
  return new Promise((resolve) => {
    const { app, token } = createServer(ctx, { dataDir });
    const srv = app.listen(0, '127.0.0.1', () => {
      resolve({ srv, ctx, token, base: `http://127.0.0.1:${srv.address().port}` });
    });
  });
}

function req(base, token, path) {
  return fetch(base + path, {
    headers: { 'X-Session-Token': token }
  });
}

/** Seed a minimal poster row with a known runId */
function seedPoster(db, { posterId = 'poster-test-001', runId = 'run-test-001' } = {}) {
  const doc = JSON.stringify({ runId, phase: 'content', snapshots: [] });
  db.prepare(
    'INSERT INTO posters (poster_id, name, status, created_at, updated_at, doc) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(posterId, 'Test Poster', 'content', new Date().toISOString(), new Date().toISOString(), doc);
  return { posterId, runId };
}

/** Insert egress_log rows with token data */
function seedEgressWithTokens(db, runId) {
  const rows = [
    { pipeline: 'content', stage: 'content-gen', model: 'gpt-4o', promptTokens: 100, completionTokens: 50 },
    { pipeline: 'content', stage: 'content-gen', model: 'gpt-4o', promptTokens: 120, completionTokens: 60 },
    { pipeline: 'content', stage: 'content-review', model: 'gpt-4o', promptTokens: 80, completionTokens: 30 },
    { pipeline: 'image', stage: 'image-gen', model: 'gpt-image-1', promptTokens: 40, completionTokens: 800 },
  ];
  for (const r of rows) {
    db.prepare(`
      INSERT INTO egress_log
        (ts, run_id, pipeline, stage, agent, skill, direction, model,
         masked_prompt, duration_ms, status, prompt_tokens, completion_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(new Date().toISOString(), runId, r.pipeline, r.stage,
      'test-agent', 'test-skill', 'outbound', r.model,
      'masked {{ORG_NAME}}', 100, 'ok', r.promptTokens, r.completionTokens);
  }
}

test('GET /api/usage/:posterId: returns grouped rows and totals', async () => {
  const { srv, ctx, base, token } = await startUsageServer();
  try {
    const { posterId, runId } = seedPoster(ctx.db);
    seedEgressWithTokens(ctx.db, runId);

    const res = await req(base, token, `/api/usage/${posterId}`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.ok(Array.isArray(body.rows), 'rows is an array');
    assert.ok(typeof body.totals === 'object', 'totals is an object');

    // Should have 3 distinct groups: content/content-gen/gpt-4o, content/content-review/gpt-4o, image/image-gen/gpt-image-1
    assert.equal(body.rows.length, 3, 'three grouped rows');

    const contentGen = body.rows.find((r) => r.stage === 'content-gen');
    assert.ok(contentGen, 'content-gen row present');
    assert.equal(contentGen.model, 'gpt-4o');
    assert.equal(contentGen.calls, 2, 'two content-gen calls aggregated');
    assert.equal(contentGen.inTok, 220, 'inTok = 100+120');
    assert.equal(contentGen.outTok, 110, 'outTok = 50+60');

    const imageGen = body.rows.find((r) => r.stage === 'image-gen');
    assert.ok(imageGen, 'image-gen row present');
    assert.equal(imageGen.calls, 1);
    assert.equal(imageGen.inTok, 40);
    assert.equal(imageGen.outTok, 800);

    // totals
    assert.equal(body.totals.calls, 4);
    assert.equal(body.totals.inTok, 340);   // 100+120+80+40
    assert.equal(body.totals.outTok, 940);  // 50+60+30+800

    // SECURITY: no masked prompt text in the response
    const serialized = JSON.stringify(body);
    assert.ok(!serialized.includes('masked'), 'no masked text in usage response');
    assert.ok(!serialized.includes('ORG_NAME'), 'no placeholder in usage response');
  } finally { srv.close(); }
});

test('GET /api/usage: per-poster overview with totals + image-token split', async () => {
  const { srv, ctx, base, token } = await startUsageServer();
  try {
    const { posterId, runId } = seedPoster(ctx.db);
    seedEgressWithTokens(ctx.db, runId);
    seedPoster(ctx.db, { posterId: 'poster-empty', runId: 'run-empty' }); // no egress rows → excluded by the JOIN

    const res = await req(base, token, '/api/usage');
    assert.equal(res.status, 200);
    const { posters } = await res.json();
    assert.equal(posters.length, 1, 'only metered posters listed');
    const p = posters[0];
    assert.equal(p.posterId, posterId);
    assert.equal(p.calls, 4);
    assert.equal(p.inTok, 340);
    assert.equal(p.outTok, 940);
    assert.equal(p.imgIn, 40, 'image input tokens split out');
    assert.equal(p.imgOut, 800, 'image output tokens split out');
    const serialized = JSON.stringify(posters);
    assert.ok(!serialized.includes('masked'), 'no masked text in overview');
  } finally { srv.close(); }
});

test('GET /api/usage/:posterId: poster with no egress rows returns zero totals', async () => {
  const { srv, ctx, base, token } = await startUsageServer();
  try {
    const { posterId } = seedPoster(ctx.db, { posterId: 'poster-empty', runId: 'run-empty' });

    const res = await req(base, token, `/api/usage/${posterId}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.rows, []);
    assert.equal(body.totals.calls, 0);
    assert.equal(body.totals.inTok, 0);
    assert.equal(body.totals.outTok, 0);
  } finally { srv.close(); }
});

test('GET /api/usage/:posterId: unknown poster returns 404 POSTER_NOT_FOUND', async () => {
  const { srv, base, token } = await startUsageServer();
  try {
    const res = await req(base, token, '/api/usage/00000000-0000-4000-8000-000000000000');
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'POSTER_NOT_FOUND');
  } finally { srv.close(); }
});

test('GET /api/usage/:posterId: requires session token', async () => {
  const { srv, ctx, base } = await startUsageServer();
  try {
    const { posterId } = seedPoster(ctx.db);
    const res = await fetch(`${base}/api/usage/${posterId}`);
    assert.equal(res.status, 401);
  } finally { srv.close(); }
});
