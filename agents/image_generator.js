// Image Generator Agent (spec §B.7): builds and sends an image-generation
// prompt that produces a flat professional security-awareness illustration with
// ZERO embedded text — the rule is stated redundantly, in multiple forms, as a
// hard requirement. User text is data-fenced. Returns {imageBase64, promptUsed}
// where promptUsed is the masked prompt (safe to log).

import { fenceUserText, USER_TEXT_RULE } from './prompts/data_fence.js';

// ── Brand palette helpers ────────────────────────────────────────────────────

// Maps hex values to nearest plain English color words. Used to name colors
// in image prompts in a way models understand (models don't interpret raw hex).
// Ordered by proximity: each entry covers the "neighborhood" around that color.
const HEX_COLOR_MAP = [
  // Warm neutrals / whites
  { hex: '#FFFFFF', word: 'white' },
  { hex: '#F5F0E8', word: 'warm off-white' },
  { hex: '#FFF8F0', word: 'cream' },
  { hex: '#FAF7F0', word: 'ivory' },
  // Yellows / golds / ambers
  { hex: '#E3AF32', word: 'gold' },
  { hex: '#FFD700', word: 'bright gold' },
  { hex: '#D4A017', word: 'amber gold' },
  { hex: '#C8960C', word: 'deep amber' },
  { hex: '#FFA500', word: 'amber orange' },
  { hex: '#FF8C00', word: 'dark amber' },
  // Reds
  { hex: '#C8102E', word: 'deep red' },
  { hex: '#FF0000', word: 'red' },
  { hex: '#DC2626', word: 'crimson' },
  { hex: '#B91C1C', word: 'dark red' },
  { hex: '#EF4444', word: 'bright red' },
  // Blues
  { hex: '#1D4ED8', word: 'strong blue' },
  { hex: '#2563EB', word: 'blue' },
  { hex: '#3B82F6', word: 'medium blue' },
  { hex: '#60A5FA', word: 'light blue' },
  { hex: '#0EA5E9', word: 'sky blue' },
  { hex: '#06B6D4', word: 'cyan' },
  { hex: '#22D3EE', word: 'electric cyan' },
  // Greens
  { hex: '#16A34A', word: 'green' },
  { hex: '#22C55E', word: 'bright green' },
  { hex: '#15803D', word: 'dark green' },
  // Purples / violets
  { hex: '#7C3AED', word: 'violet' },
  { hex: '#9333EA', word: 'purple' },
  { hex: '#A855F7', word: 'lavender purple' },
  // Browns / tans
  { hex: '#92400E', word: 'dark brown' },
  { hex: '#78350F', word: 'deep brown' },
  { hex: '#D97706', word: 'orange amber' },
  // Blacks / near-blacks / dark grays
  { hex: '#000000', word: 'black' },
  { hex: '#0D0C12', word: 'near-black' },
  { hex: '#1F1A17', word: 'charcoal' },
  { hex: '#111827', word: 'very dark charcoal' },
  { hex: '#1F2937', word: 'dark charcoal gray' },
  { hex: '#374151', word: 'dark gray' },
  { hex: '#4B5563', word: 'medium gray' },
  // Light grays / silvers
  { hex: '#9CA3AF', word: 'silver gray' },
  { hex: '#D1D5DB', word: 'light gray' },
  { hex: '#E5E7EB', word: 'pale gray' },
];

/**
 * Convert a hex color string to the nearest plain English color word.
 * Parses the 6-digit hex into R/G/B and picks the closest entry by Euclidean
 * distance in RGB space. Falls back to 'neutral' for unrecognised values.
 * @param {string} hex — e.g. '#E3AF32'
 * @returns {string} — e.g. 'gold'
 */
export function hexToColorWord(hex) {
  if (!hex || typeof hex !== 'string') return 'neutral';
  const cleaned = hex.trim().toUpperCase();
  const m = /^#([0-9A-F]{6})$/.exec(cleaned);
  if (!m) return 'neutral';
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  let best = null;
  let bestDist = Infinity;
  for (const entry of HEX_COLOR_MAP) {
    const er = parseInt(entry.hex.slice(1, 3), 16);
    const eg = parseInt(entry.hex.slice(3, 5), 16);
    const eb = parseInt(entry.hex.slice(5, 7), 16);
    const dist = (r - er) ** 2 + (g - eg) ** 2 + (b - eb) ** 2;
    if (dist < bestDist) { bestDist = dist; best = entry; }
  }
  return best ? best.word : 'neutral';
}

