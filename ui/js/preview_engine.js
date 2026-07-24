// Live dual-orientation preview engine (Phase O2). A single client-side
// poster store (PosterState) drives two fabric StaticCanvas previews mounted
// in the right rail (#previewPortrait / #previewLandscape). Every mutation
// schedules ONE debounced (60ms) render of both orientations.
//
// Render source priority per orientation:
//   (a) a full canvas JSON in state.canvases[orientation] → fabric render
//       (loadFromJSON + custom-prop reattach, the editor_page idiom), with
//       LIVE text patching from state.content — no server round-trip;
//   (b) no canvas yet but a chosen template → the template's server-rendered
//       preview SVG (trusted innerHTML sink, same discipline as the gallery)
//       under an "awaiting content" veil / live headline overlay;
//   (c) neither → the existing empty framed placeholder.
//
// The SERVER stays source of truth for persisted state: this store renders
// optimistic local state and callers reconcile it from server responses.
//
// XSS discipline: all user/model text renders via textContent. The ONLY
// innerHTML sink is the server-generated template preview SVG
// (palette-resolved geometry from our own template modules, no user text).
//
// Palette-override recoloring is intentionally NOT implemented here — colors
// are the editor's job (Phase O7).

(function () {
  'use strict';

  const DEBOUNCE_MS = 60;
  const RESIZE_DEBOUNCE_MS = 150;
  const FRAME_PAD_X = 28;          // .preview-frame horizontal padding (14+14)
  const FALLBACK_FRAME_W = 332;    // rail width when the frame is hidden (0px)
  const DIMS = {
    portrait: { w: 1414, h: 2000 },
    landscape: { w: 2000, h: 1414 }
  };
  // custom-prop round-trip, the editor_page.js idiom + fieldRef (v2 qa-pair
  // style blocks bind two texts of one block through it)
  const EXTRA_PROPS = ['layerRole', 'msgId', 'slotId', 'slotSpec', 'imageId', 'bgRef', 'extraId', 'fieldRef'];

  // ── PosterState: plain reactive store ─────────────────────────────────────

  class PosterState {
    constructor() {
      this._data = {
        templateId: null,
        templateMeta: null,      // gallery item: contentSchema + previews {portrait,landscape}
        content: null,           // v2 blocks or v1 messages shape
        paletteOverride: null,
        canvases: { portrait: null, landscape: null },
        images: {}               // slotId → url (informational; canvases carry the render)
      };
      this._subs = new Set();
    }
    get() { return this._data; }
    /** Shallow merge; `canvases` and `images` merge one level deep so callers
     *  can patch a single orientation/slot. Explicit null keys overwrite. */
    set(patch) {
      if (!patch || typeof patch !== 'object') return;
      const next = { ...this._data };
      for (const [k, v] of Object.entries(patch)) {
        if ((k === 'canvases' || k === 'images') && v && typeof v === 'object') {
          next[k] = { ...this._data[k], ...v };
        } else {
          next[k] = v;
        }
      }
      this._data = next;
      for (const fn of this._subs) {
        try { fn(this._data); } catch { /* one bad subscriber never blocks the rest */ }
      }
    }
    subscribe(fn) {
      this._subs.add(fn);
      return () => this._subs.delete(fn);
    }
  }

  // ── content ⇄ canvas binding (client twin of translation/canvas_text.js) ──

  /** Resolve the block/message a canvas object's msgId points at. v2 content
   *  carries `blocks` (ids 'blk-N'); v1 carries `messages` — same lookup. */
  function blockById(content, id) {
    const list = Array.isArray(content.blocks) ? content.blocks
      : Array.isArray(content.messages) ? content.messages : [];
    return list.find((b) => b && b.id === id) || null;
  }

  /**
   * The content value a canvas object is bound to, or undefined when the
   * binding is unknown (unknown layerRole / msgId / fieldRef) — callers must
   * leave the object untouched then. A found binding may still be null/''
   * (field explicitly blank → blank the canvas text, never leave stale copy).
   *
   * Binding rules mirrored from the server (templates + canvas_text.js):
   *   v2: layerRole 'message' + msgId 'blk-N' (+ optional fieldRef naming the
   *       block field, e.g. 'question'/'answer'; default field is 'text');
   *       labels ride layerRole 'message-label' + msgId → block.label.
   *   v1: layerRole 'message-text' / 'message-label' + msgId → messages[].text/.label.
   *   both: 'headline' / 'subheadline' / 'cta' → top-level fields.
   */
  function boundValue(obj, content) {
    switch (obj.layerRole) {
      case 'headline': return content.headline;
      case 'subheadline': return content.subheadline;
      case 'cta': return content.callToAction;
      case 'message': {
        const b = blockById(content, obj.msgId);
        if (!b) return undefined;
        const field = typeof obj.fieldRef === 'string' && obj.fieldRef ? obj.fieldRef : 'text';
        return Object.prototype.hasOwnProperty.call(b, field) ? b[field] : undefined;
      }
      case 'message-text': {
        const b = blockById(content, obj.msgId);
        return b ? b.text : undefined;
      }
      case 'message-label': {
        const b = blockById(content, obj.msgId);
        return b ? b.label : undefined;
      }
      default: return undefined;
    }
  }

  function patchedText(value) {
    return (typeof value === 'string' && value.trim()) ? value : '';
  }

  /**
   * Client twin of the server's applyContentToCanvas: swap text INTO a cloned
   * canvas JSON by layerRole/msgId/fieldRef so content edits update the
   * preview without a server round-trip. Unknown bindings stay untouched.
   */
  function applyContentToCanvasClient(canvasJSON, content) {
    const out = structuredClone(canvasJSON);
    if (!content || typeof content !== 'object') return out;
    for (const obj of out.objects || []) {
      if (!obj || typeof obj.text !== 'string') continue;
      const value = boundValue(obj, content);
      if (value === undefined) continue;
      obj.text = patchedText(value);
    }
    return out;
  }

  /** In-place text patch on live fabric instances (fast path for keystrokes —
   *  possible because reattachProps restored the binding props). */
  function fastPatchText(fc, content) {
    if (!content || typeof content !== 'object') return;
    for (const obj of fc.getObjects()) {
      if (typeof obj.text !== 'string') continue;
      const value = boundValue(obj, content);
      if (value === undefined) continue;
      const text = patchedText(value);
      if (obj.text !== text) obj.set('text', text);
    }
    fc.requestRenderAll();
  }

  /** Re-attach persisted custom props onto enlivened instances (same order —
   *  the editor_page.js idiom). */
  function reattachProps(instances, sourceObjects) {
    (sourceObjects || []).forEach((src, i) => {
      const inst = instances[i];
      if (!inst || !src) return;
      for (const p of EXTRA_PROPS) {
        if (src[p] !== undefined) inst[p] = src[p];
      }
    });
  }

  // ── renderer ───────────────────────────────────────────────────────────────

  const state = new PosterState();
  let sides = null;            // { portrait: side, landscape: side }
  let renderTimer = null;
  let resizeTimer = null;
  let rendering = false;
  let renderQueued = false;

  /** Build the per-orientation mount bookkeeping around the existing frame
   *  markup (label + canvas + empty placeholder), adding the SVG box + veil. */
  function makeSide(canvasEl, orientation) {
    const wrap = canvasEl.parentElement;                 // .preview-frame
    const emptyEl = wrap.querySelector('.preview-empty');

    const svgBox = document.createElement('div');
    svgBox.className = 'preview-svg-box hidden';
    svgBox.style.position = 'relative';
    svgBox.style.width = '100%';

    const svgHost = document.createElement('div');
    svgHost.style.lineHeight = '0';

    const veil = document.createElement('div');
    veil.className = 'hidden';
    veil.style.position = 'absolute';
    veil.style.inset = '0';
    veil.style.display = 'flex';
    veil.style.flexDirection = 'column';
    veil.style.justifyContent = 'center';
    veil.style.alignItems = 'center';
    veil.style.gap = '4px';
    veil.style.padding = '10px';
    veil.style.textAlign = 'center';
    veil.style.borderRadius = '4px';
    const veilTitle = document.createElement('strong');
    veilTitle.style.fontSize = '12px';
    veilTitle.style.color = '#fff';
    veilTitle.style.textShadow = '0 1px 4px rgba(0,0,0,0.8)';
    const veilSub = document.createElement('span');
    veilSub.style.fontSize = '10px';
    veilSub.style.color = 'rgba(255,255,255,0.85)';
    veilSub.style.textShadow = '0 1px 4px rgba(0,0,0,0.8)';
    veil.append(veilTitle, veilSub);

    const hint = document.createElement('p');
    hint.className = 'hidden';
    hint.style.margin = '6px 0 0';
    hint.style.fontSize = '10px';
    hint.style.color = 'var(--muted, #8a8f98)';
    hint.style.textAlign = 'center';

    svgBox.append(svgHost, veil, hint);
    wrap.insertBefore(svgBox, emptyEl);

    return {
      orientation, el: canvasEl, wrap, emptyEl,
      svgBox, svgHost, veil, veilTitle, veilSub, hint,
      fc: null,            // fabric.StaticCanvas
      loadedJson: null,    // the exact canvases[orientation] object last loaded
      svgTemplateId: null  // template whose preview SVG is currently mounted
    };
  }

  function showMode(side, mode) {
    side.el.classList.toggle('hidden', mode !== 'canvas');
    side.svgBox.classList.toggle('hidden', mode !== 'svg');
    side.emptyEl.classList.toggle('hidden', mode !== 'empty');
  }

  /** Scale a full-size canvas to the frame's inner width (never above 1:1). */
  function computeScale(side, canvasW) {
    const inner = side.wrap.clientWidth ? side.wrap.clientWidth - FRAME_PAD_X : FALLBACK_FRAME_W;
    return Math.min(1, inner / canvasW);
  }

  async function disposeFabric(side) {
    if (!side.fc) return;
    const fc = side.fc;
    side.fc = null;
    side.loadedJson = null;
    try { await fc.dispose(); } catch { /* double-dispose during teardown races is harmless */ }
  }

  async function renderCanvasSide(side, json, content) {
    showMode(side, 'canvas');
    side.svgTemplateId = null;
    const w = json.width || DIMS[side.orientation].w;
    const h = json.height || DIMS[side.orientation].h;
    const scale = computeScale(side, w);
    const outW = Math.round(w * scale);
    const outH = Math.round(h * scale);

    if (side.fc && side.loadedJson === json) {
      // same canvas → re-scale if the frame resized, then live-patch text
      if (side.fc.getWidth() !== outW || side.fc.getHeight() !== outH) {
        side.fc.setDimensions({ width: outW, height: outH });
        side.fc.setZoom(scale);
      }
      if (content) fastPatchText(side.fc, content);
      side.fc.requestRenderAll();
      return;
    }

    // new canvas JSON → full reload (objects+background only: loadFromJSON
    // would otherwise restore full poster dimensions onto the scaled preview)
    const patched = content ? applyContentToCanvasClient(json, content) : json;
    await disposeFabric(side);
    side.fc = new fabric.StaticCanvas(side.el, { width: outW, height: outH });
    await side.fc.loadFromJSON({ objects: patched.objects || [], background: patched.background || '' });
    reattachProps(side.fc.getObjects(), patched.objects);
    side.fc.setZoom(scale);
    side.fc.renderAll();
    side.loadedJson = json;
  }

  async function renderSvgSide(side, data) {
    showMode(side, 'svg');
    await disposeFabric(side);
    if (side.svgTemplateId !== data.templateMeta.id) {
      // trusted server-generated preview SVG — the one sanctioned innerHTML
      // sink (palette-resolved geometry from our own template modules)
      side.svgHost.innerHTML = data.templateMeta.previews[side.orientation];
      const svg = side.svgHost.querySelector('svg');
      if (svg) {
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.style.display = 'block';
        svg.style.borderRadius = '4px';
      }
      side.svgTemplateId = data.templateMeta.id;
    }
    // veil / hint (all captions render via textContent)
    if (side.orientation === 'landscape' && data.canvases.portrait) {
      // portrait canvas compiled, landscape canvas arrives with design v2
      // (O10) — keep the template preview veil-free with a small hint
      side.veil.classList.add('hidden');
      side.hint.textContent = 'Landscape layout compiles at design v2.';
      side.hint.classList.remove('hidden');
    } else if (!data.content) {
      side.veil.style.background = 'rgba(8, 10, 14, 0.55)';
      side.veil.style.justifyContent = 'center';
      side.veilTitle.textContent = 'Awaiting content';
      side.veilSub.textContent = 'Generated text lands here live as the pipeline writes it.';
      side.veil.classList.remove('hidden');
      side.hint.classList.add('hidden');
    } else {
      // content exists but no canvas yet: overlay the live headline/CTA over
      // the template preview so text edits reflect immediately
      side.veil.style.background = 'linear-gradient(rgba(8,10,14,0) 40%, rgba(8,10,14,0.85))';
      side.veil.style.justifyContent = 'flex-end';
      side.veilTitle.textContent = String(data.content.headline || '');
      side.veilSub.textContent = String(data.content.callToAction || '');
      side.veil.classList.remove('hidden');
      side.hint.textContent = 'Live text over the template preview — the Design station compiles the real canvas.';
      side.hint.classList.remove('hidden');
    }
  }

  async function renderSide(side, data) {
    const json = data.canvases[side.orientation];
    if (json) {
      await renderCanvasSide(side, json, data.content);
    } else if (data.templateMeta && data.templateMeta.previews
               && data.templateMeta.previews[side.orientation]) {
      await renderSvgSide(side, data);
    } else {
      showMode(side, 'empty');
      side.svgTemplateId = null;
      await disposeFabric(side);
    }
  }

  async function render() {
    if (!sides) return;
    if (rendering) { renderQueued = true; return; }
    rendering = true;
    try {
      const data = state.get();
      for (const o of ['portrait', 'landscape']) {
        try {
          await renderSide(sides[o], data);
        } catch (err) {
          // a broken canvas (e.g. missing image file) must never wedge the
          // page — fall back to the framed placeholder for that orientation
          console.error(`preview render failed (${o})`, err);
          showMode(sides[o], 'empty');
          await disposeFabric(sides[o]);
        }
      }
    } finally {
      rendering = false;
      if (renderQueued) { renderQueued = false; scheduleRender(); }
    }
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, DEBOUNCE_MS);
  }

  // ── public API ─────────────────────────────────────────────────────────────

  /** Mount the engine on the two preview canvas elements (right rail). */
  function initPreview({ portraitEl, landscapeEl }) {
    sides = {
      portrait: makeSide(portraitEl, 'portrait'),
      landscape: makeSide(landscapeEl, 'landscape')
    };
    state.subscribe(scheduleRender);
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(scheduleRender, RESIZE_DEBOUNCE_MS);
    });
    // Text measured before the poster fonts finish loading renders with the
    // fallback font's metrics — headlines land misaligned / wrong width. When
    // the fonts arrive, force a FULL reload of both sides (drop the loadedJson
    // cache) so every textbox re-measures with the real faces.
    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
      document.fonts.ready.then(() => {
        if (!sides) return;
        for (const o of ['portrait', 'landscape']) sides[o].loadedJson = null;
        scheduleRender();
      });
    }
    scheduleRender();
  }

  /** Orientation tabs: 'portrait' | 'landscape' | 'both'. Toggles the frames
   *  and re-renders (a frame un-hiding changes the available width). */
  function setOrientationVisibility(mode) {
    document.getElementById('previewPortraitWrap').classList.toggle('hidden', mode === 'landscape');
    document.getElementById('previewLandscapeWrap').classList.toggle('hidden', mode === 'portrait');
    scheduleRender();
  }

  window.PreviewEngine = {
    PosterState,
    state,
    initPreview,
    setOrientationVisibility,
    applyContentToCanvasClient
  };
})();
