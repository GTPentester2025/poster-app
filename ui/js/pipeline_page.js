// Live pipeline visualization + override console (spec B.9). Vanilla JS:
// fixed agent-node columns for the poster pipeline, node glow states driven
// by the event stream of the selected run, an event feed with expandable
// payload/verdict detail, hand-off / sent-back arrow flashes (SVG overlay),
// and the harness override console (pause / resume / force decision /
// rollback). History is replayed from /api/events/:runId; live events arrive
// over the shared SSE stream and are filtered client-side by runId.

const $ = (id) => document.getElementById(id);

// HTML-escape for the few innerHTML template paths (everything else uses
// textContent). ANY value interpolated into an innerHTML string goes through
// here first.
function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ── fixed pipeline columns ──────────────────────────────────────────────────
// prompt → keyword-intent → research → content-gen ⇄ content-review →
// user-approval → (design) → (images) → (editor) → (translation)

const NODES = [
  { id: 'prompt-intake', label: 'Prompt intake', agent: 'user', skills: ['write_prompt'] },
  { id: 'keyword-intent', label: 'Keyword & intent', agent: 'keyword-intent', skills: ['extract_keywords', 'semantic_expand', 'detect_content_shape'] },
  { id: 'research', label: 'RAG research', agent: 'rag-research', skills: ['retrieve_articles', 'synthesize_context'] },
  { id: 'content-gen', label: 'Content generator', agent: 'content-generator', skills: ['write_poster_copy', 'restructure_format', 'apply_tone', 'avoid_idioms'] },
  { id: 'content-review', label: 'Content reviewer', agent: 'content-reviewer', skills: ['score_content', 'write_actionable_feedback', 'check_translatability'] },
  { id: 'user-approval', label: 'User approval', agent: 'user', skills: ['approve', 'regenerate', 'give_feedback', 'inline_edit'] },
  { id: 'design-recommend', label: 'Design recommender', agent: 'design-recommender', skills: ['recommend_layout', 'generate_mockup_spec'] },
  { id: 'design-review', label: 'Design reviewer', agent: 'design-reviewer', skills: ['validate_mockup', 'check_brand_compliance', 'check_readability'] },
  { id: 'images', label: 'Images', agent: 'image-agent', skills: [], future: true },
  { id: 'editor', label: 'Editor', agent: 'poster-editor', skills: [], future: true },
  { id: 'translation', label: 'Translation', agent: 'translation-agent', skills: [], future: true }
];

const STATE_LABELS = { active: 'active', accepted: 'accepted', rework: 'sent back', error: 'rejected' };
const FEED_LIMIT = 500;

// event stage name → board node id
function stageToNode(stage, agent) {
  switch (stage) {
    case 'prompt-intake': return 'prompt-intake';
    case 'keyword-intent': return 'keyword-intent';
    case 'research':
    case 'research-synthesis': return 'research';
    case 'content-loop':
      if (agent === 'content-reviewer') return 'content-review';
      return 'content-gen';
    case 'content-gen': return 'content-gen';
    case 'content-review': return 'content-review';
    case 'angle-selection':
    case 'user-approval':
    case 'inline-edit': return 'user-approval';
    case 'design-loop':
      if (agent === 'design-reviewer') return 'design-review';
      return 'design-recommend';
    case 'design-selection':
    case 'design-apply': return 'design-recommend';
    default: return null;
  }
}

// ── board construction ──────────────────────────────────────────────────────

const board = $('board');
const nodeEls = new Map();
let gateBadge = null;
let designGateBadge = null;

