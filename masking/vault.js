// Org config vault: the single server-side store for organization details
// (spec §B.12 config page). These values are re-inserted into model responses
// locally and are used to VERIFY nothing real leaves — they are never sent to
// any model and never serialized anywhere except the config page API.
//
// API keys live here too (data/secrets, not the DB) — never logged, never
// returned to the client after being set (only a boolean "configured" flag).

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

export const ORG_CONFIG_FIELDS = [
  'companyName', 'socEmail', 'trainingPortalUrl', 'contentPortalUrl',
  'reportingUrl', 'itHelpdesk'
];

// Single-provider (OpenAI) model selection (spec: content + images from one
// key). The user picks a model per ROLE on the Config page; the egress reads
// these. MODEL_OPTIONS is the curated allow-list the dropdowns offer AND the
// validation set (an off-list model id is rejected so a typo can't silently
// break every call). All options accept the chat params the egress sends.
export const MODEL_ROLES = ['content', 'vision', 'image'];
export const MODEL_OPTIONS = {
  content: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
  vision: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1'],
  image: ['gpt-image-1']
};
export const DEFAULT_MODEL_SELECTION = { content: 'gpt-4o', vision: 'gpt-4o', image: 'gpt-image-1' };

// Provider selection. 'openai' = the built-in api.openai.com path (per-role
// models from MODEL_OPTIONS). 'custom' = any OpenAI-compatible endpoint
// (Ollama / OpenRouter / LiteLLM / vLLM / Groq / …) reached via a base-URL
// override + a single free-form model id (no allow-list — the endpoint decides
// what it serves). See masking/provider-url.js for base-URL normalization.
export const PROVIDERS = ['openai', 'custom'];
export const DEFAULT_PROVIDER_CONFIG = {
  provider: 'openai',
  customBaseUrl: '',
  customModels: { content: '', vision: '', image: '' }
};

/**
 * Shape-validate an API key BEFORE it is stored. This is the guard that stops
 * pasted PROSE (e.g. a page's error banner) or a truncated key from silently
 * becoming a "configured" secret that then fails every model call with an
 * opaque NO_API_KEY. It deliberately stays LENIENT — it must never reject a
 * real key, so it checks only structural facts true of every provider key:
 *   - non-empty, no internal whitespace (real keys are a single token)
 *   - a sane minimum length
 *   - the universal `sk-` prefix (both Anthropic `sk-ant-…` and OpenAI
 *     `sk-…`/`sk-proj-…` use it) — provider-specific sub-prefixes are NOT
 *     enforced, so an unusual-but-real key is never blocked.
 * The CUSTOM provider (OpenAI-compatible endpoints: Ollama / OpenRouter /
 * LiteLLM / vLLM / Groq / …) uses arbitrary key formats — no `sk-` prefix and
 * often shorter tokens — so it only checks non-empty + no-whitespace + a small
 * minimum. A keyless custom endpoint (local Ollama) is set by clearing the key
 * (handled in setSecrets), never by passing a blank one here.
 * Returns null when valid, else a human reason.
 */
export function validateApiKey(provider, key) {
  const k = String(key ?? '').trim();
  if (!k) return 'is empty';
  if (/\s/.test(k)) return 'contains spaces or line breaks — paste only the key token';
  if (provider === 'custom') {
    if (k.length < 16) return `is too short (${k.length} chars) to be a valid key`;
    return null; // custom endpoints don't use the sk- prefix
  }
  if (k.length < 20) return `is too short (${k.length} chars) to be a valid key`;
  if (!k.startsWith('sk-')) return 'must start with "sk-" (paste the API key, not a URL or other text)';
  return null;
}

export class Vault {
  constructor({ db, secretsPath }) {
    this.db = db;
    this.secretsPath = secretsPath;
    db.exec(`CREATE TABLE IF NOT EXISTS org_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`);
    this._get = db.prepare('SELECT value FROM org_config WHERE key = ?');
    this._set = db.prepare(`INSERT INTO org_config (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`);
  }

  getOrgConfig() {
    const cfg = {};
    for (const key of ORG_CONFIG_FIELDS) {
      const row = this._get.get(key);
      cfg[key] = row ? JSON.parse(row.value) : '';
    }
    for (const key of ['orgDomains', 'customSensitiveTerms']) {
      const row = this._get.get(key);
      cfg[key] = row ? JSON.parse(row.value) : [];
    }
    const brand = this._get.get('brandOverride');
    cfg.brandOverride = brand ? JSON.parse(brand.value) : null;
    return cfg;
  }

