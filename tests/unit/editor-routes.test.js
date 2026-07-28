// Editor route tests (spec §B.8) over the real server: PUT canvas happy path
// (persisted verbatim, snapshot appended, exactly one user_action event, ZERO
// agent/model/review activity — editor edits are user changes), validation
// (object cap 400, size cap 413, non-string text 400, wrong phase 409, 404,
// 401), the remote-src exfil sanitizer, the custom-prop data-model
// round-trip through GET /api/design/:posterId, per-language variant saves
// (?lang=) and T3 orientation-aware saves (?orientation=landscape → 2000x1414
// against design.landscape.canvas / variant.landscapeCanvas).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../../backend/server.js';
import { createAppContext } from '../../backend/app-context.js';
import {
  FakeEgress, seedArticles, INTENT_OUTPUT, CONTEXT_OUTPUT, POSTER_CONTENT, ACCEPT_REVIEW
} from './helpers/fake_egress.js';

function startServer(egress) {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-editor-routes-'));
  const ctx = createAppContext({
    dataDir, logDir: join(dataDir, 'runs'), dbPath: join(dataDir, 'test.sqlite'), egress
  });
  seedArticles(ctx.db);
  const { app, token } = createServer(ctx, { dataDir });
  return new Promise((resolvePromise) => {
    const srv = app.listen(0, '127.0.0.1', () => {
      resolvePromise({ srv, ctx, token, base: `http://127.0.0.1:${srv.address().port}` });
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

const CONTENT_HANDLERS = {
  'keyword-intent': INTENT_OUTPUT,
  'rag-research/synthesize_context': CONTEXT_OUTPUT,
  'content-generator': () => structuredClone(POSTER_CONTENT),
  'content-reviewer': ACCEPT_REVIEW
};

/** start → angles('ai') → approve → apply template; returns the designed state. */
async function designedPoster(base, token) {
  const started = await (await req(base, token, '/api/pipeline/start', 'POST', { prompt: 'stop phishing emails' })).json();
  await req(base, token, `/api/pipeline/${started.posterId}/angles`, 'POST', { angleIds: 'ai' });
  await req(base, token, `/api/pipeline/${started.posterId}/approve`, 'POST', {});
  const res = await req(base, token, `/api/design/${started.posterId}/apply`, 'POST', { templateId: 'minimal-clean' });
  assert.equal(res.status, 200);
  return res.json();
}

function loadDoc(ctx, posterId) {
  return JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc);
}

test('PUT canvas happy path: saved verbatim, snapshot +1, one user_action, no agent activity', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const posterId = designed.posterId;
    const runId = designed.runId;

    const snapshotsBefore = loadDoc(ctx, posterId).snapshots.length;
    const eventsBefore = ctx.bus.eventsForRun(runId).length;
    const egressCallsBefore = egress.calls.length;

    // edit like the editor does: recolor an object + add a user text layer
    const canvas = structuredClone(designed.design.canvas);
    canvas.objects[0].fill = '#123456';
    canvas.objects.push({
      type: 'Textbox', left: 100, top: 100, width: 520, text: 'Check the sender domain',
      fontSize: 56, fontFamily: 'Inter', fill: '#1F1A17', layerRole: 'user-text'
    });

    const res = await req(base, token, `/api/editor/${posterId}/canvas`, 'PUT', { canvas });
    assert.equal(res.status, 200);
    const state = await res.json();
    assert.equal(state.phase, 'designed', 'editing never regresses or advances the phase');
    assert.equal(state.status, 'designed', 'status untouched — explicit save-with-name owns "saved"');
    assert.equal(state.design.canvas.objects.at(-1).text, 'Check the sender domain');
    assert.equal(state.design.canvas.objects.at(-1).layerRole, 'user-text');
    assert.equal(state.design.canvas.objects[0].fill, '#123456');
    assert.equal(state.design.canvas.width, 1414);
    assert.equal(state.design.canvas.height, 2000);

    // snapshot appended
    const doc = loadDoc(ctx, posterId);
    assert.equal(doc.snapshots.length, snapshotsBefore + 1);
    assert.equal(doc.snapshots.at(-1).state.trigger, 'editor-save');

    // exactly ONE new event: the user_action — no gate/review/agent events
    const newEvents = ctx.bus.eventsForRun(runId).slice(eventsBefore);
    assert.equal(newEvents.length, 1);
    assert.equal(newEvents[0].type, 'user_action');
    assert.equal(newEvents[0].pipeline, 'editor');
    assert.equal(newEvents[0].agent, 'user');
    assert.equal(JSON.parse(newEvents[0].payload).action, 'editor-save');
    assert.equal(egress.calls.length, egressCallsBefore, 'an editor save must never call a model');
  } finally { srv.close(); }
});

test('data-model round-trip: layerRole/msgId/slotId/slotSpec/imageId survive save → GET', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const canvas = structuredClone(designed.design.canvas);
    // I6-shaped fitted slot image: cover-scaled with an absolutePositioned Rect
    // clipPath (no src inside — the sanitiser must pass it through untouched)
    const fittedClipPath = {
      type: 'Rect', left: 80, top: 900, width: 400, height: 300,
      rx: 16, ry: 16, absolutePositioned: true
    };
    canvas.objects.push({
      type: 'Image', left: 80, top: 850, width: 1024, height: 1024,
      scaleX: 400 / 1024, scaleY: 400 / 1024, clipPath: fittedClipPath,
      src: '/api/images/file/img-123', layerRole: 'image', slotId: 'slot-edit-1',
      imageId: 'img-123', slotSpec: { slotId: 'slot-edit-1', styleHint: 'flat illustration, no text' }
    });

    assert.equal((await req(base, token, `/api/editor/${designed.posterId}/canvas`, 'PUT', { canvas })).status, 200);

    const fetched = await (await req(base, token, `/api/design/${designed.posterId}`)).json();
    const objs = fetched.design.canvas.objects;
    // template-compiled props intact
    const messageObjs = objs.filter((o) => o.layerRole === 'message');
    assert.ok(messageObjs.length >= 3, 'message layers survive the round-trip');
    assert.ok(messageObjs.every((o) => typeof o.msgId === 'string' && o.msgId.startsWith('msg-')));
    // the image object added by the editor keeps its full slot identity
    const img = objs.find((o) => o.slotId === 'slot-edit-1');
    assert.equal(img.layerRole, 'image');
    assert.equal(img.imageId, 'img-123');
    assert.equal(img.src, '/api/images/file/img-123');
    assert.deepEqual(img.slotSpec, { slotId: 'slot-edit-1', styleHint: 'flat illustration, no text' });
    // I6: the fitted-placement clipPath round-trips UNMODIFIED (src-less Rect —
    // the recursive src sanitiser leaves it alone) along with the cover scale
    assert.deepEqual(img.clipPath, fittedClipPath, 'clipPath survives save → GET byte-equal');
    assert.equal(img.scaleX, 400 / 1024);
    assert.equal(img.scaleY, 400 / 1024);
  } finally { srv.close(); }
});

