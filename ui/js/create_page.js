// Unified 3-panel metro create page (Phase O1 + O2 preview engine). One
// vertical line of ten stations replaces the old step-card flow; the LEFT
// rail is a live, station-grouped pipeline activity feed (SSE), the RIGHT
// rail is the live dual-orientation preview driven by js/preview_engine.js
// (PosterState store — this file only pushes state into it). Every server
// interaction of the old flow is preserved.
//
// ── ENDPOINT-CALL INVENTORY (for orchestrator diff vs. the old file) ────────
// Carried over from the old create_page.js (unchanged semantics):
//   POST /api/pipeline/start                       (now also sends templateId — backend ignores it until O4)
//   GET  /api/pipeline/templates                   (v2 gallery, poster-independent — station 2; doubles
//                                                   as the auth probe at page load)
//   GET  /api/posters/suggestions?topic=…          (angle suggestions strip)
//   POST /api/pipeline/:posterId/angles
//   POST /api/pipeline/:posterId/approve
//   POST /api/pipeline/:posterId/regenerate
//   POST /api/pipeline/:posterId/feedback          (content-loop user feedback)
//   POST /api/pipeline/:posterId/edit
//   GET  /api/design/templates?posterId=…          (v1 template gallery — station 5 via the real posterId)
//   POST /api/design/:posterId/apply
//   POST /api/design/:posterId/dynamic
//   POST /api/design/:posterId/retry
//   GET  /api/images[?topics=…]                    (library picker modal)
//   GET  /api/images/file/:imageId                 (img src in picker)
//   POST /api/images/slot/:posterId/:slotId
//   GET  /api/events/stream                        (SSE via js/stream.js)
// Dropped in O2: GET /api/posters at boot (only existed to borrow a posterId
// for the pre-start gallery — the v2 gallery endpoint needs no poster).
// New in this page (ported from editor_page.js — Save + Translate stations):
//   POST /api/posters/:posterId/save               (save-as with name)
//   POST /api/posters/:posterId/feedback           (good/bad poster rating)
//   GET  /api/translation/meta/languages
//   GET  /api/translation/:posterId                (safe translation state)
//   POST /api/translation/:posterId/start
// New in this wave (O5 retry card / O6 reroute / O8 transparency rail):
//   POST /api/images/slot/:posterId/:slotId        (now also sends customPrompt on retry — O5)
//   POST /api/pipeline/:posterId/reroute/suggest   (O6 — {feedback} → suggestion + checkpoints)
//   POST /api/pipeline/:posterId/reroute/execute   (O6 — {feedback, checkpoint, adjustments})
//   GET  /api/egress/:runId                        (O8 — run-scoped call list, metadata only)
//   GET  /api/egress/detail/:id                    (O8 — one full row, masked bodies)
// New in this wave (O10 — refine mount + export station wiring):
//   GET  /api/design/:posterId                     (fresh design state: export canvases + landscape probe;
//                                                   EditorInline fetches it too when the Refine station mounts)
//   GET  /api/translation/:posterId/:lang          (per-language variant canvas for non-en exports)
// Nothing from the old file was dropped.
// ────────────────────────────────────────────────────────────────────────────
//
// XSS discipline: everything user/model-derived renders via textContent. The
// ONLY innerHTML sinks are (a) the server-generated template preview SVGs
// (palette-resolved geometry from our own template modules, no user text) and
// (b) ProgressStrip badges, where every interpolated value passes esc().

const $ = (id) => document.getElementById(id);

// HTML-escape for the few innerHTML template paths (everything else uses
// textContent). ANY value interpolated into an innerHTML string goes through
// here first.
function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// SSE event payloads carry numbers by contract (scores, thresholds, attempt
// counters) — coerce and reject anything non-finite before it can be shown.
function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const SAMPLE_PROMPTS = [
  'Phishing red flags: teach employees the warning signs of a phishing email — urgent language, mismatched sender domains, unexpected attachments — and remind them that IT will never ask for their password.',
  'USB and removable media dos and don\'ts: never plug in a USB stick found in the parking lot or handed out at an event; report found media to the SOC instead of checking "what\'s on it".',
  'Strong passphrases and MFA: get employees to move from short passwords to long passphrases, switch on multi-factor authentication everywhere, and treat an MFA prompt they did not trigger as an incident to report.',
  'Tailgating scenario: someone in a delivery uniform asks an employee to hold the badge-locked door open. Show the polite way to refuse, direct them to reception, and report the attempt.'
];

const STAGE_LABELS = {
  'keyword-intent': 'Keyword & intent',
  'research': 'Research',
  'content-loop': 'Content ⇄ Review'
};

const DESIGN_STAGE_LABELS = {
  'design-apply': 'Template compile',
  'design-loop': 'Design ⇄ Review'
};

// ── api helper ──────────────────────────────────────────────────────────────

const ERROR_MESSAGES = {
  POSTER_BUSY: 'Pipeline already running for this poster — wait for it to finish.',
  WRONG_PHASE: 'This poster moved on — reload the page to see its current phase.',
  GATE_EXHAUSTED: 'The reviewer could not accept a draft after the maximum rework loops. Try a more specific prompt.',
  UNKNOWN_TEMPLATE: 'That template does not exist — reload the page and pick again.',
  DESIGN_SPEC_INVALID: 'The design agent could not produce a valid layout — try again or add instructions.',
  INVALID_NAME: 'Name must be between 1 and 120 characters.',
  INVALID_FEEDBACK: 'Invalid rating — use "good" or "bad".',
  INVALID_LANGUAGE: 'Unknown language — reload the page and try again.',
  TRANSLATION_NOT_FOUND: 'That language has no translation yet — run Translate first.',
  IMAGE_RETRIES_EXHAUSTED: 'Image generation failed 5 times in a row — adjust the prompt in the slot card below and try again.',
  REROUTE_INVALID: 'The reroute agent could not turn that feedback into a valid route — rephrase it and try again.',
  INVALID_CHECKPOINT: 'That is not a reroutable checkpoint — pick one from the override list.',
  CHECKPOINT_NOT_FOUND: 'This run never reached that checkpoint — pick another from the override list.',
  CHECKPOINT_MISMATCH: 'The checkpoint snapshot belongs to a different poster — reload the page.',
  INVALID_ADJUSTMENTS: 'The suggestion carried no adjustments — ask for a new suggestion.',
  NETWORK: 'Server unreachable — is the poster app running?'
};

async function api(path, options = null) {
  let res;
  try {
    res = await fetch(path, window.authOptions(options));
  } catch {
    const err = new Error(ERROR_MESSAGES.NETWORK);
    err.code = 'NETWORK';
    throw err;
  }
  if (res.status === 401) {
    $('authBanner').classList.remove('hidden');
    const err = new Error('Not authorized — open the tokenized URL first (see banner).');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (!res.ok) {
    let code = `HTTP ${res.status}`;
    let body = null;
    try {
      body = await res.json();
      code = body.error || code;
    } catch { /* non-JSON error body */ }
    const err = new Error(ERROR_MESSAGES[code] || `Request failed: ${code}`);
    err.code = code;
    err.body = body; // structured error payloads (e.g. 409 {attempts, lastReason})
    throw err;
  }
  return res.json();
}

function postJson(path, body) {
  return api(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

function flash(el, message, ok = true) {
  el.textContent = message;
  el.className = `status ${ok ? 'ok' : 'err'}`;
  if (ok) setTimeout(() => { if (el.textContent === message) el.textContent = ''; }, 5000);
}

// ── live progress strip ─────────────────────────────────────────────────────

/** Renders pipeline events into stage badges + rework/score chips. */
class ProgressStrip {
  constructor(el, labels = STAGE_LABELS) {
    this.el = el;
    this.labels = labels;
    this.reset();
  }
  reset() {
    this.stages = new Map(); // stageKey -> idle|active|done|rework|error
    this.attempt = 0;
    this.reworks = 0;
    this.scores = [];
    this.render();
  }
  show() { this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); }
  stageKey(stage) {
    if (stage === 'research-synthesis' && this.labels.research) return 'research';
    return this.labels[stage] ? stage : null;
  }
  apply(evt) {
    const key = this.stageKey(evt.stage);
    switch (evt.type) {
      case 'stage_start': {
        if (key) this.stages.set(key, 'active');
        const attempt = safeNumber(evt.payload?.attempt);
        if ((key === 'content-loop' || key === 'design-loop') && attempt) this.attempt = attempt;
        break;
      }
      case 'stage_end':
        if (key) this.stages.set(key, 'done');
        break;
      case 'rework':
        this.reworks += 1;
        if (key) this.stages.set(key, 'rework');
        break;
      case 'gate_check':
        if (evt.verdict) {
          const score = safeNumber(evt.verdict.score);
          if (score !== null) {
            this.scores.push({
              score,
              pass: evt.verdict.status === 'accepted',
              threshold: safeNumber(evt.payload?.threshold)
            });
          }
        }
        break;
      case 'error':
        if (key) this.stages.set(key, 'error');
        break;
    }
    this.render();
  }
  render() {
    // attempt/reworks/score/threshold are Number-coerced in apply(); esc()
    // guards every interpolation regardless (defence in depth against XSS).
    const parts = [];
    for (const [key, label] of Object.entries(this.labels)) {
      const state = this.stages.get(key) || 'idle';
      parts.push(`<span class="stage-badge ${esc(state)}">${esc(label)}</span>`);
    }
    if (this.attempt) parts.push(`<span class="stage-badge active">attempt ${esc(this.attempt)}</span>`);
    if (this.reworks) parts.push(`<span class="stage-badge rework">sent back ×${esc(this.reworks)}</span>`);
    for (const s of this.scores) {
      parts.push(`<span class="score-chip ${s.pass ? 'pass' : 'fail'}">${esc(s.score)}${s.threshold ? ` / ${esc(s.threshold)}` : ''}</span>`);
    }
    this.el.innerHTML = parts.join('');
  }
}

// ── metro station machinery ─────────────────────────────────────────────────

const STATION_IDS = ['prompt', 'template', 'research', 'content', 'design', 'images', 'refine', 'save', 'translate', 'export'];
const STATION_LABELS = {
  prompt: 'Prompt', template: 'Template', research: 'Research',
  content: 'Content ⇄ Review', design: 'Design compile', images: 'Images',
  refine: 'Refine', save: 'Save', translate: 'Translate', export: 'Export'
};
const STATION_STATE_TEXT = { pending: '', active: 'in progress', done: 'done', rework: 'rework' };

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const stationEl = (id) => $(`st-${id}`);

function setStationState(id, state) {
  const li = stationEl(id);
  if (!li) return;
  li.dataset.state = state;
  li.querySelector('.station-state-label').textContent = STATION_STATE_TEXT[state] ?? state;
  // a11y: mark the active station as the current step of the flow
  if (state === 'active') li.setAttribute('aria-current', 'step');
  else li.removeAttribute('aria-current');
  // T6 Enhancement 4: topbar dot — mirror body.run-active when any station is
  // active (fallback for browsers without :has() support; attribute-mirror only).
  document.body.classList.toggle(
    'run-active',
    Boolean($('metroLine').querySelector('[data-state="active"]'))
  );
}

function openStation(id, open = true) {
  stationEl(id).classList.toggle('open', open);
  stationEl(id).querySelector('.station-head').setAttribute('aria-expanded', String(open));
}

function scrollToStation(id) {
  stationEl(id).scrollIntoView({
    behavior: reducedMotion.matches ? 'auto' : 'smooth',
    block: 'start'
  });
}

/** Mark a station active, expand its card and auto-scroll to it. */
function activateStation(id, { scroll = true } = {}) {
  setStationState(id, 'active');
  openStation(id, true);
  if (scroll) scrollToStation(id);
}

/** Mark a station done; by default its card collapses (reopenable by click). */
function completeStation(id, { collapse = true } = {}) {
  setStationState(id, 'done');
  if (collapse) openStation(id, false);
}

// Completed (non-pending) stations are reopenable: header click toggles the
// card. Stations whose re-mutation is unsafe render read-only lock notes and
// disabled controls instead of being un-clickable.
for (const id of STATION_IDS) {
  const li = stationEl(id);
  li.querySelector('.station-head').addEventListener('click', () => {
    if (li.dataset.state === 'pending') return;
    const open = li.classList.toggle('open');
    li.querySelector('.station-head').setAttribute('aria-expanded', String(open));
  });
}

// ── keyboard activation (a11y): the selectable/expandable cards are divs with
// role="button" + tabindex=0 — one delegated handler makes Enter/Space
// activate them like real buttons; Escape closes the library picker dialog.
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof Element &&
      e.target.matches('.angle-card, .template-card, .image-card, .feed-card')) {
    e.preventDefault();
    e.target.click();
  }
  if (e.key === 'Escape' && !$('libraryModal').classList.contains('hidden')) {
    closeLibraryModal();
  }
});

// ── rails: collapse + drawers (below 1280px) ────────────────────────────────

$('collapseLeftBtn').addEventListener('click', () => {
  const collapsed = document.body.classList.toggle('left-collapsed');
  $('collapseLeftBtn').textContent = collapsed ? '⟩' : '⟨';
  $('collapseLeftBtn').title = collapsed ? 'Expand activity rail' : 'Collapse activity rail';
  $('collapseLeftBtn').setAttribute('aria-label', collapsed ? 'Expand activity rail' : 'Collapse activity rail');
  $('collapseLeftBtn').setAttribute('aria-expanded', String(!collapsed));
});

function closeDrawers() {
  $('railLeft').classList.remove('drawer-open');
  $('railRight').classList.remove('drawer-open');
  $('drawerBackdrop').classList.add('hidden');
  $('drawerLeftBtn').setAttribute('aria-expanded', 'false');
  $('drawerRightBtn').setAttribute('aria-expanded', 'false');
}

function toggleDrawer(railId) {
  const rail = $(railId);
  const other = railId === 'railLeft' ? $('railRight') : $('railLeft');
  other.classList.remove('drawer-open');
  const open = rail.classList.toggle('drawer-open');
  $('drawerBackdrop').classList.toggle('hidden', !open);
  $('drawerLeftBtn').setAttribute('aria-expanded', String(railId === 'railLeft' && open));
  $('drawerRightBtn').setAttribute('aria-expanded', String(railId === 'railRight' && open));
}

$('drawerLeftBtn').addEventListener('click', () => toggleDrawer('railLeft'));
$('drawerRightBtn').addEventListener('click', () => toggleDrawer('railRight'));
$('drawerBackdrop').addEventListener('click', closeDrawers);

// ── right rail: live preview (O2 engine — js/preview_engine.js) ─────────────

window.PreviewEngine.initPreview({
  portraitEl: $('previewPortrait'),
  landscapeEl: $('previewLandscape')
});

