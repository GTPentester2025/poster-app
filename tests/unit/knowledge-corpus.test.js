// Knowledge RAG engine tests: migration creates knowledge + knowledge_fts;
// seedKnowledge validates + is idempotent; retrieveKnowledge FTS-matches and
// ranks; framework/region/level filters; RRF fusion merges knowledge + article
// rows and dedups; context_file emits citations; the OLD retrieve() shape is
// unchanged. Uses the in-memory better-sqlite3 + migrate() pattern from
// rag-retrieval.test.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migrate } from '../../backend/db.js';
import { seedKnowledge } from '../../rag/knowledge_seeder.js';
import { retrieveKnowledge } from '../../rag/knowledge_retriever.js';
import { reciprocalRankFusion, retrieveMultiLevel, retrieve } from '../../rag/retrieval.js';
import { validateCorpus } from '../../rag/knowledge/schema.js';
import { upsertArticles } from '../../rag/ingest.js';
import { buildContextFile } from '../../rag/context_file.js';

// ── Inline fixture corpus: 6 valid KnowledgeEntry across 2 frameworks + 2 levels ─
function makeEntry(over) {
  return {
    id: 'x', framework: 'GDPR', citation: 'Art. 1', level: 0, region: 'EU',
    title: 'Title', summary: 'Summary', text: 'Body text.',
    obligations: ['do a thing'], penalties: null, appliesTo: ['all staff'],
    topics: ['topic'], posterAngles: ['angle'], ...over
  };
}

const CORPUS = [
  makeEntry({
    id: 'gdpr-breach-notification', framework: 'GDPR', citation: 'Art. 33', level: 0, region: 'EU',
    title: 'Personal Data Breach Notification to the Supervisory Authority',
    summary: 'Controllers must notify the supervisory authority of a personal data breach within 72 hours.',
    text: 'Where feasible the breach notification is made within 72 hours of becoming aware of a personal data breach.',
    obligations: ['Notify the supervisory authority within 72 hours', 'Document every breach'],
    penalties: 'Up to 10 million euros or 2% of global turnover',
    topics: ['breach notification', 'data breach', 'supervisory authority'],
    posterAngles: ['Report a breach within 72 hours']
  }),
  makeEntry({
    id: 'gdpr-consent', framework: 'GDPR', citation: 'Art. 7', level: 0, region: 'EU',
    title: 'Conditions for Consent',
    summary: 'Consent must be freely given, specific, informed and unambiguous.',
    text: 'The controller must be able to demonstrate that the data subject consented to processing of personal data.',
    obligations: ['Obtain unambiguous consent'], penalties: null,
    topics: ['consent', 'lawful basis'], posterAngles: ['Consent must be a clear yes']
  }),
  makeEntry({
    id: 'gdpr-edpb-guidance', framework: 'GDPR', citation: 'EDPB Guidelines 9/2022', level: 1, region: 'EU',
    title: 'EDPB Guidance on Breach Notification Timelines',
    summary: 'Guidance clarifying when the 72-hour breach notification clock starts.',
    text: 'The clock starts when the controller becomes aware with reasonable certainty of a breach.',
    obligations: ['Assess awareness promptly'], penalties: null,
    topics: ['breach notification', 'guidance'], posterAngles: ['Know when the clock starts']
  }),
  makeEntry({
    id: 'dpdp-breach', framework: 'DPDP', citation: 'Section 8(6)', level: 0, region: 'IN',
    title: 'Intimation of Personal Data Breach',
    summary: 'A Data Fiduciary must intimate the Data Protection Board of a personal data breach.',
    text: 'On becoming aware of a personal data breach the Data Fiduciary shall intimate the Board and each affected Data Principal.',
    obligations: ['Intimate the Board', 'Intimate affected principals'],
    penalties: 'Up to 250 crore rupees',
    topics: ['breach notification', 'data fiduciary'], posterAngles: ['Report breaches to the Board']
  }),
  makeEntry({
    id: 'dpdp-consent', framework: 'DPDP', citation: 'Section 6', level: 0, region: 'IN',
    title: 'Consent under the DPDP Act',
    summary: 'Consent must be free, specific, informed, unconditional and unambiguous with a clear affirmative action.',
    text: 'The Data Principal gives consent through a clear affirmative action for the specified purpose.',
    obligations: ['Obtain affirmative consent'], penalties: null,
    topics: ['consent', 'data principal'], posterAngles: ['Consent is an active choice']
  }),
  makeEntry({
    id: 'dpdp-board-guidance', framework: 'DPDP', citation: 'DPB Advisory 2024', level: 1, region: 'IN',
    title: 'Board Advisory on Grievance Redressal',
    summary: 'Advisory on how Data Fiduciaries should operate grievance redressal mechanisms.',
    text: 'Fiduciaries should acknowledge grievances promptly and respond within the prescribed period.',
    obligations: ['Run a grievance mechanism'], penalties: null,
    topics: ['grievance', 'guidance'], posterAngles: ['Log every data complaint']
  })
];

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

