"""Job advertisement generation, dynamic platform distribution, and posting lifecycle APIs."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database.models import (
    Job,
    JobDescription,
    JobPosting,
    JobPostingVersion,
    JobPostingMetrics,
    JobPostingActivity,
)
from database.sqlite_connection import get_db

from app.services.jd_context_service import build_job_generation_context
from app.services.advertisement_generation_service import (
    generate_platform_advertisement,
    regenerate_advertisement_section,
    rewrite_advertisement,
    compare_advertisements,
    compute_posting_readiness,
)
from app.services.posting_strategy_service import analyze_posting_strategy
from app.services.advertisement_validation_service import validate_advertisement_quality
from app.services.jd_consistency_service import classify_content_integrity
from app.services.content_normalization_service import normalize_markdown_content

router = APIRouter(prefix="/api/job-postings", tags=["Job Posting"])


class GenerateSchema(BaseModel):
    platform: str = Field(default="linkedin")


class VersionUpdateSchema(BaseModel):
    title: Optional[str] = None
    content: str
    status: str = "Recruiter Edited"


class RewriteSchema(BaseModel):
    mode: str = Field(default="professionalism")
    custom_instruction: Optional[str] = None


class PublishSchema(BaseModel):
    platform: str
    external_posting_url: Optional[str] = None
    job_id_external: Optional[str] = None
    status: str = "Ready to Publish"


class MetricsSchema(BaseModel):
    platform: str
    metrics: Dict[str, Any]
    source: str = "manual"


class SupplementaryInfoSchema(BaseModel):
    company_overview: Optional[str] = None
    benefits: Optional[List[str]] = None
    application_instructions: Optional[str] = None
    referral_bonus: Optional[str] = None
    custom_notes: Optional[str] = None


class BulkGenerateSchema(BaseModel):
    job_ids: List[Any]
    platforms: List[str] = Field(default_factory=lambda: ["linkedin"])


class ExportSchema(BaseModel):
    title: str = ""
    content: str = ""
    format: str = "docx"  # "pdf", "docx", or "txt"
    filename: Optional[str] = None


class RegenerateSectionSchema(BaseModel):
    platform: str = Field(default="linkedin")
    section: str = Field(default="overview")  # "overview", "skills", "full"


class SkillUpdateSchema(BaseModel):
    mandatory_skills: List[str] = Field(default_factory=list)
    preferred_skills: List[str] = Field(default_factory=list)


PLATFORMS = {
    "linkedin": "LinkedIn",
    "naukri": "Naukri",
    "indeed": "Indeed",
    "careers": "Company Careers",
    "referral": "Employee Referral",
}


def _parse_job_id(raw_id: str | int) -> int:
    """Extract integer job ID from numeric or prefixed string."""
    digits = "".join(ch for ch in str(raw_id) if ch.isdigit())
    if not digits:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")
    return int(digits)


def _or_create_posting(db: Session, job: Job) -> JobPosting:
    """Retrieve existing posting or initialize new root posting record."""
    posting = db.query(JobPosting).filter(JobPosting.job_id == job.id).first()
    if not posting:
        posting = JobPosting(
            job_id=job.id,
            status="Draft",
            posting_owner=job.recruiter_owner,
            supplementary_info={},
        )
        db.add(posting)
        db.flush()
    return posting


def _serialize_posting(posting: JobPosting, db: Session) -> Dict[str, Any]:
    """Serialize full job posting with independent versions, metrics, and audit history."""
    versions = (
        db.query(JobPostingVersion)
        .filter(JobPostingVersion.posting_id == posting.id)
        .order_by(JobPostingVersion.created_at.asc())
        .all()
    )
    metrics = (
        db.query(JobPostingMetrics)
        .filter(JobPostingMetrics.posting_id == posting.id)
        .order_by(JobPostingMetrics.recorded_at.desc())
        .all()
    )
    activities = (
        db.query(JobPostingActivity)
        .filter(JobPostingActivity.posting_id == posting.id)
        .order_by(JobPostingActivity.created_at.desc())
        .all()
    )

    version_list = [
        {
            "id": v.id,
            "platform": v.platform,
            "title": v.title,
            "content": v.content,
            "status": v.status,
            "approval_timestamp": v.approval_timestamp.isoformat() if v.approval_timestamp else None,
            "publication_timestamp": v.publication_timestamp.isoformat() if v.publication_timestamp else None,
            "external_posting_url": v.external_posting_url,
            "job_id_external": v.job_id_external,
            "model_name": v.model_name,
            "generation_method": v.generation_method,
            "updated_at": v.updated_at.isoformat() if v.updated_at else None,
        }
        for v in versions
    ]

    return {
        "id": posting.id,
        "job_id": posting.job_id,
        "status": posting.status,
        "posting_owner": posting.posting_owner,
        "notes": posting.notes,
        "strategy": posting.strategy,
        "supplementary_info": posting.supplementary_info or {},
        "versions": version_list,
        "metrics": [
            {
                "id": m.id,
                "platform": m.platform,
                "metrics": m.metrics,
                "source": m.source,
                "recorded_at": m.recorded_at.isoformat() if m.recorded_at else None,
            }
            for m in metrics
        ],
        "activity": [
            {
                "id": a.id,
                "action": a.action,
                "details": a.details,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in activities
        ],
    }


@router.get("/jobs/{job_id}")
def get_posting(job_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Retrieve full job posting lifecycle state, versions, and strategy for a job."""
    j_id = _parse_job_id(job_id)
    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job with ID {j_id} not found.")

    posting = db.query(JobPosting).filter(JobPosting.job_id == job.id).first()
    if not posting:
        return {
            "job_id": job.id,
            "status": "Draft",
            "versions": [],
            "metrics": [],
            "activity": [],
            "strategy": None,
            "supplementary_info": {},
        }
    return _serialize_posting(posting, db)


