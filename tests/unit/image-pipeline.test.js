// Image pipeline tests (spec §B.7): generate→gate pass assigns slot + saves
// library record; gate fail→retry with feedback in 2nd prompt→pass; 3 fails →
// IMAGE_GATE_EXHAUSTED; library source with unchecked image runs gate once;
// pre-checked library image makes zero model calls; slot replacement preserves
// bounds + slotSpec; phase guard; unknown slot.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { newRunId } from '#shared';
import { createAppContext } from '../../backend/app-context.js';
import { saveImage, markZeroTextCheck } from '../../image-library/store.js';
import {
  FakeEgress, DESIGN_SPEC, IMAGE_BASE64, GEN_IMAGE_1024, IMAGE_VISION_OUTPUT, IMAGE_VISION_HAS_TEXT
} from './helpers/fake_egress.js';
import { generateForSlot, generateForSlots } from '../../pipelines/image_pipeline.js';
import { generateAsset, IMAGE_GENERATOR_PROMPT_VERSION } from '../../agents/image_generator.js';

// Approved poster content used in these tests
const APPROVED_CONTENT = {
  headline: 'Pause Before You Scan', subheadline: null,
  messages: [
    { id: 'msg-1', label: 'RED FLAG', text: 'A QR code arriving by email' },
    { id: 'msg-2', label: 'DO', text: 'Type the address yourself' }
  ],
  callToAction: 'Report to security', format: 'red-flags'
};

// eventsForRun returns persisted events whose payload is a JSON string; parse it
// so tests can inspect payload fields as objects.
function parseEventPayload(e) {
  if (e && typeof e.payload === 'string') {
    try { return { ...e, payload: JSON.parse(e.payload) }; } catch { /* leave as-is */ }
  }
  return e;
}

// Fresh app context + isolated assets dir per test
function makeCtx(egress) {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-img-pipeline-'));
  const ctx = createAppContext({
    dataDir, logDir: join(dataDir, 'runs'), dbPath: join(dataDir, 'test.sqlite'), egress
  });
  return { ctx, assetsDir: join(dataDir, 'image-library', 'assets') };
}

function seedDesignedPoster(db, { phase = 'designed', status = 'designed', landscape = null, bg = false } = {}) {
  const posterId = randomUUID();
  const runId = newRunId('poster');
  const now = new Date().toISOString();
  // Build a canvas with one image-slot object matching DESIGN_SPEC slot-1
  const slot = DESIGN_SPEC.imageSlots[0];
  const canvas = {
    version: '6.7.1', width: 1414, height: 2000, background: '#F5F0E8',
    objects: [
      // optional full-bleed background slot (rendered first) + a scrim + a
      // content object, so the bg fill can be exercised end-to-end
      ...(bg ? [
        {
          type: 'Rect', left: 0, top: 0, width: 1414, height: 2000,
          fill: 'transparent', stroke: '#E3AF32', strokeWidth: 3, strokeDashArray: [22, 16],
          rx: 0, ry: 0, opacity: 0.5,
          layerRole: 'image-slot', slotId: 'bg',
          slotSpec: { slotId: 'bg', styleHint: 'full-bleed futuristic ambient background, no text' }
        },
        { type: 'Rect', left: 0, top: 0, width: 1414, height: 840, fill: '#0D0C12', opacity: 0.45, layerRole: 'scrim' },
        { type: 'Textbox', left: 90, top: 110, width: 940, text: 'Pause', fontSize: 100, layerRole: 'headline' }
      ] : []),
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
  // v2 dual-orientation designs nest a landscape canvas; its slot (when
  // present) carries the LANDSCAPE geometry — the mirror must keep it.
  const landscapeDesign = landscape
    ? {
      landscape: {
        canvas: {
          version: '6.7.1', width: 2000, height: 1414, background: '#F5F0E8',
          objects: landscape === 'with-slot' ? [
            {
              type: 'Rect', left: 1650, top: 90, width: 260, height: 260,
              fill: 'transparent', stroke: '#1F1A17', strokeWidth: 3, strokeDashArray: [14, 10],
              rx: 16, ry: 16, opacity: 0.8,
              layerRole: 'image-slot', slotId: 'slot-1',
              slotSpec: { slotId: 'slot-1', styleHint: slot.styleHint }
            }
          ] : []
        }
      }
    }
    : {};
  const doc = {
    prompt: 'phishing', runId, phase, grounded: true,
    contextId: `ctx-${posterId}`,
    contextFile: {
      topic: 'phishing', keywords: { core: ['phishing'], expanded: [], contentShape: null },
      synthesis: 'internal', angles: [], sources: []
    },
    intent: null, selectedAngleIds: 'ai',
    content: APPROVED_CONTENT,
    design: {
      templateId: landscape ? 'timeline-journey' : 'minimal-clean',
      templateSource: landscape ? 'v2' : 'predefined',
      layoutType: null, rationale: null, layoutSpec: null,
      canvas, ...landscapeDesign,
      palette: { background: '#F5F0E8', primary: '#C8102E', accent: '#E3AF32', text: '#1F1A17' },
      fonts: { head: 'Montserrat', body: 'Inter' }, reviewHistory: [], designedAt: now
    },
    reviewHistory: [], snapshots: []
  };
  db.prepare('INSERT INTO posters (poster_id, name, status, created_at, updated_at, doc) VALUES (?, ?, ?, ?, ?, ?)')
    .run(posterId, 'phishing poster', status, now, now, JSON.stringify(doc));
  return { posterId, runId };
}

test('generate: pass on first attempt — slot replaced, library record saved, gate_check emitted', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'masked-prompt' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);
  const gateEvents = [];
  ctx.bus.subscribe((evt) => {
    if (evt.type === 'gate_check' && evt.payload?.gateName === 'imageZeroText') gateEvents.push(evt);
  });

  const state = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });

  // slot is replaced in canvas
  const slotObj = state.design.canvas.objects.find((o) => o.slotId === 'slot-1');
  assert.ok(slotObj, 'slot-1 object still in canvas');
  assert.equal(slotObj.type, 'Image', 'placeholder replaced with Image type');
  assert.ok(slotObj.src.includes('/api/images/file/'), 'src points to image serve route');
  assert.ok(slotObj.slotSpec, 'slotSpec preserved for future regeneration');
  assert.equal(slotObj.layerRole, 'image', 'layerRole updated to image');

  // library record saved with zero_text_passed=1
  const rows = ctx.db.prepare('SELECT * FROM images').all();
  assert.equal(rows.length, 1, 'one image saved to library');
  assert.equal(rows[0].origin, 'generated');
  assert.equal(rows[0].zero_text_checked, 1);
  assert.equal(rows[0].zero_text_passed, 1);

  // gate_check event emitted (threshold 100)
  assert.equal(gateEvents.length, 1, 'one imageZeroText gate_check event');
  assert.equal(gateEvents[0].payload.threshold, 100);
  assert.equal(gateEvents[0].verdict.status, 'accepted');
  assert.equal(state.phase, 'designed');
});

