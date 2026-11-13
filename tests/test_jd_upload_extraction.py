"""Unit and integration tests for Phase 2: Manual Job Description Upload & Text Extraction."""

# Import io for memory-based mock file buffers.
import io
# Import uuid for generating unique content hashes across test runs.
import uuid
# Import pytest for test assertions.
import pytest
# Import TestClient from fastapi.testclient.
from fastapi.testclient import TestClient
# Import FastAPI app.
from app.main import app
# Import database session dependency and models.
from database.sqlite_connection import SessionLocal
from database.models import Job, JobDescription
# Import extraction service functions directly for unit test coverage.
from app.services.jd_extraction_service import (
    validate_file_upload,
    extract_text_from_bytes,
    compute_normalized_text_hash,
    sanitize_filename,
    check_for_duplicates,
)


@pytest.fixture
def client():
    """Create a test client instance."""
    return TestClient(app)


def test_sanitize_filename():
    """Verify filename sanitization prevents path traversal and unsafe characters."""
    unsafe_name = "../../etc/passwd/test?job*file.pdf"
    clean = sanitize_filename(unsafe_name)
    assert "/" not in clean
    assert "\\" not in clean
    assert ".." not in clean
    assert clean.endswith(".pdf")


def test_validate_file_upload_rules():
    """Verify file upload validation checks extensions, magic bytes, and size."""
    # Test empty file rejection.
    empty_res = validate_file_upload("job.pdf", b"")
    assert not empty_res["valid"]
    assert "empty" in empty_res["error"]

    # Test unsupported extension rejection.
    unsupported_res = validate_file_upload("job.exe", b"MZ\x90\x00")
    assert not unsupported_res["valid"]
    assert "Unsupported file type" in unsupported_res["error"]

    # Test invalid PDF magic signature.
    fake_pdf = validate_file_upload("job.pdf", b"NOT_A_REAL_PDF_HEADER")
    assert not fake_pdf["valid"]
    assert "Missing %PDF" in fake_pdf["error"]

    # Test valid TXT file.
    valid_txt = validate_file_upload("job.txt", b"Valid job description text.")
    assert valid_txt["valid"]
    assert valid_txt["extension"] == ".txt"


def test_txt_text_extraction():
    """Verify text extraction from plain text content."""
    sample_text = "Senior Python Engineer needed for enterprise cloud platform."
    res = extract_text_from_bytes("sample.txt", sample_text.encode("utf-8"))
    assert res["status"] == "extracted"
    assert res["text"] == sample_text
    assert res["character_count"] == len(sample_text)
    assert res["word_count"] == 8
    assert not res["ocr_needed"]


def test_scanned_pdf_ocr_flag():
    """Verify that a PDF with pages but zero selectable text is flagged as ocr_required."""
    from pypdf import PdfWriter
    # Create an empty 1-page PDF using PdfWriter.
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    pdf_buffer = io.BytesIO()
    writer.write(pdf_buffer)
    pdf_bytes = pdf_buffer.getvalue()

    res = extract_text_from_bytes("scanned_receipt.pdf", pdf_bytes)
    assert res["status"] == "ocr_required"
    assert res["ocr_needed"] is True
    assert res["character_count"] < 30


def test_normalized_text_hash_invariance():
    """Verify normalized text hash ignores whitespace and capitalization differences."""
    text1 = "Senior   Data  Scientist\n\nwith  Python & SQL!"
    text2 = "senior data scientist with python sql"
    hash1 = compute_normalized_text_hash(text1)
    hash2 = compute_normalized_text_hash(text2)
    assert hash1 == hash2


