# CompanyAI Agent — Design Document

## 1. System Design Overview

### 1.1 Architectural Style
- **Pattern**: Decoupled frontend/backend with REST API
- **Frontend**: SPA (React 18 + Vite 5) with lazy-loaded routes
- **Backend**: FastAPI with router-per-domain, service layer, SQLAlchemy ORM
- **Database**: SQLite (development) → PostgreSQL (production migration path)
- **AI**: OpenRouter-hosted models + local Nemotron embeddings
- **State Management**: React Context + localStorage (theme, density, feature gates)

### 1.2 Technology Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Frontend Framework | React | 18.2+ |
| Build Tool | Vite | 5.x |
| Styling | Tailwind CSS | 3.4+ |
| UI Components | Radix UI + Custom | — |
| State/Context | React Context | — |
| Backend Framework | FastAPI | 0.109+ |
| ORM | SQLAlchemy | 2.0+ |
| Database | SQLite / PostgreSQL | 3.x / 15+ |
| Embeddings | NVIDIA Nemotron | 3-embed-1b:free (2048-dim) |
| AI Gateway | OpenRouter | — |
| Auth (planned) | JWT + RBAC | — |

---

## 2. Backend Design

### 2.1 Router Organization (`app/routers/`)
```
agent.py          → /api/ai           (AI chat, traces)
analytics.py      → /api/analytics    (Dashboard, pipeline, AI telemetry)
approvals.py      → /api/approvals    (Governance approval queue)
candidates.py     → /api/candidates   (Candidate CRUD, resume versions, stages)
ingestion.py      → /api/ingestion    (File ingestion triggers, status)
intelligence.py   → /api/intelligence (Phase 1 & 2 talent intelligence)
jobs.py           → /api/jobs         (Job requisitions, JD segmentation, matching)
requests.py       → /api/requests     (Client recruitment requests)
search.py         → /api/search       (Unified enterprise search)
```

### 2.2 Service Layer (`app/services/`)
**Core Matching & Ingestion**
- `matching_engine_service.py` — Deterministic + semantic scoring, evidence breakdown
- `candidate_embedding_service.py` — Resume → vector, upsert, batch rebuild
- `jd_embedding_service.py` — JD → vector, upsert, batch rebuild
- `jd_extraction_service.py` — PDF/DOCX → structured text
- `jd_segmentation_service.py` — LLM-extracted requirements → `JDSegmentation` (review_pending gate)

**Phase 1 — Core Talent Intelligence**
- `skill_taxonomy_service.py` — Canonical skills, categories, alias/related graph
- `talent_intelligence_service.py` — Digital twin, potential, mobility
- `resume_evolution_service.py` — Chronological skill/role diff across versions
- `candidate_relationship_service.py` — Graph edges (referral, co-work, project, alumni)

**Phase 2 — Market & Sourcing Intelligence**
- `market_intelligence_service.py` — Distributions, co-occurrence, availability
- `talent_supply_demand_service.py` — Supply vs demand heatmap, thresholds
- `strategic_sourcing_service.py` — Advisory strategies, adjacent-skill candidates
- `hiring_difficulty_service.py` — 0–100 heuristic with evidence factors

### 2.3 Data Models (`database/models.py`)
Key entities (16 tables):
| Table | Purpose |
|-------|---------|
| `candidate` | Core candidate profile |
| `resume` | Resume versions with parsed content |
| `resume_embedding` | 2048-dim vectors per resume |
| `job` | Job requisition |
| `job_embedding` | 2048-dim vectors per job |
| `jd_segmentation` | AI-extracted requirements (review_pending gate) |
| `job_requirement` | Individual requirement lines |
| `recruitment_request` | Client hiring requests |
| `candidate_stage_history` | Stage transition audit trail |
| `approval_request` | Governance approval queue |
| `agent_trace` | AI execution observability |
| `skill_taxonomy` | Canonical skills + metadata |
| `skill_alias` | Alias/related mappings |
| `candidate_skill` | Candidate↔skill with provenance |
| `candidate_relationship` | Graph edges between candidates |
| `placement` | Placement & revenue records |

### 2.4 Embedding Pipeline
```
Resume/JD File → Extraction → Segmentation (JD only) → 
  Chunking → Nemotron 2048-dim → Vector Store (SQLite BLOB) → 
  Matching Engine (cosine + deterministic)
```
- **Batch Rebuild**: `/api/ingestion/rebuild-embeddings` for schema/model changes
- **Provenance**: Every vector tagged with `source_type`, `extraction_method`, `model_version`

