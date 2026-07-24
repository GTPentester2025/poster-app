// Content pipeline (spec §B.1 stages 2-4): prompt → keyword/intent → RAG
// research → context file → content loop (95 gate) → user approval actions.
//
// Orchestration rules honored here:
//   - every stage transition goes through harness.validateHandoff
//   - stage_start / stage_end / user_action / memory_write events are emitted
//     by THIS layer; egress logs its own agent_output per model call; the
//     harness emits the loop's stage/gate/rework events itself
//   - the FULL context file (synthesis + sources) lives only in the poster
//     doc (internal); every value returned to callers is a SAFE VIEW —
//     angles + topic only (spec §B.4: the context file is never shown to the
//     user directly, and source attribution stays in internal logs)
//   - grounding degradation: zero retrieved articles does NOT fail the run;
//     the research agent synthesizes from general security-awareness
//     knowledge instead (sources: []), and the run is marked grounded:false
//     in events, the poster doc, and the safe view so news-grounded and
//     knowledge-only posters stay distinguishable
//   - user has the final word on inline edits: applied VERBATIM (shape-
//     validated only), never re-reviewed; edit-learning runs fire-and-forget
//     and affects future runs only

import { randomUUID } from 'node:crypto';
import { newRunId } from '#shared';
import { retrieve } from '../rag/retrieval.js';
import { buildContextFile } from '../rag/context_file.js';
import { extractIntent } from '../agents/keyword_intent.js';
import { generateContent, generateContentV2, validatePosterContent, normalizePosterContent } from '../agents/content_generator.js';
import { validateContentAgainstSchema, normalizeContentV2 } from '../agents/content_schema.js';
import { reviewContent, reviewContentV2 } from '../agents/content_reviewer.js';
import { getTemplateV2 } from '../templates/v2/index.js';
import { learnFromEdit } from '../agents/edit_learning.js';
import {
  RESEARCH_FALLBACK_SYSTEM, buildResearchFallbackPrompt
} from '../agents/prompts/research_fallback_prompts.js';
import { fenceUserText } from '../agents/prompts/data_fence.js';
import { refineContext } from '../agents/context_refiner.js';
import { qaStage } from '../agents/stage_qa.js';
import { reviewPrompting } from '../agents/overseer.js';

const PROJECT = 'poster-app';
const PIPELINE = 'content';
const RETRIEVAL_LIMIT = 10;
const LEARNING_ROW_LIMIT = 20;
// The content gate is 95. Rather than dead-end the user when a draft converges
// just short of it, accept the best attempt at or above this floor (flagged
// best-effort + recorded for self-learning). Genuinely weak drafts still fail.
const CONTENT_BEST_EFFORT_FLOOR = 88;

function codedError(message, code, status) {
  const err = new Error(message);
  err.code = code;
  if (status) err.status = status;
  return err;
}

/**
 * Fire-and-forget overseer prompt-review at a stage boundary. Non-blocking:
 * the promise is not awaited and any error is swallowed, so the overseer can
 * never delay or fail a pipeline. Emits 'overseer' stage events + records a
 * 'prompt_review' learning row internally.
 */
function overseeStage(ctx, { runId, stage, topic }) {
  reviewPrompting({
    egress: ctx.egress, runId, db: ctx.db, bus: ctx.bus,
    stage, pipeline: PIPELINE, topic
  }).catch(() => { /* overseer is best-effort — never surfaces */ });
}

// ── in-flight guard (lost-update race) ─────────────────────────────────────

// One in-flight mutation per poster. Concurrent mutations on the same
// posterId would each load the doc, run a (slow) content loop, and save —
// last writer silently discarding the other. Module-level on purpose: routes
// and any future callers share the same map.
const posterLocks = new Map();

/**
 * Run `fn` holding the poster's mutation lock. Throws POSTER_BUSY (→ 409 at
 * the route layer) when another mutation on the same poster is in flight.
 */
export async function withPosterLock(posterId, fn) {
  if (posterLocks.has(posterId)) {
    throw codedError(`Poster ${posterId} already has an operation in flight`, 'POSTER_BUSY', 409);
  }
  posterLocks.set(posterId, true);
  try {
    return await fn();
  } finally {
    posterLocks.delete(posterId);
  }
}

// ── poster persistence ─────────────────────────────────────────────────────

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

/**
 * Client view of the review trail (spec §B.5 surfaces reviewer feedback on
 * regenerate): every entry keeps {attempt, score, status}; the full (already
 * scrubbed) feedback/expected ride ONLY on the most recent entry that carries
 * any — that's all the regenerate UI needs, and older reviewer prose stops
 * travelling to clients at all.
 */
function clientReviewHistory(reviewHistory) {
  const entries = reviewHistory || [];
  let latest = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].feedback || entries[i].expected) { latest = i; break; }
  }
  return entries.map((h, i) => (i === latest
    ? { attempt: h.attempt, score: h.score, status: h.status, feedback: h.feedback, expected: h.expected }
    : { attempt: h.attempt, score: h.score, status: h.status }));
}

