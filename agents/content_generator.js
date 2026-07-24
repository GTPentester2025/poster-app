// Content Generation Agent (spec §B.5): writes poster copy grounded in the
// internal context file. Room-readability limits are stated in the prompt AND
// enforced structurally here — one repair retry with the exact violations,
// then CONTENT_INVALID. priorFeedback (the quality loop's full history plus
// any user feedback) is ALWAYS embedded in the prompt so context is never
// lost across iterations (spec: full history preserved).

import {
  buildContentGeneratorSystem, CONTENT_JSON_INSTRUCTION, formatGuideFor,
  HEADLINE_MAX_WORDS, MESSAGE_MAX_WORDS, MESSAGES_MIN, MESSAGES_MAX, ALLOWED_FORMATS,
  buildContentGeneratorSystemV2, buildTemplateStructureBlock, buildContentJsonInstructionV2
} from './prompts/content_generator_prompts.js';
import { validateContentAgainstSchema, normalizeContentV2 } from './content_schema.js';
import { fenceUserText, USER_TEXT_RULE } from './prompts/data_fence.js';

export const AGENT_ID = 'content-generator';
export const skills = ['write_poster_copy', 'restructure_format', 'apply_tone', 'avoid_idioms'];

const CTX_STAGE = { pipeline: 'content', stage: 'content-loop', agent: AGENT_ID, skill: 'write_poster_copy' };

