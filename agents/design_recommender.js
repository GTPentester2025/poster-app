// Design Recommender Agent (spec §B.6 Path B): recommends a layout beyond the
// fixed template set and emits a layout-spec DSL (percent coordinates). This
// module OWNS the DSL semantics: structural validation, percent→pixel
// geometry, per-zone font sizing and background resolution — the reviewer's
// rendering summary and the pipeline's compiler both import them from here so
// what gets reviewed is exactly what gets compiled. The model proposes
// GEOMETRY only; approved text is rendered locally and one repair retry with
// the exact violations precedes DESIGN_SPEC_INVALID.

import {
  DESIGN_RECOMMENDER_SYSTEM, DESIGN_SPEC_JSON_INSTRUCTION,
  BACKGROUND_MODES, ZONE_ROLES, DECOR_SHAPES, MAX_IMAGE_SLOTS, MAX_TEXT_ZONE_OVERLAP, MIN_SLOT_PERCENT
} from './prompts/design_prompts.js';
import { fenceUserText, USER_TEXT_RULE } from './prompts/data_fence.js';
import {
  CANVAS_W, CANVAS_H, SEMANTIC_GREEN, fitFontSize, pickTextColor, contrastRatio
} from '../templates/helpers.js';

export const AGENT_ID = 'design-recommender';
export const skills = ['recommend_layout', 'generate_mockup_spec'];

const CTX_STAGE = { pipeline: 'design', stage: 'design-loop', agent: AGENT_ID, skill: 'generate_mockup_spec' };

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const ZONE_PAD_PX = 26; // inner padding applied when text is laid into a zone
const LABEL_CHIP_PX = 58; // vertical room a label chip consumes inside a message zone

// role → type-size model (px at 1414x2000). Floors match the predefined
// templates: headline never below 80, message never below 38.
export const ROLE_FONTS = {
  headline: { max: 132, min: 80, font: 'head', weight: '900' },
  subheadline: { max: 44, min: 30, font: 'body', weight: '600' },
  message: { max: 48, min: 38, font: 'body', weight: '600' },
  cta: { max: 44, min: 30, font: 'head', weight: '800' }
};

// ── DSL geometry (shared by reviewer summary + pipeline compiler) ────────────

/** Percent zone/slot/decor box → pixel box at 1414x2000. */
export function toPx({ x, y, w, h }) {
  return {
    x: Math.round(x * CANVAS_W / 100),
    y: Math.round(y * CANVAS_H / 100),
    w: Math.round(w * CANVAS_W / 100),
    h: Math.round(h * CANVAS_H / 100)
  };
}

/**
 * Background color under a zone center for contrast decisions. split = top
 * 40% colors[0] / rest colors[1]; diagonal = colors[1] above the slice line
 * running (0%,55%) → (100%,25%), colors[0] below. The compiler draws exactly
 * this geometry.
 */
export function zoneBackground(zone, background, palette) {
  if (zone.style?.bg) return zone.style.bg;
  const colors = background.colors || [];
  const base = colors[0] || palette.background;
  if (background.mode === 'solid' || colors.length < 2) return base;
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h / 2;
  if (background.mode === 'split') return cy < 40 ? base : colors[1];
  // diagonal
  return cy < 55 - 0.30 * cx ? colors[1] : base;
}

/** The font size a zone yields for its text (same math the compiler uses). */
export function zoneFontPx(zone, text) {
  const model = ROLE_FONTS[zone.role] || ROLE_FONTS.message;
  const px = toPx(zone);
  const scale = typeof zone.style?.fontScale === 'number' ? zone.style.fontScale : 1;
  const maxSize = Math.max(model.min, Math.round(model.max * scale));
  const labelRoom = zone.role === 'message' && zone._hasLabel ? LABEL_CHIP_PX : 0;
  return fitFontSize(String(text), {
    width: Math.max(60, px.w - 2 * ZONE_PAD_PX),
    height: Math.max(40, px.h - 2 * ZONE_PAD_PX - labelRoom),
    maxSize,
    minSize: model.min
  });
}

/** Text for a zone from the approved content (message zones resolve msgId). */
export function zoneText(zone, content) {
  switch (zone.role) {
    case 'headline': return content.headline;
    case 'subheadline': return content.subheadline || '';
    case 'cta': return content.callToAction || '';
    default: return content.messages.find((m) => m.id === zone.msgId)?.text || '';
  }
}

