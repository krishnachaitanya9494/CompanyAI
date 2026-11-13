"""Comprehensive tests for Phase 5B: JD Embedding Foundation.

Tests cover:
- Approved segmentation embedding generation
- Rejection of unapproved/pending segmentations
- Full JD embedding generation (job overview, role summary, mandatory skills)
- Granular requirement embedding generation
- Mandatory vs. Preferred classification preservation
- SHA-256 deduplication and vector reuse
- Model and dimension validation (2048 dimensions)
- Invalid, zero, and non-finite vectors
- OpenRouter retry and transient failure handling
- Historical segmentation isolation
- Existing candidate embedding preservation
"""

# Import standard math and hashlib for vector and digest assertions.
import math
import hashlib
from typing import List
# Import pytest.
import pytest
from unittest.mock import MagicMock, patch
# Import SQLAlchemy types and engine.
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
# Import declarative base and models.
from database.sqlite_connection import Base
from database.models import (
    Job,
    JobDescription,
    JDSegmentation,
    JobRequirement,
    JobEmbedding,
    Resume,
    ResumeEmbedding,
    Candidate,
)
# Import database migrations to ensure full schema creation.
from database.sqlite_migrations import initialize_sqlite_schema
# Import vector validation and storage.
from database.embedding_storage import (
    validate_embedding_vector,
    store_job_embedding,
    find_compatible_job_embedding_by_hash,
)
# Import embedding service functions.
from app.embedding_service import generate_embedding, OPENROUTER_EMBEDDING_MODEL
from app.services.jd_embedding_service import (
    build_full_jd_embedding_text,
    build_requirement_embedding_text,
    compute_text_sha256,
    generate_segmentation_embeddings,
    get_active_approved_segmentation,
    get_job_embedding_status,
    get_job_embeddings_metadata,
)


# Helper to generate a valid deterministic 2048-dimensional mock vector.
def make_mock_vector(dim: int = 2048, seed_val: float = 0.01) -> List[float]:
    # Return a 2048-element list of non-zero finite floats.
    return [float(seed_val + (i * 0.0001)) for i in range(dim)]


# Pytest fixture for an isolated in-memory SQLite database session.
@pytest.fixture
def db_session() -> Session:
    # Create an in-memory SQLite engine with foreign keys enabled.
    engine = create_engine("sqlite:///:memory:", echo=False)
    # Register models and run migrations to create all tables and indexes.
    initialize_sqlite_schema(engine)
    # Bind session factory.
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    # Yield session for test execution.
    try:
        yield session
    finally:
        session.close()


# Pytest fixture for seeding a sample job with approved and unapproved segmentations.
@pytest.fixture
def sample_job_data(db_session: Session) -> dict:
    # Create operational job.
    job = Job(
        title="Senior Cloud Platform Engineer",
        description="Lead architecture and deployment of enterprise cloud platforms.",
        required_skills=["Python", "FastAPI", "Kubernetes"],
        preferred_skills=["Golang", "Terraform"],
        min_experience_years=5.0,
        max_experience_years=10.0,
        location="Bangalore",
        status="open",
        version=1,
    )
    db_session.add(job)
    db_session.flush()

    # Create approved segmentation (v1).
    seg_approved = JDSegmentation(
        job_id=job.id,
        version=1,
        status="approved",
        is_approved=1,
        approved_by="Lead Recruiter",
        model_name="nvidia/nemotron-3.5-super-vl",
        job_overview="Enterprise platform modernization role for scalable microservices.",
        role_summary="Senior Engineer guiding Kubernetes cloud architecture.",
    )
    db_session.add(seg_approved)
    db_session.flush()

    # Add mandatory requirement.
    req_mand = JobRequirement(
        segmentation_id=seg_approved.id,
        category="mandatory_skills",
        classification="Mandatory",
        original_text="Proficiency in Python and asynchronous FastAPI microservices.",
        normalized_skill="Python",
        evidence="Demonstrated 5+ years building FastAPI systems.",
        confidence=0.98,
        is_approved=1,
        order_index=0,
    )
    # Add preferred requirement.
    req_pref = JobRequirement(
        segmentation_id=seg_approved.id,
        category="preferred_skills",
        classification="Preferred",
        original_text="Experience with Golang distributed caching.",
        normalized_skill="Go",
        evidence="Preferred experience with Go services.",
        confidence=0.95,
        is_approved=1,
        order_index=1,
    )
    db_session.add(req_mand)
    db_session.add(req_pref)
    db_session.flush()

    # Create an unapproved segmentation (v2) for historical/pending isolation tests.
    seg_pending = JDSegmentation(
        job_id=job.id,
        version=2,
        status="review_pending",
        is_approved=0,
        model_name="nvidia/nemotron-3.5-super-vl",
        job_overview="Draft revised overview for v2.",
        role_summary="Draft role summary.",
    )
    db_session.add(seg_pending)
    db_session.flush()

    # Add draft requirement for pending segmentation.
    req_pending = JobRequirement(
        segmentation_id=seg_pending.id,
        category="mandatory_skills",
        classification="Mandatory",
        original_text="Draft requirement for unapproved version.",
        is_approved=0,
        order_index=0,
    )
    db_session.add(req_pending)
    db_session.commit()

    return {
        "job": job,
        "approved_segmentation": seg_approved,
        "pending_segmentation": seg_pending,
        "req_mand": req_mand,
        "req_pref": req_pref,
    }