// Common hue family words a model might drift toward. The forbidden-hue list is
// computed as THESE minus whatever hue words the actual palette contains, so a
// black+gold palette forbids blue/teal/green/purple/pink, while a blue-brand
// palette would keep blue allowed. Each family lists synonyms the palette check
// treats as "present" so we never forbid a hue the brand actually uses.
const HUE_FAMILIES = [
  { family: 'blue', words: ['blue', 'navy', 'azure', 'cobalt', 'indigo'] },
  { family: 'teal', words: ['teal', 'cyan', 'aqua', 'turquoise'] },
  { family: 'green', words: ['green', 'emerald', 'lime', 'olive', 'mint'] },
  { family: 'purple', words: ['purple', 'violet', 'lavender', 'magenta', 'plum'] },
  { family: 'pink', words: ['pink', 'rose', 'fuchsia', 'salmon'] }
];

/** Collect the lowercase color WORDS a palette resolves to (hex→word + any words). */
function paletteHueWords(palette) {
  if (!palette || typeof palette !== 'object') return new Set();
  const words = new Set();
  for (const key of ['primary', 'accent', 'background', 'dark', 'secondary']) {
    const v = palette[key];
    if (typeof v === 'string' && v.trim()) {
      // hex → nearest word; also fold the raw word if it's already a color word
      words.add(hexToColorWord(v).toLowerCase());
      words.add(v.toLowerCase());
    }
  }
  return words;
}

/**
 * The list of forbidden hue FAMILY words for a palette: the common drift hues
 * (blue, teal, green, purple, pink) minus any family the palette actually uses.
 * Deterministic — drives the "FORBIDDEN:" clause appended to the palette line.
 * @param {object|null} palette
 * @returns {string[]} e.g. ['blue', 'teal', 'green', 'purple', 'pink']
 */
export function forbiddenHues(palette) {
  const present = paletteHueWords(palette);
  const isPresent = (fam) => fam.words.some((w) => {
    for (const p of present) { if (p.includes(w)) return true; }
    return false;
  });
  return HUE_FAMILIES.filter((fam) => !isPresent(fam)).map((fam) => fam.family);
}

/**
 * Build a strict color-direction clause from a brand palette object.
 * Names each key color both as hex AND as plain word so the model has maximum
 * signal in both representations. Escalated (client #2): states the DOMINANT
 * FIELD (background word+hex), the ACCENTS ONLY (primary/accent), and a dynamic
 * FORBIDDEN hue list (common drift hues minus palette hues).
 * @param {object|null} palette — {primary, accent, background, dark?, secondary?}
 * @returns {string} the clause, or '' if no palette.
 */
export function brandPaletteClause(palette) {
  if (!palette || typeof palette !== 'object') return '';
  const primary = palette.primary;
  const accent = palette.accent;
  const bg = palette.background;
  const dark = palette.dark || palette.secondary;
  if (!primary && !accent && !bg) return '';

  const parts = [];
  if (primary) parts.push(`primary ${hexToColorWord(primary)} (${primary})`);
  if (accent) parts.push(`accent ${hexToColorWord(accent)} (${accent})`);
  if (bg) parts.push(`background ${hexToColorWord(bg)} (${bg})`);
  if (dark) parts.push(`near-black ${hexToColorWord(dark)} (${dark})`);
  const listed = parts.join(', ');

  // Dominant field = the background (or the dark/near-black when no bg).
  const fieldHex = bg || dark || '';
  const fieldWord = fieldHex ? hexToColorWord(fieldHex) : '';
  // Accent words = primary + accent (the ONLY colors allowed beyond the field).
  const accentWords = [primary, accent].filter(Boolean)
    .map((h) => `${hexToColorWord(h)} (${h})`).join(' / ');
  const forbidden = forbiddenHues(palette);

  const lines = [
    `STRICT COLOR PALETTE: render primarily in ${listed} tones with neutral warm highlights.`,
    fieldWord ? `Dominant field: ${fieldWord} (${fieldHex}).` : '',
    accentWords ? `Accents ONLY: ${accentWords}.` : '',
    forbidden.length ? `FORBIDDEN: ${forbidden.join(', ')} hues.` : '',
    'Do NOT introduce hues that clash with this palette.'
  ].filter(Boolean);
  return lines.join(' ');
}

