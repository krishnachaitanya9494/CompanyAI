"""Enterprise Boolean Search Query Generator for CompanyAI Recruitment Intelligence.

Generates platform-aware, evidence-grounded search queries for:
- Naukri Resdex
- LinkedIn Recruiter
- Google X-Ray
- Plain Keywords (Comma, Quoted Space, Pipe)
- Advanced Strategies: Strict AND, Balanced, Broad OR, Domain-Focused, Title-Independent
"""

import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class BooleanStrategyResult(BaseModel):
    """Result for one specific Boolean search strategy or platform."""
    platform: str = Field(..., description="Platform or strategy name")
    platform_label: str = Field(..., description="Human-readable display label")
    query: str = Field(..., description="Formatted Boolean query string")
    compact_query: Optional[str] = Field(default=None, description="Short alternative if standard exceeds limit")
    character_count: int = Field(..., description="Query length in characters")
    character_limit: int = Field(..., description="Maximum allowed characters on platform")
    is_valid: bool = Field(default=True, description="Whether query conforms to platform constraints")
    validation_status: str = Field(default="Valid", description="Platform syntax validation summary")
    strategy_explanation: str = Field(..., description="Rationale and sourcing focus of this strategy")
    included_skills: List[str] = Field(default_factory=list, description="Skills and terms included in query")
    excluded_terms: List[str] = Field(default_factory=list, description="Negative filtering exclusion terms")
    syntax_tips: str = Field(default="", description="Platform-specific tips for recruiters")


class AllBooleanQueriesResponse(BaseModel):
    """Container for all generated Boolean strategies for a job."""
    job_id: Optional[int] = None
    job_title: str
    naukri: BooleanStrategyResult
    linkedin: BooleanStrategyResult
    google_xray: BooleanStrategyResult
    simple_keywords: Dict[str, str]
    advanced_strategies: Dict[str, BooleanStrategyResult]
    adjacent_skills: List[Dict[str, Any]] = Field(default_factory=list, description="Recommended adjacent technologies with provenance")
    term_explanations: Dict[str, str] = Field(default_factory=dict, description="Explanation for why each term was included")
    generation_timestamp: str


def _quote(term: str) -> str:
    """Wrap term in double quotes if it contains whitespace or special punctuation."""
    cleaned = str(term or "").strip().strip('"\'')
    if not cleaned:
        return ""
    if re.search(r"[\s/\-+&()]", cleaned):
        return f'"{cleaned}"'
    return cleaned


def _clean_title_variants(title: str, alternative_titles: Optional[List[str]] = None) -> List[str]:
    """Derive clean, high-signal job title search variants without noise words."""
    variants: List[str] = []

    clean_base = re.sub(r"\s*\(\d+\)\s*$", "", title or "").strip()
    clean_base = re.sub(r"^[,.\s-]+|[,.\s-]+$", "", clean_base).strip()

    def add(t: str):
        if not t:
            return
        t_clean = re.sub(r"\s*\(\d+\)\s*$", "", t).strip()
        t_clean = re.sub(r"^[,.\s-]+|[,.\s-]+$", "", t_clean).strip()
        if t_clean and len(t_clean) >= 3 and t_clean.lower() not in [v.lower() for v in variants]:
            variants.append(t_clean)
        c = re.sub(r"^(?:Senior|Lead|Staff|Principal|Junior|Associate)\s+", "", t_clean, flags=re.I).strip()
        if c and len(c) >= 3 and c.lower() not in [v.lower() for v in variants]:
            variants.append(c)

    if "," in clean_base:
        parts = [p.strip() for p in clean_base.split(",") if p.strip()]
        if len(parts) == 2 and any(kw in parts[1].lower() for kw in ("infrastructure", "engineer", "operations", "cloud", "developer", "architect")):
            add(f"{parts[0]} - {parts[1]}")
            add(f"{parts[1]} {parts[0]}")
            add(parts[1])
        else:
            add(clean_base.replace(",", " - "))
    else:
        add(clean_base)

    sub_parts = re.split(r"[/,|–-]", clean_base)
    for p in sub_parts:
        clean_p = p.strip()
        if len(clean_p) > 3 and not re.search(r"^(?:REQ|JD|\d+)", clean_p):
            add(clean_p)

    if alternative_titles:
        for alt in alternative_titles:
            add(alt)

    return variants[:5]


