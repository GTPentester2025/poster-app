// Image Aesthetic QA Agent (Phase D). Scores a generated image's craft +
// on-brief adherence with a vision model, AFTER the zero-text gate passes.
// Fails OPEN: no egress, an unparseable verdict, or any error → accepted, so a
// best-effort quality nudge never blocks a poster. A confident score below
// AESTHETIC_THRESHOLD returns 'rework' with the model's own critique, which the
// image pipeline feeds back into a regenerate attempt.

import { tryParseJson } from '#orchestration';
import { AESTHETIC_THRESHOLD, aestheticPrompt } from './prompts/image_quality_prompts.js';

export const AGENT_ID = 'image-quality-reviewer';
export const skills = ['review_aesthetics'];
export { AESTHETIC_THRESHOLD };

const CTX_STAGE = { pipeline: 'image', stage: 'aesthetic-gate', agent: AGENT_ID, skill: 'review_aesthetics' };

const PASS = { status: 'accepted', score: 100, feedback: '' };

/** Parse a vision verdict {score, issues} from a parsed object or raw string. */
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
 * Review a generated image's aesthetics.
 * @param {object} opts
 *   egress    — MaskingEgress (falsy → accepted, fail-open)
 *   runId     — pipeline run id
 *   imageBase64 — the generated image
 *   brief     — art-direction brief (optional; sharpens the judgement)
 *   slotRole  — 'foreground' | 'background'
 *   palette   — poster brand palette {primary, accent, background, dark} — adds a
 *               HARD palette-adherence criterion (Job D); off-palette dominant
 *               hues score ≤50 with reason 'palette'
 * @returns {Promise<{status:'accepted'|'rework', score:number, feedback:string, reason?:string}>}
 */
export async function reviewImage({ egress, runId, imageBase64, brief = null, slotRole = 'foreground', point = '', palette = null, mediaType = 'image/png' }) {
  if (!egress || typeof egress.completeVision !== 'function' || !runId) return PASS;
  try {
    const raw = await egress.completeVision(
      { prompt: aestheticPrompt(brief, slotRole, point, palette), imageBase64, mediaType },
      { runId, ...CTX_STAGE }
    );
    const v = parseVerdict(raw);
    if (!v) return PASS; // can't judge → fail open
    if (v.score >= AESTHETIC_THRESHOLD) return { status: 'accepted', score: v.score, feedback: '' };
    const verdict = {
      status: 'rework',
      score: v.score,
      feedback: v.issues || `aesthetic score ${v.score} below ${AESTHETIC_THRESHOLD} — improve craft, depth, and high-tech finish`
    };
    if (isPaletteIssue(v.issues)) verdict.reason = 'palette';
    return verdict;
  } catch {
    return PASS; // any vision error → fail open, never block the poster
  }
}
