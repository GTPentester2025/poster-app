# SP-B step 1 — Template Overflow/Overlap Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No content text overflows the canvas or overlaps a sibling on any of the 64 v2 templates, even with long real-world content.

**Architecture:** A shared pure stress-audit (`templates/v2/overflow_audit.js`) renders every template × orientation with worst-case content and flags out-of-bounds / overlapping content blocks. A regression test asserts it's empty. The 18 flagged templates are corrected to the `fitTextBlock` + advance-by-real-height discipline (never dropping content) until the audit passes.

**Tech Stack:** Node.js ESM, `node --test`, the v2 template renderer (`buildCanvas`).

## Global Constraints

- ESM only. Do NOT remove templates or change the manifest contract — the gallery count stays 64 (an existing test asserts `templates.length === 64`).
- Never drop, truncate, or omit content to pass the audit — fix layout math (reflow/scale/advance), keep every message/block rendered, keep font sizes ≥ each template's existing `minSize` floor.
- The template's own sample-content render must not visually regress (only worst-case behaviour changes).
- Audit contract (identical for the test and every fixer): content roles = `headline, subheadline, message, message-label, cta, label, body, quote, stat, eyebrow`; a content block is a canvas object with one of those `layerRole`s and a non-empty `text`; its bbox height = `estTextHeight(text, fontSize, w, lineHeight)`; **overflow** = bbox past `[0,0,W,H]` by >2px; **overlap** = two content bboxes intersect by >20% of the smaller box area.
- Test command: `npm test`. Suite green today (815). Between Task 1 and the final fix batch the new `template-overflow.test.js` is EXPECTED RED — that is the TDD gate; every OTHER test stays green throughout.

---

### Task 1: Stress-audit module + failing regression test

**Files:**
- Create: `templates/v2/overflow_audit.js`
- Test: `tests/unit/template-overflow.test.js`

**Interfaces:**
- Produces: `stressContentFor(contentSchema): object`, `auditTemplate(id): Violation[]`, `auditAll(): Violation[]` where `Violation = { id, orientation, kind:'overflow'|'overlap'|'build-error', role, detail }`.

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/template-overflow.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listTemplatesV2 } from '../../templates/v2/index.js';
import { auditTemplate, auditAll } from '../../templates/v2/overflow_audit.js';

// One assertion per template so the failure names each offender.
for (const t of listTemplatesV2()) {
  test(`v2 template "${t.id}" has no overflow/overlap under stress content`, () => {
    const v = auditTemplate(t.id);
    assert.equal(v.length, 0, v.map((x) => `${x.orientation} ${x.kind} ${x.role} ${x.detail}`).join(' | '));
  });
}

