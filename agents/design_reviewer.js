// Design Reviewer Agent (spec §B.6 Path B): independent 90-gate reviewer for
// dynamic layout mockups. The model never guesses geometry: it receives a
// LOCALLY COMPUTED rendering summary (pixel boxes, the font size each zone
// actually yields, WCAG contrast ratios) built with the exact same math the
// compiler uses — so the verdict is grounded in what will really render.
// Low temperature (0.1): scoring must be stable, not creative. Non-accepted
// verdicts MUST carry specific feedback + expected.

import { DESIGN_REVIEWER_SYSTEM, buildDesignReviewerUserPrompt } from './prompts/design_prompts.js';
import { buildRenderingSummary } from './design_recommender.js';

export const AGENT_ID = 'design-reviewer';
export const skills = ['validate_mockup', 'check_brand_compliance', 'check_readability'];

const CTX_STAGE = { pipeline: 'design', stage: 'design-loop', agent: AGENT_ID, skill: 'validate_mockup' };
const MIN_FEEDBACK_LENGTH = 10; // matches event.schema.json verdict minLength

function validateVerdict(out) {
  const problems = [];
  if (!out || typeof out !== 'object') return ['response is not a JSON object'];
  const status = out.status === 'rejected' ? 'rework' : out.status; // normalize: this loop reworks, never dead-ends
  if (!['accepted', 'rework'].includes(status)) problems.push('"status" must be "accepted" or "rework"');
  if (typeof out.score !== 'number' || !Number.isFinite(out.score) || out.score < 0 || out.score > 100) {
    problems.push('"score" must be a finite number 0-100');
  }
  if (status !== 'accepted') {
    if (typeof out.feedback !== 'string' || out.feedback.trim().length < MIN_FEEDBACK_LENGTH) {
      problems.push('"feedback" is required for rework: name each concrete problem (zone/role + offending number)');
    }
    if (typeof out.expected !== 'string' || out.expected.trim().length < MIN_FEEDBACK_LENGTH) {
      problems.push('"expected" is required for rework: describe what a passing layout looks like');
    }
  }
  return problems;
}

/**
 * Review one layout-spec candidate against the approved content + brand palette.
 * @returns {Promise<{status:'accepted'|'rework', score:number, feedback:string, expected:string}>}
 * Throws REVIEW_INVALID after one repair retry.
 */
export async function reviewDesign({ egress, runId, spec, content, palette, attempt = 1 }) {
  if (!egress) throw new Error('reviewDesign requires an egress instance');
  if (!runId) throw new Error('reviewDesign requires a runId');
  if (!spec) throw new Error('reviewDesign requires a layout spec');
  if (!content?.headline) throw new Error('reviewDesign requires the approved content');

  const ctx = { runId, ...CTX_STAGE };
  const renderingSummary = buildRenderingSummary(spec, content, palette);
  const user = buildDesignReviewerUserPrompt({ spec, renderingSummary, content, palette, attempt });

  let out = await egress.completeJson({ system: DESIGN_REVIEWER_SYSTEM, user, temperature: 0.1 }, ctx);
  let problems = validateVerdict(out);
  if (problems.length) {
    out = await egress.completeJson({
      system: DESIGN_REVIEWER_SYSTEM,
      user: `${user}\n\nYour previous verdict was invalid:\n- ${problems.join('\n- ')}\nRespond again with ONLY the corrected JSON object.`,
      temperature: 0
    }, ctx);
    problems = validateVerdict(out);
    if (problems.length) {
      const err = new Error(`Design reviewer verdict invalid after retry: ${problems.join('; ')}`);
      err.code = 'REVIEW_INVALID';
      throw err;
    }
  }

  const status = out.status === 'rejected' ? 'rework' : out.status;
  return {
    status,
    score: out.score,
    feedback: status === 'accepted' ? '' : out.feedback.trim(),
    expected: status === 'accepted' ? '' : out.expected.trim()
  };
}
