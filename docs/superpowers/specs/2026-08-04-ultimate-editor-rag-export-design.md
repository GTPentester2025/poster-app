# Ultimate Poster Maker — Editor, Export & Multi-Level RAG

Date: 2026-08-04
Branch: feat/ultimate-editor-rag-export
Status: approved (user picked: parallel build, editable-native PPTX, all frameworks deep)

## Goal

Make this the most authoritative, most polished security/privacy poster maker in
existence: a pro-grade editor, print-shop-quality editable PowerPoint export, and
a multi-level legal/threat knowledge base (GDPR + DPDP + CCPA/CPRA + HIPAA +
PCI-DSS + ISO 27001 + NIST CSF + CERT-In) that grounds every poster in cited law.

Built in parallel across three fronts; each front ships behind green tests and is
committed independently.

## Front 1 — Editor (pro-grade design surface)

Scope: `ui/editor.html`, its editor JS, the Refine-station embed in
`ui/js/create_page.js`, `backend/routes/editor.js`. Fabric v6, canvas JSON.

- Undo/redo command-history stack (Cmd+Z / Cmd+Shift+Z), per-edit granularity.
- Smart snapping + alignment guides (canvas center/edges, sibling edges, equal
  spacing); align/distribute toolbar; arrow-key nudge.
- Multi-select, group/ungroup, z-order, lock/unlock, duplicate (Cmd+D), delete.
- Layers panel keyed by `layerRole`: visibility, reorder, select.
- Rich text: font-family (curated FONT_PAIRS + Google fonts), size/weight/color/
  align/line-height/letter-spacing — live on selection.
- Live lint overlay: continuous `agents/poster_linter.js` in-editor; badge
  low-contrast/overflow objects; one-click auto-fix.
- Palette-aware color picker (poster palette + brand first); inline contrast.
- Image-slot editing: replace from library, regenerate (image pipeline), cover-
  fit crop/reposition, swap background slot.
- Dual-orientation editing; "mirror edit to other orientation".
- Autosave + version history via `doc.snapshots`; restore prior states.
- Preserve the persisted-canvas contract (layerRole/msgId/fieldRef/bgRef/slotSpec)
  through every edit; saves stay verbatim + shape-validated (edit-learning intact).

## Front 2 — Export (editable-native, multi-format)

Scope: NEW `lib/export/` module (pptx/png/pdf), extracted from the UI bundle and
unit-tested; UI wiring in the export path.

- `lib/export/pptx.js`: canvas JSON → editable PPTX. Every object → native PPTX
  primitive so text stays real PowerPoint text: Textbox→text (charSpacing→
  letterSpacing, weight, align, lineHeight, fill), Rect→rounded rect, Line,
  Circle, Polygon→freeform geometry, images embedded base64, shadow, opacity.
  Exact px→EMU at 96dpi; slide sized to the canvas (1414×2000 / 2000×1414).
- Decor fidelity: gradient washes / meshGlow / scrims → gradient fills or baked
  semi-transparent layers so the deck matches the preview.
- Multi-slide: both orientations + every translation variant as slides in one deck.
- `lib/export/png.js` + `pdf.js`: high-res raster + print-ready PDF; optional
  bleed + crop marks.
- Font pair declared for graceful PowerPoint substitution.
- Pure functions (canvas in, artifact/spec out) so they unit-test without a
  browser; the pptxgen call is the only side effect, isolated + mockable.

## Front 3 — Multi-level RAG + legal corpus

Scope: `rag/` engine + a large structured corpus; `backend/db.js` (new table +
FTS), `scripts/build-seed-db.js`, `backend/routes/rag.js`. Backward-compatible:
`retrieve()` keeps its signature; the levelled path plugs in behind it.

### Retrieval levels
- **L0 Regulatory** — statute corpus, article/section granularity.
- **L1 Guidance/enforcement** — regulator guidance, notable fines.
- **L2 News/threat** — existing feeds (`rag/feeds.js`).
- **L3 Org** — glossary, approved posters, edit-learning.

### Engine
- New `knowledge` table + `knowledge_fts` (FTS5). Levelled retriever routes a
  query to relevant levels by intent, retrieves per level, fuses via reciprocal-
  rank fusion (RRF), dedupes, and returns a **cited** context file.
- Content generator + reviewer cite specific provisions ("GDPR Art. 32",
  "DPDP §8(5)"); posters become audit-defensible.

### Corpus (the bulk — authored deep across ALL frameworks)
Every entry conforms to `rag/knowledge/schema.js` (`KnowledgeEntry`, below).
Content is authoritative PARAPHRASE + obligations + ready poster angles — never a
verbatim statute dump (accurate, useful, and copyright-clean; laws themselves are
not copyrightable but paraphrase is what grounding needs).

Frameworks, deep: GDPR (all 99 articles + key recitals), DPDP Act 2023 (all
sections + draft rules), CCPA/CPRA, HIPAA, PCI-DSS v4, ISO/IEC 27001:2022 Annex A,
NIST CSF 2.0, CERT-In 2022 directions.

### KnowledgeEntry schema (shared contract — `rag/knowledge/schema.js`)
```
{
  id,            // stable slug, e.g. 'gdpr-art-32'
  framework,     // 'GDPR'|'DPDP'|'CCPA'|'HIPAA'|'PCI-DSS'|'ISO-27001'|'NIST-CSF'|'CERT-In'
  citation,      // 'GDPR Art. 32' | 'DPDP §8(5)'
  level,         // 0..3 retrieval level
  region,        // 'EU'|'IN'|'US'|'GLOBAL'
  title,
  summary,       // 1-3 sentence plain-language
  text,          // fuller authoritative paraphrase
  obligations,   // string[] actionable duties
  penalties,     // string|null
  appliesTo,     // string[] e.g. ['data-controllers','all-employees']
  topics,        // string[] keywords (FTS + matching)
  posterAngles   // string[] ready-made awareness angles from this provision
}
```

### knowledge table DDL
```
CREATE TABLE knowledge (
  id TEXT PRIMARY KEY, framework TEXT, citation TEXT, level INTEGER, region TEXT,
  title TEXT, summary TEXT, text TEXT,
  obligations TEXT, penalties TEXT, applies_to TEXT, topics TEXT, poster_angles TEXT,
  seeded INTEGER DEFAULT 1
);
CREATE VIRTUAL TABLE knowledge_fts USING fts5(
  id UNINDEXED, title, summary, text, topics, content='knowledge', content_rowid='rowid'
);
```

## Testing
- Editor: interaction unit tests where possible; canvas round-trip preserves the
  persisted contract; lint overlay uses the real linter.
- Export: canvas→pptx-spec fixtures assert object mapping, EMU conversion, slide
  count for multi-orientation + translations; no browser needed.
- RAG: schema validation of every corpus entry; knowledge table + FTS seeding;
  levelled retrieval + RRF fusion + citation emission; `retrieve()` backward-compat.
- Full `npm test` green at each front's commit.
