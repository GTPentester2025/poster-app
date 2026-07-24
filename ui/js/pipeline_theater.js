// Pipeline Theater — a live, high-grade view of the agent pipeline.
// window.PipelineTheater = { begin(label), end(), onEvent(evt), isOpen() }.
//
// While any pipeline call is in flight (begin/end are refcounted around the
// awaits), the screen dims behind a theater overlay showing:
//   • a metro stage strip — six stops (Intent → Research → Writing → Design →
//     Images → Delivery) that advance with green checks, flash red + run a
//     backward dot on rework. Completion is MONOTONIC: any stage_end greens a
//     stop, AND the first stage_start of a later column greens every earlier
//     stop (so a missed end event can never strand a stage);
//   • THE PIPELINE GRAPH, rendered in full the moment the overlay opens:
//     fixed stage columns, agents laid out inside each column (compact
//     icon+name chips, two-per-row where a column is crowded), thin SVG
//     connectors wiring the flow, slim connector nodes (context-refiner,
//     stage-qa) sitting BETWEEN columns. Nodes never pop in — they only
//     change STATE (idle → active → passed / rework);
//   • explicit message passing — a DATA PACKET travels sender → receiver along
//     the drawn rail. The packet is a labelled pill ("keywords", "context",
//     "draft", "verdict 96", "canvas", "image", "translation") derived from the
//     event, riding a comet trail. On arrival the receiver's status dot blips
//     and a "received" ring expands. Rejections send a RED "rework ×N" pill
//     BACKWARD;
//   • repetition legibility — a re-run of the same agent lights an iteration
//     chip (×2, ×3…) and spawns a short echo-outline pulse; per-slot image runs
//     show a "slot 2/4"-style sub-caption from payload.slotId;
//   • continuous life — the active node breathes with rising bubbles and a
//     beer-pour indeterminate progress bar runs the whole time;
//   • a single caption line narrating the latest moment.
//
// Self-contained: builds its own DOM under document.body; styles in
// css/theater.css. All user/model text renders via textContent (XSS rule).
// prefers-reduced-motion: travel/pulse are skipped, state colours remain.

