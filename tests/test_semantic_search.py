# Import math constants for synthetic invalid-vector and extreme-magnitude cases.
import math
# Import pytest for approximate comparisons and expected validation errors.
import pytest
# Import the explicit candidate record and pure-Python search functions under test.
from app.semantic_search import CandidateEmbedding, cosine_similarity, rank_candidates


# Check that identical directions have the maximum possible cosine score.
def test_identical_vectors_have_similarity_one():
    # Compare a synthetic vector with itself without involving resume or JD content.
    assert cosine_similarity([1.0, 2.0, 3.0], [1.0, 2.0, 3.0]) == pytest.approx(1.0)


# Check that vectors pointing in opposite directions have the minimum score.
def test_opposite_vectors_have_similarity_negative_one():
    # Compare two synthetic vectors whose coordinates have opposite signs.
    assert cosine_similarity([1.0, -2.0], [-1.0, 2.0]) == pytest.approx(-1.0)


# Check that perpendicular vectors have no cosine alignment.
def test_orthogonal_vectors_have_similarity_zero():
    # Compare independent axes from a two-dimensional synthetic vector space.
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)


# Check that a known candidate set is ranked from most to least similar.
def test_candidates_are_ranked_by_similarity():
    # Define one query direction and three synthetic candidate resume vectors.
    query = [1.0, 0.0]
    candidates = [
        CandidateEmbedding(candidate_id=7, embedding=[0.8, 0.2]),
        CandidateEmbedding(candidate_id=2, embedding=[0.0, 1.0]),
        CandidateEmbedding(candidate_id=5, embedding=[-1.0, 0.0]),
    ]
    # Rank each candidate's single supplied resume embedding against the query.
    results = rank_candidates(query, candidates)
    # Confirm the expected order and the descending score relationship.
    assert [result.candidate_id for result in results] == [7, 2, 5]
    assert results[0].similarity > results[1].similarity > results[2].similarity


# Check that exact score ties use stable candidate-identifier ordering.
def test_equal_scores_use_deterministic_identifier_tie_breaking():
    # Supply identical candidate directions in reverse lexical ID order.
    candidates = [
        CandidateEmbedding(candidate_id="zeta", embedding=[1.0, 1.0]),
        CandidateEmbedding(candidate_id="alpha", embedding=[2.0, 2.0]),
    ]
    # Rank candidates and confirm tie order is independent of input order.
    results = rank_candidates([1.0, 1.0], candidates)
    assert [result.candidate_id for result in results] == ["alpha", "zeta"]


# Check that tied integer identifiers sort numerically before text identifiers.
def test_tie_breaking_is_stable_for_integer_and_string_ids():
    # Mix supported identifier types while assigning all candidates the same score.
    candidates = [
        CandidateEmbedding(candidate_id="1", embedding=[1.0]),
        CandidateEmbedding(candidate_id=10, embedding=[1.0]),
        CandidateEmbedding(candidate_id=2, embedding=[1.0]),
    ]
    # Confirm integer IDs sort numerically and precede string IDs on ties.
    results = rank_candidates([1.0], candidates)
    assert [result.candidate_id for result in results] == [2, 10, "1"]


# Check that an optional positive limit returns only the highest-ranked records.
def test_result_limit_returns_top_candidates():
    # Create three synthetic candidates with strictly descending similarities.
    candidates = [
        CandidateEmbedding(candidate_id=1, embedding=[0.1, 0.9]),
        CandidateEmbedding(candidate_id=2, embedding=[1.0, 0.0]),
        CandidateEmbedding(candidate_id=3, embedding=[0.8, 0.2]),
    ]
    # Request two results and verify only the leading candidates are returned.
    results = rank_candidates([1.0, 0.0], candidates, limit=2)
    assert [result.candidate_id for result in results] == [2, 3]
    assert len(results) == 2


# Check that candidates without embeddings are omitted without affecting other scores.
def test_missing_candidate_embeddings_are_skipped():
    # Include a missing vector between two candidates with usable synthetic vectors.
    candidates = [
        CandidateEmbedding(candidate_id=1, embedding=[1.0, 0.0]),
        CandidateEmbedding(candidate_id=2, embedding=None),
        CandidateEmbedding(candidate_id=3, embedding=[0.0, 1.0]),
    ]
    # Confirm only candidates with vectors appear in the ranked results.
    results = rank_candidates([1.0, 0.0], candidates)
    assert [result.candidate_id for result in results] == [1, 3]


# Check that a zero result limit is rejected instead of silently returning no matches.
def test_non_positive_result_limit_is_rejected():
    # Require a positive integer limit when callers choose to restrict result count.
    with pytest.raises(ValueError, match="positive integer"):
        rank_candidates([1.0], [CandidateEmbedding(1, [1.0])], limit=0)


