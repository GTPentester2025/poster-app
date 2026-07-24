// buildContextFile tests with a fake egress: happy path, single-retry repair
// when the model omits required fields, hard failure after two bad responses,
// and source attribution assembled locally (never trusted from the model).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContextFile } from '../../rag/context_file.js';

class FakeEgress {
  constructor(responses) {
    this.responses = [...responses];
    this.calls = [];
  }
  async completeJson(opts, ctx) {
    this.calls.push({ opts, ctx });
    if (!this.responses.length) throw new Error('FakeEgress exhausted');
    return this.responses.shift();
  }
}

const ARTICLES = [
  {
    id: 12, title: 'QR Code Phishing Surges as Attackers Bypass Email Link Filters',
    source: 'Proofpoint Blog', url: 'https://www.proofpoint.com/us/blog/qr-code-phishing-surge',
    pub_date: '2026-07-12', relevance_score: 22, recencyWeight: 0.9,
    description: 'Quishing campaigns embed malicious QR codes in PDF attachments, steering employees to credential-harvesting pages that mimic corporate SSO portals.',
    summary: 'QR lures evade URL scanners; employees should treat QR codes in email like links.'
  },
  {
    id: 27, title: 'Phishing Kit Relays MFA Codes in Real Time to Defeat One-Time Passcodes',
    source: 'The Hacker News', url: 'https://thehackernews.com/2026/07/mfa-relay-phishing-kit.html',
    pub_date: '2026-07-09', relevance_score: 18, recencyWeight: 0.82,
    description: 'An adversary-in-the-middle kit proxies the real login page, capturing passwords and one-time codes as victims type them.'
  }
];

const VALID_OUTPUT = {
  topic: 'phishing',
  keywords: {
    core: ['phishing'],
    expanded: ['quishing', 'qr code', 'mfa fatigue', 'adversary-in-the-middle'],
    contentShape: 'red-flags'
  },
  synthesis: 'Attackers are shifting phishing delivery away from bare links toward QR codes and real-time MFA relay. Employees face two recurring situations: scanning a QR code from a work email on a personal phone, and approving an MFA prompt they did not initiate. Both defeat traditional advice that focuses only on hovering over links.',
  angles: [
    { id: 'angle-1', title: 'A QR code is a link you cannot read', rationale: 'QR lures bypass employee link-checking habits; poster can transfer the existing hover-to-check instinct to codes.' },
    { id: 'angle-2', title: 'Your MFA code is a password too', rationale: 'Real-time relay kits mean sharing or typing a one-time code on the wrong page equals giving away the account.' },
    { id: 'angle-3', title: 'Unexpected prompt? Stop and report', rationale: 'Push-approval fatigue is the common thread across current campaigns; a single stop-and-report behavior counters it.' }
  ]
};

test('happy path: one egress call, schema-shaped result, sources built from input rows', async () => {
  const egress = new FakeEgress([VALID_OUTPUT]);
  const result = await buildContextFile({
    db: null, egress, runId: 'run-777', topic: 'phishing', keywords: ['phishing', 'qr'], articles: ARTICLES
  });

  assert.equal(egress.calls.length, 1);
  // egress context must attribute the call to the RAG research stage
  assert.deepEqual(egress.calls[0].ctx, {
    runId: 'run-777', pipeline: 'content', stage: 'research-synthesis',
    agent: 'rag-research', skill: 'synthesize_context'
  });
  // prompt carries the article evidence and the internal-only instruction
  assert.match(egress.calls[0].opts.user, /QR Code Phishing Surges/);
  assert.match(egress.calls[0].opts.user, /internal-only/);
  assert.match(egress.calls[0].opts.user, /not attribute or cite sources/);

  assert.ok(result.contextId.startsWith('ctx-'));
  assert.equal(result.runId, 'run-777');
  assert.ok(result.createdAt);
  assert.equal(result.topic, 'phishing');
  assert.equal(result.keywords.contentShape, 'red-flags');
  assert.equal(result.angles.length, 3);
  // sources come from OUR rows, not the model
  assert.equal(result.sources.length, 2);
  assert.deepEqual(result.sources[0], {
    articleId: 12,
    title: 'QR Code Phishing Surges as Attackers Bypass Email Link Filters',
    source: 'Proofpoint Blog',
    url: 'https://www.proofpoint.com/us/blog/qr-code-phishing-surge',
    pubDate: '2026-07-12',
    relevanceScore: 22,
    recencyWeight: 0.9
  });
});

test('invalid first response triggers one retry with concrete feedback', async () => {
  const invalid = { topic: 'phishing', keywords: { core: ['phishing'], expanded: [] } }; // no synthesis/angles
  const egress = new FakeEgress([invalid, VALID_OUTPUT]);
  const result = await buildContextFile({
    db: null, egress, runId: 'run-778', topic: 'phishing', keywords: [], articles: ARTICLES
  });
  assert.equal(egress.calls.length, 2);
  assert.match(egress.calls[1].opts.user, /previous response was invalid/);
  assert.match(egress.calls[1].opts.user, /synthesis/);
  assert.equal(egress.calls[1].opts.temperature, 0); // deterministic repair attempt
  assert.equal(result.synthesis, VALID_OUTPUT.synthesis);
});

test('two invalid responses throw CONTEXT_FILE_INVALID', async () => {
  const bad1 = { topic: '', keywords: null, synthesis: 'x', angles: [] };
  const bad2 = { topic: 'phishing', keywords: { core: [] }, synthesis: 'short', angles: [{ id: 'a' }] };
  const egress = new FakeEgress([bad1, bad2]);
  await assert.rejects(
    buildContextFile({ db: null, egress, runId: 'run-779', topic: 'phishing', keywords: [], articles: ARTICLES }),
    (err) => err.code === 'CONTEXT_FILE_INVALID'
  );
  assert.equal(egress.calls.length, 2);
});

