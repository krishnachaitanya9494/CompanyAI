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

    def add(t: str):
        c = re.sub(r"^(?:Senior|Lead|Staff|Principal|Junior|Associate)\s+", "", t, flags=re.I).strip()
        c = re.sub(r"\s*[-–]\s*.*$", "", c).strip()  # Remove suffix like ' - Complaint Management'
        if c and len(c) >= 3 and c.lower() not in [v.lower() for v in variants]:
            variants.append(c)

    # Add primary stripped title
    add(title)

    # Add explicit title words
    sub_parts = re.split(r"[/,|–-]", title)
    for p in sub_parts:
        clean_p = p.strip()
        if len(clean_p) > 3 and not re.search(r"^(?:REQ|JD|\d+)", clean_p):
            add(clean_p)

    # Add provided alternative titles
    if alternative_titles:
        for alt in alternative_titles:
            add(alt)

    return variants[:5]


def generate_boolean_queries(
    title: str,
    mandatory_skills: Optional[List[str]] = None,
    preferred_skills: Optional[List[str]] = None,
    domain_terms: Optional[List[str]] = None,
    alternative_titles: Optional[List[str]] = None,
    location: Optional[str] = None,
    experience_years: Optional[float] = None,
    target_companies: Optional[List[str]] = None,
    exclusions: Optional[List[str]] = None,
    job_id: Optional[int] = None,
) -> AllBooleanQueriesResponse:
    """Generate comprehensive, platform-aware Boolean search queries from structured JD intelligence."""
    from datetime import datetime, timezone

    mand_skills = [s.strip() for s in (mandatory_skills or []) if s.strip()]
    pref_skills = [s.strip() for s in (preferred_skills or []) if s.strip()]
    dom_terms = [d.strip() for d in (domain_terms or []) if d.strip()]
    alt_titles = _clean_title_variants(title, alternative_titles)

    # Default negative exclusions for professional roles
    default_exclusions = exclusions or ["Intern", "Trainee", "Student", "Fresher"]

    # ----------------------------------------------------
    # 1. NAUKRI RESDEX QUERY (1,000 char limit)
    # Naukri supports standard AND, OR, NOT, parentheses.
    # Best practice: (Title variants) AND (Core mandatory skill 1 OR synonym) AND (Core mandatory skill 2...)
    # ----------------------------------------------------
    naukri_limit = 1000
    naukri_included: List[str] = []

    # Title group
    title_clause = f"({ ' OR '.join(_quote(t) for t in alt_titles[:3]) })" if alt_titles else f"({_quote(title)})"
    naukri_included.extend(alt_titles[:3] or [title])

    # Core skill clusters (take top 4-6 high signal mandatory skills)
    core_skill_clauses: List[str] = []
    for sk in mand_skills[:6]:
        core_skill_clauses.append(_quote(sk))
        naukri_included.append(sk)

    # Domain keywords (take top 2)
    for dt in dom_terms[:2]:
        if dt.lower() not in [s.lower() for s in mand_skills]:
            core_skill_clauses.append(_quote(dt))
            naukri_included.append(dt)

    naukri_parts = [title_clause]
    if core_skill_clauses:
        # Group into AND clauses
        naukri_parts.append(f"({' AND '.join(core_skill_clauses[:4])})")

    # Negative exclusion
    excl_clause = f"NOT ({' OR '.join(_quote(e) for e in default_exclusions)})"
    naukri_parts.append(excl_clause)

    naukri_query = " AND ".join(naukri_parts)

    # Compact variant if long
    naukri_compact = ""
    if len(naukri_query) > naukri_limit or len(mand_skills) > 4:
        short_parts = [
            f"({ ' OR '.join(_quote(t) for t in alt_titles[:2]) })" if alt_titles else f"({_quote(title)})",
            f"({' AND '.join(_quote(s) for s in mand_skills[:3])})",
            excl_clause,
        ]
        naukri_compact = " AND ".join(p for p in short_parts if p)

    naukri_result = BooleanStrategyResult(
        platform="naukri",
        platform_label="Naukri Resdex",
        query=naukri_query,
        compact_query=naukri_compact if len(naukri_query) > naukri_limit else None,
        character_count=len(naukri_query),
        character_limit=naukri_limit,
        is_valid=len(naukri_query) <= naukri_limit,
        validation_status="Valid" if len(naukri_query) <= naukri_limit else f"Exceeds Limit by {len(naukri_query) - naukri_limit} chars",
        strategy_explanation=(
            f"Combines role title variants with mandatory technical skills ({', '.join(mand_skills[:3])}) "
            "and excludes entry-level profiles. Uses strict AND syntax required for Naukri Resdex keyword indexing."
        ),
        included_skills=naukri_included,
        excluded_terms=default_exclusions,
        syntax_tips="In Naukri Resdex, paste directly into 'Keyskills' or 'Search Keywords'. Location and experience are best applied using portal filters.",
    )

    # ----------------------------------------------------
    # 2. LINKEDIN RECRUITER QUERY (1,500 char limit)
    # LinkedIn supports title search + skill cluster OR groupings
    # ----------------------------------------------------
    linkedin_limit = 1500
    li_included: List[str] = []

    # Title clause with seniority expansion
    li_title_clause = f"({ ' OR '.join(_quote(t) for t in alt_titles) })" if alt_titles else f"({_quote(title)})"
    li_included.extend(alt_titles)

    # Mandatory skills cluster
    li_skill_clauses: List[str] = []
    for s in mand_skills[:8]:
        li_skill_clauses.append(_quote(s))
        li_included.append(s)

    # Domain terminology
    for d in dom_terms[:3]:
        if d.lower() not in [s.lower() for s in mand_skills]:
            li_skill_clauses.append(_quote(d))
            li_included.append(d)

    li_parts = [li_title_clause]
    if li_skill_clauses:
        li_parts.append(f"({' AND '.join(li_skill_clauses[:5])})")
    if pref_skills:
        # Add optional preferred skills with OR
        li_parts.append(f"({' OR '.join(_quote(p) for p in pref_skills[:3])})")

    li_query = " AND ".join(li_parts)

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
            "Optimized for LinkedIn Recruiter keyword box. Targets candidates with primary and equivalent titles "
            "while verifying hands-on competence across required platform competencies and domain processes."
        ),
        included_skills=li_included,
        excluded_terms=[],
        syntax_tips="Paste into the LinkedIn Recruiter 'Keywords' field. Use 'Job Titles' facet for titles to increase precision.",
    )

    # ----------------------------------------------------
    # 3. GOOGLE X-RAY SEARCH (2,048 char / 32 words limit)
    # site:linkedin.com/in ("title1" OR "title2") ("skill1" AND "skill2")
    # ----------------------------------------------------
    xray_limit = 2048
    xray_included: List[str] = []

    xray_titles = f"({ ' OR '.join(_quote(t) for t in alt_titles[:2]) })" if alt_titles else _quote(title)
    xray_included.extend(alt_titles[:2] or [title])

    xray_skills: List[str] = []
    for s in mand_skills[:4]:
        xray_skills.append(_quote(s))
        xray_included.append(s)

    for d in dom_terms[:2]:
        if d.lower() not in [s.lower() for s in mand_skills]:
            xray_skills.append(_quote(d))
            xray_included.append(d)

    xray_loc_clause = ""
    if location:
        clean_loc = re.split(r"[/,&]", location)[0].strip()
        if clean_loc and not re.search(r"remote|hybrid", clean_loc, re.I):
            xray_loc_clause = f" AND {_quote(clean_loc)}"

    xray_query = f'site:linkedin.com/in {xray_titles} AND {" AND ".join(xray_skills[:4])}{xray_loc_clause} -intitle:"profiles" -inurl:"dir/"'

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
        included_skills=xray_included,
        excluded_terms=["profiles", "dir/"],
        syntax_tips="Paste directly into Google Search bar. You can replace site:linkedin.com/in with site:in.linkedin.com/in to focus strictly on India profiles.",
    )

    # ----------------------------------------------------
    # 4. PLAIN KEYWORDS
    # ----------------------------------------------------
    distinct_keywords: List[str] = []
    for item in alt_titles[:2] + mand_skills[:6] + dom_terms[:3]:
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
    strict_terms = [_quote(t) for t in (alt_titles[:1] or [title]) + mand_skills[:4] + dom_terms[:1]]
    strict_query = " AND ".join(strict_terms)
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
    broad_terms = [_quote(t) for t in alt_titles + mand_skills[:4]]
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
        included_skills=alt_titles + mand_skills[:4],
        excluded_terms=[],
        syntax_tips="Use when recruiting for rare skills where strict AND returns zero candidates.",
    )

    # D. Domain-Focused Strategy
    dom_clauses: List[str] = []
    if dom_terms:
        dom_clauses.append(f"({' OR '.join(_quote(d) for d in dom_terms)})")
    if mand_skills:
        dom_clauses.append(f"({' OR '.join(_quote(s) for s in mand_skills[:3])})")
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
        included_skills=dom_terms + mand_skills[:3],
        excluded_terms=[],
        syntax_tips="Best for targeting candidates from identical industry backgrounds.",
    )

    # E. Title-Independent Skill Strategy
    skill_clauses = [_quote(s) for s in mand_skills[:5]]
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
        included_skills=mand_skills[:5],
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
        generation_timestamp=datetime.now(timezone.utc).isoformat(),
    )
