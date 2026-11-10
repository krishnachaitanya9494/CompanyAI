"""Tests for local identifier redaction and outbound privacy validation."""  # Describe the synthetic-only privacy tests.

from dataclasses import replace  # Create altered immutable results for integrity-gate tests.

import pytest  # Assert redaction failures without making network calls.

from app.resume_privacy import PrivacyError, PrivacyMappingError, RedactedText, redact_pii, validate_outbound_text  # Import local-only privacy helpers.


def test_redacts_synthetic_email_and_phone_without_changing_source() -> None:  # Verify common direct identifiers are masked.
    original = "Contact synthetic.person@example.test or +1 (212) 555-0142."  # Use fabricated contact details only.
    result = redact_pii(original)  # Build a separate sanitized representation.
    assert original == "Contact synthetic.person@example.test or +1 (212) 555-0142."  # Confirm the caller's source string is unchanged.
    assert "[REDACTED_EMAIL_1]" in result.sanitized_text  # Confirm the email receives a typed placeholder.
    assert "[REDACTED_PHONE_1]" in result.sanitized_text  # Confirm the phone receives a typed placeholder.
    assert "synthetic.person@example.test" not in validate_outbound_text(result)  # Confirm the outbound gate excludes the email.
    assert "+1 (212) 555-0142" not in validate_outbound_text(result)  # Confirm the outbound gate excludes the phone.


def test_redacts_multiple_identifiers_and_maps_each_occurrence() -> None:  # Verify ordered offsets across several redactions.
    original = "A synthetic.one@example.test B +1-212-555-0101 C synthetic.two@example.test."  # Use multiple fabricated identifiers.
    result = redact_pii(original)  # Redact all identifier occurrences in one pass.
    assert result.sanitized_text.count("[REDACTED_EMAIL_") == 2  # Confirm both distinct email addresses were found.
    assert result.sanitized_text.count("[REDACTED_PHONE_") == 1  # Confirm the phone was found between both emails.
    for span in result.spans:  # Verify each mapping refers to its exact original identifier.
        assert original[span.original_start:span.original_end]  # Confirm every source span is non-empty.
        assert result.sanitized_text[span.sanitized_start:span.sanitized_end] == span.replacement  # Confirm each output marker is exact.
        assert result.original_range(span.sanitized_start, span.sanitized_end) == (span.original_start, span.original_end)  # Confirm exact reverse range mapping.
    assert validate_outbound_text(result) == result.sanitized_text  # Confirm only the sanitized string passes the gate.


def test_maps_unchanged_offsets_after_multiple_replacements() -> None:  # Verify length shifts do not corrupt later evidence offsets.
    original = "Before synthetic.one@example.test middle +1-212-555-0101 after."  # Use a synthetic text with known stable suffixes.
    result = redact_pii(original)  # Redact both contact details while preserving all other text.
    suffix = " after."  # Select a unique unchanged suffix for offset comparison.
    sanitized_start = result.sanitized_text.index(suffix)  # Locate the suffix after replacement length changes.
    original_start = original.index(suffix)  # Locate the same suffix in unchanged source text.
    assert result.original_offset(sanitized_start) == original_start  # Confirm accumulated offsets map exactly.
    assert result.original_range(sanitized_start, sanitized_start + len(suffix)) == (original_start, original_start + len(suffix))  # Confirm full evidence range mapping.


def test_rejects_offsets_inside_replacement_tokens() -> None:  # Avoid guessing source positions from placeholder interiors.
    result = redact_pii("Email synthetic.user@example.test.")  # Redact a synthetic address.
    span = result.spans[0]  # Select its local mapping record.
    with pytest.raises(PrivacyMappingError):  # Require ambiguous interior offsets to fail closed.
        result.original_offset(span.sanitized_start + 1)  # Request a point inside the replacement marker.
    with pytest.raises(PrivacyMappingError):  # Require partial-token evidence ranges to fail closed.
        result.original_range(span.sanitized_start + 1, span.sanitized_end)  # Start the range inside the marker.


def test_already_sanitized_text_passes_with_no_mapping_entries() -> None:  # Permit synthetic content that has no detectable identifiers.
    result = redact_pii("Skills: Python, SQL; experience: five years.")  # Use fabricated professional text only.
    assert result.spans == ()  # Confirm there are no unnecessary mapping records.
    assert validate_outbound_text(result) == result.sanitized_text  # Confirm unchanged safe text passes the gate.


def test_redacts_labeled_and_caller_supplied_name_identifiers() -> None:  # Cover direct identifiers not reliably inferable by format.
    original = "Name: Synthetic Candidate\nProject: Synthetic Candidate Platform"  # Use fabricated name-like text only.
    result = redact_pii(original, additional_identifiers=("Synthetic Candidate",))  # Supply the known local name explicitly.
    assert "[REDACTED_LABELED_IDENTIFIER_1]" in result.sanitized_text  # Confirm labeled name values are detected.
    assert "[REDACTED_ADDITIONAL_IDENTIFIER_1]" in result.sanitized_text  # Confirm additional names are locally redacted.
    assert "Synthetic Candidate" not in validate_outbound_text(result)  # Confirm the personal identifier cannot pass outbound.


def test_rejects_raw_text_and_fabricated_or_tampered_results() -> None:  # Require trusted, unchanged redactor output at the gate.
    with pytest.raises(PrivacyError):  # Reject plain strings that did not pass redaction.
        validate_outbound_text("synthetic.person@example.test")  # Attempt to submit raw synthetic contact text.
    original_result = redact_pii("Skills: Python.")  # Create a trusted result for integrity testing.
    tampered = replace(original_result, sanitized_text="Contact synthetic.person@example.test")  # Alter the validated payload after redaction.
    with pytest.raises(PrivacyError):  # Reject any mismatch between source, map, and sanitized content.
        validate_outbound_text(tampered)  # Attempt outbound validation after tampering.
    fabricated = RedactedText("Safe-looking text", (), "Safe-looking text", (), object())  # Construct an untrusted result manually.
    with pytest.raises(PrivacyError):  # Reject results that lack the module's private verification marker.
        validate_outbound_text(fabricated)  # Attempt outbound validation without the trusted redactor.


def test_rejects_invalid_additional_identifier_configuration() -> None:  # Fail closed on unusable local identifier rules.
    with pytest.raises(PrivacyError):  # Require short identifiers to be rejected rather than overmatched.
        redact_pii("Synthetic text", additional_identifiers=("x",))  # Supply an unsafe single-character rule.
