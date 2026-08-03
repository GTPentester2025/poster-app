// Image Concept Director Agent (point-relevance, concept v2). Converts the
// specific POINT a slot illustrates (a block's message) into a RICH, concrete,
// purely-pictorial image concept object:
//   {subject, setting, composition, lighting, mood, styleKeywords[], avoid[],
//    concept, slotRole, visualMode}
// so the generated picture depicts THAT point first, the topic second — never a
// generic topic render. The object also stringifies (toString + `concept`) to
// the classic one-sentence concept, so every downstream consumer that treats
// the concept as a string (fenceUserText, deriveAssetTags, needLine) keeps
// working unchanged. Resilient: any model/parse failure falls back to a
// deterministic point-derived rich concept, so relevance holds even offline.
// User text is data-fenced.
//
// SIGNAL EXTRACTION (client escalation #1): before building the concept we mine
// the finalized content block for the 2-4 concrete signals (nouns/actions) the
// point actually teaches, feed them into the prompt, demand the image depict one
// of THEM, and ban generic topic icons (envelope/padlock/hoodie hacker) unless
// the point is literally about them. The deterministic fallback leads with the
// longest concrete signal so relevance holds offline too.

import { fenceUserText, USER_TEXT_RULE } from './prompts/data_fence.js';
import {
  IMAGE_CONCEPT_SYSTEM, IMAGE_CONCEPT_INSTRUCTION_V2, fallbackConcept,
  extractSignals, longestSignal, signalDirective, fallbackConceptWithSignal,
  bannedIconsFor, MODE_CONCEPT_PROFILES, CLICHE_AVOID, BASE_AVOID, fewshotBlock
} from './prompts/image_concept_prompts.js';
import { normalizeMode } from './art_director.js';

export const AGENT_ID = 'image-concept';
export const skills = ['concept_for_point'];
export { fallbackConcept, extractSignals };

const CTX_STAGE = { pipeline: 'image', stage: 'concept', agent: AGENT_ID, skill: 'concept_for_point' };

// ── rich concept object ──────────────────────────────────────────────────────

/**
 * Build the rich concept object. `concept` is the one-sentence summary and the
 * object stringifies to it (non-enumerable toString), so consumers that expect
 * the legacy string contract (template literals, String() coercion) keep
 * working while prompt assembly can read the structured fields.
 */
function makeConcept({ subject, setting, composition, lighting, mood, styleKeywords, avoid, concept, slotRole, visualMode }) {
  const sentence = String(concept || subject || '').trim();
  const obj = {
    subject: String(subject || sentence).trim(),
    setting: String(setting || '').trim(),
    composition: String(composition || '').trim(),
    lighting: String(lighting || '').trim(),
    mood: String(mood || '').trim(),
    styleKeywords: (Array.isArray(styleKeywords) ? styleKeywords : [])
      .map((s) => String(s || '').trim()).filter(Boolean),
    avoid: (Array.isArray(avoid) ? avoid : [])
      .map((s) => String(s || '').trim()).filter(Boolean),
    concept: sentence,
    slotRole: slotRole === 'background' ? 'background' : 'content',
    visualMode: normalizeMode(visualMode)
  };
  Object.defineProperty(obj, 'toString', {
    value: () => obj.concept, enumerable: false
  });
  return obj;
}

// ── deterministic composition per slot profile / role ───────────────────────

const ASPECT_COMPOSITION = {
  wide: 'rule-of-thirds framing — the subject sits off-center with clear negative space beside it',
  tall: 'a centered vertical composition — the subject stands along the central vertical axis',
  square: 'a centered, balanced composition with breathing room around the subject'
};

/** Deterministic composition directive for a slot profile + role. */
export function compositionForProfile(slotProfile, slotRole = 'content') {
  if (slotRole === 'background') {
    return 'detail pushed toward the edges, a calm low-detail center and large areas of negative space so overlaid poster text stays readable; no focal subject dead-center';
  }
  if (slotProfile && slotProfile.sizeClass === 'accent') {
    return 'one single centered iconic subject on a plain background, maximum clarity';
  }
  const aspect = slotProfile && slotProfile.aspect;
  return ASPECT_COMPOSITION[aspect] || ASPECT_COMPOSITION.square;
}

