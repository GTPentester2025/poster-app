// background-options.test.js
// Tests for the background treatment choice + kind library filter feature.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { newRunId } from '#shared';
import { createAppContext } from '../../backend/app-context.js';
import { saveImage, listImages, markZeroTextCheck } from '../../image-library/store.js';
import {
  FakeEgress, GEN_IMAGE_1024, IMAGE_VISION_OUTPUT, IMAGE_BASE64
} from './helpers/fake_egress.js';
import { generateForSlot } from '../../pipelines/image_pipeline.js';

// ── shared helpers ───────────────────────────────────────────────────────────

function makeCtx(egress) {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-bg-opts-'));
  const ctx = createAppContext({
    dataDir, logDir: join(dataDir, 'runs'),
    dbPath: join(dataDir, 'test.sqlite'), egress
  });
  return { ctx, assetsDir: join(dataDir, 'image-library', 'assets') };
}

function seedBgPoster(db, { treatment = 'gradient-mesh', palette = null } = {}) {
  const posterId = randomUUID();
  const runId = newRunId('poster');
  const now = new Date().toISOString();
  const doc = {
    prompt: 'phishing', runId, phase: 'designed', grounded: true,
    contextId: `ctx-${posterId}`,
    contextFile: {
      topic: 'phishing',
      keywords: { core: ['phishing'], expanded: [] },
      synthesis: '', angles: [], sources: []
    },
    intent: null, selectedAngleIds: 'ai',
    content: {
      headline: 'Pause Before You Scan', subheadline: null,
      messages: [{ id: 'msg-1', label: 'DO', text: 'Type it yourself' }],
      callToAction: 'Report it', format: 'red-flags'
    },
    design: {
      templateId: 'minimal-clean', templateSource: 'predefined',
      layoutType: null, rationale: null, layoutSpec: null,
      background: { treatment, concept: 'dark ambient test background', rationale: '' },
      palette: palette || { background: '#F5F0E8', primary: '#C8102E', accent: '#E3AF32', dark: '#1F1A17' },
      canvas: {
        version: '6.7.1', width: 1414, height: 2000, background: '#F5F0E8',
        objects: [
          {
            type: 'Rect', left: 0, top: 0, width: 1414, height: 2000,
            fill: 'transparent', stroke: '#E3AF32', strokeWidth: 3,
            layerRole: 'image-slot', slotId: 'bg',
            slotSpec: { slotId: 'bg', styleHint: 'dark ambient background' }
          },
          {
            type: 'Textbox', left: 90, top: 110, width: 940,
            text: 'Pause', fontSize: 100, layerRole: 'headline'
          }
        ]
      },
      fonts: { head: 'Montserrat', body: 'Inter' }, reviewHistory: [], designedAt: now
    },
    reviewHistory: [], snapshots: []
  };
  db.prepare(
    'INSERT INTO posters (poster_id, name, status, created_at, updated_at, doc) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(posterId, 'bg test poster', 'designed', now, now, JSON.stringify(doc));
  return { posterId, runId };
}

// ── Test 1: valid treatmentOverride='gradient' overrides the design treatment ─

test('treatment override gradient: bg slot filled using gradient treatment alias', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'masked' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT,
    'background-reviewer/review_background': { score: 92 }
  });
  const { ctx, assetsDir } = makeCtx(egress);
  // Design decided 'gradient-mesh'; route/UI sends short alias 'gradient'
  const { posterId } = seedBgPoster(ctx.db, { treatment: 'gradient-mesh' });

  const state = await generateForSlot({
    ctx, posterId, slotId: 'bg', source: 'generate',
    treatmentOverride: 'gradient', assetsDir
  });
  const bgObj = state.design.canvas.objects.find((o) => o.slotId === 'bg');
  assert.equal(bgObj.type, 'Image', 'bg slot filled with gradient treatment override');

  // The generated prompt should reflect the gradient treatment (not 'image')
  const genCall = egress.callsFor('image-generator')[0].opts;
  assert.match(genCall.prompt, /gradient|aurora|colour mesh/i, 'gradient treatment clause in prompt');
});

// ── Test 2: treatment='pattern' override threads correct prompt clauses ───────

