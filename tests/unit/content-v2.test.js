// Phase O4 — template-aware content generation. Covers:
//   (a) the schema-driven validator/normalizer (agents/content_schema.js)
//   (b) generateContentV2 with a scripted egress across 3 distinct styles
//       (qa-chat / comic-strip / stats-impact) + repair-retry discipline
//   (c) the content-pipeline v2 fork: templateId tags the doc, the loop runs
//       generateContentV2 + reviewContentV2, inline edits shape-validate
//       against the template schema, and the v1 path stays byte-for-byte
//   (d) HTTP: GET /api/pipeline/templates gallery + POST /start templateId

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '#shared';
import { GateEngine, Harness } from '#orchestration';
import { openDb } from '../../backend/db.js';
import { createServer } from '../../backend/server.js';
import { createAppContext } from '../../backend/app-context.js';
import {
  startContentPipeline, chooseAngles, approveContent, inlineEdit
} from '../../pipelines/content_pipeline.js';
import { generateContentV2 } from '../../agents/content_generator.js';
import { validateContentAgainstSchema, normalizeContentV2 } from '../../agents/content_schema.js';
import { getTemplateV2, listTemplatesV2 } from '../../templates/v2/index.js';
import {
  FakeEgress, seedArticles, INTENT_OUTPUT, CONTEXT_OUTPUT, UNGROUNDED_CONTEXT_OUTPUT,
  POSTER_CONTENT, ACCEPT_REVIEW, EDIT_CLASSIFICATION
} from './helpers/fake_egress.js';

// ── v2 fixtures (realistic phishing awareness, one per style) ────────────────

const QA_CHAT_CONTENT = {
  headline: 'Real Questions About Phishing, Answered',
  subheadline: null,
  blocks: [
    { question: 'I scanned a QR code from a work email. Now what?', answer: 'Do not sign in. Close the page and tell the security team.' },
    { question: 'A sign-in prompt appeared but I was not logging in. Approve it?', answer: 'No. Deny the prompt and report it right away.' },
    { question: 'The email looks like it came from IT. Is it safe?', answer: 'Check by opening the IT portal yourself, not through the message.' }
  ],
  callToAction: 'Unsure? Ask the security team at {{SOC_EMAIL}}'
};

const COMIC_STRIP_CONTENT = {
  headline: 'The Parking Fine That Was Not',
  subheadline: null,
  blocks: [
    { heading: 'The email', text: 'A parking fine arrives with a QR code to pay.' },
    { heading: 'The scan', text: 'Maya points her phone at the code.' },
    { heading: 'The save', text: 'She pauses, checks the sender, and reports it instead.' }
  ],
  callToAction: 'Report odd messages to {{SOC_EMAIL}}'
};

const STATS_IMPACT_CONTENT = {
  headline: 'Phishing By The Numbers',
  subheadline: null,
  blocks: [
    { figure: '9 in 10', caption: 'breaches start with a message to a person' },
    { figure: '60 sec', caption: 'is all it takes to report a suspicious email' },
    { figure: 'Most', caption: 'fake sign-in pages are reached from message links' }
  ],
  callToAction: 'Report suspicious messages to {{SOC_EMAIL}}'
};

const V2_CONTEXT_FILE = {
  topic: 'phishing',
  synthesis: CONTEXT_OUTPUT.synthesis,
  keywords: { contentShape: null },
  angles: CONTEXT_OUTPUT.angles
};

// synthetic schema WITH per-field caps (none of the shipped templates cap
// per-field words, and the validator must still enforce them when declared)
const CAPPED_SCHEMA = {
  headline: { required: true, maxWords: 8 },
  subheadline: { required: false, maxWords: 14 },
  blocks: { kind: 'qa-pairs', min: 3, max: 4, fields: ['question', 'answer'], maxWords: { question: 14, answer: 14 } },
  callToAction: { required: true, maxWords: 10 },
  imageSlots: 0
};