/**
 * SAFE VIEW (spec §B.4): everything a client may see. NEVER include
 * contextFile.synthesis or contextFile.sources — angle ids/titles/rationales
 * and the topic are the only research-derived fields that leave the server.
 */
export function safeState(row, doc) {
  return {
    posterId: row.poster_id,
    name: row.name,
    status: row.status,
    phase: doc.phase,
    runId: doc.runId,
    prompt: doc.prompt,
    grounded: doc.grounded,
    topic: doc.contextFile.topic,
    angles: doc.contextFile.angles.map(({ id, title, rationale }) => ({ id, title, rationale })),
    selectedAngleIds: doc.selectedAngleIds,
    content: doc.content,
    reviewHistory: clientReviewHistory(doc.reviewHistory)
  };
}

// ── learning memory (spec §B.12 self-learning) ─────────────────────────────

function recordLearning(db, bus, runId, { kind, topic, angle = null, detail, weight = 1.0 }) {
  const detailJson = JSON.stringify(detail);
  const info = db.prepare(
    'INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(new Date().toISOString(), kind, topic, angle, detailJson, weight);
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'learning-memory',
    agent: 'learning-memory', skill: 'store_learning', type: 'memory_write',
    payload: { kind, topic, angle, learningId: Number(info.lastInsertRowid) }
  });
  return Number(info.lastInsertRowid);
}

/**
 * Build prompt hints from the learning table for a topic: approved angles get
 * preference, rejected patterns are avoided, past edit lessons are applied.
 * Newest rows first, capped so hints never crowd out the actual context.
 * Every hint carries user/model-derived text (headlines, edit guidance), so
 * each one is wrapped in the <user_text> data fence before it can reach a
 * generator prompt (learning-table poisoning defence).
 */
export function buildLearningHints(db, topic) {
  // 'feedback' rows are included only when they carry an explicit rating:
  // the Phase-4 content loop inserts rating-less kind='feedback' rows
  // (corrective remarks — already re-entering that loop as priorFeedback);
  // fetching them here would produce no hint yet consume LIMIT slots,
  // displacing hint-producing rows for chatty topics.
  const rows = db.prepare(
    `SELECT kind, angle, detail, weight FROM learning
     WHERE topic = ? AND (
       kind IN ('approval','rejection','edit_learning','reroute')
       OR (kind = 'feedback' AND json_extract(detail, '$.rating') IN ('good','bad'))
       OR (kind = 'prompt_review' AND json_extract(detail, '$.score') < 80)
     )
     ORDER BY ts DESC, id DESC LIMIT ?`
  ).all(topic, LEARNING_ROW_LIMIT);
  const hints = [];
  for (const r of rows) {
    let detail = null;
    try { detail = JSON.parse(r.detail); } catch { /* legacy plain-text detail */ }
    if (r.kind === 'prompt_review' && Array.isArray(detail?.notes) && detail.notes.length) {
      // Overseer self-improvement loop: past low-scoring prompt reviews for a
      // stage surface their top note so the next round tightens that prompting.
      hints.push(`Past prompt review for ${detail.stage || 'a stage'}: ${detail.notes[0]} — improve this round.`);
    } else if (r.kind === 'approval') {
      hints.push(`Users previously APPROVED ${r.angle ? `the angle "${r.angle}"` : 'an AI-chosen angle'} for this topic (weight ${r.weight}) — prefer similar framing.`);
    } else if (r.kind === 'rejection') {
      const what = detail?.headline ? `a draft headlined "${detail.headline}"` : (r.angle ? `the angle "${r.angle}"` : 'a previous draft');
      hints.push(`Users previously REJECTED ${what} for this topic — avoid repeating that approach.`);
    } else if (r.kind === 'edit_learning' && detail?.guidance) {
      hints.push(`Learned from a past user edit (${detail.changeType}): ${detail.guidance}`);
    } else if (r.kind === 'reroute' && detail?.adjustments) {
      hints.push(`Past users with similar feedback needed: ${detail.adjustments} — consider it upfront.`);
    } else if (r.kind === 'feedback' && detail?.rating === 'good' && detail?.headline) {
      hints.push(`Users rated a poster headlined "${detail.headline}" GOOD for this topic — similar framing works.`);
    } else if (r.kind === 'feedback' && detail?.rating === 'bad' && detail?.headline) {
      hints.push(`Users rated a poster headlined "${detail.headline}" BAD for this topic — avoid repeating that approach.`);
    }
  }
  return hints.map((h) => fenceUserText(h));
}

// ── stage b fallback: ungrounded context file ──────────────────────────────

function validateFallback(out) {
  const problems = [];
  if (!out || typeof out !== 'object') return ['response is not a JSON object'];
  if (typeof out.synthesis !== 'string' || out.synthesis.trim().length < 50) {
    problems.push('missing "synthesis" (substantial string)');
  }
  if (!Array.isArray(out.angles) || out.angles.length < 3 || out.angles.length > 5 ||
      !out.angles.every((a) => a && typeof a.id === 'string' && typeof a.title === 'string' && typeof a.rationale === 'string')) {
    problems.push('"angles" must be 3-5 items with string id, title, rationale');
  }
  return problems;
}

