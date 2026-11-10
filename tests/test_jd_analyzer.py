"""Mocked tests for privacy filtering and evidence-backed JD analysis."""

# Import SHA-256 support for temporary manifest source records.
import hashlib

# Import JSON support for mocked model responses and temporary manifests.
import json

# Import datetime helpers for valid test analysis records.
from datetime import datetime, timezone

# Import Path for temporary source and analysis files.
from pathlib import Path

# Import Mock for isolated HTTP and analyzer responses.
from unittest.mock import Mock

# Import HTTPX exceptions to assert safe client behavior without network access.
import httpx

# Import pytest helpers for temporary paths, parametrization, and assertions.
import pytest

# Import Pydantic validation errors for schema rejection tests.
from pydantic import ValidationError

# Import the schema classes used to construct mocked results.
from app.jd_schema import EvidenceNumber, EvidenceReference, EvidenceText, JDAnalysisRecord, JDRequirements

# Import the analyzer functions and configuration classes under test.
from app.jd_analyzer import (
    JDAnalysisError,
    OpenRouterLLMConfig,
    analyze_jd_text,
    get_openrouter_llm_config,
    sanitize_jd_text,
)

# Import the manifest batch functions without starting the CLI.
from scripts import analyze_jds


# Build a source string with personal and resume-related lines for sanitizer tests.
def _sample_jd() -> str:
    """Return synthetic text with safe requirements and removable notes."""

    # Keep the sample fictional and avoid real company or candidate data.
    return "\n".join(
        [
            "Sample Engineer",
            "================",
            "EXPERIENCE: 6 years based on resume notes",
            "ROLE SUMMARY",
            "Design reliable tools.",
            "REQUIRED SKILLS & EXPERIENCE",
            "- Python",
            "SOURCE NOTES / VALIDATION",
            "Resume notes mention six years of experience.",
            "PREFERRED SKILLS",
            "- Git",
            "Email: private.person@example.test",
        ]
    )


# Build an API response containing only requirements with verifiable source evidence.
def _model_requirements_json() -> str:
    """Return synthetic JSON with source-backed title and skill values."""

    # Construct the required job-title value with an exact source quote.
    response_body = {
        "job_title": {
            "value": "Sample Engineer",
            "evidence": {
                "section": "JOB TITLE",
                "source_line": 100,
                "quote": "Sample Engineer",
            },
        },
        "required_skills": [
            {
                "value": "Python",
                "evidence": {
                    "section": "REQUIRED SKILLS & EXPERIENCE",
                    "source_line": 106,
                    "quote": "- Python",
                },
            }
        ],
        "preferred_skills": [
            {
                "value": "Git",
                "evidence": {
                    "section": "PREFERRED SKILLS",
                    "source_line": 110,
                    "quote": "- Git",
                },
            }
        ],
    }

    # Serialize the synthetic result exactly as an API would return it.
    return json.dumps(response_body)


# Build an inert config so every network request can be intercepted by a mock.
def _fake_config() -> OpenRouterLLMConfig:
    """Return fake OpenRouter values that must never leave the test process."""

    # Use the real OpenRouter endpoint constant with a non-secret test credential.
    return OpenRouterLLMConfig(
        api_key="test-openrouter-key",
        model="nvidia/nemotron-3.5-super-vl",
        endpoint="https://openrouter.ai/api/v1/chat/completions",
    )


