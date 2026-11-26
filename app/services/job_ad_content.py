"""Normalize and validate job advertisements against their approved JD source."""

import re
from typing import Any


INCOMPLETE_ENDINGS = (
    r"\bability\s*$",
    r"\bability\s+to\s*$",
    r"\bresponsible\s+for\s*$",
    r"\bexperience\s+with\s*$",
    r"\bknowledge\s+of\s*$",
)


def strip_markdown(text: str) -> str:
    """Convert common advertisement Markdown into clean, section-aware plain text."""
    if not isinstance(text, str):
        return ""

    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)

    lines: list[str] = []
    previous_was_list = False
    for raw_line in text.split("\n"):
        line = raw_line.strip()
        if not line:
            if lines and lines[-1] != "":
                lines.append("")
            previous_was_list = False
            continue

        # Remove duplicate markers, including mixed "• - 1." list prefixes.
        line = re.sub(r"^(?:[•·*+-]\s*)+", "", line)
        line = re.sub(r"^\d+[.)]\s+", "", line)
        line = re.sub(r"^[-=]{3,}\s*$", "", line)
        if not line:
            continue

        heading_match = re.match(r"^#{1,6}\s*(.+?)\s*:?\s*$", line)
        if heading_match:
            title = heading_match.group(1).strip()
            title = re.sub(r"\s*:$", "", title)
            if lines and lines[-1] != "":
                lines.append("")
            lines.append(f"## {title}")
            previous_was_list = False
            continue

        uppercase_heading = re.match(r"^([A-Z][A-Z0-9 &()/\-]{3,}):\s*(.*)$", line)
        if uppercase_heading and not previous_was_list:
            heading, remainder = uppercase_heading.groups()
            if lines and lines[-1] != "":
                lines.append("")
            lines.append(f"## {heading.title()}")
            if remainder:
                lines.append(remainder)
            continue

        # Preserve bullets as one marker and remove indentation-only nesting ambiguity.
        if re.match(r"^(?:[-*+•·]|\d+[.)])\s*", raw_line.strip()):
            cleaned = re.sub(r"^(?:[-*+•·]|\d+[.)])\s*", "", raw_line.strip())
            cleaned = re.sub(r"^(?:[•·*+-]\s*)+", "", cleaned).strip()
            if cleaned:
                lines.append(f"• {cleaned}")
                previous_was_list = True
                continue

        lines.append(line)
        previous_was_list = False

    normalized = "\n".join(lines)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    normalized = re.sub(r"(?:^|\n)•\s*(?:\n|$)", "\n", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def find_incomplete_items(text: str) -> list[str]:
    """Find source-like fragments that are not complete responsibility statements."""
    if not isinstance(text, str):
        return []
    incomplete: list[str] = []
    for line in text.replace("\r", "\n").split("\n"):
        line = re.sub(r"^(?:#{1,6}\s*|[-*+•·]\s*|\d+[.)]\s*)", "", line).strip().rstrip(". ")
        if not line:
            continue
        if any(re.search(pattern, line, re.I) for pattern in INCOMPLETE_ENDINGS):
            incomplete.append(line)
        elif len(line.split()) <= 2 and re.match(r"^(?:ability|responsible|experience|knowledge)\b", line, re.I):
            incomplete.append(line)
    return list(dict.fromkeys(incomplete))


def find_duplicate_items(text: str) -> list[str]:
    """Detect repeated bullet meaning after normalization."""
    seen: dict[str, str] = {}
    duplicates: list[str] = []
    for line in strip_markdown(text).split("\n"):
        if not line.startswith("• "):
            continue
        item = re.sub(r"\s+", " ", line[2:].strip()).lower().rstrip(".")
        if not item:
            continue
        if item in seen:
            duplicates.append(seen[item])
        else:
            seen[item] = line[2:].strip()
    return list(dict.fromkeys(duplicates))


def extract_role_overview_and_responsibilities(source_text: str) -> tuple[str, list[str]]:
    """Extract source-backed overview and bullet responsibilities without inventing content."""
    lines = source_text.replace("\r", "\n").split("\n")
    overview: list[str] = []
    responsibilities: list[str] = []
    in_responsibilities = False

    for raw in lines:
        line = raw.strip()
        if re.match(r"^(?:role summary|role overview|job description)\s*$", line, re.I):
            continue
        if re.match(r"^(?:key responsibilities|interpersonal skills|primary function|responsibilities)\s*:?\s*$", line, re.I):
            in_responsibilities = True
            continue
        if re.match(r"^(?:desired qualifications|skills and abilities|qualifications|preferred qualifications)\s*:?\s*$", line, re.I):
            in_responsibilities = False

        bullet = re.sub(r"^(?:[-*+•·]|\d+[.)])\s*", "", line)
        is_bullet = bullet != line
        if in_responsibilities:
            item_text = bullet.strip() if is_bullet else line.strip()
            item_text = re.sub(r"^(?:[-*+•·]\s*)+", "", item_text).strip()
            if item_text and len(item_text) > 8 and not re.match(r"^[A-Z\s]{4,}:?$", item_text):
                responsibilities.append(item_text)
        elif not in_responsibilities and line and not re.match(r"^(?:job distributed|job title|number of positions|job location|job start date|job end date|job description)\s*-", line, re.I):
            if re.match(r"^.{20,}", line) and not re.match(r"^#{1,6}\s", line):
                overview.append(line)

    overview_text = " ".join(dict.fromkeys(overview))[:1200].strip()
    unique_responsibilities = list(dict.fromkeys(
        item.strip().rstrip(".") + "." if item.strip() and not item.strip().endswith(".") else item.strip()
        for item in responsibilities
    ))
    return overview_text, unique_responsibilities


def validate_advertisement(job_title: str, source_text: str, advertisement: str) -> dict[str, Any]:
    """Return source-grounded quality warnings; this is a gate, not an approval."""
    normalized_ad = strip_markdown(advertisement)
    incomplete = find_incomplete_items(normalized_ad)
    duplicates = find_duplicate_items(normalized_ad)
    warnings: list[str] = []
    if incomplete:
        warnings.append("Incomplete responsibility or qualification statements require recruiter review.")
    if duplicates:
        warnings.append("Duplicate responsibility statements require recruiter review.")

    if job_title and job_title.strip().lower() not in normalized_ad.lower():
        warnings.append("The advertisement title does not match the approved JD title.")

    source_title = re.search(r"Job Title\s*[-–—]\s*(.+)", source_text, re.I)
    if source_title:
        source_job_title = source_title.group(1).strip()
        if job_title and source_job_title.lower() not in job_title.lower() and job_title.lower() not in source_job_title.lower():
            warnings.append("The linked JD title differs from the job record title.")

    source_tokens = set(re.findall(r"[A-Za-z][A-Za-z0-9+#./-]{2,}", source_text.lower()))
    ad_tokens = set(re.findall(r"[A-Za-z][A-Za-z0-9+#./-]{2,}", normalized_ad.lower()))
    unsupported = sorted(
        token for token in ad_tokens - source_tokens
        if token not in {
            "linkedin", "naukri", "indeed", "job", "role", "company", "location", "work",
            "mode", "experience", "employment", "type", "salary", "benefits", "application",
            "instructions", "required", "preferred", "qualifications", "skills", "responsibilities",
            "overview", "summary", "not", "specified", "disclosed",
        }
    )
    unsupported = unsupported[:10]
    if len(unsupported) >= 5:
        warnings.append("The advertisement contains terms without source evidence; recruiter review is required.")

    return {
        "passed": not warnings,
        "warnings": warnings,
        "incomplete_items": incomplete,
        "duplicate_items": duplicates,
        "unsupported_terms": unsupported,
        "normalized_content": normalized_ad,
    }
