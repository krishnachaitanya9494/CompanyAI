# Import math to generate finite synthetic values for vector validation tests.
import math
# Import pytest for temporary paths and parameterized validation cases.
import pytest
# Import SQLAlchemy engine helpers for an isolated SQLite database.
from sqlalchemy import create_engine, event, select
# Import URL to construct a safe temporary SQLite connection URL.
from sqlalchemy.engine import URL
# Import IntegrityError to verify the database's one-embedding-per-resume constraint.
from sqlalchemy.exc import IntegrityError
# Import Session for explicit test-owned transaction management.
from sqlalchemy.orm import Session
# Import the existing models to register their tables on the shared Base.
from database.models import Candidate, Resume, ResumeEmbedding
# Import the embedding storage and validation functions under test.
from database.embedding_storage import store_resume_embedding, validate_embedding_vector
# Import the existing Base and foreign-key event listener for the isolated engine.
from database.sqlite_connection import Base, SQLITE_CONNECT_ARGS, _enable_sqlite_foreign_keys


# Create a temporary schema and one valid synthetic resume for each test.
@pytest.fixture
def embedding_session(tmp_path):
    # Place the test database under pytest's temporary directory, never production data.
    database_path = tmp_path / "embedding-storage-test.db"
    # Create an isolated SQLite engine with the same thread behavior as production.
    engine = create_engine(
        URL.create("sqlite", database=str(database_path)),
        connect_args=SQLITE_CONNECT_ARGS,
    )
    # Enable the same foreign-key enforcement used by the production engine.
    event.listen(engine, "connect", _enable_sqlite_foreign_keys)
    # Create all current project model tables only in this temporary database.
    Base.metadata.create_all(engine)
    # Open the session that each test will use and manage explicitly.
    session = Session(engine)
    # Insert a synthetic candidate and resume to provide a real parent row.
    candidate = Candidate(name="Synthetic Candidate", skills=["Python"])
    resume = Resume(
        source_filename="synthetic-resume.txt",
        file_path="temporary/synthetic-resume.txt",
        content_sha256="a" * 64,
    )
    # Persist the parent records and expose the generated resume identifier.
    candidate.resumes.append(resume)
    session.add(candidate)
    session.commit()
    # Yield the isolated session and resume ID to the test body.
    yield session, resume.id
    # Close the session and engine after the test without touching production storage.
    session.close()
    engine.dispose()


# Verify a full-size vector round-trips through SQLAlchemy as a Python float list.
def test_2048_dimensional_vector_round_trips(embedding_session):
    # Read the temporary session and its existing synthetic resume identifier.
    session, resume_id = embedding_session
    # Build 2048 finite synthetic values without calling an embedding API.
    vector = [float(index + 1) / 2048 for index in range(2048)]
    # Store the vector with cache metadata and the expected embedding dimension.
    record = store_resume_embedding(
        session,
        resume_id,
        vector,
        dimensions=2048,
        input_hash="b" * 64,
        requested_model="synthetic-embedding-model",
        returned_model="synthetic-provider-model",
        preprocessing_version="text-v1",
        metadata={"source": "unit-test", "retained": "yes"},
    )
    # Commit through the test-owned transaction after the storage helper flushes.
    session.commit()
    # Expire the identity map so the assertion reads the persisted JSON value.
    session.expire_all()
    # Load the row again through the existing one-to-one relationship.
    stored_record = session.scalar(
        select(ResumeEmbedding).where(ResumeEmbedding.resume_id == resume_id)
    )
    # Confirm the field is a Python list containing all 2048 float coordinates.
    assert isinstance(stored_record.embedding_vector, list)
    assert stored_record.embedding_vector == vector
    assert len(stored_record.embedding_vector) == 2048
    # Confirm the actual dimensions and cache metadata were stored as requested.
    assert stored_record.dimensions == 2048
    assert stored_record.input_hash == "b" * 64
    assert stored_record.requested_model == "synthetic-embedding-model"
    assert stored_record.returned_model == "synthetic-provider-model"
    assert stored_record.preprocessing_version == "text-v1"
    # Confirm legacy reference fields remain populated for compatibility.
    assert stored_record.vector_id == f"sqlite-resume-{resume_id}"
    assert stored_record.collection_name == "sqlite-local"
    assert stored_record.model_name == "synthetic-embedding-model"
    # Confirm metadata not related to vector values persists unchanged.
    assert stored_record.embedding_metadata == {"source": "unit-test", "retained": "yes"}
    # Confirm the returned ORM object is the same attached row used by the session.
    assert record.id == stored_record.id


# Verify the database still enforces one embedding row for each resume.
def test_resume_has_only_one_embedding_record(embedding_session):
    # Read the isolated session and parent resume identifier.
    session, resume_id = embedding_session
    # Create the first valid record through the supported storage service.
    store_resume_embedding(session, resume_id, [1.0, 2.0], requested_model="model-a")
    # Commit the first row so the database uniqueness constraint is active.
    session.commit()
    # Build a second row that violates the preserved unique resume_id constraint.
    duplicate_record = ResumeEmbedding(
        resume_id=resume_id,
        vector_id="duplicate-vector",
        collection_name="sqlite-local",
        model_name="model-a",
        embedding_vector=[2.0, 3.0],
        dimensions=2,
        embedding_metadata={},
    )
    # Confirm SQLite rejects the duplicate and the existing row remains the only record.
    session.add(duplicate_record)
    with pytest.raises(IntegrityError):
        session.commit()
    # Roll back only the failed test transaction and count the persisted embedding rows.
    session.rollback()
    assert len(session.scalars(select(ResumeEmbedding)).all()) == 1