/**
 * Zero retrieved articles: synthesize the context file from general
 * security-awareness knowledge (documented degradation — spec grounds content
 * in news, but "no matching news this week" must not dead-end the product).
 * sources: [] is the durable marker; the caller also tags events grounded:false.
 */
async function buildUngroundedContextFile({ egress, runId, intent }) {
  const ctx = { runId, pipeline: PIPELINE, stage: 'research-synthesis', agent: 'rag-research', skill: 'synthesize_general_knowledge' };
  const user = buildResearchFallbackPrompt({ topic: intent.topic, core: intent.core, expanded: intent.expanded });

  let out = await egress.completeJson({ system: RESEARCH_FALLBACK_SYSTEM, user, temperature: 0.3 }, ctx);
  let problems = validateFallback(out);
  if (problems.length) {
    out = await egress.completeJson({
      system: RESEARCH_FALLBACK_SYSTEM,
      user: `${user}\n\nYour previous response was invalid:\n- ${problems.join('\n- ')}\nRespond again with ONLY the corrected JSON object.`,
      temperature: 0
    }, ctx);
    problems = validateFallback(out);
    if (problems.length) {
      throw codedError(`Ungrounded context file invalid after retry: ${problems.join('; ')}`, 'CONTEXT_FILE_INVALID');
    }
  }
  return {
    contextId: `ctx-${randomUUID()}`,
    runId,
    createdAt: new Date().toISOString(),
    topic: intent.topic,
    keywords: { core: intent.core, expanded: intent.expanded, contentShape: intent.contentShape },
    synthesis: out.synthesis,
    angles: out.angles.map((a) => ({ id: a.id, title: a.title, rationale: a.rationale })),
    sources: []
  };
}

// ── content quality loop (stage d) ─────────────────────────────────────────

/**
 * Run the 95-gate produce→review loop via the harness. seedFeedback entries
 * (user feedback / regeneration context) are prepended to the harness's own
 * accumulated history so no iteration ever loses context (spec §B.5).
 * V2 FORK (Phase O4): when templateId resolves to a v2 template, generation
 * and review are template-aware (generateContentV2/reviewContentV2 — the
 * contentSchema rides both prompts); otherwise the exact v1 path runs.
 * Exported for the reroute pipeline (Phase O6): an 'after-content' reroute
 * re-runs this exact loop with the reroute adjustments as seed feedback.
 */
export async function runContentLoop({ ctx, runId, contextFile, selectedAngles, userPrompt, seedFeedback = [], templateId = null }) {
  const { db, egress, harness, bus } = ctx;
  const template = templateId ? getTemplateV2(templateId) : null;
  const learningHints = buildLearningHints(db, contextFile.topic);
  const result = await harness.runQualityLoop({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'content-loop', gateName: 'posterContent',
    bestEffortFloor: CONTENT_BEST_EFFORT_FLOOR,
    produce: (attempt, history) => (template
      ? generateContentV2({
        egress, runId, contextFile, selectedAngles, userPrompt, template,
        priorFeedback: [...seedFeedback, ...history],
        learningHints
      })
      : generateContent({
        egress, runId, contextFile, selectedAngles, userPrompt,
        priorFeedback: [...seedFeedback, ...history],
        learningHints
      })),
    review: async (content, attempt) => {
      // the reviewer sees the user's ORIGINAL prompt: relevance criterion #0
      // (drift to a different topic is an automatic rework)
      const verdict = template
        ? await reviewContentV2({ egress, runId, content, contextFile, template, attempt, userPrompt })
        : await reviewContent({ egress, runId, content, contextFile, attempt, userPrompt });
      return [{ reviewer: 'content-reviewer', ...verdict }];
    }
  });
  // Self-learning: a best-effort acceptance (gate never fully met) teaches the
  // next same-topic run to change approach — recorded as a 'rejection' of the
  // near-miss headline so buildLearningHints surfaces it upfront on the retry.
  if (result.bestEffort) {
    recordLearning(db, bus, runId, {
      kind: 'rejection', topic: contextFile.topic, angle: null,
      detail: {
        headline: result.deliverable.headline,
        reason: (result.history.at(-1)?.feedback || '').slice(0, 400),
        bestEffortScore: result.verdicts[0].score
      }
    });
  }
  const reviewHistory = [
    ...result.history.map((h) => ({ attempt: h.attempt, score: h.score, status: 'rework', feedback: h.feedback, expected: h.expected })),
    { attempt: result.attempts, score: result.verdicts[0].score, status: result.bestEffort ? 'best-effort' : 'accepted' }
  ];
  return { content: result.deliverable, reviewHistory };
}

