// Reroute tests (Phase O6, plan D4): agent output validation + repair retry +
// REROUTE_INVALID; suggestForPoster builds a SAFE doc summary (no contextFile
// internals in the prompt) and lists real checkpoints; executeReroute
// 'after-content' restores the doc snapshot and re-runs the loop with the
// adjustments in the prompt; 'after-research' stores pendingAdjustments that
// the next chooseAngles consumes exactly once; unknown checkpoint → 400;
// learning rows (capped feedback) + buildLearningHints reroute branch
// (fenced); 'after-design'/'after-images' checkpoints actually created by
// their pipelines; the two routes' request/response shapes over HTTP.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { newRunId } from '#shared';
import { createAppContext } from '../../backend/app-context.js';
import { createServer } from '../../backend/server.js';
import { suggestReroute } from '../../agents/reroute.js';
import {
  startContentPipeline, chooseAngles, submitUserFeedback, buildLearningHints
} from '../../pipelines/content_pipeline.js';
import { runDesignPipeline } from '../../pipelines/design_pipeline.js';
import { generateForSlot } from '../../pipelines/image_pipeline.js';
import { suggestForPoster, executeReroute, buildDocSummary } from '../../pipelines/reroute_pipeline.js';
import { REROUTE_SYSTEM, REROUTE_PROMPT_VERSION } from '../../agents/prompts/reroute_prompts.js';
import {
  FakeEgress, seedArticles, INTENT_OUTPUT, CONTEXT_OUTPUT, DESIGN_SPEC,
  POSTER_CONTENT, POSTER_CONTENT_V2, ACCEPT_REVIEW,
  IMAGE_BASE64, IMAGE_VISION_OUTPUT
} from './helpers/fake_egress.js';

const BASE_HANDLERS = {
  'keyword-intent': INTENT_OUTPUT,
  'rag-research/synthesize_context': CONTEXT_OUTPUT
};

const REROUTE_SUGGESTION = {
  checkpoint: 'after-content',
  reasoning: 'The user wants more takeaway points; the research and chosen angle still fit, so only the written content needs another pass.',
  adjustments: 'Increase the number of message blocks and keep every message under ten words.'
};

function makeCtx(egress) {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-reroute-'));
  const ctx = createAppContext({
    dataDir, logDir: join(dataDir, 'runs'), dbPath: join(dataDir, 'test.sqlite'), egress
  });
  seedArticles(ctx.db);
  return { ctx, dataDir };
}

/** start → chooseAngles: poster with 'after-research' + 'after-content' checkpoints. */
async function contentApprovedPoster(ctx, { angleIds = ['angle-1'] } = {}) {
  const start = await startContentPipeline({ ctx, prompt: 'stop phishing emails' });
  const state = await chooseAngles({ ctx, posterId: start.posterId, angleIds });
  return { posterId: start.posterId, runId: start.runId, state };
}

// ── agent: validation + repair retry + REROUTE_INVALID ──────────────────────

test('suggestReroute: valid output passes through trimmed', async () => {
  const egress = new FakeEgress({
    'reroute/suggest_reroute': {
      checkpoint: 'after-images',
      reasoning: '  The user only dislikes the picture, everything else was praised.  ',
      adjustments: '  Use a calmer illustration without people.  '
    }
  });
  const out = await suggestReroute({
    egress, runId: 'run-r1', feedback: 'the picture is scary',
    docSummary: { phase: 'designed', hasImages: true, hasDesign: true }
  });
  assert.deepEqual(out, {
    checkpoint: 'after-images',
    reasoning: 'The user only dislikes the picture, everything else was praised.',
    adjustments: 'Use a calmer illustration without people.'
  });
  assert.equal(egress.calls.length, 1);
});

