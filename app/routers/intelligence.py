"""FastAPI router exposing Phase 1 & Phase 2 Talent Intelligence endpoints."""

from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database.sqlite_connection import get_db
from app.services.skill_taxonomy_service import (
    get_related_adjacent_skills,
    normalize_skills_list,
)
from app.services.talent_intelligence_service import (
    build_candidate_digital_twin,
    evaluate_candidate_potential_and_mobility,
)
from app.services.resume_evolution_service import analyze_resume_evolution
from app.services.candidate_relationship_service import (
    build_candidate_network,
    build_recruitment_graph,
)
from app.services.market_intelligence_service import (
    get_market_experience,
    get_market_locations,
    get_market_overview,
    get_market_skill_combinations,
    get_market_skills,
)
from app.services.talent_supply_demand_service import (
    get_job_supply_demand_detail,
    get_supply_demand_overview,
    get_supply_demand_shortages,
    get_supply_demand_skills,
)
from app.services.strategic_sourcing_service import (
    get_candidate_sourcing_opportunities,
    get_job_sourcing_alternatives,
    get_job_sourcing_recommendations,
)
from app.services.hiring_difficulty_service import (
    assess_job_hiring_difficulty,
    get_hiring_difficulty_overview,
)

router = APIRouter(prefix="/api/intelligence", tags=["Phase 1 Talent Intelligence"])


def _parse_candidate_id(candidate_id: str) -> int:
    """Parse numeric or 'cand-001' style IDs into an integer primary key."""
    raw = (candidate_id or "").strip()
    if raw.lower().startswith("cand-"):
        raw = raw[5:].lstrip("0") or "0"
    try:
        cid = int(raw)
        if cid < 1:
            raise ValueError("Candidate ID must be positive.")
        return cid
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid candidate ID format.") from exc


@router.get("/skills/normalize")
def normalize_skills_endpoint(
    skills: str = Query(..., description="Comma-separated list of raw skill strings"),
) -> dict[str, Any]:
    """Normalize skills with exact/alias provenance and adjacent technology suggestions."""
    raw_list = [s.strip() for s in skills.split(",") if s.strip()]
    normalized = normalize_skills_list(raw_list)
    canonical_names = [item["canonical"] for item in normalized]
    adjacent = get_related_adjacent_skills(canonical_names)
    return {
        "normalized_skills": normalized,
        "related_adjacent_skills": adjacent,
    }


