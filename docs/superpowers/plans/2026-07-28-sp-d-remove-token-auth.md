# SP-D — Remove Tokenized-URL Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `?token=` / session-cookie gate so the loopback-bound server needs no token, while keeping per-browser key isolation.

**Architecture:** Delete the `sessionAuth`/cookie/token middleware from the server and the browser's token capture; the `127.0.0.1` bind is the only access boundary. The Part A per-request `x-provider-key` (AsyncLocalStorage) key model is unchanged and remains the isolation mechanism.

**Tech Stack:** Node.js ESM, Express, `node --test`, vanilla browser JS.

## Global Constraints

- ESM only (`import`/`export`).
- Keep the server bound to `127.0.0.1` (loopback only).
- The provider key stays request-scoped (`x-provider-key` → AsyncLocalStorage); NO server-side per-user key state is introduced.
- Removing `sessionAuth` makes the `x-session-token` header a harmless no-op — existing route-test harnesses must keep passing unchanged.
- Test command: `npm test` (`node --test "tests/unit/**/*.test.js"`). Suite is green today (828). It must stay green after each task.

---

### Task 1: Remove the server-side token gate

**Files:**
- Modify: `backend/server.js` (imports line 19; token/middleware lines 36-38; return line 115; banner lines 120-123)
- Delete: `backend/auth.js`
- Test: `tests/unit/server-auth.test.js` (rewrite)

**Interfaces:**
- Produces: `createServer(ctx, opts)` returns `{ app, ctx }` (no `token`). `/api` is reachable with no token/cookie. The `x-provider-key` request-scope behavior (Part A) is unchanged.

- [ ] **Step 1: Rewrite `tests/unit/server-auth.test.js` (write the failing tests)**

Replace the whole file with:

```js
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
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/unit/server-auth.test.js`
Expected: FAIL — `GET /api/config` currently returns 401 without a token; the isolation test may 401 too.

- [ ] **Step 3: Remove the gate in `backend/server.js`**

- Delete the import: `import { loadOrCreateToken, sessionAuth, tokenCookieSetter } from './auth.js';`
- Delete these three lines (around 36-38):
  ```js
  const token = loadOrCreateToken(dataDir);
  app.use(tokenCookieSetter(token));
  app.use('/api', sessionAuth(token));
  ```
- Change the return from `return { app, ctx, token };` to `return { app, ctx };`.
- Change the startup block (around 120-123) so it does not reference `token`:
  ```js
  const { app } = createServer();
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Poster app: http://127.0.0.1:${PORT}/`);
  });
  ```
  (Keep whatever surrounding `createServer()` call form exists — only drop `token` from the destructure and the URL.)

- [ ] **Step 4: Delete `backend/auth.js`**

```bash
git rm backend/auth.js
```

Confirm nothing else imports it:
Run: `grep -rn "from './auth.js'\|from '../auth.js'\|backend/auth" backend/ tests/`
Expected: no matches (only `ui/js/auth.js`, a different file, may appear — that is the browser file, unrelated).

- [ ] **Step 5: Run tests**

Run: `node --test tests/unit/server-auth.test.js` then `npm test`
Expected: PASS — server-auth green; full suite green (0 failures). Route-test harnesses still send an `x-session-token` header that is now ignored.

- [ ] **Step 6: Commit**

```bash
git add backend/server.js tests/unit/server-auth.test.js
git rm backend/auth.js
git commit -m "feat: remove token/cookie auth gate; loopback bind is the only boundary"
```

---

### Task 2: Remove token capture from the browser

**Files:**
- Modify: `ui/js/auth.js`
- Test: none automated — verification = full `npm test` green + manual smoke.

**Interfaces:**
- Consumes: nothing new.
- Produces: `authOptions(options)` attaches ONLY `x-provider-key` (from sessionStorage) — no `x-session-token`. `window.getProviderKey`/`setProviderKey` unchanged. `window.SESSION_TOKEN` removed.

- [ ] **Step 1: Rewrite `ui/js/auth.js`**

Replace the whole file with:

```js
// Per-request provider key (Part A) — the server is loopback-only with no token
// gate, so pages carry no session token. The AI provider key lives in
// sessionStorage (tab-scoped, never localStorage) and rides on every request as
// x-provider-key; it is used server-side request-scoped and never persisted.
(function () {
  // AI provider key: session-only (tab-scoped), NEVER localStorage.
  window.getProviderKey = function () {
    try { return sessionStorage.getItem('poster_provider_key') || ''; } catch { return ''; }
  };
  window.setProviderKey = function (v) {
    try {
      if (v) sessionStorage.setItem('poster_provider_key', v);
      else sessionStorage.removeItem('poster_provider_key');
    } catch { /* private mode */ }
  };

  // Merge headers into a fetch options object: attach the provider key when set.
  window.authOptions = function (options) {
    var opts = Object.assign({}, options || {});
    var headers = Object.assign({}, opts.headers || {});
    var pk = window.getProviderKey();
    if (pk) headers['x-provider-key'] = pk;
    opts.headers = headers;
    return opts;
  };
})();
```

- [ ] **Step 2: Run the suite (no browser unit coverage)**

Run: `npm test`
Expected: PASS — full suite green (server-side only; browser file has no unit tests).

- [ ] **Step 3: Manual smoke**

Start `node backend/server.js`. Confirm the banner prints a plain URL (no `?token=`). Open `http://127.0.0.1:4180/` directly (no token) → pages load, Config/Library work. Set a provider key → DevTools Network shows `x-provider-key` on requests and NO `x-session-token`. sessionStorage has `poster_provider_key`; no `poster_token`.

- [ ] **Step 4: Commit**

```bash
git add ui/js/auth.js
git commit -m "feat: drop browser token capture; carry only x-provider-key"
```

---

## Self-Review

**Spec coverage:**
- §1 server gate removal + plain URL + `{app,ctx}` → Task 1 ✓
- §2 delete `backend/auth.js` → Task 1 ✓
- §3 browser token removal, keep provider key → Task 2 ✓
- §4 key-isolation invariant tested → Task 1 Step 1 (concurrent isolation test) ✓
- §5 error handling (no auth 401) → Task 1 (200-without-token test) ✓
- §6 testing (rewrite server-auth; other harnesses unchanged; suite green) → Tasks 1-2 ✓

**Placeholder scan:** none — full code in every step. The `grep` in Task 1 Step 4 is a concrete verification command.

**Type consistency:** `createServer` returns `{ app, ctx }` in Task 1 and the rewritten `server-auth.test.js` startServer destructures `{ app }` accordingly. `authOptions`/`getProviderKey`/`setProviderKey` signatures identical to Part A. `currentKey` imported from `masking/request-key.js` (exists).

**Note:** Task 1 rewrites `server-auth.test.js`'s `startServer` to accept `{ egress }` (mirroring `config-routes.test.js`) so the isolation test can inject a key-echoing stub egress via `createAppContext({ egress })` (supported since Part A).
