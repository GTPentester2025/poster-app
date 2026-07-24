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

  // Merge the auth header into a fetch options object (or create one).
  window.authOptions = function (options) {
    var opts = Object.assign({}, options || {});
    if (token) opts.headers = Object.assign({}, opts.headers || {}, { 'x-session-token': token });
    return opts;
  };
})();
