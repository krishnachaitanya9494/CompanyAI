"""FastAPI router for centralized AI intelligence, health, RAG, and vector discovery endpoints."""

import re
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.ai.services.ai_health_service import ai_health_service
from app.ai.services.rag_service import rag_service
from app.ai.services.semantic_search_service import semantic_search_service
from app.services.candidate_embedding_service import backfill_candidate_embeddings
from database.sqlite_connection import get_db

router = APIRouter(prefix="/api/ai", tags=["AI Intelligence & Administration"])


class TestEmbeddingSchema(BaseModel):
    text: str = Field(default="Senior Cloud Architect with AWS and Kubernetes experience", description="Sample text to embed")


class TestChatSchema(BaseModel):
    prompt: str = Field(default="Summarize the core competencies of a DevOps Engineer in two sentences.", description="Prompt to evaluate")


class RAGQuerySchema(BaseModel):
    question: Optional[str] = Field(default=None, description="Recruitment question or candidate inquiry")
    query: Optional[str] = Field(default=None, description="Alternative field name for recruitment question")
    job_id: Optional[int] = Field(default=None, description="Optional job context identifier")
    top_k: int = Field(default=5, ge=1, le=20, description="Max candidate evidence records to retrieve")

    @property
    def effective_question(self) -> str:
        return (self.question or self.query or "").strip()


class ReindexSchema(BaseModel):
    batch_size: int = Field(default=20, ge=1, le=100, description="Batch size for re-indexing")
    force: bool = Field(default=False, description="Force re-generation even if hashes match")


@router.get("/health")
def get_ai_health(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Retrieve active local Ollama AI models, verified 768 dimensions, database vector coverage, and cache status."""
    return ai_health_service.get_health_report(db)


@router.get("/monitor")
def get_ai_monitor(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Return live AI model status, per-feature usage readings, bar metrics, and recent AI calls."""
    from app.ai.providers.ollama_provider import ollama_provider
    from app.ai.services.ai_telemetry import get_ai_telemetry_snapshot

    health = ai_health_service.get_health_report(db)
    telemetry = get_ai_telemetry_snapshot()
    live_online = ollama_provider.is_available()

    chat_model = health.get("chat_model", "llama3.2:3b")
    emb_model = health.get("embedding_model", "nomic-embed-text")
    live_by_feature = {row["feature"]: row for row in telemetry.get("by_feature", [])}

    # Combine live telemetry with the known CompanyAI modules that use local AI.
    catalog = [
        ("Boolean Search Customization", chat_model, "Jobs → Boolean Search"),
        ("Target Companies Sourcing", chat_model, "Jobs → Target Companies"),
        ("Market Intelligence Report", chat_model, "Jobs → Create Report"),
        ("AI Recruitment Assistant", chat_model, "AI Assistant / RAG Chat"),
        ("JD Skill Extraction", chat_model, "Jobs → JD Scope & Analysis"),
        ("Candidate Resume Embeddings", emb_model, "Candidates & Matching Matrix"),
        ("Job Description Embeddings", emb_model, "Jobs & Semantic Search"),
        ("Interview Kit Generator", chat_model, "Jobs → Interview Kit"),
    ]
    where_used = []
    seen = set()
    for feat_name, default_model, location_hint in catalog:
        seen.add(feat_name)
        live = live_by_feature.get(feat_name, {})
        where_used.append({
            "feature": feat_name,
            "location": location_hint,
            "model": ", ".join(live.get("models") or [default_model]),
            "calls": live.get("calls", 0),
            "errors": live.get("errors", 0),
            "avg_latency_ms": live.get("avg_latency_ms", 0.0),
            "tokens": live.get("tokens", 0),
            "active_now": live.get("calls", 0) > 0,
        })
    for row in telemetry.get("by_feature", []):
        if row["feature"] not in seen:
            where_used.append({
                "feature": row["feature"],
                "location": "Backend AI Pipeline",
                "model": ", ".join(row.get("models") or [chat_model]),
                "calls": row["calls"],
                "errors": row["errors"],
                "avg_latency_ms": row["avg_latency_ms"],
                "tokens": row["tokens"],
                "active_now": True,
            })

    return {
        "ollama_online": live_online,
        "provider": "Ollama (Local)",
        "chat_model": chat_model,
        "embedding_model": emb_model,
        "embedding_dimensions": health.get("embedding_dimensions", 768),
        "telemetry": telemetry,
        "where_ai_is_used": where_used,
        "database_audit": health.get("database_audit", {}),
        "cache_metrics": health.get("cache_metrics", {}),
    }


@router.post("/test-embedding")
def test_embedding(payload: Optional[TestEmbeddingSchema] = None) -> Dict[str, Any]:
    """Execute a test embedding with the local Ollama nomic-embed-text model and return latency and dimensions."""
    sample_text = payload.text if payload else "Recruitment test"
    return ai_health_service.test_embedding_generation(sample_text)


@router.post("/test-chat")
def test_chat(payload: Optional[TestChatSchema] = None) -> Dict[str, Any]:
    """Execute a test text generation with the chat model and return output and latency."""
    prompt = payload.prompt if payload else "CompanyAI health check"
    return ai_health_service.test_chat_generation(prompt)


@router.post("/rag/query")
def execute_rag_query(payload: RAGQuerySchema, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Answer recruitment questions grounded in retrieved database records with source citations."""
    return rag_service.answer_query(
        db=db,
        question=payload.effective_question,
        job_id=payload.job_id,
        top_k=payload.top_k,
    )


@router.get("/similar-candidates/{candidate_id}")
def get_similar_candidates(
    candidate_id: int,
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Discover candidates with closest technical profiles using 2048-dim resume vector proximity."""
    return semantic_search_service.find_similar_candidates(db=db, candidate_id=candidate_id, limit=limit)


@router.get("/similar-jobs/{job_id}")
def get_similar_jobs(
    job_id: str,
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Discover related open job requisitions based on full JD semantic embeddings."""
    digits = re.sub(r"[^0-9]", "", str(job_id))
    try:
        j_id = int(digits) if digits else int(str(job_id))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid job ID format.")
    return semantic_search_service.find_similar_jobs(db=db, job_id=j_id, limit=limit)


@router.post("/reindex")
def trigger_reindex(payload: Optional[ReindexSchema] = None, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Trigger controlled batch re-indexing of missing or outdated candidate embeddings."""
    batch_size = payload.batch_size if payload else 20
    force = payload.force if payload else False
    return backfill_candidate_embeddings(db, batch_size=batch_size, force=force)
