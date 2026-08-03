// Asset Recommender Agent (client #3b — the dedupe engine). Given the NEED for a
// new image slot and a pre-filtered shortlist of existing library assets, it
// recommends the ONE existing asset to REUSE (zero image-gen calls) or null.
// ONE cheap model call over the TOP-20 candidates.
//
// v2 — weighted deterministic scoring replaces shallow keyword overlap:
//   topicScore   (45%)  concept subject+styleKeywords+topic tokens vs image `topics`
//   styleScore   (20%)  concept styleKeywords/mood vs image `style`
//   paletteScore (15%)  image palette hexes vs brand palette hexes (nearest hue)
//   recency      (10%)  newer created_at wins (linear decay over ~90 days)
//   learningBoost(10%)  learning rows (kind='approval') mentioning the image topics
// Hard filter: zero_text_passed must be truthy (rows without the field pass —
// the pipeline prefilter already guarantees the gate). A best score below
// GENERATE_SCORE_THRESHOLD (0.45) returns imageId:null ("generate fresh") —
// the pipeline's existing mechanism (null / sub-0.75 confidence → fresh
// generation) then regenerates instead of shipping a weak library match.
// Deterministic fallback (no egress / parse error / any failure): an exact
// conceptHash match, else the weighted score. Only a recommendation with
// confidence >= RECOMMEND_CONFIDENCE_THRESHOLD (0.75) is honored by the
// pipeline. User/candidate text is data-fenced.

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

// ── v2 weighted scoring ──────────────────────────────────────────────────────

/** Below this weighted score a library match is too weak — generate fresh. */
export const GENERATE_SCORE_THRESHOLD = 0.45;

const SCORE_WEIGHTS = { topic: 0.45, style: 0.20, palette: 0.15, recency: 0.10, learning: 0.10 };
const RECENCY_WINDOW_DAYS = 90;

// Small stopword set for tokenizing concepts/topics (keep content words only).
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'by', 'for',
  'with', 'from', 'as', 'to', 'is', 'are', 'was', 'were', 'be', 'been', 'it',
  'its', 'this', 'that', 'these', 'those', 'over', 'under', 'into', 'about',
  'your', 'you', 'their', 'they', 'not', 'no', 'any', 'all', 'one'
]);

/** Lowercase word tokens with punctuation stripped and stopwords dropped. */
function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

/** Jaccard-ish overlap of two token sets: |A ∩ B| / min(|A|, |B|). */
function overlapScore(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / Math.min(a.size, b.size);
}

/** Tokens from the image's `topics` metadata (CSV string, JSON array, or array). */
function imageTopicTokens(image) {
  let topics = image && image.topics;
  if (typeof topics === 'string') {
    try {
      const parsed = JSON.parse(topics);
      topics = Array.isArray(parsed) ? parsed : topics;
    } catch { /* plain CSV string — tokenize as-is */ }
  }
  const raw = Array.isArray(topics) ? topics.join(' ') : String(topics || '');
  return tokenize(raw);
}

/** Tokens describing the NEED: concept subject + styleKeywords + topic(s). */
function needTopicTokens(need) {
  const n = need || {};
  const c = n.concept;
  const parts = [];
  if (c && typeof c === 'object') {
    parts.push(c.subject || '', (Array.isArray(c.styleKeywords) ? c.styleKeywords.join(' ') : ''));
  } else if (c) {
    parts.push(String(c));
  }
  if (Array.isArray(n.topics)) parts.push(n.topics.join(' '));
  else if (n.topic) parts.push(String(n.topic));
  if (!parts.some(Boolean) && n.point) parts.push(String(n.point));
  return tokenize(parts.join(' '));
}

/** Tokens for the NEED's style: concept styleKeywords + mood. */
function needStyleTokens(need) {
  const c = need && need.concept;
  if (c && typeof c === 'object') {
    return tokenize([
      Array.isArray(c.styleKeywords) ? c.styleKeywords.join(' ') : '',
      c.mood || ''
    ].join(' '));
  }
  return [];
}

// ── palette (nearest hue) ────────────────────────────────────────────────────

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  return {
    r: parseInt(m[1].slice(0, 2), 16),
    g: parseInt(m[1].slice(2, 4), 16),
    b: parseInt(m[1].slice(4, 6), 16)
  };
}

