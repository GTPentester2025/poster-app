// Unit tests for translator.js (translateContent, validateTranslatedContent,
// extractStylePreference) using a scripted fake egress and in-memory DB.
// All model calls go through the fake egress — zero real network calls
// (except the S1 regression test, which wraps a scripted TRANSPORT in the
// real MaskingEgress to prove the placeholder-lock survives mask/restore).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from '../../backend/db.js';
import { Vault } from '../../masking/vault.js';
import { MaskingEgress } from '../../masking/egress.js';
import {
  translateContent,
  validateTranslatedContent,
  extractStylePreference
} from '../../agents/translator.js';
import { TRANSLATOR_SYSTEM, TRANSLATOR_PROMPT_VERSION } from '../../agents/prompts/translator_prompts.js';

// ── In-memory test DB ─────────────────────────────────────────────────────────

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

// ── Scripted fake egress (plan §Task1 Step2 pattern) ─────────────────────────

function fakeEgress(responses) {
  const calls = [];
  return {
    calls,
    completeJson: async ({ system, user, temperature }, ctx) => {
      calls.push({ system, user, temperature, ctx });
      if (!responses.length) throw new Error('fake egress exhausted');
      const r = responses.shift();
      return typeof r === 'function' ? r({ system, user }) : r;
    }
  };
}

// ── Source content fixture (plan §Task1 Step2) ────────────────────────────────
// NOTE: {{SOC_EMAIL}} is a PLACEHOLDER token (not a real email). translateContent
// locks it into the __LOCK_n__ sentinel space alongside protectTokens output
// (finding S1) — the MODEL sees __LOCK_0__ (so an egress restore pass can never
// substitute the real org value), and restoreTokens puts the literal
// placeholder back into the returned content at the very end.

const CONTENT = {
  headline: 'Stop phishing attacks',
  subheadline: null,
  messages: [{ id: 'm1', label: 'DO', text: 'Report suspicious emails to {{SOC_EMAIL}}' }],
  callToAction: 'Think before you click',
  format: 'dos-donts'
};

// ── Valid Spanish translation fixture (as the MODEL responds: sentinels) ─────

const VALID_ES = {
  headline: 'Detenga los ataques de phishing',
  subheadline: null,
  messages: [{ id: 'm1', label: 'HAGA', text: 'Reporte correos sospechosos a __LOCK_0__' }],
  callToAction: 'Piense antes de hacer clic',
  format: 'dos-donts'
};

const FIDELITY_ACCEPT = { score: 97, status: 'accepted', feedback: '', expected: '', issues: [] };

// ── Case 1: Happy path ────────────────────────────────────────────────────────

test('translateContent happy path: valid translation + fidelity 97 returned', async () => {
  const egress = fakeEgress([VALID_ES, FIDELITY_ACCEPT]);

  const result = await translateContent({
    egress,
    db: freshDb(),
    runId: 'run-1',
    content: CONTENT,
    targetLang: 'es'
  });

  // fidelity score forwarded
  assert.equal(result.fidelity.score, 97);
  assert.equal(result.fidelity.status, 'accepted');

  // {{SOC_EMAIL}} restored verbatim through the token round-trip
  assert.ok(
    result.content.messages[0].text.includes('{{SOC_EMAIL}}'),
    'SOC_EMAIL placeholder must survive in the returned content'
  );

  // the MODEL never saw the literal placeholder — only the __LOCK sentinel
  assert.ok(egress.calls[0].user.includes('__LOCK_0__'), 'prompt must carry the lock sentinel');
  assert.ok(!egress.calls[0].user.includes('{{SOC_EMAIL}}'), 'prompt must not carry the literal placeholder');

  // headline is non-empty string
  assert.ok(typeof result.content.headline === 'string' && result.content.headline.trim());

  // first call used temperature 0.3
  assert.equal(egress.calls[0].temperature, 0.3, 'translation call must use temperature 0.3');

  // ctx.stage on the translation call is 'translate:es'
  assert.equal(egress.calls[0].ctx.stage, 'translate:es', 'translation ctx.stage must be translate:es');

  // exactly 2 egress calls: translation + fidelity
  assert.equal(egress.calls.length, 2);
});

// ── Case 2: Repair retry when first response drops {{SOC_EMAIL}} ─────────────

