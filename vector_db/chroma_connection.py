# Import math to validate vector and metadata numbers before storage.
import math
# Import lru_cache so repeated requests reuse persistent Chroma clients.
from functools import lru_cache
# Import Path to build the default data directory independently of the working directory.
from pathlib import Path
# Import Any for values returned by ChromaDB's client API.
from typing import Any, Sequence
# Import ChromaDB and its settings for local persistent storage without telemetry.
import chromadb
from chromadb.config import Settings

# Resolve the repository root from this module's location.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
# Store production resume vectors under the requested local data directory.
PERSIST_DIRECTORY = PROJECT_ROOT / "data" / "chroma_db"
# Use one stable collection for resume profile vectors.
COLLECTION_NAME = "resume-profiles"
# Reserve these metadata names for the required resume traceability fields.
_RESERVED_METADATA_KEYS = {"candidate_id", "resume_id", "model_name"}


# Return one cached persistent client for each storage directory.
@lru_cache(maxsize=None)
def get_chroma_client(persist_directory: str | Path = PERSIST_DIRECTORY) -> Any:
    # Normalize the requested directory to an absolute path before client creation.
    storage_path = Path(persist_directory).expanduser().resolve()
    # Create the storage directory and any missing parent directories.
    storage_path.mkdir(parents=True, exist_ok=True)
    # Open local persistent storage with telemetry disabled to avoid outbound telemetry.
    return chromadb.PersistentClient(
        path=str(storage_path),
        settings=Settings(anonymized_telemetry=False),
    )


# Return the shared collection, creating it with cosine distance when needed.
def get_resume_collection(client: Any | None = None) -> Any:
    # Use the supplied client for isolated callers or the production client by default.
    active_client = client if client is not None else get_chroma_client()
    # Ask ChromaDB to create the collection only when it does not already exist.
    return active_client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


# Convert an input vector to finite floats and reject malformed values early.
def _validated_embedding(embedding: Sequence[float]) -> list[float]:
    # Reject text-like and empty inputs before attempting numeric conversion.
    if isinstance(embedding, (str, bytes)) or not embedding:
        raise ValueError("Embedding must be a non-empty sequence of numbers.")
    # Validate each coordinate and normalize supported numeric values to floats.
    values: list[float] = []
    for value in embedding:
        # Reject booleans, non-numbers, infinities, and NaN values.
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError("Embedding values must be finite numbers.")
        # Add the validated coordinate in ChromaDB's expected float format.
        values.append(float(value))
    # Return the complete validated vector.
    return values


# Add a caller-generated resume vector and its identifying metadata to ChromaDB.
def add_resume_embedding(
    vector_id: str,
    embedding: Sequence[float],
    candidate_id: int | str,
    resume_id: int | str,
    model_name: str,
    metadata: dict[str, str | int | float | bool] | None = None,
    collection: Any | None = None,
) -> str:
    # Reject blank IDs and labels so every stored vector remains traceable.
    if not isinstance(vector_id, str) or not vector_id.strip():
        raise ValueError("vector_id must be a non-empty string.")
    if candidate_id is None or resume_id is None or not isinstance(model_name, str) or not model_name.strip():
        raise ValueError("candidate_id, resume_id, and model_name are required.")
    # Validate the vector without generating or transforming its semantic content.
    vector = _validated_embedding(embedding)
    # Copy caller metadata so the helper does not mutate the caller's dictionary.
    extra_metadata = dict(metadata or {})
    # Prevent caller metadata from replacing required identifying fields.
    if _RESERVED_METADATA_KEYS.intersection(extra_metadata):
        raise ValueError("metadata cannot replace candidate_id, resume_id, or model_name.")
    # Restrict metadata to values supported by ChromaDB's local metadata store.
    for key, value in extra_metadata.items():
        # Reject empty keys, unsupported values, and non-finite floating-point values.
        if not isinstance(key, str) or not key.strip() or isinstance(value, (dict, list, tuple)) or value is None:
            raise ValueError("metadata must contain non-empty keys and scalar values.")
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError("metadata numeric values must be finite.")
        if not isinstance(value, (str, int, float, bool)):
            raise ValueError("metadata must contain strings, numbers, or booleans.")
    # Select the supplied test collection or the shared production collection.
    active_collection = collection if collection is not None else get_resume_collection()
    # Check existence because ChromaDB's add operation may ignore duplicate IDs.
    existing = active_collection.get(ids=[vector_id], include=["metadatas"])
    if existing.get("ids"):
        raise ValueError("A resume embedding with this vector_id already exists.")
    # Build the metadata record with required identity fields and caller metadata.
    vector_metadata: dict[str, str | int | float | bool] = {
        "candidate_id": candidate_id,
        "resume_id": resume_id,
        "model_name": model_name,
        **extra_metadata,
    }
    # Store the caller-provided vector in ChromaDB without duplicating it in SQLite.
    active_collection.add(
        ids=[vector_id],
        embeddings=[vector],
        metadatas=[vector_metadata],
    )
    # Return the stable vector ID for storage as a lightweight SQLite reference.
    return vector_id


# Retrieve one vector and its metadata, returning None when its ID is absent.
def get_resume_embedding(vector_id: str, collection: Any | None = None) -> dict[str, Any] | None:
    # Select the supplied collection or the shared production collection.
    active_collection = collection if collection is not None else get_resume_collection()
    # Request only the vector and metadata for the exact requested ID.
    result = active_collection.get(ids=[vector_id], include=["embeddings", "metadatas"])
    # Return None when ChromaDB found no matching record.
    if not result.get("ids"):
        return None
    # Convert a NumPy-backed embedding to a normal list for an easy caller contract.
    embedding = result.get("embeddings")
    if embedding is not None and hasattr(embedding[0], "tolist"):
        embedding = [embedding[0].tolist()]
    # Return only the requested record rather than ChromaDB's batch-shaped result.
    return {
        "id": result["ids"][0],
        "embedding": embedding[0] if embedding is not None else None,
        "metadata": result["metadatas"][0] if result.get("metadatas") else None,
    }


# Delete one stored vector and report whether it existed.
def delete_resume_embedding(vector_id: str, collection: Any | None = None) -> bool:
    # Select the supplied collection or the shared production collection.
    active_collection = collection if collection is not None else get_resume_collection()
    # Check existence before deletion so the return value is meaningful.
    existing = active_collection.get(ids=[vector_id], include=["metadatas"])
    if not existing.get("ids"):
        return False
    # Delete the exact vector by its stable ID.
    active_collection.delete(ids=[vector_id])
    # Report that one existing vector was removed.
    return True


# Search the collection using an already-generated query vector.
def search_similar_resumes(
    embedding: Sequence[float],
    n_results: int = 5,
    where: dict[str, Any] | None = None,
    collection: Any | None = None,
) -> dict[str, Any]:
    # Reject non-positive result counts before querying ChromaDB.
    if not isinstance(n_results, int) or isinstance(n_results, bool) or n_results < 1:
        raise ValueError("n_results must be a positive integer.")
    # Validate the query vector using the same rules as stored vectors.
    query_vector = _validated_embedding(embedding)
    # Select the supplied test collection or the shared production collection.
    active_collection = collection if collection is not None else get_resume_collection()
    # Return an empty Chroma-shaped result when there is nothing to search.
    count = active_collection.count()
    if count == 0:
        return {"ids": [[]], "metadatas": [[]], "distances": [[]]}
    # Query no more records than the collection currently contains.
    return active_collection.query(
        query_embeddings=[query_vector],
        n_results=min(n_results, count),
        where=where,
        include=["metadatas", "distances"],
    )