function buildBoard() {
  for (let i = 0; i < NODES.length; i++) {
    const n = NODES[i];
    const col = document.createElement('div');
    col.className = 'board-col';
    const node = document.createElement('div');
    node.className = `node${n.future ? ' future' : ''}`;
    node.id = `node-${n.id}`;
    const skills = n.future
      ? '<span class="skill-badge">next build phase</span>'
      : n.skills.map((s) => `<span class="skill-badge">${esc(s)}</span>`).join('');
    node.innerHTML = `
      <span class="node-state"></span>
      <span class="node-name"></span>
      <span class="node-agent"></span>
      <div class="node-skills">${skills}</div>`;
    node.querySelector('.node-name').textContent = n.label;
    node.querySelector('.node-agent').textContent = n.agent;
    col.appendChild(node);
    board.appendChild(col);
    nodeEls.set(n.id, node);

    if (i < NODES.length - 1) {
      const conn = document.createElement('div');
      if (n.id === 'content-gen') {
        // the 95 gate sits between generator and reviewer
        conn.className = 'connector gate';
        conn.innerHTML = `<span class="gate-badge" id="gateBadge">gate 95</span><span class="gate-arrows">⇄</span>`;
      } else if (n.id === 'design-recommend') {
        // the 90 gate sits between design recommender and design reviewer
        conn.className = 'connector gate';
        conn.innerHTML = `<span class="gate-badge" id="designGateBadge">gate 90</span><span class="gate-arrows">⇄</span>`;
      } else {
        conn.className = 'connector';
        conn.textContent = '→';
      }
      board.appendChild(conn);
    }
  }
  gateBadge = $('gateBadge');
  designGateBadge = $('designGateBadge');
}
buildBoard();

function resetBoard() {
  for (const el of nodeEls.values()) {
    el.classList.remove('active', 'accepted', 'rework', 'error');
    el.querySelector('.node-state').textContent = '';
  }
  gateBadge.className = 'gate-badge';
  gateBadge.textContent = 'gate 95';
  designGateBadge.className = 'gate-badge';
  designGateBadge.textContent = 'gate 90';
}

function setNodeState(nodeId, state) {
  const el = nodeEls.get(nodeId);
  if (!el) return;
  el.classList.remove('active', 'accepted', 'rework', 'error');
  el.classList.add(state);
  el.querySelector('.node-state').textContent = STATE_LABELS[state] || state;
}

// ── arrow overlay (hand-offs + sent-back) ───────────────────────────────────

const arrowLayer = $('arrowLayer');
const SVG_NS = 'http://www.w3.org/2000/svg';

function flashArrow(fromId, toId, text, kind) {
  const from = nodeEls.get(fromId);
  const to = nodeEls.get(toId);
  if (!from || !to) return;
  const b = board.getBoundingClientRect();
  const f = from.getBoundingClientRect();
  const t = to.getBoundingClientRect();
  const y = Math.min(f.top, t.top) - b.top - 8;
  const x1 = f.left - b.left + f.width / 2;
  const x2 = t.left - b.left + t.width / 2;

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', `arrow-flash ${kind}`);
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', x1); line.setAttribute('y1', y);
  line.setAttribute('x2', x2); line.setAttribute('y2', y);
  g.appendChild(line);
  if (text) {
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', Math.min(x1, x2) + Math.abs(x2 - x1) / 2);
    label.setAttribute('y', y - 6);
    label.setAttribute('text-anchor', 'middle');
    label.textContent = text.length > 70 ? `${text.slice(0, 67)}…` : text;
    g.appendChild(label);
  }
  arrowLayer.appendChild(g);
  setTimeout(() => g.remove(), 2500);
}

// ── event feed ──────────────────────────────────────────────────────────────

const feed = $('feed');
let feedCount = 0;

function shortTime(ts) {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleTimeString();
}

