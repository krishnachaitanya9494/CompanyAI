# CompanyAI Agent — Task Breakdown & Sprint Plan

## Sprint 0: Foundation & Audit (Completed)
- [x] Database audit: 16 tables, 2048-dim vectors, matching engine contracts
- [x] Provenance rules established
- [x] Zero-migration boundaries for Phases 1 & 2
- [x] Architecture documentation (`Architecture.md`, `Agent.md`, `Roadmap.md`)

---

## Sprint 1: Core ATS & Matching (Completed)
- [x] Candidate CRUD + resume versioning
- [x] Job requisition CRUD + JD segmentation (review_pending gate)
- [x] Pipeline Kanban with drag-drop
- [x] Client & recruitment request management
- [x] Semantic matching (Nemotron 2048-dim)
- [x] Deterministic matching (skills, experience, location)
- [x] Unified enterprise search
- [x] Matching matrix with evidence breakdown
- [x] Interview scheduling + evaluations
- [x] Placement & revenue tracking

---

## Sprint 2: AI Assistant & Governance (Completed)
- [x] Agent orchestrator with tool dispatch
- [x] Chat endpoint with workspace context injection
- [x] Trace persistence (`agent_trace` table)
- [x] Agent Activity page for trace inspection
- [x] Approval workflow engine (`approvals.py`)
- [x] JD segmentation approval gate
- [x] Advisory-only flag on all intelligence outputs
- [x] Human-in-the-loop governance model

---

## Sprint 3: Phase 1 — Core Talent Intelligence (Implemented, UI-Gated)
- [x] Skill Taxonomy Service (`skill_taxonomy_service.py`)
  - [x] Canonical skill CRUD
  - [x] Categories & hierarchies
  - [x] Alias equivalence (`alias_equivalent`)
  - [x] Related adjacency (`related_adjacent`)
- [x] Candidate Digital Twin (`talent_intelligence_service.py`)
  - [x] 360° profile aggregation
  - [x] Source provenance per skill/fact
  - [x] Resume + JD + manual + inferred sources
- [x] Resume Evolution Intelligence (`resume_evolution_service.py`)
  - [x] Chronological version comparison
  - [x] Skill gain/loss without omission assumption
  - [x] Role trajectory visualization
- [x] Candidate Potential & Mobility (`talent_intelligence_service.py`)
  - [x] Transferable skill paths
  - [x] Adjacent role fit scoring
  - [x] Mobility recommendations
- [x] Candidate Relationship Graph (`candidate_relationship_service.py`)
  - [x] Referral edges
  - [x] Co-worker/project edges
  - [x] Alumni/network edges
  - [x] IntelligenceGraphPage.jsx (gated)

---

## Sprint 4: Phase 2 — Market & Sourcing Intelligence (Implemented, UI-Gated)
- [x] Internal Talent Market Intelligence (`market_intelligence_service.py`)
  - [x] Skill distributions by category
  - [x] Experience band analysis
  - [x] Location heatmaps
  - [x] Availability status distribution
  - [x] Skill co-occurrence pairs
  - [x] MarketIntelligencePage.jsx (gated)
- [x] Talent Supply & Demand (`talent_supply_demand_service.py`)
  - [x] Unique candidate supply per skill
  - [x] Open job demand per skill
  - [x] Configurable shortage thresholds
  - [x] Job drill-down from heatmap
  - [x] SupplyDemandPage.jsx (gated)
- [x] Strategic Sourcing Intelligence (`strategic_sourcing_service.py`)
  - [x] Advisory sourcing strategies per role
  - [x] Adjacent-skill candidate alternatives
  - [x] StrategicSourcingPage.jsx (gated)
- [x] Hiring Difficulty Predictor (`hiring_difficulty_service.py`)
  - [x] 0–100 evidence-based heuristic
  - [x] Transparent factor breakdown
  - [x] HiringDifficultyPage.jsx (gated)

---

## Sprint 5: UI/UX Enhancements (Completed)
- [x] Typography scale: Plus Jakarta Sans / Inter / JetBrains Mono
- [x] Display density: Comfortable (default) / Compact modes
- [x] localStorage persistence for theme + density
- [x] Light/Dark theme with system detection
- [x] Feature gate: `ENABLE_TALENT_INTELLIGENCE = false`
- [x] Sidebar navigation with gated sections
- [x] PageHeader, ExpandableSection, EmptyState, MetricCard components
- [x] ApprovalBanner for governance visibility

---

## Sprint 6: Phase 3 — Pipeline Velocity & Revenue (Planned)
### Database Migrations
- [ ] `candidate_stage_history` table (detailed transition timestamps)
- [ ] `interview_evaluation` table (structured feedback, scores)
- [ ] `placement` table (fee, revenue, recruiter attribution)
- [ ] `client_revenue` aggregate view

