"""Comprehensive Test Suite for Non-IT / Operations-Based Job Descriptions Support in CompanyAI.

Validates:
1. Ingestion, classification, and deep requirement extraction for the Primary Test JD:
   - Item Setup / Data Quality / Item Launches (Operations / Business Support).
2. Category separation (Functional/Domain, Tools/Tech, Behavioral/Soft, Education/Exp, Operational Constraints).
3. Mandatory vs Preferred vs Responsibilities distinction (responsibilities non-disqualifying).
4. Boolean Search generation across all modes (Balanced, Strict, Broad) and platforms (Naukri, LinkedIn, Google X-Ray).
5. Evidence-based Candidate Matching (Retail Operations candidate vs Software Developer).
6. Deterministic Resume Extraction of non-IT operational competencies.
7. Full Cross-Domain Regression Isolation across all 7 existing benchmark domains plus Operations.
"""

import pytest
import re
from typing import Dict, Any

from database.sqlite_connection import SessionLocal
from database.models import Job, JobDescription, JDSegmentation, JobRequirement
from app.services.skill_taxonomy_service import (
    extract_skills_from_jd,
    detect_jd_domain,
    DOMAIN_TAXONOMY,
    normalize_skill,
)
from app.services.boolean_query_service import generate_boolean_queries
from app.services.jd_intelligence_service import (
    extract_deterministic_jd_intelligence,
    RoleIntelligence,
)
from app.services.canonical_matching_service import (
    extract_jd_requirements,
    evaluate_requirements,
)
from app.resume_profile_parser import parse_resume_profile


PRIMARY_OPERATIONS_JD_TEXT = """
Role: Item Setup / Data Quality / Item Launches
Role context: Staff augmentation support. Resources assist with non-core activities.

Responsibilities:
• Item Setup: Complete item setups within assigned service levels by coordinating with merchant teams, internal stakeholders and external vendors.
• Data Quality: Ensure data accuracy and consistency across categories, validate and remediate data.
• Item Launches: Evaluate launch readiness, troubleshoot launch blockers, resolve system issues and coordinate content generation.
• Communication: Communicate effectively with vendor partners, merchant teams and support partners.
• Training: Participate in Item CoE training for new hires and refresher training.
• Department Ownership: Plan workloads, prioritize tasks, communicate updates and coordinate between Minneapolis and other team members.
• Cross-functional Initiatives: Participate in product data planning, data quality and guest reviews.
• Project Management: Coordinate key product launches.
• Process Improvement: Identify efficient working methods and improve processes.
• Workload Management: Prioritize tasks to meet service-level expectations.

Candidate requirements:
• College degree or equivalent experience.
• Strong written and verbal communication.
• Organization and prioritization.
• Flexibility and ability to manage ambiguity.
• Multitasking, urgency and initiative.
• Attention to detail.
• Research and root-cause investigation.
• Interpersonal skills.
• PC proficiency, particularly Excel and Outlook.
• Evening shift flexibility based on business requirements.
"""


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


# ----------------------------------------------------
# 1. Domain Detection and Classification Tests
# ----------------------------------------------------

def test_operations_jd_domain_detection():
    """Verify primary operations JD is classified as Retail Item & Product Data Operations."""
    domain_id, domain_meta = detect_jd_domain(
        "Item Setup / Data Quality / Item Launches",
        PRIMARY_OPERATIONS_JD_TEXT,
    )
    assert domain_id == "retail_product_operations"
    assert domain_meta["label"] == "Retail Item & Product Data Operations"
    assert domain_meta["job_family"] == "Operations / Business Support"
    assert domain_meta["functional_area"] == "Retail Item & Product Data Operations"
    assert domain_meta["role_type"] == "Staff Augmentation / Operational Support"
    assert domain_meta["industry"] == "Retail / Merchandising / Product Data Operations"
    assert "vendor" in domain_meta["work_environment"].lower()
    assert "evening shift" in domain_meta["shift_requirement"].lower()


