// tests/unit/chat-params.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isReasoningModel, defaultShape, altShape, tokenParams, isParamError }
  from '../../masking/chat-params.js';

test('isReasoningModel flags o-series / gpt-5 / reasoning ids', () => {
  for (const id of ['o1', 'o1-mini', 'o3-mini', 'foundry/o4-preview', 'gpt-5', 'gpt-5-pro', 'my-reasoning-model']) {
    assert.equal(isReasoningModel(id), true, id);
  }
});

test('isReasoningModel treats standard chat ids as non-reasoning', () => {
  for (const id of ['gpt-4o', 'gpt-4.1', 'claude-3-5-sonnet', 'claude-3-7', 'llama3.1', 'mistral-large', 'gpt-4o-mini']) {
    assert.equal(isReasoningModel(id), false, id);
  }
});

test('tokenParams: reasoning omits temperature; standard includes it only when provided', () => {
  assert.deepEqual(tokenParams('reasoning', 8, 0), { max_completion_tokens: 8 });
  assert.deepEqual(tokenParams('reasoning', 100), { max_completion_tokens: 100 });
  assert.deepEqual(tokenParams('standard', 8, 0), { max_tokens: 8, temperature: 0 });
  assert.deepEqual(tokenParams('standard', 100), { max_tokens: 100 });
});

test('defaultShape / altShape', () => {
  assert.equal(defaultShape('o1-mini'), 'reasoning');
  assert.equal(defaultShape('gpt-4o'), 'standard');
  assert.equal(altShape('reasoning'), 'standard');
  assert.equal(altShape('standard'), 'reasoning');
});

test('isParamError: 400 naming a token/temperature param is self-healable; 401/500 are not', () => {
  assert.equal(isParamError({ status: 400, message: 'Unsupported parameter: max_tokens' }), true);
  assert.equal(isParamError({ status: 400, message: "Unsupported value: 'temperature'" }), true);
  assert.equal(isParamError({ message: 'use max_completion_tokens instead' }), true); // status absent
  assert.equal(isParamError({ status: 401, message: 'Unauthorized' }), false);
  assert.equal(isParamError({ status: 500, message: 'max_tokens boom' }), false);
  assert.equal(isParamError({ status: 400, message: 'some other validation error' }), false);
  assert.equal(isParamError(null), false);
});
