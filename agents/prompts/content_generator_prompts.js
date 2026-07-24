// Content Generation agent prompts (spec §B.5). Versioned template constants.
// The hard limits below (headline/message word caps, 3-5 messages) are ALSO
// enforced structurally in agents/content_generator.js — the prompt states
// them so the model complies first time; the validator catches drift.

import {
  POSTER_VOICE_BLOCK, STYLE_BLOCK, buildAntiGenericBlock, TRANSLATABILITY_BLOCK
} from './voice_blocks.js';

export const CONTENT_GENERATOR_PROMPT_VERSION = 3;

export const HEADLINE_MAX_WORDS = 8;
export const MESSAGE_MAX_WORDS = 14;
export const MESSAGES_MIN = 3;
export const MESSAGES_MAX = 5;
export const ALLOWED_FORMATS = ['red-flags', 'dos-donts', 'scenario-response', 'key-messages', 'split'];

/**
 * v1 generator SYSTEM prompt. The seed (runId or prompt) rotates the neutral
 * example set so no single topic flavors the prompt; default seed keeps the
 * output deterministic for tests.
 */
export function buildContentGeneratorSystem(seed = 'default') {
  return `${POSTER_VOICE_BLOCK}

${STYLE_BLOCK}

${buildAntiGenericBlock(seed)}

${TRANSLATABILITY_BLOCK}

ROOM-READABILITY LIMITS (hard — output violating these is rejected automatically):
- headline: at most ${HEADLINE_MAX_WORDS} words.
- each message text: at most ${MESSAGE_MAX_WORDS} words.
- ${MESSAGES_MIN} to ${MESSAGES_MAX} messages — not padded to five, not starved to three; exactly as many as the content earns.

GROUNDING (mandatory):
- The INTERNAL CONTEXT below is your only source of facts. Paraphrase what it states or clearly implies; never invent statistics, incidents, product names, or techniques it does not contain.
- Never cite, name, or allude to news sources or outlets — attribution stays internal.

CALL TO ACTION:
- One short action line. You MAY use the literal placeholders {{SOC_EMAIL}} and {{TRAINING_PORTAL}} — they are resolved to real org values at render time. Write them exactly as shown, never invent an email address or URL.`;
}

const FORMAT_GUIDES = {
  'red-flags': `FORMAT: "red-flags" — messages are warning signs, each labelled "RED FLAG". If the request also asks for a plain-language explanation of the topic, use format "split": one message labelled "WHAT IT IS" (plain description) plus RED FLAG messages.`,
  'dos-donts': `FORMAT: "dos-donts" — messages alternate labels "DO" and "DON'T". Every DO names an action to take; every DON'T names a specific behaviour to avoid (concrete, not "don't be careless").`,
  'description': `FORMAT: "key-messages" — a plain-language explanation of the topic plus the key behaviours, labels null.`,
  'scenario-response': `FORMAT: "scenario-response" — first message labelled "SCENARIO" (a realistic situation the employee faces, present tense), remaining messages labelled "RESPONSE" (what to do, in order).`,
  default: `FORMAT: choose the strongest fit for this content from: ${ALLOWED_FORMATS.join(' | ')}. Set "format" accordingly and label messages to match ("RED FLAG", "DO"/"DON'T", "SCENARIO"/"RESPONSE", or null labels for key-messages).`
};

export function formatGuideFor(contentShape) {
  return FORMAT_GUIDES[contentShape] || FORMAT_GUIDES.default;
}

export const CONTENT_JSON_INSTRUCTION = `Respond with ONLY a JSON object (no markdown fences, no commentary) shaped exactly like:
{
  "headline": "at most ${HEADLINE_MAX_WORDS} words",
  "subheadline": "one short supporting line" | null,
  "messages": [ { "label": "RED FLAG" | "DO" | "DON'T" | "SCENARIO" | "RESPONSE" | "WHAT IT IS" | null, "text": "at most ${MESSAGE_MAX_WORDS} words" } ],
  "callToAction": "one action line, may contain {{SOC_EMAIL}} or {{TRAINING_PORTAL}}" | null,
  "format": "${ALLOWED_FORMATS.join('" | "')}"
}`;

// ── v2: template-aware generation (Phase O4, plan D1) ────────────────────────
// The v2 prompt is built FROM the chosen template's contentSchema: block kind,
// count range, per-block fields, word caps and image-slot count are stated
// explicitly so the model writes INTO the template's structure, never a
// generic bullet list. Structural enforcement lives in agents/content_schema.js.

export const CONTENT_GENERATOR_V2_PROMPT_VERSION = 3;

/** Writing guidance per D1 block kind — how the copy must behave, not just its shape. */
export const BLOCK_KIND_GUIDES = {
  sequence: 'Blocks are ORDERED STEPS presented as a reader journey: each step is one concrete action, and the order should read naturally (prepare → act → respond). Steps may be independently valid — a sensible progression is required, strict causal dependency between every pair is NOT. Short imperative labels.',
  'qa-pairs': 'Blocks are question-and-answer pairs. Each question must be a REAL question employees actually ask, in their own words (first person, specific situation — never a quiz question). Each answer gives the concrete behaviour, calm and direct.',
  panels: 'Blocks are comic-strip panels forming a story arc: setup, then the mistake or near-miss, then the lesson or save. MINIMAL text per panel — a short heading and one tight line; the visuals carry the story.',
  stats: 'Blocks are statistics. Use figures the internal context supports, or honest "X in Y" / "most" / "over half" framing that needs no source. NEVER invent a precise statistic presented as fact — an unsupported "87%" is an automatic rejection.',
  cells: 'Blocks are label + text rows of a scannable table or checklist. Each label names ONE thing to check; each text says what to look for. Rows must be parallel in tone and length.',
  branches: 'Blocks are decision branches: the label states a condition the reader may face, the text gives the outcome or action for that condition. Branches must be mutually distinct.',
  single: 'ONE punchy statement carries the whole poster. Every word must earn its place — declarative, concrete, quotable, no hedging.',
  scenario: 'Blocks walk one realistic workplace situation and the right response: the situation, the warning sign, the correct action, the outcome. Present tense, second person where natural.'
};

