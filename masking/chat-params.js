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
