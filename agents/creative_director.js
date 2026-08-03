// Creative Director Agent. One model call that unifies the poster's whole
// look: palette + font pair + template + visual mode + motifs + image style,
// chosen from curated libraries (data/creative-library.js) so every
// combination is pre-validated. Downstream: template build consumes
// palette/fonts, art_director + image agents consume visualMode/motifs/
// imageStyle. Fully resilient: no egress or any model/parse failure →
// deterministic brief (mood-mapped palette, shape-scored template), so the
// pipeline never blocks. When the org has a brandOverride, brandLocked=true
// keeps brand colors and the agent only directs fonts/mode/template/imagery.

import { fenceUserText, USER_TEXT_RULE } from './prompts/data_fence.js';
import {
  CREATIVE_DIRECTOR_SYSTEM, buildBriefInstruction, FORMAT_MOODS, URGENT_WORDS
} from './prompts/creative_director_prompts.js';
import {
  PALETTES, FONT_PAIRS, getPalette, getFontPair, palettesForMoods, fontPairsForTones
} from '../data/creative-library.js';
import { VISUAL_MODES, DEFAULT_VISUAL_MODE, normalizeMode } from './art_director.js';
import { DEFAULT_FONTS } from '../templates/palette.js';

export const AGENT_ID = 'creative-director';
export const skills = ['direct_creative'];

const CTX_STAGE = { pipeline: 'design', stage: 'creative-direction', agent: AGENT_ID, skill: 'direct_creative' };

/** Mood tags for a topic: format map + urgency scan of the topic words. */
export function moodsForTopic(topic = '', format = '') {
  const moods = [...(FORMAT_MOODS[String(format).toLowerCase()] || ['professional', 'corporate'])];
  const t = String(topic).toLowerCase();
  if (URGENT_WORDS.some((w) => t.includes(w))) moods.unshift('urgent', 'alert', 'dark');
  return moods;
}

/** Deterministic template pick: schema-kind match first, then slot count, then first. */
function fallbackTemplate(templates, format) {
  if (!templates.length) return null;
  const kindByFormat = {
    stat: ['stats'], steps: ['sequence', 'steps'], qa: ['qa-pairs', 'qa'],
    policy: ['bullets', 'policy'], scenario: ['sequence', 'scenario'], comparison: ['comparison', 'table']
  };
  const wanted = kindByFormat[String(format).toLowerCase()] || [];
  const byKind = templates.find((t) => wanted.some((k) => String(t.blocksKind || '').includes(k)));
  return byKind || templates[0];
}

function deterministicBrief({ topic, format, templates, brand, brandLocked }) {
  const moods = moodsForTopic(topic, format);
  const palette = brandLocked ? null : palettesForMoods(moods)[0];
  const fontPair = fontPairsForTones(moods)[0];
  const tpl = fallbackTemplate(templates, format);
  return finishBrief({
    paletteId: palette ? palette.id : 'brand-override',
    fontPairId: fontPair.id,
    templateId: tpl ? tpl.id : null,
    visualMode: moods.includes('dark') || moods.includes('urgent') ? 'futuristic' : DEFAULT_VISUAL_MODE,
    motifs: ['clean geometric shapes', 'subtle grid texture'],
    imageStyle: 'premium corporate photography, soft depth of field, cohesive color grade',
    rationale: 'deterministic fallback (mood-mapped)'
  }, { brand, brandLocked });
}

/** Resolve ids → concrete palette/fonts; brandLocked keeps org brand colors. */
function finishBrief(body, { brand, brandLocked }) {
  const lib = getPalette(body.paletteId);
  const palette = brandLocked || !lib
    ? brand.palette
    : { primary: lib.primary, secondary: lib.secondary, accent: lib.accent, background: lib.background, dark: lib.dark };
  const pair = getFontPair(body.fontPairId);
  const fonts = pair
    ? { head: pair.head, body: pair.body, fallback: DEFAULT_FONTS.fallback }
    : brand.fonts;
  return {
    paletteId: brandLocked || !lib ? 'brand-override' : lib.id,
    fontPairId: pair ? pair.id : 'brand-override',
    templateId: body.templateId || null,
    visualMode: normalizeMode(body.visualMode),
    motifs: (Array.isArray(body.motifs) ? body.motifs : []).slice(0, 4).map((m) => String(m)),
    imageStyle: String(body.imageStyle || 'premium corporate photography, cohesive color grade'),
    rationale: String(body.rationale || ''),
    palette,
    fonts
  };
}

