"""Reusable skill normalization, categorization, and adjacency service for Phase 1 Intelligence.

Strictly separates:
- `exact`: Direct canonical match.
- `alias_equivalent`: Confirmed naming alias (e.g., 'HFM' -> 'Hyperion Financial Management').
- `related_adjacent`: Adjacent/complementary skill in the same or neighboring stack (NEVER treated as equivalent).
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set, Tuple


# Canonical skill catalog with explicit category, confirmed aliases, and adjacent technologies.
SKILL_CATALOG: Dict[str, Dict[str, Any]] = {
    "Java": {
        "category": "Backend Engineering",
        "aliases": ["java se", "java ee", "j2ee", "core java", "jdk"],
        "adjacent": ["Spring Boot", "Microservices", "REST APIs", "SQL", "Hibernate", "Maven"],
    },
    "Spring Boot": {
        "category": "Backend Engineering",
        "aliases": ["springboot", "spring-boot", "spring framework", "spring mvc"],
        "adjacent": ["Java", "Microservices", "REST APIs", "Docker", "Kubernetes", "SQL"],
    },
    "Microservices": {
        "category": "Backend Engineering",
        "aliases": ["microservice architecture", "micro-services"],
        "adjacent": ["Spring Boot", "Docker", "Kubernetes", "REST APIs", "AWS", "Azure"],
    },
    "REST APIs": {
        "category": "Backend Engineering",
        "aliases": ["rest api", "restful api", "restful web services", "rest"],
        "adjacent": ["Java", "Spring Boot", "Python", ".NET", "FastAPI", "SQL"],
    },
    ".NET": {
        "category": "Backend Engineering",
        "aliases": ["dotnet", ".net core", "asp.net", "asp.net core", "net core"],
        "adjacent": ["C#", "SQL Server", "Azure", "REST APIs", "Microservices"],
    },
    "C#": {
        "category": "Backend Engineering",
        "aliases": ["c sharp", "csharp"],
        "adjacent": [".NET", "SQL Server", "Azure", "REST APIs"],
    },
    "Python": {
        "category": "Backend & AI Engineering",
        "aliases": ["python3", "py"],
        "adjacent": ["FastAPI", "Django", "SQL", "Docker", "AWS"],
    },
    "FastAPI": {
        "category": "Backend & AI Engineering",
        "aliases": ["fast api"],
        "adjacent": ["Python", "REST APIs", "SQLAlchemy", "Docker", "SQL"],
    },
    "React": {
        "category": "Frontend Engineering",
        "aliases": ["reactjs", "react.js"],
        "adjacent": ["JavaScript", "TypeScript", "HTML/CSS", "Tailwind CSS", "REST APIs"],
    },
    "JavaScript": {
        "category": "Frontend Engineering",
        "aliases": ["js", "ecmascript", "es6"],
        "adjacent": ["React", "TypeScript", "Node.js", "HTML/CSS"],
    },
    "TypeScript": {
        "category": "Frontend Engineering",
        "aliases": ["ts"],
        "adjacent": ["JavaScript", "React", "Node.js"],
    },
    "SQL": {
        "category": "Data & Databases",
        "aliases": ["structured query language", "t-sql", "pl/sql", "plsql"],
        "adjacent": ["PostgreSQL", "SQL Server", "Oracle DB", "Python", "Java"],
    },
    "SQL Server": {
        "category": "Data & Databases",
        "aliases": ["mssql", "ms sql", "microsoft sql server"],
        "adjacent": ["SQL", ".NET", "C#", "Azure"],
    },
    "Oracle FCCS": {
        "category": "Enterprise EPM & ERP",
        "aliases": ["fccs", "financial consolidation and close", "oracle financial consolidation"],
        "adjacent": ["Oracle EPM", "Hyperion Financial Management", "Smart View", "Financial Consolidation", "SQL"],
    },
    "Oracle EPM": {
        "category": "Enterprise EPM & ERP",
        "aliases": ["epm cloud", "oracle epm cloud", "hyperion planning"],
        "adjacent": ["Oracle FCCS", "Hyperion Financial Management", "Smart View", "Financial Consolidation"],
    },
    "Hyperion Financial Management": {
        "category": "Enterprise EPM & ERP",
        "aliases": ["hfm", "hyperion hfm", "oracle hfm"],
        "adjacent": ["Oracle FCCS", "Oracle EPM", "Smart View", "Financial Consolidation"],
    },
    "Smart View": {
        "category": "Enterprise EPM & ERP",
        "aliases": ["oracle smart view", "hyperion smart view"],
        "adjacent": ["Oracle FCCS", "Oracle EPM", "Hyperion Financial Management"],
    },
    "SAP": {
        "category": "Enterprise EPM & ERP",
        "aliases": ["sap erp", "sap s/4hana", "s/4hana"],
        "adjacent": ["SAP CPI", "ABAP", "REST APIs", "SQL"],
    },
    "SAP CPI": {
        "category": "Enterprise EPM & ERP",
        "aliases": ["sap cloud platform integration", "sap integration suite", "integration suite", "cpi", "sap s/4hana cloud", "s/4hana cloud", "cloud platform integration"],
        "adjacent": ["SAP", "REST APIs", "XML/XSLT", "Groovy"],
    },
    "Groovy": {
        "category": "Enterprise EPM & ERP",
        "aliases": ["groovy script", "groovy scripting", "groovy script mapping"],
        "adjacent": ["SAP CPI", "Java", "REST APIs"],
    },
    "Cloud Infrastructure": {
        "category": "Cloud & DevOps",
        "aliases": ["cloud infrastructure management", "cloud engineering"],
        "adjacent": ["AWS", "Azure", "Terraform", "Kubernetes", "CI/CD"],
    },
    "Siemens Teamcenter": {
        "category": "PLM & Silicon Engineering",
        "aliases": ["teamcenter", "tc plm", "teamcenter plm"],
        "adjacent": ["BMIDE", "Active Workspace", "ITK", "Java", "CAD Integration"],
    },
    "BMIDE": {
        "category": "PLM & Silicon Engineering",
        "aliases": ["business modeler ide"],
        "adjacent": ["Siemens Teamcenter", "Active Workspace", "ITK"],
    },
    "Active Workspace": {
        "category": "PLM & Silicon Engineering",
        "aliases": ["awc", "active workspace client", "teamcenter awc"],
        "adjacent": ["Siemens Teamcenter", "BMIDE", "JavaScript"],
    },
    "DFT": {
        "category": "PLM & Silicon Engineering",
        "aliases": ["design for test", "design for testability", "scan insertion"],
        "adjacent": ["ATPG", "Silicon Validation", "ATE", "Verilog"],
    },
    "Manual Testing": {
        "category": "QA & Testing",
        "aliases": ["manual qa", "functional testing", "qa testing"],
        "adjacent": ["Selenium", "API Testing", "Automation Testing", "SQL"],
    },
    "Automation Testing": {
        "category": "QA & Testing",
        "aliases": ["qa automation", "test automation"],
        "adjacent": ["Selenium", "API Testing", "Java", "Python", "Manual Testing"],
    },
    "Selenium": {
        "category": "QA & Testing",
        "aliases": ["selenium webdriver"],
        "adjacent": ["Automation Testing", "Java", "Python", "API Testing"],
    },
    "API Testing": {
        "category": "QA & Testing",
        "aliases": ["postman", "rest assured", "restassured"],
        "adjacent": ["Automation Testing", "REST APIs", "Manual Testing"],
    },
    "AWS": {
        "category": "Cloud & DevOps",
        "aliases": ["amazon web services"],
        "adjacent": ["Docker", "Kubernetes", "Terraform", "CI/CD", "Microservices"],
    },
    "Azure": {
        "category": "Cloud & DevOps",
        "aliases": ["microsoft azure", "azure cloud"],
        "adjacent": [".NET", "C#", "Docker", "Kubernetes", "CI/CD"],
    },
    "Docker": {
        "category": "Cloud & DevOps",
        "aliases": ["containers", "docker containers"],
        "adjacent": ["Kubernetes", "AWS", "Azure", "CI/CD", "Microservices"],
    },
    "Kubernetes": {
        "category": "Cloud & DevOps",
        "aliases": ["k8s"],
        "adjacent": ["Docker", "AWS", "Azure", "Microservices", "CI/CD"],
    },
    "CAD": {
        "category": "Engineering & Design",
        "aliases": ["cad software", "computer-aided design", "2d cad", "3d cad", "cad drafting", "engineering cad", "architecture cad"],
        "adjacent": ["AutoCAD", "Autodesk Revit", "MicroStation", "SolidWorks", "CATIA", "2D Drafting", "3D Modeling", "BIM 360"],
    },
    "AutoCAD": {
        "category": "Engineering & Design",
        "aliases": ["autocad 2d", "autocad 3d", "acad"],
        "adjacent": ["CAD", "Autodesk Revit", "MicroStation", "SolidWorks", "2D Drafting", "Civil 3D"],
    },
    "Autodesk Revit": {
        "category": "Engineering & Design",
        "aliases": ["revit", "revit architecture", "revit mep", "autodesk revit architecture"],
        "adjacent": ["AutoCAD", "BIM 360", "MicroStation", "Navisworks", "CAD"],
    },
    "MicroStation": {
        "category": "Engineering & Design",
        "aliases": ["bentley microstation", "microstation v8i", "microstation connect"],
        "adjacent": ["AutoCAD", "Autodesk Revit", "CAD", "ProjectWise", "2D Drafting"],
    },
    "BIM 360": {
        "category": "Engineering & Design",
        "aliases": ["bim", "building information modeling"],
        "adjacent": ["Autodesk Revit", "AutoCAD", "Navisworks", "MicroStation"],
    },
    "SolidWorks": {
        "category": "Engineering & Design",
        "aliases": ["solid works"],
        "adjacent": ["AutoCAD", "CATIA", "3D Modeling", "CAD"],
    },
    "CATIA": {
        "category": "Engineering & Design",
        "aliases": ["catia v5", "catia v6"],
        "adjacent": ["SolidWorks", "CAD", "3D Modeling"],
    },
    "Bluebeam": {
        "category": "Engineering & Design",
        "aliases": ["bluebeam revu"],
        "adjacent": ["Autodesk Revit", "AutoCAD", "CAD"],
    },
    "Verilog": {
        "category": "Semiconductor & VLSI",
        "aliases": ["verilog hdl"],
        "adjacent": ["SystemVerilog", "VHDL", "FPGA", "ASIC", "ModelSim"],
    },
    "SystemVerilog": {
        "category": "Semiconductor & VLSI",
        "aliases": ["system verilog", "sv"],
        "adjacent": ["UVM", "Verilog", "SVA", "Assertions", "OVM"],
    },
    "UVM": {
        "category": "Semiconductor & VLSI",
        "aliases": ["universal verification methodology"],
        "adjacent": ["SystemVerilog", "Functional Coverage", "Testbench Architecture", "SVA"],
    },
    "VHDL": {
        "category": "Semiconductor & VLSI",
        "aliases": ["vhdl-ams"],
        "adjacent": ["Verilog", "FPGA", "ModelSim"],
    },
    "FPGA": {
        "category": "Semiconductor & VLSI",
        "aliases": ["fpga design", "field-programmable gate array"],
        "adjacent": ["Verilog", "VHDL", "Vivado", "Quartus", "ASIC"],
    },
    "SVA": {
        "category": "Semiconductor & VLSI",
        "aliases": ["systemverilog assertions", "assertions"],
        "adjacent": ["SystemVerilog", "UVM", "Formal Verification"],
    },
    "DO-254": {
        "category": "Semiconductor & VLSI",
        "aliases": ["do254", "dal-b"],
        "adjacent": ["Hardware Validation", "Design Verification", "Avionics"],
    },
    "General Ledger": {
        "category": "Finance, Accounting & Tax",
        "aliases": ["gl", "general ledger accounting"],
        "adjacent": ["Reconciliation", "Month-End Close", "Balance Sheet", "Journal Entries"],
    },
    "Reconciliation": {
        "category": "Finance, Accounting & Tax",
        "aliases": ["account reconciliation", "bank reconciliation", "tax reconciliation"],
        "adjacent": ["General Ledger", "Balance Sheet", "Tax Compliance"],
    },
    "Tax Compliance": {
        "category": "Finance, Accounting & Tax",
        "aliases": ["statutory compliance", "tax filing", "direct tax", "indirect tax"],
        "adjacent": ["GST", "TDS", "General Ledger", "Tax Audits"],
    },
    "GST": {
        "category": "Finance, Accounting & Tax",
        "aliases": ["goods and services tax", "gstr-1", "gstr-3b"],
        "adjacent": ["TDS", "Tax Compliance", "Tax Reconciliation"],
    },
    "TDS": {
        "category": "Finance, Accounting & Tax",
        "aliases": ["tax deducted at source", "withholding tax"],
        "adjacent": ["GST", "Income Tax", "Form 26AS", "Tax Compliance"],
    },
    "Form 26AS": {
        "category": "Finance, Accounting & Tax",
        "aliases": ["form 26as/ais", "ais"],
        "adjacent": ["TDS", "Income Tax", "Tax Reconciliation"],
    },
    "Sales and Use Tax": {
        "category": "Finance, Accounting & Tax",
        "aliases": ["sut", "us sales and use tax", "us sales tax"],
        "adjacent": ["Indirect Tax", "Tax Compliance", "State Tax"],
    },
    "GAAP": {
        "category": "Finance, Accounting & Tax",
        "aliases": ["us gaap", "ifrs"],
        "adjacent": ["Financial Reporting", "Audit", "General Ledger"],
    },
    "Terraform": {
        "category": "Cloud & DevOps",
        "aliases": ["iac", "infrastructure as code"],
        "adjacent": ["AWS", "Azure", "Kubernetes", "Docker", "CI/CD"],
    },
    "Linux": {
        "category": "Cloud & DevOps",
        "aliases": ["unix", "rhel", "ubuntu"],
        "adjacent": ["Shell", "Docker", "AWS", "Python"],
    },
    "Flow Designer": {
        "category": "IT Service Management",
        "aliases": ["workflow studio", "servicenow flow designer"],
        "adjacent": ["ServiceNow", "Business Rules", "IntegrationHub"],
    },
    "Business Rules": {
        "category": "IT Service Management",
        "aliases": ["servicenow business rules"],
        "adjacent": ["ServiceNow", "Flow Designer", "JavaScript"],
    },
    "Excel": {
        "category": "Productivity & Analytics",
        "aliases": ["microsoft excel", "ms excel", "advanced excel", "spreadsheets"],
        "adjacent": ["VLOOKUP", "Pivot Tables", "Macros", "Power Query", "Power BI", "Data Analysis", "Outlook"],
    },
    "Outlook": {
        "category": "Productivity & Analytics",
        "aliases": ["microsoft outlook", "ms outlook"],
        "adjacent": ["Excel", "General PC Proficiency"],
    },
    "General PC Proficiency": {
        "category": "Productivity & Analytics",
        "aliases": ["pc proficiency", "computer proficiency", "computer skills"],
        "adjacent": ["Excel", "Outlook"],
    },
    "Item Setup": {
        "category": "Retail & Product Operations",
        "aliases": ["item set up", "product setup", "new item setup", "sku setup", "catalog setup"],
        "adjacent": ["Product Data Management", "Data Quality", "Retail Operations", "Vendor Coordination", "Excel"],
    },
    "Product Data Management": {
        "category": "Retail & Product Operations",
        "aliases": ["item data management", "product data", "item data", "master data management", "catalog data", "product information management", "pim"],
        "adjacent": ["Item Setup", "Data Quality", "Data Validation", "Data Remediation"],
    },
    "Data Quality": {
        "category": "Retail & Product Operations",
        "aliases": ["product data quality", "data accuracy", "data consistency", "item data quality"],
        "adjacent": ["Data Validation", "Data Remediation", "Product Data Management", "Excel"],
    },
    "Data Validation": {
        "category": "Retail & Product Operations",
        "aliases": ["data verification", "data audits", "data checks"],
        "adjacent": ["Data Quality", "Data Remediation", "Excel"],
    },
    "Data Remediation": {
        "category": "Retail & Product Operations",
        "aliases": ["data cleanup", "data cleansing", "data correction"],
        "adjacent": ["Data Quality", "Data Validation", "Item Setup"],
    },
    "Item Launch Management": {
        "category": "Retail & Product Operations",
        "aliases": ["item launches", "product launch management", "launch readiness", "product launches", "key product launches"],
        "adjacent": ["Item Setup", "Vendor Coordination", "Merchant Coordination", "Project Coordination"],
    },
    "Vendor Coordination": {
        "category": "Retail & Product Operations",
        "aliases": ["vendor management", "vendor partner coordination", "supplier coordination", "external vendor management", "vendor partners"],
        "adjacent": ["Merchant Coordination", "Retail Operations", "Item Setup"],
    },
    "Merchant Coordination": {
        "category": "Retail & Product Operations",
        "aliases": ["merchant teams coordination", "merchandising coordination", "buyer coordination", "merchant teams"],
        "adjacent": ["Vendor Coordination", "Retail Operations", "Item Setup"],
    },
    "Retail Operations": {
        "category": "Retail & Product Operations",
        "aliases": ["merchandising operations", "retail merchandising", "product operations", "store operations"],
        "adjacent": ["Item Setup", "Product Data Management", "Vendor Coordination"],
    },
    "Product Content Management": {
        "category": "Retail & Product Operations",
        "aliases": ["product content", "content generation", "catalog content"],
        "adjacent": ["Product Data Management", "Item Setup", "Data Quality"],
    },
    "Service-Level Management": {
        "category": "Business Operations",
        "aliases": ["service level agreements", "service levels", "sla compliance", "sla management"],
        "adjacent": ["Workload Planning", "Process Improvement"],
    },
    "Cross-functional Coordination": {
        "category": "Business Operations",
        "aliases": ["cross-functional initiatives", "stakeholder coordination", "internal stakeholders"],
        "adjacent": ["Vendor Coordination", "Merchant Coordination"],
    },
    "Process Improvement": {
        "category": "Business Operations",
        "aliases": ["process optimization", "continuous improvement", "efficient working methods"],
        "adjacent": ["Workload Planning", "Service-Level Management"],
    },
    "Workload Planning": {
        "category": "Business Operations",
        "aliases": ["workload management", "prioritize tasks", "plan workloads", "task prioritization"],
        "adjacent": ["Process Improvement", "Service-Level Management"],
    },
    "Project Coordination": {
        "category": "Business Operations",
        "aliases": ["project management", "project tracking", "coordinate launches"],
        "adjacent": ["Item Launch Management", "Cross-functional Coordination"],
    },
    "ServiceNow": {
        "category": "IT Service Management",
        "aliases": ["service-now", "snow", "servicenow platform", "servicenow fso"],
        "adjacent": ["ITSM", "ITIL", "Business Rules", "Flow Designer", "IntegrationHub", "CMDB"],
    },
    "Adobe Illustrator": {
        "category": "Design Tools & Software",
        "aliases": ["illustrator", "adobe illustrator cc", "ai"],
        "adjacent": ["Adobe Photoshop", "Adobe InDesign", "Graphic Design", "Typography"],
    },
    "Adobe Photoshop": {
        "category": "Design Tools & Software",
        "aliases": ["photoshop", "adobe photoshop cc", "ps"],
        "adjacent": ["Adobe Illustrator", "Adobe InDesign", "Graphic Design", "Photo Editing"],
    },
    "Adobe After Effects": {
        "category": "Design Tools & Software",
        "aliases": ["after effects", "aftereffects", "ae"],
        "adjacent": ["Cinema 4D", "Motion Graphics", "Video Editing", "Autodesk Maya"],
    },
    "Cinema 4D": {
        "category": "Design Tools & Software",
        "aliases": ["c4d", "cinema4d", "maxon cinema 4d"],
        "adjacent": ["Adobe After Effects", "3D Modeling", "Motion Graphics", "Autodesk Maya"],
    },
    "Autodesk Maya": {
        "category": "Design Tools & Software",
        "aliases": ["maya", "autodesk maya 3d"],
        "adjacent": ["Cinema 4D", "3D Animation", "3D Modeling"],
    },
    "Adobe InDesign": {
        "category": "Design Tools & Software",
        "aliases": ["indesign", "adobe indesign cc", "id"],
        "adjacent": ["Adobe Illustrator", "Adobe Photoshop", "Typography", "Layout Design"],
    },
    "Smoke": {
        "category": "Design Tools & Software",
        "aliases": ["autodesk smoke", "autodesk smoke software"],
        "adjacent": ["Adobe After Effects", "Video Finishing", "Motion Graphics"],
    },
    "Apple Keynote": {
        "category": "Design Tools & Software",
        "aliases": ["keynote"],
        "adjacent": ["Microsoft PowerPoint", "Presentation Skills"],
    },
    "Microsoft PowerPoint": {
        "category": "Productivity & Analytics",
        "aliases": ["powerpoint", "ms powerpoint", "powerpoint functionality", "ppt"],
        "adjacent": ["Apple Keynote", "Presentation Skills", "Excel"],
    },
    "Microsoft Word": {
        "category": "Productivity & Analytics",
        "aliases": ["word", "ms word"],
        "adjacent": ["Excel", "Outlook"],
    },
    "Art Direction": {
        "category": "Creative & Design",
        "aliases": ["art director", "art direct"],
        "adjacent": ["Creative Direction", "Advertising Design", "Graphic Design", "Typography", "Storyboarding"],
    },
    "Creative Direction": {
        "category": "Creative & Design",
        "aliases": ["creative director"],
        "adjacent": ["Art Direction", "Advertising Design", "Creative Conceptualization"],
    },
    "Advertising Design": {
        "category": "Creative & Design",
        "aliases": ["advertising", "ad design"],
        "adjacent": ["Art Direction", "Graphic Design", "Packaging Design", "Digital Advertising"],
    },
    "Graphic Design": {
        "category": "Creative & Design",
        "aliases": ["graphic designer", "graphics"],
        "adjacent": ["Typography", "Layout Design", "Adobe Illustrator", "Adobe Photoshop"],
    },
    "Storyboarding": {
        "category": "Creative & Design",
        "aliases": ["storyboard", "storyboards", "story board"],
        "adjacent": ["Visual Storytelling", "Art Direction", "Script Interpretation"],
    },
    "Typography": {
        "category": "Creative & Design",
        "aliases": ["type design", "typesetting"],
        "adjacent": ["Layout Design", "Graphic Design", "Adobe InDesign"],
    },
    "Packaging Design": {
        "category": "Creative & Design",
        "aliases": ["packaging"],
        "adjacent": ["Advertising Design", "Graphic Design", "Adobe Illustrator"],
    },
    "Visual Storytelling": {
        "category": "Creative & Design",
        "aliases": ["storytelling"],
        "adjacent": ["Storyboarding", "Creative Content", "Art Direction"],
    },
    "Layout Design": {
        "category": "Creative & Design",
        "aliases": ["layout", "page layout"],
        "adjacent": ["Typography", "Graphic Design", "Adobe InDesign"],
    },
    "Media Production": {
        "category": "Media Production",
        "aliases": ["media production and execution", "creative production"],
        "adjacent": ["Creative Direction", "Producer Collaboration", "Deliverables Management"],
    },
}

# Build reverse lookup index mapping lowercase canonical and alias tokens to canonical skill name + match type.
_ALIAS_INDEX: Dict[str, Tuple[str, str]] = {}
for _canonical, _meta in SKILL_CATALOG.items():
    _ALIAS_INDEX[_canonical.lower()] = (_canonical, "exact")
    for _alias in _meta.get("aliases", []):
        _ALIAS_INDEX[_alias.lower()] = (_canonical, "alias_equivalent")


def _clean_token(raw_skill: str) -> str:
    """Normalize whitespace and punctuation casing for lookup without altering semantic meaning."""
    return re.sub(r"\s+", " ", (raw_skill or "").strip())


def normalize_skill(raw_skill: str) -> Dict[str, Any]:
    """Normalize a single raw skill string with explicit provenance and match classification."""
    cleaned = _clean_token(raw_skill)
    if not cleaned:
        return {
            "raw_input": raw_skill,
            "canonical": "",
            "category": "Uncategorized",
            "match_type": "empty",
            "is_equivalent": False,
        }

    key = cleaned.lower()
    if key in _ALIAS_INDEX:
        canonical, match_type = _ALIAS_INDEX[key]
        return {
            "raw_input": raw_skill,
            "canonical": canonical,
            "category": SKILL_CATALOG[canonical]["category"],
            "match_type": match_type,
            "is_equivalent": True,
        }

    return {
        "raw_input": raw_skill,
        "canonical": cleaned,
        "category": "General / Domain",
        "match_type": "unmapped_literal",
        "is_equivalent": False,
    }


def normalize_skills_list(skills: Optional[List[str]]) -> List[Dict[str, Any]]:
    """Normalize a list of skills, deduplicating by canonical lowercase name while retaining provenance."""
    seen: Set[str] = set()
    normalized: List[Dict[str, Any]] = []
    for raw in skills or []:
        item = normalize_skill(str(raw))
        if not item["canonical"]:
            continue
        dedupe_key = item["canonical"].lower()
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        normalized.append(item)
    return normalized


def get_related_adjacent_skills(canonical_skills: List[str]) -> List[Dict[str, Any]]:
    """Return adjacent technologies for a candidate's verified skills, excluding skills already held."""
    held_lower = {s.lower() for s in canonical_skills if s}
    adjacent_map: Dict[str, Set[str]] = {}

    for skill in canonical_skills:
        norm = normalize_skill(skill)["canonical"]
        meta = SKILL_CATALOG.get(norm)
        if not meta:
            continue
        for adj in meta.get("adjacent", []):
            if adj.lower() in held_lower:
                continue
            adjacent_map.setdefault(adj, set()).add(norm)

    results: List[Dict[str, Any]] = []
    for adj_skill, sources in sorted(adjacent_map.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        cat = SKILL_CATALOG.get(adj_skill, {}).get("category", "General / Domain")
        results.append(
            {
                "skill": adj_skill,
                "category": cat,
                "relationship_type": "related_adjacent",
                "derived_from_verified_skills": sorted(sources),
                "information_type": "Inferred adjacent technology",
                "note": f"Adjacent to verified skill(s): {', '.join(sorted(sources))}; not confirmed experience.",
            }
        )
    return results


def extract_structured_resume_facts(raw_text: str) -> Dict[str, Any]:
    """Extract deterministic resume facts (titles, companies, certs, projects, education, skills) without hallucinating."""
    if not raw_text or not raw_text.strip():
        return {
            "skills": [],
            "certifications": [],
            "education": [],
            "companies": [],
            "projects": [],
            "titles": [],
        }

    text = raw_text.strip()
    lower = text.lower()
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in text.splitlines() if ln.strip()]

    # 1. Detect known catalog skills present in resume text.
    found_skills: List[str] = []
    for canonical, meta in SKILL_CATALOG.items():
        tokens = [canonical] + meta.get("aliases", [])
        for tok in tokens:
            escaped = re.escape(tok.lower())
            pattern = rf"(?<![a-z0-9]){escaped}(?![a-z0-9])"
            if re.search(pattern, lower):
                found_skills.append(canonical)
                break

    # 2. Extract certification mentions conservatively from explicit lines/keywords.
    cert_keywords = (
        "certified",
        "certification",
        "aws solutions architect",
        "azure fundamentals",
        "pmp",
        "scrum master",
        "oracle certified",
        "istqb",
    )
    certifications: List[str] = []
    for ln in lines:
        ln_low = ln.lower()
        if any(ck in ln_low for ck in cert_keywords) and len(ln) <= 140:
            if ln not in certifications:
                certifications.append(ln)

    # 3. Extract education lines conservatively.
    edu_pattern = re.compile(
        r"\b(b\.?tech|b\.?e\.?|m\.?tech|m\.?sc|b\.?sc|mba|mca|bca|bachelor|master|ph\.?d|university|institute of technology)\b",
        re.IGNORECASE,
    )
    education: List[str] = []
    for ln in lines:
        if edu_pattern.search(ln) and len(ln) <= 160 and ln not in education:
            education.append(ln)

    # 4. Extract explicit project headers / lines starting with Project.
    projects: List[str] = []
    for ln in lines:
        if re.match(r"^(project|projects)\s*[:\-–]", ln, re.IGNORECASE) and len(ln) <= 180:
            cleaned_proj = re.sub(r"^projects?\s*[:\-–]\s*", "", ln, flags=re.IGNORECASE).strip()
            if cleaned_proj and cleaned_proj not in projects:
                projects.append(cleaned_proj)

    # 5. Extract company / employer lines conservatively (explicit Company/Employer labels or Pvt Ltd / Inc / Corp suffixes).
    company_pattern = re.compile(
        r"\b([A-Z][A-Za-z0-9&.\- ]{2,40}\s+(?:Pvt\.?\s*Ltd\.?|Private Limited|Inc\.?|LLC|Corp\.?|Technologies|Systems|Solutions|Consulting))\b"
    )
    companies: List[str] = []
    for ln in lines:
        for match in company_pattern.findall(ln):
            comp = match.strip()
            if comp and comp not in companies and len(comp) >= 5:
                companies.append(comp)

    # 6. Extract job title mentions from top headline lines or explicit Role/Title lines.
    title_pattern = re.compile(
        r"\b((?:Senior|Lead|Principal|Staff|Junior|Associate)?\s*(?:Software|Backend|Frontend|Full[\s-]?Stack|Java|\.NET|Python|Cloud|DevOps|Oracle|FCCS|EPM|Teamcenter|PLM|DFT|Silicon|QA|Automation|Test|Data)\s+(?:Engineer|Developer|Consultant|Architect|Lead|Analyst|Manager|Specialist))\b",
        re.IGNORECASE,
    )
    titles: List[str] = []
    for ln in lines[:25]:
        for m in title_pattern.findall(ln):
            t_clean = re.sub(r"\s+", " ", m).strip().title()
            if t_clean and t_clean not in titles:
                titles.append(t_clean)

    return {
        "skills": normalize_skills_list(found_skills),
        "certifications": certifications[:10],
        "education": education[:8],
        "companies": companies[:10],
        "projects": projects[:10],
        "titles": titles[:8],
    }


