// Seed the levelled `knowledge` corpus into SQLite. The seeder is the single
// write path for the knowledge table: it validates the whole corpus against the
// shared contract (rag/knowledge/schema.js) BEFORE touching the DB, then upserts
// each entry by its stable string id. The FTS index (knowledge_fts) stays in
// sync automatically via the insert/delete/update triggers created in the v7
// migration — INSERT OR REPLACE fires DELETE+INSERT, so a re-seed of a changed
// entry deletes the stale FTS row and inserts the fresh one. Idempotent: running
// it twice with the same corpus leaves the table (and FTS) unchanged.

import { validateCorpus, toRow } from './knowledge/schema.js';

/**
 * Validate + upsert a KnowledgeEntry[] corpus into the `knowledge` table.
 *
 * @param {import('better-sqlite3').Database} db  migrated DB (v7+)
 * @param {object[]} entries  KnowledgeEntry[] conforming to knowledge/schema.js
 * @returns {{ seeded: number, total: number }}
 * @throws {Error} code KNOWLEDGE_CORPUS_INVALID with .problems when validation fails
 */
export function seedKnowledge(db, entries) {
  const report = validateCorpus(entries);
  if (!report.ok) {
    const detail = [...report.problems];
    if (report.duplicateIds.length) detail.push(`duplicate ids: ${report.duplicateIds.join(', ')}`);
    const err = new Error(`Knowledge corpus invalid: ${detail.join('; ')}`);
    err.code = 'KNOWLEDGE_CORPUS_INVALID';
    err.problems = detail;
    throw err;
  }

  // INSERT OR REPLACE keyed on the TEXT PK makes re-seeding idempotent and lets
  // corpus authors ship corrections without a migration. The FTS triggers keep
  // knowledge_fts consistent through the implicit DELETE half of REPLACE.
  const upsert = db.prepare(`
    INSERT OR REPLACE INTO knowledge
      (id, framework, citation, level, region, title, summary, text,
       obligations, penalties, applies_to, topics, poster_angles, seeded)
    VALUES
      (@id, @framework, @citation, @level, @region, @title, @summary, @text,
       @obligations, @penalties, @applies_to, @topics, @poster_angles, @seeded)
  `);

  const tx = db.transaction((rows) => {
    for (const r of rows) upsert.run(r);
    return rows.length;
  });

  const seeded = tx(entries.map(toRow));
  return { seeded, total: entries.length };
}
