# CompanyAI Agent — AI & Agent Architecture (`Agent.md`)

## 1. Overview
CompanyAI Agent uses a grounded, human-in-the-loop AI architecture built around **FastAPI**, **OpenRouter**, and **NVIDIA Nemotron** models. Every AI action is traceable, evidence-backed, and subject to governance controls before modifying recruitment state.

---

## 2. Core AI & Embedding Stack
| Capability | Implementation | Notes |
|---|---|---|
| **Orchestrator** | `app/agent/orchestrator.py` (`AgentOrchestrator`) | Dispatches tool calls, attaches workspace entity context (`job_id`, `candidate_id`, `request_id`), and logs execution traces. |
| **Chat & Trace Router** | `app/routers/agent.py` | Exposes `POST /api/ai/chat` and `GET /api/ai/traces`. |
| **Embedding Model** | `nvidia/nemotron-3-embed-1b:free` | Generates **2048-dimensional** vectors stored in `resume_embedding` and `job_embedding`. |
| **Observability** | `AgentTrace` (`agent_trace` table) | Records `trace_id`, `prompt`, `model_name`, `tools_called`, `latency_ms`, and token/execution telemetry. |

---

## 3. Agent Execution Flow (`POST /api/ai/chat`)
1. **Context Injection:** The frontend (`AIAssistantPage.jsx`) optionally attaches active workspace entity context (`job_id`, `candidate_id`, `request_id`) in `ChatQuerySchema.context`.
2. **Tool Dispatch:** `AgentOrchestrator.execute(...)` resolves grounded queries against SQLite (`Candidate`, `Job`, `Resume`, `RecruitmentRequest`, `ApprovalRequest`) and semantic matching services.
3. **Trace Persistence:** Execution metadata (`trace_id`, `model`, `latency_ms`, `tools_called`) is returned in the response and persisted to `agent_trace` for inspection in **Agent Activity** (`AgentActivityPage.jsx`) via `GET /api/ai/traces`.

---

## 4. Human-in-the-Loop Governance
- **Approval Requests (`app/routers/approvals.py`, `ApprovalRequest`):** Sensitive recruitment actions (shortlisting, offer proposals, rejections, JD segmentation approvals) can be routed through approval workflows rather than silent autonomous mutation.
- **JD Segmentation Gate (`app/services/jd_segmentation_service.py`):** AI-extracted job requirements (`JDSegmentation`, `JobRequirement`) remain in `review_pending` until explicitly approved (`is_approved = 1`) by a recruiter.
- **Advisory Intelligence:** Phase 1 & Phase 2 Talent Intelligence recommendations carry explicit `advisory_only: true` and `information_type` provenance tags and never auto-modify candidate scores or job requirements.

---

## 5. Strict Guardrails
- Never fabricate candidate experience, skills, interview outcomes, or external market benchmarks.
- Preserve **2048-dimensional** `nvidia/nemotron-3-embed-1b:free` embeddings and existing deterministic + semantic matching formulas in `app/services/matching_engine_service.py`.
- Distinguish verified database facts, extracted resume facts, calculated metrics, semantic similarity, and heuristic/inferred suitability.
