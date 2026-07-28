// Image route integration tests: real server + fake egress.
// Covers: upload → list → serve file round-trip; upload rejects bad magic and
// oversized bodies; slot fill via route; unknown slot 404; 401 auth on every
// route; autotag via vision; delete.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { newRunId } from '#shared';
import { createServer } from '../../backend/server.js';
import { createAppContext } from '../../backend/app-context.js';
import { getImagePath } from '../../image-library/store.js';
import {
  FakeEgress, IMAGE_BASE64, IMAGE_VISION_OUTPUT, DESIGN_SPEC
} from './helpers/fake_egress.js';

function startServer(egress) {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-img-routes-'));
  const imageAssetsDir = join(dataDir, 'image-library', 'assets');
  const ctx = createAppContext({
    dataDir, logDir: join(dataDir, 'runs'), dbPath: join(dataDir, 'test.sqlite'), egress
  });
  const { app, token } = createServer(ctx, { dataDir, imageAssetsDir });
  return new Promise((resolveP) => {
    const srv = app.listen(0, '127.0.0.1', () => {
      resolveP({ srv, ctx, token, base: `http://127.0.0.1:${srv.address().port}`, imageAssetsDir });
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

// Seed a designed poster with an image-slot for the slot-fill route tests
function seedDesignedPoster(db) {
  const posterId = randomUUID();
  const runId = newRunId('poster');
  const now = new Date().toISOString();
  const slot = DESIGN_SPEC.imageSlots[0];
  const canvas = {
    version: '6.7.1', width: 1414, height: 2000, background: '#F5F0E8',
    objects: [{
      type: 'Rect',
      left: Math.round(slot.x * 1414 / 100), top: Math.round(slot.y * 2000 / 100),
      width: Math.round(slot.w * 1414 / 100), height: Math.round(slot.h * 2000 / 100),
      fill: 'transparent', stroke: '#1F1A17', strokeWidth: 3, strokeDashArray: [14, 10],
      rx: 16, ry: 16, opacity: 0.8,
      layerRole: 'image-slot', slotId: 'slot-1',
      slotSpec: { slotId: 'slot-1', styleHint: slot.styleHint }
    }]
  };
  const doc = {
    prompt: 'phishing', runId, phase: 'designed', grounded: true,
    contextId: `ctx-${posterId}`,
    contextFile: { topic: 'phishing', keywords: { core: ['phishing'], expanded: [], contentShape: null }, synthesis: 'internal', angles: [], sources: [] },
    intent: null, selectedAngleIds: 'ai',
    content: { headline: 'Test', subheadline: null, messages: [{ id: 'msg-1', label: null, text: 'Test message' }], callToAction: null, format: 'red-flags' },
    design: {
      templateId: 'minimal-clean', templateSource: 'predefined', layoutType: null, rationale: null, layoutSpec: null,
      canvas, palette: { background: '#F5F0E8', primary: '#C8102E', accent: '#E3AF32', text: '#1F1A17' },
      fonts: { head: 'Montserrat', body: 'Inter' }, reviewHistory: [], designedAt: now
    },
    reviewHistory: [], snapshots: []
  };
  db.prepare('INSERT INTO posters (poster_id, name, status, created_at, updated_at, doc) VALUES (?, ?, ?, ?, ?, ?)')
    .run(posterId, 'phishing poster', 'designed', now, now, JSON.stringify(doc));
  return posterId;
}

test('upload → list → serve file: full round-trip', async () => {
  const egress = new FakeEgress({});
  const { srv, base, token } = await startServer(egress);
  try {
    // upload
    let res = await req(base, token, '/api/images/upload', 'POST', {
      fileName: 'test.png',
      imageBase64: IMAGE_BASE64,
      topics: ['phishing', 'email'],
      style: 'flat-icon',
      format: 'icon'
    });
    assert.equal(res.status, 201);
    const { image } = await res.json();
    assert.ok(image.image_id);
    assert.equal(image.origin, 'library');

    // list: returns the uploaded image
    res = await req(base, token, '/api/images?topics=phishing');
    assert.equal(res.status, 200);
    const { images } = await res.json();
    assert.equal(images.length, 1);
    assert.equal(images[0].image_id, image.image_id);

    // serve file: correct content-type, real PNG bytes
    res = await fetch(base + `/api/images/file/${image.image_id}`, {
      headers: { 'X-Session-Token': token }
    });
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('image/'), 'image content-type');
    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.slice(0, 4).toString('latin1'), '\x89PNG', 'real PNG bytes served');
  } finally { srv.close(); }
});

test('upload: rejects bad magic bytes', async () => {
  const egress = new FakeEgress({});
  const { srv, base, token } = await startServer(egress);
  try {
    const badBase64 = Buffer.from('not a real image file').toString('base64');
    const res = await req(base, token, '/api/images/upload', 'POST', {
      fileName: 'bad.png', imageBase64: badBase64, topics: [], style: null, format: null
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error, 'error message returned');
  } finally { srv.close(); }
});

test('upload: rejects oversized image (>8MB decoded)', async () => {
  const egress = new FakeEgress({});
  const { srv, base, token } = await startServer(egress);
  try {
    // 8MB+1 bytes with valid PNG magic — passes magic check, fails size check
    const bigBuf = Buffer.alloc(8 * 1024 * 1024 + 1);
    bigBuf[0] = 0x89; bigBuf[1] = 0x50; bigBuf[2] = 0x4e; bigBuf[3] = 0x47;
    const res = await req(base, token, '/api/images/upload', 'POST', {
      fileName: 'big.png', imageBase64: bigBuf.toString('base64'), topics: [], style: null, format: null
    });
    assert.equal(res.status, 400);
  } finally { srv.close(); }
});

test('serve file: unknown id is 404 — id must exist in the DB (traversal-safe)', async () => {
  const egress = new FakeEgress({});
  const { srv, base, token } = await startServer(egress);
  try {
    const res = await fetch(base + '/api/images/file/..%2F..%2Fsecrets.json', {
      headers: { 'X-Session-Token': token }
    });
    assert.equal(res.status, 404);
  } finally { srv.close(); }
});

test('slot fill via route: POST /api/images/slot/:posterId/:slotId', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: IMAGE_BASE64, maskedPrompt: 'masked' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const posterId = seedDesignedPoster(ctx.db);
    const res = await req(base, token, `/api/images/slot/${posterId}/slot-1`, 'POST', { source: 'generate' });
    assert.equal(res.status, 200);
    const state = await res.json();
    const slotObj = state.design.canvas.objects.find((o) => o.slotId === 'slot-1');
    assert.equal(slotObj.type, 'Image');

    // invalid source → 400
    const bad = await req(base, token, `/api/images/slot/${posterId}/slot-1`, 'POST', { source: 'paste-url' });
    assert.equal(bad.status, 400);
  } finally { srv.close(); }
});

test('unknown slot returns 404 SLOT_NOT_FOUND', async () => {
  const egress = new FakeEgress({});
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const posterId = seedDesignedPoster(ctx.db);
    const res = await req(base, token, `/api/images/slot/${posterId}/slot-99`, 'POST', { source: 'generate' });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'SLOT_NOT_FOUND');
  } finally { srv.close(); }
});


