# CompanyAI Agent — Product Requirements Document (PRD)

## 1. Product Vision
CompanyAI Agent is a **Recruitment Intelligence & Applicant Tracking Platform** that combines traditional ATS capabilities with AI-powered talent intelligence to help recruitment teams source, evaluate, and place candidates more effectively. The platform provides actionable insights through canonical skill taxonomies, candidate digital twins, market intelligence, and predictive hiring analytics — all governed by human-in-the-loop approval workflows.

## 2. Target Users
| Persona | Primary Goals | Key Workflows |
|---------|---------------|---------------|
| **Recruiter** | Source, screen, and advance candidates efficiently | Resume ingestion, candidate search, matching matrix, pipeline management |
| **Hiring Manager** | Review qualified candidates, approve/reject decisions | Approval queue, candidate detail, interview scheduling |
| **Talent Acquisition Lead** | Strategic workforce planning, market intelligence | Talent supply/demand, hiring difficulty, strategic sourcing |
| **Recruitment Operations** | Data integrity, governance, analytics | Audit trails, provenance tracking, agent activity monitoring |

## 3. Core Product Areas

### 3.1 Applicant Tracking System (ATS) — Foundation
- **Candidate Management**: CRUD, resume versions, stage progression, notes, tags
- **Job Requisition Management**: Create, edit, archive jobs; JD segmentation & extraction
- **Pipeline & Kanban**: Visual stage boards, drag-drop, bulk actions
- **Client & Request Management**: Client profiles, recruitment requests, SLA tracking
- **Interview Management**: Scheduling, evaluations, feedback collection
- **Placements & Revenue**: Placement records, fee tracking, recruiter attribution

### 3.2 AI-Powered Matching & Search
- **Semantic Matching**: 2048-dim Nemotron embeddings for candidate↔job similarity
- **Deterministic Matching**: Skill overlap, experience years, location, availability
- **Unified Search**: Cross-entity search (candidates, jobs, clients, requests, resumes)
- **Matching Matrix**: Side-by-side candidate comparison with evidence trails

### 3.3 Phase 1 — Core Talent Intelligence (Implemented, UI-Gated)
| Feature | Description | Key Endpoints |
|---------|-------------|---------------|
| **Skill Taxonomy** | Canonical skills, categories, alias/related mapping | `/api/intelligence/skills/*` |
| **Candidate Digital Twin** | 360° unified profile with source provenance | `/api/intelligence/candidates/{id}/twin` |
| **Resume Evolution** | Chronological skill/role trajectory across versions | `/api/intelligence/candidates/{id}/evolution` |
| **Candidate Potential** | Transferable skills, adjacent role fits, mobility paths | `/api/intelligence/candidates/{id}/potential` |
| **Relationship Graph** | Candidate↔candidate, candidate↔job, referral networks | `/api/intelligence/graph/*` |

### 3.4 Phase 2 — Market & Sourcing Intelligence (Implemented, UI-Gated)
| Feature | Description | Key Endpoints |
|---------|-------------|---------------|
| **Internal Talent Market** | Skill distributions, experience bands, locations, availability | `/api/intelligence/market/*` |
| **Supply & Demand** | Candidate supply vs open job demand with shortage thresholds | `/api/intelligence/supply-demand/*` |
| **Strategic Sourcing** | Advisory sourcing strategies, adjacent-skill alternatives | `/api/intelligence/sourcing/*` |
| **Hiring Difficulty** | 0–100 evidence-based heuristic (not ML) per job | `/api/intelligence/hiring-difficulty/*` |

### 3.5 AI Assistant & Governance
- **Conversational AI**: Grounded chat with workspace context (`job_id`, `candidate_id`, `request_id`)
- **Tool Calling**: Structured tool dispatch against SQLite + semantic services
- **Trace Observability**: Full execution traces persisted for audit (`AgentActivityPage`)
- **Approval Workflows**: Human gate for sensitive actions (shortlist, offer, reject, JD approval)
- **Advisory-Only Intelligence**: All Phase 1/2 recommendations carry `advisory_only: true`

## 4. Functional Requirements