test('src sanitizer: remote/absolute srcs stripped (top-level and nested), safe srcs kept', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const canvas = structuredClone(designed.design.canvas);
    canvas.objects.push(
      { type: 'Image', left: 0, top: 0, width: 10, height: 10, src: 'https://evil.example/pixel.png' },
      { type: 'Image', left: 0, top: 0, width: 10, height: 10, src: 'http://127.0.0.1:4180/api/images/file/x' },
      { type: 'Image', left: 0, top: 0, width: 10, height: 10, src: '/api/images/file/img-ok', imageId: 'img-ok' },
      { type: 'Image', left: 0, top: 0, width: 10, height: 10, src: 'data:image/png;base64,iVBORw0KGgo=' },
      {
        type: 'Rect', left: 0, top: 0, width: 10, height: 10, fill: '#000000',
        clipPath: { type: 'Image', src: '//evil.example/protocol-relative.png' }
      }
    );
    const res = await req(base, token, `/api/editor/${designed.posterId}/canvas`, 'PUT', { canvas });
    assert.equal(res.status, 200);
    const saved = (await res.json()).design.canvas;
    const tail = saved.objects.slice(-5);
    assert.ok(!('src' in tail[0]), 'remote https src stripped');
    assert.ok(!('src' in tail[1]), 'absolute local URL stripped (client sends relative paths)');
    assert.equal(tail[2].src, '/api/images/file/img-ok', 'relative library src kept');
    assert.ok(tail[3].src.startsWith('data:image/'), 'data:image src kept');
    assert.ok(!('src' in tail[4].clipPath), 'nested (clipPath) src stripped too');

    // stripping is persisted, not just echoed
    const fetched = await (await req(base, token, `/api/design/${designed.posterId}`)).json();
    assert.ok(!('src' in fetched.design.canvas.objects.slice(-5)[0]));
  } finally { srv.close(); }
});

