// Sample-canvas image fill: template galleries/previews render SAMPLE canvases
// whose image slots are honest dashed placeholders. This module dresses those
// samples with REAL images from the org's library (zero-text-passed only), so
// thumbnails and previews look like finished posters instead of wireframes.
//
// Matching is deterministic: each slot's styleHint tokens are scored against
// every library image's topic tokens, and a stable hash of templateId+slotId
// picks among the top matches so different templates don't all wear the same
// photo. Sample-only — the real image pipeline (concept → generate → gates)
// is untouched; an empty library leaves the placeholders as-is.

const DEFAULT_IMAGE_PX = 1024; // library meta rarely carries dims; gpt-image default

const STOPWORDS = new Set(['a', 'an', 'the', 'no', 'not', 'of', 'on', 'in', 'with', 'and', 'or', 'for', 'to', 'text', 'style', 'subtle']);

function tokens(s) {
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Small stable hash for deterministic (but per-slot varied) tie-breaks. */
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/** All usable library images with parsed topic tokens (one query per call). */
function libraryPool(db) {
  let rows = [];
  try {
    rows = db.prepare(
      "SELECT image_id, topics, style, meta FROM images WHERE zero_text_passed = 1"
    ).all();
  } catch { return []; }
  return rows.map((r) => {
    let topicList = [];
    try { topicList = JSON.parse(r.topics) || []; } catch { topicList = String(r.topics || '').split(','); }
    let dims = null;
    try { dims = r.meta ? JSON.parse(r.meta) : null; } catch { dims = null; }
    return {
      imageId: r.image_id,
      tokens: new Set([...topicList.flatMap(tokens), ...tokens(r.style)]),
      width: dims?.width || DEFAULT_IMAGE_PX,
      height: dims?.height || DEFAULT_IMAGE_PX
    };
  });
}

function pickFor(pool, styleHint, seedKey) {
  const want = tokens(styleHint);
  const scored = pool.map((img) => {
    let score = 0;
    for (const t of want) if (img.tokens.has(t)) score += 1;
    return { img, score };
  }).sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  // choose among the best-scoring band (all top-score, else top 5) by hash
  const top = scored[0].score > 0 ? scored.filter((s) => s.score === scored[0].score) : scored.slice(0, 5);
  return top[hash(seedKey) % top.length].img;
}

/** Slot frame (dashed placeholder geometry) → cover-fit Image object. */
function filledImage(slot, img) {
  const frame = { left: slot.left || 0, top: slot.top || 0, width: slot.width || 0, height: slot.height || 0, rx: slot.rx, ry: slot.ry };
  const scale = Math.max(frame.width / img.width, frame.height / img.height);
  return {
    type: 'Image',
    left: frame.left + (frame.width - img.width * scale) / 2,
    top: frame.top + (frame.height - img.height * scale) / 2,
    width: img.width,
    height: img.height,
    scaleX: scale,
    scaleY: scale,
    src: `/api/images/file/${img.imageId}`,
    clipPath: {
      type: 'Rect', left: frame.left, top: frame.top, width: frame.width, height: frame.height,
      ...(frame.rx ? { rx: frame.rx } : {}), ...(frame.ry ? { ry: frame.ry } : {}),
      absolutePositioned: true
    },
    layerRole: 'image',
    slotId: slot.slotId,
    imageId: img.imageId,
    slotSpec: slot.slotSpec
  };
}

/**
 * Replace every image-slot placeholder on a sample canvas with a matched real
 * library image. Mutates and returns the canvas. No-op when the library is
 * empty or the canvas has no slots.
 */
export function fillSampleSlots(db, canvas, templateId) {
  if (!db || !canvas || !Array.isArray(canvas.objects)) return canvas;
  const slots = canvas.objects.filter((o) => o.layerRole === 'image-slot' && o.slotId);
  if (!slots.length) return canvas;
  const pool = libraryPool(db);
  if (!pool.length) return canvas;
  for (const slot of slots) {
    const hint = slot.slotSpec?.styleHint || '';
    const img = pickFor(pool, hint, `${templateId}:${slot.slotId}`);
    if (!img) continue;
    const idx = canvas.objects.indexOf(slot);
    canvas.objects[idx] = filledImage(slot, img);
  }
  return canvas;
}
