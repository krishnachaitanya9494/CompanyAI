# Import fsum for numerically stable sums of vector products and squared coordinates.
import math
# Import dataclass to define immutable, explicit search inputs and outputs.
from dataclasses import dataclass
# Import Iterable and Sequence for reusable standard-library collection interfaces.
from collections.abc import Iterable, Sequence


# Describe one candidate with exactly one resume embedding for this search phase.
@dataclass(frozen=True)
class CandidateEmbedding:
    """Pair a candidate identifier with one resume vector, if one is available."""

    # Store the stable candidate key without inventing personal profile fields.
    candidate_id: int | str
    # Store one resume vector or None when this candidate has no usable embedding.
    embedding: Sequence[int | float] | None


# Describe one candidate and its unscaled cosine similarity to the query vector.
@dataclass(frozen=True)
class SimilarityResult:
    """Return only an identifier and a cosine similarity score."""

    # Identify the candidate record that supplied the single compared resume vector.
    candidate_id: int | str
    # Store the cosine score as a value from negative one through positive one.
    similarity: float


# Validate one vector and return a scale and scaled norm without copying its values.
def _vector_scale_and_norm(vector: Sequence[int | float], label: str) -> tuple[float, float]:
    # Reject strings and byte sequences because their elements are not numeric coordinates.
    if isinstance(vector, (str, bytes, bytearray)) or not isinstance(vector, Sequence):
        raise ValueError(f"{label} must be a compatible numeric sequence.")
    # Reject empty vectors because their cosine direction is undefined.
    if len(vector) == 0:
        raise ValueError(f"{label} must not be empty.")
    # Validate scalar types and finite float conversion before doing arithmetic.
    for value in vector:
        # Reject booleans and values outside the supported real-number input contract.
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{label} values must be numeric.")
        # Convert unusually large integers safely so overflow is reported as invalid input.
        try:
            numeric_value = float(value)
        except (OverflowError, TypeError, ValueError) as error:
            raise ValueError(f"{label} values must be finite numbers.") from error
        # Reject NaN and both signs of infinity before computing a norm.
        if not math.isfinite(numeric_value):
            raise ValueError(f"{label} values must be finite numbers.")
    # Find the largest magnitude so later norm arithmetic avoids overflow and underflow.
    scale = max(abs(float(value)) for value in vector)
    # Reject a vector whose coordinates are all zero because it has no direction.
    if scale == 0.0:
        raise ValueError(f"{label} must not be a zero vector.")
    # Compute the norm after scaling coordinates into the safe range from minus one to one.
    scaled_norm = math.sqrt(math.fsum((float(value) / scale) ** 2 for value in vector))
    # Return the scale and normalized norm needed for a stable cosine calculation.
    return scale, scaled_norm


# Compute cosine similarity for two valid, equally sized numeric vectors.
def cosine_similarity(
    first_vector: Sequence[int | float],
    second_vector: Sequence[int | float],
) -> float:
    """Return a finite cosine score in [-1.0, 1.0] without external libraries."""

    # Validate the first vector and retain its scale and scaled norm.
    first_scale, first_norm = _vector_scale_and_norm(first_vector, "First vector")
    # Validate the second vector and retain its scale and scaled norm.
    second_scale, second_norm = _vector_scale_and_norm(second_vector, "Second vector")
    # Reject incompatible vector shapes instead of padding or truncating either input.
    if len(first_vector) != len(second_vector):
        raise ValueError("Embedding vectors must have the same number of dimensions.")
    # Sum products of scaled coordinates so large magnitudes cannot overflow the dot product.
    scaled_dot = math.fsum(
        (float(first_value) / first_scale) * (float(second_value) / second_scale)
        for first_value, second_value in zip(first_vector, second_vector)
    )
    # Divide by the scaled norms because the original vector scales cancel in cosine similarity.
    score = scaled_dot / (first_norm * second_norm)
    # Reject arithmetic anomalies rather than returning a non-finite similarity score.
    if not math.isfinite(score):
        raise ArithmeticError("Cosine similarity calculation did not produce a finite score.")
    # Permit only tiny rounding overshoot before clamping to the mathematical score bounds.
    tolerance = 1e-12
    if score < -1.0 - tolerance or score > 1.0 + tolerance:
        raise ArithmeticError("Cosine similarity exceeded its valid numeric range.")
    # Clamp only harmless floating-point overshoot and return the bounded score.
    return min(1.0, max(-1.0, score))