/**
 * Locally computed ground truth the reviewer scores against: pixel geometry,
 * the actual font size each zone yields and its WCAG contrast ratio.
 */
export function buildRenderingSummary(spec, content, palette) {
  return spec.zones.map((zone) => {
    const message = zone.role === 'message' ? content.messages.find((m) => m.id === zone.msgId) : null;
    const measured = { ...zone, _hasLabel: Boolean(message?.label) };
    const bg = zoneBackground(zone, spec.background, palette);
    const textColor = pickTextColor(bg);
    return {
      role: zone.role,
      ...(zone.msgId ? { msgId: zone.msgId } : {}),
      px: toPx(zone),
      fontPx: zoneFontPx(measured, zoneText(zone, content)),
      background: bg,
      textColor,
      contrast: Math.round(contrastRatio(bg, textColor) * 100) / 100
    };
  });
}

// ── structural validation ────────────────────────────────────────────────────

function isBox(z) {
  return ['x', 'y', 'w', 'h'].every((k) => typeof z[k] === 'number' && Number.isFinite(z[k]));
}

function overlapFraction(a, b) {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const smaller = Math.min(a.w * a.h, b.w * b.h);
  return smaller > 0 ? (ix * iy) / smaller : 0;
}

/**
 * Structural validation of a layout spec against the approved content:
 * shape, bounds, role coverage (headline, every message, cta), pairwise
 * text-zone overlap, decor and image-slot sanity.
 * @returns {string[]} problems (empty = valid)
 */
