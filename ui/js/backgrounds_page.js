// Backgrounds & Patterns page — standalone background generator + library.
// Reads GET /api/images?kind=background (library grid) and calls
// POST /api/images/generate-background (generate new backgrounds).
// Auto-generates 1 gradient + 1 pattern on first visit when the library holds
// fewer than 2 backgrounds (sessionStorage guard 'bgAutogenDone' — at most
// once per session). All values rendered via textContent (XSS discipline).

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // ── API helper ───────────────────────────────────────────────────────────────

  async function api(path, method, body) {
    const opts = window.authOptions({
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    if (res.status === 401) {
      $('authBanner').classList.remove('hidden');
      const err = new Error('unauthorized');
      err.code = 'UNAUTHORIZED';
      throw err;
    }
    if (!res.ok) {
      let errBody = {};
      try { errBody = await res.json(); } catch { /* non-json error */ }
      const err = new Error(errBody.error || errBody.message || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  // ── Treatment segmented control ───────────────────────────────────────────────

  let currentTreatment = 'gradient';

  function initTreatmentControl() {
    const ctrl = $('treatmentCtrl');
    ctrl.addEventListener('click', (e) => {
      const btn = e.target.closest('.bg-seg-btn');
      if (!btn) return;
      ctrl.querySelectorAll('.bg-seg-btn').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      currentTreatment = btn.dataset.treatment;
    });
  }

  // ── Character count ───────────────────────────────────────────────────────────

  function initCharCount() {
    const input = $('bgPromptInput');
    const counter = $('bgCharCount');
    input.addEventListener('input', () => {
      counter.textContent = `${input.value.length} / 500`;
    });
  }

  // ── Library: load & render ───────────────────────────────────────────────────

  async function loadLibrary() {
    $('bgLibraryStatus').textContent = 'Loading…';
    let images = [];
    try {
      const data = await api('/api/images?kind=background');
      images = data.images || [];
    } catch (err) {
      if (err.code !== 'UNAUTHORIZED') {
        $('bgLibraryStatus').textContent = 'Failed to load library.';
      }
      return images;
    }
    renderLibrary(images);
    $('bgLibraryStatus').textContent = '';
    return images;
  }

  function renderLibrary(images) {
    const grid = $('bgGrid');
    const empty = $('bgEmpty');
    grid.textContent = '';

    if (!images.length) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    for (const img of images) {
      const card = buildLibraryCard(img);
      grid.appendChild(card);
    }
  }

  function buildLibraryCard(img) {
    const meta = img.meta || {};
    const description = (meta.description) || '';
    const tags = Array.isArray(meta.tags) ? meta.tags : [];

    const card = document.createElement('div');
    card.className = 'bg-lib-card';
    card.dataset.imageId = img.image_id;

    // Thumbnail
    const thumb = document.createElement('img');
    thumb.className = 'bg-lib-thumb';
    thumb.alt = description || 'Background image';
    thumb.src = `/api/images/file/${img.image_id}`;
    thumb.loading = 'lazy';
    card.appendChild(thumb);

    // Info section
    const info = document.createElement('div');
    info.className = 'bg-lib-info';

    const desc = document.createElement('p');
    desc.className = 'bg-lib-desc';
    desc.textContent = description || '(no description)';
    info.appendChild(desc);

    if (tags.length) {
      const tagsRow = document.createElement('div');
      tagsRow.className = 'bg-lib-tags';
      for (const tag of tags) {
        const chip = document.createElement('span');
        chip.className = 'bg-tag-chip';
        chip.textContent = tag;
        tagsRow.appendChild(chip);
      }
      info.appendChild(tagsRow);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'bg-lib-actions';

    const simBtn = document.createElement('button');
    simBtn.type = 'button';
    simBtn.className = 'bg-lib-btn-similar';
    simBtn.textContent = 'Generate similar';
    simBtn.addEventListener('click', () => generateSimilar(img.image_id));
    actions.appendChild(simBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'bg-lib-btn-delete danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => deleteBackground(img.image_id, card));
    actions.appendChild(delBtn);

    info.appendChild(actions);
    card.appendChild(info);

    return card;
  }

  // ── Similar picker (dropdown of existing backgrounds) ────────────────────────

  function populateSimilarPicker(images) {
    const sel = $('bgSimilarSelect');
    // Keep first default option
    while (sel.options.length > 1) sel.remove(1);
    for (const img of images) {
      const meta = img.meta || {};
      const desc = (meta.description || img.image_id).slice(0, 80);
      const opt = document.createElement('option');
      opt.value = img.image_id;
      opt.textContent = desc;
      sel.appendChild(opt);
    }
  }

  // ── Generate a background ────────────────────────────────────────────────────

  async function generate({ treatment, prompt, similarTo } = {}) {
    const btn = $('bgGenerateBtn');
    const status = $('bgGenStatus');

    btn.classList.add('is-loading');
    btn.disabled = true;
    status.textContent = 'Generating…';
    status.className = 'status';
    $('bgPreview').classList.add('hidden');

    try {
      const body = { treatment: treatment || currentTreatment };
      if (prompt && prompt.trim()) body.prompt = prompt.trim();
      if (similarTo) body.similarTo = similarTo;

      const data = await api('/api/images/generate-background', 'POST', body);
      const img = data.image;
      showPreview(img);
      status.textContent = 'Generated successfully.';
      status.className = 'status ok';
      // Reload library to include the new image
      const images = await loadLibrary();
      populateSimilarPicker(images);
    } catch (err) {
      if (err.code !== 'UNAUTHORIZED') {
        status.textContent = `Error: ${err.message}`;
        status.className = 'status err';
      }
    } finally {
      btn.classList.remove('is-loading');
      btn.disabled = false;
    }
  }

  function showPreview(img) {
    const meta = img.meta || {};
    const description = meta.description || '';
    const tags = Array.isArray(meta.tags) ? meta.tags : [];

    $('bgPreviewImg').src = `/api/images/file/${img.image_id}`;
    $('bgPreviewImg').alt = description || 'Generated background';
    $('bgPreviewDesc').textContent = description;

    const tagsEl = $('bgPreviewTags');
    tagsEl.textContent = '';
    for (const tag of tags) {
      const chip = document.createElement('span');
      chip.className = 'bg-tag-chip';
      chip.textContent = tag;
      tagsEl.appendChild(chip);
    }

    $('bgPreview').classList.remove('hidden');
  }

  function generateSimilar(imageId) {
    // Pre-select in the picker and trigger generation
    const sel = $('bgSimilarSelect');
    if (sel) sel.value = imageId;
    generate({ treatment: currentTreatment, similarTo: imageId });
  }

  async function deleteBackground(imageId, cardEl) {
    try {
      await api(`/api/images/${imageId}`, 'DELETE');
      cardEl.remove();
      // Update similar picker
      const sel = $('bgSimilarSelect');
      if (sel) {
        for (const opt of [...sel.options]) {
          if (opt.value === imageId) { opt.remove(); break; }
        }
      }
      // Show empty state if grid is now empty
      const grid = $('bgGrid');
      if (!grid.children.length) $('bgEmpty').classList.remove('hidden');
    } catch (err) {
      if (err.code !== 'UNAUTHORIZED') {
        $('bgLibraryStatus').textContent = `Delete failed: ${err.message}`;
        $('bgLibraryStatus').className = 'status err';
      }
    }
  }

  // ── Auto-generate on entry (< 2 backgrounds in library) ─────────────────────

  async function maybeAutoGenerate(images) {
    if (sessionStorage.getItem('bgAutogenDone')) return;
    sessionStorage.setItem('bgAutogenDone', '1');

    if (images.length >= 2) return;

    // Generate 1 gradient + 1 pattern silently (cost guard: at most once per session)
    const status = $('bgGenStatus');
    status.textContent = 'Auto-generating starter backgrounds…';
    status.className = 'status';

    const needed = images.length === 0
      ? [{ treatment: 'gradient' }, { treatment: 'pattern' }]
      : [{ treatment: images[0]?.meta?.treatment === 'gradient' ? 'pattern' : 'gradient' }];

    for (const spec of needed) {
      try {
        await api('/api/images/generate-background', 'POST', spec);
      } catch { /* best effort — don't break the page */ }
    }

    status.textContent = '';
    const refreshed = await loadLibrary();
    populateSimilarPicker(refreshed);
  }

  // ── Wiring ───────────────────────────────────────────────────────────────────

  function init() {
    initTreatmentControl();
    initCharCount();

    $('bgGenerateBtn').addEventListener('click', () => {
      const prompt = $('bgPromptInput').value;
      const similarTo = $('bgSimilarSelect').value || null;
      generate({ treatment: currentTreatment, prompt, similarTo });
    });

    $('bgRefreshBtn').addEventListener('click', async () => {
      const images = await loadLibrary();
      populateSimilarPicker(images);
    });

    // Load library and then maybe auto-generate
    loadLibrary().then((images) => {
      populateSimilarPicker(images);
      maybeAutoGenerate(images).catch(() => { /* best effort */ });
    }).catch(() => { /* auth error already shown */ });
  }

  init();
})();
