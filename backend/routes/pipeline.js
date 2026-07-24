// Content pipeline API (spec §B.1 stages 2-4). Same error discipline as
// routes/rag.js: input validation returns 400 inline; pipeline errors carry
// codes and are mapped to statuses here; everything else forwards to the
// global handler via next(err) so internals never leak into response bodies.
//
// Responses are SAFE VIEWS only: contextFile.synthesis and sources are
// internal (spec §B.4) and are never serialized to the client — the pipeline
// layer enforces this (safeState), routes just pass it through.
//
// TIMEOUTS: the content loop makes multiple model calls (generate + review
// per attempt, up to 6 attempts) and can run for minutes. This is a
// localhost app with SSE showing live progress, so handlers are synchronous
// awaits and NO artificial timeout is added. Node's built-in server timeouts
// (requestTimeout / headersTimeout) only bound request RECEPTION, not
// handler duration, so long-running responses are safe by default.

import { Router } from 'express';
import {
  startContentPipeline, chooseAngles, approveContent, regenerateAngles,
  regenerateContent, submitUserFeedback, inlineEdit, getPipelineState
} from '../../pipelines/content_pipeline.js';
import { suggestForPoster, executeReroute } from '../../pipelines/reroute_pipeline.js';
import { listTemplatesV2, getTemplateV2, buildCanvas } from '../../templates/v2/index.js';
import { sampleContentFor } from '../../templates/v2/manifest_schema.js';
import { recommendTemplate } from '../../agents/template_recommender.js';

const MAX_PROMPT_LENGTH = 2000;

// Pipeline errors carry .code and .status (404/409/400); anything without a
// status is unexpected and goes to the global handler. Notably POSTER_BUSY
// (a second mutation while one is in flight) arrives with status 409.
function handle(res, next, err) {
  if (err && err.status) {
    return res.status(err.status).json({ error: err.code || 'BAD_REQUEST' });
  }
  next(err);
}