test('suggestReroute: invalid first response is repaired with one retry', async () => {
  const egress = new FakeEgress({
    'reroute/suggest_reroute': [
      { checkpoint: 'after-editing', reasoning: 'too short', adjustments: '' }, // all three invalid
      REROUTE_SUGGESTION
    ]
  });
  const out = await suggestReroute({
    egress, runId: 'run-r2', feedback: 'I want more points', docSummary: { phase: 'content-approval' }
  });
  assert.equal(out.checkpoint, 'after-content');
  assert.equal(egress.calls.length, 2);
  const repairPrompt = egress.calls[1].opts.user;
  assert.match(repairPrompt, /previous response was invalid/);
  assert.match(repairPrompt, /"checkpoint" must be one of/);
  assert.match(repairPrompt, /"reasoning" must be a string of at least 20/);
  assert.match(repairPrompt, /"adjustments" must be a string of at least 10/);
});

test('suggestReroute: invalid twice → REROUTE_INVALID', async () => {
  const egress = new FakeEgress({ 'reroute/suggest_reroute': () => ({ checkpoint: 'nope' }) });
  await assert.rejects(
    suggestReroute({ egress, runId: 'run-r3', feedback: 'bad poster', docSummary: { phase: 'angles' } }),
    (err) => err.code === 'REROUTE_INVALID'
  );
  assert.equal(egress.calls.length, 2);
});

// ── suggestForPoster: safe summary + real checkpoints ───────────────────────

test('suggestForPoster: prompt carries the SAFE doc summary only (no contextFile internals) and lists real checkpoints', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [POSTER_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW],
    'reroute/suggest_reroute': REROUTE_SUGGESTION
  });
  const { ctx } = makeCtx(egress);
  const { posterId } = await contentApprovedPoster(ctx);

  const out = await suggestForPoster({ ctx, posterId, feedback: 'I want more points on the poster' });
  assert.deepEqual(out.suggestion, REROUTE_SUGGESTION);
  // only the checkpoints this run actually reached (no design/images yet)
  assert.deepEqual(out.availableCheckpoints, ['after-research', 'after-content']);

  const prompt = egress.callsFor('reroute')[0].opts.user;
  // summary fields present…
  assert.match(prompt, /"phase": "content-approval"/);
  assert.ok(prompt.includes(`"headline": "${POSTER_CONTENT.headline}"`));
  assert.match(prompt, /"blockCount": 4/);
  assert.match(prompt, /"hasDesign": false/);
  // …but NEVER contextFile internals
  assert.ok(!prompt.includes(CONTEXT_OUTPUT.synthesis.slice(0, 40)), 'contextFile.synthesis leaked into the reroute prompt');
  assert.ok(!prompt.includes('Proofpoint'), 'source attribution leaked into the reroute prompt');
  assert.ok(!prompt.includes('contextFile'), 'raw doc internals leaked into the reroute prompt');
  // user feedback rides fenced
  assert.ok(prompt.includes('<user_text>I want more points on the poster</user_text>'));
});

test('buildDocSummary: exact safe shape for a designed poster with a filled slot', () => {
  const doc = {
    phase: 'designed', templateId: null,
    contextFile: { topic: 'phishing', synthesis: 'SECRET', sources: [{ url: 'x' }] },
    content: { headline: 'Pause Before You Scan', messages: [{ text: 'a' }, { text: 'b' }] },
    design: {
      canvas: {
        objects: [
          { layerRole: 'image', slotId: 'slot-1' },
          { layerRole: 'image-slot', slotId: 'slot-2' },
          { layerRole: 'headline' }
        ]
      }
    }
  };
  assert.deepEqual(buildDocSummary(doc), {
    templateId: null, style: null, phase: 'designed',
    headline: 'Pause Before You Scan', blockCount: 2,
    imageSlotCount: 2, hasImages: true, hasDesign: true
  });
});

// ── executeReroute: after-content ────────────────────────────────────────────

