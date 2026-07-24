// Feed relevance scoring — VERBATIM port of reference js/feed_scoring.js
// (methodology aligned with new_tprm/prod: weighted terms + CVE id exclusion).
// - CRITICAL terms: +5 each (defaults tuned for employee security awareness)
// - CONTEXT terms: +2 each
// - NOISE terms: -3 each (defaults tuned to down-rank deep technical / vuln write-ups)
// - Items whose title+summary match CVE-\d{4}-\d+ are excluded (same as prod fetch()).
// - Item is included when score >= MIN_SCORE (5, prod-aligned).
//
// Pure functions only: keyword persistence lives in keyword_store.js, which
// passes a snapshot in. Weights and lists stay aligned with the reference,
// with one deliberate fix: the reference's trailing-space boundary sentinels
// ('bec ', 'poc ') are replaced by real word-boundary matching (termMatches),
// because keyword_store's normalize() trims keywords on save and the trimmed
// forms substring-matched inside 'quebec'/'epoch'.

const CVE_RE = /CVE-\d{4}-\d+/i;
const WEIGHT_CRITICAL = 5;
const WEIGHT_CONTEXT = 2;
const WEIGHT_NOISE = -3;
export const MIN_SCORE = 5;

export const DEFAULT_CRITICAL = [
  'breach', 'ransomware', 'data leak', 'outage', 'compromise',
  'phishing', 'phish', 'spear phishing', 'smishing', 'vishing', 'quishing',
  'cybercrime', 'cyber crime', 'scam', 'scams', 'fraud', 'social engineering',
  'business email compromise', 'bec', 'fake email', 'suspicious email',
  'credential theft', 'credential stuffing', 'account takeover', 'identity theft',
  'password', 'password manager', 'multi-factor', 'mfa', '2fa', 'authenticator', 'passkey',
  'security awareness', 'security training', 'insider threat', 'insider risk',
  'deepfake', 'gift card scam', 'tech support scam', 'romance scam', 'pig butcher',
  'malware', 'spyware', 'stolen data', 'dark web', 'whaling', 'impersonation'
];

export const DEFAULT_CONTEXT = ['aws', 'azure', 'cloud', 'vendor', 'third party', 'employer', 'workplace', 'remote work'];

export const DEFAULT_NOISE = [
  'tutorial', 'guide', 'how to',
  'cve', 'cwe', 'cvss', 'nvd', 'cpe',
  'vulnerability', 'vulnerabilities', 'exploit', 'exploits', 'exploited',
  'zero-day', 'zero day', '0-day',
  'rce', 'privilege escalation', 'proof of concept', 'poc',
  'patch tuesday', 'security patch', 'kernel bug', 'buffer overflow',
  'sql injection', 'xss', 'cross-site scripting', 'ssrf', 'csrf',
  'use-after-free', 'integer overflow', 'heap overflow', 'stack overflow',
  'remote code execution', 'disclosure:', 'security advisory', 'vendor advisory',
  'proof-of-concept', 'metasploit', 'fuzzing', 'disassembler', 'decompiler',
  'openssl', 'firmware update', 'microcode', 'speculative execution',
  'side channel', 'rowhammer', 'memory corruption', 'type confusion'
];

/**
 * Fill missing/empty lists with defaults. Empty list == "use defaults" — same
 * semantics as the reference, so a wiped keywords table degrades safely.
 */
export function normalizeSnapshot(snapshot) {
  const s = snapshot || {};
  return {
    critical: Array.isArray(s.critical) && s.critical.length ? s.critical : DEFAULT_CRITICAL,
    context: Array.isArray(s.context) && s.context.length ? s.context : DEFAULT_CONTEXT,
    noise: Array.isArray(s.noise) && s.noise.length ? s.noise : DEFAULT_NOISE
  };
}

// Short abbreviations like 'bec'/'poc'/'cve'/'rce' need special matching:
// they would otherwise substring-match inside innocent words ('quebec'
// contains 'bec', 'epoch' contains 'poc', 'recent' contains 'rce').
// Multi-word or >=5-char terms use substring; short single-word alnum terms
// use word boundaries. Shared by all three lists — the old trailing-space
// sentinels ('bec ', 'poc ') are gone: keyword_store normalize() trimmed
// them on save, corrupting scores after any keyword mutation.
function termMatches(text, term) {
  const t = String(term || '').trim().toLowerCase();
  if (!t) return false;
  if (t.includes(' ') || t.length >= 5) return text.includes(t);
  if (/[^a-z0-9-]/.test(t)) return text.includes(t);
  try {
    return new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
  } catch {
    return text.includes(t);
  }
}

/** Weighted keyword score of a text (already-lowercased matching, +5/+2/-3). */
export function scoreText(rawText, snapshot = null) {
  const lists = normalizeSnapshot(snapshot);
  const text = String(rawText || '').toLowerCase();
  let s = 0;
  for (const w of lists.critical) {
    if (w && termMatches(text, w)) s += WEIGHT_CRITICAL;
  }
  for (const w of lists.context) {
    if (w && termMatches(text, w)) s += WEIGHT_CONTEXT;
  }
  for (const w of lists.noise) {
    if (w && termMatches(text, w)) s += WEIGHT_NOISE;
  }
  return s;
}

export function hasCveReference(text) {
  return CVE_RE.test(String(text || ''));
}

/**
 * Include gate used per feed item: CVE-tagged items are vuln write-ups, not
 * employee-awareness material, so they are excluded outright regardless of score.
 */
export function shouldIncludeItem(title, description, snapshot = null) {
  const text = `${title || ''} ${description || ''}`;
  if (hasCveReference(text)) return false;
  return scoreText(text, snapshot) >= MIN_SCORE;
}
