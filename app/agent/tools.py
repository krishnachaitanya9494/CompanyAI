# Import SQLAlchemy session and model types.
# Import SQLAlchemy session and model types.
from sqlalchemy.orm import Session
from typing import Any, Optional
# Import database models.
from database.models import Candidate, Resume, Job, RecruitmentRequest, ApprovalRequest, ActivityEvent
# Import datetime.
from datetime import datetime, timezone
# Import regular expressions.
import re

# Stop words to ignore when parsing recruiter natural language queries.
STOP_WORDS = frozenset({
    "give", "me", "candidates", "candidate", "who", "is", "a", "an", "the",
    "with", "in", "for", "and", "or", "to", "show", "find", "get", "list",
    "all", "any", "some", "profile", "profiles", "looking", "need", "have",
    "are", "tell", "about", "search", "developer", "developers", "engineer", "engineers",
})

# Domain concept aliases mapping natural language search terms to technical skills.
CONCEPT_MAP = {
    ".net": [".net", "dotnet", "c#", "asp.net", "c sharp", "asp.net core"],
    "dot net": [".net", "dotnet", "c#", "asp.net", "c sharp", "asp.net core"],
    "dotnet": [".net", "dotnet", "c#", "asp.net", "c sharp", "asp.net core"],
    "c#": ["c#", ".net", "dotnet", "asp.net"],
    "teamcenter": ["teamcenter", "plm", "bmide", "active workspace", "awc", "itk"],
    "plm": ["teamcenter", "plm", "bmide", "active workspace", "awc"],
    "oracle": ["oracle", "fccs", "epm", "hyperion", "pbcs", "financial consolidation"],
    "fccs": ["fccs", "oracle", "hfm", "financial consolidation", "hyperion"],
    "epm": ["epm", "oracle", "pbcs", "planning", "hyperion"],
    "sap": ["sap", "cpi", "integration suite", "s/4hana", "security", "grc", "ps"],
    "cpi": ["cpi", "sap cpi", "integration suite", "groovy", "odata"],
    "java": ["java", "spring boot", "microservices", "spring"],
    "react": ["react", "frontend", "ui", "javascript", "typescript"],
    "frontend": ["react", "frontend", "ui", "javascript", "html", "css"],
    "python": ["python", "fastapi", "django", "pandas", "data"],
}


# Helper to extract clean professional role without truncating on dot in .NET or technical abbreviations.
def extract_candidate_role(summary: Optional[str]) -> str:
    # Handle missing or empty summary.
    if not summary:
        # Default fallback role when no summary is available.
        return "Software Professional"
    # If summary contains standard "with X years" phrasing, split cleanly before with.
    if " with " in summary:
        # Return prefix as title.
        return summary.split(" with ")[0].strip()
    # Otherwise split by period followed by whitespace and an uppercase letter.
    parts = re.split(r"\.\s+(?=[A-Z])", summary)
    # Return first sentence or default.
    return parts[0].strip() if parts else "Software Professional"