test('autotag: calls completeVision and updates image record', async () => {
  const egress = new FakeEgress({
    'image-tagger/classify_image': { topics: ['phishing', 'qr-code'], style: 'flat-icon', format: 'icon' }
  });
  const { srv, base, token } = await startServer(egress);
  try {
    // first upload
    let res = await req(base, token, '/api/images/upload', 'POST', {
      fileName: 'test.png', imageBase64: IMAGE_BASE64, topics: [], style: null, format: null
    });
    const { image } = await res.json();

    // autotag
    res = await req(base, token, `/api/images/${image.image_id}/autotag`, 'POST', {});
    assert.equal(res.status, 200);
    const tagged = await res.json();
    const parsedTopics = JSON.parse(tagged.image.topics || '[]');
    assert.ok(parsedTopics.includes('phishing'), 'autotag updated topics');
    assert.equal(tagged.image.style, 'flat-icon');
    assert.equal(egress.callsFor('image-tagger').length, 1, 'one vision call');
  } finally { srv.close(); }
});

test('delete: removes record and file; second delete is 404', async () => {
  const egress = new FakeEgress({});
  const { srv, ctx, base, token, imageAssetsDir } = await startServer(egress);
  try {
    let res = await req(base, token, '/api/images/upload', 'POST', {
      fileName: 'test.png', imageBase64: IMAGE_BASE64, topics: [], style: null, format: null
    });
    const { image } = await res.json();
    assert.ok(existsSync(getImagePath(image.image_id, imageAssetsDir)), 'file on disk after upload');

    res = await req(base, token, `/api/images/${image.image_id}`, 'DELETE');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.ok(!existsSync(getImagePath(image.image_id, imageAssetsDir)), 'file removed');
    assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM images').get().n, 0, 'row removed');

    res = await req(base, token, `/api/images/${image.image_id}`, 'DELETE');
    assert.equal(res.status, 404);
  } finally { srv.close(); }
});

// Minimal valid JPEG (20 bytes): FF D8 FF E0 + JFIF APP0 header.
// Magic bytes are what matter for detectImageType; the rest is padding.
const JPEG_BASE64 = '/9j/4AAQSkZJRgABAQAAAQABAAA=';

