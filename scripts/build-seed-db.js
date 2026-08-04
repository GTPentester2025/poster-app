// Seed-DB builder: creates the committed read-only seed databases from
// knowledge modules. Run with: node scripts/build-seed-db.js
//
// Produces:
//   data/poster-seed.sqlite      — empty poster library (schema only)
//   data/knowledge-seed.sqlite   — pre-populated DPDP Act + Phishing articles + FTS5 + keywords
//   data/image-library-seed.sqlite — image metadata schema
//
// These are COMMITTED to git. On first run, seed-db.js copies them into
// the runtime poster-app.sqlite (if absent). The runtime DB is gitignored.

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');

function openSeed(name) {
  const path = join(DATA_DIR, name);
  if (existsSync(path)) unlinkSync(path);
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = DELETE'); // single-file, no WAL sidecars
  db.pragma('synchronous = OFF');     // faster bulk insert
  return db;
}

// ── Schema (mirrors db.js initial migration) ──────────────────────────────────

function createSchema(db) {
  db.exec(`
    CREATE TABLE schema_version (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
    INSERT INTO schema_version VALUES (1, 'initial-schema', datetime('now'));

    CREATE TABLE articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL, title_hash TEXT, url_hash TEXT UNIQUE,
      source TEXT, source_id TEXT, url TEXT, description TEXT, summary TEXT,
      watchouts TEXT, pub_date TEXT, type TEXT, threat_level REAL,
      relevance_score REAL DEFAULT 0, tier INTEGER DEFAULT 3, seeded INTEGER DEFAULT 0,
      fetched_at TEXT
    );
    CREATE INDEX idx_articles_pub ON articles(pub_date);
    CREATE INDEX idx_articles_type ON articles(type);

    CREATE VIRTUAL TABLE articles_fts USING fts5(
      title, description, summary,
      content='articles', content_rowid='id', tokenize='porter unicode61'
    );

    CREATE TRIGGER articles_ai AFTER INSERT ON articles BEGIN
      INSERT INTO articles_fts(rowid, title, description, summary)
      VALUES (new.id, new.title, new.description, new.summary);
    END;

    CREATE TABLE keywords (
      list_type TEXT NOT NULL CHECK (list_type IN ('critical','context','noise')),
      keyword TEXT NOT NULL, added_at TEXT NOT NULL,
      PRIMARY KEY (list_type, keyword)
    );

    CREATE TABLE posters (
      poster_id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, doc TEXT NOT NULL
    );

    CREATE TABLE learning (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('approval','rejection','edit_learning','feedback','reroute','prompt_review')),
      topic TEXT NOT NULL, angle TEXT, detail TEXT NOT NULL, weight REAL DEFAULT 1.0
    );
    CREATE INDEX idx_learning_topic ON learning(topic, kind);

    CREATE TABLE terminology (
      lang TEXT NOT NULL, source_term TEXT NOT NULL, approved_term TEXT NOT NULL,
      validated_by TEXT NOT NULL, validation_note TEXT, updated_at TEXT NOT NULL,
      PRIMARY KEY (lang, source_term)
    );

    CREATE TABLE images (
      image_id TEXT PRIMARY KEY, file_name TEXT NOT NULL,
      origin TEXT NOT NULL CHECK (origin IN ('library','generated','generated-from-library')),
      topics TEXT, style TEXT, palette TEXT, format TEXT,
      zero_text_checked INTEGER DEFAULT 0, zero_text_passed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL, meta TEXT
    );
    CREATE INDEX idx_images_style ON images(style, format);

    -- v7: levelled knowledge corpus + FTS (mirrors db.js knowledgeCorpusSql)
    CREATE TABLE knowledge (
      id TEXT PRIMARY KEY, framework TEXT NOT NULL, citation TEXT NOT NULL,
      level INTEGER NOT NULL, region TEXT NOT NULL, title TEXT NOT NULL,
      summary TEXT NOT NULL, text TEXT NOT NULL, obligations TEXT, penalties TEXT,
      applies_to TEXT, topics TEXT, poster_angles TEXT, seeded INTEGER DEFAULT 0
    );
    CREATE INDEX idx_knowledge_framework ON knowledge(framework, level);
    CREATE INDEX idx_knowledge_region ON knowledge(region);
    CREATE VIRTUAL TABLE knowledge_fts USING fts5(
      id UNINDEXED, title, summary, text, topics,
      content='knowledge', content_rowid='rowid', tokenize='porter unicode61'
    );
    CREATE TRIGGER knowledge_ai AFTER INSERT ON knowledge BEGIN
      INSERT INTO knowledge_fts(rowid, id, title, summary, text, topics)
      VALUES (new.rowid, new.id, new.title, new.summary, new.text, new.topics);
    END;
    CREATE TRIGGER knowledge_ad AFTER DELETE ON knowledge BEGIN
      INSERT INTO knowledge_fts(knowledge_fts, rowid, id, title, summary, text, topics)
      VALUES ('delete', old.rowid, old.id, old.title, old.summary, old.text, old.topics);
    END;
    CREATE TRIGGER knowledge_au AFTER UPDATE ON knowledge BEGIN
      INSERT INTO knowledge_fts(knowledge_fts, rowid, id, title, summary, text, topics)
      VALUES ('delete', old.rowid, old.id, old.title, old.summary, old.text, old.topics);
      INSERT INTO knowledge_fts(rowid, id, title, summary, text, topics)
      VALUES (new.rowid, new.id, new.title, new.summary, new.text, new.topics);
    END;

    CREATE TABLE custom_feeds (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE, site TEXT, icon TEXT DEFAULT '➕', added_at TEXT NOT NULL);
    CREATE TABLE egress_log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, run_id TEXT NOT NULL, event_id TEXT, pipeline TEXT, stage TEXT, agent TEXT, skill TEXT, direction TEXT NOT NULL, model TEXT NOT NULL, masked_system TEXT, masked_prompt TEXT NOT NULL, masked_response TEXT, duration_ms INTEGER, status TEXT, prompt_tokens INTEGER, completion_tokens INTEGER);
    CREATE INDEX idx_egress_log_run_id ON egress_log(run_id);
    CREATE TABLE graph_state (run_id TEXT PRIMARY KEY, ts TEXT NOT NULL, state TEXT NOT NULL);
    CREATE TABLE events (event_id TEXT PRIMARY KEY, run_id TEXT NOT NULL, ts TEXT NOT NULL, project TEXT, pipeline TEXT, stage TEXT, agent TEXT, skill TEXT, type TEXT NOT NULL, payload TEXT, parent_event_id TEXT);
    CREATE INDEX idx_events_run_id ON events(run_id);
  `);
}