# ----------------------------------------------------
# Shared High-Fidelity Domain Sourcing Taxonomy
# ----------------------------------------------------

DOMAIN_TAXONOMY: Dict[str, Dict[str, Any]] = {
    "cad_engineering": {
        "label": "CAD & Engineering Design",
        "keywords": ["cad", "revit", "microstation", "autocad", "drafting", "bim", "civil 3d", "solidworks", "catia", "bluebeam"],
        "alt_titles": ["CAD Operator", "CAD Drafter", "CAD Designer", "BIM Specialist", "Draftsperson", "Revit Modeler"],
        "primary_skills": ["CAD", "AutoCAD", "Autodesk Revit", "MicroStation", "BIM 360", "2D Drafting", "3D Modeling", "SolidWorks", "Bluebeam"],
        "allowed_categories": {"Engineering & Design", "Productivity & Analytics"},
    },
    "semiconductor_vlsi": {
        "label": "Semiconductor & VLSI Engineering",
        "keywords": ["verilog", "systemverilog", "uvm", "vhdl", "fpga", "asic", "sva", "do-254", "sta", "silicon", "design verification"],
        "alt_titles": ["Design Verification Engineer", "ASIC Verification Engineer", "FPGA Verification Engineer", "UVM Specialist", "Hardware Validation Engineer"],
        "primary_skills": ["SystemVerilog", "UVM", "Verilog", "VHDL", "FPGA", "SVA", "DO-254", "Functional Coverage"],
        "allowed_categories": {"Semiconductor & VLSI", "PLM & Silicon Engineering", "QA & Testing"},
    },
    "finance_accounting": {
        "label": "Finance, Accounting & Tax",
        "keywords": ["accountant", "accounting", "tax", "gst", "tds", "income tax", "general ledger", "reconciliation", "sut", "gaap", "ifrs", "form 26as", "financial reporting"],
        "alt_titles": ["Staff Accountant", "Tax Analyst", "General Ledger Accountant", "Financial Accountant", "Tax Specialist"],
        "primary_skills": ["General Ledger", "Reconciliation", "Tax Compliance", "GST", "TDS", "Form 26AS", "Sales and Use Tax", "GAAP", "SAP"],
        "allowed_categories": {"Finance, Accounting & Tax", "Enterprise EPM & ERP", "Productivity & Analytics"},
    },
    "cloud_infrastructure": {
        "label": "Cloud Infrastructure & DevOps",
        "keywords": ["cloud infrastructure", "cloud", "aws", "azure", "gcp", "kubernetes", "docker", "terraform", "devops", "sre", "infrastructure"],
        "alt_titles": ["Cloud Infrastructure Manager", "Senior Manager - Cloud Infrastructure", "Cloud Infrastructure Engineer", "DevOps Engineer", "Site Reliability Engineer", "Platform Engineer", "Cloud Solutions Architect"],
        "primary_skills": ["Cloud Infrastructure", "AWS", "Azure", "Kubernetes", "Docker", "Terraform", "CI/CD", "Linux"],
        "allowed_categories": {"Cloud & DevOps", "Backend Engineering", "Data & Databases"},
    },
    "sap_erp": {
        "label": "SAP & Enterprise ERP",
        "keywords": ["sap cpi", "integration suite", "sap", "s/4hana", "cpi", "abap", "fiori", "oracle epm", "hyperion", "fccs", "pbcs", "essbase", "groovy"],
        "alt_titles": ["SAP CPI Consultant", "SAP Integration Suite Consultant", "SAP Consultant", "SAP Architect", "Oracle EPM Consultant", "ERP Specialist"],
        "primary_skills": ["SAP CPI", "SAP", "ABAP", "Groovy", "Oracle FCCS", "Oracle EPM", "Hyperion Financial Management", "Smart View", "Essbase"],
        "allowed_categories": {"Enterprise EPM & ERP", "Data & Databases"},
    },
    "servicenow_itsm": {
        "label": "ITSM & ServiceNow",
        "keywords": ["servicenow", "itsm", "fso", "flow designer", "business rules", "cmdb", "service portal", "itil"],
        "alt_titles": ["ServiceNow Developer", "ServiceNow Consultant", "ServiceNow Technical Lead", "ITSM Administrator"],
        "primary_skills": ["ServiceNow", "Flow Designer", "Business Rules", "REST APIs"],
        "allowed_categories": {"IT Service Management", "Backend Engineering"},
    },
    "software_engineering": {
        "label": "Software & Full-Stack Engineering",
        "keywords": ["java", "spring boot", "python", "fastapi", "react", "node.js", "typescript", "c++", "c#", ".net", "microservices", "sql", "postgresql"],
        "alt_titles": ["Software Engineer", "Full Stack Developer", "Backend Developer", "Frontend Developer", "Technical Lead"],
        "primary_skills": ["Java", "Spring Boot", "Python", "FastAPI", "React", "Node.js", "TypeScript", "Microservices", "REST APIs", "SQL"],
        "allowed_categories": {"Backend Engineering", "Frontend Engineering", "Backend & AI Engineering", "Data & Databases"},
    },
    "general_operations": {
        "label": "Operations & Project Governance",
        "keywords": ["pmo", "project manager", "scrum master", "agile", "jira", "process documentation", "sla"],
        "alt_titles": ["Operations Manager", "Project Manager", "Scrum Master", "Operations Specialist"],
        "primary_skills": ["Project Management", "Jira", "Agile", "Process Documentation", "SLA Management"],
        "allowed_categories": {"Productivity & Analytics"},
    },
    "retail_product_operations": {
        "label": "Retail Item & Product Data Operations",
        "job_family": "Operations / Business Support",
        "functional_area": "Retail Item & Product Data Operations",
        "role_type": "Staff Augmentation / Operational Support",
        "industry": "Retail / Merchandising / Product Data Operations",
        "work_environment": "Cross-functional vendor and merchant coordination",
        "shift_requirement": "Evening shift flexibility",
        "keywords": [
            "item setup", "item set up", "item launches", "product data", "item data",
            "data quality", "data remediation", "data validation", "merchant", "merchant teams",
            "vendor coordination", "vendor partners", "retail operations", "merchandising",
            "item coe", "launch readiness", "product content", "catalog operations", "sku",
        ],
        "alt_titles": [
            "Item Setup Specialist",
            "Product Data Operations Specialist",
            "Item Data Analyst",
            "Catalog Operations Specialist",
            "Retail Merchandising Operations Associate",
            "Product Launch Coordinator",
            "Retail Operations Associate",
        ],
        "primary_skills": [
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
        "allowed_categories": {
            "Retail & Product Operations",
            "Business Operations",
            "Productivity & Analytics",
            "General / Domain",
        },
    },
    "creative_design": {
        "label": "Creative, Art Direction & Design",
        "job_family": "Creative / Design",
        "functional_area": "Art Direction and Advertising Design",
        "role_category": "Creative Operations / Media Production",
        "role_type": "Staff Augmentation / Operational Support",
        "industry": "Advertising, Retail Branding, Creative Media and Marketing",
        "work_environment": "Creative studio / agency and cross-functional brand production",
        "keywords": [
            "art director", "art direction", "creative director", "creative direction",
            "graphic design", "advertising design", "creative content", "storyboard", "storyboards",
            "typography", "illustrator", "photoshop", "after effects", "cinema 4d", "maya",
            "indesign", "packaging design", "promotions", "ism", "visual design", "media production",
            "multichannel creative", "layout design", "smoke", "keynote", "target brand",
        ],
        "alt_titles": [
            "Art Director",
            "Senior Art Director",
            "Creative Designer",
            "Visual Design Lead",
            "Advertising Art Director",
            "Creative Lead",
            "Design Lead",
        ],
        "primary_skills": [
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
        "allowed_categories": {
            "Creative & Design",
            "Design Tools & Software",
            "Media Production",
            "Productivity & Analytics",
            "General / Domain",
        },
    },
}


def detect_jd_domain(title: str, raw_text: str) -> Tuple[str, Dict[str, Any]]:
    """Determine the primary domain from the job title and text without cross-domain pollution."""
    combined = f"{title}\n{raw_text}".lower()
    best_domain = "software_engineering"
    best_score = -1

    for domain_id, meta in DOMAIN_TAXONOMY.items():
        score = 0
        # Title matches carry 3x weight
        title_lower = (title or "").lower()
        for kw in meta["keywords"]:
            if re.search(r"\b" + re.escape(kw) + r"\b", title_lower):
                score += 3
            elif re.search(r"\b" + re.escape(kw) + r"\b", combined):
                score += 1
        if score > best_score:
            best_score = score
            best_domain = domain_id

    return best_domain, DOMAIN_TAXONOMY[best_domain]


_SKILL_EXTRACTION_CACHE: Dict[str, Dict[str, Any]] = {}


def extract_skills_from_jd(
    raw_text: str,
    title: str = "",
    use_ai: bool = True,
) -> Dict[str, Any]:
    """Single shared backend pipeline to extract, normalize, and categorize JD skills with provenance."""
    import copy
    import hashlib
    global _SKILL_EXTRACTION_CACHE

    text = (raw_text or "").strip()
    title_str = (title or "").strip()
    cache_key = f"{title_str}_{hashlib.md5(text.encode('utf-8', errors='ignore')).hexdigest()}_{use_ai}"
    if cache_key in _SKILL_EXTRACTION_CACHE:
        return copy.deepcopy(_SKILL_EXTRACTION_CACHE[cache_key])

    from app.ai.config import ai_config
    from app.ai.providers.chat_provider import chat_provider
    domain_id, domain_meta = detect_jd_domain(title_str, text)

    mandatory_skills: List[str] = []
    preferred_skills: List[str] = []
    tools_and_platforms: List[str] = []
    domain_terms: List[str] = []
    alternative_titles: List[str] = list(domain_meta.get("alt_titles", []))
    term_provenance: Dict[str, str] = {}
    model_used = "deterministic-taxonomy-pipeline"
    extraction_method = "deterministic_source_rules"

    # Step 1: Attempt local Ollama / centralized AI extraction if service available
    if use_ai and (chat_provider.is_available() or (ai_config.api_key and ai_config.api_key != "YOUR_OPENROUTER_API_KEY")):
        try:
            prompt = (
                f"You are CompanyAI's expert skill intelligence extraction model.\n"
                f"Extract recruiting sourcing skills strictly from this approved JD. Do not invent requirements.\n"
                f"Role Title: {title_str}\n"
                f"Domain: {domain_meta['label']}\n"
                f"Approved JD Text:\n{text[:3500]}\n\n"
                f"Return strict JSON with this exact schema:\n"
                f"{{\n"
                f'  "alternative_titles": ["string"],\n'
                f'  "mandatory_skills": ["string"],\n'
                f'  "preferred_skills": ["string"],\n'
                f'  "tools_and_platforms": ["string"],\n'
                f'  "domain_terminology": ["string"]\n'
                f"}}"
            )
            ai_data = chat_provider.extract_json(
                prompt=prompt,
                system_prompt="You are a strict, factual recruitment taxonomy intelligence extractor. Output valid JSON only.",
            )
            if ai_data and isinstance(ai_data, dict):
                raw_mand = [str(s).strip() for s in ai_data.get("mandatory_skills", []) if str(s).strip()]
                raw_pref = [str(s).strip() for s in ai_data.get("preferred_skills", []) if str(s).strip()]
                raw_tools = [str(s).strip() for s in ai_data.get("tools_and_platforms", []) if str(s).strip()]
                raw_terms = [str(s).strip() for s in ai_data.get("domain_terminology", []) if str(s).strip()]
                raw_alts = [str(s).strip() for s in ai_data.get("alternative_titles", []) if str(s).strip()]

                for s in raw_mand:
                    norm = normalize_skill(s)["canonical"]
                    if norm and norm.lower() not in [m.lower() for m in mandatory_skills]:
                        mandatory_skills.append(norm)
                        term_provenance[norm] = "Extracted from JD requirements (AI verified)"

                for s in raw_pref:
                    norm = normalize_skill(s)["canonical"]
                    if norm and norm.lower() not in [m.lower() for m in mandatory_skills] and norm.lower() not in [p.lower() for p in preferred_skills]:
                        preferred_skills.append(norm)
                        term_provenance[norm] = "Extracted from JD preferred qualifications (AI verified)"

                for s in raw_tools:
                    norm = normalize_skill(s)["canonical"]
                    if norm and norm.lower() not in [t.lower() for t in tools_and_platforms]:
                        tools_and_platforms.append(norm)
                        term_provenance[norm] = "Identified tool/technology in JD (AI verified)"

                domain_terms = [t for t in raw_terms if t]
                if raw_alts:
                    alternative_titles = raw_alts

                model_used = ai_config.chat_model
                extraction_method = "nemotron_chat_api"
        except Exception:
            # Graceful fallback to deterministic engine
            pass

    # Step 2: Deterministic scan of JD text for canonical skills in the detected domain
    # Always scan text to ensure high-signal domain tools explicitly in the JD are never missed
    text_lower = text.lower()
    allowed_cats = domain_meta.get("allowed_categories", set())

    # Check section segmentation for preferred vs required
    pref_split = re.split(r"(?:preferred|desirable|plus|nice to have|good to have)\s*[:\-–]", text, flags=re.I)
    req_text = f"{title_str}\n{pref_split[0]}"
    pref_text = pref_split[1] if len(pref_split) > 1 else ""

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    pref_marker_regex = re.compile(r"\b(?:preferred|desirable|is desirable|advantage|is an advantage|nice to have|good to have|plus|optional)\b", re.I)

    found_req: List[str] = []
    found_pref: List[str] = []

    for canonical, meta in SKILL_CATALOG.items():
        cat = meta.get("category", "")
        # Only consider skills within the role's allowed domain categories
        if cat not in allowed_cats and cat != "Productivity & Analytics":
            continue
        aliases = [canonical] + meta.get("aliases", [])
        for alias in aliases:
            pattern = r"(?<![a-zA-Z0-9])" + re.escape(alias.lower()) + r"(?![a-zA-Z0-9])"
            matched_lines = [l for l in lines if re.search(pattern, l.lower())]
            if matched_lines:
                is_only_in_pref_lines = all(pref_marker_regex.search(l) for l in matched_lines)
                if is_only_in_pref_lines:
                    if canonical not in found_pref and canonical not in found_req:
                        found_pref.append(canonical)
                        if canonical not in term_provenance:
                            term_provenance[canonical] = "Stated in JD preferred qualifications"
                else:
                    if canonical not in found_req:
                        found_req.append(canonical)
                        if canonical not in term_provenance:
                            term_provenance[canonical] = "Explicitly stated in JD requirements"
                break
            elif pref_text and re.search(pattern, pref_text.lower()):
                if canonical not in found_pref and canonical not in found_req:
                    found_pref.append(canonical)
                    if canonical not in term_provenance:
                        term_provenance[canonical] = "Stated in JD preferred qualifications"
                break

    # Merge scanned domain skills with any AI-extracted skills
    for sk in found_req:
        if sk.lower() not in [m.lower() for m in mandatory_skills]:
            mandatory_skills.append(sk)
    for sk in found_pref:
        if sk.lower() not in [m.lower() for m in mandatory_skills] and sk.lower() not in [p.lower() for p in preferred_skills]:
            preferred_skills.append(sk)

    # Reorder so domain-specific tools come before generic office software
    generic_office = {"Excel", "Word", "Outlook", "PowerPoint"}
    high_signal_req = [s for s in mandatory_skills if s not in generic_office]
    office_req = [s for s in mandatory_skills if s in generic_office]
    mandatory_skills = high_signal_req + office_req if high_signal_req else mandatory_skills

    # If domain mandatory skills still empty, seed with domain primary skills
    if not mandatory_skills:
        for prim in domain_meta.get("primary_skills", [])[:3]:
            mandatory_skills.append(prim)
            term_provenance[prim] = f"Domain benchmark skill for {domain_meta['label']}"

    # Ensure tools_and_platforms is populated from mandatory skills
    if not tools_and_platforms:
        allowed_tool_cats = {"Engineering & Design", "Semiconductor & VLSI", "Cloud & DevOps", "IT Service Management", "Enterprise EPM & ERP", "Design Tools & Software"}
        if "operations" in domain_id:
            allowed_tool_cats.add("Productivity & Analytics")
        tools_and_platforms = [s for s in mandatory_skills if s in SKILL_CATALOG and SKILL_CATALOG[s].get("category") in allowed_tool_cats]

    # Step 3: Compute adjacent technologies strictly bounded to the matched domain
    held_skills_lower = {s.lower() for s in mandatory_skills + preferred_skills}
    adjacent_skills: List[Dict[str, Any]] = []
    seen_adj: Set[str] = set()

    for skill_name in mandatory_skills:
        meta = SKILL_CATALOG.get(skill_name)
        if not meta:
            continue
        for adj in meta.get("adjacent", []):
            adj_lower = adj.lower()
            if adj_lower in held_skills_lower or adj_lower in seen_adj:
                continue
            adj_meta = SKILL_CATALOG.get(adj, {})
            adj_cat = adj_meta.get("category", meta.get("category", "General / Domain"))
            # Domain boundary protection: Ensure adjacent technology belongs to the domain
            if domain_meta.get("allowed_categories") and adj_cat not in domain_meta["allowed_categories"]:
                continue
            seen_adj.add(adj_lower)
            adjacent_skills.append({
                "skill": adj,
                "category": adj_cat,
                "relationship_type": "related_adjacent",
                "derived_from": skill_name,
                "is_mandatory": False,
                "note": f"Related adjacent technology based on {skill_name}; not an explicit JD requirement.",
            })

    # If adjacent skills is sparse, seed from domain primary skills that aren't already held
    for prim in domain_meta.get("primary_skills", []):
        prim_lower = prim.lower()
        if prim_lower not in held_skills_lower and prim_lower not in seen_adj and len(adjacent_skills) < 8:
            seen_adj.add(prim_lower)
            prim_cat = SKILL_CATALOG.get(prim, {}).get("category", domain_meta["label"])
            adjacent_skills.append({
                "skill": prim,
                "category": prim_cat,
                "relationship_type": "related_adjacent",
                "derived_from": domain_meta["label"],
                "is_mandatory": False,
                "note": f"Standard {domain_meta['label']} sourcing expansion keyword.",
            })

    # Generate term explanations for recruiter guidance
    term_explanations: Dict[str, str] = {}
    for sk in mandatory_skills:
        prov = term_provenance.get(sk, "Explicit requirement from Job Description")
        term_explanations[sk] = f"{sk}: {prov}"
    for sk in preferred_skills:
        prov = term_provenance.get(sk, "Preferred qualification from Job Description")
        term_explanations[sk] = f"{sk}: {prov}"
    for adj in adjacent_skills:
        sk_name = adj["skill"]
        term_explanations[sk_name] = adj["note"]

    # Section 4 Categorized Requirements extraction
    func_skills = [
        s for s in mandatory_skills + preferred_skills
        if s in SKILL_CATALOG and SKILL_CATALOG[s].get("category") in {"Retail & Product Operations", "Business Operations", "Creative & Design", "Media Production"}
    ]
    known_ops_skills = [
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
    for ops_sk in known_ops_skills:
        if re.search(r"\b" + re.escape(ops_sk.lower()) + r"\b", text_lower) and ops_sk not in func_skills:
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
        if any(re.search(pat, text_lower) for pat in patterns) and tool_label not in tools_proficiency:
            tools_proficiency.append(tool_label)

    soft_candidates = [
        "Written Communication", "Verbal Communication", "Organization", "Prioritization",
        "Multitasking", "Attention to Detail", "Adaptability", "Initiative",
        "Problem Solving", "Root Cause Analysis", "Interpersonal Skills", "Flexibility",
        "Active Listening", "Taking Direction", "Learning Agility", "Speed and Execution Orientation",
        "Presentation Skills", "Leadership Presentation",
    ]
    soft_skills = [s for s in soft_candidates if re.search(r"\b" + re.escape(s.lower()) + r"\b", text_lower) or any(w.lower() in text_lower for w in s.split())]

    edu_exp = []
    if re.search(r"\bcollege degree\b", text_lower):
        edu_exp.append("College degree")
    elif re.search(r"\bbachelor\b|\bdegree\b", text_lower):
        edu_exp.append("Bachelor's degree or equivalent experience")
    if re.search(r"\bportfolio\b", text_lower):
        edu_exp.append("Portfolio demonstrating relevant creative work (Target brand expectations)")
    exp_matches = re.findall(r"(\d+(?:\.\d+)?)\s*(?:[-–]|to)\s*(\d+(?:\.\d+)?)\s*(?:yrs|years|yoe)", text, re.I)
    if exp_matches:
        for em in sorted(set(exp_matches)):
            edu_exp.append(f"{em[0]}–{em[1]} years of experience")

    op_constraints = []
    if re.search(r"\bevening shift\b", text_lower):
        op_constraints.append("Evening shift flexibility based on business requirements")
    if re.search(r"\bservice level\b|\bsla\b", text_lower):
        op_constraints.append("Assigned service-level expectations")
    if re.search(r"\bvendor\b|\bmerchant\b", text_lower):
        op_constraints.append("Coordination across teams and external vendors")
    if re.search(r"\bstaff augmentation\b", text_lower):
        op_constraints.append("Staff augmentation support; resources assist with non-core activities")
    if re.search(r"\bproducer\b|\bdesigner\b", text_lower):
        op_constraints.append("Collaboration across Producers, Designers, and external resources")

    categorized_reqs = {
        "functional_domain_skills": func_skills,
        "tools_technical_proficiency": tools_proficiency,
        "behavioral_soft_skills": soft_skills,
        "education_experience": edu_exp,
        "operational_constraints": op_constraints,
    }

    res = {
        "domain": domain_id,
        "domain_label": domain_meta["label"],
        "job_family": domain_meta.get("job_family", "Operations / Business Support" if "operations" in domain_id else "Engineering"),
        "functional_area": domain_meta.get("functional_area", domain_meta["label"]),
        "role_type": domain_meta.get("role_type", "Staff Augmentation / Operational Support" if "operations" in domain_id else "Technical Specialist"),
        "industry": domain_meta.get("industry", domain_meta["label"]),
        "work_environment": domain_meta.get("work_environment", "Cross-functional enterprise teams"),
        "shift_requirement": "Evening shift flexibility based on business requirements" if re.search(r"\bevening shift\b", text_lower) else None,
        "categorized_requirements": categorized_reqs,
        "mandatory_skills": mandatory_skills,
        "preferred_skills": preferred_skills,
        "tools_and_platforms": tools_and_platforms,
        "domain_terms": domain_terms or domain_meta.get("primary_skills", [])[:3],
        "alternative_titles": alternative_titles[:5],
        "adjacent_skills": adjacent_skills[:10],
        "term_provenance": term_provenance,
        "term_explanations": term_explanations,
        "model_used": model_used,
        "extraction_method": extraction_method,
    }
    if len(_SKILL_EXTRACTION_CACHE) >= 100:
        _SKILL_EXTRACTION_CACHE.pop(next(iter(_SKILL_EXTRACTION_CACHE)))
    _SKILL_EXTRACTION_CACHE[cache_key] = copy.deepcopy(res)
    return res
