# Import APIRouter, Depends, Query, HTTPException from FastAPI.
from fastapi import APIRouter, Depends, Query, HTTPException
# Import Session from SQLAlchemy.
from sqlalchemy.orm import Session
# Import typing helpers.
from typing import Any, Optional
# Import database session dependency.
from database.sqlite_connection import get_db
# Import database models.
from database.models import Candidate, Job, Resume, RecruitmentRequest

# Create router for unified search.
router = APIRouter(prefix="/api/search", tags=["Search"])


@router.get("")
def search_entities(
    q: str = Query(..., description="Search query string"),
    limit: int = Query(default=10, description="Max results"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Execute Glean-style unified search across candidates, job descriptions, and recruitment requests."""
    query = q.strip().lower()
    if not query:
        return {"candidates": [], "jobs": [], "requests": []}

    # Search candidates by name, skills, summary, location.
    all_cands = db.query(Candidate).all()
    matched_cands = []
    for c in all_cands:
        name_match = c.name and query in c.name.lower()
        skills_match = any(query in str(s).lower() for s in (c.skills or []))
        summary_match = c.summary and query in c.summary.lower()
        loc_match = c.location and query in c.location.lower()
        if name_match or skills_match or summary_match or loc_match:
            # Classify actual match field without inventing a synthetic percentage score.
            match_reason = "Name Match" if name_match else ("Skill Match" if skills_match else "Profile / Location Match")
            matched_cands.append({
                "id": f"cand-{c.id:03d}",
                # Expose real integer primary key for exact API lookups above 999 or unpadded parsing.
                "numeric_id": c.id,
                "name": c.name,
                # Use stored summary headline or clear unparsed state instead of fabricated Senior Consultant title.
                "role": c.summary.split(".")[0] if c.summary else "Candidate Profile",
                "experience": c.experience_years,
                "location": c.location or "",
                "skills": c.skills[:4] if c.skills else [],
                # Provide honest keyword match label rather than hardcoded 92% or 85% score.
                "matchType": match_reason,
            })

    # Search jobs by title, skills, description.
    all_jobs = db.query(Job).all()
    matched_jobs = []
    for j in all_jobs:
        title_match = j.title and query in j.title.lower()
        skills_match = any(query in str(s).lower() for s in (j.required_skills or []))
        desc_match = j.description and query in j.description.lower()
        if title_match or skills_match or desc_match:
            matched_jobs.append({
                "id": f"job-{j.id:03d}",
                # Expose integer primary key for deterministic navigation.
                "numeric_id": j.id,
                "title": j.title,
                # Use persisted client metadata instead of fabricated department guessing.
                "department": j.client_name or "",
                "location": j.location or "",
                "requiredSkills": j.required_skills[:3] if j.required_skills else [],
            })

    # Search requests.
    all_requests = db.query(RecruitmentRequest).all()
    matched_requests = []
    for r in all_requests:
        req_match = query in r.req_number.lower() or query in r.role_title.lower() or (r.department and query in r.department.lower())
        if req_match:
            matched_requests.append({
                "id": f"req-{r.id:03d}",
                # Expose integer primary key for exact navigation.
                "numeric_id": r.id,
                "reqNumber": r.req_number,
                "roleTitle": r.role_title,
                "priority": r.priority,
                "status": r.status,
            })

    return {
        "query": q,
        "totalResults": len(matched_cands) + len(matched_jobs) + len(matched_requests),
        "candidates": matched_cands[:limit],
        "jobs": matched_jobs[:limit],
        "requests": matched_requests[:limit],
    }