test('batch: generateForSlots fills multiple slots concurrently and reports per-slot results', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'm' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db, { bg: true }); // canvas has 'bg' + 'slot-1'

  const state = await generateForSlots({ ctx, posterId, slotIds: ['bg', 'slot-1'], assetsDir });

  const objs = state.design.canvas.objects;
  assert.equal(objs.find((o) => o.slotId === 'bg').type, 'Image', 'bg filled');
  assert.equal(objs.find((o) => o.slotId === 'slot-1').type, 'Image', 'slot-1 filled');
  assert.equal(state.batchResults.length, 2);
  assert.ok(state.batchResults.every((r) => r.ok), 'both slots ok');
  assert.equal(egress.callsFor('image-generator').length, 2, 'one generation per slot');
  // one save: both fills persisted in a single designed doc
  const doc = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc);
  assert.equal(doc.design.canvas.objects.filter((o) => o.layerRole === 'image').length, 2, 'both persisted');
});

test('aesthetic review is ADVISORY: a low score does NOT regenerate — one generation, verdict recorded, warning emitted', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': [
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a1' }
    ],
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT, // zero-text OK
    'image-quality-reviewer/review_aesthetics': [
      { score: 40, issues: 'flat and low detail' } // low aesthetic — must NOT trigger a retry
    ]
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);
  const aestheticEvents = [];
  const warnings = [];
  ctx.bus.subscribe((evt) => {
    if (evt.type === 'gate_check' && evt.payload?.gateName === 'imageAesthetic') aestheticEvents.push(evt);
    if (evt.type === 'rework' && evt.payload?.advisory) warnings.push(evt);
  });

  const state = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });

  // exactly ONE generation — advisory review never regenerates
  assert.equal(egress.callsFor('image-generator').length, 1, 'advisory aesthetic fail does NOT regenerate');
  // the review still ran once and recorded a verdict
  assert.equal(aestheticEvents.length, 1, 'one advisory imageAesthetic gate_check event');
  // a warning event was emitted with the advisory reason + score
  const w = warnings.map((e) => (typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload));
  assert.equal(w.length, 1, 'one advisory warning emitted');
  assert.equal(w[0].advisory, true);
  assert.equal(w[0].reason, 'aesthetic-review');
  assert.equal(w[0].score, 40);
  // the accepted render is assigned, and its meta carries the advisory verdict
  const slotObj = state.design.canvas.objects.find((o) => o.slotId === 'slot-1');
  assert.equal(slotObj.type, 'Image');
  const row = ctx.db.prepare('SELECT meta FROM images WHERE image_id = ?').get(slotObj.imageId);
  const meta = JSON.parse(row.meta);
  assert.equal(meta.advisoryReview.status, 'rework');
  assert.equal(meta.advisoryReview.score, 40);
});

// ── image boundary (Job B): stage-qa + context-refiner after slot fills ─────

test('image boundary: batch fill emits stage-qa + context-refiner events; non-blocking', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'm' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId, runId } = seedDesignedPoster(ctx.db, { bg: true });

  const state = await generateForSlots({ ctx, posterId, slotIds: ['bg', 'slot-1'], assetsDir });
  assert.ok(state.batchResults.every((r) => r.ok), 'fill succeeded');

  const events = ctx.bus.eventsForRun(runId).map(parseEventPayload);
  const qa = events.filter((e) => e.agent === 'stage-qa' && e.payload?.qaStage === 'slot-fill');
  const refiner = events.filter((e) => e.agent === 'context-refiner' && e.payload?.forStage === 'refine-editor');
  assert.equal(qa.length, 1, 'one stage-qa event at the image boundary');
  assert.equal(qa[0].payload.ok, true, 'all slots filled + assets zero-text-passed');
  assert.ok(refiner.some((e) => e.type === 'stage_start') && refiner.some((e) => e.type === 'stage_end'),
    'context-refiner start+end at the image boundary');
});

test('image boundary: single-slot fill fires the boundary only when it completes the LAST empty slot', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'm' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  // canvas has bg + slot-1 (two empty slots)
  const { posterId, runId } = seedDesignedPoster(ctx.db, { bg: true });

  // fill bg first — slot-1 still empty → NO boundary yet
  await generateForSlot({ ctx, posterId, slotId: 'bg', source: 'generate', assetsDir });
  let qa = ctx.bus.eventsForRun(runId).map(parseEventPayload).filter((e) => e.agent === 'stage-qa' && e.payload?.qaStage === 'slot-fill');
  assert.equal(qa.length, 0, 'no image boundary while a slot is still empty');

  // fill slot-1 — now every slot filled → boundary fires once
  await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });
  qa = ctx.bus.eventsForRun(runId).map(parseEventPayload).filter((e) => e.agent === 'stage-qa' && e.payload?.qaStage === 'slot-fill');
  assert.equal(qa.length, 1, 'image boundary fires once the last slot is filled');
});

