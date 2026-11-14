# CompanyAI Agent — Project Memory & Context

## 1. Project Identity
- **Name**: CompanyAI Agent
- **Type**: Recruitment Intelligence & Applicant Tracking Platform
- **Stack**: React 18 + Vite 5 + Tailwind 3 | FastAPI + SQLAlchemy + SQLite
- **AI**: OpenRouter (chat) + NVIDIA Nemotron 3-embed-1b:free (2048-dim embeddings)
- **Status**: Phase 1 & 2 implemented, UI-gated; Phase 3 planned

## 2. Key Architectural Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| SQLite for development | Zero-config, portable, sufficient for <10k vectors | 2024 |
| Nemotron 2048-dim embeddings | Free tier, good quality, fixed dimension | 2024 |
| Human-in-the-loop governance | Recruitment requires accountability; regulatory compliance | 2024 |
| Advisory-only intelligence | Prevents automation bias; keeps recruiters in control | 2024 |
| Feature gate for Phase 1/2 | Allows backend completion before UI polish | 2024 |
| Zero-migration for Phases 1/2 | Protects stable ATS core; additive only | 2024 |
| Provenance on every fact | Audit trail; enables trust/debugging; regulatory | 2024 |
| localStorage for theme/density | No backend dependency; instant persistence | 2024 |

## 3. Database Schema Memory

### 3.1 Core Tables (ATS)
```sql
candidate           -- Core profile (name, email, phone, location, availability)
resume              -- Versions (file_path, parsed_text, candidate_id, version)
resume_embedding    -- 2048-dim BLOB per resume (candidate_id, resume_id, vector)
job                 -- Requisition (title, description, status, client_id)
job_embedding       -- 2048-dim BLOB per job (job_id, vector)
jd_segmentation     -- AI-extracted reqs (job_id, is_approved, review_notes)
job_requirement     -- Individual requirements (segmentation_id, skill, level, type)
recruitment_request -- Client request (client_id, job_id, priority, sla_date)
candidate_stage_history -- Stage transitions (candidate_id, from_stage, to_stage, at)
approval_request    -- Governance (type, payload, status, requester, approver)
agent_trace         -- AI observability (trace_id, prompt, tools, latency, tokens)
placement           -- Placement record (candidate_id, job_id, fee, date, recruiter_id)
```

### 3.2 Intelligence Tables (Phase 1/2)
```sql
skill_taxonomy      -- Canonical skills (name, category, description)
skill_alias         -- Mappings (canonical_id, alias, relationship_type)
candidate_skill     -- Candidate skills (candidate_id, skill_id, provenance_json)
candidate_relationship -- Graph edges (source_id, target_id, edge_type, strength)
```

### 3.3 Key Columns to Remember
- `provenance_json` (TEXT, JSON): `{source_type, confidence, extraction_method, model_version, timestamp, advisory_only}`
- `is_approved` (INTEGER): JD segmentation gate (0=pending, 1=approved)
- `relationship_type`: `referral`, `co_worker`, `project`, `alumni`, `former_colleague`
- `edge_type` in candidate_relationship: same as relationship_type
- `information_type` in intelligence responses: `verified_fact`, `extracted_fact`, `calculated_metric`, `semantic_similarity`, `heuristic_inference`

## 4. API Endpoint Memory

### 4.1 Core ATS
```
GET    /api/candidates              -- List with filters
POST   /api/candidates              -- Create
GET    /api/candidates/{id}         -- Detail + resumes
PATCH  /api/candidates/{id}         -- Update
POST   /api/candidates/{id}/resumes -- Upload resume
PATCH  /api/candidates/{id}/stage   -- Stage transition

GET    /api/jobs                    -- List
POST   /api/jobs                    -- Create
GET    /api/jobs/{id}               -- Detail + segmentation
PATCH  /api/jobs/{id}               -- Update
POST   /api/jobs/{id}/segment       -- Trigger JD segmentation
POST   /api/jobs/{id}/approve-segmentation -- Approve JD reqs

GET    /api/requests                -- Recruitment requests
POST   /api/requests                -- Create

GET    /api/search?q=...            -- Unified search
```

