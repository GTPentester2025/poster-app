// Translation route tests (spec §B.11) over the real server: auth gate (401
// on every endpoint), POST start happy path and error cases, concurrency lock,
// state + variant GETs, edit + sync flows, and meta endpoints (/meta/languages
// asserts no Japanese; /meta/terminology/:lang population after an edit).
//
// Pattern mirrors editor-routes.test.js / image-routes.test.js: real server
// via createServer(), session-token auth, fake egress injected through ctx.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { newRunId } from '#shared';
import { createServer } from '../../backend/server.js';
import { createAppContext } from '../../backend/app-context.js';
import {
  FakeEgress, seedArticles, INTENT_OUTPUT, CONTEXT_OUTPUT, POSTER_CONTENT
} from './helpers/fake_egress.js';

// ── server helpers ────────────────────────────────────────────────────────────

function startServer(egress) {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-translation-routes-'));
  const ctx = createAppContext({
    dataDir, logDir: join(dataDir, 'runs'), dbPath: join(dataDir, 'test.sqlite'), egress
  });
  seedArticles(ctx.db);
  const { app, token } = createServer(ctx, { dataDir });
  return new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => {
      resolve({ srv, ctx, token, base: `http://127.0.0.1:${srv.address().port}` });
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

// ── realistic translated content ──────────────────────────────────────────────

// Spanish translation of POSTER_CONTENT (realistic, no lorem ipsum)
const ES_CONTENT = {
  headline: 'Esa Página de Inicio de Sesión Puede Ser una Trampa',
  subheadline: 'Los atacantes copian páginas de inicio de sesión reales para capturar lo que usted escribe',
  messages: [
    { id: 'msg-1', label: 'SEÑAL DE ALERTA', text: 'Un código QR en un correo electrónico inesperado' },
    { id: 'msg-2', label: 'SEÑAL DE ALERTA', text: 'Una solicitud de inicio de sesión que usted no inició' },
    { id: 'msg-3', label: 'SEÑAL DE ALERTA', text: 'Una página de inicio de sesión desde un enlace de correo' },
    { id: 'msg-4', label: 'HACER', text: 'Escriba la dirección del sitio usted mismo antes de iniciar sesión' }
  ],
  callToAction: '¿Mensaje sospechoso? Reenvíelo a {{SOC_EMAIL}} de inmediato',
  format: 'red-flags'
};

// German translation
const DE_CONTENT = {
  headline: 'Diese Anmeldeseite Könnte Eine Falle Sein',
  subheadline: 'Angreifer kopieren echte Anmeldeseiten, um zu erfassen, was Sie eingeben',
  messages: [
    { id: 'msg-1', label: 'WARNSIGNAL', text: 'Ein QR-Code in einer unerwarteten E-Mail' },
    { id: 'msg-2', label: 'WARNSIGNAL', text: 'Eine Anmeldeanforderung, die Sie nicht gestartet haben' },
    { id: 'msg-3', label: 'WARNSIGNAL', text: 'Eine Anmeldeseite, die über einen E-Mail-Link erreicht wurde' },
    { id: 'msg-4', label: 'HANDLUNG', text: 'Geben Sie die Website-Adresse selbst ein, bevor Sie sich anmelden' }
  ],
  callToAction: 'Verdächtige Nachricht? Leiten Sie sie sofort an {{SOC_EMAIL}} weiter',
  format: 'red-flags'
};

// ── DB seeding helpers ────────────────────────────────────────────────────────

// Minimal canvas matching content structure for canvas-text binding
function makeCanvas(content) {
  const objects = [
    { type: 'Textbox', layerRole: 'headline', text: content.headline, left: 0, top: 0, width: 1000 },
    ...(content.subheadline ? [{ type: 'Textbox', layerRole: 'subheadline', text: content.subheadline, left: 0, top: 100, width: 1000 }] : []),
    ...content.messages.flatMap((m) => [
      { type: 'Textbox', layerRole: 'message-label', msgId: m.id, text: m.label || '', left: 0, top: 200, width: 500 },
      { type: 'Textbox', layerRole: 'message-text', msgId: m.id, text: m.text, left: 0, top: 250, width: 500 }
    ]),
    ...(content.callToAction ? [{ type: 'Textbox', layerRole: 'cta', text: content.callToAction, left: 0, top: 1800, width: 1000 }] : [])
  ];
  return { version: '6.7.1', width: 1414, height: 2000, background: '#F5F0E8', objects };
}

// O10: landscape twin of a canvas — SAME bindings, landscape geometry.
function toLandscape(portrait) {
  const c = structuredClone(portrait);
  c.width = 2000;
  c.height = 1414;
  c.objects = c.objects.map((o, i) => ({ ...o, left: 900 + i, top: 40 + i }));
  return c;
}

/**
 * Seed a poster in 'designed' phase (ready to translate). With
 * `landscape: true` the design is v2 dual-orientation (plan D2/O10):
 * design.canvas stays the portrait canvas, design.landscape.canvas rides.
 */
function seedDesignedPoster(db, { landscape = false } = {}) {
  const posterId = randomUUID();
  const runId = newRunId('poster');
  const now = new Date().toISOString();
  const canvas = makeCanvas(POSTER_CONTENT);
  // Give messages proper ids to match POSTER_CONTENT (ids assigned by normalizePosterContent)
  POSTER_CONTENT.messages.forEach((m, i) => {
    if (!m.id) canvas.objects.filter((o) => o.layerRole === 'message-text')[i].msgId = `msg-${i + 1}`;
  });
  const landscapeDesign = landscape ? { landscape: { canvas: toLandscape(canvas) } } : {};
  const doc = {
    prompt: 'stop phishing emails', runId, phase: 'designed',
    grounded: true, contextId: `ctx-${posterId}`,
    contextFile: { topic: 'phishing', keywords: { core: ['phishing'], expanded: [] }, synthesis: 'internal', angles: [], sources: [] },
    intent: null, selectedAngleIds: 'ai',
    content: {
      headline: POSTER_CONTENT.headline,
      subheadline: POSTER_CONTENT.subheadline,
      messages: POSTER_CONTENT.messages.map((m, i) => ({ ...m, id: `msg-${i + 1}` })),
      callToAction: POSTER_CONTENT.callToAction,
      format: POSTER_CONTENT.format
    },
    design: { templateId: 'minimal-clean', canvas, ...landscapeDesign, palette: {}, fonts: {}, reviewHistory: [], designedAt: now },
    translations: {}, snapshots: [], reviewHistory: []
  };
  db.prepare('INSERT INTO posters (poster_id, name, status, created_at, updated_at, doc) VALUES (?, ?, ?, ?, ?, ?)')
    .run(posterId, 'phishing poster', 'designed', now, now, JSON.stringify(doc));
  return posterId;
}

/**
 * Seed a poster already in 'translated' phase with es + de variants.
 */
function seedTranslatedPoster(db) {
  const posterId = randomUUID();
  const runId = newRunId('poster');
  const now = new Date().toISOString();
  const baseContent = {
    headline: POSTER_CONTENT.headline,
    subheadline: POSTER_CONTENT.subheadline,
    messages: POSTER_CONTENT.messages.map((m, i) => ({ ...m, id: `msg-${i + 1}` })),
    callToAction: POSTER_CONTENT.callToAction,
    format: POSTER_CONTENT.format
  };
  const baseCanvas = makeCanvas(baseContent);
  const esCanvas = makeCanvas(ES_CONTENT);
  const deCanvas = makeCanvas(DE_CONTENT);
  const doc = {
    prompt: 'stop phishing emails', runId, phase: 'translated',
    grounded: true, contextId: `ctx-${posterId}`,
    contextFile: { topic: 'phishing', keywords: { core: ['phishing'], expanded: [] }, synthesis: 'internal', angles: [], sources: [] },
    intent: null, selectedAngleIds: 'ai',
    content: baseContent,
    design: { templateId: 'minimal-clean', canvas: baseCanvas, palette: {}, fonts: {}, reviewHistory: [], designedAt: now },
    translations: {
      es: { content: ES_CONTENT, canvas: esCanvas, fidelityScore: 97, attempts: 1, status: 'translated', updatedAt: now, lastEditChanges: null },
      de: { content: DE_CONTENT, canvas: deCanvas, fidelityScore: 96, attempts: 1, status: 'translated', updatedAt: now, lastEditChanges: null }
    },
    translationFailures: [],
    snapshots: [], reviewHistory: []
  };
  db.prepare('INSERT INTO posters (poster_id, name, status, created_at, updated_at, doc) VALUES (?, ?, ?, ?, ?, ?)')
    .run(posterId, 'phishing poster', 'translated', now, now, JSON.stringify(doc));
  return posterId;
}

// ── egress helpers ────────────────────────────────────────────────────────────

// Fidelity accept response (score above the 95 gate)
const FIDELITY_ACCEPT = { score: 97, status: 'accepted', feedback: '', expected: '', issues: [] };

// What the MODEL responds: the translator locks {{SOC_EMAIL}} into the
// __LOCK_n__ sentinel space before the prompt (finding S1), so a compliant
// model echoes the sentinel — restoreTokens puts the literal placeholder back.
function asModelOutput(content) {
  return JSON.parse(JSON.stringify(content).replaceAll('{{SOC_EMAIL}}', '__LOCK_0__'));
}

// Build a scripted egress for translating a single language (es only)
// FakeEgress array handlers: elements are plain objects (shifted per call).
// Call order per language: 1) translate_segment → ES_CONTENT, 2) back_check_fidelity → FIDELITY_ACCEPT
function makeTranslationEgress(overrides = {}) {
  return new FakeEgress({
    translator: [
      asModelOutput(ES_CONTENT),
      FIDELITY_ACCEPT
    ],
    'terminology-validator': { swaps: [] },
    ...overrides
  });
}

// ── Case 1: 401 on every endpoint without session token ─────────────────────

test('all translation endpoints require session token (401)', async () => {
  const { srv, base } = await startServer(new FakeEgress({}));
  try {
    const endpoints = [
      ['POST', '/api/translation/some-poster-id/start', { languages: 'all' }],
      ['GET', '/api/translation/some-poster-id', undefined],
      ['GET', '/api/translation/some-poster-id/es', undefined],
      ['PUT', '/api/translation/some-poster-id/es', { content: {} }],
      ['POST', '/api/translation/some-poster-id/es/sync', undefined],
      ['GET', '/api/translation/meta/languages', undefined],
      ['GET', '/api/translation/meta/terminology/de', undefined]
    ];
    for (const [method, path, body] of endpoints) {
      const res = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
      });
      assert.equal(res.status, 401, `${method} ${path} must require auth`);
    }
  } finally { srv.close(); }
});

