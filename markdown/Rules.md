# CompanyAI Agent — Project Rules & Guidelines

## 1. Development Principles

### 1.1 Core Values
- **Provenance First**: Every skill, fact, and recommendation must carry source metadata
- **Human-in-the-Loop**: AI never autonomously mutates recruitment state; all sensitive actions require approval
- **Advisory-Only Intelligence**: Phase 1 & 2 outputs are decision support, not automated decisions
- **Zero-Migration Discipline**: Phases 1 & 2 add tables only; no schema changes to core ATS tables
- **Traceability**: All AI executions persisted with full context for audit and debugging

### 1.2 Non-Negotiables
- [ ] No hardcoded secrets (API keys, DB passwords) — use `.env` + secret manager
- [ ] No direct SQL string interpolation — use SQLAlchemy ORM / parameterized queries
- [ ] No silent failures — all errors logged with correlation ID
- [ ] No untyped public APIs — Pydantic schemas for all request/response
- [ ] No unprovenanced data — every `candidate_skill` row requires `source_type`
- [ ] No bypassing approval gates — `is_approved` checks enforced at service layer

---

## 2. Backend Rules (Python/FastAPI)

### 2.1 Code Organization
```
app/
  routers/        → Thin: validation, auth, delegation to services
  services/       → Business logic, pure functions, testable
  models/         → SQLAlchemy models only
  schemas/        → Pydantic request/response (separate from models)
  agent/          → Orchestrator + tool registry
  ai/             → Providers, config, exceptions
```

### 2.2 Service Layer Patterns
```python
# GOOD: Pure function, explicit deps, single responsibility
async def calculate_match_score(
    candidate_id: int,
    job_id: int,
    embedding_svc: CandidateEmbeddingService,
    matching_svc: MatchingEngineService,
) -> MatchEvidence:
    ...

# BAD: Hidden deps, side effects, mixed concerns
async def match_and_notify(candidate_id, job_id):
    db = get_db()  # Hidden dependency
    score = calculate(...)
    send_email(...)  # Side effect
    return score
```

### 2.3 Database Rules
- **Migrations**: All schema changes via `database/sqlite_migrations.py` (versioned, idempotent)
- **Indexes**: Add for all FKs, filter columns, sort columns
- **Soft Deletes**: Use `deleted_at` timestamp; never hard delete
- **Provenance Columns**: Every fact table includes `source_type`, `confidence`, `extraction_method`, `model_version`
- **Vector Storage**: BLOB (float32 array); never pickle; dimension validated at write

### 2.4 AI/Embedding Rules
- **Model Pinning**: `nvidia/nemotron-3-embed-1b:free` version pinned in `app/ai/config.py`
- **Dimension Check**: Assert 2048 dimensions on every embed write
- **Batch Processing**: Use `asyncio.gather` with semaphore for embedding rebuilds
- **Fallback**: Graceful degradation if OpenRouter unavailable (return cached/empty)
- **Tool Registry**: All tools registered in `AgentOrchestrator.tool_registry` with JSON schemas

### 2.5 API Conventions
| Aspect | Rule |
|--------|------|
| Path | `/api/{domain}/{resource}` (plural, kebab-case) |
| Version | Implicit v1; breaking → `/api/v2/` |
| Pagination | `?page=1&page_size=20` (max 100) |
| Filtering | `?filter[field][op]=value` |
| Sorting | `?sort=-created_at,+name` |
| Errors | `{ "error": { "code", "message", "details" } }` |
| Success | `{ "data": ..., "meta": { "page", "total" } }` |

---

## 3. Frontend Rules (React/TypeScript)

### 3.1 Component Structure
```
components/
  {domain}/       → Feature-specific (JobDetail, CandidateFilter)
  common/         → Shared primitives (Button, Input, Modal, Card)
  layout/         → Page chrome (Sidebar, Topbar, PageWrapper)
  reactbits/      → Animation-only components
```

