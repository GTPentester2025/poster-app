// Signal extraction + generic-icon ban tests (client escalation #1). The concept
// director must mine the concrete SIGNALS a content point teaches (checking a
// domain, a sender address, urgency cues, suspicious URLs) and depict THOSE —
// not a generic topic icon (envelope for phishing, padlock for security).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSignals, longestSignal, bannedIconsFor, signalDirective
} from '../../agents/prompts/image_concept_prompts.js';
import { conceptForPoint } from '../../agents/image_concept.js';
import { FakeEgress } from './helpers/fake_egress.js';

// A realistic phishing content block that names concrete signals.
const PHISH_BLOCK = {
  heading: 'Impersonation and phishing emails',
  text: 'Check the sender address and the real domain before you trust an urgent request',
  label: 'RED FLAG'
};

test('extractSignals: mines the concrete signals (domain, sender address, urgency) from a content block', () => {
  const signals = extractSignals(PHISH_BLOCK);
  const joined = signals.join(' | ').toLowerCase();
  assert.ok(signals.length >= 2 && signals.length <= 4, 'returns 2-4 signals');
  assert.match(joined, /sender address|domain/, 'mines the sender-address / domain signal');
  assert.match(joined, /urgent|check/, 'mines the urgency / check-action signal');
});

test('extractSignals: no generic topic word alone — signals are specific phrases, not "phishing"', () => {
  const signals = extractSignals({ text: 'A QR code arriving by email instead of a plain link' });
  const joined = signals.join(' ').toLowerCase();
  assert.match(joined, /qr code|plain link|email/, 'signals name the concrete objects in the point');
});

test('longestSignal: returns the single longest concrete noun-phrase (deterministic fallback source)', () => {
  const s = longestSignal(PHISH_BLOCK);
  assert.ok(s.length > 0, 'a signal is returned');
  const all = extractSignals(PHISH_BLOCK);
  assert.ok(all.every((p) => p.length <= s.length), 'it is the longest of the mined signals');
});

test('bannedIconsFor: bans generic topic icons by default; unbans when the point is literally about them', () => {
  const banned = bannedIconsFor('check the sender address and domain');
  assert.match(banned, /envelope/, 'envelope banned for a non-envelope phishing point');
  assert.match(banned, /padlock/, 'padlock banned');
  assert.match(banned, /hoodie hacker/, 'hoodie hacker banned');

  // a point literally about an envelope must NOT ban the envelope
  const aboutEnvelope = bannedIconsFor('a physical paper envelope on the desk');
  assert.ok(!/envelope/.test(aboutEnvelope), 'envelope is allowed when the point is about envelopes');
});

test('signalDirective: lists signals, demands the specific signal, and bans generic icons', () => {
  const dir = signalDirective(extractSignals(PHISH_BLOCK), PHISH_BLOCK.text);
  assert.match(dir, /CONCRETE SIGNALS/, 'lists the extracted signals');
  assert.match(dir, /MUST depict the SPECIFIC signal/, 'demands the specific signal');
  assert.match(dir, /BANNED generic topic icons/, 'bans generic topic icons');
  assert.match(dir, /envelope/, 'the envelope icon is named in the ban list');
});

test('conceptForPoint: the outbound prompt carries the mined signals and the generic-icon ban', async () => {
  const egress = new FakeEgress({
    'image-concept/concept_for_point': JSON.stringify({ concept: 'a magnifying glass over an email sender-address bar with the domain highlighted' })
  });
  const c = await conceptForPoint({
    egress, runId: 'r', point: PHISH_BLOCK.text, block: PHISH_BLOCK, topics: ['phishing']
  });
  assert.match(c, /magnifying glass over an email sender-address bar/, 'model concept adopted');

  const sent = egress.calls[0].opts.user;
  assert.match(sent, /CONCRETE SIGNALS/, 'signals listed in the prompt');
  assert.match(sent, /BANNED generic topic icons.*envelope/s, 'generic envelope icon banned in the prompt');
});

test('conceptForPoint: offline fallback leads with the mined signal, not a generic topic render', async () => {
  const c = await conceptForPoint({ runId: 'r', point: PHISH_BLOCK.text, block: PHISH_BLOCK });
  assert.match(c.toLowerCase(), /sender address|domain/, 'fallback names the concrete signal');
});
