"""Focused tests for the initial CompanyAI SQLAlchemy model set."""

# Import UTC-aware time support for created test records.
from datetime import datetime, timezone

# Import SQLAlchemy helpers for isolated schemas and sessions.
from sqlalchemy import create_engine, event, inspect

# Import URL to create a temporary SQLite database path safely.
from sqlalchemy.engine import URL

# Import IntegrityError to verify SQLite enforces declared foreign keys.
from sqlalchemy.exc import IntegrityError

# Import Session for test-local ORM transactions.
from sqlalchemy.orm import Session

# Import pytest for isolated database fixtures and expected errors.
import pytest

# Import the six model classes so their tables register on the shared Base.
from database.models import Candidate, ImportBatch, JDAnalysis, JobDescription, Resume, ResumeEmbedding

# Import the single declarative Base required for all SQLite models.
from database.sqlite_connection import Base, SQLITE_CONNECT_ARGS, _enable_sqlite_foreign_keys


# Create an isolated temporary SQLite database and all registered model tables.
@pytest.fixture
def model_database(tmp_path):
    """Return a temporary engine and ORM session without touching production data."""

    # Build a new database path under pytest's temporary directory.
    database_path = tmp_path / "models-test.db"

    # Create a SQLite engine that mirrors the production thread configuration.
    engine = create_engine(
        URL.create("sqlite", database=str(database_path)),
        connect_args=SQLITE_CONNECT_ARGS,
    )

    # Enable SQLite foreign-key enforcement on this isolated test engine.
    event.listen(engine, "connect", _enable_sqlite_foreign_keys)

    # Create only the six tables registered on the existing SQLite Base.
    Base.metadata.create_all(engine)

    # Open one ORM session scoped to this temporary database.
    database_session = Session(engine)

    # Yield the temporary resources to the focused model tests.
    yield engine, database_session

    # Close the test session after each test completes.
    database_session.close()

    # Dispose of the temporary engine and its file handles.
    engine.dispose()


# Verify all ten SQLite model tables are created in an isolated database.
def test_model_tables_are_created(model_database) -> None:
    """Create candidate, resume, ingestion, job, request, activity, JD, analysis, and batch tables."""

    # Read the isolated engine from the fixture.
    engine, _ = model_database

    # Compare actual table names with all registered SQLite models.
    assert set(inspect(engine).get_table_names()) == {
        "candidate",
        "resume",
        "resume_embedding",
        "job_description",
        "jd_analysis",
        "import_batch",
        "resume_ingestion_status",
        "job",
        "recruitment_request",
        "activity_event",
        "interview",  # Include the existing interview workflow table.
        "approval_request",  # Include the existing approval workflow table.
        "agent_trace",  # Include existing agent execution telemetry storage.
        "jd_segmentation",  # Include Phase 3 JD segmentation table.
        "job_requirement",  # Include Phase 3 granular recruitment requirement table.
        "job_embedding",  # Include Phase 5B job embedding table.
        "job_posting",  # Section 5 Job Posting table.
        "job_posting_version",  # Section 5 Job Posting Version table.
        "job_posting_metrics",  # Section 5 Job Posting Metrics table.
        "job_posting_activity",  # Section 5 Job Posting Activity table.
        "interview_kit",  # AI Interview Kit table.
        "boolean_search_history",
        "candidate_job_match_result",
    }


