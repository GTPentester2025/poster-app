// Edit-Learning Agent (spec §B.5 inline editing + edit-learning): computes a
// field-level diff of the user's direct edit LOCALLY (no model call when
// nothing meaningful changed), classifies the change via egress, and stores
// the reusable signal in the learning table. Affects FUTURE runs only — the
// current poster keeps the user's edit verbatim, unreviewed.

import { EDIT_LEARNING_SYSTEM, buildEditClassificationPrompt } from './prompts/edit_learning_prompts.js';

export const AGENT_ID = 'edit-learning';
export const skills = ['diff_user_edits', 'classify_edit_significance', 'store_learning'];

const CTX_STAGE = { pipeline: 'content', stage: 'edit-learning', agent: AGENT_ID, skill: 'classify_edit_significance' };
const CHANGE_TYPES = ['stylistic-preference', 'content-correction'];

const norm = (v) => (typeof v === 'string' ? v.trim() : v == null ? null : String(v));

/**
 * Field-level diff of two poster-content objects. Ignores message ids (they
 * are assigned locally, not authored) and whitespace-only differences.
 * @returns {Array<{field:string, before:*, after:*}>}
 */
export function diffContent(before, after) {
  const changes = [];
  for (const field of ['headline', 'subheadline', 'callToAction', 'format']) {
    if (norm(before?.[field]) !== norm(after?.[field])) {
      changes.push({ field, before: norm(before?.[field]), after: norm(after?.[field]) });
    }
  }
  const bMsgs = Array.isArray(before?.messages) ? before.messages : [];
  const aMsgs = Array.isArray(after?.messages) ? after.messages : [];
  if (bMsgs.length !== aMsgs.length) {
    changes.push({ field: 'messages.count', before: bMsgs.length, after: aMsgs.length });
  }
  // per-index entries only where BOTH sides have a message — added/removed
  // tails are already reported by messages.count, never double-reported
  const len = Math.min(bMsgs.length, aMsgs.length);
  for (let i = 0; i < len; i++) {
    const b = bMsgs[i];
    const a = aMsgs[i];
    if (norm(b?.text) !== norm(a?.text)) {
      changes.push({ field: `messages[${i}].text`, before: norm(b?.text), after: norm(a?.text) });
    }
    if (norm(b?.label) !== norm(a?.label)) {
      changes.push({ field: `messages[${i}].label`, before: norm(b?.label), after: norm(a?.label) });
    }
  }
  return changes;
}

const GUIDANCE_MAX_LENGTH = 300;
// Guidance re-enters generator prompts, so this deny-list covers the standard
// indirect-injection lexicon, not just the obvious four.
const GUIDANCE_BANNED_TERMS = [
  'ignore', 'disregard', 'override', 'forget',
  'instruction', 'always use', 'system prompt',
  'pretend', 'act as', 'from now on', 'henceforth',
  'new rule', 'you must', 'do not review'
];
const KNOWN_PLACEHOLDERS = new Set(['SOC_EMAIL', 'TRAINING_PORTAL', 'CONTENT_PORTAL', 'REPORTING_URL', 'ORG_NAME', 'IT_HELPDESK']);

/**
 * Guidance is model text derived from user-controlled edits and later
 * re-enters generator prompts via the learning table — a poisoning vector.
 * Flatten (no newlines/control chars) and cap it; return null (classification
 * is still stored, guidance dropped) when it smells like an instruction
 * override or carries a {{...}} placeholder outside the known set.
 */
export function sanitizeGuidance(guidance) {
  let g = String(guidance || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ') // strip newlines + control chars
    .replace(/\s+/g, ' ')
    .trim();
  if (g.length > GUIDANCE_MAX_LENGTH) g = g.slice(0, GUIDANCE_MAX_LENGTH).trim();
  const lower = g.toLowerCase();
  if (GUIDANCE_BANNED_TERMS.some((term) => lower.includes(term))) return null;
  for (const [, name] of g.matchAll(/\{\{([^{}]*)\}\}/g)) {
    if (!KNOWN_PLACEHOLDERS.has(name.trim())) return null;
  }
  return g;
}

function validateClassification(out) {
  const problems = [];
  if (!out || typeof out !== 'object') return ['response is not a JSON object'];
  if (!CHANGE_TYPES.includes(out.changeType)) problems.push(`"changeType" must be one of: ${CHANGE_TYPES.join(' | ')}`);
  if (typeof out.summary !== 'string' || out.summary.trim().length < 10) problems.push('"summary" must be a substantial string');
  if (typeof out.guidance !== 'string' || out.guidance.trim().length < 10) problems.push('"guidance" must be a reusable instruction string');
  return problems;
}

/**
 * Learn from a direct user edit. No meaningful change -> {meaningful:false}
 * with zero model calls. Otherwise classify + INSERT into learning
 * (kind='edit_learning', weight 1.0) and return the stored classification.
 */
export async function learnFromEdit({ egress, db, runId, before, after, topic }) {
  if (!egress) throw new Error('learnFromEdit requires an egress instance');
  if (!db) throw new Error('learnFromEdit requires a db');
  if (!runId) throw new Error('learnFromEdit requires a runId');
  if (typeof topic !== 'string' || !topic.trim()) throw new Error('learnFromEdit requires a topic');

  const changes = diffContent(before, after);
  if (!changes.length) return { meaningful: false, changes: [] };

  const ctx = { runId, ...CTX_STAGE };
  const user = buildEditClassificationPrompt({ topic, changes });

  let out = await egress.completeJson({ system: EDIT_LEARNING_SYSTEM, user, temperature: 0.1 }, ctx);
  let problems = validateClassification(out);
  if (problems.length) {
    out = await egress.completeJson({
      system: EDIT_LEARNING_SYSTEM,
      user: `${user}\n\nYour previous response was invalid:\n- ${problems.join('\n- ')}\nRespond again with ONLY the corrected JSON object.`,
      temperature: 0
    }, ctx);
    problems = validateClassification(out);
    if (problems.length) {
      const err = new Error(`Edit classification invalid after retry: ${problems.join('; ')}`);
      err.code = 'EDIT_LEARNING_INVALID';
      throw err;
    }
  }

  // guidance re-enters future generator prompts — sanitize it, or drop it and
  // keep the classification when it fails the poisoning checks
  const guidance = sanitizeGuidance(out.guidance);
  const detail = {
    changeType: out.changeType,
    summary: out.summary.trim(),
    ...(guidance ? { guidance } : {}),
    changes
  };
  const info = db.prepare(
    'INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(new Date().toISOString(), 'edit_learning', topic.trim().toLowerCase(), null, JSON.stringify(detail), 1.0);

  return { meaningful: true, learningId: Number(info.lastInsertRowid), ...detail };
}
