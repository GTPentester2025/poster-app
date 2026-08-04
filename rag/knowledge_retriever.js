// Levelled knowledge retriever. Unlike retrieval.js (news index, recency-heavy),
// the knowledge corpus is authoritative and timeless — statute/guidance entries
// don't age — so scoring blends only two signals:
//
//   ftsNorm       — FTS5 bm25 rank over knowledge_fts (title/summary/text/topics)
//                   normalized 0..10 as a RATIO to the best match (same idiom as
//                   retrieval.js: proportional, not min-max, so near-equal hits
//                   stay near-equal and the topic-overlap tie-breaker can bite)
//   topicOverlap  — count of query keywords that also appear as (or within) the
//                   entry's `topics` tags, scaled by TOPIC_MAGNITUDE. Topics are
//                   the curated hook the corpus authors attach specifically for
//                   retrieval, so a topic hit is worth more than a body-text hit.
//
//   score = ftsNorm + TOPIC_MAGNITUDE * topicOverlap
//
// Framework/region/level filters are applied as SQL WHERE constraints joined
// onto the FTS match, so an off-framework entry never competes for a slot.

import { fromRow } from './knowledge/schema.js';

const FTS_NORM_MAX = 10;
const TOPIC_MAGNITUDE = 3;

// FTS5 treats bare tokens as query syntax; quote every keyword into a phrase
// literal and OR them (same neutralization as retrieval.buildMatchQuery).
function buildMatchQuery(keywords) {
  return keywords
    .map((k) => `"${String(k).replace(/"/g, '""')}"`)
    .join(' OR ');
}

// Count how many query terms hit the entry's curated topic tags. Case-insensitive
// substring both ways so "breach notification" matches a "breach" query term and
// a "data breach" tag matches a "breach" term.
function topicOverlap(terms, topics) {
  const tags = (topics || []).map((t) => String(t).toLowerCase());
  let n = 0;
  for (const raw of terms) {
    const t = String(raw).toLowerCase();
    if (tags.some((tag) => tag.includes(t) || t.includes(tag))) n += 1;
  }
  return n;
}

/**
 * Retrieve ranked knowledge entries for a query.
 *
 * @param {object} opts
 * @param {import('better-sqlite3').Database} opts.db
 * @param {string} [opts.query]         free-text query (tokenized into terms)
 * @param {string[]} [opts.keywords]    explicit terms (merged with query tokens)
 * @param {string[]} [opts.frameworks]  restrict to these frameworks (schema.FRAMEWORKS)
 * @param {string[]} [opts.regions]     restrict to these regions
 * @param {number[]} [opts.levels]      restrict to these levels (0..3)
 * @param {number} [opts.limit=10]
 * @returns {Array<object>} KnowledgeEntry (via fromRow) each with a `score`,
 *   plus `ftsNorm`/`topicOverlap`, sorted by score desc. Empty/no-match -> [].
 */
export function retrieveKnowledge({ db, query = '', keywords = [], frameworks = null, regions = null, levels = null, limit = 10 } = {}) {
  const qTokens = String(query || '').split(/\s+/);
  const terms = [...qTokens, ...(keywords || [])]
    .map((k) => String(k || '').trim())
    .filter(Boolean);
  if (!terms.length) return [];

  const where = ['knowledge_fts MATCH ?'];
  const params = [buildMatchQuery(terms)];

  const inClause = (col, vals) => {
    const list = (vals || []).map((v) => v).filter((v) => v !== null && v !== undefined && v !== '');
    if (!list.length) return;
    where.push(`k.${col} IN (${list.map(() => '?').join(', ')})`);
    params.push(...list);
  };
  inClause('framework', frameworks);
  inClause('region', regions);
  inClause('level', levels);

  let rows;
  try {
    rows = db.prepare(`
      SELECT k.*, bm25(knowledge_fts) AS fts_rank
      FROM knowledge_fts
      JOIN knowledge k ON k.rowid = knowledge_fts.rowid
      WHERE ${where.join(' AND ')}
    `).all(...params);
  } catch {
    // Missing FTS index or a term FTS rejects — degrade to "nothing found".
    return [];
  }
  if (!rows.length) return [];

  const bestMagnitude = Math.max(...rows.map((r) => Math.abs(r.fts_rank)));
  const scored = rows.map((row) => {
    const entry = fromRow(row);
    const ftsNorm = bestMagnitude > 0 ? FTS_NORM_MAX * (Math.abs(row.fts_rank) / bestMagnitude) : FTS_NORM_MAX;
    const overlap = topicOverlap(terms, entry.topics);
    return {
      ...entry,
      ftsNorm,
      topicOverlap: overlap,
      score: ftsNorm + TOPIC_MAGNITUDE * overlap
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