/** What each per-block field means to the writer (per-field intent, not shape). */
export const FIELD_MEANINGS = {
  label: 'short label naming the step, row, or branch (2-4 words)',
  text: 'the message body for this block — one tight sentence',
  heading: 'short panel heading (2-4 words)',
  question: 'a real employee question, first person, specific',
  answer: 'the direct, calm answer with the concrete behaviour',
  figure: 'the display figure, e.g. "9 in 10" or "60 sec" — honest framing only',
  value: 'the numeric part of the figure, digits only',
  unit: 'the unit for the value, e.g. "%" or "min"',
  caption: 'one line saying what the figure means for the reader',
  title: 'short block title (2-5 words)'
};

function fieldLine(field, caps) {
  const meaning = FIELD_MEANINGS[field] || 'non-empty text for this block';
  const cap = caps && Number.isInteger(caps[field]) ? ` (at most ${caps[field]} words)` : '';
  return `  - "${field}": ${meaning}${cap}`;
}

/**
 * Explicit description of the template the content must fill: style, block
 * kind + writing guidance, count range, per-block fields with meaning and
 * caps, headline/subheadline/CTA caps, image-slot count.
 */
export function buildTemplateStructureBlock(template) {
  const cs = template.contentSchema;
  const b = cs.blocks;
  const caps = (b.maxWords && typeof b.maxWords === 'object') ? b.maxWords : null;
  const slots = cs.imageSlots || 0;
  const slotLine = slots === 0
    ? 'This template has NO image slots — the words carry everything.'
    : `This template carries ${slots} illustration slot${slots > 1 ? 's' : ''} — write copy that works alongside the visuals (you may reference what the reader sees, never describe the images themselves).`;
  return `TEMPLATE STRUCTURE (hard requirements — the poster "${template.name}" renders exactly this shape):
- Template style: ${template.style} — ${template.description}
- Blocks: between ${b.min} and ${b.max} blocks of kind "${b.kind}" — exactly as many as the content earns within that range.
- ${BLOCK_KIND_GUIDES[b.kind] || 'Each block must carry one distinct message.'}
- Every block is a JSON object with ALL of these fields (all required, non-empty):
${b.fields.map((f) => fieldLine(f, caps)).join('\n')}
- headline: at most ${cs.headline.maxWords} words.${cs.subheadline ? `\n- subheadline: ${cs.subheadline.required ? 'required' : 'optional'}, at most ${cs.subheadline.maxWords} words.` : ''}
- callToAction: at most ${cs.callToAction.maxWords} words.
- ${slotLine}`;
}

/** JSON shape demand generated from the schema (v2 output carries no "format"). */
export function buildContentJsonInstructionV2(contentSchema) {
  const b = contentSchema.blocks;
  const fieldShape = b.fields.map((f) => `"${f}": "..."`).join(', ');
  return `Respond with ONLY a JSON object (no markdown fences, no commentary) shaped exactly like:
{
  "headline": "at most ${contentSchema.headline.maxWords} words",
  "subheadline": "one short supporting line" | null,
  "blocks": [ { ${fieldShape} } ],   // ${b.min}-${b.max} items of kind "${b.kind}"
  "callToAction": "one action line, may contain {{SOC_EMAIL}} or {{TRAINING_PORTAL}}"
}`;
}

/**
 * v2 (template-first) generator SYSTEM prompt — same seeded rotating example
 * discipline as buildContentGeneratorSystem.
 */
export function buildContentGeneratorSystemV2(seed = 'default') {
  return `${POSTER_VOICE_BLOCK}

${STYLE_BLOCK}

${buildAntiGenericBlock(seed)}

${TRANSLATABILITY_BLOCK}

TEMPLATE-FIRST WRITING (hard — output violating the TEMPLATE STRUCTURE section is rejected automatically):
- The user already chose a poster template. The TEMPLATE STRUCTURE section in the request defines the exact shape your copy must fill: block kind, block count range, per-block fields, word caps.
- Write INTO the structure: a Q&A template gets real questions, a comic template gets a story arc, a stats template gets honest figures — never a generic bullet list reshaped at the end.
- Respect every word cap; poster text is read across a room.

GROUNDING (mandatory):
- The INTERNAL CONTEXT below is your only source of facts. Paraphrase what it states or clearly implies; never invent statistics, incidents, product names, or techniques it does not contain.
- Never cite, name, or allude to news sources or outlets — attribution stays internal.

CALL TO ACTION:
- One short action line. You MAY use the literal placeholders {{SOC_EMAIL}} and {{TRAINING_PORTAL}} — they are resolved to real org values at render time. Write them exactly as shown, never invent an email address or URL.`;
}
