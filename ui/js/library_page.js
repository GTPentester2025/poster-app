// Poster library (spec B.10, list view; T5 rebuild): GET /api/posters → a
// thumbnail card grid with server-rendered previewSvg, name, status/topic
// chips, language-count badge and tabular-nums dates. Client-side controls:
// name search, status filter chips (All/draft/designed/saved/translated) and
// an Updated/Name sort. Posters that reached the design phase (status
// designed/saved/translated) open in the Canva-replica editor; earlier-phase
// cards reveal the poster id + load the "What worked best" panel.
// Phase 10 additions kept: rename affordance, suggestions side panel fed by
// GET /api/posters/suggestions?topic=...

const $ = (id) => document.getElementById(id);

// XSS rule: all server/user strings through textContent. The ONE sanctioned
// innerHTML sink is poster.previewSvg — server-rendered SVG from our own
// template modules (pure palette geometry) or the server-built typographic
// placeholder whose text is entity-escaped server-side (see routes/posters.js).

async function api(path) {
  let res;
  try {
    res = await fetch(path, window.authOptions(null));
  } catch {
    throw new Error('server unreachable');
  }
  if (res.status === 401) {
    $('authBanner').classList.remove('hidden');
    throw new Error('not authorized — open the tokenized URL first');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const EDITABLE_STATUSES = ['designed', 'saved', 'translated'];

// ── exact-poster thumbnails ──────────────────────────────────────────────────
// For posters that reached the design phase, render the REAL saved canvas (with
// its generated images) into the card thumbnail via a fabric StaticCanvas —
// replacing the palette-only template preview. Lazy + best-effort: a fetch/
// render failure silently keeps the server-rendered previewSvg placeholder.
// Lazy thumbnail rendering: only render a card's real poster when it scrolls
// into view (rendering all 17+ fabric canvases on load janks the page). Each
// thumb is rendered at most once, then unobserved.
const thumbObserver = ('IntersectionObserver' in window)
  ? new IntersectionObserver((entries, obs) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      obs.unobserve(e.target);
      const poster = e.target._poster;
      if (poster) renderExactThumb(poster, e.target);
    }
  }, { rootMargin: '300px' })
  : null;

function lazyRenderThumb(poster, thumbEl) {
  if (thumbObserver) {
    thumbEl._poster = poster;
    thumbObserver.observe(thumbEl);
  } else {
    renderExactThumb(poster, thumbEl); // no IO support → render eagerly
  }
}

function setThumbImg(thumbEl, url) {
  const img = document.createElement('img');
  img.src = url;
  img.alt = '';
  img.loading = 'lazy';
  img.style.width = '100%';
  img.style.display = 'block';
  thumbEl.textContent = '';
  thumbEl.appendChild(img);
}

