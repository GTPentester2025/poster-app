// Angle Autopick Agent (autopilot). Ranks the research angles and picks the
// single strongest one so the one-click pipeline never stops at the angles
// station. Criteria: specificity (names a concrete behaviour/threat),
// actionability (a poster can teach it), freshness vs the research synthesis.
// Resilient: no egress / bad output → first angle, so autopilot never blocks.

import { fenceUserText, USER_TEXT_RULE } from './prompts/data_fence.js';

export const AGENT_ID = 'angle-autopick';
export const skills = ['pick_angle'];

const CTX_STAGE = { pipeline: 'content', stage: 'angle-selection', agent: AGENT_ID, skill: 'pick_angle' };

const SYSTEM = [
  'You pick the single best poster angle from candidates.',
  'Prefer the angle that is most specific (names a concrete behaviour or threat),',
  'most actionable on a one-glance poster, and freshest relative to the research summary.',
  'Respond with ONLY a JSON object: {"angleId": "...", "reason": "one sentence"}.'
].join(' ');

/**
 * Pick one angle id from the context file's angles.
 * @returns {Promise<{angleId: string, reason: string}>} always a KNOWN id.
 */
export async function pickAngle({ egress, runId, topic = '', synthesis = '', angles = [] }) {
  const fallback = { angleId: angles[0]?.id || null, reason: 'first angle (deterministic fallback)' };
  if (!angles.length) return fallback;
  if (!egress || typeof egress.completeJson !== 'function' || !runId) return fallback;

  const user = [
    `Topic: ${fenceUserText(topic)}.`,
    synthesis ? `Research summary: ${fenceUserText(String(synthesis).slice(0, 800))}.` : '',
    'Candidate angles:',
    ...angles.map((a) => `- ${a.id}: ${fenceUserText(a.title)} — ${fenceUserText(a.rationale || '')}`),
    USER_TEXT_RULE
  ].filter(Boolean).join('\n');

  try {
    const out = await egress.completeJson(
      { system: SYSTEM, user, maxTokens: 200, temperature: 0.2 },
      { runId, ...CTX_STAGE }
    );
    if (out && angles.some((a) => a.id === out.angleId)) {
      return { angleId: out.angleId, reason: String(out.reason || '') };
    }
  } catch { /* fall through to first angle */ }
  return fallback;
}
