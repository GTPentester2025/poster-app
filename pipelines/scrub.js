// Scrub internal research text out of model-authored feedback BEFORE it can
// reach clients (safe-view HTTP responses) or bus subscribers (SSE rework
// events). Fix-at-source for the context-file leak: any feedback sentence
// that shares a contiguous run of SHINGLE_WORDS words with the internal text
// is withheld wholesale — sentence granularity keeps legitimate poster-content
// critique intact while paraphrase-resistant enough for verbatim echoes.

const SHINGLE_WORDS = 8;

export const WITHHELD_MARKER = '[internal research detail withheld]';

// Case/whitespace-insensitive tokens; edge punctuation is stripped so a
// quoted echo ("...") still matches the unquoted original.
function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^\W+|\W+$/g, ''))
    .filter(Boolean);
}

function shingles(tokens) {
  const set = new Set();
  for (let i = 0; i + SHINGLE_WORDS <= tokens.length; i++) {
    set.add(tokens.slice(i, i + SHINGLE_WORDS).join(' '));
  }
  return set;
}

function sharesShingle(sentence, internalShingles) {
  const tokens = tokenize(sentence);
  for (let i = 0; i + SHINGLE_WORDS <= tokens.length; i++) {
    if (internalShingles.has(tokens.slice(i, i + SHINGLE_WORDS).join(' '))) return true;
  }
  return false;
}

/**
 * Replace every sentence of `text` that shares a contiguous run of at least
 * SHINGLE_WORDS words (case/whitespace-insensitive) with `internalText` by
 * WITHHELD_MARKER. Sentences that only discuss poster content pass untouched.
 */
export function scrubInternalText(text, internalText) {
  const t = String(text ?? '');
  if (!t.trim()) return t;
  const internal = shingles(tokenize(internalText));
  if (!internal.size) return t;
  const sentences = t.match(/[^.!?]+[.!?]*\s*/g) || [t];
  return sentences
    .map((s) => (sharesShingle(s, internal) ? `${WITHHELD_MARKER} ` : s))
    .join('')
    .trim();
}
