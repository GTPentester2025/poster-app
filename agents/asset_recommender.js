// Asset Recommender Agent (client #3b — the dedupe engine). Given the NEED for a
// new image slot and a pre-filtered shortlist of existing library assets, it
// recommends the ONE existing asset to REUSE (zero image-gen calls) or null.
// ONE cheap model call over the TOP-20 candidates. Deterministic fallback (no
// egress / parse error / any failure): an exact conceptHash match, else null.
// Only a recommendation with confidence >= RECOMMEND_CONFIDENCE_THRESHOLD (0.75)
// is honored by the pipeline. User/candidate text is data-fenced.

import { fenceUserText, USER_TEXT_RULE } from './prompts/data_fence.js';
import {
  ASSET_RECOMMENDER_SYSTEM, ASSET_RECOMMENDER_INSTRUCTION,
  RECOMMEND_CONFIDENCE_THRESHOLD, needLine, candidatesBlock
} from './prompts/asset_recommender_prompts.js';

export const AGENT_ID = 'asset-recommender';
export const skills = ['recommend_asset'];
export { RECOMMEND_CONFIDENCE_THRESHOLD };

const CTX_STAGE = { pipeline: 'image', stage: 'asset-recommend', agent: AGENT_ID, skill: 'recommend_asset' };

// Cap the shortlist handed to the model (cost control). The SQL prefilter should
// already trim to a tag-overlap-ranked top-N; we hard-cap at 20 defensively.
const MAX_CANDIDATES = 20;

function parseRecommendation(raw, validIds) {
  const obj = raw && typeof raw === 'object' ? raw : (() => {
    const s = String(raw ?? '');
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a === -1 || b <= a) return null;
    try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
  })();
  if (!obj) return null;
  const imageId = (obj.imageId === null || typeof obj.imageId === 'string') ? obj.imageId : null;
  const confidence = Number.isFinite(Number(obj.confidence)) ? Math.max(0, Math.min(1, Number(obj.confidence))) : 0;
  const reason = typeof obj.reason === 'string' ? obj.reason : '';
  // Guard against hallucinated ids: an imageId must be one of the candidates.
  if (imageId && !validIds.has(imageId)) return { imageId: null, confidence: 0, reason: 'model returned unknown imageId' };
  return { imageId, confidence, reason };
}

/**
 * Deterministic fallback: an exact conceptHash match among the candidates, else
 * null. A hash hit is a certain reuse (confidence 1); anything else is null.
 * @param {object} need — may carry conceptHash
 * @param {object[]} candidates — may carry conceptHash
 * @returns {{imageId: string|null, confidence: number, reason: string}}
 */
export function fallbackRecommendation(need, candidates) {
  const hash = need && need.conceptHash;
  if (hash) {
    const hit = (candidates || []).find((c) => c && c.conceptHash === hash);
    if (hit) return { imageId: hit.imageId, confidence: 1, reason: 'exact conceptHash match' };
  }
  return { imageId: null, confidence: 0, reason: 'no deterministic match' };
}

/**
 * Recommend an existing asset to reuse for a slot's need.
 * @param {object} opts
 *   egress     — MaskingEgress (falsy → deterministic fallback)
 *   runId      — pipeline run id
 *   need       — {point, concept, treatment, sizeClass, paletteWord, conceptHash?}
 *   candidates — [{imageId, description, tags, conceptHash?}] — SQL-prefiltered top-N
 * @returns {Promise<{imageId: string|null, confidence: number, reason: string}>}
 */
export async function recommendAsset({ egress, runId, need, candidates = [] }) {
  const list = (Array.isArray(candidates) ? candidates : []).slice(0, MAX_CANDIDATES);
  const validIds = new Set(list.map((c) => c && c.imageId).filter(Boolean));

  // No candidates → nothing to reuse. No egress → deterministic fallback.
  if (!list.length) return { imageId: null, confidence: 0, reason: 'no candidates' };
  if (!egress || typeof egress.completeText !== 'function' || !runId) {
    return fallbackRecommendation(need, list);
  }

  const user = [
    `NEED for this image slot: ${fenceUserText(needLine(need))}.`,
    'CANDIDATE assets (reuse one of these, or return null):',
    fenceUserText(candidatesBlock(list)),
    USER_TEXT_RULE,
    ASSET_RECOMMENDER_INSTRUCTION
  ].join('\n');

  try {
    const raw = await egress.completeText(
      { system: ASSET_RECOMMENDER_SYSTEM, user, maxTokens: 160, temperature: 0.2 },
      { runId, ...CTX_STAGE }
    );
    const rec = parseRecommendation(raw, validIds);
    if (!rec) return fallbackRecommendation(need, list);
    return rec;
  } catch {
    return fallbackRecommendation(need, list);
  }
}