### Analytics & Dashboards
- [ ] Time-to-hire by stage/role/recruiter
- [ ] Stage bottleneck detection (conversion rates, dwell time)
- [ ] Client revenue & profitability analytics
- [ ] Recruiter performance dashboard
- [ ] Pipeline velocity trends (weekly/monthly)
- [ ] Forecasting: projected placements vs targets

### API Endpoints
- [ ] `/api/analytics/pipeline-velocity`
- [ ] `/api/analytics/time-to-hire`
- [ ] `/api/analytics/client-profitability`
- [ ] `/api/analytics/recruiter-performance`

### Frontend Pages
- [ ] `PipelineVelocityPage.jsx`
- [ ] `PlacementsPage.jsx` (enhanced)
- [ ] `RecruiterDashboardPage.jsx`

---

## Sprint 7: Phase 4 — External Connectors & ML (Planned)
### External Integrations
- [ ] Labor market API connectors (Lightcast, Burning Glass, etc.)
- [ ] Salary benchmark integration
- [ ] Job board syndication (LinkedIn, Indeed, Glassdoor)
- [ ] ATS import/export (Greenhouse, Lever, Workday)

### ML Calibration
- [ ] Historical placement outcome collection
- [ ] Interview evaluation outcome tracking
- [ ] Calibrated hiring success predictor (ML model)
- [ ] Calibrated salary prediction model
- [ ] Candidate retention risk model
- [ ] Model monitoring & drift detection

### Infrastructure
- [ ] Feature flag service (per-tenant/role)
- [ ] Multi-tenant architecture
- [ ] PostgreSQL migration + pgvector
- [ ] Redis caching layer
- [ ] Background job queue (Celery/RQ)

---

## Sprint 8: Platform Hardening (Ongoing)
### Testing
- [ ] Unit test coverage > 80% (backend)
- [ ] Integration test coverage for all routers
- [ ] E2E tests for critical user flows (Cypress/Playwright)
- [ ] Contract tests for AI tool interfaces

### Security
- [ ] JWT authentication + RBAC implementation
- [ ] PII encryption at rest
- [ ] Rate limiting & abuse prevention
- [ ] Audit log immutability verification
- [ ] Penetration testing

### Performance
- [ ] API p95 < 500ms under load
- [ ] Semantic search < 2s for 10k vectors
- [ ] Frontend bundle size < 500KB gzipped
- [ ] Lighthouse score > 90

### Observability
- [ ] Prometheus metrics endpoint
- [ ] Grafana dashboards
- [ ] Alerting rules (error rate, latency, queue depth)
- [ ] Distributed tracing (OpenTelemetry)

---

## Backlog / Nice-to-Have
- [ ] Mobile-responsive layouts for all pages
- [ ] Keyboard shortcuts & command palette
- [ ] Bulk operations (tag, stage, assign)
- [ ] Custom report builder
- [ ] Webhook system for external notifications
- [ ] SSO (SAML/OIDC)
- [ ] Audit export (GDPR/CCPA compliance)
- [ ] Dark mode for PDF/export reports
- [ ] Collaborative notes/comments on candidates
- [ ] AI-generated outreach emails
- [ ] Interview question bank per role
- [ ] DEI analytics dashboard

---

## Task Conventions

### Naming
- Backend tasks: `BE-<area>-<description>` (e.g., `BE-matching-rebuild-embeddings`)
- Frontend tasks: `FE-<page>-<description>` (e.g., `FE-dashboard-pipeline-funnel`)
- AI tasks: `AI-<component>-<description>` (e.g., `AI-orchestrator-add-tool`)
- Database tasks: `DB-<table>-<description>` (e.g., `DB-candidate-add-index`)

### Definition of Done
- [ ] Code implemented + self-reviewed
- [ ] Unit tests written + passing
- [ ] Integration tests updated
- [ ] Documentation updated (API, Architecture, PRD if needed)
- [ ] Lint + typecheck passing (`ruff`, `pyright`, `eslint`, `tsc`)
- [ ] No console errors / warnings
- [ ] Accessibility check (axe-core)
- [ ] Deployed to staging + smoke tested

### Priority Labels
- **P0**: Blocking release / security / data integrity
- **P1**: Core feature / high user impact
- **P2**: Enhancement / quality of life
- **P3**: Nice to have / tech debt

---

## Current Sprint Focus
**Sprint 6 (Phase 3)** — Pipeline Velocity, Placements & Revenue Analytics
- Primary: Database migrations for stage history, interviews, placements
- Secondary: Time-to-hire & bottleneck analytics
- Tertiary: Recruiter performance & client profitability dashboards