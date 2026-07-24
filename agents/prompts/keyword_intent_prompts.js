// Keyword/Intent agent prompts (spec §B.3). Versioned template constants —
// prompt tuning happens here, never inline in agent logic.
//
// Iteration 3 (I1 relevance de-bias): the topic comes ONLY from the user's
// words. Short inputs are expanded FAITHFULLY (never redirected to a more
// common topic), there is no default topic anywhere, and genuinely ambiguous
// input keeps the user's literal words as the topic.

import { fenceUserText, USER_TEXT_RULE } from './data_fence.js';

export const KEYWORD_INTENT_PROMPT_VERSION = 3;

export const CONTENT_SHAPES = ['red-flags', 'dos-donts', 'description', 'scenario-response'];

export const KEYWORD_INTENT_SYSTEM = `You are the keyword & intent extraction agent for an employee awareness poster platform — security awareness on ANY topic the user requests, and general workplace-awareness topics too.
You analyze a user's poster request and perform SEMANTIC expansion, not literal matching: "tailgating at the office door" has the core keyword "tailgating" and expands to related retrieval terms like "physical security", "badge access", "visitor policy", "unauthorized entry".

TOPIC RULES (strict):
- The topic comes ONLY from the user's words. There is NO default topic — never supply one.
- A 2-3 word input is expanded faithfully into its own subject (e.g. "clean desk" → clean-desk policy awareness), NEVER redirected to a more common or adjacent topic.
- If the request is genuinely ambiguous, use the user's literal words as the topic — do not guess a substitute subject.
- Broad or non-security inputs are valid: extract the literal topic and expand around it.

You also detect the REQUESTED CONTENT SHAPE when the user implies one ("red flags", "dos and don'ts", "what is X" description, "scenario"). Most prompts imply none — then the shape is null. Never invent a shape the user did not ask for.
Short prompts are normal and must still produce a strong keyword set: expand from domain knowledge around the USER'S OWN topic.`;

export function buildKeywordIntentUserPrompt(prompt) {
  return `${USER_TEXT_RULE}

USER POSTER REQUEST:
${fenceUserText(prompt)}

Extract the intent. Respond with ONLY a JSON object (no markdown fences, no commentary) shaped exactly like:
{
  "topic": "the user's own topic, normalized and lowercase — taken from their words, never a substitute subject",
  "core": ["1-3 core keywords taken or normalized from the request"],
  "expanded": ["4-8 semantically related retrieval terms: variants of the user's topic, employee-awareness terms, adjacent techniques or situations"],
  "contentShape": "red-flags" | "dos-donts" | "description" | "scenario-response" | null
}

Rules:
- The topic comes ONLY from the user's request. A short request is expanded faithfully, never redirected to a more common topic; when genuinely ambiguous, use the literal words as the topic.
- "core" terms must be directly grounded in the request; "expanded" terms are for news retrieval and may go wider (related techniques, channels, awareness themes) while still serving the user's topic.
- Keep every keyword short (1-3 words), lowercase, no punctuation.
- contentShape is null unless the request clearly asks for that shape.`;
}
