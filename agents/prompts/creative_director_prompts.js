// Prompt module for the creative-director agent. The model is a CHOOSER, not
// a generator: it selects one palette id, one font pair id, one template id
// and one visual mode from the lists the caller injects, plus free-form
// motifs/imageStyle strings that downstream image agents consume. Constrained
// choice keeps every combination pre-validated for contrast and layout.

export const CREATIVE_DIRECTOR_SYSTEM = [
  'You are the creative director for enterprise security-awareness posters.',
  'Given a poster topic and candidate libraries, you assemble ONE cohesive',
  'creative brief: color palette, font pairing, visual mode, template, plus',
  'visual motifs and an image style line. Cohesion beats novelty: every pick',
  'must reinforce the same mood. Prefer the template whose content structure',
  'best fits the content summary; avoid defaulting to the same palette or',
  'template across topics — match the topic\'s emotional register (urgent',
  'threat vs calm policy vs training energy).'
].join(' ');

export function buildBriefInstruction({ paletteLines, fontLines, templateLines, modeList }) {
  return [
    'Choose from these libraries ONLY.',
    `PALETTES:\n${paletteLines}`,
    `FONT PAIRS:\n${fontLines}`,
    `TEMPLATES:\n${templateLines}`,
    `VISUAL MODES: ${modeList}`,
    'Respond with ONLY a JSON object:',
    '{"paletteId": "...", "fontPairId": "...", "templateId": "...",',
    ' "visualMode": "...", "motifs": ["2-4 short visual motif phrases"],',
    ' "imageStyle": "one sentence describing the photographic/illustration style for all images",',
    ' "rationale": "one sentence"}'
  ].join('\n');
}

// intent/format → mood tags used by the deterministic fallback and to bias
// the model prompt. Keys match keyword_intent format hints.
export const FORMAT_MOODS = {
  stat: ['executive', 'tech'],
  steps: ['training', 'friendly'],
  qa: ['friendly', 'training'],
  policy: ['policy', 'compliance', 'trust'],
  scenario: ['cinematic', 'story'],
  comparison: ['minimal', 'corporate']
};

export const URGENT_WORDS = ['breach', 'attack', 'ransomware', 'urgent', 'alert', 'incident', 'scam', 'fraud', 'phishing'];
