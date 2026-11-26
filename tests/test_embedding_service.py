from unittest.mock import Mock, patch
import pytest

from app import embedding_service
from app.ai.providers.embedding_provider import embedding_provider


def test_generate_embedding_delegates_to_provider() -> None:
    """Verify generate_embedding delegates to centralized Ollama embedding provider."""
    mock_vec = [0.01] * 768
    with patch.object(embedding_provider, "embed_text", return_value=mock_vec):
        result = embedding_service.generate_embedding("Senior Software Engineer Python")
        assert result == mock_vec
        assert len(result) == 768


def test_generate_embedding_rejects_empty_text() -> None:
    """Verify empty text raises ValueError."""
    with pytest.raises(ValueError, match="must not be empty"):
        embedding_service.generate_embedding("  ")

    with pytest.raises(ValueError, match="must not be empty"):
        embedding_service.generate_embedding("")


def test_embedding_service_constants() -> None:
    """Verify model and dimensions match local Ollama configuration."""
    assert embedding_service.OLLAMA_EMBEDDING_MODEL == "nomic-embed-text"
    assert embedding_service.OPENROUTER_EMBEDDING_MODEL == "nomic-embed-text"
    assert embedding_service.OPENROUTER_API_KEY == ""
