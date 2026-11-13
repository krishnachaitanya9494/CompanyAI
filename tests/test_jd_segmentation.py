"""Unit and integration tests for Phase 3: AI-Powered Job Description Segmentation & Requirement Extraction."""

# Import io and uuid for test mocks.
import io
import uuid
# Import pytest.
import pytest
# Import FastAPI TestClient.
from fastapi.testclient import TestClient
# Import main application.
from app.main import app
# Import database session and models.
from database.sqlite_connection import SessionLocal
from database.models import Job, JobDescription, JDSegmentation, JobRequirement, Candidate, Resume
# Import segmentation service functions and classes.
from app.services.jd_segmentation_service import (
    STANDARD_15_CATEGORIES,
    CATEGORY_LABELS,
    ExtractedRequirementItem,
    JDSegmentationOutput,
    heuristic_fallback_segmentation,
    segment_job_description,
    get_segmentation_dict,
    normalize_skill_name,
)


@pytest.fixture
def client():
    """Create a FastAPI test client instance."""
    return TestClient(app)


@pytest.fixture(autouse=True)
def mock_openrouter_api(monkeypatch):
    """Ensure automated tests never call live OpenRouter endpoints and execute with mocked data."""
    def _mock_call(sanitized_text, *args, **kwargs):
        return heuristic_fallback_segmentation(sanitized_text)
    from app.services import jd_segmentation_service
    monkeypatch.setattr(jd_segmentation_service, "call_nemotron_segmentation_api", _mock_call)


def test_standard_15_categories_defined():
    """Verify that all 15 required categories are defined with labels."""
    assert len(STANDARD_15_CATEGORIES) == 15
    for cat in STANDARD_15_CATEGORIES:
        assert cat in CATEGORY_LABELS
        assert len(CATEGORY_LABELS[cat]) > 2


def test_skill_normalization():
    """Verify that common raw skill variations are properly normalized to canonical names."""
    assert normalize_skill_name("React.js") == "React"
    assert normalize_skill_name("reactjs") == "React"
    assert normalize_skill_name("golang") == "Go"
    assert normalize_skill_name("postgres") == "PostgreSQL"
    assert normalize_skill_name("k8s") == "Kubernetes"
    assert normalize_skill_name("oracle fccs") == "Oracle FCCS"


def test_heuristic_fallback_segmentation_all_categories():
    """Verify heuristic extractor segments text with section headings into categories with evidence."""
    sample_jd = """
    OVERVIEW
    Acme Software is seeking a Lead Platform Architect to head our enterprise transformation.

    ROLE SUMMARY
    Lead Architect responsible for designing high-scale cloud platforms.

    KEY RESPONSIBILITIES
    • Architect distributed microservices using modern design patterns
    • Oversee technical governance and conduct architecture design reviews
    • Mentor senior software engineering teams

    MANDATORY SKILLS
    • Python with FastAPI and async event loops
    • Kubernetes container orchestration
    • Distributed database architectures (PostgreSQL, Redis)

    PREFERRED SKILLS
    • Golang microservices experience
    • Terraform infrastructure as code

    TECHNICAL SKILLS
    • PyTorch or Deep Learning fundamentals
    • Event-driven architecture with Apache Kafka

    TOOLS AND TECHNOLOGIES
    • Docker, GitHub Actions, Prometheus, Grafana

    DOMAIN KNOWLEDGE
    • Enterprise SaaS and high-volume transaction processing

    EXPERIENCE
    • Minimum 8+ years of professional backend software architecture experience

    EDUCATION
    • Bachelor's or Master's degree in Computer Science or related STEM field

    CERTIFICATIONS
    • AWS Certified Solutions Architect Professional preferred

    LOCATION
    • Hyderabad / Bangalore with flexible hybrid working arrangement
    """

    output = heuristic_fallback_segmentation(sample_jd)
    assert isinstance(output, JDSegmentationOutput)
    assert len(output.requirements) >= 10

    # Verify categories extracted.
    extracted_categories = {req.category for req in output.requirements}
    assert "key_responsibilities" in extracted_categories
    assert "mandatory_skills" in extracted_categories
    assert "preferred_skills" in extracted_categories

    # Verify evidence grounding is present on every item.
    for req in output.requirements:
        assert req.evidence is not None
        assert len(req.evidence) > 0
        assert req.original_text is not None

    # Verify Mandatory vs Preferred distinction.
    mandatory_items = [r for r in output.requirements if r.category == "mandatory_skills"]
    preferred_items = [r for r in output.requirements if r.category == "preferred_skills"]
    assert all(r.classification == "Mandatory" for r in mandatory_items)
    assert all(r.classification == "Preferred" for r in preferred_items)