/** The default avoid list for a point: clichés + banned generic topic icons + zero-text. */
function avoidListFor(point) {
  const banned = bannedIconsFor(point);
  const bannedItems = banned ? banned.split(', ').map((b) => `generic ${b} icon`) : [];
  return [...CLICHE_AVOID, ...bannedItems, ...BASE_AVOID];
}

// ── model output parsing ─────────────────────────────────────────────────────

function extractJsonObject(raw) {
  if (raw && typeof raw === 'object') return raw;
  const s = String(raw ?? '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a === -1 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

/**
 * Parse a model concept response. Accepts the v2 rich shape ({subject, ...})
 * and the legacy {concept: string} shape; returns null on junk (→ fallback).
 * Missing fields are filled from the deterministic fallback so the returned
 * concept ALWAYS carries every v2 field.
 */
function parseConcept(raw, fallback) {
  const obj = extractJsonObject(raw);
  if (!obj) return null;
  const subject = typeof obj.subject === 'string' && obj.subject.trim() ? obj.subject.trim() : '';
  const legacy = typeof obj.concept === 'string' && obj.concept.trim() ? obj.concept.trim() : '';
  if (!subject && !legacy) return null;
  const modelAvoid = (Array.isArray(obj.avoid) ? obj.avoid : [])
    .map((s) => String(s || '').trim()).filter(Boolean);
  return makeConcept({
    subject: subject || legacy,
    setting: typeof obj.setting === 'string' && obj.setting.trim() ? obj.setting.trim() : fallback.setting,
    composition: typeof obj.composition === 'string' && obj.composition.trim() ? obj.composition.trim() : fallback.composition,
    lighting: typeof obj.lighting === 'string' && obj.lighting.trim() ? obj.lighting.trim() : fallback.lighting,
    mood: typeof obj.mood === 'string' && obj.mood.trim() ? obj.mood.trim() : fallback.mood,
    styleKeywords: Array.isArray(obj.styleKeywords) && obj.styleKeywords.length ? obj.styleKeywords : fallback.styleKeywords,
    // model avoid list is merged with the baseline zero-text avoids (dedup)
    avoid: [...new Set([...modelAvoid, ...BASE_AVOID])],
    concept: legacy || subject,
    slotRole: fallback.slotRole,
    visualMode: fallback.visualMode
  });
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

// Role rule: background slots want atmosphere, content slots want a concrete subject.
const SLOT_ROLE_RULES = {
  background: 'SLOT ROLE: BACKGROUND. The image sits under poster text — make it atmospheric and LOW-DETAIL, '
    + 'the subject de-emphasized and abstract, with large calm negative space (especially center/top) for text overlay. '
    + 'No focal subject dead-center.',
  content: 'SLOT ROLE: CONTENT. The image illustrates the point — make the subject CONCRETE and instantly '
    + 'recognisable, fresh imagery over stock tropes.'
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
 *   visualMode  — art-direction mode (drives lighting/mood/styleKeywords)
 *   brief       — optional art-direction brief (lighting/motifs → cohesion)
 *   slotProfile — optional {sizeClass, aspect, position} from slotProfileFor()
 *   slotRole    — 'content' (default) | 'background'
 * @returns {Promise<object>} rich concept object (stringifies to the concept sentence)
 */
export async function conceptForPoint({ egress, runId, point, block = null, topics = [], visualMode = 'futuristic', brief = null, slotProfile = null, slotRole = 'content' }) {
  const cleanPoint = String(point || '').trim();
  // Signals are mined from the whole block when available (text + heading +
  // label); when only a bare point string is passed, mine it directly.
  const signalSource = block || cleanPoint;
  const signals = extractSignals(signalSource);
  const topSignal = longestSignal(signalSource);
  const fallback = fallbackConceptForProfile(cleanPoint, slotProfile, topSignal, { visualMode, topics, slotRole });
  if (!cleanPoint) return fallback;
  if (!egress || typeof egress.completeText !== 'function' || !runId) return fallback;

  const mode = normalizeMode(visualMode);
  const mood = brief && brief.lighting ? `Mood: ${fenceUserText(brief.lighting)}.` : '';
  const slotClassRule = slotProfile && slotProfile.sizeClass
    ? (SLOT_CLASS_CONCEPT_RULES[slotProfile.sizeClass] || '') : '';
  const roleRule = SLOT_ROLE_RULES[slotRole === 'background' ? 'background' : 'content'];
  const aspectLine = slotProfile && slotProfile.aspect
    ? `Slot aspect: ${slotProfile.aspect} — composition must be: ${compositionForProfile(slotProfile, slotRole)}.` : '';
  const signalRule = signalDirective(signals, cleanPoint);
  const user = [
    `Visual mode: ${mode}.`,
    `THE POINT to illustrate (most important): ${fenceUserText(cleanPoint)}.`,
    signalRule,
    topics.length ? `Overall topic (context, secondary): ${fenceUserText(topics.join(', '))}.` : '',
    mood,
    roleRule,
    slotClassRule,
    aspectLine,
    fewshotBlock(mode),
    USER_TEXT_RULE,
    IMAGE_CONCEPT_INSTRUCTION_V2
  ].filter(Boolean).join(' ');

  try {
    const raw = await egress.completeText(
      { system: IMAGE_CONCEPT_SYSTEM, user, maxTokens: 400, temperature: 0.6 },
      { runId, ...CTX_STAGE }
    );
    return parseConcept(raw, fallback) || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Deterministic fallback concept, calibrated to the slot's size class / role and
 * led by the mined signal. Returns the RICH concept object (subject, setting,
 * composition, lighting, mood, styleKeywords, avoid, concept) whose string form
 * is unchanged from the legacy sentence, so offline concepts stay both
 * point-relevant AND fully art-directed.
 * @param {string} point
 * @param {{sizeClass: string, aspect?: string}|null} slotProfile
 * @param {string} [signal] — the longest concrete signal (from longestSignal)
 * @param {{visualMode?: string, topics?: string[], slotRole?: string}} [opts]
 * @returns {object} rich concept object
 */
export function fallbackConceptForProfile(point, slotProfile, signal = '', opts = {}) {
  const p = String(point || '').trim();
  const s = String(signal || '').trim();
  const mode = normalizeMode(opts.visualMode);
  const profile = MODE_CONCEPT_PROFILES[mode] || MODE_CONCEPT_PROFILES.futuristic;
  const slotRole = opts.slotRole === 'background' ? 'background' : 'content';
  const isBg = slotRole === 'background';
  const topics = Array.isArray(opts.topics) ? opts.topics.filter(Boolean) : [];

  // Legacy sentence (unchanged wording) — stays the string form of the concept.
  let sentence;
  if (slotProfile && slotProfile.sizeClass === 'accent') {
    if (s) sentence = `a single iconic, minimal illustration of the specific signal: ${s}`;
    else if (p) sentence = `a single iconic, minimal illustration of: ${p}`;
    else sentence = 'a single iconic security awareness symbol';
  } else if (isBg && !p) {
    sentence = topics.length
      ? `an atmospheric, abstract backdrop evoking ${topics[0]}, low detail, generous negative space`
      : 'an atmospheric, abstract poster backdrop with low detail and generous negative space';
  } else {
    sentence = fallbackConceptWithSignal(p, s);
  }

  return makeConcept({
    subject: sentence,
    setting: isBg ? profile.bgSetting : profile.setting,
    composition: compositionForProfile(slotProfile, slotRole),
    lighting: profile.lighting,
    mood: isBg ? `atmospheric, understated — ${profile.mood}` : profile.mood,
    styleKeywords: isBg
      ? [...profile.styleKeywords, 'low detail', 'negative space']
      : profile.styleKeywords,
    avoid: isBg
      ? [...avoidListFor(p), 'busy focal subjects', 'high-detail clutter in the center']
      : avoidListFor(p),
    concept: sentence,
    slotRole,
    visualMode: mode
  });
}
