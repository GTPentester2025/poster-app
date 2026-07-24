// The Harness (spec §A.5, §B.9): central authority that coordinates all agents,
// validates every pipeline-to-pipeline hand-off, and can pause / rollback /
// override any agent decision independently of the normal loops.

import { randomUUID } from 'node:crypto';
import { validateEvent } from '../shared/index.js';
import { StateGraph, MemoryStateStore } from './state_graph.js';

export class Harness {
  constructor({ bus, gateEngine, memory = null, maxReworkLoops = 6 }) {
    this.bus = bus;
    this.gateEngine = gateEngine;
    this.memory = memory;
    this.maxReworkLoops = maxReworkLoops;
    this.state = new Map(); // runId -> { status: running|paused|rolledback, checkpoints: [] }
  }

  _runState(runId) {
    if (!this.state.has(runId)) {
      this.state.set(runId, { status: 'running', checkpoints: [], overrides: [] });
    }
    return this.state.get(runId);
  }

  /** Every stage transition passes through here. Throws on malformed hand-offs. */
  validateHandoff({ runId, project, pipeline, fromStage, toStage, fromAgent, toAgent, payload, parentEventId = null }) {
    const rs = this._runState(runId);
    if (rs.status === 'paused') {
      const err = new Error(`Run ${runId} is paused by harness override — hand-off ${fromStage} → ${toStage} blocked`);
      err.code = 'HARNESS_PAUSED';
      throw err;
    }
    const event = {
      runId, project, pipeline,
      stage: `${fromStage} → ${toStage}`,
      agent: fromAgent,
      skill: 'handoff',
      type: 'handoff',
      payload: { toAgent, toStage, summary: payload?.summary || '', keys: Object.keys(payload || {}) },
      parentEventId
    };
    const probe = { eventId: randomUUID(), ts: new Date().toISOString(), ...event };
    const check = validateEvent(probe);
    if (!check.ok) throw new Error(`Hand-off validation failed: ${check.errors.join('; ')}`);
    if (payload == null || typeof payload !== 'object' || Object.keys(payload).length === 0) {
      throw new Error(`Hand-off ${fromStage} → ${toStage} carried an empty payload — downstream agent would start blind`);
    }
    return this.bus.emit(event);
  }

  /** Save a checkpoint the harness can roll back to. */
  checkpoint(runId, label, snapshot) {
    const rs = this._runState(runId);
    rs.checkpoints.push({ label, ts: new Date().toISOString(), snapshot });
    return rs.checkpoints.length - 1;
  }

  /**
   * Public read view of a run's harness state (powers the override console).
   * Checkpoint snapshots stay internal — only {label, ts} leave the harness.
   * Reading an unknown run reports the default running state WITHOUT creating
   * a state entry (a read must never grow the run map).
   */
  getRunState(runId) {
    const rs = this.state.get(runId) || { status: 'running', checkpoints: [], overrides: [] };
    return {
      status: rs.status,
      checkpoints: rs.checkpoints.map(({ label, ts }) => ({ label, ts })),
      overrides: rs.overrides.map((o) => ({ ...o }))
    };
  }

  pause(runId, { project = 'poster-app', pipeline = 'build', reason }) {
    const rs = this._runState(runId);
    rs.status = 'paused';
    return this.bus.emit({
      runId, project, pipeline, stage: 'harness-control', agent: 'harness',
      skill: 'override', type: 'override',
      payload: { action: 'pause', reason }
    });
  }

  resume(runId, { project = 'poster-app', pipeline = 'build', reason = 'operator resume' } = {}) {
    const rs = this._runState(runId);
    rs.status = 'running';
    return this.bus.emit({
      runId, project, pipeline, stage: 'harness-control', agent: 'harness',
      skill: 'override', type: 'override',
      payload: { action: 'resume', reason }
    });
  }