function cappedContent(overrides = {}) {
  return { ...QA_CHAT_CONTENT, ...overrides };
}

// ── (a) schema validator ─────────────────────────────────────────────────────

test('validator: block count bounds come from the schema', () => {
  const twoBlocks = cappedContent({ blocks: QA_CHAT_CONTENT.blocks.slice(0, 2) });
  let problems = validateContentAgainstSchema(twoBlocks, CAPPED_SCHEMA);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /3-4 qa-pairs items \(got 2\)/);

  const fiveBlocks = cappedContent({ blocks: [...QA_CHAT_CONTENT.blocks, ...QA_CHAT_CONTENT.blocks.slice(0, 2)] });
  problems = validateContentAgainstSchema(fiveBlocks, CAPPED_SCHEMA);
  assert.match(problems[0], /got 5/);

  assert.deepEqual(validateContentAgainstSchema(cappedContent(), CAPPED_SCHEMA), []);
});

test('validator: a missing block field names the block index and the kind', () => {
  const blocks = structuredClone(QA_CHAT_CONTENT.blocks);
  delete blocks[1].answer;
  const problems = validateContentAgainstSchema(cappedContent({ blocks }), CAPPED_SCHEMA);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /blocks\[1\]\.answer/);
  assert.match(problems[0], /qa-pairs/);
});

test('validator: per-field maxWords enforced; enforceLengths:false skips caps but keeps shape', () => {
  const blocks = structuredClone(QA_CHAT_CONTENT.blocks);
  blocks[0].question = 'Could you please explain to me exactly what I should be doing here right now today?'; // 16 > 14
  const longQuestion = cappedContent({ blocks });
  const problems = validateContentAgainstSchema(longQuestion, CAPPED_SCHEMA);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /blocks\[0\]\.question is 16 words/);
  assert.match(problems[0], /maximum 14/);

  // inline-edit mode: caps off — the user has the final word on wording
  assert.deepEqual(validateContentAgainstSchema(longQuestion, CAPPED_SCHEMA, { enforceLengths: false }), []);
  // ...but shape is still enforced
  const missingField = structuredClone(longQuestion);
  delete missingField.blocks[2].answer;
  assert.equal(validateContentAgainstSchema(missingField, CAPPED_SCHEMA, { enforceLengths: false }).length, 1);
});

test('validator: headline and callToAction are required when the schema says so', () => {
  const noHeadline = cappedContent({ headline: '  ' });
  assert.match(validateContentAgainstSchema(noHeadline, CAPPED_SCHEMA)[0], /missing "headline"/);

  const noCta = cappedContent({ callToAction: null });
  assert.match(validateContentAgainstSchema(noCta, CAPPED_SCHEMA)[0], /missing "callToAction"/);

  // headline word cap enforced too
  const longHeadline = cappedContent({ headline: 'This Headline Is Definitely Far Too Long To Read Across Any Room' });
  assert.match(validateContentAgainstSchema(longHeadline, CAPPED_SCHEMA)[0], /^headline is 12 words/);
  assert.deepEqual(validateContentAgainstSchema(longHeadline, CAPPED_SCHEMA, { enforceLengths: false }), []);
});

test('normalizeContentV2 assigns sequential blk-N ids and drops unknown keys', () => {
  const messy = cappedContent({
    blocks: QA_CHAT_CONTENT.blocks.map((b) => ({ ...b, id: 'model-made-this-up', note: 'stray key', question: `  ${b.question}  ` })),
    format: 'red-flags', // v1 leftover the schema does not declare
    extra: 'dropped'
  });
  const normalized = normalizeContentV2(messy, CAPPED_SCHEMA);
  assert.deepEqual(Object.keys(normalized).sort(), ['blocks', 'callToAction', 'headline', 'subheadline']);
  assert.deepEqual(normalized.blocks.map((b) => b.id), ['blk-1', 'blk-2', 'blk-3']);
  for (const b of normalized.blocks) {
    assert.deepEqual(Object.keys(b).sort(), ['answer', 'id', 'question']);
  }
  assert.equal(normalized.blocks[0].question, QA_CHAT_CONTENT.blocks[0].question); // trimmed
  assert.equal(normalized.subheadline, null);
});

