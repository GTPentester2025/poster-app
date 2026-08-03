// Design pipeline (spec §B.6): approved content → designed poster canvas.
//
// Path A (predefined): the user picks one of the 12 registry templates; its
// build() compiles approved content + brand palette into canvas JSON locally.
// Path A2 (v2, template-first — plan D1/D2/O10): the templateId resolves in
// the v2 registry; BOTH orientations compile locally. design.canvas stays the
// PORTRAIT canvas at the exact key v1 used (editor, translation, preview and
// image slot fill all read design.canvas — zero breakage); the landscape
// canvas nests under design.landscape.canvas.
// Path B (dynamic): the recommender agent proposes a layout-spec DSL, the
// independent design reviewer holds it to the 90 gate (max 4 rework loops),
// and compileLayoutSpec turns the accepted spec into the SAME canvas JSON
// shape the templates produce — one design model for the future editor.
// The 90-gate design review loop stays portrait-only for v2 too (it judges
// design.canvas exactly as today).
//
// Orchestration rules honored here (mirrors content_pipeline):
//   - stage transitions validated via harness.validateHandoff; stage_start /
//     stage_end / user_action events emitted by this layer (pipeline 'design');
//     the harness emits the loop's stage/gate/rework events itself
//   - both paths end identically: doc.design + phase 'designed' + poster
//     status 'designed' + snapshot + harness checkpoint 'after-design'
//   - redesign is allowed: a poster already in phase 'designed' may apply a
//     different template, re-run the dynamic loop, or retry with a prompt
//     (spec Option 1 / Option 2 loop) — the user loops until satisfied

import { withPosterLock } from './content_pipeline.js';
import { resolveBrand } from '../templates/palette.js';
import * as templates from '../templates/index.js';
import { getTemplateV2, listTemplatesV2, buildCanvas as buildCanvasV2 } from '../templates/v2/index.js';
import {
  recommendDesign, toPx, zoneBackground, zoneFontPx, zoneText, ROLE_FONTS
} from '../agents/design_recommender.js';
import { reviewDesign } from '../agents/design_reviewer.js';
import { directArt, normalizeMode } from '../agents/art_director.js';
import { decideBackground } from '../agents/background_director.js';
import { recommendTemplate } from '../agents/template_recommender.js';
import { fenceUserText } from '../agents/prompts/data_fence.js';
import { refineContext } from '../agents/context_refiner.js';
import { qaStage } from '../agents/stage_qa.js';
import { reviewPrompting } from '../agents/overseer.js';
import {
  CANVAS_W, CANVAS_H, makeCanvas, textbox, rect, circle, polygon, chip, imageSlot, pickTextColor, estTextHeight
} from '../templates/helpers.js';

const PROJECT = 'poster-app';
const PIPELINE = 'design';
const MAX_DESIGN_REWORKS = 4; // spec §B.6 Path B — tighter than the content loop

function codedError(message, code, status) {
  const err = new Error(message);
  err.code = code;
  if (status) err.status = status;
  return err;
}

// ── poster persistence (same discipline as content_pipeline) ────────────────

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

function requirePhase(doc, phases, action) {
  if (!phases.includes(doc.phase)) {
    throw codedError(`Cannot ${action}: poster is in phase "${doc.phase}" (requires ${phases.join(' or ')})`, 'WRONG_PHASE', 409);
  }
}

// designable = content approved ('approved') or already designed (redesign allowed)
const DESIGN_PHASES = ['approved', 'designed'];

/**
 * Client view of a designed poster. The canvas JSON carries only approved
 * content + brand styling (nothing internal); the raw layoutSpec stays in the
 * doc — clients get its user-facing fields (rationale, layoutType) only.
 */
