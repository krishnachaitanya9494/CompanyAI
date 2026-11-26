"""Regression tests for the LangGraph Target Company Sourcing workflow and API endpoints."""

from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.agent.workflows.checkpoint import get_sqlite_checkpointer
from app.agent.workflows.target_company_graph import run_target_company_graph

client = TestClient(app)


def test_five_requisitions_ecosystems_and_tiers():
    """Verify all 5 validation requisitions map to the right ecosystem and valid tiers."""
    expected = {
        37: ("Finance", "Deloitte India (Tax & Assurance)"),
        40: ("CAD, BIM", "Autodesk India"),
        42: ("Advertising", "Ogilvy (WPP)"),
        43: ("Workforce Management", "NICE India"),
        44: ("Procurement", "GEP Worldwide"),
    }
    for job_id, (eco_substr, expected_co) in expected.items():
        res = run_target_company_graph(job_id=job_id, allow_llm=False)
        assert "error" not in res, f"Job {job_id} returned error: {res.get('error')}"
        assert res["job_id"] == job_id
        assert eco_substr.lower() in res["ecosystem_name"].lower(), (
            f"Job {job_id} got unexpected ecosystem: {res['ecosystem_name']}"
        )
        names = [c["name"] for c in res["companies"]]
        assert expected_co in names, f"Job {job_id} missing {expected_co} in {names}"
        assert len(names) == len(set(n.lower() for n in names)), "Duplicate companies found"
        tiers = {c["tier_level"] for c in res["companies"]}
        assert tiers.issubset({"Tier 1", "Tier 2", "Tier 3"})
        meta = res["intelligence_metadata"]
        assert meta["workflow_engine"] == "langgraph"
        assert meta["validation_passed"] is True
        assert meta["thread_id"] == f"target-company-job-{job_id}"


def test_procurement_excludes_generic_it_fallback():
    """Job #44 (Procurement Analyst) must not fall back to generic IT companies."""
    res = run_target_company_graph(job_id=44)
    names = {c["name"] for c in res["companies"]}
    assert "Microsoft IDC" not in names
    assert "Google India" not in names
    assert "GEP Worldwide" in names
    assert "Zycus" in names


def test_ollama_unavailable_graceful_fallback():
    """When local Ollama is unavailable, deterministic sourcing still succeeds cleanly."""
    with patch("app.agent.workflows.target_company_graph.chat_provider.is_available", return_value=False):
        res = run_target_company_graph(job_id=44, use_cache=False)
    assert "error" not in res
    assert res["total_companies_count"] >= 10
    assert res["intelligence_metadata"]["ollama_used"] is False
    assert res["intelligence_metadata"]["ollama_status"] == "unavailable"


def test_novel_jd_dynamic_ecosystem_generation():
    """Novel JD domains not in static catalog use Ollama dynamically instead of generic IT fallback."""
    from app.agent.workflows.target_company_graph import retrieve_company_catalog_node

    fake_ai = {
        "ecosystem_name": "Clinical Trials & Pharma Regulatory Ecosystem",
        "companies": [
            {"name": "IQVIA India", "category": "gsi", "tier_level": "Tier 1", "location": "Bangalore", "description": "CRO", "domain_specialties": ["Clinical Trials"]},
            {"name": "Syneos Health", "category": "gsi", "tier_level": "Tier 1", "location": "Hyderabad", "description": "CRO", "domain_specialties": ["Pharmacovigilance"]},
            {"name": "Parexel India", "category": "gsi", "tier_level": "Tier 2", "location": "Bangalore", "description": "CRO", "domain_specialties": ["Regulatory Affairs"]},
            {"name": "Biocon", "category": "oem", "tier_level": "Tier 1", "location": "Bangalore", "description": "Biopharma", "domain_specialties": ["GMP"]},
        ],
    }
    state = {
        "job_title": "Clinical Research Associate",
        "job_description": "Manage Phase III clinical trials and pharmacovigilance.",
        "location": "Bangalore",
        "extracted_requirements": {"all_jd_skills": ["Clinical Trials", "GCP"]},
        "selected_ecosystem": {"id": "general_enterprise", "name": "Fallback", "is_uncertain_fallback": True},
        "allow_llm": True,
    }
    with patch("app.agent.workflows.target_company_graph.chat_provider.is_available", return_value=True), \
         patch("app.agent.workflows.target_company_graph._extract_json_bounded", return_value=fake_ai):
        out = retrieve_company_catalog_node(state)
    names = [c["name"] for c in out["company_candidates"]]
    assert "IQVIA India" in names
    assert "Microsoft IDC" not in names
    assert out["selected_ecosystem"]["name"] == "Clinical Trials & Pharma Regulatory Ecosystem"


def test_checkpoint_persistence_and_invalid_job_isolation():
    """Verify SQLite checkpoint persistence per requisition thread and clean error on invalid ID."""
    run_target_company_graph(job_id=44, use_checkpointer=True)
    saver = get_sqlite_checkpointer()
    saved = saver.get({"configurable": {"thread_id": "target-company-job-44"}})
    assert saved is not None

    bad = run_target_company_graph(job_id=999999, use_checkpointer=True)
    assert "error" in bad


def test_target_companies_api_and_exports():
    """Verify GET, POST, CSV, and Excel endpoints preserve contracts."""
    r_get = client.get("/api/jobs/44/target-companies")
    assert r_get.status_code == 200
    data = r_get.json()
    assert data["job_id"] == 44
    assert "Procurement" in data["ecosystem_name"]

    r_post = client.post(
        "/api/jobs/44/target-companies",
        json={
            "selected_strategy": "Direct Industry Experience",
            "custom_companies": [{"name": "Custom Procurement Corp", "category": "oem", "location": "Bengaluru"}],
            "excluded_companies": ["Zycus"],
            "off_limits_companies": [],
        },
    )
    assert r_post.status_code == 200
    post_data = r_post.json()
    assert any(c["name"] == "Custom Procurement Corp" and c["is_targeted"] for c in post_data["companies"])
    assert any(c["name"] == "Zycus" and c["is_excluded"] for c in post_data["companies"])

    r_csv = client.get("/api/jobs/44/target-companies/csv")
    assert r_csv.status_code == 200
    assert "text/csv" in r_csv.headers["content-type"]

    r_xlsx = client.get("/api/jobs/44/target-companies/excel")
    assert r_xlsx.status_code == 200
    assert "ms-excel" in r_xlsx.headers["content-type"]

    r_pdf = client.get("/api/jobs/44/target-companies/pdf")
    assert r_pdf.status_code == 200
    assert "application/pdf" in r_pdf.headers["content-type"]
    assert r_pdf.content.startswith(b"%PDF")

    r_word = client.get("/api/jobs/44/target-companies/word")
    assert r_word.status_code == 200
    assert "wordprocessingml" in r_word.headers["content-type"]
    assert r_word.content.startswith(b"PK")