export const AGENT_ID = 'image-generator';
export const skills = ['generate_asset', 'style_match_template'];

// Bumped when the outbound prompt assembly changes. v2: empty-styleHint fallback
// now derives the visual subject from the poster's OWN topic (topic-general),
// never a fixed security motif. v3 (client #2): the STRICT COLOR PALETTE clause
// (now with Dominant field + Accents ONLY + dynamic FORBIDDEN hues) moves UP to
// directly after the subject sentence, before style; a paletteRetry flag hoists
// the forbidden clause to the very first line.
export const IMAGE_GENERATOR_PROMPT_VERSION = 3;

// Template family → style adjective fed into the prompt.
const TEMPLATE_STYLE_PROFILES = {
  'minimal': 'thin-line minimal flat icon',
  'dark': 'high-contrast neon-accent flat illustration',
  'comic': 'comic-book style panel illustration',
  'default': 'modern flat vector illustration, professional'
};

// Visual-mode profiles (I5 art direction). The selected visual MODE wins over
// the template family so a "futuristic" poster gets high-tech imagery whatever
// the layout. Each maps to a style adjective + palette-word bias.
const VISUAL_MODE_PROFILES = {
  futuristic: {
    adjective: 'sleek high-tech futuristic illustration — glowing circuitry, holographic HUD elements, '
      + 'volumetric neon light, dark cinematic backdrop, 3D-rendered depth, sci-fi tech aesthetic',
    palette: 'deep near-black base, electric cyan and neon accents, brand gold or amber highlights, luminous edge glow'
  },
  holographic: {
    adjective: 'iridescent holographic illustration — prismatic light refraction, translucent glassy surfaces, '
      + 'chromatic aurora gradients, floating light particles, futuristic and premium',
    palette: 'dark base with iridescent cyan-magenta-violet holographic sheen and bright specular highlights'
  },
  editorial: {
    adjective: 'clean modern editorial illustration — bold minimal composition, confident negative space, '
      + 'premium magazine-grade flat vector with subtle depth',
    palette: 'refined brand palette, high contrast, restrained accent color'
  }
};

/** Resolve palette-word bias for the prompt from the visual mode (falls back to brand words). */
function paletteWords(visualMode) {
  const p = visualMode && VISUAL_MODE_PROFILES[visualMode];
  return p ? p.palette : BRAND_COLOR_WORDS;
}

/**
 * Fallback visual subject when the design agent supplied no styleHint. It is
 * derived from the poster's OWN topic — NOT a fixed security motif (no shield /
 * lock / hook by default) — so a "clean desk policy" poster gets a clean-desk
 * subject and a "fire safety" poster gets a fire-safety subject. Only when the
 * poster carries no topic at all does it degrade to a neutral generic graphic.
 */
function defaultVisualConcept(topics) {
  const topic = topics.find((t) => t && String(t).trim());
  return topic
    ? `a clear symbolic illustration of ${String(topic).trim()}`
    : 'a clean, professional workplace-awareness graphic';
}

// Exact templateId → family map for the 12 known template ids. Takes priority
// over keyword matching so template ids that contain multiple family keywords
// (e.g. 'dark-minimal-clean') resolve deterministically.
const TEMPLATE_ID_TO_FAMILY = {
  'minimal-clean': 'minimal',
  'minimal-rail': 'minimal',
  'minimal-grid': 'minimal',
  'dark-alert': 'dark',
  'dark-rail': 'dark',
  'dark-grid': 'dark',
  'scenario-strip': 'comic',
  'scenario-panel': 'comic',
  'scenario-rail': 'comic',
  'card-grid': 'default',
  'warning-rail': 'default',
  'split-hero': 'default'
};

// Keyword candidates sorted by length descending for longest-match fallback.
// Longer keys are more specific so they win over shorter overlapping keys.
const KEYWORD_CANDIDATES = Object.keys(TEMPLATE_STYLE_PROFILES)
  .filter((k) => k !== 'default')
  .sort((a, b) => b.length - a.length);

