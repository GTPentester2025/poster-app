// Image text gate unit tests (spec §B.7):
// - fails CLOSED (rejected) when vision output is unparseable on both attempts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkZeroText } from '../../agents/image_text_gate.js';
import { IMAGE_BASE64 } from './helpers/fake_egress.js';

// Minimal fake egress that returns raw strings (simulating unparseable model output)
class GarbageEgress {
  constructor(...responses) {
    this.queue = [...responses];
    this.calls = [];
  }

  async completeVision(opts, ctx) {
    this.calls.push({ opts, ctx });
    if (!this.queue.length) throw new Error('GarbageEgress: queue exhausted');
    return this.queue.shift();
  }
}

test('image_text_gate: fails CLOSED (rejected) when vision returns garbage twice', async () => {
  const egress = new GarbageEgress(
    'this is not json at all',
    'still not json {{{'
  );

  const verdict = await checkZeroText({
    egress,
    runId: 'test-run-1',
    imageBase64: IMAGE_BASE64
  });

  // Both attempts returned garbage → conservative fail-safe: rejected
  assert.equal(verdict.status, 'rejected', 'verdict must be rejected when unparseable');
  assert.equal(verdict.score, 0, 'score must be 0 on unparseable output');
  assert.ok(
    verdict.feedback.toLowerCase().includes('unparseable'),
    'feedback must mention unparseable'
  );
  assert.equal(egress.calls.length, 2, 'egress called exactly twice (initial + repair)');
});