async function renderExactThumb(poster, thumbEl) {
  if (!window.fabric) return;
  // session cache keyed by poster + last-update: skip the fabric render on
  // re-sort / re-filter / revisit; invalidates when the poster changes.
  const cacheKey = `pthumb:${poster.posterId}:${poster.updatedAt || ''}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) { setThumbImg(thumbEl, cached); return; }
  } catch { /* storage unavailable — render fresh */ }
  try {
    const res = await fetch(`/api/design/${encodeURIComponent(poster.posterId)}`, window.authOptions(null));
    if (!res.ok) return;
    const state = await res.json();
    const cjson = state.design && state.design.canvas;
    if (!cjson || !Array.isArray(cjson.objects) || !cjson.objects.length) return;
    const W = cjson.width || 1414;
    const H = cjson.height || 2000;
    const tw = 320;                       // render at ~2x card width for crispness
    const th = Math.round(H * (tw / W));
    const sc = new fabric.StaticCanvas(null, { enableRetinaScaling: false });
    // fabric v6 loadFromJSON returns a promise and awaits image loading; it also
    // resets the canvas to the JSON's native dims, so set the thumbnail size +
    // zoom AFTER the load (otherwise the export comes out at full 1414px).
    await sc.loadFromJSON(cjson);
    sc.setDimensions({ width: tw, height: th });
    sc.setZoom(tw / W);
    sc.renderAll();
    const url = sc.toDataURL({ format: 'jpeg', quality: 0.72 });
    sc.dispose();
    try { sessionStorage.setItem(cacheKey, url); } catch { /* quota full — skip caching */ }
    setThumbImg(thumbEl, url);
  } catch { /* keep the previewSvg placeholder */ }
}

// ── "What worked best" side panel ──────────────────────────────────────────

let suggestionsSeq = 0; // drop stale responses when the user clicks another card mid-fetch

async function loadSuggestions(topic) {
  const list = $('whatWorkedList');
  const hint = $('whatWorkedHint');
  const status = $('whatWorkedStatus');
  const seq = ++suggestionsSeq;
  if (!topic) {
    list.textContent = '';
    hint.textContent = 'Click a poster to see what worked best for its topic.';
    status.textContent = '';
    return;
  }
  hint.textContent = '';
  status.textContent = 'Loading…';
  status.className = 'status';
  try {
    const { suggestions } = await api(`/api/posters/suggestions?topic=${encodeURIComponent(topic)}`);
    if (seq !== suggestionsSeq) return; // a newer request superseded this one
    // clear ONLY after the fetch resolves, so two in-flight requests can never
    // interleave labels/items — the winner rebuilds the panel atomically
    list.textContent = '';
    status.textContent = '';
    if (!suggestions || !suggestions.length) {
      hint.textContent = `No performance data yet for "${topic}".`;
      return;
    }
    const topicLabel = document.createElement('p');
    topicLabel.className = 'hint';
    topicLabel.textContent = `Similar posters performed well for "${topic}" — here's what worked best:`;
    list.appendChild(topicLabel);
    for (const s of suggestions) {
      const item = document.createElement('div');
      item.className = 'what-worked-item';
      const hl = document.createElement('div');
      hl.className = 'ww-headline';
      hl.textContent = s.headline || '(no headline)';
      const sig = document.createElement('div');
      sig.className = 'ww-signal';
      sig.textContent = s.signal === 'rated-good' ? '👍 Rated good' : '✓ Approved';
      item.append(hl, sig);
      // provenance: global-fallback rows carry their REAL topic — label it
      // when it differs from the requested one (T2 de-bias)
      if (s.topic && s.topic !== topic) {
        const prov = document.createElement('div');
        prov.className = 'ww-topic';
        prov.textContent = `from topic "${s.topic}"`;
        item.appendChild(prov);
      }
      list.appendChild(item);
    }
  } catch (err) {
    if (seq !== suggestionsSeq) return; // stale failure must not clobber a newer render
    status.textContent = err.message;
    status.className = 'status err';
  }
}

// ── rename flow ─────────────────────────────────────────────────────────────

async function renamePoster(poster, card) {
  const newName = prompt('Rename poster:', poster.name);
  if (newName === null) return; // cancelled
  const trimmed = newName.trim();
  if (!trimmed) { flash($('libraryStatus'), 'Name cannot be empty.', false); return; }
  try {
    const result = await apiWithAuth(`/api/posters/${encodeURIComponent(poster.posterId)}/name`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed })
    });
    poster.name = result.name;
    // Update the title text inside the card
    const titleEl = card.querySelector('.poster-card-title');
    if (titleEl) titleEl.textContent = result.name;
    flash($('libraryStatus'), `Renamed to "${result.name}"`);
  } catch (err) {
    flash($('libraryStatus'), `Rename failed: ${err.message}`, false);
  }
}

// ── filter / sort state ─────────────────────────────────────────────────────

let allPosters = [];
const filters = { query: '', status: 'all', sort: 'updated' };

function visiblePosters() {
  const list = allPosters.filter((p) => {
    if (filters.status !== 'all' && p.status !== filters.status) return false;
    if (filters.query && !String(p.name).toLowerCase().includes(filters.query)) return false;
    return true;
  });
  if (filters.sort === 'name') {
    list.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));
  } else {
    list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))); // ISO strings — newest first
  }
  return list;
}

// ── card rendering ──────────────────────────────────────────────────────────

function openInEditor(poster) {
  location.href = `editor.html?posterId=${encodeURIComponent(poster.posterId)}`;
}

