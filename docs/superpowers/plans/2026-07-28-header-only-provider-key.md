# Header-Only Provider Key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop persisting the AI provider API key on the server — the browser holds it in sessionStorage and sends it per request via `x-provider-key`; the server uses it request-scoped (AsyncLocalStorage) and never writes it to disk.

**Architecture:** One Express middleware puts the header key into an `AsyncLocalStorage`; because pipelines are awaited in-request, every deep `egress` call reads it via `currentKey()`. The browser attaches the header in the shared `window.authOptions()`. All server-side key storage (`data/secrets.json`, env fallback, vault secrets methods, `PUT /api/config/secrets`) is removed. Masking stays server-side, unchanged.

**Tech Stack:** Node.js ESM, better-sqlite3, Express, OpenAI SDK v5, `node --test`, vanilla browser JS, `node:async_hooks`.

## Global Constraints

- Module system: ESM (`import`/`export`, no `require` in app code).
- Only the egress (`masking/egress.js`) makes provider network calls.
- **Header-only, no fallback:** the key comes ONLY from the `x-provider-key` request header via `currentKey()`. No `data/secrets.json`, no env vars (`OPENAI_API_KEY`/`CUSTOM_API_KEY`), no vault secrets.
- The key is never logged, never echoed in error text, never written to disk.
- Custom provider with no key = keyless (no `Authorization` header, e.g. Ollama). OpenAI provider with no key = `NO_API_KEY` (400).
- Browser key lives in sessionStorage (`poster_provider_key`) only — never localStorage.
- Test command: `npm test` (`node --test "tests/unit/**/*.test.js"`). Suite is green today (820 tests); it must stay green. Run one file with `node --test tests/unit/<file>.test.js`.
- Windows shell is PowerShell.

---

### Task 1: Request-scoped key store (`masking/request-key.js`)

**Files:**
- Create: `masking/request-key.js`
- Test: `tests/unit/request-key.test.js`

**Interfaces:**
- Produces: `runWithKey(key: string, fn: () => T): T` — runs `fn` within an ALS store carrying `key`. `currentKey(): string` — the key of the enclosing `runWithKey`, or `''` when outside any scope.

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/request-key.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWithKey, currentKey } from '../../masking/request-key.js';

test('currentKey is empty outside any runWithKey scope', () => {
  assert.equal(currentKey(), '');
});

test('currentKey returns the key inside runWithKey', () => {
  const seen = runWithKey('sk-abc', () => currentKey());
  assert.equal(seen, 'sk-abc');
  assert.equal(currentKey(), '', 'scope does not leak after runWithKey returns');
});

test('currentKey propagates through awaited async work', async () => {
  const seen = await runWithKey('sk-async', async () => {
    await Promise.resolve();
    return currentKey();
  });
  assert.equal(seen, 'sk-async');
});

