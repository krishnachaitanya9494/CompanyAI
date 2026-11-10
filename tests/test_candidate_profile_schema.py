"""Tests for strict evidence-linked candidate profile validation."""  # Describe the synthetic-only schema tests.

from datetime import date, datetime, timezone  # Create deterministic typed date values for validation.
from decimal import Decimal  # Construct exact synthetic compensation values.

import pytest  # Assert validation failures without contacting external services.
from pydantic import ValidationError  # Check that invalid profile data is rejected.

from app.candidate_profile_schema import CandidateProfile, CompensationValue, EvidenceReference, FieldValue, NonNegativeInt, ResumeProvenance  # Import only local schema models.


def make_provenance() -> ResumeProvenance:  # Build synthetic source lineage for isolated model tests.
    return ResumeProvenance(  # Return complete provenance with non-sensitive fabricated values.
        source_id="synthetic-source-001",  # Use an opaque synthetic source identifier.
        file_sha256="a" * 64,  # Provide a deterministic synthetic file digest.
        source_format="txt",  # Use a supported text source format.
        extracted_text_sha256="b" * 64,  # Provide a deterministic synthetic text digest.
        extractor_version="test-extractor-1",  # Identify the synthetic test parser.
        schema_version="1",  # Identify the candidate profile schema.
        extracted_at=datetime(2025, 1, 1, tzinfo=timezone.utc),  # Use a fixed timezone-aware test timestamp.
    )  # Finish creating synthetic provenance.


def make_evidence() -> EvidenceReference:  # Build a traceable synthetic source excerpt.
    return EvidenceReference(  # Return evidence with both page and character coordinates.
        source_id="synthetic-source-001",  # Link evidence to the synthetic provenance record.
        quote="Python developer",  # Use a fabricated phrase rather than resume content.
        page_number=1,  # Identify the first synthetic source page.
        start_char=0,  # Mark the inclusive source-text offset.
        end_char=16,  # Mark the exclusive source-text offset.
    )  # Finish creating the evidence reference.


def test_valid_profile_preserves_extracted_and_normalized_values() -> None:  # Verify normal structured profile creation.
    skill = FieldValue[str](status="found", extracted_text="Python", normalized_value="python", evidence=[make_evidence()])  # Preserve source and canonical skill forms.
    profile = CandidateProfile(provenance=make_provenance(), technical_skills=[skill])  # Build a minimal valid profile.
    assert profile.technical_skills[0].extracted_text == "Python"  # Confirm original wording remains unchanged.
    assert profile.technical_skills[0].normalized_value == "python"  # Confirm normalized text stays separate.
    assert profile.provenance.source_id == "synthetic-source-001"  # Confirm provenance is attached.
    assert profile.education == [] and profile.employment_history == []  # Confirm omitted sections default to empty lists.


def test_missing_values_are_explicit_and_do_not_invent_data() -> None:  # Verify absent facts have no fabricated values.
    profile = CandidateProfile(provenance=make_provenance())  # Leave every optional candidate field unspecified.
    assert profile.candidate_name.status == "missing"  # Keep absent name information explicit.
    assert profile.candidate_name.extracted_text is None  # Do not invent source wording.
    assert profile.candidate_name.normalized_value is None  # Do not invent a normalized name.
    assert profile.candidate_name.evidence == []  # Do not attach unsupported evidence.


def test_ambiguous_values_keep_evidence_but_no_normalized_choice() -> None:  # Preserve conflicting source evidence without guessing.
    ambiguous = FieldValue[int](status="ambiguous", extracted_text="5 or 6 years", evidence=[make_evidence()])  # Keep the source phrase and evidence.
    assert ambiguous.normalized_value is None  # Do not choose one of the conflicting values.
    assert ambiguous.status == "ambiguous"  # Preserve the uncertainty state.


def test_evidence_supports_page_block_or_character_locations() -> None:  # Validate accepted evidence location forms.
    block_evidence = EvidenceReference(source_id="synthetic", quote="Project summary", block_id="paragraph-2")  # Use a synthetic non-paginated source block.
    offset_evidence = EvidenceReference(source_id="synthetic", quote="skill", start_char=4, end_char=9)  # Use a synthetic source-text range.
    assert block_evidence.block_id == "paragraph-2"  # Confirm block provenance is retained.
    assert offset_evidence.end_char == 9  # Confirm offset provenance is retained.


def test_invalid_profile_data_and_unknown_fields_are_rejected() -> None:  # Reject invalid values instead of coercing or ignoring them.
    with pytest.raises(ValidationError):  # Require malformed source digests to fail validation.
        ResumeProvenance(source_id="synthetic", file_sha256="not-a-digest", source_format="txt", extracted_text_sha256="b" * 64, extractor_version="1", schema_version="1", extracted_at=datetime.now(timezone.utc))  # Supply an invalid synthetic digest.
    with pytest.raises(ValidationError):  # Require undeclared model fields to fail validation.
        CandidateProfile(provenance=make_provenance(), unexpected="not allowed")  # Supply an unsupported extra field.
    with pytest.raises(ValidationError):  # Require negative normalized experience to fail validation.
        FieldValue[NonNegativeInt](status="found", extracted_text="-1 months", normalized_value=-1, evidence=[make_evidence()])  # Supply an invalid negative value to the constrained experience type.
    with pytest.raises(ValidationError):  # Require a normalized result for an ambiguous value to fail validation.
        FieldValue[int](status="ambiguous", extracted_text="5 or 6", normalized_value=5, evidence=[make_evidence()])  # Attempt to resolve an ambiguity without support.


def test_missing_field_cannot_contain_values_or_evidence() -> None:  # Ensure missing status cannot hide unsupported data.
    with pytest.raises(ValidationError):  # Require contradictory missing state to fail validation.
        FieldValue[str](status="missing", extracted_text="Python", evidence=[make_evidence()])  # Supply data marked as absent.


def test_evidence_ranges_must_be_complete_and_nonempty() -> None:  # Reject invalid or untraceable source offsets.
    with pytest.raises(ValidationError):  # Require paired endpoints rather than partial offsets.
        EvidenceReference(source_id="synthetic", quote="value", start_char=3)  # Provide only one endpoint.
    with pytest.raises(ValidationError):  # Require a non-empty half-open range.
        EvidenceReference(source_id="synthetic", quote="value", start_char=4, end_char=4)  # Provide an empty range.
    with pytest.raises(ValidationError):  # Require an evidence location.
        EvidenceReference(source_id="synthetic", quote="value")  # Omit page, block, and offset location data.


def test_typed_date_values_are_supported() -> None:  # Verify date-typed profile fields preserve normalized dates.
    start = FieldValue[date](status="found", extracted_text="Jan 2020", normalized_value=date(2020, 1, 1), evidence=[make_evidence()])  # Create a synthetic employment start date.
    assert start.normalized_value == date(2020, 1, 1)  # Confirm the typed date is preserved.


def test_compensation_requires_explicit_currency_and_period() -> None:  # Preserve financial units instead of inferring them.
    compensation = CompensationValue(amount=Decimal("1250.00"), currency="INR", period="monthly")  # Use fabricated exact compensation data.
    assert compensation.amount == Decimal("1250.00")  # Confirm amount precision is preserved.
    assert compensation.currency == "INR" and compensation.period == "monthly"  # Confirm explicit units remain attached.
    with pytest.raises(ValidationError):  # Reject an absent currency rather than assuming one.
        CompensationValue(amount=Decimal("1250.00"), currency="IN", period="monthly")  # Supply an invalid currency code.
