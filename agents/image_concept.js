// Image Concept Director Agent (point-relevance). Converts the specific POINT a
// slot illustrates (a block's message) into a concrete, literal, purely-
// pictorial image concept so the generated picture depicts THAT point first,
// the topic second — never a generic topic render. Resilient: any model/parse
// failure falls back to a deterministic point-derived concept (uses the real
// point text), so relevance holds even offline. User text is data-fenced.
//
// SIGNAL EXTRACTION (client escalation #1): before building the concept we mine
// the finalized content block for the 2-4 concrete signals (nouns/actions) the
// point actually teaches, feed them into the prompt, demand the image depict one
// of THEM, and ban generic topic icons (envelope/padlock/hoodie hacker) unless
// the point is literally about them. The deterministic fallback leads with the
// longest concrete signal so relevance holds offline too.

import { fenceUserText, USER_TEXT_RULE } from './prompts/data_fence.js';
import {
  IMAGE_CONCEPT_SYSTEM, IMAGE_CONCEPT_INSTRUCTION, fallbackConcept,
  extractSignals, longestSignal, signalDirective, fallbackConceptWithSignal
} from './prompts/image_concept_prompts.js';
import { normalizeMode } from './art_director.js';

export const AGENT_ID = 'image-concept';
export const skills = ['concept_for_point'];
export { fallbackConcept, extractSignals };

const CTX_STAGE = { pipeline: 'image', stage: 'concept', agent: AGENT_ID, skill: 'concept_for_point' };

function parseConcept(raw) {
  const obj = raw && typeof raw === 'object' ? raw : (() => {
    const s = String(raw ?? '');
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a === -1 || b <= a) return null;
    try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
  })();
  if (obj && typeof obj.concept === 'string' && obj.concept.trim()) return obj.concept.trim();
  return null;
}

// Slot-class rules injected into the concept request so the model produces a
// concept whose complexity matches the slot's visual weight on the canvas.
const SLOT_CLASS_CONCEPT_RULES = {
  accent: 'SLOT CLASS: accent (tiny icon slot). '
    + 'Produce ONE single iconic, minimal subject only — a single recognisable object '
    + 'that symbolises the SPECIFIC signal at a glance (e.g. a magnifying glass over a highlighted address bar). '
    + 'EXPLICITLY FORBIDDEN: busy scenes, multiple subjects, background context, crowds, any setting.',
  card: 'SLOT CLASS: card (medium image slot). '
    + 'Produce ONE clear primary subject with minimal implied context — keep it uncluttered.',
  hero: 'SLOT CLASS: hero (large image slot). '
    + 'Produce a full, rich scene that tells the story of the point completely.'
};

/**
 * A point-relevant image concept for a slot.
 * @param {object} opts
 *   egress      — MaskingEgress (falsy → deterministic fallback)
 *   runId       — pipeline run id
 *   point       — the specific message/point the slot illustrates (string)
 *   block       — optional {text, heading, label} — the FINALIZED content block;
 *                 signals are mined from all three fields. Falls back to `point`.
 *   topics      — string[] poster topics (context, secondary to the point)
 *   visualMode  — art-direction mode (mood)
 *   brief       — optional art-direction brief (lighting/motifs → cohesion)
 *   slotProfile — optional {sizeClass, aspect, position} from slotProfileFor()
 * @returns {Promise<string>} a concrete, zero-text image concept
 */
export async function conceptForPoint({ egress, runId, point, block = null, topics = [], visualMode = 'futuristic', brief = null, slotProfile = null }) {
  const cleanPoint = String(point || '').trim();
  // Signals are mined from the whole block when available (text + heading +
  // label); when only a bare point string is passed, mine it directly.
  const signalSource = block || cleanPoint;
  const signals = extractSignals(signalSource);
  const topSignal = longestSignal(signalSource);
  const fallback = fallbackConceptForProfile(cleanPoint, slotProfile, topSignal);
  if (!cleanPoint) return fallbackConcept('');
  if (!egress || typeof egress.completeText !== 'function' || !runId) return fallback;

  const mood = brief && brief.lighting ? `Mood: ${fenceUserText(brief.lighting)}.` : '';
  const slotClassRule = slotProfile && slotProfile.sizeClass
    ? (SLOT_CLASS_CONCEPT_RULES[slotProfile.sizeClass] || '') : '';
  const signalRule = signalDirective(signals, cleanPoint);
  const user = [
    `Visual mode: ${normalizeMode(visualMode)}.`,
    `THE POINT to illustrate (most important): ${fenceUserText(cleanPoint)}.`,
    signalRule,
    topics.length ? `Overall topic (context, secondary): ${fenceUserText(topics.join(', '))}.` : '',
    mood,
    slotClassRule,
    USER_TEXT_RULE,
    IMAGE_CONCEPT_INSTRUCTION
  ].filter(Boolean).join(' ');

  try {
    const raw = await egress.completeText(
      { system: IMAGE_CONCEPT_SYSTEM, user, maxTokens: 220, temperature: 0.6 },
      { runId, ...CTX_STAGE }
    );
    return parseConcept(raw) || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Deterministic fallback concept, calibrated to the slot's size class and led by
 * the mined signal. Accent slots get a guaranteed iconic-minimal fallback that
 * still names the specific signal; others use the signal-led standard fallback.
 * @param {string} point
 * @param {{sizeClass: string}|null} slotProfile
 * @param {string} [signal] — the longest concrete signal (from longestSignal)
 * @returns {string}
 */
export function fallbackConceptForProfile(point, slotProfile, signal = '') {
  const p = String(point || '').trim();
  const s = String(signal || '').trim();
  if (slotProfile && slotProfile.sizeClass === 'accent') {
    if (s) return `a single iconic, minimal illustration of the specific signal: ${s}`;
    return p
      ? `a single iconic, minimal illustration of: ${p}`
      : 'a single iconic security awareness symbol';
  }
  return fallbackConceptWithSignal(p, s);
}