test('validation: object cap 400, 3MB cap 413, non-string text 400, dimension pinning', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const posterId = designed.posterId;
    const base_ = structuredClone(designed.design.canvas);

    // > 300 objects
    const many = structuredClone(base_);
    while (many.objects.length <= 300) {
      many.objects.push({ type: 'Rect', left: 0, top: 0, width: 5, height: 5, fill: '#000000' });
    }
    let res = await req(base, token, `/api/editor/${posterId}/canvas`, 'PUT', { canvas: many });
    assert.equal(res.status, 400);

    // > 3MB serialized
    const huge = structuredClone(base_);
    huge.objects.push({
      type: 'Textbox', left: 0, top: 0, width: 500,
      text: 'a'.repeat(3 * 1024 * 1024 + 64), layerRole: 'user-text'
    });
    res = await req(base, token, `/api/editor/${posterId}/canvas`, 'PUT', { canvas: huge });
    assert.equal(res.status, 413);
    assert.equal((await res.json()).error, 'CANVAS_TOO_LARGE');

    // non-string text
    const badText = structuredClone(base_);
    badText.objects.push({ type: 'Textbox', left: 0, top: 0, width: 500, text: { evil: true } });
    res = await req(base, token, `/api/editor/${posterId}/canvas`, 'PUT', { canvas: badText });
    assert.equal(res.status, 400);

    // missing / malformed canvas
    assert.equal((await req(base, token, `/api/editor/${posterId}/canvas`, 'PUT', {})).status, 400);
    assert.equal((await req(base, token, `/api/editor/${posterId}/canvas`, 'PUT', { canvas: { objects: 'nope' } })).status, 400);

    // width/height/version are pinned server-side
    const resized = structuredClone(base_);
    resized.width = 50;
    resized.height = 50;
    resized.version = 'tampered';
    res = await req(base, token, `/api/editor/${posterId}/canvas`, 'PUT', { canvas: resized });
    assert.equal(res.status, 200);
    const saved = (await res.json()).design.canvas;
    assert.equal(saved.width, 1414);
    assert.equal(saved.height, 2000);
    assert.equal(saved.version, base_.version);
  } finally { srv.close(); }
});

test('phase gate: 409 WRONG_PHASE before design, 404 unknown poster', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, base, token } = await startServer(egress);
  try {
    // phase 'angles' (no design yet)
    const started = await (await req(base, token, '/api/pipeline/start', 'POST', { prompt: 'stop phishing emails' })).json();
    let res = await req(base, token, `/api/editor/${started.posterId}/canvas`, 'PUT', { canvas: { objects: [] } });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, 'WRONG_PHASE');

    // phase 'approved' (content approved, design not run) still refuses
    await req(base, token, `/api/pipeline/${started.posterId}/angles`, 'POST', { angleIds: 'ai' });
    await req(base, token, `/api/pipeline/${started.posterId}/approve`, 'POST', {});
    res = await req(base, token, `/api/editor/${started.posterId}/canvas`, 'PUT', { canvas: { objects: [] } });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, 'WRONG_PHASE');

    res = await req(base, token, '/api/editor/00000000-0000-4000-8000-000000000000/canvas', 'PUT', { canvas: { objects: [] } });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'POSTER_NOT_FOUND');
  } finally { srv.close(); }
});


test('src sanitizer: data:image/svg+xml (plain) stripped — SVG is script-capable', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const canvas = structuredClone(designed.design.canvas);
    canvas.objects.push({
      type: 'Image', left: 0, top: 0, width: 10, height: 10,
      src: 'data:image/svg+xml,<svg onload=alert(1)>'
    });
    const res = await req(base, token, `/api/editor/${designed.posterId}/canvas`, 'PUT', { canvas });
    assert.equal(res.status, 200);
    const saved = (await res.json()).design.canvas;
    const tail = saved.objects.at(-1);
    assert.ok(!('src' in tail), 'data:image/svg+xml plain src must be stripped');
  } finally { srv.close(); }
});

test('src sanitizer: data:image/svg+xml;base64 stripped — SVG is script-capable regardless of encoding', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const canvas = structuredClone(designed.design.canvas);
    canvas.objects.push({
      type: 'Image', left: 0, top: 0, width: 10, height: 10,
      src: 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+'
    });
    const res = await req(base, token, `/api/editor/${designed.posterId}/canvas`, 'PUT', { canvas });
    assert.equal(res.status, 200);
    const saved = (await res.json()).design.canvas;
    const tail = saved.objects.at(-1);
    assert.ok(!('src' in tail), 'data:image/svg+xml;base64 src must be stripped');
  } finally { srv.close(); }
});

