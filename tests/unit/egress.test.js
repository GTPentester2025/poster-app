// Egress leak tests: inject real org values into prompts, capture what would
// leave the process via fake transports, assert ZERO residue outbound and
// correct restoration inbound.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { EventBus } from '#shared';
import { Vault } from '../../masking/vault.js';
import { MaskingEgress } from '../../masking/egress.js';
import { migrate } from '../../backend/db.js';

const ORG = {
  companyName: 'AB InBev',
  socEmail: 'soc@ab-inbev.com',
  trainingPortalUrl: 'https://training.ab-inbev.com/awareness',
  contentPortalUrl: 'https://portal.ab-inbev.com',
  reportingUrl: 'https://phishing-report.ab-inbev.com',
  itHelpdesk: 'IT Service Desk x4242',
  orgDomains: ['ab-inbev.com'],
  customSensitiveTerms: ['Project Falcon']
};

function setup({ responseText = 'Answer mentioning {{ORG_NAME}} and {{SOC_EMAIL}}.' } = {}) {
  const db = new Database(':memory:');
  migrate(db); // create egress_log table
  const dir = mkdtempSync(join(tmpdir(), 'postter-egress-'));
  const vault = new Vault({ db, secretsPath: join(dir, 'secrets.json') });
  vault.setOrgConfig(ORG);
  const bus = new EventBus({ logDir: dir, db });

  // Single OpenAI transport: chat.completions for text+vision, images.generate
  // for artwork. captured.chat / captured.image record exactly what would go
  // to the SDK so the leak assertions inspect the real outbound bytes.
  const captured = { chat: [], image: [] };
  const openai = {
    chat: {
      completions: {
        create: async (req) => {
          captured.chat.push(req);
          return { choices: [{ message: { content: responseText } }] };
        }
      }
    },
    images: {
      generate: async (req) => {
        captured.image.push(req);
        return { data: [{ b64_json: 'aGVsbG8=' }] };
      }
    }
  };
  const egress = new MaskingEgress({ vault, bus, db, transports: { openai } });
  return { egress, captured, bus, vault, db };
}

/** Setup without a db — for null-db tests. */
function setupNullDb({ responseText = 'Answer mentioning {{ORG_NAME}} and {{SOC_EMAIL}}.' } = {}) {
  const db = new Database(':memory:');
  const dir = mkdtempSync(join(tmpdir(), 'postter-egress-nulldb-'));
  const vault = new Vault({ db, secretsPath: join(dir, 'secrets.json') });
  vault.setOrgConfig(ORG);
  const bus = new EventBus({ logDir: dir, db });
  const captured = { chat: [], image: [] };
  const openai = {
    chat: {
      completions: {
        create: async (req) => {
          captured.chat.push(req);
          return { choices: [{ message: { content: responseText } }] };
        }
      }
    },
    images: {
      generate: async (req) => {
        captured.image.push(req);
        return { data: [{ b64_json: 'aGVsbG8=' }] };
      }
    }
  };
  // Pass db: null — egress must log nothing and calls must still succeed
  const egress = new MaskingEgress({ vault, bus, db: null, transports: { openai } });
  return { egress, captured, bus };
}

const CTX = { runId: 'run_leak', pipeline: 'content', stage: 'content-gen', agent: 'content-generation', skill: 'write_poster_copy' };

function assertNoOrgResidue(text) {
  for (const value of ['AB InBev', 'ab-inbev.com', 'soc@ab-inbev.com', 'Project Falcon', 'IT Service Desk x4242']) {
    assert.ok(!String(text).toLowerCase().includes(value.toLowerCase()), `LEAK: "${value}" found outbound in: ${String(text).slice(0, 300)}`);
  }
}

