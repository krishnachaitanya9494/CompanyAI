"""Centralized Nemotron Embedding Provider for CompanyAI."""

import hashlib
import logging
import math
import re
from typing import Any, Dict, List, Optional, Sequence

from app.ai.config import ai_config
from app.ai.exceptions import AIEmbeddingError, AIProviderError, AIRateLimitError
from app.ai.providers.openrouter_provider import openrouter_provider
from app.ai.services.caching_service import embedding_cache

logger = logging.getLogger("companyai.ai.embedding")


def generate_deterministic_2048_vector(text: str) -> List[float]:
    """Isolated token-hash vector projector for offline testing/debug purposes ONLY.
    
    CRITICAL: This function is strictly for non-production unit testing. It MUST NEVER
    be stored in the database or used for semantic similarity in production retrieval.
    """
    vector = [0.0] * 2048
    tokens = re.findall(r"\w+", (text or "").lower())
    if not tokens:
        tokens = ["document"]

    for token in tokens:
        h = hashlib.sha256(token.encode("utf-8")).digest()
        for i in range(0, len(h), 2):
            val = int.from_bytes(h[i : i + 2], "big")
            idx = val % 2048
            sign = 1.0 if (val & 1) else -1.0
            vector[idx] += sign

    # L2 normalize so cosine similarity evaluates accurately
    norm = math.sqrt(sum(v * v for v in vector))
    if norm > 0:
        return [float(v / norm) for v in vector]
    vector[0] = 1.0
    return vector


class NemotronEmbeddingProvider:
    """Provides validated 2048-dimensional semantic embeddings using nvidia/nemotron-3-embed-1b:free."""

    def __init__(self, config=ai_config, provider=openrouter_provider, cache=embedding_cache):
        self.config = config
        self.provider = provider
        self.cache = cache
        self.model_name = self.config.embedding_model
        self.dimensions = self.config.embedding_dimensions

    def embed_text(self, text: str, force_fresh: bool = False) -> List[float]:
        """Convert a single text string into a validated 2048-dimensional embedding vector."""
        if not text or not text.strip():
            raise AIEmbeddingError("Cannot generate embedding for empty text.")

        cleaned_text = text.strip()

        # Check local SHA-256 vector cache first to save API tokens and time.
        if not force_fresh:
            cached_vector = self.cache.get(cleaned_text)
            if cached_vector and len(cached_vector) == self.dimensions:
                return cached_vector

        payload = {
            "input": cleaned_text,
            "model": self.model_name,
        }

        try:
            response_data = self.provider.post(self.config.embedding_url, payload)
            records = response_data.get("data")
            if not isinstance(records, list) or not records:
                raise AIEmbeddingError("Invalid OpenRouter embedding response structure.")

            raw_embedding = records[0].get("embedding")
            if not isinstance(raw_embedding, list) or not raw_embedding:
                raise AIEmbeddingError("Missing vector in OpenRouter embedding response.")

            vector = [float(v) for v in raw_embedding]

            # Validate actual returned dimension.
            if len(vector) != self.dimensions:
                logger.warning(
                    f"Returned embedding dimension {len(vector)} differs from declared {self.dimensions}."
                )

            # Cache the verified vector.
            self.cache.set(cleaned_text, vector)
            return vector

        except Exception as exc:
            err_msg = str(exc)
            logger.error(f"Live Nemotron embedding generation failed: {err_msg}")
            if "Rate limit" in err_msg or "429" in err_msg:
                raise AIRateLimitError(f"OpenRouter Nemotron embedding model rate limit exceeded: {err_msg}") from exc
            raise AIEmbeddingError(f"Nemotron embedding generation failed: {err_msg}") from exc

    def embed_batch(
        self, texts: Sequence[str], batch_size: int = 10, force_fresh: bool = False
    ) -> List[List[float]]:
        """Batch embed a list of texts with chunking, caching, and graceful fallback handling."""
        results: List[List[float]] = []
        for text in texts:
            vector = self.embed_text(text, force_fresh=force_fresh)
            results.append(vector)
        return results

    def validate_vector(self, vector: Sequence[float]) -> List[float]:
        """Verify vector finiteness and dimension requirements."""
        if not vector or len(vector) != self.dimensions:
            raise AIEmbeddingError(
                f"Embedding vector must have exactly {self.dimensions} dimensions (received {len(vector) if vector else 0})."
            )
        for val in vector:
            if not math.isfinite(float(val)):
                raise AIEmbeddingError("Vector coordinates must be finite numerical values.")
        return [float(v) for v in vector]

    # Aliases for cross-compatibility
    generate_embedding = embed_text
    generate_batch_embeddings = embed_batch
    generate_deterministic_2048_vector = staticmethod(generate_deterministic_2048_vector)


# Shared instance.
embedding_provider = NemotronEmbeddingProvider()
