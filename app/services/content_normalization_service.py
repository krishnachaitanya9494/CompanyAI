"""Dynamic Content Normalization and Markdown Rendering Service.

Provides robust, lossless normalization for job descriptions and advertisements across all platforms.
Handles Markdown headings, bold/italics, bullet lists, nested indentation, removes duplicate list markers,
and detects incomplete phrases without corrupting source domain text.
"""

from __future__ import annotations

import re
from typing import List, Tuple


INCOMPLETE_PHRASE_PATTERNS = (
    r"\bability\s*$",
    r"\bability\s+to\s*$",
    r"\bresponsible\s+for\s*$",
    r"\bexperience\s+with\s*$",
    r"\bknowledge\s+of\s*$",
    r"\bproficiency\s+in\s*$",
    r"\bfamiliarity\s+with\s*$",
    r"\bcapable\s+of\s*$",
    r"\bworking\s+with\s*$",
)


INTERNAL_METADATA_REGEX = re.compile(
    r"(?i)(?:Job Distributed to (?:New )?Vendors"
    r"|Vendor(?: Distribution)? Reference"
    r"|(?:Internal )?Req(?:uisition)? (?:ID|Number|Code)"
    r"|(?:Internal )?Job (?:ID|Code)"
    r"|Internal Approval Status"
    r"|Internal Staffing Notes?"
    r"|Backend Record ID"
    r"|Database ID"
    r"|Vendor-only"
    r"|^\s*Job Title\s*[-:]"
    r"|^\s*Number of Positions\s*[-:]"
    r"|^\s*Job Location\s*[-:]"
    r"|^\s*Job Start Date\s*[-:]"
    r"|^\s*Job End Date\s*[-:]"
    r"|^\s*Job Description\s*[-–]\s*(?:Contract Resource.*)?$)"
)

INTERNAL_METADATA_PATTERNS = [
    r"(?i)^[•·*+-]?\s*Job Distributed to (?:New )?Vendors:?.*$",
    r"(?i)^[•·*+-]?\s*Vendor(?: Distribution)? Reference:?.*$",
    r"(?i)^[•·*+-]?\s*(?:Internal )?Requisition ID:?.*$",
    r"(?i)^[•·*+-]?\s*(?:Internal )?Req(?:uisition)? (?:ID|Number|Code):?.*$",
    r"(?i)^[•·*+-]?\s*(?:Internal )?Job (?:ID|Code):?.*$",
    r"(?i)^[•·*+-]?\s*Internal Approval Status:?.*$",
    r"(?i)^[•·*+-]?\s*Internal Staffing Notes?:?.*$",
    r"(?i)^[•·*+-]?\s*Backend Record ID:?.*$",
    r"(?i)^[•·*+-]?\s*Database ID:?.*$",
    r"(?i)^[•·*+-]?\s*Vendor-only.*$",
    r"(?i)^[•·*+-]?\s*Job Title\s*[-:]\s*.*$",
    r"(?i)^[•·*+-]?\s*Number of Positions\s*[-:]\s*\d+.*$",
    r"(?i)^[•·*+-]?\s*Job Location\s*[-:]\s*.*$",
    r"(?i)^[•·*+-]?\s*Job Start Date\s*[-:]\s*.*$",
    r"(?i)^[•·*+-]?\s*Job End Date\s*[-:]\s*.*$",
    r"(?i)^[•·*+-]?\s*Job Description\s*[-–]\s*(?:Contract Resource.*)?$",
]


def sanitize_internal_metadata(text: str) -> str:
    """Sanitize internal administrative information from public job advertisement text.
    
    Removes vendor distribution metadata, requisition identifiers, backend IDs, and internal
    workflow markers without removing public-facing job requirements, locations, or skills.
    Also strips bracketed provenance tags like [section=...].
    """
    if not isinstance(text, str) or not text.strip():
        return ""
    
    sanitized_lines = []
    for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        clean_line = re.sub(r"\[section=[^\]]+\]\s*", "", line)
        stripped = clean_line.strip()
        core = re.sub(r"^[-•·*+\s]+", "", stripped)
        if INTERNAL_METADATA_REGEX.search(core) or any(re.match(pat, stripped) for pat in INTERNAL_METADATA_PATTERNS):
            continue
        sanitized_lines.append(clean_line)
    return "\n".join(sanitized_lines)


def remove_duplicate_title_headings(title: str, content: str) -> str:
    """Ensure the job title appears strictly once as the main heading.
    
    Detects and removes small duplicate title lines or redundant subheadings immediately
    following the primary title heading.
    """
    if not isinstance(content, str) or not content.strip() or not title:
        return content

    title_clean = title.strip().lower()
    lines = content.split("\n")
    cleaned_lines: List[str] = []
    seen_first_title = False

    for line in lines:
        stripped = line.strip()
        # Check if line is a title heading or verbatim title
        heading_match = re.match(r"^#{1,6}\s*(.+)$", stripped)
        candidate = heading_match.group(1).strip() if heading_match else stripped
        candidate_clean = re.sub(r"[*]+", "", candidate)
        candidate_clean = re.sub(r"^(?:we're hiring:?\s*|hiring:?\s*|🚀\s*employee referral opportunity:?\s*|job title:?\s*|role:?\s*|position:?\s*)", "", candidate_clean, flags=re.I).strip().lower()
        candidate_clean = re.sub(r"\s*[-–]\s*[a-z0-9\s,&/()]+$", "", candidate_clean).strip()
        t_clean = re.sub(r"\s*[-–]\s*[a-z0-9\s,&/()]+$", "", title_clean).strip()

        if candidate_clean == t_clean or candidate_clean.startswith(t_clean) or t_clean.startswith(candidate_clean) or (t_clean in candidate.lower() and heading_match):
            if not seen_first_title:
                seen_first_title = True
                cleaned_lines.append(line)
            else:
                # Duplicate title line found immediately or later - omit it!
                continue
        else:
            cleaned_lines.append(line)

    return "\n".join(cleaned_lines)