test('translateContent repair retry: dropped placeholder → repair → accept; 3 egress calls', async () => {
  // First translation: {{SOC_EMAIL}} is missing from the message text
  const BAD_ES = {
    headline: 'Detenga los ataques de phishing',
    subheadline: null,
    messages: [{ id: 'm1', label: 'HAGA', text: 'Reporte correos sospechosos' }], // missing {{SOC_EMAIL}}
    callToAction: 'Piense antes de hacer clic',
    format: 'dos-donts'
  };

  const egress = fakeEgress([BAD_ES, VALID_ES, FIDELITY_ACCEPT]);

  const result = await translateContent({
    egress,
    db: freshDb(),
    runId: 'run-2',
    content: CONTENT,
    targetLang: 'es'
  });

  // 3 total calls: bad translation, repair translation, fidelity
  assert.equal(egress.calls.length, 3, 'must have exactly 3 egress calls');

  // repair call (index 1) must be at temperature 0
  assert.equal(egress.calls[1].temperature, 0, 'repair call must use temperature 0');

  // repair prompt must mention the lost protected token
  assert.ok(
    egress.calls[1].user.includes('lost the protected token'),
    'repair prompt must mention "lost the protected token"'
  );

  // final result is valid
  assert.equal(result.fidelity.score, 97);
  assert.ok(result.content.messages[0].text.includes('{{SOC_EMAIL}}'));
});

// ── Case 3: Both translation attempts invalid → TRANSLATION_INVALID ───────────

test('translateContent: both attempts invalid → throws TRANSLATION_INVALID', async () => {
  // Return empty headline both times — immediately invalid
  const BAD = {
    headline: '',
    subheadline: null,
    messages: [{ id: 'm1', label: 'HAGA', text: 'Reporte correos sospechosos a __LOCK_0__' }],
    callToAction: 'Piense antes de hacer clic',
    format: 'dos-donts'
  };

  const egress = fakeEgress([BAD, BAD]);

  await assert.rejects(
    () => translateContent({ egress, db: freshDb(), runId: 'run-3', content: CONTENT, targetLang: 'es' }),
    (err) => {
      assert.equal(err.code, 'TRANSLATION_INVALID', 'error code must be TRANSLATION_INVALID');
      return true;
    }
  );
});

// ── Case 4: English echo → rejected ──────────────────────────────────────────

test('translateContent: output identical to source → English echo rejection', async () => {
  // The content object echoes English exactly — validateTranslatedContent detects this.
  // We test validateTranslatedContent directly here (it is exported).
  const problems = validateTranslatedContent(
    {
      headline: CONTENT.headline,
      subheadline: null,
      messages: [{ id: 'm1', label: 'DO', text: 'Report suspicious emails to {{SOC_EMAIL}}' }],
      callToAction: CONTENT.callToAction,
      format: CONTENT.format
    },
    {
      headline: CONTENT.headline,
      subheadline: null,
      messages: [{ id: 'm1', label: 'DO', text: 'Report suspicious emails to {{SOC_EMAIL}}' }],
      callToAction: CONTENT.callToAction
    },
    'es' // non-English target — echo must be detected
  );

  assert.ok(problems.length > 0, 'English echo should produce at least one problem');
  assert.ok(
    problems.some((p) => p.includes('echoes the English source')),
    `problems should include echo message, got: ${JSON.stringify(problems)}`
  );
});

// ── Case 5: Verbose dump (5× source length, source ≥ 50 chars) ───────────────

test('validateTranslatedContent: field 5× source length → verbose dump rejection', () => {
  // Source headline is > 50 chars (and < 140 so the check is active).
  // 5× the source exceeds Math.max(120, src.length * 3).
  const srcHeadline = 'Stop phishing and social engineering attacks now'; // 49 chars — add one more
  const srcHeadline50 = srcHeadline + '!'; // 50 chars; 5×50 = 250 > max(120, 150)=150 → rejected
  const verboseHeadline = 'a'.repeat(srcHeadline50.length * 5);

  const source = {
    headline: srcHeadline50,
    subheadline: null,
    messages: [{ id: 'm1', label: 'DO', text: 'Some text here' }],
    callToAction: 'Click here'
  };

  const out = {
    headline: verboseHeadline, // 5× — far over the 3× cap
    subheadline: null,
    messages: [{ id: 'm1', label: 'Haga', text: 'Algún texto aquí' }],
    callToAction: 'Haga clic aquí',
    format: 'dos-donts'
  };

  const problems = validateTranslatedContent(out, source, 'es');
  assert.ok(problems.length > 0, 'verbose dump should produce at least one problem');
  assert.ok(
    problems.some((p) => p.includes('verbose dump') || p.includes('over 3×')),
    `problems should mention verbose dump, got: ${JSON.stringify(problems)}`
  );
});

