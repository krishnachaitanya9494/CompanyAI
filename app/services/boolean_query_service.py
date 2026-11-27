"""Enterprise Boolean Search Query Generator for CompanyAI Recruitment Intelligence.

Generates platform-aware, evidence-grounded search queries for:
- Naukri Resdex
- LinkedIn Recruiter
- Google X-Ray
- Plain Keywords (Comma, Quoted Space, Pipe)
- Advanced Strategies: Strict AND, Balanced, Broad OR, Domain-Focused, Title-Independent
"""

import re
from typing import Any, Dict, List, Optional, Set, Tuple
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


def _dedupe_terms(terms: Optional[List[str]]) -> List[str]:
    """Deduplicate keyword strings case-insensitively while preserving order."""
    seen: Set[str] = set()
    out: List[str] = []
    for raw in terms or []:
        cleaned = str(raw or "").strip().strip('"\'')
        low = cleaned.lower()
        if cleaned and low not in seen:
            seen.add(low)
            out.append(cleaned)
    return out


def validate_boolean_query(query: str, character_limit: int) -> Tuple[bool, str, List[str]]:
    """Deterministically validate Boolean syntax: parentheses, quotes, operators, and length."""
    warnings: List[str] = []
    q = (query or "").strip()
    if not q:
        return False, "Invalid: Empty query", ["Query is empty."]

    # Check balanced parentheses.
    depth = 0
    for ch in q:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth < 0:
                warnings.append("Unmatched closing parenthesis ')'.")
                break
    if depth > 0:
        warnings.append("Unclosed opening parenthesis '('.")

    # Check balanced double quotation marks.
    if q.count('"') % 2 != 0:
        warnings.append('Unbalanced quotation marks (").')

    # Check operator placement (no leading/trailing binary operators or adjacent operators).
    if re.match(r"^(?:AND|OR)\b", q) or re.search(r"\b(?:AND|OR|NOT)$", q):
        warnings.append("Dangling Boolean operator at start or end of query.")
    if re.search(r"\b(?:AND|OR)\s+(?:AND|OR)\b", q) or re.search(r"\bNOT\s+(?:AND|OR)\b", q):
        warnings.append("Adjacent Boolean operators detected.")

    if len(q) > character_limit:
        warnings.append(f"Exceeds platform limit ({len(q)}/{character_limit} chars).")

    is_valid = len(warnings) == 0
    status = "Valid" if is_valid else "; ".join(warnings)
    return is_valid, status, warnings