// ── Case 2: POST start happy path ────────────────────────────────────────────

test('POST start happy path: designed poster → 200 with es in languages list', async () => {
  const egress = makeTranslationEgress();
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const posterId = seedDesignedPoster(ctx.db);
    const res = await req(base, token, `/api/translation/${posterId}/start`, 'POST', { languages: ['es'] });
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    const state = await res.json();
    assert.ok(state.posterId === posterId, 'posterId in state');
    assert.ok(Array.isArray(state.languages), 'languages is array');
    assert.ok(state.languages.some((l) => l.lang === 'es'), 'es language listed');
    const esLang = state.languages.find((l) => l.lang === 'es');
    assert.ok(esLang.fidelityScore >= 95, 'fidelity score at or above gate');
    assert.equal(esLang.status, 'translated');
    // content/canvas must NOT be in the safe-view list
    assert.ok(!('content' in esLang), 'content must not appear in safe list view');
    assert.ok(!('canvas' in esLang), 'canvas must not appear in safe list view');
  } finally { srv.close(); }
});

// ── Case 3: POST start error paths ───────────────────────────────────────────

test('POST start: empty languages array → 400 INVALID_LANGUAGES', async () => {
  const { srv, ctx, base, token } = await startServer(new FakeEgress({}));
  try {
    const posterId = seedDesignedPoster(ctx.db);
    const res = await req(base, token, `/api/translation/${posterId}/start`, 'POST', { languages: [] });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'INVALID_LANGUAGES');
  } finally { srv.close(); }
});