_SKILL_CLUSTERS: List[Dict[str, Any]] = [
    # VLSI & Silicon
    {"name": "hdl_languages", "skills": {"systemverilog", "verilog", "vhdl"}},
    {"name": "verification_methodologies", "skills": {"uvm", "ovm", "sva", "assertions", "functional coverage"}},
    {"name": "hardware_platforms", "skills": {"fpga", "asic", "do-254"}},
    # CAD & Engineering Design
    {"name": "cad_tools", "skills": {"autocad", "microstation", "autodesk revit", "revit", "cad", "solidworks", "catia", "bluebeam"}},
    {"name": "building_systems", "skills": {"commercial building engineered systems", "commercial building systems", "retail facilities", "construction drawings"}},
    # Cloud & DevOps
    {"name": "cloud_platforms", "skills": {"aws", "azure", "gcp", "google cloud"}},
    {"name": "iac_containers", "skills": {"terraform", "kubernetes", "docker", "ci/cd", "bicep", "arm"}},
    # Enterprise & Integration
    {"name": "sap_integration", "skills": {"sap cpi", "cloud platform integration", "integration suite", "sap integration suite", "sap s/4hana cloud", "sap"}},
    {"name": "integration_scripting", "skills": {"groovy", "rest apis", "xml/xslt", "abap"}},
    # Finance & Accounting
    {"name": "general_ledger_accounting", "skills": {"general ledger", "reconciliation", "month-end close", "balance sheet", "journal entries"}},
    {"name": "tax_compliance", "skills": {"gst", "tds", "form 26as", "tax compliance", "sales and use tax", "sut", "gaap", "ifrs"}},
    # ServiceNow & ITSM
    {"name": "servicenow_platform", "skills": {"servicenow", "flow designer", "business rules", "service portal"}},
    {"name": "fso_operations", "skills": {"fso", "complaint management", "financial services operations"}},
    # Software & Backend
    {"name": "backend_frameworks", "skills": {"java", "spring boot", "python", "fastapi", "microservices"}},
    {"name": "support_engineering", "skills": {"application support", "production support", "production engineer", "incident management", "l2 support", "l3 support"}},
    # Retail & Product Data Operations
    {"name": "item_setup_operations", "skills": {"item setup", "item set up", "product setup", "new item setup", "sku setup", "catalog setup"}},
    {"name": "product_data_quality", "skills": {"product data management", "product data", "item data", "item data management", "master data", "data quality", "data validation", "data remediation"}},
    {"name": "vendor_merchant_coordination", "skills": {"vendor coordination", "vendor management", "supplier coordination", "merchant coordination", "merchandising coordination"}},
    {"name": "retail_operations_merchandising", "skills": {"retail operations", "merchandising", "product operations", "item launch management", "launch readiness", "product launches"}},
    {"name": "office_productivity", "skills": {"excel", "microsoft excel", "outlook", "microsoft outlook"}},
    # Creative & Art Direction
    {"name": "art_direction_creative", "skills": {"art direction", "creative direction", "art direct", "creative director", "art director"}},
    {"name": "advertising_graphic_design", "skills": {"graphic design", "advertising design", "visual design", "communication design", "creative content"}},
    {"name": "adobe_core_tools", "skills": {"adobe illustrator", "illustrator", "adobe photoshop", "photoshop", "adobe indesign", "indesign"}},
    {"name": "motion_3d_tools", "skills": {"adobe after effects", "after effects", "cinema 4d", "autodesk maya", "maya", "smoke", "motion graphics", "3d design"}},
    {"name": "creative_deliverables", "skills": {"storyboarding", "storyboards", "visual storytelling", "packaging design", "packaging", "promotions", "typography", "layout"}},
]


