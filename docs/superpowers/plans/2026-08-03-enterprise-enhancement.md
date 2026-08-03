# Poster App — Enterprise-Grade Enhancement Plan
## Target: World-class privacy/security poster generation platform

### Phase 1: RAG Knowledge Base Expansion
**Goal:** Make the poster app an expert on DPDP Act + Phishing for better content

1. **DPDP Act Knowledge Base** (`rag/knowledge/dpdp-act.js`)
   - Full DPDP Act 2023 expertise: key provisions, employee obligations, data fiduciary duties, consent framework, penalties
   - 50+ curated seed articles about DPDP Act compliance for employee awareness
   - Topic-specific keyword weights: "dpdp", "digital personal data", "data fiduciary", "consent manager", "data principal"
   - Synthesis prompts tuned for Indian regulatory context
   
2. **Phishing Deep Expertise** (`rag/knowledge/phishing-expert.js`)
   - 100+ curated seed articles: spear phishing, whaling, smishing, vishing, QR code phishing, deepfake phishing
   - Attack vector taxonomy, red flags taxonomy, response playbooks
   - Corporate-specific phishing scenarios: CEO fraud, invoice fraud, HR phishing, IT support impersonation

3. **Enhanced Feed List** — Add 10+ new feeds:
   - Indian CERT-In DPDP-specific feeds
   - MeitY (Ministry of Electronics & IT) updates
   - Anti-phishing working group (APWG) feed
   - Proofpoint threat insight feed
   - KnowBe4 phishing alert feed

### Phase 2: Corporate Enterprise Templates (15-30 New)
**Goal:** Less similar-looking, more diverse, professional enterprise-grade

All new templates must:
- Render perfectly with seamless text padding (no overflow/overlap)
- Support both portrait (1414x2000) and landscape (2000x1414)
- Pass manifest_schema validation
- Use formal corporate color palettes
- Have unique visual identities (no clones)

**New Template Families:**

**A. Executive/Board Templates (6)**
- `executive-briefing` (timeline): C-suite security briefing one-pager with timeline
- `board-deck-slide` (infographic): Presentation-deck style with big stat + 3 bullets
- `risk-heatmap` (tabular): Risk assessment matrix with color-coded cells
- `compliance-certificate` (statement): Formal compliance attestation layout
- `audit-trail` (timeline): Audit event chronology with severity badges
- `governance-framework` (tree): Three-pillar governance model visualization

**B. Training & Awareness (6)**
- `training-module` (sequence): Step-by-step training module with checkpoints
- `quiz-card` (qa): Interactive quiz layout with show/hide answers
- `role-play-scenario` (scenario): Choose-your-own-adventure security scenario
- `micro-learning` (bullet): Bite-sized learning cards for Slack/Teams
- `gamification-leaderboard` (stats): Security champion leaderboard
- `annual-refresher` (infographic): Yearly mandatory training summary

**C. Incident Response (4)**
- `incident-timeline` (timeline): Breach timeline with severity color coding
- `war-room-brief` (infographic): Incident war room status dashboard
- `lessons-learned` (panels): Post-incident review with root cause + remediation
- `crisis-communication` (statement): Executive crisis communication template

**D. Policy & Compliance (4)**
- `policy-one-pager` (infographic): Single-page policy summary with key points
- `acceptable-use-poster` (bullets): AUP highlights with icons
- `data-classification` (tabular): Data classification levels matrix
- `regulatory-landscape` (tree): GDPR/DPDP/CCPA comparison framework

**E. Metrics & Dashboards (4)**
- `security-kpi-dashboard` (stats): Monthly security metrics with trend arrows
- `phishing-simulation-stats` (stats): Phishing drill results with comparison
- `awareness-maturity` (infographic): Program maturity level indicator
- `risk-reduction-timeline` (timeline): YoY risk reduction progress

**F. Campaign & Culture (6)**
- `security-ambassador` (statement): Employee spotlight / security champion profile
- `monthly-theme` (infographic): Monthly security theme announcement
- `quick-reference-card` (tabular): One-glance security do's and don'ts
- `security-pledge` (statement): Employee security pledge certificate
- `wall-of-shame-fame` (panels): Anonymous near-miss vs good-catch showcase
- `zero-trust-journey` (timeline): Zero-trust adoption roadmap

