// tests/unit/template-overflow.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listTemplatesV2 } from '../../templates/v2/index.js';
import { auditTemplate, auditAll } from '../../templates/v2/overflow_audit.js';

// One assertion per template so the failure names each offender.
for (const t of listTemplatesV2()) {
  test(`v2 template "${t.id}" has no overflow/overlap under stress content`, () => {
    const v = auditTemplate(t.id);
    assert.equal(v.length, 0, v.map((x) => `${x.orientation} ${x.kind} ${x.role} ${x.detail}`).join(' | '));
  });
}

test('auditAll aggregates cleanly (zero total violations)', () => {
  assert.equal(auditAll().length, 0);
});
