"""Candidate Digital Twin, Potential Intelligence, and Talent Mobility service for Phase 1.

Unifies persisted SQLite candidate records, resume extractions, embeddings,
interviews, activity logs, and matching evaluations while clearly labeling every
datum's `information_type` (Verified database fact, Extracted resume information,
Calculated metric, Semantic similarity, or Inferred suitability).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set
from sqlalchemy.orm import Session

from database.models import (
    ActivityEvent,
    ApprovalRequest,
    Candidate,
    Interview,
    Job,
    Resume,
    ResumeEmbedding,
)
from app.services.matching_engine_service import (
    MatchScoreWeights,
    evaluate_candidate_multi_resume,
    get_active_approved_segmentation,
    get_resume_text_and_provenance,
    get_segmentation_embeddings_map,
)
from app.services.skill_taxonomy_service import (
    extract_structured_resume_facts,
    get_related_adjacent_skills,
    normalize_skill,
    normalize_skills_list,
)


# Role transition archetypes for transparent Potential & Talent Mobility analysis.
ROLE_TRANSITION_ARCHETYPES: List[Dict[str, Any]] = [
    {
        "role": "Backend Java Developer",
        "required_skills": ["Java", "Spring Boot", "REST APIs", "SQL"],
        "preferred_skills": ["Microservices", "Docker", "AWS"],
        "keywords": ["java", "backend", "spring"],
    },
    {
        "role": "Java Microservices Developer",
        "required_skills": ["Java", "Spring Boot", "Microservices", "REST APIs"],
        "preferred_skills": ["Docker", "Kubernetes", "AWS", "SQL"],
        "keywords": ["microservices", "java", "spring", "api"],
    },
    {
        "role": "API & Integration Developer",
        "required_skills": ["REST APIs", "SQL"],
        "preferred_skills": ["Java", "Python", "FastAPI", "SAP CPI", "Docker"],
        "keywords": ["api", "integration", "backend"],
    },
    {
        "role": "Cloud & DevOps Engineer",
        "required_skills": ["Docker", "AWS"],
        "preferred_skills": ["Kubernetes", "Azure", "Python"],
        "keywords": ["cloud", "devops", "aws", "azure", "kubernetes"],
    },
    {
        "role": "Automation QA Engineer",
        "required_skills": ["Automation Testing", "Selenium"],
        "preferred_skills": ["API Testing", "Java", "Python", "Manual Testing", "SQL"],
        "keywords": ["qa", "automation", "testing", "selenium"],
    },
    {
        "role": "Oracle EPM / FCCS Cloud Lead",
        "required_skills": ["Oracle FCCS", "Oracle EPM"],
        "preferred_skills": ["Hyperion Financial Management", "Smart View", "SQL"],
        "keywords": ["fccs", "epm", "hyperion", "consolidation"],
    },
    {
        "role": "Siemens Teamcenter PLM Consultant",
        "required_skills": ["Siemens Teamcenter", "BMIDE"],
        "preferred_skills": ["Active Workspace", "Java"],
        "keywords": ["teamcenter", "plm", "bmide", "awc"],
    },
    {
        "role": ".NET Cloud Backend Engineer",
        "required_skills": [".NET", "C#", "SQL Server"],
        "preferred_skills": ["Azure", "REST APIs", "Microservices"],
        "keywords": [".net", "c#", "azure"],
    },
]


def build_candidate_digital_twin(db: Session, candidate_id: int) -> Dict[str, Any]:
    """Assemble a 360-degree Candidate Digital Twin with strict source attribution."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise ValueError(f"Candidate #{candidate_id} not found.")

    resumes: List[Resume] = (
        db.query(Resume)
        .filter(Resume.candidate_id == candidate.id)
        .order_by(Resume.created_at.asc(), Resume.id.asc())
        .all()
    )
    resume_ids = [r.id for r in resumes]

    embeddings = (
        db.query(ResumeEmbedding).filter(ResumeEmbedding.resume_id.in_(resume_ids)).all()
        if resume_ids
        else []
    )
    emb_by_resume = {e.resume_id: e for e in embeddings}

    interviews = (
        db.query(Interview)
        .filter(Interview.candidate_id == candidate.id)
        .order_by(Interview.created_at.desc())
        .all()
    )

    activities = (
        db.query(ActivityEvent)
        .filter(
            ActivityEvent.entity_type == "candidate",
            ActivityEvent.entity_id == str(candidate.id),
        )
        .order_by(ActivityEvent.created_at.desc())
        .limit(25)
        .all()
    )

    # Extract structured facts from all available resume documents with source attribution.
    resume_versions_summary: List[Dict[str, Any]] = []
    extracted_education: List[Dict[str, Any]] = []
    extracted_certifications: List[Dict[str, Any]] = []
    extracted_companies: List[Dict[str, Any]] = []
    extracted_projects: List[Dict[str, Any]] = []
    extracted_titles: List[Dict[str, Any]] = []

    seen_edu: Set[str] = set()
    seen_cert: Set[str] = set()
    seen_comp: Set[str] = set()
    seen_proj: Set[str] = set()
    seen_title: Set[str] = set()

    for idx, res in enumerate(resumes):
        disk_text, has_disk_text = get_resume_text_and_provenance(res, candidate, load_disk=True)
        emb = emb_by_resume.get(res.id)
        facts = extract_structured_resume_facts(disk_text if has_disk_text else "")

        resume_versions_summary.append(
            {
                "version": f"v{idx + 1}",
                "resume_id": res.id,
                "filename": res.source_filename,
                "content_sha256": res.content_sha256,
                "created_at": res.created_at.isoformat() if res.created_at else None,
                "disk_text_available": has_disk_text,
                "has_embedding": emb is not None,
                "embedding_model": emb.model_name if emb else None,
                "embedding_dimensions": emb.dimensions if emb else None,
                "skills_found_count": len(facts["skills"]),
                "information_type": "Verified database fact",
            }
        )

        src_meta = {
            "source_resume_id": res.id,
            "source_filename": res.source_filename,
            "information_type": "Extracted resume information",
        }
        for e in facts["education"]:
            if e.lower() not in seen_edu:
                seen_edu.add(e.lower())
                extracted_education.append({"value": e, **src_meta})
        for c in facts["certifications"]:
            if c.lower() not in seen_cert:
                seen_cert.add(c.lower())
                extracted_certifications.append({"value": c, **src_meta})
        for comp in facts["companies"]:
            if comp.lower() not in seen_comp:
                seen_comp.add(comp.lower())
                extracted_companies.append({"value": comp, **src_meta})
        for pr in facts["projects"]:
            if pr.lower() not in seen_proj:
                seen_proj.add(pr.lower())
                extracted_projects.append({"value": pr, **src_meta})
        for ttl in facts["titles"]:
            if ttl.lower() not in seen_title:
                seen_title.add(ttl.lower())
                extracted_titles.append({"value": ttl, **src_meta})

    # Normalize candidate's verified profile skills.
    verified_skills = normalize_skills_list(candidate.skills or [])

    # Evaluate job suitability across up to 10 active/open jobs using the existing Phase 5C matching engine.
    active_jobs = (
        db.query(Job)
        .filter(Job.status.in_(["active", "open", "Active", "Open"]))
        .order_by(Job.id.asc())
        .limit(10)
        .all()
    )
    job_matches: List[Dict[str, Any]] = []
    weights = MatchScoreWeights()

    for job in active_jobs:
        seg = get_active_approved_segmentation(db, job.id)
        reqs = seg.requirements if seg else []
        full_emb, req_emb_map = get_segmentation_embeddings_map(db, seg.id) if seg else (None, {})
        res_match = evaluate_candidate_multi_resume(
            candidate=candidate,
            job=job,
            segmentation=seg,
            requirements=reqs,
            full_jd_emb=full_emb,
            req_emb_map=req_emb_map,
            weights=weights,
            db=db,
            load_disk_text=False,
        )
        job_matches.append(
            {
                "job_id": job.id,
                "job_title": job.title,
                "client_name": job.client_name,
                "status": job.status,
                "match_score": res_match.match_score,
                "classification": res_match.classification,
                "semantic_similarity": res_match.similarity,
                "information_type": "Calculated metric & Semantic similarity",
            }
        )

    job_matches.sort(key=lambda m: m["match_score"], reverse=True)

    # Approvals linked to this candidate (payload contains candidate_id).
    all_approvals = db.query(ApprovalRequest).order_by(ApprovalRequest.created_at.desc()).limit(100).all()
    linked_approvals = [
        {
            "id": a.id,
            "action_type": a.action_type,
            "status": a.status,
            "description": a.description,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in all_approvals
        if isinstance(a.payload, dict) and str(a.payload.get("candidate_id")) == str(candidate.id)
    ]

    return {
        "candidate": {
            "id": candidate.id,
            "name": candidate.name,
            "email": candidate.email,
            "phone": candidate.phone,
            "location": candidate.location,
            "experience_years": candidate.experience_years,
            "availability": candidate.availability,
            "stage": candidate.stage,
            "summary": candidate.summary,
            "created_at": candidate.created_at.isoformat() if candidate.created_at else None,
            "information_type": "Verified database fact",
        },
        "verified_skills": verified_skills,
        "resume_versions": resume_versions_summary,
        "extracted_profile": {
            "titles": extracted_titles,
            "companies": extracted_companies,
            "projects": extracted_projects,
            "certifications": extracted_certifications,
            "education": extracted_education,
        },
        "interviews": [
            {
                "id": iv.id,
                "round_name": iv.round_name,
                "status": iv.status,
                "interviewer": iv.interviewer,
                "scheduled_at": iv.scheduled_at,
                "notes": iv.notes,
                "information_type": "Verified database fact",
            }
            for iv in interviews
        ],
        "activity_timeline": [
            {
                "id": act.id,
                "event_type": act.event_type,
                "summary": act.summary,
                "created_at": act.created_at.isoformat() if act.created_at else None,
                "information_type": "Verified database fact",
            }
            for act in activities
        ],
        "linked_approvals": linked_approvals,
        "job_suitability": job_matches[:5],
        "placements_note": (
            "Candidate stage is 'Hired' in SQLite; dedicated placement financial records are reserved for Phase 3."
            if (candidate.stage or "").lower() == "hired"
            else "No placement records exist for this candidate."
        ),
        "data_provenance_summary": {
            "verified_facts_sources": ["candidate", "resume", "resume_embedding", "interview", "activity_event"],
            "extracted_sources": [r.source_filename for r in resumes],
            "matching_engine": "Phase 5C multi-resume deterministic + 2048-dim semantic similarity",
        },
    }


def evaluate_candidate_potential_and_mobility(db: Session, candidate_id: int) -> Dict[str, Any]:
    """Identify transferable skills, adjacent role suitability, missing skills, and open job matches."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise ValueError(f"Candidate #{candidate_id} not found.")

    verified_norm = normalize_skills_list(candidate.skills or [])
    verified_names = [s["canonical"] for s in verified_norm]
    verified_lower = {s.lower() for s in verified_names}

    adjacent_skills = get_related_adjacent_skills(verified_names)
    adjacent_lower = {a["skill"].lower() for a in adjacent_skills}

    open_jobs = (
        db.query(Job)
        .filter(Job.status.in_(["active", "open", "Active", "Open"]))
        .order_by(Job.id.asc())
        .all()
    )

    role_recommendations: List[Dict[str, Any]] = []
    for arch in ROLE_TRANSITION_ARCHETYPES:
        req_norm = [normalize_skill(s)["canonical"] for s in arch["required_skills"]]
        pref_norm = [normalize_skill(s)["canonical"] for s in arch["preferred_skills"]]
        all_target = req_norm + pref_norm

        verified_overlap = [s for s in all_target if s.lower() in verified_lower]
        transferable_overlap = [s for s in all_target if s.lower() in adjacent_lower and s.lower() not in verified_lower]
        missing_required = [s for s in req_norm if s.lower() not in verified_lower]
        missing_preferred = [s for s in pref_norm if s.lower() not in verified_lower and s.lower() not in adjacent_lower]

        if not verified_overlap and not transferable_overlap:
            continue

        req_hit = len([s for s in req_norm if s.lower() in verified_lower])
        req_adj = len([s for s in req_norm if s.lower() in adjacent_lower])
        readiness_score = int(
            round(
                min(
                    100.0,
                    ((req_hit * 1.0 + req_adj * 0.5) / max(len(req_norm), 1)) * 75.0
                    + (len(verified_overlap) / max(len(all_target), 1)) * 25.0,
                )
            )
        )
        if readiness_score < 25:
            continue

        # Find open jobs aligned to this alternative role via keyword/skill overlap.
        matching_jobs = []
        for job in open_jobs:
            title_low = (job.title or "").lower()
            job_skills_low = {normalize_skill(sk)["canonical"].lower() for sk in (job.required_skills or [])}
            if any(kw in title_low for kw in arch["keywords"]) or any(
                rk.lower() in job_skills_low for rk in req_norm
            ):
                matching_jobs.append(
                    {
                        "job_id": job.id,
                        "title": job.title,
                        "client_name": job.client_name,
                        "location": job.location,
                    }
                )

        suitability_tier = (
            "High Transition Readiness"
            if readiness_score >= 70
            else "Moderate Transition Potential"
            if readiness_score >= 45
            else "Exploratory Upskilling Path"
        )

        role_recommendations.append(
            {
                "recommended_role": arch["role"],
                "readiness_score": readiness_score,
                "suitability_tier": suitability_tier,
                "verified_skills_matched": verified_overlap,
                "transferable_adjacent_skills": transferable_overlap,
                "missing_mandatory_skills": missing_required,
                "recommended_upskilling": (missing_required + missing_preferred)[:5],
                "matching_open_jobs": matching_jobs[:4],
                "explanation": (
                    f"Matches {len(verified_overlap)} verified skill(s) ({', '.join(verified_overlap) or 'none'}) "
                    f"and {len(transferable_overlap)} adjacent transferable skill(s) ({', '.join(transferable_overlap) or 'none'}). "
                    f"Missing mandatory skills to validate/upskill: {', '.join(missing_required) or 'None'}."
                ),
                "information_type": "AI-generated inference (rule-backed)",
            }
        )

    role_recommendations.sort(key=lambda r: r["readiness_score"], reverse=True)

    return {
        "candidate_id": candidate.id,
        "candidate_name": candidate.name,
        "experience_years": candidate.experience_years,
        "verified_skills": verified_norm,
        "transferable_adjacent_skills": adjacent_skills,
        "recommended_roles": role_recommendations[:6],
        "disclaimer": (
            "Verified skills come directly from SQLite candidate records; adjacent and role recommendations "
            "are inferred from the skill taxonomy and must not be treated as confirmed work experience."
        ),
    }
