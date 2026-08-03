// Explicit state graph for Studio orchestration (spec ITEM 6).
//
// A pipeline is modelled as a directed graph of nodes connected by edges.
// Unlike an implicit call chain, the graph is INSPECTABLE (toJSON / describe),
// its loops are BOUNDED (every loopback carries an iteration cap and escalates
// on cap-hit rather than spinning forever), it CHECKPOINTS completed nodes to a
// pluggable store so a run can RESUME without re-running finished work, it can
// FAN OUT independent branches concurrently and JOIN them, and every entry,
// exit, edge decision and loopback is logged as a structured event so the whole
// walk is queryable after the fact (never console spew).
//
// Node.run(ctx) contract:
//   returns { status:'pass'|'rework'|'stop', output?, loopTo?, tokenCost? }
//   - 'pass'   : proceed along the first outgoing edge whose predicate passes
//   - 'rework' : follow the loopback edge to `loopTo` (a prior node id) and re-run
//   - 'stop'   : terminate the walk here
//
// The bus + store are INJECTED so the graph is deterministic and unit-testable.

// Confusion signal: a node throws an Error with this code to pause only itself
// (the studio ConfusionRegister isn't vendored — poster-app only needs the
// constant the state graph catches). Kept identical to the studio value.
const CONFUSION_PENDING = 'CONFUSION_PENDING';

/** In-memory checkpoint store (the injectable default). Swap for a sqlite-backed
 * store implementing the same {load(runId), save(runId,state)} interface. */
export class MemoryStateStore {
  constructor() { this._byRun = new Map(); }
  load(runId) {
    const s = this._byRun.get(runId);
    // return a deep-ish copy so callers can mutate freely without corrupting the store
    return s ? JSON.parse(JSON.stringify(s)) : null;
  }
  save(runId, state) {
    this._byRun.set(runId, JSON.parse(JSON.stringify(state)));
  }
}

/** SQLite-backed checkpoint store. Persists one JSON blob of graph state per run
 * so a resumed run reloads completed-node output across process restarts.
 * `db` is a better-sqlite3 Database (same one the EventBus/memory use). */
export class SqliteStateStore {
  constructor(db, { table = 'graph_state' } = {}) {
    this.db = db;
    this.table = table;
    db.exec(`CREATE TABLE IF NOT EXISTS ${table} (
      run_id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      state TEXT NOT NULL
    );`);
    this._get = db.prepare(`SELECT state FROM ${table} WHERE run_id = ?`);
    this._put = db.prepare(
      `INSERT INTO ${table} (run_id, ts, state) VALUES (@run_id, @ts, @state)
       ON CONFLICT(run_id) DO UPDATE SET ts = excluded.ts, state = excluded.state`
    );
  }
  load(runId) {
    const row = this._get.get(runId);
    return row ? JSON.parse(row.state) : null;
  }
  save(runId, state) {
    this._put.run({ run_id: runId, ts: new Date().toISOString(), state: JSON.stringify(state) });
  }
}

// Bounded-concurrency fan-out helper (mirrors shared mapWithConcurrency but kept
// local so the graph has no cross-package coupling and can cap fan-out width).
async function runConcurrent(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function pump() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 0 }, pump));
  return results;
}

export class StateGraph {
  /**
   * @param {object} opts
   *   id            — graph identifier (used in describe()/toJSON())
   *   defaultLoopCap— max iterations per loopback edge unless overridden (default 4)
   *   fanoutLimit   — max concurrent children per fanout node (default 6)
   *   bus           — event bus for structured logging (emit shape mirrors harness)
   *   store         — {load(runId), save(runId,state)} checkpoint store (default in-memory)
   *   runId/project — event envelope defaults
   *   onEscalate    — async ({node,reason,iterations}) called on loop-cap hit
   */
  constructor({
    id = 'studio-graph', defaultLoopCap = 4, fanoutLimit = 6,
    bus = null, store = new MemoryStateStore(), runId = null, project = 'studio',
    onEscalate = null
  } = {}) {
    this.id = id;
    this.defaultLoopCap = defaultLoopCap;
    this.fanoutLimit = fanoutLimit;
    this.bus = bus;
    this.store = store;
    this.runId = runId;
    this.project = project;
    this.onEscalate = onEscalate;
    this.nodes = new Map();   // id -> { id, kind, run, childNodeIds?, subgraph? }
    this.edges = [];          // { from, to, when? }
    this.loopbacks = [];      // { from, to, reason, cap }
    this.subgraphs = new Map(); // id -> StateGraph  (composable sub-pipelines)
    this.metrics = new Map();   // nodeId -> { runs, totalMs, failures, lastMs }
  }

