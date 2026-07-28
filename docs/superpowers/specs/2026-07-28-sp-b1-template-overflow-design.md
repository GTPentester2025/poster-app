# SP-B (step 1) — Template padding / overflow / overlap fix

**Date:** 2026-07-28
**Status:** Approved (design)
**Scope:** poster-app — eliminate text overflow (content running off the canvas) and overlap (content blocks colliding) across the 64 `templates/v2` templates under realistic long content. Deterministic; the dedup of look-alike templates is a separate later step (SP-B step 2).

## Problem

Users see padding issues, text overlapping, and text overflowing on generated
posters. Measured: rendering all 64 v2 templates × {portrait, landscape} with
**stress content** (long headline/subheadline/CTA, long message label+body, max
message counts) flags **18 templates** — 19 overflow + 57 overlap violations.
Worst: `trust-but-verify`, `data-privacy-panels`, `comic-saga`, `orbit-path`,
`holiday-scams`, `guard-your-data`, `future-is-now`, `update-stay-safe`,
`incident-photo-hero`, `access-control-policy`(+`_zh`), `cyber-month-agenda`,
`constellation-before-after`, `threat-radar`, `glass-stack`, `impact-burst`,
`webinar-invite`, `gisp-release-numbered`.

Root cause (documented at `templates/helpers.js:236`): templates use fixed
block positions or call `fitFontSize` and then advance the cursor by a
mismatched/estimated height, so long content spills past its region into the
next block or off the canvas. The estimator matches the templates' own fit
logic, so the bug only surfaces at the min-font floor and with long content.

## Approach

A shared **stress-audit** renders every template with worst-case content and
flags any content block outside the canvas or overlapping a sibling. It becomes
a permanent regression test (fails now, listing the 18). Each offending template
is corrected to the `fitTextBlock` + advance-by-real-height discipline with a
shared safe-area, capping gracefully (scale/reflow, never drop content) until
the audit is empty.

## Design

### 1. Shared audit module — new `templates/v2/overflow_audit.js` (pure)

```
STRESS = { long strings + max-count messages } generator
stressContentFor(contentSchema): a valid-but-worst-case content object
  (headline/subheadline/callToAction set to fixed long strings; every
   block/message label+text set to long strings; message/block arrays filled to
   the schema's max count).

CONTENT_ROLES = Set('headline','subheadline','message','message-label','cta',
                    'label','body','quote','stat','eyebrow')  // text that must stay in-bounds and not overlap

auditTemplate(id): array of violations for that template across both orientations.
auditAll(): array of ALL violations across the 64 templates.

Each violation: { id, orientation, kind: 'overflow'|'overlap', role, detail }.

Geometry: for each canvas object whose layerRole ∈ CONTENT_ROLES and whose text
is a non-empty string, bbox = { x: o.x??o.left, y: o.y??o.top, w: o.w??o.width,
h: estTextHeight(text, fontSize, w, lineHeight) }.
- overflow: bbox extends past [0,0,W,H] by > 2px on any side.
- overlap: two content bboxes intersect by > 20% of the smaller box area.
```

Tolerances (2px bounds, 20% overlap) are the contract — baked into the module so
the test and any fixer measure identically.

### 2. Regression test — new `tests/unit/template-overflow.test.js`

Asserts `auditAll()` returns an empty array. Fails now (lists the 18 offenders);
passes once all are fixed. A per-template loop so the failure message names each
offender.

### 3. Fix the 18 offenders — `templates/v2/<id>.js`

Per offender, apply the discipline WITHOUT dropping or truncating content:
- Replace fixed block `y` positions / bare `fitFontSize` with `fitTextBlock`
  (returns the actual wrapped height) and advance the cursor by that height + a
  consistent gap.
- Enforce a shared safe-area: content stays within a margin of the canvas edges.
- For fixed-slot layouts that collide when many/long messages arrive
  (`holiday-scams`, `threat-radar`, `guard-your-data`, `data-privacy-panels`,
  `trust-but-verify`): make the slot count/positioning derive from the actual
  content (reflow), or scale the block set to fit the region — never overlap.
- Keep readability: font sizes stay ≥ the template's existing `minSize` floor;
  all messages/blocks remain rendered.
- The template's own sample content must still render well (no visual regression
  on the common case) — the sample-content path is unchanged behaviour.

### 4. Error handling

- Any template that throws under stress content is a violation (BUILD-ERR) and
  must be fixed to render.
- The audit never mutates a template; it only measures built canvases.

### 5. Testing

- `template-overflow.test.js`: `auditAll()` empty (the acceptance gate).
- The existing v2 suite (manifest validation, gallery count = 64, per-template
  content-v2 tests) must stay green — this step fixes layout math only; it does
  NOT remove templates (count stays 64) or change the manifest contract.
- Full `npm test` green.

## Out of scope

- Dedup of look-alike templates (SP-B step 2 — the preview-gallery pass).
- No-default-background + keyword→background recommendation (moved to SP-A).
- New patterns (mesh/barbed-wire), scene removal, background quality (SP-A).

## Files touched

- `templates/v2/overflow_audit.js` — new shared stress-audit (stressContentFor + auditAll).
- `tests/unit/template-overflow.test.js` — new regression test.
- `templates/v2/<id>.js` — the 18 offenders' layout math (no manifest/count change).
