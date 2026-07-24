// Backfill script tests (client escalation #3d). Runs the deterministic backfill
// against a TEMP DB (never the real one): images missing meta.description get a
// derived description + tags from their stored concept/meta; rows that already
// have a description are skipped; the --vision path uses the tagger agent.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../../backend/db.js';
import { saveImage, markZeroTextCheck } from '../../image-library/store.js';
import { backfillAssetTags } from '../../scripts/backfill_asset_tags.mjs';
import { FakeEgress, IMAGE_BASE64 } from './helpers/fake_egress.js';

function tempDb() {
  const dir = mkdtempSync(join(tmpdir(), 'postter-backfill-'));
  return { db: openDb(join(dir, 'test.sqlite')), assetsDir: join(dir, 'assets') };
}

async function seedAsset(db, assetsDir, meta) {
  const rec = await saveImage({
    db, buffer: Buffer.from(IMAGE_BASE64, 'base64'), origin: 'generated', topics: meta.topics || [], meta, assetsDir
  });
  markZeroTextCheck(db, rec.image_id, true);
  return rec;
}

test('backfill: derives description + tags for rows missing meta.description (deterministic, no cost)', async () => {
  const { db, assetsDir } = tempDb();
  // legacy asset: no description, but a stored concept + topics
  const rec = await seedAsset(db, assetsDir, {
    styleHint: 'a magnifying glass over a sender-address bar with the domain highlighted',
    topics: ['phishing', 'email security'],
    sizeClass: 'card'
  });

  const summary = await backfillAssetTags({ db, assetsDir });
  assert.equal(summary.updated, 1, 'one row backfilled');
  assert.equal(summary.visionUsed, 0, 'no vision calls in deterministic mode');

  const meta = JSON.parse(db.prepare('SELECT meta FROM images WHERE image_id = ?').get(rec.image_id).meta);
  assert.match(meta.description, /magnifying glass over a sender-address bar/, 'concept became the description');
  assert.ok(Array.isArray(meta.tags) && meta.tags.length >= 3, 'tags derived');
  assert.ok(meta.tags.includes('phishing'), 'topic folded into tags');
});

test('backfill: skips rows that already have a description', async () => {
  const { db, assetsDir } = tempDb();
  await seedAsset(db, assetsDir, { description: 'already described', tags: ['x', 'y'], topics: ['phishing'] });

  const summary = await backfillAssetTags({ db, assetsDir });
  assert.equal(summary.updated, 0, 'nothing updated');
  assert.equal(summary.skipped, 1, 'the described row was skipped');
});

test('backfill: --dry-run computes but does not write', async () => {
  const { db, assetsDir } = tempDb();
  const rec = await seedAsset(db, assetsDir, { styleHint: 'a padlock on a laptop', topics: ['device security'] });

  const summary = await backfillAssetTags({ db, assetsDir, dryRun: true });
  assert.equal(summary.updated, 1, 'counted as updated');
  const meta = JSON.parse(db.prepare('SELECT meta FROM images WHERE image_id = ?').get(rec.image_id).meta);
  assert.ok(!meta.description, 'dry-run left the row unwritten');
});

test('backfill: --vision path uses the tagger agent for description + tags', async () => {
  const { db, assetsDir } = tempDb();
  const rec = await seedAsset(db, assetsDir, { topics: ['phishing'] }); // no concept at all

  const egress = new FakeEgress({
    'image-tagger/classify_image': {
      topics: ['phishing'], style: 'illustration', format: 'illustration',
      description: 'a vivid vision-derived scene of a hand checking a sender address',
      tags: ['sender address', 'domain check', 'phishing', 'hand', 'email']
    }
  });

  const summary = await backfillAssetTags({ db, egress, vision: true, assetsDir });
  assert.equal(summary.updated, 1);
  assert.equal(summary.visionUsed, 1, 'vision tagger consulted');
  const meta = JSON.parse(db.prepare('SELECT meta FROM images WHERE image_id = ?').get(rec.image_id).meta);
  assert.match(meta.description, /vision-derived scene of a hand checking a sender address/);
  assert.ok(meta.tags.includes('sender address'), 'vision tags stored');
});

test('backfill: limit caps the number of rows processed', async () => {
  const { db, assetsDir } = tempDb();
  await seedAsset(db, assetsDir, { styleHint: 'concept one', topics: ['a'] });
  await seedAsset(db, assetsDir, { styleHint: 'concept two', topics: ['b'] });

  const summary = await backfillAssetTags({ db, assetsDir, limit: 1 });
  assert.equal(summary.updated, 1, 'only one row updated under limit=1');
});