  /**
   * Register a subgraph that can be referenced by nodes as kind='subgraph'.
   * A subgraph node runs the entire sub-pipeline as a single unit, exposing
   * only its aggregated input/output through the parent graph.
   * @param {string} id unique subgraph identifier
   * @param {StateGraph} graph the composed subgraph
   */
  addSubgraph(id, graph) {
    if (!(graph instanceof StateGraph)) throw new Error(`addSubgraph "${id}": must be a StateGraph instance`);
    this.subgraphs.set(id, graph);
    return this;
  }

  /** kind: 'task' (default) | 'fanout' | 'join' | 'subgraph' (runs a registered sub-pipeline). */
  addNode(id, { kind = 'task', run = null, childNodeIds = null } = {}) {
    if (this.nodes.has(id)) throw new Error(`Duplicate node id: ${id}`);
    if (kind === 'fanout' && (!Array.isArray(childNodeIds) || childNodeIds.length === 0)) {
      throw new Error(`fanout node "${id}" requires childNodeIds`);
    }
    if (kind !== 'fanout' && typeof run !== 'function') {
      throw new Error(`node "${id}" requires a run function`);
    }
    this.nodes.set(id, { id, kind, run, childNodeIds });
    return this;
  }

  /** Forward edge. `when(ctx, node)` predicate (optional) gates traversal. */
  addEdge(from, to, { when = null } = {}) {
    this.edges.push({ from, to, when });
    return this;
  }

  /** Conditional loopback to a PRIOR node, labelled with WHY, capped per-edge. */
  addLoopback(from, toPriorNode, { reason = 'rework', cap = this.defaultLoopCap } = {}) {
    this.loopbacks.push({ from, to: toPriorNode, reason, cap });
    return this;
  }

  /** Inspectable structure — {nodes, edges, loopbacks}. Predicates rendered as flags. */
  toJSON() {
    return {
      id: this.id,
      nodes: [...this.nodes.values()].map((n) => ({
        id: n.id, kind: n.kind, ...(n.childNodeIds ? { childNodeIds: n.childNodeIds } : {})
      })),
      edges: this.edges.map((e) => ({ from: e.from, to: e.to, conditional: !!e.when })),
      loopbacks: this.loopbacks.map((l) => ({ from: l.from, to: l.to, reason: l.reason, cap: l.cap }))
    };
  }

  /** Text/DOT-ish diagram of the graph for logs and human inspection. */
  describe() {
    const lines = [`digraph ${this.id} {`];
    for (const n of this.nodes.values()) {
      const label = n.kind === 'task' ? n.id : `${n.id} [${n.kind}]`;
      lines.push(`  "${n.id}"; // ${label}`);
      if (n.childNodeIds) {
        for (const c of n.childNodeIds) lines.push(`  "${n.id}" -> "${c}" [style=dashed,label="fanout"];`);
      }
    }
    for (const e of this.edges) {
      lines.push(`  "${e.from}" -> "${e.to}"${e.when ? ' [label="when(...)"]' : ''};`);
    }
    for (const l of this.loopbacks) {
      lines.push(`  "${l.from}" -> "${l.to}" [color=red,label="loopback: ${l.reason} (cap ${l.cap})"];`);
    }
    lines.push('}');
    return lines.join('\n');
  }

  // ---- structured logging -------------------------------------------------
  // The shared EventBus only accepts a fixed allowlist of `type` values, so we
  // emit the spec-faithful structured event as-is when the injected bus accepts
  // it (test buses do), and transparently fall back to a valid envelope that
  // carries the semantic type in payload.type when the strict production bus
  // rejects it — never dropping or corrupting the audit trail.
  _emit(type, stage, payload) {
    if (!this.bus) return null;
    const event = {
      runId: this.runId, project: this.project, pipeline: 'studio-graph',
      stage, agent: 'orchestrator', type, payload
    };
    try {
      return this.bus.emit(event);
    } catch {
      return this.bus.emit({
        runId: this.runId, project: this.project, pipeline: 'studio-graph',
        stage, agent: 'orchestrator', type: 'agent_output',
        payload: { graphEvent: type, ...payload }
      });
    }
  }

  // ---- checkpoint state ---------------------------------------------------
  _blankState() { return { graph: this.id, completed: {}, loopCounts: {}, blocked: {} }; }

  _persist(state) {
    if (this.store && this.runId) this.store.save(this.runId, state);
  }