# Verify source notes and direct contact details are removed before API calls.
def test_sanitizer_excludes_resume_notes_and_personal_contact() -> None:
    """Retain safe JD text and preserve original line and section references."""

    # Sanitize synthetic source text that starts at source line 100.
    safe_jd = sanitize_jd_text(_sample_jd(), source_start_line=100)

    # Combine safe lines only to check that sensitive source strings are absent.
    prompt_text = safe_jd.prompt_text

    # Confirm every resume-related note and direct email is excluded.
    assert "resume" not in prompt_text.casefold()
    assert "private.person@example.test" not in prompt_text
    assert "SOURCE NOTES / VALIDATION" not in prompt_text

    # Confirm the intended job text remains available to the analyzer.
    assert "Design reliable tools." in prompt_text
    assert "Python" in prompt_text
    assert "Git" in prompt_text

    # Confirm evidence references keep their original source section and line.
    assert any(line.source_line == 106 and line.section == "REQUIRED SKILLS & EXPERIENCE" for line in safe_jd.lines)
    assert any(line.source_line == 110 and line.section == "PREFERRED SKILLS" for line in safe_jd.lines)


# Verify the chat model is separate from the OpenRouter embedding model.
def test_openrouter_llm_uses_shared_key_and_separate_model(monkeypatch: pytest.MonkeyPatch) -> None:
    """Require the existing key and OPENROUTER_LLM_MODEL independently."""

    # Provide the shared OpenRouter key and remove the separate chat model.
    monkeypatch.setenv("OPENROUTER_API_KEY", "openrouter-test-key")
    monkeypatch.delenv("OPENROUTER_LLM_MODEL", raising=False)

    # Confirm the chat model is required even when the shared key is present.
    with pytest.raises(JDAnalysisError, match="OPENROUTER_LLM_MODEL"):
        get_openrouter_llm_config()

    # Configure distinct embedding and chat model values for the same provider.
    monkeypatch.setenv("OPENROUTER_EMBEDDING_MODEL", "nvidia/test-embedding-model")
    monkeypatch.setenv("OPENROUTER_LLM_MODEL", "nvidia/nemotron-3.5-super-vl")
    config = get_openrouter_llm_config()

    # Confirm the existing key is reused and the chat model stays independent.
    assert config.api_key == "openrouter-test-key"
    assert config.model == "nvidia/nemotron-3.5-super-vl"
    assert config.model != "nvidia/test-embedding-model"
    assert config.endpoint == "https://openrouter.ai/api/v1/chat/completions"


# Verify mocked output is schema-checked and evidence-linked.
def test_analyzer_sends_only_sanitized_text_and_preserves_verified_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Keep valid requirements and request OpenRouter JSON-object mode."""

    # Prepare a mock response with no connection to an external provider.
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "choices": [{"message": {"content": _model_requirements_json()}}]
    }

    # Replace HTTPX with the mock before invoking the analyzer.
    post_mock = Mock(return_value=response)
    monkeypatch.setattr("app.jd_analyzer.httpx.post", post_mock)

    # Analyze synthetic text with stable fake source digests and line references.
    result = analyze_jd_text(
        jd_id="JD-001",
        source_filename="All_7_Tailored_JDs.txt",
        source_sha256="a" * 64,
        content_sha256="b" * 64,
        original_text=_sample_jd(),
        source_start_line=100,
        config=_fake_config(),
    )

    # Verify the record remains linked to the original source ID and filename.
    assert result.jd_id == "JD-001"
    assert result.source_filename == "All_7_Tailored_JDs.txt"

    # Verify only source-supported skills remain and resume-derived experience is null.
    assert [item.value for item in result.requirements.required_skills] == ["Python"]
    assert [item.value for item in result.requirements.preferred_skills] == ["Git"]
    assert result.requirements.minimum_experience_years is None
    assert result.requirements.other_requirements == []

    # Verify the mocked OpenRouter endpoint received one request only.
    post_mock.assert_called_once()
    assert post_mock.call_args.args[0] == "https://openrouter.ai/api/v1/chat/completions"
    assert post_mock.call_args.kwargs["headers"]["Authorization"] == "Bearer test-openrouter-key"
    assert post_mock.call_args.kwargs["json"]["model"] == "nvidia/nemotron-3.5-super-vl"
    assert post_mock.call_args.kwargs["json"]["reasoning"] == {"effort": "low"}
    assert post_mock.call_args.kwargs["json"]["response_format"] == {"type": "json_object"}
    assert post_mock.call_args.kwargs["json"]["provider"] == {"require_parameters": True}

    # Inspect the request's user message without exposing any source text in test output.
    sent_payload = post_mock.call_args.kwargs["json"]
    sent_user_message = sent_payload["messages"][1]["content"]

    # Confirm the request contains neither source notes nor resume-derived text or email.
    assert "SOURCE NOTES / VALIDATION" not in sent_user_message
    assert "resume" not in sent_user_message.casefold()
    assert "private.person@example.test" not in sent_user_message


# Verify JSON objects wrapped in a single Markdown code fence are parsed safely.
def test_analyzer_accepts_json_code_fence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Parse a fenced JSON object and retain the existing schema checks."""

    # Wrap a valid synthetic response in the common json-labelled Markdown fence.
    fenced_json = f"```json\n{_model_requirements_json()}\n```"
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"choices": [{"message": {"content": fenced_json}}]}

    # Intercept HTTPX so no external request is made.
    monkeypatch.setattr("app.jd_analyzer.httpx.post", Mock(return_value=response))

    # Confirm the fenced object still yields validated requirements.
    result = analyze_jd_text(
        jd_id="JD-001",
        source_filename="sample.txt",
        source_sha256="a" * 64,
        content_sha256="b" * 64,
        original_text=_sample_jd(),
        source_start_line=100,
        config=_fake_config(),
    )
    assert result.requirements.job_title is not None
    assert result.requirements.job_title.value == "Sample Engineer"