function resolveSelectedAngles(doc) {
  if (doc.selectedAngleIds === 'ai') return null;
  const ids = new Set(doc.selectedAngleIds || []);
  return doc.contextFile.angles.filter((a) => ids.has(a.id));
}

/**
 * Extra learning-detail fields for template-first (v2) posters: templateId +
 * style tag every row so buildLearningHints can weigh per-template patterns
 * later. Empty for v1 docs — their detail objects stay byte-for-byte.
 */
function templateDetail(doc) {
  if (!doc.templateId) return {};
  const template = getTemplateV2(doc.templateId);
  return { templateId: doc.templateId, style: template ? template.style : null };
}

// ── public API ──────────────────────────────────────────────────────────────

/**
 * Stages a+b (spec §B.1): intent extraction, research, context file.
 * Return-to-user point 1: {phase:'angles'} — the user picks angle(s) or 'ai'.
 * V2 (Phase O4, template-first): when templateId resolves to a v2 template
 * the poster doc is tagged templateId + schemaVersion 2 and every later
 * content loop on it runs template-aware. Unknown/absent templateId keeps
 * the exact v1 behaviour.
 */
/**
 * Stages a+b as a reusable phase: intent extraction -> QA/refine -> retrieval ->
 * context file -> QA/refine. Used by startContentPipeline AND regenerateAngles
 * (the angles station's "regenerate with an edited prompt").
 */
async function runIntentAndResearch({ ctx, runId, cleaned, override = null }) {
  const { db, bus, egress, harness } = ctx;
  // stage a: keyword-intent
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'keyword-intent',
    agent: 'keyword-intent', skill: 'extract_keywords', type: 'stage_start',
    payload: { promptLength: cleaned.length }
  });
  harness.validateHandoff({
    runId, project: PROJECT, pipeline: PIPELINE,
    fromStage: 'prompt-intake', toStage: 'keyword-intent',
    fromAgent: 'user', toAgent: 'keyword-intent',
    payload: { summary: cleaned.slice(0, 200), prompt: cleaned }
  });
  const intent = await extractIntent({ egress, runId, prompt: cleaned });
  if (override) intent.topic = override; // user's correction is authoritative
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'keyword-intent',
    agent: 'keyword-intent', skill: 'extract_keywords', type: 'stage_end',
    payload: { topic: intent.topic, core: intent.core, expanded: intent.expanded, contentShape: intent.contentShape }
  });

  // ── context-refiner boundary 1: after intent, before research ────────────
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'context-refine',
    agent: 'context-refiner', skill: 'refine_context', type: 'stage_start',
    payload: { forStage: 'research' }
  });
  const qaIntent = await qaStage({
    egress, runId, pipeline: PIPELINE, stage: 'keyword-intent', artifact: intent,
    checks: [
      { name: 'has-topic', fn: (a) => typeof a.topic === 'string' && a.topic.trim().length > 0 },
      { name: 'has-core-keywords', fn: (a) => Array.isArray(a.core) && a.core.length > 0 }
    ]
  });
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'stage-qa',
    agent: 'stage-qa', skill: 'qa_stage', type: 'stage_end',
    payload: { qaStage: 'keyword-intent', ok: qaIntent.ok, score: qaIntent.score, problems: qaIntent.problems }
  });
  const { context: refinedIntent, notes: intentRefinerNotes } =
    await refineContext({ egress, runId, pipeline: PIPELINE, stage: 'research', context: intent });
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'context-refine',
    agent: 'context-refiner', skill: 'refine_context', type: 'stage_end',
    payload: { notes: intentRefinerNotes, forStage: 'research' }
  });
  // overseer: review the keyword-intent stage's outbound prompting (non-blocking)
  overseeStage(ctx, { runId, stage: 'keyword-intent', topic: intent.topic });

  // stage b: research → context file
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'research',
    agent: 'rag-research', skill: 'retrieve_articles', type: 'stage_start',
    payload: { keywords: [...refinedIntent.core, ...refinedIntent.expanded] }
  });
  harness.validateHandoff({
    runId, project: PROJECT, pipeline: PIPELINE,
    fromStage: 'keyword-intent', toStage: 'research',
    fromAgent: 'keyword-intent', toAgent: 'rag-research',
    payload: {
      summary: `intent for "${refinedIntent.topic}": ${refinedIntent.core.length} core + ${refinedIntent.expanded.length} expanded keywords`,
      intent: refinedIntent
    }
  });
  const articles = retrieve(db, [...refinedIntent.core, ...refinedIntent.expanded], { limit: RETRIEVAL_LIMIT });
  const grounded = articles.length > 0;
  const contextFile = grounded
    ? await buildContextFile({ db, egress, runId, topic: refinedIntent.topic, keywords: refinedIntent.core, articles })
    : await buildUngroundedContextFile({ egress, runId, intent: refinedIntent });
  // the intent agent saw the raw prompt; keep its shape detection when the
  // research synthesis did not set one
  if (!contextFile.keywords.contentShape && refinedIntent.contentShape) {
    contextFile.keywords.contentShape = refinedIntent.contentShape;
  }
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'research',
    agent: 'rag-research', skill: 'synthesize_context', type: 'stage_end',
    payload: { contextId: contextFile.contextId, grounded, sources: contextFile.sources.length, angles: contextFile.angles.length }
  });
  harness.validateHandoff({
    runId, project: PROJECT, pipeline: PIPELINE,
    fromStage: 'research', toStage: 'content-loop',
    fromAgent: 'rag-research', toAgent: 'content-generator',
    payload: {
      summary: `context ${contextFile.contextId}: ${contextFile.sources.length} sources, ${contextFile.angles.length} angles (grounded=${grounded})`,
      contextId: contextFile.contextId, grounded
    }
  });

  // ── context-refiner boundary 2: after context file, before content loop ──
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'context-refine',
    agent: 'context-refiner', skill: 'refine_context', type: 'stage_start',
    payload: { forStage: 'content-loop' }
  });
  const qaCtxFile = await qaStage({
    egress, runId, pipeline: PIPELINE, stage: 'research', artifact: contextFile,
    checks: [
      { name: 'has-synthesis', fn: (a) => typeof a.synthesis === 'string' && a.synthesis.trim().length >= 200 },
      { name: 'has-angles', fn: (a) => Array.isArray(a.angles) && a.angles.length >= 3 }
    ]
  });
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'stage-qa',
    agent: 'stage-qa', skill: 'qa_stage', type: 'stage_end',
    payload: { qaStage: 'research', ok: qaCtxFile.ok, score: qaCtxFile.score, problems: qaCtxFile.problems }
  });
  // Refine only topic/keywords that flow into the content loop.
  // doc.contextFile keeps the original full internal record (synthesis, sources — never shown to clients).
  const { context: refinedCtx, notes: ctxRefinerNotes } =
    await refineContext({ egress, runId, pipeline: PIPELINE, stage: 'content-loop', context: {
      topic: contextFile.topic,
      keywords: contextFile.keywords
    } });
  bus.emit({
    runId, project: PROJECT, pipeline: PIPELINE, stage: 'context-refine',
    agent: 'context-refiner', skill: 'refine_context', type: 'stage_end',
    payload: { notes: ctxRefinerNotes, forStage: 'content-loop' }
  });
  // overseer: review the research stage's outbound prompting (non-blocking)
  overseeStage(ctx, { runId, stage: 'research', topic: contextFile.topic });

  // Apply refinement hints back to the contextFile that rides into the content loop
  // (only topic and keywords — synthesis/sources/angles are research outputs, not refined)
  const contextFileForLoop = {
    ...contextFile,
    topic: refinedCtx.topic ?? contextFile.topic,
    keywords: refinedCtx.keywords ?? contextFile.keywords
  };

  return { intent, contextFile, contextFileForLoop, grounded };
}