### FR-ATS: Applicant Tracking
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-ATS-01 | Create/read/update/delete candidates with resume versioning | P0 |
| FR-ATS-02 | Manage job requisitions with JD segmentation (pending→approved) | P0 |
| FR-ATS-03 | Visual pipeline Kanban with drag-drop stage transitions | P0 |
| FR-ATS-04 | Client management with recruitment request tracking | P1 |
| FR-ATS-05 | Interview scheduling with evaluation forms | P1 |
| FR-ATS-06 | Placement recording with revenue/fee attribution | P1 |

### FR-MATCH: Matching & Search
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-MATCH-01 | Semantic similarity via 2048-dim Nemotron embeddings | P0 |
| FR-MATCH-02 | Deterministic skill/experience/location matching | P0 |
| FR-MATCH-03 | Unified search across all entities with filters | P0 |
| FR-MATCH-04 | Matching matrix with evidence breakdown per candidate | P1 |

### FR-TI: Talent Intelligence (Phase 1)
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-TI-01 | Canonical skill taxonomy with alias/related relationships | P0 |
| FR-TI-02 | Digital twin aggregating resume + JD + manual + inferred sources | P0 |
| FR-TI-03 | Resume evolution tracking skill gain/loss without assuming omission=loss | P1 |
| FR-TI-04 | Transferable skill paths and adjacent role recommendations | P1 |
| FR-TI-05 | Relationship graph with referral/co-worker/project edges | P1 |

### FR-MI: Market Intelligence (Phase 2)
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-MI-01 | Internal skill distribution, experience, location, availability | P0 |
| FR-MI-02 | Supply vs demand heatmap with configurable shortage thresholds | P0 |
| FR-MI-03 | Advisory sourcing strategies per role/skill | P1 |
| FR-MI-04 | Hiring difficulty 0–100 heuristic with evidence factors | P1 |

### FR-AI: AI Assistant & Governance
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AI-01 | Chat endpoint with workspace context injection | P0 |
| FR-AI-02 | Tool dispatch: search, match, summarize, analyze | P0 |
| FR-AI-03 | Full trace persistence (prompt, tools, latency, tokens) | P0 |
| FR-AI-04 | Approval queue for sensitive recruitment actions | P0 |
| FR-AI-05 | Advisory-only flag on all intelligence recommendations | P0 |

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | API p95 < 500ms for CRUD; semantic search < 2s; embeddings async |
| **Scalability** | SQLite supports current scale; designed for PostgreSQL migration |
| **Security** | JWT auth (planned), role-based access, audit logging on all mutations |
| **Observability** | Structured logs, agent traces, API latency metrics |
| **Data Integrity** | Provenance on every skill/fact; soft deletes; migration audit trail |
| **Accessibility** | WCAG 2.1 AA; keyboard navigation; screen reader support |
| **Browser Support** | Chrome, Firefox, Safari, Edge (last 2 versions) |

## 6. Feature Gates & Release Strategy
- **`ENABLE_TALENT_INTELLIGENCE = false`** (App.jsx): Hides Phase 1/2 UI while keeping code/endpoints intact
- **Gradual Rollout**: Enable per-tenant or per-role via feature flag service (future)
- **Backward Compatibility**: All intelligence endpoints remain callable regardless of UI gate

## 7. Success Metrics
| Metric | Target |
|--------|--------|
| Time-to-shortlist (semantic vs manual) | ≤ 50% reduction |
| Matching accuracy (recruiter acceptance) | ≥ 80% |
| AI assistant adoption (weekly active recruiters) | ≥ 60% |
| Approval workflow compliance | 100% for gated actions |
| Data provenance coverage | 100% of skills/facts tagged |

## 8. Out of Scope (Current Phases)
- External job board integrations (LinkedIn, Indeed, etc.)
- Video interviewing / recording
- Automated scheduling (Calendly-style)
- Payroll / onboarding integration
- ML-based predictive models (Phase 4)
- Multi-tenant SaaS architecture (single-tenant deployment)

## 9. Dependencies & Risks
| Dependency | Risk | Mitigation |
|------------|------|------------|
| OpenRouter API availability | AI chat degraded | Fallback to local model; graceful degradation |
| Nemotron embedding model stability | Vector dimension mismatch | Pin model version; migration script ready |
| SQLite concurrency limits | Write contention at scale | Designed for PostgreSQL migration; WAL mode |
| Feature gate confusion | Stakeholders expect visible Phase 1/2 | Clear documentation; admin toggle visibility |