---

## 3. Frontend Design

### 3.1 Application Structure (`frontend/src/`)
```
App.jsx                    → Entry, routing, theme, density, feature gates
main.jsx                   → React root, providers
index.css                  → Tailwind + CSS variables (theming)
components/
  layout/                  → Sidebar, Topbar, PageWrapper, MetricCard
  common/                  → PageHeader, ExpandableSection, EmptyState, ApprovalBanner
  dashboard/               → PipelineFunnel, AIInsightsPanel, RecentActivity
  jobs/                    → JobDetail, JobForm, MatchingMatrix
  candidates/              → CandidateFilter, CandidateCard, CandidateDetail
  reactbits/               → Animated UI components
pages/                     → One file per route (lazy-loaded)
hooks/                     → useTheme, useDensity, useApi, useDebounce
utils/                     → apiClient, formatters, constants
```

### 3.2 Routing & Lazy Loading (`App.jsx`)
- **Route Pattern**: `/workspace/:page?tab=:tab`
- **Lazy Pages**: `React.lazy(() => import('./pages/XPage.jsx'))`
- **Tab State**: URL-synced via `?tab=` for deep-linking within pages
- **Suspense Boundary**: Global fallback with skeleton loaders

### 3.3 Theming System
| Token | Light | Dark | CSS Variable |
|-------|-------|------|--------------|
| Background | `#FAFAFA` | `#0F1115` | `--color-bg` |
| Surface | `#FFFFFF` | `#1A1D23` | `--color-surface` |
| Primary | `#2563EB` | `#3B82F6` | `--color-primary` |
| Text Primary | `#111827` | `#F3F4F6` | `--color-text` |
| Text Muted | `#6B7280` | `#9CA3AF` | `--color-text-muted` |
| Border | `#E5E7EB` | `#374151` | `--color-border` |

**Persistence**: `localStorage['companyai-theme']` (`light`|`dark`|`system`)

### 3.4 Display Density System
| Mode | Spacing Scale | Table Row Height | Font Size (Body) |
|------|---------------|------------------|------------------|
| Comfortable (default) | 1.0x | 48px | 15px |
| Compact | 0.75x | 36px | 14px |

**Implementation**: `data-density="comfortable|compact"` on `<html>`, CSS variable scaling
**Persistence**: `localStorage['companyai-density']`

### 3.5 Typography Scale
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Page Title | Plus Jakarta Sans | 28–32px | 700 |
| Section Heading | Plus Jakarta Sans | 20–24px | 600 |
| KPI Value | JetBrains Mono | 30–36px | 700 |
| Body / Table / Form | Inter | 15–16px | 400/500 |
| Caption / Metadata | Inter | 12–13px | 400 |
| Code / Technical | JetBrains Mono | 13–14px | 400 |

---

## 4. AI & Intelligence Design

### 4.1 Agent Orchestration (`app/agent/orchestrator.py`)
```
User Query + Context → AgentOrchestrator.execute()
  → Tool Resolution (search, match, analyze, summarize)
  → SQLite + Vector Services
  → Response Synthesis + Trace Build
  → Persist AgentTrace
  → Return {answer, trace_id, tools_called, latency_ms}
```

### 4.2 Tool Registry
| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `search_candidates` | Semantic + filter search | query, filters | Candidate[] |
| `search_jobs` | Job search | query, filters | Job[] |
| `match_candidate_to_job` | Detailed match evidence | candidate_id, job_id | MatchEvidence |
| `get_candidate_twin` | Digital twin | candidate_id | TwinProfile |
| `get_market_intelligence` | Skill distributions | skill?, location? | MarketReport |
| `get_hiring_difficulty` | Difficulty score | job_id | DifficultyAssessment |

### 4.3 Governance & Approval Flow
```
Sensitive Action Requested
  → Create ApprovalRequest (type, payload, requester)
  → Notify Approvers (email/in-app)
  → Approver Reviews → Approve/Reject/Request Changes
  → On Approval: Execute Mutation + Audit Log
  → On Reject: Record Reason + Notify Requester
```
**Gated Actions**: Shortlist, Offer, Reject, JD Segmentation Approval, Bulk Stage Change