export async function startContentPipeline({ ctx, prompt, templateId = null, topicOverride = null }) {
  const { db, harness } = ctx;
  const cleaned = String(prompt || '').trim();
  if (!cleaned) throw codedError('prompt must be a non-empty string', 'INVALID_PROMPT', 400);
  // topicOverride (I1): the user corrected the interpreted topic. Intent still
  // runs (keywords/shape), but the override replaces intent.topic before
  // ANYTHING consumes it (events, retrieval framing, context file, learning).
  let override = null;
  if (topicOverride !== null && topicOverride !== undefined) {
    const trimmed = typeof topicOverride === 'string' ? topicOverride.trim() : '';
    if (!trimmed || trimmed.length > 120) {
      throw codedError('topicOverride must be a non-empty string of at most 120 characters', 'INVALID_TOPIC_OVERRIDE', 400);
    }
    override = trimmed.toLowerCase();
  }
  const template = templateId ? getTemplateV2(templateId) : null;

  const runId = newRunId('poster');
  const posterId = randomUUID();

  const { intent, contextFile, contextFileForLoop, grounded } =
    await runIntentAndResearch({ ctx, runId, cleaned, override });

  const now = new Date().toISOString();
  const doc = {
    prompt: cleaned, runId, phase: 'angles', grounded,
    contextId: contextFile.contextId,
    contextFile: contextFileForLoop, // refined topic/keywords flow forward; synthesis/sources/angles unchanged
    intent,                          // ORIGINAL intent — historical record
    selectedAngleIds: null,
    content: null,
    reviewHistory: [],
    snapshots: []
  };
  if (template) {
    doc.templateId = template.id; // template-first (D2): chosen BEFORE content generation
    doc.schemaVersion = 2;
  }
  db.prepare('INSERT INTO posters (poster_id, name, status, created_at, updated_at, doc) VALUES (?, ?, ?, ?, ?, ?)')
    .run(posterId, `${contextFile.topic} poster`, 'draft', now, now, JSON.stringify(doc));

  // harness checkpoint (spec §B.9 rollback): the override console can restore
  // the poster doc to this exact post-research state. Snapshot stays internal.
  harness.checkpoint(runId, 'after-research', { posterId, doc: structuredClone(doc) });

  return safeState({ poster_id: posterId, name: `${contextFile.topic} poster`, status: 'draft' }, doc);
}

