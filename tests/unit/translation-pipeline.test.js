// Translation pipeline tests over real db/bus/harness/gates with a scripted
// egress: per-language 95-gate loops, batch continuation on one-language
// failure, editor-canvas as the English source of truth, verbatim variant
// edits with fire-and-forget terminology learning, batch sync from an edit's
// style preference, and safe views that never carry content/canvas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus, newRunId } from '#shared';
import { GateEngine, Harness } from '#orchestration';
import { openDb } from '../../backend/db.js';
import {
  startTranslation, getTranslationState, getTranslationVariant,
  editTranslation, syncTranslationEdit, safeTranslationState
} from '../../pipelines/translation_pipeline.js';
import { TARGET_LANGUAGE_IDS } from '../../translation/languages.js';
import { buildCanvas, getTemplateV2 } from '../../templates/v2/index.js';
import { sampleContentFor } from '../../templates/v2/manifest_schema.js';
import { FakeEgress } from './helpers/fake_egress.js';

// ── scaffolding (pipeline-content.test.js pattern) ──────────────────────────

function makeCtx(egress) {
  const dir = mkdtempSync(join(tmpdir(), 'postter-translation-'));
  const db = openDb(join(dir, 'test.sqlite'));
  const bus = new EventBus({ logDir: join(dir, 'runs'), db });
  const gateEngine = new GateEngine({ bus });
  const harness = new Harness({ bus, gateEngine });
  return { db, bus, vault: null, egress, gateEngine, harness };
}

const CONTENT = {
  headline: 'Pause Before You Scan or Sign In',
  subheadline: null,
  messages: [
    { id: 'msg-1', label: 'DO', text: 'Report suspicious emails to {{SOC_EMAIL}}' },
    { id: 'msg-2', label: "DON'T", text: 'Never type a one-time code on a page you did not open' },
    { id: 'msg-3', label: 'DO', text: 'Open the real site from your bookmarks' }
  ],
  callToAction: 'Think before you click',
  format: 'dos-donts'
};

function miniCanvas(content = CONTENT) {
  return {
    version: '6.0.0',
    background: '#F5F0E8',
    objects: [
      { type: 'Rect', layerRole: 'background', fill: '#E3AF32' },
      { type: 'Textbox', layerRole: 'headline', text: content.headline },
      { type: 'Textbox', layerRole: 'message-label', msgId: 'msg-1', text: content.messages[0].label },
      { type: 'Textbox', layerRole: 'message-text', msgId: 'msg-1', text: content.messages[0].text },
      { type: 'Textbox', layerRole: 'message-label', msgId: 'msg-2', text: content.messages[1].label },
      { type: 'Textbox', layerRole: 'message-text', msgId: 'msg-2', text: content.messages[1].text },
      { type: 'Textbox', layerRole: 'message-label', msgId: 'msg-3', text: content.messages[2].label },
      { type: 'Textbox', layerRole: 'message-text', msgId: 'msg-3', text: content.messages[2].text },
      { type: 'Textbox', layerRole: 'cta', text: content.callToAction },
      { type: 'Textbox', layerRole: 'decor', text: '!' }
    ]
  };
}

// O10: landscape twin of a canvas — SAME bindings, landscape geometry
// (2000x1414, shifted positions) so tests can prove the landscape layout
// survived text application.
function toLandscape(canvas) {
  const c = structuredClone(canvas);
  c.width = 2000;
  c.height = 1414;
  c.objects = c.objects.map((o, i) => ({ ...o, left: 1000 + i, top: 40 + i }));
  return c;
}

function seedPoster(db, { phase = 'designed', status = 'designed', canvas = miniCanvas(), content = CONTENT, landscape = null } = {}) {
  const posterId = randomUUID();
  const runId = newRunId('poster');
  const doc = {
    prompt: 'stop phishing emails', runId, phase, grounded: true,
    contextFile: { topic: 'phishing', angles: [] },
    content: structuredClone(content),
    // O10 (D2): v2 posters nest the landscape canvas under design.landscape
    design: { canvas: structuredClone(canvas), ...(landscape ? { landscape: { canvas: structuredClone(landscape) } } : {}) },
    translations: {},
    snapshots: []
  };
  const now = new Date().toISOString();
  db.prepare('INSERT INTO posters (poster_id, name, status, created_at, updated_at, doc) VALUES (?, ?, ?, ?, ?, ?)')
    .run(posterId, 'phishing poster', status, now, now, JSON.stringify(doc));
  return { posterId, runId };
}

function loadDoc(db, posterId) {
  return JSON.parse(db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(posterId).doc);
}

// Deterministic per-language "translation" of CONTENT, in its RESTORED form
// (literal {{SOC_EMAIL}}, extras array). Distinct from the English source
// (echo gate), stays under 3× lengths.
function translationFor(lang, mark = '') {
  return {
    headline: `[${lang}${mark}] Innehalten vor dem Scannen`,
    subheadline: null,
    messages: [
      { id: 'msg-1', label: `[${lang}] TUN`, text: `[${lang}${mark}] Melden Sie verdächtige E-Mails an {{SOC_EMAIL}}` },
      { id: 'msg-2', label: `[${lang}] NICHT TUN`, text: `[${lang}${mark}] Geben Sie niemals einen Einmalcode auf einer fremden Seite ein` },
      { id: 'msg-3', label: `[${lang}] TUN`, text: `[${lang}${mark}] Öffnen Sie die echte Seite über Ihre Lesezeichen` }
    ],
    callToAction: `[${lang}${mark}] Denken Sie nach, bevor Sie klicken`,
    extras: [],
    format: 'dos-donts'
  };
}

// What the MODEL responds: the translator locks {{SOC_EMAIL}} into the
// __LOCK_n__ sentinel space before the prompt (finding S1), so a compliant
// model echoes the sentinel — restoreTokens puts the literal placeholder back.
function asModelOutput(content) {
  return JSON.parse(JSON.stringify(content).replaceAll('{{SOC_EMAIL}}', '__LOCK_0__'));
}

const langOf = (ctx) => ctx.stage.split(':')[1];

const ACCEPT_FIDELITY = { score: 97, status: 'accepted', feedback: '', expected: '', issues: [] };
const REWORK_FIDELITY = {
  score: 80,
  status: 'rework',
  feedback: 'The headline weakens the urgency of the English source.',
  expected: 'A headline that keeps the pause-before-you-act urgency.',
  issues: [{ field: 'headline', problem: 'weakened urgency' }]
};

const PASSING_HANDLERS = () => ({
  'translator/translate_segment': (opts, ctx) => asModelOutput(translationFor(langOf(ctx))),
  'translator/back_check_fidelity': () => ACCEPT_FIDELITY
});

const translateCalls = (egress, lang = null) => egress.calls.filter((c) =>
  c.ctx.agent === 'translator' && c.ctx.skill === 'translate_segment' &&
  (lang == null || c.ctx.stage === `translate:${lang}`));

const settle = () => new Promise((r) => setTimeout(r, 25));

// ── case 1: startTranslation 'all' ──────────────────────────────────────────

