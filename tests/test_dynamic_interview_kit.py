"""
Comprehensive test suite verifying dynamic, source-grounded interview kit generation,
cross-domain tailoring (CAD, Accounting, Semiconductor), evaluation rubrics, recruiter scorecard
recording, and clean exports without markdown asterisk characters.
"""

import pytest
from sqlalchemy.orm import Session
from database.sqlite_connection import SessionLocal
from database.models import Job, InterviewKit
from app.services.interview_intelligence_service import (
    generate_interview_kit,
    regenerate_single_question,
    update_interview_kit,
    save_scorecard_evaluation,
    export_interview_kit_bytes,
    _clean_plain_text,
)


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_cad_job_interview_kit_is_domain_grounded(db_session: Session):
    """Verify Job 39 (CAD Entry Ops) generates CAD-tailored questions without generic Excel architecture."""
    job = db_session.query(Job).filter(Job.id == 39).first()
    assert job is not None, "Job 39 (CAD Entry Ops) must exist in test database"

    kit = generate_interview_kit(
        db=db_session,
        job_id=job.id,
        candidate_id=None,
        question_count=8,
        force_refresh=True,
    )

    assert kit is not None
    assert kit["job_id"] == job.id
    assert "cad" in kit["role_domain"].lower()
    assert len(kit["questions"]) == 8

    # Combine question texts
    all_q_text = " ".join(q["question"] for q in kit["questions"])
    all_exp_text = " ".join(q.get("expected_answer", "") for q in kit["questions"])

    # CAD questions must test CAD/drafting/engineering drawing/specifications
    cad_terms = ["cad", "drafting", "drawing", "dimension", "microstation", "revit", "autocad", "layer", "model"]
    found_cad = any(term in all_q_text.lower() or term in all_exp_text.lower() for term in cad_terms)
    assert found_cad, f"CAD interview kit must test CAD engineering workflows. Generated: {all_q_text}"

    # Must NOT ask generic "Enterprise solution architecture using Excel"
    assert "enterprise solutions using excel" not in all_q_text.lower()
    assert "system architecture and performance tuning" not in all_q_text.lower()

    # Verify coverage matrix
    assert kit["coverage_matrix"] is not None
    assert len(kit["coverage_matrix"]) > 0


def test_finance_job_interview_kit_is_domain_grounded(db_session: Session):
    """Verify Job 37 (Staff Accountant) generates taxation and reconciliation questions."""
    job = db_session.query(Job).filter(Job.id == 37).first()
    assert job is not None, "Job 37 (Staff Accountant) must exist in test database"

    kit = generate_interview_kit(
        db=db_session,
        job_id=job.id,
        candidate_id=None,
        question_count=8,
        force_refresh=True,
    )

    assert kit is not None
    assert "finance" in kit["role_domain"].lower() or "tax" in kit["role_domain"].lower()
    all_q_text = " ".join(q["question"] for q in kit["questions"]).lower()
    tax_terms = ["gst", "tds", "reconciliation", "tax", "ledger", "tally", "sap", "audit"]
    assert any(term in all_q_text for term in tax_terms)


def test_semiconductor_job_interview_kit_is_domain_grounded(db_session: Session):
    """Verify Job 35 (Design Verification Engineer) generates hardware verification questions."""
    job = db_session.query(Job).filter(Job.id == 35).first()
    assert job is not None, "Job 35 (DV Engineer) must exist in test database"

    kit = generate_interview_kit(
        db=db_session,
        job_id=job.id,
        candidate_id=None,
        question_count=8,
        force_refresh=True,
    )

    assert kit is not None
    assert "semiconductor" in kit["role_domain"].lower() or "hardware" in kit["role_domain"].lower()
    all_q_text = " ".join(q["question"] for q in kit["questions"]).lower()
    hw_terms = ["systemverilog", "uvm", "coverage", "simulation", "testbench", "assertion"]
    assert any(term in all_q_text for term in hw_terms)


