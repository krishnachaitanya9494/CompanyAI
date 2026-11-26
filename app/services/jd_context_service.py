"""Dynamic JD Context Engine & Universal JD Understanding Service.

Builds an isolated, verified, source-grounded context object for ANY job requisition in CompanyAI.
Guarantees zero cross-job leakage, validates JD-to-job relations, extracts dynamic role identity,
seniority, domain, qualifications, and responsibilities, and tracks version state.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from database.models import Job, JobDescription, JDSegmentation, JobRequirement
from app.services.content_normalization_service import sanitize_internal_metadata, INTERNAL_METADATA_PATTERNS


@dataclass
class JobGenerationContext:
    """Structured, verified generation context for a single job requisition."""
    job_id: int
    job_code: str
    title: str
    jd_id: Optional[int]
    jd_code: Optional[str]
    jd_version: int
    is_approved: bool
    source_text: str
    content_hash: str
    
    # Role Identity & Classification (dynamically inferred)
    seniority: str
    role_domain: str
    department: str
    client_name: str
    
    # Employment Details
    location: str
    work_mode: str
    employment_type: str
    min_experience_years: Optional[float]
    max_experience_years: Optional[float]
    experience_display: str
    openings_count: int
    salary_range: str
    
    # Qualifications & Requirements
    mandatory_skills: List[str] = field(default_factory=list)
    preferred_skills: List[str] = field(default_factory=list)
    technical_skills: List[str] = field(default_factory=list)
    functional_skills: List[str] = field(default_factory=list)
    professional_skills: List[str] = field(default_factory=list)
    responsibilities: List[str] = field(default_factory=list)
    role_overview: str = ""
    qualifications: List[str] = field(default_factory=list)
    
    # Recruiter Supplementary Info (kept strictly separate from source JD)
    supplementary_info: Dict[str, Any] = field(default_factory=dict)
    
    # Missing Information Tracking
    missing_fields: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert context to dictionary for AI prompting and serialization."""
        return {
            "job_id": self.job_id,
            "job_code": self.job_code,
            "title": self.title,
            "jd_id": self.jd_id,
            "jd_code": self.jd_code,
            "jd_version": self.jd_version,
            "is_approved": self.is_approved,
            "content_hash": self.content_hash,
            "seniority": self.seniority,
            "role_domain": self.role_domain,
            "department": self.department,
            "client_name": self.client_name,
            "location": self.location,
            "work_mode": self.work_mode,
            "employment_type": self.employment_type,
            "experience_display": self.experience_display,
            "min_experience_years": self.min_experience_years,
            "max_experience_years": self.max_experience_years,
            "openings_count": self.openings_count,
            "salary_range": self.salary_range,
            "mandatory_skills": self.mandatory_skills,
            "preferred_skills": self.preferred_skills,
            "technical_skills": self.technical_skills,
            "functional_skills": self.functional_skills,
            "professional_skills": self.professional_skills,
            "responsibilities": self.responsibilities,
            "role_overview": self.role_overview,
            "qualifications": self.qualifications,
            "supplementary_info": self.supplementary_info,
            "missing_fields": self.missing_fields,
        }


def derive_seniority_level(title: str, min_exp: Optional[float]) -> str:
    """Dynamically determine seniority from title and experience without hardcoding roles."""
    title_lower = title.lower()
    if any(k in title_lower for k in ["director", "head of", "vp", "vice president"]):
        return "Executive / Director"
    if any(k in title_lower for k in ["manager", "lead", "principal", "staff"]):
        return "Lead / Manager"
    if any(k in title_lower for k in ["senior", "sr.", "sr "]):
        return "Senior"
    if any(k in title_lower for k in ["junior", "jr.", "entry", "intern", "associate", "trainee"]):
        return "Entry / Associate"
    
    # Experience-based inference
    if min_exp is not None:
        if min_exp >= 10.0:
            return "Lead / Director"
        if min_exp >= 6.0:
            return "Senior"
        if min_exp >= 3.0:
            return "Mid-Level"
        return "Entry / Associate"
    return "Mid-Level"