// T6 Enhancement 2: canvas entrance animation — add .canvas-entered the first
// time each canvas loses its .hidden class (attribute mirror via MutationObserver;
// no control flow — observer only toggles one class attribute).
(function attachCanvasEntranceObserver() {
  const observe = (canvasEl) => {
    let wasHidden = canvasEl.classList.contains('hidden');
    new MutationObserver(() => {
      const nowHidden = canvasEl.classList.contains('hidden');
      if (wasHidden && !nowHidden) {
        // first time the canvas becomes visible — trigger entrance animation
        canvasEl.classList.remove('canvas-entered');
        // reflow forces the animation to restart
        void canvasEl.offsetWidth;
        canvasEl.classList.add('canvas-entered');
      }
      wasHidden = nowHidden;
    }).observe(canvasEl, { attributes: true, attributeFilter: ['class'] });
  };
  observe($('previewPortrait'));
  observe($('previewLandscape'));
}());
// the PosterState store: every server response / local edit below pushes into
// it; the engine renders both orientations debounced (60ms), no round-trips
const preview = window.PreviewEngine.state;

// Orientation tab control (portrait | landscape | both) — the engine toggles
// the frames and re-scales; this handler only keeps the tab highlight.
for (const btn of $('orientTabs').querySelectorAll('button')) {
  btn.addEventListener('click', () => {
    for (const b of $('orientTabs').querySelectorAll('button')) {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-pressed', String(b === btn));
    }
    window.PreviewEngine.setOrientationVisibility(btn.dataset.orient);
    // keep the export orientation in step with what's on screen — exporting
    // "portrait" while looking at the landscape preview was a top confusion
    if (btn.dataset.orient !== 'both') {
      const sel = document.getElementById('exportOrientation');
      if (sel) sel.value = btn.dataset.orient;
    }
  });
}

// ── left rail: pipeline activity feed ───────────────────────────────────────

const FEED_CARD_LIMIT = 300;
let feedGroupKey = null;
let feedEventCount = 0;

/** Map a pipeline event to its metro station (for grouping + state flair). */
function stationForEvent(evt) {
  if (evt.pipeline === 'image') return 'images';
  if (evt.pipeline === 'translation') return 'translate';
  if (evt.pipeline === 'editor') return 'refine';
  if (evt.pipeline === 'design') return 'design';
  switch (evt.stage) {
    case 'keyword-intent':
    case 'research':
    case 'research-synthesis':
    case 'angle-selection': return 'research';
    case 'content-loop':
    case 'content-gen':
    case 'content-review':
    case 'user-approval':
    case 'inline-edit':
    case 'edit-learning': return 'content';
    case 'design-loop':
    case 'design-apply':
    case 'design-selection': return 'design';
    case 'save':
    case 'rename':
    case 'learning-memory': return 'save';
    default: return null;
  }
}

function shortTime(ts) {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? String(ts ?? '') : d.toLocaleTimeString();
}

function appendFeedCard(evt) {
  const feed = $('activityFeed');
  const body = $('activityBody');
  const stId = stationForEvent(evt);
  const groupKey = stId || String(evt.pipeline || 'run');

  if (groupKey !== feedGroupKey) {
    const head = document.createElement('div');
    head.className = 'feed-group';
    head.textContent = stId ? STATION_LABELS[stId] : groupKey;
    feed.appendChild(head);
    applyFeedFilterToNode(head);
    feedGroupKey = groupKey;
  }

  const card = document.createElement('div');
  // evt.type comes from our own bus, but sanitize before using it as a class
  card.className = `feed-card type-${String(evt.type).replace(/[^a-z0-9_-]/gi, '')}`;
  // a11y: cards are click-to-expand — keyboard-activatable via the shared
  // delegated Enter/Space handler (see "keyboard activation" block below)
  card.setAttribute('role', 'button');
  card.tabIndex = 0;
  card.setAttribute('aria-expanded', 'false');
  // filter index for the rail search box (O8) — matched lowercased, textContent-safe
  card.dataset.filter = [evt.agent, evt.skill, evt.stage, evt.type, evt.payload?.model]
    .filter((v) => typeof v === 'string').join(' ').toLowerCase();

  const line = document.createElement('div');
  line.className = 'fc-line';
  const ts = document.createElement('span');
  ts.className = 'fc-ts';
  ts.textContent = shortTime(evt.ts);
  const agent = document.createElement('span');
  agent.className = 'fc-agent';
  agent.textContent = evt.agent || '';
  const type = document.createElement('span');
  type.className = 'fc-type';
  type.textContent = evt.type || '';
  line.append(ts, agent, type);
  card.appendChild(line);

  // agent_output cards: agent/skill/model summary + prompt-detail hook that
  // lazy-fetches the masked egress-log entry on first expand (O8).
  if (evt.type === 'agent_output') {
    const meta = document.createElement('div');
    meta.className = 'fc-meta';
    const skill = document.createElement('strong');
    skill.textContent = evt.skill || 'output';
    meta.appendChild(skill);
    if (typeof evt.payload?.model === 'string') {
      meta.appendChild(document.createTextNode(` · ${evt.payload.model}`));
    }
    card.appendChild(meta);

    const egressId = (evt.payload?.egressLogId !== undefined && evt.payload?.egressLogId !== null)
      ? String(evt.payload.egressLogId) : null;
    card.appendChild(buildEgressHook(egressId));

    if (typeof evt.payload?.maskedPromptHead === 'string') {
      const head = document.createElement('pre');
      head.textContent = evt.payload.maskedPromptHead;
      card.appendChild(head);
    }
  }

  if (evt.type === 'rework' && evt.payload?.routedFeedback) {
    const note = document.createElement('div');
    note.className = 'fc-note';
    note.textContent = `Routed feedback: ${evt.payload.routedFeedback}`;
    card.appendChild(note);
  }

  if ((evt.type === 'gate_check' || evt.type === 'review_verdict') && evt.verdict) {
    const v = document.createElement('div');
    v.className = 'fc-verdict';
    const score = document.createElement('span');
    score.className = evt.verdict.status === 'accepted' ? 'pass' : 'fail';
    const scoreNum = safeNumber(evt.verdict.score);
    const threshold = safeNumber(evt.payload?.threshold);
    score.textContent = `${scoreNum ?? '—'}${threshold ? ` / ${threshold}` : ''} ${evt.verdict.status === 'accepted' ? '✓' : '↩'}`;
    v.appendChild(score);
    if (evt.verdict.feedback) {
      v.appendChild(document.createTextNode(` ${String(evt.verdict.feedback).slice(0, 200)}`));
    }
    card.appendChild(v);
  }

  // click-to-expand raw payload (textContent-only JSON dump)
  const detail = document.createElement('div');
  detail.className = 'fc-detail';
  const pre = document.createElement('pre');
  pre.textContent = `stage: ${evt.stage || ''}\npayload: ${JSON.stringify(evt.payload ?? {}, null, 2)}`;
  detail.appendChild(pre);
  card.appendChild(detail);
  card.addEventListener('click', () => {
    card.setAttribute('aria-expanded', String(card.classList.toggle('open')));
  });

  const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
  feed.appendChild(card);
  applyFeedFilterToNode(card);
  while (feed.children.length > FEED_CARD_LIMIT) feed.firstChild.remove();
  if (nearBottom) body.scrollTop = body.scrollHeight;

  feedEventCount += 1;
  $('activityCount').textContent = `${feedEventCount} events`;
  $('activityEmpty').classList.add('hidden');
}

// ── left rail: prompt transparency (Phase O8, masked-only) ──────────────────
//
// SECURITY: every string that reaches the DOM here is server-masked, but it
// is still rendered exclusively via textContent — no innerHTML, ever.

const EGRESS_SECTION_LIMIT = 20 * 1024; // >20KB sections truncate with [show more]
const MASK_LEGEND = '{{SOC_EMAIL}}-style placeholders are your org values, masked before leaving the machine.';

// egress-log ids that already have a card in the rail (SSE hooks + backfill) —
// the "Load full prompt chain" backfill skips these.
const seenEgressIds = new Set();

/**
 * Collapsed "Prompt detail" hook. With an egressId the first expand
 * lazy-fetches GET /api/egress/detail/:id exactly once and renders the
 * structured masked sections in place of the note.
 */
function buildEgressHook(egressId) {
  const hook = document.createElement('details');
  hook.className = 'egress-hook';
  const summary = document.createElement('summary');
  summary.textContent = 'Prompt detail';
  const note = document.createElement('p');
  hook.append(summary, note);
  // stop the card's expand toggle from firing when the hook is clicked
  hook.addEventListener('click', (e) => e.stopPropagation());
  if (egressId) {
    hook.dataset.egressId = egressId;
    seenEgressIds.add(egressId);
    note.textContent = 'Expand to load the full masked system prompt, prompt and response.';
    hook.addEventListener('toggle', () => {
      if (hook.open) loadEgressDetail(hook, note);
    });
  } else {
    note.textContent = 'No egress log entry is linked to this call.';
  }
  return hook;
}

/** Fetch the full masked row once and render it into the hook. */
async function loadEgressDetail(hook, note) {
  if (hook.dataset.loaded || hook.dataset.loading) return;
  hook.dataset.loading = '1';
  note.textContent = 'Loading masked prompt detail…';
  try {
    const { entry } = await api(`/api/egress/detail/${encodeURIComponent(hook.dataset.egressId)}`);
    hook.dataset.loaded = '1';
    note.remove();
    hook.appendChild(renderEgressDetail(entry));
  } catch (err) {
    note.textContent = `Could not load egress entry #${hook.dataset.egressId}: ${err.message}`;
  } finally {
    delete hook.dataset.loading;
  }
}

/** Structured masked detail: header, mask legend, three masked sections. */
function renderEgressDetail(entry) {
  const wrap = document.createElement('div');
  wrap.className = 'egress-detail';

  const head = document.createElement('div');
  head.className = 'eg-head';
  const idParts = [entry.agent, entry.skill, entry.stage].filter(Boolean).map(String);
  if (idParts.length) {
    const who = document.createElement('span');
    who.textContent = idParts.join(' · ');
    head.appendChild(who);
  }
  const model = document.createElement('span');
  model.textContent = String(entry.model || 'unknown model');
  head.appendChild(model);
  if (entry.direction) {
    const dir = document.createElement('span');
    dir.textContent = String(entry.direction);
    head.appendChild(dir);
  }
  const dur = safeNumber(entry.duration_ms);
  if (dur !== null) {
    const d = document.createElement('span');
    d.textContent = `${dur} ms`;
    head.appendChild(d);
  }
  const status = document.createElement('span');
  status.className = entry.status === 'ok' ? 'eg-status-ok' : 'eg-status-error';
  status.textContent = String(entry.status || 'unknown');
  head.appendChild(status);
  wrap.appendChild(head);

  const legend = document.createElement('p');
  legend.className = 'eg-legend';
  legend.textContent = MASK_LEGEND;
  wrap.appendChild(legend);

  addMaskedSection(wrap, 'System prompt (masked)', entry.masked_system);
  addMaskedSection(wrap, 'Prompt (masked)', entry.masked_prompt);
  addMaskedSection(wrap, 'Response (masked)', entry.masked_response);
  return wrap;
}

/** One titled masked section; >20KB renders truncated with a [show more] extender. */
function addMaskedSection(parent, title, text) {
  if (typeof text !== 'string' || !text) return;
  const h = document.createElement('h4');
  h.textContent = title;
  parent.appendChild(h);
  const pre = document.createElement('pre');
  if (text.length > EGRESS_SECTION_LIMIT) {
    pre.textContent = text.slice(0, EGRESS_SECTION_LIMIT);
    parent.appendChild(pre);
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'eg-more';
    more.textContent = `Show more (${Math.ceil((text.length - EGRESS_SECTION_LIMIT) / 1024)} KB remaining)`;
    more.addEventListener('click', (e) => {
      e.stopPropagation();
      pre.textContent = text;
      more.remove();
    });
    parent.appendChild(more);
  } else {
    pre.textContent = text;
    parent.appendChild(pre);
  }
}

/**
 * "Load full prompt chain": GET /api/egress/:runId (metadata only) and
 * backfill call cards for entries the SSE feed never carried, grouped by
 * stage. Detail bodies stay lazy — each card's hook fetches on expand.
 */
$('loadEgressChainBtn').addEventListener('click', async () => {
  const statusEl = $('egressToolsStatus');
  statusEl.className = 'rail-tools-status';
  if (!runId) {
    statusEl.classList.add('err');
    statusEl.textContent = 'No run yet — start a poster first.';
    return;
  }
  $('loadEgressChainBtn').disabled = true;
  $('loadEgressChainBtn').classList.add('is-loading');
  statusEl.textContent = 'Loading…';
  try {
    const { egressLog } = await api(`/api/egress/${encodeURIComponent(runId)}`);
    const fresh = egressLog.filter((row) => !seenEgressIds.has(String(row.id)));
    let groupStage = null;
    for (const row of fresh) {
      const stage = String(row.stage || 'run');
      if (stage !== groupStage) {
        const head = document.createElement('div');
        head.className = 'feed-group';
        head.textContent = `egress · ${stage}`;
        $('activityFeed').appendChild(head);
        applyFeedFilterToNode(head);
        groupStage = stage;
      }
      appendEgressCard(row);
    }
    // the next SSE event starts a fresh station group after the backfill block
    if (fresh.length) feedGroupKey = null;
    statusEl.textContent = `${egressLog.length} calls in this run — ${fresh.length} backfilled.`;
    if (fresh.length) $('activityEmpty').classList.add('hidden');
  } catch (err) {
    statusEl.classList.add('err');
    statusEl.textContent = err.message;
  } finally {
    $('loadEgressChainBtn').classList.remove('is-loading');
    $('loadEgressChainBtn').disabled = false;
  }
});

/** Backfilled call card (list-endpoint metadata + lazy detail hook). */
function appendEgressCard(row) {
  const id = String(row.id);
  const card = document.createElement('div');
  card.className = 'feed-card egress-card';
  card.dataset.filter = [row.agent, row.skill, row.stage, row.model, row.direction]
    .filter((v) => typeof v === 'string').join(' ').toLowerCase();

  const line = document.createElement('div');
  line.className = 'fc-line';
  const ts = document.createElement('span');
  ts.className = 'fc-ts';
  ts.textContent = shortTime(row.ts);
  const agent = document.createElement('span');
  agent.className = 'fc-agent';
  agent.textContent = row.agent || '';
  const status = document.createElement('span');
  status.className = row.status === 'ok' ? 'fc-status-ok' : 'fc-status-error';
  status.textContent = String(row.status || '');
  line.append(ts, agent, status);
  card.appendChild(line);

  const meta = document.createElement('div');
  meta.className = 'fc-meta';
  const skill = document.createElement('strong');
  skill.textContent = row.skill || row.direction || 'call';
  meta.appendChild(skill);
  const bits = [row.model];
  const dur = safeNumber(row.duration_ms);
  meta.appendChild(document.createTextNode(` · ${bits.filter(Boolean).join(' · ')}`));
  // T6 Enhancement 3: duration chip — tabular-nums pill on the call card
  // (attribute mirror: adds a span with class+textContent; no new control flow)
  if (dur !== null) {
    const durChip = document.createElement('span');
    durChip.className = 'fc-dur-chip';
    durChip.textContent = `${dur} ms`;
    line.appendChild(durChip);
  }
  card.appendChild(meta);

  card.appendChild(buildEgressHook(id));
  const feed = $('activityFeed');
  feed.appendChild(card);
  applyFeedFilterToNode(card);
  while (feed.children.length > FEED_CARD_LIMIT) feed.firstChild.remove();
}

