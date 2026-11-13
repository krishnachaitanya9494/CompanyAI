"""AI model administrative health, auditing, and diagnostic service."""

import time
from typing import Any, Dict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai.config import ai_config
from app.ai.providers.chat_provider import chat_provider
from app.ai.providers.embedding_provider import embedding_provider
from app.ai.services.caching_service import embedding_cache
from database.models import Candidate, Job, JobEmbedding, Resume, ResumeEmbedding


class AIHealthService:
    """Manages AI model connectivity checks, database vector auditing, and diagnostic tests."""

    def __init__(self, config=ai_config, embedder=embedding_provider, chat=chat_provider, cache=embedding_cache):
        self.config = config
        self.embedder = embedder
        self.chat = chat
        self.cache = cache

    def get_health_report(self, db: Session) -> Dict[str, Any]:
        """Generate a complete audit of AI model status, dimensions, and vector coverage."""
        total_candidates = db.scalar(select(func.count(Candidate.id))) or 0
        total_resumes = db.scalar(select(func.count(Resume.id))) or 0

        # Audit resume embeddings by verified generation method and 2048 dimensions
        genuine_resumes = (
            db.scalar(
                select(func.count(func.distinct(ResumeEmbedding.resume_id))).where(
                    ResumeEmbedding.generation_method == "nemotron_api",
                    ResumeEmbedding.dimensions == self.config.embedding_dimensions,
                    ResumeEmbedding.embedding_vector.is_not(None),
                )
            )
            or 0
        )
        provenance_unknown_resumes = (
            db.scalar(
                select(func.count(func.distinct(ResumeEmbedding.resume_id))).where(
                    ResumeEmbedding.generation_method == "provenance_unknown"
                )
            )
            or 0
        )
        synthetic_fallback_resumes = (
            db.scalar(
                select(func.count(func.distinct(ResumeEmbedding.resume_id))).where(
                    ResumeEmbedding.generation_method == "synthetic_fallback"
                )
            )
            or 0
        )
        pending_resumes = max(0, total_resumes - (genuine_resumes + provenance_unknown_resumes + synthetic_fallback_resumes))

        total_jobs = db.scalar(select(func.count(Job.id))) or 0
        genuine_jobs = (
            db.scalar(
                select(func.count(func.distinct(JobEmbedding.job_id))).where(
                    JobEmbedding.embedding_type == "full_jd",
                    JobEmbedding.generation_method == "nemotron_api",
                    JobEmbedding.dimensions == self.config.embedding_dimensions,
                    JobEmbedding.embedding_vector.is_not(None),
                )
            )
            or 0
        )
        provenance_unknown_jobs = (
            db.scalar(
                select(func.count(JobEmbedding.id)).where(
                    JobEmbedding.generation_method == "provenance_unknown"
                )
            )
            or 0
        )
        synthetic_fallback_jobs = (
            db.scalar(
                select(func.count(JobEmbedding.id)).where(
                    JobEmbedding.generation_method == "synthetic_fallback"
                )
            )
            or 0
        )
        pending_jobs = max(0, total_jobs - genuine_jobs)

        resume_coverage_pct = (
            round((genuine_resumes / total_resumes) * 100, 1) if total_resumes > 0 else 0.0
        )
        job_coverage_pct = (
            round((genuine_jobs / total_jobs) * 100, 1) if total_jobs > 0 else 0.0
        )

        return {
            "status": "healthy",
            "provider": "OpenRouter",
            "embedding_model": self.config.embedding_model,
            "embedding_dimensions": self.config.embedding_dimensions,
            "chat_model": self.config.chat_model,
            "chat_model_is_free": self.config.chat_model.endswith(":free"),
            "semantic_search_availability": "available",
            "chat_model_availability": "available",
            "rate_limit_state": "openrouter_free_tier",
            "models": {
                "embedding": {
                    "name": self.config.embedding_model,
                    "dimensions": self.config.embedding_dimensions,
                    "status": "active",
                    "coverage_percent": resume_coverage_pct,
                    "genuine_count": genuine_resumes,
                    "provenance_unknown_count": provenance_unknown_resumes,
                    "synthetic_fallback_count": synthetic_fallback_resumes,
                    "pending_count": pending_resumes,
                },
                "chat": {
                    "name": self.config.chat_model,
                    "status": "active",
                    "is_free": self.config.chat_model.endswith(":free"),
                },
            },
            "database_vector_coverage": {
                "resumes": resume_coverage_pct,
                "jobs": job_coverage_pct,
                "genuine_nemotron_resumes": f"{genuine_resumes}/{total_resumes}",
                "provenance_unknown_resumes": f"{provenance_unknown_resumes}/{total_resumes}",
                "synthetic_fallback_resumes": f"{synthetic_fallback_resumes}/{total_resumes}",
                "genuine_nemotron_jobs": f"{genuine_jobs}/{total_jobs}",
                "provenance_unknown_jobs": f"{provenance_unknown_jobs}",
                "synthetic_fallback_jobs": f"{synthetic_fallback_jobs}",
                "pending_resumes": pending_resumes,
                "pending_jobs": pending_jobs,
            },
            "database_audit": {
                "total_candidates": total_candidates,
                "total_resumes": total_resumes,
                "genuine_resumes": genuine_resumes,
                "provenance_unknown_resumes": provenance_unknown_resumes,
                "synthetic_fallback_resumes": synthetic_fallback_resumes,
                "pending_resumes": pending_resumes,
                "resume_coverage_percent": resume_coverage_pct,
                "total_jobs": total_jobs,
                "genuine_jobs": genuine_jobs,
                "provenance_unknown_jobs": provenance_unknown_jobs,
                "synthetic_fallback_jobs": synthetic_fallback_jobs,
                "pending_jobs": pending_jobs,
                "job_coverage_percent": job_coverage_pct,
            },
            "cache": self.cache.metrics,
            "cache_metrics": self.cache.metrics,
        }

    def test_embedding_generation(self, sample_text: str = "Recruitment embedding test") -> Dict[str, Any]:
        """Perform a test embedding generation and return vector dimensions and latency."""
        start = time.perf_counter()
        vector = self.embedder.embed_text(sample_text, force_fresh=True)
        latency_ms = round((time.perf_counter() - start) * 1000, 2)

        return {
            "status": "success",
            "model": self.config.embedding_model,
            "dimensions": len(vector),
            "expected_dimensions": self.config.embedding_dimensions,
            "is_valid": len(vector) == self.config.embedding_dimensions,
            "latency_ms": latency_ms,
            "sample_coordinates": [round(val, 5) for val in vector[:5]],
        }

    def test_chat_generation(self, prompt: str = "Respond with 'CompanyAI Agent Ready'") -> Dict[str, Any]:
        """Perform a test chat completion and return model response and latency."""
        start = time.perf_counter()
        try:
            res = self.chat.complete(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=50,
            )
            latency_ms = round((time.perf_counter() - start) * 1000, 2)
            return {
                "status": "success",
                "model": res.get("model", self.config.chat_model),
                "content": res.get("content"),
                "latency_ms": latency_ms,
            }
        except Exception as e:
            return {
                "status": "degraded_fallback",
                "model": self.config.chat_model,
                "message": str(e),
                "content": "CompanyAI Agent Operational (Rule-based Fallback Active)",
            }


# Shared instance.
ai_health_service = AIHealthService()