export function safeDesignState(row, doc) {
  const d = doc.design;
  return {
    posterId: row.poster_id,
    name: row.name,
    status: row.status,
    phase: doc.phase,
    runId: doc.runId,
    design: d ? {
      templateId: d.templateId,
      templateSource: d.templateSource,
      layoutType: d.layoutType,
      rationale: d.rationale,
      canvas: d.canvas,
      // v2 dual-orientation (D2): the landscape canvas rides along when built
      ...(d.landscape?.canvas ? { landscapeCanvas: d.landscape.canvas } : {}),
      palette: d.palette,
      fonts: d.fonts,
      reviewHistory: (d.reviewHistory || []).map((h) => ({ attempt: h.attempt, score: h.score, status: h.status }))
    } : null
  };
}

// ── layout-spec compiler (Path B → canvas JSON) ─────────────────────────────

const ZONE_PAD = 26;
const LABEL_CHIP_PX = 58; // vertical room a message label chip consumes

function compileBackground(canvas, background, palette) {
  const colors = background.colors || [];
  const base = colors[0] || palette.background;
  if (background.mode === 'split' && colors.length >= 2) {
    // top 40% colors[0], rest colors[1] — must match zoneBackground()
    canvas.background = colors[1];
    canvas.objects.push(rect({ x: 0, y: 0, w: CANVAS_W, h: Math.round(CANVAS_H * 0.4), fill: base, layerRole: 'background' }));
  } else if (background.mode === 'diagonal' && colors.length >= 2) {
    // colors[1] above the slice (0,55%) → (100,25%) — must match zoneBackground()
    canvas.background = base;
    canvas.objects.push(polygon([
      { x: 0, y: 0 }, { x: CANVAS_W, y: 0 },
      { x: CANVAS_W, y: Math.round(CANVAS_H * 0.25) }, { x: 0, y: Math.round(CANVAS_H * 0.55) }
    ], { fill: colors[1], layerRole: 'background' }));
  } else {
    canvas.background = base;
  }
}

function compileDecor(canvas, decor) {
  for (const d of decor) {
    const px = toPx(d);
    if (d.shape === 'rect') {
      canvas.objects.push(rect({ x: px.x, y: px.y, w: px.w, h: px.h, fill: d.color, angle: d.rotation || 0 }));
    } else if (d.shape === 'circle') {
      canvas.objects.push(circle({ x: px.x + px.w / 2, y: px.y + px.h / 2, r: Math.min(px.w, px.h) / 2, fill: d.color }));
    } else if (d.shape === 'polygon') {
      canvas.objects.push(polygon([
        { x: px.x + px.w / 2, y: px.y }, { x: px.x + px.w, y: px.y + px.h }, { x: px.x, y: px.y + px.h }
      ], { fill: d.color }));
    } else { // line — thin rule along the box's long axis
      if (px.w >= px.h) {
        canvas.objects.push(rect({ x: px.x, y: px.y, w: px.w, h: Math.max(3, Math.min(px.h, 12)), fill: d.color, angle: d.rotation || 0 }));
      } else {
        canvas.objects.push(rect({ x: px.x, y: px.y, w: Math.max(3, Math.min(px.w, 12)), h: px.h, fill: d.color, angle: d.rotation || 0 }));
      }
    }
  }
}

function compileZoneText(canvas, zone, content, palette, fonts) {
  const px = toPx(zone);
  const bg = zoneBg(zone, canvas, palette);
  const textColor = pickTextColor(bg);
  const model = ROLE_FONTS[zone.role] || ROLE_FONTS.message;
  const align = zone.style?.align || 'left';
  const message = zone.role === 'message' ? content.messages.find((m) => m.id === zone.msgId) : null;

  const text = zoneText(zone, content);
  if (!text) return; // no text → no chip either (never leave an orphan label)
  const fontSize = zoneFontPx({ ...zone, _hasLabel: Boolean(message?.label) }, text);

  // Vertically center the (label + text) block within the zone's inner box so
  // short copy sits balanced instead of clinging to the top edge — the fitted
  // text always fits, so the offset only ever pushes DOWN, never out of bounds.
  const labelH = message?.label ? LABEL_CHIP_PX : 0;
  const innerW = px.w - 2 * ZONE_PAD;
  const innerH = px.h - 2 * ZONE_PAD;
  const blockH = labelH + estTextHeight(text, fontSize, innerW);
  const offset = Math.max(0, Math.round((innerH - blockH) / 2));

  let textY = px.y + ZONE_PAD + offset;
  if (message?.label) {
    canvas.objects.push(...chip({
      text: message.label, x: px.x + ZONE_PAD, y: textY, fontSize: 22,
      bg: textColor, color: bg, font: fonts.head, msgId: message.id,
      square: zone.style?.chipStyle === 'square'
    }));
    textY += labelH;
  }
  canvas.objects.push(textbox({
    text, x: px.x + ZONE_PAD, y: textY, w: px.w - 2 * ZONE_PAD,
    fontSize, fontFamily: model.font === 'head' ? fonts.head : fonts.body, fontWeight: model.weight,
    fill: textColor, align,
    layerRole: zone.role === 'message' ? 'message' : zone.role,
    ...(message ? { msgId: message.id } : {}),
    bgRef: bg
  }));
}

