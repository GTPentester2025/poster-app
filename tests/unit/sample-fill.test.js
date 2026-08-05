// Sample-canvas image fill: slots dress in matched real library images,
// deterministically, and degrade to placeholders when the library is empty.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { fillSampleSlots } from '../../backend/sample-fill.js';

function makeDb(rows = []) {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE images (
    image_id TEXT PRIMARY KEY, file_name TEXT, origin TEXT, topics TEXT, style TEXT,
    palette TEXT, format TEXT, zero_text_checked INTEGER, zero_text_passed INTEGER,
    created_at TEXT, meta TEXT)`);
  const ins = db.prepare('INSERT INTO images (image_id, topics, style, zero_text_passed, meta) VALUES (?, ?, ?, ?, ?)');
  for (const r of rows) ins.run(r.id, JSON.stringify(r.topics), r.style || null, r.pass ?? 1, r.meta ? JSON.stringify(r.meta) : null);
  return db;
}

function slotCanvas() {
  return {
    width: 1414, height: 2000, background: '#FFF',
    objects: [
      { type: 'Rect', layerRole: 'image-slot', slotId: 'bg', left: 0, top: 0, width: 1414, height: 2000,
        slotSpec: { slotId: 'bg', styleHint: 'phishing email atmosphere, dark backdrop' } },
      { type: 'Rect', layerRole: 'image-slot', slotId: 'slot-1', left: 100, top: 100, width: 600, height: 400, rx: 16,
        slotSpec: { slotId: 'slot-1', styleHint: 'usb stick on desk' } },
      { type: 'Textbox', layerRole: 'headline', text: 'Hi', left: 0, top: 0, width: 500, fontSize: 40 }
    ]
  };
}

test('content slots become cover-fit Images; the bg slot stays an empty placeholder', () => {
  const db = makeDb([
    { id: 'img-usb', topics: ['usb security', 'usb', 'removable media'] },
    { id: 'img-phish', topics: ['phishing', 'email'], meta: { width: 1024, height: 1536 } }
  ]);
  const canvas = fillSampleSlots(db, slotCanvas(), 'tpl-x');
  const images = canvas.objects.filter((o) => o.type === 'Image');
  assert.equal(images.length, 1, 'only the content slot fills — bg stays clean for later');
  const bySlot = Object.fromEntries(images.map((o) => [o.slotId, o]));
  assert.equal(bySlot['slot-1'].imageId, 'img-usb', 'usb hint matches usb image');
  assert.ok(canvas.objects.some((o) => o.layerRole === 'image-slot' && o.slotId === 'bg'), 'bg placeholder preserved');
  // cover-fit: scaled image covers the slot frame; clipPath crops to it
  const s1 = bySlot['slot-1'];
  assert.ok(s1.width * s1.scaleX >= 600 - 1 && s1.height * s1.scaleY >= 400 - 1);
  assert.equal(s1.clipPath.width, 600);
  assert.equal(s1.clipPath.rx, 16);
  assert.match(s1.src, /^\/api\/images\/file\/img-usb$/);
  // headline untouched
  assert.ok(canvas.objects.some((o) => o.layerRole === 'headline'));
});

test('deterministic: same template+slot always picks the same image', () => {
  const rows = [1, 2, 3, 4, 5].map((i) => ({ id: `img-${i}`, topics: ['generic'] }));
  const a = fillSampleSlots(makeDb(rows), slotCanvas(), 'tpl-a').objects.find((o) => o.slotId === 'slot-1');
  const b = fillSampleSlots(makeDb(rows), slotCanvas(), 'tpl-a').objects.find((o) => o.slotId === 'slot-1');
  assert.equal(a.imageId, b.imageId);
});

test('empty library / failed zero-text → placeholders stay', () => {
  const db = makeDb([{ id: 'img-bad', topics: ['anything'], pass: 0 }]);
  const canvas = fillSampleSlots(db, slotCanvas(), 'tpl-x');
  assert.equal(canvas.objects.filter((o) => o.type === 'Image').length, 0);
  assert.equal(canvas.objects.filter((o) => o.layerRole === 'image-slot').length, 2);
});
