// RAG route tests against the real server (same pattern as server-auth.test.js):
// /seed must ignore caller-supplied seedPath (arbitrary-file-read fix),
// /fetch must validate maxPerFeed, /context must validate inputs and degrade
// to contextFile:null on an empty index without ever touching egress.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../../backend/server.js';
import { createAppContext } from '../../backend/app-context.js';

function startServer() {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-rag-routes-'));
  const ctx = createAppContext({ dataDir, logDir: join(dataDir, 'runs'), dbPath: join(dataDir, 'test.sqlite') });
  const { app, token } = createServer(ctx, { dataDir });
  return new Promise((resolvePromise) => {
    const srv = app.listen(0, '127.0.0.1', () => {
      resolvePromise({ srv, token, dataDir, base: `http://127.0.0.1:${srv.address().port}` });
    });
  });
}

function post(base, token, path, body) {
  return fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
    body: JSON.stringify(body)
  });
}

test('POST /api/rag/seed ignores caller-supplied seedPath (no arbitrary file read)', async () => {
  const { srv, base, token, dataDir } = await startServer();
  try {
    // A real, readable file that is NOT a seed export. If the route honored
    // seedPath it would read this file and fail with SEED_PARSE_FAILED.
    const bogusPath = join(dataDir, 'bogus-seed.js');
    writeFileSync(bogusPath, 'not a seed');

    const res = await post(base, token, '/api/rag/seed', { seedPath: bogusPath });
    const body = await res.json();
    if (res.ok) {
      // Default seed path happened to exist on this machine — fine, but the
      // import must be of the default set, not our bogus file.
      assert.equal(typeof body.total, 'number');
    } else {
      // Default seed path absent: the only acceptable failure is the default
      // file being missing. SEED_PARSE_FAILED would mean bogusPath was read.
      assert.equal(body.error, 'SEED_FILE_MISSING');
    }
    assert.notEqual(body.error, 'SEED_PARSE_FAILED', 'route must not read the caller-supplied path');
  } finally { srv.close(); }
});

test('POST /api/rag/fetch rejects invalid maxPerFeed with 400', async () => {
  const { srv, base, token } = await startServer();
  try {
    for (const bad of ['abc', 0, 101, -3, 2.5]) {
      const res = await post(base, token, '/api/rag/fetch', { feedIds: [], maxPerFeed: bad });
      assert.equal(res.status, 400, `maxPerFeed=${JSON.stringify(bad)} must be rejected`);
      const body = await res.json();
      assert.equal(body.error, 'maxPerFeed must be an integer 1-100');
    }
  } finally { srv.close(); }
});

test('POST /api/rag/context validates topic and keywords with 400', async () => {
  const { srv, base, token } = await startServer();
  try {
    const badBodies = [
      {},                                        // no topic, no keywords
      { topic: '', keywords: ['phishing'] },     // empty topic
      { topic: '   ', keywords: ['phishing'] },  // whitespace topic
      { topic: 42, keywords: ['phishing'] },     // non-string topic
      { topic: 'phishing' },                     // missing keywords
      { topic: 'phishing', keywords: [] },       // empty keywords
      { topic: 'phishing', keywords: 'phishing' }, // not an array
      { topic: 'phishing', keywords: ['ok', 7] }   // non-string entry
    ];
    for (const body of badBodies) {
      const res = await post(base, token, '/api/rag/context', body);
      assert.equal(res.status, 400, `body ${JSON.stringify(body)} must be rejected`);
      const out = await res.json();
      assert.equal(typeof out.error, 'string');
    }
  } finally { srv.close(); }
});

test('POST /api/rag/context returns contextFile:null on an empty index (egress untouched)', async () => {
  const { srv, base, token } = await startServer();
  try {
    const res = await post(base, token, '/api/rag/context', { topic: 'phishing', keywords: ['phishing', 'credentials'] });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { contextFile: null, articles: 0, reason: 'no matching articles in index' });
  } finally { srv.close(); }
});
