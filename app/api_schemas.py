# Import date and datetime for validated API timestamps and recruiter deadlines.
from datetime import date, datetime
# Import Pydantic validators and bounds for strict HTTP payload validation.
from pydantic import BaseModel, ConfigDict, Field, model_validator


# Reject accidental extra fields so API writes remain explicit and predictable.
class StrictApiModel(BaseModel):
    # Require callers to use only declared request fields.
    model_config = ConfigDict(extra="forbid")


# Describe candidate fields that can be created or managed through the API.
class CandidateWrite(StrictApiModel):
    # Accept an optional profile name without requiring it for identity resolution.
    name: str | None = Field(default=None, max_length=255)
    # Accept an optional email used by the documented email-only deduplication policy.
    email: str | None = Field(default=None, max_length=320)
    # Store validated skill labels without duplicate entries.
    skills: list[str] = Field(default_factory=list, max_length=200)
    # Accept experience only as an explicit non-negative numeric value.
    experience_years: float | None = Field(default=None, ge=0, le=80)
    # Accept a recruiter- or resume-stated location.
    location: str | None = Field(default=None, max_length=255)
    # Accept recruiter-managed availability metadata.
    availability: str | None = Field(default=None, max_length=128)
    # Accept a recruiter-managed candidate pipeline stage.
    stage: str = Field(default="New", min_length=1, max_length=64)
    # Accept an optional factual profile summary without generated claims.
    summary: str | None = Field(default=None, max_length=4000)


# Describe optional candidate updates while preserving omitted fields.
class CandidatePatch(StrictApiModel):
    # Replace the display name only when a value is explicitly supplied.
    name: str | None = Field(default=None, max_length=255)
    # Replace the deduplication email only when a value is explicitly supplied.
    email: str | None = Field(default=None, max_length=320)
    # Replace the complete validated skill list when requested.
    skills: list[str] | None = Field(default=None, max_length=200)
    # Replace explicit years of experience or clear them with null.
    experience_years: float | None = Field(default=None, ge=0, le=80)
    # Replace the stated location or clear it with null.
    location: str | None = Field(default=None, max_length=255)
    # Replace recruiter availability or clear it with null.
    availability: str | None = Field(default=None, max_length=128)
    # Replace the recruiter-managed pipeline stage.
    stage: str | None = Field(default=None, min_length=1, max_length=64)
    # Replace the optional factual summary or clear it with null.
    summary: str | None = Field(default=None, max_length=4000)


# Return a candidate's stored facts and resume counts without exposing file paths.
class CandidateResponse(StrictApiModel):
    # Return the stable SQLite candidate key.
    id: int
    # Return the candidate name when the source or recruiter supplied one.
    name: str | None
    # Return the candidate email when available for recruiter operations.
    email: str | None
    # Return the currently stored skill labels.
    skills: list[str]
    # Return explicit experience years or null when unavailable.
    experience_years: float | None
    # Return a stated work location or null when unavailable.
    location: str | None
    # Return recruiter-managed availability and hiring stage.
    availability: str | None
    stage: str
    # Return a factual summary only when one is stored.
    summary: str | None
    # Return the number of resumes linked to this candidate.
    resume_count: int
    # Return the record creation timestamp for client freshness checks.
    created_at: datetime


# Describe non-sensitive resume metadata returned by candidate and download APIs.
class ResumeResponse(StrictApiModel):
    # Return the stable resume record key.
    id: int
    # Return the filename stored for the uploaded source.
    source_filename: str
    # Return the content digest for duplicate and provenance checks.
    content_sha256: str
    # Return when the resume row was created.
    created_at: datetime
    # Return whether the resume has a valid local vector record.
    has_embedding: bool
    # Return actual dimensions only when an embedding exists.
    dimensions: int | None
    # Return the requested model identifier only when an embedding exists.
    embedding_model: str | None


# Describe the recruiter-managed job fields used by CRUD and matching endpoints.
class JobWrite(StrictApiModel):
    # Store the required role title.
    title: str = Field(min_length=1, max_length=255)
    # Store the source-backed job description used in search queries.
    description: str = Field(min_length=1, max_length=20000)
    # Store required skill labels for structured matching.
    required_skills: list[str] = Field(default_factory=list, max_length=200)
    # Store preferred skill labels separately from mandatory requirements.
    preferred_skills: list[str] = Field(default_factory=list, max_length=200)
    # Store an explicitly stated minimum experience range.
    min_experience_years: float | None = Field(default=None, ge=0, le=80)
    # Store an explicitly stated maximum experience range.
    max_experience_years: float | None = Field(default=None, ge=0, le=80)
    # Store the stated job location when supplied.
    location: str | None = Field(default=None, max_length=255)
    # Store open, paused, or closed job lifecycle state.
    status: str = Field(default="open", min_length=1, max_length=32)

    # Reject a range whose explicit minimum exceeds its explicit maximum.
    @model_validator(mode="after")
    def validate_experience_range(self) -> "JobWrite":
        # Enforce ordering only when both endpoints are available.
        if self.min_experience_years is not None and self.max_experience_years is not None:
            if self.min_experience_years > self.max_experience_years:
                raise ValueError("Minimum experience cannot exceed maximum experience.")
        # Return the validated write model unchanged.
        return self