// ── rail filter: matches visible cards by agent/skill/stage/model text ───────

let feedFilterQuery = '';

function applyFeedFilterToNode(node) {
  if (node.classList.contains('feed-group')) {
    // group headers carry no call identity — hide them while filtering
    node.classList.toggle('hidden', Boolean(feedFilterQuery));
    return;
  }
  const haystack = node.dataset.filter || node.textContent.toLowerCase();
  node.classList.toggle('hidden', Boolean(feedFilterQuery) && !haystack.includes(feedFilterQuery));
}

$('egressFilterInput').addEventListener('input', () => {
  feedFilterQuery = $('egressFilterInput').value.trim().toLowerCase();
  for (const node of $('activityFeed').children) applyFeedFilterToNode(node);
});

// ── page state ──────────────────────────────────────────────────────────────

let posterId = null;
let runId = null;
let currentState = null;      // last safe pipeline state returned by the server
let selectedAngles = new Set();
let aiDecides = false;
let editing = false;
let chosenTemplateId = null;  // station-2 pick, sent with /start (ignored until O4)
const selectedVisualMode = 'futuristic'; // fixed art-direction mode (picker removed by request)
let runStarted = false;       // locks prompt + template stations once /start succeeds
let designAccepted = false;

// While a pipeline request is in flight this filter routes SSE events into the
// given strip. Before /start returns the runId is unknown, so the start phase
// accepts any content-pipeline event (single-user local app; the stream was
// opened at page load, nothing is missed).
let liveFilter = null;
let liveStrip = null;

let watchCount = 0; // concurrent slot fills each watch; last filter wins, teardown at zero

function watchProgress(strip, filter) {
  watchCount += 1;
  liveStrip = strip;
  liveFilter = filter;
  strip.reset();
  strip.show();
  document.body.classList.add('run-busy'); // skeleton shimmer on empty states
  // pipeline theater: dim the stage and show the live agent floor (item 7)
  window.PipelineTheater?.begin();
}

function unwatchProgress() {
  watchCount = Math.max(0, watchCount - 1);
  window.PipelineTheater?.end();
  if (watchCount > 0) return; // another fill still streaming — keep the watch alive
  liveFilter = null;
  liveStrip = null;
  document.body.classList.remove('run-busy');
}

// SSE → station state flair: reviewer rework turns the mapped station amber;
// the next stage_start/agent_output turns it back to active. Done transitions
// stay user-driven (the state machine's source of truth is user progress).
function applyStationFlair(evt) {
  if (runId && evt.runId !== runId) return;
  const stId = stationForEvent(evt);
  if (!stId) return;
  const state = stationEl(stId).dataset.state;
  if (evt.type === 'rework' && state === 'active') setStationState(stId, 'rework');
  else if ((evt.type === 'stage_start' || evt.type === 'agent_output') && state === 'rework') {
    setStationState(stId, 'active');
  }
}

window.connectPipelineStream({
  onEvent: (evt) => {
    appendFeedCard(evt);
    applyStationFlair(evt);
    trackAutopilotEvent(evt);
    trackTranslationEvent(evt);
    trackImageSlotEvent(evt);
    window.PipelineTheater?.onEvent(evt);
    if (liveFilter && liveFilter(evt)) liveStrip.apply(evt);
  },
  onStatus: (status) => {
    // the stream stops retrying on 401 — surface the auth banner immediately
    if (status === 'unauthorized') $('authBanner').classList.remove('hidden');
  }
});

// ── station 1: prompt ───────────────────────────────────────────────────────

// Static sample chips are rendered in index.html (with category prefix labels).
// This loop only runs when the container is empty — e.g. if the static markup
// is absent — so both paths stay functional (attribute-mirror guard, no new
// control flow added: the loop body is unchanged from the original).
if (!$('samplePrompts').children.length) {
  for (const sample of SAMPLE_PROMPTS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sample-chip';
    chip.textContent = sample;
    chip.addEventListener('click', () => { $('promptInput').value = sample; $('promptInput').focus(); });
    $('samplePrompts').appendChild(chip);
  }
}

// Wire click handlers to the static chips: clicking a chip loads its text
// content (minus the category prefix label) into the textarea.
for (const chip of $('samplePrompts').querySelectorAll('.sample-chip')) {
  chip.addEventListener('click', () => {
    // collect text from all child nodes except .sample-chip-category spans
    let text = '';
    for (const node of chip.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
      else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('sample-chip-category')) {
        text += node.textContent;
      }
    }
    $('promptInput').value = text.trim();
    $('promptInput').focus();
  });
}

$('promptNextBtn').addEventListener('click', () => {
  const prompt = $('promptInput').value.trim();
  if (!prompt) { flash($('promptStatus'), 'Describe the topic first.', false); return; }
  completeStation('prompt');
  activateStation('template');
});

// ── station 1b: one-click Auto-Create (autopilot, POST /api/pipeline/auto) ──
//
// Runs the WHOLE pipeline server-side (research → creative direction → angle
// autopick → content loop with best-effort floor → design compile → image
// slots) with zero intermediate decisions. The call is synchronous and can
// take minutes; while it runs the poster's runId emits SSE events on the
// already-open stream, so the activity rail narrates live and
// trackAutopilotEvent() below walks the metro line. The runId is only known
// AFTER the response returns, so like the /start phase the progress strip
// accepts every event (single-user local app — nothing else is emitting).

const AUTO_STAGE_LABELS = {
  research: 'Research',
  'creative-direction': 'Creative direction',
  'content-loop': 'Content ⇄ Review',
  'design-apply': 'Design compile',
  'slot-fill': 'Images'
};
const autoStrip = new ProgressStrip($('autoCreateProgress'), AUTO_STAGE_LABELS);

// Stations the autopilot walks, in pipeline order — as each stage's first SSE
// event arrives the previous stations complete and the new one lights up.
const AUTO_STATION_ORDER = ['research', 'content', 'design', 'images'];
let autopilotRunning = false;
let autoStationIdx = -1; // index into AUTO_STATION_ORDER of the lit station

/** SSE → metro-line progression while the synchronous /auto call is in flight. */
function trackAutopilotEvent(evt) {
  if (!autopilotRunning) return;
  const idx = AUTO_STATION_ORDER.indexOf(stationForEvent(evt));
  if (idx === -1 || idx <= autoStationIdx) return;
  for (let i = Math.max(autoStationIdx, 0); i < idx; i += 1) {
    setStationState(AUTO_STATION_ORDER[i], 'done');
  }
  setStationState(AUTO_STATION_ORDER[idx], 'active');
  autoStationIdx = idx;
}

/**
 * "Autopilot decisions" summary card in station 1 — narrates what the
 * autopilot chose (template, palette, angle, content score, image fills).
 * Everything is textContent (model-derived strings never touch innerHTML).
 */
function renderAutoSummary(decisions = {}) {
  const box = $('autoSummary');
  box.innerHTML = '';
  const title = document.createElement('h3');
  title.textContent = 'Autopilot decisions';
  box.appendChild(title);
  const addLine = (label, value) => {
    if (value === null || value === undefined || value === '') return null;
    const line = document.createElement('div');
    line.className = 'auto-summary-line';
    const key = document.createElement('strong');
    key.textContent = `${label}: `;
    line.appendChild(key);
    line.appendChild(document.createTextNode(String(value)));
    box.appendChild(line);
    return line;
  };
  const creative = decisions.creative || {};
  addLine('Template', templateMetaById.get(creative.templateId)?.name || creative.templateId);
  addLine('Palette', creative.paletteId);
  addLine('Angle', decisions.angle?.reason);
  const content = decisions.content || {};
  if (content.score !== null && content.score !== undefined) {
    const line = addLine('Content score', content.score);
    if (line && content.bestEffort) {
      const chip = document.createElement('span');
      chip.className = 'chip best-effort';
      chip.textContent = 'best effort';
      chip.title = 'The reviewer never fully passed a draft — the best-scoring one was kept.';
      line.appendChild(chip);
    }
  }
  const images = decisions.images || {};
  const failed = images.failed || [];
  addLine('Images', `${images.filled ?? 0} of ${images.requested ?? 0} slots filled`
    + (failed.length ? ` — failed: ${failed.join(', ')}` : ''));
  box.classList.remove('hidden');
}

$('autoCreateBtn').addEventListener('click', async () => {
  const prompt = $('promptInput').value.trim();
  if (!prompt) { flash($('promptStatus'), 'Describe the topic first.', false); return; }
  if (runStarted) return; // one run per page — "Create another poster" resets
  $('autoCreateBtn').disabled = true;
  $('autoCreateBtn').classList.add('is-loading', 'is-running');
  $('promptNextBtn').disabled = true;
  $('promptInput').disabled = true;
  autopilotRunning = true;
  autoStationIdx = -1;
  // persistent status — flash() auto-clears long before a minutes-long run ends
  $('promptStatus').textContent = 'Autopilot running — watch the activity rail (this can take a few minutes)…';
  $('promptStatus').className = 'status';
  setStationState('prompt', 'done');
  setStationState('research', 'active');
  watchProgress(autoStrip, () => true); // runId unknown until the response (see note above)
  try {
    const result = await postJson('/api/pipeline/auto', { prompt });
    posterId = result.posterId;
    runId = result.runId;
    runStarted = true;
    designAccepted = true;
    const creative = result.decisions?.creative || {};
    chosenTemplateId = creative.templateId || null;
    // template station: autopilot picked it — locked gallery + note (I2 idiom)
    $('templateGalleryEarly').classList.add('gallery-locked');
    $('templateLockNote').textContent = 'Template picked by Autopilot for this run — '
      + 'you can still switch templates at the Design station (station 5).';
    $('templateLockNote').classList.remove('hidden');
    // approved content + review trail → station 4 (read-only, like post-approve).
    // Narration only: if this fetch fails the design fetch below still lands.
    try {
      renderApproval(await api(`/api/pipeline/${encodeURIComponent(posterId)}`));
    } catch { /* content card stays empty — refine shows everything anyway */ }
    lockContentStation();
    // fresh design state → preview rail + slot cards, the SAME renderers the
    // manual flow uses after design compile and slot generation
    const designState = await api(`/api/design/${encodeURIComponent(posterId)}`);
    await showDesignResult(designState);   // currentDesign = state, canvases → preview
    renderImageSlotsStep(designState);     // slot cards (regenerate/replace stay usable)
    for (const id of ['prompt', 'template', 'research', 'content', 'design', 'images']) {
      completeStation(id, { collapse: id !== 'prompt' }); // station 1 stays open: summary card
    }
    renderAutoSummary(result.decisions);
    flash($('promptStatus'), 'Autopilot finished — refine anything below.');
    enterRefineStation();
  } catch (err) {
    flash($('promptStatus'), err.message, false);
    if (!runStarted) {
      // the run itself failed — re-arm station 1 and roll the metro line back
      setStationState('prompt', 'active');
      for (const id of AUTO_STATION_ORDER) setStationState(id, 'pending');
    }
  } finally {
    autopilotRunning = false;
    unwatchProgress();
    autoStrip.hide();
    $('autoCreateBtn').classList.remove('is-loading', 'is-running');
    // success keeps everything locked (one run per page); failure re-arms
    $('autoCreateBtn').disabled = runStarted;
    $('promptNextBtn').disabled = runStarted;
    $('promptInput').disabled = runStarted;
  }
});

// ── station 2: template (template-first, before research) ───────────────────

const startStrip = new ProgressStrip($('startProgress'));

/**
 * Shared template gallery renderer. previewSvg is rendered server-side from
 * our own template modules — palette-resolved geometry only, no user text
 * ever enters an SVG preview (the one sanctioned innerHTML sink).
 */
function renderTemplateGallery(grid, templateList, { showBadges, selectedId, onSelect }) {
  grid.innerHTML = '';
  let currentSelection = selectedId || null;
  for (const t of templateList) {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.dataset.templateId = t.id;
    // a11y: selectable card — keyboard-activatable (shared delegated handler)
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.setAttribute('aria-pressed', String(t.id === (selectedId || null)));
    card.setAttribute('aria-label', `Template: ${t.name}`);
    card.innerHTML = t.previewSvg;
    if (showBadges && t.recommended) {
      const badge = document.createElement('span');
      badge.className = 'tpl-badge';
      badge.textContent = 'recommended';
      card.appendChild(badge);
    }
    const name = document.createElement('div');
    name.className = 'tpl-name';
    name.textContent = t.name;
    name.title = t.description;
    card.appendChild(name);
    // style micro-label — lets users scan the gallery by layout family
    if (t.style) {
      const styleTag = document.createElement('div');
      styleTag.className = 'tpl-style';
      styleTag.textContent = t.style;
      card.appendChild(styleTag);
    }
    // full-size preview: renders the REAL sample canvas in a modal — click
    // must not toggle card selection (stopPropagation)
    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'tpl-preview-btn';
    previewBtn.textContent = 'Preview';
    previewBtn.classList.add('ic', 'ic-eye');
    previewBtn.setAttribute('aria-label', `Preview template ${t.name} full size`);
    previewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openTemplatePreviewModal(t.id, t.name);
    });
    card.appendChild(previewBtn);
    if (t.id === currentSelection) card.classList.add('selected');
    card.addEventListener('click', () => {
      currentSelection = currentSelection === t.id ? null : t.id;
      for (const el of grid.children) {
        el.classList.toggle('selected', el.dataset.templateId === currentSelection);
        el.setAttribute('aria-pressed', String(el.dataset.templateId === currentSelection));
      }
      onSelect(currentSelection);
    });
    grid.appendChild(card);
  }
}

// v2 gallery items by id — the selected item becomes the preview engine's
// templateMeta (contentSchema + both orientation preview SVGs).
let templateMetaById = new Map();

/**
 * Pre-start gallery: GET /api/pipeline/templates is poster-independent (v2
 * registry), so the full 15-template gallery renders before any poster
 * exists. Selecting a card pushes {templateId, templateMeta} into the
 * preview engine — the right rail immediately shows both orientation
 * previews of the chosen template.
 */
