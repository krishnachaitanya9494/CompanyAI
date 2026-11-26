"""Dedicated LangGraph Workflow for Intelligent Target Company Sourcing.

Transforms a single requisition's Job Description into a grounded, tier-classified
corporate sourcing plan using:
1. Deterministic JD skill/domain extraction (`skill_taxonomy_service`)
2. Existing corporate ecosystem catalog (`target_company_service.COMPANY_ECOSYSTEMS_CATALOG`)
3. Multi-factor deterministic relevance scoring & tier classification
4. Bounded local Ollama (`llama3.2:3b`) for contextual interpretation & recruiter-friendly explanations
5. Persistent SQLite LangGraph checkpointing isolated per requisition thread
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Set, Tuple

from langgraph.graph import END, START, StateGraph

from app.agent.workflows.checkpoint import get_sqlite_checkpointer
from app.agent.workflows.state import TargetCompanyState
from app.ai.providers.chat_provider import chat_provider
from app.services.skill_taxonomy_service import detect_jd_domain, extract_skills_from_jd
from app.services.target_company_service import (
    COMPANY_ECOSYSTEMS_CATALOG,
    DEFAULT_GENERAL_CATALOG,
)
from database.models import Job, JobDescription
from database.sqlite_connection import get_db

logger = logging.getLogger("companyai.agent.target_company_graph")

# Standard available sourcing strategies expected by the Target Companies UI
AVAILABLE_SOURCING_STRATEGIES: List[Dict[str, str]] = [
    {
        "id": "direct_industry",
        "label": "Direct Industry Experience",
        "description": "Target direct peers, competitors, and studios in the exact same business sector.",
    },
    {
        "id": "tier1_competitors",
        "label": "Tier-1 Competitors & Parallel Ecosystems",
        "description": "Target leading platform partners, Tier-1 consulting practices, and OEMs.",
    },
    {
        "id": "similar_job_function",
        "label": "Similar Job Function",
        "description": "Target companies with high-performing practitioners performing identical day-to-day operations.",
    },
    {
        "id": "adjacent_industry",
        "label": "Adjacent Industry",
        "description": "Broaden pool to include transferable candidates from parallel domains with compatible methodologies.",
    },
    {
        "id": "technology_based",
        "label": "Technology / Tool-Based Sourcing",
        "description": "Target companies whose tech stack strictly overlaps with mandatory software tools.",
    },
    {
        "id": "geographic_sourcing",
        "label": "Geographic Sourcing",
        "description": "Focus headhunting strictly within the same metropolitan hub to eliminate relocation friction.",
    },
]

# Normalize Indian city aliases so "Bengaluru" and "Bangalore" match reliably
_LOCATION_ALIASES: Dict[str, Set[str]] = {
    "bangalore": {"bangalore", "bengaluru", "blr"},
    "gurgaon": {"gurgaon", "gurugram", "ncr", "delhi ncr"},
    "mumbai": {"mumbai", "bombay", "navi mumbai"},
    "chennai": {"chennai", "madras"},
    "hyderabad": {"hyderabad", "hyd"},
    "pune": {"pune"},
    "noida": {"noida", "ncr", "delhi ncr"},
}


def _now_iso() -> str:
    """Return current UTC timestamp in ISO-8601 format."""
    return datetime.now(timezone.utc).isoformat()


def _extract_json_bounded(prompt: str, timeout_seconds: float = 12.0) -> Dict[str, Any]:
    """Call local Ollama with a tight timeout so UI requests never stall 120s behind queued LLM jobs."""
    data = chat_provider.provider.chat(
        messages=[
            {"role": "system", "content": "You are a recruitment extraction assistant. Output strictly valid JSON."},
            {"role": "user", "content": prompt},
        ],
        model=chat_provider.model_name,
        temperature=0.1,
        format_json=True,
        timeout_seconds=timeout_seconds,
    )
    content = (data.get("message") or {}).get("content") or ""
    cleaned = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"(\{[\s\S]*\})", cleaned)
        if match:
            return json.loads(match.group(1))
        raise ValueError("Invalid JSON from Ollama")


def _normalize_location_tokens(location_str: Optional[str]) -> Set[str]:
    """Expand a location string into normalized city tokens including common aliases."""
    if not location_str:
        return set()
    raw_tokens = {
        tok.strip().lower()
        for tok in re.split(r"[/,|;]+", location_str)
        if tok and tok.strip()
    }
    expanded = set(raw_tokens)
    for tok in raw_tokens:
        for canonical, aliases in _LOCATION_ALIASES.items():
            if tok in aliases or canonical in tok:
                expanded.update(aliases)
    return expanded


def _extract_role_family(title: str) -> str:
    """Derive a concise role family label from the job title."""
    t = (title or "").lower()
    if any(k in t for k in ["procurement", "purchasing", "sourcing", "buyer"]):
        return "Procurement & Sourcing"
    if any(k in t for k in ["accountant", "tax", "audit", "finance", "controller"]):
        return "Finance & Accounting"
    if any(k in t for k in ["cad", "bim", "revit", "draftsman", "architectural"]):
        return "CAD / BIM Engineering"
    if any(k in t for k in ["art director", "creative", "designer", "copywriter"]):
        return "Creative & Design"
    if any(k in t for k in ["contact-center", "contact center", "wfm", "workforce", "intraday"]):
        return "Contact Center & WFM"
    if any(k in t for k in ["analyst", "bi", "data"]):
        return "Analytics & Operations"
    if any(k in t for k in ["engineer", "developer", "architect", "devops"]):
        return "Software & Cloud Engineering"
    return "Enterprise Operations & Delivery"


# ---------------------------------------------------------------------------
# Node 1: Load Requisition from SQLite
# ---------------------------------------------------------------------------
def load_requisition_node(state: TargetCompanyState) -> Dict[str, Any]:
    """Node 1: Load the exact requisition and complete JD from SQLite.

    Validates `job_id` strictly so stale state from another requisition is never reused.
    """
    job_id = state.get("job_id")
    if not isinstance(job_id, int) or job_id <= 0:
        return {
            "status": "failed",
            "errors": [f"Invalid requisition ID: {job_id!r}"],
            "updated_at": _now_iso(),
        }

    db = next(get_db())
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return {
                "status": "failed",
                "errors": [f"Job requisition #{job_id} not found in database."],
                "updated_at": _now_iso(),
            }

        source_jd = (
            db.query(JobDescription).filter(JobDescription.id == job.job_description_id).first()
            if job.job_description_id
            else None
        )
        raw_text = source_jd.original_text if source_jd and source_jd.original_text else (job.description or "")

        return {
            "job_id": job.id,
            "job_title": job.title or "",
            "job_description": raw_text,
            "location": job.location,
            "department": job.department,
            "min_experience_years": job.min_experience_years,
            "max_experience_years": job.max_experience_years,
            "extracted_requirements": {
                "db_required_skills": list(job.required_skills or []),
                "db_preferred_skills": list(job.preferred_skills or []),
            },
            "status": "running",
            "errors": [],
            "updated_at": _now_iso(),
        }
    except Exception as exc:
        logger.exception("Failed loading requisition #%s", job_id)
        return {
            "status": "failed",
            "errors": [f"Database error loading requisition #{job_id}: {exc}"],
            "updated_at": _now_iso(),
        }
    finally:
        db.close()


def route_after_load(state: TargetCompanyState) -> Literal["analyze_job_description", "__end__"]:
    """Route to JD analysis if requisition loaded cleanly, otherwise stop early."""
    if state.get("status") == "failed" or state.get("errors"):
        return "__end__"
    return "analyze_job_description"


# ---------------------------------------------------------------------------
# Node 2: Analyze Job Description
# ---------------------------------------------------------------------------
def analyze_job_description_node(state: TargetCompanyState) -> Dict[str, Any]:
    """Node 2: Extract domain, skills, tools, experience, and operational context from the JD.

    Uses deterministic `skill_taxonomy_service` first; calls local Ollama (`llama3.2:3b`)
    only when deterministic skill extraction is sparse (< 3 skills) for contextual terms.
    """
    title = state.get("job_title", "")
    raw_text = state.get("job_description", "")
    existing_req = dict(state.get("extracted_requirements") or {})
    db_req = existing_req.get("db_required_skills", [])
    db_pref = existing_req.get("db_preferred_skills", [])

    # 1. Deterministic domain & skill extraction
    primary_domain, domain_meta = detect_jd_domain(title, raw_text)
    extraction = extract_skills_from_jd(raw_text, title=title, use_ai=False)

    mandatory_skills = list(extraction.get("mandatory_skills") or [])
    preferred_skills = list(extraction.get("preferred_skills") or [])
    if not mandatory_skills and db_req:
        mandatory_skills = list(db_req)
    if not preferred_skills and db_pref:
        preferred_skills = list(db_pref)

    # Deduplicate combined skills while preserving priority order
    all_jd_skills: List[str] = []
    seen_skills: Set[str] = set()
    for s in mandatory_skills + preferred_skills + db_req:
        s_clean = (s or "").strip()
        if s_clean and s_clean.lower() not in seen_skills:
            seen_skills.add(s_clean.lower())
            all_jd_skills.append(s_clean)

    # 2. Identify secondary domains from catalog keyword signals (multi-domain awareness)
    haystack_lower = f"{title} {raw_text} {' '.join(all_jd_skills)}".lower()
    secondary_domains: List[str] = []
    for eco in COMPANY_ECOSYSTEMS_CATALOG:
        eco_domains = eco.get("domains", [])
        if primary_domain in eco_domains:
            continue
        hits = sum(
            1
            for kw in eco.get("keywords", [])
            if re.search(r"(?:\b|_)" + re.escape(kw) + r"(?:\b|_)", haystack_lower)
        )
        if hits >= 2 and eco_domains:
            secondary_domains.append(eco_domains[0])

    # 3. Bounded Ollama contextual extraction ONLY if deterministic skills are sparse
    ollama_used = bool(state.get("ollama_used", False))
    ollama_status = state.get("ollama_status", "skipped_or_fallback")
    contextual_ops: List[str] = []

    if len(all_jd_skills) < 3 and raw_text.strip():
        try:
            if chat_provider.is_available():
                prompt = (
                    f"Job Title: {title}\n"
                    f"Job Description Snippet: {raw_text[:1200]}\n\n"
                    "Return JSON with keys: "
                    '{"tools_and_platforms": [str], "operational_skills": [str], "industry_domain": str}. '
                    "Extract ONLY terms explicitly supported by the text above. Max 5 items per list."
                )
                ai_data = _extract_json_bounded(prompt)
                ollama_used = True
                ollama_status = "used"
                for item in (ai_data.get("tools_and_platforms") or []) + (ai_data.get("operational_skills") or []):
                    if isinstance(item, str) and item.strip() and item.strip().lower() not in seen_skills:
                        seen_skills.add(item.strip().lower())
                        contextual_ops.append(item.strip())
                        all_jd_skills.append(item.strip())
            else:
                ollama_status = "unavailable"
        except Exception as exc:
            logger.warning("Optional Ollama JD analysis skipped: %s", exc)
            ollama_status = "unavailable"

    min_y = state.get("min_experience_years")
    max_y = state.get("max_experience_years")
    if min_y is not None and max_y is not None:
        exp_range = f"{int(min_y)}-{int(max_y)} years"
    elif min_y is not None:
        exp_range = f"{int(min_y)}+ years"
    else:
        exp_range = "Not specified"

    extracted_requirements = {
        "role_family": _extract_role_family(title),
        "mandatory_skills": mandatory_skills,
        "preferred_skills": preferred_skills,
        "all_jd_skills": all_jd_skills,
        "tools_and_platforms": [s for s in all_jd_skills if len(s) <= 28][:8],
        "operational_experience": contextual_ops,
        "domain_label": domain_meta.get("label", "Enterprise Specialization"),
        "location_requirements": state.get("location") or "Not specified",
        "experience_range": exp_range,
    }

    return {
        "primary_domain": primary_domain,
        "secondary_domains": secondary_domains[:3],
        "extracted_requirements": extracted_requirements,
        "ollama_used": ollama_used,
        "ollama_status": ollama_status,
        "updated_at": _now_iso(),
    }


# ---------------------------------------------------------------------------
# Node 3: Select Corporate Sourcing Ecosystem
# ---------------------------------------------------------------------------
def select_ecosystem_node(state: TargetCompanyState) -> Dict[str, Any]:
    """Node 3: Score and select primary & secondary corporate sourcing ecosystems.

    Never selects an ecosystem merely because it appears first in the catalog.
    Falls back to `DEFAULT_GENERAL_CATALOG` with explicit uncertainty metadata if
    confidence is low.
    """
    title = state.get("job_title", "")
    title_lower = title.lower()
    raw_text = state.get("job_description", "")
    req = state.get("extracted_requirements") or {}
    all_skills = req.get("all_jd_skills", [])
    primary_domain = state.get("primary_domain", "")
    secondary_domains = set(state.get("secondary_domains") or [])

    haystack = f"{title} {raw_text} {' '.join(all_skills)}".lower()

    scored: List[Tuple[float, Dict[str, Any], List[str]]] = []
    for eco in COMPANY_ECOSYSTEMS_CATALOG:
        score = 0.0
        evidence: List[str] = []

        eco_domains = eco.get("domains", [])
        if primary_domain in eco_domains:
            score += 30.0
            evidence.append(f"Primary domain '{primary_domain}' matched")
        elif secondary_domains.intersection(eco_domains):
            score += 12.0
            evidence.append(f"Secondary domain matched ({', '.join(secondary_domains.intersection(eco_domains))})")

        title_hits: List[str] = []
        body_hits: List[str] = []
        for kw in eco.get("keywords", []):
            kw_pattern = r"(?:\b|_)" + re.escape(kw) + r"(?:\b|_)"
            if re.search(kw_pattern, title_lower):
                score += 8.0
                title_hits.append(kw)
            elif re.search(kw_pattern, haystack):
                score += 2.0
                body_hits.append(kw)

        if title_hits:
            evidence.append(f"Title keywords: {', '.join(title_hits[:5])}")
        if body_hits:
            evidence.append(f"JD keywords: {', '.join(body_hits[:6])}")

        if score >= 4.0:
            scored.append((score, eco, evidence))

    scored.sort(key=lambda item: item[0], reverse=True)

    if scored:
        top_score, primary_eco, top_evidence = scored[0]
        secondary_eco = scored[1][1] if len(scored) > 1 and scored[1][0] >= 8.0 else None
        # Normalize confidence into [0.45, 0.98]
        confidence = round(min(0.98, max(0.45, top_score / 46.0)), 2)
        is_uncertain = top_score < 8.0
        eco_name = primary_eco.get("name", "Target Corporate Sourcing Ecosystem")
    else:
        primary_eco = DEFAULT_GENERAL_CATALOG
        secondary_eco = None
        top_score = 0.0
        top_evidence = ["No specialized ecosystem keywords reached threshold; using general enterprise fallback."]
        confidence = 0.30
        is_uncertain = True
        eco_name = f"{title} Talent Sourcing Ecosystem" if title else DEFAULT_GENERAL_CATALOG["name"]

    selected_ecosystem = {
        "id": primary_eco.get("id", "general_enterprise"),
        "name": eco_name,
        "score": round(top_score, 2),
        "is_uncertain_fallback": is_uncertain,
        "primary_strategy": primary_eco.get("primary_strategy", "Direct Industry Experience"),
        "strategy_rationale": primary_eco.get("strategy_rationale", ""),
        "secondary_ecosystem_id": secondary_eco.get("id") if secondary_eco else None,
        "secondary_ecosystem_name": secondary_eco.get("name") if secondary_eco else None,
    }

    return {
        "selected_ecosystem": selected_ecosystem,
        "classification_confidence": confidence,
        "classification_evidence": top_evidence,
        "updated_at": _now_iso(),
    }


# ---------------------------------------------------------------------------
# Node 4: Retrieve Company Catalog
# ---------------------------------------------------------------------------
def retrieve_company_catalog_node(state: TargetCompanyState) -> Dict[str, Any]:
    """Node 4: Retrieve companies from the deterministic ecosystem catalog, or generate domain-specific companies via Ollama for novel JDs."""
    selected_eco = state.get("selected_ecosystem") or {}
    eco_id = selected_eco.get("id", "general_enterprise")
    sec_id = selected_eco.get("secondary_ecosystem_id")
    is_uncertain = bool(selected_eco.get("is_uncertain_fallback", False))
    allow_llm = state.get("allow_llm", True)

    catalog_by_id = {eco["id"]: eco for eco in COMPANY_ECOSYSTEMS_CATALOG}
    primary_eco = catalog_by_id.get(eco_id, DEFAULT_GENERAL_CATALOG)
    primary_companies = list(primary_eco.get("companies") or [])

    # For novel JD domains not in the static catalog, ask local Ollama for domain-specific companies
    # instead of returning generic IT companies from DEFAULT_GENERAL_CATALOG.
    if is_uncertain and eco_id == "general_enterprise" and allow_llm:
        try:
            if chat_provider.is_available():
                job_title = state.get("job_title", "")
                location = state.get("location") or "India"
                req = state.get("extracted_requirements") or {}
                skills = ", ".join((req.get("all_jd_skills") or [])[:8])
                prompt = (
                    f"Job Title: {job_title}\nLocation: {location}\nKey Skills: {skills}\n"
                    f"JD Snippet: {(state.get('job_description') or '')[:900]}\n\n"
                    "Return strict JSON: {\"ecosystem_name\": str, \"companies\": ["
                    "{\"name\": str, \"category\": \"oem\"|\"big4\"|\"gsi\"|\"gcc\", "
                    "\"tier_level\": \"Tier 1\"|\"Tier 2\"|\"Tier 3\", \"location\": str, "
                    "\"description\": str, \"domain_specialties\": [str]}]}.\n"
                    "Provide 8 to 10 real companies relevant to this exact domain (NOT generic IT unless the role is IT)."
                )
                ai_eco = _extract_json_bounded(prompt)
                ai_cos = ai_eco.get("companies") if isinstance(ai_eco, dict) else None
                valid_cos = []
                if isinstance(ai_cos, list):
                    for item in ai_cos:
                        if isinstance(item, dict) and isinstance(item.get("name"), str) and item["name"].strip():
                            cat = item.get("category") if item.get("category") in {"oem", "big4", "gsi", "gcc"} else "oem"
                            tier = item.get("tier_level") if item.get("tier_level") in {"Tier 1", "Tier 2", "Tier 3"} else "Tier 2"
                            valid_cos.append({
                                "name": item["name"].strip(),
                                "category": cat,
                                "tier_level": tier,
                                "tier": f"{tier} Domain Pool",
                                "location": str(item.get("location") or location),
                                "description": str(item.get("description") or f"Domain employer for {job_title}"),
                                "domain_specialties": [str(s) for s in (item.get("domain_specialties") or [])[:4] if s],
                            })
                if len(valid_cos) >= 4:
                    primary_companies = valid_cos
                    if isinstance(ai_eco.get("ecosystem_name"), str) and ai_eco["ecosystem_name"].strip():
                        selected_eco = dict(selected_eco)
                        selected_eco["name"] = ai_eco["ecosystem_name"].strip()
        except Exception as exc:
            logger.warning("Dynamic Ollama ecosystem generation failed; falling back to catalog: %s", exc)

    source_pools: List[Tuple[str, List[Dict[str, Any]]]] = [(eco_id, primary_companies)]
    if len(primary_companies) < 10 and sec_id and sec_id in catalog_by_id:
        source_pools.append((sec_id, list(catalog_by_id[sec_id].get("companies") or [])))
    elif not primary_companies:
        source_pools.append(("general_enterprise", list(DEFAULT_GENERAL_CATALOG.get("companies") or [])))

    seen_names: Set[str] = set()
    candidates: List[Dict[str, Any]] = []
    for pool_eco_id, pool in source_pools:
        for co in pool:
            name_key = (co.get("name") or "").strip().lower()
            if name_key and name_key not in seen_names:
                seen_names.add(name_key)
                co_copy = dict(co)
                co_copy["_source_ecosystem_id"] = pool_eco_id
                co_copy["_is_primary_ecosystem"] = pool_eco_id == eco_id
                candidates.append(co_copy)

    return {
        "selected_ecosystem": selected_eco,
        "company_candidates": candidates,
        "updated_at": _now_iso(),
    }


# ---------------------------------------------------------------------------
# Node 5: Evaluate Company Relevance (Deterministic Scoring)
# ---------------------------------------------------------------------------
def evaluate_company_relevance_node(state: TargetCompanyState) -> Dict[str, Any]:
    """Node 5: Score every candidate company deterministically against the JD.

    Evaluates direct domain overlap, required/preferred skill overlap, role similarity,
    industry similarity, location relevance (e.g., Bengaluru/Bangalore), and transferable talent.
    """
    candidates = state.get("company_candidates") or []
    req = state.get("extracted_requirements") or {}
    mandatory_skills = [s.lower() for s in req.get("mandatory_skills", [])]
    preferred_skills = [s.lower() for s in req.get("preferred_skills", [])]
    all_jd_skills = req.get("all_jd_skills", [])
    jd_title = (state.get("job_title") or "").lower()
    jd_loc_tokens = _normalize_location_tokens(state.get("location"))

    title_tokens = {w for w in re.findall(r"[a-z0-9]{3,}", jd_title) if w not in {"and", "for", "with", "the", "entry", "mid", "ops"}}

    scores_map: Dict[str, Dict[str, Any]] = {}
    evaluated: List[Dict[str, Any]] = []

    for co in candidates:
        name = co.get("name", "")
        desc = (co.get("description") or "").lower()
        specialties = [str(s) for s in (co.get("domain_specialties") or [])]
        specs_lower = " ".join(specialties).lower()
        co_text = f"{desc} {specs_lower} {(co.get('tier') or '').lower()}"

        # 1. Direct domain / specialty overlap (0-30)
        is_primary_eco = bool(co.get("_is_primary_ecosystem", True))
        domain_base = 20.0 if is_primary_eco else 10.0
        spec_hits = sum(1 for tok in title_tokens if tok in co_text)
        direct_domain_score = min(30.0, domain_base + spec_hits * 3.0)

        # 2. Required skill overlap (0-25)
        matched_req_skills = [
            s for s in all_jd_skills
            if s.lower() in mandatory_skills and (s.lower() in co_text or any(tok in co_text for tok in s.lower().split() if len(tok) > 2))
        ]
        req_skill_score = min(25.0, len(matched_req_skills) * 8.0 + (6.0 if is_primary_eco and specialties else 0.0))

        # 3. Preferred skill overlap (0-10)
        matched_pref_skills = [
            s for s in all_jd_skills
            if s.lower() in preferred_skills and s.lower() in co_text
        ]
        pref_skill_score = min(10.0, len(matched_pref_skills) * 5.0)

        # 4. Role similarity (0-15)
        role_score = min(15.0, 7.0 + spec_hits * 3.0) if is_primary_eco else min(10.0, 4.0 + spec_hits * 2.0)

        # 5. Industry similarity (0-10)
        industry_score = 10.0 if is_primary_eco else 5.0

        # 6. Location relevance (0-10)
        co_loc_tokens = _normalize_location_tokens(co.get("location"))
        if jd_loc_tokens and co_loc_tokens.intersection(jd_loc_tokens):
            location_score = 10.0
            location_match = True
        elif not jd_loc_tokens:
            location_score = 6.0
            location_match = True
        else:
            location_score = 3.0
            location_match = False

        total_score = round(
            direct_domain_score + req_skill_score + pref_skill_score + role_score + industry_score + location_score,
            1,
        )

        # Grounded overlap skills: prioritize company specialties + matched JD skills
        overlap_skills: List[str] = []
        seen_ov: Set[str] = set()
        for s in matched_req_skills + matched_pref_skills + specialties + all_jd_skills:
            s_clean = str(s).strip()
            if s_clean and s_clean.lower() not in seen_ov:
                seen_ov.add(s_clean.lower())
                overlap_skills.append(s_clean)
            if len(overlap_skills) >= 4:
                break

        transferable_skills = [s for s in specialties if s not in overlap_skills][:3]

        score_breakdown = {
            "total_score": total_score,
            "direct_domain_overlap": round(direct_domain_score, 1),
            "required_skill_overlap": round(req_skill_score, 1),
            "preferred_skill_overlap": round(pref_skill_score, 1),
            "role_similarity": round(role_score, 1),
            "industry_similarity": round(industry_score, 1),
            "location_relevance": round(location_score, 1),
            "location_match": location_match,
            "matched_jd_skills": matched_req_skills + matched_pref_skills,
            "transferable_skills": transferable_skills,
        }
        scores_map[name] = score_breakdown

        co_eval = dict(co)
        co_eval["relevance_score"] = total_score
        co_eval["overlap_skills"] = overlap_skills
        co_eval["transferable_skills"] = transferable_skills
        co_eval["location_match"] = location_match
        evaluated.append(co_eval)

    # Sort deterministically: primary ecosystem first, then descending relevance score, then catalog tier
    tier_rank = {"Tier 1": 1, "Tier 2": 2, "Tier 3": 3}
    evaluated.sort(
        key=lambda c: (
            0 if c.get("_is_primary_ecosystem") else 1,
            tier_rank.get(c.get("tier_level", "Tier 2"), 2),
            -float(c.get("relevance_score", 0.0)),
        )
    )

    return {
        "company_candidates": evaluated,
        "company_relevance_scores": scores_map,
        "updated_at": _now_iso(),
    }


# ---------------------------------------------------------------------------
# Node 6: Tier Classification
# ---------------------------------------------------------------------------
def classify_tiers_node(state: TargetCompanyState) -> Dict[str, Any]:
    """Node 6: Classify evaluated companies into evidence-based Tier 1, Tier 2, and Tier 3 pools."""
    candidates = state.get("company_candidates") or []
    tiers: Dict[str, List[str]] = {"Tier 1": [], "Tier 2": [], "Tier 3": []}
    classified: List[Dict[str, Any]] = []

    for co in candidates:
        co_copy = dict(co)
        rel_score = float(co_copy.get("relevance_score", 0.0))
        catalog_tier = co_copy.get("tier_level")
        co_cat = co_copy.get("category", "other")
        is_primary = bool(co_copy.get("_is_primary_ecosystem", True))

        # Evidence-based tiering: catalog tier anchored by relevance & primary ecosystem alignment
        if is_primary and (catalog_tier == "Tier 1" or (catalog_tier is None and rel_score >= 65.0)):
            tier_level = "Tier 1"
            pool_type = "Direct Talent Pool"
        elif catalog_tier == "Tier 3" or (not is_primary and rel_score < 45.0):
            tier_level = "Tier 3"
            pool_type = "Specialist / Boutique Pool"
        elif catalog_tier == "Tier 2" or co_cat in {"gsi", "big4"} or rel_score >= 45.0:
            tier_level = "Tier 2"
            pool_type = "Adjacent Talent Pool"
        else:
            tier_level = "Tier 3"
            pool_type = "Specialist / Boutique Pool"

        co_copy["tier_level"] = tier_level
        co_copy["tier"] = co_copy.get("tier") or f"{tier_level} {pool_type}"
        co_copy["talent_pool_type"] = pool_type
        tiers[tier_level].append(co_copy.get("name", ""))
        classified.append(co_copy)

    return {
        "company_candidates": classified,
        "tier_classifications": tiers,
        "updated_at": _now_iso(),
    }


# ---------------------------------------------------------------------------
# Node 7: Sourcing Strategy & Grounded Explanations (with Local Ollama)
# ---------------------------------------------------------------------------
_CATEGORY_SUFFIXES: Dict[str, List[str]] = {
    "oem": ["Specialist", "Implementation Analyst", "Solution Consultant"],
    "big4": ["Advisory Analyst", "Associate Consultant", "Senior Associate"],
    "gsi": ["Operations Analyst", "Delivery Specialist", "Process Associate"],
    "gcc": ["Analyst", "Operations Specialist", "Program Coordinator"],
}


def _infer_company_target_titles(co: Dict[str, Any], job_title: str, role_family: str) -> List[str]:
    """Generate distinct, company-specific target titles from the company's specialties and category."""
    specialties = [str(s).strip() for s in (co.get("domain_specialties") or []) if str(s).strip()]
    cat = (co.get("category") or "gsi").lower()
    suffixes = _CATEGORY_SUFFIXES.get(cat, _CATEGORY_SUFFIXES["gsi"])

    titles: List[str] = []
    for idx, spec in enumerate(specialties[:3]):
        # Avoid awkward double-noun titles if specialty already ends with a role word
        if any(spec.lower().endswith(w) for w in ("analyst", "engineer", "specialist", "consultant", "manager", "director", "coordinator", "lead")):
            titles.append(spec)
        else:
            titles.append(f"{spec} {suffixes[idx % len(suffixes)]}")

    if not titles:
        base_role = job_title.split("-")[0].strip() if job_title else role_family
        titles = [f"{base_role} {s}" for s in suffixes[:2]]

    # Label once cleanly as inferred so PDF/Word cells stay readable
    if titles:
        titles[-1] = f"{titles[-1]} (Inferred)"
    return titles


