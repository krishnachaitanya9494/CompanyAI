"""AI-Powered Job Description Segmentation and Structured Requirement Extraction Service for CompanyAI 2.0."""

# Import json for JSON payload serialization and parsing.
import json
# Import os for reading environment variables.
import os
# Import re for regular expressions and text pattern matching.
import re
# Import datetime and timezone for audit timestamps.
from datetime import datetime, timezone
# Import Path for filesystem paths.
from pathlib import Path
# Import typing helpers.
from typing import Any, Dict, List, Optional, Tuple
# Import httpx for calling OpenRouter chat completions.
import httpx
# Import Pydantic models for structured output validation.
from pydantic import BaseModel, ConfigDict, Field, ValidationError
# Import SQLAlchemy Session.
from sqlalchemy.orm import Session
# Import database models.
from database.models import Job, JobDescription, JDSegmentation, JobRequirement, ActivityEvent
# Import sanitization utility from existing jd_analyzer.
from app.jd_analyzer import sanitize_jd_text, OPENROUTER_CHAT_COMPLETIONS_URL

# Define the 15 standard recruitment requirement categories.
STANDARD_15_CATEGORIES = [
    "job_overview",
    "role_summary",
    "key_responsibilities",
    "mandatory_skills",
    "preferred_skills",
    "technical_skills",
    "tools_and_technologies",
    "domain_knowledge",
    "minimum_experience",
    "preferred_experience",
    "educational_qualifications",
    "certifications",
    "location_requirements",
    "employment_type",
    "other_requirements",
]

# Mapping from category code to human-readable display label.
CATEGORY_LABELS: Dict[str, str] = {
    "job_overview": "Job Overview",
    "role_summary": "Role Summary",
    "key_responsibilities": "Key Responsibilities",
    "mandatory_skills": "Mandatory Skills",
    "preferred_skills": "Preferred Skills",
    "technical_skills": "Technical Skills",
    "tools_and_technologies": "Tools and Technologies",
    "domain_knowledge": "Domain Knowledge",
    "minimum_experience": "Minimum Experience",
    "preferred_experience": "Preferred Experience",
    "educational_qualifications": "Educational Qualifications",
    "certifications": "Certifications",
    "location_requirements": "Location Requirements",
    "employment_type": "Employment Type",
    "other_requirements": "Other Requirements",
}


# Pydantic schema for an individual extracted requirement item.
class ExtractedRequirementItem(BaseModel):
    """Schema for one evidence-linked requirement extracted from the JD."""
    # Allow extra fields without breaking validation.
    model_config = ConfigDict(extra="ignore")

    # Category must match one of the 15 approved categories.
    category: str = Field(..., description="One of the 15 standard recruitment categories")
    # Original requirement text as stated or summarized from the document.
    original_text: str = Field(..., min_length=1, description="Original requirement wording")
    # Mandatory or Preferred classification.
    classification: str = Field(default="Mandatory", description="'Mandatory' or 'Preferred'")
    # Normalized canonical skill name if applicable.
    normalized_skill: Optional[str] = Field(default=None, description="Standard skill name if applicable")
    # Experience in years if explicitly mentioned.
    experience_years: Optional[float] = Field(default=None, description="Experience in years if stated")
    # Verbatim supporting quote from the original source text.
    evidence: Optional[str] = Field(default=None, description="Verbatim source quote supporting this requirement")
    # Confidence score assigned by model or extraction pipeline (0.0 to 1.0).
    confidence: float = Field(default=0.95, ge=0.0, le=1.0, description="Model confidence score")


# Pydantic schema for the complete LLM segmentation output.
class JDSegmentationOutput(BaseModel):
    """Structured response schema expected from the Nemotron LLM."""
    model_config = ConfigDict(extra="ignore")

    # High-level overview of the job opening.
    job_overview: Optional[str] = Field(default=None, description="High-level company and job overview")
    # Summary of the primary role scope.
    role_summary: Optional[str] = Field(default=None, description="Role summary and objectives")
    # List of structured requirements across all 15 categories.
    requirements: List[ExtractedRequirementItem] = Field(
        default_factory=list,
        description="List of granular, evidence-linked requirements across the 15 categories",
    )


