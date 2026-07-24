// Pure-function tests for the custom-provider URL helpers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChatCompletionsBase, resolveModelsUrl, parseModelsList } from '../../masking/provider-url.js';

test('normalizeChatCompletionsBase handles host / root / full-URL inputs', () => {
  // bare loopback host → http + /v1
  assert.equal(normalizeChatCompletionsBase('localhost:11434'), 'http://localhost:11434/v1');
  assert.equal(normalizeChatCompletionsBase('127.0.0.1:8000'), 'http://127.0.0.1:8000/v1');
  // bare remote host → https + /v1
  assert.equal(normalizeChatCompletionsBase('api.example.com'), 'https://api.example.com/v1');
  // already an API root → unchanged (trailing slash trimmed)
  assert.equal(normalizeChatCompletionsBase('https://openrouter.ai/api/v1'), 'https://openrouter.ai/api/v1');
  assert.equal(normalizeChatCompletionsBase('https://openrouter.ai/api/v1/'), 'https://openrouter.ai/api/v1');
  // full chat-completions URL → stripped back to the root
  assert.equal(normalizeChatCompletionsBase('https://host/v1/chat/completions'), 'https://host/v1');
  // explicit http scheme respected
  assert.equal(normalizeChatCompletionsBase('http://localhost:11434'), 'http://localhost:11434/v1');
  // a non-/v1 path the user supplied is respected (not forced to /v1)
  assert.equal(normalizeChatCompletionsBase('https://host/openai'), 'https://host/openai');
});

test('normalizeChatCompletionsBase rejects empty and dangerous schemes', () => {
  for (const bad of ['', '   ', 'javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'ftp://host/x']) {
    assert.throws(() => normalizeChatCompletionsBase(bad), (err) => err.code === 'CUSTOM_URL_INVALID' && err.status === 400, `expected reject: ${bad}`);
  }
});

test('resolveModelsUrl appends /models to the normalized base', () => {
  assert.equal(resolveModelsUrl('http://localhost:11434/v1'), 'http://localhost:11434/v1/models');
  assert.equal(resolveModelsUrl('https://openrouter.ai/api/v1/'), 'https://openrouter.ai/api/v1/models');
});

test('parseModelsList tolerates {data}, {models}, bare array, and object items', () => {
  assert.deepEqual(parseModelsList({ data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] }), ['gpt-4o', 'gpt-4o-mini']);
  assert.deepEqual(parseModelsList({ models: [{ name: 'llama3.1' }, { name: 'mistral' }] }), ['llama3.1', 'mistral']);
  assert.deepEqual(parseModelsList(['a', 'b']), ['a', 'b']);
  assert.deepEqual(parseModelsList([{ model: 'x' }, { id: 'y' }]), ['x', 'y']);
  // de-dupes and drops blanks/non-strings
  assert.deepEqual(parseModelsList({ data: [{ id: 'dup' }, { id: 'dup' }, { id: '' }, { foo: 1 }, 'dup'] }), ['dup']);
  // unknown shapes → empty, never throws
  assert.deepEqual(parseModelsList({}), []);
  assert.deepEqual(parseModelsList(null), []);
  assert.deepEqual(parseModelsList('nope'), []);
});
