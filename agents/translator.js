// Translation Agent (spec §B.11): translates the approved English poster
// content OBJECT into one target language per call, then back-checks its own
// output for fidelity (translated → compared against the English source —
// spec: fidelity checking is built INTO the translation agent).
//
// Ported discipline from the reference repo's js/ui/translation.js:
//   - strictPrompt (native-fluent security communications writer, plain
//     language, jargon mapping, niche-term glossing) lives in
//     prompts/translator_prompts.js
//   - protectTokens/restoreTokens (already ported to masking/redactor.js —
//     REUSED here, not duplicated): URLs/emails/ref codes become __LOCK_n__
//     sentinels before the prompt, restored after the back-check
//   - isBadTranslationOutput → per-field checks here: apology patterns,
//     verbose-dump 3× length cap (with the 120-char floor so short labels may
//     expand naturally in wordier languages), empty output, English echo
//   - retry-at-temperature-0: one repair retry carrying the exact violations,
//     then TRANSLATION_INVALID
//   - applyGlossaryLock with case preservation + terminology-DB merge

import { protectTokens, restoreTokens } from '../masking/redactor.js';
import { getLanguage, registerFor, BASE_LANGUAGE } from '../translation/languages.js';
import { buildGlossaryFor, applyGlossaryLock } from '../translation/glossary.js';
import {
  TRANSLATOR_SYSTEM, buildTranslationUserPrompt,
  FIDELITY_SYSTEM, buildFidelityUserPrompt,
  STYLE_PREFERENCE_SYSTEM, buildStylePreferencePrompt
} from './prompts/translator_prompts.js';

export const AGENT_ID = 'translator';
export const skills = ['translate_segment', 'apply_glossary_lock', 'apply_register', 'back_check_fidelity'];

const PIPELINE = 'translation';
const MIN_FEEDBACK_LENGTH = 10; // matches event.schema.json verdict minLength

// Apology / clarification patterns (ported isBadTranslationOutput deny-list).
const BAD_OUTPUT_PATTERNS = [
  /i'?m sorry/i,
  /please provide/i,
  /need the text/i,
  /want translated/i,
  /cannot translate/i,
  /as an ai/i
];

const SENTINEL_RE = /__[A-Z][A-Z0-9]*_\d+__/g;
const PLACEHOLDER_RE = /\{\{[A-Z0-9_]+\}\}/g;

// ── field-level validation (ported checks, JSON-object shaped) ─────────────

/** True when the string contains letters a translator could translate. */
export function hasTranslatableLetters(text) {
  const normalized = String(text || '')
    .replace(PLACEHOLDER_RE, ' ')
    .replace(SENTINEL_RE, ' ')
    .replace(/\bhttps?:\/\/[^\s]+/gi, ' ')
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, ' ');
  return /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ一-鿿가-힯]/.test(normalized);
}