### 4.2 Matching & AI
```
POST   /api/jobs/{id}/match              -- Match candidates to job
GET    /api/matching/matrix?job_id=...   -- Matching matrix
POST   /api/ai/chat                      -- AI Assistant chat
GET    /api/ai/traces                    -- Agent traces
```

### 4.3 Intelligence (Phase 1/2) — All under `/api/intelligence/`
```
# Phase 1
GET    /skills                          -- Skill taxonomy
GET    /skills/{id}/related             -- Alias/related
GET    /candidates/{id}/twin            -- Digital twin
GET    /candidates/{id}/evolution       -- Resume evolution
GET    /candidates/{id}/potential       -- Potential & mobility
GET    /graph/nodes                     -- Graph nodes
GET    /graph/edges                     -- Graph edges

# Phase 2
GET    /market/distribution             -- Skill distributions
GET    /market/cooccurrence             -- Skill pairs
GET    /supply-demand/heatmap           -- Supply vs demand
GET    /supply-demand/jobs/{id}         -- Job drill-down
GET    /sourcing/strategies             -- Advisory strategies
GET    /sourcing/alternatives           -- Adjacent-skill candidates
GET    /hiring-difficulty/{job_id}      -- Difficulty score
```

### 4.4 Approvals
```
GET    /api/approvals                   -- Queue
POST   /api/approvals                   -- Create request
PATCH  /api/approvals/{id}              -- Decide (approve/reject)
```

## 5. Frontend Page Memory

### 5.1 Core Workspace Pages (Always Visible)
| Page | Route | Purpose |
|------|-------|---------|
| DashboardPage | `/workspace/dashboard` | KPIs, pipeline funnel, recent activity, AI insights |
| CandidatesPage | `/workspace/candidates` | Candidate list, filters, bulk actions |
| JobsPage | `/workspace/jobs` | Job list, create, segmentation |
| RequestsPage | `/workspace/requests` | Client requests |
| ClientsPage | `/workspace/clients` | Client management |
| InterviewsPage | `/workspace/interviews` | Schedule, evaluations |
| PipelineKanbanPage | `/workspace/pipeline` | Drag-drop Kanban |
| PlacementsPage | `/workspace/placements` | Placement records, revenue |
| AIAssistantPage | `/workspace/ai-assistant` | Chat with context |
| MatchingMatrixPage | `/workspace/matching` | Candidate↔Job matrix |
| SemanticMatchingDetailPage | `/workspace/matching/detail` | Deep dive match evidence |
| TalentPoolPage | `/workspace/talent-pool` | Semantic search pool |
| AnalyticsPage | `/workspace/analytics` | Dashboard metrics |
| ApprovalsPage | `/workspace/approvals` | Governance queue |
| AgentActivityPage | `/workspace/agent-activity` | AI trace viewer |
| NotificationsPage | `/workspace/notifications` | In-app notifications |
| SettingsPage | `/workspace/settings` | Theme, density, profile |

### 5.2 Intelligence Pages (Gated by `ENABLE_TALENT_INTELLIGENCE`)
| Page | Route | Phase |
|------|-------|-------|
| IntelligenceGraphPage | `/workspace/intelligence/graph` | 1 |
| MarketIntelligencePage | `/workspace/intelligence/market` | 2 |
| SupplyDemandPage | `/workspace/intelligence/supply-demand` | 2 |
| StrategicSourcingPage | `/workspace/intelligence/sourcing` | 2 |
| HiringDifficultyPage | `/workspace/intelligence/hiring-difficulty` | 2 |

### 5.3 Key Components
- `Sidebar.jsx` — Navigation, feature gate checks
- `Topbar.jsx` — Theme toggle, density toggle, user menu
- `PageHeader.jsx` — Consistent page titles + actions
- `MetricCard.jsx` — KPI display with mono font
- `PipelineFunnel.jsx` — Stage conversion visualization
- `AIInsightsPanel.jsx` — AI-generated insights
- `ApprovalBanner.jsx` — Pending approval indicator

## 6. AI System Memory