(function () {
  'use strict';

  const reduceMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── the fixed pipeline graph ─────────────────────────────────────────────
  // Six sequential stage columns. Each column holds one or more agent nodes.
  // `kind:'sub'` nodes are the slim connector agents (context-refiner,
  // stage-qa) between the main beats; `kind:'gate'` is the zero-text gate.
  // The whole structure renders upfront; events only flip node STATE.

  const COLUMNS = [
    {
      id: 'intent', label: 'Intent',
      nodes: [
        { id: 'harness', label: 'Harness', glyph: 'H', kind: 'main' },
        { id: 'keyword-intent', label: 'Intent', glyph: 'I', kind: 'main' },
        // the meta-reviewer that audits every stage's outgoing prompts
        { id: 'overseer', label: 'Overseer', glyph: '◉', kind: 'sub' }
      ]
    },
    {
      id: 'research', label: 'Research',
      nodes: [
        { id: 'rag-research', label: 'Research', glyph: 'R', kind: 'main' },
        { id: 'context-refiner', label: 'Refiner', glyph: '⋯', kind: 'sub' }
      ]
    },
    {
      id: 'writing', label: 'Writing',
      nodes: [
        { id: 'content-generator', label: 'Writer', glyph: 'W', kind: 'main' },
        { id: 'content-reviewer', label: 'Reviewer', glyph: 'V', kind: 'main' },
        { id: 'stage-qa', label: 'Stage QA', glyph: '✓', kind: 'sub' }
      ]
    },
    {
      id: 'design', label: 'Design',
      nodes: [
        { id: 'template-recommender', label: 'Template', glyph: 'P', kind: 'main' },
        { id: 'design-recommender', label: 'Designer', glyph: 'D', kind: 'main' },
        { id: 'design-reviewer', label: 'Reviewer', glyph: 'V', kind: 'main' },
        { id: 'design-compiler', label: 'Compiler', glyph: 'K', kind: 'main' },
        { id: 'art-director', label: 'Art dir.', glyph: 'A', kind: 'main' },
        { id: 'background-director', label: 'Backdrop', glyph: 'B', kind: 'main' }
      ]
    },
    {
      id: 'images', label: 'Images',
      nodes: [
        { id: 'image-concept', label: 'Concept', glyph: 'C', kind: 'main' },
        { id: 'image-generator', label: 'Generator', glyph: 'G', kind: 'main' },
        { id: 'zero-text', label: 'Zero-text', glyph: '0', kind: 'gate' },
        { id: 'image-quality-reviewer', label: 'Quality', glyph: 'Q', kind: 'main' },
        { id: 'image-pipeline', label: 'Slot fill', glyph: 'F', kind: 'main' },
        { id: 'image-tagger', label: 'Tagger', glyph: 'T', kind: 'sub' }
      ]
    },
    {
      id: 'delivery', label: 'Delivery',
      nodes: [
        { id: 'translation-agent', label: 'Translation', glyph: 'L', kind: 'main' },
        { id: 'terminology-validator', label: 'Terminology', glyph: 'Y', kind: 'sub' },
        { id: 'poster-editor', label: 'Editor', glyph: 'E', kind: 'main' },
        { id: 'edit-learning', label: 'Edit learn', glyph: 'J', kind: 'sub' },
        { id: 'learning-memory', label: 'Memory', glyph: 'M', kind: 'main' },
        { id: 'user', label: 'You', glyph: '★', kind: 'main' }
      ]
    }
  ];

  // Connectors: [fromNodeId, toNodeId]. Drawn as thin SVG paths; also the rails
  // packets travel along. Kept in flow order so a forward packet always has a
  // rail to ride. Crowded columns wire their lead node to the next column's
  // lead (the intra-column siblings still light by state).
  const LINKS = [
    ['harness', 'keyword-intent'],
    ['keyword-intent', 'rag-research'],
    ['rag-research', 'context-refiner'],
    ['context-refiner', 'content-generator'],
    ['content-generator', 'content-reviewer'],
    ['content-reviewer', 'stage-qa'],
    ['stage-qa', 'template-recommender'],
    ['template-recommender', 'design-recommender'],
    ['design-recommender', 'design-reviewer'],
    ['design-reviewer', 'design-compiler'],
    ['design-compiler', 'art-director'],
    ['art-director', 'background-director'],
    ['background-director', 'image-concept'],
    ['image-concept', 'image-generator'],
    ['image-generator', 'zero-text'],
    ['zero-text', 'image-quality-reviewer'],
    ['image-quality-reviewer', 'image-pipeline'],
    ['image-pipeline', 'image-tagger'],
    ['image-tagger', 'translation-agent'],
    ['translation-agent', 'terminology-validator'],
    ['terminology-validator', 'poster-editor'],
    ['poster-editor', 'edit-learning'],
    ['edit-learning', 'learning-memory'],
    ['learning-memory', 'user']
  ];

  // Raw event agent names → graph node id. Several aliases collapse to one
  // node; anything unmapped falls back to the stage's lead node.
  const AGENT_TO_NODE = {
    'harness': 'harness',
    'overseer': 'overseer',
    'keyword-intent': 'keyword-intent',
    'rag-research': 'rag-research',
    'context-refiner': 'context-refiner',
    'stage-qa': 'stage-qa',
    'content-generator': 'content-generator',
    'content-generation': 'content-generator',
    'content-reviewer': 'content-reviewer',
    'template-recommender': 'template-recommender',
    'design-recommender': 'design-recommender',
    'design-reviewer': 'design-reviewer',
    'background-reviewer': 'design-reviewer',
    'design-compiler': 'design-compiler',
    'art-director': 'art-director',
    'background-director': 'background-director',
    'image-concept': 'image-concept',
    'image-generator': 'image-generator',
    'image-quality-reviewer': 'image-quality-reviewer',
    'image-pipeline': 'image-pipeline',
    'image-tagger': 'image-tagger',
    // the zero-text gate node lights from the text-gate CHECKER's agent_output
    // (agent 'image-text-gate') AND the legacy 'gates' alias; the gate engine's
    // own gate_check rides agent 'harness', so without this mapping the node
    // could never light despite the gate running on every generated image.
    'image-text-gate': 'zero-text',
    'gates': 'zero-text',
    // delivery — translator and translation-agent are the same node
    'translation-agent': 'translation-agent',
    'translator': 'translation-agent',
    'terminology-validator': 'terminology-validator',
    'poster-editor': 'poster-editor',
    'edit-learning': 'edit-learning',
    'learning-memory': 'learning-memory',
    'user': 'user'
  };

  // On-demand / path-dependent nodes: they light NORMALLY when they fire, but
  // at rest they read as dimmed with an explanatory tooltip so the viz never
  // implies "this agent is broken / never runs". Each maps to a plain-language
  // reason surfaced via the node's title attribute. (Verified against the
  // event-coverage test: none of these fire on the mainline template lifecycle;
  // each fires only on the noted path.)
  const ON_DEMAND = {
    'template-recommender': 'Runs when the AI picks a template or you retry a v2 design',
    'design-recommender': 'Runs on the dynamic design path (not for predefined templates)',
    'design-reviewer': 'Runs on the dynamic design path (not for predefined templates)',
    'image-tagger': 'Runs during manual auto-tagging of a library image',
    'poster-editor': 'Runs when you edit the poster in the canvas editor',
    'edit-learning': 'Runs when the editor learns from a significant edit',
    'terminology-validator': 'Runs when a translation edit introduces a term to learn'
  };

  const NODE_LABELS = {};
  const NODE_COLUMN = {};   // nodeId → columnId
  const COLUMN_ORDER = {};  // columnId → index (for monotonic advance)
  COLUMNS.forEach((col, i) => {
    COLUMN_ORDER[col.id] = i;
    for (const n of col.nodes) { NODE_LABELS[n.id] = n.label; NODE_COLUMN[n.id] = col.id; }
  });

  // Reviewer/gate → the earlier node its rework routes back to (red packet).
  const REWORK_TARGET = {
    'content-reviewer': 'content-generator',
    'stage-qa': 'content-generator',
    'design-reviewer': 'design-recommender',
    'design-compiler': 'design-recommender',
    'art-director': 'design-recommender',
    'background-director': 'design-recommender',
    'image-quality-reviewer': 'image-generator',
    'image-pipeline': 'image-generator',
    'zero-text': 'image-generator',
    'gates': 'image-generator'
  };

  // Which metro stop a given column belongs to (1:1 here, but explicit).
  const METRO_STOPS = [
    { id: 'intent', label: 'Intent' },
    { id: 'research', label: 'Research' },
    { id: 'writing', label: 'Writing' },
    { id: 'design', label: 'Design' },
    { id: 'images', label: 'Images' },
    { id: 'delivery', label: 'Delivery' }
  ];

  // Map a raw event to a graph node id.
  function nodeIdFor(evt) {
    if (evt.agent && AGENT_TO_NODE[evt.agent]) return AGENT_TO_NODE[evt.agent];
    // fall back to the lead node of the column implied by the pipeline
    const byPipe = {
      content: 'content-generator', design: 'design-recommender',
      image: 'image-concept', translation: 'translation-agent'
    };
    if (evt.pipeline && byPipe[evt.pipeline]) return byPipe[evt.pipeline];
    return null;
  }

  function columnIdForNode(id) { return NODE_COLUMN[id] || null; }

  // ── data-packet label derivation ─────────────────────────────────────────
  // What is actually MOVING across the rail, derived from the event's
  // stage/skill/payload. Kept short so the pill stays a glanceable chip.

  function packetLabel(evt, dir) {
    const p = evt.payload || {};
    if (dir === 'red') {
      const n = typeof p.attempt === 'number' ? p.attempt : (p.reworks || 1);
      return `rework ×${n}`;
    }
    // score-bearing verdicts read as "verdict NN"
    if (typeof p.score === 'number') return `verdict ${p.score}`;
    const nodeId = nodeIdFor(evt);
    const skill = evt.skill || '';
    // skill-driven labels (most specific)
    const bySkill = {
      'extract_keywords': 'keywords',
      'semantic_expand': 'keywords',
      'retrieve_articles': 'sources',
      'synthesize_context': 'context',
      'refine_context': 'context',
      'qa_stage': 'checked',
      'write_poster_copy': 'draft',
      'regenerate_text': 'draft',
      'recommend_template': 'template',
      'recommend_layout': 'layout',
      'apply_template': 'canvas',
      'generate_asset': 'image',
      'fill_slot': 'image',
      'classify_image': 'tags',
      'store_terminology': 'terms',
      'store_learning': 'lesson',
      'classify_edit_significance': 'lesson'
    };
    if (bySkill[skill]) return bySkill[skill];
    // node-driven fallbacks
    const byNode = {
      'keyword-intent': 'keywords',
      'rag-research': 'context',
      'context-refiner': 'context',
      'content-generator': 'draft',
      'content-reviewer': 'verdict',
      'template-recommender': 'template',
      'design-recommender': 'layout',
      'design-compiler': 'canvas',
      'art-director': 'art brief',
      'background-director': 'backdrop',
      'image-concept': 'concept',
      'image-generator': 'image',
      'image-pipeline': 'image',
      'image-tagger': 'tags',
      'translation-agent': 'translation',
      'terminology-validator': 'terms',
      'learning-memory': 'lesson'
    };
    if (nodeId && byNode[nodeId]) return byNode[nodeId];
    // handoff summary head, else generic
    if (evt.type === 'handoff' && typeof p.summary === 'string' && p.summary.trim()) {
      return p.summary.trim().slice(0, 18);
    }
    return 'data';
  }

  // ── state ────────────────────────────────────────────────────────────────

  let root = null;
  let els = null;           // cached DOM handles
  let openCount = 0;
  let hideTimer = null;
  let bubbleTimer = null;
  let seenRunId = null;
  let minimized = false;

  const nodeEls = new Map();  // nodeId → { el, orb, sub, iter, badge, statusDot, state, reworks, runs }
  const stopEls = new Map();  // stopId → { el, dot, badge, state, reworks }
  const linkEls = new Map();  // 'from>to' → SVG <path>
  let activeNodeId = null;
  let lastNodeId = null;
  let maxColumnReached = -1;   // monotonic metro completion guard

  // ── DOM scaffolding (built once, structure rendered upfront) ──────────────

  function build() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'pipelineTheater';
    root.className = 'theater hidden';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');

    const panel = document.createElement('div');
    panel.className = 'theater-panel';

    // header
    const head = document.createElement('div');
    head.className = 'theater-head';
    const title = document.createElement('span');
    title.className = 'theater-title';
    title.textContent = 'Pipeline running';
    const minBtn = document.createElement('button');
    minBtn.type = 'button';
    minBtn.className = 'theater-min';
    minBtn.textContent = '—';
    minBtn.title = 'Minimize (Esc)';
    minBtn.setAttribute('aria-label', 'Minimize the pipeline view');
    minBtn.addEventListener('click', toggleMin);
    head.append(title, minBtn);

    // metro stage strip
    const metro = document.createElement('div');
    metro.className = 'theater-metro';
    buildMetro(metro);

    // the graph: a scrolling stage viewport holds a canvas that sizes to the
    // graph's intrinsic width; the SVG rail layer sits under the columns inside
    // that canvas so rails + packets share the columns' scroll coordinates.
    const stage = document.createElement('div');
    stage.className = 'theater-stage';
    const canvas = document.createElement('div');
    canvas.className = 'theater-canvas';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'theater-rails');
    svg.setAttribute('preserveAspectRatio', 'none');
    const graph = document.createElement('div');
    graph.className = 'theater-graph';
    buildGraph(graph);
    canvas.append(svg, graph);
    stage.appendChild(canvas);
    stage.addEventListener('scroll', scheduleRailDraw, { passive: true });

    // caption
    const caption = document.createElement('div');
    caption.className = 'theater-caption';
    caption.textContent = 'Warming up…';

    // beer-pour indeterminate progress
    const pour = document.createElement('div');
    pour.className = 'theater-pour';
    const pourFill = document.createElement('div');
    pourFill.className = 'theater-pour-fill';
    const pourFoam = document.createElement('div');
    pourFoam.className = 'theater-pour-foam';
    pour.append(pourFill, pourFoam);

    panel.append(head, metro, stage, caption, pour);
    root.appendChild(panel);
    document.body.appendChild(root);

    els = { panel, title, metro, stage, canvas, svg, graph, caption };

    document.addEventListener('keydown', onKeydown);
    window.addEventListener('resize', scheduleRailDraw);
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && openCount > 0 && !minimized) toggleMin();
  }

  function toggleMin() {
    minimized = !minimized;
    root.classList.toggle('theater-minimized', minimized);
    if (!minimized) scheduleRailDraw();
  }

  function buildMetro(metro) {
    for (const s of METRO_STOPS) {
      const wrap = document.createElement('div');
      wrap.className = 'metro-stop';
      wrap.dataset.state = 'idle';
      const dot = document.createElement('span');
      dot.className = 'metro-dot';
      const check = document.createElement('span');
      check.className = 'metro-check';
      check.textContent = '✓';
      dot.appendChild(check);
      const lbl = document.createElement('span');
      lbl.className = 'metro-label';
      lbl.textContent = s.label;
      const badge = document.createElement('span');
      badge.className = 'metro-badge hidden';
      wrap.append(dot, lbl, badge);
      metro.appendChild(wrap);
      stopEls.set(s.id, { el: wrap, dot, badge, state: 'idle', reworks: 0 });
    }
  }

  function buildGraph(graph) {
    COLUMNS.forEach((col, ci) => {
      const column = document.createElement('div');
      column.className = 'stage-col';
      column.dataset.col = col.id;

      const header = document.createElement('div');
      header.className = 'stage-col-head';
      const idx = document.createElement('span');
      idx.className = 'stage-col-idx';
      idx.textContent = String(ci + 1);
      const name = document.createElement('span');
      name.className = 'stage-col-name';
      name.textContent = col.label;
      header.append(idx, name);

      const body = document.createElement('div');
      body.className = 'stage-col-body';

      for (const n of col.nodes) {
        const node = document.createElement('div');
        node.className = `pt-node pt-node-${n.kind}`;
        node.dataset.node = n.id;
        node.dataset.state = 'idle';
        // on-demand nodes: dimmer at rest + a tooltip explaining when they run.
        // They still transition through active/passed/rework normally when they
        // DO fire (the class only changes the resting appearance).
        if (ON_DEMAND[n.id]) {
          node.classList.add('pt-on-demand');
          node.title = ON_DEMAND[n.id];
        }

        const orb = document.createElement('span');
        orb.className = 'pt-orb';
        const glyph = document.createElement('span');
        glyph.className = 'pt-glyph';
        glyph.textContent = n.glyph;
        const bubbles = document.createElement('span');
        bubbles.className = 'pt-bubbles';
        for (let i = 0; i < 3; i++) {
          const b = document.createElement('span');
          b.className = 'pt-bubble';
          bubbles.appendChild(b);
        }
        const check = document.createElement('span');
        check.className = 'pt-check';
        check.textContent = '✓';
        orb.append(glyph, bubbles, check);

        const meta = document.createElement('span');
        meta.className = 'pt-meta';
        const label = document.createElement('span');
        label.className = 'pt-label';
        label.textContent = n.label;
        const sub = document.createElement('span');
        sub.className = 'pt-sub';
        sub.textContent = '';
        meta.append(label, sub);

        // iteration chip (×2, ×3…) — hidden until the node runs a 2nd time
        const iter = document.createElement('span');
        iter.className = 'pt-iter hidden';
        // rework badge (accumulating ×N)
        const badge = document.createElement('span');
        badge.className = 'pt-badge hidden';
        const statusDot = document.createElement('span');
        statusDot.className = 'pt-status';

        node.append(orb, meta, iter, statusDot, badge);
        body.appendChild(node);

        nodeEls.set(n.id, {
          el: node, orb, sub, iter, badge, statusDot,
          state: 'idle', reworks: 0, runs: 0
        });
      }

      column.append(header, body);
      graph.appendChild(column);
    });
  }

  // ── SVG rails ─────────────────────────────────────────────────────────────
  // Orthogonal elbow connectors routed in the GUTTERS between columns — never
  // through a node box. Coordinates are measured against .theater-canvas (the
  // full-width scrolling inner surface the columns live on), so rails stay
  // aligned to the nodes at any scroll offset. Corners are rounded for a
  // premium feel; packets ride these exact paths.
  //
  //   cross-column A→B: exit A's right edge → run to the gutter midline →
  //     drop/climb vertically to B's row → enter B's left edge.
  //   same-column A→B (A above B): exit A's bottom → out to a thin left-side
  //     channel → down → back in to B's top. (A gentle detour so a straight
  //     vertical line never grazes intermediate node boxes.)

  let railRaf = 0;
  function scheduleRailDraw() {
    if (!root || root.classList.contains('hidden')) return;
    cancelAnimationFrame(railRaf);
    railRaf = requestAnimationFrame(drawRails);
  }

  const R = 10;   // elbow corner radius
  const CH = 12;  // same-column side-channel offset from a node's left edge

  function edge(rect, base, side) {
    const y = rect.top + rect.height / 2 - base.top;
    if (side === 'right') return { x: rect.right - base.left, y };
    if (side === 'left') return { x: rect.left - base.left, y };
    if (side === 'top') return { x: rect.left + rect.width / 2 - base.left, y: rect.top - base.top };
    if (side === 'bottom') return { x: rect.left + rect.width / 2 - base.left, y: rect.bottom - base.top };
    // 'center'
    return { x: rect.left + rect.width / 2 - base.left, y };
  }

  // Build a rounded orthogonal path through an ordered list of waypoints.
  function elbowPath(pts) {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1], cur = pts[i], next = pts[i + 1];
      // shorten toward the corner by R on each incoming/outgoing leg
      const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      const outLen = Math.hypot(next.x - cur.x, next.y - cur.y);
      const r = Math.min(R, inLen / 2, outLen / 2);
      const ix = cur.x - (cur.x - prev.x) / (inLen || 1) * r;
      const iy = cur.y - (cur.y - prev.y) / (inLen || 1) * r;
      const ox = cur.x + (next.x - cur.x) / (outLen || 1) * r;
      const oy = cur.y + (next.y - cur.y) / (outLen || 1) * r;
      d += ` L ${ix} ${iy} Q ${cur.x} ${cur.y} ${ox} ${oy}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  }

  function drawRails() {
    if (!els) return;
    const svg = els.svg;
    const base = els.canvas.getBoundingClientRect();
    if (!base.width || !base.height) return;
    svg.setAttribute('viewBox', `0 0 ${base.width} ${base.height}`);
    svg.style.width = `${base.width}px`;
    svg.style.height = `${base.height}px`;

    // clear existing paths
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    linkEls.clear();

    for (const [from, to] of LINKS) {
      const a = nodeEls.get(from);
      const b = nodeEls.get(to);
      if (!a || !b) continue;
      const ar = a.el.getBoundingClientRect();
      const br = b.el.getBoundingClientRect();
      const sameCol = columnIdForNode(from) === columnIdForNode(to);

      let pts;
      if (sameCol) {
        // route out to a thin channel left of the column, then down, then back
        const p0 = edge(ar, base, 'bottom');
        const p1 = edge(br, base, 'top');
        const chx = Math.min(p0.x, p1.x) - CH;
        pts = [
          p0,
          { x: p0.x, y: p0.y + 6 },
          { x: chx, y: p0.y + 6 },
          { x: chx, y: p1.y - 6 },
          { x: p1.x, y: p1.y - 6 },
          p1
        ];
      } else {
        // cross-column: right edge → gutter midline → target row → left edge
        const p0 = edge(ar, base, 'right');
        const p1 = edge(br, base, 'left');
        const mx = (p0.x + p1.x) / 2;
        if (Math.abs(p0.y - p1.y) < 2) {
          pts = [p0, p1]; // same row: straight run
        } else {
          pts = [
            p0,
            { x: mx, y: p0.y },
            { x: mx, y: p1.y },
            p1
          ];
        }
      }

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', elbowPath(pts));
      path.setAttribute('class', 'pt-rail');
      svg.appendChild(path);
      linkEls.set(`${from}>${to}`, path);
    }
  }

  // ── data packets ──────────────────────────────────────────────────────────
  // A labelled pill rides the drawn rail from A to B. Green forward, red
  // backward. If no direct rail exists we animate a straight line between node
  // centres. A comet trail follows; the packet is removed after the animation
  // (no leaks); on arrival the receiver's status dot blips + a ring expands.

  function travel(fromId, toId, color, label) {
    if (reduceMotion || !els) return;
    const a = nodeEls.get(fromId);
    const b = nodeEls.get(toId);
    if (!a || !b) return;
    const base = els.canvas.getBoundingClientRect();
    const path = linkEls.get(`${fromId}>${toId}`) || linkEls.get(`${toId}>${fromId}`);

    const packet = document.createElement('span');
    packet.className = `pt-packet pt-packet-${color}`;
    const trail = document.createElement('span');
    trail.className = 'pt-packet-trail';
    const tag = document.createElement('span');
    tag.className = 'pt-packet-tag';
    tag.textContent = String(label || '').slice(0, 14);
    packet.append(trail, tag);
    els.canvas.appendChild(packet);

    let keyframes;
    if (path && path.getTotalLength) {
      const len = path.getTotalLength();
      const forward = !!linkEls.get(`${fromId}>${toId}`);
      const N = 16;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const t = forward ? i / N : 1 - i / N;
        const pt = path.getPointAtLength(t * len);
        pts.push(pt);
      }
      keyframes = pts.map((pt, i) => ({
        offset: i / N,
        transform: `translate(${pt.x}px, ${pt.y}px) translate(-50%, -50%)`,
        opacity: i === 0 ? 0.2 : (i === N ? 0.9 : 1)
      }));
    } else {
      const ac = edge(a.el.getBoundingClientRect(), base, 'center');
      const bc = edge(b.el.getBoundingClientRect(), base, 'center');
      keyframes = [
        { offset: 0, transform: `translate(${ac.x}px, ${ac.y}px) translate(-50%, -50%)`, opacity: 0.2 },
        { offset: 1, transform: `translate(${bc.x}px, ${bc.y}px) translate(-50%, -50%)`, opacity: 0.9 }
      ];
    }
    const anim = packet.animate(keyframes, { duration: 560, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    anim.onfinish = () => {
      packet.remove();
      pingNode(b);
      receiveRing(b);
    };
    anim.oncancel = () => packet.remove();
  }

  function pingNode(rec) {
    if (reduceMotion || !rec) return;
    rec.statusDot.classList.remove('pt-status-blip');
    void rec.statusDot.offsetWidth;
    rec.statusDot.classList.add('pt-status-blip');
    rec.el.classList.remove('pt-ping');
    void rec.el.offsetWidth;
    rec.el.classList.add('pt-ping');
  }

  // "received" ring expands out of the target node's orb on packet arrival.
  function receiveRing(rec) {
    if (reduceMotion || !rec) return;
    const ring = document.createElement('span');
    ring.className = 'pt-recv-ring';
    rec.orb.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove());
  }

  // ── node state ────────────────────────────────────────────────────────────

  function setNodeState(rec, state) {
    if (!rec) return;
    rec.state = state;
    rec.el.dataset.state = state;
  }

  function setActiveNode(id, subText) {
    if (activeNodeId && activeNodeId !== id) {
      const prev = nodeEls.get(activeNodeId);
      if (prev && (prev.state === 'active')) setNodeState(prev, 'idle');
    }
    activeNodeId = id;
    const rec = nodeEls.get(id);
    if (!rec) return;
    if (rec.state !== 'passed') setNodeState(rec, 'active');
    if (typeof subText === 'string') rec.sub.textContent = subText;
  }

  // A node begins (or re-begins) work. On the 2nd+ run show the iteration chip
  // and spawn a short echo pulse so the repetition is unmistakable.
  function markRun(rec, id) {
    if (!rec) return;
    rec.runs += 1;
    if (rec.runs >= 2) {
      rec.iter.textContent = `×${rec.runs}`;
      rec.iter.classList.remove('hidden');
      if (!reduceMotion) {
        rec.el.classList.remove('pt-echo');
        void rec.el.offsetWidth;
        rec.el.classList.add('pt-echo');
      }
    }
  }

  function flash(rec, cls) {
    if (!rec || reduceMotion) return;
    rec.el.classList.remove(cls);
    void rec.el.offsetWidth;
    rec.el.classList.add(cls);
  }

  function bumpRework(rec) {
    if (!rec) return;
    rec.reworks += 1;
    rec.badge.textContent = `×${rec.reworks}`;
    rec.badge.classList.remove('hidden');
  }

  // ── metro strip ───────────────────────────────────────────────────────────

  function setStopState(rec, state) {
    if (!rec || rec.state === state) return;
    // never downgrade a done stop back to active (monotonic)
    if (rec.state === 'done' && state === 'active') return;
    rec.state = state;
    rec.el.dataset.state = state;
    if (state === 'done' && !reduceMotion) {
      rec.dot.classList.remove('pop');
      void rec.dot.offsetWidth;
      rec.dot.classList.add('pop');
    }
  }

  function metroLoopback(fromStopId, toStopId) {
    const toRec = stopEls.get(toStopId);
    if (!toRec) return;
    toRec.reworks += 1;
    toRec.badge.textContent = `×${toRec.reworks}`;
    toRec.badge.classList.remove('hidden');
    setStopState(toRec, 'rework');
    const fromRec = stopEls.get(fromStopId);
    if (reduceMotion || !fromRec || fromRec === toRec) return;
    metroTravel(fromRec.dot, toRec.dot);
  }

  function metroTravel(fromEl, toEl) {
    const base = els.metro.getBoundingClientRect();
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'metro-loopdot';
    els.metro.appendChild(dot);
    const ax = a.left + a.width / 2 - base.left, ay = a.top + a.height / 2 - base.top;
    const bx = b.left + b.width / 2 - base.left, by = b.top + b.height / 2 - base.top;
    const anim = dot.animate([
      { transform: `translate(${ax}px, ${ay}px) translate(-50%,-50%)`, opacity: 0.3 },
      { transform: `translate(${bx}px, ${by}px) translate(-50%,-50%)`, opacity: 1 }
    ], { duration: 480, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    anim.onfinish = () => dot.remove();
    anim.oncancel = () => dot.remove();
  }

  // Advance the metro to `columnId`. MONOTONIC: every stop BEFORE this column
  // is force-completed (green) — this is the inference that guarantees a stage
  // greens even if its own stage_end was missed, the moment a later column
  // starts. The reached column becomes active (unless already done).
  function advanceMetro(columnId, active) {
    const idx = COLUMN_ORDER[columnId];
    if (idx == null) return;
    if (idx > maxColumnReached) maxColumnReached = idx;
    for (const s of METRO_STOPS) {
      const rec = stopEls.get(s.id);
      const si = COLUMN_ORDER[s.id];
      if (si < idx) {
        // earlier column — infer completion
        if (rec.state !== 'done') setStopState(rec, 'done');
      } else if (si === idx) {
        if (active && rec.state !== 'done') setStopState(rec, 'active');
      }
    }
  }

  function completeMetro(columnId) {
    const rec = stopEls.get(columnId);
    if (rec) setStopState(rec, 'done');
  }

  // ── captions ──────────────────────────────────────────────────────────────

  function pretty(s) {
    return String(s || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  function nodeLabel(id) { return NODE_LABELS[id] || pretty(id); }
  function agentLabel(evt) {
    const id = nodeIdFor(evt);
    return id ? nodeLabel(id) : pretty(evt.agent || 'agent');
  }

  function headOf(fb) {
    if (typeof fb !== 'string' || !fb.trim()) return '';
    const head = fb.trim().slice(0, 80);
    return ` — ${head}${fb.length > 80 ? '…' : ''}`;
  }

  function caption(text, tone) {
    els.caption.textContent = text;
    els.caption.dataset.tone = tone || 'info';
  }

  // slot sub-caption ("slot 2/4"-style) from payload.slotId, when present.
  function slotSub(p) {
    if (!p || typeof p.slotId !== 'string' || !p.slotId) return '';
    const attempt = typeof p.attempt === 'number' ? ` · try ${p.attempt}` : '';
    return `slot ${p.slotId}${attempt}`;
  }

  function describe(evt) {
    const p = evt.payload || {};
    const score = typeof p.score === 'number' ? ` (scored ${p.score})` : '';
    const attempt = p.attempt ? ` · attempt ${p.attempt}${p.attempt <= 5 ? '/5' : ''}` : '';
    switch (evt.type) {
      case 'stage_start': return `${agentLabel(evt)} · ${pretty(evt.skill || evt.stage || 'working')}${attempt}`;
      case 'stage_end': return p.bestEffort
        ? `${agentLabel(evt)} accepted best-effort${score}`
        : `${agentLabel(evt)} passed per pipeline${score}`;
      case 'rework': {
        const target = nodeLabel(REWORK_TARGET[nodeIdFor(evt)] || 'content-generator');
        return `${agentLabel(evt)} → ${target} · rejected${score} — reworking${headOf(p.routedFeedback || p.feedback)}`;
      }
      case 'handoff': return `${agentLabel(evt)} → ${nodeLabel(AGENT_TO_NODE[p.toAgent] || p.toAgent || '')}`;
      case 'error': return `Error at ${agentLabel(evt)} (${p.code || 'unknown'})`;
      case 'egress_call': return `${agentLabel(evt)} → model call (${p.model || 'model'})`;
      case 'memory_write': return 'Lesson recorded to learning memory';
      case 'user_action': return 'Your input applied';
      default: return `${agentLabel(evt)} · ${pretty(evt.type)}`;
    }
  }

  // ── event digestion ───────────────────────────────────────────────────────

  function onEvent(evt) {
    if (!root || openCount <= 0 || !evt || typeof evt !== 'object') return;
    if (evt.runId && seenRunId && evt.runId !== seenRunId) resetRun();
    if (evt.runId) seenRunId = evt.runId;

    const nodeId = nodeIdFor(evt);
    const rec = nodeId ? nodeEls.get(nodeId) : null;
    const colId = nodeId ? columnIdForNode(nodeId) : null;
    const p = evt.payload || {};

    switch (evt.type) {
      case 'stage_start': {
        if (colId) advanceMetro(colId, true);
        // forward data packet from the previous node to this one
        if (lastNodeId && nodeId && lastNodeId !== nodeId) {
          travel(lastNodeId, nodeId, 'green', packetLabel(evt, 'green'));
        }
        if (rec) markRun(rec, nodeId);
        const slot = slotSub(p);
        const hint = slot || (p.attempt ? `attempt ${p.attempt}` : (evt.skill ? pretty(evt.skill) : 'working'));
        setActiveNode(nodeId, hint);
        caption(describe(evt), 'info');
        break;
      }
      case 'handoff': {
        const toId = AGENT_TO_NODE[p.toAgent] || p.toAgent;
        if (nodeId && toId && nodeEls.get(toId)) travel(nodeId, toId, 'green', packetLabel(evt, 'green'));
        if (toId && nodeEls.get(toId)) setActiveNode(toId, '');
        caption(describe(evt), 'info');
        break;
      }
      case 'rework': {
        const targetId = REWORK_TARGET[nodeId] || 'content-generator';
        // red packet backward, reviewer → target, labelled "rework ×N"
        const targetRec = nodeEls.get(targetId);
        if (targetRec) {
          setNodeState(targetRec, 'rework');
          bumpRework(targetRec);
          flash(targetRec, 'pt-flash-red');
        }
        const label = `rework ×${targetRec ? targetRec.reworks : (p.attempt || 1)}`;
        if (nodeId && targetId) travel(nodeId, targetId, 'red', label);
        if (rec) flash(rec, 'pt-flash-red');
        // metro loopback: current column → target's column
        const targetCol = columnIdForNode(targetId);
        if (colId && targetCol) metroLoopback(colId, targetCol);
        setActiveNode(targetId, 'reworking…');
        caption(describe(evt), 'bad');
        break;
      }
      case 'stage_end': {
        if (rec) {
          setNodeState(rec, p.bestEffort ? 'best-effort' : 'passed');
          flash(rec, p.bestEffort ? 'pt-flash-amber' : 'pt-flash-green');
        }
        if (colId) completeMetro(colId);
        caption(describe(evt), p.bestEffort ? 'warn' : 'good');
        break;
      }
      case 'error': {
        if (rec) { setNodeState(rec, 'rework'); flash(rec, 'pt-flash-red'); }
        caption(describe(evt), 'bad');
        break;
      }
      case 'egress_call': {
        if (rec && rec.state !== 'passed') setActiveNode(nodeId, p.model ? pretty(p.model) : 'model call');
        caption(describe(evt), 'info');
        break;
      }
      case 'memory_write': {
        if (colId) advanceMetro(colId, true);
        setActiveNode(nodeId || 'learning-memory', 'writing lesson');
        caption(describe(evt), 'info');
        break;
      }
      case 'user_action': {
        setActiveNode(nodeId || 'user', '');
        caption(describe(evt), 'info');
        break;
      }
      default: {
        if (rec && rec.state === 'idle') setActiveNode(nodeId, '');
        caption(describe(evt), 'info');
      }
    }

    if (nodeId) lastNodeId = nodeId;
  }

  // ── continuous life (bubbles + attempt drift on the active node) ──────────

  function armBubbles() {
    clearInterval(bubbleTimer);
    if (reduceMotion) return;
    bubbleTimer = setInterval(() => {
      if (openCount <= 0 || !activeNodeId) return;
      const rec = nodeEls.get(activeNodeId);
      if (!rec || rec.state !== 'active') return;
      // re-trigger the bubble rise so long silent work keeps visibly breathing
      rec.orb.classList.remove('pt-boil');
      void rec.orb.offsetWidth;
      rec.orb.classList.add('pt-boil');
    }, 2400);
  }

  // ── reset between runs ────────────────────────────────────────────────────

  function resetRun() {
    for (const rec of nodeEls.values()) {
      setNodeState(rec, 'idle');
      rec.reworks = 0;
      rec.runs = 0;
      rec.badge.textContent = '';
      rec.badge.classList.add('hidden');
      rec.iter.textContent = '';
      rec.iter.classList.add('hidden');
      rec.sub.textContent = '';
    }
    for (const rec of stopEls.values()) {
      rec.state = 'idle';
      rec.el.dataset.state = 'idle';
      rec.reworks = 0;
      rec.badge.textContent = '';
      rec.badge.classList.add('hidden');
    }
    activeNodeId = null;
    lastNodeId = null;
    maxColumnReached = -1;
  }

  // ── begin / end (refcounted around pipeline awaits) ───────────────────────

  function begin(label) {
    build();
    clearTimeout(hideTimer);
    openCount += 1;
    if (openCount === 1) {
      minimized = false;
      root.classList.remove('theater-minimized');
      root.classList.remove('hidden');
      requestAnimationFrame(() => {
        root.classList.add('open');
        scheduleRailDraw();
      });
      document.body.classList.add('theater-dim');
      armBubbles();
    }
    if (label) els.title.textContent = label;
  }

  function end() {
    if (!root || openCount === 0) return; // end() without begin() is a no-op
    openCount = Math.max(0, openCount - 1);
    if (openCount > 0) return;
    clearInterval(bubbleTimer);
    bubbleTimer = null;
    // grace period: let the final green check land before the lights come up
    hideTimer = setTimeout(() => {
      root.classList.remove('open');
      document.body.classList.remove('theater-dim');
      setTimeout(() => { if (openCount === 0) root.classList.add('hidden'); }, 450);
    }, 900);
  }

  window.PipelineTheater = { begin, end, onEvent, isOpen: () => openCount > 0 };
})();
