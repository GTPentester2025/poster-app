// Pure URL helpers for the CUSTOM (OpenAI-compatible) provider. No I/O, no
// state — just normalization + parsing so they can be unit-tested in isolation
// and reused by the egress (which owns the actual network calls).
//
// Modeled on the reference app's normalizeChatCompletionsUrl / resolveModelsUrl
// / parseModelsList, adapted for the OpenAI SDK's baseURL contract: the SDK
// appends `/chat/completions` (etc.) to whatever baseURL we hand it, so
// normalizeChatCompletionsBase() must return the API ROOT (typically `…/v1`),
// NOT a full chat-completions URL.

const BLOCKED_SCHEMES = ['javascript:', 'data:', 'file:', 'vbscript:'];

/**
 * Normalize a user-entered endpoint into the base URL the OpenAI SDK expects.
 * Accepts: bare host (`localhost:11434`), an API root (`https://host/v1`), or a
 * full chat-completions URL (`https://host/v1/chat/completions`). Rejects
 * dangerous schemes (javascript:/data:/file:/vbscript:). Loopback hosts without
 * a scheme default to http://; everything else defaults to https://.
 *
 * @param {string} input
 * @returns {string} base URL with no trailing slash, `/chat/completions` stripped,
 *   and `/v1` appended when the user gave only a host/root.
 * @throws {Error} code CUSTOM_URL_INVALID on empty/unparseable/blocked input.
 */
export function normalizeChatCompletionsBase(input) {
  const raw = String(input ?? '').trim();
  if (!raw) throw urlError('Custom base URL is empty');

  const lower = raw.toLowerCase();
  for (const scheme of BLOCKED_SCHEMES) {
    if (lower.startsWith(scheme)) throw urlError(`Custom base URL scheme "${scheme}" is not allowed`);
  }

  let withScheme = raw;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    // No scheme given: loopback → http, otherwise https.
    const host = raw.split('/')[0].toLowerCase();
    const isLoopback = host === 'localhost' || host.startsWith('localhost:') ||
      host.startsWith('127.') || host === '[::1]' || host.startsWith('[::1]:');
    withScheme = `${isLoopback ? 'http' : 'https'}://${raw}`;
  }

  let url;
  try {
    url = new URL(withScheme);
  } catch {
    throw urlError(`Custom base URL is not a valid URL: ${raw}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw urlError(`Custom base URL must use http or https (got "${url.protocol}")`);
  }

  // Strip a trailing `/chat/completions` (full URL was pasted).
  let path = url.pathname.replace(/\/+$/, '');
  path = path.replace(/\/chat\/completions$/i, '');
  path = path.replace(/\/+$/, '');
  // Bare host / root → assume the OpenAI `/v1` convention.
  if (path === '') path = '/v1';

  return `${url.protocol}//${url.host}${path}`;
}

/**
 * Given a normalized base (from normalizeChatCompletionsBase), the URL to list
 * models: `<base>/models` (OpenAI convention).
 */
export function resolveModelsUrl(base) {
  return `${String(base).replace(/\/+$/, '')}/models`;
}

/**
 * Extract a de-duplicated list of model id strings from a /models response.
 * Tolerates the three shapes seen in the wild: `{data:[…]}` (OpenAI),
 * `{models:[…]}` (Ollama/others), and a bare array. Each item may be a string
 * or an object with id/name/model. Unknown shapes yield an empty list rather
 * than throwing (a bad response must never crash the config page).
 */
export function parseModelsList(json) {
  let items;
  if (Array.isArray(json)) items = json;
  else if (json && Array.isArray(json.data)) items = json.data;
  else if (json && Array.isArray(json.models)) items = json.models;
  else return [];

  const ids = [];
  const seen = new Set();
  for (const item of items) {
    let id = null;
    if (typeof item === 'string') id = item;
    else if (item && typeof item === 'object') id = item.id || item.name || item.model || null;
    if (typeof id !== 'string') continue;
    id = id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function urlError(message) {
  const err = new Error(message);
  err.code = 'CUSTOM_URL_INVALID';
  err.status = 400;
  return err;
}
