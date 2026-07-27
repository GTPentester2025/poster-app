# Custom provider: per-role model selection (image vs text)

**Date:** 2026-07-27
**Status:** Approved (design)
**Scope:** poster-app custom (OpenAI-compatible) provider — model selection UX + per-role resolution.

## Problem

The custom provider collapses a single `customModel` into all three pipeline roles:

- `content` — poster copy / research (chat, text model)
- `vision` — the zero-text image gate (multimodal / vision model)
- `image` — generated artwork (image-generation model)

One model id cannot satisfy all three. On a hosted endpoint that serves both text
and image models, picking one id makes at least one role call incompatible. The
observed symptom — "model saves, but the content call fails" — is consistent with
an image (or otherwise non-chat) model id being sent to `chat/completions`.

Reference pattern: the newsletter app (`awareness-latest`) selects a custom model
via a real `<select>` synced to a hidden field (reliable across browsers, unlike a
`<datalist>`), with a **Load models** fetch and a **Test connection** probe. It uses
a single model and does **not** categorize by capability. This design adopts its
reliable selection pattern and adds per-capability sorting + per-role selection.

## Approach (chosen: A — id heuristic + manual override)

Classify loaded model ids into `image` vs `text` by id pattern, pre-filter each
role's select to its group, and allow a "show all" override. No extra network calls;
degrades gracefully on unknown ids (default `text`). Rejected: capability probing
(B — most `/models` endpoints don't expose modality; brittle) and flat manual list
(C — ignores the requested sort).

## Design

### 1. Data model — `masking/vault.js`

`providerConfig` gains `customModels: { content, vision, image }`, replacing the
single `customModel`.

- `getProviderConfig()` returns `customModels` (each a string, default `''`).
- **Migration / back-compat:** if a legacy `customModel` string is stored and
  `customModels` is absent, seed `content = vision = image = customModel` on read.
  Continue to accept a `customModel` field in `setProviderConfig` as an alias that
  writes `customModels.content` (keeps existing callers/tests working).
- `setProviderConfig({ customModels })` stores per-role values (trimmed).
- `getModels()` under custom returns `{ content, vision, image }` from
  `customModels`, with `vision` and `image` falling back to `content` when unset
  (text-only endpoints keep running; the gate reuses the content model).
- `content` unset under custom → `egress._model('content')` still throws
  `CUSTOM_MODEL_MISSING` (unchanged behavior).

### 2. Capability classifier — new `masking/model-capability.js` (pure)

```
classifyModel(id: string) -> 'image' | 'text'
```

Image id patterns (case-insensitive substring): `dall-e`, `dalle`, `gpt-image`,
`flux`, `stable-diffusion`, `sdxl`, `imagen`, and a trailing/segment `image`
(e.g. `/image`, `-image`). Everything else → `text`. Pure, no I/O, unit-tested.
Reused by the UI (grouping) and available for server-side validation.

### 3. Backend — `backend/routes/config.js`

- `PUT /api/config/provider` accepts `customModels` (object, per-role). Still
  accepts legacy `customModel` (alias → content) for back-compat.
- **New** `POST /api/config/test`: runs one minimal `chat.completions` call with
  the selected **content** model via the egress, returns
  `{ ok, status?, code?, message? }`. Surfaces the real endpoint error (HTTP
  status + short body snippet, never the key) so a `max_tokens` rejection, bad
  base path, or auth failure is visible before a full generate run.
- The network call itself stays in the egress (lint rule: only egress talks to
  providers); the route just surfaces the result shape, mirroring
  `/api/config/models/live`.

### 4. UI — `ui/config.html` + `ui/js/config_page.js`

- Remove the `<datalist>` model input. Add three role `<select>` elements
  (Content, Vision, Image), each synced to `providerConfig.customModels` state,
  following the newsletter's select-sync pattern.
- **Load models**: fetch via `/api/config/models/live`, split ids with
  `classifyModel`, populate each role select with its group. Each select gets a
  "Show all models" toggle to override the filter. Any currently-stored value not
  in the returned list is preserved as a `"<id> (current)"` option at the top.
- **Test connection** button → `POST /api/config/test`; shows the real result in
  a status line.
- Auto-persist on each select's `change` event (per role) — retains the
  missed-Save-click fix from the prior round, now per role.
- `applyProviderUi('custom')` shows the three selects + Load/Test controls.

### 5. Error handling

- Test-connection and Load-models statuses show the endpoint's actual HTTP status
  and a short response snippet (key-redacted).
- Empty model list → explicit "endpoint returned no models" message.
- Unknown-scheme / unreachable base URL → existing `CUSTOM_URL_*` messaging.
- A role left unset falls back to `content`; `content` unset → `CUSTOM_MODEL_MISSING`.

### 6. Testing

- Unit: `classifyModel` — image patterns match, text default, edge/empty ids.
- Unit: vault — per-role custom get/set, legacy `customModel` migration, fallback
  chain (`vision`/`image` → `content`), `CUSTOM_MODEL_MISSING` when content unset.
- Unit: egress — `_model(role)` resolves each role independently under custom.
- Route: `PUT /provider` accepts `customModels`; `POST /test` returns the result
  shape on ok and on endpoint error.
- Full suite must stay green (currently 805 passing).

## Out of scope

- OpenAI-provider model selection (unchanged; already per-role).
- Capability probing / auto model download.
- Any change to the poster generation pipeline beyond per-role model resolution.

## Files touched

- `masking/vault.js` — per-role custom models + migration + `getModels()`.
- `masking/model-capability.js` — new pure classifier.
- `backend/routes/config.js` — `customModels` on `/provider`, new `/test` route.
- `masking/egress.js` — minimal test-completion helper for `/test` (reuses
  `completeText`/client build; no new provider-call site outside egress).
- `ui/config.html` — three role selects, Load/Test controls, remove datalist.
- `ui/js/config_page.js` — categorize, populate, per-role persist, test call.
- `tests/unit/*` — classifier, vault, egress, config-routes coverage.
