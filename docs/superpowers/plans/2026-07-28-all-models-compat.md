# All-Models Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make chat completions work across all models a Foundry-style OpenAI-compatible endpoint serves (Claude + OpenAI, including reasoning/o-series), not just gpt-4, by adapting the token/temperature params per model with a self-healing retry.

**Architecture:** A pure `masking/chat-params.js` classifies a model id (reasoning vs standard) and builds the right token params. `egress._createChat()` calls the SDK with the model's cached-or-default param shape and, on a 400 that names a token/temperature param, retries once with the alternate shape and caches the winner per model id. All three egress chat sites route through it. Genuine 401s are not retried and surface an entitlement hint.

**Tech Stack:** Node.js ESM, OpenAI SDK v5, `node --test`.

## Global Constraints

- Module system: ESM (`import`/`export`, no `require`).
- Only the egress makes provider calls; this change adds no new call site outside `masking/egress.js`.
- The provider key is never logged or placed in any error/message (unchanged from Part A).
- Reasoning shape = `{ max_completion_tokens: maxTokens }` (NO temperature). Standard shape = `{ max_tokens: maxTokens, ...(temperature != null ? { temperature } : {}) }`.
- Self-healing retry fires ONLY for `isParamError` (a 400/`status==null` naming a token/temperature param); 401/403/5xx/network propagate unchanged.
- Image generation and masking/key handling are untouched.
- Test command: `npm test` (`node --test "tests/unit/**/*.test.js"`). Suite is green today (818 tests) and must stay green. One file: `node --test tests/unit/<file>.test.js`.

---

### Task 1: Pure param helper (`masking/chat-params.js`)

**Files:**
- Create: `masking/chat-params.js`
- Test: `tests/unit/chat-params.test.js`

**Interfaces:**
- Produces:
  - `isReasoningModel(id: string): boolean`
  - `defaultShape(id: string): 'reasoning' | 'standard'`
  - `altShape(shape: string): 'reasoning' | 'standard'`
  - `tokenParams(shape: string, maxTokens: number, temperature?: number): object`
  - `isParamError(err: any): boolean`

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/chat-params.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isReasoningModel, defaultShape, altShape, tokenParams, isParamError }
  from '../../masking/chat-params.js';

test('isReasoningModel flags o-series / gpt-5 / reasoning ids', () => {
  for (const id of ['o1', 'o1-mini', 'o3-mini', 'foundry/o4-preview', 'gpt-5', 'gpt-5-pro', 'my-reasoning-model']) {
    assert.equal(isReasoningModel(id), true, id);
  }
});

test('isReasoningModel treats standard chat ids as non-reasoning', () => {
  for (const id of ['gpt-4o', 'gpt-4.1', 'claude-3-5-sonnet', 'claude-3-7', 'llama3.1', 'mistral-large', 'gpt-4o-mini']) {
    assert.equal(isReasoningModel(id), false, id);
  }
});

test('tokenParams: reasoning omits temperature; standard includes it only when provided', () => {
  assert.deepEqual(tokenParams('reasoning', 8, 0), { max_completion_tokens: 8 });
  assert.deepEqual(tokenParams('reasoning', 100), { max_completion_tokens: 100 });
  assert.deepEqual(tokenParams('standard', 8, 0), { max_tokens: 8, temperature: 0 });
  assert.deepEqual(tokenParams('standard', 100), { max_tokens: 100 });
});

test('defaultShape / altShape', () => {
  assert.equal(defaultShape('o1-mini'), 'reasoning');
  assert.equal(defaultShape('gpt-4o'), 'standard');
  assert.equal(altShape('reasoning'), 'standard');
  assert.equal(altShape('standard'), 'reasoning');
});