test('POST start: unknown language id → 400 INVALID_LANGUAGES', async () => {
  const { srv, ctx, base, token } = await startServer(new FakeEgress({}));
  try {
    const posterId = seedDesignedPoster(ctx.db);
    const res = await req(base, token, `/api/translation/${posterId}/start`, 'POST', { languages: ['jp'] });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'INVALID_LANGUAGES');
  } finally { srv.close(); }
});

test('POST start: wrong phase (angles) → 409 WRONG_PHASE', async () => {
  // Use content pipeline to create a poster in 'angles' phase
  const egress = new FakeEgress({
    'keyword-intent': INTENT_OUTPUT,
    'rag-research/synthesize_context': CONTEXT_OUTPUT
  });
  const { srv, base, token } = await startServer(egress);
  try {
    // start a poster (angles phase)
    const started = await (await req(base, token, '/api/pipeline/start', 'POST', { prompt: 'stop phishing emails' })).json();
    const res = await req(base, token, `/api/translation/${started.posterId}/start`, 'POST', { languages: ['es'] });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, 'WRONG_PHASE');
  } finally { srv.close(); }
});

test('POST start: unknown poster → 404 POSTER_NOT_FOUND', async () => {
  const { srv, base, token } = await startServer(new FakeEgress({}));
  try {
    const res = await req(base, token, '/api/translation/00000000-0000-4000-8000-000000000000/start', 'POST', { languages: ['es'] });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'POSTER_NOT_FOUND');
  } finally { srv.close(); }
});