test('src sanitizer: oversized data:image/png;base64 src (>512KB) stripped to prevent snapshot bloat', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const canvas = structuredClone(designed.design.canvas);
    // craft a src that passes the pattern check but exceeds the 512*1024 char cap
    const bigSrc = 'data:image/png;base64,' + 'A'.repeat(512 * 1024 + 1);
    canvas.objects.push({
      type: 'Image', left: 0, top: 0, width: 10, height: 10, src: bigSrc
    });
    // the total canvas JSON will exceed 3MB, so we need a canvas under the size limit;
    // shrink it to just the oversized image object to stay under 3MB serialised
    const smallCanvas = { objects: [{ type: 'Image', left: 0, top: 0, width: 10, height: 10, src: bigSrc }] };
    const res = await req(base, token, `/api/editor/${designed.posterId}/canvas`, 'PUT', { canvas: smallCanvas });
    assert.equal(res.status, 200);
    const saved = (await res.json()).design.canvas;
    assert.ok(!('src' in saved.objects[0]), 'oversized data URI src must be stripped');
  } finally { srv.close(); }
});

test('src sanitizer: src nested inside a Group object\'s objects array is stripped', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const canvas = structuredClone(designed.design.canvas);
    // A Group whose nested objects array contains a remote src
    canvas.objects.push({
      type: 'Group', left: 0, top: 0, width: 200, height: 200,
      objects: [
        { type: 'Image', left: 0, top: 0, width: 10, height: 10, src: 'https://evil.example/tracker.gif' },
        { type: 'Rect', left: 0, top: 0, width: 50, height: 50, fill: '#ff0000' }
      ]
    });
    const res = await req(base, token, `/api/editor/${designed.posterId}/canvas`, 'PUT', { canvas });
    assert.equal(res.status, 200);
    const saved = (await res.json()).design.canvas;
    const group = saved.objects.at(-1);
    assert.ok(Array.isArray(group.objects), 'Group structure preserved');
    assert.ok(!('src' in group.objects[0]), 'remote src nested inside Group.objects must be stripped');
  } finally { srv.close(); }
});

test('src sanitizer: legit small data:image/png;base64 and /api/images/file/ srcs both survive', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const canvas = structuredClone(designed.design.canvas);
    const smallDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    canvas.objects.push(
      { type: 'Image', left: 0, top: 0, width: 10, height: 10, src: smallDataUri },
      { type: 'Image', left: 0, top: 0, width: 10, height: 10, src: '/api/images/file/img-safe' }
    );
    const res = await req(base, token, `/api/editor/${designed.posterId}/canvas`, 'PUT', { canvas });
    assert.equal(res.status, 200);
    const saved = (await res.json()).design.canvas;
    const tail = saved.objects.slice(-2);
    assert.equal(tail[0].src, smallDataUri, 'small raster data URI must survive');
    assert.equal(tail[1].src, '/api/images/file/img-safe', 'relative library src must survive');
  } finally { srv.close(); }
});

// ── Task 6: per-language canvas variant save tests ───────────────────────────

/**
 * Build a minimal translated variant canvas with headline/cta text objects
 * that `extractContentFromCanvas` can pick up (layerRole 'headline' + 'cta').
 */
function makeVariantCanvas(headlineText, ctaText) {
  return {
    version: '6.0.0-beta1',
    background: '#F5F0E8',
    width: 1414,
    height: 2000,
    objects: [
      {
        type: 'Textbox', left: 110, top: 210, width: 1194, fontSize: 80,
        text: headlineText, layerRole: 'headline'
      },
      {
        type: 'Textbox', left: 174, top: 1874, width: 1120, fontSize: 36,
        text: ctaText, layerRole: 'cta'
      }
    ]
  };
}

/**
 * Landscape counterpart of makeVariantCanvas (2000x1414, same layerRole
 * bindings — landscape mirrors portrait text with a different layout).
 */
function makeLandscapeCanvas(headlineText, ctaText) {
  return {
    version: '6.0.0-beta1',
    background: '#F5F0E8',
    width: 2000,
    height: 1414,
    objects: [
      {
        type: 'Textbox', left: 120, top: 160, width: 1700, fontSize: 96,
        text: headlineText, layerRole: 'headline'
      },
      {
        type: 'Textbox', left: 120, top: 1280, width: 1200, fontSize: 34,
        text: ctaText, layerRole: 'cta'
      }
    ]
  };
}

/**
 * Inject a translated-phase doc with a German ('de') variant directly into the
 * DB. `withLandscape` adds a variant.landscapeCanvas (v2 dual-orientation
 * poster shape from translation_pipeline buildVariant).
 */
