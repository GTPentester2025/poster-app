// RAG / news-layer API. Same error discipline as routes/config.js: handlers
// forward to the global handler via next(err) so SQLite/fetch internals never
// leak into response bodies. All ingest happens server-side (the masking
// boundary forbids the browser from fetching third-party content itself).

import { Router } from 'express';
import { newRunId } from '#shared';
import { ingestAllFeeds } from '../../rag/ingest.js';
import { importSeedArticles } from '../../rag/seed_import.js';
import { retrieve } from '../../rag/retrieval.js';
import { buildContextFile } from '../../rag/context_file.js';
import {
  getScoringSnapshot, addKeyword, removeKeyword,
  setCriticalKeywords, setContextKeywords, setNoiseKeywords, resetDefaults
} from '../../rag/keyword_store.js';

export function ragRouter({ db, egress }) {
  const router = Router();

  // Run a full (or feed-filtered) ingest. Long-running by nature (~35 feeds,
  // 6-way concurrency, 10s/feed cap) — the UI drives this from a button, so
  // a synchronous await with per-feed stats in the response is fine here.
  router.post('/fetch', async (req, res, next) => {
    try {
      const { feedIds = null, maxPerFeed } = req.body || {};
      if (maxPerFeed !== undefined && maxPerFeed !== null) {
        const n = Number(maxPerFeed);
        if (!Number.isInteger(n) || n < 1 || n > 100) {
          return res.status(400).json({ error: 'maxPerFeed must be an integer 1-100' });
        }
      }
      const result = await ingestAllFeeds({
        db,
        feedIds,
        ...(maxPerFeed !== undefined && maxPerFeed !== null ? { maxPerFeed: Number(maxPerFeed) } : {})
      });
      res.json({
        fetched: result.articles.length,
        saved: result.saved,
        updated: result.updated,
        skipped: result.skipped,
        stats: result.stats,
        telemetry: result.telemetry
      });
    } catch (err) { next(err); }
  });

  // Query the index: ?days=N (0/absent = all), ?type=Phishing, ?q=fts terms.
  router.get('/articles', (req, res, next) => {
    try {
      const days = Number(req.query.days || 0);
      const type = String(req.query.type || '').trim();
      const q = String(req.query.q || '').trim();

      const where = [];
      const params = [];
      if (days > 0) {
        where.push('pub_date >= ?');
        params.push(new Date(Date.now() - days * 864e5).toISOString().split('T')[0]);
      }
      if (type) {
        where.push('type = ?');
        params.push(type);
      }
      if (q) {
        // quoted-phrase match per term — user text must not hit FTS syntax
        const match = q.split(/\s+/).map((t) => `"${t.replace(/"/g, '""')}"`).join(' OR ');
        where.push('id IN (SELECT rowid FROM articles_fts WHERE articles_fts MATCH ?)');
        params.push(match);
      }
      const sql = `SELECT * FROM articles
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY tier ASC, relevance_score DESC, pub_date DESC`;
      res.json({ articles: db.prepare(sql).all(...params) });
    } catch (err) { next(err); }
  });

  router.get('/keywords', (_req, res, next) => {
    try {
      res.json({ keywords: getScoringSnapshot(db) });
    } catch (err) { next(err); }
  });

  // PUT accepts either full-list replacement { critical, context, noise },
  // a single mutation { action: 'add'|'remove', listType, keyword }, or
  // { action: 'reset' } — mirroring the reference KeywordStore surface.
  router.put('/keywords', (req, res, next) => {
    try {
      const body = req.body || {};
      let snapshot;
      if (body.action === 'reset') {
        snapshot = resetDefaults(db);
      } else if (body.action === 'add') {
        snapshot = addKeyword(db, body.listType, body.keyword);
      } else if (body.action === 'remove') {
        snapshot = removeKeyword(db, body.listType, body.keyword);
      } else {
        if (Array.isArray(body.critical)) setCriticalKeywords(db, body.critical);
        if (Array.isArray(body.context)) setContextKeywords(db, body.context);
        if (Array.isArray(body.noise)) setNoiseKeywords(db, body.noise);
        snapshot = getScoringSnapshot(db);
      }
      res.json({ keywords: snapshot });
    } catch (err) { next(err); }
  });

  // Import the committed starter article set (idempotent — url_hash dedup).
  // The seed path is fixed to the module default: accepting a caller-supplied
  // path here would let any request read arbitrary files off disk.
  router.post('/seed', (_req, res, next) => {
    try {
      res.json(importSeedArticles({ db }));
    } catch (err) { next(err); }
  });

  // Retrieve top articles for a topic and synthesize an InternalContextFile.
  // Body: { topic, keywords: string[], limit?, runId? }. Empty retrieval is a
  // 200 with contextFile:null — "no research found" is a normal outcome, not
  // an error, and egress is never touched in that case.
  router.post('/context', async (req, res, next) => {
    try {
      const body = req.body || {};
      const { topic, keywords, limit } = body;
      if (typeof topic !== 'string' || !topic.trim()) {
        return res.status(400).json({ error: 'topic must be a non-empty string' });
      }
      if (!Array.isArray(keywords) || !keywords.length || !keywords.every((k) => typeof k === 'string')) {
        return res.status(400).json({ error: 'keywords must be a non-empty array of strings' });
      }
      const n = Number(limit);
      const lim = Number.isFinite(n) ? Math.min(20, Math.max(1, Math.trunc(n))) : 10;

      const articles = retrieve(db, keywords, { limit: lim });
      if (!articles.length) {
        return res.json({ contextFile: null, articles: 0, reason: 'no matching articles in index' });
      }
      const runId = (typeof body.runId === 'string' && body.runId.trim()) ? body.runId : newRunId('poster');
      const contextFile = await buildContextFile({ db, egress, runId, topic, keywords, articles });
      res.json({ contextFile, articles: articles.length });
    } catch (err) { next(err); }
  });

  return router;
}
