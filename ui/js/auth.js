// Shared session-token capture (loaded before every page script). The server
// authorizes a request by EITHER the poster_session cookie (set by visiting a
// ?token= URL) OR an x-session-token header. The cookie is host-scoped
// (127.0.0.1 vs localhost) and SameSite/stale-cookie fragile; the header is
// not. So every page captures the token from the URL (persisted per-tab in
// sessionStorage) and attaches it as a header on every request — auth then
// works regardless of cookie quirks, and there is one code path for all pages.
(function () {
  var token = '';
  try {
    var fromUrl = new URLSearchParams(location.search).get('token');
    if (fromUrl) { sessionStorage.setItem('poster_token', fromUrl); token = fromUrl; }
    else { token = sessionStorage.getItem('poster_token') || ''; }
  } catch { /* private mode: no sessionStorage */ }

  window.SESSION_TOKEN = token;

  // AI provider key: session-only (tab-scoped), NEVER localStorage, NEVER sent
  // to the server for storage — only attached per request as x-provider-key.
  window.getProviderKey = function () {
    try { return sessionStorage.getItem('poster_provider_key') || ''; } catch { return ''; }
  };
  window.setProviderKey = function (v) {
    try {
      if (v) sessionStorage.setItem('poster_provider_key', v);
      else sessionStorage.removeItem('poster_provider_key');
    } catch { /* private mode */ }
  };

  // Merge the auth header into a fetch options object (or create one).
  window.authOptions = function (options) {
    var opts = Object.assign({}, options || {});
    var headers = Object.assign({}, opts.headers || {});
    if (token) headers['x-session-token'] = token;
    var pk = window.getProviderKey();
    if (pk) headers['x-provider-key'] = pk;
    opts.headers = headers;
    return opts;
  };
})();
