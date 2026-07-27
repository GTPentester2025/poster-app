// Config page logic: load/save org config, brand override, write-only API keys.
// Every network call is wrapped: an unreachable server surfaces as a status
// message, never a silent unhandled rejection.

import { classifyModel } from './model-capability-browser.js';

const ORG_FIELDS = ['companyName', 'socEmail', 'trainingPortalUrl', 'contentPortalUrl', 'reportingUrl', 'itHelpdesk'];
const $ = (id) => document.getElementById(id);

function splitList(value) {
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function flash(el, message, ok = true) {
  el.textContent = message;
  el.className = `status ${ok ? 'ok' : 'err'}`;
  if (ok) setTimeout(() => { el.textContent = ''; }, 4000);
}

// Auth token capture + header injection is shared across all pages in
// js/auth.js (window.SESSION_TOKEN / window.authOptions), loaded before this
// script. The header path (sessionAuth accepts x-session-token) is immune to
// cookie host mismatches (127.0.0.1 vs localhost), SameSite, and stale cookies.

/** Show a persistent top-of-page banner explaining the tab is unauthorized. */
function showAuthBanner() {
  if (document.getElementById('authBanner')) return;
  const banner = document.createElement('div');
  banner.id = 'authBanner';
  banner.className = 'auth-banner';
  banner.textContent = 'This tab is not authorized. Open the tokenized URL printed in the server terminal — '
    + 'e.g. append ?token=YOUR_TOKEN to this page URL (use the SAME host, 127.0.0.1 or localhost, throughout) — then reload.';
  document.body.insertBefore(banner, document.body.firstChild);
}

/** fetch wrapper: throws a readable error on network failure or HTTP error. */
async function api(path, options = null) {
  let res;
  try {
    res = await fetch(path, window.authOptions(options));
  } catch {
    throw new Error('server unreachable');
  }
  if (res.status === 401) {
    showAuthBanner();
    throw new Error('not authorized — reopen this page with ?token=… from the server terminal, then reload');
  }
  if (!res.ok) {
    // surface the server's specific reason (e.g. an invalid-key message) when present
    let detail = `HTTP ${res.status}`;
    try { const body = await res.json(); detail = body.message || body.error || detail; } catch { /* non-JSON body */ }
    throw new Error(detail);
  }
  return res.json();
}

/** Fill a <select> with options, marking the current value selected. */
function fillSelect(id, options, current) {
  const sel = $(id);
  sel.textContent = '';
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    if (opt === current) o.selected = true;
    sel.appendChild(o);
  }
}

/** Show/hide provider-specific UI: custom fields vs the OpenAI key + models cards. */
function applyProviderUi(provider) {
  const isCustom = provider === 'custom';
  $('customFields').hidden = !isCustom;
  // The OpenAI key + per-role model cards only apply to the OpenAI provider.
  $('openaiKeyCard').hidden = isCustom;
  $('modelsCard').hidden = isCustom;
}

const ROLE_SELECTS = { content: 'customContent', vision: 'customVision', image: 'customImage' };
const ROLE_GROUP = { content: 'text', vision: 'text', image: 'image' };

// Populate the three role selects from a model-id list. Each role is filtered
// to its capability group (unless "Show all" is ticked); the currently-stored
// value is preserved as a "(current)" option even if the endpoint didn't list it.
function renderRoleSelects(models) {
  const showAll = $('showAllModels').checked;
  const cm = window._customModels || { content: '', vision: '', image: '' };
  for (const role of Object.keys(ROLE_SELECTS)) {
    const sel = $(ROLE_SELECTS[role]);
    const current = cm[role] || '';
    let ids = showAll ? models.slice() : models.filter((m) => classifyModel(m) === ROLE_GROUP[role]);
    if (current && !ids.includes(current)) ids = [current, ...ids];
    if (!ids.length && current) ids = [current];
    sel.textContent = '';
    // allow an explicit empty choice (falls back to content at resolve time)
    const blank = document.createElement('option'); blank.value = ''; blank.textContent = '— none —'; sel.appendChild(blank);
    for (const id of ids) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = (id === current && !models.includes(current)) ? `${id} (current)` : id;
      if (id === current) o.selected = true;
      sel.appendChild(o);
    }
  }
}