# Verify candidate-to-resume and resume-to-embedding relationships with basic inserts.
def test_candidate_resume_embedding_relationships_round_trip(model_database) -> None:
    """Persist a candidate, two resumes, and one embedding reference for a resume."""

    # Read the isolated ORM session from the fixture.
    _, database_session = model_database

    # Create a candidate with JSON-compatible extracted skills.
    candidate = Candidate(name="Synthetic Candidate", skills=["Python", "SQL"])

    # Create two source-file metadata records for the same candidate.
    first_resume = Resume(
        source_filename="resume-one.pdf",
        file_path="data/resumes/resume-one.pdf",
        content_sha256="a" * 64,
    )

    # Create a second resume without creating a second candidate.
    second_resume = Resume(
        source_filename="resume-two.docx",
        file_path="data/resumes/resume-two.docx",
        content_sha256="b" * 64,
    )

    # Attach both resumes through the candidate relationship.
    candidate.resumes.extend([first_resume, second_resume])

    # Create metadata for an external ChromaDB vector without storing vector values.
    first_resume.embedding = ResumeEmbedding(
        vector_id="synthetic-vector-001",
        collection_name="resume-profiles",
        model_name="synthetic-embedding-model",
        dimensions=384,
        embedding_metadata={"source": "mock"},
    )

    # Add the candidate graph and persist it to the isolated database.
    database_session.add(candidate)
    database_session.commit()

    # Refresh objects so relationship assertions use persisted database rows.
    database_session.refresh(candidate)
    database_session.refresh(first_resume)

    # Confirm the candidate has two resumes and both resume rows point back correctly.
    assert len(candidate.resumes) == 2
    assert first_resume.candidate_id == candidate.id
    assert second_resume.candidate_id == candidate.id

    # Confirm exactly one embedding reference is associated with the first resume.
    assert first_resume.embedding is not None
    assert first_resume.embedding.vector_id == "synthetic-vector-001"

    # Confirm extracted skills round-trip as JSON without vector arrays.
    assert candidate.skills == ["Python", "SQL"]
    assert first_resume.embedding.embedding_metadata == {"source": "mock"}


# Verify structured JD requirements and import-batch metadata can be inserted.
def test_job_description_analysis_and_import_batch_round_trip(model_database) -> None:
    """Persist a JD, evidence-linked JSON analysis, and a small import record."""

    # Read the isolated ORM session from the fixture.
    _, database_session = model_database

    # Create a job description containing only synthetic source content.
    job_description = JobDescription(
        jd_id="SYNTH-JD-001",
        title="Software Engineer",
        source_filename="synthetic-jd.txt",
        source_path="data/jds/synthetic-jd.txt",
        content_sha256="c" * 64,
        original_text="Synthetic job description text.",
    )

    # Attach structured requirements without changing the original source text.
    job_description.analyses.append(
        JDAnalysis(
            requirements={"required_skills": [{"value": "Python", "evidence": {"source_line": 1}}]},
            model_name="synthetic-model",
            analyzed_at=datetime.now(timezone.utc),
        )
    )

    # Create a simple completed batch record for the synthetic JD import.
    import_batch = ImportBatch(
        import_type="job_description",
        source_filename="synthetic-jd.txt",
        status="completed",
        record_count=1,
    )

    # Persist the JD relationship graph and the independent batch record.
    database_session.add_all([job_description, import_batch])
    database_session.commit()

    # Refresh the JD object to verify values after a database round trip.
    database_session.refresh(job_description)

    # Confirm analysis requirements remain JSON-compatible and linked to the JD.
    assert len(job_description.analyses) == 1
    assert job_description.analyses[0].requirements["required_skills"][0]["value"] == "Python"
    assert job_description.analyses[0].job_description_id == job_description.id

    # Confirm the import batch received its primary key and stored its record count.
    assert import_batch.id is not None
    assert import_batch.record_count == 1


# Verify the SQLite schema rejects rows that reference a missing parent record.
def test_model_foreign_keys_are_enforced(model_database) -> None:
    """Prevent a resume from being stored without a real candidate row."""

    # Read the isolated ORM session from the fixture.
    _, database_session = model_database

    # Build a resume that points at a candidate ID absent from this database.
    orphan_resume = Resume(
        candidate_id=999,
        source_filename="orphan.pdf",
        file_path="data/resumes/orphan.pdf",
        content_sha256="d" * 64,
    )

    # Confirm the enabled SQLite foreign-key constraint rejects the orphan row.
    database_session.add(orphan_resume)
    with pytest.raises(IntegrityError):
        database_session.commit()

    # Roll back the failed transaction so the fixture can close cleanly.
    database_session.rollback()