# Verify omitted schema keys receive only the schema's null and empty-list defaults.
def test_analyzer_uses_defaults_for_missing_requirement_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Keep omitted requirements empty instead of inferring values."""

    # Return a valid but partial object without any populated requirement claims.
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "choices": [{"message": {"content": json.dumps({"required_skills": []})}}]
    }

    # Intercept HTTPX so the test never contacts the hosted model.
    monkeypatch.setattr("app.jd_analyzer.httpx.post", Mock(return_value=response))

    # Confirm omitted fields remain null or empty according to JDRequirements.
    result = analyze_jd_text(
        jd_id="JD-001",
        source_filename="sample.txt",
        source_sha256="a" * 64,
        content_sha256="b" * 64,
        original_text=_sample_jd(),
        config=_fake_config(),
    )
    assert result.requirements.job_title is None
    assert result.requirements.minimum_experience_years is None
    assert result.requirements.required_skills == []
    assert result.requirements.certifications == []


# Verify text content blocks are joined in their original order before JSON parsing.
def test_analyzer_accepts_ordered_text_content_blocks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Accept supported text blocks while preserving strict schema validation."""

    # Split a valid synthetic schema response across two ordered text blocks.
    model_json = _model_requirements_json()
    split_at = len(model_json) // 2
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": [
                        {"type": "text", "text": model_json[:split_at]},
                        {"type": "text", "text": model_json[split_at:]},
                    ]
                }
            }
        ]
    }

    # Intercept HTTPX so the test uses only the mocked completion response.
    monkeypatch.setattr("app.jd_analyzer.httpx.post", Mock(return_value=response))

    # Confirm normalized text still passes through the existing requirements schema.
    result = analyze_jd_text(
        jd_id="JD-001",
        source_filename="sample.txt",
        source_sha256="a" * 64,
        content_sha256="b" * 64,
        original_text=_sample_jd(),
        source_start_line=100,
        config=_fake_config(),
    )
    assert [item.value for item in result.requirements.required_skills] == ["Python"]