function renderCard(poster) {
  const card = document.createElement('article');
  card.className = 'card poster-card';

  // thumbnail — the ONE sanctioned innerHTML sink: previewSvg is
  // server-rendered (template geometry, or the placeholder whose text is
  // entity-escaped server-side; XSS test lives in tests/unit/library.test.js)
  const thumb = document.createElement('div');
  thumb.className = 'poster-thumb';
  thumb.setAttribute('aria-hidden', 'true');
  if (typeof poster.previewSvg === 'string' && poster.previewSvg.startsWith('<svg')) {
    thumb.innerHTML = poster.previewSvg;
  }
  // upgrade the placeholder to the REAL rendered poster when it scrolls in view
  if (EDITABLE_STATUSES.includes(poster.status)) {
    lazyRenderThumb(poster, thumb);
  }

  // header row: title + rename button
  const header = document.createElement('div');
  header.className = 'poster-card-header';

  const title = document.createElement('h3');
  title.className = 'poster-card-title';
  title.textContent = poster.name;

  const renameBtn = document.createElement('button');
  renameBtn.className = 'rename-btn';
  renameBtn.title = 'Rename poster';
  renameBtn.setAttribute('aria-label', `Rename "${poster.name}"`);
  renameBtn.textContent = '✎';
  renameBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // don't activate the card when clicking rename
    renamePoster(poster, card);
  });

  header.append(title, renameBtn);

  // chip row: status + topic + language count
  const chips = document.createElement('div');
  chips.className = 'poster-chip-row';

  const status = document.createElement('span');
  status.className = `chip status-${poster.status}`;
  status.textContent = poster.status;
  chips.appendChild(status);

  if (poster.topic) {
    const topicChip = document.createElement('span');
    topicChip.className = 'chip topic-chip';
    topicChip.textContent = poster.topic;
    topicChip.title = `Topic: ${poster.topic}`;
    chips.appendChild(topicChip);
  }

  if (poster.languages > 0) {
    const langBadge = document.createElement('span');
    langBadge.className = 'chip lang-badge';
    langBadge.textContent = `${poster.languages} lang${poster.languages === 1 ? '' : 's'}`;
    langBadge.setAttribute('aria-label',
      `Translated into ${poster.languages} language${poster.languages === 1 ? '' : 's'}`);
    chips.appendChild(langBadge);
  }

  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = `updated ${formatDate(poster.updatedAt)}`;

  card.append(thumb, header, chips, meta);

  // savedAt line
  if (poster.savedAt) {
    const savedEl = document.createElement('p');
    savedEl.className = 'poster-saved-at';
    savedEl.textContent = `Saved ${formatDate(poster.savedAt)}`;
    card.appendChild(savedEl);
  }

  // a11y: every card is keyboard-activatable (delegated Enter/Space below)
  card.setAttribute('role', 'button');
  card.tabIndex = 0;

  if (EDITABLE_STATUSES.includes(poster.status)) {
    card.classList.add('editable');
    card.setAttribute('aria-label', `Open "${poster.name}" in the editor`);

    const actions = document.createElement('div');
    actions.className = 'poster-actions';
    const openBtn = document.createElement('button');
    openBtn.className = 'primary open-editor-btn';
    openBtn.textContent = 'Open in editor';
    openBtn.setAttribute('aria-label', `Open "${poster.name}" in the editor`);
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openInEditor(poster);
    });
    actions.appendChild(openBtn);
    card.appendChild(actions);

    card.addEventListener('click', (e) => {
      if (e.target === renameBtn) return;
      openInEditor(poster);
    });
  } else {
    card.setAttribute('aria-label',
      `Show details for "${poster.name}" (still in progress — not editable yet)`);
    const note = document.createElement('p');
    note.className = 'note hidden';
    note.textContent = `id: ${poster.posterId} — finish the design step to edit this poster.`;
    card.append(note);
    card.addEventListener('click', (e) => {
      if (e.target === renameBtn) return;
      note.classList.toggle('hidden');
      // loadSuggestions clears + rebuilds the panel atomically (seq-guarded)
      if (poster.topic) loadSuggestions(poster.topic);
    });
  }
  return card;
}

function renderGrid() {
  const grid = $('posterGrid');
  grid.textContent = '';
  if (!allPosters.length) {
    $('emptyState').classList.remove('hidden');
    $('noMatchState').classList.add('hidden');
    $('libraryCount').textContent = '';
    return;
  }
  $('emptyState').classList.add('hidden');
  const visible = visiblePosters();
  $('noMatchState').classList.toggle('hidden', visible.length > 0);
  $('libraryCount').textContent =
    `Showing ${visible.length} of ${allPosters.length} poster${allPosters.length === 1 ? '' : 's'}`;
  for (const poster of visible) grid.appendChild(renderCard(poster));
}

// delegated keyboard activation (a11y — same pattern as create_page.js):
// poster cards are role="button" divs; Enter/Space activate them like buttons.
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof Element &&
      e.target.matches('.poster-card')) {
    e.preventDefault();
    e.target.click();
  }
});

// ── controls wiring ─────────────────────────────────────────────────────────

$('librarySearch').addEventListener('input', (e) => {
  filters.query = e.target.value.trim().toLowerCase();
  renderGrid();
});

$('statusFilters').addEventListener('click', (e) => {
  const btn = e.target instanceof Element ? e.target.closest('.filter-chip') : null;
  if (!btn) return;
  filters.status = btn.dataset.status;
  for (const b of $('statusFilters').querySelectorAll('.filter-chip')) {
    const active = b === btn;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  }
  renderGrid();
});