// resolved background color under a zone (style.bg or the compiled mode color)
function zoneBg(zone, canvas, palette) {
  if (zone.style?.bg) return zone.style.bg;
  return zoneBackground({ ...zone, style: {} }, canvas._specBackground, palette);
}

/**
 * Compile an accepted layout spec into canvas JSON using the same factories
 * the predefined templates use — one uniform design model (spec §B.6).
 */
export function compileLayoutSpec(spec, content, palette, fonts) {
  const canvas = makeCanvas(palette.background);
  canvas._specBackground = spec.background; // internal to compilation
  compileBackground(canvas, spec.background, palette);

  // zone panels first (under decor + text)
  for (const zone of spec.zones) {
    if (zone.style?.bg) {
      const px = toPx(zone);
      canvas.objects.push(rect({
        x: px.x, y: px.y, w: px.w, h: px.h, fill: zone.style.bg, rx: 18, layerRole: 'background',
        ...(zone.role === 'message' ? { msgId: zone.msgId } : {})
      }));
    }
  }
  compileDecor(canvas, spec.decor || []);
  for (const slot of spec.imageSlots || []) {
    const px = toPx(slot);
    canvas.objects.push(imageSlot({
      slotId: slot.slotId, x: px.x, y: px.y, w: px.w, h: px.h,
      styleHint: slot.styleHint, stroke: pickTextColor(zoneBg(slot, canvas, palette))
    }));
  }
  for (const zone of spec.zones) compileZoneText(canvas, zone, content, palette, fonts);

  delete canvas._specBackground;
  return canvas;
}

// ── v2 content resolution (D2 accessor rule) ────────────────────────────────

/**
 * Content a v2 template build consumes. schemaVersion-2 docs already carry
 * blocks; v1 docs (messages) normalize via the D2 accessor rule
 * (messages → blocks with label/text, ids re-minted as blk-N). If the blocks
 * lack a field the template's contentSchema declares (e.g. v1 messages onto a
 * qa-pairs template), the apply is refused instead of compiling a canvas with
 * holes.
 */
function contentForV2(doc, template) {
  const content = structuredClone(doc.content);
  if (!Array.isArray(content.blocks)) {
    content.blocks = (Array.isArray(content.messages) ? content.messages : [])
      .map((m, i) => ({ id: `blk-${i + 1}`, label: m.label, text: m.text }));
  }
  const fields = template.contentSchema.blocks.fields;
  const missing = fields.filter((f) => content.blocks.some((b) => typeof b[f] !== 'string' || !b[f].trim()));
  if (missing.length) {
    throw codedError(
      `Content does not fit template "${template.id}": blocks are missing field(s) ${missing.join(', ')}`,
      'CONTENT_SCHEMA_MISMATCH', 409
    );
  }
  return content;
}

// ── shared finish: persist + snapshot + checkpoint ──────────────────────────

