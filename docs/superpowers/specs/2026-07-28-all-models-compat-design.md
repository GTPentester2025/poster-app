# All-models compatibility for the custom (Foundry) provider

**Date:** 2026-07-28
**Status:** Approved (design)
**Scope:** poster-app — make chat completions work across all models a Foundry-style OpenAI-compatible wrapper serves (Claude + OpenAI, incl. reasoning models), not just gpt-4. Part B (Part A, header-only key, already shipped).

## Problem

The custom provider fronts a corporate Foundry wrapper exposing Claude + OpenAI
models via one OpenAI-compatible endpoint. gpt-4 works; other models fail with
**400** (bad parameter) or **401** (auth). The three chat sites in
`masking/egress.js` all send `max_tokens` (+ `temperature` on two of them):

- `testContentModel()` — `{ max_tokens: 8, temperature: 0 }`
- `completeText()` — `{ max_tokens, temperature }`
- `completeVision()` — `{ max_tokens }`

OpenAI reasoning / o-series models reject `max_tokens` (they require
`max_completion_tokens`) and reject a non-default `temperature`. That is the
fixable 400. A **401** on a model that shares the working endpoint + key is a
Foundry entitlement/deployment issue — not fixable in poster-app, but it should
be surfaced clearly rather than swallowed. Image generation works and is out of
scope.

## Approach (chosen: A — adaptive params + self-healing retry + per-model cache)

Model ids come from the endpoint's Load-models list (arbitrary shapes), so
family detection is a substring heuristic with a safe default, and a
self-healing retry corrects any misclassification at runtime. Rejected: a manual
per-provider param toggle (B — brittle UX) and always sending the minimal set
(C — risks breaking the gpt-4 that works today, since older/Claude-compat paths
may only accept `max_tokens`).

## Design

### 1. Pure param helper — new `masking/chat-params.js`

```
isReasoningModel(id): boolean
  true when id matches an o-series/reasoning marker:
    /(^|[/_.-])o[1-9]([-_.]|$)/i   (o1, o3-mini, foundry/o4-…)
    OR /gpt-5/i OR /reasoning/i
  else false.

defaultShape(id): 'reasoning' | 'standard'   // isReasoningModel ? 'reasoning' : 'standard'
altShape(shape): the other shape

tokenParams(shape, maxTokens, temperature): object
  'reasoning' -> { max_completion_tokens: maxTokens }            // NO temperature
  'standard'  -> { max_tokens: maxTokens, ...(temperature != null ? { temperature } : {}) }

isParamError(err): boolean
  true when the error is a parameter rejection we can self-heal:
  (err.status === 400 || err.status == null) AND err.message (lowercased) matches
  /max_tokens|max_completion_tokens|temperature|unsupported parameter|unsupported value/.
  false for 401/403/5xx/network.
```

Pure, no I/O, unit-tested.

### 2. Adaptive create helper — `masking/egress.js`

Add `this._modelShape = new Map()` in the constructor (in-memory, per-process;
maps modelId → last-successful shape).

```
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
    if (!isParamError(err)) throw err;         // 401/entitlement/5xx propagate unchanged
    const other = altShape(start);
    const res = await call(other);             // second (and last) attempt; may throw → propagate
    this._modelShape.set(model, other);
    return res;
  }
}
```

- First call for an unknown reasoning-looking model may make two attempts; the
  winning shape is cached so every later call for that model is a single attempt.
- Bidirectional: a "standard" model that rejects `max_tokens` flips to
  `reasoning`, and vice-versa.

### 3. Route the three chat sites through the helper

Replace the inline `client.chat.completions.create({...})` at:
- `testContentModel()` → `await this._createChat(client, { model, messages: [{role:'user',content:'ping'}], maxTokens: 8, temperature: 0 })`
- `completeText()` → `await this._createChat(client, { model: useModel, messages, maxTokens, temperature })`
- `completeVision()` → `await this._createChat(client, { model: useModel, messages, maxTokens: maxTokens })` (no `temperature` → omitted)

Existing `withRetry` (transient retries) and per-attempt `egress_log` writes in
`completeText`/`completeVision` are unchanged — the adaptive param retry is a
fast local fallback nested inside a single logged attempt.

### 4. 401 surfacing (not fixable, but visible)

`isParamError` returns false for 401, so it propagates. In `testContentModel()`,
when `err.status === 401` or `403`, append a hint to the returned message:
`… — the model may not be enabled for this key (check Foundry access).`
No retry. Generation runs surface the endpoint's real 401 via the existing error
path.

### 5. Error handling

- A param 400 self-heals on the first call and is invisible thereafter.
- A genuine 400 that is not a param rejection propagates unchanged.
- 401/403 propagate with the entitlement hint (test path).
- The key is never in any of these messages (Part A guarantees; unchanged).

### 6. Testing

- `tests/unit/chat-params.test.js` (new): `isReasoningModel` (o1/o3-mini/gpt-5/
  `x-reasoning` → true; gpt-4o/claude-3-5-sonnet/llama3.1 → false), `tokenParams`
  shapes (reasoning omits temperature; standard includes it only when provided),
  `isParamError` (400 max_tokens msg → true; 401 → false; 500 → false), `defaultShape`/`altShape`.
- `tests/unit/egress.test.js` (add): `_createChat` retries once on a param-400
  and caches the winning shape (fake client: shape A throws
  `status:400, message:'Unsupported parameter: max_tokens'`, shape B succeeds) —
  assert success AND that a second `_createChat` for the same model calls
  `create` exactly once (learned shape). `_createChat` does NOT retry a 401
  (single call, error propagates). `completeText` and `completeVision` succeed
  through `_createChat` against a client that rejects `max_tokens` but accepts
  `max_completion_tokens`. `testContentModel` on a 401 returns the entitlement hint.
- Full suite stays green.

## Out of scope

- Image generation (works).
- Masking / key handling (Part A, done).
- Any UI change beyond what the existing Test-connection already surfaces.

## Files touched

- `masking/chat-params.js` — new pure helper.
- `masking/egress.js` — `_modelShape` cache, `_createChat`, route the 3 sites, 401 hint in `testContentModel`.
- `tests/unit/chat-params.test.js`, `tests/unit/egress.test.js` — coverage.
