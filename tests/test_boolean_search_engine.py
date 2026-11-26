import pytest
from database.sqlite_connection import SessionLocal
from database.models import Job
from app.routers.jobs import get_job_boolean_queries, BooleanQueryRequestSchema
from app.services.skill_taxonomy_service import extract_skills_from_jd, detect_jd_domain, DOMAIN_TAXONOMY
from app.services.boolean_query_service import generate_boolean_queries


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


def test_cad_job_39_boolean_engine(db):
    """Verify Job 39 (CAD Entry Ops) generates dynamic, domain-aware queries without falling back to Excel alone."""
    job = db.query(Job).filter(Job.id == 39).first()
    assert job is not None
    assert "cad" in job.title.lower()

    # Test balanced mode
    payload = BooleanQueryRequestSchema(search_mode="balanced")
    res = get_job_boolean_queries("39", payload=payload, db=db)

    # 1. Platform coverage
    assert "naukri" in res
    assert "linkedin" in res
    assert "google_xray" in res
    assert "simple_keywords" in res
    assert "adjacent_skills" in res
    assert "term_explanations" in res

    # 2. Query content must reflect CAD and NOT be ("CAD Entry Ops") AND (Excel)
    naukri_q = res["naukri"]["query"]
    assert "CAD Entry Ops" in naukri_q
    assert ("CAD" in naukri_q or "Revit" in naukri_q or "MicroStation" in naukri_q)
    assert naukri_q != '("CAD Entry Ops") AND (Excel)'

    # 3. Adjacent skills must exist and belong to CAD domain
    adjacent = res["adjacent_skills"]
    assert len(adjacent) > 0
    adj_names = [a["skill"] for a in adjacent]
    assert any(tool in adj_names for tool in ["AutoCAD", "SolidWorks", "CATIA", "2D Drafting", "BIM 360", "MicroStation"])

    # Provenance tags and recruiter notes
    for adj in adjacent:
        assert "skill" in adj
        assert "category" in adj
        assert "relationship_type" in adj
        assert "note" in adj
        assert adj["relationship_type"] in {"explicit_jd", "alias_equivalent", "related_adjacent"}

    # 4. Term explanations present
    assert len(res["term_explanations"]) > 0


def test_boolean_modes_behavior():
    """Verify Broad, Balanced, and Strict modes adjust query structure properly."""
    res_bal = generate_boolean_queries(
        title="CAD Entry Ops",
        mandatory_skills=["CAD", "AutoCAD", "MicroStation"],
        search_mode="balanced",
    )
    res_strict = generate_boolean_queries(
        title="CAD Entry Ops",
        mandatory_skills=["CAD", "AutoCAD", "MicroStation"],
        search_mode="strict",
    )
    res_broad = generate_boolean_queries(
        title="CAD Entry Ops",
        mandatory_skills=["CAD", "AutoCAD", "MicroStation"],
        search_mode="broad",
    )

    # Balanced mode groups tool alternatives with OR in cluster
    assert " OR " in res_bal.naukri.query
    assert " AND " in res_bal.naukri.query

    # Strict mode joins mandatory skills with AND
    assert res_strict.naukri.query.count(" AND ") >= 2

    # Broad mode uses OR across terms
    assert " OR " in res_broad.naukri.query


def test_cross_domain_isolation(db):
    """Verify all 7 domains have proper skill extraction and strict domain isolation."""
    domain_test_cases = [
        {"job_id": 39, "domain": "cad_engineering", "forbidden": ["UVM", "Verilog", "TDS", "GST", "ServiceNow"]},
        {"job_id": 37, "domain": "finance_accounting", "forbidden": ["AutoCAD", "SolidWorks", "UVM", "Kubernetes"]},
        {"job_id": 35, "domain": "semiconductor_vlsi", "forbidden": ["General Ledger", "AutoCAD", "Revit", "TDS"]},
        {"job_id": 34, "domain": "cloud_infrastructure", "forbidden": ["Reconciliation", "AutoCAD", "VHDL", "Verilog"]},
        {"job_id": 36, "domain": "servicenow_itsm", "forbidden": ["AutoCAD", "MicroStation", "Tax Audit", "Verilog"]},
        {"job_id": 5, "domain": "software_engineering", "forbidden": ["MicroStation", "TDS", "DO-254", "CATIA"]},
        {"job_id": 4, "domain": "sap_erp", "forbidden": ["AutoCAD", "Revit", "Verilog", "SVA"]},
    ]

    for case in domain_test_cases:
        job = db.query(Job).filter(Job.id == case["job_id"]).first()
        if not job:
            continue
        payload = BooleanQueryRequestSchema(search_mode="balanced")
        res = get_job_boolean_queries(str(job.id), payload=payload, db=db)

        # Check detected domain matches expectation
        assert res.get("domain") == case["domain"]

        # Check that none of the forbidden cross-domain skills leaked into the query or adjacent skills
        query_text = (res["naukri"]["query"] + " " + res["linkedin"]["query"]).lower()
        adj_text = " ".join([a["skill"] for a in res.get("adjacent_skills", [])]).lower()

        for forbidden_term in case["forbidden"]:
            assert forbidden_term.lower() not in query_text, f"{forbidden_term} leaked into query for job {job.id}"
            assert forbidden_term.lower() not in adj_text, f"{forbidden_term} leaked into adjacent skills for job {job.id}"
