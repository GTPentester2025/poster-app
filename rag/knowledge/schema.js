// Shared contract for the multi-level knowledge corpus. Every framework corpus
// file (gdpr.js, dpdp.js, ccpa.js, …) exports an array of KnowledgeEntry objects
// that conform to this schema; the RAG engine seeds them into the `knowledge`
// table + FTS index and the levelled retriever ranks/cites them. Keeping the
// contract in one place lets the corpus files and the engine be built in
// parallel without drift.
//
// Content policy: `summary`/`text` are AUTHORITATIVE PARAPHRASE of the
// provision (accurate, plain-language) — never a verbatim statute dump. Laws
// are not copyrightable, but paraphrase + obligations + posterAngles is what
// grounding actually needs and keeps the corpus clean and useful.

export const FRAMEWORKS = ['GDPR', 'DPDP', 'CCPA', 'HIPAA', 'PCI-DSS', 'ISO-27001', 'NIST-CSF', 'CERT-In'];
export const REGIONS = ['EU', 'IN', 'US', 'GLOBAL'];

// Retrieval levels: 0 statute (authoritative), 1 guidance/enforcement,
// 2 news/threat feeds, 3 org knowledge.
export const LEVELS = [0, 1, 2, 3];

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isStrArr = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');

/**
 * Validate one KnowledgeEntry. Returns string[] of problems (empty = valid).
 * @param {object} e
 */
export function validateEntry(e) {
  const p = [];
  if (!e || typeof e !== 'object') return ['entry is not an object'];
  if (!isStr(e.id)) p.push('id must be a non-empty string');
  if (!FRAMEWORKS.includes(e.framework)) p.push(`framework must be one of ${FRAMEWORKS.join('|')}; got "${e.framework}"`);
  if (!isStr(e.citation)) p.push('citation must be a non-empty string');
  if (!LEVELS.includes(e.level)) p.push(`level must be one of ${LEVELS.join('|')}; got ${e.level}`);
  if (!REGIONS.includes(e.region)) p.push(`region must be one of ${REGIONS.join('|')}; got "${e.region}"`);
  if (!isStr(e.title)) p.push('title must be a non-empty string');
  if (!isStr(e.summary)) p.push('summary must be a non-empty string');
  if (!isStr(e.text)) p.push('text must be a non-empty string');
  if (!isStrArr(e.obligations)) p.push('obligations must be a string[]');
  if (!(e.penalties === null || isStr(e.penalties))) p.push('penalties must be a string or null');
  if (!isStrArr(e.appliesTo)) p.push('appliesTo must be a string[]');
  if (!isStrArr(e.topics) || e.topics.length === 0) p.push('topics must be a non-empty string[]');
  if (!isStrArr(e.posterAngles)) p.push('posterAngles must be a string[]');
  return p;
}

/**
 * Validate a whole corpus array; returns { ok, count, problems, duplicateIds }.
 * @param {object[]} entries
 */
export function validateCorpus(entries) {
  const problems = [];
  const seen = new Set();
  const duplicateIds = [];
  if (!Array.isArray(entries)) return { ok: false, count: 0, problems: ['corpus is not an array'], duplicateIds };
  entries.forEach((e, i) => {
    for (const msg of validateEntry(e)) problems.push(`[${i}] ${e?.id || '?'}: ${msg}`);
    if (e && typeof e.id === 'string') {
      if (seen.has(e.id)) duplicateIds.push(e.id);
      seen.add(e.id);
    }
  });
  return { ok: problems.length === 0 && duplicateIds.length === 0, count: entries.length, problems, duplicateIds };
}

/** Flatten an entry to the `knowledge` table row shape (JSON-encoding arrays). */
export function toRow(e) {
  return {
    id: e.id, framework: e.framework, citation: e.citation, level: e.level, region: e.region,
    title: e.title, summary: e.summary, text: e.text,
    obligations: JSON.stringify(e.obligations || []),
    penalties: e.penalties ?? null,
    applies_to: JSON.stringify(e.appliesTo || []),
    topics: (e.topics || []).join(', '),
    poster_angles: JSON.stringify(e.posterAngles || []),
    seeded: 1
  };
}

/** Rehydrate a `knowledge` table row back to a KnowledgeEntry. */
export function fromRow(r) {
  const parse = (v, d) => { try { return JSON.parse(v); } catch { return d; } };
  return {
    id: r.id, framework: r.framework, citation: r.citation, level: r.level, region: r.region,
    title: r.title, summary: r.summary, text: r.text,
    obligations: parse(r.obligations, []),
    penalties: r.penalties ?? null,
    appliesTo: parse(r.applies_to, []),
    topics: typeof r.topics === 'string' ? r.topics.split(',').map((s) => s.trim()).filter(Boolean) : [],
    posterAngles: parse(r.poster_angles, [])
  };
}