function parseFirstJson(text) {
  const s = String(text ?? '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(s.slice(start, end + 1)); } catch { return null; }
}

/**
 * Produce a cohesive creative brief for one poster.
 * @param {object} opts
 *   egress         — MaskingEgress (falsy → deterministic fallback)
 *   runId          — pipeline run id
 *   topic          — user topic (data-fenced before prompting)
 *   format         — content format hint ('stat'|'steps'|'qa'|'policy'|'scenario'|'comparison')
 *   contentSummary — short summary of generated content (optional)
 *   templates      — [{id, name, style, blocksKind, imageSlots}] candidate metadata
 *   brand          — {palette, fonts} resolved brand (from resolveBrand)
 *   brandLocked    — true when org brandOverride must win over library palettes
 * @returns {Promise<Brief>} {paletteId, fontPairId, templateId, visualMode,
 *   motifs[], imageStyle, rationale, palette, fonts}
 */
export async function directCreative({
  egress, runId, topic = '', format = '', contentSummary = '',
  templates = [], brand, brandLocked = false
}) {
  const safeBrand = brand && brand.palette && brand.fonts
    ? brand
    : { palette: { ...(getPalette('brand-gold')) }, fonts: DEFAULT_FONTS };
  const fallback = deterministicBrief({ topic, format, templates, brand: safeBrand, brandLocked });
  if (!egress || typeof egress.completeText !== 'function' || !runId) return fallback;

  const moods = moodsForTopic(topic, format);
  const instruction = buildBriefInstruction({
    paletteLines: PALETTES.map((p) => `- ${p.id}: ${p.name} (${p.moods.join(', ')})`).join('\n'),
    fontLines: FONT_PAIRS.map((f) => `- ${f.id}: ${f.name} (${f.tones.join(', ')})`).join('\n'),
    templateLines: templates.map((t) => `- ${t.id}: ${t.name} [${t.style}] blocks=${t.blocksKind || 'any'} imageSlots=${t.imageSlots ?? 0}`).join('\n') || '- (no templates; set templateId null)',
    modeList: VISUAL_MODES.join(' | ')
  });
  const user = [
    `Poster topic: ${fenceUserText(topic)}.`,
    format ? `Content format: ${format}.` : '',
    contentSummary ? `Content summary: ${fenceUserText(contentSummary)}.` : '',
    `Suggested mood direction (may override with reason): ${moods.join(', ')}.`,
    brandLocked ? 'Brand colors are locked by the org — still pick paletteId closest to the mood for record, but fonts/template/mode/imagery are yours.' : '',
    USER_TEXT_RULE,
    instruction
  ].filter(Boolean).join('\n');

  try {
    const raw = await egress.completeText(
      { system: CREATIVE_DIRECTOR_SYSTEM, user, maxTokens: 600, temperature: 0.7 },
      { runId, ...CTX_STAGE }
    );
    const body = typeof raw === 'string' ? parseFirstJson(raw) : (raw && typeof raw === 'object' ? raw : null);
    if (body && typeof body === 'object') {
      const validTemplate = !body.templateId || templates.some((t) => t.id === body.templateId);
      if (!validTemplate) body.templateId = fallback.templateId;
      const brief = finishBrief(body, { brand: safeBrand, brandLocked });
      if (!brief.templateId) brief.templateId = fallback.templateId;
      return brief;
    }
  } catch { /* model/parse failure → deterministic brief */ }
  return fallback;
}
