// Reroute Agent (Phase O6, plan D4): takes fenced user feedback + a SAFE doc
// summary and suggests which checkpoint the run should roll back to, with
// concrete adjustments to seed into the re-run. Output is validated with one
// repair retry (same idiom as edit_learning) — invalid twice → REROUTE_INVALID.

import { REROUTE_SYSTEM, buildReroutePrompt, REROUTE_CHECKPOINTS } from './prompts/reroute_prompts.js';

export const AGENT_ID = 'reroute';
export const skills = ['suggest_reroute'];

const CTX_STAGE = { pipeline: 'reroute', stage: 'reroute-suggest', agent: AGENT_ID, skill: 'suggest_reroute' };

const MIN_REASONING_LENGTH = 20;
const MIN_ADJUSTMENTS_LENGTH = 10;

export function validateSuggestion(out) {
  const problems = [];
  if (!out || typeof out !== 'object') return ['response is not a JSON object'];
  if (!REROUTE_CHECKPOINTS.includes(out.checkpoint)) {
    problems.push(`"checkpoint" must be one of: ${REROUTE_CHECKPOINTS.join(' | ')}`);
  }
  if (typeof out.reasoning !== 'string' || out.reasoning.trim().length < MIN_REASONING_LENGTH) {
    problems.push(`"reasoning" must be a string of at least ${MIN_REASONING_LENGTH} characters`);
  }
  if (typeof out.adjustments !== 'string' || out.adjustments.trim().length < MIN_ADJUSTMENTS_LENGTH) {
    problems.push(`"adjustments" must be a string of at least ${MIN_ADJUSTMENTS_LENGTH} characters with concrete re-run guidance`);
  }
  return problems;
}

/**
 * Suggest a reroute for a poster run.
 * docSummary is built BY THE PIPELINE from safe fields only:
 * {templateId, style, phase, headline, blockCount, imageSlotCount, hasImages, hasDesign}
 * — never raw doc internals (contextFile synthesis/sources must not reach this prompt).
 * @returns {{checkpoint: string, reasoning: string, adjustments: string}}
 */
export async function suggestReroute({ egress, runId, feedback, docSummary }) {
  if (!egress) throw new Error('suggestReroute requires an egress instance');
  if (!runId) throw new Error('suggestReroute requires a runId');
  if (typeof feedback !== 'string' || !feedback.trim()) throw new Error('suggestReroute requires non-empty feedback');
  if (!docSummary || typeof docSummary !== 'object') throw new Error('suggestReroute requires a docSummary');

  const ctx = { runId, ...CTX_STAGE };
  const user = buildReroutePrompt({ feedback: feedback.trim(), docSummary });

  let out = await egress.completeJson({ system: REROUTE_SYSTEM, user, temperature: 0.2 }, ctx);
  let problems = validateSuggestion(out);
  if (problems.length) {
    out = await egress.completeJson({
      system: REROUTE_SYSTEM,
      user: `${user}\n\nYour previous response was invalid:\n- ${problems.join('\n- ')}\nRespond again with ONLY the corrected JSON object.`,
      temperature: 0
    }, ctx);
    problems = validateSuggestion(out);
    if (problems.length) {
      const err = new Error(`Reroute suggestion invalid after retry: ${problems.join('; ')}`);
      err.code = 'REROUTE_INVALID';
      throw err;
    }
  }
  return {
    checkpoint: out.checkpoint,
    reasoning: out.reasoning.trim(),
    adjustments: out.adjustments.trim()
  };
}