# Verify explicit null values for schema list fields normalize to empty arrays.
def test_analyzer_normalizes_null_list_fields_to_empty_lists(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Treat absent list requirements as empty without loosening item validation."""

    # Start with a conforming synthetic response and make two lists explicitly null.
    response_body = json.loads(_model_requirements_json())
    response_body["education_requirements"] = None
    response_body["certifications"] = None
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "choices": [{"message": {"content": json.dumps(response_body)}}]
    }

    # Intercept HTTPX so the test cannot call the hosted API.
    monkeypatch.setattr("app.jd_analyzer.httpx.post", Mock(return_value=response))

    # Confirm null list fields become empty while other evidence validation remains active.
    result = analyze_jd_text(
        jd_id="JD-001",
        source_filename="sample.txt",
        source_sha256="a" * 64,
        content_sha256="b" * 64,
        original_text=_sample_jd(),
        source_start_line=100,
        config=_fake_config(),
    )
    assert result.requirements.education_requirements == []
    assert result.requirements.certifications == []


# Verify fabricated evidence is rejected with safe field paths, not returned or logged.
def test_analyzer_rejects_unverifiable_evidence_safely(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reject a model quote that does not match the referenced original JD line."""

    # Use a synthetic fake quote that cannot match the JD and must stay out of errors.
    response_body = json.loads(_model_requirements_json())
    response_body["job_title"]["evidence"]["quote"] = "SENSITIVE_SENTINEL_FABRICATED"
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "choices": [{"message": {"content": json.dumps(response_body)}}]
    }

    # Intercept HTTPX so no real API call is made.
    monkeypatch.setattr("app.jd_analyzer.httpx.post", Mock(return_value=response))

    # Confirm the error identifies only the fixed schema path.
    with pytest.raises(JDAnalysisError, match=r"evidence.*requirements\.job_title") as error:
        analyze_jd_text(
            jd_id="JD-001",
            source_filename="sample.txt",
            source_sha256="a" * 64,
            content_sha256="b" * 64,
            original_text=_sample_jd(),
            source_start_line=100,
            config=_fake_config(),
        )
    assert "SENSITIVE_SENTINEL_FABRICATED" not in str(error.value)


# Verify unsupported text blocks are rejected without exposing their contents.
def test_analyzer_rejects_unsupported_content_blocks_safely(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reject non-text blocks without including model-provided values in errors."""

    # Include a sentinel in an unsupported block to check sanitized error handling.
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": [
                        {"type": "text", "text": "{"},
                        {"type": "image", "data": "SENSITIVE_SENTINEL_BLOCK"},
                    ]
                }
            }
        ]
    }

    # Intercept HTTPX so the test never contacts OpenRouter.
    monkeypatch.setattr("app.jd_analyzer.httpx.post", Mock(return_value=response))

    # Confirm the generic error omits all response content.
    with pytest.raises(JDAnalysisError, match="unsupported blocks") as error:
        analyze_jd_text(
            jd_id="JD-001",
            source_filename="sample.txt",
            source_sha256="a" * 64,
            content_sha256="b" * 64,
            original_text="Sample Engineer",
            config=_fake_config(),
        )
    assert "SENSITIVE_SENTINEL_BLOCK" not in str(error.value)


# Verify null message content is rejected with a generic sanitized error.
def test_analyzer_rejects_null_message_content_safely(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reject null content without attempting to parse or expose it."""

    # Return a valid envelope whose content is explicitly null.
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "choices": [
            {
                "finish_reason": "length",
                "message": {"content": None},
            }
        ]
    }

    # Intercept HTTPX so the test makes no external request.
    monkeypatch.setattr("app.jd_analyzer.httpx.post", Mock(return_value=response))

    # Confirm token exhaustion yields safe advice without exposing response data.
    with pytest.raises(JDAnalysisError, match="token limit.*increase the completion token budget"):
        analyze_jd_text(
            jd_id="JD-001",
            source_filename="sample.txt",
            source_sha256="a" * 64,
            content_sha256="b" * 64,
            original_text="Sample Engineer",
            config=_fake_config(),
        )


