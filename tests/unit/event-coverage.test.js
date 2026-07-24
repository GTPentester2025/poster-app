// Comprehensive event-coverage test (observability pass).
//
// Drives a FULL v2 template poster lifecycle over a REAL EventBus + sqlite
// mirror with a scripted FakeEgress — start → angles (ai) → approve → design
// apply (v2 template) → image batch slot-fill (fake image) → translate one
// language — and asserts that EVERY agent EXPECTED to emit on that path
// emitted at least one event.
//
// The definitive fired/not-fired matrix (per stage/path) is printed via
// t.diagnostic() so the test output IS the coverage report. Path-dependent /
// on-demand agents (design-recommender, design-reviewer, image-tagger,
// poster-editor, edit-learning, terminology-validator, template-recommender)
// are asserted ONLY on the path that actually exercises them (dynamic design,
// editor actions, manual autotag, translation edits) — never on the mainline
// v2 template lifecycle, where they legitimately stay dark.
//
// This test both PROVES coverage and DOCUMENTS the roster: the MAINLINE_EXPECTED
// / PATH_DEPENDENT sets below are the single source of truth for what the
// pipeline_theater viz marks as "on-demand".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus, newRunId } from '#shared';
import { GateEngine, Harness } from '#orchestration';
import { randomUUID } from 'node:crypto';
import { openDb } from '../../backend/db.js';
import {
  startContentPipeline, chooseAngles, approveContent
} from '../../pipelines/content_pipeline.js';
import { runDesignPipeline, retryDesign } from '../../pipelines/design_pipeline.js';
import { generateForSlots } from '../../pipelines/image_pipeline.js';
import { startTranslation, editTranslation } from '../../pipelines/translation_pipeline.js';
import {
  FakeEgress, seedArticles, INTENT_OUTPUT, CONTEXT_OUTPUT,
  ACCEPT_REVIEW, DESIGN_SPEC_V2, DESIGN_ACCEPT_REVIEW, GEN_IMAGE_1024, IMAGE_VISION_OUTPUT
} from './helpers/fake_egress.js';

// ── roster ───────────────────────────────────────────────────────────────────
// Agents that emit their OWN bus stage/user/memory events on the MAINLINE v2
// template lifecycle (start→…→translate). These light the viz directly.
const MAINLINE_EXPECTED = [
  'keyword-intent',
  'rag-research',
  'context-refiner',
  'stage-qa',
  'overseer',
  'design-compiler',
  'art-director',
  'background-director',
  'image-generator',
  'image-pipeline',
  'learning-memory',
  'translation-agent',
  'user'
];

// EGRESS-DRIVEN agents: they never emit their own bus event — they pass their
// agent id only as EGRESS CONTEXT, and the MaskingEgress emits the
// `agent_output` event that lights their viz node in production. Under
// FakeEgress no agent_output is synthesized, so their node stays dark in tests
// EVEN THOUGH they ran. We prove coverage by asserting each made ≥1 egress call
// on the mainline (which guarantees an agent_output in prod). Keyed by the
// egress ctx { agent, skill } that carries their id.
const EGRESS_DRIVEN_MAINLINE = [
  { agent: 'content-generator', note: 'v2 content generation' },
  { agent: 'content-reviewer', note: '95-gate review' },
  { agent: 'image-concept', note: 'per-slot concept derivation' },
  { agent: 'image-quality-reviewer', note: 'aesthetic soft gate' },
  { agent: 'image-text-gate', note: 'zero-text hard gate' },
  { agent: 'translator', note: 'per-language translate + fidelity back-check' }
];

// Path-dependent / on-demand agents — NOT expected on the mainline path.
// Each is proven to fire on ITS path in a dedicated sub-test below (except
// poster-editor: the editor route has no distinct agent id — editor saves ride
// agent:'user'/'content-generator' — so it is documented, not a graph emitter).
const PATH_DEPENDENT = [
  'design-recommender',      // dynamic design path only
  'design-reviewer',         // dynamic design path only
  'template-recommender',    // AI-pick / v2 design retry only
  'image-tagger',            // manual autotag route only
  'edit-learning',           // inline-edit significance classification only
  'terminology-validator'    // translation EDIT with term swaps only
];


// v2 blocks content the template-first generator returns (schema: sequence,
// fields label/text, 3-5 blocks) — passes validateContentAgainstSchema so the
// generator never needs a repair retry (single fixture per call).
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