test('executeReroute after-content: restores the checkpoint doc and re-runs the loop with adjustments in the prompt', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [POSTER_CONTENT, POSTER_CONTENT_V2, POSTER_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW, ACCEPT_REVIEW, ACCEPT_REVIEW]
  });
  const { ctx } = makeCtx(egress);
  const { posterId } = await contentApprovedPoster(ctx); // content = POSTER_CONTENT (checkpointed)
  // mutate past the checkpoint so the restore is observable
  await submitUserFeedback({ ctx, posterId, feedback: 'shorter please' }); // content = POSTER_CONTENT_V2

  const out = await executeReroute({
    ctx, posterId, checkpoint: 'after-content',
    adjustments: 'Add two more RED FLAG messages about voice phishing.',
    feedback: 'I want more points'
  });
  assert.equal(out.reroutedTo, 'after-content');
  assert.equal(out.adjustments, 'Add two more RED FLAG messages about voice phishing.');
  assert.equal(out.state.phase, 'content-approval');
  assert.equal(out.state.content.headline, POSTER_CONTENT.headline);

  // the re-run generator prompt saw the RESTORED draft (checkpoint headline,
  // not the post-feedback V2 one) + the fenced adjustments and feedback
  const rerunPrompt = egress.callsFor('content-generator')[2].opts.user;
  assert.ok(rerunPrompt.includes(POSTER_CONTENT.headline), 'seed must reference the restored checkpoint draft');
  assert.ok(!rerunPrompt.includes(POSTER_CONTENT_V2.headline), 'post-checkpoint draft must be gone after restore');
  assert.ok(rerunPrompt.includes('<user_text>Add two more RED FLAG messages about voice phishing.</user_text>'));
  assert.ok(rerunPrompt.includes('<user_text>I want more points</user_text>'));

  // persisted doc follows the same savePoster discipline (status + doc JSON)
  const row = ctx.db.prepare('SELECT status, doc FROM posters WHERE poster_id = ?').get(posterId);
  assert.equal(row.status, 'draft');
  const doc = JSON.parse(row.doc);
  assert.equal(doc.phase, 'content-approval');
  assert.equal(doc.content.headline, POSTER_CONTENT.headline);
  assert.equal(doc.contextFile.topic, 'phishing'); // internals restored intact
  // safe view still leaks nothing
  const s = JSON.stringify(out.state);
  assert.ok(!s.includes(CONTEXT_OUTPUT.synthesis.slice(0, 40)) && !s.includes('Proofpoint'));
});

// ── executeReroute: after-research + pendingAdjustments consumption ─────────

test('executeReroute after-research: back to angles; the NEXT chooseAngles consumes pendingAdjustments as seed feedback exactly once', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [POSTER_CONTENT, POSTER_CONTENT_V2],
    'content-reviewer': [ACCEPT_REVIEW, ACCEPT_REVIEW]
  });
  const { ctx } = makeCtx(egress);
  const { posterId } = await contentApprovedPoster(ctx);

  const out = await executeReroute({
    ctx, posterId, checkpoint: 'after-research',
    adjustments: 'Focus on QR codes only; drop the sign-in prompt angle.',
    feedback: 'wrong angle entirely'
  });
  assert.equal(out.reroutedTo, 'after-research');
  assert.equal(out.state.phase, 'angles');
  assert.equal(out.state.selectedAngleIds, null);
  assert.equal(out.state.content, null);
  const stored = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc);
  assert.equal(stored.pendingAdjustments, 'Focus on QR codes only; drop the sign-in prompt angle.');

  // user re-picks → the adjustments ride the loop as fenced seed feedback
  const state = await chooseAngles({ ctx, posterId, angleIds: ['angle-1'] });
  assert.equal(state.phase, 'content-approval');
  const rerunPrompt = egress.callsFor('content-generator')[1].opts.user;
  assert.ok(rerunPrompt.includes('<user_text>Focus on QR codes only; drop the sign-in prompt angle.</user_text>'));
  // consumed exactly once — gone from the saved doc
  const after = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc);
  assert.ok(!('pendingAdjustments' in after));
});