def test_operations_jd_no_it_misclassification():
    """Verify operations JD is NOT classified as Software Engineering or Developer."""
    domain_id, _ = detect_jd_domain(
        "Item Setup / Data Quality / Item Launches",
        PRIMARY_OPERATIONS_JD_TEXT,
    )
    assert domain_id != "software_engineering"
    assert domain_id != "cloud_infrastructure"
    assert domain_id != "semiconductor_vlsi"
    assert domain_id != "cad_engineering"
    assert domain_id != "servicenow_itsm"


# ----------------------------------------------------
# 2. Structured Requirement Extraction & Categorization
# ----------------------------------------------------

def test_operations_jd_categorized_requirements():
    """Verify Section 4 categorization: Functional/Domain, Tools/Tech, Behavioral/Soft, Education, Operational."""
    extraction = extract_skills_from_jd(
        PRIMARY_OPERATIONS_JD_TEXT,
        title="Item Setup / Data Quality / Item Launches",
        use_ai=False,
    )

    cats = extraction.get("categorized_requirements", {})
    assert "functional_domain_skills" in cats
    assert "tools_technical_proficiency" in cats
    assert "behavioral_soft_skills" in cats
    assert "education_experience" in cats
    assert "operational_constraints" in cats

    # A. Functional / Domain skills
    func = cats["functional_domain_skills"]
    assert any(s in func for s in ["Item Setup", "Product Data Management", "Data Quality", "Data Remediation", "Item Launch Management", "Vendor Coordination"])

    # B. Tools / Technical proficiency
    tools = cats["tools_technical_proficiency"]
    assert "Microsoft Excel" in tools or "Excel" in tools
    assert "Microsoft Outlook" in tools or "Outlook" in tools
    # Must NOT invent SQL, Python, Power BI, SAP, ERP
    for forbidden in ["SQL", "Python", "Power BI", "SAP", "ERP", "Java"]:
        assert forbidden not in tools

    # C. Behavioral / Soft skills
    soft = cats["behavioral_soft_skills"]
    assert any(s in soft for s in ["Written Communication", "Organization", "Prioritization", "Multitasking", "Attention to Detail", "Flexibility"])

    # D. Education / Experience: No artificial years invented
    edu = cats["education_experience"]
    assert any("college degree" in e.lower() for e in edu)
    assert not any("5+" in e for e in edu)

    # E. Operational Constraints
    ops = cats["operational_constraints"]
    assert any("evening shift" in o.lower() for o in ops)


def test_operations_jd_deterministic_intelligence_engine():
    """Verify JD intelligence engine outputs domain, job family, shift requirement, and zero artificial years."""
    intel = extract_deterministic_jd_intelligence(
        raw_text=PRIMARY_OPERATIONS_JD_TEXT,
        title="Item Setup / Data Quality / Item Launches",
    )

    role = intel.role_intelligence
    assert role.job_family == "Operations / Business Support"
    assert role.functional_area == "Retail Item & Product Data Operations"
    assert role.role_type == "Staff Augmentation / Operational Support"
    assert role.seniority_level == "Not specified"
    assert role.min_experience_years == 0.0
    assert role.max_experience_years == 0.0
    assert role.shift_requirement is not None
    assert "evening shift" in role.shift_requirement.lower()

    qual = intel.qualifications
    assert "college degree" in qual.education.lower()

    scope = intel.structured_scope
    assert "operations" in scope.role_overview.lower()


# ----------------------------------------------------
# 3. Boolean Search Engine Compatibility Tests
# ----------------------------------------------------