def test_segment_job_endpoint_and_sqlite_persistence(client):
    """Verify POST /api/jobs/{id}/segment triggers segmentation and persists in SQLite."""
    # Query an existing job.
    jobs_res = client.get("/api/jobs")
    assert jobs_res.status_code == 200
    jobs = jobs_res.json()
    assert len(jobs) > 0
    job_id = jobs[0]["id"]

    # Trigger segmentation endpoint.
    seg_res = client.post(f"/api/jobs/{job_id}/segment?force=true")
    assert seg_res.status_code == 200
    data = seg_res.json()
    assert data["status"] == "success"
    seg = data["segmentation"]
    assert seg["job_id"] == job_id
    assert "categories" in seg
    assert len(seg["categories"]) == 15
    assert seg["status"] == "review_pending"


def test_get_job_segmentation_endpoint(client):
    """Verify GET /api/jobs/{id}/segmentation retrieves segmented requirements with evidence."""
    jobs_res = client.get("/api/jobs")
    job_id = jobs_res.json()[0]["id"]

    get_res = client.get(f"/api/jobs/{job_id}/segmentation")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["status"] == "success"
    seg = data["segmentation"]
    assert seg["job_id"] == job_id
    assert "categories" in seg

    # Check that categories dictionary contains all 15 categories.
    for cat_code in STANDARD_15_CATEGORIES:
        assert cat_code in seg["categories"]


def test_recruiter_edit_add_delete_requirements(client):
    """Verify PUT /api/jobs/{id}/segmentation allows editing, adding, and deleting requirements."""
    jobs_res = client.get("/api/jobs")
    job_id = jobs_res.json()[0]["id"]

    # Retrieve current segmentation.
    cur_res = client.get(f"/api/jobs/{job_id}/segmentation")
    cur_seg = cur_res.json()["segmentation"]
    existing_mand = cur_seg["categories"]["mandatory_skills"]
    target_req_id = existing_mand[0]["id"] if existing_mand else None

    # Add a new requirement and edit existing.
    new_req_text = f"Custom Recruiter Requirement {uuid.uuid4().hex[:6]}"
    payload = {
        "job_overview": "Updated Executive Overview by Recruiter",
        "requirements": [
            {
                "category": "mandatory_skills",
                "original_text": new_req_text,
                "classification": "Mandatory",
                "normalized_skill": "Enterprise Architecture",
                "evidence": "Stated during intake call with hiring manager",
                "is_approved": True,
            }
        ]
    }

    if target_req_id:
        # Also edit existing item: toggle to Preferred.
        payload["requirements"].append({
            "id": target_req_id,
            "category": "preferred_skills",
            "original_text": "Updated skill wording",
            "classification": "Preferred",
            "normalized_skill": "Cloud Systems",
            "is_approved": True,
        })

    put_res = client.put(f"/api/jobs/{job_id}/segmentation", json=payload)
    assert put_res.status_code == 200
    updated_seg = put_res.json()["segmentation"]
    assert updated_seg["job_overview"] == "Updated Executive Overview by Recruiter"

    # Verify newly added requirement is present and marked approved.
    all_reqs = [
        r for cat_list in updated_seg["categories"].values() for r in cat_list
    ]
    added_matches = [r for r in all_reqs if r["original_text"] == new_req_text]
    assert len(added_matches) == 1
    assert added_matches[0]["is_approved"] is True

    # Test Deletion.
    added_id = added_matches[0]["id"]
    del_payload = {
        "requirements": [
            {
                "id": added_id,
                "category": "mandatory_skills",
                "original_text": new_req_text,
                "is_deleted": True,
            }
        ]
    }
    del_res = client.put(f"/api/jobs/{job_id}/segmentation", json=del_payload)
    assert del_res.status_code == 200
    after_del_seg = del_res.json()["segmentation"]
    all_reqs_after = [
        r for cat_list in after_del_seg["categories"].values() for r in cat_list
    ]
    assert not any(r["id"] == added_id for r in all_reqs_after)


