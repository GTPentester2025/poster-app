# SP-D — Remove tokenized-URL auth (localhost-only)

**Date:** 2026-07-28
**Status:** Approved (design)
**Scope:** poster-app — drop the `?token=` / session-cookie gate. Loopback bind becomes the only access boundary. First of four sub-projects (SP-D, SP-B templates, SP-A backgrounds, SP-C self-learning).

## Problem

The startup banner prints a tokenized URL (`http://127.0.0.1:4180/?token=…`)
that must be opened to set a `poster_session` cookie; every `/api` route is
gated by `sessionAuth`. The user finds this friction unnecessary and wants it
removed. The server already binds `127.0.0.1` (loopback only).

Reference: the newsletter app (`awareness-latest`) has **no server, no token, no
login, no users** — the browser tab *is* the session, secrets live in
sessionStorage (per-tab, ephemeral), and two tabs/browsers are isolated because
sessionStorage is per-tab. Poster-app already matches the key/session half of
this after Part A (provider key in sessionStorage, read per-request via
AsyncLocalStorage). SP-D removes the remaining token gate to complete the
alignment.

## Decision

- **Localhost-only, no token.** Keep the `127.0.0.1` bind; remove the token +
  cookie + `sessionAuth` entirely. Loopback is the only gate.
- **Two browsers must not share keys** — preserved by construction (Part A):
  sessionStorage is per-tab and the server holds no per-user key state; a test
  locks this in.
- **Accepted trade-off:** any local process/tab can reach the API. Safe for
  local use; not safe if the port is ever exposed publicly (would need real
  auth — out of scope).

## Design

### 1. Server — `backend/server.js`

- Remove the import of `loadOrCreateToken`, `sessionAuth`, `tokenCookieSetter`.
- Remove `const token = loadOrCreateToken(dataDir)`, `app.use(tokenCookieSetter(token))`,
  and `app.use('/api', sessionAuth(token))`.
- `createServer` returns `{ app, ctx }` (no `token`).
- Keep the `127.0.0.1` bind. Startup banner prints the plain URL:
  `Poster app: http://127.0.0.1:${PORT}/`.

### 2. Auth module — delete `backend/auth.js`

Nothing imports it after step 1. `data/session-token` is no longer written or
read (the `.gitignore` entry can stay; harmless).

### 3. Browser — `ui/js/auth.js`

- Remove the `?token=` capture and the `sessionStorage 'poster_token'` handling.
- `authOptions` no longer adds `x-session-token`; it keeps ONLY the Part A
  `x-provider-key` injection from sessionStorage.
- Remove `window.SESSION_TOKEN`. Leave `getProviderKey`/`setProviderKey`
  (Part A) unchanged.
- `showAuthBanner` in `config_page.js` only fires on a 401 that can no longer
  occur; leave it in place (harmless) — no change required beyond the fact that
  `api()`'s 401 branch will not trigger.

### 4. Key isolation invariant (kept + tested)

No server-side per-user/per-session key state exists: the provider key is read
from the request scope (`currentKey()` / AsyncLocalStorage middleware). Two
concurrent requests carrying different `x-provider-key` headers each see only
their own key. This is the mechanism guaranteeing "two browsers don't share
keys," and it is asserted by a test so a future change can't regress it.

### 5. Error handling

- No auth errors: `/api` is reachable without a token/cookie.
- The `api()` browser wrapper's 401 path and `showAuthBanner` remain but are
  unreachable via the auth gate (a provider 401 is handled separately in the
  egress error path, not by this middleware).

### 6. Testing

- `tests/unit/server-auth.test.js` (rewrite): the old tests assert a 401 without
  a token, the cookie-set-on-`?token=`, and the header path. Replace with:
  - `GET /api/config` returns **200 without any token or cookie** (auth gate
    removed).
  - **Key isolation:** two concurrent `POST /api/config/test` requests with
    different `x-provider-key` headers each get back their own key. Use a stub
    egress whose `testContentModel` returns `{ ok: true, model: 'm', sample: currentKey() }`
    (import `currentKey` from `masking/request-key.js`), fire both with
    `Promise.all`, and assert each response's `sample` equals the key that
    request sent.
- All other route-test harnesses are UNCHANGED: they send an `x-session-token`
  header that the server now ignores (harmless no-op), and `createServer` no
  longer returning `token` leaves their `H(token)`/`H(undefined)` sending an
  ignored header. `npm test` must stay green (currently 828).

## Out of scope

- Any real authentication (password/login/multi-user) — would be a separate
  effort if the app is ever exposed beyond loopback.
- SP-B/SP-A/SP-C.

## Files touched

- `backend/server.js` — remove auth wiring; plain startup URL; `{ app, ctx }`.
- `backend/auth.js` — deleted.
- `ui/js/auth.js` — drop token capture + `x-session-token`; keep provider-key.
- `tests/unit/server-auth.test.js` — rewrite (no-token-200 + key-isolation).
