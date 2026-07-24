// Content pipeline tests over real db/bus/harness with a scripted egress:
// gate passes first try; rework accumulates FULL history into the next
// generate prompt; exhaustion throws GATE_EXHAUSTED; learning hints reach the
// generator; ungrounded degradation (empty index); generator length limits
// are enforced structurally; safe views never leak synthesis/sources.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '#shared';
import { GateEngine, Harness } from '#orchestration';
import { openDb } from '../../backend/db.js';
import { startContentPipeline, chooseAngles, approveContent, submitUserFeedback, regenerateContent } from '../../pipelines/content_pipeline.js';
import { generateContent } from '../../agents/content_generator.js';
import { pickExamples, TOPIC_EXAMPLE_BANK } from '../../agents/prompts/topic_examples.js';
import { buildContentGeneratorSystem, buildContentGeneratorSystemV2 } from '../../agents/prompts/content_generator_prompts.js';
import { buildContentReviewerSystem, buildContentReviewerSystemV2 } from '../../agents/prompts/content_reviewer_prompts.js';
import { buildAntiGenericBlock } from '../../agents/prompts/voice_blocks.js';
import {
  FakeEgress, seedArticles, INTENT_OUTPUT, CONTEXT_OUTPUT, UNGROUNDED_CONTEXT_OUTPUT,
  POSTER_CONTENT, POSTER_CONTENT_V2, ACCEPT_REVIEW, REWORK_REVIEW
} from './helpers/fake_egress.js';

function makeCtx(egress, { maxReworkLoops = 6, seed = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'postter-pipeline-'));
  const db = openDb(join(dir, 'test.sqlite'));
  if (seed) seedArticles(db);
  const bus = new EventBus({ logDir: join(dir, 'runs'), db });
  const gateEngine = new GateEngine({ bus });
  const harness = new Harness({ bus, gateEngine, maxReworkLoops });
  return { db, bus, vault: null, egress, gateEngine, harness };
}

const BASE_HANDLERS = {
  'keyword-intent': INTENT_OUTPUT,
  'rag-research/synthesize_context': CONTEXT_OUTPUT,
  'rag-research/synthesize_general_knowledge': UNGROUNDED_CONTEXT_OUTPUT
};

test('grounded start: intent → retrieval → context file; safe view has angles but no synthesis/sources', async () => {
  const egress = new FakeEgress({ ...BASE_HANDLERS });
  const ctx = makeCtx(egress);
  const state = await startContentPipeline({ ctx, prompt: 'stop phishing emails' });

  assert.equal(state.phase, 'angles');
  assert.equal(state.topic, 'phishing');
  assert.equal(state.grounded, true);
  assert.equal(state.angles.length, 3);
  assert.deepEqual(Object.keys(state.angles[0]).sort(), ['id', 'rationale', 'title']);
  // internal-only fields must never appear in the safe view
  const serialized = JSON.stringify(state);
  assert.ok(!serialized.includes(CONTEXT_OUTPUT.synthesis.slice(0, 40)), 'synthesis leaked');
  assert.ok(!serialized.includes('Proofpoint'), 'source attribution leaked');
  assert.ok(!('contextFile' in state) && !('sources' in state) && !('synthesis' in state));

  // event trail: stage pairs + handoffs were emitted
  const events = ctx.bus.eventsForRun(state.runId);
  const types = events.map((e) => `${e.type}:${e.stage}`);
  assert.ok(types.includes('stage_start:keyword-intent') && types.includes('stage_end:keyword-intent'));
  assert.ok(types.includes('stage_start:research') && types.includes('stage_end:research'));
  assert.equal(events.filter((e) => e.type === 'handoff').length, 3); // prompt→intent, intent→research, research→content
});