export function validateLayoutSpec(spec, content) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return ['spec is not a JSON object'];
  const problems = [];

  if (typeof spec.rationale !== 'string' || !spec.rationale.trim()) {
    problems.push('missing "rationale" (non-empty string — the user sees this)');
  }
  if (typeof spec.layoutType !== 'string' || !spec.layoutType.trim()) {
    problems.push('missing "layoutType" (short layout name)');
  }

  const bg = spec.background;
  if (!bg || typeof bg !== 'object' || !BACKGROUND_MODES.includes(bg.mode)) {
    problems.push(`"background.mode" must be one of: ${BACKGROUND_MODES.join(' | ')}`);
  }
  if (!bg || !Array.isArray(bg.colors) || bg.colors.length < 1 || bg.colors.length > 3 ||
      !bg.colors.every((c) => typeof c === 'string' && HEX_RE.test(c))) {
    problems.push('"background.colors" must be 1-3 #RRGGBB hex strings');
  }

  const zones = Array.isArray(spec.zones) ? spec.zones : null;
  if (!zones) {
    problems.push('"zones" must be an array');
    return problems;
  }
  zones.forEach((z, i) => {
    const tag = `zones[${i}]${z?.role ? ` (${z.role})` : ''}`;
    if (!z || typeof z !== 'object' || !ZONE_ROLES.includes(z.role)) {
      problems.push(`${tag}: "role" must be one of: ${ZONE_ROLES.join(' | ')}`);
      return;
    }
    if (!isBox(z)) { problems.push(`${tag}: x, y, w, h must be finite numbers (percent 0-100)`); return; }
    if (z.w <= 0 || z.h <= 0) problems.push(`${tag}: w and h must be positive`);
    if (z.x < 0 || z.y < 0 || z.x + z.w > 100 || z.y + z.h > 100) {
      problems.push(`${tag}: out of bounds — x >= 0, y >= 0, x+w <= 100, y+h <= 100 (got x=${z.x} y=${z.y} w=${z.w} h=${z.h})`);
    }
    if (z.role === 'message' && (typeof z.msgId !== 'string' || !z.msgId)) {
      problems.push(`${tag}: message zones must carry the message's "msgId"`);
    }
    const align = z.style?.align;
    if (align !== undefined && !['left', 'center', 'right'].includes(align)) {
      problems.push(`${tag}: style.align must be left | center | right`);
    }
    const fs = z.style?.fontScale;
    if (fs !== undefined && (typeof fs !== 'number' || !Number.isFinite(fs) || fs < 0.4 || fs > 2)) {
      problems.push(`${tag}: style.fontScale must be a number between 0.4 and 2`);
    }
    const zbg = z.style?.bg;
    if (zbg !== undefined && !(typeof zbg === 'string' && HEX_RE.test(zbg))) {
      problems.push(`${tag}: style.bg must be a #RRGGBB hex string`);
    }
  });

  // role coverage: headline, every message, cta/subheadline when present
  if (zones.filter((z) => z?.role === 'headline').length !== 1) {
    problems.push('exactly one zone with role "headline" is required');
  }
  const messageZoneIds = new Set(zones.filter((z) => z?.role === 'message' && typeof z.msgId === 'string').map((z) => z.msgId));
  for (const m of content.messages) {
    if (!messageZoneIds.has(m.id)) problems.push(`message "${m.id}" has no zone — every message must be placed`);
  }
  const knownIds = new Set(content.messages.map((m) => m.id));
  for (const id of messageZoneIds) {
    if (!knownIds.has(id)) problems.push(`zone references unknown msgId "${id}" (known: ${[...knownIds].join(', ')})`);
  }
  if (content.callToAction && !zones.some((z) => z?.role === 'cta')) {
    problems.push('content has a callToAction but no zone with role "cta"');
  }
  if (content.subheadline && !zones.some((z) => z?.role === 'subheadline')) {
    problems.push('content has a subheadline but no zone with role "subheadline"');
  }

  // pairwise text-zone overlap
  const boxes = zones.filter((z) => z && ZONE_ROLES.includes(z.role) && isBox(z));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const frac = overlapFraction(boxes[i], boxes[j]);
      if (frac > MAX_TEXT_ZONE_OVERLAP) {
        problems.push(`zones "${boxes[i].role}${boxes[i].msgId ? `:${boxes[i].msgId}` : ''}" and "${boxes[j].role}${boxes[j].msgId ? `:${boxes[j].msgId}` : ''}" overlap by ${Math.round(frac * 100)}% of the smaller zone (max ${Math.round(MAX_TEXT_ZONE_OVERLAP * 100)}%)`);
      }
    }
  }

  const decor = spec.decor ?? [];
  if (!Array.isArray(decor)) {
    problems.push('"decor" must be an array');
  } else {
    decor.forEach((d, i) => {
      if (!d || typeof d !== 'object' || !DECOR_SHAPES.includes(d.shape)) {
        problems.push(`decor[${i}]: "shape" must be one of: ${DECOR_SHAPES.join(' | ')}`);
        return;
      }
      if (!isBox(d)) problems.push(`decor[${i}]: x, y, w, h must be finite numbers`);
      if (!(typeof d.color === 'string' && HEX_RE.test(d.color))) problems.push(`decor[${i}]: "color" must be a #RRGGBB hex string`);
      if (d.rotation !== undefined && (typeof d.rotation !== 'number' || !Number.isFinite(d.rotation))) {
        problems.push(`decor[${i}]: "rotation" must be a number (degrees)`);
      }
    });
  }

  const slots = spec.imageSlots ?? [];
  if (!Array.isArray(slots) || slots.length > MAX_IMAGE_SLOTS) {
    problems.push(`"imageSlots" must be an array of at most ${MAX_IMAGE_SLOTS} slots`);
  } else {
    const seen = new Set();
    slots.forEach((s, i) => {
      if (!s || typeof s !== 'object' || typeof s.slotId !== 'string' || !s.slotId) {
        problems.push(`imageSlots[${i}]: "slotId" must be a non-empty string`);
        return;
      }
      if (seen.has(s.slotId)) problems.push(`imageSlots[${i}]: duplicate slotId "${s.slotId}"`);
      seen.add(s.slotId);
      if (!isBox(s) || s.w <= 0 || s.h <= 0 || s.x < 0 || s.y < 0 || s.x + s.w > 100 || s.y + s.h > 100) {
        problems.push(`imageSlots[${i}]: out of bounds — x >= 0, y >= 0, x+w <= 100, y+h <= 100`);
      } else if (s.w < MIN_SLOT_PERCENT || s.h < MIN_SLOT_PERCENT) {
        // deterministic mirror of the reviewer-prompt guarantee — a slot below
        // 8% of either dimension is decorative noise, not a usable image frame
        problems.push(`imageSlots[${i}]: slot too small — width and height must each be >= ${MIN_SLOT_PERCENT}% of the canvas`);
      }
      if (typeof s.styleHint !== 'string' || !s.styleHint.trim()) {
        problems.push(`imageSlots[${i}]: "styleHint" must describe the (text-free) illustration`);
      }
    });
  }

  return problems;
}

// ── prompt build + agent call ────────────────────────────────────────────────