def test_approved_segmentation_embedding_generation(db_session: Session, sample_job_data: dict):
    """Verify embedding generation for approved segmentation creates full JD and requirement embeddings."""
    seg = sample_job_data["approved_segmentation"]
    mock_vector = make_mock_vector(2048, 0.05)

    # Use mock provider returning 2048-dim vector.
    def mock_provider(text: str):
        return mock_vector

    result = generate_segmentation_embeddings(
        db=db_session,
        segmentation_id=seg.id,
        embedding_provider=mock_provider,
    )

    # Verify return structure.
    assert result["status"] == "success"
    assert result["generated_count"] == 3  # 1 full JD + 2 requirements
    assert result["reused_count"] == 0
    assert result["skipped_count"] == 0
    assert result["failed_count"] == 0
    assert len(result["embeddings"]) == 3

    # Verify database persistence.
    stored = db_session.scalars(
        select(JobEmbedding).where(JobEmbedding.segmentation_id == seg.id)
    ).all()
    assert len(stored) == 3

    # Check that dimensions are all 2048.
    for emb in stored:
        assert emb.dimensions == 2048
        assert len(emb.embedding_vector) == 2048
        assert emb.model_name == OPENROUTER_EMBEDDING_MODEL
        assert len(emb.input_hash) == 64


def test_rejection_of_unapproved_segmentation(db_session: Session, sample_job_data: dict):
    """Verify that unapproved or review_pending segmentations are strictly rejected."""
    pending_seg = sample_job_data["pending_segmentation"]

    # Attempting to generate embeddings for unapproved segmentation must raise ValueError.
    with pytest.raises(ValueError, match="is in status 'review_pending'"):
        generate_segmentation_embeddings(
            db=db_session,
            segmentation_id=pending_seg.id,
            embedding_provider=lambda text: make_mock_vector(2048),
        )

    # Confirm no embeddings were created in SQLite.
    stored = db_session.scalars(
        select(JobEmbedding).where(JobEmbedding.segmentation_id == pending_seg.id)
    ).all()
    assert len(stored) == 0


def test_full_jd_and_granular_requirements_classification(db_session: Session, sample_job_data: dict):
    """Verify that mandatory vs preferred classifications are preserved on requirement embeddings."""
    seg = sample_job_data["approved_segmentation"]
    generate_segmentation_embeddings(
        db=db_session,
        segmentation_id=seg.id,
        embedding_provider=lambda text: make_mock_vector(2048),
    )

    embeddings = db_session.scalars(
        select(JobEmbedding).where(JobEmbedding.segmentation_id == seg.id)
    ).all()

    # Identify individual embedding types.
    full_jd_emb = next(e for e in embeddings if e.embedding_type == "full_jd")
    mand_emb = next(e for e in embeddings if e.embedding_type == "mandatory_requirement")
    pref_emb = next(e for e in embeddings if e.embedding_type == "preferred_requirement")

    # Verify full JD has requirement_id = None.
    assert full_jd_emb.requirement_id is None
    # Verify requirement embeddings link to appropriate requirement IDs.
    assert mand_emb.requirement_id == sample_job_data["req_mand"].id
    assert pref_emb.requirement_id == sample_job_data["req_pref"].id