@router.post("/jobs/{job_id}/generate")
def generate_posting(
    job_id: str,
    payload: GenerateSchema,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Dynamically generate a platform-tailored advertisement for the selected job."""
    j_id = _parse_job_id(job_id)
    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    plat_key = payload.platform.lower()
    if plat_key not in PLATFORMS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported platform '{payload.platform}'. Supported: {', '.join(PLATFORMS.keys())}",
        )

    posting = _or_create_posting(db, job)

    # 1. Build isolated, verified context for THIS specific job
    context = build_job_generation_context(db, job.id, supplementary_info=posting.supplementary_info)

    # 2. Generate platform-specific advertisement
    content, generation_method, model_name = generate_platform_advertisement(context, plat_key)

    # 3. Validate quality and factual consistency against source JD
    quality = validate_advertisement_quality(context, plat_key, context.title, content)

    # 4. Save or update version
    version = (
        db.query(JobPostingVersion)
        .filter(
            JobPostingVersion.posting_id == posting.id,
            JobPostingVersion.platform == plat_key,
        )
        .first()
    )
    if not version:
        version = JobPostingVersion(posting_id=posting.id, platform=plat_key)
        db.add(version)

    version.title = context.title
    version.content = quality["normalized_content"]
    version.status = "Needs Recruiter Review" if quality["requires_recruiter_review"] else "AI Generated"
    version.ai_generated = 1
    version.model_name = model_name
    version.generation_method = generation_method
    version.updated_at = datetime.now(timezone.utc)

    posting.status = "AI Generated"
    posting.updated_at = datetime.now(timezone.utc)

    # Log activity
    db.add(JobPostingActivity(
        posting_id=posting.id,
        action="generated",
        details={
            "platform": plat_key,
            "method": generation_method,
            "model": model_name,
            "warnings_count": len(quality["warnings"]),
            "blocking_errors_count": len(quality["blocking_errors"]),
        },
    ))
    db.commit()
    db.refresh(posting)
    return _serialize_posting(posting, db)


@router.post("/jobs/{job_id}/regenerate-section")
def regenerate_section(
    job_id: str,
    payload: RegenerateSectionSchema,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Regenerate a specific section (overview, skills, full) while preserving other edits."""
    j_id = _parse_job_id(job_id)
    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    plat_key = payload.platform.lower().strip()
    if plat_key not in PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {payload.platform}.")

    posting = _or_create_posting(db, job)
    version = (
        db.query(JobPostingVersion)
        .filter(JobPostingVersion.posting_id == posting.id, JobPostingVersion.platform == plat_key)
        .first()
    )

    current_content = version.content if version and version.content else ""
    context = build_job_generation_context(db, job.id, posting.supplementary_info)
    new_content = regenerate_advertisement_section(context, plat_key, current_content, payload.section)

    quality = validate_advertisement_quality(context, plat_key, context.title, new_content)

    if not version:
        version = JobPostingVersion(posting_id=posting.id, platform=plat_key)
        db.add(version)

    version.title = context.title
    version.content = new_content
    version.status = "Needs Recruiter Review" if quality["requires_recruiter_review"] else "Recruiter Edited"
    version.updated_at = datetime.now(timezone.utc)

    db.add(JobPostingActivity(
        posting_id=posting.id,
        action="section_regenerated",
        details={"platform": plat_key, "section": payload.section},
    ))
    db.commit()
    db.refresh(posting)
    return _serialize_posting(posting, db)


@router.post("/jobs/{job_id}/skills")
def update_skills(
    job_id: str,
    payload: SkillUpdateSchema,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Update recruiter custom skills for the job advertisement and sync."""
    j_id = _parse_job_id(job_id)
    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    posting = _or_create_posting(db, job)
    supp = dict(posting.supplementary_info or {})
    supp["custom_skills"] = {
        "mandatory": [s.strip() for s in payload.mandatory_skills if s.strip()],
        "preferred": [s.strip() for s in payload.preferred_skills if s.strip()],
    }
    posting.supplementary_info = supp
    db.commit()
    db.refresh(posting)
    return _serialize_posting(posting, db)


@router.post("/jobs/{job_id}/strategy")
def generate_strategy(job_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Analyze the job context and dynamically compute optimal distribution channels and strategy."""
    j_id = _parse_job_id(job_id)
    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    posting = _or_create_posting(db, job)
    context = build_job_generation_context(db, job.id, supplementary_info=posting.supplementary_info)
    strategy = analyze_posting_strategy(context)

    posting.strategy = strategy
    posting.updated_at = datetime.now(timezone.utc)
    db.add(JobPostingActivity(
        posting_id=posting.id,
        action="strategy_generated",
        details={"top_platform": strategy["top_recommended_platform"]},
    ))
    db.commit()
    db.refresh(posting)
    return strategy


@router.get("/jobs/{job_id}/readiness")
def get_readiness_checklist(job_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Audit job posting readiness before publishing across compliance, skills, and platform drafts."""
    j_id = _parse_job_id(job_id)
    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    posting = db.query(JobPosting).filter(JobPosting.job_id == job.id).first()
    context = build_job_generation_context(db, job.id, supplementary_info=(posting.supplementary_info if posting else {}))

    versions = []
    if posting:
        raw_versions = db.query(JobPostingVersion).filter(JobPostingVersion.posting_id == posting.id).all()
        versions = [{"platform": v.platform, "status": v.status} for v in raw_versions]

    return compute_posting_readiness(context, versions)


@router.post("/versions/{version_id}/rewrite")
def rewrite_version(
    version_id: int,
    payload: RewriteSchema,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Execute targeted AI rewrite on an existing advertisement draft."""
    version = db.query(JobPostingVersion).filter(JobPostingVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Advertisement version not found.")

    posting = db.query(JobPosting).filter(JobPosting.id == version.posting_id).first()
    job = db.query(Job).filter(Job.id == posting.job_id).first() if posting else None
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    context = build_job_generation_context(db, job.id, supplementary_info=posting.supplementary_info)
    rewritten_content, method = rewrite_advertisement(
        context,
        version.platform,
        version.content,
        payload.mode,
        payload.custom_instruction,
    )

    quality = validate_advertisement_quality(context, version.platform, version.title or context.title, rewritten_content)
    version.content = quality["normalized_content"]
    version.status = "Needs Recruiter Review" if quality["requires_recruiter_review"] else "Recruiter Edited"
    version.updated_at = datetime.now(timezone.utc)

    db.add(JobPostingActivity(
        posting_id=version.posting_id,
        action="ai_rewritten",
        details={"platform": version.platform, "mode": payload.mode, "method": method},
    ))
    db.commit()
    db.refresh(version)

    return {
        "id": version.id,
        "platform": version.platform,
        "title": version.title,
        "content": version.content,
        "status": version.status,
        "rewrite_mode": payload.mode,
        "validation": quality,
    }


@router.get("/jobs/{job_id}/compare")
def compare_platform_versions(
    job_id: str,
    platform1: str = Query(default="linkedin"),
    platform2: str = Query(default="naukri"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Compare advertisements across two platforms side by side."""
    j_id = _parse_job_id(job_id)
    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    posting = db.query(JobPosting).filter(JobPosting.job_id == job.id).first()
    if not posting:
        raise HTTPException(status_code=404, detail="No postings generated for this job yet.")

    v1 = db.query(JobPostingVersion).filter(
        JobPostingVersion.posting_id == posting.id,
        JobPostingVersion.platform == platform1.lower(),
    ).first()
    v2 = db.query(JobPostingVersion).filter(
        JobPostingVersion.posting_id == posting.id,
        JobPostingVersion.platform == platform2.lower(),
    ).first()

    c1 = v1.content if v1 else ""
    c2 = v2.content if v2 else ""

    return compare_advertisements(platform1, c1, platform2, c2)


@router.post("/jobs/{job_id}/supplementary")
def update_supplementary_info(
    job_id: str,
    payload: SupplementaryInfoSchema,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Save recruiter-supplied supplementary details kept strictly separate from the original JD."""
    j_id = _parse_job_id(job_id)
    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    posting = _or_create_posting(db, job)
    current = dict(posting.supplementary_info or {})

    if payload.company_overview is not None:
        current["company_overview"] = payload.company_overview
    if payload.benefits is not None:
        current["benefits"] = payload.benefits
    if payload.application_instructions is not None:
        current["application_instructions"] = payload.application_instructions
    if payload.referral_bonus is not None:
        current["referral_bonus"] = payload.referral_bonus
    if payload.custom_notes is not None:
        current["custom_notes"] = payload.custom_notes

    posting.supplementary_info = current
    posting.updated_at = datetime.now(timezone.utc)

    db.add(JobPostingActivity(
        posting_id=posting.id,
        action="supplementary_info_updated",
        details={"keys_updated": list(current.keys())},
    ))
    db.commit()
    db.refresh(posting)

    return {"status": "success", "supplementary_info": posting.supplementary_info}


@router.post("/bulk-generate")
def bulk_generate_postings(
    payload: BulkGenerateSchema,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Generate platform-specific advertisement drafts in batches with strict context isolation."""
    results: List[Dict[str, Any]] = []
    
    for raw_id in payload.job_ids:
        try:
            j_id = _parse_job_id(raw_id)
            job = db.query(Job).filter(Job.id == j_id).first()
            if not job:
                results.append({"job_id": raw_id, "status": "failed", "error": "Job not found"})
                continue

            posting = _or_create_posting(db, job)
            context = build_job_generation_context(db, job.id, supplementary_info=posting.supplementary_info)
            created_platforms = []

            for plat in payload.platforms:
                plat_key = plat.lower()
                if plat_key not in PLATFORMS:
                    continue
                content, gen_method, model = generate_platform_advertisement(context, plat_key)
                quality = validate_advertisement_quality(context, plat_key, context.title, content)

                ver = (
                    db.query(JobPostingVersion)
                    .filter(
                        JobPostingVersion.posting_id == posting.id,
                        JobPostingVersion.platform == plat_key,
                    )
                    .first()
                )
                if not ver:
                    ver = JobPostingVersion(posting_id=posting.id, platform=plat_key)
                    db.add(ver)

                ver.title = context.title
                ver.content = quality["normalized_content"]
                ver.status = "Needs Recruiter Review" if quality["requires_recruiter_review"] else "AI Generated"
                ver.ai_generated = 1
                ver.model_name = model
                ver.generation_method = gen_method
                created_platforms.append(plat_key)

            db.commit()
            results.append({
                "job_id": job.id,
                "title": job.title,
                "status": "success",
                "platforms_generated": created_platforms,
            })
        except Exception as exc:
            results.append({"job_id": raw_id, "status": "failed", "error": str(exc)})

    return {"batch_size": len(payload.job_ids), "results": results}


@router.put("/versions/{version_id}")
def update_version(
    version_id: int,
    payload: VersionUpdateSchema,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Update advertisement draft text with automatic markdown normalization and quality check."""
    version = db.query(JobPostingVersion).filter(JobPostingVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Advertisement version not found.")

    posting = db.query(JobPosting).filter(JobPosting.id == version.posting_id).first()
    job = db.query(Job).filter(Job.id == posting.job_id).first() if posting else None
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    context = build_job_generation_context(db, job.id, supplementary_info=posting.supplementary_info)
    quality = validate_advertisement_quality(
        context,
        version.platform,
        payload.title or version.title or context.title,
        payload.content,
    )

    version.title = payload.title or version.title
    version.content = quality["normalized_content"]
    version.status = "Needs Recruiter Review" if quality["requires_recruiter_review"] else payload.status
    version.updated_at = datetime.now(timezone.utc)

    db.add(JobPostingActivity(
        posting_id=version.posting_id,
        action="edited",
        details={
            "platform": version.platform,
            "status": version.status,
            "warnings_count": len(quality["warnings"]),
        },
    ))
    db.commit()
    db.refresh(version)

    return {
        "id": version.id,
        "platform": version.platform,
        "title": version.title,
        "content": version.content,
        "status": version.status,
        "validation": quality,
    }


@router.post("/versions/{version_id}/approve")
def approve_version(version_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Approve an advertisement version. Approval is strictly blocked if critical contradictions exist."""
    version = db.query(JobPostingVersion).filter(JobPostingVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Advertisement version not found.")

    posting = db.query(JobPosting).filter(JobPosting.id == version.posting_id).first()
    job = db.query(Job).filter(Job.id == posting.job_id).first() if posting else None
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    context = build_job_generation_context(db, job.id, supplementary_info=posting.supplementary_info)
    quality = validate_advertisement_quality(context, version.platform, version.title or context.title, version.content)

    if quality["blocking_errors"]:
        version.status = "Needs Recruiter Review"
        db.add(JobPostingActivity(
            posting_id=version.posting_id,
            action="approval_blocked",
            details={"platform": version.platform, "blocking_errors": quality["blocking_errors"]},
        ))
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Approval blocked by critical contradictions: " + " ".join(quality["blocking_errors"]),
        )

    version.status = "Approved"
    version.approval_timestamp = datetime.now(timezone.utc)
    version.updated_at = datetime.now(timezone.utc)

    posting.status = "Approved"
    posting.updated_at = datetime.now(timezone.utc)

    db.add(JobPostingActivity(
        posting_id=version.posting_id,
        action="approved",
        details={"platform": version.platform},
    ))
    db.commit()

    return {
        "id": version.id,
        "status": version.status,
        "approval_timestamp": version.approval_timestamp.isoformat(),
    }


@router.post("/versions/{version_id}/publish")
def record_publish(
    version_id: int,
    payload: PublishSchema,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Record external publishing URL and status. Requires recruiter approval prior to Published status."""
    version = db.query(JobPostingVersion).filter(JobPostingVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Advertisement version not found.")

    if payload.status not in ("Ready to Publish", "Published", "Paused", "Closed", "Archived"):
        raise HTTPException(status_code=400, detail="Invalid posting status.")

    if payload.status == "Published" and version.status != "Approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A recruiter must approve the advertisement before Published status can be recorded.",
        )

    version.status = payload.status
    version.external_posting_url = payload.external_posting_url
    version.job_id_external = payload.job_id_external
    if payload.status == "Published":
        version.publication_timestamp = datetime.now(timezone.utc)
    version.updated_at = datetime.now(timezone.utc)

    posting = db.query(JobPosting).filter(JobPosting.id == version.posting_id).first()
    if posting:
        posting.status = payload.status
        posting.updated_at = datetime.now(timezone.utc)

    db.add(JobPostingActivity(
        posting_id=version.posting_id,
        action="publish_status_updated",
        details={"platform": payload.platform, "status": payload.status, "url": payload.external_posting_url},
    ))
    db.commit()

    return {
        "id": version.id,
        "status": version.status,
        "external_posting_url": version.external_posting_url,
        "publication_timestamp": version.publication_timestamp.isoformat() if version.publication_timestamp else None,
    }


@router.post("/jobs/{job_id}/metrics")
def record_metrics(
    job_id: str,
    payload: MetricsSchema,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Record verified or manually reported performance metrics (views, clicks, applications)."""
    j_id = _parse_job_id(job_id)
    job = db.query(Job).filter(Job.id == j_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    posting = _or_create_posting(db, job)
    row = JobPostingMetrics(
        posting_id=posting.id,
        platform=payload.platform,
        metrics=payload.metrics,
        source=payload.source,
    )
    db.add(row)
    db.add(JobPostingActivity(
        posting_id=posting.id,
        action="metrics_recorded",
        details={"platform": payload.platform, "source": payload.source},
    ))
    db.commit()
    db.refresh(row)

    return {
        "id": row.id,
        "platform": row.platform,
        "metrics": row.metrics,
        "source": row.source,
        "recorded_at": row.recorded_at.isoformat() if row.recorded_at else None,
    }


def _clean_plain_text(text: str) -> str:
    """Strip markdown bold syntax and orphan asterisks for clean text exports."""
    import re
    cleaned = re.sub(r"([A-Za-z0-9/& -]+):\*\*", r"\1:", text)
    cleaned = re.sub(r"\*\*([A-Za-z0-9/& -]+):", r"\1:", cleaned)
    cleaned = re.sub(r"\*\*(.+?)\*\*", r"\1", cleaned)
    return cleaned.replace("*", "")


def _add_styled_docx_runs(paragraph, text: str) -> None:
    """Add text runs to a Word paragraph with bold formatting and no raw asterisks."""
    import re
    normalized = re.sub(r"([A-Za-z0-9/& -]+):\*\*", r"**\1:**", text)
    normalized = re.sub(r"\*\*([A-Za-z0-9/& -]+):(?!\*)", r"**\1:**", normalized)
    tokens = re.split(r"\*\*(.+?)\*\*", normalized)
    for i, token in enumerate(tokens):
        cleaned = token.replace("*", "")
        if not cleaned:
            continue
        run = paragraph.add_run(cleaned)
        if i % 2 == 1:
            run.bold = True


def _clean_html_inline(text: str) -> str:
    """Convert bold markdown to HTML <b> tags with no raw asterisks."""
    import html
    import re
    normalized = re.sub(r"([A-Za-z0-9/& -]+):\*\*", r"**\1:**", text)
    normalized = re.sub(r"\*\*([A-Za-z0-9/& -]+):(?!\*)", r"**\1:**", normalized)
    tokens = re.split(r"\*\*(.+?)\*\*", normalized)
    parts = []
    for i, token in enumerate(tokens):
        cleaned = token.replace("*", "")
        if not cleaned:
            continue
        escaped = html.escape(cleaned)
        if i % 2 == 1:
            parts.append(f"<b>{escaped}</b>")
        else:
            parts.append(escaped)
    return "".join(parts)


def _is_redundant_title_line(line_text: str, clean_title: str) -> bool:
    """Check if a line matches or redundantly repeats the main advertisement title."""
    import re
    if not clean_title or not line_text:
        return False
    c_line = _clean_plain_text(line_text).strip().lower()
    c_line = re.sub(r"^[#*•·+\s\-]+", "", c_line)
    c_line = re.sub(r"[*#:]+$", "", c_line).strip()
    c_line = re.sub(r"^(?:we're hiring:?\s*|hiring:?\s*|🚀\s*employee referral opportunity:?\s*|job title:?\s*|role:?\s*|position:?\s*)", "", c_line).strip()
    c_line = re.sub(r"\s*[-–]\s*[a-z0-9\s,&/()]+$", "", c_line).strip()
    c_title = clean_title.lower().strip()
    c_title = re.sub(r"\s*[-–]\s*[a-z0-9\s,&/()]+$", "", c_title).strip()
    return c_line == c_title or c_line.startswith(c_title) or c_title.startswith(c_line)


def _generate_docx_bytes(title: str, content: str) -> bytes:
    import docx
    import io
    import re

    doc = docx.Document()
    clean_title = _clean_plain_text(title).strip() if title else ""
    if clean_title:
        doc.add_heading(clean_title, level=1)

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if _is_redundant_title_line(line, clean_title):
            continue
        h_match = re.match(r"^(#{1,6})\s*(.+)$", line)
        if h_match:
            heading_text = _clean_plain_text(h_match.group(2).rstrip(":")).strip()
            if _is_redundant_title_line(heading_text, clean_title):
                continue
            lvl = min(len(h_match.group(1)), 3)
            doc.add_heading(heading_text, level=lvl)
            continue
        b_match = re.match(r"^(?:[-*+•·]|\d+[.)])\s+(.+)$", line)
        if b_match:
            p = doc.add_paragraph(style="List Bullet")
            _add_styled_docx_runs(p, b_match.group(1))
            continue
        p = doc.add_paragraph()
        _add_styled_docx_runs(p, line)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _generate_pdf_bytes(title: str, content: str) -> bytes:
    import html
    import io
    import re
    import pymupdf

    clean_title = _clean_plain_text(title or "Job Advertisement").strip()

    body_html = []
    in_list = False
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped:
            if in_list:
                body_html.append("</ul>")
                in_list = False
            continue
        if _is_redundant_title_line(stripped, clean_title):
            continue
        h_match = re.match(r"^(#{1,6})\s*(.+)$", stripped)
        if h_match:
            if in_list:
                body_html.append("</ul>")
                in_list = False
            heading_text = _clean_plain_text(h_match.group(2).rstrip(":")).strip()
            if _is_redundant_title_line(heading_text, clean_title):
                continue
            lvl = min(len(h_match.group(1)) + 1, 4)
            body_html.append(f"<h{lvl}>{html.escape(heading_text)}</h{lvl}>")
            continue
        b_match = re.match(r"^(?:[-*+•·]|\d+[.)])\s+(.+)$", stripped)
        if b_match:
            if not in_list:
                body_html.append("<ul>")
                in_list = True
            body_html.append(f"<li>{_clean_html_inline(b_match.group(1))}</li>")
            continue
        if in_list:
            body_html.append("</ul>")
            in_list = False
        body_html.append(f"<p>{_clean_html_inline(stripped)}</p>")
    if in_list:
        body_html.append("</ul>")

    clean_title = _clean_plain_text(title or "Job Advertisement")
    full_html = f"""<style>
body {{ font-family: sans-serif; font-size: 10pt; line-height: 1.5; color: #1e293b; margin: 0; }}
h1 {{ font-size: 16pt; color: #0f172a; margin-top: 0; margin-bottom: 12pt; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4pt; }}
h2 {{ font-size: 13pt; color: #1e293b; margin-top: 14pt; margin-bottom: 6pt; }}
h3 {{ font-size: 11pt; color: #334155; margin-top: 10pt; margin-bottom: 4pt; }}
p {{ margin: 0 0 6pt 0; }}
ul {{ margin: 0 0 8pt 0; padding-left: 20pt; }}
li {{ margin-bottom: 3pt; }}
</style>
<h1>{html.escape(clean_title)}</h1>
{''.join(body_html)}"""

    buf = io.BytesIO()
    writer = pymupdf.DocumentWriter(buf)
    story = pymupdf.Story(html=full_html)
    rect = pymupdf.Rect(54, 54, 595 - 54, 842 - 54)
    more = 1
    while more:
        dev = writer.begin_page(pymupdf.Rect(0, 0, 595, 842))
        more, _ = story.place(rect)
        story.draw(dev)
        writer.end_page()
    writer.close()
    return buf.getvalue()


@router.post("/export")
def export_advertisement(payload: ExportSchema) -> Response:
    """Export advertisement content as PDF, DOCX (Word), or TXT without stray asterisk characters."""
    import re

    fmt = payload.format.lower().strip()
    safe_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", (payload.filename or payload.title or "job-ad").strip())[:60]
    if fmt in ("docx", "word"):
        content_bytes = _generate_docx_bytes(payload.title, payload.content)
        return Response(
            content=content_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.docx"'},
        )
    elif fmt == "pdf":
        content_bytes = _generate_pdf_bytes(payload.title, payload.content)
        return Response(
            content=content_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
        )
    elif fmt == "txt":
        clean_title = _clean_plain_text(payload.title).strip() if payload.title else ""
        clean_body = _clean_plain_text(payload.content).strip()
        body_lines = clean_body.splitlines()
        while body_lines and not body_lines[0].strip():
            body_lines.pop(0)
        if body_lines and clean_title and _is_redundant_title_line(body_lines[0], clean_title):
            body_lines.pop(0)
        remaining_body = "\n".join(body_lines).strip()
        text_str = f"{clean_title}\n\n{remaining_body}" if clean_title else remaining_body
        return Response(
            content=text_str.encode("utf-8"),
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.txt"'},
        )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported export format: {payload.format}. Allowed: pdf, docx, txt.",
        )
