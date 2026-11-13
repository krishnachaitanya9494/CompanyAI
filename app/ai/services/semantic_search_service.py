"""Semantic search and vector similarity retrieval service for candidates and jobs."""

import math
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.ai.providers.embedding_provider import embedding_provider
from app.semantic_search import cosine_similarity
from database.models import Candidate, Job, JobEmbedding, Resume, ResumeEmbedding


class SemanticSearchService:
    """Provides high-performance vector search, candidate discovery, and similarity comparisons."""

    cosine_similarity = staticmethod(cosine_similarity)

    def __init__(self, provider=embedding_provider):
        self.provider = provider

    def search_candidates_by_text(
        self,
        db: Session,
        query: str,
        limit: int = 15,
        min_similarity: float = 0.05,
        department: Optional[str] = None,
        location: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Search candidate pool by natural language query using Nemotron 2048-dim vectors."""
        if not query or not query.strip():
            return []

        # Generate query vector with Nemotron embedding provider.
        query_vector = self.provider.embed_text(query.strip())

        # Retrieve only genuine Nemotron candidate resumes that possess verified vectors.
        stmt = (
            select(ResumeEmbedding, Resume, Candidate)
            .join(Resume, Resume.id == ResumeEmbedding.resume_id)
            .join(Candidate, Candidate.id == Resume.candidate_id)
            .where(
                ResumeEmbedding.embedding_vector.is_not(None),
                ResumeEmbedding.generation_method == "nemotron_api",
            )
        )
        if location:
            stmt = stmt.where(Candidate.location.ilike(f"%{location}%"))

        rows = db.execute(stmt).all()
        if not rows:
            return []

        scored_candidates: List[Dict[str, Any]] = []
        seen_candidate_ids = set()

        for emb_rec, resume, cand in rows:
            if cand.id in seen_candidate_ids:
                continue

            vector = emb_rec.embedding_vector
            if not vector or len(vector) != self.provider.dimensions:
                continue

            try:
                sim = cosine_similarity(query_vector, vector)
            except Exception:
                continue

            if sim >= min_similarity:
                seen_candidate_ids.add(cand.id)
                scored_candidates.append({
                    "candidate_id": cand.id,
                    "name": cand.name,
                    "email": cand.email,
                    "skills": cand.skills or [],
                    "experience_years": cand.experience_years,
                    "location": cand.location,
                    "stage": cand.stage,
                    "summary": cand.summary,
                    "resume_id": resume.id,
                    "filename": resume.source_filename,
                    "similarity": round(float(sim), 4),
                    "match_score": round(max(0.0, float(sim)) * 100, 1),
                })

        # Rank by descending similarity score.
        scored_candidates.sort(key=lambda x: x["similarity"], reverse=True)
        return scored_candidates[:limit]

    def find_similar_candidates(
        self, db: Session, candidate_id: int, limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Find candidates with closest technical profiles using resume vector cosine proximity."""
        target_resume = (
            db.query(ResumeEmbedding)
            .join(Resume, Resume.id == ResumeEmbedding.resume_id)
            .filter(
                Resume.candidate_id == candidate_id,
                ResumeEmbedding.generation_method == "nemotron_api",
            )
            .first()
        )
        if not target_resume or not target_resume.embedding_vector:
            return []

        target_vector = target_resume.embedding_vector

        # Compare against all other genuine candidate resumes in the talent pool.
        rows = (
            db.execute(
                select(ResumeEmbedding, Resume, Candidate)
                .join(Resume, Resume.id == ResumeEmbedding.resume_id)
                .join(Candidate, Candidate.id == Resume.candidate_id)
                .where(
                    Resume.candidate_id != candidate_id,
                    ResumeEmbedding.embedding_vector.is_not(None),
                    ResumeEmbedding.generation_method == "nemotron_api",
                )
            )
            .all()
        )

        similar: List[Dict[str, Any]] = []
        seen = set()

        for emb_rec, resume, cand in rows:
            if cand.id in seen or not emb_rec.embedding_vector:
                continue
            if len(emb_rec.embedding_vector) != self.provider.dimensions:
                continue

            try:
                sim = cosine_similarity(target_vector, emb_rec.embedding_vector)
            except Exception:
                continue

            seen.add(cand.id)
            similar.append({
                "candidate_id": cand.id,
                "name": cand.name,
                "skills": cand.skills or [],
                "experience_years": cand.experience_years,
                "location": cand.location,
                "similarity": round(float(sim), 4),
                "affinity_percent": round(max(0.0, float(sim)) * 100, 1),
            })

        similar.sort(key=lambda x: x["similarity"], reverse=True)
        return similar[:limit]

    def find_similar_jobs(
        self, db: Session, job_id: int, limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Find related open job requisitions based on full JD semantic embeddings."""
        target_emb = (
            db.query(JobEmbedding)
            .filter(
                JobEmbedding.job_id == job_id,
                JobEmbedding.embedding_type == "full_jd",
                JobEmbedding.generation_method == "nemotron_api",
            )
            .first()
        )
        if not target_emb or not target_emb.embedding_vector:
            return []

        other_embs = (
            db.execute(
                select(JobEmbedding, Job)
                .join(Job, Job.id == JobEmbedding.job_id)
                .where(
                    Job.id != job_id,
                    JobEmbedding.embedding_type == "full_jd",
                    JobEmbedding.embedding_vector.is_not(None),
                    JobEmbedding.generation_method == "nemotron_api",
                )
            )
            .all()
        )

        similar: List[Dict[str, Any]] = []
        for emb, job in other_embs:
            if not emb.embedding_vector or len(emb.embedding_vector) != self.provider.dimensions:
                continue
            try:
                sim = cosine_similarity(target_emb.embedding_vector, emb.embedding_vector)
                similar.append({
                    "job_id": job.id,
                    "title": job.title,
                    "department": job.department,
                    "location": job.location,
                    "required_skills": job.required_skills or [],
                    "similarity": round(float(sim), 4),
                    "overlap_percent": round(max(0.0, float(sim)) * 100, 1),
                })
            except Exception:
                continue

        similar.sort(key=lambda x: x["similarity"], reverse=True)
        return similar[:limit]


# Shared instance.
semantic_search_service = SemanticSearchService()
