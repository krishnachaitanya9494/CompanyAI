"""Comprehensive Phase 1 Core Talent Intelligence unit & API tests."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from database import sqlite_connection
from app.services.candidate_relationship_service import build_candidate_network, build_recruitment_graph
from app.services.resume_evolution_service import analyze_resume_evolution
from app.services.skill_taxonomy_service import (
    get_related_adjacent_skills,
    normalize_skill,
    normalize_skills_list,
)
from app.services.talent_intelligence_service import (
    build_candidate_digital_twin,
    evaluate_candidate_potential_and_mobility,
)
from database.models import Candidate, Interview, Job, Resume


def test_skill_normalization_distinguishes_aliases_from_adjacent() -> None:
    """Confirm confirmed aliases normalize equivalently while adjacent skills stay separate."""
    hfm = normalize_skill("hfm")
    assert hfm["canonical"] == "Hyperion Financial Management"
    assert hfm["match_type"] == "alias_equivalent"
    assert hfm["is_equivalent"] is True

    exact = normalize_skill("Java")
    assert exact["canonical"] == "Java"
    assert exact["match_type"] == "exact"

    deduped = normalize_skills_list(["Java", "core java", "Spring Boot"])
    assert [d["canonical"] for d in deduped] == ["Java", "Spring Boot"]

    adjacent = get_related_adjacent_skills(["Manual Testing"])
    adj_names = [a["skill"] for a in adjacent]
    assert "Automation Testing" in adj_names
    assert all(a["relationship_type"] == "related_adjacent" for a in adjacent)


def test_resume_evolution_tracks_new_skills_without_assuming_loss(tmp_path: Path) -> None:
    """Verify multi-resume chronological comparison and omission disclaimer."""
    r1_file = tmp_path / "resume_v1.txt"
    r1_file.write_text("John Doe\nJava Developer\nSkills: Java, SQL, Spring Boot\n", encoding="utf-8")
    r2_file = tmp_path / "resume_v2.txt"
    r2_file.write_text("John Doe\nSenior Java Developer\nSkills: Java, Spring Boot, AWS, Docker\n", encoding="utf-8")

    db_session = sqlite_connection.SessionLocal()
    try:
        cand = Candidate(name="John Doe", skills=["Java", "SQL", "Spring Boot", "AWS", "Docker"], experience_years=6.0)
        db_session.add(cand)
        db_session.commit()
        db_session.refresh(cand)

        res1 = Resume(candidate_id=cand.id, source_filename="resume_v1.txt", file_path=str(r1_file), content_sha256="a" * 64, created_at=datetime(2025, 1, 1, tzinfo=timezone.utc))
        res2 = Resume(candidate_id=cand.id, source_filename="resume_v2.txt", file_path=str(r2_file), content_sha256="b" * 64, created_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
        db_session.add_all([res1, res2])
        db_session.commit()

        evo = analyze_resume_evolution(db_session, cand.id)
        assert evo["resume_count"] == 2
        assert evo["has_multiple_versions"] is True
        v2 = evo["timeline"][1]
        assert "AWS" in v2["newly_detected_skills"]
        assert "Docker" in v2["newly_detected_skills"]
        assert "SQL" in v2["not_mentioned_in_this_version"]
        assert "lost" in (v2["omission_disclaimer"] or "").lower()
    finally:
        db_session.close()


def test_digital_twin_missing_file_graceful_and_potential_separation() -> None:
    """Ensure missing disk files do not crash Digital Twin and verified/inferred skills stay separated."""
    db_session = sqlite_connection.SessionLocal()
    try:
        cand = Candidate(name="Priya QA", skills=["Manual Testing", "SQL"], experience_years=4.0, location="Hyderabad")
        job = Job(title="Automation QA Engineer", description="Automation testing role", required_skills=["Automation Testing", "Selenium", "SQL"], status="open", client_name="Acme Global")
        db_session.add_all([cand, job])
        db_session.commit()
        db_session.refresh(cand)

        missing_res = Resume(candidate_id=cand.id, source_filename="missing.pdf", file_path="/nonexistent/missing.pdf", content_sha256="c" * 64)
        db_session.add(missing_res)
        db_session.commit()

        twin = build_candidate_digital_twin(db_session, cand.id)
        assert twin["candidate"]["name"] == "Priya QA"
        assert twin["resume_versions"][0]["disk_text_available"] is False

        mob = evaluate_candidate_potential_and_mobility(db_session, cand.id)
        roles = {r["recommended_role"]: r for r in mob["recommended_roles"]}
        assert "Automation QA Engineer" in roles
        qa_role = roles["Automation QA Engineer"]
        assert "SQL" in qa_role["verified_skills_matched"]
        assert "Automation Testing" in qa_role["transferable_adjacent_skills"]
        assert "Automation Testing" in qa_role["missing_mandatory_skills"]
    finally:
        db_session.close()


def test_candidate_network_and_graph_deduplication_and_api_routes() -> None:
    """Verify network isolation, graph edge deduplication, empty filter behavior, and 400/404 API handling."""
    db_session = sqlite_connection.SessionLocal()
    try:
        c1 = Candidate(name="Dev One", skills=["Java", "Spring Boot", "SQL"], location="Pune")
        c2 = Candidate(name="Dev Two", skills=["Java", "Spring Boot", "AWS"], location="Mumbai")
        j1 = Job(title="Java Lead", description="Java Spring Boot lead", required_skills=["Java", "Spring Boot"], status="active", client_name="FinCorp")
        db_session.add_all([c1, c2, j1])
        db_session.commit()
        db_session.refresh(c1)

        iv = Interview(candidate_id=c1.id, round_name="Tech Round 1", status="Scheduled", interviewer="Lead")
        db_session.add(iv)
        db_session.commit()

        net = build_candidate_network(db_session, c1.id)
        assert net["total_discovered"] >= 1
        assert net["connections"][0]["relationship_strength"] == "technical_similarity"

        graph = build_recruitment_graph(db_session, skill="Java")
        edge_ids = [e["id"] for e in graph["edges"]]
        assert len(edge_ids) == len(set(edge_ids))
        assert any(n["type"] == "client" and n["label"] == "FinCorp" for n in graph["nodes"])
    finally:
        db_session.close()

    client = TestClient(app)
    assert client.get("/api/intelligence/candidates/999999/digital-twin").status_code == 404
    assert client.get("/api/intelligence/candidates/abc/digital-twin").status_code == 400
    r_graph = client.get("/api/intelligence/graph?skill=Java")
    assert r_graph.status_code == 200
    assert r_graph.json()["stats"]["total_nodes"] >= 3