# Verify refusal responses become generic errors without exposing refusal text.
def test_analyzer_reports_refusal_without_exposing_refusal_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Detect a provider refusal before parsing content and keep it private."""

    # Put a synthetic sensitive sentinel in the refusal field for sanitization.
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": None,
                    "refusal": "SENSITIVE_SENTINEL_REFUSAL",
                }
            }
        ]
    }

    # Intercept HTTPX so the test never sends a request to OpenRouter.
    monkeypatch.setattr("app.jd_analyzer.httpx.post", Mock(return_value=response))

    # Confirm refusal detection is generic and does not include its text.
    with pytest.raises(JDAnalysisError, match="refused the request") as error:
        analyze_jd_text(
            jd_id="JD-001",
            source_filename="sample.txt",
            source_sha256="a" * 64,
            content_sha256="b" * 64,
            original_text="Sample Engineer",
            config=_fake_config(),
        )
    assert "SENSITIVE_SENTINEL_REFUSAL" not in str(error.value)


# Verify Pydantic failures expose safe paths and categories without input values.
def test_analyzer_rejects_schema_invalid_model_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reject invalid fields and report only sanitized Pydantic diagnostics."""

    # Put a sensitive sentinel in the invalid value to prove it is not reported.
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {"required_skills": ["SENSITIVE_SENTINEL_VALUE"]}
                    )
                }
            }
        ]
    }

    # Intercept the request so the test never contacts OpenRouter.
    monkeypatch.setattr("app.jd_analyzer.httpx.post", Mock(return_value=response))

    # Confirm the exception contains a safe schema path and Pydantic error category.
    with pytest.raises(JDAnalysisError, match="JDRequirements validation") as error:
        analyze_jd_text(
            jd_id="JD-001",
            source_filename="sample.txt",
            source_sha256="a" * 64,
            content_sha256="b" * 64,
            original_text="Sample Engineer",
            config=_fake_config(),
        )

    # Confirm diagnostics exclude the model-provided invalid value.
    assert "required_skills[0]" in str(error.value)
    assert "model_type" in str(error.value)
    assert "SENSITIVE_SENTINEL_VALUE" not in str(error.value)


# Verify outer response JSON failures report parser location without response content.
def test_analyzer_reports_outer_json_decode_error_safely(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Distinguish an invalid HTTP response body from schema validation errors."""

    # Construct a JSON decoding exception with a sensitive sentinel in its source.
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.side_effect = json.JSONDecodeError(
        "invalid JSON", "SENSITIVE_SENTINEL_RESPONSE", 0
    )

    # Intercept the HTTP call so no external request is made.
    monkeypatch.setattr("app.jd_analyzer.httpx.post", Mock(return_value=response))

    # Confirm the analyzer reports the outer response parsing stage.
    with pytest.raises(JDAnalysisError, match="response body was not valid JSON") as error:
        analyze_jd_text(
            jd_id="JD-001",
            source_filename="sample.txt",
            source_sha256="a" * 64,
            content_sha256="b" * 64,
            original_text="Sample Engineer",
            config=_fake_config(),
        )

    # Confirm no raw response content appears in the user-facing exception.
    assert "SENSITIVE_SENTINEL_RESPONSE" not in str(error.value)


# Verify malformed OpenRouter envelopes get a separate fixed diagnostic.
def test_analyzer_reports_response_envelope_error_safely(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Identify a missing chat response path without exposing envelope data."""

    # Return valid outer JSON with a missing choices item.
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"choices": []}

    # Intercept the HTTP call so no external request is made.
    monkeypatch.setattr("app.jd_analyzer.httpx.post", Mock(return_value=response))

    # Confirm the fixed message identifies only the missing envelope path.
    with pytest.raises(JDAnalysisError, match=r"choices\[0\]\.message\.content"):
        analyze_jd_text(
            jd_id="JD-001",
            source_filename="sample.txt",
            source_sha256="a" * 64,
            content_sha256="b" * 64,
            original_text="Sample Engineer",
            config=_fake_config(),
        )