test("startTranslation 'all': 9 variants, swapped canvases, phase/status 'translated', checkpoint, safe view carries metadata only", async () => {
  const egress = new FakeEgress(PASSING_HANDLERS());
  const ctx = makeCtx(egress);
  const { posterId, runId } = seedPoster(ctx.db);

  const state = await startTranslation({ ctx, posterId, languages: 'all' });

  assert.equal(state.phase, 'translated');
  assert.equal(state.status, 'translated');
  assert.equal(state.baseLanguage, 'en');
  assert.equal(state.languages.length, 9);
  assert.deepEqual(state.languages.map((l) => l.lang).sort(), [...TARGET_LANGUAGE_IDS].sort());
  assert.ok(state.languages.every((l) => l.status === 'translated' && l.fidelityScore === 97 && l.attempts === 1 && l.updatedAt));
  assert.deepEqual(state.failed, []);

  // safe view: per-language metadata ONLY — no content, no canvas
  assert.deepEqual(Object.keys(state.languages[0]).sort(), ['attempts', 'fidelityScore', 'label', 'lang', 'status', 'updatedAt']);
  const serialized = JSON.stringify(state);
  assert.ok(!serialized.includes('{{SOC_EMAIL}}'), 'variant content leaked into safe state');
  assert.ok(!serialized.includes('Innehalten'), 'translated text leaked into safe state');
  assert.ok(!serialized.includes('Textbox'), 'canvas leaked into safe state');
  assert.ok(!('translations' in state));

  // poster row + doc: status/phase translated, every variant canvas swapped
  const row = ctx.db.prepare('SELECT status FROM posters WHERE poster_id = ?').get(posterId);
  assert.equal(row.status, 'translated');
  const doc = loadDoc(ctx.db, posterId);
  for (const lang of TARGET_LANGUAGE_IDS) {
    const headline = doc.translations[lang].canvas.objects.find((o) => o.layerRole === 'headline');
    assert.equal(headline.text, translationFor(lang).headline);
    const decor = doc.translations[lang].canvas.objects.find((o) => o.layerRole === 'decor');
    assert.equal(decor.text, '!', 'decor text must never be swapped');
  }
  // the design canvas (English) is untouched — variants are clones
  assert.equal(doc.design.canvas.objects.find((o) => o.layerRole === 'headline').text, CONTENT.headline);

  // harness checkpoint
  const checkpoints = ctx.harness.getRunState(runId).checkpoints;
  assert.ok(checkpoints.some((c) => c.label === 'after-translation'));

  // handoff + user_action events emitted by this layer
  const events = ctx.bus.eventsForRun(runId);
  assert.ok(events.some((e) => e.type === 'user_action' && e.skill === 'start_translation'));
  assert.ok(events.some((e) => e.type === 'handoff' && e.stage === 'editor-save → translation'));

  // getTranslationState returns the same safe shape
  const readBack = getTranslationState({ ctx, posterId });
  assert.deepEqual(readBack.languages.map((l) => l.lang).sort(), [...TARGET_LANGUAGE_IDS].sort());
});

// ── case 2: specific languages, additive second run ─────────────────────────

test('specific languages translate only those; a later run ADDS languages without clobbering', async () => {
  const egress = new FakeEgress(PASSING_HANDLERS());
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db);

  const first = await startTranslation({ ctx, posterId, languages: ['de', 'fr'] });
  assert.deepEqual(first.languages.map((l) => l.lang).sort(), ['de', 'fr']);

  const deBefore = getTranslationVariant({ ctx, posterId, lang: 'de' });

  const second = await startTranslation({ ctx, posterId, languages: ['es'] });
  assert.deepEqual(second.languages.map((l) => l.lang).sort(), ['de', 'es', 'fr']);

  // de/fr untouched by the second batch
  const deAfter = getTranslationVariant({ ctx, posterId, lang: 'de' });
  assert.deepEqual(deAfter.content, deBefore.content);
  assert.equal(deAfter.updatedAt, deBefore.updatedAt);
  assert.equal(translateCalls(egress).length, 3); // one produce per language total
});

// ── case 3: rework loop feeds fidelity feedback into the next attempt ───────

test('rework: 2nd translate prompt carries the 1st fidelity feedback; accepted on attempt 2', async () => {
  const egress = new FakeEgress({
    'translator/translate_segment': [asModelOutput(translationFor('de')), asModelOutput(translationFor('de', '-v2'))],
    'translator/back_check_fidelity': [REWORK_FIDELITY, ACCEPT_FIDELITY]
  });
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db);

  const state = await startTranslation({ ctx, posterId, languages: ['de'] });

  const de = state.languages.find((l) => l.lang === 'de');
  assert.equal(de.attempts, 2);
  assert.equal(de.fidelityScore, 97);
  const calls = translateCalls(egress, 'de');
  assert.equal(calls.length, 2);
  assert.ok(!calls[0].opts.user.includes('PRIOR REVIEW HISTORY'), 'first attempt must have no history');
  assert.match(calls[1].opts.user, /PRIOR REVIEW HISTORY/);
  assert.ok(calls[1].opts.user.includes(REWORK_FIDELITY.feedback), '2nd prompt must carry the 1st feedback verbatim');
  assert.ok(calls[1].opts.user.includes(REWORK_FIDELITY.expected), '2nd prompt must carry what good looks like');
  // the accepted content is attempt 2's deliverable
  assert.equal(getTranslationVariant({ ctx, posterId, lang: 'de' }).content.headline, translationFor('de', '-v2').headline);
});

// ── case 4: one language failing must not dead-end the batch ────────────────

test('gate exhaustion for one language lands in failed[]; other languages still complete', async () => {
  const egress = new FakeEgress({
    'translator/translate_segment': (opts, ctx) => asModelOutput(translationFor(langOf(ctx))),
    'translator/back_check_fidelity': (opts, ctx) => (ctx.stage === 'translate:de' ? REWORK_FIDELITY : ACCEPT_FIDELITY)
  });
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db);

  const state = await startTranslation({ ctx, posterId, languages: ['de', 'fr'] }); // resolves — no throw

  assert.deepEqual(state.failed, [{ lang: 'de', code: 'GATE_EXHAUSTED' }]);
  assert.deepEqual(state.languages.map((l) => l.lang), ['fr']);
  assert.equal(state.phase, 'translated'); // ≥1 success
  assert.equal(translateCalls(egress, 'de').length, 4); // maxReworkLoops 4
  assert.equal(translateCalls(egress, 'fr').length, 1);
  const doc = loadDoc(ctx.db, posterId);
  assert.deepEqual(doc.translationFailures, [{ lang: 'de', code: 'GATE_EXHAUSTED' }]);
  assert.ok(!('de' in doc.translations));
});

test('TRANSLATION_INVALID for one language is recorded and the batch continues', async () => {
  const egress = new FakeEgress({
    'translator/translate_segment': (opts, ctx) => (
      langOf(ctx) === 'de'
        ? { headline: "I'm sorry, please provide the text you want translated" } // invalid twice → TRANSLATION_INVALID
        : asModelOutput(translationFor(langOf(ctx)))
    ),
    'translator/back_check_fidelity': () => ACCEPT_FIDELITY
  });
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db);

  const state = await startTranslation({ ctx, posterId, languages: ['de', 'fr'] });
  assert.deepEqual(state.failed, [{ lang: 'de', code: 'TRANSLATION_INVALID' }]);
  assert.deepEqual(state.languages.map((l) => l.lang), ['fr']);
});

// ── case 5: the editor canvas is the English source of truth ────────────────

test('editor-edited English canvas text rides into the translation source', async () => {
  const editedCanvas = miniCanvas();
  editedCanvas.objects.find((o) => o.layerRole === 'headline').text = 'Edited Headline From The Canvas Editor';
  const egress = new FakeEgress(PASSING_HANDLERS());
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db, { canvas: editedCanvas });

  await startTranslation({ ctx, posterId, languages: ['de'] });

  const prompt = translateCalls(egress, 'de')[0].opts.user;
  assert.ok(prompt.includes('Edited Headline From The Canvas Editor'), 'source must come from the canvas, not stale doc.content');
  assert.ok(!prompt.includes(CONTENT.headline), 'stale doc.content headline must not be the source');
});

// ── case 6: input validation ─────────────────────────────────────────────────

test('invalid languages / wrong phase / unknown poster are coded 400/409/404', async () => {
  const egress = new FakeEgress({});
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db);

  for (const bad of [[], ['xx'], ['en'], 'some', 42]) {
    await assert.rejects(
      startTranslation({ ctx, posterId, languages: bad }),
      (err) => err.code === 'INVALID_LANGUAGES' && err.status === 400
    );
  }
  const angles = seedPoster(ctx.db, { phase: 'angles', status: 'draft' });
  await assert.rejects(
    startTranslation({ ctx, posterId: angles.posterId, languages: 'all' }),
    (err) => err.code === 'WRONG_PHASE' && err.status === 409
  );
  await assert.rejects(
    startTranslation({ ctx, posterId: 'nope', languages: 'all' }),
    (err) => err.code === 'POSTER_NOT_FOUND' && err.status === 404
  );
});

// ── case 7: editTranslation — verbatim, fire-and-forget terminology ─────────

