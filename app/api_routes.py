# Import date parsing, file handling, safe identifiers, and search utilities for API operations.
import os
import re
import uuid
from collections import Counter
from datetime import date
from pathlib import Path
# Import HTTPX's base exception to translate provider failures into safe API responses.
import httpx
# Import FastAPI request, response, dependency, and validation primitives.
# Import only FastAPI primitives used by the JSON, upload, and download routes.
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import FileResponse
# Import SQLAlchemy query helpers for SQLite-backed CRUD and filtering.
# Import SQL filters and casting helpers for SQLite-backed resource queries.
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session
# Import local search, parser, ingestion, model, and database configuration services.
# Import Phase 3 search and existing resume processing services.
from app.candidate_search_service import CandidateSearchResult, search_candidates
from app.resume_pipeline import ingest_resume_folder
from app.resume_ingestion import SUPPORTED_RESUME_EXTENSIONS
from app.resume_profile_parser import parse_resume_profile
from database.models import (
    ActivityEvent,
    Candidate,
    Job,
    RecruitmentRequest,
    Resume,
    ResumeEmbedding,
    ResumeIngestionStatus,
)
from database.sqlite_connection import DATABASE_PATH, PROJECT_ROOT, SessionLocal, get_db
# Import strict request and response schemas for every public API operation.
from app.api_schemas import (
    AssistantQuery,
    CandidatePatch,
    CandidateResponse,
    CandidateSearchRequest,
    CandidateWrite,
    DashboardResponse,
    IngestionStatusResponse,
    IngestionTrigger,
    JobPatch,
    JobResponse,
    JobWrite,
    RequestPatch,
    RequestResponse,
    RequestWrite,
    ResumeResponse,
)


# Keep resource routes under one stable API prefix for local frontend calls.
router = APIRouter(prefix="/api", tags=["companyai"])
# Bound individual uploads so request bodies cannot exhaust local storage or memory.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
# Keep uploaded originals under the configured project resume directory.
UPLOAD_ROOT = PROJECT_ROOT / "data" / "resumes" / "uploads"
# Accept only formats supported by the existing resume pipeline.
UPLOAD_EXTENSIONS = frozenset({".pdf", ".docx", ".doc", ".txt"})
# Parse only explicit natural-language experience constraints for structured filtering.
_MIN_EXPERIENCE_PATTERN = re.compile(r"\bat\s+least\s+(\d{1,2}(?:\.\d+)?)\s+years?\b", re.IGNORECASE)


# Report filesystem discovery beside indexed SQLite resumes without reading file contents.
@router.get("/resumes/discovery")
def get_resume_discovery(session: Session = Depends(get_db)) -> dict[str, object]:
    # Use the same resume directory as the existing ingestion CLI and upload flow.
    resume_root = PROJECT_ROOT / "data" / "resumes"
    # Count regular files by lowercase extension while avoiding resume text extraction.
    discovered_files = [path for path in resume_root.rglob("*") if path.is_file()] if resume_root.is_dir() else []
    extension_counts = Counter(path.suffix.lower() or "<none>" for path in discovered_files)
    # Read stored paths to compare current files without mixing unlike hash definitions.
    resume_rows = session.execute(select(Resume.file_path)).all()
    indexed_paths = {
        os.path.normcase(str(Path(row.file_path).resolve()))
        for row in resume_rows
        if row.file_path
    }
    # Count all SQLite resume rows independently from matching disk files.
    indexed_record_count = len(resume_rows)
    # Count files whose source path is linked to a stored SQLite resume record.
    indexed_file_count = sum(
        1 for path in discovered_files if os.path.normcase(str(path.resolve())) in indexed_paths
    )
    # Match ingestion tracking rows to discovered paths without treating scan-manifest entries as database imports.
    tracked_statuses = session.scalars(select(ResumeIngestionStatus)).all()
    tracked_paths = {os.path.normcase(str(Path(row.source_path).resolve())): row for row in tracked_statuses}
    matched_statuses = [tracked_paths[os.path.normcase(str(path.resolve()))] for path in discovered_files if os.path.normcase(str(path.resolve())) in tracked_paths]
    # Keep supported formats aligned with the existing resume parsing pipeline.
    supported_file_count = sum(
        count for extension, count in extension_counts.items() if extension in SUPPORTED_RESUME_EXTENSIONS
    )
    # Serialize file status and path linkage without opening or returning resume contents.
    file_inventory = [
        {
            "filename": path.name,
            "extension": path.suffix.lower() or "<none>",
            "indexed": os.path.normcase(str(path.resolve())) in indexed_paths,
            "path_record_found": os.path.normcase(str(path.resolve())) in indexed_paths,
            "supported": path.suffix.lower() in SUPPORTED_RESUME_EXTENSIONS,
            "accounted": os.path.normcase(str(path.resolve())) in tracked_paths,
            "processing_status": tracked_paths[os.path.normcase(str(path.resolve()))].status if os.path.normcase(str(path.resolve())) in tracked_paths else "untracked",
            "extraction_status": tracked_paths[os.path.normcase(str(path.resolve()))].extraction_status if os.path.normcase(str(path.resolve())) in tracked_paths else None,
            "embedding_status": tracked_paths[os.path.normcase(str(path.resolve()))].embedding_status if os.path.normcase(str(path.resolve())) in tracked_paths else None,
            "error_code": tracked_paths[os.path.normcase(str(path.resolve()))].error_message if os.path.normcase(str(path.resolve())) in tracked_paths else None,
        }
        for path in sorted(discovered_files, key=lambda item: item.name.casefold())
    ]
    # Return aggregate counts plus safe local file labels and stage codes without document contents.
    return {
        "directory": str(resume_root),
        "total_files": len(discovered_files),
        "supported_files": supported_file_count,
        "unsupported_files": len(discovered_files) - supported_file_count,
        "indexed_files": indexed_file_count,
        "path_matched_files": indexed_file_count,
        "indexed_records": indexed_record_count,
        "records_without_local_file": max(0, indexed_record_count - indexed_file_count),
        "waiting_for_ingestion": supported_file_count - indexed_file_count,
        "accounted_files": len(matched_statuses),
        "supported_resume_records": indexed_file_count,
        "candidate_records": session.scalar(select(func.count()).select_from(Candidate)) or 0,
        "duplicate_files": sum(record.status == "duplicate" for record in matched_statuses),
        "awaiting_extraction": sum(record.extraction_status in (None, "not_started", "pending") for record in matched_statuses),
        "awaiting_embedding": sum(record.embedding_status == "awaiting_authorization" for record in matched_statuses),
        "successfully_embedded": sum(record.embedding_status == "stored" for record in matched_statuses),
        "legacy_embedding_unverified": sum(record.embedding_status == "legacy_unverified" for record in matched_statuses),
        "failed_files": sum(record.status == "failed" for record in matched_statuses),
        "by_extension": dict(sorted(extension_counts.items())),
        "files": file_inventory,
    }