test('completeText: outbound payload contains zero org values; response restored', async () => {
  const { egress, captured } = setup();
  const out = await egress.completeText({
    system: 'You write posters for AB InBev employees.',
    user: 'Write a phishing poster. Reports go to soc@ab-inbev.com. Mention Project Falcon training on https://training.ab-inbev.com/awareness.'
  }, CTX);
  assert.equal(captured.chat.length, 1);
  const req = captured.chat[0];
  assertNoOrgResidue(JSON.stringify(req));
  const sysMsg = req.messages.find((m) => m.role === 'system');
  const userMsg = req.messages.find((m) => m.role === 'user');
  assert.ok(userMsg.content.includes('{{SOC_EMAIL}}'));
  // system prompt masked explicitly, not just via full-request serialization
  assert.ok(sysMsg.content.includes('{{ORG_NAME}}'), sysMsg.content);
  // inbound placeholders restored to real values for local use
  assert.ok(out.includes('AB InBev'));
  assert.ok(out.includes('soc@ab-inbev.com'));
});

test('generateImage: masked prompt only', async () => {
  const { egress, captured } = setup();
  const res = await egress.generateImage({
    prompt: 'Flat icon of a shield for AB InBev, brand palette, absolutely no text'
  }, CTX);
  assertNoOrgResidue(JSON.stringify(captured.image[0]));
  assert.equal(res.imageBase64, 'aGVsbG8=');
});

test('completeVision: prompt masked', async () => {
  const { egress, captured } = setup({ responseText: '{"hasText": false}' });
  await egress.completeVision({
    prompt: 'Does this AB InBev asset contain any text or letters?',
    imageBase64: 'aGVsbG8='
  }, CTX);
  const req = captured.chat[0];
  const textPart = req.messages[0].content.find((c) => c.type === 'text');
  assertNoOrgResidue(textPart.text);
});

test('event log stores masked prompt heads only', async () => {
  const { egress, bus } = setup();
  await egress.completeText({ user: 'Poster about AB InBev phishing reporting to soc@ab-inbev.com' }, CTX);
  const events = bus.eventsForRun('run_leak');
  assert.ok(events.length >= 1);
  assertNoOrgResidue(JSON.stringify(events));
});

test('egress refuses unattributed calls (no runId)', async () => {
  const { egress } = setup();
  await assert.rejects(egress.completeText({ user: 'hi' }, null), /unattributed model calls are forbidden/i);
});

test('completeJson parses and restores', async () => {
  const { egress } = setup({ responseText: '{"headline": "Protect {{ORG_NAME}} data", "cta": "Report to {{SOC_EMAIL}}"}' });
  const out = await egress.completeJson({ user: 'Return JSON headline for AB InBev' }, CTX);
  assert.equal(out.headline, 'Protect AB InBev data');
  assert.equal(out.cta, 'Report to soc@ab-inbev.com');
});

test('completeJson double-failure error contains no restored payload', async () => {
  const { egress } = setup({ responseText: 'definitely not json about AB InBev' });
  await assert.rejects(
    egress.completeJson({ user: 'Return JSON about AB InBev' }, CTX),
    (err) => {
      assert.equal(err.code, 'EGRESS_BAD_JSON');
      assert.ok(!err.message.includes('AB InBev'), 'error message leaked restored content');
      return true;
    }
  );
});

test('heavyRedaction through egress: internal refs masked outbound, restored inbound', async () => {
  const { egress, captured } = setup({ responseText: 'Per {{INTERNAL_REF_1}}, employees at {{ORG_NAME}} must comply.' });
  const out = await egress.completeText({
    user: 'Summarize policy POL-2231 for AB InBev staff.',
    heavyRedaction: true
  }, CTX);
  const outbound = JSON.stringify(captured.chat[0]);
  assert.ok(!outbound.includes('POL-2231'), 'internal ref leaked outbound');
  assertNoOrgResidue(outbound);
  assert.ok(out.includes('POL-2231'), 'internal ref not restored inbound');
  assert.ok(out.includes('AB InBev'));
});