function appendFeedItem(evt) {
  const li = document.createElement('li');
  li.className = `type-${evt.type}`;
  const line = document.createElement('div');
  line.className = 'feed-line';
  line.innerHTML = `
    <span class="feed-ts"></span>
    <span class="feed-agent"></span>
    <span class="feed-type"></span>
    <span class="feed-stage"></span>`;
  line.querySelector('.feed-ts').textContent = shortTime(evt.ts);
  line.querySelector('.feed-agent').textContent = evt.agent;
  line.querySelector('.feed-type').textContent = evt.type;
  line.querySelector('.feed-stage').textContent = evt.stage;
  li.appendChild(line);

  const detail = document.createElement('div');
  detail.className = 'feed-detail';
  if (evt.type === 'rework' && evt.payload?.routedFeedback) {
    const fb = document.createElement('div');
    fb.className = 'feed-feedback';
    fb.textContent = `Routed feedback: ${evt.payload.routedFeedback}`;
    detail.appendChild(fb);
  }
  // spec §B.9 "each agent's output shown": prompt heads are masked upstream
  // by the egress before they ever reach the event bus (safe by design).
  if (evt.type === 'agent_output' && typeof evt.payload?.maskedPromptHead === 'string') {
    const section = document.createElement('div');
    section.className = 'feed-prompt';
    const label = document.createElement('div');
    label.className = 'feed-label';
    label.textContent = 'masked prompt (first 400 chars)';
    const head = document.createElement('pre');
    head.textContent = evt.payload.maskedPromptHead;
    section.append(label, head);
    detail.appendChild(section);
  }
  if ((evt.type === 'review_verdict' || evt.type === 'gate_check') && evt.verdict) {
    const verdictBox = document.createElement('div');
    verdictBox.className = 'feed-verdict';
    for (const [field, value] of [
      ['score', evt.verdict.score],
      ['status', evt.verdict.status],
      ['feedback', evt.verdict.feedback],
      ['expected', evt.verdict.expected]
    ]) {
      if (value === undefined || value === null || value === '') continue;
      const row = document.createElement('div');
      const key = document.createElement('span');
      key.className = 'feed-label';
      key.textContent = `${field}: `;
      const val = document.createElement('span');
      val.textContent = String(value);
      row.append(key, val);
      verdictBox.appendChild(row);
    }
    detail.appendChild(verdictBox);
  } else if (evt.verdict) {
    const v = document.createElement('pre');
    v.textContent = `verdict: ${JSON.stringify(evt.verdict, null, 2)}`;
    detail.appendChild(v);
  }
  const p = document.createElement('pre');
  p.textContent = `payload: ${JSON.stringify(evt.payload ?? {}, null, 2)}`;
  detail.appendChild(p);
  li.appendChild(detail);
  li.addEventListener('click', () => li.classList.toggle('open'));

  const nearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 60;
  feed.appendChild(li);
  while (feed.children.length > FEED_LIMIT) feed.firstChild.remove();
  if (nearBottom) feed.scrollTop = feed.scrollHeight;

  feedCount += 1;
  $('feedCount').textContent = `${feedCount} events`;
  $('feedEmpty').classList.add('hidden');
}

function resetFeed() {
  feed.innerHTML = '';
  feedCount = 0;
  $('feedCount').textContent = '0 events';
  $('feedEmpty').classList.remove('hidden');
}

// ── event reducer: node states, gate badge, arrows ──────────────────────────

function applyEvent(evt, { live }) {
  appendFeedItem(evt);
  const nodeId = stageToNode(evt.stage, evt.agent);

  switch (evt.type) {
    case 'stage_start':
    case 'agent_output':
      if (nodeId) setNodeState(nodeId, 'active');
      break;
    case 'stage_end':
      if (evt.stage === 'content-loop') {
        setNodeState('content-gen', 'accepted');
        setNodeState('content-review', 'accepted');
      } else if (evt.stage === 'design-loop') {
        setNodeState('design-recommend', 'accepted');
        setNodeState('design-review', 'accepted');
      } else if (nodeId) {
        setNodeState(nodeId, 'accepted');
      }
      break;
    case 'review_verdict':
      if (evt.verdict) setNodeState('content-review', evt.verdict.status === 'accepted' ? 'accepted' : 'rework');
      break;
    case 'gate_check':
      if (evt.verdict) {
        const pass = evt.verdict.status === 'accepted';
        const design = evt.payload?.gateName === 'designQuality';
        const badge = design ? designGateBadge : gateBadge;
        const threshold = evt.payload?.threshold ?? (design ? 90 : 95);
        badge.textContent = `${evt.verdict.score} / ${threshold}`;
        badge.className = `gate-badge ${pass ? 'pass' : 'fail'}`;
        setNodeState(design ? 'design-review' : 'content-review', pass ? 'accepted' : 'rework');
      }
      break;
    case 'rework': {
      const design = evt.stage === 'design-loop';
      const genNode = design ? 'design-recommend' : 'content-gen';
      setNodeState(genNode, 'rework');
      if (live) flashArrow(design ? 'design-review' : 'content-review', genNode, evt.payload?.routedFeedback || 'sent back for rework', 'sent-back');
      break;
    }
    case 'handoff': {
      const [fromStage, toStage] = evt.stage.split('→').map((s) => s.trim());
      const fromNode = stageToNode(fromStage, evt.agent);
      const toNode = stageToNode(toStage, evt.payload?.toAgent);
      if (fromNode) setNodeState(fromNode, 'accepted');
      if (toNode) setNodeState(toNode, 'active');
      if (live && fromNode && toNode) flashArrow(fromNode, toNode, evt.payload?.summary || '', 'handoff');
      break;
    }
    case 'user_action':
      setNodeState('user-approval', 'accepted');
      break;
    case 'error':
      if (nodeId) setNodeState(nodeId, 'error');
      if (evt.stage === 'content-loop') setNodeState('content-review', 'error');
      if (evt.stage === 'design-loop') setNodeState('design-review', 'error');
      break;
    case 'override':
      if (evt.payload?.action === 'pause') setRunStatus('paused');
      if (evt.payload?.action === 'resume') setRunStatus('running');
      // a forced modification_required sends the target stage back for rework
      // (amber), mirroring what a reviewer-issued rework does on the board
      if (evt.payload?.action === 'override' && evt.payload?.decision === 'modification_required' && nodeId) {
        setNodeState(nodeId, 'rework');
      }
      if (live) refreshOverrideState();
      break;
  }
}