def generate_sourcing_strategy_node(state: TargetCompanyState) -> Dict[str, Any]:
    """Node 7: Generate grounded sourcing strategy, rationale, and company explanations.

    Uses local Ollama (`llama3.2:3b`) in a single bounded call to enrich explanations
    strictly from verified JD and catalog data; falls back cleanly if unavailable.
    """
    selected_eco = state.get("selected_ecosystem") or {}
    req = state.get("extracted_requirements") or {}
    candidates = state.get("company_candidates") or []
    job_title = state.get("job_title") or "Target Role"
    location = state.get("location") or "Pan-India"
    role_family = req.get("role_family", "Domain Specialists")
    jd_skills = req.get("all_jd_skills", [])

    strategy = state.get("selected_strategy") or selected_eco.get("primary_strategy", "Direct Industry Experience")
    rationale = selected_eco.get(
        "strategy_rationale",
        "Prioritize headhunting pools with demonstrated functional overlap.",
    )

    # Deterministic grounded defaults for every company (unique per company specialties & category)
    for co in candidates:
        co_name = co.get("name", "")
        tier_level = co.get("tier_level", "Tier 2")
        pool_type = co.get("talent_pool_type", "Direct Talent Pool")
        overlap_str = ", ".join(co.get("overlap_skills") or jd_skills[:3] or [role_family])
        base_reason = co.get("why_recommended") or (
            f"{co_name} ({tier_level} — {pool_type}) maintains an established talent bench in {overlap_str} "
            f"for {job_title} sourcing."
        )
        co["why_recommended"] = base_reason
        co["recommendation_reason"] = base_reason
        co["target_departments"] = _infer_company_target_titles(co, job_title, role_family)
        co["headhunting_approach"] = (
            f"Target {pool_type.lower()} practitioners at {co_name} in {co.get('location', location)} "
            f"with verified experience in {overlap_str}."
        )

    # Single bounded Ollama call to enrich strategy rationale + top companies' recruiter notes
    ollama_used = bool(state.get("ollama_used", False))
    ollama_status = state.get("ollama_status", "skipped_or_fallback")
    allow_llm = state.get("allow_llm", True)

    if candidates and allow_llm:
        try:
            if chat_provider.is_available():
                top_names = [c["name"] for c in candidates[:6]]
                co_facts = [
                    {
                        "name": c["name"],
                        "tier": c["tier_level"],
                        "specialties": c.get("domain_specialties", [])[:4],
                        "location": c.get("location", ""),
                    }
                    for c in candidates[:6]
                ]
                prompt = (
                    f"Requisition: {job_title} | Location: {location} | Ecosystem: {selected_eco.get('name')}\n"
                    f"JD Skills: {', '.join(jd_skills[:8])}\n"
                    f"Top Target Companies (verified catalog): {co_facts}\n\n"
                    "Respond in strict JSON with keys:\n"
                    '{"strategy_summary": str, "company_notes": {"<CompanyName>": {"why": str, "target_titles": [str]}}}.\n'
                    "Rules: Ground every claim strictly in the provided JD skills and company specialties. "
                    "Do NOT invent company products or capabilities. Keep each 'why' under 28 words."
                )
                ai_out = _extract_json_bounded(prompt)
                ollama_used = True
                ollama_status = "used"

                if isinstance(ai_out.get("strategy_summary"), str) and ai_out["strategy_summary"].strip():
                    rationale = f"{rationale} {ai_out['strategy_summary'].strip()}"

                notes_map = ai_out.get("company_notes") or {}
                if isinstance(notes_map, dict):
                    for co in candidates:
                        note = notes_map.get(co["name"])
                        if isinstance(note, dict):
                            why_ai = (note.get("why") or "").strip()
                            if why_ai and co["name"].split("(")[0].strip().lower() in why_ai.lower():
                                co["why_recommended"] = why_ai
                                co["recommendation_reason"] = why_ai
                            titles_ai = note.get("target_titles")
                            if isinstance(titles_ai, list) and titles_ai:
                                co["target_departments"] = [f"{str(t).strip()} (Inferred)" for t in titles_ai[:3] if str(t).strip()]
            else:
                ollama_status = "unavailable"
        except Exception as exc:
            logger.warning("Ollama sourcing strategy enrichment failed; using deterministic rationale: %s", exc)
            if ollama_status != "used":
                ollama_status = "unavailable"

    return {
        "company_candidates": candidates,
        "sourcing_strategy": strategy,
        "strategy_rationale": rationale,
        "ollama_used": ollama_used,
        "ollama_status": ollama_status,
        "updated_at": _now_iso(),
    }