async function loadEarlyTemplateGallery() {
  try {
    // doubles as the auth probe: a 401 here surfaces the banner immediately
    const { templates } = await api('/api/pipeline/templates');
    templateMetaById = new Map(templates.map((t) => [t.id, t]));
    renderTemplateGallery(
      $('templateGalleryEarly'),
      templates.map((t) => ({
        id: t.id, name: t.name, style: t.style, description: t.description, previewSvg: t.previews.portrait
      })),
      {
        showBadges: false,
        selectedId: chosenTemplateId,
        onSelect: (id) => {
          if (runStarted) return;
          chosenTemplateId = id;
          preview.set({
            templateId: id,
            templateMeta: id ? (templateMetaById.get(id) || null) : null
          });
        }
      }
    );
  } catch (err) {
    if (err.code === 'UNAUTHORIZED') return; // banner already shown
    $('templateEarlyNote').textContent = 'Template previews could not be loaded — '
      + 'reload to retry, or continue without picking and choose at the Design station.';
    $('templateEarlyNote').classList.remove('hidden');
  }
}

// ── template preview modal (step-2 "Preview" button) ────────────────────────
// Fetches the template's REAL sample canvas (GET /templates/:id/sample) and
// renders it with fabric at fit-to-modal scale — the library-thumbnail idiom:
// setDimensions + setZoom AFTER loadFromJSON. Canvases cached per id+orientation.

const tplSampleCache = new Map(); // `${id}/${orientation}` → canvas JSON
let tplPreviewFc = null;          // live fabric.StaticCanvas in the modal
let tplPreviewId = null;
let tplPreviewOrientation = 'portrait';

async function renderTemplatePreview() {
  const status = $('tplPreviewStatus');
  const key = `${tplPreviewId}/${tplPreviewOrientation}`;
  try {
    let canvasJSON = tplSampleCache.get(key);
    if (!canvasJSON) {
      status.textContent = 'Rendering sample…';
      const { canvas } = await api(`/api/pipeline/templates/${encodeURIComponent(tplPreviewId)}/sample?orientation=${tplPreviewOrientation}`);
      canvasJSON = canvas;
      tplSampleCache.set(key, canvasJSON);
    }
    const w = canvasJSON.width || 1414;
    const h = canvasJSON.height || 2000;
    // fit inside the modal viewport (portrait is tall — cap by height too)
    const maxW = Math.min(720, window.innerWidth - 120);
    const maxH = window.innerHeight - 220;
    const scale = Math.min(maxW / w, maxH / h, 1);
    if (tplPreviewFc) { try { await tplPreviewFc.dispose(); } catch { /* teardown race */ } tplPreviewFc = null; }
    tplPreviewFc = new fabric.StaticCanvas($('tplPreviewCanvas'), {
      width: Math.round(w * scale), height: Math.round(h * scale)
    });
    await tplPreviewFc.loadFromJSON({ objects: canvasJSON.objects || [], background: canvasJSON.background || '' });
    tplPreviewFc.setDimensions({ width: Math.round(w * scale), height: Math.round(h * scale) });
    tplPreviewFc.setZoom(scale);
    tplPreviewFc.renderAll();
    status.textContent = 'Sample content — your topic replaces every line.';
  } catch (err) {
    status.textContent = `Preview failed: ${err.message}`;
  }
}

async function openTemplatePreviewModal(templateId, name) {
  tplPreviewId = templateId;
  $('tplPreviewTitle').textContent = name || templateId;
  $('templatePreviewModal').classList.remove('hidden');
  for (const b of $('tplPreviewTabs').querySelectorAll('button')) {
    b.classList.toggle('active', b.dataset.orient === tplPreviewOrientation);
  }
  $('closeTplPreview').focus(); // a11y: move focus into the dialog
  await renderTemplatePreview();
}

for (const b of $('tplPreviewTabs').querySelectorAll('button')) {
  b.addEventListener('click', async () => {
    tplPreviewOrientation = b.dataset.orient;
    for (const x of $('tplPreviewTabs').querySelectorAll('button')) x.classList.toggle('active', x === b);
    await renderTemplatePreview();
  });
}

async function closeTplPreviewModal() {
  $('templatePreviewModal').classList.add('hidden');
  if (tplPreviewFc) { try { await tplPreviewFc.dispose(); } catch { /* teardown race */ } tplPreviewFc = null; }
}
$('closeTplPreview').addEventListener('click', closeTplPreviewModal);
$('templatePreviewModal').addEventListener('click', (e) => {
  if (e.target === $('templatePreviewModal')) closeTplPreviewModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('templatePreviewModal').classList.contains('hidden')) closeTplPreviewModal();
});

// "Let AI pick the best template" (station 2): recommend the most impactful
// template for the topic and auto-select it in the gallery. Content then
// generates to that template exactly as if the user had picked it.
$('aiPickTemplateBtn')?.addEventListener('click', async () => {
  if (runStarted) return;
  const prompt = $('promptInput').value.trim();
  const note = $('aiPickNote');
  if (!prompt) { note.textContent = 'Describe the topic first (station 1).'; activateStation('prompt'); return; }
  const btn = $('aiPickTemplateBtn');
  btn.disabled = true; btn.classList.add('is-loading');
  note.textContent = 'AI is choosing the most impactful template…';
  try {
    const { templateId, name, reason } = await postJson('/api/pipeline/recommend-template', { prompt });
    chosenTemplateId = templateId;
    await loadEarlyTemplateGallery(); // re-renders with the AI pick selected
    preview.set({ templateId, templateMeta: templateMetaById.get(templateId) || null });
    const card = $('templateGalleryEarly').querySelector(`[data-template-id="${templateId}"]`);
    if (card) card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    note.textContent = `AI picked “${name}” — ${reason}`;
  } catch (err) {
    note.textContent = err.message || 'Could not recommend a template.';
  } finally {
    btn.disabled = false; btn.classList.remove('is-loading');
  }
});

// Angles regenerate (I5): re-run research with an optionally edited prompt —
// fresh angles land in the same station; nothing else about the run changes.
$('anglesRegenBtn').addEventListener('click', async () => {
  if (!posterId) return;
  const btn = $('anglesRegenBtn');
  const prompt = $('anglesRegenPrompt').value.trim();
  if (!prompt) { flash($('anglesRegenStatus'), 'The prompt cannot be empty.', false); return; }
  btn.disabled = true; btn.classList.add('is-loading');
  flash($('anglesRegenStatus'), 'Re-researching with the edited prompt…');
  watchProgress(startStrip, (evt) => evt.runId === runId && evt.pipeline === 'content');
  try {
    const state = await postJson(`/api/pipeline/${posterId}/angles/regenerate`, { prompt });
    currentState = state;
    renderAngles(state);
    flash($('anglesRegenStatus'), 'Fresh angles ready — pick again below.');
  } catch (err) {
    flash($('anglesRegenStatus'), err.message, false);
  } finally {
    unwatchProgress();
    startStrip.hide();
    btn.disabled = false; btn.classList.remove('is-loading');
  }
});

$('startBtn').addEventListener('click', async () => {
  const prompt = $('promptInput').value.trim();
  if (!prompt) {
    flash($('startStatus'), 'Describe the topic first (station 1).', false);
    activateStation('prompt');
    return;
  }
  $('startBtn').disabled = true;
  $('startBtn').classList.add('is-loading');
  flash($('startStatus'), 'Researching current threats…');
  setStationState('research', 'active');
  watchProgress(startStrip, (evt) => evt.pipeline === 'content');
  try {
    // templateId rides along from station 2 (the backend ignores it until the
    // template-aware content phase lands — sent anyway per the O1 contract)
    const body = { prompt };
    if (chosenTemplateId) body.templateId = chosenTemplateId;
    const state = await postJson('/api/pipeline/start', body);
    posterId = state.posterId;
    runId = state.runId;
    currentState = state;
    // lock prompt + template stations for this run (reopenable, read-only —
    // template switching after content lives at the Design station)
    runStarted = true;
    $('promptInput').disabled = true;
    $('promptNextBtn').disabled = true;
    $('autoCreateBtn').disabled = true; // one run per page — autopilot included
    $('templateGalleryEarly').classList.add('gallery-locked');
    $('templateLockNote').classList.remove('hidden');
    flash($('startStatus'), `Topic: ${state.topic}${state.grounded ? '' : ' (no matching news — using general security knowledge)'}`);
    completeStation('template');
    completeStation('prompt');
    renderAngles(state);
  } catch (err) {
    flash($('startStatus'), err.message, false);
    setStationState('research', 'pending');
  } finally {
    unwatchProgress();
    $('startBtn').classList.remove('is-loading');
    $('startBtn').disabled = runStarted; // one run per page — "Create another poster" resets
  }
});

// ── station 3: research (angle selection) ───────────────────────────────────

const loopStrip = new ProgressStrip($('loopProgress'));

/**
 * Fetch suggestions for the given topic and render the informational strip
 * above the angle cards. Non-blocking: errors are silently swallowed (purely
 * informative, must never interrupt the flow).
 */
async function showAngleSuggestions(topic) {
  const strip = $('angleSuggestionsStrip');
  if (!strip || !topic) return;
  strip.textContent = '';
  strip.classList.add('hidden');
  try {
    const { suggestions } = await api(`/api/posters/suggestions?topic=${encodeURIComponent(topic)}`);
    if (!suggestions || !suggestions.length) return;
    const top3 = suggestions.slice(0, 3);
    const label = document.createElement('span');
    label.className = 'suggestions-label';
    label.textContent = `Similar posters performed well for “${topic}” — what worked best: `;
    strip.appendChild(label);
    for (const s of top3) {
      const chip = document.createElement('span');
      chip.className = 'suggestion-chip';
      chip.textContent = s.headline || '';
      strip.appendChild(chip);
    }
    strip.classList.remove('hidden');
  } catch {
    // purely informative — swallow all errors silently
  }
}

function renderAngles(state) {
  selectedAngles = new Set();
  aiDecides = false;
  $('anglesHint').textContent = state.grounded
    ? `These angles come from current threat reporting on “${state.topic}”. Pick one or more — or let the AI decide.`
    : `No recent news matched “${state.topic}”, so these angles come from general security-awareness knowledge. Pick one or more — or let the AI decide.`;
  // regenerate box: prefill with the prompt that produced these angles
  if (!$('anglesRegenPrompt').value.trim()) {
    $('anglesRegenPrompt').value = $('promptInput').value.trim();
  }
  // Fetch and show suggestions above the angle grid (non-blocking)
  showAngleSuggestions(state.topic);
  const grid = $('angleGrid');
  grid.innerHTML = '';
  for (const angle of state.angles) {
    const card = document.createElement('div');
    card.className = 'angle-card';
    card.dataset.angleId = angle.id;
    // a11y: multi-select card — keyboard-activatable (shared delegated handler)
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.setAttribute('aria-pressed', 'false');
    card.innerHTML = `<h3></h3><p></p>`;
    card.querySelector('h3').textContent = angle.title;
    card.querySelector('p').textContent = angle.rationale;
    card.addEventListener('click', () => {
      if (selectedAngles.has(angle.id)) selectedAngles.delete(angle.id);
      else selectedAngles.add(angle.id);
      if (selectedAngles.size) aiDecides = false;
      syncAngleCards();
    });
    grid.appendChild(card);
  }
  const ai = document.createElement('div');
  ai.className = 'angle-card ai';
  ai.dataset.ai = '1';
  ai.setAttribute('role', 'button');
  ai.tabIndex = 0;
  ai.setAttribute('aria-pressed', 'false');
  ai.innerHTML = `<h3>Let AI decide</h3><p>The AI weighs all angles against the research context and past approvals, then picks the strongest framing itself.</p>`;
  ai.addEventListener('click', () => {
    aiDecides = !aiDecides;
    if (aiDecides) selectedAngles.clear();
    syncAngleCards();
  });
  grid.appendChild(ai);
  syncAngleCards();
  activateStation('research');
}

function syncAngleCards() {
  for (const card of $('angleGrid').children) {
    const selected = card.dataset.ai ? aiDecides : selectedAngles.has(card.dataset.angleId);
    card.classList.toggle('selected', selected);
    card.setAttribute('aria-pressed', String(selected));
  }
}

$('anglesBtn').addEventListener('click', async () => {
  if (!aiDecides && !selectedAngles.size) {
    flash($('anglesStatus'), 'Pick at least one angle — or “Let AI decide”.', false);
    return;
  }
  $('anglesBtn').disabled = true;
  $('anglesBtn').classList.add('is-loading');
  flash($('anglesStatus'), 'Writing and reviewing content (95-point gate — this can take a while)…');
  setStationState('content', 'active');
  watchProgress(loopStrip, (evt) => evt.runId === runId);
  try {
    const state = await postJson(`/api/pipeline/${posterId}/angles`, {
      angleIds: aiDecides ? 'ai' : [...selectedAngles]
    });
    currentState = state;
    const lastReview = (state.reviewHistory || []).at(-1);
    if (lastReview?.status === 'best-effort') {
      flash($('anglesStatus'), `Reviewer never fully passed it — accepted the best draft (scored ${lastReview.score}). Regenerate or edit below if it misses.`, false);
    } else {
      flash($('anglesStatus'), 'Content passed the review gate.');
    }
    completeStation('research');
    renderApproval(state);
  } catch (err) {
    flash($('anglesStatus'), err.message, false);
    setStationState('content', 'pending');
  } finally {
    unwatchProgress();
    $('anglesBtn').classList.remove('is-loading');
    $('anglesBtn').disabled = false;
  }
});

// ── station 4: content ⇄ review (approve / regenerate / feedback / edit) ────

const approvalStrip = new ProgressStrip($('approvalLoopProgress'));

function renderApproval(state) {
  currentState = state;
  editing = false;
  renderReviewTrail(state.reviewHistory);
  renderPreview(state.content);
  // accepted/revised content → live preview (reconciles any optimistic draft
  // pushed while the user was typing in the edit fields)
  preview.set({ content: state.content });
  for (const panel of ['regenPanel', 'feedbackPanel', 'editPanel']) $(panel).classList.add('hidden');
  activateStation('content');
  // content now exists — the reroute affordance (O6) becomes available
  $('reroutePanel').classList.remove('hidden');
}

function renderReviewTrail(history) {
  const trail = $('reviewTrail');
  trail.innerHTML = '';
  for (const h of history || []) {
    const chip = document.createElement('span');
    chip.className = `score-chip ${h.status === 'accepted' ? 'pass' : 'fail'}`;
    chip.textContent = `attempt ${h.attempt}: ${h.score} ${h.status === 'accepted' ? '✓' : '↩'}`;
    chip.title = h.status;
    trail.appendChild(chip);
  }
  const latest = (history || []).filter((h) => h.feedback).at(-1);
  $('latestFeedback').innerHTML = '';
  if (latest) {
    const note = document.createElement('div');
    note.className = 'feedback-note';
    note.textContent = `Reviewer feedback on attempt ${latest.attempt}: ${latest.feedback}`;
    $('latestFeedback').appendChild(note);
  }
}

