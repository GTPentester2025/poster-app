// Stage QA Sub-Agent.
// Runs deterministic structural checks on a stage artifact, then optionally
// fires a single cheap model sanity call for a 0-100 confidence score + one-
// line problems. Model failure → ok from the deterministic result alone.
// Log-only: a failing QA emits a stage_end warning event but NEVER stops or
// loops the pipeline. Never throws.

export const AGENT_ID = 'stage-qa';
export const skills = ['qa_stage'];

const QA_SYSTEM =
  'You are a QA reviewer for a security-awareness poster pipeline. '
  + 'You receive a JSON artifact from a completed pipeline stage. '
  + 'Return ONLY minified JSON of this exact shape: '
  + '{"confidence": <0-100 integer>, "problems": [<one-line strings>]}. '
  + 'confidence = your overall confidence that the artifact is correct and complete. '
  + 'problems = list of specific issues (empty array if none). '
  + 'Be concise — one line per problem, no prose outside the JSON.';

/**
 * Run named structural checks + an optional model sanity call on a stage artifact.
 *
 * @param {object} opts
 *   egress   — MaskingEgress (falsy → deterministic only, no model call)
 *   runId    — pipeline run id
 *   pipeline — pipeline name ('content' | 'design')
 *   stage    — stage name being QA'd (e.g. 'keyword-intent', 'research', 'content-loop')
 *   artifact — the stage output object to inspect
 *   checks   — Array<{name: string, fn: (artifact) => boolean}> named predicate checks
 * @returns {Promise<{ok: boolean, score: number, problems: string[]}>}
 */
export async function qaStage({ egress, runId, pipeline, stage, artifact, checks = [] }) {
  // 1. Deterministic structural checks
  const problems = [];
  for (const check of checks) {
    let passed = false;
    try { passed = Boolean(check.fn(artifact)); } catch { /* treat as failed check */ }
    if (!passed) problems.push(`check "${check.name}" failed`);
  }
  const deterministicOk = problems.length === 0;
  let score = deterministicOk ? 80 : Math.max(0, 80 - problems.length * 20);

  // 2. Optional model sanity call — only when egress present AND deterministic checks pass
  if (egress && typeof egress.completeJson === 'function' && runId && deterministicOk) {
    const ctx = {
      runId,
      pipeline,
      stage: `qa-${stage}`,
      agent: AGENT_ID,
      skill: 'qa_stage'
    };
    try {
      const user = [
        `Pipeline: ${pipeline}. Stage: ${stage}.`,
        'Review this artifact for correctness and completeness:',
        JSON.stringify(artifact)
      ].join('\n');
      const result = await egress.completeJson(
        { system: QA_SYSTEM, user, temperature: 0.3, maxTokens: 300 },
        ctx
      );
      if (result && typeof result === 'object') {
        if (typeof result.confidence === 'number') {
          score = Math.max(0, Math.min(100, Math.round(result.confidence)));
        }
        if (Array.isArray(result.problems)) {
          for (const p of result.problems) {
            if (typeof p === 'string' && p.trim()) problems.push(p.trim());
          }
        }
      }
    } catch { /* model failure → keep deterministic result */ }
  }

  const ok = problems.length === 0;
  return { ok, score, problems };
}