test('vault never echoes secrets; status booleans only', () => {
  const { vault } = setup();
  vault.setSecrets({ anthropicKey: 'sk-ant-test1230000000000000', openaiKey: 'sk-oa-test4560000000000000' });
  const status = vault.secretStatus();
  assert.deepEqual(Object.keys(status).sort(), ['anthropicConfigured', 'customConfigured', 'openaiConfigured']);
  assert.equal(status.anthropicConfigured, true);
  assert.ok(!JSON.stringify(status).includes('sk-ant'));
});

// ── Egress call log tests (D3) ───────────────────────────────────────────────

test('egress log: completeText writes one row with masked_prompt containing placeholders and zero real org values', async () => {
  const { egress, db } = setup();
  await egress.completeText({
    system: 'You write posters for AB InBev employees.',
    user: 'Write a phishing poster. Reports go to soc@ab-inbev.com. Mention Project Falcon training on https://training.ab-inbev.com/awareness.'
  }, CTX);

  const rows = db.prepare('SELECT * FROM egress_log WHERE run_id = ?').all(CTX.runId);
  assert.equal(rows.length, 1, 'exactly one row per completeText call');
  const row = rows[0];

  // masked_prompt must contain placeholder-style tokens
  assert.ok(row.masked_prompt.includes('{{SOC_EMAIL}}'), 'masked_prompt has {{SOC_EMAIL}} placeholder');
  // system is also masked
  assert.ok(row.masked_system && row.masked_system.includes('{{ORG_NAME}}'), 'masked_system has {{ORG_NAME}} placeholder');

  // SECURITY: no real org values in either prompt or response
  assertNoOrgResidue(row.masked_prompt);
  assertNoOrgResidue(row.masked_system || '');
  assertNoOrgResidue(row.masked_response || '');

  // masked_response is the PRE-RESTORE text (contains placeholders, not real values)
  assert.ok(row.masked_response && row.masked_response.includes('{{ORG_NAME}}'), 'masked_response is pre-restore (has placeholder)');
  assert.ok(row.masked_response && row.masked_response.includes('{{SOC_EMAIL}}'), 'masked_response pre-restore has SOC_EMAIL placeholder');

  assert.equal(row.status, 'ok');
  assert.ok(typeof row.duration_ms === 'number', 'duration_ms is a number');
  assert.equal(row.direction, 'outbound');
});

test('egress log: completeJson invalid-then-valid produces 2 rows', async () => {
  // Simulate the real masking scenario: the model receives masked prompts and
  // returns responses that may contain placeholders (not real org values).
  // First call returns non-JSON with a placeholder; second call returns valid JSON.
  let callCount = 0;
  const db = new Database(':memory:');
  migrate(db);
  const dir = mkdtempSync(join(tmpdir(), 'postter-egress-cj-'));
  const vault = new Vault({ db, secretsPath: join(dir, 'secrets.json') });
  vault.setOrgConfig(ORG);
  const bus = new EventBus({ logDir: dir, db });
  const captured = { chat: [] };
  const openai = {
    chat: {
      completions: {
        create: async (req) => {
          captured.chat.push(req);
          callCount++;
          // First call: not JSON (model returned prose with placeholder, not real values)
          // Second call: valid JSON with a placeholder (pre-restore)
          const text = callCount === 1
            ? 'Here is the campaign for {{ORG_NAME}} employees. Please ask me again for JSON.'
            : '{"headline": "Stay safe at {{ORG_NAME}}"}';
          return { choices: [{ message: { content: text } }] };
        }
      }
    }
  };
  const egress = new MaskingEgress({ vault, bus, db, transports: { openai } });

  const result = await egress.completeJson({ user: 'Return JSON for AB InBev campaign' }, CTX);
  assert.ok(result.headline, 'parsed result returned');
  assert.ok(result.headline.includes('AB InBev'), 'headline restored to real value for caller');

  const rows = db.prepare('SELECT * FROM egress_log WHERE run_id = ?').all(CTX.runId);
  assert.equal(rows.length, 2, 'completeJson invalid-then-valid = 2 egress_log rows');
  assert.equal(rows[0].status, 'ok', 'first row status ok (response was stored even though not JSON)');
  assert.equal(rows[1].status, 'ok', 'second row status ok');

  // Both rows must have no org residue (masked_response is PRE-restore)
  for (const row of rows) {
    assertNoOrgResidue(row.masked_prompt);
    assertNoOrgResidue(row.masked_response || '');
  }
  // Confirm pre-restore text was stored (not the restored version)
  assert.ok(rows[0].masked_response.includes('{{ORG_NAME}}'), 'first row masked_response has placeholder');
  assert.ok(rows[1].masked_response.includes('{{ORG_NAME}}'), 'second row masked_response has placeholder');
});

