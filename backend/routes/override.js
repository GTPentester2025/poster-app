// Override console API (spec §B.9): the system-level control tied to the
// studio harness — pause, resume, force a decision, or roll back any run
// independently of the normal approval loops. Harness run state is in-memory
// (a control surface for live runs, not a persistence layer); every action is
// emitted as an override event so the pipeline UI and audit log see it.
//
// Same error discipline as the other routes: input validation returns 400
// inline; everything else forwards to the global handler via next(err) so
// harness internals never leak into response bodies. Checkpoint SNAPSHOTS
// never leave the server — rollback responses carry the restored label only.

import { Router } from 'express';

const MAX_REASON_LENGTH = 1000;
const DECISIONS = ['accepted', 'rejected', 'modification_required'];

// The poster app's runs live on the content pipeline; override events default
// there so they land next to the run they control in the event log.
const DEFAULT_PIPELINE = 'content';

function reasonProblem(reason) {
  if (typeof reason !== 'string' || !reason.trim()) return 'reason must be a non-empty string';
  if (reason.length > MAX_REASON_LENGTH) return `reason must be at most ${MAX_REASON_LENGTH} characters`;
  return null;
}

export function overrideRouter({ harness, db }) {
  const router = Router();

  router.post('/:runId/pause', (req, res, next) => {
    try {
      const problem = reasonProblem(req.body?.reason);
      if (problem) return res.status(400).json({ error: problem });
      harness.pause(req.params.runId, { pipeline: DEFAULT_PIPELINE, reason: req.body.reason.trim() });
      res.json(harness.getRunState(req.params.runId));
    } catch (err) { next(err); }
  });

  router.post('/:runId/resume', (req, res, next) => {
    try {
      const reason = req.body?.reason;
      if (reason !== undefined && reason !== null && reasonProblem(reason)) {
        return res.status(400).json({ error: reasonProblem(reason) });
      }
      harness.resume(req.params.runId, {
        pipeline: DEFAULT_PIPELINE,
        ...(typeof reason === 'string' && reason.trim() ? { reason: reason.trim() } : {})
      });
      res.json(harness.getRunState(req.params.runId));
    } catch (err) { next(err); }
  });

  // Force an agent decision (accepted / rejected). Logged, attributed,
  // auditable — the operator name rides on the override event.
  router.post('/:runId/decision', (req, res, next) => {
    try {
      const { pipeline, stage, decision, reason, operator } = req.body || {};
      if (!DECISIONS.includes(decision)) {
        return res.status(400).json({ error: `decision must be one of: ${DECISIONS.join(' | ')}` });
      }
      if (typeof stage !== 'string' || !stage.trim()) {
        return res.status(400).json({ error: 'stage must be a non-empty string' });
      }
      const problem = reasonProblem(reason);
      if (problem) return res.status(400).json({ error: problem });
      if (operator !== undefined && (typeof operator !== 'string' || !operator.trim())) {
        return res.status(400).json({ error: 'operator must be a non-empty string when provided' });
      }
      if (pipeline !== undefined && (typeof pipeline !== 'string' || !pipeline.trim())) {
        return res.status(400).json({ error: 'pipeline must be a non-empty string when provided' });
      }
      harness.override(req.params.runId, {
        pipeline: pipeline?.trim() || DEFAULT_PIPELINE,
        stage: stage.trim(),
        decision,
        reason: reason.trim(),
        operator: operator?.trim() || 'operator'
      });
      res.json(harness.getRunState(req.params.runId));
    } catch (err) { next(err); }
  });

  // Roll back to a checkpoint. The snapshot is restored server-side RIGHT
  // HERE (poster doc back into SQLite); the client only learns WHICH
  // checkpoint was restored — the snapshot itself never leaves the server.
  router.post('/:runId/rollback', (req, res, next) => {
    try {
      const { checkpointIndex, reason } = req.body || {};
      if (!Number.isInteger(checkpointIndex) || checkpointIndex < 0) {
        return res.status(400).json({ error: 'checkpointIndex must be a non-negative integer' });
      }
      const problem = reasonProblem(reason);
      if (problem) return res.status(400).json({ error: problem });
      const state = harness.getRunState(req.params.runId);
      const cp = state.checkpoints[checkpointIndex];
      if (!cp) return res.status(404).json({ error: 'CHECKPOINT_NOT_FOUND' });
      const snapshot = harness.rollback(req.params.runId, checkpointIndex, { pipeline: DEFAULT_PIPELINE, reason: reason.trim() });
      // content-pipeline checkpoints snapshot {posterId, doc} — write the doc
      // back so the SQLite poster record actually matches the restored state
      if (snapshot?.posterId && snapshot?.doc) {
        db.prepare('UPDATE posters SET doc = ?, status = COALESCE(?, status), updated_at = ? WHERE poster_id = ?')
          .run(JSON.stringify(snapshot.doc), snapshot.doc.status || null, new Date().toISOString(), snapshot.posterId);
      }
      res.json({ restored: cp.label, ...harness.getRunState(req.params.runId) });
    } catch (err) { next(err); }
  });

  router.get('/:runId/state', (req, res, next) => {
    try {
      res.json(harness.getRunState(req.params.runId));
    } catch (err) { next(err); }
  });

  return router;
}