test('isParamError: 400 naming a token/temperature param is self-healable; 401/500 are not', () => {
  assert.equal(isParamError({ status: 400, message: 'Unsupported parameter: max_tokens' }), true);
  assert.equal(isParamError({ status: 400, message: "Unsupported value: 'temperature'" }), true);
  assert.equal(isParamError({ message: 'use max_completion_tokens instead' }), true); // status absent
  assert.equal(isParamError({ status: 401, message: 'Unauthorized' }), false);
  assert.equal(isParamError({ status: 500, message: 'max_tokens boom' }), false);
  assert.equal(isParamError({ status: 400, message: 'some other validation error' }), false);
  assert.equal(isParamError(null), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/chat-params.test.js`
Expected: FAIL — cannot find module `masking/chat-params.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// masking/chat-params.js
// Adapt OpenAI-compatible chat params per model family. A Foundry-style wrapper
// fronts Claude + OpenAI, and OpenAI reasoning/o-series models reject max_tokens
// (they need max_completion_tokens) and reject a non-default temperature. Model
// ids come from the endpoint's /models list (arbitrary shapes), so family
// detection is a substring heuristic; a self-healing retry in the egress
// corrects any misclassification at runtime. Pure, no I/O.

/** Reasoning / o-series markers in a model id. */
export function isReasoningModel(id) {
  const s = String(id ?? '');
  return /(^|[/_.-])o[1-9]([-_.]|$)/i.test(s) || /gpt-5/i.test(s) || /reasoning/i.test(s);
}

export function defaultShape(id) {
  return isReasoningModel(id) ? 'reasoning' : 'standard';
}

export function altShape(shape) {
  return shape === 'reasoning' ? 'standard' : 'reasoning';
}

/**
 * Token/temperature params for a shape. Reasoning models take
 * max_completion_tokens and no temperature; standard models take max_tokens and
 * temperature only when a value was supplied.
 */
export function tokenParams(shape, maxTokens, temperature) {
  if (shape === 'reasoning') return { max_completion_tokens: maxTokens };
  return { max_tokens: maxTokens, ...(temperature != null ? { temperature } : {}) };
}

/**
 * True when an error is a parameter rejection we can self-heal by flipping the
 * shape: a 400 (or status-less SDK error) whose message names a token/temperature
 * param. 401/403/5xx/network are NOT param errors.
 */
export function isParamError(err) {
  if (!err) return false;
  if (err.status != null && err.status !== 400) return false;
  const m = String(err.message || '').toLowerCase();
  return /max_tokens|max_completion_tokens|temperature|unsupported parameter|unsupported value/.test(m);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/chat-params.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add masking/chat-params.js tests/unit/chat-params.test.js
git commit -m "feat: add per-model chat param helper (reasoning vs standard)"
```

---

### Task 2: Adaptive `_createChat` + route the three egress chat sites

**Files:**
- Modify: `masking/egress.js` (constructor; add `_createChat`; `testContentModel` ~line 161-184; `completeText` ~line 275; `completeVision` ~line 374; add import)
- Test: `tests/unit/egress.test.js` (add adaptive-retry, cache, 401, and integration tests)

**Interfaces:**
- Consumes: `isParamError, defaultShape, altShape, tokenParams` from `masking/chat-params.js` (Task 1).
- Produces: `async _createChat(client, { model, messages, maxTokens, temperature }): Promise<SDKResponse>` — an egress method that calls `client.chat.completions.create` with the model's cached-or-default param shape, self-heals one param-400 by flipping the shape, and caches the winning shape in `this._modelShape` (a `Map`).

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/egress.test.js`. These use a hand-built fake client that records calls and can reject one shape. (The `setup()` helper and `CTX` constant already exist in this file.)

```js
// Fake client whose chat.completions.create rejects the `rejectKey` param with a
// 400 and succeeds otherwise. Records every call's params.
function shapeFake({ rejectKey }) {
  const calls = [];
  return {
    calls,
    client: { chat: { completions: { create: async (req) => {
      calls.push(req);
      if (rejectKey in req) { const e = new Error(`Unsupported parameter: ${rejectKey}`); e.status = 400; throw e; }
      return { choices: [{ message: { content: 'ok' } }], usage: {} };
    } } } }
  };
}

test('_createChat self-heals a param-400 by flipping the shape, then caches it', async () => {
  const { egress } = setup();
  const { client, calls } = shapeFake({ rejectKey: 'max_tokens' }); // standard shape rejected
  // gpt-4o defaults to 'standard' (max_tokens) → 400 → retry 'reasoning' (max_completion_tokens) → ok
  const res1 = await egress._createChat(client, { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }], maxTokens: 16, temperature: 0.2 });
  assert.equal(res1.choices[0].message.content, 'ok');
  assert.equal(calls.length, 2, 'first attempt (max_tokens) failed, second (max_completion_tokens) succeeded');
  assert.ok('max_tokens' in calls[0]);
  assert.ok('max_completion_tokens' in calls[1]);
  // Second call for the SAME model uses the learned shape — one attempt only.
  const before = calls.length;
  const res2 = await egress._createChat(client, { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }], maxTokens: 16, temperature: 0.2 });
  assert.equal(res2.choices[0].message.content, 'ok');
  assert.equal(calls.length - before, 1, 'cached shape → single attempt');
  assert.ok('max_completion_tokens' in calls[before]);
});

test('_createChat does NOT retry a non-param error (e.g. 401)', async () => {
  const { egress } = setup();
  const calls = [];
  const client = { chat: { completions: { create: async (req) => { calls.push(req); const e = new Error('Unauthorized'); e.status = 401; throw e; } } } };
  await assert.rejects(() => egress._createChat(client, { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }], maxTokens: 16, temperature: 0 }), (err) => err.status === 401);
  assert.equal(calls.length, 1, '401 is not retried');
});

test('completeText succeeds through _createChat against a max_tokens-rejecting endpoint', async () => {
  const { vault, bus, db } = setup();
  vault.setProviderConfig({ provider: 'custom', customBaseUrl: 'http://localhost:11434/v1', customModels: { content: 'o1-mini' } });
  const { client } = shapeFake({ rejectKey: 'max_tokens' });
  const egress = new MaskingEgress({ vault, bus, db, transports: { openai: client } });
  const out = await runWithKey('k', () => egress.completeText({ user: 'hello' }, CTX));
  assert.equal(typeof out, 'string');
});

test('completeVision routes through _createChat (no temperature in the request)', async () => {
  const { vault, bus, db } = setup();
  vault.setProviderConfig({ provider: 'custom', customBaseUrl: 'http://localhost:11434/v1', customModels: { content: 'gpt-4o', vision: 'gpt-4o' } });
  const { client, calls } = shapeFake({ rejectKey: '__none__' }); // accepts everything
  const egress = new MaskingEgress({ vault, bus, db, transports: { openai: client } });
  await runWithKey('k', () => egress.completeVision({ prompt: 'describe', imageBase64: 'aGk=' }, CTX));
  assert.equal('temperature' in calls[0], false, 'vision sends no temperature');
});

test('testContentModel adds an entitlement hint on 401', async () => {
  const { vault, bus, db } = setup();
  vault.setProviderConfig({ provider: 'custom', customBaseUrl: 'http://localhost:11434/v1', customModels: { content: 'gpt-4o' } });
  const client = { chat: { completions: { create: async () => { const e = new Error('Unauthorized'); e.status = 401; throw e; } } } };
  const egress = new MaskingEgress({ vault, bus, db, transports: { openai: client } });
  const r = await runWithKey('k', () => egress.testContentModel());
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
  assert.match(r.message, /not be enabled for this key/);
});
```

Note: `runWithKey` and `CTX` — `CTX` already exists in this file; add `import { runWithKey } from '../../masking/request-key.js';` at the top if it is not already imported (Part A added it — check first).

- [ ] **Step 2: Run the egress suite to verify the new tests fail**

Run: `node --test tests/unit/egress.test.js`
Expected: FAIL — `egress._createChat is not a function`; the 401-hint test fails (no hint yet).

- [ ] **Step 3: Implement `_createChat`, route the sites, add the 401 hint**

In `masking/egress.js`:

Add the import near the top (with the other local imports):

```js
import { isParamError, defaultShape, altShape, tokenParams } from './chat-params.js';
```

In the constructor, add the cache field (next to the other `this._…` fields):

```js
    this._modelShape = new Map(); // modelId -> last-successful param shape ('standard'|'reasoning')
```

Add the method (place it near `_openaiClient`):

```js
  /**
   * Call chat.completions with the model's param shape (max_tokens+temperature
   * for standard models, max_completion_tokens for reasoning/o-series). On a
   * 400 that names a token/temperature param, retry ONCE with the alternate
   * shape and cache the winner so later calls for that model are single-attempt.
   * Non-param errors (401/403/5xx/network) propagate unchanged — no retry.
   */
  async _createChat(client, { model, messages, maxTokens, temperature }) {
    const start = this._modelShape.get(model) || defaultShape(model);
    const call = (shape) => client.chat.completions.create({
      model, messages, ...tokenParams(shape, maxTokens, temperature)
    });
    try {
      const res = await call(start);
      this._modelShape.set(model, start);
      return res;
    } catch (err) {
      if (!isParamError(err)) throw err;
      const other = altShape(start);
      const res = await call(other);
      this._modelShape.set(model, other);
      return res;
    }
  }
```

Replace the three inline `client.chat.completions.create({...})` calls:

- `testContentModel()` (the `try` block that currently calls `client.chat.completions.create({ model, max_tokens: 8, temperature: 0, messages: [...] })`):
  ```js
      const res = await this._createChat(client, {
        model, messages: [{ role: 'user', content: 'ping' }], maxTokens: 8, temperature: 0
      });
  ```
  And in its `catch (err)` block, append the entitlement hint for auth failures:
  ```js
    } catch (err) {
      const status = err.status ?? null;
      let message = (err.message || 'the endpoint call failed').slice(0, 200);
      if (status === 401 || status === 403) message += ' — the model may not be enabled for this key (check Foundry access).';
      return { ok: false, code: err.code || 'CALL_FAILED', status, message };
    }
  ```

- `completeText()` (the `client.chat.completions.create({ model: useModel, max_tokens: maxTokens, temperature, messages: [...] })` inside `withRetry`):
  ```js
          const res = await this._createChat(client, {
            model: useModel, messages: [
              ...(maskedSystem ? [{ role: 'system', content: maskedSystem }] : []),
              { role: 'user', content: maskedUser }
            ], maxTokens, temperature
          });
  ```
  (Use the same `messages` array the call currently builds — keep the exact system/user construction that is already there.)

- `completeVision()` (the `client.chat.completions.create({ model: useModel, max_tokens: maxTokens, messages: [...] })`):
  ```js
          const res = await this._createChat(client, {
            model: useModel, messages: [{
              role: 'user',
              content: [
                { type: 'text', text: maskedPrompt },
                { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } }
              ]
            }], maxTokens: maxTokens
          });
  ```
  (No `temperature` → `tokenParams` omits it.)

- [ ] **Step 4: Run the egress suite, then the full suite**

Run: `node --test tests/unit/egress.test.js` then `npm test`
Expected: PASS — egress green (new adaptive tests included); full suite green (0 failures).

- [ ] **Step 5: Commit**

```bash
git add masking/egress.js tests/unit/egress.test.js
git commit -m "feat: adaptive chat params with self-healing retry across all models"
```

---

## Self-Review

**Spec coverage:**
- §1 pure helper (`isReasoningModel`/`defaultShape`/`altShape`/`tokenParams`/`isParamError`) → Task 1 ✓
- §2 `_modelShape` cache + `_createChat` → Task 2 ✓
- §3 route the three chat sites → Task 2 ✓
- §4 401 entitlement hint in `testContentModel` → Task 2 ✓
- §5 error handling (param self-heal, non-param propagate) → Task 1 `isParamError` + Task 2 `_createChat` ✓
- §6 testing (classifier, retry+cache, 401-not-retried, integration, hint) → Tasks 1-2 ✓

**Placeholder scan:** none — every code step carries full content. Test-import note ("check if `runWithKey` already imported") is a concrete conditional, not a placeholder.

**Type consistency:** `tokenParams(shape, maxTokens, temperature)`, `defaultShape(id)`, `altShape(shape)`, `isParamError(err)` identical between Task 1 (defs) and Task 2 (egress use). `_createChat(client, { model, messages, maxTokens, temperature })` shape identical across its definition and all three call sites. Shape string literals `'standard'`/`'reasoning'` consistent throughout.

**Note:** Task 2's fake-client tests assume `MaskingEgress`, `setup`, `CTX`, and `runWithKey` are available in `egress.test.js` (Part A added `runWithKey`; the rest pre-exist). Step 1 instructs verifying/adding the `runWithKey` import.