### 6.1 Agent Orchestrator Flow
```
1. Receive ChatQuerySchema { query, context: {job_id?, candidate_id?, request_id?} }
2. Inject workspace context into system prompt
3. Tool resolution via registry (search_candidates, match_candidate_to_job, etc.)
4. Execute tools sequentially/parallel with SQLite + vector services
5. Synthesize answer with citations
6. Persist AgentTrace { trace_id, prompt, model, tools_called, latency_ms, tokens }
7. Return { answer, trace_id, tools_called, latency_ms }
```

### 6.2 Registered Tools
| Tool | Input | Output |
|------|-------|--------|
| `search_candidates` | query, filters, limit | CandidateSummary[] |
| `search_jobs` | query, filters, limit | JobSummary[] |
| `match_candidate_to_job` | candidate_id, job_id | MatchEvidence |
| `get_candidate_twin` | candidate_id | TwinProfile |
| `get_candidate_evolution` | candidate_id | EvolutionTimeline |
| `get_candidate_potential` | candidate_id | PotentialAssessment |
| `get_market_intelligence` | skill?, location? | MarketReport |
| `get_supply_demand` | skill?, threshold? | SupplyDemandHeatmap |
| `get_sourcing_strategies` | job_id? | SourcingStrategy[] |
| `get_hiring_difficulty` | job_id | DifficultyAssessment |

### 6.3 Trace Schema (`agent_trace` table)
```json
{
  "trace_id": "uuid",
  "prompt": "user query",
  "model_name": "gpt-4o|claude-3.5-sonnet|...",
  "tools_called": ["search_candidates", "match_candidate_to_job"],
  "latency_ms": 1234,
  "tokens_input": 500,
  "tokens_output": 200,
  "context": {"job_id": 123, "candidate_id": 456},
  "created_at": "ISO8601"
}
```

## 7. Matching Engine Memory

### 7.1 Scoring Formula (Deterministic + Semantic)
```
final_score = 0.4 * semantic_similarity + 0.6 * deterministic_score

deterministic_score = 
  0.35 * skill_overlap_jaccard +
  0.25 * experience_match +
  0.20 * location_match +
  0.10 * availability_match +
  0.10 * salary_expectation_match

semantic_similarity = cosine(resume_embedding, job_embedding)  // 2048-dim Nemotron
```

### 7.2 Evidence Breakdown (Per Candidate)
```json
{
  "candidate_id": 123,
  "final_score": 0.82,
  "semantic_score": 0.78,
  "deterministic_score": 0.85,
  "evidence": {
    "skills": {"matched": ["Python", "React"], "missing": ["Kubernetes"], "overlap": 0.67},
    "experience": {"required_years": 5, "candidate_years": 6, "match": 1.0},
    "location": {"job": "Remote", "candidate": "Remote", "match": 1.0},
    "availability": {"job": "Immediate", "candidate": "2_weeks", "match": 0.8},
    "salary": {"job_max": 150000, "candidate_expect": 140000, "match": 1.0}
  }
}
```

## 8. Feature Gate Memory

### 8.1 `ENABLE_TALENT_INTELLIGENCE`
- **Location**: `frontend/src/App.jsx` (line ~15) + `frontend/src/components/layout/Sidebar.jsx`
- **Current Value**: `false`
- **Effect**: Hides Phase 1/2 navigation items and routes
- **Backend**: All endpoints remain active and callable
- **Toggle**: Change to `true` + restart frontend to enable

### 8.2 Density Setting
- **Key**: `localStorage['companyai-density']`
- **Values**: `'comfortable'` (default) | `'compact'`
- **CSS**: `data-density` attribute on `<html>` element
- **Variables**: `--space-scale: 1.0` | `0.75`

### 8.3 Theme Setting
- **Key**: `localStorage['companyai-theme']`
- **Values**: `'light'` | `'dark'` | `'system'`
- **CSS**: `data-theme` attribute on `<html>` element

## 9. Known Issues & Technical Debt

| Issue | Impact | Workaround | Fix Plan |
|-------|--------|------------|----------|
| SQLite write contention | Limits concurrent writes | WAL mode; low traffic | PostgreSQL migration (Phase 4) |
| No auth implemented | Dev only | Local network only | JWT + RBAC (Sprint 8) |
| Embedding rebuild is manual | Schema/model changes | Run script | Admin UI + background job |
| No rate limiting | Abuse risk | Internal only | Redis + middleware (Sprint 8) |
| Frontend bundle ~600KB | Load time | Code splitting | Optimize deps, lazy load more |
| Agent traces grow unbounded | Disk space | Manual cleanup | Retention policy + archive |