  /**
   * Walk the graph from startId.
   * @param {string} startId
   * @param {object} ctx  shared mutable context passed to every node.run
   * @param {object} [opts]
   *   resumeRunId — reload persisted state; completed nodes are SKIPPED (not re-run)
   */
  async runFrom(startId, ctx = {}, { resumeRunId = null } = {}) {
    let state = this._blankState();
    if (resumeRunId != null && this.store) {
      const loaded = this.store.load(resumeRunId);
      if (loaded) { state = { ...this._blankState(), ...loaded }; this.runId = resumeRunId; }
    }
    const trace = []; // ordered node ids actually executed this call

    let currentId = startId;
    // if resuming, fast-forward past leading completed nodes on the linear spine
    let guard = 0;
    const hardGuard = (this.nodes.size + this.loopbacks.length) * (this.defaultLoopCap + 2) + 100;

    while (currentId) {
      if (++guard > hardGuard) {
        throw new Error(`StateGraph ${this.id} exceeded traversal guard — likely an unbounded loop without a loopback cap`);
      }
      const node = this.nodes.get(currentId);
      if (!node) throw new Error(`StateGraph ${this.id}: no node "${currentId}"`);

      // resume: skip already-completed nodes, replay their recorded output
      if (state.completed[node.id]) {
        const next = this._nextEdge(node.id, ctx);
        currentId = next ? next.to : null;
        continue;
      }

      let result;
      if (node.kind === 'fanout') {
        result = await this._runFanout(node, ctx, state, trace);
        // fanout+join collapses into one step; it dictates the next node directly.
        if (result._continueFrom !== undefined) {
          currentId = result._continueFrom;
          continue;
        }
        if (result.status === 'rework') {
          const target = this._loopback(result._loopFrom || node.id, result.loopTo, state);
          currentId = target === null ? null : target;
          continue;
        }
        currentId = null; // join said stop
        continue;
      } else {
        this._emit('node_entry', node.id, { kind: node.kind });
        try {
          result = await node.run(ctx);
        } catch (err) {
          if (err && err.code === CONFUSION_PENDING) {
            // an ambiguous decision was escalated — block THIS node, keep other
            // independent branches alive by continuing the walk elsewhere.
            state.blocked[node.id] = { reason: err.message, confusionId: err.confusionId || null };
            this._persist(state);
            this._emit('node_exit', node.id, { status: 'blocked', reason: 'confusion_pending' });
            trace.push(node.id);
            // a blocked node cannot dictate a forward edge; stop this branch.
            currentId = null;
            continue;
          }
          throw err;
        }
      }

      result = result || { status: 'pass' };
      trace.push(node.id);
      this._emit('node_exit', node.id, {
        status: result.status, ...(result.tokenCost != null ? { tokenCost: result.tokenCost } : {})
      });

      if (result.status === 'stop') {
        state.completed[node.id] = { output: result.output ?? null };
        this._persist(state);
        currentId = null;
        continue;
      }

      if (result.status === 'rework') {
        const target = this._loopback(node.id, result.loopTo, state);
        if (target === null) {
          // cap hit → escalated + stopped this loop (loop_cap already emitted)
          currentId = null;
          continue;
        }
        currentId = target;
        continue;
      }

      // 'pass' → mark complete, follow first satisfied forward edge
      state.completed[node.id] = { output: result.output ?? null };
      this._persist(state);
      const next = this._nextEdge(node.id, ctx);
      if (next) {
        this._emit('edge_decision', node.id, { to: next.to, why: next.why });
        currentId = next.to;
      } else {
        currentId = null; // terminal node
      }
    }

    return {
      trace,
      completed: state.completed,
      blocked: state.blocked,
      loopCounts: state.loopCounts,
      output: this._terminalOutput(trace, state)
    };
  }

  _terminalOutput(trace, state) {
    for (let i = trace.length - 1; i >= 0; i--) {
      const c = state.completed[trace[i]];
      if (c) return c.output;
    }
    return null;
  }

  /** First outgoing forward edge whose predicate passes; records WHY it was taken. */
  _nextEdge(fromId, ctx) {
    for (const e of this.edges) {
      if (e.from !== fromId) continue;
      if (!e.when) return { to: e.to, why: 'unconditional' };
      let ok = false;
      try { ok = !!e.when(ctx, this.nodes.get(fromId)); } catch { ok = false; }
      if (ok) return { to: e.to, why: 'predicate:true' };
    }
    return null;
  }

