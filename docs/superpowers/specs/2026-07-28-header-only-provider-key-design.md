# Header-only provider key (no server-side key storage)

**Date:** 2026-07-28
**Status:** Approved (design)
**Scope:** poster-app — stop persisting the AI provider API key on the server. Part A of a two-part effort (Part B, all-models compatibility, is separate).

## Problem

When poster-app is hosted on a server, the AI provider API key is written to
`data/secrets.json` (and read from `OPENAI_API_KEY`/`CUSTOM_API_KEY` env vars).
The operator does not want the key stored on the server at all.

The newsletter app (`awareness-latest`) keeps the key in the browser's
**sessionStorage** (tab-scoped, never localStorage) and attaches it per request.
Poster-app cannot go fully browser-side: its security model masks organization
values out of every prompt **server-side**, so the server must still make the
model call. The faithful replication: the browser holds the key in
sessionStorage and sends it on each request; the server uses it **transiently**
(request-scoped, in memory) and never persists it.

## Decisions (from brainstorming)

- **Header-only, no fallback.** The server uses ONLY the per-request
  `x-provider-key` header. No `data/secrets.json`, no env-var fallback. A model
  call with no key from the browser errors (except a keyless custom endpoint,
  which legitimately needs no key).
- **Part A only.** All-models compatibility (400/401 across Foundry models) is a
  separate later effort.

## Approach

Two single choke-points instead of threading the key through every route, run
context, and agent:

1. **Server:** an `AsyncLocalStorage` populated by one Express middleware from
   the `x-provider-key` header. Because content/translation/image pipelines are
   **awaited within the request** (`backend/routes/pipeline.js` comment: "awaits
   and NO artificial timeout"), the async context propagates to every deep
   `egress` call automatically — no per-route or per-`ctx` changes.
2. **Browser:** augment the shared `window.authOptions()` (every page's `api()`
   wrapper already routes through it) to attach `x-provider-key` from
   sessionStorage on every request. One edit covers all model-triggering calls.

## Design

### 1. Request-scoped key — new `masking/request-key.js` (pure, node:async_hooks)

```
runWithKey(key: string, fn): runs fn within an ALS store carrying the key
currentKey(): string   // '' when outside a runWithKey scope or no key
```

Uses `AsyncLocalStorage`. No other imports. Unit-tested: `currentKey()` returns
the key inside `runWithKey`, `''` outside, and nested scopes shadow correctly.

### 2. Middleware — `backend/server.js`

Early (before routers), wrap every request:

```js
import { runWithKey } from '../masking/request-key.js';
app.use((req, _res, next) => runWithKey(req.get('x-provider-key') || '', next));
```

The header value is used only in memory for the life of the request; never
logged, never written.

### 3. Egress reads the request key — `masking/egress.js`

Replace every `this.vault.getSecrets()` use with `currentKey()`:

- `_openaiClient()`:
  - custom: `const key = currentKey();` → sig `custom|${base}|${key}`; build
    `new OpenAI({ apiKey: key || 'not-needed', baseURL })`. Empty key = keyless
    (no `Authorization`), unchanged behavior for local Ollama.
  - openai: `const key = currentKey(); if (!key) throw NO_API_KEY`; sig
    `openai|${key}`; build `new OpenAI({ apiKey: key })`.
  - The cache sig already includes the key, so a per-request key change rebuilds
    the client correctly.
- `listModels()`: same — custom uses `currentKey()` (empty ⇒ no Bearer header);
  openai requires it (else `NO_API_KEY` 400).
- `testContentModel()`: unchanged (goes through `_openaiClient` + `_model`).
- Egress keeps `vault` for org config / models / provider config — only the
  key source changes. `import { currentKey } from './request-key.js'`.

### 4. Remove server-side key persistence — `masking/vault.js`, `backend/routes/config.js`

- Delete `setSecrets`, `getSecrets`, `secretStatus`, `_readSecrets`, and the
  `secretsPath` field from `Vault` (provider keys were their only purpose).
  Keep `validateApiKey` (pure, still useful; unaffected). `defaultSecretsPath`
  is removed. `data/secrets.json` is no longer read or written.
- `backend/routes/config.js`: delete `PUT /api/config/secrets`. `GET /api/config`
  no longer returns `secrets` (drop `openaiConfigured`/`customConfigured`).
- `backend/app-context.js`: `new Vault({ db })` (no `secretsPath`).

### 5. Browser — `ui/js/auth.js`, `ui/config.html`, `ui/js/config_page.js`

- `ui/js/auth.js` (loaded before every page script) gains:
  - `window.getProviderKey()` / `window.setProviderKey(v)` backed by
    sessionStorage key `poster_provider_key` (empty/absent ⇒ removed).
  - In `authOptions`: if `getProviderKey()` is non-empty, add header
    `x-provider-key`.
- `ui/config.html`: replace the OpenAI-key card + custom-key input +
  "keyless" checkbox with ONE session-only field:
  "AI provider API key (this session only)" + a "Set key" button + a chip.
  A single sessionStorage entry serves whichever provider is active; a keyless
  custom endpoint is simply the empty field.
- `ui/js/config_page.js`:
  - "Set key" writes `window.setProviderKey(value)` (no server call), clears the
    input, and updates the chip to "set for this session ✓".
  - Chip on load reads `getProviderKey()`.
  - `load()` no longer reads `secrets.*Configured`; `persistProvider()` drops the
    `customKey`/`customKeyless` server writes.

### 6. Error handling

- OpenAI provider, no session key → existing `NO_API_KEY` (400) surfaces as
  "OpenAI API key not configured — set it on the Config page (this session)."
- Custom provider, no key → keyless (works for Ollama); if the endpoint needs a
  key it returns 401, surfaced verbatim by the existing egress error path.
- The header is never logged; egress error text already carries no key.

### 7. Testing

- `tests/unit/request-key.test.js` (new): `currentKey()` inside/outside/nested
  `runWithKey`.
- `tests/unit/egress.test.js` (update): key now comes from `runWithKey`, not
  `vault.setSecrets`. Wrap calls needing a key in `runWithKey('…', () => …)`.
  Add: openai + no key → `NO_API_KEY`; custom + no key → keyless client builds
  and a chat call is attempted (no `Authorization`).
- `tests/unit/config-routes.test.js` (update): remove `PUT /secrets` and
  `secrets.*Configured` assertions; `GET /api/config` no longer returns
  `secrets`.
- `tests/unit/db-vault.test.js` (update): remove `setSecrets`/`secretStatus`
  tests; keep `validateApiKey` tests.
- New middleware test (in config-routes or a small server test): a request
  carrying `x-provider-key` makes `currentKey()` visible to a stub egress /
  the header reaches the ALS. (If simpler, assert via `testContentModel` echo
  through the `/test` route with a header-provided key.)
- Browser header injection: manual smoke (set key on Config → a generate
  request carries `x-provider-key`; DevTools Network confirms).
- Full suite stays green.

## Out of scope (Part B, later)

- All-models (Claude/OpenAI via Foundry) 400/401 handling — adaptive params +
  self-healing retry. Separate spec/plan.
- Any change to masking, org config, or image generation.

## Files touched

- `masking/request-key.js` — new ALS helper.
- `masking/egress.js` — key from `currentKey()`, drop `getSecrets`.
- `masking/vault.js` — remove secrets methods + `secretsPath`.
- `backend/server.js` — request-key middleware.
- `backend/app-context.js` — `Vault` without `secretsPath`.
- `backend/routes/config.js` — drop `/secrets` route + `secrets` in GET.
- `ui/js/auth.js` — provider-key getter/setter + header injection.
- `ui/config.html` — single session-only key field.
- `ui/js/config_page.js` — session-only key UX, chip, no secret persistence.
- `tests/unit/*` — request-key, egress, config-routes, db-vault updates.