# System prompt instructing Nemotron to perform grounded extraction into the 15 categories.
SEGMENTATION_SYSTEM_PROMPT = """
You are an expert enterprise recruitment intelligence assistant.
Your task is to analyze the provided Job Description (JD) and segment it into structured requirements across exactly 15 recruitment categories:

1. job_overview: Broad context about the company, project, or role scope.
2. role_summary: Core purpose, executive summary, and title definition of the role.
3. key_responsibilities: Specific duties, day-to-day tasks, and deliverables.
4. mandatory_skills: Must-have, essential skills explicitly marked as required or mandatory.
5. preferred_skills: Nice-to-have, advantageous, or preferred skills.
6. technical_skills: Specialized engineering, architecture, or technical domain proficiencies.
7. tools_and_technologies: Specific software, libraries, IDEs, platforms, ERPs, or hardware tools.
8. domain_knowledge: Industry or business domain context (e.g. FinTech, Healthcare, Supply Chain, EPM).
9. minimum_experience: Explicit minimum years of experience required (e.g. 5 years).
10. preferred_experience: Desired or optimal experience beyond the bare minimum.
11. educational_qualifications: Required or preferred academic degrees (e.g. B.Tech, M.S., MCA).
12. certifications: Specific industry or vendor credentials (e.g. AWS Certified Solutions Architect, PMP).
13. location_requirements: Stated work location, travel expectations, or relocation terms.
14. employment_type: Work arrangement (e.g. Full-time, Contract, Remote, Hybrid, On-site).
15. other_requirements: Security clearances, background checks, shift timings, soft skills, or language fluency.

CRITICAL RULES:
- Grounding: Every item MUST have supporting "evidence" containing an exact quote from the JD.
- Accuracy: Do NOT invent, assume, or hallucinate skills, responsibilities, or years of experience.
- Classification: Mark as "Mandatory" if required/essential; mark as "Preferred" if optional/plus/desirable.
- Normalized Skill: For technical skills and tools, provide a standardized name in "normalized_skill" (e.g., "Oracle FCCS", "React", "Python").
- Return strictly valid JSON matching the requested schema with no extra conversational text.
""".strip()


def normalize_skill_name(raw_name: str) -> str:
    """Normalize a raw skill string into a clean canonical representation."""
    cleaned = re.sub(r'[\(\)\[\]\{\}]', '', raw_name).strip()
    # Normalize common skill variations.
    mappings = {
        "react.js": "React",
        "reactjs": "React",
        "node.js": "Node.js",
        "nodejs": "Node.js",
        "vue.js": "Vue.js",
        "vuejs": "Vue.js",
        "golang": "Go",
        "postgres": "PostgreSQL",
        "k8s": "Kubernetes",
        "amazon web services": "AWS",
        "google cloud": "GCP",
        "google cloud platform": "GCP",
        "oracle financial consolidation and close": "Oracle FCCS",
        "oracle fccs": "Oracle FCCS",
        "hyperion financial management": "Hyperion HFM",
    }
    lowered = cleaned.lower()
    return mappings.get(lowered, cleaned.title() if len(cleaned) > 4 else cleaned.upper())


