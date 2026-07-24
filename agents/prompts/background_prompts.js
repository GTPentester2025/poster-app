// Background-decision stage prompts (Phase F). One agent (background-director)
// decides HOW the poster background should be treated — a full cinematic IMAGE,
// an abstract GRADIENT-MESH, or a geometric PATTERN — and what its concept is.
// A second agent (background-reviewer) gates the rendered background for craft,
// on-treatment fit, and text legibility before it is used.

export const BACKGROUND_TREATMENTS = ['image', 'gradient-mesh', 'pattern'];

export const BACKGROUND_DIRECTOR_SYSTEM =
  'You are the background art director for a premium, image-first security-awareness poster studio. '
  + 'You decide the single best BACKGROUND treatment for a poster so it looks modern and magazine-grade, '
  + 'never flat or childish. Choose exactly one treatment: '
  + '"image" (a rich cinematic full-bleed scene/render), '
  + '"gradient-mesh" (a soft abstract multi-color gradient field, no hard subjects), or '
  + '"pattern" (a rhythmic geometric/generative pattern edge to edge). '
  + 'The background must keep the poster’s center and top calm enough for overlaid text. Never include text. '
  + 'Respond with ONLY minified JSON.';

export const BACKGROUND_DECISION_INSTRUCTION =
  'Return ONLY JSON of this exact shape (no prose, no code fences): '
  + '{"treatment": "image"|"gradient-mesh"|"pattern", "concept": string, "rationale": string}. '
  + 'concept = a vivid, purely-pictorial description of the background to render (calm center for text), no text/letters/numbers. '
  + 'rationale = one short sentence on why this treatment fits the topic + mode.';

// Deterministic per-mode fallback so the stage never blocks a compile.
export const MODE_TREATMENT_FALLBACK = {
  futuristic: {
    treatment: 'image',
    concept: 'a cinematic dark futuristic command-center vista of glowing circuitry and data streams receding into depth, calm and low-detail through the center for text',
    rationale: 'a rich rendered scene reads most premium and high-tech for a futuristic poster'
  },
  holographic: {
    treatment: 'gradient-mesh',
    concept: 'a soft dark iridescent gradient-mesh of flowing cyan, magenta and violet aurora light with faint drifting particles, quietest in the center',
    rationale: 'an abstract holographic gradient keeps focus on the message while feeling premium'
  },
  editorial: {
    treatment: 'pattern',
    concept: 'a refined minimal geometric pattern of thin concentric contour lines and sparse dots on a deep charcoal field, evenly distributed with a quiet center',
    rationale: 'a restrained geometric pattern reads editorial and modern without competing with type'
  }
};

/**
 * Render a brand palette into a compact "label hex" list. Returns '' when no
 * palette is available (the palette criterion is then omitted).
 */
export function backgroundPaletteDescriptor(palette) {
  if (!palette || typeof palette !== 'object') return '';
  const parts = [];
  const add = (label, hex) => { if (typeof hex === 'string' && hex.trim()) parts.push(`${label} ${hex}`); };
  add('primary', palette.primary);
  add('accent', palette.accent);
  add('background', palette.background);
  add('dark', palette.dark || palette.secondary);
  return parts.join(', ');
}

/** Vision prompt to review a rendered background for its treatment + legibility + palette (Job D). */
export function backgroundReviewPrompt(treatment, palette = null) {
  const paletteWords = backgroundPaletteDescriptor(palette);
  const paletteLine = paletteWords
    ? `The BRAND PALETTE is: ${paletteWords}. PALETTE ADHERENCE IS MANDATORY: if the background's DOMINANT hues `
      + 'fall OUTSIDE this palette (e.g. saturated blues or greens when the palette is black and gold), score it 50 or below '
      + 'and begin the issue with the word "palette". '
    : '';
  return `This image is a poster BACKGROUND meant to be a "${treatment}" treatment. `
    + paletteLine
    + 'Rate it from 0 to 100 on: craft and premium finish; correct match to the intended treatment '
    + `(${treatment}); freedom from AI artifacts;${paletteWords ? ' brand-palette adherence (off-palette dominant hues score 50 or below, issue "palette");' : ''} and MOST IMPORTANTLY that its center and upper area are calm/low-contrast `
    + 'so overlaid poster text stays readable (a busy or high-contrast center scores low). '
    + 'Respond ONLY with JSON: {"score": number, "issues": "one short sentence, or empty if none"}. No markdown, no commentary.';
}
