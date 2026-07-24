// Tests for POST /api/images/generate-background
// Covers: happy path (kind:'background', description+tags in meta, zero-text gate
// ran); treatment enum 400; similarTo 404; dedupe-awareness list present in
// the egress prompt; similarTo swaps to the SIMILAR clause.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from '../../backend/server.js';
import { createAppContext } from '../../backend/app-context.js';
import {
  FakeEgress, IMAGE_BASE64, IMAGE_VISION_OUTPUT
} from './helpers/fake_egress.js';

// ── Server factory (one per test — isolated DB + assets dir) ─────────────────

function startServer(egress) {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-bg-gen-'));
  const imageAssetsDir = join(dataDir, 'image-library', 'assets');
  const ctx = createAppContext({
    dataDir,
    logDir: join(dataDir, 'runs'),
    dbPath: join(dataDir, 'test.sqlite'),
    egress
  });
  const { app, token } = createServer(ctx, { dataDir, imageAssetsDir });
  return new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => {
      resolve({ srv, ctx, token, base: `http://127.0.0.1:${srv.address().port}`, imageAssetsDir });
    });
  });
}

function req(base, token, path, method = 'GET', body = undefined) {
  return fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}

// ── Helper: seed a background image directly in the DB (no generation needed) ─

function seedBackground(ctx, description, imageAssetsDir) {
  mkdirSync(imageAssetsDir, { recursive: true });
  const imageId = randomUUID();
  const fileName = `${imageId}.png`;
  writeFileSync(join(imageAssetsDir, fileName), Buffer.from(IMAGE_BASE64, 'base64'));
  const now = new Date().toISOString();
  const meta = JSON.stringify({
    kind: 'background',
    description,
    tags: ['background', 'gradient'],
    treatment: 'gradient'
  });
  ctx.db.prepare(
    `INSERT INTO images (image_id, file_name, origin, topics, style, format, zero_text_checked, zero_text_passed, created_at, meta)
     VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`
  ).run(imageId, fileName, 'generated', JSON.stringify(['background']), 'gradient', null, now, meta);
  return imageId;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('generate-background happy path: returns image with kind background, description, tags, zero-text gate ran', async () => {
  let genCallCount = 0;
  let visionCallCount = 0;
  const egress = new FakeEgress({
    'image-generator/generate_asset': () => {
      genCallCount++;
      return { imageBase64: IMAGE_BASE64, maskedPrompt: `bg-prompt-${genCallCount}` };
    },
    'image-text-gate/detect_embedded_text': () => {
      visionCallCount++;
      return IMAGE_VISION_OUTPUT;
    }
  });

  const { srv, base, token } = await startServer(egress);
  try {
    const res = await req(base, token, '/api/images/generate-background', 'POST', {
      treatment: 'gradient',
      prompt: 'a warm amber sunrise gradient'
    });
    assert.equal(res.status, 201, 'returns 201');
    const { image } = await res.json();
    assert.ok(image, 'image returned');
    assert.ok(image.image_id, 'image has image_id');

    // kind must be 'background' in meta
    const meta = image.meta;
    assert.ok(meta, 'meta present');
    assert.equal(meta.kind, 'background', 'meta.kind is background');

    // description and tags must be in meta
    assert.ok(typeof meta.description === 'string' && meta.description.length > 0, 'meta.description is a non-empty string');
    assert.ok(Array.isArray(meta.tags) && meta.tags.length > 0, 'meta.tags is a non-empty array');

    // zero-text gate must have run (vision call)
    assert.equal(visionCallCount, 1, 'zero-text gate ran exactly once');

    // origin must be 'generated' (constraint-allowed value; kind:'background' in meta distinguishes it)
    assert.equal(image.origin, 'generated', 'origin is generated');
  } finally { srv.close(); }
});

test('generate-background: invalid treatment returns 400', async () => {
  const egress = new FakeEgress({});
  const { srv, base, token } = await startServer(egress);
  try {
    const res = await req(base, token, '/api/images/generate-background', 'POST', {
      treatment: 'watercolor'
    });
    assert.equal(res.status, 400, '400 for unknown treatment');
    const body = await res.json();
    assert.ok(body.error, 'error field present');
    assert.ok(body.error.toLowerCase().includes('treatment'), 'error mentions treatment');
  } finally { srv.close(); }
});

test('generate-background: missing treatment returns 400', async () => {
  const egress = new FakeEgress({});
  const { srv, base, token } = await startServer(egress);
  try {
    const res = await req(base, token, '/api/images/generate-background', 'POST', {
      prompt: 'a nice gradient'
    });
    assert.equal(res.status, 400, '400 when treatment omitted');
  } finally { srv.close(); }
});

test('generate-background: similarTo with non-existent id returns 404', async () => {
  const egress = new FakeEgress({});
  const { srv, base, token } = await startServer(egress);
  try {
    const res = await req(base, token, '/api/images/generate-background', 'POST', {
      treatment: 'pattern',
      similarTo: 'does-not-exist-abc123'
    });
    assert.equal(res.status, 404, '404 for unknown similarTo');
    const body = await res.json();
    assert.equal(body.error, 'SIMILAR_TO_NOT_FOUND');
  } finally { srv.close(); }
});

test('generate-background: dedupe awareness list is present in the outbound prompt when recent backgrounds exist', async () => {
  let capturedPrompt = '';
  const egress = new FakeEgress({
    'image-generator/generate_asset': (opts) => {
      capturedPrompt = opts.prompt || '';
      return { imageBase64: IMAGE_BASE64, maskedPrompt: 'bg-masked' };
    },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { srv, ctx, base, token, imageAssetsDir } = await startServer(egress);
  try {
    // Seed an existing background so the dedupe list is non-empty
    seedBackground(ctx, 'a warm amber sunrise gradient over dark skyline', imageAssetsDir);

    const res = await req(base, token, '/api/images/generate-background', 'POST', {
      treatment: 'gradient'
    });
    assert.equal(res.status, 201, 'generation succeeded');

    // The outbound generation prompt must contain the dedupe clause
    assert.ok(
      capturedPrompt.includes('DO NOT duplicate'),
      `prompt should contain dedupe clause; got head: ${capturedPrompt.slice(0, 300)}`
    );
    assert.ok(
      capturedPrompt.includes('a warm amber sunrise gradient over dark skyline'),
      'prompt should include the existing background description'
    );
  } finally { srv.close(); }
});

test('generate-background: similarTo swaps dedupe list for SIMILAR clause', async () => {
  let capturedPrompt = '';
  const egress = new FakeEgress({
    'image-generator/generate_asset': (opts) => {
      capturedPrompt = opts.prompt || '';
      return { imageBase64: IMAGE_BASE64, maskedPrompt: 'bg-similar-masked' };
    },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { srv, ctx, base, token, imageAssetsDir } = await startServer(egress);
  try {
    // Seed an existing background that we'll use as the similarTo reference
    const refId = seedBackground(ctx, 'deep ocean teal wave pattern on midnight background', imageAssetsDir);

    const res = await req(base, token, '/api/images/generate-background', 'POST', {
      treatment: 'pattern',
      similarTo: refId
    });
    assert.equal(res.status, 201, 'generation succeeded with similarTo');

    // The outbound prompt must contain the SIMILAR clause, not the dedupe list
    assert.ok(
      capturedPrompt.includes('SIMILAR'),
      `prompt should contain SIMILAR clause; got head: ${capturedPrompt.slice(0, 300)}`
    );
    assert.ok(
      capturedPrompt.includes('deep ocean teal wave pattern on midnight background'),
      'prompt should include the similar-to description'
    );
    // Must NOT contain the dedupe "DO NOT duplicate" clause when similarTo is given
    assert.ok(
      !capturedPrompt.includes('DO NOT duplicate'),
      'SIMILAR path should not include the DO NOT duplicate clause'
    );
  } finally { srv.close(); }
});

test('generate-background: prompt over 500 chars returns 400', async () => {
  const egress = new FakeEgress({});
  const { srv, base, token } = await startServer(egress);
  try {
    const res = await req(base, token, '/api/images/generate-background', 'POST', {
      treatment: 'gradient',
      prompt: 'a'.repeat(501)
    });
    assert.equal(res.status, 400, '400 for oversized prompt');
  } finally { srv.close(); }
});

test('generate-background: all three valid treatments are accepted', async () => {
  for (const treatment of ['gradient', 'pattern', 'image']) {
    const egress = new FakeEgress({
      'image-generator/generate_asset': { imageBase64: IMAGE_BASE64, maskedPrompt: `masked-${treatment}` },
      'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
    });
    const { srv, base, token } = await startServer(egress);
    try {
      const res = await req(base, token, '/api/images/generate-background', 'POST', { treatment });
      assert.equal(res.status, 201, `treatment '${treatment}' returns 201`);
    } finally { srv.close(); }
  }
});
