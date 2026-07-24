// Image pipeline (spec §B.7): fills image slots in a designed poster.
// Three sources:
//   'library'             — pick an existing library image; if unchecked, run gate
//   'generate'            — AI-generate a fresh asset (up to 3 attempts via zero-text gate)
//   'library-plus-prompt' — generate similar to a library image with a user prompt
//
// On assignment: replace the image-slot placeholder Rect in the canvas with a
// fabric Image object (v6 capitalized 'Image' type; bounds = the slot's
// left/top/width/height). The original slotSpec is copied onto the new Image
// object so regeneration and replacement remain possible.
//
// Events: pipeline 'image', stages 'slot-fill' and 'zero-text-gate'. EVERY
// zero-text check goes through ctx.gateEngine.check({gateName:'imageZeroText'})
// which emits the gate_check event (threshold 100 — spec hard rule).

import { readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withPosterLock } from './content_pipeline.js';
import { safeDesignState } from './design_pipeline.js';
import { generateAsset } from '../agents/image_generator.js';
import { checkZeroText } from '../agents/image_text_gate.js';
import { reviewImage } from '../agents/image_quality_reviewer.js';
import { reviewBackground } from '../agents/background_reviewer.js';
import { conceptForPoint, extractSignals } from '../agents/image_concept.js';
import { saveImage, getImagePath, markZeroTextCheck, imageDims, deriveAssetTags } from '../image-library/store.js';
import { recommendAsset, RECOMMEND_CONFIDENCE_THRESHOLD } from '../agents/asset_recommender.js';
import { fenceUserText } from '../agents/prompts/data_fence.js';
import { qaStage } from '../agents/stage_qa.js';
import { refineContext } from '../agents/context_refiner.js';
import { reviewPrompting } from '../agents/overseer.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_ASSETS_DIR = join(HERE, '..', 'image-library', 'assets');

const PROJECT = 'poster-app';
const PIPELINE = 'image';
// COST: only the ZERO-TEXT hard gate may trigger a regeneration, capped at 3
// total attempts (1 generation + up to 2 zero-text retries). The aesthetic /
// background / palette reviews are ADVISORY — run ONCE on the accepted image,
// recorded on the asset meta + a warning event, but NEVER regenerate.
const MAX_GENERATE_ATTEMPTS = 3;

// Per-attempt anti-text reinforcement phrases (attempt index 1..3).
// Attempt 1 uses the base zeroTextInstruction in the generator prompt.
// Attempts 2-3 escalate the language to push the model harder.
const ANTI_TEXT_PHRASES = {
  2: 'ABSOLUTELY NO text, letters, numbers, words, or typography of any kind',
  3: 'FINAL WARNING: produce a PURELY PICTORIAL image with absolutely no text, writing, letters, numbers, symbols, or typographic elements of any kind whatsoever — any text will cause immediate rejection'
};

// ── quality + size tiers by slot class (COST) ──────────────────────────────
// 'medium' renders are ~4x cheaper per image and visually identical at poster
// slot sizes. Background gets 'high' (full-bleed, most visible surface); hero
// and card/accent foregrounds get 'medium'. Accent slots additionally drop to
// a 1024x1024 square — they render small so square/medium is indistinguishable.
function qualityForSlot({ isBg }) {
  if (isBg) return 'high';       // full-bleed, most-visible surface
  return 'medium';               // hero, card, accent foregrounds — ~4x cheaper, visually identical at slot size
}

