// Per-request provider key (Part A) — the server is loopback-only with no token
// gate, so pages carry no session token. The AI provider key lives in
// sessionStorage (tab-scoped, never localStorage) and rides on every request as
// x-provider-key; it is used server-scoped and never persisted.
(function () {
  // AI provider key: session-only (tab-scoped), NEVER localStorage.
  window.getProviderKey = function () {
    try { return sessionStorage.getItem('poster_provider_key') || ''; } catch { return ''; }
  };
  window.setProviderKey = function (v) {
    try {
      if (v) sessionStorage.setItem('poster_provider_key', v);
      else sessionStorage.removeItem('poster_provider_key');
    } catch { /* private mode */ }
  };

  // Merge headers into a fetch options object: attach the provider key when set.
  window.authOptions = function (options) {
    var opts = Object.assign({}, options || {});
    var headers = Object.assign({}, opts.headers || {});
    var pk = window.getProviderKey();
    if (pk) headers['x-provider-key'] = pk;
    opts.headers = headers;
    return opts;
  };
})();