// ── executeReroute: validation ───────────────────────────────────────────────

test('executeReroute: unknown checkpoint name and missing checkpoint both → 400', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [POSTER_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW]
  });
  const { ctx } = makeCtx(egress);
  const { posterId } = await contentApprovedPoster(ctx);

  await assert.rejects(
    executeReroute({ ctx, posterId, checkpoint: 'after-editing', adjustments: 'anything concrete', feedback: 'nope' }),
    (err) => err.code === 'INVALID_CHECKPOINT' && err.status === 400
  );
  // valid label, but this run never designed → not in its checkpoint list
  await assert.rejects(
    executeReroute({ ctx, posterId, checkpoint: 'after-design', adjustments: 'anything concrete', feedback: 'nope' }),
    (err) => err.code === 'CHECKPOINT_NOT_FOUND' && err.status === 400
  );
  await assert.rejects(
    executeReroute({ ctx, posterId, checkpoint: 'after-content', adjustments: '', feedback: 'nope' }),
    (err) => err.code === 'INVALID_ADJUSTMENTS' && err.status === 400
  );
});

// ── learning: capped row + buildLearningHints branch ─────────────────────────

test('executed reroute writes a learning row kind reroute with feedback capped at 500 chars', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [POSTER_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW]
  });
  const { ctx } = makeCtx(egress);
  const { posterId, runId } = await contentApprovedPoster(ctx);

  const longFeedback = 'the poster completely misses what I asked for — '.repeat(20); // > 500 chars
  await executeReroute({
    ctx, posterId, checkpoint: 'after-research',
    adjustments: 'Center the poster on help-desk callback scams.', feedback: longFeedback
  });

  const row = ctx.db.prepare("SELECT * FROM learning WHERE kind = 'reroute'").get();
  assert.ok(row, 'reroute learning row written');
  assert.equal(row.topic, 'phishing');
  const detail = JSON.parse(row.detail);
  assert.equal(detail.feedback.length, 500);
  assert.equal(detail.feedback, longFeedback.slice(0, 500));
  assert.equal(detail.checkpoint, 'after-research');
  assert.equal(detail.adjustments, 'Center the poster on help-desk callback scams.');
  assert.equal(detail.templateId, null); // v1 poster
  assert.equal(detail.style, null);
  // memory_write event emitted on the run (payload is a JSON string in the mirror)
  const events = ctx.bus.eventsForRun(runId);
  assert.ok(events.some((e) => e.type === 'memory_write' && String(e.payload).includes('"kind":"reroute"')));
});

test('buildLearningHints surfaces the reroute hint, fenced', () => {
  const egress = new FakeEgress({});
  const { ctx } = makeCtx(egress);
  ctx.db.prepare('INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, ?, ?, ?, ?, ?)')
    .run(new Date().toISOString(), 'reroute', 'phishing', null,
      JSON.stringify({ feedback: 'too wordy', checkpoint: 'after-content', templateId: null, style: null, adjustments: 'Cut every message to eight words or fewer.' }), 1.0);

  const hints = buildLearningHints(ctx.db, 'phishing');
  assert.equal(hints.length, 1);
  assert.equal(hints[0],
    '<user_text>Past users with similar feedback needed: Cut every message to eight words or fewer. — consider it upfront.</user_text>');
});

// ── checkpoints created by the design + image pipelines ─────────────────────

// design/image scaffolding: poster with approved content (design tests' shape)
const APPROVED_CONTENT = {
  headline: 'Pause Before You Scan or Sign In',
  subheadline: 'Attackers copy real sign-in pages to capture what you type',
  messages: [
    { id: 'msg-1', label: 'RED FLAG', text: 'A QR code arriving by email instead of a plain link' },
    { id: 'msg-2', label: 'RED FLAG', text: 'A one-time code request on a page you did not open' },
    { id: 'msg-3', label: 'DO', text: 'Open the real site from your bookmarks, not the message' },
    { id: 'msg-4', label: 'DO', text: 'Report the message to the security team, do not reply' }
  ],
  callToAction: 'Report suspicious messages to {{SOC_EMAIL}}',
  format: 'red-flags'
};

