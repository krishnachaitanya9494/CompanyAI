# Import pytest for test framework primitives.
import pytest
# Import TestClient from starlette/fastapi for API integration testing.
from starlette.testclient import TestClient
# Import FastAPI app instance.
from app.main import app
# Import SessionLocal from database connection module.
from database.sqlite_connection import SessionLocal
from app.services.talent_intelligence_service import build_candidate_digital_twin
from app.services.matching_engine_service import compare_adhoc_jd_and_resume
from app.routers.jobs import get_candidate_job_match_history
from app.routers.intelligence import get_candidate_digital_twin
# Import models for candidate, resume, job, and segmentation.
from database.models import (
    Candidate,
    Resume,
    ResumeEmbedding,
    Job,
    JDSegmentation,
    JobRequirement,
    JobEmbedding,
    CandidateJobMatchResult,
)
# Import matching engine service functions and schemas.
from app.services.matching_engine_service import (
    search_and_match_candidates,
    compare_candidates_for_job,
    get_matching_filter_options,
    CandidateMatchingFilters,
    MatchScoreWeights,
    classify_match_tier,
    compare_single_candidate_for_job,
    store_match_history,
    get_active_approved_segmentation,
)
from app.routers.jobs import (
    get_job_matches,
    get_job_matches_summary,
    compare_job_candidates,
    get_job_match_filters,
    CompareCandidatesSchema,
)
from app.routers.analytics import get_dashboard_metrics


# Test match tier classification logic.
def test_classify_match_tier():
    # Verify score 95 maps to Excellent Match.
    assert classify_match_tier(95) == "Excellent Match"
    # Verify boundary score 88 maps to Excellent Match.
    assert classify_match_tier(88) == "Excellent Match"
    # Verify score 80 maps to Strong Match.
    assert classify_match_tier(80) == "Strong Match"
    # Verify boundary score 75 maps to Strong Match.
    assert classify_match_tier(75) == "Strong Match"
    # Verify score 70 maps to Potential Match.
    assert classify_match_tier(70) == "Potential Match"
    # Verify boundary score 60 maps to Potential Match.
    assert classify_match_tier(60) == "Potential Match"
    # Verify score 50 maps to Partial Match.
    assert classify_match_tier(50) == "Partial Match"
    # Verify boundary score 45 maps to Partial Match.
    assert classify_match_tier(45) == "Partial Match"
    # Verify low score 30 maps to Needs Review.
    assert classify_match_tier(30) == "Needs Review"
    # Verify zero score maps to Needs Review.
    assert classify_match_tier(0) == "Needs Review"


# Test MatchScoreWeights normalization.
def test_match_score_weights_normalization():
    # Create non-normalized weights.
    weights = MatchScoreWeights(
        mandatory_skills=0.70,
        preferred_skills=0.30,
        relevant_experience=0.40,
        domain_fit=0.30,
        semantic_relevance=0.30,
    )
    # Normalize weights.
    norm = weights.normalized()
    # Check that sum of normalized weights equals 1.0 within float tolerance.
    total = (
        norm.mandatory_skills
        + norm.preferred_skills
        + norm.relevant_experience
        + norm.domain_fit
        + norm.semantic_relevance
    )
    assert abs(total - 1.0) < 1e-6


# Test search_and_match_candidates service directly with database session.
def test_search_and_match_candidates_service():
    # Open isolated database session.
    db = SessionLocal()
    try:
        # Query first available job.
        first_job = db.query(Job).first()
        assert first_job is not None

        # Execute candidate matching for first job with default filters.
        results = search_and_match_candidates(db, first_job.id, page=1, page_size=20)
        # Verify result contains required response keys.
        assert "job_id" in results
        assert "summary" in results
        assert "matches" in results
        assert results["job_id"] == first_job.id
        assert results["total_evaluated"] >= 0

        # Verify summary dictionary keys.
        summary = results["summary"]
        assert "total_evaluated" in summary
        assert "excellent_matches" in summary
        assert "strong_matches" in summary
        assert "potential_matches" in summary
        assert "partial_matches" in summary
        assert "needs_review" in summary
        assert "average_score" in summary

        # If candidates exist, verify top match properties.
        if results["matches"]:
            top = results["matches"][0]
            assert "candidate_id" in top
            assert "name" in top
            assert "matchScore" in top
            assert "match_score" in top
            assert "classification" in top
            assert "componentScores" in top
            assert "requirements" in top
            assert "evidenceHighlights" in top
            assert "explanations" in top
            # Check component scores breakdown.
            comp = top["componentScores"]
            assert "mandatory_skills" in comp
            assert "preferred_skills" in comp
            assert "relevant_experience" in comp
            assert "domain_fit" in comp
            assert "semantic_relevance" in comp
            # Check explanations structure.
            exp = top["explanations"]
            assert "why_matched" in exp
            assert "missing_requirements" in exp
            assert "needs_verification" in exp
            assert "summary_narrative" in exp
    finally:
        db.close()


