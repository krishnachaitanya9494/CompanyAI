# CompanyAI Agent — Database Schema & Persistence (`Database.md`)

## 1. Active Database Engine
- **Active Database:** SQLite (`data/companyai.db`) managed via SQLAlchemy 2.x (`database/sqlite_connection.py`, `database/models.py`).
- **PostgreSQL Note:** PostgreSQL configuration exists in the repository, while SQLite remains the active runtime database.

---

## 2. Schema Inventory (16 Tables)

| Table Name | SQLAlchemy Model | Purpose |
|---|---|---|
| `candidate` | `Candidate` | Core candidate profile (`name`, `email`, `phone`, `skills` JSON, `experience_years`, `location`, `availability`, `stage`, `summary`, `created_at`). |
| `resume` | `Resume` | Resume file metadata (`candidate_id`, `source_filename`, `file_path`, `content_sha256`, `created_at`). |
| `resume_embedding` | `ResumeEmbedding` | 2048-dim `nvidia/nemotron-3-embed-1b:free` vectors (`resume_id`, `vector_id`, `collection_name`, `model_name`, `dimensions`, `embedding_vector`, `input_hash`). |
| `job_description` | `JobDescription` | Original JD source file & text reference. |
| `jd_analysis` | `JDAnalysis` | Structured AI JD analysis JSON linked to `job_description`. |
| `import_batch` | `ImportBatch` | Audit log for local batch import operations. |
| `resume_ingestion_status` | `ResumeIngestionStatus` | Per-file ingestion, extraction, parsing, and embedding status for safe retries. |
| `job` | `Job` | Operational job requisitions (`title`, `description`, `required_skills`, `preferred_skills`, `min_experience_years`, `max_experience_years`, `location`, `status`, `client_name`, `work_mode`, `openings_count`, `priority`, etc.). |
| `jd_segmentation` | `JDSegmentation` | Versioned AI JD segmentation with recruiter approval flag (`is_approved`, `approved_by`, `approved_at`). |
| `job_requirement` | `JobRequirement` | Individual mandatory/preferred requirement items belonging to a `JDSegmentation`. |
| `job_embedding` | `JobEmbedding` | 2048-dim vector embeddings for operational jobs/segmentations. |
| `recruitment_request` | `RecruitmentRequest` | Client recruitment request tracking linked to `job`. |
| `activity_event` | `ActivityEvent` | Workspace timeline events for candidates, jobs, and agent actions. |
| `interview` | `Interview` | Scheduled interview rounds (`candidate_id`, `round_name`, `status`, `interviewer`, `scheduled_at`, `meeting_link`, `notes`). |
| `approval_request` | `ApprovalRequest` | Human-in-the-loop governance approval queue. |
| `agent_trace` | `AgentTrace` | AI orchestrator execution traces (`trace_id`, `prompt`, `model_name`, `tools_called`, `latency_ms`). |

---

## 3. Data Integrity & Phase Boundaries
- **Zero Migrations in Phases 1 & 2:** All Phase 1 and Phase 2 intelligence services operate strictly read-only over the existing 16-table SQLite schema.
- **Schema Notes:**
  - `interview` links to `candidate_id` (no `job_id` foreign key in the current schema).
  - Dedicated tables for `candidate_stage_history`, `interview_evaluation`, and `placement` / financial metrics are reserved for **Phases 3 & 4**.
- **Provenance:** Every intelligence output distinguishes `Verified database fact`, `Extracted resume information`, `Calculated metric`, `Semantic similarity`, and `Heuristic / Inferred suitability`.
