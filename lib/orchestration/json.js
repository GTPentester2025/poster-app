// tryParseJson — tolerant JSON extraction from model text. Vendored from the
// studio LlmClient (only this pure helper is needed here; the full LlmClient is
// a studio concern and stays there). Strips ```json fences, then falls back to
// the outermost {...} slice. Returns undefined when nothing parses.

export function tryParseJson(text) {
  if (!text) return undefined;
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(stripped); } catch { /* fall through */ }
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(stripped.slice(start, end + 1)); } catch { /* fall through */ }
  }
  return undefined;
}