// The content object comes in two shapes: v1 (messages[{id,label,text}]) and
// v2/template-first (blocks[{id, ...schema fields e.g. question/answer}]).
// contentItems() unifies them so the preview + edit collection handle both —
// a v2 poster used to crash renderPreview on `for..of content.messages`.
function contentItems(content) {
  if (Array.isArray(content.blocks)) {
    return {
      shape: 'blocks',
      items: content.blocks.map((b) => ({
        id: b.id,
        fields: Object.keys(b).filter((k) => k !== 'id' && typeof b[k] === 'string')
          .map((k) => ({ name: k, value: b[k] }))
      }))
    };
  }
  return {
    shape: 'messages',
    items: (content.messages || []).map((m) => ({
      id: m.id,
      fields: [
        { name: 'label', value: m.label ?? '', optional: true },
        { name: 'text', value: m.text ?? '' }
      ]
    }))
  };
}

function renderPreview(content) {
  const pv = $('posterPreview');
  pv.innerHTML = '';
  const headline = document.createElement('p');
  headline.className = 'pv-headline';
  headline.textContent = content.headline;
  pv.appendChild(headline);

  const sub = document.createElement('p');
  sub.className = 'pv-subheadline';
  sub.textContent = content.subheadline || '';
  if (!content.subheadline && !editing) sub.classList.add('hidden');
  pv.appendChild(sub);

  const { items } = contentItems(content);
  const ul = document.createElement('ul');
  for (const item of items) {
    const li = document.createElement('li');
    li.dataset.msgId = item.id;
    for (const f of item.fields) {
      const span = document.createElement('span');
      // 'label' keeps the chip look; every other field renders as body text.
      // data-field drives collection back into the right shape on edit.
      span.className = f.name === 'label' ? 'pv-label' : 'pv-text';
      span.dataset.field = f.name;
      span.textContent = f.value || '';
      if (f.optional && !f.value && !editing) span.classList.add('hidden');
      li.appendChild(span);
    }
    ul.appendChild(li);
  }
  pv.appendChild(ul);

  const cta = document.createElement('p');
  cta.className = 'pv-cta';
  cta.textContent = content.callToAction || '';
  if (!content.callToAction && !editing) cta.classList.add('hidden');
  pv.appendChild(cta);

  const format = document.createElement('span');
  format.className = 'chip';
  format.textContent = `format: ${content.format || contentItems(content).shape}`;
  pv.appendChild(format);
}

function setEditing(on) {
  editing = on;
  renderPreview(currentState.content);
  const pv = $('posterPreview');
  for (const el of pv.querySelectorAll('.pv-headline, .pv-subheadline, .pv-label, .pv-text, .pv-cta')) {
    el.contentEditable = on ? 'true' : 'false';
    el.classList.remove('hidden');
    if (!on) {
      // re-hide optional fields that are empty
      if ((el.classList.contains('pv-subheadline') || el.classList.contains('pv-cta') ||
           el.classList.contains('pv-label')) && !el.textContent.trim()) {
        el.classList.add('hidden');
      }
    }
  }
  $('editPanel').classList.toggle('hidden', !on);
  // leaving edit mode (cancel or save): reconcile the preview back to the
  // server-confirmed content (save paths overwrite it again on response)
  if (!on && currentState?.content) preview.set({ content: currentState.content });
}

// Inline edit typing → optimistic live preview (<100ms): every input in the
// contentEditable fields pushes the current draft into the store; the engine
// debounces (60ms) and text-patches the canvas/preview without a round-trip.
$('posterPreview').addEventListener('input', () => {
  if (!editing) return;
  preview.set({ content: collectEditedContent() });
});

/** Reconstruct the content object from the edited preview, keeping ids + shape. */
function collectEditedContent() {
  const pv = $('posterPreview');
  const base = {
    headline: pv.querySelector('.pv-headline').textContent.trim(),
    subheadline: pv.querySelector('.pv-subheadline').textContent.trim() || null,
    callToAction: pv.querySelector('.pv-cta').textContent.trim() || null,
    format: currentState.content.format
  };
  const isBlocks = Array.isArray(currentState.content.blocks);
  const items = [...pv.querySelectorAll('li')].map((li) => {
    const id = li.dataset.msgId;
    if (isBlocks) {
      const block = { id };
      for (const span of li.querySelectorAll('[data-field]')) {
        block[span.dataset.field] = span.textContent.trim();
      }
      return block;
    }
    return {
      id,
      label: li.querySelector('.pv-label')?.textContent.trim() || null,
      text: li.querySelector('.pv-text')?.textContent.trim() || ''
    };
  });
  return isBlocks ? { ...base, blocks: items } : { ...base, messages: items };
}

/** True when every editable body field carries text (shape-agnostic). */
function editedContentComplete(content) {
  if (!content.headline) return false;
  const { items } = contentItems(content);
  return items.every((item) => item.fields
    .filter((f) => !f.optional)
    .every((f) => f.value && f.value.trim()));
}

function togglePanel(id) {
  for (const panel of ['regenPanel', 'feedbackPanel', 'editPanel']) {
    $(panel).classList.toggle('hidden', panel !== id || !$(panel).classList.contains('hidden'));
  }
  if (editing && id !== 'editPanel') setEditing(false);
}

$('regenToggle').addEventListener('click', () => togglePanel('regenPanel'));
$('feedbackToggle').addEventListener('click', () => togglePanel('feedbackPanel'));
$('editToggle').addEventListener('click', () => {
  const turnOn = $('editPanel').classList.contains('hidden');
  togglePanel(turnOn ? 'editPanel' : '');
  setEditing(turnOn);
});
$('cancelEditBtn').addEventListener('click', () => setEditing(false));

function setApprovalBusy(busy) {
  for (const id of ['approveBtn', 'regenToggle', 'feedbackToggle', 'editToggle', 'regenBtn', 'feedbackBtn', 'saveEditBtn']) {
    $(id).disabled = busy;
  }
}

/** Content is approved: the station stays reopenable but read-only. */
function lockContentStation() {
  if (editing) setEditing(false);
  for (const panel of ['regenPanel', 'feedbackPanel', 'editPanel']) $(panel).classList.add('hidden');
  for (const id of ['approveBtn', 'regenToggle', 'feedbackToggle', 'editToggle']) $(id).disabled = true;
  $('contentLockNote').classList.remove('hidden');
}

/** A reroute jumped back before approval: the content station is editable again. */
function unlockContentStation() {
  for (const id of ['approveBtn', 'regenToggle', 'feedbackToggle', 'editToggle']) $(id).disabled = false;
  $('contentLockNote').classList.add('hidden');
}

async function approvalAction(fn, workingMessage, doneMessage, { watchLoop = false } = {}) {
  setApprovalBusy(true);
  flash($('approvalStatus'), workingMessage);
  if (watchLoop) watchProgress(approvalStrip, (evt) => evt.runId === runId);
  try {
    const state = await fn();
    flash($('approvalStatus'), doneMessage);
    return state;
  } catch (err) {
    flash($('approvalStatus'), err.message, false);
    return null;
  } finally {
    if (watchLoop) { unwatchProgress(); approvalStrip.hide(); }
    setApprovalBusy(false);
  }
}

$('approveBtn').addEventListener('click', async () => {
  const state = await approvalAction(
    () => postJson(`/api/pipeline/${posterId}/approve`, {}),
    'Approving…', 'Approved — compiling the design.'
  );
  if (state) {
    currentState = state;
    lockContentStation();
    completeStation('content');
    enterDesignStation();
  }
});

$('regenBtn').addEventListener('click', async () => {
  const prompt = $('regenPrompt').value.trim();
  const state = await approvalAction(
    () => postJson(`/api/pipeline/${posterId}/regenerate`, prompt ? { prompt } : {}),
    'Regenerating (full quality loop)…', 'New draft passed the review gate.',
    { watchLoop: true }
  );
  if (state) { $('regenPrompt').value = ''; renderApproval(state); }
});

$('feedbackBtn').addEventListener('click', async () => {
  const feedback = $('feedbackText').value.trim();
  if (!feedback) { flash($('approvalStatus'), 'Write the feedback first.', false); return; }
  const state = await approvalAction(
    () => postJson(`/api/pipeline/${posterId}/feedback`, { feedback }),
    'Reworking with your feedback…', 'Revised draft passed the review gate.',
    { watchLoop: true }
  );
  if (state) { $('feedbackText').value = ''; renderApproval(state); }
});

$('saveEditBtn').addEventListener('click', async () => {
  const content = collectEditedContent();
  if (!content.headline) { flash($('approvalStatus'), 'The headline cannot be empty.', false); return; }
  if (!editedContentComplete(content)) { flash($('approvalStatus'), 'Every content field must have text.', false); return; }
  const state = await approvalAction(
    () => postJson(`/api/pipeline/${posterId}/edit`, { content }),
    'Saving your edit…', 'Edit saved verbatim (no re-review).'
  );
  if (state) renderApproval(state);
});

// ── station 5: design compile ───────────────────────────────────────────────

const designStrip = new ProgressStrip($('designProgress'), DESIGN_STAGE_LABELS);
const retryStrip = new ProgressStrip($('retryProgress'), DESIGN_STAGE_LABELS);
let selectedTemplateId = null;
let currentDesign = null; // last design safe state returned by the server

/** I2: "Change template…" disclosure — the gallery + AI-dynamic path live
 *  behind it so the station never re-asks for a template already chosen at
 *  station 2. Open/closed state is purely presentational (aria-mirrored). */
function setChangeTemplateOpen(open) {
  $('changeTemplateBody').classList.toggle('hidden', !open);
  $('changeTemplateToggle').setAttribute('aria-expanded', String(open));
  $('changeTemplateToggle').textContent = open ? 'Hide template options' : 'Change template…';
}

function showChangeTemplateToggle(show) {
  $('changeTemplateToggle').classList.toggle('hidden', !show);
}

$('changeTemplateToggle').addEventListener('click', () => {
  setChangeTemplateOpen($('changeTemplateBody').classList.contains('hidden'));
});

/**
 * Entered after content approval. The station-2 pick is THE pick (I2): when
 * one was made it auto-compiles immediately — no gallery re-selection. The
 * gallery + AI-dynamic path stay reachable behind the collapsed "Change
 * template…" disclosure (re-applying after acceptance still confirms). Only
 * when station 2 was skipped does the gallery show directly — that is the
 * first selection, not a duplicate.
 */
async function enterDesignStation() {
  activateStation('design');
  selectedTemplateId = chosenTemplateId;
  // the design compiler's gallery (design v2 registry — same ids as station 2)
  let compilableIds = new Set();
  try {
    const gallery = await api(`/api/design/templates?posterId=${encodeURIComponent(posterId)}`);
    compilableIds = new Set(gallery.templates.map((t) => t.id));
    renderTemplateGallery($('templateGallery'), gallery.templates, {
      showBadges: true,
      selectedId: chosenTemplateId,
      onSelect: (id) => { selectedTemplateId = id; }
    });
  } catch (err) {
    flash($('designStatus'), err.message, false);
  }
  const hasChoice = Boolean(chosenTemplateId && compilableIds.has(chosenTemplateId));
  showChangeTemplateToggle(hasChoice);
  setChangeTemplateOpen(!hasChoice);
  if (hasChoice) {
    $('designAutoNote').textContent = 'Compiling your chosen template with the approved content — '
      + 'expand “Change template…” below if you change your mind.';
    await applyTemplate(chosenTemplateId);
  } else {
    $('designAutoNote').textContent = 'No template was picked at station 2 — choose a layout below, '
      + 'or let the AI recommend one for this exact content.';
  }
}

function setDesignBusy(busy) {
  for (const id of ['applyTemplateBtn', 'dynamicBtn']) $(id).disabled = busy;
}

async function applyTemplate(templateId) {
  setDesignBusy(true);
  flash($('designStatus'), 'Compiling the template with your approved content…');
  try {
    const state = await postJson(`/api/design/${posterId}/apply`, { templateId, visualMode: selectedVisualMode });
    flash($('designStatus'), 'Design ready — see the preview rail.');
    await showDesignResult(state);
  } catch (err) {
    flash($('designStatus'), err.message, false);
  } finally { setDesignBusy(false); }
}

$('applyTemplateBtn').addEventListener('click', async () => {
  if (!selectedTemplateId) { flash($('designStatus'), 'Pick a template first.', false); return; }
  if (designAccepted && !confirm('A design was already accepted — re-applying a template rebuilds the layout (your approved text is kept). Continue?')) return;
  await applyTemplate(selectedTemplateId);
});

$('dynamicBtn').addEventListener('click', async () => {
  const prompt = $('dynamicPrompt').value.trim();
  setDesignBusy(true);
  flash($('designStatus'), 'Design agent at work (90-point review gate — this can take a while)…');
  watchProgress(designStrip, (evt) => evt.runId === runId && evt.pipeline === 'design');
  try {
    const state = await postJson(`/api/design/${posterId}/dynamic`, { ...(prompt ? { prompt } : {}), visualMode: selectedVisualMode });
    flash($('designStatus'), 'Design passed the review gate.');
    await showDesignResult(state);
  } catch (err) {
    flash($('designStatus'), err.message, false);
  } finally {
    unwatchProgress();
    setDesignBusy(false);
  }
});

/** Show the compiled/recommended design: meta + rationale in the station, canvas in the right rail. */
async function showDesignResult(state) {
  currentDesign = state;
  const source = state.design.templateSource === 'predefined'
    ? `Predefined template “${state.design.templateId}”`
    : `AI-recommended layout “${state.design.layoutType}”`;
  $('designMeta').textContent =
    `${source} — a read-only render of the real poster canvas (1414×2000) in the preview rail. Fine-tuning happens at the Refine station.`;
  $('designRationale').innerHTML = '';
  if (state.design.rationale) {
    const note = document.createElement('div');
    note.className = 'design-rationale';
    note.textContent = `Why this layout: ${state.design.rationale}`;
    $('designRationale').appendChild(note);
  }
  $('designResult').classList.remove('hidden');
  // compiled canvases → live preview, BOTH orientations. v2 designs carry
  // landscapeCanvas; v1/dynamic don't (null keeps the template SVG rendering).
  preview.set({ canvases: {
    portrait: state.design.canvas,
    landscape: state.design.landscapeCanvas || null
  } });
}

function setDesignResultBusy(busy) {
  for (const id of ['acceptDesignBtn', 'tryAgainBtn']) $(id).disabled = busy;
}

$('acceptDesignBtn').addEventListener('click', () => {
  if (!currentDesign) return;
  designAccepted = true;
  completeStation('design');
  renderImageSlotsStep(currentDesign);
});