test('migration creates knowledge table and knowledge_fts index', () => {
  const db = freshDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table') AND name IN ('knowledge','knowledge_fts')").all().map((r) => r.name);
  assert.ok(tables.includes('knowledge'), 'knowledge table exists');
  assert.ok(tables.includes('knowledge_fts'), 'knowledge_fts virtual table exists');
  // schema_version bumped to include v7
  const versions = db.prepare('SELECT version FROM schema_version').all().map((r) => r.version);
  assert.ok(versions.includes(7), 'schema_version records v7');
});

test('fixture corpus is valid against the shared contract', () => {
  const report = validateCorpus(CORPUS);
  assert.ok(report.ok, `fixture must be valid: ${report.problems.join('; ')}`);
  assert.equal(report.count, 6);
});

test('seedKnowledge rejects an invalid corpus with problems', () => {
  const db = freshDb();
  const bad = [...CORPUS, makeEntry({ id: '', framework: 'NOPE', topics: [] })];
  assert.throws(
    () => seedKnowledge(db, bad),
    (err) => err.code === 'KNOWLEDGE_CORPUS_INVALID' && Array.isArray(err.problems) && err.problems.length > 0
  );
  // nothing written on validation failure
  assert.equal(db.prepare('SELECT COUNT(*) c FROM knowledge').get().c, 0);
});

test('seedKnowledge is idempotent (INSERT OR REPLACE by id) and keeps FTS in sync', () => {
  const db = freshDb();
  const first = seedKnowledge(db, CORPUS);
  assert.equal(first.seeded, 6);
  const second = seedKnowledge(db, CORPUS);
  assert.equal(second.seeded, 6);

  assert.equal(db.prepare('SELECT COUNT(*) c FROM knowledge').get().c, 6, 'no duplicate rows');
  const ftsCount = db.prepare('SELECT COUNT(*) c FROM knowledge_fts').get().c;
  assert.equal(ftsCount, 6, 'FTS row count matches table after re-seed');
});

test('retrieveKnowledge FTS-matches and ranks the right entry first', () => {
  const db = freshDb();
  seedKnowledge(db, CORPUS);
  const hits = retrieveKnowledge({ db, keywords: ['consent'], limit: 10 });
  assert.ok(hits.length >= 2, 'both consent entries match');
  // every hit carries a numeric per-hit score and rehydrated arrays
  for (const h of hits) {
    assert.equal(typeof h.score, 'number');
    assert.ok(Array.isArray(h.obligations));
    assert.ok(h.topics.includes('consent'), 'topic overlap present on consent hits');
  }
  // consent entries outrank the breach ones for a consent query
  const ids = hits.map((h) => h.id);
  assert.ok(ids.includes('gdpr-consent') && ids.includes('dpdp-consent'));
  assert.ok(!ids.slice(0, 2).includes('gdpr-breach-notification'), 'breach entry not top for consent query');
});