def _group_skills_into_clusters(skills: List[str]) -> List[List[str]]:
    """Partition skills into independent requirement groups; alternatives within a cluster are grouped together."""
    grouped: List[List[str]] = []
    assigned: Set[str] = set()

    for cluster in _SKILL_CLUSTERS:
        cluster_skills = cluster["skills"]
        matched = [s for s in skills if s.lower() in cluster_skills and s.lower() not in assigned]
        if matched:
            grouped.append(matched)
            for m in matched:
                assigned.add(m.lower())

    unassigned = [s for s in skills if s.lower() not in assigned]
    if unassigned:
        grouped.append(unassigned)

    return grouped


def generate_boolean_queries(
    title: str,
    mandatory_skills: Optional[List[str]] = None,
    preferred_skills: Optional[List[str]] = None,
    domain_terms: Optional[List[str]] = None,
    alternative_titles: Optional[List[str]] = None,
    adjacent_skills: Optional[List[Dict[str, Any]]] = None,
    term_explanations: Optional[Dict[str, str]] = None,
    location: Optional[str] = None,
    experience_years: Optional[float] = None,
    target_companies: Optional[List[str]] = None,
    exclusions: Optional[List[str]] = None,
    job_id: Optional[int] = None,
    search_mode: str = "balanced",
) -> AllBooleanQueriesResponse:
    """Generate comprehensive, platform-aware Boolean search queries from structured JD intelligence."""
    from datetime import datetime, timezone

    mand_skills = [s.strip() for s in (mandatory_skills or []) if s.strip()]
    pref_skills = [s.strip() for s in (preferred_skills or []) if s.strip()]
    dom_terms = [d.strip() for d in (domain_terms or []) if d.strip()]
    alt_titles = _clean_title_variants(title, alternative_titles)
    mode = search_mode.lower().strip()
    if mode not in {"broad", "balanced", "strict"}:
        mode = "balanced"

    # Prioritize specialized technical/domain tools over generic office software
    generic_tools = {"excel", "word", "outlook", "powerpoint", "office"}
    mand_skills = sorted(mand_skills, key=lambda s: 1 if s.lower() in generic_tools else 0)

    # Default negative exclusions for professional roles
    default_exclusions = exclusions or ["Intern", "Trainee", "Student", "Fresher"]

    # Build explanations for included terms
    explanations: Dict[str, str] = dict(term_explanations or {})
    for t in alt_titles:
        if t not in explanations:
            explanations[t] = f"Role title variant for {title}"
    for s in mand_skills:
        if s not in explanations:
            explanations[s] = "High-signal mandatory qualification extracted from JD"

    # Separate technical tools vs functional competencies
    tech_tools = [s for s in mand_skills if s.lower() not in generic_tools]
    office_tools = [s for s in mand_skills if s.lower() in generic_tools]

    # Partition technical tools into clusters of alternative skills
    skill_clusters = _group_skills_into_clusters(tech_tools)

    # ----------------------------------------------------
    # 1. NAUKRI RESDEX QUERY (1,000 char limit)
    # Naukri supports standard AND, OR, NOT, parentheses.
    # Balanced mode: (Title variants) AND (Cluster1Alt1 OR Cluster1Alt2) AND (Cluster2Alt1 OR Cluster2Alt2) AND NOT (Intern...)
    # Strict mode: (Title) AND (Core Tool 1) AND (Core Tool 2) AND NOT (Intern...)
    # Broad mode: (Title OR AltTitle OR Tool1 OR Tool2 OR Tool3)
    # ----------------------------------------------------
    naukri_limit = 1000
    naukri_included: List[str] = []

    title_clause = f"({ ' OR '.join(_quote(t) for t in alt_titles[:3]) })" if alt_titles else f"({_quote(title)})"
    naukri_included.extend(alt_titles[:3] or [title])

    excl_clause = f"NOT ({' OR '.join(_quote(e) for e in default_exclusions)})"

    if mode == "broad":
        broad_naukri_terms = [_quote(t) for t in (alt_titles[:2] or [title])] + [_quote(s) for s in tech_tools[:5]]
        naukri_query = f"({' OR '.join(broad_naukri_terms)})"
        naukri_included.extend(tech_tools[:5])
    elif mode == "strict":
        strict_parts = [f"({_quote(alt_titles[0] if alt_titles else title)})"]
        for sk in tech_tools[:3]:
            strict_parts.append(f"({_quote(sk)})")
            naukri_included.append(sk)
        strict_parts.append(excl_clause)
        naukri_query = " AND ".join(strict_parts)
    else:  # balanced
        bal_parts = [title_clause]
        for grp in skill_clusters:
            bal_parts.append(f"({' OR '.join(_quote(s) for s in grp[:4])})")
            naukri_included.extend(grp[:4])
        if dom_terms:
            bal_parts.append(f"({' OR '.join(_quote(d) for d in dom_terms[:2])})")
            naukri_included.extend(dom_terms[:2])
        if office_tools and len(bal_parts) <= 3:
            bal_parts.append(f"({' OR '.join(_quote(o) for o in office_tools[:2])})")
            naukri_included.extend(office_tools[:2])
        bal_parts.append(excl_clause)
        naukri_query = " AND ".join(bal_parts)

    # Ensure query strictly respects portal character limit
    if len(naukri_query) > naukri_limit:
        bal_parts_compact = [f"({_quote(alt_titles[0] if alt_titles else title)})"]
        for grp in skill_clusters[:2]:
            bal_parts_compact.append(f"({' OR '.join(_quote(s) for s in grp[:2])})")
        bal_parts_compact.append(excl_clause)
        naukri_query = " AND ".join(bal_parts_compact)

    naukri_result = BooleanStrategyResult(
        platform="naukri",
        platform_label="Naukri Resdex",
        query=naukri_query,
        compact_query=None,
        character_count=len(naukri_query),
        character_limit=naukri_limit,
        is_valid=len(naukri_query) <= naukri_limit,
        validation_status="Valid" if len(naukri_query) <= naukri_limit else f"Exceeds Limit by {len(naukri_query) - naukri_limit} chars",
        strategy_explanation=(
            f"Combines role title variants with mandatory technical skills ({', '.join(tech_tools[:3]) or ', '.join(mand_skills[:3])}) "
            f"in {mode.capitalize()} mode without forcing non-essential keyword conjunctions."
        ),
        included_skills=list(dict.fromkeys(naukri_included)),
        excluded_terms=default_exclusions,
        syntax_tips="In Naukri Resdex, paste directly into 'Keyskills' or 'Search Keywords'. Location and experience are best applied using portal filters.",
    )

    # ----------------------------------------------------
    # 2. LINKEDIN RECRUITER QUERY (1,500 char limit)
    # ----------------------------------------------------
    linkedin_limit = 1500
    li_included: List[str] = []

    li_title_clause = f"({ ' OR '.join(_quote(t) for t in alt_titles[:4]) })" if alt_titles else f"({_quote(title)})"
    li_included.extend(alt_titles[:4] or [title])

    if mode == "broad":
        li_terms = [_quote(t) for t in (alt_titles[:3] or [title])] + [_quote(s) for s in tech_tools[:6]]
        li_query = f"({' OR '.join(li_terms)})"
        li_included.extend(tech_tools[:6])
    elif mode == "strict":
        li_parts = [f"({_quote(alt_titles[0] if alt_titles else title)})"]
        for s in tech_tools[:3]:
            li_parts.append(f"({_quote(s)})")
            li_included.append(s)
        li_query = " ".join(li_parts)
    else:  # balanced
        li_parts = [li_title_clause]
        for grp in skill_clusters:
            li_parts.append(f"({' OR '.join(_quote(s) for s in grp[:4])})")
            li_included.extend(grp[:4])
        if pref_skills:
            li_parts.append(f"({' OR '.join(_quote(p) for p in pref_skills[:2])})")
            li_included.extend(pref_skills[:2])
        if office_tools and len(li_parts) <= 3:
            li_parts.append(f"({' OR '.join(_quote(o) for o in office_tools[:2])})")
            li_included.extend(office_tools[:2])
        li_query = " ".join(li_parts)

    if len(li_query) > linkedin_limit:
        li_parts_compact = [f"({_quote(alt_titles[0] if alt_titles else title)})"]
        for grp in skill_clusters[:2]:
            li_parts_compact.append(f"({' OR '.join(_quote(s) for s in grp[:2])})")
        li_query = " ".join(li_parts_compact)

    linkedin_result = BooleanStrategyResult(
        platform="linkedin",
        platform_label="LinkedIn Recruiter",
        query=li_query,
        compact_query=None,
        character_count=len(li_query),
        character_limit=linkedin_limit,
        is_valid=len(li_query) <= linkedin_limit,
        validation_status="Valid",
        strategy_explanation=(
            "Optimized for LinkedIn Recruiter keyword box. Groups role titles with alternative tool skills "
            "to maximize qualified talent match."
        ),
        included_skills=list(dict.fromkeys(li_included)),
        excluded_terms=[],
        syntax_tips="Paste into the LinkedIn Recruiter 'Keywords' field. Use 'Job Titles' facet for titles to increase precision.",
    )

    # ----------------------------------------------------
    # 3. GOOGLE X-RAY SEARCH (2,048 char / 32 words limit)
    # site:linkedin.com/in ("title1" OR "title2") ("skill1" OR "skill2")
    # ----------------------------------------------------
    xray_limit = 2048
    xray_included: List[str] = []

    xray_titles = f"({ ' OR '.join(_quote(t) for t in alt_titles[:2]) })" if alt_titles else _quote(title)
    xray_included.extend(alt_titles[:2] or [title])

    xray_skills = tech_tools[:4] if tech_tools else mand_skills[:4]
    xray_skill_clause = f"({' OR '.join(_quote(s) for s in xray_skills)})" if xray_skills else ""
    xray_included.extend(xray_skills)

    xray_loc_clause = ""
    if location:
        clean_loc = re.split(r"[/,&]", location)[0].strip()
        if clean_loc and not re.search(r"remote|hybrid", clean_loc, re.I):
            xray_loc_clause = f" {_quote(clean_loc)}"

    if mode == "broad":
        xray_query = f'site:linkedin.com/in ({xray_titles} OR {xray_skill_clause.strip("()")}){xray_loc_clause} -intitle:"profiles" -inurl:"dir/"'
    elif mode == "strict":
        strict_skills_str = " ".join(_quote(s) for s in xray_skills[:2])
        xray_query = f'site:linkedin.com/in {xray_titles} {strict_skills_str}{xray_loc_clause} -intitle:"profiles" -inurl:"dir/"'
    else:  # balanced
        bal_xray_clauses = ["site:linkedin.com/in", xray_titles]
        for grp in skill_clusters[:2]:
            bal_xray_clauses.append(f"({' OR '.join(_quote(s) for s in grp[:3])})")
        if xray_loc_clause:
            bal_xray_clauses.append(xray_loc_clause.strip())
        bal_xray_clauses.append('-intitle:"profiles" -inurl:"dir/"')
        xray_query = " ".join(bal_xray_clauses)

    google_xray_result = BooleanStrategyResult(
        platform="google_xray",
        platform_label="Google X-Ray (LinkedIn)",
        query=xray_query,
        compact_query=None,
        character_count=len(xray_query),
        character_limit=xray_limit,
        is_valid=len(xray_query) <= xray_limit,
        validation_status="Valid",
        strategy_explanation=(
            "Direct public web sourcing query that bypasses LinkedIn search limits. "
            "Filters for genuine member profiles while omitting directory and aggregator pages."
        ),
        included_skills=list(dict.fromkeys(xray_included)),
        excluded_terms=["profiles", "dir/"],
        syntax_tips="Paste directly into Google Search bar. You can replace site:linkedin.com/in with site:in.linkedin.com/in to focus strictly on India profiles.",
    )

    # ----------------------------------------------------
    # 4. PLAIN KEYWORDS
    # ----------------------------------------------------
    distinct_keywords: List[str] = []
    for item in alt_titles[:2] + tech_tools[:6] + office_tools[:2] + dom_terms[:2]:
        c = item.strip()
        if c and c.lower() not in [k.lower() for k in distinct_keywords]:
            distinct_keywords.append(c)

    simple_keywords = {
        "comma": ", ".join(distinct_keywords),
        "quoted_space": " ".join(_quote(k) for k in distinct_keywords),
        "pipe": " | ".join(distinct_keywords),
    }

    # ----------------------------------------------------
    # 5. ADVANCED STRATEGIES
    # ----------------------------------------------------
    # A. Strict AND (Highest Precision)
    strict_terms = [_quote(t) for t in (alt_titles[:1] or [title]) + tech_tools[:3] + dom_terms[:1]]
    strict_query = " AND ".join(strict_terms) if strict_terms else _quote(title)
    strict_and = BooleanStrategyResult(
        platform="strict_and",
        platform_label="Strict Precision (AND Strategy)",
        query=strict_query,
        character_count=len(strict_query),
        character_limit=1000,
        is_valid=True,
        validation_status="Valid",
        strategy_explanation="Requires 100% of core skills and domain terms simultaneously. Best when talent supply is large.",
        included_skills=distinct_keywords[:5],
        excluded_terms=[],
        syntax_tips="Use when receiving too many irrelevant applicants to isolate exact matches.",
    )

    # B. Balanced Search (Best for Talent Sourcing)
    balanced_query = naukri_query
    balanced = BooleanStrategyResult(
        platform="balanced",
        platform_label="Balanced Sourcing Strategy",
        query=balanced_query,
        character_count=len(balanced_query),
        character_limit=1000,
        is_valid=len(balanced_query) <= 1000,
        validation_status="Valid" if len(balanced_query) <= 1000 else "Warning",
        strategy_explanation="Optimal balance of precision and recall. Pairs title alternatives with mandatory skill clusters.",
        included_skills=naukri_included,
        excluded_terms=default_exclusions,
        syntax_tips="Recommended default for standard portal candidate outreach.",
    )

    # C. Broad OR (Maximum Recall)
    broad_terms = [_quote(t) for t in (alt_titles[:3] or [title]) + tech_tools[:4]]
    broad_query = f"({' OR '.join(broad_terms)})"
    broad_or = BooleanStrategyResult(
        platform="broad_or",
        platform_label="Broad Recall (OR Strategy)",
        query=broad_query,
        character_count=len(broad_query),
        character_limit=1000,
        is_valid=True,
        validation_status="Valid",
        strategy_explanation="Broad net for niche technologies where candidates may list varying titles or skills.",
        included_skills=alt_titles[:3] + tech_tools[:4],
        excluded_terms=[],
        syntax_tips="Use when recruiting for rare skills where strict AND returns zero candidates.",
    )

    # D. Domain-Focused Strategy
    dom_clauses: List[str] = []
    if dom_terms:
        dom_clauses.append(f"({' OR '.join(_quote(d) for d in dom_terms)})")
    if tech_tools:
        dom_clauses.append(f"({' OR '.join(_quote(s) for s in tech_tools[:3])})")
    domain_query = " AND ".join(dom_clauses) if dom_clauses else broad_query
    domain_focused = BooleanStrategyResult(
        platform="domain_focused",
        platform_label="Domain & Process Focused Strategy",
        query=domain_query,
        character_count=len(domain_query),
        character_limit=1000,
        is_valid=True,
        validation_status="Valid",
        strategy_explanation="Emphasizes business domain knowledge, workflows, and industry-specific processes.",
        included_skills=dom_terms + tech_tools[:3],
        excluded_terms=[],
        syntax_tips="Best for targeting candidates from identical industry backgrounds.",
    )

    # E. Title-Independent Skill Strategy
    skill_clauses = [_quote(s) for s in tech_tools[:5]] if tech_tools else [_quote(s) for s in mand_skills[:5]]
    title_indep_query = f"({' AND '.join(skill_clauses)})" if skill_clauses else broad_query
    title_independent = BooleanStrategyResult(
        platform="title_independent",
        platform_label="Title-Independent Skill Strategy",
        query=title_indep_query,
        character_count=len(title_indep_query),
        character_limit=1000,
        is_valid=True,
        validation_status="Valid",
        strategy_explanation="Ignores job titles entirely to capture engineers with non-standard job titles who possess the skills.",
        included_skills=tech_tools[:5] if tech_tools else mand_skills[:5],
        excluded_terms=[],
        syntax_tips="Captures strong practitioners whose corporate job title does not match your requisition.",
    )

    advanced_map = {
        "strict_and": strict_and,
        "balanced": balanced,
        "broad_or": broad_or,
        "domain_focused": domain_focused,
        "title_independent": title_independent,
    }

    return AllBooleanQueriesResponse(
        job_id=job_id,
        job_title=title,
        naukri=naukri_result,
        linkedin=linkedin_result,
        google_xray=google_xray_result,
        simple_keywords=simple_keywords,
        advanced_strategies=advanced_map,
        adjacent_skills=adjacent_skills or [],
        term_explanations=explanations,
        generation_timestamp=datetime.now(timezone.utc).isoformat(),
    )


