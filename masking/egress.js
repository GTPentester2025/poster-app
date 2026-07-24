// THE MASKING EGRESS (spec §B.12) — the ONLY module in poster-app allowed to
// talk to model APIs. Enforced by ESLint no-restricted-imports at the repo root
// and by leak tests. Every call:
//
//   prompt(real values) -> redact -> assertNoLeaks (throws on any residue)
//     -> provider API -> restore(real values) -> caller
//
// Logs record ONLY masked prompts. The placeholder map never leaves this process.

import OpenAI from 'openai';
import { withRetry } from '#shared';
import { buildMaskMap, redact, restore, assertNoLeaks } from './redactor.js';
import { normalizeChatCompletionsBase, resolveModelsUrl, parseModelsList } from './provider-url.js';
import { tryParseJson } from '#orchestration';

const OPENAI_DEFAULT_BASE = 'https://api.openai.com/v1';

// Single-provider (OpenAI) egress: one API key drives content, the vision
// zero-text gate, and image generation. The exact model per role is chosen by
// the user on the Config page (vault.getModels()); these are only the
// fallbacks when nothing is configured yet.
const DEFAULT_MODELS = { content: 'gpt-4o', vision: 'gpt-4o', image: 'gpt-image-1' };

export class MaskingEgress {
  /**
   * @param {object} opts
   *   vault      — masking vault (org config + secrets + model selection)
   *   bus        — event bus (masked prompts only)
   *   db         — better-sqlite3 db instance (may be null — logging silently skipped)
   *   transports — { openai } injectable for tests
   */
  constructor({ vault, bus, db = null, transports = {} }) {
    this.vault = vault;
    this.bus = bus;
    this.db = db;
    this._openai = transports.openai || null;
    this._openaiInjected = Boolean(transports.openai); // tests inject a fixed client — never rebuild it
    this._openaiSig = null; // identity of the currently-cached built client (provider+base+key)
    this._fetch = transports.fetch || null; // injectable for listModels() tests
  }

  _providerConfig() {
    return (this.vault.getProviderConfig && this.vault.getProviderConfig()) || { provider: 'openai', customBaseUrl: '', customModel: '' };
  }

  /** Resolve the selected model for a role (content|vision|image). */
  _model(role) {
    const models = (this.vault.getModels && this.vault.getModels()) || {};
    const m = models[role];
    if (this._providerConfig().provider === 'custom' && !m) {
      // Under custom, there is no built-in default to fall back to — the model
      // id is whatever the endpoint serves and must be set explicitly.
      const err = new Error('Custom model not configured — set it on the Config page');
      err.code = 'CUSTOM_MODEL_MISSING';
      throw err;
    }
    return m || DEFAULT_MODELS[role];
  }

  /**
   * Build (once) the OpenAI-SDK client for the active provider. For CUSTOM, the
   * same SDK talks to any OpenAI-compatible endpoint via a baseURL override; a
   * blank customKey means a keyless endpoint (the SDK still needs a non-empty
   * apiKey string, so we pass a placeholder — no Authorization semantics are
   * added by us beyond what the endpoint enforces).
   */
  _openaiClient() {
    if (this._openaiInjected) return this._openai;
    const pc = this._providerConfig();
    const { openaiKey, customKey } = this.vault.getSecrets();
    // The cached client is keyed by everything that determines its identity, so
    // a runtime provider/base-URL/key change (e.g. saved on the Config page)
    // rebuilds the client instead of silently reusing the old endpoint.
    let sig;
    let build;
    if (pc.provider === 'custom') {
      if (!pc.customBaseUrl) {
        const err = new Error('Custom base URL not configured — set it on the Config page');
        err.code = 'CUSTOM_URL_MISSING';
        throw err;
      }
      sig = `custom|${pc.customBaseUrl}|${customKey}`;
      build = () => new OpenAI({ apiKey: customKey || 'not-needed', baseURL: normalizeChatCompletionsBase(pc.customBaseUrl) });
    } else {
      if (!openaiKey) {
        const err = new Error('OpenAI API key not configured — set it on the Config page or OPENAI_API_KEY env var');
        err.code = 'NO_API_KEY';
        throw err;
      }
      sig = `openai|${openaiKey}`;
      build = () => new OpenAI({ apiKey: openaiKey });
    }
    if (this._openai && this._openaiSig === sig) return this._openai;
    this._openai = build();
    this._openaiSig = sig;
    return this._openai;
  }