// Client #2: a PALETTE advisory triggers ONE bounded corrective regeneration
// (the FORBIDDEN clause escalated to the first prompt line). This is IN ADDITION
// to the zero-text gate's 3-attempt loop, and strictly capped at 1 palette retry.
test('palette advisory: ONE bounded corrective regeneration with escalated FORBIDDEN clause; retry render adopted + tagged', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': [
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a1' }, // first render — off palette
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a2-corrected' } // palette-corrective render
    ],
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT, // always zero-text OK
    'image-quality-reviewer/review_aesthetics': [
      { score: 45, issues: 'palette violation — dominant saturated blues clash with the brand' }, // 1st: off-palette
      { score: 92, issues: '' } // 2nd: corrective render is on-palette
    ]
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db); // palette: bg #F5F0E8, primary #C8102E, accent #E3AF32
  const paletteRetryEvents = [];
  ctx.bus.subscribe((evt) => {
    if (evt.type === 'rework' && evt.payload?.reason === 'palette-retry') paletteRetryEvents.push(evt);
  });

  const state = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });

  // exactly TWO generations: original + one palette corrective
  assert.equal(egress.callsFor('image-generator').length, 2, 'one bounded palette-corrective regeneration');
  // the corrective generation carried paletteRetry:true → FORBIDDEN hoisted to line 1
  const genCalls = egress.callsFor('image-generator');
  assert.match(genCalls[1].opts.prompt, /^CRITICAL COLOR CONSTRAINT/, 'FORBIDDEN clause hoisted to first line on retry');
  // a palette-retry event was emitted
  assert.equal(paletteRetryEvents.length, 1, 'one palette-retry event');
  // the ADOPTED render is the corrective one, tagged paletteRetry:true, advisory now accepted
  const slotObj = state.design.canvas.objects.find((o) => o.slotId === 'slot-1');
  assert.equal(slotObj.type, 'Image');
  const meta = JSON.parse(ctx.db.prepare('SELECT meta FROM images WHERE image_id = ?').get(slotObj.imageId).meta);
  assert.equal(meta.paletteRetry, true, 'adopted render tagged as a palette retry');
  assert.equal(meta.advisoryReview.status, 'accepted', 'corrective render passes the aesthetic review');
});

// Bound check: a palette advisory that PERSISTS on the corrective render still
// stops at ONE retry (2 total gens) and ships the corrected render regardless.
test('palette advisory: bounded at 1 retry even when the corrective render is still off-palette', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': [
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a1' },
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a2' }
    ],
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT,
    'image-quality-reviewer/review_aesthetics': [
      { score: 40, issues: 'palette violation — blues dominate' },
      { score: 44, issues: 'palette violation — still bluish' } // corrective still off — must NOT retry again
    ]
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);

  await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });

  assert.equal(egress.callsFor('image-generator').length, 2, 'strictly one palette retry — never a second');
});

test('background slot: fills with a full-bleed prompt at portrait size, Image renders before content', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'masked' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db, { bg: true });
  const bgGate = [];
  ctx.bus.subscribe((evt) => {
    if (evt.type === 'gate_check' && evt.payload?.gateName === 'imageBackground') bgGate.push(evt);
  });

  const state = await generateForSlot({ ctx, posterId, slotId: 'bg', source: 'generate', assetsDir });

  // the generate call asked for a full-bleed backdrop at the portrait size
  const gen = egress.callsFor('image-generator')[0].opts;
  assert.equal(gen.size, '1024x1536', 'bg uses the portrait aspect-correct size');
  assert.match(gen.prompt, /full-bleed|background|edge-to-edge|gradient-mesh|pattern/i, 'bg uses background framing');
  assert.match(gen.prompt, /readable|calm|low-detail/i, 'bg keeps text zones legible');
  // the dedicated background-review gate fired (not the foreground aesthetic one)
  assert.equal(bgGate.length, 1, 'imageBackground gate_check emitted for the bg slot');

  // the bg is now an Image and still sits before the headline (render order)
  const objs = state.design.canvas.objects;
  const bgObj = objs.find((o) => o.slotId === 'bg');
  assert.equal(bgObj.type, 'Image', 'bg slot replaced with an Image');
  const bgIdx = objs.indexOf(bgObj);
  const headIdx = objs.findIndex((o) => o.layerRole === 'headline');
  assert.ok(bgIdx < headIdx, 'background Image renders before content');
});

test('v2 dual-orientation: portrait fill mirrors into the landscape canvas with the landscape slot geometry', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'masked-prompt' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db, { landscape: 'with-slot' });

  const state = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });

  const portraitObj = state.design.canvas.objects.find((o) => o.slotId === 'slot-1');
  assert.equal(portraitObj.type, 'Image');

  // landscape slot filled with the SAME image, its OWN geometry preserved
  const doc = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc);
  const landscapeObj = doc.design.landscape.canvas.objects.find((o) => o.slotId === 'slot-1');
  assert.equal(landscapeObj.type, 'Image');
  assert.equal(landscapeObj.layerRole, 'image');
  assert.equal(landscapeObj.imageId, portraitObj.imageId, 'same imageId in both orientations');
  assert.equal(landscapeObj.src, portraitObj.src, 'same src in both orientations');
  // I6: fitted placement uses the LANDSCAPE slot's own frame, not the portrait one
  assert.deepEqual(
    {
      left: landscapeObj.clipPath.left, top: landscapeObj.clipPath.top,
      width: landscapeObj.clipPath.width, height: landscapeObj.clipPath.height
    },
    { left: 1650, top: 90, width: 260, height: 260 },
    'landscape clip frame keeps the landscape slot bounds, not the portrait ones'
  );
  assert.equal(landscapeObj.clipPath.absolutePositioned, true);
  assert.equal(landscapeObj.scaleX, 260 / 1024, 'cover scale computed from the LANDSCAPE frame');
  assert.equal(landscapeObj.scaleY, 260 / 1024);
  assert.equal(landscapeObj.left, 1650, 'square frame + square image → no centering offset');
  assert.equal(landscapeObj.top, 90);
  assert.notEqual(landscapeObj.scaleX, portraitObj.scaleX, 'each orientation is fitted to ITS OWN frame');
  assert.ok(landscapeObj.slotSpec, 'landscape slotSpec preserved for regeneration');
  // safeDesignState surfaces the mirrored landscape canvas too
  assert.equal(state.design.landscapeCanvas.objects.find((o) => o.slotId === 'slot-1').type, 'Image');
});

test('v2 dual-orientation: a landscape canvas WITHOUT the slot is left untouched (no crash)', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'masked-prompt' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db, { landscape: 'no-slot' });

  const state = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });
  assert.equal(state.design.canvas.objects.find((o) => o.slotId === 'slot-1').type, 'Image');
  const doc = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc);
  assert.equal(doc.design.landscape.canvas.objects.length, 0, 'landscape canvas untouched');
});