# Verify a valid embedding update replaces the vector without creating another row.
def test_existing_embedding_can_be_updated(embedding_session):
    # Read the test session and resume identifier.
    session, resume_id = embedding_session
    # Create and commit the original synthetic vector.
    original = store_resume_embedding(session, resume_id, [1.0, 2.0], requested_model="model-a")
    session.commit()
    # Update the existing row with a different valid vector and model.
    updated = store_resume_embedding(
        session,
        resume_id,
        [3.0, 4.0, 5.0],
        requested_model="model-b",
    )
    # Commit the update using the caller's transaction.
    session.commit()
    # Confirm the row identity is stable and the stored vector and dimensions changed.
    assert updated.id == original.id
    assert updated.embedding_vector == [3.0, 4.0, 5.0]
    assert updated.dimensions == 3
    assert updated.requested_model == "model-b"
    assert updated.model_name == "model-b"


# Verify a missing resume is rejected before an embedding record can be created.
def test_missing_resume_is_rejected(embedding_session):
    # Read the temporary test session without using its valid resume identifier.
    session, _ = embedding_session
    # Require a lookup error for a parent ID absent from this isolated database.
    with pytest.raises(LookupError, match="resume that does not exist"):
        store_resume_embedding(session, 99999, [1.0, 2.0])
    # Confirm the rejected operation left the embedding table empty.
    assert session.scalar(select(ResumeEmbedding)) is None


# Verify invalid vector conditions are rejected by the shared validation helper.
@pytest.mark.parametrize(
    ("vector", "dimensions", "message"),
    [
        ([], None, "must not be empty"),
        ([0.0, 0.0], None, "zero vector"),
        ([1.0, 2.0], 3, "expected dimensions"),
        ([1.0, math.nan], None, "finite numbers"),
        ([1.0, math.inf], None, "finite numbers"),
        ([1.0, -math.inf], None, "finite numbers"),
        ([1.0, True], None, "numeric"),
    ],
)
def test_invalid_vectors_are_rejected(vector, dimensions, message):
    # Assert each malformed synthetic vector fails before it can be stored.
    with pytest.raises(ValueError, match=message):
        validate_embedding_vector(vector, dimensions)


# Verify an invalid update cannot replace a previously committed valid vector.
def test_invalid_update_does_not_overwrite_existing_vector(embedding_session):
    # Read the temporary session and resume identifier.
    session, resume_id = embedding_session
    # Store and commit one known-valid vector as the baseline.
    store_resume_embedding(session, resume_id, [1.0, 2.0], requested_model="model-a")
    session.commit()
    # Reject the all-zero update before any ORM field is changed.
    with pytest.raises(ValueError, match="zero vector"):
        store_resume_embedding(session, resume_id, [0.0, 0.0], requested_model="model-b")
    # Refresh the row from SQLite and confirm its original values remain intact.
    session.expire_all()
    stored_record = session.scalar(
        select(ResumeEmbedding).where(ResumeEmbedding.resume_id == resume_id)
    )
    assert stored_record.embedding_vector == [1.0, 2.0]
    assert stored_record.requested_model == "model-a"


# Verify metadata updates preserve keys that the caller did not replace.
def test_metadata_update_preserves_unspecified_keys(embedding_session):
    # Read the temporary session and resume identifier.
    session, resume_id = embedding_session
    # Store initial metadata containing two independently useful values.
    store_resume_embedding(
        session,
        resume_id,
        [1.0, 2.0],
        metadata={"source": "initial", "reviewed": True},
    )
    session.commit()
    # Update only the source key while leaving the reviewed key unspecified.
    updated = store_resume_embedding(
        session,
        resume_id,
        [2.0, 3.0],
        metadata={"source": "updated"},
    )
    # Confirm merge behavior retains the unrelated metadata key.
    assert updated.embedding_metadata == {"source": "updated", "reviewed": True}


# Verify an existing reference-only row remains readable with a null vector.
def test_reference_only_embedding_with_null_vector_remains_readable(embedding_session):
    # Read the temporary session and existing resume identifier.
    session, resume_id = embedding_session
    # Insert a legacy row with its former Chroma references and no local vector.
    legacy_record = ResumeEmbedding(
        resume_id=resume_id,
        vector_id="legacy-chroma-vector",
        collection_name="resume-profiles",
        model_name="legacy-embedding-model",
        dimensions=2048,
        embedding_metadata={"source": "legacy"},
        embedding_vector=None,
    )
    # Commit the legacy record through the test-owned SQLAlchemy session.
    session.add(legacy_record)
    session.commit()
    # Refresh the row and confirm the null vector and old reference fields remain intact.
    session.refresh(legacy_record)
    assert legacy_record.embedding_vector is None
    assert legacy_record.vector_id == "legacy-chroma-vector"
    assert legacy_record.collection_name == "resume-profiles"
    assert legacy_record.model_name == "legacy-embedding-model"
    assert legacy_record.dimensions == 2048
    assert legacy_record.embedding_metadata == {"source": "legacy"}
