// Glossary lock (spec §B.11): security terms whose spelling stays consistent
// in EVERY language, plus the per-language terminology database grown from
// user edits validated by the terminology-validator agent.
//
// GLOSSARY_LOCK + applyGlossaryLock are ported from the reference repo
// (js/ui/translation.js): the lock normalises the canonical SPELLING but
// PRESERVES the leading-letter case the translator chose, so target-language
// orthography is never overridden (German/Dutch capitalise these loanword
// nouns — "Phishing"; an unconditional lowercase would force them back down).
//
// The terminology DB merges OVER the static lock: a validated approved_term
// for a language wins against the static canonical for the same source term,
// and rows for source terms outside the static set extend the glossary.

export const GLOSSARY_LOCK = {
  en: {
    phishing: 'phishing',
    smishing: 'smishing',
    vishing: 'vishing',
    'multi-factor authentication': 'multi-factor authentication',
    mfa: 'MFA'
  }
};

export const GLOSSARY_LOCK_TERM_LIST = [
  ...new Set(Object.values(GLOSSARY_LOCK.en).map((t) => String(t || '').trim()).filter(Boolean))
];

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Terminology rows for a language, newest-updated first. */
export function getTerminology(db, lang) {
  return db.prepare(
    `SELECT lang, source_term AS sourceTerm, approved_term AS approvedTerm,
            validated_by AS validatedBy, validation_note AS validationNote, updated_at AS updatedAt
     FROM terminology WHERE lang = ? ORDER BY updated_at DESC, source_term ASC`
  ).all(lang);
}

/**
 * Effective glossary for a language: [{match, canonical}] entries. Static
 * lock terms map to themselves; terminology rows OVERRIDE the canonical for a
 * matching source term (approved_term wins for that lang) and ADD entries for
 * source terms outside the static set. Longer matches first so multi-word
 * terms mask outside-in.
 */
export function buildGlossaryFor(db, lang) {
  const entries = new Map(); // lower(match) -> { match, canonical }
  for (const term of Object.values(GLOSSARY_LOCK.en)) {
    entries.set(term.toLowerCase(), { match: term, canonical: term });
  }
  if (db && lang) {
    for (const row of getTerminology(db, lang)) {
      const match = String(row.sourceTerm || '').trim();
      const canonical = String(row.approvedTerm || '').trim();
      if (match && canonical) entries.set(match.toLowerCase(), { match, canonical });
    }
  }
  return [...entries.values()].sort((a, b) => b.match.length - a.match.length);
}

/**
 * Normalise glossary-term spelling in translated text, preserving the
 * leading-letter case the translator chose (ported case-preservation rule).
 * `glossary` is either buildGlossaryFor() output or a plain term list.
 */
export function applyGlossaryLock(text, glossary = GLOSSARY_LOCK_TERM_LIST) {
  let out = String(text ?? '');
  const entries = glossary.map((g) => (typeof g === 'string' ? { match: g, canonical: g } : g));
  for (const { match, canonical } of entries) {
    const re = new RegExp(`\\b${escapeRegExp(match)}\\b`, 'gi');
    out = out.replace(re, (m) => {
      const leadUpper = m[0] !== m[0].toLowerCase() && m[0] === m[0].toUpperCase();
      return leadUpper ? canonical.charAt(0).toUpperCase() + canonical.slice(1) : canonical;
    });
  }
  return out;
}

// Term-shape guard (finding S2): terminology rows are interpolated into the
// INSTRUCTION zone of translator/validator prompts, so a term must never be
// able to smuggle structure — single line, no brace characters (placeholder
// syntax), no '__' (sentinel syntax), hard cap 64 chars.
const MAX_TERM_LENGTH = 64;

function assertSafeTerm(field, value) {
  const term = String(value ?? '');
  const fail = (why) => {
    const err = new Error(`unsafe term shape: ${field} ${why}`);
    err.code = 'UNSAFE_TERM_SHAPE';
    throw err;
  };
  if (!term.trim()) fail('must be a non-empty string');
  if (term.length > MAX_TERM_LENGTH) fail(`exceeds ${MAX_TERM_LENGTH} chars (got ${term.length})`);
  if (/[\r\n]/.test(term)) fail('must be a single line');
  if (term.includes('{') || term.includes('}')) fail('must not contain brace characters');
  if (term.includes('__')) fail('must not contain the sentinel sequence "__"');
}

/**
 * Upsert a validated terminology row. Callers pass the validator's identity
 * and note so the row is auditable (spec: the glossary grows ONLY from
 * validated edits — never from a raw user preference). Throws UNSAFE_TERM_SHAPE
 * when either term fails the shape guard — nothing unsafe ever enters the DB.
 */
export function upsertTerminology(db, { lang, sourceTerm, approvedTerm, validatedBy, validationNote = null }) {
  assertSafeTerm('sourceTerm', sourceTerm);
  assertSafeTerm('approvedTerm', approvedTerm);
  db.prepare(
    `INSERT INTO terminology (lang, source_term, approved_term, validated_by, validation_note, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(lang, source_term) DO UPDATE SET
       approved_term = excluded.approved_term,
       validated_by = excluded.validated_by,
       validation_note = excluded.validation_note,
       updated_at = excluded.updated_at`
  ).run(lang, sourceTerm, approvedTerm, validatedBy, validationNote, new Date().toISOString());
}
