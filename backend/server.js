// Poster app server. Localhost by design — the masking boundary requires all
// model traffic to originate here, never from the browser. Every /api route
// (including the SSE stream) sits behind the local session token so no other
// process on the machine can read pipeline events or org config.

import express from 'express';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppContext } from './app-context.js';
import { configRouter } from './routes/config.js';
import { ragRouter } from './routes/rag.js';
import { pipelineRouter } from './routes/pipeline.js';
import { designRouter } from './routes/design.js';
import { overrideRouter } from './routes/override.js';
import { postersRouter } from './routes/posters.js';
import { imagesRouter } from './routes/images.js';
import { editorRouter } from './routes/editor.js';
import { translationRouter } from './routes/translation.js';
import { runWithKey } from '../masking/request-key.js';
import { egressLogRouter } from './routes/egress_log.js';
import { usageRouter } from './routes/usage.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.POSTER_APP_PORT || 4180);

// imageAssetsDir: tests inject a temp dir; production default stays
// poster-app/image-library/assets/ (spec §B.7 — the only image file location)
export function createServer(ctx = createAppContext(), { dataDir = join(HERE, '..', 'data'), imageAssetsDir = undefined } = {}) {
  const app = express();
  app.use(express.json({ limit: '25mb' }));
  // The AI provider key travels per request in x-provider-key (browser
  // sessionStorage) and is used request-scoped only — never persisted.
  app.use((req, _res, next) => runWithKey(req.get('x-provider-key') || '', next));

  // API
  app.use('/api/config', configRouter(ctx));
  app.use('/api/rag', ragRouter(ctx));
  // content pipeline: /:posterId/angles runs the 95-gate loop synchronously
  // (minutes of model calls) — see routes/pipeline.js TIMEOUTS note
  app.use('/api/pipeline', pipelineRouter(ctx));
  // design phase (spec §B.6): template gallery / apply / dynamic 90-gate loop
  app.use('/api/design', designRouter(ctx));
  // override console (spec §B.9): harness pause/resume/decision/rollback
  app.use('/api/override', overrideRouter(ctx));
  // poster library list (spec §B.10) — names and statuses only, no docs
  app.use('/api/posters', postersRouter(ctx));
  // image library + slot fill (spec §B.7)
  app.use('/api/images', imagesRouter(ctx, imageAssetsDir));
  // Canva-replica editor saves (spec §B.8) — user changes, never agent-reviewed
  app.use('/api/editor', editorRouter(ctx));
  // translation subsystem (spec §B.11) — 9-language pipeline, variants, edit + batch sync
  app.use('/api/translation', translationRouter(ctx));
  // egress call log (prompt transparency rail, plan section D3).
  // Route note: the router registers /:runId and /detail/:id — safe as-is
  // because an Express :param never matches across a '/', so '/detail/7'
  // can only hit /detail/:id. If /:runId is ever widened to a wildcard or
  // regex, register /detail/:id FIRST.
  app.use('/api/egress', egressLogRouter(ctx));
  // token usage aggregation (counts only -- no prompt text)
  app.use('/api/usage', usageRouter(ctx));

  // live event stream for the pipeline visualization (SSE)
  app.get('/api/events/stream', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();
    res.write(`event: hello\ndata: {"ok":true}\n\n`);
    const off = ctx.bus.subscribe((event) => {
      res.write(`event: pipeline\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const keepalive = setInterval(() => res.write(':ka\n\n'), 25_000);
    req.on('close', () => { off(); clearInterval(keepalive); });
  });

  // distinct recent runs for the pipeline page run picker. Declared BEFORE
  // /api/events/:runId so "runs" never matches as a runId.
  app.get('/api/events/runs', (_req, res, next) => {
    try {
      const runs = ctx.db.prepare(
        `SELECT run_id AS runId, MIN(ts) AS firstTs, MAX(ts) AS lastTs, COUNT(*) AS eventCount
         FROM events GROUP BY run_id ORDER BY lastTs DESC LIMIT 100`
      ).all();
      res.json({ runs });
    } catch (err) { next(err); }
  });

  // queryable event history for debugging
  app.get('/api/events/:runId', (req, res, next) => {
    try {
      res.json({ events: ctx.bus.eventsForRun(req.params.runId) });
    } catch (err) { next(err); }
  });

  // static UI
  app.use(express.static(join(HERE, '..', 'ui')));

  // Global error handler: internals (SQL text, paths, prompt content) must
  // never reach a response body. Full error goes to server stderr only.
   
  app.use((err, _req, res, _next) => {
    console.error('[server error]', err);
    const status = err.code === 'MASKING_LEAK' ? 502 : 500;
    res.status(status).json({ error: err.code || 'INTERNAL_ERROR' });
  });

  return { app, ctx };
}

const mainPath = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (fileURLToPath(import.meta.url).toLowerCase() === mainPath) {
  const { app } = createServer();
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Poster app: http://127.0.0.1:${PORT}/`);
  });
}
