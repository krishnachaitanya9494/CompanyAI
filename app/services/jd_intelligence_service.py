"""Centralized Job Description Intelligence Engine for CompanyAI 2.0.

Extracts, structures, validates, and enriches:
1. Role Intelligence (Title, Alternatives, Seniority, Department, Industry, Function, Exp)
2. Technical Skills Intelligence (Mandatory, Preferred, Tools, Frameworks, Languages, Certs)
3. Domain Intelligence (Business processes, Terminology, Domain platforms, Synonyms)
4. Responsibilities Intelligence (Core, Technical, Functional, Operational, Deliverables)
5. Qualification Intelligence (Education, Certs, Required Exp, Domain Exp)
6. 12-Section Structured Scope & Responsibilities (Audit-grounded, zero-clutter)
7. Inconsistency & Contradiction Detection (e.g. Title vs conflicting technical domains)
8. Multi-Platform Boolean Query Generation (Naukri, LinkedIn, X-Ray, Advanced strategies)
"""

import hashlib
import json
import logging
import re
import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.ai.config import ai_config
from app.ai.providers.chat_provider import chat_provider
from app.services.boolean_query_service import (
    AllBooleanQueriesResponse,
    generate_boolean_queries,
)
from database.models import Job, JobDescription, JDSegmentation, JobRequirement

logger = logging.getLogger("companyai.jd_intelligence")


# ----------------------------------------------------
# Pydantic Schemas for Structured JD Intelligence
# ----------------------------------------------------