@router.get("/candidates/{candidate_id}/digital-twin")
def get_candidate_digital_twin(
    candidate_id: str,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return the 360-degree Candidate Digital Twin grounded in SQLite and resume files."""
    cid = _parse_candidate_id(candidate_id)
    try:
        return build_candidate_digital_twin(db, cid)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/candidates/{candidate_id}/resume-evolution")
def get_candidate_resume_evolution(
    candidate_id: str,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Compare multiple resume versions chronologically for a candidate."""
    cid = _parse_candidate_id(candidate_id)
    try:
        return analyze_resume_evolution(db, cid)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/candidates/{candidate_id}/potential-mobility")
def get_candidate_potential_mobility(
    candidate_id: str,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return verified vs transferable skills, alternative role paths, and open job fits."""
    cid = _parse_candidate_id(candidate_id)
    try:
        return evaluate_candidate_potential_and_mobility(db, cid)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/candidates/{candidate_id}/network")
def get_candidate_network(
    candidate_id: str,
    limit: int = Query(default=12, ge=1, le=50),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return evidence-backed candidate relationship network."""
    cid = _parse_candidate_id(candidate_id)
    try:
        return build_candidate_network(db, cid, limit=limit)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/graph")
def get_recruitment_intelligence_graph(
    skill: Optional[str] = Query(default=None, description="Filter by canonical/partial skill name"),
    client: Optional[str] = Query(default=None, description="Filter by client name"),
    candidate_id: Optional[int] = Query(default=None, ge=1),
    job_id: Optional[int] = Query(default=None, ge=1),
    limit_candidates: int = Query(default=30, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return interactive Recruitment Intelligence Graph nodes and edges from SQLite."""
    return build_recruitment_graph(
        db=db,
        skill=skill,
        client=client,
        candidate_id=candidate_id,
        job_id=job_id,
        limit_candidates=limit_candidates,
    )


# ---------------------------------------------------------------------------
# Phase 2A: Internal Talent Market Intelligence Endpoints
# ---------------------------------------------------------------------------


@router.get("/market/overview")
def market_overview_endpoint(
    skill: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    experience_band: Optional[str] = Query(default=None),
    location: Optional[str] = Query(default=None),
    availability: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return Internal Talent Market Intelligence overview with optional filters."""
    return get_market_overview(
        db=db,
        skill=skill,
        category=category,
        experience_band=experience_band,
        location=location,
        availability=availability,
    )


@router.get("/market/skills")
def market_skills_endpoint(
    category: Optional[str] = Query(default=None),
    location: Optional[str] = Query(default=None),
    experience_band: Optional[str] = Query(default=None),
    availability: Optional[str] = Query(default=None),
    limit: int = Query(default=30, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return paginated canonical skill counts in the internal candidate pool."""
    return get_market_skills(
        db=db,
        category=category,
        location=location,
        experience_band=experience_band,
        availability=availability,
        limit=limit,
        offset=offset,
    )


@router.get("/market/locations")
def market_locations_endpoint(
    skill: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return normalized location distribution across candidates and open jobs."""
    return get_market_locations(db=db, skill=skill, category=category)


@router.get("/market/experience")
def market_experience_endpoint(
    skill: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    location: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return candidate experience-band distribution and summary stats."""
    return get_market_experience(db=db, skill=skill, category=category, location=location)


@router.get("/market/skill-combinations")
def market_skill_combinations_endpoint(
    min_cooccurrence: int = Query(default=2, ge=1, le=50),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return frequently co-occurring canonical technology skill pairs."""
    return get_market_skill_combinations(db=db, min_cooccurrence=min_cooccurrence, limit=limit)


# ---------------------------------------------------------------------------
# Phase 2B: Talent Supply & Demand Intelligence Endpoints
# ---------------------------------------------------------------------------


@router.get("/supply-demand/overview")
def supply_demand_overview_endpoint(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Return internal Talent Supply vs Demand overview and shortage summary."""
    return get_supply_demand_overview(db)


@router.get("/supply-demand/skills")
def supply_demand_skills_endpoint(
    classification: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return paginated skill-level Supply & Demand metrics."""
    return get_supply_demand_skills(
        db=db,
        classification=classification,
        category=category,
        limit=limit,
        offset=offset,
    )


@router.get("/supply-demand/shortages")
def supply_demand_shortages_endpoint(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Return skills classified as Critical Shortage or Low Supply."""
    return get_supply_demand_shortages(db)


@router.get("/supply-demand/jobs/{job_id}")
def supply_demand_job_detail_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return job-level drill-down of skill supply vs requirement demand."""
    try:
        return get_job_supply_demand_detail(db, job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Phase 2C: Strategic Sourcing Intelligence Endpoints
# ---------------------------------------------------------------------------


@router.get("/sourcing/jobs/{job_id}/recommendations")
def sourcing_job_recommendations_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return advisory strategic sourcing recommendations for a specific job."""
    try:
        return get_job_sourcing_recommendations(db, job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/sourcing/jobs/{job_id}/alternatives")
def sourcing_job_alternatives_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return exact vs adjacent-skill internal candidate alternatives for a job."""
    try:
        return get_job_sourcing_alternatives(db, job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/sourcing/candidate-opportunities")
def sourcing_candidate_opportunities_endpoint(
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return underutilized early-stage candidates matching open jobs."""
    return get_candidate_sourcing_opportunities(db=db, limit=limit, offset=offset)


# ---------------------------------------------------------------------------
# Phase 2D: Hiring Difficulty Predictor (Evidence-Based Heuristic) Endpoints
# ---------------------------------------------------------------------------


@router.get("/hiring-difficulty/overview")
def hiring_difficulty_overview_endpoint(
    include_closed: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return evidence-based heuristic hiring difficulty overview across jobs."""
    return get_hiring_difficulty_overview(db=db, include_closed=include_closed)


@router.get("/hiring-difficulty/jobs/{job_id}")
def hiring_difficulty_job_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return detailed heuristic hiring difficulty assessment for a specific job."""
    try:
        return assess_job_hiring_difficulty(db, job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