function seedApprovedPoster(db) {
  const posterId = randomUUID();
  const runId = newRunId('poster');
  const now = new Date().toISOString();
  const doc = {
    prompt: 'warn about QR code phishing', runId, phase: 'approved', grounded: true,
    contextId: `ctx-${posterId}`,
    contextFile: {
      topic: 'phishing', keywords: { core: ['phishing'], expanded: [], contentShape: null },
      synthesis: 'internal synthesis text', angles: [], sources: []
    },
    intent: null, selectedAngleIds: 'ai',
    content: structuredClone(APPROVED_CONTENT), reviewHistory: [], snapshots: []
  };
  db.prepare('INSERT INTO posters (poster_id, name, status, created_at, updated_at, doc) VALUES (?, ?, ?, ?, ?, ?)')
    .run(posterId, 'phishing poster', 'content-approved', now, now, JSON.stringify(doc));
  return { posterId, runId };
}

test('design pipeline creates the after-design checkpoint; executeReroute after-design restores that state for the design station', async () => {
  const egress = new FakeEgress({});
  const { ctx } = makeCtx(egress);
  const { posterId, runId } = seedApprovedPoster(ctx.db);

  await runDesignPipeline({ ctx, posterId, mode: 'template', templateId: 'minimal-clean' });
  const labels = ctx.harness.getRunState(runId).checkpoints.map((c) => c.label);
  assert.ok(labels.includes('after-design'), 'design pipeline must checkpoint after-design');

  const out = await executeReroute({
    ctx, posterId, checkpoint: 'after-design',
    adjustments: 'Try a darker template with the messages in a single column.',
    feedback: 'layout looks cramped'
  });
  assert.equal(out.reroutedTo, 'after-design');
  // documented simpler-correct option: the restored snapshot IS the accepted
  // design; the design station re-runs with `adjustments` as its userPrompt
  assert.equal(out.state.phase, 'designed');
  assert.equal(out.state.status, 'designed');
  assert.equal(out.state.design.templateId, 'minimal-clean');
  assert.equal(out.adjustments, 'Try a darker template with the messages in a single column.');
});

/** designed poster with one image slot in the canvas (image tests' shape). */
function seedDesignedPoster(db) {
  const posterId = randomUUID();
  const runId = newRunId('poster');
  const now = new Date().toISOString();
  const slot = DESIGN_SPEC.imageSlots[0];
  const canvas = {
    version: '6.7.1', width: 1414, height: 2000, background: '#F5F0E8',
    objects: [
      {
        type: 'Rect', left: Math.round(slot.x * 1414 / 100), top: Math.round(slot.y * 2000 / 100),
        width: Math.round(slot.w * 1414 / 100), height: Math.round(slot.h * 2000 / 100),
        fill: 'transparent', stroke: '#1F1A17', strokeWidth: 3, strokeDashArray: [14, 10],
        rx: 16, ry: 16, opacity: 0.8,
        layerRole: 'image-slot', slotId: 'slot-1',
        slotSpec: { slotId: 'slot-1', styleHint: slot.styleHint }
      }
    ]
  };
  const doc = {
    prompt: 'phishing', runId, phase: 'designed', grounded: true,
    contextId: `ctx-${posterId}`,
    contextFile: {
      topic: 'phishing', keywords: { core: ['phishing'], expanded: [], contentShape: null },
      synthesis: 'internal', angles: [], sources: []
    },
    intent: null, selectedAngleIds: 'ai',
    content: structuredClone(APPROVED_CONTENT),
    design: {
      templateId: 'minimal-clean', templateSource: 'predefined',
      layoutType: null, rationale: null, layoutSpec: null,
      canvas, palette: { background: '#F5F0E8', primary: '#C8102E', accent: '#E3AF32', text: '#1F1A17' },
      fonts: { head: 'Montserrat', body: 'Inter' }, reviewHistory: [], designedAt: now
    },
    reviewHistory: [], snapshots: []
  };
  db.prepare('INSERT INTO posters (poster_id, name, status, created_at, updated_at, doc) VALUES (?, ?, ?, ?, ?, ?)')
    .run(posterId, 'phishing poster', 'designed', now, now, JSON.stringify(doc));
  return { posterId, runId };
}