// ── (b) generateContentV2 with a scripted egress ─────────────────────────────

const STYLE_CASES = [
  {
    templateId: 'qa-chat', content: QA_CHAT_CONTENT,
    kindRe: /between 3 and 4 blocks of kind "qa-pairs"/, fieldRes: [/"question"/, /"answer"/]
  },
  {
    templateId: 'comic-strip', content: COMIC_STRIP_CONTENT,
    kindRe: /between 3 and 4 blocks of kind "panels"/, fieldRes: [/"heading"/, /"text"/]
  },
  {
    templateId: 'stats-impact', content: STATS_IMPACT_CONTENT,
    kindRe: /between 3 and 4 blocks of kind "stats"/, fieldRes: [/"figure"/, /"caption"/]
  }
];

for (const { templateId, content, kindRe, fieldRes } of STYLE_CASES) {
  test(`generateContentV2 happy path (${templateId}): prompt names kind, fields and count range`, async () => {
    const template = getTemplateV2(templateId);
    assert.ok(template, `template ${templateId} must exist`);
    const egress = new FakeEgress({ 'content-generator': [content] });
    const out = await generateContentV2({
      egress, runId: 'run-v2', contextFile: V2_CONTEXT_FILE,
      selectedAngles: null, userPrompt: 'stop phishing emails', template
    });
    assert.equal(egress.calls.length, 1);
    const prompt = egress.calls[0].opts.user;
    assert.match(prompt, /TEMPLATE STRUCTURE/);
    assert.match(prompt, kindRe);
    for (const re of fieldRes) assert.match(prompt, re);
    // normalized v2 shape: blk-N ids, no "format", no "messages"
    assert.deepEqual(out.blocks.map((b) => b.id), ['blk-1', 'blk-2', 'blk-3']);
    assert.ok(!('format' in out) && !('messages' in out));
    assert.equal(out.headline, content.headline);
  });
}

test('generateContentV2: invalid output triggers ONE repair retry with the exact violations', async () => {
  const template = getTemplateV2('qa-chat');
  const tooFew = { ...QA_CHAT_CONTENT, blocks: QA_CHAT_CONTENT.blocks.slice(0, 2) };
  const egress = new FakeEgress({ 'content-generator': [tooFew, QA_CHAT_CONTENT] });
  const out = await generateContentV2({
    egress, runId: 'run-v2-repair', contextFile: V2_CONTEXT_FILE, template
  });
  assert.equal(egress.calls.length, 2);
  assert.match(egress.calls[1].opts.user, /violated the template structure/);
  assert.match(egress.calls[1].opts.user, /got 2/);
  assert.equal(out.blocks.length, 3);
});

test('generateContentV2: two invalid outputs in a row throw CONTENT_INVALID', async () => {
  const template = getTemplateV2('qa-chat');
  const tooFew = { ...QA_CHAT_CONTENT, blocks: QA_CHAT_CONTENT.blocks.slice(0, 2) };
  const missingField = { ...QA_CHAT_CONTENT, blocks: QA_CHAT_CONTENT.blocks.map(({ question }) => ({ question })) };
  const egress = new FakeEgress({ 'content-generator': [tooFew, missingField] });
  await assert.rejects(
    generateContentV2({ egress, runId: 'run-v2-bad', contextFile: V2_CONTEXT_FILE, template }),
    (err) => err.code === 'CONTENT_INVALID' && /qa-chat/.test(err.message)
  );
});

// ── (c) pipeline v2 fork ─────────────────────────────────────────────────────

function makeCtx(egress, { maxReworkLoops = 6, seed = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'postter-content-v2-'));
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