// ── Case 4: Concurrency — second POST start gets 409 POSTER_BUSY ─────────────

test('concurrency: second POST start before first completes → 409 POSTER_BUSY', async () => {
  // The egress blocks the first request long enough for the second to arrive.
  // Using a single function handler (not array) so we can make it async and block.
  let resolveFirst;
  const firstLatch = new Promise((resolve) => { resolveFirst = resolve; });
  let callCount = 0;

  const egress = new FakeEgress({
    // Single function handler: first call (translate_segment) blocks on latch;
    // subsequent calls (back_check_fidelity after unblock) return FIDELITY_ACCEPT
    translator: async (_opts, _ctx) => {
      callCount++;
      if (callCount === 1) {
        // first call: block until released
        await firstLatch;
        return asModelOutput(ES_CONTENT);
      }
      // second call (back_check_fidelity after latch released)
      return FIDELITY_ACCEPT;
    },
    'terminology-validator': { swaps: [] }
  });

  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const posterId = seedDesignedPoster(ctx.db);

    // Fire first request but don't await it yet
    const first = req(base, token, `/api/translation/${posterId}/start`, 'POST', { languages: ['es'] });
    // Small tick to let the first request reach the lock and block inside egress
    await delay(30);
    // Fire second request while first holds the poster lock
    const second = await req(base, token, `/api/translation/${posterId}/start`, 'POST', { languages: ['es'] });
    assert.equal(second.status, 409);
    assert.equal((await second.json()).error, 'POSTER_BUSY');

    // Release first request so it can complete (cleanup)
    resolveFirst();
    await first; // allow the first to finish
  } finally { srv.close(); }
});

// ── Case 5: GET state + GET variant ──────────────────────────────────────────

test('GET state returns safe translation state (no content/canvas in list)', async () => {
  const { srv, ctx, base, token } = await startServer(new FakeEgress({}));
  try {
    const posterId = seedTranslatedPoster(ctx.db);
    const res = await req(base, token, `/api/translation/${posterId}`);
    assert.equal(res.status, 200);
    const state = await res.json();
    assert.equal(state.posterId, posterId);
    assert.equal(state.phase, 'translated');
    assert.ok(state.languages.some((l) => l.lang === 'es'));
    assert.ok(state.languages.some((l) => l.lang === 'de'));
    // safe view — no content/canvas
    for (const lang of state.languages) {
      assert.ok(!('content' in lang), `content must not appear in list for ${lang.lang}`);
      assert.ok(!('canvas' in lang), `canvas must not appear in list for ${lang.lang}`);
    }
  } finally { srv.close(); }
});