# Record a privacy-safe activity summary without candidate personal information.
def _record_activity(
    session: Session,
    event_type: str,
    summary: str,
    entity_type: str,
    entity_id: int | str,
) -> None:
    # Store fixed event summaries supplied by the route, never names or resume excerpts.
    session.add(
        ActivityEvent(
            event_type=event_type,
            summary=summary,
            entity_type=entity_type,
            entity_id=str(entity_id),
        )
    )


# Convert one candidate ORM row to the stable API response and its resume count.
def _candidate_response(session: Session, candidate: Candidate) -> CandidateResponse:
    # Count linked resume records without returning their private local paths.
    resume_count = session.scalar(
        select(func.count()).select_from(Resume).where(Resume.candidate_id == candidate.id)
    ) or 0
    # Return only the candidate fields represented in the current SQLite schema.
    return CandidateResponse(
        id=candidate.id,
        name=candidate.name,
        email=candidate.email,
        skills=list(candidate.skills or []),
        experience_years=candidate.experience_years,
        location=candidate.location,
        availability=candidate.availability,
        stage=candidate.stage,
        summary=candidate.summary,
        resume_count=resume_count,
        created_at=candidate.created_at,
    )


# Convert one resume and its optional embedding metadata to a path-free response.
def _resume_response(resume: Resume) -> ResumeResponse:
    # Read the one-to-one relationship only for non-sensitive vector metadata.
    embedding = resume.embedding
    # Return content identity, display filename, and embedding state without source paths or vectors.
    return ResumeResponse(
        id=resume.id,
        source_filename=resume.source_filename,
        content_sha256=resume.content_sha256,
        created_at=resume.created_at,
        has_embedding=bool(embedding and embedding.embedding_vector),
        dimensions=embedding.dimensions if embedding else None,
        embedding_model=(embedding.requested_model or embedding.model_name) if embedding else None,
    )


