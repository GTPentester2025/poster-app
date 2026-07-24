// Overseer (meta-reviewer) Sub-Agent.
// Watches every stage's OUTGOING prompts and feeds self-learning. Reads the
// MASKED prompt heads for a stage from the egress_log table (by runId + stage,
// heads only ≤500 chars), makes ONE cheap model call scoring the PROMPTING
// 0-100 with ≤2 concrete improvement notes, and records the finding to the
// learning table as kind 'prompt_review'. Deterministic fallback (no egress /
// no rows / model or parse error) = {score: null, notes: []} passthrough.
//
// SECURITY: only masked heads ever leave the DB — never restored text — and
// nothing overseer-related is returned in API responses (findings live only in
// the learning table + the fire-and-forget bus events).
//
// Resilient + log-only: never throws, never blocks a pipeline.

import { OVERSEER_SYSTEM, buildOverseerPrompt } from './prompts/overseer_prompts.js';

export const AGENT_ID = 'overseer';
export const skills = ['review_prompting'];

const PROJECT = 'poster-app';
const HEAD_CHARS = 500; // heads only — never full prompts
const HEAD_ROWS = 4;    // a few representative egress calls per stage

const PASSTHROUGH = { score: null, notes: [] };

/**
 * Read the masked prompt/system heads for a stage's egress calls.
 * Exact stage match plus a prefix match (LIKE 'stage%') so per-language
 * translation stages (`translate:fr`, `translate:de`, …) are covered when the
 * overseer is called with stage 'translate'. Heads only, capped rows.
 */
function readHeads(db, runId, stage) {
  try {
    const rows = db.prepare(
      `SELECT masked_prompt, masked_system FROM egress_log
       WHERE run_id = ? AND (stage = ? OR stage LIKE ?)
       ORDER BY id DESC LIMIT ?`
    ).all(runId, stage, `${stage}%`, HEAD_ROWS);
    return rows.map((r) => ({
      prompt: String(r.masked_prompt || '').slice(0, HEAD_CHARS),
      system: String(r.masked_system || '').slice(0, HEAD_CHARS)
    })).filter((h) => h.prompt);
  } catch {
    return [];
  }
}

/** Parse the overseer verdict {score, notes} from a parsed object or raw string. */
function parseVerdict(raw) {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
  if (!obj) return null;
  const score = Number(obj.score);
  const notes = Array.isArray(obj.notes)
    ? obj.notes.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim()).slice(0, 2)
    : [];
  if (!Number.isFinite(score)) return { score: null, notes };
  return { score: Math.max(0, Math.min(100, Math.round(score))), notes };
}

/**
 * Record an overseer finding to the learning table as kind 'prompt_review'.
 * Uses the same INSERT idiom as recordLearning; emits an 'overseer' memory_write
 * event. Best-effort — a DB/bus failure never propagates.
 */
function recordPromptReview({ db, bus, runId, pipeline, topic, stage, score, notes }) {
  try {
    const detail = JSON.stringify({ stage, score, notes });
    const info = db.prepare(
      'INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(new Date().toISOString(), 'prompt_review', topic || stage || 'unknown', null, detail, 1.0);
    if (bus) {
      bus.emit({
        runId, project: PROJECT, pipeline: pipeline || 'unknown', stage: 'overseer',
        agent: AGENT_ID, skill: 'review_prompting', type: 'memory_write',
        payload: { kind: 'prompt_review', stage, score, learningId: Number(info.lastInsertRowid) }
      });
    }
    return Number(info.lastInsertRowid);
  } catch {
    return null;
  }
}

/**
 * Review the prompting quality of a single stage's egress calls.
 * @param {object} opts
 *   egress   — MaskingEgress (falsy → passthrough)
 *   runId    — pipeline run id
 *   db       — poster DB (egress_log + learning tables)
 *   stage    — the stage whose outbound prompts are being reviewed
 *   pipeline — pipeline name (for events)
 *   topic    — poster topic (learning row topic; falls back to stage)
 *   bus      — optional EventBus (for the 'overseer' stage events)
 * @returns {Promise<{score: number|null, notes: string[]}>}
 */
export async function reviewPrompting({ egress, runId, db, stage, pipeline, topic = null, bus = null }) {
  // emit stage_start for viz visibility (fire-and-forget — always safe)
  if (bus) {
    try {
      bus.emit({
        runId, project: PROJECT, pipeline: pipeline || 'unknown', stage: 'overseer',
        agent: AGENT_ID, skill: 'review_prompting', type: 'stage_start',
        payload: { forStage: stage }
      });
    } catch { /* bus failure must never break the overseer */ }
  }

  let result = PASSTHROUGH;
  if (egress && typeof egress.completeJson === 'function' && runId && db) {
    const heads = readHeads(db, runId, stage);
    if (heads.length) {
      try {
        const user = buildOverseerPrompt({ stage, pipeline, heads });
        const raw = await egress.completeJson(
          { system: OVERSEER_SYSTEM, user, temperature: 0.2, maxTokens: 300 },
          { runId, pipeline: pipeline || 'unknown', stage: 'overseer', agent: AGENT_ID, skill: 'review_prompting' }
        );
        const v = parseVerdict(raw);
        if (v) {
          result = v;
          // record the finding to the learning table (score may be null → still logged)
          if (db) recordPromptReview({ db, bus, runId, pipeline, topic, stage, score: v.score, notes: v.notes });
        }
      } catch { /* model/parse failure → passthrough */ }
    }
  }

  if (bus) {
    try {
      bus.emit({
        runId, project: PROJECT, pipeline: pipeline || 'unknown', stage: 'overseer',
        agent: AGENT_ID, skill: 'review_prompting', type: 'stage_end',
        payload: { forStage: stage, score: result.score, noteCount: result.notes.length }
      });
    } catch { /* bus failure must never break the overseer */ }
  }

  return result;
}