  /**
   * List the models the active provider advertises via GET <base>/models.
   * This carries ONLY the API key (Bearer, when set) — no org values, no
   * prompt — so it needs no mask session. Returns a de-duplicated id list.
   * SECURITY: never logs/echoes the key; errors carry status text only.
   */
  async listModels() {
    const pc = this._providerConfig();
    const { openaiKey, customKey } = this.vault.getSecrets();
    let base;
    let key;
    if (pc.provider === 'custom') {
      if (!pc.customBaseUrl) {
        const err = new Error('Custom base URL not configured — set it on the Config page');
        err.code = 'CUSTOM_URL_MISSING';
        err.status = 400;
        throw err;
      }
      base = normalizeChatCompletionsBase(pc.customBaseUrl);
      key = customKey;
    } else {
      base = OPENAI_DEFAULT_BASE;
      key = openaiKey;
      if (!key) {
        const err = new Error('OpenAI API key not configured — set it on the Config page or OPENAI_API_KEY env var');
        err.code = 'NO_API_KEY';
        err.status = 400;
        throw err;
      }
    }
    const url = resolveModelsUrl(base);
    const headers = { Accept: 'application/json' };
    if (key) headers.Authorization = `Bearer ${key}`;
    const fetchFn = this._fetch || globalThis.fetch;
    let res;
    try {
      res = await fetchFn(url, { method: 'GET', headers });
    } catch (cause) {
      const err = new Error(`Could not reach the model endpoint (${cause?.message || 'network error'})`);
      err.code = 'MODELS_FETCH_FAILED';
      err.status = 502;
      throw err;
    }
    if (!res.ok) {
      const err = new Error(`Model endpoint returned HTTP ${res.status}`);
      err.code = 'MODELS_FETCH_FAILED';
      err.status = 502;
      throw err;
    }
    const json = await res.json();
    return parseModelsList(json);
  }

  /**
   * Begin a masking session: ONE org-config snapshot and ONE mask map shared
   * by every prompt part of a call, so outbound masking and inbound restore
   * are guaranteed to use identical state (no TOCTOU between system/user).
   */
  _maskSession({ heavyRedaction = false } = {}) {
    const orgConfig = this.vault.getOrgConfig();
    const maskMap = buildMaskMap(orgConfig, { heavyRedaction });
    return {
      mask: (text) => {
        const { masked } = redact(text, maskMap);
        assertNoLeaks(masked, orgConfig); // defense in depth: redact missed nothing
        return masked;
      },
      restore: (text) => restore(text, maskMap, orgConfig)
    };
  }

  _logCall({ runId, pipeline, stage, agent, skill, maskedPromptHead, model, direction, parentEventId = null, egressLogId = null }) {
    if (!this.bus) return null;
    return this.bus.emit({
      runId, project: 'poster-app', pipeline, stage, agent, skill,
      type: 'agent_output',
      payload: { model, direction, maskedPromptHead: maskedPromptHead.slice(0, 400), egressLogId },
      maskingApplied: true,
      parentEventId
    });
  }

