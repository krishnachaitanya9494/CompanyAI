"""Analyze sanitized job descriptions with Nemotron through OpenRouter."""

# Import JSON support for the structured prompt and model response.
import json

# Import operating-system access for the separate Nemotron settings.
import os

# Import regular expressions for source-note and personal-data filtering.
import re

# Import dataclass helpers for immutable configuration and source lines.
from dataclasses import dataclass, field

# Import timezone-aware timestamps for analysis provenance.
from datetime import datetime, timezone

# Import Path for resolving the project's independent environment file.
from pathlib import Path

# Import Pydantic's validation exception for sanitized schema diagnostics.
from pydantic import ValidationError

# Import HTTPX for the OpenRouter chat-completions request.
import httpx

# Import dotenv so this client can load the shared OpenRouter key and LLM model.
from dotenv import load_dotenv

# Import the evidence-linked output schema used to validate model JSON.
from app.jd_schema import EvidenceNumber, EvidenceText, JDAnalysisRecord, JDRequirements


# Resolve the project root without relying on the shell's current directory.
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Load local environment settings while keeping all OpenRouter names unused here.
load_dotenv(PROJECT_ROOT / ".env")

# Store OpenRouter's documented chat-completions endpoint.
OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"

# Use a finite timeout so the process cannot wait indefinitely for an API response.
DEFAULT_REQUEST_TIMEOUT_SECONDS = 90.0

# Recognize all source sections that can appear in the seven imported JDs.
_SECTION_HEADINGS = {
    "ROLE SUMMARY",
    "KEY RESPONSIBILITIES",
    "REQUIRED SKILLS & EXPERIENCE",
    "PREFERRED SKILLS",
    "SOURCE NOTES / VALIDATION",
    "EDUCATION",
    "QUALIFICATIONS",
    "LOCATION",
    "EMPLOYMENT TYPE",
    "TECHNICAL SKILLS",
}

# Detect explicit resume-derived notes without removing ordinary job language.
_RESUME_NOTE_PATTERN = re.compile(
    r"\b(?:resume|résumé|cv|work history|resume filename|source notes)\b",
    re.IGNORECASE,
)

# Detect labeled personal details that should never be sent to the provider.
_PERSONAL_LABEL_PATTERN = re.compile(
    r"^\s*(?:candidate\s+)?(?:name|email|e-mail|phone|mobile|address|dob|date of birth|linkedin)\s*[:：-]",
    re.IGNORECASE,
)

# Detect email addresses so their complete source lines can be omitted.
_EMAIL_PATTERN = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)

# Detect phone-like values only when they contain at least ten digits.
_PHONE_PATTERN = re.compile(r"(?<!\w)\+?\d[\d ().-]{8,}\d(?!\w)")

# Detect web links that may contain personal profile identifiers.
_URL_PATTERN = re.compile(r"\b(?:https?://|www\.)\S+", re.IGNORECASE)

# Store only the sanitized text and source locations that may be sent externally.
@dataclass(frozen=True)
class SanitizedLine:
    """Represent one safe line with its original source location."""

    # Store the original one-based line number from the combined source file.
    source_line: int

    # Store the source section heading for auditable evidence references.
    section: str

    # Store the filtered text that may safely be sent to the LLM.
    text: str


# Bundle only sanitized lines so downstream request code cannot use raw text.
@dataclass(frozen=True)
class SanitizedJD:
    """Represent an external-safe JD view without changing its source file."""

    # Keep the sanitized source lines and their original section references.
    lines: tuple[SanitizedLine, ...]

    # Build prompt text using explicit source line and section labels.
    @property
    def prompt_text(self) -> str:
        """Return safe text with stable evidence location markers."""

        # Format only the filtered lines, never the original source text.
        return "\n".join(
            f"[section={line.section}; source_line={line.source_line}] {line.text}"
            for line in self.lines
        )


# Hide the shared OpenRouter key from accidental dataclass representation output.
@dataclass(frozen=True)
class OpenRouterLLMConfig:
    """Hold OpenRouter chat configuration separately from embedding settings."""

    # Keep API credentials out of repr output and ordinary debug messages.
    api_key: str = field(repr=False)

    # Store the selected chat model without reusing the embedding model setting.
    model: str

    # Store the OpenRouter chat-completions endpoint.
    endpoint: str


