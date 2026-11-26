"""Candidate resume embedding coverage auditing and batch backfill service."""

# Import hashlib for SHA-256 content hashing.
import hashlib
# Import datetime and timezone for audit timestamps.
from datetime import datetime, timezone
# Import Path for filesystem checks.
from pathlib import Path
# Import typing helpers.
from typing import Any, Callable, Dict, List, Optional, Sequence
# Import SQLAlchemy select and func.
from sqlalchemy import func, select
# Import Session from SQLAlchemy.
from sqlalchemy.orm import Session

# Import Candidate and Resume ORM models.
from database.models import Candidate, Resume, ResumeEmbedding
# Import embedding storage and validation functions.
from database.embedding_storage import store_resume_embedding, validate_embedding_vector
# Import OpenRouter/Ollama embedding service and constants.
from app.ai.config import ai_config
from app.embedding_service import generate_embedding
# Import resume document parser.
from app.resume_extractor import extract_resume_text
# Import privacy redaction utilities from resume pipeline.
from app.resume_pipeline import redact_pii, validate_outbound_text

# In-memory tracking cache for the latest candidate backfill execution.
_LAST_BACKFILL_STATUS: Dict[str, Any] = {
    "status": "idle",
    "last_run_at": None,
    "batch_size": 0,
    "processed_count": 0,
    "generated_count": 0,
    "reused_count": 0,
    "skipped_count": 0,
    "failed_count": 0,
    "remaining_missing": 0,
    "errors": [],
}


def compute_text_hash(text: str) -> str:
    """Compute standard SHA-256 hexadecimal digest for raw or redacted text."""
    # Encode UTF-8 text and return 64-character lowercase hex digest with surrogate safety.
    safe_bytes = (text or "").encode("utf-8", "ignore")
    return hashlib.sha256(safe_bytes).hexdigest()


def get_candidate_embedding_coverage(db: Session) -> Dict[str, Any]:
    """Audit total candidates, resumes, and embedding coverage with integrity validation."""
    # Query total registered candidate profiles.
    total_candidates = db.scalar(select(func.count(Candidate.id))) or 0

    # Query total registered resume records.
    total_resumes = db.scalar(select(func.count(Resume.id))) or 0

    # Query total stored resume embeddings.
    total_embeddings = db.scalar(select(func.count(ResumeEmbedding.id))) or 0

    # Query resumes that currently have an associated embedding row.
    embedded_resumes_count = db.scalar(
        select(func.count(func.distinct(ResumeEmbedding.resume_id)))
    ) or 0

    # Calculate missing embeddings.
    missing_count = max(0, total_resumes - embedded_resumes_count)

    # Detect incompatible models or dimensions in existing embeddings.
    incompatible_records = db.scalars(
        select(ResumeEmbedding).where(
            (ResumeEmbedding.model_name != ai_config.embedding_model)
            | (ResumeEmbedding.dimensions != ai_config.embedding_dimensions)
        )
    ).all()
    incompatible_count = len(incompatible_records)

    # Query latest embedding generation timestamp.
    latest_embedding = db.scalars(
        select(ResumeEmbedding).order_by(ResumeEmbedding.created_at.desc()).limit(1)
    ).first()
    last_generated_at = latest_embedding.created_at.isoformat() if latest_embedding and latest_embedding.created_at else None

    # Calculate coverage percentage safely without zero-division.
    coverage_pct = round((embedded_resumes_count / total_resumes) * 100, 2) if total_resumes > 0 else 0.0

    # Determine operational readiness state.
    is_complete = (missing_count == 0 and incompatible_count == 0 and total_resumes > 0)
    status_label = "complete" if is_complete else ("partial" if embedded_resumes_count > 0 else "pending")

    return {
        "status": status_label,
        "is_complete": is_complete,
        "total_candidates": total_candidates,
        "total_resumes": total_resumes,
        "total_embeddings": total_embeddings,
        "embedded_resumes": embedded_resumes_count,
        "missing_embeddings": missing_count,
        "incompatible_embeddings": incompatible_count,
        "coverage_percentage": coverage_pct,
        "configured_model": ai_config.embedding_model,
        "configured_dimensions": ai_config.embedding_dimensions,
        "last_generated_at": last_generated_at,
    }