### 3.2 State Management
- **Server State**: React Query (TanStack Query) — cache, invalidate, optimistic updates
- **Client UI State**: React Context (theme, density, feature flags, user)
- **Form State**: React Hook Form + Zod validation
- **URL State**: `?tab=` for intra-page tabs; `useSearchParams` for filters

### 3.3 Lazy Loading & Code Splitting
- **Pages**: All workspace pages lazy-loaded in `App.jsx`
- **Heavy Components**: `React.lazy` for charts, editors, large modals
- **Suspense**: Global boundary in `App.jsx` + per-page fallbacks

### 3.4 Theming & Density
- **CSS Variables**: All colors/spacing via `--color-*`, `--space-*` in `index.css`
- **Theme Toggle**: `localStorage['companyai-theme']` synced via `useTheme` hook
- **Density Toggle**: `localStorage['companyai-density']` → `data-density` on `<html>`
- **No Hardcoded Values**: Use Tailwind utilities mapping to CSS variables

### 3.5 Typography Rules
| Element | Font Variable | Size Variable |
|---------|---------------|---------------|
| Page Title | `--font-heading` | `--text-3xl` to `--text-4xl` |
| Section Heading | `--font-heading` | `--text-xl` to `--text-2xl` |
| KPI Value | `--font-mono` | `--text-4xl` to `--text-5xl` |
| Body | `--font-body` | `--text-base` |
| Caption | `--font-body` | `--text-xs` to `--text-sm` |
| Code | `--font-mono` | `--text-sm` |

### 3.6 Accessibility
- Semantic HTML (`<nav>`, `<main>`, `<section>`, `<button>`)
- ARIA labels on icon-only buttons
- Focus visible outlines (never remove)
- Color contrast ≥ 4.5:1 (AA)
- Keyboard navigation for all interactive elements
- Screen reader announcements for dynamic content (toasts, loading)

---

## 4. AI & Intelligence Rules

### 4.1 Provenance Requirements
Every skill/fact/recommendation MUST include:
```json
{
  "source_type": "resume_extracted|jd_extracted|manual_entry|inferred|semantic",
  "confidence": 0.0-1.0,
  "extraction_method": "nemotron|llm|rule|human",
  "model_version": "nemotron-3-embed-1b:free|gpt-4o|...",
  "timestamp": "ISO8601",
  "advisory_only": true
}
```

### 4.2 Advisory-Only Enforcement
- **Backend**: All intelligence service methods return `advisory_only: true`
- **Frontend**: Visual badge "Advisory Only" on all intelligence panels
- **API**: `information_type` field distinguishes `verified_fact`, `extracted_fact`, `calculated_metric`, `semantic_similarity`, `heuristic_inference`

### 4.3 Guardrails
- [ ] Never fabricate candidate experience, skills, or outcomes
- [ ] Never auto-modify candidate scores or job requirements
- [ ] Distinguish: verified DB fact ↔ extracted resume fact ↔ calculated metric ↔ semantic similarity ↔ heuristic inference
- [ ] Preserve 2048-dim Nemotron embeddings + deterministic matching formulas
- [ ] All AI traces persisted with `tools_called`, `latency_ms`, `model_name`

### 4.4 Approval Gates
| Action | Gate | Service |
|--------|------|---------|
| Shortlist candidate | `ApprovalRequest` | `approvals.py` |
| Propose offer | `ApprovalRequest` | `approvals.py` |
| Reject candidate | `ApprovalRequest` | `approvals.py` |
| JD segmentation | `JDSegmentation.is_approved` | `jd_segmentation_service.py` |
| Bulk stage change | `ApprovalRequest` | `approvals.py` |

---

## 5. Git & Workflow Rules

### 5.1 Branch Strategy
- `main` — Protected, deployable, squash-merge only
- `feature/*` — Short-lived, one feature per branch
- `fix/*` — Bug fixes
- `chore/*` — Maintenance, deps, config

