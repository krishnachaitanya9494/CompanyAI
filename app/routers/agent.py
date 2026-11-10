# Import APIRouter, Depends, Query from FastAPI.
from fastapi import APIRouter, Depends, Query
# Import Session from SQLAlchemy.
from sqlalchemy.orm import Session
# Import typing helpers.
from typing import Any, Optional
# Import Pydantic models.
from pydantic import BaseModel, Field
# Import database session dependency.
from database.sqlite_connection import get_db
# Import AgentOrchestrator.
from app.agent.orchestrator import AgentOrchestrator
# Import database models.
from database.models import AgentTrace

# Create router for AI agent and execution traces.
router = APIRouter(prefix="/api/ai", tags=["AI Agent"])


class ChatQuerySchema(BaseModel):
    query: str = Field(..., description="Recruiter message or instruction")
    session_id: Optional[str] = Field(default="default-session", description="Session identifier")


@router.post("/chat")
def chat_with_agent(
    payload: ChatQuerySchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Execute AI recruitment agent query with tool calling, evidence retrieval, and trace observability."""
    orchestrator = AgentOrchestrator(session=db)
    result = orchestrator.execute(user_query=payload.query, session_id=payload.session_id)
    return {
        "status": "success",
        "response": result["text"],
        "candidates": result["candidates"],
        "trace": {
            "trace_id": result["trace_id"],
            "model": result["model_name"],
            "latency_ms": result["latency_ms"],
            "tools_called": result["tools_called"],
        }
    }


@router.get("/traces")
def list_agent_traces(
    limit: int = Query(default=10, description="Max traces to return"),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Retrieve Langfuse-style execution traces showing tool calls, latency, and tokens."""
    traces = db.query(AgentTrace).order_by(AgentTrace.created_at.desc()).limit(limit).all()
    results = []
    for t in traces:
        results.append({
            "traceId": t.trace_id,
            "prompt": t.prompt,
            "modelName": t.model_name,
            "toolsCalled": t.tools_called,
            "latencyMs": t.latency_ms,
            "tokensUsed": t.tokens_used,
            "status": t.status,
            "createdAt": t.created_at.strftime("%I:%M:%S %p, %b %d") if t.created_at else "",
        })
    return results