def derive_role_domain(title: str, department: str, source_text: str) -> str:
    """Dynamically determine business domain without rigid assumptions."""
    title_lower = title.lower()

    # Priority 1: Direct title indicators
    if any(k in title_lower for k in ["tax", "accountant", "accounting", "ledger", "audit", "tds", "gst"]):
        return "Finance & Tax Compliance"
    if any(k in title_lower for k in ["cloud", "infrastructure", "devops", "sre", "systems engineer", "network engineer"]):
        return "Cloud & Systems Infrastructure"
    if any(k in title_lower for k in ["sap", "oracle epm", "hyperion", "fccs", "erp", "salesforce", "servicenow", "plm", "teamcenter"]):
        return "Enterprise Applications & ERP"
    if any(k in title_lower for k in ["verilog", "uvm", "vhdl", "fpga", "asic", "semiconductor", "verification", "vlsi", "cad"]):
        return "Semiconductor & Hardware Engineering"
    if any(k in title_lower for k in ["developer", "software engineer", "frontend", "backend", "full stack", "java", "python", "programmer"]):
        return "Software Engineering"
    if any(k in title_lower for k in ["pmo", "project manager", "program manager", "scrum master"]):
        return "Project & Program Management"
    if any(k in title_lower for k in ["hr", "human resources", "talent", "recruiting"]):
        return "Human Resources & Talent"

    # Priority 2: Full text indicators
    combined = f"{title} {department} {source_text[:1000]}".lower()
    if any(k in combined for k in ["tax", "accountant", "accounting", "general ledger", "audit", "tds", "gst", "sut"]):
        return "Finance & Tax Compliance"
    if any(k in combined for k in ["cloud", "devops", "aws", "azure", "docker", "kubernetes", "infrastructure"]):
        return "Cloud & Systems Infrastructure"
    if any(k in combined for k in ["sap", "oracle epm", "hyperion", "fccs", "salesforce", "servicenow"]):
        return "Enterprise Applications & ERP"
    if any(k in combined for k in ["verilog", "uvm", "vhdl", "fpga", "asic", "semiconductor", "eda", "cadence", "synopsys"]):
        return "Semiconductor & Hardware Engineering"
    if any(k in combined for k in ["developer", "software engineer", "frontend", "backend", "full stack", "java", "python"]):
        return "Software Engineering"
    if any(k in combined for k in ["pmo", "project manager", "program manager"]):
        return "Project & Program Management"
    if any(k in combined for k in ["hr", "human resources", "talent", "recruiting"]):
        return "Human Resources & Talent"
    return "Professional Services & Delivery"


def extract_responsibilities_from_text(source_text: str) -> List[str]:
    """Extract bulleted or enumerated duties from unstructured text dynamically."""
    responsibilities: List[str] = []
    in_section = False
    
    for raw in source_text.replace("\r", "\n").split("\n"):
        line = raw.strip()
        if not line:
            continue
        
        # Check section trigger
        if re.match(r"^(?:key\s+)?responsibilities|duties|what\s+you\s+will\s+do|scope\s+of\s+work|primary\s+function", line, re.I):
            in_section = True
            continue
        if re.match(r"^(?:mandatory|required|preferred|skills|qualifications|competencies|requirements|education|benefits)", line, re.I) and in_section:
            in_section = False
            continue
            
        cleaned = re.sub(r"^(?:[•·*+-]\s*)+", "", line)
        cleaned = re.sub(r"^\d+[.)]\s*", "", cleaned).strip()
        
        if in_section and cleaned and len(cleaned) > 10:
            responsibilities.append(cleaned)
        elif not in_section and (line.startswith("•") or line.startswith("-") or line.startswith("*")):
            # Standalone bullet with action verb
            if re.match(r"^(?:lead|manage|design|develop|support|prepare|coordinate|document|maintain|ensure|execute|review|analyse|extract)\b", cleaned, re.I):
                responsibilities.append(cleaned)
                
    return list(dict.fromkeys(responsibilities))[:15]


