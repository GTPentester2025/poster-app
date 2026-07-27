// Seed-on-first-run: the runtime DB is copied from the committed read-only seed
// only when it does not yet exist, so a fresh checkout gets the shipped posters
// while an existing runtime DB (live data) is never clobbered.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedIfAbsent } from '../../backend/seed-db.js';
import { openDb } from '../../backend/db.js';
import { createAppContext } from '../../backend/app-context.js';

function freshDir() {
  return mkdtempSync(join(tmpdir(), 'postter-seed-'));
}

test('seedIfAbsent copies the seed when the runtime DB is absent', () => {
  const dir = freshDir();
  const seed = join(dir, 'poster-seed.sqlite');
  const runtime = join(dir, 'poster-app.sqlite');
  writeFileSync(seed, 'SEED-BYTES');
  assert.equal(seedIfAbsent(runtime, seed), true);
  assert.equal(existsSync(runtime), true);
  assert.equal(readFileSync(runtime, 'utf8'), 'SEED-BYTES');
});

test('seedIfAbsent is a no-op when the runtime DB already exists', () => {
  const dir = freshDir();
  const seed = join(dir, 'poster-seed.sqlite');
  const runtime = join(dir, 'poster-app.sqlite');
  writeFileSync(seed, 'SEED-BYTES');
  writeFileSync(runtime, 'LIVE-BYTES');
  assert.equal(seedIfAbsent(runtime, seed), false);
  assert.equal(readFileSync(runtime, 'utf8'), 'LIVE-BYTES'); // not clobbered
});

test('seedIfAbsent is a no-op when no seed is present', () => {
  const dir = freshDir();
  const runtime = join(dir, 'poster-app.sqlite');
  assert.equal(seedIfAbsent(runtime, join(dir, 'poster-seed.sqlite')), false);
  assert.equal(existsSync(runtime), false);
});

test('seedIfAbsent ignores the in-memory DB path', () => {
  const dir = freshDir();
  const seed = join(dir, 'poster-seed.sqlite');
  writeFileSync(seed, 'SEED-BYTES');
  assert.equal(seedIfAbsent(':memory:', seed), false);
});

test('createAppContext seeds the runtime DB from poster-seed.sqlite on first run', () => {
  const dir = freshDir();
  // Build a schema-valid seed with one poster (openDb runs the migrations).
  const seed = openDb(join(dir, 'poster-seed.sqlite'));
  seed.prepare('INSERT INTO posters (poster_id,name,status,created_at,updated_at,doc) VALUES (?,?,?,?,?,?)')
    .run('p1', 'seeded', 'draft', '2026-01-01', '2026-01-01', '{}');
  seed.close();

  assert.equal(existsSync(join(dir, 'poster-app.sqlite')), false, 'runtime absent before context');
  const ctx = createAppContext({ dataDir: dir, logDir: join(dir, 'runs') });
  try {
    assert.equal(existsSync(join(dir, 'poster-app.sqlite')), true, 'runtime seeded into place');
    assert.equal(ctx.db.prepare('SELECT COUNT(*) c FROM posters').get().c, 1);
    assert.equal(ctx.db.prepare('SELECT name FROM posters').get().name, 'seeded');
  } finally { ctx.db.close(); }
});

test('createAppContext does not overwrite an existing runtime DB', () => {
  const dir = freshDir();
  const seed = openDb(join(dir, 'poster-seed.sqlite'));
  seed.prepare('INSERT INTO posters (poster_id,name,status,created_at,updated_at,doc) VALUES (?,?,?,?,?,?)')
    .run('p1', 'seeded', 'draft', '2026-01-01', '2026-01-01', '{}');
  seed.close();
  const rt = openDb(join(dir, 'poster-app.sqlite'));
  rt.prepare('INSERT INTO posters (poster_id,name,status,created_at,updated_at,doc) VALUES (?,?,?,?,?,?)')
    .run('mine', 'mine', 'saved', '2026-02-02', '2026-02-02', '{}');
  rt.close();

  const ctx = createAppContext({ dataDir: dir, logDir: join(dir, 'runs') });
  try {
    const names = ctx.db.prepare('SELECT name FROM posters ORDER BY name').all().map((r) => r.name);
    assert.deepEqual(names, ['mine'], 'existing runtime data preserved, seed not applied');
  } finally { ctx.db.close(); }
});