# Fail with generic messages that never include source text or API credentials.
class JDAnalysisError(RuntimeError):
    """Represent safe, user-facing JD analysis failures."""


# Define a deterministic list of JD IDs accepted by this seven-record stage.
EXPECTED_JD_IDS = tuple(f"JD-{index:03d}" for index in range(1, 8))


# Load and validate OpenRouter LLM settings at call time for easy testing.
def get_openrouter_llm_config() -> OpenRouterLLMConfig:
    """Read the shared OpenRouter key and separate LLM model setting."""

    # Reuse the existing OpenRouter API key without printing or modifying it.
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()

    # Read the LLM model independently from OPENROUTER_EMBEDDING_MODEL.
    model = os.getenv("OPENROUTER_LLM_MODEL", "").strip()

    # Require the shared OpenRouter key and separate LLM model before requesting.
    if (
        not api_key
        or api_key == "YOUR_OPENROUTER_API_KEY"
        or not model
    ):
        raise JDAnalysisError(
            "Set OPENROUTER_API_KEY and OPENROUTER_LLM_MODEL before analysis."
        )

    # Return validated values while keeping the key hidden from repr output.
    return OpenRouterLLMConfig(
        api_key=api_key,
        model=model,
        endpoint=OPENROUTER_CHAT_COMPLETIONS_URL,
    )


# Drop any lines that contain contact details rather than transmitting them.
def _contains_personal_contact(text: str) -> bool:
    """Return whether a line contains email, phone, or labeled personal data."""

    # Treat email and phone patterns as sensitive even when the line is unlabeled.
    return bool(
        _EMAIL_PATTERN.search(text)
        or _PHONE_PATTERN.search(text)
        or _PERSONAL_LABEL_PATTERN.search(text)
    )


# Prepare a privacy-filtered view while keeping original source line references.
def sanitize_jd_text(
    original_text: str,
    source_start_line: int = 1,
) -> SanitizedJD:
    """Remove resume notes and direct PII before any external API request."""

    # Reject absent input before building a request payload.
    if not isinstance(original_text, str) or not original_text.strip():
        raise ValueError("JD text must not be empty.")

    # Begin before the first section heading and update as headings are found.
    current_section = "JOB TITLE"

    # Collect only safe lines and retain their original source file references.
    safe_lines: list[SanitizedLine] = []

    # Visit each original line once so line numbers remain stable and auditable.
    for local_line_number, raw_line in enumerate(original_text.splitlines(), start=1):
        # Compute the corresponding line number in the combined source document.
        source_line_number = source_start_line + local_line_number - 1

        # Strip only line-edge whitespace; original JD files remain untouched.
        line = raw_line.strip()

        # Skip empty lines and decorative title-underlining characters.
        if not line or re.fullmatch(r"[=\-_*#]{3,}", line):
            continue

        # Update the current evidence section when a recognized heading appears.
        normalized_heading = line.upper()
        if normalized_heading in _SECTION_HEADINGS:
            current_section = normalized_heading

        # Exclude the entire source-notes section through the next recognized heading.
        if current_section == "SOURCE NOTES / VALIDATION":
            continue

        # Omit all explicit resume-derived notes, including experience annotations.
        if _RESUME_NOTE_PATTERN.search(line):
            continue

        # Omit lines containing direct identifiers rather than risk sharing them.
        if _contains_personal_contact(line):
            continue

        # Remove web links that could contain personal profile identifiers.
        safe_line = _URL_PATTERN.sub("[REDACTED_URL]", line)

        # Keep the cleaned source excerpt and its original source location.
        safe_lines.append(
            SanitizedLine(
                source_line=source_line_number,
                section=current_section,
                text=safe_line,
            )
        )

    # Require at least some safe job text before considering an API request.
    if not safe_lines:
        raise ValueError("No safe JD text remains after privacy filtering.")

    # Return only the privacy-filtered content and traceable source line metadata.
    return SanitizedJD(lines=tuple(safe_lines))


# Normalize evidence text the same way when checking source quotes.
def _normalize_evidence_text(text: str) -> str:
    """Normalize Unicode and whitespace for conservative exact-substring checks."""

    # Import Unicode normalization locally to keep the module imports easy to read.
    import unicodedata

    # Normalize compatibility characters, collapse whitespace, and compare case-insensitively.
    return " ".join(unicodedata.normalize("NFKC", text).casefold().split())