// ── Seed article insertion ────────────────────────────────────────────────────

const insertArticle = null; // prepared later per-db

function seedArticles(db, articles) {
  const insert = db.prepare(`
    INSERT INTO articles (title, source, source_id, url, description, summary, watchouts, pub_date, type, threat_level, relevance_score, tier, seeded, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
  `);
  const insertMany = db.transaction((items) => {
    for (const a of items) {
      insert.run(
        a.title, a.source, a.sourceId || a.source_id || '',
        a.url || '', a.description || '', a.summary || null,
        JSON.stringify(a.watchouts || []), a.pubDate || a.pub_date || '',
        a.type || 'Security News', a.threatLevel || a.threat_level || 3,
        a.relevanceScore || a.relevance_score || 8, a.tier || 1
      );
    }
  });
  insertMany(articles);
}

function seedKeywords(db, { critical = [], context = [], noise = [] } = {}) {
  const insert = db.prepare('INSERT OR IGNORE INTO keywords (list_type, keyword, added_at) VALUES (?, ?, ?)');
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const k of critical) insert.run('critical', k, now);
    for (const k of context) insert.run('context', k, now);
    for (const k of noise) insert.run('noise', k, now);
  });
  tx();
}

// ── Build the knowledge seed DB ──────────────────────────────────────────────