function injectTranslatedVariant(ctx, posterId, { deHeadline = 'Phishing erkennen', deCta = 'Verdächtige Nachricht melden', withLandscape = false } = {}) {
  const row = ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId);
  const doc = JSON.parse(row.doc);
  doc.phase = 'translated';
  const variantCanvas = makeVariantCanvas(deHeadline, deCta);
  doc.translations = {
    de: {
      content: {
        headline: deHeadline,
        subheadline: null,
        messages: [],
        callToAction: deCta,
        format: 'red-flags'
      },
      canvas: variantCanvas,
      ...(withLandscape ? { landscapeCanvas: makeLandscapeCanvas(deHeadline, deCta) } : {}),
      fidelityScore: 96,
      attempts: 1,
      status: 'translated',
      updatedAt: new Date().toISOString(),
      lastEditChanges: null
    }
  };
  ctx.db.prepare('UPDATE posters SET status = ?, doc = ? WHERE poster_id = ?')
    .run('translated', JSON.stringify(doc), posterId);
  return { doc, variantCanvas };
}

/**
 * Inject a v2-shaped landscape design canvas (doc.design.landscape.canvas)
 * into an already-designed poster — the shape design_pipeline builds for v2
 * template-first posters (design.canvas stays the portrait canvas).
 */
function injectLandscapeDesign(ctx, posterId) {
  const row = ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId);
  const doc = JSON.parse(row.doc);
  const landscapeCanvas = makeLandscapeCanvas('Stop phishing attacks', 'Report suspicious messages');
  landscapeCanvas.version = doc.design.canvas.version;
  doc.design.landscape = { canvas: landscapeCanvas };
  ctx.db.prepare('UPDATE posters SET doc = ? WHERE poster_id = ?').run(JSON.stringify(doc), posterId);
  return landscapeCanvas;
}

test('variant save happy path: variant canvas stored, design.canvas untouched', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const posterId = designed.posterId;
    const designCanvasBefore = loadDoc(ctx, posterId).design.canvas;

    injectTranslatedVariant(ctx, posterId);

    // Build an edited DE canvas (same structure, changed headline text)
    const deCanvas = makeVariantCanvas('Phishing-Angriffe stoppen', 'Verdächtige Nachricht melden');

    const res = await req(base, token, `/api/editor/${posterId}/canvas?lang=de`, 'PUT', { canvas: deCanvas });
    assert.equal(res.status, 200, 'variant save must succeed');
    const body = await res.json();

    // variant canvas updated with new text
    const docAfter = loadDoc(ctx, posterId);
    const deVariant = docAfter.translations.de;
    assert.equal(deVariant.status, 'edited', 'variant status must be "edited" after save');
    assert.ok(deVariant.canvas.objects[0].text === 'Phishing-Angriffe stoppen', 'variant headline updated');
    assert.ok(typeof deVariant.updatedAt === 'string', 'updatedAt is set');

    // design.canvas UNTOUCHED
    const designCanvasAfter = docAfter.design.canvas;
    assert.deepEqual(designCanvasAfter, designCanvasBefore, 'design.canvas must not be touched by a variant save');

    // syncAvailable: no other variants, so false
    assert.equal(body.syncAvailable, false, 'syncAvailable is false when only one variant exists');
  } finally { srv.close(); }
});

test('variant save: syncAvailable true when other translated variants exist and text changed', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const posterId = designed.posterId;
    injectTranslatedVariant(ctx, posterId);

    // Add a second variant (fr) so syncAvailable becomes true
    const docRow = ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId);
    const doc = JSON.parse(docRow.doc);
    doc.translations.fr = {
      content: { headline: 'Détecter le phishing', subheadline: null, messages: [], callToAction: 'Signalez', format: 'red-flags' },
      canvas: makeVariantCanvas('Détecter le phishing', 'Signalez'),
      fidelityScore: 95, attempts: 1, status: 'translated',
      updatedAt: new Date().toISOString(), lastEditChanges: null
    };
    ctx.db.prepare('UPDATE posters SET doc = ? WHERE poster_id = ?').run(JSON.stringify(doc), posterId);

    const deCanvas = makeVariantCanvas('Phishing-Angriffe stoppen', 'Verdächtige Nachricht melden');
    const res = await req(base, token, `/api/editor/${posterId}/canvas?lang=de`, 'PUT', { canvas: deCanvas });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.syncAvailable, true, 'syncAvailable must be true when other variants exist and text changed');
  } finally { srv.close(); }
});

