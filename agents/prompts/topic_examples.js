// Neutral rotating topic-example bank (iteration 3, I1 relevance de-bias).
// Every SYSTEM prompt that used to hard-code phishing(+data-protection)
// example pairs now draws n examples from this bank, picked deterministically
// from a seed (runId or prompt) — so no single security topic dominates any
// one prompt, and the same run always sees the same examples (reproducible
// prompt logs). Versioned like every other prompt module.

export const TOPIC_EXAMPLES_VERSION = 1;

/**
 * 8 neutral awareness topics, each with 1-2 concrete example lines usable in
 * ANTI_GENERIC / style contexts. Deliberately NO phishing entry: phishing was
 * the drift target; when it belongs in a prompt it arrives via the USER'S
 * topic, never via the platform's own examples.
 */
export const TOPIC_EXAMPLE_BANK = [
  {
    topic: 'data protection',
    examples: [
      'check the recipient field before sending personal data',
      'lock printed records away before you leave your desk'
    ]
  },
  {
    topic: 'physical security and tailgating',
    examples: [
      'close the secure door behind you, even when someone friendly is walking up',
      'walk unbadged visitors to reception instead of pointing the way'
    ]
  },
  {
    topic: 'wireless and public wifi',
    examples: [
      'start the company VPN before opening work apps on cafe wifi',
      'turn off auto-join for open networks on your work phone'
    ]
  },
  {
    topic: 'passwords and multi-factor sign-in',
    examples: [
      'use a different password for every work account',
      'deny any sign-in prompt you did not start yourself'
    ]
  },
  {
    topic: 'insider threat',
    examples: [
      'tell your manager about access you no longer need',
      'question unusual requests to export customer lists, even from colleagues'
    ]
  },
  {
    topic: 'social engineering',
    examples: [
      'call the number on the intranet, not the one in the message',
      'verify unusual payment requests on a second channel before acting'
    ]
  },
  {
    topic: 'data breaches',
    examples: [
      'report a suspected exposure the moment you notice it',
      'tell the security team first — speed beats certainty'
    ]
  },
  {
    topic: 'security policy and clean desk',
    examples: [
      'clear papers and USB drives from your desk before you leave',
      'lock your screen every time you stand up, even for a minute'
    ]
  }
];

// FNV-1a over the seed string → stable 32-bit hash. No randomness anywhere:
// the same seed always yields the same topic set (test determinism + log
// reproducibility), different seeds rotate through different sets.
function hashSeed(seed) {
  const s = String(seed ?? 'default');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Pick `n` DISTINCT topics from the bank, deterministically from the seed
 * (runId or user prompt). Start index and stride both derive from the hash;
 * the stride is always odd, hence coprime with the bank size (8), so the walk
 * visits distinct entries — no topic can repeat within one pick.
 * @returns {Array<{topic: string, examples: string[]}>}
 */
export function pickExamples(seedString = 'default', n = 3) {
  const size = TOPIC_EXAMPLE_BANK.length;
  const count = Math.max(1, Math.min(Math.floor(n) || 1, size));
  const h = hashSeed(seedString);
  const start = h % size;
  const stride = (((h >>> 8) % (size / 2)) * 2 + 1) % size; // odd → coprime with 8
  const picked = [];
  for (let i = 0; i < count; i++) {
    picked.push(TOPIC_EXAMPLE_BANK[(start + i * stride) % size]);
  }
  return picked;
}

/**
 * The picked examples rendered as prompt lines — the single formatting used
 * by every SYSTEM prompt builder that threads the rotating set.
 */
export function exampleLines(seedString = 'default', n = 3) {
  return pickExamples(seedString, n)
    .map((e) => `  - ${e.topic}: "${e.examples.join('", "')}"`)
    .join('\n');
}