# Check that empty query and candidate vectors are both rejected.
@pytest.mark.parametrize(
    ("first_vector", "second_vector"),
    [([], [1.0]), ([1.0], [])],
)
def test_empty_vectors_are_rejected(first_vector, second_vector):
    # Confirm either empty operand causes an explicit validation error.
    with pytest.raises(ValueError, match="must not be empty"):
        cosine_similarity(first_vector, second_vector)


# Check that different vector lengths are rejected without padding or truncation.
def test_vectors_with_different_dimensions_are_rejected():
    # Provide two otherwise valid, nonzero vectors with incompatible lengths.
    with pytest.raises(ValueError, match="same number of dimensions"):
        cosine_similarity([1.0, 2.0], [1.0, 2.0, 3.0])


# Check that zero-norm vectors are rejected for both the direct API and ranking API.
def test_zero_vectors_are_rejected():
    # Require a direct cosine comparison to reject an undefined vector direction.
    with pytest.raises(ValueError, match="zero vector"):
        cosine_similarity([0.0, 0.0], [1.0, 0.0])
    # Require a zero query vector to fail before candidate ranking starts.
    with pytest.raises(ValueError, match="zero vector"):
        rank_candidates([0.0], [CandidateEmbedding(1, [1.0])])


# Check that non-numeric coordinates are rejected in either cosine operand.
@pytest.mark.parametrize("invalid_value", ["text", None, True])
def test_non_numeric_vector_values_are_rejected(invalid_value):
    # Place one invalid coordinate in a synthetic vector and require a clear error.
    with pytest.raises(ValueError, match="must be numeric"):
        cosine_similarity([1.0, invalid_value], [1.0, 1.0])


# Check that all non-finite floating-point values are rejected.
@pytest.mark.parametrize("invalid_value", [math.nan, math.inf, -math.inf])
def test_nan_and_infinity_values_are_rejected(invalid_value):
    # Require non-finite query coordinates to fail before score calculation.
    with pytest.raises(ValueError, match="finite numbers"):
        cosine_similarity([1.0, invalid_value], [1.0, 1.0])


# Check that malformed candidate embeddings fail rather than being silently ignored.
def test_malformed_candidate_vector_is_rejected():
    # Use an empty present vector to distinguish malformed data from a missing vector.
    candidates = [CandidateEmbedding(candidate_id=11, embedding=[])]
    # Require a validation error instead of treating malformed data as absent.
    with pytest.raises(ValueError, match="must not be empty"):
        rank_candidates([1.0], candidates)


# Check that repeated identifiers are rejected instead of implicitly aggregating resumes.
def test_duplicate_candidate_identifiers_are_rejected():
    # Provide two vectors with the same candidate key to exercise the explicit contract.
    candidates = [
        CandidateEmbedding(candidate_id=11, embedding=[1.0]),
        CandidateEmbedding(candidate_id=11, embedding=[0.0, 1.0]),
    ]
    # Require a clear failure because multi-resume aggregation belongs to a later phase.
    with pytest.raises(ValueError, match="identifiers must be unique"):
        rank_candidates([1.0], candidates)


# Check that ranking does not mutate query vectors, candidate vectors, or input records.
def test_ranking_does_not_mutate_input_vectors_or_records():
    # Keep independent snapshots of mutable synthetic inputs before ranking.
    query = [1.0, 2.0]
    candidate_vector = [2.0, 1.0]
    candidate = CandidateEmbedding(candidate_id=4, embedding=candidate_vector)
    candidates = [candidate]
    query_before = list(query)
    vector_before = list(candidate_vector)
    records_before = list(candidates)
    # Run ranking on the inputs after recording their original values and identity.
    rank_candidates(query, candidates)
    # Confirm all input values and the original record object remain unchanged.
    assert query == query_before
    assert candidate_vector == vector_before
    assert candidates == records_before
    assert candidates[0] is candidate


# Check that an empty candidate collection returns an empty list without error.
def test_empty_candidate_collection_returns_empty_results():
    # Rank no candidates against a valid synthetic query vector.
    assert rank_candidates([1.0, 0.0], []) == []


# Check that a full-size 2048-dimensional vector works with the standard-library engine.
def test_2048_dimensional_synthetic_vectors_are_supported():
    # Build a synthetic nonzero vector with the model's current output dimension.
    vector = [float(index + 1) / 2048 for index in range(2048)]
    # Confirm a vector compared with itself retains a score of one at full dimension.
    assert cosine_similarity(vector, vector) == pytest.approx(1.0)
    # Confirm the ranking function accepts the same vector through its input record.
    results = rank_candidates(vector, [CandidateEmbedding(2048, vector)])
    assert results[0].candidate_id == 2048
    assert results[0].similarity == pytest.approx(1.0)


# Check that scaling extreme finite values does not overflow cosine calculation.
def test_cosine_similarity_is_stable_for_extreme_finite_values():
    # Compare large but finite values whose unscaled squares would overflow.
    assert cosine_similarity([1e308, 1e308], [1e308, 1e308]) == pytest.approx(1.0)