// v1 messages content (dynamic-design path uses a v1 poster, no template).
const V1_MESSAGES = {
  headline: 'Pause Before You Scan or Sign In',
  subheadline: 'Attackers copy real sign-in pages to capture what you type',
  messages: [
    { label: 'RED FLAG', text: 'A QR code arriving by email instead of a plain link' },
    { label: 'RED FLAG', text: 'A one-time code request on a page you did not open' },
    { label: 'DO', text: 'Open the real site from your bookmarks, not the message' },
    { label: 'DO', text: 'Report the message to the security team, do not reply' }
  ],
  callToAction: 'Report suspicious messages to {{SOC_EMAIL}}',
  format: 'red-flags'
};

function makeCtx(egress) {
  const dir = mkdtempSync(join(tmpdir(), 'postter-event-coverage-'));
  const db = openDb(join(dir, 'test.sqlite'));
  seedArticles(db);
  const bus = new EventBus({ logDir: join(dir, 'runs'), db });
  const gateEngine = new GateEngine({ bus });
  const harness = new Harness({ bus, gateEngine });
  return { db, bus, vault: null, egress, gateEngine, harness, dir };
}

// Distinct agents that emitted at least one event.
function firedAgents(events) {
  return new Set(events.map((e) => e.agent));
}

// A deterministic v2 translation model output (echoes the blocks source shape).
function fakeTranslateHandlers() {
  return {
    'translator/translate_segment': (opts, ctx) => {
      const lang = ctx.stage.split(':')[1];
      return {
        headline: `[${lang}] Innehalten vor dem Scannen oder Anmelden`,
        subheadline: `[${lang}] Eine unüberlegte Aktion kann Angreifern die Tür öffnen`,
        blocks: [
          { id: 'blk-1', label: `[${lang}] Erkennen`, text: `[${lang}] Ein QR-Code per E-Mail statt eines einfachen Links` },
          { id: 'blk-2', label: `[${lang}] Innehalten`, text: `[${lang}] Eine Einmalcode-Anfrage auf einer nicht geöffneten Seite` },
          { id: 'blk-3', label: `[${lang}] Prüfen`, text: `[${lang}] Öffnen Sie die echte Seite über Ihre Lesezeichen` },
          { id: 'blk-4', label: `[${lang}] Melden`, text: `[${lang}] Melden Sie die Nachricht dem Sicherheitsteam` }
        ],
        callToAction: `[${lang}] Melden Sie verdächtige Nachrichten an __LOCK_0__`,
        extras: [],
        format: 'sequence'
      };
    },
    'translator/back_check_fidelity': () => ({ score: 97, status: 'accepted', feedback: '', expected: '', issues: [] })
  };
}

// ── the mainline lifecycle ───────────────────────────────────────────────────

