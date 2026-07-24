// Redaction core (spec §B.12): company/org data NEVER reaches a model.
// Pure functions — no IO — so leak tests can prove behavior exhaustively.
//
// Two layers:
//   1. Org-config masking: known org values -> stable placeholders ({{ORG_NAME}})
//      that read naturally to the model and are re-inserted on the way back.
//      Pattern-matched org-domain emails/URLs are captured into INDEXED
//      placeholders ({{ORG_EMAIL_1}}) so restore is fully reversible.
//   2. Token protection (ported from reference repo translation.js protectTokens):
//      URLs / emails / reference codes -> __LOCK_n__ so models can't mangle them.
//
// heavyRedaction mode additionally scrubs internal reference ids by pattern —
// built now for the future policy/SOP pipeline (spec §8).
//
// Minimum maskable value length is 3: two-character values ("IT", "HR") would
// both over-mask prose and collide with placeholder tokens like {{IT_HELPDESK}},
// turning the leak guard into a false-positive machine. Enforced here and in
// the vault docs.

const PLACEHOLDER_FIELDS = [
  { key: 'companyName', placeholder: '{{ORG_NAME}}' },
  { key: 'socEmail', placeholder: '{{SOC_EMAIL}}' },
  { key: 'trainingPortalUrl', placeholder: '{{TRAINING_PORTAL}}' },
  { key: 'contentPortalUrl', placeholder: '{{CONTENT_PORTAL}}' },
  { key: 'reportingUrl', placeholder: '{{REPORTING_URL}}' },
  { key: 'itHelpdesk', placeholder: '{{IT_HELPDESK}}' }
];

const MIN_VALUE_LENGTH = 3;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Normalize a config value for matching: NFC unicode, strip control chars. */
function cleanValue(value) {
  if (typeof value !== 'string') return '';
   
  return value.normalize('NFC').replace(/[\x00-\x1F\x7F]/g, '').trim();
}

/**
 * Build the mask map from org config. Longer values first so overlapping
 * values (e.g. "AB InBev Security Portal" vs "AB InBev") mask outside-in.
 * The map is STATEFUL for pattern captures: redact() appends captured
 * domain-email/URL originals so restore() can reverse them exactly.
 */
export function buildMaskMap(orgConfig, { heavyRedaction = false } = {}) {
  const entries = [];
  for (const { key, placeholder } of PLACEHOLDER_FIELDS) {
    const value = cleanValue(orgConfig?.[key]);
    if (value.length >= MIN_VALUE_LENGTH) {
      entries.push({ value, placeholder });
    }
  }
  const custom = Array.isArray(orgConfig?.customSensitiveTerms) ? orgConfig.customSensitiveTerms : [];
  custom.forEach((term, i) => {
    const value = cleanValue(term);
    if (value.length >= MIN_VALUE_LENGTH) {
      entries.push({ value, placeholder: `{{SENSITIVE_${i + 1}}}` });
    }
  });
  const domains = Array.isArray(orgConfig?.orgDomains)
    ? orgConfig.orgDomains.map(cleanValue).filter((d) => d.includes('.') && d.length >= MIN_VALUE_LENGTH)
    : [];
  entries.sort((a, b) => b.value.length - a.value.length);
  return { entries, domains, heavyRedaction, captured: [] };
}

/**
 * Redact text before it leaves to any model.
 * Returns { masked, hits }. Domain-pattern matches are captured into
 * maskMap.captured as indexed placeholders for exact restoration.
 */