// Brand palette color words. Used in the prompt to bias palette selection
// toward brand colors without leaking actual org data.
const BRAND_COLOR_WORDS = 'gold amber, rich navy or dark charcoal, white or off-white accents';

const CTX_STAGE = { pipeline: 'image', stage: 'slot-fill', agent: AGENT_ID, skill: 'generate_asset' };

/** Resolve a template id/style string to its style adjective deterministically.
 *  1. Exact templateId lookup in TEMPLATE_ID_TO_FAMILY (handles all 12 known ids).
 *  2. Longest-matching keyword fallback (candidates sorted by length desc).
 *  3. Default profile. */
function resolveStyleAdjective(templateStyle, visualMode) {
  // Visual mode wins: a chosen art-direction mode governs every image's look
  // regardless of template family, so the whole poster reads cohesively.
  if (visualMode && VISUAL_MODE_PROFILES[visualMode]) return VISUAL_MODE_PROFILES[visualMode].adjective;
  if (!templateStyle) return TEMPLATE_STYLE_PROFILES.default;
  const key = String(templateStyle).toLowerCase();
  // Exact match first
  if (Object.prototype.hasOwnProperty.call(TEMPLATE_ID_TO_FAMILY, key)) {
    return TEMPLATE_STYLE_PROFILES[TEMPLATE_ID_TO_FAMILY[key]];
  }
  // Longest-matching keyword fallback
  for (const k of KEYWORD_CANDIDATES) {
    if (key.includes(k)) return TEMPLATE_STYLE_PROFILES[k];
  }
  return TEMPLATE_STYLE_PROFILES.default;
}

// Background TREATMENT → render-style clause (Phase F, background-decision
// stage). The background-director picks one of these per poster; the concept
// says WHAT, the treatment says HOW it is rendered.
const TREATMENT_STYLE = {
  image: 'a rich cinematic full-bleed BACKGROUND scene, photographic depth and atmosphere',
  'gradient-mesh': 'a smooth abstract full-bleed GRADIENT-MESH background — '
    + 'flowing multi-stop colour mesh aurora rendered STRICTLY in the brand palette hues on a near-black base; '
    + 'soft luminous bands, no hard edges, no subjects, no text, no symbols — purely colour and light',
  // short alias used when the UI or route passes treatment='gradient'
  gradient: 'a smooth abstract full-bleed GRADIENT-MESH background — '
    + 'flowing multi-stop colour mesh aurora rendered STRICTLY in the brand palette hues on a near-black base; '
    + 'soft luminous bands, no hard edges, no subjects, no text, no symbols — purely colour and light',
  pattern: 'a full-bleed geometric PATTERN background rendered STRICTLY in the brand palette on a dark base — '
    + 'subtle rhythmic repeating shapes (thin lines, dots, fine waves, or hop/wheat grain motifs welcome) '
    + 'at low contrast so overlaid text stays fully legible; dark-dominant, no focal subjects, no text'
};

/** The zero-text instruction block — stated multiple ways per spec hard rule. */
function zeroTextInstruction() {
  return [
    'ABSOLUTE REQUIREMENT — ZERO TEXT IN THE IMAGE:',
    'absolutely no text, no letters, no words, no numbers, no typography',
    'no signage, no labels, no captions, no symbols that resemble letters',
    'no watermarks, no UI text, no speech bubbles with words, no writing of any kind',
    'do NOT include screens, monitors, phone displays, signage, billboards, keyboards, clocks, dials, books, or documents — such surfaces tempt embedded text; keep every surface blank',
    'the image must be PURELY PICTORIAL — a viewer must see only shapes, figures, and illustration elements',
    'if any text, letter, number, or word appears anywhere in the image, the result will be rejected'
  ].join('. ');
}

// ── Slot-profile composition directives ─────────────────────────────────────