test('editTranslation applies verbatim onto the VARIANT canvas; terminology learning is fire-and-forget', async () => {
  let termCalls = 0;
  const egress = new FakeEgress({
    ...PASSING_HANDLERS(),
    'terminology-validator/validate_term_swap': () => {
      termCalls++;
      if (termCalls > 1) throw new Error('terminology egress down');
      return {
        swaps: [{
          sourceTerm: 'suspicious email', candidate: 'verdächtige E-Mail', equivalent: true,
          note: 'Standard German rendering of the same source concept.'
        }]
      };
    }
  });
  const ctx = makeCtx(egress);
  const { posterId, runId } = seedPoster(ctx.db);
  await startTranslation({ ctx, posterId, languages: ['de', 'fr'] });

  // per-language layout edit that must survive the content edit
  const doc0 = loadDoc(ctx.db, posterId);
  doc0.translations.de.canvas.objects.find((o) => o.layerRole === 'headline').left = 123;
  ctx.db.prepare('UPDATE posters SET doc = ? WHERE poster_id = ?').run(JSON.stringify(doc0), posterId);

  const edited = structuredClone(doc0.translations.de.content);
  edited.messages[0].text = '[de] Melden Sie verdächtige E-Mails sofort an {{SOC_EMAIL}}';
  const before = translateCalls(egress).length;

  const res = await editTranslation({ ctx, posterId, lang: 'de', content: edited });

  assert.equal(translateCalls(egress).length, before, 'edit is verbatim — zero translation calls');
  assert.equal(res.syncAvailable, true); // 2 variants + real changes
  const de = res.state.languages.find((l) => l.lang === 'de');
  assert.equal(de.status, 'edited');

  const variant = getTranslationVariant({ ctx, posterId, lang: 'de' });
  assert.equal(variant.status, 'edited');
  assert.equal(variant.content.messages[0].text, edited.messages[0].text);
  const msgObj = variant.canvas.objects.find((o) => o.layerRole === 'message-text' && o.msgId === 'msg-1');
  assert.equal(msgObj.text, edited.messages[0].text, 'edit applied onto the VARIANT canvas');
  assert.equal(variant.canvas.objects.find((o) => o.layerRole === 'headline').left, 123, 'variant layout edits survive');

  const doc1 = loadDoc(ctx.db, posterId);
  assert.deepEqual(doc1.translations.de.lastEditChanges, [{
    field: 'messages[0].text',
    before: doc0.translations.de.content.messages[0].text,
    after: edited.messages[0].text
  }]);

  const events = ctx.bus.eventsForRun(runId);
  const action = events.find((e) => e.type === 'user_action' && e.skill === 'edit_translation');
  assert.ok(action);
  assert.deepEqual(JSON.parse(action.payload).changedFields, ['messages[0].text']);

  // fire-and-forget landed: validated swap stored + memory_write emitted
  await settle();
  const row = ctx.db.prepare("SELECT * FROM terminology WHERE lang = 'de'").get();
  assert.equal(row.source_term, 'suspicious email');
  assert.equal(row.approved_term, 'verdächtige E-Mail');
  assert.equal(row.validated_by, 'terminology-validator');
  const written = ctx.bus.eventsForRun(runId).find((e) => e.type === 'memory_write' && e.skill === 'store_terminology');
  assert.deepEqual(JSON.parse(written.payload).stored, ['suspicious email']);

  // validator egress failure must NOT delay or fail the edit
  const edited2 = structuredClone(edited);
  edited2.callToAction = '[de] Erst denken, dann klicken';
  const res2 = await editTranslation({ ctx, posterId, lang: 'de', content: edited2 });
  assert.equal(res2.state.languages.find((l) => l.lang === 'de').status, 'edited');
  assert.equal(getTranslationVariant({ ctx, posterId, lang: 'de' }).content.callToAction, edited2.callToAction);
  await settle();
  const errEvt = ctx.bus.eventsForRun(runId).find((e) => e.type === 'error' && e.stage === 'terminology:de');
  assert.equal(JSON.parse(errEvt.payload).code, 'TERMINOLOGY_VALIDATION_FAILED');

  // guards: unknown/base language 400, missing variant 404
  await assert.rejects(
    editTranslation({ ctx, posterId, lang: 'en', content: edited }),
    (err) => err.code === 'INVALID_LANGUAGE' && err.status === 400
  );
  await assert.rejects(
    editTranslation({ ctx, posterId, lang: 'es', content: edited }),
    (err) => err.code === 'TRANSLATION_NOT_FOUND' && err.status === 404
  );
});

// ── case 8: editTranslation shape reject ─────────────────────────────────────

test('editTranslation rejects a bad shape with 400 and leaves the variant untouched', async () => {
  const egress = new FakeEgress(PASSING_HANDLERS());
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db);
  await startTranslation({ ctx, posterId, languages: ['de'] });
  const before = getTranslationVariant({ ctx, posterId, lang: 'de' });

  const bad = structuredClone(before.content);
  delete bad.headline;
  await assert.rejects(
    editTranslation({ ctx, posterId, lang: 'de', content: bad }),
    (err) => err.code === 'INVALID_CONTENT' && err.status === 400 && /headline/.test(err.message)
  );
  const after = getTranslationVariant({ ctx, posterId, lang: 'de' });
  assert.deepEqual(after.content, before.content);
  assert.equal(after.status, 'translated');
  assert.equal(loadDoc(ctx.db, posterId).translations.de.lastEditChanges, null);
});

// ── case 9: syncTranslationEdit ──────────────────────────────────────────────

test('sync re-translates other languages FROM ENGLISH with the style preference; edited variant untouched', async () => {
  const PREFERENCE = 'Prefers naming the security team explicitly instead of a generic phrase.';
  const egress = new FakeEgress({
    'translator/translate_segment': (opts, ctx) => asModelOutput(translationFor(langOf(ctx))),
    'translator/back_check_fidelity': () => ACCEPT_FIDELITY,
    'translator/apply_register': { preference: PREFERENCE },
    'terminology-validator/validate_term_swap': { swaps: [] }
  });
  const ctx = makeCtx(egress);
  const { posterId, runId } = seedPoster(ctx.db);
  await startTranslation({ ctx, posterId, languages: ['de', 'fr'] });

  const edited = structuredClone(getTranslationVariant({ ctx, posterId, lang: 'de' }).content);
  edited.messages[0].text = '[de] Melden Sie verdächtige E-Mails sofort an {{SOC_EMAIL}}';
  await editTranslation({ ctx, posterId, lang: 'de', content: edited });
  const frBefore = getTranslationVariant({ ctx, posterId, lang: 'fr' });

  const state = await syncTranslationEdit({ ctx, posterId, lang: 'de' });

  // fr was re-translated FROM ENGLISH with the preference seeded
  const frCalls = translateCalls(egress, 'fr');
  assert.equal(frCalls.length, 2); // initial + sync
  const syncPrompt = frCalls[1].opts.user;
  assert.ok(syncPrompt.includes('The user refined the de variant after translation.'));
  assert.ok(syncPrompt.includes(`Style preference to honor: ${PREFERENCE}`));
  assert.ok(syncPrompt.includes('Changed fields: messages[0].text'));
  assert.ok(syncPrompt.includes(CONTENT.headline), 'sync source must be the ENGLISH canvas content');
  assert.equal(translateCalls(egress, 'de').length, 1, 'the edited variant is never re-translated');

  // edited variant untouched; its pending edit consumed
  const de = state.languages.find((l) => l.lang === 'de');
  assert.equal(de.status, 'edited');
  assert.equal(getTranslationVariant({ ctx, posterId, lang: 'de' }).content.messages[0].text, edited.messages[0].text);
  const doc = loadDoc(ctx.db, posterId);
  assert.equal(doc.translations.de.lastEditChanges, null);

  // fr refreshed
  const frAfter = getTranslationVariant({ ctx, posterId, lang: 'fr' });
  assert.equal(frAfter.status, 'translated');
  assert.ok(frAfter.updatedAt >= frBefore.updatedAt);

  const events = ctx.bus.eventsForRun(runId);
  assert.ok(events.some((e) => e.type === 'user_action' && e.skill === 'sync_translations'));
  // finding C7: sync validates its stage transition like the start path does
  const handoff = events.find((e) => e.type === 'handoff' && e.stage === 'variant-edit → translation');
  assert.ok(handoff, 'sync must emit a variant-edit → translation handoff');
  assert.equal(handoff.agent, 'user');
  const handoffPayload = JSON.parse(handoff.payload);
  assert.equal(handoffPayload.toAgent, 'translator');
  assert.ok(handoffPayload.keys.includes('lang') && handoffPayload.keys.includes('languages'));

  // no pending edit anymore → 409
  await assert.rejects(
    syncTranslationEdit({ ctx, posterId, lang: 'de' }),
    (err) => err.code === 'NOTHING_TO_SYNC' && err.status === 409
  );
  // a never-edited language has nothing to sync either
  await assert.rejects(
    syncTranslationEdit({ ctx, posterId, lang: 'fr' }),
    (err) => err.code === 'NOTHING_TO_SYNC' && err.status === 409
  );
});