// ── Case 6: validateTranslatedContent direct structural cases ─────────────────

test('validateTranslatedContent: wrong message count → problem string', () => {
  const source = {
    headline: 'Stop phishing',
    subheadline: null,
    messages: [
      { id: 'm1', label: 'DO', text: 'Do this' },
      { id: 'm2', label: 'DO', text: 'Do that' }
    ],
    callToAction: 'Act now'
  };
  const out = {
    headline: 'Alto al phishing',
    subheadline: null,
    messages: [{ id: 'm1', label: 'HAGA', text: 'Haga esto' }], // only 1 message, source has 2
    callToAction: 'Actúe ahora',
    format: 'dos-donts'
  };
  const problems = validateTranslatedContent(out, source, 'es');
  assert.ok(
    problems.some((p) => p.includes('"messages" must be an array of exactly 2 items')),
    `expected wrong-count message, got: ${JSON.stringify(problems)}`
  );
});

test('validateTranslatedContent: mutated message id → problem string', () => {
  const source = {
    headline: 'Stop phishing',
    subheadline: null,
    messages: [{ id: 'm1', label: 'DO', text: 'Do this' }],
    callToAction: 'Act now'
  };
  const out = {
    headline: 'Alto al phishing',
    subheadline: null,
    messages: [{ id: 'WRONG_ID', label: 'HAGA', text: 'Haga esto' }], // id mutated
    callToAction: 'Actúe ahora',
    format: 'dos-donts'
  };
  const problems = validateTranslatedContent(out, source, 'es');
  assert.ok(
    problems.some((p) => p.includes('messages[0].id must be "m1"')),
    `expected mutated-id message, got: ${JSON.stringify(problems)}`
  );
});

test('validateTranslatedContent: non-null subheadline when source is null → problem', () => {
  const source = {
    headline: 'Stop phishing',
    subheadline: null, // source has no subheadline
    messages: [{ id: 'm1', label: 'DO', text: 'Do this' }],
    callToAction: 'Act now'
  };
  const out = {
    headline: 'Alto al phishing',
    subheadline: 'Un subtítulo añadido', // model invented a subheadline
    messages: [{ id: 'm1', label: 'HAGA', text: 'Haga esto' }],
    callToAction: 'Actúe ahora',
    format: 'dos-donts'
  };
  const problems = validateTranslatedContent(out, source, 'es');
  assert.ok(
    problems.some((p) => p.includes('"subheadline" must be null')),
    `expected subheadline-must-be-null message, got: ${JSON.stringify(problems)}`
  );
});

// ── Case 7: Fidelity rework missing feedback → FIDELITY_INVALID ──────────────

test('translateContent: fidelity verdict missing feedback → repair; second invalid → FIDELITY_INVALID', async () => {
  // Fidelity response 1: status 'rework' but no feedback/expected (invalid)
  const FIDELITY_MISSING_FEEDBACK = { score: 80, status: 'rework' }; // missing feedback & expected

  // Fidelity repair response (also invalid — still missing feedback)
  const FIDELITY_STILL_INVALID = { score: 75, status: 'rework' }; // still missing feedback & expected

  const egress = fakeEgress([
    VALID_ES,             // translation succeeds on first try
    FIDELITY_MISSING_FEEDBACK,  // fidelity invalid (no feedback)
    FIDELITY_STILL_INVALID      // repair still invalid → FIDELITY_INVALID
  ]);

  await assert.rejects(
    () => translateContent({ egress, db: freshDb(), runId: 'run-7', content: CONTENT, targetLang: 'es' }),
    (err) => {
      assert.equal(err.code, 'FIDELITY_INVALID', 'error code must be FIDELITY_INVALID');
      return true;
    }
  );

  // Should have made 3 calls: translation, bad fidelity, repair fidelity
  assert.equal(egress.calls.length, 3);
});

// ── Case 8: Invalid target language throws ───────────────────────────────────

test('translateContent: targetLang "en" → throws', async () => {
  const egress = fakeEgress([]);
  await assert.rejects(
    () => translateContent({ egress, db: null, runId: 'run-8a', content: CONTENT, targetLang: 'en' }),
    (err) => {
      assert.ok(
        err.message.includes('non-English') || err.message.includes('"en"'),
        `expected non-English error, got: ${err.message}`
      );
      return true;
    }
  );
});