test('content loop passes the 95 gate on the first try', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [POSTER_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW]
  });
  const ctx = makeCtx(egress);
  const start = await startContentPipeline({ ctx, prompt: 'stop phishing emails' });
  const state = await chooseAngles({ ctx, posterId: start.posterId, angleIds: ['angle-1'] });

  assert.equal(state.phase, 'content-approval');
  assert.equal(state.content.headline, POSTER_CONTENT.headline);
  assert.equal(state.content.messages.length, 4);
  assert.ok(state.content.messages.every((m) => typeof m.id === 'string' && m.id));
  assert.deepEqual(state.reviewHistory, [{ attempt: 1, score: 97, status: 'accepted' }]);
  // selected angle (not the others) must drive the generator prompt
  const genPrompt = egress.callsFor('content-generator')[0].opts.user;
  assert.match(genPrompt, /A QR code is a link you cannot read/);
  assert.match(genPrompt, /ANGLES THE USER SELECTED/);
});

test('rework loop: 2nd generate prompt carries the 1st reviewer feedback (history never lost)', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [POSTER_CONTENT, POSTER_CONTENT_V2],
    'content-reviewer': [REWORK_REVIEW, ACCEPT_REVIEW]
  });
  const ctx = makeCtx(egress);
  const start = await startContentPipeline({ ctx, prompt: 'stop phishing emails' });
  const state = await chooseAngles({ ctx, posterId: start.posterId, angleIds: 'ai' });

  const genCalls = egress.callsFor('content-generator');
  assert.equal(genCalls.length, 2);
  assert.ok(!genCalls[0].opts.user.includes('PRIOR REVIEW HISTORY'), 'first attempt must have no history');
  assert.match(genCalls[1].opts.user, /PRIOR REVIEW HISTORY/);
  assert.ok(genCalls[1].opts.user.includes(REWORK_REVIEW.feedback), '2nd prompt must contain 1st feedback verbatim');
  assert.ok(genCalls[1].opts.user.includes(REWORK_REVIEW.expected), '2nd prompt must contain what good looks like');

  assert.equal(state.reviewHistory.length, 2);
  assert.deepEqual(state.reviewHistory.map((h) => h.status), ['rework', 'accepted']);
  assert.equal(state.content.headline, POSTER_CONTENT_V2.headline);
});

test('reviewer never accepting exhausts the loop with GATE_EXHAUSTED', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': () => POSTER_CONTENT,
    'content-reviewer': () => REWORK_REVIEW
  });
  const ctx = makeCtx(egress, { maxReworkLoops: 2 });
  const start = await startContentPipeline({ ctx, prompt: 'stop phishing emails' });
  await assert.rejects(
    chooseAngles({ ctx, posterId: start.posterId, angleIds: ['angle-1'] }),
    (err) => err.code === 'GATE_EXHAUSTED' && err.history.length === 2
  );
  assert.equal(egress.callsFor('content-generator').length, 2);
});

test('near-miss loop: best draft is accepted best-effort (no dead-end) and recorded for self-learning', async () => {
  // reviewer never fully accepts but the best draft scores 90 — above the
  // best-effort floor (88) — so the poster completes instead of throwing.
  const NEAR_MISS = { ...REWORK_REVIEW, score: 90 };
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': () => POSTER_CONTENT,
    'content-reviewer': () => NEAR_MISS
  });
  const ctx = makeCtx(egress, { maxReworkLoops: 2 });
  const start = await startContentPipeline({ ctx, prompt: 'stop phishing emails' });
  const state = await chooseAngles({ ctx, posterId: start.posterId, angleIds: ['angle-1'] });

  // completes to content-approval — the frequent GATE_EXHAUSTED dead-end is gone
  assert.equal(state.phase, 'content-approval');
  assert.equal(state.reviewHistory.at(-1).status, 'best-effort');
  assert.equal(state.reviewHistory.at(-1).score, 90);

  // self-learning: the near-miss is stored as a rejection so the next same-topic
  // run gets a "avoid repeating that approach" hint (visible learning)
  const rej = ctx.db.prepare("SELECT detail FROM learning WHERE topic = 'phishing' AND kind = 'rejection'").all();
  assert.equal(rej.length, 1);
  assert.equal(JSON.parse(rej[0].detail).headline, POSTER_CONTENT.headline);
});