// ── api helper ──────────────────────────────────────────────────────────────

async function api(path, options = null) {
  let res;
  try {
    res = await fetch(path, window.authOptions(options));
  } catch {
    throw new Error('server unreachable');
  }
  if (res.status === 401) {
    $('authBanner').classList.remove('hidden');
    throw new Error('not authorized — open the tokenized URL first');
  }
  if (!res.ok) {
    let code = `HTTP ${res.status}`;
    try { code = (await res.json()).error || code; } catch { /* non-JSON error body */ }
    throw new Error(code);
  }
  return res.json();
}

function postJson(path, body) {
  return api(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

// SQLite event mirror rows are snake_case with JSON-string payloads — the
// live SSE events are already camelCase. Normalize both to the event shape.
function rowToEvent(r) {
  if (r.eventId) return r;
  let payload = {};
  try { payload = JSON.parse(r.payload || '{}'); } catch { /* keep {} */ }
  return {
    eventId: r.event_id, ts: r.ts, runId: r.run_id, project: r.project,
    pipeline: r.pipeline, stage: r.stage, agent: r.agent, skill: r.skill || '',
    type: r.type, payload,
    verdict: r.verdict_status == null ? null : {
      status: r.verdict_status,
      score: r.verdict_score,
      ...(r.verdict_feedback ? { feedback: r.verdict_feedback } : {}),
      ...(r.verdict_expected ? { expected: r.verdict_expected } : {})
    },
    parentEventId: r.parent_event_id ?? null
  };
}

// ── run picker ──────────────────────────────────────────────────────────────

let selectedRunId = null;
const knownRuns = new Set();

function addRunOption(runId, meta = null, { front = false } = {}) {
  if (knownRuns.has(runId)) return;
  knownRuns.add(runId);
  const opt = document.createElement('option');
  opt.value = runId;
  opt.textContent = meta
    ? `${runId} · ${meta.eventCount} events · ${shortTime(meta.lastTs)}`
    : runId;
  const picker = $('runPicker');
  if (picker.options.length === 1 && picker.options[0].value === '') picker.innerHTML = '';
  if (front && picker.firstChild) picker.insertBefore(opt, picker.firstChild);
  else picker.appendChild(opt);
}

async function selectRun(runId) {
  selectedRunId = runId;
  $('runPicker').value = runId;
  resetBoard();
  resetFeed();
  try {
    const { events } = await api(`/api/events/${encodeURIComponent(runId)}`);
    for (const row of events) applyEvent(rowToEvent(row), { live: false });
  } catch (err) {
    flash($('consoleStatus'), `Cannot load run history: ${err.message}`, false);
  }
  feed.scrollTop = feed.scrollHeight;
  await refreshOverrideState();
}

$('runPicker').addEventListener('change', () => {
  if ($('runPicker').value) selectRun($('runPicker').value);
});

async function loadRuns() {
  try {
    const { runs } = await api('/api/events/runs');
    for (const r of runs) addRunOption(r.runId, r);
    if (runs.length && !selectedRunId) await selectRun(runs[0].runId); // newest first
  } catch { /* 401 banner already shown; picker stays empty */ }
}

// ── override console ────────────────────────────────────────────────────────

function flash(el, message, ok = true) {
  el.textContent = message;
  el.className = `status ${ok ? 'ok' : 'err'}`;
  if (ok) setTimeout(() => { el.textContent = ''; }, 5000);
}

function setRunStatus(status) {
  const chip = $('runStatus');
  chip.textContent = status;
  chip.className = `chip run-${status}`;
}

for (const nodeId of ['keyword-intent', 'research', 'content-loop', 'content-review', 'user-approval', 'design-loop']) {
  const opt = document.createElement('option');
  opt.value = nodeId;
  opt.textContent = nodeId;
  $('decisionStage').appendChild(opt);
}

async function refreshOverrideState() {
  if (!selectedRunId) return;
  try {
    const state = await api(`/api/override/${encodeURIComponent(selectedRunId)}/state`);
    setRunStatus(state.status);
    const picker = $('checkpointPicker');
    picker.innerHTML = '';
    if (!state.checkpoints.length) {
      picker.innerHTML = '<option value="">none</option>';
    } else {
      state.checkpoints.forEach((cp, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = `${i}: ${cp.label} (${shortTime(cp.ts)})`;
        picker.appendChild(opt);
      });
      picker.value = String(state.checkpoints.length - 1);
    }
  } catch (err) {
    flash($('consoleStatus'), err.message, false);
  }
}

function requireRunAndReason({ needReason = true } = {}) {
  if (!selectedRunId) {
    flash($('consoleStatus'), 'Select a run first.', false);
    return null;
  }
  const reason = $('opReason').value.trim();
  if (needReason && !reason) {
    flash($('consoleStatus'), 'A reason is required — overrides are audited.', false);
    return null;
  }
  return { runId: selectedRunId, reason };
}

$('pauseBtn').addEventListener('click', async () => {
  const args = requireRunAndReason();
  if (!args) return;
  try {
    await postJson(`/api/override/${encodeURIComponent(args.runId)}/pause`, { reason: args.reason });
    flash($('consoleStatus'), 'Run paused — hand-offs and quality loops are blocked.');
    await refreshOverrideState();
  } catch (err) { flash($('consoleStatus'), err.message, false); }
});

$('resumeBtn').addEventListener('click', async () => {
  const args = requireRunAndReason({ needReason: false });
  if (!args) return;
  try {
    await postJson(`/api/override/${encodeURIComponent(args.runId)}/resume`, args.reason ? { reason: args.reason } : {});
    flash($('consoleStatus'), 'Run resumed.');
    await refreshOverrideState();
  } catch (err) { flash($('consoleStatus'), err.message, false); }
});

$('decisionBtn').addEventListener('click', async () => {
  const args = requireRunAndReason();
  if (!args) return;
  try {
    await postJson(`/api/override/${encodeURIComponent(args.runId)}/decision`, {
      pipeline: 'content',
      stage: $('decisionStage').value,
      decision: $('decisionValue').value,
      reason: args.reason,
      operator: 'pipeline-ui'
    });
    flash($('consoleStatus'), `Forced "${$('decisionValue').value}" at ${$('decisionStage').value}.`);
    await refreshOverrideState();
  } catch (err) { flash($('consoleStatus'), err.message, false); }
});

$('rollbackBtn').addEventListener('click', async () => {
  const args = requireRunAndReason();
  if (!args) return;
  const idx = $('checkpointPicker').value;
  if (idx === '') { flash($('consoleStatus'), 'This run has no checkpoints to roll back to.', false); return; }
  try {
    const result = await postJson(`/api/override/${encodeURIComponent(args.runId)}/rollback`, {
      checkpointIndex: Number(idx), reason: args.reason
    });
    flash($('consoleStatus'), `Rolled back to checkpoint "${result.restored}".`);
    await refreshOverrideState();
  } catch (err) { flash($('consoleStatus'), err.message, false); }
});

// ── live stream ─────────────────────────────────────────────────────────────

window.connectPipelineStream({
  onEvent: (evt) => {
    if (!knownRuns.has(evt.runId)) {
      addRunOption(evt.runId, null, { front: true });
      if (!selectedRunId) { selectRun(evt.runId); return; } // replay includes this event
    }
    if (evt.runId === selectedRunId) applyEvent(evt, { live: true });
  },
  onStatus: (status) => {
    // the stream stops retrying on 401 — surface the auth banner immediately
    if (status === 'unauthorized') $('authBanner').classList.remove('hidden');
    const chip = $('streamStatus');
    chip.textContent = status === 'live' ? 'stream: live' : `stream: ${status}`;
    chip.className = `chip ${status === 'live' ? 'stream-on' : 'stream-off'}`;
  }
});

loadRuns();
