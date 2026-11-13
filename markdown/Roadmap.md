# CompanyAI Agent — Product & Engineering Roadmap (`Roadmap.md`)

## Phase 0 — Architecture & Data-Readiness Audit (Completed)
- Audited active SQLite database (`data/companyai.db`), 16 tables, 2048-dim `nvidia/nemotron-3-embed-1b:free` vectors, and matching engine contracts.
- Established strict provenance rules and zero-migration boundaries for Phases 1 & 2.

---

## Phase 1 — Core Talent Intelligence (Implemented; Currently UI-Gated)
1. **Skill Taxonomy Service** (`skill_taxonomy_service.py`) — Canonicalization, categories, exact vs `alias_equivalent` vs `related_adjacent` distinction.
2. **Candidate Digital Twin** (`talent_intelligence_service.py`) — 360-degree unified candidate profile with source provenance.
3. **Resume Evolution Intelligence** (`resume_evolution_service.py`) — Chronological multi-resume skill/role comparison without assuming omitted skills are lost.
4. **Candidate Potential & Talent Mobility** (`talent_intelligence_service.py`) — Transferable skill paths and open job fits.
5. **Candidate Relationship Network & Recruitment Intelligence Graph** (`candidate_relationship_service.py`, `IntelligenceGraphPage.jsx`).

---

## Phase 2 — Market & Sourcing Intelligence (Implemented; Currently UI-Gated)
1. **Internal Talent Market Intelligence** (`market_intelligence_service.py`, `MarketIntelligencePage.jsx`) — Skill distributions, categories, experience, locations, availability, and skill co-occurrence pairs.
2. **Talent Supply & Demand Intelligence** (`talent_supply_demand_service.py`, `SupplyDemandPage.jsx`) — Unique candidate supply vs open-job demand with configurable shortage thresholds and job drill-down.
3. **Strategic Sourcing Intelligence** (`strategic_sourcing_service.py`, `StrategicSourcingPage.jsx`) — Advisory-only sourcing strategies and adjacent-skill candidate alternatives.
4. **Hiring Difficulty Predictor** (`hiring_difficulty_service.py`, `HiringDifficultyPage.jsx`) — Transparent 0–100 evidence-based heuristic assessment (not an ML model).

---

## UI/UX, Typography & Density Enhancements (Completed & Active)
- **Typography Scale:** Standardized `Plus Jakarta Sans` (headings), `Inter` (body/tables/forms), and `JetBrains Mono` (KPI/numeric data) with `28–32px` page titles, `30–36px` KPI values, `15–16px` table/form/nav text.
- **Display Density Settings:** User-selectable **Comfortable** (default) and **Compact** modes persisted in `localStorage` (`companyai-density`) and applied immediately via `data-density`.
- **Talent Intelligence Gate:** `ENABLE_TALENT_INTELLIGENCE = false` temporarily hides Phase 1 & Phase 2 navigation and tabs while keeping all code intact.

---

## Phase 3 & Phase 4 — Planned Future Capabilities (Not Yet Started)
- **Phase 3 (Pipeline Velocity, Placements & Revenue Analytics):**
  - Database migrations for `candidate_stage_history`, `interview_evaluation`, and `placement` / financial records.
  - Time-to-hire, stage bottleneck detection, client revenue/profitability analytics, and recruiter performance dashboards.
- **Phase 4 (External Market Connectors & ML Calibration):**
  - Optional external labor market & salary benchmark integrations.
  - Calibrated predictive models once sufficient historical placement & evaluation outcomes are recorded.