test('variant save: text edit triggers terminology validator fire-and-forget (swap stored after a tick)', async () => {
  const termValidatorResponse = {
    swaps: [{ sourceTerm: 'phishing', candidate: 'Phishing-Betrug', equivalent: true, note: 'Standard German rendering of the English term phishing.' }]
  };
  const egress = new FakeEgress({
    ...CONTENT_HANDLERS,
    'terminology-validator': termValidatorResponse
  });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const posterId = designed.posterId;
    injectTranslatedVariant(ctx, posterId);

    // Change the headline to trigger a text diff
    const deCanvas = makeVariantCanvas('Phishing-Betrug erkennen', 'Verdächtige Nachricht melden');
    const egressCallsBefore = egress.calls.length;

    const res = await req(base, token, `/api/editor/${posterId}/canvas?lang=de`, 'PUT', { canvas: deCanvas });
    assert.equal(res.status, 200, 'response must be immediate (not blocked by terminology validation)');

    // The response comes back immediately — terminology validation is fire-and-forget
    // Give the microtask queue a tick to let the promise chain execute
    await new Promise((r) => setImmediate(r));

    // Terminology validator was called (one egress call beyond the content-pipeline calls)
    const termCalls = egress.calls.slice(egressCallsBefore);
    assert.ok(termCalls.length >= 1, 'terminology validator egress called after save');
    assert.ok(termCalls[0].ctx.agent === 'terminology-validator', 'call is from terminology-validator');

    // Term stored in the terminology table
    const stored = ctx.db.prepare('SELECT * FROM terminology WHERE lang = ? AND source_term = ?').get('de', 'phishing');
    assert.ok(stored, 'approved term must be stored in terminology table');
    assert.equal(stored.approved_term, 'Phishing-Betrug');
  } finally { srv.close(); }
});

test('variant save: lang=xx (unknown language) → 400 INVALID_LANGUAGE', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const posterId = designed.posterId;
    injectTranslatedVariant(ctx, posterId);

    const canvas = makeVariantCanvas('Headline', 'CTA');
    const res = await req(base, token, `/api/editor/${posterId}/canvas?lang=xx`, 'PUT', { canvas });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'INVALID_LANGUAGE');
  } finally { srv.close(); }
});

test('variant save: missing translation variant → 404 TRANSLATION_NOT_FOUND', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const posterId = designed.posterId;
    // Inject translated phase but only a 'de' variant; try to save 'fr'
    injectTranslatedVariant(ctx, posterId);

    const canvas = makeVariantCanvas('Titre', 'CTA');
    const res = await req(base, token, `/api/editor/${posterId}/canvas?lang=fr`, 'PUT', { canvas });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'TRANSLATION_NOT_FOUND');
  } finally { srv.close(); }
});

test('variant save: lang=en treated as English save (existing path, design.canvas updated)', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const posterId = designed.posterId;
    const canvas = structuredClone(designed.design.canvas);
    canvas.objects[0].fill = '#abcdef';

    // lang=en should behave exactly like no lang
    const res = await req(base, token, `/api/editor/${posterId}/canvas?lang=en`, 'PUT', { canvas });
    assert.equal(res.status, 200);
    const state = await res.json();
    // should return safeDesignState without syncAvailable key (English path)
    assert.equal(state.phase, 'designed');
    // design canvas updated
    const docAfter = loadDoc(ctx, posterId);
    assert.equal(docAfter.design.canvas.objects[0].fill, '#abcdef');
  } finally { srv.close(); }
});

test('variant save: lastEditChanges set when text changes, not set when no text changes', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const posterId = designed.posterId;
    injectTranslatedVariant(ctx, posterId, { deHeadline: 'Phishing erkennen', deCta: 'Nachricht melden' });

    // Save with unchanged text (same headline and cta)
    const sameCanvas = makeVariantCanvas('Phishing erkennen', 'Nachricht melden');
    const res1 = await req(base, token, `/api/editor/${posterId}/canvas?lang=de`, 'PUT', { canvas: sameCanvas });
    assert.equal(res1.status, 200);
    const docAfterNoChange = loadDoc(ctx, posterId);
    assert.equal(docAfterNoChange.translations.de.lastEditChanges, null, 'no text change → lastEditChanges stays null');

    // Now save with changed headline
    const changedCanvas = makeVariantCanvas('Phishing-Angriffe stoppen', 'Nachricht melden');
    const res2 = await req(base, token, `/api/editor/${posterId}/canvas?lang=de`, 'PUT', { canvas: changedCanvas });
    assert.equal(res2.status, 200);
    const docAfterChange = loadDoc(ctx, posterId);
    assert.ok(Array.isArray(docAfterChange.translations.de.lastEditChanges), 'text change → lastEditChanges is an array');
    assert.ok(docAfterChange.translations.de.lastEditChanges.length > 0, 'lastEditChanges is non-empty after text change');
    const changed = docAfterChange.translations.de.lastEditChanges.find((c) => c.field === 'headline');
    assert.ok(changed, 'headline diff in lastEditChanges');
    assert.equal(changed.before, 'Phishing erkennen');
    assert.equal(changed.after, 'Phishing-Angriffe stoppen');
  } finally { srv.close(); }
});