test('image pipeline creates the after-images checkpoint; executeReroute after-images clears slot fills back to placeholders', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: IMAGE_BASE64, maskedPrompt: 'masked' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, dataDir } = makeCtx(egress);
  const { posterId, runId } = seedDesignedPoster(ctx.db);
  const assetsDir = join(dataDir, 'image-library', 'assets');

  const filled = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });
  assert.equal(filled.design.canvas.objects.find((o) => o.slotId === 'slot-1').type, 'Image');
  const labels = ctx.harness.getRunState(runId).checkpoints.map((c) => c.label);
  assert.ok(labels.includes('after-images'), 'image pipeline must checkpoint after-images');

  const out = await executeReroute({
    ctx, posterId, checkpoint: 'after-images',
    adjustments: 'Use a flat illustration of a QR code on a phone, cooler colors.',
    feedback: 'the image does not match the poster'
  });
  assert.equal(out.reroutedTo, 'after-images');
  assert.equal(out.state.phase, 'designed');
  // the fill is cleared: placeholder rect again, bounds + slotSpec preserved
  const slotObj = out.state.design.canvas.objects.find((o) => o.slotId === 'slot-1');
  assert.equal(slotObj.type, 'Rect');
  assert.equal(slotObj.layerRole, 'image-slot');
  assert.equal(slotObj.slotSpec.styleHint, DESIGN_SPEC.imageSlots[0].styleHint);
  assert.equal(slotObj.left, Math.round(DESIGN_SPEC.imageSlots[0].x * 1414 / 100));
  assert.ok(!('imageId' in slotObj) || !slotObj.imageId, 'assigned imageId must be gone');
  // persisted doc matches
  const stored = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc);
  assert.equal(stored.design.canvas.objects.find((o) => o.slotId === 'slot-1').layerRole, 'image-slot');
});

// ── routes: the two-shape contract the UI consumes ───────────────────────────