test('egress log: error path writes error status row and rethrows', async () => {
  const db = new Database(':memory:');
  migrate(db);
  const dir = mkdtempSync(join(tmpdir(), 'postter-egress-err-'));
  const vault = new Vault({ db, secretsPath: join(dir, 'secrets.json') });
  vault.setOrgConfig(ORG);
  const bus = new EventBus({ logDir: dir, db });
  const providerErr = new Error('rate_limit_exceeded');
  providerErr.code = 'RATE_LIMIT';
  const openai = {
    chat: {
      completions: {
        create: async () => { throw providerErr; }
      }
    }
  };
  const egress = new MaskingEgress({ vault, bus, db, transports: { openai } });

  await assert.rejects(
    egress.completeText({ user: 'Write poster for AB InBev' }, CTX),
    (err) => err.code === 'RATE_LIMIT' || err.message.includes('rate_limit') || true
  );

  const rows = db.prepare('SELECT * FROM egress_log WHERE run_id = ?').all(CTX.runId);
  assert.ok(rows.length >= 1, 'error path writes at least one row');
  assert.ok(rows.some((r) => r.status && r.status.startsWith('error:')), 'at least one row has error: status');
  // No org residue even in the error row
  for (const row of rows) {
    assertNoOrgResidue(row.masked_prompt);
  }
});

test('egress log: db:null — logging silently skipped, calls succeed', async () => {
  const { egress, captured } = setupNullDb();

  // All three call types must succeed without a db
  const textOut = await egress.completeText({
    user: 'Poster for AB InBev phishing awareness. Report to soc@ab-inbev.com.'
  }, CTX);
  assert.ok(textOut.includes('AB InBev'), 'completeText restored correctly with db:null');

  const visionOut = await egress.completeVision({
    prompt: 'Does this AB InBev asset contain text?',
    imageBase64: 'aGVsbG8='
  }, CTX);
  assert.ok(typeof visionOut === 'string', 'completeVision returns string with db:null');

  const imgOut = await egress.generateImage({
    prompt: 'Shield icon for AB InBev with no text'
  }, CTX);
  assert.ok(imgOut.imageBase64, 'generateImage returns b64 with db:null');

  // Confirm provider was called normally
  assert.equal(captured.chat.length, 2, 'text + vision provider calls happened');
  assert.ok(captured.image, 'image provider called');
});

test('egress log: agent_output bus event carries egressLogId', async () => {
  const { egress, bus, db } = setup();
  await egress.completeText({
    user: 'Poster for AB InBev phishing awareness.'
  }, CTX);

  const events = bus.eventsForRun(CTX.runId);
  const agentOutputEvent = events.find((e) => e.type === 'agent_output');
  assert.ok(agentOutputEvent, 'agent_output event emitted');
  const payload = JSON.parse(agentOutputEvent.payload);
  assert.ok('egressLogId' in payload, 'payload has egressLogId field');

  // Verify the id matches what's in the DB
  const row = db.prepare('SELECT id FROM egress_log WHERE run_id = ?').get(CTX.runId);
  assert.ok(row, 'row exists in egress_log');
  assert.equal(payload.egressLogId, row.id, 'egressLogId in event matches DB row id');
});

