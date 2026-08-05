// Real template thumbnails (window.TemplateThumbs). The gallery's SVG
// previews are abstract geometry placeholders; this module lazily replaces
// each card's placeholder with a REAL render of the template — the exact
// sample canvas the design station compiles (/api/pipeline/templates/:id/
// sample), drawn through the same Fabric pipeline as the live preview and
// snapshotted to a PNG data URL.
//
// Lazy + bounded: an IntersectionObserver only renders cards that scroll
// into view, a small queue caps concurrent Fabric renders, and finished
// thumbnails are cached per template for the page's lifetime (~40KB each,
// in-memory only). Any failure leaves the SVG placeholder in place — the
// gallery never breaks because a thumbnail couldn't render.

(function () {
  'use strict';

  const THUMB_W = 280;          // CSS box is ~240px wide; 280 keeps it crisp
  const CONCURRENCY = 2;        // parallel Fabric renders (main-thread work)

  const cache = new Map();      // templateId → Promise<dataURL>
  const queue = [];
  let running = 0;

  function pump() {
    while (running < CONCURRENCY && queue.length) {
      const job = queue.shift();
      running += 1;
      job().finally(() => { running -= 1; pump(); });
    }
  }

  /** Render one template's real portrait sample to a PNG data URL. */
  function renderThumb(templateId) {
    if (cache.has(templateId)) return cache.get(templateId);
    const promise = new Promise((resolve, reject) => {
      queue.push(async () => {
        try {
          const res = await fetch(`/api/pipeline/templates/${encodeURIComponent(templateId)}/sample?orientation=portrait`);
          if (!res.ok) throw new Error(`sample ${res.status}`);
          const { canvas } = await res.json();
          const scale = THUMB_W / (canvas.width || 1414);
          const el = document.createElement('canvas');
          el.width = Math.round(canvas.width * scale);
          el.height = Math.round(canvas.height * scale);
          const fc = new fabric.StaticCanvas(el, { enableRetinaScaling: false });
          fc.setZoom(scale);
          await fc.loadFromJSON(canvas); // fabric v6: returns a Promise
          fc.renderAll();
          const url = el.toDataURL('image/png');
          fc.dispose();
          resolve(url);
        } catch (err) { reject(err); }
      });
      pump();
    });
    cache.set(templateId, promise);
    promise.catch(() => cache.delete(templateId)); // failed renders retry next view
    return promise;
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const holder = entry.target;
      observer.unobserve(holder);
      const id = holder.dataset.thumbTemplateId;
      renderThumb(id).then((url) => {
        const img = document.createElement('img');
        img.className = 'tpl-thumb-img';
        img.alt = '';
        img.decoding = 'async';
        img.src = url;
        img.addEventListener('load', () => {
          holder.replaceChildren(img);
          requestAnimationFrame(() => img.classList.add('is-in'));
        });
      }).catch(() => { /* placeholder SVG stays */ });
    }
  }, { rootMargin: '200px' });

  /**
   * Upgrade a gallery card's preview holder to a real thumbnail when it
   * scrolls into view. `holder` must contain the SVG placeholder.
   */
  function attach(holder, templateId) {
    if (!holder || !templateId || typeof fabric === 'undefined') return;
    holder.dataset.thumbTemplateId = templateId;
    observer.observe(holder);
  }

  window.TemplateThumbs = { attach };
})();