test('translateContent: unknown lang → throws', async () => {
  const egress = fakeEgress([]);
  await assert.rejects(
    () => translateContent({ egress, db: null, runId: 'run-8b', content: CONTENT, targetLang: 'jp' }),
    (err) => {
      assert.ok(
        err.message.includes('"jp"') || err.message.includes('non-English') || err.message.includes('requires'),
        `expected unknown-lang error, got: ${err.message}`
      );
      return true;
    }
  );
});

// ── Case 9: Glossary lock normalizes spelling in returned content ─────────────

test('translateContent: glossary lock normalizes phishing spelling in returned content', async () => {
  // The model returns 'Phishing' with correct casing (matches static canonical 'phishing').
  // With the static glossary: canonical is 'phishing', case-preservation keeps 'Phishing' as 'Phishing'.
  // Also test with all-lowercase 'phishing' in non-first position stays lowercase.
  const ES_WITH_PHISHING = {
    headline: 'Detenga los ataques de Phishing', // 'Phishing' — should stay 'Phishing' (leading cap preserved)
    subheadline: null,
    messages: [{ id: 'm1', label: 'HAGA', text: 'Reporte correos con phishing a __LOCK_0__' }], // lowercase stays lowercase
    callToAction: 'Piense antes de hacer clic',
    format: 'dos-donts'
  };

  const egress = fakeEgress([ES_WITH_PHISHING, FIDELITY_ACCEPT]);

  const result = await translateContent({
    egress,
    db: freshDb(), // no DB rows → only static glossary
    runId: 'run-9',
    content: CONTENT,
    targetLang: 'es'
  });

  // After glossary lock: 'Phishing' (capital P) → canonical 'phishing' + leadUpper → 'Phishing'
  // After glossary lock: 'phishing' (lower p) → canonical 'phishing' stays 'phishing'
  assert.ok(
    result.content.headline.includes('Phishing'),
    `headline should contain 'Phishing' (preserved cap): ${result.content.headline}`
  );
  assert.ok(
    result.content.messages[0].text.includes('phishing'),
    `message text should contain lowercase 'phishing': ${result.content.messages[0].text}`
  );
});

// ── Case 10: extractStylePreference ──────────────────────────────────────────

test('extractStylePreference: returns null on short/invalid preference', async () => {
  // Model returns a preference shorter than 10 chars
  const egress1 = fakeEgress([{ preference: 'short' }]); // < 10 chars
  const r1 = await extractStylePreference({
    egress: egress1,
    runId: 'run-10a',
    lang: 'de',
    changes: [{ field: 'headline', before: 'Alter Titel', after: 'Neuer Titel' }]
  });
  assert.equal(r1, null, 'short preference should return null');

  // Model returns non-string preference
  const egress2 = fakeEgress([{ preference: 42 }]);
  const r2 = await extractStylePreference({
    egress: egress2,
    runId: 'run-10b',
    lang: 'de',
    changes: [{ field: 'headline', before: 'Alter Titel', after: 'Neuer Titel' }]
  });
  assert.equal(r2, null, 'non-string preference should return null');

  // Model returns null object
  const egress3 = fakeEgress([null]);
  const r3 = await extractStylePreference({
    egress: egress3,
    runId: 'run-10c',
    lang: 'de',
    changes: [{ field: 'headline', before: 'Alter Titel', after: 'Neuer Titel' }]
  });
  assert.equal(r3, null, 'null response should return null');
});

test('extractStylePreference: returns {preference} on valid response; leading/trailing whitespace trimmed; capped at 300 chars', async () => {
  // Build a preference well over 300 chars (720 chars) with leading/trailing spaces.
  const longPref = 'prefers naming the security team explicitly instead of a generic pronoun '.repeat(10);
  const egress = fakeEgress([{ preference: '  ' + longPref + '  ' }]);

  const r = await extractStylePreference({
    egress,
    runId: 'run-10d',
    lang: 'de',
    changes: [{ field: 'headline', before: 'Alter Titel', after: 'Neuer Titel' }]
  });

  assert.ok(r !== null, 'valid preference should return non-null');
  assert.ok(typeof r.preference === 'string', 'result should have a preference string');
  // Module does trim() then slice(0,300) — leading/trailing spaces from the raw
  // model string are stripped; the final slice may end mid-word (not re-trimmed).
  // Assert: no leading whitespace on the result.
  assert.ok(!r.preference.startsWith(' '), 'preference should not start with whitespace');
  // Capped at 300 chars
  assert.ok(r.preference.length <= 300, `preference should be capped at 300 chars, got ${r.preference.length}`);
  // Starts with the expected content (leading spaces stripped)
  assert.ok(r.preference.startsWith('prefers naming'), 'leading spaces should be stripped from preference');
});