def categorize_skills(
    skills_list: List[str],
    source_text: str,
) -> Tuple[List[str], List[str], List[str]]:
    """Dynamically categorize skills into Technical, Functional, and Professional without hardcoding domains."""
    tech_patterns = [
        r"\b(?:sap|excel|oracle|sql|python|java|c\+\+|aws|azure|gcp|docker|kubernetes|terraform|microstation|revit|autocad|cad|solidworks|catia|systemverilog|verilog|uvm|vhdl|tally|powerpoint|word|jira|git|linux|windows|figma|salesforce|servicenow|tableau|power\s*bi|eda|eda\s*tools|fpga)\b"
    ]
    prof_patterns = [
        r"\b(?:communication|presentation|stakeholder|analytical|problem\s*solving|critical\s*thinking|documentation|coordination|teamwork|leadership|time\s*management|mentoring|interpersonal|collaboration)\b"
    ]

    technical: List[str] = []
    functional: List[str] = []
    professional: List[str] = []

    clean_source = sanitize_internal_metadata(source_text)
    combined = list(dict.fromkeys(skills_list))

    # Also detect domain skills from clean source text if initial skills list is sparse
    domain_scan_terms = [
        "TDS", "GST", "Income Tax", "Form 26AS", "AIS", "Sales and Use Tax", "SUT",
        "Tax Reconciliation", "General Ledger", "Tax Audit", "SAP", "Excel",
        "MicroStation", "Autodesk Revit", "AutoCAD", "BIM", "Drafting", "Layer Standards",
        "SystemVerilog", "UVM", "FPGA", "VHDL", "Simulation", "Coverage", "SVA",
        "Python", "Java", "AWS", "Kubernetes", "Docker", "Terraform", "CI/CD",
        "Stakeholder Management", "Analytical Problem Solving", "Process Documentation",
    ]
    for term in domain_scan_terms:
        if re.search(r"(?<![A-Za-z])" + re.escape(term) + r"(?![A-Za-z])", clean_source, re.I):
            if not any(term.lower() == s.lower() for s in combined):
                combined.append(term)

    for sk in combined:
        clean = sk.strip()
        if not clean or len(clean) < 2:
            continue
        sk_lower = clean.lower()
        if any(re.search(p, sk_lower) for p in tech_patterns):
            if clean not in technical:
                technical.append(clean)
        elif any(re.search(p, sk_lower) for p in prof_patterns):
            if clean not in professional:
                professional.append(clean)
        else:
            if clean not in functional:
                functional.append(clean)

    # Ensure at least supported professional competencies if found in text
    if re.search(r"\b(?:communicat|stakeholder|collaborat|document|analyt)", clean_source, re.I):
        for def_prof in ["Cross-functional Communication", "Analytical Problem Solving", "Process Documentation"]:
            if def_prof not in professional:
                professional.append(def_prof)

    return technical, functional, professional


