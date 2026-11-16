# Import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form from FastAPI.
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
# Import Session from SQLAlchemy.
from sqlalchemy.orm import Session
# Import typing helpers.
from typing import Any, Optional
# Import Pydantic models.
from pydantic import BaseModel, Field
# Import database session dependency.
from database.sqlite_connection import get_db
# Import database models.
from database.models import (
    Job,
    JobDescription,
    JDAnalysis,
    Candidate,
    Resume,
    ResumeEmbedding,
    ActivityEvent,
    JDSegmentation,
    JobRequirement,
)
# Import candidate search service for semantic vector matching.
from app.candidate_search_service import search_candidates
# Import datetime.
from datetime import datetime, timezone
# Import Path for filesystem operations.
from pathlib import Path
# Import hashlib for SHA digests.
import hashlib
# Import uuid for unique identifiers.
import uuid
# Import re for regex validation and sanitization.
import re
# Import extraction and validation service for manual JD processing.
from app.services.jd_extraction_service import (
    validate_file_upload,
    extract_text_from_bytes,
    check_for_duplicates,
    compute_normalized_text_hash,
    sanitize_filename,
)
# Import Phase 3 AI segmentation service functions.
from app.services.jd_segmentation_service import (
    segment_job_description,
    get_segmentation_dict,
    STANDARD_15_CATEGORIES,
    CATEGORY_LABELS,
)
# Import Phase 5B JD embedding services.
from app.services.jd_embedding_service import (
    generate_segmentation_embeddings,
    get_job_embedding_status,
    get_job_embeddings_metadata,
    get_active_approved_segmentation,
)
# Import Phase 5C semantic candidate matching engine services.
from app.services.matching_engine_service import (
    search_and_match_candidates,
    compare_candidates_for_job,
    compare_single_candidate_for_job,
    compare_adhoc_jd_and_resume,
    get_matching_filter_options,
    CandidateMatchingFilters,
    MatchScoreWeights,
)
# Import Centralized JD Intelligence & Boolean Query services.
from app.services.jd_intelligence_service import (
    analyze_job_description_intelligence,
    extract_deterministic_jd_intelligence,
)
from app.services.boolean_query_service import (
    generate_boolean_queries,
)

# Create a modular FastAPI router for all job description and matching endpoints.
router = APIRouter(prefix="/api/jobs", tags=["Jobs"])

# Configure the destination directory for uploaded job description source documents.
JOB_DESCRIPTIONS_UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "job_descriptions"


# Schema for updating job status.
class JobUpdateSchema(BaseModel):
    # Optional status update (e.g. Active, Under Review, Closed).
    status: Optional[str] = Field(default=None, description="Operational status of the job")
    # Optional description update.
    description: Optional[str] = Field(default=None, description="Job description text")