test('angles regenerate: edited prompt re-runs research in place (same poster, fresh angles)', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS
  });
  const ctx = makeCtx(egress);
  const start = await startContentPipeline({ ctx, prompt: 'stop phishing emails' });
  assert.equal(start.phase, 'angles');

  const { regenerateAngles } = await import('../../pipelines/content_pipeline.js');
  const state = await regenerateAngles({ ctx, posterId: start.posterId, prompt: 'QR code phishing at the front desk' });
  assert.equal(state.posterId, start.posterId, 'same poster');
  assert.equal(state.phase, 'angles', 'phase stays angles');
  assert.equal(state.angles.length, 3, 'fresh angles returned');
  // the doc's prompt was replaced and intent re-ran on the edited prompt
  const intentCalls = egress.callsFor('keyword-intent');
  assert.equal(intentCalls.length, 2, 'intent ran once per research pass');
  assert.match(intentCalls[1].opts.user, /QR code phishing at the front desk/);

  // wrong phase → 409
  await chooseAngles({ ctx, posterId: start.posterId, angleIds: 'ai' }).catch(() => {});
  // (chooseAngles may fail without content handlers — regardless, phase left 'angles' only on failure;
  // force-check the guard with a designed-phase style mutation instead)
  const row = ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(start.posterId);
  const doc = JSON.parse(row.doc);
  doc.phase = 'content-approval';
  ctx.db.prepare('UPDATE posters SET doc = ? WHERE poster_id = ?').run(JSON.stringify(doc), start.posterId);
  await assert.rejects(
    regenerateAngles({ ctx, posterId: start.posterId, prompt: 'x' }),
    (err) => err.code === 'WRONG_PHASE' && err.status === 409
  );
});

test('learning hints from the learning table reach the generate prompt', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [POSTER_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW]
  });
  const ctx = makeCtx(egress);
  const ins = ctx.db.prepare('INSERT INTO learning (ts, kind, topic, angle, detail, weight) VALUES (?, ?, ?, ?, ?, ?)');
  ins.run(new Date().toISOString(), 'approval', 'phishing', 'Your one-time code is a password too',
    JSON.stringify({ headline: 'Guard Your One-Time Codes' }), 1.0);
  ins.run(new Date().toISOString(), 'rejection', 'phishing', null,
    JSON.stringify({ headline: 'Hackers Are Everywhere, Beware' }), 1.0);
  ins.run(new Date().toISOString(), 'edit_learning', 'phishing', null,
    JSON.stringify({ changeType: 'stylistic-preference', summary: 's', guidance: 'Favor neutral declarative headlines over direct warnings.' }), 1.0);

  const start = await startContentPipeline({ ctx, prompt: 'stop phishing emails' });
  await chooseAngles({ ctx, posterId: start.posterId, angleIds: ['angle-2'] });

  const genPrompt = egress.callsFor('content-generator')[0].opts.user;
  assert.match(genPrompt, /LEARNED PREFERENCES/);
  assert.match(genPrompt, /APPROVED the angle "Your one-time code is a password too"/);
  assert.match(genPrompt, /REJECTED a draft headlined "Hackers Are Everywhere, Beware"/);
  assert.match(genPrompt, /Favor neutral declarative headlines/);
  // every hint is data-fenced — learning-table text is never bare instructions
  assert.match(genPrompt, /- <user_text>.*Favor neutral declarative headlines.*<\/user_text>/);
  assert.match(genPrompt, /- <user_text>.*APPROVED the angle.*<\/user_text>/);
});

test('empty index degrades to an ungrounded context file (sources: [], grounded:false)', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [POSTER_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW]
  });
  const ctx = makeCtx(egress, { seed: false }); // no articles at all
  const state = await startContentPipeline({ ctx, prompt: 'stop phishing emails' });

  assert.equal(state.grounded, false);
  assert.equal(state.angles.length, 3);
  // the grounded synthesizer must NOT have been called; the fallback must
  const skillsUsed = egress.callsFor('rag-research').map((c) => c.ctx.skill);
  assert.deepEqual(skillsUsed, ['synthesize_general_knowledge']);
  // poster doc keeps the full ungrounded context file with empty sources
  const row = ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(state.posterId);
  const doc = JSON.parse(row.doc);
  assert.deepEqual(doc.contextFile.sources, []);
  assert.equal(doc.grounded, false);
  // pipeline still completes on top of it
  const after = await chooseAngles({ ctx, posterId: state.posterId, angleIds: 'ai' });
  assert.equal(after.phase, 'content-approval');
});