export function redact(text, maskMap) {
  if (typeof text !== 'string') throw new Error('redact() requires a string');
  let masked = text.normalize('NFC');
  let hits = 0;
  for (const { value, placeholder } of maskMap.entries) {
    const re = new RegExp(escapeRegExp(value), 'gi');
    masked = masked.replace(re, () => { hits++; return placeholder; });
  }
  const capture = (prefix) => (match) => {
    hits++;
    const placeholder = `{{${prefix}_${maskMap.captured.length + 1}}}`;
    maskMap.captured.push({ placeholder, original: match });
    return placeholder;
  };
  for (const domain of maskMap.domains) {
    // emails on org domains
    const emailRe = new RegExp(`\\b[A-Z0-9._%+-]+@(?:[A-Z0-9-]+\\.)*${escapeRegExp(domain)}\\b`, 'gi');
    masked = masked.replace(emailRe, capture('ORG_EMAIL'));
    // URLs/hosts on org domains
    const urlRe = new RegExp(`(?:https?://)?(?:[A-Z0-9-]+\\.)*${escapeRegExp(domain)}(?:/[^\\s"'<>]*)?`, 'gi');
    masked = masked.replace(urlRe, capture('ORG_URL'));
  }
  if (maskMap.heavyRedaction) {
    // heavy mode: strip anything that looks like an internal doc id or employee id
    masked = masked.replace(/\b(?:DOC|POL|SOP|EMP|HR)-\d{2,}\b/gi, capture('INTERNAL_REF'));
  }
  return { masked, hits };
}

/** Re-insert real values into a model response. Fully reverses redact(). */
export function restore(text, maskMap, orgConfig) {
  if (typeof text !== 'string') return text;
  let restored = text;
  for (const { key, placeholder } of PLACEHOLDER_FIELDS) {
    const value = cleanValue(orgConfig?.[key]);
    if (value) restored = restored.split(placeholder).join(value);
  }
  const custom = Array.isArray(orgConfig?.customSensitiveTerms) ? orgConfig.customSensitiveTerms : [];
  custom.forEach((term, i) => {
    const value = cleanValue(term);
    if (value) restored = restored.split(`{{SENSITIVE_${i + 1}}}`).join(value);
  });
  for (const { placeholder, original } of maskMap?.captured || []) {
    restored = restored.split(placeholder).join(original);
  }
  return restored;
}

/**
 * Assert a payload that is about to leave contains no real org values.
 * Used as the egress guard AND by leak tests. Throws on any leak.
 * Placeholder tokens are stripped before matching so a masked payload can
 * never false-positive against its own placeholders (e.g. companyName "IT"
 * vs {{IT_HELPDESK}} — also prevented by MIN_VALUE_LENGTH).
 */
export function assertNoLeaks(payloadText, orgConfig) {
  const scrubbed = String(payloadText)
    .replace(/\{\{[A-Z0-9_]+\}\}/g, ' ')
    .replace(/__LOCK_\d+__/g, ' ')
    .normalize('NFC')
    .toLowerCase();
  const problems = [];
  const check = (label, rawValue) => {
    const value = cleanValue(rawValue).toLowerCase();
    if (value.length >= MIN_VALUE_LENGTH && scrubbed.includes(value)) {
      problems.push(label);
    }
  };
  for (const { key } of PLACEHOLDER_FIELDS) check(key, orgConfig?.[key]);
  (orgConfig?.customSensitiveTerms || []).forEach((t, i) => check(`customSensitiveTerms[${i}]`, t));
  (orgConfig?.orgDomains || []).forEach((d, i) => check(`orgDomains[${i}]`, d));
  if (problems.length) {
    const err = new Error(`MASKING LEAK BLOCKED: outbound payload contains org config values: ${problems.join(', ')}`);
    err.code = 'MASKING_LEAK';
    throw err;
  }
}

// ---- Token protection (ported from reference repo js/ui/translation.js) ----

const LOCK_PATTERNS = [
  /https?:\/\/[^\s"'<>]+/g, // URLs
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, // emails
  /\b[A-Z]{2,}-\d{3,}\b/g // reference codes (IND-01 style)
];

export function protectTokens(text) {
  const protectedTokens = [];
  let out = text;
  for (const re of LOCK_PATTERNS) {
    out = out.replace(re, (match) => {
      const token = `__LOCK_${protectedTokens.length}__`;
      protectedTokens.push(match);
      return token;
    });
  }
  return { text: out, protectedTokens };
}

export function restoreTokens(text, protectedTokens) {
  let out = text;
  protectedTokens.forEach((original, i) => {
    out = out.split(`__LOCK_${i}__`).join(original);
  });
  return out;
}

export { PLACEHOLDER_FIELDS, MIN_VALUE_LENGTH };
