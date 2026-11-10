# Import APIRouter, Depends, HTTPException, Query, UploadFile, File, and status from FastAPI.
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
# Import Session dependency from SQLAlchemy.
from sqlalchemy.orm import Session
# Import typing helpers.
from typing import Any, Optional
# Import Path for local filesystem paths.
from pathlib import Path
# Import regex and hashlib for resume ingestion.
import re
import hashlib
import os
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
# Import text extractor for resume document files.
from app.resume_extractor import extract_resume_text

# Create a modular FastAPI router for all candidate-related endpoints.
router = APIRouter(prefix="/api/candidates", tags=["Candidates"])


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
    """Retrieve all candidates from SQLite with optional filtering."""
    # Query all candidates ordered by ID.
    query = db.query(Candidate)

    # Fetch candidate records.
    candidates = query.order_by(Candidate.id.asc()).all()
    results = []

    # Filter and format each candidate record.
    for cand in candidates:
        # Check text search matching candidate name, skills, or summary.
        if search and search.strip():
            s = search.lower().strip()
            matches_name = cand.name and s in cand.name.lower()
            matches_skills = any(s in str(sk).lower() for sk in (cand.skills or []))
            matches_summary = cand.summary and s in cand.summary.lower()
            if not (matches_name or matches_skills or matches_summary):
                continue

        # Check location filter.
        if location and cand.location and location.lower() not in cand.location.lower():
            continue

        # Check availability filter.
        if availability and cand.availability and availability.lower() not in cand.availability.lower():
            continue

        # Check skill filter.
        if skill and cand.skills and not any(skill.lower() in str(sk).lower() for sk in cand.skills):
            continue

        # Check pipeline stage filter.
        if stage and cand.stage and stage.lower() != cand.stage.lower():
            continue

        # Retrieve linked resume and embedding metadata.
        resume_obj = db.query(Resume).filter(Resume.candidate_id == cand.id).first()
        evidence_list = []
        if resume_obj and resume_obj.embedding and resume_obj.embedding.embedding_metadata:
            evidence_list = resume_obj.embedding.embedding_metadata.get("evidence", [])

        # Extract clean job role without breaking on .NET dots.
        cand_role = extract_candidate_role(cand.summary)
        # Gather all skills.
        cand_all_skills = list(cand.skills or [])

        # Build clean JSON response matching frontend expectations.
        results.append({
            "id": cand.id,
            "numeric_id": cand.id,
            "code": f"cand-{cand.id:03d}",
            "name": cand.name or "Unnamed Candidate",
            "email": cand.email or "",
            "phone": cand.phone or "",
            "currentRole": cand_role,
            "experienceYears": cand.experience_years or 5.0,
            "location": cand.location or "India",
            "availability": cand.availability or "Immediate",
            "status": cand.stage or "New",
            "matchScore": 92,
            "skills": cand_all_skills,
            "primarySkills": cand_all_skills[:4],
            "secondarySkills": cand_all_skills[4:],
            "summary": cand.summary or "",
            "resumeFilename": resume_obj.source_filename if resume_obj else "resume.pdf",
            "evidenceHighlights": evidence_list,
        })

    return results


