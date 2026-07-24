// Background Reviewer Agent (Phase F). Reviews a RENDERED poster background for
// craft, correct treatment, and — most importantly — text legibility (a calm
// center/top). Soft gate that FAILS OPEN: no egress, unparseable output, or any
// error → accepted, so a best-effort quality nudge never blocks a poster. A
// confident low score returns 'rework' with the critique for a regenerate.

import { tryParseJson } from '#orchestration';
import { backgroundReviewPrompt } from './prompts/background_prompts.js';

export const AGENT_ID = 'background-reviewer';
export const skills = ['review_background'];
export const BACKGROUND_THRESHOLD = 70;

const CTX_STAGE = { pipeline: 'image', stage: 'background-review', agent: AGENT_ID, skill: 'review_background' };
const PASS = { status: 'accepted', score: 100, feedback: '' };

function parseVerdict(raw) {
  const obj = raw && typeof raw === 'object' ? raw : tryParseJson(String(raw ?? ''));
  if (obj && Number.isFinite(Number(obj.score))) {
    return { score: Math.max(0, Math.min(100, Number(obj.score))), issues: typeof obj.issues === 'string' ? obj.issues : '' };
  }
  return null;
}

/** Classify a rework verdict as a palette violation when the issue names palette. */
function isPaletteIssue(issues) {
  return typeof issues === 'string' && /\bpalette\b|off-?palette|off-?brand/i.test(issues);
}

/**
 * Review a rendered background image.
 * @param {{egress, runId, imageBase64, treatment, palette?, mediaType?}} opts
 *   palette — poster brand palette; adds a HARD palette-adherence criterion (Job D)
 * @returns {Promise<{status:'accepted'|'rework', score:number, feedback:string, reason?:string}>}
 */
export async function reviewBackground({ egress, runId, imageBase64, treatment = 'image', palette = null, mediaType = 'image/png' }) {
  if (!egress || typeof egress.completeVision !== 'function' || !runId) return PASS;
  try {
    const raw = await egress.completeVision(
      { prompt: backgroundReviewPrompt(treatment, palette), imageBase64, mediaType },
      { runId, ...CTX_STAGE }
    );
    const v = parseVerdict(raw);
    if (!v) return PASS;
    if (v.score >= BACKGROUND_THRESHOLD) return { status: 'accepted', score: v.score, feedback: '' };
    const verdict = {
      status: 'rework',
      score: v.score,
      feedback: v.issues || `background score ${v.score} below ${BACKGROUND_THRESHOLD} — calmer center for text, stronger craft`
    };
    if (isPaletteIssue(v.issues)) verdict.reason = 'palette';
    return verdict;
  } catch {
    return PASS;
  }
}