// ── case 10: getTranslationVariant ───────────────────────────────────────────

test('getTranslationVariant returns content+canvas for an existing lang, 404 otherwise', async () => {
  const egress = new FakeEgress(PASSING_HANDLERS());
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db);
  await startTranslation({ ctx, posterId, languages: ['de'] });

  const variant = getTranslationVariant({ ctx, posterId, lang: 'de' });
  assert.equal(variant.lang, 'de');
  assert.equal(variant.fidelityScore, 97);
  assert.equal(variant.status, 'translated');
  assert.deepEqual(variant.content, translationFor('de'));
  assert.equal(variant.canvas.objects.find((o) => o.layerRole === 'headline').text, translationFor('de').headline);

  assert.throws(
    () => getTranslationVariant({ ctx, posterId, lang: 'fr' }),
    (err) => err.code === 'TRANSLATION_NOT_FOUND' && err.status === 404
  );
  assert.throws(
    () => getTranslationVariant({ ctx, posterId: 'nope', lang: 'de' }),
    (err) => err.code === 'POSTER_NOT_FOUND' && err.status === 404
  );

  // safeTranslationState is exported and never carries content/canvas
  const { row, doc } = { row: ctx.db.prepare('SELECT * FROM posters WHERE poster_id = ?').get(posterId), doc: loadDoc(ctx.db, posterId) };
  const safe = safeTranslationState(row, doc);
  assert.ok(!JSON.stringify(safe).includes('Innehalten'));
  assert.equal(safe.languages[0].label, 'German');
});

// ── case 11 (finding C2): re-translation preserves per-language layout edits ──

test('re-translating an existing language applies fresh text onto the EXISTING variant canvas (layout edits survive)', async () => {
  const egress = new FakeEgress({
    'translator/translate_segment': (opts, ctx) => asModelOutput(translationFor(langOf(ctx), egress.calls.length > 2 ? '-v2' : '')),
    'translator/back_check_fidelity': () => ACCEPT_FIDELITY
  });
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db);
  await startTranslation({ ctx, posterId, languages: ['de'] });

  // per-language layout edit on the variant canvas
  const doc0 = loadDoc(ctx.db, posterId);
  doc0.translations.de.canvas.objects.find((o) => o.layerRole === 'headline').left = 123;
  ctx.db.prepare('UPDATE posters SET doc = ? WHERE poster_id = ?').run(JSON.stringify(doc0), posterId);

  // re-translate the SAME language
  await startTranslation({ ctx, posterId, languages: ['de'] });

  const doc1 = loadDoc(ctx.db, posterId);
  const headline = doc1.translations.de.canvas.objects.find((o) => o.layerRole === 'headline');
  assert.equal(headline.left, 123, 'per-language layout edit must survive re-translation');
  assert.equal(headline.text, translationFor('de', '-v2').headline, 'text must be the FRESH translation');
});

// ── case 12 (finding C5): user-added text boxes ride translation as extras ───

test('user-text canvas objects (extraId) are translated into the variant canvas instead of riding in English', async () => {
  const canvas = miniCanvas();
  canvas.objects.push({
    type: 'Textbox', left: 700, top: 700, width: 400, text: 'Stay alert!',
    layerRole: 'user-text', extraId: 'x1'
  });
  const egress = new FakeEgress({
    'translator/translate_segment': (opts, ctx) => ({
      ...asModelOutput(translationFor(langOf(ctx))),
      extras: [{ id: 'x1', text: `[${langOf(ctx)}] Bleiben Sie wachsam!` }]
    }),
    'translator/back_check_fidelity': () => ACCEPT_FIDELITY
  });
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db, { canvas });

  await startTranslation({ ctx, posterId, languages: ['de'] });

  // the English text rode into the prompt source as an extra
  const prompt = translateCalls(egress, 'de')[0].opts.user;
  assert.ok(prompt.includes('Stay alert!'), 'user-text must be in the translation source');
  assert.ok(prompt.includes('"x1"'), 'extraId must ride the source JSON');

  // the variant canvas carries the TRANSLATED user text
  const variant = getTranslationVariant({ ctx, posterId, lang: 'de' });
  const userText = variant.canvas.objects.find((o) => o.layerRole === 'user-text');
  assert.equal(userText.text, '[de] Bleiben Sie wachsam!');
  assert.equal(userText.extraId, 'x1', 'extraId survives the swap');
  assert.deepEqual(variant.content.extras, [{ id: 'x1', text: '[de] Bleiben Sie wachsam!' }]);

  // the English design canvas is untouched
  const doc = loadDoc(ctx.db, posterId);
  assert.equal(doc.design.canvas.objects.find((o) => o.layerRole === 'user-text').text, 'Stay alert!');
});

test('a model response missing extras (when the source has them) fails deterministically, never rides English', async () => {
  const canvas = miniCanvas();
  canvas.objects.push({
    type: 'Textbox', left: 700, top: 700, width: 400, text: 'Stay alert!',
    layerRole: 'user-text', extraId: 'x1'
  });
  const egress = new FakeEgress({
    // extras never included → validator rejects both attempts → TRANSLATION_INVALID
    'translator/translate_segment': (opts, ctx) => asModelOutput(translationFor(langOf(ctx))),
    'translator/back_check_fidelity': () => ACCEPT_FIDELITY
  });
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db, { canvas });

  const state = await startTranslation({ ctx, posterId, languages: ['de'] });
  assert.deepEqual(state.failed, [{ lang: 'de', code: 'TRANSLATION_INVALID' }]);
  assert.deepEqual(state.languages, []);
});

// ── case 13 (finding C6): translationFailures lifecycle ──────────────────────

test('failure ledger merges across batches: retrying one failed language keeps the other recorded, drops the fixed one', async () => {
  let deFixed = false;
  const egress = new FakeEgress({
    'translator/translate_segment': (opts, ctx) => asModelOutput(translationFor(langOf(ctx))),
    'translator/back_check_fidelity': (opts, ctx) => {
      const lang = langOf(ctx);
      if (lang === 'fr') return REWORK_FIDELITY; // fr always fails
      if (lang === 'de') return deFixed ? ACCEPT_FIDELITY : REWORK_FIDELITY;
      return ACCEPT_FIDELITY;
    }
  });
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db);

  // batch 1: de + fr both exhaust the gate
  const first = await startTranslation({ ctx, posterId, languages: ['de', 'fr'] });
  assert.deepEqual(first.failed.map((f) => f.lang).sort(), ['de', 'fr']);

  // batch 2: retry ONLY de, now passing — fr's failure must survive the merge
  deFixed = true;
  const second = await startTranslation({ ctx, posterId, languages: ['de'] });
  assert.deepEqual(second.failed, [{ lang: 'fr', code: 'GATE_EXHAUSTED' }], 'fr stays recorded, de is cleared');
  assert.ok(second.languages.some((l) => l.lang === 'de'), 'de is now a variant');
  const doc = loadDoc(ctx.db, posterId);
  assert.deepEqual(doc.translationFailures, [{ lang: 'fr', code: 'GATE_EXHAUSTED' }]);
});

