// EditorInline (Phase O7) — the Canva-replica editor as an embeddable
// component. All editing machinery formerly in editor_page.js lives HERE
// (moved, not duplicated): canvas load/serialize custom-prop round-trip,
// autosave with the deferred/queued-save drain discipline, undo/redo,
// selection properties (incl. per-element text color), whole-poster color
// swap, per-object + bulk fonts, alignment/distribute/center-snap, z-order,
// image replace/regenerate/flip/opacity, in-editor template switch, the
// translation language dropdown + variant saves, save-as + feedback prompt,
// and the NEW background-color toolbar swatch.
//
// window.EditorInline = {
//   mount({ container, posterId, onStateChange, toolbarContainer, onLoaded, onFatal }),
//   unmount(),           // flushes autosave first, then tears everything down
//   flushAutosave(),     // expose the editor's own flush for host pages
//   isMounted()
// }
//
// Live-preview integration: every mutating edit schedules a debounced
// (~100ms per orientation) onStateChange({ canvases: { portrait|landscape } })
// so a host page (the metro create page) can mirror the editor into its
// right-rail preview without any save round-trip.
//
// Dual-orientation editing (T3): when the design (or the active language
// variant) carries a landscape canvas, a SECOND fabric.Canvas renders beside
// the portrait one — each independently editable, independently autosaved to
// its orientation (?orientation=landscape on the same PUT), with per-canvas
// undo/redo stacks. The selection toolbar operates on the last-FOCUSED
// canvas (mousedown/selection tracking; gold ring marks the focused frame).
// Bound-TEXT mirroring: editing the text of an object carrying a content
// binding (msgId/fieldRef, extraId, or a unique layerRole) in one orientation
// silently writes the same text to the matching binding in the other
// orientation and marks it dirty so its own autosave persists it. Geometry
// and style changes NEVER mirror — text is one poster, layout is
// per-orientation. Unbound text without an extraId never mirrors.
//
// Language edit-scope toggle (T4): 'This language | All languages', visible
// only when the poster has translations. All-languages + variant edit →
// the portrait variant save's syncAvailable response AUTO-POSTs the existing
// batch sync (replacing the ask-banner) with a persistent status line.
// All-languages + English edit → ONE confirm dialog offering to re-translate
// the already-translated set from the updated English. Scope resets to
// This-language on every mount (session-scoped, never persisted).
//
// The component builds its whole DOM programmatically WITHOUT element ids —
// the create page already owns ids like libraryModal/feedbackGoodBtn, and a
// second id would break document.getElementById for the host. Every node is
// held by reference in `ui`; styling rides the existing editor.css classes.
//
// XSS discipline: everything user/model-derived is rendered via textContent.
// The only innerHTML sink is the server-generated template preview SVG
// (palette-resolved geometry from our own template modules — same rationale
// as the create flow gallery).