# Convert a managed job ORM row to its validated public response.
def _job_response(job: Job) -> JobResponse:
    # Preserve model values while copying JSON collections into response-owned lists.
    return JobResponse(
        id=job.id,
        title=job.title,
        description=job.description,
        required_skills=list(job.required_skills or []),
        preferred_skills=list(job.preferred_skills or []),
        min_experience_years=job.min_experience_years,
        max_experience_years=job.max_experience_years,
        location=job.location,
        status=job.status,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


# Convert one recruitment request ORM row into the validated response schema.
def _request_response(record: RecruitmentRequest) -> RequestResponse:
    # Return the stored request facts without joining unrelated candidate data.
    return RequestResponse(
        id=record.id,
        req_number=record.req_number,
        role_title=record.role_title,
        job_id=record.job_id,
        department=record.department,
        hiring_manager=record.hiring_manager,
        assigned_recruiter=record.assigned_recruiter,
        priority=record.priority,
        status=record.status,
        target_positions=record.target_positions,
        filled_positions=record.filled_positions,
        sla_deadline=record.sla_deadline,
        location=record.location,
        notes=record.notes,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


# Convert an ingestion status row without exposing its local source path.
def _ingestion_status_response(record: ResumeIngestionStatus) -> IngestionStatusResponse:
    # Return identifiers and safe error codes needed to inspect or retry this file.
    return IngestionStatusResponse(
        id=record.id,
        status=record.status,
        error_code=record.error_message,
        attempts=record.attempts,
        candidate_id=record.candidate_id,
        resume_id=record.resume_id,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


# Return all candidate records with optional text and skill filtering.
@router.get("/candidates", response_model=list[CandidateResponse])
def list_candidates(
    q: str | None = Query(default=None, max_length=255),
    skill: str | None = Query(default=None, max_length=128),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_db),
) -> list[CandidateResponse]:
    # Start with a stable primary-key order so pagination is deterministic.
    statement = select(Candidate).order_by(Candidate.id.asc())
    # Apply a case-insensitive search across candidate identity and stated location.
    if q and q.strip():
        needle = f"%{q.strip().casefold()}%"
        statement = statement.where(
            or_(
                func.lower(Candidate.name).like(needle),
                func.lower(Candidate.email).like(needle),
                func.lower(Candidate.location).like(needle),
            )
        )
    # Filter skill terms against the serialized JSON skill list without external services.
    if skill and skill.strip():
        statement = statement.where(func.lower(cast(Candidate.skills, String)).like(f"%{skill.strip().casefold()}%"))
    # Apply bounded pagination before materializing response rows.
    candidates = session.scalars(statement.limit(limit).offset(offset)).all()
    # Return candidate data using the shared privacy-conscious response converter.
    return [_candidate_response(session, candidate) for candidate in candidates]


# Create one recruiter-managed candidate record with duplicate-email protection.
@router.post("/candidates", response_model=CandidateResponse, status_code=201)
def create_candidate(payload: CandidateWrite, session: Session = Depends(get_db)) -> CandidateResponse:
    # Reject an existing normalized email instead of silently creating a duplicate identity.
    if payload.email:
        duplicate = session.scalar(
            select(Candidate).where(func.lower(Candidate.email) == payload.email.casefold())
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="A candidate with this email already exists.")
    # Create only fields explicitly supplied or safely defaulted by the request schema.
    candidate = Candidate(**payload.model_dump())
    session.add(candidate)
    # Flush to make the generated candidate ID available to the activity record.
    session.flush()
    # Record a fixed activity summary that contains no personal data.
    _record_activity(session, "candidate_created", "Candidate record created", "candidate", candidate.id)
    try:
        # Commit the candidate and its activity event together.
        session.commit()
        session.refresh(candidate)
    except Exception:
        # Roll back the complete write if SQLite rejects either record.
        session.rollback()
        raise
    # Return the committed candidate fields and current resume count.
    return _candidate_response(session, candidate)


# Search resume embeddings semantically through the existing Phase 3 implementation.
@router.post("/candidates/search", response_model=list[dict[str, object]])
def semantic_candidate_search(
    payload: CandidateSearchRequest,
    session: Session = Depends(get_db),
) -> list[dict[str, object]]:
    # Reuse the existing SQLite service instead of introducing another ranker.
    try:
        results = search_candidates(payload.query, session, limit=payload.limit)
    except ValueError as error:
        # Surface incompatible or unverifiable embedding metadata as a conflict.
        raise HTTPException(status_code=409, detail=str(error)) from error
    except RuntimeError as error:
        # Surface missing or rejected provider credentials as a temporary service failure.
        raise HTTPException(status_code=503, detail="The configured embedding service is unavailable.") from error
    except httpx.HTTPError as error:
        # Keep network and provider response details out of public error messages.
        raise HTTPException(status_code=503, detail="The configured embedding service is unavailable.") from error
    # Return only retrieved record facts and their Phase 3 cosine scores.
    return [_search_result_payload(result) for result in results]


# Serialize a Phase 3 result without returning resume text or local paths.
def _search_result_payload(result: CandidateSearchResult) -> dict[str, object]:
    # Mark each field as a stored database fact rather than an AI-generated claim.
    return {
        "candidate_id": result.candidate_id,
        "resume_id": result.resume_id,
        "candidate_name": result.candidate_name,
        "skills": result.skills,
        "similarity": result.similarity,
        "source": f"candidate:{result.candidate_id}/resume:{result.resume_id}",
        "fact_type": "retrieved_database_record",
    }


# Return one candidate's stored profile and resume count.
@router.get("/candidates/{candidate_id}", response_model=CandidateResponse)
def get_candidate(candidate_id: int, session: Session = Depends(get_db)) -> CandidateResponse:
    # Load the requested candidate by its stable SQLite key.
    candidate = session.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    # Return the same representation used by candidate listing and creation.
    return _candidate_response(session, candidate)


# Update only explicitly supplied candidate fields and preserve unrelated values.
@router.patch("/candidates/{candidate_id}", response_model=CandidateResponse)
def update_candidate(
    candidate_id: int,
    payload: CandidatePatch,
    session: Session = Depends(get_db),
) -> CandidateResponse:
    # Require a real candidate before validating any requested mutation.
    candidate = session.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    # Prevent a candidate update from claiming another candidate's email identity.
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("email"):
        duplicate = session.scalar(
            select(Candidate).where(
                func.lower(Candidate.email) == changes["email"].casefold(),
                Candidate.id != candidate_id,
            )
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="A candidate with this email already exists.")
    # Apply only fields present in the patch request, including explicit null clears.
    for field_name, value in changes.items():
        setattr(candidate, field_name, value)
    # Record a generic update event with no candidate identity values.
    _record_activity(session, "candidate_updated", "Candidate record updated", "candidate", candidate.id)
    try:
        # Commit the candidate changes and activity record atomically.
        session.commit()
        session.refresh(candidate)
    except Exception:
        # Roll back an invalid or failed candidate update completely.
        session.rollback()
        raise
    # Return the updated stored values.
    return _candidate_response(session, candidate)


# Delete a candidate only when it has no linked resumes unless cascade is explicit.
@router.delete("/candidates/{candidate_id}", status_code=204)
def delete_candidate(
    candidate_id: int,
    cascade: bool = Query(default=False),
    session: Session = Depends(get_db),
) -> None:
    # Require an existing candidate before checking linked source records.
    candidate = session.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    # Count linked resumes so deletion cannot discard source records by accident.
    resume_count = session.scalar(
        select(func.count()).select_from(Resume).where(Resume.candidate_id == candidate_id)
    ) or 0
    if resume_count and not cascade:
        raise HTTPException(
            status_code=409,
            detail="Candidate has linked resumes; pass cascade=true to delete linked resume records.",
        )
    # Store a safe activity event before deleting the candidate identity.
    _record_activity(session, "candidate_deleted", "Candidate record deleted", "candidate", candidate_id)
    try:
        # Let declared ORM cascades remove embeddings and resume rows only after explicit consent.
        session.delete(candidate)
        session.commit()
    except Exception:
        # Roll back the candidate deletion if any database constraint blocks it.
        session.rollback()
        raise
    # Return an empty response body for the successful 204 status.
    return None


# Return every stored resume linked to a candidate, without exposing its local path.
@router.get("/candidates/{candidate_id}/resumes", response_model=list[ResumeResponse])
def list_candidate_resumes(
    candidate_id: int,
    session: Session = Depends(get_db),
) -> list[ResumeResponse]:
    # Verify the parent identity before querying dependent resumes.
    if session.get(Candidate, candidate_id) is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    # Order resumes chronologically and use the privacy-conscious metadata response.
    resumes = session.scalars(
        select(Resume).where(Resume.candidate_id == candidate_id).order_by(Resume.created_at.desc())
    ).all()
    return [_resume_response(resume) for resume in resumes]


# Stream a stored source resume only when its path remains under data/resumes.
@router.get("/resumes/{resume_id}/file")
def download_resume(resume_id: int, session: Session = Depends(get_db)) -> FileResponse:
    # Load the database reference and reject unknown resume identifiers.
    resume = session.get(Resume, resume_id)
    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found.")
    # Resolve source paths and confirm they remain inside the project resume directory.
    resume_path = Path(resume.file_path).resolve()
    resume_root = (PROJECT_ROOT / "data" / "resumes").resolve()
    if resume_root not in resume_path.parents or not resume_path.is_file():
        raise HTTPException(status_code=404, detail="Resume file is unavailable.")
    # Return the original file as an attachment using only its stored display name.
    return FileResponse(resume_path, filename=resume.source_filename)


# Save one uploaded resume without overwriting an existing source file or calling an API.
@router.post("/resumes/upload", status_code=201)
async def upload_resume(
    request: Request,
    filename: str = Header(alias="X-Filename", min_length=1, max_length=512),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    # Normalize browser and Windows path separators before reading only the extension.
    safe_basename = filename.replace("\\", "/").split("/")[-1]
    extension = Path(safe_basename).suffix.lower()
    if extension not in UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Supported resume formats are PDF, DOCX, DOC, and TXT.")
    # Create an isolated random upload directory so source files are never overwritten.
    upload_id = uuid.uuid4().hex
    upload_directory = UPLOAD_ROOT / upload_id
    upload_directory.mkdir(parents=True, exist_ok=False)
    destination = upload_directory / f"resume{extension}"
    byte_count = 0
    try:
        # Open the random destination exclusively to prevent replacement of an existing file.
        with destination.open("xb") as uploaded_file:
            async for chunk in request.stream():
                # Enforce a bounded request size while streaming rather than buffering the whole file.
                byte_count += len(chunk)
                if byte_count > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Resume uploads are limited to 25 MB.")
                # Write each accepted chunk to the new local upload file.
                uploaded_file.write(chunk)
        # Reject empty content so it cannot enter the retry queue as a valid upload.
        if byte_count == 0:
            raise HTTPException(status_code=400, detail="Uploaded resume content is empty.")
        # Add a pending status row without generating an embedding or candidate record.
        status = ResumeIngestionStatus(
            source_path=os.path.normcase(str(destination.resolve())),
            content_sha256=None,
            status="uploaded",
            attempts=0,
        )
        session.add(status)
        # Record a generic event without storing the uploaded filename or candidate identity.
        _record_activity(session, "resume_uploaded", "Resume file uploaded", "ingestion", upload_id)
        session.commit()
        session.refresh(status)
    except HTTPException:
        # Remove only this request's new file and directory when validation rejects the upload.
        session.rollback()
        if destination.exists():
            destination.unlink()
        if upload_directory.exists():
            upload_directory.rmdir()
        raise
    except Exception:
        # Remove this request's new file if its status transaction cannot be committed.
        session.rollback()
        if destination.exists():
            destination.unlink()
        if upload_directory.exists():
            upload_directory.rmdir()
        raise
    # Return a status key so the frontend can explicitly trigger later processing.
    return {"ingestion_id": status.id, "status": status.status, "bytes_received": byte_count}


# Trigger processing for one uploaded file only after external embedding is explicitly confirmed.
@router.post("/ingestion/{ingestion_id}/run", response_model=IngestionStatusResponse)
def trigger_ingestion(
    ingestion_id: int,
    payload: IngestionTrigger,
    session: Session = Depends(get_db),
) -> IngestionStatusResponse:
    # Require a durable upload status row before processing begins.
    status = session.get(ResumeIngestionStatus, ingestion_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Ingestion item not found.")
    # Prevent an upload route from silently sending resume content to OpenRouter.
    if not payload.confirm_external_embedding:
        raise HTTPException(
            status_code=400,
            detail="Set confirm_external_embedding=true to send redacted text to the configured provider.",
        )
    # Permit only uploaded or failed rows to enter processing again.
    if status.status not in {"uploaded", "failed"}:
        raise HTTPException(status_code=409, detail="Only uploaded or failed items can be processed.")
    # Restrict trigger paths to the dedicated upload tree so unrelated files are not imported.
    source_path = Path(status.source_path).resolve()
    upload_root = UPLOAD_ROOT.resolve()
    if upload_root not in source_path.parents or not source_path.is_file():
        raise HTTPException(status_code=404, detail="Uploaded source file is unavailable.")
    # End the request's read transaction before the isolated ingestion service starts writes.
    session.rollback()
    try:
        # Process only this upload's unique directory through the existing ingestion pipeline.
        summary = ingest_resume_folder(
            source_path.parent,
            SessionLocal,
            dry_run=False,
            confirm_writes=True,
        )
    except Exception as error:
        # Return a safe service error without exposing paths, source text, or provider details.
        raise HTTPException(status_code=500, detail=f"Ingestion could not complete ({type(error).__name__}).") from error
    # Reload the file status written atomically by the ingestion service.
    session.expire_all()
    updated_status = session.get(ResumeIngestionStatus, ingestion_id)
    if updated_status is None:
        raise HTTPException(status_code=500, detail="Ingestion status could not be reloaded.")
    # Add a privacy-safe event only after an embedding and canonical records were committed.
    if summary.imported:
        _record_activity(session, "resume_ingested", "Resume ingestion completed", "ingestion", ingestion_id)
        session.commit()
        session.refresh(updated_status)
    # Return the current durable state even when the file failed and can be retried.
    return _ingestion_status_response(updated_status)


# List failed source processing records so recruiters can identify retry work.
@router.get("/ingestion/errors", response_model=list[IngestionStatusResponse])
def list_ingestion_errors(
    limit: int = Query(default=100, ge=1, le=500),
    session: Session = Depends(get_db),
) -> list[IngestionStatusResponse]:
    # Query only safe persisted failure states in most-recent-first order.
    rows = session.scalars(
        select(ResumeIngestionStatus)
        .where(ResumeIngestionStatus.status == "failed")
        .order_by(ResumeIngestionStatus.updated_at.desc())
        .limit(limit)
    ).all()
    # Return retry identifiers and safe error codes without local paths.
    return [_ingestion_status_response(row) for row in rows]


# Retrieve one upload's latest processing status without exposing its filesystem location.
@router.get("/ingestion/{ingestion_id}", response_model=IngestionStatusResponse)
def get_ingestion_status(
    ingestion_id: int,
    session: Session = Depends(get_db),
) -> IngestionStatusResponse:
    # Return a not-found error for unknown ingestion identifiers.
    status = session.get(ResumeIngestionStatus, ingestion_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Ingestion item not found.")
    # Serialize only safe state, attempt, error, and linked record identifiers.
    return _ingestion_status_response(status)


# Retry one previously failed uploaded file after requiring external submission consent again.
@router.post("/ingestion/{ingestion_id}/retry", response_model=IngestionStatusResponse)
def retry_ingestion(
    ingestion_id: int,
    payload: IngestionTrigger,
    session: Session = Depends(get_db),
) -> IngestionStatusResponse:
    # Reuse the exact trigger validation, upload-root guard, and transaction behavior.
    return trigger_ingestion(ingestion_id, payload, session)


# Return managed jobs with optional title or status filtering.
@router.get("/jobs", response_model=list[JobResponse])
def list_jobs(
    q: str | None = Query(default=None, max_length=255),
    status: str | None = Query(default=None, max_length=32),
    limit: int = Query(default=100, ge=1, le=500),
    session: Session = Depends(get_db),
) -> list[JobResponse]:
    # Order by job key so pagination remains repeatable.
    statement = select(Job).order_by(Job.id.asc())
    # Apply case-insensitive title search when a recruiter supplies a query.
    if q and q.strip():
        statement = statement.where(func.lower(Job.title).like(f"%{q.strip().casefold()}%"))
    # Apply an explicit lifecycle filter when supplied.
    if status:
        statement = statement.where(func.lower(Job.status) == status.casefold())
    # Return only the requested bounded page.
    return [_job_response(job) for job in session.scalars(statement.limit(limit)).all()]


# Create one recruiter-managed job description.
@router.post("/jobs", response_model=JobResponse, status_code=201)
def create_job(payload: JobWrite, session: Session = Depends(get_db)) -> JobResponse:
    # Store validated requirements as first-class SQLite job data.
    job = Job(**payload.model_dump())
    session.add(job)
    session.flush()
    # Record a generic activity label that does not include confidential job text.
    _record_activity(session, "job_created", "Job record created", "job", job.id)
    try:
        # Commit the job and dashboard activity event atomically.
        session.commit()
        session.refresh(job)
    except Exception:
        # Roll back the complete write if database constraints reject it.
        session.rollback()
        raise
    # Return the saved job facts and requirements.
    return _job_response(job)


# Return one managed job by ID.
@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: int, session: Session = Depends(get_db)) -> JobResponse:
    # Load the requested job or report an ordinary not-found response.
    job = session.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    # Return the same representation used by listing and creation.
    return _job_response(job)


# Partially update a job while preserving all omitted fields.
@router.patch("/jobs/{job_id}", response_model=JobResponse)
def update_job(job_id: int, payload: JobPatch, session: Session = Depends(get_db)) -> JobResponse:
    # Require an existing job before applying any changes.
    job = session.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    # Merge supplied values with current experience fields and validate their ordering.
    changes = payload.model_dump(exclude_unset=True)
    minimum = changes.get("min_experience_years", job.min_experience_years)
    maximum = changes.get("max_experience_years", job.max_experience_years)
    if minimum is not None and maximum is not None and minimum > maximum:
        raise HTTPException(status_code=422, detail="Minimum experience cannot exceed maximum experience.")
    # Apply only caller-supplied job attributes.
    for field_name, value in changes.items():
        setattr(job, field_name, value)
    # Record a generic job update without including job description text.
    _record_activity(session, "job_updated", "Job record updated", "job", job.id)
    try:
        # Commit the job mutation and activity event atomically.
        session.commit()
        session.refresh(job)
    except Exception:
        # Roll back all job changes when a constraint or database operation fails.
        session.rollback()
        raise
    # Return the persisted managed job representation.
    return _job_response(job)


# Delete a job only after resolving linked recruitment requests explicitly.
@router.delete("/jobs/{job_id}", status_code=204)
def delete_job(
    job_id: int,
    unlink_requests: bool = Query(default=False),
    session: Session = Depends(get_db),
) -> None:
    # Require an existing job before checking any request relationships.
    job = session.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    # Find requests that would lose their job link during deletion.
    linked_requests = session.scalars(select(RecruitmentRequest).where(RecruitmentRequest.job_id == job_id)).all()
    if linked_requests and not unlink_requests:
        raise HTTPException(status_code=409, detail="Job has linked requests; pass unlink_requests=true to preserve them without the job link.")
    # Preserve requests while explicitly clearing only their foreign-key association.
    for request_record in linked_requests:
        request_record.job_id = None
    # Add a safe activity event before removing the managed job row.
    _record_activity(session, "job_deleted", "Job record deleted", "job", job_id)
    try:
        # Commit request unlinking and job deletion atomically.
        session.delete(job)
        session.commit()
    except Exception:
        # Restore both job and request relationships if deletion fails.
        session.rollback()
        raise
    # Return an empty response for the successful 204 status.
    return None


# Match a managed job against resumes through the existing Phase 3 semantic service.
@router.get("/jobs/{job_id}/matches", response_model=list[dict[str, object]])
def match_job_candidates(
    job_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_db),
) -> list[dict[str, object]]:
    # Require a stored job before constructing the search query.
    job = session.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    # Build retrieval text only from stored job title, description, and required skills.
    query = "\n".join(
        [job.title, job.description, "Required skills: " + ", ".join(job.required_skills or [])]
    )
    try:
        # Reuse the existing Phase 3 embedding compatibility checks and ranking logic.
        matches = search_candidates(query, session, limit=limit)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail="The configured embedding service is unavailable.") from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=503, detail="The configured embedding service is unavailable.") from error
    # Return per-resume similarity records grounded in candidate and resume IDs.
    return [_search_result_payload(match) for match in matches]


# Return recruitment requests with optional text and status filters.
@router.get("/requests", response_model=list[RequestResponse])
def list_requests(
    q: str | None = Query(default=None, max_length=255),
    status: str | None = Query(default=None, max_length=32),
    limit: int = Query(default=100, ge=1, le=500),
    session: Session = Depends(get_db),
) -> list[RequestResponse]:
    # Build a stable query over stored requisition rows.
    statement = select(RecruitmentRequest).order_by(RecruitmentRequest.id.asc())
    # Filter by request number, role title, or non-personal notes where requested.
    if q and q.strip():
        needle = f"%{q.strip().casefold()}%"
        statement = statement.where(
            or_(
                func.lower(RecruitmentRequest.req_number).like(needle),
                func.lower(RecruitmentRequest.role_title).like(needle),
                func.lower(RecruitmentRequest.notes).like(needle),
            )
        )
    # Filter by lifecycle state when the client provides one.
    if status:
        statement = statement.where(func.lower(RecruitmentRequest.status) == status.casefold())
    # Return a bounded collection of real SQLite requests.
    return [_request_response(record) for record in session.scalars(statement.limit(limit)).all()]


# Create one recruitment request with a generated unique request number when omitted.
@router.post("/requests", response_model=RequestResponse, status_code=201)
def create_request(payload: RequestWrite, session: Session = Depends(get_db)) -> RequestResponse:
    # Require any supplied job link to reference a managed job.
    if payload.job_id is not None and session.get(Job, payload.job_id) is None:
        raise HTTPException(status_code=404, detail="Linked job not found.")
    # Generate a non-personal unique request key when the caller leaves it blank.
    request_values = payload.model_dump()
    request_values["req_number"] = request_values["req_number"] or f"REQ-{date.today().year}-{uuid.uuid4().hex[:8].upper()}"
    # Reject an explicitly supplied request number that already exists.
    if session.scalar(select(RecruitmentRequest.id).where(RecruitmentRequest.req_number == request_values["req_number"])):
        raise HTTPException(status_code=409, detail="Request number already exists.")
    # Store the validated requisition and safe activity record in one transaction.
    record = RecruitmentRequest(**request_values)
    session.add(record)
    session.flush()
    _record_activity(session, "request_created", "Recruitment request created", "request", record.id)
    try:
        # Commit the request and its activity marker atomically.
        session.commit()
        session.refresh(record)
    except Exception:
        # Roll back both rows if the request write fails.
        session.rollback()
        raise
    # Return only stored request facts.
    return _request_response(record)


# Return one recruitment request by its stable database identifier.
@router.get("/requests/{request_id}", response_model=RequestResponse)
def get_request(request_id: int, session: Session = Depends(get_db)) -> RequestResponse:
    # Load the requested row or return a not-found response.
    record = session.get(RecruitmentRequest, request_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Recruitment request not found.")
    # Return the same normalized representation used by list and create routes.
    return _request_response(record)


# Partially update a request and validate capacity plus any linked job.
@router.patch("/requests/{request_id}", response_model=RequestResponse)
def update_request(
    request_id: int,
    payload: RequestPatch,
    session: Session = Depends(get_db),
) -> RequestResponse:
    # Require a valid request before applying recruiter changes.
    record = session.get(RecruitmentRequest, request_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Recruitment request not found.")
    # Preserve omitted values and validate the resulting target/fill relationship.
    changes = payload.model_dump(exclude_unset=True)
    target = changes.get("target_positions", record.target_positions)
    filled = changes.get("filled_positions", record.filled_positions)
    if target is not None and filled is not None and filled > target:
        raise HTTPException(status_code=422, detail="Filled positions cannot exceed target positions.")
    # Require an updated linked job to exist before applying the foreign key.
    if changes.get("job_id") is not None and session.get(Job, changes["job_id"]) is None:
        raise HTTPException(status_code=404, detail="Linked job not found.")
    # Apply only the values the recruiter explicitly supplied.
    for field_name, value in changes.items():
        setattr(record, field_name, value)
    # Record a non-personal status-change event for the dashboard timeline.
    _record_activity(session, "request_updated", "Recruitment request updated", "request", record.id)
    try:
        # Commit the request and activity update as one database transaction.
        session.commit()
        session.refresh(record)
    except Exception:
        # Roll back the complete request update on database failure.
        session.rollback()
        raise
    # Return the updated persisted request.
    return _request_response(record)


# Return real database totals and recent privacy-safe activity events.
@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(session: Session = Depends(get_db)) -> DashboardResponse:
    # Query entity counts directly from their SQLite tables.
    candidate_count = session.scalar(select(func.count()).select_from(Candidate)) or 0
    resume_count = session.scalar(select(func.count()).select_from(Resume)) or 0
    job_count = session.scalar(select(func.count()).select_from(Job)) or 0
    # Count positions whose operational status is actively recruiting ("Active").
    active_job_count = session.scalar(
        select(func.count()).select_from(Job).where(Job.status.in_(("Active", "active")))
    ) or 0
    open_request_count = session.scalar(
        select(func.count()).select_from(RecruitmentRequest).where(
            func.lower(RecruitmentRequest.status).not_in(("filled", "closed", "cancelled"))
        )
    ) or 0
    # Aggregate persisted ingestion statuses into imported, failed, and pending totals.
    imported_count = session.scalar(
        select(func.count()).select_from(ResumeIngestionStatus).where(ResumeIngestionStatus.status == "imported")
    ) or 0
    failed_count = session.scalar(
        select(func.count()).select_from(ResumeIngestionStatus).where(ResumeIngestionStatus.status == "failed")
    ) or 0
    pending_count = session.scalar(
        select(func.count()).select_from(ResumeIngestionStatus).where(
            ResumeIngestionStatus.status.in_(("uploaded", "pending"))
        )
    ) or 0
    # Return only safe event summaries and entity keys in newest-first order.
    recent_rows = session.scalars(
        select(ActivityEvent).order_by(ActivityEvent.created_at.desc()).limit(10)
    ).all()
    recent_activity = [
        {
            "id": event.id,
            "event_type": event.event_type,
            "summary": event.summary,
            "entity_type": event.entity_type,
            "entity_id": event.entity_id,
            "created_at": event.created_at.isoformat(),
        }
        for event in recent_rows
    ]
    # Return actual SQLite-backed counts without frontend mock values.
    return DashboardResponse(
        total_candidates=candidate_count,
        total_resumes=resume_count,
        total_jobs=job_count,
        active_jobs=active_job_count,
        open_requests=open_request_count,
        ingestion_imported=imported_count,
        ingestion_failed=failed_count,
        ingestion_pending=pending_count,
        recent_activity=recent_activity,
    )


# Return grounded candidate retrieval facts and explicit filter/inference labels.
@router.post("/assistant/query")
def assistant_query(payload: AssistantQuery, session: Session = Depends(get_db)) -> dict[str, object]:
    # Start from the user's exact request and add stored role context only when requested.
    query_parts = [payload.query]
    if payload.job_id is not None:
        # Require the job context to exist before using any of its stored fields.
        job = session.get(Job, payload.job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found.")
        query_parts.extend([job.title, "Required skills: " + ", ".join(job.required_skills or []), job.description])
    if payload.request_id is not None:
        # Require the requisition context to exist before using its role or job link.
        request_record = session.get(RecruitmentRequest, payload.request_id)
        if request_record is None:
            raise HTTPException(status_code=404, detail="Recruitment request not found.")
        query_parts.append(request_record.role_title)
        if request_record.job_id is not None:
            linked_job = session.get(Job, request_record.job_id)
            if linked_job is not None:
                query_parts.extend([linked_job.title, "Required skills: " + ", ".join(linked_job.required_skills or [])])
    # Keep the full context for semantic ranking while parsing structured filters from the user's words only.
    semantic_query = "\n".join(query_parts)
    requested_skills = parse_resume_profile(payload.query).skills
    experience_match = _MIN_EXPERIENCE_PATTERN.search(payload.query)
    minimum_experience = float(experience_match.group(1)) if experience_match else None
    try:
        # Retrieve resume-level similarities through the existing Phase 3 service.
        matches = search_candidates(semantic_query, session, limit=max(payload.limit, 50))
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail="The configured embedding service is unavailable.") from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=503, detail="The configured embedding service is unavailable.") from error
    # Apply exact skill filters against stored candidate skill facts when the query names known skills.
    if requested_skills:
        requested_keys = {skill.casefold() for skill in requested_skills}
        matches = [
            match
            for match in matches
            if requested_keys.issubset({skill.casefold() for skill in match.skills})
        ]
    # Apply explicit minimum experience only to candidates with stored numeric experience.
    if minimum_experience is not None:
        eligible_candidate_ids = set(
            session.scalars(
                select(Candidate.id).where(Candidate.experience_years >= minimum_experience)
            ).all()
        )
        matches = [match for match in matches if match.candidate_id in eligible_candidate_ids]
    # Keep the final result bounded after structured filters.
    matches = matches[: payload.limit]
    # Describe missing experience data explicitly instead of inferring an eligibility answer.
    missing_experience_note = (
        "Candidates with missing experience values were excluded from the requested experience filter."
        if minimum_experience is not None
        else None
    )
    # Return a deterministic grounded response with candidate/resume citations, not generated claims.
    return {
        "answer": f"Retrieved {len(matches)} resume records from SQLite.",
        "retrieved_facts": [_search_result_payload(match) for match in matches],
        "applied_skill_filters": list(requested_skills),
        "minimum_experience_years": minimum_experience,
        "notes": [missing_experience_note] if missing_experience_note else [],
        "inferences": [],
        "source": "SQLite candidate and resume records ranked by the Phase 3 semantic search service.",
    }