  /**
   * Write one row to egress_log. SECURITY: caller MUST pass the pre-restore
   * (masked) response text. Never pass restored text here.
   * Wrapped in try/catch — a DB write failure must never break the call path.
   */
  _writeEgressLog({ runId, eventId, pipeline, stage, agent, skill, direction, model, maskedSystem, maskedPrompt, maskedResponse, durationMs, status, promptTokens = null, completionTokens = null }) {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO egress_log
          (ts, run_id, event_id, pipeline, stage, agent, skill,
           direction, model, masked_system, masked_prompt, masked_response,
           duration_ms, status, prompt_tokens, completion_tokens)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        new Date().toISOString(),
        runId, eventId ?? null, pipeline ?? null, stage ?? null,
        agent ?? null, skill ?? null,
        direction, model,
        maskedSystem ?? null, maskedPrompt,
        maskedResponse ?? null,
        durationMs ?? null, status ?? null,
        promptTokens ?? null, completionTokens ?? null
      );
      return result.lastInsertRowid;
    } catch (err) {
      console.error('[egress] DB write failed (call path unaffected):', err);
      return null;
    }
  }

  /**
   * Text completion through the mask. ctx = { runId, pipeline, stage, agent, skill }.
   */
  async completeText({ system = '', user, model = null, maxTokens = 4096, temperature = 0.2, heavyRedaction = false }, ctx) {
    if (!ctx?.runId) throw new Error('Egress calls require pipeline context ({runId, pipeline, stage, agent, skill}) — unattributed model calls are forbidden');
    const useModel = model || this._model('content');
    const session = this._maskSession({ heavyRedaction });
    const maskedSystem = system ? session.mask(system) : '';
    const maskedUser = session.mask(user);

    let egressLogId = null;
    let t0 = Date.now();
    let rawResponse = null;

    try {
      const client = this._openaiClient();
      t0 = Date.now();
      // Each physical call to the provider = one egress_log row.
      // withRetry may invoke the callback multiple times; we write a row per attempt.
      rawResponse = await withRetry(async () => {
        const attemptT0 = Date.now();
        let attemptRaw = '';
        let attemptStatus = 'ok';
        // Usage capture (item 5): present on successful completions; stays
        // null when the provider omits it — never crashes the call path.
        let promptTokens = null;
        let completionTokens = null;
        try {
          const res = await client.chat.completions.create({
            model: useModel, max_tokens: maxTokens, temperature,
            messages: [
              ...(maskedSystem ? [{ role: 'system', content: maskedSystem }] : []),
              { role: 'user', content: maskedUser }
            ]
          });
          promptTokens = res?.usage?.prompt_tokens ?? null;
          completionTokens = res?.usage?.completion_tokens ?? null;
          attemptRaw = res?.choices?.[0]?.message?.content || '';
        } catch (err) {
          attemptStatus = `error:${err.code || err.message?.slice(0, 32) || 'UNKNOWN'}`;
          const rowId = this._writeEgressLog({
            ...ctx, direction: 'outbound', model: useModel,
            maskedSystem: maskedSystem || null, maskedPrompt: maskedUser,
            maskedResponse: null,
            durationMs: Date.now() - attemptT0, status: attemptStatus
          });
          egressLogId = rowId; // last row wins: the retry that actually produced the response
          throw err;
        }
        const rowId = this._writeEgressLog({
          ...ctx, direction: 'outbound', model: useModel,
          maskedSystem: maskedSystem || null, maskedPrompt: maskedUser,
          maskedResponse: attemptRaw,
          durationMs: Date.now() - attemptT0, status: 'ok',
          promptTokens, completionTokens
        });
        egressLogId = rowId; // last row wins: the retry that actually produced the response
        return attemptRaw;
      });
    } catch (err) {
      // If the error arose before any row was written (e.g. NO_API_KEY), write one now.
      if (egressLogId === null) {
        egressLogId = this._writeEgressLog({
          ...ctx, direction: 'outbound', model: useModel,
          maskedSystem: maskedSystem || null, maskedPrompt: maskedUser,
          maskedResponse: null,
          durationMs: Date.now() - t0,
          status: `error:${err.code || err.message?.slice(0, 32) || 'UNKNOWN'}`
        });
      }
      this._logCall({ ...ctx, maskedPromptHead: maskedUser, model: useModel, direction: 'outbound', egressLogId });
      throw err;
    }

    // SECURITY: emit bus event and write log with PRE-RESTORE (masked) raw response.
    this._logCall({ ...ctx, maskedPromptHead: maskedUser, model: useModel, direction: 'outbound', egressLogId });
    // session.restore converts masked placeholders → real org values for the caller.
    return session.restore(rawResponse);
  }

  /**
   * JSON completion with one repair retry (mirrors studio LlmClient).
   * The retry re-sends the RAW opts.user through completeText, which re-masks
   * it in a fresh session — safe today, and any future refactor MUST keep the
   * retry going through completeText (never call a provider client directly).
   */
  async completeJson(opts, ctx) {
    const first = await this.completeText(opts, ctx);
    const parsed = tryParseJson(first);
    if (parsed !== undefined) return parsed;
    const second = await this.completeText({
      ...opts,
      user: `${opts.user}\n\nYour previous response was not valid JSON. Respond with ONLY a valid JSON object, no markdown fences, no commentary.`,
      temperature: 0
    }, ctx);
    const reparsed = tryParseJson(second);
    if (reparsed !== undefined) return reparsed;
    // NEVER embed response content here — it has been restored and carries
    // real org values; an error message must not become an exfiltration path.
    const err = new Error('Model returned unparseable JSON twice via egress (content withheld — restored payloads never enter error messages)');
    err.code = 'EGRESS_BAD_JSON';
    throw err;
  }

  /**
   * Vision check (zero-text gate etc.). Image data is raw pixels — org values
   * can't be redacted out of pixels, so callers must only send GENERATED or
   * library-classified assets, never screenshots of internal systems. The
   * prompt text is masked like everything else.
   */
  async completeVision({ prompt, imageBase64, mediaType = 'image/png', model = null, maxTokens = 1024 }, ctx) {
    if (!ctx?.runId) throw new Error('Egress calls require pipeline context');
    const useModel = model || this._model('vision');
    const session = this._maskSession();
    const maskedPrompt = session.mask(prompt);

    let egressLogId = null;
    const t0 = Date.now();

    try {
      const client = this._openaiClient();
      const raw = await withRetry(async () => {
        const attemptT0 = Date.now();
        let attemptRaw = '';
        let promptTokens = null;
        let completionTokens = null;
        try {
          const res = await client.chat.completions.create({
            model: useModel, max_tokens: maxTokens,
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: maskedPrompt },
                { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } }
              ]
            }]
          });
          promptTokens = res?.usage?.prompt_tokens ?? null;
          completionTokens = res?.usage?.completion_tokens ?? null;
          attemptRaw = res?.choices?.[0]?.message?.content || '';
        } catch (err) {
          const rowId = this._writeEgressLog({
            ...ctx, direction: 'outbound-vision', model: useModel,
            maskedSystem: null, maskedPrompt,
            maskedResponse: null,
            durationMs: Date.now() - attemptT0,
            status: `error:${err.code || err.message?.slice(0, 32) || 'UNKNOWN'}`
          });
          egressLogId = rowId; // last row wins: the retry that actually produced the response
          throw err;
        }
        const rowId = this._writeEgressLog({
          ...ctx, direction: 'outbound-vision', model: useModel,
          maskedSystem: null, maskedPrompt,
          maskedResponse: attemptRaw,
          durationMs: Date.now() - attemptT0, status: 'ok',
          promptTokens, completionTokens
        });
        egressLogId = rowId; // last row wins: the retry that actually produced the response
        return attemptRaw;
      });

      this._logCall({ ...ctx, maskedPromptHead: maskedPrompt, model: useModel, direction: 'outbound-vision', egressLogId });
      return session.restore(raw);
    } catch (err) {
      if (egressLogId === null) {
        egressLogId = this._writeEgressLog({
          ...ctx, direction: 'outbound-vision', model: useModel,
          maskedSystem: null, maskedPrompt,
          maskedResponse: null,
          durationMs: Date.now() - t0,
          status: `error:${err.code || err.message?.slice(0, 32) || 'UNKNOWN'}`
        });
      }
      this._logCall({ ...ctx, maskedPromptHead: maskedPrompt, model: useModel, direction: 'outbound-vision', egressLogId });
      throw err;
    }
  }

  /**
   * Image generation (gpt-image-1). Prompt masked + leak-checked. Returns base64 PNG.
   * SECURITY: never store the raw base64 in egress_log — store a placeholder only.
   */
  async generateImage({ prompt, size = '1024x1024', quality = 'high', model = null }, ctx) {
    if (!ctx?.runId) throw new Error('Egress calls require pipeline context');
    const useModel = model || this._model('image');
    const session = this._maskSession();
    const maskedPrompt = session.mask(prompt);

    let egressLogId = null;
    const t0 = Date.now();

    try {
      const client = this._openaiClient();
      const result = await withRetry(async () => {
        const attemptT0 = Date.now();
        let attemptResult;
        let promptTokens = null;
        let completionTokens = null;
        try {
          attemptResult = await client.images.generate({
            model: useModel, prompt: maskedPrompt, size, quality, n: 1
          });
          // gpt-image-1 uses input_tokens/output_tokens (not prompt_tokens/completion_tokens)
          promptTokens = attemptResult?.usage?.input_tokens ?? null;
          completionTokens = attemptResult?.usage?.output_tokens ?? null;
        } catch (err) {
          const rowId = this._writeEgressLog({
            ...ctx, direction: 'outbound-image', model: useModel,
            maskedSystem: null, maskedPrompt,
            maskedResponse: null,
            durationMs: Date.now() - attemptT0,
            status: `error:${err.code || err.message?.slice(0, 32) || 'UNKNOWN'}`
          });
          egressLogId = rowId; // last row wins: the retry that actually produced the response
          throw err;
        }
        const b64 = attemptResult?.data?.[0]?.b64_json;
        const byteLen = b64 ? Math.round(b64.length * 0.75) : 0;
        const placeholder = b64 ? `[image: ${byteLen} bytes base64]` : null;
        const rowId = this._writeEgressLog({
          ...ctx, direction: 'outbound-image', model: useModel,
          maskedSystem: null, maskedPrompt,
          maskedResponse: placeholder,
          durationMs: Date.now() - attemptT0, status: 'ok',
          promptTokens, completionTokens
        });
        egressLogId = rowId; // last row wins: the retry that actually produced the response
        return attemptResult;
      });

      const b64 = result?.data?.[0]?.b64_json;
      if (!b64) throw new Error('Image provider returned no image data');
      this._logCall({ ...ctx, maskedPromptHead: maskedPrompt, model: useModel, direction: 'outbound-image', egressLogId });
      return { imageBase64: b64, maskedPrompt };
    } catch (err) {
      if (egressLogId === null) {
        egressLogId = this._writeEgressLog({
          ...ctx, direction: 'outbound-image', model: useModel,
          maskedSystem: null, maskedPrompt,
          maskedResponse: null,
          durationMs: Date.now() - t0,
          status: `error:${err.code || err.message?.slice(0, 32) || 'UNKNOWN'}`
        });
      }
      this._logCall({ ...ctx, maskedPromptHead: maskedPrompt, model: useModel, direction: 'outbound-image', egressLogId });
      throw err;
    }
  }
}

export { DEFAULT_MODELS };
