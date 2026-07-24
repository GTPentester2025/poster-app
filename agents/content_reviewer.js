// Content Reviewer Agent (spec §B.5): independent 95-gate reviewer. Low
// temperature (0.1) — scoring must be stable, not creative. Non-accepted
// verdicts MUST carry specific feedback + expected (the event schema and the
// gate engine both enforce this downstream; we validate it here first so a
// lazy model verdict fails loudly at the source).
//
// LEAK GUARD (fix-at-source): the reviewer sees the internal context-file
// synthesis and could echo it into feedback/expected, which travel into safe
// views AND bus/SSE rework events. Both strings are scrubbed against the
// synthesis before this module returns anything.

import {
  buildContentReviewerSystem, buildReviewerUserPrompt,
  buildContentReviewerSystemV2, buildReviewerUserPromptV2
} from './prompts/content_reviewer_prompts.js';
import { scrubInternalText } from '../pipelines/scrub.js';

export const AGENT_ID = 'content-reviewer';
export const skills = ['score_content', 'write_actionable_feedback', 'check_translatability'];

const CTX_STAGE = { pipeline: 'content', stage: 'content-review', agent: AGENT_ID, skill: 'score_content' };
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
      problems.push('"feedback" is required for rework: list each concrete problem, quoting the offending text');
    }
    if (typeof out.expected !== 'string' || out.expected.trim().length < MIN_FEEDBACK_LENGTH) {
      problems.push('"expected" is required for rework: describe what a passing version looks like');
    }
  }
  return problems;
}

/**
 * Review one poster-content candidate against the internal context file.
 * @returns {Promise<{status:'accepted'|'rework', score:number, feedback:string, expected:string}>}
 * Throws REVIEW_INVALID after one repair retry.
 */
export async function reviewContent({ egress, runId, content, contextFile, attempt = 1, userPrompt = '' }) {
  if (!egress) throw new Error('reviewContent requires an egress instance');
  if (!runId) throw new Error('reviewContent requires a runId');
  if (!content) throw new Error('reviewContent requires content');
  if (!contextFile?.synthesis) throw new Error('reviewContent requires the context file (grounding check)');

  const ctx = { runId, ...CTX_STAGE };
  const user = buildReviewerUserPrompt({ content, contextFile, attempt, userPrompt });
  // seed = runId: rotating neutral examples, stable within a run
  const system = buildContentReviewerSystem(runId);

  let out = await egress.completeJson({ system, user, temperature: 0.1 }, ctx);
  let problems = validateVerdict(out);
  if (problems.length) {
    out = await egress.completeJson({
      system,
      user: `${user}\n\nYour previous verdict was invalid:\n- ${problems.join('\n- ')}\nRespond again with ONLY the corrected JSON object.`,
      temperature: 0
    }, ctx);
    problems = validateVerdict(out);
    if (problems.length) {
      const err = new Error(`Reviewer verdict invalid after retry: ${problems.join('; ')}`);
      err.code = 'REVIEW_INVALID';
      throw err;
    }
  }

  const status = out.status === 'rejected' ? 'rework' : out.status;
  return {
    status,
    score: out.score,
    feedback: status === 'accepted' ? '' : scrubInternalText(out.feedback.trim(), contextFile.synthesis),
    expected: status === 'accepted' ? '' : scrubInternalText(out.expected.trim(), contextFile.synthesis)
  };
}

// ── v2: template-aware review (Phase O4, plan D1) ────────────────────────────

/**
 * Review one v2 (template-first) content candidate: same verdict shape,
 * repair discipline and leak guard as reviewContent, but the prompt carries
 * the chosen template's structure block and scores fit-to-template explicitly
 * (structure matches the schema; block texts honor the style's intent;
 * room-readability).
 * @returns {Promise<{status:'accepted'|'rework', score:number, feedback:string, expected:string}>}
 * Throws REVIEW_INVALID after one repair retry.
 */
export async function reviewContentV2({ egress, runId, content, contextFile, template, attempt = 1, userPrompt = '' }) {
  if (!egress) throw new Error('reviewContentV2 requires an egress instance');
  if (!runId) throw new Error('reviewContentV2 requires a runId');
  if (!content) throw new Error('reviewContentV2 requires content');
  if (!contextFile?.synthesis) throw new Error('reviewContentV2 requires the context file (grounding check)');
  if (!template?.contentSchema) throw new Error('reviewContentV2 requires a v2 template with a contentSchema');

  const ctx = { runId, ...CTX_STAGE };
  const user = buildReviewerUserPromptV2({ content, contextFile, template, attempt, userPrompt });
  // seed = runId: rotating neutral examples, stable within a run
  const system = buildContentReviewerSystemV2(runId);

  let out = await egress.completeJson({ system, user, temperature: 0.1 }, ctx);
  let problems = validateVerdict(out);
  if (problems.length) {
    out = await egress.completeJson({
      system,
      user: `${user}\n\nYour previous verdict was invalid:\n- ${problems.join('\n- ')}\nRespond again with ONLY the corrected JSON object.`,
      temperature: 0
    }, ctx);
    problems = validateVerdict(out);
    if (problems.length) {
      const err = new Error(`Reviewer verdict invalid after retry: ${problems.join('; ')}`);
      err.code = 'REVIEW_INVALID';
      throw err;
    }
  }

  const status = out.status === 'rejected' ? 'rework' : out.status;
  return {
    status,
    score: out.score,
    feedback: status === 'accepted' ? '' : scrubInternalText(out.feedback.trim(), contextFile.synthesis),
    expected: status === 'accepted' ? '' : scrubInternalText(out.expected.trim(), contextFile.synthesis)
  };
}