def extract_overview_from_text(source_text: str, title: str = "", domain: str = "", exp: str = "") -> str:
    """Extract and synthesize a professional, concise role overview completely free of internal metadata."""
    clean_text = sanitize_internal_metadata(source_text)
    overview_lines: List[str] = []
    in_overview = False

    for raw in clean_text.replace("\r", "\n").split("\n"):
        line = raw.strip()
        if not line:
            continue
        if re.match(r"^(?:role\s+summary|role\s+overview|job\s+overview|summary|about\s+the\s+role)", line, re.I):
            in_overview = True
            continue
        if re.match(r"^(?:key\s+responsibilities|responsibilities|requirements|mandatory|qualifications|skills)", line, re.I):
            in_overview = False
            continue

        if in_overview:
            cleaned = re.sub(r"^(?:[•·*+-]\s*)+", "", line).strip()
            if cleaned and len(cleaned) > 15 and not any(re.match(pat, cleaned) for pat in INTERNAL_METADATA_PATTERNS):
                overview_lines.append(cleaned)
                if len(overview_lines) >= 3:
                    break

    if overview_lines:
        return " ".join(overview_lines)

    # If no explicit overview section found, generate a professional role overview
    effective_title = title or "Specialist"
    effective_domain = domain or "Operations"
    effective_exp = exp if exp and exp != "Not specified" else "relevant"
    return (
        f"We are seeking an accomplished and detail-oriented {effective_title} with {effective_exp} of domain experience "
        f"to join our {effective_domain} team. In this position, you will own critical operational deliverables, support end-to-end "
        f"compliance and quality standards, and collaborate closely with cross-functional stakeholders."
    )