test('framework / region / level filters constrain results', () => {
  const db = freshDb();
  seedKnowledge(db, CORPUS);

  const gdprOnly = retrieveKnowledge({ db, keywords: ['breach', 'consent'], frameworks: ['GDPR'] });
  assert.ok(gdprOnly.length > 0);
  assert.ok(gdprOnly.every((h) => h.framework === 'GDPR'), 'framework filter honored');

  const inOnly = retrieveKnowledge({ db, keywords: ['breach', 'consent'], regions: ['IN'] });
  assert.ok(inOnly.length > 0);
  assert.ok(inOnly.every((h) => h.region === 'IN'), 'region filter honored');

  const l1Only = retrieveKnowledge({ db, keywords: ['breach', 'grievance', 'guidance'], levels: [1] });
  assert.ok(l1Only.length > 0);
  assert.ok(l1Only.every((h) => h.level === 1), 'level filter honored');
});

test('retrieveKnowledge returns [] for empty terms and unmatched queries', () => {
  const db = freshDb();
  seedKnowledge(db, CORPUS);
  assert.deepEqual(retrieveKnowledge({ db, keywords: [] }), []);
  assert.deepEqual(retrieveKnowledge({ db, query: '   ' }), []);
  assert.deepEqual(retrieveKnowledge({ db, keywords: ['nonexistentxyz'] }), []);
  // FTS syntax chars must be neutralized, never throw
  assert.ok(Array.isArray(retrieveKnowledge({ db, keywords: ['title:AND('] })));
});

test('reciprocalRankFusion merges lists, dedups by id, and ranks by fused score', () => {
  const knowledge = [{ id: 'k-a' }, { id: 'k-b' }, { id: 'shared' }];
  const articles = [{ id: 'shared' }, { id: 'a-x' }];
  const fused = reciprocalRankFusion([
    { items: knowledge, idOf: (o) => o.id, level: 0 },
    { items: articles, idOf: (o) => o.id, level: 2 }
  ]);
  const ids = fused.map((f) => f.id);
  // dedup: 'shared' appears once
  assert.equal(ids.filter((i) => i === 'shared').length, 1);
  assert.equal(fused.length, 4);
  // 'shared' ranks in both lists so its fused score beats single-list items
  const shared = fused.find((f) => f.id === 'shared');
  assert.equal(shared.sources.length, 2);
  assert.equal(ids[0], 'shared', 'item present in both lists fuses to the top');
});

test('retrieveMultiLevel fuses knowledge + article rows and dedups', () => {
  const db = freshDb();
  seedKnowledge(db, CORPUS);
  upsertArticles(db, [
    {
      title: 'Data Breach at Firm Exposes Consent Records',
      source: 'Test', sourceId: 'test', tier: 3,
      url: 'https://example.com/breach-consent',
      description: 'A personal data breach exposed consent records and triggered notification duties.',
      pubDate: new Date().toISOString().split('T')[0], type: 'Security News', relevanceScore: 10
    }
  ]);
  const { fused, knowledge, articles } = retrieveMultiLevel({ db, keywords: ['breach', 'consent'], levels: [0, 1], limit: 20 });
  assert.ok(knowledge.length > 0, 'knowledge path populated');
  assert.ok(articles.length > 0, 'article path populated');
  assert.ok(fused.length > 0);
  // knowledge ids namespaced k:, article ids namespaced a: — no cross collisions
  const ids = fused.map((f) => f.id);
  assert.ok(ids.some((i) => i.startsWith('k:')), 'fused list contains knowledge hits');
  assert.ok(ids.some((i) => i.startsWith('a:')), 'fused list contains article hits');
  assert.equal(new Set(ids).size, ids.length, 'fused list has no duplicate ids');
  for (const f of fused) assert.equal(typeof f.rrfScore, 'number');
});

