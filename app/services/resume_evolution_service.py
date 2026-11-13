"""Chronological Resume Evolution Intelligence service for Phase 1.

Compares multiple resume versions belonging to the same candidate, attributing
newly detected skills, titles, certifications, projects, and education to their
exact source resume records. Never interprets an omitted skill in a later resume
as proof that the candidate lost that skill.
"""

from __future__ import annotations

from typing import Any, Dict, List, Set
from sqlalchemy.orm import Session

from database.models import Candidate, Resume
from app.services.matching_engine_service import get_resume_text_and_provenance
from app.services.skill_taxonomy_service import extract_structured_resume_facts


def analyze_resume_evolution(db: Session, candidate_id: int) -> Dict[str, Any]:
    """Compare all persisted resume versions for one candidate chronologically."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise ValueError(f"Candidate #{candidate_id} not found.")

    resumes: List[Resume] = (
        db.query(Resume)
        .filter(Resume.candidate_id == candidate.id)
        .order_by(Resume.created_at.asc(), Resume.id.asc())
        .all()
    )

    if not resumes:
        return {
            "candidate_id": candidate.id,
            "candidate_name": candidate.name,
            "resume_count": 0,
            "has_multiple_versions": False,
            "timeline": [],
            "overall_newly_added_skills": [],
            "overall_summary": "No stored resume versions found for this candidate.",
            "information_type": "Verified database fact",
        }

    cumulative_skills: Set[str] = set()
    cumulative_certs: Set[str] = set()
    cumulative_titles: Set[str] = set()
    cumulative_projects: Set[str] = set()
    cumulative_education: Set[str] = set()

    timeline: List[Dict[str, Any]] = []
    overall_new_skills: List[Dict[str, Any]] = []
    prev_skills_set: Set[str] = set()

    for idx, res in enumerate(resumes):
        disk_text, has_disk_text = get_resume_text_and_provenance(res, candidate, load_disk=True)
        facts = extract_structured_resume_facts(disk_text if has_disk_text else "")

        version_skills = [s["canonical"] for s in facts["skills"]]
        version_skill_set = set(version_skills)
        version_certs = facts["certifications"]
        version_titles = facts["titles"]
        version_projects = facts["projects"]
        version_education = facts["education"]

        if idx == 0:
            newly_detected_skills = list(version_skills)
            not_mentioned_from_prior: List[str] = []
        else:
            newly_detected_skills = [s for s in version_skills if s not in cumulative_skills]
            not_mentioned_from_prior = sorted(s for s in prev_skills_set if s not in version_skill_set)
            for s in newly_detected_skills:
                overall_new_skills.append(
                    {
                        "skill": s,
                        "detected_in_version": f"v{idx + 1}",
                        "source_resume_id": res.id,
                        "source_filename": res.source_filename,
                        "information_type": "Extracted resume information",
                    }
                )

        new_certs = [c for c in version_certs if c not in cumulative_certs]
        new_titles = [t for t in version_titles if t not in cumulative_titles]
        new_projects = [p for p in version_projects if p not in cumulative_projects]
        new_edu = [e for e in version_education if e not in cumulative_education]

        cumulative_skills.update(version_skills)
        cumulative_certs.update(version_certs)
        cumulative_titles.update(version_titles)
        cumulative_projects.update(version_projects)
        cumulative_education.update(version_education)
        prev_skills_set = version_skill_set

        timeline.append(
            {
                "version_label": f"v{idx + 1}",
                "resume_id": res.id,
                "filename": res.source_filename,
                "content_sha256": res.content_sha256,
                "created_at": res.created_at.isoformat() if res.created_at else None,
                "disk_text_available": has_disk_text,
                "skills_detected": version_skills,
                "newly_detected_skills": newly_detected_skills if idx > 0 else [],
                "baseline_skills": version_skills if idx == 0 else [],
                "not_mentioned_in_this_version": not_mentioned_from_prior,
                "omission_disclaimer": (
                    "Skills omitted from a later resume version do not indicate lost capability."
                    if not_mentioned_from_prior
                    else None
                ),
                "newly_detected_certifications": new_certs if idx > 0 else [],
                "certifications": version_certs,
                "newly_detected_titles": new_titles if idx > 0 else [],
                "titles": version_titles,
                "newly_detected_projects": new_projects if idx > 0 else [],
                "projects": version_projects,
                "newly_detected_education": new_edu if idx > 0 else [],
                "education": version_education,
                "information_type": "Extracted resume information" if has_disk_text else "Verified database fact",
            }
        )

    summary = (
        f"Compared {len(resumes)} chronological resume version(s) for {candidate.name}; "
        f"detected {len(overall_new_skills)} newly added skill(s) after v1."
        if len(resumes) > 1
        else f"Single resume version stored ({resumes[0].source_filename}); upload a newer version to track evolution."
    )

    return {
        "candidate_id": candidate.id,
        "candidate_name": candidate.name,
        "resume_count": len(resumes),
        "has_multiple_versions": len(resumes) > 1,
        "timeline": timeline,
        "overall_newly_added_skills": overall_new_skills,
        "all_verified_cumulative_skills": sorted(cumulative_skills),
        "overall_summary": summary,
        "information_type": "Calculated metric",
    }