# Verify invalid model JSON is distinct from valid JSON with invalid fields.
def test_analyzer_reports_model_json_decode_error_safely(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Identify malformed message content without echoing that content."""

    # Return a valid OpenRouter envelope with synthetic invalid JSON content.
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "choices": [{"message": {"content": "SENSITIVE_SENTINEL_NOT_JSON"}}]
    }

    # Intercept the HTTP call so no external request is made.
    monkeypatch.setattr("app.jd_analyzer.httpx.post", Mock(return_value=response))

    # Confirm the analyzer reports the inner model JSON parsing stage.
    with pytest.raises(JDAnalysisError, match="model content was not valid JSON") as error:
        analyze_jd_text(
            jd_id="JD-001",
            source_filename="sample.txt",
            source_sha256="a" * 64,
            content_sha256="b" * 64,
            original_text="Sample Engineer",
            config=_fake_config(),
        )

    # Confirm the invalid model content is not included in the exception.
    assert "SENSITIVE_SENTINEL_NOT_JSON" not in str(error.value)


# Verify missing configuration prevents HTTPX from being called.
def test_analyzer_missing_config_does_not_make_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Fail before a network call when OpenRouter LLM settings are missing."""

    # Remove the shared key and LLM model before testing missing configuration.
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("OPENROUTER_LLM_MODEL", raising=False)

    # Replace HTTPX with a mock that will fail the test if invoked.
    post_mock = Mock(side_effect=AssertionError("External request was not expected"))
    monkeypatch.setattr("app.jd_analyzer.httpx.post", post_mock)

    # Confirm configuration failure occurs before the mocked network function.
    with pytest.raises(JDAnalysisError, match="OPENROUTER_API_KEY"):
        analyze_jd_text(
            jd_id="JD-001",
            source_filename="sample.txt",
            source_sha256="a" * 64,
            content_sha256="b" * 64,
            original_text="Sample Engineer",
        )

    # Confirm the external request mock was never called.
    post_mock.assert_not_called()


# Verify inverted experience ranges fail schema validation.
def test_schema_rejects_inverted_experience_range() -> None:
    """Reject a maximum experience value lower than the minimum value."""

    # Build shared evidence for a deliberately contradictory numeric range.
    evidence = EvidenceReference(
        section="REQUIRED SKILLS & EXPERIENCE",
        source_line=12,
        quote="Experience required: 7 to 5 years.",
    )

    # Confirm the schema rejects a range that contradicts its own order rule.
    with pytest.raises(ValidationError, match="Minimum experience"):
        JDRequirements(
            minimum_experience_years=EvidenceNumber(value=7, evidence=evidence),
            maximum_experience_years=EvidenceNumber(value=5, evidence=evidence),
        )


# Build a temporary manifest containing seven expected JDs and one unrelated record.
def _temporary_manifest(root: Path) -> tuple[Path, dict[str, bytes]]:
    """Create manifest-only test records and local JD files under a temporary root."""

    # Create the dedicated JD data folder used by path validation.
    jd_directory = root / "data" / "jds"
    jd_directory.mkdir(parents=True)

    # Keep original bytes for later checks that analysis never edits source JDs.
    original_bytes: dict[str, bytes] = {}

    # Build a seven-record source list matching the imported manifest IDs.
    source_records = []
    for index in range(1, 8):
        # Build a stable ID and source filename for the current synthetic JD.
        jd_id = f"JD-{index:03d}"
        filename = f"{jd_id}.txt"
        content = f"Synthetic JD body {index}.\n".encode("utf-8")
        source_path = jd_directory / filename
        source_path.write_bytes(content)
        original_bytes[jd_id] = content

        # Store only the fields needed by the manifest-driven analyzer.
        source_records.append(
            {
                "jd_id": jd_id,
                "source_type": "local_file",
                "source_filename": "All_7_Tailored_JDs.txt",
                "source_sha256": "a" * 64,
                "content_sha256": hashlib.sha256(content).hexdigest(),
                "source_start_line": index,
                "local_extracted_file_path": f"data/jds/{filename}",
            }
        )

    # Add an unrelated local JD that must not be included in this seven-record stage.
    source_records.append(
        {
            "jd_id": "JD-008",
            "source_type": "local_file",
            "source_filename": "unrelated.txt",
            "source_sha256": "c" * 64,
            "content_sha256": "d" * 64,
            "source_start_line": 1,
            "local_extracted_file_path": "data/jds/unrelated.txt",
        }
    )

    # Add a public URL source that must remain outside local JD analysis.
    source_records.append(
        {
            "jd_id": "WEB-001",
            "source_type": "public_url",
            "job_title": "External sample",
            "company_name": "Example",
            "source_url": "https://example.test/job",
        }
    )

    # Write the synthetic manifest without adding or modifying project data.
    manifest_path = root / "jd_sources.json"
    manifest_path.write_text(
        json.dumps({"schema_version": 1, "sources": source_records}),
        encoding="utf-8",
    )

    # Return the manifest path and original bytes for assertions.
    return manifest_path, original_bytes


# Verify batch selection ignores extra local and public URL records.
def test_manifest_loader_selects_only_jd_001_through_jd_007(tmp_path: Path) -> None:
    """Limit this analysis stage to the seven manifest-listed imported JDs."""

    # Create a temporary manifest with seven expected and two unrelated records.
    manifest_path, _ = _temporary_manifest(tmp_path)

    # Read only the IDs accepted by this analysis stage.
    selected = analyze_jds.load_seven_jd_records(manifest_path)

    # Confirm order and count match the approved seven imported JD records.
    assert [record["jd_id"] for record in selected] == [
        f"JD-{index:03d}" for index in range(1, 8)
    ]


# Verify batch outputs are separate and the original source files remain unchanged.
def test_batch_analysis_saves_seven_separate_results_without_editing_sources(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Write analysis outputs separately while leaving every source byte intact."""

    # Create a manifest and preserve its seven source-file bytes.
    manifest_path, original_bytes = _temporary_manifest(tmp_path)

    # Prepare a separate analysis output directory under the temporary root.
    output_directory = tmp_path / "data" / "jds" / "analysis"

    # Replace the analyzer with a local stub so no HTTP request can occur.
    def fake_analyzer(**kwargs: object) -> JDAnalysisRecord:
        """Return an inert analysis record for the current synthetic source JD."""

        # Build an empty requirements result to validate the output persistence path.
        return JDAnalysisRecord(
            jd_id=str(kwargs["jd_id"]),
            source_filename=str(kwargs["source_filename"]),
            source_sha256=str(kwargs["source_sha256"]),
            content_sha256=str(kwargs["content_sha256"]),
            model="nvidia/test-nemotron",
            analyzed_at=datetime.now(timezone.utc),
            requirements=JDRequirements(),
        )

    # Monkeypatch the API analyzer before processing the manifest.
    monkeypatch.setattr(analyze_jds, "analyze_jd_text", fake_analyzer)

    # Run the local batch flow with a fake config and temporary project root.
    output_paths = analyze_jds.analyze_manifest_jds(
        manifest_path=manifest_path,
        project_root=tmp_path,
        output_directory=output_directory,
        config=_fake_config(),
    )

    # Confirm exactly seven independent JSON files were generated.
    assert [path.name for path in output_paths] == [
        f"JD-{index:03d}.json" for index in range(1, 8)
    ]

    # Confirm an unrelated eighth source did not receive an analysis result.
    assert not (output_directory / "JD-008.json").exists()

    # Confirm every original JD source file still has its original bytes.
    for jd_id, content in original_bytes.items():
        assert (tmp_path / "data" / "jds" / f"{jd_id}.txt").read_bytes() == content
