// Terminology-Validator Agent (spec §B.11): judges term swaps inside a user
// edit before anything enters the glossary DB. Never throws — designed for
// fire-and-forget after the edit is already applied (the edit must never wait
// on or fail with this learning step).

import { getLanguage } from '../translation/languages.js';
import { getTerminology, upsertTerminology } from '../translation/glossary.js';
import {
  TERMINOLOGY_VALIDATOR_SYSTEM, buildTerminologyValidatorPrompt
} from './prompts/terminology_validator_prompts.js';

export const AGENT_ID = 'terminology-validator';
export const skills = ['validate_term_swap', 'store_terminology'];

function validateVerdict(out) {
  if (!out || typeof out !== 'object' || !Array.isArray(out.swaps)) return ['response must be {"swaps": [...]}'];
  const problems = [];
  out.swaps.forEach((s, i) => {
    if (!s || typeof s !== 'object') { problems.push(`swaps[${i}] must be an object`); return; }
    if (typeof s.sourceTerm !== 'string' || !s.sourceTerm.trim()) problems.push(`swaps[${i}].sourceTerm must be a non-empty string`);
    if (typeof s.candidate !== 'string' || !s.candidate.trim()) problems.push(`swaps[${i}].candidate must be a non-empty string`);
    if (typeof s.equivalent !== 'boolean') problems.push(`swaps[${i}].equivalent must be boolean`);
    if (typeof s.note !== 'string' || s.note.trim().length < 5) problems.push(`swaps[${i}].note must explain the decision`);
  });
  return problems;
}

/**
 * Judge the term swaps inside a user edit; store ONLY validated equivalents.
 * Never throws — designed for fire-and-forget after the edit is already
 * applied (the edit itself must never wait on or fail with learning).
 *
 * @param {{ egress, db, runId, lang, changes: Array<{field, before, after}> }}
 * @returns {Promise<{stored: Array<{sourceTerm, approvedTerm}>, rejected: Array<{sourceTerm, candidate, reason}>, failed?: true}>}
 */
export async function validateAndStoreTermSwaps({ egress, db, runId, lang, changes }) {
  const none = { stored: [], rejected: [] };
  try {
    const language = getLanguage(lang);
    const meaningful = (changes || []).filter((c) => String(c.before ?? '') !== String(c.after ?? ''));
    if (!language || !db || !meaningful.length) return none;

    const ctx = { runId, pipeline: 'translation', stage: `terminology:${lang}`, agent: AGENT_ID, skill: 'validate_term_swap' };
    const existingTerms = getTerminology(db, lang).map(({ sourceTerm, approvedTerm }) => ({ sourceTerm, approvedTerm }));
    const user = buildTerminologyValidatorPrompt({ language, changes: meaningful, existingTerms });

    let out = await egress.completeJson({ system: TERMINOLOGY_VALIDATOR_SYSTEM, user, temperature: 0.1 }, ctx);
    let problems = validateVerdict(out);
    if (problems.length) {
      out = await egress.completeJson({
        system: TERMINOLOGY_VALIDATOR_SYSTEM,
        user: `${user}\n\nYour previous response was invalid:\n- ${problems.join('\n- ')}\nRespond again with ONLY the corrected JSON object.`,
        temperature: 0
      }, ctx);
      problems = validateVerdict(out);
      if (problems.length) return { ...none, failed: true };
    }

    const stored = [];
    const rejected = [];
    for (const s of out.swaps) {
      const trimmed = s.sourceTerm.trim();
      // Pure acronym: all characters are uppercase letters (e.g. MFA, VPN).
      // /^[A-Z]+$/ test distinguishes uppercase-only strings from mixed-case.
      const sourceTerm = /^[A-Z]+$/.test(trimmed)
        ? trimmed // pure-acronym: keep as written
        : trimmed.toLowerCase();
      if (s.equivalent) {
        try {
          upsertTerminology(db, {
            lang, sourceTerm, approvedTerm: s.candidate.trim(),
            validatedBy: AGENT_ID, validationNote: s.note.trim()
          });
          stored.push({ sourceTerm, approvedTerm: s.candidate.trim() });
        } catch (err) {
          if (err.code !== 'UNSAFE_TERM_SHAPE') throw err; // real DB failures hit the outer catch
          // an unsafe term (multi-line / braces / sentinels / oversized) rejects
          // THIS swap only — the rest of the batch still stores
          rejected.push({ sourceTerm, candidate: s.candidate.trim(), reason: 'unsafe term shape' });
        }
      } else {
        rejected.push({ sourceTerm, candidate: s.candidate.trim(), reason: s.note.trim() });
      }
    }
    return { stored, rejected };
  } catch {
    return { ...none, failed: true };
  }
}
