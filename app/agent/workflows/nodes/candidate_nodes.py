"""Candidate retrieval, canonical matching, ranking, and explanation nodes."""

from datetime import datetime, timezone
from typing import Any, Dict, List
import logging

from database.sqlite_connection import get_db
from database.models import Candidate
from app.services.matching_engine_service import search_and_match_candidates, CandidateMatchingFilters
from app.agent.workflows.adapter import local_chat_llm
from app.agent.workflows.state import RecruitmentState
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger("companyai.workflows.candidates")


def retrieve_internal_candidates_node(state: RecruitmentState) -> Dict[str, Any]:
    """Node 8: Retrieve internal candidate profiles from the SQLite database."""
    db = next(get_db())
    try:
        candidates = db.query(Candidate).all()
        cand_ids = [c.id for c in candidates]
        return {
            "retrieved_candidate_ids": cand_ids,
            "current_stage": "evaluate_candidate_matches",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        return {
            "errors": state.get("errors", []) + [f"Failed to query internal candidates: {exc}"],
            "retrieved_candidate_ids": [],
            "status": "failed",
        }
    finally:
        db.close()


def evaluate_candidate_matches_node(state: RecruitmentState) -> Dict[str, Any]:
    """Node 9: Execute the frozen, canonical deterministic candidate matching engine against this job."""
    job_id = state.get("job_id")
    db = next(get_db())
    try:
        # Pre-filter candidate candidates using the extracted JD skills to avoid N+1 CPU thrashing
        jd_skills = state.get("mandatory_skills") or state.get("mandatory_requirements") or state.get("extracted_skills") or []
        filters = CandidateMatchingFilters(skills=jd_skills[:4]) if jd_skills else None

        engine_res = search_and_match_candidates(db=db, job_id=job_id, filters=filters, page=1, page_size=25)
        raw_matches = engine_res.get("candidates", [])

        # If strict skill filter produced 0 candidates, broaden filter
        if not raw_matches and filters:
            engine_res = search_and_match_candidates(db=db, job_id=job_id, page=1, page_size=25)
            raw_matches = engine_res.get("candidates", [])

        # Map into structured match records
        clean_matches = []
        for m in raw_matches:
            clean_matches.append({
                "candidate_id": m.get("id") or m.get("candidate_id"),
                "name": m.get("name"),
                "match_score": m.get("match_score") or m.get("matchScore") or 0,
                "mandatory_skills_matched": m.get("mandatory_skills_matched", []),
                "mandatory_skills_missing": m.get("mandatory_skills_missing", []),
                "preferred_skills_matched": m.get("preferred_skills_matched", []),
                "experience_years": m.get("experience_years") or m.get("experienceYears"),
                "experience_match": m.get("experience_match", True),
                "location": m.get("location"),
                "location_match": m.get("location_match", True),
                "score_breakdown": m.get("score_breakdown") or m.get("match_provenance") or {},
                "eligibility_status": m.get("eligibility_adjusted_tier") or m.get("stage") or "Reviewed",
            })

        return {
            "match_results": clean_matches,
            "current_stage": "rank_candidate_results",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        logger.exception("Canonical matching failed in workflow node: %s", exc)
        return {
            "errors": state.get("errors", []) + [f"Canonical matching engine failure: {exc}"],
            "match_results": [],
            "status": "failed",
        }
    finally:
        db.close()


def rank_candidate_results_node(state: RecruitmentState) -> Dict[str, Any]:
    """Node 10: Sort matches by composite score and segment into strong, transferable, and gap pools."""
    matches = list(state.get("match_results", []))
    matches.sort(key=lambda m: m.get("match_score", 0), reverse=True)

    ranked_shortlist = []
    for idx, m in enumerate(matches, 1):
        score = m.get("match_score", 0)
        if score >= 80:
            classification = "Strong Match"
        elif score >= 50:
            classification = "Transferable Match"
        else:
            classification = "Skill Gap Match"

        ranked_shortlist.append({
            "rank": idx,
            "candidate_id": m["candidate_id"],
            "name": m["name"],
            "match_score": score,
            "classification": classification,
            "mandatory_skills_matched": m.get("mandatory_skills_matched", []),
            "mandatory_skills_missing": m.get("mandatory_skills_missing", []),
            "experience_years": m.get("experience_years"),
            "location": m.get("location"),
        })

    return {
        "ranked_shortlist": ranked_shortlist,
        "current_stage": "generate_recruiter_explanation",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def generate_recruiter_explanation_node(state: RecruitmentState) -> Dict[str, Any]:
    """Node 11: Synthesize an evidence-grounded executive summary using local Ollama (with deterministic fallback)."""
    title = state.get("job_title", "Job")
    mandatory = state.get("mandatory_skills", [])
    supply_tier = state.get("hiring_difficulty_tier", "Moderate")
    bottleneck = state.get("supply_bottleneck", "Market availability")
    shortlist = state.get("ranked_shortlist", [])
    target_cos = [c.get("name") for c in state.get("target_companies", [])[:4]]

    strong_count = sum(1 for c in shortlist if c.get("classification") == "Strong Match")
    transferable_count = sum(1 for c in shortlist if c.get("classification") == "Transferable Match")
    top_candidates = shortlist[:3]

    # Deterministic factual baseline
    deterministic_summary = (
        f"**Recruitment Sourcing & Evaluation Summary for {title}:**\n\n"
        f"• **Talent Supply & Market Difficulty:** Rated **{supply_tier}**. Key Sourcing Bottleneck: *{bottleneck}*.\n"
        f"• **Internal Candidate Bench:** {len(shortlist)} profiles evaluated from SQLite. Found **{strong_count}** Strong Matches and **{transferable_count}** Transferable candidates.\n"
        f"• **Top Shortlisted Candidates:** " + (", ".join(f"{c['name']} ({c['match_score']}%)" for c in top_candidates) if top_candidates else "None qualified above threshold.") + "\n"
        f"• **Target Headhunting Pools:** Recommended headhunting from " + (", ".join(target_cos) if target_cos else "Industry peers") + ".\n"
        f"• **Recommended Action:** " + ("Proceed to recruiter review and interview alignment." if strong_count > 0 else "Deploy generated Boolean queries across external platforms to expand talent pipeline.")
    )

    try:
        top_matches_str = ", ".join(f"{c['name']} ({c['match_score']}%)" for c in top_candidates)
        # Use local Ollama to craft a tailored, cohesive briefing note
        prompt = (
            f"Role: {title}\n"
            f"Mandatory Requirements: {', '.join(mandatory[:6])}\n"
            f"Hiring Difficulty: {supply_tier} (Bottleneck: {bottleneck})\n"
            f"Evaluated Candidates: {len(shortlist)} total, {strong_count} strong matches, {transferable_count} transferable.\n"
            f"Top Matches: {top_matches_str}\n"
            f"Target Headhunting Companies: {', '.join(target_cos)}\n\n"
            f"Write a concise 3-paragraph executive recruitment briefing for the recruiter. Ground all claims strictly in these facts. Do not invent candidate facts."
        )
        sys_msg = SystemMessage(content="You are a senior recruitment advisor. Provide concise, grounded sourcing summaries.")
        user_msg = HumanMessage(content=prompt)
        res = local_chat_llm.invoke([sys_msg, user_msg])
        ai_summary = res.content.strip()
        final_summary = ai_summary if len(ai_summary) > 50 else deterministic_summary
    except Exception as exc:
        logger.warning(f"Ollama explanation fallback triggered: {exc}")
        final_summary = deterministic_summary

    return {
        "executive_summary": final_summary,
        "current_stage": "prepare_shortlist",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def prepare_shortlist_node(state: RecruitmentState) -> Dict[str, Any]:
    """Node 12: Prepare the final candidate shortlist formatted for recruiter dashboard inspection."""
    shortlist = state.get("ranked_shortlist", [])
    top_candidates = shortlist[:5]

    return {
        "ranked_shortlist": top_candidates,
        "current_stage": "request_recruiter_approval",
        "status": "awaiting_approval" if len(top_candidates) > 0 else "completed",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
