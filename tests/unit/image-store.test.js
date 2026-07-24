// Image library store tests (spec §B.7): save writes a real PNG file +
// metadata row; listImages orders relevant-first (topic overlap DESC, then
// recency); getImagePath builds paths from ids only; delete removes row+file
// (missing file tolerated); markZeroTextCheck flips the gate fields.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../../backend/db.js';
import {
  saveImage, listImages, getImagePath, deleteImage, markZeroTextCheck
} from '../../image-library/store.js';
import { IMAGE_BASE64, pngOfSize } from './helpers/fake_egress.js';

// Real 1x1 transparent PNG — valid PNG magic bytes
const PNG_BUF = Buffer.from(IMAGE_BASE64, 'base64');

function makeDb() {
  const dir = mkdtempSync(join(tmpdir(), 'postter-store-'));
  return { db: openDb(join(dir, 'test.sqlite')), dir };
}

test('saveImage: writes file, inserts row, returns record', async () => {
  const { db, dir } = makeDb();
  const assetsDir = join(dir, 'assets');
  const rec = await saveImage({ db, buffer: PNG_BUF, origin: 'library', topics: ['phishing'], style: 'flat-icon', format: 'icon', meta: { source: 'test' }, assetsDir });
  assert.ok(rec.image_id, 'image_id assigned');
  assert.equal(rec.origin, 'library');
  assert.deepEqual(JSON.parse(rec.topics), ['phishing']);
  assert.equal(rec.style, 'flat-icon');
  assert.equal(rec.format, 'icon');
  assert.equal(rec.zero_text_checked, 0);
  assert.equal(rec.zero_text_passed, 0);
  assert.ok(rec.created_at);
  const filePath = getImagePath(rec.image_id, assetsDir);
  assert.ok(existsSync(filePath), 'file written to disk');
  const onDisk = readFileSync(filePath);
  assert.ok(onDisk.slice(0, 4).toString('latin1') === '\x89PNG', 'real PNG magic bytes on disk');
});

test('saveImage: records real pixel dims from the buffer into meta', async () => {
  const { db, dir } = makeDb();
  const assetsDir = join(dir, 'assets');
  // a PNG whose IHDR encodes 1024x1536 (aspect-correct portrait render)
  const buf = Buffer.from(pngOfSize(1024, 1536), 'base64');
  const rec = await saveImage({ db, buffer: buf, origin: 'generated', topics: [], assetsDir });
  const meta = JSON.parse(rec.meta);
  assert.equal(meta.width, 1024, 'width parsed from IHDR');
  assert.equal(meta.height, 1536, 'height parsed from IHDR');
});

test('listImages: relevant-first ordering — matching topics before non-matching', async () => {
  const { db, dir } = makeDb();
  const assetsDir = join(dir, 'assets');
  // three images: first has 2 matching topics, second has 1, third has 0
  const a = await saveImage({ db, buffer: PNG_BUF, origin: 'library', topics: ['phishing', 'email'], style: null, format: null, meta: null, assetsDir });
  const b = await saveImage({ db, buffer: PNG_BUF, origin: 'library', topics: ['phishing'], style: null, format: null, meta: null, assetsDir });
  const c = await saveImage({ db, buffer: PNG_BUF, origin: 'library', topics: ['wireless'], style: null, format: null, meta: null, assetsDir });

  const results = listImages({ db, topics: ['phishing', 'email'] });
  assert.equal(results.length, 3, 'all images returned (no hard filter)');
  assert.equal(results[0].image_id, a.image_id, 'most topic overlap first');
  assert.equal(results[1].image_id, b.image_id, 'second most overlap second');
  assert.equal(results[2].image_id, c.image_id, 'zero overlap last');
});

test('listImages: no topics filter returns all images, most recent first', async () => {
  const { db, dir } = makeDb();
  const assetsDir = join(dir, 'assets');
  await saveImage({ db, buffer: PNG_BUF, origin: 'library', topics: ['phishing'], style: null, format: null, meta: null, assetsDir });
  const b = await saveImage({ db, buffer: PNG_BUF, origin: 'generated', topics: ['wireless'], style: null, format: null, meta: null, assetsDir });
  const results = listImages({ db });
  assert.equal(results.length, 2);
  assert.equal(results[0].image_id, b.image_id, 'most recent first when no topic query');
});

test('getImagePath: returns path under assetsDir using only the image_id', () => {
  const assetsDir = join('some', 'assets');
  const path = getImagePath('my-image-id', assetsDir);
  assert.equal(path, join('some', 'assets', 'my-image-id.png'));
  // path traversal: client-supplied filenames never reach this function —
  // routes look the id up in the DB first (route tests verify DB-id-only lookup)
});

test('deleteImage: removes row and file; missing file is not an error', async () => {
  const { db, dir } = makeDb();
  const assetsDir = join(dir, 'assets');
  const rec = await saveImage({ db, buffer: PNG_BUF, origin: 'library', topics: [], style: null, format: null, meta: null, assetsDir });
  const filePath = getImagePath(rec.image_id, assetsDir);
  assert.ok(existsSync(filePath));
  deleteImage(db, rec.image_id, assetsDir);
  assert.ok(!existsSync(filePath), 'file removed');
  assert.equal(db.prepare('SELECT * FROM images WHERE image_id = ?').get(rec.image_id), undefined, 'row removed');
  // calling again with missing file must not throw
  deleteImage(db, rec.image_id, assetsDir);
});

test('markZeroTextCheck: updates zero_text_checked and zero_text_passed', async () => {
  const { db, dir } = makeDb();
  const assetsDir = join(dir, 'assets');
  const rec = await saveImage({ db, buffer: PNG_BUF, origin: 'generated', topics: ['phishing'], style: null, format: null, meta: null, assetsDir });
  assert.equal(rec.zero_text_checked, 0);
  markZeroTextCheck(db, rec.image_id, true);
  const updated = db.prepare('SELECT * FROM images WHERE image_id = ?').get(rec.image_id);
  assert.equal(updated.zero_text_checked, 1);
  assert.equal(updated.zero_text_passed, 1);
  markZeroTextCheck(db, rec.image_id, false);
  const failed = db.prepare('SELECT * FROM images WHERE image_id = ?').get(rec.image_id);
  assert.equal(failed.zero_text_passed, 0);
});
