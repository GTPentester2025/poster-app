// Art Director Agent (Phase B). Produces ONE Art Direction Brief per poster from
// its topic + chosen visual mode. Every image prompt (background + slots) then
// derives from this brief, so a poster's imagery reads as a single cohesive,
// premium, high-tech set instead of unrelated illustrations. Fully resilient:
// any model/parse failure falls back to a deterministic per-mode brief, so the
// pipeline never blocks on art direction. User text is data-fenced.

import { fenceUserText, USER_TEXT_RULE } from './prompts/data_fence.js';
import {
  ART_DIRECTOR_SYSTEM, BRIEF_JSON_INSTRUCTION, MODE_FALLBACK, VISUAL_MODES, DEFAULT_VISUAL_MODE
} from './prompts/art_director_prompts.js';

export const AGENT_ID = 'art-director';
export const skills = ['direct_art'];
export { VISUAL_MODES, DEFAULT_VISUAL_MODE, MODE_FALLBACK };

const CTX_STAGE = { pipeline: 'design', stage: 'art-direction', agent: AGENT_ID, skill: 'direct_art' };

/** Normalize an arbitrary mode string to a supported visual mode. */
export function normalizeMode(mode) {
  const m = String(mode || '').toLowerCase();
  return VISUAL_MODES.includes(m) ? m : DEFAULT_VISUAL_MODE;
}

/** Art-direction palette derived from the brand palette for a mode. */
function brandArtPalette(mode, palette = {}) {
  if (mode === 'editorial') {
    return { base: palette.background || '#F5F0E8', accent: palette.primary || '#E3AF32', glow: palette.accent || '#C8102E', ink: palette.dark || '#1F1A17' };
  }
  // futuristic / holographic: dark base, brand accent, neon glow, light ink
  return { base: '#0D0C12', accent: palette.primary || '#E3AF32', glow: palette.accent || '#22D3EE', ink: '#F4F1EA' };
}

/** True when x is a complete, well-typed brief body (lighting/texture/bg/slot). */
function isBriefBody(x) {
  return x && typeof x === 'object'
    && typeof x.lighting === 'string' && x.lighting.trim()
    && Array.isArray(x.texture) && x.texture.length >= 2 && x.texture.every((t) => typeof t === 'string' && t.trim())
    && typeof x.backgroundConcept === 'string' && x.backgroundConcept.trim()
    && typeof x.slotDirective === 'string' && x.slotDirective.trim();
}

/** Extract the first JSON object from a model text response, or null. */
function parseFirstJson(text) {
  const s = String(text ?? '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(s.slice(start, end + 1)); } catch { return null; }
}

/** Assemble a validated brief from a body + mode + palette. */
function makeBrief(body, mode, palette) {
  return {
    mode,
    palette: brandArtPalette(mode, palette),
    lighting: body.lighting,
    texture: body.texture.slice(0, 4),
    backgroundConcept: body.backgroundConcept,
    slotDirective: body.slotDirective
  };
}

/**
 * Produce an Art Direction Brief for a poster.
 * @param {object} opts
 *   egress        — MaskingEgress (omit / falsy → deterministic fallback)
 *   runId         — pipeline run id
 *   topics        — string[] poster topics
 *   contentShape  — content shape hint (e.g. 'red-flags')
 *   visualMode    — 'futuristic' | 'holographic' | 'editorial'
 *   palette       — brand palette {primary, accent, background, dark}
 * @returns {Promise<Brief>} {mode, palette:{base,accent,glow,ink}, lighting, texture[], backgroundConcept, slotDirective}
 */
export async function directArt({ egress, runId, topics = [], contentShape = '', visualMode = DEFAULT_VISUAL_MODE, palette = {} }) {
  const mode = normalizeMode(visualMode);
  const fallback = makeBrief(MODE_FALLBACK[mode], mode, palette);

  // No egress (tests / offline) → deterministic, valid brief. Never blocks.
  if (!egress || typeof egress.completeText !== 'function' || !runId) return fallback;

  const topicLine = topics.length ? fenceUserText(topics.join(', ')) : fenceUserText('workplace security awareness');
  const shapeLine = contentShape ? fenceUserText(String(contentShape)) : '';
  const user = [
    `Visual mode: ${mode}.`,
    `Poster topic: ${topicLine}.`,
    shapeLine ? `Content shape: ${shapeLine}.` : '',
    USER_TEXT_RULE,
    BRIEF_JSON_INSTRUCTION
  ].filter(Boolean).join(' ');

  try {
    const raw = await egress.completeText(
      { system: ART_DIRECTOR_SYSTEM, user, maxTokens: 500, temperature: 0.5 },
      { runId, ...CTX_STAGE }
    );
    const body = typeof raw === 'string' ? parseFirstJson(raw) : (raw && typeof raw === 'object' ? raw : null);
    if (isBriefBody(body)) return makeBrief(body, mode, palette);
  } catch { /* model/parse failure → fall through to the deterministic brief */ }
  return fallback;
}