test('auditAll aggregates cleanly (zero total violations)', () => {
  assert.equal(auditAll().length, 0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/unit/template-overflow.test.js`
Expected: FAIL — cannot find `overflow_audit.js`; then (after Step 3) ~18 template subtests fail listing violations.

- [ ] **Step 3: Write the audit module**

```js
// templates/v2/overflow_audit.js
// Stress-audit: render every v2 template with worst-case content and flag any
// content text block that runs off the canvas (overflow) or collides with a
// sibling (overlap). Pure — never mutates a template; measures built canvases.
// The tolerances here are the CONTRACT shared by the regression test and any
// layout fix.

import { listTemplatesV2, buildCanvas } from './index.js';
import { sampleContentFor } from './manifest_schema.js';
import { estTextHeight } from '../helpers.js';

const CONTENT_ROLES = new Set([
  'headline', 'subheadline', 'message', 'message-label', 'cta',
  'label', 'body', 'quote', 'stat', 'eyebrow'
]);

const LONG_BODY = 'Verify unexpected requests through a second trusted channel before you act on them because attackers exploit urgency and authority to bypass your caution and rush you into a mistake';
const LONG_HEAD = 'Protect Every Account With Strong Unique Passphrases Today';
const LONG_SUB = 'Small habits stop most attacks — slow down, check the sender, and confirm before you click';
const LONG_CTA = 'Report anything suspicious to the Security Operations Center immediately';
const LONG_LABEL = 'Never Reuse Credentials Across Sites';

/**
 * Worst-case-but-valid content for a template's contentSchema: real fields
 * present, every text field set to a long string, and block/message arrays
 * filled to the schema's max count so fixed-slot layouts are stressed.
 */
export function stressContentFor(contentSchema) {
  const base = sampleContentFor(contentSchema);
  const c = structuredClone(base);
  if (typeof c.headline === 'string') c.headline = LONG_HEAD;
  if (typeof c.subheadline === 'string') c.subheadline = LONG_SUB;
  if (typeof c.callToAction === 'string') c.callToAction = LONG_CTA;
  const cs = contentSchema || {};
  const stressArr = (arr, schema) => {
    if (!Array.isArray(arr)) return arr;
    const max = Number.isInteger(schema?.max) ? schema.max : arr.length;
    const out = [];
    for (let i = 0; i < Math.max(arr.length, max); i++) {
      const src = arr[i % arr.length] || arr[0] || {};
      const item = structuredClone(src);
      if ('label' in item && item.label != null) item.label = LONG_LABEL;
      if ('text' in item && item.text != null) item.text = LONG_BODY;
      out.push(item);
    }
    return out;
  };
  if (Array.isArray(c.blocks)) c.blocks = stressArr(c.blocks, cs.blocks);
  if (Array.isArray(c.messages)) c.messages = stressArr(c.messages, cs.messages);
  return c;
}

function contentBoxes(canvas) {
  const boxes = [];
  for (const o of canvas.objects || []) {
    if (!CONTENT_ROLES.has(o.layerRole || '')) continue;
    if (typeof o.text !== 'string' || !o.text) continue;
    const w = o.w ?? o.width ?? 0;
    const fontSize = o.fontSize ?? 0;
    const h = estTextHeight(o.text, fontSize, w, o.lineHeight || 1.16);
    boxes.push({ x: o.x ?? o.left ?? 0, y: o.y ?? o.top ?? 0, w, h, role: o.layerRole, key: o.msgId || o.id || o.layerRole });
  }
  return boxes;
}

function overlapArea(a, b) {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
}

/** Violations for one template across both orientations. */
export function auditTemplate(id) {
  const t = listTemplatesV2().find((x) => x.id === id);
  if (!t) return [{ id, orientation: '-', kind: 'build-error', role: '-', detail: 'unknown template' }];
  const content = stressContentFor(t.contentSchema);
  const out = [];
  for (const orientation of ['portrait', 'landscape']) {
    let canvas;
    try { canvas = buildCanvas(id, orientation, content); }
    catch (e) { out.push({ id, orientation, kind: 'build-error', role: '-', detail: String(e.message).slice(0, 80) }); continue; }
    const { width: W, height: H } = canvas;
    const boxes = contentBoxes(canvas);
    for (const b of boxes) {
      if (b.x < -2 || b.y < -2 || b.x + b.w > W + 2 || b.y + b.h > H + 2) {
        out.push({ id, orientation, kind: 'overflow', role: b.role, detail: `bottom=${Math.round(b.y + b.h)}/${H} right=${Math.round(b.x + b.w)}/${W}` });
      }
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const area = overlapArea(boxes[i], boxes[j]);
        const minA = Math.min(boxes[i].w * boxes[i].h, boxes[j].w * boxes[j].h) || 1;
        if (area > 0.2 * minA) {
          out.push({ id, orientation, kind: 'overlap', role: `${boxes[i].role}~${boxes[j].role}`, detail: `${Math.round(100 * area / minA)}%` });
        }
      }
    }
  }
  return out;
}

/** All violations across the gallery. */
export function auditAll() {
  return listTemplatesV2().flatMap((t) => auditTemplate(t.id));
}
```

- [ ] **Step 4: Run to confirm it now fails with the offender list**

Run: `node --test tests/unit/template-overflow.test.js 2>&1 | grep -E "not ok|# fail" | head`
Expected: ~18 template subtests fail, each naming its overflow/overlap detail. Note the offender ids for the fix batches.

Then confirm the rest of the suite is unaffected:
Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: only `template-overflow.test.js` subtests fail; every other test passes.

- [ ] **Step 5: Commit**

```bash
git add templates/v2/overflow_audit.js tests/unit/template-overflow.test.js
git commit -m "test: add stress overflow/overlap audit for v2 templates (RED: 18 offenders)"
```

---

### Task 2: Fix batch A (6 worst offenders)

**Files:**
- Modify: `templates/v2/trust_but_verify.js`, `data_privacy_panels.js`, `comic_saga.js`, `orbit_path.js`, `holiday_scams.js`, `guard_your_data.js`

**Interfaces:**
- Consumes: `auditTemplate(id)` from Task 1 (the acceptance gate).
- Produces: `auditTemplate` returns `[]` for each of the six ids.

- [ ] **Step 1: Establish the current violations (baseline)**

Run:
```
node --input-type=module -e "import {auditTemplate} from './templates/v2/overflow_audit.js'; for (const id of ['trust-but-verify','data-privacy-panels','comic-saga','orbit-path','holiday-scams','guard-your-data']) console.log(id, JSON.stringify(auditTemplate(id)));"
```
Expected: each prints a non-empty violation array. These are the targets.

- [ ] **Step 2: Fix each template's layout math**

For each file, read the `build.portrait` / `build.landscape` functions and apply, per the offending block:
- Replace fixed block `y` positions / standalone `fitFontSize(...)` followed by a hardcoded row-height with `fitTextBlock(text, { width, height: budget, maxSize, minSize })` and advance the running `y`/cursor by the returned `height` + the template's existing gap.
- Ensure the region for a repeated block set is divided by the ACTUAL content count (reflow), and that the last block's bottom stays within the canvas safe-area (leave the template's existing bottom margin).
- For overlap between fixed slots (`holiday-scams`, `guard-your-data`, `data-privacy-panels`, `trust-but-verify`): position each slot from the cumulative height of the ones above it, not a fixed step, OR scale the slot heights so the set fits its region.
- Keep every message/block rendered; keep font sizes within the existing `maxSize`/`minSize` bounds; do not alter the sample-content visual result beyond what the fit math naturally produces.

- [ ] **Step 3: Verify the batch passes the audit**

Run:
```
node --input-type=module -e "import {auditTemplate} from './templates/v2/overflow_audit.js'; let bad=0; for (const id of ['trust-but-verify','data-privacy-panels','comic-saga','orbit-path','holiday-scams','guard-your-data']){const v=auditTemplate(id); if(v.length){bad++; console.log(id, JSON.stringify(v));}} console.log(bad? ('STILL FAILING: '+bad):'BATCH A CLEAN');"
```
Expected: `BATCH A CLEAN`.

- [ ] **Step 4: Confirm no regression elsewhere**

Run: `node --test tests/unit/template-overflow.test.js 2>&1 | grep -cE "not ok"` (offender count should drop by 6 vs Task 1), then `npm test 2>&1 | grep -E "^# (pass|fail)"` (only remaining overflow offenders fail; nothing new breaks; the existing v2/content-v2 tests stay green).

- [ ] **Step 5: Commit**

```bash
git add templates/v2/trust_but_verify.js templates/v2/data_privacy_panels.js templates/v2/comic_saga.js templates/v2/orbit_path.js templates/v2/holiday_scams.js templates/v2/guard_your_data.js
git commit -m "fix(templates): batch A — stop overflow/overlap on 6 worst offenders"
```

---

### Task 3: Fix batch B (6 offenders)

**Files:**
- Modify: `templates/v2/future_is_now.js`, `update_stay_safe.js`, `incident_photo_hero.js`, `access_control_policy.js`, `access_control_policy_zh.js`, `cyber_month_agenda.js`

**Interfaces:**
- Consumes: `auditTemplate(id)`. Produces: `[]` for each of the six ids.

- [ ] **Step 1: Baseline** — same command as Task 2 Step 1 with ids `['future-is-now','update-stay-safe','incident-photo-hero','access-control-policy','access-control-policy-zh','cyber-month-agenda']`. Expect non-empty arrays.

- [ ] **Step 2: Fix each** — apply the SAME discipline as Task 2 Step 2 (fitTextBlock + advance by real height + safe-area + reflow fixed slots; never drop content; keep font floors). `access_control_policy_zh.js` is the Chinese variant — apply the same layout fix; CJK text width differs, so rely on `estTextHeight`/`fitTextBlock` (already width-aware) rather than character counts.

- [ ] **Step 3: Verify batch clean** — same command as Task 2 Step 3 with batch B ids. Expect `BATCH B CLEAN`.

- [ ] **Step 4: No regression** — `node --test tests/unit/template-overflow.test.js 2>&1 | grep -cE "not ok"` dropped by another 6; `npm test` only remaining offenders fail.

- [ ] **Step 5: Commit**

```bash
git add templates/v2/future_is_now.js templates/v2/update_stay_safe.js templates/v2/incident_photo_hero.js templates/v2/access_control_policy.js templates/v2/access_control_policy_zh.js templates/v2/cyber_month_agenda.js
git commit -m "fix(templates): batch B — stop overflow/overlap on 6 offenders"
```

---

### Task 4: Fix batch C (remaining offenders) + full audit green

**Files:**
- Modify: `templates/v2/constellation_before_after.js`, `threat_radar.js`, `glass_stack.js`, `impact_burst.js`, `webinar_invite.js`, `gisp_release_numbered.js`

**Interfaces:**
- Consumes: `auditAll()`. Produces: `auditAll()` returns `[]`; `template-overflow.test.js` fully passes.

- [ ] **Step 1: Baseline** — `['constellation-before-after','threat-radar','glass-stack','impact-burst','webinar-invite','gisp-release-numbered']` via the Task 2 Step 1 command. Expect non-empty.

- [ ] **Step 2: Fix each** — same discipline as Task 2 Step 2.

- [ ] **Step 3: Whole-gallery audit clean**

Run: `node --input-type=module -e "import {auditAll} from './templates/v2/overflow_audit.js'; const v=auditAll(); console.log(v.length? ('STILL FAILING '+v.length+': '+JSON.stringify(v.slice(0,20))):'ALL 64 CLEAN');"`
Expected: `ALL 64 CLEAN`.

- [ ] **Step 4: Full suite green**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: 0 failures — `template-overflow.test.js` (all 64 subtests + aggregate) now passes; the whole suite is green.

- [ ] **Step 5: Commit**

```bash
git add templates/v2/constellation_before_after.js templates/v2/threat_radar.js templates/v2/glass_stack.js templates/v2/impact_burst.js templates/v2/webinar_invite.js templates/v2/gisp_release_numbered.js
git commit -m "fix(templates): batch C — final offenders; full overflow audit green"
```

---

## Self-Review

**Spec coverage:**
- §1 shared audit module (stressContentFor/auditTemplate/auditAll, contract tolerances) → Task 1 ✓
- §2 regression test (auditAll empty, per-template names) → Task 1 ✓
- §3 fix the 18 offenders without dropping content → Tasks 2-4 ✓
- §4 error handling (build-error is a violation; audit never mutates) → Task 1 module ✓
- §5 testing (audit gate + existing suite green + count stays 64) → Tasks 1-4 + Global Constraints ✓

**Placeholder scan:** none — the audit module and test are full code. The fix tasks intentionally specify the *acceptance gate* (audit returns `[]` for the batch) plus the exact discipline and the exact verify commands, because each of the 18 layouts is bespoke and cannot be pre-written line-by-line; the audit is the precise, executable definition of done, and each task shows the baseline+verify commands.

**Type consistency:** `stressContentFor(contentSchema)` uses `t.contentSchema` (confirmed field). `auditTemplate(id)`/`auditAll()` signatures identical across the module (Task 1), the test (Task 1), and every fix task's verify command (Tasks 2-4). Violation shape `{id,orientation,kind,role,detail}` consistent. `estTextHeight` imported from `../helpers.js` (confirmed export).

**Note:** Tasks 2-4 each reduce the offender count by 6; the `template-overflow.test.js` gate stays RED until Task 4 (documented TDD window). Every other test stays green from Task 1 onward.
