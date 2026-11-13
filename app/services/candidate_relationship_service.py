"""Candidate Relationship Network & Recruitment Intelligence Graph service for Phase 1.

Builds evidence-backed relationships strictly from persisted SQLite records
(candidates, normalized skills, jobs, clients, interviews, and resume-extracted
companies/projects). Never fabricates clients, placements, or personal ties.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy.orm import Session

from database.models import Candidate, Interview, Job, Resume
from app.services.matching_engine_service import get_resume_text_and_provenance
from app.services.skill_taxonomy_service import extract_structured_resume_facts, normalize_skills_list


def build_candidate_network(
    db: Session,
    candidate_id: int,
    limit: int = 12,
) -> Dict[str, Any]:
    """Discover similar/connected candidates with explicit evidence and strength classification."""
    target = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not target:
        raise ValueError(f"Candidate #{candidate_id} not found.")

    target_skills = {s["canonical"] for s in normalize_skills_list(target.skills or [])}
    target_resumes = db.query(Resume).filter(Resume.candidate_id == target.id).all()
    target_companies: Set[str] = set()
    target_projects: Set[str] = set()

    for res in target_resumes:
        text, has_disk = get_resume_text_and_provenance(res, target, load_disk=True)
        if has_disk:
            facts = extract_structured_resume_facts(text)
            target_companies.update(c.lower() for c in facts["companies"])
            target_projects.update(p.lower() for p in facts["projects"])

    others = db.query(Candidate).filter(Candidate.id != target.id).all()
    connections: List[Dict[str, Any]] = []

    for cand in others:
        cand_skills = {s["canonical"] for s in normalize_skills_list(cand.skills or [])}
        shared_skills = sorted(target_skills & cand_skills)

        # Only inspect disk resumes for employer/project overlap when candidate shares >= 1 skill or same domain.
        shared_companies: List[str] = []
        shared_projects: List[str] = []
        if target_companies or target_projects:
            cand_resumes = db.query(Resume).filter(Resume.candidate_id == cand.id).limit(2).all()
            for cr in cand_resumes:
                ctext, chas = get_resume_text_and_provenance(cr, cand, load_disk=False)
                if chas:
                    cfacts = extract_structured_resume_facts(ctext)
                    for comp in cfacts["companies"]:
                        if comp.lower() in target_companies and comp not in shared_companies:
                            shared_companies.append(comp)
                    for proj in cfacts["projects"]:
                        if proj.lower() in target_projects and proj not in shared_projects:
                            shared_projects.append(proj)

        if not shared_companies and not shared_projects and len(shared_skills) < 2:
            continue

        union_count = len(target_skills | cand_skills) or 1
        jaccard = round(len(shared_skills) / union_count, 3)

        if shared_companies or shared_projects:
            strength = "strong_evidence"
            rel_label = "Shared Employer / Project Evidence"
        else:
            strength = "technical_similarity"
            rel_label = "Technical Skill Cluster"

        evidence: List[str] = []
        if shared_companies:
            evidence.append(f"Shared extracted employer(s): {', '.join(shared_companies)}")
        if shared_projects:
            evidence.append(f"Shared project mention(s): {', '.join(shared_projects)}")
        if shared_skills:
            evidence.append(f"Shared verified skills ({len(shared_skills)}): {', '.join(shared_skills[:6])}")

        score = (len(shared_companies) * 40) + (len(shared_projects) * 35) + int(jaccard * 50) + len(shared_skills) * 4

        connections.append(
            {
                "candidate_id": cand.id,
                "name": cand.name,
                "stage": cand.stage,
                "location": cand.location,
                "experience_years": cand.experience_years,
                "relationship_strength": strength,
                "relationship_label": rel_label,
                "similarity_score": min(100, score),
                "shared_skills": shared_skills,
                "shared_companies": shared_companies,
                "shared_projects": shared_projects,
                "evidence": evidence,
                "information_type": "Extracted resume information" if (shared_companies or shared_projects) else "Calculated metric",
            }
        )

    connections.sort(key=lambda c: c["similarity_score"], reverse=True)

    return {
        "target_candidate": {
            "id": target.id,
            "name": target.name,
            "verified_skills": sorted(target_skills),
        },
        "connections": connections[:limit],
        "total_discovered": len(connections),
        "methodology_note": (
            "Strong evidence requires shared extracted employer or project references; "
            "shared skills or locations alone are classified strictly as technical similarity, never personal relationships."
        ),
    }


def build_recruitment_graph(
    db: Session,
    skill: Optional[str] = None,
    client: Optional[str] = None,
    candidate_id: Optional[int] = None,
    job_id: Optional[int] = None,
    limit_candidates: int = 30,
) -> Dict[str, Any]:
    """Build a deduplicated, evidence-backed node-link graph from SQLite records."""
    nodes: Dict[str, Dict[str, Any]] = {}
    edges: Dict[Tuple[str, str, str], Dict[str, Any]] = {}

    def add_node(node_id: str, node_type: str, label: str, meta: Optional[Dict[str, Any]] = None) -> None:
        if node_id not in nodes:
            nodes[node_id] = {
                "id": node_id,
                "type": node_type,
                "label": label,
                "meta": meta or {},
            }

    def add_edge(
        source: str,
        target: str,
        rel_type: str,
        evidence: str,
        weight: float = 1.0,
        info_type: str = "Verified database fact",
    ) -> None:
        key = (source, target, rel_type)
        if key not in edges:
            edges[key] = {
                "id": f"{source}->{rel_type}->{target}",
                "source": source,
                "target": target,
                "relationship_type": rel_type,
                "evidence": evidence,
                "weight": weight,
                "information_type": info_type,
            }

    skill_filter_lower = skill.strip().lower() if skill and skill.strip() else None
    client_filter_lower = client.strip().lower() if client and client.strip() else None

    # 1. Load Jobs & Clients.
    job_query = db.query(Job)
    if job_id is not None:
        job_query = job_query.filter(Job.id == job_id)
    if client_filter_lower:
        job_query = job_query.filter(Job.client_name.ilike(f"%{client_filter_lower}%"))
    jobs = job_query.order_by(Job.id.asc()).all()

    matched_job_ids: Set[int] = set()
    for j in jobs:
        if len(matched_job_ids) >= 25:
            break
        j_skills = [s["canonical"] for s in normalize_skills_list(j.required_skills or [])]
        if skill_filter_lower and not any(skill_filter_lower in sk.lower() for sk in j_skills):
            continue

        matched_job_ids.add(j.id)
        j_node = f"job-{j.id}"
        add_node(
            j_node,
            "job",
            j.title,
            {"job_id": j.id, "status": j.status, "location": j.location, "client_name": j.client_name},
        )

        if j.client_name and j.client_name.strip():
            c_name = j.client_name.strip()
            cl_node = f"client-{c_name.lower().replace(' ', '_')}"
            add_node(cl_node, "client", c_name, {"client_name": c_name})
            add_edge(cl_node, j_node, "HIRES_FOR", f"Job #{j.id} ({j.title}) belongs to client '{c_name}'")

        for sk in j_skills[:8]:
            sk_node = f"skill-{sk.lower().replace(' ', '_')}"
            add_node(sk_node, "skill", sk, {"skill": sk})
            add_edge(j_node, sk_node, "REQUIRES_SKILL", f"Listed in required_skills of Job #{j.id}")

    # 2. Load Candidates & Skills & Interviews.
    cand_query = db.query(Candidate)
    if candidate_id is not None:
        cand_query = cand_query.filter(Candidate.id == candidate_id)
    candidates = cand_query.order_by(Candidate.id.asc()).all()

    added_cands = 0
    for cand in candidates:
        if added_cands >= limit_candidates:
            break
        c_skills = [s["canonical"] for s in normalize_skills_list(cand.skills or [])]
        if skill_filter_lower and not any(skill_filter_lower in sk.lower() for sk in c_skills):
            continue

        added_cands += 1
        c_node = f"cand-{cand.id}"
        add_node(
            c_node,
            "candidate",
            cand.name,
            {
                "candidate_id": cand.id,
                "stage": cand.stage,
                "experience_years": cand.experience_years,
                "location": cand.location,
            },
        )

        for sk in c_skills[:8]:
            sk_node = f"skill-{sk.lower().replace(' ', '_')}"
            add_node(sk_node, "skill", sk, {"skill": sk})
            add_edge(c_node, sk_node, "HAS_SKILL", f"Verified skill on Candidate #{cand.id} ({cand.name})")

        # Link scheduled interviews for this candidate.
        interviews = db.query(Interview).filter(Interview.candidate_id == cand.id).all()
        for iv in interviews:
            iv_node = f"interview-{iv.id}"
            add_node(
                iv_node,
                "interview",
                f"{iv.round_name} ({iv.status})",
                {"interview_id": iv.id, "interviewer": iv.interviewer, "scheduled_at": iv.scheduled_at},
            )
            add_edge(c_node, iv_node, "INTERVIEWED_IN", f"Interview #{iv.id} with {iv.interviewer or 'panel'}")

    return {
        "nodes": list(nodes.values()),
        "edges": list(edges.values()),
        "stats": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "node_counts_by_type": {
                t: sum(1 for n in nodes.values() if n["type"] == t)
                for t in ["candidate", "skill", "job", "client", "interview"]
            },
        },
        "provenance_note": "All nodes and edges are derived strictly from persisted SQLite records without fabricated entities.",
    }