test('extractStylePreference: no changes → returns null (no egress call)', async () => {
  const egress = fakeEgress([]);
  const r = await extractStylePreference({
    egress,
    runId: 'run-10e',
    lang: 'de',
    changes: []
  });
  assert.equal(r, null, 'empty changes should return null');
  assert.equal(egress.calls.length, 0, 'no egress call should be made for empty changes');
});

// ── Case 11 (finding S1): {{PLACEHOLDER}} survives the REAL egress restore ───
// Regression: egress.completeJson runs session.restore(raw) on the model
// response, substituting REAL org config values into any literal {{SOC_EMAIL}}
// BEFORE validation. The translator must therefore lock placeholders into the
// __LOCK_n__ sentinel space so the restore pass can never touch them and the
// real value never persists into variant content (render-time resolution only).

test('S1: translateContent through the real MaskingEgress — placeholder locked outbound, literal restored, org value never persisted', async () => {
  const soc = 'soc@ab-inbev.com';
  const dbRaw = new Database(':memory:');
  const dir = mkdtempSync(join(tmpdir(), 'postter-translator-s1-'));
  const vault = new Vault({ db: dbRaw, secretsPath: join(dir, 'secrets.json') });
  vault.setOrgConfig({ socEmail: soc });

  // Scripted transport: a compliant model that copies sentinels verbatim.
  const responses = [
    JSON.stringify({
      headline: 'Detenga los ataques de phishing',
      subheadline: null,
      messages: [{ id: 'm1', label: 'HAGA', text: 'Nunca comparta su código de un solo uso' }],
      callToAction: 'Reporte mensajes sospechosos a __LOCK_0__',
      extras: [],
      format: 'dos-donts'
    }),
    JSON.stringify({ score: 97, status: 'accepted', feedback: '', expected: '', issues: [] })
  ];
  const captured = [];
  const openai = {
    chat: {
      completions: {
        create: async (req) => {
          captured.push(req);
          return { choices: [{ message: { content: responses.shift() } }] };
        }
      }
    }
  };
  const egress = new MaskingEgress({ vault, bus: null, transports: { openai } });

  const content = {
    headline: 'Stop phishing attacks',
    subheadline: null,
    messages: [{ id: 'm1', label: 'DO', text: 'Never share your one-time code' }],
    callToAction: 'Report suspicious messages to {{SOC_EMAIL}}',
    format: 'dos-donts'
  };

  // (a) no TRANSLATION_INVALID — the egress restore pass cannot break preservation
  const result = await translateContent({
    egress, db: freshDb(), runId: 'run-s1', content, targetLang: 'es'
  });

  // (b) the returned content carries the LITERAL placeholder, never the real value
  assert.ok(result.content.callToAction.includes('{{SOC_EMAIL}}'), 'literal placeholder must be restored');
  assert.ok(!JSON.stringify(result.content).includes(soc), 'real org value must never persist into variant content');

  // (c) the prompt that left the process carried a __LOCK sentinel — not the
  // real value, not the literal placeholder
  const outboundUser = captured[0].messages.find((m) => m.role === 'user').content;
  assert.ok(outboundUser.includes('__LOCK_0__'), 'outbound prompt must carry the lock sentinel');
  assert.ok(!outboundUser.includes(soc), 'outbound prompt must not carry the real org value');
  assert.ok(!outboundUser.includes('{{SOC_EMAIL}}'), 'outbound prompt must not carry the literal placeholder');
});

// ── Case 12 (finding C5): extras (user-added text boxes) ride translation ────

const CONTENT_WITH_EXTRAS = {
  ...CONTENT,
  extras: [{ id: 'x1', text: 'Stay alert out there!' }]
};