# Describe partial job updates while sharing the create-time field constraints.
class JobPatch(StrictApiModel):
    # Update the role title only when supplied.
    title: str | None = Field(default=None, min_length=1, max_length=255)
    # Update the job description only when supplied.
    description: str | None = Field(default=None, min_length=1, max_length=20000)
    # Replace required skills only when supplied.
    required_skills: list[str] | None = Field(default=None, max_length=200)
    # Replace preferred skills only when supplied.
    preferred_skills: list[str] | None = Field(default=None, max_length=200)
    # Update or clear the explicit minimum experience.
    min_experience_years: float | None = Field(default=None, ge=0, le=80)
    # Update or clear the explicit maximum experience.
    max_experience_years: float | None = Field(default=None, ge=0, le=80)
    # Update or clear the stated work location.
    location: str | None = Field(default=None, max_length=255)
    # Update job lifecycle status.
    status: str | None = Field(default=None, min_length=1, max_length=32)


# Return a managed job and its structured requirements to API clients.
class JobResponse(StrictApiModel):
    # Return the stable job key.
    id: int
    # Return all recruiter-managed job values.
    title: str
    description: str
    required_skills: list[str]
    preferred_skills: list[str]
    min_experience_years: float | None
    max_experience_years: float | None
    location: str | None
    status: str
    created_at: datetime
    updated_at: datetime


# Describe a recruiter requisition payload and its hiring capacity.
class RequestWrite(StrictApiModel):
    # Accept an optional unique requisition number or generate one in the API.
    req_number: str | None = Field(default=None, max_length=64)
    # Store the role being recruited.
    role_title: str = Field(min_length=1, max_length=255)
    # Link to a managed job when one exists.
    job_id: int | None = Field(default=None, ge=1)
    # Store optional department and recruiter assignment details.
    department: str | None = Field(default=None, max_length=255)
    hiring_manager: str | None = Field(default=None, max_length=255)
    assigned_recruiter: str | None = Field(default=None, max_length=255)
    # Store validated urgency and lifecycle values.
    priority: str = Field(default="medium", min_length=1, max_length=32)
    status: str = Field(default="open", min_length=1, max_length=32)
    # Validate requested and filled opening counts.
    target_positions: int = Field(default=1, ge=1, le=10000)
    filled_positions: int = Field(default=0, ge=0, le=10000)
    # Store an optional target date, location, and internal notes.
    sla_deadline: date | None = None
    location: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=10000)

    # Reject filled counts that exceed the requested opening capacity.
    @model_validator(mode="after")
    def validate_filled_positions(self) -> "RequestWrite":
        # Enforce the capacity relationship after individual fields are validated.
        if self.filled_positions > self.target_positions:
            raise ValueError("Filled positions cannot exceed target positions.")
        # Return the validated request payload.
        return self


# Describe a partial requisition update with explicit field-presence semantics.
class RequestPatch(StrictApiModel):
    # Update the requisition role title when supplied.
    role_title: str | None = Field(default=None, min_length=1, max_length=255)
    # Update the linked job when supplied.
    job_id: int | None = Field(default=None, ge=1)
    # Update request ownership metadata when supplied.
    department: str | None = Field(default=None, max_length=255)
    hiring_manager: str | None = Field(default=None, max_length=255)
    assigned_recruiter: str | None = Field(default=None, max_length=255)
    # Update urgency and lifecycle status when supplied.
    priority: str | None = Field(default=None, min_length=1, max_length=32)
    status: str | None = Field(default=None, min_length=1, max_length=32)
    # Update target and filled counts when supplied.
    target_positions: int | None = Field(default=None, ge=1, le=10000)
    filled_positions: int | None = Field(default=None, ge=0, le=10000)
    # Update deadline, location, and internal notes when supplied.
    sla_deadline: date | None = None
    location: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=10000)


# Return operational requisition fields and computed remaining capacity.
class RequestResponse(StrictApiModel):
    # Return the stable requisition database key and human-readable number.
    id: int
    req_number: str
    role_title: str
    job_id: int | None
    department: str | None
    hiring_manager: str | None
    assigned_recruiter: str | None
    priority: str
    status: str
    target_positions: int
    filled_positions: int
    sla_deadline: date | None
    location: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


# Describe a semantic search request without embedding provider secrets in payloads.
class CandidateSearchRequest(StrictApiModel):
    # Accept a natural-language recruiter query.
    query: str = Field(min_length=1, max_length=2000)
    # Bound result count to keep local ranking responsive.
    limit: int = Field(default=20, ge=1, le=100)


# Describe grounded assistant retrieval inputs and optional entity context.
class AssistantQuery(StrictApiModel):
    # Accept the user's natural-language search request.
    query: str = Field(min_length=1, max_length=2000)
    # Optionally ground the query against a stored managed job.
    job_id: int | None = Field(default=None, ge=1)
    # Optionally include a stored recruitment request as retrieval context.
    request_id: int | None = Field(default=None, ge=1)
    # Bound the number of retrieved resume records.
    limit: int = Field(default=10, ge=1, le=50)


# Require explicit external-submission confirmation when triggering uploaded-file ingestion.
class IngestionTrigger(StrictApiModel):
    # Prevent accidental OpenRouter calls from upload-only workflows.
    confirm_external_embedding: bool = False


# Return structured ingestion state without source paths or personal values.
class IngestionStatusResponse(StrictApiModel):
    # Return the durable ingestion status-row identifier.
    id: int
    # Return only the status class and safe error code.
    status: str
    error_code: str | None
    attempts: int
    candidate_id: int | None
    resume_id: int | None
    created_at: datetime
    updated_at: datetime


# Summarize database-backed dashboard metrics and recent activity.
class DashboardResponse(StrictApiModel):
    # Return current SQLite entity totals.
    total_candidates: int
    total_resumes: int
    total_jobs: int
    active_jobs: int = 0
    open_requests: int
    # Return ingestion success, failure, and pending counts.
    ingestion_imported: int
    ingestion_failed: int
    ingestion_pending: int
    # Return recent privacy-safe activity records.
    recent_activity: list[dict[str, object]]
