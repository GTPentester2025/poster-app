// Autopilot pipeline: one prompt in, a designed + image-filled poster out,
// with every decision (template, palette, angle, content score, slot fills)
// recorded and no user interaction anywhere on the path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '#shared';
import { GateEngine, Harness } from '#orchestration';
import { openDb } from '../../backend/db.js';
import { runAutoPipeline, slotIdsOf } from '../../pipelines/auto_pipeline.js';
import { getPalette } from '../../data/creative-library.js';
import {
  FakeEgress, seedArticles, INTENT_OUTPUT, CONTEXT_OUTPUT,
  ACCEPT_REVIEW, GEN_IMAGE_1024, IMAGE_VISION_OUTPUT
} from './helpers/fake_egress.js';

const V2_BLOCKS = {
  headline: 'Pause Before You Scan or Sign In',
  subheadline: 'One rushed action can hand an attacker the keys',
  blocks: [
    { id: 'blk-1', label: 'Spot', text: 'A QR code arriving by email instead of a plain link' },
    { id: 'blk-2', label: 'Pause', text: 'A one-time code request on a page you did not open' },
    { id: 'blk-3', label: 'Verify', text: 'Open the real site from your bookmarks, not the message' },
    { id: 'blk-4', label: 'Report', text: 'Report the message to the security team, do not reply' }
  ],
  callToAction: 'Report suspicious messages to {{SOC_EMAIL}}'
};

function makeCtx(egress) {
  const dir = mkdtempSync(join(tmpdir(), 'postter-auto-pipeline-'));
  const db = openDb(join(dir, 'test.sqlite'));
  seedArticles(db);
  const bus = new EventBus({ logDir: join(dir, 'runs'), db });
  const gateEngine = new GateEngine({ bus });
  const harness = new Harness({ bus, gateEngine });
  return { db, bus, vault: null, egress, gateEngine, harness, dir };
}

function autoHandlers(overrides = {}) {
  return {
    'keyword-intent': INTENT_OUTPUT,
    'rag-research/synthesize_context': CONTEXT_OUTPUT,
    'creative-director': JSON.stringify({
      paletteId: 'midnight-cyan', fontPairId: 'space-ibm', templateId: 'timeline-journey',
      visualMode: 'futuristic', motifs: ['signal arcs'], imageStyle: 'dark neon photography',
      rationale: 'tech topic, dark urgency'
    }),
    'angle-autopick': { angleId: 'angle-2', reason: 'most specific and actionable' },
    'content-generator': () => structuredClone(V2_BLOCKS),
    'content-reviewer': () => structuredClone(ACCEPT_REVIEW),
    'image-concept/concept_for_point': { concept: 'flat vector illustration, single subject, no text', signals: [] },
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, promptUsed: 'flat vector illustration, no text' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT,
    'image-quality-reviewer/review_aesthetics': { status: 'accepted', score: 88, feedback: '', expected: '', reason: '' },
    'asset-recommender/recommend_asset': { imageId: null, confidence: 0, reason: 'no match' },
    'background-reviewer/review_background': { status: 'accepted', score: 90, feedback: '', expected: '' },
    'overseer/review_prompting': { score: 90, notes: [] },
    ...overrides
  };
}

test('autopilot: prompt → designed poster, creative brief honored, no user steps', async () => {
  const egress = new FakeEgress(autoHandlers());
  const ctx = makeCtx(egress);
  const { posterId, runId, decisions } = await runAutoPipeline({ ctx, prompt: 'warn staff about QR phishing' });

  const row = ctx.db.prepare('SELECT * FROM posters WHERE poster_id = ?').get(posterId);
  const doc = JSON.parse(row.doc);
  assert.equal(doc.phase, 'designed');
  assert.equal(doc.templateId, 'timeline-journey');
  assert.equal(doc.design.templateId, 'timeline-journey');

  // creative brief applied: curated palette + fonts, brief recorded on design
  const lib = getPalette('midnight-cyan');
  assert.equal(doc.design.palette.primary, lib.primary);
  assert.equal(doc.design.fonts.head, 'Space Grotesk');
  assert.equal(doc.design.creativeDirection.paletteId, 'midnight-cyan');

  // decisions summary for the UI
  assert.equal(decisions.creative.templateId, 'timeline-journey');
  assert.equal(decisions.angle.angleId, 'angle-2');
  assert.equal(decisions.content.bestEffort, false);
  assert.ok(decisions.images.requested >= 1);
  assert.equal(decisions.images.failed.length, 0);

  // approval learning recorded exactly like a user click
  const learning = ctx.db.prepare("SELECT * FROM learning WHERE kind = 'approval'").all();
  assert.ok(learning.length >= 1);

  // no user_action events were needed for angles/content approval to happen —
  // they exist (pipeline emits them on behalf of autopilot) but the run ends designed
  const events = ctx.bus.eventsForRun(runId);
  assert.ok(events.some((e) => e.pipeline === 'autopilot' && e.type === 'stage_end'));
});

test('autopilot: unparseable creative + autopick output → deterministic picks, still designed', async () => {
  const egress = new FakeEgress(autoHandlers({
    'creative-director': 'no json here',
    'angle-autopick': () => { throw new Error('model down'); }
  }));
  const ctx = makeCtx(egress);
  const { posterId, decisions } = await runAutoPipeline({ ctx, prompt: 'warn staff about QR phishing' });
  const doc = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc);
  assert.equal(doc.phase, 'designed');
  assert.ok(doc.templateId, 'a template was still chosen deterministically');
  assert.equal(decisions.angle.angleId, CONTEXT_OUTPUT.angles[0].id, 'falls back to first angle');
});

test('autopilot: failed slot generation degrades, never throws', async () => {
  const egress = new FakeEgress(autoHandlers({
    'image-generator/generate_asset': () => { throw new Error('image api down'); }
  }));
  const ctx = makeCtx(egress);
  const { posterId, decisions } = await runAutoPipeline({ ctx, prompt: 'warn staff about QR phishing' });
  const doc = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc);
  assert.equal(doc.phase, 'designed');
  assert.ok(decisions.images.failed.length >= 1, 'failed slots reported, not thrown');
});

test('slotIdsOf: collects unique image-slot ids incl background', () => {
  const canvas = { objects: [
    { layerRole: 'image-slot', slotId: 'bg' },
    { layerRole: 'image-slot', slotId: 'slot-1' },
    { layerRole: 'image-slot', slotId: 'slot-1' },
    { layerRole: 'message', slotId: 'not-a-slot' },
    { layerRole: 'image-slot' }
  ] };
  assert.deepEqual(slotIdsOf(canvas), ['bg', 'slot-1']);
  assert.deepEqual(slotIdsOf(null), []);
});

test('autopilot: empty prompt rejected', async () => {
  const ctx = makeCtx(new FakeEgress({}));
  await assert.rejects(() => runAutoPipeline({ ctx, prompt: '  ' }), (err) => err.code === 'INVALID_PROMPT');
});