test('sync success clears a prior sync failure for that language', async () => {
  let frFails = false; // fr passes the INITIAL batch, fails only during the first sync
  const egress = new FakeEgress({
    'translator/translate_segment': (opts, ctx) => asModelOutput(translationFor(langOf(ctx))),
    'translator/back_check_fidelity': (opts, ctx) => (langOf(ctx) === 'fr' && frFails ? REWORK_FIDELITY : ACCEPT_FIDELITY),
    'translator/apply_register': { preference: 'Prefers blunt, short warnings over long explanations.' },
    'terminology-validator/validate_term_swap': { swaps: [] }
  });
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db);
  await startTranslation({ ctx, posterId, languages: ['de', 'fr'] });
  frFails = true;

  // edit de, sync → fr fails during sync and lands in the ledger
  const edited = structuredClone(getTranslationVariant({ ctx, posterId, lang: 'de' }).content);
  edited.callToAction = '[de] Erst denken, dann klicken';
  await editTranslation({ ctx, posterId, lang: 'de', content: edited });
  const failedState = await syncTranslationEdit({ ctx, posterId, lang: 'de' });
  assert.deepEqual(failedState.failed, [{ lang: 'fr', code: 'GATE_EXHAUSTED' }]);

  // edit de again, sync again — fr now passes and its stale failure clears
  frFails = false;
  const edited2 = structuredClone(edited);
  edited2.callToAction = '[de] Denken Sie zuerst nach';
  await editTranslation({ ctx, posterId, lang: 'de', content: edited2 });
  const okState = await syncTranslationEdit({ ctx, posterId, lang: 'de' });
  assert.deepEqual(okState.failed, [], 'a sync success must remove the stale failure entry');
  const doc = loadDoc(ctx.db, posterId);
  assert.deepEqual(doc.translationFailures, []);
});

// ── case 14 (finding C8): editTranslation nulling a field blanks the canvas ──

test('editTranslation with callToAction null blanks the variant canvas CTA text (no stale copy)', async () => {
  const egress = new FakeEgress({
    ...PASSING_HANDLERS(),
    'terminology-validator/validate_term_swap': { swaps: [] }
  });
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db);
  await startTranslation({ ctx, posterId, languages: ['de'] });

  const edited = structuredClone(getTranslationVariant({ ctx, posterId, lang: 'de' }).content);
  edited.callToAction = null;
  await editTranslation({ ctx, posterId, lang: 'de', content: edited });

  const variant = getTranslationVariant({ ctx, posterId, lang: 'de' });
  assert.equal(variant.content.callToAction, null);
  assert.equal(variant.canvas.objects.find((o) => o.layerRole === 'cta').text, '', 'stale CTA text must be blanked');
  // fields that stayed put are untouched
  assert.equal(
    variant.canvas.objects.find((o) => o.layerRole === 'headline').text,
    translationFor('de').headline
  );
});

// ── pass-2 findings: NEW-2 (extras through editTranslation) + M1 (orphan prune) ──

test('editTranslation preserves extras when the payload omits them; validates extras edits against existing ids', async () => {
  const canvas = miniCanvas();
  canvas.objects.push({
    type: 'Textbox', left: 700, top: 700, width: 400, text: 'Stay alert!',
    layerRole: 'user-text', extraId: 'x1'
  });
  const egress = new FakeEgress({
    'translator/translate_segment': (opts, ctx) => ({
      ...asModelOutput(translationFor(langOf(ctx))),
      extras: [{ id: 'x1', text: `[${langOf(ctx)}] Bleiben Sie wachsam!` }]
    }),
    'translator/back_check_fidelity': () => ACCEPT_FIDELITY,
    'terminology-validator/validate_term_swap': { swaps: [] }
  });
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db, { canvas });
  await startTranslation({ ctx, posterId, languages: ['de'] });

  // 1. payload WITHOUT an extras key (normalizePosterContent predates extras)
  //    → extras must survive verbatim, no phantom extras[...] diffs
  const edited = structuredClone(getTranslationVariant({ ctx, posterId, lang: 'de' }).content);
  delete edited.extras;
  edited.headline = '[de] Erst prüfen, dann scannen';
  await editTranslation({ ctx, posterId, lang: 'de', content: edited });
  const afterOmit = getTranslationVariant({ ctx, posterId, lang: 'de' });
  assert.deepEqual(afterOmit.content.extras, [{ id: 'x1', text: '[de] Bleiben Sie wachsam!' }],
    'omitted extras must be preserved, not stripped');
  const doc1 = loadDoc(ctx.db, posterId);
  assert.ok(
    doc1.translations.de.lastEditChanges.every((c) => !c.field.startsWith('extras[')),
    'no phantom extras diffs when the payload omitted extras'
  );

  // 2. an explicit extras text edit is applied to content AND canvas
  const edited2 = structuredClone(afterOmit.content);
  edited2.extras = [{ id: 'x1', text: '[de] Wachsam bleiben!' }];
  await editTranslation({ ctx, posterId, lang: 'de', content: edited2 });
  const afterEdit = getTranslationVariant({ ctx, posterId, lang: 'de' });
  assert.equal(afterEdit.content.extras[0].text, '[de] Wachsam bleiben!');
  assert.equal(
    afterEdit.canvas.objects.find((o) => o.layerRole === 'user-text').text,
    '[de] Wachsam bleiben!'
  );

  // 3. unknown extra id / wrong count → 400, variant untouched
  const bad = structuredClone(afterEdit.content);
  bad.extras = [{ id: 'nope', text: 'x' }];
  await assert.rejects(
    () => editTranslation({ ctx, posterId, lang: 'de', content: bad }),
    (err) => err.code === 'INVALID_CONTENT' && err.status === 400 && /extras\[0\]\.id/.test(err.message)
  );
  const bad2 = structuredClone(afterEdit.content);
  bad2.extras = [];
  await assert.rejects(
    () => editTranslation({ ctx, posterId, lang: 'de', content: bad2 }),
    (err) => err.code === 'INVALID_CONTENT' && /exactly the variant's 1 entries/.test(err.message)
  );
  assert.equal(
    getTranslationVariant({ ctx, posterId, lang: 'de' }).content.extras[0].text,
    '[de] Wachsam bleiben!', 'rejected edits must not touch the variant'
  );
});

test('re-translation prunes user-text deleted from English; variant-local user-text survives', async () => {
  const canvas = miniCanvas();
  canvas.objects.push({
    type: 'Textbox', left: 700, top: 700, width: 400, text: 'Stay alert!',
    layerRole: 'user-text', extraId: 'x1'
  });
  let sourceHasX1 = true;
  const egress = new FakeEgress({
    'translator/translate_segment': (opts, ctx) => ({
      ...asModelOutput(translationFor(langOf(ctx), sourceHasX1 ? '' : ' v2')),
      extras: sourceHasX1 ? [{ id: 'x1', text: `[${langOf(ctx)}] Bleiben Sie wachsam!` }] : []
    }),
    'translator/back_check_fidelity': () => ACCEPT_FIDELITY
  });
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db, { canvas });
  await startTranslation({ ctx, posterId, languages: ['de'] });

  // the translation-time snapshot records which extras came FROM ENGLISH
  assert.deepEqual(loadDoc(ctx.db, posterId).translations.de.sourceExtraIds, ['x1']);

  // user adds a GERMAN-ONLY text box in the variant. Reproduce the FULL
  // editor-save effect (routes/editor.js): the object lands on the variant
  // canvas AND content is re-extracted from that canvas, so the local id
  // CONTAMINATES variant.content.extras. Only sourceExtraIds stays clean —
  // pruning against content.extras would delete the local box (pass-3 F1).
  // Then delete x1 from the English design canvas.
  const doc = loadDoc(ctx.db, posterId);
  doc.translations.de.canvas.objects.push({
    type: 'Textbox', left: 100, top: 1900, width: 300, text: 'Nur für DE: Hotline 1234',
    layerRole: 'user-text', extraId: 'xl-de-local'
  });
  doc.translations.de.content.extras = [
    ...doc.translations.de.content.extras,
    { id: 'xl-de-local', text: 'Nur für DE: Hotline 1234' }
  ];
  doc.design.canvas.objects = doc.design.canvas.objects.filter((o) => o.extraId !== 'x1');
  ctx.db.prepare('UPDATE posters SET doc = ? WHERE poster_id = ?').run(JSON.stringify(doc), posterId);

  sourceHasX1 = false;
  await startTranslation({ ctx, posterId, languages: ['de'] });

  const variant = getTranslationVariant({ ctx, posterId, lang: 'de' });
  const userTexts = variant.canvas.objects.filter((o) => o.layerRole === 'user-text');
  assert.ok(!userTexts.some((o) => o.extraId === 'x1'), 'x1 was deleted from English — must be pruned');
  const local = userTexts.find((o) => o.extraId === 'xl-de-local');
  assert.ok(local, 'variant-local user-text must survive re-translation (even with contaminated content.extras)');
  assert.equal(local.text, 'Nur für DE: Hotline 1234', 'binding-not-found leaves variant-local text untouched');
  assert.deepEqual(loadDoc(ctx.db, posterId).translations.de.sourceExtraIds, [], 'snapshot refreshed at re-translation');
});