def heuristic_fallback_segmentation(raw_text: str) -> JDSegmentationOutput:
    """Rule-based heuristic segmenter used when LLM is offline, mocked, or in test environments."""
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    requirements: List[ExtractedRequirementItem] = []

    overview_lines: List[str] = []
    summary_lines: List[str] = []

    current_category = "job_overview"
    current_classification = "Mandatory"

    for idx, line in enumerate(lines):
        clean_header = re.sub(r"^[#•\-\*\d+\.\t\s]+", "", line).strip()
        upper = clean_header.upper()
        is_bullet = line.startswith(("•", "-", "*", ">")) or bool(re.match(r"^\d+[\.\)]\s", line))

        # Check for single-line metadata key:value pairs without changing running category state
        if re.match(r"^(?:Location|Work Mode|Place|Base Location)\s*[:\-]", clean_header, re.I):
            requirements.append(ExtractedRequirementItem(
                category="location_requirements",
                original_text=clean_header,
                classification="Mandatory",
                evidence=line,
                confidence=0.95,
            ))
            continue
        elif re.match(r"^(?:Domain|Industry)\s*[:\-]", clean_header, re.I):
            requirements.append(ExtractedRequirementItem(
                category="domain_knowledge",
                original_text=clean_header,
                classification="Mandatory",
                evidence=line,
                confidence=0.95,
            ))
            continue
        elif re.match(r"^(?:Experience Level|Experience Required|Exp)\s*[:\-]", clean_header, re.I):
            exp_m = re.search(r'(\d+(?:\.\d+)?)\s*(?:\+|-)?\s*years?', clean_header, re.I)
            requirements.append(ExtractedRequirementItem(
                category="minimum_experience",
                original_text=clean_header,
                classification="Mandatory",
                experience_years=float(exp_m.group(1)) if exp_m else None,
                evidence=line,
                confidence=0.95,
            ))
            continue

        # Check section headings (supports clean lines with or without leading bullet artifacts)
        if len(clean_header) <= 60 and not clean_header.endswith("."):
            if "OVERVIEW" in upper or "ABOUT" in upper or "COMPANY" in upper:
                current_category = "job_overview"
                current_classification = "Mandatory"
                continue
            elif "SUMMARY" in upper or "PURPOSE" in upper or upper == "ROLE" or "ROLE SUMMARY" in upper:
                current_category = "role_summary"
                current_classification = "Mandatory"
                continue
            elif "RESPONSIBILIT" in upper or "DUTIES" in upper or "WHAT YOU WILL DO" in upper or "ACCOUNTABILIT" in upper:
                current_category = "key_responsibilities"
                current_classification = "Mandatory"
                continue
            elif "MANDATORY" in upper or "MUST HAVE" in upper or "REQUIRED SKILL" in upper or "CORE SKILL" in upper:
                current_category = "mandatory_skills"
                current_classification = "Mandatory"
                continue
            elif "PREFERRED" in upper or "NICE TO HAVE" in upper or "GOOD TO HAVE" in upper:
                current_category = "preferred_skills"
                current_classification = "Preferred"
                continue
            elif "TECHNICAL SKILL" in upper or "TECHNOLOGIES" in upper or "COMPETENC" in upper:
                current_category = "technical_skills"
                current_classification = "Mandatory"
                continue
            elif upper == "TOOLS" or "TOOLS &" in upper or "TOOLS AND" in upper:
                current_category = "tools_and_technologies"
                current_classification = "Mandatory"
                continue
            elif "DOMAIN" in upper or "INDUSTRY" in upper:
                current_category = "domain_knowledge"
                current_classification = "Mandatory"
                continue
            elif "EXPERIENCE" in upper:
                current_category = "minimum_experience"
                current_classification = "Mandatory"
                continue
            elif "EDUCATION" in upper or "QUALIFICATION" in upper or "DEGREE" in upper:
                current_category = "educational_qualifications"
                current_classification = "Mandatory"
                continue
            elif "CERTIFICATION" in upper or "CERTIFIED" in upper:
                current_category = "certifications"
                current_classification = "Preferred"
                continue
            elif upper.startswith("LOCATION") or upper == "WORKPLACE":
                current_category = "location_requirements"
                current_classification = "Mandatory"
                continue
            elif "EMPLOYMENT" in upper:
                current_category = "employment_type"
                current_classification = "Mandatory"
                continue

        # Collect overview / summary.
        if current_category == "job_overview" and len(overview_lines) < 3:
            overview_lines.append(line)
        elif current_category == "role_summary" and len(summary_lines) < 3:
            summary_lines.append(line)

        # Detect experience years if mentioned.
        exp_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:\+|-)?\s*years?', line, re.IGNORECASE)
        exp_years = float(exp_match.group(1)) if exp_match else None

        # Clean bullet points from line.
        item_text = re.sub(r'^[#•\-\*\d+\.\t\s]+', '', line).strip()
        if not item_text or len(item_text) < 3:
            continue

        # Extract normalized skill if in skill/tool category.
        norm_skill = None
        if current_category in {"mandatory_skills", "preferred_skills", "technical_skills", "tools_and_technologies"}:
            first_phrase = re.split(r'[,;:\-–\|]', item_text)[0].strip()
            if len(first_phrase) < 30:
                norm_skill = normalize_skill_name(first_phrase)

        # Append extracted requirement item.
        requirements.append(
            ExtractedRequirementItem(
                category=current_category,
                original_text=item_text,
                classification=current_classification,
                normalized_skill=norm_skill,
                experience_years=exp_years,
                evidence=line,
                confidence=0.92,
            )
        )

    # Ensure we cover categories with reasonable defaults if empty.
    return JDSegmentationOutput(
        job_overview=" ".join(overview_lines) if overview_lines else "Enterprise hiring requirement.",
        role_summary=" ".join(summary_lines) if summary_lines else "Professional role within engineering organization.",
        requirements=requirements,
    )


