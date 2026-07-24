// Keyword/Intent Agent (spec §B.3): semantic expansion of the user's poster
// prompt + content-shape detection. All model traffic goes through the
// injected egress (no SDK imports here — masking boundary). Same repair
// discipline as rag/context_file.js: one retry with concrete problems, then
// a coded hard failure.

import {
  KEYWORD_INTENT_SYSTEM, buildKeywordIntentUserPrompt, CONTENT_SHAPES
} from './prompts/keyword_intent_prompts.js';

export const AGENT_ID = 'keyword-intent';
export const skills = ['extract_keywords', 'semantic_expand', 'detect_content_shape'];

const CTX_STAGE = { pipeline: 'content', stage: 'keyword-intent', agent: AGENT_ID, skill: 'extract_keywords' };

function validateModelOutput(out) {
  const problems = [];
  if (!out || typeof out !== 'object') return ['response is not a JSON object'];
  if (typeof out.topic !== 'string' || !out.topic.trim()) problems.push('missing "topic" (non-empty string)');
  if (!Array.isArray(out.core) || !out.core.length || !out.core.every((k) => typeof k === 'string' && k.trim())) {
    problems.push('"core" must be a non-empty array of non-empty strings');
  }
  if (!Array.isArray(out.expanded) || !out.expanded.every((k) => typeof k === 'string')) {
    problems.push('"expanded" must be an array of strings (semantic expansion terms)');
  }
  return problems;
}

function normalizeTerms(terms) {
  const seen = new Set();
  const result = [];
  for (const t of terms) {
    const norm = String(t).trim().toLowerCase();
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      result.push(norm);
    }
  }
  return result;
}

/**
 * Extract keyword/intent from a user prompt.
 * @returns {Promise<{core: string[], expanded: string[], contentShape: string|null, topic: string}>}
 * Throws INTENT_INVALID after one repair retry; throws immediately on an
 * empty prompt (short prompts are fine — empty ones are caller bugs).
 */
export async function extractIntent({ egress, runId, prompt }) {
  if (!egress) throw new Error('extractIntent requires an egress instance');
  if (!runId) throw new Error('extractIntent requires a runId');
  const cleaned = typeof prompt === 'string' ? prompt.trim() : '';
  if (!cleaned) {
    const err = new Error('extractIntent requires a non-empty prompt');
    err.code = 'INTENT_EMPTY_PROMPT';
    throw err;
  }

  const ctx = { runId, ...CTX_STAGE };
  const user = buildKeywordIntentUserPrompt(cleaned);

  let out = await egress.completeJson({ system: KEYWORD_INTENT_SYSTEM, user, temperature: 0.2 }, ctx);
  let problems = validateModelOutput(out);
  if (problems.length) {
    out = await egress.completeJson({
      system: KEYWORD_INTENT_SYSTEM,
      user: `${user}\n\nYour previous response was invalid:\n- ${problems.join('\n- ')}\nRespond again with ONLY the corrected JSON object.`,
      temperature: 0
    }, ctx);
    problems = validateModelOutput(out);
    if (problems.length) {
      const err = new Error(`Intent extraction invalid after retry: ${problems.join('; ')}`);
      err.code = 'INTENT_INVALID';
      throw err;
    }
  }

  const core = normalizeTerms(out.core);
  // expanded terms never duplicate core — retrieval would double-weight them
  const expanded = normalizeTerms(out.expanded || []).filter((t) => !core.includes(t));
  return {
    topic: out.topic.trim().toLowerCase().slice(0, 120), // clamp: topic rides into many prompts + the suggestions route's 120-char discipline
    core,
    expanded,
    contentShape: CONTENT_SHAPES.includes(out.contentShape) ? out.contentShape : null
  };
}
