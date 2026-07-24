// Keyword/Intent agent tests: extraction parses + validates, one repair retry
// with concrete problems, hard failure after two bad responses, contentShape
// normalization, short prompts handled, term normalization/dedup.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractIntent, skills, AGENT_ID } from '../../agents/keyword_intent.js';
import { KEYWORD_INTENT_SYSTEM, buildKeywordIntentUserPrompt } from '../../agents/prompts/keyword_intent_prompts.js';
import { FakeEgress, INTENT_OUTPUT } from './helpers/fake_egress.js';

test('skills are declared for debuggability (spec §B.12)', () => {
  assert.deepEqual(skills, ['extract_keywords', 'semantic_expand', 'detect_content_shape']);
  assert.equal(AGENT_ID, 'keyword-intent');
});

test('extracts intent with semantic expansion and correct egress attribution', async () => {
  const egress = new FakeEgress({ 'keyword-intent': INTENT_OUTPUT });
  const intent = await extractIntent({ egress, runId: 'run-i1', prompt: 'stop phishing emails' });

  assert.equal(egress.calls.length, 1);
  assert.deepEqual(egress.calls[0].ctx, {
    runId: 'run-i1', pipeline: 'content', stage: 'keyword-intent',
    agent: 'keyword-intent', skill: 'extract_keywords'
  });
  // the prompt must reach the model and demand JSON
  assert.match(egress.calls[0].opts.user, /stop phishing emails/);
  assert.match(egress.calls[0].opts.user, /ONLY a JSON object/);

  assert.equal(intent.topic, 'phishing');
  assert.deepEqual(intent.core, ['phishing']);
  assert.ok(intent.expanded.includes('social engineering'));
  assert.equal(intent.contentShape, null);
});

test('short prompts still work (spec §B.2) and terms are normalized + deduped', async () => {
  const egress = new FakeEgress({
    'keyword-intent': {
      topic: '  Phishing ',
      core: ['Phishing', 'phishing '],
      expanded: ['PHISHING', 'User Awareness', 'user awareness'],
      contentShape: 'red-flags'
    }
  });
  const intent = await extractIntent({ egress, runId: 'run-i2', prompt: 'phishing' });
  assert.equal(intent.topic, 'phishing');
  assert.deepEqual(intent.core, ['phishing']);              // deduped, lowercased
  assert.deepEqual(intent.expanded, ['user awareness']);    // core terms filtered out of expanded
  assert.equal(intent.contentShape, 'red-flags');
});

test('invalid first response triggers one repair retry with concrete problems', async () => {
  const invalid = { topic: 'phishing', core: [] }; // empty core, missing expanded
  const egress = new FakeEgress({ 'keyword-intent': [invalid, INTENT_OUTPUT] });
  const intent = await extractIntent({ egress, runId: 'run-i3', prompt: 'stop phishing emails' });
  assert.equal(egress.calls.length, 2);
  assert.match(egress.calls[1].opts.user, /previous response was invalid/);
  assert.match(egress.calls[1].opts.user, /"core"/);
  assert.equal(egress.calls[1].opts.temperature, 0);
  assert.equal(intent.topic, 'phishing');
});

test('two invalid responses throw INTENT_INVALID', async () => {
  const egress = new FakeEgress({ 'keyword-intent': [{ topic: '' }, { core: 'phishing' }] });
  await assert.rejects(
    extractIntent({ egress, runId: 'run-i4', prompt: 'stop phishing emails' }),
    (err) => err.code === 'INTENT_INVALID'
  );
  assert.equal(egress.calls.length, 2);
});

test('unknown contentShape normalizes to null; empty prompt throws without a model call', async () => {
  const egress = new FakeEgress({ 'keyword-intent': { ...INTENT_OUTPUT, contentShape: 'haiku' } });
  const intent = await extractIntent({ egress, runId: 'run-i5', prompt: 'phishing poster with red flags' });
  assert.equal(intent.contentShape, null);

  const untouched = new FakeEgress({});
  await assert.rejects(
    extractIntent({ egress: untouched, runId: 'run-i6', prompt: '   ' }),
    (err) => err.code === 'INTENT_EMPTY_PROMPT'
  );
  assert.equal(untouched.calls.length, 0);
});

// ── I1 relevance de-bias: short-input expansion rules + no default topic ─────

test('intent SYSTEM prompt states the short-input expansion rules and carries no default topic', async () => {
  const egress = new FakeEgress({
    'keyword-intent': { topic: 'clean desk', core: ['clean desk'], expanded: ['clean desk policy', 'workspace security'], contentShape: null }
  });
  await extractIntent({ egress, runId: 'run-i7', prompt: 'clean desk' });
  const system = egress.calls[0].opts.system;

  // topic comes ONLY from the user's words; short inputs expanded faithfully
  assert.match(system, /topic comes ONLY from the user's words/);
  assert.match(system, /NO default topic/);
  assert.match(system, /"clean desk" → clean-desk policy awareness/);
  assert.match(system, /NEVER redirected to a more common or adjacent topic/);
  assert.match(system, /genuinely ambiguous, use the user's literal words as the topic/);
  assert.match(system, /Broad or non-security inputs are valid/);
  // no default/example topic can flavor extraction toward phishing
  assert.ok(!/phishing/i.test(system), 'intent system prompt must not mention phishing');
  assert.ok(!/phishing/i.test(buildKeywordIntentUserPrompt('clean desk')), 'intent user prompt must not mention phishing');
});

test('intent user prompt repeats the faithful-expansion rule and asks for the user\'s own topic', () => {
  const user = buildKeywordIntentUserPrompt('tailgating');
  assert.match(user, /The topic comes ONLY from the user's request/);
  assert.match(user, /never redirected to a more common topic/);
  assert.match(user, /use the literal words as the topic/);
  assert.match(user, /the user's own topic, normalized and lowercase/);
  // the exported constant is what the agent actually sends
  assert.match(KEYWORD_INTENT_SYSTEM, /keyword & intent extraction agent/);
});
