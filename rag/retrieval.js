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
import { retrieveKnowledge } from './knowledge_retriever.js';

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

// ── Multi-level fusion (RRF) ──────────────────────────────────────────────────
//
// retrieveMultiLevel fuses two retrieval paths that score on incomparable
// scales — the levelled knowledge corpus (L0 statute / L1 guidance, score =
// bm25+topic) and the news index (L2 threat feeds, finalScore = fts+keywords+
// recency) — into one ranking. Directly comparing their raw scores would be
// meaningless (a knowledge score of 13 is not "better" than an article score of
// 8), so we use Reciprocal Rank Fusion: each list contributes 1/(k+rank) per
// item (rank 0-based), and an item's fused score is the SUM across the lists it
// appears in. RRF depends only on POSITION, not raw magnitude, so it blends the
// two scales fairly and rewards items that rank well in either path. k=60 is the
// standard RRF constant (Cormack et al.): large enough that top ranks are not
// wildly over-weighted, small enough that rank still matters.
//
// Dedup is by a namespaced id — knowledge ids are strings (framework-scoped),
// article ids are integers, so collisions across sources cannot happen, but we
// still merge duplicates WITHIN a list defensively (first occurrence wins).

const RRF_K = 60;

/**
 * Compute Reciprocal Rank Fusion over N ranked lists.
 * @param {Array<{items: object[], idOf: (o:object)=>string, level: number}>} lists
 * @param {number} k RRF constant (default 60)
 * @returns {object[]} fused, dedup'd items each with { rrfScore, sources[] }, sorted desc
 */
export function reciprocalRankFusion(lists, k = RRF_K) {
  const byId = new Map();
  for (const { items, idOf, level } of lists) {
    const seenInList = new Set();
    items.forEach((item, rank) => {
      const id = idOf(item);
      if (seenInList.has(id)) return; // dedup within a single list (first wins)
      seenInList.add(id);
      const contribution = 1 / (k + rank);
      const existing = byId.get(id);
      if (existing) {
        existing.rrfScore += contribution;
        existing.sources.push({ level, rank });
      } else {
        byId.set(id, { ...item, id, rrfScore: contribution, sources: [{ level, rank }] });
      }
    });
  }
  return [...byId.values()].sort((a, b) => b.rrfScore - a.rrfScore);
}

/**
 * Retrieve across levels and fuse with RRF. L0/L1 come from the `knowledge`
 * corpus (levelled retriever), L2 from the existing news article path. The
 * EXISTING retrieve() is untouched — this is additive; the content pipeline can
 * opt into grounded, cited retrieval without changing the news-only path.
 *
 * @param {object} opts
 * @param {import('better-sqlite3').Database} opts.db
 * @param {string} [opts.query]
 * @param {string[]} [opts.keywords]
 * @param {string[]} [opts.frameworks]  filter for the knowledge path
 * @param {string[]} [opts.regions]     filter for the knowledge path
 * @param {number[]} [opts.levels]      which knowledge levels to pull (default [0,1])
 * @param {number} [opts.knowledgeLimit=10]
 * @param {number} [opts.articleLimit=10]
 * @param {number} [opts.limit=10]      final fused list cap
 * @param {number} [opts.k=60]          RRF constant
 * @returns {{ fused: object[], knowledge: object[], articles: object[] }}
 */
export function retrieveMultiLevel({
  db, query = '', keywords = [], frameworks = null, regions = null,
  levels = [0, 1], knowledgeLimit = 10, articleLimit = 10, limit = 10, k = RRF_K, snapshot = null
} = {}) {
  const terms = [
    ...String(query || '').split(/\s+/),
    ...(keywords || [])
  ].map((s) => String(s || '').trim()).filter(Boolean);

  const knowledge = retrieveKnowledge({ db, query, keywords, frameworks, regions, levels, limit: knowledgeLimit });
  const articles = retrieve(db, terms, { limit: articleLimit, snapshot });

  const fused = reciprocalRankFusion([
    { items: knowledge, idOf: (e) => `k:${e.id}`, level: 0 },
    { items: articles, idOf: (a) => `a:${a.id}`, level: 2 }
  ], k).slice(0, limit);

  return { fused, knowledge, articles };
}