function priorFeedbackBlock(priorFeedback) {
  if (!priorFeedback.length) return '';
  const entries = priorFeedback.map((f) => {
    const head = f.attempt ? `Attempt ${f.attempt}${typeof f.score === 'number' ? ` (scored ${f.score})` : ''}` : 'User input';
    return `${head}:
  problems: ${f.feedback}
  expected: ${f.expected || 'n/a'}`;
  });
  return `

PRIOR REVIEW HISTORY (full — fix EVERY listed problem; do not reintroduce earlier ones):
${entries.join('\n')}`;
}

export function buildRecommenderUserPrompt({ content, palette, userPrompt, priorFeedback }) {
  const userBlock = userPrompt
    ? `

${USER_TEXT_RULE}

THE USER DESCRIBED THE DESIGN THEY WANT (satisfy it within the structural rules): ${fenceUserText(userPrompt)}`
    : '';
  return `Design a poster layout for this approved content (format: ${content.format}).

CONTENT TO PLACE (verbatim — you position it, you never rewrite it):
headline: ${JSON.stringify(content.headline)}
subheadline: ${JSON.stringify(content.subheadline)}
messages: ${JSON.stringify(content.messages.map((m) => ({ id: m.id, label: m.label, text: m.text })), null, 2)}
callToAction: ${JSON.stringify(content.callToAction)}

BRAND PALETTE (backgrounds and decor use ONLY these values, plus semantic ${SEMANTIC_GREEN} green / duel red for dos-donts contrast):
${JSON.stringify(palette)}${userBlock}${priorFeedbackBlock(priorFeedback)}

${DESIGN_SPEC_JSON_INSTRUCTION}`;
}

function normalizeSpec(spec) {
  return {
    rationale: spec.rationale.trim(),
    layoutType: spec.layoutType.trim(),
    background: { mode: spec.background.mode, colors: [...spec.background.colors] },
    zones: spec.zones.map((z) => ({
      role: z.role,
      ...(z.msgId ? { msgId: z.msgId } : {}),
      x: z.x, y: z.y, w: z.w, h: z.h,
      ...(z.style && typeof z.style === 'object' ? { style: { ...z.style } } : {})
    })),
    decor: (spec.decor ?? []).map((d) => ({
      shape: d.shape, x: d.x, y: d.y, w: d.w, h: d.h, color: d.color,
      ...(d.rotation !== undefined ? { rotation: d.rotation } : {})
    })),
    imageSlots: (spec.imageSlots ?? []).map((s) => ({
      slotId: s.slotId, x: s.x, y: s.y, w: s.w, h: s.h, styleHint: s.styleHint.trim()
    }))
  };
}

/**
 * Recommend one layout-spec candidate.
 * @param {object} opts
 *   egress, runId  — required
 *   content        — approved poster content (headline, messages[], ...)
 *   palette        — resolved brand palette
 *   userPrompt     — optional user design instructions (fenced as data)
 *   priorFeedback  — [{attempt, feedback, expected, score?}] from ALL earlier loop iterations
 * @returns layout spec (validated + normalized); throws DESIGN_SPEC_INVALID after one repair retry
 */
export async function recommendDesign({ egress, runId, content, palette, userPrompt = '', priorFeedback = [] }) {
  if (!egress) throw new Error('recommendDesign requires an egress instance');
  if (!runId) throw new Error('recommendDesign requires a runId');
  if (!content?.headline || !Array.isArray(content.messages)) throw new Error('recommendDesign requires approved poster content');

  const ctx = { runId, ...CTX_STAGE };
  const user = buildRecommenderUserPrompt({ content, palette, userPrompt, priorFeedback });

  let out = await egress.completeJson({ system: DESIGN_RECOMMENDER_SYSTEM, user, temperature: 0.5 }, ctx);
  let problems = validateLayoutSpec(out, content);
  if (problems.length) {
    out = await egress.completeJson({
      system: DESIGN_RECOMMENDER_SYSTEM,
      user: `${user}\n\nYour previous layout spec violated structural rules:\n- ${problems.join('\n- ')}\nRespond again with ONLY the corrected JSON object.`,
      temperature: 0.2
    }, ctx);
    problems = validateLayoutSpec(out, content);
    if (problems.length) {
      const err = new Error(`Layout spec invalid after retry: ${problems.join('; ')}`);
      err.code = 'DESIGN_SPEC_INVALID';
      throw err;
    }
  }
  return normalizeSpec(out);
}