test('editTranslation with a null extras entry is a coded 400, never a TypeError 500', async () => {
  const canvas = miniCanvas();
  canvas.objects.push({
    type: 'Textbox', left: 700, top: 700, width: 400, text: 'Stay alert!',
    layerRole: 'user-text', extraId: 'x1'
  });
  const egress = new FakeEgress({
    'translator/translate_segment': (opts, ctx) => ({
      ...asModelOutput(translationFor(langOf(ctx))),
      extras: [{ id: 'x1', text: `[${langOf(ctx)}] Bleiben Sie wachsam!` }]
    }),
    'translator/back_check_fidelity': () => ACCEPT_FIDELITY
  });
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db, { canvas });
  await startTranslation({ ctx, posterId, languages: ['de'] });

  const bad = structuredClone(getTranslationVariant({ ctx, posterId, lang: 'de' }).content);
  bad.extras = [null];
  await assert.rejects(
    () => editTranslation({ ctx, posterId, lang: 'de', content: bad }),
    (err) => err.code === 'INVALID_CONTENT' && err.status === 400 && /extras\[0\] must be an object/.test(err.message)
  );
});

// ── O10 (plan D2): dual-orientation variants ─────────────────────────────────

test('O10: v2 poster — startTranslation builds BOTH orientations from ONE translation; landscape geometry preserved', async () => {
  const egress = new FakeEgress(PASSING_HANDLERS());
  const ctx = makeCtx(egress);
  const landscape = toLandscape(miniCanvas());
  const { posterId } = seedPoster(ctx.db, { landscape });

  await startTranslation({ ctx, posterId, languages: ['de'] });

  // ONE translate call — the portrait canvas is the single source for both
  assert.equal(translateCalls(egress, 'de').length, 1);

  const doc = loadDoc(ctx.db, posterId);
  const variant = doc.translations.de;
  // portrait: unchanged O10-pre behavior
  assert.equal(variant.canvas.objects.find((o) => o.layerRole === 'headline').text, translationFor('de').headline);
  // landscape: SAME translated text in LANDSCAPE geometry
  assert.equal(variant.landscapeCanvas.width, 2000);
  assert.equal(variant.landscapeCanvas.height, 1414);
  const lHead = variant.landscapeCanvas.objects.find((o) => o.layerRole === 'headline');
  assert.equal(lHead.text, translationFor('de').headline);
  assert.equal(lHead.left, landscape.objects.find((o) => o.layerRole === 'headline').left, 'landscape geometry preserved');
  assert.equal(variant.landscapeCanvas.objects.find((o) => o.layerRole === 'decor').text, '!', 'decor never swapped in landscape either');
  // both English design canvases untouched (variants are clones)
  assert.equal(doc.design.canvas.objects.find((o) => o.layerRole === 'headline').text, CONTENT.headline);
  assert.equal(doc.design.landscape.canvas.objects.find((o) => o.layerRole === 'headline').text, CONTENT.headline);

  // variant GET carries landscapeCanvas
  const got = getTranslationVariant({ ctx, posterId, lang: 'de' });
  assert.equal(got.landscapeCanvas.objects.find((o) => o.layerRole === 'headline').text, translationFor('de').headline);

  // safe views stay canvas-free
  const state = getTranslationState({ ctx, posterId });
  assert.ok(!JSON.stringify(state).includes('landscapeCanvas'), 'safe state must not carry canvases');
});

test('O10 regression: v1 poster (no landscape design) never gains a landscapeCanvas key; variant GET carries null', async () => {
  const egress = new FakeEgress({
    ...PASSING_HANDLERS(),
    'translator/apply_register': { preference: 'Short, blunt warnings.' },
    'terminology-validator/validate_term_swap': { swaps: [] }
  });
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db); // v1: design.canvas only

  await startTranslation({ ctx, posterId, languages: ['de', 'fr'] });
  let doc = loadDoc(ctx.db, posterId);
  assert.ok(!('landscapeCanvas' in doc.translations.de), 'v1 variant must not carry landscapeCanvas');
  assert.equal(getTranslationVariant({ ctx, posterId, lang: 'de' }).landscapeCanvas, null);

  // the key stays absent through edit + sync too
  const edited = structuredClone(doc.translations.de.content);
  edited.callToAction = '[de] Erst denken, dann klicken';
  await editTranslation({ ctx, posterId, lang: 'de', content: edited });
  await syncTranslationEdit({ ctx, posterId, lang: 'de' });
  doc = loadDoc(ctx.db, posterId);
  assert.ok(!('landscapeCanvas' in doc.translations.de));
  assert.ok(!('landscapeCanvas' in doc.translations.fr), 'synced v1 variants must not gain landscapeCanvas');
});

test('O10: re-translation keeps per-language landscape layout edits and prunes orphaned extras in BOTH canvases', async () => {
  const userBox = {
    type: 'Textbox', left: 700, top: 700, width: 400, text: 'Stay alert!',
    layerRole: 'user-text', extraId: 'x1'
  };
  const canvas = miniCanvas();
  canvas.objects.push(structuredClone(userBox));
  const landscape = toLandscape(miniCanvas());
  landscape.objects.push({ ...structuredClone(userBox), left: 1700, top: 100 });
  let sourceHasX1 = true;
  const egress = new FakeEgress({
    'translator/translate_segment': (opts, tctx) => ({
      ...asModelOutput(translationFor(langOf(tctx), sourceHasX1 ? '' : ' v2')),
      extras: sourceHasX1 ? [{ id: 'x1', text: `[${langOf(tctx)}] Bleiben Sie wachsam!` }] : []
    }),
    'translator/back_check_fidelity': () => ACCEPT_FIDELITY
  });
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db, { canvas, landscape });
  await startTranslation({ ctx, posterId, languages: ['de'] });

  // translated user-text landed in BOTH orientations
  let variant = getTranslationVariant({ ctx, posterId, lang: 'de' });
  assert.equal(variant.canvas.objects.find((o) => o.extraId === 'x1').text, '[de] Bleiben Sie wachsam!');
  assert.equal(variant.landscapeCanvas.objects.find((o) => o.extraId === 'x1').text, '[de] Bleiben Sie wachsam!');

  // per-language layout edits on BOTH variant canvases + a de-local user-text
  // box on the landscape; then delete x1 from the English PORTRAIT source
  const doc = loadDoc(ctx.db, posterId);
  doc.translations.de.canvas.objects.find((o) => o.layerRole === 'headline').left = 123;
  doc.translations.de.landscapeCanvas.objects.find((o) => o.layerRole === 'headline').left = 777;
  doc.translations.de.landscapeCanvas.objects.push({
    type: 'Textbox', left: 50, top: 1300, width: 300, text: 'Nur für DE: Hotline 1234',
    layerRole: 'user-text', extraId: 'xl-de-local'
  });
  doc.design.canvas.objects = doc.design.canvas.objects.filter((o) => o.extraId !== 'x1');
  ctx.db.prepare('UPDATE posters SET doc = ? WHERE poster_id = ?').run(JSON.stringify(doc), posterId);

  sourceHasX1 = false;
  await startTranslation({ ctx, posterId, languages: ['de'] });

  variant = getTranslationVariant({ ctx, posterId, lang: 'de' });
  // portrait: fresh text, layout edit survives, x1 pruned
  const pHead = variant.canvas.objects.find((o) => o.layerRole === 'headline');
  assert.equal(pHead.left, 123);
  assert.equal(pHead.text, translationFor('de', ' v2').headline);
  assert.ok(!variant.canvas.objects.some((o) => o.extraId === 'x1'), 'x1 must be pruned from the portrait canvas');
  // landscape: fresh text, layout edit survives, x1 pruned, LOCAL box survives
  const lHead = variant.landscapeCanvas.objects.find((o) => o.layerRole === 'headline');
  assert.equal(lHead.left, 777, 'per-language landscape layout edit must survive re-translation');
  assert.equal(lHead.text, translationFor('de', ' v2').headline, 'landscape text must be the FRESH translation');
  assert.ok(!variant.landscapeCanvas.objects.some((o) => o.extraId === 'x1'), 'x1 must be pruned from the landscape canvas too');
  const local = variant.landscapeCanvas.objects.find((o) => o.extraId === 'xl-de-local');
  assert.ok(local, 'variant-local landscape user-text must survive re-translation');
  assert.equal(local.text, 'Nur für DE: Hotline 1234');
});

