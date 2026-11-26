# Import APIRouter, Depends, HTTPException, Query, UploadFile, File, status from FastAPI.
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
# Import Session dependency and func helpers from SQLAlchemy.
from sqlalchemy.orm import Session
from sqlalchemy import func
# Import typing helpers.
from typing import Any, Optional
# Import Path for local filesystem paths.
from pathlib import Path
# Import regex, uuid, and hashlib for resume ingestion.
import re
import uuid
import hashlib
# Import Pydantic models for request validation and response serialization.
from pydantic import BaseModel, Field
# Import database session dependency.
from database.sqlite_connection import get_db
# Import database models.
from database.models import Candidate, Resume, ResumeEmbedding, Interview, ActivityEvent
# Import datetime and timezone for audit and creation timestamps.
from datetime import datetime, timezone
# Import tool helper for extracting clean professional role titles.
from app.agent.tools import extract_candidate_role
# Import text extractor and profile parser for authentic resume ingestion.
from app.resume_extractor import extract_resume_text
from app.resume_profile_parser import parse_resume_profile
# Import filename sanitizer to eliminate path traversal risks during upload.
from app.services.jd_extraction_service import sanitize_filename
# Import candidate embedding coverage and backfill services.
from app.services.candidate_embedding_service import (
    get_candidate_embedding_coverage,
    get_missing_candidate_embeddings,
    backfill_candidate_embeddings,
    get_backfill_status,
)

# Create a modular FastAPI router for all candidate-related endpoints.
router = APIRouter(prefix="/api/candidates", tags=["Candidates"])

# Configure the destination directory for uploaded candidate resume files.
RESUMES_UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "resumes"
# Enforce 25 MB maximum upload size to protect server memory and storage.
MAX_RESUME_UPLOAD_BYTES = 25 * 1024 * 1024


# Schema for updating a candidate's operational stage or availability.
class CandidateUpdateSchema(BaseModel):
    # Optional pipeline stage (e.g. Screened, Shortlisted, Interviewing, Offered, Hired, Rejected).
    stage: Optional[str] = Field(default=None, description="Pipeline stage of the candidate")
    # Optional availability notice period (e.g. Immediate, 15 Days, 30 Days).
    availability: Optional[str] = Field(default=None, description="Availability or notice period")
    # Optional summary text.
    summary: Optional[str] = Field(default=None, description="Candidate summary")


# Schema for scheduling an interview round for a candidate.
class InterviewCreateSchema(BaseModel):
    # Round name (e.g. Technical Round 1, Manager Round).
    round_name: str = Field(..., description="Name of the interview round")
    # Interview status (default Scheduled).
    status: str = Field(default="Scheduled", description="Status of the interview")
    # Assigned interviewer name.
    interviewer: str = Field(..., description="Name of the interviewer")
    # Scheduled ISO timestamp string.
    scheduled_at: Optional[str] = Field(default=None, description="Scheduled date and time")
    # Meeting URL or room.
    meeting_link: Optional[str] = Field(default=None, description="Video meeting URL")
    # Optional notes.
    notes: Optional[str] = Field(default=None, description="Interview notes")


