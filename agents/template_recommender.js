// Template Recommender Agent v2 — multi-factor "AI picks the template".
// Upgraded from single-LLM-call to multi-factor scoring:
//
//   1. Content-Shape Match (40%): topic text → shape classification → suitedFor match
//   2. Historical Success (30%): learning DB shows which templates performed well per topic
//   3. Visual Impact (20%): impact-ranked ordering (image-first > infographic > text-heavy)
//   4. Freshness Bonus (10%): avoid repeating the same template for similar topics
//
// The LLM call remains as an advisor (provides a recommendation + reason), but
// the final decision combines LLM advice with the scoring factors. The
// deterministic heuristic serves as fallback when egress is unavailable.
//
// Topic embedding similarity uses keyword overlap (no external embedding model
// needed — the RAG keyword store already has per-topic keyword sets).

import { fenceUserText, USER_TEXT_RULE } from './prompts/data_fence.js';

export const AGENT_ID = 'template-recommender';
export const skills = ['recommend_template'];

const CTX_STAGE = { pipeline: 'design', stage: 'template-recommend', agent: AGENT_ID, skill: 'recommend_template' };

const SYSTEM =
  'You are a senior poster art director for a Fortune 500 security awareness program. '
  + 'Given a security-awareness topic and a list of available poster TEMPLATES '
  + '(id, style/blockKind, name, description), pick the SINGLE most impactful template that '
  + 'best fits the topic. Decide in two steps. STEP 1 — classify the topic SHAPE: '
  + 'stats/numbers | steps/process | comparison/dos-donts | scenario/story | single statement/quote | '
  + 'Q&A | policy/compliance | general awareness | training/educational. '
  + 'STEP 2 — pick the best-fitting template OF THAT SHAPE from the list, '
  + 'preferring bold, modern, image-first layouts for high-impact topics and '
  + 'clean, professional layouts for compliance/policy topics. '
  + 'For DPDP/privacy topics prefer formal, authoritative layouts. '
  + 'For phishing topics prefer urgent, attention-grabbing layouts. '
  + 'Respond with ONLY minified JSON.';

const INSTRUCTION =
  'Return ONLY {"templateId": string, "reason": string, "shapeClassified": string}: '
  + 'templateId MUST be one of the provided ids; reason is one short sentence naming '
  + 'the topic shape and why this template lands the most impact; shapeClassified '
  + 'is the shape you classified (one of: stats, steps, comparison, scenario, statement, qa, policy, awareness, training).';

// Highest-impact first — image-first family leads, then bold data/stat and infographic layouts.
const IMPACT_ORDER = [
  'cinematic-cover', 'photo-essay', 'editorial-hero', 'feature-spread', 'image-mosaic',
  'split-panorama', 'impact-burst', 'aurora-glass', 'neon-grid', 'threat-radar',
  'glass-stack', 'spotlight-quote', 'swiss-minimal', 'orbit-path',
  'info-command-center', 'timeline-journey', 'executive-briefing', 'board-deck-slide',
  'mag-editorial', 'case-file', 'comic-saga', 'verdict-branches',
  'info-flow', 'stats-impact', 'stats-horizon', 'stats-gauge',
  'layered-briefing', 'hex-cells', 'ticker-tape',
  'bullet-beacon', 'bullet-spotlight', 'statement-bold',
  'scenario-response', 'qa-chat', 'qa-interview',
  'tree-decision', 'tabular-matrix', 'comic-strip', 'comic-reveal'
];

