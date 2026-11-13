# CompanyAI Agent — API Reference (`API_Reference.md`)

All backend endpoints are served by **FastAPI** (`app/main.py`) under `/api/*`. Interactive OpenAPI docs are available at `/docs` when the backend is running.

---

## 1. AI Agent & Observability (`/api/ai`)
- `POST /api/ai/chat` — Execute `AgentOrchestrator` with optional workspace entity context (`job_id`, `candidate_id`, `request_id`).
- `GET /api/ai/traces` — Retrieve recent `AgentTrace` execution records (prompt, model, latency, tools called).

## 2. Core Recruitment & ATS Routers
- **Candidates (`/api/candidates`):** Candidate listing, profile detail, resume versions, stage & availability updates, interview scheduling.
- **Jobs (`/api/jobs`):** Job requisition CRUD, JD upload/segmentation, requirement approval, candidate matching matrix.
- **Requests (`/api/requests`):** Client recruitment requests management.
- **Approvals (`/api/approvals`):** Human-in-the-loop governance queue (`approve`, `reject`, `request-changes`).
- **Analytics (`/api/analytics`):** Dashboard KPIs, pipeline metrics, embedding coverage, AI telemetry (`/api/analytics/stats`).
- **Ingestion (`/api/ingestion`):** Local resume & JD file discovery, ingestion status, and processing triggers.
- **Search (`/api/search`):** Global `⌘K` search across candidates, jobs, and requests.

## 3. Talent Intelligence Router (`/api/intelligence`)
*(Backend endpoints remain active; UI routes are currently gated via `ENABLE_TALENT_INTELLIGENCE = false`.)*

### Phase 1 — Core Talent Intelligence
- `GET /api/intelligence/skills/normalize?skills=...`
- `GET /api/intelligence/candidates/{candidate_id}/digital-twin`
- `GET /api/intelligence/candidates/{candidate_id}/resume-evolution`
- `GET /api/intelligence/candidates/{candidate_id}/potential-mobility`
- `GET /api/intelligence/candidates/{candidate_id}/network`
- `GET /api/intelligence/graph`

### Phase 2 — Market & Sourcing Intelligence
- `GET /api/intelligence/market/overview`
- `GET /api/intelligence/market/skills`
- `GET /api/intelligence/market/locations`
- `GET /api/intelligence/market/experience`
- `GET /api/intelligence/market/skill-combinations`
- `GET /api/intelligence/supply-demand/overview`
- `GET /api/intelligence/supply-demand/skills`
- `GET /api/intelligence/supply-demand/shortages`
- `GET /api/intelligence/supply-demand/jobs/{job_id}`
- `GET /api/intelligence/sourcing/jobs/{job_id}/recommendations`
- `GET /api/intelligence/sourcing/jobs/{job_id}/alternatives`
- `GET /api/intelligence/sourcing/candidate-opportunities`
- `GET /api/intelligence/hiring-difficulty/overview`
- `GET /api/intelligence/hiring-difficulty/jobs/{job_id}`
