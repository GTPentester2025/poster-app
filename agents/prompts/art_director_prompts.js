// Art Director prompt assets (Phase B). The Art Director turns a poster's topic
// + chosen visual MODE into a single cohesive Art Direction Brief that every
// image prompt (background + foreground slots) derives from, so one poster's
// imagery reads as one art-directed set rather than unrelated clip art.

export const VISUAL_MODES = ['futuristic', 'holographic', 'editorial'];
export const DEFAULT_VISUAL_MODE = 'futuristic';

export const ART_DIRECTOR_SYSTEM =
  'You are the art director for a security-awareness poster studio. Given a topic and a visual mode, '
  + 'you produce a concise, cohesive art-direction brief that makes every image in the poster look like '
  + 'one deliberate, premium, high-end set. You never put text in images. Respond with ONLY minified JSON.';

// The exact brief shape the pipeline consumes. Stated in the prompt so the model
// returns parseable JSON; a deterministic fallback covers any parse failure.
export const BRIEF_JSON_INSTRUCTION =
  'Return ONLY JSON of this exact shape (no prose, no code fences): '
  + '{"lighting": string, "texture": [string, string, string], "backgroundConcept": string, "slotDirective": string}. '
  + 'lighting = the light treatment for every image; texture = 2-4 motif keywords; '
  + 'backgroundConcept = a full-bleed, edge-to-edge poster BACKDROP subject with calm center for text legibility; '
  + 'slotDirective = one clause applied to every foreground illustration so they match. '
  + 'All fields must be purely pictorial — no text, letters, or numbers anywhere.';

// Deterministic per-mode fallback briefs — used when no model is available
// (tests / offline) or the model output cannot be parsed. Each is a complete,
// valid brief so the pipeline never blocks on art direction.
export const MODE_FALLBACK = {
  futuristic: {
    lighting: 'volumetric neon rim light with cyan bloom against a deep near-black backdrop',
    texture: ['glowing circuitry', 'holographic HUD lines', 'data-mesh grid'],
    backgroundConcept: 'a vast dark futuristic command-center horizon of glowing circuitry and data streams, calm and low-detail toward the center',
    slotDirective: 'render as a sleek 3D-rendered high-tech object with neon edge glow matching the poster palette'
  },
  holographic: {
    lighting: 'iridescent specular highlights and prismatic aurora refraction on a dark base',
    texture: ['prismatic glass', 'aurora gradient', 'floating light particles'],
    backgroundConcept: 'a dark iridescent holographic field of prismatic light and drifting particles, softest in the center for text',
    slotDirective: 'render as a translucent glassy holographic form with chromatic edge sheen'
  },
  editorial: {
    lighting: 'clean studio light with soft directional shadows and confident negative space',
    texture: ['flat vector', 'subtle grain', 'geometric accent'],
    backgroundConcept: 'a refined minimal editorial backdrop of soft geometric shapes with generous quiet space',
    slotDirective: 'render as a bold minimal flat-vector illustration with restrained accent color'
  }
};