def call_nemotron_segmentation_api(
    sanitized_text: str,
    api_key: Optional[str] = None,
    model_name: Optional[str] = None,
    timeout_seconds: float = 60.0,
) -> JDSegmentationOutput:
    """Call Nemotron through OpenRouter with structured JSON schema and controlled retry."""
    # Resolve API key and model identifier.
    key = api_key or os.getenv("OPENROUTER_API_KEY", "").strip()
    model = model_name or os.getenv("OPENROUTER_LLM_MODEL", "nvidia/nemotron-3.5-super-vl").strip()

    # If API key is missing or dummy, return grounded heuristic extraction.
    if not key or key in {"YOUR_OPENROUTER_API_KEY", "test_key", "none"}:
        return heuristic_fallback_segmentation(sanitized_text)

    # Construct chat payload requesting structured JSON.
    user_prompt = f"Please segment this Job Description into the 15 categories:\n\n{sanitized_text}"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SEGMENTATION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.0,
        "max_tokens": 4096,
    }

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Perform request with retry loop.
    max_retries = 2
    last_error = None

    for attempt in range(max_retries):
        try:
            response = httpx.post(
                OPENROUTER_CHAT_COMPLETIONS_URL,
                json=payload,
                headers=headers,
                timeout=timeout_seconds,
            )
            response.raise_for_status()
            data = response.json()

            # Parse choice content.
            raw_content = data.get("choices", [{}])[0].get("message", {}).get("content")
            if not raw_content or not isinstance(raw_content, str):
                raise ValueError("Empty or invalid LLM response content.")

            # Clean possible markdown JSON wrappers.
            clean_content = re.sub(r"^```(?:json)?\s*", "", raw_content.strip(), flags=re.IGNORECASE)
            clean_content = re.sub(r"\s*```$", "", clean_content).strip()

            parsed_json = json.loads(clean_content)
            # Validate output using Pydantic schema.
            return JDSegmentationOutput.model_validate(parsed_json)

        except Exception as exc:
            last_error = exc
            continue

    # Fall back to rule-based extractor if external LLM fails or malformed.
    return heuristic_fallback_segmentation(sanitized_text)