test('generate: gate fail then pass — feedback in 2nd prompt, passes on 2nd attempt', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': [
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'attempt-1' },
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'attempt-2' }
    ],
    'image-text-gate/detect_embedded_text': [IMAGE_VISION_HAS_TEXT, IMAGE_VISION_OUTPUT]
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);

  const state = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });

  // 2 generator calls
  const genCalls = egress.callsFor('image-generator');
  assert.equal(genCalls.length, 2, '2 generation attempts');
  // 2nd attempt prompt includes rejection feedback
  assert.ok(
    genCalls[1].opts.prompt.includes('previous attempt contained text') ||
    genCalls[1].opts.prompt.includes('rejected'),
    '2nd prompt contains rejection feedback'
  );
  assert.ok(genCalls[1].opts.prompt.includes('STOP'), '2nd prompt carries the specific text-detection detail');

  // slot replaced
  const slotObj = state.design.canvas.objects.find((o) => o.slotId === 'slot-1');
  assert.equal(slotObj.type, 'Image');
});

test('generate: 3 zero-text fails → IMAGE_RETRIES_EXHAUSTED error (409), 3 failed rows saved', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': [
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a1' },
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a2' },
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a3' }
    ],
    'image-text-gate/detect_embedded_text': IMAGE_VISION_HAS_TEXT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);

  await assert.rejects(
    generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir }),
    (err) => err.code === 'IMAGE_RETRIES_EXHAUSTED' && err.status === 409 && err.attempts === 3 && err.lastReason === 'zero-text-gate'
  );
  // 3 generator + 3 gate calls (zero-text is the ONLY gate that retries; budget 3)
  assert.equal(egress.callsFor('image-generator').length, 3);
  assert.equal(egress.callsFor('image-text-gate').length, 3);
  // 3 failed images saved to DB (all with zero_text_passed=0)
  const allRows = ctx.db.prepare('SELECT * FROM images').all();
  assert.equal(allRows.length, 3, '3 failed image rows persisted');
  assert.ok(allRows.every((r) => r.zero_text_checked === 1 && r.zero_text_passed === 0), 'all rows have gate failed');
});

test('library source: unchecked image runs gate once', async () => {
  const egress = new FakeEgress({
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);
  // Insert a library image with zero_text_checked=0
  const rec = await saveImage({
    db: ctx.db, buffer: Buffer.from(IMAGE_BASE64, 'base64'),
    origin: 'library', topics: ['phishing'], style: null, format: null, meta: null, assetsDir
  });
  assert.equal(rec.zero_text_checked, 0);

  const state = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'library', imageId: rec.image_id, assetsDir });

  // gate was run once
  assert.equal(egress.callsFor('image-text-gate').length, 1, 'gate ran once on unchecked library image');
  // zero_text fields updated
  const updated = ctx.db.prepare('SELECT * FROM images WHERE image_id = ?').get(rec.image_id);
  assert.equal(updated.zero_text_checked, 1);
  assert.equal(updated.zero_text_passed, 1);
  // slot replaced
  const slotObj = state.design.canvas.objects.find((o) => o.slotId === 'slot-1');
  assert.equal(slotObj.type, 'Image');
  assert.equal(slotObj.imageId, rec.image_id);
});

test('library source: already checked + passed — no gate call', async () => {
  const egress = new FakeEgress({});
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);
  const rec = await saveImage({
    db: ctx.db, buffer: Buffer.from(IMAGE_BASE64, 'base64'),
    origin: 'library', topics: ['phishing'], style: null, format: null, meta: null, assetsDir
  });
  markZeroTextCheck(ctx.db, rec.image_id, true);

  const state = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'library', imageId: rec.image_id, assetsDir });

  assert.equal(egress.calls.length, 0, 'no model calls for pre-checked library image');
  const slotObj = state.design.canvas.objects.find((o) => o.slotId === 'slot-1');
  assert.equal(slotObj.type, 'Image');
});

test('library source: IMAGE_HAS_TEXT error for library image that fails gate', async () => {
  const egress = new FakeEgress({
    'image-text-gate/detect_embedded_text': IMAGE_VISION_HAS_TEXT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);
  const rec = await saveImage({
    db: ctx.db, buffer: Buffer.from(IMAGE_BASE64, 'base64'),
    origin: 'library', topics: ['phishing'], style: null, format: null, meta: null, assetsDir
  });

  await assert.rejects(
    generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'library', imageId: rec.image_id, assetsDir }),
    (err) => err.code === 'IMAGE_HAS_TEXT' && err.status === 422
  );
  // zero_text fields updated to reflect failure
  const updated = ctx.db.prepare('SELECT * FROM images WHERE image_id = ?').get(rec.image_id);
  assert.equal(updated.zero_text_checked, 1);
  assert.equal(updated.zero_text_passed, 0);
});

test('library-plus-prompt: generates from base description, saves generated-from-library record', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'masked' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);
  const rec = await saveImage({
    db: ctx.db, buffer: Buffer.from(IMAGE_BASE64, 'base64'),
    origin: 'library', topics: ['phishing'], style: 'flat-icon', format: 'icon', meta: null, assetsDir
  });

  const state = await generateForSlot({
    ctx, posterId, slotId: 'slot-1', source: 'library-plus-prompt',
    imageId: rec.image_id, userPrompt: 'make it about QR codes', assetsDir
  });

  // generator got the base description + fenced user prompt
  const genCalls = egress.callsFor('image-generator');
  assert.equal(genCalls.length, 1);
  assert.ok(genCalls[0].opts.prompt.includes('flat-icon'), 'base image style in prompt');
  assert.ok(genCalls[0].opts.prompt.includes('<user_text>make it about QR codes</user_text>'), 'user prompt data-fenced');

  // a NEW record with origin generated-from-library was saved
  const generated = ctx.db.prepare("SELECT * FROM images WHERE origin = 'generated-from-library'").all();
  assert.equal(generated.length, 1);
  assert.equal(generated[0].zero_text_passed, 1);

  const slotObj = state.design.canvas.objects.find((o) => o.slotId === 'slot-1');
  assert.equal(slotObj.type, 'Image');
  assert.equal(slotObj.imageId, generated[0].image_id, 'slot assigned the generated image, not the base');
});