// ── concept-hash dedupe ─────────────────────────────────────────────────────
// Deterministic hash of {normalized concept text, treatment|'fg', sizeClass,
// palette.primary}. A prior asset with this hash that passed the zero-text gate
// is reused with ZERO api calls. The concept text encodes topic-specific detail
// so cross-poster false positives are unlikely. Library is shared → reuse is
// allowed across posters.
function normalizeConcept(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function conceptHashFor({ concept, treatment, sizeClass, palette }) {
  const primary = (palette && typeof palette.primary === 'string') ? palette.primary.toLowerCase() : '';
  const key = [
    normalizeConcept(concept),
    treatment || 'fg',
    sizeClass || '',
    primary
  ].join('|');
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Look up an existing library image with meta.conceptHash === hash that PASSED
 * the zero-text gate. Returns the image_id, or null. Newest match wins.
 */
function findReusableAsset(db, hash) {
  const rows = db.prepare(
    'SELECT image_id, meta FROM images WHERE zero_text_passed = 1 ORDER BY created_at DESC, rowid DESC'
  ).all();
  for (const row of rows) {
    if (!row.meta) continue;
    try {
      const m = JSON.parse(row.meta);
      if (m && m.conceptHash === hash) return row.image_id;
    } catch { /* bad meta json — skip */ }
  }
  return null;
}

// ── recommender candidate prefilter (client #3c) ─────────────────────────────
// SQL-prefilter reuse candidates for the recommender: zero-text-passed assets of
// the SAME kind (fg vs bg) that carry a description + tags, ranked by tag overlap
// with the need's tags, top-20. Keeps the model call cheap (bounded candidate
// set) and never returns the excludeId (the row we might be about to create, or
// a same-poster self-match is impossible here since the row doesn't exist yet).
function prefilterCandidates(db, { needTags = [], isBg = false, limit = 20 } = {}) {
  const wanted = new Set((needTags || []).map((t) => String(t).toLowerCase()));
  const rows = db.prepare(
    'SELECT image_id, meta FROM images WHERE zero_text_passed = 1 ORDER BY created_at DESC, rowid DESC'
  ).all();
  const scored = [];
  for (const row of rows) {
    if (!row.meta) continue;
    let m;
    try { m = JSON.parse(row.meta); } catch { continue; }
    if (!m || typeof m.description !== 'string' || !Array.isArray(m.tags)) continue;
    const metaBg = m.kind === 'background';
    if (metaBg !== isBg) continue; // kind must match (fg vs bg)
    const tags = m.tags.map((t) => String(t).toLowerCase());
    const overlap = tags.filter((t) => wanted.has(t)).length;
    if (overlap === 0 && wanted.size) continue; // require at least one tag overlap when we have need-tags
    scored.push({
      imageId: row.image_id,
      description: m.description,
      tags: m.tags,
      conceptHash: m.conceptHash || null,
      overlap
    });
  }
  scored.sort((a, b) => b.overlap - a.overlap); // stable: recency preserved within equal overlap
  return scored.slice(0, limit);
}

function codedError(message, code, status) {
  const err = new Error(message);
  err.code = code;
  if (status) err.status = status;
  return err;
}

// ── poster persistence (same discipline as content/design pipelines) ────────

function loadPoster(db, posterId) {
  const row = db.prepare('SELECT * FROM posters WHERE poster_id = ?').get(posterId);
  if (!row) throw codedError(`Poster ${posterId} not found`, 'POSTER_NOT_FOUND', 404);
  return { row, doc: JSON.parse(row.doc) };
}

function savePoster(db, posterId, { doc }) {
  db.prepare('UPDATE posters SET updated_at = ?, doc = ? WHERE poster_id = ?')
    .run(new Date().toISOString(), JSON.stringify(doc), posterId);
}

function pushSnapshot(doc, state) {
  doc.snapshots.push({ version: doc.snapshots.length + 1, capturedAt: new Date().toISOString(), state });
}

function requirePhase(doc, phases, action) {
  if (!phases.includes(doc.phase)) {
    throw codedError(`Cannot ${action}: poster is in phase "${doc.phase}" (requires ${phases.join(' or ')})`, 'WRONG_PHASE', 409);
  }
}

// ── slot profile classifier ──────────────────────────────────────────────────

/**
 * Derive a slot PROFILE from its geometry and the canvas dimensions.
 *
 * sizeClass:
 *   'accent'  — slot area < 8 % of canvas  → one iconic minimal subject
 *   'card'    — slot area 8–25 % of canvas  → single clear subject + modest context
 *   'hero'    — slot area > 25 % of canvas  → full scene
 *
 * aspect:  'tall' | 'wide' | 'square'   (from slot w/h ratio)
 * position: 'top-left' | 'top-center' | 'top-right'
 *           'center-left' | 'center'   | 'center-right'
 *           'bottom-left' | 'bottom-center' | 'bottom-right'
 *           (from slot center vs canvas center, each axis split into thirds)
 *
 * @param {{width: number, height: number, left: number, top: number}} frame
 * @param {{width: number, height: number}} canvas
 * @returns {{sizeClass: string, aspect: string, position: string}}
 */
export function slotProfileFor(frame, canvas) {
  const cw = canvas && canvas.width ? canvas.width : 1414;
  const ch = canvas && canvas.height ? canvas.height : 2000;
  const fw = frame && frame.width ? frame.width : 0;
  const fh = frame && frame.height ? frame.height : 0;
  const fl = frame && typeof frame.left === 'number' ? frame.left : 0;
  const ft = frame && typeof frame.top === 'number' ? frame.top : 0;

  const areaRatio = (fw * fh) / (cw * ch);
  const sizeClass = areaRatio < 0.08 ? 'accent' : areaRatio <= 0.25 ? 'card' : 'hero';

  const ratio = fh > 0 ? fw / fh : 1;
  const aspect = ratio >= 1.2 ? 'wide' : ratio <= 0.83 ? 'tall' : 'square';

  // slot center as fraction of canvas dims
  const cx = (fl + fw / 2) / cw;
  const cy = (ft + fh / 2) / ch;
  const col = cx < 1 / 3 ? 'left' : cx > 2 / 3 ? 'right' : 'center';
  const row = cy < 1 / 3 ? 'top' : cy > 2 / 3 ? 'bottom' : 'center';
  const position = row === 'center' && col === 'center' ? 'center' : `${row}-${col}`;

  return { sizeClass, aspect, position };
}

// ── image boundary: stage-qa + context-refiner + overseer ──────────────────

/**
 * Assert every assigned image in the canvas passed the zero-text gate.
 * Reads zero_text_passed off the image-library rows for the filled slots.
 * A slot with no library row (legacy) is treated as passed (fail-open — the
 * boundary is log-only and never blocks).
 */
function assignedAssetsZeroTextPassed(db, canvas) {
  const filled = (canvas?.objects || []).filter((o) => o.layerRole === 'image' && o.imageId);
  for (const o of filled) {
    const row = db.prepare('SELECT zero_text_passed FROM images WHERE image_id = ?').get(o.imageId);
    if (row && row.zero_text_passed === 0) return false;
  }
  return true;
}

/**
 * Image boundary sub-agents (Job B): after the requested slots fill, stage-qa
 * checks {every requested slot filled or explicitly failed, assets have
 * zero_text_passed}; the context-refiner passes an images summary forward; the
 * overseer reviews the slot-fill stage's outbound prompting. All log-only /
 * fire-and-forget — never blocks or fails a fill. `results` is an array of
 * {slotId, ok, imageId?} per requested slot.
 */
async function imageBoundarySubAgents({ ctx, doc, requestedSlotIds, results }) {
  const { db, bus } = ctx;
  const runId = doc.runId;
  const canvas = doc.design?.canvas || {};

  // stage-qa (deterministic — the fills already happened locally)
  const resolved = new Set(results.map((r) => r.slotId));
  const qa = await qaStage({
    egress: null, runId, pipeline: PIPELINE, stage: 'slot-fill',
    artifact: { requestedSlotIds, results, canvas },
    checks: [
      { name: 'every-slot-resolved', fn: () => requestedSlotIds.every((id) => resolved.has(id)) },
      { name: 'assets-zero-text-passed', fn: (a) => assignedAssetsZeroTextPassed(db, a.canvas) }
    ]
  });
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'stage-qa',
    agent: 'stage-qa', skill: 'qa_stage', type: 'stage_end',
    payload: { qaStage: 'slot-fill', ok: qa.ok, score: qa.score, problems: qa.problems }
  });

  // context-refiner: pass an images summary forward (deterministic passthrough —
  // events for viz visibility; egress: null keeps template-mode tests model-free)
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'context-refine',
    agent: 'context-refiner', skill: 'refine_context', type: 'stage_start',
    payload: { forStage: 'refine-editor' }
  });
  const imagesSummary = {
    topic: doc.contextFile?.topic ?? '',
    filled: results.filter((r) => r.ok).map((r) => r.slotId),
    failed: results.filter((r) => !r.ok).map((r) => r.slotId)
  };
  const { notes: imgRefinerNotes } =
    await refineContext({ egress: null, runId, pipeline: PIPELINE, stage: 'refine-editor', context: imagesSummary });
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'context-refine',
    agent: 'context-refiner', skill: 'refine_context', type: 'stage_end',
    payload: { notes: imgRefinerNotes, forStage: 'refine-editor' }
  });

  // overseer: review the slot-fill stage's outbound prompting (non-blocking)
  reviewPrompting({
    egress: ctx.egress, runId, db, bus,
    stage: 'slot-fill', pipeline: PIPELINE, topic: doc.contextFile?.topic ?? null
  }).catch(() => { /* overseer is best-effort */ });
}

