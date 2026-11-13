"""Phase 2 Feature B: Talent Supply & Demand Intelligence service.

Compares unique internal candidate supply against open job skill, experience,
location, and headcount demand using configurable, transparent thresholds.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional, Set
from sqlalchemy.orm import Session

from database.models import Candidate, Job
from app.services.market_intelligence_service import (
    EXPERIENCE_BANDS,
    classify_experience_band,
    get_candidate_canonical_skills,
    get_skill_category,
    is_job_open,
    normalize_availability,
    normalize_location,
)
from app.services.skill_taxonomy_service import normalize_skills_list

# Configurable supply-to-demand ratio thresholds (unique matching candidates / total openings).
SUPPLY_DEMAND_THRESHOLDS: Dict[str, Any] = {
    "high_supply_min_ratio": 5.0,
    "balanced_supply_min_ratio": 2.0,
    "low_supply_min_ratio": 1.0,
    "available_statuses": ["Immediate", "Within 15 Days", "Within 30 Days"],
    "methodology": (
        "For each canonical skill required by open jobs, unique candidates possessing the skill "
        "are counted once (never double-counted across aliases or multiple resumes). "
        "Supply-to-demand ratio = unique_candidates / total_openings. "
        "Tiers: High Supply (>= 5.0), Balanced Supply (>= 2.0), Low Supply (>= 1.0), "
        "Critical Shortage (< 1.0). Insufficient Data is returned when no open jobs or candidate "
        "skill records exist for evaluation."
    ),
}


def classify_supply_demand(
    unique_candidates: int,
    total_openings: int,
    thresholds: Dict[str, Any] = SUPPLY_DEMAND_THRESHOLDS,
) -> tuple[Optional[float], str]:
    """Return (supply_to_demand_ratio, classification) using configurable thresholds."""
    if total_openings <= 0 and unique_candidates <= 0:
        return None, "Insufficient Data"
    if total_openings <= 0:
        return None, "High Supply" if unique_candidates >= 5 else "Balanced Supply"

    ratio = round(unique_candidates / total_openings, 2)
    if ratio >= thresholds["high_supply_min_ratio"]:
        return ratio, "High Supply"
    if ratio >= thresholds["balanced_supply_min_ratio"]:
        return ratio, "Balanced Supply"
    if ratio >= thresholds["low_supply_min_ratio"]:
        return ratio, "Low Supply"
    return ratio, "Critical Shortage"


def _candidate_matches_job_location(cand_loc: str, job_loc: str) -> bool:
    """Check whether a candidate location satisfies a job's normalized location."""
    if job_loc in ("Unspecified", "Remote") or cand_loc == "Remote":
        return True
    return cand_loc.lower() == job_loc.lower()