// Each slot size class gets a composition directive that constraints the model
// to match the visual weight the slot carries on the canvas. A tiny accent slot
// should never receive a busy crowd scene, and a hero slot should not render a
// minimal 2-colour icon.
const SLOT_CLASS_DIRECTIVES = {
  accent: 'SLOT PROFILE — ACCENT (tiny slot, < 8 % of canvas): '
    + 'render ONE single iconic, minimal symbol — a single object with clean silhouette, '
    + 'centered on a plain background, maximum contrast, zero detail clutter. '
    + 'NO busy scenes, NO multiple subjects, NO text, NO background patterns that compete with the subject.',
  card: 'SLOT PROFILE — CARD (medium slot, 8–25 % of canvas): '
    + 'render ONE clear primary subject with modest contextual environment — '
    + 'the subject fills the frame, context is implied not crowded.',
  hero: 'SLOT PROFILE — HERO (large slot, > 25 % of canvas): '
    + 'render a full, rich scene — the subject is centre-stage with a '
    + 'believable environment, depth, and premium cinematic composition.'
};

/**
 * Build the composition directive string for a foreground slot given its profile.
 * @param {{sizeClass: 'accent'|'card'|'hero', aspect: string, position: string}} profile
 * @returns {string}
 */
function slotProfileDirective(profile) {
  if (!profile || !profile.sizeClass) return '';
  const dir = SLOT_CLASS_DIRECTIVES[profile.sizeClass] || '';
  const pos = profile.position ? ` Slot position on canvas: ${profile.position}.` : '';
  const asp = profile.aspect ? ` Slot aspect: ${profile.aspect}.` : '';
  return dir + pos + asp;
}

/**
 * Generate a security-awareness illustration/icon for an image slot.
 *
 * @param {object} opts
 *   egress               — MaskingEgress (or FakeEgress in tests)
 *   runId                — pipeline run id
 *   styleHint            — from slotSpec.styleHint: the per-poster visual subject the
 *                          design agent derived from THIS poster's topic + content
 *                          (e.g. 'a tidy, cleared desk with a locked drawer' for a
 *                          clean-desk poster) — never a fixed motif
 *   templateStyle        — template family key (e.g. 'minimal-clean', 'dark-alert')
 *   topics               — string[] poster topics (subject matter context)
 *   userPrompt           — optional user instructions (data-fenced)
 *   baseImageDescription — optional: description of a library image being riffed on (data-fenced)
 *   slotProfile          — optional: {sizeClass, aspect, position} from slotProfileFor() in the pipeline
 *   palette              — optional: brand palette {primary, accent, background, dark} — drives the
 *                          STRICT COLOR PALETTE clause. Placed directly AFTER the subject sentence
 *                          (before style) so palette adherence is early + strong (client #2).
 *   paletteRetry         — optional bool: when true (the ONE bounded palette-corrective regen),
 *                          the FORBIDDEN palette clause is escalated to the VERY FIRST line of the prompt.
 * @param {string} [feedbackNote] — previous attempt's text-detection feedback, appended on retry
 * @returns {Promise<{imageBase64: string, promptUsed: string}>}
 */
