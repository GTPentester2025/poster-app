// Asset Recommender prompts (client #3b — the dedupe engine). Given the NEED for
// a new image slot (its point, derived concept, treatment, size class, palette
// word) and a shortlist of existing library assets (each with a description +
// tags), the model picks the ONE existing asset that would satisfy the need well
// enough to reuse instead of generating fresh — or null when none fits. Only a
// recommendation with confidence >= 0.75 is honored by the pipeline.

export const RECOMMEND_CONFIDENCE_THRESHOLD = 0.75;

export const ASSET_RECOMMENDER_SYSTEM =
  'You are the reuse engine for a premium security-awareness poster image library. '
  + 'Your job is to avoid regenerating an image when an EXISTING library asset already depicts the same '
  + 'specific signal well enough to reuse. You are given the NEED for one image slot and a shortlist of '
  + 'candidate assets (each with a one-sentence description and tags). Pick the SINGLE best candidate to '
  + 'REUSE, or null when none is a strong match. Reuse only when the candidate depicts the SAME concrete '
  + 'signal/action AND fits the treatment, size class, and palette — not merely the same broad topic. '
  + 'Be conservative: a weak or merely-topical match must score low confidence so the pipeline generates fresh. '
  + 'Respond with ONLY minified JSON.';

export const ASSET_RECOMMENDER_INSTRUCTION =
  'Return ONLY JSON of this exact shape (no prose, no code fences): '
  + '{"imageId": string|null, "confidence": number, "reason": string}. '
  + 'imageId = the chosen candidate\'s imageId, or null when none is a strong reuse. '
  + 'confidence = 0..1 — how confident you are that reusing this asset satisfies the need as well as a fresh '
  + 'generation would. reason = one short sentence. Only matches on the SAME specific signal + compatible '
  + 'treatment/size/palette deserve confidence >= 0.75; topical-only overlaps must stay below it.';

/** Compact one-line rendering of the NEED for the prompt. */
export function needLine(need) {
  const n = need || {};
  const parts = [];
  if (n.point) parts.push(`point: "${n.point}"`);
  if (n.concept) parts.push(`concept: "${n.concept}"`);
  if (n.treatment) parts.push(`treatment: ${n.treatment}`);
  if (n.sizeClass) parts.push(`sizeClass: ${n.sizeClass}`);
  if (n.paletteWord) parts.push(`palette: ${n.paletteWord}`);
  return parts.join('; ');
}

/** Compact rendering of the candidate shortlist for the prompt. */
export function candidatesBlock(candidates) {
  return (Array.isArray(candidates) ? candidates : []).map((c, i) => {
    const tags = Array.isArray(c.tags) ? c.tags.join(', ') : '';
    return `${i + 1}. imageId=${c.imageId} | ${String(c.description || '').slice(0, 200)} | tags: ${tags}`;
  }).join('\n');
}