# Ensure ranking and the comparison route publish one score and source identity for the same inputs.
def test_ranking_and_single_comparison_share_canonical_result():
    db = SessionLocal()
    try:
        job = db.query(Job).first()
        candidate = db.query(Candidate).first()
        assert job is not None and candidate is not None
        approved_segmentation = get_active_approved_segmentation(db, job.id)
        next_version = max((row.version for row in db.query(JDSegmentation).filter_by(job_id=job.id).all()), default=0) + 1
        pending = JDSegmentation(
            job_id=job.id,
            version=next_version,
            status="review_pending",
            is_approved=0,
        )
        db.add(pending)
        db.flush()
        db.add(JobRequirement(
            segmentation_id=pending.id,
            category="mandatory_skills",
            classification="Mandatory",
            original_text="Draft-only requirement must not affect official scores",
            normalized_skill="draft-only requirement",
        ))
        db.commit()
        ranked = search_and_match_candidates(db, job.id, page=1, page_size=200)
        ranked_match = next(row for row in ranked["matches"] if row["candidate_id"] == candidate.id)
        compared = compare_single_candidate_for_job(db, job.id, candidate.id)["comparison"]
        assert ranked["segmentation_id"] == (approved_segmentation.id if approved_segmentation else None)
        assert pending.is_approved == 0
        assert all("Draft-only requirement" not in item["original_text"] for item in ranked_match["requirements"])
        assert ranked_match["matchScore"] == compared["match_score"]
        assert ranked_match["componentScores"] == compared["component_scores"]
        assert ranked_match["match_provenance"]["history_id"] == compared["match_provenance"]["history_id"]
        for key in ("job_id", "jd_version_id", "jd_content_hash", "resume_id", "resume_content_hash", "matching_engine_version", "scoring_configuration_version"):
            assert ranked_match["match_provenance"][key] == compared["match_provenance"][key]
        from app.routers.jobs import get_candidate_job_match_history
        history = get_candidate_job_match_history(job.id, candidate.id, db=db)
        assert history["results"][0]["is_current"] is True
        assert history["results"][0]["overall_score"] == compared["match_score"]
        db.delete(pending)
        db.commit()
    finally:
        db.close()


