"""Phase 2 Feature D: Hiring Difficulty Predictor (Evidence-Based Heuristic) service.

Evaluates how difficult a job requisition is likely to fill using documented,
transparent heuristics over SQLite candidate supply, skill scarcity, experience,
location, openings, and historical interview records. Explicitly NOT an ML model.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List
from sqlalchemy.orm import Session

from database.models import Candidate, Interview, Job
from app.services.market_intelligence_service import (
    get_candidate_canonical_skills,
    is_job_open,
    normalize_availability,
    normalize_location,
)
from app.services.talent_supply_demand_service import (
    SUPPLY_DEMAND_THRESHOLDS,
    _candidate_matches_job_location,
    get_job_supply_demand_detail,
)

HIRING_DIFFICULTY_METHODOLOGY: Dict[str, Any] = {
    "assessment_type": "Evidence-based heuristic assessment (not an ML model)",
    "max_score": 100,
    "weights": {
        "mandatory_skill_scarcity": 35,
        "internal_candidate_supply_depth": 20,
        "experience_and_location_constraints": 20,
        "openings_and_complexity": 15,
        "availability_and_interview_signals": 10,
    },
    "tier_thresholds": {
        "Low Difficulty": "< 30",
        "Moderate Difficulty": "30 - 54",
        "High Difficulty": "55 - 74",
        "Very High Difficulty": ">= 75",
        "Insufficient Data": "No mandatory skills recorded on the job",
    },
}


def _classify_difficulty_score(score: int, has_mandatory_skills: bool) -> str:
    """Map numeric heuristic score (0-100) to difficulty tier."""
    if not has_mandatory_skills:
        return "Insufficient Data"
    if score < 30:
        return "Low Difficulty"
    if score < 55:
        return "Moderate Difficulty"
    if score < 75:
        return "High Difficulty"
    return "Very High Difficulty"


def assess_job_hiring_difficulty(db: Session, job_id: int) -> Dict[str, Any]:
    """Compute a transparent heuristic hiring difficulty assessment for a single job."""
    supply_detail = get_job_supply_demand_detail(db, job_id)
    job = db.query(Job).filter(Job.id == job_id).first()
    candidates = db.query(Candidate).all()

    job_info = supply_detail["job"]
    mandatory_rows = supply_detail["mandatory_skill_supply"]
    req_set = {r["skill"] for r in mandatory_rows}
    matched_cids = [c.id for c in candidates if req_set and req_set.issubset(get_candidate_canonical_skills(c))]
    interviews = (
        db.query(Interview).filter(Interview.candidate_id.in_(matched_cids)).all()
        if matched_cids
        else []
    )
    preferred_rows = supply_detail["preferred_skill_supply"]
    openings = job_info["openings_count"]
    min_exp = job_info["min_experience_years"]
    job_loc = job_info["location"]
    fully_qualified = supply_detail["fully_qualified_candidates"] or 0
    skill_qualified = supply_detail["skill_qualified_candidates"] or 0

    available_fields = ["title", "status", "openings_count"]
    missing_fields = []
    if mandatory_rows:
        available_fields.append("required_skills")
    else:
        missing_fields.append("required_skills")
    if min_exp is not None:
        available_fields.append("min_experience_years")
    else:
        missing_fields.append("min_experience_years")
    if job_loc != "Unspecified":
        available_fields.append("location")
    else:
        missing_fields.append("location")
    if interviews:
        available_fields.append("historical_interviews")
    else:
        missing_fields.append("historical_interviews")

    if not mandatory_rows:
        return {
            "job": job_info,
            "assessment_type": HIRING_DIFFICULTY_METHODOLOGY["assessment_type"],
            "difficulty_classification": "Insufficient Data",
            "difficulty_score": None,
            "contributing_factors": [
                {
                    "factor": "Missing Mandatory Skills",
                    "impact_points": 0,
                    "max_points": 35,
                    "severity": "Unknown",
                    "evidence": "No structured required_skills are recorded for this job in SQLite.",
                    "information_type": "Verified database fact",
                }
            ],
            "skill_scarcity_breakdown": [],
            "candidate_supply": {
                "skill_qualified_candidates": 0,
                "fully_qualified_candidates": 0,
                "total_database_candidates": len(candidates),
            },
            "location_constraints": {
                "job_location": job_loc,
                "work_mode": job_info["work_mode"],
                "location_restricted": False,
            },
            "suggested_recruiter_actions": [
                "Approve JD segmentation or add structured required_skills to enable difficulty scoring."
            ],
            "data_coverage": {
                "confidence": "Low",
                "available_fields": available_fields,
                "missing_fields": missing_fields,
            },
            "methodology": HIRING_DIFFICULTY_METHODOLOGY,
        }

    contributing_factors: List[Dict[str, Any]] = []
    suggested_actions: List[str] = []

    # 1. Mandatory Skill Scarcity (0-35 pts).
    critical_count = sum(1 for r in mandatory_rows if r["classification"] == "Critical Shortage")
    low_count = sum(1 for r in mandatory_rows if r["classification"] == "Low Supply")
    scarcity_pts = min(35, critical_count * 14 + low_count * 7)
    if scarcity_pts > 0:
        scarce_list = [
            f"{r['skill']} ({r['total_candidates']} cands)"
            for r in mandatory_rows
            if r["classification"] in ("Critical Shortage", "Low Supply")
        ]
        contributing_factors.append(
            {
                "factor": "Mandatory Skill Scarcity",
                "impact_points": scarcity_pts,
                "max_points": 35,
                "severity": "High" if critical_count > 0 else "Moderate",
                "evidence": f"{critical_count} Critical Shortage and {low_count} Low Supply mandatory skill(s): {', '.join(scarce_list)}.",
                "information_type": "Calculated metric (Heuristic)",
            }
        )
        suggested_actions.append(
            f"Launch targeted sourcing for scarce mandatory skills: {', '.join(r['skill'] for r in mandatory_rows if r['classification'] in ('Critical Shortage', 'Low Supply')[:3])}."
        )
    else:
        contributing_factors.append(
            {
                "factor": "Mandatory Skill Scarcity",
                "impact_points": 0,
                "max_points": 35,
                "severity": "Low",
                "evidence": "All mandatory skills have Balanced or High internal candidate supply.",
                "information_type": "Calculated metric (Heuristic)",
            }
        )

    # 2. Internal Candidate Supply Depth (0-20 pts).
    supply_ratio = fully_qualified / max(openings, 1)
    if fully_qualified == 0:
        supply_pts = 20
        supply_sev = "High"
    elif supply_ratio < 1.0:
        supply_pts = 16
        supply_sev = "High"
    elif supply_ratio < 2.0:
        supply_pts = 11
        supply_sev = "Moderate"
    elif supply_ratio < 4.0:
        supply_pts = 5
        supply_sev = "Low"
    else:
        supply_pts = 0
        supply_sev = "Low"

    contributing_factors.append(
        {
            "factor": "Qualified Internal Candidate Supply",
            "impact_points": supply_pts,
            "max_points": 20,
            "severity": supply_sev,
            "evidence": (
                f"{fully_qualified} candidate(s) meet all mandatory skills, experience, and location "
                f"for {openings} opening(s) ({skill_qualified} meet skills before location/experience filters)."
            ),
            "information_type": "Verified database fact & Calculated metric",
        }
    )

    # 3. Experience & Location Constraints (0-20 pts).
    exp_pts = 0
    if min_exp is not None:
        if min_exp >= 8.0:
            exp_pts = 10
        elif min_exp >= 5.0:
            exp_pts = 6
        elif min_exp >= 3.0:
            exp_pts = 3

    loc_restricted = job_loc not in ("Unspecified", "Remote") and (job_info["work_mode"] or "").lower() != "remote"
    loc_pts = 0
    non_local_skill_matches = max(0, skill_qualified - fully_qualified)
    if loc_restricted:
        if skill_qualified > 0 and fully_qualified == 0:
            loc_pts = 10
        elif non_local_skill_matches > 0:
            loc_pts = 6
        else:
            loc_pts = 3

    constraint_pts = min(20, exp_pts + loc_pts)
    contributing_factors.append(
        {
            "factor": "Experience & Location Constraints",
            "impact_points": constraint_pts,
            "max_points": 20,
            "severity": "High" if constraint_pts >= 14 else ("Moderate" if constraint_pts >= 7 else "Low"),
            "evidence": (
                f"Min experience: {f'{min_exp} yrs' if min_exp is not None else 'Not specified'}; "
                f"Location: {job_loc} (Work mode: {job_info['work_mode'] or 'Not specified'})."
            ),
            "information_type": "Verified database fact & Heuristic",
        }
    )
    if loc_pts >= 6:
        suggested_actions.append(
            f"Evaluate Remote/Hybrid flexibility for '{job_loc}' to unlock {non_local_skill_matches} additional skill-matched candidate(s)."
        )

    # 4. Openings & Requirement Complexity (0-15 pts).
    req_count = len(mandatory_rows)
    pref_scarce = sum(1 for r in preferred_rows if r["classification"] in ("Critical Shortage", "Low Supply"))
    complexity_pts = min(
        15,
        (4 if openings >= 3 else (2 if openings == 2 else 0))
        + (6 if req_count >= 5 else (3 if req_count >= 3 else 0))
        + min(5, pref_scarce * 2),
    )
    contributing_factors.append(
        {
            "factor": "Openings & Requirement Complexity",
            "impact_points": complexity_pts,
            "max_points": 15,
            "severity": "High" if complexity_pts >= 10 else ("Moderate" if complexity_pts >= 5 else "Low"),
            "evidence": (
                f"{openings} opening(s), {req_count} mandatory skill(s), "
                f"{len(preferred_rows)} preferred skill(s) ({pref_scarce} scarce)."
            ),
            "information_type": "Verified database fact & Calculated metric",
        }
    )

    # 5. Availability & Historical Interview Signals (0-10 pts).
    available_set = set(SUPPLY_DEMAND_THRESHOLDS["available_statuses"])
    req_set = {r["skill"] for r in mandatory_rows}
    avail_recorded = 0
    avail_ready = 0
    for c in candidates:
        if req_set.issubset(get_candidate_canonical_skills(c)):
            av = normalize_availability(c.availability)
            if av != "Not Recorded":
                avail_recorded += 1
                if av in available_set:
                    avail_ready += 1

    avail_pts = 0
    if avail_recorded > 0 and avail_ready == 0:
        avail_pts += 6
    elif avail_recorded == 0 and fully_qualified > 0:
        avail_pts += 3  # Unknown notice periods add moderate uncertainty.

    interview_pts = 0
    if interviews:
        rejected_or_cancelled = sum(
            1 for iv in interviews if (iv.status or "").lower() in {"rejected", "cancelled", "no_show"}
        )
        if rejected_or_cancelled >= 2:
            interview_pts = 4

    signal_pts = min(10, avail_pts + interview_pts)
    contributing_factors.append(
        {
            "factor": "Candidate Availability & Historical Interview Signals",
            "impact_points": signal_pts,
            "max_points": 10,
            "severity": "Moderate" if signal_pts >= 5 else "Low",
            "evidence": (
                f"Availability recorded for {avail_recorded} skill-matched candidate(s) ({avail_ready} ready <=30 days); "
                f"{len(interviews)} historical interview record(s) linked to this job."
            ),
            "information_type": "Verified database fact & Heuristic",
        }
    )

    total_score = min(100, scarcity_pts + supply_pts + constraint_pts + complexity_pts + signal_pts)
    classification = _classify_difficulty_score(total_score, True)

    if not suggested_actions:
        suggested_actions.append("Internal supply is healthy; prioritize screening top matched candidates.")

    confidence = "High" if len(missing_fields) <= 1 else ("Medium" if len(missing_fields) == 2 else "Low")

    return {
        "job": job_info,
        "assessment_type": HIRING_DIFFICULTY_METHODOLOGY["assessment_type"],
        "difficulty_classification": classification,
        "difficulty_score": total_score,
        "contributing_factors": contributing_factors,
        "skill_scarcity_breakdown": mandatory_rows + preferred_rows,
        "candidate_supply": {
            "skill_qualified_candidates": skill_qualified,
            "fully_qualified_candidates": fully_qualified,
            "available_ready_candidates": avail_ready,
            "availability_recorded_candidates": avail_recorded,
            "total_database_candidates": len(candidates),
        },
        "location_constraints": {
            "job_location": job_loc,
            "work_mode": job_info["work_mode"],
            "location_restricted": loc_restricted,
            "non_local_skill_matched_candidates": non_local_skill_matches,
        },
        "historical_interviews_count": len(interviews),
        "suggested_recruiter_actions": suggested_actions,
        "data_coverage": {
            "confidence": confidence,
            "available_fields": available_fields,
            "missing_fields": missing_fields,
        },
        "methodology": HIRING_DIFFICULTY_METHODOLOGY,
    }


def get_hiring_difficulty_overview(db: Session, include_closed: bool = False) -> Dict[str, Any]:
    """Assess hiring difficulty across all open (or all) jobs and summarize distribution."""
    jobs = db.query(Job).order_by(Job.id.asc()).all()
    if not include_closed:
        jobs = [j for j in jobs if is_job_open(j)]

    assessments = [assess_job_hiring_difficulty(db, j.id) for j in jobs]
    tier_counts = Counter(a["difficulty_classification"] for a in assessments)

    # Sort hardest jobs first, Insufficient Data at bottom.
    assessments.sort(
        key=lambda a: (a["difficulty_score"] is not None, a["difficulty_score"] or -1),
        reverse=True,
    )

    items = [
        {
            "job_id": a["job"]["id"],
            "title": a["job"]["title"],
            "client_name": a["job"]["client_name"],
            "location": a["job"]["location"],
            "openings_count": a["job"]["openings_count"],
            "priority": a["job"]["priority"],
            "difficulty_classification": a["difficulty_classification"],
            "difficulty_score": a["difficulty_score"],
            "fully_qualified_candidates": a["candidate_supply"]["fully_qualified_candidates"],
            "skill_qualified_candidates": a["candidate_supply"]["skill_qualified_candidates"],
            "confidence": a["data_coverage"]["confidence"],
            "top_factors": [
                f["factor"] for f in sorted(a["contributing_factors"], key=lambda x: x["impact_points"], reverse=True)[:2]
                if f["impact_points"] > 0
            ],
        }
        for a in assessments
    ]

    return {
        "assessment_type": HIRING_DIFFICULTY_METHODOLOGY["assessment_type"],
        "methodology": HIRING_DIFFICULTY_METHODOLOGY,
        "total_jobs_assessed": len(items),
        "tier_distribution": [
            {"tier": t, "count": tier_counts.get(t, 0)}
            for t in [
                "Very High Difficulty",
                "High Difficulty",
                "Moderate Difficulty",
                "Low Difficulty",
                "Insufficient Data",
            ]
        ],
        "items": items,
    }


_EXPLAINABLE_INSIGHTS_CACHE: Dict[str, Dict[str, Any]] = {}


def generate_explainable_hiring_difficulty_insights(db: Session, job_id: int) -> Dict[str, Any]:
    """Generate explainable, evidence-grounded AI hiring difficulty intelligence for recruiters."""
    import copy
    import hashlib
    global _EXPLAINABLE_INSIGHTS_CACHE

    job_row = db.query(Job).filter(Job.id == job_id).first()
    title_str = (job_row.title or "").strip() if job_row else ""
    desc_str = (job_row.description or "").strip() if job_row else ""
    cache_key = f"{job_id}_{title_str}_{hashlib.md5(desc_str.encode('utf-8', errors='ignore')).hexdigest()}"

    if cache_key in _EXPLAINABLE_INSIGHTS_CACHE:
        return copy.deepcopy(_EXPLAINABLE_INSIGHTS_CACHE[cache_key])

    from app.ai.providers.chat_provider import chat_provider

    base = assess_job_hiring_difficulty(db, job_id)
    job_info = base.get("job", {})
    tier = base.get("difficulty_classification", "Moderate Difficulty")
    score = base.get("difficulty_score", 50)
    factors = base.get("contributing_factors", [])
    supply = base.get("candidate_supply", {})
    loc_info = base.get("location_constraints", {})
    suggested = base.get("suggested_recruiter_actions", [])

    # Sort factors by impact points to identify the primary bottleneck
    sorted_factors = sorted(factors, key=lambda f: f.get("impact_points", 0), reverse=True)
    top_factor = sorted_factors[0] if sorted_factors else {}
    primary_bottleneck = top_factor.get("factor", "Internal Talent Scarcity")
    bottleneck_evidence = top_factor.get("evidence", "Limited candidate supply matching mandatory criteria.")

    # Rule-based default explanation
    summary_parts = [
        f"**Hiring Difficulty Assessment:** **{tier}** (Score: {score}/100).",
        f"**Primary Bottleneck:** {primary_bottleneck} — {bottleneck_evidence}",
        f"**Internal Talent Supply:** {supply.get('fully_qualified_candidates', 0)} fully qualified candidate(s) and {supply.get('skill_qualified_candidates', 0)} skill-qualified candidate(s) identified in local database.",
    ]
    if loc_info.get("location_restricted"):
        summary_parts.append(
            f"**Location Impact:** Filtering for '{loc_info.get('job_location')}' excludes {loc_info.get('non_local_skill_matched_candidates', 0)} candidate(s) who match the skill profile."
        )

    ai_executive_summary = "\n\n".join(summary_parts)

    # If local Ollama is available, synthesize a refined executive briefing
    if chat_provider.is_available() and tier != "Insufficient Data":
        try:
            prompt = (
                f"You are CompanyAI's Recruitment Market Intelligence Assistant.\n"
                f"Provide a concise, 2-paragraph recruiter briefing explaining why this role is rated {tier} ({score}/100).\n"
                f"Job: {job_info.get('title')} in {job_info.get('location')}\n"
                f"Primary Bottleneck: {primary_bottleneck} ({bottleneck_evidence})\n"
                f"Internal Candidate Supply: {supply.get('fully_qualified_candidates')} fully qualified / {supply.get('total_database_candidates')} total profiles\n"
                f"Do not invent external market numbers or salary figures. Ground strictly on the internal facts.\n"
            )
            ai_text = chat_provider.complete_text(
                prompt=prompt,
                system_prompt="You provide concise, factual recruitment hiring difficulty analysis. Never invent external salary or candidate statistics.",
                max_tokens=180,
            )
            if ai_text and len(ai_text.strip()) > 40:
                ai_executive_summary = ai_text.strip()
        except Exception:
            pass

    result = {
        **base,
        "ai_interpretation": {
            "tier": tier,
            "score": score,
            "executive_summary": ai_executive_summary,
            "primary_bottleneck": primary_bottleneck,
            "bottleneck_evidence": bottleneck_evidence,
            "actionable_recommendations": suggested,
            "external_market_notice": "External market data unavailable — assessment based on internal candidate records.",
            "data_grounding_type": "Verified SQLite candidate records & Transparent Heuristics",
        },
    }
    if len(_EXPLAINABLE_INSIGHTS_CACHE) >= 100:
        _EXPLAINABLE_INSIGHTS_CACHE.pop(next(iter(_EXPLAINABLE_INSIGHTS_CACHE)))
    _EXPLAINABLE_INSIGHTS_CACHE[cache_key] = copy.deepcopy(result)
    return result