test('GET variant returns content + canvas for existing language', async () => {
  const { srv, ctx, base, token } = await startServer(new FakeEgress({}));
  try {
    const posterId = seedTranslatedPoster(ctx.db);
    const res = await req(base, token, `/api/translation/${posterId}/es`);
    assert.equal(res.status, 200);
    const variant = await res.json();
    assert.equal(variant.lang, 'es');
    assert.ok(variant.content && typeof variant.content === 'object', 'content present');
    assert.ok(variant.canvas && typeof variant.canvas === 'object', 'canvas present');
    assert.equal(variant.content.headline, ES_CONTENT.headline);
    assert.ok(variant.fidelityScore >= 95);
  } finally { srv.close(); }
});

test('GET variant unknown language → 404 TRANSLATION_NOT_FOUND', async () => {
  const { srv, ctx, base, token } = await startServer(new FakeEgress({}));
  try {
    const posterId = seedTranslatedPoster(ctx.db);
    const res = await req(base, token, `/api/translation/${posterId}/fr`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'TRANSLATION_NOT_FOUND');
  } finally { srv.close(); }
});

// ── Case 6: PUT edit + POST sync flows ───────────────────────────────────────

test('PUT edit: valid content applied verbatim, status becomes edited, syncAvailable true', async () => {
  const egress = new FakeEgress({ 'terminology-validator': { swaps: [] } });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const posterId = seedTranslatedPoster(ctx.db);
    const editedContent = {
      ...ES_CONTENT,
      headline: 'Nueva Titular de Phishing en Español'
    };
    const res = await req(base, token, `/api/translation/${posterId}/es`, 'PUT', { content: editedContent });
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    const result = await res.json();
    assert.ok(result.state, 'state in response');
    assert.ok(typeof result.syncAvailable === 'boolean', 'syncAvailable in response');
    // Two variants exist (es + de), plus changes were made, so sync is available
    assert.equal(result.syncAvailable, true);
    // Verify the variant was updated in DB
    const doc = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc);
    assert.equal(doc.translations.es.status, 'edited');
    assert.equal(doc.translations.es.content.headline, editedContent.headline);
  } finally { srv.close(); }
});

test('PUT edit: invalid content (missing headline) → 400 INVALID_CONTENT', async () => {
  const { srv, ctx, base, token } = await startServer(new FakeEgress({}));
  try {
    const posterId = seedTranslatedPoster(ctx.db);
    const badContent = { ...ES_CONTENT };
    delete badContent.headline;
    const res = await req(base, token, `/api/translation/${posterId}/es`, 'PUT', { content: badContent });
    assert.equal(res.status, 400);
    // variant must remain untouched
    const doc = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc);
    assert.equal(doc.translations.es.status, 'translated');
  } finally { srv.close(); }
});

test('PUT edit: missing content body → 400', async () => {
  const { srv, ctx, base, token } = await startServer(new FakeEgress({}));
  try {
    const posterId = seedTranslatedPoster(ctx.db);
    const res = await req(base, token, `/api/translation/${posterId}/es`, 'PUT', {});
    assert.equal(res.status, 400);
  } finally { srv.close(); }
});