# ---------------------------------------------------------------------------
# Node 8: Validate Recommendations
# ---------------------------------------------------------------------------
def validate_recommendations_node(state: TargetCompanyState) -> Dict[str, Any]:
    """Node 8: Validate ecosystem alignment, tiers, deduplication, and cross-requisition isolation."""
    candidates = state.get("company_candidates") or []
    selected_eco = state.get("selected_ecosystem") or {}
    eco_id = selected_eco.get("id", "general_enterprise")
    sec_id = selected_eco.get("secondary_ecosystem_id")
    allowed_ecos = {eco_id}
    if sec_id:
        allowed_ecos.add(sec_id)
    if eco_id == "general_enterprise":
        allowed_ecos.add("general_enterprise")

    seen_names: Set[str] = set()
    validated: List[Dict[str, Any]] = []
    rejected: List[Dict[str, str]] = []
    warnings = list(state.get("warnings") or [])

    for co in candidates:
        name = (co.get("name") or "").strip()
        name_key = name.lower()
        src_eco = co.get("_source_ecosystem_id", eco_id)

        if not name:
            rejected.append({"name": "<empty>", "reason": "Missing company name"})
            continue
        if name_key in seen_names:
            rejected.append({"name": name, "reason": "Duplicate company"})
            continue
        if src_eco not in allowed_ecos:
            rejected.append({"name": name, "reason": f"Unrelated ecosystem '{src_eco}'"})
            continue
        if co.get("tier_level") not in {"Tier 1", "Tier 2", "Tier 3"}:
            co["tier_level"] = "Tier 2"
        if not co.get("overlap_skills"):
            co["overlap_skills"] = ["Domain Competencies"]
        if not co.get("location"):
            co["location"] = "Pan-India Hubs"

        seen_names.add(name_key)
        validated.append(co)

    checks = {
        "has_companies": len(validated) > 0,
        "no_duplicates": len(validated) == len(seen_names),
        "ecosystem_aligned": all(c.get("_source_ecosystem_id", eco_id) in allowed_ecos for c in validated),
        "requisition_isolated": isinstance(state.get("job_id"), int) and state["job_id"] > 0,
    }
    if rejected:
        warnings.append(f"Filtered {len(rejected)} unaligned/duplicate company candidates during validation.")

    return {
        "company_candidates": validated,
        "warnings": warnings,
        "validation_results": {
            "passed": all(checks.values()),
            "checks": checks,
            "rejected_companies": rejected,
        },
        "updated_at": _now_iso(),
    }


