"""Comprehensive Sourcing Intelligence Service for CompanyAI.

Brings together:
1. Structured JD Requirements & Domain Classification
2. Platform-aware Boolean Queries (Naukri, LinkedIn, X-Ray)
3. Target Headhunting Companies & Sourcing Ecosystems
4. Internal Talent Supply & Explainable Hiring Difficulty
5. Strategic Recruiter Recommendations & Action Plan
"""

from __future__ import annotations

from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from database.models import Job, JobDescription
from app.services.skill_taxonomy_service import extract_skills_from_jd
from app.services.boolean_query_service import generate_boolean_queries
from app.services.target_company_service import get_target_company_recommendations_for_job
from app.services.hiring_difficulty_service import generate_explainable_hiring_difficulty_insights


def get_unified_sourcing_intelligence_for_job(
    db: Session,
    job_id: int,
    search_mode: str = "balanced",
    selected_strategy: Optional[str] = None,
) -> Dict[str, Any]:
    """Compile the single-source-of-truth recruitment sourcing intelligence packet for a job."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return {"error": "Job not found"}

    source_jd = (
        db.query(JobDescription).filter(JobDescription.id == job.job_description_id).first()
        if job.job_description_id
        else None
    )
    raw_text = source_jd.original_text if source_jd and source_jd.original_text else job.description or ""

    # 1. Shared JD Intelligence & Taxonomy Extraction
    extraction = extract_skills_from_jd(raw_text, title=job.title or "", use_ai=False)
    mandatory_skills = extraction.get("mandatory_skills", [])
    preferred_skills = extraction.get("preferred_skills", [])

    # 2. Target Company Recommendations & Sourcing Strategy
    company_intel = get_target_company_recommendations_for_job(
        db=db,
        job_id=job.id,
        selected_strategy=selected_strategy,
    )
    target_cos_sample = [c["name"] for c in company_intel.get("companies", [])[:6]]

    # 3. Boolean Search Generation
    boolean_intel = generate_boolean_queries(
        title=job.title or "",
        mandatory_skills=mandatory_skills,
        preferred_skills=preferred_skills,
        domain_terms=extraction.get("domain_terms"),
        alternative_titles=extraction.get("alternative_titles"),
        adjacent_skills=extraction.get("adjacent_skills"),
        term_explanations=extraction.get("term_explanations"),
        location=job.location,
        experience_years=job.min_experience_years,
        target_companies=target_cos_sample,
        job_id=job.id,
        search_mode=search_mode,
    ).model_dump()

    # 4. Market Supply & Explainable Hiring Difficulty
    difficulty_intel = generate_explainable_hiring_difficulty_insights(db=db, job_id=job.id)

    # 5. Compile Sourcing Action Plan
    tier = difficulty_intel.get("difficulty_classification", "Moderate Difficulty")
    score = difficulty_intel.get("difficulty_score", 50)
    primary_strategy = company_intel.get("primary_strategy", "Direct Industry Experience")
    ecosystem = company_intel.get("ecosystem_name", "Corporate Talent Sourcing Ecosystem")

    action_items = [
        f"Prioritize sourcing strategy: **{primary_strategy}** across verified {ecosystem}.",
        f"Deploy **{search_mode.title()} Mode** Boolean search queries across LinkedIn Recruiter and Naukri Resdex.",
    ]
    if tier in ("High Difficulty", "Very High Difficulty"):
        action_items.append("Expand headhunting to adjacent parallel domains and review geographic/relocation flexibility.")
    else:
        action_items.append("Screen top qualified candidates directly from internal database first before launching external searches.")

    return {
        "job_id": job.id,
        "job_title": job.title,
        "domain_id": extraction.get("domain"),
        "domain_label": extraction.get("domain_label"),
        "search_mode": search_mode,
        "primary_sourcing_strategy": primary_strategy,
        "strategy_rationale": company_intel.get("strategy_rationale"),
        "target_ecosystem_name": ecosystem,
        "hiring_difficulty": {
            "tier": tier,
            "score": score,
            "interpretation": difficulty_intel.get("ai_interpretation", {}),
            "candidate_supply": difficulty_intel.get("candidate_supply", {}),
            "location_constraints": difficulty_intel.get("location_constraints", {}),
        },
        "boolean_search": {
            "naukri": boolean_intel.get("naukri"),
            "linkedin": boolean_intel.get("linkedin"),
            "google_xray": boolean_intel.get("google_xray"),
            "simple_keywords": boolean_intel.get("simple_keywords"),
            "advanced_strategies": boolean_intel.get("advanced_strategies"),
            "term_explanations": boolean_intel.get("term_explanations"),
        },
        "target_companies": {
            "total_count": company_intel.get("total_companies_count", 0),
            "available_strategies": company_intel.get("available_strategies", []),
            "recommended_companies": company_intel.get("companies", [])[:15],
        },
        "recruiter_action_plan": action_items,
        "external_market_notice": "External market data unavailable — assessment based on internal candidate records.",
    }
