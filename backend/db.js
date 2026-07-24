// Poster app database bootstrap. One SQLite file holds: org config vault,
// news index (articles + FTS5), keyword weights, posters, terminology,
// self-learning memory, image library metadata, and the event mirror.

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  migrate(db);
  return db;
}

// Versioned migrations: each entry runs exactly once, tracked in schema_version.
// Future schema changes append a new entry — never edit an applied migration.
const MIGRATIONS = [
  { version: 1, name: 'initial-schema', sql: initialSchemaSql() },
  { version: 2, name: 'custom-feeds', sql: customFeedsSql() },
  { version: 3, name: 'egress-call-log', sql: egressCallLogSql() },
  { version: 4, name: 'learning-kind-reroute', sql: learningKindRerouteSql() },
  { version: 5, name: 'egress-token-counts', sql: egressTokenCountsSql() },
  { version: 6, name: 'learning-kind-prompt-review', sql: learningKindPromptReviewSql() },
];

export function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );`);
  const applied = new Set(db.prepare('SELECT version FROM schema_version').all().map((r) => r.version));
  const record = db.prepare('INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)');
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      record.run(m.version, m.name, new Date().toISOString());
    })();
  }
  return db;
}

// v2: user-added RSS sources (ported rss_fetcher.js custom feeds:
// localStorage 'awareness_custom_feed_sources_v1' -> SQLite). Built-in FEEDS
// stay in code (poster-app/rag/feeds.js) — only user additions live here.
function customFeedsSql() {
  return `
  CREATE TABLE IF NOT EXISTS custom_feeds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    site TEXT,
    icon TEXT DEFAULT '➕',
    added_at TEXT NOT NULL
  );
  `;
}

// v3: egress call log (prompt transparency rail, plan section D3)
// SECURITY: only masked prompts/responses are stored here — never restored values.
function egressCallLogSql() {
  return `
  CREATE TABLE IF NOT EXISTS egress_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    run_id TEXT NOT NULL,
    event_id TEXT,
    pipeline TEXT,
    stage TEXT,
    agent TEXT,
    skill TEXT,
    direction TEXT NOT NULL,
    model TEXT NOT NULL,
    masked_system TEXT,
    masked_prompt TEXT NOT NULL,
    masked_response TEXT,
    duration_ms INTEGER,
    status TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_egress_log_run_id ON egress_log(run_id);
  `;
}

// learning.kind gains 'reroute' (Phase O6 reroute agent). SQLite cannot alter
// a CHECK constraint in place, so the table is rebuilt and rows copied.
function learningKindRerouteSql() {
  return `
  CREATE TABLE learning_v4 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('approval','rejection','edit_learning','feedback','reroute')),
    topic TEXT NOT NULL,
    angle TEXT,
    detail TEXT NOT NULL,
    weight REAL DEFAULT 1.0
  );
  INSERT INTO learning_v4 (id, ts, kind, topic, angle, detail, weight)
    SELECT id, ts, kind, topic, angle, detail, weight FROM learning;
  DROP TABLE learning;
  ALTER TABLE learning_v4 RENAME TO learning;
  CREATE INDEX IF NOT EXISTS idx_learning_topic ON learning(topic, kind);
  `;
}

// v5: token usage columns on egress_log. For existing DBs the rows are
// present but null; new rows written by egress.js fill the values.
function egressTokenCountsSql() {
  return `
  ALTER TABLE egress_log ADD COLUMN prompt_tokens INTEGER;
  ALTER TABLE egress_log ADD COLUMN completion_tokens INTEGER;
  `;
}

// v6: learning.kind gains 'prompt_review' (overseer meta-reviewer — Job C).
// SQLite cannot alter a CHECK constraint in place, so the table is rebuilt and
// rows copied (same idiom as learningKindRerouteSql).
function learningKindPromptReviewSql() {
  return `
  CREATE TABLE learning_v6 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('approval','rejection','edit_learning','feedback','reroute','prompt_review')),
    topic TEXT NOT NULL,
    angle TEXT,
    detail TEXT NOT NULL,
    weight REAL DEFAULT 1.0
  );
  INSERT INTO learning_v6 (id, ts, kind, topic, angle, detail, weight)
    SELECT id, ts, kind, topic, angle, detail, weight FROM learning;
  DROP TABLE learning;
  ALTER TABLE learning_v6 RENAME TO learning;
  CREATE INDEX IF NOT EXISTS idx_learning_topic ON learning(topic, kind);
  `;
}


function initialSchemaSql() {
  return `
  -- news index: schema ported from reference repo js/db.js article store
  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    title_hash TEXT,
    url_hash TEXT UNIQUE,
    source TEXT,
    source_id TEXT,
    url TEXT,
    description TEXT,
    summary TEXT,
    watchouts TEXT,
    pub_date TEXT,
    type TEXT,
    threat_level REAL,
    relevance_score REAL DEFAULT 0,
    tier INTEGER DEFAULT 3,
    seeded INTEGER DEFAULT 0,
    fetched_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_articles_pub ON articles(pub_date);
  CREATE INDEX IF NOT EXISTS idx_articles_type ON articles(type);

  CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
    title, description, summary,
    content='articles', content_rowid='id', tokenize='porter unicode61'
  );
  CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
    INSERT INTO articles_fts(rowid, title, description, summary)
    VALUES (new.id, new.title, new.description, new.summary);
  END;
  CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
    INSERT INTO articles_fts(articles_fts, rowid, title, description, summary)
    VALUES ('delete', old.id, old.title, old.description, old.summary);
  END;
  CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE ON articles BEGIN
    INSERT INTO articles_fts(articles_fts, rowid, title, description, summary)
    VALUES ('delete', old.id, old.title, old.description, old.summary);
    INSERT INTO articles_fts(rowid, title, description, summary)
    VALUES (new.id, new.title, new.description, new.summary);
  END;

  -- keyword weights (ported keyword_store: localStorage -> SQLite)
  CREATE TABLE IF NOT EXISTS keywords (
    list_type TEXT NOT NULL CHECK (list_type IN ('critical','context','noise')),
    keyword TEXT NOT NULL,
    added_at TEXT NOT NULL,
    PRIMARY KEY (list_type, keyword)
  );

  -- posters (spec §B.10) — full document as JSON, snapshots append-only
  CREATE TABLE IF NOT EXISTS posters (
    poster_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    doc TEXT NOT NULL
  );

  -- self-learning memory (spec Â§B.12): approval/rejection weights per topic+angle
  CREATE TABLE IF NOT EXISTS learning (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('approval','rejection','edit_learning','feedback')),
    topic TEXT NOT NULL,
    angle TEXT,
    detail TEXT NOT NULL,
    weight REAL DEFAULT 1.0
  );
  CREATE INDEX IF NOT EXISTS idx_learning_topic ON learning(topic, kind);

  -- terminology DB per language (spec Â§B.11), grown from validated user edits
  CREATE TABLE IF NOT EXISTS terminology (
    lang TEXT NOT NULL,
    source_term TEXT NOT NULL,
    approved_term TEXT NOT NULL,
    validated_by TEXT NOT NULL,
    validation_note TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (lang, source_term)
  );

  -- image library metadata (spec Â§B.7)
  CREATE TABLE IF NOT EXISTS images (
    image_id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    origin TEXT NOT NULL CHECK (origin IN ('library','generated','generated-from-library')),
    topics TEXT,        -- JSON array of topic tags
    style TEXT,         -- e.g. flat-icon | illustration | comic | photo
    palette TEXT,       -- dominant colors JSON
    format TEXT,        -- icon | illustration | background | photo
    zero_text_checked INTEGER DEFAULT 0,
    zero_text_passed INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    meta TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_images_style ON images(style, format);
  `;
}
