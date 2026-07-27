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