  /** Roll back to a checkpoint index; returns the snapshot for the caller to restore. */
  rollback(runId, checkpointIndex, { project = 'poster-app', pipeline = 'build', reason }) {
    const rs = this._runState(runId);
    const cp = rs.checkpoints[checkpointIndex];
    if (!cp) throw new Error(`Run ${runId} has no checkpoint ${checkpointIndex}`);
    rs.checkpoints = rs.checkpoints.slice(0, checkpointIndex + 1);
    this.bus.emit({
      runId, project, pipeline, stage: 'harness-control', agent: 'harness',
      skill: 'override', type: 'override',
      payload: { action: 'rollback', checkpoint: cp.label, reason }
    });
    return cp.snapshot;
  }

  /** Override an agent decision (e.g. force-accept, force-reject). Logged, attributed, auditable. */
  override(runId, { project = 'poster-app', pipeline, stage, decision, reason, operator = 'system' }) {
    const rs = this._runState(runId);
    rs.overrides.push({ stage, decision, reason, operator, ts: new Date().toISOString() });
    return this.bus.emit({
      runId, project, pipeline: pipeline || 'build', stage: stage || 'harness-control',
      agent: 'harness', skill: 'override', type: 'override',
      payload: { action: 'override', decision, reason, operator }
    });
  }

  /**
   * The generic quality loop (spec §A.3/§B.5): produce → review → gate → rework
   * with feedback until the gate passes or maxReworkLoops is hit.
   *
   * produce(attempt, priorFeedback) -> deliverable content (string or object)
   * review(deliverable, attempt)   -> verdicts array for the gate engine
   *
   * Full history is preserved: each rework carries ALL prior feedback.
   * maxReworkLoops may be overridden per loop (e.g. the design loop caps at 4
   * while content keeps the harness default).
   *
   * bestEffortFloor (opt-in): rather than dead-ending the user when the gate is
   * never fully met, if the best attempt scored >= this floor the loop returns
   * that best deliverable flagged { bestEffort: true } instead of throwing.
   * Genuinely broken output (best score below the floor) still throws
   * GATE_EXHAUSTED. null = strict (throw on any exhaustion, the old behaviour).
   */
  async runQualityLoop({ runId, project, pipeline, stage, gateName, produce, review, onRework = null, maxReworkLoops = this.maxReworkLoops, bestEffortFloor = null }) {
    const history = [];
    let best = null; // { score, deliverable, verdicts, attempt } — highest-scoring failed attempt
    for (let attempt = 1; attempt <= maxReworkLoops; attempt++) {
      const rs = this._runState(runId);
      if (rs.status === 'paused') {
        const err = new Error(`Run ${runId} paused during quality loop at ${stage}`);
        err.code = 'HARNESS_PAUSED';
        throw err;
      }
      const startEvt = this.bus.emit({
        runId, project, pipeline, stage, agent: 'harness', skill: 'enforce_gates',
        type: 'stage_start', payload: { attempt, gateName }
      });
      const deliverable = await produce(attempt, history);
      const verdicts = await review(deliverable, attempt);
      const gate = this.gateEngine.check({
        gateName, runId, project, pipeline, stage, verdicts, parentEventId: startEvt.eventId
      });
      if (gate.passed) {
        this.bus.emit({
          runId, project, pipeline, stage, agent: 'harness', skill: 'enforce_gates',
          type: 'stage_end', payload: { attempt, score: gate.score, passed: true }
        });
        return { deliverable, verdicts, attempts: attempt, history };
      }
      if (!best || gate.score > best.score) best = { score: gate.score, deliverable, verdicts, attempt };
      history.push({ attempt, score: gate.score, feedback: gate.feedback, expected: gate.expected });
      if (this.memory) {
        this.memory.record({
          runId, project, kind: 'rework_reason',
          subject: `${pipeline}/${stage}`,
          detail: `attempt ${attempt} scored ${gate.score} (< gate): ${gate.feedback}`,
          tags: [pipeline, stage, gateName]
        });
      }
      // rework only announces a FURTHER attempt; the final failed attempt ends in
      // an error event via the thrown GATE_EXHAUSTED, not a misleading rework entry
      if (attempt < maxReworkLoops) {
        this.bus.emit({
          runId, project, pipeline, stage, agent: 'harness', skill: 'enforce_gates',
          type: 'rework',
          payload: { attempt, score: gate.score, routedFeedback: gate.feedback, expected: gate.expected }
        });
        if (onRework) await onRework({ attempt, gate, deliverable });
      }
    }
    // Graceful degradation: accept the best near-miss rather than dead-ending
    // the user, but only when it clears the best-effort floor. The shortfall is
    // still surfaced (bestEffort flag + the failed history) so callers can
    // record it for self-learning.
    if (bestEffortFloor != null && best && best.score >= bestEffortFloor) {
      this.bus.emit({
        runId, project, pipeline, stage, agent: 'harness', skill: 'enforce_gates',
        type: 'stage_end',
        payload: { attempt: best.attempt, score: best.score, passed: false, bestEffort: true, gateName }
      });
      // attempts = the attempt that produced the accepted draft, not the loop cap
      return { deliverable: best.deliverable, verdicts: best.verdicts, attempts: best.attempt, history, bestEffort: true };
    }
    this.bus.emit({
      runId, project, pipeline, stage, agent: 'harness', skill: 'enforce_gates',
      type: 'error',
      payload: { code: 'GATE_EXHAUSTED', attempts: maxReworkLoops, gateName, lastScore: history.at(-1)?.score }
    });
    const err = new Error(
      `Quality loop exhausted ${maxReworkLoops} attempts at ${pipeline}/${stage} without passing gate "${gateName}". ` +
      `Last feedback: ${history.at(-1)?.feedback?.slice(0, 500)}`
    );
    err.code = 'GATE_EXHAUSTED';
    err.history = history;
    throw err;
  }