def search_candidates_tool(query: str, limit: int = 5, session: Session = None) -> list[dict[str, Any]]:
    """Tool: Semantically and keyword search candidate profiles with verifiable evidence."""
    # Ensure active database session is available.
    if not session:
        # Return empty list if no active database session.
        return []

    # Clean and normalize query.
    q = query.lower().strip()
    # Split query into sanitized word tokens.
    words = [re.sub(r"[^\w#\.\+]", "", w) for w in q.split()]

    # Extract concept aliases based on keywords in query.
    matched_aliases = set()
    # Iterate through concept mapping dictionary.
    for trigger, aliases in CONCEPT_MAP.items():
        # Check if concept trigger appears in lowercase query.
        if trigger in q:
            # Add all aliases to matched alias set.
            matched_aliases.update(aliases)

    # Filter out English conversational stop words.
    content_terms = [w for w in words if w not in STOP_WORDS and len(w) > 1]

    # Query all candidate records from SQLite.
    candidates = session.query(Candidate).all()
    # Initialize list of matched results.
    results = []

    # Iterate over all candidate profiles.
    for c in candidates:
        # Retrieve candidate's associated resume record for filename search.
        resume_obj = session.query(Resume).filter(Resume.candidate_id == c.id).first()
        # Extract filename in lowercase if resume is present.
        filename_str = resume_obj.source_filename.lower() if resume_obj else ""

        # Normalize candidate skill strings.
        cand_skills = [str(s).lower() for s in (c.skills or [])]
        # Normalize candidate summary string.
        cand_summary = (c.summary or "").lower()
        # Normalize candidate name string.
        cand_name = (c.name or "").lower()
        # Normalize candidate location string.
        cand_location = (c.location or "").lower()

        # Check for skill and concept matches.
        concept_match = False
        # If user searched for technical concepts, verify alias matches.
        if matched_aliases:
            # Check skills, filename, or summary for any alias.
            concept_match = any(
                alias in s for alias in matched_aliases for s in cand_skills
            ) or any(
                alias in filename_str for alias in matched_aliases
            ) or any(
                alias in cand_summary for alias in matched_aliases
            )

        # Check for content term matches in skills, filename, or summary.
        term_matches = sum(
            1 for term in content_terms if any(term in s for s in cand_skills) or term in filename_str or term in cand_summary
        )

        # Location matching (e.g. hyderabad, bangalore).
        loc_match = any(term in cand_location for term in ["hyderabad", "bangalore", "pune", "delhi", "bhubaneswar", "noida", "mumbai", "chennai"] if term in q)

        # If user searched for a specific technical role or concept, require either concept or term match.
        if matched_aliases and not concept_match and term_matches == 0:
            # Skip candidates without matching technical qualifications.
            continue

        # If general terms were provided without aliases, ensure at least one match.
        if not matched_aliases and content_terms and term_matches == 0 and not any(term in cand_name for term in content_terms):
            # Skip candidate if no name or keyword match.
            continue

        # Extract clean job role.
        role_title = extract_candidate_role(c.summary)
        # Check if the extracted role directly contains any alias.
        role_match = any(alias in role_title.lower() for alias in matched_aliases) if matched_aliases else False

        # Compute grounded match score starting at baseline 75.
        score = 75
        # Add high boost if the candidate's primary job title matches the target role.
        if role_match:
            # Award 15 points for direct role title match.
            score += 15
        elif concept_match:
            # Award 10 points for skill or resume evidence match.
            score += 10

        # Award bonus for term matches.
        if term_matches > 0:
            # Add up to 6 points for keyword density.
            score += min(term_matches * 2, 6)

        # Award experience seniority bonus.
        if c.experience_years:
            # Add up to 5 points for experience tenure.
            score += min(int(c.experience_years), 5)

        # Award bonus if candidate location matches requested city.
        if loc_match:
            # Add 3 points for location match.
            score += 3

        # Cap score at 98 percent.
        score = min(score, 98)

        # Retrieve evidence highlights from embedding metadata if present.
        evidence = []
        # Check if embedding object and metadata are available.
        if resume_obj and resume_obj.embedding and resume_obj.embedding.embedding_metadata:
            # Retrieve evidence list.
            evidence = resume_obj.embedding.embedding_metadata.get("evidence", [])

        # Reorder skills so query-matched skills appear first in primarySkills badge display.
        raw_skills = list(c.skills or [])
        # Extract skills that match target aliases or content terms.
        matched_skills = [
            s for s in raw_skills
            if any(alias in s.lower() for alias in matched_aliases) or any(t in s.lower() for t in content_terms)
        ]
        # Extract remaining skills preserving original order.
        other_skills = [s for s in raw_skills if s not in matched_skills]
        # Combine with matched skills prioritized first.
        ordered_skills = matched_skills + other_skills

        # Append candidate result object preserving honest profile fields without fabricating missing defaults.
        results.append({
            "id": c.id,
            "numeric_id": c.id,
            "candidate_id": c.id,
            "name": c.name,
            "currentRole": role_title,
            # Preserve exact stored experience or None if not extracted.
            "experienceYears": c.experience_years,
            # Report missing locations honestly instead of defaulting to a city.
            "location": c.location or "Not specified",
            "availability": c.availability or "Not specified",
            "status": c.stage or "New",
            "matchScore": score,
            "primarySkills": ordered_skills[:4],
            "secondarySkills": ordered_skills[4:],
            "summary": c.summary or "",
            "evidenceHighlights": evidence,
        })

    # Sort descending by match score and return top results.
    results.sort(key=lambda x: x["matchScore"], reverse=True)
    # Return limited top candidates.
    return results[:limit]


def filter_candidates_tool(
    skills: Optional[list[str]] = None,
    location: Optional[str] = None,
    experience_min: Optional[float] = None,
    availability: Optional[str] = None,
    limit: int = 5,
    session: Session = None,
) -> list[dict[str, Any]]:
    """Tool: Filter candidates with structured attributes."""
    if not session:
        return []

    query = session.query(Candidate)

    if location:
        query = query.filter(Candidate.location.ilike(f"%{location}%"))
    if experience_min:
        query = query.filter(Candidate.experience_years >= experience_min)
    if availability:
        query = query.filter(Candidate.availability.ilike(f"%{availability}%"))

    candidates = query.limit(limit * 2).all()
    results = []

    for c in candidates:
        if skills:
            cand_skills = [str(s).lower() for s in (c.skills or [])]
            if not any(sk.lower() in cand_skills for sk in skills):
                continue

        results.append({
            "id": c.id,
            "numeric_id": c.id,
            "candidate_id": c.id,
            "name": c.name,
            "currentRole": extract_candidate_role(c.summary),
            # Preserve exact stored experience and metadata without hardcoded guesses.
            "experienceYears": c.experience_years,
            "location": c.location or "Not specified",
            "availability": c.availability or "Not specified",
            "status": c.stage or "New",
            # Attribute filtering does not evaluate a JD score, so keep matchScore unset.
            "matchScore": None,
            "primarySkills": (c.skills or [])[:4],
            "secondarySkills": (c.skills or [])[4:],
        })

    return results[:limit]


