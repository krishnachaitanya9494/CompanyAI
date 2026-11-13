"""Phase 2 Feature C: Strategic Sourcing Intelligence service.

Generates advisory, evidence-backed sourcing recommendations for open jobs
using Phase 1 skill taxonomy and Phase 2 supply/demand metrics. Never
automatically modifies job requirements, matching scores, or candidate records.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List, Set
from sqlalchemy.orm import Session

from database.models import Candidate, Interview, Job
from app.services.market_intelligence_service import (
    get_candidate_canonical_skills,
    get_skill_category,
    is_job_open,
    normalize_availability,
    normalize_location,
)
from app.services.skill_taxonomy_service import (
    get_related_adjacent_skills,
    normalize_skills_list,
)
from app.services.talent_supply_demand_service import (
    _candidate_matches_job_location,
    get_job_supply_demand_detail,
)


def _make_recommendation(
    rec_id: str,
    title: str,
    reason: str,
    supporting_evidence: str,
    relevant_requirements: List[str],
    related_skills: List[str],
    sourcing_priority: str,
    information_type: str,
    confidence: str,
    action_type: str,
) -> Dict[str, Any]:
    """Construct a standardized advisory sourcing recommendation item."""
    return {
        "id": rec_id,
        "title": title,
        "reason": reason,
        "supporting_evidence": supporting_evidence,
        "relevant_requirements": relevant_requirements,
        "related_skills": related_skills,
        "sourcing_priority": sourcing_priority,
        "information_type": information_type,
        "confidence": confidence,
        "action_type": action_type,
        "advisory_only": True,
        "requires_recruiter_review": True,
    }


def get_job_sourcing_recommendations(db: Session, job_id: int) -> Dict[str, Any]:
    """Analyze a job's requirements against internal supply and produce advisory sourcing strategies."""
    supply_detail = get_job_supply_demand_detail(db, job_id)
    job = db.query(Job).filter(Job.id == job_id).first()
    candidates = db.query(Candidate).order_by(Candidate.id.asc()).all()

    job_loc = supply_detail["job"]["location"]
    min_exp = supply_detail["job"]["min_experience_years"]
    openings = supply_detail["job"]["openings_count"]
    mandatory_rows = supply_detail["mandatory_skill_supply"]
    req_canon = [r["skill"] for r in mandatory_rows]
    req_set = set(req_canon)

    recommendations: List[Dict[str, Any]] = []

    # 1. Prioritize sourcing for scarce mandatory skills.
    scarce_mandatory = [
        r for r in mandatory_rows if r["classification"] in ("Critical Shortage", "Low Supply")
    ]
    if scarce_mandatory:
        scarce_names = [r["skill"] for r in scarce_mandatory]
        evidence_parts = [
            f"{r['skill']}: {r['total_candidates']} candidate(s) vs {openings} opening(s) ({r['classification']})"
            for r in scarce_mandatory
        ]
        has_critical = any(r["classification"] == "Critical Shortage" for r in scarce_mandatory)
        recommendations.append(
            _make_recommendation(
                rec_id=f"job-{job_id}-scarce-mandatory",
                title=f"Prioritize external sourcing for scarce mandatory skills ({', '.join(scarce_names[:3])})",
                reason=(
                    f"{len(scarce_mandatory)} mandatory requirement(s) fall below the balanced supply "
                    "threshold in the internal candidate database."
                ),
                supporting_evidence="; ".join(evidence_parts),
                relevant_requirements=scarce_names,
                related_skills=[],
                sourcing_priority="Critical" if has_critical else "High",
                information_type="Verified database fact & Calculated metric",
                confidence="High",
                action_type="External Sourcing Priority",
            )
        )

    # 2. Identify alternative/adjacent technology backgrounds worth exploring (never treated as exact).
    adjacent_items = get_related_adjacent_skills(req_canon)
    adj_candidates_found: List[Dict[str, Any]] = []
    if adjacent_items:
        cand_skills_map = {c.id: get_candidate_canonical_skills(c) for c in candidates}
        for adj in adjacent_items:
            adj_skill = adj["skill"]
            if adj_skill in req_set:
                continue
            matching_cids = [
                c.id
                for c in candidates
                if adj_skill in cand_skills_map[c.id] and not req_set.issubset(cand_skills_map[c.id])
            ]
            if matching_cids:
                adj_candidates_found.append(
                    {
                        "adjacent_skill": adj_skill,
                        "source_mandatory_skill": ", ".join(adj.get("derived_from_verified_skills", [])),
                        "candidate_count": len(matching_cids),
                    }
                )
        adj_candidates_found.sort(key=lambda x: x["candidate_count"], reverse=True)

    if adj_candidates_found:
        top_adj = adj_candidates_found[:4]
        recommendations.append(
            _make_recommendation(
                rec_id=f"job-{job_id}-adjacent-tech",
                title="Explore candidates with related adjacent technology backgrounds",
                reason=(
                    "Internal candidates hold adjacent technologies mapped in the skill taxonomy. "
                    "These are NOT exact matches and require technical screening for ramp-up readiness."
                ),
                supporting_evidence="; ".join(
                    f"{a['adjacent_skill']} (adjacent to {a['source_mandatory_skill']}): {a['candidate_count']} candidate(s)"
                    for a in top_adj
                ),
                relevant_requirements=list({a["source_mandatory_skill"] for a in top_adj}),
                related_skills=[a["adjacent_skill"] for a in top_adj],
                sourcing_priority="Medium",
                information_type="Inferred suitability (Adjacent skill taxonomy)",
                confidence="Medium",
                action_type="Adjacent Talent Pool",
            )
        )

    # 3. Recommend related skill combinations frequently co-occurring with job requirements.
    if req_canon:
        co_counter: Counter[str] = Counter()
        for c in candidates:
            c_skills = get_candidate_canonical_skills(c)
            if c_skills & req_set:
                for sk in c_skills - req_set:
                    co_counter[sk] += 1
        top_combos = [sk for sk, cnt in co_counter.most_common(5) if cnt >= 2]
        if top_combos:
            recommendations.append(
                _make_recommendation(
                    rec_id=f"job-{job_id}-skill-combos",
                    title="Target Boolean/sourcing strings with common complementary skill combinations",
                    reason="Candidates matching at least one job requirement frequently pair these complementary technologies.",
                    supporting_evidence=", ".join(
                        f"{sk} ({co_counter[sk]} co-occurring candidates)" for sk in top_combos
                    ),
                    relevant_requirements=req_canon[:5],
                    related_skills=top_combos,
                    sourcing_priority="Low",
                    information_type="Calculated metric",
                    confidence="Medium",
                    action_type="Search Query Optimization",
                )
            )

    # 4. Find underutilized candidates already present in the database (early stages, not rejected/hired).
    underutilized = []
    near_miss_exp = 0
    non_local_qualified = 0
    non_local_locs: Counter[str] = Counter()
    cand_skills_map = {c.id: get_candidate_canonical_skills(c) for c in candidates}

    # Check candidates who already have active interviews so we don't call them underutilized.
    interviewed_cids = {
        iv.candidate_id for iv in db.query(Interview).all()
    }

    for c in candidates:
        c_skills = cand_skills_map[c.id]
        if not req_set:
            continue
        overlap = req_set & c_skills
        overlap_ratio = len(overlap) / len(req_set)
        stage_low = (c.stage or "New").strip().lower()

        if overlap_ratio >= 0.5 and stage_low in {"new", "reviewed", "sourced"} and c.id not in interviewed_cids:
            underutilized.append(c)

        if req_set.issubset(c_skills):
            c_loc = normalize_location(c.location)
            if job_loc not in ("Unspecified", "Remote") and not _candidate_matches_job_location(c_loc, job_loc):
                non_local_qualified += 1
                non_local_locs[c_loc] += 1
            if min_exp is not None and c.experience_years is not None:
                if (min_exp - 2.0) <= float(c.experience_years) < min_exp:
                    near_miss_exp += 1

    if underutilized:
        recommendations.append(
            _make_recommendation(
                rec_id=f"job-{job_id}-underutilized",
                title=f"Re-engage {len(underutilized)} underutilized internal candidate(s) in early pipeline stages",
                reason=(
                    "Candidates in New/Reviewed stages already cover >=50% of mandatory skills and have not "
                    "been interviewed for this requisition."
                ),
                supporting_evidence=", ".join(
                    f"{c.name or f'Candidate #{c.id}'} ({c.stage}, {normalize_location(c.location)})"
                    for c in underutilized[:5]
                ),
                relevant_requirements=req_canon,
                related_skills=[],
                sourcing_priority="High",
                information_type="Verified database fact & Calculated metric",
                confidence="High",
                action_type="Internal Rediscovery",
            )
        )

    # 5. Recommend location expansion when location restrictions limit supply.
    if non_local_qualified > 0:
        recommendations.append(
            _make_recommendation(
                rec_id=f"job-{job_id}-location-expansion",
                title=f"Consider location expansion or remote/hybrid flexibility (+{non_local_qualified} qualified candidate(s))",
                reason=(
                    f"Restricting sourcing strictly to '{job_loc}' excludes {non_local_qualified} internal "
                    "candidate(s) who match 100% of mandatory skills."
                ),
                supporting_evidence="Non-local supply by city: " + ", ".join(
                    f"{loc} ({cnt})" for loc, cnt in non_local_locs.most_common(4)
                ),
                relevant_requirements=req_canon,
                related_skills=[],
                sourcing_priority="High" if (supply_detail["fully_qualified_candidates"] or 0) < openings else "Medium",
                information_type="Verified database fact & Calculated metric",
                confidence="High",
                action_type="Location Flexibility (Recruiter Review)",
            )
        )

    # 6. Recommend experience-range flexibility only for recruiter review & approval.
    if near_miss_exp > 0 and min_exp is not None:
        recommendations.append(
            _make_recommendation(
                rec_id=f"job-{job_id}-exp-flexibility",
                title=f"Review experience-range flexibility ({near_miss_exp} near-threshold candidate(s))",
                reason=(
                    f"{near_miss_exp} candidate(s) match all mandatory skills with {max(0.0, min_exp - 2.0):.1f}–{min_exp:.1f} yrs "
                    f"experience (within 2 years below the {min_exp:.1f} yr requirement). Requires recruiter approval."
                ),
                supporting_evidence=f"Found {near_miss_exp} skill-qualified candidate(s) within 2 years of min_experience_years={min_exp}.",
                relevant_requirements=req_canon,
                related_skills=[],
                sourcing_priority="Medium",
                information_type="Calculated metric (Advisory only)",
                confidence="Medium",
                action_type="Requirement Calibration (Recruiter Approval Required)",
            )
        )

    # 7. Urgency & priority sourcing callout when job is High/Urgent priority.
    if job and (job.priority or "").strip().lower() in {"high", "urgent"} and (supply_detail["fully_qualified_candidates"] or 0) < openings * 2:
        recommendations.append(
            _make_recommendation(
                rec_id=f"job-{job_id}-urgency",
                title=f"Escalate parallel sourcing channels for {job.priority}-priority requisition",
                reason=(
                    f"Job is marked '{job.priority}' priority with {openings} opening(s), while only "
                    f"{supply_detail['fully_qualified_candidates'] or 0} fully qualified internal candidate(s) exist."
                ),
                supporting_evidence=f"priority={job.priority}, openings={openings}, fully_qualified={supply_detail['fully_qualified_candidates']}",
                relevant_requirements=req_canon,
                related_skills=[],
                sourcing_priority="Critical",
                information_type="Verified database fact",
                confidence="High",
                action_type="Urgent Escalation",
            )
        )

    if not recommendations:
        recommendations.append(
            _make_recommendation(
                rec_id=f"job-{job_id}-insufficient-or-healthy",
                title="Maintain standard sourcing workflow" if req_canon else "Insufficient Data for targeted sourcing recommendations",
                reason=(
                    "Internal candidate supply appears adequate for the specified requirements."
                    if req_canon
                    else "This job has no structured mandatory skills recorded in SQLite yet."
                ),
                supporting_evidence=f"mandatory_skills_count={len(req_canon)}, fully_qualified={supply_detail['fully_qualified_candidates']}",
                relevant_requirements=req_canon,
                related_skills=[],
                sourcing_priority="Low",
                information_type="Verified database fact",
                confidence="High" if req_canon else "Low",
                action_type="Standard Pipeline",
            )
        )

    return {
        "job": supply_detail["job"],
        "advisory_only": True,
        "requires_recruiter_review": True,
        "recommendations_count": len(recommendations),
        "recommendations": recommendations,
    }