# Verify a model-provided evidence reference against one sanitized source line.
def _evidence_is_verified(
    item: EvidenceText | EvidenceNumber,
    source_lines: dict[int, SanitizedLine],
) -> bool:
    """Check section, source line, quote, and extracted value against safe text."""

    # Retrieve the sanitized line referenced by the model response.
    source_line = source_lines.get(item.evidence.source_line)

    # Reject references to removed notes, absent lines, or incorrect sections.
    if source_line is None or source_line.section != item.evidence.section:
        return False

    # Normalize the exact quote and source line before the containment check.
    quote = _normalize_evidence_text(item.evidence.quote)

    # Normalize the safe line so Unicode punctuation and whitespace do not block a match.
    safe_text = _normalize_evidence_text(source_line.text)

    # Reject an excerpt that does not occur in the referenced safe source line.
    if not quote or quote not in safe_text:
        return False

    # For text values, require the extracted value itself to occur in its quote.
    if isinstance(item, EvidenceText):
        return _normalize_evidence_text(item.value) in quote

    # For numeric values, require the exact number to occur in the evidence quote.
    numbers_in_quote = re.findall(r"\d+(?:\.\d+)?", quote)

    # Reject experience values not explicitly represented in the quote.
    return any(float(number) == item.value for number in numbers_in_quote)


# Keep only model values whose evidence was verified against sanitized text.
def _clear_unverified_values(requirements: JDRequirements, safe_jd: SanitizedJD) -> JDRequirements:
    """Null scalar values and drop list items whose evidence does not verify."""

    # Start a new result mapping so the validated model remains unchanged.
    filtered_data: dict[str, object] = {}

    # Build a line-number lookup containing only sanitized source text.
    source_lines = {line.source_line: line for line in safe_jd.lines}

    # Visit every structured field to clear unverified scalars and list elements.
    for field_name in JDRequirements.model_fields:
        # Read one typed Pydantic field from the original validated result.
        field_value = getattr(requirements, field_name)

        if field_value is None and field_name not in {
            "job_title",
            "company_name",
            "location",
            "employment_type",
            "minimum_experience_years",
            "maximum_experience_years",
        }:
            filtered_data[field_name] = []
            continue

        # Clear a scalar value when its evidence or value cannot be verified.
        if isinstance(field_value, (EvidenceText, EvidenceNumber)):
            if not _evidence_is_verified(field_value, source_lines):
                raise JDAnalysisError(
                    f"OpenRouter model evidence did not verify for requirements.{field_name}."
                )
            filtered_data[field_name] = field_value.model_dump()

        # Keep only evidence-backed entries for skill and requirement lists.
        elif isinstance(field_value, list):
            filtered_data[field_name] = [
                item.model_dump()
                for item in field_value
                if _evidence_is_verified(item, source_lines)
            ]

        # Retain any other already-validated values without alteration.
        else:
            filtered_data[field_name] = field_value

    # Revalidate the cleared object so the returned schema remains consistent.
    return JDRequirements.model_validate(filtered_data)


def _normalize_model_json_text(model_text: str) -> str:
    """Strip Markdown fences and whitespace from a model JSON payload."""
    trimmed = model_text.strip()
    if trimmed.startswith("```"):
        trimmed = re.sub(r"^```(?:json)?\s*", "", trimmed, flags=re.IGNORECASE)
        trimmed = re.sub(r"\s*```$", "", trimmed)
    return trimmed.strip()


