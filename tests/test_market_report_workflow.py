"""Acceptance tests for the Recruiter-Friendly Market Intelligence & Target Company Report.

Tests the end-to-end LangGraph workflow, provenance rules, PDF/Word export,
and FastAPI endpoints across the 5 domain requisitions:
- 37: Finance
- 40: CAD / BIM
- 42: Art Director / Advertising
- 43: Workforce Management (WFM)
- 44: Procurement
Also verifies existing Target Companies PDF/Word exports remain intact.
"""

from __future__ import annotations

import io
from unittest.mock import patch

import fitz
import pytest
from docx import Document
from fastapi.testclient import TestClient

from app.agent.workflows.market_report_graph import _REPORT_CACHE, run_market_report_graph
from app.main import app
from app.services.market_report_export_service import (
    generate_market_report_pdf,
    generate_market_report_word,
)
from app.services.market_research_service import _RESEARCH_CACHE, collect_market_intelligence


@pytest.fixture(autouse=True)
def _clean_caches():
    _REPORT_CACHE.clear()
    _RESEARCH_CACHE.clear()
    yield
    _REPORT_CACHE.clear()
    _RESEARCH_CACHE.clear()


def _mock_market_research(*args, **kwargs):
    """Return deterministic, provenance-tagged public market data for fast offline tests."""
    job_title = kwargs.get("job_title") or "Specialist"
    location = kwargs.get("location") or "Bengaluru"
    return {
        "researched_at": "2026-11-26T08:00:00+00:00",
        "researched_date": "2026-11-26",
        "sources_checked": ["Arbeitnow Public Job Board", "Remotive Public Job Board", "Google News RSS (Hiring)"],
        "failed_sources": [],
        "research_complete": True,
        "company_hiring_activity": [
            {
                "company_name": "Acme Global Services",
                "job_title": f"Senior {job_title}",
                "location": location,
                "experience_requirement": "4-7 years",
                "posted_date": "2026-11-20",
                "source_name": "Arbeitnow Public Job Board",
                "source_url": "https://www.arbeitnow.com/jobs/example-role",
                "accessed_date": "2026-11-26",
                "evidence_type": "Verified information",
                "vacancy_status": "Advertised / previously observed vacancy",
                "skills_mentioned": ["SQL", "Stakeholder Management", "Excel"],
                "salary_snippet": None,
                "snippet": f"Hiring {job_title} in {location}.",
            },
            {
                "company_name": "Summit Operations Pvt Ltd",
                "job_title": job_title,
                "location": "Remote",
                "experience_requirement": "3-5 years",
                "posted_date": "2026-11-22",
                "source_name": "Remotive Public Job Board",
                "source_url": "https://remotive.com/remote-jobs/example-role-2",
                "accessed_date": "2026-11-26",
                "evidence_type": "Verified information",
                "vacancy_status": "Advertised / previously observed vacancy",
                "skills_mentioned": ["SQL", "Reporting"],
                "salary_snippet": None,
                "snippet": f"Remote {job_title} role.",
            },
        ],
        "hiring_news": [],
        "market_news": [],
        "skill_analysis": {
            "sample_size": 2,
            "jd_skills_observed_in_market": [],
            "additional_market_skills": [{"skill": "SQL", "mentions": 2}],
            "emerging_or_single_mention_skills": [{"skill": "Reporting", "mentions": 1}],
            "sample_limitation_note": "Based on 2 reviewed public job postings. Small sample size: treat single-posting skills cautiously.",
        },
        "location_intelligence": {
            "requested_location": location,
            "observed_hiring_locations": [
                {"location": location, "postings_count": 1},
                {"location": "Remote", "postings_count": 1},
            ],
            "remote_mentions_count": 1,
            "total_postings_reviewed": 2,
        },
        "salary_intelligence": {
            "available": False,
            "entries": [],
            "note": "Market information not available for this section.",
        },
        "source_references": [
            {
                "title": f"Senior {job_title}",
                "source_name": "Arbeitnow Public Job Board",
                "source_url": "https://www.arbeitnow.com/jobs/example-role",
                "published_date": "2026-11-20",
                "accessed_date": "2026-11-26",
                "evidence_type": "Verified information",
            },
            {
                "title": job_title,
                "source_name": "Remotive Public Job Board",
                "source_url": "https://remotive.com/remote-jobs/example-role-2",
                "published_date": "2026-11-22",
                "accessed_date": "2026-11-26",
                "evidence_type": "Verified information",
            },
        ],
    }