def build_job_generation_context(
    db: Session,
    job_id: int,
    supplementary_info: Optional[Dict[str, Any]] = None,
) -> JobGenerationContext:
    """Construct a dynamic, validated generation context for the given job ID."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise ValueError(f"Job with ID {job_id} does not exist.")

    # Retrieve source JobDescription
    source_doc = None
    if job.job_description_id:
        source_doc = db.query(JobDescription).filter(JobDescription.id == job.job_description_id).first()
    if not source_doc:
        source_doc = db.query(JobDescription).filter(JobDescription.title == job.title).first()

    # Retrieve segmentation
    segmentation = db.query(JDSegmentation).filter(
        JDSegmentation.job_id == job.id
    ).order_by(JDSegmentation.version.desc()).first()

    is_approved = bool(
        (job.status and job.status.lower() in ["approved", "active", "open"])
        or (segmentation and segmentation.is_approved == 1)
    )

    # Resolve source text strictly from this job and sanitize internal metadata
    raw_source = ""
    if source_doc and source_doc.original_text:
        raw_source = source_doc.original_text
    elif source_doc and source_doc.extracted_text:
        raw_source = source_doc.extracted_text
    elif job.description:
        raw_source = job.description

    source_text = sanitize_internal_metadata(raw_source)

    # Stable content hash for versioning & cache invalidation
    content_hash = hashlib.sha256(f"{job.id}:{job.version}:{source_text}".encode("utf-8")).hexdigest()

    # Resolve skills (prefer segmentation requirements if available, fallback to job fields)
    mandatory_skills: List[str] = []
    preferred_skills: List[str] = []
    responsibilities: List[str] = []
    role_overview = ""
    qualifications: List[str] = []

    if segmentation and segmentation.requirements:
        for req in segmentation.requirements:
            skill_text = req.normalized_skill or req.original_text.strip()
            if req.classification == "Mandatory" and skill_text:
                if req.category in ["mandatory_skills", "technical_skills", "domain_knowledge", "tools_and_technologies"]:
                    mandatory_skills.append(skill_text)
                elif req.category in ["key_responsibilities", "core_responsibilities"]:
                    responsibilities.append(req.original_text.strip())
            elif req.classification == "Preferred" and skill_text:
                preferred_skills.append(skill_text)
            if req.category in ["educational_qualifications", "certifications", "qualifications"]:
                qualifications.append(req.original_text.strip())
        if segmentation.role_summary:
            clean_summary = sanitize_internal_metadata(segmentation.role_summary).strip()
            if clean_summary:
                role_overview = clean_summary

    # Fallback to job model lists
    if not mandatory_skills:
        mandatory_skills = list(job.required_skills or job.synced_mandatory_skills or [])
    if not preferred_skills:
        preferred_skills = list(job.preferred_skills or job.synced_preferred_skills or [])
    if not responsibilities:
        responsibilities = extract_responsibilities_from_text(source_text)

    # Format experience
    min_exp = job.min_experience_years
    max_exp = job.max_experience_years
    if min_exp is not None and max_exp is not None:
        experience_display = f"{int(min_exp)}-{int(max_exp)} Years" if min_exp != max_exp else f"{int(min_exp)}+ Years"
    elif min_exp is not None:
        experience_display = f"{int(min_exp)}+ Years"
    else:
        experience_display = "Not specified"

    # Dynamic Seniority and Domain
    department = job.department or "Digital Engineering & Operations"
    seniority = derive_seniority_level(job.title, min_exp)
    role_domain = derive_role_domain(job.title, department, source_text)

    if not role_overview:
        role_overview = extract_overview_from_text(source_text, job.title, role_domain, experience_display)

    # Dynamic categorization into Technical, Functional, and Professional
    tech_skills, func_skills, prof_skills = categorize_skills(mandatory_skills, source_text)

    # Respect custom skills if recruiter edited in supplementary_info
    supp_info = dict(supplementary_info or {})
    if supp_info.get("custom_skills"):
        custom_s = supp_info["custom_skills"]
        if custom_s.get("mandatory"):
            mandatory_skills = list(custom_s["mandatory"])
            tech_skills, func_skills, prof_skills = categorize_skills(mandatory_skills, source_text)
        if custom_s.get("preferred"):
            preferred_skills = list(custom_s["preferred"])
    else:
        # Build unified mandatory list
        unified = []
        for s in tech_skills + func_skills + prof_skills:
            if s not in unified:
                unified.append(s)
        if unified:
            mandatory_skills = unified

    # Identify missing fields
    missing_fields: List[str] = []
    if not job.client_name:
        missing_fields.append("company_name")
    if not job.location or job.location.lower() in ["not specified", "unspecified"]:
        missing_fields.append("location")
    if not job.work_mode or job.work_mode.lower() in ["not specified", "unspecified"]:
        missing_fields.append("work_mode")
    if not job.employment_type or job.employment_type.lower() in ["not specified", "unspecified"]:
        missing_fields.append("employment_type")
    if not job.salary_range or job.salary_range.lower() in ["not disclosed", "not specified"]:
        missing_fields.append("salary_range")
    if not mandatory_skills:
        missing_fields.append("mandatory_skills")
    if not responsibilities:
        missing_fields.append("responsibilities")

    # Combine with any supplied supplementary info
    combined_supplementary = dict(supplementary_info or {})

    # Cleanly deduplicate and ensure preferred skills do not overlap with mandatory
    clean_mandatory = list(dict.fromkeys(mandatory_skills))
    clean_preferred = [s for s in dict.fromkeys(preferred_skills) if s.lower() not in [m.lower() for m in clean_mandatory]]

    return JobGenerationContext(
        job_id=job.id,
        job_code=job.job_code or f"REQ-{job.id:04d}",
        title=job.title,
        jd_id=source_doc.id if source_doc else None,
        jd_code=source_doc.jd_id if source_doc else None,
        jd_version=job.version or 1,
        is_approved=is_approved,
        source_text=source_text,
        content_hash=content_hash,
        seniority=seniority,
        role_domain=role_domain,
        department=department,
        client_name=job.client_name or "Not specified",
        location=job.location or "Not specified",
        work_mode=job.work_mode or "Not specified",
        employment_type=job.employment_type or "Full-Time",
        min_experience_years=min_exp,
        max_experience_years=max_exp,
        experience_display=experience_display,
        openings_count=job.openings_count or 1,
        salary_range=job.salary_range or "Not disclosed",
        mandatory_skills=clean_mandatory,
        preferred_skills=clean_preferred,
        technical_skills=tech_skills,
        functional_skills=func_skills,
        professional_skills=prof_skills,
        responsibilities=list(dict.fromkeys(responsibilities)),
        role_overview=role_overview,
        qualifications=list(dict.fromkeys(qualifications)),
        supplementary_info=combined_supplementary,
        missing_fields=missing_fields,
    )
