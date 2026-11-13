# Import hashlib to compute SHA-256 digests for text deduplication.
import hashlib
# Import typing helpers for signatures.
from typing import Any, Callable, Dict, List, Optional, Sequence
# Import SQLAlchemy select and Session.
from sqlalchemy import select
from sqlalchemy.orm import Session
# Import embedding generation and configuration.
from app.embedding_service import OPENROUTER_EMBEDDING_MODEL, generate_embedding
# Import vector validation and storage helpers.
from database.embedding_storage import (
    find_compatible_job_embedding_by_hash,
    store_job_embedding,
    validate_embedding_vector,
)
# Import database models.
from database.models import Job, JDSegmentation, JobRequirement, JobEmbedding


# Build the normalized text representation for the full job description scope.
def build_full_jd_embedding_text(job: Job, segmentation: JDSegmentation) -> str:
    # Extract job overview text.
    overview = (segmentation.job_overview or "").strip()
    # Extract role summary text.
    summary = (segmentation.role_summary or "").strip()
    # Collect all approved mandatory requirement or skill statements.
    mandatory_reqs = [
        (r.normalized_skill or r.original_text).strip()
        for r in segmentation.requirements
        if r.classification == "Mandatory" and (r.normalized_skill or r.original_text)
    ]
    # Assemble header components.
    parts: List[str] = [f"Job Title: {job.title}"]
    if overview:
        parts.append(f"Job Overview: {overview}")
    if summary:
        parts.append(f"Role Summary: {summary}")
    if mandatory_reqs:
        # Join unique mandatory requirements.
        unique_mandatory = list(dict.fromkeys(mandatory_reqs))
        parts.append("Mandatory Requirements:\n" + "\n".join(f"- {item}" for item in unique_mandatory))
    # Combine sections with standard spacing.
    return "\n\n".join(parts).strip()


# Build the normalized text representation for a single granular requirement.
def build_requirement_embedding_text(requirement: JobRequirement) -> str:
    # Format category and classification headers.
    lines: List[str] = [
        f"Category: {requirement.category}",
        f"Classification: {requirement.classification}",
        f"Requirement: {requirement.original_text.strip()}",
    ]
    # Append supporting evidence quote if verified and available.
    if requirement.evidence and requirement.evidence.strip():
        lines.append(f"Evidence: {requirement.evidence.strip()}")
    # Combine into normalized multiline string.
    return "\n".join(lines).strip()


# Compute the standard 64-character SHA-256 digest of normalized text.
def compute_text_sha256(text: str) -> str:
    # Encode normalized string to utf-8 bytes and compute hexadecimal digest.
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


# Retrieve the active approved segmentation for an operational job (highest approved version).
def get_active_approved_segmentation(db: Session, job_id: int) -> Optional[JDSegmentation]:
    # Query segmentation records for this job ordered by version descending.
    stmt = (
        select(JDSegmentation)
        .where(
            JDSegmentation.job_id == job_id,
            JDSegmentation.is_approved == 1,
            JDSegmentation.status == "approved",
        )
        .order_by(JDSegmentation.version.desc())
    )
    # Return the first matching approved segmentation record.
    return db.scalars(stmt).first()


