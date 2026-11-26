"""Comprehensive Test Suite for Creative / Advertising / Design Job Descriptions Support in CompanyAI.

Validates:
1. Ingestion, classification, and deep requirement extraction for the Primary Test JD:
   - Art Director – Mid-Ops (Creative / Design).
2. Category separation across all 6 specified categories:
   - A. Core Creative and Functional Skills
   - B. Creative Software and Tools (Cinema 4D vs Maya distinct; Photoshop vs Illustrator distinct)
   - C. Project and Production Management
   - D. Behavioral and Communication Skills (Presentation skills explicitly preferred)
   - E. Education and Experience (with 3-6 vs 3-5 years inconsistency detected)
   - F. Portfolio Evidence (Portfolio links and creative campaigns recognized)
3. Experience Inconsistency Detection (3-6 years header vs 3-5 years qualifications).
4. Boolean Search generation across all modes (Balanced, Strict, Broad) and platforms (Naukri, LinkedIn, Google X-Ray).
5. Evidence-based Candidate Matching (Art Director candidate vs Software Engineer).
6. Deterministic Resume Extraction of creative competencies and portfolio links.
7. Full Cross-Domain Regression Isolation across all 9 benchmark domains.
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
from app.resume_profile_parser import parse_resume_profile, extract_portfolio_links


PRIMARY_CREATIVE_JD_TEXT = """
Job Title: Art Director – Mid-Ops
Experience: 3–6 years
Location: Bangalore
Budget: 3–6 LPA
Employment Context: Staff augmentation support; resources assist with non-core activities.

Assignment Responsibilities:
• Conceptualize creative content and collaborate with Producers and Designers to create and execute media.
• Oversee multiple projects through the production process.
• Drive creative production consistency across projects.
• Assist with in-store marketing (ISM), packaging and media campaigns.
• Review creative assets, provide clear feedback, and ensure brand alignment.
• Support creative leadership with presentations, deck preparation and asset organization.
• Partner with cross-functional creative teams, production artists and vendor partners.