def _compute_skill_supply_demand_rows(
    db: Session,
    thresholds: Dict[str, Any] = SUPPLY_DEMAND_THRESHOLDS,
) -> tuple[List[Dict[str, Any]], List[Candidate], List[Job]]:
    """Aggregate unique candidate supply and open-job demand for every canonical skill."""
    candidates = db.query(Candidate).order_by(Candidate.id.asc()).all()
    open_jobs = [j for j in db.query(Job).order_by(Job.id.asc()).all() if is_job_open(j)]

    # Precompute candidate metadata once for O(1) lookups.
    cand_skills_map: Dict[int, Set[str]] = {}
    skill_to_cand_ids: Dict[str, Set[int]] = defaultdict(set)
    cand_map: Dict[int, Candidate] = {}

    for cand in candidates:
        cand_map[cand.id] = cand
        c_skills = get_candidate_canonical_skills(cand)
        cand_skills_map[cand.id] = c_skills
        for sk in c_skills:
            skill_to_cand_ids[sk].add(cand.id)

    # Aggregate job demand per canonical skill.
    demand_jobs: Dict[str, List[Job]] = defaultdict(list)
    mandatory_job_ids: Dict[str, Set[int]] = defaultdict(set)
    preferred_job_ids: Dict[str, Set[int]] = defaultdict(set)

    for job in open_jobs:
        req_canon = {s["canonical"] for s in normalize_skills_list(job.required_skills or []) if s.get("canonical")}
        pref_canon = {s["canonical"] for s in normalize_skills_list(job.preferred_skills or []) if s.get("canonical")}
        for sk in req_canon:
            mandatory_job_ids[sk].add(job.id)
        for sk in pref_canon:
            preferred_job_ids[sk].add(job.id)
        for sk in req_canon | pref_canon:
            demand_jobs[sk].append(job)

    available_set = set(thresholds["available_statuses"])
    rows: List[Dict[str, Any]] = []

    for sk, jobs_list in demand_jobs.items():
        unique_cids = skill_to_cand_ids.get(sk, set())
        total_openings = sum(max(1, int(j.openings_count or 1)) for j in jobs_list)

        # Determine minimum experience and target locations across jobs requiring this skill.
        min_exps = [float(j.min_experience_years) for j in jobs_list if j.min_experience_years is not None]
        lowest_min_exp = min(min_exps) if min_exps else None
        target_locs = {normalize_location(j.location) for j in jobs_list}

        exp_matched_cids: Set[int] = set()
        loc_matched_cids: Set[int] = set()
        avail_cids: Set[int] = set()
        avail_recorded_cids: Set[int] = set()

        for cid in unique_cids:
            cand = cand_map[cid]
            if lowest_min_exp is None or (cand.experience_years is not None and float(cand.experience_years) >= lowest_min_exp):
                exp_matched_cids.add(cid)

            c_loc = normalize_location(cand.location)
            if any(_candidate_matches_job_location(c_loc, j_loc) for j_loc in target_locs):
                loc_matched_cids.add(cid)

            av_norm = normalize_availability(cand.availability)
            if av_norm != "Not Recorded":
                avail_recorded_cids.add(cid)
                if av_norm in available_set:
                    avail_cids.add(cid)

        ratio, classification = classify_supply_demand(len(unique_cids), total_openings, thresholds)
        rows.append(
            {
                "skill": sk,
                "category": get_skill_category(sk),
                "total_candidates": len(unique_cids),
                "experience_matched_candidates": len(exp_matched_cids),
                "experience_filter_applied": lowest_min_exp is not None,
                "lowest_min_experience_required": lowest_min_exp,
                "location_matched_candidates": len(loc_matched_cids),
                "available_candidates": len(avail_cids),
                "availability_recorded_candidates": len(avail_recorded_cids),
                "open_jobs_requiring": len(jobs_list),
                "mandatory_jobs_count": len(mandatory_job_ids.get(sk, set())),
                "preferred_jobs_count": len(preferred_job_ids.get(sk, set())),
                "total_openings": total_openings,
                "supply_to_demand_ratio": ratio,
                "classification": classification,
                "information_type": "Verified database fact & Calculated metric",
            }
        )

    severity_rank = {
        "Critical Shortage": 0,
        "Low Supply": 1,
        "Balanced Supply": 2,
        "High Supply": 3,
        "Insufficient Data": 4,
    }
    rows.sort(
        key=lambda r: (
            severity_rank.get(r["classification"], 5),
            -r["total_openings"],
            r["total_candidates"],
        )
    )
    return rows, candidates, open_jobs