def test_sha256_deduplication_and_reuse(db_session: Session, sample_job_data: dict):
    """Verify that identical text hashes skip API calls and reuse existing vectors."""
    seg = sample_job_data["approved_segmentation"]
    call_counter = {"count": 0}

    def counting_provider(text: str):
        call_counter["count"] += 1
        return make_mock_vector(2048, 0.02)

    # Initial generation: calls provider 3 times.
    res1 = generate_segmentation_embeddings(
        db=db_session,
        segmentation_id=seg.id,
        embedding_provider=counting_provider,
    )
    assert res1["generated_count"] == 3
    assert call_counter["count"] == 3

    # Subsequent generation with unchanged text: skips all 3 without calling provider.
    res2 = generate_segmentation_embeddings(
        db=db_session,
        segmentation_id=seg.id,
        embedding_provider=counting_provider,
    )
    assert res2["skipped_count"] == 3
    assert res2["generated_count"] == 0
    # Provider was not called again.
    assert call_counter["count"] == 3


def test_vector_validation_dimensions_and_finiteness():
    """Verify that validate_embedding_vector enforces dimensions, finite numbers, and rejects zero-vectors."""
    # Valid vector passes.
    valid = [0.1] * 2048
    validated = validate_embedding_vector(valid, dimensions=2048)
    assert len(validated) == 2048

    # Wrong dimension count raises ValueError.
    with pytest.raises(ValueError, match="does not match the expected dimensions"):
        validate_embedding_vector([0.1] * 1024, dimensions=2048)

    # All-zero vector raises ValueError.
    with pytest.raises(ValueError, match="must not be a zero vector"):
        validate_embedding_vector([0.0] * 2048, dimensions=2048)

    # NaN coordinates raise ValueError.
    with pytest.raises(ValueError, match="must be finite numbers"):
        nan_vec = [0.1] * 2047 + [float("nan")]
        validate_embedding_vector(nan_vec, dimensions=2048)

    # Infinite coordinates raise ValueError.
    with pytest.raises(ValueError, match="must be finite numbers"):
        inf_vec = [0.1] * 2047 + [float("inf")]
        validate_embedding_vector(inf_vec, dimensions=2048)


def test_openrouter_retry_handling():
    """Verify that generate_embedding retries transient 429/500 errors and succeeds upon recovery."""
    mock_response_fail = MagicMock()
    mock_response_fail.status_code = 429

    mock_response_ok = MagicMock()
    mock_response_ok.status_code = 200
    mock_response_ok.json.return_value = {
        "data": [{"embedding": [0.05] * 2048}]
    }

    # Simulate 1 transient rate limit failure followed by success on attempt 2.
    with patch("httpx.Client") as mock_client_cls, patch("time.sleep") as mock_sleep:
        client_instance = MagicMock()
        client_instance.post.side_effect = [mock_response_fail, mock_response_ok]
        mock_client_cls.return_value.__enter__.return_value = client_instance

        with patch("app.embedding_service.OPENROUTER_API_KEY", "test-api-key"):
            vector = generate_embedding("Sample text for embedding test", max_retries=3)
            assert len(vector) == 2048
            # Sleep was called for backoff.
            assert mock_sleep.called


def test_historical_segmentation_isolation(db_session: Session, sample_job_data: dict):
    """Verify that multiple segmentation versions for a job keep their embeddings strictly isolated."""
    job = sample_job_data["job"]
    seg_v1 = sample_job_data["approved_segmentation"]

    # Generate v1 embeddings.
    generate_segmentation_embeddings(
        db=db_session,
        segmentation_id=seg_v1.id,
        embedding_provider=lambda text: make_mock_vector(2048, 0.01),
    )

    # Create and approve a second version (v2).
    seg_v2 = JDSegmentation(
        job_id=job.id,
        version=2,
        status="approved",
        is_approved=1,
        approved_by="Principal Recruiter",
        job_overview="V2 Updated Overview",
        role_summary="V2 Role Summary",
    )
    db_session.add(seg_v2)
    db_session.flush()

    req_v2 = JobRequirement(
        segmentation_id=seg_v2.id,
        category="mandatory_skills",
        classification="Mandatory",
        original_text="V2 Mandatory skill requirement.",
        is_approved=1,
        order_index=0,
    )
    db_session.add(req_v2)
    db_session.commit()

    # Generate v2 embeddings.
    generate_segmentation_embeddings(
        db=db_session,
        segmentation_id=seg_v2.id,
        embedding_provider=lambda text: make_mock_vector(2048, 0.02),
    )

    # Verify v1 and v2 embeddings are preserved separately.
    v1_embs = db_session.scalars(
        select(JobEmbedding).where(JobEmbedding.segmentation_id == seg_v1.id)
    ).all()
    v2_embs = db_session.scalars(
        select(JobEmbedding).where(JobEmbedding.segmentation_id == seg_v2.id)
    ).all()

    assert len(v1_embs) == 3
    assert len(v2_embs) == 2
    # Check version lineage isolation.
    assert all(e.segmentation_id == seg_v1.id for e in v1_embs)
    assert all(e.segmentation_id == seg_v2.id for e in v2_embs)