$('tryAgainBtn').addEventListener('click', async () => {
  const prompt = $('retryPrompt').value.trim();
  setDesignResultBusy(true);
  flash($('designPreviewStatus'), 'Redesigning (full 90-gate loop)…');
  watchProgress(retryStrip, (evt) => evt.runId === runId && evt.pipeline === 'design');
  try {
    const state = await postJson(`/api/design/${posterId}/retry`, prompt ? { prompt } : {});
    $('retryPrompt').value = '';
    flash($('designPreviewStatus'), 'New design passed the review gate.');
    await showDesignResult(state);
  } catch (err) {
    flash($('designPreviewStatus'), err.message, false);
  } finally {
    unwatchProgress();
    retryStrip.hide();
    setDesignResultBusy(false);
  }
});

// ── station 6: image slots ──────────────────────────────────────────────────

const imageStrip = new ProgressStrip($('imageSlotsProgress'), {
  'slot-fill': 'Slot fill', 'zero-text-gate': 'Zero-text gate'
});
let pendingLibrarySlotId = null;
let pendingLibraryPrompt = '';
let libraryPickedImageId = null;

const IMAGE_MAX_ATTEMPTS = 5;               // mirrors the pipeline's retry budget
const IMAGE_FAIL_REASONS = {                // machine reason → human words
  'zero-text-gate': 'zero-text gate',
  'generation-error': 'generation error'
};
const lastFillArgs = new Map();             // slotId → {source, imageId, prompt} for [Try again]
const bgTreatmentChoice = new Map();       // slotId → 'gradient'|'pattern'|'image'
let imageSeedAdjustments = '';              // O6 after-images reroute: rides as customPrompt

/** The specific point (block message) a foreground slot illustrates, or ''.
 *  Mirrors the pipeline's blockPointFor: explicit slotSpec.blockId wins, else
 *  positional slot-N → Nth block. The 'bg' slot illustrates the whole topic. */
function slotPoint(state, slot) {
  if (!slot || slot.slotId === 'bg') return '';
  const content = state?.content || {};
  const blocks = Array.isArray(content.blocks)
    ? content.blocks
    : (Array.isArray(content.messages) ? content.messages : []);
  if (!blocks.length) return '';
  let block = null;
  const bid = slot.slotSpec?.blockId;
  if (bid) block = blocks.find((b) => b.id === bid) || null;
  if (!block) {
    const m = /^slot-(\d+)$/.exec(slot.slotId || '');
    if (m) block = blocks[Number(m[1]) - 1] || null;
  }
  if (!block) return '';
  return String(block.text || block.heading || block.caption || block.answer || block.label || '').trim();
}

/** The slot row's live/fail containers (rows carry data-slot-id). */
function slotRowEl(slotId) {
  for (const item of $('imageSlotsList').children) {
    if (item.dataset && item.dataset.slotId === slotId) return item;
  }
  return null;
}

function renderImageSlotsStep(state) {
  currentDesign = state;
  const slots = (state.design?.canvas?.objects || [])
    .filter((o) => o.layerRole === 'image-slot' || o.layerRole === 'image');
  const list = $('imageSlotsList');
  list.innerHTML = '';
  if (imageSeedAdjustments) {
    const seedNote = document.createElement('p');
    seedNote.className = 'hint';
    seedNote.textContent = `Reroute adjustments will steer the next generations: ${imageSeedAdjustments}`;
    list.appendChild(seedNote);
  }
  if (!slots.length) {
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = 'No image slots in this template — nothing to generate. '
      + 'Use “Done — continue to refine” to move on.';
    list.appendChild(note);
  }
  for (const slot of slots) {
    const item = document.createElement('div');
    item.className = 'slot-item';
    item.dataset.slotId = slot.slotId;

    const label = document.createElement('div');
    label.className = 'slot-label';
    const name = document.createElement('strong');
    name.textContent = `Slot: ${slot.slotId}`;
    label.appendChild(name);
    if (slot.slotSpec?.styleHint) {
      const hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = ` — ${slot.slotSpec.styleHint}`;
      label.appendChild(hint);
    }
    // the specific point this image illustrates (so the user sees relevance)
    const point = slotPoint(state, slot);
    if (point) {
      const ill = document.createElement('div');
      ill.className = 'slot-illustrates';
      ill.textContent = `Illustrates: ${point}`;
      label.appendChild(ill);
    }
    if (slot.layerRole === 'image') {
      const badge = document.createElement('span');
      badge.className = 'chip on';
      badge.textContent = 'assigned';
      label.appendChild(badge);
    }

    const actions = document.createElement('div');
    actions.className = 'slot-actions';

    // per-slot choice — NOTHING generates until the user picks a path
    const choose = document.createElement('span');
    choose.className = 'slot-choose hint';
    choose.textContent = slot.layerRole === 'image' ? 'Replace with:' : 'Fill this slot:';

    const genBtn = document.createElement('button');
    genBtn.className = 'primary ic ic-sparkle';
    genBtn.textContent = 'Generate with AI';
    genBtn.addEventListener('click', () => fillSlot(slot.slotId, 'generate'));

    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'ic ic-upload';
    uploadBtn.textContent = 'Upload';
    uploadBtn.addEventListener('click', () => uploadIntoSlot(slot.slotId));

    const libKind = slot.slotId === 'bg' ? 'background' : '';
    const pickBtn = document.createElement('button');
    pickBtn.className = 'ic ic-image';
    pickBtn.textContent = 'Pick from library';
    pickBtn.addEventListener('click', () => openLibraryModal(slot.slotId, '', libKind));

    const libPromptWrap = document.createElement('div');
    libPromptWrap.className = 'lib-prompt-wrap';
    const libPromptInput = document.createElement('input');
    libPromptInput.placeholder = 'describe what to generate…';
    libPromptInput.maxLength = 500;
    const libPromptBtn = document.createElement('button');
    libPromptBtn.textContent = 'Library + prompt';
    libPromptBtn.addEventListener('click', () => openLibraryModal(slot.slotId, libPromptInput.value.trim(), libKind));
    libPromptWrap.append(libPromptInput, libPromptBtn);

    actions.append(choose, genBtn, uploadBtn, pickBtn, libPromptWrap);

    // O5: live attempt line (SSE-driven) + retry-exhausted failure card mount
    const live = document.createElement('div');
    live.className = 'slot-live hidden';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    const fail = document.createElement('div');
    fail.className = 'slot-fail hidden';
    fail.setAttribute('role', 'alert');

    // bg slot only: compact treatment picker shown above the action buttons
    if (slot.slotId === 'bg') {
      const picker = document.createElement('div');
      picker.className = 'bg-treatment-picker';
      const pickerLabel = document.createElement('span');
      pickerLabel.className = 'hint';
      pickerLabel.textContent = 'Background type:';
      picker.appendChild(pickerLabel);

      const treatments = [
        { key: 'gradient', label: 'Gradient' },
        { key: 'pattern',  label: 'Pattern'  },
        { key: 'image',    label: 'Scene'    }
      ];
      // Default to what the design agent decided (or 'gradient' as fallback);
      // normalise 'gradient-mesh' → 'gradient' for the picker buttons
      const rawTreatment = state.design?.background?.treatment || 'gradient';
      const designTreatment = rawTreatment === 'gradient-mesh' ? 'gradient' : rawTreatment;
      const currentChoice = bgTreatmentChoice.get('bg') || designTreatment;

      for (const t of treatments) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = t.label;
        btn.dataset.treatment = t.key;
        btn.className = 'bg-treatment-btn' + (currentChoice === t.key ? ' active' : '');
        btn.addEventListener('click', () => {
          bgTreatmentChoice.set('bg', t.key);
          for (const b of picker.querySelectorAll('.bg-treatment-btn')) {
            b.classList.toggle('active', b.dataset.treatment === t.key);
          }
        });
        picker.appendChild(btn);
      }
      item.append(label, picker, actions, live, fail);
    } else {
      item.append(label, actions, live, fail);
    }
    list.appendChild(item);
  }
  activateStation('images');
  if (!slots.length) {
    // zero-slot template: the station auto-completes (stays open so the note
    // and the advance affordance are visible — Done continues to refine)
    completeStation('images', { collapse: false });
  }
  // Nothing auto-generates (replaces the I4 auto-run): each slot waits for the
  // user to choose — AI generate, Upload, or Pick from library.
}

/** Unfilled slot ids (layerRole 'image-slot'; filled slots become 'image'). */
function unfilledSlotIds() {
  return (currentDesign?.design?.canvas?.objects || [])
    .filter((o) => o.layerRole === 'image-slot' && typeof o.slotId === 'string')
    .map((o) => o.slotId);
}

/**
 * Upload path: file picker → base64 → POST /api/images/upload (8MB, PNG/JPEG,
 * tagged with the poster's topic) → fill the slot with the new library image.
 */
function uploadIntoSlot(slotId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg';
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      flash($('imageSlotsStatus'), 'Image exceeds the 8MB upload limit.', false);
      return;
    }
    flash($('imageSlotsStatus'), `Uploading ${file.name}…`);
    try {
      const dataUri = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(fr.error || new Error('read failed'));
        fr.readAsDataURL(file);
      });
      const imageBase64 = dataUri.slice(dataUri.indexOf(',') + 1);
      const topic = currentState?.topic || '';
      const { image } = await postJson('/api/images/upload', {
        fileName: file.name, imageBase64, topics: topic ? [topic] : []
      });
      await fillSlot(slotId, 'library', image.image_id); // upload route returns the raw row (snake_case)
    } catch (err) {
      flash($('imageSlotsStatus'), `Upload failed: ${err.message}`, false);
    }
  });
  input.click();
}

async function fillSlot(slotId, source, imageId, prompt, customPrompt) {
  // remember the exact request so the failure card's [Try again] can repeat it
  lastFillArgs.set(slotId, { source, imageId, prompt });
  const row = slotRowEl(slotId);
  if (row) {
    row.querySelector('.slot-fail').classList.add('hidden');
    row.querySelector('.slot-fail').textContent = '';
  }
  flash($('imageSlotsStatus'), `Filling slot ${slotId}…`);
  watchProgress(imageStrip, (evt) => evt.runId === runId && evt.pipeline === 'image');
  try {
    const body = { source };
    if (imageId) body.imageId = imageId;
    if (prompt) body.prompt = prompt;
    // bg slot: include treatment override if user made a choice
    if (slotId === 'bg') {
      const t = bgTreatmentChoice.get('bg');
      if (t) body.treatment = t;
    }
    // customPrompt: the retry card's edited prompt wins; otherwise a pending
    // after-images reroute adjustment seeds the generation (≤500 by contract)
    const effectiveCustom = (customPrompt || imageSeedAdjustments || '').slice(0, 500);
    if (effectiveCustom && source !== 'library') body.customPrompt = effectiveCustom;
    const state = await postJson(`/api/images/slot/${posterId}/${encodeURIComponent(slotId)}`, body);
    flash($('imageSlotsStatus'), `Slot ${slotId} filled — image passed the zero-text gate.`);
    renderImageSlotsStep(state);
    // the poster changed — push BOTH refreshed canvases into the live preview
    // (the server mirrors slot fills into the landscape canvas for v2 designs)
    preview.set({ canvases: {
      portrait: state.design?.canvas || null,
      landscape: state.design?.landscapeCanvas || null
    } });
  } catch (err) {
    flash($('imageSlotsStatus'), err.message, false);
    if (err.code === 'IMAGE_RETRIES_EXHAUSTED') {
      showSlotFailure(slotId, {
        attempts: safeNumber(err.body?.attempts) ?? IMAGE_MAX_ATTEMPTS,
        lastReason: typeof err.body?.lastReason === 'string' ? err.body.lastReason : 'zero-text-gate'
      });
    }
  } finally {
    unwatchProgress();
    imageStrip.hide();
    const doneRow = slotRowEl(slotId);
    if (doneRow) doneRow.querySelector('.slot-live')?.classList.add('hidden');
  }
}

/**
 * O5 failure card: shown in the slot's row after a 409 IMAGE_RETRIES_EXHAUSTED.
 * "N attempts failed (reason)" + [Try again] + an optional prompt adjustment
 * (≤500 chars, live counter) that re-enters the same masked path as customPrompt.
 */
function showSlotFailure(slotId, { attempts, lastReason }) {
  const row = slotRowEl(slotId);
  if (!row) return;
  const fail = row.querySelector('.slot-fail');
  fail.textContent = '';

  const title = document.createElement('div');
  title.className = 'slot-fail-title';
  title.textContent = `${attempts} attempts failed (${IMAGE_FAIL_REASONS[lastReason] || lastReason})`;
  fail.appendChild(title);

  const label = document.createElement('label');
  label.textContent = 'Adjust the image prompt (optional — it re-enters the same masked generation path)';
  const textarea = document.createElement('textarea');
  textarea.maxLength = 500;
  textarea.rows = 2;
  textarea.placeholder = 'e.g. a flat-style illustration of a locked padlock, abstract shapes only';
  label.appendChild(textarea);
  fail.appendChild(label);

  const actions = document.createElement('div');
  actions.className = 'slot-fail-actions';
  const retryBtn = document.createElement('button');
  retryBtn.className = 'primary';
  retryBtn.textContent = 'Try again';
  const counter = document.createElement('span');
  counter.className = 'slot-fail-counter';
  counter.textContent = '0 / 500';
  textarea.addEventListener('input', () => {
    counter.textContent = `${textarea.value.length} / 500`;
  });
  retryBtn.addEventListener('click', () => {
    const args = lastFillArgs.get(slotId) || { source: 'generate' };
    fillSlot(slotId, args.source, args.imageId, args.prompt, textarea.value.trim());
  });
  actions.append(retryBtn, counter);
  fail.appendChild(actions);

  fail.classList.remove('hidden');
}

/**
 * O5 live attempt line: the image pipeline's SSE events for a slot render
 * "attempt N/5 — …" in that slot's row while generation runs.
 */
function trackImageSlotEvent(evt) {
  if (evt.pipeline !== 'image' || (runId && evt.runId !== runId)) return;
  const slotId = evt.payload?.slotId;
  const attempt = safeNumber(evt.payload?.attempt);
  if (typeof slotId !== 'string' || attempt === null) return;
  const row = slotRowEl(slotId);
  if (!row) return;
  const live = row.querySelector('.slot-live');
  if (!live) return;
  if (evt.type === 'rework') {
    const reason = typeof evt.payload?.reason === 'string' ? evt.payload.reason : 'zero-text-gate';
    live.textContent = `attempt ${attempt}/${IMAGE_MAX_ATTEMPTS} — retrying (${IMAGE_FAIL_REASONS[reason] || reason})`;
    live.classList.add('retrying');
    live.classList.remove('hidden');
  } else if (evt.type === 'stage_start' && evt.skill === 'generate_asset') {
    live.textContent = `attempt ${attempt}/${IMAGE_MAX_ATTEMPTS} — generating…`;
    live.classList.remove('retrying');
    live.classList.remove('hidden');
  }
}