$('librarySort').addEventListener('change', (e) => {
  filters.sort = e.target.value;
  renderGrid();
});

async function load() {
  try {
    ({ posters: allPosters } = await api('/api/posters'));
  } catch (err) {
    $('libraryStatus').textContent = `Cannot load posters (${err.message}) — is the server running and this tab authorized?`;
    $('libraryStatus').className = 'status err';
    return;
  }
  renderGrid();

  // Auto-load suggestions for most common topic
  const topicCounts = new Map();
  for (const p of allPosters) {
    if (p.topic) topicCounts.set(p.topic, (topicCounts.get(p.topic) || 0) + 1);
  }
  if (topicCounts.size) {
    const mostCommon = [...topicCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    loadSuggestions(mostCommon);
  }
}

load();

// ── image library section (spec B.7) ────────────────────────────────────────
// All rendering below uses textContent — no user/model text ever reaches
// innerHTML on this page (XSS discipline).

function flash(el, message, ok = true) {
  el.textContent = message;
  el.className = `status ${ok ? 'ok' : 'err'}`;
  if (ok) setTimeout(() => { el.textContent = ''; }, 5000);
}

async function apiWithAuth(path, options = null) {
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

function renderImageCard(img) {
  const card = document.createElement('div');
  card.className = 'image-card';

  const imgEl = document.createElement('img');
  imgEl.src = `/api/images/file/${encodeURIComponent(img.image_id)}`;
  imgEl.alt = img.style || 'library image';
  imgEl.loading = 'lazy';

  const meta = document.createElement('div');
  meta.className = 'image-meta';

  const originChip = document.createElement('span');
  originChip.className = 'chip';
  originChip.textContent = img.origin;
  meta.appendChild(originChip);

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
  meta.appendChild(chips);

  const actions = document.createElement('div');
  actions.className = 'image-actions';

  const autotagBtn = document.createElement('button');
  autotagBtn.textContent = 'Auto-tag';
  autotagBtn.addEventListener('click', async () => {
    autotagBtn.disabled = true;
    try {
      await apiWithAuth(`/api/images/${encodeURIComponent(img.image_id)}/autotag`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
      });
      flash($('imageLibraryStatus'), 'Auto-tag complete.');
      await loadImageLibrary();
    } catch (err) {
      flash($('imageLibraryStatus'), err.message, false);
      autotagBtn.disabled = false;
    }
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'danger';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', async () => {
    if (!confirm('Delete this image from the library?')) return;
    try {
      await apiWithAuth(`/api/images/${encodeURIComponent(img.image_id)}`, { method: 'DELETE' });
      card.remove();
      if (!$('imageGrid').children.length) $('imageLibraryEmpty').classList.remove('hidden');
      flash($('imageLibraryStatus'), 'Image deleted.');
    } catch (err) {
      flash($('imageLibraryStatus'), err.message, false);
    }
  });

  actions.append(autotagBtn, deleteBtn);
  meta.appendChild(actions);
  card.append(imgEl, meta);
  return card;
}

async function loadImageLibrary() {
  let images;
  try {
    ({ images } = await apiWithAuth('/api/images'));
  } catch (err) {
    $('imageLibraryStatus').textContent = `Cannot load images: ${err.message}`;
    $('imageLibraryStatus').className = 'status err';
    return;
  }
  const grid = $('imageGrid');
  grid.innerHTML = '';
  if (!images.length) {
    $('imageLibraryEmpty').classList.remove('hidden');
    return;
  }
  $('imageLibraryEmpty').classList.add('hidden');
  for (const img of images) grid.appendChild(renderImageCard(img));
}

$('uploadImageBtn').addEventListener('click', () => {
  const fileInput = $('imageFileInput');
  if (!fileInput.files.length) {
    flash($('uploadStatus'), 'Select a file first.', false);
    return;
  }
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = async (e) => {
    // e.target.result = "data:image/png;base64,<base64>"
    const base64 = String(e.target.result).split(',')[1];
    const topics = $('uploadTopics').value.split(',').map((t) => t.trim()).filter(Boolean);
    const style = $('uploadStyle').value.trim() || null;
    const format = $('uploadFormat').value.trim() || null;
    $('uploadImageBtn').disabled = true;
    try {
      await apiWithAuth('/api/images/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, imageBase64: base64, topics, style, format })
      });
      flash($('uploadStatus'), 'Uploaded.');
      fileInput.value = '';
      await loadImageLibrary();
    } catch (err) {
      flash($('uploadStatus'), err.message, false);
    } finally { $('uploadImageBtn').disabled = false; }
  };
  reader.readAsDataURL(file);
});

loadImageLibrary();
