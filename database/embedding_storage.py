# Import JSON serialization to ensure metadata can safely round-trip through SQLite JSON.
import json
# Import finite-number checks for validating every vector coordinate.
import math
# Import regular expressions to validate optional SHA-256 input hashes.
import re
# Import Sequence so callers may provide lists, tuples, or other compatible numeric sequences.
from collections.abc import Mapping, Sequence
# Import Any for JSON-compatible metadata values.
from typing import Any
# Import SQLAlchemy's select expression for finding an existing embedding row.
from sqlalchemy import select
# Import Session for the caller-managed SQLAlchemy transaction.
from sqlalchemy.orm import Session
# Import the ORM models needed to verify and store resume and job embeddings.
from database.models import Resume, ResumeEmbedding, Job, JDSegmentation, JobRequirement, JobEmbedding

# Match exactly 64 hexadecimal characters for a SHA-256 digest.
_SHA256_PATTERN = re.compile(r"^[0-9a-fA-F]{64}$")

# Standardized embedding generation method identifiers.
VALID_GENERATION_METHODS = frozenset({
    "ollama",
    "nemotron_api",
    "provenance_unknown",
    "synthetic_fallback",
    "synthetic_test",
    "pending_regeneration",
})


# Validate and normalize an embedding sequence without relying on numerical packages.
def validate_embedding_vector(
    vector: Sequence[int | float],
    dimensions: int | None = None,
) -> list[float]:
    # Reject strings and byte sequences because their elements are not vector coordinates.
    if isinstance(vector, (str, bytes, bytearray)):
        raise ValueError("Embedding vector must be a numeric sequence.")
    # Reject absent or empty sequences before validating individual coordinates.
    if vector is None or len(vector) == 0:
        raise ValueError("Embedding vector must not be empty.")
    # Require an explicitly requested dimension count to be a positive integer.
    if dimensions is not None and (not isinstance(dimensions, int) or isinstance(dimensions, bool) or dimensions < 1):
        raise ValueError("Expected dimensions must be a positive integer.")
    # Enforce the caller's expected vector length when one was supplied.
    if dimensions is not None and len(vector) != dimensions:
        raise ValueError("Embedding vector does not match the expected dimensions.")
    # Create a fresh list so validation never mutates the caller's sequence.
    validated_vector: list[float] = []
    # Check each supplied coordinate and convert accepted values to JSON-safe floats.
    for value in vector:
        # Reject booleans even though Python treats them as integer subclasses.
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("Embedding vector values must be numeric.")
        # Convert large integers carefully so overflow becomes a safe validation error.
        try:
            numeric_value = float(value)
        except (OverflowError, TypeError, ValueError) as error:
            raise ValueError("Embedding vector values must be finite numbers.") from error
        # Reject NaN and positive or negative infinity before storage.
        if not math.isfinite(numeric_value):
            raise ValueError("Embedding vector values must be finite numbers.")
        # Append only a validated, normalized numeric value.
        validated_vector.append(numeric_value)
    # Reject the all-zero vector because it cannot be used as a valid embedding direction.
    if not any(value != 0.0 for value in validated_vector):
        raise ValueError("Embedding vector must not be a zero vector.")
    # Return the validated vector as the Python list stored by SQLAlchemy's JSON type.
    return validated_vector


# Store a validated embedding for an existing resume without taking over its transaction.
def store_resume_embedding(
    session: Session,
    resume_id: int,
    vector: Sequence[int | float],
    *,
    dimensions: int | None = None,
    input_hash: str | None = None,
    requested_model: str | None = None,
    returned_model: str | None = None,
    preprocessing_version: str | None = None,
    metadata: Mapping[str, Any] | None = None,
    generation_method: str = "ollama",
) -> ResumeEmbedding:
    # Only verified genuine vectors may enter the production index.
    if generation_method not in VALID_GENERATION_METHODS:
        raise ValueError(f"Deterministic hash, unverified, or fallback vectors ('{generation_method}') cannot be stored as valid embeddings.")
    # Confirm the parent resume exists before creating or changing its embedding.
    resume = session.get(Resume, resume_id)
    if resume is None:
        raise LookupError("Cannot store an embedding for a resume that does not exist.")
    # Validate every vector value and the optional expected dimension before record mutation.
    validated_vector = validate_embedding_vector(vector, dimensions)
    # Require an input hash, when supplied, to be a SHA-256 digest.
    if input_hash is not None and not _SHA256_PATTERN.fullmatch(input_hash):
        raise ValueError("input_hash must be a 64-character SHA-256 hexadecimal digest.")
    # Reject blank model identifiers rather than persisting unusable cache metadata.
    for model_value in (requested_model, returned_model, preprocessing_version):
        if model_value is not None and not model_value.strip():
            raise ValueError("Model and preprocessing metadata must be non-empty when supplied.")
    # Require replacement metadata to be a mapping and copy it before merging.
    if metadata is not None and not isinstance(metadata, Mapping):
        raise ValueError("Embedding metadata must be a mapping.")
    # Read the existing one-to-one row without changing it yet.
    embedding_record = session.scalar(
        select(ResumeEmbedding).where(ResumeEmbedding.resume_id == resume_id)
    )
    # Start with existing metadata so unspecified keys remain intact on updates.
    merged_metadata = dict(embedding_record.embedding_metadata or {}) if embedding_record else {}
    # Apply only metadata keys explicitly supplied by the caller.
    if metadata is not None:
        merged_metadata.update(metadata)
    # Confirm merged metadata is valid JSON and contains no non-standard NaN values.
    try:
        json.dumps(merged_metadata, allow_nan=False)
    except (TypeError, ValueError) as error:
        raise ValueError("Embedding metadata must contain finite JSON-compatible values.") from error
    # Create the single embedding row only after all input validation has succeeded.
    if embedding_record is None:
        embedding_record = ResumeEmbedding(
            resume_id=resume_id,
            vector_id=f"sqlite-resume-{resume_id}",
            collection_name="sqlite-local",
            model_name=requested_model or "unspecified",
            embedding_metadata=merged_metadata,
        )
        # Add the new row to the caller's transaction without committing it.
        session.add(embedding_record)
    # Assign the validated vector and its actual length to the selected row.
    embedding_record.embedding_vector = validated_vector
    embedding_record.dimensions = len(validated_vector)
    # Replace the JSON object so SQLAlchemy notices metadata changes reliably.
    embedding_record.embedding_metadata = merged_metadata
    # Update an explicitly supplied input hash while preserving an omitted existing value.
    if input_hash is not None:
        embedding_record.input_hash = input_hash
    # Preserve the legacy model-name field while recording the requested model separately.
    if requested_model is not None:
        embedding_record.requested_model = requested_model
        embedding_record.model_name = requested_model
    # Record the returned model only when the caller supplies one.
    if returned_model is not None:
        embedding_record.returned_model = returned_model
    # Record the preprocessing version only when the caller supplies one.
    if preprocessing_version is not None:
        embedding_record.preprocessing_version = preprocessing_version
    # Record verified generation method
    embedding_record.generation_method = generation_method
    # Flush now so database constraints surface while leaving commit ownership with the caller.
    session.flush()
    # Return the attached row for the caller to commit or roll back with its unit of work.
    return embedding_record