test('I6 slot replacement: cover-fitted Image — coverage ≥ frame, centered, absolutePositioned clipPath = slot frame (+rx/ry)', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'masked' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);

  const state = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });
  const slotObj = state.design.canvas.objects.find((o) => o.slotId === 'slot-1');

  // the slot frame from the seeded placeholder Rect
  const spec = DESIGN_SPEC.imageSlots[0];
  const frame = {
    left: Math.round(spec.x * 1414 / 100), top: Math.round(spec.y * 2000 / 100),
    width: Math.round(spec.w * 1414 / 100), height: Math.round(spec.h * 2000 / 100)
  };

  // image keeps its natural pixel dims (generated at 1024x1024) and is
  // cover-scaled: scale = max(frameW/imgW, frameH/imgH)
  assert.equal(slotObj.width, 1024, 'image keeps natural pixel width');
  assert.equal(slotObj.height, 1024, 'image keeps natural pixel height');
  const expectedScale = Math.max(frame.width / 1024, frame.height / 1024);
  assert.equal(slotObj.scaleX, expectedScale, 'cover scale on X');
  assert.equal(slotObj.scaleY, expectedScale, 'cover scale on Y (uniform — no distortion)');

  // coverage ≥ frame dims on BOTH axes — the visible image fills the frame
  assert.ok(slotObj.width * slotObj.scaleX >= frame.width - 1e-9, 'scaled width covers the frame');
  assert.ok(slotObj.height * slotObj.scaleY >= frame.height - 1e-9, 'scaled height covers the frame');

  // centered within the frame (±1px)
  const centerX = slotObj.left + (slotObj.width * slotObj.scaleX) / 2;
  const centerY = slotObj.top + (slotObj.height * slotObj.scaleY) / 2;
  assert.ok(Math.abs(centerX - (frame.left + frame.width / 2)) <= 1, 'horizontally centered in the frame');
  assert.ok(Math.abs(centerY - (frame.top + frame.height / 2)) <= 1, 'vertically centered in the frame');

  // clipPath = absolutePositioned Rect matching the slot frame, rx/ry carried
  // over from the placeholder Rect (rx:16/ry:16 in the seeded canvas)
  assert.equal(slotObj.clipPath.type, 'Rect');
  assert.equal(slotObj.clipPath.absolutePositioned, true, 'clipPath clips in canvas coordinates');
  assert.deepEqual(
    {
      left: slotObj.clipPath.left, top: slotObj.clipPath.top,
      width: slotObj.clipPath.width, height: slotObj.clipPath.height,
      rx: slotObj.clipPath.rx, ry: slotObj.clipPath.ry
    },
    { ...frame, rx: 16, ry: 16 },
    'clipPath matches the slot frame including rounded corners'
  );

  // slotSpec + identity preserved
  assert.equal(slotObj.layerRole, 'image');
  assert.equal(slotObj.slotId, 'slot-1');
  assert.deepEqual(slotObj.slotSpec, { slotId: 'slot-1', styleHint: spec.styleHint });
  assert.equal(slotObj.imageId, ctx.db.prepare('SELECT image_id FROM images').get()?.image_id);
});

test('I6 regeneration: refilling an already-fitted slot recovers the frame from the clipPath (no drift)', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': [
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'first' },
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'second' }
    ],
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);

  const first = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });
  const firstObj = first.design.canvas.objects.find((o) => o.slotId === 'slot-1');
  const second = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });
  const secondObj = second.design.canvas.objects.find((o) => o.slotId === 'slot-1');

  assert.notEqual(secondObj.imageId, firstObj.imageId, 'regeneration assigned a NEW image');
  // frame + fit identical to the first fill — the clipPath is the durable frame
  assert.deepEqual(secondObj.clipPath, firstObj.clipPath, 'clipPath frame unchanged across regeneration');
  assert.equal(secondObj.left, firstObj.left, 'placement unchanged across regeneration');
  assert.equal(secondObj.top, firstObj.top);
  assert.equal(secondObj.scaleX, firstObj.scaleX);
  assert.equal(secondObj.scaleY, firstObj.scaleY);
  assert.deepEqual(secondObj.slotSpec, firstObj.slotSpec, 'slotSpec survives repeated regeneration');
});

test('phase guard: rejects posters not in "designed" phase', async () => {
  const egress = new FakeEgress({});
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db, { phase: 'content-approval', status: 'draft' });
  await assert.rejects(
    generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir }),
    (err) => err.code === 'WRONG_PHASE' && err.status === 409
  );
});

test('unknown slot: rejects if slotId not found in canvas', async () => {
  const egress = new FakeEgress({});
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);
  await assert.rejects(
    generateForSlot({ ctx, posterId, slotId: 'slot-99', source: 'generate', assetsDir }),
    (err) => err.code === 'SLOT_NOT_FOUND' && err.status === 404
  );
});

test('invalid source rejected with INVALID_SOURCE', async () => {
  const egress = new FakeEgress({});
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);
  await assert.rejects(
    generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'paste-url', assetsDir }),
    (err) => err.code === 'INVALID_SOURCE' && err.status === 400
  );
});

// ── Phase O5 hardening tests ─────────────────────────────────────────────────

