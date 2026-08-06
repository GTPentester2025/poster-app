// Template Recommender tests (step-2 "AI picks the template"): deterministic
// impact-ranked fallback always returns a valid id; a valid model pick is used;
// an invalid/unknown model id falls back; topic-shape hints steer the pick.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendTemplate } from '../../agents/template_recommender.js';
import { FakeEgress } from './helpers/fake_egress.js';

const TEMPLATES = [
  { id: 'cinematic-cover', style: 'statement', kind: 'single', name: 'Cinematic cover', description: 'x' },
  { id: 'editorial-hero', style: 'infographic', kind: 'sequence', name: 'Editorial hero', description: 'x' },
  { id: 'image-mosaic', style: 'infographic', kind: 'panels', name: 'Image mosaic', description: 'x' },
  { id: 'stats-impact', style: 'stats', kind: 'stats', name: 'Stats impact', description: 'x' },
  { id: 'qa-chat', style: 'qa', kind: 'qa-pairs', name: 'Q&A chat', description: 'x' }
];
const ids = new Set(TEMPLATES.map((t) => t.id));

test('recommendTemplate: no egress → deterministic, always a valid id', async () => {
  const r = await recommendTemplate({ prompt: 'general phishing awareness', templates: TEMPLATES });
  assert.ok(ids.has(r.templateId), 'valid id');
  assert.ok(r.reason);
});

test('recommendTemplate: topic-shape hints steer the impact pick', async () => {
  assert.equal((await recommendTemplate({ prompt: '91% of breaches start with a click — the numbers', templates: TEMPLATES })).templateId, 'stats-impact');
  assert.equal((await recommendTemplate({ prompt: 'how to report a phishing email step by step', templates: TEMPLATES })).templateId, 'editorial-hero');
  assert.equal((await recommendTemplate({ prompt: 'dos and don’ts of USB media, red flags', templates: TEMPLATES })).templateId, 'image-mosaic');
});

test('recommendTemplate: uses a valid model pick; unknown id → fallback', async () => {
  const good = new FakeEgress({ 'template-recommender/recommend_template': JSON.stringify({ templateId: 'qa-chat', reason: 'fits Q&A' }) });
  const r = await recommendTemplate({ egress: good, runId: 'r', prompt: 'phishing', templates: TEMPLATES });
  assert.equal(r.templateId, 'qa-chat');
  assert.match(r.reason, /Q&A/);

  const bad = new FakeEgress({ 'template-recommender/recommend_template': JSON.stringify({ templateId: 'not-a-real-template' }) });
  const r2 = await recommendTemplate({ egress: bad, runId: 'r', prompt: 'phishing', templates: TEMPLATES });
  assert.ok(ids.has(r2.templateId), 'unknown model id → valid fallback');
});

test('recommendTemplate: model throwing → fallback, never rejects', async () => {
  const egress = new FakeEgress({ 'template-recommender/recommend_template': () => { throw new Error('boom'); } });
  const r = await recommendTemplate({ egress, runId: 'r', prompt: 'phishing', templates: TEMPLATES });
  assert.ok(ids.has(r.templateId));
});