def get_supply_demand_overview(db: Session) -> Dict[str, Any]:
    """Return overall Supply vs Demand intelligence, shortage counts, and breakdowns."""
    rows, candidates, open_jobs = _compute_skill_supply_demand_rows(db)
    tier_counts = Counter(r["classification"] for r in rows)
    total_openings = sum(max(1, int(j.openings_count or 1)) for j in open_jobs)

    # Experience-wise and location-wise supply summaries across the candidate pool.
    exp_counts = Counter(classify_experience_band(c.experience_years) for c in candidates)
    loc_counts = Counter(normalize_location(c.location) for c in candidates)

    # Job-wise quick coverage summary.
    job_summaries = []
    for job in open_jobs[:25]:
        detail = get_job_supply_demand_detail(db, job.id)
        job_summaries.append(
            {
                "job_id": job.id,
                "title": job.title,
                "client_name": job.client_name,
                "location": normalize_location(job.location),
                "openings_count": max(1, int(job.openings_count or 1)),
                "mandatory_skills_count": len(detail["mandatory_skill_supply"]),
                "fully_qualified_candidates": detail["fully_qualified_candidates"],
                "overall_skill_coverage_pct": detail["overall_skill_coverage_pct"],
                "critical_shortage_skills": detail["critical_shortage_skills"],
            }
        )

    return {
        "scope_label": "Internal Talent Supply & Demand Intelligence",
        "methodology": SUPPLY_DEMAND_THRESHOLDS,
        "summary": {
            "total_candidates": len(candidates),
            "open_jobs_count": len(open_jobs),
            "total_openings": total_openings,
            "skills_in_demand_count": len(rows),
            "critical_shortage_count": tier_counts.get("Critical Shortage", 0),
            "low_supply_count": tier_counts.get("Low Supply", 0),
            "balanced_supply_count": tier_counts.get("Balanced Supply", 0),
            "high_supply_count": tier_counts.get("High Supply", 0),
            "insufficient_data_count": tier_counts.get("Insufficient Data", 0),
            "information_type": "Verified database fact & Calculated metric",
        },
        "classification_breakdown": [
            {"classification": cls, "skill_count": tier_counts.get(cls, 0)}
            for cls in ["Critical Shortage", "Low Supply", "Balanced Supply", "High Supply", "Insufficient Data"]
        ],
        "top_demand_vs_supply": rows[:15],
        "critical_shortages": [r for r in rows if r["classification"] in ("Critical Shortage", "Low Supply")][:15],
        "experience_supply": [
            {"band": b, "candidate_count": exp_counts.get(b, 0)} for b in EXPERIENCE_BANDS
        ],
        "location_supply": [
            {"location": loc, "candidate_count": cnt} for loc, cnt in loc_counts.most_common(10)
        ],
        "job_coverage_summary": job_summaries,
    }