function finishDesign({ ctx, row, doc, posterId, design }) {
  const { db, harness } = ctx;
  doc.design = design;
  doc.phase = 'designed';
  pushSnapshot(doc, {
    trigger: 'design',
    design: { templateId: design.templateId, templateSource: design.templateSource, layoutType: design.layoutType }
  });
  savePoster(db, posterId, { status: 'designed', doc });
  // harness checkpoint (spec §B.9 rollback): restore point right after design.
  harness.checkpoint(doc.runId, 'after-design', { posterId, doc: structuredClone(doc) });
  return safeDesignState({ ...row, status: 'designed' }, doc);
}

/**
 * Finish the design and emit QA + context-refiner events for the design boundary.
 * Only used in runDesignPipelineUnlocked (retryDesign does not re-emit these).
 */
async function finishDesignWithSubAgents({ ctx, row, doc, posterId, design }) {
  const { bus } = ctx;
  const runId = doc.runId;

  // ── stage-qa: after design accepted ─────────────────────────────────────
  // Deterministic-only (egress: null): the design canvas was just compiled
  // locally, structural checks are sufficient, and template-mode tests assert
  // zero model calls. The model sanity call is optional per spec and would
  // require a live egress handler not present in template-mode tests.
  const qaDesign = await qaStage({
    egress: null, runId, pipeline: PIPELINE, stage: 'design-apply',
    artifact: design,
    checks: [
      { name: 'has-canvas', fn: (a) => a.canvas && typeof a.canvas === 'object' },
      { name: 'has-palette', fn: (a) => a.palette && typeof a.palette === 'object' }
    ]
  });
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'stage-qa',
    agent: 'stage-qa', skill: 'qa_stage', type: 'stage_end',
    payload: { qaStage: 'design-apply', ok: qaDesign.ok, score: qaDesign.score, problems: qaDesign.problems }
  });

  // ── context-refiner: after design, feeds image pipeline ─────────────────
  // Deterministic passthrough (egress: null): the handoff context to the image
  // pipeline does not need a model refinement at this boundary; events are
  // emitted for pipeline theater visibility only.
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'context-refine',
    agent: 'context-refiner', skill: 'refine_context', type: 'stage_start',
    payload: { forStage: 'image-generation' }
  });
  const designCtx = {
    topic: doc.contextFile?.topic ?? '',
    visualMode: design.visualMode ?? '',
    layoutType: design.layoutType ?? design.templateId ?? ''
  };
  const { notes: designRefinerNotes } =
    await refineContext({ egress: null, runId, pipeline: PIPELINE, stage: 'image-generation', context: designCtx });
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'context-refine',
    agent: 'context-refiner', skill: 'refine_context', type: 'stage_end',
    payload: { notes: designRefinerNotes, forStage: 'image-generation' }
  });

  // ── overseer: review the design stage's outbound prompting (non-blocking) ──
  // The dynamic path emits design-loop egress; template apply is deterministic
  // (no rows → overseer passthrough). Fire-and-forget, never blocks the compile.
  reviewPrompting({
    egress: ctx.egress, runId, db: ctx.db, bus,
    stage: 'design-loop', pipeline: PIPELINE, topic: doc.contextFile?.topic ?? null
  }).catch(() => { /* overseer is best-effort */ });

  return finishDesign({ ctx, row, doc, posterId, design });
}

// ── dynamic loop (Path B) ────────────────────────────────────────────────────

async function runDynamicLoop({ ctx, doc, palette, fonts, userPrompt, seedFeedback = [] }) {
  const { egress, harness } = ctx;
  const result = await harness.runQualityLoop({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'design-loop',
    gateName: 'designQuality', maxReworkLoops: MAX_DESIGN_REWORKS,
    produce: (attempt, history) => recommendDesign({
      egress, runId: doc.runId, content: doc.content, palette, userPrompt,
      priorFeedback: [...seedFeedback, ...history]
    }),
    review: async (spec, attempt) => {
      const verdict = await reviewDesign({ egress, runId: doc.runId, spec, content: doc.content, palette, attempt });
      return [{ reviewer: 'design-reviewer', ...verdict }];
    }
  });
  const reviewHistory = [
    ...result.history.map((h) => ({ attempt: h.attempt, score: h.score, status: 'rework', feedback: h.feedback, expected: h.expected })),
    { attempt: result.attempts, score: result.verdicts[0].score, status: 'accepted' }
  ];
  const spec = result.deliverable;
  return {
    templateId: null,
    templateSource: 'dynamic',
    layoutType: spec.layoutType,
    rationale: spec.rationale,
    layoutSpec: spec,
    canvas: compileLayoutSpec(spec, doc.content, palette, fonts),
    palette,
    fonts: { head: fonts.head, body: fonts.body },
    reviewHistory,
    designedAt: new Date().toISOString()
  };
}