def normalize_markdown_content(text: str) -> str:
    """Normalize advertisement and JD text into clean, structured, readable Markdown.
    
    Preserves paragraph breaks, normalizes heading levels, removes duplicate markers
    (e.g. '• •', '* •', '- -'), removes empty bullet items, and ensures consistent spacing.
    """
    if not isinstance(text, str) or not text.strip():
        return ""

    # Sanitize internal vendor & administrative metadata first
    sanitized = sanitize_internal_metadata(text)

    # Normalize line endings and multiple spaces
    normalized_text = sanitized.replace("\r\n", "\n").replace("\r", "\n")
    normalized_text = re.sub(r"[ \t]+", " ", normalized_text)

    lines: List[str] = []
    previous_was_list = False

    for raw_line in normalized_text.split("\n"):
        line = raw_line.strip()
        if not line:
            if lines and lines[-1] != "":
                lines.append("")
            previous_was_list = False
            continue

        # Strip any number of multi-bullet prefix clutter (e.g. '• • •', '* •', '1. •')
        cleaned_line = line
        prev = None
        while cleaned_line != prev:
            prev = cleaned_line
            cleaned_line = re.sub(r"^(?:[•·+-]|\*(?!\*)|\d+[.)])\s*", "", cleaned_line).strip()

        cleaned_line = re.sub(r"^[-=]{3,}\s*$", "", cleaned_line).strip()
        # Repair orphan trailing :** or orphan leading **:
        cleaned_line = re.sub(r"([A-Za-z0-9/& -]+):\*\*", r"**\1:**", cleaned_line)
        cleaned_line = re.sub(r"\*\*([A-Za-z0-9/& -]+):(?!\*)", r"**\1:**", cleaned_line)

        if not cleaned_line:
            continue

        # Check for Markdown headings: #, ##, ###
        heading_match = re.match(r"^(#{1,6})\s*(.+?)\s*:?\s*$", line)
        if heading_match:
            hashes, heading_title = heading_match.groups()
            heading_title = re.sub(r"\s*:$", "", heading_title).strip()
            # Standardize heading levels: top level is ## for sections
            level = min(len(hashes), 3)
            prefix = "#" * max(level, 2)
            if lines and lines[-1] != "":
                lines.append("")
            lines.append(f"{prefix} {heading_title}")
            previous_was_list = False
            continue

        # Check for uppercase headings: "KEY RESPONSIBILITIES:"
        uppercase_heading = re.match(r"^([A-Z][A-Z0-9 &()/\-]{3,}):\s*(.*)$", line)
        if uppercase_heading and not previous_was_list and len(line) <= 60:
            heading, remainder = uppercase_heading.groups()
            if lines and lines[-1] != "":
                lines.append("")
            lines.append(f"## {heading.title()}")
            if remainder.strip():
                lines.append(remainder.strip())
            previous_was_list = False
            continue

        # Detect list items
        if re.match(r"^(?:[-*+•·]|\d+[.)])\s*", raw_line.strip()):
            if cleaned_line:
                lines.append(f"• {cleaned_line}")
                previous_was_list = True
                continue

        lines.append(line)
        previous_was_list = False

    result = "\n".join(lines)
    # Clean excessive newlines
    result = re.sub(r"\n{3,}", "\n\n", result)
    result = re.sub(r"(?:^|\n)•\s*(?:\n|$)", "\n", result)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()


def find_incomplete_statements(text: str) -> List[str]:
    """Detect broken sentences or trailing unfinished phrases requiring recruiter review."""
    if not isinstance(text, str):
        return []

    incomplete: List[str] = []
    for raw in text.replace("\r", "\n").split("\n"):
        line = re.sub(r"^(?:#{1,6}\s*|[-*+•·]\s*|\d+[.)]\s*)", "", raw).strip().rstrip(". ")
        if not line:
            continue
        if any(re.search(pattern, line, re.IGNORECASE) for pattern in INCOMPLETE_PHRASE_PATTERNS):
            incomplete.append(line)
        elif len(line.split()) <= 2 and re.match(r"^(?:ability|responsible|experience|knowledge|skill)\b", line, re.I):
            incomplete.append(line)

    return list(dict.fromkeys(incomplete))


def find_duplicate_statements(text: str) -> List[str]:
    """Detect semantically duplicate bullet statements after normalization."""
    seen: dict[str, str] = {}
    duplicates: List[str] = []

    for line in normalize_markdown_content(text).split("\n"):
        if not line.startswith("• "):
            continue
        content = re.sub(r"\s+", " ", line[2:].strip()).lower().rstrip(".;,")
        if not content:
            continue
        if content in seen:
            duplicates.append(seen[content])
        else:
            seen[content] = line[2:].strip()

    return list(dict.fromkeys(duplicates))