test('C5: extras are validated like messages — missing/mutated extras rejected', () => {
  const source = {
    headline: 'Stop phishing',
    subheadline: null,
    messages: [{ id: 'm1', label: 'DO', text: 'Do this' }],
    callToAction: 'Act now',
    extras: [{ id: 'x1', text: 'Stay alert out there!' }]
  };
  const base = {
    headline: 'Alto al phishing',
    subheadline: null,
    messages: [{ id: 'm1', label: 'HAGA', text: 'Haga esto' }],
    callToAction: 'Actúe ahora',
    format: 'dos-donts'
  };

  // response missing extras entirely → rejected
  const missing = validateTranslatedContent(base, source, 'es');
  assert.ok(
    missing.some((p) => p.includes('"extras" must be an array of exactly 1 items')),
    `expected missing-extras problem, got: ${JSON.stringify(missing)}`
  );

  // mutated extra id → rejected
  const badId = validateTranslatedContent(
    { ...base, extras: [{ id: 'WRONG', text: '¡Manténgase alerta!' }] }, source, 'es'
  );
  assert.ok(
    badId.some((p) => p.includes('extras[0].id must be "x1"')),
    `expected mutated-id problem, got: ${JSON.stringify(badId)}`
  );

  // empty translated extra text → rejected
  const emptyText = validateTranslatedContent(
    { ...base, extras: [{ id: 'x1', text: '  ' }] }, source, 'es'
  );
  assert.ok(
    emptyText.some((p) => p.includes('extras[0].text must be a non-empty string')),
    `expected empty-text problem, got: ${JSON.stringify(emptyText)}`
  );

  // valid extras → clean
  const ok = validateTranslatedContent(
    { ...base, extras: [{ id: 'x1', text: '¡Manténgase alerta!' }] }, source, 'es'
  );
  assert.deepEqual(ok, []);
});

test('C5: translateContent carries extras through prompt, glossary lock and restore', async () => {
  const VALID_ES_EXTRAS = {
    ...VALID_ES,
    extras: [{ id: 'x1', text: '¡Manténgase alerta con el Phishing!' }]
  };
  const egress = fakeEgress([VALID_ES_EXTRAS, FIDELITY_ACCEPT]);

  const result = await translateContent({
    egress,
    db: freshDb(),
    runId: 'run-c5',
    content: CONTENT_WITH_EXTRAS,
    targetLang: 'es'
  });

  // extras rode into the prompt source
  assert.ok(egress.calls[0].user.includes('Stay alert out there!'), 'extras text must be in the prompt source');
  assert.ok(egress.calls[0].user.includes('"extras"'), 'source JSON must carry the extras array');

  // extras returned with verbatim id, glossary lock applied (Phishing preserved cap)
  assert.equal(result.content.extras.length, 1);
  assert.equal(result.content.extras[0].id, 'x1');
  assert.ok(result.content.extras[0].text.includes('Phishing'));
});

test('C5: model response missing extras when source has them → repair → TRANSLATION_INVALID', async () => {
  // Both attempts omit extras — deterministic failure, never a silent English ride-along
  const egress = fakeEgress([VALID_ES, VALID_ES]);
  await assert.rejects(
    () => translateContent({ egress, db: freshDb(), runId: 'run-c5b', content: CONTENT_WITH_EXTRAS, targetLang: 'es' }),
    (err) => {
      assert.equal(err.code, 'TRANSLATION_INVALID');
      return true;
    }
  );
  // the repair prompt named the extras problem
  assert.ok(egress.calls[1].user.includes('"extras" must be an array of exactly 1 items'));
});

// ── pass-2 finding M4: invented tokens are rejected, not repaired ─────────────

test('M4: output containing a sentinel or placeholder the source field never had is rejected as invented', () => {
  const source = {
    headline: 'Stop phishing now',
    subheadline: null,
    messages: [{ id: 'm1', label: 'DO', text: 'Report it to __LOCK_0__' }],
    callToAction: 'Think first',
    format: 'awareness'
  };
  const out = {
    headline: 'Stoppen Sie Phishing jetzt — melden an __LOCK_9__', // invented sentinel
    subheadline: null,
    messages: [{ id: 'm1', label: 'TUN', text: 'Melden Sie es an __LOCK_0__' }],
    callToAction: 'Denken Sie zuerst an {{IT_HELPDESK}}', // invented placeholder
    format: 'awareness'
  };
  const problems = validateTranslatedContent(out, source, 'de');
  assert.ok(problems.some((p) => /headline contains the invented token __LOCK_9__/.test(p)), problems.join('; '));
  assert.ok(problems.some((p) => /callToAction contains the invented token \{\{IT_HELPDESK\}\}/.test(p)), problems.join('; '));
  // legitimate survival of the source's own token is NOT flagged
  assert.ok(!problems.some((p) => /invented token __LOCK_0__/.test(p)));
});

