// First-run poster-library seeding.
//
// The runtime DB (data/poster-app.sqlite) is git-IGNORED: the app writes to it
// constantly, so tracking it in git makes every `git pull` conflict on a
// locally-modified binary — which is exactly why a pulled checkout stopped
// showing the shipped posters. Instead we commit read-only SEED databases
// that the app NEVER writes:
//
//   data/poster-seed.sqlite        — empty poster library (schema only)
//   data/knowledge-seed.sqlite    — pre-populated DPDP + Phishing articles + FTS5
//   data/image-library-seed.sqlite — image metadata schema
//
// On first run, seeds are merged into the runtime DB. `git pull` always
// updates them cleanly. The runtime DB is never committed.
//
// Seeding strategy:
//   - poster-seed: copy entire DB (empty schema for user-created content)
//   - knowledge-seed: ATTACH and INSERT articles + keywords (preserves user data)
//   - image-library-seed: ATTACH and INSERT image metadata (preserves user images)

import { existsSync, copyFileSync } from 'node:fs';
import Database from 'better-sqlite3';

/**
 * Copy the committed poster-seed DB into the runtime path when the runtime DB
 * does not yet exist. No-op when runtime DB is already present.
 */
export function seedIfAbsent(runtimePath, seedPath) {
  if (!runtimePath || runtimePath === ':memory:') return false;
  if (existsSync(runtimePath)) return false;
  if (!seedPath || !existsSync(seedPath)) return false;
  copyFileSync(seedPath, runtimePath);
  return true;
}

/**
 * Merge knowledge seed articles + keywords into the runtime DB.
 * Uses ATTACH to avoid keeping two connections open.
 * Idempotent: skips articles with duplicate url_hash.
 */
export function seedKnowledge(runtimePath, knowledgeSeedPath) {
  if (!runtimePath || runtimePath === ':memory:') return false;
  if (!knowledgeSeedPath || !existsSync(knowledgeSeedPath)) return false;

  const db = new Database(runtimePath);
  try {
    db.pragma('journal_mode = WAL');
    db.exec(`ATTACH DATABASE '${knowledgeSeedPath}' AS seed`);

    // Merge articles (skip duplicates by url_hash)
    const newArticles = db.prepare(`
      INSERT INTO main.articles (title, source, source_id, url, description, summary, watchouts, pub_date, type, threat_level, relevance_score, tier, seeded, fetched_at)
      SELECT s.title, s.source, s.source_id, s.url, s.description, s.summary, s.watchouts, s.pub_date, s.type, s.threat_level, s.relevance_score, s.tier, 1, datetime('now')
      FROM seed.articles s
      WHERE s.url_hash IS NULL OR s.url_hash NOT IN (SELECT url_hash FROM main.articles WHERE url_hash IS NOT NULL)
    `).run();
    console.log(`[seed] knowledge: ${newArticles.changes} new articles`);

    // Merge keywords
    const newKeywords = db.prepare(`
      INSERT OR IGNORE INTO main.keywords (list_type, keyword, added_at)
      SELECT s.list_type, s.keyword, datetime('now') FROM seed.keywords s
    `).run();
    if (newKeywords.changes) console.log(`[seed] knowledge: ${newKeywords.changes} new keywords`);

    db.exec('DETACH DATABASE seed');
    return true;
  } catch (err) {
    console.error('[seed] knowledge merge failed:', err.message);
    try { db.exec('DETACH DATABASE seed'); } catch { /* best effort */ }
    return false;
  } finally {
    db.close();
  }
}

/**
 * Merge image library seed metadata into the runtime DB.
 */
export function seedImageLibrary(runtimePath, imageSeedPath) {
  if (!runtimePath || runtimePath === ':memory:') return false;
  if (!imageSeedPath || !existsSync(imageSeedPath)) return false;

  const db = new Database(runtimePath);
  try {
    db.pragma('journal_mode = WAL');
    db.exec(`ATTACH DATABASE '${imageSeedPath}' AS seed`);

    const newImages = db.prepare(`
      INSERT OR IGNORE INTO main.images (image_id, file_name, origin, topics, style, palette, format, zero_text_checked, zero_text_passed, created_at, meta)
      SELECT s.image_id, s.file_name, s.origin, s.topics, s.style, s.palette, s.format, s.zero_text_checked, s.zero_text_passed, s.created_at, s.meta
      FROM seed.images s
    `).run();
    if (newImages.changes) console.log(`[seed] image-library: ${newImages.changes} new images`);

    db.exec('DETACH DATABASE seed');
    return true;
  } catch (err) {
    console.error('[seed] image-library merge failed:', err.message);
    try { db.exec('DETACH DATABASE seed'); } catch { /* best effort */ }
    return false;
  } finally {
    db.close();
  }
}