test('approve records approval learning per selected angle and transitions status', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [POSTER_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW]
  });
  const ctx = makeCtx(egress);
  const start = await startContentPipeline({ ctx, prompt: 'stop phishing emails' });
  await chooseAngles({ ctx, posterId: start.posterId, angleIds: ['angle-1', 'angle-3'] });
  const state = await approveContent({ ctx, posterId: start.posterId });

  assert.equal(state.status, 'content-approved');
  assert.equal(state.phase, 'approved');
  const rows = ctx.db.prepare("SELECT * FROM learning WHERE kind = 'approval' AND topic = 'phishing' ORDER BY id").all();
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.angle), ['A QR code is a link you cannot read', 'Unexpected sign-in prompt? Stop and report']);
  // user_action + memory_write events emitted
  const events = ctx.bus.eventsForRun(state.runId);
  assert.ok(events.some((e) => e.type === 'user_action' && e.skill === 'approve_content'));
  assert.equal(events.filter((e) => e.type === 'memory_write').length, 2);
});

test('user feedback re-enters the loop as prior feedback; regenerate records a rejection', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [POSTER_CONTENT, POSTER_CONTENT_V2, POSTER_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW, ACCEPT_REVIEW, ACCEPT_REVIEW]
  });
  const ctx = makeCtx(egress);
  const start = await startContentPipeline({ ctx, prompt: 'stop phishing emails' });
  await chooseAngles({ ctx, posterId: start.posterId, angleIds: ['angle-1'] });

  const afterFeedback = await submitUserFeedback({ ctx, posterId: start.posterId, feedback: 'Too many red flags, add one clear DO step for reporting.' });
  assert.equal(afterFeedback.content.headline, POSTER_CONTENT_V2.headline);
  const fbPrompt = egress.callsFor('content-generator')[1].opts.user;
  assert.match(fbPrompt, /USER FEEDBACK on the previous draft/);
  assert.match(fbPrompt, /Too many red flags, add one clear DO step/);
  assert.equal(ctx.db.prepare("SELECT COUNT(*) c FROM learning WHERE kind = 'feedback'").get().c, 1);

  const afterRegen = await regenerateContent({ ctx, posterId: start.posterId, prompt: 'try a calmer headline' });
  assert.equal(afterRegen.content.headline, POSTER_CONTENT.headline);
  const regenPrompt = egress.callsFor('content-generator')[2].opts.user;
  assert.match(regenPrompt, /rejected the previous accepted draft/);
  assert.match(regenPrompt, /try a calmer headline/);
  assert.equal(ctx.db.prepare("SELECT COUNT(*) c FROM learning WHERE kind = 'rejection'").get().c, 1);
});

// ── topic fidelity (topic-hijack fix): the user's intent topic survives a
// phishing-heavy article index end-to-end ─────────────────────────────────────

const GDPR_INTENT = {
  topic: 'gdpr',
  core: ['gdpr'],
  // 'employees' deliberately matches the phishing-heavy seed articles so the
  // GROUNDED path runs — the exact hijack scenario: loosely-related phishing
  // articles retrieved for a non-phishing topic.
  expanded: ['data protection', 'personal data', 'employees'],
  contentShape: null
};

const GDPR_CONTEXT_OUTPUT = {
  topic: 'phishing', // the model volunteering the old hijack — must be ignored
  keywords: { core: ['gdpr'], expanded: ['data protection', 'personal data'], contentShape: null },
  synthesis: 'GDPR sets employee-facing duties for handling personal data: collect only what the task needs, share it only with colleagues authorized to see it, and report any suspected exposure to the privacy team immediately. Most retrieved articles cover phishing and are tangential; the durable GDPR behaviours above hold regardless.',
  angles: [
    { id: 'angle-1', title: 'Personal data is need-to-know', rationale: 'Access discipline is the everyday GDPR behaviour employees control directly.' },
    { id: 'angle-2', title: 'Check the recipient before you send', rationale: 'A misdirected email with personal data is the most common reportable GDPR incident.' },
    { id: 'angle-3', title: 'Suspect exposure? Tell the privacy team now', rationale: 'Notification deadlines start when anyone in the company knows about a breach.' }
  ]
};