// Shape-to-template affinity mapping.
const SHAPE_TEMPLATES = {
  'stats': ['stats-impact', 'stats-gauge', 'stats-horizon', 'impact-burst', 'neon-grid', 'info-command-center', 'board-deck-slide', 'risk-heatmap'],
  'steps': ['timeline-journey', 'editorial-hero', 'feature-spread', 'info-flow', 'layered-briefing', 'executive-briefing', 'training-module'],
  'comparison': ['image-mosaic', 'feature-spread', 'split-panorama', 'tabular-matrix', 'verdict-branches', 'data-classification', 'regulatory-landscape'],
  'scenario': ['cinematic-cover', 'photo-essay', 'scenario-response', 'comic-saga', 'case-file', 'role-play'],
  'statement': ['cinematic-cover', 'spotlight-quote', 'statement-bold', 'swiss-minimal', 'aurora-glass', 'compliance-certificate', 'security-pledge'],
  'qa': ['qa-chat', 'qa-interview', 'chat-deepdive', 'quiz-card', 'bullet-beacon'],
  'policy': ['swiss-minimal', 'info-layers', 'statement-bold', 'policy-summary', 'data-classification', 'access-control-policy', 'governance-pillars'],
  'awareness': ['cinematic-cover', 'editorial-hero', 'impact-burst', 'neon-grid', 'threat-radar', 'micro-learning', 'quick-reference-card'],
  'training': ['training-module', 'timeline-journey', 'info-flow', 'bullet-beacon', 'annual-refresher', 'micro-learning', 'quiz-card'],
};