test('O5: zero-text fails 2x then passes — 3 gen calls, success, 3 rows persisted (2 failed 1 passed), rework events emitted', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': [
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a1' },
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a2' },
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a3' }
    ],
    'image-text-gate/detect_embedded_text': [
      IMAGE_VISION_HAS_TEXT, // attempt 1 fails
      IMAGE_VISION_HAS_TEXT, // attempt 2 fails
      IMAGE_VISION_OUTPUT    // attempt 3 passes
    ]
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);

  const reworkEvents = [];
  ctx.bus.subscribe((evt) => {
    if (evt.type === 'rework') reworkEvents.push(evt);
  });

  const state = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });

  // Slot replaced successfully
  const slotObj = state.design.canvas.objects.find((o) => o.slotId === 'slot-1');
  assert.equal(slotObj.type, 'Image', 'slot replaced with Image on 3rd attempt');

  // 3 generation calls, 3 gate calls
  assert.equal(egress.callsFor('image-generator').length, 3, '3 generation attempts made');
  assert.equal(egress.callsFor('image-text-gate').length, 3, '3 gate checks performed');

  // 3 rows persisted: 2 failed + 1 passed
  const allRows = ctx.db.prepare('SELECT * FROM images ORDER BY created_at ASC, rowid ASC').all();
  assert.equal(allRows.length, 3, '3 image rows persisted (2 failed + 1 passed)');
  const failedRows = allRows.filter((r) => r.zero_text_passed === 0);
  const passedRows = allRows.filter((r) => r.zero_text_passed === 1);
  assert.equal(failedRows.length, 2, '2 failed rows');
  assert.equal(passedRows.length, 1, '1 passed row');
  assert.ok(passedRows[0].zero_text_checked === 1, 'passed row has zero_text_checked=1');

  // The assigned image is the passed one
  assert.equal(slotObj.imageId, passedRows[0].image_id, 'slot assigned the passed image');

  // 2 rework events emitted, one per failed attempt
  assert.equal(reworkEvents.length, 2, '2 rework events emitted');
  assert.deepEqual(
    reworkEvents.map((e) => e.payload.attempt),
    [1, 2],
    'rework events carry attempt numbers 1-2'
  );
  assert.ok(reworkEvents.every((e) => e.payload.reason === 'zero-text-gate'), 'all rework reasons are zero-text-gate');
});

test('O5: zero-text fails 3x → IMAGE_RETRIES_EXHAUSTED + 3 failed rows', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': [
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a1' },
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a2' },
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a3' }
    ],
    'image-text-gate/detect_embedded_text': IMAGE_VISION_HAS_TEXT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);

  const reworkEvents = [];
  ctx.bus.subscribe((evt) => {
    if (evt.type === 'rework') reworkEvents.push(evt);
  });

  await assert.rejects(
    generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir }),
    (err) => {
      return err.code === 'IMAGE_RETRIES_EXHAUSTED' &&
        err.status === 409 &&
        err.attempts === 3 &&
        err.lastReason === 'zero-text-gate';
    }
  );

  // 3 failed rows all with zero_text_passed=0
  const allRows = ctx.db.prepare('SELECT * FROM images').all();
  assert.equal(allRows.length, 3, '3 image rows persisted');
  assert.ok(allRows.every((r) => r.zero_text_checked === 1 && r.zero_text_passed === 0), 'all rows gate-failed');

  // 3 rework events
  assert.equal(reworkEvents.length, 3, '3 rework events emitted');
  assert.deepEqual(
    reworkEvents.map((e) => e.payload.attempt),
    [1, 2, 3],
    'rework events carry attempt numbers 1-3'
  );
});

test('O5: generation error counts as an attempt and emits rework with reason generation-error', async () => {
  let genCallCount = 0;
  const egress = new FakeEgress({
    'image-generator/generate_asset': () => {
      genCallCount++;
      if (genCallCount === 1) throw new Error('DALL-E API timeout');
      return { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a2' };
    },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);

  const reworkEvents = [];
  ctx.bus.subscribe((evt) => {
    if (evt.type === 'rework') reworkEvents.push(evt);
  });

  const state = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });

  // Slot replaced successfully on 2nd attempt
  const slotObj = state.design.canvas.objects.find((o) => o.slotId === 'slot-1');
  assert.equal(slotObj.type, 'Image', 'slot replaced despite first attempt error');

  // 2 generation calls (1 errored + 1 passed)
  assert.equal(egress.callsFor('image-generator').length, 2, '2 generation attempts');

  // 2 rows: 1 failed (generation error) + 1 passed
  const allRows = ctx.db.prepare('SELECT * FROM images').all();
  assert.equal(allRows.length, 2, '2 image rows persisted');
  const failedRows = allRows.filter((r) => r.zero_text_passed === 0);
  assert.equal(failedRows.length, 1, '1 failed row for generation error');

  // 1 rework event for generation error
  assert.equal(reworkEvents.length, 1, '1 rework event for generation error');
  assert.equal(reworkEvents[0].payload.attempt, 1, 'rework event for attempt 1');
  assert.equal(reworkEvents[0].payload.reason, 'generation-error', 'rework reason is generation-error');
});

test('O5: prompt escalation — attempt 2 vs attempt 3 use distinct anti-text phrases', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': [
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a1' },
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a2' },
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a3' }
    ],
    'image-text-gate/detect_embedded_text': IMAGE_VISION_HAS_TEXT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);

  await assert.rejects(
    generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir }),
    (err) => err.code === 'IMAGE_RETRIES_EXHAUSTED'
  );

  const genCalls = egress.callsFor('image-generator');
  assert.equal(genCalls.length, 3, '3 generation calls');

  // Attempt 1 has no anti-text escalation (first attempt)
  const prompt1 = genCalls[0].opts.prompt;
  assert.ok(!prompt1.includes('ABSOLUTELY NO text'), 'attempt 1 has no escalation phrase');

  // Attempt 2 uses the level-2 phrase
  const prompt2 = genCalls[1].opts.prompt;
  assert.ok(prompt2.includes('ABSOLUTELY NO text, letters, numbers, words, or typography of any kind'), 'attempt 2 uses level-2 anti-text phrase');

  // Attempt 3 uses a more escalated phrase (distinct from attempt 2)
  const prompt3 = genCalls[2].opts.prompt;
  assert.ok(prompt3.includes('FINAL WARNING'), 'attempt 3 uses level-3 escalated phrase');
  assert.ok(prompt3 !== prompt2, 'attempt 3 prompt differs from attempt 2 prompt');
});

test('O5: customPrompt is fenced and reaches the generation prompt', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'masked' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);

  await generateForSlot({
    ctx, posterId, slotId: 'slot-1', source: 'generate',
    customPrompt: 'show a locked padlock on a smartphone',
    assetsDir
  });

  const genCalls = egress.callsFor('image-generator');
  assert.equal(genCalls.length, 1, '1 generation call');
  const prompt = genCalls[0].opts.prompt;
  // customPrompt must be data-fenced
  assert.ok(
    prompt.includes('<user_text>show a locked padlock on a smartphone</user_text>'),
    'customPrompt is data-fenced in the generation prompt'
  );
});

