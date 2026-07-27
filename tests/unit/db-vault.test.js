// Migration idempotency + vault integration tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migrate } from '../../backend/db.js';
import { Vault, validateApiKey, DEFAULT_MODEL_SELECTION, MODEL_OPTIONS, DEFAULT_PROVIDER_CONFIG } from '../../masking/vault.js';

test('migrate is idempotent: re-running applies nothing new', () => {
  const db = new Database(':memory:');
  migrate(db);
  const firstCount = db.prepare('SELECT COUNT(*) AS n FROM schema_version').get().n;
  assert.ok(firstCount >= 1);
  migrate(db); // second run must be a no-op
  const secondCount = db.prepare('SELECT COUNT(*) AS n FROM schema_version').get().n;
  assert.equal(secondCount, firstCount);
  // schema functional after double-migrate
  db.prepare("INSERT INTO articles (title, url_hash, fetched_at) VALUES ('t', 'h1', '2026-07-15')").run();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM articles').get().n, 1);
});

test('FTS index stays in sync through insert/update/delete triggers', () => {
  const db = new Database(':memory:');
  migrate(db);
  db.prepare("INSERT INTO articles (title, description, url_hash, fetched_at) VALUES ('Phishing wave hits banks', 'Credential theft campaign', 'h2', '2026-07-15')").run();
  let rows = db.prepare("SELECT rowid FROM articles_fts WHERE articles_fts MATCH 'phishing'").all();
  assert.equal(rows.length, 1);
  db.prepare("UPDATE articles SET title = 'Ransomware wave hits banks' WHERE url_hash = 'h2'").run();
  rows = db.prepare("SELECT rowid FROM articles_fts WHERE articles_fts MATCH 'phishing'").all();
  assert.equal(rows.length, 0);
  rows = db.prepare("SELECT rowid FROM articles_fts WHERE articles_fts MATCH 'ransomware'").all();
  assert.equal(rows.length, 1);
  db.prepare("DELETE FROM articles WHERE url_hash = 'h2'").run();
  rows = db.prepare("SELECT rowid FROM articles_fts WHERE articles_fts MATCH 'ransomware'").all();
  assert.equal(rows.length, 0);
});

test('validateApiKey rejects prose, whitespace, short, and wrong-prefix keys; accepts real shapes', () => {
  const BANNER = 'This tab is not authorized — open the tokenized URL printed in the server terminal (use 127.0.0.1, not localhost) to set the session cookie, then reload this page. Saving is blocked until then.';
  // the exact bug: a pasted banner sentence must never validate
  assert.match(validateApiKey('openai', BANNER), /spaces or line breaks/);
  assert.match(validateApiKey('anthropic', 'sk-ant test key with spaces'), /spaces/);
  assert.match(validateApiKey('anthropic', 'sk-ant-short'), /too short/);
  assert.match(validateApiKey('anthropic', 'wrongprefix000000000000000'), /sk-/);
  assert.match(validateApiKey('openai', 'ghp_000000000000000000000'), /sk-/);
  assert.equal(validateApiKey('anthropic', ''), 'is empty');
  // valid shapes pass — provider-specific sub-prefixes are NOT required, so a
  // real key is never false-rejected (only prose/whitespace/short/no-sk- fail)
  assert.equal(validateApiKey('anthropic', 'sk-ant-api03-' + 'a'.repeat(40)), null);
  assert.equal(validateApiKey('openai', 'sk-proj-' + 'b'.repeat(40)), null);
  assert.equal(validateApiKey('anthropic', 'sk-' + 'x'.repeat(40)), null);
});

