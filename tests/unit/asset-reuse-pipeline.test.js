// Pipeline wiring for auto-recommend reuse + deterministic asset metadata
// (client escalation #3b/#3c). A freshly generated asset carries meta.description
// + meta.tags; a subsequent slot fill whose need matches an existing tagged asset
// reuses it via the recommender (reuse_asset event, reused:true, ZERO image-gen
// calls). The conceptHash fast path still short-circuits before the model call.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { newRunId } from '#shared';
import { createAppContext } from '../../backend/app-context.js';
import { FakeEgress, GEN_IMAGE_1024, IMAGE_VISION_OUTPUT } from './helpers/fake_egress.js';
import { generateForSlot } from '../../pipelines/image_pipeline.js';

function makeCtx(egress) {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-asset-reuse-'));
  const ctx = createAppContext({
    dataDir, logDir: join(dataDir, 'runs'), dbPath: join(dataDir, 'test.sqlite'), egress
  });
  return { ctx, assetsDir: join(dataDir, 'image-library', 'assets') };
}

// A designed poster with two content blocks so slot-1 and slot-2 map to distinct
// points; the image slot geometry is a medium 'card' so profiles stay non-accent.
function seedPoster(db) {
  const posterId = randomUUID();
  const runId = newRunId('poster');
  const now = new Date().toISOString();
  const mkSlot = (slotId, x, y) => ({
    type: 'Rect', left: Math.round(x * 1414 / 100), top: Math.round(y * 2000 / 100),
    width: Math.round(30 * 1414 / 100), height: Math.round(20 * 2000 / 100),
    fill: 'transparent', layerRole: 'image-slot', slotId,
    slotSpec: { slotId, blockId: slotId === 'slot-1' ? 'msg-1' : 'msg-2', styleHint: 'x' }
  });
  const canvas = {
    version: '6.7.1', width: 1414, height: 2000, background: '#0D0C12',
    objects: [mkSlot('slot-1', 6, 30), mkSlot('slot-2', 52, 30)]
  };
  const doc = {
    prompt: 'phishing', runId, phase: 'designed', grounded: true, contextId: `ctx-${posterId}`,
    contextFile: { topic: 'phishing', keywords: { core: ['phishing'], expanded: [], contentShape: null }, synthesis: 's', angles: [], sources: [] },
    intent: null, selectedAngleIds: 'ai',
    content: {
      headline: 'h', subheadline: null,
      messages: [
        { id: 'msg-1', label: 'RED FLAG', text: 'Check the sender address and the real domain before you click' },
        // msg-2: DIFFERENT wording (→ different conceptHash, so the fast path
        // misses) but the SAME concrete signal (sender address / domain) so the
        // tag prefilter surfaces msg-1's asset for the recommender.
        { id: 'msg-2', label: 'RED FLAG', text: 'Inspect the sender address and the domain name carefully' }
      ],
      callToAction: 'report', format: 'red-flags'
    },
    design: {
      templateId: 'minimal-clean', templateSource: 'predefined', layoutType: null, rationale: null,
      layoutSpec: null, canvas,
      palette: { background: '#0D0C12', primary: '#E3AF32', accent: '#E3AF32', dark: '#0D0C12' },
      fonts: { head: 'Montserrat', body: 'Inter' }, reviewHistory: [], designedAt: now
    },
    reviewHistory: [], snapshots: []
  };
  db.prepare('INSERT INTO posters (poster_id, name, status, created_at, updated_at, doc) VALUES (?, ?, ?, ?, ?, ?)')
    .run(posterId, 'p', 'designed', now, now, JSON.stringify(doc));
  return { posterId, runId };
}

test('new generated asset carries deterministic meta.description + meta.tags', async () => {
  const egress = new FakeEgress({
    // concept director derives a signal-specific concept
    'image-concept/concept_for_point': JSON.stringify({ concept: 'a magnifying glass over an email sender-address bar, the domain highlighted' }),
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'm' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
    // no asset-recommender handler needed: first fill has no candidates
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db);

  const state = await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });
  const slotObj = state.design.canvas.objects.find((o) => o.slotId === 'slot-1');
  const meta = JSON.parse(ctx.db.prepare('SELECT meta FROM images WHERE image_id = ?').get(slotObj.imageId).meta);

  assert.match(meta.description, /magnifying glass over an email sender-address bar/, 'description = the concept');
  assert.ok(Array.isArray(meta.tags) && meta.tags.length >= 5, '5-8 tags recorded');
  assert.ok(meta.tags.some((t) => /sender|domain/.test(t)), 'signal tags present');
});