// ── v2 (template-first) posters: blocks with dynamic per-template fields ─────
// v2 content carries blocks:[{id:'blk-N', <schema fields e.g. question/answer>}]
// instead of messages. The translator must serialize/validate/normalize that
// shape exactly like it does messages/extras (LIVE E2E regression: v1-only
// serialization crashed on content.messages.map).

const CONTENT_V2 = {
  headline: 'Pause Before You Scan or Sign In',
  subheadline: null,
  blocks: [
    { id: 'blk-1', question: 'Is this email really from IT?', answer: 'Check the sender, then report it to {{SOC_EMAIL}}' },
    { id: 'blk-2', question: 'Should I scan this QR code?', answer: 'Treat a QR code like a link you cannot read' }
  ],
  callToAction: 'Think before you click'
};

// As the MODEL responds: {{SOC_EMAIL}} rides as the __LOCK_0__ sentinel.
const VALID_DE_V2 = {
  headline: 'Innehalten vor dem Scannen oder Anmelden',
  subheadline: null,
  blocks: [
    { id: 'blk-1', question: 'Kommt diese E-Mail wirklich von der IT?', answer: 'Prüfen Sie den Absender und melden Sie es an __LOCK_0__' },
    { id: 'blk-2', question: 'Soll ich diesen QR-Code mit Phishing scannen?', answer: 'Behandeln Sie einen QR-Code wie einen unlesbaren Link' }
  ],
  callToAction: 'Denken Sie nach, bevor Sie klicken',
  extras: []
};

test('v2: translateContent serializes blocks, prompt documents the dynamic fields, ids verbatim, placeholder restored in a block field', async () => {
  const egress = fakeEgress([VALID_DE_V2, FIDELITY_ACCEPT]);

  const result = await translateContent({
    egress, db: freshDb(), runId: 'run-v2', content: CONTENT_V2, targetLang: 'de'
  });

  // the source JSON carried blocks — never a messages array
  const prompt = egress.calls[0].user;
  assert.ok(prompt.includes('"blocks"'), 'source JSON must carry the blocks array');
  assert.ok(prompt.includes('Is this email really from IT?'), 'block field text must ride the prompt');
  assert.ok(!prompt.includes('"messages"'), 'a v2 source must not demand a messages array');
  // the response-shape section documents the DYNAMIC field list of the blocks
  assert.ok(prompt.includes('"question": "translated question"'), 'response shape must document the question field');
  assert.ok(prompt.includes('"answer": "translated answer"'), 'response shape must document the answer field');
  assert.ok(prompt.includes('same number of blocks in the same order with identical ids'));
  // the placeholder travelled as a sentinel, never literally
  assert.ok(prompt.includes('__LOCK_0__'));
  assert.ok(!prompt.includes('{{SOC_EMAIL}}'));

  // returned content: blocks with verbatim ids, translated fields, restored token
  assert.deepEqual(result.content.blocks.map((b) => b.id), ['blk-1', 'blk-2']);
  assert.equal(result.content.blocks[0].question, VALID_DE_V2.blocks[0].question);
  assert.ok(result.content.blocks[0].answer.includes('{{SOC_EMAIL}}'), 'placeholder must be restored inside the block field');
  // glossary lock ran over block fields (canonical 'phishing' casing preserved)
  assert.ok(result.content.blocks[1].question.includes('Phishing'));
  assert.ok(!('messages' in result.content), 'v2 output must not grow a messages key');
  assert.equal(result.fidelity.score, 97);
});

