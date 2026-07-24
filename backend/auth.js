// Local session auth: the server is localhost-only, but "localhost" still
// means any process/tab on the machine. A per-install token gates every /api
// route and the SSE stream. The token is persisted in the data dir; the
// startup banner prints a tokenized URL, and visiting it sets the cookie.

import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const COOKIE_NAME = 'poster_session';

export function loadOrCreateToken(dataDir) {
  const tokenPath = join(dataDir, 'session-token');
  if (existsSync(tokenPath)) {
    const existing = readFileSync(tokenPath, 'utf8').trim();
    if (/^[a-f0-9]{48}$/.test(existing)) return existing;
  }
  const token = randomBytes(24).toString('hex');
  mkdirSync(dirname(tokenPath), { recursive: true });
  writeFileSync(tokenPath, token, { mode: 0o600 });
  return token;
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

/**
 * Global middleware: if the request carries the correct ?token= query
 * (the tokenized URL from the startup banner), set the session cookie.
 * Mount BEFORE static so visiting the printed URL once authorizes the tab.
 */
export function tokenCookieSetter(token) {
  return (req, res, next) => {
    if (req.query?.token === token) {
      res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/`);
      // make the freshly set cookie visible to sessionAuth within this request
      req.headers.cookie = `${req.headers.cookie ? req.headers.cookie + '; ' : ''}${COOKIE_NAME}=${token}`;
    }
    next();
  };
}

/**
 * API guard. Accepts:
 *  1. poster_session cookie (set by tokenCookieSetter)
 *  2. X-Session-Token header (API clients / tests)
 */
export function sessionAuth(token) {
  return (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies[COOKIE_NAME] === token) return next();
    if (req.headers['x-session-token'] === token) return next();
    res.status(401).json({ error: 'Unauthorized: open the tokenized URL printed at server startup' });
  };
}

export { COOKIE_NAME };