def _resolve_contradictions(
    included: List[str],
    excluded: List[str],
    mandatory_jd: List[str],
) -> Tuple[List[str], List[str], List[str]]:
    """Prevent contradictory inclusion and exclusion terms while protecting mandatory JD skills."""
    mand_lower = {s.lower() for s in mandatory_jd}
    inc_lower = {s.lower() for s in included}
    warnings: List[str] = []
    clean_excl: List[str] = []

    for ex in _dedupe_terms(excluded):
        low = ex.lower()
        if low in mand_lower:
            warnings.append(f"Kept mandatory JD skill '{ex}' and skipped excluding it.")
            continue
        if low in inc_lower:
            warnings.append(f"Removed '{ex}' from exclusions because it is in included search terms.")
            continue
        clean_excl.append(ex)

    return _dedupe_terms(included), clean_excl, warnings


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
    industries: Optional[List[str]] = None,
    experience_preference: Optional[str] = None,
) -> AllBooleanQueriesResponse:
    """Generate comprehensive, platform-aware Boolean search queries from structured JD intelligence."""
    from datetime import datetime, timezone

    mand_skills = _dedupe_terms(mandatory_skills)
    pref_skills = _dedupe_terms(preferred_skills)
    dom_terms = _dedupe_terms(domain_terms)
    ind_terms = _dedupe_terms(industries)
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

    excl_clause = f"NOT ({' OR '.join(_quote(e) for e in default_exclusions)})" if default_exclusions else ""
    ind_clause = f"({' OR '.join(_quote(i) for i in ind_terms[:4])})" if ind_terms else ""
    pref_or_clause = f"({' OR '.join(_quote(p) for p in pref_skills[:4])})" if pref_skills else ""

    if mode == "broad":
        # Preserve core mandatory requirements while broadening titles, related skills, and industries.
        broad_parts = [title_clause]
        core_mand = tech_tools[:3] or mand_skills[:3]
        broad_pool = _dedupe_terms(core_mand + pref_skills[:3])
        if broad_pool:
            broad_parts.append(f"({' OR '.join(_quote(s) for s in broad_pool)})")
            naukri_included.extend(broad_pool)
        if ind_clause:
            broad_parts.append(ind_clause)
            naukri_included.extend(ind_terms[:4])
        if excl_clause:
            broad_parts.append(excl_clause)
        naukri_query = " AND ".join(broad_parts)
    elif mode == "strict":
        strict_parts = [f"({_quote(alt_titles[0] if alt_titles else title)})"]
        for sk in (tech_tools[:3] or mand_skills[:3]):
            strict_parts.append(f"({_quote(sk)})")
            naukri_included.append(sk)
        if excl_clause:
            strict_parts.append(excl_clause)
        naukri_query = " AND ".join(strict_parts)
    else:  # balanced
        bal_parts = [title_clause]
        for grp in skill_clusters:
            bal_parts.append(f"({' OR '.join(_quote(s) for s in grp[:4])})")
            naukri_included.extend(grp[:4])
        if ind_clause:
            bal_parts.append(ind_clause)
            naukri_included.extend(ind_terms[:4])
        elif dom_terms:
            bal_parts.append(f"({' OR '.join(_quote(d) for d in dom_terms[:2])})")
            naukri_included.extend(dom_terms[:2])
        if office_tools and len(bal_parts) <= 3:
            bal_parts.append(f"({' OR '.join(_quote(o) for o in office_tools[:2])})")
            naukri_included.extend(office_tools[:2])
        if excl_clause:
            bal_parts.append(excl_clause)
        naukri_query = " AND ".join(bal_parts)

    # Intelligently simplify if query exceeds Naukri's 1,000 char limit while preserving core intent.
    if len(naukri_query) > naukri_limit:
        bal_parts_compact = [f"({_quote(alt_titles[0] if alt_titles else title)})"]
        for grp in skill_clusters[:2]:
            bal_parts_compact.append(f"({' OR '.join(_quote(s) for s in grp[:2])})")
        if excl_clause:
            bal_parts_compact.append(excl_clause)
        naukri_query = " AND ".join(bal_parts_compact)

    naukri_valid, naukri_status, _ = validate_boolean_query(naukri_query, naukri_limit)

    naukri_result = BooleanStrategyResult(
        platform="naukri",
        platform_label="Naukri Resdex",
        query=naukri_query,
        compact_query=None,
        character_count=len(naukri_query),
        character_limit=naukri_limit,
        is_valid=naukri_valid,
        validation_status=naukri_status,
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

    li_excl_clause = f"NOT ({' OR '.join(_quote(e) for e in default_exclusions)})" if default_exclusions else ""

    if mode == "broad":
        li_parts = [li_title_clause]
        li_pool = _dedupe_terms((tech_tools[:4] or mand_skills[:4]) + pref_skills[:3])
        if li_pool:
            li_parts.append(f"({' OR '.join(_quote(s) for s in li_pool)})")
            li_included.extend(li_pool)
        if ind_clause:
            li_parts.append(ind_clause)
            li_included.extend(ind_terms[:4])
        if li_excl_clause:
            li_parts.append(li_excl_clause)
        li_query = " AND ".join(li_parts)
    elif mode == "strict":
        li_parts = [f"({_quote(alt_titles[0] if alt_titles else title)})"]
        for s in (tech_tools[:3] or mand_skills[:3]):
            li_parts.append(f"({_quote(s)})")
            li_included.append(s)
        if li_excl_clause:
            li_parts.append(li_excl_clause)
        li_query = " AND ".join(li_parts)
    else:  # balanced
        li_parts = [li_title_clause]
        for grp in skill_clusters:
            li_parts.append(f"({' OR '.join(_quote(s) for s in grp[:4])})")
            li_included.extend(grp[:4])
        if pref_or_clause:
            li_parts.append(pref_or_clause)
            li_included.extend(pref_skills[:4])
        if ind_clause:
            li_parts.append(ind_clause)
            li_included.extend(ind_terms[:4])
        if office_tools and len(li_parts) <= 3:
            li_parts.append(f"({' OR '.join(_quote(o) for o in office_tools[:2])})")
            li_included.extend(office_tools[:2])
        if li_excl_clause:
            li_parts.append(li_excl_clause)
        li_query = " AND ".join(li_parts)

    if len(li_query) > linkedin_limit:
        li_parts_compact = [f"({_quote(alt_titles[0] if alt_titles else title)})"]
        for grp in skill_clusters[:2]:
            li_parts_compact.append(f"({' OR '.join(_quote(s) for s in grp[:2])})")
        if li_excl_clause:
            li_parts_compact.append(li_excl_clause)
        li_query = " AND ".join(li_parts_compact)

    li_valid, li_status, _ = validate_boolean_query(li_query, linkedin_limit)

    linkedin_result = BooleanStrategyResult(
        platform="linkedin",
        platform_label="LinkedIn Recruiter",
        query=li_query,
        compact_query=None,
        character_count=len(li_query),
        character_limit=linkedin_limit,
        is_valid=li_valid,
        validation_status=li_status,
        strategy_explanation=(
            "Optimized for LinkedIn Recruiter keyword box. Groups role titles with alternative tool skills "
            "to maximize qualified talent match."
        ),
        included_skills=list(dict.fromkeys(li_included)),
        excluded_terms=default_exclusions,
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

    xray_ind_clause = f"({' OR '.join(_quote(i) for i in ind_terms[:3])})" if ind_terms else ""
    if ind_terms:
        xray_included.extend(ind_terms[:3])

    xray_loc_clause = ""
    if location:
        clean_loc = re.split(r"[/,&]", location)[0].strip()
        if clean_loc and not re.search(r"remote|hybrid", clean_loc, re.I):
            xray_loc_clause = f" {_quote(clean_loc)}"

    if mode == "broad":
        xray_parts = ["site:linkedin.com/in", xray_titles]
        if xray_skill_clause:
            xray_parts.append(xray_skill_clause)
        if xray_ind_clause:
            xray_parts.append(xray_ind_clause)
        if xray_loc_clause:
            xray_parts.append(xray_loc_clause.strip())
        xray_parts.append('-intitle:"profiles" -inurl:"dir/"')
        xray_query = " ".join(xray_parts)
    elif mode == "strict":
        strict_skills_str = " ".join(_quote(s) for s in xray_skills[:2])
        xray_query = f'site:linkedin.com/in {xray_titles} {strict_skills_str}{xray_loc_clause} -intitle:"profiles" -inurl:"dir/"'.strip()
    else:  # balanced
        bal_xray_clauses = ["site:linkedin.com/in", xray_titles]
        for grp in skill_clusters[:2]:
            bal_xray_clauses.append(f"({' OR '.join(_quote(s) for s in grp[:3])})")
        if xray_ind_clause:
            bal_xray_clauses.append(xray_ind_clause)
        if xray_loc_clause:
            bal_xray_clauses.append(xray_loc_clause.strip())
        bal_xray_clauses.append('-intitle:"profiles" -inurl:"dir/"')
        xray_query = " ".join(bal_xray_clauses)

    xray_valid, xray_status, _ = validate_boolean_query(xray_query, xray_limit)

    google_xray_result = BooleanStrategyResult(
        platform="google_xray",
        platform_label="Google X-Ray (LinkedIn)",
        query=xray_query,
        compact_query=None,
        character_count=len(xray_query),
        character_limit=xray_limit,
        is_valid=xray_valid,
        validation_status=xray_status,
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


_KNOWN_LOCATIONS = {
    "bangalore", "bengaluru", "pune", "mumbai", "hyderabad", "chennai",
    "delhi", "new delhi", "ncr", "delhi ncr", "gurugram", "gurgaon",
    "noida", "kolkata", "ahmedabad", "kochi", "jaipur", "chandigarh",
    "india", "remote", "hybrid",
}

_INDUSTRY_KEYWORDS = (
    "manufacturing", "it services", "software services", "retail", "automotive",
    "pharma", "pharmaceutical", "banking", "fintech", "healthcare", "telecom",
    "ecommerce", "e-commerce", "consulting", "supply chain", "logistics",
    "aerospace", "semiconductor", "insurance", "fmcg", "media", "advertising",
)


def _deterministic_interpret_instruction(
    title: str,
    instruction: str,
    mand: List[str],
    pref: List[str],
    excl: List[str],
    alt_titles: List[str],
    location: Optional[str],
    mode: str,
) -> Dict[str, Any]:
    """Deterministic fallback parser when local Ollama is offline or unavailable.

    Extracts Location, Experience, Exclusions, Industries, and Skills in separate
    passes and strips matched spans so location or sentence fragments never leak into skills.
    """
    inst = (instruction or "").strip()
    inst_low = inst.lower()
    working = inst
    exp_pref = ""
    loc_pref = location or ""
    industries: List[str] = []
    related_skills: List[str] = []
    notes: List[str] = []

    if any(k in inst_low for k in ("broader", "broad", "expand", "adjacent")):
        mode = "broad"
        notes.append("Set mode to Broad while preserving mandatory JD skills.")
    elif any(k in inst_low for k in ("strict", "narrow", "tight", "exact")):
        mode = "strict"
        notes.append("Set mode to Strict for exact requirement matching.")
    elif "balanced" in inst_low or "reset" in inst_low:
        mode = "balanced"
        notes.append("Set mode to Balanced.")

    # 1. Extract and strip location phrases FIRST so city names never mix with skills.
    loc_pattern = re.compile(
        r"\b(?:(?:in|at|from|location|based in|focus on|prioritize)\s+)?"
        r"(bangalore|bengaluru|pune|mumbai|hyderabad|chennai|new delhi|delhi ncr|delhi|gurugram|gurgaon|noida|kolkata|ahmedabad|kochi|jaipur|chandigarh|india|remote)\b",
        re.I,
    )
    for m in loc_pattern.finditer(working):
        loc_pref = m.group(1).strip().title()
        notes.append(f"Captured location: {loc_pref}.")
    working = loc_pattern.sub(" ", working)

    # 2. Extract and strip experience requirements.
    exp_pattern = re.compile(r"\b(\d{1,2}\s?(?:\+|[-–to]+\s?\d{1,2})\s?(?:years?|yrs?))\b(?:\s+of\s+experience|\s+experience)?", re.I)
    exp_m = exp_pattern.search(working)
    if exp_m:
        exp_pref = exp_m.group(1).strip()
        notes.append(f"Captured experience: {exp_pref}.")
        working = exp_pattern.sub(" ", working)
    elif any(k in inst_low for k in ("senior", "lead", "principal")):
        exp_pref = "Senior / Lead"
        for prefix in ("Senior", "Lead"):
            cand = f"{prefix} {title}".strip()
            if cand.lower() not in {a.lower() for a in alt_titles}:
                alt_titles.insert(0, cand)
        notes.append("Prioritized Senior/Lead title variants.")

    # 3. Extract and strip explicit exclusions (e.g., "avoid freshers", "exclude interns").
    excl_pattern = re.compile(
        r"\b(?:avoid|exclude|without|no)\s+([a-zA-Z0-9\s\.\+#\-_/]{2,40}?)(?=[,.;]|\band\b|\bwith\b|\bfocus\b|\binclude\b|$)",
        re.I,
    )
    for m in excl_pattern.finditer(working):
        for part in re.split(r"\s+and\s+|,", m.group(1), flags=re.I):
            cleaned = part.strip(" .")
            if cleaned and len(cleaned) >= 2 and cleaned.lower() not in _KNOWN_LOCATIONS:
                if cleaned.lower() not in {e.lower() for e in excl}:
                    excl.append(cleaned.title())
                    notes.append(f"Excluded '{cleaned.title()}'.")
    working = excl_pattern.sub(" ", working)

    if any(k in inst_low for k in ("fresher", "freshers", "intern", "trainee")):
        for t in ["Intern", "Trainee", "Student", "Fresher"]:
            if t.lower() not in {e.lower() for e in excl}:
                excl.append(t)

    # 4. Extract explicit industry preferences cleanly.
    for ind_kw in _INDUSTRY_KEYWORDS:
        if re.search(rf"\b{re.escape(ind_kw)}\b", working, re.I):
            label = "IT Services" if ind_kw == "it services" else ind_kw.title()
            if label.lower() not in {i.lower() for i in industries}:
                industries.append(label)
            working = re.sub(rf"\b{re.escape(ind_kw)}\b(?:\s+companies|\s+industry|\s+industries|\s+sector)?", " ", working, flags=re.I)

    # 5. Extract clean skill tokens from remaining explicit skill clauses; skip ambiguous phrases.
    skill_pattern = re.compile(
        r"(?:focus on|prioritize|experience with|experience in|skills?\s*(?:like|such as|:)|with|include)\s+([a-zA-Z0-9\s\.\+#\-_/&]{2,50}?)(?=[,.;]|\b(?:experience|candidates?|profiles?|people|companies|background|backgrounds|industry|industries)\b|$)",
        re.I,
    )
    noise_words = {"find", "candidates", "candidate", "profiles", "people", "experience", "background", "backgrounds", "companies", "company", "industry", "industries", "with", "from", "having", "focus", "include", "and", "or", "the", "for"}
    for m in skill_pattern.finditer(working):
        for tok in re.split(r"\s+and\s+|,", m.group(1), flags=re.I):
            cleaned = re.sub(r"^(?:candidates?|profiles?|people|experience)\s+(?:with|in|from)\s+", "", tok.strip(), flags=re.I).strip(" .")
            words = [w for w in cleaned.split() if w]
            low = cleaned.lower()
            if not cleaned or len(cleaned) < 2 or len(words) > 3:
                continue
            if low in _KNOWN_LOCATIONS or any(w.lower() in noise_words for w in words):
                continue
            if low not in {s.lower() for s in mand} and low not in {i.lower() for i in industries}:
                related_skills.append(cleaned)

    return {
        "target_titles": _dedupe_terms(alt_titles[:5] or [title]),
        "alternative_titles": _dedupe_terms(alt_titles),
        "required_skills": _dedupe_terms(mand),
        "related_skills": _dedupe_terms(pref + related_skills),
        "industries": _dedupe_terms(industries),
        "experience_preference": exp_pref,
        "location_preference": loc_pref,
        "exclusions": _dedupe_terms(excl),
        "search_mode": mode,
        "explanation": " ".join(notes) if notes else "Applied deterministic keyword interpretation.",
    }


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
    custom_titles: Optional[List[str]] = None,
    custom_related_skills: Optional[List[str]] = None,
    custom_industries: Optional[List[str]] = None,
    custom_location: Optional[str] = None,
    experience_preference: Optional[str] = None,
    apply_edited_suggestions: bool = False,
) -> Dict[str, Any]:
    """Interpret recruiter sourcing instructions with local Ollama (or deterministic fallback)
    and build validated platform-specific Boolean queries.
    """
    from app.ai.providers.chat_provider import chat_provider

    jd_mand = _dedupe_terms(mandatory_skills)
    mand = list(jd_mand)
    pref = _dedupe_terms(preferred_skills)
    excl = _dedupe_terms(exclusions if exclusions is not None else ["Intern", "Trainee", "Student", "Fresher"])
    alt_titles = _dedupe_terms(alternative_titles)
    cos = _dedupe_terms(target_companies)
    industries = _dedupe_terms(custom_industries)
    loc_pref = (custom_location if custom_location is not None else location) or ""
    exp_pref = experience_preference or ""
    mode = search_mode if search_mode in {"broad", "balanced", "strict"} else "balanced"

    ai_available = False
    ai_status = "Edited suggestions applied"
    explanation = "Generated Boolean queries from your edited sourcing parameters."

    if apply_edited_suggestions:
        if custom_titles is not None:
            alt_titles = _dedupe_terms(custom_titles)
        if custom_related_skills is not None:
            pref = _dedupe_terms(custom_related_skills)
    else:
        parsed = None
        if chat_provider.is_available():
            try:
                ai_prompt = (
                    "You are an experienced IT and non-IT Talent Acquisition Specialist.\n"
                    "Interpret the recruiter's natural-language sourcing instruction for this Job Description.\n"
                    "Preserve mandatory JD skills unless explicitly asked to relax them. Use OR-groups for related skills/titles.\n"
                    "Do NOT copy the raw sentence as a keyword.\n"
                    f"Job Title: {title}\n"
                    f"Location: {location or 'Not specified'}\n"
                    f"Mandatory JD Skills: {jd_mand}\n"
                    f"Preferred JD Skills: {pref}\n"
                    f"Current Alternative Titles: {alt_titles}\n"
                    f"Current Exclusions: {excl}\n"
                    f"Recruiter Instruction: \"{instruction}\"\n\n"
                    "Return strictly JSON with keys:\n"
                    "{\n"
                    '  "target_titles": ["string"],\n'
                    '  "alternative_titles": ["string"],\n'
                    '  "required_skills": ["string"],\n'
                    '  "related_skills": ["string"],\n'
                    '  "industries": ["string"],\n'
                    '  "experience_preference": "string",\n'
                    '  "location_preference": "string",\n'
                    '  "exclusions": ["string"],\n'
                    '  "search_mode": "balanced" | "strict" | "broad",\n'
                    '  "explanation": "1-2 simple sentences explaining how the request was interpreted"\n'
                    "}"
                )
                parsed = chat_provider.extract_json(
                    prompt=ai_prompt,
                    system_prompt="You are a recruitment Boolean search strategist. Return valid JSON only.",
                )
            except Exception:
                parsed = None

        if isinstance(parsed, dict) and parsed:
            def _as_list(v: Any) -> List[str]:
                if isinstance(v, list):
                    return [str(x).strip() for x in v if str(x).strip()]
                if isinstance(v, str) and v.strip():
                    return [s.strip() for s in v.split(",") if s.strip()]
                return []

            ai_available = True
            ai_status = f"AI interpreted via {chat_provider.model_name}"
            ai_titles = _as_list(parsed.get("target_titles")) + _as_list(parsed.get("alternative_titles"))
            if ai_titles:
                alt_titles = _dedupe_terms(ai_titles + alt_titles)
            ai_req = _as_list(parsed.get("required_skills"))
            if ai_req:
                # Preserve mandatory JD skills unless explicitly instructed to relax.
                mand = _dedupe_terms(jd_mand + ai_req) if "relax" not in (instruction or "").lower() else ai_req
            ai_rel = _as_list(parsed.get("related_skills"))
            if ai_rel:
                pref = _dedupe_terms(pref + ai_rel)
            ai_ind = _as_list(parsed.get("industries"))
            if ai_ind:
                industries = _dedupe_terms(ai_ind)
            if parsed.get("exclusions") is not None:
                excl = _dedupe_terms(_as_list(parsed.get("exclusions")))
            if parsed.get("experience_preference"):
                exp_list = _as_list(parsed.get("experience_preference"))
                exp_pref = ", ".join(exp_list) if exp_list else str(parsed["experience_preference"]).strip()
            if parsed.get("location_preference"):
                loc_list = _as_list(parsed.get("location_preference"))
                loc_pref = loc_list[0] if loc_list else str(parsed["location_preference"]).strip()
            if str(parsed.get("search_mode") or "").lower() in {"broad", "strict", "balanced"}:
                mode = str(parsed["search_mode"]).lower()
            if parsed.get("explanation"):
                explanation = str(parsed["explanation"]).strip()
        else:
            det = _deterministic_interpret_instruction(
                title=title,
                instruction=instruction,
                mand=mand,
                pref=pref,
                excl=excl,
                alt_titles=alt_titles,
                location=loc_pref,
                mode=mode,
            )
            alt_titles = det["alternative_titles"]
            mand = det["required_skills"]
            pref = det["related_skills"]
            industries = det["industries"]
            exp_pref = det["experience_preference"]
            loc_pref = det["location_preference"]
            excl = det["exclusions"]
            mode = det["search_mode"]
            explanation = det["explanation"]
            ai_available = False
            ai_status = "AI customization unavailable (Ollama offline) — deterministic rules applied"

    # Resolve any contradictory inclusions vs exclusions before query construction.
    mand, excl, contradiction_warnings = _resolve_contradictions(mand + pref + alt_titles, excl, jd_mand)
    # Keep mand focused on mandatory + added required skills (not mixing alt_titles into mand).
    mand_clean = _dedupe_terms(
        [s for s in mand if s.lower() not in {t.lower() for t in alt_titles} and s.lower() not in {p.lower() for p in pref}]
        or jd_mand
    )

    new_queries = generate_boolean_queries(
        title=title,
        mandatory_skills=mand_clean,
        preferred_skills=pref,
        domain_terms=domain_terms,
        alternative_titles=alt_titles,
        adjacent_skills=adjacent_skills,
        location=loc_pref or location,
        experience_years=experience_years,
        target_companies=cos,
        exclusions=excl,
        job_id=job_id,
        search_mode=mode,
        industries=industries,
        experience_preference=exp_pref,
    )
    result_dict = new_queries.model_dump()
    result_dict["customization_explanation"] = explanation
    result_dict["explanation"] = explanation
    result_dict["customization_applied"] = explanation
    result_dict["customized_query"] = result_dict.get("naukri", {}).get("query", "")
    result_dict["custom_mandatory"] = mand_clean
    result_dict["custom_preferred"] = pref
    result_dict["custom_exclusions"] = excl
    result_dict["search_mode"] = mode
    result_dict["ai_available"] = ai_available
    result_dict["ai_status"] = ai_status
    result_dict["validation_warnings"] = contradiction_warnings
    result_dict["interpreted_suggestions"] = {
        "titles": _clean_title_variants(title, alt_titles),
        "mandatory_skills": mand_clean,
        "related_skills": pref,
        "industries": industries,
        "experience_preference": exp_pref,
        "location_preference": loc_pref,
        "exclusions": excl,
        "search_mode": mode,
    }
    return result_dict