test('topic fidelity: gdpr prompt over the phishing-heavy index → topic, poster name, learning rows all keyed gdpr; prompts anchored', async () => {
  const egress = new FakeEgress({
    'keyword-intent': GDPR_INTENT,
    'rag-research/synthesize_context': GDPR_CONTEXT_OUTPUT,
    'content-generator': [POSTER_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW]
  });
  const ctx = makeCtx(egress); // seeds the phishing-heavy article fixtures
  const state = await startContentPipeline({ ctx, prompt: 'GDPR awareness for employees who handle customer data' });

  assert.equal(state.grounded, true, 'retrieval must have matched the (tangential) phishing articles');
  assert.equal(state.topic, 'gdpr', 'safe-view topic is the intent topic, not the model\'s');
  assert.equal(state.name, 'gdpr poster', 'poster name derives from the intent topic');

  // synthesis prompt carries the anchoring lines
  const synthPrompt = egress.callsFor('rag-research')[0].opts.user;
  assert.match(synthPrompt, /Every angle MUST teach "gdpr"/);
  assert.match(synthPrompt, /may be tangential or unrelated/);

  // poster doc: the full context file is keyed by the intent topic too
  const row = ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(state.posterId);
  assert.equal(JSON.parse(row.doc).contextFile.topic, 'gdpr');

  await chooseAngles({ ctx, posterId: state.posterId, angleIds: ['angle-1'] });
  // generator + reviewer prompts are anchored to the user's topic
  const genPrompt = egress.callsFor('content-generator')[0].opts.user;
  assert.match(genPrompt, /The poster's topic is "gdpr" — never substitute a different security subject/);
  const revPrompt = egress.callsFor('content-reviewer')[0].opts.user;
  assert.match(revPrompt, /The poster's topic is "gdpr" — never substitute a different security subject/);

  // approval learning rows are keyed by the user's topic — the hijack no
  // longer self-reinforces through the learning table
  await approveContent({ ctx, posterId: state.posterId });
  const learning = ctx.db.prepare('SELECT topic FROM learning').all();
  assert.ok(learning.length >= 1);
  assert.ok(learning.every((l) => l.topic === 'gdpr'), 'every learning row keyed gdpr');
});

test('topic fidelity fallback: zero articles + topic "dpdp act" → contextFile.topic stays "dpdp act"; fallback prompt anchored', async () => {
  const egress = new FakeEgress({
    'keyword-intent': { topic: 'dpdp act', core: ['dpdp act'], expanded: ['data protection', 'privacy'], contentShape: null },
    'rag-research/synthesize_general_knowledge': {
      synthesis: 'The DPDP Act gives employees clear duties when handling the personal data of Indian users: collect only what the task needs, keep it only as long as needed, and report suspected exposure to the privacy team immediately.',
      angles: [
        { id: 'angle-1', title: 'Collect only what the task needs', rationale: 'Data minimisation is the core everyday DPDP behaviour.' },
        { id: 'angle-2', title: 'Personal data has an expiry date', rationale: 'Retention limits are employee-visible and actionable.' },
        { id: 'angle-3', title: 'Report exposure to the privacy team', rationale: 'Breach reporting duties start with the first employee who notices.' }
      ]
    }
  });
  const ctx = makeCtx(egress, { seed: false }); // empty index → ungrounded path
  const state = await startContentPipeline({ ctx, prompt: 'DPDP Act awareness for Indian employees' });

  assert.equal(state.grounded, false);
  assert.equal(state.topic, 'dpdp act');
  assert.equal(state.name, 'dpdp act poster');
  const doc = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(state.posterId).doc);
  assert.equal(doc.contextFile.topic, 'dpdp act');

  const fbPrompt = egress.callsFor('rag-research')[0].opts.user;
  assert.match(fbPrompt, /Every angle MUST teach "dpdp act"/);
  assert.match(fbPrompt, /never substitute a different security subject|a different security subject .* is a failure/);
  // I1: angle-relevance extension — non-classic/broad topics get faithful treatment
  const fbSystem = egress.callsFor('rag-research')[0].opts.system;
  assert.match(fbSystem, /Angles must serve the USER'S topic even when it is not a classic security topic/);
  assert.match(fbSystem, /faithful treatment of the literal topic/);
});

// ── I1: topicOverride — the user's correction replaces the interpreted topic ─

test('topicOverride: intent still runs for keywords but the override owns topic, poster name, contextFile and learning keys', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS, // intent handler still returns topic 'phishing' — must be overridden
    'content-generator': [POSTER_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW]
  });
  const ctx = makeCtx(egress);
  const state = await startContentPipeline({ ctx, prompt: 'workplace posters', topicOverride: '  Clean Desk Policy ' });

  assert.equal(egress.callsFor('keyword-intent').length, 1, 'intent must still run for keywords/shape');
  assert.equal(state.topic, 'clean desk policy', 'override is trimmed + lowercased and replaces intent.topic');
  assert.equal(state.name, 'clean desk policy poster');

  const doc = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(state.posterId).doc);
  assert.equal(doc.contextFile.topic, 'clean desk policy', 'override reaches the context file');
  assert.equal(doc.intent.topic, 'clean desk policy');

  // synthesis prompt is anchored to the OVERRIDE topic, not the intent's
  const synthPrompt = egress.callsFor('rag-research')[0].opts.user;
  assert.match(synthPrompt, /Every angle MUST teach "clean desk policy"/);

  // learning rows are keyed by the override topic
  await chooseAngles({ ctx, posterId: state.posterId, angleIds: ['angle-1'] });
  await approveContent({ ctx, posterId: state.posterId });
  const learning = ctx.db.prepare('SELECT topic FROM learning').all();
  assert.ok(learning.length >= 1);
  assert.ok(learning.every((l) => l.topic === 'clean desk policy'), 'every learning row keyed by the override');
});

