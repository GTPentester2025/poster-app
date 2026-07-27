// Config API tests for the custom-provider surface: provider config in GET,
// PUT /provider, customKey via PUT /secrets, and GET /models/live (egress).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../../backend/server.js';
import { createAppContext } from '../../backend/app-context.js';

function startServer({ egress } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-config-'));
  const ctx = createAppContext({ dataDir, logDir: join(dataDir, 'runs'), dbPath: join(dataDir, 'test.sqlite'), egress });
  const { app, token } = createServer(ctx, { dataDir });
  return new Promise((resolvePromise) => {
    const srv = app.listen(0, '127.0.0.1', () => {
      resolvePromise({ srv, token, base: `http://127.0.0.1:${srv.address().port}`, ctx });
    });
  });
}

const H = (token) => ({ 'X-Session-Token': token, 'Content-Type': 'application/json' });

test('GET /api/config exposes provider config + provider list, defaulting to openai', async () => {
  const { srv, base, token } = await startServer();
  try {
    const res = await fetch(`${base}/api/config`, { headers: H(token) });
    const body = await res.json();
    assert.deepEqual(body.providerConfig, { provider: 'openai', customBaseUrl: '', customModels: { content: '', vision: '', image: '' } });
    assert.deepEqual(body.providers, ['openai', 'custom']);
    assert.equal(body.secrets.customConfigured, false);
  } finally { srv.close(); }
});

test('PUT /api/config/provider persists a custom per-role selection and round-trips via GET', async () => {
  const { srv, base, token } = await startServer();
  try {
    const put = await fetch(`${base}/api/config/provider`, {
      method: 'PUT', headers: H(token),
      body: JSON.stringify({ provider: 'custom', customBaseUrl: 'http://localhost:11434/v1',
        customModels: { content: 'llama3.1', image: 'sdxl' } })
    });
    assert.equal(put.status, 200);
    const { providerConfig } = await put.json();
    assert.equal(providerConfig.provider, 'custom');
    assert.equal(providerConfig.customModels.content, 'llama3.1');
    assert.equal(providerConfig.customModels.image, 'sdxl');
    const get = await (await fetch(`${base}/api/config`, { headers: H(token) })).json();
    // content flows to model resolution; unset vision falls back to content
    assert.equal(get.models.content, 'llama3.1');
    assert.equal(get.models.vision, 'llama3.1');
    assert.equal(get.models.image, 'sdxl');
  } finally { srv.close(); }
});

test('PUT /api/config/provider rejects an unknown provider with 400', async () => {
  const { srv, base, token } = await startServer();
  try {
    const res = await fetch(`${base}/api/config/provider`, {
      method: 'PUT', headers: H(token), body: JSON.stringify({ provider: 'gemini' })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'PROVIDER_INVALID');
  } finally { srv.close(); }
});

test('PUT /api/config/secrets accepts customKey and reports customConfigured', async () => {
  const { srv, base, token } = await startServer();
  try {
    const res = await fetch(`${base}/api/config/secrets`, {
      method: 'PUT', headers: H(token), body: JSON.stringify({ customKey: 'or-' + 'k'.repeat(20) })
    });
    assert.equal(res.status, 200);
    const { secrets } = await res.json();
    assert.equal(secrets.customConfigured, true);
    // the key itself is never echoed
    assert.ok(!JSON.stringify(secrets).match(/or-k/));
  } finally { srv.close(); }
});

test('GET /api/config/models/live returns the model list from the egress', async () => {
  const fakeEgress = { listModels: async () => ['llama3.1', 'mistral'] };
  const { srv, base, token } = await startServer({ egress: fakeEgress });
  try {
    const res = await fetch(`${base}/api/config/models/live`, { headers: H(token) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.models, ['llama3.1', 'mistral']);
  } finally { srv.close(); }
});

test('GET /api/config/models/live maps endpoint failure to 502', async () => {
  const err = new Error('Model endpoint returned HTTP 500');
  err.code = 'MODELS_FETCH_FAILED'; err.status = 502;
  const fakeEgress = { listModels: async () => { throw err; } };
  const { srv, base, token } = await startServer({ egress: fakeEgress });
  try {
    const res = await fetch(`${base}/api/config/models/live`, { headers: H(token) });
    assert.equal(res.status, 502);
    assert.equal((await res.json()).error, 'MODELS_FETCH_FAILED');
  } finally { srv.close(); }
});

test('POST /api/config/test surfaces the egress probe result', async () => {
  const egress = { testContentModel: async () => ({ ok: false, code: 'CALL_FAILED', status: 400, message: 'Unsupported parameter: max_tokens' }) };
  const { srv, base, token } = await startServer({ egress });
  try {
    const res = await fetch(`${base}/api/config/test`, { method: 'POST', headers: H(token) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.status, 400);
    assert.match(body.message, /max_tokens/);
  } finally { srv.close(); }
});

test('POST /api/config/test returns 200 with ok:false even when the probe throws', async () => {
  const egress = { testContentModel: async () => { const e = new Error('boom'); e.code = 'CALL_FAILED'; throw e; } };
  const { srv, base, token } = await startServer({ egress });
  try {
    const res = await fetch(`${base}/api/config/test`, { method: 'POST', headers: H(token) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.code, 'CALL_FAILED');
  } finally { srv.close(); }
});
