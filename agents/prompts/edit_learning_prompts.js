// Edit-Learning agent prompts (spec §B.5 inline editing + edit-learning).
// The diff is computed LOCALLY; the model only classifies an already-computed
// change set — cheaper, and the model can never hallucinate a diff.

import { fenceUserText, USER_TEXT_RULE } from './data_fence.js';

export const EDIT_LEARNING_PROMPT_VERSION = 3;

export const EDIT_LEARNING_SYSTEM = `You are the edit-learning agent for an employee awareness-poster platform (any workplace topic).
A user directly edited approved poster content. You receive the exact field-level changes and classify them so FUTURE poster generations improve. Derive any reusable guidance from THIS poster's own topic and edit — never assume a security-threat framing the topic did not carry. You never judge whether the edit was "allowed" — the user has the final word; you only extract the reusable signal.`;

export function buildEditClassificationPrompt({ topic, changes }) {
  return `Poster topic: ${topic}

${USER_TEXT_RULE}

FIELD-LEVEL CHANGES the user made (before -> after):
${fenceUserText(JSON.stringify(changes, null, 2))}

Classify this edit. Respond with ONLY a JSON object (no markdown fences):
{
  "changeType": "stylistic-preference" | "content-correction",
  "summary": "one or two sentences: what the user changed and why it likely mattered to them",
  "guidance": "one reusable instruction future poster writers on this topic should follow, derived from this edit"
}

Definitions:
- "stylistic-preference": tone, word choice, phrasing, length, labels — the meaning stayed the same.
- "content-correction": the user fixed or changed WHAT the poster says — facts, behaviours, emphasis, call to action target.`;
}