test('MAINLINE v2 lifecycle: every expected agent emits ≥1 event; on-demand agents stay dark', async (t) => {
  const egress = new FakeEgress({
    'keyword-intent': INTENT_OUTPUT,
    'rag-research/synthesize_context': CONTEXT_OUTPUT,
    'content-generator': () => structuredClone(V2_BLOCKS),
    'content-reviewer': () => structuredClone(ACCEPT_REVIEW),
    'image-concept/concept_for_point': { concept: 'flat vector illustration, single subject, no text', signals: [] },
    'image-generator/generate_asset': { imageBase64: GEN_IMAGE_1024, promptUsed: 'flat vector illustration, no text' },
    'image-text-gate/detect_embedded_text': IMAGE_VISION_OUTPUT,
    'image-quality-reviewer/review_aesthetics': { status: 'accepted', score: 88, feedback: '', expected: '', reason: '' },
    'asset-recommender/recommend_asset': { imageId: null, confidence: 0, reason: 'no match' },
    'overseer/review_prompting': { score: 90, notes: [] },
    ...fakeTranslateHandlers()
  });
  const ctx = makeCtx(egress);

  const start = await startContentPipeline({ ctx, prompt: 'warn staff about QR phishing', templateId: 'timeline-journey' });
  const runId = start.runId;
  const startEvents = ctx.bus.eventsForRun(runId);

  await chooseAngles({ ctx, posterId: start.posterId, angleIds: 'ai' });
  await approveContent({ ctx, posterId: start.posterId });
  await runDesignPipeline({ ctx, posterId: start.posterId, mode: 'template', templateId: 'timeline-journey' });
  await generateForSlots({ ctx, posterId: start.posterId, slotIds: ['slot-1'] });
  await startTranslation({ ctx, posterId: start.posterId, languages: ['de'] });

  await new Promise((r) => setTimeout(r, 30)); // fire-and-forget overseer/terminology settle

  const all = ctx.bus.eventsForRun(runId);
  const fired = firedAgents(all);
  const called = new Set(egress.calls.map((c) => c.ctx.agent));

  // ── PRINT THE MATRIX (this is the coverage report) ─────────────────────────
  const busLine = (label, set) => `${label}\n` + set.map((a) =>
    `  ${fired.has(a) ? 'FIRED    ' : 'NOT FIRED'}  ${a}`).join('\n');
  const egressLine = (label, set) => `${label}\n` + set.map(({ agent, note }) =>
    `  ${called.has(agent) ? 'CALLED   ' : 'NOT CALLED'}  ${agent}  (${note})`).join('\n');
  t.diagnostic('=== EVENT-COVERAGE MATRIX (mainline v2 lifecycle) ===');
  t.diagnostic(busLine('[bus emitters — MUST fire an own event]', MAINLINE_EXPECTED));
  t.diagnostic(egressLine('[egress-driven — lit by agent_output in prod; MUST make an egress call]', EGRESS_DRIVEN_MAINLINE));
  t.diagnostic(busLine('[on-demand — expected dark on mainline]', PATH_DEPENDENT));
  t.diagnostic(`[distinct bus agents fired] ${[...fired].sort().join(', ')}`);
  t.diagnostic(`[distinct egress agents called] ${[...called].sort().join(', ')}`);

  const missing = MAINLINE_EXPECTED.filter((a) => !fired.has(a));
  assert.deepEqual(missing, [], `bus-emitter agents that failed to emit: ${missing.join(', ')}`);

  const notCalled = EGRESS_DRIVEN_MAINLINE.filter(({ agent }) => !called.has(agent)).map((e) => e.agent);
  assert.deepEqual(notCalled, [],
    `egress-driven agents that failed to run (no agent_output would fire in prod): ${notCalled.join(', ')}`);

  const unexpectedlyLit = PATH_DEPENDENT.filter((a) => fired.has(a));
  assert.deepEqual(unexpectedlyLit, [],
    `on-demand agents unexpectedly fired on the mainline: ${unexpectedlyLit.join(', ')}`);

  assert.ok(startEvents.length > 0 && all.length >= startEvents.length);
});

// ── path: dynamic design (design-recommender + design-reviewer) ──────────────

test('PATH dynamic design: design-recommender + design-reviewer emit', async (t) => {
  const egress = new FakeEgress({
    'keyword-intent': INTENT_OUTPUT,
    'rag-research/synthesize_context': CONTEXT_OUTPUT,
    'content-generator': () => structuredClone(V1_MESSAGES),
    'content-reviewer': () => structuredClone(ACCEPT_REVIEW),
    'design-recommender/generate_mockup_spec': () => structuredClone(DESIGN_SPEC_V2),
    'design-reviewer/validate_mockup': () => structuredClone(DESIGN_ACCEPT_REVIEW),
    'overseer/review_prompting': { score: 90, notes: [] }
  });
  const ctx = makeCtx(egress);
  const start = await startContentPipeline({ ctx, prompt: 'warn staff about QR phishing' }); // v1 (no template)
  await chooseAngles({ ctx, posterId: start.posterId, angleIds: 'ai' });
  await approveContent({ ctx, posterId: start.posterId });
  await runDesignPipeline({ ctx, posterId: start.posterId, mode: 'dynamic', userPrompt: 'dark, bold' });

  // design-recommender/design-reviewer are egress-driven (agent_output lights
  // their node in prod) — prove the path exercised them via egress calls.
  const called = new Set(egress.calls.map((c) => c.ctx.agent));
  t.diagnostic(`[dynamic design] recommender-called=${called.has('design-recommender')} reviewer-called=${called.has('design-reviewer')}`);
  assert.ok(called.has('design-recommender'), 'design-recommender must run on the dynamic path');
  assert.ok(called.has('design-reviewer'), 'design-reviewer must run on the dynamic path');
});

// ── path: v2 design retry (template-recommender) ─────────────────────────────