def customize_boolean_query_conversationally(
    title: str,
    instruction: str,
    mandatory_skills: Optional[List[str]] = None,
    preferred_skills: Optional[List[str]] = None,
    domain_terms: Optional[List[str]] = None,
    alternative_titles: Optional[List[str]] = None,
    adjacent_skills: Optional[List[Dict[str, Any]]] = None,
    location: Optional[str] = None,
    experience_years: Optional[float] = None,
    target_companies: Optional[List[str]] = None,
    exclusions: Optional[List[str]] = None,
    job_id: Optional[int] = None,
    search_mode: str = "balanced",
) -> Dict[str, Any]:
    """Apply conversational recruiter instructions to adjust search parameters while strictly preserving deterministic validation."""
    from app.ai.providers.chat_provider import chat_provider

    inst = (instruction or "").strip().lower()
    mand = list(mandatory_skills or [])
    pref = list(preferred_skills or [])
    excl = list(exclusions or ["Intern", "Trainee", "Student", "Fresher"])
    alt_titles = list(alternative_titles or [])
    cos = list(target_companies or [])
    mode = search_mode
    explanation = "Adjusted query based on recruiter instruction."

    # Heuristic fast-path for common recruiter commands
    if "broader" in inst or "broad" in inst or "expand" in inst:
        mode = "broad"
        explanation = "Expanded Boolean query into broad OR mode to maximize candidate discovery reach."
    elif "strict" in inst or "narrow" in inst or "tight" in inst or "exact" in inst:
        mode = "strict"
        explanation = "Constrained query into strict AND mode requiring exact core tool qualifications."
    elif "balanced" in inst or "reset" in inst:
        mode = "balanced"
        explanation = "Reset query strategy to balanced hybrid targeting title variants and tool clusters."

    if "intern" in inst or "trainee" in inst or "fresher" in inst:
        for t in ["Intern", "Trainee", "Student", "Fresher"]:
            if t not in excl:
                excl.append(t)
        explanation += " Added negative filters for interns and trainees."

    if "senior" in inst or "lead" in inst or "experienced" in inst:
        for t in ["Senior", "Lead", "Principal", "Staff"]:
            t_comb = f"{t} {title}"
            if t_comb not in alt_titles:
                alt_titles.insert(0, t_comb)
        explanation += " Prioritized senior and lead title variants."

    if "reduce mandatory" in inst or "relax mandatory" in inst or "less mandatory" in inst or "fewer software" in inst:
        if len(mand) > 2:
            moved = mand.pop()
            if moved not in pref:
                pref.append(moved)
            explanation += f" Relaxed mandatory requirement '{moved}' to preferred qualifications."

    # Pattern match for "include X" or "focus on X" or "candidates from X"
    include_match = re.search(r"(?:include|add|focus on|experience with|candidates with)\s+([a-zA-Z0-9\s\.\+#\-_/]+)", inst)
    if include_match:
        added_term = include_match.group(1).strip().title()
        cleaned_term = re.sub(r"^(?:Candidates|Experience|Profiles|People)\s+(?:With|From)\s+", "", added_term, flags=re.I).strip()
        if cleaned_term and len(cleaned_term) >= 2 and cleaned_term.lower() not in [m.lower() for m in mand]:
            mand.append(cleaned_term)
            explanation += f" Included '{cleaned_term}' in search parameters."

    # If instruction is complex and local Ollama is available, let AI refine parameters intelligently
    if len(inst) > 10 and chat_provider.is_available() and not any(k in inst for k in ["broad", "strict", "balanced"]):
        try:
            ai_prompt = (
                f"You are a recruitment Boolean search optimizer.\n"
                f"Current Job: {title}\n"
                f"Current Mandatory Skills: {mand}\n"
                f"Current Preferred Skills: {pref}\n"
                f"Current Exclusions: {excl}\n"
                f"Recruiter Instruction: \"{instruction}\"\n\n"
                f"Return JSON:\n"
                f"{{\n"
                f'  "updated_mandatory": ["string"],\n'
                f'  "updated_preferred": ["string"],\n'
                f'  "updated_exclusions": ["string"],\n'
                f'  "search_mode": "balanced" | "strict" | "broad",\n'
                f'  "explanation": "concise explanation of what was changed"\n'
                f"}}"
            )
            ai_res = chat_provider.extract_json(
                prompt=ai_prompt,
                system_prompt="You optimize Boolean recruitment search parameters. Return valid JSON only.",
            )
            if ai_res and isinstance(ai_res, dict):
                if ai_res.get("updated_mandatory"):
                    mand = [str(s).strip() for s in ai_res["updated_mandatory"] if str(s).strip()]
                if ai_res.get("updated_preferred"):
                    pref = [str(s).strip() for s in ai_res["updated_preferred"] if str(s).strip()]
                if ai_res.get("updated_exclusions"):
                    excl = [str(s).strip() for s in ai_res["updated_exclusions"] if str(s).strip()]
                if ai_res.get("search_mode") in {"broad", "strict", "balanced"}:
                    mode = ai_res["search_mode"]
                if ai_res.get("explanation"):
                    explanation = str(ai_res["explanation"]).strip()
        except Exception:
            pass

    # Pass the AI-refined parameters through the deterministic query builder & validator
    new_queries = generate_boolean_queries(
        title=title,
        mandatory_skills=mand,
        preferred_skills=pref,
        domain_terms=domain_terms,
        alternative_titles=alt_titles,
        adjacent_skills=adjacent_skills,
        location=location,
        experience_years=experience_years,
        target_companies=cos,
        exclusions=excl,
        job_id=job_id,
        search_mode=mode,
    )
    result_dict = new_queries.model_dump()
    result_dict["customization_explanation"] = explanation
    result_dict["explanation"] = explanation
    result_dict["customization_applied"] = explanation
    result_dict["customized_query"] = result_dict.get("naukri", {}).get("query", "")
    result_dict["custom_mandatory"] = mand
    result_dict["custom_preferred"] = pref
    result_dict["custom_exclusions"] = excl
    result_dict["search_mode"] = mode
    return result_dict
