// Config page API (spec §B.12): org details in the vault, API keys as
// write-only secrets, brand override. Org config IS returned to the config
// page (the user edits it) but never to any model — that's the egress's job.
// Handlers route errors to the global handler: no vault/SQLite internals in
// response bodies.

import { Router } from 'express';
import { MODEL_OPTIONS, PROVIDERS } from '../../masking/vault.js';

export function configRouter({ vault, egress }) {
  const router = Router();

  router.get('/', (_req, res, next) => {
    try {
      res.json({
        orgConfig: vault.getOrgConfig(),
        secrets: vault.secretStatus(),
        models: vault.getModels(),
        modelOptions: MODEL_OPTIONS,
        providerConfig: vault.getProviderConfig(),
        providers: PROVIDERS
      });
    } catch (err) { next(err); }
  });

  router.put('/models', (req, res, next) => {
    try {
      const models = vault.setModels(req.body || {});
      res.json({ models });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.code || 'MODEL_INVALID', message: err.message });
      next(err);
    }
  });

  // Provider selection (openai | custom OpenAI-compatible endpoint).
  router.put('/provider', (req, res, next) => {
    try {
      const { provider, customBaseUrl, customModel, customModels } = req.body || {};
      const providerConfig = vault.setProviderConfig({ provider, customBaseUrl, customModel, customModels });
      res.json({ providerConfig });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.code || 'PROVIDER_INVALID', message: err.message });
      next(err);
    }
  });

  // Live model list from the active provider's /models endpoint. The fetch
  // itself lives in the egress (ESLint: only egress talks to providers); this
  // route just surfaces it. Network/HTTP failures return a specific status so
  // the config page can distinguish "bad config" (400) from "endpoint down" (502).
  router.get('/models/live', async (_req, res, next) => {
    try {
      const models = await egress.listModels();
      res.json({ models });
    } catch (err) {
      if (err.status === 400 || err.status === 502) {
        return res.status(err.status).json({ error: err.code || 'MODELS_FETCH_FAILED', message: err.message });
      }
      next(err);
    }
  });

  // Probe the selected CONTENT model with one tiny chat call so the config page
  // can show the real endpoint error before a full run. Always 200; the body's
  // `ok` conveys success (mirrors egress.testContentModel's structured result).
  router.post('/test', async (_req, res, next) => {
    try {
      res.json(await egress.testContentModel());
    } catch (err) { next(err); }
  });

  router.put('/', (req, res, next) => {
    try {
      const updated = vault.setOrgConfig(req.body || {});
      res.json({ orgConfig: updated });
    } catch (err) { next(err); }
  });

  router.put('/secrets', (req, res, next) => {
    try {
      const { anthropicKey, openaiKey, customKey } = req.body || {};
      const status = vault.setSecrets({ anthropicKey, openaiKey, customKey });
      res.json({ secrets: status });
    } catch (err) {
      // key-shape rejections are the user's to fix — return the specific
      // reason (400) instead of a generic 500 with only an error code
      if (err.status === 400) {
        return res.status(400).json({ error: err.code || 'SECRET_INVALID', message: err.message });
      }
      next(err);
    }
  });

  return router;
}