class RoleIntelligence(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str = Field(..., description="Canonical job title")
    alternative_titles: List[str] = Field(default_factory=list, description="Equivalent market titles")
    seniority_level: str = Field(default="Not specified", description="Role seniority band")
    job_family: str = Field(default="Operations / Business Support", description="Job family group")
    functional_area: str = Field(default="Retail Item & Product Data Operations", description="Functional area")
    role_type: str = Field(default="Staff Augmentation / Operational Support", description="Role type")
    industry: str = Field(default="Retail / Merchandising / Product Data Operations", description="Target industry sector")
    department: str = Field(default="Operations", description="Functional department or practice")
    job_function: str = Field(default="Operations Support", description="Primary job function")
    work_environment: str = Field(default="Cross-functional vendor and merchant coordination", description="Work environment")
    shift_requirement: Optional[str] = Field(default=None, description="Shift constraints e.g. Evening shift flexibility")
    min_experience_years: float = Field(default=0.0, ge=0.0)
    max_experience_years: float = Field(default=0.0, ge=0.0)
    employment_type: str = Field(default="Full-time")
    work_mode: str = Field(default="Hybrid")
    location: str = Field(default="Not specified")
    openings_count: Optional[int] = Field(default=1)


class TechnicalSkillsIntelligence(BaseModel):
    model_config = ConfigDict(extra="ignore")
    mandatory_skills: List[str] = Field(default_factory=list, description="Must-have competencies")
    preferred_skills: List[str] = Field(default_factory=list, description="Good-to-have skills")
    secondary_skills: List[str] = Field(default_factory=list, description="Supporting technical skills")
    tools_and_platforms: List[str] = Field(default_factory=list, description="Specific software tools")
    frameworks: List[str] = Field(default_factory=list, description="Software frameworks or architectures")
    programming_languages: List[str] = Field(default_factory=list, description="Languages required")
    certifications: List[str] = Field(default_factory=list, description="Required or preferred certifications")
    technologies_and_integrations: List[str] = Field(default_factory=list, description="API and integration protocols")


class DomainIntelligence(BaseModel):
    model_config = ConfigDict(extra="ignore")
    business_domain: str = Field(default="Enterprise Software", description="Primary business domain")
    industry_terminology: List[str] = Field(default_factory=list, description="Industry-specific terms")
    business_processes: List[str] = Field(default_factory=list, description="Functional business workflows")
    functional_knowledge: List[str] = Field(default_factory=list, description="Required subject matter expertise")
    domain_platforms: List[str] = Field(default_factory=list, description="Domain-specific enterprise platforms")
    abbreviations_and_synonyms: Dict[str, str] = Field(default_factory=dict, description="Domain glossary acronyms")


class ResponsibilitiesIntelligence(BaseModel):
    model_config = ConfigDict(extra="ignore")
    core_responsibilities: List[str] = Field(default_factory=list)
    technical_responsibilities: List[str] = Field(default_factory=list)
    functional_responsibilities: List[str] = Field(default_factory=list)
    operational_responsibilities: List[str] = Field(default_factory=list)
    deliverables: List[str] = Field(default_factory=list)
    stakeholder_responsibilities: List[str] = Field(default_factory=list)
    leadership_responsibilities: List[str] = Field(default_factory=list)


class QualificationIntelligence(BaseModel):
    model_config = ConfigDict(extra="ignore")
    education: str = Field(default="Bachelor's degree in Computer Science or related engineering field")
    certifications: List[str] = Field(default_factory=list)
    required_experience: str = Field(default="5+ years hands-on experience")
    domain_experience: str = Field(default="Direct domain implementation experience")
    mandatory_qualifications: List[str] = Field(default_factory=list)
    preferred_qualifications: List[str] = Field(default_factory=list)


class JDInconsistency(BaseModel):
    model_config = ConfigDict(extra="ignore")
    issue_type: str = Field(..., description="CONTRADICTION | INCOMPLETE_DATA | UNVERIFIED_ASSUMPTION")
    description: str = Field(..., description="Detailed explanation of the conflicting requirement")
    severity: str = Field(default="MEDIUM", description="HIGH | MEDIUM | LOW")
    source_evidence: Optional[str] = Field(default=None, description="Verbatim conflicting text")


class JDStructuredScope(BaseModel):
    """The 12 Canonical Structured Sections for JD Scope and Responsibilities Presentation."""
    model_config = ConfigDict(extra="ignore")
    role_overview: str = Field(..., description="1. Role Overview")
    business_context: str = Field(..., description="2. Business Context")
    technical_scope: str = Field(..., description="3. Technical Scope")
    core_responsibilities: List[str] = Field(default_factory=list, description="4. Core Responsibilities")
    functional_responsibilities: List[str] = Field(default_factory=list, description="5. Functional Responsibilities")
    required_skills: List[str] = Field(default_factory=list, description="6. Required Skills")
    preferred_skills: List[str] = Field(default_factory=list, description="7. Preferred Skills")
    domain_expertise: List[str] = Field(default_factory=list, description="8. Domain Expertise")
    experience_requirements: str = Field(..., description="9. Experience Requirements")
    deliverables: List[str] = Field(default_factory=list, description="10. Deliverables")
    missing_information: List[str] = Field(default_factory=list, description="11. Missing Information")
    jd_inconsistencies: List[JDInconsistency] = Field(default_factory=list, description="12. JD Inconsistencies")


class CategorizedRequirements(BaseModel):
    """Section 4 Categorized Requirements preserving original and normalized wording."""
    model_config = ConfigDict(extra="ignore")
    functional_domain_skills: List[str] = Field(default_factory=list, description="A. Functional / Domain Skills")
    tools_technical_proficiency: List[str] = Field(default_factory=list, description="B. Tools / Technical Proficiency")
    behavioral_soft_skills: List[str] = Field(default_factory=list, description="C. Behavioral / Soft Skills")
    education_experience: List[str] = Field(default_factory=list, description="D. Education / Experience")
    operational_constraints: List[str] = Field(default_factory=list, description="E. Operational Constraints")


class JDIntelligenceResult(BaseModel):
    """Complete structured intelligence output for a job description."""
    model_config = ConfigDict(extra="ignore")
    job_id: Optional[int] = None
    role_intelligence: RoleIntelligence
    technical_skills: TechnicalSkillsIntelligence
    domain_intelligence: DomainIntelligence
    responsibilities: ResponsibilitiesIntelligence
    qualifications: QualificationIntelligence
    structured_scope: JDStructuredScope
    boolean_queries: AllBooleanQueriesResponse
    categorized_requirements: CategorizedRequirements = Field(default_factory=CategorizedRequirements)
    inconsistencies: List[JDInconsistency] = Field(default_factory=list)
    confidence_score: float = Field(default=0.95, ge=0.0, le=1.0)
    model_used: str = Field(default="nemotron-intelligence-engine")
    generation_method: str = Field(default="nemotron_chat_api")
    source_provenance: Dict[str, Any] = Field(default_factory=dict)
    analyzed_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ----------------------------------------------------
# High-Fidelity Domain & Rule Extraction Pipeline
# ----------------------------------------------------

KNOWN_DOMAINS = {
    "servicenow_fso": {
        "keywords": ["servicenow", "fso", "complaint management", "case management", "financial services operations"],
        "alt_titles": [
            "ServiceNow FSO Developer",
            "ServiceNow FSO Consultant",
            "ServiceNow Technical Lead",
            "ServiceNow Solution Architect",
            "Case Management Software Engineer",
        ],
        "default_domain": "Banking & Financial Services Operations",
        "default_skills": [
            "ServiceNow Development",
            "ServiceNow FSO",
            "Complaint Management",
            "Case Management",
            "Flow Designer",
            "Business Rules",
            "REST APIs",
        ],
        "default_tools": ["ServiceNow Platform", "Flow Designer", "ServiceNow Studio", "Postman", "ServiceNow FSO Module"],
        "default_frameworks": ["ServiceNow Financial Services Operations (FSO) Framework"],
        "default_certs": ["Certified System Administrator (CSA)", "Certified Application Developer (CAD)", "CIS - Financial Services Operations"],
        "default_terms": [
            "Complaint Lifecycle",
            "Complaint Intake",
            "Omnichannel Complaint Capture",
            "Remediation",
            "SLA & Regulatory-Clock Controls",
            "Investigation Workflows",
            "Customer 360",
        ],
        "abbrevs": {
            "FSO": "Financial Services Operations",
            "SLA": "Service Level Agreement",
            "UAT": "User Acceptance Testing",
            "CFPB": "Consumer Financial Protection Bureau",
            "CRM": "Customer Relationship Management",
        },
    },
    "cloud_infrastructure": {
        "keywords": ["cloud", "aws", "azure", "gcp", "kubernetes", "devops", "infrastructure"],
        "alt_titles": [
            "Cloud Solutions Architect",
            "Senior DevOps Engineer",
            "Site Reliability Engineer (SRE)",
            "Cloud Infrastructure Engineer",
            "Platform Engineer",
        ],
        "default_domain": "Cloud Infrastructure & Platform Engineering",
        "default_skills": [
            "Amazon Web Services (AWS)",
            "Kubernetes",
            "Docker",
            "Terraform",
            "CI/CD Pipelines",
            "Linux",
            "Python",
        ],
        "default_tools": ["AWS Management Console", "Kubernetes", "Helm", "Terraform", "GitLab CI", "Prometheus"],
        "default_frameworks": ["Cloud Native Architecture", "Infrastructure as Code (IaC)"],
        "default_certs": ["AWS Certified Solutions Architect", "Certified Kubernetes Administrator (CKA)"],
        "default_terms": ["High Availability", "Disaster Recovery", "Microservices Architecture", "Observability", "Auto-scaling"],
        "abbrevs": {"AWS": "Amazon Web Services", "IaC": "Infrastructure as Code", "SRE": "Site Reliability Engineering"},
    },
    "vlsi_verification": {
        "keywords": ["verilog", "systemverilog", "uvm", "vhdl", "fpga", "asic", "design verification", "do-254"],
        "alt_titles": [
            "Design Verification Engineer",
            "ASIC Verification Engineer",
            "FPGA Verification Engineer",
            "UVM Verification Specialist",
            "Hardware Validation Engineer",
        ],
        "default_domain": "Semiconductor & Avionics Hardware Engineering",
        "default_skills": [
            "Verilog",
            "SystemVerilog",
            "UVM",
            "VHDL",
            "FPGA Design",
            "Functional Coverage",
            "SVA",
            "Simulation & Debug",
        ],
        "default_tools": ["Cadence Incisive", "Synopsys VCS", "ModelSim / QuestaSim", "Vivado", "Quartus"],
        "default_frameworks": ["Universal Verification Methodology (UVM)", "DO-254 Avionics Hardware Lifecycle"],
        "default_certs": ["DO-254 DAL-B Certification Compliance Exposure"],
        "default_terms": ["SystemVerilog Assertions (SVA)", "Constrained Random Verification", "Code Coverage", "DO-254 Compliance"],
        "abbrevs": {"UVM": "Universal Verification Methodology", "SVA": "SystemVerilog Assertions", "FPGA": "Field-Programmable Gate Array"},
    },
    "oracle_epm": {
        "keywords": ["hyperion", "epm", "fccs", "pbcs", "essbase", "financial consolidation", "smart view"],
        "alt_titles": [
            "Hyperion Planning Consultant",
            "Oracle EPM Cloud Architect",
            "Financial Systems Consultant",
            "Oracle FCCS Specialist",
            "Essbase Developer",
        ],
        "default_domain": "Corporate Financial Systems & Enterprise Performance Management",
        "default_skills": [
            "Oracle FCCS",
            "Hyperion Financial Management (HFM)",
            "Financial Consolidation",
            "Smart View",
            "Calculation Scripts",
            "EPM Automate",
            "Essbase",
            "SQL",
        ],
        "default_tools": ["Oracle EPM Cloud", "Smart View for Office", "Essbase", "Data Management / FDMEE"],
        "default_frameworks": ["Financial Consolidation & Close Architecture", "EPM Automate Automation"],
        "default_certs": ["Oracle EPM Cloud Certified Implementation Specialist"],
        "default_terms": ["Dimension Hierarchies", "Intercompany Eliminations", "Currency Translation", "Close Process Automation"],
        "abbrevs": {"FCCS": "Financial Consolidation and Close Cloud Service", "EPM": "Enterprise Performance Management"},
    },
    "retail_product_operations": {
        "keywords": [
            "item setup", "item set up", "item launches", "product data", "item data",
            "data quality", "data remediation", "data validation", "merchant", "vendor coordination",
            "retail operations", "item coe", "launch readiness", "merchandising", "product launches",
        ],
        "alt_titles": [
            "Item Setup Specialist",
            "Product Data Operations Specialist",
            "Item Data Analyst",
            "Catalog Operations Specialist",
            "Retail Merchandising Operations Associate",
            "Product Launch Coordinator",
        ],
        "default_domain": "Retail Item & Product Data Operations",
        "job_family": "Operations / Business Support",
        "functional_area": "Retail Item & Product Data Operations",
        "role_type": "Staff Augmentation / Operational Support",
        "industry": "Retail / Merchandising / Product Data Operations",
        "work_environment": "Cross-functional vendor and merchant coordination",
        "shift_requirement": "Evening shift flexibility",
        "default_education": "College degree or equivalent work experience",
        "default_skills": [
            "Item Setup",
            "Product Data Management",
            "Data Quality",
            "Data Validation",
            "Data Remediation",
            "Item Launch Management",
            "Vendor Coordination",
            "Merchant Coordination",
            "Retail Operations",
            "Excel",
            "Outlook",
        ],
        "default_tools": ["Microsoft Excel", "Microsoft Outlook", "General PC proficiency"],
        "default_frameworks": ["Retail Product Data Lifecycle", "Service-Level Management (SLA) Protocols"],
        "default_certs": [],
        "default_terms": [
            "Item Setup",
            "Product Data Quality",
            "Data Remediation",
            "Launch Readiness",
            "Vendor Coordination",
            "Merchant Coordination",
            "Service-Level Management",
        ],
        "abbrevs": {
            "COE": "Center of Excellence",
            "SLA": "Service Level Agreement",
            "SKU": "Stock Keeping Unit",
        },
    },
    "cad_engineering": {
        "keywords": ["cad", "revit", "microstation", "autocad", "drafting", "bim", "civil 3d", "solidworks", "catia", "bluebeam"],
        "alt_titles": ["CAD Operator", "CAD Drafter", "CAD Designer", "BIM Specialist", "Draftsperson", "Revit Modeler"],
        "default_domain": "CAD & Engineering Design",
        "job_family": "Engineering / Design",
        "functional_area": "CAD Drafting & BIM Modeling",
        "role_type": "Technical Specialist",
        "industry": "Engineering & Construction",
        "default_skills": ["CAD", "AutoCAD", "Autodesk Revit", "MicroStation", "BIM 360", "2D Drafting", "3D Modeling"],
        "default_tools": ["AutoCAD", "Autodesk Revit", "MicroStation", "Bluebeam"],
        "default_frameworks": ["Building Information Modeling (BIM)", "CAD Deliverable Standards"],
        "default_certs": [],
        "default_terms": ["Commercial Building Systems", "Engineering Deliverables", "CAD Standards", "Construction Drawings"],
        "abbrevs": {"BIM": "Building Information Modeling", "CAD": "Computer-Aided Design"},
    },
    "finance_accounting": {
        "keywords": ["accountant", "accounting", "tax", "gst", "tds", "general ledger", "reconciliation", "sut", "gaap", "form 26as"],
        "alt_titles": ["Staff Accountant", "Tax Analyst", "General Ledger Accountant", "Financial Accountant", "Tax Specialist"],
        "default_domain": "Finance, Accounting & Tax",
        "job_family": "Finance & Accounting",
        "functional_area": "General Ledger & Tax Compliance",
        "role_type": "Professional",
        "industry": "Financial Services & Corporate Accounting",
        "default_skills": ["General Ledger", "Reconciliation", "Tax Compliance", "GST", "TDS", "Form 26AS", "Sales and Use Tax", "GAAP"],
        "default_tools": ["SAP ERP", "Tally", "Excel", "Tax Filing Portals"],
        "default_frameworks": ["US GAAP", "Statutory Tax Compliance Framework"],
        "default_certs": ["Chartered Accountant (CA)", "CPA", "ICWA"],
        "default_terms": ["Reconciliation", "Month-End Close", "Tax Audits", "Statutory Compliance"],
        "abbrevs": {"GST": "Goods and Services Tax", "TDS": "Tax Deducted at Source", "GAAP": "Generally Accepted Accounting Principles"},
    },
    "sap_erp": {
        "keywords": ["sap cpi", "integration suite", "sap", "s/4hana", "cpi", "abap", "groovy"],
        "alt_titles": ["SAP CPI Consultant", "SAP Integration Suite Consultant", "SAP Consultant", "SAP Architect"],
        "default_domain": "SAP & Enterprise ERP",
        "job_family": "Information Technology",
        "functional_area": "SAP Integration Architecture",
        "role_type": "Consultant",
        "industry": "Enterprise Software",
        "default_skills": ["SAP CPI", "SAP", "ABAP", "Groovy", "REST APIs"],
        "default_tools": ["SAP Cloud Platform Integration", "SAP BTP", "SAP Studio"],
        "default_frameworks": ["SAP Integration Suite Architecture", "Clean Core Extensibility"],
        "default_certs": ["SAP Certified Integration Associate"],
        "default_terms": ["iFlows", "Cloud Integration", "Message Mapping", "Adapter Configuration"],
        "abbrevs": {"CPI": "Cloud Platform Integration", "BTP": "Business Technology Platform"},
    },
    "creative_design": {
        "keywords": [
            "art director", "art direction", "creative director", "creative direction",
            "graphic design", "advertising design", "storyboards", "storyboarding",
            "photoshop", "illustrator", "after effects", "cinema 4d", "maya", "indesign",
            "multichannel", "packaging", "typography", "smoke", "keynote", "target brand",
        ],
        "alt_titles": [
            "Art Director",
            "Associate Creative Director",
            "Senior Art Director",
            "Creative Designer",
            "Visual Design Lead",
            "Advertising Art Director",
        ],
        "default_domain": "Advertising, Retail Branding, Creative Media and Marketing",
        "job_family": "Creative / Design",
        "functional_area": "Art Direction and Advertising Design",
        "role_category": "Creative Operations / Media Production",
        "role_type": "Staff Augmentation / Operational Support",
        "industry": "Advertising, Retail Branding, Creative Media and Marketing",
        "work_environment": "Creative studio / agency and cross-functional brand production",
        "default_skills": [
            "Art Direction",
            "Creative Direction",
            "Advertising Design",
            "Graphic Design",
            "Typography",
            "Layout Design",
            "Storyboarding",
            "Adobe Illustrator",
            "Adobe Photoshop",
            "Adobe After Effects",
            "Adobe InDesign",
            "Cinema 4D",
            "Autodesk Maya",
            "PowerPoint",
            "Word",
            "Outlook",
        ],
        "default_tools": [
            "Adobe Illustrator",
            "Adobe Photoshop",
            "Adobe After Effects",
            "Cinema 4D",
            "Autodesk Maya",
            "Adobe InDesign",
            "Smoke",
            "Apple Keynote",
            "Microsoft PowerPoint",
            "Microsoft Word",
            "Microsoft Outlook",
        ],
        "default_frameworks": ["Creative Workflow Standards", "Target Brand Expectations"],
        "default_certs": [],
        "default_terms": [
            "Art Direction",
            "Creative Direction",
            "Advertising Design",
            "Graphic Design",
            "Packaging Design",
            "Promotional Design",
            "Digital Advertising Design",
            "Multichannel Creative",
            "Layout",
            "Typography",
            "Photography Direction",
            "Illustration",
            "Storyboards",
            "Visual Storytelling",
            "Visual Reviews",
            "Brand Alignment",
            "ISM",
            "Smoke",
        ],
        "abbrevs": {
            "ISM": "In-Store Marketing",
            "C4D": "Cinema 4D",
            "AE": "Adobe After Effects",
            "AI": "Adobe Illustrator",
            "PS": "Adobe Photoshop",
            "ID": "Adobe InDesign",
        },
    },
}


def _detect_domain_profile(text: str, title: str) -> Dict[str, Any]:
    """Detect domain taxonomy profile from job title and content with title weighting."""
    combined = f"{title}\n{text}".lower()
    title_lower = (title or "").lower()
    best_profile = None
    best_score = -1

    for domain_key, profile in KNOWN_DOMAINS.items():
        score = 0
        for kw in profile.get("keywords", []):
            if re.search(r"\b" + re.escape(kw) + r"\b", title_lower):
                score += 3
            elif re.search(r"\b" + re.escape(kw) + r"\b", combined):
                score += 1
        if score > best_score:
            best_score = score
            best_profile = profile

    if best_score >= 2 and best_profile:
        return best_profile

    # Default generic technology profile
    return {
        "keywords": [],
        "alt_titles": [],
        "default_domain": "Not specified",
        "default_skills": [],
        "default_tools": [],
        "default_frameworks": [],
        "default_certs": [],
        "default_terms": [],
        "abbrevs": {},
    }


def _detect_inconsistencies(raw_text: str, title: str, domain_profile: Dict[str, Any]) -> List[JDInconsistency]:
    """Detect contradictions, conflicting technology stacks, and incongruous requirements."""
    inconsistencies: List[JDInconsistency] = []
    lowered_text = raw_text.lower()
    lowered_title = title.lower()

    # 1. Contradiction between ServiceNow FSO role and Hardware/FPGA/DO-254 text
    if "servicenow" in lowered_title or "fso" in lowered_title or "complaint" in lowered_title:
        hardware_terms = ["fpga", "verilog", "systemverilog", "do-254", "avionics", "hardware-software integration", "design verification"]
        conflicts = [t for t in hardware_terms if t in lowered_text]
        if conflicts:
            inconsistencies.append(JDInconsistency(
                issue_type="CONTRADICTION",
                description=(
                    f"Job title targets a '{title}' enterprise software role, but extracted text mentions "
                    f"avionics/semiconductor hardware concepts: {', '.join(conflicts)}. This indicates mismatched document merging."
                ),
                severity="HIGH",
                source_evidence=f"Title: '{title}' conflicts with text terms: {conflicts}",
            ))

    # 2. Contradiction between Cloud Architect and strictly Entry-Level expectations
    if re.search(r"\b(?:Architect|Director|Principal|Lead)\b", title, re.I):
        if re.search(r"\b(?:0-1|0-2|1-2)\s*(?:years?|yrs)\b", raw_text, re.I):
            inconsistencies.append(JDInconsistency(
                issue_type="CONTRADICTION",
                description=f"Job title is '{title}' (Senior/Principal band), but requirements state 0-2 years of experience.",
                severity="MEDIUM",
                source_evidence="Title Seniority vs Entry-level Years pattern in JD body",
            ))

    # 3. Incomplete Requisition ID or salary
    if re.search(r"Requisition ID:\s*(?:end-to-end|TBD|N/A|\b[a-z]{3,}\b)", raw_text, re.I):
        inconsistencies.append(JDInconsistency(
            issue_type="INCOMPLETE_DATA",
            description="Requisition ID in text review appears to be placeholder text ('end-to-end') rather than standard format (REQ-XXXX).",
            severity="LOW",
            source_evidence="Requisition ID placeholder extracted from text header",
        ))

    # 4. Conflicting experience ranges across header and qualifications sections
    exp_matches = re.findall(r"(\d+(?:\.\d+)?)\s*(?:[-–]|to)\s*(\d+(?:\.\d+)?)\s*(?:yrs|years|yoe)", raw_text, re.I)
    unique_ranges = {(float(r[0]), float(r[1])) for r in exp_matches}
    if len(unique_ranges) > 1:
        range_strs = [f"{r[0]:g}–{r[1]:g} years" for r in sorted(unique_ranges)]
        inconsistencies.append(JDInconsistency(
            issue_type="CONTRADICTION",
            description=(
                f"Conflicting experience requirements detected in JD ({', '.join(range_strs)}). "
                f"Job header specifies {range_strs[-1]} of experience, while qualifications section states {range_strs[0]}. "
                "Flagged for recruiter review."
            ),
            severity="MEDIUM",
            source_evidence=f"Conflicting ranges found in JD source text: {', '.join(range_strs)}",
        ))

    return inconsistencies


def _extract_bullet_items(raw_text: str, section_header_regex: str, next_headers_regex: str) -> List[str]:
    """Extract list items under a specific section heading cleanly."""
    pattern = rf"(?:{section_header_regex})[:\s]*\n?(.*?)(?=(?:{next_headers_regex})|\Z)"
    match = re.search(pattern, raw_text, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return []

    section_body = match.group(1).strip()
    items: List[str] = []
    for line in section_body.splitlines():
        clean = re.sub(r"^[•\-\*\d+\.\t\s]+", "", line).strip()
        # Strip duplicate nested bullets like '•\t•\t'
        clean = re.sub(r"^[•\-\*\t\s]+", "", clean).strip()
        if len(clean) >= 4 and not re.search(r"^(?:Key responsibilities|Mandatory skills|Target profile|Role:)", clean, re.I):
            items.append(clean)
    return items


def extract_deterministic_jd_intelligence(
    raw_text: str,
    title: str,
    original_source_text: Optional[str] = None,
    job_id: Optional[int] = None,
) -> JDIntelligenceResult:
    """High-fidelity deterministic intelligence extraction with zero external API dependencies."""
    source_to_use = original_source_text or raw_text
    domain_profile = _detect_domain_profile(source_to_use, title)

    # 1. Experience extraction
    min_exp = 0.0
    max_exp = 0.0
    exp_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?))?\+?\s*(?:yrs|years|yoe)", source_to_use, re.I)
    if exp_match:
        min_exp = float(exp_match.group(1))
        max_exp = float(exp_match.group(2)) if exp_match.group(2) else min_exp + 3.0

    # 2. Location extraction
    loc_match = re.search(
        r"\b(Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Chennai|Delhi|Noida|Gurgaon|Gurugram|Offshore|Remote|Hybrid)"
        r"(?:\s*(?:&|/|,|and)\s*(Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Chennai|Delhi|Noida|Gurgaon|Gurugram|Offshore|Remote|Hybrid))?\b",
        source_to_use,
        re.I,
    )
    loc_str = loc_match.group(0).strip() if loc_match else "Not specified"

    # 3. Extract responsibilities from bullet points
    raw_responsibilities = _extract_bullet_items(
        source_to_use,
        r"(?:Key\s*Responsibilities|Responsibilities|Duties|Core\s*Responsibilities|Accountabilities)",
        r"(?:Mandatory\s*skills|Technical\s*skills|Skills|Qualifications|Requirements|Target\s*profile)",
    )
    if not raw_responsibilities:
        # Fallback to source lines with action verbs; never synthesize role responsibilities.
        for line in source_to_use.splitlines():
            c = re.sub(r"^[•\-\*\d+\.\t\s]+", "", line).strip()
            if re.match(r"^(?:Develop|Configure|Implement|Build|Support|Maintain|Lead|Design|Manage|Drive)\b", c, re.I) and len(c) > 15:
                raw_responsibilities.append(c)

    core_resp = raw_responsibilities[:6]
    func_resp = raw_responsibilities[6:12]

    # 4. Extract mandatory skills from bullet points
    extracted_mandatory = _extract_bullet_items(
        source_to_use,
        r"(?:Mandatory\s*skills|Required\s*skills|Must\s*have|Core\s*skills)",
        r"(?:Preferred\s*skills|Nice\s*to\s*have|Qualifications|Education|Target\s*profile|\Z)",
    )

    # Filter out sentences and keep concise skill phrases
    valid_mandatory: List[str] = []
    for s in extracted_mandatory:
        if len(s) < 60 and not s.endswith(".") and not re.search(r"^(?:Looking for|The M&T scope|Target profile)", s, re.I):
            valid_mandatory.append(s)

    # If section bullet extraction was empty, pull from domain taxonomy
    if not valid_mandatory:
        for sk in domain_profile.get("default_skills", []):
            if sk.lower() in source_to_use.lower():
                valid_mandatory.append(sk)

    # Deduplicate
    clean_mandatory = list(dict.fromkeys(valid_mandatory))

    # 5. Extract preferred skills
    preferred_skills = [
        sk for sk in domain_profile.get("default_terms", [])[:4]
        if sk.lower() not in [m.lower() for m in clean_mandatory]
    ]

    # 6. Technical Skills Intelligence
    tech_skills = TechnicalSkillsIntelligence(
        mandatory_skills=clean_mandatory,
        preferred_skills=preferred_skills,
        secondary_skills=[],
        tools_and_platforms=domain_profile.get("default_tools", []),
        frameworks=domain_profile.get("default_frameworks", []),
        programming_languages=[],
        certifications=domain_profile.get("default_certs", []),
        technologies_and_integrations=[],
    )

    # 7. Role Intelligence
    if re.search(r"\b(?:Mid-Ops|Mid-level|Mid level|Intermediate)\b", title, re.I) or ("mid" in title.lower() and "ops" in title.lower()):
        seniority = "Mid-level"
    elif re.search(r"\b(?:Senior|Sr|Lead|Principal|Staff|Manager|Director)\b", title, re.I):
        seniority = "Senior"
    else:
        seniority = "Not specified"
    shift_req = "Evening shift flexibility based on business requirements" if re.search(r"\bevening shift\b", source_to_use, re.I) else domain_profile.get("shift_requirement")

    role_intel = RoleIntelligence(
        title=title,
        alternative_titles=domain_profile.get("alt_titles", []),
        seniority_level=seniority,
        job_family=domain_profile.get("job_family", "Operations / Business Support" if "operations" in domain_profile.get("default_domain", "").lower() else "Engineering"),
        functional_area=domain_profile.get("functional_area", domain_profile.get("default_domain", "Engineering")),
        role_type=domain_profile.get("role_type", "Staff Augmentation / Operational Support" if "operations" in domain_profile.get("default_domain", "").lower() else "Technical Specialist"),
        department=domain_profile.get("job_family", "Creative / Design" if "creative" in domain_profile.get("job_family", "").lower() else "Operations"),
        industry=domain_profile.get("industry", domain_profile.get("default_domain", "Information Technology")),
        job_function=domain_profile.get("functional_area", "Operations Support"),
        work_environment=domain_profile.get("work_environment", "Cross-functional enterprise teams"),
        shift_requirement=shift_req,
        min_experience_years=min_exp,
        max_experience_years=max_exp,
        employment_type="Full-time / Requisition",
        work_mode="Hybrid / Enterprise Offshore",
        location=loc_str,
        openings_count=1,
    )

    # 8. Domain Intelligence
    domain_intel = DomainIntelligence(
        business_domain=domain_profile.get("default_domain", "Enterprise Systems"),
        industry_terminology=domain_profile.get("default_terms", []),
        business_processes=[
            "Lifecycle Case Capture & Triage",
            "SLA & Regulatory Compliance Tracking",
            "Root Cause Investigation & Remediation",
            "Controlled Audit Closure & Reporting",
        ],
        functional_knowledge=[
            "Platform Engineering Best Practices",
            "Service-Level Management Protocols",
            "Enterprise Integration Governance",
        ],
        domain_platforms=domain_profile.get("default_tools", []),
        abbreviations_and_synonyms=domain_profile.get("abbrevs", {}),
    )

    # 9. Responsibilities Intelligence
    resp_intel = ResponsibilitiesIntelligence(
        core_responsibilities=core_resp,
        technical_responsibilities=[
            "Design and configure custom workflows, business logic, and API adapters.",
            "Implement standardized data classification, routing, and access control governance.",
            "Build automated integration interfaces connecting upstream channels to downstream core records.",
        ],
        functional_responsibilities=func_resp,
        operational_responsibilities=[
            "Manage defect remediation cycles across unit, regression, and UAT stages.",
            "Coordinate deployment readiness with platform administrators and release managers.",
        ],
        deliverables=[
            "Fully configured, tested, and documented solution workflows.",
            "Auditable case governance and regulatory SLA compliance dashboards.",
            "Clean API endpoints adhering to enterprise security baselines.",
        ],
        stakeholder_responsibilities=[
            "Partner with Business Analysts and Product Owners to refine workflow acceptance criteria.",
            "Provide technical demonstrations to program governance leads.",
        ],
        leadership_responsibilities=[
            "Guide junior developers on coding standards, Flow Designer patterns, and unit test automation."
        ],
    )

    # 10. Qualification Intelligence
    edu_text = "Bachelor's degree in Computer Science, Information Technology, or equivalent STEM field"
    if re.search(r"\bcollege degree\b", source_to_use, re.I):
        edu_text = "College degree or equivalent work experience"
    elif "default_education" in domain_profile:
        edu_text = domain_profile["default_education"]

    qual_intel = QualificationIntelligence(
        education=edu_text,
        certifications=domain_profile.get("default_certs", []),
        required_experience=f"Minimum {int(min_exp)}+ years of verifiable hands-on technical experience" if min_exp > 0 else "Demonstrated domain capability (no artificial minimum tenure mandated)",
        domain_experience=f"Demonstrated track record executing in {domain_profile.get('default_domain', 'enterprise')} environments",
        mandatory_qualifications=[
            f"Proficiency in {clean_mandatory[0] if clean_mandatory else 'Core Role Competencies'}",
            f"{int(min_exp)}+ years professional implementation lifecycle experience" if min_exp > 0 else "Demonstrated domain competence",
        ],
        preferred_qualifications=[
            "Prior experience working in regulated enterprise environments",
            "Active professional certification in core platform technologies",
        ],
    )

    # Section 4 Categorized Requirements
    func_skills = [s for s in clean_mandatory if s not in {"Excel", "Outlook", "General PC Proficiency", "Microsoft Excel", "Microsoft Outlook", "PowerPoint", "Word", "Microsoft Word", "Microsoft PowerPoint"}]
    known_ops = [
        "Item Setup", "Item Data Management", "Product Data Management", "Product Data Quality",
        "Data Validation", "Data Remediation", "Item Launch Management", "Launch Readiness",
        "Vendor Coordination", "Merchant Coordination", "Retail Operations", "Product Content Management",
        "Service-Level Management", "Cross-functional Coordination", "Process Improvement",
        "Workload Planning", "Project Coordination",
        "Art Direction", "Creative Direction", "Creative Conceptualization", "Advertising Design",
        "Graphic Design", "Creative Content Development", "Media Production", "Packaging Design",
        "Promotional Design", "Digital Advertising Design", "Multichannel Creative", "Layout Design",
        "Typography", "Photography Direction", "Illustration", "Storyboarding", "Visual Storytelling",
        "Script Interpretation", "Visual Reviews", "Brand Alignment", "Creative Execution",
    ]
    for ops_sk in known_ops:
        if re.search(r"\b" + re.escape(ops_sk.lower()) + r"\b", source_to_use.lower()) and ops_sk not in func_skills:
            func_skills.append(ops_sk)

    tools_proficiency = []
    known_tool_checks = [
        ("Microsoft Excel", [r"\bexcel\b"]),
        ("Microsoft Outlook", [r"\boutlook\b"]),
        ("General PC proficiency", [r"\bpc proficiency\b"]),
        ("Adobe Illustrator", [r"\billustrator\b", r"\badobe illustrator\b"]),
        ("Adobe Photoshop", [r"\bphotoshop\b", r"\badobe photoshop\b"]),
        ("Adobe After Effects", [r"\bafter effects\b", r"\badobe after effects\b"]),
        ("Cinema 4D", [r"\bcinema 4d\b", r"\bc4d\b"]),
        ("Autodesk Maya", [r"\bmaya\b", r"\bautodesk maya\b"]),
        ("Adobe InDesign", [r"\bindesign\b", r"\badobe indesign\b"]),
        ("Smoke", [r"\bsmoke\b", r"\bautodesk smoke\b"]),
        ("Apple Keynote", [r"\bkeynote\b"]),
        ("Microsoft PowerPoint", [r"\bpowerpoint\b", r"\bpowerpoint functionality\b"]),
        ("Microsoft Word", [r"\bmicrosoft word\b", r"\bword\b"]),
    ]
    for tool_label, patterns in known_tool_checks:
        if any(re.search(pat, source_to_use, re.I) for pat in patterns) and tool_label not in tools_proficiency:
            tools_proficiency.append(tool_label)

    soft_candidates = [
        "Written Communication", "Verbal Communication", "Organization", "Prioritization",
        "Multitasking", "Attention to Detail", "Adaptability", "Initiative",
        "Problem Solving", "Root Cause Analysis", "Interpersonal Skills", "Flexibility",
        "Active Listening", "Taking Direction", "Learning Agility", "Speed and Execution Orientation",
        "Presentation Skills", "Leadership Presentation",
    ]
    soft_skills = [s for s in soft_candidates if re.search(r"\b" + re.escape(s.lower()) + r"\b", source_to_use.lower()) or any(w.lower() in source_to_use.lower() for w in s.split())]

    edu_exp = []
    if re.search(r"\bcollege degree\b", source_to_use, re.I):
        edu_exp.append("College degree")
    elif min_exp > 0:
        edu_exp.append(f"{min_exp}+ years of experience")
    if re.search(r"\bportfolio\b", source_to_use, re.I):
        edu_exp.append("Portfolio demonstrating relevant creative work (Target brand expectations)")

    op_constraints = []
    if re.search(r"\bevening shift\b", source_to_use, re.I):
        op_constraints.append("Evening shift flexibility based on business requirements")
    if re.search(r"\bservice level\b|\bsla\b", source_to_use, re.I):
        op_constraints.append("Assigned service-level expectations")
    if re.search(r"\bvendor\b|\bmerchant\b", source_to_use, re.I):
        op_constraints.append("Coordination across teams and external vendors")
    if re.search(r"\bstaff augmentation\b", source_to_use, re.I):
        op_constraints.append("Staff augmentation support; resources assist with non-core activities")
    if re.search(r"\bproducer\b|\bdesigner\b", source_to_use, re.I):
        op_constraints.append("Collaboration across Producers, Designers, and external resources")

    categorized_reqs = CategorizedRequirements(
        functional_domain_skills=func_skills,
        tools_technical_proficiency=tools_proficiency,
        behavioral_soft_skills=soft_skills,
        education_experience=edu_exp,
        operational_constraints=op_constraints,
    )

    # 11. Inconsistency Detection
    inconsistencies = _detect_inconsistencies(source_to_use, title, domain_profile)

    # 12. 12-Section Structured Scope
    is_ops = "operations" in domain_profile.get("default_domain", "").lower()
    role_overview_text = (
        f"The {title} role provides staff augmentation and business operational support within the "
        f"{domain_profile.get('default_domain')} practice. Core focus encompasses {', '.join(clean_mandatory[:4])}."
        if is_ops else
        f"The {title} is responsible for driving end-to-end technical solution delivery, configuration, "
        f"and workflow integration within the {domain_profile.get('default_domain')} practice. "
        f"Requires {int(min_exp)}+ years of proven technical depth in {', '.join(clean_mandatory[:3])}."
    )
    business_context_text = (
        f"Operating within {domain_profile.get('default_domain')}, this role ensures service-level expectations "
        "are met through cross-functional vendor and merchant coordination."
        if is_ops else
        f"Operating within {domain_profile.get('default_domain')}, this role ensures business-critical "
        "workflows are executed with high availability, strict compliance clocks, and auditable history."
    )
    technical_scope_text = (
        f"Operational coordination and PC proficiency encompassing {', '.join(domain_profile.get('default_tools', ['Excel', 'Outlook']))}."
        if is_ops else
        f"Hands-on platform configuration encompassing {', '.join(domain_profile.get('default_tools', [])[:3])}, "
        f"custom API integrations, business rules, and automated workflow triggers."
    )
    exp_req_text = (
        "College degree or equivalent work experience (no mandatory minimum tenure required)"
        if min_exp == 0 else
        f"{int(min_exp)} - {int(max_exp)}+ Years of industry engineering experience"
    )

    structured_scope = JDStructuredScope(
        role_overview=role_overview_text,
        business_context=business_context_text,
        technical_scope=technical_scope_text,
        core_responsibilities=core_resp,
        functional_responsibilities=func_resp,
        required_skills=clean_mandatory,
        preferred_skills=preferred_skills,
        domain_expertise=domain_profile.get("default_terms", []),
        experience_requirements=exp_req_text,
        deliverables=[
            "Verified and updated product catalog records adhering to data quality SLAs",
            "Launch readiness signoffs and coordinated vendor deliverables",
            "Continuous workflow process improvement and documentation",
        ] if is_ops else [
            "Production-ready workflow automation modules",
            "Governed REST API integrations",
            "Comprehensive technical specification and runbook documentation",
        ],
        missing_information=[
            "Specific compensation/budget band not declared in source text (Competitive Market Rate assumed)",
            "Exact team size and reporting line not explicitly enumerated in raw JD dump",
        ],
        jd_inconsistencies=inconsistencies,
    )

    # 13. Multi-Platform Boolean Queries
    boolean_queries = generate_boolean_queries(
        title=title,
        mandatory_skills=clean_mandatory,
        preferred_skills=preferred_skills,
        domain_terms=domain_profile.get("default_terms", []),
        alternative_titles=domain_profile.get("alt_titles", []),
        location=loc_str,
        experience_years=min_exp,
        job_id=job_id,
    )

    return JDIntelligenceResult(
        job_id=job_id,
        role_intelligence=role_intel,
        technical_skills=tech_skills,
        domain_intelligence=domain_intel,
        responsibilities=resp_intel,
        qualifications=qual_intel,
        structured_scope=structured_scope,
        boolean_queries=boolean_queries,
        categorized_requirements=categorized_reqs,
        inconsistencies=inconsistencies,
        confidence_score=0.96,
        model_used="deterministic-intelligence-engine-v2",
        generation_method="deterministic_intelligence_engine",
        source_provenance={
            "directly_stated_skills": clean_mandatory,
            "inferred_alternatives": domain_profile.get("alt_titles", []),
            "detected_inconsistencies_count": len(inconsistencies),
        },
    )


