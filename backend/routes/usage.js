// Token usage aggregation route (spec: usage transparency).
// SECURITY: returns ONLY counts — no masked_prompt, masked_response, or
// masked_system values ever appear in the response.
// Session-auth is handled by the /api middleware in server.js.

import { Router } from 'express';

export function usageRouter(ctx) {
  const router = Router();

  // GET / — per-poster overview: every poster with its total calls/tokens
  // (the Usage page's all-posters table; cost is estimated client-side from
  // the same per-model rates as the detail view). Counts only.
  router.get('/', (_req, res, next) => {
    try {
      const rows = ctx.db.prepare(`
        SELECT
          p.poster_id                          AS posterId,
          p.name                               AS name,
          p.updated_at                         AS updatedAt,
          COUNT(e.id)                          AS calls,
          SUM(COALESCE(e.prompt_tokens, 0))    AS inTok,
          SUM(COALESCE(e.completion_tokens, 0)) AS outTok,
          SUM(CASE WHEN e.model = 'gpt-image-1'
                THEN COALESCE(e.prompt_tokens, 0) ELSE 0 END)     AS imgIn,
          SUM(CASE WHEN e.model = 'gpt-image-1'
                THEN COALESCE(e.completion_tokens, 0) ELSE 0 END) AS imgOut
        FROM posters p
        JOIN egress_log e ON e.run_id = json_extract(p.doc, '$.runId')
        GROUP BY p.poster_id
        ORDER BY p.updated_at DESC
      `).all();
      res.json({ posters: rows });
    } catch (err) { next(err); }
  });

  // GET /:posterId — token usage grouped by pipeline/stage/model for the poster's run.
  // Looks up the poster's runId from its doc JSON (same field all pipelines write).
  router.get('/:posterId', (req, res, next) => {
    try {
      const { posterId } = req.params;
      const posterRow = ctx.db
        .prepare('SELECT doc FROM posters WHERE poster_id = ?')
        .get(posterId);
      if (!posterRow) {
        return res.status(404).json({ error: 'POSTER_NOT_FOUND' });
      }

      let runId;
      try {
        runId = JSON.parse(posterRow.doc).runId ?? null;
      } catch {
        runId = null;
      }

      // A poster without a runId (e.g. imported or pre-pipeline) returns zero rows.
      const rows = runId
        ? ctx.db.prepare(`
            SELECT
              pipeline,
              stage,
              model,
              COUNT(*)                              AS calls,
              SUM(COALESCE(prompt_tokens, 0))       AS inTok,
              SUM(COALESCE(completion_tokens, 0))   AS outTok
            FROM egress_log
            WHERE run_id = ?
            GROUP BY pipeline, stage, model
            ORDER BY MIN(id)
          `).all(runId)
        : [];

      const totals = rows.reduce(
        (acc, r) => ({
          calls: acc.calls + r.calls,
          inTok: acc.inTok + r.inTok,
          outTok: acc.outTok + r.outTok
        }),
        { calls: 0, inTok: 0, outTok: 0 }
      );

      res.json({ rows, totals });
    } catch (err) { next(err); }
  });

  return router;
}