test('O5: failed images absent from default listImages but present with includeFailed=true', async () => {
  const { ctx, assetsDir } = makeCtx(new FakeEgress({}));
  const { listImages } = await import('../../image-library/store.js');
  const { saveImage: save, markZeroTextCheck: mark } = await import('../../image-library/store.js');

  // Save one passing and one failing image
  const passRec = await save({
    db: ctx.db, buffer: Buffer.from(IMAGE_BASE64, 'base64'),
    origin: 'generated', topics: [], style: null, format: null, meta: null, assetsDir
  });
  mark(ctx.db, passRec.image_id, true); // passed

  const failRec = await save({
    db: ctx.db, buffer: Buffer.from(IMAGE_BASE64, 'base64'),
    origin: 'generated', topics: [], style: null, format: null, meta: null, assetsDir
  });
  mark(ctx.db, failRec.image_id, false); // failed

  // Default listing excludes failed images
  const defaultList = listImages({ db: ctx.db });
  assert.equal(defaultList.length, 1, 'default listing excludes failed images');
  assert.equal(defaultList[0].image_id, passRec.image_id, 'default listing only shows passed image');

  // includeFailed=true includes all
  const fullList = listImages({ db: ctx.db, includeFailed: true });
  assert.equal(fullList.length, 2, 'includeFailed listing includes both images');
});

// ── I5: user regen input dominates the generation prompt ─────────────────────
// These assert the I5 wrapper CONTRACT without freezing the exact prompt text:
// the base auto-prompt is captured LIVE from a no-customPrompt fill, so prompt
// wording can evolve without breaking these tests.

// Capture the outbound generation prompt for the seeded poster's slot-1, with an
// optional customPrompt.
async function capturePrompt(customPrompt) {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'masked' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);
  await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', customPrompt, assetsDir });
  const calls = egress.callsFor('image-generator');
  assert.equal(calls.length, 1);
  return calls[0].opts.prompt;
}

test('I5: without customPrompt the outbound prompt carries no override wrapper', async () => {
  const prompt = await capturePrompt(undefined);
  assert.ok(!prompt.includes('OVERRIDES') && !prompt.includes('STYLE + CONTEXT'),
    'no I5 override wrapper is applied without a customPrompt');
  // it is the real auto-derived prompt: the point's mined signal (client #1) +
  // zero-text rule present. The concept now leads with the concrete SIGNAL
  // ("qr code arriving") mined from the point "A QR code arriving by email".
  assert.match(prompt, /qr code arriving/i, 'point signal concept present');
  assert.match(prompt, /ZERO TEXT IN THE IMAGE/, 'zero-text rule present');
});

test('I5: customPrompt leads as PRIMARY SUBJECT over the UNCHANGED auto prompt', async () => {
  // base is computed live; the with-customPrompt run reuses the same seeded
  // poster (deterministic concept) so the demoted base is byte-identical.
  const base = await capturePrompt(undefined);
  const wrapped = await capturePrompt('a red panda mascot holding a shield');

  assert.ok(wrapped.startsWith(
    'PRIMARY SUBJECT (user\'s explicit request — this OVERRIDES the default subject): '
    + '<user_text>a red panda mascot holding a shield</user_text>.'
  ), 'fenced user description opens the prompt as the primary subject');
  assert.ok(wrapped.indexOf('OVERRIDES') < wrapped.indexOf('STYLE + CONTEXT'), 'override marker precedes the demotion');
  assert.equal(
    wrapped,
    'PRIMARY SUBJECT (user\'s explicit request — this OVERRIDES the default subject): '
    + '<user_text>a red panda mascot holding a shield</user_text>. '
    + 'STYLE + CONTEXT (palette, mood, poster context — do not let this override the primary subject): '
    + base,
    'wrapped = primary subject + the UNCHANGED auto prompt, nothing else altered'
  );
});

test('I5: anti-text escalation unchanged with customPrompt — retry feedback still reaches the prompt', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': [
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a1' },
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'a2' }
    ],
    'image-text-gate/detect_embedded_text': [IMAGE_VISION_HAS_TEXT, IMAGE_VISION_OUTPUT]
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);

  await generateForSlot({
    ctx, posterId, slotId: 'slot-1', source: 'generate',
    customPrompt: 'a red panda mascot holding a shield', assetsDir
  });

  const genCalls = egress.callsFor('image-generator');
  assert.equal(genCalls.length, 2, 'gate fail → retry');
  const prompt2 = genCalls[1].opts.prompt;
  assert.ok(prompt2.startsWith('PRIMARY SUBJECT'), 'retry keeps the primary-subject lead');
  assert.ok(
    prompt2.includes('ABSOLUTELY NO text, letters, numbers, words, or typography of any kind'),
    'level-2 anti-text escalation still present on the retry'
  );
  assert.ok(prompt2.includes('STOP'), 'gate feedback detail still reaches the retry prompt');
});

// ── I7: image-subject generality — subject derives from the poster's OWN topic ─

test('I7: empty styleHint → visual subject is derived from the poster topic, not a hardcoded shield/lock', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'masked' }
  });

  // NON-security topic, no styleHint from the design agent → the fallback fires
  const { promptUsed } = await generateAsset({
    egress, runId: newRunId('poster'),
    styleHint: '', templateStyle: 'minimal-clean',
    topics: ['clean desk policy'], userPrompt: '', baseImageDescription: ''
  });
  // FakeEgress echoes the outbound prompt back via maskedPrompt? No — capture from calls.
  const call = egress.callsFor('image-generator')[0];
  const prompt = call.opts.prompt;

  // the derived subject references the poster's OWN topic
  assert.ok(prompt.includes('clean desk policy'),
    'the auto subject references the actual topic, not a generic security motif');
  assert.ok(/illustration of .*clean desk policy/i.test(prompt),
    'the empty-styleHint fallback builds the subject from the topic');

  // it does NOT inject a shield/lock/hook/phishing motif the topic never asked for
  for (const motif of ['shield', 'padlock', 'phishing', 'fishing hook']) {
    assert.ok(!prompt.toLowerCase().includes(motif),
      `a clean-desk poster must not get a hardcoded "${motif}" motif`);
  }
  // zero-text rules stay ABSOLUTE and unchanged
  assert.ok(prompt.includes('ABSOLUTE REQUIREMENT — ZERO TEXT IN THE IMAGE:'),
    'zero-text absolute rule is intact');
  assert.ok(promptUsed === 'masked', 'promptUsed is the masked prompt from egress');
  assert.equal(IMAGE_GENERATOR_PROMPT_VERSION, 3, 'image generator prompt version bumped');
});