test('getModels returns defaults until set; setModels validates against the allow-list', () => {
  const vault = new Vault({ db: new Database(':memory:') });
  // defaults before anything is stored
  assert.deepEqual(vault.getModels(), DEFAULT_MODEL_SELECTION);
  // valid per-role update persists and merges (unset roles keep defaults)
  const next = vault.setModels({ content: 'gpt-4o-mini' });
  assert.equal(next.content, 'gpt-4o-mini');
  assert.equal(next.vision, DEFAULT_MODEL_SELECTION.vision);
  assert.equal(vault.getModels().content, 'gpt-4o-mini');
  // off-list model rejected with a 400 MODEL_INVALID, nothing changed
  assert.throws(
    () => vault.setModels({ content: 'gpt-5-ultra' }),
    (err) => err.code === 'MODEL_INVALID' && err.status === 400 && /valid content model/.test(err.message)
  );
  assert.equal(vault.getModels().content, 'gpt-4o-mini', 'rejected model must not overwrite the stored one');
  // every advertised option is itself accepted (dropdown can never offer an invalid pick)
  for (const role of Object.keys(MODEL_OPTIONS)) {
    for (const m of MODEL_OPTIONS[role]) {
      assert.equal(vault.setModels({ [role]: m })[role], m);
    }
  }
});

// ── Custom (OpenAI-compatible) provider ──────────────────────────────────────

function freshVault() {
  return new Vault({ db: new Database(':memory:') });
}

test('provider config defaults to openai and round-trips custom per-role selection', () => {
  const vault = freshVault();
  assert.deepEqual(vault.getProviderConfig(), DEFAULT_PROVIDER_CONFIG);
  const next = vault.setProviderConfig({
    provider: 'custom',
    customBaseUrl: '  http://localhost:11434/v1  ',
    customModels: { content: '  llama3.1  ', vision: ' llava ', image: ' sdxl ' }
  });
  assert.deepEqual(next, {
    provider: 'custom',
    customBaseUrl: 'http://localhost:11434/v1',
    customModels: { content: 'llama3.1', vision: 'llava', image: 'sdxl' }
  });
  assert.deepEqual(vault.getProviderConfig(), next);
  // partial update keeps untouched fields
  const back = vault.setProviderConfig({ provider: 'openai' });
  assert.equal(back.provider, 'openai');
  assert.equal(back.customBaseUrl, 'http://localhost:11434/v1');
  assert.equal(back.customModels.content, 'llama3.1');
});

test('legacy customModel input aliases to customModels.content and mirrors unset roles', () => {
  const vault = freshVault();
  vault.setProviderConfig({ provider: 'custom', customModel: 'my-org/mixtral-8x7b' });
  // vision/image unset -> fall back to content in getModels
  assert.deepEqual(vault.getModels(), {
    content: 'my-org/mixtral-8x7b', vision: 'my-org/mixtral-8x7b', image: 'my-org/mixtral-8x7b'
  });
});

test('getModels resolves per-role under custom, falling back to content for empty roles', () => {
  const vault = freshVault();
  vault.setProviderConfig({ provider: 'custom', customModels: { content: 'llama3.1', image: 'sdxl' } });
  assert.deepEqual(vault.getModels(), { content: 'llama3.1', vision: 'llama3.1', image: 'sdxl' });
  // switching back to openai restores allow-list + prior per-role storage
  vault.setModels({ content: 'gpt-4o-mini' });
  vault.setProviderConfig({ provider: 'openai' });
  assert.equal(vault.getModels().content, 'gpt-4o-mini');
});

test('setProviderConfig rejects an unknown provider with 400 PROVIDER_INVALID', () => {
  const vault = freshVault();
  assert.throws(
    () => vault.setProviderConfig({ provider: 'gemini' }),
    (err) => err.code === 'PROVIDER_INVALID' && err.status === 400
  );
  assert.equal(vault.getProviderConfig().provider, 'openai', 'rejected provider must not persist');
});

test('validateApiKey accepts non-sk custom keys but still rejects prose/whitespace/too-short', () => {
  assert.equal(validateApiKey('custom', 'or-' + 'a'.repeat(20)), null); // OpenRouter-style, no sk-
  assert.equal(validateApiKey('custom', 'sk-' + 'b'.repeat(40)), null); // sk- also fine
  assert.match(validateApiKey('custom', 'short'), /too short/);
  assert.match(validateApiKey('custom', 'has spaces in it here now'), /spaces/);
  assert.equal(validateApiKey('custom', ''), 'is empty');
});