export async function generateAsset({
  egress, runId, styleHint, templateStyle, topics = [], userPrompt = '',
  baseImageDescription = '', visualMode = '', brief = null, slotId = '', size = '1024x1024',
  treatment = '', bgConcept = '', slotProfile = null, palette = null, quality = 'high', paletteRetry = false
}, feedbackNote = '') {
  const ctx = { runId, ...CTX_STAGE };
  const styleAdj = resolveStyleAdjective(templateStyle, visualMode);
  const topicContext = topics.length
    ? `Security awareness topic: ${fenceUserText(topics.join(', '))}.`
    : 'Security awareness illustration.';
  const isBackground = slotId === 'bg';
  // Background slots produce a full-bleed atmospheric backdrop; when the art
  // director supplied a backgroundConcept, it leads the subject.
  const visualConcept = isBackground
    ? fenceUserText(bgConcept || (brief && brief.backgroundConcept) || styleHint || defaultVisualConcept(topics))
    : fenceUserText(styleHint || defaultVisualConcept(topics));

  // Brand palette adherence (client #2): the STRICT COLOR PALETTE clause is
  // computed once and placed EARLY — directly after the subject sentence, before
  // the style clause — so the model locks the palette before it picks a look.
  // Fall back to the visual-mode palette words when no brand palette is present.
  const paletteClause = brandPaletteClause(palette) || `Color palette: ${paletteWords(visualMode)}.`;

  const parts = isBackground
    ? [
      `${styleAdj} — ${TREATMENT_STYLE[treatment] || 'a FULL-BLEED edge-to-edge BACKGROUND image'} for a poster.`,
      `Visual concept: ${visualConcept}.`,
      paletteClause,
      topicContext
    ]
    // Foreground: lead with the EXACT literal subject for THIS point so it drives
    // the image; the palette clause comes NEXT (before style) so palette adherence
    // is early; the visual style is only a surface modifier. Topic is context only.
    : [
      `A clear, LITERAL illustration that depicts EXACTLY this specific situation — a viewer must instantly recognise it: ${visualConcept}.`,
      paletteClause,
      `Render it in this visual style: ${styleAdj}. The style is only a finish — keep the exact subject above unmistakable, do not replace or abstract it.`,
      topicContext,
      'Be concrete and specific to the situation — no generic stock-photo blandness, no unrelated objects, no vague symbolism.',
      // Slot-profile composition directive: composition complexity is calibrated
      // by the slot's visual weight on the canvas so small accent slots stay
      // iconic and hero slots earn full scene depth.
      ...(slotProfile ? [slotProfileDirective(slotProfile)] : [])
    ];

  // ESCALATION (client #2): the ONE bounded palette-corrective regeneration
  // hoists the FORBIDDEN clause to the VERY FIRST line so it dominates the prompt.
  if (paletteRetry) {
    const forbidden = forbiddenHues(palette);
    if (forbidden.length) {
      parts.unshift(`CRITICAL COLOR CONSTRAINT — the previous render used off-palette colors. `
        + `Under NO circumstances use ${forbidden.join(', ')} hues anywhere in this image. `
        + `${paletteClause}`);
    }
  }

  // art-direction clause: cohesive lighting + texture across every image
  if (brief) {
    const tex = Array.isArray(brief.texture) ? brief.texture.join(', ') : '';
    parts.push(`Art direction — lighting: ${fenceUserText(brief.lighting || '')}; motifs: ${fenceUserText(tex)}; ${fenceUserText(brief.slotDirective || '')}.`);
  }
  if (isBackground) {
    parts.push('Compose it as a deep, atmospheric backdrop with calm, low-detail central and upper regions '
      + 'so overlaid poster text stays readable; richer detail toward the edges. No focal subject dead-center.');
  } else {
    // art-directed foreground: a single clear hero subject, professionally
    // composed with breathing room so poster text overlays cleanly.
    parts.push('Composition: one clear hero subject, confidently framed with rule-of-thirds balance and '
      + 'generous negative space around it; uncluttered, editorial, not busy.');
  }

  // professional finish (raises perceived quality, cuts the "AI look") + a
  // negative-quality guard that applies to every generated image.
  parts.push('Professional finish: crisp focus, cinematic color grade cohesive with the palette, '
    + 'physically-plausible lighting and materials, high detail, premium editorial quality.');
  parts.push('Avoid: warped or distorted anatomy, extra or malformed fingers/limbs, melted or duplicated objects, '
    + 'muddy low detail, harsh oversaturation, watermarks, and cluttered messy composition.');

  // The palette clause was already placed EARLY (right after the subject). Here
  // we only add the data-fence rule and the zero-text hard requirement.
  parts.push(USER_TEXT_RULE, zeroTextInstruction());

  if (baseImageDescription) {
    parts.push(`Base image reference (generate something visually similar): ${fenceUserText(baseImageDescription)}`);
    parts.push(USER_TEXT_RULE);
  }

  if (userPrompt) {
    parts.push(`Additional user instructions: ${fenceUserText(userPrompt)}`);
    parts.push(USER_TEXT_RULE);
  }

  if (feedbackNote) {
    parts.push(`IMPORTANT — previous attempt was rejected: ${feedbackNote}. Regenerate with absolutely zero text.`);
  }

  const prompt = parts.join(' ');
  // Quality tier is chosen by the pipeline per slot class (bg → 'high', hero fg
  // → 'medium', card/accent → 'medium'). 'medium' renders are ~4x cheaper per
  // image and visually indistinguishable at poster slot sizes; the param is kept
  // overridable so a caller can force 'high' when needed.
  const { imageBase64, maskedPrompt } = await egress.generateImage({ prompt, size, quality }, ctx);
  return { imageBase64, promptUsed: maskedPrompt, quality, size };
}