async function buildKnowledgeSeed() {
  console.log('Building knowledge-seed.sqlite...');
  const db = openSeed('knowledge-seed.sqlite');
  createSchema(db);

  const allArticles = [];

  // Load DPDP Act knowledge
  try {
    const dpdp = await import('../rag/knowledge/dpdp-act.js');
    if (dpdp.DPDP_ACT_SEED && dpdp.DPDP_ACT_SEED.length) {
      allArticles.push(...dpdp.DPDP_ACT_SEED);
      console.log(`  DPDP Act: ${dpdp.DPDP_ACT_SEED.length} articles`);
    }
    if (dpdp.DPDP_KEYWORDS) {
      seedKeywords(db, dpdp.DPDP_KEYWORDS);
      console.log('  DPDP keywords seeded');
    }
  } catch (e) {
    console.log('  DPDP Act module not found — skipping (create rag/knowledge/dpdp-act.js first)');
  }

  // Load Phishing expertise
  try {
    const phishing = await import('../rag/knowledge/phishing-expert.js');
    if (phishing.PHISHING_SEED && phishing.PHISHING_SEED.length) {
      allArticles.push(...phishing.PHISHING_SEED);
      console.log(`  Phishing: ${phishing.PHISHING_SEED.length} articles`);
    }
    if (phishing.PHISHING_KEYWORDS) {
      seedKeywords(db, phishing.PHISHING_KEYWORDS);
      console.log('  Phishing keywords seeded');
    }
  } catch (e) {
    console.log('  Phishing module not found — skipping (create rag/knowledge/phishing-expert.js first)');
  }

  // Load existing article seed
  try {
    const existingSeed = await import('../data/article-seed.js');
    // The existing seed is a browser JS module... attempt to extract
  } catch (e) {
    console.log('  Existing article seed not importable in Node');
  }

  if (allArticles.length) {
    seedArticles(db, allArticles);
    console.log(`  Total seeded: ${allArticles.length} articles`);
  }

  // Levelled knowledge corpus (L0 statute / L1 guidance). The per-framework
  // corpus files (rag/knowledge/<framework>.js) are authored by other agents and
  // aggregated in rag/knowledge/index.js (exporting KNOWLEDGE_CORPUS). We seed
  // through the same validated writer the runtime uses, so a malformed corpus
  // fails the build loudly rather than shipping a broken seed DB.
  try {
    const { seedKnowledge } = await import('../rag/knowledge_seeder.js');
    let corpus = [];
    try {
      const agg = await import('../rag/knowledge/index.js');
      corpus = agg.KNOWLEDGE_CORPUS || agg.default || [];
    } catch {
      console.log('  Knowledge corpus aggregate (rag/knowledge/index.js) not found — skipping (authored by corpus agents)');
    }
    if (corpus.length) {
      const { seeded } = seedKnowledge(db, corpus);
      console.log(`  Knowledge corpus: ${seeded} entries seeded`);
    }
  } catch (e) {
    console.error('  Knowledge corpus seeding failed:', e.message);
    throw e;
  }

  db.close();
  console.log('  knowledge-seed.sqlite built.');
}

// ── Build the poster seed DB (schema only — posters are user-created) ─────────

function buildPosterSeed() {
  console.log('Building poster-seed.sqlite...');
  const db = openSeed('poster-seed.sqlite');
  createSchema(db);
  db.close();
  console.log('  poster-seed.sqlite built.');
}

// ── Build the image library seed DB ──────────────────────────────────────────

function buildImageLibrarySeed() {
  console.log('Building image-library-seed.sqlite...');
  const db = openSeed('image-library-seed.sqlite');
  createSchema(db);
  // Image metadata only — actual PNGs live in image-library/assets/
  // (gitignored; regenerated on first launch if missing)
  db.close();
  console.log('  image-library-seed.sqlite built.');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  buildPosterSeed();
  buildImageLibrarySeed();
  await buildKnowledgeSeed();
  console.log('\nAll seed databases built. Commit data/*-seed.sqlite to git.');
}

main().catch((err) => {
  console.error('Seed build failed:', err);
  process.exit(1);
});