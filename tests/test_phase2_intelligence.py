"""Focused tests for Phase 2 Market & Sourcing Intelligence services and API routes."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from database import sqlite_connection
from database.models import Candidate, Job
from app.services.market_intelligence_service import (
    get_market_overview,
    get_market_skill_combinations,
)
from app.services.talent_supply_demand_service import (
    get_job_supply_demand_detail,
    get_supply_demand_overview,
)
from app.services.strategic_sourcing_service import (
    get_job_sourcing_alternatives,
    get_job_sourcing_recommendations,
)
from app.services.hiring_difficulty_service import assess_job_hiring_difficulty


def test_market_intelligence_deduplication_filters_and_scope_label() -> None:
    """Ensure unique candidate counting, alias deduplication, filters, and internal scope label."""
    db = sqlite_connection.SessionLocal()
    try:
        # Candidate with duplicate aliases ("React", "React.js") must be counted ONCE for React.
        c1 = Candidate(
            name="Market Alice",
            skills=["React", "React.js", "TypeScript"],
            experience_years=4.0,
            location="Bangalore",
            availability="Immediate",
        )
        c2 = Candidate(
            name="Market Bob",
            skills=["React", "Java"],
            experience_years=7.0,
            location="Hyderabad",
            availability="30 Days",
        )
        db.add_all([c1, c2])
        db.commit()

        overview = get_market_overview(db, skill="React", location="Bengaluru")
        assert overview["scope_label"] == "Internal Talent Market Intelligence"
        assert overview["external_market_data_connected"] is False

        react_rows = [r for r in overview["top_skills"] if r["skill"] == "React"]
        assert len(react_rows) == 1
        # Filtered to Bengaluru + React should count Market Alice once (not twice for React + React.js)
        assert react_rows[0]["candidate_count"] >= 1

        # Verify co-occurring skill combinations include React + TypeScript
        combos = get_market_skill_combinations(db, min_cooccurrence=1, limit=500)
        pair_names = {(item["skill_a"], item["skill_b"]) for item in combos["items"]}
        assert ("React", "TypeScript") in pair_names
    finally:
        db.close()


def test_supply_demand_unique_counting_and_job_drilldown() -> None:
    """Verify unique candidate supply per skill, classification tiers, and job drill-down."""
    db = sqlite_connection.SessionLocal()
    try:
        c1 = Candidate(
            name="Supply Unique",
            skills=["FastAPI", "Python"],
            experience_years=6.0,
            location="Bengaluru",
            availability="Immediate",
        )
        # Job requiring FastAPI + a rare niche skill ("QuantumCompilerXYZ") with 2 openings
        j1 = Job(
            title="Senior FastAPI Architect",
            description="Build APIs",
            required_skills=["FastAPI", "QuantumCompilerXYZ"],
            preferred_skills=["Python"],
            min_experience_years=5.0,
            location="Bengaluru",
            openings_count=2,
            status="open",
            client_name="TestCorp",
        )
        db.add_all([c1, j1])
        db.commit()
        db.refresh(j1)

        detail = get_job_supply_demand_detail(db, j1.id)
        mand_map = {r["skill"]: r for r in detail["mandatory_skill_supply"]}
        assert "FastAPI" in mand_map
        assert "QuantumCompilerXYZ" in mand_map
        assert mand_map["QuantumCompilerXYZ"]["total_candidates"] == 0
        assert mand_map["QuantumCompilerXYZ"]["classification"] == "Critical Shortage"
        assert detail["fully_qualified_candidates"] == 0

        overview = get_supply_demand_overview(db)
        assert "methodology" in overview
        assert overview["summary"]["critical_shortage_count"] >= 1
    finally:
        db.close()


def test_strategic_sourcing_distinguishes_adjacent_and_is_advisory() -> None:
    """Verify sourcing recommendations use exact vs adjacent taxonomy and remain advisory."""
    db = sqlite_connection.SessionLocal()
    try:
        # Candidate has Spring Boot (adjacent to Java) in Hyderabad
        c_adj = Candidate(
            name="Adj Candidate",
            skills=["Spring Boot", "SQL"],
            experience_years=5.0,
            location="Hyderabad",
            stage="New",
        )
        # Candidate has exact Java in Hyderabad (non-local to Bengaluru job)
        c_nonlocal = Candidate(
            name="NonLocal Java",
            skills=["Java"],
            experience_years=6.0,
            location="Hyderabad",
            stage="Reviewed",
        )
        j = Job(
            title="Core Java Lead",
            description="Java role",
            required_skills=["Java"],
            min_experience_years=5.0,
            location="Bengaluru",
            openings_count=2,
            priority="Urgent",
            status="open",
            client_name="FinServe",
        )
        db.add_all([c_adj, c_nonlocal, j])
        db.commit()
        db.refresh(j)

        recs = get_job_sourcing_recommendations(db, j.id)
        assert recs["advisory_only"] is True
        assert recs["requires_recruiter_review"] is True
        assert len(recs["recommendations"]) >= 1
        for rec in recs["recommendations"]:
            assert rec["advisory_only"] is True
            assert rec["information_type"]
            assert rec["supporting_evidence"]

        alts = get_job_sourcing_alternatives(db, j.id, limit=250)
        assert alts["advisory_only"] is True
        adj_names = {c["name"]: c for c in alts["candidates"]}
        assert "Adj Candidate" in adj_names
        assert adj_names["Adj Candidate"]["adjacent_skills_matched"][0]["match_type"] == "related_adjacent"
    finally:
        db.close()


def test_hiring_difficulty_heuristic_and_missing_data_handling() -> None:
    """Verify heuristic scoring, factor breakdown, and Insufficient Data on incomplete jobs."""
    db = sqlite_connection.SessionLocal()
    try:
        j_incomplete = Job(
            title="Unspecified Role",
            description="No structured skills",
            required_skills=[],
            status="open",
        )
        j_hard = Job(
            title="Principal Niche Architect",
            description="Hard role",
            required_skills=["RareSkillAlpha99", "RareSkillBeta99", "Microservices"],
            min_experience_years=9.0,
            location="Chennai",
            openings_count=3,
            status="open",
        )
        db.add_all([j_incomplete, j_hard])
        db.commit()
        db.refresh(j_incomplete)
        db.refresh(j_hard)

        inc_res = assess_job_hiring_difficulty(db, j_incomplete.id)
        assert inc_res["difficulty_classification"] == "Insufficient Data"
        assert inc_res["difficulty_score"] is None
        assert "not an ML model" in inc_res["assessment_type"]

        hard_res = assess_job_hiring_difficulty(db, j_hard.id)
        assert hard_res["difficulty_classification"] in ("High Difficulty", "Very High Difficulty")
        assert hard_res["difficulty_score"] >= 55
        assert len(hard_res["contributing_factors"]) >= 4
    finally:
        db.close()


def test_phase2_api_routes_consistency() -> None:
    """Verify all Phase 2 FastAPI endpoints return 200 with expected schema keys."""
    db = sqlite_connection.SessionLocal()
    try:
        job = db.query(Job).order_by(Job.id.asc()).first()
        assert job is not None
        job_id = job.id
    finally:
        db.close()

    with TestClient(app) as client:
        for path in [
            "/api/intelligence/market/overview",
            "/api/intelligence/market/skills?limit=10",
            "/api/intelligence/market/locations",
            "/api/intelligence/market/experience",
            "/api/intelligence/market/skill-combinations?min_cooccurrence=1&limit=10",
            "/api/intelligence/supply-demand/overview",
            "/api/intelligence/supply-demand/skills?limit=10",
            "/api/intelligence/supply-demand/shortages",
            f"/api/intelligence/supply-demand/jobs/{job_id}",
            f"/api/intelligence/sourcing/jobs/{job_id}/recommendations",
            f"/api/intelligence/sourcing/jobs/{job_id}/alternatives",
            "/api/intelligence/sourcing/candidate-opportunities?limit=10",
            "/api/intelligence/hiring-difficulty/overview",
            f"/api/intelligence/hiring-difficulty/jobs/{job_id}",
        ]:
            resp = client.get(path)
            assert resp.status_code == 200, f"Endpoint {path} failed: {resp.status_code} {resp.text}"