## 10. Important File Paths

```
# Backend
app/main.py                    → FastAPI app factory
app/routers/                   → 9 domain routers
app/services/                  → 13+ service modules
app/agent/orchestrator.py      → AI orchestration
app/ai/config.py               → Model config (SINGLE SOURCE OF TRUTH)
database/models.py             → SQLAlchemy models
database/sqlite_migrations.py  → Migration runner
database/connection.py         → Engine + session

# Frontend
frontend/src/App.jsx           → Entry, routing, gates, providers
frontend/src/main.jsx          → React root
frontend/src/index.css         → Tailwind + CSS variables
frontend/tailwind.config.js    → Design tokens
frontend/vite.config.js        → Build + proxy

# Data
data/companyai.db              → SQLite database
data/job_descriptions/         → JD source files
```

## 11. Commands Memory

### 11.1 Development
```bash
# Backend
cd C:\Users\Krishna Chaitanya\Desktop\CompanyAI-Agent
python -m uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm run dev          # Vite dev server (port 5173)

# Database
python -m database.sqlite_migrations  # Run migrations
python scripts/ingest_resumes.py      # Ingest resumes
python scripts/generate_all_job_embeddings.py  # Rebuild embeddings
```

### 11.2 Testing
```bash
# Backend
pytest                    # All tests
pytest tests/test_matching_engine.py -v  # Specific
pytest -k "not slow"      # Skip slow

# Frontend
cd frontend
npm run test              # Vitest
npm run test:ui           # UI mode
```

### 11.3 Linting & Typecheck
```bash
# Backend
ruff check .              # Lint
ruff check . --fix        # Auto-fix
pyright                   # Typecheck

# Frontend
cd frontend
npm run lint              # ESLint
npm run typecheck         # tsc --noEmit
```

## 12. Stakeholder Context
- **Primary Users**: Internal recruitment team (5-10 recruiters)
- **Decision Makers**: Talent Acquisition Lead, CTO
- **Compliance**: GDPR (EU candidates), EEOC (US hiring)
- **Integration Targets**: Greenhouse (ATS), LinkedIn (sourcing), Slack (notifications)

## 13. Glossary
| Term | Definition |
|------|------------|
| **Digital Twin** | Unified 360° candidate profile aggregating all sources with provenance |
| **JD Segmentation** | AI extraction of structured requirements from job description |
| **Skill Taxonomy** | Canonical skill dictionary with alias/related mappings |
| **Provenance** | Source metadata for every fact: origin, confidence, method, timestamp |
| **Advisory Only** | Intelligence output that recommends but never auto-executes |
| **Supply vs Demand** | Internal candidate availability vs open job requirements per skill |
| **Hiring Difficulty** | 0-100 heuristic score predicting time/effort to fill a role |
| **Matching Matrix** | Side-by-side candidate comparison with evidence breakdown |
| **Agent Trace** | Full observability record of AI execution (prompt, tools, latency) |

## 14. Recent Changes (Last 30 Days)
- Completed Phase 2 Market & Sourcing Intelligence services + pages
- Implemented display density system (Comfortable/Compact)
- Standardized typography scale (Plus Jakarta Sans / Inter / JetBrains Mono)
- Added feature gate for Talent Intelligence
- Updated Roadmap.md, Architecture.md, Agent.md
- Fixed JD segmentation approval flow
- Enhanced AgentActivityPage with trace detail view

## 15. Next Milestone Targets
| Milestone | Target | Key Deliverables |
|-----------|--------|------------------|
| Sprint 6 (Phase 3) | Q1 2025 | Stage history, interview evals, placements, velocity analytics |
| Sprint 7 (Phase 4) | Q2 2025 | External connectors, ML calibration, multi-tenant |
| Sprint 8 (Hardening) | Q3 2025 | Auth, security, performance, observability, 80% coverage |

---

*This memory file captures project context as of 2026-11-14. Update when significant decisions change.*