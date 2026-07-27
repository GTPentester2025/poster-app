// tests/unit/request-key.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWithKey, currentKey } from '../../masking/request-key.js';

test('currentKey is empty outside any runWithKey scope', () => {
  assert.equal(currentKey(), '');
});

test('currentKey returns the key inside runWithKey', () => {
  const seen = runWithKey('sk-abc', () => currentKey());
  assert.equal(seen, 'sk-abc');
  assert.equal(currentKey(), '', 'scope does not leak after runWithKey returns');
});

test('currentKey propagates through awaited async work', async () => {
  const seen = await runWithKey('sk-async', async () => {
    await Promise.resolve();
    return currentKey();
  });
  assert.equal(seen, 'sk-async');
});

test('nested runWithKey scopes shadow correctly', () => {
  const [outer, inner, back] = runWithKey('outer', () => {
    const o = currentKey();
    const i = runWithKey('inner', () => currentKey());
    return [o, i, currentKey()];
  });
  assert.deepEqual([outer, inner, back], ['outer', 'inner', 'outer']);
});