@pytest.mark.parametrize("job_id", [37, 40, 42, 43, 44])
def test_market_report_workflow_across_five_domains(job_id: int):
    """Verify report generation, provenance, Boolean reuse, and PDF/Word output for all 5 domain requisitions."""
    with patch("app.agent.workflows.market_report_graph.collect_market_intelligence", side_effect=_mock_market_research):
        report = run_market_report_graph(job_id=job_id, allow_llm=False)

    assert "error" not in report, f"Job {job_id} returned error: {report.get('error')}"
    assert report["report_metadata"]["job_id"] == job_id
    assert report["report_metadata"]["requisition_id"] == f"REQ-{job_id:04d}"
    assert len(report["section_c_target_companies"]["companies"]) >= 1
    assert report["section_d_market_intelligence"]["salary_and_compensation"]["note"] == "Market information not available for this section."
    assert report["recruiter_search_suggestions"]["naukri"]["query"]
    assert report["recruiter_search_suggestions"]["linkedin"]["query"]
    assert report["suggested_job_titles"]["direct_titles"]
    assert len(report["source_references"]) == 2

    pdf_bytes = generate_market_report_pdf(report)
    assert pdf_bytes.startswith(b"%PDF-")
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    assert len(doc) >= 1
    assert "Page 1 of" in doc[0].get_text()
    doc.close()

    word_bytes = generate_market_report_word(report)
    assert word_bytes.startswith(b"PK")
    word_doc = Document(io.BytesIO(word_bytes))
    full_text = "\n".join(p.text for p in word_doc.paragraphs)
    assert "Section A" in full_text
    assert "Section D" in full_text


def test_market_research_graceful_degradation_on_http_error():
    """Verify partial/failed external research never crashes and records failed sources."""
    with patch("app.services.market_research_service.httpx.Client.get", side_effect=RuntimeError("network down")):
        res = collect_market_intelligence(
            job_id=9999,
            job_title="Procurement Manager",
            location="Bengaluru",
            jd_text="Strategic sourcing and vendor management",
            mandatory_skills=["Strategic Sourcing"],
            preferred_skills=[],
            force_refresh=True,
        )
    assert res["research_complete"] is False
    assert len(res["failed_sources"]) == 4
    assert res["salary_intelligence"]["available"] is False
    assert res["salary_intelligence"]["note"] == "Market information not available for this section."


def test_market_report_endpoints_and_existing_exports_intact():
    """Verify new market-report endpoints and confirm existing target-companies exports still work."""
    job_id = 43
    client = TestClient(app)
    with patch("app.agent.workflows.market_report_graph.collect_market_intelligence", side_effect=_mock_market_research):
        resp_json = client.post(f"/api/jobs/{job_id}/market-report", json={"allow_llm": False})
        assert resp_json.status_code == 200
        assert resp_json.json()["report_metadata"]["job_id"] == job_id

        resp_pdf = client.get(f"/api/jobs/{job_id}/market-report/pdf")
        assert resp_pdf.status_code == 200
        assert resp_pdf.headers["content-type"] == "application/pdf"
        assert resp_pdf.content.startswith(b"%PDF-")

        resp_word = client.get(f"/api/jobs/{job_id}/market-report/word")
        assert resp_word.status_code == 200
        assert resp_word.content.startswith(b"PK")

    # Existing Target Companies PDF and Word exports must continue working unchanged.
    old_pdf = client.get(f"/api/jobs/{job_id}/target-companies/pdf")
    assert old_pdf.status_code == 200
    assert old_pdf.content.startswith(b"%PDF-")

    old_word = client.get(f"/api/jobs/{job_id}/target-companies/word")
    assert old_word.status_code == 200
    assert old_word.content.startswith(b"PK")