async function openLibraryModal(slotId, promptForLibraryPlus, kind = '') {
  pendingLibrarySlotId = slotId;
  pendingLibraryPrompt = promptForLibraryPlus || '';
  libraryPickedImageId = null;
  $('confirmLibraryPick').disabled = true;
  $('libraryModalGrid').innerHTML = '';
  $('libraryModalStatus').textContent = '';
  $('libraryModalEmpty').classList.add('hidden');
  $('libraryModal').classList.remove('hidden');
  $('closeLibraryModal').focus(); // a11y: move focus into the dialog on open
  try {
    const topic = currentState?.topic || '';
    const params = new URLSearchParams();
    if (topic) params.set('topics', topic);
    if (kind) params.set('kind', kind);
    const qs = params.toString();
    const { images } = await api(`/api/images${qs ? `?${qs}` : ''}`);
    if (!images.length) {
      $('libraryModalEmpty').classList.remove('hidden');
      return;
    }
    for (const img of images) {
      const card = document.createElement('div');
      card.className = 'image-card';
      // a11y: selectable card — keyboard-activatable (shared delegated handler)
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.setAttribute('aria-pressed', 'false');
      const imgEl = document.createElement('img');
      imgEl.src = `/api/images/file/${encodeURIComponent(img.image_id)}`;
      imgEl.alt = img.style || 'library image';
      imgEl.loading = 'lazy';
      const chips = document.createElement('div');
      chips.className = 'topic-chips';
      let topicArr = [];
      try { topicArr = JSON.parse(img.topics || '[]'); } catch { /* unreadable tags stay hidden */ }
      for (const t of topicArr) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = t;
        chips.appendChild(chip);
      }
      card.append(imgEl, chips);
      card.addEventListener('click', () => {
        libraryPickedImageId = img.image_id;
        for (const el of $('libraryModalGrid').children) {
          el.classList.remove('selected');
          el.setAttribute('aria-pressed', 'false');
        }
        card.classList.add('selected');
        card.setAttribute('aria-pressed', 'true');
        $('confirmLibraryPick').disabled = false;
      });
      $('libraryModalGrid').appendChild(card);
    }
  } catch (err) {
    flash($('libraryModalStatus'), err.message, false);
  }
}

function closeLibraryModal() {
  $('libraryModal').classList.add('hidden');
  pendingLibrarySlotId = null;
  pendingLibraryPrompt = '';
  libraryPickedImageId = null;
}

$('closeLibraryModal').addEventListener('click', closeLibraryModal);

$('confirmLibraryPick').addEventListener('click', async () => {
  if (!libraryPickedImageId || !pendingLibrarySlotId) return;
  const slotId = pendingLibrarySlotId;
  const imageId = libraryPickedImageId;
  const prompt = pendingLibraryPrompt;
  closeLibraryModal();
  const source = prompt ? 'library-plus-prompt' : 'library';
  await fillSlot(slotId, source, imageId, prompt);
});

function imagesDone() {
  if (!currentDesign) return;
  imageSeedAdjustments = ''; // reroute adjustments were for this station only
  completeStation('images');
  enterRefineStation();
}

$('skipImageSlotsBtn').addEventListener('click', imagesDone);
$('doneWithImagesBtn').addEventListener('click', imagesDone);

// ── reroute panel (Phase O6): "Not happy? Reroute the pipeline" ─────────────
//
// Visible once content exists (renderApproval un-hides it). Flow: feedback →
// POST /api/pipeline/:posterId/reroute/suggest → suggestion card (checkpoint
// label + reasoning + adjustments, all textContent) → [Accept] or an override
// checkpoint pick + [Go] → POST .../reroute/execute → station states update
// from {reroutedTo, state} and the reactivated station re-renders.

const CHECKPOINT_LABELS = {
  'after-research': 'Re-research & re-pick angles',
  'after-content': 'Rewrite the content',
  'after-design': 'Recompile the design',
  'after-images': 'Regenerate the images'
};
const CHECKPOINT_STATION = {
  'after-research': 'research',
  'after-content': 'content',
  'after-design': 'design',
  'after-images': 'images'
};

let rerouteSuggestion = null; // {checkpoint, reasoning, adjustments} from /suggest

$('rerouteToggle').addEventListener('click', () => {
  const nowHidden = $('rerouteBody').classList.toggle('hidden');
  $('reroutePanel').classList.toggle('open', !nowHidden);
  $('rerouteToggle').setAttribute('aria-expanded', String(!nowHidden));
});

/** busy=false restores each control to its correct idle state (a suggestion
 *  and override options must exist before Accept/Go are usable). */
function setRerouteBusy(busy) {
  const hasOptions = $('rerouteOverrideSelect').options.length > 0;
  $('rerouteSuggestBtn').disabled = busy;
  $('rerouteSuggestBtn').classList.toggle('is-loading', busy);
  $('rerouteAcceptBtn').disabled = busy || !rerouteSuggestion;
  $('rerouteOverrideSelect').disabled = busy || !hasOptions;
  $('rerouteGoBtn').disabled = busy || !hasOptions || !rerouteSuggestion;
}

$('rerouteSuggestBtn').addEventListener('click', async () => {
  const feedback = $('rerouteFeedback').value.trim();
  if (!feedback) { flash($('rerouteStatus'), 'Describe what should be different first.', false); return; }
  setRerouteBusy(true);
  $('rerouteSuggestion').classList.add('hidden');
  rerouteSuggestion = null;
  flash($('rerouteStatus'), 'Asking the reroute agent…');
  try {
    const { suggestion, availableCheckpoints } =
      await postJson(`/api/pipeline/${encodeURIComponent(posterId)}/reroute/suggest`, { feedback });
    rerouteSuggestion = suggestion;
    renderRerouteSuggestion(suggestion, availableCheckpoints || []);
    flash($('rerouteStatus'), 'Suggestion ready — accept it or override the checkpoint.');
  } catch (err) {
    flash($('rerouteStatus'), err.message, false);
  } finally {
    setRerouteBusy(false);
  }
});

function renderRerouteSuggestion(suggestion, availableCheckpoints) {
  $('rerouteCheckpointLabel').textContent =
    CHECKPOINT_LABELS[suggestion.checkpoint] || suggestion.checkpoint;
  $('rerouteReasoning').textContent = suggestion.reasoning
    ? `Why: ${suggestion.reasoning}` : '';
  $('rerouteAdjustments').textContent = suggestion.adjustments
    ? `Adjustments the re-run will apply: ${suggestion.adjustments}` : '';
  const select = $('rerouteOverrideSelect');
  select.textContent = '';
  for (const cp of availableCheckpoints) {
    const opt = document.createElement('option');
    opt.value = cp;
    opt.textContent = CHECKPOINT_LABELS[cp] || cp;
    if (cp === suggestion.checkpoint) opt.selected = true;
    select.appendChild(opt);
  }
  $('rerouteSuggestion').classList.remove('hidden');
}

$('rerouteAcceptBtn').addEventListener('click', () => {
  if (rerouteSuggestion) executeRerouteUI(rerouteSuggestion.checkpoint);
});

$('rerouteGoBtn').addEventListener('click', () => {
  const checkpoint = $('rerouteOverrideSelect').value;
  if (rerouteSuggestion && checkpoint) executeRerouteUI(checkpoint);
});

async function executeRerouteUI(checkpoint) {
  const feedback = $('rerouteFeedback').value.trim();
  const adjustments = String(rerouteSuggestion?.adjustments || '').slice(0, 2000);
  if (!feedback || !adjustments) {
    flash($('rerouteStatus'), ERROR_MESSAGES.INVALID_ADJUSTMENTS, false);
    return;
  }
  setRerouteBusy(true);
  flash($('rerouteStatus'), `Rerouting — jumping back to “${CHECKPOINT_LABELS[checkpoint] || checkpoint}”…`);
  try {
    const result = await postJson(
      `/api/pipeline/${encodeURIComponent(posterId)}/reroute/execute`,
      { feedback, checkpoint, adjustments }
    );
    await applyReroute(result);
    rerouteSuggestion = null;
    $('rerouteFeedback').value = '';
    $('rerouteSuggestion').classList.add('hidden');
    flash($('rerouteStatus'), `Rerouted — the pipeline jumped back to “${CHECKPOINT_LABELS[result.reroutedTo] || result.reroutedTo}”.`);
  } catch (err) {
    flash($('rerouteStatus'), err.message, false);
  } finally {
    setRerouteBusy(false);
  }
}

/** Downstream stations of the reactivated one go back to pending (collapsed). */
function resetStationsAfter(stationId) {
  const from = STATION_IDS.indexOf(stationId);
  for (const id of STATION_IDS.slice(from + 1)) {
    // the refine station hosts the inline editor — tear it down (flushes its
    // autosave) before the station goes back to pending
    if (id === 'refine') unmountInlineEditor();
    setStationState(id, 'pending');
    openStation(id, false);
  }
}

/**
 * Apply an executed reroute: rewind the station states, feed the returned
 * safe state into the existing station-render functions (they activate and
 * auto-scroll to the reactivated station), and reconcile the live preview.
 */
async function applyReroute({ reroutedTo, adjustments, state }) {
  const stationId = CHECKPOINT_STATION[reroutedTo];
  if (!stationId || !state) return;
  resetStationsAfter(stationId);

  if (reroutedTo === 'after-research') {
    currentState = state;
    currentDesign = null;
    designAccepted = false;
    imageSeedAdjustments = '';
    unlockContentStation();
    // design rolled back — drop the stale canvas, keep the template preview
    preview.set({ content: null, canvases: { portrait: null, landscape: null } });
    renderAngles(state);
    return;
  }

  if (reroutedTo === 'after-content') {
    currentDesign = null;
    designAccepted = false;
    imageSeedAdjustments = '';
    unlockContentStation();
    preview.set({ canvases: { portrait: null, landscape: null } });
    renderApproval(state); // sets currentState + pushes content into the preview
    return;
  }

  if (reroutedTo === 'after-design') {
    designAccepted = false;
    imageSeedAdjustments = '';
    const seed = String(adjustments || '').slice(0, 2000);
    $('retryPrompt').value = seed;
    $('dynamicPrompt').value = seed;
    $('designAutoNote').textContent = 'Rerouted back to design — the suggested adjustments are '
      + 'prefilled in the instruction fields below. Re-apply a template or run the AI redesign.';
    // the reroute explicitly asks for a design change — surface the template
    // options that normally sit collapsed behind "Change template…" (I2)
    showChangeTemplateToggle(true);
    setChangeTemplateOpen(true);
    activateStation('design');
    await showDesignResult(state); // currentDesign = state, canvas → preview
    return;
  }

  // after-images: same design, slot fills cleared — adjustments seed generation
  imageSeedAdjustments = String(adjustments || '').slice(0, 500);
  renderImageSlotsStep(state); // currentDesign = state, activates the station
  preview.set({ canvases: { portrait: state.design?.canvas || null, landscape: null } });
}

// ── station 7: refine (inline editor — EditorInline mounts here, O7) ────────
//
// Station expand → EditorInline.mount into #editorMount; every editor edit
// pushes { canvases: { portrait } } into the live preview (debounced ~100ms
// in the component). Station collapse / continue / reroute-reset → unmount,
// which flushes the editor's own autosave first. Landscape stays the compiled
// view-only canvas (design v2) or the template preview — editing it is out of
// scope this phase.

let inlineEditorMounted = false;

async function mountInlineEditor() {
  if (inlineEditorMounted || !posterId || !window.EditorInline) return;
  inlineEditorMounted = true;
  // content: null — the preview must mirror the editor canvas VERBATIM while
  // editing (the engine's content text-patching would revert live text edits
  // to the last approved copy). Landscape: pass the compiled canvas when the
  // design carries one (v2), else the engine keeps the template preview.
  preview.set({
    content: null,
    canvases: { landscape: currentDesign?.design?.landscapeCanvas || null }
  });
  try {
    await window.EditorInline.mount({
      container: $('editorMount'),
      posterId,
      onStateChange: (patch) => preview.set(patch),
      // the component fetched FRESH design state to boot — if this design
      // carries a compiled landscape canvas (v2), mirror it into the right
      // rail so both orientations show while refining (portrait mirrors live
      // via onStateChange; landscape stays the view-only compiled canvas)
      onLoaded: (state) => {
        preview.set({ canvases: { landscape: state.design?.landscapeCanvas || null } });
      }
    });
  } catch (err) {
    inlineEditorMounted = false;
    console.error('inline editor mount failed', err);
  }
}

async function unmountInlineEditor() {
  if (!inlineEditorMounted || !window.EditorInline) return;
  inlineEditorMounted = false;
  await window.EditorInline.unmount(); // flushes the editor's autosave first
}

function enterRefineStation() {
  activateStation('refine');
  const link = $('openEditorLink');
  link.href = `editor.html?posterId=${encodeURIComponent(posterId)}`;
  link.classList.remove('hidden');
  mountInlineEditor();
}

// Reopening/collapsing the completed station via its header re-mounts /
// unmounts the editor. Runs after the generic toggle handler (registration
// order), so the class already reflects the new open state.
stationEl('refine').querySelector('.station-head').addEventListener('click', () => {
  const li = stationEl('refine');
  if (li.dataset.state === 'pending' || !posterId) return;
  if (li.classList.contains('open')) mountInlineEditor();
  else unmountInlineEditor();
});

$('refineDoneBtn').addEventListener('click', async () => {
  $('refineDoneBtn').disabled = true;
  try {
    await unmountInlineEditor(); // flush autosave before moving on
  } finally {
    $('refineDoneBtn').disabled = false;
  }
  completeStation('refine');
  activateStation('save');
  if (!$('saveNameInput').value.trim()) {
    $('saveNameInput').value = currentDesign?.name || currentState?.topic || '';
  }
  $('saveNameInput').focus();
});

// ── station 8: save (name + feedback prompt, ported from the editor flow) ───

$('savePosterBtn').addEventListener('click', async () => {
  const name = $('saveNameInput').value.trim();
  if (!name) { flash($('savePosterStatus'), 'Name cannot be empty.', false); return; }
  $('savePosterBtn').disabled = true;
  $('savePosterBtn').classList.add('is-loading');
  flash($('savePosterStatus'), 'Saving…');
  try {
    const result = await postJson(`/api/posters/${encodeURIComponent(posterId)}/save`, { name });
    flash($('savePosterStatus'), `Saved as "${result.name}".`);
    $('savedSummary').textContent = `“${result.name}” is saved in the library — rate the result below, then translate or export.`;
    $('savedSummary').classList.remove('hidden');
    $('saveFeedbackBlock').classList.remove('hidden');
    completeStation('save', { collapse: false });
  } catch (err) {
    flash($('savePosterStatus'), err.message, false);
  } finally {
    $('savePosterBtn').classList.remove('is-loading');
    $('savePosterBtn').disabled = false;
  }
});