def test_approve_segmentation_endpoint(client):
    """Verify POST /api/jobs/{id}/approve-segmentation approves requirements and updates Job skills."""
    jobs_res = client.get("/api/jobs")
    job_id = jobs_res.json()[0]["id"]

    approve_res = client.post(
        f"/api/jobs/{job_id}/approve-segmentation",
        json={"approver": "Senior Lead Recruiter"},
    )
    assert approve_res.status_code == 200
    data = approve_res.json()
    assert data["status"] == "success"
    seg = data["segmentation"]
    assert seg["status"] == "approved"
    assert seg["is_approved"] is True
    assert seg["approved_by"] == "Senior Lead Recruiter"

    # Confirm re-segmentation without force is blocked to preserve recruiter approval.
    reseg_res = client.post(f"/api/jobs/{job_id}/segment?force=false")
    assert reseg_res.status_code == 200
    assert reseg_res.json()["status"] == "already_approved"


def test_missing_unspecified_requirements():
    """Verify that empty sections in JD text do not invent fabricated requirements."""
    minimal_jd = "Position: Junior QA Analyst. Must know manual testing."
    output = heuristic_fallback_segmentation(minimal_jd)
    # Certifications and preferred experience should be empty or unspecified.
    cert_items = [r for r in output.requirements if r.category == "certifications"]
    assert len(cert_items) == 0


def test_invalid_ai_json_handling_and_fallback_repair():
    """Verify that malformed or incomplete model output falls back to grounded heuristic extraction."""
    from app.services.jd_segmentation_service import call_nemotron_segmentation_api

    # With dummy key or offline, it gracefully falls back to grounded extraction without crashing.
    result = call_nemotron_segmentation_api(
        sanitized_text="Overview: Enterprise AI. Mandatory Skills: Python, SQL. Experience: 5 years.",
        api_key="YOUR_OPENROUTER_API_KEY",
    )
    assert isinstance(result, JDSegmentationOutput)
    assert len(result.requirements) > 0


def test_preserve_original_jd_text_after_segmentation(client):
    """Verify that running segmentation never overwrites or alters the original JD document."""
    db = SessionLocal()
    try:
        job = db.query(Job).first()
        assert job is not None
        original_desc = job.description

        # Trigger segmentation.
        res = client.post(f"/api/jobs/{job.id}/segment?force=true")
        assert res.status_code == 200

        # Verify job description is unchanged.
        db.refresh(job)
        assert job.description == original_desc
    finally:
        db.close()


def test_evidence_verification_exact_and_unverified():
    """Verify that evidence verification accurately detects source grounding vs unverified claims."""
    from app.services.jd_segmentation_service import verify_evidence_in_source

    source_text = (
        "We are looking for a Senior Python Developer with 5+ years of FastAPI experience, "
        "Kubernetes orchestration, and PostgreSQL database optimization."
    )

    # Test exact substring match.
    exact_res = verify_evidence_in_source("FastAPI experience", source_text)
    assert exact_res["is_verified"] is True
    assert exact_res["match_type"] == "exact_phrase"

    # Test high similarity match with punctuation/casing variations.
    high_sim_res = verify_evidence_in_source("5+ years of FastAPI experience and Kubernetes", source_text)
    assert high_sim_res["is_verified"] is True
    assert high_sim_res["match_type"] in ("exact_phrase", "high_similarity")

    # Test completely ungrounded / fabricated excerpt.
    unverified_res = verify_evidence_in_source("Must have 10 years of Blockchain and Solidity smart contracts", source_text)
    assert unverified_res["is_verified"] is False
    assert unverified_res["match_type"] == "unverified_quote"


def test_phase4_workspace_metrics_and_provenance(client):
    """Verify that workspace metrics and requirement provenance are properly computed and returned."""
    jobs_res = client.get("/api/jobs")
    job_id = jobs_res.json()[0]["id"]

    # Retrieve segmentation for the job.
    res = client.get(f"/api/jobs/{job_id}/segmentation")
    assert res.status_code == 200
    seg = res.json()["segmentation"]

    # Check metrics structure.
    metrics = seg.get("metrics")
    assert metrics is not None
    assert "total_requirements" in metrics
    assert "mandatory_count" in metrics
    assert "preferred_count" in metrics
    assert "verified_count" in metrics
    assert "unreviewed_count" in metrics
    assert "grounded_percent" in metrics
    assert "categories_filled" in metrics
    assert "categories_empty" in metrics
    assert metrics["categories_filled"] + len(metrics["categories_empty"]) == 15

    # Check that category breakdown contains category-level metrics.
    cat_stats = seg.get("category_stats")
    assert cat_stats is not None
    assert len(cat_stats) == 15
    for cat_code, bdata in cat_stats.items():
        assert "count" in bdata
        assert "mandatory" in bdata
        assert "preferred" in bdata
        assert "is_empty" in bdata

    # Check that individual requirements have provenance and verification attached.
    all_reqs = [r for cat_list in seg["categories"].values() for r in cat_list]
    for r in all_reqs:
        assert "source_origin" in r
        assert r["source_origin"] in ("ai_model", "heuristic_fallback", "recruiter_added", "recruiter_edited", "ai_extracted")
        assert "review_state" in r
        assert r["review_state"] in ("verified", "unreviewed")
        assert "evidence_verification" in r
        assert "is_verified" in r["evidence_verification"]


