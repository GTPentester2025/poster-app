// Background Director Agent (Phase F). Decides the poster's BACKGROUND
// treatment — 'image' | 'gradient-mesh' | 'pattern' — and its concept, so the
// background is a deliberate, modern, image-first choice rather than a flat
// default. Resilient: any model/parse failure falls back to a deterministic
// per-mode decision, so the stage never blocks a compile. User text fenced.

import { fenceUserText, USER_TEXT_RULE } from './prompts/data_fence.js';
import {
  BACKGROUND_DIRECTOR_SYSTEM, BACKGROUND_DECISION_INSTRUCTION,
  MODE_TREATMENT_FALLBACK, BACKGROUND_TREATMENTS
} from './prompts/background_prompts.js';
import { normalizeMode } from './art_director.js';

export const AGENT_ID = 'background-director';
export const skills = ['decide_background'];
export { BACKGROUND_TREATMENTS };

const CTX_STAGE = { pipeline: 'design', stage: 'background-decision', agent: AGENT_ID, skill: 'decide_background' };

function isDecision(x) {
  return x && typeof x === 'object'
    && BACKGROUND_TREATMENTS.includes(x.treatment)
    && typeof x.concept === 'string' && x.concept.trim();
}

function parseFirstJson(text) {
  const s = String(text ?? '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(s.slice(start, end + 1)); } catch { return null; }
}

/**
 * Decide the background treatment + concept for a poster.
 * @param {object} opts
 *   egress     — MaskingEgress (falsy → deterministic fallback)
 *   runId      — pipeline run id
 *   topics     — string[] poster topics
 *   visualMode — 'futuristic' | 'holographic' | 'editorial'
 *   brief      — optional art-direction brief (backgroundConcept seeds the fallback)
 * @returns {Promise<{treatment, concept, rationale}>}
 */
export async function decideBackground({ egress, runId, topics = [], visualMode = 'futuristic', brief = null }) {
  const mode = normalizeMode(visualMode);
  const fallback = { ...MODE_TREATMENT_FALLBACK[mode] };
  if (brief && brief.backgroundConcept) fallback.concept = brief.backgroundConcept;

  if (!egress || typeof egress.completeText !== 'function' || !runId) return fallback;

  const topicLine = topics.length ? fenceUserText(topics.join(', ')) : fenceUserText('workplace security awareness');
  const user = [
    `Visual mode: ${mode}.`,
    `Poster topic: ${topicLine}.`,
    brief ? `Art direction: ${fenceUserText(`${brief.lighting || ''}; ${(brief.texture || []).join(', ')}`)}.` : '',
    USER_TEXT_RULE,
    BACKGROUND_DECISION_INSTRUCTION
  ].filter(Boolean).join(' ');

  try {
    const raw = await egress.completeText(
      { system: BACKGROUND_DIRECTOR_SYSTEM, user, maxTokens: 400, temperature: 0.5 },
      { runId, ...CTX_STAGE }
    );
    const d = typeof raw === 'string' ? parseFirstJson(raw) : (raw && typeof raw === 'object' ? raw : null);
    if (isDecision(d)) {
      return { treatment: d.treatment, concept: d.concept, rationale: typeof d.rationale === 'string' ? d.rationale : '' };
    }
  } catch { /* fall through to deterministic decision */ }
  return fallback;
}
