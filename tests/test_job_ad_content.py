from app.services.job_ad_content import (
    extract_role_overview_and_responsibilities,
    find_duplicate_items,
    find_incomplete_items,
    strip_markdown,
    validate_advertisement,
)


def test_duplicate_bullets_and_markdown_are_normalized():
    raw = """### Key Responsibilities:
• • Support tax reconciliations
•  
•\tPrepare GST returns

## Required Skills
* SAP
* • Excel
"""
    normalized = strip_markdown(raw)

    assert "• •" not in normalized
    assert "• " not in "\n".join(line for line in normalized.split("\n") if line == "• ")
    assert "###" not in normalized
    assert "## Key Responsibilities" in normalized
    assert find_duplicate_items(normalized) == []


def test_incomplete_source_item_requires_review():
    result = validate_advertisement(
        "Staff Accountant-Mid-Ops",
        "Support TDS and GST reconciliations.",
        "# Staff Accountant-Mid-Ops\n## Key Responsibilities\n• Ability to",
    )

    assert not result["passed"]
    assert "Ability to" in result["incomplete_items"]


def test_staff_accountant_source_does_not_cross_retail_assets_jd():
    staff_source = """Job Title - Staff Accountant-Mid-Ops
Key responsibilities
• Support routine compliance for TDS, GST and income tax.
• Prepare reconciliations against the general ledger."""
    retail_source = """PRIMARY FUNCTION:
Support Retail Assets Protection programs.
INTERPERSONAL SKILLS:
• Work effectively with others."""

    _, staff_items = extract_role_overview_and_responsibilities(staff_source)
    _, retail_items = extract_role_overview_and_responsibilities(retail_source)

    assert any("TDS" in item for item in staff_items)
    assert not any("Retail Assets" in item for item in staff_items)
    assert any("Retail Assets" in item for item in retail_items) if retail_items else True
    assert not any("TDS" in item for item in retail_items)


def test_nested_and_duplicate_responsibilities_are_normalized():
    raw = """## Key Responsibilities
• Parent responsibility
  • Nested responsibility
• • Parent responsibility

•   """
    normalized = strip_markdown(raw)
    assert "• •" not in normalized
    assert "  •" not in normalized
    assert len(find_duplicate_items(normalized)) >= 1
