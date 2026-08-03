// Image Concept Director prompts (point-relevance). Turns the SPECIFIC point a
// slot sits against (a block's message text) into a concrete, literal, purely
// pictorial image concept — so the picture illustrates THAT point, grounded in
// the topic, never a generic topic render. Zero text in the image, always.
//
// SIGNAL EXTRACTION (client escalation #1): the concept must depict the concrete
// SIGNAL / ACTION the point teaches (checking a sender address, a mismatched
// domain, an urgency cue, a suspicious URL) — NOT the generic topic icon
// (envelope for phishing, padlock for security, hoodie hacker). We mine 2-4
// concrete signal noun-phrases from the finalized content block (its text +
// heading + label), feed them to the model, and demand the image show one of
// THEM. A deterministic fallback picks the longest concrete noun-phrase.

// Generic topic icons that clients flagged as too literal/lazy. Banned in the
// prompt UNLESS the point itself is literally about that object.
export const GENERIC_ICON_BANS = [
  { icon: 'envelope', unlessAbout: /\benvelopes?\b/i },
  { icon: 'padlock', unlessAbout: /\b(padlocks?|physical locks?)\b/i },
  { icon: 'hoodie hacker', unlessAbout: /\bhoodie\b/i },
  { icon: 'generic shield', unlessAbout: /\bshields?\b/i },
  { icon: 'bug / virus blob', unlessAbout: /\b(insects?|bugs? on|literal bug)\b/i },
  { icon: 'fish hook', unlessAbout: /\b(fishing|hook|angler)\b/i }
];

// Common English stopwords stripped when mining concrete noun phrases.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'so', 'to', 'of', 'in',
  'on', 'at', 'by', 'for', 'with', 'from', 'as', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'do', 'does', 'did', 'you', 'your', 'yours', 'it',
  'its', 'they', 'them', 'their', 'this', 'that', 'these', 'those', 'not',
  'no', 'yes', 'can', 'will', 'would', 'should', 'could', 'may', 'might',
  'before', 'after', 'when', 'while', 'about', 'into', 'over', 'than', 'too',
  'just', 'any', 'all', 'each', 'every', 'who', 'whom', 'which', 'what'
]);

// Action verbs that signal a teachable behaviour — kept as the head of a phrase.
const ACTION_HINTS = /\b(check|verify|inspect|examine|read|hover|look|compare|confirm|report|pause|stop|type|scan|approve|reject|delete|forward|question|spot|notice|watch)\b/i;

/** Split a content block into candidate phrases (clauses + noun runs). */
function candidatePhrases(text) {
  const clean = String(text || '')
    .replace(/\{\{[^}]*\}\}/g, ' ')        // strip template tokens
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')   // drop punctuation but keep hyphen/apostrophe
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return [];
  // Split on connective words into rough clauses, then keep each clause and also
  // extract the longest run of non-stopword tokens inside it (the noun phrase).
  const clauses = clean.split(/\b(?:and|or|but|then|before|after|when|while|if|so)\b/i);
  const phrases = [];
  for (const clause of clauses) {
    const words = clause.trim().split(' ').filter(Boolean);
    if (!words.length) continue;
    // build maximal runs of content words (stopwords act as separators)
    let run = [];
    const runs = [];
    for (const w of words) {
      if (STOPWORDS.has(w.toLowerCase()) && !ACTION_HINTS.test(w)) {
        if (run.length) runs.push(run.join(' '));
        run = [];
      } else {
        run.push(w);
      }
    }
    if (run.length) runs.push(run.join(' '));
    for (const r of runs) if (r.split(' ').length >= 1) phrases.push(r.trim());
  }
  return phrases.filter(Boolean);
}

/**
 * Mine the 2-4 concrete SIGNAL concepts a content point actually teaches.
 * Combines the block's text, heading, and label, extracts noun/action phrases,
 * ranks them by concreteness (length + presence of an action verb), dedupes,
 * and returns the top few. Deterministic — no model call.
 *
 * @param {{text?:string, heading?:string, label?:string}|string} block
 * @returns {string[]} 0-4 lowercase concrete signal phrases (longest/most concrete first)
 */
