// Canvas ↔ content text binding (spec §B.11): translation swaps text INTO a
// cloned canvas by layerRole/msgId; extraction reads the text a user may have
// edited in the Canva editor back OUT (the canvas is the source of truth for
// what the poster actually says — doc.content lags behind editor edits).
//
// User-added text boxes (layerRole 'user-text', stamped with a stable extraId
// by the editor UI at creation) ride the same binding as `extras: [{id, text}]`
// so they get translated instead of staying English in every variant. Objects
// without a non-empty string extraId are ignored (nothing to bind to).

// Prompt-safety cap (finding S4): diffed before/after strings are interpolated
// into agent prompts (extractStylePreference, validateAndStoreTermSwaps) — cap
// each side at 500 chars HERE, the single choke point every diff caller shares,
// so a pathological multi-KB field edit can never flood the instruction zone.
const MAX_DIFF_FIELD_CHARS = 500;

function isTextObject(obj) {
  return obj && typeof obj === 'object' && typeof obj.text === 'string';
}

function hasExtraId(obj) {
  return typeof obj.extraId === 'string' && obj.extraId.length > 0;
}

/**
 * Resolve the block/message a canvas object's msgId points at (same rule as
 * the client twin, ui/js/preview_engine.js): v2 content carries `blocks`
 * (ids 'blk-N'), v1 carries `messages` — one list is ever present per poster,
 * so the lookup is unified. Returns null when the id is unknown.
 */
function boundBlock(content, id) {
  const list = Array.isArray(content.blocks) ? content.blocks
    : Array.isArray(content.messages) ? content.messages : [];
  return list.find((b) => b && b.id === id) || null;
}

/** The block field a v2 'message' object binds to ('text' when unset). */
function fieldOf(obj) {
  return (typeof obj.fieldRef === 'string' && obj.fieldRef) ? obj.fieldRef : 'text';
}

/**
 * The content value a canvas object is bound to. Returns undefined when the
 * BINDING is not found (unknown layerRole, unknown msgId/extraId, missing
 * message/extra entry) — callers must leave the object untouched then. A
 * found binding may still carry null/'' (field explicitly blank).
 *
 * Binding rules (mirrored by applyContentToCanvasClient in preview_engine.js):
 *   v2: layerRole 'message' + msgId 'blk-N' (+ optional fieldRef naming the
 *       block field, e.g. 'question'/'answer'; default field is 'text');
 *       label chips ride layerRole 'message-label' + msgId → block.label.
 *   v1: layerRole 'message-text' / 'message-label' + msgId → messages[].text/.label.
 *   both: 'headline' / 'subheadline' / 'cta' → top-level fields.
 */
function boundValue(obj, content) {
  switch (obj.layerRole) {
    case 'headline': return content.headline;
    case 'subheadline': return content.subheadline;
    case 'cta': return content.callToAction;
    case 'message': {
      const b = boundBlock(content, obj.msgId);
      if (!b) return undefined;
      const field = fieldOf(obj);
      return Object.prototype.hasOwnProperty.call(b, field) ? b[field] : undefined;
    }
    case 'message-text': {
      const m = boundBlock(content, obj.msgId);
      return m ? m.text : undefined;
    }
    case 'message-label': {
      const m = boundBlock(content, obj.msgId);
      return m ? m.label : undefined;
    }
    case 'user-text': {
      if (!hasExtraId(obj)) return undefined;
      const e = (content.extras || []).find((x) => x && x.id === obj.extraId);
      return e ? e.text : undefined;
    }
    default: return undefined;
  }
}

export function applyContentToCanvas(canvas, content) {
  const out = structuredClone(canvas);
  for (const obj of out.objects || []) {
    if (!isTextObject(obj)) continue;
    const value = boundValue(obj, content);
    if (value === undefined) continue; // binding not found — leave untouched
    if (typeof value === 'string' && value.trim()) {
      obj.text = value;
    } else {
      // field present in content but EXPLICITLY blank (null / empty string /
      // whitespace-only) — blank the canvas text instead of leaving stale copy
      obj.text = '';
    }
  }
  return out;
}

