"""Dedicated LangGraph Workflow for Recruiter-Friendly Market Intelligence & Target Company Reports.

Orchestrates 7 stages for a single requisition (`job_id`):
1. `load_jd` - Load verified requisition & JD details from SQLite
2. `gather_target_companies` - Reuse `run_target_company_graph` recommendations
3. `prepare_research_tasks` - Build dynamic role/title/location research inputs
4. `collect_market_data` - Fetch real public market data + reuse Boolean Search engine
5. `generate_explanations` - Use local Ollama (with deterministic fallback) for simple prose
6. `validate_provenance` - Verify source URLs, dates, and evidence classifications
7. `prepare_final_report` - Assemble the final structured report payload
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import END, START, StateGraph

from app.agent.workflows.target_company_graph import run_target_company_graph
from app.ai.providers.chat_provider import chat_provider
from app.services.boolean_query_service import generate_boolean_queries
from app.services.market_research_service import collect_market_intelligence
from app.services.skill_taxonomy_service import extract_skills_from_jd
from database.models import Job, JobDescription
from database.sqlite_connection import get_db

logger = logging.getLogger("companyai.agent.market_report_graph")


class MarketReportState(TypedDict, total=False):
    """LangGraph state shared across the 7 market-report nodes."""

    workflow_id: str
    job_id: int
    allow_llm: bool
    force_refresh: bool
    recruiter_notes: str

    # Stage 1: Loaded JD & skills
    job_data: Dict[str, Any]
    jd_text: str
    extraction: Dict[str, Any]

    # Stage 2: Target companies
    target_companies_result: Dict[str, Any]

    # Stage 3 & 4: Research + Boolean
    suggested_titles: Dict[str, List[str]]
    market_research: Dict[str, Any]
    boolean_queries: Dict[str, Any]

    # Stage 5: Recruiter-friendly explanations
    explanations: Dict[str, Any]
    ollama_used: bool
    ollama_status: str

    # Stage 6 & 7: Validation & Final Report
    provenance_summary: Dict[str, Any]
    final_report: Dict[str, Any]

    status: str
    errors: List[str]
    warnings: List[str]


# Requisition-isolated report cache keyed by (job_id, jd_hash, allow_llm)
_REPORT_CACHE: Dict[str, Dict[str, Any]] = {}


def _now_iso() -> str:
    """Return current UTC ISO timestamp."""
    return datetime.now(timezone.utc).isoformat()


def _today_display() -> str:
    """Return human-readable report generation date."""
    return datetime.now(timezone.utc).strftime("%d %b %Y")


def _extract_responsibilities(jd_text: str, structured_scope: Optional[Dict[str, Any]]) -> List[str]:
    """Extract concise responsibility bullets from structured scope or raw JD text."""
    if isinstance(structured_scope, dict):
        for key in ("key_responsibilities", "responsibilities", "core_responsibilities"):
            vals = structured_scope.get(key)
            if isinstance(vals, list) and vals:
                return [str(v).strip() for v in vals[:6] if str(v).strip()]

    lines = [ln.strip("•-* \t") for ln in (jd_text or "").splitlines() if ln.strip()]
    bullets = [ln for ln in lines if 20 <= len(ln) <= 220]
    return bullets[:5]


def _build_dynamic_job_titles(
    job_title: str,
    extraction: Dict[str, Any],
    postings: List[Dict[str, Any]],
) -> Dict[str, List[str]]:
    """Build dynamic job title groups from the JD and observed market postings."""
    seen: set[str] = set()

    def _dedupe(items: List[str], limit: int) -> List[str]:
        out: List[str] = []
        for item in items:
            clean = re.sub(r"\s*\(\d+\)\s*$", "", str(item or "")).strip()
            low = clean.lower()
            if len(clean) >= 3 and low not in seen:
                seen.add(low)
                out.append(clean)
            if len(out) >= limit:
                break
        return out

    direct = _dedupe([job_title], 3)
    alt = _dedupe(list(extraction.get("alternative_titles") or []), 6)
    market_titles = _dedupe([p.get("job_title", "") for p in postings], 6)

    # Derive adjacent-industry role titles from base function without hardcoding any domain.
    base_no_seniority = re.sub(
        r"^(?:Senior|Sr\.?|Junior|Jr\.?|Lead|Staff|Principal|Associate)\s+",
        "",
        job_title or "",
        flags=re.IGNORECASE,
    ).strip()
    adjacent_candidates = []
    if base_no_seniority and base_no_seniority.lower() != (job_title or "").lower():
        adjacent_candidates.append(base_no_seniority)
    for term in (extraction.get("domain_terms") or [])[:2]:
        if term and base_no_seniority and term.lower() not in base_no_seniority.lower():
            adjacent_candidates.append(f"{term} {base_no_seniority}")
    adjacent = _dedupe(adjacent_candidates, 4)

    return {
        "direct_titles": direct,
        "alternative_titles": alt,
        "adjacent_industry_titles": adjacent,
        "market_observed_titles": market_titles,
    }


def _node_load_jd(state: MarketReportState) -> Dict[str, Any]:
    """Node 1: Load the selected Job and its JobDescription from SQLite."""
    job_id = state["job_id"]
    db = next(get_db())
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return {"status": "failed", "errors": [f"Requisition #{job_id} was not found."]}

        source_jd = (
            db.query(JobDescription).filter(JobDescription.id == job.job_description_id).first()
            if job.job_description_id
            else None
        )
        jd_text = (source_jd.original_text if source_jd and source_jd.original_text else job.description or "").strip()
        if not jd_text:
            return {
                "status": "failed",
                "errors": ["Job Description text is missing for this requisition. Please upload or add a JD before creating a report."],
            }

        extraction = extract_skills_from_jd(jd_text, title=job.title or "", use_ai=bool(state.get("allow_llm", True)))
        mandatory = list(job.required_skills or []) or list(extraction.get("mandatory_skills") or [])
        preferred = list(job.preferred_skills or []) or list(extraction.get("preferred_skills") or [])
        extraction["mandatory_skills"] = mandatory
        extraction["preferred_skills"] = preferred

        structured_scope = None
        if getattr(job, "structured_scope_json", None):
            try:
                structured_scope = json.loads(job.structured_scope_json)
            except Exception:
                structured_scope = None

        exp_min = job.min_experience_years
        exp_max = getattr(job, "max_experience_years", None)
        if exp_min is not None and exp_max is not None:
            exp_display = f"{exp_min:g} - {exp_max:g} years"
        elif exp_min is not None:
            exp_display = f"{exp_min:g}+ years"
        else:
            exp_display = "Not specified in JD"

        job_data = {
            "job_id": job.id,
            "requisition_code": f"REQ-{job.id:04d}",
            "title": job.title or f"Requisition #{job.id}",
            "location": job.location or "Not specified",
            "experience_required": exp_display,
            "experience_years": exp_min,
            "employment_type": getattr(job, "employment_type", None) or "Not specified in JD",
            "domain": extraction.get("domain_label") or extraction.get("domain") or "General",
            "mandatory_skills": mandatory,
            "preferred_skills": preferred,
            "responsibilities": _extract_responsibilities(jd_text, structured_scope),
        }
        return {"job_data": job_data, "jd_text": jd_text, "extraction": extraction}
    finally:
        db.close()


def _node_gather_target_companies(state: MarketReportState) -> Dict[str, Any]:
    """Node 2: Reuse the existing Target Companies LangGraph workflow for this requisition."""
    if state.get("status") == "failed":
        return {}
    res = run_target_company_graph(
        job_id=state["job_id"],
        allow_llm=bool(state.get("allow_llm", True)),
    )
    if "error" in res or not res.get("companies"):
        msg = res.get("error") or "No target company recommendations are available for this requisition."
        return {"status": "failed", "errors": list(state.get("errors") or []) + [msg]}
    return {"target_companies_result": res}


def _node_prepare_research_tasks(state: MarketReportState) -> Dict[str, Any]:
    """Node 3: Prepare dynamic job title variants for market research."""
    if state.get("status") == "failed":
        return {}
    job_data = state["job_data"]
    extraction = state["extraction"]
    titles = _build_dynamic_job_titles(job_data["title"], extraction, postings=[])
    return {"suggested_titles": titles}


def _node_collect_market_data(state: MarketReportState) -> Dict[str, Any]:
    """Node 4: Collect real public market data and reuse the existing Boolean Search engine."""
    if state.get("status") == "failed":
        return {}

    job_data = state["job_data"]
    extraction = state["extraction"]
    tc_res = state["target_companies_result"]
    companies = tc_res.get("companies") or []

    research = collect_market_intelligence(
        job_id=state["job_id"],
        job_title=job_data["title"],
        location=job_data["location"],
        jd_text=state["jd_text"],
        mandatory_skills=job_data["mandatory_skills"],
        preferred_skills=job_data["preferred_skills"],
        force_refresh=bool(state.get("force_refresh", False)),
    )

    # Enrich suggested titles with real titles observed in retrieved job postings.
    suggested_titles = _build_dynamic_job_titles(
        job_data["title"],
        extraction,
        postings=research.get("company_hiring_activity") or [],
    )

    # Reuse the existing CompanyAI Boolean query engine (no duplicate engine).
    top_company_names = [c.get("name") for c in companies[:6] if c.get("name")]
    boolean_obj = generate_boolean_queries(
        title=job_data["title"],
        mandatory_skills=job_data["mandatory_skills"],
        preferred_skills=job_data["preferred_skills"],
        domain_terms=extraction.get("domain_terms") or [],
        alternative_titles=suggested_titles.get("alternative_titles") or [],
        adjacent_skills=extraction.get("adjacent_skills") or [],
        term_explanations=extraction.get("term_explanations") or {},
        location=job_data["location"],
        experience_years=job_data.get("experience_years"),
        target_companies=top_company_names,
        exclusions=["Intern", "Trainee", "Student", "Fresher"],
        job_id=state["job_id"],
        search_mode="balanced",
    )

    warnings = list(state.get("warnings") or [])
    if research.get("failed_sources"):
        warnings.extend(research["failed_sources"])

    return {
        "market_research": research,
        "suggested_titles": suggested_titles,
        "boolean_queries": boolean_obj.model_dump(),
        "warnings": warnings,
    }


def _deterministic_explanations(state: MarketReportState) -> Dict[str, Any]:
    """Build clear, grounded recruiter-friendly explanations without requiring Ollama."""
    job_data = state["job_data"]
    tc_res = state["target_companies_result"]
    research = state["market_research"]
    companies = tc_res.get("companies") or []
    postings = research.get("company_hiring_activity") or []
    locs = research.get("location_intelligence", {}).get("observed_hiring_locations") or []

    mand_str = ", ".join(job_data["mandatory_skills"][:5]) or "the core skills listed in the JD"
    role_summary = (
        f"This requisition is for a {job_data['title']} based in {job_data['location']} "
        f"(experience: {job_data['experience_required']}). "
        f"Recruiters should focus on candidates with hands-on experience in {mand_str}."
    )

    tier1_names = [c["name"] for c in companies if "1" in str(c.get("tier_level") or c.get("tier") or "")][:4]
    tier2_names = [c["name"] for c in companies if "2" in str(c.get("tier_level") or c.get("tier") or "")][:4]
    adjacent_industries = sorted({str(c.get("category") or "").strip() for c in companies if c.get("category")})[:4]

    sourcing_approach = (
        f"Start by targeting Tier 1 direct-match companies ({', '.join(tier1_names) or 'listed top peers'}) "
        f"where candidates already perform similar {job_data['domain']} work. "
        f"Expand to Tier 2 and adjacent organizations ({', '.join(tier2_names) or 'parallel ecosystems'}) "
        f"for transferable skills, prioritizing {job_data['location']}."
    )

    if postings:
        top_locs = ", ".join(item["location"] for item in locs[:4]) or job_data["location"]
        market_trends_summary = (
            f"Across {len(postings)} reviewed public job postings, employers are advertising similar roles "
            f"in locations including {top_locs}. Common requirements align with {mand_str}."
        )
    else:
        market_trends_summary = "Market information not available for this section."

    competitor_insights = (
        f"Candidates from {', '.join(tier1_names + tier2_names[:2]) or 'the recommended target companies'} "
        f"typically work in comparable operational environments and tools, making their experience transferable to this role."
    )

    return {
        "role_summary": role_summary,
        "sourcing_approach": sourcing_approach,
        "direct_vs_transferable": (
            f"Direct experience comes from peers in {tc_res.get('ecosystem_name') or job_data['domain']}. "
            f"Transferable experience can be sourced from adjacent categories such as {', '.join(adjacent_industries) or 'related technology and enterprise services'}."
        ),
        "market_trends_summary": market_trends_summary,
        "competitor_talent_pool_insights": competitor_insights,
    }


def _node_generate_explanations(state: MarketReportState) -> Dict[str, Any]:
    """Node 5: Use local Ollama for plain-English summaries, falling back cleanly if unavailable."""
    if state.get("status") == "failed":
        return {}

    fallback = _deterministic_explanations(state)
    if not state.get("allow_llm", True):
        return {"explanations": fallback, "ollama_used": False, "ollama_status": "skipped_deterministic"}

    job_data = state["job_data"]
    tc_res = state["target_companies_result"]
    research = state["market_research"]
    postings = research.get("company_hiring_activity") or []
    companies = tc_res.get("companies") or []

    prompt = (
        "Write simple, practical, recruiter-friendly English (no AI jargon or made-up stats). "
        "Return strictly JSON with keys: role_summary, sourcing_approach, direct_vs_transferable, "
        "market_trends_summary, competitor_talent_pool_insights.\n"
        f"Job Title: {job_data['title']}\n"
        f"Location: {job_data['location']}\n"
        f"Experience: {job_data['experience_required']}\n"
        f"Mandatory Skills: {', '.join(job_data['mandatory_skills'][:8])}\n"
        f"Target Companies: {', '.join(c.get('name', '') for c in companies[:8])}\n"
        f"Observed Public Postings Count: {len(postings)}\n"
        "If Observed Public Postings Count is 0, set market_trends_summary to: "
        "'Market information not available for this section.'"
    )
    try:
        resp = chat_provider.provider.chat(
            messages=[
                {"role": "system", "content": "You are a senior recruitment advisor. Output strictly valid JSON."},
                {"role": "user", "content": prompt},
            ],
            model=chat_provider.model_name,
            temperature=0.2,
            format_json=True,
            timeout_seconds=12.0,
        )
        content = (resp.get("message") or {}).get("content") or ""
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.IGNORECASE)
        parsed = json.loads(cleaned)
        merged = {k: str(parsed.get(k) or fallback[k]).strip() for k in fallback}
        if not postings:
            merged["market_trends_summary"] = "Market information not available for this section."
        return {"explanations": merged, "ollama_used": True, "ollama_status": "used"}
    except Exception as exc:
        logger.info("Ollama unavailable/skipped for market report prose; using deterministic fallback: %s", exc)
        return {
            "explanations": fallback,
            "ollama_used": False,
            "ollama_status": f"fallback ({exc})",
        }


def _node_validate_provenance(state: MarketReportState) -> Dict[str, Any]:
    """Node 6: Validate source URLs, dates, and evidence classifications."""
    if state.get("status") == "failed":
        return {}
    research = state["market_research"]
    refs = research.get("source_references") or []
    valid_refs = [r for r in refs if str(r.get("source_url", "")).startswith(("http://", "https://"))]
    return {
        "provenance_summary": {
            "verified_sources_count": len(valid_refs),
            "researched_date": research.get("researched_date"),
            "research_complete": bool(research.get("research_complete")),
            "failed_sources": research.get("failed_sources") or [],
            "labels_legend": {
                "Verified information": "Supported by a direct public source link and access date.",
                "Market observation": "Pattern observed across multiple reviewed public postings.",
                "Recruiter suggestion": "Practical sourcing recommendation derived from the selected JD.",
            },
        }
    }


def _node_prepare_final_report(state: MarketReportState) -> Dict[str, Any]:
    """Node 7: Assemble the final structured report matching Sections A-D and Action Plan."""
    if state.get("status") == "failed":
        return {}

    job_data = state["job_data"]
    tc_res = state["target_companies_result"]
    research = state["market_research"]
    explanations = state["explanations"]
    suggested_titles = state["suggested_titles"]
    boolean_queries = state["boolean_queries"]
    companies = tc_res.get("companies") or []

    # Format Section C table rows from existing Target Companies recommendations.
    target_companies_table = [
        {
            "company_name": c.get("name", ""),
            "tier": c.get("tier_level") or c.get("tier") or "Tier 2",
            "industry_category": c.get("category") or tc_res.get("ecosystem_name") or "Target Employer",
            "location": c.get("location") or job_data["location"],
            "why_target": c.get("why_recommended") or c.get("recommendation_reason") or "",
            "suggested_job_titles": ", ".join(c.get("target_departments") or suggested_titles["direct_titles"] or [job_data["title"]]),
            "important_skills": ", ".join(c.get("overlap_skills") or job_data["mandatory_skills"][:5]),
        }
        for c in companies
    ]

    tier1_companies = [row["company_name"] for row in target_companies_table if "1" in str(row["tier"])][:6]
    adjacent_industries = sorted({row["industry_category"] for row in target_companies_table if row["industry_category"]})[:5]

    report = {
        "report_metadata": {
            "report_title": f"Market Intelligence & Target Company Sourcing Report — {job_data['title']}",
            "job_id": job_data["job_id"],
            "requisition_id": job_data["requisition_code"],
            "job_title": job_data["title"],
            "job_location": job_data["location"],
            "generated_at": _now_iso(),
            "generated_date": _today_display(),
            "research_performed_date": research.get("researched_date"),
            "ollama_used": bool(state.get("ollama_used")),
            "ollama_status": state.get("ollama_status", "deterministic"),
            "overview_note": (
                "This report combines the selected requisition's Job Description, CompanyAI's target company "
                "recommendations, existing Boolean search strings, and sourced public employment market information."
            ),
        },
        "section_a_job_overview": {
            **job_data,
            "role_summary": explanations["role_summary"],
            "evidence_type": "Verified information",
        },
        "section_b_sourcing_strategy": {
            "primary_strategy": tc_res.get("primary_strategy") or "Direct Industry Experience",
            "sourcing_approach": explanations["sourcing_approach"],
            "direct_vs_transferable": explanations["direct_vs_transferable"],
            "priority_locations": [job_data["location"]]
            + [
                loc["location"]
                for loc in (research.get("location_intelligence", {}).get("observed_hiring_locations") or [])[:3]
                if loc["location"].lower() != job_data["location"].lower()
            ],
            "focus_skills": job_data["mandatory_skills"][:8],
            "focus_titles": (suggested_titles["direct_titles"] + suggested_titles["alternative_titles"])[:5],
            "evidence_type": "Recruiter suggestion",
        },
        "section_c_target_companies": {
            "ecosystem_name": tc_res.get("ecosystem_name") or "Target Corporate Sourcing Ecosystem",
            "total_companies": len(target_companies_table),
            "companies": target_companies_table,
            "evidence_type": "Recruiter suggestion",
        },
        "section_d_market_intelligence": {
            "company_hiring_activity": research.get("company_hiring_activity") or [],
            "hiring_news": research.get("hiring_news") or [],
            "market_hiring_trends": {
                "summary": explanations["market_trends_summary"],
                "news_items": research.get("market_news") or [],
                "evidence_type": "Market observation" if research.get("company_hiring_activity") else "Market information not available for this section.",
            },
            "in_demand_skills": research.get("skill_analysis") or {},
            "location_intelligence": research.get("location_intelligence") or {},
            "salary_and_compensation": research.get("salary_intelligence") or {
                "available": False,
                "entries": [],
                "note": "Market information not available for this section.",
            },
            "competitor_and_talent_pool_insights": {
                "summary": explanations["competitor_talent_pool_insights"],
                "evidence_type": "Recruiter suggestion",
            },
        },
        "suggested_job_titles": suggested_titles,
        "important_skills": {
            "mandatory_skills": job_data["mandatory_skills"],
            "preferred_skills": job_data["preferred_skills"],
            "additional_market_skills": (research.get("skill_analysis") or {}).get("additional_market_skills") or [],
            "additional_skills_note": (
                "Additional market skills are suggestions observed in reviewed public job postings, "
                "not newly imposed mandatory requirements."
            ),
        },
        "recruiter_search_suggestions": {
            "naukri": boolean_queries.get("naukri"),
            "linkedin": boolean_queries.get("linkedin"),
            "google_xray": boolean_queries.get("google_xray"),
            "simple_keywords": boolean_queries.get("simple_keywords"),
        },
        "recruiter_action_plan": {
            "prioritize_companies_first": tier1_companies or [r["company_name"] for r in target_companies_table[:5]],
            "suggested_titles_to_search": (suggested_titles["direct_titles"] + suggested_titles["alternative_titles"])[:6],
            "important_skills_focus": job_data["mandatory_skills"][:6],
            "priority_locations": [job_data["location"]],
            "ready_search_strings": {
                "naukri": (boolean_queries.get("naukri") or {}).get("query", ""),
                "linkedin": (boolean_queries.get("linkedin") or {}).get("query", ""),
                "google_xray": (boolean_queries.get("google_xray") or {}).get("query", ""),
            },
            "adjacent_industries": adjacent_industries,
            "recruiter_notes": state.get("recruiter_notes") or "",
        },
        "provenance": state["provenance_summary"],
        "source_references": research.get("source_references") or [],
    }

    return {"status": "completed", "final_report": report}


def build_market_report_graph():
    """Compile the 7-node LangGraph workflow for Market Intelligence Report generation."""
    graph = StateGraph(MarketReportState)
    graph.add_node("load_jd", _node_load_jd)
    graph.add_node("gather_target_companies", _node_gather_target_companies)
    graph.add_node("prepare_research_tasks", _node_prepare_research_tasks)
    graph.add_node("collect_market_data", _node_collect_market_data)
    graph.add_node("generate_explanations", _node_generate_explanations)
    graph.add_node("validate_provenance", _node_validate_provenance)
    graph.add_node("prepare_final_report", _node_prepare_final_report)

    graph.add_edge(START, "load_jd")
    graph.add_edge("load_jd", "gather_target_companies")
    graph.add_edge("gather_target_companies", "prepare_research_tasks")
    graph.add_edge("prepare_research_tasks", "collect_market_data")
    graph.add_edge("collect_market_data", "generate_explanations")
    graph.add_edge("generate_explanations", "validate_provenance")
    graph.add_edge("validate_provenance", "prepare_final_report")
    graph.add_edge("prepare_final_report", END)
    return graph.compile()


def run_market_report_graph(
    job_id: int,
    allow_llm: bool = True,
    force_refresh: bool = False,
    recruiter_notes: str = "",
) -> Dict[str, Any]:
    """Execute the Market Intelligence & Target Company Report LangGraph workflow."""
    db = next(get_db())
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return {"error": f"Requisition #{job_id} was not found."}
        digest = hashlib.sha256(
            f"{job.id}|{job.title}|{job.location}|{job.description or ''}|{allow_llm}".encode("utf-8")
        ).hexdigest()[:16]
        cache_key = f"{job_id}:{digest}"
    finally:
        db.close()

    if not force_refresh and cache_key in _REPORT_CACHE and not recruiter_notes:
        return _REPORT_CACHE[cache_key]

    app = build_market_report_graph()
    initial_state: MarketReportState = {
        "workflow_id": f"mr-{uuid.uuid4().hex[:10]}",
        "job_id": job_id,
        "allow_llm": allow_llm,
        "force_refresh": force_refresh,
        "recruiter_notes": recruiter_notes,
        "status": "running",
        "errors": [],
        "warnings": [],
    }
    final_state = app.invoke(initial_state)

    if final_state.get("status") == "failed" or final_state.get("errors"):
        return {"error": "; ".join(final_state.get("errors") or ["Report generation failed."])}

    report = final_state.get("final_report") or {"error": "No report generated."}
    if "error" not in report and not recruiter_notes:
        if len(_REPORT_CACHE) > 50:
            _REPORT_CACHE.clear()
        _REPORT_CACHE[cache_key] = report
    return report
