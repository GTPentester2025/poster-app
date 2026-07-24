import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMaskMap, redact, restore, assertNoLeaks, protectTokens, restoreTokens
} from '../../masking/redactor.js';

const ORG = {
  companyName: 'AB InBev',
  socEmail: 'soc@ab-inbev.com',
  trainingPortalUrl: 'https://training.ab-inbev.com/awareness',
  contentPortalUrl: 'https://portal.ab-inbev.com',
  reportingUrl: 'https://phishing-report.ab-inbev.com',
  itHelpdesk: '+1-555-0134 IT Service Desk',
  orgDomains: ['ab-inbev.com'],
  customSensitiveTerms: ['Project Falcon', 'BrewNet']
};

test('redact replaces every org value with placeholders', () => {
  const map = buildMaskMap(ORG);
  const text = `Report phishing to soc@ab-inbev.com. AB InBev staff use https://training.ab-inbev.com/awareness and BrewNet. Project Falcon rollout continues.`;
  const { masked } = redact(text, map);
  assert.ok(masked.includes('{{SOC_EMAIL}}'));
  assert.ok(masked.includes('{{ORG_NAME}}'));
  assert.ok(masked.includes('{{TRAINING_PORTAL}}'));
  assert.ok(masked.includes('{{SENSITIVE_1}}'));
  assert.ok(masked.includes('{{SENSITIVE_2}}'));
  assert.doesNotThrow(() => assertNoLeaks(masked, ORG));
});

test('redact is case-insensitive', () => {
  const map = buildMaskMap(ORG);
  const { masked } = redact('Contact SOC@AB-INBEV.COM about ab inbev... AB INBEV policy', map);
  assert.doesNotThrow(() => assertNoLeaks(masked, ORG));
});

test('org-domain emails and URLs are scrubbed even when not in config verbatim', () => {
  const map = buildMaskMap(ORG);
  const { masked } = redact('Mail jane.doe@mail.ab-inbev.com or visit https://intranet.ab-inbev.com/secret/page', map);
  assert.match(masked, /\{\{ORG_EMAIL_\d+\}\}/);
  assert.match(masked, /\{\{ORG_URL_\d+\}\}/);
  assert.doesNotThrow(() => assertNoLeaks(masked, ORG));
});

test('domain-pattern captures restore EXACTLY (no one-way masking)', () => {
  const map = buildMaskMap(ORG);
  const src = 'Mail jane.doe@mail.ab-inbev.com or visit https://intranet.ab-inbev.com/secret/page today';
  const { masked } = redact(src, map);
  const restored = restore(masked, map, ORG);
  assert.ok(restored.includes('jane.doe@mail.ab-inbev.com'));
  assert.ok(restored.includes('https://intranet.ab-inbev.com/secret/page'));
});

test('restore round-trips placeholders back to real values', () => {
  const map = buildMaskMap(ORG);
  const { masked } = redact('Report to soc@ab-inbev.com — AB InBev security. Questions: Project Falcon.', map);
  const restored = restore(masked, map, ORG);
  assert.ok(restored.includes('soc@ab-inbev.com'));
  assert.ok(restored.includes('AB InBev'));
  assert.ok(restored.includes('Project Falcon'));
});

test('longer values mask before shorter overlapping values', () => {
  const org = { companyName: 'Acme', trainingPortalUrl: 'Acme Security Portal', orgDomains: [], customSensitiveTerms: [] };
  const map = buildMaskMap(org);
  const { masked } = redact('Open Acme Security Portal today', map);
  assert.ok(masked.includes('{{TRAINING_PORTAL}}'), masked);
  assert.ok(!masked.includes('{{ORG_NAME}} Security Portal'), masked);
});

test('assertNoLeaks throws with MASKING_LEAK code on residue', () => {
  assert.throws(
    () => assertNoLeaks('AB InBev employees beware', ORG),
    (err) => err.code === 'MASKING_LEAK' && /companyName/.test(err.message)
  );
});

test('heavyRedaction scrubs internal reference ids, reversibly', () => {
  const map = buildMaskMap(ORG, { heavyRedaction: true });
  const { masked } = redact('Per POL-2231 and SOP-88, see DOC-4521.', map);
  assert.ok(!/POL-2231|SOP-88|DOC-4521/.test(masked));
  assert.match(masked, /\{\{INTERNAL_REF_\d+\}\}/);
  const restored = restore(masked, map, ORG);
  assert.ok(restored.includes('POL-2231') && restored.includes('DOC-4521'));
});

test('empty/short config values never become placeholders (no over-masking)', () => {
  const org = { companyName: '', socEmail: 'x', orgDomains: [], customSensitiveTerms: ['', 'IT'] };
  const map = buildMaskMap(org);
  assert.equal(map.entries.length, 0); // 2-char terms excluded by MIN_VALUE_LENGTH
  const { masked, hits } = redact('Generic security advice text.', map);
  assert.equal(hits, 0);
  assert.equal(masked, 'Generic security advice text.');
});

test('2-char sensitive term cannot false-positive against {{IT_HELPDESK}} placeholder', () => {
  const org = { ...ORG, customSensitiveTerms: ['IT'] };
  // masked payload legitimately contains the {{IT_HELPDESK}} placeholder
  assert.doesNotThrow(() => assertNoLeaks('Call {{IT_HELPDESK}} or report via {{SOC_EMAIL}}', org));
});

test('company names with regex metacharacters mask and round-trip', () => {
  const org = { companyName: 'A.B. Corp (International)+', orgDomains: [], customSensitiveTerms: ['C&D+E*'] };
  const map = buildMaskMap(org);
  const src = 'Welcome to A.B. Corp (International)+ and partner C&D+E*.';
  const { masked } = redact(src, map);
  assert.ok(!masked.includes('A.B. Corp'));
  assert.ok(!masked.includes('C&D+E*'));
  assert.doesNotThrow(() => assertNoLeaks(masked, org));
  assert.equal(restore(masked, map, org), src.normalize('NFC'));
});


test('unicode company names: composed config matches decomposed input (NFC)', () => {
  const org = { companyName: 'Café Sécurité', orgDomains: [], customSensitiveTerms: [] }; // composed e-acute
  const map = buildMaskMap(org);
  const decomposed = 'Report to Cafe\u0301 Se\u0301curite\u0301 security team'; // e + combining acute
  const { masked } = redact(decomposed, map);
  assert.ok(masked.includes('{{ORG_NAME}}'), masked);
  assert.doesNotThrow(() => assertNoLeaks(masked, org));
});

test('protectTokens/restoreTokens round-trip (reference repo port)', () => {
  const src = 'See https://example.org/guide, mail help@example.org, ticket SEC-0042.';
  const locked = protectTokens(src);
  assert.ok(!locked.text.includes('example.org'));
  assert.ok(locked.text.includes('__LOCK_0__'));
  assert.equal(restoreTokens(locked.text, locked.protectedTokens), src);
});
