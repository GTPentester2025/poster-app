// Reroute pipeline (Phase O6, plan D4): "Not happy? Tell the pipeline."
//
// suggestForPoster — read-only + one model call (no poster lock): builds a
// SAFE doc summary (never raw doc internals — contextFile synthesis/sources
// must not reach the prompt), asks the reroute agent, and reports which of
// the four reroute checkpoint labels actually exist for the poster's run.
//
// executeReroute — under the poster mutation lock: validates the checkpoint
// exists for the run (LAST occurrence of the label wins — a run can design /
// fill slots several times), harness.rollback returns the {posterId, doc}
// snapshot, the doc is restored via the same savePoster discipline the other
// pipelines use, and the appropriate stage re-runs with the adjustments as
// seed feedback:
//   'after-research' — back to phase 'angles' (selectedAngleIds null, the
//        user re-picks); adjustments stored on doc.pendingAdjustments and
//        consumed exactly once by the next chooseAngles as seed feedback.
//   'after-content'  — the 95-gate content loop re-runs immediately via the
//        same runContentLoop path submitUserFeedback uses internally, with
//        adjustments + feedback as the seed.
//   'after-design'   — the restored snapshot IS the accepted design (phase
//        'designed', slot fills undone). Re-running design needs user input
//        (template choice / dynamic prompt), so we stop here: the design
//        station re-runs apply/retry with `adjustments` (echoed in the
//        response) as its userPrompt. Documented simpler-correct option.
//   'after-images'   — slot fills cleared back to placeholder rects, phase
//        stays 'designed'; the user refills slots (adjustments echoed for
//        the image station's prompt).
//
// Learning: every executed reroute writes a learning row kind 'reroute'
// {feedback (capped 500), checkpoint, templateId, style, adjustments} that
// buildLearningHints surfaces (fenced) to future content loops on the topic.

import { withPosterLock, safeState, runContentLoop } from './content_pipeline.js';
import { safeDesignState } from './design_pipeline.js';
import { suggestReroute } from '../agents/reroute.js';
import { REROUTE_CHECKPOINTS } from '../agents/prompts/reroute_prompts.js';
import { getTemplateV2 } from '../templates/v2/index.js';
import { fenceUserText } from '../agents/prompts/data_fence.js';
import { imageSlot, pickTextColor } from '../templates/helpers.js';

const PROJECT = 'poster-app';
const PIPELINE = 'reroute';
const FEEDBACK_LEARNING_CAP = 500;

function codedError(message, code, status) {
  const err = new Error(message);
  err.code = code;
  if (status) err.status = status;
  return err;
}

// ── poster persistence (same discipline as the other pipelines) ─────────────

function loadPoster(db, posterId) {
  const row = db.prepare('SELECT * FROM posters WHERE poster_id = ?').get(posterId);
  if (!row) throw codedError(`Poster ${posterId} not found`, 'POSTER_NOT_FOUND', 404);
  return { row, doc: JSON.parse(row.doc) };
}

function savePoster(db, posterId, { status = null, doc }) {
  const now = new Date().toISOString();
  if (status) {
    db.prepare('UPDATE posters SET status = ?, updated_at = ?, doc = ? WHERE poster_id = ?')
      .run(status, now, JSON.stringify(doc), posterId);
  } else {
    db.prepare('UPDATE posters SET updated_at = ?, doc = ? WHERE poster_id = ?')
      .run(now, JSON.stringify(doc), posterId);
  }
}

function pushSnapshot(doc, state) {
  doc.snapshots.push({ version: doc.snapshots.length + 1, capturedAt: new Date().toISOString(), state });
}

function resolveSelectedAngles(doc) {
  if (doc.selectedAngleIds === 'ai') return null;
  const ids = new Set(doc.selectedAngleIds || []);
  return doc.contextFile.angles.filter((a) => ids.has(a.id));
}

// ── safe doc summary (the ONLY doc-derived data the agent prompt sees) ──────

/**
 * SAFE summary for the reroute prompt. Never includes contextFile internals
 * (synthesis/sources), the canvas, or review prose — template/style/phase,
 * the headline, and structural counts are all the router needs.
 */
