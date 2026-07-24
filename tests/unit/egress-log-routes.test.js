// Egress call log route tests (prompt transparency rail, plan section D3).
// Tests the GET /api/egress/:runId (list, no prompt bodies) and
// GET /api/egress/detail/:id (full row) endpoints.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../../backend/server.js';
import { createAppContext } from '../../backend/app-context.js';
import { FakeEgress } from './helpers/fake_egress.js';

function startServer() {
  const egress = new FakeEgress({});
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-egress-routes-'));
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

function req(base, token, path, method = 'GET', body = undefined) {
  return fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Session-Token': token } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}

/** Insert test egress_log rows directly to avoid real model calls. */
function seedEgressLog(db, { runId = 'run_test', count = 2 } = {}) {
  const ids = [];
  for (let i = 0; i < count; i++) {
    const result = db.prepare(`
      INSERT INTO egress_log
        (ts, run_id, event_id, pipeline, stage, agent, skill,
         direction, model, masked_system, masked_prompt, masked_response,
         duration_ms, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      new Date().toISOString(),
      runId,
      `evt-${i}`,
      'content',
      `stage-${i}`,
      'content-generation',
      'write_poster_copy',
      'outbound',
      'gpt-4o',
      'You write posters for {{ORG_NAME}} employees.',
      `Write a poster about phishing. Report to {{SOC_EMAIL}}. Call ${i}.`,
      `{{ORG_NAME}} employees: beware phishing. Contact {{SOC_EMAIL}}.`,
      120 + i * 10,
      'ok'
    );
    ids.push(result.lastInsertRowid);
  }
  return ids;
}

test('egress log list: 401 without session token', async () => {
  const { srv, base } = await startServer();
  try {
    const res = await req(base, null, '/api/egress/run_test');
    assert.equal(res.status, 401, 'unauthenticated request rejected');
  } finally { srv.close(); }
});

test('egress log detail: 401 without session token', async () => {
  const { srv, base } = await startServer();
  try {
    const res = await req(base, null, '/api/egress/detail/1');
    assert.equal(res.status, 401, 'unauthenticated detail request rejected');
  } finally { srv.close(); }
});

test('egress log list: returns rows for runId, shape has no prompt bodies', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    const runId = 'run_shape_test';
    seedEgressLog(ctx.db, { runId, count: 3 });

    const res = await req(base, token, `/api/egress/${runId}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.egressLog), 'response has egressLog array');
    assert.equal(body.egressLog.length, 3, 'returns correct number of rows');

    const row = body.egressLog[0];
    // Required list fields
    assert.ok('id' in row, 'id present');
    assert.ok('ts' in row, 'ts present');
    assert.ok('stage' in row, 'stage present');
    assert.ok('agent' in row, 'agent present');
    assert.ok('skill' in row, 'skill present');
    assert.ok('model' in row, 'model present');
    assert.ok('direction' in row, 'direction present');
    assert.ok('duration_ms' in row, 'duration_ms present');
    assert.ok('status' in row, 'status present');

    // SECURITY: list must NOT include prompt bodies
    assert.ok(!('masked_system' in row), 'list must NOT include masked_system');
    assert.ok(!('masked_prompt' in row), 'list must NOT include masked_prompt');
    assert.ok(!('masked_response' in row), 'list must NOT include masked_response');
    assert.ok(!('run_id' in row), 'list must NOT include run_id (use the param)');
  } finally { srv.close(); }
});

test('egress log list: empty for unknown runId', async () => {
  const { srv, base, token } = await startServer();
  try {
    const res = await req(base, token, '/api/egress/no_such_run');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.egressLog, [], 'no rows for unknown runId');
  } finally { srv.close(); }
});

test('egress log detail: returns full row with masked texts', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    const runId = 'run_detail_test';
    const [id] = seedEgressLog(ctx.db, { runId, count: 1 });

    const res = await req(base, token, `/api/egress/detail/${id}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.entry, 'response has entry field');

    const entry = body.entry;
    assert.equal(entry.id, id);
    assert.equal(entry.run_id, runId);
    // Full row includes all masked text fields
    assert.ok('masked_system' in entry, 'detail includes masked_system');
    assert.ok('masked_prompt' in entry, 'detail includes masked_prompt');
    assert.ok('masked_response' in entry, 'detail includes masked_response');
    assert.ok('pipeline' in entry, 'detail includes pipeline');
    assert.ok('event_id' in entry, 'detail includes event_id');

    // SECURITY: stored text must contain placeholders, not real org values
    assert.ok(entry.masked_prompt.includes('{{SOC_EMAIL}}'), 'masked_prompt has placeholder');
    assert.ok(entry.masked_system.includes('{{ORG_NAME}}'), 'masked_system has placeholder');
    assert.ok(entry.masked_response.includes('{{SOC_EMAIL}}'), 'masked_response has placeholder');

    // Double-check no real org values leaked into the API response
    const serialized = JSON.stringify(body);
    assert.ok(!serialized.includes('ab-inbev.com'), 'no real domain in response');
    assert.ok(!serialized.includes('soc@'), 'no real email in response');
  } finally { srv.close(); }
});

test('egress log detail: 404 for unknown id', async () => {
  const { srv, base, token } = await startServer();
  try {
    const res = await req(base, token, '/api/egress/detail/99999');
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, 'NOT_FOUND');
  } finally { srv.close(); }
});

test('egress log list: rows ordered by id ascending', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    const runId = 'run_order_test';
    seedEgressLog(ctx.db, { runId, count: 4 });

    const res = await req(base, token, `/api/egress/${runId}`);
    assert.equal(res.status, 200);
    const { egressLog } = await res.json();
    assert.equal(egressLog.length, 4);
    for (let i = 1; i < egressLog.length; i++) {
      assert.ok(egressLog[i].id > egressLog[i - 1].id, 'rows ordered by id ASC');
    }
  } finally { srv.close(); }
});

test('egress log list: rows for different runIds are isolated', async () => {
  const { srv, ctx, base, token } = await startServer();
  try {
    seedEgressLog(ctx.db, { runId: 'run_A', count: 2 });
    seedEgressLog(ctx.db, { runId: 'run_B', count: 3 });

    const resA = await req(base, token, '/api/egress/run_A');
    const resB = await req(base, token, '/api/egress/run_B');
    assert.equal(resA.status, 200);
    assert.equal(resB.status, 200);
    assert.equal((await resA.json()).egressLog.length, 2, 'run_A has exactly 2 rows');
    assert.equal((await resB.json()).egressLog.length, 3, 'run_B has exactly 3 rows');
  } finally { srv.close(); }
});
