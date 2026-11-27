"""Lightweight thread-safe AI usage telemetry tracker for CompanyAI.

Records every local Ollama chat, generation, and embedding call with:
- Active model name
- Calling CompanyAI feature (inferred from the call stack)
- Latency in milliseconds, token counts, and success/error status
"""

from __future__ import annotations

import inspect
import threading
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List

_LOCK = threading.Lock()
_RECENT_CALLS: Deque[Dict[str, Any]] = deque(maxlen=40)
_FEATURE_STATS: Dict[str, Dict[str, Any]] = defaultdict(
    lambda: {"calls": 0, "errors": 0, "total_latency_ms": 0.0, "tokens": 0, "models": set()}
)
_MODEL_STATS: Dict[str, Dict[str, Any]] = defaultdict(
    lambda: {"calls": 0, "errors": 0, "total_latency_ms": 0.0, "tokens": 0}
)

# Map backend module/file substrings to recruiter-friendly feature labels.
_CALLER_FEATURE_MAP = (
    ("boolean_query_service", "Boolean Search Customization"),
    ("target_company_graph", "Target Companies Sourcing"),
    ("market_report_graph", "Market Intelligence Report"),
    ("rag_service", "AI Assistant / RAG Chat"),
    ("orchestrator", "AI Recruitment Assistant"),
    ("skill_taxonomy_service", "JD Skill Extraction"),
    ("jd_analyzer", "JD Analysis"),
    ("jd_segmentation", "JD Segmentation"),
    ("interview_intelligence", "Interview Kit Generator"),
    ("advertisement_generation", "Job Ad Generator"),
    ("candidate_embedding_service", "Candidate Resume Embeddings"),
    ("jd_embedding_service", "Job Description Embeddings"),
    ("semantic_search", "Semantic Search"),
    ("ai_health_service", "AI Health Diagnostic"),
)


def infer_calling_feature() -> str:
    """Inspect the call stack to identify which CompanyAI feature triggered an AI call."""
    try:
        for frame_info in inspect.stack()[2:18]:
            fname = (frame_info.filename or "").replace("\\", "/").lower()
            for key, label in _CALLER_FEATURE_MAP:
                if key in fname:
                    return label
    except Exception:
        pass
    return "General AI Service"


def record_ai_call(
    model: str,
    operation: str,
    latency_ms: float,
    status: str = "success",
    tokens: int = 0,
    feature: str | None = None,
) -> None:
    """Record one completed or failed AI model invocation."""
    feat = feature or infer_calling_feature()
    ts = datetime.now(timezone.utc).isoformat()
    with _LOCK:
        _RECENT_CALLS.appendleft({
            "timestamp": ts,
            "feature": feat,
            "model": model,
            "operation": operation,
            "latency_ms": round(float(latency_ms), 1),
            "tokens": int(tokens or 0),
            "status": status,
        })

        fs = _FEATURE_STATS[feat]
        fs["calls"] += 1
        if status != "success":
            fs["errors"] += 1
        fs["total_latency_ms"] += float(latency_ms)
        fs["tokens"] += int(tokens or 0)
        fs["models"].add(model)

        ms = _MODEL_STATS[model]
        ms["calls"] += 1
        if status != "success":
            ms["errors"] += 1
        ms["total_latency_ms"] += float(latency_ms)
        ms["tokens"] += int(tokens or 0)


def get_ai_telemetry_snapshot() -> Dict[str, Any]:
    """Return aggregated AI usage readings and recent calls for the monitoring panel."""
    with _LOCK:
        total_calls = sum(v["calls"] for v in _MODEL_STATS.values())
        total_errors = sum(v["errors"] for v in _MODEL_STATS.values())
        total_latency = sum(v["total_latency_ms"] for v in _MODEL_STATS.values())
        total_tokens = sum(v["tokens"] for v in _MODEL_STATS.values())

        by_feature: List[Dict[str, Any]] = []
        for feat, st in sorted(_FEATURE_STATS.items(), key=lambda kv: kv[1]["calls"], reverse=True):
            calls = st["calls"]
            by_feature.append({
                "feature": feat,
                "calls": calls,
                "errors": st["errors"],
                "avg_latency_ms": round(st["total_latency_ms"] / calls, 1) if calls else 0.0,
                "tokens": st["tokens"],
                "models": sorted(st["models"]),
            })

        by_model: List[Dict[str, Any]] = []
        for model, st in sorted(_MODEL_STATS.items(), key=lambda kv: kv[1]["calls"], reverse=True):
            calls = st["calls"]
            by_model.append({
                "model": model,
                "calls": calls,
                "errors": st["errors"],
                "avg_latency_ms": round(st["total_latency_ms"] / calls, 1) if calls else 0.0,
                "tokens": st["tokens"],
            })

        return {
            "total_calls": total_calls,
            "total_errors": total_errors,
            "success_rate_pct": round(((total_calls - total_errors) / total_calls) * 100, 1) if total_calls else 100.0,
            "avg_latency_ms": round(total_latency / total_calls, 1) if total_calls else 0.0,
            "total_tokens": total_tokens,
            "by_feature": by_feature,
            "by_model": by_model,
            "recent_calls": list(_RECENT_CALLS)[:10],
        }