// Persist provider + all three role models. Direct PUT (not touching the key).
async function persistCustomModels() {
  await putJson('/api/config/provider', {
    provider: 'custom',
    customBaseUrl: $('customBaseUrl').value.trim(),
    customModels: {
      content: $('customContent').value,
      vision: $('customVision').value,
      image: $('customImage').value
    }
  });
}

async function load() {
  let orgConfig, secrets, models, modelOptions, providerConfig;
  try {
    ({ orgConfig, secrets, models, modelOptions, providerConfig } = await api('/api/config'));
  } catch (err) {
    flash($('orgStatus'), `Cannot load config (${err.message}) — is the server running and this tab authorized?`, false);
    return;
  }
  if (providerConfig) {
    $('providerSelect').value = providerConfig.provider;
    $('customBaseUrl').value = providerConfig.customBaseUrl || '';
    window._customModels = providerConfig.customModels || { content: '', vision: '', image: '' };
    renderRoleSelects(window._lastLoadedModels || []);
    applyProviderUi(providerConfig.provider);
  }
  $('customChip').textContent = secrets.customConfigured ? 'configured ✓' : 'not configured';
  $('customChip').classList.toggle('on', secrets.customConfigured);
  for (const f of ORG_FIELDS) $(f).value = orgConfig[f] || '';
  $('orgDomains').value = (orgConfig.orgDomains || []).join(', ');
  $('customSensitiveTerms').value = (orgConfig.customSensitiveTerms || []).join(', ');
  if (orgConfig.brandOverride) {
    const b = orgConfig.brandOverride;
    if (b.primary) $('brandPrimary').value = b.primary;
    if (b.secondary) $('brandSecondary').value = b.secondary;
    if (b.accent) $('brandAccent').value = b.accent;
    if (b.background) $('brandBackground').value = b.background;
    $('brandFontHead').value = b.fontHead || '';
    $('brandFontBody').value = b.fontBody || '';
  }
  $('openaiChip').textContent = secrets.openaiConfigured ? 'configured ✓' : 'not configured';
  $('openaiChip').classList.toggle('on', secrets.openaiConfigured);
  if (models && modelOptions) {
    fillSelect('modelContent', modelOptions.content, models.content);
    fillSelect('modelVision', modelOptions.vision, models.vision);
    fillSelect('modelImage', modelOptions.image, models.image);
  }
}