/**
 * Angles-station regenerate (I5): re-run intent + research with an optionally
 * EDITED prompt and replace the poster's context file + angles in place. The
 * poster keeps its id/runId; phase stays 'angles' so the user just picks again.
 */
export function regenerateAngles(args) {
  return withPosterLock(args.posterId, () => regenerateAnglesUnlocked(args));
}

async function regenerateAnglesUnlocked({ ctx, posterId, prompt = null }) {
  const { db, bus, harness } = ctx;
  const { row, doc } = loadPoster(db, posterId);
  if (doc.phase !== 'angles') {
    throw codedError(`Cannot regenerate angles: poster is in phase "${doc.phase}" (requires angles)`, 'WRONG_PHASE', 409);
  }
  const cleaned = String(prompt ?? doc.prompt ?? '').trim();
  if (!cleaned) throw codedError('prompt must be a non-empty string', 'INVALID_PROMPT', 400);

  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'research',
    agent: 'user', skill: 'regenerate_angles', type: 'user_action',
    payload: { posterId, promptEdited: cleaned !== doc.prompt }
  });
  const { intent, contextFile, contextFileForLoop, grounded } =
    await runIntentAndResearch({ ctx, runId: doc.runId, cleaned });

  doc.prompt = cleaned;
  doc.intent = intent;
  doc.grounded = grounded;
  doc.contextId = contextFile.contextId;
  doc.contextFile = contextFileForLoop;
  doc.selectedAngleIds = null;
  savePoster(db, posterId, { doc });
  harness.checkpoint(doc.runId, 'after-research', { posterId, doc: structuredClone(doc) });
  return safeState(row, doc);
}

/**
 * Stage d (return-to-user point 2): the user picked angleIds (array) or 'ai';
 * runs the 95-gate content loop and returns {phase:'content-approval'}.
 */
export function chooseAngles(args) {
  return withPosterLock(args.posterId, () => chooseAnglesUnlocked(args));
}

async function chooseAnglesUnlocked({ ctx, posterId, angleIds }) {
  const { db, bus, harness } = ctx;
  const { row, doc } = loadPoster(db, posterId);
  requirePhase(doc, ['angles'], 'choose angles');

  if (angleIds !== 'ai') {
    const known = new Set(doc.contextFile.angles.map((a) => a.id));
    const valid = Array.isArray(angleIds) && angleIds.length > 0 && angleIds.every((id) => typeof id === 'string' && known.has(id));
    if (!valid) {
      throw codedError(`angleIds must be 'ai' or a non-empty array of known angle ids (${[...known].join(', ')})`, 'INVALID_ANGLES', 400);
    }
  }
  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'angle-selection',
    agent: 'user', skill: 'select_angles', type: 'user_action',
    payload: { posterId, angleIds }
  });

  doc.selectedAngleIds = angleIds;
  // Reroute adjustments (Phase O6): an 'after-research' reroute stores the
  // agent's adjustments on the doc; the NEXT content loop consumes them as
  // seed feedback exactly once (deleted here, persisted by the save below).
  const seedFeedback = [];
  if (typeof doc.pendingAdjustments === 'string' && doc.pendingAdjustments.trim()) {
    seedFeedback.push({
      attempt: 0,
      feedback: `The user previously rerouted this poster back to angle selection. Adjustments to apply: ${fenceUserText(doc.pendingAdjustments.trim())}`,
      expected: 'A draft that applies these adjustments while still passing the 95 gate.'
    });
  }
  delete doc.pendingAdjustments;
  const { content, reviewHistory } = await runContentLoop({
    ctx, runId: doc.runId, contextFile: doc.contextFile,
    selectedAngles: resolveSelectedAngles(doc), userPrompt: doc.prompt,
    seedFeedback, templateId: doc.templateId
  });

  // ── stage-qa boundary 3: after content loop passes ───────────────────────
  const qaContent = await qaStage({
    egress: ctx.egress, runId: doc.runId, pipeline: PIPELINE, stage: 'content-loop',
    artifact: content,
    checks: [
      { name: 'has-headline', fn: (a) => typeof a.headline === 'string' && a.headline.trim().length > 0 },
      { name: 'has-3-or-more-blocks', fn: (a) => {
          const msgs = Array.isArray(a.messages) ? a.messages : (Array.isArray(a.blocks) ? a.blocks : []);
          return msgs.length >= 3;
        }
      }
    ]
  });
  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'stage-qa',
    agent: 'stage-qa', skill: 'qa_stage', type: 'stage_end',
    payload: { qaStage: 'content-loop', ok: qaContent.ok, score: qaContent.score, problems: qaContent.problems }
  });
  // context-refiner at this boundary: content is already finalized by the 95-gate;
  // emit events for pipeline theater visibility (passthrough — no model call needed).
  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'context-refine',
    agent: 'context-refiner', skill: 'refine_context', type: 'stage_start',
    payload: { forStage: 'user-approval' }
  });
  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'context-refine',
    agent: 'context-refiner', skill: 'refine_context', type: 'stage_end',
    payload: { notes: 'passthrough', forStage: 'user-approval' }
  });
  // overseer: review the content-loop stage's outbound prompting (non-blocking)
  overseeStage(ctx, { runId: doc.runId, stage: 'content-loop', topic: doc.contextFile.topic });

  doc.content = content;
  doc.reviewHistory = reviewHistory;
  doc.phase = 'content-approval';
  pushSnapshot(doc, { content, reviewHistory });
  savePoster(db, posterId, { doc });
  // harness checkpoint (spec §B.9 rollback): restore point right after the
  // content loop passed the 95 gate.
  harness.checkpoint(doc.runId, 'after-content', { posterId, doc: structuredClone(doc) });
  return safeState(row, doc);
}

