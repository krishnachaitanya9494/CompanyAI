"""Compatibility wrapper routing embedding requests through the centralized local Ollama architecture."""

from typing import List, Sequence

from app.ai.config import ai_config
from app.ai.providers.embedding_provider import (
    embedding_provider,
    generate_deterministic_768_vector,
    generate_deterministic_2048_vector,
)

# Standardized model and provider constants
OLLAMA_EMBEDDING_MODEL = ai_config.embedding_model
OPENROUTER_EMBEDDING_MODEL = ai_config.embedding_model
OPENROUTER_API_KEY = ""
OPENROUTER_EMBEDDING_URL = f"{ai_config.ollama_base_url}/api/embeddings"


def generate_embedding(
    text: str,
    max_retries: int = 2,
    initial_backoff_seconds: float = 1.0,
) -> List[float]:
    """Generate 768-dim vector using the centralized local Ollama nomic-embed-text provider."""
    if not text or not text.strip():
        raise ValueError("Text must not be empty.")

    return embedding_provider.embed_text(text)


__all__ = [
    "OLLAMA_EMBEDDING_MODEL",
    "OPENROUTER_API_KEY",
    "OPENROUTER_EMBEDDING_MODEL",
    "OPENROUTER_EMBEDDING_URL",
    "generate_embedding",
    "generate_deterministic_768_vector",
    "generate_deterministic_2048_vector",
]