### 4.4 Intelligence Provenance Model
Every skill/fact/recommendation carries:
```json
{
  "source_type": "resume_extracted|jd_extracted|manual_entry|inferred|semantic",
  "confidence": 0.0-1.0,
  "extraction_method": "nemotron|llm|rule|human",
  "model_version": "nemotron-3-embed-1b:free|gpt-4o|...",
  "timestamp": "ISO8601",
  "advisory_only": true|false
}
```

---

## 5. API Design Patterns

### 5.1 Request/Response Envelope
```json
// Success
{ "data": { ... }, "meta": { "page": 1, "page_size": 20, "total": 100 } }

// Error
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

### 5.2 Pagination
- Query: `?page=1&page_size=20` (max 100)
- Response: `meta.page`, `meta.page_size`, `meta.total`, `meta.total_pages`

### 5.3 Filtering & Sorting
- Filters: `?filter[field]=value&filter[field][op]=gte`
- Sort: `?sort=-created_at,+name`

### 5.4 Versioning
- URL prefix: `/api/v1/` (current implicit v1)
- Breaking changes → new version prefix

---

## 6. Database Design

### 6.1 SQLite Configuration
- **WAL Mode**: Enabled for concurrent reads
- **Foreign Keys**: Enforced (`PRAGMA foreign_keys=ON`)
- **Indexes**: On all FK columns, search columns, embedding lookup keys

### 6.2 Migration Strategy
- **Current**: `database/sqlite_migrations.py` (versioned, idempotent)
- **Future**: Alembic for PostgreSQL
- **Zero-Migration Rule**: Phases 1&2 added tables only; no schema changes to core tables

### 6.3 Vector Storage
- **Format**: BLOB (2048 × float32 = 8KB per vector)
- **Index**: None (brute-force cosine; dataset < 10k vectors)
- **Future**: pgvector or FAISS for scale

---

## 7. Security Design

### 7.1 Authentication (Planned)
- JWT access tokens (15min) + refresh tokens (7d)
- HttpOnly secure cookies
- Role-based access: `admin`, `recruiter`, `hiring_manager`, `viewer`

### 7.2 Authorization
- Resource-level: `candidate:read`, `candidate:write`, `job:approve`, `approval:decide`
- Row-level: Recruiters see own candidates + shared; admins see all

### 7.3 Data Protection
- PII encryption at rest (planned)
- Resume files: Local storage with access control
- Audit log: All mutations + AI traces immutable

---

## 8. Observability Design

### 8.1 Logging
- Structured JSON logs (stdout)
- Levels: `DEBUG`, `INFO`, `WARN`, `ERROR`
- Correlation ID propagated across requests

### 8.2 Metrics (Prometheus-ready)
| Metric | Type | Labels |
|--------|------|--------|
| `http_requests_total` | Counter | method, path, status |
| `http_request_duration_seconds` | Histogram | method, path |
| `ai_chat_latency_seconds` | Histogram | model, tools_called |
| `embedding_generation_seconds` | Histogram | entity_type |
| `matching_engine_duration_seconds` | Histogram | match_type |

### 8.3 Tracing
- `AgentTrace` table: Full AI execution replay
- Frontend: React DevTools + custom performance marks

---

## 9. Deployment Architecture

### 9.1 Development
```
Frontend: Vite dev server (port 5173) → Proxy /api → Backend
Backend:  Uvicorn (port 8000) → SQLite (data/companyai.db)
```

### 9.2 Production (Target)
```
Load Balancer → Frontend (Nginx + static files)
            → Backend (Gunicorn + Uvicorn workers)
            → PostgreSQL (primary + replica)
            → Redis (cache, sessions, rate limiting)
            → Object Storage (resume/JD files)
            → OpenRouter (AI gateway)
```

### 9.3 CI/CD Pipeline
- Lint: `ruff`, `eslint`, `prettier`
- Typecheck: `pyright`, `tsc`
- Test: `pytest`, `vitest`
- Build: `vite build` → Docker multi-stage
- Deploy: GitHub Actions → Target environment

---

## 10. Extension Points

| Extension Point | Mechanism |
|-----------------|-----------|
| Custom AI Tools | Register in `AgentOrchestrator.tool_registry` |
| New Intelligence Module | Add service + router + feature flag |
| Additional Embedding Model | Implement `EmbeddingProvider` interface |
| Custom Approval Types | Extend `ApprovalRequestType` enum + handler |
| External Integrations | Webhook receiver + normalized ingestion pipeline |