def get_missing_candidate_embeddings(db: Session, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieve metadata descriptors for resumes lacking embeddings without exposing PII."""
    # Formulate join query finding resumes without an associated resume_embedding record.
    stmt = (
        select(Resume)
        .outerjoin(ResumeEmbedding, Resume.id == ResumeEmbedding.resume_id)
        .where(ResumeEmbedding.id.is_(None))
        .order_by(Resume.id.asc())
        .limit(max(1, min(limit, 200)))
    )
    unembedded_resumes = db.scalars(stmt).all()

    results: List[Dict[str, Any]] = []
    for r in unembedded_resumes:
        # Check whether the source file exists on disk.
        file_path_obj = Path(r.file_path) if r.file_path else None
        has_disk_file = file_path_obj is not None and file_path_obj.is_file()

        # Append non-sensitive resume metadata.
        results.append({
            "resume_id": r.id,
            "candidate_id": r.candidate_id,
            "source_filename": r.source_filename,
            "has_file_on_disk": has_disk_file,
            "content_sha256": r.content_sha256,
        })

    return results


def prepare_resume_embedding_text(resume: Resume, candidate: Optional[Candidate] = None) -> str:
    """Extract, redact, and prepare clean outbound text for a candidate resume."""
    raw_text = ""
    # Attempt extraction from disk file if available.
    if resume.file_path:
        file_path_obj = Path(resume.file_path)
        if file_path_obj.is_file():
            try:
                extraction = extract_resume_text(file_path_obj)
                raw_text = extraction.get("text", "")
            except Exception:
                raw_text = ""

    # Fallback to candidate profile facts if document file is unreadable.
    if not raw_text or not raw_text.strip():
        cand = candidate or resume.candidate
        if cand:
            skills_str = ", ".join(cand.skills or [])
            raw_text = (
                f"Professional Profile: {cand.name or 'Candidate'}\n"
                f"Primary Skills: {skills_str}\n"
                f"Experience: {cand.experience_years or 0} years\n"
                f"Location: {cand.location or 'Unspecified'}\n"
                f"Summary: {cand.summary or ''}"
            )
        else:
            raw_text = f"Candidate Resume Document: {resume.source_filename}"

    # Identify candidate identifiers for PII redaction.
    cand = candidate or resume.candidate
    identifiers: List[str] = []
    if cand:
        if cand.name and len(cand.name.strip()) >= 2:
            identifiers.append(cand.name.strip())
        if cand.email and len(cand.email.strip()) >= 2:
            identifiers.append(cand.email.strip())
        phone_val = getattr(cand, "phone", None)
        if phone_val and len(str(phone_val).strip()) >= 2:
            identifiers.append(str(phone_val).strip())

    # Apply standard privacy redaction and sanitize outbound text.
    sanitized_text = validate_outbound_text(redact_pii(raw_text, tuple(identifiers)))
    return sanitized_text


def backfill_candidate_embeddings(
    db: Session,
    batch_size: int = 15,
    embedding_provider: Optional[Callable[[str], Sequence[int | float]]] = None,
    force: bool = False,
) -> Dict[str, Any]:
    """Execute idempotent, batch-controlled backfill of missing candidate embeddings."""
    # Resolve provider function (defaults to OpenRouter generate_embedding).
    provider = embedding_provider or generate_embedding
    # Resolve model name safely.
    raw_model = getattr(provider, "model_name", None)
    if isinstance(raw_model, str) and raw_model.strip():
        model_name = raw_model.strip()
    else:
        model_name = ai_config.embedding_model

    # Query candidate resumes lacking an embedding record.
    stmt = (
        select(Resume)
        .outerjoin(ResumeEmbedding, Resume.id == ResumeEmbedding.resume_id)
        .where(ResumeEmbedding.id.is_(None))
        .order_by(Resume.id.asc())
        .limit(max(1, min(batch_size, 100)))
    )
    targets = list(db.scalars(stmt).all())

    # Initialize tracking metrics.
    processed_count = 0
    generated_count = 0
    reused_count = 0
    skipped_count = 0
    failed_count = 0
    errors: List[Dict[str, Any]] = []

    for resume in targets:
        processed_count += 1
        try:
            # Query candidate parent.
            cand = resume.candidate
            # Prepare privacy-redacted, normalized embedding input.
            prepared_text = prepare_resume_embedding_text(resume, cand)
            input_hash = compute_text_hash(prepared_text)

            # Check for existing record if force is False.
            existing = db.scalar(
                select(ResumeEmbedding).where(ResumeEmbedding.resume_id == resume.id)
            )
            if existing and existing.input_hash == input_hash and not force:
                skipped_count += 1
                continue

            # Check if an identical vector exists in resume_embedding to reuse vector without API call.
            compatible = db.scalars(
                select(ResumeEmbedding).where(
                    ResumeEmbedding.input_hash == input_hash,
                    ResumeEmbedding.model_name == model_name,
                    ResumeEmbedding.dimensions == ai_config.embedding_dimensions,
                ).limit(1)
            ).first()

            if compatible and compatible.embedding_vector and not force:
                # Reuse existing vector.
                store_resume_embedding(
                    session=db,
                    resume_id=resume.id,
                    vector=compatible.embedding_vector,
                    dimensions=ai_config.embedding_dimensions,
                    input_hash=input_hash,
                    requested_model=model_name,
                    returned_model=model_name,
                    generation_method="ollama",
                    preprocessing_version="resume-pii-redaction-v1",
                    metadata={"source": "backfill_reuse", "compatible_source_id": compatible.id},
                )
                reused_count += 1
            else:
                # Generate vector using provider.
                raw_vector = provider(prepared_text)
                validated_vector = validate_embedding_vector(raw_vector, dimensions=ai_config.embedding_dimensions)
                store_resume_embedding(
                    session=db,
                    resume_id=resume.id,
                    vector=validated_vector,
                    dimensions=ai_config.embedding_dimensions,
                    input_hash=input_hash,
                    requested_model=model_name,
                    returned_model=model_name,
                    generation_method="ollama",
                    preprocessing_version="resume-pii-redaction-v1",
                    metadata={"source": "backfill_generation", "privacy_redacted": True},
                )
                generated_count += 1

            # Commit individual item transaction to make backfill resumable and resilient.
            db.commit()

        except Exception as exc:
            # Rollback failed item transaction.
            db.rollback()
            failed_count += 1
            errors.append({
                "resume_id": resume.id,
                "candidate_id": resume.candidate_id,
                "error": str(exc),
            })

    # Query remaining missing embeddings count.
    remaining_missing = db.scalar(
        select(func.count(Resume.id))
        .outerjoin(ResumeEmbedding, Resume.id == ResumeEmbedding.resume_id)
        .where(ResumeEmbedding.id.is_(None))
    ) or 0

    # Determine overall batch status.
    batch_status = "completed" if failed_count == 0 else ("partial" if (generated_count + reused_count) > 0 else "failed")

    # Update in-memory tracking status cache.
    global _LAST_BACKFILL_STATUS
    _LAST_BACKFILL_STATUS = {
        "status": batch_status,
        "last_run_at": datetime.now(timezone.utc).isoformat(),
        "batch_size": batch_size,
        "processed_count": processed_count,
        "generated_count": generated_count,
        "reused_count": reused_count,
        "skipped_count": skipped_count,
        "failed_count": failed_count,
        "remaining_missing": remaining_missing,
        "errors": errors,
    }

    return {
        "status": batch_status,
        "processed_count": processed_count,
        "generated_count": generated_count,
        "reused_count": reused_count,
        "skipped_count": skipped_count,
        "failed_count": failed_count,
        "remaining_missing": remaining_missing,
        "model_name": model_name,
        "dimensions": 2048,
        "errors": errors,
    }


def get_backfill_status(db: Session) -> Dict[str, Any]:
    """Retrieve the current backfill status and live remaining missing count."""
    # Query remaining missing count from SQLite.
    remaining_missing = db.scalar(
        select(func.count(Resume.id))
        .outerjoin(ResumeEmbedding, Resume.id == ResumeEmbedding.resume_id)
        .where(ResumeEmbedding.id.is_(None))
    ) or 0

    status_data = dict(_LAST_BACKFILL_STATUS)
    status_data["remaining_missing"] = remaining_missing
    return status_data
