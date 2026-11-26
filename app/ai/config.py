"""Centralized local AI configuration for CompanyAI Recruitment Intelligence Platform."""

import os
from pathlib import Path
from dataclasses import dataclass
from dotenv import load_dotenv

# Resolve project root and load environment variables safely without hardcoding.
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")


@dataclass(frozen=True)
class AIConfig:
    """Holds validated local Ollama provider settings, model identifiers, endpoints, and timeouts."""

    # Base URL for the locally hosted Ollama server.
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")

    # Primary local LLM model identifier on Ollama.
    llm_model: str = os.getenv("OLLAMA_LLM_MODEL", "llama3.2:3b").strip()

    # Primary local embedding model identifier on Ollama.
    embedding_model: str = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text").strip()

    # Embedding vector dimensions for nomic-embed-text.
    embedding_dimensions: int = 768

    # Default batch size for vector generation.
    batch_size: int = 16

    # HTTP client timeout in seconds for LLM generation.
    request_timeout_seconds: float = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120.0"))

    # HTTP client timeout in seconds for embedding generation.
    embedding_timeout_seconds: float = float(os.getenv("OLLAMA_EMBEDDING_TIMEOUT_SECONDS", "60.0"))

    # Maximum retry attempts for transient server hiccups.
    max_retries: int = 2

    # Initial exponential backoff delay in seconds.
    initial_backoff_seconds: float = 1.0

    # Fallback dimensions matching local embedding model.
    fallback_dimensions: int = 768

    # Safe compatibility aliases
    @property
    def chat_model(self) -> str:
        return self.llm_model

    @property
    def api_key(self) -> str:
        # Local Ollama requires no API key.
        return ""


# Single shared configuration instance.
ai_config = AIConfig()
AIPlatformConfig = AIConfig

def get_ai_config() -> AIConfig:
    """Return the global AI configuration instance."""
    return ai_config