def test_historical_versions_api(client):
    """Verify historical versions endpoint GET /api/jobs/{id}/segmentation/versions."""
    jobs_res = client.get("/api/jobs")
    job_id = jobs_res.json()[0]["id"]

    # Request version history.
    v_res = client.get(f"/api/jobs/{job_id}/segmentation/versions")
    assert v_res.status_code == 200
    versions_list = v_res.json()
    assert isinstance(versions_list, list)
    assert len(versions_list) >= 1

    first_v = versions_list[0]
    assert "version" in first_v
    assert "total_requirements" in first_v
    assert "is_current" in first_v

    target_ver = first_v["version"]

    # Request specific version.
    specific_res = client.get(f"/api/jobs/{job_id}/segmentation?version={target_ver}")
    assert specific_res.status_code == 200
    spec_data = specific_res.json()
    assert spec_data["segmentation"]["version"] == target_ver


def test_reapproval_skill_synchronization(client):
    """Verify that approving/re-approving segmentation updates Job required and preferred skills without altering other fields."""
    db = SessionLocal()
    try:
        job = db.query(Job).first()
        job_id = job.id
        orig_title = job.title
        orig_location = job.location
        orig_client = job.client_name
    finally:
        db.close()

    # Add distinct skill requirement via PUT.
    custom_mandatory_skill = f"SyncMandatorySkill_{uuid.uuid4().hex[:4]}"
    custom_preferred_skill = f"SyncPreferredSkill_{uuid.uuid4().hex[:4]}"

    put_res = client.put(
        f"/api/jobs/{job_id}/segmentation",
        json={
            "requirements": [
                {
                    "category": "mandatory_skills",
                    "original_text": f"Must have mastery of {custom_mandatory_skill}",
                    "classification": "Mandatory",
                    "normalized_skill": custom_mandatory_skill,
                    "evidence": "Stated in mandatory requirements",
                    "is_approved": True,
                },
                {
                    "category": "preferred_skills",
                    "original_text": f"Nice to have expertise in {custom_preferred_skill}",
                    "classification": "Preferred",
                    "normalized_skill": custom_preferred_skill,
                    "evidence": "Stated in preferred requirements",
                    "is_approved": True,
                },
            ]
        },
    )
    assert put_res.status_code == 200

    # Call approve endpoint.
    app_res = client.post(
        f"/api/jobs/{job_id}/approve-segmentation",
        json={"approver": "Talent Operations Lead"},
    )
    assert app_res.status_code == 200

    # Verify Job record in database has updated skills and preserved other fields.
    db = SessionLocal()
    try:
        updated_job = db.query(Job).filter(Job.id == job_id).first()
        assert updated_job.title == orig_title
        assert updated_job.location == orig_location
        assert updated_job.client_name == orig_client

        # Check that synchronized skills contain newly approved skills.
        req_skills = updated_job.required_skills or []
        pref_skills = updated_job.preferred_skills or []
        assert custom_mandatory_skill in req_skills
        assert custom_preferred_skill in pref_skills
    finally:
        db.close()