test('O10: editTranslation patches BOTH canvases; landscape layout edits survive; null field blanks both', async () => {
  const egress = new FakeEgress({
    ...PASSING_HANDLERS(),
    'terminology-validator/validate_term_swap': { swaps: [] }
  });
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db, { landscape: toLandscape(miniCanvas()) });
  await startTranslation({ ctx, posterId, languages: ['de'] });

  // landscape layout edit that must survive the content edit
  const doc0 = loadDoc(ctx.db, posterId);
  doc0.translations.de.landscapeCanvas.objects.find((o) => o.layerRole === 'headline').left = 777;
  ctx.db.prepare('UPDATE posters SET doc = ? WHERE poster_id = ?').run(JSON.stringify(doc0), posterId);

  const edited = structuredClone(doc0.translations.de.content);
  edited.messages[0].text = '[de] Melden Sie verdächtige E-Mails sofort an {{SOC_EMAIL}}';
  edited.callToAction = null;
  await editTranslation({ ctx, posterId, lang: 'de', content: edited });

  const variant = getTranslationVariant({ ctx, posterId, lang: 'de' });
  for (const [label, cv] of [['portrait', variant.canvas], ['landscape', variant.landscapeCanvas]]) {
    const msg = cv.objects.find((o) => o.layerRole === 'message-text' && o.msgId === 'msg-1');
    assert.equal(msg.text, edited.messages[0].text, `edit must land on the ${label} canvas`);
    assert.equal(cv.objects.find((o) => o.layerRole === 'cta').text, '', `nulled CTA must blank the ${label} canvas`);
  }
  assert.equal(
    variant.landscapeCanvas.objects.find((o) => o.layerRole === 'headline').left, 777,
    'landscape layout edit must survive the content edit'
  );
});

test('O10: sync re-translates other variants onto BOTH their canvases; edited variant untouched', async () => {
  let synced = false;
  const egress = new FakeEgress({
    'translator/translate_segment': (opts, tctx) => asModelOutput(translationFor(langOf(tctx), synced ? '-v2' : '')),
    'translator/back_check_fidelity': () => ACCEPT_FIDELITY,
    'translator/apply_register': { preference: 'Prefers blunt, short warnings.' },
    'terminology-validator/validate_term_swap': { swaps: [] }
  });
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db, { landscape: toLandscape(miniCanvas()) });
  await startTranslation({ ctx, posterId, languages: ['de', 'fr'] });

  // fr landscape layout edit that must survive the sync re-translation
  const doc0 = loadDoc(ctx.db, posterId);
  doc0.translations.fr.landscapeCanvas.objects.find((o) => o.layerRole === 'headline').left = 555;
  ctx.db.prepare('UPDATE posters SET doc = ? WHERE poster_id = ?').run(JSON.stringify(doc0), posterId);

  const edited = structuredClone(doc0.translations.de.content);
  edited.callToAction = '[de] Erst denken, dann klicken';
  await editTranslation({ ctx, posterId, lang: 'de', content: edited });

  synced = true;
  await syncTranslationEdit({ ctx, posterId, lang: 'de' });

  const fr = getTranslationVariant({ ctx, posterId, lang: 'fr' });
  assert.equal(fr.canvas.objects.find((o) => o.layerRole === 'headline').text, translationFor('fr', '-v2').headline);
  const frLHead = fr.landscapeCanvas.objects.find((o) => o.layerRole === 'headline');
  assert.equal(frLHead.text, translationFor('fr', '-v2').headline, 'sync must refresh the landscape canvas too');
  assert.equal(frLHead.left, 555, 'fr landscape layout edit must survive the sync');
  // the edited de variant stays untouched by the sync — both orientations
  const de = getTranslationVariant({ ctx, posterId, lang: 'de' });
  assert.equal(de.canvas.objects.find((o) => o.layerRole === 'cta').text, edited.callToAction);
  assert.equal(de.landscapeCanvas.objects.find((o) => o.layerRole === 'cta').text, edited.callToAction);
});

test('O10: a variant translated BEFORE the landscape design existed gains landscapeCanvas from the design on re-translation', async () => {
  const egress = new FakeEgress(PASSING_HANDLERS());
  const ctx = makeCtx(egress);
  const { posterId } = seedPoster(ctx.db); // v1 at first translation
  await startTranslation({ ctx, posterId, languages: ['de'] });
  assert.ok(!('landscapeCanvas' in loadDoc(ctx.db, posterId).translations.de));

  // landscape design arrives later (e.g., re-design onto a v2 template)
  const doc = loadDoc(ctx.db, posterId);
  doc.design.landscape = { canvas: toLandscape(miniCanvas()) };
  ctx.db.prepare('UPDATE posters SET doc = ? WHERE poster_id = ?').run(JSON.stringify(doc), posterId);

  await startTranslation({ ctx, posterId, languages: ['de'] });
  const variant = getTranslationVariant({ ctx, posterId, lang: 'de' });
  assert.equal(variant.landscapeCanvas.width, 2000, 'landscape base falls back to the design canvas');
  assert.equal(
    variant.landscapeCanvas.objects.find((o) => o.layerRole === 'headline').text,
    translationFor('de').headline
  );
});

// ── v2 (template-first) posters: REAL qa-chat build through the pipeline ─────
// LIVE E2E regression: translating a v2 poster (content.blocks, canvases from
// templates/v2 with layerRole 'message' + msgId 'blk-N' + fieldRef) crashed in
// the translator's v1-only serialization. These fixtures are REAL template
// builds (templates/v2/index.js buildCanvas), not hand-rolled canvases.

const EDITED_V2_QUESTION = 'Was this question edited straight in the canvas editor?';

/** Seed a v2 qa-chat poster: real portrait+landscape builds, blocks content. */
function seedV2QaPoster(db, { editPortraitQuestion = false } = {}) {
  const content = sampleContentFor(getTemplateV2('qa-chat').contentSchema); // blocks: 4× {id:'blk-N', question, answer}
  const portrait = buildCanvas('qa-chat', 'portrait', content);
  const landscape = buildCanvas('qa-chat', 'landscape', content);
  if (editPortraitQuestion) {
    // simulate a Canva-editor text edit on the ENGLISH portrait canvas —
    // the canvas (not doc.content) is the translation source of truth
    portrait.objects.find((o) => o.layerRole === 'message' && o.msgId === 'blk-1' && o.fieldRef === 'question')
      .text = EDITED_V2_QUESTION;
  }
  const seeded = seedPoster(db, { canvas: portrait, landscape, content });
  return { ...seeded, content, portrait, landscape };
}

/** Deterministic v2 "translation" of whatever blocks the source carries. */
function v2TranslationFor(lang, blocks) {
  return {
    headline: `[${lang}] Innehalten, bevor Sie klicken`,
    subheadline: `[${lang}] Ein übereilter Klick kann Angreifern die Schlüssel geben`,
    blocks: blocks.map((b) => ({
      id: b.id,
      question: `[${lang}] Frage: ${b.question}`,
      answer: `[${lang}] Antwort: ${b.answer}`
    })),
    callToAction: `[${lang}] Melden Sie verdächtige E-Mails an das SOC`,
    extras: []
  };
}