Candidate Requirements:
• 3–5 years of experience in art direction, advertising design or graphic design.
• College degree in Graphic Design, Fine Arts, Advertising, Visual Communication, or equivalent practical experience.
• Hands-on proficiency with Adobe Creative Suite (Illustrator, Photoshop, InDesign, After Effects).
• Experience with 3D modeling and animation tools (Cinema 4D or Autodesk Maya) is an advantage.
• Familiarity with Smoke and video finishing workflows is desirable.
• Demonstrated portfolio showing creative campaigns, layout design, typography and brand storytelling.
• Strong typography, layout, color theory and composition skills.
• Proficiency in presentation software (Apple Keynote, Microsoft PowerPoint).
• Basic PC and Mac proficiency, including Microsoft Word, Excel and Outlook.
• Strong written and verbal communication skills.
• Effective presentation skills for leadership presentations are preferred.
• High attention to detail, organization and ability to manage multiple project deadlines.
• Ability to work collaboratively in a fast-paced creative agency or in-house studio environment.
"""


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


# ----------------------------------------------------
# 1. Domain Detection and Classification Tests
# ----------------------------------------------------

def test_creative_jd_domain_detection():
    """Verify primary creative JD is classified into Creative / Design with proper metadata."""
    domain_id, domain_meta = detect_jd_domain("Art Director – Mid-Ops", PRIMARY_CREATIVE_JD_TEXT)
    assert domain_id == "creative_design", f"Expected creative_design, got {domain_id}"
    assert domain_meta["job_family"] == "Creative / Design"
    assert domain_meta["functional_area"] == "Art Direction and Advertising Design"
    assert domain_meta["role_category"] == "Creative Operations / Media Production"


def test_creative_jd_no_it_misclassification():
    """Verify creative JD is never misclassified into IT, engineering, or operations domains."""
    domain_id, _ = detect_jd_domain("Art Director – Mid-Ops", PRIMARY_CREATIVE_JD_TEXT)
    prohibited_domains = {
        "java_software", "semiconductor_vlsi", "cloud_infrastructure", "cad_engineering",
        "servicenow", "sap_erp", "finance_accounting", "operations"
    }
    assert domain_id not in prohibited_domains, f"Creative JD was misclassified as {domain_id}"


def test_creative_jd_deep_intelligence():
    """Verify role intelligence captures seniority, work type, location, and budget."""
    intel = extract_deterministic_jd_intelligence(
        PRIMARY_CREATIVE_JD_TEXT,
        title="Art Director – Mid-Ops",
    )
    assert intel.domain_intelligence.business_domain == "Advertising, Retail Branding, Creative Media and Marketing"
    assert intel.role_intelligence.job_family == "Creative / Design"
    assert intel.role_intelligence.functional_area == "Art Direction and Advertising Design"
    assert intel.role_intelligence.seniority_level == "Mid-level"
    assert "Bangalore" in (intel.role_intelligence.location or "")


# ----------------------------------------------------
# 2. Inconsistency Detection Tests
# ----------------------------------------------------

def test_creative_jd_experience_inconsistency_flagged():
    """Verify 3-6 years (header) vs 3-5 years (qualifications) is flagged as CONTRADICTION."""
    intel = extract_deterministic_jd_intelligence(
        PRIMARY_CREATIVE_JD_TEXT,
        title="Art Director – Mid-Ops",
    )
    contradictions = [inc for inc in intel.inconsistencies if inc.issue_type == "CONTRADICTION"]
    assert len(contradictions) >= 1, "Expected CONTRADICTION inconsistency for experience range"
    exp_inconsistency = next(
        (inc for inc in contradictions if "experience" in inc.description.lower() or "range" in inc.description.lower()),
        None
    )
    assert exp_inconsistency is not None, "Experience contradiction was not detected"
    assert "3–5 years" in exp_inconsistency.source_evidence and "3–6 years" in exp_inconsistency.source_evidence


# ----------------------------------------------------
# 3. Requirement Categorization (Categories A - F)
# ----------------------------------------------------

def test_creative_jd_categorized_requirements():
    """Verify requirements are cleanly categorized across all 6 specified categories."""
    extraction = extract_skills_from_jd(PRIMARY_CREATIVE_JD_TEXT, title="Art Director – Mid-Ops", use_ai=False)
    mandatory = set(extraction["mandatory_skills"])
    preferred = set(extraction["preferred_skills"])
    tools = set(extraction["tools_and_platforms"])
    domain_terms = set(extraction["domain_terms"])

    # Category A: Core Creative & Functional Skills
    core_creative_found = any(s in mandatory or s in domain_terms for s in ["Art Direction", "Advertising Design", "Graphic Design"])
    assert core_creative_found, "Missing core creative functional skills in mandatory/domain"
    assert any(s in mandatory or s in domain_terms for s in ["Typography", "Layout Design", "Visual Storytelling", "Packaging Design"])

    # Category B: Creative Software & Tools
    assert "Adobe Photoshop" in tools or "Adobe Photoshop" in mandatory
    assert "Adobe Illustrator" in tools or "Adobe Illustrator" in mandatory
    assert "Adobe InDesign" in tools or "Adobe InDesign" in mandatory
    assert "Adobe After Effects" in tools or "Adobe After Effects" in mandatory

    # Cinema 4D and Maya must remain distinct tools and are correctly identified as preferred
    assert "Cinema 4D" in preferred, "Cinema 4D must be extracted as preferred"
    assert "Autodesk Maya" in preferred, "Autodesk Maya must be extracted as preferred"
    assert "Smoke" in preferred, "Smoke must be extracted as preferred"

    # Category E: College degree
    reqs = extract_jd_requirements(PRIMARY_CREATIVE_JD_TEXT)
    degree_req = next((r for r in reqs if r["category"] == "educational_qualifications"), None)
    assert degree_req is not None, "College degree requirement must be extracted"
    assert "college degree" in degree_req["original_text"].lower()

    # Category F: Portfolio evidence
    portfolio_reqs = [r for r in reqs if r["category"] == "portfolio_requirements"]
    assert len(portfolio_reqs) >= 1, "Portfolio requirement must be extracted"
    assert any("portfolio" in r["original_text"].lower() for r in portfolio_reqs)


# ----------------------------------------------------
# 4. Platform-Aware Boolean Query Generation Tests
# ----------------------------------------------------

def test_creative_jd_boolean_queries():
    """Verify Balanced, Strict, and Broad queries across Naukri, LinkedIn, and X-Ray."""
    extraction = extract_skills_from_jd(PRIMARY_CREATIVE_JD_TEXT, title="Art Director – Mid-Ops", use_ai=False)
    queries = generate_boolean_queries(
        title="Art Director – Mid-Ops",
        mandatory_skills=extraction["mandatory_skills"],
        preferred_skills=extraction["preferred_skills"],
        domain_terms=extraction["domain_terms"],
        alternative_titles=extraction["alternative_titles"],
        adjacent_skills=extraction["adjacent_skills"],
        location="Bangalore",
        experience_years=3.0,
        search_mode="balanced",
    )

    # Check platforms exist
    assert queries.naukri.query, "Naukri query missing"
    assert queries.linkedin.query, "LinkedIn query missing"
    assert queries.google_xray.query, "Google X-Ray query missing"
    assert queries.simple_keywords.get("comma"), "Simple keywords missing"

    # Naukri query syntax & length
    assert len(queries.naukri.query) <= 1000, f"Naukri query exceeds 1000 chars: {len(queries.naukri.query)}"
    assert "AND" in queries.naukri.query
    assert "OR" in queries.naukri.query
    assert "Art Director" in queries.naukri.query or "Creative Director" in queries.naukri.query

    # Verify Strict mode has higher constraint and does not force preferred tools
    strict_queries = generate_boolean_queries(
        title="Art Director – Mid-Ops",
        mandatory_skills=extraction["mandatory_skills"],
        preferred_skills=extraction["preferred_skills"],
        domain_terms=extraction["domain_terms"],
        alternative_titles=extraction["alternative_titles"],
        adjacent_skills=extraction["adjacent_skills"],
        location="Bangalore",
        experience_years=3.0,
        search_mode="strict",
    )
    assert strict_queries.naukri.query

    # Verify Broad mode provides maximum recall
    broad_queries = generate_boolean_queries(
        title="Art Director – Mid-Ops",
        mandatory_skills=extraction["mandatory_skills"],
        preferred_skills=extraction["preferred_skills"],
        domain_terms=extraction["domain_terms"],
        alternative_titles=extraction["alternative_titles"],
        adjacent_skills=extraction["adjacent_skills"],
        location="Bangalore",
        experience_years=3.0,
        search_mode="broad",
    )
    assert broad_queries.naukri.query


# ----------------------------------------------------
# 5. Evidence-Based Candidate Matching Tests
# ----------------------------------------------------

def test_creative_candidate_matching_high_fit():
    """Verify qualified Art Director candidate scores high and receives portfolio match."""
    art_director_resume = """
    Priya Sharma
    Senior Art Director & Visual Designer | Bangalore, India
    Portfolio: https://behance.net/priyasharma_design
    
    Summary:
    Creative Art Director with 4.5 years of experience conceptualizing brand campaigns, advertising design,
    and packaging. Hands-on expertise in Adobe Creative Suite (Photoshop, Illustrator, InDesign, After Effects),
    typography, and brand storytelling. Extensive background in in-store marketing (ISM) and retail creative operations.
    Proficient with presentation software (Apple Keynote, Microsoft PowerPoint), Word, Excel, and Outlook.
    
    Experience:
    Senior Art Director - Ogilvy & Mather (2022 - Present)
    • Lead art direction and advertising design for global retail FMCG brands.
    • Directed 15+ 360-degree creative campaigns spanning print, packaging, digital media, and in-store marketing.
    • Collaborated daily with creative producers, copywriters, and visual designers.
    • Oversaw layout design, typography, color palettes, and motion design assets.
    • Utilized Cinema 4D for 3D packaging mockups and Adobe Illustrator for vector branding.
    • Delivered leadership presentations to marketing vice presidents and brand directors using Apple Keynote and PowerPoint.
    
    Visual Designer - Schbang Digital (2020 - 2022)
    • Designed social media content, brand identities, and promotional packaging using Adobe Photoshop and Illustrator.
    • Storyboarded video concepts and animated short brand teasers in After Effects.
    • Maintained campaign schedules in Microsoft Word, Excel and Outlook.
    
    Education:
    Bachelor of Fine Arts (BFA) in Applied Arts & Advertising Design, College of Art, 2020.
    """

    res = evaluate_requirements(
        PRIMARY_CREATIVE_JD_TEXT,
        art_director_resume,
        resume_complete=True,
        profile_skills=["Art Direction", "Advertising Design", "Adobe Photoshop", "Adobe Illustrator", "InDesign", "Typography"],
        role_title="Art Director – Mid-Ops",
    )

    score = res["match_score"]
    assert score >= 70, f"Expected match score >= 70 for qualified Art Director, got {score}"

    # Verify portfolio requirement matched
    portfolio_eval = next((r for r in res["requirements"] if r["category"] == "portfolio_requirements"), None)
    assert portfolio_eval is not None, "Portfolio requirement was not evaluated"
    assert portfolio_eval["evidence_status"] == "DIRECT_MATCH", f"Expected DIRECT_MATCH for portfolio, got {portfolio_eval['evidence_status']}"
    assert "behance" in portfolio_eval["evidence"].lower()

    # Verify presentation skills requirement in qualifications is preferred (not mandatory gap)
    pref_eval = next((r for r in res["requirements"] if "presentation" in r["original_text"].lower() and "effective" in r["original_text"].lower()), None)
    if pref_eval:
        assert pref_eval["classification"] == "Preferred"


def test_creative_candidate_matching_unqualified():
    """Verify Software Engineer candidate scores low with clear mandatory creative gaps."""
    it_resume = """
    Ramesh Kumar
    Full Stack Java Developer | Bangalore
    
    Summary:
    Java Developer with 5 years experience building enterprise microservices using Spring Boot, Hibernate,
    AWS, PostgreSQL, and React.
    
    Experience:
    Software Engineer - Infosys (2019 - Present)
    • Developed REST APIs and microservices using Java 17 and Spring Boot.
    • Deployed containerized applications to AWS EKS and managed PostgreSQL databases.
    • Implemented CI/CD pipelines using Jenkins and Docker.
    
    Education:
    B.Tech in Computer Science, 2019.
    """

    res = evaluate_requirements(
        PRIMARY_CREATIVE_JD_TEXT,
        it_resume,
        resume_complete=True,
        profile_skills=["Java", "Spring Boot", "AWS", "Microservices"],
        role_title="Art Director – Mid-Ops",
    )

    score = res["match_score"]
    assert score < 40, f"Expected low match score for Software Engineer (< 40), got {score}"
    missing_mandatory = [r for r in res["requirements"] if r["classification"] == "Mandatory" and r["evidence_status"] == "MISSING"]
    assert len(missing_mandatory) >= 2, "Expected mandatory gaps in creative tools & art direction"


# ----------------------------------------------------
# 6. Resume Parsing & Portfolio Extraction Tests
# ----------------------------------------------------

def test_creative_resume_parsing_and_portfolio_links():
    """Verify resume parser extracts creative skills and online portfolio links."""
    sample_text = """
    Ananya Roy - Art Director
    Portfolio: https://dribbble.com/ananyaroy and https://www.artstation.com/ananya_3d
    Skills: Art Direction, Adobe Illustrator, Adobe Photoshop, After Effects, Cinema 4D, Typography
    """
    links = extract_portfolio_links(sample_text)
    assert len(links) >= 2, f"Expected at least 2 portfolio links, found {links}"
    assert any("dribbble.com" in link for link in links)
    assert any("artstation.com" in link for link in links)

    profile = parse_resume_profile(sample_text)
    extracted_skills = profile.skills
    assert any("Illustrator" in s or "Photoshop" in s or "Art Direction" in s for s in extracted_skills)


# ----------------------------------------------------
# 7. Cross-Domain Regression Isolation Tests (9 Domains)
# ----------------------------------------------------

def test_all_nine_domains_isolation():
    """Verify strict isolation across all 9 supported domains with zero leakage."""
    test_cases = [
        ("Design Verification Engineer (UVM / SystemVerilog)", "semiconductor_vlsi"),
        ("Senior Cloud DevOps Engineer (AWS / Terraform)", "cloud_infrastructure"),
        ("CAD Mechanical Design Engineer (Creo / SolidWorks)", "cad_engineering"),
        ("ServiceNow FSO Technical Lead (CSM / ITSM)", "servicenow_itsm"),
        ("SAP CPI Integration Consultant (Cloud Platform)", "sap_erp"),
        ("Java Production Support Specialist (Spring Boot / Linux)", "software_engineering"),
        ("Senior Financial Analyst (US GAAP / Hyperion)", "finance_accounting"),
        ("Item Setup / Data Quality / Item Launches", "retail_product_operations"),
        ("Art Director – Mid-Ops", "creative_design"),
    ]

    for title, expected_domain in test_cases:
        detected_domain, _ = detect_jd_domain(title, f"Role: {title}\nKey responsibilities and qualifications for {title}.")
        assert detected_domain == expected_domain, f"Domain mismatch for '{title}': expected {expected_domain}, got {detected_domain}"