def test_existing_candidate_embeddings_preservation(db_session: Session, sample_job_data: dict):
    """Verify that generating job embeddings does not touch or alter resume_embedding rows."""
    # Seed a candidate and resume with embedding.
    cand = Candidate(name="Existing Candidate", skills=["Python", "PostgreSQL"])
    db_session.add(cand)
    db_session.flush()

    resume = Resume(
        candidate_id=cand.id,
        source_filename="existing_resume.pdf",
        file_path="data/resumes/existing_resume.pdf",
        content_sha256="aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
    )
    db_session.add(resume)
    db_session.flush()

    cand_vector = make_mock_vector(2048, 0.77)
    res_emb = ResumeEmbedding(
        resume_id=resume.id,
        vector_id="sqlite-resume-test-1",
        collection_name="sqlite-local",
        model_name="nvidia/nemotron-3-embed-1b:free",
        dimensions=2048,
        embedding_vector=cand_vector,
        input_hash="11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff",
    )
    db_session.add(res_emb)
    db_session.commit()

    # Generate JD embeddings.
    generate_segmentation_embeddings(
        db=db_session,
        segmentation_id=sample_job_data["approved_segmentation"].id,
        embedding_provider=lambda text: make_mock_vector(2048, 0.05),
    )

    # Verify resume embedding is completely intact.
    persisted_cand_emb = db_session.get(ResumeEmbedding, res_emb.id)
    assert persisted_cand_emb is not None
    assert persisted_cand_emb.dimensions == 2048
    assert persisted_cand_emb.embedding_vector == cand_vector


def test_embedding_status_and_metadata_helpers(db_session: Session, sample_job_data: dict):
    """Verify get_job_embedding_status and get_job_embeddings_metadata output formatting."""
    job = sample_job_data["job"]
    seg = sample_job_data["approved_segmentation"]

    # Status before generation:
    status_before = get_job_embedding_status(db_session, job.id)
    assert status_before["has_embeddings"] is False
    assert status_before["total_embeddings"] == 0

    # Generate embeddings.
    generate_segmentation_embeddings(
        db=db_session,
        segmentation_id=seg.id,
        embedding_provider=lambda text: make_mock_vector(2048),
    )

    # Status after generation:
    status_after = get_job_embedding_status(db_session, job.id)
    assert status_after["has_embeddings"] is True
    assert status_after["is_complete"] is True
    assert status_after["total_embeddings"] == 3

    # Metadata listing omits raw coordinate arrays.
    metadata = get_job_embeddings_metadata(db_session, job.id)
    assert len(metadata) == 3
    for item in metadata:
        assert "embedding_vector" not in item
        assert "dimensions" in item
        assert item["dimensions"] == 2048
        assert "input_hash" in item


