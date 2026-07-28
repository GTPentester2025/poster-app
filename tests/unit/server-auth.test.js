// Access + key-isolation tests. The server is loopback-only with NO token gate;
// the provider key is request-scoped (x-provider-key), so concurrent requests
// from different browsers never share a key.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../../backend/server.js';
import { createAppContext } from '../../backend/app-context.js';
import { currentKey } from '../../masking/request-key.js';

function startServer({ egress } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-auth-'));
  const ctx = createAppContext({ dataDir, logDir: join(dataDir, 'runs'), dbPath: join(dataDir, 'test.sqlite'), egress });
  const { app } = createServer(ctx, { dataDir });
  return new Promise((resolvePromise) => {
    const srv = app.listen(0, '127.0.0.1', () => {
      resolvePromise({ srv, base: `http://127.0.0.1:${srv.address().port}` });
    });
  });
}

test('GET /api/config is reachable with no token or cookie', async () => {
  const { srv, base } = await startServer();
  try {
    const res = await fetch(`${base}/api/config`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.orgConfig);
    assert.equal(body.secrets, undefined); // provider keys are never server-stored
  } finally { srv.close(); }
});

test('concurrent requests with different x-provider-key each see only their own key', async () => {
  // Stub egress echoes the request-scoped key so we can prove isolation across
  // two simultaneous requests (two "browsers").
  const egress = { testContentModel: async () => ({ ok: true, model: 'm', sample: currentKey() }) };
  const { srv, base } = await startServer({ egress });
  try {
    const hit = (key) => fetch(`${base}/api/config/test`, { method: 'POST', headers: { 'x-provider-key': key } }).then((r) => r.json());
    const [a, b] = await Promise.all([hit('key-AAA'), hit('key-BBB')]);
    assert.equal(a.sample, 'key-AAA');
    assert.equal(b.sample, 'key-BBB');
  } finally { srv.close(); }
});