test('v2 E2E: real qa-chat build translates end-to-end — both orientations carry swapped question AND answer texts, ids verbatim', async () => {
  const egress = new FakeEgress({
    // scripted model: translate the blocks the SOURCE JSON actually carries
    'translator/translate_segment': (opts, tctx) => {
      const src = JSON.parse(opts.user.match(/<user_text>\n?(\{.*?\})\n?<\/user_text>/s)[1]);
      return v2TranslationFor(langOf(tctx), src.blocks);
    },
    'translator/back_check_fidelity': () => ACCEPT_FIDELITY
  });
  const ctx = makeCtx(egress);
  const seeded = seedV2QaPoster(ctx.db, { editPortraitQuestion: true });

  const state = await startTranslation({ ctx, posterId: seeded.posterId, languages: ['de'] });
  assert.deepEqual(state.failed, []);
  assert.deepEqual(state.languages.map((l) => l.lang), ['de']);

  // the canvas is the source of truth: the editor-edited question rode into
  // the prompt (extractContentFromCanvas understood the v2 block binding)
  const prompt = translateCalls(egress, 'de')[0].opts.user;
  assert.ok(prompt.includes(EDITED_V2_QUESTION), 'edited canvas question must be the translation source');
  assert.ok(prompt.includes('"blocks"'), 'source JSON must carry blocks');

  const variant = getTranslationVariant({ ctx, posterId: seeded.posterId, lang: 'de' });

  // content: ids verbatim, every block field translated, no messages key
  assert.deepEqual(variant.content.blocks.map((b) => b.id), seeded.content.blocks.map((b) => b.id));
  assert.equal(variant.content.blocks[0].question, `[de] Frage: ${EDITED_V2_QUESTION}`);
  assert.ok(!('messages' in variant.content));

  // BOTH orientations: every block's question AND answer text swapped on the
  // real template canvases (layerRole 'message' + msgId + fieldRef binding)
  for (const [label, cv] of [['portrait', variant.canvas], ['landscape', variant.landscapeCanvas]]) {
    for (const b of variant.content.blocks) {
      const q = cv.objects.find((o) => o.layerRole === 'message' && o.msgId === b.id && o.fieldRef === 'question');
      const a = cv.objects.find((o) => o.layerRole === 'message' && o.msgId === b.id && o.fieldRef === 'answer');
      assert.equal(q.text, b.question, `${label} ${b.id} question must be the translated text`);
      assert.equal(a.text, b.answer, `${label} ${b.id} answer must be the translated text`);
    }
    assert.equal(cv.objects.find((o) => o.layerRole === 'headline').text, variant.content.headline, `${label} headline swapped`);
    assert.equal(cv.objects.find((o) => o.layerRole === 'cta').text, variant.content.callToAction, `${label} CTA swapped`);
  }
  // landscape stays landscape-shaped (real template dims)
  assert.equal(variant.landscapeCanvas.width, seeded.landscape.width);
  assert.equal(variant.landscapeCanvas.height, seeded.landscape.height);

  // English design canvases untouched
  const doc = loadDoc(ctx.db, seeded.posterId);
  const engQ = doc.design.canvas.objects.find((o) => o.layerRole === 'message' && o.msgId === 'blk-1' && o.fieldRef === 'question');
  assert.equal(engQ.text, EDITED_V2_QUESTION, 'the English portrait canvas keeps its (edited) English text');
  const engLandQ = doc.design.landscape.canvas.objects.find((o) => o.layerRole === 'message' && o.msgId === 'blk-2' && o.fieldRef === 'question');
  assert.equal(engLandQ.text, seeded.content.blocks[1].question);
});

test('v2 E2E: a model response missing a block field fails deterministically (TRANSLATION_INVALID recorded, batch continues)', async () => {
  const egress = new FakeEgress({
    'translator/translate_segment': (opts, tctx) => {
      const src = JSON.parse(opts.user.match(/<user_text>\n?(\{.*?\})\n?<\/user_text>/s)[1]);
      const out = v2TranslationFor(langOf(tctx), src.blocks);
      if (langOf(tctx) === 'de') out.blocks.forEach((b) => delete b.answer); // de always drops every answer
      return out;
    },
    'translator/back_check_fidelity': () => ACCEPT_FIDELITY
  });
  const ctx = makeCtx(egress);
  const { posterId } = seedV2QaPoster(ctx.db);

  const state = await startTranslation({ ctx, posterId, languages: ['de', 'fr'] });

  assert.deepEqual(state.failed, [{ lang: 'de', code: 'TRANSLATION_INVALID' }]);
  assert.deepEqual(state.languages.map((l) => l.lang), ['fr'], 'fr must still complete');
  // the repair attempt named the exact block-field violation
  const deCalls = translateCalls(egress, 'de');
  assert.equal(deCalls.length, 2, 'invalid → one repair retry → TRANSLATION_INVALID');
  assert.ok(deCalls[1].opts.user.includes('blocks[0].answer must be a non-empty string'));
  // fr variant landed with translated blocks on both orientations
  const fr = getTranslationVariant({ ctx, posterId, lang: 'fr' });
  assert.ok(fr.content.blocks.every((b) => b.question.startsWith('[fr] Frage:') && b.answer.startsWith('[fr] Antwort:')));
  assert.ok(fr.landscapeCanvas.objects.some((o) => o.layerRole === 'message' && o.fieldRef === 'answer' && o.text.startsWith('[fr] Antwort:')));
});

// ── Job A + Job B: translation stage events + boundary sub-agents ────────────

// eventsForRun returns persisted events whose payload is a JSON string; parse it.
function parsePayload(e) {
  if (e && typeof e.payload === 'string') {
    try { return { ...e, payload: JSON.parse(e.payload) }; } catch { return e; }
  }
  return e;
}

test('Job A: startTranslation emits stage_start/stage_end under agent "translation-agent"', async () => {
  const egress = new FakeEgress(PASSING_HANDLERS());
  const ctx = makeCtx(egress);
  const { posterId, runId } = seedPoster(ctx.db);

  await startTranslation({ ctx, posterId, languages: ['de', 'fr'] });

  const events = ctx.bus.eventsForRun(runId).map(parsePayload).filter((e) => e.agent === 'translation-agent');
  const starts = events.filter((e) => e.type === 'stage_start');
  const ends = events.filter((e) => e.type === 'stage_end');
  assert.equal(starts.length, 1, 'one translation-agent stage_start');
  assert.equal(ends.length, 1, 'one translation-agent stage_end');
  assert.deepEqual(ends[0].payload.translated.sort(), ['de', 'fr']);
});

test('Job B: translation boundary emits stage-qa + context-refiner events; non-blocking', async () => {
  const egress = new FakeEgress(PASSING_HANDLERS());
  const ctx = makeCtx(egress);
  const { posterId, runId } = seedPoster(ctx.db);

  const state = await startTranslation({ ctx, posterId, languages: ['de'] });
  assert.equal(state.phase, 'translated', 'translation still completes (boundary is non-blocking)');

  const events = ctx.bus.eventsForRun(runId).map(parsePayload);
  const qa = events.filter((e) => e.agent === 'stage-qa' && e.payload?.qaStage === 'translation');
  const refiner = events.filter((e) => e.agent === 'context-refiner' && e.payload?.forStage === 'save');
  assert.equal(qa.length, 1, 'one stage-qa event at the translation boundary');
  assert.equal(qa[0].payload.ok, true, 'every bound text translated, no empty strings');
  assert.ok(refiner.some((e) => e.type === 'stage_start') && refiner.some((e) => e.type === 'stage_end'),
    'context-refiner start+end at the translation boundary');
});

test('Job B: translation boundary QA still records events even when one language fails (batch continues)', async () => {
  // de fails fidelity (gate exhausted); fr passes → boundary QA over the succeeded set only
  const egress = new FakeEgress({
    'translator/translate_segment': (opts, ctx) => asModelOutput(translationFor(langOf(ctx))),
    'translator/back_check_fidelity': (opts, ctx) => (langOf(ctx) === 'de' ? REWORK_FIDELITY : ACCEPT_FIDELITY)
  });
  const ctx = makeCtx(egress);
  const { posterId, runId } = seedPoster(ctx.db);

  const state = await startTranslation({ ctx, posterId, languages: ['de', 'fr'] });
  assert.ok(state.failed.some((f) => f.lang === 'de'), 'de recorded as failed');
  assert.ok(state.languages.some((l) => l.lang === 'fr'), 'fr still translated');

  const events = ctx.bus.eventsForRun(runId).map(parsePayload);
  const qa = events.filter((e) => e.agent === 'stage-qa' && e.payload?.qaStage === 'translation');
  assert.equal(qa.length, 1, 'boundary QA fired once for the batch');
  assert.equal(qa[0].payload.ok, true, 'the succeeded (fr) content is complete');
});
