// Context Refiner Sub-Agent.
// Takes the hand-off payload between pipeline stages and produces a REFINED
// version: tightens topic phrasing, drops noise keywords, adds 1-2 derived
// emphasis hints. ONE cheap model call (temperature 0.2, maxTokens ~500).
// Deterministic fallback = passthrough (context unchanged, notes: 'passthrough').
// Non-destructive: output is validated to preserve the original shape/required
// fields; on ANY doubt the original is returned. Never throws.

import { CONTEXT_REFINER_SYSTEM, buildRefinerPrompt } from './prompts/context_refiner_prompts.js';

export const AGENT_ID = 'context-refiner';
export const skills = ['refine_context'];

/**
 * Validate that refined output preserves all keys of the original at top level
 * and that every required scalar (topic string, core/expanded arrays) is intact.
 * Returns true when the refined object is safe to use; false → fall back.
 */
function preservesShape(original, refined) {
  if (!refined || typeof refined !== 'object' || Array.isArray(refined)) return false;
  // every top-level key of the original must survive
  for (const key of Object.keys(original)) {
    if (!(key in refined)) return false;
  }
  // if original had a topic string, refined must too
  if (typeof original.topic === 'string' && (typeof refined.topic !== 'string' || !refined.topic.trim())) return false;
  // if original had core array, refined must keep it as a non-empty array
  if (Array.isArray(original.core) && original.core.length > 0) {
    if (!Array.isArray(refined.core) || !refined.core.length) return false;
  }
  return true;
}

/**
 * Refine the hand-off context payload flowing into the next pipeline stage.
 * @param {object} opts
 *   egress   — MaskingEgress (falsy → deterministic passthrough)
 *   runId    — pipeline run id
 *   pipeline — pipeline name ('content' | 'design')
 *   stage    — destination stage name (the stage that will consume this context)
 *   context  — the raw handoff payload (plain JS object, not null)
 * @returns {Promise<{context: object, notes: string}>}
 */
export async function refineContext({ egress, runId, pipeline, stage, context }) {
  // Guard: must be a plain object or we can't safely refine it
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return { context, notes: 'passthrough' };
  }

  // No egress (tests/offline without handler) → deterministic passthrough. Never blocks.
  if (!egress || typeof egress.completeJson !== 'function' || !runId) {
    return { context, notes: 'passthrough' };
  }

  const ctx = {
    runId,
    pipeline,
    stage: 'context-refine',
    agent: AGENT_ID,
    skill: 'refine_context'
  };

  try {
    const user = buildRefinerPrompt({ pipeline, stage, context });
    const refined = await egress.completeJson(
      { system: CONTEXT_REFINER_SYSTEM, user, temperature: 0.2, maxTokens: 500 },
      ctx
    );
    if (preservesShape(context, refined)) {
      return { context: refined, notes: 'refined' };
    }
  } catch { /* model/parse failure → fall through to passthrough */ }

  return { context, notes: 'passthrough' };
}
