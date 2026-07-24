// Thin page wrapper around the embeddable editor component (Phase O7).
//
// ALL editing machinery — canvas load/serialize custom-prop round-trip,
// autosave/queued-save drain, undo/redo, selection panel, color swap, fonts,
// alignment/snap, image replace/regenerate, template switch, translation
// language dropdown + variant saves, save-as + feedback prompt — moved to
// js/editor_inline.js (window.EditorInline). This file only owns the PAGE:
// posterId query param, fatal banner handling, topbar name/title chrome, and
// mounting the component into the static shell. Library deep-links
// (editor.html?posterId=…) work exactly as before.
//
// XSS discipline: user/model-derived strings render via textContent only.

const posterId = new URLSearchParams(location.search).get('posterId');

let posterName = 'poster';

// ── export controls (reuse window.PosterExport — export.js is loaded) ─────────
// Exports the last-saved design fetched from /api/design/:id (the editor
// autosaves, so this tracks the current poster). Same call shape the create
// page uses, so images resolve from the absolute /api/images/file/<id> srcs.
async function fetchDesign() {
  const res = await fetch(`/api/design/${encodeURIComponent(posterId)}`, window.authOptions(null));
  if (!res.ok) throw new Error(res.status === 401 ? 'not authorized — reopen the tokenized URL' : `HTTP ${res.status}`);
  return res.json();
}

function wireEditorExport() {
  const orientSel = document.getElementById('editorExportOrient');
  const status = document.getElementById('editorExportStatus');
  const btns = {
    pptx: document.getElementById('editorExportPpt'),
    html: document.getElementById('editorExportHtml'),
    jpeg: document.getElementById('editorExportJpeg')
  };
  if (!orientSel || !btns.pptx) return;

  const flash = (msg, ok = true) => {
    status.textContent = msg;
    status.className = `status ${ok ? 'ok' : 'err'}`;
    if (ok) setTimeout(() => { if (status.textContent === msg) status.textContent = ''; }, 4000);
  };

  async function runExport(kind) {
    const orientation = orientSel.value;
    // export the CURRENTLY-VIEWED language variant (the editor's language
    // dropdown), so switching to a translation and exporting yields that
    // variant — not the English base. 'en' = the base design canvas.
    const langSel = document.querySelector('.lang-select');
    const lang = (langSel && langSel.value) || 'en';
    for (const b of Object.values(btns)) b.disabled = true;
    flash('Preparing export…');
    try {
      const state = await fetchDesign();
      let canvasJSON;
      if (lang === 'en') {
        canvasJSON = orientation === 'landscape' ? state.design?.landscapeCanvas : state.design?.canvas;
      } else {
        const vres = await fetch(`/api/translation/${encodeURIComponent(posterId)}/${encodeURIComponent(lang)}`, window.authOptions(null));
        if (!vres.ok) throw new Error(`Could not load the ${lang} variant (HTTP ${vres.status}).`);
        const variant = await vres.json();
        canvasJSON = orientation === 'landscape' ? variant?.landscapeCanvas : variant?.canvas;
      }
      if (!canvasJSON) throw new Error(`This poster has no ${orientation} canvas for "${lang}".`);
      const job = { canvasJSON, orientation, name: state.name || posterName, lang };
      if (kind === 'pptx') await window.PosterExport.toPptx(job);
      else if (kind === 'html') await window.PosterExport.toHtml(job);
      else await window.PosterExport.toJpeg(job);
      flash(`${kind.toUpperCase()} downloaded.`);
    } catch (err) {
      flash(err.message || 'Export failed.', false);
    } finally {
      for (const b of Object.values(btns)) b.disabled = false;
    }
  }

  btns.pptx.addEventListener('click', () => runExport('pptx'));
  btns.html.addEventListener('click', () => runExport('html'));
  btns.jpeg.addEventListener('click', () => runExport('jpeg'));

  // hide the landscape option when this poster has no landscape canvas
  fetchDesign().then((state) => {
    if (!state.design?.landscapeCanvas) {
      const opt = orientSel.querySelector('option[value="landscape"]');
      if (opt) opt.remove();
    }
  }).catch(() => { /* availability probe is best-effort */ });
}

function fatal(message) {
  const banner = document.getElementById('loadBanner');
  banner.textContent = '';
  const strong = document.createElement('strong');
  strong.textContent = message;
  const link = document.createElement('a');
  link.href = 'library.html';
  link.textContent = ' Back to the library.';
  banner.append(strong, link);
  banner.classList.remove('hidden');
  document.getElementById('editorShell').classList.add('hidden');
}

async function boot() {
  if (!window.EditorInline) {
    fatal('The editor component failed to load — reload the page.');
    return;
  }
  await window.EditorInline.mount({
    container: document.getElementById('editorShell'),
    // the toolbar (undo/zoom/language/save…) renders into the topbar, exactly
    // where the old static markup kept it — the page stays visually identical
    toolbarContainer: document.getElementById('editorToolbarHost'),
    posterId,
    onFatal: fatal,
    onLoaded: (state) => {
      posterName = state.name || 'poster';
      document.getElementById('posterName').textContent = state.name;
      document.title = `${state.name} — Editor`;
    }
  });
  wireEditorExport();
}

boot();