test('topicOverride validation: whitespace-only or >120 chars throws INVALID_TOPIC_OVERRIDE (400) before any model call', async () => {
  const egress = new FakeEgress({});
  const ctx = makeCtx(egress, { seed: false });
  await assert.rejects(
    startContentPipeline({ ctx, prompt: 'workplace posters', topicOverride: '   ' }),
    (err) => err.code === 'INVALID_TOPIC_OVERRIDE' && err.status === 400
  );
  await assert.rejects(
    startContentPipeline({ ctx, prompt: 'workplace posters', topicOverride: 'x'.repeat(121) }),
    (err) => err.code === 'INVALID_TOPIC_OVERRIDE' && err.status === 400
  );
  assert.equal(egress.calls.length, 0, 'validation failures must not reach the model');
  // exactly 120 chars is accepted by validation (fails later only because no handlers are scripted)
  await assert.rejects(
    startContentPipeline({ ctx, prompt: 'workplace posters', topicOverride: 'x'.repeat(120) }),
    (err) => err.code !== 'INVALID_TOPIC_OVERRIDE'
  );
});

// ── I1: reviewer relevance criterion — the reviewer sees the ORIGINAL user
// prompt (fenced) and drift is an automatic rework ───────────────────────────

test('v1 reviewer prompt carries the fenced user prompt and the automatic-rework relevance line', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [POSTER_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW]
  });
  const ctx = makeCtx(egress);
  const start = await startContentPipeline({ ctx, prompt: 'stop phishing emails' });
  await chooseAngles({ ctx, posterId: start.posterId, angleIds: ['angle-1'] });

  const reviewCall = egress.callsFor('content-reviewer')[0];
  // the user's ORIGINAL prompt rides fenced into the reviewer
  assert.match(reviewCall.opts.user, /THE USER'S ORIGINAL REQUEST/);
  assert.match(reviewCall.opts.user, /<user_text>stop phishing emails<\/user_text>/);
  assert.match(reviewCall.opts.user, /teaches a different topic than this request is an AUTOMATIC rework, score at most 85/);
  // system prompt carries the relevance criterion + rotating neutral examples
  assert.match(reviewCall.opts.system, /0\. RELEVANCE TO THE USER'S REQUEST/);
  assert.match(reviewCall.opts.system, /AUTOMATIC rework, score at most 85/);
  assert.match(reviewCall.opts.system, /TOPIC BREADTH/);
  // severity-calibration block stays intact
  assert.match(reviewCall.opts.system, /SEVERITY CALIBRATION \(apply BEFORE scoring\)/);
  assert.match(reviewCall.opts.system, /AT MOST 1-2 points total, never 5\+/);
});

