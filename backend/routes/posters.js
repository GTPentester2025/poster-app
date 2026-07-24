// Poster library API (spec §B.10): list view + save/rename/feedback/suggestions.
// Doc contents (context file, snapshots, review prose) stay server-side —
// the library needs names and statuses, never internals. Same error
// discipline as routes/editor.js: forward coded errors via handle(), others via next(err).

import { Router } from 'express';
import {
  savePosterAs, renamePoster, recordPosterFeedback, getSuggestions
} from '../../pipelines/library.js';
import { getTemplateV2 } from '../../templates/v2/index.js';
import { resolveBrand } from '../../templates/palette.js';

function handle(res, next, err) {
  if (err && err.status) {
    return res.status(err.status).json({ error: err.code || 'BAD_REQUEST' });
  }
  next(err);
}

// ── library thumbnails (T5) ──────────────────────────────────────────────────
// The list endpoint decorates every poster with a small `previewSvg`: the v2
// template's palette-resolved portrait preview when doc.design.templateId is a
// v2 template, else a typographic placeholder built here. Pure geometry —
// no model calls, no canvas rendering — so the list stays cheap. previewSvg is
// response-only (never persisted into the doc).

// XSS: headline/name are user/model text and are interpolated into an SVG the
// UI injects via innerHTML — EVERY character that could open markup is escaped.
function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Greedy word-wrap for the placeholder headline: up to maxLines lines of
// ~maxChars; overlong single words are hard-cut; overflow gets an ellipsis.
function wrapLines(text, maxChars = 16, maxLines = 5) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const word = w.length > maxChars ? `${w.slice(0, maxChars - 1)}…` : w;
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = word;
      if (lines.length === maxLines) break;
    } else {
      cur = next;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  else if (cur) lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, maxChars - 1)}…`;
  return lines.length ? lines : ['Untitled poster'];
}

// Typographic placeholder card (same 200x283 portrait footprint as the v2
// template previews): headline text on the brand dark card with gold accents.
// Palette hexes come from applyBrandOverride (regex-validated #RRGGBB) —
// safe for attribute interpolation; the TEXT goes through escapeXml.
function typographicPreviewSvg(text, palette) {
  const tspans = wrapLines(text)
    .map((line, i) => `<tspan x="20" dy="${i === 0 ? 0 : 23}">${escapeXml(line)}</tspan>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 283" width="200" height="283" role="img">` +
    `<rect width="200" height="283" fill="${palette.dark}"/>` +
    `<rect x="20" y="38" width="34" height="4" rx="2" fill="${palette.primary}"/>` +
    `<text x="20" y="86" fill="${palette.background}" font-family="Montserrat, Inter, 'Segoe UI', sans-serif" font-size="16" font-weight="700">${tspans}</text>` +
    `<rect y="261" width="200" height="22" fill="${palette.primary}"/>` +
    `</svg>`;
}

export function postersRouter(ctx) {
  const router = Router();

  // GET / — list all posters, newest first. Parses minimal doc fields and
  // decorates each with previewSvg (thumbnail) + languages (variant count).
  router.get('/', (_req, res, next) => {
    try {
      const rows = ctx.db.prepare(
        'SELECT poster_id, name, status, created_at, updated_at, doc FROM posters ORDER BY updated_at DESC'
      ).all();
      const { palette } = resolveBrand(ctx.vault); // once per request — shared by every thumbnail
      const posters = rows.map((r) => {
        let topic = null;
        let headline = null;
        let savedAt = null;
        let languages = 0;
        let template = null;
        try {
          const doc = JSON.parse(r.doc);
          topic = doc.contextFile?.topic ?? null;
          headline = doc.content?.headline ?? null;
          savedAt = doc.savedAt ?? null;
          languages = Object.keys(doc.translations || {}).length;
          template = getTemplateV2(doc.design?.templateId ?? doc.templateId ?? null);
        } catch { /* malformed doc — skip optional fields */ }
        return {
          posterId: r.poster_id,
          name: r.name,
          status: r.status,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          topic,
          headline,
          savedAt,
          languages,
          previewSvg: template
            ? template.preview.portrait(palette)
            : typographicPreviewSvg(headline || r.name, palette)
        };
      });
      res.json({ posters });
    } catch (err) { next(err); }
  });

  // GET /suggestions?topic=... — "what worked best" for a topic.
  // MUST be registered BEFORE /:posterId to avoid param route shadowing.
  router.get('/suggestions', (req, res, next) => {
    try {
      const topic = req.query.topic;
      res.json(getSuggestions({ ctx, topic }));
    } catch (err) { handle(res, next, err); }
  });

  // POST /:posterId/save — save-as with a custom name (phase transition → 'saved')
  router.post('/:posterId/save', async (req, res, next) => {
    try {
      const { name } = req.body || {};
      res.json(await savePosterAs({ ctx, posterId: req.params.posterId, name }));
    } catch (err) { handle(res, next, err); }
  });

  // PUT /:posterId/name — rename only (no phase change)
  router.put('/:posterId/name', async (req, res, next) => {
    try {
      const { name } = req.body || {};
      res.json(await renamePoster({ ctx, posterId: req.params.posterId, name }));
    } catch (err) { handle(res, next, err); }
  });

  // POST /:posterId/feedback — user rates a poster good/bad
  router.post('/:posterId/feedback', (req, res, next) => {
    try {
      const { rating, remarks } = req.body || {};
      res.json(recordPosterFeedback({ ctx, posterId: req.params.posterId, rating, remarks }));
    } catch (err) { handle(res, next, err); }
  });

  return router;
}