  /**
   * Drive an explicit StateGraph as a first-class harness capability (spec ITEM 6).
   * The graph inherits the harness's bus (so its structured node/edge/loopback log
   * lands on the same event stream) and its loop-cap escalations route to the
   * harness — a capped loop pauses the run and records an override rather than
   * spinning. runQualityLoop is untouched; a graph node can call it internally.
   *
   * @param {object} opts
   *   runId, project     — event envelope
   *   graph              — a configured StateGraph OR its constructor opts (nodes/edges added by caller before calling)
   *   startId            — entry node (defaults to graph.id's first added node)
   *   ctx                — shared node context; ctx.confused is left to the caller/ConfusionRegister
   *   resumeRunId        — resume a prior run, skipping completed nodes
   *   store              — checkpoint store (default in-memory)
   *   onEscalate         — extra escalation hook layered on top of the harness pause
   */
  async runGraph({ runId, project = 'studio', graph, startId, ctx = {}, resumeRunId = null, store = null, onEscalate = null }) {
    if (!(graph instanceof StateGraph)) {
      throw new Error('runGraph requires a StateGraph instance (build it, add nodes/edges, then pass it)');
    }
    // Wire the harness's bus + envelope + escalation into the graph.
    graph.bus = this.bus;
    graph.runId = runId;
    graph.project = project;
    if (store) graph.store = store;
    else if (!graph.store) graph.store = new MemoryStateStore();

    graph.onEscalate = async ({ node, reason, iterations }) => {
      // A bounded-loop cap-hit escalates to the orchestrator: pause the run and
      // record it as an auditable override so an operator can intervene.
      this.pause(runId, { project, pipeline: 'studio-graph', reason: `loop cap at ${node}: ${reason} (${iterations} iterations)` });
      this.override(runId, {
        project, pipeline: 'studio-graph', stage: node,
        decision: 'escalated', reason: `loop cap hit: ${reason}`, operator: 'harness'
      });
      if (onEscalate) await onEscalate({ node, reason, iterations });
    };

    const start = startId || graph.nodes.keys().next().value;
    const result = await graph.runFrom(start, ctx, { resumeRunId });
    return { ...result, queryLog: () => graph.queryLog(runId) };
  }
}
