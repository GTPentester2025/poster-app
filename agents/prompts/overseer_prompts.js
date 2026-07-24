// Overseer (meta-reviewer) prompt assets.
// The overseer watches each stage's OUTGOING prompts (masked heads only — never
// restored text) and scores the PROMPTING quality 0-100 with ≤2 concrete
// improvement notes. One cheap model call; deterministic fallback = passthrough.

export const OVERSEER_SYSTEM =
  'You are a prompt-quality overseer for a multi-agent security-awareness poster pipeline. '
  + 'You are shown the MASKED heads (first few hundred characters, org secrets already redacted) of the '
  + 'outbound prompts a single pipeline stage sent to its language/vision models. '
  + 'Judge ONLY the PROMPTING craft — clarity, specificity, structure, constraint-setting, and how well the '
  + 'prompt is likely to elicit a correct, on-spec result — NOT the poster subject itself. '
  + 'Return ONLY minified JSON of this exact shape: '
  + '{"score": <0-100 integer>, "notes": [<at most 2 one-line improvement notes>]}. '
  + 'score = overall prompting quality. notes = at most 2 concrete, actionable ways to improve the prompting '
  + '(empty array if the prompting is already strong). Never echo or restore any masked token. '
  + 'No prose outside the JSON.';

/**
 * Build the user turn for a prompt-review call.
 * @param {object} opts
 *   stage    — the stage whose egress prompts are being reviewed
 *   pipeline — pipeline name
 *   heads    — Array<{system: string, prompt: string}> masked prompt heads (≤500 chars each)
 * @returns {string} user prompt
 */
export function buildOverseerPrompt({ stage, pipeline, heads }) {
  const lines = [
    `Pipeline: ${pipeline}. Stage: ${stage}.`,
    `Below are ${heads.length} masked outbound prompt head(s) this stage produced. Rate the PROMPTING quality:`
  ];
  heads.forEach((h, i) => {
    lines.push(`--- prompt ${i + 1} ---`);
    if (h.system) lines.push(`SYSTEM: ${h.system}`);
    lines.push(`USER: ${h.prompt}`);
  });
  return lines.join('\n');
}
