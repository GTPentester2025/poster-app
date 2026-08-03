# Quality + Autopilot Upgrade — Design Spec

Date: 2026-08-04
Branch: feat/quality-autopilot
Status: approved (user pre-authorized full autonomy: "feel free to make new agents and do anything")

## Problem

1. **No one-click flow.** The 10-station metro line blocks on user input at angles,
   content approval, template pick, design, and image curation. User wants a single
   button that runs prompt → finished poster.
2. **Image relevance is weak.** `image_concept` briefs are thin (style + mood only),
   generation prompts don't encode composition/lighting/subject per slot, and
   `asset_recommender` matches on shallow keyword overlap — irrelevant or generic
   images get picked.
3. **Templates are basic and duplicative.** 82 templates exist but many share the
   same skeleton (headline top / stacked boxes / CTA bar) with different decor.
   Palette + font choices are a single default; output looks samey and unpolished.
4. **Baseline broken.** 10 unit tests fail from prior session (stale count
   expectations, overflow in 3 new templates, missing backgroundSlots on 8).

## Goals

- One button ("Auto-Create") producing a complete designed poster with images,
  zero intermediate prompts, with live SSE progress in the existing activity rail.
- Images that visibly match the topic, art direction, and slot role.
- A cohesive "creative direction" step so palette, fonts, template, and image
  style agree with each other per poster.
- Distinct, refined templates; kill sameyness.
- Green test suite throughout.

## Non-Goals

- No new external services or deps. OpenAI image gen stays the only image source.
- No rewrite of the metro UI; Auto-Create drives existing stations.
- No changes to translation pipeline or editor.

## Design

### 1. Autopilot pipeline (`pipelines/auto_pipeline.js`)

New StateGraph composing existing pipelines end-to-end:

```
keyword_intent → research → angle_autopick → content_gen ⇄ content_review (95-gate, max 4)
  → creative_director → template_apply → image_slots (fanout ≤6) → finalize
```

- **angle_autopick**: reuse angle generation, then a cheap model call ranks angles
  and picks one (criteria: specificity, actionability, freshness vs research).
  Falls back to first angle when egress unavailable.
- **content gate**: existing 95-gate loop; on cap-hit, take best-scoring attempt
  instead of escalating to user.
- **template_apply**: Path A (deterministic build) using creative_director's pick.
- **image_slots**: existing image_pipeline slot fill, auto-accepting the 70-gate
  winner; on repeated failure, slot falls back to background preset.
- Route: `POST /api/pipeline/auto` `{topic, orientation?}` → `{runId, posterId}`;
  progress via existing `/api/events/stream` grouped by run_id. Checkpoints
  persist via SqliteStateStore so a crashed run is resumable.

**UI**: Station 1 gains a primary "✨ Auto-Create" button next to the existing
manual "Continue". It POSTs `/api/pipeline/auto`, then the page follows SSE
events, auto-advancing station cards and updating the live preview. Any station
can still be reopened afterward for manual refinement.

### 2. Creative director (`agents/creative_director.js`)

One model call that returns a cohesive brief:

```js
{ paletteId, fontPairId, artDirection: {mode, motifs[], imageStyle}, templateId, rationale }
```

- Inputs: topic, keywords, intent/format, content summary, template metadata list
  (id, style, contentSchema.kind, imageSlot count), learning-table affinity rows.
- Constrained choice: model picks from curated libraries, not free-form hex —
  guarantees WCAG-checked combinations.
- `data/creative-library.js`: ~12 curated palettes (each: background, primary,
  accent, dark, light + mood tags) and ~8 font pairs (head/body + tone tags),
  every palette pre-validated for contrast via `pickTextColor`.
- Deterministic fallback (egress=null): score templates via existing
  `template_recommender`, pick palette by intent → mood tag map.
- Wired into design_pipeline Path A and autopilot; manual flow unchanged unless
  the user hits "Surprise me" (design station reuses the same agent).

### 3. Image relevance + generation v4

- **`image_concept` v2**: brief becomes
  `{subject, setting, composition, lighting, mood, styleKeywords[], avoid[]}`
  driven by slot role (background vs content slot), aspect ratio, art direction
  imageStyle, and topic keywords. Few-shot examples per style in prompts module.
- **`image_generator` prompt v4**: assembles concept fields into a structured
  prompt: subject sentence + composition clause (rule-of-thirds / centered /
  negative-space per slot aspect) + lighting + palette lock (existing
  hexToColorWord) + style preset + hard no-text/no-watermark/no-logo clause +
  `avoid` list. Bump `IMAGE_GENERATOR_PROMPT_VERSION = 4`.
- **`asset_recommender` v2 scoring**: weighted sum — topic keyword overlap
  (tokenized, stemmed-ish lowercase match) 45%, style match 20%, palette fit 15%,
  zero-text pass required, recency 10%, learning-table boost 10%. If best score
  < threshold (0.45), recommend generation instead of a poor library match.

### 4. Template quality pass

- Fix 3 overflow offenders + 8 backgroundSlots violations (baseline).
- Dedupe audit: compute per-template skeleton signature (zone roles + geometry
  buckets) offline; refine the worst near-duplicates by differentiating layout
  geometry, not just decor.
- Add 6 new genuinely distinct templates (all dual-orientation, manifest-valid,
  overflow-tested, ≥1 background slot):
  1. `poster_brutal` — big-type brutalist: giant headline, raw grid, stark contrast
  2. `iso_grid` — isometric card grid with depth shadows
  3. `mag_cover` — magazine cover: masthead, cover lines, full-bleed image
  4. `data_ring` — donut/ring dashboard for stats content
  5. `roadmap_milestones` — horizontal/vertical milestone road for sequence content
  6. `split_collage` — asymmetric photo collage with color-block panels
- Register in v2/index.js; template count tests become dynamic (derive expected
  count from registry length, not literals).

## Error handling

- Autopilot never dead-ends: every gate cap-hit degrades (best attempt / preset
  fallback) and emits a `degraded` SSE event naming the stage.
- Model JSON parse failures already repair-retried; creative_director validates
  ids against libraries, invalid → deterministic fallback.

## Testing

- Unit: auto_pipeline graph (fake egress) — happy path, gate cap degradation,
  resume; creative_director fallback + library validation; image_concept shape;
  generator prompt v4 assembly; asset scoring ranking + threshold; each new
  template through manifest/overflow/background audits (existing harness picks
  them up from registry automatically).
- All 896+ tests green at end of each phase.