// ── context_file citations ────────────────────────────────────────────────────
class FakeEgress {
  constructor(responses) { this.responses = [...responses]; this.calls = []; }
  async completeJson(opts, ctx) { this.calls.push({ opts, ctx }); return this.responses.shift(); }
}
const VALID_OUTPUT = {
  keywords: { core: ['breach'], expanded: ['notification'], contentShape: null },
  synthesis: 'Employees must report a suspected personal data breach immediately so the organization can meet its notification duties. The exact clock and authority differ by regime but the employee behaviour is the same: report fast, preserve evidence, never conceal.',
  angles: [
    { id: 'angle-1', title: 'Report a breach fast', rationale: 'Notification deadlines start when anyone knows.' },
    { id: 'angle-2', title: 'Preserve the evidence', rationale: 'Logs and files support the required report.' },
    { id: 'angle-3', title: 'Never conceal an incident', rationale: 'Concealment compounds the violation.' }
  ]
};
const FAKE_ARTICLES = [{
  id: 5, title: 'Breach Reporting in Practice', source: 'Test', url: 'https://example.com/x',
  pub_date: '2026-07-01', relevance_score: 10, description: 'How teams handle breach reporting.'
}];

test('buildContextFile emits citations from knowledge hits and weaves provisions into the prompt', async () => {
  const db = freshDb();
  seedKnowledge(db, CORPUS);
  const knowledge = retrieveKnowledge({ db, keywords: ['breach', 'notification'], limit: 3 });
  assert.ok(knowledge.length > 0);

  const egress = new FakeEgress([VALID_OUTPUT]);
  const result = await buildContextFile({
    db: null, egress, runId: 'run-k1', topic: 'breach notification',
    keywords: ['breach'], articles: FAKE_ARTICLES, knowledge
  });

  // citations assembled locally from the knowledge hits (never from the model)
  assert.ok(Array.isArray(result.citations) && result.citations.length === knowledge.length);
  for (const c of result.citations) {
    assert.ok(typeof c.citation === 'string' && c.citation.length);
    assert.ok(typeof c.framework === 'string' && c.framework.length);
    assert.ok(typeof c.id === 'string' && c.id.length);
  }
  // provisions woven into the synthesis-support material of the prompt
  const prompt = egress.calls[0].opts.user;
  assert.match(prompt, /AUTHORITATIVE PROVISIONS/);
  assert.match(prompt, new RegExp(knowledge[0].citation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  // existing fields still present and unchanged in shape
  assert.equal(result.topic, 'breach notification');
  assert.equal(result.angles.length, 3);
  assert.equal(result.sources.length, 1);
});

test('buildContextFile without knowledge yields an empty citations array (additive, non-breaking)', async () => {
  const egress = new FakeEgress([VALID_OUTPUT]);
  const result = await buildContextFile({
    db: null, egress, runId: 'run-k2', topic: 'breach notification',
    keywords: ['breach'], articles: FAKE_ARTICLES
  });
  assert.deepEqual(result.citations, []);
  // prompt has no authoritative-provisions block when no knowledge supplied
  assert.ok(!egress.calls[0].opts.user.includes('AUTHORITATIVE PROVISIONS'));
});

// ── backward compat: old retrieve() shape unchanged ──────────────────────────
test('old retrieve() over articles still returns its original blended shape', () => {
  const db = freshDb();
  seedKnowledge(db, CORPUS); // knowledge present must not affect the article path
  upsertArticles(db, [{
    title: 'Phishing Wave Targets Staff Passwords',
    source: 'Test', sourceId: 'test', tier: 3, url: 'https://example.com/phish',
    description: 'A phishing campaign asks staff to revalidate passwords on a fake portal.',
    pubDate: new Date().toISOString().split('T')[0], type: 'Phishing', relevanceScore: 15
  }]);
  const results = retrieve(db, ['phishing'], { limit: 10 });
  assert.equal(results.length, 1);
  const r = results[0];
  assert.ok(typeof r.ftsNorm === 'number');
  assert.ok(typeof r.scoringPoints === 'number');
  assert.ok(r.recencyWeight > 0 && r.recencyWeight <= 1);
  assert.equal(r.finalScore, r.ftsNorm + r.scoringPoints + 10 * r.recencyWeight);
  assert.ok(r.title && r.url && r.pub_date);
  // no knowledge fields leaked into an article row
  assert.equal(r.citation, undefined);
  assert.equal(r.score, undefined);
});