/** True when the poster has no remaining unfilled (placeholder) image slots. */
function allSlotsFilled(canvas) {
  return !(canvas?.objects || []).some((o) => o.layerRole === 'image-slot');
}

// ── canvas slot helpers ──────────────────────────────────────────────────────

/** Find the fillable slot object (placeholder or already-assigned image). */
function findSlot(canvas, slotId) {
  const slot = canvas.objects.find(
    (o) => (o.layerRole === 'image-slot' || o.layerRole === 'image') && o.slotId === slotId
  );
  if (!slot) {
    throw codedError(`Image slot "${slotId}" not found in canvas`, 'SLOT_NOT_FOUND', 404);
  }
  return slot;
}

// Cover-fit falls back to a square when an image row carries no stored dims
// (legacy rows). Aspect-correct renders record real dims (store.imageDims).
const DEFAULT_IMAGE_PX = 1024;

// gpt-image-1 supports 1024x1024, 1024x1536 (portrait), 1536x1024 (landscape).
// Pick the size whose aspect best matches the slot frame so the render is
// framed for the slot instead of an upscaled square crop.
export function sizeForSlot(frame) {
  const w = frame && frame.width ? frame.width : 1;
  const h = frame && frame.height ? frame.height : 1;
  const ratio = h / w;
  if (ratio >= 1.2) return '1024x1536';   // portrait slot
  if (ratio <= 0.83) return '1536x1024';  // landscape slot
  return '1024x1024';                      // roughly square
}

/**
 * Resolve the slot FRAME (the rectangle the visible image must exactly fill)
 * from whatever object currently occupies the slot:
 *   - a previously cover-fitted Image carries the frame on its clipPath (its
 *     own left/top/width/height are the scaled image, NOT the frame)
 *   - a placeholder Rect (or a legacy pre-fit Image, whose bounds ARE the slot)
 *     is the frame directly — width/height folded with any scaleX/scaleY.
 */
function slotFrame(originalSlot) {
  const cp = originalSlot.clipPath;
  if (cp && typeof cp.width === 'number' && typeof cp.height === 'number') {
    return { left: cp.left, top: cp.top, width: cp.width, height: cp.height, rx: cp.rx, ry: cp.ry };
  }
  return {
    left: originalSlot.left,
    top: originalSlot.top,
    width: originalSlot.width * (originalSlot.scaleX || 1),
    height: originalSlot.height * (originalSlot.scaleY || 1),
    rx: originalSlot.rx,
    ry: originalSlot.ry
  };
}

/**
 * Replace the slot placeholder (or a previously assigned image) with a fabric
 * Image object, COVER-fitted to the slot frame (I6): the image keeps its
 * natural pixel dims, is scaled by max(slotW/imgW, slotH/imgH), centered in
 * the frame, and clipped by an absolutePositioned Rect matching the frame
 * (+rx/ry when the slot placeholder had rounded corners) so overflow never
 * spills outside the frame. The original slotSpec is preserved on the new
 * object for future regeneration.
 */
function assignSlot(canvas, slotId, imageId, originalSlot, imgDims = null) {
  const idx = canvas.objects.findIndex(
    (o) => (o.layerRole === 'image-slot' || o.layerRole === 'image') && o.slotId === slotId
  );
  if (idx === -1) return;
  const frame = slotFrame(originalSlot);
  const imgW = (imgDims && imgDims.width) || DEFAULT_IMAGE_PX;
  const imgH = (imgDims && imgDims.height) || DEFAULT_IMAGE_PX;
  const scale = Math.max(frame.width / imgW, frame.height / imgH);
  canvas.objects[idx] = {
    type: 'Image', // fabric v6 capitalized convention
    left: frame.left + (frame.width - imgW * scale) / 2,
    top: frame.top + (frame.height - imgH * scale) / 2,
    width: imgW,
    height: imgH,
    scaleX: scale,
    scaleY: scale,
    src: `/api/images/file/${imageId}`,
    clipPath: {
      type: 'Rect',
      left: frame.left,
      top: frame.top,
      width: frame.width,
      height: frame.height,
      ...(frame.rx ? { rx: frame.rx } : {}),
      ...(frame.ry ? { ry: frame.ry } : {}),
      absolutePositioned: true // clip in canvas coordinates, not image-local
    },
    layerRole: 'image',
    slotId,
    imageId,
    slotSpec: originalSlot.slotSpec // preserve for future regeneration
  };
}

// ── zero-text gate (every check emits gate_check via the gate engine) ───────

