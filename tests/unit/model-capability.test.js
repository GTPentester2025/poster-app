// tests/unit/model-capability.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyModel } from '../../masking/model-capability.js';

test('classifyModel tags known image-generation ids as image', () => {
  for (const id of ['dall-e-3', 'dalle3', 'gpt-image-1', 'flux.1-schnell',
                    'stable-diffusion-xl', 'sdxl-turbo', 'imagen-3', 'org/some-image']) {
    assert.equal(classifyModel(id), 'image', id);
  }
});

test('classifyModel defaults everything else to text', () => {
  for (const id of ['gpt-4o', 'llama3.1', 'mixtral-8x7b', 'qwen2.5:14b', 'claude-3-5-sonnet']) {
    assert.equal(classifyModel(id), 'text', id);
  }
});

test('classifyModel is case-insensitive and safe on blank/garbage input', () => {
  assert.equal(classifyModel('Stable-Diffusion-3'), 'image');
  assert.equal(classifyModel(''), 'text');
  assert.equal(classifyModel(null), 'text');
  assert.equal(classifyModel(undefined), 'text');
});