# ---------------------------------------------------------------------------
# Node 9: Prepare Final Sourcing Results (API-Compatible Contract)
# ---------------------------------------------------------------------------
def prepare_final_results_node(state: TargetCompanyState) -> Dict[str, Any]:
    """Node 9: Format the final API-compatible Target Companies payload."""
    job_id = state["job_id"]
    job_title = state.get("job_title", "")
    selected_eco = state.get("selected_ecosystem") or {}
    req = state.get("extracted_requirements") or {}
    candidates = state.get("company_candidates") or []
    sourcing_strategy = state.get("sourcing_strategy", "Direct Industry Experience")
    strategy_rationale = state.get("strategy_rationale", "")

    active_off_limits = {(n or "").strip().lower() for n in (state.get("off_limits_companies") or [])}
    active_exclusions = {(n or "").strip().lower() for n in (state.get("excluded_companies") or [])}
    custom_companies = state.get("custom_companies") or []

    final_companies: List[Dict[str, Any]] = []
    seen_names: Set[str] = set()

    for co in candidates:
        c_name = co["name"]
        c_lower = c_name.strip().lower()
        seen_names.add(c_lower)
        is_off = c_lower in active_off_limits
        is_excl = c_lower in active_exclusions

        final_companies.append({
            "name": c_name,
            "category": co.get("category", "other"),
            "tier": co.get("tier", f"{co.get('tier_level', 'Tier 2')} Sourcing Pool"),
            "tier_level": co.get("tier_level", "Tier 2"),
            "talent_pool_type": co.get("talent_pool_type", "Direct Talent Pool"),
            "location": co.get("location", "Pan-India Hubs"),
            "description": co.get("description", ""),
            "recommendation_reason": co.get("recommendation_reason", ""),
            "why_recommended": co.get("why_recommended", ""),
            "overlap_skills": co.get("overlap_skills", []),
            "transferable_skills": co.get("transferable_skills", []),
            "target_departments": co.get("target_departments", []),
            "headhunting_approach": co.get("headhunting_approach", ""),
            "relevance_score": co.get("relevance_score", 0.0),
            "confidence": co.get("confidence", "High" if float(co.get("relevance_score", 0)) >= 60 else "Medium"),
            "sourcing_strategy": sourcing_strategy,
            "is_off_limits": is_off,
            "is_excluded": is_excl,
            "is_targeted": False,
            "recruiter_status": "Off-Limits" if is_off else ("Excluded" if is_excl else "Available"),
        })

    # Prepend custom companies added by recruiter
    all_jd_skills = req.get("all_jd_skills", [])
    domain_label = req.get("domain_label", "Target Specialization")
    for cust in custom_companies:
        cust_name = (cust.get("name") or "").strip()
        if cust_name and cust_name.lower() not in seen_names:
            seen_names.add(cust_name.lower())
            cust_skills = all_jd_skills[:4] if all_jd_skills else [f"{domain_label} Competencies"]
            final_companies.insert(0, {
                "name": cust_name,
                "category": cust.get("category", "custom"),
                "tier": cust.get("tier", "Recruiter Custom Pool"),
                "tier_level": "Tier 1",
                "talent_pool_type": "Recruiter Custom Pool",
                "location": cust.get("location", "Not specified"),
                "description": cust.get("description", "Custom sourcing target defined by recruiter"),
                "recommendation_reason": f"Custom company added directly by recruiter for targeted headhunting across {', '.join(cust_skills[:3])}.",
                "why_recommended": f"Custom company added directly by recruiter for targeted headhunting across {', '.join(cust_skills[:3])}.",
                "overlap_skills": cust_skills,
                "transferable_skills": [],
                "target_departments": [],
                "headhunting_approach": f"Direct recruiter-specified outreach at {cust_name}.",
                "relevance_score": 100.0,
                "confidence": "High",
                "sourcing_strategy": sourcing_strategy,
                "is_off_limits": cust_name.lower() in active_off_limits,
                "is_excluded": cust_name.lower() in active_exclusions,
                "is_targeted": True,
                "recruiter_status": "Targeted",
            })

    final_result = {
        "job_id": job_id,
        "job_title": job_title,
        "ecosystem_name": selected_eco.get("name", "Target Corporate Sourcing Ecosystem"),
        "primary_strategy": sourcing_strategy,
        "strategy_rationale": strategy_rationale,
        "available_strategies": AVAILABLE_SOURCING_STRATEGIES,
        "total_companies_count": len(final_companies),
        "targeted_count": sum(1 for c in final_companies if c.get("is_targeted")),
        "excluded_count": len(active_exclusions),
        "off_limits_count": len(active_off_limits),
        "companies": final_companies,
        "intelligence_metadata": {
            "workflow_engine": "langgraph",
            "thread_id": state.get("thread_id"),
            "primary_domain": state.get("primary_domain"),
            "secondary_domains": state.get("secondary_domains", []),
            "classification_confidence": state.get("classification_confidence", 0.0),
            "classification_evidence": state.get("classification_evidence", []),
            "is_uncertain_fallback": bool(selected_eco.get("is_uncertain_fallback", False)),
            "jd_skills_used": all_jd_skills[:10],
            "tier_counts": {k: len(v) for k, v in (state.get("tier_classifications") or {}).items()},
            "ollama_used": bool(state.get("ollama_used", False)),
            "ollama_status": state.get("ollama_status", "skipped_or_fallback"),
            "validation_passed": bool((state.get("validation_results") or {}).get("passed", True)),
            "warnings": state.get("warnings", []),
        },
    }

    return {
        "final_result": final_result,
        "status": "completed",
        "updated_at": _now_iso(),
    }