let pendingFeedbackRating = null;

function pickFeedbackRating(rating) {
  pendingFeedbackRating = rating;
  $('feedbackGoodBtn').classList.toggle('primary', rating === 'good');
  $('feedbackBadBtn').classList.toggle('primary', rating === 'bad');
  $('feedbackRemarksWrap').classList.remove('hidden');
  $('feedbackRemarks').focus();
}

$('feedbackGoodBtn').addEventListener('click', () => pickFeedbackRating('good'));
$('feedbackBadBtn').addEventListener('click', () => pickFeedbackRating('bad'));

function advanceToTranslate() {
  openStation('save', false);
  activateStation('translate');
  enterTranslateStation();
}

$('skipFeedbackBtn').addEventListener('click', advanceToTranslate);

$('submitFeedbackBtn').addEventListener('click', async () => {
  if (!pendingFeedbackRating) return;
  const rating = pendingFeedbackRating;
  const remarks = $('feedbackRemarks').value.trim();
  for (const id of ['feedbackGoodBtn', 'feedbackBadBtn', 'submitFeedbackBtn']) $(id).disabled = true;
  flash($('posterFeedbackStatus'), 'Sending…');
  try {
    await postJson(`/api/posters/${encodeURIComponent(posterId)}/feedback`,
      { rating, ...(remarks ? { remarks } : {}) });
    flash($('posterFeedbackStatus'), 'Thanks for the feedback!');
    setTimeout(advanceToTranslate, 900);
  } catch (err) {
    flash($('posterFeedbackStatus'), err.message, false);
    for (const id of ['feedbackGoodBtn', 'feedbackBadBtn', 'submitFeedbackBtn']) $(id).disabled = false;
  }
});

// ── station 9: translate (ported from the editor's translate modal) ─────────

const translateStrip = new ProgressStrip($('translateProgress'), {});
let translationMeta = null;   // GET /api/translation/meta/languages
let translationState = null;  // GET /api/translation/:posterId (safe state)
const langLive = new Map();   // lang -> live status from SSE (translating/rework/done/failed)

async function enterTranslateStation() {
  try { translationMeta = await api('/api/translation/meta/languages'); } catch { translationMeta = null; }
  try { translationState = await api(`/api/translation/${encodeURIComponent(posterId)}`); } catch { translationState = null; }
  buildTranslateTargets();
  renderLangStatuses();
}

/** Find the translation entry for a given lang id in the current state. */
function variantStatus(langId) {
  if (!translationState) return null;
  return (translationState.languages || []).find((l) => l.lang === langId) || null;
}

/** Radio "All languages" + one checkbox per target language. */
function buildTranslateTargets() {
  const container = $('translateTargets');
  container.textContent = '';
  if (!translationMeta) {
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = 'Language list unavailable — is the poster app running?';
    container.appendChild(note);
    return;
  }

  const allLabel = document.createElement('label');
  const allRadio = document.createElement('input');
  allRadio.type = 'radio';
  allRadio.name = 'translateScope';
  allRadio.value = 'all';
  allRadio.checked = true;
  allLabel.append(allRadio, document.createTextNode(' All languages'));
  container.appendChild(allLabel);

  const orLabel = document.createElement('label');
  orLabel.style.color = 'var(--muted)';
  orLabel.style.fontSize = '12px';
  orLabel.textContent = 'or select individual languages:';
  container.appendChild(orLabel);

  for (const lang of translationMeta.languages) {
    if (lang.id === 'en') continue;
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.name = 'translateLang';
    cb.value = lang.id;
    cb.addEventListener('change', () => {
      allRadio.checked = false;
      updateTranslateBtn();
    });
    const chip = document.createElement('span');
    const vs = variantStatus(lang.id);
    chip.className = 'lang-status-chip' + (vs ? ` ${vs.status}` : '');
    chip.textContent = vs ? vs.status : 'not translated';
    label.append(cb, document.createTextNode(` ${lang.label} `), chip);
    container.appendChild(label);
  }

  allRadio.addEventListener('change', () => {
    for (const cb of container.querySelectorAll('input[name="translateLang"]')) cb.checked = false;
    updateTranslateBtn();
  });
  updateTranslateBtn();
}

function updateTranslateBtn() {
  const container = $('translateTargets');
  const allRadio = container.querySelector('input[value="all"]');
  const anyChecked = [...container.querySelectorAll('input[name="translateLang"]')].some((cb) => cb.checked);
  $('startTranslateBtn').disabled = !(allRadio && allRadio.checked) && !anyChecked;
}

/** Per-language status chips: persisted state overlaid with live SSE status. */
function renderLangStatuses() {
  const list = $('langStatusList');
  list.textContent = '';
  const langs = translationMeta?.languages || [];
  const statuses = new Map();
  for (const l of translationState?.languages || []) statuses.set(l.lang, l.status);
  for (const [lang, status] of langLive) statuses.set(lang, status);
  for (const lang of langs) {
    if (lang.id === 'en' || !statuses.has(lang.id)) continue;
    const status = statuses.get(lang.id);
    const chip = document.createElement('span');
    chip.className = `lang-status-chip ${String(status).replace(/[^a-z-]/gi, '')}`;
    chip.textContent = `${lang.label}: ${status}`;
    list.appendChild(chip);
  }
}

/** Live per-language progress from the translation pipeline's SSE events. */
function trackTranslationEvent(evt) {
  if (evt.pipeline !== 'translation' || (runId && evt.runId !== runId)) return;
  const m = /^translate:(.+)$/.exec(evt.stage || '');
  if (!m) return;
  const lang = m[1];
  if (evt.type === 'stage_start') langLive.set(lang, 'translating');
  else if (evt.type === 'rework') langLive.set(lang, 'rework');
  else if (evt.type === 'stage_end') langLive.set(lang, 'done');
  else if (evt.type === 'error') langLive.set(lang, 'failed');
  else return;
  renderLangStatuses();
}

$('startTranslateBtn').addEventListener('click', async () => {
  const container = $('translateTargets');
  const allRadio = container.querySelector('input[value="all"]');
  let languages;
  if (allRadio && allRadio.checked) {
    languages = 'all';
  } else {
    languages = [...container.querySelectorAll('input[name="translateLang"]:checked')].map((cb) => cb.value);
    if (!languages.length) return;
  }
  $('startTranslateBtn').disabled = true;
  $('startTranslateBtn').classList.add('is-loading');
  $('skipTranslateBtn').disabled = true;
  flash($('translateStatus'), 'Translating (fidelity-gated per language — this can take a while)…');
  watchProgress(translateStrip, (evt) => evt.runId === runId && evt.pipeline === 'translation');
  try {
    const state = await postJson(`/api/translation/${encodeURIComponent(posterId)}/start`, { languages });
    translationState = state;
    renderLangStatuses();
    buildTranslateTargets();
    const failed = state.failed || [];
    if (failed.length) {
      const names = failed.map((f) => {
        const meta = (translationMeta?.languages || []).find((l) => l.id === f.lang);
        return meta ? meta.label : f.lang;
      });
      flash($('translateStatus'), `Some languages failed (${names.join(', ')}) — select them and translate again.`, false);
    } else {
      flash($('translateStatus'), 'Translation complete.');
    }
    $('translateDoneRow').classList.remove('hidden');
  } catch (err) {
    flash($('translateStatus'), err.message, false);
  } finally {
    unwatchProgress();
    translateStrip.hide();
    $('startTranslateBtn').classList.remove('is-loading');
    $('startTranslateBtn').disabled = false;
    $('skipTranslateBtn').disabled = false;
    updateTranslateBtn();
  }
});

function translateDone() {
  completeStation('translate');
  activateStation('export');
  enterExportStation();
}

$('skipTranslateBtn').addEventListener('click', translateDone);
$('translateDoneBtn').addEventListener('click', translateDone);

// ── station 10: export (O9 engine — window.PosterExport, fully client-side) ─
//
// Controls: orientation (Landscape enabled only when the design carries a
// compiled landscape canvas AND English is selected — translation variants
// are portrait-only today), language ('English' + every translated variant),
// and PPT / HTML / JPEG buttons. Canvas data is re-fetched from the server at
// export time: the refine editor autosaves server-side, so client state can
// lag behind what is actually persisted.

const EXPORT_BTN_IDS = ['exportPptBtn', 'exportHtmlBtn', 'exportJpegBtn'];
const LANDSCAPE_NEEDS_V2 = 'This design has no landscape canvas — it compiles at design v2.';
const LANDSCAPE_VARIANT_MISSING = 'This translation predates the landscape design — re-translate the language to get a landscape variant.';

let exportHasLandscape = false; // fresh design state carries design.landscapeCanvas

/** Landscape is exportable only for the English design with a landscape canvas. */
function updateExportControls() {
  const orientSel = $('exportOrientation');
  const landscapeOpt = orientSel.querySelector('option[value="landscape"]');
  // Landscape is exportable whenever the design carries a landscape canvas —
  // translated variants carry landscapeCanvas too (O10); a pre-O10 variant
  // without one fails gracefully at export time with a specific message.
  const enabled = exportHasLandscape;
  landscapeOpt.disabled = !enabled;
  // tooltip on the option AND the select — option titles are flaky cross-browser
  const tooltip = enabled ? '' : LANDSCAPE_NEEDS_V2;
  landscapeOpt.title = tooltip;
  orientSel.title = tooltip;
  if (!enabled && orientSel.value === 'landscape') orientSel.value = 'portrait';
}

/** 'English' + one option per translated/edited variant (labels from meta). */
function populateExportLanguages() {
  const sel = $('exportLanguage');
  const prev = sel.value || 'en';
  sel.textContent = '';
  const en = document.createElement('option');
  en.value = 'en';
  en.textContent = 'English';
  sel.appendChild(en);
  for (const v of translationState?.languages || []) {
    const meta = (translationMeta?.languages || []).find((l) => l.id === v.lang);
    const opt = document.createElement('option');
    opt.value = v.lang;
    opt.textContent = meta ? meta.label : v.lang;
    sel.appendChild(opt);
  }
  sel.value = [...sel.options].some((o) => o.value === prev) ? prev : 'en';
}

/** Entering the station refreshes design + translation state from the server. */
async function enterExportStation() {
  if (!posterId) return;
  try {
    const state = await api(`/api/design/${encodeURIComponent(posterId)}`);
    exportHasLandscape = Boolean(state.design?.landscapeCanvas);
  } catch {
    exportHasLandscape = false; // export re-checks; landscape greys out meanwhile
  }
  if (!translationMeta) {
    try { translationMeta = await api('/api/translation/meta/languages'); } catch { translationMeta = null; }
  }
  try {
    translationState = await api(`/api/translation/${encodeURIComponent(posterId)}`);
  } catch { /* keep the translate station's last known state */ }
  populateExportLanguages();
  updateExportControls();
}

function setExportBusy(busy) {
  for (const id of EXPORT_BTN_IDS) $(id).disabled = busy;
}

async function runExport(kind) {
  if (!posterId) {
    flash($('exportStatus'), 'Nothing to export yet — run the pipeline first.', false);
    return;
  }
  const lang = $('exportLanguage').value || 'en';
  const sel = $('exportOrientation').value;
  const orientation = sel === 'landscape' ? 'landscape' : sel === 'both' ? 'both' : 'portrait';
  setExportBusy(true);
  flash($('exportStatus'), 'Preparing the export…');
  try {
    // fresh design state EVERY export: poster name + persisted canvases
    const state = await api(`/api/design/${encodeURIComponent(posterId)}`);
    exportHasLandscape = Boolean(state.design?.landscapeCanvas);
    // resolve both canvases up front (both-mode needs the pair; single-mode picks one)
    let pCanvas;
    let lCanvas;
    if (lang === 'en') {
      pCanvas = state.design?.canvas || null;
      lCanvas = state.design?.landscapeCanvas || null;
    } else {
      // translated variants carry BOTH orientations (O10); a variant created
      // before the landscape design existed only has the portrait canvas
      const variant = await api(`/api/translation/${encodeURIComponent(posterId)}/${encodeURIComponent(lang)}`);
      pCanvas = variant?.canvas || null;
      lCanvas = variant?.landscapeCanvas || null;
    }
    // the Save station's name feeds the filename; server name, then 'poster'
    const name = $('saveNameInput').value.trim() || state.name || 'poster';

    if (orientation === 'both') {
      if (!pCanvas || !lCanvas) {
        throw new Error(lang === 'en'
          ? 'Both-orientation export needs the landscape design too — it compiles at design v2.'
          : LANDSCAPE_VARIANT_MISSING);
      }
      const bothJob = { portraitCanvas: pCanvas, landscapeCanvas: lCanvas, name, lang };
      if (kind === 'pptx') await window.PosterExport.toPptxBoth(bothJob);
      else if (kind === 'jpeg') await window.PosterExport.toJpegBoth(bothJob);
      else { // HTML: two self-contained files, one per orientation
        await window.PosterExport.toHtml({ canvasJSON: pCanvas, orientation: 'portrait', name, lang });
        await window.PosterExport.toHtml({ canvasJSON: lCanvas, orientation: 'landscape', name, lang });
      }
      flash($('exportStatus'), `${kind.toUpperCase()} downloads started — one file per orientation.`);
      return;
    }

    const canvasJSON = orientation === 'landscape' ? lCanvas : pCanvas;
    if (!canvasJSON) {
      throw new Error(orientation === 'landscape' && lang !== 'en'
        ? LANDSCAPE_VARIANT_MISSING
        : 'No canvas exists for that orientation/language — pick another combination.');
    }
    const job = { canvasJSON, orientation, name, lang };
    if (kind === 'pptx') await window.PosterExport.toPptx(job);
    else if (kind === 'html') await window.PosterExport.toHtml(job);
    else await window.PosterExport.toJpeg(job);
    flash($('exportStatus'), `${kind.toUpperCase()} download started.`);
  } catch (err) {
    flash($('exportStatus'), err.message, false);
  } finally {
    setExportBusy(false);
    updateExportControls();
  }
}

$('exportLanguage').addEventListener('change', updateExportControls);
$('exportPptBtn').addEventListener('click', () => runExport('pptx'));
$('exportHtmlBtn').addEventListener('click', () => runExport('html'));
$('exportJpegBtn').addEventListener('click', () => runExport('jpeg'));

$('newPosterBtn').addEventListener('click', () => {
  // full reset of ten stations + rails: a clean reload is the reliable path
  // (session token persists in sessionStorage, so auth survives)
  location.reload();
});

// ── boot ────────────────────────────────────────────────────────────────────

// Auth probe + early template gallery in one call (GET /api/pipeline/templates
// is poster-independent). A 401 surfaces the banner via api(); other errors
// leave the gallery in its graceful fallback note.
loadEarlyTemplateGallery();
