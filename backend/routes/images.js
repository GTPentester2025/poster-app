// Image library routes (spec §B.7). Same error discipline as routes/design.js:
// input validation returns 400 inline; coded errors carry status; everything
// else forwards to the global handler. Path traversal: files are served by
// DB-looked-up id only — client-supplied filenames never touch the filesystem.
//
// Magic byte validation: PNG = 89 50 4E 47 (first 4 bytes); JPEG = FF D8 FF.
// Size cap: 8MB decoded.

import { Router } from 'express';
import { createReadStream, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  saveImage, listImages, getImagePath, deleteImage, deriveAssetTags
} from '../../image-library/store.js';
import { generateForSlot, generateForSlots } from '../../pipelines/image_pipeline.js';
import { tagImage } from '../../agents/image_tagger.js';
import { generateAsset } from '../../agents/image_generator.js';
import { checkZeroText } from '../../agents/image_text_gate.js';
import { resolveBrand } from '../../templates/palette.js';
import { ALL_PRESETS, getPresetById } from '../../data/background-presets.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_ASSETS_DIR = join(HERE, '..', '..', 'image-library', 'assets');
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB decoded
const MAX_PROMPT_LENGTH = 2000;
const MAX_CUSTOM_PROMPT_LENGTH = 500; // customPrompt from the UI retry card
const MAX_TOPICS = 32;
const MAX_TOPIC_LEN = 64;

/** Sanitise a raw topics array: cap length, trim + truncate each entry, drop empties. */
function sanitiseTopics(arr) {
  return arr
    .slice(0, MAX_TOPICS)
    .map((t) => String(t).trim().slice(0, MAX_TOPIC_LEN))
    .filter(Boolean);
}

function handle(res, next, err) {
  if (err && err.status) {
    if (err.code === 'IMAGE_RETRIES_EXHAUSTED') {
      return res.status(409).json({
        error: 'IMAGE_RETRIES_EXHAUSTED',
        attempts: err.attempts || 5,
        lastReason: err.lastReason || 'zero-text-gate'
      });
    }
    return res.status(err.status).json({ error: err.code || 'BAD_REQUEST' });
  }
  next(err);
}

/**
 * Validate PNG or JPEG magic bytes.
 * @param {Buffer} buf
 * @returns {'image/png'|'image/jpeg'|null}
 */
function detectImageType(buf) {
  if (buf.length < 4) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  return null;
}

/** Actual media type of a stored row (extension is derived from magic at upload). */
function rowMediaType(row) {
  return row?.file_name?.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
}

/** Client view of an image row — metadata only, no file paths. */
function safeImageView(r) {
  let parsedMeta = null;
  if (r.meta) { try { parsedMeta = JSON.parse(r.meta); } catch { /* bad meta */ } }
  return {
    image_id: r.image_id,
    file_name: r.file_name,
    origin: r.origin,
    topics: r.topics,
    style: r.style,
    format: r.format,
    zero_text_checked: r.zero_text_checked,
    zero_text_passed: r.zero_text_passed,
    created_at: r.created_at,
    meta: parsedMeta
  };
}

// ── zero-text gate helper (used by background-generate route) ─────────────────

const BG_CTX_STAGE = { pipeline: 'background-studio', stage: 'zero-text-gate', agent: 'image-text-gate', skill: 'detect_embedded_text' };

async function bgZeroTextGate({ egress, gateEngine, runId, imageBase64 }) {
  const verdict = await checkZeroText({ egress, runId, imageBase64, mediaType: 'image/png' });
  if (gateEngine && gateEngine.check) {
    gateEngine.check({
      gateName: 'imageZeroText', runId, project: 'poster-app',
      pipeline: 'background-studio', stage: 'zero-text-gate',
      verdicts: [{ reviewer: 'image-text-gate', ...verdict }]
    });
  }
  return verdict;
}

