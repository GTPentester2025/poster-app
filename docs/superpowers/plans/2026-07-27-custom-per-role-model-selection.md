# Custom Per-Role Model Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the custom (OpenAI-compatible) provider pick a distinct model per role (content/vision/image), with loaded models auto-sorted into image vs text groups, plus a Test-connection probe that surfaces the real endpoint error.

**Architecture:** A new pure `classifyModel` helper buckets model ids. The vault stores `customModels: {content,vision,image}` (migrating the legacy single `customModel`), and `getModels()` resolves per role with vision/image falling back to content. A new egress `testContentModel()` runs one minimal chat call; a new `POST /api/config/test` route surfaces it. The config UI replaces the `<datalist>` with three role `<select>`s populated from the categorized live-model list, following the newsletter app's reliable select-sync pattern.

**Tech Stack:** Node.js (ESM), better-sqlite3, Express, OpenAI SDK v5, `node --test` (built-in test runner), vanilla browser JS.

## Global Constraints

- Module system: ESM (`"type": "module"`). Use `import`/`export`, no `require` in app code.
- Only the egress (`masking/egress.js`) makes provider network calls — routes surface egress results, never call providers directly.
- Secrets/keys are never returned to the client, never logged, never echoed in error text.
- Provider must be one of `PROVIDERS = ['openai','custom']`; custom model ids bypass the allow-list (endpoint decides validity).
- Test command: `npm test` (runs `node --test "tests/unit/**/*.test.js"`). Full suite is green today (805 tests) and must stay green.
- Windows shell is PowerShell; run single test files with `node --test path/to/file.test.js`.

---

### Task 1: `classifyModel` capability helper

**Files:**
- Create: `masking/model-capability.js`
- Test: `tests/unit/model-capability.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function classifyModel(id: string): 'image' | 'text'` — pure, case-insensitive; image when the id matches a known image-generation pattern, else `text`. Also `export const IMAGE_MODEL_PATTERNS: RegExp[]` (exported for the test and potential reuse).

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/model-capability.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyModel } from '../../masking/model-capability.js';

test('classifyModel tags known image-generation ids as image', () => {
  for (const id of ['dall-e-3', 'dalle3', 'gpt-image-1', 'flux.1-schnell',
                    'stable-diffusion-xl', 'sdxl-turbo', 'imagen-3', 'org/some-image']) {
    assert.equal(classifyModel(id), 'image', id);
  }
});

test('classifyModel defaults everything else to text', () => {
  for (const id of ['gpt-4o', 'llama3.1', 'mixtral-8x7b', 'qwen2.5:14b', 'claude-3-5-sonnet']) {
    assert.equal(classifyModel(id), 'text', id);
  }
});