/**
 * User approval (spec §B.5): records approval learning per selected angle so
 * future runs on this topic prefer what users actually signed off on.
 * Status transition: draft → content-approved.
 */
export function approveContent(args) {
  return withPosterLock(args.posterId, () => approveContentUnlocked(args));
}

function approveContentUnlocked({ ctx, posterId }) {
  const { db, bus } = ctx;
  const { row, doc } = loadPoster(db, posterId);
  requirePhase(doc, ['content-approval'], 'approve content');

  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'user-approval',
    agent: 'user', skill: 'approve_content', type: 'user_action',
    payload: { posterId, headline: doc.content.headline }
  });
  const selected = resolveSelectedAngles(doc);
  if (selected && selected.length) {
    for (const angle of selected) {
      recordLearning(db, bus, doc.runId, {
        kind: 'approval', topic: doc.contextFile.topic, angle: angle.title,
        detail: { posterId, angleId: angle.id, headline: doc.content.headline, format: doc.content.format, ...templateDetail(doc) }
      });
    }
  } else {
    recordLearning(db, bus, doc.runId, {
      kind: 'approval', topic: doc.contextFile.topic, angle: null,
      detail: { posterId, angleId: 'ai-decides', headline: doc.content.headline, format: doc.content.format, ...templateDetail(doc) }
    });
  }

  doc.phase = 'approved';
  savePoster(db, posterId, { status: 'content-approved', doc });
  return safeState({ ...row, status: 'content-approved' }, doc);
}

/**
 * "Ask AI to regenerate" (spec §B.5 path 2): the presented draft is treated
 * as a user rejection (spec §B.12 learns from rejections), the reviewer
 * feedback trail plus the rejected headline are surfaced to the regeneration
 * pass, and any optional user prompt is appended. Context is never lost.
 */
export function regenerateContent(args) {
  return withPosterLock(args.posterId, () => regenerateContentUnlocked(args));
}

async function regenerateContentUnlocked({ ctx, posterId, prompt = '' }) {
  const { db, bus } = ctx;
  const { row, doc } = loadPoster(db, posterId);
  requirePhase(doc, ['content-approval'], 'regenerate content');
  const extra = String(prompt || '').trim();

  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'user-approval',
    agent: 'user', skill: 'request_regeneration', type: 'user_action',
    payload: { posterId, hasPrompt: Boolean(extra) }
  });
  recordLearning(db, bus, doc.runId, {
    kind: 'rejection', topic: doc.contextFile.topic, angle: null,
    detail: { posterId, reason: 'user requested regeneration', headline: doc.content.headline, format: doc.content.format, ...templateDetail(doc) }
  });

  const seedFeedback = [{
    attempt: 0,
    feedback: `The user rejected the previous accepted draft (headline: "${doc.content.headline}") and asked for a fresh take.` +
      (extra ? ` User instructions: ${fenceUserText(extra)}` : ' No further instructions — produce a noticeably different draft.') +
      priorTrailNote(doc.reviewHistory),
    expected: 'A noticeably different draft (different headline and framing) that still passes the 95 gate.'
  }];
  const { content, reviewHistory } = await runContentLoop({
    ctx, runId: doc.runId, contextFile: doc.contextFile,
    selectedAngles: resolveSelectedAngles(doc),
    userPrompt: extra ? `${doc.prompt}\n\nADDITIONAL USER INSTRUCTIONS: ${extra}` : doc.prompt,
    seedFeedback, templateId: doc.templateId
  });
  doc.content = content;
  doc.reviewHistory = reviewHistory;
  pushSnapshot(doc, { content, reviewHistory, trigger: 'regenerate' });
  savePoster(db, posterId, { doc });
  return safeState(row, doc);
}

/** Reviewer feedback from the previous loop, surfaced into the next one. */
function priorTrailNote(reviewHistory) {
  const reworks = (reviewHistory || []).filter((h) => h.status === 'rework' && h.feedback);
  if (!reworks.length) return '';
  return ` Reviewer feedback from the previous loop (still applies): ${reworks.map((h) => h.feedback).join(' | ')}`;
}

