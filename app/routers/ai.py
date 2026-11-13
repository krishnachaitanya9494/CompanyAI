"""FastAPI router for centralized AI intelligence, health, RAG, and vector discovery endpoints."""

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
    """Retrieve active AI models, verified 2048 dimensions, database vector coverage, and cache status."""
    return ai_health_service.get_health_report(db)


@router.post("/test-embedding")
def test_embedding(payload: Optional[TestEmbeddingSchema] = None) -> Dict[str, Any]:
    """Execute a test embedding with the primary Nemotron model and return latency and dimensions."""
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
    job_id: int,
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Discover related open job requisitions based on full JD semantic embeddings."""
    return semantic_search_service.find_similar_jobs(db=db, job_id=job_id, limit=limit)


@router.post("/reindex")
def trigger_reindex(payload: Optional[ReindexSchema] = None, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Trigger controlled batch re-indexing of missing or outdated candidate embeddings."""
    batch_size = payload.batch_size if payload else 20
    force = payload.force if payload else False
    return backfill_candidate_embeddings(db, batch_size=batch_size, force=force)