test('v2 flow: templateId tags the doc, the loop yields blocks, reviewContentV2 sees the template structure', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [QA_CHAT_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW]
  });
  const ctx = makeCtx(egress);
  const start = await startContentPipeline({ ctx, prompt: 'stop phishing emails', templateId: 'qa-chat' });

  // doc tagged at creation (D2), BEFORE any content exists
  let doc = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(start.posterId).doc);
  assert.equal(doc.templateId, 'qa-chat');
  assert.equal(doc.schemaVersion, 2);
  assert.equal(doc.content, null);

  const state = await chooseAngles({ ctx, posterId: start.posterId, angleIds: ['angle-1'] });
  assert.equal(state.phase, 'content-approval');
  // v2 shape: blocks, not messages
  assert.ok(!('messages' in state.content), 'v2 content must not carry messages');
  assert.deepEqual(state.content.blocks.map((b) => b.id), ['blk-1', 'blk-2', 'blk-3']);
  assert.equal(state.content.headline, QA_CHAT_CONTENT.headline);
  assert.deepEqual(state.reviewHistory, [{ attempt: 1, score: 97, status: 'accepted' }]);

  // the generator prompt was template-structured...
  const genPrompt = egress.callsFor('content-generator')[0].opts.user;
  assert.match(genPrompt, /TEMPLATE STRUCTURE/);
  assert.match(genPrompt, /between 3 and 4 blocks of kind "qa-pairs"/);
  // ...and so was the REVIEWER prompt (fit-to-template is part of the gate)
  const reviewCall = egress.callsFor('content-reviewer')[0];
  assert.match(reviewCall.opts.user, /TEMPLATE STRUCTURE/);
  assert.match(reviewCall.opts.user, /between 3 and 4 blocks of kind "qa-pairs"/);
  assert.match(reviewCall.opts.system, /FIT-TO-TEMPLATE/);
  // I1 relevance criterion: the v2 reviewer sees the ORIGINAL user prompt
  // fenced, plus the automatic-rework relevance line
  assert.match(reviewCall.opts.user, /THE USER'S ORIGINAL REQUEST/);
  assert.match(reviewCall.opts.user, /<user_text>stop phishing emails<\/user_text>/);
  assert.match(reviewCall.opts.user, /teaches a different topic than this request is an AUTOMATIC rework, score at most 85/);
  assert.match(reviewCall.opts.system, /0\. RELEVANCE TO THE USER'S REQUEST/);
  assert.match(reviewCall.opts.system, /TOPIC BREADTH/);
  assert.match(reviewCall.opts.system, /SEVERITY CALIBRATION \(apply BEFORE scoring\)/);

  // approval learning rows carry templateId + style
  await approveContent({ ctx, posterId: start.posterId });
  const row = ctx.db.prepare("SELECT detail FROM learning WHERE kind = 'approval'").get();
  const detail = JSON.parse(row.detail);
  assert.equal(detail.templateId, 'qa-chat');
  assert.equal(detail.style, 'qa');
});

test('regression: no templateId still yields the exact v1 messages shape and v1 reviewer prompt', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [POSTER_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW]
  });
  const ctx = makeCtx(egress);
  const start = await startContentPipeline({ ctx, prompt: 'stop phishing emails' });

  const doc = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(start.posterId).doc);
  assert.ok(!('templateId' in doc) && !('schemaVersion' in doc), 'v1 docs must not gain v2 fields');

  const state = await chooseAngles({ ctx, posterId: start.posterId, angleIds: 'ai' });
  assert.equal(state.content.messages.length, 4);
  assert.equal(state.content.format, 'red-flags');
  assert.ok(!('blocks' in state.content));
  // v1 prompts carry no template structure
  assert.ok(!egress.callsFor('content-generator')[0].opts.user.includes('TEMPLATE STRUCTURE'));
  assert.ok(!egress.callsFor('content-reviewer')[0].opts.user.includes('TEMPLATE STRUCTURE'));
});