test('I7: with a design styleHint, that per-poster subject is used verbatim (topic-derived by the design agent)', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'masked' }
  });
  await generateAsset({
    egress, runId: newRunId('poster'),
    styleHint: 'a tidy cleared desk with a locked drawer at end of day',
    templateStyle: 'minimal-clean',
    topics: ['clean desk policy'], userPrompt: '', baseImageDescription: ''
  });
  const prompt = egress.callsFor('image-generator')[0].opts.prompt;
  assert.ok(prompt.includes('a tidy cleared desk with a locked drawer at end of day'),
    'the design agent styleHint (topic-derived) drives the subject when present');
});

// ── COST: concept-hash dedupe / cache (item 2) ──────────────────────────────

test('dedupe MISS: first generation stores a conceptHash on the accepted asset meta', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'm' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);

  const state = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });

  // a real generation happened (cache miss)
  assert.equal(egress.callsFor('image-generator').length, 1, 'dedupe miss → one generation');
  const slotObj = state.design.canvas.objects.find((o) => o.slotId === 'slot-1');
  const meta = JSON.parse(ctx.db.prepare('SELECT meta FROM images WHERE image_id = ?').get(slotObj.imageId).meta);
  assert.ok(typeof meta.conceptHash === 'string' && meta.conceptHash.length === 64, 'sha256 conceptHash stored on meta');
  assert.equal(meta.reused, false, 'first render is not a reuse');
});

test('dedupe HIT: a second poster with the same concept reuses the asset with ZERO image calls', async () => {
  // Poster A generates; poster B (same seeded concept) must reuse A's asset.
  const egressA = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'm' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egressA);
  const a = seedDesignedPoster(ctx.db);
  const stateA = await generateForSlot({ ctx, posterId: a.posterId, slotId: 'slot-1', source: 'generate', assetsDir });
  const idA = stateA.design.canvas.objects.find((o) => o.slotId === 'slot-1').imageId;
  assert.equal(egressA.callsFor('image-generator').length, 1, 'poster A generated once');

  // Second poster in the SAME db + assets → same shared library. Swap in a fresh
  // egress on the same ctx so we can assert ZERO image calls for the reuse.
  const egressB = new FakeEgress({}); // no handlers: any egress call would throw
  ctx.egress = egressB;
  const reuseEvents = [];
  ctx.bus.subscribe((evt) => { if (evt.skill === 'reuse_asset') reuseEvents.push(evt); });

  const b = seedDesignedPoster(ctx.db);
  const stateB = await generateForSlot({ ctx, posterId: b.posterId, slotId: 'slot-1', source: 'generate', assetsDir });

  assert.equal(egressB.calls.length, 0, 'reuse path makes ZERO egress calls (no generation, no gate)');
  const idB = stateB.design.canvas.objects.find((o) => o.slotId === 'slot-1').imageId;
  assert.equal(idB, idA, 'poster B reused poster A\'s asset');
  assert.equal(reuseEvents.length, 1, 'a reuse_asset event was emitted');
});

test('dedupe: explicit REGENERATION of an already-filled slot bypasses reuse (fresh render)', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': [
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'first' },
      { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'second' }
    ],
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);

  const first = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });
  const firstId = first.design.canvas.objects.find((o) => o.slotId === 'slot-1').imageId;
  const second = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });
  const secondId = second.design.canvas.objects.find((o) => o.slotId === 'slot-1').imageId;

  assert.equal(egress.callsFor('image-generator').length, 2, 'regeneration generated a fresh render (no reuse)');
  assert.notEqual(secondId, firstId, 'regeneration produced a new asset');
});

// ── COST: quality + size tiers by slot class (item 3) ───────────────────────

test('quality tier: a foreground slot renders at medium quality', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'm' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db); // slot-1 is a foreground slot

  const state = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });

  const gen = egress.callsFor('image-generator')[0].opts;
  assert.equal(gen.quality, 'medium', 'foreground slot uses the cheaper medium quality');
  // cost meta records the quality + size used
  const slotObj = state.design.canvas.objects.find((o) => o.slotId === 'slot-1');
  const meta = JSON.parse(ctx.db.prepare('SELECT meta FROM images WHERE image_id = ?').get(slotObj.imageId).meta);
  assert.equal(meta.quality, 'medium');
  assert.equal(meta.sizeUsed, gen.size);
});

test('quality tier: background slot renders at high quality (full-bleed surface)', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'm' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db, { bg: true });

  await generateForSlot({ ctx, posterId, slotId: 'bg', source: 'generate', assetsDir });

  const gen = egress.callsFor('image-generator')[0].opts;
  assert.equal(gen.quality, 'high', 'bg slot stays at high quality');
});

test('accent slot: drops to 1024x1024 square at medium quality', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'm' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedDesignedPoster(ctx.db);

  // Shrink slot-1 to an accent-class slot (< 8% of canvas area) so the profile
  // classifies it as 'accent'. Canvas is 1414x2000 → area 2,828,000; use a small
  // 120x120 slot (14,400 px² ≈ 0.5%).
  const doc = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc);
  const slot = doc.design.canvas.objects.find((o) => o.slotId === 'slot-1');
  slot.width = 120; slot.height = 120; slot.scaleX = 1; slot.scaleY = 1;
  ctx.db.prepare('UPDATE posters SET doc = ? WHERE poster_id = ?').run(JSON.stringify(doc), posterId);

  await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });

  const gen = egress.callsFor('image-generator')[0].opts;
  assert.equal(gen.size, '1024x1024', 'accent slot renders as a square');
  assert.equal(gen.quality, 'medium', 'accent slot uses medium quality');
});