test('nested runWithKey scopes shadow correctly', () => {
  const [outer, inner, back] = runWithKey('outer', () => {
    const o = currentKey();
    const i = runWithKey('inner', () => currentKey());
    return [o, i, currentKey()];
  });
  assert.deepEqual([outer, inner, back], ['outer', 'inner', 'outer']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/request-key.test.js`
Expected: FAIL — cannot find module `masking/request-key.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// masking/request-key.js
// Request-scoped provider API key. The key arrives per request in the
// x-provider-key header (browser sessionStorage) and must NEVER be persisted.
// An AsyncLocalStorage carries it for the life of a request so the egress can
// read it without threading it through every route, run context, and agent.
// Pipelines are awaited within the request, so the async context propagates to
// every model call.

import { AsyncLocalStorage } from 'node:async_hooks';

const als = new AsyncLocalStorage();

/** Run fn with `key` as the current request key. */
export function runWithKey(key, fn) {
  return als.run({ key: typeof key === 'string' ? key : '' }, fn);
}

/** The enclosing request's key, or '' when none. */
export function currentKey() {
  const store = als.getStore();
  return (store && store.key) || '';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/request-key.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add masking/request-key.js tests/unit/request-key.test.js
git commit -m "feat: add request-scoped provider key store (AsyncLocalStorage)"
```

---

### Task 2: Egress reads the key from `currentKey()`

**Files:**
- Modify: `masking/egress.js` (`_openaiClient` ~line 67-96, `listModels` ~line 105-128; add import)
- Test: `tests/unit/egress.test.js` (migrate key provision from `vault.setSecrets` to `runWithKey`)

**Interfaces:**
- Consumes: `currentKey()` from `masking/request-key.js` (Task 1).
- Produces: no signature change to public egress methods. Behavior: the provider key is now sourced from `currentKey()` instead of `this.vault.getSecrets()`.

- [ ] **Step 1: Update the key-dependent tests to use `runWithKey` (write the failing tests)**

In `tests/unit/egress.test.js`, add the import at the top (near the other imports):

```js
import { runWithKey } from '../../masking/request-key.js';
```

Then change the three `listModels` tests and the openai-key test so the key comes from `runWithKey` instead of `vault.setSecrets`:

- In `listModels (custom): fetches <base>/models with Bearer key…` — remove the `vault.setSecrets({ customKey: 'or-' + 'k'.repeat(20) });` line and wrap the call:
  ```js
  const ids = await runWithKey('or-' + 'k'.repeat(20), () => egress.listModels());
  ```
  (the assertion `calls[0].opts.headers.Authorization === 'Bearer or-kkkkkkkkkkkkkkkkkkkk'` stays.)

- In `listModels (openai): …requires a key` — replace the `vault.setSecrets({ openaiKey: … })` flow:
  ```js
  await assert.rejects(() => runWithKey('', () => noKey.listModels()), (err) => err.code === 'NO_API_KEY');
  const ids = await runWithKey('sk-proj-' + 'a'.repeat(40), () => noKey.listModels());
  assert.deepEqual(ids, ['gpt-4o']);
  ```

- `listModels (custom keyless)` already sends no key — wrap its call in `runWithKey('', () => egress.listModels())` so it explicitly runs with no key.

- Any other test that calls `vault.setSecrets({ openaiKey })` / `vault.setSecrets({ customKey })` before an egress call whose client is NOT injected: delete the `setSecrets` line and wrap the egress call in `runWithKey('<the key>', () => …)`. Tests that inject `transports.openai` (the leak tests, `_openaiClient` build test, `testContentModel` tests) do NOT need a key — `_openaiClient` returns the injected client before reading `currentKey()` — so simply delete any `vault.setSecrets(...)` line in those.

- [ ] **Step 2: Run the egress suite to see the failures**

Run: `node --test tests/unit/egress.test.js`
Expected: FAIL — key-dependent tests fail because `_openaiClient`/`listModels` still read `vault.getSecrets()` (which now returns nothing useful for these tests since `setSecrets` was removed from them).

- [ ] **Step 3: Switch the egress key source**

In `masking/egress.js`, add the import near the top (with the other local imports):

```js
import { currentKey } from './request-key.js';
```

Replace the `_openaiClient()` provider branch (the block at ~line 69-91 that reads `getSecrets` and builds `sig`/`build`) with:

```js
    const pc = this._providerConfig();
    const key = currentKey();
    let sig;
    let build;
    if (pc.provider === 'custom') {
      if (!pc.customBaseUrl) {
        const err = new Error('Custom base URL not configured — set it on the Config page');
        err.code = 'CUSTOM_URL_MISSING';
        throw err;
      }
      sig = `custom|${pc.customBaseUrl}|${key}`;
      build = () => new OpenAI({ apiKey: key || 'not-needed', baseURL: normalizeChatCompletionsBase(pc.customBaseUrl) });
    } else {
      if (!key) {
        const err = new Error('OpenAI API key not configured — set it on the Config page (this session)');
        err.code = 'NO_API_KEY';
        throw err;
      }
      sig = `openai|${key}`;
      build = () => new OpenAI({ apiKey: key });
    }
```

(Delete the old `const { openaiKey, customKey } = this.vault.getSecrets();` line and the `pc` line if now duplicated — there must be exactly one `const pc = this._providerConfig();`.)

In `listModels()`, replace `const { openaiKey, customKey } = this.vault.getSecrets();` and the subsequent `key = customKey;` / `key = openaiKey;` assignments so the key comes from `currentKey()`:

```js
    const pc = this._providerConfig();
    const reqKey = currentKey();
    let base;
    let key;
    if (pc.provider === 'custom') {
      if (!pc.customBaseUrl) {
        const err = new Error('Custom base URL not configured — set it on the Config page');
        err.code = 'CUSTOM_URL_MISSING';
        err.status = 400;
        throw err;
      }
      base = normalizeChatCompletionsBase(pc.customBaseUrl);
      key = reqKey;
    } else {
      base = OPENAI_DEFAULT_BASE;
      key = reqKey;
      if (!key) {
        const err = new Error('OpenAI API key not configured — set it on the Config page (this session)');
        err.code = 'NO_API_KEY';
        err.status = 400;
        throw err;
      }
    }
```

(The rest of `listModels` — `resolveModelsUrl`, the `Authorization` header only when `key` is truthy, the fetch — is unchanged.)

- [ ] **Step 4: Run the egress suite to verify it passes**

Run: `node --test tests/unit/egress.test.js`
Expected: PASS — all egress tests green.

- [ ] **Step 5: Commit**

```bash
git add masking/egress.js tests/unit/egress.test.js
git commit -m "feat: egress sources the provider key from the request scope"
```

---

### Task 3: Remove server-side key storage from the vault

**Files:**
- Modify: `masking/vault.js` (delete `_readSecrets`, `setSecrets`, `getSecrets`, `secretStatus`, `secretsPath` field, `defaultSecretsPath`)
- Modify: `backend/app-context.js` (drop `defaultSecretsPath` import + `secretsPath` arg)
- Test: `tests/unit/db-vault.test.js` (remove secrets tests; keep `validateApiKey`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `Vault` constructor is now `constructor({ db })`. No secrets API remains. `validateApiKey` export is unchanged.

- [ ] **Step 1: Remove the secrets tests (write the failing state)**

In `tests/unit/db-vault.test.js`:
- Delete every test that calls `vault.setSecrets(...)` or `vault.secretStatus()` (the "secrets" round-trip / status tests).
- KEEP the `validateApiKey(...)` tests — that function stays.
- Remove any now-unused imports (e.g. if `secretStatus` was imported; `validateApiKey` stays imported).
- The `freshVault()` helper constructs `new Vault({ db, secretsPath: join(dir, 'secrets.json') })` — leave it; the extra `secretsPath` key is harmlessly ignored once the constructor only reads `db`. (Optional: drop it for cleanliness.)

- [ ] **Step 2: Run vault + app tests to confirm the break**

Run: `node --test tests/unit/db-vault.test.js`
Expected: PASS for validateApiKey tests; the removed tests no longer run. Then run `npm test` — expect failures only where `setSecrets`/`getSecrets`/`defaultSecretsPath` are still referenced (app-context import). That confirms what Step 3 must remove.

- [ ] **Step 3: Delete the secrets code**

In `masking/vault.js`:
- In the `Vault` constructor, change `constructor({ db, secretsPath })` to `constructor({ db })` and delete the `this.secretsPath = secretsPath;` line.
- Delete the methods `_readSecrets()`, `setSecrets(...)`, `getSecrets()`, and `secretStatus()` entirely (the whole `// ---- secrets (API keys) ----` block).
- Delete the `export function defaultSecretsPath(dataDir) { ... }` at the bottom.
- Keep `validateApiKey` and everything else.
- Remove now-unused imports from `node:fs` that were only for secrets (`readFileSync`, `writeFileSync`, `renameSync`) IF nothing else in the file uses them — check first; `existsSync`/`mkdirSync` may still be used elsewhere. Only remove imports that are genuinely unused (lint/clean).

In `backend/app-context.js`:
- Change the import to `import { Vault } from '../masking/vault.js';` (drop `defaultSecretsPath`).
- Change `const vault = new Vault({ db, secretsPath: defaultSecretsPath(dataDir) });` to `const vault = new Vault({ db });`.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS except for `tests/unit/config-routes.test.js` (its `/secrets` and `secrets.*Configured` assertions still reference the removed surface — those are fixed in Task 4). Note that expected failure set; every other test passes.

- [ ] **Step 5: Commit**

```bash
git add masking/vault.js backend/app-context.js tests/unit/db-vault.test.js
git commit -m "refactor: remove server-side secret storage from the vault"
```

---

### Task 4: Request-key middleware + config route cleanup

**Files:**
- Modify: `backend/server.js` (add middleware after `express.json`)
- Modify: `backend/routes/config.js` (drop `secrets` from `GET /`, delete `PUT /secrets`)
- Test: `tests/unit/config-routes.test.js` (remove secrets assertions/tests; add a header→currentKey test)

**Interfaces:**
- Consumes: `runWithKey` from `masking/request-key.js` (Task 1); `egress.testContentModel()` (existing).
- Produces: every request runs inside `runWithKey(req.get('x-provider-key') || '', …)`. `GET /api/config` no longer returns a `secrets` field. `POST /api/config/test` now works with a header-supplied key.

- [ ] **Step 1: Update config-routes tests (write the failing tests)**

In `tests/unit/config-routes.test.js`:
- Delete the test(s) exercising `PUT /api/config/secrets`.
- In `GET /api/config exposes …`: remove the `assert.equal(body.secrets.customConfigured, false);` line (and any other `body.secrets.*` assertion). Do not assert on `body.secrets` at all.
- Add a test proving the header key reaches the egress via the middleware. Use a stub egress whose `testContentModel` echoes the request key. Since the stub can't call `currentKey()` unless imported, import it:
  ```js
  import { currentKey } from '../../masking/request-key.js';
  ...
  test('x-provider-key header is visible to the egress via request scope', async () => {
    const egress = { testContentModel: async () => ({ ok: true, model: 'm', sample: currentKey() }) };
    const { srv, base, token } = await startServer({ egress });
    try {
      const res = await fetch(`${base}/api/config/test`, {
        method: 'POST', headers: { ...H(token), 'x-provider-key': 'sk-req-123' }
      });
      const body = await res.json();
      assert.equal(body.ok, true);
      assert.equal(body.sample, 'sk-req-123', 'middleware put the header key into the request scope');
    } finally { srv.close(); }
  });
  ```

- [ ] **Step 2: Run config-routes tests to confirm failure**

Run: `node --test tests/unit/config-routes.test.js`
Expected: FAIL — the new header test fails (no middleware yet; `currentKey()` is `''`), and the removed-secrets edits are in place.

- [ ] **Step 3: Add the middleware and clean the config route**

In `backend/server.js`:
- Add import near the top: `import { runWithKey } from '../masking/request-key.js';`
- Immediately after `app.use(express.json({ limit: '25mb' }));`, add:
  ```js
  // The AI provider key travels per request in x-provider-key (browser
  // sessionStorage) and is used request-scoped only — never persisted.
  app.use((req, _res, next) => runWithKey(req.get('x-provider-key') || '', next));
  ```

In `backend/routes/config.js`:
- In the `GET /` handler, delete the `secrets: vault.secretStatus(),` line from the response object.
- Delete the entire `router.put('/secrets', …)` handler.

- [ ] **Step 4: Run tests**

Run: `node --test tests/unit/config-routes.test.js` then `npm test`
Expected: PASS — config-routes green (incl. the new header test); full suite green.

- [ ] **Step 5: Commit**

```bash
git add backend/server.js backend/routes/config.js tests/unit/config-routes.test.js
git commit -m "feat: request-key middleware; drop server secret endpoints"
```

---

### Task 5: Browser — session-only key entry + header injection

**Files:**
- Modify: `ui/js/auth.js` (provider-key getter/setter + attach header)
- Modify: `ui/config.html` (single session-only key field; remove OpenAI-key card, custom-key input, keyless checkbox)
- Modify: `ui/js/config_page.js` (session-only key UX; chip; drop secret persistence)
- Test: none automated (browser) — verification = full `npm test` green + manual smoke.

**Interfaces:**
- Consumes: `POST /api/config/test`, `GET /api/config` (no longer returns `secrets`).
- Produces: `window.getProviderKey()`, `window.setProviderKey(v)`; every request carries `x-provider-key` when a session key is set.

- [ ] **Step 1: Add provider-key handling + header injection to `ui/js/auth.js`**

Inside the IIFE, before `window.authOptions`, add:

```js
  // AI provider key: session-only (tab-scoped), NEVER localStorage, NEVER sent
  // to the server for storage — only attached per request as x-provider-key.
  window.getProviderKey = function () {
    try { return sessionStorage.getItem('poster_provider_key') || ''; } catch { return ''; }
  };
  window.setProviderKey = function (v) {
    try {
      if (v) sessionStorage.setItem('poster_provider_key', v);
      else sessionStorage.removeItem('poster_provider_key');
    } catch { /* private mode */ }
  };
```

In `window.authOptions`, after the session-token header is merged, attach the provider key when present:

```js
  window.authOptions = function (options) {
    var opts = Object.assign({}, options || {});
    var headers = Object.assign({}, opts.headers || {});
    if (token) headers['x-session-token'] = token;
    var pk = window.getProviderKey();
    if (pk) headers['x-provider-key'] = pk;
    opts.headers = headers;
    return opts;
  };
```

- [ ] **Step 2: Replace the key UI in `ui/config.html`**

- Delete the entire `<section class="card" id="openaiKeyCard"> … </section>` (the OpenAI API key card, ~lines 102-109).
- In the AI-provider card, delete the custom-key `<label>` (the `#customKey` input + `#customChip`) and the `#customKeyless` checkbox `<label>`.
- Add ONE session-only key card (place it right after the AI-provider card):

```html
  <section class="card">
    <h2>AI provider API key (this session only)</h2>
    <p class="hint">Held in this browser tab only and sent with each request — <strong>never stored on the server</strong>.
    Re-enter it after reopening the app. Leave blank for a keyless endpoint (e.g. local Ollama).</p>
    <div class="grid2">
      <label>API key <span class="chip" id="providerKeyChip">not set</span>
        <input id="providerKey" type="password" autocomplete="off" placeholder="paste key (kept in this tab only)"></label>
    </div>
    <div class="row">
      <button id="setProviderKey" class="primary">Set key (this session)</button>
      <button id="clearProviderKey">Clear</button>
    </div>
    <span id="providerKeyStatus" class="status" role="status" aria-live="polite"></span>
  </section>
```

- [ ] **Step 3: Rewire `ui/js/config_page.js`**

- In `applyProviderUi`, delete references to `openaiKeyCard` (the card no longer exists). Keep `modelsCard`/`customFields` toggling. The new key card is always visible (applies to both providers), so it needs no toggle.
- In `load()`, remove the lines that read `secrets.customConfigured` / `secrets.openaiConfigured` and set `#customChip`/`#openaiChip` (those elements are gone). Instead, after load, set the new chip:
  ```js
  updateProviderKeyChip();
  ```
- Remove the `$('saveKeys')` click handler entirely (the button is gone).
- In `persistProvider()`, delete the custom-key / keyless block (the `if ($('customKeyless').checked) … else if ($('customKey').value.trim()) …`). `persistProvider` now only PUTs `{ provider, customBaseUrl, customModels }`.
- Add the session-key handlers and chip helper:

```js
function updateProviderKeyChip() {
  const set = !!window.getProviderKey();
  const chip = $('providerKeyChip');
  chip.textContent = set ? 'set for this session ✓' : 'not set';
  chip.classList.toggle('on', set);
}

$('setProviderKey').addEventListener('click', () => {
  const v = $('providerKey').value.trim();
  window.setProviderKey(v);
  $('providerKey').value = '';
  updateProviderKeyChip();
  flash($('providerKeyStatus'), v ? 'Key set for this session.' : 'Key cleared.');
});

$('clearProviderKey').addEventListener('click', () => {
  window.setProviderKey('');
  $('providerKey').value = '';
  updateProviderKeyChip();
  flash($('providerKeyStatus'), 'Key cleared.');
});
```

- Grep the file for any remaining references to `customKey`, `customKeyless`, `openaiKey`, `openaiChip`, `customChip`, `saveKeys`, `keysStatus`, `openaiKeyCard` and remove them (they no longer exist in the DOM).

- [ ] **Step 4: Run the suite + manual smoke**

Run: `npm test`
Expected: PASS — full suite green (UI-only edits; no unit coverage changed).

Manual smoke (`npm start`, open the tokenized Config URL):
1. Config → set a key → chip reads "set for this session ✓". Reload the tab → chip resets to "not set" (session-only, and the field starts blank).
2. DevTools → Application → Session Storage: `poster_provider_key` present after Set, absent after Clear/reload; Local Storage has no key.
3. DevTools → Network: trigger **Test connection** (or a generate) → the request carries an `x-provider-key` header; response reflects the key working (or the real endpoint error).
4. Confirm no request ever calls `PUT /api/config/secrets` (endpoint removed).

- [ ] **Step 5: Commit**

```bash
git add ui/js/auth.js ui/config.html ui/js/config_page.js
git commit -m "feat: session-only provider key in the browser; attach x-provider-key per request"
```

---

## Self-Review

**Spec coverage:**
- §1 request-key ALS → Task 1 ✓
- §2 middleware → Task 4 ✓
- §3 egress uses currentKey → Task 2 ✓
- §4 remove vault secrets + config `/secrets` + GET `secrets` → Task 3 (vault/app-context) + Task 4 (routes) ✓
- §5 browser sessionStorage + authOptions header + config UI → Task 5 ✓
- §6 error handling (NO_API_KEY message, keyless custom) → Task 2 ✓
- §7 testing (request-key, egress, config-routes, db-vault, middleware, manual) → Tasks 1-5 ✓

**Placeholder scan:** none — every code step carries full content. The Task 2 test-migration rule names the exact tests plus a "delete `setSecrets`, wrap in `runWithKey`" procedure and a run-to-green verification; injected-transport tests explicitly need no key.

**Type consistency:** `runWithKey(key, fn)` / `currentKey()` identical across Task 1 (def), Task 2 (egress), Task 4 (middleware + test). `window.getProviderKey()`/`setProviderKey()` identical across Task 5 (auth.js def, config_page.js use). sessionStorage key `poster_provider_key` identical in auth.js and (implicitly) config_page via the window helpers. Error code `NO_API_KEY` matches the existing egress contract consumed by the config `/test` route and UI.

**Cross-task ordering note:** After Task 3, `tests/unit/config-routes.test.js` is expected RED (references removed secrets surface) until Task 4 fixes it — called out in Task 3 Step 4 and resolved in Task 4. The branch is green again at the end of Task 4.