def get_job_sourcing_alternatives(db: Session, job_id: int, limit: int = 25) -> Dict[str, Any]:
    """Identify specific internal candidates with exact/alias vs transferable/adjacent skill fits."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise ValueError(f"Job #{job_id} not found.")

    req_norm = normalize_skills_list(job.required_skills or [])
    req_canon = list(dict.fromkeys(s["canonical"] for s in req_norm if s.get("canonical")))
    req_set = set(req_canon)

    adjacent_items = get_related_adjacent_skills(req_canon)
    adj_to_targets: Dict[str, List[str]] = {}
    for item in adjacent_items:
        for src in item.get("derived_from_verified_skills", []):
            adj_to_targets.setdefault(item["skill"], []).append(src)

    candidates = db.query(Candidate).order_by(Candidate.id.asc()).all()
    alternative_candidates: List[Dict[str, Any]] = []

    for cand in candidates:
        c_skills = get_candidate_canonical_skills(cand)
        exact_matched = sorted(c_skills & req_set)
        adjacent_matched = sorted(sk for sk in (c_skills - req_set) if sk in adj_to_targets)
        missing_mandatory = sorted(req_set - c_skills)

        if not exact_matched and not adjacent_matched:
            continue
        # Focus on candidates who are partial/adjacent fits rather than 100% exact fits.
        if len(exact_matched) == len(req_set) and req_set:
            continue

        score_heuristic = round(
            ((len(exact_matched) * 1.0 + len(adjacent_matched) * 0.45) / max(len(req_set), 1)) * 100.0,
            1,
        )
        alternative_candidates.append(
            {
                "candidate_id": cand.id,
                "name": cand.name or f"Candidate #{cand.id}",
                "stage": cand.stage,
                "location": normalize_location(cand.location),
                "experience_years": cand.experience_years,
                "availability": normalize_availability(cand.availability),
                "exact_skills_matched": exact_matched,
                "adjacent_skills_matched": [
                    {"skill": sk, "adjacent_to": adj_to_targets[sk], "match_type": "related_adjacent"}
                    for sk in adjacent_matched
                ],
                "missing_mandatory_skills": missing_mandatory,
                "transferability_indicator": min(100.0, score_heuristic),
                "information_type": "Inferred suitability (Exact vs Adjacent taxonomy)",
            }
        )

    alternative_candidates.sort(
        key=lambda x: (len(x["exact_skills_matched"]), len(x["adjacent_skills_matched"]), x["transferability_indicator"]),
        reverse=True,
    )

    return {
        "job_id": job.id,
        "job_title": job.title,
        "advisory_only": True,
        "mandatory_skills": req_canon,
        "adjacent_skills_considered": adjacent_items,
        "total_alternative_candidates": len(alternative_candidates),
        "candidates": alternative_candidates[:limit],
    }


def get_candidate_sourcing_opportunities(
    db: Session,
    limit: int = 25,
    offset: int = 0,
) -> Dict[str, Any]:
    """Identify underutilized internal candidates in early stages who match open jobs."""
    candidates = db.query(Candidate).order_by(Candidate.id.asc()).all()
    open_jobs = [j for j in db.query(Job).order_by(Job.id.asc()).all() if is_job_open(j)]

    job_req_map = {
        j.id: {s["canonical"] for s in normalize_skills_list(j.required_skills or []) if s.get("canonical")}
        for j in open_jobs
    }
    job_map = {j.id: j for j in open_jobs}

    opportunities: List[Dict[str, Any]] = []
    for cand in candidates:
        stage_low = (cand.stage or "New").strip().lower()
        if stage_low in {"hired", "rejected", "offer extended", "withdrawn"}:
            continue
        c_skills = get_candidate_canonical_skills(cand)
        if not c_skills:
            continue

        matched_jobs = []
        for jid, reqs in job_req_map.items():
            if not reqs:
                continue
            overlap = c_skills & reqs
            coverage = len(overlap) / len(reqs)
            if coverage >= 0.5:
                job = job_map[jid]
                matched_jobs.append(
                    {
                        "job_id": jid,
                        "title": job.title,
                        "client_name": job.client_name,
                        "mandatory_coverage_pct": round(coverage * 100.0, 1),
                        "matched_skills": sorted(overlap),
                    }
                )

        if matched_jobs:
            matched_jobs.sort(key=lambda x: x["mandatory_coverage_pct"], reverse=True)
            opportunities.append(
                {
                    "candidate_id": cand.id,
                    "name": cand.name or f"Candidate #{cand.id}",
                    "stage": cand.stage,
                    "location": normalize_location(cand.location),
                    "experience_years": cand.experience_years,
                    "availability": normalize_availability(cand.availability),
                    "skills_count": len(c_skills),
                    "matching_open_jobs_count": len(matched_jobs),
                    "top_matching_jobs": matched_jobs[:3],
                    "information_type": "Verified database fact & Calculated metric",
                }
            )

    opportunities.sort(
        key=lambda x: (x["matching_open_jobs_count"], x["top_matching_jobs"][0]["mandatory_coverage_pct"]),
        reverse=True,
    )
    return {
        "advisory_only": True,
        "total": len(opportunities),
        "limit": limit,
        "offset": offset,
        "items": opportunities[offset : offset + limit],
    }