function normalizedText(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * The dynamic translatable field list of a v2 block: every non-id string
 * field (the template's contentSchema fields, e.g. question/answer or
 * label/text or figure/caption — derived from the data, never hardcoded).
 */
export function blockFieldsOf(block) {
  return Object.keys(block || {}).filter((k) => k !== 'id' && typeof block[k] === 'string');
}

/** Per-field bad-output check (apology / verbose dump / empty) — ported. */
function fieldProblems(field, source, output) {
  const src = String(source ?? '').trim();
  const out = String(output ?? '').trim();
  if (!out) return [`${field} is empty`];
  const problems = [];
  if (BAD_OUTPUT_PATTERNS.some((re) => re.test(out))) {
    problems.push(`${field} contains an apology/clarification instead of a translation ("${out.slice(0, 80)}")`);
  }
  // Verbose-dump guard: allow SHORT labels/headlines to expand naturally in
  // wordier languages (120-char floor), reject explanation dumps beyond 3×.
  if (src.length < 140 && out.length > Math.max(120, src.length * 3)) {
    problems.push(`${field} is ${out.length} chars — over 3× the ${src.length}-char source (verbose dump)`);
  }
  return problems;
}

/**
 * Every sentinel/placeholder in the source field must survive verbatim — and
 * the output may not INVENT tokens the source field never had. An invented
 * {{PLACEHOLDER}} would be resolved to a real org value at render time (the
 * model minting org-data insertion points); an invented __LOCK_n__ would be
 * expanded by restoreTokens. Both are rejected, not repaired. (Residual: an
 * invented placeholder whose config value is set is substituted by the egress
 * restore before validation can see it — same trust domain as the local DB,
 * documented, not reachable from outside the org's own config.)
 */
function preservationProblems(field, source, output) {
  const problems = [];
  const src = String(source ?? '');
  const out = String(output ?? '');
  for (const re of [SENTINEL_RE, PLACEHOLDER_RE]) {
    const srcTokens = new Set(src.match(re) || []);
    for (const token of srcTokens) {
      if (!out.includes(token)) problems.push(`${field} lost the protected token ${token}`);
    }
    for (const token of out.match(re) || []) {
      if (!srcTokens.has(token)) problems.push(`${field} contains the invented token ${token} — output only the tokens the source has`);
    }
  }
  return problems;
}

/**
 * Structural + per-field validation of a translated content object against
 * its (token-protected) source. Exported so the pipeline reuses the exact
 * same rules for its independent structural check.
 * @returns {string[]} problems (empty = valid)
 */
export function validateTranslatedContent(out, source, targetLang) {
  if (!out || typeof out !== 'object' || Array.isArray(out)) return ['response is not a JSON object'];
  const problems = [];

  if (typeof out.headline !== 'string' || !out.headline.trim()) {
    problems.push('missing "headline" (non-empty string)');
  } else {
    problems.push(...fieldProblems('headline', source.headline, out.headline));
    problems.push(...preservationProblems('headline', source.headline, out.headline));
  }

  if (source.subheadline == null) {
    if (out.subheadline != null && String(out.subheadline).trim()) problems.push('"subheadline" must be null (the source has none)');
  } else if (typeof out.subheadline !== 'string' || !out.subheadline.trim()) {
    problems.push('missing "subheadline" (the source has one)');
  } else {
    problems.push(...fieldProblems('subheadline', source.subheadline, out.subheadline));
    problems.push(...preservationProblems('subheadline', source.subheadline, out.subheadline));
  }

  // messages (v1): a missing key is treated as [] so a v2 source (blocks, no
  // messages) never demands a messages array — for v1 sources the count check
  // fires exactly as before.
  const srcMsgs = source.messages || [];
  const outMsgs = out.messages == null ? [] : out.messages;
  if (!Array.isArray(outMsgs) || outMsgs.length !== srcMsgs.length) {
    problems.push(`"messages" must be an array of exactly ${srcMsgs.length} items (same count as the source)`);
  } else {
    outMsgs.forEach((m, i) => {
      const src = srcMsgs[i];
      if (!m || typeof m !== 'object') { problems.push(`messages[${i}] must be an object`); return; }
      if (m.id !== src.id) problems.push(`messages[${i}].id must be "${src.id}" verbatim (got "${m.id}")`);
      if (typeof m.text !== 'string' || !m.text.trim()) {
        problems.push(`messages[${i}].text must be a non-empty string`);
      } else {
        problems.push(...fieldProblems(`messages[${i}].text`, src.text, m.text));
        problems.push(...preservationProblems(`messages[${i}].text`, src.text, m.text));
      }
      if (src.label == null) {
        if (m.label != null && String(m.label).trim()) problems.push(`messages[${i}].label must be null (the source has none)`);
      } else if (typeof m.label !== 'string' || !m.label.trim()) {
        problems.push(`messages[${i}].label must be a non-empty string (translate the label meaningfully)`);
      }
    });
  }

  // blocks (v2, template-first posters) are validated exactly like extras:
  // same count, verbatim ids, and EVERY source field (the block's dynamic
  // schema fields, e.g. question/answer) present as a non-empty translated
  // string with the same per-field bad-output + preservation rules. A missing
  // blocks key is treated as [] so it only fails when the source has blocks.
  const srcBlocks = source.blocks || [];
  const outBlocks = out.blocks == null ? [] : out.blocks;
  if (!Array.isArray(outBlocks) || outBlocks.length !== srcBlocks.length) {
    problems.push(`"blocks" must be an array of exactly ${srcBlocks.length} items (same count as the source)`);
  } else {
    outBlocks.forEach((b, i) => {
      const src = srcBlocks[i];
      if (!b || typeof b !== 'object') { problems.push(`blocks[${i}] must be an object`); return; }
      if (b.id !== src.id) problems.push(`blocks[${i}].id must be "${src.id}" verbatim (got "${b.id}")`);
      for (const field of blockFieldsOf(src)) {
        if (typeof b[field] !== 'string' || !b[field].trim()) {
          problems.push(`blocks[${i}].${field} must be a non-empty string (translate every field of the block)`);
        } else {
          problems.push(...fieldProblems(`blocks[${i}].${field}`, src[field], b[field]));
          problems.push(...preservationProblems(`blocks[${i}].${field}`, src[field], b[field]));
        }
      }
    });
  }

  if (source.callToAction == null) {
    if (out.callToAction != null && String(out.callToAction).trim()) problems.push('"callToAction" must be null (the source has none)');
  } else if (typeof out.callToAction !== 'string' || !out.callToAction.trim()) {
    problems.push('missing "callToAction" (the source has one)');
  } else {
    problems.push(...fieldProblems('callToAction', source.callToAction, out.callToAction));
    problems.push(...preservationProblems('callToAction', source.callToAction, out.callToAction));
  }

  // extras (user-added text boxes) are validated exactly like messages: same
  // count, verbatim ids, non-empty translated text. A missing extras key is
  // treated as [] so it only fails when the source actually carries extras.
  const srcExtras = source.extras || [];
  const outExtras = out.extras == null ? [] : out.extras;
  if (!Array.isArray(outExtras) || outExtras.length !== srcExtras.length) {
    problems.push(`"extras" must be an array of exactly ${srcExtras.length} items (same count as the source)`);
  } else {
    outExtras.forEach((e, i) => {
      const src = srcExtras[i];
      if (!e || typeof e !== 'object') { problems.push(`extras[${i}] must be an object`); return; }
      if (e.id !== src.id) problems.push(`extras[${i}].id must be "${src.id}" verbatim (got "${e.id}")`);
      if (typeof e.text !== 'string' || !e.text.trim()) {
        problems.push(`extras[${i}].text must be a non-empty string`);
      } else {
        problems.push(...fieldProblems(`extras[${i}].text`, src.text, e.text));
        problems.push(...preservationProblems(`extras[${i}].text`, src.text, e.text));
      }
    });
  }

  // English-echo gate (ported docUnchanged): for a non-English target, the
  // visible text must actually change when the source had translatable words.
  if (targetLang !== BASE_LANGUAGE && !problems.length) {
    const join = (c) => normalizedText([
      c.headline, c.subheadline,
      ...(c.messages || []).flatMap((m) => [m.label, m.text]),
      // v2 blocks: every dynamic string field, in sorted key order so source
      // and output join deterministically regardless of key order
      ...(c.blocks || []).flatMap((b) => blockFieldsOf(b).sort().map((k) => b[k])),
      c.callToAction,
      ...(c.extras || []).map((e) => e.text)
    ].filter(Boolean).join(' | '));
    const srcJoined = join(source);
    if (hasTranslatableLetters(srcJoined) && srcJoined === join(out)) {
      problems.push(`output echoes the English source unchanged — it must be translated into ${targetLang}`);
    }
  }
  return problems;
}

// ── fidelity back-check (built into this agent) ────────────────────────────

function validateFidelityVerdict(out) {
  const problems = [];
  if (!out || typeof out !== 'object') return ['response is not a JSON object'];
  const status = out.status === 'rejected' ? 'rework' : out.status; // this loop reworks, never dead-ends
  if (!['accepted', 'rework'].includes(status)) problems.push('"status" must be "accepted" or "rework"');
  if (typeof out.score !== 'number' || !Number.isFinite(out.score) || out.score < 0 || out.score > 100) {
    problems.push('"score" must be a finite number 0-100');
  }
  if (status !== 'accepted') {
    if (typeof out.feedback !== 'string' || out.feedback.trim().length < MIN_FEEDBACK_LENGTH) {
      problems.push('"feedback" is required for rework: list each concrete problem, quoting the offending field');
    }
    if (typeof out.expected !== 'string' || out.expected.trim().length < MIN_FEEDBACK_LENGTH) {
      problems.push('"expected" is required for rework: describe what a passing translation looks like');
    }
  }
  if (out.issues != null && !Array.isArray(out.issues)) problems.push('"issues" must be an array when present');
  return problems;
}

function normalizeFidelity(out) {
  const status = out.status === 'rejected' ? 'rework' : out.status;
  return {
    score: out.score,
    status,
    feedback: status === 'accepted' ? '' : out.feedback.trim(),
    expected: status === 'accepted' ? '' : out.expected.trim(),
    issues: (Array.isArray(out.issues) ? out.issues : [])
      .filter((i) => i && typeof i === 'object')
      .map((i) => ({ field: String(i.field || ''), problem: String(i.problem || '') }))
  };
}

async function backCheckFidelity({ egress, runId, language, register, sourceJson, translatedJson, lang }) {
  const ctx = { runId, pipeline: PIPELINE, stage: `translate:${lang}`, agent: AGENT_ID, skill: 'back_check_fidelity' };
  const user = buildFidelityUserPrompt({ language, register, sourceJson, translatedJson });

  let out = await egress.completeJson({ system: FIDELITY_SYSTEM, user, temperature: 0.1 }, ctx);
  let problems = validateFidelityVerdict(out);
  if (problems.length) {
    out = await egress.completeJson({
      system: FIDELITY_SYSTEM,
      user: `${user}\n\nYour previous verdict was invalid:\n- ${problems.join('\n- ')}\nRespond again with ONLY the corrected JSON object.`,
      temperature: 0
    }, ctx);
    problems = validateFidelityVerdict(out);
    if (problems.length) {
      const err = new Error(`Fidelity verdict invalid after retry: ${problems.join('; ')}`);
      err.code = 'FIDELITY_INVALID';
      throw err;
    }
  }
  return normalizeFidelity(out);
}

// ── public API ──────────────────────────────────────────────────────────────

/**
 * Translate one poster-content object into one target language, then
 * back-check fidelity.
 * @param {object} opts
 *   egress, runId    — required
 *   db               — terminology database (glossary merge); optional in unit tests
 *   content          — English poster content {headline, subheadline, messages[{id,label,text}] (v1) OR blocks[{id,<dynamic fields>}] (v2 template-first), callToAction, extras[{id,text}], format}
 *   targetLang       — language id from translation/languages.js (never 'en')
 *   priorFeedback    — [{attempt, feedback, expected, score?}] from earlier loop iterations
 * @returns {Promise<{content: object, fidelity: {score, status, feedback, expected, issues}}>}
 */
export async function translateContent({ egress, db = null, runId, content, targetLang, priorFeedback = [] }) {
  if (!egress) throw new Error('translateContent requires an egress instance');
  if (!runId) throw new Error('translateContent requires a runId');
  if (!content?.headline) throw new Error('translateContent requires poster content');
  const language = getLanguage(targetLang);
  if (!language || targetLang === BASE_LANGUAGE) {
    throw new Error(`translateContent requires a non-English target language (got "${targetLang}")`);
  }

  const register = registerFor(targetLang);
  const glossary = buildGlossaryFor(db, targetLang);
  const ctx = { runId, pipeline: PIPELINE, stage: `translate:${targetLang}`, agent: AGENT_ID, skill: 'translate_segment' };

  // Token protection (reference repo pattern, via the redactor port): the
  // whole source object is serialized ONCE and protected ONCE, so URLs,
  // emails and reference codes in ANY field ride as __LOCK_n__ sentinels and
  // the model can never mangle them. The lock regexes stop at JSON quotes, so
  // the protected string stays valid JSON.
  const sourceExtras = (content.extras || []).map((e) => ({ id: e.id, text: e.text }));
  // The content carries ONE of two body shapes: messages (v1) or blocks (v2,
  // template-first — dynamic per-template fields like question/answer). The
  // source is serialized in whichever shape it has; blocks ride with their
  // ids plus every string field, verbatim.
  const sourceBlocks = Array.isArray(content.blocks)
    ? content.blocks.map((b) => {
      const src = { id: b.id };
      for (const field of blockFieldsOf(b)) src[field] = b[field];
      return src;
    })
    : null;
  const sourceJson = JSON.stringify({
    headline: content.headline,
    subheadline: content.subheadline ?? null,
    ...(sourceBlocks
      ? { blocks: sourceBlocks }
      : { messages: content.messages.map((m) => ({ id: m.id, label: m.label ?? null, text: m.text })) }),
    callToAction: content.callToAction ?? null,
    extras: sourceExtras,
    format: content.format
  });
  const locked = protectTokens(sourceJson);
  // {{PLACEHOLDER}} tokens are render-time keys resolved to REAL org values by
  // the egress restore pass — if they travelled literally, session.restore()
  // would substitute the real value into the model response BEFORE validation
  // (breaking preservation) and leak it into the stored variant. Lock them
  // into the SAME __LOCK_n__ sentinel space (continuing the index sequence) so
  // egress restore can never touch them; restoreTokens puts the literal
  // placeholder back at the very end — render time stays the only resolution.
  locked.text = locked.text.replace(PLACEHOLDER_RE, (match) => {
    const token = `__LOCK_${locked.protectedTokens.length}__`;
    locked.protectedTokens.push(match);
    return token;
  });
  const protectedSource = JSON.parse(locked.text);

  const user = buildTranslationUserPrompt({
    language, register, glossary, sourceJson: locked.text, priorFeedback,
    // v2: the response-shape section documents the blocks array with the
    // template's dynamic field list (derived from the data, union across blocks)
    blockFields: sourceBlocks ? [...new Set(sourceBlocks.flatMap(blockFieldsOf))] : null
  });

  let out = await egress.completeJson({ system: TRANSLATOR_SYSTEM, user, temperature: 0.3 }, ctx);
  let problems = validateTranslatedContent(out, protectedSource, targetLang);
  if (problems.length) {
    // retry-at-temperature-0 (ported): one repair pass carrying the exact violations
    out = await egress.completeJson({
      system: TRANSLATOR_SYSTEM,
      user: `${user}\n\nYour previous response was rejected by the validator:\n- ${problems.join('\n- ')}\nRespond again with ONLY the corrected JSON object — natural, native-sounding, same meaning as the source, no commentary, no apology.`,
      temperature: 0
    }, ctx);
    problems = validateTranslatedContent(out, protectedSource, targetLang);
    if (problems.length) {
      const err = new Error(`Translation invalid after retry (${targetLang}): ${problems.join('; ')}`);
      err.code = 'TRANSLATION_INVALID';
      throw err;
    }
  }

  // Glossary lock with case preservation (skill: apply_glossary_lock) — the
  // terminology-DB merge already rode into `glossary`, approved terms win.
  const lock = (s) => (typeof s === 'string' ? applyGlossaryLock(s, glossary) : s);
  const translated = {
    headline: lock(out.headline).trim(),
    subheadline: lockedOrNull(out.subheadline, lock),
    ...(sourceBlocks
      ? {
        // v2 blocks: ids re-stamped from the source (validated verbatim
        // anyway), every dynamic string field through the glossary lock —
        // token restore covers them in the whole-object pass below.
        blocks: out.blocks.map((b, i) => {
          const src = sourceBlocks[i];
          const nb = { id: src.id };
          for (const field of blockFieldsOf(src)) nb[field] = lock(b[field]).trim();
          return nb;
        })
      }
      : {
        messages: out.messages.map((m, i) => ({
          id: content.messages[i].id,
          label: lockedOrNull(m.label, lock),
          text: lock(m.text).trim()
        }))
      }),
    callToAction: lockedOrNull(out.callToAction, lock),
    extras: (out.extras || []).map((e, i) => ({
      id: sourceExtras[i].id,
      text: lock(e.text).trim()
    })),
    format: content.format
  };

  // Back-check BEFORE restoring tokens: the checker sees the same sentinels
  // as the translator, and real URLs/emails never travel more than necessary.
  const fidelity = await backCheckFidelity({
    egress, runId, language, register, lang: targetLang,
    sourceJson: locked.text, translatedJson: JSON.stringify(translated)
  });

  // Restore protected tokens across the whole object in one pass.
  const restored = JSON.parse(restoreTokens(JSON.stringify(translated), locked.protectedTokens));
  return { content: restored, fidelity };
}

function lockedOrNull(value, lock) {
  return typeof value === 'string' && value.trim() ? lock(value).trim() : null;
}

/**
 * Batch-sync helper (spec §B.11 batch update, skill: apply_register — the
 * preference is a register/style signal): describe the user's style
 * preference behind a variant edit so OTHER languages can be re-translated
 * with it. Returns {preference} or null when the model finds no reusable
 * signal / responds invalidly (best-effort — sync proceeds without a note).
 */
export async function extractStylePreference({ egress, runId, lang, changes }) {
  const language = getLanguage(lang);
  if (!language || !changes.length) return null;
  const ctx = { runId, pipeline: PIPELINE, stage: 'variant-edit', agent: AGENT_ID, skill: 'apply_register' };
  const out = await egress.completeJson({
    system: STYLE_PREFERENCE_SYSTEM,
    user: buildStylePreferencePrompt({ language, changes }),
    temperature: 0.1
  }, ctx);
  if (!out || typeof out.preference !== 'string' || out.preference.trim().length < 10) return null;
  return { preference: out.preference.trim().slice(0, 300) };
}