@router.get("")
def list_jobs(
    status: Optional[str] = Query(default=None, description="Filter jobs by status"),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Retrieve all job descriptions with requirements and analysis status."""
    # Start query on Job table.
    query = db.query(Job)
    # Filter by status if provided as a valid non-empty string.
    if isinstance(status, str) and status.strip():
        query = query.filter(Job.status == status.strip())

    jobs = query.order_by(Job.id.asc()).all()
    results = []

    for idx, j in enumerate(jobs):
        # Look for corresponding JobDescription source document cleanly via foreign key or title.
        jd_code = f"JD-{j.id:03d}"
        source_doc = (
            db.query(JobDescription).filter(JobDescription.id == j.job_description_id).first()
            if j.job_description_id
            else db.query(JobDescription).filter(JobDescription.title == j.title).first()
        )
        source_filename = source_doc.source_filename if source_doc else f"jd_{j.id:03d}.txt"

        # Retrieve latest approved segmentation metadata for overview readiness indicators.
        latest_seg = (
            db.query(JDSegmentation)
            .filter(JDSegmentation.job_id == j.id)
            .order_by(JDSegmentation.version.desc())
            .first()
        )

        # Check for completed analysis record grounded in JDAnalysis or JDSegmentation.
        analysis_data = None
        if source_doc and source_doc.analyses:
            an = source_doc.analyses[-1]
            stored_resps = an.requirements.get("extracted_responsibilities") if isinstance(an.requirements, dict) else None
            analysis_data = {
                "status": "Analyzed",
                "analyzedAt": an.analyzed_at.strftime("%Y-%m-%d %H:%M UTC") if an.analyzed_at else "Recent",
                "modelUsed": an.model_name or "nvidia/nemotron-3.5-super-vl",
                "confidenceScore": an.requirements.get("confidence_score", 95) if isinstance(an.requirements, dict) else 95,
                "extractedResponsibilities": stored_resps or [
                    r.original_text for r in (latest_seg.requirements if latest_seg else []) if r.category == "key_responsibilities"
                ][:4],
            }
        elif latest_seg:
            seg_resps = [r.original_text for r in latest_seg.requirements if r.category == "key_responsibilities"][:4]
            if seg_resps or latest_seg.role_summary:
                analysis_data = {
                    "status": "Analyzed" if latest_seg.is_approved else "Segmented (Review Pending)",
                    "analyzedAt": latest_seg.updated_at.strftime("%Y-%m-%d %H:%M UTC") if latest_seg.updated_at else "Recent",
                    "modelUsed": latest_seg.model_name or "nvidia/nemotron-3.5-super-vl",
                    "confidenceScore": 95 if latest_seg.is_approved else 88,
                    "extractedResponsibilities": seg_resps if seg_resps else [latest_seg.role_summary],
                }

        # Format experience bounds honestly based on stored numeric bounds.
        if j.min_experience_years is not None and j.max_experience_years is not None:
            exp_str = f"{int(j.min_experience_years)} - {int(j.max_experience_years)} Years"
        elif j.min_experience_years is not None:
            exp_str = f"{int(j.min_experience_years)}+ Years"
        else:
            exp_str = "Not specified"

        # Compile job dictionary preserving actual SQLite fields without inventing fake matches or clients.
        results.append({
            "id": j.id,
            "numeric_id": j.id,
            "code": f"job-{j.id:03d}",
            "jdCode": jd_code,
            "title": j.title,
            "clientName": j.client_name or (source_doc.company_name if source_doc else None) or "Internal Practice",
            "jobCode": j.job_code or f"REQ-{j.id:04d}",
            "workMode": j.work_mode or "Not specified",
            "employmentType": j.employment_type or "Full-time",
            "salaryRange": j.salary_range or "Not disclosed",
            "openingsCount": j.openings_count or 1,
            "recruiterOwner": j.recruiter_owner or "Talent Acquisition Team",
            "priority": j.priority or "Medium",
            "source": j.source or "manual_upload",
            "version": j.version or 1,
            "jobDescriptionId": j.job_description_id or (source_doc.id if source_doc else None),
            "ocrNeeded": bool(source_doc.ocr_needed) if source_doc and hasattr(source_doc, "ocr_needed") else False,
            "department": j.department or "Engineering & Delivery",
            "location": j.location or "Not specified",
            "experienceRequired": exp_str,
            "minYears": j.min_experience_years,
            "maxYears": j.max_experience_years,
            "status": j.status or "Active",
            "requiredSkills": j.required_skills or [],
            "preferredSkills": j.preferred_skills or [],
            "syncedMandatorySkills": j.synced_mandatory_skills or [],
            "syncedPreferredSkills": j.synced_preferred_skills or [],
            "segmentationApproved": bool(latest_seg and latest_seg.is_approved),
            "description": j.description or "",
            "sourceFilename": source_filename,
            "matchedCandidateIds": [],
            "analysis": analysis_data,
            "structuredScope": (latest_seg.structured_scope if latest_seg else None),
            "intelligenceData": (latest_seg.intelligence_data if latest_seg else None),
            "originalText": (source_doc.original_text if source_doc else None),
        })

    return results


@router.get("/{job_id}")
def get_job(job_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Retrieve deep job description details and extracted criteria."""
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    j = db.query(Job).filter(Job.id == j_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Job not found.")

    source_doc = (
        db.query(JobDescription).filter(JobDescription.id == j.job_description_id).first()
        if j.job_description_id
        else db.query(JobDescription).filter(JobDescription.title == j.title).first()
    )
    source_filename = source_doc.source_filename if source_doc else f"jd_{j.id:03d}.txt"
    latest_seg = (
        db.query(JDSegmentation)
        .filter(JDSegmentation.job_id == j.id)
        .order_by(JDSegmentation.version.desc())
        .first()
    )

    analysis_data = None
    if source_doc and source_doc.analyses:
        an = source_doc.analyses[-1]
        stored_resps = an.requirements.get("extracted_responsibilities") if isinstance(an.requirements, dict) else None
        analysis_data = {
            "status": "Analyzed",
            "analyzedAt": an.analyzed_at.strftime("%Y-%m-%d %H:%M UTC") if an.analyzed_at else "Recent",
            "modelUsed": an.model_name or "nvidia/nemotron-3.5-super-vl",
            "confidenceScore": an.requirements.get("confidence_score", 95) if isinstance(an.requirements, dict) else 95,
            "extractedResponsibilities": stored_resps or [
                r.original_text for r in (latest_seg.requirements if latest_seg else []) if r.category == "key_responsibilities"
            ][:4],
        }
    elif latest_seg:
        seg_resps = [r.original_text for r in latest_seg.requirements if r.category == "key_responsibilities"][:4]
        if seg_resps or latest_seg.role_summary:
            analysis_data = {
                "status": "Analyzed" if latest_seg.is_approved else "Segmented (Review Pending)",
                "analyzedAt": latest_seg.updated_at.strftime("%Y-%m-%d %H:%M UTC") if latest_seg.updated_at else "Recent",
                "modelUsed": latest_seg.model_name or "nvidia/nemotron-3.5-super-vl",
                "confidenceScore": 95 if latest_seg.is_approved else 88,
                "extractedResponsibilities": seg_resps if seg_resps else [latest_seg.role_summary],
            }

    if j.min_experience_years is not None and j.max_experience_years is not None:
        exp_str = f"{int(j.min_experience_years)} - {int(j.max_experience_years)} Years"
    elif j.min_experience_years is not None:
        exp_str = f"{int(j.min_experience_years)}+ Years"
    else:
        exp_str = "Not specified"

    return {
        "id": j.id,
        "numeric_id": j.id,
        "code": f"job-{j.id:03d}",
        "jdCode": f"JD-{j.id:03d}",
        "title": j.title,
        "clientName": j.client_name or (source_doc.company_name if source_doc else None) or "Internal Practice",
        "jobCode": j.job_code or f"REQ-{j.id:04d}",
        "workMode": j.work_mode or "Not specified",
        "employmentType": j.employment_type or "Full-time",
        "salaryRange": j.salary_range or "Not disclosed",
        "openingsCount": j.openings_count or 1,
        "recruiterOwner": j.recruiter_owner or "Talent Acquisition Team",
        "priority": j.priority or "Medium",
        "source": j.source or "manual_upload",
        "version": j.version or 1,
        "jobDescriptionId": j.job_description_id or (source_doc.id if source_doc else None),
        "ocrNeeded": bool(source_doc.ocr_needed) if source_doc and hasattr(source_doc, "ocr_needed") else False,
        "department": j.department or "Engineering & Delivery",
        "location": j.location or "Not specified",
        "experienceRequired": exp_str,
        "minYears": j.min_experience_years,
        "maxYears": j.max_experience_years,
        "status": j.status or "Active",
        "requiredSkills": j.required_skills or [],
        "preferredSkills": j.preferred_skills or [],
        "syncedMandatorySkills": j.synced_mandatory_skills or [],
        "syncedPreferredSkills": j.synced_preferred_skills or [],
        "segmentationApproved": bool(latest_seg and latest_seg.is_approved),
        "description": j.description or "",
        "sourceFilename": source_filename,
        "matchedCandidateIds": [],
        "analysis": analysis_data,
        "structuredScope": (latest_seg.structured_scope if latest_seg else None),
        "intelligenceData": (latest_seg.intelligence_data if latest_seg else None),
        "originalText": (source_doc.original_text if source_doc else None),
    }


@router.patch("/{job_id}")
def update_job(
    job_id: str,
    payload: JobUpdateSchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Update job status or description."""
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    j = db.query(Job).filter(Job.id == j_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Job not found.")

    if payload.status is not None:
        j.status = payload.status
        db.add(ActivityEvent(
            event_type="job_updated",
            summary=f"Job {j.title} status changed to {payload.status}",
            entity_type="job",
            entity_id=str(j.id),
            created_at=datetime.now(timezone.utc),
        ))

    if payload.description is not None:
        j.description = payload.description

    db.commit()
    db.refresh(j)

    return {"status": "success", "message": f"Job {j.title} updated.", "job_status": j.status}


@router.post("/{job_id}/analyze")
def analyze_job(job_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Execute or retrieve real Nemotron JD segmentation and responsibility extraction."""
    # Parse numeric job identifier from URL slug.
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    # Load target job record from SQLite.
    j = db.query(Job).filter(Job.id == j_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Job not found.")

    # Locate the latest segmentation record for this job before deciding whether to run segmentation.
    segmentation = db.query(JDSegmentation).filter(
        JDSegmentation.job_id == j.id
    ).order_by(JDSegmentation.version.desc()).first()

    # Run real Nemotron/heuristic JD segmentation if none exists or if previous attempt was incomplete.
    if not segmentation or len(segmentation.requirements or []) == 0:
        try:
            # Execute the real segmentation pipeline (respecting approved records when re-running).
            segmentation = segment_job_description(db=db, job=j, force_resegment=False)
        except Exception:
            # Avoid leaking internal exception stack details over HTTP.
            raise HTTPException(status_code=500, detail="Failed to execute job description analysis.")

    # Extract grounded responsibility statements directly from segmented requirements or raw JD text.
    responsibility_items = [
        req.original_text
        for req in (segmentation.requirements or [])
        if req.category in {"responsibilities", "core_competencies", "domain_knowledge"} and req.original_text
    ]
    # Fallback to non-empty lines from the stored job description when no responsibility category items exist.
    if not responsibility_items and j.description:
        responsibility_items = [
            line.strip("•- \t")
            for line in j.description.splitlines()
            if len(line.strip()) > 20
        ][:5]

    # Compute average requirement confidence percentage from real SQLite requirement rows.
    conf_values = [req.confidence for req in (segmentation.requirements or []) if req.confidence is not None]
    avg_confidence = round((sum(conf_values) / len(conf_values)) * 100) if conf_values else 0

    # Sync JDAnalysis audit row if this Job links back to a normalized JobDescription record.
    if j.job_description_id:
        # Check if a JDAnalysis row already exists for this normalized JD.
        jd_analysis = db.query(JDAnalysis).filter(
            JDAnalysis.job_description_id == j.job_description_id
        ).order_by(JDAnalysis.id.desc()).first()
        # Extract mandatory and preferred requirement labels for structured JDAnalysis JSON.
        req_labels = [
            (r.normalized_skill or r.original_text)
            for r in (segmentation.requirements or [])
            if r.classification == "Mandatory"
        ]
        # Update existing JDAnalysis row or insert a fresh one with real metrics.
        if jd_analysis:
            jd_analysis.core_skills = req_labels or (j.required_skills or [])
            jd_analysis.confidence_score = float(avg_confidence) / 100.0 if avg_confidence else 0.0
            jd_analysis.model_used = segmentation.model_name
            jd_analysis.created_at = datetime.now(timezone.utc)
        else:
            db.add(JDAnalysis(
                job_description_id=j.job_description_id,
                core_skills=req_labels or (j.required_skills or []),
                preferred_skills=j.preferred_skills or [],
                experience_years=None,
                education=[],
                responsibilities=responsibility_items[:8],
                confidence_score=float(avg_confidence) / 100.0 if avg_confidence else 0.0,
                model_used=segmentation.model_name,
                created_at=datetime.now(timezone.utc),
            ))

    # Record verified analysis activity event in audit trail.
    db.add(ActivityEvent(
        event_type="jd_analyzed",
        summary=f"JD criteria analysis executed for {j.title} (v{segmentation.version})",
        entity_type="job",
        entity_id=str(j.id),
        created_at=datetime.now(timezone.utc),
    ))
    db.commit()

    # Return grounded analysis payload derived strictly from stored segmentation and JD text.
    return {
        "status": "success",
        "message": f"Analysis complete for {j.title}.",
        "analysis": {
            "status": "Analyzed",
            "analyzedAt": (segmentation.updated_at or segmentation.created_at or datetime.now(timezone.utc)).strftime("%Y-%m-%d %H:%M UTC"),
            "modelUsed": segmentation.model_name or "heuristic_fallback",
            "confidenceScore": avg_confidence,
            "extractedResponsibilities": responsibility_items[:6],
            "segmentationId": segmentation.id,
            "segmentationVersion": segmentation.version,
        },
    }


# Schema for comparing multiple candidates side-by-side against a job requisition.
class CompareCandidatesSchema(BaseModel):
    # List of candidate IDs to compare (between 2 and 5).
    candidate_ids: list[int] = Field(..., min_length=2, max_length=5, description="Candidate IDs to compare")


@router.get("/{job_id}/matches")
def get_job_matches(
    job_id: str,
    min_experience: Optional[float] = Query(default=None, description="Minimum experience in years"),
    max_experience: Optional[float] = Query(default=None, description="Maximum experience in years"),
    location: Optional[str] = Query(default=None, description="Geographic location substring"),
    availability: Optional[str] = Query(default=None, description="Notice period availability"),
    stage: Optional[str] = Query(default=None, description="Recruitment stage"),
    min_score: Optional[float] = Query(default=None, ge=0.0, le=100.0, description="Minimum match score threshold"),
    search: Optional[str] = Query(default=None, description="Search keyword in name, summary, or skills"),
    sort_by: str = Query(default="match_score", description="Sort field: match_score, experience, name, similarity"),
    sort_order: str = Query(default="desc", description="Sort direction: desc or asc"),
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=50, ge=1, le=200, description="Page size limit"),
    as_object: bool = Query(default=False, description="Return full response object with summary metrics"),
    db: Session = Depends(get_db),
) -> Any:
    """Retrieve ranked candidate matches for this job using Phase 5C semantic candidate matching engine."""
    # Clean job ID string robustly (handles '1', 'job-1', 'JD-001', 'jd-1', etc.).
    digits = re.sub(r"[^0-9]", "", str(job_id))
    try:
        j_id = int(digits) if digits else int(str(job_id))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    # Verify job existence in database.
    j = db.query(Job).filter(Job.id == j_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Job not found.")

    # Construct candidate matching filters handling both FastAPI injection and direct Python calls.
    def _val(v, default=None):
        return default if hasattr(v, "default") else v

    filters = CandidateMatchingFilters(
        min_experience=_val(min_experience, None),
        max_experience=_val(max_experience, None),
        location=_val(location, None),
        availability=_val(availability, None),
        stage=_val(stage, None),
        min_score=_val(min_score, None),
        search=_val(search, None),
        sort_by=_val(sort_by, "match_score"),
        sort_order=_val(sort_order, "desc"),
    )
    actual_page = _val(page, 1)
    actual_limit = _val(limit, 50)
    actual_as_object = _val(as_object, False)

    try:
        # Run Phase 5C matching engine across candidate embeddings and JD requirements.
        result = search_and_match_candidates(
            db=db,
            job_id=j.id,
            filters=filters,
            page=actual_page,
            page_size=actual_limit,
        )
    except Exception:
        # Return sanitized 500 error without exposing internal SQL or filesystem trace details.
        raise HTTPException(status_code=500, detail="Matching engine execution failed.")

    # Return full object if caller requested structured object format.
    if actual_as_object:
        return result

    # Return list of matches directly for legacy client and test compatibility.
    return result["matches"]


@router.get("/{job_id}/matches/summary")
def get_job_matches_summary(job_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Retrieve aggregate matching KPI metrics and tier counts for a job."""
    digits = re.sub(r"[^0-9]", "", str(job_id))
    try:
        j_id = int(digits) if digits else int(str(job_id))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    j = db.query(Job).filter(Job.id == j_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Job not found.")

    try:
        result = search_and_match_candidates(db=db, job_id=j.id, page=1, page_size=1)
        return {
            "job_id": j.id,
            "job_title": j.title,
            "summary": result["summary"],
            "total_evaluated": result["total_evaluated"],
        }
    except Exception:
        # Return sanitized 500 error without exposing raw server exception details.
        raise HTTPException(status_code=500, detail="Failed to generate matching summary.")


@router.post("/{job_id}/compare-candidates")
def compare_job_candidates(
    job_id: str,
    payload: CompareCandidatesSchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Compare multiple candidates side-by-side against all JD requirements."""
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    j = db.query(Job).filter(Job.id == j_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Job not found.")

    try:
        return compare_candidates_for_job(db=db, job_id=j.id, candidate_ids=payload.candidate_ids)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception:
        # Return sanitized 500 error without leaking internal exception messages.
        raise HTTPException(status_code=500, detail="Candidate comparison failed.")


# Schema for ad-hoc JD and Resume text comparison.
class CompareAdhocSchema(BaseModel):
    jd_text: str = Field(..., description="Job description text")
    resume_text: str = Field(..., description="Resume text")
    role_title: Optional[str] = Field(default="Target Position", description="Optional role title")
    candidate_name: Optional[str] = Field(default="Applicant Profile", description="Optional applicant name")


@router.post("/compare-adhoc")
def compare_adhoc_texts(
    payload: CompareAdhocSchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Perform on-the-fly deep comparison between pasted/uploaded JD text and Resume text."""
    try:
        return compare_adhoc_jd_and_resume(
            db=db,
            jd_text=payload.jd_text,
            resume_text=payload.resume_text,
            role_title=payload.role_title or "Target Position",
            candidate_name=payload.candidate_name or "Applicant Profile",
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception:
        raise HTTPException(status_code=500, detail="Ad-hoc comparison failed.")


@router.get("/{job_id}/compare/{candidate_id}")
def compare_single_candidate(
    job_id: str,
    candidate_id: int,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Perform a deep 1-on-1 comparison between a specific Job and Candidate Resume."""
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    try:
        return compare_single_candidate_for_job(db=db, job_id=j_id, candidate_id=candidate_id)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception:
        raise HTTPException(status_code=500, detail="Single candidate comparison failed.")


@router.get("/{job_id}/match-filters")
def get_job_match_filters(job_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Retrieve distinct candidate filter values available in the recruitment pool."""
    return get_matching_filter_options(db)


# Schema for direct text preview and duplicate checking.
class PreviewTextSchema(BaseModel):
    # Raw JD text provided by recruiter.
    raw_text: str = Field(..., description="Directly pasted job description text")
    # Optional role title.
    title: Optional[str] = Field(default=None, description="Optional role title")


def tune_and_extract_job_text(text: str, fallback_filename: str = "") -> dict[str, Any]:
    """Intelligently cleans and tunes raw ATS/Excel/unstructured text and extracts metadata."""
    if not text or not isinstance(text, str):
        return {
            "tuned_text": "",
            "metadata": {
                "title": "",
                "job_code": None,
                "location": "Bengaluru & Hyderabad",
                "min_experience_years": 4.0,
                "max_experience_years": 8.0,
                "required_skills": [],
                "preferred_skills": [],
            },
        }

    raw = text.strip()
    role_keywords = r'(?:Engineer|Consultant|Developer|Architect|Manager|Lead|Analyst|Specialist|Administrator|Director|Officer|Scientist|Designer|Tester|Associate|Coordinator|Programmer|Technician)'

    # 1. Job Code / Requisition ID
    code_match = re.search(r'\b([A-Za-z0-9]+(?:[_-][A-Za-z0-9]+){2,})\b', raw) or re.search(r'\b(REQ-[A-Za-z0-9-]+|JD-[A-Za-z0-9-]+)\b', raw, re.I)
    job_code = code_match.group(1) if code_match else None

    # 2. Role Title
    title = None
    explicit = re.search(r'(?:Job\s*Title|Title|Role|Position)\s*[:\-–]\s*([^\n\r,]{3,60})', raw, re.I)
    if explicit:
        title = explicit.group(1).strip()
    if not title:
        title_match = re.search(r'\b([A-Z][a-zA-Z0-9/&\s-]{2,45}\s+' + role_keywords + r')\b', raw)
        if title_match:
            raw_t = title_match.group(1)
            clean_t = re.sub(r'^(?:\d+[\s_-]*|Yet\s+to\s+Start\s+|Open\s+|Active\s+|Draft\s+|Status\s*[:\-]\s*)+', '', raw_t, flags=re.I).strip()
            if len(clean_t) >= 3:
                title = clean_t
    if not title and fallback_filename:
        stem = Path(fallback_filename).stem.replace("_", " ").replace("-", " ")
        clean_stem = re.sub(r'\b(?:jd|job|description|spec|req)\b', '', stem, flags=re.I).strip().title()
        if len(clean_stem) >= 3:
            title = clean_stem

    # 3. Experience
    exp_match = re.search(r'(\d+)(?:\s*[-–]\s*(\d+))?\+?\s*(?:yrs|years|yr|yoe)', raw, re.I)
    min_exp = float(exp_match.group(1)) if exp_match else 4.0
    max_exp = float(exp_match.group(2)) if exp_match and exp_match.group(2) else (min_exp + 4.0 if min_exp > 0 else 8.0)

    # 4. Location
    loc_match = re.search(r'\b(Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Chennai|Delhi|Noida|Gurgaon|Gurugram|Kolkata|Ahmedabad|Remote|Hybrid)(?:\s*(?:&|/|,|and)\s*(Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Chennai|Delhi|Noida|Gurgaon|Gurugram|Kolkata|Ahmedabad|Remote|Hybrid))?\b', raw, re.I)
    location = loc_match.group(0).strip() if loc_match else "Bengaluru & Hyderabad"

    # 5. Skills extraction
    common_tech = [
        "Verilog", "SystemVerilog", "UVM", "VHDL", "FPGA design", "FPGA", "SVA",
        "DO-254", "AXI", "APB", "AHB", "Python", "Perl", "Tcl", "Shell", "ASIC",
        "C++", "Java", "Oracle EPM", "Hyperion", "PBCS", "FCCS", "ServiceNow",
        "Flow Designer", "Business Rules", "REST APIs", "AWS", "Azure", "GCP",
        "Docker", "Kubernetes", "SQL", "Linux", "EDA Tools", "Cadence", "Synopsys",
        "simulation and debug", "functional/code coverage", "verification & validation",
        "Team Handling and Co-ordination", "DAL-B exposure",
    ]
    found_skills = []
    for skill in common_tech:
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, raw, re.I):
            found_skills.append(skill)

    required_skills = [s for s in found_skills if "DAL-B" not in s and "preferred" not in s.lower()]
    preferred_skills = [s for s in found_skills if "DAL-B" in s or "preferred" in s.lower()]
    if not preferred_skills and re.search(r'DAL-B exposure preferred', raw, re.I):
        preferred_skills.append("DAL-B exposure preferred")

    # Check if already structured markdown with ##
    has_existing_structure = bool(re.search(r'(?:^|\n)#{1,3}\s+(?:Responsibilities|Requirements|Summary|Overview|Competencies|Qualifications)', raw, re.I))

    if has_existing_structure:
        tuned_text = raw
    else:
        # Clean ATS/table prefix noise
        cleaned = re.sub(r'^\s*\d+\s+[A-Za-z0-9_-]+\s+\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}\s+(?:Yet to Start|Open|Active|Draft|Pending)?\s*', '', raw, flags=re.I).strip()
        cleaned = re.sub(r'^\s*\d+\s+', '', cleaned).strip()
        cleaned = re.sub(r'^(?:Yet to Start\s+)?', '', cleaned, flags=re.I)
        if title:
            cleaned = re.sub(r'^\s*' + re.escape(title) + r'\s*', '', cleaned, flags=re.I)
        cleaned = re.sub(r'^\s*\d+\+?\s*(?:yrs|years|yr|yoe)\s*', '', cleaned, flags=re.I)
        if location:
            cleaned = re.sub(r'^\s*(?:' + re.escape(location).replace(r'\&', r'[&,]') + r'|[A-Za-z\s,&]+Hyderabad|[A-Za-z\s,&]+Bengaluru)\s*', '', cleaned, flags=re.I).strip()

        normalized_body = re.sub(r'\s*,\s*(?=Should be capable of|DAL-B exposure|Team Handling|experience in|EDA Tools|Responsible for|Will design|Manage|Lead)', '; ', cleaned, flags=re.I)
        normalized_body = re.sub(r'\s*,\s*(?=FPGA Design, Verification & Validation)', '; ', normalized_body, flags=re.I)

        segments = [s.strip().strip(',') for s in re.split(r';|\.\s+', normalized_body) if s.strip()]
        responsibilities = []
        tech_competencies = []
        qualifications = []

        for seg in segments:
            clean_seg = seg.strip().strip(',')
            if not clean_seg:
                continue
            if re.search(r'preferred|is an advantage|plus|desirable', clean_seg, re.I):
                qualifications.append(clean_seg)
            elif re.search(r'Verilog|SystemVerilog|UVM|VHDL|FPGA design|SVA|Simulation and debug|Python|Perl|Tcl|Shell|EDA|Cadence|Synopsys|AXI|APB|AHB|C\+\+|Java|ServiceNow|AWS|Azure', clean_seg, re.I) and not re.search(r'Should be capable of|Team Handling|Responsible for', clean_seg, re.I):
                tech_competencies.append(clean_seg)
            else:
                responsibilities.append(clean_seg)

        effective_title = title or "Technical Specialist"
        exp_display = f"{int(min_exp)}+ Years" if min_exp > 0 else "5+ Years"
        loc_display = location or "Bengaluru & Hyderabad"

        out_lines = [
            f"## Role: {effective_title}",
        ]
        if job_code:
            out_lines.append(f"• Requisition ID: {job_code}")
        out_lines.append(f"• Experience Level: {exp_display}")
        out_lines.append(f"• Location / Work Mode: {loc_display}")
        out_lines.append("")
        out_lines.append("### Role Summary & Scope:")
        out_lines.append(f"Looking for an experienced {effective_title} with {exp_display} of domain expertise to join the engineering team in {loc_display}. The role owns end-to-end specification analysis, design verification, hardware-software integration, and compliance across key project deliverables.")
        out_lines.append("")
        out_lines.append("### Key Responsibilities:")
        if responsibilities:
            for r in responsibilities:
                out_lines.append(f"• {r}")
        else:
            out_lines.append("• Lead end-to-end verification, architecture validation, and quality engineering.")
            out_lines.append("• Oversee development lifecycle milestones and regulatory compliance.")
        out_lines.append("")
        out_lines.append("### Mandatory Technical Competencies:")
        if tech_competencies:
            for c in tech_competencies:
                out_lines.append(f"• {c}")
        elif required_skills:
            for s in required_skills:
                out_lines.append(f"• {s}")
        else:
            out_lines.append("• Core programming, verification methodologies, and industry-standard tools.")
        out_lines.append("")
        if qualifications or preferred_skills:
            out_lines.append("### Preferred Qualifications & Additional Tools:")
            for q in (qualifications or preferred_skills):
                out_lines.append(f"• {q}")
            out_lines.append("")

        tuned_text = "\n".join(out_lines).strip()

    metadata = {
        "title": title or "",
        "job_code": job_code,
        "location": location,
        "min_experience_years": min_exp,
        "max_experience_years": max_exp,
        "required_skills": required_skills,
        "preferred_skills": preferred_skills,
    }

    return {
        "tuned_text": tuned_text,
        "metadata": metadata,
    }


# Schema for saving a manual or uploaded job description.
class CreateManualJobSchema(BaseModel):
    # Job title (required).
    title: str = Field(..., description="Role title")
    # Approved/edited description content (required).
    description: str = Field(..., description="Approved job description text")
    # Original raw or extracted text before edits.
    original_text: Optional[str] = Field(default=None, description="Original unedited text")
    # Client or hiring organization name.
    client_name: Optional[str] = Field(default=None, description="Client or company name")
    # Requisition identifier code.
    job_code: Optional[str] = Field(default=None, description="Job requisition code")
    # Work mode model.
    work_mode: Optional[str] = Field(default="Hybrid", description="Work mode: Remote, Hybrid, On-site")
    # Employment classification.
    employment_type: Optional[str] = Field(default="Full-time", description="Employment type")
    # Stated job location.
    location: Optional[str] = Field(default="Hyderabad / Bangalore", description="Job location")
    # Minimum experience in years.
    min_experience_years: Optional[float] = Field(default=0.0, description="Minimum experience years")
    # Maximum experience in years.
    max_experience_years: Optional[float] = Field(default=10.0, description="Maximum experience years")
    # Compensation range.
    salary_range: Optional[str] = Field(default="Competitive Market Rate", description="Salary or pay band")
    # Target headcount openings.
    openings_count: int = Field(default=1, description="Number of headcount openings")
    # Business unit or department.
    department: Optional[str] = Field(default="Digital Engineering", description="Department name")
    # Assigned recruiter owner.
    recruiter_owner: Optional[str] = Field(default="Talent Acquisition Team", description="Assigned recruiter")
    # Priority level.
    priority: str = Field(default="Medium", description="Urgency priority")
    # Operational status.
    status: str = Field(default="open", description="Lifecycle status")
    # Required skills list.
    required_skills: list[str] = Field(default_factory=list, description="Required technical skills")
    # Preferred skills list.
    preferred_skills: list[str] = Field(default_factory=list, description="Preferred skills")
    # Source filename.
    source_filename: Optional[str] = Field(default=None, description="Original uploaded filename")
    # Ingestion source.
    source: str = Field(default="manual_upload", description="Source channel")
    # SHA-256 digest of original content.
    content_sha256: Optional[str] = Field(default=None, description="SHA-256 hash")
    # Normalized text hash.
    normalized_text_hash: Optional[str] = Field(default=None, description="Normalized text hash")
    # Whether OCR is required.
    ocr_needed: bool = Field(default=False, description="Flag indicating OCR requirement")
    # Optional parent job ID for versioning.
    parent_job_id: Optional[int] = Field(default=None, description="Parent job ID for version increments")


@router.post("/upload")
async def upload_job_description_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Upload a job description file (PDF, DOCX, TXT), validate, extract text, and check for duplicates."""
    # Sanitize the incoming filename against path traversal.
    safe_filename = sanitize_filename(file.filename or "uploaded_jd.txt")
    # Read binary bytes from upload stream.
    content_bytes = await file.read()

    # Validate file size, extension, and magic signatures.
    val_result = validate_file_upload(safe_filename, content_bytes)
    if not val_result["valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=val_result["error"],
        )

    # Compute content SHA-256 digest of raw file.
    file_sha256 = hashlib.sha256(content_bytes).hexdigest()

    # Extract text from bytes.
    extraction = extract_text_from_bytes(safe_filename, content_bytes)
    extracted_text = extraction["text"]
    ocr_needed = extraction["ocr_needed"]
    extraction_status = extraction["status"]

    # Compute normalized text hash.
    norm_hash = compute_normalized_text_hash(extracted_text) if extracted_text else ""

    # Check for existing duplicates in SQLite without overwriting.
    duplicate_info = check_for_duplicates(db, file_sha256, norm_hash)

    # Intelligently clean, tune, and extract metadata from document text
    tuning_res = tune_and_extract_job_text(extracted_text, fallback_filename=safe_filename)
    tuned_text = tuning_res["tuned_text"]
    extracted_meta = tuning_res["metadata"]

    # Return complete extraction preview to frontend recruiter interface.
    return {
        "status": "success",
        "processing_status": extraction_status,
        "filename": safe_filename,
        "content_sha256": file_sha256,
        "normalized_text_hash": norm_hash,
        "extracted_text": tuned_text if tuned_text else extracted_text,
        "tuned_text": tuned_text,
        "raw_text": extracted_text,
        "extracted_metadata": extracted_meta,
        "character_count": len(tuned_text) if tuned_text else extraction["character_count"],
        "word_count": len(tuned_text.split()) if tuned_text else extraction["word_count"],
        "page_count": extraction.get("page_count", 0),
        "ocr_needed": ocr_needed,
        "ocr_message": (
            "Scanned PDF detected. This document does not contain selectable text and requires OCR preprocessing."
            if ocr_needed else None
        ),
        "duplicate_detection": duplicate_info,
    }


@router.post("/preview-text")
def preview_pasted_job_description(
    payload: PreviewTextSchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Validate pasted job description text, compute digests, and check for duplicates."""
    # Strip whitespace.
    clean_text = payload.raw_text.strip()
    if not clean_text or len(clean_text) < 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pasted job description must contain at least 20 characters.",
        )

    # Compute content SHA256 of raw UTF-8 text bytes.
    text_bytes = clean_text.encode("utf-8")
    content_sha256 = hashlib.sha256(text_bytes).hexdigest()

    # Compute normalized text hash.
    norm_hash = compute_normalized_text_hash(clean_text)

    # Check for existing duplicates.
    duplicate_info = check_for_duplicates(db, content_sha256, norm_hash)

    # Intelligently clean, tune, and extract metadata from pasted text
    tuning_res = tune_and_extract_job_text(clean_text)
    tuned_text = tuning_res["tuned_text"]
    extracted_meta = tuning_res["metadata"]

    # If title was explicitly supplied in payload, override
    if payload.title and payload.title.strip():
        extracted_meta["title"] = payload.title.strip()

    # Return preview payload.
    return {
        "status": "success",
        "processing_status": "extracted",
        "filename": "pasted_text.txt",
        "content_sha256": content_sha256,
        "normalized_text_hash": norm_hash,
        "extracted_text": tuned_text if tuned_text else clean_text,
        "tuned_text": tuned_text,
        "raw_text": clean_text,
        "extracted_metadata": extracted_meta,
        "character_count": len(tuned_text) if tuned_text else len(clean_text),
        "word_count": len(tuned_text.split()) if tuned_text else len(clean_text.split()),
        "ocr_needed": False,
        "duplicate_detection": duplicate_info,
    }


@router.post("/create-manual")
def create_manual_job(
    payload: CreateManualJobSchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Persist a new or versioned job description with full metadata without overwriting existing jobs."""
    # Ensure description is non-empty.
    description = payload.description.strip() if payload.description else ""
    original_text = payload.original_text.strip() if payload.original_text else description

    source_for_meta = original_text or description

    # Resolve title: if blank, auto-extract from text so saving doesn't fail.
    title = payload.title.strip() if payload.title else ""
    auto_tuning = tune_and_extract_job_text(source_for_meta, fallback_filename=payload.source_filename or "")
    if not title:
        title = auto_tuning["metadata"]["title"]

    # Final fallback if still blank: derive from first meaningful line
    if not title and source_for_meta:
        first_line = source_for_meta.split("\n")[0].strip()
        first_line_clean = re.sub(r'^(?:\d+[\s_-]*|Yet\s+to\s+Start\s+|Open\s+|Active\s+|Draft\s+|Status\s*[:\-]\s*)+', '', first_line, flags=re.I).strip()
        words = first_line_clean.split()[:5]
        if words:
            title = " ".join(words)

    if not title:
        title = "Technical Specialist"

    if not description:
        description = auto_tuning["tuned_text"] or original_text

    if not description:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job description text is required.",
        )

    # Resolve required and preferred skills if omitted
    req_skills = payload.required_skills
    if not req_skills and auto_tuning["metadata"]["required_skills"]:
        req_skills = auto_tuning["metadata"]["required_skills"]

    pref_skills = payload.preferred_skills
    if not pref_skills and auto_tuning["metadata"]["preferred_skills"]:
        pref_skills = auto_tuning["metadata"]["preferred_skills"]

    # Resolve location, job_code, exp if omitted or defaulted
    loc = payload.location if payload.location and payload.location != "Hyderabad / Bangalore" else (auto_tuning["metadata"]["location"] or payload.location or "Bengaluru & Hyderabad")
    jcode = payload.job_code or auto_tuning["metadata"]["job_code"]
    min_exp = payload.min_experience_years if payload.min_experience_years > 0 else auto_tuning["metadata"]["min_experience_years"]
    max_exp = payload.max_experience_years if payload.max_experience_years > min_exp else auto_tuning["metadata"]["max_experience_years"]

    # Compute digests if not provided.
    content_sha256 = payload.content_sha256 or hashlib.sha256(original_text.encode("utf-8")).hexdigest()
    normalized_text_hash = payload.normalized_text_hash or compute_normalized_text_hash(description)

    # Resolve versioning lineage.
    target_version = 1
    parent_jd_id = None

    if payload.parent_job_id:
        parent_job = db.query(Job).filter(Job.id == payload.parent_job_id).first()
        if parent_job:
            target_version = (parent_job.version or 1) + 1
            if parent_job.job_description_id:
                parent_jd_id = parent_job.job_description_id

    # Retrieve the configured destination directory for job description source documents.
    jds_dir = JOB_DESCRIPTIONS_UPLOAD_DIR
    # Ensure the destination folder exists on disk prior to saving the job description file.
    jds_dir.mkdir(parents=True, exist_ok=True)

    # Establish unique source filename and safe local path.
    file_stem = sanitize_filename(payload.source_filename or f"jd_{title[:30].replace(' ', '_')}.txt")
    unique_suffix = uuid.uuid4().hex[:6]
    stored_filename = f"v{target_version}_{unique_suffix}_{file_stem}"
    stored_file_path = jds_dir / stored_filename

    # Save original text to disk storage for auditability.
    try:
        with open(stored_file_path, "w", encoding="utf-8") as f:
            f.write(original_text)
    except Exception as io_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist JD source file: {str(io_err)}",
        )

    # Generate a stable JD identifier.
    generated_jd_id = f"JD-{uuid.uuid4().hex[:8].upper()}"

    # Determine processing status.
    initial_status = "ocr_required" if payload.ocr_needed else "extracted"

    # Create JobDescription record preserving original, extracted, and approved texts.
    new_jd = JobDescription(
        jd_id=generated_jd_id,
        title=title,
        company_name=payload.client_name,
        source_filename=stored_filename,
        source_path=str(stored_file_path),
        content_sha256=content_sha256,
        original_text=original_text,
        extracted_text=description,
        version=target_version,
        status=initial_status,
        normalized_text_hash=normalized_text_hash,
        parent_jd_id=parent_jd_id,
        ocr_needed=1 if payload.ocr_needed else 0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(new_jd)
    db.flush()

    # Generate job code if omitted.
    job_code = jcode or payload.job_code or f"REQ-{new_jd.id:04d}"

    # Create operational Job record linked to the newly stored JobDescription.
    new_job = Job(
        title=title,
        description=description,
        required_skills=req_skills,
        preferred_skills=pref_skills,
        min_experience_years=min_exp,
        max_experience_years=max_exp,
        location=loc,
        status=payload.status,
        client_name=payload.client_name,
        job_code=job_code,
        work_mode=payload.work_mode,
        employment_type=payload.employment_type,
        salary_range=payload.salary_range,
        openings_count=payload.openings_count,
        department=payload.department,
        recruiter_owner=payload.recruiter_owner,
        priority=payload.priority,
        source=payload.source,
        version=target_version,
        job_description_id=new_jd.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(new_job)

    # Log activity event in the enterprise audit trail.
    event_summary = (
        f"New version v{target_version} created for job '{title}' ({job_code})"
        if payload.parent_job_id
        else f"Job '{title}' ({job_code}) created via {payload.source}"
    )
    db.add(ActivityEvent(
        event_type="job_created",
        summary=event_summary,
        entity_type="job",
        entity_id=str(new_jd.id),
        created_at=datetime.now(timezone.utc),
    ))

    # Commit the transaction safely.
    db.commit()
    db.refresh(new_job)
    db.refresh(new_jd)

    # Return created job representation.
    return {
        "status": "success",
        "message": f"Job '{title}' (v{target_version}) created successfully.",
        "job": {
            "id": new_job.id,
            "numeric_id": new_job.id,
            "code": f"job-{new_job.id:03d}",
            "jobCode": new_job.job_code,
            "jdCode": new_jd.jd_id,
            "title": new_job.title,
            "clientName": new_job.client_name,
            "workMode": new_job.work_mode,
            "employmentType": new_job.employment_type,
            "salaryRange": new_job.salary_range,
            "openingsCount": new_job.openings_count,
            "department": new_job.department,
            "recruiterOwner": new_job.recruiter_owner,
            "priority": new_job.priority,
            "status": new_job.status,
            "version": new_job.version,
            "location": new_job.location,
            "minYears": new_job.min_experience_years,
            "maxYears": new_job.max_experience_years,
            "requiredSkills": new_job.required_skills,
            "preferredSkills": new_job.preferred_skills,
            "description": new_job.description,
            "sourceFilename": new_jd.source_filename,
            "jobDescriptionId": new_jd.id,
            "ocrNeeded": bool(new_jd.ocr_needed),
            "createdAt": new_job.created_at.isoformat(),
        },
    }


@router.get("/{job_id}/versions")
def get_job_versions(
    job_id: str,
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Retrieve full version history for a job description without modifying existing records."""
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    # Find jobs with matching job_code or matching title to build version lineage.
    lineage_query = db.query(Job).filter(
        (Job.job_code == job.job_code) | (Job.title == job.title)
    ).order_by(Job.version.asc()).all()

    versions = []
    for ver_job in lineage_query:
        jd = db.query(JobDescription).filter(JobDescription.id == ver_job.job_description_id).first()
        versions.append({
            "job_id": ver_job.id,
            "version": ver_job.version or 1,
            "title": ver_job.title,
            "job_code": ver_job.job_code,
            "status": ver_job.status,
            "created_at": ver_job.created_at.isoformat() if ver_job.created_at else None,
            "updated_at": ver_job.updated_at.isoformat() if ver_job.updated_at else None,
            "recruiter_owner": ver_job.recruiter_owner,
            "is_current": ver_job.id == job.id,
            "source_filename": jd.source_filename if jd else "job.txt",
            "ocr_needed": bool(jd.ocr_needed) if jd else False,
        })

    return versions


# Schema for editing/updating an individual job requirement in the segmentation workspace.
class RequirementEditItem(BaseModel):
    # Optional ID of existing requirement (null for newly added items).
    id: Optional[int] = Field(default=None, description="Existing requirement ID")
    # Category code (must belong to the 15 standard categories).
    category: str = Field(..., description="One of the 15 standard recruitment categories")
    # Original or edited requirement description text.
    original_text: str = Field(..., description="Requirement description")
    # Mandatory or Preferred classification.
    classification: str = Field(default="Mandatory", description="'Mandatory' or 'Preferred'")
    # Standardized or canonical skill name.
    normalized_skill: Optional[str] = Field(default=None, description="Canonical skill name")
    # Experience in years if explicitly mentioned.
    experience_years: Optional[float] = Field(default=None, description="Experience in years")
    # Verbatim supporting source quote.
    evidence: Optional[str] = Field(default=None, description="Source quote supporting requirement")
    # Model confidence score.
    confidence: Optional[float] = Field(default=0.95, description="Confidence score")
    # Flag indicating whether this item has been verified/approved by a recruiter.
    is_approved: Optional[bool] = Field(default=True, description="Approval flag")
    # Flag to indicate item should be deleted.
    is_deleted: Optional[bool] = Field(default=False, description="Flag to delete requirement")


# Schema for updating segmentation metadata and requirements.
class UpdateSegmentationSchema(BaseModel):
    # Optional updated overview.
    job_overview: Optional[str] = Field(default=None, description="Updated job overview")
    # Optional updated role summary.
    role_summary: Optional[str] = Field(default=None, description="Updated role summary")
    # List of requirement edits (updates, additions, or deletions).
    requirements: Optional[list[RequirementEditItem]] = Field(default=None, description="List of requirement edits")


# Schema for approving segmentation.
class ApproveSegmentationSchema(BaseModel):
    # Recruiter name or identifier recording approval.
    approver: Optional[str] = Field(default="Recruiter", description="Approving recruiter identity")


@router.post("/{job_id}/segment")
def segment_job(
    job_id: str,
    force: bool = Query(default=False, description="Force re-segmentation even if previously approved"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Execute AI-powered segmentation into 15 categories for a job description."""
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    # Check if segmentation already exists and is approved.
    existing_seg = db.query(JDSegmentation).filter(
        JDSegmentation.job_id == job.id
    ).order_by(JDSegmentation.version.desc()).first()

    if existing_seg and existing_seg.is_approved == 1 and not force:
        # Return existing approved segmentation unless force flag is explicitly provided.
        return {
            "status": "already_approved",
            "message": "Segmentation was already approved by recruiter. Pass force=true to re-segment.",
            "segmentation": get_segmentation_dict(existing_seg),
        }

    # Execute segmentation pipeline.
    segmentation = segment_job_description(db, job, force_resegment=force)

    return {
        "status": "success",
        "message": f"Job '{job.title}' segmented into 15 categories successfully.",
        "segmentation": get_segmentation_dict(segmentation),
    }


@router.get("/{job_id}/segmentation")
def get_job_segmentation(
    job_id: str,
    version: Optional[int] = Query(default=None, description="Optional historical segmentation version number"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve structured 15-category segmentation and evidence for a job."""
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    # Query specific version if requested; otherwise retrieve the latest version.
    query = db.query(JDSegmentation).filter(JDSegmentation.job_id == job.id)
    if version is not None:
        segmentation = query.filter(JDSegmentation.version == version).first()
        if not segmentation:
            raise HTTPException(status_code=404, detail=f"Segmentation version {version} not found for this job.")
    else:
        segmentation = query.order_by(JDSegmentation.version.desc()).first()

    if not segmentation:
        # If no segmentation exists yet, generate initial segmentation so recruiter can review immediately.
        segmentation = segment_job_description(db, job)

    return {
        "status": "success",
        "segmentation": get_segmentation_dict(segmentation),
    }


@router.get("/{job_id}/segmentation/versions")
def get_job_segmentation_versions(
    job_id: str,
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Retrieve historical segmentation versions for a job to inspect revision lineage."""
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    # Query all historical segmentations ordered newest first.
    seg_list = db.query(JDSegmentation).filter(
        JDSegmentation.job_id == job.id
    ).order_by(JDSegmentation.version.desc()).all()

    latest_version = seg_list[0].version if seg_list else 1

    return [
        {
            "id": s.id,
            "version": s.version,
            "status": s.status,
            "is_approved": bool(s.is_approved),
            "approved_by": s.approved_by,
            "approved_at": s.approved_at.isoformat() if s.approved_at else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "total_requirements": len(s.requirements),
            "model_name": s.model_name,
            "is_current": s.version == latest_version,
        }
        for s in seg_list
    ]


@router.put("/{job_id}/segmentation")
def update_job_segmentation(
    job_id: str,
    payload: UpdateSegmentationSchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Allow recruiter to edit requirements, toggle Mandatory/Preferred, and add/delete items."""
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    segmentation = db.query(JDSegmentation).filter(
        JDSegmentation.job_id == job.id
    ).order_by(JDSegmentation.version.desc()).first()

    if not segmentation:
        raise HTTPException(status_code=404, detail="No segmentation record found to update.")

    # Update overview and summary if supplied.
    if payload.job_overview is not None:
        segmentation.job_overview = payload.job_overview
    if payload.role_summary is not None:
        segmentation.role_summary = payload.role_summary

    segmentation.updated_at = datetime.now(timezone.utc)

    # Process individual requirement edits, additions, and deletions.
    if payload.requirements is not None:
        # Compute monotonic starting order index across existing requirements for newly added rows.
        next_order_index = max((r.order_index or 0 for r in (segmentation.requirements or [])), default=-1) + 1
        for item in payload.requirements:
            if item.is_deleted and item.id:
                # Delete requirement item if flagged.
                existing_item = db.query(JobRequirement).filter(
                    JobRequirement.id == item.id,
                    JobRequirement.segmentation_id == segmentation.id,
                ).first()
                if existing_item:
                    db.delete(existing_item)
            elif item.id:
                # Update existing requirement.
                existing_item = db.query(JobRequirement).filter(
                    JobRequirement.id == item.id,
                    JobRequirement.segmentation_id == segmentation.id,
                ).first()
                if existing_item:
                    existing_item.category = item.category
                    existing_item.original_text = item.original_text
                    existing_item.classification = item.classification
                    existing_item.normalized_skill = item.normalized_skill
                    existing_item.experience_years = item.experience_years
                    existing_item.evidence = item.evidence
                    existing_item.confidence = item.confidence or existing_item.confidence
                    existing_item.is_approved = 1 if item.is_approved else 0
                    existing_item.source_origin = "recruiter_edited"
                    existing_item.updated_at = datetime.now(timezone.utc)
            else:
                # Add new recruiter-authored requirement with monotonically incrementing order index.
                new_item = JobRequirement(
                    segmentation_id=segmentation.id,
                    category=item.category,
                    original_text=item.original_text,
                    classification=item.classification,
                    normalized_skill=item.normalized_skill,
                    experience_years=item.experience_years,
                    evidence=item.evidence,
                    confidence=item.confidence or 1.0,
                    is_approved=1,
                    order_index=next_order_index,
                    source_origin="recruiter_added",
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                # Increment order_index so multiple additions in the same batch stay uniquely ordered.
                next_order_index += 1
                db.add(new_item)
        # Flush requirement inserts and deletions before refreshing parent segmentation.
        db.flush()

    # Log recruiter edit activity event.
    db.add(ActivityEvent(
        event_type="segmentation_updated",
        summary=f"Recruiter updated segmentation requirements for job '{job.title}'",
        entity_type="job",
        entity_id=str(job.id),
        created_at=datetime.now(timezone.utc),
    ))

    db.commit()
    db.refresh(segmentation)

    return {
        "status": "success",
        "message": "Segmentation updated successfully.",
        "segmentation": get_segmentation_dict(segmentation),
    }


@router.post("/{job_id}/approve-segmentation")
def approve_job_segmentation(
    job_id: str,
    payload: Optional[ApproveSegmentationSchema] = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Approve final JD segmentation and synchronize approved skills into Job."""
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    segmentation = db.query(JDSegmentation).filter(
        JDSegmentation.job_id == job.id
    ).order_by(JDSegmentation.version.desc()).first()

    if not segmentation:
        raise HTTPException(status_code=404, detail="No segmentation record found to approve.")

    approver_name = payload.approver if payload and payload.approver else "Talent Acquisition Recruiter"

    # Mark segmentation as approved.
    segmentation.status = "approved"
    segmentation.is_approved = 1
    segmentation.approved_by = approver_name
    segmentation.approved_at = datetime.now(timezone.utc)
    segmentation.updated_at = datetime.now(timezone.utc)

    # Mark all linked requirements as approved.
    for req in segmentation.requirements:
        req.is_approved = 1
        req.updated_at = datetime.now(timezone.utc)

    # Synchronize mandatory and preferred skills to the Job model for candidate matching.
    skill_categories = {"mandatory_skills", "preferred_skills", "technical_skills", "tools_and_technologies", "domain_knowledge"}
    
    # Helper to clean and validate recruiter-facing skill names, rejecting paragraph sentences and raw section tags.
    def _clean_skill_token(raw_val: Optional[str]) -> Optional[str]:
        if not raw_val or not isinstance(raw_val, str):
            return None
        trimmed = raw_val.strip()
        # Reject raw section metadata strings.
        if trimmed.startswith("[section=") or "[source_line=" in trimmed or "[category=" in trimmed:
            return None
        # Reject full paragraph sentences exceeding standard skill phrase length.
        if len(trimmed.split()) > 7:
            return None
        # Strip common boilerplates if present.
        cleaned = re.sub(
            r'^(must have|nice to have|mandatory|preferred)?\s*(mastery of|expertise in|proficiency in|knowledge of|experience with|experience in)\s+',
            '',
            trimmed,
            flags=re.IGNORECASE,
        ).strip()
        return cleaned if len(cleaned) >= 2 else None

    # Collect valid mandatory skills from approved requirements.
    new_mandatory_skills = []
    for r in segmentation.requirements:
        if r.classification == "Mandatory" and r.category in skill_categories:
            candidate_val = _clean_skill_token(r.normalized_skill) or _clean_skill_token(r.original_text)
            if candidate_val and candidate_val not in new_mandatory_skills:
                new_mandatory_skills.append(candidate_val)

    # Collect valid preferred skills from approved requirements.
    new_preferred_skills = []
    for r in segmentation.requirements:
        if r.classification == "Preferred" and r.category in skill_categories:
            candidate_val = _clean_skill_token(r.normalized_skill) or _clean_skill_token(r.original_text)
            if candidate_val and candidate_val not in new_preferred_skills:
                new_preferred_skills.append(candidate_val)

    # Retrieve previously synchronized skills tracked on the Job model.
    previously_synced_mandatory = set(job.synced_mandatory_skills or [])
    previously_synced_preferred = set(job.synced_preferred_skills or [])

    # Preserve any manually maintained skills added directly to the job by recruiters.
    manual_required = [s for s in (job.required_skills or []) if s not in previously_synced_mandatory]
    manual_preferred = [s for s in (job.preferred_skills or []) if s not in previously_synced_preferred]

    # Re-approval cleanly replaces only previously synchronized JD skills, preserving manual skills and unrelated job attributes.
    job.required_skills = list(dict.fromkeys(manual_required + new_mandatory_skills))
    job.preferred_skills = list(dict.fromkeys(manual_preferred + new_preferred_skills))

    # Record the active synchronized JD skills for future re-approval isolation.
    job.synced_mandatory_skills = new_mandatory_skills
    job.synced_preferred_skills = new_preferred_skills

    job.updated_at = datetime.now(timezone.utc)

    # Log activity event in audit feed.
    db.add(ActivityEvent(
        event_type="segmentation_approved",
        summary=f"Segmentation approved for job '{job.title}' by {approver_name}",
        entity_type="job",
        entity_id=str(job.id),
        created_at=datetime.now(timezone.utc),
    ))

    db.commit()
    db.refresh(segmentation)
    db.refresh(job)

    return {
        "status": "success",
        "message": f"Segmentation for job '{job.title}' approved successfully.",
        "segmentation": get_segmentation_dict(segmentation),
    }


# Schema for requesting JD embedding generation.
class GenerateJDEmbeddingsSchema(BaseModel):
    # Optional explicit segmentation ID to embed (defaults to latest approved version).
    segmentation_id: Optional[int] = Field(default=None, description="Target approved segmentation ID")
    # Flag to force vector generation even if text hashes match existing embeddings.
    force: bool = Field(default=False, description="Force regeneration of embeddings")


@router.post("/{job_id}/embeddings/generate")
def generate_job_embeddings(
    job_id: str,
    payload: Optional[GenerateJDEmbeddingsSchema] = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Generate 2048-dim embeddings for an approved JD segmentation and its requirements."""
    # Parse integer ID from string parameter.
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    # Confirm job exists in SQLite.
    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    # Resolve target segmentation ID.
    target_seg_id = payload.segmentation_id if payload else None
    force_gen = payload.force if payload else False

    if target_seg_id is not None:
        # Check specific segmentation.
        seg = db.query(JDSegmentation).filter(
            JDSegmentation.id == target_seg_id,
            JDSegmentation.job_id == job.id,
        ).first()
        if not seg:
            raise HTTPException(status_code=404, detail=f"Segmentation ID {target_seg_id} not found for this job.")
    else:
        # Resolve active approved segmentation for this job.
        seg = get_active_approved_segmentation(db, job.id)
        if not seg:
            raise HTTPException(
                status_code=400,
                detail="No approved segmentation found for this job. Approve a segmentation before generating embeddings.",
            )

    # Enforce approval safeguard: reject unapproved segmentations.
    if seg.is_approved != 1 or seg.status != "approved":
        raise HTTPException(
            status_code=400,
            detail=f"Segmentation {seg.id} is not approved (status: '{seg.status}'). Embeddings require explicit recruiter approval.",
        )

    # Execute embedding generation workflow.
    try:
        result = generate_segmentation_embeddings(
            db=db,
            segmentation_id=seg.id,
            force=force_gen,
        )
    except Exception:
        # Return sanitized 500 error without exposing internal stack or API details.
        raise HTTPException(status_code=500, detail="Embedding generation failed due to an internal processing error.")

    # Record event in activity feed.
    db.add(ActivityEvent(
        event_type="jd_embeddings_generated",
        summary=f"Generated {result['generated_count']} and reused {result['reused_count']} embeddings for job '{job.title}' (v{seg.version})",
        entity_type="job",
        entity_id=str(job.id),
        created_at=datetime.now(timezone.utc),
    ))
    db.commit()

    return result


@router.get("/{job_id}/embeddings/status")
def get_job_embeddings_status(
    job_id: str,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve embedding readiness and completion status for a job's active approved segmentation."""
    # Parse job identifier.
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    # Confirm job exists.
    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    # Return status report.
    return get_job_embedding_status(db, job.id)


@router.get("/{job_id}/embeddings")
def list_job_embeddings_metadata(
    job_id: str,
    segmentation_id: Optional[int] = Query(default=None, description="Filter embeddings by segmentation ID"),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Retrieve metadata for stored JD embeddings without exposing raw vector arrays."""
    # Parse job identifier.
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    # Confirm job exists.
    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    # Return embeddings metadata safely handling direct and FastAPI-injected parameter calls.
    seg_id = segmentation_id if isinstance(segmentation_id, int) else None
    return get_job_embeddings_metadata(db, job.id, segmentation_id=seg_id)


# Schemas for Boolean queries and structured scope updates
class BooleanQueryRequestSchema(BaseModel):
    custom_mandatory: Optional[list[str]] = None
    custom_preferred: Optional[list[str]] = None
    custom_exclusions: Optional[list[str]] = None
    target_companies: Optional[list[str]] = None


class UpdateStructuredScopeSchema(BaseModel):
    role_overview: Optional[str] = None
    business_context: Optional[str] = None
    technical_scope: Optional[str] = None
    core_responsibilities: Optional[list[str]] = None
    functional_responsibilities: Optional[list[str]] = None
    required_skills: Optional[list[str]] = None
    preferred_skills: Optional[list[str]] = None
    domain_expertise: Optional[list[str]] = None
    experience_requirements: Optional[str] = None
    deliverables: Optional[list[str]] = None
    missing_information: Optional[list[str]] = None


@router.get("/{job_id}/intelligence")
def get_job_intelligence(
    job_id: str,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve full structured JD intelligence, 12-section scope, and multi-platform Boolean queries."""
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    intel = analyze_job_description_intelligence(db=db, job_id=job.id, force_refresh=False)
    return intel.model_dump()


@router.post("/{job_id}/analyze-intelligence")
def analyze_job_intelligence(
    job_id: str,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Force re-run of deep JD Intelligence extraction pipeline with AI and deterministic fallback."""
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    intel = analyze_job_description_intelligence(db=db, job_id=job.id, force_refresh=True)
    return {
        "status": "success",
        "message": f"Intelligence successfully generated for '{job.title}'",
        "intelligence": intel.model_dump(),
    }


@router.post("/{job_id}/boolean-queries")
def get_job_boolean_queries(
    job_id: str,
    payload: Optional[BooleanQueryRequestSchema] = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Generate platform-specific Boolean queries (Naukri, LinkedIn, X-Ray, Simple Keywords, Advanced)."""
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    # Retrieve current intelligence or generate
    intel = analyze_job_description_intelligence(db=db, job_id=job.id, force_refresh=False)

    mand_skills = payload.custom_mandatory if (payload and payload.custom_mandatory is not None) else intel.technical_skills.mandatory_skills
    pref_skills = payload.custom_preferred if (payload and payload.custom_preferred is not None) else intel.technical_skills.preferred_skills
    exclusions = payload.custom_exclusions if (payload and payload.custom_exclusions is not None) else ["Intern", "Trainee", "Student", "Fresher"]

    queries = generate_boolean_queries(
        title=job.title,
        mandatory_skills=mand_skills,
        preferred_skills=pref_skills,
        domain_terms=intel.domain_intelligence.industry_terminology,
        alternative_titles=intel.role_intelligence.alternative_titles,
        location=job.location,
        experience_years=job.min_experience_years,
        target_companies=payload.target_companies if payload else None,
        exclusions=exclusions,
        job_id=job.id,
    )
    return queries.model_dump()


@router.put("/{job_id}/structured-scope")
def update_job_structured_scope(
    job_id: str,
    payload: UpdateStructuredScopeSchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Save recruiter edits to the 12-section structured scope while preserving original source text."""
    raw_id = job_id.replace("job-", "").lstrip("0") or "0"
    try:
        j_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")

    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    segmentation = (
        db.query(JDSegmentation)
        .filter(JDSegmentation.job_id == job.id)
        .order_by(JDSegmentation.version.desc())
        .first()
    )
    if not segmentation:
        raise HTTPException(status_code=404, detail="No segmentation found to update.")

    scope = segmentation.structured_scope or {}
    if payload.role_overview is not None:
        scope["role_overview"] = payload.role_overview
    if payload.business_context is not None:
        scope["business_context"] = payload.business_context
    if payload.technical_scope is not None:
        scope["technical_scope"] = payload.technical_scope
    if payload.core_responsibilities is not None:
        scope["core_responsibilities"] = payload.core_responsibilities
    if payload.functional_responsibilities is not None:
        scope["functional_responsibilities"] = payload.functional_responsibilities
    if payload.required_skills is not None:
        scope["required_skills"] = payload.required_skills
        job.required_skills = payload.required_skills
    if payload.preferred_skills is not None:
        scope["preferred_skills"] = payload.preferred_skills
        job.preferred_skills = payload.preferred_skills
    if payload.domain_expertise is not None:
        scope["domain_expertise"] = payload.domain_expertise
    if payload.experience_requirements is not None:
        scope["experience_requirements"] = payload.experience_requirements
    if payload.deliverables is not None:
        scope["deliverables"] = payload.deliverables
    if payload.missing_information is not None:
        scope["missing_information"] = payload.missing_information

    segmentation.structured_scope = scope
    segmentation.updated_at = datetime.now(timezone.utc)

    # If intelligence_data exists, update its structured_scope too
    if segmentation.intelligence_data and isinstance(segmentation.intelligence_data, dict):
        intel_dict = dict(segmentation.intelligence_data)
        intel_dict["structured_scope"] = scope
        segmentation.intelligence_data = intel_dict

    db.commit()
    db.refresh(segmentation)
    db.refresh(job)

    return {
        "status": "success",
        "message": f"Structured scope for '{job.title}' updated successfully.",
        "structured_scope": scope,
    }