export function pipelineRouter(ctx) {
  const router = Router();

  // v2 template gallery (Phase O4): poster-independent — registered BEFORE
  // any /:posterId route so 'templates' can never be captured as a posterId.
  router.get('/templates', (req, res, next) => {
    try {
      res.json({ templates: listTemplatesV2() });
    } catch (err) { handle(res, next, err); }
  });

  // Template preview (step 2 "Preview" button): the REAL canvas the template
  // produces, built with schema-derived sample content — what the user sees is
  // exactly what the design station will compile. Poster-independent + zero
  // model calls; registered before /:posterId so the path never captures.
  router.get('/templates/:templateId/sample', (req, res, next) => {
    try {
      const { templateId } = req.params;
      if (!getTemplateV2(templateId)) {
        return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' });
      }
      const orientation = req.query.orientation === 'landscape' ? 'landscape' : 'portrait';
      const template = getTemplateV2(templateId);
      const content = sampleContentFor(template.contentSchema);
      const canvas = buildCanvas(templateId, orientation, content);
      res.json({ templateId, orientation, canvas });
    } catch (err) { handle(res, next, err); }
  });

  // "AI picks the template" (step 2): recommend the most impactful template for
  // the topic. Poster-independent — returns a v2 template id the UI then selects,
  // so content still generates to that template's schema. body { prompt }.
  router.post('/recommend-template', async (req, res, next) => {
    try {
      const { prompt } = req.body || {};
      if (typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'prompt must be a non-empty string' });
      }
      if (prompt.length > MAX_PROMPT_LENGTH) {
        return res.status(400).json({ error: `prompt must be at most ${MAX_PROMPT_LENGTH} characters` });
      }
      const templates = listTemplatesV2().map((t) => ({
        id: t.id, name: t.name, style: t.style, kind: t.contentSchema.blocks.kind, description: t.description
      }));
      const { templateId, reason } = await recommendTemplate({
        egress: ctx.egress, runId: 'template-reco', prompt: prompt.trim(), templates
      });
      const chosen = templates.find((t) => t.id === templateId) || null;
      res.json({ templateId, name: chosen ? chosen.name : templateId, reason });
    } catch (err) { handle(res, next, err); }
  });

  // Start a poster run: intent → research → context file → angle choices.
  // Optional body.templateId (v2 template-first flow) rides into the pipeline.
  router.post('/start', async (req, res, next) => {
    try {
      const prompt = req.body?.prompt;
      if (typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'prompt must be a non-empty string' });
      }
      if (prompt.length > MAX_PROMPT_LENGTH) {
        return res.status(400).json({ error: `prompt must be at most ${MAX_PROMPT_LENGTH} characters` });
      }
      const templateId = req.body?.templateId;
      if (templateId !== undefined && templateId !== null && typeof templateId !== 'string') {
        return res.status(400).json({ error: 'templateId must be a string when provided' });
      }
      // Optional topic correction (I1): replaces the interpreted topic while
      // intent still runs for keywords/shape. Full validation (trim, ≤120)
      // lives in the pipeline → 400 INVALID_TOPIC_OVERRIDE via handle().
      const topicOverride = req.body?.topicOverride;
      if (topicOverride !== undefined && topicOverride !== null && typeof topicOverride !== 'string') {
        return res.status(400).json({ error: 'INVALID_TOPIC_OVERRIDE' });
      }
      res.json(await startContentPipeline({
        ctx, prompt, templateId: templateId || null,
        topicOverride: topicOverride === undefined ? null : topicOverride
      }));
    } catch (err) { handle(res, next, err); }
  });

  // Angles regenerate (I5): re-run intent+research with an optionally edited
  // prompt; fresh angles come back, phase stays 'angles'. body { prompt? }.
  router.post('/:posterId/angles/regenerate', async (req, res, next) => {
    try {
      const prompt = req.body?.prompt;
      if (prompt !== undefined && prompt !== null && typeof prompt !== 'string') {
        return res.status(400).json({ error: 'prompt must be a string when provided' });
      }
      if (typeof prompt === 'string' && prompt.length > MAX_PROMPT_LENGTH) {
        return res.status(400).json({ error: `prompt must be at most ${MAX_PROMPT_LENGTH} characters` });
      }
      res.json(await regenerateAngles({ ctx, posterId: req.params.posterId, prompt: prompt ?? null }));
    } catch (err) { handle(res, next, err); }
  });

  // Angle selection: body { angleIds: string[] | 'ai' }. Runs the 95-gate
  // content loop (the long call — see TIMEOUTS above).
  router.post('/:posterId/angles', async (req, res, next) => {
    try {
      const { angleIds } = req.body || {};
      if (angleIds !== 'ai' && !(Array.isArray(angleIds) && angleIds.length > 0 && angleIds.every((id) => typeof id === 'string'))) {
        return res.status(400).json({ error: "angleIds must be 'ai' or a non-empty array of angle id strings" });
      }
      res.json(await chooseAngles({ ctx, posterId: req.params.posterId, angleIds }));
    } catch (err) { handle(res, next, err); }
  });

  router.post('/:posterId/approve', async (req, res, next) => {
    try {
      res.json(await approveContent({ ctx, posterId: req.params.posterId }));
    } catch (err) { handle(res, next, err); }
  });

  // Optional body { prompt } — instructions for the regeneration pass.
  router.post('/:posterId/regenerate', async (req, res, next) => {
    try {
      const prompt = req.body?.prompt;
      if (prompt !== undefined && prompt !== null && typeof prompt !== 'string') {
        return res.status(400).json({ error: 'prompt must be a string when provided' });
      }
      if (typeof prompt === 'string' && prompt.length > MAX_PROMPT_LENGTH) {
        return res.status(400).json({ error: `prompt must be at most ${MAX_PROMPT_LENGTH} characters` });
      }
      res.json(await regenerateContent({ ctx, posterId: req.params.posterId, prompt: prompt || '' }));
    } catch (err) { handle(res, next, err); }
  });

  router.post('/:posterId/feedback', async (req, res, next) => {
    try {
      const { feedback } = req.body || {};
      if (typeof feedback !== 'string' || !feedback.trim()) {
        return res.status(400).json({ error: 'feedback must be a non-empty string' });
      }
      if (feedback.length > MAX_PROMPT_LENGTH) {
        return res.status(400).json({ error: `feedback must be at most ${MAX_PROMPT_LENGTH} characters` });
      }
      res.json(await submitUserFeedback({ ctx, posterId: req.params.posterId, feedback }));
    } catch (err) { handle(res, next, err); }
  });

  // Inline edit: applied verbatim, shape-validated, never re-reviewed.
  router.post('/:posterId/edit', async (req, res, next) => {
    try {
      const { content } = req.body || {};
      if (!content || typeof content !== 'object' || Array.isArray(content)) {
        return res.status(400).json({ error: 'content must be an object' });
      }
      res.json(await inlineEdit({ ctx, posterId: req.params.posterId, content }));
    } catch (err) { handle(res, next, err); }
  });

  // Reroute suggestion (Phase O6): read-only + one model call. Body
  // {feedback} → {suggestion: {checkpoint, reasoning, adjustments},
  // availableCheckpoints}. The client keeps the suggestion and passes BOTH
  // fields back to /reroute/execute — the model is never re-called there.
  router.post('/:posterId/reroute/suggest', async (req, res, next) => {
    try {
      const { feedback } = req.body || {};
      if (typeof feedback !== 'string' || !feedback.trim()) {
        return res.status(400).json({ error: 'feedback must be a non-empty string' });
      }
      if (feedback.length > MAX_PROMPT_LENGTH) {
        return res.status(400).json({ error: `feedback must be at most ${MAX_PROMPT_LENGTH} characters` });
      }
      res.json(await suggestForPoster({ ctx, posterId: req.params.posterId, feedback }));
    } catch (err) { handle(res, next, err); }
  });

  // Reroute execution: body {feedback, checkpoint, adjustments} (all required
  // — checkpoint/adjustments come from the suggestion, or the user's override
  // pick from availableCheckpoints). Rolls back, restores the doc snapshot,
  // and re-runs the stage with the adjustments as seed feedback.
  router.post('/:posterId/reroute/execute', async (req, res, next) => {
    try {
      const { feedback, checkpoint, adjustments } = req.body || {};
      if (typeof feedback !== 'string' || !feedback.trim()) {
        return res.status(400).json({ error: 'feedback must be a non-empty string' });
      }
      if (feedback.length > MAX_PROMPT_LENGTH) {
        return res.status(400).json({ error: `feedback must be at most ${MAX_PROMPT_LENGTH} characters` });
      }
      if (typeof checkpoint !== 'string' || !checkpoint.trim()) {
        return res.status(400).json({ error: 'checkpoint must be a non-empty string' });
      }
      if (typeof adjustments !== 'string' || !adjustments.trim()) {
        return res.status(400).json({ error: 'adjustments must be a non-empty string' });
      }
      if (adjustments.length > MAX_PROMPT_LENGTH) {
        return res.status(400).json({ error: `adjustments must be at most ${MAX_PROMPT_LENGTH} characters` });
      }
      res.json(await executeReroute({
        ctx, posterId: req.params.posterId,
        checkpoint: checkpoint.trim(), adjustments, feedback
      }));
    } catch (err) { handle(res, next, err); }
  });

  router.get('/:posterId', (req, res, next) => {
    try {
      res.json(getPipelineState({ ctx, posterId: req.params.posterId }));
    } catch (err) { handle(res, next, err); }
  });

  return router;
}
