// Image Zero-Text Gate Agent (spec §B.7 hard rule): uses vision to check
// whether any text, letters, numbers, or typography appears in an image.
// Returns a gate verdict compatible with GateEngine.check() verdicts arrays
// (gate 'imageZeroText', threshold 100 — pass is all-or-nothing).
//
// Parsing: the real egress returns the model's text; tryParseJson strips
// markdown fences. One repair re-request on unparseable output, then fail
// SAFE — an unverifiable image is treated as containing text.

import { tryParseJson } from '#orchestration';

export const AGENT_ID = 'image-text-gate';
export const skills = ['detect_embedded_text', 'reject_asset'];

const VISION_PROMPT =
  'Examine this image carefully for ANY embedded text, letters, numbers, words, ' +
  'typography, watermarks, signage, labels, captions, or symbols that resemble letters. ' +
  'Respond ONLY with a JSON object in this exact shape: ' +
  '{"hasText": boolean, "details": "what text appears and where if any, or \'no text or letters visible\' if none"}. ' +
  'Do not include markdown fences, commentary, or any text outside the JSON object.';

const CTX_STAGE = { pipeline: 'image', stage: 'zero-text-gate', agent: AGENT_ID, skill: 'detect_embedded_text' };

const EXPECTED = 'An image with absolutely no text, letters, numbers, or typography';

/**
 * Parse a vision response into {hasText, details}. Accepts an already-parsed
 * object (test doubles) or a raw model string (real egress).
 */
function parseVisionResponse(raw) {
  const obj = raw && typeof raw === 'object' ? raw : tryParseJson(String(raw ?? ''));
  if (obj && typeof obj.hasText === 'boolean') {
    return { hasText: obj.hasText, details: typeof obj.details === 'string' ? obj.details : '' };
  }
  return null;
}

/**
 * Check an image for embedded text (the zero-text gate).
 *
 * @param {{egress: object, runId: string, imageBase64: string}} opts
 * @returns {Promise<{status:'accepted'|'rejected', score:0|100, feedback:string, expected:string}>}
 */
export async function checkZeroText({ egress, runId, imageBase64, mediaType = 'image/png' }) {
  const ctx = { runId, ...CTX_STAGE };
  const raw = await egress.completeVision({
    prompt: VISION_PROMPT,
    imageBase64,
    mediaType
  }, ctx);

  let parsed = parseVisionResponse(raw);

  if (!parsed) {
    // One repair attempt: re-request with a reminder
    const raw2 = await egress.completeVision({
      prompt: `${VISION_PROMPT}\n\nYour previous response was not valid JSON. Respond ONLY with the JSON object, no markdown, no commentary.`,
      imageBase64,
      mediaType
    }, ctx);
    parsed = parseVisionResponse(raw2);
  }

  // Still unparseable → fail safe: treat as having text (conservative)
  if (!parsed) {
    return {
      status: 'rejected',
      score: 0,
      feedback: 'Vision model returned an unparseable response — treating as rejected (conservative fail-safe)',
      expected: EXPECTED
    };
  }

  if (parsed.hasText) {
    return {
      status: 'rejected',
      score: 0,
      feedback: `Image contains text: ${parsed.details || 'unspecified text detected'}`,
      expected: EXPECTED
    };
  }
  return { status: 'accepted', score: 100, feedback: '', expected: '' };
}