// ── public API ──────────────────────────────────────────────────────────────

/**
 * Template gallery for a poster: the 12 v1 templates (recommended-first,
 * source 'v1', single previewSvg) merged with the 15 v2 templates (source
 * 'v2', previews for BOTH orientations — plan D1/O10).
 */
export function listTemplatesFor({ ctx, posterId }) {
  const { db, vault } = ctx;
  const { doc } = loadPoster(db, posterId);
  const { palette } = resolveBrand(vault);
  const contentShape = doc.content?.format || null;
  return {
    posterId,
    contentShape,
    templates: [
      ...templates.recommendFor(contentShape).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        suitedFor: t.suitedFor,
        recommended: contentShape ? t.suitedFor.includes(contentShape) : false,
        previewSvg: t.preview(palette),
        source: 'v1'
      })),
      ...listTemplatesV2(palette).map((t) => ({ ...t, source: 'v2' }))
    ]
  };
}

/**
 * Run the design phase. mode 'template' applies a predefined template
 * (Path A); mode 'dynamic' runs the recommender ⇄ reviewer 90-gate loop
 * (Path B, optional userPrompt = design instructions, fenced as data).
 */
export function runDesignPipeline(args) {
  return withPosterLock(args.posterId, () => runDesignPipelineUnlocked(args));
}

