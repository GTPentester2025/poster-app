// Backfill asset description + tags (client #3d).
//
// Iterates library images that are MISSING meta.description and derives a
// description + tags for each so the auto-recommend dedupe engine can consider
// them. Derivation is DETERMINISTIC by default (no model call, no cost): it uses
// the stored concept/styleHint/maskedPrompt already on the row. Pass --vision to
// additionally run the vision tagger per asset (costs money — off by default).
//
// USAGE:
//   node poster-app/scripts/backfill_asset_tags.mjs --db <path/to/app.sqlite> [--vision] [--dry-run] [--limit N]
//
// Do NOT run against the real DB casually — the --vision flag makes a paid model
// call per asset. Build + unit-test it against a TEMP DB (see backfill.test.js).

import process from 'node:process';
import { readFileSync, existsSync } from 'node:fs';
import { openDb } from '../backend/db.js';
import { deriveAssetTags, getImagePath } from '../image-library/store.js';
import { tagImage } from '../agents/image_tagger.js';

/** Pull whatever concept text an old row carries: meta concept/styleHint, else maskedPrompt. */
function conceptFromMeta(meta) {
  if (!meta || typeof meta !== 'object') return '';
  return String(
    meta.concept || meta.styleHint || meta.description || meta.maskedPrompt || meta.promptUsed || ''
  ).trim();
}

/** Signals for an old row: prefer a stored signals array, else none (mined from concept). */
function signalsFromMeta(meta) {
  if (meta && Array.isArray(meta.signals) && meta.signals.length) return meta.signals.map(String);
  // no stored signals — let deriveAssetTags mine tags from concept/point below
  return [];
}

/**
 * Backfill description + tags for images missing meta.description.
 * @param {object} opts
 *   db        — better-sqlite3 Database
 *   egress    — optional MaskingEgress (only used when vision=true)
 *   vision    — run the vision tagger per asset (default false)
 *   dryRun    — compute but do not write (default false)
 *   limit     — max rows to process (default Infinity)
 *   assetsDir — override for tests (vision needs to read the file)
 * @returns {Promise<{scanned, updated, skipped, visionUsed, errors}>}
 */
export async function backfillAssetTags({ db, egress = null, vision = false, dryRun = false, limit = Infinity, assetsDir = undefined } = {}) {
  const rows = db.prepare('SELECT image_id, topics, style, meta, file_name FROM images ORDER BY created_at ASC, rowid ASC').all();
  const summary = { scanned: 0, updated: 0, skipped: 0, visionUsed: 0, errors: 0 };
  const update = db.prepare('UPDATE images SET meta = ? WHERE image_id = ?');

  for (const row of rows) {
    if (summary.updated >= limit) break;
    summary.scanned += 1;
    let meta = {};
    try { meta = row.meta ? JSON.parse(row.meta) : {}; } catch { meta = {}; }

    // Already has a description → nothing to do.
    if (typeof meta.description === 'string' && meta.description.trim()) {
      summary.skipped += 1;
      continue;
    }

    const isBg = meta.kind === 'background';
    let topics = [];
    try { topics = row.topics ? JSON.parse(row.topics) : []; } catch { topics = []; }

    let description = '';
    let tags = [];

    // 1. Optional vision enrichment (paid) — highest quality.
    if (vision && egress) {
      try {
        const filePath = getImagePath(row, assetsDir);
        if (existsSync(filePath)) {
          const mediaType = row.file_name?.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
          const imageBase64 = readFileSync(filePath).toString('base64');
          const suggestion = await tagImage({ egress, runId: `backfill-${row.image_id}`, imageBase64, mediaType });
          if (suggestion) {
            summary.visionUsed += 1;
            if (suggestion.description) description = suggestion.description;
            if (Array.isArray(suggestion.tags) && suggestion.tags.length) tags = suggestion.tags;
          }
        }
      } catch { summary.errors += 1; /* fall through to deterministic */ }
    }

    // 2. Deterministic derivation from stored concept/meta (no cost) — fills any
    //    gap the vision step left (or the whole thing when vision is off).
    if (!description || !tags.length) {
      const concept = conceptFromMeta(meta);
      // Topics lead the signals list so relevance-by-topic tags always survive
      // the 8-tag cap; stored signals (if any) follow.
      const signals = [...topics.map(String), ...signalsFromMeta(meta)];
      const derived = deriveAssetTags({
        concept: description || concept,
        point: concept || (topics[0] || ''),
        signals,
        treatment: meta.treatment || (isBg ? 'image' : ''),
        sizeClass: meta.sizeClass || (isBg ? 'bg' : 'card'),
        palette: meta.palette || null,
        isBg
      });
      if (!description) description = derived.description;
      if (!tags.length) tags = derived.tags;
    }

    meta.description = description;
    meta.tags = tags;
    if (!dryRun) update.run(JSON.stringify(meta), row.image_id);
    summary.updated += 1;
  }

  return summary;
}

// ── CLI entry ────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { db: null, vision: false, dryRun: false, limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--vision') args.vision = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--db') args.db = argv[++i];
    else if (a === '--limit') args.limit = Number(argv[++i]) || Infinity;
  }
  return args;
}

// Run only when invoked directly (not when imported by tests).
const invokedDirectly = process.argv[1] && process.argv[1].endsWith('backfill_asset_tags.mjs');
if (invokedDirectly) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.db) {
    console.error('Usage: node scripts/backfill_asset_tags.mjs --db <path> [--vision] [--dry-run] [--limit N]');
    process.exit(2);
  }
  const db = openDb(args.db);
  // NOTE: --vision requires a real egress; the CLI does not wire one (paid model
  // calls should be opt-in via a proper app context). Deterministic mode needs none.
  if (args.vision) {
    console.error('--vision from the bare CLI is not wired to an egress; run it through an app context instead. Proceeding deterministically.');
    args.vision = false;
  }
  backfillAssetTags({ db, vision: false, dryRun: args.dryRun, limit: args.limit })
    .then((summary) => {
      console.log('Backfill complete:', JSON.stringify(summary, null, 2));
      db.close();
    })
    .catch((err) => {
      console.error('Backfill failed:', err);
      db.close();
      process.exit(1);
    });
}