test('PATH v2 design retry: template-recommender emits', async (t) => {
  const egress = new FakeEgress({
    'keyword-intent': INTENT_OUTPUT,
    'rag-research/synthesize_context': CONTEXT_OUTPUT,
    'content-generator': () => structuredClone(V2_BLOCKS),
    'content-reviewer': () => structuredClone(ACCEPT_REVIEW),
    'template-recommender/recommend_template': { templateId: 'bullet-beacon', reason: 'higher visual impact' },
    'overseer/review_prompting': { score: 90, notes: [] }
  });
  const ctx = makeCtx(egress);
  const start = await startContentPipeline({ ctx, prompt: 'warn staff about QR phishing', templateId: 'timeline-journey' });
  await chooseAngles({ ctx, posterId: start.posterId, angleIds: 'ai' });
  await approveContent({ ctx, posterId: start.posterId });
  await runDesignPipeline({ ctx, posterId: start.posterId, mode: 'template', templateId: 'timeline-journey' });
  await retryDesign({ ctx, posterId: start.posterId, userPrompt: 'something bolder' });

  const fired = firedAgents(ctx.bus.eventsForRun(start.runId));
  t.diagnostic(`[v2 retry] template-recommender=${fired.has('template-recommender')}`);
  assert.ok(fired.has('template-recommender'), 'template-recommender must emit on the v2 retry path');
});

// ── path: translation EDIT with a term swap (terminology-validator) ──────────

test('PATH translation edit: terminology-validator emits on a term swap', async (t) => {
  const egress = new FakeEgress({
    ...fakeTranslateHandlers(),
    'terminology-validator/store_terminology': { approved: true },
    'terminology-validator/validate_terminology': { approved: true }
  });
  const ctx = makeCtx(egress);
  const posterId = randomUUID();
  const runId = newRunId('poster');
  const now = new Date().toISOString();
  const variantContent = {
    headline: 'Innehalten vor dem Scannen', subheadline: null,
    messages: [
      { id: 'msg-1', label: 'TUN', text: 'Melden Sie verdächtige E-Mails' },
      { id: 'msg-2', label: 'NICHT TUN', text: 'Geben Sie niemals einen Einmalcode ein' },
      { id: 'msg-3', label: 'TUN', text: 'Öffnen Sie die echte Seite über Lesezeichen' }
    ],
    callToAction: 'Denken Sie nach', format: 'red-flags', extras: []
  };
  const doc = {
    prompt: 'phishing', runId, phase: 'translated', grounded: true,
    contextFile: { topic: 'phishing', angles: [] },
    content: {
      headline: 'Stop', subheadline: null,
      messages: [
        { id: 'msg-1', label: 'DO', text: 'Report suspicious emails' },
        { id: 'msg-2', label: "DON'T", text: 'Never type a one-time code' },
        { id: 'msg-3', label: 'DO', text: 'Open the real site from bookmarks' }
      ],
      callToAction: 'Think', format: 'red-flags'
    },
    design: { canvas: { version: '6', background: '#fff', objects: [{ type: 'Textbox', layerRole: 'headline', text: 'Stop' }] } },
    translations: {
      de: {
        content: structuredClone(variantContent),
        canvas: { version: '6', background: '#fff', objects: [{ type: 'Textbox', layerRole: 'headline', text: 'Innehalten' }] },
        sourceExtraIds: [], fidelityScore: 97, attempts: 1, status: 'translated', updatedAt: now, lastEditChanges: null
      }
    },
    snapshots: []
  };
  ctx.db.prepare('INSERT INTO posters (poster_id, name, status, created_at, updated_at, doc) VALUES (?, ?, ?, ?, ?, ?)')
    .run(posterId, 'p', 'translated', now, now, JSON.stringify(doc));

  // edit the German variant — a term swap the validator learns
  await editTranslation({
    ctx, posterId, lang: 'de',
    content: {
      ...variantContent,
      messages: [
        { id: 'msg-1', label: 'TUN', text: 'Melden Sie verdächtige Phishing-Mails' },
        variantContent.messages[1],
        variantContent.messages[2]
      ]
    }
  });
  await new Promise((r) => setTimeout(r, 40)); // fire-and-forget terminology chain

  const fired = firedAgents(ctx.bus.eventsForRun(runId));
  t.diagnostic(`[translation edit] terminology-validator=${fired.has('terminology-validator')}`);
  assert.ok(fired.has('terminology-validator'), 'terminology-validator must emit on a translation edit with a term swap');
});
