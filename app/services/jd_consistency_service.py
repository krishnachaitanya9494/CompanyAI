"""Dynamic Content Integrity & Contradiction Detection Engine.

Validates that advertisements remain strictly grounded in the approved JD source and authorized
recruiter supplementary facts. Detects cross-domain leakage, location conflicts, experience mismatches,
employment type contradictions, and unsupported claims across ANY job type.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Set, Tuple
from app.services.jd_context_service import JobGenerationContext


def detect_contradictions(
    context: JobGenerationContext,
    advertisement_text: str,
) -> List[Dict[str, Any]]:
    """Detect domain, location, experience, and employment contradictions in advertisement."""
    contradictions: List[Dict[str, Any]] = []
    ad_lower = advertisement_text.lower()
    source_lower = context.source_text.lower()

    # 1. Experience contradiction detection
    if context.min_experience_years is not None and context.min_experience_years >= 4.0:
        if re.search(r"\b(entry[-\s]?level|fresher|fresh\s+graduates?|0\s*-\s*1\s+years?|no\s+experience\s+required)\b", ad_lower):
            contradictions.append({
                "type": "experience_conflict",
                "severity": "critical",
                "field": "experience",
                "source_fact": f"Minimum {int(context.min_experience_years)} years required in approved JD",
                "ad_claim": "Advertisement mentions entry-level / no experience",
                "message": f"Critical experience conflict: approved JD requires {int(context.min_experience_years)}+ years, but advertisement suggests entry-level / no experience.",
            })

    # 2. Location / Work Mode contradiction detection
    source_loc = context.location.lower()
    source_mode = context.work_mode.lower()
    if "remote" not in source_mode and "remote" not in source_loc and source_loc not in ["not specified", "unspecified"]:
        if re.search(r"\b(100%\s+remote|fully\s+remote|work\s+from\s+anywhere|remote\s+only)\b", ad_lower) and "remote" not in source_lower:
            contradictions.append({
                "type": "work_mode_conflict",
                "severity": "critical",
                "field": "work_mode",
                "source_fact": f"Location: {context.location}, Work Mode: {context.work_mode}",
                "ad_claim": "Advertisement claims 100% Remote / Work from anywhere",
                "message": f"Location/mode conflict: approved JD indicates {context.location} ({context.work_mode}), but ad claims fully remote.",
            })

    # 3. Employment Type contradiction detection
    source_emp = context.employment_type.lower()
    if "contract" in source_emp or "temporary" in source_emp:
        if re.search(r"\b(permanent\s+full[-\s]?time|regular\s+full[-\s]?time|tenured\s+position)\b", ad_lower):
            contradictions.append({
                "type": "employment_type_conflict",
                "severity": "warning",
                "field": "employment_type",
                "source_fact": f"Approved employment type is {context.employment_type}",
                "ad_claim": "Advertisement indicates permanent full-time position",
                "message": f"Employment type discrepancy: source JD is {context.employment_type}, but advertisement specifies permanent position.",
            })

    # 4. Cross-domain leakage contradiction detection
    # Example: Financial/Accountant job with VLSI/hardware verification duties
    is_finance = context.role_domain == "Finance & Tax Compliance"
    is_hardware = context.role_domain == "Semiconductor & Hardware Engineering"
    is_cloud = context.role_domain == "Cloud & Systems Infrastructure"

    if is_finance:
        hardware_leak = re.search(r"\b(verilog|systemverilog|uvm|vhdl|fpga|asic|cadence|synopsys|eda\s+tools)\b", ad_lower)
        if hardware_leak and not re.search(r"\b(verilog|systemverilog|uvm|vhdl|fpga|asic)\b", source_lower):
            contradictions.append({
                "type": "cross_domain_leakage",
                "severity": "critical",
                "field": "responsibilities",
                "source_fact": f"Finance & Tax role '{context.title}'",
                "ad_claim": f"Mentions semiconductor keyword '{hardware_leak.group(0)}'",
                "message": f"Critical cross-domain leakage: Finance/Tax role contains hardware engineering terms ('{hardware_leak.group(0)}').",
            })

    if is_hardware:
        tax_leak = re.search(r"\b(tds|gst|form\s+26as|sales\s+and\s+use\s+tax|tax\s+audit|challans?)\b", ad_lower)
        if tax_leak and not re.search(r"\b(tds|gst|form\s+26as|sut)\b", source_lower):
            contradictions.append({
                "type": "cross_domain_leakage",
                "severity": "critical",
                "field": "responsibilities",
                "source_fact": f"Hardware engineering role '{context.title}'",
                "ad_claim": f"Mentions tax keyword '{tax_leak.group(0)}'",
                "message": f"Critical cross-domain leakage: Hardware role contains tax/accounting terms ('{tax_leak.group(0)}').",
            })

    return contradictions


def classify_content_integrity(
    context: JobGenerationContext,
    advertisement_text: str,
) -> Dict[str, Any]:
    """Audit every bullet statement in advertisement for factual provenance against JD source."""
    source_text_clean = context.source_text.lower()
    supplementary_text = json.dumps(context.supplementary_info).lower()
    
    # Common vocabulary allowed without strict source matching
    standard_vocabulary = {
        "opportunity", "team", "join", "candidate", "role", "position", "company",
        "deliver", "responsible", "qualification", "experience", "skill", "proficiency",
        "knowledge", "collaborate", "ensure", "manage", "lead", "apply", "looking",
        "competitive", "environment", "growth", "successful", "career", "professional",
        "responsibilities", "requirements", "preferred", "mandatory", "location",
    }

    statements_audit: List[Dict[str, Any]] = []
    unsupported_count = 0
    directly_supported_count = 0
    wording_improvements_count = 0

    for raw in advertisement_text.split("\n"):
        line = raw.strip()
        if not line.startswith("• ") and not line.startswith("- "):
            continue
            
        statement = line[2:].strip()
        if len(statement) < 10:
            continue
            
        st_lower = statement.lower()
        words = set(re.findall(r"[a-z0-9+#./-]{3,}", st_lower)) - standard_vocabulary
        
        # Check direct substring or high word overlap
        if statement.rstrip(".").lower() in source_text_clean or statement.rstrip(".").lower() in supplementary_text:
            classification = "directly_supported"
            directly_supported_count += 1
            note = "Directly verified against source JD or recruiter supplementary facts."
        else:
            overlap = [w for w in words if w in source_text_clean or w in supplementary_text]
            ratio = len(overlap) / max(len(words), 1)
            
            if ratio >= 0.6:
                classification = "wording_improvement"
                wording_improvements_count += 1
                note = f"Source-grounded phrasing improvement ({int(ratio*100)}% keyword grounding)."
            elif ratio >= 0.3:
                classification = "inference"
                note = "Plausible contextual inference; recruiter review recommended."
            else:
                classification = "unsupported"
                unsupported_count += 1
                note = "Low lexical overlap with source JD; verify factual accuracy."

        statements_audit.append({
            "statement": statement,
            "classification": classification,
            "grounding_ratio": round(len([w for w in words if w in source_text_clean]) / max(len(words), 1), 2),
            "note": note,
        })

    contradictions = detect_contradictions(context, advertisement_text)
    has_critical = any(c["severity"] == "critical" for c in contradictions)

    return {
        "passed": not has_critical and unsupported_count <= 2,
        "has_critical_contradiction": has_critical,
        "contradictions": contradictions,
        "summary": {
            "total_statements_checked": len(statements_audit),
            "directly_supported": directly_supported_count,
            "wording_improvements": wording_improvements_count,
            "unsupported": unsupported_count,
        },
        "statements_audit": statements_audit,
    }
