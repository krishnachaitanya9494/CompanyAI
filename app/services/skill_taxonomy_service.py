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
        "aliases": ["sap cloud platform integration", "sap integration suite", "cpi"],
        "adjacent": ["SAP", "REST APIs", "XML/XSLT"],
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