def test_api_endpoints_generate_status_metadata():
    """Verify FastAPI routes for generate, status, and list embeddings."""
    # Import FastAPI TestClient and main application.
    from fastapi.testclient import TestClient
    from app.main import app
    from database.sqlite_connection import SessionLocal

    # Create test client for testing registered routes.
    client = TestClient(app)

    # Use database session to identify an existing job with an active approved segmentation.
    session = SessionLocal()
    try:
        # Find active approved segmentation for a job.
        all_jobs = session.scalars(select(Job)).all()
        active_seg = None
        for j in all_jobs:
            active_seg = get_active_approved_segmentation(session, j.id)
            if active_seg:
                break
        assert active_seg is not None, "Precondition failed: at least one approved segmentation must exist."
        job_id = active_seg.job_id
        seg_id = active_seg.id
    finally:
        session.close()

    # Mock the OpenRouter API generator call.
    with patch("app.services.jd_embedding_service.generate_embedding", return_value=make_mock_vector(2048, 0.03)):
        # 1. Test POST generate embeddings endpoint for active approved segmentation.
        gen_res = client.post(
            f"/api/jobs/{job_id}/embeddings/generate",
            json={"segmentation_id": seg_id, "force": True},
        )
        assert gen_res.status_code == 200
        gen_data = gen_res.json()
        assert gen_data["status"] == "success"
        assert gen_data["total_items"] > 0
        assert "embeddings" in gen_data

        # 2. Test GET embeddings status endpoint.
        status_res = client.get(f"/api/jobs/{job_id}/embeddings/status")
        assert status_res.status_code == 200
        status_data = status_res.json()
        assert status_data["has_approved_segmentation"] is True
        assert status_data["has_embeddings"] is True
        assert status_data["total_embeddings"] > 0
        assert status_data["dimensions"] == 2048

        # 3. Test GET embeddings metadata endpoint.
        meta_res = client.get(f"/api/jobs/{job_id}/embeddings")
        assert meta_res.status_code == 200
        meta_list = meta_res.json()
        assert isinstance(meta_list, list)
        assert len(meta_list) > 0
        for item in meta_list:
            # Confirm raw vector coordinates are strictly hidden from responses.
            assert "embedding_vector" not in item
            assert item["dimensions"] == 2048
            assert "input_hash" in item