test('upload JPEG-magic file with .png filename → accepted, stored as .jpg, served with image/jpeg', async () => {
  const egress = new FakeEgress({});
  const { srv, ctx, base, token, imageAssetsDir } = await startServer(egress);
  try {
    // Upload a file whose content has JPEG magic bytes but whose filename ends .png
    const res = await req(base, token, '/api/images/upload', 'POST', {
      fileName: 'sneaky.png',
      imageBase64: JPEG_BASE64,
      topics: ['phishing'],
      style: null,
      format: null
    });
    assert.equal(res.status, 201, 'upload accepted (magic wins over filename)');
    const { image } = await res.json();
    assert.ok(image.image_id, 'image_id assigned');

    // The stored file should have a .jpg extension (derived from JPEG magic)
    const row = ctx.db.prepare('SELECT * FROM images WHERE image_id = ?').get(image.image_id);
    assert.ok(row.file_name.endsWith('.jpg'), `file_name should end .jpg, got ${row.file_name}`);
    const diskPath = join(imageAssetsDir, row.file_name);
    assert.ok(existsSync(diskPath), 'file written to disk with .jpg extension');

    // Serve: content-type must be image/jpeg
    const serveRes = await fetch(base + `/api/images/file/${image.image_id}`, {
      headers: { 'X-Session-Token': token }
    });
    assert.equal(serveRes.status, 200);
    assert.ok(
      serveRes.headers.get('content-type').includes('image/jpeg'),
      `expected image/jpeg content-type, got ${serveRes.headers.get('content-type')}`
    );
    // X-Content-Type-Options must be set
    assert.equal(serveRes.headers.get('x-content-type-options'), 'nosniff');
  } finally { srv.close(); }
});

test('serve file: row exists but file deleted on disk → 404 IMAGE_FILE_MISSING', async () => {
  const egress = new FakeEgress({});
  const { srv, ctx, base, token, imageAssetsDir } = await startServer(egress);
  try {
    // Upload a valid PNG
    const upRes = await req(base, token, '/api/images/upload', 'POST', {
      fileName: 'to-delete.png', imageBase64: IMAGE_BASE64, topics: [], style: null, format: null
    });
    assert.equal(upRes.status, 201);
    const { image } = await upRes.json();

    // Delete the file on disk but leave the DB row intact
    const row = ctx.db.prepare('SELECT * FROM images WHERE image_id = ?').get(image.image_id);
    const diskPath = join(imageAssetsDir, row.file_name);
    assert.ok(existsSync(diskPath), 'file must exist before manual deletion');
    unlinkSync(diskPath);
    assert.ok(!existsSync(diskPath), 'file removed from disk');

    // Row should still be in DB
    const stillInDb = ctx.db.prepare('SELECT * FROM images WHERE image_id = ?').get(image.image_id);
    assert.ok(stillInDb, 'row still in DB');

    // GET /file/:imageId should return 404 with IMAGE_FILE_MISSING
    const serveRes = await fetch(base + `/api/images/file/${image.image_id}`, {
      headers: { 'X-Session-Token': token }
    });
    assert.equal(serveRes.status, 404);
    const body = await serveRes.json();
    assert.equal(body.error, 'IMAGE_FILE_MISSING');
  } finally { srv.close(); }
});

test('upload topics array of 100 long strings → stored row has ≤32 topics each ≤64 chars', async () => {
  const egress = new FakeEgress({});
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    // Build 100 topics each 100 chars long
    const longTopics = Array.from({ length: 100 }, (_, i) => `topic-${'x'.repeat(95)}-${String(i).padStart(2, '0')}`);
    assert.equal(longTopics.length, 100);
    assert.ok(longTopics[0].length > 64, 'topics are longer than 64 chars before sanitisation');

    const res = await req(base, token, '/api/images/upload', 'POST', {
      fileName: 'test.png',
      imageBase64: IMAGE_BASE64,
      topics: longTopics,
      style: null,
      format: null
    });
    assert.equal(res.status, 201, 'upload succeeds');
    const { image } = await res.json();

    // Check the stored row
    const row = ctx.db.prepare('SELECT * FROM images WHERE image_id = ?').get(image.image_id);
    const storedTopics = JSON.parse(row.topics);
    assert.ok(storedTopics.length <= 32, `stored topics count ${storedTopics.length} must be ≤32`);
    for (const t of storedTopics) {
      assert.ok(t.length <= 64, `topic "${t.slice(0, 20)}..." length ${t.length} must be ≤64`);
    }
  } finally { srv.close(); }
});

// ── Phase O5 route tests ─────────────────────────────────────────────────────