// ── topic fidelity (topic-hijack fix) ────────────────────────────────────────
// The article DB is security-news heavy, so retrieval hands phishing articles
// to ANY topic. The model's "normalized topic" used to overwrite the user's —
// GDPR runs became phishing posters. The user's intent topic is now
// authoritative and the model is never asked for a topic at all.

// Note: no "topic" field — the model is no longer asked for one.
const GDPR_OUTPUT = {
  keywords: {
    core: ['gdpr'],
    expanded: ['data protection', 'personal data', 'breach reporting'],
    contentShape: null
  },
  synthesis: 'GDPR sets employee-facing duties for handling personal data: collect only what the task needs, share it only with colleagues authorized to see it, and report any suspected exposure to the privacy team immediately. Most of the retrieved articles cover phishing and are tangential to this topic; the durable GDPR behaviours above hold regardless.',
  angles: [
    { id: 'angle-1', title: 'Personal data is need-to-know', rationale: 'Access discipline is the everyday GDPR behaviour employees control directly.' },
    { id: 'angle-2', title: 'Check the recipient before you send', rationale: 'A misdirected email with personal data is the most common reportable GDPR incident.' },
    { id: 'angle-3', title: 'Suspect exposure? Tell the privacy team now', rationale: 'Notification deadlines start when anyone in the company knows about a breach.' }
  ]
};

test('topic fidelity: gdpr + phishing-heavy articles → result.topic is the caller\'s topic, model\'s volunteered topic ignored', async () => {
  // the model volunteers topic 'phishing' (the old hijack) — it must be ignored
  const egress = new FakeEgress([{ ...GDPR_OUTPUT, topic: 'phishing' }]);
  const result = await buildContextFile({
    db: null, egress, runId: 'run-800', topic: ' GDPR ', keywords: ['gdpr'], articles: ARTICLES
  });
  assert.equal(egress.calls.length, 1);
  assert.equal(result.topic, 'gdpr', 'topic must be the lowercased/trimmed intent topic, never the model\'s');
  assert.equal(result.synthesis, GDPR_OUTPUT.synthesis);
  assert.equal(result.angles.length, 3);
});

test('topic fidelity: model output WITHOUT a topic field is valid (topic dropped from the schema)', async () => {
  const egress = new FakeEgress([GDPR_OUTPUT]);
  const result = await buildContextFile({
    db: null, egress, runId: 'run-801', topic: 'gdpr', keywords: ['gdpr'], articles: ARTICLES
  });
  assert.equal(egress.calls.length, 1, 'a missing topic must not trigger the retry');
  assert.equal(result.topic, 'gdpr');
});

test('topic fidelity: synthesis prompt anchors every angle to the user topic and no longer requests a model topic', async () => {
  const egress = new FakeEgress([GDPR_OUTPUT]);
  await buildContextFile({
    db: null, egress, runId: 'run-802', topic: 'gdpr', keywords: ['gdpr'], articles: ARTICLES
  });
  const user = egress.calls[0].opts.user;
  assert.match(user, /The user's topic is "gdpr"/);
  assert.match(user, /retrieved as POSSIBLE supporting context — they may be tangential or unrelated/);
  assert.match(user, /if an article is unrelated, ignore it entirely/);
  assert.match(user, /Every angle MUST teach "gdpr"/);
  assert.match(user, /a different security subject \(e\.g\. phishing when the topic is GDPR\) is a failure/);
  assert.match(user, /If fewer than 2 articles are genuinely relevant to "gdpr"/);
  // the JSON the model is asked for must not contain a topic slot at all
  assert.ok(!user.includes('"topic"'), 'requested JSON must not ask for a model-normalized topic');
  assert.ok(!user.includes('normalized core topic'), 'old normalization instruction must be gone');
});

test('I1 angle-relevance: synthesis prompt demands faithful treatment of broad or non-security topics', async () => {
  const egress = new FakeEgress([GDPR_OUTPUT]);
  await buildContextFile({
    db: null, egress, runId: 'run-803', topic: 'remote work etiquette', keywords: ['remote work'], articles: ARTICLES
  });
  const user = egress.calls[0].opts.user;
  // last round's anchoring still present…
  assert.match(user, /The user's topic is "remote work etiquette"/);
  assert.match(user, /Every angle MUST teach "remote work etiquette"/);
  // …extended with the angle-relevance rule for non-classic topics
  assert.match(user, /Angles must serve the USER'S topic even when it is not a classic security topic/);
  assert.match(user, /broad or non-security inputs get faithful treatment of the literal topic/);
});

test('unknown contentShape is normalized to null; no articles is a hard error', async () => {
  const withBadShape = {
    ...VALID_OUTPUT,
    keywords: { ...VALID_OUTPUT.keywords, contentShape: 'haiku' }
  };
  const egress = new FakeEgress([withBadShape]);
  const result = await buildContextFile({
    db: null, egress, runId: 'run-780', topic: 'phishing', keywords: [], articles: ARTICLES
  });
  assert.equal(result.keywords.contentShape, null);

  await assert.rejects(
    buildContextFile({ db: null, egress: new FakeEgress([]), runId: 'run-781', topic: 'phishing', keywords: [], articles: [] }),
    (err) => err.code === 'CONTEXT_NO_ARTICLES'
  );
});
