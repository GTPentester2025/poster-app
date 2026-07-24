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
    assert.deepEqual(body.providerConfig, { provider: 'openai', customBaseUrl: '', customModel: '' });
    assert.deepEqual(body.providers, ['openai', 'custom']);
    assert.equal(body.secrets.customConfigured, false);
  } finally { srv.close(); }
});

test('PUT /api/config/provider persists a custom selection and round-trips via GET', async () => {
  const { srv, base, token } = await startServer();
  try {
    const put = await fetch(`${base}/api/config/provider`, {
      method: 'PUT', headers: H(token),
      body: JSON.stringify({ provider: 'custom', customBaseUrl: 'http://localhost:11434/v1', customModel: 'llama3.1' })
    });
    assert.equal(put.status, 200);
    const { providerConfig } = await put.json();
    assert.deepEqual(providerConfig, { provider: 'custom', customBaseUrl: 'http://localhost:11434/v1', customModel: 'llama3.1' });
    const get = await (await fetch(`${base}/api/config`, { headers: H(token) })).json();
    assert.equal(get.providerConfig.provider, 'custom');
    // custom model bypasses the allow-list and flows to models resolution
    assert.equal(get.models.content, 'llama3.1');
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
