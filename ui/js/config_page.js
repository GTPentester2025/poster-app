// Config page logic: load/save org config, brand override, session-only provider key.
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

// Auth header injection is shared across all pages in js/auth.js
// (window.authOptions), loaded before this script. It injects the
// x-provider-key header only — there is no session token; the server is
// loopback-only with no token gate.

/** Show a persistent top-of-page banner explaining the tab is unauthorized. */
function showAuthBanner() {
  if (document.getElementById('authBanner')) return;
  const banner = document.createElement('div');
  banner.id = 'authBanner';
  banner.className = 'auth-banner';
  banner.textContent = 'This tab is not authorized. You do not have permission to access this resource. Reload the page or contact your administrator.';
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
    throw new Error('not authorized — you do not have permission to access this resource');
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

/** Show/hide provider-specific UI: custom fields vs the models card. */
function applyProviderUi(provider) {
  const isCustom = provider === 'custom';
  $('customFields').hidden = !isCustom;
  // The per-role model card only applies to the OpenAI provider.
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
  let orgConfig, models, modelOptions, providerConfig;
  try {
    ({ orgConfig, models, modelOptions, providerConfig } = await api('/api/config'));
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
  if (models && modelOptions) {
    fillSelect('modelContent', modelOptions.content, models.content);
    fillSelect('modelVision', modelOptions.vision, models.vision);
    fillSelect('modelImage', modelOptions.image, models.image);
  }
  updateProviderKeyChip();
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

$('providerSelect').addEventListener('change', () => applyProviderUi($('providerSelect').value));

/**
 * Persist the provider config (provider, customBaseUrl, customModels).
 * The API key is now session-only in the browser — never stored on the server.
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
}

$('saveProvider').addEventListener('click', async () => {
  try {
    await persistProvider();
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

function updateProviderKeyChip() {
  const set = !!window.getProviderKey();
  const chip = $('providerKeyChip');
  chip.textContent = set ? 'set for this session ✓' : 'not set';
  chip.classList.toggle('on', set);
}

$('setProviderKey').addEventListener('click', () => {
  const v = $('providerKey').value.trim();
  window.setProviderKey(v);
  $('providerKey').value = '';
  updateProviderKeyChip();
  flash($('providerKeyStatus'), v ? 'Key set for this session.' : 'Key cleared.');
});

$('clearProviderKey').addEventListener('click', () => {
  window.setProviderKey('');
  $('providerKey').value = '';
  updateProviderKeyChip();
  flash($('providerKeyStatus'), 'Key cleared.');
});

load();