/**
 * User feedback path (spec §B.5 path 3): the remark re-enters the quality
 * loop as a priorFeedback entry, so the generator addresses it directly and
 * the reviewer still enforces the gate.
 */
export function submitUserFeedback(args) {
  return withPosterLock(args.posterId, () => submitUserFeedbackUnlocked(args));
}

async function submitUserFeedbackUnlocked({ ctx, posterId, feedback }) {
  const { db, bus } = ctx;
  const { row, doc } = loadPoster(db, posterId);
  requirePhase(doc, ['content-approval'], 'submit feedback');
  const text = String(feedback || '').trim();
  if (!text) throw codedError('feedback must be a non-empty string', 'INVALID_FEEDBACK', 400);

  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'user-approval',
    agent: 'user', skill: 'give_feedback', type: 'user_action',
    payload: { posterId, feedback: text.slice(0, 400) }
  });
  recordLearning(db, bus, doc.runId, {
    kind: 'feedback', topic: doc.contextFile.topic, angle: null,
    detail: { posterId, feedback: text, headline: doc.content.headline, ...templateDetail(doc) }
  });

  const seedFeedback = [{
    attempt: 0,
    feedback: `USER FEEDBACK on the previous draft (headline: "${doc.content.headline}"): ${fenceUserText(text)}` + priorTrailNote(doc.reviewHistory),
    expected: 'A revision that directly addresses the user feedback while still passing the 95 gate.'
  }];
  const { content, reviewHistory } = await runContentLoop({
    ctx, runId: doc.runId, contextFile: doc.contextFile,
    selectedAngles: resolveSelectedAngles(doc), userPrompt: doc.prompt, seedFeedback,
    templateId: doc.templateId
  });
  doc.content = content;
  doc.reviewHistory = reviewHistory;
  pushSnapshot(doc, { content, reviewHistory, trigger: 'user-feedback' });
  savePoster(db, posterId, { doc });
  return safeState(row, doc);
}

/**
 * Inline edit (spec §B.5): the user's edit is applied VERBATIM — shape is
 * validated (schema integrity) but wording is not judged and NOT re-reviewed;
 * the user has the final word. Edit-learning runs fire-and-forget so the
 * response is immediate; failures are logged, never surfaced (learning is
 * best-effort and affects future runs only).
 */
export function inlineEdit(args) {
  return withPosterLock(args.posterId, () => inlineEditUnlocked(args));
}

function inlineEditUnlocked({ ctx, posterId, content }) {
  const { db, bus, egress } = ctx;
  const { row, doc } = loadPoster(db, posterId);
  requirePhase(doc, ['content-approval', 'approved'], 'edit content');

  // v2 fork: template-first docs shape-validate against the template's own
  // contentSchema (blocks, not messages); word caps stay off — the user has
  // the final word on wording either way.
  const template = doc.templateId ? getTemplateV2(doc.templateId) : null;
  const problems = template
    ? validateContentAgainstSchema(content, template.contentSchema, { enforceLengths: false })
    : validatePosterContent(content, { enforceLengths: false });
  if (problems.length) {
    throw codedError(`content shape invalid: ${problems.join('; ')}`, 'INVALID_CONTENT', 400);
  }
  const before = doc.content;
  const after = template ? normalizeContentV2(content, template.contentSchema) : normalizePosterContent(content);

  bus.emit({
    runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'inline-edit',
    agent: 'user', skill: 'inline_edit', type: 'user_action',
    payload: { posterId, headline: after.headline }
  });
  pushSnapshot(doc, { content: before, trigger: 'inline-edit-before' });
  doc.content = after; // verbatim — no re-review
  savePoster(db, posterId, { doc });

  // fire-and-forget: learning must never delay or fail the user's edit
  learnFromEdit({ egress, db, runId: doc.runId, before, after, topic: doc.contextFile.topic })
    .then((result) => {
      if (result.meaningful) {
        bus.emit({
          runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'edit-learning',
          agent: 'edit-learning', skill: 'store_learning', type: 'memory_write',
          payload: { posterId, learningId: result.learningId, changeType: result.changeType }
        });
      }
    })
    .catch((err) => {
      console.error('[edit-learning] failed (edit already applied):', err);
      try {
        bus.emit({
          runId: doc.runId, project: PROJECT, pipeline: PIPELINE, stage: 'edit-learning',
          agent: 'edit-learning', skill: 'store_learning', type: 'error',
          payload: { posterId, code: err.code || 'EDIT_LEARNING_FAILED' }
        });
      } catch { /* bus failure must not crash the fire-and-forget chain */ }
    });

  return safeState(row, doc);
}

/** Current safe state for a poster (GET). */
export function getPipelineState({ ctx, posterId }) {
  const { row, doc } = loadPoster(ctx.db, posterId);
  return safeState(row, doc);
}
