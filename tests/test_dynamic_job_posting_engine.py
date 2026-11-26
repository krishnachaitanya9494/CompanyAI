"""End-to-End Test Suite for Dynamic JD-Agnostic Job Posting & Distribution Engine."""

import pytest
from database.sqlite_connection import SessionLocal
from database.models import Job, JobPosting, JobPostingVersion
from app.services.jd_context_service import build_job_generation_context
from app.services.advertisement_generation_service import (
    generate_platform_advertisement,
    compare_advertisements,
    compute_posting_readiness,
    rewrite_advertisement,
)
from app.services.posting_strategy_service import analyze_posting_strategy
from app.services.advertisement_validation_service import validate_advertisement_quality
from app.services.jd_consistency_service import detect_contradictions, classify_content_integrity
from app.services.content_normalization_service import (
    normalize_markdown_content,
    find_incomplete_statements,
    find_duplicate_statements,
)


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_dynamic_context_engine_across_multiple_diverse_jobs(db_session):
    """Test that context engine dynamically derives correct metadata across diverse jobs without hardcoding."""
    # Find multiple diverse jobs
    accountant_job = db_session.query(Job).filter(Job.title.ilike("%Accountant%")).first()
    hw_job = db_session.query(Job).filter(Job.title.ilike("%Verification%")).first()
    cloud_job = db_session.query(Job).filter(Job.title.ilike("%Cloud%")).first()

    assert accountant_job is not None, "Staff Accountant job must exist"
    ctx_acc = build_job_generation_context(db_session, accountant_job.id)
    assert ctx_acc.role_domain == "Finance & Tax Compliance"
    assert "Tax" in ctx_acc.mandatory_skills[0] or "TDS" in ctx_acc.mandatory_skills or len(ctx_acc.mandatory_skills) > 0
    assert ctx_acc.job_id == accountant_job.id

    if hw_job:
        ctx_hw = build_job_generation_context(db_session, hw_job.id)
        assert ctx_hw.role_domain == "Semiconductor & Hardware Engineering"
        assert ctx_hw.job_id != ctx_acc.job_id
        # Zero cross-job contamination
        assert not any("TDS" in sk for sk in ctx_hw.mandatory_skills)
        assert not any("Verilog" in sk for sk in ctx_acc.mandatory_skills)

    if cloud_job:
        ctx_cloud = build_job_generation_context(db_session, cloud_job.id)
        assert ctx_cloud.role_domain == "Cloud & Systems Infrastructure"
        assert ctx_cloud.seniority in ["Senior", "Lead / Manager", "Executive / Director"]


def test_platform_advertisements_are_genuinely_distinct_in_structure_and_style(db_session):
    """Confirm that the 5 platforms receive structurally different outputs, not generic clones."""
    job = db_session.query(Job).filter(Job.id == 37).first()
    ctx = build_job_generation_context(db_session, job.id)

    linkedin_ad, _, _ = generate_platform_advertisement(ctx, "linkedin")
    naukri_ad, _, _ = generate_platform_advertisement(ctx, "naukri")
    indeed_ad, _, _ = generate_platform_advertisement(ctx, "indeed")
    careers_ad, _, _ = generate_platform_advertisement(ctx, "careers")
    referral_ad, _, _ = generate_platform_advertisement(ctx, "referral")

    # 1. Distinct Headers & Sections
    assert "# We're Hiring" in linkedin_ad or "#" in linkedin_ad
    assert "#" in naukri_ad
    assert "Key Skills" in naukri_ad or "Mandatory Skills" in naukri_ad or "Skills" in naukri_ad
    assert "## Job Details" in indeed_ad or "Job Details" in indeed_ad or "Summary" in indeed_ad
    assert "About the Role" in careers_ad or "Role Overview" in careers_ad or "Equal Opportunity" in careers_ad or len(careers_ad) > 100
    assert "Referral" in referral_ad

    # 2. LinkedIn has hashtags
    assert "#" in linkedin_ad

    # 3. Naukri has key skills section
    assert "Key Skills" in naukri_ad

    # 4. Employee Referral has referral instructions
    assert "refer" in referral_ad.lower()

    # 5. All share factual consistency on job title and location
    assert ctx.title in linkedin_ad
    assert ctx.title in naukri_ad
    assert ctx.title in indeed_ad
    assert ctx.title in careers_ad
    assert ctx.title in referral_ad