async function runDesignPipelineUnlocked({ ctx, posterId, mode, templateId = null, userPrompt = '', visualMode = 'futuristic' }) {
  const { db, bus, vault, harness } = ctx;
  const { row, doc } = loadPoster(db, posterId);
  requirePhase(doc, DESIGN_PHASES, mode === 'template' ? 'apply a template' : 'run the design loop');
  const { palette, fonts } = resolveBrand(vault);
  const prompt = String(userPrompt || '').trim();

  // Art direction: one cohesive brief per poster from topic + chosen visual
  // mode, attached to every design so image generation reads as one high-tech
  // set. Template apply stays a local, zero-model-call step (deterministic
  // brief); the dynamic path — already model-driven — gets a model-refined
  // brief. Either way it's resilient and never blocks the compile.
  const vmode = normalizeMode(visualMode);
  // Explicit stage events regardless of egress: the template path runs these
  // agents deterministically (zero model calls), which previously meant they
  // emitted NOTHING — the pipeline viz showed them as never utilized.
  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'art-direction',
    agent: 'art-director', skill: 'direct_art', type: 'stage_start',
    payload: { mode, visualMode: vmode }
  });
  const artDirection = await directArt({
    egress: mode === 'dynamic' ? ctx.egress : null,
    runId: doc.runId, topics: designTopics(doc),
    contentShape: doc.content?.format || '', visualMode: vmode, palette
  });
  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'art-direction',
    agent: 'art-director', skill: 'direct_art', type: 'stage_end',
    payload: { mode, deterministic: mode !== 'dynamic' }
  });

  // Background-decision stage: pick the background treatment (image /
  // gradient-mesh / pattern) + concept for this poster. Template apply stays
  // deterministic (zero-model); the dynamic path may model-refine. The rendered
  // background is gated by the background-reviewer at image fill.
  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'background-decision',
    agent: 'background-director', skill: 'decide_background', type: 'stage_start',
    payload: { mode }
  });
  const background = await decideBackground({
    egress: mode === 'dynamic' ? ctx.egress : null,
    runId: doc.runId, topics: designTopics(doc), visualMode: vmode, brief: artDirection
  });
  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'background-decision',
    agent: 'background-director', skill: 'decide_background', type: 'stage_end',
    payload: { mode, treatment: background?.treatment || null }
  });

  if (mode === 'template') {
    const templateV2 = getTemplateV2(templateId);
    const template = templateV2 || templates.get(templateId);
    if (!template) {
      throw codedError(
        `Unknown template "${templateId}" (known v1: ${templates.list().map((t) => t.id).join(', ')}; v2: ${listTemplatesV2().map((t) => t.id).join(', ')})`,
        'UNKNOWN_TEMPLATE', 400
      );
    }
    // v2 content resolves (and can 409) BEFORE any events ride the bus
    const v2Content = templateV2 ? contentForV2(doc, templateV2) : null;
    bus.emit({
      runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'design-selection',
      agent: 'user', skill: 'pick_template', type: 'user_action',
      payload: { posterId, templateId: template.id }
    });
    harness.validateHandoff({
      runId: doc.runId, project: PROJECT, pipeline: PIPELINE,
      fromStage: 'user-approval', toStage: 'design-apply',
      fromAgent: 'user', toAgent: 'design-compiler',
      payload: { summary: `apply ${templateV2 ? 'v2' : 'predefined'} template "${template.id}"`, templateId: template.id }
    });
    bus.emit({
      runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'design-apply',
      agent: 'design-compiler', skill: 'apply_template', type: 'stage_start',
      payload: { templateId: template.id }
    });
    const design = {
      templateId: template.id,
      templateSource: templateV2 ? 'v2' : 'predefined',
      layoutType: null,
      rationale: null,
      layoutSpec: null,
      visualMode: vmode,
      artDirection,
      background,
      // v2 (D2/O10): design.canvas STAYS the portrait canvas — every existing
      // consumer (editor, translation, preview, image slot fill) reads it;
      // the landscape canvas nests new under design.landscape.canvas.
      canvas: templateV2
        ? buildCanvasV2(template.id, 'portrait', v2Content, palette, fonts)
        : template.build(doc.content, palette, fonts),
      ...(templateV2 ? { landscape: { canvas: buildCanvasV2(template.id, 'landscape', v2Content, palette, fonts) } } : {}),
      palette,
      fonts: { head: fonts.head, body: fonts.body },
      reviewHistory: [],
      designedAt: new Date().toISOString()
    };
    bus.emit({
      runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'design-apply',
      agent: 'design-compiler', skill: 'apply_template', type: 'stage_end',
      payload: {
        templateId: template.id, objects: design.canvas.objects.length,
        ...(templateV2 ? { orientations: ['portrait', 'landscape'] } : {})
      }
    });
    return finishDesignWithSubAgents({ ctx, row, doc, posterId, design });
  }

  if (mode !== 'dynamic') {
    throw codedError(`mode must be 'template' or 'dynamic' (got "${mode}")`, 'INVALID_MODE', 400);
  }
  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'design-selection',
    agent: 'user', skill: 'request_dynamic_design', type: 'user_action',
    payload: { posterId, hasPrompt: Boolean(prompt) }
  });
  harness.validateHandoff({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE,
    fromStage: 'user-approval', toStage: 'design-loop',
    fromAgent: 'user', toAgent: 'design-recommender',
    payload: { summary: `dynamic design for "${doc.content.headline}" (${doc.content.messages.length} messages)`, hasPrompt: Boolean(prompt) }
  });
  const design = await runDynamicLoop({ ctx, doc, palette, fonts, userPrompt: prompt });
  design.visualMode = vmode;
  design.artDirection = artDirection;
  design.background = background;
  return finishDesignWithSubAgents({ ctx, row, doc, posterId, design });
}

/** Poster topics for art direction: the context topic + core keywords. */
function designTopics(doc) {
  const out = [];
  const cf = doc.contextFile;
  if (cf?.topic) out.push(cf.topic);
  if (Array.isArray(cf?.keywords?.core)) for (const k of cf.keywords.core) if (!out.includes(k)) out.push(k);
  return out;
}