async function runZeroTextGate({ egress, gateEngine, runId, imageBase64, mediaType = 'image/png' }) {
  const verdict = await checkZeroText({ egress, runId, imageBase64, mediaType });
  // Return value intentionally ignored: checkZeroText verdict is authoritative.
  // gateEngine.check exists solely to emit the gate_check audit event; both
  // always agree because scores are 0 or 100 against a threshold of 100.
  gateEngine.check({
    gateName: 'imageZeroText',
    runId,
    project: PROJECT,
    pipeline: PIPELINE,
    stage: 'zero-text-gate',
    verdicts: [{ reviewer: 'image-text-gate', ...verdict }]
  });
  return verdict;
}

// ── source: library ──────────────────────────────────────────────────────────

async function handleLibrarySource({ ctx, doc, imageId, assetsDir }) {
  const { db, egress, gateEngine } = ctx;
  const libRow = db.prepare('SELECT * FROM images WHERE image_id = ?').get(imageId);
  if (!libRow) throw codedError(`Library image ${imageId} not found`, 'IMAGE_NOT_FOUND', 404);

  if (!libRow.zero_text_checked) {
    // Run the gate once and record the result on the library record
    const imageBase64 = readFileSync(getImagePath(libRow, assetsDir)).toString('base64');
    const libMediaType = libRow.file_name?.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    const verdict = await runZeroTextGate({ egress, gateEngine, runId: doc.runId, imageBase64, mediaType: libMediaType });
    markZeroTextCheck(db, imageId, verdict.status === 'accepted');
    if (verdict.status !== 'accepted') {
      throw codedError(
        `Library image ${imageId} failed the zero-text gate: ${verdict.feedback}`,
        'IMAGE_HAS_TEXT', 422
      );
    }
  } else if (!libRow.zero_text_passed) {
    throw codedError(
      `Library image ${imageId} previously failed the zero-text gate`,
      'IMAGE_HAS_TEXT', 422
    );
  }
  return imageId;
}

// ── source: generate (and library-plus-prompt via baseImageDescription) ─────

// The block whose POINT a foreground slot illustrates: an explicit
// slotSpec.blockId wins; otherwise fall back to the positional convention
// (slot-N ↔ blk-N / the Nth message). Returns {point, block} where point is the
// block's most descriptive message text and block is the normalized
// {text, heading, label} used for signal extraction — or {point:'', block:null}
// when nothing maps (then the concept stays topic-level).
function blockPointFor(doc, slot) {
  const content = doc.content || {};
  const blocks = Array.isArray(content.blocks)
    ? content.blocks
    : (Array.isArray(content.messages) ? content.messages : []);
  if (!blocks.length) return { point: '', block: null };

  let block = null;
  const bid = slot.slotSpec?.blockId;
  if (bid) block = blocks.find((b) => b.id === bid) || null;
  if (!block) {
    const m = /^slot-(\d+)$/.exec(slot.slotId || '');
    if (m) block = blocks[Number(m[1]) - 1] || null; // positional slot-N → Nth block
  }
  if (!block) return { point: '', block: null };
  const point = String(block.text || block.heading || block.caption || block.answer || block.label || '').trim();
  // Normalized block for signal mining: heading + text + label across the block's
  // varied field names, so extractSignals sees every teachable cue.
  const normalizedBlock = {
    heading: String(block.heading || block.title || '').trim(),
    text: String(block.text || block.caption || block.answer || '').trim(),
    label: String(block.label || '').trim()
  };
  return { point, block: normalizedBlock };
}

function posterTopics(doc) {
  const topics = [];
  const cf = doc.contextFile;
  if (cf?.topic) topics.push(cf.topic);
  if (Array.isArray(cf?.keywords?.core)) {
    for (const k of cf.keywords.core) {
      if (!topics.includes(k)) topics.push(k);
    }
  }
  return topics;
}