def match_candidates_to_job_tool(
    job_id_or_title: str | int,
    top_k: int = 5,
    session: Session = None,
) -> dict[str, Any]:
    """Tool: Rank and match candidates against a job description using the Phase 5C semantic matching engine."""
    # Ensure database session is active before querying.
    if not session:
        return {"job": None, "matches": []}

    # Resolve target job either by numeric ID or case-insensitive title match.
    job = None
    if isinstance(job_id_or_title, int) or str(job_id_or_title).isdigit():
        # Lookup job by primary key ID.
        job = session.query(Job).filter(Job.id == int(job_id_or_title)).first()
    if not job:
        # Search job by title substring.
        job = session.query(Job).filter(Job.title.ilike(f"%{job_id_or_title}%")).first()
    if not job:
        # Fallback to the latest job if no specific title match found.
        job = session.query(Job).first()
    if not job:
        return {"job": None, "matches": []}

    # Invoke the deterministic and vector-grounded Phase 5C matching engine.
    from app.services.matching_engine_service import search_and_match_candidates
    # Execute search_and_match_candidates for the resolved job.
    engine_result = search_and_match_candidates(
        db=session,
        job_id=job.id,
        page=1,
        page_size=top_k,
    )
    # Return structured job summary along with ranked matches containing tier and citations.
    return {
        "job": {
            "id": job.id,
            "title": job.title,
            "location": job.location,
            "required_skills": job.required_skills,
            "preferred_skills": job.preferred_skills,
        },
        "matches": engine_result.get("matches", [])[:top_k],
        "summary": engine_result.get("summary", {}),
    }


def get_job_details_tool(
    job_id_or_title: str | int,
    session: Session = None,
) -> dict[str, Any]:
    """Tool: Retrieve full job specification, mandatory/preferred requirements, and JD intelligence segmentation."""
    # Return empty payload if session is missing.
    if not session:
        return {}
    # Resolve target job by ID or title substring.
    job = None
    if isinstance(job_id_or_title, int) or str(job_id_or_title).isdigit():
        job = session.query(Job).filter(Job.id == int(job_id_or_title)).first()
    if not job:
        job = session.query(Job).filter(Job.title.ilike(f"%{job_id_or_title}%")).first()
    if not job:
        return {}
    # Check for active approved JD segmentation and requirements.
    from database.models import JDSegmentation, JobRequirement
    # Fetch latest approved segmentation if available.
    seg = (
        session.query(JDSegmentation)
        .filter(JDSegmentation.job_id == job.id, JDSegmentation.status == "approved")
        .order_by(JDSegmentation.version.desc())
        .first()
    )
    requirements = []
    if seg:
        # Retrieve ordered requirement records associated with the segmentation.
        reqs = (
            session.query(JobRequirement)
            .filter(JobRequirement.segmentation_id == seg.id)
            .order_by(JobRequirement.order_index.asc())
            .all()
        )
        requirements = [
            {
                "id": r.id,
                "category": r.category,
                "classification": r.classification,
                "text": r.original_text,
            }
            for r in reqs
        ]
    # Return comprehensive job descriptor dictionary.
    return {
        "id": job.id,
        "title": job.title,
        "job_code": job.job_code,
        "client": job.client_name,
        "location": job.location,
        "status": job.status,
        "min_experience": job.min_experience_years,
        "max_experience": job.max_experience_years,
        "mandatory_skills": job.synced_mandatory_skills or job.required_skills or [],
        "preferred_skills": job.synced_preferred_skills or job.preferred_skills or [],
        "description_excerpt": (job.description or "")[:600],
        "has_approved_segmentation": bool(seg),
        "requirements": requirements,
    }