# Generate and store embedding vectors for an approved segmentation.
def generate_segmentation_embeddings(
    db: Session,
    segmentation_id: int,
    embedding_provider: Optional[Callable[[str], Sequence[int | float]]] = None,
    force: bool = False,
) -> Dict[str, Any]:
    # Retrieve target segmentation.
    segmentation = db.get(JDSegmentation, segmentation_id)
    if not segmentation:
        raise ValueError(f"Segmentation with ID {segmentation_id} not found.")

    # Guard: Strictly reject unapproved or pending segmentations from active embedding generation.
    if segmentation.is_approved != 1 or segmentation.status != "approved":
        raise ValueError(
            f"Segmentation {segmentation_id} is in status '{segmentation.status}' (is_approved={segmentation.is_approved}). "
            "Embeddings can only be generated from explicitly approved segmentations."
        )

    # Confirm parent job exists.
    job = segmentation.job
    if not job:
        job = db.get(Job, segmentation.job_id)
    if not job:
        raise ValueError(f"Job with ID {segmentation.job_id} not found.")

    # Select embedding provider function (defaults to OpenRouter generate_embedding).
    provider = embedding_provider or generate_embedding
    # Read model name from provider metadata if it is a valid non-empty string, otherwise use default model.
    raw_model = getattr(provider, "model_name", None)
    if isinstance(raw_model, str) and raw_model.strip():
        model_name = raw_model.strip()
    else:
        model_name = OPENROUTER_EMBEDDING_MODEL

    # Track operational counters.
    generated_count = 0
    reused_count = 0
    skipped_count = 0
    failed_count = 0
    records_saved: List[JobEmbedding] = []

    # -------------------------------------------------------------
    # 1. Full JD Scope Embedding
    # -------------------------------------------------------------
    full_text = build_full_jd_embedding_text(job, segmentation)
    full_hash = compute_text_sha256(full_text)
    full_type = "full_jd"

    # Check if this exact segmentation already has a valid full JD embedding.
    existing_full = db.scalars(
        select(JobEmbedding).where(
            JobEmbedding.segmentation_id == segmentation.id,
            JobEmbedding.embedding_type == full_type,
            JobEmbedding.requirement_id.is_(None),
        )
    ).first()

    if existing_full and existing_full.input_hash == full_hash and not force:
        # Content unchanged and force flag not set: skip generation.
        skipped_count += 1
        records_saved.append(existing_full)
    else:
        # Check if an identical vector already exists anywhere in the database by hash.
        compatible = find_compatible_job_embedding_by_hash(db, full_hash, model_name=model_name)
        if compatible and compatible.embedding_vector:
            # Reuse existing vector without an external API call.
            stored_record = store_job_embedding(
                session=db,
                job_id=job.id,
                segmentation_id=segmentation.id,
                embedding_type=full_type,
                input_hash=full_hash,
                vector=compatible.embedding_vector,
                requirement_id=None,
                dimensions=2048,
                model_name=model_name,
            )
            reused_count += 1
            records_saved.append(stored_record)
        else:
            # Generate new vector via OpenRouter provider.
            try:
                vector = provider(full_text)
                stored_record = store_job_embedding(
                    session=db,
                    job_id=job.id,
                    segmentation_id=segmentation.id,
                    embedding_type=full_type,
                    input_hash=full_hash,
                    vector=vector,
                    requirement_id=None,
                    dimensions=2048,
                    model_name=model_name,
                )
                generated_count += 1
                records_saved.append(stored_record)
            except Exception as exc:
                failed_count += 1
                raise RuntimeError(f"Failed to generate full JD embedding: {exc}") from exc

    # -------------------------------------------------------------
    # 2. Granular Requirement Embeddings
    # -------------------------------------------------------------
    for req in segmentation.requirements:
        req_text = build_requirement_embedding_text(req)
        req_hash = compute_text_sha256(req_text)
        req_type = "mandatory_requirement" if req.classification == "Mandatory" else "preferred_requirement"

        # Check if an embedding for this specific requirement already exists.
        existing_req = db.scalars(
            select(JobEmbedding).where(
                JobEmbedding.segmentation_id == segmentation.id,
                JobEmbedding.requirement_id == req.id,
            )
        ).first()

        if existing_req and existing_req.input_hash == req_hash and not force:
            # Content matches and force flag is off: skip re-embedding.
            skipped_count += 1
            records_saved.append(existing_req)
            continue

        # Look for cross-database hash compatibility to reuse existing vector coordinates.
        compatible_req = find_compatible_job_embedding_by_hash(db, req_hash, model_name=model_name)
        if compatible_req and compatible_req.embedding_vector:
            # Reuse existing vector coordinates without API request.
            stored_req = store_job_embedding(
                session=db,
                job_id=job.id,
                segmentation_id=segmentation.id,
                embedding_type=req_type,
                input_hash=req_hash,
                vector=compatible_req.embedding_vector,
                requirement_id=req.id,
                dimensions=2048,
                model_name=model_name,
            )
            reused_count += 1
            records_saved.append(stored_req)
        else:
            # Generate fresh requirement vector coordinates via provider.
            try:
                raw_vector = provider(req_text)
                stored_req = store_job_embedding(
                    session=db,
                    job_id=job.id,
                    segmentation_id=segmentation.id,
                    embedding_type=req_type,
                    input_hash=req_hash,
                    vector=raw_vector,
                    requirement_id=req.id,
                    dimensions=2048,
                    model_name=model_name,
                )
                generated_count += 1
                records_saved.append(stored_req)
            except Exception as exc:
                failed_count += 1
                raise RuntimeError(f"Failed to generate requirement embedding (ID {req.id}): {exc}") from exc

    # Commit all changes atomically.
    db.commit()

    # Format output metadata objects without leaking raw embedding coordinate vectors.
    metadata_list = [
        {
            "id": r.id,
            "job_id": r.job_id,
            "segmentation_id": r.segmentation_id,
            "requirement_id": r.requirement_id,
            "embedding_type": r.embedding_type,
            "input_hash": r.input_hash,
            "model_name": r.model_name,
            "dimensions": r.dimensions,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records_saved
    ]

    return {
        "status": "success",
        "job_id": job.id,
        "segmentation_id": segmentation.id,
        "version": segmentation.version,
        "total_items": 1 + len(segmentation.requirements),
        "generated_count": generated_count,
        "reused_count": reused_count,
        "skipped_count": skipped_count,
        "failed_count": failed_count,
        "embeddings": metadata_list,
    }


# Retrieve comprehensive embedding status and data integrity validation for a job's active approved segmentation.
def get_job_embedding_status(db: Session, job_id: int) -> Dict[str, Any]:
    """Retrieve strict embedding status, completeness, model compliance, and hash staleness."""
    # Retrieve the parent operational job record from SQLite.
    job = db.get(Job, job_id)
    # Reject unknown job identifiers safely without crashing.
    if not job:
        return {
            "job_id": job_id,
            "has_approved_segmentation": False,
            "has_embeddings": False,
            "is_complete": False,
            "status": "job_not_found",
            "message": f"Job ID {job_id} not found in database.",
            "total_embeddings": 0,
            "total_requirements": 0,
            "expected_embeddings": 0,
            "missing_requirement_ids": [],
            "unexpected_requirement_ids": [],
            "duplicate_count": 0,
            "stale_count": 0,
            "invalid_model_count": 0,
            "invalid_dimension_count": 0,
            "model_name": OPENROUTER_EMBEDDING_MODEL,
            "dimensions": 2048,
            "last_generated_at": None,
        }

    # Identify the latest recruiter-approved segmentation for this job.
    active_seg = get_active_approved_segmentation(db, job_id)
    # Return clear missing approved segmentation status if no approved version exists.
    if not active_seg:
        return {
            "job_id": job_id,
            "has_approved_segmentation": False,
            "has_embeddings": False,
            "is_complete": False,
            "status": "no_approved_segmentation",
            "message": "No recruiter-approved segmentation found for this job.",
            "total_embeddings": 0,
            "total_requirements": 0,
            "expected_embeddings": 0,
            "missing_requirement_ids": [],
            "unexpected_requirement_ids": [],
            "duplicate_count": 0,
            "stale_count": 0,
            "invalid_model_count": 0,
            "invalid_dimension_count": 0,
            "model_name": OPENROUTER_EMBEDDING_MODEL,
            "dimensions": 2048,
            "last_generated_at": None,
        }

    # Query all embeddings stored for this specific active approved segmentation.
    embeddings = list(
        db.scalars(
            select(JobEmbedding).where(JobEmbedding.segmentation_id == active_seg.id)
        ).all()
    )

    # Separate full JD scope vs granular requirement scope embeddings.
    full_jd_embeddings = [e for e in embeddings if e.embedding_type == "full_jd" and e.requirement_id is None]
    has_full_jd = len(full_jd_embeddings) == 1
    duplicate_full_jd_count = max(0, len(full_jd_embeddings) - 1)

    # Compile expected vs actual requirement coverage.
    expected_requirements = active_seg.requirements
    expected_req_ids = {r.id for r in expected_requirements}
    req_by_id = {r.id: r for r in expected_requirements}

    # Isolate requirement embeddings that carry a foreign key.
    req_embeddings = [e for e in embeddings if e.requirement_id is not None]
    embedded_req_ids = {e.requirement_id for e in req_embeddings}

    # Detect duplicate requirement embeddings for the same requirement ID.
    req_counts: Dict[int, int] = {}
    for e in req_embeddings:
        req_counts[e.requirement_id] = req_counts.get(e.requirement_id, 0) + 1
    duplicate_req_count = sum(c - 1 for c in req_counts.values() if c > 1)
    total_duplicate_count = duplicate_full_jd_count + duplicate_req_count

    # Determine missing and unexpected requirement IDs.
    missing_req_ids = sorted(list(expected_req_ids - embedded_req_ids))
    unexpected_req_ids = sorted(list(embedded_req_ids - expected_req_ids))

    # Verify model and vector dimension compliance across all stored rows.
    invalid_model_count = sum(
        1 for e in embeddings if e.model_name != OPENROUTER_EMBEDDING_MODEL
    )
    invalid_dimension_count = sum(
        1 for e in embeddings if e.dimensions != 2048 or not isinstance(e.embedding_vector, list) or len(e.embedding_vector) != 2048
    )

    # Verify input hashes against current source content to detect stale vectors.
    stale_embeddings: List[Dict[str, Any]] = []

    # Check full JD input hash against freshly built text.
    current_full_text = build_full_jd_embedding_text(job, active_seg)
    current_full_hash = compute_text_sha256(current_full_text)
    for fj_emb in full_jd_embeddings:
        if fj_emb.input_hash != current_full_hash:
            stale_embeddings.append({
                "embedding_id": fj_emb.id,
                "scope": "full_jd",
                "requirement_id": None,
                "stored_hash": fj_emb.input_hash,
                "current_hash": current_full_hash,
            })

    # Check requirement hashes and classifications against current definitions.
    incorrect_type_count = 0
    for re_emb in req_embeddings:
        target_req = req_by_id.get(re_emb.requirement_id)
        if target_req:
            expected_type = "mandatory_requirement" if target_req.classification == "Mandatory" else "preferred_requirement"
            if re_emb.embedding_type != expected_type:
                incorrect_type_count += 1
            cur_req_text = build_requirement_embedding_text(target_req)
            cur_req_hash = compute_text_sha256(cur_req_text)
            if re_emb.input_hash != cur_req_hash:
                stale_embeddings.append({
                    "embedding_id": re_emb.id,
                    "scope": "requirement",
                    "requirement_id": re_emb.requirement_id,
                    "stored_hash": re_emb.input_hash,
                    "current_hash": cur_req_hash,
                })

    # Expected count is exactly one full JD plus one per approved requirement.
    expected_count = 1 + len(expected_requirements)

    # Assess strict completeness requiring zero errors, zero duplicates, and zero stale hashes.
    is_complete = (
        len(embeddings) == expected_count
        and len(full_jd_embeddings) == 1
        and len(missing_req_ids) == 0
        and len(unexpected_req_ids) == 0
        and total_duplicate_count == 0
        and invalid_model_count == 0
        and invalid_dimension_count == 0
        and incorrect_type_count == 0
        and len(stale_embeddings) == 0
    )

    # Derive human-readable status indicator.
    status_code = "ready" if is_complete else ("partial" if len(embeddings) > 0 else "pending")

    return {
        "job_id": job.id,
        "segmentation_id": active_seg.id,
        "version": active_seg.version,
        "has_approved_segmentation": True,
        "has_embeddings": len(embeddings) > 0,
        "has_full_jd_embedding": has_full_jd,
        "total_embeddings": len(embeddings),
        "total_requirements": len(expected_requirements),
        "expected_embeddings": expected_count,
        "is_complete": is_complete,
        "status": status_code,
        "missing_requirement_ids": missing_req_ids,
        "unexpected_requirement_ids": unexpected_req_ids,
        "duplicate_count": total_duplicate_count,
        "stale_count": len(stale_embeddings),
        "stale_embeddings": stale_embeddings,
        "invalid_model_count": invalid_model_count,
        "invalid_dimension_count": invalid_dimension_count,
        "incorrect_type_count": incorrect_type_count,
        "model_name": embeddings[0].model_name if embeddings else OPENROUTER_EMBEDDING_MODEL,
        "dimensions": embeddings[0].dimensions if embeddings else 2048,
        "last_generated_at": max((e.created_at for e in embeddings), default=None).isoformat() if embeddings else None,
    }


# Retrieve metadata for all embeddings belonging to a job without exposing raw vectors.
def get_job_embeddings_metadata(
    db: Session,
    job_id: int,
    segmentation_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    # Start select on JobEmbedding table.
    stmt = select(JobEmbedding).where(JobEmbedding.job_id == job_id)
    # Filter by specific segmentation if supplied.
    if segmentation_id is not None:
        stmt = stmt.where(JobEmbedding.segmentation_id == segmentation_id)
    # Order by creation timestamp descending.
    stmt = stmt.order_by(JobEmbedding.created_at.desc(), JobEmbedding.id.asc())

    embeddings = db.scalars(stmt).all()

    # Format result without numeric vector array coordinates.
    return [
        {
            "id": e.id,
            "job_id": e.job_id,
            "segmentation_id": e.segmentation_id,
            "requirement_id": e.requirement_id,
            "embedding_type": e.embedding_type,
            "input_hash": e.input_hash,
            "model_name": e.model_name,
            "dimensions": e.dimensions,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in embeddings
    ]
