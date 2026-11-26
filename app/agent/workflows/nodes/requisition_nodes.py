"""Requisition loading, validation, and JD intelligence nodes for LangGraph workflows."""

from datetime import datetime, timezone
from typing import Any, Dict

from database.sqlite_connection import get_db
from database.models import Job, JobDescription
from app.services.skill_taxonomy_service import detect_jd_domain, extract_skills_from_jd
from app.agent.workflows.state import RecruitmentState


def load_requisition_node(state: RecruitmentState) -> Dict[str, Any]:
    """Node 1: Load requisition metadata and original JD text from SQLite."""
    job_id = state.get("job_id")
    if not job_id:
        return {
            "current_stage": "load_requisition",
            "errors": state.get("errors", []) + ["Missing job_id in workflow state."],
            "status": "failed",
        }

    db = next(get_db())
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return {
                "current_stage": "load_requisition",
                "errors": state.get("errors", []) + [f"Job #{job_id} not found in database."],
                "status": "failed",
            }

        # Look for source JobDescription document if available
        source_doc = (
            db.query(JobDescription).filter(JobDescription.id == job.job_description_id).first()
            if job.job_description_id
            else db.query(JobDescription).filter(JobDescription.title == job.title).first()
        )
        raw_text = source_doc.original_text if source_doc and source_doc.original_text else (job.description or "")

        return {
            "job_title": job.title or f"Job #{job.id}",
            "job_description": raw_text,
            "department": job.department,
            "location": job.location,
            "min_experience_years": job.min_experience_years,
            "openings_count": job.openings_count or 1,
            "requisition_status": (job.status or "open").lower(),
            "current_stage": "validate_requisition",
            "status": "running",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()


def validate_requisition_node(state: RecruitmentState) -> Dict[str, Any]:
    """Node 2: Validate that the requisition is active, has sufficient text, and is eligible for sourcing."""
    status = (state.get("requisition_status") or "").lower()
    desc = state.get("job_description") or ""

    eligible_statuses = {"open", "active", "under review", "draft"}
    errors = list(state.get("errors", []))

    if status and status not in eligible_statuses:
        errors.append(f"Requisition #{state.get('job_id')} is '{status}'. Automated sourcing only runs on active/open jobs.")
        return {
            "current_stage": "validation_failed",
            "errors": errors,
            "status": "failed",
        }

    if len(desc.strip()) < 30:
        errors.append(f"Requisition #{state.get('job_id')} has insufficient JD text ({len(desc.strip())} chars) for reliable AI analysis.")
        return {
            "current_stage": "validation_failed",
            "errors": errors,
            "status": "failed",
        }

    return {
        "current_stage": "analyze_job_description",
        "status": "running",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def analyze_job_description_node(state: RecruitmentState) -> Dict[str, Any]:
    """Node 3: Extract domain categorization and structured mandatory/preferred skills using authoritative taxonomy."""
    title = state.get("job_title", "")
    text = state.get("job_description", "")

    # Domain detection
    domain_id, domain_meta = detect_jd_domain(title, text)
    domain_label = domain_meta.get("label", "General Specialization")

    # Authoritative skill taxonomy extraction
    extraction = extract_skills_from_jd(text, title=title, use_ai=False)
    mandatory_skills = extraction.get("mandatory_skills", [])
    preferred_skills = extraction.get("preferred_skills", [])
    domain_terms = extraction.get("domain_terms", [])

    return {
        "domain_id": domain_id,
        "domain_label": domain_label,
        "mandatory_skills": mandatory_skills,
        "preferred_skills": preferred_skills,
        "domain_terms": domain_terms,
        "current_stage": "identify_recruitment_strategy",
        "status": "running",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def identify_recruitment_strategy_node(state: RecruitmentState) -> Dict[str, Any]:
    """Node 4: Determine the primary recruitment sourcing strategy based on domain and role characteristics."""
    domain_id = state.get("domain_id", "")
    existing_strategy = state.get("sourcing_strategy")

    if existing_strategy:
        strategy = existing_strategy
    elif domain_id in ("creative_design", "retail_product_operations", "cad_engineering", "finance_accounting"):
        strategy = "Direct Industry Experience"
    elif domain_id in ("semiconductor_vlsi", "sap_erp", "servicenow_itsm", "cloud_infrastructure"):
        strategy = "Technology / Tool-Based Sourcing"
    else:
        strategy = "Tier-1 Competitors & Parallel Ecosystems"

    return {
        "sourcing_strategy": strategy,
        "current_stage": "generate_sourcing_intelligence",
        "status": "running",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
