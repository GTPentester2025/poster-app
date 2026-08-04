// Research synthesis -> InternalContextFile (shared/schemas/context-file.schema.json).
// The model synthesizes keywords/synthesis/angles from retrieved articles;
// the TOPIC is the caller's intent topic verbatim (never the model's), and
// sources are assembled HERE from the input rows (never trusted
// from the model — attribution must be exact). All model traffic goes through
// the injected egress instance: this module imports no SDKs by design (the
// masking boundary is enforced by ESLint and leak tests).

import { randomUUID } from 'node:crypto';

const CTX_STAGE = { pipeline: 'content', stage: 'research-synthesis', agent: 'rag-research', skill: 'synthesize_context' };
const CONTENT_SHAPES = ['red-flags', 'dos-donts', 'description', 'scenario-response'];

// Authoritative provision digest for the synthesis prompt. Unlike articles
// (dated news), knowledge entries are statute/guidance the model may lean on as
// ground truth — each is labelled with its citation so the synthesis can be
// anchored to real provisions. Citations are woven into the SUPPORT material for
// the model, but the resulting poster copy still never prints a source (the same
// no-attribution rule articles follow) — the citations[] array on the output is
// internal grounding metadata for downstream review, not poster text.
function knowledgeDigest(knowledge) {
  return knowledge.map((e, i) => {
    const lines = [
      `[K${i + 1}] ${e.framework} — ${e.citation}: ${e.title}`,
      `    ${e.summary}`
    ];
    if (Array.isArray(e.obligations) && e.obligations.length) {
      lines.push(`    obligations: ${e.obligations.join('; ')}`);
    }
    if (e.penalties) lines.push(`    penalties: ${e.penalties}`);
    return lines.join('\n');
  }).join('\n\n');
}

function articleDigest(articles) {
  return articles.map((a, i) => {
    const lines = [
      `[${i + 1}] ${a.title}`,
      `    source: ${a.source || 'unknown'} | published: ${a.pub_date || a.pubDate || 'unknown'} | type: ${a.type || 'Security News'}`,
      `    ${a.description || ''}`
    ];
    if (a.summary) lines.push(`    analyst summary: ${a.summary}`);
    return lines.join('\n');
  }).join('\n\n');
}

// Validate the model's contribution (not the whole schema — contextId/runId/
// createdAt/sources are added locally and cannot be wrong). The model is NOT
// asked for a topic: the user's intent topic is authoritative (a model
// "normalization" over security-news-heavy retrieval used to collapse every
// topic to 'phishing').
function validateModelOutput(out) {
  const problems = [];
  if (!out || typeof out !== 'object') return ['response is not a JSON object'];
  if (!out.keywords || typeof out.keywords !== 'object') {
    problems.push('missing "keywords" object with core[] and expanded[]');
  } else {
    if (!Array.isArray(out.keywords.core) || !out.keywords.core.length) problems.push('keywords.core must be a non-empty string array');
    if (!Array.isArray(out.keywords.expanded)) problems.push('keywords.expanded must be a string array');
  }
  if (typeof out.synthesis !== 'string' || out.synthesis.trim().length < 50) {
    problems.push('missing "synthesis" (substantial multi-article synthesis string)');
  }
  if (!Array.isArray(out.angles) || out.angles.length < 3 || out.angles.length > 5) {
    problems.push('"angles" must be an array of 3-5 items');
  } else {
    out.angles.forEach((a, i) => {
      if (!a || typeof a.id !== 'string' || typeof a.title !== 'string' || typeof a.rationale !== 'string') {
        problems.push(`angles[${i}] must have string id, title, rationale`);
      }
    });
  }
  return problems;
}

