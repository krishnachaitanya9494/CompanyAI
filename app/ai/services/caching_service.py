"""Embedding vector caching service using SHA-256 digests."""

import hashlib
import time
from typing import Dict, List, Optional, Tuple


class EmbeddingCacheService:
    """In-memory cache for generated embedding vectors keyed by normalized SHA-256 text hashes."""

    def __init__(self, max_size: int = 5000):
        self._max_size = max_size
        self._cache: Dict[str, Tuple[List[float], float]] = {}  # hash -> (vector, timestamp)
        self._hits: int = 0
        self._misses: int = 0

    @staticmethod
    def compute_hash(text: str) -> str:
        """Compute standard lowercase 64-character SHA-256 hash for raw or stripped text."""
        return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()

    def get(self, text: str) -> Optional[List[float]]:
        """Retrieve cached vector coordinates if available for the given text."""
        key = self.compute_hash(text)
        if key in self._cache:
            self._hits += 1
            return list(self._cache[key][0])
        self._misses += 1
        return None

    def set(self, text: str, vector: List[float]) -> None:
        """Store vector coordinates under the text's SHA-256 hash with LRU eviction when full."""
        if len(self._cache) >= self._max_size:
            # Evict oldest 20% of entries when max capacity is reached.
            sorted_keys = sorted(self._cache.keys(), key=lambda k: self._cache[k][1])
            for k in sorted_keys[: int(self._max_size * 0.2)]:
                self._cache.pop(k, None)

        key = self.compute_hash(text)
        self._cache[key] = (list(vector), time.time())

    def clear(self) -> None:
        """Flush all cached vector entries."""
        self._cache.clear()

    @property
    def metrics(self) -> dict:
        """Return cache health metrics, total stored entries, and hit ratio."""
        total = self._hits + self._misses
        ratio = round((self._hits / total) * 100, 2) if total > 0 else 0.0
        return {
            "cached_entries": len(self._cache),
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_ratio_percent": ratio,
        }


# Global shared cache instance.
embedding_cache = EmbeddingCacheService()
