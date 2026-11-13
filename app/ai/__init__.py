"""CompanyAI Centralized AI Architecture Package."""

from app.ai.config import ai_config
from app.ai.exceptions import (
    AIPlatformError,
    AIProviderError,
    AIRateLimitError,
    AIEmbeddingError,
    AIGenerationError,
)
from app.ai.providers.openrouter_provider import openrouter_provider
from app.ai.providers.embedding_provider import embedding_provider, NemotronEmbeddingProvider
from app.ai.providers.chat_provider import chat_provider, NemotronChatProvider
from app.ai.services.caching_service import embedding_cache
from app.ai.services.semantic_search_service import semantic_search_service
from app.ai.services.rag_service import rag_service
from app.ai.services.ai_health_service import ai_health_service

__all__ = [
    "ai_config",
    "AIPlatformError",
    "AIProviderError",
    "AIRateLimitError",
    "AIEmbeddingError",
    "AIGenerationError",
    "openrouter_provider",
    "embedding_provider",
    "NemotronEmbeddingProvider",
    "chat_provider",
    "NemotronChatProvider",
    "embedding_cache",
    "semantic_search_service",
    "rag_service",
    "ai_health_service",
]