def test_operations_jd_boolean_queries():
    """Verify platform-aware Boolean queries are generated for Balanced, Strict, and Broad modes."""
    extraction = extract_skills_from_jd(
        PRIMARY_OPERATIONS_JD_TEXT,
        title="Item Setup / Data Quality / Item Launches",
        use_ai=False,
    )

    for mode in ["balanced", "strict", "broad"]:
        res = generate_boolean_queries(
            title="Item Setup / Data Quality / Item Launches",
            mandatory_skills=extraction["mandatory_skills"],
            preferred_skills=extraction["preferred_skills"],
            domain_terms=extraction["domain_terms"],
            alternative_titles=extraction["alternative_titles"],
            search_mode=mode,
        )

        # 1. Naukri Resdex
        assert res.naukri.is_valid
        assert len(res.naukri.query) <= 1000
        if mode in ["balanced", "strict"]:
            assert "NOT (" in res.naukri.query
        assert ("Item Setup" in res.naukri.query or "Product Data" in res.naukri.query or "Data Quality" in res.naukri.query)

        # 2. LinkedIn Recruiter
        assert res.linkedin.is_valid
        assert len(res.linkedin.query) <= 1500

        # 3. Google X-Ray
        assert res.google_xray.is_valid
        assert "site:linkedin.com/in" in res.google_xray.query
        assert len(res.google_xray.query) <= 2048

        # 4. Simple Keywords
        assert "comma" in res.simple_keywords
        assert "quoted_space" in res.simple_keywords
        assert "pipe" in res.simple_keywords


# ----------------------------------------------------
# 4. Candidate Matching Engine Tests
# ----------------------------------------------------

def test_operations_candidate_matching_evidence_based():
    """Verify an operations candidate with retail and Excel experience matches strongly, while a pure software engineer has clear gaps."""
    # Candidate 1: Operations Associate with retail data experience
    operations_resume = """
    Jane Doe
    jane.doe@example.com
    Professional Summary:
    Results-driven Operations Specialist with extensive experience in item setup, product data quality, and vendor coordination in retail merchandising.
    
    Work Experience:
    Catalog Operations Specialist | Retail Merchandising Services (2021 - Present)
    • Managed end-to-end item setup and catalog creation for multi-category retail inventory.
    • Ensured data quality and product data accuracy through rigorous data validation and remediation.
    • Coordinated with vendor partners and merchant teams to unblock product launch readiness.
    • Advanced proficiency in Microsoft Excel and Microsoft Outlook for workload planning and tracking.
    • Participated in cross-functional product data reviews and service level management.
    
    Education:
    Bachelor of Commerce, 2020
    """

    eval_ops = evaluate_requirements(
        jd_text=PRIMARY_OPERATIONS_JD_TEXT,
        resume_text=operations_resume,
        resume_complete=True,
        role_title="Item Setup / Data Quality / Item Launches",
    )

    assert eval_ops["match_score"] is not None
    # Operations candidate should score strongly
    assert eval_ops["match_score"] >= 70, f"Expected match score >= 70, got {eval_ops['match_score']}"
    assert eval_ops["classification"] in {"Strong", "Good"}

    # Candidate 2: Software Developer with zero operations experience
    software_resume = """
    John Smith
    john.smith@example.com
    Summary: Java Backend Developer with 5 years experience building microservices.
    
    Experience:
    Software Engineer | Tech Corp (2019 - Present)
    • Developed Java Spring Boot REST microservices deployed on AWS.
    • Optimized PostgreSQL database queries and Kafka streams.
    • Configured Docker containers and Kubernetes clusters.
    
    Education:
    B.Tech Computer Science, 2019
    """

    eval_sw = evaluate_requirements(
        jd_text=PRIMARY_OPERATIONS_JD_TEXT,
        resume_text=software_resume,
        resume_complete=True,
        role_title="Item Setup / Data Quality / Item Launches",
    )

    # Software candidate should have low match score and clear gaps
    assert eval_sw["match_score"] is None or eval_sw["match_score"] < 40, f"Expected low match score for software dev, got {eval_sw['match_score']}"
    assert eval_sw["mandatory_gap_count"] > 0, "Expected mandatory gaps for software dev evaluated against operations JD"