async function handleGenerateSource({ ctx, doc, slot, userPrompt, customPrompt, assetsDir, baseImageDescription = '', origin = 'generated', treatmentOverride = '', forceFresh = false }) {
  const { db, bus, egress, gateEngine } = ctx;
  const runId = doc.runId;
  const topics = posterTopics(doc);
  const styleHint = slot.slotSpec?.styleHint || '';
  const templateStyle = doc.design?.templateId || doc.design?.layoutType || '';
  const visualMode = doc.design?.visualMode || '';
  const brief = doc.design?.artDirection || null;
  const size = sizeForSlot(slotFrame(slot));
  const isBg = slot.slotId === 'bg';
  const bgDecision = isBg ? (doc.design?.background || null) : null;
  const treatment = (isBg && treatmentOverride) ? treatmentOverride : (bgDecision?.treatment || '');
  const bgConcept = bgDecision?.concept || '';

  // Slot profile: classify the slot's visual weight on the canvas so concept
  // and generation prompts are calibrated to the slot's actual size/position.
  const canvas = doc.design?.canvas || {};
  const canvasDims = { width: canvas.width || 1414, height: canvas.height || 2000 };
  const slotProfile = isBg ? null : slotProfileFor(slotFrame(slot), canvasDims);

  // Brand palette: thread the poster's resolved palette into image generation
  // so both foreground and background renders stay on-brand.
  const palette = doc.design?.palette || null;

  // ── COST: quality + size tiers by slot class (item 3) ─────────────────────
  // Accent slots drop to a 1024x1024 square (they render small — a medium
  // square is visually identical). A customPrompt does not change the tier.
  const sizeClass = isBg ? 'bg' : (slotProfile?.sizeClass || 'card');
  const quality = qualityForSlot({ isBg, sizeClass });
  const genSize = (!isBg && sizeClass === 'accent') ? '1024x1024' : size;

  // Fence the custom prompt if provided (max 500 chars enforced at the route layer)
  const fencedCustomPrompt = customPrompt ? fenceUserText(String(customPrompt).slice(0, 500)) : '';

  // Point-relevance: a FOREGROUND slot illustrates a specific content block, so
  // its POINT (the block's message) is the topic-specific seed. It drives both
  // the dedupe hash (raw, so the lookup needs NO model call) and — on a cache
  // miss — the derived concept.
  const { point, block: pointBlock } = isBg ? { point: '', block: null } : blockPointFor(doc, slot);
  // Concrete signals mined from the block (client #1 + #3a): used for the concept
  // directive AND as the primary source of deterministic asset tags.
  const signals = isBg ? [] : extractSignals(pointBlock || point);

  // ── COST: concept-hash dedupe / cache (item 2) ────────────────────────────
  // Hash the RAW seed ({point|styleHint} for fg, {bgConcept|treatment} for bg)
  // + treatment/'fg' + sizeClass + palette.primary BEFORE any model call, so a
  // cache HIT returns with ZERO api calls (no concept derivation, no generation,
  // no gate). The point text encodes topic-specific detail so cross-poster false
  // positives are unlikely; the library is shared so reuse spans posters.
  // A customPrompt / base-image request is bespoke → skip reuse (honor the
  // user's explicit instruction with a fresh render). forceFresh skips reuse on
  // an explicit regeneration of an already-filled slot.
  const conceptSeed = isBg ? (bgConcept || treatment || styleHint || '') : (point || styleHint || '');
  const conceptHash = conceptHashFor({ concept: conceptSeed, treatment: isBg ? (treatment || 'bg') : 'fg', sizeClass, palette });
  if (!forceFresh && !fencedCustomPrompt && !baseImageDescription) {
    const reusableId = findReusableAsset(db, conceptHash);
    if (reusableId) {
      bus.emit({
        runId, project: PROJECT, pipeline: PIPELINE, stage: 'slot-fill',
        agent: 'image-pipeline', skill: 'reuse_asset', type: 'stage_end',
        payload: { slotId: slot.slotId, imageId: reusableId, conceptHash, reason: 'concept-hash-hit' }
      });
      return reusableId;
    }
  }

  // Cache miss → derive the concept from the point (one cheap model call). The
  // derived concept replaces the template's static styleHint and is also handed
  // to the reviewer so it can gate relevance. Background slots stay topic-level.
  let effectiveStyleHint = styleHint;
  if (!isBg && point) {
    effectiveStyleHint = await conceptForPoint({ egress, runId, point, block: pointBlock, topics, visualMode, brief, slotProfile });
  }

  // ── LIBRARY AUTO-RECOMMEND (client #3c — the dedupe engine): after the fast
  // conceptHash path missed, ask the recommender whether an EXISTING asset
  // already satisfies this need well enough to reuse (zero image-gen calls).
  // Candidates are SQL-prefiltered by kind + tag overlap (top-20); ONE cheap
  // model call ranks them. Only confidence >= 0.75 is honored. Skipped for
  // bespoke requests (customPrompt / base image) and explicit regenerations.
  if (!forceFresh && !fencedCustomPrompt && !baseImageDescription) {
    const needTags = deriveAssetTags({ concept: effectiveStyleHint, point, signals, treatment, sizeClass, palette, isBg }).tags;
    const paletteWord = palette ? deriveAssetTags({ palette }).tags[0] || '' : '';
    const candidates = prefilterCandidates(db, { needTags, isBg });
    if (candidates.length) {
      const rec = await recommendAsset({
        egress, runId,
        need: { point, concept: effectiveStyleHint, treatment: isBg ? (treatment || 'bg') : 'fg', sizeClass, paletteWord, conceptHash },
        candidates
      });
      if (rec.imageId && rec.confidence >= RECOMMEND_CONFIDENCE_THRESHOLD) {
        bus.emit({
          runId, project: PROJECT, pipeline: PIPELINE, stage: 'slot-fill',
          agent: 'image-pipeline', skill: 'reuse_asset', type: 'stage_end',
          payload: { slotId: slot.slotId, imageId: rec.imageId, reused: true, confidence: rec.confidence, reason: rec.reason || 'recommender-match' }
        });
        return rec.imageId;
      }
    }
  }

  // I5 — user regen input dominates: when a customPrompt is present, the fenced
  // user description leads the outbound prompt as the PRIMARY subject directive
  // and the auto-derived slot/topic prompt demotes to style/context. Implemented
  // as a generateImage wrapper around egress so that WITHOUT a customPrompt the
  // prompt generateAsset assembles goes out byte-for-byte unchanged (and the
  // anti-text escalation + zero-text gate flow is untouched either way).
  const genEgress = fencedCustomPrompt
    ? {
      generateImage: (opts, genCtx) => egress.generateImage({
        ...opts,
        prompt: `PRIMARY SUBJECT (user's explicit request — this OVERRIDES the default subject): ${fencedCustomPrompt}. `
          + `STYLE + CONTEXT (palette, mood, poster context — do not let this override the primary subject): ${opts.prompt}`
      }, genCtx)
    }
    : egress;

  let lastFeedback = '';      // zero-text failure feedback (hard gate)
  const slotRole = slot.slotId === 'bg' ? 'background' : 'foreground';
  // COST (client #2): ONE bounded palette-corrective regeneration per slot.
  // When the advisory review returns reason 'palette', we regenerate ONCE with
  // the FORBIDDEN clause escalated to the first prompt line. Budget is strictly
  // 1 (paletteRetryDone latches true), so worst-case extra cost is +$0.05/slot.
  let paletteRetryDone = false;

  // Run the advisory review on an accepted render and shape the verdict object.
  const runAdvisory = async (b64) => {
    const review = isBg
      ? await reviewBackground({ egress, runId, imageBase64: b64, treatment, palette })
      : await reviewImage({ egress, runId, imageBase64: b64, brief, slotRole, point, palette });
    gateEngine.check({
      gateName: isBg ? 'imageBackground' : 'imageAesthetic', runId, project: PROJECT, pipeline: PIPELINE,
      stage: isBg ? 'background-review' : 'aesthetic-gate',
      verdicts: [{ reviewer: isBg ? 'background-reviewer' : 'image-quality-reviewer', ...review }]
    });
    return {
      kind: isBg ? 'background' : 'aesthetic',
      status: review.status,
      score: review.score,
      ...(review.status !== 'accepted' ? { feedback: review.feedback } : {}),
      ...(review.reason ? { reason: review.reason } : {})
    };
  };

  for (let attempt = 1; attempt <= MAX_GENERATE_ATTEMPTS; attempt++) {
    bus.emit({
      runId, project: PROJECT, pipeline: PIPELINE, stage: 'slot-fill',
      agent: 'image-generator', skill: 'generate_asset', type: 'stage_start',
      payload: { slotId: slot.slotId, attempt }
    });

    // Build the per-attempt reinforcement note. ONLY zero-text failures (the
    // hard gate) drive a retry now, escalating the anti-text language. Aesthetic
    // / palette reviews are advisory and never regenerate, so they no longer
    // steer the prompt.
    let feedbackNote = '';
    if (lastFeedback) {
      const antiText = ANTI_TEXT_PHRASES[attempt] || ANTI_TEXT_PHRASES[3];
      feedbackNote = `previous attempt contained text: ${lastFeedback} — ${antiText} — regenerate with zero text`;
    }

    // customPrompt is NOT merged into userPrompt: it rides ahead of the whole
    // prompt as the PRIMARY SUBJECT directive via the genEgress wrapper above.
    let imageBase64, promptUsed;
    let generationError = null;
    try {
      ({ imageBase64, promptUsed } = await generateAsset(
        { egress: genEgress, runId, styleHint: effectiveStyleHint, templateStyle, topics, userPrompt, baseImageDescription,
          visualMode, brief, slotId: slot.slotId, size: genSize, treatment, bgConcept, slotProfile, palette, quality },
        feedbackNote
      ));
    } catch (genErr) {
      generationError = genErr;
    }

    bus.emit({
      runId, project: PROJECT, pipeline: PIPELINE, stage: 'slot-fill',
      agent: 'image-generator', skill: 'generate_asset', type: 'stage_end',
      payload: { slotId: slot.slotId, attempt, promptHead: generationError ? null : String(promptUsed || '').slice(0, 200) }
    });

    if (generationError) {
      // Save a failed record for this attempt
      mkdirSync(assetsDir, { recursive: true });
      // Use a 1x1 transparent PNG placeholder for failed generation — no real pixels
      const failBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      const failRec = await saveImage({
        db, buffer: failBuffer, origin,
        topics, style: null, format: null,
        meta: {
          attempt, slotId: slot.slotId, posterId: doc.runId,
          ...(isBg ? { kind: 'background' } : {}),
          zero_text_checked: true, zero_text_passed: false,
          failReason: 'generation-error', generationError: String(generationError.message || generationError)
        },
        assetsDir
      });
      markZeroTextCheck(db, failRec.image_id, false);

      bus.emit({
        runId, project: PROJECT, pipeline: PIPELINE, stage: 'slot-fill',
        agent: 'image-pipeline', skill: 'fill_slot', type: 'rework',
        payload: { attempt, reason: 'generation-error', slotId: slot.slotId }
      });

      if (attempt === MAX_GENERATE_ATTEMPTS) {
        const err = codedError(
          `Image generation failed after ${MAX_GENERATE_ATTEMPTS} attempts. Last reason: generation error — ${generationError.message}`,
          'IMAGE_RETRIES_EXHAUSTED', 409
        );
        err.attempts = MAX_GENERATE_ATTEMPTS;
        err.lastReason = 'generation-error';
        throw err;
      }
      lastFeedback = generationError.message || 'generation error';
      continue;
    }

    const verdict = await runZeroTextGate({ egress, gateEngine, runId, imageBase64 });
    const accepted = verdict.status === 'accepted';

    // Persist every attempt — pass or fail. On the accepted render, the advisory
    // aesthetic/background review runs ONCE (below) and its verdict is folded
    // into meta before we save; failed attempts store only the gate details.
    // COST meta (item 6): {quality, sizeUsed, reused:false} + conceptHash so a
    // future request with the same concept can REUSE this asset (item 2).
    const gateDetails = !accepted ? { feedback: verdict.feedback, score: verdict.score } : undefined;

    // ── advisory review (item 1): run ONCE on the ACCEPTED image. Records the
    // verdict on meta + emits a warning event when below threshold. Background →
    // background-reviewer; foreground → aesthetic reviewer. Both fail open (a
    // review error → accepted). ────────────────────────────────────────────────
    let advisory = accepted ? await runAdvisory(imageBase64) : null;
    // metadata for THIS render's saved row — mutated when a palette retry lands.
    let paletteRetryTag = false;

    // ── PALETTE CORRECTIVE REGEN (client #2, bounded to 1): when the advisory
    // verdict names a PALETTE violation and we have not yet spent the palette
    // retry, regenerate ONCE with paletteRetry:true (FORBIDDEN clause hoisted to
    // the first prompt line). If the corrective render passes the zero-text gate,
    // it REPLACES this render (tagged paletteRetry:true) and its own advisory
    // verdict is used. Cost: +1 image gen worst-case (~$0.05). ──────────────────
    if (accepted && advisory && advisory.status !== 'accepted' && advisory.reason === 'palette' && !paletteRetryDone) {
      paletteRetryDone = true; // latch: strictly one palette retry per slot
      bus.emit({
        runId, project: PROJECT, pipeline: PIPELINE, stage: 'slot-fill',
        agent: 'image-pipeline', skill: 'fill_slot', type: 'rework',
        payload: { attempt, slotId: slot.slotId, reason: 'palette-retry', paletteRetry: true, score: advisory.score }
      });
      try {
        const retryGen = await generateAsset(
          { egress: genEgress, runId, styleHint: effectiveStyleHint, templateStyle, topics, userPrompt, baseImageDescription,
            visualMode, brief, slotId: slot.slotId, size: genSize, treatment, bgConcept, slotProfile, palette, quality, paletteRetry: true },
          feedbackNote
        );
        const retryVerdict = await runZeroTextGate({ egress, gateEngine, runId, imageBase64: retryGen.imageBase64 });
        if (retryVerdict.status === 'accepted') {
          // adopt the corrective render
          imageBase64 = retryGen.imageBase64;
          promptUsed = retryGen.promptUsed;
          advisory = await runAdvisory(imageBase64);
          paletteRetryTag = true;
        }
        // if the corrective render fails zero-text, keep the original accepted one.
      } catch { /* corrective regen error → keep the original accepted render */ }
    }

    mkdirSync(assetsDir, { recursive: true });
    const rec = await saveImage({
      db, buffer: Buffer.from(imageBase64, 'base64'), origin,
      topics, style: null, format: null,
      meta: {
        attempt, slotId: slot.slotId, posterId: doc.runId,
        ...(isBg ? { kind: 'background' } : {}),
        ...(gateDetails ? { gateDetails } : {}),
        ...(accepted ? { conceptHash, quality, sizeUsed: genSize, reused: false } : {}),
        ...(paletteRetryTag ? { paletteRetry: true } : {}),
        ...(advisory ? { advisoryReview: advisory } : {}),
        ...(accepted ? deriveAssetTags({ concept: effectiveStyleHint, point, signals, treatment, sizeClass, palette, isBg }) : {})
      },
      assetsDir
    });
    markZeroTextCheck(db, rec.image_id, accepted);

    if (accepted) {
      // Advisory verdict below threshold → emit a warning-flavored 'rework' event
      // (the bus has no dedicated 'warning' type). advisory:true marks it as
      // NON-blocking — it does NOT regenerate; the accepted render still ships.
      if (advisory && advisory.status !== 'accepted') {
        bus.emit({
          runId, project: PROJECT, pipeline: PIPELINE, stage: 'slot-fill',
          agent: 'image-pipeline', skill: 'fill_slot', type: 'rework',
          payload: {
            attempt, slotId: slot.slotId, imageId: rec.image_id,
            reason: advisory.reason === 'palette' ? 'palette' : (isBg ? 'background-review' : 'aesthetic-review'),
            advisory: true, score: advisory.score, feedback: advisory.feedback
          }
        });
      }
      return rec.image_id; // ship the accepted render regardless of advisory verdict
    }

    lastFeedback = verdict.feedback;

    bus.emit({
      runId, project: PROJECT, pipeline: PIPELINE, stage: 'slot-fill',
      agent: 'image-pipeline', skill: 'fill_slot', type: 'rework',
      payload: { attempt, reason: 'zero-text-gate', slotId: slot.slotId }
    });

    if (attempt === MAX_GENERATE_ATTEMPTS) {
      const err = codedError(
        `Image generation failed the zero-text gate after ${MAX_GENERATE_ATTEMPTS} attempts. Last feedback: ${verdict.feedback}`,
        'IMAGE_RETRIES_EXHAUSTED', 409
      );
      err.attempts = MAX_GENERATE_ATTEMPTS;
      err.lastReason = 'zero-text-gate';
      throw err;
    }
  }
}