export function buildDocSummary(doc) {
  const template = doc.templateId ? getTemplateV2(doc.templateId) : null;
  const canvasObjects = doc.design?.canvas?.objects || [];
  const content = doc.content || {};
  return {
    templateId: doc.templateId || null,
    style: template ? template.style : null,
    phase: doc.phase,
    headline: content.headline ?? null,
    blockCount: Array.isArray(content.blocks) ? content.blocks.length
      : Array.isArray(content.messages) ? content.messages.length : 0,
    imageSlotCount: canvasObjects.filter((o) => o.layerRole === 'image-slot' || o.layerRole === 'image').length,
    hasImages: canvasObjects.some((o) => o.layerRole === 'image'),
    hasDesign: Boolean(doc.design)
  };
}

/** The reroute checkpoint labels that exist for a run, in pipeline order. */
function availableCheckpoints(harness, runId) {
  const labels = new Set(harness.getRunState(runId).checkpoints.map((c) => c.label));
  return REROUTE_CHECKPOINTS.filter((l) => labels.has(l));
}

// ── learning (kind 'reroute' — surfaced by buildLearningHints) ──────────────

function recordRerouteLearning(db, bus, runId, { doc, checkpoint, feedback, adjustments }) {
  const template = doc.templateId ? getTemplateV2(doc.templateId) : null;
  const detail = {
    feedback: feedback.slice(0, FEEDBACK_LEARNING_CAP),
    checkpoint,
    templateId: doc.templateId || null,
    style: template ? template.style : null,
    adjustments
  };
  const info = db.prepare(
    'INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(new Date().toISOString(), 'reroute', doc.contextFile.topic, null, JSON.stringify(detail), 1.0);
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'learning-memory',
    agent: 'learning-memory', skill: 'store_learning', type: 'memory_write',
    payload: { kind: 'reroute', topic: doc.contextFile.topic, checkpoint, learningId: Number(info.lastInsertRowid) }
  });
}

// ── slot-fill clearing (after-images) ────────────────────────────────────────

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Replace every assigned Image object with its placeholder rect again. */
function clearSlotFills(canvas) {
  const stroke = typeof canvas.background === 'string' && HEX_COLOR.test(canvas.background)
    ? pickTextColor(canvas.background)
    : '#1F1A17';
  let cleared = 0;
  canvas.objects = canvas.objects.map((o) => {
    if (o.layerRole !== 'image' || !o.slotId) return o;
    cleared += 1;
    return imageSlot({
      slotId: o.slotId, x: o.left, y: o.top, w: o.width, h: o.height,
      styleHint: o.slotSpec?.styleHint || '', stroke
    });
  });
  return cleared;
}

// ── public API ───────────────────────────────────────────────────────────────

/**
 * Suggestion mode: no lock needed — read-only + one model call.
 * @returns {{suggestion: {checkpoint, reasoning, adjustments}, availableCheckpoints: string[]}}
 */
export async function suggestForPoster({ ctx, posterId, feedback }) {
  const { db, egress, harness } = ctx;
  const text = String(feedback || '').trim();
  if (!text) throw codedError('feedback must be a non-empty string', 'INVALID_FEEDBACK', 400);
  const { doc } = loadPoster(db, posterId);

  const suggestion = await suggestReroute({
    egress, runId: doc.runId, feedback: text, docSummary: buildDocSummary(doc)
  });
  return { suggestion, availableCheckpoints: availableCheckpoints(harness, doc.runId) };
}

/**
 * Execute a reroute: rollback + doc restore + stage re-run with adjustments
 * as seed feedback. The client passes BOTH suggestion fields (checkpoint +
 * adjustments) back — the model is never re-called here.
 */
export function executeReroute(args) {
  return withPosterLock(args.posterId, () => executeRerouteUnlocked(args));
}