export function extractSignals(block) {
  const parts = typeof block === 'string'
    ? [block]
    : [block?.heading, block?.text, block?.label].filter(Boolean);
  const seen = new Set();
  const scored = [];
  for (const part of parts) {
    for (const phrase of candidatePhrases(part)) {
      const key = phrase.toLowerCase();
      if (seen.has(key) || key.length < 3) continue;
      seen.add(key);
      const words = phrase.split(' ').length;
      // score: more words = more concrete; an action verb makes it teachable.
      const score = words * 2 + (ACTION_HINTS.test(phrase) ? 3 : 0) + Math.min(phrase.length, 40) / 10;
      scored.push({ phrase: key, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 4).map((s) => s.phrase);
}

/**
 * The single longest concrete noun-phrase from a point — the deterministic
 * fallback signal when the model is unavailable.
 * @param {{text?:string,heading?:string,label?:string}|string} block
 * @returns {string} the longest signal phrase, or '' when none.
 */
export function longestSignal(block) {
  const signals = extractSignals(block);
  if (!signals.length) return '';
  return signals.reduce((a, b) => (b.length > a.length ? b : a));
}

/**
 * Build the dynamic "banned generic icons" clause for a point. An icon stays
 * banned unless the point text is literally about that object.
 * @param {string} pointText
 * @returns {string} e.g. 'envelope, padlock, hoodie hacker' (comma list), or ''.
 */
export function bannedIconsFor(pointText) {
  const t = String(pointText || '');
  return GENERIC_ICON_BANS.filter((b) => !b.unlessAbout.test(t)).map((b) => b.icon).join(', ');
}

// ── Concept v2: rich concept profiles per visual mode ───────────────────────
// The concept object is {subject, setting, composition, lighting, mood,
// styleKeywords[], avoid[]} (+ `concept`, the one-sentence summary). Per-mode
// profiles supply the lighting/mood/styleKeywords/setting defaults so both the
// model path and the deterministic fallback stay art-directed per mode.

export const MODE_CONCEPT_PROFILES = {
  futuristic: {
    lighting: 'volumetric neon rim light with a cool cyan-and-amber glow against a dark backdrop',
    mood: 'sleek, high-tech, quietly urgent',
    styleKeywords: ['high-tech', 'neon accents', 'glowing circuitry', 'cinematic depth', 'sci-fi'],
    setting: 'a sleek darkened high-tech workspace with subtle glowing interface surfaces (all blank)',
    bgSetting: 'a deep dark abstract tech horizon with soft neon light bands and generous empty space'
  },
  holographic: {
    lighting: 'iridescent prismatic light refracting through translucent glassy surfaces',
    mood: 'premium, futuristic, luminous',
    styleKeywords: ['iridescent', 'holographic sheen', 'translucent glass', 'chromatic gradients', 'floating light particles'],
    setting: 'a dark premium space with translucent holographic panels and floating light particles (all blank)',
    bgSetting: 'a dark aurora field of iridescent cyan-magenta-violet gradients with calm open regions'
  },
  editorial: {
    lighting: 'soft directional studio light with gentle shadows and clean highlights',
    mood: 'calm, confident, professional',
    styleKeywords: ['editorial', 'minimal', 'flat vector', 'bold shapes', 'magazine-grade'],
    setting: 'a clean modern workplace rendered in restrained flat shapes with generous negative space',
    bgSetting: 'a restrained abstract field of flat brand-color shapes with wide areas of open negative space'
  }
};

// Cliché imagery banned by default (fresh concrete metaphors beat stock tropes).
// e.g. phishing → a hooded figure at a laptop is CLICHÉ; prefer email-UI
// metaphors, a fishing lure resting on a keyboard, a deceptive parcel.
export const CLICHE_AVOID = [
  'hooded hacker figure at a laptop',
  'matrix-style falling green code',
  'generic glowing shield emblem',
  'skull-and-crossbones imagery',
  'binary digit rain'
];

// Baseline avoid entries appended to every concept (zero-text hard rule).
export const BASE_AVOID = [
  'any text, letters, numbers or words',
  'watermarks or logos',
  'UI screenshots with legible text'
];

// Few-shot examples per visual mode: realistic point → rich-concept JSON pairs
// (one content slot, one background slot) so the model sees the exact shape and
// the concrete-not-cliché standard we expect.
export const CONCEPT_FEWSHOT = {
  futuristic: [
    'EXAMPLE (content slot) — POINT: "Check the sender address before you click" → '
    + '{"subject":"a glowing magnifying lens hovering over a floating translucent email card, the sender strip highlighted in amber","setting":"a sleek darkened high-tech desk with blank holographic panels","composition":"subject off-center on the right third with clear negative space left","lighting":"cyan volumetric rim light with amber accents","mood":"sleek, quietly urgent","styleKeywords":["high-tech","neon accents","cinematic depth"],"avoid":["hooded hacker figure at a laptop","generic envelope icon","any text or letters"]}',
    'EXAMPLE (background slot) — TOPIC: phishing → '
    + '{"subject":"a faint lattice of interconnected light nodes receding into darkness","setting":"a deep dark abstract tech horizon","composition":"detail pushed to the edges, calm empty center for text overlay","lighting":"soft neon glow fading to near-black","mood":"atmospheric, understated","styleKeywords":["abstract","low detail","negative space"],"avoid":["focal subjects in the center","any text or letters"]}'
  ],
  holographic: [
    'EXAMPLE (content slot) — POINT: "Never share your one-time code" → '
    + '{"subject":"a translucent crystalline key dissolving into prismatic shards as a hand reaches for it","setting":"a dark premium space with iridescent glass panels","composition":"centered vertical subject","lighting":"prismatic refraction with chromatic aurora gradients","mood":"premium, luminous","styleKeywords":["iridescent","holographic sheen","translucent glass"],"avoid":["generic padlock icon","any text or numbers"]}'
  ],
  editorial: [
    'EXAMPLE (content slot) — POINT: "Lock your screen when you step away" → '
    + '{"subject":"an empty ergonomic chair beside a tidy desk, the closed laptop casting a long calm shadow","setting":"a clean modern office in restrained flat shapes","composition":"rule-of-thirds, subject low-left with open space above","lighting":"soft directional studio light","mood":"calm, confident","styleKeywords":["editorial","minimal","flat vector"],"avoid":["cluttered scenes","any text or letters"]}'
  ]
};

/** The few-shot block for a normalized visual mode ('' when none defined). */
export function fewshotBlock(mode) {
  const shots = CONCEPT_FEWSHOT[mode];
  return Array.isArray(shots) && shots.length ? shots.join(' ') : '';
}

export const IMAGE_CONCEPT_INSTRUCTION_V2 =
  'Return ONLY minified JSON of this exact shape (no prose, no code fences): '
  + '{"subject": string, "setting": string, "composition": string, "lighting": string, "mood": string, '
  + '"styleKeywords": [string], "avoid": [string]}. '
  + 'subject = the EXACT, literal focal thing/scene depicting the SPECIFIC signal above — concrete and fresh, '
  + 'never a lazy stock trope (a hooded figure at a laptop is CLICHÉ; prefer concrete metaphors like an email-card '
  + 'lure, a fishing lure resting on a keyboard, a deceptive parcel). '
  + 'setting = where it sits (environment, surfaces — all blank, no writing). '
  + 'composition = how it is framed for the slot. lighting + mood = the render feel. '
  + 'styleKeywords = 3-6 short style descriptors. avoid = concrete things NOT to render (clichés, off-point icons, any text). '
  + 'Everything purely pictorial — no text, letters, numbers, signage, or writing of any kind.';

export const IMAGE_CONCEPT_SYSTEM =
  'You are a visual concept director for a premium security-awareness poster studio. '
  + 'Given one specific POINT the poster makes (a single message) and the concrete SIGNALS it teaches, '
  + 'you invent an EXACT, LITERAL, purely-pictorial image concept that depicts the precise SIGNAL or ACTION '
  + 'the point teaches — so a viewer instantly recognises THIS exact point, not a vague or generic version of '
  + 'the topic. Depict the specific signal literally: for "check the sender address and the real domain", show '
  + 'a magnifying glass over an email sender-address bar with the domain portion highlighted — NOT a generic '
  + 'envelope. Name the specific objects, people, place and action the signal describes and show them literally. '
  + 'Realistic and concrete, never abstract or metaphorical. '
  // Zero-text: literal scenes are fine, but avoid subjects whose surfaces show
  // writing (that is what fails the zero-text gate) — depict the same scene
  // without those text-bearing surfaces.
  + 'The scene must contain NO text, letters, numbers or symbols: avoid computer/phone screens showing '
  + 'an interface, signage, billboards, posters, books, documents, keyboards, and clocks/dials with '
  + 'numbers — keep every surface blank while still showing the literal situation. '
  + 'Respond with ONLY minified JSON.';

export const IMAGE_CONCEPT_INSTRUCTION =
  'Return ONLY JSON of this exact shape (no prose, no code fences): '
  + '{"concept": string}. '
  + 'concept = one vivid sentence describing the EXACT, literal scene to render for THIS point — depicting '
  + 'the SPECIFIC signal/action listed above (the concrete thing the point teaches to check or do), '
  + 'so a viewer immediately recognises this precise situation, not just the general topic. '
  + 'Purely pictorial — no text, letters, numbers, signage, or writing of any kind.';

/**
 * Build the SIGNAL directive block injected into the concept request: lists the
 * mined signals and, dynamically, bans the generic topic icons that do not apply
 * to this point.
 * @param {string[]} signals
 * @param {string} pointText — used to compute which generic icons stay banned
 * @returns {string}
 */
export function signalDirective(signals, pointText) {
  const list = Array.isArray(signals) && signals.length ? signals.join('; ') : '';
  const banned = bannedIconsFor(pointText);
  const parts = [];
  if (list) {
    parts.push(`CONCRETE SIGNALS this point teaches (depict ONE of these specifically): ${list}.`);
  }
  parts.push('The image MUST depict the SPECIFIC signal or action above, not a generic topic symbol.');
  if (banned) {
    parts.push(`BANNED generic topic icons (do NOT render these — they are lazy and off-point unless the point is literally about the object): ${banned}.`);
  }
  return parts.join(' ');
}

/** Deterministic fallback concept: still point-relevant (uses the real point text). */
export function fallbackConcept(point) {
  const p = String(point || '').trim();
  return p ? `a clear, literal, purely visual depiction of: ${p}` : 'a clear, professional security-awareness illustration';
}

/**
 * Deterministic fallback that LEADS with the mined signal (the concrete thing to
 * depict) so even offline the concept is signal-specific, not topic-generic.
 * @param {string} point — the full point text
 * @param {string} signal — the longest concrete noun-phrase (from longestSignal)
 * @returns {string}
 */
export function fallbackConceptWithSignal(point, signal) {
  const p = String(point || '').trim();
  const s = String(signal || '').trim();
  if (!p) return fallbackConcept('');
  if (!s) return fallbackConcept(p);
  return `a clear, literal, purely visual depiction of the specific signal "${s}" — from the point: ${p}`;
}