def test_partial_unique_index_enforcement(db_session):
    """Verify that SQLite partial unique indexes strictly reject duplicate requirement and full JD embeddings."""
    from sqlalchemy.exc import IntegrityError

    # 1. Setup minimal Job, JDSegmentation, and JobRequirement.
    job = Job(
        title="Database Integrity Lead",
        description="Lead database integrity verification and testing.",
        client_name="Fintech Corp",
    )
    db_session.add(job)
    db_session.commit()

    seg = JDSegmentation(job_id=job.id, version=1, status="approved", is_approved=1)
    db_session.add(seg)
    db_session.commit()

    req = JobRequirement(segmentation_id=seg.id, category="mandatory_skills", classification="Mandatory", original_text="SQL Mastery")
    db_session.add(req)
    db_session.commit()

    # 2. Insert valid requirement embedding.
    vec1 = make_mock_vector(2048, 0.1)
    e1 = JobEmbedding(
        job_id=job.id,
        segmentation_id=seg.id,
        requirement_id=req.id,
        embedding_type="mandatory_requirement",
        input_hash="a" * 64,
        model_name=OPENROUTER_EMBEDDING_MODEL,
        dimensions=2048,
        embedding_vector=vec1,
    )
    db_session.add(e1)
    db_session.commit()

    # 3. Attempt duplicate requirement embedding (same segmentation_id and requirement_id).
    e2 = JobEmbedding(
        job_id=job.id,
        segmentation_id=seg.id,
        requirement_id=req.id,
        embedding_type="mandatory_requirement",
        input_hash="b" * 64,
        model_name=OPENROUTER_EMBEDDING_MODEL,
        dimensions=2048,
        embedding_vector=vec1,
    )
    db_session.add(e2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    # 4. Insert valid full JD embedding (requirement_id is None).
    f1 = JobEmbedding(
        job_id=job.id,
        segmentation_id=seg.id,
        requirement_id=None,
        embedding_type="full_jd",
        input_hash="c" * 64,
        model_name=OPENROUTER_EMBEDDING_MODEL,
        dimensions=2048,
        embedding_vector=vec1,
    )
    db_session.add(f1)
    db_session.commit()

    # 5. Attempt duplicate full JD embedding (same segmentation_id and NULL requirement_id).
    f2 = JobEmbedding(
        job_id=job.id,
        segmentation_id=seg.id,
        requirement_id=None,
        embedding_type="full_jd",
        input_hash="d" * 64,
        model_name=OPENROUTER_EMBEDDING_MODEL,
        dimensions=2048,
        embedding_vector=vec1,
    )
    db_session.add(f2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_migration_idempotency_and_safe_rollback(db_session):
    """Verify that partial unique index migration is idempotent and can be cleanly rolled back."""
    from database.sqlite_migrations import migrate_job_embedding_uniqueness, rollback_job_embedding_uniqueness

    # Retrieve low-level connection handle.
    connection = db_session.connection()

    # 1. Execute migration: creates indexes.
    idx1 = migrate_job_embedding_uniqueness(connection)
    assert len(idx1) == 2

    # 2. Execute migration again: idempotent run changes nothing and does not crash.
    idx2 = migrate_job_embedding_uniqueness(connection)
    assert len(idx2) == 2

    # 3. Rollback migration: drops indexes cleanly.
    dropped = rollback_job_embedding_uniqueness(connection)
    assert len(dropped) == 2

    # 4. Re-apply migration to restore indexes.
    reapplied = migrate_job_embedding_uniqueness(connection)
    assert len(reapplied) == 2


def test_strict_completeness_validation_detects_all_anomalies(db_session):
    """Verify get_job_embedding_status detects missing full JD, missing reqs, duplicates, invalid models, and stale hashes."""
    # Create baseline job, approved segmentation, and two requirements.
    job = Job(title="Systems Architect", description="Architect scalable systems with Kubernetes and Go.")
    db_session.add(job)
    db_session.commit()

    seg = JDSegmentation(job_id=job.id, version=1, status="approved", is_approved=1, job_overview="Architect scalable systems")
    db_session.add(seg)
    db_session.commit()

    r1 = JobRequirement(segmentation_id=seg.id, category="mandatory_skills", classification="Mandatory", original_text="Kubernetes expert")
    r2 = JobRequirement(segmentation_id=seg.id, category="preferred_skills", classification="Preferred", original_text="Go programming")
    db_session.add_all([r1, r2])
    db_session.commit()

    # Case 1: Zero embeddings stored -> pending, incomplete.
    s1 = get_job_embedding_status(db_session, job.id)
    assert s1["is_complete"] is False
    assert s1["status"] == "pending"
    assert s1["has_full_jd_embedding"] is False
    assert len(s1["missing_requirement_ids"]) == 2

    # Case 2: Only requirement 1 embedded -> partial, incomplete.
    vec = make_mock_vector(2048, 0.05)
    r1_text = build_requirement_embedding_text(r1)
    r1_hash = compute_text_sha256(r1_text)
    db_session.add(JobEmbedding(
        job_id=job.id,
        segmentation_id=seg.id,
        requirement_id=r1.id,
        embedding_type="mandatory_requirement",
        input_hash=r1_hash,
        model_name=OPENROUTER_EMBEDDING_MODEL,
        dimensions=2048,
        embedding_vector=vec,
    ))
    db_session.commit()
    s2 = get_job_embedding_status(db_session, job.id)
    assert s2["is_complete"] is False
    assert s2["has_full_jd_embedding"] is False
    assert s2["missing_requirement_ids"] == [r2.id]

    # Case 3: Add full JD and requirement 2 with correct hashes -> complete, ready!
    full_text = build_full_jd_embedding_text(job, seg)
    full_hash = compute_text_sha256(full_text)
    r2_text = build_requirement_embedding_text(r2)
    r2_hash = compute_text_sha256(r2_text)

    db_session.add(JobEmbedding(
        job_id=job.id,
        segmentation_id=seg.id,
        requirement_id=None,
        embedding_type="full_jd",
        input_hash=full_hash,
        model_name=OPENROUTER_EMBEDDING_MODEL,
        dimensions=2048,
        embedding_vector=vec,
    ))
    db_session.add(JobEmbedding(
        job_id=job.id,
        segmentation_id=seg.id,
        requirement_id=r2.id,
        embedding_type="preferred_requirement",
        input_hash=r2_hash,
        model_name=OPENROUTER_EMBEDDING_MODEL,
        dimensions=2048,
        embedding_vector=vec,
    ))
    db_session.commit()

    s3 = get_job_embedding_status(db_session, job.id)
    assert s3["is_complete"] is True
    assert s3["status"] == "ready"
    assert s3["has_full_jd_embedding"] is True
    assert len(s3["missing_requirement_ids"]) == 0
    assert s3["stale_count"] == 0

    # Case 4: Simulate stale hash by altering requirement text (invalidates both requirement and full JD hashes).
    r1.original_text = "Modified Kubernetes text that alters hash"
    db_session.commit()
    s4 = get_job_embedding_status(db_session, job.id)
    assert s4["is_complete"] is False
    assert s4["stale_count"] >= 1
    stale_req_ids = [item.get("requirement_id") for item in s4["stale_embeddings"]]
    assert r1.id in stale_req_ids

    # Restore requirement text.
    r1.original_text = "Kubernetes expert"
    db_session.commit()

    # Case 5: Missing approved segmentation.
    seg.is_approved = 0
    seg.status = "review_pending"
    db_session.commit()
    s5 = get_job_embedding_status(db_session, job.id)
    assert s5["has_approved_segmentation"] is False
    assert s5["is_complete"] is False
    assert s5["status"] == "no_approved_segmentation"


def test_candidate_embedding_service_coverage_and_backfill(db_session):
    """Verify candidate embedding coverage audit and batch backfill service."""
    from app.services.candidate_embedding_service import (
        get_candidate_embedding_coverage,
        get_missing_candidate_embeddings,
        backfill_candidate_embeddings,
        get_backfill_status,
    )

    # 1. Create candidate and resume.
    cand = Candidate(name="Alice Developer", email="alice@test.example", skills=["Python", "FastAPI"])
    db_session.add(cand)
    db_session.commit()

    resume = Resume(
        candidate_id=cand.id,
        source_filename="alice_resume.pdf",
        file_path="C:/tmp/mock_alice_resume.pdf",
        content_sha256="12345" * 12 + "1234",
    )
    db_session.add(resume)
    db_session.commit()

    # 2. Check coverage: 1 resume missing embedding.
    cov = get_candidate_embedding_coverage(db_session)
    assert cov["total_candidates"] >= 1
    assert cov["total_resumes"] >= 1
    assert cov["missing_embeddings"] >= 1

    # 3. Check missing descriptors.
    missing = get_missing_candidate_embeddings(db_session, limit=10)
    assert any(m["resume_id"] == resume.id for m in missing)

    # 4. Mock provider and run backfill.
    mock_provider = MagicMock(return_value=make_mock_vector(2048, 0.08))
    mock_provider.model_name = OPENROUTER_EMBEDDING_MODEL

    bf_result = backfill_candidate_embeddings(db_session, batch_size=5, embedding_provider=mock_provider)
    assert bf_result["status"] in ("completed", "partial")
    assert bf_result["generated_count"] >= 1

    # 5. Verify coverage is now complete.
    cov_after = get_candidate_embedding_coverage(db_session)
    assert cov_after["missing_embeddings"] == 0
    assert cov_after["is_complete"] is True

    # 6. Verify backfill status tracking.
    status = get_backfill_status(db_session)
    assert status["status"] in ("completed", "partial")
    assert status["remaining_missing"] == 0


def test_candidate_embedding_api_endpoints():
    """Verify FastAPI routes for candidate embedding coverage, missing, backfill, and status."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)

    # 1. GET /api/candidates/embeddings/coverage.
    r_cov = client.get("/api/candidates/embeddings/coverage")
    assert r_cov.status_code == 200
    cov_data = r_cov.json()
    assert "total_candidates" in cov_data
    assert "total_resumes" in cov_data
    assert "coverage_percentage" in cov_data
    assert cov_data["configured_dimensions"] == 2048

    # 2. GET /api/candidates/embeddings/missing.
    r_miss = client.get("/api/candidates/embeddings/missing?limit=10")
    assert r_miss.status_code == 200
    miss_list = r_miss.json()
    assert isinstance(miss_list, list)
    for m in miss_list:
        assert "embedding_vector" not in m
        assert "resume_id" in m

    # 3. GET /api/candidates/embeddings/backfill/status.
    r_stat = client.get("/api/candidates/embeddings/backfill/status")
    assert r_stat.status_code == 200
    stat_data = r_stat.json()
    assert "status" in stat_data
    assert "remaining_missing" in stat_data

    # 4. POST /api/candidates/embeddings/backfill with mocked provider.
    with patch("app.services.candidate_embedding_service.generate_embedding", return_value=make_mock_vector(2048, 0.04)):
        r_bf = client.post("/api/candidates/embeddings/backfill", json={"batch_size": 10, "force": False})
        assert r_bf.status_code == 200
        bf_data = r_bf.json()
        assert "status" in bf_data
        assert "processed_count" in bf_data
        assert "generated_count" in bf_data
        assert "reused_count" in bf_data
        assert "embedding_vector" not in bf_data