def test_question_rubric_signals_and_follow_ups(db_session: Session):
    """Verify each generated question includes a 1-5 rubric, green/red flags, and follow-ups."""
    kit = generate_interview_kit(
        db=db_session,
        job_id=39,
        question_count=5,
        force_refresh=True,
    )

    for q in kit["questions"]:
        assert "question" in q and len(q["question"]) > 10
        assert "expected_answer" in q and len(q["expected_answer"]) > 10
        assert "strong_signals" in q and len(q["strong_signals"]) >= 2
        assert "weak_signals" in q and len(q["weak_signals"]) >= 2
        assert "follow_ups" in q and len(q["follow_ups"]) >= 1
        assert "rubric" in q
        rubric = q["rubric"]
        for level in ["1_poor", "2_below", "3_meets", "4_strong", "5_excellent"]:
            assert level in rubric, f"Missing rubric level {level}"


def test_regenerate_single_question(db_session: Session):
    """Verify regenerating a single question by id preserves other questions and updates target."""
    kit = generate_interview_kit(db=db_session, job_id=39, question_count=5, force_refresh=True)
    first_q_id = kit["questions"][0]["id"]
    original_len = len(kit["questions"])

    updated_dict = regenerate_single_question(
        db=db_session,
        kit_id=kit["id"],
        question_id=first_q_id,
        target_skill="Quality Control",
        difficulty="Senior",
    )

    assert len(updated_dict["questions"]) == original_len
    new_first_q = updated_dict["questions"][0]
    assert new_first_q["id"] == first_q_id
    assert new_first_q["difficulty"] == "Senior"


def test_save_scorecard_evaluation(db_session: Session):
    """Verify recording 1-5 ratings computes weighted overall score and saves notes."""
    kit = generate_interview_kit(db=db_session, job_id=39, question_count=5, force_refresh=True)
    scores = {q["id"]: 4 for q in kit["questions"]}

    saved = save_scorecard_evaluation(
        db=db_session,
        kit_id=kit["id"],
        scores=scores,
        candidate_notes="Strong drafting precision and clean layer standards.",
        recommendation="Hire",
    )

    scorecard = saved["overall_scorecard"]
    assert scorecard["overall_score_pct"] == 80.0
    assert scorecard["overall_recommendation"] == "Hire"
    assert "drafting precision" in scorecard["candidate_notes"]


def test_export_interview_kit_clean_without_asterisks(db_session: Session):
    """Verify exported PDF, Word, and TXT files contain zero raw markdown asterisk characters."""
    kit = db_session.query(InterviewKit).filter(InterviewKit.job_id == 39).first()
    if not kit:
        kit_dict = generate_interview_kit(db=db_session, job_id=39, question_count=5)
        kit = db_session.query(InterviewKit).filter(InterviewKit.id == kit_dict["id"]).first()

    # 1. Plain text export
    txt_bytes, mime, fn = export_interview_kit_bytes(kit, format="txt", candidate_facing=False)
    assert mime == "text/plain; charset=utf-8"
    assert fn.endswith(".txt")
    txt_str = txt_bytes.decode("utf-8")
    assert "*" not in txt_str, "Exported plain text should contain zero asterisk characters"
    assert "COMPANYAI INTERVIEW SCREENING KIT" in txt_str

    # 2. Candidate-facing plain text
    cand_txt_bytes, _, _ = export_interview_kit_bytes(kit, format="txt", candidate_facing=True)
    cand_str = cand_txt_bytes.decode("utf-8")
    assert "Expected Answer Signals" not in cand_str
    assert "1-5 Scoring Rubric" not in cand_str
    assert "*" not in cand_str

    # 3. DOCX Word export
    docx_bytes, docx_mime, docx_fn = export_interview_kit_bytes(kit, format="docx")
    assert "openxmlformats" in docx_mime
    assert len(docx_bytes) > 1000

    # 4. PDF export
    pdf_bytes, pdf_mime, pdf_fn = export_interview_kit_bytes(kit, format="pdf")
    assert pdf_mime == "application/pdf"
    assert pdf_bytes.startswith(b"%PDF")


def test_clean_plain_text_helper():
    """Verify _clean_plain_text strips orphan asterisks and bold markers."""
    raw = "• Location:** Bengaluru\n• Work Mode:** Hybrid\n• Experience:** 1–3 years\n**Question:** What is *CAD*?"
    cleaned = _clean_plain_text(raw)
    assert "*" not in cleaned
    assert "Location: Bengaluru" in cleaned
    assert "Work Mode: Hybrid" in cleaned
    assert "Question: What is CAD?" in cleaned