export function wordCount(s) {
  return String(s || '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Structural validation of poster content against the poster.schema.json
 * content shape. enforceLengths=true adds the room-readability caps and the
 * format whitelist (generator path); inline user edits validate SHAPE only —
 * the user has the final word on wording (spec §B.5).
 * @returns {string[]} problems (empty = valid)
 */
export function validatePosterContent(content, { enforceLengths = true } = {}) {
  const problems = [];
  if (!content || typeof content !== 'object' || Array.isArray(content)) return ['content is not a JSON object'];
  if (typeof content.headline !== 'string' || !content.headline.trim()) {
    problems.push('missing "headline" (non-empty string)');
  } else if (enforceLengths && wordCount(content.headline) > HEADLINE_MAX_WORDS) {
    problems.push(`headline is ${wordCount(content.headline)} words — maximum ${HEADLINE_MAX_WORDS} (room readability)`);
  }
  if (content.subheadline != null && typeof content.subheadline !== 'string') {
    problems.push('"subheadline" must be a string or null');
  }
  if (!Array.isArray(content.messages) || content.messages.length < MESSAGES_MIN || content.messages.length > MESSAGES_MAX) {
    problems.push(`"messages" must be an array of ${MESSAGES_MIN}-${MESSAGES_MAX} items`);
  } else {
    content.messages.forEach((m, i) => {
      if (!m || typeof m !== 'object' || typeof m.text !== 'string' || !m.text.trim()) {
        problems.push(`messages[${i}] must be an object with non-empty string "text"`);
        return;
      }
      if (enforceLengths && wordCount(m.text) > MESSAGE_MAX_WORDS) {
        problems.push(`messages[${i}] is ${wordCount(m.text)} words ("${m.text}") — maximum ${MESSAGE_MAX_WORDS}`);
      }
      if (m.label != null && typeof m.label !== 'string') {
        problems.push(`messages[${i}].label must be a string or null`);
      }
    });
  }
  if (content.callToAction != null && typeof content.callToAction !== 'string') {
    problems.push('"callToAction" must be a string or null');
  }
  if (enforceLengths) {
    if (!ALLOWED_FORMATS.includes(content.format)) {
      problems.push(`"format" must be one of: ${ALLOWED_FORMATS.join(' | ')}`);
    }
  } else if (content.format != null && typeof content.format !== 'string') {
    problems.push('"format" must be a string');
  }
  return problems;
}

/** Assign stable message ids (schema requires them); model output never carries ids. */
export function normalizePosterContent(content) {
  return {
    headline: content.headline.trim(),
    subheadline: typeof content.subheadline === 'string' && content.subheadline.trim() ? content.subheadline.trim() : null,
    messages: content.messages.map((m, i) => ({
      id: typeof m.id === 'string' && m.id ? m.id : `msg-${i + 1}`,
      label: typeof m.label === 'string' && m.label.trim() ? m.label.trim() : null,
      text: m.text.trim()
    })),
    callToAction: typeof content.callToAction === 'string' && content.callToAction.trim() ? content.callToAction.trim() : null,
    format: content.format
  };
}

function anglesBlock(contextFile, selectedAngles) {
  if (Array.isArray(selectedAngles) && selectedAngles.length) {
    return `ANGLES THE USER SELECTED (build the poster on ${selectedAngles.length > 1 ? 'these — combine them coherently' : 'this'}):
${selectedAngles.map((a) => `- ${a.title}: ${a.rationale}`).join('\n')}`;
  }
  return `The user chose "let AI decide". Candidate angles from research — pick the single strongest (or a coherent pair) and commit to it:
${contextFile.angles.map((a) => `- ${a.title}: ${a.rationale}`).join('\n')}`;
}

function priorFeedbackBlock(priorFeedback) {
  if (!priorFeedback.length) return '';
  const entries = priorFeedback.map((f) => {
    const head = f.attempt ? `Attempt ${f.attempt}${typeof f.score === 'number' ? ` (scored ${f.score})` : ''}` : 'User input';
    return `${head}:
  problems: ${f.feedback}
  expected: ${f.expected || 'n/a'}`;
  });
  return `

PRIOR REVIEW HISTORY (full — fix EVERY listed problem; do not reintroduce earlier ones):
${entries.join('\n')}`;
}

function learningHintsBlock(learningHints) {
  if (!learningHints.length) return '';
  return `

LEARNED PREFERENCES from past posters on this topic (apply them — approved patterns are preferred, rejected ones avoided):
${learningHints.map((h) => `- ${h}`).join('\n')}`;
}

export function buildGeneratorUserPrompt({ contextFile, selectedAngles, userPrompt, priorFeedback, learningHints }) {
  return `Write poster copy for the topic "${contextFile.topic}".
The poster's topic is "${contextFile.topic}" — never substitute a different security subject.

${USER_TEXT_RULE}

ORIGINAL USER REQUEST: ${fenceUserText(userPrompt)}

INTERNAL CONTEXT (your only source of facts — never cite or name sources):
${contextFile.synthesis}

${anglesBlock(contextFile, selectedAngles)}

${formatGuideFor(contextFile.keywords?.contentShape || null)}${priorFeedbackBlock(priorFeedback)}${learningHintsBlock(learningHints)}

${CONTENT_JSON_INSTRUCTION}`;
}

/**
 * Generate one poster-content candidate.
 * @param {object} opts
 *   egress, runId       — required
 *   contextFile         — InternalContextFile (grounding + angles + shape)
 *   selectedAngles      — array of angle objects, or null/'ai' for AI-decides
 *   userPrompt          — the user's original (plus any appended) prompt text
 *   priorFeedback       — [{attempt, feedback, expected, score?}] from ALL earlier loop iterations
 *   learningHints       — strings from the learning memory
 * @returns poster content: {headline, subheadline, messages[{id,label,text}], callToAction, format}
 */
export async function generateContent({ egress, runId, contextFile, selectedAngles = null, userPrompt = '', priorFeedback = [], learningHints = [] }) {
  if (!egress) throw new Error('generateContent requires an egress instance');
  if (!runId) throw new Error('generateContent requires a runId');
  if (!contextFile?.synthesis) throw new Error('generateContent requires a context file with synthesis');

  const ctx = { runId, ...CTX_STAGE };
  const angles = Array.isArray(selectedAngles) ? selectedAngles : null;
  const user = buildGeneratorUserPrompt({ contextFile, selectedAngles: angles, userPrompt, priorFeedback, learningHints });
  // seed = runId: the rotating neutral example set is stable within a run
  const system = buildContentGeneratorSystem(runId);

  let out = await egress.completeJson({ system, user, temperature: 0.4 }, ctx);
  let problems = validatePosterContent(out);
  if (problems.length) {
    out = await egress.completeJson({
      system,
      user: `${user}\n\nYour previous response violated hard limits:\n- ${problems.join('\n- ')}\nRespond again with ONLY the corrected JSON object.`,
      temperature: 0.1
    }, ctx);
    problems = validatePosterContent(out);
    if (problems.length) {
      const err = new Error(`Poster content invalid after retry: ${problems.join('; ')}`);
      err.code = 'CONTENT_INVALID';
      throw err;
    }
  }
  return normalizePosterContent(out);
}

// ── v2: template-aware generation (Phase O4, plan D1/D2) ─────────────────────

/** v2 user prompt: identical grounding/angles/feedback discipline, but the
 *  format guide is replaced by the chosen template's explicit structure. */
export function buildGeneratorUserPromptV2({ contextFile, selectedAngles, userPrompt, priorFeedback, learningHints, template }) {
  return `Write poster copy for the topic "${contextFile.topic}".
The poster's topic is "${contextFile.topic}" — never substitute a different security subject.

${USER_TEXT_RULE}

ORIGINAL USER REQUEST: ${fenceUserText(userPrompt)}

INTERNAL CONTEXT (your only source of facts — never cite or name sources):
${contextFile.synthesis}

${anglesBlock(contextFile, selectedAngles)}

${buildTemplateStructureBlock(template)}${priorFeedbackBlock(priorFeedback)}${learningHintsBlock(learningHints)}

${buildContentJsonInstructionV2(template.contentSchema)}`;
}

/**
 * Generate one poster-content candidate for a CHOSEN v2 template
 * (template-first flow). Same repair discipline as v1: schema-driven
 * validation, one repair retry with the exact violations, then
 * CONTENT_INVALID.
 * @param {object} opts — as generateContent, plus:
 *   template — full v2 template manifest (getTemplateV2); its contentSchema
 *              drives the prompt AND the structural validation
 * @returns v2 content: {headline, subheadline, blocks[{id,...fields}], callToAction}
 */
export async function generateContentV2({ egress, runId, contextFile, selectedAngles = null, userPrompt = '', template, priorFeedback = [], learningHints = [] }) {
  if (!egress) throw new Error('generateContentV2 requires an egress instance');
  if (!runId) throw new Error('generateContentV2 requires a runId');
  if (!contextFile?.synthesis) throw new Error('generateContentV2 requires a context file with synthesis');
  if (!template?.contentSchema) throw new Error('generateContentV2 requires a v2 template with a contentSchema');

  const ctx = { runId, ...CTX_STAGE };
  const angles = Array.isArray(selectedAngles) ? selectedAngles : null;
  const user = buildGeneratorUserPromptV2({ contextFile, selectedAngles: angles, userPrompt, priorFeedback, learningHints, template });
  // seed = runId: the rotating neutral example set is stable within a run
  const system = buildContentGeneratorSystemV2(runId);

  let out = await egress.completeJson({ system, user, temperature: 0.4 }, ctx);
  let problems = validateContentAgainstSchema(out, template.contentSchema);
  if (problems.length) {
    out = await egress.completeJson({
      system,
      user: `${user}\n\nYour previous response violated the template structure:\n- ${problems.join('\n- ')}\nRespond again with ONLY the corrected JSON object.`,
      temperature: 0.1
    }, ctx);
    problems = validateContentAgainstSchema(out, template.contentSchema);
    if (problems.length) {
      const err = new Error(`Poster content invalid for template "${template.id}" after retry: ${problems.join('; ')}`);
      err.code = 'CONTENT_INVALID';
      throw err;
    }
  }
  return normalizeContentV2(out, template.contentSchema);
}
