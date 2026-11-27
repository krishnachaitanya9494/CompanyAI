"""Tests for Intelligent AI Boolean Search Enhancement across 7 job categories.

Verifies:
1. Job title expansion, skill expansion, industry selection, and mandatory preservation
2. Strict, Balanced, and Broad modes (Broad preserves mandatory requirements)
3. Deterministic query syntax validation (parentheses, quotes, operators, char limits)
4. Natural-language recruiter instruction interpretation (AI + Ollama-offline fallback)
5. Contradictory/unusual instructions and editable suggestions regeneration
6. Compatibility with Naukri, LinkedIn, and Google X-Ray
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.boolean_query_service import (
    customize_boolean_query_conversationally,
    generate_boolean_queries,
    validate_boolean_query,
)

JOB_CATEGORIES = [
    ("Procurement Analyst", ["SAP MM", "Vendor Management", "Strategic Sourcing"], ["Coupa", "RFP"], "Bengaluru"),
    ("Workforce Management Analyst", ["Workforce Management", "NICE IEX", "Forecasting"], ["Intraday Management", "SQL"], "Bengaluru"),
    ("CAD Designer", ["AutoCAD", "Revit", "Drafting"], ["BIM", "Navisworks"], "Pune"),
    ("Art Director", ["Art Direction", "Brand Identity", "Adobe Photoshop"], ["Figma", "Storyboarding"], "Mumbai"),
    ("Staff Accountant", ["General Ledger", "Month-End Close", "GAAP"], ["SAP FICO", "Excel"], "Hyderabad"),
    ("Software Developer", ["Python", "FastAPI", "PostgreSQL"], ["Docker", "Kubernetes"], "Bengaluru"),
    ("Data Analyst", ["SQL", "Power BI", "Data Visualization"], ["Tableau", "Python"], "Gurugram"),
]


@pytest.mark.parametrize("title,mandatory,preferred,location", JOB_CATEGORIES)
def test_seven_job_categories_all_modes_valid(title, mandatory, preferred, location):
    """All 7 job categories produce syntactically valid Naukri, LinkedIn, and X-Ray queries across all 3 modes."""
    for mode in ("strict", "balanced", "broad"):
        res = generate_boolean_queries(
            title=title,
            mandatory_skills=mandatory,
            preferred_skills=preferred,
            location=location,
            search_mode=mode,
        )
        for platform_res in (res.naukri, res.linkedin, res.google_xray):
            assert platform_res.is_valid, f"{title} ({mode}) {platform_res.platform} invalid: {platform_res.validation_status}"
            assert platform_res.character_count <= platform_res.character_limit
            ok, status, _ = validate_boolean_query(platform_res.query, platform_res.character_limit)
            assert ok, f"{title} ({mode}) {platform_res.platform} failed validator: {status}"
        # Broad mode must preserve at least one core mandatory JD skill.
        if mode == "broad":
            assert any(m.lower() in res.naukri.query.lower() for m in mandatory)


def test_deterministic_fallback_when_ollama_offline():
    """When Ollama is unavailable, deterministic parser interprets instructions cleanly without copying full sentences."""
    instruction = (
        "Find candidates from procurement and purchasing backgrounds. "
        "Include manufacturing and IT services companies. "
        "Avoid freshers and focus on Bangalore with 5+ years and SAP MM experience."
    )
    with patch("app.ai.providers.chat_provider.chat_provider.is_available", return_value=False):
        res = customize_boolean_query_conversationally(
            title="Procurement Analyst",
            instruction=instruction,
            mandatory_skills=["SAP MM", "Vendor Management"],
            preferred_skills=["Coupa"],
            location="Pune",
        )
    assert res["ai_available"] is False
    assert "unavailable" in res["ai_status"].lower()
    assert res["naukri"]["is_valid"] is True
    assert res["linkedin"]["is_valid"] is True
    assert res["google_xray"]["is_valid"] is True
    assert "Find candidates from procurement" not in res["naukri"]["query"]
    assert "SAP MM" in res["naukri"]["query"]
    assert "Fresher" in res["custom_exclusions"]
    assert res["interpreted_suggestions"]["location_preference"] == "Bangalore"
    assert "5+ years" in res["interpreted_suggestions"]["experience_preference"]


def test_ai_instruction_interpretation_and_edited_regeneration():
    """Verify Ollama-interpreted structured intelligence and recruiter-edited regeneration."""
    mock_ai = {
        "target_titles": ["Procurement Analyst", "Purchasing Specialist"],
        "alternative_titles": ["Sourcing Analyst", "Buyer"],
        "required_skills": ["SAP MM", "Vendor Management"],
        "related_skills": ["Materials Management", "Procurement", "SAP Ariba"],
        "industries": ["Manufacturing", "IT Services"],
        "experience_preference": "4-7 years",
        "location_preference": "Bangalore",
        "exclusions": ["Intern", "Trainee", "Fresher"],
        "search_mode": "balanced",
        "explanation": "Targeted Procurement & Purchasing titles with SAP MM, Manufacturing/IT Services, and excluded freshers.",
    }
    with (
        patch("app.ai.providers.chat_provider.chat_provider.is_available", return_value=True),
        patch("app.ai.providers.chat_provider.chat_provider.extract_json", return_value=mock_ai),
    ):
        res = customize_boolean_query_conversationally(
            title="Procurement Analyst",
            instruction="Focus on manufacturing and IT services with SAP MM, avoid freshers",
            mandatory_skills=["SAP MM", "Vendor Management"],
            preferred_skills=["Coupa"],
            location="Bengaluru",
        )

    assert res["ai_available"] is True
    assert "Manufacturing" in res["interpreted_suggestions"]["industries"]
    assert "Purchasing Specialist" in res["interpreted_suggestions"]["titles"]
    assert res["naukri"]["is_valid"] is True
    assert "Manufacturing" in res["naukri"]["query"]

    # Recruiter edits suggestions and regenerates without calling AI again.
    edited = customize_boolean_query_conversationally(
        title="Procurement Analyst",
        instruction="",
        mandatory_skills=["SAP MM", "Vendor Management"],
        custom_titles=["Procurement Analyst", "Strategic Buyer"],
        custom_related_skills=["SAP Ariba"],
        custom_industries=["Automotive"],
        exclusions=["Fresher"],
        apply_edited_suggestions=True,
    )
    assert "Automotive" in edited["naukri"]["query"]
    assert "Strategic Buyer" in edited["naukri"]["query"]
    assert edited["naukri"]["is_valid"] is True


def test_contradictory_instruction_resolution_and_validator():
    """Contradictory inclusion/exclusion terms are resolved without dropping mandatory JD skills."""
    with patch("app.ai.providers.chat_provider.chat_provider.is_available", return_value=False):
        res = customize_boolean_query_conversationally(
            title="Data Analyst",
            instruction="Exclude SQL and avoid Power BI",
            mandatory_skills=["SQL", "Power BI"],
            preferred_skills=["Tableau"],
            exclusions=["SQL", "Intern"],
        )
    assert "SQL" in res["naukri"]["query"]
    assert "SQL" not in res["custom_exclusions"]
    assert len(res["validation_warnings"]) >= 1

    ok_bad_parens, _, _ = validate_boolean_query('(Python AND (SQL)', 1000)
    assert ok_bad_parens is False
    ok_bad_quotes, _, _ = validate_boolean_query('"Python AND SQL', 1000)
    assert ok_bad_quotes is False
    ok_bad_ops, _, _ = validate_boolean_query('Python AND OR SQL', 1000)
    assert ok_bad_ops is False


def test_boolean_customize_endpoint_on_real_job():
    """Verify /api/jobs/{id}/boolean-queries/customize returns valid queries and interpreted_suggestions."""
    client = TestClient(app)
    with patch("app.ai.providers.chat_provider.chat_provider.is_available", return_value=False):
        resp = client.post(
            "/api/jobs/44/boolean-queries/customize",
            json={
                "instruction": "Focus on manufacturing companies and avoid freshers",
                "search_mode": "balanced",
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["naukri"]["is_valid"] is True
    assert data["linkedin"]["is_valid"] is True
    assert data["google_xray"]["is_valid"] is True
    assert "interpreted_suggestions" in data


@pytest.mark.parametrize(
    "instruction,expected_loc,expected_skill",
    [
        ("Find procurement candidates with SAP MM experience in Bangalore.", "Bangalore", "SAP MM"),
        ("In Pune, look for people with AutoCAD and Revit skills, avoid freshers.", "Pune", "AutoCAD"),
        ("Avoid freshers and focus on Bangalore with SAP MM experience.", "Bangalore", "SAP MM"),
        ("Focus on Hyderabad with 5+ years experience in Power BI and SQL.", "Hyderabad", "Power BI"),
    ],
)
def test_location_and_skill_separation_across_word_orders(instruction, expected_loc, expected_skill):
    """Deterministic fallback must separate location from skills regardless of word order."""
    with patch("app.ai.providers.chat_provider.chat_provider.is_available", return_value=False):
        res = customize_boolean_query_conversationally(
            title="Procurement Analyst",
            instruction=instruction,
            mandatory_skills=["Vendor Management"],
            preferred_skills=[],
            location="Mumbai",
        )
    sugg = res["interpreted_suggestions"]
    assert sugg["location_preference"] == expected_loc
    all_skills = sugg["mandatory_skills"] + sugg["related_skills"]
    # Never include compound "City with Skill" phrases in skills.
    assert not any(expected_loc.lower() in s.lower() for s in all_skills)
    assert any(expected_skill.lower() in s.lower() for s in all_skills)


def test_cross_platform_consistency_and_invalid_ai_output_safety():
    """Naukri, LinkedIn, and Google X-Ray reflect the same profile, and malformed AI output is handled safely."""
    with patch("app.ai.providers.chat_provider.chat_provider.is_available", return_value=False):
        res = customize_boolean_query_conversationally(
            title="Procurement Analyst",
            instruction="Include manufacturing and IT services companies. Avoid freshers. Focus on Bangalore with SAP MM.",
            mandatory_skills=["SAP MM", "Vendor Management"],
            preferred_skills=["Coupa"],
            location="Pune",
        )
    for key in ("naukri", "linkedin", "google_xray"):
        q = res[key]["query"]
        assert "SAP MM" in q
        assert "Manufacturing" in q
        assert res[key]["is_valid"] is True
    assert "Fresher" in res["naukri"]["query"]
    assert "Fresher" in res["linkedin"]["query"]
    assert "Bangalore" in res["google_xray"]["query"]

    # Malformed AI output (string instead of list) must not crash.
    malformed_ai = {
        "target_titles": "Procurement Specialist, Buyer",
        "required_skills": "SAP MM",
        "industries": "Manufacturing",
        "location_preference": ["Bangalore"],
        "exclusions": "Intern, Fresher",
        "search_mode": "balanced",
        "explanation": "Coerced string fields safely.",
    }
    with (
        patch("app.ai.providers.chat_provider.chat_provider.is_available", return_value=True),
        patch("app.ai.providers.chat_provider.chat_provider.extract_json", return_value=malformed_ai),
    ):
        safe_res = customize_boolean_query_conversationally(
            title="Procurement Analyst",
            instruction="Focus on manufacturing",
            mandatory_skills=["SAP MM"],
        )
    assert safe_res["naukri"]["is_valid"] is True
    assert "Manufacturing" in safe_res["naukri"]["query"]
    assert safe_res["interpreted_suggestions"]["location_preference"] == "Bangalore"
    assert "['Bangalore']" not in safe_res["google_xray"]["query"]
