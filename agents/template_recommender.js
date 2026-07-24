// Template Recommender Agent (step-2 "AI picks the template"). Given the poster
// topic and the available templates, picks the SINGLE most impactful template
// that fits — so the content is then generated to that template's schema, exactly
// as if the user had picked it. Resilient: any model/parse failure (or no egress)
// falls back to a deterministic impact-ranked heuristic. User text is data-fenced.

import { fenceUserText, USER_TEXT_RULE } from './prompts/data_fence.js';

export const AGENT_ID = 'template-recommender';
export const skills = ['recommend_template'];

const CTX_STAGE = { pipeline: 'design', stage: 'template-recommend', agent: AGENT_ID, skill: 'recommend_template' };

const SYSTEM =
  'You are a poster art director. Given a security-awareness topic and a list of available poster '
  + 'TEMPLATES (id, style/blockKind, name, description), pick the SINGLE most impactful template that '
  + 'best fits the topic. Decide in two steps. STEP 1 — classify the topic SHAPE: '
  + 'stats/numbers | steps/process | comparison/dos-donts | scenario/story | single statement/quote | '
  + 'Q&A | general awareness. STEP 2 — pick the best-fitting template OF THAT SHAPE from the list, '
  + 'preferring bold, modern, image-first layouts. Different topics MUST land on different templates: '
  + 'never default to a narrative/comic template unless the topic is genuinely a scenario or story. '
  + 'Respond with ONLY minified JSON.';

const INSTRUCTION =
  'Return ONLY {"templateId": string, "reason": string}: templateId MUST be one of the provided ids; '
  + 'reason is one short sentence naming the topic shape and why this template lands the most impact for it.';

// Highest-impact first — the image-first family leads, then bold data/stat and
// infographic layouts. Used to rank the deterministic fallback.
const IMPACT_ORDER = [
  'cinematic-cover', 'photo-essay', 'editorial-hero', 'feature-spread', 'image-mosaic',
  'split-panorama', 'impact-burst', 'aurora-glass', 'neon-grid', 'threat-radar',
  'glass-stack', 'spotlight-quote', 'swiss-minimal', 'orbit-path',
  'info-command-center', 'timeline-journey'
];

/** Deterministic pick: topic-shape hints, then the impact ranking. Always valid. */
function heuristic(prompt, templates) {
  const ids = new Set(templates.map((t) => t.id));
  const has = (id) => (ids.has(id) ? id : null);
  const p = String(prompt || '').toLowerCase();
  let id = null;
  if (/\d+\s?%|\bstat|\bnumber|\bpercent|\bfigure/.test(p)) id = has('impact-burst') || has('neon-grid');
  else if (/\bstep|\bhow to|\bprocess|\bstage|\bjourney/.test(p)) id = has('editorial-hero') || has('feature-spread');
  else if (/\bvs\b|\bversus|\bcompare|\bdo(n'?t| not)?\b|\bred flag/.test(p)) id = has('image-mosaic') || has('feature-spread');
  else if (/\bquote|\bstatement|\bone thing|\bremember|\bpledge/.test(p)) id = has('cinematic-cover');
  if (!id) for (const c of IMPACT_ORDER) { if (ids.has(c)) { id = c; break; } }
  if (!id) id = templates[0] && templates[0].id;
  return { templateId: id, reason: 'Picked the highest-impact template that fits this topic.' };
}

/**
 * Recommend a template id for a topic.
 * @param {object} opts
 *   egress    — MaskingEgress (falsy → deterministic heuristic)
 *   runId     — attribution id for egress logging
 *   prompt    — the poster topic / prompt
 *   templates — [{ id, name, style, kind, description }]
 * @returns {Promise<{templateId: string, reason: string}>}
 */
export async function recommendTemplate({ egress, runId, prompt, templates = [] }) {
  const list = (Array.isArray(templates) ? templates : []).filter((t) => t && t.id);
  const fallback = heuristic(prompt, list);
  if (!egress || typeof egress.completeText !== 'function' || !runId || !list.length) return fallback;

  const catalog = list.map((t) => `${t.id} (${t.style}/${t.kind}): ${t.name} — ${t.description}`).join('\n');
  const user = [
    `Topic: ${fenceUserText(prompt || 'workplace security awareness')}.`,
    `Available templates:\n${fenceUserText(catalog)}`,
    USER_TEXT_RULE,
    INSTRUCTION
  ].join('\n');

  try {
    const raw = await egress.completeText({ system: SYSTEM, user, maxTokens: 200, temperature: 0.4 }, { runId, ...CTX_STAGE });
    const s = String(raw ?? '');
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a !== -1 && b > a) {
      const o = JSON.parse(s.slice(a, b + 1));
      if (o && typeof o.templateId === 'string' && list.some((t) => t.id === o.templateId)) {
        return { templateId: o.templateId, reason: typeof o.reason === 'string' && o.reason.trim() ? o.reason : fallback.reason };
      }
    }
  } catch { /* fall through to the deterministic heuristic */ }
  return fallback;
}
