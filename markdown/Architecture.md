# CompanyAI Agent — System Architecture (`Architecture.md`)

## 1. High-Level Architecture
CompanyAI Agent is a full-stack Recruitment Intelligence & Applicant Tracking Platform using a decoupled **React 18 + Vite 5 + Tailwind CSS 3** frontend and a **Python + FastAPI + SQLAlchemy** backend backed by **SQLite** (`data/companyai.db`).

```text
┌──────────────────────────────────────────────────────────────────────┐
│                   Frontend (React 18 + Vite 5 + Tailwind 3)          │
│  Sidebar + Topbar + Lazy-Loaded Pages + Global Modals (Search/Detail)│
│  Theme: Light/Dark (localStorage)  |  Density: Comfortable/Compact   │
└───────────────────────────────────┬──────────────────────────────────┘
                                    │ REST / JSON (/api/*)
┌───────────────────────────────────▼──────────────────────────────────┐
│                        FastAPI Application (app/main.py)             │
│  9 Routers: agent, analytics, approvals, candidates, ingestion,      │
│             intelligence, jobs, requests, search                     │
├──────────────────────────────────────────────────────────────────────┤
│                        Service Layer (app/services/*)                │
│  • Matching Engine & JD Segmentation / Extraction                    │
│  • Candidate & JD Embeddings (2048-dim Nemotron)                     │
│  • Phase 1 & 2 Talent Intelligence (Taxonomy, Twin, Market, Supply)  │
├──────────────────────────────────────────────────────────────────────┤
│                    Persistence (SQLAlchemy + SQLite)                 │
│  data/companyai.db (16 tables) + Local Resume / JD File Storage      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Backend Structure (`app/`)
### Routers (`app/routers/`)
- `agent.py` — AI Assistant chat & trace observability (`/api/ai`)
- `analytics.py` — Dashboard metrics, pipeline stats, AI telemetry (`/api/analytics`)
- `approvals.py` — Governance approval queue (`/api/approvals`)
- `candidates.py` — Candidate CRUD, resume versions, stage updates (`/api/candidates`)
- `ingestion.py` — Resume & JD file ingestion status and triggers (`/api/ingestion`)
- `intelligence.py` — Phase 1 & Phase 2 Talent Intelligence endpoints (`/api/intelligence`)
- `jobs.py` — Job requisitions, JD segmentation, and matching (`/api/jobs`)
- `requests.py` — Client recruitment requests (`/api/requests`)
- `search.py` — Unified enterprise search across entities (`/api/search`)

### Services (`app/services/`)
- **Core Matching & Ingestion:** `matching_engine_service.py`, `candidate_embedding_service.py`, `jd_embedding_service.py`, `jd_extraction_service.py`, `jd_segmentation_service.py`
- **Phase 1 Core Talent Intelligence:** `skill_taxonomy_service.py`, `talent_intelligence_service.py`, `resume_evolution_service.py`, `candidate_relationship_service.py`
- **Phase 2 Market & Sourcing Intelligence:** `market_intelligence_service.py`, `talent_supply_demand_service.py`, `strategic_sourcing_service.py`, `hiring_difficulty_service.py`

---

## 3. Frontend Structure (`frontend/src/`)
- **Entry & Routing:** `App.jsx` manages URL `?tab=` state, Light/Dark theme (`companyai-theme`), Display Density (`companyai-density`), and lazy-loaded workspace pages.
- **Feature Gate:** `ENABLE_TALENT_INTELLIGENCE = false` in `App.jsx` and `Sidebar.jsx` currently hides/blocks Phase 1 & Phase 2 Talent Intelligence views from the UI while preserving all source files and backend endpoints.
- **Pages (`frontend/src/pages/`):**
  - Core ATS & Operations: `DashboardPage.jsx`, `CandidatesPage.jsx`, `JobsPage.jsx`, `RequestsPage.jsx`, `ClientsPage.jsx`, `InterviewsPage.jsx`, `PipelineKanbanPage.jsx`, `PlacementsPage.jsx`
  - AI & Matching: `AIAssistantPage.jsx`, `MatchingMatrixPage.jsx`, `SemanticMatchingDetailPage.jsx`, `TalentPoolPage.jsx`
  - Governance & Settings: `AnalyticsPage.jsx`, `ApprovalsPage.jsx`, `AgentActivityPage.jsx`, `NotificationsPage.jsx`, `SettingsPage.jsx`
  - Talent Intelligence (currently gated): `IntelligenceGraphPage.jsx`, `MarketIntelligencePage.jsx`, `SupplyDemandPage.jsx`, `StrategicSourcingPage.jsx`, `HiringDifficultyPage.jsx`