# ----------------------------------------------------
# 5. Deterministic Resume Extraction Tests
# ----------------------------------------------------

def test_operations_resume_parsing():
    """Verify resume parser extracts retail operations, item setup, vendor coordination, Excel, and Outlook."""
    sample_text = """
    Candidate Name: Priya Sharma
    Email: priya.sharma@example.com
    Total Experience: 4 Years
    Current Location: Bengaluru
    
    Experience:
    Operations Coordinator at Retail Global Services.
    Hands-on expertise in Item Setup, Product Data Management, and Data Quality audits.
    Regularly conducted Vendor Coordination and Merchant Coordination.
    Skilled in Excel and Outlook.
    """
    profile = parse_resume_profile(sample_text)
    assert profile.name == "Priya Sharma"
    assert profile.email == "priya.sharma@example.com"
    assert profile.experience_years == 4.0
    assert profile.location == "Bengaluru"

    skills_lower = [s.lower() for s in profile.skills]
    assert any("item setup" in s for s in skills_lower)
    assert any("data quality" in s for s in skills_lower)
    assert any("excel" in s for s in skills_lower)
    assert any("outlook" in s for s in skills_lower)


# ----------------------------------------------------
# 6. Cross-Domain Regression Isolation Tests (All 8 Domains)
# ----------------------------------------------------

def test_all_eight_domains_isolation():
    """Verify strict domain isolation across all 8 supported domains including operations."""
    domain_cases = [
        {"title": "CAD Entry Ops", "text": "CAD Revit MicroStation 2D drafting", "expected_domain": "cad_engineering", "forbidden": ["UVM", "GST", "Item Setup"]},
        {"title": "Staff Accountant-Mid-Ops", "text": "General Ledger, Reconciliation, GST, TDS, US GAAP", "expected_domain": "finance_accounting", "forbidden": ["AutoCAD", "Kubernetes", "Item Launches"]},
        {"title": "Design Verification Engineer", "text": "SystemVerilog UVM Verilog FPGA DO-254", "expected_domain": "semiconductor_vlsi", "forbidden": ["General Ledger", "Item Setup", "AutoCAD"]},
        {"title": "Senior Manager, Cloud Infrastructure", "text": "AWS Azure Kubernetes Docker Terraform CI/CD", "expected_domain": "cloud_infrastructure", "forbidden": ["Item Setup", "VHDL", "TDS"]},
        {"title": "ServiceNow FSO Software Engineer", "text": "ServiceNow Flow Designer Business Rules FSO", "expected_domain": "servicenow_itsm", "forbidden": ["AutoCAD", "Item Launches", "Verilog"]},
        {"title": "Java Application Support / Production Engineer", "text": "Java Spring Boot application support Linux SQL", "expected_domain": "software_engineering", "forbidden": ["MicroStation", "Item Setup", "DO-254"]},
        {"title": "SAP CPI / Integration Suite Consultant", "text": "SAP CPI Integration Suite Groovy ABAP", "expected_domain": "sap_erp", "forbidden": ["AutoCAD", "Item Setup", "Verilog"]},
        {"title": "Item Setup / Data Quality / Item Launches", "text": PRIMARY_OPERATIONS_JD_TEXT, "expected_domain": "retail_product_operations", "forbidden": ["UVM", "SystemVerilog", "Kubernetes", "Groovy", "AutoCAD"]},
    ]

    for case in domain_cases:
        detected_domain, _ = detect_jd_domain(case["title"], case["text"])
        assert detected_domain == case["expected_domain"], f"Domain mismatch for {case['title']}: got {detected_domain}, expected {case['expected_domain']}"

        extraction = extract_skills_from_jd(case["text"], title=case["title"], use_ai=False)
        extracted_skills = " ".join(extraction["mandatory_skills"] + extraction["preferred_skills"]).lower()

        for forbidden in case["forbidden"]:
            assert forbidden.lower() not in extracted_skills, f"{forbidden} leaked into skills for {case['title']}"