// ── source: library-plus-prompt ───────────────────────────────────────────────

async function handleLibraryPlusPromptSource({ ctx, doc, slot, imageId, userPrompt, customPrompt, assetsDir }) {
  const { db } = ctx;
  const libRow = db.prepare('SELECT * FROM images WHERE image_id = ?').get(imageId);
  if (!libRow) throw codedError(`Library image ${imageId} not found`, 'IMAGE_NOT_FOUND', 404);

  // Base description from the library image's stored metadata (never pixels —
  // the generator gets words, the gate later sees the generated pixels)
  const baseParts = [];
  if (libRow.style) baseParts.push(`style: ${libRow.style}`);
  if (libRow.topics) {
    try {
      const t = JSON.parse(libRow.topics);
      if (Array.isArray(t) && t.length) baseParts.push(`topics: ${t.join(', ')}`);
    } catch { /* legacy/bad topics json — skip */ }
  }
  if (libRow.meta) {
    try {
      const m = JSON.parse(libRow.meta);
      if (m.styleHint) baseParts.push(String(m.styleHint));
      if (m.description) baseParts.push(String(m.description));
    } catch { /* bad meta json — skip */ }
  }
  const baseImageDescription = baseParts.join('; ') || 'security awareness illustration';

  return handleGenerateSource({
    ctx, doc, slot, userPrompt, customPrompt, assetsDir, baseImageDescription, origin: 'generated-from-library'
  });
}