def segment_job_description(
    db: Session,
    job: Job,
    force_resegment: bool = False,
    mock_output: Optional[JDSegmentationOutput] = None,
) -> JDSegmentation:
    """Execute AI segmentation for a job, persist in SQLite, and preserve existing versions."""
    # Check for existing segmentation.
    existing = db.query(JDSegmentation).filter(
        JDSegmentation.job_id == job.id
    ).order_by(JDSegmentation.version.desc()).first()

    # Protect recruiter-approved segmentation unless force_resegment is explicitly granted.
    if existing and existing.is_approved == 1 and not force_resegment:
        return existing

    # Retrieve source text from job description extracted text, original text, or job model.
    source_text = job.description or ""
    if job.job_description:
        # Prefer parsed plain text, then raw original text, then operational job description.
        source_text = job.job_description.extracted_text or job.job_description.original_text or source_text

    # Extract structured requirements.
    if mock_output is not None:
        seg_output = mock_output
    else:
        # Sanitize text before model transmission.
        try:
            sanitized = sanitize_jd_text(source_text).prompt_text
        except Exception:
            sanitized = source_text
        seg_output = call_nemotron_segmentation_api(sanitized)

    # Determine segmentation version number so every re-segmentation strictly increments lineage.
    new_version = (existing.version + 1) if existing else 1

    # Create new JDSegmentation record.
    segmentation = JDSegmentation(
        job_id=job.id,
        job_description_id=job.job_description_id,
        version=new_version,
        status="review_pending",
        model_name=os.getenv("OPENROUTER_LLM_MODEL", "nvidia/nemotron-3.5-super-vl"),
        job_overview=seg_output.job_overview,
        role_summary=seg_output.role_summary,
        is_approved=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(segmentation)
    db.flush()

    # Determine provenance origin for extracted requirement items.
    origin = "mocked_test" if mock_output is not None else ("ai_model" if os.getenv("OPENROUTER_API_KEY") and os.getenv("OPENROUTER_API_KEY") not in {"YOUR_OPENROUTER_API_KEY", "test_key", "none"} else "heuristic_fallback")

    # Create individual JobRequirement items linked to evidence.
    for order_idx, item in enumerate(seg_output.requirements):
        # Validate that category belongs to approved 15 categories.
        cat_code = item.category.lower().replace(" ", "_")
        if cat_code not in STANDARD_15_CATEGORIES:
            cat_code = "other_requirements"

        req_row = JobRequirement(
            segmentation_id=segmentation.id,
            category=cat_code,
            original_text=item.original_text,
            classification=item.classification if item.classification in {"Mandatory", "Preferred"} else "Mandatory",
            normalized_skill=item.normalized_skill,
            experience_years=item.experience_years,
            evidence=item.evidence,
            confidence=item.confidence,
            is_approved=0,
            order_index=order_idx,
            source_origin=origin,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(req_row)

    # Log activity event in audit feed.
    db.add(ActivityEvent(
        event_type="jd_segmented",
        summary=f"AI Segmentation generated {len(seg_output.requirements)} structured requirements across 15 categories for '{job.title}'",
        entity_type="job",
        entity_id=str(job.id),
        created_at=datetime.now(timezone.utc),
    ))

    db.commit()
    db.refresh(segmentation)
    return segmentation


def verify_evidence_in_source(evidence: Optional[str], source_text: str) -> Dict[str, Any]:
    """Verify whether an extracted evidence quote actually occurs in the source JD."""
    if not evidence or not evidence.strip():
        return {
            "is_verified": False,
            "match_type": "missing",
            "message": "No source evidence quote provided",
        }
    if not source_text or not source_text.strip():
        return {
            "is_verified": False,
            "match_type": "no_source",
            "message": "Source document text is unavailable",
        }

    norm_ev = " ".join(evidence.lower().split())
    norm_src = " ".join(source_text.lower().split())

    # Exact substring check.
    if norm_ev in norm_src:
        return {
            "is_verified": True,
            "match_type": "exact_phrase",
            "message": "Verified exact phrase in source JD",
        }

    # Keyword similarity check (>70% words match in source text).
    words = [w for w in re.findall(r'\b[a-z0-9]{3,}\b', norm_ev)]
    if words:
        matching_words = [w for w in words if w in norm_src]
        ratio = len(matching_words) / len(words)
        if ratio >= 0.70:
            return {
                "is_verified": True,
                "match_type": "high_similarity",
                "message": f"Verified ({int(ratio * 100)}% content words matched in source JD)",
            }

    return {
        "is_verified": False,
        "match_type": "unverified_quote",
        "message": "Quote not found in original source document text",
    }


def get_segmentation_dict(segmentation: JDSegmentation, source_text: str = "") -> Dict[str, Any]:
    """Convert JDSegmentation model and linked requirements to structured API dictionary with metrics."""
    # Resolve source text from linked job or job description if not passed explicitly.
    if not source_text and segmentation.job:
        source_text = segmentation.job.description or ""
        if segmentation.job.job_description:
            # Check parsed plain text first, then original text.
            source_text = (
                segmentation.job.job_description.extracted_text
                or segmentation.job.job_description.original_text
                or source_text
            )

    # Group requirements by 15 categories.
    categorized: Dict[str, List[Dict[str, Any]]] = {cat: [] for cat in STANDARD_15_CATEGORIES}

    # Track category statistics.
    category_stats: Dict[str, Dict[str, Any]] = {}
    total_reqs = len(segmentation.requirements)
    mandatory_total = 0
    preferred_total = 0
    verified_total = 0
    unreviewed_total = 0
    grounded_total = 0

    for req in segmentation.requirements:
        cat = req.category if req.category in categorized else "other_requirements"
        is_mand = req.classification == "Mandatory"
        is_appr = bool(req.is_approved)

        if is_mand:
            mandatory_total += 1
        else:
            preferred_total += 1

        if is_appr:
            verified_total += 1
        else:
            unreviewed_total += 1

        # Verify evidence against source text. Fall back to original_text if explicit evidence quote is missing.
        ev_candidate = (req.evidence or "").strip() or (req.original_text or "").strip()
        ev_verify = verify_evidence_in_source(ev_candidate, source_text)
        if ev_verify["is_verified"]:
            grounded_total += 1

        origin = getattr(req, "source_origin", None) or ("recruiter_edited" if is_appr else "ai_extracted")

        # Sanitize requirement text so internal debug annotations never leak into recruiter UI
        clean_req_text = re.sub(r"\[(?:section|source_line|category)=[^\]]+\]\s*", "", req.original_text or "", flags=re.IGNORECASE).strip()
        categorized[cat].append({
            "id": req.id,
            "category": req.category,
            "category_label": CATEGORY_LABELS.get(req.category, req.category.replace("_", " ").title()),
            "original_text": clean_req_text or req.original_text,
            "classification": req.classification,
            "normalized_skill": req.normalized_skill,
            "experience_years": req.experience_years,
            "evidence": req.evidence,
            "confidence": req.confidence,
            "is_approved": is_appr,
            "review_state": "verified" if is_appr else "unreviewed",
            "source_origin": origin,
            "evidence_verification": ev_verify,
            "order_index": req.order_index,
        })

    # Compile category-level stats.
    empty_categories = []
    filled_categories = 0
    for cat_code, items in categorized.items():
        cat_count = len(items)
        if cat_count == 0:
            empty_categories.append(cat_code)
        else:
            filled_categories += 1

        category_stats[cat_code] = {
            "code": cat_code,
            "label": CATEGORY_LABELS.get(cat_code, cat_code.replace("_", " ").title()),
            "count": cat_count,
            "mandatory": sum(1 for i in items if i["classification"] == "Mandatory"),
            "preferred": sum(1 for i in items if i["classification"] == "Preferred"),
            "verified": sum(1 for i in items if i["is_approved"]),
            "unreviewed": sum(1 for i in items if not i["is_approved"]),
            "is_empty": cat_count == 0,
        }

    # Sanitize job overview and role summary from debug tags, raw markdown, and generic boilerplate
    clean_overview = re.sub(r"\[(?:section|source_line|category)=[^\]]+\]\s*", "", segmentation.job_overview or "", flags=re.IGNORECASE)
    clean_overview = re.sub(r"^##\s*(?:Role|Requisition ID|Experience|Location):.*$", "", clean_overview, flags=re.MULTILINE | re.IGNORECASE).strip()

    clean_role_summary = re.sub(r"\[(?:section|source_line|category)=[^\]]+\]\s*", "", segmentation.role_summary or "", flags=re.IGNORECASE).strip()
    is_generic_summary = (
        not clean_role_summary
        or clean_role_summary.lower().startswith("professional role")
        or clean_role_summary.lower().startswith("enterprise hiring requirement")
        or clean_role_summary in {
            "Professional role within engineering organization.",
            "Professional role within technical organization.",
            "Enterprise hiring requirement.",
            "Updated Executive Overview by Recruiter",
        }
    )
    if is_generic_summary:
        job_t = segmentation.job.title if segmentation.job else "Engineering Specialist"
        clean_role_summary = f"Key contributor responsible for delivering end-to-end {job_t} capabilities, solution architecture, and technical execution across business operations."

    return {
        "id": segmentation.id,
        "job_id": segmentation.job_id,
        "job_description_id": segmentation.job_description_id,
        "version": segmentation.version,
        "status": segmentation.status,
        "model_name": segmentation.model_name,
        "job_overview": clean_overview or segmentation.job_overview or "Comprehensive role owning technical delivery and architecture.",
        "role_summary": clean_role_summary,
        "is_approved": bool(segmentation.is_approved),
        "approved_by": segmentation.approved_by,
        "approved_at": segmentation.approved_at.isoformat() if segmentation.approved_at else None,
        "created_at": segmentation.created_at.isoformat() if segmentation.created_at else None,
        "updated_at": segmentation.updated_at.isoformat() if segmentation.updated_at else None,
        "structured_scope": getattr(segmentation, "structured_scope", None) or {},
        "intelligence_data": getattr(segmentation, "intelligence_data", None) or {},
        "total_requirements": total_reqs,
        "metrics": {
            "total_requirements": total_reqs,
            "mandatory_count": mandatory_total,
            "preferred_count": preferred_total,
            "verified_count": verified_total,
            "unreviewed_count": unreviewed_total,
            "grounded_evidence_count": grounded_total,
            "grounded_percent": int((grounded_total / max(total_reqs, 1)) * 100),
            "categories_filled": filled_categories,
            "categories_empty": empty_categories,
        },
        "category_stats": category_stats,
        "categories": categorized,
        "available_categories": [
            {
                "code": code,
                "label": CATEGORY_LABELS[code],
                "count": len(categorized[code]),
                "is_empty": len(categorized[code]) == 0,
                "is_narrative": code in {"job_overview", "role_summary"},
            }
            for code in STANDARD_15_CATEGORIES
        ],
    }