@router.get("")
def list_candidates(
    search: Optional[str] = Query(default=None, description="Full-text search by name or skill"),
    location: Optional[str] = Query(default=None, description="Filter by candidate location"),
    availability: Optional[str] = Query(default=None, description="Filter by availability notice"),
    skill: Optional[str] = Query(default=None, description="Filter by specific skill"),
    stage: Optional[str] = Query(default=None, description="Filter by pipeline stage"),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Retrieve all candidates from SQLite with honest metadata, resume counts, and latest scheduled interview."""
    candidates = db.query(Candidate).order_by(Candidate.id.asc()).all()

    # Pre-load resume counts and latest interview per candidate in bulk to avoid N+1 SQL queries.
    resume_rows = db.query(Resume).order_by(Resume.id.asc()).all()
    resumes_by_cand: dict[int, list[Resume]] = {}
    for r in resume_rows:
        resumes_by_cand.setdefault(r.candidate_id, []).append(r)

    interview_rows = db.query(Interview).order_by(Interview.id.asc()).all()
    latest_interview_by_cand: dict[int, Interview] = {}
    for iv in interview_rows:
        latest_interview_by_cand[iv.candidate_id] = iv

    results = []
    for cand in candidates:
        # Check text search matching candidate name, skills, or summary.
        if isinstance(search, str) and search.strip():
            s = search.lower().strip()
            matches_name = cand.name and s in cand.name.lower()
            matches_skills = any(s in str(sk).lower() for sk in (cand.skills or []))
            matches_summary = cand.summary and s in cand.summary.lower()
            if not (matches_name or matches_skills or matches_summary):
                continue

        # Check location filter when supplied.
        if isinstance(location, str) and location.strip():
            if not cand.location or location.lower().strip() not in cand.location.lower():
                continue

        # Check availability filter when supplied.
        if isinstance(availability, str) and availability.strip():
            if not cand.availability or availability.lower().strip() not in cand.availability.lower():
                continue

        # Check skill filter when supplied.
        if isinstance(skill, str) and skill.strip():
            if not cand.skills or not any(skill.lower().strip() in str(sk).lower() for sk in cand.skills):
                continue

        # Check pipeline stage filter when supplied.
        if isinstance(stage, str) and stage.strip():
            if not cand.stage or stage.lower().strip() != cand.stage.lower().strip():
                continue

        # Retrieve candidate's linked resumes and latest interview cleanly.
        cand_resumes = resumes_by_cand.get(cand.id, [])
        resume_obj = cand_resumes[0] if cand_resumes else None
        evidence_list = []
        if resume_obj and resume_obj.embedding and resume_obj.embedding.embedding_metadata:
            evidence_list = resume_obj.embedding.embedding_metadata.get("evidence", [])

        latest_iv = latest_interview_by_cand.get(cand.id)
        scheduled_iv = (
            {
                "id": latest_iv.id,
                "round": latest_iv.round_name,
                "status": latest_iv.status,
                "interviewer": latest_iv.interviewer,
                "date": latest_iv.scheduled_at,
                "meetingLink": latest_iv.meeting_link,
            }
            if latest_iv
            else None
        )

        # Extract clean role title and preserve actual candidate profile fields without hardcoded fake match scores.
        cand_role = extract_candidate_role(cand.summary)
        cand_all_skills = list(cand.skills or [])

        results.append({
            "id": cand.id,
            "numeric_id": cand.id,
            "code": f"cand-{cand.id:03d}",
            "name": cand.name or "Unnamed Candidate",
            "email": cand.email or "",
            "phone": cand.phone or "",
            "currentRole": cand_role,
            # Return stored experience directly without inventing 5.0 years when null.
            "experienceYears": cand.experience_years,
            "location": cand.location or "Not specified",
            "availability": cand.availability or "Not specified",
            "status": cand.stage or "New",
            # Candidate list is job-agnostic; leave matchScore null unless evaluated against a JD.
            "matchScore": None,
            "skills": cand_all_skills,
            "primarySkills": cand_all_skills[:4],
            "secondarySkills": cand_all_skills[4:],
            "summary": cand.summary or "",
            "resumeFilename": resume_obj.source_filename if resume_obj else None,
            "resume_count": len(cand_resumes),
            "evidenceHighlights": evidence_list,
            "scheduledInterview": scheduled_iv,
        })

    return results


@router.get("/interviews/all")
def list_all_interviews(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """Retrieve all persisted interview records joined with candidate profile identity."""
    rows = (
        db.query(Interview, Candidate)
        .join(Candidate, Interview.candidate_id == Candidate.id)
        .order_by(Interview.created_at.desc(), Interview.id.desc())
        .all()
    )
    return [
        {
            "id": iv.id,
            "candidateId": cand.id,
            "candidateName": cand.name or "Unnamed Candidate",
            "candidateStage": cand.stage,
            "role": extract_candidate_role(cand.summary),
            "round": iv.round_name,
            "status": iv.status,
            "interviewer": iv.interviewer,
            "date": iv.scheduled_at,
            "meetingLink": iv.meeting_link,
            "notes": iv.notes,
            "createdAt": iv.created_at.isoformat() if iv.created_at else None,
        }
        for iv, cand in rows
    ]


# Schema for candidate embedding backfill requests.
class CandidateBackfillRequest(BaseModel):
    # Number of candidate resumes to process in this backfill iteration (1 to 100).
    batch_size: int = Field(default=15, ge=1, le=100, description="Batch size for backfill processing")
    # Flag to force vector generation even if an existing embedding with matching hash exists.
    force: bool = Field(default=False, description="Force vector regeneration")


@router.get("/embeddings/coverage")
def candidate_embeddings_coverage(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Retrieve candidate resume embedding coverage metrics and model compatibility audit."""
    return get_candidate_embedding_coverage(db)


@router.get("/embeddings/missing")
def candidate_embeddings_missing(
    limit: int = Query(default=50, ge=1, le=200, description="Maximum number of missing items to list"),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Retrieve metadata descriptors for candidate resumes lacking 2048-dimensional embeddings."""
    return get_missing_candidate_embeddings(db, limit=limit)


@router.post("/embeddings/backfill")
def trigger_candidate_embeddings_backfill(
    payload: Optional[CandidateBackfillRequest] = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Trigger controlled batch generation of missing candidate resume embeddings."""
    batch_size = payload.batch_size if payload else 15
    force = payload.force if payload else False
    return backfill_candidate_embeddings(db, batch_size=batch_size, force=force)


@router.get("/embeddings/backfill/status")
def candidate_embeddings_backfill_status(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Retrieve the status and statistics of the most recent candidate backfill operation."""
    return get_backfill_status(db)


@router.get("/{candidate_id}")
def get_candidate(candidate_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Retrieve deep candidate facts, multi-version resume list, interviews, and activity timeline."""
    raw_id = candidate_id.replace("cand-", "").lstrip("0") or "0"
    try:
        c_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid candidate ID format.")

    candidate = db.query(Candidate).filter(Candidate.id == c_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    # Retrieve all associated resumes (supporting multi-version resume inspection) and vector metadata.
    candidate_resumes = db.query(Resume).filter(Resume.candidate_id == candidate.id).order_by(Resume.id.asc()).all()
    resume_obj = candidate_resumes[0] if candidate_resumes else None
    evidence_list = []
    sha256 = ""
    filename = None
    if resume_obj:
        filename = resume_obj.source_filename
        sha256 = resume_obj.content_sha256
        if resume_obj.embedding and resume_obj.embedding.embedding_metadata:
            evidence_list = resume_obj.embedding.embedding_metadata.get("evidence", [])

    # Serialize all resume versions belonging to this candidate with version IDs for preview and download.
    resumes_list = []
    for r in candidate_resumes:
        resumes_list.append({
            "id": r.id,
            "filename": r.source_filename,
            "sha256": r.content_sha256,
            "uploadedAt": r.created_at.strftime("%Y-%m-%d %H:%M") if getattr(r, "created_at", None) else "Indexed",
            "hasEmbedding": bool(r.embedding),
        })

    # Fetch scheduled interviews for this candidate.
    interviews = db.query(Interview).filter(Interview.candidate_id == candidate.id).order_by(Interview.id.asc()).all()
    latest_interview = None
    if interviews:
        last = interviews[-1]
        latest_interview = {
            "id": last.id,
            "round": last.round_name,
            "status": last.status,
            "interviewer": last.interviewer,
            "date": last.scheduled_at,
            "meetingLink": last.meeting_link,
        }

    # Fetch chronological activity timeline events for this candidate.
    timeline_events = (
        db.query(ActivityEvent)
        .filter(ActivityEvent.entity_type == "candidate", ActivityEvent.entity_id == str(candidate.id))
        .order_by(ActivityEvent.created_at.desc())
        .all()
    )
    timeline_list = [
        {
            "id": ev.id,
            "type": ev.event_type,
            "title": ev.event_type.replace("_", " ").title(),
            "summary": ev.summary,
            "time": ev.created_at.strftime("%b %d, %I:%M %p") if ev.created_at else "Recent",
        }
        for ev in timeline_events
    ]

    cand_role = extract_candidate_role(candidate.summary)
    cand_all_skills = list(candidate.skills or [])

    return {
        "id": candidate.id,
        "numeric_id": candidate.id,
        "code": f"cand-{candidate.id:03d}",
        "name": candidate.name or "Unnamed Candidate",
        "email": candidate.email or "",
        "phone": candidate.phone or "",
        "currentRole": cand_role,
        "experienceYears": candidate.experience_years,
        "location": candidate.location or "Not specified",
        "availability": candidate.availability or "Not specified",
        "status": candidate.stage or "New",
        "matchScore": None,
        "skills": cand_all_skills,
        "primarySkills": cand_all_skills[:4],
        "secondarySkills": cand_all_skills[4:],
        "summary": candidate.summary or "",
        "resumeFilename": filename,
        "resume_count": len(candidate_resumes),
        "contentSha256": sha256,
        "resumes": resumes_list,
        "interviews": [
            {
                "id": iv.id,
                "round": iv.round_name,
                "status": iv.status,
                "interviewer": iv.interviewer,
                "date": iv.scheduled_at,
                "meetingLink": iv.meeting_link,
                "notes": iv.notes,
            }
            for iv in interviews
        ],
        "timeline": timeline_list,
        "evidenceHighlights": evidence_list,
        "scheduledInterview": latest_interview,
    }


@router.get("/{candidate_id}/resume-text")
def get_candidate_resume_text(
    candidate_id: str,
    resume_id: Optional[int] = Query(default=None, description="Specific resume version ID to extract"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve full readable resume document text for a specific resume version or primary resume."""
    raw_id = candidate_id.replace("cand-", "").lstrip("0") or "0"
    try:
        c_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid candidate ID format.")

    candidate = db.query(Candidate).filter(Candidate.id == c_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    # Select requested resume version when resume_id is provided; otherwise load primary resume.
    resume_query = db.query(Resume).filter(Resume.candidate_id == candidate.id)
    if resume_id is not None:
        resume_obj = resume_query.filter(Resume.id == resume_id).first()
        if not resume_obj:
            raise HTTPException(status_code=404, detail="Requested resume version not found for this candidate.")
    else:
        resume_obj = resume_query.order_by(Resume.id.asc()).first()

    full_text = ""
    filename = None
    sha256 = ""
    selected_resume_id = resume_obj.id if resume_obj else None

    if resume_obj:
        filename = resume_obj.source_filename
        sha256 = resume_obj.content_sha256
        file_path_obj = Path(resume_obj.file_path)
        if file_path_obj.exists():
            try:
                extracted = extract_resume_text(file_path_obj)
                full_text = extracted.get("text", "")
            except Exception as read_err:
                full_text = f"Error reading resume document text ({type(read_err).__name__})."
        else:
            full_text = "Original resume document file is unavailable at its recorded storage location."

    if not full_text or not full_text.strip():
        # Present clearly labeled indexed database summary rather than inventing missing file contents.
        full_text = (
            f"[Indexed Candidate Profile Overview — Disk Document Text Unavailable]\n"
            f"Name: {candidate.name}\n"
            f"Role: {extract_candidate_role(candidate.summary)}\n"
            f"Email: {candidate.email or 'Not provided'}\n"
            f"Phone: {candidate.phone or 'Not provided'}\n"
            f"Location: {candidate.location or 'Not specified'}\n"
            f"Experience: {candidate.experience_years if candidate.experience_years is not None else 'Not specified'}\n\n"
            f"Indexed Summary:\n{candidate.summary or 'No summary stored.'}\n\n"
            f"Indexed Skills:\n"
            + "\n".join([f"• {sk}" for sk in (candidate.skills or [])])
        )

    return {
        "candidate_id": candidate.id,
        "resume_id": selected_resume_id,
        "name": candidate.name,
        "email": candidate.email or "",
        "phone": candidate.phone or "",
        "location": candidate.location or "Not specified",
        "role": extract_candidate_role(candidate.summary),
        "filename": filename or "profile_summary.txt",
        "content_sha256": sha256,
        "full_text": full_text,
    }


@router.post("/upload-resume")
async def upload_candidate_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Upload a resume file safely, extract authentic facts with parse_resume_profile, and persist to SQLite."""
    # Sanitize uploaded filename immediately to prevent path traversal vulnerabilities.
    safe_name = sanitize_filename(file.filename or "resume.txt")
    ext = Path(safe_name).suffix.lower()
    if ext not in [".pdf", ".docx", ".doc", ".txt"]:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, DOC, and TXT files are supported.")

    content = await file.read()
    # Reject empty uploads and oversized payloads exceeding 25 MB.
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded resume file is empty.")
    if len(content) > MAX_RESUME_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Resume upload exceeds the 25 MB file size limit.")

    sha256 = hashlib.sha256(content).hexdigest()

    # Check for duplicate resume content before creating records or touching disk.
    existing_resume = db.query(Resume).filter(Resume.content_sha256 == sha256).first()
    if existing_resume:
        raise HTTPException(
            status_code=409,
            detail=f"Duplicate resume content detected (already indexed as '{existing_resume.source_filename}' for candidate #{existing_resume.candidate_id}).",
        )

    # Save into an isolated unique subdirectory inside RESUMES_UPLOAD_DIR so files never collide or overwrite.
    resumes_dir = RESUMES_UPLOAD_DIR
    upload_subdir = resumes_dir / "uploads" / uuid.uuid4().hex[:12]
    upload_subdir.mkdir(parents=True, exist_ok=True)
    target_path = upload_subdir / safe_name

    with open(target_path, "wb") as f:
        f.write(content)

    # Extract text from uploaded document cleanly.
    try:
        text_data = extract_resume_text(target_path)
        resume_text = text_data.get("text", "")
    except Exception:
        resume_text = ""

    # Use authentic deterministic profile parser when text was extracted.
    parsed = None
    if resume_text and resume_text.strip():
        try:
            parsed = parse_resume_profile(resume_text)
        except Exception:
            parsed = None

    emails = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', resume_text or "")
    phones = re.findall(r'(?:\+?91[\s-]?)?[6789]\d{4}[\s-]?\d{5}', resume_text or "")

    clean_stem = Path(safe_name).stem
    fallback_name = re.sub(r"\[.*?\]", "", clean_stem).replace("_", " ").replace("-", " ").strip().title() or "Candidate"
    cand_name = (parsed.name if parsed and parsed.name else fallback_name)
    cand_email = (parsed.email if parsed and parsed.email else (emails[0] if emails else None))
    cand_phone = phones[0] if phones else None
    cand_exp = parsed.experience_years if parsed and parsed.experience_years is not None else None
    cand_loc = parsed.location if parsed and parsed.location else None

    # Combine parsed canonical skills with domain skills extracted cleanly from text.
    found_skills = list(parsed.skills) if parsed and parsed.skills else []
    for sk in [".NET", "C#", "React", "SAP", "SAP CPI", "Oracle FCCS", "Oracle EPM", "Teamcenter", "BMIDE", "Spring Boot"]:
        if resume_text and sk.lower() in resume_text.lower() and sk not in found_skills:
            found_skills.append(sk)

    # Store genuine extracted summary excerpt rather than fabricating placeholder statements.
    summary_text = (
        re.sub(r"\s+", " ", resume_text.strip())[:500]
        if resume_text and resume_text.strip()
        else f"Uploaded document '{safe_name}' (pending OCR/text verification)."
    )

    new_candidate = Candidate(
        name=cand_name,
        email=cand_email,
        phone=cand_phone,
        skills=found_skills,
        experience_years=cand_exp,
        location=cand_loc,
        availability=None,
        stage="New",
        summary=summary_text,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_candidate)
    db.commit()
    db.refresh(new_candidate)

    new_resume = Resume(
        candidate_id=new_candidate.id,
        source_filename=safe_name,
        file_path=str(target_path.resolve()),
        content_sha256=sha256,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_resume)
    db.flush()

    db.add(ActivityEvent(
        event_type="resume_uploaded",
        summary=f"Resume uploaded and candidate profile created: {cand_name} ({safe_name})",
        entity_type="candidate",
        entity_id=str(new_candidate.id),
        created_at=datetime.now(timezone.utc),
    ))
    db.commit()
    db.refresh(new_resume)

    return {
        "status": "success",
        "message": f"Resume '{safe_name}' uploaded and candidate '{cand_name}' created (embedding pending backfill).",
        "resume_id": new_resume.id,
        "candidate": {
            "id": new_candidate.id,
            "numeric_id": new_candidate.id,
            "code": f"cand-{new_candidate.id:03d}",
            "name": new_candidate.name,
            "email": new_candidate.email or "",
            "phone": new_candidate.phone or "",
            "currentRole": extract_candidate_role(new_candidate.summary),
            "experienceYears": new_candidate.experience_years,
            "location": new_candidate.location or "Not specified",
            "availability": new_candidate.availability or "Not specified",
            "status": new_candidate.stage,
            "matchScore": None,
            "skills": new_candidate.skills,
            "primarySkills": new_candidate.skills[:4],
            "secondarySkills": new_candidate.skills[4:],
            "summary": new_candidate.summary,
            "resumeFilename": safe_name,
            "resume_count": 1,
            "evidenceHighlights": [],
            "scheduledInterview": None,
        },
    }


@router.patch("/{candidate_id}")
def update_candidate(
    candidate_id: str,
    payload: CandidateUpdateSchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Update a candidate's pipeline stage, availability, or summary in SQLite."""
    raw_id = candidate_id.replace("cand-", "").lstrip("0") or "0"
    try:
        c_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid candidate ID format.")

    candidate = db.query(Candidate).filter(Candidate.id == c_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    if payload.stage is not None:
        candidate.stage = payload.stage
        db.add(ActivityEvent(
            event_type="stage_update",
            summary=f"Candidate {candidate.name} stage updated to {payload.stage}",
            entity_type="candidate",
            entity_id=str(candidate.id),
            created_at=datetime.now(timezone.utc),
        ))

    if payload.availability is not None:
        candidate.availability = payload.availability

    if payload.summary is not None:
        candidate.summary = payload.summary

    db.commit()
    db.refresh(candidate)

    return {
        "id": candidate.id,
        "stage": candidate.stage,
        "availability": candidate.availability,
        "status": "success",
        "message": f"Candidate {candidate.name} updated.",
        "candidate": {
            "id": candidate.id,
            "stage": candidate.stage,
            "availability": candidate.availability,
        },
    }


@router.post("/{candidate_id}/interviews")
def schedule_interview(
    candidate_id: str,
    payload: InterviewCreateSchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Schedule or record an interview round for a candidate."""
    raw_id = candidate_id.replace("cand-", "").lstrip("0") or "0"
    try:
        c_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid candidate ID format.")

    candidate = db.query(Candidate).filter(Candidate.id == c_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    interview = Interview(
        candidate_id=candidate.id,
        round_name=payload.round_name,
        status=payload.status,
        interviewer=payload.interviewer,
        scheduled_at=payload.scheduled_at,
        meeting_link=payload.meeting_link,
        notes=payload.notes,
        created_at=datetime.now(timezone.utc),
    )
    db.add(interview)

    # Progress candidate stage to match the scheduled interview stage cleanly.
    candidate.stage = payload.round_name

    db.add(ActivityEvent(
        event_type="interview_scheduled",
        summary=f"Interview scheduled for {candidate.name}: {payload.round_name} with {payload.interviewer}",
        entity_type="candidate",
        entity_id=str(candidate.id),
        created_at=datetime.now(timezone.utc),
    ))

    db.commit()
    db.refresh(interview)

    return {
        "status": "success",
        "message": "Interview successfully scheduled.",
        "interview": {
            "id": interview.id,
            "round": interview.round_name,
            "status": interview.status,
            "interviewer": interview.interviewer,
            "date": interview.scheduled_at,
            "meetingLink": interview.meeting_link,
        },
    }
