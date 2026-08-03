// Autopilot pipeline (one-click Auto-Create): prompt → finished, designed,
// image-filled poster with ZERO intermediate user decisions. Composes the
// existing pipelines rather than re-implementing them:
//
//   creative-director (palette/fonts/template/mode brief)
//   → startContentPipeline (intent + research; template-first with the brief's pick)
//   → angle-autopick (model ranks angles; fallback first)
//   → chooseAngles (95-gate content loop; best-effort floor means it never dead-ends)
//   → approveContent (records approval learning exactly like a user click)
//   → runDesignPipeline mode 'template' with the creative brief
//   → generateForSlots (all image slots incl. background, in parallel)
//
// Every stage emits bus events on the poster's runId, so the existing SSE
// activity rail and metro stations light up live. Degradations (best-effort
// content, failed slots) are reported in stage_end payloads, never thrown:
// autopilot's contract is "always deliver the best poster it can".

import {
  startContentPipeline, chooseAngles, approveContent
} from './content_pipeline.js';
import { runDesignPipeline } from './design_pipeline.js';
import { generateForSlots } from './image_pipeline.js';
import { directCreative } from '../agents/creative_director.js';
import { pickAngle } from '../agents/angle_autopick.js';
import { listTemplatesV2 } from '../templates/v2/index.js';
import { resolveBrand } from '../templates/palette.js';

const PROJECT = 'poster-app';
const PIPELINE = 'autopilot';

function codedError(message, code, status) {
  const err = new Error(message);
  err.code = code;
  if (status) err.status = status;
  return err;
}

function loadDoc(db, posterId) {
  const row = db.prepare('SELECT * FROM posters WHERE poster_id = ?').get(posterId);
  if (!row) throw codedError(`poster ${posterId} not found`, 'POSTER_NOT_FOUND', 404);
  return { row, doc: JSON.parse(row.doc) };
}

/** Serializable template metadata for the creative-director chooser. */
function templateChoices() {
  return listTemplatesV2().map((t) => ({
    id: t.id,
    name: t.name,
    style: t.style,
    blocksKind: t.contentSchema?.blocks?.kind || 'any',
    imageSlots: t.contentSchema?.imageSlots ?? 0
  }));
}

/** All fillable image slots on a canvas (content slots + the 'bg' background). */
export function slotIdsOf(canvas) {
  const ids = [];
  for (const o of canvas?.objects || []) {
    if (o.layerRole === 'image-slot' && typeof o.slotId === 'string' && !ids.includes(o.slotId)) {
      ids.push(o.slotId);
    }
  }
  return ids;
}

/**
 * Run the whole poster flow from a single prompt. Synchronous like the other
 * pipelines (localhost app, SSE shows progress); returns the final design
 * state plus an autopilot summary of every decision it made for the user.
 *
 * @param {object} opts
 *   ctx     — app context {db, bus, vault, harness, egress}
 *   prompt  — user topic prompt
 * @returns {Promise<{posterId, runId, state, decisions}>}
 */
export async function runAutoPipeline({ ctx, prompt }) {
  const { db, bus, vault, egress } = ctx;
  const cleaned = String(prompt || '').trim();
  if (!cleaned) throw codedError('prompt must be a non-empty string', 'INVALID_PROMPT', 400);

  const brandOverride = Boolean(vault && vault.getOrgConfig().brandOverride);
  const brand = resolveBrand(vault);
  const decisions = {};

  // ── 1. creative direction (before content: template-first D2 needs the pick)
  const preBrief = await directCreative({
    egress, runId: null, // pre-run: no runId yet → deterministic; refined below
    topic: cleaned, format: '', templates: templateChoices(),
    brand, brandLocked: brandOverride
  });

  // ── 2. intent + research (creates poster + runId, phase 'angles')
  const started = await startContentPipeline({ ctx, prompt: cleaned, templateId: preBrief.templateId });
  const posterId = started.posterId;
  const runId = started.runId;

  const emit = (stage, type, payload) => bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage,
    agent: 'autopilot', skill: 'auto_create', type, payload: { posterId, ...payload }
  });
  emit('autopilot', 'stage_start', { prompt: cleaned.slice(0, 200) });

  // ── 3. refined creative direction, now model-backed with the real runId +
  // research-refined topic/format. Template may change; content hasn't
  // generated yet, so the poster doc's templateId is updated to match.
  let { doc } = loadDoc(db, posterId);
  const brief = await directCreative({
    egress, runId,
    topic: doc.contextFile?.topic || cleaned,
    format: doc.intent?.contentShape || doc.intent?.format || '',
    templates: templateChoices(),
    brand, brandLocked: brandOverride
  });
  if (brief.templateId && brief.templateId !== doc.templateId) {
    doc.templateId = brief.templateId;
    doc.schemaVersion = 2;
    db.prepare('UPDATE posters SET doc = ?, updated_at = ? WHERE poster_id = ?')
      .run(JSON.stringify(doc), new Date().toISOString(), posterId);
  }
  decisions.creative = {
    templateId: brief.templateId, paletteId: brief.paletteId,
    fontPairId: brief.fontPairId, visualMode: brief.visualMode, rationale: brief.rationale
  };
  emit('creative-direction', 'stage_end', decisions.creative);

  // ── 4. angle autopick → content loop (95-gate, best-effort floor)
  const angles = doc.contextFile?.angles || [];
  const picked = await pickAngle({
    egress, runId, topic: doc.contextFile?.topic || cleaned,
    synthesis: doc.contextFile?.synthesis || '', angles
  });
  decisions.angle = picked;
  emit('angle-selection', 'stage_end', { angleId: picked.angleId, reason: picked.reason });

  await chooseAngles({ ctx, posterId, angleIds: picked.angleId ? [picked.angleId] : 'ai' });

  ({ doc } = loadDoc(db, posterId));
  const lastReview = doc.reviewHistory?.at(-1) || null;
  decisions.content = {
    score: lastReview?.score ?? null,
    bestEffort: lastReview?.status === 'best-effort',
    attempts: doc.reviewHistory?.length ?? 0
  };
  await approveContent({ ctx, posterId });

  // ── 5. design: apply the creative brief's template with its palette/fonts
  await runDesignPipeline({
    ctx, posterId, mode: 'template',
    templateId: brief.templateId, visualMode: brief.visualMode, creative: brief
  });

  // ── 6. images: fill every slot (background + content) in parallel
  ({ doc } = loadDoc(db, posterId));
  const slotIds = slotIdsOf(doc.design?.canvas);
  let state = null;
  if (slotIds.length) {
    state = await generateForSlots({ ctx, posterId, slotIds });
    decisions.images = {
      requested: slotIds.length,
      filled: (state.batchResults || []).filter((r) => r.ok).length,
      failed: (state.batchResults || []).filter((r) => !r.ok).map((r) => r.slotId)
    };
  } else {
    decisions.images = { requested: 0, filled: 0, failed: [] };
  }

  emit('autopilot', 'stage_end', { decisions });
  if (!state) {
    const { row, doc: finalDoc } = loadDoc(db, posterId);
    state = { posterId, name: row.name, status: row.status, phase: finalDoc.phase };
  }
  return { posterId, runId, state, decisions };
}