// Assign an already-generated imageId to a slot: portrait cover-fit + the
// dual-orientation landscape mirror + real pixel dims. Shared by the single and
// batch fill paths. `originalSlot` (bounds+spec) defaults to the current slot.
function applyAssignment(db, doc, slotId, imageId, originalSlot = null) {
  const orig = originalSlot || { ...findSlot(doc.design.canvas, slotId) };
  const imgDims = imageDims(db.prepare('SELECT meta FROM images WHERE image_id = ?').get(imageId));
  assignSlot(doc.design.canvas, slotId, imageId, orig, imgDims);
  const landscapeCanvas = doc.design.landscape?.canvas;
  if (landscapeCanvas) {
    const ls = landscapeCanvas.objects.find(
      (o) => (o.layerRole === 'image-slot' || o.layerRole === 'image') && o.slotId === slotId);
    if (ls) assignSlot(landscapeCanvas, slotId, imageId, { ...ls }, imgDims);
  }
}

// ── public API ────────────────────────────────────────────────────────────────

export function generateForSlot(args) {
  return withPosterLock(args.posterId, () => generateForSlotUnlocked(args));
}

/**
 * Batch-fill several slots by GENERATING their images IN PARALLEL, then applying
 * all assignments under a single poster lock + one save. The slow part (image
 * generation + gates) overlaps across slots because it is read-only on the
 * poster doc and writes only independent image-library rows; only the final
 * canvas mutation is serialized. Returns the design state + per-slot results
 * (never throws for a single slot's failure — a failed slot stays empty).
 */
export function generateForSlots(args) {
  return generateForSlotsUnlocked(args);
}

