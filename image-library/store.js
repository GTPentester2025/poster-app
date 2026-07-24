// Image library store (spec §B.7): file + metadata CRUD for the image library.
// Assets are written under assetsDir (default: poster-app/image-library/assets/,
// gitignored — only .gitkeep is tracked). Metadata lives in the images table
// (see db.js migration v1).
//
// Relevant-first ordering: topic-overlap count DESC, then recency. There is no
// hard filter — images with zero overlap are returned after matching ones
// (spec: relevant images first, then the rest).

import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hexToColorWord } from '../agents/image_generator.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_ASSETS_DIR = join(HERE, 'assets');

// ── deterministic asset description + tags (client #3a) ──────────────────────
// Every saved asset gets meta.description (one vivid sentence) + meta.tags (5-8
// precise lowercase tags). For NEW generations we derive these WITHOUT an extra
// model call: the concept IS the description; tags = extracted signals +
// treatment + sizeClass + palette word. The vision tagger stays for manual
// enrichment (autotag route). Shared by the pipeline, the recommender's
// candidate metadata, and the backfill script.

/** Split a phrase into clean lowercase tag tokens (dedup upstream). */
function tagTokens(phrase) {
  return String(phrase || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

/**
 * Derive {description, tags} for an asset deterministically (no model call).
 * @param {object} opts
 *   concept    — the derived image concept (becomes the description; the concept IS the description)
 *   point      — the content point text (used to mine extra tags)
 *   signals    — string[] concrete signals mined from the point (best tag source)
 *   treatment  — background treatment ('' for foreground)
 *   sizeClass  — 'accent'|'card'|'hero'|'bg'
 *   palette    — brand palette (its primary/accent/background words become tags)
 *   isBg       — background asset?
 * @returns {{description: string, tags: string[]}}
 */
export function deriveAssetTags({ concept = '', point = '', signals = [], treatment = '', sizeClass = '', palette = null, isBg = false }) {
  const description = String(concept || point || '').trim()
    || (isBg ? 'a full-bleed atmospheric poster background' : 'a security-awareness illustration');

  const tags = [];
  const push = (t) => {
    const v = String(t || '').toLowerCase().trim();
    if (v && v.length >= 3 && !tags.includes(v)) tags.push(v);
  };

  // 1. concrete signals lead (they carry the teachable specifics)
  for (const s of Array.isArray(signals) ? signals : []) {
    // whole short signal as a tag, plus its salient tokens
    if (s.split(' ').length <= 3) push(s);
    for (const w of tagTokens(s)) push(w);
    if (tags.length >= 6) break;
  }
  // 2. treatment + sizeClass (structural class tags)
  if (treatment) push(treatment);
  if (sizeClass) push(sizeClass);
  if (isBg) push('background'); else push('foreground');
  // 3. palette word (dominant brand color)
  if (palette && typeof palette === 'object') {
    const field = palette.background || palette.dark || palette.secondary;
    const primary = palette.primary || palette.accent;
    if (field) push(hexToColorWord(field));
    if (primary) push(hexToColorWord(primary));
  }
  // 4. top up from the point text if we are short
  if (tags.length < 5) {
    for (const w of tagTokens(point)) { push(w); if (tags.length >= 8) break; }
  }

  return { description, tags: tags.slice(0, 8) };
}

/**
 * Parse pixel dimensions from a PNG buffer's IHDR chunk (width = big-endian
 * uint32 at byte 16, height at byte 20). Generated + uploaded assets are PNG;
 * returns null for anything without a valid PNG signature (callers fall back to
 * the square default). Cheap, dependency-free — used so cover-fit can honor the
 * real aspect of aspect-correct (non-square) renders.
 */
export function pngDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return null;
  const sig = buffer.subarray(0, 8).toString('latin1');
  if (sig !== '\x89PNG\r\n\x1a\n') return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (!width || !height) return null;
  return { width, height };
}

/** Read stored pixel dims from an image row's meta JSON, or null. */
export function imageDims(row) {
  if (!row || !row.meta) return null;
  try {
    const m = JSON.parse(row.meta);
    if (Number.isFinite(m.width) && Number.isFinite(m.height)) return { width: m.width, height: m.height };
  } catch { /* bad meta json — no dims */ }
  return null;
}

/**
 * Save an image buffer to disk and insert a metadata row.
 * @param {object} opts
 *   db          — better-sqlite3 Database
 *   buffer      — Buffer (PNG or JPEG bytes)
 *   origin      — 'library' | 'generated' | 'generated-from-library'
 *   topics      — string[] of topic tags
 *   style       — string | null
 *   format      — string | null
 *   meta        — object | null (stored as JSON)
 *   assetsDir   — override for tests (default: poster-app/image-library/assets/)
 * @returns {object} the inserted DB row
 */
export async function saveImage({ db, buffer, origin, topics = [], style = null, format = null, meta = null, assetsDir = DEFAULT_ASSETS_DIR }) {
  mkdirSync(assetsDir, { recursive: true });
  const imageId = randomUUID();
  // Derive extension from mediaType stored in meta; default to .png.
  const ext = (meta && meta.mediaType === 'image/jpeg') ? '.jpg' : '.png';
  const fileName = `${imageId}${ext}`;
  writeFileSync(join(assetsDir, fileName), buffer);
  const now = new Date().toISOString();
  const topicsJson = JSON.stringify(Array.isArray(topics) ? topics : []);
  // record real pixel dims (from the buffer, or an explicit meta.width/height)
  // so cover-fit can honor aspect-correct non-square renders. Merged into meta
  // to stay migration-free (no new images-table columns).
  const dims = (meta && Number.isFinite(meta.width) && Number.isFinite(meta.height))
    ? { width: meta.width, height: meta.height }
    : pngDimensions(buffer);
  const fullMeta = dims ? { ...(meta || {}), width: dims.width, height: dims.height } : meta;
  const metaJson = fullMeta ? JSON.stringify(fullMeta) : null;
  db.prepare(
    `INSERT INTO images (image_id, file_name, origin, topics, style, format, zero_text_checked, zero_text_passed, created_at, meta)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`
  ).run(imageId, fileName, origin, topicsJson, style, format, now, metaJson);
  return db.prepare('SELECT * FROM images WHERE image_id = ?').get(imageId);
}

/**
 * List images relevant-first. When topics is provided, images are scored by
 * topic-overlap count (number of provided topics that appear in stored topics);
 * ties keep recency order. Images with zero overlap are still included — they
 * appear after all matching images. No hard style/format filter is applied.
 *
 * By default, images that failed the zero-text gate (zero_text_checked=1 AND
 * zero_text_passed=0) are excluded from results. Pass includeFailed=true to
 * include them (for internal audit or debugging purposes).
 *
 * @param {{db: object, topics?: string[], includeFailed?: boolean}} opts
 * @returns {object[]} image rows
 */
export function listImages({ db, topics, includeFailed = false, kind = null } = {}) {
  // rowid DESC breaks created_at ties by insertion order (ISO timestamps can
  // collide within one millisecond in tests and bulk imports)
  const whereClause = includeFailed
    ? ''
    : 'WHERE NOT (zero_text_checked = 1 AND zero_text_passed = 0)';
  const rows = db.prepare(`SELECT * FROM images ${whereClause} ORDER BY created_at DESC, rowid DESC`).all();
  const filteredRows = kind
    ? rows.filter((row) => {
        let metaKind = null;
        try { metaKind = row.meta ? JSON.parse(row.meta).kind || null : null; } catch { /* bad meta */ }
        if (kind === 'background') return metaKind === 'background';
        // 'foreground': anything that is NOT explicitly 'background'
        return metaKind !== 'background';
      })
    : rows;
  if (!topics || !topics.length) return filteredRows;
  const queryTopics = new Set(topics.map((t) => String(t).toLowerCase()));
  const scored = filteredRows.map((row) => {
    let stored = [];
    try { stored = JSON.parse(row.topics || '[]'); } catch { /* bad json → no overlap */ }
    const overlap = Array.isArray(stored)
      ? stored.filter((t) => queryTopics.has(String(t).toLowerCase())).length
      : 0;
    return { row, overlap };
  });
  scored.sort((a, b) => b.overlap - a.overlap); // stable: recency preserved within equal overlap
  return scored.map((s) => s.row);
}

/**
 * Absolute path for an image. Accepts either:
 *   - a DB row object (preferred — uses stored file_name so extension is correct)
 *   - a bare imageId string (legacy callers; assumes .png extension)
 * NEVER accepts client-supplied paths: the id/row must come from a DB lookup.
 */
export function getImagePath(rowOrId, assetsDir = DEFAULT_ASSETS_DIR) {
  if (rowOrId && typeof rowOrId === 'object' && rowOrId.file_name) {
    return join(assetsDir, rowOrId.file_name);
  }
  // Legacy: bare imageId string — assume .png (existing rows all have .png)
  return join(assetsDir, `${rowOrId}.png`);
}

/** Delete image row and file. A missing file is not an error. */
export function deleteImage(db, imageId, assetsDir = DEFAULT_ASSETS_DIR) {
  // Look up the file_name from the row so we delete the correct extension.
  const row = db.prepare('SELECT file_name FROM images WHERE image_id = ?').get(imageId);
  const filePath = row ? join(assetsDir, row.file_name) : join(assetsDir, `${imageId}.png`);
  db.prepare('DELETE FROM images WHERE image_id = ?').run(imageId);
  if (existsSync(filePath)) {
    try { unlinkSync(filePath); } catch { /* race between delete and not-found is safe */ }
  }
}

/** Record the result of a zero-text gate check. */
export function markZeroTextCheck(db, imageId, passed) {
  db.prepare('UPDATE images SET zero_text_checked = 1, zero_text_passed = ? WHERE image_id = ?')
    .run(passed ? 1 : 0, imageId);
}
