"""Phase 2 Feature A: Internal Talent Market Intelligence service.

Analyzes the company's persisted candidate, resume, job, and skill records
in SQLite. Explicitly labels all outputs as "Internal Talent Market Intelligence"
and never fabricates external market statistics or salary benchmarks.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from itertools import combinations
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy.orm import Session

from database.models import Candidate, Job, Resume
from app.services.matching_engine_service import get_resume_text_and_provenance
from app.services.skill_taxonomy_service import (
    SKILL_CATALOG,
    extract_structured_resume_facts,
    normalize_skill,
    normalize_skills_list,
)

# Canonical location alias map for consistent aggregation across candidates and jobs.
LOCATION_ALIASES: Dict[str, str] = {
    "bangalore": "Bengaluru",
    "bengaluru": "Bengaluru",
    "blr": "Bengaluru",
    "hyderabad": "Hyderabad",
    "hyd": "Hyderabad",
    "pune": "Pune",
    "chennai": "Chennai",
    "mumbai": "Mumbai",
    "delhi": "Delhi NCR",
    "new delhi": "Delhi NCR",
    "ncr": "Delhi NCR",
    "delhi ncr": "Delhi NCR",
    "gurgaon": "Delhi NCR",
    "gurugram": "Delhi NCR",
    "noida": "Delhi NCR",
    "remote": "Remote",
    "work from home": "Remote",
    "wfh": "Remote",
    "usa": "United States",
    "us": "United States",
    "united states": "United States",
}

EXPERIENCE_BANDS: List[str] = [
    "0-2 yrs (Junior)",
    "2-5 yrs (Mid-Level)",
    "5-9 yrs (Senior)",
    "9+ yrs (Lead/Principal)",
    "Unspecified",
]


def normalize_location(raw: Optional[str]) -> str:
    """Normalize a raw location string to a canonical city/region label."""
    if not raw or not str(raw).strip():
        return "Unspecified"
    cleaned = str(raw).strip()
    # Handle comma-separated city, state/country by checking first token and full string.
    lower_full = cleaned.lower()
    if lower_full in LOCATION_ALIASES:
        return LOCATION_ALIASES[lower_full]
    first_part = cleaned.split(",")[0].strip().lower()
    if first_part in LOCATION_ALIASES:
        return LOCATION_ALIASES[first_part]
    return cleaned.split(",")[0].strip().title()


def classify_experience_band(years: Optional[float]) -> str:
    """Bucket candidate experience_years into standard recruitment bands."""
    if years is None:
        return "Unspecified"
    try:
        val = float(years)
    except (TypeError, ValueError):
        return "Unspecified"
    if val < 2.0:
        return "0-2 yrs (Junior)"
    if val < 5.0:
        return "2-5 yrs (Mid-Level)"
    if val < 9.0:
        return "5-9 yrs (Senior)"
    return "9+ yrs (Lead/Principal)"


def normalize_availability(raw: Optional[str]) -> str:
    """Normalize recruiter-recorded candidate availability without inventing missing values."""
    if not raw or not str(raw).strip():
        return "Not Recorded"
    low = str(raw).strip().lower()
    if any(tok in low for tok in ("immediate", "now", "available", "0 day")):
        return "Immediate"
    if "15" in low or "2 week" in low or "two week" in low:
        return "Within 15 Days"
    if "30" in low or "1 month" in low or "one month" in low:
        return "Within 30 Days"
    if "45" in low or "60" in low or "90" in low or "2 month" in low or "3 month" in low or "notice" in low:
        return "60+ Days Notice"
    return str(raw).strip().title()


def is_job_open(job: Job) -> bool:
    """Return True when a Job row represents active/open recruitment demand."""
    return (job.status or "").strip().lower() in {"open", "active", "in progress", "sourcing"}


def get_candidate_canonical_skills(candidate: Candidate) -> Set[str]:
    """Return the deduplicated set of canonical skills for a single candidate."""
    normalized = normalize_skills_list(candidate.skills or [])
    return {item["canonical"] for item in normalized if item.get("canonical")}


def get_skill_category(canonical_skill: str) -> str:
    """Return the taxonomy category for a canonical skill, defaulting to 'Other / Domain'."""
    meta = SKILL_CATALOG.get(canonical_skill)
    if meta and meta.get("category"):
        return str(meta["category"])
    # Fallback via normalize_skill in case an alias was passed.
    norm = normalize_skill(canonical_skill)
    return str(norm.get("category") or "Other / Domain")


def _filter_candidates(
    candidates: List[Candidate],
    skill: Optional[str] = None,
    category: Optional[str] = None,
    experience_band: Optional[str] = None,
    location: Optional[str] = None,
    availability: Optional[str] = None,
) -> List[Candidate]:
    """Apply consistent optional filters across internal candidate records."""
    skill_canon = normalize_skill(skill)["canonical"].lower() if skill and skill.strip() else None
    cat_low = category.strip().lower() if category and category.strip() else None
    exp_low = experience_band.strip().lower() if experience_band and experience_band.strip() else None
    loc_norm = normalize_location(location).lower() if location and location.strip() else None
    avail_low = availability.strip().lower() if availability and availability.strip() else None

    filtered: List[Candidate] = []
    for cand in candidates:
        cand_skills = get_candidate_canonical_skills(cand)
        if skill_canon and not any(
            skill_canon == sk.lower() or skill_canon in sk.lower() for sk in cand_skills
        ):
            continue
        if cat_low and not any(get_skill_category(sk).lower() == cat_low for sk in cand_skills):
            continue
        if exp_low and classify_experience_band(cand.experience_years).lower() != exp_low:
            continue
        if loc_norm and normalize_location(cand.location).lower() != loc_norm:
            continue
        if avail_low and normalize_availability(cand.availability).lower() != avail_low:
            continue
        filtered.append(cand)
    return filtered


def _compute_emerging_skills_from_resumes(db: Session, candidates: List[Candidate]) -> Dict[str, Any]:
    """Identify skills appearing more often in newer resume versions where chronological evidence exists."""
    cand_ids = {c.id for c in candidates}
    resumes = (
        db.query(Resume)
        .filter(Resume.candidate_id.in_(cand_ids))
        .order_by(Resume.candidate_id.asc(), Resume.created_at.asc(), Resume.id.asc())
        .all()
        if cand_ids
        else []
    )
    by_cand: Dict[int, List[Resume]] = defaultdict(list)
    for res in resumes:
        by_cand[res.candidate_id].append(res)

    multi_version_cands = {cid: rlist for cid, rlist in by_cand.items() if len(rlist) >= 2}
    if not multi_version_cands:
        return {
            "status": "Insufficient Data",
            "note": "No candidates in the filtered pool have multiple chronological resume versions.",
            "multi_version_candidates": 0,
            "emerging_skills": [],
        }

    added_counter: Counter[str] = Counter()
    comparable_pairs = 0
    cand_map = {c.id: c for c in candidates}

    for cid, rlist in multi_version_cands.items():
        cand = cand_map.get(cid)
        first_res, latest_res = rlist[0], rlist[-1]
        first_text, first_prov = get_resume_text_and_provenance(first_res, cand, load_disk=True)
        latest_text, latest_prov = get_resume_text_and_provenance(latest_res, cand, load_disk=True)
        if not first_prov or not latest_prov:
            continue
        comparable_pairs += 1
        first_facts = extract_structured_resume_facts(first_text)
        latest_facts = extract_structured_resume_facts(latest_text)
        first_skills = {
            s["canonical"] for s in first_facts.get("skills", []) if isinstance(s, dict) and s.get("canonical")
        }
        latest_skills = {
            s["canonical"] for s in latest_facts.get("skills", []) if isinstance(s, dict) and s.get("canonical")
        }
        for sk in latest_skills - first_skills:
            added_counter[sk] += 1

    if comparable_pairs == 0:
        return {
            "status": "Insufficient Data",
            "note": "Multiple resume rows exist, but disk text was unavailable for chronological comparison.",
            "multi_version_candidates": len(multi_version_cands),
            "emerging_skills": [],
        }

    items = [
        {
            "skill": sk,
            "category": get_skill_category(sk),
            "new_appearances_in_latest_resumes": cnt,
            "information_type": "Extracted resume information & Calculated metric",
        }
        for sk, cnt in added_counter.most_common(12)
    ]
    return {
        "status": "Available" if items else "No Delta Detected",
        "note": f"Compared earliest vs latest resume versions across {comparable_pairs} candidate(s) with readable files.",
        "multi_version_candidates": len(multi_version_cands),
        "comparable_candidates": comparable_pairs,
        "emerging_skills": items,
    }


def get_market_overview(
    db: Session,
    skill: Optional[str] = None,
    category: Optional[str] = None,
    experience_band: Optional[str] = None,
    location: Optional[str] = None,
    availability: Optional[str] = None,
) -> Dict[str, Any]:
    """Build the Phase 2 Internal Talent Market Intelligence overview."""
    all_candidates = db.query(Candidate).order_by(Candidate.id.asc()).all()
    filtered_candidates = _filter_candidates(
        all_candidates,
        skill=skill,
        category=category,
        experience_band=experience_band,
        location=location,
        availability=availability,
    )
    open_jobs = [j for j in db.query(Job).order_by(Job.id.asc()).all() if is_job_open(j)]
    total_openings = sum(max(1, int(j.openings_count or 1)) for j in open_jobs)

    skill_counts: Counter[str] = Counter()
    category_candidates: Dict[str, Set[int]] = defaultdict(set)
    exp_counts: Counter[str] = Counter()
    loc_counts: Counter[str] = Counter()
    avail_counts: Counter[str] = Counter()

    for cand in filtered_candidates:
        cand_skills = get_candidate_canonical_skills(cand)
        for sk in cand_skills:
            skill_counts[sk] += 1
            category_candidates[get_skill_category(sk)].add(cand.id)
        exp_counts[classify_experience_band(cand.experience_years)] += 1
        loc_counts[normalize_location(cand.location)] += 1
        avail_counts[normalize_availability(cand.availability)] += 1

    # Open job skill demand for overlap comparison.
    demand_skill_jobs: Dict[str, Set[int]] = defaultdict(set)
    for job in open_jobs:
        job_skills = normalize_skills_list((job.required_skills or []) + (job.preferred_skills or []))
        for item in job_skills:
            demand_skill_jobs[item["canonical"]].add(job.id)

    total_filtered = len(filtered_candidates)
    top_skills = [
        {
            "skill": sk,
            "category": get_skill_category(sk),
            "candidate_count": cnt,
            "pool_share_pct": round((cnt / total_filtered) * 100.0, 1) if total_filtered else 0.0,
            "open_jobs_requiring": len(demand_skill_jobs.get(sk, set())),
            "information_type": "Calculated metric",
        }
        for sk, cnt in skill_counts.most_common(15)
    ]

    categories = [
        {
            "category": cat,
            "unique_candidates": len(cids),
            "share_pct": round((len(cids) / total_filtered) * 100.0, 1) if total_filtered else 0.0,
            "information_type": "Calculated metric",
        }
        for cat, cids in sorted(category_candidates.items(), key=lambda x: len(x[1]), reverse=True)
    ]

    experience_distribution = [
        {
            "band": band,
            "candidate_count": exp_counts.get(band, 0),
            "share_pct": round((exp_counts.get(band, 0) / total_filtered) * 100.0, 1) if total_filtered else 0.0,
        }
        for band in EXPERIENCE_BANDS
    ]

    location_distribution = [
        {
            "location": loc,
            "candidate_count": cnt,
            "share_pct": round((cnt / total_filtered) * 100.0, 1) if total_filtered else 0.0,
        }
        for loc, cnt in loc_counts.most_common(12)
    ]

    availability_distribution = [
        {
            "availability": av,
            "candidate_count": cnt,
            "share_pct": round((cnt / total_filtered) * 100.0, 1) if total_filtered else 0.0,
        }
        for av, cnt in avail_counts.most_common()
    ]

    # Skill overlap between internal talent pool and open job requirements.
    demand_skills_set = set(demand_skill_jobs.keys())
    pool_skills_set = set(skill_counts.keys())
    overlapping_skills = sorted(demand_skills_set & pool_skills_set)
    uncovered_demand_skills = sorted(demand_skills_set - pool_skills_set)

    emerging = _compute_emerging_skills_from_resumes(db, filtered_candidates)

    return {
        "scope_label": "Internal Talent Market Intelligence",
        "external_market_data_connected": False,
        "scope_notice": (
            "All metrics are derived strictly from CompanyAI's internal SQLite candidate, resume, and job records. "
            "External market benchmarks, industry hiring trends, and salary data are not connected."
        ),
        "filters_applied": {
            "skill": skill,
            "category": category,
            "experience_band": experience_band,
            "location": location,
            "availability": availability,
        },
        "summary": {
            "total_database_candidates": len(all_candidates),
            "filtered_candidates": total_filtered,
            "unique_skills_represented": len(skill_counts),
            "open_jobs_count": len(open_jobs),
            "total_openings": total_openings,
            "candidate_to_opening_ratio": round(total_filtered / total_openings, 2) if total_openings else None,
            "demand_skill_overlap_pct": (
                round((len(overlapping_skills) / len(demand_skills_set)) * 100.0, 1)
                if demand_skills_set
                else None
            ),
            "information_type": "Verified database fact & Calculated metric",
        },
        "top_skills": top_skills,
        "technology_categories": categories,
        "experience_distribution": experience_distribution,
        "location_distribution": location_distribution,
        "availability_distribution": availability_distribution,
        "skill_overlap": {
            "overlapping_skills_count": len(overlapping_skills),
            "total_open_job_skills": len(demand_skills_set),
            "overlapping_skills": overlapping_skills[:20],
            "uncovered_demand_skills": uncovered_demand_skills[:20],
        },
        "emerging_skills": emerging,
        "available_filter_options": {
            "categories": sorted({get_skill_category(sk) for sk in skill_counts.keys()}),
            "locations": sorted({normalize_location(c.location) for c in all_candidates}),
            "experience_bands": EXPERIENCE_BANDS,
            "availabilities": sorted({normalize_availability(c.availability) for c in all_candidates}),
        },
    }


def get_market_skills(
    db: Session,
    category: Optional[str] = None,
    location: Optional[str] = None,
    experience_band: Optional[str] = None,
    availability: Optional[str] = None,
    limit: int = 30,
    offset: int = 0,
) -> Dict[str, Any]:
    """Return paginated canonical skill counts from the internal candidate pool."""
    candidates = _filter_candidates(
        db.query(Candidate).order_by(Candidate.id.asc()).all(),
        category=category,
        experience_band=experience_band,
        location=location,
        availability=availability,
    )
    open_jobs = [j for j in db.query(Job).all() if is_job_open(j)]
    demand_jobs: Dict[str, Set[int]] = defaultdict(set)
    for j in open_jobs:
        for item in normalize_skills_list((j.required_skills or []) + (j.preferred_skills or [])):
            demand_jobs[item["canonical"]].add(j.id)

    counts: Counter[str] = Counter()
    for cand in candidates:
        for sk in get_candidate_canonical_skills(cand):
            if category and get_skill_category(sk).lower() != category.strip().lower():
                continue
            counts[sk] += 1

    total = len(counts)
    total_cands = len(candidates)
    rows = [
        {
            "skill": sk,
            "category": get_skill_category(sk),
            "candidate_count": cnt,
            "pool_share_pct": round((cnt / total_cands) * 100.0, 1) if total_cands else 0.0,
            "open_jobs_requiring": len(demand_jobs.get(sk, set())),
            "information_type": "Calculated metric",
        }
        for sk, cnt in counts.most_common()
    ]
    return {
        "scope_label": "Internal Talent Market Intelligence",
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": rows[offset : offset + limit],
    }


def get_market_locations(
    db: Session,
    skill: Optional[str] = None,
    category: Optional[str] = None,
) -> Dict[str, Any]:
    """Return candidate and open-job distribution across normalized locations."""
    candidates = _filter_candidates(db.query(Candidate).all(), skill=skill, category=category)
    open_jobs = [j for j in db.query(Job).all() if is_job_open(j)]

    loc_cands: Dict[str, List[Candidate]] = defaultdict(list)
    for c in candidates:
        loc_cands[normalize_location(c.location)].append(c)

    loc_jobs: Counter[str] = Counter()
    loc_openings: Counter[str] = Counter()
    for j in open_jobs:
        loc = normalize_location(j.location)
        loc_jobs[loc] += 1
        loc_openings[loc] += max(1, int(j.openings_count or 1))

    all_locs = sorted(set(loc_cands.keys()) | set(loc_jobs.keys()))
    total_cands = len(candidates)
    items = []
    for loc in all_locs:
        c_list = loc_cands.get(loc, [])
        sk_counter: Counter[str] = Counter()
        for c in c_list:
            for sk in get_candidate_canonical_skills(c):
                sk_counter[sk] += 1
        items.append(
            {
                "location": loc,
                "candidate_count": len(c_list),
                "share_pct": round((len(c_list) / total_cands) * 100.0, 1) if total_cands else 0.0,
                "open_jobs": loc_jobs.get(loc, 0),
                "total_openings": loc_openings.get(loc, 0),
                "top_skills": [s for s, _ in sk_counter.most_common(5)],
                "information_type": "Verified database fact & Calculated metric",
            }
        )
    items.sort(key=lambda x: (x["candidate_count"], x["open_jobs"]), reverse=True)
    return {
        "scope_label": "Internal Talent Market Intelligence",
        "total_locations": len(items),
        "items": items,
    }


def get_market_experience(
    db: Session,
    skill: Optional[str] = None,
    category: Optional[str] = None,
    location: Optional[str] = None,
) -> Dict[str, Any]:
    """Return experience-band distribution and summary stats for recorded candidate experience."""
    candidates = _filter_candidates(
        db.query(Candidate).all(),
        skill=skill,
        category=category,
        location=location,
    )
    bands: Counter[str] = Counter()
    recorded_years: List[float] = []
    for c in candidates:
        bands[classify_experience_band(c.experience_years)] += 1
        if c.experience_years is not None:
            recorded_years.append(float(c.experience_years))

    total = len(candidates)
    return {
        "scope_label": "Internal Talent Market Intelligence",
        "total_candidates": total,
        "recorded_experience_count": len(recorded_years),
        "missing_experience_count": total - len(recorded_years),
        "average_experience_years": round(sum(recorded_years) / len(recorded_years), 1) if recorded_years else None,
        "min_experience_years": min(recorded_years) if recorded_years else None,
        "max_experience_years": max(recorded_years) if recorded_years else None,
        "bands": [
            {
                "band": b,
                "candidate_count": bands.get(b, 0),
                "share_pct": round((bands.get(b, 0) / total) * 100.0, 1) if total else 0.0,
            }
            for b in EXPERIENCE_BANDS
        ],
        "information_type": "Verified database fact & Calculated metric",
    }


def get_market_skill_combinations(
    db: Session,
    min_cooccurrence: int = 2,
    limit: int = 20,
) -> Dict[str, Any]:
    """Identify the most frequent canonical technology skill pairs across unique candidates."""
    candidates = db.query(Candidate).all()
    pair_counts: Counter[Tuple[str, str]] = Counter()
    for cand in candidates:
        skills = sorted(get_candidate_canonical_skills(cand))
        if len(skills) < 2:
            continue
        for a, b in combinations(skills, 2):
            pair_counts[(a, b)] += 1

    total_cands = len(candidates)
    items = []
    for (a, b), cnt in pair_counts.most_common():
        if cnt < min_cooccurrence:
            continue
        items.append(
            {
                "skill_a": a,
                "skill_b": b,
                "category_a": get_skill_category(a),
                "category_b": get_skill_category(b),
                "candidate_count": cnt,
                "pool_share_pct": round((cnt / total_cands) * 100.0, 1) if total_cands else 0.0,
                "information_type": "Calculated metric",
            }
        )
        if len(items) >= limit:
            break

    return {
        "scope_label": "Internal Talent Market Intelligence",
        "total_candidates_analyzed": total_cands,
        "min_cooccurrence": min_cooccurrence,
        "items": items,
    }