test('treatment override pattern: prompt contains pattern clause and brand palette clause', async () => {
  const palette = { primary: '#C8102E', accent: '#E3AF32', background: '#F5F0E8', dark: '#1F1A17' };
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'masked' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT,
    'background-reviewer/review_background': { score: 88 }
  });
  const { ctx, assetsDir } = makeCtx(egress);
  // Design decided 'image'; route/UI overrides to 'pattern'
  const { posterId } = seedBgPoster(ctx.db, { treatment: 'image', palette });

  await generateForSlot({
    ctx, posterId, slotId: 'bg', source: 'generate',
    treatmentOverride: 'pattern', assetsDir
  });

  const prompt = egress.callsFor('image-generator')[0].opts.prompt;
  // pattern clause
  assert.match(prompt, /geometric PATTERN|rhythmic repeating/i, 'pattern treatment clause in prompt');
  // brand palette clause (strict color palette from the poster's palette)
  assert.match(prompt, /STRICT COLOR PALETTE/i, 'brand palette clause in prompt');
  // legibility requirement (dark-dominant + text stays legible)
  assert.match(prompt, /dark.dominant|legible|text stays/i, 'legibility requirement in pattern prompt');
});

// ── Test 3: listImages kind=background filter ─────────────────────────────────

test('listImages kind=background filter: returns only rows with meta.kind=background', async () => {
  const { ctx, assetsDir } = makeCtx(new FakeEgress({}));
  const buf = Buffer.from(IMAGE_BASE64, 'base64');

  // save a background image (meta.kind='background')
  const bgRec = await saveImage({
    db: ctx.db, buffer: buf, origin: 'generated', topics: ['bg'],
    style: null, format: null,
    meta: { kind: 'background', attempt: 1, slotId: 'bg' }, assetsDir
  });
  markZeroTextCheck(ctx.db, bgRec.image_id, true);

  // save a foreground image (no kind in meta)
  const fgRec = await saveImage({
    db: ctx.db, buffer: buf, origin: 'generated', topics: ['phishing'],
    style: null, format: null,
    meta: { attempt: 1, slotId: 'slot-1' }, assetsDir
  });
  markZeroTextCheck(ctx.db, fgRec.image_id, true);

  // kind=background → only the background row
  const bgOnly = listImages({ db: ctx.db, kind: 'background' });
  assert.equal(bgOnly.length, 1, 'kind=background returns only background rows');
  assert.equal(bgOnly[0].image_id, bgRec.image_id, 'background row image_id matches');

  // kind=foreground → only the foreground row
  const fgOnly = listImages({ db: ctx.db, kind: 'foreground' });
  assert.equal(fgOnly.length, 1, 'kind=foreground returns only foreground rows');
  assert.equal(fgOnly[0].image_id, fgRec.image_id, 'foreground row image_id matches');

  // no kind filter → both rows
  const all = listImages({ db: ctx.db });
  assert.equal(all.length, 2, 'no kind filter returns all rows');
});

// ── Test 4: saveImage records kind when meta includes it ──────────────────────

test('saveImage: meta.kind=background is persisted and readable back from DB', async () => {
  const { ctx, assetsDir } = makeCtx(new FakeEgress({}));
  const buf = Buffer.from(IMAGE_BASE64, 'base64');

  const rec = await saveImage({
    db: ctx.db, buffer: buf, origin: 'generated', topics: [],
    style: null, format: null,
    meta: { kind: 'background', slotId: 'bg', attempt: 1 }, assetsDir
  });

  const row = ctx.db.prepare('SELECT meta FROM images WHERE image_id = ?').get(rec.image_id);
  assert.ok(row, 'row saved');
  const meta = JSON.parse(row.meta);
  assert.equal(meta.kind, 'background', 'kind=background persisted in meta');
});

// ── Test 5: bg slot fill via pipeline records kind=background on saved asset ──

test('bg slot fill: generated image row has meta.kind=background', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, maskedPrompt: 'masked' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT,
    'background-reviewer/review_background': { score: 91 }
  });
  const { ctx, assetsDir } = makeCtx(egress);
  const { posterId } = seedBgPoster(ctx.db, { treatment: 'gradient-mesh' });

  await generateForSlot({ ctx, posterId, slotId: 'bg', source: 'generate', assetsDir });

  // The image row saved by the pipeline for the bg slot must have kind='background' in meta
  const rows = ctx.db.prepare('SELECT meta FROM images WHERE zero_text_passed = 1').all();
  assert.equal(rows.length, 1, 'one passed image row');
  const meta = JSON.parse(rows[0].meta || '{}');
  assert.equal(meta.kind, 'background', 'bg slot fill records kind=background in meta');
});