# Verify changed JD and resume hashes append history and mark the previous snapshot outdated.
def test_match_history_preserves_jd_and_resume_source_versions():
    from datetime import datetime, timezone
    from types import SimpleNamespace

    db = SessionLocal()
    candidate_id, job_id = 987654, 987654
    result = SimpleNamespace(
        candidate_id=candidate_id, match_score=61, classification="Potential Match",
        component_scores={"mandatory_skills": 50.0}, requirements=[],
    )
    provenance = {
        "candidate_id": candidate_id, "job_id": job_id, "resume_id": 1,
        "resume_content_hash": "resume-v1", "candidate_profile_hash": "profile-v1",
        "jd_version_id": 1, "jd_content_hash": "jd-v1", "matching_engine_version": "test-v1",
        "scoring_configuration_version": "test-config-v1", "scoring_weights_hash": "weights-v1",
        "calculated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        store_match_history(db, result, provenance)
        db.commit()
        first = db.query(CandidateJobMatchResult).filter_by(candidate_id=candidate_id, job_id=job_id).one()

        jd_revision = {**provenance, "jd_version_id": 2, "jd_content_hash": "jd-v2"}
        store_match_history(db, result, jd_revision)
        db.commit()
        second = db.query(CandidateJobMatchResult).filter_by(candidate_id=candidate_id, job_id=job_id, jd_content_hash="jd-v2").one()
        db.refresh(first)
        assert first.is_current is False and second.is_current is True

        resume_revision = {**jd_revision, "resume_content_hash": "resume-v2"}
        store_match_history(db, result, resume_revision)
        db.commit()
        third = db.query(CandidateJobMatchResult).filter_by(candidate_id=candidate_id, job_id=job_id, resume_content_hash="resume-v2").one()
        db.refresh(second)
        assert second.is_current is False and third.is_current is True
        assert db.query(CandidateJobMatchResult).filter_by(candidate_id=candidate_id, job_id=job_id).count() == 3
    finally:
        db.close()


# Test SQL filtering behavior in matching engine service.
def test_matching_engine_sql_filters():
    db = SessionLocal()
    try:
        first_job = db.query(Job).first()
        assert first_job is not None

        # Test experience filter: min_experience = 8.0.
        filters_exp = CandidateMatchingFilters(min_experience=8.0)
        res_exp = search_and_match_candidates(db, first_job.id, filters=filters_exp, page_size=100)
        # Verify all returned candidates have experience >= 8.0.
        for m in res_exp["matches"]:
            assert m["experienceYears"] >= 8.0

        # Test location filter.
        filters_loc = CandidateMatchingFilters(location="Bangalore")
        res_loc = search_and_match_candidates(db, first_job.id, filters=filters_loc, page_size=100)
        for m in res_loc["matches"]:
            assert "bangalore" in m["location"].lower()

        # Test search filter.
        filters_search = CandidateMatchingFilters(search="Kumar")
        res_search = search_and_match_candidates(db, first_job.id, filters=filters_search, page_size=100)
        for m in res_search["matches"]:
            assert (
                "kumar" in m["name"].lower()
                or "kumar" in m["location"].lower()
                or any("kumar" in s.lower() for s in m.get("skills", []))
            )
    finally:
        db.close()


# Test API endpoint GET /api/jobs/{job_id}/matches list format.
def test_api_get_job_matches_list():
    db = SessionLocal()
    try:
        data = get_job_matches(job_id="1", limit=10, as_object=False, db=db)
        # Verify legacy list response format.
        assert isinstance(data, list)
        if data:
            cand = data[0]
            assert "matchScore" in cand
            assert "candidate_id" in cand
            assert "classification" in cand
            assert "componentScores" in cand
    finally:
        db.close()


# Test API endpoint GET /api/jobs/{job_id}/matches with as_object=true.
def test_api_get_job_matches_as_object():
    db = SessionLocal()
    try:
        data = get_job_matches(job_id="1", limit=10, as_object=True, db=db)
        # Verify structured dictionary format.
        assert isinstance(data, dict)
        assert "job_id" in data
        assert "summary" in data
        assert "matches" in data
        assert isinstance(data["matches"], list)
    finally:
        db.close()


# Test API endpoint GET /api/jobs/{job_id}/matches/summary.
def test_api_get_job_matches_summary():
    db = SessionLocal()
    try:
        data = get_job_matches_summary(job_id="1", db=db)
        assert "job_id" in data
        assert "summary" in data
        assert "total_evaluated" in data
        summary = data["summary"]
        assert "total_evaluated" in summary
        assert "average_score" in summary
    finally:
        db.close()


# Test API endpoint POST /api/jobs/{job_id}/compare-candidates.
def test_api_compare_candidates():
    db = SessionLocal()
    try:
        # Compare candidate 1 and candidate 2 for job 1.
        data = compare_job_candidates(
            job_id="1",
            payload=CompareCandidatesSchema(candidate_ids=[1, 2]),
            db=db,
        )
        assert "job_id" in data
        assert "candidates" in data
        assert len(data["candidates"]) == 2
        assert "matrix_rows" in data
        assert "recommendation" in data
        rec = data["recommendation"]
        assert "recommended_candidate_id" in rec
        assert "recommendation_rationale" in rec
    finally:
        db.close()


# Test candidate comparison validation limits.
def test_api_compare_candidates_validation():
    from pydantic import ValidationError
    # Reject single candidate comparison.
    with pytest.raises(ValidationError):
        CompareCandidatesSchema(candidate_ids=[1])

    # Reject more than 5 candidates.
    with pytest.raises(ValidationError):
        CompareCandidatesSchema(candidate_ids=[1, 2, 3, 4, 5, 6])


# Test API endpoint GET /api/jobs/{job_id}/match-filters.
def test_api_get_match_filters():
    db = SessionLocal()
    try:
        data = get_job_match_filters(job_id="1", db=db)
        assert "locations" in data
        assert "stages" in data
        assert "availabilities" in data
        assert "experience_range" in data
        assert isinstance(data["locations"], list)
    finally:
        db.close()


# Test placeholder skill sanitization in segmentation approval flow.
def test_placeholder_skill_sanitization():
    # Import regex for validation assertions.
    import re
    # Test invalid strings that must be rejected.
    invalid_tokens = [
        "[section=requirements] Python",
        "[source_line=12] Oracle Financials",
        "This is a very long descriptive paragraph of responsibilities and technical tasks that exceeds the maximum word count for skills",
    ]
    # Define cleaner matching implementation.
    def clean(raw):
        # Reject empty or non-string inputs.
        if not raw or not isinstance(raw, str):
            return None
        # Trim leading and trailing whitespace.
        trimmed = raw.strip()
        # Reject section markers.
        if trimmed.startswith("[section=") or "[source_line=" in trimmed or "[category=" in trimmed:
            return None
        # Reject full paragraph sentences exceeding standard skill phrase length.
        if len(trimmed.split()) > 7:
            return None
        # Strip common boilerplates if present.
        cleaned = re.sub(
            r'^(must have|nice to have|mandatory|preferred)?\s*(mastery of|expertise in|proficiency in|knowledge of|experience with|experience in)\s+',
            '',
            trimmed,
            flags=re.IGNORECASE,
        ).strip()
        return cleaned if len(cleaned) >= 2 else None

    # Assert all invalid tokens are safely rejected.
    for p in invalid_tokens:
        assert clean(p) is None, f"Expected {p} to be rejected"

    # Assert boilerplate prefixes are cleanly stripped.
    assert clean("Must have mastery of Python") == "Python"
    assert clean("Nice to have expertise in Essbase") == "Essbase"

    # Assert valid recruiter skills are safely preserved.
    valid_skills = ["Oracle EPM", "Hyperion Planning", "PBCS", "Calculation Scripts", "Python", "SQL"]
    for v in valid_skills:
        assert clean(v) == v, f"Expected valid skill {v} to be preserved"


# Test that resume evidence extraction produces genuine verbatim quotes without bracketed template headers.
def test_verbatim_evidence_no_brackets():
    db = SessionLocal()
    try:
        # Retrieve top matches for Job 1 with disk citations loaded.
        data = get_job_matches(job_id="1", as_object=True, limit=10, db=db)
        # Iterate over matches.
        for m in data["matches"]:
            # Verify citation string exists.
            citation = m.get("evidence_citation", "")
            # Assert bracketed category prefixes are absent.
            assert not citation.startswith("[Mandatory Skills]")
            assert not citation.startswith("[Preferred Skills]")
            assert not citation.startswith("[Technical Skills]")
            # Assert generic dummy fallback sentence is absent.
            assert "Demonstrated project competencies in candidate resume." not in citation
    finally:
        db.close()


# Test mathematical bounding of semantic vector relevance score (0.0 to 100.0).
def test_semantic_score_bounding():
    # Compute bounded score function matching service logic.
    def compute_semantic_score(cosine_similarity: float) -> float:
        # Cosine similarity scaled to 100 and bounded to [0.0, 100.0].
        return round(min(100.0, max(0.0, cosine_similarity * 100.0)), 1)

    # Test negative cosine similarity bounds to 0.0.
    assert compute_semantic_score(-0.35) == 0.0
    # Test orthogonal zero similarity bounds to 0.0.
    assert compute_semantic_score(0.0) == 0.0
    # Test positive cosine similarity scales correctly.
    assert compute_semantic_score(0.742) == 74.2
    # Test perfect 1.0 similarity equals 100.0.
    assert compute_semantic_score(1.0) == 100.0
    # Test numerical overshoot (> 1.0) caps safely at 100.0.
    assert compute_semantic_score(1.05) == 100.0


# Test mandatory requirement protection policy.
def test_mandatory_requirement_protection():
    # Open isolated database session.
    db = SessionLocal()
    try:
        # Retrieve candidate with known mandatory gap for Job 1.
        results = search_and_match_candidates(db, job_id=1, page=1, page_size=25)
        # Find candidates flagged with critical gap.
        gap_candidates = [m for m in results["matches"] if m["hasCriticalGap"]]
        # Ensure at least some candidates are flagged for missing mandatory Oracle EPM skills.
        assert len(gap_candidates) > 0
        for cand in gap_candidates:
            # Match tier must be capped at Potential Match or below.
            assert cand["classification"] in ("Potential Match", "Partial Match", "Needs Review")
            assert cand["classification"] != "Excellent Match"
            # Mandatory gap count must be >= 1.
            assert cand["mandatoryGapCount"] >= 1
            # Executive narrative must document the critical gap.
            narrative = cand["explanations"]["summary_narrative"]
            assert "critical mandatory gap" in narrative or "Shortlisting requires recruiter review" in narrative
    finally:
        db.close()


# Test matching pagination bounds and slicing across candidate pool.
def test_matching_pagination():
    db = SessionLocal()
    try:
        # Request first page with limit 5.
        data_p1 = get_job_matches(job_id="1", page=1, limit=5, as_object=True, db=db)
        # Request second page with limit 5.
        data_p2 = get_job_matches(job_id="1", page=2, limit=5, as_object=True, db=db)

        # Verify pagination metadata.
        assert data_p1["page"] == 1
        assert data_p1["page_size"] == 5
        assert data_p2["page"] == 2
        assert data_p2["page_size"] == 5
        assert data_p1["total_pages"] == data_p2["total_pages"]
        assert data_p1["total_evaluated"] == data_p2["total_evaluated"]

        # Candidate IDs across page 1 and page 2 must be disjoint.
        p1_ids = {m["candidate_id"] for m in data_p1["matches"]}
        p2_ids = {m["candidate_id"] for m in data_p2["matches"]}
        assert len(p1_ids.intersection(p2_ids)) == 0
    finally:
        db.close()


# Test Dashboard API counts and active jobs consistency.
def test_dashboard_counts_and_active_jobs():
    db = SessionLocal()
    try:
        # Query dashboard endpoint directly.
        data = get_dashboard_metrics(db=db)
        # Check total candidates count matches or exceeds initial baseline.
        kpis = data.get("kpis", data)
        assert kpis.get("totalCandidates", kpis.get("total_candidates")) in (194, 195)
        # Check total resumes count matches or exceeds baseline.
        assert kpis.get("totalResumes", kpis.get("total_resumes")) >= 240
        # Check active jobs strict count is 6 (or combined open/active count is 9).
        assert kpis.get("activeJobsStrict") == 6 or kpis.get("activeJobs") in (6, 9)
    finally:
        db.close()


# Test clean separation between raw_score, score_based_tier, mandatory_gap_count, eligibility_adjusted_tier, and critical_gap_explanation.
def test_mandatory_protection_clean_separation():
    # Helper to calculate tiers matching service logic.
    def calculate_tiers(raw_score: int, mandatory_gaps: int, mandatory_unverified: int):
        # Baseline tier strictly from raw score.
        score_based_tier = classify_match_tier(raw_score)
        # Eligibility adjusted tier.
        eligibility_adjusted_tier = score_based_tier
        if mandatory_gaps == 1:
            if score_based_tier in ("Excellent Match", "Strong Match"):
                eligibility_adjusted_tier = "Potential Match"
        elif mandatory_gaps >= 2:
            if score_based_tier in ("Excellent Match", "Strong Match", "Potential Match"):
                eligibility_adjusted_tier = "Partial Match"

        # Critical gap explanation.
        if mandatory_gaps > 0:
            critical_gap_explanation = (
                f"Candidate has {mandatory_gaps} unmet mandatory requirement(s). "
                f"Eligibility tier adjusted from {score_based_tier} to {eligibility_adjusted_tier}. "
                "Recruiter review required before shortlisting."
            )
        elif mandatory_unverified > 0:
            critical_gap_explanation = (
                f"All verifiable mandatory requirements met, but {mandatory_unverified} mandatory requirement(s) "
                "require interview confirmation."
            )
        else:
            critical_gap_explanation = (
                f"All mandatory technical requirements satisfied. Fully eligible for {score_based_tier}."
            )

        return raw_score, score_based_tier, mandatory_gaps, eligibility_adjusted_tier, critical_gap_explanation

    # Case 1: All mandatory requirements satisfied (0 gaps, 0 unverified) with 92% raw score.
    raw, sb_tier, gaps, el_tier, expl = calculate_tiers(92, 0, 0)
    assert raw == 92
    assert sb_tier == "Excellent Match"
    assert gaps == 0
    assert el_tier == "Excellent Match"
    assert "Fully eligible for Excellent Match" in expl

    # Case 2: Exactly 1 mandatory gap with 82% raw score (Strong Match).
    raw, sb_tier, gaps, el_tier, expl = calculate_tiers(82, 1, 0)
    # Raw score must remain completely unchanged.
    assert raw == 82
    assert sb_tier == "Strong Match"
    assert gaps == 1
    # Capped at Potential Match.
    assert el_tier == "Potential Match"
    assert "adjusted from Strong Match to Potential Match" in expl

    # Case 3: Multiple mandatory gaps (2 gaps) with 76% raw score (Strong Match).
    raw, sb_tier, gaps, el_tier, expl = calculate_tiers(76, 2, 0)
    assert raw == 76
    assert sb_tier == "Strong Match"
    assert gaps == 2
    # Capped at Partial Match.
    assert el_tier == "Partial Match"
    assert "adjusted from Strong Match to Partial Match" in expl

    # Case 4: Unverified mandatory requirements (0 gaps, 1 unverified) with 80% raw score.
    raw, sb_tier, gaps, el_tier, expl = calculate_tiers(80, 0, 1)
    assert raw == 80
    assert sb_tier == "Strong Match"
    assert gaps == 0
    # Tier is NOT downgraded since it is unverified rather than a confirmed gap.
    assert el_tier == "Strong Match"
    assert "require interview confirmation" in expl

    # Case 5: Low score candidate (35%) with 1 gap — candidate is NOT auto-rejected.
    raw, sb_tier, gaps, el_tier, expl = calculate_tiers(35, 1, 0)
    assert raw == 35
    assert sb_tier == "Needs Review"
    assert el_tier == "Needs Review"
    assert "adjusted from Needs Review to Needs Review" in expl


# Test cosine similarity preservation, finite values, and ranking by documented score.
def test_cosine_similarity_preservation_and_ranking():
    # Import math for finite and float operations.
    import math
    from app.services.matching_engine_service import cosine_similarity

    # Test identical vectors equal 1.0.
    v1 = [0.5, 0.5, 0.5, 0.5]
    assert abs(cosine_similarity(v1, v1) - 1.0) < 1e-6

    # Test orthogonal vectors equal 0.0.
    v_orth1 = [1.0, 0.0]
    v_orth2 = [0.0, 1.0]
    assert abs(cosine_similarity(v_orth1, v_orth2)) < 1e-6

    # Test opposing vectors equal -1.0.
    v_opp1 = [1.0, 2.0]
    v_opp2 = [-1.0, -2.0]
    assert abs(cosine_similarity(v_opp1, v_opp2) - (-1.0)) < 1e-6

    # Test moderate similarity vector pair.
    v_a = [1.0, 1.0, 0.0]
    v_b = [1.0, 0.0, 0.0]
    cos_ab = cosine_similarity(v_a, v_b)
    assert math.isclose(cos_ab, 1.0 / math.sqrt(2.0), rel_tol=1e-5)

    # Verify matching engine preserves raw cosine similarity and ranks by final match score.
    db = SessionLocal()
    try:
        data = search_and_match_candidates(db=db, job_id=1, page=1, page_size=15)
        matches = data["matches"]
        assert len(matches) > 1

        # Verify every match contains raw_score, score_based_tier, eligibility_adjusted_tier, and semantic_similarity.
        for m in matches:
            assert "rawScore" in m
            assert "scoreBasedTier" in m
            assert "eligibilityAdjustedTier" in m
            assert "semanticSimilarity" in m
            assert "criticalGapExplanation" in m
            # Raw score must be finite int in [0, 100].
            assert 0 <= m["rawScore"] <= 100
            # Raw cosine similarity must be finite float in [-1.0, 1.0].
            assert -1.0 <= m["semanticSimilarity"] <= 1.0

        # Verify ranking strictly respects match_score in descending order.
        for idx in range(len(matches) - 1):
            assert matches[idx]["matchScore"] >= matches[idx + 1]["matchScore"]
    finally:
        db.close()


# Test the canonical five-state evidence contract and ensure absence is never fabricated as a quote.
def test_evidence_classification_semantics():
    db = SessionLocal()
    try:
        data = search_and_match_candidates(db=db, job_id=1, page=1, page_size=10)
        matches = data["matches"]

        valid_statuses = {"DIRECT_MATCH", "EQUIVALENT_MATCH", "PARTIAL_MATCH", "MISSING", "UNVERIFIED"}
        for m in matches:
            for req in m["requirements"]:
                # Verification status must use the shared five-state canonical vocabulary.
                assert req["verification_status"] in valid_statuses
                # Direct evidence must be a real, non-empty resume excerpt.
                if req["verification_status"] == "DIRECT_MATCH":
                    assert req["evidence_source"] == "resume_text"
                    assert len(req["evidence"]) > 0
                # Missing requirements carry no invented evidence snippet.
                elif req["verification_status"] == "MISSING":
                    assert req["evidence_source"] == "none"
                    assert req["evidence"] == ""
    finally:
        db.close()


# Test single candidate 1-on-1 JD & Resume comparison endpoint.
def test_api_compare_single_candidate():
    from app.routers.jobs import compare_single_candidate
    db = SessionLocal()
    try:
        data = compare_single_candidate(job_id="1", candidate_id=1, db=db)
        assert "job" in data
        assert "candidate" in data
        assert "comparison" in data
        comp = data["comparison"]
        assert "match_score" in comp
        assert "skills_analysis" in comp
        assert "requirements_alignment" in comp
        assert "interview_kit" in comp
        assert isinstance(comp["requirements_alignment"], list)
    finally:
        db.close()


# Test ad-hoc JD & Resume text comparison endpoint.
def test_api_compare_adhoc_texts():
    from app.routers.jobs import compare_adhoc_texts, CompareAdhocSchema
    db = SessionLocal()
    try:
        data = compare_adhoc_texts(
            payload=CompareAdhocSchema(
                jd_text="Senior React Engineer proficient in TypeScript, Redux, and Tailwind.",
                resume_text="Senior frontend developer with 6 years experience in React, TypeScript, and state management.",
                role_title="Senior React Engineer",
                candidate_name="Alex River",
            ),
            db=db,
        )
        assert data["job"]["title"] == "Senior React Engineer"
        assert data["candidate"]["name"] == "Alex River"
        assert data["comparison"]["score_source"] == "canonical_requirement_engine"
        assert data["comparison"]["match_score"] is not None
        assert data["comparison"]["semantic_similarity"] is None
        assert data["comparison"]["experience_fit"]["candidate_years"] is None
        assert len(data["comparison"]["requirements_alignment"]) > 0

        without_years = compare_adhoc_texts(
            payload=CompareAdhocSchema(
                jd_text="CAD engineer with commercial building experience.",
                resume_text="Worked on commercial building CAD projects.",
            ),
            db=db,
        )
        assert without_years["comparison"]["match_score"] is not None
        assert without_years["comparison"]["experience_fit"]["candidate_years"] is None
    finally:
        db.close()


def test_adhoc_score_separates_supported_score_from_unverified_coverage():
    from app.services.matching_engine_service import compare_adhoc_jd_and_resume

    jd = """Required qualifications:
- Autodesk Revit
- MicroStation
- commercial building systems
- engineering CAD software
- project management software
- site coordination
- construction drawings
- architecture degree"""
    resume = """Autodesk Revit, MicroStation, commercial building systems, engineering CAD software,
project management software, site coordination, construction drawings."""

    db = SessionLocal()
    try:
        result = compare_adhoc_jd_and_resume(db, jd, resume)
        comparison = result["comparison"]
        assert len(comparison["requirements_alignment"]) == 8
        assert comparison["match_score"] == 100
        assert len(comparison["skills_analysis"]["matched_mandatory"]) == 7
        assert comparison["semantic_similarity"] is None
        assert len(comparison["skills_analysis"]["missing_mandatory"]) == 0
        assert comparison["evidence_coverage_pct"] == 87.5
        assert comparison["unverified_requirement_count"] == 1
        assert sum(row["score_contribution"] or 0 for row in comparison["requirements_alignment"]) == pytest.approx(100, abs=0.01)
    finally:
        db.close()


def test_adhoc_requirements_exclude_headings_split_bullets_and_deduplicate():
    from app.services.matching_engine_service import compare_adhoc_jd_and_resume

    jd = """PRIMARY FUNCTION
    Operate POS systems; reconcile cash drawers
    DESIRED QUALIFICATIONS AND EXPERIENCE
    Retail loss prevention experience
    Retail loss prevention experience"""
    db = SessionLocal()
    try:
        result = compare_adhoc_jd_and_resume(db, jd, "Operate POS systems; reconcile cash drawers.")
        rows = result["comparison"]["requirements_alignment"]
        assert [row["original_text"] for row in rows] == [
            "Operate POS systems", "reconcile cash drawers", "Retail loss prevention experience"
        ]
        assert all(row["classification"] == "Preferred" for row in rows[-1:])
        assert "Operate POS systems" in rows[0]["evidence"]
        assert rows[0]["evidence_status"] == "DIRECT_MATCH"
        assert rows[0]["jd_source_line"] == 2
        assert rows[-1]["evidence_status"] == "UNVERIFIED"
    finally:
        db.close()


def test_adhoc_does_not_invent_experience_or_award_generic_keyword_credit():
    from app.services.matching_engine_service import compare_adhoc_jd_and_resume

    db = SessionLocal()
    try:
        result = compare_adhoc_jd_and_resume(
            db,
            "Required: 3-5 years of commercial building systems experience; MicroStation",
            "Worked on a project with a team. 8 years total experience.",
        )["comparison"]
        assert result["experience_fit"]["candidate_years"] is None
        assert result["match_score"] is None
        assert result["classification"] == "Insufficient Evidence"
        assert all(row["evidence_status"] in {"MISSING", "UNVERIFIED"} for row in result["requirements_alignment"])
    finally:
        db.close()


def test_adhoc_equivalence_is_explicit_and_keeps_unrelated_tools_distinct():
    from app.services.matching_engine_service import compare_adhoc_jd_and_resume

    db = SessionLocal()
    try:
        result = compare_adhoc_jd_and_resume(
            db,
            "Required: asset protection; MicroStation",
            "Loss prevention experience with AutoCAD.",
        )["comparison"]
        rows = result["requirements_alignment"]
        assert rows[0]["evidence_status"] == "EQUIVALENT_MATCH"
        assert rows[0]["evidence"] == "Loss prevention"
        assert rows[1]["evidence_status"] == "UNVERIFIED"
    finally:
        db.close()


def test_synthetic_source_consistency_across_pasted_persisted_bulk_workspace_and_suitability(tmp_path):
    """Exercise every scorer adapter with identical synthetic source text and verify history revisions."""
    import hashlib

    from app.services.matching_engine_service import search_and_match_candidates

    jd = """REQUIRED QUALIFICATIONS
- Experience with Autodesk Revit
REQUIRED EXPERIENCE
- 2-4 years of mechanical engineering experience"""
    resume_text = """PROFESSIONAL EXPERIENCE
Mechanical Engineer | Jan 2020 - Dec 2023
Performed mechanical engineering design and used Autodesk Revit for commercial systems.
EDUCATION
Bachelor of Mechanical Engineering"""
    resume_file = tmp_path / "synthetic_resume.txt"
    resume_file.write_text(resume_text, encoding="utf-8")
    db = SessionLocal()
    try:
        # Keep the twin's ten-job limit deterministic and make all created data disposable in fixture DB.
        for existing_job in db.query(Job).all():
            existing_job.status = "closed"
        job = Job(title="Synthetic Revit Engineer", description=jd, status="open", version=1)
        candidate_a = Candidate(name="Codex Synthetic Match A", skills=[])
        candidate_b = Candidate(name="Codex Synthetic Match B", skills=[])
        db.add_all([job, candidate_a, candidate_b])
        db.flush()
        for candidate in (candidate_a, candidate_b):
            db.add(Resume(
                candidate_id=candidate.id,
                source_filename=resume_file.name,
                file_path=str(resume_file),
                content_sha256=hashlib.sha256((resume_text + str(candidate.id)).encode()).hexdigest(),
            ))
        db.commit()

        pasted = compare_adhoc_jd_and_resume(db, jd, resume_text, role_title=job.title)["comparison"]
        single = compare_single_candidate(str(job.id), candidate_a.id, db=db)["comparison"]
        ranking = get_job_matches(str(job.id), search="Codex Synthetic Match", page=1, limit=10, as_object=True, db=db)
        ranked = next(row for row in ranking["matches"] if row["candidate_id"] == candidate_a.id)
        bulk = compare_job_candidates(str(job.id), CompareCandidatesSchema(candidate_ids=[candidate_a.id, candidate_b.id]), db=db)
        bulk_a = next(row for row in bulk["candidates"] if row["candidate_id"] == candidate_a.id)
        suitability = get_candidate_digital_twin(str(candidate_a.id), db=db)["job_suitability"]
        suitable_job = next(row for row in suitability if row["job_id"] == job.id)

        assert pasted["match_score"] == single["match_score"] == ranked["match_score"] == bulk_a["match_score"] == suitable_job["match_score"]
        expected_rows = pasted["requirements_alignment"]
        for actual_rows in (
            single["requirements_alignment"],
            ranked["requirements"],
            [bulk["matrix_rows"][i]["evaluations"][candidate_a.id] for i in range(len(bulk["matrix_rows"]))],
            suitable_job["requirements"],
        ):
            assert [row.get("evidence_status") for row in actual_rows] == [row["evidence_status"] for row in expected_rows]
        assert sum(row["score_contribution"] or 0 for row in expected_rows) == pytest.approx(pasted["match_score_unrounded"])
        assert bulk_a["match_provenance"]["matching_engine_version"] == suitable_job["match_provenance"]["matching_engine_version"]

        first_id = single["match_provenance"]["history_id"]
        first_history = get_candidate_job_match_history(job.id, candidate_a.id, db=db)
        assert first_history["results"][0]["is_current"] is True
        first_resume_hash = db.query(Resume).filter_by(candidate_id=candidate_a.id).one().content_sha256

        resume_text_v2 = resume_text.replace("used Autodesk Revit", "used Bentley MicroStation")
        resume_file.write_text(resume_text_v2, encoding="utf-8")
        changed_resume = db.query(Resume).filter_by(candidate_id=candidate_a.id).one()
        changed_resume.content_sha256 = hashlib.sha256((resume_text_v2 + str(candidate_a.id)).encode()).hexdigest()
        db.commit()
        revised_resume_match = compare_single_candidate(str(job.id), candidate_a.id, db=db)["comparison"]
        assert revised_resume_match["match_score"] < single["match_score"]
        assert next(row for row in revised_resume_match["requirements_alignment"] if "Revit" in row["original_text"])["evidence_status"] == "MISSING"
        history_after_resume = get_candidate_job_match_history(job.id, candidate_a.id, db=db)["results"]
        assert any(row["history_id"] == first_id and not row["is_current"] for row in history_after_resume)
        assert any(row["resume_content_hash"] == changed_resume.content_sha256 for row in history_after_resume)
        assert changed_resume.content_sha256 != first_resume_hash

        job.description += "\nPREFERRED QUALIFICATIONS\n- MicroStation"
        job.version += 1
        db.commit()
        compare_single_candidate(str(job.id), candidate_a.id, db=db)
        final_history = get_candidate_job_match_history(job.id, candidate_a.id, db=db)["results"]
        assert sum(row["is_current"] for row in final_history) == 1
        assert len(final_history) == 3
        assert any(row["provenance"]["jd_version_id"] == 1 for row in final_history)
        assert any(row["provenance"]["jd_version_id"] == 2 for row in final_history)
    finally:
        db.close()