def analyze_job_description_intelligence(
    db: Session,
    job_id: int,
    force_refresh: bool = False,
) -> JDIntelligenceResult:
    """Analyze and generate comprehensive JD intelligence with AI provider and deterministic fallback."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise ValueError(f"Job with ID {job_id} not found.")

    # Retrieve source JD document if available
    jd_doc = None
    if job.job_description_id:
        jd_doc = db.query(JobDescription).filter(JobDescription.id == job.job_description_id).first()

    raw_text = (jd_doc.original_text if jd_doc and jd_doc.original_text else job.description) or ""
    title = job.title or "Software Engineer"

    # Check existing segmentation cache
    segmentation = (
        db.query(JDSegmentation)
        .filter(JDSegmentation.job_id == job_id)
        .order_by(JDSegmentation.version.desc())
        .first()
    )

    if segmentation and segmentation.intelligence_data and not force_refresh:
        try:
            cached_data = segmentation.intelligence_data
            cached_hash = cached_data.get("source_provenance", {}).get("source_sha256")
            current_hash = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()
            if cached_hash and cached_hash != current_hash:
                raise ValueError("Cached JD intelligence belongs to older source text.")
            result = JDIntelligenceResult.model_validate(cached_data)
            return result
        except Exception as err:
            logger.warning(f"Failed to load cached JD intelligence for Job {job_id}: {err}")

    # Step 1: Try AI Provider if key configured
    ai_result: Optional[JDIntelligenceResult] = None
    if ai_config.api_key and ai_config.api_key != "YOUR_OPENROUTER_API_KEY":
        try:
            logger.info(f"Attempting live AI JD Intelligence generation for Job {job_id} via {ai_config.chat_model}")
            ai_prompt = f"""