### Phase 3: Fix Backgrounds Page
**Goal:** Professional corporate backgrounds, working UI

1. Fix `backgrounds.html` + `backgrounds_page.js`:
   - Proper loading states, error handling
   - Corporate background categories: gradient, geometric, subtle-pattern, brand-mesh
   - Preview before generating
   - Bulk generate option
   - Background application to posters directly

2. Add corporate background generation:
   - Professional gradient presets (navy-to-teal, slate-to-charcoal, etc.)
   - Geometric pattern backgrounds (hex grids, dot matrices, subtle lines)
   - Brand-mesh backgrounds (from org brand colors)
   - Zero-text enforcement

### Phase 4: Multi-DB Architecture with Git Seeds
**Goal:** Databases included in repo with pre-generated content

1. **Poster Store DB** (`data/posters.db`):
   - SQLite database with pre-generated poster records
   - 20-50 seed posters with metadata
   - Included in git (no .gitignore)
   - Auto-synced on clone

2. **Image Library DB** (`data/image-library.db`):
   - SQLite database with pre-generated image metadata
   - Seed with 20-30 corporate background images
   - PNG files in image-library/assets/ (gitignored but DB tracks them)
   - Auto-generate on first launch if assets missing

3. **Knowledge DB** (`data/knowledge.db`):
   - Pre-populated DPDP Act + Phishing knowledge base
   - 200+ seed articles with FTS5 indexing
   - Keyword weights pre-tuned

4. **Export/Import System**:
   - `POST /api/export/all` — export all DBs + assets as a zip
   - `POST /api/import/all` — import from zip
   - `POST /api/seed/reset` — reset to factory seeds

### Phase 5: Graph Engineering & Multi-Agent Orchestration
**Goal:** Production-grade graph-based pipeline with parallel agents

1. **Enhanced StateGraph** (`lib/orchestration/state_graph.js`):
   - Add `addSubgraph()` for composable nested graphs
   - Parallel branch execution with dependency resolution
   - Retry with exponential backoff per node
   - Graph visualization export (DOT/Mermaid)
   - Performance metrics per node

2. **New Agents**:
   - `compliance-reviewer`: Validates content against DPDP/GDPR compliance
   - `brand-consistency-checker`: Ensures brand guideline adherence
   - `accessibility-auditor`: Checks WCAG contrast ratios, readable fonts
   - `multi-language-qa`: Cross-language consistency validation
   - `phishing-realness-checker`: Validates phishing examples are realistic
   - `cultural-sensitivity-reviewer`: Flags culturally inappropriate content
   - `template-optimizer`: Learning-based template parameter tuning

3. **Orchestration Pipeline** (`pipelines/orchestration_pipeline.js`):
   - Full graph-based poster generation pipeline
   - Parallel content + design + image generation
   - Fan-out/join for multi-variant generation
   - Human-in-the-loop override at any node

### Phase 6: Self-Learning & AI Template Selection
**Goal:** System gets better with every poster created

1. **Enhanced Self-Learning** (`agents/edit_learning.js`):
   - Track which templates perform best per topic
   - Learn from user edits (which text blocks get changed most)
   - A/B test different template-content combinations
   - Weight adjustment based on rejection/approval patterns
   - Template-to-topic affinity scoring

2. **Smarter AI Template Selection** (`agents/template_recommender.js`):
   - Topic embedding comparison (cosine similarity)
   - Content-shape detection: stats, narrative, comparison, Q&A, policy
   - Historical success rate per template-topic pair
   - Corporate context awareness (formal vs casual, internal vs public)
   - Multi-factor scoring: shape match (40%) + historical (30%) + visual impact (20%) + freshness (10%)

### Phase 7: Integration & Polish
- All new templates pass overflow/overlap tests
- Background page renders cleanly
- Seed databases load on first launch
- Git-friendly: all DB files committed, assets regeneratable
- Tests for all new functionality
- Documentation updates</think>