async function executeRerouteUnlocked({ ctx, posterId, checkpoint, adjustments, feedback }) {
  const { db, bus, harness } = ctx;
  const { row, doc: currentDoc } = loadPoster(db, posterId);
  const text = String(feedback || '').trim();
  const adj = String(adjustments || '').trim();
  if (!text) throw codedError('feedback must be a non-empty string', 'INVALID_FEEDBACK', 400);
  if (!adj) throw codedError('adjustments must be a non-empty string', 'INVALID_ADJUSTMENTS', 400);
  if (!REROUTE_CHECKPOINTS.includes(checkpoint)) {
    throw codedError(`checkpoint must be one of: ${REROUTE_CHECKPOINTS.join(', ')} (got "${checkpoint}")`, 'INVALID_CHECKPOINT', 400);
  }
  const runId = currentDoc.runId;
  // LAST occurrence of the label wins — a run may have designed / filled
  // slots several times, and the newest snapshot is the state the user saw.
  const labels = harness.getRunState(runId).checkpoints.map((c) => c.label);
  const index = labels.lastIndexOf(checkpoint);
  if (index === -1) {
    throw codedError(`Run ${runId} has no "${checkpoint}" checkpoint (available: ${labels.join(', ') || 'none'})`, 'CHECKPOINT_NOT_FOUND', 400);
  }

  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'reroute-execute',
    agent: 'user', skill: 'accept_reroute', type: 'user_action',
    payload: { posterId, checkpoint, feedback: text.slice(0, 400) }
  });

  const snapshot = harness.rollback(runId, index, {
    pipeline: PIPELINE, reason: `user reroute to ${checkpoint}: ${text.slice(0, 200)}`
  });
  if (!snapshot?.doc || snapshot.posterId !== posterId) {
    throw codedError(`Checkpoint "${checkpoint}" snapshot does not belong to poster ${posterId}`, 'CHECKPOINT_MISMATCH', 409);
  }
  // learning references the doc the user was actually unhappy with
  recordRerouteLearning(db, bus, runId, { doc: currentDoc, checkpoint, feedback: text, adjustments: adj });

  const doc = structuredClone(snapshot.doc);

  if (checkpoint === 'after-research') {
    // user re-picks angles; adjustments consumed by the next chooseAngles
    doc.phase = 'angles';
    doc.selectedAngleIds = null;
    doc.content = null;
    doc.reviewHistory = [];
    doc.pendingAdjustments = adj;
    savePoster(db, posterId, { status: 'draft', doc });
    return { reroutedTo: checkpoint, adjustments: adj, state: safeState({ ...row, status: 'draft' }, doc) };
  }

  if (checkpoint === 'after-content') {
    // same internal path as submitUserFeedback: seed the 95-gate loop
    const seedFeedback = [{
      attempt: 0,
      feedback: `The user rerouted the pipeline back to rewrite the content (previous accepted headline: "${doc.content.headline}"). ` +
        `User feedback: ${fenceUserText(text)} Adjustments to apply: ${fenceUserText(adj)}`,
      expected: 'A rewritten draft that applies the adjustments while still passing the 95 gate.'
    }];
    const { content, reviewHistory } = await runContentLoop({
      ctx, runId, contextFile: doc.contextFile,
      selectedAngles: resolveSelectedAngles(doc), userPrompt: doc.prompt,
      seedFeedback, templateId: doc.templateId
    });
    doc.content = content;
    doc.reviewHistory = reviewHistory;
    doc.phase = 'content-approval';
    pushSnapshot(doc, { content, reviewHistory, trigger: 'reroute-after-content' });
    savePoster(db, posterId, { status: 'draft', doc });
    return { reroutedTo: checkpoint, adjustments: adj, state: safeState({ ...row, status: 'draft' }, doc) };
  }

  if (checkpoint === 'after-design') {
    // Simpler correct option (documented in the header): the snapshot IS the
    // accepted design with slot fills undone; a design re-run needs user
    // input, so the design station re-runs apply/retry with `adjustments`
    // (echoed below) as its userPrompt.
    pushSnapshot(doc, { trigger: 'reroute-after-design' });
    savePoster(db, posterId, { status: 'designed', doc });
    return { reroutedTo: checkpoint, adjustments: adj, state: safeDesignState({ ...row, status: 'designed' }, doc) };
  }

  // after-images: keep the design, clear the fills, user regenerates.
  // BOTH orientations: v2 designs mirror every fill into the landscape
  // canvas — leaving it uncleared would ship the user's REJECTED images in
  // landscape exports/translations while portrait shows empty slots.
  let cleared = clearSlotFills(doc.design.canvas);
  if (doc.design.landscape?.canvas) {
    cleared += clearSlotFills(doc.design.landscape.canvas);
  }
  doc.phase = 'designed';
  pushSnapshot(doc, { trigger: 'reroute-after-images', clearedSlots: cleared });
  savePoster(db, posterId, { status: 'designed', doc });
  return { reroutedTo: checkpoint, adjustments: adj, state: safeDesignState({ ...row, status: 'designed' }, doc) };
}
