// Translation REST surface (spec §B.11). Routes are thin: validate body
// shape, call the translation pipeline, map coded errors via handle().
// No business logic here — all orchestration lives in
// pipelines/translation_pipeline.js.
//
// Route order note: /meta/* registered BEFORE /:posterId so the literal
// segment 'meta' never collides with a posterId param.

import { Router } from 'express';
import {
  startTranslation,
  getTranslationState,
  getTranslationVariant,
  editTranslation,
  syncTranslationEdit
} from '../../pipelines/translation_pipeline.js';
import { getTerminology } from '../../translation/glossary.js';
import { LANGUAGES, getLanguage } from '../../translation/languages.js';

function codedError(message, code, status) {
  const err = new Error(message);
  err.code = code;
  if (status) err.status = status;
  return err;
}

function handle(res, next, err) {
  if (err && err.status) {
    return res.status(err.status).json({ error: err.code || 'BAD_REQUEST' });
  }
  next(err);
}

export function translationRouter(ctx) {
  const router = Router();

  // ── /meta/* — static + DB lookups, no poster context ───────────────────────
  // MUST be registered before /:posterId routes.

  // GET /api/translation/meta/languages
  // Returns base + target language list for the UI dropdown.
  router.get('/meta/languages', (_req, res, next) => {
    try {
      res.json({ base: 'en', languages: LANGUAGES });
    } catch (err) { handle(res, next, err); }
  });

  // GET /api/translation/meta/terminology/:lang
  // Returns validated terminology rows for a language (populated by user edits).
  router.get('/meta/terminology/:lang', (req, res, next) => {
    try {
      const { lang } = req.params;
      if (!getLanguage(lang)) {
        throw codedError(`Unknown language "${lang}"`, 'INVALID_LANGUAGE', 400);
      }
      const terms = getTerminology(ctx.db, lang);
      res.json({ terms });
    } catch (err) { handle(res, next, err); }
  });

  // ── /:posterId — poster-scoped translation operations ──────────────────────

  // POST /api/translation/:posterId/start
  // Body: { languages: 'all' | string[] }
  // Starts per-language translate loops (can be long-running; SSE carries
  // progress events through the existing bus→SSE bridge).
  router.post('/:posterId/start', async (req, res, next) => {
    try {
      const { languages } = req.body || {};
      if (languages === undefined) {
        return res.status(400).json({ error: 'languages is required' });
      }
      const state = await startTranslation({ ctx, posterId: req.params.posterId, languages });
      res.json(state);
    } catch (err) { handle(res, next, err); }
  });

  // GET /api/translation/:posterId
  // Returns the safe translation state (language list + metadata; no content/canvases).
  router.get('/:posterId', (req, res, next) => {
    try {
      const state = getTranslationState({ ctx, posterId: req.params.posterId });
      res.json(state);
    } catch (err) { handle(res, next, err); }
  });

  // GET /api/translation/:posterId/:lang
  // Returns one language variant with its content + canvas.
  router.get('/:posterId/:lang', (req, res, next) => {
    try {
      const variant = getTranslationVariant({ ctx, posterId: req.params.posterId, lang: req.params.lang });
      res.json(variant);
    } catch (err) { handle(res, next, err); }
  });

  // PUT /api/translation/:posterId/:lang
  // Body: { content }
  // Applies a verbatim user edit to a language variant (user has final word).
  router.put('/:posterId/:lang', async (req, res, next) => {
    try {
      const { content } = req.body || {};
      if (!content || typeof content !== 'object') {
        return res.status(400).json({ error: 'content is required and must be an object' });
      }
      const result = await editTranslation({ ctx, posterId: req.params.posterId, lang: req.params.lang, content });
      res.json(result);
    } catch (err) { handle(res, next, err); }
  });

  // POST /api/translation/:posterId/:lang/sync
  // Re-translates every OTHER existing language carrying the edit's style preference.
  router.post('/:posterId/:lang/sync', async (req, res, next) => {
    try {
      const state = await syncTranslationEdit({ ctx, posterId: req.params.posterId, lang: req.params.lang });
      res.json(state);
    } catch (err) { handle(res, next, err); }
  });

  return router;
}
