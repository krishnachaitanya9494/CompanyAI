"""Universal Advertisement Quality & Factual Consistency Validation Service.

Validates generated or edited advertisements against the approved JD context across factual accuracy,
structural quality, platform-specific guidelines, and hallucination prevention.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List
from app.services.jd_context_service import JobGenerationContext
from app.services.content_normalization_service import (
    INTERNAL_METADATA_REGEX,
    find_incomplete_statements,
    find_duplicate_statements,
    normalize_markdown_content,
)
from app.services.jd_consistency_service import detect_contradictions


def validate_advertisement_quality(
    context: JobGenerationContext,
    platform: str,
    title: str,
    content: str,
) -> Dict[str, Any]:
    """Run comprehensive factual, syntactic, and platform-specific quality checks."""
    normalized_content = normalize_markdown_content(content)
    warnings: List[str] = []
    blocking_errors: List[str] = []

    # 1. Factual consistency: Job Title and Duplicate Title check
    clean_title = (title or "").strip()
    clean_jd_title = (context.title or "").strip()
    if clean_title and clean_jd_title:
        title_lower = clean_title.lower()
        jd_title_lower = clean_jd_title.lower()
        if (
            jd_title_lower not in title_lower
            and title_lower not in jd_title_lower
            and not any(word in title_lower for word in jd_title_lower.split() if len(word) > 3)
        ):
            warnings.append(f"Advertisement title '{clean_title}' differs significantly from approved JD title '{clean_jd_title}'.")

    # Check for duplicate consecutive headings matching the job title
    title_headings_count = 0
    for line in normalized_content.splitlines():
        h_m = re.match(r"^#{1,6}\s*(.+)$", line.strip())
        if h_m:
            head_clean = h_m.group(1).lower().replace("we're hiring:", "").replace("hiring:", "").strip()
            if clean_title.lower() in head_clean or head_clean in clean_title.lower():
                title_headings_count += 1
    if title_headings_count > 1:
        warnings.append("Duplicate job title heading detected in advertisement body.")

    # 1b. Internal Administrative Metadata Leakage Check
    for line in content.splitlines():
        core_line = re.sub(r"^[-•·*+\s]+", "", line.strip())
        if INTERNAL_METADATA_REGEX.search(core_line):
            blocking_errors.append("Internal administrative metadata detected (e.g. vendor distribution or requisition identifiers).")
            break

    # 1c. Required Skills & Competencies Presence Check
    ad_lower = normalized_content.lower()
    if "required skills" not in ad_lower and "skills & competencies" not in ad_lower and "key skills" not in ad_lower and "skills" not in ad_lower:
        warnings.append("Missing 'Required Skills & Competencies' section below Key Responsibilities.")

    # 2. Factual consistency: Location and Work Mode
    ad_lower = normalized_content.lower()
    if context.location and context.location.lower() not in ["not specified", "unspecified"]:
        loc_clean = re.sub(r"[\&,;/]", " ", context.location).lower()
        loc_tokens = [tok for tok in loc_clean.split() if len(tok) > 3 and tok not in ["india", "remote", "hybrid"]]
        if loc_tokens and not any(tok in ad_lower for tok in loc_tokens) and "remote" not in ad_lower:
            warnings.append(f"Approved job location '{context.location}' is not mentioned in the advertisement.")

    # 3. Factual consistency: Mandatory Skills
    if context.mandatory_skills:
        covered = [sk for sk in context.mandatory_skills if re.search(r"\b" + re.escape(sk.lower()) + r"\b", ad_lower)]
        coverage_ratio = len(covered) / max(len(context.mandatory_skills), 1)
        if coverage_ratio < 0.4 and len(context.mandatory_skills) >= 2:
            warnings.append(f"Low mandatory skills coverage: only {len(covered)} of {len(context.mandatory_skills)} mandatory skills are included.")

    # 4. Incomplete statements detection
    incomplete = find_incomplete_statements(normalized_content)
    if incomplete:
        warnings.append(f"Contains {len(incomplete)} incomplete or trailing statements (e.g. '{incomplete[0]}'). Recruiter review required.")

    # 5. Duplicate statements detection
    duplicates = find_duplicate_statements(normalized_content)
    if duplicates:
        warnings.append(f"Contains {len(duplicates)} duplicate responsibility statements (e.g. '{duplicates[0]}').")

    # 6. Critical Contradiction detection
    contradictions = detect_contradictions(context, normalized_content)
    for c in contradictions:
        if c["severity"] == "critical":
            blocking_errors.append(c["message"])
        else:
            warnings.append(c["message"])

    # 7. Platform-specific validation rules
    platform_key = platform.lower()
    if platform_key == "linkedin":
        # Check for engagement hook or hashtag presence
        if not re.search(r"#[A-Za-z0-9_]+", content):
            warnings.append("LinkedIn advertisement is missing discovery hashtags (#Hiring, #Careers).")
    elif platform_key == "naukri":
        # Check for key skills section
        if "key skills" not in ad_lower and "skills" not in ad_lower:
            warnings.append("Naukri advertisement should have an explicit 'Key Skills' section for ATS indexability.")
    elif platform_key == "indeed":
        # Check for clear qualifications separation
        if "responsibilities" not in ad_lower or ("qualifications" not in ad_lower and "requirements" not in ad_lower):
            warnings.append("Indeed advertisement should have distinct Responsibilities and Qualifications sections.")
    elif platform_key == "referral":
        # Check for referral instructions
        if "refer" not in ad_lower and "how to apply" not in ad_lower and "submit" not in ad_lower:
            warnings.append("Employee Referral announcement should clearly specify how to submit or refer candidates.")

    # 8. Missing Information checklist
    missing_info = list(context.missing_fields)

    passed = len(blocking_errors) == 0 and len(warnings) == 0
    requires_review = len(blocking_errors) > 0 or len(warnings) > 0

    return {
        "passed": passed,
        "requires_recruiter_review": requires_review,
        "blocking_errors": blocking_errors,
        "warnings": warnings,
        "incomplete_items": incomplete,
        "duplicate_items": duplicates,
        "contradictions": contradictions,
        "missing_information": missing_info,
        "normalized_content": normalized_content,
        "quality_score": max(100 - (len(blocking_errors) * 35 + len(warnings) * 12), 10),
    }