  /** Follow a loopback edge back to a prior node, enforcing the per-edge cap. */
  _loopback(fromId, loopTo, state) {
    const lb = this.loopbacks.find((l) => l.from === fromId && (loopTo == null || l.to === loopTo));
    if (!lb) throw new Error(`No loopback edge from "${fromId}"${loopTo ? ` to "${loopTo}"` : ''}`);
    const key = `${lb.from}->${lb.to}`;
    const iterations = (state.loopCounts[key] || 0) + 1;
    state.loopCounts[key] = iterations;

    if (iterations > lb.cap) {
      this._emit('loop_cap', fromId, { to: lb.to, reason: lb.reason, iterations, cap: lb.cap });
      if (this.onEscalate) {
        // fire-and-forget escalation; callers awaiting the escalation can hook it
        Promise.resolve(this.onEscalate({ node: fromId, reason: lb.reason, iterations })).catch(() => {});
      }
      this._persist(state);
      return null; // STOP this loop — no infinite spin
    }

    this._emit('loopback', fromId, { to: lb.to, reason: lb.reason, iteration: iterations, cap: lb.cap });
    // re-running the target: clear its completion so it executes again
    delete state.completed[lb.to];
    this._persist(state);
    return lb.to;
  }

  /** Run a fanout node's children concurrently, then hand aggregated outputs to
   * the join node named by the fanout's single forward edge. */
  async _runFanout(node, ctx, state, trace) {
    this._emit('node_entry', node.id, { kind: 'fanout', children: node.childNodeIds });
    const children = node.childNodeIds.map((cid) => {
      const c = this.nodes.get(cid);
      if (!c) throw new Error(`fanout "${node.id}" references missing child "${cid}"`);
      return c;
    });

    const outputs = await runConcurrent(children, this.fanoutLimit, async (child) => {
      this._emit('node_entry', child.id, { kind: child.kind, parent: node.id });
      const r = (await child.run(ctx)) || { status: 'pass' };
      this._emit('node_exit', child.id, {
        status: r.status, parent: node.id,
        ...(r.tokenCost != null ? { tokenCost: r.tokenCost } : {})
      });
      state.completed[child.id] = { output: r.output ?? null };
      trace.push(child.id);
      return { id: child.id, output: r.output ?? null };
    });

    this._persist(state);

    // locate the join node this fanout feeds
    const joinEdge = this.edges.find((e) => e.from === node.id);
    if (!joinEdge) throw new Error(`fanout "${node.id}" has no forward edge to a join node`);
    const joinNode = this.nodes.get(joinEdge.to);
    if (!joinNode || joinNode.kind !== 'join') {
      throw new Error(`fanout "${node.id}" must connect to a join node; got "${joinEdge.to}"`);
    }

    // aggregate children outputs and run the join gate
    this._emit('node_entry', joinNode.id, { kind: 'join', from: node.id, branches: outputs.length });
    const aggregated = { branches: outputs, byId: Object.fromEntries(outputs.map((o) => [o.id, o.output])) };
    const joinResult = (await joinNode.run(ctx, aggregated)) || { status: 'pass', output: aggregated };
    this._emit('node_exit', joinNode.id, { status: joinResult.status });
    state.completed[node.id] = { output: aggregated };
    state.completed[joinNode.id] = { output: joinResult.output ?? aggregated };
    trace.push(joinNode.id);
    this._persist(state);

    // the fanout+join collapses into the join's result; continue from the join's edges
    if (joinResult.status === 'rework') {
      return { status: 'rework', output: joinResult.output ?? aggregated, loopTo: joinResult.loopTo, _loopFrom: joinNode.id };
    }
    if (joinResult.status === 'stop') {
      return { status: 'stop', output: joinResult.output ?? aggregated };
    }
    const next = this._nextEdge(joinNode.id, ctx);
    if (next) {
      this._emit('edge_decision', joinNode.id, { to: next.to, why: next.why });
      return { status: 'pass', output: joinResult.output ?? aggregated, _continueFrom: next.to };
    }
    return { status: 'pass', output: joinResult.output ?? aggregated, _continueFrom: null };
  }

  /** Ordered node/decision history for a run, read from the store's structured log
   * if the store keeps one, else reconstructed from the bus mirror when available. */
  queryLog(runId) {
    // Prefer the event bus SQLite mirror (queryable, not console spew).
    if (this.bus && typeof this.bus.eventsForRun === 'function') {
      return this.bus.eventsForRun(runId)
        .filter((e) => e.pipeline === 'studio-graph')
        .map((e) => {
          const payload = typeof e.payload === 'string' ? safeParse(e.payload) : e.payload;
          // The strict production bus maps custom types onto 'agent_output' and
          // stashes the semantic type in payload.graphEvent — surface it back so
          // the queryable log always reads in spec-faithful terms.
          const type = (payload && payload.graphEvent) ? payload.graphEvent : e.type;
          return { ts: e.ts, stage: e.stage, type, payload };
        });
    }
    return [];
  }
}

function safeParse(s) { try { return JSON.parse(s); } catch { return s; } }
