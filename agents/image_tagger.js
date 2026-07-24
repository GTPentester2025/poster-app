// Image Tagger Agent (vision — manual enrichment, autotag route). Examines a
// stored library image and suggests metadata for the security-awareness image
// library: topics, style, format, a vivid one-sentence description, and 5-8
// precise lowercase tags. Used ONLY for MANUAL enrichment (the autotag route and
// the --vision backfill flag) — NEW generations derive description+tags
// deterministically without this model call (see store.deriveAssetTags).
//
// Fails soft: no egress / unparseable output / any error → null suggestion, so
// the caller keeps whatever metadata already exists.

import { tryParseJson } from '#orchestration';

export const AGENT_ID = 'image-tagger';
export const skills = ['classify_image'];

const CTX_STAGE = { pipeline: 'image', stage: 'autotag', agent: AGENT_ID, skill: 'classify_image' };

export const TAGGER_PROMPT =
  'Examine this image and suggest metadata for a security-awareness image library. '
  + 'Respond ONLY with JSON of this exact shape: '
  + '{"topics": ["topic1", "topic2"], "style": "flat-icon|illustration|comic|photo", '
  + '"format": "icon|illustration|background|photo", '
  + '"description": "one vivid sentence describing exactly what the image depicts", '
  + '"tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]}. '
  + 'topics = security-awareness themes visible in or suggested by the image. '
  + 'tags = 5-8 precise lowercase tags (concrete objects, actions, and signals shown). '
  + 'No markdown fences, no commentary.';

/**
 * Normalize a raw tagger verdict into a clean suggestion object, or null.
 * @param {object|string} raw
 * @returns {{topics:string[], style?:string, format?:string, description?:string, tags?:string[]}|null}
 */
export function parseTagSuggestion(raw) {
  const obj = raw && typeof raw === 'object' ? raw : tryParseJson(String(raw ?? ''));
  if (!obj || !Array.isArray(obj.topics)) return null;
  const out = { topics: obj.topics.map((t) => String(t)).filter(Boolean) };
  if (typeof obj.style === 'string') out.style = obj.style;
  if (typeof obj.format === 'string') out.format = obj.format;
  if (typeof obj.description === 'string' && obj.description.trim()) out.description = obj.description.trim();
  if (Array.isArray(obj.tags)) {
    out.tags = obj.tags.map((t) => String(t).toLowerCase().trim()).filter((t) => t.length >= 2).slice(0, 8);
  }
  return out;
}

/**
 * Classify an image with a vision model (manual enrichment).
 * @param {object} opts
 *   egress      — MaskingEgress (falsy → null)
 *   runId       — pipeline run id
 *   imageBase64 — the stored image
 *   mediaType   — 'image/png' | 'image/jpeg'
 * @returns {Promise<object|null>} suggestion, or null on any failure.
 */
export async function tagImage({ egress, runId, imageBase64, mediaType = 'image/png' }) {
  if (!egress || typeof egress.completeVision !== 'function' || !runId) return null;
  try {
    const raw = await egress.completeVision(
      { prompt: TAGGER_PROMPT, imageBase64, mediaType },
      { runId, ...CTX_STAGE }
    );
    return parseTagSuggestion(raw);
  } catch {
    return null;
  }
}