def get_supply_demand_skills(
    db: Session,
    classification: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    """Return paginated skill-level Supply & Demand metrics with optional filters."""
    rows, _, _ = _compute_skill_supply_demand_rows(db)
    if classification and classification.strip():
        cls_low = classification.strip().lower()
        rows = [r for r in rows if r["classification"].lower() == cls_low]
    if category and category.strip():
        cat_low = category.strip().lower()
        rows = [r for r in rows if r["category"].lower() == cat_low]

    return {
        "methodology": SUPPLY_DEMAND_THRESHOLDS,
        "total": len(rows),
        "limit": limit,
        "offset": offset,
        "items": rows[offset : offset + limit],
    }


def get_supply_demand_shortages(db: Session) -> Dict[str, Any]:
    """Return skills currently classified as Critical Shortage or Low Supply."""
    rows, _, _ = _compute_skill_supply_demand_rows(db)
    shortages = [r for r in rows if r["classification"] in ("Critical Shortage", "Low Supply")]
    return {
        "methodology": SUPPLY_DEMAND_THRESHOLDS,
        "total_shortage_skills": len(shortages),
        "critical_count": sum(1 for r in shortages if r["classification"] == "Critical Shortage"),
        "low_supply_count": sum(1 for r in shortages if r["classification"] == "Low Supply"),
        "items": shortages,
    }


def get_job_supply_demand_detail(db: Session, job_id: int) -> Dict[str, Any]:
    """Drill down into skill-by-skill internal supply for a specific job."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise ValueError(f"Job #{job_id} not found.")

    candidates = db.query(Candidate).order_by(Candidate.id.asc()).all()
    openings = max(1, int(job.openings_count or 1))
    job_loc = normalize_location(job.location)
    min_exp = float(job.min_experience_years) if job.min_experience_years is not None else None
    max_exp = float(job.max_experience_years) if job.max_experience_years is not None else None

    req_canon = [s["canonical"] for s in normalize_skills_list(job.required_skills or []) if s.get("canonical")]
    pref_canon = [s["canonical"] for s in normalize_skills_list(job.preferred_skills or []) if s.get("canonical")]
    # Deduplicate preserving order.
    req_canon = list(dict.fromkeys(req_canon))
    pref_canon = list(dict.fromkeys(pref_canon))

    cand_skills_map = {c.id: get_candidate_canonical_skills(c) for c in candidates}
    available_set = set(SUPPLY_DEMAND_THRESHOLDS["available_statuses"])

    def _analyze_skill_list(skills: List[str], requirement_type: str) -> List[Dict[str, Any]]:
        results = []
        for sk in skills:
            matched_cids: Set[int] = set()
            exp_cids: Set[int] = set()
            loc_cids: Set[int] = set()
            eligible_cids: Set[int] = set()
            avail_cids: Set[int] = set()

            for cand in candidates:
                if sk not in cand_skills_map[cand.id]:
                    continue
                matched_cids.add(cand.id)
                exp_ok = min_exp is None or (cand.experience_years is not None and float(cand.experience_years) >= min_exp)
                loc_ok = _candidate_matches_job_location(normalize_location(cand.location), job_loc)
                if exp_ok:
                    exp_cids.add(cand.id)
                if loc_ok:
                    loc_cids.add(cand.id)
                if exp_ok and loc_ok:
                    eligible_cids.add(cand.id)
                if normalize_availability(cand.availability) in available_set:
                    avail_cids.add(cand.id)

            ratio, classification = classify_supply_demand(len(matched_cids), openings)
            results.append(
                {
                    "skill": sk,
                    "category": get_skill_category(sk),
                    "requirement_type": requirement_type,
                    "total_candidates": len(matched_cids),
                    "experience_matched_candidates": len(exp_cids),
                    "location_matched_candidates": len(loc_cids),
                    "eligible_candidates": len(eligible_cids),
                    "available_candidates": len(avail_cids),
                    "supply_to_demand_ratio": ratio,
                    "classification": classification,
                    "information_type": "Verified database fact & Calculated metric",
                }
            )
        return results

    mandatory_supply = _analyze_skill_list(req_canon, "mandatory")
    preferred_supply = _analyze_skill_list(pref_canon, "preferred")

    # Calculate how many unique candidates satisfy ALL mandatory skills (+ exp & location).
    req_set = set(req_canon)
    skill_qualified_cands = 0
    fully_qualified_cands = 0
    for cand in candidates:
        if not req_set:
            continue
        if req_set.issubset(cand_skills_map[cand.id]):
            skill_qualified_cands += 1
            exp_ok = min_exp is None or (cand.experience_years is not None and float(cand.experience_years) >= min_exp)
            loc_ok = _candidate_matches_job_location(normalize_location(cand.location), job_loc)
            if exp_ok and loc_ok:
                fully_qualified_cands += 1

    covered_mandatory = sum(1 for r in mandatory_supply if r["total_candidates"] > 0)
    overall_coverage = round((covered_mandatory / len(mandatory_supply)) * 100.0, 1) if mandatory_supply else None
    critical_shortage_skills = [
        r["skill"] for r in mandatory_supply if r["classification"] in ("Critical Shortage", "Low Supply")
    ]

    return {
        "job": {
            "id": job.id,
            "title": job.title,
            "client_name": job.client_name,
            "status": job.status,
            "location": job_loc,
            "work_mode": job.work_mode,
            "openings_count": openings,
            "min_experience_years": min_exp,
            "max_experience_years": max_exp,
            "priority": job.priority,
        },
        "overall_skill_coverage_pct": overall_coverage,
        "skill_qualified_candidates": skill_qualified_cands if req_set else None,
        "fully_qualified_candidates": fully_qualified_cands if req_set else None,
        "critical_shortage_skills": critical_shortage_skills,
        "mandatory_skill_supply": mandatory_supply,
        "preferred_skill_supply": preferred_supply,
        "data_status": "Available" if (mandatory_supply or preferred_supply) else "Insufficient Data",
        "information_type": "Verified database fact & Calculated metric",
    }