# Summarize schema errors without including model-provided values or raw input.
def _safe_validation_summary(error: ValidationError) -> str:
    """Return only Pydantic error types and whitelisted field paths."""

    # Ask Pydantic to exclude inputs, contexts, and documentation links explicitly.
    validation_errors = error.errors(
        include_input=False,
        include_context=False,
        include_url=False,
    )

    # Whitelist schema field names so unknown keys cannot leak model text.
    safe_path_parts = set(JDRequirements.model_fields) | {
        "value",
        "evidence",
        "section",
        "source_line",
        "quote",
    }

    # Store only sanitized path-and-category descriptions for the final message.
    summaries: list[str] = []

    # Limit diagnostics so malformed model output cannot produce excessive messages.
    for validation_error in validation_errors[:8]:
        # Begin every path at the fixed schema name.
        path_parts = ["requirements"]

        # Read only Pydantic's location tuple, never its input or message fields.
        for path_part in validation_error.get("loc", ()):
            # Preserve list positions as numeric indices in the field path.
            if isinstance(path_part, int):
                path_parts[-1] = f"{path_parts[-1]}[{path_part}]"

            # Keep known schema names and replace every unknown name with a marker.
            else:
                safe_part = path_part if path_part in safe_path_parts else "<unknown>"
                path_parts.append(str(safe_part))

        # Keep the Pydantic category only when it matches a safe identifier pattern.
        error_type = str(validation_error.get("type", "validation_error"))
        safe_error_type = re.sub(r"[^a-zA-Z0-9_]+", "_", error_type)[:80]

        # Append a path and category without exposing the offending value.
        summaries.append(f"{'.'.join(path_parts)}:{safe_error_type}")

    # Add a count for remaining errors without including their data or locations.
    omitted_count = max(0, len(validation_errors) - len(summaries))
    if omitted_count:
        summaries.append(f"{omitted_count} additional error(s) omitted")

    # Return a fixed safe fallback when Pydantic provides no error entries.
    return "; ".join(summaries) if summaries else "schema_validation_error"


# Define instructions that explicitly constrain the model to source-supported facts.
_SYSTEM_PROMPT = """
Extract only job requirements explicitly stated in the supplied sanitized JD text.
Do not infer employer, location, employment type, skills, qualifications, or experience.
Use null for missing scalar values and empty arrays for missing lists.
Separate required skills from preferred skills exactly as the source does.
For every non-null scalar and every array item, include evidence with the exact source
section, source_line, and an exact quote from that single source line. Copy each text
value verbatim from its evidence quote. For experience numbers, quote the exact line
that states the number. Return one JSON object matching the requested schema only.
""".strip()


# Define the expected top-level requirements keys for the JSON-only API request.
_REQUIREMENTS_KEYS = tuple(JDRequirements.model_fields.keys())