/**
 * Remove user-text objects that were DELETED from the English source (their
 * extraId appears in previousExtras — the ids that came FROM ENGLISH the last
 * time this variant was translated — but no longer appears in currentExtras).
 * Variant-local additions (ids never seen in previousExtras) are the user's
 * own content in that language and always survive.
 *
 * previousExtras MUST be the variant's translation-time snapshot
 * (variant.sourceExtraIds), NEVER variant.content.extras: editor variant
 * saves re-extract content from the canvas, which pulls variant-local ids
 * into content.extras — pruning against that would delete the user's
 * language-local text on the next re-translation. Accepts id strings or
 * {id} objects.
 */
export function pruneOrphanedExtras(canvas, previousExtras, currentExtras) {
  const out = structuredClone(canvas);
  const idOf = (e) => (typeof e === 'string' ? e : e && e.id);
  const prevIds = new Set((previousExtras || []).map(idOf).filter(Boolean));
  const currentIds = new Set((currentExtras || []).map(idOf).filter(Boolean));
  out.objects = (out.objects || []).filter((obj) => !(
    obj && obj.layerRole === 'user-text' && hasExtraId(obj)
    && prevIds.has(obj.extraId) && !currentIds.has(obj.extraId)
  ));
  return out;
}

export function extractContentFromCanvas(canvas, baseContent) {
  const content = structuredClone(baseContent);
  const setters = {
    headline: (v) => { content.headline = v; },
    subheadline: (v) => { content.subheadline = v; },
    cta: (v) => { content.callToAction = v; }
  };
  const extras = [];
  for (const obj of canvas?.objects || []) {
    if (!isTextObject(obj) || !obj.text.trim()) continue;
    if (setters[obj.layerRole]) { setters[obj.layerRole](obj.text); continue; }
    if (obj.layerRole === 'user-text') {
      if (hasExtraId(obj)) extras.push({ id: obj.extraId, text: obj.text });
      continue;
    }
    if (obj.layerRole === 'message') {
      // v2 block binding: write the canvas text back into the bound block
      // field. Only fields the block already carries are written — a stray
      // fieldRef can never invent a field the template schema never declared.
      const b = boundBlock(content, obj.msgId);
      const field = fieldOf(obj);
      if (b && Object.prototype.hasOwnProperty.call(b, field)) b[field] = obj.text;
      continue;
    }
    if (obj.layerRole === 'message-text' || obj.layerRole === 'message-label') {
      const m = boundBlock(content, obj.msgId);
      if (m) m[obj.layerRole === 'message-text' ? 'text' : 'label'] = obj.text;
    }
  }
  content.extras = extras; // the canvas is the source of truth for user text boxes
  return content;
}

export function diffTextFields(before, after) {
  const diffs = [];
  const push = (field, b, a) => {
    const bs = b == null ? '' : String(b);
    const as = a == null ? '' : String(a);
    if (bs !== as) {
      diffs.push({ field, before: bs.slice(0, MAX_DIFF_FIELD_CHARS), after: as.slice(0, MAX_DIFF_FIELD_CHARS) });
    }
  };
  push('headline', before.headline, after.headline);
  push('subheadline', before.subheadline, after.subheadline);
  const count = Math.max(before.messages?.length || 0, after.messages?.length || 0);
  for (let i = 0; i < count; i++) {
    push(`messages[${i}].label`, before.messages?.[i]?.label, after.messages?.[i]?.label);
    push(`messages[${i}].text`, before.messages?.[i]?.text, after.messages?.[i]?.text);
  }
  // v2 blocks diff by id (like extras) with the block's own dynamic field
  // list — fields like `blocks[blk-1].question`. Empty for v1 content.
  const blockIds = [...new Set([
    ...(before.blocks || []).map((b) => b && b.id),
    ...(after.blocks || []).map((b) => b && b.id)
  ])].filter(Boolean);
  for (const id of blockIds) {
    const b = (before.blocks || []).find((x) => x && x.id === id);
    const a = (after.blocks || []).find((x) => x && x.id === id);
    const fields = [...new Set([...Object.keys(b || {}), ...Object.keys(a || {})])]
      .filter((k) => k !== 'id');
    for (const f of fields) push(`blocks[${id}].${f}`, b?.[f], a?.[f]);
  }
  push('callToAction', before.callToAction, after.callToAction);
  const extraIds = [...new Set([
    ...(before.extras || []).map((e) => e.id),
    ...(after.extras || []).map((e) => e.id)
  ])];
  for (const id of extraIds) {
    push(
      `extras[${id}]`,
      (before.extras || []).find((e) => e.id === id)?.text,
      (after.extras || []).find((e) => e.id === id)?.text
    );
  }
  return diffs;
}