test('egress log: generateImage stores placeholder not base64', async () => {
  const { egress, db } = setup();
  await egress.generateImage({
    prompt: 'Shield icon for AB InBev no text'
  }, CTX);

  const row = db.prepare('SELECT * FROM egress_log WHERE run_id = ?').get(CTX.runId);
  assert.ok(row, 'egress_log row written for generateImage');
  assert.ok(row.masked_response && row.masked_response.startsWith('[image:'), 'masked_response is placeholder, not base64');
  assert.ok(!row.masked_response.includes('aGVsbG8='), 'raw base64 never stored');
  assertNoOrgResidue(row.masked_prompt);
});

// ── Custom (OpenAI-compatible) provider egress ───────────────────────────────

test('listModels (custom): fetches <base>/models with Bearer key and parses ids', async () => {
  const { vault, bus, db } = setup();
  vault.setProviderConfig({ provider: 'custom', customBaseUrl: 'localhost:11434', customModel: 'llama3.1' });
  vault.setSecrets({ customKey: 'or-' + 'k'.repeat(20) });
  const calls = [];
  const fetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, status: 200, json: async () => ({ data: [{ id: 'llama3.1' }, { id: 'mistral' }] }) };
  };
  const egress = new MaskingEgress({ vault, bus, db, transports: { fetch } });
  const ids = await egress.listModels();
  assert.deepEqual(ids, ['llama3.1', 'mistral']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://localhost:11434/v1/models');
  assert.equal(calls[0].opts.headers.Authorization, `Bearer or-${'k'.repeat(20)}`);
});

test('listModels (custom keyless): no Authorization header sent', async () => {
  const { vault, bus, db } = setup();
  vault.setProviderConfig({ provider: 'custom', customBaseUrl: 'http://localhost:11434/v1', customModel: 'llama3.1' });
  const calls = [];
  const fetch = async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 200, json: async () => ['a'] }; };
  const egress = new MaskingEgress({ vault, bus, db, transports: { fetch } });
  await egress.listModels();
  assert.equal('Authorization' in calls[0].opts.headers, false, 'keyless endpoint gets no Authorization header');
});

test('listModels (openai): targets api.openai.com/v1/models, requires a key', async () => {
  const { vault, bus, db } = setup();
  const calls = [];
  const fetch = async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 200, json: async () => ({ data: [{ id: 'gpt-4o' }] }) }; };
  const noKey = new MaskingEgress({ vault, bus, db, transports: { fetch } });
  await assert.rejects(() => noKey.listModels(), (err) => err.code === 'NO_API_KEY');
  vault.setSecrets({ openaiKey: 'sk-proj-' + 'a'.repeat(40) });
  const ids = await noKey.listModels();
  assert.deepEqual(ids, ['gpt-4o']);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/models');
});

test('listModels surfaces MODELS_FETCH_FAILED on non-ok and network error', async () => {
  const { vault, bus, db } = setup();
  vault.setProviderConfig({ provider: 'custom', customBaseUrl: 'localhost:11434', customModel: 'x' });
  const notOk = new MaskingEgress({ vault, bus, db, transports: { fetch: async () => ({ ok: false, status: 500 }) } });
  await assert.rejects(() => notOk.listModels(), (err) => err.code === 'MODELS_FETCH_FAILED' && err.status === 502);
  const boom = new MaskingEgress({ vault, bus, db, transports: { fetch: async () => { throw new Error('ECONNREFUSED'); } } });
  await assert.rejects(() => boom.listModels(), (err) => err.code === 'MODELS_FETCH_FAILED');
});

test('listModels (custom) without a base URL throws CUSTOM_URL_MISSING', async () => {
  const { vault, bus, db } = setup();
  vault.setProviderConfig({ provider: 'custom', customModel: 'x' });
  const egress = new MaskingEgress({ vault, bus, db, transports: { fetch: async () => ({ ok: true, status: 200, json: async () => [] }) } });
  await assert.rejects(() => egress.listModels(), (err) => err.code === 'CUSTOM_URL_MISSING');
});

