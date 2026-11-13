# Import APIRouter, Depends from FastAPI.
from fastapi import APIRouter, Depends
# Import Session from SQLAlchemy.
from sqlalchemy.orm import Session
# Import typing helpers.
from typing import Any
# Import database session dependency.
from database.sqlite_connection import get_db
# Import database models.
from database.models import Candidate, Resume, JobDescription, Job, RecruitmentRequest
# Import seed function.
from scripts.seed_database import seed_database

# Create router for ingestion and data foundation.
router = APIRouter(prefix="/api/ingestion", tags=["Ingestion"])


@router.get("/status")
def get_ingestion_status(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Retrieve database ingestion counts and scope verification."""
    cand_count = db.query(Candidate).count()
    resume_count = db.query(Resume).count()
    jd_count = db.query(JobDescription).count()
    job_count = db.query(Job).count()
    req_count = db.query(RecruitmentRequest).count()

    return {
        "status": "ready",
        # Report actual live database inventory instead of outdated 7x7 seed copy.
        "scope": f"{cand_count} Candidates / {resume_count} Resumes / {job_count} Jobs",
        "counts": {
            "candidates": cand_count,
            "resumes": resume_count,
            "job_descriptions": jd_count,
            "jobs": job_count,
            "recruitment_requests": req_count,
        },
        "database": "SQLite (data/companyai.db)",
    }


@router.post("/seed")
def trigger_seed(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Seed SQLite database with approved records if unpopulated."""
    seed_database()
    return {"status": "success", "message": "Database seeded with approved records."}