# Look for an existing valid job embedding with the identical SHA-256 text hash and compatible model.
def find_compatible_job_embedding_by_hash(
    session: Session,
    input_hash: str,
    model_name: str = "nomic-embed-text",
    dimensions: int = 768,
) -> JobEmbedding | None:
    # Query job embeddings matching the content digest, model configuration, and dimensions.
    stmt = (
        select(JobEmbedding)
        .where(
            JobEmbedding.input_hash == input_hash,
            JobEmbedding.model_name == model_name,
            JobEmbedding.dimensions == dimensions,
            JobEmbedding.generation_method.in_(("ollama", "nemotron_api")),
        )
        .order_by(JobEmbedding.id.desc())
    )
    # Return the most recent matching record if one exists.
    return session.scalars(stmt).first()


# Store or update a validated job or requirement embedding within a caller-managed transaction.
def store_job_embedding(
    session: Session,
    job_id: int,
    segmentation_id: int,
    embedding_type: str,
    input_hash: str,
    vector: Sequence[int | float],
    *,
    requirement_id: int | None = None,
    dimensions: int | None = 768,
    model_name: str = "nomic-embed-text",
    generation_method: str = "ollama",
) -> JobEmbedding:
    # Only verified genuine vectors may enter the production index.
    if generation_method not in ("ollama", "nemotron_api", "synthetic_test"):
        raise ValueError(f"Deterministic hash, unverified, or fallback vectors ('{generation_method}') cannot be stored as valid embeddings.")
    # Confirm the parent operational job exists in the database.
    job = session.get(Job, job_id)
    if job is None:
        raise LookupError("Cannot store an embedding for a job that does not exist.")

    # Confirm the parent approved segmentation exists in the database.
    segmentation = session.get(JDSegmentation, segmentation_id)
    if segmentation is None:
        raise LookupError("Cannot store an embedding for a segmentation that does not exist.")

    # If linked to a requirement, confirm that the requirement exists.
    if requirement_id is not None:
        req = session.get(JobRequirement, requirement_id)
        if req is None:
            raise LookupError("Cannot store an embedding for a requirement that does not exist.")

    # Validate that the embedding type is non-empty.
    if not embedding_type or not embedding_type.strip():
        raise ValueError("embedding_type must be a non-empty string.")

    # Require input_hash to be a valid 64-character SHA-256 hexadecimal digest.
    if not input_hash or not _SHA256_PATTERN.fullmatch(input_hash):
        raise ValueError("input_hash must be a 64-character SHA-256 hexadecimal digest.")

    # Validate the numeric vector and enforce expected 2048 dimensions.
    validated_vector = validate_embedding_vector(vector, dimensions=dimensions)

    # Check for an existing embedding row for this specific segmentation and scope.
    stmt = select(JobEmbedding).where(
        JobEmbedding.segmentation_id == segmentation_id,
        JobEmbedding.embedding_type == embedding_type,
    )
    if requirement_id is not None:
        stmt = stmt.where(JobEmbedding.requirement_id == requirement_id)
    else:
        stmt = stmt.where(JobEmbedding.requirement_id.is_(None))

    record = session.scalars(stmt).first()

    # Create a new row if no record exists for this requirement/scope.
    if record is None:
        record = JobEmbedding(
            job_id=job_id,
            segmentation_id=segmentation_id,
            requirement_id=requirement_id,
            embedding_type=embedding_type,
            input_hash=input_hash,
            model_name=model_name,
            dimensions=len(validated_vector),
            embedding_vector=validated_vector,
            generation_method=generation_method,
        )
        session.add(record)
    else:
        # Update existing record with the new vector, hash, and model.
        record.input_hash = input_hash
        record.model_name = model_name
        record.dimensions = len(validated_vector)
        record.embedding_vector = validated_vector
        record.generation_method = generation_method

    # Flush session so constraints are validated while caller controls transaction commit.
    session.flush()
    return record