test('reuse: recommender reuses an existing tagged asset — reuse_asset event, reused:true, zero image-gen', async () => {
  // First fill creates a tagged asset for slot-1. Second fill for slot-2 has the
  // SAME point but a DIFFERENT blockId, so the conceptHash differs (slotId not in
  // hash but block differs? — same text → same hash). To force the RECOMMENDER
  // path (not the fast hash path) we regenerate slot-2 with a recommender pick.
  const egress = new FakeEgress({
    'image-concept/concept_for_point': JSON.stringify({ concept: 'a magnifying glass over an email sender-address bar, the domain highlighted' }),
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'm' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT,
    'asset-recommender/recommend_asset': (opts) => {
      // pick the first candidate imageId offered in the prompt
      const m = /imageId=([0-9a-f-]+)/i.exec(opts.user);
      return JSON.stringify({ imageId: m ? m[1] : null, confidence: 0.9, reason: 'same sender-address signal' });
    }
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db);

  // first fill — generates + tags an asset
  await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });
  const genCallsAfterFirst = egress.callsFor('image-generator').length;
  assert.equal(genCallsAfterFirst, 1, 'first fill generated one asset');

  const reuseEvents = [];
  ctx.bus.subscribe((evt) => {
    if (evt.type === 'stage_end' && evt.skill === 'reuse_asset') reuseEvents.push(evt);
  });

  // second fill — same signal, different wording. It is reused (via the
  // recommender's high-confidence pick) with ZERO new image-gen calls.
  await generateForSlot({ ctx, posterId, slotId: 'slot-2', source: 'generate', assetsDir });
  assert.equal(egress.callsFor('image-generator').length, 1, 'reuse made zero new image-gen calls');
  assert.equal(reuseEvents.length, 1, 'a reuse_asset event fired');
  const rp = typeof reuseEvents[0].payload === 'string' ? JSON.parse(reuseEvents[0].payload) : reuseEvents[0].payload;
  assert.equal(rp.reused, true, 'event marked reused:true');
  const payload = typeof reuseEvents[0].payload === 'string' ? JSON.parse(reuseEvents[0].payload) : reuseEvents[0].payload;
  assert.ok(payload.imageId, 'reuse names the reused asset id');
});

test('reuse via RECOMMENDER: conceptHash miss but a tag-overlapping asset is reused (SQL prefilter + model pick)', async () => {
  const egress = new FakeEgress({
    'image-concept/concept_for_point': [
      JSON.stringify({ concept: 'a magnifying glass over an email sender-address bar, the domain highlighted' }),
      JSON.stringify({ concept: 'a hand inspecting a suspicious sender address and domain on a card' }) // different concept → different hash
    ],
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'm' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT,
    'asset-recommender/recommend_asset': (opts) => {
      const m = /imageId=([0-9a-f-]+)/i.exec(opts.user);
      // recommender only runs when candidates exist → prove SQL prefilter surfaced one
      return JSON.stringify({ imageId: m ? m[1] : null, confidence: 0.88, reason: 'shares the sender-address/domain signal' });
    }
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db);

  await generateForSlot({ ctx, posterId, slotId: 'slot-1', source: 'generate', assetsDir });
  assert.equal(egress.callsFor('image-generator').length, 1);

  const recBefore = egress.callsFor('asset-recommender').length;
  await generateForSlot({ ctx, posterId, slotId: 'slot-2', source: 'generate', assetsDir });

  // the recommender WAS consulted (candidates existed via tag prefilter) and its
  // high-confidence pick was reused → still zero new image-gen calls
  assert.ok(egress.callsFor('asset-recommender').length > recBefore, 'recommender consulted on hash miss');
  assert.equal(egress.callsFor('image-generator').length, 1, 'recommender reuse → zero new image-gen');
});