test('classifyModel is case-insensitive and safe on blank/garbage input', () => {
  assert.equal(classifyModel('Stable-Diffusion-3'), 'image');
  assert.equal(classifyModel(''), 'text');
  assert.equal(classifyModel(null), 'text');
  assert.equal(classifyModel(undefined), 'text');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/model-capability.test.js`
Expected: FAIL — cannot find module `masking/model-capability.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// masking/model-capability.js
// Pure classifier: bucket an OpenAI-compatible model id into 'image' (image
// generation) vs 'text' (chat/completions). Heuristic by id — most /models
// endpoints don't advertise modality — so unknown ids default to 'text', the
// safe bucket for the content/vision roles. No I/O, unit-tested in isolation.

export const IMAGE_MODEL_PATTERNS = [
  /dall-?e/i,          // dall-e-3, dalle3
  /gpt-image/i,        // gpt-image-1
  /\bflux\b/i,         // flux.1-schnell, flux
  /stable-?diffusion/i,// stable-diffusion-xl
  /\bsdxl\b/i,         // sdxl-turbo
  /\bimagen\b/i,       // imagen-3
  /(^|[/_-])image($|[/_.:-])/i // segment 'image': org/some-image, foo-image
];

/**
 * @param {string} id model id
 * @returns {'image'|'text'}
 */
export function classifyModel(id) {
  const s = String(id ?? '');
  return IMAGE_MODEL_PATTERNS.some((re) => re.test(s)) ? 'image' : 'text';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/model-capability.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add masking/model-capability.js tests/unit/model-capability.test.js
git commit -m "feat: add classifyModel image/text capability helper"
```

---

### Task 2: Vault per-role custom models + migration

**Files:**
- Modify: `masking/vault.js:36` (DEFAULT_PROVIDER_CONFIG), `:110-143` (getProviderConfig / setProviderConfig), `:153-166` (getModels custom branch)
- Test: `tests/unit/db-vault.test.js:128-157` (update existing custom-provider tests + add per-role tests)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `DEFAULT_PROVIDER_CONFIG = { provider:'openai', customBaseUrl:'', customModels:{ content:'', vision:'', image:'' } }`
  - `getProviderConfig()` returns `{ provider, customBaseUrl, customModels:{content,vision,image} }`. Legacy stored `customModel` string is migrated to `customModels.content` (and mirrored to vision/image) on read.
  - `setProviderConfig(partial)` accepts `partial.customModels` (object, per-role, trimmed) AND legacy `partial.customModel` (string alias → sets `customModels.content`). Returns the full new config shape.
  - `getModels()` under custom returns `{ content, vision, image }` from `customModels`, with `vision`/`image` falling back to `content` when empty.

- [ ] **Step 1: Update existing tests + add per-role tests (write the failing tests)**

Replace the body of the three custom-provider tests in `tests/unit/db-vault.test.js` (currently lines ~128-157) with:

```js
test('provider config defaults to openai and round-trips custom per-role selection', () => {
  const vault = freshVault();
  assert.deepEqual(vault.getProviderConfig(), DEFAULT_PROVIDER_CONFIG);
  const next = vault.setProviderConfig({
    provider: 'custom',
    customBaseUrl: '  http://localhost:11434/v1  ',
    customModels: { content: '  llama3.1  ', vision: ' llava ', image: ' sdxl ' }
  });
  assert.deepEqual(next, {
    provider: 'custom',
    customBaseUrl: 'http://localhost:11434/v1',
    customModels: { content: 'llama3.1', vision: 'llava', image: 'sdxl' }
  });
  assert.deepEqual(vault.getProviderConfig(), next);
  // partial update keeps untouched fields
  const back = vault.setProviderConfig({ provider: 'openai' });
  assert.equal(back.provider, 'openai');
  assert.equal(back.customBaseUrl, 'http://localhost:11434/v1');
  assert.equal(back.customModels.content, 'llama3.1');
});

test('legacy customModel input aliases to customModels.content and mirrors unset roles', () => {
  const vault = freshVault();
  vault.setProviderConfig({ provider: 'custom', customModel: 'my-org/mixtral-8x7b' });
  // vision/image unset -> fall back to content in getModels
  assert.deepEqual(vault.getModels(), {
    content: 'my-org/mixtral-8x7b', vision: 'my-org/mixtral-8x7b', image: 'my-org/mixtral-8x7b'
  });
});

test('getModels resolves per-role under custom, falling back to content for empty roles', () => {
  const vault = freshVault();
  vault.setProviderConfig({ provider: 'custom', customModels: { content: 'llama3.1', image: 'sdxl' } });
  assert.deepEqual(vault.getModels(), { content: 'llama3.1', vision: 'llama3.1', image: 'sdxl' });
  // switching back to openai restores allow-list + prior per-role storage
  vault.setModels({ content: 'gpt-4o-mini' });
  vault.setProviderConfig({ provider: 'openai' });
  assert.equal(vault.getModels().content, 'gpt-4o-mini');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/unit/db-vault.test.js`
Expected: FAIL — `getProviderConfig()` returns the old `{...customModel}` shape / `customModels` undefined.

- [ ] **Step 3: Implement the vault changes**

In `masking/vault.js`, change the constant (line ~36):

```js
export const DEFAULT_PROVIDER_CONFIG = {
  provider: 'openai',
  customBaseUrl: '',
  customModels: { content: '', vision: '', image: '' }
};
```

Replace `getProviderConfig()` (lines ~110-119) with:

```js
  /** Current provider config: { provider, customBaseUrl, customModels:{content,vision,image} }. */
  getProviderConfig() {
    const row = this._get.get('providerConfig');
    const stored = row ? JSON.parse(row.value) : {};
    const provider = PROVIDERS.includes(stored.provider) ? stored.provider : DEFAULT_PROVIDER_CONFIG.provider;
    const customBaseUrl = typeof stored.customBaseUrl === 'string' ? stored.customBaseUrl : '';
    // Migration: a legacy single `customModel` seeds all three roles so an
    // existing custom setup keeps working after the per-role split.
    const legacy = typeof stored.customModel === 'string' ? stored.customModel : '';
    const cm = (stored.customModels && typeof stored.customModels === 'object') ? stored.customModels : {};
    const pick = (role) => (typeof cm[role] === 'string' && cm[role]) ? cm[role] : legacy;
    return {
      provider,
      customBaseUrl,
      customModels: { content: pick('content'), vision: pick('vision'), image: pick('image') }
    };
  }
```

Replace `setProviderConfig()` (lines ~128-143) with:

```js
  setProviderConfig(partial) {
    const next = { ...this.getProviderConfig() };
    next.customModels = { ...next.customModels };
    if (partial && 'provider' in partial) {
      if (!PROVIDERS.includes(partial.provider)) {
        const err = new Error(`"${partial.provider}" is not a valid provider (choose one of: ${PROVIDERS.join(', ')})`);
        err.code = 'PROVIDER_INVALID';
        err.status = 400;
        throw err;
      }
      next.provider = partial.provider;
    }
    if (partial && typeof partial.customBaseUrl === 'string') next.customBaseUrl = partial.customBaseUrl.trim();
    // Legacy alias: a flat customModel string writes the content role.
    if (partial && typeof partial.customModel === 'string') next.customModels.content = partial.customModel.trim();
    if (partial && partial.customModels && typeof partial.customModels === 'object') {
      for (const role of MODEL_ROLES) {
        if (typeof partial.customModels[role] === 'string') next.customModels[role] = partial.customModels[role].trim();
      }
    }
    // Persist WITHOUT the legacy flat key so reads use the per-role shape.
    this._set.run('providerConfig', JSON.stringify({
      provider: next.provider, customBaseUrl: next.customBaseUrl, customModels: next.customModels
    }), new Date().toISOString());
    return next;
  }
```

Replace the custom branch of `getModels()` (lines ~154-158) with:

```js
    if (pc.provider === 'custom') {
      const cm = pc.customModels || {};
      const content = cm.content || '';
      return {
        content,
        vision: cm.vision || content,
        image: cm.image || content
      };
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/unit/db-vault.test.js`
Expected: PASS (all vault tests, including the three updated/added).

- [ ] **Step 5: Commit**

```bash
git add masking/vault.js tests/unit/db-vault.test.js
git commit -m "feat: vault stores per-role custom models with legacy migration"
```

---

### Task 3: Egress `testContentModel()` probe

**Files:**
- Modify: `masking/egress.js` (add method near `listModels`, after line ~150)
- Test: `tests/unit/egress.test.js` (add tests using the existing `setup()` harness)

**Interfaces:**
- Consumes: `this._openaiClient()`, `this._model('content')` (existing).
- Produces: `async testContentModel(): Promise<{ ok:true, model, sample } | { ok:false, code, status?, message }>` — never throws; catches config + call errors and returns a structured result. `message` is truncated and carries no key.

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/egress.test.js` (the `setup()` helper injects an OpenAI transport whose `chat.completions.create` echoes `responseText`):

```js
test('testContentModel returns ok with a sample on a working endpoint', async () => {
  const { egress, vault } = setup({ responseText: 'pong' });
  vault.setProviderConfig({ provider: 'custom', customBaseUrl: 'http://localhost:11434/v1', customModels: { content: 'llama3.1' } });
  vault.setSecrets({ customKey: 'or-' + 'a'.repeat(20) });
  const r = await egress.testContentModel();
  assert.equal(r.ok, true);
  assert.equal(r.model, 'llama3.1');
  assert.equal(r.sample, 'pong');
});

test('testContentModel returns a structured error (never throws) when the call fails', async () => {
  const db = new Database(':memory:'); migrate(db);
  const dir = mkdtempSync(join(tmpdir(), 'postter-egress-test-'));
  const vault = new Vault({ db, secretsPath: join(dir, 'secrets.json') });
  const bus = new EventBus({ logDir: dir, db });
  const openai = { chat: { completions: { create: async () => { const e = new Error('Unsupported parameter: max_tokens'); e.status = 400; throw e; } } } };
  const egress = new MaskingEgress({ vault, bus, db, transports: { openai } });
  vault.setProviderConfig({ provider: 'custom', customBaseUrl: 'http://localhost:11434/v1', customModels: { content: 'llama3.1' } });
  vault.setSecrets({ customKey: 'or-' + 'a'.repeat(20) });
  const r = await egress.testContentModel();
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.match(r.message, /max_tokens/);
});

test('testContentModel reports CUSTOM_MODEL_MISSING when content is unset', async () => {
  const { egress, vault } = setup();
  vault.setProviderConfig({ provider: 'custom', customBaseUrl: 'http://localhost:11434/v1' }); // no models
  vault.setSecrets({ customKey: 'or-' + 'a'.repeat(20) });
  const r = await egress.testContentModel();
  assert.equal(r.ok, false);
  assert.equal(r.code, 'CUSTOM_MODEL_MISSING');
});
```

Note: if `setup()` does not already return `vault`, update its `return` to include it (e.g. `return { egress, vault, captured, bus };`). Check the end of the `setup()` function and add `vault` to the returned object if missing.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/unit/egress.test.js`
Expected: FAIL — `egress.testContentModel is not a function`.

- [ ] **Step 3: Implement `testContentModel()`**

Add to `masking/egress.js` immediately after `listModels()` (after line ~150):

```js
  /**
   * One minimal chat.completions call with the selected CONTENT model, used by
   * the Config page's "Test connection" button. Never throws: config problems
   * and endpoint failures both come back as a structured result so the UI can
   * show the REAL reason (HTTP status + short body) before a full generate run.
   * SECURITY: returns only the error message text (already key-free from the
   * SDK) — never the key, never org values.
   */
  async testContentModel() {
    let client;
    let model;
    try {
      client = this._openaiClient();
      model = this._model('content');
    } catch (err) {
      return { ok: false, code: err.code || 'CONFIG', message: (err.message || 'not configured').slice(0, 200) };
    }
    try {
      const res = await client.chat.completions.create({
        model, max_tokens: 8, temperature: 0,
        messages: [{ role: 'user', content: 'ping' }]
      });
      return { ok: true, model, sample: (res?.choices?.[0]?.message?.content || '').slice(0, 120) };
    } catch (err) {
      return {
        ok: false,
        code: err.code || 'CALL_FAILED',
        status: err.status ?? null,
        message: (err.message || 'the endpoint call failed').slice(0, 200)
      };
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/unit/egress.test.js`
Expected: PASS (all egress tests, including the three new ones).

- [ ] **Step 5: Commit**

```bash
git add masking/egress.js tests/unit/egress.test.js
git commit -m "feat: egress testContentModel probe returns structured result"
```

---

### Task 4: Config routes — `customModels` on `/provider`, new `POST /test`

**Files:**
- Modify: `backend/routes/config.js:37-46` (`/provider`), add `POST /test` after `/models/live` (~line 62)
- Test: `tests/unit/config-routes.test.js:30,45` (update shape) + add a `/test` test

**Interfaces:**
- Consumes: `vault.setProviderConfig` (Task 2), `egress.testContentModel` (Task 3).
- Produces:
  - `PUT /api/config/provider` accepts `{ provider, customBaseUrl, customModels }` (and legacy `customModel`); returns `{ providerConfig }` in the new shape.
  - `POST /api/config/test` → `{ ok, model?, sample?, code?, status?, message? }` (200 always; the body's `ok` conveys success).

- [ ] **Step 1: Update + add failing tests**

In `tests/unit/config-routes.test.js`, update the two shape assertions:

- Line ~30: `assert.deepEqual(body.providerConfig, { provider: 'openai', customBaseUrl: '', customModels: { content: '', vision: '', image: '' } });`
- Replace the PUT round-trip test (lines ~36-51) body to send `customModels` and assert the new shape:

```js
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
```

Add a `/test` route test (inject a stub egress via `startServer({ egress })`):

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/unit/config-routes.test.js`
Expected: FAIL — old shape assertions + no `/test` route (404).

- [ ] **Step 3: Implement the route changes**

In `backend/routes/config.js`, change the `/provider` handler (lines ~37-46) to pass `customModels`:

```js
  router.put('/provider', (req, res, next) => {
    try {
      const { provider, customBaseUrl, customModel, customModels } = req.body || {};
      const providerConfig = vault.setProviderConfig({ provider, customBaseUrl, customModel, customModels });
      res.json({ providerConfig });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.code || 'PROVIDER_INVALID', message: err.message });
      next(err);
    }
  });
```

Add after the `/models/live` route (after line ~62):

```js
  // Probe the selected CONTENT model with one tiny chat call so the config page
  // can show the real endpoint error before a full run. Always 200; the body's
  // `ok` conveys success (mirrors egress.testContentModel's structured result).
  router.post('/test', async (_req, res, next) => {
    try {
      res.json(await egress.testContentModel());
    } catch (err) { next(err); }
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/unit/config-routes.test.js`
Expected: PASS (updated + new tests).

- [ ] **Step 5: Commit**

```bash
git add backend/routes/config.js tests/unit/config-routes.test.js
git commit -m "feat: config API accepts customModels and adds POST /test probe"
```

---

### Task 5: Config UI — three role selects, categorized load, test button

**Files:**
- Modify: `ui/config.html:79-94` (custom fields block)
- Modify: `ui/js/config_page.js` (load/persist/loadModels/test wiring)
- Test: none automated (browser DOM). Verification = full `npm test` green + manual steps below.

**Interfaces:**
- Consumes: `GET /api/config` (`providerConfig.customModels`), `GET /api/config/models/live` (`{models}`), `PUT /api/config/provider` (`{customModels}`), `POST /api/config/test`, and `classifyModel` (import).
- Produces: three role `<select>`s (`#customContent`, `#customVision`, `#customImage`) synced to state, a `#loadModels` button, a `#testConn` button.

- [ ] **Step 1: Replace the custom model markup in `ui/config.html`**

Replace the Model row (lines ~86-93, the `#customModel` input + datalist + Load button + status) with:

```html
      <div class="row">
        <button id="loadModels" type="button">Load models</button>
        <button id="testConn" type="button">Test connection</button>
        <label class="check"><input type="checkbox" id="showAllModels"> Show all models in every role</label>
      </div>
      <div class="grid2">
        <label>Content model (text) <select id="customContent"></select></label>
        <label>Vision model (zero-text gate) <select id="customVision"></select></label>
        <label>Image model (artwork) <select id="customImage"></select></label>
      </div>
      <span id="loadModelsStatus" class="status" role="status" aria-live="polite"></span>
```

- [ ] **Step 2: Wire the UI in `ui/js/config_page.js`**

At the top, add the import (the file is loaded as a module? confirm: `config.html` includes it via `<script src="js/config_page.js">` — add `type="module"` to that tag AND import). Change the include in `ui/config.html` (line ~126) to:

```html
<script type="module" src="js/config_page.js"></script>
```

Then in `ui/js/config_page.js`, add at the top:

```js
import { classifyModel } from './model-capability-browser.js';
```

Create `ui/js/model-capability-browser.js` re-exporting the classifier for the browser (the `masking/` module isn't served under `ui/`):

```js
// Browser copy of masking/model-capability.js classifier. Keep the patterns in
// sync with the server module (both are pure; no bundler in this app).
export const IMAGE_MODEL_PATTERNS = [
  /dall-?e/i, /gpt-image/i, /\bflux\b/i, /stable-?diffusion/i, /\bsdxl\b/i, /\bimagen\b/i,
  /(^|[/_-])image($|[/_.:-])/i
];
export function classifyModel(id) {
  const s = String(id ?? '');
  return IMAGE_MODEL_PATTERNS.some((re) => re.test(s)) ? 'image' : 'text';
}
```

Replace the model-loading block in `load()` (lines ~85-90 handle providerConfig) so the three selects are seeded from `providerConfig.customModels`:

```js
  if (providerConfig) {
    $('providerSelect').value = providerConfig.provider;
    $('customBaseUrl').value = providerConfig.customBaseUrl || '';
    window._customModels = providerConfig.customModels || { content: '', vision: '', image: '' };
    renderRoleSelects(window._lastLoadedModels || []);
    applyProviderUi(providerConfig.provider);
  }
```

Add these helpers (near `fillSelect`):

```js
const ROLE_SELECTS = { content: 'customContent', vision: 'customVision', image: 'customImage' };
const ROLE_GROUP = { content: 'text', vision: 'text', image: 'image' };

// Populate the three role selects from a model-id list. Each role is filtered
// to its capability group (unless "Show all" is ticked); the currently-stored
// value is preserved as a "(current)" option even if the endpoint didn't list it.
function renderRoleSelects(models) {
  const showAll = $('showAllModels').checked;
  const cm = window._customModels || { content: '', vision: '', image: '' };
  for (const role of Object.keys(ROLE_SELECTS)) {
    const sel = $(ROLE_SELECTS[role]);
    const current = cm[role] || '';
    let ids = showAll ? models.slice() : models.filter((m) => classifyModel(m) === ROLE_GROUP[role]);
    if (current && !ids.includes(current)) ids = [current, ...ids];
    if (!ids.length && current) ids = [current];
    sel.textContent = '';
    // allow an explicit empty choice (falls back to content at resolve time)
    const blank = document.createElement('option'); blank.value = ''; blank.textContent = '— none —'; sel.appendChild(blank);
    for (const id of ids) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = (id === current && !models.includes(current)) ? `${id} (current)` : id;
      if (id === current) o.selected = true;
      sel.appendChild(o);
    }
  }
}

// Persist provider + all three role models. Direct PUT (not touching the key).
async function persistCustomModels() {
  await putJson('/api/config/provider', {
    provider: 'custom',
    customBaseUrl: $('customBaseUrl').value.trim(),
    customModels: {
      content: $('customContent').value,
      vision: $('customVision').value,
      image: $('customImage').value
    }
  });
}
```

Update `persistProvider()` (lines ~183-198) so the custom branch sends `customModels` instead of the removed `customModel`:

```js
async function persistProvider() {
  const provider = $('providerSelect').value;
  const body = { provider };
  if (provider === 'custom') {
    body.customBaseUrl = $('customBaseUrl').value.trim();
    body.customModels = {
      content: $('customContent').value,
      vision: $('customVision').value,
      image: $('customImage').value
    };
  }
  await putJson('/api/config/provider', body);
  if (provider === 'custom') {
    if ($('customKeyless').checked) {
      await putJson('/api/config/secrets', { customKey: '' });
    } else if ($('customKey').value.trim()) {
      await putJson('/api/config/secrets', { customKey: $('customKey').value.trim() });
    }
  }
}
```

Replace the old `#customModel` change-listener and `#loadModels` handler (lines ~212-233) with:

```js
// Re-render groups when the filter toggle flips.
$('showAllModels').addEventListener('change', () => renderRoleSelects(window._lastLoadedModels || []));

// Auto-persist any role pick so a missed "Save provider" can't drop it.
for (const id of Object.values(ROLE_SELECTS)) {
  $(id).addEventListener('change', async () => {
    if ($('providerSelect').value !== 'custom') return;
    window._customModels = {
      content: $('customContent').value, vision: $('customVision').value, image: $('customImage').value
    };
    try { await persistCustomModels(); flash($('loadModelsStatus'), 'Model selection saved.'); }
    catch (err) { flash($('loadModelsStatus'), `Could not save: ${err.message}`, false); }
  });
}

$('loadModels').addEventListener('click', async () => {
  try {
    flash($('loadModelsStatus'), 'Saving provider & loading models…');
    await persistProvider();
    $('customKey').value = '';
    $('customKeyless').checked = false;
    const { models } = await api('/api/config/models/live');
    window._lastLoadedModels = models || [];
    renderRoleSelects(window._lastLoadedModels);
    const nImg = window._lastLoadedModels.filter((m) => classifyModel(m) === 'image').length;
    flash($('loadModelsStatus'), models.length
      ? `${models.length} model(s): ${nImg} image, ${models.length - nImg} text — assigned by role.`
      : 'Endpoint returned no models.', models.length > 0);
  } catch (err) {
    flash($('loadModelsStatus'), `Could not load models: ${err.message}`, false);
  }
});

$('testConn').addEventListener('click', async () => {
  try {
    flash($('loadModelsStatus'), 'Testing content model…');
    await persistCustomModels();
    const r = await api('/api/config/test', { method: 'POST' });
    if (r.ok) flash($('loadModelsStatus'), `Content model OK (${r.model}). Reply: "${r.sample}"`);
    else flash($('loadModelsStatus'), `Test failed${r.status ? ` (HTTP ${r.status})` : ''}: ${r.message}`, false);
  } catch (err) {
    flash($('loadModelsStatus'), `Test failed: ${err.message}`, false);
  }
});
```

- [ ] **Step 3: Run the full test suite (nothing UI-testable, confirm no regression)**

Run: `npm test`
Expected: PASS — all tests green (prior 805 + the new unit tests from Tasks 1-4).

- [ ] **Step 4: Manual verification**

Run: `npm start`, open the tokenized Config URL from the terminal.
1. Provider → Custom. Enter your hosted base URL + key. Click **Load models** → status shows `N model(s): X image, Y text`; each role select is filtered to its group.
2. Pick a text model for Content/Vision and an image model for Image. Selections auto-save ("Model selection saved.").
3. Click **Test connection** → shows `Content model OK (…)` or the real endpoint error (HTTP status + message).
4. Reload the page → the three selects repopulate from storage (persistence confirmed).
5. Tick **Show all models** → every role select lists all ids (override works).

- [ ] **Step 5: Commit**

```bash
git add ui/config.html ui/js/config_page.js ui/js/model-capability-browser.js
git commit -m "feat: config UI per-role custom model selects with image/text sort + test button"
```

---

## Self-Review

**Spec coverage:**
- §1 data model → Task 2 ✓
- §2 classifier → Task 1 (+ browser copy in Task 5) ✓
- §3 backend `customModels` + `/test` → Task 4 ✓; egress probe → Task 3 ✓
- §4 UI selects/load/test/persist → Task 5 ✓
- §5 error handling (real endpoint error surfaced) → Task 3 result shape + Task 5 test button ✓
- §6 testing → Tasks 1-4 unit/route tests; Task 5 suite-green + manual ✓

**Placeholder scan:** none — every code step has full content.

**Type consistency:** `customModels: {content,vision,image}` shape identical across vault (Task 2), routes (Task 4), egress `getModels` consumption (Task 3), UI (Task 5). `testContentModel()` result `{ok, model, sample, code, status, message}` identical in egress (Task 3), route (Task 4), UI (Task 5). `classifyModel` signature identical in server (Task 1) and browser copy (Task 5).

**Known deviation to watch during execution:** Task 5 duplicates the classifier into `ui/js/model-capability-browser.js` because this app serves `ui/` statically with no bundler and the `masking/` module isn't reachable from the browser. Keep the two pattern lists in sync (noted in the file comment).