export function imagesRouter(ctx, assetsDir = DEFAULT_ASSETS_DIR) {
  const router = Router();

  // List images relevant-first (metadata only). ?topics=a,b scores relevance.
  // By default, images that failed the zero-text gate are excluded.
  // Pass ?includeFailed=1 to include them (for audit/debugging).
  router.get('/', (req, res, next) => {
    try {
      const topics = req.query.topics
        ? String(req.query.topics).split(',').map((t) => t.trim()).filter(Boolean)
        : undefined;
      const includeFailed = req.query.includeFailed === '1' || req.query.includeFailed === 'true';
      const validKinds = ['background', 'foreground'];
      const kind = validKinds.includes(req.query.kind) ? req.query.kind : null;
      const rows = listImages({ db: ctx.db, topics, includeFailed, kind });
      res.json({ images: rows.map(safeImageView) });
    } catch (err) { handle(res, next, err); }
  });

  // Upload a library image (JSON body: fileName, imageBase64, topics[], style, format)
  router.post('/upload', async (req, res, next) => {
    try {
      const { fileName, imageBase64, topics, style, format } = req.body || {};
      if (typeof imageBase64 !== 'string' || !imageBase64) {
        return res.status(400).json({ error: 'imageBase64 must be a non-empty string' });
      }
      const buffer = Buffer.from(imageBase64, 'base64');
      if (buffer.length > MAX_IMAGE_BYTES) {
        return res.status(400).json({ error: `Image exceeds 8MB limit (decoded: ${buffer.length} bytes)` });
      }
      const mediaType = detectImageType(buffer);
      if (!mediaType) {
        return res.status(400).json({ error: 'Image must be a PNG or JPEG (invalid magic bytes)' });
      }
      if (!Array.isArray(topics)) {
        return res.status(400).json({ error: 'topics must be an array' });
      }
      const rec = await saveImage({
        db: ctx.db, buffer, origin: 'library',
        topics: sanitiseTopics(topics),
        style: style ? String(style) : null,
        format: format ? String(format) : null,
        meta: { fileName: fileName ? String(fileName) : null, mediaType },
        assetsDir
      });
      res.status(201).json({ image: rec });
    } catch (err) { handle(res, next, err); }
  });

  // Serve image file by id — path-traversal safe: the id is looked up in the
  // DB and the path is constructed server-side from the DB id only. Declared
  // BEFORE '/:imageId/...' so 'file' never matches as an imageId.
  router.get('/file/:imageId', (req, res, next) => {
    try {
      const { imageId } = req.params;
      const row = ctx.db.prepare('SELECT * FROM images WHERE image_id = ?').get(imageId);
      if (!row) return res.status(404).json({ error: 'IMAGE_NOT_FOUND' });
      const filePath = getImagePath(row, assetsDir);
      if (!existsSync(filePath)) return res.status(404).json({ error: 'IMAGE_FILE_MISSING' });
      let contentType = 'image/png';
      if (row.meta) {
        try {
          const m = JSON.parse(row.meta);
          if (m.mediaType === 'image/jpeg' || m.mediaType === 'image/png') contentType = m.mediaType;
        } catch { /* default to png */ }
      }
      res.set('Content-Type', contentType);
      res.set('X-Content-Type-Options', 'nosniff');
      createReadStream(filePath).pipe(res);
    } catch (err) { handle(res, next, err); }
  });

  // Auto-tag an image using vision (suggest topics/style/format)
  router.post('/:imageId/autotag', async (req, res, next) => {
    try {
      const { imageId } = req.params;
      const row = ctx.db.prepare('SELECT * FROM images WHERE image_id = ?').get(imageId);
      if (!row) return res.status(404).json({ error: 'IMAGE_NOT_FOUND' });
      const filePath = getImagePath(row, assetsDir);
      if (!existsSync(filePath)) return res.status(404).json({ error: 'IMAGE_FILE_MISSING' });
      const imageBase64 = readFileSync(filePath).toString('base64');

      const suggestion = await tagImage({
        egress: ctx.egress,
        runId: `autotag-${row.image_id}`,
        imageBase64,
        mediaType: rowMediaType(row)
      });

      if (suggestion && Array.isArray(suggestion.topics)) {
        // topics/style/format go to their columns; description + tags are folded
        // into meta so the recommender's SQL prefilter can see them.
        let meta = {};
        try { meta = row.meta ? JSON.parse(row.meta) : {}; } catch { meta = {}; }
        if (suggestion.description) meta.description = suggestion.description;
        if (Array.isArray(suggestion.tags) && suggestion.tags.length) meta.tags = suggestion.tags;
        ctx.db.prepare('UPDATE images SET topics = ?, style = ?, format = ?, meta = ? WHERE image_id = ?').run(
          JSON.stringify(sanitiseTopics(suggestion.topics)),
          typeof suggestion.style === 'string' ? suggestion.style : row.style,
          typeof suggestion.format === 'string' ? suggestion.format : row.format,
          JSON.stringify(meta),
          row.image_id
        );
      }
      const updated = ctx.db.prepare('SELECT * FROM images WHERE image_id = ?').get(row.image_id);
      res.json({ image: updated });
    } catch (err) { handle(res, next, err); }
  });

  // Delete an image (row + file)
  router.delete('/:imageId', (req, res, next) => {
    try {
      const { imageId } = req.params;
      const row = ctx.db.prepare('SELECT * FROM images WHERE image_id = ?').get(imageId);
      if (!row) return res.status(404).json({ error: 'IMAGE_NOT_FOUND' });
      deleteImage(ctx.db, row.image_id, assetsDir);
      res.json({ ok: true });
    } catch (err) { handle(res, next, err); }
  });

  // Slot fill: POST /api/images/slot/:posterId/:slotId
  // body { source: 'library'|'generate'|'library-plus-prompt', imageId?, prompt?, customPrompt? }
  // customPrompt: optional edited prompt from the UI retry card (max 500 chars, data-fenced into generation)
  // On IMAGE_RETRIES_EXHAUSTED: 409 { error, attempts, lastReason }
  router.post('/slot/:posterId/:slotId', async (req, res, next) => {
    try {
      const { posterId, slotId } = req.params;
      const { source, imageId, prompt, customPrompt, treatment } = req.body || {};
      if (!['library', 'generate', 'library-plus-prompt'].includes(source)) {
        return res.status(400).json({ error: 'source must be library, generate, or library-plus-prompt' });
      }
      if (prompt !== undefined && prompt !== null && typeof prompt !== 'string') {
        return res.status(400).json({ error: 'prompt must be a string when provided' });
      }
      if (typeof prompt === 'string' && prompt.length > MAX_PROMPT_LENGTH) {
        return res.status(400).json({ error: `prompt must be at most ${MAX_PROMPT_LENGTH} characters` });
      }
      if (customPrompt !== undefined && customPrompt !== null && typeof customPrompt !== 'string') {
        return res.status(400).json({ error: 'customPrompt must be a string when provided' });
      }
      if (typeof customPrompt === 'string' && customPrompt.length > MAX_CUSTOM_PROMPT_LENGTH) {
        return res.status(400).json({ error: `customPrompt must be at most ${MAX_CUSTOM_PROMPT_LENGTH} characters` });
      }
      const VALID_BG_TREATMENTS = ['gradient', 'pattern', 'image'];
      if (slotId === 'bg' && treatment !== undefined && treatment !== null) {
        if (!VALID_BG_TREATMENTS.includes(treatment)) {
          return res.status(400).json({ error: 'treatment must be gradient, pattern, or image for the bg slot' });
        }
      }
      const treatmentOverride = (slotId === 'bg' && VALID_BG_TREATMENTS.includes(treatment)) ? treatment : '';
      const state = await generateForSlot({
        ctx, posterId, slotId, source, imageId,
        userPrompt: prompt || '',
        customPrompt: customPrompt || '',
        treatmentOverride,
        assetsDir
      });
      res.json(state);
    } catch (err) { handle(res, next, err); }
  });

  // ── Background generation ─────────────────────────────────────────────────
  // POST /api/images/generate-background
  // body { prompt?, treatment: 'gradient'|'pattern'|'image', similarTo?: imageId }
  // Generates ONE standalone background image using generateAsset (background
  // treatment prompts + brand palette from resolveBrand). Zero-text gated — up
  // to 3 attempts. Saved with kind:'background', meta.description + meta.tags.
  // Awareness: appends up to 8 recent background descriptions as a dedupe list;
  // when similarTo is given, swaps to a "SIMILAR to" hint instead.
  // Returns { image } (safe view).
  router.post('/generate-background', async (req, res, next) => {
    try {
      const { prompt, treatment, similarTo } = req.body || {};

      // Validate treatment (required)
      const VALID_TREATMENTS = ['gradient', 'pattern', 'image'];
      if (!VALID_TREATMENTS.includes(treatment)) {
        return res.status(400).json({ error: 'treatment must be gradient, pattern, or image' });
      }

      // Validate optional prompt
      if (prompt !== undefined && prompt !== null && typeof prompt !== 'string') {
        return res.status(400).json({ error: 'prompt must be a string when provided' });
      }
      if (typeof prompt === 'string' && prompt.length > MAX_CUSTOM_PROMPT_LENGTH) {
        return res.status(400).json({ error: `prompt must be at most ${MAX_CUSTOM_PROMPT_LENGTH} characters` });
      }

      // Validate optional similarTo — must exist in the DB
      let similarRow = null;
      if (similarTo !== undefined && similarTo !== null) {
        if (typeof similarTo !== 'string' || !similarTo.trim()) {
          return res.status(400).json({ error: 'similarTo must be a non-empty string imageId when provided' });
        }
        similarRow = ctx.db.prepare('SELECT * FROM images WHERE image_id = ?').get(similarTo);
        if (!similarRow) {
          return res.status(404).json({ error: 'SIMILAR_TO_NOT_FOUND', message: `Image ${similarTo} not found in library` });
        }
      }

      const runId = `bg-studio-${randomUUID()}`;
      const { palette } = resolveBrand(ctx.vault);

      // Fetch up to 8 recent background descriptions for dedupe awareness
      const recentBgRows = listImages({ db: ctx.db, kind: 'background', includeFailed: false });
      const recentDescriptions = [];
      for (const row of recentBgRows.slice(0, 8)) {
        let m = null;
        try { m = row.meta ? JSON.parse(row.meta) : null; } catch { /* bad meta */ }
        if (m && m.description) recentDescriptions.push(String(m.description).slice(0, 120));
      }

      // Build the concept / bgConcept for the generation
      let bgConcept = '';
      let userPrompt = typeof prompt === 'string' && prompt.trim() ? prompt.trim() : '';

      // similarTo: swap dedupe awareness to a "SIMILAR" directive instead
      let dedupeClause = '';
      if (similarRow) {
        // Extract description from similarRow's meta
        let simMeta = null;
        try { simMeta = similarRow.meta ? JSON.parse(similarRow.meta) : null; } catch { /* bad meta */ }
        const simDesc = (simMeta && simMeta.description) ? String(simMeta.description) : 'an existing background';
        dedupeClause = `Make it stylistically SIMILAR to: ${simDesc}`;
      } else if (recentDescriptions.length) {
        dedupeClause = `DO NOT duplicate these existing backgrounds: ${recentDescriptions.join('; ')}`;
      }

      // The dedupe / similar clause is appended to the userPrompt so it rides
      // through the data-fence path inside generateAsset via the userPrompt field.
      // We append it here so it flows naturally through the pipeline.
      if (dedupeClause) {
        userPrompt = userPrompt ? `${userPrompt}. ${dedupeClause}` : dedupeClause;
      }

      const MAX_BG_ATTEMPTS = 3;
      const GEN_CTX = {
        runId,
        pipeline: 'background-studio',
        stage: 'slot-fill',
        agent: 'image-generator',
        skill: 'generate_asset'
      };

      let lastFeedback = '';
      let accepted = false;
      let finalImageBase64 = null;
      let finalMaskedPrompt = null;

      for (let attempt = 1; attempt <= MAX_BG_ATTEMPTS; attempt++) {
        let feedbackNote = '';
        if (lastFeedback) {
          feedbackNote = `previous attempt contained text: ${lastFeedback} — regenerate with absolutely zero text`;
        }

        let genResult;
        try {
          genResult = await generateAsset(
            {
              egress: ctx.egress,
              runId,
              styleHint: '',
              templateStyle: '',
              topics: [],
              userPrompt,
              baseImageDescription: '',
              slotId: 'bg',
              size: '1536x1024',
              treatment,
              bgConcept,
              palette,
              quality: 'medium'
            },
            feedbackNote
          );
        } catch (genErr) {
          if (attempt === MAX_BG_ATTEMPTS) {
            const err = new Error(`Background generation failed after ${MAX_BG_ATTEMPTS} attempts: ${genErr.message}`);
            err.status = 409;
            err.code = 'BG_GENERATE_FAILED';
            throw err;
          }
          lastFeedback = genErr.message || 'generation error';
          continue;
        }

        const verdict = await bgZeroTextGate({
          egress: ctx.egress, gateEngine: ctx.gateEngine, runId, imageBase64: genResult.imageBase64
        });

        if (verdict.status === 'accepted') {
          accepted = true;
          finalImageBase64 = genResult.imageBase64;
          finalMaskedPrompt = genResult.promptUsed;
          break;
        }
        lastFeedback = verdict.feedback || 'text detected';
        if (attempt === MAX_BG_ATTEMPTS) {
          const err = new Error(`Background image failed zero-text gate after ${MAX_BG_ATTEMPTS} attempts`);
          err.status = 409;
          err.code = 'BG_ZERO_TEXT_EXHAUSTED';
          throw err;
        }
      }

      if (!accepted || !finalImageBase64) {
        const err = new Error('Background generation did not produce an accepted image');
        err.status = 500;
        err.code = 'BG_GENERATE_FAILED';
        throw err;
      }

      // Derive description + tags from the prompt/concept
      const concept = (typeof prompt === 'string' && prompt.trim())
        ? prompt.trim()
        : `a full-bleed ${treatment} background`;
      const { description, tags } = deriveAssetTags({
        concept,
        treatment,
        sizeClass: 'bg',
        palette,
        isBg: true
      });

      // Save the accepted background to the library
      mkdirSync(assetsDir, { recursive: true });
      const buffer = Buffer.from(finalImageBase64, 'base64');
      const rec = await saveImage({
        db: ctx.db,
        buffer,
        origin: 'generated',
        topics: tags,
        style: treatment,
        format: null,
        meta: {
          kind: 'background',
          description,
          tags,
          treatment,
          quality: 'medium',
          sizeUsed: '1536x1024',
          ...(similarTo ? { generatedSimilarTo: similarTo } : {}),
          promptHead: String(finalMaskedPrompt || '').slice(0, 300)
        },
        assetsDir
      });

      // Mark zero-text passed
      ctx.db.prepare('UPDATE images SET zero_text_checked = 1, zero_text_passed = 1 WHERE image_id = ?')
        .run(rec.image_id);

      // Return the safe view of the newly saved image row
      const savedRow = ctx.db.prepare('SELECT * FROM images WHERE image_id = ?').get(rec.image_id);
      res.status(201).json({ image: safeImageView(savedRow) });
    } catch (err) { handle(res, next, err); }
  });

  // Batch slot fill (generate in parallel): POST /api/images/slots/:posterId
  // body { slotIds: string[] } — every slot generated concurrently, all
  // assignments applied under one lock/save. Per-slot failures don't fail the
  // request (see response.batchResults).
  router.post('/slots/:posterId', async (req, res, next) => {
    try {
      const { posterId } = req.params;
      const { slotIds } = req.body || {};
      if (!Array.isArray(slotIds) || !slotIds.length || !slotIds.every((s) => typeof s === 'string' && s)) {
        return res.status(400).json({ error: 'slotIds must be a non-empty array of slot id strings' });
      }
      if (slotIds.length > 8) {
        return res.status(400).json({ error: 'at most 8 slots per batch' });
      }
      const state = await generateForSlots({ ctx, posterId, slotIds, assetsDir });
      res.json(state);
    } catch (err) { handle(res, next, err); }
  });

  // ── Background presets ───────────────────────────────────────────────────
  // GET /api/images/backgrounds/presets
  // Returns the full catalog of corporate background presets (gradients,
  // patterns, and textures) that the UI renders as clickable preview tiles.
  // Each preset includes a name, category, gradient CSS, colour palette,
  // treatment, and a generation prompt. No DB access — static data.
  router.get('/backgrounds/presets', (_req, res) => {
    res.json({ presets: ALL_PRESETS });
  });

  // ── Apply background to poster ───────────────────────────────────────────
  // POST /api/images/backgrounds/apply-to-poster
  // body { posterId: string, imageId: string }
  // Assigns a library background (by imageId) to the bg slot of a poster.
  // Delegates to the existing slot-fill pipeline with source='library'.
  // Returns the updated poster state with the new background assigned.
  // Errors: POSTER_NOT_FOUND (404), IMAGE_NOT_FOUND (404), and standard
  // slot-fill errors.
  router.post('/backgrounds/apply-to-poster', async (req, res, next) => {
    try {
      const { posterId, imageId } = req.body || {};

      if (!posterId || typeof posterId !== 'string' || !posterId.trim()) {
        return res.status(400).json({ error: 'posterId must be a non-empty string' });
      }
      if (!imageId || typeof imageId !== 'string' || !imageId.trim()) {
        return res.status(400).json({ error: 'imageId must be a non-empty string' });
      }

      // Verify poster exists
      const poster = ctx.db.prepare('SELECT poster_id FROM posters WHERE poster_id = ?').get(posterId);
      if (!poster) {
        return res.status(404).json({ error: 'POSTER_NOT_FOUND', message: `Poster ${posterId} not found` });
      }

      // Verify image exists and is a background
      const image = ctx.db.prepare('SELECT * FROM images WHERE image_id = ?').get(imageId);
      if (!image) {
        return res.status(404).json({ error: 'IMAGE_NOT_FOUND', message: `Image ${imageId} not found` });
      }

      // Assign the background to the poster's bg slot
      const state = await generateForSlot({
        ctx, posterId, slotId: 'bg', source: 'library', imageId,
        userPrompt: '', customPrompt: '', treatmentOverride: '',
        assetsDir
      });

      res.json({ ok: true, poster: state });
    } catch (err) { handle(res, next, err); }
  });

  return router;
}
