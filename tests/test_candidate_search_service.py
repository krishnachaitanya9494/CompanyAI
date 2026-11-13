# Import the embedding record for controlled malformed-row fixtures.
from database.models import Candidate, Resume, ResumeEmbedding
# Import the service entry point under test.
from app.candidate_search_service import search_candidates
# Import pytest and SQLAlchemy helpers for isolated test databases.
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.engine import URL
from sqlalchemy.orm import Session
# Import the shared SQLite schema and foreign-key setup.
from database.sqlite_connection import Base, SQLITE_CONNECT_ARGS, _enable_sqlite_foreign_keys


# Build an isolated SQLite schema for each semantic search test.
@pytest.fixture
def search_db(tmp_path):
    # Place this test database under pytest's temporary directory.
    engine = create_engine(URL.create("sqlite", database=str(tmp_path / "search.db")), connect_args=SQLITE_CONNECT_ARGS)
    # Apply the same SQLite foreign-key behavior as the application engine.
    from sqlalchemy import event
    event.listen(engine, "connect", _enable_sqlite_foreign_keys)
    # Create project tables only inside the temporary database.
    Base.metadata.create_all(engine)
    # Open a session whose transaction remains owned by the test.
    session = Session(engine)
    # Yield the session and dispose of both resources after each test.
    yield session
    session.close()
    engine.dispose()


# Insert a candidate and any requested independently embedded resumes.
def add_candidate(session, vectors, name="Asha", skills=None):
    # Create one candidate record with the caller's synthetic skills.
    candidate = Candidate(name=name, skills=skills or ["Python"])
    # Add a distinct resume row for each supplied vector.
    for index, vector in enumerate(vectors):
        # Give each synthetic resume a unique digest and source filename.
        resume = Resume(source_filename=f"resume-{index}.txt", file_path=f"/tmp/resume-{index}.txt", content_sha256=f"{session.query(Resume).count() + 1:064x}")
        # Attach the resume to its candidate before flushing for its generated ID.
        candidate.resumes.append(resume)
        session.add(candidate)
        session.flush()
        # Store the vector and matching model metadata directly as fixture data.
        session.add(ResumeEmbedding(resume_id=resume.id, vector_id=f"vector-{resume.id}", collection_name="sqlite-local", model_name="test-model", requested_model="test-model", dimensions=len(vector), embedding_vector=vector, generation_method="nemotron_api", embedding_metadata={}))
    # Flush all fixture records so subsequent service selects can see them.
    session.flush()
    # Return the candidate ID for result assertions.
    return candidate.id


# Provide a callable embedding mock that advertises compatibility metadata.
class MockProvider:
    # Identify the synthetic model used by all vectors in this test module.
    model_name = "test-model"
    # Save a vector and call count for deterministic API-call assertions.
    def __init__(self, vector):
        self.vector = vector
        self.calls = 0
    # Return a fresh vector while recording each provider invocation.
    def __call__(self, text):
        self.calls += 1
        return list(self.vector)


# Confirm the service ranks resumes and returns the requested candidate details.
def test_successful_search_ranks_results_and_returns_candidate_fields(search_db):
    # Add two candidates whose resume vectors have distinct query alignment.
    add_candidate(search_db, [[0.0, 1.0]], name="Bea", skills=["Java"])
    add_candidate(search_db, [[1.0, 0.0]], name="Asha", skills=["Python", "SQL"])
    # Search with a synthetic query embedding and request both matches.
    results = search_candidates("python backend", search_db, MockProvider([1.0, 0.0]), limit=2)
    # Confirm descending scores and complete candidate/resume result data.
    assert [item.candidate_name for item in results] == ["Asha", "Bea"]
    assert results[0].skills == ["Python", "SQL"]
    assert results[0].similarity == pytest.approx(1.0)
    assert results[0].resume_id > 0


# Confirm multiple resumes from one candidate remain separate ranked results.
def test_multiple_resumes_are_ranked_independently(search_db):
    # Add two differently aligned resumes to the same candidate.
    candidate_id = add_candidate(search_db, [[1.0, 0.0], [0.0, 1.0]])
    # Search across both resume records without candidate-level aggregation.
    results = search_candidates("python", search_db, MockProvider([1.0, 0.0]))
    # Require two rows with the same candidate ID and distinct resume IDs/scores.
    assert [item.candidate_id for item in results] == [candidate_id, candidate_id]
    assert results[0].resume_id != results[1].resume_id
    assert [item.similarity for item in results] == pytest.approx([1.0, 0.0])


# Confirm empty queries fail before asking the embedding provider for a vector.
def test_empty_query_does_not_call_provider(search_db):
    # Create a provider whose call count exposes unintended API work.
    provider = MockProvider([1.0, 0.0])
    # Reject whitespace-only query content without calling the provider.
    with pytest.raises(ValueError, match="must not be empty"):
        search_candidates("  ", search_db, provider)
    assert provider.calls == 0


