"""Sourcing intelligence nodes for Boolean search, target companies, and market talent supply."""

from datetime import datetime, timezone
from typing import Any, Dict

from database.sqlite_connection import get_db
from app.services.boolean_query_service import generate_boolean_queries
from app.services.target_company_service import get_target_company_recommendations_for_job
from app.services.hiring_difficulty_service import assess_job_hiring_difficulty
from app.agent.workflows.state import RecruitmentState


def generate_boolean_queries_node(state: RecruitmentState) -> Dict[str, Any]:
    """Node 5: Generate deterministic, platform-formatted Boolean search queries (Naukri, LinkedIn, Google X-Ray)."""
    job_id = state.get("job_id")
    title = state.get("job_title", "")
    mandatory = state.get("mandatory_skills", [])
    preferred = state.get("preferred_skills", [])
    domain_terms = state.get("domain_terms", [])
    location = state.get("location")
    exp = state.get("min_experience_years")

    try:
        intel = generate_boolean_queries(
            title=title,
            mandatory_skills=mandatory,
            preferred_skills=preferred,
            domain_terms=domain_terms,
            location=location,
            experience_years=exp,
            job_id=job_id,
            search_mode="balanced",
        )
        return {
            "boolean_queries": intel.model_dump(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        return {
            "warnings": state.get("warnings", []) + [f"Boolean query generation notice: {exc}"],
            "boolean_queries": {},
        }


def recommend_target_companies_node(state: RecruitmentState) -> Dict[str, Any]:
    """Node 6: Identify curated corporate ecosystems and tier-classified target companies for headhunting."""
    job_id = state.get("job_id")
    strategy = state.get("sourcing_strategy")

    db = next(get_db())
    try:
        intel = get_target_company_recommendations_for_job(
            db=db,
            job_id=job_id,
            selected_strategy=strategy,
        )
        return {
            "ecosystem_name": intel.get("ecosystem_name", "Target Corporate Sourcing Ecosystem"),
            "strategy_rationale": intel.get("strategy_rationale", ""),
            "target_companies": intel.get("companies", []),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        return {
            "warnings": state.get("warnings", []) + [f"Target company sourcing notice: {exc}"],
            "target_companies": [],
        }
    finally:
        db.close()


def analyze_talent_supply_node(state: RecruitmentState) -> Dict[str, Any]:
    """Node 7: Calculate internal candidate supply, mandatory skill scarcity, and hiring difficulty from live SQLite data."""
    job_id = state.get("job_id")

    db = next(get_db())
    try:
        difficulty_data = assess_job_hiring_difficulty(db=db, job_id=job_id)
        ai_interp = difficulty_data.get("ai_interpretation", {})
        score = ai_interp.get("score") or difficulty_data.get("hiring_difficulty_score", 50)
        tier = ai_interp.get("tier") or difficulty_data.get("difficulty_tier", "Moderate")
        bottleneck = ai_interp.get("primary_bottleneck") or "Market skill availability"

        return {
            "talent_supply": difficulty_data,
            "hiring_difficulty_score": score,
            "hiring_difficulty_tier": tier,
            "supply_bottleneck": bottleneck,
            "current_stage": "retrieve_internal_candidates",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        return {
            "warnings": state.get("warnings", []) + [f"Talent supply calculation notice: {exc}"],
            "talent_supply": {},
            "hiring_difficulty_score": 50,
            "hiring_difficulty_tier": "Moderate",
            "supply_bottleneck": "Standard market talent distribution",
            "current_stage": "retrieve_internal_candidates",
        }
    finally:
        db.close()