async function generateForSlotsUnlocked({ ctx, posterId, slotIds, assetsDir = DEFAULT_ASSETS_DIR }) {
  const { db, bus, harness } = ctx;
  const { doc } = loadPoster(db, posterId);
  requirePhase(doc, ['designed'], 'fill image slots');
  const ids = [...new Set((Array.isArray(slotIds) ? slotIds : []).filter((s) => typeof s === 'string' && s))];
  if (!ids.length) throw codedError('slotIds must be a non-empty array', 'MISSING_SLOT_IDS', 400);

  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'slot-fill',
    agent: 'image-pipeline', skill: 'fill_slot', type: 'stage_start',
    payload: { posterId, slotIds: ids, batch: true }
  });

  // generate every slot concurrently — read-only on the doc; each writes only
  // its own image-library rows and emits its own per-slot progress events.
  const results = await Promise.all(ids.map(async (slotId) => {
    try {
      const slot = findSlot(doc.design.canvas, slotId);
      const imageId = await handleGenerateSource({ ctx, doc, slot, userPrompt: '', customPrompt: '', assetsDir });
      return { slotId, imageId, ok: true };
    } catch (err) {
      return { slotId, ok: false, error: err.code || err.message || 'generation-error' };
    }
  }));

  // apply all assignments under ONE lock against a FRESH doc, save once
  let freshDoc = null;
  const state = await withPosterLock(posterId, () => {
    const { row, doc: fresh } = loadPoster(db, posterId);
    for (const r of results) {
      if (!r.ok) continue;
      try {
        applyAssignment(db, fresh, r.slotId, r.imageId);
        pushSnapshot(fresh, { trigger: 'image-slot-fill', slotId: r.slotId, source: 'generate', imageId: r.imageId });
      } catch { /* slot removed between gen and assign — skip it */ }
    }
    savePoster(db, posterId, { doc: fresh });
    harness.checkpoint(fresh.runId, 'after-images', { posterId, doc: structuredClone(fresh) });
    freshDoc = fresh;
    return safeDesignState(row, fresh);
  });

  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'slot-fill',
    agent: 'image-pipeline', skill: 'fill_slot', type: 'stage_end',
    payload: { posterId, batch: true, results: results.map((r) => ({ slotId: r.slotId, ok: r.ok, imageId: r.imageId || null, error: r.error || null })) }
  });

  // ── image boundary (Job B): stage-qa + context-refiner + overseer after the
  // batch fills all requested slots. Log-only — never blocks. ────────────────
  await imageBoundarySubAgents({ ctx, doc: freshDoc || doc, requestedSlotIds: ids, results });

  return { ...state, batchResults: results.map((r) => ({ slotId: r.slotId, ok: r.ok, error: r.error || null })) };
}

// Re-export the coded error factory so routes can build IMAGE_RETRIES_EXHAUSTED 409s
export { codedError };

async function generateForSlotUnlocked({ ctx, posterId, slotId, source, imageId, userPrompt = '', customPrompt = '', assetsDir = DEFAULT_ASSETS_DIR, treatmentOverride = '' }) {
  const { db, bus } = ctx;
  const { row, doc } = loadPoster(db, posterId);
  requirePhase(doc, ['designed'], 'fill image slot');

  const slot = findSlot(doc.design.canvas, slotId);
  const originalSlot = { ...slot }; // capture bounds + slotSpec before replacement
  // Regeneration: the slot already holds an Image → the user wants a fresh
  // render, so bypass concept-hash reuse for this explicit action.
  const isRegeneration = slot.layerRole === 'image';

  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'slot-fill',
    agent: 'image-pipeline', skill: 'fill_slot', type: 'stage_start',
    payload: { posterId, slotId, source }
  });

  let assignedImageId;
  const prompt = String(userPrompt || '').trim();
  const custom = String(customPrompt || '').trim();

  if (source === 'library') {
    if (!imageId) throw codedError('imageId is required for source "library"', 'MISSING_IMAGE_ID', 400);
    assignedImageId = await handleLibrarySource({ ctx, doc, imageId, assetsDir });
  } else if (source === 'generate') {
    assignedImageId = await handleGenerateSource({ ctx, doc, slot, userPrompt: prompt, customPrompt: custom, assetsDir, treatmentOverride, forceFresh: isRegeneration });
  } else if (source === 'library-plus-prompt') {
    if (!imageId) throw codedError('imageId is required for source "library-plus-prompt"', 'MISSING_IMAGE_ID', 400);
    assignedImageId = await handleLibraryPlusPromptSource({ ctx, doc, slot, imageId, userPrompt: prompt, customPrompt: custom, assetsDir });
  } else {
    throw codedError(`source must be 'library', 'generate', or 'library-plus-prompt' (got "${source}")`, 'INVALID_SOURCE', 400);
  }

  applyAssignment(ctx.db, doc, slotId, assignedImageId, originalSlot);

  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'slot-fill',
    agent: 'image-pipeline', skill: 'fill_slot', type: 'stage_end',
    payload: { posterId, slotId, source, imageId: assignedImageId }
  });

  pushSnapshot(doc, { trigger: 'image-slot-fill', slotId, source, imageId: assignedImageId });
  savePoster(db, posterId, { doc });
  // harness checkpoint (spec §B.9 rollback / plan D4 reroute): restore point
  // right after a slot fill succeeded — mirrors 'after-content'/'after-design'.
  ctx.harness.checkpoint(doc.runId, 'after-images', { posterId, doc: structuredClone(doc) });

  // ── image boundary (Job B): only when THIS fill completed the poster's last
  // empty slot — the poster's image phase is now done. Log-only, never blocks. ─
  if (allSlotsFilled(doc.design?.canvas)) {
    await imageBoundarySubAgents({
      ctx, doc, requestedSlotIds: [slotId],
      results: [{ slotId, ok: true, imageId: assignedImageId }]
    });
  }

  return safeDesignState(row, doc);
}
