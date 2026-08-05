# Investor-Ready 10x Plan — Feature Audit & Roadmap

Date: 2026-08-06 · Status: proposed (audit complete; waves await approval)

## Part 1 — Feature audit (what exists today, verified)

**Suite: 994/994 green. 102 templates. 324 cited legal provisions. One-click end-to-end.**

| Area | State | Evidence |
|---|---|---|
| Autopilot | One click → research → angle → 95-gate content → 3-candidate design shoot-out → parallel images. Never dead-ends (best-effort floors, degradation events). | `pipelines/auto_pipeline.js`, 9 tests |
| Knowledge / RAG | 4-level retrieval (statute → guidance → news → org) with RRF fusion; 324 provisions across GDPR, DPDP, CCPA, HIPAA, PCI-DSS, ISO 27001, NIST CSF, CERT-In; posters cite law ("GDPR Art. 32"); org framework picker. | `rag/knowledge_*`, 12 tests |
| Templates | 102 dual-orientation, manifest-validated, stress-audited (zero overflow/overlap), all with background contract; M1 modern family (14, 2026 design language incl. the org's own poster idiom) leads the gallery; skeleton dedup enforced. | `templates/v2/`, registry audits |
| Creative direction | Model picks palette (12 curated) + font pair (8) + template + visual mode from constrained libraries; brand-locked orgs respected. | `agents/creative_director.js` |
| Quality gates | Deterministic poster linter (WCAG contrast auto-fix, font floors, overflow/overlap) on EVERY compiled design + in-editor live overlay; content/design/image reviewer loops; zero-text image gate. | `agents/poster_linter.js` |
| Images | Rich concept briefs (subject/composition/lighting/avoid, anti-cliché), aspect-aware generation prompts v4, weighted library scoring with generate-below-threshold; samples dress in real images (bg slot kept clean by design). | `agents/image_*`, 146 tests |
| Editor | Undo/redo, layers panel, smart snapping+guides, group/lock/z-order, rich text, palette swatches + live WCAG readout, live lint + one-click fix, image slot replace/regenerate, dual-orientation, autosave. | `ui/js/editor_*` |
| Export | Editable-native PPTX (real text, charSpacing tracking, freeform polygons), HTML, JPEG; `lib/export` planners for multi-slide decks + print bleed/crop marks + PNG/PDF geometry. | `ui/js/export.js`, `lib/export/`, 32 tests |
| Translation | 9 languages, fidelity back-check, per-language canvas variants, terminology learning. | existing |
| Observability | Every agent/stage/gate/rework on a live SSE rail; run history; masked egress log; checkpoint/rollback. | event bus + harness |
| Privacy | Loopback-only, request-scoped API keys, org-data masking on every outbound call, learning-table fence. | masking layer |

**Known gaps (honest):** 5 templates still layout-loose (compliance-certificate, security-pledge, micro-learning, privacy-rights, executive-briefing — fix pass was interrupted); `capsule_info` template unbuilt; `lib/export` not wired to the export button (browser path uses export.js); DPDP Rules 2025 entries are draft-status; text fitting uses width heuristics (est-height undershoot caused 3 audit bugs); no auth/multi-user (single-user local by design).

## Part 2 — The 10x plan

### Wave 1 — Demo-critical (investor presentation)
1. **Campaign mode** (the demo centerpiece): one prompt → a themed 6-poster campaign — one creative direction, six templates, shared palette/motifs, one PPTX deck + proof sheet. Autopilot already does 1; looping N with a shared brief is 2-3 days.
2. **Finish the tidy pass**: the 5 remaining loose templates to ≤25% max dead band; build `capsule_info`.
3. **Golden proof sheet**: script that renders all 102 templates (both orientations) via `dev_render` + Playwright into a single contact-sheet PDF — the "look at our range" artifact, and a standing visual regression baseline.
4. **Demo kit**: seeded showcase library (10 polished posters across topics/languages), scripted 5-minute flow (Auto-Create live → editor tweak → cited provisions → PPTX open in PowerPoint), one-command demo reset.
5. **Compliance pack export**: per-poster PDF appendix — cited provisions, obligations, review scores, approval trail. No competitor has audit-defensible posters.

### Wave 2 — Precision 10x (the "more precise" ask)
6. **Real glyph metrics**: replace `estTextWidth/Height` heuristics with measured font metrics (opentype.js or canvas-measure harvested tables per curated face). Kills the entire undershoot bug class; enables tight tracking/optical alignment. Biggest single precision lever.
7. **Vision design reviewer**: render candidate designs to PNG (dev_render pipeline exists) → multimodal model critiques the actual pixels (balance, crowding, hierarchy) → feeds the shoot-out judge. Geometry lint catches errors; vision catches ugliness.
8. **CI visual regression**: proof-sheet renders diffed per PR; any template pixel-shift flagged.
9. **Brand kit ingestion**: upload logo + brand PDF → auto-extract palette/fonts/logo; logo slot in every template; per-org font loading.
10. **Image consistency**: per-poster style seed + palette-locked generation variants sized per slot aspect; background-removal for cutout collages.

### Wave 3 — Superiority moat
11. **Corpus expansion + currency**: finalize DPDP Rules on notification; add NIS2, DORA, SOC 2, SEBI CSCRF; quarterly corpus refresh pipeline; enforcement-action feed (L1) auto-ingested.
12. **Effectiveness loop**: per-poster QR → anonymous scan/quiz landing → engagement metrics feed the learning table → recommender favors what actually changes behavior. Posters that prove ROI = the enterprise sell.
13. **Multi-user/deploy**: auth, org workspaces, Docker/K8s, SSO — from local tool to platform.
14. **API + integrations**: REST/webhook API, Slack/Teams delivery, digital-signage scheduling, LMS (SCORM) export.

### Sequencing
Wave 1 ≈ 1 week of focused work; Wave 2 ≈ 2-3 weeks; Wave 3 is the post-raise roadmap slide. Every wave lands behind the existing gates: full suite green, stress audits clean, visual proofs eyeballed.