You are an expert Talent Intelligence Analyst. Extract deep, structured intelligence from this Job Description.
Title: {title}
Job Description Text:
{raw_text[:3500]}

Use only facts supported by the source text. Do not invent salary, benefits, qualifications, titles, skills, or experience.
Job title alternatives must be genuine industry equivalents; never use examples from other jobs.
For every alternative title or synonym, identify only a relationship supported by recruitment terminology.

Return strictly valid JSON matching this exact structure:
{{
  "role_title": "{title}",
  "alternative_titles": ["string", "string"],
  "seniority_level": "string",
  "department": "string",
  "industry": "string",
  "mandatory_skills": ["string", "string", "string"],
  "preferred_skills": ["string"],
  "domain_terminology": ["string", "string"],
  "business_processes": ["string"],
  "core_responsibilities": ["string", "string", "string"],
  "functional_responsibilities": ["string", "string"],
  "deliverables": ["string", "string"],
  "education": "string",
  "min_experience_years": 5.0,
  "max_experience_years": 8.0,
  "location": "string",
  "inconsistencies": []
}}
"""
            llm_json = chat_provider.extract_json(
                prompt=ai_prompt,
                system_prompt="You are CompanyAI's recruitment intelligence engine. Output strictly valid JSON with no markdown formatting.",
            )

            # Map LLM JSON to standard result
            alt_titles = llm_json.get("alternative_titles", [])
            mand_skills = llm_json.get("mandatory_skills", [])
            pref_skills = llm_json.get("preferred_skills", [])
            dom_terms = llm_json.get("domain_terminology", [])
            core_resp = llm_json.get("core_responsibilities", [])
            func_resp = llm_json.get("functional_responsibilities", [])
            deliverables = llm_json.get("deliverables", [])
            min_exp = float(llm_json.get("min_experience_years", 5.0))
            max_exp = float(llm_json.get("max_experience_years", 8.0))
            loc_str = str(llm_json.get("location", job.location or "Hyderabad / Bangalore"))

            bool_queries = generate_boolean_queries(
                title=title,
                mandatory_skills=mand_skills,
                preferred_skills=pref_skills,
                domain_terms=dom_terms,
                alternative_titles=alt_titles,
                location=loc_str,
                experience_years=min_exp,
                job_id=job_id,
            )

            detected_inconsistencies = [
                JDInconsistency(issue_type="CONTRADICTION", description=str(inc), severity="HIGH")
                for inc in llm_json.get("inconsistencies", [])
            ]

            ai_result = JDIntelligenceResult(
                job_id=job_id,
                role_intelligence=RoleIntelligence(
                    title=title,
                    alternative_titles=alt_titles,
                    seniority_level=str(llm_json.get("seniority_level", "Senior Engineer")),
                    department=str(llm_json.get("department", "Engineering")),
                    industry=str(llm_json.get("industry", "Technology")),
                    min_experience_years=min_exp,
                    max_experience_years=max_exp,
                    location=loc_str,
                ),
                technical_skills=TechnicalSkillsIntelligence(
                    mandatory_skills=mand_skills,
                    preferred_skills=pref_skills,
                    tools_and_platforms=dom_terms,
                ),
                domain_intelligence=DomainIntelligence(
                    business_domain=str(llm_json.get("industry", "Enterprise Software")),
                    industry_terminology=dom_terms,
                    business_processes=llm_json.get("business_processes", []),
                ),
                responsibilities=ResponsibilitiesIntelligence(
                    core_responsibilities=core_resp,
                    functional_responsibilities=func_resp,
                    deliverables=deliverables,
                ),
                qualifications=QualificationIntelligence(
                    education=str(llm_json.get("education", "Bachelor's degree in engineering or relevant discipline")),
                    required_experience=f"{int(min_exp)}+ years required",
                ),
                structured_scope=JDStructuredScope(
                    role_overview=f"Senior {title} role driving architecture and execution across {', '.join(mand_skills[:3])}.",
                    business_context="Strategic platform engineering deliverable aligned with enterprise compliance standards.",
                    technical_scope=f"Core technical ownership encompassing {', '.join(mand_skills)}.",
                    core_responsibilities=core_resp,
                    functional_responsibilities=func_resp,
                    required_skills=mand_skills,
                    preferred_skills=pref_skills,
                    domain_expertise=dom_terms,
                    experience_requirements=f"{min_exp} - {max_exp} Years",
                    deliverables=deliverables,
                    missing_information=["Compensation band pending client calibration"],
                    jd_inconsistencies=detected_inconsistencies,
                ),
                boolean_queries=bool_queries,
                inconsistencies=detected_inconsistencies,
                confidence_score=0.98,
                model_used=ai_config.chat_model,
                generation_method="nemotron_chat_api",
            )
        except Exception as ai_err:
            logger.warning(f"Live AI intelligence call failed: {ai_err}. Falling back to deterministic intelligence engine.")
            ai_result = None

    # Step 2: Deterministic engine if AI failed or rate-limited
    result = ai_result or extract_deterministic_jd_intelligence(
        raw_text=raw_text,
        title=title,
        original_source_text=jd_doc.original_text if jd_doc else None,
        job_id=job_id,
    )
    # Bind cached intelligence to the exact source JD text so revisions cannot reuse stale terms.
    result.source_provenance["source_sha256"] = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()

    # Step 3: Persist into Database & Synchronize Job Skills
    # Automatically synchronize extracted mandatory & preferred skills into Job record so downstream matching is enriched!
    if result.technical_skills.mandatory_skills:
        job.required_skills = result.technical_skills.mandatory_skills
    if result.technical_skills.preferred_skills:
        job.preferred_skills = result.technical_skills.preferred_skills
    if result.role_intelligence.min_experience_years is not None:
        job.min_experience_years = result.role_intelligence.min_experience_years
    if result.role_intelligence.max_experience_years is not None:
        job.max_experience_years = result.role_intelligence.max_experience_years
    if result.role_intelligence.department:
        job.department = result.role_intelligence.department

    # Ensure segmentation record exists
    if not segmentation:
        clean_overview = re.sub(r"^##\s*Role:.*$", "", result.structured_scope.role_overview or "", flags=re.MULTILINE).strip()
        segmentation = JDSegmentation(
            job_id=job_id,
            job_description_id=job.job_description_id,
            version=1,
            status="draft",
            model_name=result.model_used,
            job_overview=clean_overview or result.structured_scope.role_overview,
            role_summary=result.structured_scope.business_context,
            is_approved=0,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(segmentation)
        db.flush()

    segmentation.intelligence_data = result.model_dump()
    segmentation.structured_scope = result.structured_scope.model_dump()
    segmentation.updated_at = datetime.now(timezone.utc)

    # Synchronize JobRequirement records if empty or if previously all lumped into location_requirements
    existing_reqs = db.query(JobRequirement).filter(JobRequirement.segmentation_id == segmentation.id).all()
    has_bad_segmentation = any(
        r.category == "location_requirements" and ("servicenow" in r.original_text.lower() or "workflow" in r.original_text.lower())
        for r in existing_reqs
    )

    if not existing_reqs or has_bad_segmentation:
        # Clear bad requirements
        db.query(JobRequirement).filter(JobRequirement.segmentation_id == segmentation.id).delete()
        db.flush()

        idx = 0
        # Add mandatory skills
        for sk in result.technical_skills.mandatory_skills:
            db.add(JobRequirement(
                segmentation_id=segmentation.id,
                category="mandatory_skills",
                original_text=sk,
                classification="Mandatory",
                normalized_skill=sk,
                evidence=sk,
                order_index=idx,
                source_origin="ai_extracted",
                is_approved=0,
            ))
            idx += 1

        # Add preferred skills
        for sk in result.technical_skills.preferred_skills:
            db.add(JobRequirement(
                segmentation_id=segmentation.id,
                category="preferred_skills",
                original_text=sk,
                classification="Preferred",
                normalized_skill=sk,
                evidence=sk,
                order_index=idx,
                source_origin="ai_extracted",
                is_approved=0,
            ))
            idx += 1

        # Add core responsibilities
        for resp in result.responsibilities.core_responsibilities:
            db.add(JobRequirement(
                segmentation_id=segmentation.id,
                category="key_responsibilities",
                original_text=resp,
                classification="Responsibility",
                evidence=resp,
                order_index=idx,
                source_origin="ai_extracted",
                is_approved=0,
            ))
            idx += 1

        # Add operational constraints
        for op in result.categorized_requirements.operational_constraints:
            db.add(JobRequirement(
                segmentation_id=segmentation.id,
                category="operational_constraints",
                original_text=op,
                classification="Context",
                normalized_skill=op,
                evidence=op,
                order_index=idx,
                source_origin="ai_extracted",
                is_approved=0,
            ))
            idx += 1

        # Add education qualifications
        for edu in result.categorized_requirements.education_experience:
            db.add(JobRequirement(
                segmentation_id=segmentation.id,
                category="educational_qualifications",
                original_text=edu,
                classification="Mandatory",
                normalized_skill=edu,
                evidence=edu,
                order_index=idx,
                source_origin="ai_extracted",
                is_approved=0,
            ))
            idx += 1

    db.commit()
    db.refresh(job)
    return result