function putJson(path, body) {
  return api(path, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

$('saveOrg').addEventListener('click', async () => {
  const body = {};
  for (const f of ORG_FIELDS) body[f] = $(f).value.trim();
  body.orgDomains = splitList($('orgDomains').value);
  body.customSensitiveTerms = splitList($('customSensitiveTerms').value);
  try {
    await putJson('/api/config', body);
    flash($('orgStatus'), 'Saved. Masking active for these values.');
  } catch (err) {
    flash($('orgStatus'), `Save failed: ${err.message}`, false);
  }
});

$('saveBrand').addEventListener('click', async () => {
  const brandOverride = {
    primary: $('brandPrimary').value,
    secondary: $('brandSecondary').value,
    accent: $('brandAccent').value,
    background: $('brandBackground').value,
    fontHead: $('brandFontHead').value.trim(),
    fontBody: $('brandFontBody').value.trim()
  };
  try {
    await putJson('/api/config', { brandOverride });
    flash($('brandStatus'), 'Brand override saved.');
  } catch (err) {
    flash($('brandStatus'), `Save failed: ${err.message}`, false);
  }
});

$('clearBrand').addEventListener('click', async () => {
  try {
    await putJson('/api/config', { brandOverride: null });
    flash($('brandStatus'), 'Reverted to AB InBev default palette.');
  } catch (err) {
    flash($('brandStatus'), `Save failed: ${err.message}`, false);
  }
});

$('saveKeys').addEventListener('click', async () => {
  const openaiKey = $('openaiKey').value.trim();
  if (!openaiKey) { flash($('keysStatus'), 'Nothing to save', false); return; }
  try {
    const { secrets } = await putJson('/api/config/secrets', { openaiKey });
    $('openaiKey').value = '';
    await load();
    // report the ACTUAL resulting state so a misfiled save can't look successful
    flash($('keysStatus'), secrets.openaiConfigured
      ? 'OpenAI key configured ✓'
      : 'Stored — but OpenAI still NOT configured. Paste the key and save again.', secrets.openaiConfigured);
  } catch (err) {
    flash($('keysStatus'), `Save failed: ${err.message}`, false);
  }
});

$('providerSelect').addEventListener('change', () => applyProviderUi($('providerSelect').value));

/**
 * Persist the provider config and, for custom, the key: a non-empty key is
 * saved; a ticked "keyless" box clears the stored key; an empty box with the
 * box unticked leaves the current key untouched. Returns after both writes so
 * a subsequent live-models fetch targets the just-saved endpoint.
 */
async function persistProvider() {
  const provider = $('providerSelect').value;
  const body = { provider };
  if (provider === 'custom') {
    body.customBaseUrl = $('customBaseUrl').value.trim();
    body.customModels = {
      content: $('customContent').value,
      vision: $('customVision').value,
      image: $('customImage').value
    };
  }
  await putJson('/api/config/provider', body);
  if (provider === 'custom') {
    if ($('customKeyless').checked) {
      await putJson('/api/config/secrets', { customKey: '' });
    } else if ($('customKey').value.trim()) {
      await putJson('/api/config/secrets', { customKey: $('customKey').value.trim() });
    }
  }
}

$('saveProvider').addEventListener('click', async () => {
  try {
    await persistProvider();
    $('customKey').value = '';
    $('customKeyless').checked = false;
    await load();
    flash($('providerStatus'), 'Provider saved.');
  } catch (err) {
    flash($('providerStatus'), `Save failed: ${err.message}`, false);
  }
});

// Re-render groups when the filter toggle flips.
$('showAllModels').addEventListener('change', () => renderRoleSelects(window._lastLoadedModels || []));

// Auto-persist any role pick so a missed "Save provider" can't drop it.
for (const id of Object.values(ROLE_SELECTS)) {
  $(id).addEventListener('change', async () => {
    if ($('providerSelect').value !== 'custom') return;
    window._customModels = {
      content: $('customContent').value, vision: $('customVision').value, image: $('customImage').value
    };
    try { await persistCustomModels(); flash($('loadModelsStatus'), 'Model selection saved.'); }
    catch (err) { flash($('loadModelsStatus'), `Could not save: ${err.message}`, false); }
  });
}

$('loadModels').addEventListener('click', async () => {
  try {
    flash($('loadModelsStatus'), 'Saving provider & loading models…');
    await persistProvider();
    $('customKey').value = '';
    $('customKeyless').checked = false;
    const { models } = await api('/api/config/models/live');
    window._lastLoadedModels = models || [];
    renderRoleSelects(window._lastLoadedModels);
    const nImg = window._lastLoadedModels.filter((m) => classifyModel(m) === 'image').length;
    flash($('loadModelsStatus'), models.length
      ? `${models.length} model(s): ${nImg} image, ${models.length - nImg} text — assigned by role.`
      : 'Endpoint returned no models.', models.length > 0);
  } catch (err) {
    flash($('loadModelsStatus'), `Could not load models: ${err.message}`, false);
  }
});

$('testConn').addEventListener('click', async () => {
  try {
    flash($('loadModelsStatus'), 'Testing content model…');
    await persistCustomModels();
    const r = await api('/api/config/test', { method: 'POST' });
    if (r.ok) flash($('loadModelsStatus'), `Content model OK (${r.model}). Reply: "${r.sample}"`);
    else flash($('loadModelsStatus'), `Test failed${r.status ? ` (HTTP ${r.status})` : ''}: ${r.message}`, false);
  } catch (err) {
    flash($('loadModelsStatus'), `Test failed: ${err.message}`, false);
  }
});

$('saveModels').addEventListener('click', async () => {
  const body = {
    content: $('modelContent').value,
    vision: $('modelVision').value,
    image: $('modelImage').value
  };
  try {
    await putJson('/api/config/models', body);
    flash($('modelsStatus'), `Models saved — content: ${body.content}, vision: ${body.vision}, image: ${body.image}`);
  } catch (err) {
    flash($('modelsStatus'), `Save failed: ${err.message}`, false);
  }
});

load();