test('POST sync: 200 then second sync → 409 NOTHING_TO_SYNC', async () => {
  // extractStylePreference uses completeText (same FakeEgress dispatch by agent/skill).
  // The skill is 'extract_style_preference' → key 'translator/extract_style_preference'.
  // Re-translation of 'de' needs: translate_segment → FIDELITY_ACCEPT.
  // Build one egress that handles all three calls for the sync flow.
  const syncEgress = new FakeEgress({
    // fire-and-forget terminology validator (no-op)
    'terminology-validator': { swaps: [] },
    // extractStylePreference (skill: apply_register): empty object → null preference (best-effort, no reusable signal)
    'translator/apply_register': {},
    // de re-translation: translate_segment → de content (model view: sentinel), then back_check_fidelity → accept
    'translator/translate_segment': asModelOutput(DE_CONTENT),
    'translator/back_check_fidelity': FIDELITY_ACCEPT
  });

  const { srv, ctx, base, token } = await startServer(syncEgress);
  try {
    const posterId = seedTranslatedPoster(ctx.db);

    // First edit es (creates lastEditChanges)
    const editedContent = { ...ES_CONTENT, headline: 'Nuevo Titular Editado' };
    const editRes = await req(base, token, `/api/translation/${posterId}/es`, 'PUT', { content: editedContent });
    assert.equal(editRes.status, 200);

    // First sync: should succeed (re-translates 'de')
    const syncRes = await req(base, token, `/api/translation/${posterId}/es/sync`, 'POST');
    assert.equal(syncRes.status, 200, `sync expected 200, got ${syncRes.status}`);
    const syncState = await syncRes.json();
    assert.ok(syncState.languages, 'safe state returned from sync');

    // Second sync (lastEditChanges cleared): should be NOTHING_TO_SYNC
    const sync2Res = await req(base, token, `/api/translation/${posterId}/es/sync`, 'POST');
    assert.equal(sync2Res.status, 409);
    assert.equal((await sync2Res.json()).error, 'NOTHING_TO_SYNC');
  } finally { srv.close(); }
});

// ── Case 7: Meta endpoints ────────────────────────────────────────────────────

test('/meta/languages: lists 10 (en + 9 targets), NO Japanese', async () => {
  const { srv, base, token } = await startServer(new FakeEgress({}));
  try {
    const res = await req(base, token, '/api/translation/meta/languages');
    assert.equal(res.status, 200);
    const { base: baseLang, languages } = await res.json();
    assert.equal(baseLang, 'en');
    assert.equal(languages.length, 10, `expected 10 languages (en + 9 targets), got ${languages.length}`);
    // Must include English
    assert.ok(languages.some((l) => l.id === 'en'), 'English must be in languages list');
    // Must include all 9 targets
    const targetIds = ['es', 'pt-BR', 'zh-CN', 'ko', 'uk', 'de', 'fr', 'nl', 'it'];
    for (const id of targetIds) {
      assert.ok(languages.some((l) => l.id === id), `${id} must be in languages list`);
    }
    // Must NOT include Japanese
    const ids = languages.map((l) => l.id);
    assert.ok(!ids.includes('ja'), 'Japanese (ja) must NOT be in languages list');
    assert.ok(!ids.includes('jp'), 'Japanese (jp) must NOT be in languages list');
    // Language objects must have id and label
    for (const lang of languages) {
      assert.ok(typeof lang.id === 'string' && lang.id, 'each language has id');
      assert.ok(typeof lang.label === 'string' && lang.label, 'each language has label');
    }
  } finally { srv.close(); }
});

test('/meta/terminology/:lang: empty for new lang, populated after edit stores a term', async () => {
  // Use an egress that validates and stores a terminology swap
  const egress = new FakeEgress({
    'terminology-validator': {
      swaps: [
        {
          sourceTerm: 'phishing',
          candidate: 'Phishing-Betrug',
          equivalent: true,
          note: 'Phishing-Betrug is the standard German composite and semantically equivalent to the English source term.'
        }
      ]
    }
  });

  const { srv, ctx, base, token } = await startServer(egress);
  try {
    // First: empty terminology for de
    const empty = await req(base, token, '/api/translation/meta/terminology/de');
    assert.equal(empty.status, 200);
    const { terms: termsBefore } = await empty.json();
    assert.equal(termsBefore.length, 0, 'no terms before any edit');

    // Seed a translated poster and do an edit that triggers terminology validation
    const posterId = seedTranslatedPoster(ctx.db);

    // Edit de variant with a term swap — "Phishing" replaced with "Phishing-Betrug"
    const deEditedContent = {
      ...DE_CONTENT,
      headline: 'Diese Anmeldeseite Könnte Eine Phishing-Betrug Falle Sein'
    };
    const editRes = await req(base, token, `/api/translation/${posterId}/de`, 'PUT', { content: deEditedContent });
    assert.equal(editRes.status, 200);

    // The terminology validator runs fire-and-forget; allow a tick for it to settle
    await delay(50);

    // Now de terminology should be populated
    const populated = await req(base, token, '/api/translation/meta/terminology/de');
    assert.equal(populated.status, 200);
    const { terms: termsAfter } = await populated.json();
    assert.ok(termsAfter.length > 0, 'terminology populated after edit with equivalent swap');
    const stored = termsAfter.find((t) => t.sourceTerm === 'phishing');
    assert.ok(stored, 'phishing term stored');
    assert.equal(stored.approvedTerm, 'Phishing-Betrug');
    assert.equal(stored.validatedBy, 'terminology-validator');
  } finally { srv.close(); }
});

