// Design phase API (spec §B.6). Same error discipline as routes/pipeline.js:
// input validation returns 400 inline; pipeline errors carry codes and are
// mapped to statuses here (WRONG_PHASE 409, UNKNOWN_TEMPLATE 400, POSTER_BUSY
// 409, POSTER_NOT_FOUND 404); everything else forwards to the global handler
// via next(err). The dynamic loop makes multiple model calls (recommend +
// review per attempt, up to 4 attempts) — synchronous awaits with SSE live
// progress, same TIMEOUTS reasoning as the content routes.

import { Router } from 'express';
import {
  listTemplatesFor, runDesignPipeline, retryDesign, getDesignState
} from '../../pipelines/design_pipeline.js';

const MAX_PROMPT_LENGTH = 2000;

function handle(res, next, err) {
  if (err && err.status) {
    return res.status(err.status).json({ error: err.code || 'BAD_REQUEST' });
  }
  next(err);
}

// Optional design prompt shared by /dynamic and /retry.
function invalidPrompt(prompt) {
  if (prompt !== undefined && prompt !== null && typeof prompt !== 'string') {
    return 'prompt must be a string when provided';
  }
  if (typeof prompt === 'string' && prompt.length > MAX_PROMPT_LENGTH) {
    return `prompt must be at most ${MAX_PROMPT_LENGTH} characters`;
  }
  return null;
}

export function designRouter(ctx) {
  const router = Router();

  // Template gallery: recommended-first for the poster's content shape, with
  // palette-resolved SVG previews. ?posterId= is required (recommendation and
  // brand palette are per-poster).
  router.get('/templates', (req, res, next) => {
    try {
      const posterId = req.query.posterId;
      if (typeof posterId !== 'string' || !posterId.trim()) {
        return res.status(400).json({ error: 'posterId query parameter is required' });
      }
      res.json(listTemplatesFor({ ctx, posterId }));
    } catch (err) { handle(res, next, err); }
  });

  // Path A: apply a predefined template. body { templateId }.
  router.post('/:posterId/apply', async (req, res, next) => {
    try {
      const { templateId, visualMode } = req.body || {};
      if (typeof templateId !== 'string' || !templateId.trim()) {
        return res.status(400).json({ error: 'templateId must be a non-empty string' });
      }
      res.json(await runDesignPipeline({ ctx, posterId: req.params.posterId, mode: 'template', templateId, visualMode }));
    } catch (err) { handle(res, next, err); }
  });

  // Path B: dynamic recommender ⇄ reviewer loop (90 gate). Optional body
  // { prompt } — design instructions (the long call — see TIMEOUTS above).
  router.post('/:posterId/dynamic', async (req, res, next) => {
    try {
      const prompt = req.body?.prompt;
      const problem = invalidPrompt(prompt);
      if (problem) return res.status(400).json({ error: problem });
      res.json(await runDesignPipeline({ ctx, posterId: req.params.posterId, mode: 'dynamic', userPrompt: prompt || '', visualMode: req.body?.visualMode }));
    } catch (err) { handle(res, next, err); }
  });

  // Option 1 / Option 2 loop: reject the shown design, optionally steer the
  // next dynamic pass with a prompt.
  router.post('/:posterId/retry', async (req, res, next) => {
    try {
      const prompt = req.body?.prompt;
      const problem = invalidPrompt(prompt);
      if (problem) return res.status(400).json({ error: problem });
      res.json(await retryDesign({ ctx, posterId: req.params.posterId, userPrompt: prompt || '' }));
    } catch (err) { handle(res, next, err); }
  });

  router.get('/:posterId', (req, res, next) => {
    try {
      res.json(getDesignState({ ctx, posterId: req.params.posterId }));
    } catch (err) { handle(res, next, err); }
  });

  return router;
}