test('v2: validateTranslatedContent — missing block field / wrong count / mutated id / missing blocks key are deterministic problems', () => {
  const source = CONTENT_V2; // no sentinels needed for direct validation
  const good = {
    headline: 'Innehalten vor dem Scannen',
    subheadline: null,
    blocks: [
      { id: 'blk-1', question: 'Kommt diese E-Mail von der IT?', answer: 'Prüfen Sie den Absender, dann melden an {{SOC_EMAIL}}' },
      { id: 'blk-2', question: 'Diesen QR-Code scannen?', answer: 'Wie einen unlesbaren Link behandeln' }
    ],
    callToAction: 'Erst denken, dann klicken'
  };
  assert.deepEqual(validateTranslatedContent(good, source, 'de'), []);

  // one block field missing → named problem
  const missingField = structuredClone(good);
  delete missingField.blocks[0].answer;
  assert.ok(
    validateTranslatedContent(missingField, source, 'de')
      .some((p) => p.includes('blocks[0].answer must be a non-empty string')),
    'missing block field must be named'
  );

  // empty block field → same problem
  const emptyField = structuredClone(good);
  emptyField.blocks[1].question = '   ';
  assert.ok(
    validateTranslatedContent(emptyField, source, 'de')
      .some((p) => p.includes('blocks[1].question must be a non-empty string'))
  );

  // wrong count
  const short = structuredClone(good);
  short.blocks.pop();
  assert.ok(
    validateTranslatedContent(short, source, 'de')
      .some((p) => p.includes('"blocks" must be an array of exactly 2 items'))
  );

  // mutated id
  const badId = structuredClone(good);
  badId.blocks[0].id = 'WRONG';
  assert.ok(
    validateTranslatedContent(badId, source, 'de')
      .some((p) => p.includes('blocks[0].id must be "blk-1" verbatim'))
  );

  // blocks key missing entirely
  const noBlocks = structuredClone(good);
  delete noBlocks.blocks;
  assert.ok(
    validateTranslatedContent(noBlocks, source, 'de')
      .some((p) => p.includes('"blocks" must be an array of exactly 2 items'))
  );

  // English echo across block fields is caught
  const echo = structuredClone(source);
  assert.ok(
    validateTranslatedContent(echo, source, 'de')
      .some((p) => p.includes('echoes the English source')),
    'a blocks-only echo must trip the echo gate'
  );
});

test('v2: both attempts missing a block field → repair prompt names it → TRANSLATION_INVALID', async () => {
  const bad = structuredClone(VALID_DE_V2);
  delete bad.blocks[0].answer;
  const egress = fakeEgress([bad, structuredClone(bad)]);

  await assert.rejects(
    () => translateContent({ egress, db: freshDb(), runId: 'run-v2b', content: CONTENT_V2, targetLang: 'de' }),
    (err) => {
      assert.equal(err.code, 'TRANSLATION_INVALID');
      assert.match(err.message, /blocks\[0\]\.answer must be a non-empty string/);
      return true;
    }
  );
  assert.ok(
    egress.calls[1].user.includes('blocks[0].answer must be a non-empty string'),
    'repair prompt must carry the exact block-field violation'
  );
});

test('v2: preservation rules apply per block field — dropped sentinel in a block is rejected', () => {
  // validate against the PROTECTED source shape (sentinel in the block field)
  const source = {
    headline: 'Pause before you scan',
    subheadline: null,
    blocks: [{ id: 'blk-1', question: 'Who do I tell?', answer: 'Report it to __LOCK_0__ right away' }],
    callToAction: 'Think first'
  };
  const out = {
    headline: 'Innehalten vor dem Scannen',
    subheadline: null,
    blocks: [{ id: 'blk-1', question: 'Wem sage ich es?', answer: 'Melden Sie es sofort' }], // sentinel dropped
    callToAction: 'Denken Sie zuerst nach'
  };
  const problems = validateTranslatedContent(out, source, 'de');
  assert.ok(
    problems.some((p) => p.includes('blocks[0].answer lost the protected token __LOCK_0__')),
    problems.join('; ')
  );
});

// ── I7 prompt sweep: jargon rules are conditional, framing is topic-general ───

test('I7: translator system prompt applies jargon rules only when the term appears (no injected topic bias)', () => {
  // the tightened rule: apply a jargon rule ONLY when its term is in the source
  assert.match(TRANSLATOR_SYSTEM, /ONLY when its term actually appears in the source/,
    'jargon rules must be conditional on the term appearing');
  assert.match(TRANSLATOR_SYSTEM, /never inject a term the source did not use/,
    'must forbid injecting a term the source lacks');
  // the phishing gloss survives as a jargon RULE (legitimate vocabulary), but it
  // is scoped to "keep the word phishing" — not an assumption every poster phishes
  assert.match(TRANSLATOR_SYSTEM, /phishing → keep the word "phishing"/,
    'phishing remains a conditional jargon-translation rule');
  assert.equal(TRANSLATOR_PROMPT_VERSION, 2, 'translator prompt version bumped');
});
