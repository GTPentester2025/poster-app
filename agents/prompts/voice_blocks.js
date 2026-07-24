// Shared prompt discipline for every poster-copy agent (spec §B.5).
// Adapted — not copied — from the reference repo's EMPLOYEE_VOICE / STYLE /
// ANTI_GENERIC bulletin blocks and re-targeted at POSTERS: far fewer words,
// readable across a room, translated into 10 languages afterwards.
//
// Iteration 3 (I1 relevance de-bias): the blocks are topic-NEUTRAL. Concrete
// examples come from the rotating TOPIC_EXAMPLE_BANK (deterministic per seed)
// so no single security topic — phishing above all — dominates any prompt.
// The platform covers security awareness on ANY topic the user asks for, plus
// general workplace-awareness posters; the USER'S topic is the only topic.
//
// Versioned: bump PROMPT_BLOCKS_VERSION whenever wording changes so ensemble
// logs can attribute output drift to a prompt revision.

import { exampleLines } from './topic_examples.js';

export const PROMPT_BLOCKS_VERSION = 3;

export const POSTER_VOICE_BLOCK = `You write internal awareness POSTER copy for general employees with no IT or security background. The platform covers security awareness on ANY topic the user requests, and general workplace-awareness topics too — the user's topic is the only topic; never steer toward a more common subject.
Voice: calm CERT/CISA-style operational awareness — factual, concise, confident. Not marketing, not tabloid, not "thought leadership".
No fear-mongering: name the risk and the concrete action; never dramatize consequences or threaten the reader.
Plain everyday language. Never use jargon or an acronym without a plain-word substitute.
A poster is read across a room in a few seconds — every word must earn its place.`;

// The filler list is a hard ban: these phrases add zero information on a
// poster and are the most common tell of generic AI copy.
export const FORBIDDEN_FILLER = [
  'it is important to note',
  'it is worth noting',
  'remember that',
  "in today's world",
  "in today's digital landscape",
  'as we all know',
  'needless to say',
  'at the end of the day',
  'the takeaway is',
  "here's what you need to know",
  'basically',
  'actually',
  'staying vigilant',
  'stay vigilant',
  'be mindful',
  'bad actors',
  'cyber hygiene',
  'security is everyone\'s job'
];

export const STYLE_BLOCK = `STYLE (mandatory):
- Imperative mood, present tense. No narrative, anecdotes, metaphors, or story framing.
- Forbidden filler — never use any of: ${FORBIDDEN_FILLER.join('; ')}.
- Never the word "credentials" — say "login details" or "username and password" instead. No exceptions.
- No rhetorical questions, exclamation marks, hype, jokes, or slang.
- Never imitate scam-message language (no "Click here", "Act now", "URGENT", "verify your account now", time pressure), and never fake official-notice tone on other subjects (no "COMPLIANCE ALERT", "your access will be revoked").`;

/**
 * ANTI-GENERIC rules with a rotating, seed-deterministic example set (never a
 * fixed pet topic). Default seed keeps output stable for tests and logs.
 */
export function buildAntiGenericBlock(seed = 'default') {
  return `ANTI-GENERIC RULES (strict — the most common failure mode):
- Every message names a concrete behaviour, signal, channel, or action a reader can take today. Examples of the required concreteness on OTHER topics (write with this concreteness about the USER'S topic, whatever it is):
${exampleLines(seed, 3)}
  Never generic advice ("be careful", "stay alert", "review security practices", "think before you act" with nothing concrete attached).
- BANNED OPENINGS unless immediately paired with a concrete object: "Review", "Monitor", "Stay", "Be", "Limit", "Maintain", "Ensure", "Always", "Remember", "Understand". Prefer verbs that name the action: "Hover", "Verify", "Type", "Pause", "Report", "Forward", "Call", "Check".
- SWAP TEST per message: if the line would fit an unrelated topic or threat type unchanged, it is too generic — rewrite it so it would NOT apply to an unrelated subject.`;
}

// Back-compat constant: the default-seed rendering (deterministic).
export const ANTI_GENERIC_BLOCK = buildAntiGenericBlock('default');

export const TRANSLATABILITY_BLOCK = `MULTILINGUAL RULES (mandatory — this copy is later translated into 10 languages):
- Base language is always English.
- No idioms, wordplay, puns, rhymes, or alliteration-dependent phrasing.
- No culture-specific references: sports, holidays, pop culture, regional institutions, local currency or measurement jokes.
- Prefer words with direct equivalents in most languages; short declarative structures translate best.`;
