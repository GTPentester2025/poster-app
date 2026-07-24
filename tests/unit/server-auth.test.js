// API auth tests: no other local process may read pipeline events or config
// without the session token.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../../backend/server.js';
import { createAppContext } from '../../backend/app-context.js';

function startServer() {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-auth-'));
  const ctx = createAppContext({ dataDir, logDir: join(dataDir, 'runs'), dbPath: join(dataDir, 'test.sqlite') });
  const { app, token } = createServer(ctx, { dataDir });
  return new Promise((resolvePromise) => {
    const srv = app.listen(0, '127.0.0.1', () => {
      resolvePromise({ srv, token, base: `http://127.0.0.1:${srv.address().port}` });
    });
  });
}

test('API rejects requests without token (401)', async () => {
  const { srv, base } = await startServer();
  try {
    for (const path of ['/api/config', '/api/events/run_x', '/api/events/stream']) {
      const res = await fetch(base + path);
      assert.equal(res.status, 401, `${path} must be gated`);
    }
  } finally { srv.close(); }
});

test('API accepts X-Session-Token header', async () => {
  const { srv, base, token } = await startServer();
  try {
    const res = await fetch(`${base}/api/config`, { headers: { 'X-Session-Token': token } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.orgConfig);
    assert.ok(!JSON.stringify(body.secrets).match(/sk-/));
  } finally { srv.close(); }
});

test('tokenized URL sets session cookie which then authorizes API', async () => {
  const { srv, base, token } = await startServer();
  try {
    const first = await fetch(`${base}/?token=${token}`, { redirect: 'manual' });
    const setCookie = first.headers.get('set-cookie');
    assert.ok(setCookie && setCookie.includes('poster_session='), 'cookie must be set on tokenized visit');
    const cookie = setCookie.split(';')[0];
    const res = await fetch(`${base}/api/config`, { headers: { Cookie: cookie } });
    assert.equal(res.status, 200);
  } finally { srv.close(); }
});

test('wrong token gets no cookie and no access', async () => {
  const { srv, base } = await startServer();
  try {
    const first = await fetch(`${base}/?token=wrong`, { redirect: 'manual' });
    assert.equal(first.headers.get('set-cookie'), null);
    const res = await fetch(`${base}/api/config`, { headers: { 'X-Session-Token': 'wrong' } });
    assert.equal(res.status, 401);
  } finally { srv.close(); }
});
