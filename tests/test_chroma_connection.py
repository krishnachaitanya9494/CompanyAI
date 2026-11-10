# Import pytest for temporary directories and focused assertions.
import pytest
# Import ChromaDB directly so every test uses a real local temporary store.
import chromadb
from chromadb.config import Settings

# Import the helpers under test without constructing the production client.
from vector_db.chroma_connection import (
    COLLECTION_NAME,
    PERSIST_DIRECTORY,
    add_resume_embedding,
    delete_resume_embedding,
    get_resume_collection,
    get_resume_embedding,
    search_similar_resumes,
)


# Build a temporary persistent collection for each test without touching production data.
@pytest.fixture
def resume_collection(tmp_path):
    # Place the isolated database beneath pytest's per-test temporary directory.
    storage_path = tmp_path / "chroma-test"
    # Guarantee the test fixture cannot point at the production data directory.
    assert storage_path.resolve() != PERSIST_DIRECTORY.resolve()
    # Create a real persistent client with telemetry disabled for the test.
    client = chromadb.PersistentClient(
        path=str(storage_path),
        settings=Settings(anonymized_telemetry=False),
    )
    # Return the same cosine collection used by the production helper.
    return get_resume_collection(client)


# Verify the collection uses the requested name and cosine distance setting.
def test_resume_collection_uses_cosine_distance(resume_collection):
    # Confirm the shared collection name is stable for application code.
    assert resume_collection.name == COLLECTION_NAME
    # Confirm ChromaDB stores the cosine metric in collection metadata.
    assert resume_collection.metadata["hnsw:space"] == "cosine"


# Verify vectors, traceability metadata, persistence, duplicate protection and deletion.
def test_add_get_and_delete_resume_embedding(resume_collection):
    # Add a caller-provided vector with candidate and resume identifiers.
    vector_id = add_resume_embedding(
        vector_id="resume-vector-1",
        embedding=[1.0, 0.0, 0.0],
        candidate_id=17,
        resume_id=29,
        model_name="synthetic-test-model",
        metadata={"source": "unit-test"},
        collection=resume_collection,
    )
    # Confirm the helper returns the stable vector ID for SQLite reference storage.
    assert vector_id == "resume-vector-1"
    # Retrieve the vector and its stored traceability metadata.
    record = get_resume_embedding(vector_id, collection=resume_collection)
    # Confirm the record retains its ID, vector and useful metadata.
    assert record == {
        "id": "resume-vector-1",
        "embedding": pytest.approx([1.0, 0.0, 0.0]),
        "metadata": {
            "candidate_id": 17,
            "resume_id": 29,
            "model_name": "synthetic-test-model",
            "source": "unit-test",
        },
    }
    # Reject a second insert with the same unique vector ID.
    with pytest.raises(ValueError, match="already exists"):
        add_resume_embedding(
            vector_id="resume-vector-1",
            embedding=[1.0, 0.0, 0.0],
            candidate_id=17,
            resume_id=29,
            model_name="synthetic-test-model",
            collection=resume_collection,
        )
    # Confirm the vector can be deleted and is no longer retrievable.
    assert delete_resume_embedding(vector_id, collection=resume_collection) is True
    assert get_resume_embedding(vector_id, collection=resume_collection) is None
    # Confirm deleting the same missing ID reports that nothing was removed.
    assert delete_resume_embedding(vector_id, collection=resume_collection) is False


# Verify nearest-neighbor search ranks the closest resume and returns metadata.
def test_search_similar_resumes_returns_closest_vector(resume_collection):
    # Add two synthetic vectors whose cosine distances are easy to distinguish.
    add_resume_embedding(
        vector_id="similar",
        embedding=[1.0, 0.0],
        candidate_id=1,
        resume_id=11,
        model_name="synthetic-test-model",
        collection=resume_collection,
    )
    add_resume_embedding(
        vector_id="different",
        embedding=[0.0, 1.0],
        candidate_id=2,
        resume_id=22,
        model_name="synthetic-test-model",
        collection=resume_collection,
    )
    # Search with an already-generated query vector and request one result.
    results = search_similar_resumes(
        embedding=[0.9, 0.1],
        n_results=1,
        collection=resume_collection,
    )
    # Confirm the most similar synthetic vector is returned first.
    assert results["ids"] == [["similar"]]
    # Confirm result metadata keeps the candidate and resume references.
    assert results["metadatas"][0][0]["candidate_id"] == 1
    assert results["metadatas"][0][0]["resume_id"] == 11
    # Confirm cosine distance is returned for the caller to interpret.
    assert results["distances"][0][0] < 1.0