# ---------------------------------------------------------------------------
# Graph Builder & Execution Helper
# ---------------------------------------------------------------------------
def build_target_company_graph(checkpointer=None) -> Any:
    """Construct and compile the dedicated Target Company Sourcing LangGraph."""
    graph = StateGraph(TargetCompanyState)

    graph.add_node("load_requisition", load_requisition_node)
    graph.add_node("analyze_job_description", analyze_job_description_node)
    graph.add_node("select_ecosystem", select_ecosystem_node)
    graph.add_node("retrieve_company_catalog", retrieve_company_catalog_node)
    graph.add_node("evaluate_company_relevance", evaluate_company_relevance_node)
    graph.add_node("classify_tiers", classify_tiers_node)
    graph.add_node("generate_sourcing_strategy", generate_sourcing_strategy_node)
    graph.add_node("validate_recommendations", validate_recommendations_node)
    graph.add_node("prepare_final_results", prepare_final_results_node)

    graph.add_edge(START, "load_requisition")
    graph.add_conditional_edges(
        "load_requisition",
        route_after_load,
        {
            "analyze_job_description": "analyze_job_description",
            "__end__": END,
        },
    )
    graph.add_edge("analyze_job_description", "select_ecosystem")
    graph.add_edge("select_ecosystem", "retrieve_company_catalog")
    graph.add_edge("retrieve_company_catalog", "evaluate_company_relevance")
    graph.add_edge("evaluate_company_relevance", "classify_tiers")
    graph.add_edge("classify_tiers", "generate_sourcing_strategy")
    graph.add_edge("generate_sourcing_strategy", "validate_recommendations")
    graph.add_edge("validate_recommendations", "prepare_final_results")
    graph.add_edge("prepare_final_results", END)

    compile_kwargs = {}
    if checkpointer is not None:
        compile_kwargs["checkpointer"] = checkpointer
    return graph.compile(**compile_kwargs)