def get_candidate_profile_tool(
    candidate_id_or_name: str | int,
    session: Session = None,
) -> dict[str, Any]:
    """Tool: Retrieve full candidate profile facts, skills, experience, and resume versions."""
    # Ensure database session exists.
    if not session:
        return {}
    # Resolve candidate by integer ID or case-insensitive name match.
    cand = None
    if isinstance(candidate_id_or_name, int) or str(candidate_id_or_name).isdigit():
        cand = session.query(Candidate).filter(Candidate.id == int(candidate_id_or_name)).first()
    if not cand:
        cand = session.query(Candidate).filter(Candidate.name.ilike(f"%{candidate_id_or_name}%")).first()
    if not cand:
        return {}
    # Query resumes owned by candidate.
    resumes = session.query(Resume).filter(Resume.candidate_id == cand.id).all()
    # Extract verifiable evidence snippets if available in embedding metadata.
    evidence = []
    if resumes and resumes[0].embedding and resumes[0].embedding.embedding_metadata:
        evidence = resumes[0].embedding.embedding_metadata.get("evidence", [])
    # Return structured candidate summary payload.
    return {
        "id": cand.id,
        "name": cand.name,
        "currentRole": extract_candidate_role(cand.summary),
        "experienceYears": cand.experience_years,
        "location": cand.location,
        "availability": cand.availability,
        "stage": cand.stage,
        "skills": list(cand.skills or []),
        "summary": cand.summary,
        "resumeCount": len(resumes),
        "resumes": [r.source_filename for r in resumes],
        "evidenceHighlights": evidence,
    }


def compare_candidates_tool(
    job_id: int,
    candidate_ids: list[int],
    session: Session = None,
) -> dict[str, Any]:
    """Tool: Compare multiple candidates side-by-side against a target job using Phase 5C scoring."""
    # Verify session and candidate list length.
    if not session or len(candidate_ids) < 2:
        return {}
    # Invoke Phase 5C comparison engine.
    from app.services.matching_engine_service import compare_candidates_for_job
    # Execute deterministic comparison matrix evaluation.
    return compare_candidates_for_job(db=session, job_id=job_id, candidate_ids=candidate_ids[:5])


def summarize_pipeline_tool(session: Session = None) -> dict[str, Any]:
    """Tool: Retrieve real-time SQLite database pipeline counts, jobs, requests, and embedding coverage."""
    # Return empty stats if no active session.
    if not session:
        return {}
    # Query exact SQLite counts across core entities.
    from database.models import ResumeEmbedding
    # Gather aggregate metrics.
    total_candidates = session.query(Candidate).count()
    total_resumes = session.query(Resume).count()
    total_embeddings = session.query(ResumeEmbedding).count()
    total_jobs = session.query(Job).count()
    active_jobs = session.query(Job).filter(Job.status.in_(["Active", "active", "Open", "open"])).count()
    # Group candidates by recruitment pipeline stage.
    candidates = session.query(Candidate).all()
    stages: dict[str, int] = {}
    for c in candidates:
        s = c.stage or "New"
        stages[s] = stages.get(s, 0) + 1
    # Return grounded metrics dictionary.
    return {
        "total_candidates": total_candidates,
        "total_resumes": total_resumes,
        "total_embeddings": total_embeddings,
        "total_jobs": total_jobs,
        "active_jobs": active_jobs,
        "stages": stages,
    }


def get_recruitment_requests_tool(
    priority: Optional[str] = None,
    session: Session = None,
) -> list[dict[str, Any]]:
    """Tool: Retrieve hiring requisitions with SLA tracking."""
    if not session:
        return []

    query = session.query(RecruitmentRequest)
    if priority:
        query = query.filter(RecruitmentRequest.priority.ilike(f"%{priority}%"))

    reqs = query.order_by(RecruitmentRequest.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "reqNumber": r.req_number,
            "roleTitle": r.role_title,
            "department": r.department,
            "priority": r.priority,
            "status": r.status,
            "assignedRecruiter": r.assigned_recruiter,
            "targetPositions": r.target_positions,
            "slaDeadline": r.sla_deadline,
        }
        for r in reqs
    ]


def propose_sensitive_action_tool(
    action_type: str,
    description: str,
    payload: dict[str, Any],
    requester: str = "Nemotron AI Agent",
    session: Session = None,
) -> dict[str, Any]:
    """Tool: Propose sensitive mutation into Human-in-the-Loop queue using valid ApprovalRequest schema."""
    if not session:
        return {"status": "error", "message": "No database session"}

    # Construct ApprovalRequest using exact ORM column names (action_type, description, payload).
    approval = ApprovalRequest(
        action_type=action_type,
        description=description,
        payload=payload,
        requester=requester,
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    session.add(approval)
    # Flush so database assigns the primary key ID before logging the activity event.
    session.flush()
    # Record proposal submission in the workspace audit trail.
    session.add(ActivityEvent(
        event_type="approval_proposed",
        summary=f"Approval #{approval.id} queued ({action_type}): {description[:160]}",
        entity_type="approval",
        entity_id=str(approval.id),
        created_at=datetime.now(timezone.utc),
    ))
    session.commit()
    session.refresh(approval)

    return {
        "status": "pending_approval",
        "approval_id": approval.id,
        "message": f"Action requires Human-in-the-Loop authorization. Approval request #{approval.id} created.",
    }
