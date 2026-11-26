"""Minimal SQLAlchemy models for CompanyAI's local SQLite MVP."""

# Import UTC-aware timestamps for model creation and update fields.
from datetime import date, datetime, timezone

# Import Any for JSON fields that hold nested structured analysis values.
from typing import Any

# Import SQLAlchemy column types, index constructs, raw SQL text, and foreign-key support.
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, text

# Import SQLAlchemy 2.x typed column and relationship declarations.
from sqlalchemy.orm import Mapped, mapped_column, relationship

# Reuse the SQLite declarative base instead of creating a second metadata registry.
from database.sqlite_connection import Base


# Represent one candidate with lightweight contact and extracted-skill metadata.
class Candidate(Base):
    """Store one candidate identity and extracted skill list."""

    # Assign a stable integer primary key to each candidate.
    __tablename__ = "candidate"

    # Define the candidate's primary key.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Store an optional display name without requiring personal data at insert time.
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Store an optional email address and index it for candidate lookup.
    email: Mapped[str | None] = mapped_column(String(320), nullable=True, index=True)

    # Store extracted candidate phone number.
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Store extracted skills as JSON-compatible strings rather than separate rows.
    skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    # Store experience only when the resume parser extracts an explicit value.
    experience_years: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Store a stated work location without inferring one from the source filename.
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Store recruiter-managed availability as optional profile metadata.
    availability: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Store the recruiter's current pipeline stage independently from resume facts.
    stage: Mapped[str] = mapped_column(String(64), default="New", nullable=False)

    # Store an optional factual summary without fabricating missing profile details.
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Record when the candidate row was first created.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Link this candidate to each associated resume.
    resumes: Mapped[list["Resume"]] = relationship(
        back_populates="candidate",
        cascade="all, delete-orphan",
    )


# Represent one stored resume reference linked to its candidate.
class Resume(Base):
    """Store resume file metadata without copying full resume text into SQLite."""

    # Assign a stable integer primary key to each resume.
    __tablename__ = "resume"

    # Define the resume's primary key.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Link the resume to its owning candidate and enforce the database relationship.
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidate.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Preserve the original local filename as source metadata.
    source_filename: Mapped[str] = mapped_column(String(512), nullable=False)

    # Keep a path reference to the local source file instead of duplicating its bytes.
    file_path: Mapped[str] = mapped_column(Text, nullable=False)

    # Store a unique content digest for duplicate detection and source traceability.
    content_sha256: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    # Record when this resume metadata row was created.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Link this resume back to its owning candidate.
    candidate: Mapped[Candidate] = relationship(back_populates="resumes")

    # Link this resume to zero or one local embedding record while retaining vector-store references.
    embedding: Mapped["ResumeEmbedding | None"] = relationship(
        back_populates="resume",
        cascade="all, delete-orphan",
        uselist=False,
    )


