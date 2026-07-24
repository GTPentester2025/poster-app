// Hybrid retrieval over the news index. Three signals per candidate:
//
//   ftsNorm       — FTS5 bm25 rank normalized into 0..10 as a RATIO to the
//                   best match (bm25 is negative, lower-is-better, unbounded —
//                   the ratio keeps near-equal matches near-equal instead of
//                   min-max exploding tiny rank differences to the full range)
//   scoringPoints — keyword-weight score of title+description (scoring.scoreText,
//                   +5 critical / +2 context / -3 noise — same as ingest gate)
//   recencyWeight — exp(-ageDays / 30): ~1.0 today, ~0.37 at 30 days, ~0.14 at
//                   60; posters should lean on current attacker techniques
//
//   finalScore = ftsNorm + scoringPoints + 10 * recencyWeight
//
// The 10x multiplier puts recency on the same magnitude as two critical
// keyword hits, so a fresh mid-relevance article can beat a stale keyword-
// stuffed one but never outrank a strong recent match.

import * as scoring from './scoring.js';
import { getScoringSnapshot } from './keyword_store.js';

const RECENCY_HALF_LIFE_DAYS = 30;
const RECENCY_MAGNITUDE = 10;
const FTS_NORM_MAX = 10;

// FTS5 treats bare tokens as query syntax (AND/OR/NEAR, column filters), so
// every user keyword is double-quote-escaped into a phrase literal.
function buildMatchQuery(keywords) {
  return keywords
    .map((k) => `"${String(k).replace(/"/g, '""')}"`)
    .join(' OR ');
}

export function recencyWeight(pubDate, now = Date.now()) {
  const t = Date.parse(pubDate || '');
  if (Number.isNaN(t)) return 0;
  const ageDays = Math.max(0, (now - t) / 86_400_000);
  return Math.exp(-ageDays / RECENCY_HALF_LIFE_DAYS);
}

/**
 * Retrieve the top-N articles for a keyword set.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string[]} keywords search terms (OR semantics)
 * @param {object} opts { limit=10, snapshot=null } — snapshot overrides the
 *   stored keyword lists (retrieval and ingest then score identically)
 * @returns {object[]} articles (all columns) + ftsNorm/scoringPoints/recencyWeight/finalScore,
 *   sorted by finalScore desc. Empty index or no matches -> [].
 */
export function retrieve(db, keywords, { limit = 10, snapshot = null } = {}) {
  const terms = (keywords || []).map((k) => String(k || '').trim()).filter(Boolean);
  if (!terms.length) return [];

  let rows;
  try {
    rows = db.prepare(`
      SELECT a.*, bm25(articles_fts) AS fts_rank
      FROM articles_fts
      JOIN articles a ON a.id = articles_fts.rowid
      WHERE articles_fts MATCH ?
    `).all(buildMatchQuery(terms));
  } catch {
    // Empty/missing FTS index or a term FTS still rejects — retrieval must
    // degrade to "no research found", not crash the pipeline.
    return [];
  }
  if (!rows.length) return [];

  const snap = snapshot || getScoringSnapshot(db);
  // bm25 in SQLite is negative for matches, more negative = better. Use each
  // row's magnitude relative to the best match: best -> 10, half-as-strong
  // -> 5. Proportional (unlike min-max), so two near-identical matches keep
  // near-identical ftsNorm and recency/keywords can break the tie.
  const bestMagnitude = Math.max(...rows.map((r) => Math.abs(r.fts_rank)));

  const now = Date.now();
  const scored = rows.map((row) => {
    const ftsNorm = bestMagnitude > 0 ? FTS_NORM_MAX * (Math.abs(row.fts_rank) / bestMagnitude) : FTS_NORM_MAX;
    const scoringPoints = scoring.scoreText(`${row.title || ''} ${row.description || ''}`, snap);
    const recency = recencyWeight(row.pub_date, now);
    return {
      ...row,
      ftsNorm,
      scoringPoints,
      recencyWeight: recency,
      finalScore: ftsNorm + scoringPoints + RECENCY_MAGNITUDE * recency
    };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);
  return scored.slice(0, limit);
}