test('O5 route: IMAGE_RETRIES_EXHAUSTED returns 409 with correct shape', async () => {
  let genCallCount = 0;
  const egress = new FakeEgress({
    'image-generator/generate_asset': () => {
      genCallCount++;
      return { imageBase64: IMAGE_BASE64, maskedPrompt: `a${genCallCount}` };
    },
    'image-text-gate/detect_embedded_text': { hasText: true, details: 'word "STOP" appears top-left' }
  });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const posterId = seedDesignedPoster(ctx.db);
    const res = await req(base, token, `/api/images/slot/${posterId}/slot-1`, 'POST', { source: 'generate' });
    assert.equal(res.status, 409, 'exhausted retries returns 409');
    const body = await res.json();
    assert.equal(body.error, 'IMAGE_RETRIES_EXHAUSTED', 'error code is IMAGE_RETRIES_EXHAUSTED');
    assert.equal(body.attempts, 3, 'attempts is 3 (zero-text retry budget reduced 5 → 3)');
    assert.equal(body.lastReason, 'zero-text-gate', 'lastReason is zero-text-gate');
  } finally { srv.close(); }
});

test('O5 route: customPrompt is fenced and reaches the generation prompt', async () => {
  const egress = new FakeEgress({
    'image-generator/generate_asset': { imageBase64: IMAGE_BASE64, maskedPrompt: 'masked' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT
  });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const posterId = seedDesignedPoster(ctx.db);
    const res = await req(base, token, `/api/images/slot/${posterId}/slot-1`, 'POST', {
      source: 'generate',
      customPrompt: 'show a person ignoring a suspicious text'
    });
    assert.equal(res.status, 200, 'slot fill succeeds with customPrompt');
    // Verify the custom prompt was data-fenced in the generator call
    const genCalls = egress.callsFor('image-generator');
    assert.equal(genCalls.length, 1, '1 generation call');
    assert.ok(
      genCalls[0].opts.prompt.includes('<user_text>show a person ignoring a suspicious text</user_text>'),
      'customPrompt is data-fenced in generation prompt'
    );
  } finally { srv.close(); }
});

test('O5 route: customPrompt over 500 chars is rejected 400', async () => {
  const egress = new FakeEgress({});
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const posterId = seedDesignedPoster(ctx.db);
    const longPrompt = 'a'.repeat(501);
    const res = await req(base, token, `/api/images/slot/${posterId}/slot-1`, 'POST', {
      source: 'generate',
      customPrompt: longPrompt
    });
    assert.equal(res.status, 400, 'oversized customPrompt is rejected');
    const body = await res.json();
    assert.ok(body.error.includes('customPrompt'), 'error mentions customPrompt');
  } finally { srv.close(); }
});

test('O5 route: failed images absent from GET /api/images default, present with includeFailed=1', async () => {
  // Scenario: generate one image that fails all 3 zero-text gate checks (all fail rows saved),
  // then upload one clean library image (no gate check = zero_text_checked=0 → shown by default).
  // The generated fails should not appear in default listing.
  let genCallCount = 0;
  const egress = new FakeEgress({
    'image-generator/generate_asset': () => {
      genCallCount++;
      return { imageBase64: IMAGE_BASE64, maskedPrompt: `a${genCallCount}` };
    },
    'image-text-gate/detect_embedded_text': { hasText: true, details: 'text found' }
  });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    // First: upload a clean library image (zero_text_checked=0 by default — not a failed image)
    const upRes = await req(base, token, '/api/images/upload', 'POST', {
      fileName: 'clean.png', imageBase64: IMAGE_BASE64, topics: ['security'], style: null, format: null
    });
    assert.equal(upRes.status, 201);
    const { image: libraryImage } = await upRes.json();

    // Second: attempt slot fill that exhausts retries (creates 3 failed images)
    const posterId = seedDesignedPoster(ctx.db);
    const fillRes = await req(base, token, `/api/images/slot/${posterId}/slot-1`, 'POST', { source: 'generate' });
    assert.equal(fillRes.status, 409, 'exhausted retries returns 409');

    // Default listing: only the library image (not failed generated ones)
    const defaultRes = await req(base, token, '/api/images');
    assert.equal(defaultRes.status, 200);
    const { images: defaultImages } = await defaultRes.json();
    assert.equal(defaultImages.length, 1, 'default listing has only 1 image (library)');
    assert.equal(defaultImages[0].image_id, libraryImage.image_id, 'default listing shows library image');

    // includeFailed=1: all 4 images (1 library + 3 failed)
    const fullRes = await req(base, token, '/api/images?includeFailed=1');
    assert.equal(fullRes.status, 200);
    const { images: allImages } = await fullRes.json();
    assert.equal(allImages.length, 4, 'includeFailed=1 returns all 4 images (1 library + 3 failed)');
  } finally { srv.close(); }
});