# Represent one resume embedding, its local vector, and any retained vector-store references.
class ResumeEmbedding(Base):
    """Store a resume vector and the metadata needed to validate and cache it."""

    # Assign a stable integer primary key to each embedding reference.
    __tablename__ = "resume_embedding"

    # Define the embedding-reference primary key.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Enforce at most one embedding reference for each resume.
    resume_id: Mapped[int] = mapped_column(
        ForeignKey("resume.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # Preserve the existing vector identifier for compatibility with prior ChromaDB records.
    vector_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)

    # Preserve the existing collection name for compatibility with prior ChromaDB records.
    collection_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Preserve the existing model name while retaining the requested-model field separately.
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Store the vector size as metadata for compatibility checks.
    dimensions: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Preserve JSON-compatible metadata from existing vector-store records and future storage.
    embedding_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Store the numeric vector as a JSON array while allowing legacy rows to remain vectorless.
    embedding_vector: Mapped[list[float] | None] = mapped_column(JSON, nullable=True)

    # Store the SHA-256 hash of the exact normalized text sent to the embedding provider.
    input_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Store the OpenRouter model identifier requested when the vector was generated.
    requested_model: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Store the provider-returned model identifier when the response supplies one.
    returned_model: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Store the text-preparation version so cache reuse can detect preprocessing changes.
    preprocessing_version: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Track the generation method ('nemotron_api', 'provenance_unknown', 'synthetic_fallback', 'pending_regeneration').
    generation_method: Mapped[str] = mapped_column(String(64), default="provenance_unknown", server_default="provenance_unknown", nullable=False)

    # Record when the embedding reference was created.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Link the embedding reference back to its single resume.
    resume: Mapped[Resume] = relationship(back_populates="embedding")


# Represent one original job-description source file and its traceability metadata.
class JobDescription(Base):
    """Store a JD's original text, source reference, and stable identifiers."""

    # Assign a stable integer primary key to each job description.
    __tablename__ = "job_description"

    # Define the job-description primary key.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Preserve the existing manifest JD identifier and index it for lookup.
    jd_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    # Store the explicit job title and index it for simple searches.
    title: Mapped[str] = mapped_column(String(255), index=True, nullable=False)

    # Store the employer name only when the source identifies one.
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Preserve the original source filename for traceability.
    source_filename: Mapped[str] = mapped_column(String(512), nullable=False)

    # Keep a local file reference without replacing the original source document.
    source_path: Mapped[str] = mapped_column(Text, nullable=False)

    # Store a digest for duplicate detection and source integrity checks.
    content_sha256: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    # Preserve the original JD wording as local text without AI-generated changes.
    original_text: Mapped[str] = mapped_column(Text, nullable=False)

    # Store incremental JD version number to avoid overwriting previously approved versions.
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Store current processing status: uploaded, extracting, extracted, ocr_required, failed, duplicate_detected.
    status: Mapped[str] = mapped_column(String(32), default="extracted", nullable=False, index=True)

    # Store SHA-256 digest of normalized text for whitespace/punctuation invariant duplicate detection.
    normalized_text_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    # Store the parsed/extracted plain text representation separately from the raw file bytes or original text.
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Track parent JD identifier if this document is a new version of an earlier job description.
    parent_jd_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Indicate whether the file is a scanned document lacking extractable text and requiring OCR.
    ocr_needed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Record when this job-description row was first created.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Record the most recent update to the source metadata.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Link this JD to its separate analysis records.
    analyses: Mapped[list["JDAnalysis"]] = relationship(
        back_populates="job_description",
        cascade="all, delete-orphan",
    )

    # Link this source JD to associated operational jobs.
    jobs: Mapped[list["Job"]] = relationship(
        back_populates="job_description",
    )


# Represent one structured analysis result for a job description.
class JDAnalysis(Base):
    """Store structured JD requirements and the model that produced them."""

    # Assign a stable integer primary key to each JD analysis.
    __tablename__ = "jd_analysis"

    # Define the analysis primary key.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Link the analysis to its source JD and index the relationship.
    job_description_id: Mapped[int] = mapped_column(
        ForeignKey("job_description.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Store the validated evidence-linked requirements as JSON-compatible data.
    requirements: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Record the model identifier used for this analysis.
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Record when the analysis was generated.
    analyzed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Link this analysis back to the source job description.
    job_description: Mapped[JobDescription] = relationship(back_populates="analyses")


# Track a batch import without tying it to a particular file-processing workflow.
class ImportBatch(Base):
    """Store a small audit record for a local import operation."""

    # Assign a stable integer primary key to each import batch.
    __tablename__ = "import_batch"

    # Define the import-batch primary key.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Identify the kind of data represented by this batch.
    import_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)

    # Preserve the source filename when the batch comes from a file.
    source_filename: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Track import progress using a simple indexed text status.
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True, nullable=False)

    # Record how many source records were handled when known.
    record_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Record when the import batch was first created.
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Record the end time only after the batch finishes.
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


# Track each source file's most recent ingestion state for safe retries and auditability.
class ResumeIngestionStatus(Base):
    # Keep ingestion workflow records separate from canonical candidate and resume data.
    __tablename__ = "resume_ingestion_status"

    # Assign one stable database key to each tracked source path.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Ensure repeat attempts for the same normalized source path update one status row.
    source_path: Mapped[str] = mapped_column(Text, unique=True, nullable=False)

    # Preserve the latest file digest so retries can distinguish changed source files.
    content_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    # Store an explicit discovery, failure, duplicate, or successful import state.
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)

    # Count execution attempts so failed files can be retried transparently.
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Keep safe error summaries without storing extracted resume text.
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Track file extraction independently from candidate parsing and vector generation.
    source_extension: Mapped[str | None] = mapped_column(String(16), nullable=True)

    # Preserve whether local text extraction completed or needs an OCR/conversion retry.
    extraction_status: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # Preserve whether a candidate profile was parsed from extracted resume text.
    parsing_status: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # Preserve whether an embedding is pending approval, stored, failed, or not applicable.
    embedding_status: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # Link a successfully processed file to its canonical candidate when available.
    candidate_id: Mapped[int | None] = mapped_column(
        ForeignKey("candidate.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Link a successfully processed file to its canonical resume when available.
    resume_id: Mapped[int | None] = mapped_column(
        ForeignKey("resume.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Record the first time the file entered the persistent ingestion workflow.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Record the latest status transition without changing candidate or resume timestamps.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# Store recruiter-managed jobs separately from immutable imported job-description sources.
class Job(Base):
    # Use a dedicated table for operational job lifecycle fields.
    __tablename__ = "job"

    # Assign a stable integer key for API routes and request relationships.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Store the role title shown in recruiter job listings.
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Store the recruiter-authored job description used in semantic matching.
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Store normalized required skills as JSON-compatible strings.
    required_skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    # Store optional preferred skills separately from required qualifications.
    preferred_skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    # Store list of JD-synchronized mandatory skills to cleanly isolate from manual skills during reapproval.
    synced_mandatory_skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=True)

    # Store list of JD-synchronized preferred skills to cleanly isolate from manual skills during reapproval.
    synced_preferred_skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=True)

    # Store only an explicitly supplied minimum experience requirement.
    min_experience_years: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Store only an explicitly supplied maximum experience requirement.
    max_experience_years: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Store the stated work location for structured candidate filtering.
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Track whether recruiters are sourcing for this job.
    status: Mapped[str] = mapped_column(String(32), default="open", nullable=False, index=True)

    # Store hiring client or company name.
    client_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Store unique or alphanumeric job requisition code.
    job_code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    # Store work arrangement (e.g., Remote, Hybrid, On-site).
    work_mode: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Store employment type (e.g., Full-time, Contract, Part-time, Internship).
    employment_type: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Store stated compensation or salary range string.
    salary_range: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Store number of open headcount positions for this role.
    openings_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Store business unit or organizational department.
    department: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Store primary recruiter or talent acquisition owner.
    recruiter_owner: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Store hiring priority level (e.g., Low, Medium, High, Urgent).
    priority: Mapped[str] = mapped_column(String(32), default="Medium", nullable=False)

    # Store source channel (e.g., manual_upload, direct_text, imported).
    source: Mapped[str] = mapped_column(String(64), default="manual_upload", nullable=False)

    # Store version number for job revisions.
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Optional foreign key linking this operational job to its source JobDescription document.
    job_description_id: Mapped[int | None] = mapped_column(
        ForeignKey("job_description.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Record when the job was first created.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Record the most recent recruiter-managed job update.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Link to the underlying JobDescription entity.
    job_description: Mapped[JobDescription | None] = relationship(back_populates="jobs")

    # Link job records to their recruitment requests.
    requests: Mapped[list["RecruitmentRequest"]] = relationship(back_populates="job")

    # Link job records to their AI segmentation history.
    segmentations: Mapped[list["JDSegmentation"]] = relationship(
        back_populates="job",
        cascade="all, delete-orphan",
    )

    # Link job records to their semantic embeddings.
    embeddings: Mapped[list["JobEmbedding"]] = relationship(
        back_populates="job",
        cascade="all, delete-orphan",
    )


# Store structured AI segmentation results and recruiter review state.
class JDSegmentation(Base):
    """Store AI-extracted segmentation metadata and recruiter approval state for a job."""

    # Assign stable table identifier for segmentation records.
    __tablename__ = "jd_segmentation"

    # Define the segmentation primary key.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Link directly to the owning operational job.
    job_id: Mapped[int] = mapped_column(
        ForeignKey("job.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Optional link to source JobDescription document.
    job_description_id: Mapped[int | None] = mapped_column(
        ForeignKey("job_description.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Revision version number corresponding to the segmented job version.
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Lifecycle processing status: pending, processing, review_pending, approved, failed.
    status: Mapped[str] = mapped_column(String(32), default="review_pending", nullable=False, index=True)

    # AI model identifier that produced the segmentation.
    model_name: Mapped[str] = mapped_column(String(255), default="nvidia/nemotron-3.5-super-vl", nullable=False)

    # Optional executive overview summary text.
    job_overview: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Optional role summary text.
    role_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 12-section structured scope and responsibilities intelligence.
    structured_scope: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Complete structured JD intelligence (role, skills, domain, boolean queries, inconsistencies).
    intelligence_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Flag indicating whether a recruiter explicitly approved this segmentation.
    is_approved: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Recruiter or user who recorded approval.
    approved_by: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Timestamp when approval was recorded.
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Record when this segmentation row was first created.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Record when this segmentation row was last updated.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship to parent operational Job.
    job: Mapped["Job"] = relationship(back_populates="segmentations")

    # Relationship to individual requirement items.
    requirements: Mapped[list["JobRequirement"]] = relationship(
        back_populates="segmentation",
        cascade="all, delete-orphan",
        order_by="JobRequirement.order_index",
    )

    # Link this segmentation to its generated semantic embeddings.
    embeddings: Mapped[list["JobEmbedding"]] = relationship(
        back_populates="segmentation",
        cascade="all, delete-orphan",
    )


# Store individual structured recruitment requirements linked to evidence.
class JobRequirement(Base):
    """Store one granular, evidence-linked requirement categorized into 1 of 15 domains."""

    # Assign table identifier for individual requirement records.
    __tablename__ = "job_requirement"

    # Define the requirement primary key.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Foreign key referencing the parent segmentation record.
    segmentation_id: Mapped[int] = mapped_column(
        ForeignKey("jd_segmentation.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Category name (one of the 15 standard recruitment categories).
    category: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Original requirement wording from the JD.
    original_text: Mapped[str] = mapped_column(Text, nullable=False)

    # Classification: Mandatory or Preferred.
    classification: Mapped[str] = mapped_column(String(32), default="Mandatory", nullable=False)

    # Standardized/canonical skill name if applicable.
    normalized_skill: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)

    # Stated experience in years if explicitly mentioned.
    experience_years: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Verbatim quote from source document supporting this requirement.
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Model confidence score (0.0 to 1.0).
    confidence: Mapped[float] = mapped_column(Float, default=0.95, nullable=False)

    # Flag indicating whether this requirement was verified or edited by a recruiter.
    is_approved: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Display ordering within the category.
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Origin provenance: ai_model, heuristic_fallback, recruiter_added, recruiter_edited.
    source_origin: Mapped[str | None] = mapped_column(String(32), default="ai_extracted", nullable=True)

    # Record when this requirement row was first created.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Record when this requirement row was last updated.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship to parent segmentation record.
    segmentation: Mapped["JDSegmentation"] = relationship(back_populates="requirements")

    # Link this granular requirement to its generated requirement embeddings.
    embeddings: Mapped[list["JobEmbedding"]] = relationship(
        back_populates="requirement",
        cascade="all, delete-orphan",
    )


# Store structured job description embeddings and granular requirement vectors.
class JobEmbedding(Base):
    """Store full JD and requirement-level embedding vectors with validation and deduplication metadata."""

    # Assign stable SQLite table identifier for job embeddings.
    __tablename__ = "job_embedding"

    # Define primary integer key for the job embedding row.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Foreign key referencing the parent operational job.
    job_id: Mapped[int] = mapped_column(
        ForeignKey("job.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Foreign key referencing the approved segmentation record.
    segmentation_id: Mapped[int] = mapped_column(
        ForeignKey("jd_segmentation.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Optional foreign key referencing an individual requirement (NULL for full JD scope embedding).
    requirement_id: Mapped[int | None] = mapped_column(
        ForeignKey("job_requirement.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Category or scope identifier (e.g., 'full_jd', 'mandatory_requirement', 'preferred_requirement').
    embedding_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # SHA-256 digest of the exact normalized text embedded for idempotent deduplication.
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Local Ollama embedding model identifier used to produce the vector.
    model_name: Mapped[str] = mapped_column(String(255), default="nomic-embed-text", nullable=False)

    # Vector dimension length explicitly validated to 768 coordinates.
    dimensions: Mapped[int] = mapped_column(Integer, default=768, nullable=False)

    # Track generation method ('ollama', 'nemotron_api', 'provenance_unknown', 'synthetic_fallback', 'pending_regeneration').
    generation_method: Mapped[str] = mapped_column(String(64), default="ollama", server_default="ollama", nullable=False)

    # Dense numeric embedding vector stored as JSON array of floats.
    embedding_vector: Mapped[list[float]] = mapped_column(JSON, nullable=False)

    # Creation timestamp recorded in UTC for lineage tracking.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship back to the parent operational Job.
    job: Mapped["Job"] = relationship(back_populates="embeddings")

    # Relationship back to the parent JDSegmentation.
    segmentation: Mapped["JDSegmentation"] = relationship(back_populates="embeddings")

    # Relationship back to the parent JobRequirement if requirement-level.
    requirement: Mapped["JobRequirement | None"] = relationship(back_populates="embeddings")

    # Configure SQLite partial unique indexes to guarantee at-most-one vector per requirement and per full JD.
    __table_args__ = (
        # Ensure a requirement has at most one embedding record within a segmentation.
        Index(
            "uq_job_embedding_segmentation_requirement",
            "segmentation_id",
            "requirement_id",
            unique=True,
            sqlite_where=text("requirement_id IS NOT NULL"),
        ),
        # Ensure at most one full JD scope embedding exists per segmentation.
        Index(
            "uq_job_embedding_segmentation_full_jd",
            "segmentation_id",
            unique=True,
            sqlite_where=text("embedding_type = 'full_jd' AND requirement_id IS NULL"),
        ),
    )


# Track recruiter requisitions independently from source job-description documents.
class RecruitmentRequest(Base):
    # Use a stable table for requests and their operational lifecycle.
    __tablename__ = "recruitment_request"

    # Assign the primary key returned by request API endpoints.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Enforce one stable recruiter-facing requisition identifier per request.
    req_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    # Store the request's role title without relying on frontend mock objects.
    role_title: Mapped[str] = mapped_column(String(255), nullable=False)

    # Optionally connect the requisition to one managed job.
    job_id: Mapped[int | None] = mapped_column(ForeignKey("job.id", ondelete="SET NULL"), nullable=True, index=True)

    # Store the department or hiring group when supplied.
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Store hiring-manager metadata when supplied by the recruiter.
    hiring_manager: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Store assigned recruiter metadata when supplied by the recruiter.
    assigned_recruiter: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Track the request's urgency using a validated API field.
    priority: Mapped[str] = mapped_column(String(32), default="medium", nullable=False)

    # Track open, in-progress, filled, or cancelled request state.
    status: Mapped[str] = mapped_column(String(32), default="open", nullable=False, index=True)

    # Store the requested hiring capacity.
    target_positions: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Store positions already filled without exceeding the target count.
    filled_positions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Store a target completion date when the requester provides one.
    sla_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Store the request's stated location requirement.
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Store internal request notes as recruiter-provided text.
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Record when the request was created.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Record the latest request lifecycle update.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Link the request to its optional managed job.
    job: Mapped[Job | None] = relationship(back_populates="requests")


# Store recruiter Boolean searches with job and JD version provenance.
class BooleanSearchHistory(Base):
    __tablename__ = "boolean_search_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("job.id", ondelete="CASCADE"), nullable=False, index=True)
    jd_version: Mapped[int] = mapped_column(Integer, nullable=False)
    platform: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    search_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    recruiter: Mapped[str | None] = mapped_column(String(255), nullable=True)
    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    generation_method: Mapped[str] = mapped_column(String(64), nullable=False)
    model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


# Record privacy-safe activity events for dashboard timelines.
class ActivityEvent(Base):
    # Keep dashboard events in SQLite rather than frontend-only mock state.
    __tablename__ = "activity_event"

    # Assign the event's stable database identifier.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Store a short event category such as candidate_created or job_updated.
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Store a fixed, non-personal summary for the dashboard activity feed.
    summary: Mapped[str] = mapped_column(String(255), nullable=False)

    # Identify the entity category without embedding personal details in the summary.
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)

    # Store the related entity key as text to support multiple table key types.
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)

    # Record when the activity occurred for chronological dashboard display.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )


# Store scheduled and completed interview rounds linked to candidates.
class Interview(Base):
    """Store interview schedule, round details, and interviewer feedback."""

    # Assign a stable integer primary key to each interview record.
    __tablename__ = "interview"

    # Define the interview primary key.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Link interview to candidate.
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidate.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Name of the interview round (e.g. Technical Round 1, Manager Round, HR Discussion).
    round_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Status of the interview (Scheduled, Completed, Rescheduled, Cancelled).
    status: Mapped[str] = mapped_column(String(64), default="Scheduled", nullable=False, index=True)

    # Assigned interviewer name.
    interviewer: Mapped[str] = mapped_column(String(255), nullable=False)

    # Scheduled ISO timestamp string or datetime.
    scheduled_at: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Meeting link or location.
    meeting_link: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Feedback or notes.
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Created timestamp.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# Store dynamically generated AI interview screening kits, question sets, and evaluation scorecards.
class InterviewKit(Base):
    """Store dynamically generated AI interview screening kits, question sets, and evaluation scorecards."""

    __tablename__ = "interview_kit"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(
        ForeignKey("job.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    jd_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    candidate_id: Mapped[int | None] = mapped_column(
        ForeignKey("candidate.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    kit_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="active", nullable=False)

    role_title: Mapped[str] = mapped_column(String(255), nullable=False)
    seniority: Mapped[str] = mapped_column(String(80), default="Mid-Level", nullable=False)
    experience_level: Mapped[str] = mapped_column(String(80), default="5-8 Years", nullable=False)
    role_domain: Mapped[str] = mapped_column(String(120), default="General", nullable=False)

    question_count: Mapped[int] = mapped_column(Integer, default=8, nullable=False)
    questions: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    coverage_matrix: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    overall_scorecard: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    provenance: Mapped[str] = mapped_column(String(60), default="nemotron_chat", nullable=False)
    model_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# Store pending and resolved human approvals for sensitive AI and recruiter actions.
class ApprovalRequest(Base):
    """Store sensitive operations requiring human confirmation before execution."""

    # Assign a stable integer primary key to each approval request.
    __tablename__ = "approval_request"

    # Define the primary key.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Identifier for the action type (e.g. update_candidate_stage, offer_candidate, reject_candidate, create_requisition).
    action_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)

    # Human-readable description of the proposed action.
    description: Mapped[str] = mapped_column(String(512), nullable=False)

    # JSON payload containing the parameters to execute once approved.
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Requester identity (e.g. "Nemotron AI Agent" or recruiter name).
    requester: Mapped[str] = mapped_column(String(255), default="Nemotron AI Agent", nullable=False)

    # Approval status (pending, approved, rejected).
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False, index=True)

    # Execution result message after approval.
    execution_result: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamp when approval was created.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Timestamp when approval was resolved.
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Person who approved or rejected.
    resolved_by: Mapped[str | None] = mapped_column(String(255), nullable=True)


 # Store external advertisement and publishing lifecycle linked to one approved internal job.
class JobPosting(Base):
    __tablename__ = "job_posting"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("job.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="Draft", nullable=False, index=True)
    posting_owner: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    strategy: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    supplementary_info: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)


 # Store platform-specific advertisements without modifying the approved JD.
class JobPostingVersion(Base):
    __tablename__ = "job_posting_version"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    posting_id: Mapped[int] = mapped_column(ForeignKey("job_posting.id", ondelete="CASCADE"), nullable=False, index=True)
    platform: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="AI Generated", nullable=False)
    approval_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    publication_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    external_posting_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_id_external: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ai_generated: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    generation_method: Mapped[str] = mapped_column(String(64), default="deterministic_fallback", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)


 # Store only manually entered or genuinely integrated platform metrics.
class JobPostingMetrics(Base):
    __tablename__ = "job_posting_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    posting_id: Mapped[int] = mapped_column(ForeignKey("job_posting.id", ondelete="CASCADE"), nullable=False, index=True)
    platform: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    source: Mapped[str] = mapped_column(String(64), default="manual", nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


 # Store posting lifecycle and edit history as audit trail.
class JobPostingActivity(Base):
    __tablename__ = "job_posting_activity"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    posting_id: Mapped[int] = mapped_column(ForeignKey("job_posting.id", ondelete="CASCADE"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


# Store agent execution traces for observability, tool inspection, and latency metrics.
class AgentTrace(Base):
    """Store agent tool execution traces, model latency, and token usage."""

    # Assign a stable integer primary key to each trace.
    __tablename__ = "agent_trace"

    # Define primary key.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Unique trace identifier (UUID).
    trace_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    # Session identifier.
    session_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)

    # User query or prompt.
    prompt: Mapped[str] = mapped_column(Text, nullable=False)

    # Model name used.
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # List of tool calls executed during this run.
    tools_called: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)

    # Total latency in milliseconds.
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Tokens consumed.
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Execution status (success, error, waiting_approval).
    status: Mapped[str] = mapped_column(String(32), default="success", nullable=False)

    # Created timestamp.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )


# Append-only snapshots preserve each distinct source version evaluated for a candidate and job.
class CandidateJobMatchResult(Base):
    __tablename__ = "candidate_job_match_result"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    candidate_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    job_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    resume_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resume_content_hash: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    candidate_profile_hash: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    scoring_weights_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    jd_version_id: Mapped[int] = mapped_column(Integer, nullable=False)
    jd_content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    matching_engine_version: Mapped[str] = mapped_column(String(32), nullable=False)
    scoring_configuration_version: Mapped[str] = mapped_column(String(64), nullable=False)
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False)
    score_available: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("1"), nullable=False)
    classification: Mapped[str] = mapped_column(String(64), nullable=False)
    component_scores: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    evidence: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    provenance: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    is_current: Mapped[bool] = mapped_column(default=True, nullable=False, index=True)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )

    # One record per distinct candidate/job source and scorer version; older records remain queryable.
    __table_args__ = (
        Index(
            "uq_candidate_job_match_source_version",
            "candidate_id", "job_id", "jd_version_id", "jd_content_hash", "resume_content_hash",
            "candidate_profile_hash", "matching_engine_version", "scoring_configuration_version", "scoring_weights_hash",
            unique=True,
        ),
    )