/** {hue (0-360), achromatic, lightness (0-1)} for a hex, or null when invalid. */
function hexToHue(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 0.08) return { hue: 0, achromatic: true, lightness: (max + min) / 2 };
  let hue;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  return { hue, achromatic: false, lightness: (max + min) / 2 };
}

/** Similarity of two hexes: hue proximity for chromatic pairs, lightness for grays. */
function hexSimilarity(a, b) {
  const ha = hexToHue(a);
  const hb = hexToHue(b);
  if (!ha || !hb) return 0;
  if (ha.achromatic && hb.achromatic) return 1 - Math.abs(ha.lightness - hb.lightness);
  if (ha.achromatic || hb.achromatic) return 0.3; // gray vs color: weak match
  const d = Math.abs(ha.hue - hb.hue);
  const dist = Math.min(d, 360 - d);
  return 1 - dist / 180;
}

/** Collect hex strings from palette metadata (array of hexes or {key: hex}). */
function paletteHexes(palette) {
  if (!palette) return [];
  const values = Array.isArray(palette) ? palette : Object.values(palette);
  return values.filter((v) => typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v.trim()));
}

/** Average best-hue match of the image's palette against the brand palette. */
function paletteMatchScore(imagePalette, brandPalette) {
  const imgHexes = paletteHexes(imagePalette);
  const brandHexesList = paletteHexes(brandPalette);
  if (!imgHexes.length || !brandHexesList.length) return 0;
  let sum = 0;
  for (const ih of imgHexes) {
    let best = 0;
    for (const bh of brandHexesList) best = Math.max(best, hexSimilarity(ih, bh));
    sum += best;
  }
  return sum / imgHexes.length;
}

/** Linear recency decay: today → 1, RECENCY_WINDOW_DAYS+ old → 0. */
function recencyScore(createdAt, now) {
  const t = Date.parse(createdAt || '');
  if (!Number.isFinite(t)) return 0;
  const ageDays = Math.max(0, (now - t) / 86400000);
  return Math.max(0, 1 - ageDays / RECENCY_WINDOW_DAYS);
}

/** 1 when any approval learning row mentions the image's topic keywords, else 0. */
function learningBoost(image, learningRows) {
  const rows = (Array.isArray(learningRows) ? learningRows : [])
    .filter((r) => r && (r.kind === undefined || r.kind === 'approval'));
  if (!rows.length) return 0;
  const imgTokens = new Set(imageTopicTokens(image));
  if (!imgTokens.size) return 0;
  for (const row of rows) {
    const rowTokens = tokenize([row.topic, row.angle, row.detail].filter(Boolean).join(' '));
    if (rowTokens.some((t) => imgTokens.has(t))) return 1;
  }
  return 0;
}

/**
 * Weighted v2 score of one candidate image against the need.
 * @param {object} need  — {point, concept (string|rich object), topic|topics, ...}
 * @param {object} image — candidate row: {imageId, topics?, style?, palette?, created_at?, ...}
 * @param {object} [opts] — {brandPalette, learningRows, now}
 * @returns {{score: number, breakdown: object}}
 */
export function scoreCandidate(need, image, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const topicScore = overlapScore(needTopicTokens(need), imageTopicTokens(image));
  const styleScore = overlapScore(needStyleTokens(need), tokenize(image && image.style));
  const paletteScore = paletteMatchScore(image && image.palette, opts.brandPalette);
  const recency = recencyScore(image && image.created_at, now);
  const learning = learningBoost(image, opts.learningRows);
  const score =
    SCORE_WEIGHTS.topic * topicScore +
    SCORE_WEIGHTS.style * styleScore +
    SCORE_WEIGHTS.palette * paletteScore +
    SCORE_WEIGHTS.recency * recency +
    SCORE_WEIGHTS.learning * learning;
  return {
    score: Math.round(score * 1000) / 1000,
    breakdown: { topicScore, styleScore, paletteScore, recency, learningBoost: learning }
  };
}

/**
 * Score + sort candidates (best first). Each entry gains {score, breakdown}.
 * @returns {object[]}
 */
export function rankCandidates(need, candidates, opts = {}) {
  return (Array.isArray(candidates) ? candidates : [])
    .map((c) => ({ ...c, ...scoreCandidate(need, c, opts) }))
    .sort((a, b) => b.score - a.score);
}

/** True when the candidate carries any metadata the v2 scorer can use. */
function isScoreable(candidate) {
  return Boolean(candidate && (candidate.topics || candidate.style || candidate.created_at || candidate.palette));
}

