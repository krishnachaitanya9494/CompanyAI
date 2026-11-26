"""Centralized local Ollama Embedding Provider for CompanyAI using nomic-embed-text."""

import hashlib
import logging
import math
import re
from typing import Any, Dict, List, Optional, Sequence

from app.ai.config import ai_config
from app.ai.exceptions import AIEmbeddingError, AIProviderError, AIRateLimitError
from app.ai.providers.ollama_provider import ollama_provider
from app.ai.services.caching_service import embedding_cache

logger = logging.getLogger("companyai.ai.embedding")


def generate_deterministic_768_vector(text: str) -> List[float]:
    """Isolated token-hash vector projector for offline testing/debug purposes ONLY (768-dim)."""
    vector = [0.0] * 768
    tokens = re.findall(r"\w+", (text or "").lower())
    if not tokens:
        tokens = ["document"]

    for token in tokens:
        h = hashlib.sha256(token.encode("utf-8")).digest()
        for i in range(0, len(h), 2):
            val = int.from_bytes(h[i : i + 2], "big")
            idx = val % 768
            sign = 1.0 if (val & 1) else -1.0
            vector[idx] += sign

    norm = math.sqrt(sum(v * v for v in vector))
    if norm > 0:
        return [float(v / norm) for v in vector]
    vector[0] = 1.0
    return vector


def generate_deterministic_2048_vector(text: str) -> List[float]:
    """Legacy 2048-dim deterministic vector preserved exclusively for legacy test compatibility."""
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

    norm = math.sqrt(sum(v * v for v in vector))
    if norm > 0:
        return [float(v / norm) for v in vector]
    vector[0] = 1.0
    return vector


class OllamaEmbeddingProvider:
    """Provides validated 768-dimensional semantic embeddings using local nomic-embed-text via Ollama."""

    def __init__(self, config=ai_config, provider=ollama_provider, cache=embedding_cache):
        self.config = config
        self.provider = provider
        self.cache = cache
        self.model_name = self.config.embedding_model
        self.dimensions = self.config.embedding_dimensions

    def embed_text(self, text: str, force_fresh: bool = False) -> List[float]:
        """Convert a single text string into a validated 768-dimensional embedding vector."""
        if not text or not text.strip():
            raise AIEmbeddingError("Cannot generate embedding for empty text.")

        cleaned_text = text.strip()

        # Check local SHA-256 vector cache first to avoid recomputation
        if not force_fresh:
            cached_vector = self.cache.get(cleaned_text)
            if cached_vector and len(cached_vector) == self.dimensions:
                return cached_vector

        try:
            vector = self.provider.embeddings(
                prompt=cleaned_text,
                model=self.model_name,
                timeout_seconds=self.config.embedding_timeout_seconds,
            )

            if len(vector) != self.dimensions:
                raise AIEmbeddingError(
                    f"Returned embedding dimension {len(vector)} differs from expected {self.dimensions}."
                )

            # Validate finiteness
            for val in vector:
                if not math.isfinite(val):
                    raise AIEmbeddingError("Non-finite value detected in embedding vector.")

            # Cache the verified vector
            self.cache.set(cleaned_text, vector)
            return vector

        except Exception as exc:
            err_msg = str(exc)
            logger.error(f"Local Ollama embedding generation failed: {err_msg}")
            if isinstance(exc, AIEmbeddingError):
                raise
            raise AIEmbeddingError(f"Ollama embedding generation failed: {err_msg}") from exc

    def embed_batch(
        self, texts: Sequence[str], batch_size: int = 25, force_fresh: bool = False
    ) -> List[List[float]]:
        """Batch embed a list of texts with chunking, caching, and batch acceleration."""
        if not texts:
            return []

        results: List[Optional[List[float]]] = [None] * len(texts)
        uncached_indices: List[int] = []
        uncached_texts: List[str] = []

        for idx, text in enumerate(texts):
            clean = (text or "").strip()
            if not clean:
                raise AIEmbeddingError("Cannot generate embedding for empty text in batch.")
            if not force_fresh:
                cached = self.cache.get(clean)
                if cached and len(cached) == self.dimensions:
                    results[idx] = cached
                    continue
            uncached_indices.append(idx)
            uncached_texts.append(clean)

        if uncached_texts:
            for i in range(0, len(uncached_texts), batch_size):
                chunk_texts = uncached_texts[i : i + batch_size]
                chunk_indices = uncached_indices[i : i + batch_size]
                try:
                    chunk_vectors = self.provider.embed_batch(
                        chunk_texts,
                        model=self.model_name,
                        timeout_seconds=max(60.0, len(chunk_texts) * 10.0),
                    )
                    for c_idx, vec in zip(chunk_indices, chunk_vectors):
                        valid_vec = self.validate_vector(vec)
                        self.cache.set(texts[c_idx].strip(), valid_vec)
                        results[c_idx] = valid_vec
                except Exception:
                    # Fallback to sequential embed_text for this chunk
                    for c_idx in chunk_indices:
                        results[c_idx] = self.embed_text(texts[c_idx], force_fresh=force_fresh)

        return [r for r in results if r is not None]

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
    generate_deterministic_768_vector = staticmethod(generate_deterministic_768_vector)


# Backward-compatibility alias
NemotronEmbeddingProvider = OllamaEmbeddingProvider

# Shared singleton instance
embedding_provider = OllamaEmbeddingProvider()
