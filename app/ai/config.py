"""Centralized AI configuration for CompanyAI Recruitment Intelligence Platform."""

import os
from pathlib import Path
from dataclasses import dataclass
from dotenv import load_dotenv

# Resolve project root and load environment variables safely without hardcoding.
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")


@dataclass(frozen=True)
class AIConfig:
    """Holds validated AI provider settings, model identifiers, endpoints, and timeouts."""

    # OpenRouter API Key retrieved from environment.
    api_key: str = os.getenv("OPENROUTER_API_KEY", "").strip()

    # Primary Nemotron embedding model identifier on OpenRouter.
    embedding_model: str = os.getenv(
        "OPENROUTER_EMBEDDING_MODEL",
        "nvidia/nemotron-3-embed-1b:free",
    ).strip()

    # Chat & reasoning model identifier on OpenRouter (verified free model).
    chat_model: str = os.getenv(
        "OPENROUTER_CHAT_MODEL",
        os.getenv("OPENROUTER_LLM_MODEL", "nvidia/nemotron-3.5-super-vl:free"),
    ).strip()

    # Verified embedding vector dimensions for nvidia/nemotron-3-embed-1b:free.
    embedding_dimensions: int = 2048

    # Default batch size for vector generation
    batch_size: int = 16

    # OpenRouter API Endpoints.
    embedding_url: str = "https://openrouter.ai/api/v1/embeddings"
    chat_url: str = "https://openrouter.ai/api/v1/chat/completions"

    # HTTP client timeout in seconds for provider requests.
    request_timeout_seconds: float = 60.0

    # Maximum retry attempts for transient server hiccups or throttling.
    max_retries: int = 5

    # Initial exponential backoff delay in seconds.
    initial_backoff_seconds: float = 1.5

    # Safe fallback dimension if vector projection is needed during upstream provider outages.
    fallback_dimensions: int = 2048


# Single shared configuration instance.
ai_config = AIConfig()
AIPlatformConfig = AIConfig

def get_ai_config() -> AIConfig:
    """Return the global AI configuration instance."""
    return ai_config