test('variant save (finding C1): variant.content is persisted from the saved canvas — content and canvas never drift', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS, 'terminology-validator': { swaps: [] } });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const posterId = designed.posterId;
    injectTranslatedVariant(ctx, posterId, { deHeadline: 'Phishing erkennen', deCta: 'Nachricht melden' });

    // save a canvas whose headline text was edited in the editor
    const deCanvas = makeVariantCanvas('Phishing-Angriffe sofort stoppen', 'Nachricht melden');
    const res = await req(base, token, `/api/editor/${posterId}/canvas?lang=de`, 'PUT', { canvas: deCanvas });
    assert.equal(res.status, 200);

    // GET-equivalent read: variant.content matches the new canvas text
    const doc = loadDoc(ctx, posterId);
    const variant = doc.translations.de;
    assert.equal(variant.content.headline, 'Phishing-Angriffe sofort stoppen', 'content.headline must match the saved canvas');
    assert.equal(variant.content.callToAction, 'Nachricht melden', 'unchanged fields carry through');
    // canvas and content agree
    assert.equal(
      variant.canvas.objects.find((o) => o.layerRole === 'headline').text,
      variant.content.headline
    );
  } finally { srv.close(); }
});

// ── T3: orientation-aware saves (?orientation=landscape) ────────────────────

test('landscape design save round-trip: 2000x1414 pinned, sanitiser applied, portrait untouched, orientation in snapshot + event', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const posterId = designed.posterId;
    const runId = designed.runId;
    const previous = injectLandscapeDesign(ctx, posterId);
    const portraitBefore = loadDoc(ctx, posterId).design.canvas;
    const snapshotsBefore = loadDoc(ctx, posterId).snapshots.length;
    const eventsBefore = ctx.bus.eventsForRun(runId).length;

    // edit like the editor does: change text, tamper dims/version, ride a remote src
    const canvas = structuredClone(previous);
    canvas.objects[0].text = 'Spot phishing before it spots you';
    canvas.width = 50;
    canvas.height = 50;
    canvas.version = 'tampered';
    canvas.objects.push({ type: 'Image', left: 0, top: 0, width: 10, height: 10, src: 'https://evil.example/pixel.png' });

    const res = await req(base, token, `/api/editor/${posterId}/canvas?orientation=landscape`, 'PUT', { canvas });
    assert.equal(res.status, 200);
    const state = await res.json();

    // response carries the updated landscape canvas (safeDesignState flattens it)
    assert.equal(state.design.landscapeCanvas.objects[0].text, 'Spot phishing before it spots you');
    assert.equal(state.design.landscapeCanvas.width, 2000, 'landscape width pinned');
    assert.equal(state.design.landscapeCanvas.height, 1414, 'landscape height pinned');
    assert.equal(state.design.landscapeCanvas.version, previous.version, 'version pinned from previous landscape canvas');
    assert.ok(!('src' in state.design.landscapeCanvas.objects.at(-1)), 'remote src stripped on the landscape path too');

    // persisted under doc.design.landscape.canvas; portrait canvas untouched
    const doc = loadDoc(ctx, posterId);
    assert.equal(doc.design.landscape.canvas.objects[0].text, 'Spot phishing before it spots you');
    assert.deepEqual(doc.design.canvas, portraitBefore, 'portrait design.canvas must not be touched by a landscape save');

    // snapshot + single user_action both carry the orientation
    assert.equal(doc.snapshots.length, snapshotsBefore + 1);
    assert.equal(doc.snapshots.at(-1).state.trigger, 'editor-save');
    assert.equal(doc.snapshots.at(-1).state.orientation, 'landscape');
    const newEvents = ctx.bus.eventsForRun(runId).slice(eventsBefore);
    assert.equal(newEvents.length, 1);
    assert.equal(newEvents[0].type, 'user_action');
    const payload = JSON.parse(newEvents[0].payload);
    assert.equal(payload.action, 'editor-save');
    assert.equal(payload.orientation, 'landscape');
  } finally { srv.close(); }
});