# Requisition-scoped result cache keyed by (job_id, JD content hash, strategy/custom/exclusions, allow_llm)
_TARGET_COMPANY_CACHE: Dict[str, Dict[str, Any]] = {}


def _compute_cache_key(
    job_id: int,
    selected_strategy: Optional[str],
    custom_companies: Optional[List[Dict[str, Any]]],
    excluded_companies: Optional[List[str]],
    off_limits_companies: Optional[List[str]],
    allow_llm: bool,
) -> Optional[str]:
    """Compute a content-addressed cache key from the live SQLite Job record and caller options."""
    db = next(get_db())
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return None
        payload = {
            "job_id": job.id,
            "title": job.title,
            "description": job.description,
            "location": job.location,
            "required_skills": job.required_skills or [],
            "preferred_skills": job.preferred_skills or [],
            "selected_strategy": selected_strategy,
            "custom_companies": custom_companies or [],
            "excluded_companies": sorted(excluded_companies or []),
            "off_limits_companies": sorted(off_limits_companies or []),
            "allow_llm": allow_llm,
        }
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode("utf-8")).hexdigest()[:16]
        return f"{job_id}:{digest}"
    finally:
        db.close()


def run_target_company_graph(
    job_id: int,
    selected_strategy: Optional[str] = None,
    custom_companies: Optional[List[Dict[str, Any]]] = None,
    excluded_companies: Optional[List[str]] = None,
    off_limits_companies: Optional[List[str]] = None,
    use_checkpointer: bool = True,
    allow_llm: bool = True,
    use_cache: bool = True,
) -> Dict[str, Any]:
    """Execute the Target Company Sourcing workflow for one requisition with SQLite checkpointing."""
    cache_key = (
        _compute_cache_key(job_id, selected_strategy, custom_companies, excluded_companies, off_limits_companies, allow_llm)
        if use_cache
        else None
    )
    if cache_key and cache_key in _TARGET_COMPANY_CACHE:
        return _TARGET_COMPANY_CACHE[cache_key]

    thread_id = f"target-company-job-{job_id}"
    checkpointer = get_sqlite_checkpointer() if use_checkpointer else None
    app = build_target_company_graph(checkpointer=checkpointer)

    initial_state: TargetCompanyState = {
        "workflow_id": f"tc-{uuid.uuid4().hex[:10]}",
        "thread_id": thread_id,
        "job_id": job_id,
        "selected_strategy": selected_strategy,
        "custom_companies": list(custom_companies or []),
        "excluded_companies": list(excluded_companies or []),
        "off_limits_companies": list(off_limits_companies or []),
        "allow_llm": allow_llm,
        "ollama_used": False,
        "ollama_status": "skipped_or_fallback",
        "selected_ecosystem": {},
        "company_candidates": [],
        "final_result": {},
        "status": "pending",
        "errors": [],
        "warnings": [],
        "retry_count": 0,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }

    config = {"configurable": {"thread_id": thread_id}} if use_checkpointer else {}
    final_state = app.invoke(initial_state, config=config)

    if final_state.get("status") == "failed" or final_state.get("errors"):
        err_msg = "; ".join(final_state.get("errors") or ["Target company workflow failed."])
        return {"error": err_msg, "companies": [], "job_id": job_id}

    result = final_state.get("final_result") or {"error": "No result produced", "companies": [], "job_id": job_id}
    if cache_key and "error" not in result:
        if len(_TARGET_COMPANY_CACHE) > 100:
            _TARGET_COMPANY_CACHE.clear()
        _TARGET_COMPANY_CACHE[cache_key] = result
    return result