def test_upload_jd_endpoint_txt(client):
    """Verify POST /api/jobs/upload parses a TXT document and returns preview."""
    unique_marker = uuid.uuid4().hex[:8]
    text_content = f"Title: Senior AI Architect {unique_marker}\nExperience: 8+ years\nSkills: PyTorch, Nemotron, FastAPI\nLocation: Bangalore"
    files = {"file": (f"jd_{unique_marker}.txt", io.BytesIO(text_content.encode("utf-8")), "text/plain")}

    response = client.post("/api/jobs/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["processing_status"] == "extracted"
    assert unique_marker in data["extracted_text"]
    assert data["word_count"] > 5
    assert not data["ocr_needed"]


def test_preview_pasted_text_endpoint(client):
    """Verify POST /api/jobs/preview-text validates and returns preview with word count."""
    unique_marker = uuid.uuid4().hex[:8]
    pasted_text = f"We are looking for a Senior DevOps Specialist {unique_marker} with Kubernetes, Terraform, and AWS CI/CD pipelines expertise."
    payload = {"raw_text": pasted_text, "title": "Senior DevOps Specialist"}

    response = client.post("/api/jobs/preview-text", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["processing_status"] == "extracted"
    assert data["character_count"] == len(pasted_text)
    assert data["word_count"] > 10


def test_preview_pasted_text_rejects_too_short(client):
    """Verify POST /api/jobs/preview-text rejects text under 20 characters."""
    payload = {"raw_text": "Short JD"}
    response = client.post("/api/jobs/preview-text", json=payload)
    assert response.status_code == 400
    assert "at least 20 characters" in response.json()["detail"]


def test_create_manual_job_with_versioning(client):
    """Verify manual job creation, duplicate prevention, and non-destructive versioning."""
    unique_key = uuid.uuid4().hex[:8]
    job_code = f"REQ-TEST-{unique_key.upper()}"
    role_title = f"Staff Cloud Engineer {unique_key}"
    description_v1 = f"Version 1 of {role_title}. Needs AWS, Golang, and Distributed Systems."

    # Step 1: Create Version 1.
    payload_v1 = {
        "title": role_title,
        "description": description_v1,
        "client_name": "Acme Global",
        "job_code": job_code,
        "work_mode": "Remote",
        "employment_type": "Full-time",
        "location": "Remote / Hyderabad",
        "min_experience_years": 6.0,
        "max_experience_years": 10.0,
        "salary_range": "$140,000 - $170,000",
        "openings_count": 2,
        "department": "Infrastructure Platform",
        "recruiter_owner": "Sarah Jenkins",
        "priority": "High",
        "status": "open",
        "required_skills": ["AWS", "Golang", "Kubernetes"],
        "preferred_skills": ["Terraform", "Kafka"],
        "source": "manual_upload",
    }
    res_v1 = client.post("/api/jobs/create-manual", json=payload_v1)
    assert res_v1.status_code == 200
    data_v1 = res_v1.json()
    job_v1 = data_v1["job"]
    assert job_v1["version"] == 1
    assert job_v1["title"] == role_title
    job_v1_id = job_v1["id"]

    # Step 2: Test Duplicate Detection using exact text.
    prev_res = client.post("/api/jobs/preview-text", json={"raw_text": description_v1})
    assert prev_res.status_code == 200
    prev_data = prev_res.json()
    assert prev_data["duplicate_detection"] is not None
    assert prev_data["duplicate_detection"]["is_duplicate"] is True

    # Step 3: Create Version 2 by referencing parent_job_id.
    description_v2 = f"Version 2 of {role_title} with updated salary and extra Rust skill requirement."
    payload_v2 = {
        "title": role_title,
        "description": description_v2,
        "client_name": "Acme Global",
        "job_code": job_code,
        "work_mode": "Remote",
        "employment_type": "Full-time",
        "location": "Remote / Hyderabad",
        "min_experience_years": 7.0,
        "max_experience_years": 12.0,
        "salary_range": "$160,000 - $190,000",
        "openings_count": 2,
        "department": "Infrastructure Platform",
        "recruiter_owner": "Sarah Jenkins",
        "priority": "Urgent",
        "status": "open",
        "required_skills": ["AWS", "Golang", "Rust", "Kubernetes"],
        "preferred_skills": ["Terraform", "Kafka"],
        "source": "manual_upload",
        "parent_job_id": job_v1_id,
    }
    res_v2 = client.post("/api/jobs/create-manual", json=payload_v2)
    assert res_v2.status_code == 200
    job_v2 = res_v2.json()["job"]
    assert job_v2["version"] == 2
    job_v2_id = job_v2["id"]
    assert job_v2_id != job_v1_id

    # Step 4: Verify Version 1 was NOT deleted or overwritten.
    res_check_v1 = client.get(f"/api/jobs/{job_v1_id}")
    assert res_check_v1.status_code == 200
    assert res_check_v1.json()["version"] == 1
    assert "Version 1" in res_check_v1.json()["description"]

    # Step 5: Verify GET /api/jobs/{id}/versions returns both versions.
    res_versions = client.get(f"/api/jobs/{job_v2_id}/versions")
    assert res_versions.status_code == 200
    versions_list = res_versions.json()
    assert len(versions_list) >= 2
    version_numbers = [v["version"] for v in versions_list]
    assert 1 in version_numbers
    assert 2 in version_numbers


def test_existing_jobs_and_jds_preserved():
    """Verify that the original 7 jobs and 7 JDs in SQLite remain intact."""
    db = SessionLocal()
    try:
        job_count = db.query(Job).count()
        jd_count = db.query(JobDescription).count()
        # Original 7 jobs and 7 JDs must be present (plus any test jobs added above).
        assert job_count >= 7
        assert jd_count >= 7
    finally:
        db.close()