test('unknown templateId degrades to v1 behaviour', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [POSTER_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW]
  });
  const ctx = makeCtx(egress);
  const start = await startContentPipeline({ ctx, prompt: 'stop phishing emails', templateId: 'no-such-template' });
  const doc = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(start.posterId).doc);
  assert.ok(!('templateId' in doc) && !('schemaVersion' in doc));
  const state = await chooseAngles({ ctx, posterId: start.posterId, angleIds: 'ai' });
  assert.equal(state.content.messages.length, 4);
});

test('inline edit on a v2 poster: shape-validated against the template schema, caps off, verbatim', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [QA_CHAT_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW],
    'edit-learning': EDIT_CLASSIFICATION
  });
  const ctx = makeCtx(egress);
  const start = await startContentPipeline({ ctx, prompt: 'stop phishing emails', templateId: 'qa-chat' });
  await chooseAngles({ ctx, posterId: start.posterId, angleIds: ['angle-1'] });

  // bad shape (a block missing its answer) → INVALID_CONTENT, nothing saved
  const badBlocks = structuredClone(QA_CHAT_CONTENT.blocks);
  delete badBlocks[0].answer;
  await assert.rejects(
    inlineEdit({ ctx, posterId: start.posterId, content: { ...QA_CHAT_CONTENT, blocks: badBlocks } }),
    (err) => err.code === 'INVALID_CONTENT' && err.status === 400
  );

  // valid v2 shape with a headline far beyond the 8-word cap → applied verbatim
  const reviewerCallsBefore = egress.callsFor('content-reviewer').length;
  const edited = {
    ...QA_CHAT_CONTENT,
    headline: 'A Deliberately Much Longer Headline The User Insisted On Keeping For This Poster',
    blocks: QA_CHAT_CONTENT.blocks.map((b) => ({ ...b, note: 'stray key the schema does not declare' }))
  };
  const state = await inlineEdit({ ctx, posterId: start.posterId, content: edited });
  assert.equal(state.content.headline, edited.headline); // user has the final word
  assert.deepEqual(state.content.blocks.map((b) => b.id), ['blk-1', 'blk-2', 'blk-3']);
  assert.ok(state.content.blocks.every((b) => !('note' in b)), 'unknown keys must be dropped');
  assert.equal(egress.callsFor('content-reviewer').length, reviewerCallsBefore, 'inline edit must NOT re-review');
});

// ── (d) HTTP routes ──────────────────────────────────────────────────────────