# Return an identifier sort key with stable ordering across integer and string IDs.
def _identifier_sort_key(candidate_id: int | str) -> tuple[str, int | str, str]:
    # Sort numeric IDs numerically before any text IDs when similarities are tied.
    if isinstance(candidate_id, int) and not isinstance(candidate_id, bool):
        return ("0", candidate_id, "")
    # Sort string IDs case-insensitively, then case-sensitively for a total stable order.
    return ("1", candidate_id.casefold(), candidate_id)


# Rank unique candidates against one query embedding without mutating caller data.
def rank_candidates(
    query_embedding: Sequence[int | float],
    candidates: Iterable[CandidateEmbedding],
    limit: int | None = None,
) -> list[SimilarityResult]:
    """Rank one resume vector per candidate; multi-resume aggregation is out of scope."""

    # Validate the result limit so zero, negative, boolean, and fractional values are rejected.
    if limit is not None and (not isinstance(limit, int) or isinstance(limit, bool) or limit < 1):
        raise ValueError("Result limit must be a positive integer when supplied.")
    # Validate the query before reading candidate records or computing scores.
    query_scale, query_norm = _vector_scale_and_norm(query_embedding, "Query vector")
    # Prepare the result collection and a set used to detect duplicate candidate identifiers.
    ranked_results: list[SimilarityResult] = []
    seen_candidate_ids: set[int | str] = set()
    # Visit each candidate once, computing one score for its explicitly supplied resume vector.
    for position, candidate in enumerate(candidates):
        # Require the documented record type so malformed input fails consistently.
        if not isinstance(candidate, CandidateEmbedding):
            raise ValueError(f"Candidate at position {position} must be a CandidateEmbedding record.")
        # Validate the identifier before adding it to the duplicate-detection set.
        candidate_id = candidate.candidate_id
        if isinstance(candidate_id, bool) or not isinstance(candidate_id, (int, str)):
            raise ValueError(f"Candidate at position {position} has an unsupported identifier.")
        # Reject blank string identifiers because they cannot identify a candidate reliably.
        if isinstance(candidate_id, str) and not candidate_id.strip():
            raise ValueError(f"Candidate at position {position} has an empty identifier.")
        # Reject duplicate IDs rather than silently selecting or aggregating multiple resumes.
        if candidate_id in seen_candidate_ids:
            raise ValueError("Candidate identifiers must be unique for single-resume ranking.")
        # Track each ID even when its vector is absent so duplicate input remains explicit.
        seen_candidate_ids.add(candidate_id)
        # Skip candidates that have no resume embedding yet.
        if candidate.embedding is None:
            continue
        # Validate the candidate vector and calculate its scaled norm once.
        candidate_scale, candidate_norm = _vector_scale_and_norm(
            candidate.embedding,
            f"Candidate at position {position} vector",
        )
        # Reject dimensions that do not match the query rather than padding or truncating.
        if len(candidate.embedding) != len(query_embedding):
            raise ValueError(
                f"Candidate at position {position} vector dimensions do not match the query."
            )
        # Sum scaled coordinate products to avoid overflow while comparing large-magnitude vectors.
        scaled_dot = math.fsum(
            (float(query_value) / query_scale) * (float(candidate_value) / candidate_scale)
            for query_value, candidate_value in zip(query_embedding, candidate.embedding)
        )
        # Divide by the scaled norms because each vector's original scale cancels out.
        score = scaled_dot / (query_norm * candidate_norm)
        # Reject unexpected non-finite scores instead of returning corrupt ranking data.
        if not math.isfinite(score):
            raise ArithmeticError("Cosine similarity calculation did not produce a finite score.")
        # Check numerical overshoot against a small tolerance before clamping the score.
        if score < -1.0 - 1e-12 or score > 1.0 + 1e-12:
            raise ArithmeticError("Cosine similarity exceeded its valid numeric range.")
        # Append only the candidate identifier and its bounded similarity score.
        ranked_results.append(SimilarityResult(candidate_id, min(1.0, max(-1.0, score))))
    # Sort highest scores first and use candidate ID as a deterministic tie-breaker.
    ranked_results.sort(key=lambda result: (-result.similarity, _identifier_sort_key(result.candidate_id)))
    # Return all results or only the requested leading candidates.
    return ranked_results[:limit] if limit is not None else ranked_results