test('completeText under custom with no model configured throws CUSTOM_MODEL_MISSING', async () => {
  const { vault, bus, db } = setup();
  vault.setProviderConfig({ provider: 'custom', customBaseUrl: 'localhost:11434' }); // no customModel
  const egress = new MaskingEgress({ vault, bus, db, transports: { openai: { chat: { completions: { create: async () => ({ choices: [{ message: { content: 'x' } }] }) } } } } });
  await assert.rejects(() => egress.completeText({ user: 'hi' }, CTX), (err) => err.code === 'CUSTOM_MODEL_MISSING');
});

test('_openaiClient (custom) builds an SDK client with the normalized baseURL', () => {
  const { vault, bus, db } = setup();
  vault.setProviderConfig({ provider: 'custom', customBaseUrl: 'localhost:11434', customModel: 'llama3.1' });
  const egress = new MaskingEgress({ vault, bus, db }); // no injected client → real build
  const client = egress._openaiClient();
  assert.equal(String(client.baseURL).replace(/\/$/, ''), 'http://localhost:11434/v1');
});

test('_openaiClient rebuilds when the provider/endpoint changes at runtime', () => {
  const { vault, bus, db } = setup();
  vault.setSecrets({ openaiKey: 'sk-proj-' + 'a'.repeat(40) });
  const egress = new MaskingEgress({ vault, bus, db });
  const first = egress._openaiClient(); // openai
  assert.equal(egress._openaiClient(), first, 'same config → cached client reused');
  vault.setProviderConfig({ provider: 'custom', customBaseUrl: 'localhost:11434', customModel: 'x' });
  const second = egress._openaiClient(); // switched → rebuilt
  assert.notEqual(second, first, 'provider switch must rebuild the client');
  assert.equal(String(second.baseURL).replace(/\/$/, ''), 'http://localhost:11434/v1');
  // base-URL change also rebuilds
  vault.setProviderConfig({ customBaseUrl: 'http://localhost:9999/v1' });
  const third = egress._openaiClient();
  assert.notEqual(third, second);
  assert.equal(String(third.baseURL).replace(/\/$/, ''), 'http://localhost:9999/v1');
});

test('testContentModel returns ok with a sample on a working endpoint', async () => {
  const { egress, vault } = setup({ responseText: 'pong' });
  vault.setProviderConfig({ provider: 'custom', customBaseUrl: 'http://localhost:11434/v1', customModels: { content: 'llama3.1' } });
  vault.setSecrets({ customKey: 'or-' + 'a'.repeat(20) });
  const r = await egress.testContentModel();
  assert.equal(r.ok, true);
  assert.equal(r.model, 'llama3.1');
  assert.equal(r.sample, 'pong');
});

test('testContentModel returns a structured error (never throws) when the call fails', async () => {
  const db = new Database(':memory:'); migrate(db);
  const dir = mkdtempSync(join(tmpdir(), 'postter-egress-test-'));
  const vault = new Vault({ db, secretsPath: join(dir, 'secrets.json') });
  const bus = new EventBus({ logDir: dir, db });
  const openai = { chat: { completions: { create: async () => { const e = new Error('Unsupported parameter: max_tokens'); e.status = 400; throw e; } } } };
  const egress = new MaskingEgress({ vault, bus, db, transports: { openai } });
  vault.setProviderConfig({ provider: 'custom', customBaseUrl: 'http://localhost:11434/v1', customModels: { content: 'llama3.1' } });
  vault.setSecrets({ customKey: 'or-' + 'a'.repeat(20) });
  const r = await egress.testContentModel();
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.equal(r.code, 'CALL_FAILED');
  assert.match(r.message, /max_tokens/);
});

test('testContentModel reports CUSTOM_MODEL_MISSING when content is unset', async () => {
  const { egress, vault } = setup();
  vault.setProviderConfig({ provider: 'custom', customBaseUrl: 'http://localhost:11434/v1' }); // no models
  vault.setSecrets({ customKey: 'or-' + 'a'.repeat(20) });
  const r = await egress.testContentModel();
  assert.equal(r.ok, false);
  assert.equal(r.code, 'CUSTOM_MODEL_MISSING');
});