/**
 * "Try again" on a designed poster (spec §B.6 Option 1 / Option 2 loop): the
 * shown design is treated as rejected, an optional user prompt steers the
 * next pass, and the full dynamic loop runs again.
 */
export function retryDesign(args) {
  return withPosterLock(args.posterId, () => retryDesignUnlocked(args));
}

/** v2 templates whose contentSchema the poster's content actually satisfies
 *  (field coverage via contentForV2 + block count within the schema's range). */
function compatibleV2Templates(doc, excludeId) {
  const out = [];
  for (const t of listTemplatesV2()) {
    if (t.id === excludeId) continue;
    const full = getTemplateV2(t.id);
    try {
      const content = contentForV2(doc, full);
      const { min, max } = full.contentSchema.blocks;
      const n = content.blocks.length;
      if (n >= min && n <= max) out.push(full);
    } catch { /* schema mismatch — not a candidate */ }
  }
  return out;
}

async function retryDesignUnlocked({ ctx, posterId, userPrompt = '' }) {
  const { db, bus, vault } = ctx;
  const { row, doc } = loadPoster(db, posterId);
  requirePhase(doc, ['designed'], 'retry the design');
  const { palette, fonts } = resolveBrand(vault);
  const prompt = String(userPrompt || '').trim();

  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'design-selection',
    agent: 'user', skill: 'retry_design', type: 'user_action',
    payload: { posterId, hasPrompt: Boolean(prompt), rejected: doc.design.templateId || doc.design.layoutType }
  });

  // v2-template posters: the dynamic loop can't consume blocks content — an
  // AI redesign here means recommending a DIFFERENT compatible v2 template and
  // rebuilding through the proven template path (this was the dead "Try again":
  // every dynamic attempt failed validation against content.messages).
  if (doc.design.templateSource === 'v2' && getTemplateV2(doc.design.templateId)) {
    const candidates = compatibleV2Templates(doc, doc.design.templateId);
    if (!candidates.length) {
      throw codedError('No other template fits this content — change the content or pick a template manually.', 'NO_ALTERNATIVE_TEMPLATE', 409);
    }
    const { templateId, reason } = await recommendTemplate({
      egress: ctx.egress, runId: doc.runId,
      prompt: `${designTopics(doc).join(', ')} — the user rejected "${doc.design.templateId}" and wants a noticeably different design.${prompt ? ` Instructions: ${prompt}` : ''}`,
      templates: candidates.map((t) => ({
        id: t.id, name: t.name, style: t.style, kind: t.contentSchema.blocks.kind, description: t.description
      })),
      db: ctx.db, posterId
    });
    bus.emit({
      runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'design-selection',
      agent: 'template-recommender', skill: 'recommend_template', type: 'stage_end',
      payload: { posterId, templateId, reason: String(reason || '').slice(0, 300) }
    });
    return runDesignPipelineUnlocked({
      ctx, posterId, mode: 'template', templateId,
      visualMode: doc.design.visualMode || 'futuristic'
    });
  }

  // v1/dynamic posters: re-run the dynamic loop with the rejection as seed
  const rejected = doc.design.templateId
    ? `the predefined template "${doc.design.templateId}"`
    : `a dynamic "${doc.design.layoutType}" layout`;
  const seedFeedback = [{
    attempt: 0,
    feedback: `The user rejected the previous design (${rejected}) and asked for another one.` +
      (prompt ? ` User instructions: ${fenceUserText(prompt)}` : ' No further instructions — produce a noticeably different layout.'),
    expected: 'A noticeably different layout (different layoutType or clearly different geometry) that still passes the 90 gate.'
  }];
  const design = await runDynamicLoop({ ctx, doc, palette, fonts, userPrompt: prompt, seedFeedback });
  return finishDesign({ ctx, row, doc, posterId, design });
}

/** Current design state for a poster (GET). */
export function getDesignState({ ctx, posterId }) {
  const { row, doc } = loadPoster(ctx.db, posterId);
  return safeDesignState(row, doc);
}