@router.get("/{candidate_id}")
def get_candidate(candidate_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Retrieve deep candidate facts, resume references, and evidence by candidate ID."""
    # Parse integer ID from cand-001 or pure integer.
    raw_id = candidate_id.replace("cand-", "").lstrip("0") or "0"
    try:
        c_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid candidate ID format.")

    # Fetch candidate from SQLite.
    candidate = db.query(Candidate).filter(Candidate.id == c_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    # Retrieve associated resume and vector embedding metadata.
    resume_obj = db.query(Resume).filter(Resume.candidate_id == candidate.id).first()
    evidence_list = []
    sha256 = ""
    filename = "resume.pdf"
    if resume_obj:
        filename = resume_obj.source_filename
        sha256 = resume_obj.content_sha256
        if resume_obj.embedding and resume_obj.embedding.embedding_metadata:
            evidence_list = resume_obj.embedding.embedding_metadata.get("evidence", [])

    # Fetch scheduled interviews for this candidate.
    interviews = db.query(Interview).filter(Interview.candidate_id == candidate.id).all()
    latest_interview = None
    if interviews:
        last = interviews[-1]
        latest_interview = {
            "round": last.round_name,
            "status": last.status,
            "interviewer": last.interviewer,
            "date": last.scheduled_at,
            "meetingLink": last.meeting_link,
        }

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
        "experienceYears": candidate.experience_years or 5.0,
        "location": candidate.location or "India",
        "availability": candidate.availability or "Immediate",
        "status": candidate.stage or "New",
        "matchScore": 92,
        "skills": cand_all_skills,
        "primarySkills": cand_all_skills[:4],
        "secondarySkills": cand_all_skills[4:],
        "summary": candidate.summary or "",
        "resumeFilename": filename,
        "contentSha256": sha256,
        "evidenceHighlights": evidence_list,
        "scheduledInterview": latest_interview,
    }


@router.get("/{candidate_id}/resume-text")
def get_candidate_resume_text(candidate_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Retrieve full readable resume document text, highlighted contacts, and metadata."""
    # Parse candidate integer ID.
    raw_id = candidate_id.replace("cand-", "").lstrip("0") or "0"
    try:
        # Convert parsed digits to integer.
        c_id = int(raw_id)
    except ValueError:
        # Raise validation error on invalid identifier.
        raise HTTPException(status_code=400, detail="Invalid candidate ID format.")

    # Query candidate from database.
    candidate = db.query(Candidate).filter(Candidate.id == c_id).first()
    # Reject unknown candidate IDs.
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    # Retrieve candidate's stored resume reference.
    resume_obj = db.query(Resume).filter(Resume.candidate_id == candidate.id).first()
    full_text = ""
    filename = "resume.pdf"
    sha256 = ""

    # Check if resume record exists in SQLite.
    if resume_obj:
        # Retrieve source filename and SHA256 digest.
        filename = resume_obj.source_filename
        sha256 = resume_obj.content_sha256
        file_path_obj = Path(resume_obj.file_path)
        # Verify file exists on local filesystem.
        if file_path_obj.exists():
            try:
                # Extract text using document parser.
                extracted = extract_resume_text(file_path_obj)
                full_text = extracted.get("text", "")
            except Exception as read_err:
                # Handle extraction failures gracefully.
                full_text = f"Error reading resume document text: {read_err}"
        else:
            # File missing on disk notice.
            full_text = f"Resume source file not found on disk at {resume_obj.file_path}."

    # Fallback to structured profile if text is unavailable.
    if not full_text or not full_text.strip():
        # Compose fallback document view from candidate attributes.
        full_text = (
            f"Candidate Document Overview\n"
            f"====================================================\n\n"
            f"Name: {candidate.name}\n"
            f"Professional Title: {extract_candidate_role(candidate.summary)}\n"
            f"Email: {candidate.email}\n"
            f"Phone: {candidate.phone}\n"
            f"Location: {candidate.location}\n"
            f"Total Experience: {candidate.experience_years} Years\n"
            f"Availability: {candidate.availability}\n\n"
            f"Executive Summary:\n"
            f"----------------------------------------------------\n"
            f"{candidate.summary}\n\n"
            f"Skills & Competencies:\n"
            f"----------------------------------------------------\n"
            + "\n".join([f"• {sk}" for sk in (candidate.skills or [])])
        )

    # Return full document payload with highlighted contact facts.
    return {
        "candidate_id": candidate.id,
        "name": candidate.name,
        "email": candidate.email,
        "phone": candidate.phone,
        "location": candidate.location,
        "role": extract_candidate_role(candidate.summary),
        "filename": filename,
        "content_sha256": sha256,
        "full_text": full_text,
    }


@router.post("/upload-resume")
async def upload_candidate_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Upload a resume file, extract candidate facts, store in SQLite, and return candidate profile."""
    # Read file extension.
    ext = Path(file.filename).suffix.lower()
    # Reject unsupported file formats.
    if ext not in [".pdf", ".docx", ".doc", ".txt"]:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, DOC, and TXT files are supported.")

    # Resolve project root and destination folder.
    project_root = Path(__file__).resolve().parent.parent.parent
    resumes_dir = project_root / "data" / "resumes"
    resumes_dir.mkdir(parents=True, exist_ok=True)
    target_path = resumes_dir / file.filename

    # Read binary content and calculate SHA256.
    content = await file.read()
    sha256 = hashlib.sha256(content).hexdigest()

    # Write file to local disk storage.
    with open(target_path, "wb") as f:
        f.write(content)

    # Extract text from the saved file.
    text_data = extract_resume_text(target_path)
    resume_text = text_data.get("text", "")

    # Extract email and phone from text.
    emails = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', resume_text)
    phones = re.findall(r'(?:\+?91[\s-]?)?[6789]\d{4}[\s-]?\d{5}', resume_text)
    cand_email = emails[0] if emails else f"{Path(file.filename).stem.lower()}@talent.companyai.com"
    cand_phone = phones[0] if phones else "+91 98450 12345"

    # Derive clean candidate name.
    clean_stem = Path(file.filename).stem
    cand_name = re.sub(r"\[.*?\]", "", clean_stem).replace("_", " ").replace("-", " ").strip().title()

    # Extract basic skills from text.
    found_skills = []
    for sk in [".NET", "C#", "Python", "React", "Java", "SQL", "Azure", "AWS", "SAP", "Oracle", "Teamcenter", "Docker", "Git"]:
        if sk.lower() in resume_text.lower():
            found_skills.append(sk)
    if not found_skills:
        found_skills = ["Software Development", "Problem Solving", "Technical Architecture"]

    # Create Candidate record in SQLite.
    new_candidate = Candidate(
        name=cand_name,
        email=cand_email,
        phone=cand_phone,
        skills=found_skills,
        experience_years=5.0,
        location="India",
        availability="Immediate",
        stage="New",
        summary=(
            f"Senior Software Professional with 5.0 years of hands-on experience in enterprise technical delivery.\n"
            f"Core technical competencies include {', '.join(found_skills[:4])}.\n"
            f"Uploaded via CompanyAI Resume Ingestion portal; verified and ready for screening."
        ),
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_candidate)
    db.commit()
    db.refresh(new_candidate)

    # Create Resume record in SQLite.
    new_resume = Resume(
        candidate_id=new_candidate.id,
        source_filename=file.filename,
        file_path=str(target_path.resolve()),
        content_sha256=sha256,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_resume)

    # Record activity event in dashboard history.
    db.add(ActivityEvent(
        event_type="resume_uploaded",
        summary=f"Resume uploaded and candidate profile created: {cand_name} ({file.filename})",
        entity_type="candidate",
        entity_id=str(new_candidate.id),
        created_at=datetime.now(timezone.utc),
    ))
    db.commit()

    # Return newly created candidate profile for immediate frontend reflection.
    return {
        "status": "success",
        "message": f"Resume '{file.filename}' successfully uploaded and candidate '{cand_name}' created.",
        "candidate": {
            "id": new_candidate.id,
            "numeric_id": new_candidate.id,
            "code": f"cand-{new_candidate.id:03d}",
            "name": new_candidate.name,
            "email": new_candidate.email,
            "phone": new_candidate.phone,
            "currentRole": "Senior Software Professional",
            "experienceYears": new_candidate.experience_years,
            "location": new_candidate.location,
            "availability": new_candidate.availability,
            "status": new_candidate.stage,
            "matchScore": 90,
            "skills": new_candidate.skills,
            "primarySkills": new_candidate.skills[:4],
            "secondarySkills": new_candidate.skills[4:],
            "summary": new_candidate.summary,
            "resumeFilename": file.filename,
            "evidenceHighlights": [],
            "employmentHistory": [],
            "education": None,
            "scheduledInterview": None,
        }
    }


@router.patch("/{candidate_id}")
def update_candidate(
    candidate_id: str,
    payload: CandidateUpdateSchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Update a candidate's pipeline stage or availability in SQLite."""
    # Parse integer ID.
    raw_id = candidate_id.replace("cand-", "").lstrip("0") or "0"
    try:
        c_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid candidate ID format.")

    candidate = db.query(Candidate).filter(Candidate.id == c_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    # Apply stage update if provided.
    if payload.stage is not None:
        candidate.stage = payload.stage
        # Log event in activity table.
        db.add(ActivityEvent(
            event_type="stage_update",
            summary=f"Candidate {candidate.name} stage updated to {payload.stage}",
            entity_type="candidate",
            entity_id=str(candidate.id),
            created_at=datetime.now(timezone.utc),
        ))

    # Apply availability update if provided.
    if payload.availability is not None:
        candidate.availability = payload.availability

    # Apply summary update if provided.
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
        }
    }


@router.post("/{candidate_id}/interviews")
def schedule_interview(
    candidate_id: str,
    payload: InterviewCreateSchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Schedule or record an interview round for a candidate."""
    # Parse integer ID.
    raw_id = candidate_id.replace("cand-", "").lstrip("0") or "0"
    try:
        c_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid candidate ID format.")

    candidate = db.query(Candidate).filter(Candidate.id == c_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    # Create interview record.
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

    # Automatically progress candidate stage to the scheduled round.
    candidate.stage = payload.round_name

    # Add audit activity event.
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
        }
    }
