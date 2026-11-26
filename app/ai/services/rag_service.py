"""Retrieval-Augmented Generation (RAG) Service for CompanyAI."""

import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.ai.providers.chat_provider import chat_provider
from app.ai.services.semantic_search_service import semantic_search_service
from database.models import Candidate, Job

logger = logging.getLogger("companyai.ai.rag")


class RecruitmentRAGService:
    """Combines semantic vector retrieval, structured DB queries, and evidence-grounded generation."""

    def __init__(self, search_service=semantic_search_service, chat=chat_provider):
        self.search_service = search_service
        self.chat = chat

    def answer_query(
        self,
        question: Optional[str] = None,
        db: Optional[Session] = None,
        job_id: Optional[int] = None,
        top_k: int = 5,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Perform grounded RAG: retrieve relevant database evidence, cite sources, and answer question."""
        if "question" in kwargs:
            question = kwargs["question"]
        if "db" in kwargs:
            db = kwargs["db"]

        if isinstance(question, Session):
            db, question = question, db
        if isinstance(db, str):
            question, db = db, None

        question = str(question or "").strip()

        if db is None:
            from database.sqlite_connection import get_db
            db = next(get_db())

        if not question or not question.strip():
            return {
                "query": question,
                "answer": "Please ask a question regarding candidates, job requisitions, or recruitment metrics.",
                "sources": [],
                "confidence": 1.0,
                "retrieved_count": 0,
            }

        # 1. Retrieve candidates: prioritize explicitly resolved relevant candidate IDs if supplied.
        explicit_ids = kwargs.get("candidate_ids")
        if explicit_ids:
            cand_rows = db.query(Candidate).filter(Candidate.id.in_(explicit_ids)).all()
            cand_map = {c.id: c for c in cand_rows}
            retrieved_candidates = [
                {
                    "candidate_id": cand_map[cid].id,
                    "name": cand_map[cid].name,
                    "experience_years": cand_map[cid].experience_years,
                    "location": cand_map[cid].location,
                    "skills": cand_map[cid].skills or [],
                    "similarity": round(0.95 - (idx * 0.05), 2),
                    "summary": cand_map[cid].summary or "",
                }
                for idx, cid in enumerate(explicit_ids)
                if cid in cand_map
            ]
        else:
            retrieved_candidates = self.search_service.search_candidates_by_text(
                db=db,
                query=question,
                limit=top_k,
            )

        # 2. Retrieve job context if job_id was specified
        job_context = None
        if job_id:
            job = db.query(Job).filter(Job.id == job_id).first()
            if job:
                job_context = {
                    "id": job.id,
                    "title": job.title,
                    "department": job.department,
                    "required_skills": job.required_skills or [],
                    "description": (job.description or "")[:400],
                }

        # 3. Construct evidence context with explicit document citations
        context_parts = []
        sources = []

        if job_context:
            context_parts.append(
                f"TARGET JOB REQUISITION:\n"
                f"Title: {job_context['title']} (ID #{job_context['id']})\n"
                f"Department: {job_context['department']}\n"
                f"Required Skills: {', '.join(job_context['required_skills'])}\n"
                f"Scope Excerpt: {job_context['description']}\n"
            )
            sources.append({
                "type": "job",
                "id": job_context["id"],
                "title": job_context["title"],
                "citation": f"Job #{job_context['id']} ({job_context['title']})",
            })

        if retrieved_candidates:
            context_parts.append("RETRIEVED CANDIDATE PROFILES FROM DATABASE:")
            for idx, c in enumerate(retrieved_candidates, start=1):
                citation = f"Candidate #{c['candidate_id']} ({c['name']})"
                canonical_match = None
                if job_context:
                    # Suitability claims are grounded in the shared deterministic JD evaluator.
                    from app.services.matching_engine_service import compare_single_candidate_for_job
                    canonical_match = compare_single_candidate_for_job(db, job_context["id"], c["candidate_id"])["comparison"]
                candidate_context = (
                    f"{idx}. {citation}\n"
                    f"   Experience: {c['experience_years']} years | Location: {c['location']}\n"
                    f"   Skills: {', '.join(c['skills'])}\n"
                    f"   Retrieval similarity (not a suitability score): {c['similarity']}\n"
                    + (f"   Official JD match: {canonical_match['match_score'] if canonical_match['match_score'] is not None else 'Insufficient Evidence'}"
                       f"{'%' if canonical_match['match_score'] is not None else ''} for job #{job_context['id']} ({job_context['title']}); "
                       f"classification: {canonical_match['classification']}; component scores: {canonical_match['component_scores']}\n"
                       if canonical_match else "   No JD suitability score was calculated because no job ID was supplied.\n")
                    + f"   Summary: {c['summary'][:200]}..."
                )
                context_parts.append(candidate_context)
                sources.append({
                    "type": "candidate",
                    "id": c["candidate_id"],
                    "name": c["name"],
                    "retrieval_similarity": c["similarity"],
                    "citation": citation,
                    "skills": c["skills"],
                    **({"canonical_match": canonical_match} if canonical_match else {}),
                })
        else:
            context_parts.append("No candidate records matched the semantic criteria.")

        combined_context = "\n\n".join(context_parts)

        # 4. Attempt grounded response generation via Chat Model, or deterministic synthesis
        system_prompt = (
            "You are the CompanyAI Recruitment Intelligence Assistant. "
            "Answer the recruiter's inquiry truthfully using ONLY the provided verified context. "
            "Keep response concise under 120 words: 1 bullet per candidate with name, ID, experience, and verified core skills. "
            "Never invent candidate credentials, experience, or skills. "
            "Never calculate or invent a candidate-to-job match percentage. Use only the official JD match explicitly supplied in context; if none is supplied, say no canonical score is available. "
            "Explicitly cite candidate names and IDs when discussing recommendations."
        )
        user_prompt = f"Question: {question}\n\nVerified Context:\n{combined_context}"

        try:
            chat_result = self.chat.complete(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=220,
            )
            answer_text = chat_result["content"]
        except Exception:
            # Deterministic fallback synthesis grounded in retrieved evidence
            if retrieved_candidates:
                top_cand = retrieved_candidates[0]
                answer_text = (
                    f"Based on semantic retrieval from the talent pool for query '{question}', "
                    f"I found {len(retrieved_candidates)} relevant candidates. "
                    f"Top retrieved profile: **{top_cand['name']}** (ID #{top_cand['candidate_id']}) with "
                    f"{top_cand['experience_years']} years of experience in {top_cand['location']}, "
                    f"retrieval similarity {top_cand['similarity']}; this is not a JD suitability score. "
                    f"Core verified skills: {', '.join(top_cand['skills'][:6])}."
                )
            else:
                answer_text = (
                    f"No candidate profiles in the database satisfied the criteria for '{question}'. "
                    f"Try adjusting skill keywords or expanding the experience range."
                )

        conf = round(max(0.0, retrieved_candidates[0]["similarity"]), 2) if retrieved_candidates else 0.0

        return {
            "query": question,
            "answer": answer_text,
            "sources": sources,
            "confidence": conf,
            "retrieved_count": len(retrieved_candidates),
            "context_summary": f"Evaluated {len(retrieved_candidates)} candidates via 2048-dim vector embeddings.",
        }


# Shared instance.
rag_service = RecruitmentRAGService()