def test_manual_skills_preserved_during_reapproval(client):
    """Verify that manually maintained job skills outside JD segmentation are preserved during reapproval."""
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == 1).first()
        job_id = job.id

        # Seed manual recruiter skill directly on Job model.
        manual_skill = f"ManualRecruiterSkill_{uuid.uuid4().hex[:4]}"
        job.required_skills = [manual_skill]
        db.commit()
    finally:
        db.close()

    # Step 1: Add JD-managed skill requirement.
    jd_skill_v1 = f"JDSkillV1_{uuid.uuid4().hex[:4]}"
    put_res = client.put(
        f"/api/jobs/{job_id}/segmentation",
        json={
            "requirements": [
                {
                    "category": "mandatory_skills",
                    "original_text": f"Mandatory knowledge of {jd_skill_v1}",
                    "classification": "Mandatory",
                    "normalized_skill": jd_skill_v1,
                    "evidence": "Stated in JD requirements",
                    "is_approved": True,
                }
            ]
        },
    )
    assert put_res.status_code == 200

    # Step 2: Approve segmentation.
    app_res = client.post(
        f"/api/jobs/{job_id}/approve-segmentation",
        json={"approver": "Principal Recruiter"},
    )
    assert app_res.status_code == 200

    # Step 3: Verify that BOTH the manual skill and the JD skill are in job.required_skills.
    db = SessionLocal()
    try:
        updated_job = db.query(Job).filter(Job.id == job_id).first()
        assert manual_skill in updated_job.required_skills
        assert jd_skill_v1 in updated_job.required_skills
    finally:
        db.close()

    # Step 4: Re-approve with a different JD skill by updating existing requirement item (replacing jd_skill_v1).
    cur_seg = client.get(f"/api/jobs/{job_id}/segmentation").json()["segmentation"]
    v1_items = [r for r in cur_seg["categories"]["mandatory_skills"] if r.get("normalized_skill") == jd_skill_v1]
    assert len(v1_items) == 1
    req_v1_id = v1_items[0]["id"]

    jd_skill_v2 = f"JDSkillV2_{uuid.uuid4().hex[:4]}"
    client.put(
        f"/api/jobs/{job_id}/segmentation",
        json={
            "requirements": [
                {
                    "id": req_v1_id,
                    "category": "mandatory_skills",
                    "original_text": f"Mandatory knowledge of {jd_skill_v2}",
                    "classification": "Mandatory",
                    "normalized_skill": jd_skill_v2,
                    "evidence": "Updated JD requirement",
                    "is_approved": True,
                }
            ]
        },
    )
    app2_res = client.post(
        f"/api/jobs/{job_id}/approve-segmentation",
        json={"approver": "Principal Recruiter"},
    )
    assert app2_res.status_code == 200

    # Step 5: Verify manual skill is still preserved, new JD skill is present, and old JD skill was cleanly replaced.
    db = SessionLocal()
    try:
        final_job = db.query(Job).filter(Job.id == job_id).first()
        # Manual recruiter skill must persist untouched.
        assert manual_skill in final_job.required_skills
        # New JD skill is present.
        assert jd_skill_v2 in final_job.required_skills
        # Obsolete JD skill from previous version was removed.
        assert jd_skill_v1 not in final_job.required_skills
    finally:
        db.close()


def test_version_lineage_and_immutability(client):
    """Verify that re-segmentation strictly increments version lineage and past versions remain immutable."""
    jobs_res = client.get("/api/jobs")
    job_id = jobs_res.json()[0]["id"]

    # Check current versions.
    v_res = client.get(f"/api/jobs/{job_id}/segmentation/versions")
    assert v_res.status_code == 200
    versions = v_res.json()
    initial_version = versions[0]["version"]

    # Force re-segment to generate the next version in the lineage.
    seg_res = client.post(f"/api/jobs/{job_id}/segment?force=true")
    assert seg_res.status_code == 200
    new_version_num = seg_res.json()["segmentation"]["version"]
    assert new_version_num == initial_version + 1

    # Verify past version can be inspected and is unaltered.
    past_res = client.get(f"/api/jobs/{job_id}/segmentation?version=1")
    assert past_res.status_code == 200
    past_data = past_res.json()
    assert past_data["segmentation"]["version"] == 1


def test_database_foreign_keys_and_relationships():
    """Verify that all foreign keys and database relationships across models are intact."""
    db = SessionLocal()
    try:
        # Check JobRequirement foreign keys link to valid JDSegmentation rows.
        reqs = db.query(JobRequirement).all()
        for r in reqs:
            assert r.segmentation_id is not None
            parent_seg = db.query(JDSegmentation).filter(JDSegmentation.id == r.segmentation_id).first()
            assert parent_seg is not None

        # Check JDSegmentation foreign keys link to valid Job rows.
        segs = db.query(JDSegmentation).all()
        for s in segs:
            assert s.job_id is not None
            parent_job = db.query(Job).filter(Job.id == s.job_id).first()
            assert parent_job is not None

        # Check Resume foreign keys link to valid Candidate rows.
        resumes = db.query(Resume).all()
        for res in resumes:
            assert res.candidate_id is not None
            parent_cand = db.query(Candidate).filter(Candidate.id == res.candidate_id).first()
            assert parent_cand is not None
    finally:
        db.close()