  setOrgConfig(partial) {
    const now = new Date().toISOString();
    const allowed = new Set([...ORG_CONFIG_FIELDS, 'orgDomains', 'customSensitiveTerms', 'brandOverride']);
    for (const [key, value] of Object.entries(partial || {})) {
      if (!allowed.has(key)) continue; // whitelist — reference repo pattern
      this._set.run(key, JSON.stringify(value ?? ''), now);
    }
    return this.getOrgConfig();
  }

  // ---- provider selection (openai | custom OpenAI-compatible endpoint) ----

  /** Current provider config: { provider, customBaseUrl, customModels:{content,vision,image} }. */
  getProviderConfig() {
    const row = this._get.get('providerConfig');
    const stored = row ? JSON.parse(row.value) : {};
    const provider = PROVIDERS.includes(stored.provider) ? stored.provider : DEFAULT_PROVIDER_CONFIG.provider;
    const customBaseUrl = typeof stored.customBaseUrl === 'string' ? stored.customBaseUrl : '';
    // Migration: a legacy single `customModel` seeds all three roles so an
    // existing custom setup keeps working after the per-role split.
    const legacy = typeof stored.customModel === 'string' ? stored.customModel : '';
    const cm = (stored.customModels && typeof stored.customModels === 'object') ? stored.customModels : {};
    const pick = (role) => (typeof cm[role] === 'string' && cm[role]) ? cm[role] : legacy;
    return {
      provider,
      customBaseUrl,
      customModels: { content: pick('content'), vision: pick('vision'), image: pick('image') }
    };
  }

  /**
   * Update provider selection. `provider` must be one of PROVIDERS (rejects
   * typos that would silently route calls nowhere). customBaseUrl/customModel
   * are stored verbatim (trimmed); base-URL well-formedness is enforced at the
   * egress boundary (provider-url.js) where it's actually used. Returns the
   * full effective config.
   */
  setProviderConfig(partial) {
    const next = { ...this.getProviderConfig() };
    next.customModels = { ...next.customModels };
    if (partial && 'provider' in partial) {
      if (!PROVIDERS.includes(partial.provider)) {
        const err = new Error(`"${partial.provider}" is not a valid provider (choose one of: ${PROVIDERS.join(', ')})`);
        err.code = 'PROVIDER_INVALID';
        err.status = 400;
        throw err;
      }
      next.provider = partial.provider;
    }
    if (partial && typeof partial.customBaseUrl === 'string') next.customBaseUrl = partial.customBaseUrl.trim();
    // Legacy alias: a flat customModel string writes the content role.
    if (partial && typeof partial.customModel === 'string') next.customModels.content = partial.customModel.trim();
    if (partial && partial.customModels && typeof partial.customModels === 'object') {
      for (const role of MODEL_ROLES) {
        if (typeof partial.customModels[role] === 'string') next.customModels[role] = partial.customModels[role].trim();
      }
    }
    // Persist WITHOUT the legacy flat key so reads use the per-role shape.
    this._set.run('providerConfig', JSON.stringify({
      provider: next.provider, customBaseUrl: next.customBaseUrl, customModels: next.customModels
    }), new Date().toISOString());
    return next;
  }

  // ---- model selection (per role for OpenAI; single free-form id for custom) ----

  /**
   * Selected model per role. For the CUSTOM provider the allow-list is bypassed
   * — every role resolves to the single free-form customModel (the endpoint,
   * not poster-app, decides what model ids are valid). For OpenAI, each role
   * falls back to its default for unset/off-list rows.
   */
  getModels() {
    const pc = this.getProviderConfig();
    if (pc.provider === 'custom') {
      const cm = pc.customModels || {};
      const content = cm.content || '';
      return {
        content,
        vision: cm.vision || content,
        image: cm.image || content
      };
    }
    const row = this._get.get('models');
    const stored = row ? JSON.parse(row.value) : {};
    const out = {};
    for (const role of MODEL_ROLES) {
      out[role] = MODEL_OPTIONS[role].includes(stored[role]) ? stored[role] : DEFAULT_MODEL_SELECTION[role];
    }
    return out;
  }