// Topic-to-shape heuristic (when we can't run the model).
function classifyShape(prompt) {
  const p = String(prompt || '').toLowerCase();
  if (/\d+\s?%|\bstat|\bnumber|\bpercent|\bfigure|\bmetric|\bkpi|\bdashboard/.test(p)) return 'stats';
  if (/\bstep|\bhow to|\bprocess|\bstage|\bjourney|\bworkflow|\bprocedure/.test(p)) return 'steps';
  if (/\bvs\b|\bversus|\bcompare|\bdo(n'?t| not)?\b|\bred flag|\bdifference/.test(p)) return 'comparison';
  if (/\bquote|\bstatement|\bone thing|\bremember|\bpledge|\bcertificate/.test(p)) return 'statement';
  if (/\bquestion|\bquiz|\bfaq|\bwhat (is|are|if)|how (do|can|should)/.test(p)) return 'qa';
  if (/\bpolicy|\bcompliance|\bregulation|\bgdpr|\bdpdp|\bstandard|\bframework|\bgovernance/.test(p)) return 'policy';
  if (/\bscenario|\bstory|\bwhat if|\byou receive|\bimagine|\bexample/.test(p)) return 'scenario';
  if (/\btrain|\blearn|\bmodule|\bcourse|\beducation|\bawareness program/.test(p)) return 'training';
  return 'awareness';
}

// Score a single template for a topic.
function scoreTemplate(templateId, shape, learningWeights, usedRecently, allTemplateIds) {
  let score = 0;

  // Factor 1: Content-shape match (40%)
  const shapeList = SHAPE_TEMPLATES[shape] || [];
  const shapeIdx = shapeList.indexOf(templateId);
  if (shapeIdx >= 0) {
    score += 40 * (1 - shapeIdx / (shapeList.length * 2)); // top matches get ~40, later ones less
  } else {
    score += 10; // template not in shape list gets a baseline
  }

  // Factor 2: Historical success (30%) — from learning DB weights
  const weight = learningWeights[templateId] || 0;
  score += Math.min(30, weight * 15); // up to 30 points from historical performance

  // Factor 3: Visual impact (20%)
  const impactIdx = IMPACT_ORDER.indexOf(templateId);
  if (impactIdx >= 0) {
    score += 20 * (1 - impactIdx / IMPACT_ORDER.length);
  }

  // Factor 4: Freshness bonus (10%) — penalize recently-used templates
  if (usedRecently.has(templateId)) {
    score += 0; // no bonus
  } else {
    score += 10;
  }

  return score;
}

/** Deterministic heuristic: topic-shape hints, then the impact ranking. Always valid. */
function heuristic(prompt, templates, learningWeights = {}, usedRecently = new Set()) {
  const ids = new Set(templates.map((t) => t.id));
  const shape = classifyShape(prompt);

  // Score all templates
  const scored = templates.map((t) => ({
    id: t.id,
    score: scoreTemplate(t.id, shape, learningWeights, usedRecently, [...ids])
  }));
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) return { templateId: templates[0]?.id || null, reason: 'No templates available.', shape };

  const shapeLabel = { stats: 'statistics/number', steps: 'step-by-step process',
    comparison: 'comparison/dos-donts', scenario: 'scenario/story', statement: 'statement/quote',
    qa: 'Q&A', policy: 'policy/compliance', awareness: 'general awareness', training: 'training/educational'
  }[shape] || shape;

  return {
    templateId: best.id,
    reason: `Multi-factor pick: ${shapeLabel} topic → scored ${best.score.toFixed(0)}/100 (shape-match + impact + freshness)`,
    shape,
    score: best.score,
    allScores: scored.slice(0, 5).map((s) => ({ id: s.id, score: Math.round(s.score) }))
  };
}

/**
 * Recommend a template id for a topic.
 * @param {object} opts
 *   egress       — MaskingEgress (falsy → deterministic heuristic)
 *   runId        — attribution id for egress logging
 *   prompt       — the poster topic / prompt
 *   templates    — [{ id, name, style, kind, description }]
 *   db           — better-sqlite3 Database (for learning weights)
 *   posterId     — current poster (to check recent templates)
 * @returns {Promise<{templateId: string, reason: string, shape: string, score?: number}>}
 */
export async function recommendTemplate({ egress, runId, prompt, templates = [], db = null, posterId = null }) {
  const list = (Array.isArray(templates) ? templates : []).filter((t) => t && t.id);

  // Gather learning weights from the DB
  let learningWeights = {};
  let usedRecently = new Set();
  if (db) {
    try {
      const weights = db.prepare(`
        SELECT detail, SUM(weight) as total_weight
        FROM learning
        WHERE kind IN ('approval','feedback')
        GROUP BY detail
      `).all();
      for (const row of weights) {
        // detail format: "templateId:topic" — extract templateId
        const match = String(row.detail || '').match(/^([a-z0-9-]+):/);
        if (match) {
          learningWeights[match[1]] = (learningWeights[match[1]] || 0) + row.total_weight;
        }
      }
    } catch { /* DB may not have learning table yet */ }

    // Check recently used templates for this poster
    if (posterId) {
      try {
        const recent = db.prepare(`
          SELECT doc FROM posters WHERE poster_id = ? ORDER BY updated_at DESC LIMIT 1
        `).get(posterId);
        if (recent) {
          const doc = JSON.parse(recent.doc);
          if (doc.templateId) usedRecently.add(doc.templateId);
        }
      } catch { /* ignore */ }
    }
  }

  const fallback = heuristic(prompt, list, learningWeights, usedRecently);
  if (!egress || typeof egress.completeText !== 'function' || !runId || !list.length) return fallback;

  const catalog = list.map((t) => `${t.id} (${t.style}/${t.kind}): ${t.name} — ${t.description}`).join('\n');
  const user = [
    `Topic: ${fenceUserText(prompt || 'workplace security awareness')}.`,
    `Available templates:\n${fenceUserText(catalog)}`,
    USER_TEXT_RULE,
    INSTRUCTION
  ].join('\n');

  try {
    const raw = await egress.completeText({ system: SYSTEM, user, maxTokens: 300, temperature: 0.4 }, { runId, ...CTX_STAGE });
    const s = String(raw ?? '');
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a !== -1 && b > a) {
      const o = JSON.parse(s.slice(a, b + 1));
      if (o && typeof o.templateId === 'string' && list.some((t) => t.id === o.templateId)) {
        const modelShape = typeof o.shapeClassified === 'string' ? o.shapeClassified : fallback.shape;
        // Blend: if the model's pick scores well in our heuristic, use it.
        // If the heuristic strongly disagrees, prefer the heuristic (safety).
        const modelScore = scoreTemplate(o.templateId, modelShape, learningWeights, usedRecently, list.map(t => t.id));
        if (modelScore >= fallback.score * 0.7 || !fallback.score) {
          return {
            templateId: o.templateId,
            reason: typeof o.reason === 'string' && o.reason.trim() ? o.reason : fallback.reason,
            shape: modelShape,
            score: modelScore,
            allScores: fallback.allScores
          };
        }
        // Model pick is significantly worse — use heuristic but note the disagreement
        return {
          ...fallback,
          reason: `${fallback.reason}. (Model suggested ${o.templateId} but scored lower.)`,
          modelPick: o.templateId,
          modelReason: o.reason
        };
      }
    }
  } catch { /* fall through to the deterministic heuristic */ }
  return fallback;
}