// ── I1: rotating neutral example bank ────────────────────────────────────────

test('pickExamples: deterministic per seed, 3 distinct topics, different seeds rotate to different sets', () => {
  assert.equal(TOPIC_EXAMPLE_BANK.length, 8);
  for (const entry of TOPIC_EXAMPLE_BANK) {
    assert.ok(entry.topic && entry.examples.length >= 1 && entry.examples.length <= 2);
    assert.ok(!/phishing/i.test(JSON.stringify(entry)), 'the bank must not contain phishing examples');
  }
  const a = pickExamples('run-abc').map((e) => e.topic);
  const b = pickExamples('run-abc').map((e) => e.topic);
  assert.deepEqual(a, b, 'same seed → same set');
  assert.equal(new Set(a).size, 3, 'three DISTINCT topics');
  const c = pickExamples('other-seed').map((e) => e.topic);
  assert.notDeepEqual(a, c, 'different seeds → different sets');
  assert.equal(new Set(c).size, 3);
  // every pick, whatever the seed, stays distinct
  for (const seed of ['default', 'poster_x', 'poster_y', 'zzz']) {
    const picked = pickExamples(seed).map((e) => e.topic);
    assert.equal(new Set(picked).size, 3, `seed ${seed} must yield distinct topics`);
  }
});

test('regression (re-bias guard): no prompt builder output mentions phishing more than once for a non-phishing seed', () => {
  const seed = 'run-clean-desk-1';
  const outputs = {
    generatorSystem: buildContentGeneratorSystem(seed),
    generatorSystemV2: buildContentGeneratorSystemV2(seed),
    reviewerSystem: buildContentReviewerSystem(seed),
    reviewerSystemV2: buildContentReviewerSystemV2(seed),
    antiGeneric: buildAntiGenericBlock(seed)
  };
  for (const [name, text] of Object.entries(outputs)) {
    const hits = (text.toLowerCase().match(/phishing/g) || []).length;
    assert.ok(hits <= 1, `${name} mentions phishing ${hits} times — prompts must not be phishing-flavored`);
  }
  // and the examples rotate INTO the system prompts (seeded, not static)
  const picked = pickExamples(seed, 3);
  for (const e of picked) {
    assert.ok(outputs.generatorSystem.includes(e.topic), `generator system must carry picked topic "${e.topic}"`);
    assert.ok(outputs.reviewerSystem.includes(e.topic), `reviewer system must carry picked topic "${e.topic}"`);
  }
});

test('generator enforces room-readability limits structurally with one repair retry', async () => {
  const tooLong = {
    ...POSTER_CONTENT,
    headline: 'This Headline Is Far Too Long To Read Across Any Room' // 10 words > 8
  };
  const egress = new FakeEgress({ 'content-generator': [tooLong, POSTER_CONTENT] });
  const content = await generateContent({
    egress, runId: 'run-g1',
    contextFile: { topic: 'phishing', synthesis: CONTEXT_OUTPUT.synthesis, keywords: { contentShape: 'red-flags' }, angles: CONTEXT_OUTPUT.angles },
    selectedAngles: null, userPrompt: 'stop phishing emails'
  });
  assert.equal(egress.calls.length, 2);
  assert.match(egress.calls[1].opts.user, /violated hard limits/);
  assert.match(egress.calls[1].opts.user, /11 words/);
  assert.equal(content.headline, POSTER_CONTENT.headline);

  // two violations in a row is a hard CONTENT_INVALID
  const badTwice = new FakeEgress({ 'content-generator': [tooLong, { ...tooLong, messages: tooLong.messages.slice(0, 2) }] });
  await assert.rejects(
    generateContent({
      egress: badTwice, runId: 'run-g2',
      contextFile: { topic: 'phishing', synthesis: CONTEXT_OUTPUT.synthesis, keywords: { contentShape: null }, angles: CONTEXT_OUTPUT.angles }
    }),
    (err) => err.code === 'CONTENT_INVALID'
  );
});
