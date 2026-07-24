// Usage & Cost page — standalone token-usage dashboard. Pick a poster; see
// per-stage token consumption, model-tier chips, and estimated cost. Reads
// GET /api/posters (selector) and GET /api/usage/:posterId (counts only).
// All values render via textContent (XSS discipline).

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  async function api(path) {
    const res = await fetch(path, window.authOptions(null));
    if (res.status === 401) {
      $('authBanner').classList.remove('hidden');
      const err = new Error('unauthorized');
      err.code = 'UNAUTHORIZED';
      throw err;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── model + stage metadata (mirror of create_page's usage dashboard) ───────

  const USAGE_MODELS = {
    'gpt-4o': { name: 'GPT-4o', tier: 'text', inRate: 2.5, outRate: 10 },
    'gpt-image-1': { name: 'GPT Image', tier: 'image', inRate: 5, outRate: 40 }
  };
  function modelMeta(id) {
    if (USAGE_MODELS[id]) return USAGE_MODELS[id];
    const name = String(id || 'model').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return { name, tier: 'other', inRate: 2.5, outRate: 10 };
  }
  const STAGE_LABELS = {
    'keyword-intent': 'Intent', 'research-synthesis': 'Research', 'research': 'Research',
    'content-loop': 'Content writing', 'content-review': 'Content review',
    'design-loop': 'Design', 'design-review': 'Design review', 'art-direction': 'Art direction',
    'background-decision': 'Background', 'slot-fill': 'Image generation',
    'zero-text-gate': 'Image review', 'refine': 'Refine', 'translation': 'Translation'
  };
  function stageLabel(stage) {
    if (STAGE_LABELS[stage]) return STAGE_LABELS[stage];
    return String(stage || 'stage').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  function rowCost(r) {
    const m = modelMeta(r.model);
    return (r.inTok / 1e6) * m.inRate + (r.outTok / 1e6) * m.outRate;
  }
  function fmtCost(v) {
    if (v <= 0) return '$0.00';
    if (v < 0.01) return '<$0.01';
    return `$${v.toFixed(v < 1 ? 3 : 2)}`;
  }

  // ── render ─────────────────────────────────────────────────────────────────

  function renderDashboard({ rows, totals }) {
    const stagesEl = $('usageStages');
    const empty = $('usageEmpty');
    const grandTotal = totals.inTok + totals.outTok;
    const estCost = rows.reduce((a, r) => a + rowCost(r), 0);

    $('usageCardTotal').textContent = grandTotal.toLocaleString();
    $('usageCardIn').textContent = totals.inTok.toLocaleString();
    $('usageCardOut').textContent = totals.outTok.toLocaleString();
    $('usageCardCalls').textContent = totals.calls.toLocaleString();
    $('usageCardCost').textContent = fmtCost(estCost);

    stagesEl.textContent = '';
    if (!rows.length) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');

    // group by stage, sort by total tokens desc
    const byStage = new Map();
    for (const r of rows) {
      const key = `${r.pipeline}/${r.stage}`;
      if (!byStage.has(key)) byStage.set(key, { stage: r.stage, calls: 0, inTok: 0, outTok: 0, models: new Set() });
      const g = byStage.get(key);
      g.calls += r.calls; g.inTok += r.inTok; g.outTok += r.outTok;
      if (r.model) g.models.add(r.model);
    }
    const groups = [...byStage.values()]
      .map((g) => ({ ...g, total: g.inTok + g.outTok, cost: rowCost({ model: [...g.models][0], inTok: g.inTok, outTok: g.outTok }) }))
      .sort((a, b) => b.total - a.total);
    const maxTotal = Math.max(1, ...groups.map((g) => g.total));

    for (const g of groups) {
      const row = document.createElement('div');
      row.className = 'usage-stage-row';

      const head = document.createElement('div');
      head.className = 'usage-stage-head';
      const label = document.createElement('span');
      label.className = 'usage-stage-name';
      label.textContent = stageLabel(g.stage);
      head.appendChild(label);
      for (const modelId of g.models) {
        const meta = modelMeta(modelId);
        const chip = document.createElement('span');
        chip.className = `usage-tier-chip usage-tier-${meta.tier}`;
        chip.textContent = meta.name;
        head.appendChild(chip);
      }
      const share = grandTotal ? Math.round((g.total / grandTotal) * 100) : 0;
      const totalTok = document.createElement('span');
      totalTok.className = 'usage-stage-total';
      totalTok.textContent = `${g.total.toLocaleString()} · ${share}%`;
      head.appendChild(totalTok);
      row.appendChild(head);

      const meter = document.createElement('div');
      meter.className = 'usage-meter';
      const fill = document.createElement('div');
      fill.className = 'usage-meter-fill';
      fill.style.width = `${Math.max(2, Math.round((g.total / maxTotal) * 100))}%`;
      meter.appendChild(fill);
      row.appendChild(meter);

      const sub = document.createElement('div');
      sub.className = 'usage-stage-sub';
      sub.textContent = `${g.calls.toLocaleString()} call${g.calls === 1 ? '' : 's'} · ${g.inTok.toLocaleString()} in · ${g.outTok.toLocaleString()} out · ${fmtCost(g.cost)}`;
      row.appendChild(sub);

      stagesEl.appendChild(row);
    }
  }

  async function loadUsageFor(posterId) {
    if (!posterId) return;
    try {
      const data = await api(`/api/usage/${encodeURIComponent(posterId)}`);
      renderDashboard(data);
    } catch (err) {
      if (err.code !== 'UNAUTHORIZED') $('usageEmpty').classList.remove('hidden');
    }
  }

  // ── poster selector ──────────────────────────────────────────────────────

  function posterOptionLabel(p) {
    const base = p.name || p.headline || p.topic || 'Untitled poster';
    return p.topic && p.topic !== base ? `${base} — ${p.topic}` : base;
  }

  /** Overview table: every metered poster with totals + estimated cost.
   *  Rows click through to the per-poster detail below. */
  async function renderOverview(select) {
    let rows = [];
    try {
      ({ posters: rows } = await api('/api/usage'));
    } catch { return; }
    const body = $('usageOverviewBody');
    body.textContent = '';
    if (!rows.length) {
      $('usageOverviewEmpty').classList.remove('hidden');
      return;
    }
    $('usageOverviewEmpty').classList.add('hidden');
    for (const r of rows) {
      const total = r.inTok + r.outTok;
      // split text vs image tokens so each is costed at its model's rate
      const cost = ((r.inTok - r.imgIn) / 1e6) * 2.5 + ((r.outTok - r.imgOut) / 1e6) * 10
        + (r.imgIn / 1e6) * 5 + (r.imgOut / 1e6) * 40;
      const tr = document.createElement('tr');
      tr.className = 'usage-ov-row';
      tr.tabIndex = 0;
      tr.setAttribute('role', 'button');
      const cells = [
        r.name || 'Untitled', r.calls.toLocaleString(), r.inTok.toLocaleString(),
        r.outTok.toLocaleString(), total.toLocaleString(), fmtCost(cost)
      ];
      for (const c of cells) {
        const td = document.createElement('td');
        td.textContent = c;
        tr.appendChild(td);
      }
      const pick = () => {
        select.value = r.posterId;
        loadUsageFor(r.posterId);
        document.querySelector('.usage-toolbar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      tr.addEventListener('click', pick);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      body.appendChild(tr);
    }
  }

  async function init() {
    const select = $('usagePosterSelect');
    let posters = [];
    try {
      ({ posters } = await api('/api/posters'));
    } catch (err) {
      if (err.code === 'UNAUTHORIZED') return;
    }
    renderOverview(select); // non-blocking; fills the all-posters table
    if (!posters.length) {
      $('usagePanelPage').classList.add('hidden');
      document.querySelector('.usage-toolbar')?.classList.add('hidden');
      $('usageNoPosters').classList.remove('hidden');
      return;
    }
    for (const p of posters) {
      const opt = document.createElement('option');
      opt.value = p.posterId;
      opt.textContent = posterOptionLabel(p);
      select.appendChild(opt);
    }
    select.addEventListener('change', () => loadUsageFor(select.value));
    $('usageRefreshBtn').addEventListener('click', () => loadUsageFor(select.value));
    // deep-link from the create page: ?poster=<id> preselects that poster
    const wanted = new URLSearchParams(location.search).get('poster');
    const initial = (wanted && posters.some((p) => p.posterId === wanted)) ? wanted : posters[0].posterId;
    select.value = initial;
    await loadUsageFor(initial); // newest first unless deep-linked (API orders by updated_at desc)
  }

  init();
})();
