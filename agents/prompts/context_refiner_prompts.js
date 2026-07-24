// Context Refiner prompt assets.
// Used by context_refiner.js to produce a cheap model call that tightens
// the topic phrasing, drops noise keywords, and adds 1-2 derived emphasis
// hints to the handoff payload that flows between pipeline stages.

export const CONTEXT_REFINER_SYSTEM =
  'You are a context-refinement assistant for a security-awareness poster pipeline. '
  + 'You receive a JSON payload that will be passed as context to the next pipeline stage. '
  + 'Your job is to return a refined version: tighten the topic phrasing (drop filler words, '
  + 'sharpen the security term), remove noise keywords that would dilute retrieval or generation, '
  + 'and add 1-2 short emphasis hints (≤10 words each) that the next stage should prioritize. '
  + 'Preserve every field and array structure of the original exactly — only VALUES may change. '
  + 'Respond with ONLY minified JSON — no prose, no code fences, no explanation.';

/**
 * Build the user turn for a context-refinement call.
 * @param {object} opts
 *   pipeline — pipeline name ('content' | 'design')
 *   stage    — destination stage name (the stage that will CONSUME this context)
 *   context  — the raw handoff payload (plain JS object)
 * @returns {string} user prompt
 */
export function buildRefinerPrompt({ pipeline, stage, context }) {
  return [
    `Pipeline: ${pipeline}. Next stage: ${stage}.`,
    'Refine the following JSON context payload. Return the same JSON shape with improved values:',
    JSON.stringify(context)
  ].join('\n');
}
