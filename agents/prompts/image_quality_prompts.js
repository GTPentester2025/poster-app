// Image Aesthetic QA prompts (Phase D). A vision reviewer scores a generated
// image on craft + on-brief adherence AFTER it clears the zero-text gate. The
// gate is quality-raising, not safety-critical, so it fails OPEN (a missing or
// unparseable verdict never blocks a poster) — but a confident low score
// triggers a regenerate with the model's own critique as feedback.

export const AESTHETIC_THRESHOLD = 70;

/**
 * Render a brand palette into a compact "word (hex)" list the vision model can
 * hold to. Accepts the poster palette object {primary, accent, background, dark}.
 * Returns '' when no palette is available (the palette criterion is then omitted).
 */
export function paletteDescriptor(palette) {
  if (!palette || typeof palette !== 'object') return '';
  const parts = [];
  const add = (label, hex) => { if (typeof hex === 'string' && hex.trim()) parts.push(`${label} ${hex}`); };
  add('primary', palette.primary);
  add('accent', palette.accent);
  add('background', palette.background);
  add('dark', palette.dark || palette.secondary);
  return parts.join(', ');
}

/**
 * Build the vision prompt; a point adds a relevance criterion, background a
 * legibility one, and a palette adds a HARD brand-palette adherence criterion
 * (Job D): images whose DOMINANT hues fall outside the palette score ≤50 with
 * the issue naming 'palette', so the retry loop can strengthen the palette clause.
 */
export function aestheticPrompt(brief, slotRole = 'foreground', point = '', palette = null) {
  const isBg = slotRole === 'background';
  const pointLine = point && !isBg
    ? `This image must clearly depict this specific point: "${point}". `
    : '';
  const briefLine = brief
    ? `The intended art direction is: lighting "${brief.lighting}", motifs ${Array.isArray(brief.texture) ? brief.texture.join(', ') : ''}, `
      + `${isBg ? `background concept "${brief.backgroundConcept}"` : `style "${brief.slotDirective}"`}. `
    : '';
  const paletteWords = paletteDescriptor(palette);
  const paletteLine = paletteWords
    ? `The BRAND PALETTE for this poster is: ${paletteWords}. `
      + 'PALETTE ADHERENCE IS MANDATORY: if the image\'s DOMINANT hues fall OUTSIDE this palette '
      + '(for example saturated blues or greens when the palette is black and gold), you MUST score it 50 or below '
      + 'and set the issue to begin with the word "palette". '
    : '';
  const criteria = [
    point && !isBg ? 'RELEVANCE — how clearly it depicts the specific point above (an image that only shows the general topic, or is off-point, scores low)' : null,
    paletteWords ? 'PALETTE ADHERENCE — the dominant hues must stay within the brand palette above (off-palette dominant hues score 50 or below, issue "palette")' : null,
    'overall aesthetic quality and craft (composition, color, depth, finish)',
    'a premium, modern, high-tech / futuristic feel',
    'freedom from obvious AI artifacts (warped shapes, mushy detail, garbled forms)',
    brief ? 'how well it matches the intended art direction above' : null,
    isBg
      ? 'as a BACKGROUND: calm, low-detail center and upper area so overlaid poster text stays readable (busy or high-contrast text zones score low)'
      : 'clarity of the subject as a poster illustration'
  ].filter(Boolean);
  return `${pointLine}${briefLine}${paletteLine}Rate this poster ${isBg ? 'BACKGROUND ' : ''}image from 0 to 100 on: ${criteria.join('; ')}. `
    + 'Respond ONLY with a JSON object of this exact shape: '
    + '{"score": number, "issues": "one short sentence on the biggest problem, or empty if none"}. '
    + 'No markdown fences, no commentary outside the JSON.';
}