  /**
   * Set the model for one or more roles. Each provided value must be in that
   * role's allow-list (rejects typos/off-list ids that would break calls).
   * Returns the full effective selection.
   */
  setModels(partial) {
    const current = this.getModels();
    const next = { ...current };
    for (const [role, value] of Object.entries(partial || {})) {
      if (!MODEL_ROLES.includes(role)) continue;
      if (!MODEL_OPTIONS[role].includes(value)) {
        const err = new Error(`"${value}" is not a valid ${role} model (choose one of: ${MODEL_OPTIONS[role].join(', ')})`);
        err.code = 'MODEL_INVALID';
        err.status = 400;
        throw err;
      }
      next[role] = value;
    }
    this._set.run('models', JSON.stringify(next), new Date().toISOString());
    return next;
  }

  // ---- secrets (API keys) ----

  _readSecrets() {
    if (!existsSync(this.secretsPath)) return {};
    try {
      return JSON.parse(readFileSync(this.secretsPath, 'utf8'));
    } catch {
      // NEVER swallow corruption silently — a later setSecrets() would clobber
      // whichever key the user didn't re-enter. Message names the file, never
      // its contents.
      const err = new Error(`Secrets file at ${this.secretsPath} is corrupted (invalid JSON). Delete it and re-enter API keys on the Config page.`);
      err.code = 'SECRETS_CORRUPTED';
      throw err;
    }
  }

  /**
   * Set API keys. Never logged; never echoed back. Atomic write (tmp+rename)
   * so a crash mid-write can't corrupt existing keys. Note: mode 0o600 is a
   * no-op on Windows (ACLs apply); the server binds 127.0.0.1 and the data
   * dir is expected to be user-profile-scoped.
   */
  setSecrets({ anthropicKey, openaiKey, customKey } = {}) {
    // Only non-empty provided keys are considered; each is shape-validated and
    // the whole call is rejected atomically if any fails, so a bad paste never
    // half-writes a "configured" secret that then errors on the first call.
    const provided = [];
    if (typeof anthropicKey === 'string' && anthropicKey.trim()) provided.push(['anthropic', 'anthropicKey', anthropicKey.trim()]);
    if (typeof openaiKey === 'string' && openaiKey.trim()) provided.push(['openai', 'openaiKey', openaiKey.trim()]);
    if (typeof customKey === 'string' && customKey.trim()) provided.push(['custom', 'customKey', customKey.trim()]);
    // An explicit blank customKey CLEARS it — this is how a keyless custom
    // endpoint (e.g. local Ollama, no Authorization header) is configured.
    // Only custom supports keyless; blank anthropic/openai keys are ignored.
    const clearCustomKey = typeof customKey === 'string' && !customKey.trim();
    if (!provided.length && !clearCustomKey) {
      const err = new Error('No API key provided.');
      err.code = 'SECRET_INVALID';
      err.status = 400;
      throw err;
    }
    const invalid = provided
      .map(([provider, , value]) => ({ provider, reason: validateApiKey(provider, value) }))
      .filter((r) => r.reason);
    if (invalid.length) {
      const label = { anthropic: 'Anthropic', openai: 'OpenAI', custom: 'Custom' };
      const err = new Error(invalid.map((r) => `${label[r.provider]} key ${r.reason}`).join('; '));
      err.code = 'SECRET_INVALID';
      err.status = 400;
      err.fields = invalid.map((r) => r.provider);
      throw err;
    }
    mkdirSync(dirname(this.secretsPath), { recursive: true });
    const current = this._readSecrets();
    for (const [, field, value] of provided) current[field] = value;
    if (clearCustomKey) current.customKey = '';
    const tmpPath = `${this.secretsPath}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(current), { mode: 0o600 });
    renameSync(tmpPath, this.secretsPath);
    return this.secretStatus();
  }

  /** Env vars win so ops can inject keys without touching disk. */
  getSecrets() {
    const disk = this._readSecrets();
    return {
      anthropicKey: process.env.ANTHROPIC_API_KEY || disk.anthropicKey || '',
      openaiKey: process.env.OPENAI_API_KEY || disk.openaiKey || '',
      customKey: process.env.CUSTOM_API_KEY || disk.customKey || ''
    };
  }

  /** What the config UI is allowed to see: booleans only. */
  secretStatus() {
    const s = this.getSecrets();
    return {
      anthropicConfigured: Boolean(s.anthropicKey),
      openaiConfigured: Boolean(s.openaiKey),
      customConfigured: Boolean(s.customKey)
    };
  }
}

export function defaultSecretsPath(dataDir) {
  return join(dataDir, 'secrets.json');
}