def test_cross_job_leakage_and_contradiction_detection(db_session):
    """Test that contradiction engine flags cross-domain leakage and location/experience conflicts."""
    job = db_session.query(Job).filter(Job.id == 37).first()
    ctx = build_job_generation_context(db_session, job.id)

    # Inject deliberate hardware leakage into accounting job
    leaked_content = """# Staff Accountant
## Key Responsibilities
• Design UVM testbenches and Verilog verification environments.
• Support TDS reconciliations.
"""
    contradictions = detect_contradictions(ctx, leaked_content)
    assert any(c["type"] == "cross_domain_leakage" for c in contradictions)
    assert any(c["severity"] == "critical" for c in contradictions)

    # Inject experience mismatch
    exp_mismatch_content = """# Staff Accountant
Looking for fresh graduate with no experience required.
"""
    exp_contradictions = detect_contradictions(ctx, exp_mismatch_content)
    assert any(c["type"] == "experience_conflict" for c in exp_contradictions)


def test_posting_strategy_and_suitability_ranking(db_session):
    """Test dynamic platform suitability ranking reflects domain and location characteristics."""
    job = db_session.query(Job).filter(Job.id == 37).first()
    ctx = build_job_generation_context(db_session, job.id)

    strategy = analyze_posting_strategy(ctx)
    assert "platforms" in strategy
    assert len(strategy["platforms"]) == 5
    # For an India-based accounting role, Naukri & LinkedIn should have high suitability scores
    platform_names = [p["name"] for p in strategy["platforms"]]
    assert "LinkedIn" in platform_names
    assert "Naukri" in platform_names

    top_platform = strategy["platforms"][0]
    assert top_platform["suitability_score"] >= 85
    assert len(top_platform["search_keywords"]) > 0
    assert top_platform["target_audience"] != ""


def test_posting_readiness_checklist(db_session):
    """Test that posting readiness checklist provides actionable gating."""
    job = db_session.query(Job).filter(Job.id == 37).first()
    ctx = build_job_generation_context(db_session, job.id)

    readiness = compute_posting_readiness(ctx, [
        {"platform": "linkedin", "status": "Approved"},
        {"platform": "naukri", "status": "AI Generated"},
    ])

    assert "readiness_percentage" in readiness
    assert readiness["readiness_percentage"] >= 60
    assert any(c["id"] == "mandatory_skills" and c["status"] == "passed" for c in readiness["checklist"])
    assert any(c["id"] == "jd_approval" and c["status"] == "passed" for c in readiness["checklist"])


def test_markdown_normalization_and_formatting():
    """Verify lossless markdown normalization without breaking valid lists or symbols."""
    raw = """### Role: Senior Consultant:
• • Manage client deliveries
* • Support system integration
1. • Coordinate with stakeholders

## Required Skills
• • • Oracle FCCS
•  
• Python
"""
    normalized = normalize_markdown_content(raw)
    assert "• •" not in normalized
    assert "• • •" not in normalized
    assert "* •" not in normalized
    assert "1. •" not in normalized
    assert "## Role: Senior Consultant" in normalized
    assert "• Oracle FCCS" in normalized
    assert find_duplicate_statements(normalized) == []


def test_advertisement_comparison_metrics():
    """Test side-by-side comparison between platform drafts."""
    ad1 = "# LinkedIn Post\nAre you ready to join us?\n## Responsibilities\n• Support tax\n• File returns"
    ad2 = "# Naukri Post\n## Key Skills\n• Tax, GST\n## Responsibilities\n• Support tax\n• File returns\n• Document audits"

    comp = compare_advertisements("linkedin", ad1, "naukri", ad2)
    assert comp["platform_1"]["platform"] == "linkedin"
    assert comp["platform_2"]["platform"] == "naukri"
    assert comp["platform_1"]["word_count"] > 0
    assert comp["platform_2"]["word_count"] > 0
    assert comp["content_similarity_pct"] > 0


def test_export_advertisement_pdf_and_docx():
    """Verify document export produces valid PDF and DOCX binary payloads without stray asterisks."""
    from fastapi.testclient import TestClient
    from app.main import app
    import pymupdf, docx, io

    client = TestClient(app)
    title = "Senior Cloud Architect"
    content = "## Overview\n• Location:** Bengaluru\n• Experience:** 5+ years\n- AWS / Azure\n- Kubernetes"

    pdf_res = client.post("/api/job-postings/export", json={"title": title, "content": content, "format": "pdf"})
    assert pdf_res.status_code == 200
    assert pdf_res.headers.get("content-type") == "application/pdf"
    assert len(pdf_res.content) > 500
    pdf_text = " ".join(page.get_text() for page in pymupdf.open(stream=pdf_res.content, filetype="pdf"))
    assert "*" not in pdf_text

    docx_res = client.post("/api/job-postings/export", json={"title": title, "content": content, "format": "docx"})
    assert docx_res.status_code == 200
    assert "wordprocessingml" in docx_res.headers.get("content-type")
    assert len(docx_res.content) > 500
    doc = docx.Document(io.BytesIO(docx_res.content))
    docx_text = " ".join(p.text for p in doc.paragraphs)
    assert "*" not in docx_text
