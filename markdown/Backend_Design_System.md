# CompanyAI Agent — Backend Design System (`Backend_Design_System.md`)

## 1. Technology Stack
- **Python 3.14** + **FastAPI** (`app/main.py`, `version="2.0.0"`)
- **SQLAlchemy 2.x** ORM + **SQLite** (`data/companyai.db` via `database/sqlite_connection.py`)
- **Validation & Serialization:** Pydantic schemas in domain routers and structured dataclasses/dicts in services
- **AI & Embeddings:** OpenRouter + NVIDIA Nemotron (`nvidia/nemotron-3-embed-1b:free`, **2048-dimensional** vectors)

---

## 2. Layered Backend Architecture

### A. Entry Point & Lifespan (`app/main.py`)
- Initializes missing SQLite tables on startup via `@asynccontextmanager lifespan` calling `initialize_database()`.
- Configures `CORSMiddleware` for local Vite frontend origins (`allow_origins=["*"]`, `allow_credentials=False`).
- Mounts 9 modular domain routers plus `app/api_routes.py` (`sqlite_resources_router`) for file downloads and legacy upload endpoints.

### B. Thin Router Layer (`app/routers/`)
Routers handle HTTP request parsing, Pydantic validation, SQLAlchemy `Depends(get_db)` session injection, and HTTP error mapping (`400`/`404`), keeping business logic inside `app/services/`:
- `candidates.py`, `jobs.py`, `requests.py`, `analytics.py`, `search.py`, `approvals.py`, `agent.py`, `ingestion.py`, `intelligence.py`

### C. Reusable Service Layer (`app/services/`)
- **Ingestion & Extraction:** `jd_extraction_service.py`, `jd_segmentation_service.py`
- **Vector Embeddings:** `candidate_embedding_service.py`, `jd_embedding_service.py`
- **Deterministic + Semantic Matching:** `matching_engine_service.py` (`evaluate_candidate_multi_resume`, `CandidateMatchResult`, `MatchScoreWeights`)
- **Phase 1 Core Talent Intelligence:**
  - `skill_taxonomy_service.py` — Canonical normalization, categories, exact vs `alias_equivalent` vs `related_adjacent` distinction
  - `talent_intelligence_service.py` — Candidate Digital Twin & Potential/Mobility
  - `resume_evolution_service.py` — Chronological multi-resume delta analysis
  - `candidate_relationship_service.py` — Candidate network & Recruitment Intelligence Graph
- **Phase 2 Market & Sourcing Intelligence:**
  - `market_intelligence_service.py` — Internal pool distributions, location/experience normalization, unique skill deduplication
  - `talent_supply_demand_service.py` — Unique candidate supply vs open-job demand & configurable shortage thresholds
  - `strategic_sourcing_service.py` — Advisory-only sourcing strategies & adjacent-skill alternatives
  - `hiring_difficulty_service.py` — Transparent 0–100 evidence-based heuristic assessment (not an ML model)

---

## 3. Core Engineering & Data Contracts
- **No Business Logic in Routes:** All scoring, normalization, filtering, and graph construction live in `app/services/*`.
- **Unique Candidate Counting:** Supply and market aggregations deduplicate aliases per `candidate.id` using sets (`Set[int]` / `Set[str]`) so candidates are never double-counted.
- **Provenance & Information Typing:** Intelligence responses tag records with `information_type` (`Verified database fact`, `Extracted resume information`, `Calculated metric`, `Semantic similarity`, `Inferred suitability` / `Heuristic`) and return `Insufficient Data` when required fields are absent.
- **Read-Only Intelligence & Governance Gates:** Phase 1/2 intelligence services never mutate candidate, job, or embedding records; JD segmentation and sensitive recruitment actions route through explicit approval gates.
- **Test Isolation (`tests/conftest.py`):** Pytest uses `isolated_test_database` (a temporary copy of `data/companyai.db`) so tests run against realistic data without modifying production SQLite records.