function buildPrompt({ topic, keywords, articles, knowledge = [] }) {
  // Authoritative provisions (statute/guidance) are presented as GROUND TRUTH the
  // model may rely on for legal accuracy; articles remain dated, possibly-
  // tangential news. When knowledge is present the model is told to prefer it for
  // any compliance claim, and to keep the synthesis faithful to the cited duties.
  const knowledgeBlock = knowledge.length
    ? `\nAUTHORITATIVE PROVISIONS (ground truth — prefer these for any legal/compliance claim about "${topic}"):
${knowledgeDigest(knowledge)}\n`
    : '';

  return `You are the research-synthesis agent for an employee security-awareness poster platform.
The user's topic is "${topic}". The ${articles.length} articles below were retrieved as POSSIBLE supporting context — they may be tangential or unrelated to "${topic}".
${knowledgeBlock}
ARTICLES:
${articleDigest(articles)}

Produce an INTERNAL context file. Rules:
- This file is internal-only: it feeds downstream poster-writing agents and is never shown to end users.
- The topic is "${topic}" and only "${topic}". Synthesize what is genuinely relevant to "${topic}"; if an article is unrelated, ignore it entirely.
- Every angle MUST teach "${topic}" — an angle about a different security subject (e.g. phishing when the topic is GDPR) is a failure.
- Angles must serve the USER'S topic even when it is not a classic security topic; broad or non-security inputs get faithful treatment of the literal topic — never a substitution toward a more common security subject.
- If fewer than 2 articles are genuinely relevant to "${topic}", say so in the synthesis and build the synthesis and angles from established knowledge about "${topic}" instead.
- Focus on EMPLOYEE awareness: what regular staff should recognize and do, not admin/technical remediation.
- Synthesize ACROSS the relevant articles: current attacker techniques, real situations employees face, and why this matters now.
- Downstream poster copy must not attribute or cite sources; do not embed source names, outlet names, or URLs inside "synthesis" or "angles" text.

Respond with ONLY a JSON object (no markdown fences) shaped exactly like:
{
  "keywords": {
    "core": ["the user's core terms, normalized"],
    "expanded": ["related terms discovered in the articles, relevant to \\"${topic}\\""],
    "contentShape": ${JSON.stringify(CONTENT_SHAPES.join(' | '))} — pick ONE if the request implies a shape, else null
  },
  "synthesis": "structured synthesis of what is relevant to \\"${topic}\\": current techniques, situation-based angles, employee-relevant guidance",
  "angles": [ { "id": "angle-1", "title": "...", "rationale": "why this angle would make an effective awareness poster about \\"${topic}\\"" } ]  // 3 to 5 angles
}

User's requested topic: ${topic}
User's keywords: ${JSON.stringify(keywords || [])}`;
}

/**
 * Build the InternalContextFile for a run. One retry with explicit feedback
 * when the model's JSON misses required fields; throws CONTEXT_FILE_INVALID
 * after the second failure so the pipeline can surface a real error instead
 * of feeding malformed research downstream.
 */
export async function buildContextFile({ db: _db, egress, runId, topic, keywords = [], articles = [], knowledge = [] }) {
  if (!egress) throw new Error('buildContextFile requires an egress instance');
  if (!runId) throw new Error('buildContextFile requires a runId');
  if (!articles.length) {
    const err = new Error('No articles supplied — run retrieval before synthesis');
    err.code = 'CONTEXT_NO_ARTICLES';
    throw err;
  }
  const ctx = { runId, ...CTX_STAGE };
  // The USER'S intent topic is authoritative — never the model's idea of a
  // "normalized" topic (topic-hijack fix: retrieval is security-news heavy,
  // so a model normalization drifted every topic toward 'phishing').
  const intentTopic = String(topic).trim().toLowerCase();
  const basePrompt = buildPrompt({ topic: intentTopic, keywords, articles, knowledge });

  let out = await egress.completeJson({ user: basePrompt, temperature: 0.3 }, ctx);
  let problems = validateModelOutput(out);
  if (problems.length) {
    // Second (final) attempt: same prompt + concrete feedback about what was
    // missing. Deterministic temperature — we want compliance, not creativity.
    out = await egress.completeJson({
      user: `${basePrompt}\n\nYour previous response was invalid:\n- ${problems.join('\n- ')}\nRespond again with ONLY the corrected JSON object.`,
      temperature: 0
    }, ctx);
    problems = validateModelOutput(out);
    if (problems.length) {
      const err = new Error(`Context file invalid after retry: ${problems.join('; ')}`);
      err.code = 'CONTEXT_FILE_INVALID';
      throw err;
    }
  }

  const contentShape = CONTENT_SHAPES.includes(out.keywords.contentShape) ? out.keywords.contentShape : null;
  return {
    contextId: `ctx-${randomUUID()}`,
    runId,
    createdAt: new Date().toISOString(),
    topic: intentTopic,
    keywords: {
      core: out.keywords.core.map(String),
      expanded: (out.keywords.expanded || []).map(String),
      contentShape
    },
    synthesis: out.synthesis,
    angles: out.angles.map((a) => ({ id: a.id, title: a.title, rationale: a.rationale })),
    // Provision citations assembled locally from the knowledge hits (never from
    // the model — attribution must be exact). ADDITIVE field: existing consumers
    // that read topic/keywords/synthesis/angles/sources are unaffected; when the
    // run had no knowledge grounding this is an empty array. Ids stay internal
    // (grounding/audit trail), poster copy never prints them.
    citations: knowledge.map((e) => ({ citation: e.citation, framework: e.framework, id: e.id })),
    // Attribution assembled from the retrieval rows verbatim — internal logs
    // only, never printed on the poster (schema: sources.description).
    sources: articles.map((a) => ({
      articleId: a.id ?? 0,
      title: a.title,
      source: a.source || '',
      url: a.url || '',
      pubDate: a.pub_date || a.pubDate || '',
      relevanceScore: a.relevance_score ?? a.relevanceScore ?? 0,
      // recencyWeight is schema-optional (a number when present) — omit
      // rather than emit null for articles that skipped retrieval scoring
      ...(a.recencyWeight != null ? { recencyWeight: a.recencyWeight } : {})
    }))
  };
}