test('routes: POST /reroute/suggest and /reroute/execute round-trip; missing fields → 400', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [POSTER_CONTENT, POSTER_CONTENT_V2],
    'content-reviewer': [ACCEPT_REVIEW, ACCEPT_REVIEW],
    'reroute/suggest_reroute': REROUTE_SUGGESTION
  });
  const { ctx, dataDir } = makeCtx(egress);
  const { app, token } = createServer(ctx, { dataDir });
  const srv = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${srv.address().port}`;
  const req = (path, body) => fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
    body: JSON.stringify(body)
  });
  try {
    const { posterId } = await contentApprovedPoster(ctx);

    // suggest: {feedback} → {suggestion, availableCheckpoints}
    let res = await req(`/api/pipeline/${posterId}/reroute/suggest`, { feedback: 'I want more points' });
    assert.equal(res.status, 200);
    const suggested = await res.json();
    assert.deepEqual(suggested, {
      suggestion: REROUTE_SUGGESTION,
      availableCheckpoints: ['after-research', 'after-content']
    });

    // execute requires all three fields
    res = await req(`/api/pipeline/${posterId}/reroute/execute`, { feedback: 'I want more points' });
    assert.equal(res.status, 400);
    res = await req(`/api/pipeline/${posterId}/reroute/execute`, {
      feedback: 'I want more points', checkpoint: 'after-content'
    });
    assert.equal(res.status, 400);

    // execute: the client passes the suggestion fields back (no model re-call)
    res = await req(`/api/pipeline/${posterId}/reroute/execute`, {
      feedback: 'I want more points',
      checkpoint: suggested.suggestion.checkpoint,
      adjustments: suggested.suggestion.adjustments
    });
    assert.equal(res.status, 200);
    const executed = await res.json();
    assert.equal(executed.reroutedTo, 'after-content');
    assert.equal(executed.adjustments, REROUTE_SUGGESTION.adjustments);
    assert.equal(executed.state.phase, 'content-approval');
    assert.equal(executed.state.content.headline, POSTER_CONTENT_V2.headline);
    // exactly one reroute-agent call happened (suggest), none on execute
    assert.equal(egress.callsFor('reroute').length, 1);

    // unknown checkpoint over HTTP → 400 with the pipeline's code
    res = await req(`/api/pipeline/${posterId}/reroute/execute`, {
      feedback: 'x y z', checkpoint: 'after-nothing', adjustments: 'something concrete'
    });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'INVALID_CHECKPOINT' });
  } finally {
    srv.close();
  }
});

// ── panel I1: after-images reroute clears the LANDSCAPE canvas too ───────────

test('executeReroute after-images clears mirrored landscape fills (rejected images never survive in one orientation)', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: IMAGE_BASE64, maskedPrompt: 'masked' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, dataDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);
  const assetsDir = join(dataDir, 'image-library', 'assets');

  // give the design a landscape canvas carrying the same slot (v2 shape)
  const before = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc);
  const landscapeSlot = structuredClone(before.design.canvas.objects.find((o) => o.slotId === 'slot-1'));
  landscapeSlot.left = 1200; landscapeSlot.top = 100; // landscape geometry
  before.design.landscape = { canvas: { version: '6.7.1', width: 2000, height: 1414, background: '#F5F0E8', objects: [landscapeSlot] } };
  ctx.db.prepare('UPDATE posters SET doc = ? WHERE poster_id = ?').run(JSON.stringify(before), posterId);

  const filled = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });
  const landAfterFill = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc)
    .design.landscape.canvas.objects.find((o) => o.slotId === 'slot-1');
  assert.equal(landAfterFill.type, 'Image', 'fill must mirror into the landscape canvas');
  assert.equal(filled.design.canvas.objects.find((o) => o.slotId === 'slot-1').type, 'Image');

  await executeReroute({
    ctx, posterId, checkpoint: 'after-images',
    adjustments: 'Different illustration style, cooler palette please.',
    feedback: 'I reject these images entirely'
  });
  const stored = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc);
  const portraitSlot = stored.design.canvas.objects.find((o) => o.slotId === 'slot-1');
  const landSlot = stored.design.landscape.canvas.objects.find((o) => o.slotId === 'slot-1');
  assert.equal(portraitSlot.layerRole, 'image-slot', 'portrait fill cleared');
  assert.equal(landSlot.layerRole, 'image-slot', 'landscape fill cleared — rejected image must not survive');
  assert.equal(landSlot.left, 1200, 'landscape slot keeps its own geometry');
});

// ── I7 prompt sweep: routes by feedback subject, topic-general, no lone bias ──

test('I7: reroute system prompt routes by what the feedback is about, not the poster topic', () => {
  assert.match(REROUTE_SYSTEM, /any workplace topic/, 'framing must be topic-general');
  assert.match(REROUTE_SYSTEM, /never by the poster's subject/,
    'routing must be decoupled from the poster subject');
  for (const word of ['phishing', 'shield', 'padlock']) {
    assert.ok(!REROUTE_SYSTEM.toLowerCase().includes(word),
      `reroute prompt must not assume a "${word}" topic`);
  }
  assert.equal(REROUTE_PROMPT_VERSION, 2, 'reroute prompt version bumped');
});