# Call Nemotron through OpenRouter and return only verified, evidence-backed values.
def analyze_jd_text(
    *,
    jd_id: str,
    source_filename: str,
    source_sha256: str,
    content_sha256: str,
    original_text: str,
    source_start_line: int = 1,
    config: OpenRouterLLMConfig | None = None,
    timeout_seconds: float = DEFAULT_REQUEST_TIMEOUT_SECONDS,
) -> JDAnalysisRecord:
    """Analyze one source JD while sending only its privacy-filtered text."""

    # Sanitize before reading config or creating any network request.
    safe_jd = sanitize_jd_text(original_text, source_start_line=source_start_line)

    # Resolve OpenRouter chat settings without consulting the embedding model setting.
    active_config = config or get_openrouter_llm_config()

    # Build an explicit response shape so the model knows each evidence-backed field.
    request_body = {
        "model": active_config.model,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "job_description": safe_jd.prompt_text,
                        "requirements_keys": _REQUIREMENTS_KEYS,
                        "evidence_format": {
                            "section": "exact supplied section heading",
                            "source_line": "integer source line number",
                            "quote": "exact excerpt from that one supplied line",
                        },
                    },
                    ensure_ascii=False,
                ),
            },
        ],
        "reasoning": {"effort": "low"},
        "response_format": {"type": "json_object"},
        "provider": {"require_parameters": True},
        "max_tokens": 4096,
        "temperature": 0,
        "stream": False,
    }

    # Prepare request headers without printing or logging credential values.
    request_headers = {
        "Authorization": f"Bearer {active_config.api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Send the sanitized payload to OpenRouter's chat-completions endpoint.
    try:
        response = httpx.post(
            active_config.endpoint,
            headers=request_headers,
            json=request_body,
            timeout=timeout_seconds,
        )

        # Convert HTTP failures into generic messages without response-body details.
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        # Hide server response bodies that could echo sensitive source text.
        if error.response.status_code == 401:
            raise JDAnalysisError("OpenRouter rejected the configured API credentials.") from None

        # Report only the numeric status for other OpenRouter HTTP errors.
        raise JDAnalysisError(
            f"OpenRouter chat request failed with HTTP {error.response.status_code}."
        ) from None
    except httpx.RequestError as error:
        # Report the exception type without printing request headers or content.
        raise JDAnalysisError(
            f"OpenRouter chat request failed ({type(error).__name__})."
        ) from None

    # Decode the outer API response while keeping any response content private.
    try:
        response_payload = response.json()
    except json.JSONDecodeError as error:
        # Report only the JSON parser location, never the response body.
        raise JDAnalysisError(
            "OpenRouter response body was not valid JSON "
            f"(line {error.lineno}, column {error.colno})."
        ) from None

    # Extract the expected OpenRouter message separately from model validation.
    try:
        choices = response_payload["choices"]
        if not isinstance(choices, list) or not choices:
            raise IndexError
        choice = choices[0]
        if not isinstance(choice, dict):
            raise KeyError
        message = choice.get("message")
        if not isinstance(message, dict):
            raise KeyError
        if choice.get("finish_reason") == "length":
            raise JDAnalysisError(
                "OpenRouter token limit reached; increase the completion token budget."
            )
        model_content = message.get("content")
    except (KeyError, IndexError, TypeError):
        raise JDAnalysisError(
            "OpenRouter response envelope is missing choices[0].message.content."
        ) from None

    # Reject malformed message objects without including any response values.
    if not isinstance(message, dict):
        raise JDAnalysisError("OpenRouter response envelope message was not an object.")

    # Detect provider refusals without exposing potentially sensitive refusal text.
    if message.get("refusal") is not None:
        raise JDAnalysisError("OpenRouter model refused the request.")

    # Keep ordinary string content compatible with the existing response format.
    if isinstance(model_content, str):
        model_text = model_content
    # Join supported text blocks in order while rejecting mixed or unknown blocks.
    elif isinstance(model_content, list) and model_content:
        if any(
            not isinstance(block, dict)
            or block.get("type") != "text"
            or not isinstance(block.get("text"), str)
            for block in model_content
        ):
            raise JDAnalysisError(
                "OpenRouter response envelope content contained unsupported blocks."
            )
        model_text = "".join(block["text"] for block in model_content)
    else:
        raise JDAnalysisError("OpenRouter response envelope content had an unsupported format.")

    # Reject empty text generically before attempting to parse model-generated JSON.
    if not model_text.strip():
        raise JDAnalysisError("OpenRouter response envelope content had an unsupported format.")

    model_text = _normalize_model_json_text(model_text)
    if not model_text:
        raise JDAnalysisError("OpenRouter response envelope content had an unsupported format.")

    # Decode the model's JSON separately so syntax errors are distinguishable.
    try:
        model_data = json.loads(model_text)
    except json.JSONDecodeError as error:
        # Report only the parser location, never the model response text.
        raise JDAnalysisError(
            "OpenRouter model content was not valid JSON "
            f"(line {error.lineno}, column {error.colno})."
        ) from None

    # Normalize explicit null list fields before schema validation.
    for field_name in JDRequirements.model_fields:
        if field_name in model_data and model_data[field_name] is None and field_name not in {
            "job_title",
            "company_name",
            "location",
            "employment_type",
            "minimum_experience_years",
            "maximum_experience_years",
        }:
            model_data[field_name] = []

    # Validate the parsed object against JDRequirements and report safe details only.
    try:
        requirements = JDRequirements.model_validate(model_data)
    except ValidationError as error:
        # Include only Pydantic error categories and whitelisted schema paths.
        safe_summary = _safe_validation_summary(error)
        raise JDAnalysisError(
            f"OpenRouter model JSON failed JDRequirements validation: {safe_summary}."
        ) from None

    # Clear unsupported requirements instead of returning unverifiable model claims.
    verified_requirements = _clear_unverified_values(requirements, safe_jd)

    # Construct a provenance-linked result without copying or replacing original text.
    return JDAnalysisRecord(
        jd_id=jd_id,
        source_filename=source_filename,
        source_sha256=source_sha256,
        content_sha256=content_sha256,
        model=active_config.model,
        analyzed_at=datetime.now(timezone.utc),
        requirements=verified_requirements,
    )