### 5.2 Commit Messages
```
<type>(<scope>): <subject>

<body>

<footer>
```
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`
Scope: `api`, `ui`, `matching`, `intelligence`, `agent`, `db`, `devops`

### 5.3 PR Requirements
- [ ] Description links to task/issue
- [ ] Self-review completed
- [ ] Lint + typecheck passing
- [ ] Tests added/updated
- [ ] No console.log / print statements
- [ ] Documentation updated if API changed

### 5.4 CI Gates (Required)
- `ruff check` (backend lint)
- `pyright` (backend typecheck)
- `eslint` (frontend lint)
- `tsc --noEmit` (frontend typecheck)
- `pytest` (backend tests)
- `vitest` (frontend tests)

---

## 6. Testing Rules

### 6.1 Test Organization
```
tests/
  test_<module>.py          → Unit tests (pure functions)
  test_<router>.py          → Integration tests (FastAPI TestClient)
  test_<service>.py         → Service tests (mocked deps)
  test_api_v2.py            → Contract tests
conftest.py                 → Fixtures (db, client, auth)
```

### 6.2 Coverage Targets
- Services: ≥ 80% line coverage
- Routers: ≥ 70% (happy path + error cases)
- Matching engine: 100% on scoring formulas
- AI tools: Contract tests for input/output schemas

### 6.3 Test Data
- Fixtures in `conftest.py` (factories, not static JSON)
- No production data in tests
- Deterministic seeds for embedding-dependent tests

---

## 7. Documentation Rules

### 7.1 Required Updates
| Change | Update |
|--------|--------|
| New API endpoint | `API_Reference.md` |
| Schema change | `Database.md` + `API_Reference.md` |
| New service | `Architecture.md` + `Backend_Design_System.md` |
| New UI component | `Frontend_Design_System.md` |
| New AI tool | `Agent.md` |
| Feature gate change | `Roadmap.md` + `PRD.md` |

### 7.2 Markdown Standards
- Headings: ATX style (`#`, `##`, `###`)
- Tables: GitHub-flavored with headers
- Code blocks: Language specified (`python`, `json`, `jsx`)
- Links: Relative paths for repo files
- Diagrams: Mermaid for architecture/flow

---

## 8. Dependency Management

### 8.1 Python
- `requirements.txt` pinned (==) for production
- `requirements-dev.txt` for dev tools
- `pip-audit` in CI for vulnerabilities
- No `sys.path` hacks; proper package structure

### 8.2 Node
- `package-lock.json` committed
- `npm audit` in CI
- Peer dependencies respected
- No `legacy-peer-deps` unless documented exception

---

## 9. Environment & Configuration

### 9.1 Required Env Vars (`.env`)
```bash
# Database
DATABASE_URL=sqlite:///data/companyai.db

# AI
OPENROUTER_API_KEY=sk-...
NEMOTRON_MODEL=nvidia/nemotron-3-embed-1b:free
EMBEDDING_DIM=2048

# Frontend
VITE_API_BASE_URL=http://localhost:8000

# Feature Gates
ENABLE_TALENT_INTELLIGENCE=false
```

### 9.2 Config Files
- `app/ai/config.py` — AI model settings (single source of truth)
- `frontend/vite.config.js` — Build config, proxy
- `frontend/tailwind.config.js` — Design tokens (colors, fonts, spacing)
- `pytest.ini` — Test config

---

## 10. Release & Deployment

### 10.1 Versioning
- Semantic versioning: `MAJOR.MINOR.PATCH`
- `main` branch = latest release candidate
- Tags: `v1.2.3` for releases

### 10.2 Deployment Checklist
- [ ] All CI gates passing
- [ ] Database migrations tested on staging
- [ ] Feature flags configured for target environment
- [ ] Secrets rotated / verified
- [ ] Rollback plan documented
- [ ] Smoke tests pass post-deploy

---

## 11. Exception Process
If a rule must be violated:
1. Document the exception in PR description
2. Get approval from tech lead
3. Add `TODO: <rule> exception - <reason> - <expiry>` comment in code
4. Create follow-up task to remediate
5. Review at next retrospective