test('landscape variant save: variant.landscapeCanvas updated + pinned, portrait canvas/content untouched, NO terminology hook', async () => {
  const egress = new FakeEgress({
    ...CONTENT_HANDLERS,
    // if the memory hook ever ran on landscape, this handler would be called
    'terminology-validator': { swaps: [] }
  });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const posterId = designed.posterId;
    injectLandscapeDesign(ctx, posterId);
    injectTranslatedVariant(ctx, posterId, { withLandscape: true });
    const variantBefore = loadDoc(ctx, posterId).translations.de;
    const egressCallsBefore = egress.calls.length;

    // text change WOULD trigger the memory hook on the portrait path
    const canvas = makeLandscapeCanvas('Phishing-Betrug sofort stoppen', 'Verdächtige Nachricht melden');
    canvas.width = 9;
    canvas.height = 9;
    const res = await req(base, token, `/api/editor/${posterId}/canvas?orientation=landscape&lang=de`, 'PUT', { canvas });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.syncAvailable, false, 'landscape saves never offer sync — text is owned by the portrait path');

    const variant = loadDoc(ctx, posterId).translations.de;
    assert.equal(variant.landscapeCanvas.objects[0].text, 'Phishing-Betrug sofort stoppen');
    assert.equal(variant.landscapeCanvas.width, 2000);
    assert.equal(variant.landscapeCanvas.height, 1414);
    assert.equal(variant.status, 'edited', 'variant status flips to edited');
    assert.ok(typeof variant.updatedAt === 'string' && variant.updatedAt >= variantBefore.updatedAt, 'updatedAt refreshed');
    // portrait canvas AND content untouched (text ownership stays portrait)
    assert.deepEqual(variant.canvas, variantBefore.canvas, 'variant.canvas (portrait) untouched');
    assert.deepEqual(variant.content, variantBefore.content, 'variant.content untouched — derived from the portrait canvas only');
    assert.equal(variant.lastEditChanges, null, 'no text diff recorded on the landscape path');

    // memory hook is portrait-only: no terminology-validator egress call
    await new Promise((r) => setImmediate(r));
    assert.equal(egress.calls.length, egressCallsBefore, 'terminology validator must NOT run on landscape saves');
  } finally { srv.close(); }
});

test('landscape 404s: no landscape design (v1 poster), missing variant, variant without landscapeCanvas', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token); // v1 template → portrait-only design
    const posterId = designed.posterId;
    const canvas = makeLandscapeCanvas('Headline', 'CTA');

    // design has no landscape canvas
    let res = await req(base, token, `/api/editor/${posterId}/canvas?orientation=landscape`, 'PUT', { canvas });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'NO_LANDSCAPE_CANVAS');

    // variant missing entirely (only 'de' injected, ask for 'fr')
    injectTranslatedVariant(ctx, posterId); // no landscapeCanvas
    res = await req(base, token, `/api/editor/${posterId}/canvas?orientation=landscape&lang=fr`, 'PUT', { canvas });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'TRANSLATION_NOT_FOUND');

    // variant exists but carries no landscapeCanvas (translated pre-landscape)
    res = await req(base, token, `/api/editor/${posterId}/canvas?orientation=landscape&lang=de`, 'PUT', { canvas });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'NO_LANDSCAPE_CANVAS');
  } finally { srv.close(); }
});

test('orientation param: unknown value → 400 INVALID_ORIENTATION; explicit portrait = default behavior', async () => {
  const egress = new FakeEgress({ ...CONTENT_HANDLERS });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const designed = await designedPoster(base, token);
    const posterId = designed.posterId;
    const canvas = structuredClone(designed.design.canvas);
    canvas.objects[0].fill = '#654321';

    // bad orientation values are rejected before any save work
    for (const bad of ['diagonal', 'LANDSCAPE', 'portrait%20']) {
      const res = await req(base, token, `/api/editor/${posterId}/canvas?orientation=${bad}`, 'PUT', { canvas });
      assert.equal(res.status, 400, `orientation=${bad} must be rejected`);
      assert.equal((await res.json()).error, 'INVALID_ORIENTATION');
    }

    // explicit ?orientation=portrait behaves exactly like no param
    const res = await req(base, token, `/api/editor/${posterId}/canvas?orientation=portrait`, 'PUT', { canvas });
    assert.equal(res.status, 200);
    const state = await res.json();
    assert.equal(state.design.canvas.objects[0].fill, '#654321');
    assert.equal(state.design.canvas.width, 1414);
    assert.equal(state.design.canvas.height, 2000);
    const doc = loadDoc(ctx, posterId);
    assert.equal(doc.snapshots.at(-1).state.trigger, 'editor-save');
    assert.ok(!('orientation' in doc.snapshots.at(-1).state), 'portrait snapshots stay byte-for-byte (no orientation key)');
  } finally { srv.close(); }
});
