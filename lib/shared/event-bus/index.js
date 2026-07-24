// Shared event bus: single write path for every agent action, hand-off, verdict,
// gate check, rework, user action and override across Studio and Poster App.
//
// Sinks:
//   - JSONL append-only file per run   (post-hoc debugging, ensemble logs)
//   - SQLite mirror                    (queryable; powers UI history views)
//   - in-process subscribers           (SSE broadcast to the pipeline-viz UI)
//
// Invalid events THROW — a malformed hand-off must fail loudly, not get logged half-broken.

import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateEvent } from './validate.js';

export class EventBus {
  /**
   * @param {object} opts
   * @param {string} opts.logDir   directory for run_<id>.jsonl files
   * @param {object} [opts.db]     better-sqlite3 Database for the queryable mirror
   */
  constructor({ logDir, db = null } = {}) {
    if (!logDir) throw new Error('EventBus requires logDir');
    this.logDir = logDir;
    mkdirSync(logDir, { recursive: true });
    this.subscribers = new Set();
    this.db = db;
    this.insertStmt = null;
    if (db) {
      db.exec(`CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        ts TEXT NOT NULL,
        run_id TEXT NOT NULL,
        project TEXT NOT NULL,
        pipeline TEXT NOT NULL,
        stage TEXT NOT NULL,
        agent TEXT NOT NULL,
        skill TEXT,
        type TEXT NOT NULL,
        payload TEXT,
        verdict_status TEXT,
        verdict_score REAL,
        verdict_feedback TEXT,
        verdict_expected TEXT,
        parent_event_id TEXT,
        masking_applied INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id, ts);
      CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent, ts);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type, ts);`);
      this.insertStmt = db.prepare(`INSERT OR IGNORE INTO events
        (event_id, ts, run_id, project, pipeline, stage, agent, skill, type, payload,
         verdict_status, verdict_score, verdict_feedback, verdict_expected, parent_event_id, masking_applied)
        VALUES (@event_id, @ts, @run_id, @project, @pipeline, @stage, @agent, @skill, @type, @payload,
         @verdict_status, @verdict_score, @verdict_feedback, @verdict_expected, @parent_event_id, @masking_applied)`);
    }
  }

  /**
   * Emit an event. Fills eventId/ts if absent, validates, fans out to all sinks.
   * Returns the completed event (so callers can chain parentEventId).
   */
  emit(partial) {
    const event = {
      ...partial,
      eventId: partial.eventId || randomUUID(),
      ts: partial.ts || new Date().toISOString(),
      skill: partial.skill || '',
      payload: partial.payload ?? {},
      parentEventId: partial.parentEventId ?? null,
      maskingApplied: partial.maskingApplied ?? true
    };

    const result = validateEvent(event);
    if (!result.ok) {
      throw new Error(`EventBus rejected invalid event: ${result.errors.join('; ')}`);
    }

    appendFileSync(join(this.logDir, `${event.runId}.jsonl`), JSON.stringify(event) + '\n', 'utf8');

    if (this.insertStmt) {
      this.insertStmt.run({
        event_id: event.eventId,
        ts: event.ts,
        run_id: event.runId,
        project: event.project,
        pipeline: event.pipeline,
        stage: event.stage,
        agent: event.agent,
        skill: event.skill || null,
        type: event.type,
        payload: JSON.stringify(event.payload || {}),
        verdict_status: event.verdict?.status ?? null,
        verdict_score: event.verdict?.score ?? null,
        verdict_feedback: event.verdict?.feedback ?? null,
        verdict_expected: event.verdict?.expected ?? null,
        parent_event_id: event.parentEventId,
        masking_applied: event.maskingApplied ? 1 : 0
      });
    }

    for (const fn of this.subscribers) {
      try { fn(event); } catch { /* one bad subscriber must not break the pipeline */ }
    }
    return event;
  }

  /** Subscribe to live events (SSE broadcaster). Returns unsubscribe fn. */
  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  /** Query the SQLite mirror. */
  eventsForRun(runId) {
    if (!this.db) return [];
    return this.db.prepare('SELECT * FROM events WHERE run_id = ? ORDER BY ts').all(runId);
  }

  reworkHistory(runId) {
    if (!this.db) return [];
    return this.db.prepare(
      "SELECT * FROM events WHERE run_id = ? AND type IN ('rework','review_verdict','gate_check') ORDER BY ts"
    ).all(runId);
  }
}

export function newRunId(prefix = 'run') {
  return `${prefix}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}
