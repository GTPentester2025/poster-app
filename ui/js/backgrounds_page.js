// Backgrounds & Patterns page — preset gallery + custom generator + library.
// Presets: GET via window.BACKGROUND_PRESETS (presets loaded from data/background-presets.js)
// Library: GET /api/images?kind=background; POST /api/images/generate-background
// Apply: GET /api/posters; POST /api/posters/:posterId/apply-background
// XSS: all values rendered via textContent.

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // ── Presets & Library data ───────────────────────────────────────────────────

  let PRESETS = [];
  let currentPresets = [];
  let currentCategoryFilter = 'all';

  let allLibraryImages = [];
  let currentLibraryFilter = 'all';

  function loadPresets() {
    if (!window.BACKGROUND_PRESETS) return;
    PRESETS = window.BACKGROUND_PRESETS.ALL_PRESETS || [];
    currentPresets = PRESETS;
  }

  // ── API helper ────────────────────────────────────────────────────────────────

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

  // ── Loading skeletons ─────────────────────────────────────────────────────────

  function showPresetSkeleton() {
    const skeleton = $('bgPresetSkeleton');
    if (skeleton) skeleton.classList.remove('hidden');
  }

  function hidePresetSkeleton() {
    const skeleton = $('bgPresetSkeleton');
    if (skeleton) skeleton.classList.add('hidden');
  }

  function showLibrarySkeleton() {
    const skeleton = $('bgLibrarySkeleton');
    if (skeleton) skeleton.classList.remove('hidden');
  }

  function hideLibrarySkeleton() {
    const skeleton = $('bgLibrarySkeleton');
    if (skeleton) skeleton.classList.add('hidden');
  }

  function showApplyPosterSkeleton() {
    const skeleton = $('bgApplyPosterSkeleton');
    if (skeleton) skeleton.classList.remove('hidden');
  }

  function hideApplyPosterSkeleton() {
    const skeleton = $('bgApplyPosterSkeleton');
    if (skeleton) skeleton.classList.add('hidden');
  }

  // ── Error messages ────────────────────────────────────────────────────────────

  function showError(msg, retryFn) {
    const bar = $('bgErrorBar');
    const msgEl = $('bgErrorMsg');
    const retryBtn = $('bgErrorRetry');
    msgEl.textContent = msg;
    bar.classList.remove('hidden');
    if (retryFn) {
      retryBtn.onclick = () => {
        bar.classList.add('hidden');
        retryFn();
      };
      retryBtn.classList.remove('hidden');
    } else {
      retryBtn.classList.add('hidden');
    }
  }

  function hideError() {
    $('bgErrorBar').classList.add('hidden');
  }

  // ── Presets: category tabs & grid ─────────────────────────────────────────────

  function renderCategoryTabs() {
    const tabsContainer = $('bgCatTabs');
    if (!tabsContainer) return;
    tabsContainer.textContent = '';

    const categories = [
      { id: 'all', label: 'All Presets' },
      { id: 'gradient', label: 'Corporate Gradients' },
      { id: 'pattern', label: 'Geometric Patterns' },
      { id: 'texture', label: 'Subtle Textures' }
    ];

    for (const cat of categories) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bg-cat-tab';
      btn.dataset.category = cat.id;
      btn.textContent = cat.label;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', cat.id === 'all' ? 'true' : 'false');
      btn.addEventListener('click', () => {
        tabsContainer.querySelectorAll('.bg-cat-tab').forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        filterPresetsByCategory(cat.id);
      });
      if (cat.id === 'all') btn.classList.add('active');
      tabsContainer.appendChild(btn);
    }
  }

  function filterPresetsByCategory(categoryId) {
    currentCategoryFilter = categoryId;
    if (categoryId === 'all') {
      currentPresets = PRESETS;
    } else {
      currentPresets = PRESETS.filter((p) => p.category === categoryId);
    }
    renderPresetGrid();
  }

  function renderPresetGrid() {
    const grid = $('bgPresetGrid');
    const empty = $('bgPresetEmpty');
    if (!grid) return;

    // Remove skeleton if present (it's a child)
    const skeleton = $('bgPresetSkeleton');
    if (skeleton && grid.contains(skeleton)) {
      hidePresetSkeleton();
    }

    // Clear existing preset cards (but keep skeleton)
    grid.querySelectorAll('.bg-preset-card').forEach((el) => el.remove());

    if (!currentPresets.length) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    for (const preset of currentPresets) {
      const card = buildPresetCard(preset);
      grid.appendChild(card);
    }
  }

  function buildPresetCard(preset) {
    const card = document.createElement('div');
    card.className = 'bg-preset-card';
    card.dataset.presetId = preset.id;

    // Gradient preview (or solid for patterns/textures)
    const preview = document.createElement('div');
    preview.className = 'bg-preset-preview';
    if (preset.treatment === 'gradient' && preset.gradient) {
      preview.style.background = preset.gradient;
    } else if (preset.colors && preset.colors.length >= 2) {
      preview.style.background = `linear-gradient(135deg, ${preset.colors[0]} 0%, ${preset.colors[1]} 100%)`;
    } else if (preset.colors && preset.colors.length === 1) {
      preview.style.background = preset.colors[0];
    }
    card.appendChild(preview);

    // Name label
    const label = document.createElement('div');
    label.className = 'bg-preset-label';
    label.textContent = preset.name;
    card.appendChild(label);

    // Click to use
    card.addEventListener('click', () => applyPreset(preset));

    return card;
  }

  function applyPreset(preset) {
    hideError();
    // Auto-fill prompt and treatment
    $('bgPromptInput').value = preset.prompt;
    const treatmentCtrl = $('treatmentCtrl');
    treatmentCtrl.querySelectorAll('.bg-seg-btn').forEach((btn) => {
      const isActive = btn.dataset.treatment === preset.treatment;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    currentTreatment = preset.treatment;
    // Generate
    generate({ treatment: preset.treatment, prompt: preset.prompt });
  }

  // ── Library: category tabs & filtering ──────────────────────────────────────

  function renderLibraryCategoryTabs() {
    const tabsContainer = $('bgLibCatTabs');
    if (!tabsContainer) return;
    tabsContainer.textContent = '';

    const treatments = [
      { id: 'all', label: 'All' },
      { id: 'gradient', label: 'Gradients' },
      { id: 'pattern', label: 'Patterns' },
      { id: 'texture', label: 'Textures' }
    ];

    for (const treatment of treatments) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bg-lib-cat-tab';
      btn.dataset.treatment = treatment.id;
      btn.textContent = treatment.label;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', treatment.id === 'all' ? 'true' : 'false');
      btn.addEventListener('click', () => {
        tabsContainer.querySelectorAll('.bg-lib-cat-tab').forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        filterLibraryByTreatment(treatment.id);
      });
      if (treatment.id === 'all') btn.classList.add('active');
      tabsContainer.appendChild(btn);
    }
  }

  function filterLibraryByTreatment(treatmentId) {
    currentLibraryFilter = treatmentId;
    let filtered = allLibraryImages;
    if (treatmentId !== 'all') {
      filtered = allLibraryImages.filter((img) => {
        const meta = img.meta || {};
        return meta.treatment === treatmentId;
      });
    }
    renderLibrary(filtered);
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
    showLibrarySkeleton();
    let images = [];
    try {
      const data = await api('/api/images?kind=background');
      images = data.images || [];
    } catch (err) {
      if (err.code !== 'UNAUTHORIZED') {
        showError('Failed to load library. ' + err.message, () => loadLibrary());
      }
      hideLibrarySkeleton();
      return images;
    }
    allLibraryImages = images;
    currentLibraryFilter = 'all';
    renderLibraryCategoryTabs();
    renderLibrary(images);
    hideLibrarySkeleton();
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

    const thumb = document.createElement('img');
    thumb.className = 'bg-lib-thumb';
    thumb.alt = description || 'Background image';
    thumb.src = `/api/images/file/${img.image_id}`;
    thumb.loading = 'lazy';
    card.appendChild(thumb);

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
    hideError();

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
    $('bgPreviewImg').dataset.imageId = img.image_id;

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
    const sel = $('bgSimilarSelect');
    if (sel) sel.value = imageId;
    generate({ treatment: currentTreatment, similarTo: imageId });
  }

  async function deleteBackground(imageId, cardEl) {
    try {
      await api(`/api/images/${imageId}`, 'DELETE');
      cardEl.remove();
      const sel = $('bgSimilarSelect');
      if (sel) {
        for (const opt of [...sel.options]) {
          if (opt.value === imageId) { opt.remove(); break; }
        }
      }
      const grid = $('bgGrid');
      if (!grid.children.length) $('bgEmpty').classList.remove('hidden');
    } catch (err) {
      if (err.code !== 'UNAUTHORIZED') {
        showError(`Delete failed: ${err.message}`);
      }
    }
  }

  // ── Apply to Poster ───────────────────────────────────────────────────────────

  let currentImageId = null;

  function openApplyModal(imageId) {
    currentImageId = imageId;
    const modal = $('bgApplyModal');
    modal.classList.remove('hidden');
    loadPostersForApply();
  }

  function closeApplyModal() {
    const modal = $('bgApplyModal');
    modal.classList.add('hidden');
    currentImageId = null;
  }

  async function loadPostersForApply() {
    showApplyPosterSkeleton();
    const list = $('bgApplyPosterList');
    const empty = $('bgApplyPosterEmpty');
    const status = $('bgApplyStatus');

    list.textContent = '';
    empty.classList.add('hidden');
    status.textContent = '';

    try {
      const data = await api('/api/posters');
      const posters = data.posters || [];
      hideApplyPosterSkeleton();

      if (!posters.length) {
        empty.classList.remove('hidden');
        return;
      }

      for (const poster of posters) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'bg-apply-poster-item';
        item.textContent = poster.name || `Poster ${poster.poster_id}`;
        item.dataset.posterId = poster.poster_id;
        item.addEventListener('click', () => applyBackgroundToPoster(poster.poster_id));
        list.appendChild(item);
      }
    } catch (err) {
      hideApplyPosterSkeleton();
      if (err.code !== 'UNAUTHORIZED') {
        status.textContent = `Error loading posters: ${err.message}`;
        status.className = 'status err';
      }
    }
  }

  async function applyBackgroundToPoster(posterId) {
    const status = $('bgApplyStatus');
    if (!currentImageId) return;

    status.textContent = 'Applying…';
    status.className = 'status';

    try {
      await api(`/api/posters/${posterId}/apply-background`, 'POST', { imageId: currentImageId });
      status.textContent = 'Background applied successfully.';
      status.className = 'status ok';
      setTimeout(() => closeApplyModal(), 1000);
    } catch (err) {
      if (err.code !== 'UNAUTHORIZED') {
        status.textContent = `Error: ${err.message}`;
        status.className = 'status err';
      }
    }
  }

  // ── Auto-generate on entry (< 2 backgrounds in library) ─────────────────────

  async function maybeAutoGenerate(images) {
    if (sessionStorage.getItem('bgAutogenDone')) return;
    sessionStorage.setItem('bgAutogenDone', '1');

    if (images.length >= 2) return;

    const status = $('bgGenStatus');
    status.textContent = 'Auto-generating starter backgrounds…';
    status.className = 'status';

    const needed = images.length === 0
      ? [{ treatment: 'gradient' }, { treatment: 'pattern' }]
      : [{ treatment: images[0]?.meta?.treatment === 'gradient' ? 'pattern' : 'gradient' }];

    for (const spec of needed) {
      try {
        await api('/api/images/generate-background', 'POST', spec);
      } catch { /* best effort */ }
    }

    status.textContent = '';
    const refreshed = await loadLibrary();
    populateSimilarPicker(refreshed);
  }

  // ── Wiring ───────────────────────────────────────────────────────────────────

  function init() {
    loadPresets();
    renderCategoryTabs();
    renderPresetGrid();
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

    $('bgApplyToPosterBtn').addEventListener('click', () => {
      const imageId = $('bgPreviewImg').dataset.imageId;
      if (imageId) openApplyModal(imageId);
    });

    $('bgApplyModalClose').addEventListener('click', closeApplyModal);

    loadLibrary().then((images) => {
      populateSimilarPicker(images);
      maybeAutoGenerate(images).catch(() => { /* best effort */ });
    }).catch(() => { /* auth error already shown */ });
  }

  init();
})();