function startServer(egress) {
  const dataDir = mkdtempSync(join(tmpdir(), 'postter-content-v2-routes-'));
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

test('GET /api/pipeline/templates: full v2 gallery with previews', async () => {
  const egress = new FakeEgress({});
  const { srv, base, token } = await startServer(egress);
  try {
    const res = await req(base, token, '/api/pipeline/templates');
    assert.equal(res.status, 200);
    const { templates } = await res.json();
    // derive the expected count from the v2 registry — the gallery grows as batches land
    assert.equal(templates.length, listTemplatesV2().length);
    for (const t of templates) {
      assert.ok(t.id && t.name && t.style && t.contentSchema, `template ${t.id} must carry metadata`);
      assert.match(t.previews.portrait, /<svg/);
      assert.match(t.previews.landscape, /<svg/);
      assert.ok(!('build' in t), 'build functions must not cross the API boundary');
    }
    assert.ok(templates.some((t) => t.id === 'qa-chat'));

    // poster-independent: no egress calls
    assert.equal(egress.calls.length, 0);
  } finally { srv.close(); }
});

test('GET /api/pipeline/templates/:id/sample: real sample canvas both orientations; 404 unknown id', async () => {
  const egress = new FakeEgress({});
  const { srv, base, token } = await startServer(egress);
  try {
    for (const [orientation, w, h] of [['portrait', 1414, 2000], ['landscape', 2000, 1414]]) {
      const res = await req(base, token, `/api/pipeline/templates/qa-chat/sample?orientation=${orientation}`);
      assert.equal(res.status, 200);
      const { canvas, templateId } = await res.json();
      assert.equal(templateId, 'qa-chat');
      assert.equal(canvas.width, w, `${orientation}: canvas width`);
      assert.equal(canvas.height, h, `${orientation}: canvas height`);
      assert.ok(canvas.objects.some((o) => o.layerRole === 'headline'), `${orientation}: sample headline compiled`);
    }
    // zero model calls — the preview is pure template math
    assert.equal(egress.calls.length, 0);
    const missing = await req(base, token, '/api/pipeline/templates/not-a-template/sample');
    assert.equal(missing.status, 404);
  } finally { srv.close(); }
});

test('POST /api/pipeline/start accepts templateId and the run is template-first end to end', async () => {
  const egress = new FakeEgress({
    ...BASE_HANDLERS,
    'content-generator': [STATS_IMPACT_CONTENT],
    'content-reviewer': [ACCEPT_REVIEW]
  });
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    // bad templateId type is rejected at the route
    let res = await req(base, token, '/api/pipeline/start', 'POST', { prompt: 'phishing stats', templateId: 42 });
    assert.equal(res.status, 400);

    res = await req(base, token, '/api/pipeline/start', 'POST', { prompt: 'phishing stats poster', templateId: 'stats-impact' });
    assert.equal(res.status, 200);
    const started = await res.json();
    const doc = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(started.posterId).doc);
    assert.equal(doc.templateId, 'stats-impact');
    assert.equal(doc.schemaVersion, 2);

    res = await req(base, token, `/api/pipeline/${started.posterId}/angles`, 'POST', { angleIds: 'ai' });
    assert.equal(res.status, 200);
    const withContent = await res.json();
    assert.deepEqual(withContent.content.blocks.map((b) => b.id), ['blk-1', 'blk-2', 'blk-3']);
    assert.equal(withContent.content.blocks[0].figure, '9 in 10');
    assert.ok(!('messages' in withContent.content));
    // safe view stays leak-free for v2 docs too
    const s = JSON.stringify(withContent);
    assert.ok(!s.includes(CONTEXT_OUTPUT.synthesis.slice(0, 40)) && !s.includes('"synthesis"'));
  } finally { srv.close(); }
});

test('POST /api/pipeline/start topicOverride: happy path replaces the interpreted topic; bad values are 400 INVALID_TOPIC_OVERRIDE', async () => {
  const egress = new FakeEgress({ ...BASE_HANDLERS }); // intent returns topic 'phishing'
  const { srv, ctx, base, token } = await startServer(egress);
  try {
    // 400 paths: wrong type, whitespace-only, over 120 chars — no model calls
    for (const bad of [42, '   ', 'x'.repeat(121)]) {
      const res = await req(base, token, '/api/pipeline/start', 'POST', { prompt: 'office awareness', topicOverride: bad });
      assert.equal(res.status, 400, `topicOverride ${JSON.stringify(bad).slice(0, 20)} must 400`);
      assert.deepEqual(await res.json(), { error: 'INVALID_TOPIC_OVERRIDE' });
    }
    assert.equal(egress.calls.length, 0, 'invalid overrides must not reach the model');

    // happy path: override (trimmed, lowercased) owns the run's topic
    const res = await req(base, token, '/api/pipeline/start', 'POST', { prompt: 'office awareness', topicOverride: ' Clean Desk ' });
    assert.equal(res.status, 200);
    const started = await res.json();
    assert.equal(started.topic, 'clean desk');
    const doc = JSON.parse(ctx.db.prepare('SELECT doc FROM posters WHERE poster_id = ?').get(started.posterId).doc);
    assert.equal(doc.contextFile.topic, 'clean desk', 'override must reach the stored context file');
    assert.equal(doc.intent.topic, 'clean desk');
  } finally { srv.close(); }
});
