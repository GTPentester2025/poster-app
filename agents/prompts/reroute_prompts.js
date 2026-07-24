// Reroute agent prompts (Phase O6, plan D4): "Not happy? Tell the pipeline."
// Free-text user feedback → which pipeline checkpoint the run should jump
// back to + concrete adjustments to seed into the re-run. The doc summary is
// built by the pipeline from SAFE fields only (never contextFile internals);
// the feedback is user text and always rides inside the data fence.

import { fenceUserText, USER_TEXT_RULE } from './data_fence.js';

export const REROUTE_PROMPT_VERSION = 2;

/** The four reroute checkpoints, in pipeline order. */
export const REROUTE_CHECKPOINTS = ['after-research', 'after-content', 'after-design', 'after-images'];

export const REROUTE_SYSTEM = `You are the reroute agent for an employee awareness-poster platform (any workplace topic).
A user is unhappy with their poster and told the pipeline why. You decide which pipeline checkpoint the run should jump back to, and what concrete adjustments the re-run should apply. Route by what the feedback is ABOUT (angle, wording, look, or pictures) — never by the poster's subject. You never rewrite the poster yourself — you only route and instruct.`;

// What re-runs from each checkpoint (kept in sync with reroute_pipeline.js).
const CHECKPOINT_MENU = `CHECKPOINT MENU (what re-runs from each):
- "after-research": research is kept; the user re-picks angles and the content is rewritten from scratch. Choose when the feedback questions the poster's angle, focus, or how the topic is framed.
- "after-content": research AND angle selection are kept; the content is rewritten. Choose when the feedback is about wording, tone, structure, or the number of points/blocks.
- "after-design": approved content is kept; the design is recompiled (layout, template, colors, composition). Choose when the feedback is about how the poster LOOKS, not what it says.
- "after-images": content and design are kept; image slots are cleared and the images are regenerated. Choose when the feedback is only about the pictures.`;

export function buildReroutePrompt({ feedback, docSummary }) {
  return `CURRENT POSTER (summary):
${JSON.stringify(docSummary, null, 2)}

${USER_TEXT_RULE}

USER FEEDBACK:
${fenceUserText(feedback)}

${CHECKPOINT_MENU}

Constraints:
- Only suggest "after-design" when the summary shows hasDesign: true, and "after-images" when hasImages: true.
- "adjustments" must be concrete, actionable guidance for the re-run (what to change, specifically) — not a restatement of the feedback.

Respond with ONLY a JSON object (no markdown fences):
{
  "checkpoint": "after-research" | "after-content" | "after-design" | "after-images",
  "reasoning": "one or two sentences: why this checkpoint addresses the feedback",
  "adjustments": "concrete guidance to seed into the re-run"
}`;
}
