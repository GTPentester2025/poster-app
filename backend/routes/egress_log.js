// Egress call log API (prompt transparency rail, plan section D3 / Phase O8).
// SECURITY: list endpoint returns metadata only (NO prompt bodies).
//           Full masked texts only available via the detail endpoint.
//           Session-auth is handled by the /api middleware in server.js.
//           Restored values are NEVER stored and therefore can NEVER be returned.

import { Router } from 'express';

export function egressLogRouter(ctx) {
  const router = Router();

  // GET /:runId — list all rows for a run (light: no prompt bodies)
  router.get('/:runId', (req, res, next) => {
    try {
      const { runId } = req.params;
      const rows = ctx.db.prepare(`
        SELECT id, ts, stage, agent, skill, model, direction, duration_ms, status
        FROM egress_log
        WHERE run_id = ?
        ORDER BY id ASC
      `).all(runId);
      res.json({ egressLog: rows });
    } catch (err) { next(err); }
  });

  // GET /detail/:id — one full row including masked prompt bodies
  router.get('/detail/:id', (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: 'INVALID_ID' });
      }
      const row = ctx.db.prepare(`
        SELECT id, ts, run_id, event_id, pipeline, stage, agent, skill,
               direction, model, masked_system, masked_prompt, masked_response,
               duration_ms, status
        FROM egress_log
        WHERE id = ?
      `).get(id);
      if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
      res.json({ entry: row });
    } catch (err) { next(err); }
  });

  return router;
}