(function () {
  'use strict';

  const CANVAS_W = 1414;
  const CANVAS_H = 2000;
  // orientation-aware dims (T3): portrait 1414x2000, landscape 2000x1414 —
  // must match the server's PIN_DIMS in routes/editor.js
  const DIMS = {
    portrait: { w: CANVAS_W, h: CANVAS_H },
    landscape: { w: CANVAS_H, h: CANVAS_W }
  };
  const ORIENTATIONS = ['portrait', 'landscape'];
  // fieldRef added over the old editor_page list: v2 qa-pair templates bind two
  // texts of one block through it — the round-trip must not drop it.
  // edLocked (O8): our own lock flag — survives save so a locked object stays
  // locked across reloads. `visible` is a native fabric prop already serialized.
  const EXTRA_PROPS = ['layerRole', 'msgId', 'slotId', 'slotSpec', 'imageId', 'bgRef', 'extraId', 'fieldRef', 'fitMode', 'fitZoom', 'savedClipPath', 'edLocked'];
  const EDITABLE_PHASES = ['designed', 'saved', 'translated'];
  const HEAD_ROLES = ['headline', 'subheadline', 'message-label'];
  const BODY_ROLES = ['message', 'cta'];
  // Base families + the curated FONT_PAIRS faces (data/creative-library.js).
  // Kept as a literal list because data/ is not served under ui/ (no bundler) —
  // the editor.html <link> preloads Montserrat/Inter; the rest fall back to a
  // system face until added to the page's font <link> (documented limitation).
  const FONT_PAIR_FACES = [
    'Montserrat', 'Inter', 'Archivo Black', 'Playfair Display', 'Source Sans 3',
    'Space Grotesk', 'IBM Plex Sans', 'Bebas Neue', 'Open Sans', 'Merriweather',
    'Lato', 'Poppins', 'Roboto', 'Oswald', 'Nunito Sans'
  ];
  const BASE_FONTS = [...new Set([...FONT_PAIR_FACES, 'Georgia', 'Arial', 'Courier New'])];
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 2;
  const ZOOM_STEP = 0.25;
  const SNAP_PX = 8; // canvas-space center-snap threshold
  const AUTOSAVE_MS = 3000;
  const HISTORY_DEBOUNCE_MS = 350;
  const HISTORY_CAP = 50;
  const NOTIFY_MS = 100;      // onStateChange debounce (live-preview mirror)
  const FLUSH_MAX_FAILURES = 5; // flushAutosave gives up after N failed saves
  const HEX6 = /^#[0-9a-f]{6}$/i;

  // ── auto-fit constants ──────────────────────────────────────────────────────
  // Hard floor in the editor (24px) — lower than the design flow (80px for
  // headlines) so user edits with long text never render invisible.
  const AUTOFIT_FLOOR_PX = 24;
  const AVG_CHAR_W = 0.54; // mirrors templates/helpers.js

  // Palette swatches shown in the floating context toolbar (brand colors + basics)
  const PALETTE_SWATCHES = [
    '#1f1a17', '#ffffff', '#e3af32', '#c00', '#2563eb',
    '#16a34a', '#7c3aed', '#ea580c', '#475569'
  ];

  const ERROR_MESSAGES = {
    POSTER_BUSY: 'Another operation is running on this poster — try again in a moment.',
    WRONG_PHASE: 'This poster is not editable in its current phase.',
    POSTER_NOT_FOUND: 'Poster not found — it may have been deleted.',
    CANVAS_TOO_LARGE: 'The canvas is too large to save (3MB limit).',
    IMAGE_GATE_EXHAUSTED: 'Image generation kept producing embedded text — try again.',
    IMAGE_HAS_TEXT: 'That image failed the zero-text gate and cannot be placed.',
    INVALID_NAME: 'Name must be between 1 and 120 characters.',
    INVALID_FEEDBACK: 'Invalid rating — use "good" or "bad".',
    NO_LANDSCAPE_CANVAS: 'This poster has no landscape canvas.',
    INVALID_ORIENTATION: 'Invalid canvas orientation.',
    NOTHING_TO_SYNC: 'Nothing to sync — the edit was already applied to the other languages.',
    NETWORK: 'Server unreachable — is the poster app running?'
  };

  const NO_LANDSCAPE_TOOLTIP = 'This poster has no landscape canvas — view control needs one.';

  // ── shared pure helpers ─────────────────────────────────────────────────────

  function toHex6(value, fallback = '#000000') {
    if (typeof value !== 'string') return fallback;
    const v = value.trim();
    if (HEX6.test(v)) return v.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(v)) {
      return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
    }
    return fallback;
  }

  /** Readable text color (dark/light) against a hex background. */
  function readableTextColor(bgHex) {
    const hex = toHex6(bgHex, '#ffffff');
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const ch = (i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    const lum = 0.2126 * lin(ch(0)) + 0.7152 * lin(ch(1)) + 0.0722 * lin(ch(2));
    return lum > 0.35 ? '#1f1a17' : '#ffffff';
  }

  /** Re-attach persisted custom props onto enlivened instances (same order). */
  function reattachProps(instances, sourceObjects) {
    (sourceObjects || []).forEach((src, i) => {
      const inst = instances[i];
      if (!inst || !src) return;
      for (const p of EXTRA_PROPS) {
        if (src[p] !== undefined) inst[p] = src[p];
      }
    });
  }

  /** Absolute same-origin image srcs → relative paths (fabric absolutizes them). */
  function relativizeSrcs(node) {
    if (Array.isArray(node)) { node.forEach(relativizeSrcs); return; }
    if (!node || typeof node !== 'object') return;
    if (typeof node.src === 'string') {
      try {
        const u = new URL(node.src, location.href);
        if (u.origin === location.origin) node.src = u.pathname + u.search;
      } catch { /* leave unparseable srcs for the server sanitizer */ }
    }
    Object.values(node).forEach(relativizeSrcs);
  }

  /** DOM helper: element with class + textContent (never innerHTML). */
  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // ── auto-fit text (mirrors templates/helpers.js estLines / fitFontSize) ────

  /** Greedy word-wrap → number of lines (client-side copy of the server helper). */
  function estLines(text, fontSize, width) {
    const words = String(text).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 1;
    const maxChars = Math.max(4, Math.floor(width / (fontSize * AVG_CHAR_W)));
    let lines = 1;
    let lineLen = 0;
    for (const word of words) {
      const add = lineLen === 0 ? word.length : word.length + 1;
      if (lineLen + add > maxChars && lineLen > 0) { lines++; lineLen = word.length; }
      else lineLen += add;
    }
    return lines;
  }

  function estTextHeight(text, fontSize, width, lineHeight = 1.16) {
    return estLines(text, fontSize, width) * fontSize * lineHeight;
  }

  /**
   * Step fontSize down (2px steps) until the estimated text height fits
   * inside `availHeight`. Floor: AUTOFIT_FLOOR_PX (24px in the editor).
   * Returns the adjusted fontSize (may equal current if it already fits).
   */
  function fitFontSizeEditor(text, availWidth, availHeight, currentSize) {
    const lh = 1.16;
    for (let size = currentSize; size >= AUTOFIT_FLOOR_PX; size -= 2) {
      if (estTextHeight(text, size, availWidth, lh) <= availHeight) return size;
    }
    return AUTOFIT_FLOOR_PX;
  }

  /**
   * Apply auto-fit to a single Textbox object.
   * Uses obj.width (the wrapping column width) and obj.height as the zone.
   * Only steps DOWN — never enlarges beyond the object's current fontSize.
   */
  function autofitObj(obj) {
    // isTextObj is defined inside createInstance; guard with a direct check here
    if (!obj || typeof obj.text !== 'string') return;
    const text = obj.text || '';
    const width = obj.width || 520;
    const height = obj.height || 200;
    const current = obj.fontSize || 40;
    const lh = obj.lineHeight || 1.16;
    if (estTextHeight(text, current, width, lh) <= height) return; // already fits
    const fitted = fitFontSizeEditor(text, width, height, current);
    if (fitted !== current) obj.set('fontSize', fitted);
  }

  function showAuthBanner() {
    const banner = document.getElementById('authBanner');
    if (banner) banner.classList.remove('hidden');
  }

  function flash(target, message, ok = true) {
    target.textContent = message;
    target.className = `status ${ok ? 'ok' : 'err'}`;
    if (ok) setTimeout(() => { if (target.textContent === message) target.textContent = ''; }, 4000);
  }

  // ── instance factory ────────────────────────────────────────────────────────

  function createInstance(options) {
    const container = options.container;
    const posterId = options.posterId || null;
    const onStateChange = typeof options.onStateChange === 'function' ? options.onStateChange : null;
    const onLoaded = typeof options.onLoaded === 'function' ? options.onLoaded : null;
    const externalToolbar = options.toolbarContainer || null;
    const onFatal = typeof options.onFatal === 'function' ? options.onFatal : (message) => {
      if (!container) { console.error('EditorInline:', message); return; }
      container.textContent = '';
      container.appendChild(el('div', 'banner', message));
    };

    // ── editor state ──────────────────────────────────────────────────────────
    //
    // T3 dual-canvas model: ALL canvas-scoped state (fabric instance, dirty
    // tracking, the queued-save chain, undo/redo stacks, zoom, preview-notify
    // debounce) lives on a per-orientation `side`. The selection toolbar and
    // the props panel operate on the last-FOCUSED side; `fc` stays as the
    // focused-canvas alias so every selection tool reads/writes the right one.
    function makeSide(orientation) {
      return {
        orientation,
        fc: null,              // the interactive fabric.Canvas (created at init)
        exists: false,         // the active language has a canvas for this orientation
        zoom: 1,
        dirty: false,
        changeSeq: 0,          // increments on every change; save clears dirty only if unchanged since
        saving: false,
        saveQueued: false,
        lastSaveFailed: false, // bounded-flush bookkeeping (see flushAutosave)
        savePromise: null,     // the in-flight doSave Promise for THIS side (null when idle)
        queuedSaveDeferred: null, // waiters for the QUEUED follow-up save (settled by drainQueuedSave)
        autosaveTimer: null,
        notifyTimer: null,     // per-side onStateChange debounce
        suppressEvents: false, // true while loading/restoring canvas JSON (and while mirroring)
        states: [],            // undo/redo JSON-state stack (per canvas)
        stateIdx: -1,
        historyTimer: null,
        snapV: false,
        snapH: false,
        snapLines: [],         // O8: {x1,y1,x2,y2} guide segments (canvas coords) drawn this drag
        lintTimer: null,       // O8: debounced live-lint timer
        lintReport: null,      // O8: last { fixes, violations } for this canvas
        lintBad: null,         // O8: Set of live fabric objects flagged by lint
        frame: null,           // .ed-canvas-frame wrapper (gold ring target)
        canvasEl: null
      };
    }
    const sides = { portrait: makeSide('portrait'), landscape: makeSide('landscape') };
    let focusedSide = sides.portrait; // last-focused canvas — toolbar target
    let fc = null;               // alias: focusedSide.fc (kept in sync by setFocusedSide)
    let designState = null;      // last safe design state from the server
    let serverOpDepth = 0;       // regenerate / template apply in flight — autosave paused
    let swapFromColor = null;
    let libraryPickedImageId = null;
    let pendingReplaceObject = null;
    let pickedTemplateId = null;
    let destroyed = false;

    // translation state
    let activeLang = 'en';       // 'en' = design canvas; other id = translation variant
    let switchingLanguage = false; // true between per-orientation loads of a language switch (mirror guard)
    let translationMeta = null;  // GET /api/translation/meta/languages
    let translationState = null; // GET /api/translation/:posterId (safe state)
    let pendingSyncLang = null;  // lang whose last save returned syncAvailable:true

    // T4: language edit-scope — session-scoped, resets on every mount
    let editScope = 'this';      // 'this' | 'all'
    let syncInFlight = false;    // auto-sync POST running (all-languages scope)
    let syncPendingLang = null;  // a save returned syncAvailable while a sync ran
    let enRetranslateAsked = false; // ONE confirm per edit burst (resets on toggle/lang switch)
    let retranslateInFlight = false;

    // save-as / feedback state
    let _feedbackPosterId = null;
    let _pendingFeedbackRating = null;

    const ui = {};          // every generated element, by reference
    const overlays = [];    // body-level overlays (modals/banners) removed on destroy

    // ── api helpers ──────────────────────────────────────────────────────────

    async function api(path, opts = null) {
      let res;
      try {
        res = await fetch(path, window.authOptions(opts));
      } catch {
        const err = new Error(ERROR_MESSAGES.NETWORK);
        err.code = 'NETWORK';
        throw err;
      }
      if (res.status === 401) {
        showAuthBanner();
        const err = new Error('Not authorized — open the tokenized URL first (see banner).');
        err.code = 'UNAUTHORIZED';
        throw err;
      }
      if (!res.ok) {
        let code = `HTTP ${res.status}`;
        try { code = (await res.json()).error || code; } catch { /* non-JSON error body */ }
        const err = new Error(ERROR_MESSAGES[code] || `Request failed: ${code}`);
        err.code = code;
        throw err;
      }
      return res.json();
    }

    function sendJson(method, path, body) {
      return api(path, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
    }

    // ── DOM construction (classes from editor.css/base.css, NO ids) ──────────

    function buildToolbar() {
      const bar = el('div', 'ed-toolbar');
      ui.toolbar = bar;

      ui.undoBtn = el('button', '', '↶');
      ui.undoBtn.title = 'Undo (Ctrl+Z)';
      ui.undoBtn.disabled = true;
      ui.redoBtn = el('button', '', '↷');
      ui.redoBtn.title = 'Redo (Ctrl+Shift+Z)';
      ui.redoBtn.disabled = true;

      ui.zoomOutBtn = el('button', '', '−');
      ui.zoomOutBtn.title = 'Zoom out';
      ui.zoomLabel = el('span', 'zoom-label', '100%');
      ui.zoomInBtn = el('button', '', '+');
      ui.zoomInBtn.title = 'Zoom in';
      ui.zoomFitBtn = el('button', '', 'Fit');
      ui.zoomFitBtn.title = 'Zoom to fit';

      // T3: three-state view control Portrait / Landscape / Both
      ui.viewControl = el('div', 'ed-view-control');
      ui.viewControl.setAttribute('role', 'group');
      ui.viewControl.setAttribute('aria-label', 'Canvas view');
      ui.viewButtons = {};
      for (const [mode, label] of [['portrait', 'Portrait'], ['landscape', 'Landscape'], ['both', 'Both']]) {
        const btn = el('button', 'ed-seg-btn', label);
        btn.setAttribute('aria-pressed', 'false');
        btn.dataset.viewMode = mode;
        ui.viewButtons[mode] = btn;
        ui.viewControl.appendChild(btn);
      }

      const langLabel = el('label', 'lang-label', 'Language');
      ui.langSelect = el('select', 'lang-select');
      ui.langSelect.title = 'Switch language variant';
      ui.translateBtn = el('button', 'hidden', 'Translate…');
      ui.translateBtn.title = 'Translate poster to other languages';

      // T4: edit-scope toggle (visible only when translations exist)
      ui.scopeWrap = el('span', 'ed-scope-wrap hidden');
      const scopeLabel = el('span', 'ed-scope-label', 'Edit scope');
      ui.scopeControl = el('span', 'ed-view-control');
      ui.scopeControl.setAttribute('role', 'group');
      ui.scopeControl.setAttribute('aria-label', 'Edit scope');
      ui.scopeThisBtn = el('button', 'ed-seg-btn', 'This language');
      ui.scopeThisBtn.dataset.scope = 'this';
      ui.scopeAllBtn = el('button', 'ed-seg-btn', 'All languages');
      ui.scopeAllBtn.dataset.scope = 'all';
      ui.scopeControl.append(ui.scopeThisBtn, ui.scopeAllBtn);
      ui.scopeWrap.append(scopeLabel, ui.scopeControl);
      // persistent status line for all-languages syncs / re-translations
      ui.scopeStatus = el('span', 'ed-scope-status');
      ui.scopeStatus.setAttribute('role', 'status');

      // NEW (O7): background color swatch — sets canvas.background live
      const bgLabel = el('label', 'ed-bg-label', 'Background');
      ui.bgColorInput = document.createElement('input');
      ui.bgColorInput.type = 'color';
      ui.bgColorInput.title = 'Poster background color';
      bgLabel.appendChild(ui.bgColorInput);

      // Live-lint badge (O8): shows the fixable/violation count from the last
      // debounced lintCanvas run; click applies contrast/font fixes in place.
      ui.lintBtn = el('button', 'ed-lint-btn hidden', 'Lint');
      ui.lintBtn.title = 'Readability check (contrast, min font, overflow, overlap)';

      ui.dirtyDot = el('span', 'dirty-dot hidden', '●');
      ui.dirtyDot.title = 'Unsaved changes';
      ui.saveStatus = el('span', 'status');
      ui.saveBtn = el('button', 'primary', 'Save');
      ui.saveAsBtn = el('button', '', 'Save poster…');

      const sep = () => el('span', 'rail-sep');
      bar.append(
        ui.undoBtn, ui.redoBtn, sep(),
        ui.zoomOutBtn, ui.zoomLabel, ui.zoomInBtn, ui.zoomFitBtn, sep(),
        ui.viewControl, sep(),
        langLabel, ui.langSelect, ui.translateBtn,
        ui.scopeWrap, ui.scopeStatus, sep(),
        bgLabel, sep(),
        ui.lintBtn, sep(),
        ui.dirtyDot, ui.saveStatus, ui.saveBtn, ui.saveAsBtn
      );
      return bar;
    }

    function railLabel(text, control) {
      const label = el('label', 'rail-label', text);
      label.appendChild(control);
      return label;
    }

    function buildToolRail() {
      const rail = el('aside', 'tool-rail');

      const insert = el('section');
      insert.appendChild(el('h3', '', 'Insert'));
      ui.addTextBtn = el('button', 'rail-btn', '+ Add text');
      insert.appendChild(ui.addTextBtn);

      const colors = el('section');
      colors.appendChild(el('h3', '', 'Poster colors'));
      colors.appendChild(el('p', 'rail-hint',
        'Click a swatch, pick a new color — it swaps everywhere that color is used.'));
      ui.posterColors = el('div', 'swatch-grid');
      ui.colorSwapPanel = el('div', 'hidden');
      const swapRow = el('div', 'swap-row');
      ui.swapFromSwatch = el('span', 'swatch');
      ui.swapToInput = document.createElement('input');
      ui.swapToInput.type = 'color';
      swapRow.append(ui.swapFromSwatch, el('span', 'swap-arrow', '→'), ui.swapToInput);
      ui.applySwapBtn = el('button', 'rail-btn primary', 'Swap color');
      ui.colorSwapPanel.append(swapRow, ui.applySwapBtn);
      colors.append(ui.posterColors, ui.colorSwapPanel);

      const fonts = el('section');
      fonts.appendChild(el('h3', '', 'Fonts'));
      ui.headFontSelect = document.createElement('select');
      fonts.appendChild(railLabel('All headings', ui.headFontSelect));
      ui.applyHeadFontBtn = el('button', 'rail-btn', 'Set heading font');
      fonts.appendChild(ui.applyHeadFontBtn);
      ui.bodyFontSelect = document.createElement('select');
      fonts.appendChild(railLabel('All body text', ui.bodyFontSelect));
      ui.applyBodyFontBtn = el('button', 'rail-btn', 'Set body font');
      fonts.appendChild(ui.applyBodyFontBtn);

      const template = el('section');
      template.appendChild(el('h3', '', 'Template'));
      template.appendChild(el('p', 'rail-hint', 'Rebuilds the whole layout from your approved content.'));
      ui.changeTemplateBtn = el('button', 'rail-btn', 'Change template');
      template.appendChild(ui.changeTemplateBtn);

      // Layers panel (O8): every non-decor object of the focused canvas, top
      // layer first. Click selects; the eye toggles object.visible; the arrows
      // reorder (fc.moveObjectTo). Rebuilt on selection/add/remove/reorder and
      // kept in sync with the canvas selection (the active row is highlighted).
      const layers = el('section', 'ed-layers-section');
      const layersHead = el('div', 'ed-layers-head');
      layersHead.appendChild(el('h3', '', 'Layers'));
      ui.layersDecorToggle = document.createElement('input');
      ui.layersDecorToggle.type = 'checkbox';
      const decorLabel = el('label', 'ed-layers-decor');
      decorLabel.append(ui.layersDecorToggle, document.createTextNode(' show decor'));
      layersHead.appendChild(decorLabel);
      layers.appendChild(layersHead);
      ui.layersList = el('div', 'ed-layers-list');
      layers.appendChild(ui.layersList);

      rail.append(insert, colors, fonts, template, layers);
      return rail;
    }

    function buildStage() {
      ui.canvasStage = el('main', 'canvas-stage');
      // T3: one labeled frame per orientation. Side-by-side when the stage is
      // wide enough (container query in editor.css), stacked below. The gold
      // ring (.focused) marks the last-focused frame.
      const row = el('div', 'ed-canvas-row');
      for (const o of ORIENTATIONS) {
        const side = sides[o];
        const frame = el('section', `ed-canvas-frame ed-frame-${o}`);
        frame.setAttribute('aria-label', `${o === 'portrait' ? 'Portrait' : 'Landscape'} canvas`);
        frame.appendChild(el('h4', 'ed-canvas-label', o === 'portrait' ? 'Portrait' : 'Landscape'));
        const holder = el('div', 'canvas-holder');
        side.canvasEl = document.createElement('canvas');
        holder.appendChild(side.canvasEl);
        frame.appendChild(holder);
        side.frame = frame;
        row.appendChild(frame);
      }
      ui.canvasStage.appendChild(row);
      return ui.canvasStage;
    }

    function buildPropsPanel() {
      const panel = el('aside', 'props-panel');
      ui.noSelection = el('p', 'rail-hint',
        'Select an object on the canvas to edit its properties. Double-click text to edit it inline.');
      ui.objProps = el('div', 'hidden');

      // arrange
      const arrange = el('section');
      arrange.appendChild(el('h3', '', 'Arrange'));
      const alignGrid = el('div', 'btn-grid');
      ui.alignButtons = [];
      for (const [dir, glyph, title] of [
        ['left', '⇤', 'Align left'], ['centerH', '↔', 'Center horizontally'], ['right', '⇥', 'Align right'],
        ['top', '⤒', 'Align top'], ['centerV', '↕', 'Center vertically'], ['bottom', '⤓', 'Align bottom']
      ]) {
        const btn = el('button', '', glyph);
        btn.dataset.align = dir;
        btn.title = title;
        ui.alignButtons.push(btn);
        alignGrid.appendChild(btn);
      }
      ui.distributeRow = el('div', 'btn-row');
      ui.distHBtn = el('button', '', 'Distribute H');
      ui.distHBtn.title = 'Distribute horizontally';
      ui.distVBtn = el('button', '', 'Distribute V');
      ui.distVBtn.title = 'Distribute vertically';
      ui.distributeRow.append(ui.distHBtn, ui.distVBtn);
      const zRow = el('div', 'btn-row');
      ui.forwardBtn = el('button', '', 'Bring forward');
      ui.forwardBtn.title = 'Bring forward';
      ui.backwardBtn = el('button', '', 'Send backward');
      ui.backwardBtn.title = 'Send backward';
      zRow.append(ui.forwardBtn, ui.backwardBtn);
      const zRow2 = el('div', 'btn-row');
      ui.frontBtn = el('button', '', 'To front');
      ui.frontBtn.title = 'Bring to front';
      ui.backBtn = el('button', '', 'To back');
      ui.backBtn.title = 'Send to back';
      zRow2.append(ui.frontBtn, ui.backBtn);
      // group/ungroup + lock/unlock + duplicate (O8)
      const gRow = el('div', 'btn-row');
      ui.groupBtn = el('button', '', 'Group');
      ui.groupBtn.title = 'Group selection (Ctrl+G)';
      ui.ungroupBtn = el('button', '', 'Ungroup');
      ui.ungroupBtn.title = 'Ungroup (Ctrl+Shift+G)';
      gRow.append(ui.groupBtn, ui.ungroupBtn);
      const lRow = el('div', 'btn-row');
      ui.lockBtn = el('button', '', 'Lock');
      ui.lockBtn.title = 'Lock / unlock (prevents moving, scaling, selecting)';
      ui.duplicateBtn = el('button', '', 'Duplicate');
      ui.duplicateBtn.title = 'Duplicate (Ctrl+D)';
      lRow.append(ui.lockBtn, ui.duplicateBtn);
      arrange.append(alignGrid, ui.distributeRow, zRow, zRow2, gRow, lRow);

      // text
      ui.textSection = el('section', 'hidden');
      ui.textSection.appendChild(el('h3', '', 'Text'));
      ui.fontFamily = document.createElement('select');
      ui.textSection.appendChild(railLabel('Font family', ui.fontFamily));
      const sizeRow = el('div', 'prop-row');
      ui.fontSize = document.createElement('input');
      ui.fontSize.type = 'number';
      ui.fontSize.min = '8'; ui.fontSize.max = '400'; ui.fontSize.step = '1';
      const sizeLabel = railLabel('Size', ui.fontSize);
      sizeLabel.classList.add('half');
      ui.fontWeight = document.createElement('select');
      for (const [value, name] of [
        ['normal', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'],
        ['700', 'Bold'], ['800', 'Extrabold'], ['900', 'Black']
      ]) {
        const opt = el('option', '', name);
        opt.value = value;
        ui.fontWeight.appendChild(opt);
      }
      const weightLabel = railLabel('Weight', ui.fontWeight);
      weightLabel.classList.add('half');
      sizeRow.append(sizeLabel, weightLabel);
      ui.textSection.appendChild(sizeRow);

      const styleRow = el('div', 'btn-row');
      ui.italicBtn = el('button');
      ui.italicBtn.title = 'Italic';
      ui.italicBtn.appendChild(el('i', '', 'I'));
      ui.underlineBtn = el('button');
      ui.underlineBtn.title = 'Underline';
      ui.underlineBtn.appendChild(el('u', '', 'U'));
      styleRow.append(ui.italicBtn, ui.underlineBtn, el('span', 'rail-sep'));
      ui.textAlignBtns = [];
      for (const [align, glyph, title] of [
        ['left', '⯇', 'Align text left'], ['center', '≡', 'Center text'], ['right', '⯈', 'Align text right']
      ]) {
        const btn = el('button', '', glyph);
        btn.dataset.textalign = align;
        btn.title = title;
        ui.textAlignBtns.push(btn);
        styleRow.appendChild(btn);
      }
      ui.textSection.appendChild(styleRow);

      // per-element text color (per-object fabric `fill` — the selection swatch)
      ui.textColor = document.createElement('input');
      ui.textColor.type = 'color';
      ui.textSection.appendChild(railLabel('Color', ui.textColor));
      const spacingRow = el('div', 'prop-row');
      ui.lineHeight = document.createElement('input');
      ui.lineHeight.type = 'number';
      ui.lineHeight.min = '0.5'; ui.lineHeight.max = '4'; ui.lineHeight.step = '0.05';
      const lhLabel = railLabel('Line height', ui.lineHeight);
      lhLabel.classList.add('half');
      ui.charSpacing = document.createElement('input');
      ui.charSpacing.type = 'number';
      ui.charSpacing.min = '-200'; ui.charSpacing.max = '1000'; ui.charSpacing.step = '10';
      const csLabel = railLabel('Letter spacing', ui.charSpacing);
      csLabel.classList.add('half');
      spacingRow.append(lhLabel, csLabel);
      ui.textSection.appendChild(spacingRow);

      // shape fill
      ui.shapeSection = el('section', 'hidden');
      ui.shapeSection.appendChild(el('h3', '', 'Fill'));
      ui.shapeFill = document.createElement('input');
      ui.shapeFill.type = 'color';
      ui.shapeSection.appendChild(railLabel('Color', ui.shapeFill));

      // image
      ui.imageSection = el('section', 'hidden');
      ui.imageSection.appendChild(el('h3', '', 'Image'));
      const imgRow1 = el('div', 'btn-row');
      ui.replaceImageBtn = el('button', '', 'Replace…');
      ui.regenImageBtn = el('button', 'hidden', 'Regenerate');
      imgRow1.append(ui.replaceImageBtn, ui.regenImageBtn);
      const imgRow2 = el('div', 'btn-row');
      ui.flipHBtn = el('button', '', 'Flip H');
      ui.flipHBtn.title = 'Flip horizontally';
      ui.flipVBtn = el('button', '', 'Flip V');
      ui.flipVBtn.title = 'Flip vertically';
      imgRow2.append(ui.flipHBtn, ui.flipVBtn);
      ui.imageSection.append(imgRow1, imgRow2);

      // Slot-image fit controls (I6): a generated/uploaded image fills its slot
      // frame (cover-fit + clipPath from the server); these let the user pick a
      // fit mode, zoom, and drag to pan WITHIN the frame — no re-upload needed.
      ui.imgFitBox = el('div', 'img-fit-box hidden');
      ui.imgFitBox.appendChild(el('span', 'rail-sublabel', 'Fit mode'));
      const fitRow = el('div', 'seg-group');
      ui.fitBtns = [];
      for (const [mode, label] of [['cover', 'Cover'], ['contain', 'Contain'], ['fill', 'Fill'], ['full-bleed', 'Bleed'], ['free', 'Free']]) {
        const b = el('button', 'seg-btn', label);
        b.dataset.fit = mode;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-label', `Fit: ${mode}`);
        b.title = mode === 'cover' ? 'Cover-fit inside slot frame (default)'
          : mode === 'contain' ? 'Letterbox inside slot frame'
          : mode === 'fill' ? 'Stretch to fill slot frame exactly'
          : mode === 'full-bleed' ? 'Expand to cover the whole canvas'
          : 'Remove clip — freely movable anywhere (double-click to toggle)';
        ui.fitBtns.push(b);
        fitRow.appendChild(b);
      }
      fitRow.setAttribute('role', 'radiogroup');
      fitRow.setAttribute('aria-label', 'Image fit mode');
      ui.imgFitBox.appendChild(fitRow);
      ui.imgZoom = document.createElement('input');
      ui.imgZoom.type = 'range';
      ui.imgZoom.min = '100'; ui.imgZoom.max = '300'; ui.imgZoom.step = '5';
      ui.imgZoom.setAttribute('aria-label', 'Image zoom (only in clipped modes)');
      ui.imgFitBox.appendChild(railLabel('Zoom', ui.imgZoom));
      // Reset to server cover-fit
      ui.imgResetBtn = el('button', 'rail-btn', 'Reset to default fit');
      ui.imgResetBtn.title = 'Restore original server cover-fit and clip';
      ui.imgFitBox.appendChild(ui.imgResetBtn);
      ui.imgFitHint = el('p', 'rail-hint', 'Cover/Contain/Fill: drag within frame. Free: drag anywhere, resize freely. Double-click image to toggle Free mode.');
      ui.imgFitBox.appendChild(ui.imgFitHint);
      ui.imageSection.append(ui.imgFitBox);

      // common
      const common = el('section');
      common.appendChild(el('h3', '', 'Object'));
      ui.opacityInput = document.createElement('input');
      ui.opacityInput.type = 'range';
      ui.opacityInput.min = '0'; ui.opacityInput.max = '100'; ui.opacityInput.step = '1';
      common.appendChild(railLabel('Opacity', ui.opacityInput));
      ui.deleteBtn = el('button', 'rail-btn danger', 'Delete');
      common.appendChild(ui.deleteBtn);

      ui.objProps.append(arrange, ui.textSection, ui.shapeSection, ui.imageSection, common);
      ui.propsStatus = el('p', 'status');
      panel.append(ui.noSelection, ui.objProps, ui.propsStatus);
      return panel;
    }

    // ── floating context toolbar (Canva-style, appears above selection) ─────────
    //
    // Built once, absolutely positioned over document.body. Shown/repositioned
    // whenever a Textbox is selected; hidden on selection:cleared. Operates on
    // the active single Textbox on the focused canvas. Controls mirror the
    // right-panel props but are reachable without moving the mouse to the panel.

    function buildContextToolbar() {
      const bar = el('div', 'ctx-toolbar hidden');
      bar.setAttribute('role', 'toolbar');
      bar.setAttribute('aria-label', 'Text object toolbar');

      // font size stepper
      ui.ctxFontDec = el('button', 'ctx-btn', '−');
      ui.ctxFontDec.title = 'Decrease font size';
      ui.ctxFontSizeLabel = el('span', 'ctx-size-label', '40');
      ui.ctxFontInc = el('button', 'ctx-btn', '+');
      ui.ctxFontInc.title = 'Increase font size';

      // bold toggle
      ui.ctxBoldBtn = el('button', 'ctx-btn ctx-bold', 'B');
      ui.ctxBoldBtn.title = 'Bold (Ctrl+B)';

      // align cycle
      ui.ctxAlignBtn = el('button', 'ctx-btn', '⯇');
      ui.ctxAlignBtn.title = 'Text alignment';
      ui.ctxAlignBtn.dataset.align = 'left';

      // text color swatches (poster palette + custom input) — the swatch set is
      // (re)built from designState.design.palette by rebuildCtxSwatches() once
      // the design loads; PALETTE_SWATCHES is the pre-load fallback.
      ui.ctxColorWrap = el('span', 'ctx-color-wrap');
      ui.ctxColorInput = document.createElement('input');
      ui.ctxColorInput.type = 'color';
      ui.ctxColorInput.title = 'Custom text color';
      ui.ctxColorInput.className = 'ctx-color-input';
      ui.ctxColorSwatches = [];
      buildCtxSwatchButtons(PALETTE_SWATCHES);

      // contrast readout vs the object's bgRef (WCAG ratio + pass/fail chip)
      ui.ctxContrast = el('span', 'ctx-contrast');
      ui.ctxContrast.title = 'Contrast of the text color against its background (WCAG). ≥4.5:1 passes for body text.';

      // line-height stepper
      ui.ctxLhDec = el('button', 'ctx-btn', '↕−');
      ui.ctxLhDec.title = 'Decrease line height';
      ui.ctxLhInc = el('button', 'ctx-btn', '↕+');
      ui.ctxLhInc.title = 'Increase line height';

      // opacity slider
      ui.ctxOpacity = document.createElement('input');
      ui.ctxOpacity.type = 'range';
      ui.ctxOpacity.min = '0'; ui.ctxOpacity.max = '100'; ui.ctxOpacity.step = '1';
      ui.ctxOpacity.title = 'Opacity';
      ui.ctxOpacity.className = 'ctx-opacity';

      // layer order
      ui.ctxForwardBtn = el('button', 'ctx-btn', '▲');
      ui.ctxForwardBtn.title = 'Bring forward';
      ui.ctxBackwardBtn = el('button', 'ctx-btn', '▼');
      ui.ctxBackwardBtn.title = 'Send backward';

      // duplicate
      ui.ctxDupBtn = el('button', 'ctx-btn', '⧉');
      ui.ctxDupBtn.title = 'Duplicate (Ctrl+D)';

      // delete
      ui.ctxDeleteBtn = el('button', 'ctx-btn ctx-delete', '✕');
      ui.ctxDeleteBtn.title = 'Delete (Delete key)';

      // regenerate (shown only for bound text)
      ui.ctxRegenBtn = el('button', 'ctx-btn ctx-regen hidden', '↻ Regenerate');
      ui.ctxRegenBtn.title = 'Regenerate this text with AI';

      ui.ctxColorWrap.appendChild(ui.ctxColorInput);

      const sep = () => el('span', 'ctx-sep');
      bar.append(
        ui.ctxFontDec, ui.ctxFontSizeLabel, ui.ctxFontInc, sep(),
        ui.ctxBoldBtn, ui.ctxAlignBtn, sep(),
        ui.ctxColorWrap, ui.ctxContrast, sep(),
        ui.ctxLhDec, ui.ctxLhInc, sep(),
        ui.ctxOpacity, sep(),
        ui.ctxForwardBtn, ui.ctxBackwardBtn, sep(),
        ui.ctxDupBtn, ui.ctxDeleteBtn,
        ui.ctxRegenBtn
      );
      overlays.push(bar);
      document.body.appendChild(bar);
      ui.ctxToolbar = bar;
    }

    /**
     * (Re)build the palette swatch buttons in the context toolbar from a list
     * of hex colors. Wires each swatch's click to set the active text fill.
     * Called once with PALETTE_SWATCHES at build, then again from
     * rebuildCtxSwatches() when designState.design.palette is known.
     */
    function buildCtxSwatchButtons(colors) {
      // clear existing swatch buttons (keep the color input at the end)
      for (const sw of ui.ctxColorSwatches) sw.remove();
      ui.ctxColorSwatches = [];
      const seen = new Set();
      const list = [];
      for (const c of colors) {
        const hex = toHex6(c, '');
        if (hex && !seen.has(hex)) { seen.add(hex); list.push(hex); }
      }
      for (const hex of list) {
        const sw = el('button', 'ctx-swatch');
        sw.style.background = hex;
        sw.title = hex;
        sw.dataset.color = hex;
        sw.addEventListener('click', () => {
          applyToActive({ fill: sw.dataset.color });
          updateContextToolbar();
          renderProps();
        });
        ui.ctxColorSwatches.push(sw);
      }
      // insert before the custom color input
      for (const sw of ui.ctxColorSwatches) ui.ctxColorWrap.insertBefore(sw, ui.ctxColorInput);
    }

    /** Swap the context-toolbar swatches to the poster's palette + brand basics. */
    function rebuildCtxSwatches() {
      const p = designState && designState.design && designState.design.palette;
      if (!p) return;
      const paletteColors = [p.primary, p.secondary, p.accent, p.background, p.dark]
        .filter(Boolean);
      // palette first, then a couple of neutral basics for legibility choices
      buildCtxSwatchButtons([...paletteColors, '#ffffff', '#1f1a17']);
    }

    /** Update the contrast readout for the active text object vs its bgRef. */
    function updateContrastReadout(obj) {
      const L = lintApi();
      const box = ui.ctxContrast;
      if (!box) return;
      const fill = toHex6(obj && obj.fill, '');
      const bg = toHex6(obj && obj.bgRef, '');
      if (!L || !obj || !HEX6.test(fill) || !HEX6.test(bg)) {
        box.textContent = '';
        box.className = 'ctx-contrast';
        return;
      }
      const ratio = L.contrastRatio(fill, bg);
      const large = (obj.fontSize || 0) >= 32 && Number(obj.fontWeight) >= 700;
      const need = large ? 3 : 4.5;
      const pass = ratio >= need;
      box.textContent = `${ratio.toFixed(1)}:1`;
      box.className = 'ctx-contrast ' + (pass ? 'ctx-contrast-ok' : 'ctx-contrast-bad');
      box.title = `${ratio.toFixed(2)}:1 vs background ${bg} — ${pass ? 'passes' : 'below'} ${need}:1`;
    }

    /**
     * Reposition the floating toolbar above the selection bounding box.
     * Uses the focused side's canvas element position in the viewport.
     */
    function positionContextToolbar() {
      const bar = ui.ctxToolbar;
      if (!bar || !fc) return;
      const obj = activeSingle();
      if (!obj) { bar.classList.add('hidden'); return; }
      const r = obj.getBoundingRect(); // canvas-space
      const canvasEl = focusedSide.canvasEl;
      if (!canvasEl) return;
      const cr = canvasEl.getBoundingClientRect();
      const z = focusedSide.zoom || 1;
      // map canvas-space top-left → viewport coords
      const vptLeft = cr.left + r.left * z;
      const vptTop = cr.top + r.top * z;
      const barH = bar.offsetHeight || 44;
      const pad = 8;
      const top = Math.max(pad, vptTop - barH - pad + window.scrollY);
      const left = Math.max(pad, vptLeft + window.scrollX);
      bar.style.top = `${top}px`;
      bar.style.left = `${left}px`;
    }

    /**
     * Refresh the floating toolbar's button state from the selected object,
     * then reposition it. Called whenever the selection changes.
     */
    function updateContextToolbar() {
      const bar = ui.ctxToolbar;
      if (!bar) return;
      const obj = activeSingle();
      if (!obj || !isTextObj(obj)) {
        bar.classList.add('hidden');
        // If an image is selected, show the image toolbar instead
        if (obj && isImageObj(obj)) updateImageContextToolbar();
        return;
      }
      // Hide image toolbar when text is selected
      if (ui.imgCtxToolbar) ui.imgCtxToolbar.classList.add('hidden');
      // font size
      const sz = Math.round(obj.fontSize || 40);
      ui.ctxFontSizeLabel.textContent = sz;

      // bold
      const isBold = String(obj.fontWeight || 'normal') === '700' || obj.fontWeight === 'bold';
      ui.ctxBoldBtn.classList.toggle('ctx-active', isBold);

      // align
      const align = obj.textAlign || 'left';
      const alignGlyph = { left: '⯇', center: '≡', right: '⯈' };
      ui.ctxAlignBtn.textContent = alignGlyph[align] || '⯇';
      ui.ctxAlignBtn.dataset.align = align;

      // color
      const fill = toHex6(obj.fill);
      ui.ctxColorInput.value = fill;
      for (const sw of ui.ctxColorSwatches) {
        sw.classList.toggle('ctx-swatch-active', sw.dataset.color === fill);
      }

      // O8: contrast readout vs the object's bgRef
      updateContrastReadout(obj);

      // opacity
      ui.ctxOpacity.value = Math.round((obj.opacity ?? 1) * 100);

      // regenerate button: show only for bound text (has layerRole ≠ user-text, or msgId/fieldRef)
      const isBound = (obj.layerRole && obj.layerRole !== 'user-text') || obj.msgId;
      ui.ctxRegenBtn.classList.toggle('hidden', !isBound);

      bar.classList.remove('hidden');
      // defer positioning so the bar is visible and has layout
      requestAnimationFrame(() => positionContextToolbar());
    }

    /**
     * Wire the context toolbar buttons. Called once after buildContextToolbar().
     * All operations apply to the focused canvas's active Textbox and mark dirty.
     */
    function wireContextToolbar() {
      // font size stepper
      ui.ctxFontDec.addEventListener('click', () => {
        const obj = activeSingle();
        if (!isTextObj(obj)) return;
        const next = Math.max(AUTOFIT_FLOOR_PX, (obj.fontSize || 40) - 2);
        applyToActive({ fontSize: next });
        updateContextToolbar();
        renderProps();
      });
      ui.ctxFontInc.addEventListener('click', () => {
        const obj = activeSingle();
        if (!isTextObj(obj)) return;
        const next = Math.min(400, (obj.fontSize || 40) + 2);
        applyToActive({ fontSize: next });
        updateContextToolbar();
        renderProps();
      });

      // bold toggle
      ui.ctxBoldBtn.addEventListener('click', () => {
        const obj = activeSingle();
        if (!isTextObj(obj)) return;
        const isBold = String(obj.fontWeight || 'normal') === '700' || obj.fontWeight === 'bold';
        applyToActive({ fontWeight: isBold ? 'normal' : '700' });
        updateContextToolbar();
        renderProps();
      });

      // align cycle: left → center → right → left
      ui.ctxAlignBtn.addEventListener('click', () => {
        const obj = activeSingle();
        if (!isTextObj(obj)) return;
        const cur = obj.textAlign || 'left';
        const next = { left: 'center', center: 'right', right: 'left' }[cur] || 'left';
        applyToActive({ textAlign: next });
        updateContextToolbar();
        renderProps();
      });

      // color swatches are wired in buildCtxSwatchButtons (rebuilt per palette)
      ui.ctxColorInput.addEventListener('input', () => {
        applyToActive({ fill: ui.ctxColorInput.value });
        updateContextToolbar();
        renderProps();
      });

      // line-height steppers (step 0.05)
      ui.ctxLhDec.addEventListener('click', () => {
        const obj = activeSingle();
        if (!isTextObj(obj)) return;
        const lh = Math.max(0.5, ((obj.lineHeight ?? 1.16) - 0.05));
        applyToActive({ lineHeight: Math.round(lh * 100) / 100 });
        renderProps();
      });
      ui.ctxLhInc.addEventListener('click', () => {
        const obj = activeSingle();
        if (!isTextObj(obj)) return;
        const lh = Math.min(4, ((obj.lineHeight ?? 1.16) + 0.05));
        applyToActive({ lineHeight: Math.round(lh * 100) / 100 });
        renderProps();
      });

      // opacity slider
      ui.ctxOpacity.addEventListener('input', () => {
        const obj = activeSingle();
        if (!obj) return;
        const value = Number(ui.ctxOpacity.value) / 100;
        obj.set('opacity', value);
        fc.requestRenderAll();
        onCanvasChanged();
        if (ui.opacityInput) ui.opacityInput.value = ui.ctxOpacity.value;
      });

      // layer order
      ui.ctxForwardBtn.addEventListener('click', () => {
        const obj = activeSingle();
        if (!obj) return;
        fc.bringObjectForward(obj);
        fc.requestRenderAll();
        onCanvasChanged();
      });
      ui.ctxBackwardBtn.addEventListener('click', () => {
        const obj = activeSingle();
        if (!obj) return;
        fc.sendObjectBackwards(obj);
        fc.requestRenderAll();
        onCanvasChanged();
      });

      // duplicate
      ui.ctxDupBtn.addEventListener('click', () => duplicateSelection());

      // delete
      ui.ctxDeleteBtn.addEventListener('click', () => {
        deleteSelection();
        updateContextToolbar();
      });

      // regenerate
      ui.ctxRegenBtn.addEventListener('click', () => regenSelectedText());
    }

    // ── floating IMAGE context toolbar (above selected image objects) ────────────
    //
    // Parallel to the text ctx-toolbar but for Image objects (slot images and
    // free images). Shows fit-mode buttons, a zoom slider, opacity, layer order,
    // and delete. Built once, absolutely positioned over document.body.

    function buildImageContextToolbar() {
      const bar = el('div', 'ctx-toolbar ctx-img-toolbar hidden');
      bar.setAttribute('role', 'toolbar');
      bar.setAttribute('aria-label', 'Image object toolbar');

      // Fit mode buttons
      ui.imgCtxFitBtns = [];
      for (const [mode, label, title] of [
        ['cover', 'Cover', 'Cover-fit inside slot (default)'],
        ['contain', 'Contain', 'Letterbox inside slot'],
        ['fill', 'Fill', 'Stretch to fill slot'],
        ['full-bleed', 'Bleed', 'Expand to cover whole canvas'],
        ['free', 'Free', 'Remove clip – freely movable anywhere (double-click to toggle)']
      ]) {
        const b = el('button', 'ctx-btn', label);
        b.dataset.imgFit = mode;
        b.title = title;
        ui.imgCtxFitBtns.push(b);
        bar.appendChild(b);
      }

      const sep = () => el('span', 'ctx-sep');
      bar.appendChild(sep());

      // Zoom slider (disabled in free/full-bleed)
      ui.imgCtxZoomLabel = el('span', 'ctx-size-label', '100%');
      ui.imgCtxZoom = document.createElement('input');
      ui.imgCtxZoom.type = 'range';
      ui.imgCtxZoom.min = '50'; ui.imgCtxZoom.max = '300'; ui.imgCtxZoom.step = '5';
      ui.imgCtxZoom.value = '100';
      ui.imgCtxZoom.title = 'Zoom image within frame';
      ui.imgCtxZoom.className = 'ctx-opacity'; // reuse same width style
      ui.imgCtxZoom.setAttribute('aria-label', 'Image zoom');
      bar.appendChild(ui.imgCtxZoomLabel);
      bar.appendChild(ui.imgCtxZoom);

      bar.appendChild(sep());

      // Reset to server cover-fit
      ui.imgCtxResetBtn = el('button', 'ctx-btn', '↺ Reset');
      ui.imgCtxResetBtn.title = 'Reset to original cover-fit';
      bar.appendChild(ui.imgCtxResetBtn);

      bar.appendChild(sep());

      // Opacity
      ui.imgCtxOpacity = document.createElement('input');
      ui.imgCtxOpacity.type = 'range';
      ui.imgCtxOpacity.min = '0'; ui.imgCtxOpacity.max = '100'; ui.imgCtxOpacity.step = '1';
      ui.imgCtxOpacity.title = 'Opacity';
      ui.imgCtxOpacity.className = 'ctx-opacity';
      bar.appendChild(ui.imgCtxOpacity);

      bar.appendChild(sep());

      // Layer order
      ui.imgCtxForwardBtn = el('button', 'ctx-btn', '▲');
      ui.imgCtxForwardBtn.title = 'Bring forward';
      ui.imgCtxBackwardBtn = el('button', 'ctx-btn', '▼');
      ui.imgCtxBackwardBtn.title = 'Send backward';
      bar.append(ui.imgCtxForwardBtn, ui.imgCtxBackwardBtn);

      bar.appendChild(sep());

      // Delete
      ui.imgCtxDeleteBtn = el('button', 'ctx-btn ctx-delete', '✕');
      ui.imgCtxDeleteBtn.title = 'Delete image (guard: background cannot be deleted)';
      bar.appendChild(ui.imgCtxDeleteBtn);

      overlays.push(bar);
      document.body.appendChild(bar);
      ui.imgCtxToolbar = bar;
    }

    function positionImageContextToolbar() {
      const bar = ui.imgCtxToolbar;
      if (!bar || !fc) return;
      const obj = activeSingle();
      if (!obj) { bar.classList.add('hidden'); return; }
      const r = obj.getBoundingRect();
      const canvasEl = focusedSide.canvasEl;
      if (!canvasEl) return;
      const cr = canvasEl.getBoundingClientRect();
      const z = focusedSide.zoom || 1;
      const vptLeft = cr.left + r.left * z;
      const vptTop = cr.top + r.top * z;
      const barH = bar.offsetHeight || 44;
      const pad = 8;
      const top = Math.max(pad, vptTop - barH - pad + window.scrollY);
      const left = Math.max(pad, vptLeft + window.scrollX);
      bar.style.top = `${top}px`;
      bar.style.left = `${left}px`;
    }

    function updateImageContextToolbar() {
      const bar = ui.imgCtxToolbar;
      if (!bar) return;
      const obj = activeSingle();
      if (!obj || !isImageObj(obj)) {
        bar.classList.add('hidden');
        return;
      }
      const isSlot = isAnySlotImage(obj);
      const mode = obj.fitMode || 'cover';
      const zoom = obj.fitZoom || 1;
      const isClipped = mode !== 'free' && mode !== 'full-bleed';

      // Fit mode buttons: only show for slot images
      for (const b of ui.imgCtxFitBtns) {
        b.classList.toggle('ctx-active', b.dataset.imgFit === mode);
        b.classList.toggle('hidden', !isSlot);
      }
      // Zoom slider
      ui.imgCtxZoom.disabled = !isSlot || !isClipped;
      if (isSlot && isClipped) {
        ui.imgCtxZoom.value = Math.round(zoom * 100);
        ui.imgCtxZoomLabel.textContent = `${Math.round(zoom * 100)}%`;
      } else {
        ui.imgCtxZoomLabel.textContent = '–';
      }
      ui.imgCtxResetBtn.classList.toggle('hidden', !isSlot);

      // Opacity
      ui.imgCtxOpacity.value = Math.round((obj.opacity ?? 1) * 100);

      bar.classList.remove('hidden');
      requestAnimationFrame(() => positionImageContextToolbar());
    }

    function wireImageContextToolbar() {
      // Fit mode
      for (const btn of ui.imgCtxFitBtns) {
        btn.addEventListener('click', () => {
          const obj = activeSingle();
          if (!obj || !isAnySlotImage(obj)) return;
          applyImageFit(obj, btn.dataset.imgFit, obj.fitZoom || 1);
          fc.requestRenderAll();
          renderProps();
          onCanvasChanged();
          updateImageContextToolbar();
        });
      }

      // Zoom slider
      ui.imgCtxZoom.addEventListener('input', () => {
        const obj = activeSingle();
        if (!isSlotImage(obj)) return;
        const z = Number(ui.imgCtxZoom.value) / 100;
        applyImageFit(obj, obj.fitMode || 'cover', z);
        ui.imgCtxZoomLabel.textContent = `${ui.imgCtxZoom.value}%`;
        fc.requestRenderAll();
        onCanvasChanged();
        // also update right-panel zoom slider
        if (ui.imgZoom) { ui.imgZoom.value = ui.imgCtxZoom.value; }
      });

      // Reset
      ui.imgCtxResetBtn.addEventListener('click', () => {
        const obj = activeSingle();
        if (!isAnySlotImage(obj)) return;
        resetImageToServerFit(obj);
        fc.requestRenderAll();
        renderProps();
        onCanvasChanged();
        updateImageContextToolbar();
      });

      // Opacity
      ui.imgCtxOpacity.addEventListener('input', () => {
        const obj = activeSingle();
        if (!obj) return;
        obj.set('opacity', Number(ui.imgCtxOpacity.value) / 100);
        fc.requestRenderAll();
        onCanvasChanged();
        if (ui.opacityInput) ui.opacityInput.value = ui.imgCtxOpacity.value;
      });

      // Layer order
      ui.imgCtxForwardBtn.addEventListener('click', () => {
        const obj = activeSingle();
        if (!obj) return;
        fc.bringObjectForward(obj);
        fc.requestRenderAll();
        onCanvasChanged();
      });
      ui.imgCtxBackwardBtn.addEventListener('click', () => {
        const obj = activeSingle();
        if (!obj) return;
        fc.sendObjectBackwards(obj);
        fc.requestRenderAll();
        onCanvasChanged();
      });

      // Delete
      ui.imgCtxDeleteBtn.addEventListener('click', () => {
        deleteSelection();
        updateImageContextToolbar();
      });
    }

    function modalShell(titleText, ariaLabel) {
      const modal = el('div', 'modal hidden');
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', ariaLabel);
      const inner = el('div', 'modal-inner');
      const header = el('div', 'modal-header');
      const h3 = el('h3', '', titleText);
      const closeBtn = el('button', '', '✕');
      closeBtn.setAttribute('aria-label', 'Close');
      header.append(h3, closeBtn);
      inner.appendChild(header);
      modal.appendChild(inner);
      return { modal, inner, h3, closeBtn };
    }

    function buildOverlays() {
      // sync-available banner
      ui.syncBanner = el('div', 'sync-banner hidden');
      ui.syncBanner.setAttribute('role', 'status');
      ui.syncBannerMsg = el('span', 'sync-banner-msg');
      const syncActions = el('div', 'sync-banner-actions');
      ui.syncAllBtn = el('button', 'primary', 'Sync all');
      ui.keepIndividualBtn = el('button', '', 'Keep individual');
      syncActions.append(ui.syncAllBtn, ui.keepIndividualBtn);
      ui.syncBanner.append(ui.syncBannerMsg, syncActions);

      // translate modal
      {
        const { modal, inner, closeBtn } = modalShell('Translate poster', 'Translate poster');
        ui.translateModal = modal;
        ui.closeTranslateModal = closeBtn;
        inner.appendChild(el('p', 'hint',
          'Choose which languages to generate. Translation runs a fidelity-checked AI loop per language and may take a minute or two.'));
        ui.translateTargets = el('div', 'translate-targets');
        ui.translateModalStatus = el('p', 'status');
        ui.translateFailures = el('div', 'translate-failures hidden');
        const row = el('div', 'row');
        row.style.marginTop = '14px';
        ui.startTranslateBtn = el('button', 'primary', 'Translate');
        ui.startTranslateBtn.disabled = true;
        ui.translateSpinner = el('span', 'translate-spinner hidden', 'Translating…');
        row.append(ui.startTranslateBtn, ui.translateSpinner);
        inner.append(ui.translateTargets, ui.translateModalStatus, ui.translateFailures, row);
      }

      // library picker modal
      {
        const { modal, inner, closeBtn } = modalShell('Pick from image library', 'Pick from image library');
        ui.libraryModal = modal;
        ui.closeLibraryModal = closeBtn;
        ui.libraryModalEmpty = el('p', 'hint hidden',
          'No images in the library yet. Upload images on the Library page.');
        ui.libraryModalGrid = el('div', 'image-grid');
        const row = el('div', 'row');
        ui.confirmLibraryPick = el('button', 'primary', 'Use selected image');
        ui.confirmLibraryPick.disabled = true;
        ui.libraryModalStatus = el('span', 'status');
        row.append(ui.confirmLibraryPick, ui.libraryModalStatus);
        inner.append(ui.libraryModalEmpty, ui.libraryModalGrid, row);
      }

      // save-as modal
      {
        const { modal, inner, h3, closeBtn } = modalShell('Save poster', 'Save poster');
        ui.saveAsModal = modal;
        ui.saveAsTitle = h3;
        ui.closeSaveAsModal = closeBtn;
        ui.saveAsNameInput = document.createElement('input');
        ui.saveAsNameInput.type = 'text';
        ui.saveAsNameInput.maxLength = 120;
        ui.saveAsNameInput.placeholder = 'Enter a name for this poster';
        inner.appendChild(railLabel('Poster name', ui.saveAsNameInput));
        ui.saveAsStatus = el('p', 'status');
        const row = el('div', 'row');
        row.style.marginTop = '14px';
        ui.confirmSaveAs = el('button', 'primary', 'Save');
        ui.cancelSaveAs = el('button', '', 'Cancel');
        row.append(ui.confirmSaveAs, ui.cancelSaveAs);
        inner.append(ui.saveAsStatus, row);
      }

      // post-save feedback prompt
      ui.feedbackPrompt = el('div', 'feedback-prompt hidden');
      ui.feedbackPrompt.setAttribute('role', 'status');
      {
        const inner = el('div', 'feedback-prompt-inner');
        inner.appendChild(el('span', 'feedback-prompt-question', 'Was this poster good?'));
        const thumbs = el('div', 'feedback-thumb-row');
        ui.feedbackGoodBtn = el('button', 'feedback-thumb', '👍 Good');
        ui.feedbackBadBtn = el('button', 'feedback-thumb', '👎 Not really');
        thumbs.append(ui.feedbackGoodBtn, ui.feedbackBadBtn);
        inner.appendChild(thumbs);
        ui.feedbackRemarksWrap = el('div', 'hidden');
        ui.feedbackRemarks = document.createElement('textarea');
        ui.feedbackRemarks.maxLength = 2000;
        ui.feedbackRemarks.rows = 2;
        ui.feedbackRemarks.placeholder = "Optional notes (what worked / what didn't)…";
        const row = el('div', 'row');
        row.style.marginTop = '8px';
        ui.submitFeedbackBtn = el('button', 'primary', 'Send');
        ui.feedbackStatus = el('span', 'status');
        row.append(ui.submitFeedbackBtn, ui.feedbackStatus);
        ui.feedbackRemarksWrap.append(ui.feedbackRemarks, row);
        inner.appendChild(ui.feedbackRemarksWrap);
        ui.skipFeedbackBtn = el('button', 'feedback-skip', 'Skip');
        inner.appendChild(ui.skipFeedbackBtn);
        ui.feedbackPrompt.appendChild(inner);
      }

      // template gallery modal
      {
        const { modal, inner, closeBtn } = modalShell('Change template', 'Change template');
        ui.templateModal = modal;
        ui.closeTemplateModal = closeBtn;
        inner.appendChild(el('p', 'hint',
          'Applying a template rebuilds the layout from your approved content — your current '
          + 'canvas layout (including unsaved changes) is replaced. The text itself is kept.'));
        ui.templateModalGallery = el('div', 'template-gallery modal-gallery');
        const row = el('div', 'row');
        ui.confirmTemplatePick = el('button', 'primary', 'Apply template');
        ui.confirmTemplatePick.disabled = true;
        ui.templateModalStatus = el('span', 'status');
        row.append(ui.confirmTemplatePick, ui.templateModalStatus);
        inner.append(ui.templateModalGallery, row);
      }

      for (const node of [ui.syncBanner, ui.translateModal, ui.libraryModal,
        ui.saveAsModal, ui.feedbackPrompt, ui.templateModal]) {
        overlays.push(node);
        document.body.appendChild(node);
      }
      // Floating context toolbars (must be built last so ui references are valid)
      buildContextToolbar();
      wireContextToolbar();
      buildImageContextToolbar();
      wireImageContextToolbar();
    }

    function buildDom() {
      container.textContent = '';
      const toolbar = buildToolbar();
      if (externalToolbar) {
        externalToolbar.appendChild(toolbar);
      } else {
        container.classList.add('editor-inline-host');
        container.appendChild(toolbar);
      }
      ui.shell = el('div', 'editor-shell');
      ui.shell.append(buildToolRail(), buildStage(), buildPropsPanel());
      container.appendChild(ui.shell);
      buildOverlays();
    }

    // ── live-preview mirror (O7): debounced onStateChange push, per side ─────

    /** Push one side (or both when omitted) into the host preview, each on its
     *  own ~100ms debounce. A side without a canvas pushes null so the host
     *  falls back to its compiled/template preview for that orientation. */
    function notifyPreviewSoon(side) {
      if (!onStateChange) return;
      for (const s of (side ? [side] : [sides.portrait, sides.landscape])) {
        if (!s.fc) continue;
        clearTimeout(s.notifyTimer);
        s.notifyTimer = setTimeout(() => {
          if (destroyed || !s.fc) return;
          try {
            onStateChange({ canvases: { [s.orientation]: s.exists ? serializeCanvas(s) : null } });
          } catch { /* a broken host subscriber must never wedge the editor */ }
        }, NOTIFY_MS);
      }
    }

    // ── canvas load / serialize (custom-prop round trip) ─────────────────────

    async function loadCanvasJson(side, json) {
      side.suppressEvents = true;
      let fitChanged = false;
      try {
        await side.fc.loadFromJSON({
          version: json.version, objects: json.objects || [], background: json.background || ''
        });
        reattachProps(side.fc.getObjects(), json.objects);
        // Auto-fit on load: step down fontSize for any bound Textbox whose text
        // overflows its box (fixes AI-filled overflow from the design pipeline).
        // Also UNLOCK all image objects so the user can select/move/scale them.
        for (const obj of side.fc.getObjects()) {
          if (isTextObj(obj)) {
            const before = obj.fontSize;
            autofitObj(obj);
            if (obj.fontSize !== before) fitChanged = true;
          }
          // Ensure image objects are interactive (server JSON may not set these).
          if (isImageObj(obj)) {
            obj.set({ selectable: true, evented: true, hasControls: true, hasBorders: true });
          }
        }
        side.fc.requestRenderAll();
      } finally {
        side.suppressEvents = false;
      }
      // O8: re-apply persisted locks (edLocked) so a locked object stays locked.
      reapplyLocks(side);
      // If fit changed objects, mark dirty so the corrected sizes persist
      // (suppressEvents is now false so markDirty → autosave works normally)
      if (fitChanged) markDirty(side);
      if (side === focusedSide) {
        renderSwatches();
        renderProps();
        syncBgSwatch();
        refreshLayers();
      }
      // O8: lint the freshly loaded canvas (badge + red outlines from t0)
      scheduleLint(side);
    }

    function serializeCanvas(side = focusedSide) {
      const json = side.fc.toObject(EXTRA_PROPS);
      json.width = DIMS[side.orientation].w;
      json.height = DIMS[side.orientation].h;
      relativizeSrcs(json);
      return json;
    }

    // ── undo / redo (JSON-state stack, one per canvas) ───────────────────────

    function resetHistory(side) {
      side.states = [serializeCanvas(side)];
      side.stateIdx = 0;
      updateUndoButtons();
    }

    function pushHistorySoon(side = focusedSide) {
      clearTimeout(side.historyTimer);
      side.historyTimer = setTimeout(() => {
        side.states = side.states.slice(0, side.stateIdx + 1);
        side.states.push(serializeCanvas(side));
        if (side.states.length > HISTORY_CAP) side.states.shift();
        side.stateIdx = side.states.length - 1;
        updateUndoButtons();
      }, HISTORY_DEBOUNCE_MS);
    }

    async function restoreState(side, idx) {
      if (idx < 0 || idx >= side.states.length) return;
      clearTimeout(side.historyTimer);
      side.stateIdx = idx;
      side.fc.discardActiveObject();
      await loadCanvasJson(side, side.states[idx]);
      updateUndoButtons();
      markDirty(side);
    }

    /** Undo/redo buttons reflect the FOCUSED canvas's stack. */
    function updateUndoButtons() {
      ui.undoBtn.disabled = focusedSide.stateIdx <= 0;
      ui.redoBtn.disabled = focusedSide.stateIdx >= focusedSide.states.length - 1;
    }

    // ── dirty tracking / autosave / save (per-orientation queued-save chains) ─

    /** One toolbar dot for both canvases: shown while EITHER side is dirty. */
    function updateDirtyDot() {
      ui.dirtyDot.classList.toggle('hidden', !(sides.portrait.dirty || sides.landscape.dirty));
    }

    function markDirty(side = focusedSide) {
      side.dirty = true;
      side.changeSeq += 1;
      updateDirtyDot();
      clearTimeout(side.autosaveTimer);
      side.autosaveTimer = setTimeout(() => doSave(side, false), AUTOSAVE_MS);
      notifyPreviewSoon(side); // every mutating edit mirrors into the host preview
    }

    /** A canvas change from the user: dirty + autosave + history in one place.
     *  O8: also schedules the debounced live-lint and refreshes the layers list
     *  (only for the focused side; hidden-side edits still lint/save). */
    function onCanvasChanged(side = focusedSide) {
      if (side.suppressEvents) return;
      markDirty(side);
      pushHistorySoon(side);
      scheduleLint(side);
      if (side === focusedSide) refreshLayers();
    }

    /**
     * Save ONE side's canvas to its orientation. Each side owns an independent
     * queued-save chain with the same deferred/drain discipline as before:
     * if a save for THIS side is already in flight (or a server op has autosave
     * paused), queue ONE follow-up and hand back an externally-resolved
     * deferred. Never chain the retry onto the promise being returned — a
     * self-referential chain (A adopts B, B waits on A) deadlocks while
     * serverOpDepth > 0, and a hung flushAutosave() silently kills language
     * switching. drainQueuedSave(side) — called when the in-flight save lands
     * AND when the server op ends — resolves the deferred once the queued save
     * actually completes. There is never more than ONE in-flight PUT per
     * (orientation, lang) pair: orientation is fixed per chain and lang is
     * captured at request time (langAtSave, C4).
     */
    function doSave(side, manual) {
      if (!side.fc || !side.exists) {
        // a side with no canvas has nothing to persist — drop any stray dirty
        // flag so flushAutosave can never loop on an unsaveable side
        side.dirty = false;
        updateDirtyDot();
        return Promise.resolve();
      }
      if (!side.dirty && !manual) return Promise.resolve();
      if (side.saving || serverOpDepth > 0) {
        side.saveQueued = true;
        if (!side.queuedSaveDeferred) {
          let resolve;
          const promise = new Promise((r) => { resolve = r; });
          side.queuedSaveDeferred = { promise, resolve };
        }
        return side.queuedSaveDeferred.promise;
      }
      side.saving = true;
      const seqAtSave = side.changeSeq;
      // Capture the active language NOW — at request time — for C4.
      const langAtSave = activeLang;
      if (manual) flash(ui.saveStatus, 'Saving…');
      side.savePromise = (async () => {
        try {
          // Route saves: non-en lang → variant endpoint; en → design canvas;
          // orientation=landscape for the landscape side (portrait = default,
          // byte-for-byte the pre-T3 request).
          const params = new URLSearchParams();
          if (langAtSave && langAtSave !== 'en') params.set('lang', langAtSave);
          if (side.orientation === 'landscape') params.set('orientation', 'landscape');
          const qs = params.toString() ? `?${params.toString()}` : '';
          const result = await sendJson('PUT', `/api/editor/${encodeURIComponent(posterId)}/canvas${qs}`, { canvas: serializeCanvas(side) });
          side.lastSaveFailed = false;
          if (side.changeSeq === seqAtSave) {
            side.dirty = false;
            updateDirtyDot();
          }
          flash(ui.saveStatus, `Saved ${new Date().toLocaleTimeString()}`);
          if (!langAtSave || langAtSave === 'en') {
            // en saves (either orientation) return fresh safe design state
            designState = result;
            // T4: English portrait edit with all-languages scope → offer ONE
            // re-translate. Portrait only: text ownership lives on the portrait
            // canvas (landscape text mirrors into it and saves separately).
            if (side.orientation === 'portrait') {
              setTimeout(() => { if (!destroyed) maybeOfferEnRetranslate(); }, 0);
            }
          } else if (side.orientation === 'portrait' && result.syncAvailable && langAtSave === activeLang) {
            // C4: only act if the user is still on the same lang as the request.
            // T4: all-languages scope syncs automatically; this-language keeps
            // the existing ask-banner.
            if (editScope === 'all') {
              autoSyncAfterSave(langAtSave);
            } else {
              showSyncBanner(langAtSave);
            }
          }
          // landscape variant saves return syncAvailable:false — nothing to do.
        } catch (err) {
          side.lastSaveFailed = true;
          flash(ui.saveStatus, err.message, false);
        } finally {
          side.saving = false;
          side.savePromise = null;
          drainQueuedSave(side);
        }
      })();
      return side.savePromise;
    }

    /**
     * Run the queued follow-up save for ONE side (if any) once nothing blocks
     * it, and settle the waiters holding its deferred. Resolves (never
     * rejects) even when the queued save errors — flushAutosave re-checks
     * `dirty` and retries.
     */
    function drainQueuedSave(side) {
      if (!side.saveQueued || side.saving || serverOpDepth > 0) return;
      side.saveQueued = false;
      const deferred = side.queuedSaveDeferred;
      side.queuedSaveDeferred = null;
      const p = doSave(side, false);
      if (deferred) p.then(deferred.resolve, deferred.resolve);
    }

    /**
     * Flush any pending autosave for BOTH orientations of the CURRENT language
     * before switching / unmounting. Per side: loops until dirty is false AND
     * no save is in flight, so the canvas is fully persisted before the caller
     * proceeds. Bounded: after FLUSH_MAX_FAILURES consecutive failed saves it
     * gives up (dirty stays set) instead of hot-looping against a dead server —
     * unmount must never hang the host page forever.
     */
    async function flushAutosave() {
      for (const o of ORIENTATIONS) {
        const side = sides[o];
        clearTimeout(side.autosaveTimer);
        side.autosaveTimer = null;
        let failures = 0;
        while (side.dirty || side.saving) {
          if (side.dirty) {
            await doSave(side, false);
            if (side.lastSaveFailed) {
              failures += 1;
              if (failures >= FLUSH_MAX_FAILURES) break;
            } else {
              failures = 0;
            }
          } else if (side.saving && side.savePromise) {
            await side.savePromise;
          } else {
            break; // saving=false and dirty=false — this side is done
          }
        }
      }
    }

    /** Run a server-side mutation (slot fill / template apply) with autosave paused. */
    async function withServerOp(fn) {
      serverOpDepth += 1;
      for (const o of ORIENTATIONS) clearTimeout(sides[o].autosaveTimer);
      try {
        return await fn();
      } finally {
        serverOpDepth -= 1;
        for (const o of ORIENTATIONS) {
          const side = sides[o];
          drainQueuedSave(side); // run a save queued during the op NOW (flush may be waiting on it)
          if (side.dirty) markDirty(side); // reschedule the postponed autosave
        }
      }
    }

    // ── T3: focus model + view control + bound-text mirroring ────────────────

    /** The selection toolbar targets the last-FOCUSED canvas. Switching focus
     *  discards the other canvas's selection (one visible selection at a time)
     *  and re-points every fc-reading panel at the new side. */
    function setFocusedSide(side) {
      if (!side.fc || !side.exists) return;
      if (focusedSide === side) return;
      const prev = focusedSide;
      focusedSide = side;
      fc = side.fc;
      if (prev.fc) {
        prev.fc.discardActiveObject();
        prev.fc.requestRenderAll();
      }
      sides.portrait.frame.classList.toggle('focused', side === sides.portrait);
      sides.landscape.frame.classList.toggle('focused', side === sides.landscape);
      ui.zoomLabel.textContent = `${Math.round(side.zoom * 100)}%`;
      updateUndoButtons();
      renderSwatches();
      renderProps();
      syncBgSwatch();
      refreshLayers();   // O8: layers panel follows the focused canvas
      updateLintBadge(); // O8: badge reflects the focused canvas's report
    }

    function landscapeAvailable() {
      return sides.landscape.exists;
    }

    /** Three-state view control. Hidden frames keep their canvases live (state,
     *  history, pending autosaves survive a view switch). */
    function setViewMode(mode) {
      if (mode !== 'portrait' && !landscapeAvailable()) mode = 'portrait';
      sides.portrait.frame.classList.toggle('hidden', mode === 'landscape');
      sides.landscape.frame.classList.toggle('hidden', mode === 'portrait' || !landscapeAvailable());
      for (const [m, btn] of Object.entries(ui.viewButtons)) {
        btn.setAttribute('aria-pressed', String(m === mode));
        btn.classList.toggle('toggled', m === mode);
      }
      // the focused canvas must stay visible
      if (mode === 'portrait' && focusedSide === sides.landscape) setFocusedSide(sides.portrait);
      else if (mode === 'landscape' && focusedSide === sides.portrait) setFocusedSide(sides.landscape);
      // a frame that just became visible (or changed width) needs a re-fit
      for (const o of ORIENTATIONS) {
        const side = sides[o];
        if (side.exists && !side.frame.classList.contains('hidden')) zoomToFit(side);
      }
    }

    /** Enable/disable the whole control from the active language's landscape. */
    function updateViewControl() {
      const has = landscapeAvailable();
      for (const btn of Object.values(ui.viewButtons)) {
        btn.disabled = !has;
        btn.title = has ? '' : NO_LANDSCAPE_TOOLTIP;
      }
    }

    /**
     * Bound-TEXT mirroring (T3, silent): a text edit to a bound object in one
     * orientation writes the same text to the matching binding in the other
     * orientation — in memory, marking that side dirty so ITS autosave
     * persists it. Binding identity, strongest first: extraId (user text) →
     * msgId+fieldRef (v2 blocks) → layerRole, and ONLY when exactly one
     * object matches on the other canvas (never guess between ambiguous
     * roles). Geometry/style changes never reach this path — it is wired to
     * text:changed alone. Unbound text without an extraId never mirrors.
     */
    function bindingMatcher(obj) {
      if (!isTextObj(obj)) return null;
      if (obj.extraId) return (o) => o.extraId === obj.extraId;
      if (obj.msgId) return (o) => o.msgId === obj.msgId && (o.fieldRef ?? null) === (obj.fieldRef ?? null);
      if (obj.layerRole && obj.layerRole !== 'user-text') return (o) => !o.msgId && !o.extraId && o.layerRole === obj.layerRole;
      return null;
    }

    function mirrorBoundText(fromSide, obj) {
      // language-switch guard: between the two per-orientation loads the sides
      // can briefly hold different languages — never mirror across that window
      if (switchingLanguage) return;
      if (!obj || fromSide.suppressEvents) return;
      const other = fromSide === sides.portrait ? sides.landscape : sides.portrait;
      if (!other.fc || !other.exists) return;
      const matches = bindingMatcher(obj);
      if (!matches) return;
      const targets = other.fc.getObjects().filter((o) => isTextObj(o) && matches(o));
      if (targets.length !== 1 || targets[0].text === obj.text) return;
      const target = targets[0];
      other.suppressEvents = true; // belt-and-braces: never re-enter the mirror
      try {
        target.set('text', obj.text);
        target.setCoords();
        other.fc.requestRenderAll();
      } finally {
        other.suppressEvents = false;
      }
      markDirty(other);       // its own autosave persists the mirrored text
      pushHistorySoon(other); // the mirror is undoable on that canvas too
    }

    // ── T4: edit-scope toggle + all-languages flows ──────────────────────────

    function setEditScope(scope) {
      editScope = scope;
      ui.scopeThisBtn.setAttribute('aria-pressed', String(scope === 'this'));
      ui.scopeAllBtn.setAttribute('aria-pressed', String(scope === 'all'));
      ui.scopeThisBtn.classList.toggle('toggled', scope === 'this');
      ui.scopeAllBtn.classList.toggle('toggled', scope === 'all');
      enRetranslateAsked = false; // a fresh activation may ask once again
    }

    /** Visible only when the poster actually has translations. */
    function updateScopeToggle() {
      const hasTranslations = Boolean(translationState && (translationState.languages || []).length > 0);
      ui.scopeWrap.classList.toggle('hidden', !hasTranslations);
      if (!hasTranslations) ui.scopeStatus.textContent = '';
    }

    function scopeStatusLine(text, isError = false) {
      ui.scopeStatus.textContent = text;
      ui.scopeStatus.classList.toggle('err', isError);
    }

    /**
     * All-languages scope, non-English variant edit: the portrait variant save
     * came back with syncAvailable — POST the existing batch sync
     * automatically (replaces the ask-banner for that save). One sync at a
     * time; a save landing mid-sync re-queues one follow-up sync.
     */
    async function autoSyncAfterSave(lang) {
      if (syncInFlight) { syncPendingLang = lang; return; }
      syncInFlight = true;
      hideSyncBanner();
      const otherCount = Math.max(0, ((translationState && translationState.languages) || []).length - 1);
      scopeStatusLine(`Syncing to ${otherCount} language${otherCount === 1 ? '' : 's'}… (fidelity-gated)`);
      try {
        const state = await sendJson('POST', `/api/translation/${encodeURIComponent(posterId)}/${encodeURIComponent(lang)}/sync`, {});
        translationState = state;
        populateLangDropdown();
        updateScopeToggle();
        const failedSet = new Set((state.failed || []).map((f) => f.lang));
        const others = (state.languages || []).filter((l) => l.lang !== lang);
        const failed = others.filter((l) => failedSet.has(l.lang)).length
          + [...failedSet].filter((l) => l !== lang && !others.some((o) => o.lang === l)).length;
        const ok = others.length - others.filter((l) => failedSet.has(l.lang)).length;
        scopeStatusLine(
          failed
            ? `Synced to ${ok} language${ok === 1 ? '' : 's'} — ${failed} failed.`
            : `Synced to ${ok} language${ok === 1 ? '' : 's'}.`,
          failed > 0
        );
      } catch (err) {
        scopeStatusLine(`Sync failed: ${err.message}`, true);
      } finally {
        syncInFlight = false;
        if (syncPendingLang) {
          const next = syncPendingLang;
          syncPendingLang = null;
          autoSyncAfterSave(next);
        }
      }
    }

    /**
     * All-languages scope, ENGLISH edit: after the design save, ONE confirm
     * dialog per edit burst offering to re-translate the already-translated
     * set from the updated English. Declining stops the asking until the
     * scope is re-toggled or the language switches (no nagging on autosaves).
     */
    function maybeOfferEnRetranslate() {
      if (editScope !== 'all' || retranslateInFlight || enRetranslateAsked) return;
      const langs = ((translationState && translationState.languages) || []).map((l) => l.lang);
      if (!langs.length) return;
      enRetranslateAsked = true;
      const n = langs.length;
      if (!confirm(`Re-translate ${n} language${n === 1 ? '' : 's'} from the updated English? Runs ${n} gated loops.`)) return;
      runEnRetranslate(langs);
    }

    async function runEnRetranslate(langs) {
      retranslateInFlight = true;
      scopeStatusLine(`Re-translating ${langs.length} language${langs.length === 1 ? '' : 's'}… (fidelity-gated)`);
      try {
        const state = await sendJson('POST', `/api/translation/${encodeURIComponent(posterId)}/start`, { languages: langs });
        translationState = state;
        populateLangDropdown();
        updateScopeToggle();
        const failed = (state.failed || []).filter((f) => langs.includes(f.lang)).length;
        const ok = langs.length - failed;
        scopeStatusLine(
          failed
            ? `Re-translated ${ok} language${ok === 1 ? '' : 's'} — ${failed} failed.`
            : `Re-translated ${ok} language${ok === 1 ? '' : 's'}.`,
          failed > 0
        );
        enRetranslateAsked = false; // a later edit may offer again
      } catch (err) {
        scopeStatusLine(`Re-translate failed: ${err.message}`, true);
        enRetranslateAsked = false;
      } finally {
        retranslateInFlight = false;
      }
    }

    // ── save-as modal + feedback prompt ──────────────────────────────────────

    function closeSaveAsModal() {
      ui.saveAsModal.classList.add('hidden');
      ui.saveAsStatus.textContent = '';
    }

    function openSaveAsModal() {
      const isSaved = designState && designState.phase === 'saved';
      ui.saveAsTitle.textContent = isSaved ? 'Rename & save' : 'Save poster';
      ui.saveAsBtn.textContent = isSaved ? 'Rename & save' : 'Save poster…';
      ui.saveAsNameInput.value = designState ? (designState.name || '') : '';
      ui.saveAsStatus.textContent = '';
      ui.confirmSaveAs.disabled = false;
      ui.saveAsModal.classList.remove('hidden');
      ui.saveAsNameInput.focus();
      ui.saveAsNameInput.select();
    }

    function openFeedbackPrompt() {
      _pendingFeedbackRating = null;
      ui.feedbackRemarksWrap.classList.add('hidden');
      ui.feedbackRemarks.value = '';
      ui.feedbackStatus.textContent = '';
      ui.feedbackGoodBtn.disabled = false;
      ui.feedbackBadBtn.disabled = false;
      ui.submitFeedbackBtn.disabled = false;
      ui.feedbackPrompt.classList.remove('hidden');
    }

    function closeFeedbackPrompt() {
      ui.feedbackPrompt.classList.add('hidden');
      _pendingFeedbackRating = null;
      _feedbackPosterId = null;
    }

    function pickFeedbackRating(rating) {
      _pendingFeedbackRating = rating;
      ui.feedbackRemarksWrap.classList.remove('hidden');
      ui.feedbackRemarks.focus();
    }

    // ── zoom (per canvas; the toolbar shows/edits the focused side's zoom) ───

    function setZoomLevel(z, side = focusedSide) {
      if (!side.fc) return;
      side.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
      const d = DIMS[side.orientation];
      side.fc.setDimensions({ width: Math.round(d.w * side.zoom), height: Math.round(d.h * side.zoom) });
      side.fc.setZoom(side.zoom);
      if (side === focusedSide) ui.zoomLabel.textContent = `${Math.round(side.zoom * 100)}%`;
      side.fc.requestRenderAll();
    }

    function zoomToFit(side = focusedSide) {
      const pad = 72;
      const d = DIMS[side.orientation];
      // fit within the side's own frame (side-by-side frames split the stage)
      const availW = ((side.frame && side.frame.clientWidth) || ui.canvasStage.clientWidth) - pad;
      const availH = ui.canvasStage.clientHeight - pad - 24; // orientation label allowance
      setZoomLevel(Math.min(availW / d.w, availH / d.h), side);
    }

    // ── selection helpers ────────────────────────────────────────────────────

    function activeSingle() {
      const a = fc.getActiveObject();
      return a && !(a instanceof fabric.ActiveSelection) ? a : null;
    }

    function selectionObjects() {
      const a = fc.getActiveObject();
      if (!a) return [];
      return a instanceof fabric.ActiveSelection ? a.getObjects() : [a];
    }

    function isTextObj(o) { return Boolean(o) && typeof o.text === 'string'; }
    function isImageObj(o) { return Boolean(o) && o.type === 'image'; }
    /** Empty image-slot placeholder (dashed Rect from the design phase). */
    function isSlotRect(o) { return Boolean(o) && !isImageObj(o) && o.layerRole === 'image-slot'; }

    // ── properties panel ─────────────────────────────────────────────────────

    function renderProps() {
      const objs = selectionObjects();
      const single = activeSingle();
      ui.noSelection.classList.toggle('hidden', objs.length > 0);
      ui.objProps.classList.toggle('hidden', objs.length === 0);
      if (!objs.length) return;

      const imageish = isImageObj(single) || isSlotRect(single);
      ui.distributeRow.classList.toggle('hidden', objs.length < 3);
      ui.textSection.classList.toggle('hidden', !isTextObj(single));
      ui.imageSection.classList.toggle('hidden', !imageish);
      ui.shapeSection.classList.toggle('hidden', !single || isTextObj(single) || imageish || typeof single.fill !== 'string');

      // O8: group/ungroup/lock button state reflect the current selection
      ui.groupBtn.disabled = objs.length < 2;
      ui.ungroupBtn.disabled = !(single && single.type === 'group');
      const anyLocked = objs.some((o) => o.edLocked);
      ui.lockBtn.textContent = anyLocked ? 'Unlock' : 'Lock';
      ui.lockBtn.classList.toggle('toggled', anyLocked);
      ui.duplicateBtn.disabled = !single;

      if (isTextObj(single)) {
        setSelectValue(ui.fontFamily, single.fontFamily || 'Inter');
        ui.fontSize.value = Math.round(single.fontSize || 40);
        const weight = String(single.fontWeight || 'normal');
        setSelectValue(ui.fontWeight, weight === 'bold' ? '700' : weight);
        ui.italicBtn.classList.toggle('toggled', single.fontStyle === 'italic');
        ui.underlineBtn.classList.toggle('toggled', Boolean(single.underline));
        for (const btn of ui.textAlignBtns) {
          btn.classList.toggle('toggled', (single.textAlign || 'left') === btn.dataset.textalign);
        }
        ui.textColor.value = toHex6(single.fill);
        ui.lineHeight.value = single.lineHeight ?? 1.16;
        ui.charSpacing.value = single.charSpacing ?? 0;
      }
      if (imageish) {
        ui.regenImageBtn.classList.toggle('hidden', !single.slotId);
        ui.replaceImageBtn.textContent = isSlotRect(single) ? 'Fill from library…' : 'Replace…';
        ui.flipHBtn.disabled = isSlotRect(single);
        ui.flipVBtn.disabled = isSlotRect(single);
        // fit/zoom controls for any slot image (clipped or free)
        const anySlot = isAnySlotImage(single);
        ui.imgFitBox.classList.toggle('hidden', !anySlot);
        if (anySlot) {
          const mode = single.fitMode || 'cover';
          const zoom = single.fitZoom || 1;
          for (const b of ui.fitBtns) b.classList.toggle('toggled', b.dataset.fit === mode);
          for (const b of ui.fitBtns) b.setAttribute('aria-checked', String(b.dataset.fit === mode));
          // Zoom slider only meaningful in clipped modes
          const isClipped = mode !== 'free' && mode !== 'full-bleed';
          ui.imgZoom.disabled = !isClipped;
          if (isClipped) {
            ui.imgZoom.value = Math.round(zoom * 100);
            ui.imgZoom.setAttribute('aria-valuetext', `${Math.round(zoom * 100)}%`);
          }
        }
      }
      if (single && !isTextObj(single) && !isImageObj(single) && typeof single.fill === 'string') {
        ui.shapeFill.value = toHex6(single.fill);
      }
      ui.opacityInput.value = Math.round((single ? (single.opacity ?? 1) : 1) * 100);
    }

    /** Add the value as an option when missing (custom brand fonts, odd weights). */
    function setSelectValue(select, value) {
      if (![...select.options].some((o) => o.value === value)) {
        const opt = el('option', '', value);
        opt.value = value;
        select.appendChild(opt);
      }
      select.value = value;
    }

    function applyToActive(props) {
      const single = activeSingle();
      if (!single) return;
      single.set(props);
      single.setCoords();
      fc.requestRenderAll();
      onCanvasChanged();
    }

    // ── slot-image fit / zoom / pan (I6) ─────────────────────────────────────
    const IMG_ZOOM_MIN = 1;
    const IMG_ZOOM_MAX = 3;

    /** A generated/uploaded slot image: a real image clipped to its slot frame. */
    function isSlotImage(o) { return isImageObj(o) && o && o.clipPath && Boolean(o.slotId); }
    /** Slot image currently in Free mode (clipPath removed, savedClipPath stored). */
    function isFreeImage(o) { return isImageObj(o) && o && !o.clipPath && Boolean(o.slotId) && Boolean(o.savedClipPath); }
    /** Any slot image regardless of fit mode (clipped or free). */
    function isAnySlotImage(o) { return isSlotImage(o) || isFreeImage(o); }

    /** The slot frame bounds (canvas coords) from the image's absolute clipPath. */
    function frameOf(obj) {
      const cp = obj.clipPath;
      return cp ? { left: cp.left, top: cp.top, width: cp.width, height: cp.height } : null;
    }

    /** Base per-axis scale for a fit mode against the frame (before zoom). */
    function fitBase(obj, frame, mode) {
      const iw = obj.width || 1;
      const ih = obj.height || 1;
      if (mode === 'fill') return { sx: frame.width / iw, sy: frame.height / ih };
      const r = mode === 'contain'
        ? Math.min(frame.width / iw, frame.height / ih)
        : Math.max(frame.width / iw, frame.height / ih);
      return { sx: r, sy: r };
    }

    /**
     * Clamp one axis: when the rendered image is bigger than the frame (cover /
     * zoomed) the frame must stay fully covered (image edges outside the frame);
     * when smaller (contain) the image stays fully inside the frame.
     */
    function clampAxis(pos, rendered, framePos, frameLen) {
      if (rendered >= frameLen) {
        const lo = framePos + frameLen - rendered;
        return Math.min(framePos, Math.max(lo, pos));
      }
      const hi = framePos + frameLen - rendered;
      return Math.max(framePos, Math.min(hi, pos));
    }

    /** Re-fit a slot image to (mode, zoom): scale about the frame centre, clamp.
     *  mode 'free':       remove clipPath entirely — whole image freely movable.
     *  mode 'full-bleed': expand to cover the whole canvas, clip removed.
     *  mode 'cover'/'contain'/'fill': clipped within the slot frame.
     *  Switching away from 'free'/'full-bleed' back to a clipped mode restores
     *  the saved clip from obj.savedClipPath.
     */
    function applyImageFit(obj, mode, zoom) {
      // ── Free mode: remove clip entirely ──────────────────────────────────────
      if (mode === 'free') {
        // Save the current clipPath so Reset can recover it.
        if (obj.clipPath) {
          obj.savedClipPath = JSON.parse(JSON.stringify(obj.clipPath));
        }
        obj.set({ clipPath: undefined, fitMode: 'free', fitZoom: zoom || 1 });
        obj.setCoords();
        return;
      }

      // ── Full-bleed mode: cover the entire canvas, no clip ────────────────────
      if (mode === 'full-bleed') {
        if (obj.clipPath) {
          obj.savedClipPath = JSON.parse(JSON.stringify(obj.clipPath));
        }
        const { w: W, h: H } = DIMS[focusedSide.orientation];
        const iw = obj.width || 1;
        const ih = obj.height || 1;
        const scale = Math.max(W / iw, H / ih);
        const left = (W - iw * scale) / 2;
        const top = (H - ih * scale) / 2;
        obj.set({ clipPath: undefined, scaleX: scale, scaleY: scale, left, top, fitMode: 'full-bleed', fitZoom: 1 });
        obj.setCoords();
        // Move just above the background layer (index 1 typically)
        const allObjs = fc.getObjects();
        const bgIdx = allObjs.findIndex((o) => o.layerRole === 'background' || o.bgRef);
        const curIdx = allObjs.indexOf(obj);
        const targetIdx = bgIdx >= 0 ? bgIdx + 1 : 0;
        if (curIdx !== targetIdx) {
          // Move to targetIdx by repositioning in the stack
          fc.moveObjectTo(obj, targetIdx);
        }
        return;
      }

      // ── Clipped modes: cover / contain / fill ────────────────────────────────
      // Restore the saved clip if coming from free/full-bleed.
      let frame = frameOf(obj);
      if (!frame && obj.savedClipPath) {
        // Reconstruct clipPath from savedClipPath plain object.
        const sp = obj.savedClipPath;
        const clipRect = new fabric.Rect({
          left: sp.left, top: sp.top, width: sp.width, height: sp.height,
          ...(sp.rx ? { rx: sp.rx } : {}), ...(sp.ry ? { ry: sp.ry } : {}),
          absolutePositioned: true
        });
        obj.set({ clipPath: clipRect });
        frame = { left: sp.left, top: sp.top, width: sp.width, height: sp.height };
      }
      if (!frame) return;
      const z = Math.max(IMG_ZOOM_MIN, Math.min(IMG_ZOOM_MAX, zoom || 1));
      const base = fitBase(obj, frame, mode);
      const sx = base.sx * z;
      const sy = base.sy * z;
      const rw = (obj.width || 1) * sx;
      const rh = (obj.height || 1) * sy;
      const left = frame.left + (frame.width - rw) / 2;
      const top = frame.top + (frame.height - rh) / 2;
      obj.set({
        scaleX: sx, scaleY: sy,
        left: clampAxis(left, rw, frame.left, frame.width),
        top: clampAxis(top, rh, frame.top, frame.height),
        fitMode: mode, fitZoom: z
      });
      obj.setCoords();
    }

    /** Reset a slot image back to the server's original cover-fit (mode:cover, zoom:1). */
    function resetImageToServerFit(obj) {
      // Force cover mode which will restore the saved clip if needed.
      applyImageFit(obj, 'cover', 1);
      obj.fitZoom = 1;
      obj.fitMode = 'cover';
      obj.setCoords();
    }

    /** Keep a dragged slot image within its frame (called on object:moving). */
    function clampSlotImage(obj) {
      // Free-mode images have no clipPath — they can move anywhere on the canvas.
      if (isFreeImage(obj)) return;
      const frame = frameOf(obj);
      if (!frame) return;
      const rw = (obj.width || 1) * obj.scaleX;
      const rh = (obj.height || 1) * obj.scaleY;
      obj.set({
        left: clampAxis(obj.left, rw, frame.left, frame.width),
        top: clampAxis(obj.top, rh, frame.top, frame.height)
      });
      obj.setCoords();
    }

    function deleteSelection() {
      const objs = selectionObjects();
      if (!objs.length) return;
      // Guard: never delete the background object
      const toDelete = objs.filter((o) => o.layerRole !== 'background' && !o.bgRef);
      if (!toDelete.length) return;
      fc.discardActiveObject();
      for (const o of toDelete) fc.remove(o);
      fc.requestRenderAll();
      renderSwatches();
      refreshLayers();
      onCanvasChanged();
    }

    /** Duplicate the active single object (Ctrl+D). New object is offset 20px. */
    function duplicateSelection() {
      const obj = activeSingle();
      if (!obj) return;
      // Fabric v6: FabricObject.clone() returns a Promise resolving to one instance
      Promise.resolve(obj.clone()).then((cloned) => {
        if (!cloned || !fc) return;
        cloned.set({
          left: (obj.left || 0) + 20,
          top: (obj.top || 0) + 20
        });
        // duplicates are unbound free-text — clear content bindings
        cloned.layerRole = 'user-text';
        cloned.msgId = undefined;
        cloned.fieldRef = undefined;
        cloned.extraId = 'xt-' + crypto.randomUUID();
        fc.add(cloned);
        fc.setActiveObject(cloned);
        cloned.setCoords();
        fc.requestRenderAll();
        onCanvasChanged();
        updateContextToolbar();
      }).catch(() => { /* ignore clone errors */ });
    }

    // ── group / ungroup (O8) ─────────────────────────────────────────────────
    // fabric v6: a multi-object ActiveSelection → a persistent fabric.Group;
    // ungroup explodes a selected Group back into its members (each keeps its
    // custom props — Group serialization nests them, but the editor round-trips
    // groups as top-level objects only, so we flatten on ungroup and never let
    // a bound text hide inside a group across save). Bound text is left where it
    // is; grouping is a layout convenience for FREE (user/decor) objects.

    function groupSelection() {
      const sel = fc.getActiveObject();
      if (!(sel instanceof fabric.ActiveSelection)) return;
      const objs = sel.getObjects();
      if (objs.length < 2) return;
      const group = new fabric.Group(objs, { canvas: fc });
      group.layerRole = 'group';
      group.extraId = 'gp-' + crypto.randomUUID();
      fc.discardActiveObject();
      // remove the members, add the group, select it
      for (const o of objs) fc.remove(o);
      fc.add(group);
      fc.setActiveObject(group);
      fc.requestRenderAll();
      onCanvasChanged();
      refreshLayers();
    }

    function ungroupSelection() {
      const g = activeSingle();
      if (!g || g.type !== 'group' || typeof g.removeAll !== 'function') return;
      // fabric v6: removeAll() returns the members with absolute coords restored
      const members = g.removeAll();
      fc.remove(g);
      for (const m of members) fc.add(m);
      fc.discardActiveObject();
      fc.setActiveObject(new fabric.ActiveSelection(members, { canvas: fc }));
      fc.requestRenderAll();
      onCanvasChanged();
      refreshLayers();
    }

    // ── lock / unlock (O8) ───────────────────────────────────────────────────
    // A locked object cannot be moved, scaled, rotated or selected by drag; the
    // edLocked flag survives save (EXTRA_PROPS) so locks persist across reloads.

    function applyLockState(obj, locked) {
      obj.set({
        edLocked: locked ? true : undefined,
        lockMovementX: locked, lockMovementY: locked,
        lockScalingX: locked, lockScalingY: locked,
        lockRotation: locked,
        selectable: !locked, evented: !locked,
        hasControls: !locked, hasBorders: !locked
      });
    }

    function toggleLockSelection() {
      const objs = selectionObjects();
      if (!objs.length) return;
      // if ANY is unlocked, lock all; else unlock all
      const anyUnlocked = objs.some((o) => !o.edLocked);
      for (const o of objs) applyLockState(o, anyUnlocked);
      if (anyUnlocked) fc.discardActiveObject();
      fc.requestRenderAll();
      renderProps();
      refreshLayers();
      onCanvasChanged();
    }

    /** Re-apply persisted locks after a canvas (re)load so edLocked takes effect. */
    function reapplyLocks(side) {
      for (const o of side.fc.getObjects()) {
        if (o.edLocked) applyLockState(o, true);
      }
    }

    // ── layers panel (O8) ────────────────────────────────────────────────────
    // Lists the focused canvas's objects top-first (canvas z-order is
    // bottom-first, so we reverse). Pure decor/scrim/background is hidden unless
    // the "show decor" toggle is on. Each row: eye (visible), label, up/down
    // (reorder via moveObjectTo). The active object's row is highlighted.

    const DECOR_ROLES = new Set(['decor', 'scrim', 'background']);

    function layerLabel(o) {
      if (isTextObj(o)) {
        const t = (o.text || '').trim().replace(/\s+/g, ' ');
        if (t) return t.length > 26 ? t.slice(0, 25) + '…' : t;
        return o.layerRole || 'text';
      }
      if (isImageObj(o)) return o.slotId ? `image · ${o.slotId}` : 'image';
      if (o.type === 'group') return 'group';
      return o.layerRole || o.type || 'object';
    }

    /** Rebuild the layers list from the focused canvas. Cheap: called on any
     *  add/remove/reorder/selection change (all already debounced upstream). */
    function refreshLayers() {
      const list = ui.layersList;
      if (!list) return;
      list.textContent = '';
      if (!fc) return;
      const showDecor = ui.layersDecorToggle && ui.layersDecorToggle.checked;
      const active = new Set(selectionObjects());
      const objs = fc.getObjects();
      // top layer first
      for (let i = objs.length - 1; i >= 0; i--) {
        const o = objs[i];
        if (!showDecor && DECOR_ROLES.has(o.layerRole || '') && !o.bgRef) continue;
        if (!showDecor && o.bgRef) continue;
        const row = el('div', 'ed-layer-row');
        if (active.has(o)) row.classList.add('active');

        const eye = el('button', 'ed-layer-eye', o.visible === false ? '🚫' : '👁');
        eye.title = o.visible === false ? 'Show' : 'Hide';
        eye.addEventListener('click', (e) => {
          e.stopPropagation();
          o.set('visible', o.visible === false);
          if (o.visible === false && active.has(o)) fc.discardActiveObject();
          fc.requestRenderAll();
          onCanvasChanged();
          refreshLayers();
        });

        const name = el('span', 'ed-layer-name', layerLabel(o));
        if (o.edLocked) name.classList.add('ed-layer-locked');

        const up = el('button', 'ed-layer-move', '▲');
        up.title = 'Move up';
        up.addEventListener('click', (e) => {
          e.stopPropagation();
          fc.bringObjectForward(o);
          fc.requestRenderAll();
          onCanvasChanged();
          refreshLayers();
        });
        const down = el('button', 'ed-layer-move', '▼');
        down.title = 'Move down';
        down.addEventListener('click', (e) => {
          e.stopPropagation();
          fc.sendObjectBackwards(o);
          fc.requestRenderAll();
          onCanvasChanged();
          refreshLayers();
        });

        row.addEventListener('click', () => {
          if (o.selectable === false) return; // locked
          fc.discardActiveObject();
          fc.setActiveObject(o);
          fc.requestRenderAll();
        });

        row.append(eye, name, up, down);
        list.appendChild(row);
      }
    }

    // ── live lint overlay (O8) ───────────────────────────────────────────────
    // After any change (debounced), flatten the focused canvas into the linter
    // shape and run window.EditorLint.lintFabricSerialization (reuses the exact
    // agents/poster_linter.js thresholds). Offending Textboxes get a red outline
    // (drawn on the upper canvas in after:render, like the snap guides); the
    // toolbar badge shows counts and, when clicked, applies the in-place
    // contrast/font fixes back onto the live fabric objects. Degrades to a
    // no-op when window.EditorLint is absent (e.g. the create-page Refine
    // station host, which does not load the lint module).

    const LINT_DEBOUNCE_MS = 400;

    function lintApi() { return (typeof window !== 'undefined' && window.EditorLint) || null; }

    function runLint(side = focusedSide) {
      const L = lintApi();
      if (!L || !side.fc) { side.lintReport = null; updateLintBadge(); return; }
      const { w, h } = DIMS[side.orientation];
      const serialized = side.fc.toObject(EXTRA_PROPS);
      const report = L.lintFabricSerialization(serialized, w, h);
      // map violation/fix indices → the live fabric objects (same order)
      const objs = side.fc.getObjects();
      const badIdx = new Set();
      for (const v of report.violations) {
        if (typeof v.index === 'number' && v.index >= 0) badIdx.add(v.index);
        if (typeof v.index2 === 'number' && v.index2 >= 0) badIdx.add(v.index2);
      }
      for (const f of report.fixes) if (typeof f.index === 'number') badIdx.add(f.index);
      side.lintBad = new Set([...badIdx].map((i) => objs[i]).filter(Boolean));
      side.lintReport = report;
      side.fc.requestRenderAll();
      if (side === focusedSide) updateLintBadge();
    }

    function scheduleLint(side = focusedSide) {
      if (!lintApi()) return;
      clearTimeout(side.lintTimer);
      side.lintTimer = setTimeout(() => { if (!destroyed) runLint(side); }, LINT_DEBOUNCE_MS);
    }

    function updateLintBadge() {
      const btn = ui.lintBtn;
      if (!btn) return;
      if (!lintApi()) { btn.classList.add('hidden'); return; }
      const r = focusedSide.lintReport;
      if (!r) { btn.classList.add('hidden'); return; }
      const fixable = r.fixes.length;
      const issues = r.violations.length;
      btn.classList.remove('hidden');
      if (!fixable && !issues) {
        btn.textContent = '✓ Readable';
        btn.classList.remove('ed-lint-warn', 'ed-lint-fix');
        btn.classList.add('ed-lint-ok');
        btn.disabled = true;
        btn.title = 'No readability issues detected';
      } else {
        btn.disabled = false;
        btn.classList.remove('ed-lint-ok');
        const parts = [];
        if (fixable) parts.push(`${fixable} fixable`);
        if (issues) parts.push(`${issues} issue${issues === 1 ? '' : 's'}`);
        btn.textContent = `⚠ ${parts.join(' · ')}`;
        btn.classList.toggle('ed-lint-fix', fixable > 0);
        btn.classList.toggle('ed-lint-warn', fixable === 0 && issues > 0);
        btn.title = fixable
          ? 'Click to fix contrast/font issues; overflow/overlap are reported only'
          : 'Overflow/overlap issues (fix by moving/resizing) — not auto-fixable';
      }
    }

    /** Apply lintCanvas's in-place contrast/font fixes back onto live objects. */
    function applyLintFixes(side = focusedSide) {
      const L = lintApi();
      if (!L || !side.fc || !side.lintReport) return;
      const objs = side.fc.getObjects();
      let applied = 0;
      for (const f of side.lintReport.fixes) {
        const o = objs[f.index];
        if (!o) continue;
        if (f.kind === 'contrast' && f.fill) { o.set('fill', f.fill); applied += 1; }
        else if (f.kind === 'min-font' && f.fontSize) { o.set('fontSize', f.fontSize); autofitObj(o); applied += 1; }
      }
      if (applied) {
        side.fc.requestRenderAll();
        onCanvasChanged(side);
        renderProps();
        flash(ui.saveStatus, `Fixed ${applied} readability issue${applied === 1 ? '' : 's'}.`);
      }
      runLint(side);
    }

    /** Draw a red outline around each linted-bad object (upper canvas). */
    function drawLintBadges(side) {
      const bad = side.lintBad;
      if (!bad || !bad.size) return;
      const sfc = side.fc;
      const ctx = sfc.contextTop;
      const vpt = sfc.viewportTransform;
      ctx.save();
      ctx.strokeStyle = '#c0102e';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      for (const o of bad) {
        if (!o || o.visible === false) continue;
        const r = o.getBoundingRect();
        const x = r.left * vpt[0] + vpt[4];
        const y = r.top * vpt[3] + vpt[5];
        ctx.strokeRect(x - 2, y - 2, r.width * vpt[0] + 4, r.height * vpt[3] + 4);
      }
      ctx.restore();
    }

    // ── regenerate selected text (calls POST /api/editor/:id/regenerate-text) ──

    async function regenSelectedText() {
      const obj = activeSingle();
      if (!isTextObj(obj)) return;
      const isBound = (obj.layerRole && obj.layerRole !== 'user-text') || obj.msgId;
      if (!isBound) return;

      ui.ctxRegenBtn.disabled = true;
      ui.ctxRegenBtn.textContent = '↻…';
      if (ui.propsStatus) flash(ui.propsStatus, 'Generating alternative text…');

      const layerRole = obj.layerRole || 'message';
      const msgId = obj.msgId || undefined;
      const fieldRef = obj.fieldRef || undefined;

      try {
        const result = await withServerOp(async () =>
          sendJson('POST', `/api/editor/${encodeURIComponent(posterId)}/regenerate-text`, {
            layerRole, msgId, fieldRef
          })
        );
        const newText = result.regenText;
        if (typeof newText === 'string' && newText) {
          obj.set('text', newText);
          obj.setCoords();
          // auto-fit after regen
          autofitObj(obj);
          fc.requestRenderAll();
          onCanvasChanged();
          mirrorBoundText(focusedSide, obj);
          updateContextToolbar();
          renderProps();
          if (ui.propsStatus) flash(ui.propsStatus, 'Text regenerated.');
        }
      } catch (err) {
        const msg = err.code === 'REGENERATE_FAILED'
          ? 'Regeneration failed — try again.'
          : (err.message || 'Regeneration failed.');
        if (ui.propsStatus) flash(ui.propsStatus, msg, false);
        // toast-style: also update ctx toolbar status area if available
      } finally {
        ui.ctxRegenBtn.disabled = false;
        ui.ctxRegenBtn.textContent = '↻ Regenerate';
      }
    }

    // ── alignment tools (relative to the canvas) ─────────────────────────────

    function alignSelection(dir) {
      const objs = selectionObjects();
      if (!objs.length) return;
      const { w: W, h: H } = DIMS[focusedSide.orientation];
      const multi = objs.length > 1;
      if (multi) fc.discardActiveObject();
      for (const o of objs) {
        const r = o.getBoundingRect();
        let dx = 0;
        let dy = 0;
        if (dir === 'left') dx = -r.left;
        else if (dir === 'centerH') dx = (W - r.width) / 2 - r.left;
        else if (dir === 'right') dx = W - r.width - r.left;
        else if (dir === 'top') dy = -r.top;
        else if (dir === 'centerV') dy = (H - r.height) / 2 - r.top;
        else if (dir === 'bottom') dy = H - r.height - r.top;
        o.set({ left: o.left + dx, top: o.top + dy });
        o.setCoords();
      }
      if (multi) fc.setActiveObject(new fabric.ActiveSelection(objs, { canvas: fc }));
      fc.requestRenderAll();
      onCanvasChanged();
    }

    function distributeSelection(axis) {
      const objs = selectionObjects();
      if (objs.length < 3) { flash(ui.propsStatus, 'Select 3+ objects to distribute.', false); return; }
      fc.discardActiveObject();
      const items = objs.map((o) => ({ o, r: o.getBoundingRect() }));
      items.sort((a, b) => (axis === 'h' ? a.r.left - b.r.left : a.r.top - b.r.top));
      const first = items[0].r;
      const last = items[items.length - 1].r;
      if (axis === 'h') {
        const span = last.left + last.width - first.left;
        const sum = items.reduce((s, it) => s + it.r.width, 0);
        const gap = (span - sum) / (items.length - 1);
        let x = first.left;
        for (const it of items) {
          it.o.set({ left: it.o.left + (x - it.r.left) });
          it.o.setCoords();
          x += it.r.width + gap;
        }
      } else {
        const span = last.top + last.height - first.top;
        const sum = items.reduce((s, it) => s + it.r.height, 0);
        const gap = (span - sum) / (items.length - 1);
        let y = first.top;
        for (const it of items) {
          it.o.set({ top: it.o.top + (y - it.r.top) });
          it.o.setCoords();
          y += it.r.height + gap;
        }
      }
      fc.setActiveObject(new fabric.ActiveSelection(objs, { canvas: fc }));
      fc.requestRenderAll();
      onCanvasChanged();
    }

    // ── poster colors (swap one color across the whole poster) ───────────────

    function collectColors() {
      const counts = new Map();
      const add = (v) => {
        if (typeof v === 'string' && HEX6.test(v.trim())) {
          const k = v.trim().toLowerCase();
          counts.set(k, (counts.get(k) || 0) + 1);
        }
      };
      add(fc.backgroundColor);
      for (const o of fc.getObjects()) { add(o.fill); add(o.stroke); }
      return counts;
    }

    function renderSwatches() {
      const grid = ui.posterColors;
      grid.textContent = '';
      const counts = collectColors();
      for (const [color, count] of counts) {
        const sw = el('span', 'swatch');
        sw.style.background = color; // validated #rrggbb only
        sw.title = `${color} — used ${count}×`;
        sw.dataset.color = color; // stable equality target (title is human-readable, not a key)
        sw.classList.toggle('selected', color === swapFromColor);
        sw.addEventListener('click', () => {
          swapFromColor = color;
          ui.swapFromSwatch.style.background = color;
          ui.swapFromSwatch.title = color;
          ui.swapToInput.value = color;
          ui.colorSwapPanel.classList.remove('hidden');
          for (const node of grid.children) node.classList.toggle('selected', node.dataset.color === color);
        });
        grid.appendChild(sw);
      }
      if (!counts.has(swapFromColor)) {
        swapFromColor = null;
        ui.colorSwapPanel.classList.add('hidden');
      }
    }

    /** Keep the toolbar background swatch in sync with the loaded canvas. */
    function syncBgSwatch() {
      ui.bgColorInput.value = toHex6(
        typeof fc.backgroundColor === 'string' ? fc.backgroundColor : '', '#ffffff'
      );
    }

    // ── fonts (per-object handled in the panel; bulk heading/body here) ──────

    function fontChoices() {
      const fonts = [...BASE_FONTS];
      const d = designState?.design?.fonts;
      for (const f of [d?.head, d?.body]) {
        if (f && !fonts.includes(f)) fonts.push(f);
      }
      return fonts;
    }

    function populateFontSelects() {
      for (const select of [ui.fontFamily, ui.headFontSelect, ui.bodyFontSelect]) {
        select.textContent = '';
        for (const f of fontChoices()) {
          const opt = el('option', '', f);
          opt.value = f;
          select.appendChild(opt);
        }
      }
      const d = designState?.design?.fonts;
      if (d?.head) setSelectValue(ui.headFontSelect, d.head);
      if (d?.body) setSelectValue(ui.bodyFontSelect, d.body);
    }

    function applyBulkFont(roles, family) {
      let touched = 0;
      for (const o of fc.getObjects()) {
        if (isTextObj(o) && roles.includes(o.layerRole)) {
          o.set('fontFamily', family);
          touched += 1;
        }
      }
      if (touched) {
        fc.requestRenderAll();
        onCanvasChanged();
        renderProps();
      }
      flash(ui.saveStatus, touched ? `Font set on ${touched} object${touched === 1 ? '' : 's'}.` : 'No matching text objects.', Boolean(touched));
    }

    // ── image replace (library picker) + regenerate ──────────────────────────

    async function swapImage(obj, imageId) {
      const w = obj.getScaledWidth();
      const h = obj.getScaledHeight();
      await obj.setSrc(`/api/images/file/${encodeURIComponent(imageId)}`);
      const sx = obj.width ? w / obj.width : 1;
      const sy = obj.height ? h / obj.height : 1;
      if (Number.isFinite(sx) && Number.isFinite(sy)) obj.set({ scaleX: sx, scaleY: sy });
      obj.imageId = imageId;
      obj.setCoords();
      fc.requestRenderAll();
      onCanvasChanged();
    }

    /** Fill an empty slot placeholder: swap the dashed Rect for a real Image at the same z-index/bounds. */
    async function fillSlotWithImage(slotRect, imageId) {
      const img = await fabric.Image.fromURL(`/api/images/file/${encodeURIComponent(imageId)}`);
      const w = slotRect.getScaledWidth();
      const h = slotRect.getScaledHeight();
      const sx = img.width ? w / img.width : 1;
      const sy = img.height ? h / img.height : 1;
      img.set({
        left: slotRect.left, top: slotRect.top, angle: slotRect.angle || 0,
        ...(Number.isFinite(sx) && Number.isFinite(sy) ? { scaleX: sx, scaleY: sy } : {})
      });
      img.layerRole = 'image';
      img.slotId = slotRect.slotId;
      img.imageId = imageId;
      img.slotSpec = slotRect.slotSpec;
      const idx = fc.getObjects().indexOf(slotRect);
      fc.remove(slotRect);
      fc.insertAt(Math.max(0, idx), img);
      fc.setActiveObject(img);
      fc.requestRenderAll();
      onCanvasChanged();
    }

    /** Route a picked/generated imageId onto the selected image or slot placeholder. */
    function placeImage(obj, imageId) {
      return isSlotRect(obj) ? fillSlotWithImage(obj, imageId) : swapImage(obj, imageId);
    }

    function closeLibraryModal() {
      ui.libraryModal.classList.add('hidden');
      pendingReplaceObject = null;
      libraryPickedImageId = null;
    }

    async function openLibraryModal(forObject) {
      pendingReplaceObject = forObject;
      libraryPickedImageId = null;
      ui.confirmLibraryPick.disabled = true;
      ui.libraryModalGrid.textContent = '';
      ui.libraryModalStatus.textContent = '';
      ui.libraryModalEmpty.classList.add('hidden');
      ui.libraryModal.classList.remove('hidden');
      try {
        const { images } = await api('/api/images');
        if (!images.length) {
          ui.libraryModalEmpty.classList.remove('hidden');
          return;
        }
        for (const img of images) {
          const card = el('div', 'image-card');
          const imgEl = document.createElement('img');
          imgEl.src = `/api/images/file/${encodeURIComponent(img.image_id)}`;
          imgEl.alt = img.style || 'library image';
          imgEl.loading = 'lazy';
          const chips = el('div', 'topic-chips');
          let topicArr = [];
          try { topicArr = JSON.parse(img.topics || '[]'); } catch { /* unreadable tags stay hidden */ }
          for (const t of topicArr) chips.appendChild(el('span', 'chip', t));
          card.append(imgEl, chips);
          card.addEventListener('click', () => {
            libraryPickedImageId = img.image_id;
            for (const node of ui.libraryModalGrid.children) node.classList.remove('selected');
            card.classList.add('selected');
            ui.confirmLibraryPick.disabled = false;
          });
          ui.libraryModalGrid.appendChild(card);
        }
      } catch (err) {
        flash(ui.libraryModalStatus, err.message, false);
      }
    }

    // ── template switch (change the entire look in-editor) ───────────────────

    function closeTemplateModal() {
      ui.templateModal.classList.add('hidden');
      pickedTemplateId = null;
    }

    async function openTemplateModal() {
      pickedTemplateId = null;
      ui.confirmTemplatePick.disabled = true;
      ui.templateModalGallery.textContent = '';
      ui.templateModalStatus.textContent = '';
      ui.templateModal.classList.remove('hidden');
      try {
        const gallery = await api(`/api/design/templates?posterId=${encodeURIComponent(posterId)}`);
        for (const t of gallery.templates) {
          const card = el('div', 'template-card');
          card.dataset.templateId = t.id;
          // previewSvg is server-rendered from our own template modules —
          // palette-resolved geometry only, never user/model text
          card.innerHTML = t.previewSvg;
          if (t.recommended) card.appendChild(el('span', 'tpl-badge', 'recommended'));
          const name = el('div', 'tpl-name', t.name);
          name.title = t.description;
          card.appendChild(name);
          card.addEventListener('click', () => {
            pickedTemplateId = t.id;
            for (const node of ui.templateModalGallery.children) {
              node.classList.toggle('selected', node.dataset.templateId === t.id);
            }
            ui.confirmTemplatePick.disabled = false;
          });
          ui.templateModalGallery.appendChild(card);
        }
      } catch (err) {
        flash(ui.templateModalStatus, err.message, false);
      }
    }

    // ── translation: action-disable for non-en language ──────────────────────
    // While a non-en language is active, image-replace/regenerate and
    // template-switch actions that mutate doc.design must be greyed out.
    const EN_ONLY_TOOLTIP = 'Switch to English to change layout or images';

    function enOnlyButtons() {
      return [ui.replaceImageBtn, ui.regenImageBtn, ui.changeTemplateBtn];
    }

    function applyEnOnlyDisable(isNonEn) {
      for (const btn of enOnlyButtons()) {
        if (isNonEn) {
          btn.disabled = true;
          btn.dataset.enOnly = '1';
          btn.title = EN_ONLY_TOOLTIP;
        } else {
          btn.disabled = false;
          delete btn.dataset.enOnly;
          btn.title = '';
        }
      }
    }

    // ── translation: sync banner ─────────────────────────────────────────────

    function hideSyncBanner() {
      ui.syncBanner.classList.add('hidden');
      pendingSyncLang = null;
    }

    function showSyncBanner(lang) {
      pendingSyncLang = lang;
      ui.syncBannerMsg.textContent = 'Apply this change to all other languages?';
      ui.syncBanner.classList.remove('hidden');
    }

    // ── translation: language dropdown ───────────────────────────────────────

    /** Find the translation entry for a given lang id in the current state. */
    function variantStatus(langId) {
      if (!translationState) return null;
      return (translationState.languages || []).find((l) => l.lang === langId) || null;
    }

    /**
     * Rebuild the <select> options from translationMeta + current translationState.
     * Variant-less languages render as disabled with "– not translated" suffix.
     */
    function populateLangDropdown() {
      const sel = ui.langSelect;
      if (!translationMeta) return;
      const prev = activeLang;
      sel.textContent = '';
      for (const lang of translationMeta.languages) {
        const opt = document.createElement('option');
        opt.value = lang.id;
        if (lang.id === 'en') {
          opt.textContent = lang.label;
        } else {
          const vs = variantStatus(lang.id);
          if (vs) {
            const statusLabel = vs.status === 'edited' ? ' (edited)' : ' (translated)';
            opt.textContent = lang.label + statusLabel;
            opt.disabled = false;
          } else {
            opt.textContent = lang.label + ' – not translated';
            opt.disabled = true;
          }
        }
        sel.appendChild(opt);
      }
      if (prev && [...sel.options].some((o) => o.value === prev && !o.disabled)) {
        sel.value = prev;
      } else {
        sel.value = 'en';
      }
    }

    /**
     * Load one side from a canvas JSON (clean: history reset, not dirty), or
     * clear it when the active language has no canvas for that orientation.
     */
    async function loadSideCanvas(side, json) {
      clearTimeout(side.autosaveTimer);
      if (json) {
        side.exists = true;
        await loadCanvasJson(side, json);
        resetHistory(side);
        side.dirty = false;
      } else {
        side.exists = false;
        side.dirty = false;
        side.states = [];
        side.stateIdx = -1;
        if (focusedSide === side) setFocusedSide(sides.portrait);
        if (side.fc) {
          side.suppressEvents = true; // clear() must never mark the side dirty
          try {
            side.fc.discardActiveObject();
            side.fc.clear();
          } finally {
            side.suppressEvents = false;
          }
        }
      }
      updateDirtyDot();
    }

    /**
     * Load BOTH orientations of a language (design or variant). The portrait
     * load throws to the caller; a broken landscape canvas degrades to
     * portrait-only instead of killing the editor. Ends by re-deriving the
     * view control (default Both when a landscape exists, else Portrait with
     * the control disabled) and mirroring both sides into the host preview.
     */
    async function loadLanguageCanvases(portraitJson, landscapeJson) {
      switchingLanguage = true;
      try {
        await loadSideCanvas(sides.portrait, portraitJson);
        try {
          await loadSideCanvas(sides.landscape, landscapeJson || null);
        } catch {
          await loadSideCanvas(sides.landscape, null);
          flash(ui.saveStatus, 'The landscape canvas could not be rendered — editing portrait only.', false);
        }
        updateViewControl();
        setViewMode(landscapeAvailable() ? 'both' : 'portrait');
        notifyPreviewSoon(); // both sides
      } finally {
        switchingLanguage = false;
      }
    }

    /**
     * Switch the editor to a different language:
     * 1. Flush pending autosaves (both orientations) for the current lang.
     * 2. Load BOTH canvases of the variant (or the design canvases for en).
     * 3. Update activeLang so subsequent autosaves route correctly.
     * 4. Apply/remove en-only disables; re-derive the view control.
     */
    async function switchLanguage(targetLang) {
      if (targetLang === activeLang) return;
      await flushAutosave();
      try {
        if (targetLang === 'en') {
          if (designState && designState.design && designState.design.canvas) {
            await loadLanguageCanvases(designState.design.canvas, designState.design.landscapeCanvas || null);
          }
        } else {
          const variant = await api(`/api/translation/${encodeURIComponent(posterId)}/${encodeURIComponent(targetLang)}`);
          if (variant && variant.canvas) {
            await loadLanguageCanvases(variant.canvas, variant.landscapeCanvas || null);
          } else {
            flash(ui.saveStatus, 'No canvas for this language.', false);
            ui.langSelect.value = activeLang;
            return;
          }
        }
        activeLang = targetLang;
        enRetranslateAsked = false; // a new language is a fresh edit burst
        applyEnOnlyDisable(activeLang !== 'en');
        hideSyncBanner();
      } catch (err) {
        flash(ui.saveStatus, err.message, false);
        ui.langSelect.value = activeLang;
      }
    }

    // ── translation: translate modal ─────────────────────────────────────────

    function closeTranslateModal() {
      ui.translateModal.classList.add('hidden');
    }

    /**
     * Rebuild the translate modal target list.
     * Radio "All languages" at top; then checkboxes for each target.
     */
    function buildTranslateTargets() {
      const targetsBox = ui.translateTargets;
      targetsBox.textContent = '';
      if (!translationMeta) return;

      const allLabel = document.createElement('label');
      const allRadio = document.createElement('input');
      allRadio.type = 'radio';
      allRadio.name = 'edInlineTranslateScope';
      allRadio.value = 'all';
      allRadio.checked = true;
      allLabel.append(allRadio, document.createTextNode(' All languages'));
      targetsBox.appendChild(allLabel);

      const orLabel = document.createElement('label');
      orLabel.style.color = 'var(--muted)';
      orLabel.style.fontSize = '12px';
      orLabel.style.marginTop = '4px';
      orLabel.textContent = 'or select individual languages:';
      targetsBox.appendChild(orLabel);

      for (const lang of translationMeta.languages) {
        if (lang.id === 'en') continue;
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.name = 'edInlineTranslateLang';
        cb.value = lang.id;
        cb.addEventListener('change', () => {
          allRadio.checked = false;
          updateStartBtn();
        });
        const vs = variantStatus(lang.id);
        const chip = el('span', 'lang-status-chip' + (vs ? (' ' + vs.status) : ''), vs ? vs.status : 'not translated');
        label.append(cb, document.createTextNode(' ' + lang.label), document.createTextNode(' '), chip);
        targetsBox.appendChild(label);
      }

      allRadio.addEventListener('change', () => {
        for (const cb of targetsBox.querySelectorAll('input[name="edInlineTranslateLang"]')) {
          cb.checked = false;
        }
        updateStartBtn();
      });

      updateStartBtn();
    }

    function updateStartBtn() {
      const targetsBox = ui.translateTargets;
      const allRadio = targetsBox.querySelector('input[value="all"]');
      const anyChecked = [...targetsBox.querySelectorAll('input[name="edInlineTranslateLang"]')].some((cb) => cb.checked);
      ui.startTranslateBtn.disabled = !(allRadio && allRadio.checked) && !anyChecked;
    }

    /** Fetch translation state for this poster and refresh the dropdown. */
    async function refreshTranslationState() {
      if (!posterId) return;
      try {
        translationState = await api(`/api/translation/${encodeURIComponent(posterId)}`);
        populateLangDropdown();
      } catch {
        // translation not yet started / route not available — silently ignore
        translationState = null;
      }
      updateScopeToggle(); // T4: visible only when translations exist
    }

    // ── snap-to-center guidelines ────────────────────────────────────────────

    /**
     * Smart snapping (O8): while dragging, snap the active object's edges and
     * center to the canvas edges/center AND to every sibling object's
     * edges/centers. Each satisfied snap yields a full-canvas guide segment
     * drawn on the upper canvas. Threshold SNAP_PX. Slot images still pan
     * within their frame (clamp, no snap). The candidate snap targets are
     * gathered from siblings' bounding rects — cheap for poster-sized canvases.
     */
    function wireSnapGuides(side) {
      const sfc = side.fc;
      const { w: W, h: H } = DIMS[side.orientation];

      function siblingTargets(active) {
        const xs = [{ v: 0 }, { v: W / 2 }, { v: W }]; // canvas edges + center
        const ys = [{ v: 0 }, { v: H / 2 }, { v: H }];
        for (const o of sfc.getObjects()) {
          if (o === active || o.visible === false) continue;
          if (active.getObjects && active.getObjects().includes(o)) continue;
          const r = o.getBoundingRect();
          xs.push({ v: r.left }, { v: r.left + r.width / 2 }, { v: r.left + r.width });
          ys.push({ v: r.top }, { v: r.top + r.height / 2 }, { v: r.top + r.height });
        }
        return { xs, ys };
      }

      sfc.on('object:moving', (e) => {
        const t = e.target;
        if (!t) return;
        if (isSlotImage(t)) { clampSlotImage(t); return; }
        const r = t.getBoundingRect();
        const { xs, ys } = siblingTargets(t);
        // candidate anchors on the moving object: left, center, right / top, mid, bottom
        const objXs = [r.left, r.left + r.width / 2, r.left + r.width];
        const objYs = [r.top, r.top + r.height / 2, r.top + r.height];
        side.snapLines = [];
        let dx = 0; let bestX = SNAP_PX + 1;
        for (const ox of objXs) for (const cand of xs) {
          const d = cand.v - ox;
          if (Math.abs(d) < Math.abs(bestX)) { bestX = d; dx = d; }
        }
        let dy = 0; let bestY = SNAP_PX + 1;
        for (const oy of objYs) for (const cand of ys) {
          const d = cand.v - oy;
          if (Math.abs(d) < Math.abs(bestY)) { bestY = d; dy = d; }
        }
        const doX = Math.abs(bestX) <= SNAP_PX;
        const doY = Math.abs(bestY) <= SNAP_PX;
        if (doX) t.set('left', (t.left || 0) + dx);
        if (doY) t.set('top', (t.top || 0) + dy);
        if (doX || doY) t.setCoords();
        // record guide lines at the snapped edge positions
        if (doX) {
          const nr = t.getBoundingRect();
          for (const gx of [nr.left, nr.left + nr.width / 2, nr.left + nr.width]) {
            if (xs.some((c) => Math.abs(c.v - gx) < 0.5)) side.snapLines.push({ x1: gx, y1: 0, x2: gx, y2: H });
          }
        }
        if (doY) {
          const nr = t.getBoundingRect();
          for (const gy of [nr.top, nr.top + nr.height / 2, nr.top + nr.height]) {
            if (ys.some((c) => Math.abs(c.v - gy) < 0.5)) side.snapLines.push({ x1: 0, y1: gy, x2: W, y2: gy });
          }
        }
        side.snapV = doX; side.snapH = doY;
      });
      sfc.on('mouse:up', () => {
        if (side.snapLines.length || side.snapV || side.snapH) {
          side.snapLines = []; side.snapV = side.snapH = false; sfc.requestRenderAll();
        }
      });
      sfc.on('before:render', () => sfc.clearContext(sfc.contextTop));
      sfc.on('after:render', () => {
        const vpt = sfc.viewportTransform;
        // lint badges (red outlines) always drawn; snap guides only while dragging
        drawLintBadges(side);
        if (!side.snapLines || !side.snapLines.length) return;
        const ctx = sfc.contextTop;
        ctx.save();
        ctx.strokeStyle = '#e3af32';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        for (const g of side.snapLines) {
          ctx.beginPath();
          ctx.moveTo(g.x1 * vpt[0] + vpt[4], g.y1 * vpt[3] + vpt[5]);
          ctx.lineTo(g.x2 * vpt[0] + vpt[4], g.y2 * vpt[3] + vpt[5]);
          ctx.stroke();
        }
        ctx.restore();
      });
    }

    // ── double-click on an image: toggle Free mode ────────────────────────────

    function wireImageDoubleClick(side) {
      side.fc.on('mouse:dblclick', (e) => {
        const target = e.target;
        if (!target || !isImageObj(target) || isTextObj(target)) return;
        if (!isAnySlotImage(target)) return;
        const newMode = target.fitMode === 'free' ? 'cover' : 'free';
        applyImageFit(target, newMode, target.fitZoom || 1);
        side.fc.requestRenderAll();
        renderProps();
        onCanvasChanged(side);
        updateImageContextToolbar();
      });
    }

    // ── document/window listeners (added on mount, removed on destroy) ───────

    /** Manual save: the focused side explicitly, plus the other side if dirty. */
    function saveAllSides(manual) {
      doSave(focusedSide, manual);
      const other = focusedSide === sides.portrait ? sides.landscape : sides.portrait;
      if (other.dirty) doSave(other, false);
    }

    function onKeydown(e) {
      if (!fc) return;
      const inField = /^(input|select|textarea)$/i.test(e.target.tagName);
      const editingText = Boolean(fc.getActiveObject()?.isEditing);
      if ((e.ctrlKey || e.metaKey) && !editingText) {
        const key = e.key.toLowerCase();
        if (key === 'z' && !e.shiftKey) { e.preventDefault(); restoreState(focusedSide, focusedSide.stateIdx - 1); return; }
        if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); restoreState(focusedSide, focusedSide.stateIdx + 1); return; }
        if (key === 's') { e.preventDefault(); saveAllSides(true); return; }
        if (key === 'd') { e.preventDefault(); duplicateSelection(); return; }
        if (key === 'g' && !e.shiftKey) { e.preventDefault(); groupSelection(); return; }
        if (key === 'g' && e.shiftKey) { e.preventDefault(); ungroupSelection(); return; }
      }
      // Delete / Backspace: remove selected non-background object(s)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !inField && !editingText) {
        if (fc.getActiveObject()) { e.preventDefault(); deleteSelection(); updateContextToolbar(); }
      }
      // Arrow nudge: 1px (Shift: 10px), only when not in a text-editing mode
      if (!editingText && !inField && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const obj = activeSingle();
        if (!obj) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        obj.set({ left: (obj.left || 0) + dx, top: (obj.top || 0) + dy });
        obj.setCoords();
        fc.requestRenderAll();
        onCanvasChanged();
        positionContextToolbar();
      }
    }

    function onBeforeUnload(e) {
      if (sides.portrait.dirty || sides.landscape.dirty) { e.preventDefault(); e.returnValue = ''; }
    }

    // ── control wiring ───────────────────────────────────────────────────────

    function wireControls() {
      ui.undoBtn.addEventListener('click', () => restoreState(focusedSide, focusedSide.stateIdx - 1));
      ui.redoBtn.addEventListener('click', () => restoreState(focusedSide, focusedSide.stateIdx + 1));
      ui.saveBtn.addEventListener('click', () => saveAllSides(true));

      ui.zoomInBtn.addEventListener('click', () => setZoomLevel(focusedSide.zoom + ZOOM_STEP));
      ui.zoomOutBtn.addEventListener('click', () => setZoomLevel(focusedSide.zoom - ZOOM_STEP));
      ui.zoomFitBtn.addEventListener('click', () => zoomToFit());

      // T3: three-state view control
      for (const [mode, btn] of Object.entries(ui.viewButtons)) {
        btn.addEventListener('click', () => setViewMode(mode));
      }

      // T4: edit-scope toggle
      ui.scopeThisBtn.addEventListener('click', () => setEditScope('this'));
      ui.scopeAllBtn.addEventListener('click', () => setEditScope('all'));

      // NEW (O7): background color — sets canvas.background live, persists via
      // the normal serialize/save path (fc.toObject carries background).
      ui.bgColorInput.addEventListener('input', () => {
        fc.backgroundColor = ui.bgColorInput.value;
        fc.requestRenderAll();
        onCanvasChanged();
        renderSwatches();
      });

      // text controls (per-element color = per-object fill)
      ui.fontFamily.addEventListener('change', () => applyToActive({ fontFamily: ui.fontFamily.value }));
      ui.fontSize.addEventListener('change', () => {
        const size = Number(ui.fontSize.value);
        if (Number.isFinite(size) && size >= 8 && size <= 400) applyToActive({ fontSize: size });
      });
      ui.fontWeight.addEventListener('change', () => applyToActive({ fontWeight: ui.fontWeight.value }));
      ui.italicBtn.addEventListener('click', () => {
        const single = activeSingle();
        if (!isTextObj(single)) return;
        applyToActive({ fontStyle: single.fontStyle === 'italic' ? 'normal' : 'italic' });
        renderProps();
      });
      ui.underlineBtn.addEventListener('click', () => {
        const single = activeSingle();
        if (!isTextObj(single)) return;
        applyToActive({ underline: !single.underline });
        renderProps();
      });
      for (const btn of ui.textAlignBtns) {
        btn.addEventListener('click', () => { applyToActive({ textAlign: btn.dataset.textalign }); renderProps(); });
      }
      ui.textColor.addEventListener('input', () => applyToActive({ fill: ui.textColor.value }));
      ui.lineHeight.addEventListener('change', () => {
        const lh = Number(ui.lineHeight.value);
        if (Number.isFinite(lh) && lh >= 0.5 && lh <= 4) applyToActive({ lineHeight: lh });
      });
      ui.charSpacing.addEventListener('change', () => {
        const cs = Number(ui.charSpacing.value);
        if (Number.isFinite(cs)) applyToActive({ charSpacing: cs });
      });

      // shape fill
      ui.shapeFill.addEventListener('input', () => applyToActive({ fill: ui.shapeFill.value }));

      // common: opacity (applies to every selected object) + delete
      ui.opacityInput.addEventListener('input', () => {
        const objs = selectionObjects();
        const value = Math.min(100, Math.max(0, Number(ui.opacityInput.value))) / 100;
        if (!objs.length || !Number.isFinite(value)) return;
        for (const o of objs) o.set('opacity', value);
        fc.requestRenderAll();
        onCanvasChanged();
      });
      ui.deleteBtn.addEventListener('click', deleteSelection);

      // slot-image fit mode + zoom (I6 extended)
      for (const btn of ui.fitBtns) {
        btn.addEventListener('click', () => {
          const single = activeSingle();
          if (!isAnySlotImage(single)) return;
          applyImageFit(single, btn.dataset.fit, single.fitZoom || 1);
          fc.requestRenderAll();
          renderProps();
          onCanvasChanged();
          updateImageContextToolbar();
        });
      }
      ui.imgZoom.addEventListener('input', () => {
        const single = activeSingle();
        if (!isSlotImage(single)) return; // zoom only when clipped
        applyImageFit(single, single.fitMode || 'cover', Number(ui.imgZoom.value) / 100);
        ui.imgZoom.setAttribute('aria-valuetext', `${ui.imgZoom.value}%`);
        fc.requestRenderAll();
        onCanvasChanged();
      });
      // Reset image to server default cover-fit
      ui.imgResetBtn.addEventListener('click', () => {
        const single = activeSingle();
        if (!isAnySlotImage(single)) return;
        resetImageToServerFit(single);
        fc.requestRenderAll();
        renderProps();
        onCanvasChanged();
        updateImageContextToolbar();
      });

      // z-order (layerRole survives — reorder never touches custom props)
      ui.forwardBtn.addEventListener('click', () => {
        const single = activeSingle();
        if (!single) return;
        fc.bringObjectForward(single);
        fc.requestRenderAll();
        onCanvasChanged();
      });
      ui.backwardBtn.addEventListener('click', () => {
        const single = activeSingle();
        if (!single) return;
        fc.sendObjectBackwards(single);
        fc.requestRenderAll();
        onCanvasChanged();
      });
      ui.frontBtn.addEventListener('click', () => {
        const single = activeSingle();
        if (!single) return;
        fc.bringObjectToFront(single);
        fc.requestRenderAll();
        onCanvasChanged();
      });
      ui.backBtn.addEventListener('click', () => {
        const single = activeSingle();
        if (!single) return;
        fc.sendObjectToBack(single);
        fc.requestRenderAll();
        onCanvasChanged();
      });

      // O8: group / ungroup / lock / duplicate
      ui.groupBtn.addEventListener('click', groupSelection);
      ui.ungroupBtn.addEventListener('click', ungroupSelection);
      ui.lockBtn.addEventListener('click', toggleLockSelection);
      ui.duplicateBtn.addEventListener('click', duplicateSelection);

      // O8: layers panel decor toggle + live-lint fix button
      ui.layersDecorToggle.addEventListener('change', refreshLayers);
      ui.lintBtn.addEventListener('click', () => applyLintFixes());

      // image controls
      ui.flipHBtn.addEventListener('click', () => {
        const single = activeSingle();
        if (single) applyToActive({ flipX: !single.flipX });
      });
      ui.flipVBtn.addEventListener('click', () => {
        const single = activeSingle();
        if (single) applyToActive({ flipY: !single.flipY });
      });

      // alignment + distribute
      for (const btn of ui.alignButtons) {
        btn.addEventListener('click', () => alignSelection(btn.dataset.align));
      }
      ui.distHBtn.addEventListener('click', () => distributeSelection('h'));
      ui.distVBtn.addEventListener('click', () => distributeSelection('v'));

      // whole-poster color swap
      ui.applySwapBtn.addEventListener('click', () => {
        const from = swapFromColor;
        const to = toHex6(ui.swapToInput.value);
        if (!from || from === to) return;
        const matches = (v) => typeof v === 'string' && v.trim().toLowerCase() === from;
        // one batch → the debounced history push records it as a single undo step
        if (matches(fc.backgroundColor)) fc.backgroundColor = to;
        for (const o of fc.getObjects()) {
          if (matches(o.fill)) o.set('fill', to);
          if (matches(o.stroke)) o.set('stroke', to);
        }
        swapFromColor = null;
        ui.colorSwapPanel.classList.add('hidden');
        fc.requestRenderAll();
        onCanvasChanged();
        renderSwatches();
        renderProps();
        syncBgSwatch();
      });

      // bulk fonts
      ui.applyHeadFontBtn.addEventListener('click', () => applyBulkFont(HEAD_ROLES, ui.headFontSelect.value));
      ui.applyBodyFontBtn.addEventListener('click', () => applyBulkFont(BODY_ROLES, ui.bodyFontSelect.value));

      // add text
      ui.addTextBtn.addEventListener('click', () => {
        const bodyFont = designState?.design?.fonts?.body || 'Inter';
        const { w: W, h: H } = DIMS[focusedSide.orientation];
        const tb = new fabric.Textbox('New text', {
          left: W / 2 - 260, top: H / 2 - 40, width: 520,
          fontSize: 56, fontFamily: bodyFont, fontWeight: 'normal',
          fill: readableTextColor(fc.backgroundColor), textAlign: 'center'
        });
        tb.layerRole = 'user-text';
        tb.extraId = 'xt-' + crypto.randomUUID();
        fc.add(tb);
        fc.setActiveObject(tb);
        fc.requestRenderAll();
      });

      // library picker (image replace / slot fill)
      ui.closeLibraryModal.addEventListener('click', closeLibraryModal);
      ui.replaceImageBtn.addEventListener('click', () => {
        const single = activeSingle();
        if (isImageObj(single) || isSlotRect(single)) openLibraryModal(single);
      });
      ui.confirmLibraryPick.addEventListener('click', async () => {
        const obj = pendingReplaceObject;
        const imageId = libraryPickedImageId;
        closeLibraryModal();
        if (!obj || !imageId) return;
        try {
          await placeImage(obj, imageId);
          flash(ui.propsStatus, 'Image placed.');
        } catch {
          flash(ui.propsStatus, 'Could not load that image.', false);
        }
      });

      // regenerate (server op — autosave paused while it runs)
      ui.regenImageBtn.addEventListener('click', async () => {
        const obj = activeSingle();
        if (!(isImageObj(obj) || isSlotRect(obj)) || !obj.slotId) return;
        ui.regenImageBtn.disabled = true;
        flash(ui.propsStatus, 'Generating a fresh image (zero-text gate)…');
        try {
          await withServerOp(async () => {
            const state = await sendJson('POST', `/api/images/slot/${encodeURIComponent(posterId)}/${encodeURIComponent(obj.slotId)}`, { source: 'generate' });
            const updated = (state.design?.canvas?.objects || []).find((o) => o.slotId === obj.slotId && o.imageId);
            if (!updated) throw new Error('Regeneration finished but no image came back — reload the editor.');
            await placeImage(obj, updated.imageId);
            // v2 designs: the server mirrors slot fills into the landscape
            // canvas — reload the OTHER side from the fresh server state so
            // the in-memory canvases don't drift (regen runs en-only, so the
            // design canvases are authoritative here).
            const otherSide = focusedSide === sides.portrait ? sides.landscape : sides.portrait;
            const otherJson = otherSide.orientation === 'landscape'
              ? (state.design?.landscapeCanvas || null) : (state.design?.canvas || null);
            if (otherSide.exists && otherJson && !otherSide.dirty) {
              // (skip when the other side holds unsaved edits — never discard them)
              await loadCanvasJson(otherSide, otherJson);
              resetHistory(otherSide);
              otherSide.dirty = false;
              updateDirtyDot();
              notifyPreviewSoon(otherSide);
            }
          });
          flash(ui.propsStatus, 'Image regenerated — passed the zero-text gate.');
        } catch (err) {
          flash(ui.propsStatus, err.message, false);
        } finally {
          ui.regenImageBtn.disabled = false;
        }
      });

      // template switch
      ui.changeTemplateBtn.addEventListener('click', openTemplateModal);
      ui.closeTemplateModal.addEventListener('click', closeTemplateModal);
      ui.confirmTemplatePick.addEventListener('click', async () => {
        if (!pickedTemplateId) return;
        const warning = (sides.portrait.dirty || sides.landscape.dirty)
          ? 'You have unsaved layout changes — applying a template replaces the whole layout (your approved text is kept). Continue?'
          : 'Applying a template rebuilds the layout from your approved content. Continue?';
        if (!confirm(warning)) return;
        ui.confirmTemplatePick.disabled = true;
        flash(ui.templateModalStatus, 'Compiling the template with your approved content…');
        try {
          await withServerOp(async () => {
            const state = await sendJson('POST', `/api/design/${encodeURIComponent(posterId)}/apply`, { templateId: pickedTemplateId });
            designState = state;
            rebuildCtxSwatches(); // palette may have changed with the new template
            // the applied template IS the persisted server state — both
            // orientations reload clean (dirty=false inside the loader)
            await loadLanguageCanvases(state.design.canvas, state.design.landscapeCanvas || null);
            populateFontSelects();
          });
          closeTemplateModal();
          flash(ui.saveStatus, 'Template applied.');
        } catch (err) {
          flash(ui.templateModalStatus, err.message, false);
          ui.confirmTemplatePick.disabled = false;
        }
      });

      // save-as + feedback prompt
      ui.saveAsBtn.addEventListener('click', () => {
        if (!designState || !EDITABLE_PHASES.includes(designState.phase)) return;
        openSaveAsModal();
      });
      ui.closeSaveAsModal.addEventListener('click', closeSaveAsModal);
      ui.cancelSaveAs.addEventListener('click', closeSaveAsModal);
      ui.saveAsModal.addEventListener('click', (e) => {
        if (e.target === ui.saveAsModal) closeSaveAsModal();
      });
      ui.confirmSaveAs.addEventListener('click', async () => {
        const name = ui.saveAsNameInput.value.trim();
        if (!name) {
          ui.saveAsStatus.textContent = 'Name cannot be empty.';
          ui.saveAsStatus.className = 'status err';
          return;
        }
        ui.confirmSaveAs.disabled = true;
        ui.cancelSaveAs.disabled = true;
        ui.saveAsStatus.textContent = 'Saving…';
        ui.saveAsStatus.className = 'status';
        try {
          // Flush autosave first so the canvas is persisted before naming
          await flushAutosave();
          const result = await sendJson('POST', `/api/posters/${encodeURIComponent(posterId)}/save`, { name });
          if (designState) {
            designState.name = result.name;
            designState.phase = result.phase;
          }
          const nameEl = document.getElementById('posterName');
          if (nameEl) {
            nameEl.textContent = result.name;
            document.title = `${result.name} — Editor`;
          }
          ui.saveAsBtn.textContent = 'Rename & save';
          flash(ui.saveStatus, `Saved as "${result.name}"`);
          closeSaveAsModal();
          _feedbackPosterId = posterId;
          openFeedbackPrompt();
        } catch (err) {
          ui.saveAsStatus.textContent = err.message;
          ui.saveAsStatus.className = 'status err';
          ui.confirmSaveAs.disabled = false;
          ui.cancelSaveAs.disabled = false;
        } finally {
          ui.cancelSaveAs.disabled = false;
        }
      });

      ui.feedbackGoodBtn.addEventListener('click', () => pickFeedbackRating('good'));
      ui.feedbackBadBtn.addEventListener('click', () => pickFeedbackRating('bad'));
      ui.skipFeedbackBtn.addEventListener('click', closeFeedbackPrompt);
      ui.submitFeedbackBtn.addEventListener('click', async () => {
        if (!_pendingFeedbackRating || !_feedbackPosterId) return;
        const rating = _pendingFeedbackRating;
        const remarks = ui.feedbackRemarks.value.trim();
        ui.feedbackGoodBtn.disabled = true;
        ui.feedbackBadBtn.disabled = true;
        ui.submitFeedbackBtn.disabled = true;
        ui.feedbackStatus.textContent = 'Sending…';
        ui.feedbackStatus.className = 'status';
        try {
          await sendJson('POST', `/api/posters/${encodeURIComponent(_feedbackPosterId)}/feedback`,
            { rating, ...(remarks ? { remarks } : {}) });
          ui.feedbackStatus.textContent = 'Thanks for the feedback!';
          ui.feedbackStatus.className = 'status ok';
          setTimeout(closeFeedbackPrompt, 1800);
        } catch (err) {
          ui.feedbackStatus.textContent = err.message;
          ui.feedbackStatus.className = 'status err';
          ui.feedbackGoodBtn.disabled = false;
          ui.feedbackBadBtn.disabled = false;
          ui.submitFeedbackBtn.disabled = false;
        }
      });

      // translation: sync banner
      ui.syncAllBtn.addEventListener('click', async () => {
        if (!pendingSyncLang) return;
        const lang = pendingSyncLang;
        hideSyncBanner();
        ui.syncAllBtn.disabled = true;
        flash(ui.saveStatus, 'Syncing to all languages…');
        try {
          const state = await sendJson('POST', `/api/translation/${encodeURIComponent(posterId)}/${encodeURIComponent(lang)}/sync`, {});
          translationState = state;
          populateLangDropdown();
          updateScopeToggle();
          flash(ui.saveStatus, 'All languages updated.');
        } catch (err) {
          flash(ui.saveStatus, err.message, false);
        } finally {
          ui.syncAllBtn.disabled = false;
        }
      });
      ui.keepIndividualBtn.addEventListener('click', hideSyncBanner);

      // translation: language dropdown
      ui.langSelect.addEventListener('change', () => switchLanguage(ui.langSelect.value));

      // translation: translate modal
      ui.closeTranslateModal.addEventListener('click', closeTranslateModal);
      ui.translateBtn.addEventListener('click', () => {
        ui.translateModalStatus.textContent = '';
        ui.translateFailures.classList.add('hidden');
        ui.translateFailures.textContent = '';
        buildTranslateTargets();
        ui.translateModal.classList.remove('hidden');
      });
      ui.startTranslateBtn.addEventListener('click', async () => {
        const targetsBox = ui.translateTargets;
        const allRadio = targetsBox.querySelector('input[value="all"]');
        let languages;
        if (allRadio && allRadio.checked) {
          languages = 'all';
        } else {
          languages = [...targetsBox.querySelectorAll('input[name="edInlineTranslateLang"]:checked')].map((cb) => cb.value);
          if (!languages.length) return;
        }

        ui.startTranslateBtn.disabled = true;
        ui.closeTranslateModal.disabled = true;
        ui.translateSpinner.classList.remove('hidden');
        ui.translateModalStatus.textContent = '';
        ui.translateFailures.classList.add('hidden');

        try {
          const state = await sendJson('POST', `/api/translation/${encodeURIComponent(posterId)}/start`, { languages });
          translationState = state;
          populateLangDropdown();
          updateScopeToggle();
          const failedLangs = state.failed || [];
          if (failedLangs.length) {
            const failuresDiv = ui.translateFailures;
            failuresDiv.textContent = '';
            failuresDiv.appendChild(el('p', '', 'Some languages failed — you can retry them:'));
            for (const f of failedLangs) {
              const langMeta = (translationMeta.languages || []).find((l) => l.id === f.lang);
              const labelText = langMeta ? langMeta.label : f.lang;
              failuresDiv.appendChild(el('p', '', labelText + ' failed — retry'));
            }
            failuresDiv.classList.remove('hidden');
          } else {
            flash(ui.translateModalStatus, 'Translation complete.');
            setTimeout(closeTranslateModal, 1800);
          }
        } catch (err) {
          ui.translateModalStatus.textContent = '';
          ui.translateModalStatus.appendChild(el('span', '', err.message));
          ui.translateModalStatus.className = 'status err';
        } finally {
          ui.startTranslateBtn.disabled = false;
          ui.closeTranslateModal.disabled = false;
          ui.translateSpinner.classList.add('hidden');
        }
      });
    }

    // ── boot / destroy ───────────────────────────────────────────────────────

    async function fail(message) {
      await destroy({ flush: false });
      onFatal(message);
    }

    async function init() {
      if (!container) {
        onFatal('EditorInline.mount: no container element given.');
        return;
      }
      if (!posterId) {
        buildDomSafe();
        await fail('No poster selected — open the editor from the create flow or the library.');
        return;
      }
      buildDomSafe();
      let state;
      try {
        state = await api(`/api/design/${encodeURIComponent(posterId)}`);
      } catch (err) {
        await fail(err.code === 'UNAUTHORIZED' ? 'Not authorized.' : `Cannot load this poster: ${err.message}`);
        return;
      }
      if (destroyed) return;
      if (!state.design || !state.design.canvas) {
        await fail('This poster has no design yet — finish the design step in the create flow first.');
        return;
      }
      if (!EDITABLE_PHASES.includes(state.phase)) {
        await fail(`This poster is in phase "${state.phase}" and cannot be edited yet — approve content and pick a design first.`);
        return;
      }
      designState = state;
      rebuildCtxSwatches(); // O8: context-toolbar swatches from the poster palette
      if (onLoaded) {
        try { onLoaded(state); } catch { /* host callback must not break boot */ }
      }

      // save-as button label and visibility based on phase
      if (EDITABLE_PHASES.includes(state.phase)) {
        ui.saveAsBtn.textContent = state.phase === 'saved' ? 'Rename & save' : 'Save poster…';
        ui.saveAsBtn.classList.remove('hidden');
      } else {
        ui.saveAsBtn.classList.add('hidden');
      }

      // T3: one interactive fabric.Canvas per orientation. The landscape one
      // exists from boot (cheap) but only "exists" (editable/saveable/visible)
      // when the active language carries a landscape canvas.
      for (const o of ORIENTATIONS) {
        sides[o].fc = new fabric.Canvas(sides[o].canvasEl, { preserveObjectStacking: true });
      }
      focusedSide = sides.portrait;
      fc = sides.portrait.fc;
      sides.portrait.frame.classList.add('focused');
      populateFontSelects();

      // per-side event wiring: change tracking + focus model + bound-text
      // mirroring (text:changed only — geometry/style never mirrors)
      for (const o of ORIENTATIONS) {
        const side = sides[o];
        const sfc = side.fc;
        sfc.on('object:modified', () => {
          onCanvasChanged(side);
          if (side === focusedSide) {
            updateContextToolbar();
            positionContextToolbar();
            // reposition image toolbar if an image is selected
            const sel = side.fc && side.fc.getActiveObject();
            if (sel && isImageObj(sel) && !isTextObj(sel)) {
              updateImageContextToolbar();
            }
          }
        });
        sfc.on('object:added', () => onCanvasChanged(side));
        sfc.on('object:removed', () => { onCanvasChanged(side); if (!side.suppressEvents && side === focusedSide) renderSwatches(); });
        sfc.on('text:changed', (e) => {
          onCanvasChanged(side);
          mirrorBoundText(side, e && e.target);
          // auto-fit the text as it changes
          if (e && e.target && side === focusedSide) {
            autofitObj(e.target);
            sfc.requestRenderAll();
            updateContextToolbar();
          }
        });
        sfc.on('mouse:down', () => setFocusedSide(side));
        sfc.on('selection:created', () => { setFocusedSide(side); renderProps(); updateContextToolbar(); refreshLayers(); });
        sfc.on('selection:updated', () => { if (side === focusedSide) { renderProps(); updateContextToolbar(); refreshLayers(); } });
        sfc.on('selection:cleared', () => {
          if (side === focusedSide) {
            renderProps();
            refreshLayers();
            if (ui.ctxToolbar) ui.ctxToolbar.classList.add('hidden');
            if (ui.imgCtxToolbar) ui.imgCtxToolbar.classList.add('hidden');
          }
        });
        wireSnapGuides(side);
        wireImageDoubleClick(side);
      }
      wireControls();

      try {
        await loadLanguageCanvases(state.design.canvas, state.design.landscapeCanvas || null);
      } catch {
        await fail('The canvas could not be rendered — an image file may be missing. Reload to retry.');
        return;
      }
      if (destroyed) return;
      // the host card may still be mid-expand at mount time — re-fit once settled
      if (ui.canvasStage.clientHeight < 120) {
        setTimeout(() => {
          if (destroyed) return;
          for (const o of ORIENTATIONS) {
            const side = sides[o];
            if (side.fc && side.exists && !side.frame.classList.contains('hidden')) zoomToFit(side);
          }
        }, 400);
      }

      document.addEventListener('keydown', onKeydown);
      window.addEventListener('beforeunload', onBeforeUnload);

      // translation subsystem boot
      const TRANSLATABLE_PHASES_UI = ['designed', 'saved', 'translated'];
      if (TRANSLATABLE_PHASES_UI.includes(state.phase)) {
        ui.translateBtn.classList.remove('hidden');
      }
      try {
        translationMeta = await api('/api/translation/meta/languages');
      } catch {
        translationMeta = null;
      }
      await refreshTranslationState();
      populateLangDropdown();
      activeLang = 'en';
      applyEnOnlyDisable(false);
      setEditScope('this'); // T4: scope is session-scoped — resets on mount

      // initial live-preview push: the host mirror equals the editor from t0
      notifyPreviewSoon();
    }

    function buildDomSafe() {
      try { buildDom(); } catch (err) {
        onFatal(`The editor UI could not be built: ${err.message}`);
        throw err;
      }
    }

    async function destroy({ flush = true } = {}) {
      if (destroyed) return;
      if (flush && fc) {
        try { await flushAutosave(); } catch { /* teardown continues regardless */ }
      }
      destroyed = true;
      document.removeEventListener('keydown', onKeydown);
      window.removeEventListener('beforeunload', onBeforeUnload);
      fc = null;
      for (const o of ORIENTATIONS) {
        const side = sides[o];
        clearTimeout(side.autosaveTimer);
        clearTimeout(side.historyTimer);
        clearTimeout(side.notifyTimer);
        clearTimeout(side.lintTimer);
        if (side.fc) {
          const disposing = side.fc;
          side.fc = null;
          try { await disposing.dispose(); } catch { /* double-dispose races are harmless */ }
        }
      }
      for (const node of overlays) node.remove();
      overlays.length = 0;
      if (ui.toolbar) ui.toolbar.remove();
      container.classList.remove('editor-inline-host');
      container.textContent = '';
    }

    return { init, destroy, flushAutosave, get destroyed() { return destroyed; } };
  }

  // ── public singleton API ────────────────────────────────────────────────────
  //
  // mount/unmount/flush are SERIALIZED on one promise chain: a host that
  // collapses a station (fire-and-forget unmount, which awaits the autosave
  // flush) and immediately re-expands it must never let the old instance's
  // teardown wipe the freshly mounted DOM.

  let active = null;
  let opChain = Promise.resolve();

  function enqueue(fn) {
    const run = opChain.then(fn, fn);
    opChain = run.catch(() => { /* one failed op never blocks the next */ });
    return run;
  }

  window.EditorInline = {
    /**
     * Mount the editor into a container. Options:
     *   container         (required) host element for toolbar+shell
     *   posterId          (required) poster to edit
     *   onStateChange(p)  debounced ~100ms per orientation with
     *                     { canvases: { portrait: json } } and, when the
     *                     design/variant carries one, { canvases: { landscape: json } }
     *   toolbarContainer  optional external node for the toolbar (page chrome)
     *   onLoaded(state)   safe design state once loaded (name/title chrome)
     *   onFatal(message)  fatal boot errors (default: banner in container)
     */
    mount(options) {
      return enqueue(async () => {
        if (active) {
          const prev = active;
          active = null;
          await prev.destroy();
        }
        const inst = createInstance(options || {});
        active = inst;
        await inst.init();
        if (inst.destroyed && active === inst) active = null;
      });
    },

    /** Flush autosave, then tear down DOM, canvas and listeners. */
    unmount() {
      return enqueue(async () => {
        const inst = active;
        active = null;
        if (inst) await inst.destroy();
      });
    },

    /** The editor's own flush — hosts call this before navigating away. */
    flushAutosave() {
      return enqueue(async () => {
        if (active) await active.flushAutosave();
      });
    },

    isMounted() { return Boolean(active); }
  };
})();