# Confirm an empty database returns immediately without an embedding call.
def test_empty_database_does_not_call_provider(search_db):
    # Create a provider whose call count exposes unnecessary API work.
    provider = MockProvider([1.0, 0.0])
    # Return an empty result set without generating a query embedding.
    assert search_candidates("python", search_db, provider) == []
    assert provider.calls == 0


# Confirm resume rows without embeddings are skipped before provider invocation.
def test_missing_embeddings_are_skipped_without_provider_call(search_db):
    # Add a candidate and resume without creating a ResumeEmbedding record.
    candidate = Candidate(name="No Vector", skills=[])
    candidate.resumes.append(Resume(source_filename="empty.txt", file_path="empty.txt", content_sha256="a" * 64))
    search_db.add(candidate)
    search_db.flush()
    # Track calls while asking the service to search an embedding-free database.
    provider = MockProvider([1.0, 0.0])
    assert search_candidates("python", search_db, provider) == []
    assert provider.calls == 0


# Confirm query and stored vector dimensions must match explicitly.
def test_dimension_mismatch_is_reported(search_db):
    # Store one valid two-dimensional resume vector.
    add_candidate(search_db, [[1.0, 0.0]])
    # Return a three-dimensional query vector and require a compatibility error.
    with pytest.raises(ValueError, match="dimension"):
        search_candidates("python", search_db, MockProvider([1.0, 0.0, 0.0]))


# Confirm model incompatibility is reported before ranking vectors.
def test_model_mismatch_is_reported(search_db):
    # Store one resume vector under a model different from the query provider.
    add_candidate(search_db, [[1.0, 0.0]])
    # Change the stored requested model to make incompatibility unambiguous.
    record = search_db.scalar(select(ResumeEmbedding))
    record.requested_model = "other-model"
    search_db.flush()
    # Require a clear mismatch error rather than silently comparing the vectors.
    with pytest.raises(ValueError, match="does not match"):
        search_candidates("python", search_db, MockProvider([1.0, 0.0]))


# Confirm absent model identifiers are not treated as implicit compatibility.
def test_missing_model_metadata_is_reported(search_db):
    # Store a normal vector and remove all usable model identifiers.
    add_candidate(search_db, [[1.0, 0.0]])
    record = search_db.scalar(select(ResumeEmbedding))
    record.requested_model = None
    record.returned_model = None
    record.model_name = "unspecified"
    search_db.flush()
    # Require explicit metadata failure instead of an assumed model match.
    with pytest.raises(ValueError, match="missing or unverifiable"):
        search_candidates("python", search_db, MockProvider([1.0, 0.0]))


# Confirm malformed stored vectors are skipped without failing the whole search.
def test_invalid_stored_vector_is_skipped(search_db):
    # Store one valid candidate vector and corrupt its JSON vector in the ORM state.
    add_candidate(search_db, [[1.0, 0.0]])
    record = search_db.scalar(select(ResumeEmbedding))
    record.embedding_vector = [1.0, "bad"]
    search_db.flush()
    # Return no result for the malformed vector while still making one query call.
    provider = MockProvider([1.0, 0.0])
    assert search_candidates("python", search_db, provider) == []
    assert provider.calls == 1


# Confirm the result limit is applied after global resume ranking.
def test_result_limit_returns_top_resume(search_db):
    # Insert three vectors whose similarities descend in insertion order reverse.
    add_candidate(search_db, [[0.0, 1.0]])
    add_candidate(search_db, [[0.8, 0.6]])
    add_candidate(search_db, [[1.0, 0.0]])
    # Request only the best match from the three-resume collection.
    results = search_candidates("python", search_db, MockProvider([1.0, 0.0]), limit=1)
    assert len(results) == 1
    assert results[0].similarity == pytest.approx(1.0)


# Confirm searching leaves all persisted embedding data and timestamps unchanged.
def test_search_does_not_mutate_database(search_db):
    # Create a committed embedding row and snapshot its stored values and timestamp.
    add_candidate(search_db, [[1.0, 0.0]])
    search_db.commit()
    record = search_db.scalar(select(ResumeEmbedding))
    original = (record.embedding_vector, record.updated_at if hasattr(record, "updated_at") else None, record.created_at)
    # Search using a mocked provider while leaving transaction ownership with the test.
    search_candidates("python", search_db, MockProvider([1.0, 0.0]))
    # Confirm the session has no pending writes and persisted values remain identical.
    assert not search_db.new
    assert not search_db.dirty
    search_db.expire_all()
    refreshed = search_db.scalar(select(ResumeEmbedding))
    assert refreshed.embedding_vector == original[0]
    assert refreshed.created_at == original[2]
    assert search_db.in_transaction()


# Confirm invalid result limits are rejected before any embedding call.
def test_invalid_limit_does_not_call_provider(search_db):
    # Track provider calls while supplying an invalid zero result limit.
    provider = MockProvider([1.0, 0.0])
    with pytest.raises(ValueError, match="positive integer"):
        search_candidates("python", search_db, provider, limit=0)
    assert provider.calls == 0