test('/meta/terminology/:lang with unknown lang → 400 INVALID_LANGUAGE', async () => {
  const { srv, base, token } = await startServer(new FakeEgress({}));
  try {
    const res = await req(base, token, '/api/translation/meta/terminology/xx');
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'INVALID_LANGUAGE');
  } finally { srv.close(); }
});

// ── Case 8 (O10, plan D2): dual-orientation variant round-trip ────────────────

test('O10 round-trip: v2 poster → start builds both orientations, GET carries landscapeCanvas, PUT edit patches both', async () => {
  const egress = makeTranslationEgress();
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    const posterId = seedDesignedPoster(ctx.db, { landscape: true });

    // start: translate es (ONE translation feeds both orientations)
    const startRes = await req(base, token, `/api/translation/${posterId}/start`, 'POST', { languages: ['es'] });
    assert.equal(startRes.status, 200, `expected 200, got ${startRes.status}`);
    // safe list view still carries metadata only
    const state = await startRes.json();
    assert.ok(!JSON.stringify(state).includes('landscapeCanvas'), 'safe state must not carry canvases');

    // GET variant: landscapeCanvas rides alongside canvas (portrait)
    const variant = await (await req(base, token, `/api/translation/${posterId}/es`)).json();
    assert.ok(variant.canvas && variant.canvas.width === 1414, 'canvas stays the portrait key');
    assert.ok(variant.landscapeCanvas, 'landscapeCanvas present for v2 posters');
    assert.equal(variant.landscapeCanvas.width, 2000);
    assert.equal(variant.landscapeCanvas.height, 1414);
    const lHead = variant.landscapeCanvas.objects.find((o) => o.layerRole === 'headline');
    assert.equal(lHead.text, ES_CONTENT.headline, 'landscape carries the translated text');
    assert.equal(lHead.left, 900, 'landscape geometry preserved (not portrait positions)');

    // PUT edit: verbatim edit lands on BOTH orientations
    const editedContent = { ...ES_CONTENT, headline: 'Nueva Titular de Phishing en Español' };
    const editRes = await req(base, token, `/api/translation/${posterId}/es`, 'PUT', { content: editedContent });
    assert.equal(editRes.status, 200);
    const after = await (await req(base, token, `/api/translation/${posterId}/es`)).json();
    assert.equal(after.canvas.objects.find((o) => o.layerRole === 'headline').text, editedContent.headline);
    const afterLHead = after.landscapeCanvas.objects.find((o) => o.layerRole === 'headline');
    assert.equal(afterLHead.text, editedContent.headline, 'edit must land on the landscape canvas too');
    assert.equal(afterLHead.left, 900, 'landscape geometry survives the edit');
  } finally { srv.close(); }
});

test('O10 regression: v1 poster GET variant carries landscapeCanvas: null', async () => {
  const { srv, ctx, base, token } = await startServer(new FakeEgress({}));
  try {
    const posterId = seedTranslatedPoster(ctx.db); // v1: no landscape design
    const variant = await (await req(base, token, `/api/translation/${posterId}/es`)).json();
    assert.equal(variant.landscapeCanvas, null, 'v1 variants report landscapeCanvas as null');
    assert.ok(variant.canvas, 'portrait canvas unaffected');
  } finally { srv.close(); }
});

test('/meta/terminology/:lang with Japanese (ja) → 400 INVALID_LANGUAGE (not a supported lang)', async () => {
  const { srv, base, token } = await startServer(new FakeEgress({}));
  try {
    const res = await req(base, token, '/api/translation/meta/terminology/ja');
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'INVALID_LANGUAGE');
  } finally { srv.close(); }
});