// ── model plumbing ───────────────────────────────────────────────────────────

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
 * Deterministic v2 recommendation: exact conceptHash first (confidence 1), then
 * the weighted score. A best score below GENERATE_SCORE_THRESHOLD returns
 * imageId:null so the pipeline generates a fresh asset instead of reusing a
 * weak match.
 */
function scoredRecommendation(need, candidates, opts) {
  const hashHit = fallbackRecommendation(need, candidates);
  if (hashHit.imageId) return hashHit;
  const ranked = rankCandidates(need, candidates, opts);
  const best = ranked[0];
  if (!best) return { imageId: null, confidence: 0, reason: 'no candidates' };
  if (best.score >= GENERATE_SCORE_THRESHOLD) {
    return {
      imageId: best.imageId, confidence: best.score,
      reason: `weighted score ${best.score} (topic/style/palette/recency/learning)`,
      scores: best.breakdown
    };
  }
  return {
    imageId: null, confidence: best.score, action: 'generate',
    reason: `best weighted score ${best.score} below ${GENERATE_SCORE_THRESHOLD} — generate a fresh asset`
  };
}

/**
 * Recommend an existing asset to reuse for a slot's need.
 * @param {object} opts
 *   egress       — MaskingEgress (falsy → deterministic weighted scoring)
 *   runId        — pipeline run id
 *   need         — {point, concept (string | rich concept object), treatment,
 *                   sizeClass, paletteWord, topic?/topics?, conceptHash?}
 *   candidates   — SQL-prefiltered top-N: [{imageId, description, tags,
 *                   conceptHash?, topics?, style?, palette?, created_at?,
 *                   zero_text_passed?}] — richer fields feed the v2 scorer
 *   brandPalette — optional brand palette ({primary, accent, ...} or hex[])
 *   learningRows — optional learning rows [{kind, topic, angle?, detail, weight?}]
 *   db           — optional better-sqlite3 handle: approval learning rows are
 *                  read from it when learningRows is not supplied
 *   now          — optional epoch ms for recency (tests)
 * @returns {Promise<{imageId: string|null, confidence: number, reason: string}>}
 */
export async function recommendAsset({ egress, runId, need, candidates = [], brandPalette = null, learningRows = null, db = null, now = Date.now() }) {
  const list = (Array.isArray(candidates) ? candidates : []).slice(0, MAX_CANDIDATES)
    // HARD FILTER: zero_text_passed must be truthy. Rows that don't carry the
    // field (the pipeline prefilter already applied the gate) pass through.
    .filter((c) => c && (c.zero_text_passed === undefined || c.zero_text_passed));

  if (!list.length) return { imageId: null, confidence: 0, reason: 'no candidates' };

  // Learning rows: prefer the explicit array; else read approvals from the db.
  let learning = Array.isArray(learningRows) ? learningRows : [];
  if (!learning.length && db && typeof db.prepare === 'function') {
    try {
      learning = db.prepare("SELECT kind, topic, angle, detail, weight FROM learning WHERE kind = 'approval'").all();
    } catch { learning = []; }
  }
  const scoreOpts = { brandPalette, learningRows: learning, now };

  // No egress → deterministic weighted recommendation.
  if (!egress || typeof egress.completeText !== 'function' || !runId) {
    return scoredRecommendation(need, list, scoreOpts);
  }

  const validIds = new Set(list.map((c) => c && c.imageId).filter(Boolean));
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
    if (!rec) return scoredRecommendation(need, list, scoreOpts);
    // v2 guard: when the picked candidate carries scoreable metadata and its
    // weighted score is below the generate threshold, the match is too weak —
    // return null (→ the pipeline generates fresh) instead of a weak reuse.
    if (rec.imageId) {
      const picked = list.find((c) => c.imageId === rec.imageId);
      if (picked && isScoreable(picked)) {
        const { score, breakdown } = scoreCandidate(need, picked, scoreOpts);
        if (score < GENERATE_SCORE_THRESHOLD) {
          return {
            imageId: null, confidence: Math.min(rec.confidence, score), action: 'generate',
            reason: `model pick scored ${score} below ${GENERATE_SCORE_THRESHOLD} — generate a fresh asset`,
            scores: breakdown
          };
        }
      }
    }
    return rec;
  } catch {
    return scoredRecommendation(need, list, scoreOpts);
  }
}
