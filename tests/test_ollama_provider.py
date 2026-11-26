"""Unit and integration tests for local Ollama provider and 768-dim embedding architecture."""

import math
import pytest
from unittest.mock import MagicMock, patch

from app.ai.config import ai_config
from app.ai.exceptions import AIEmbeddingError, AIOllamaUnavailableError, AIProviderError
from app.ai.providers.embedding_provider import OllamaEmbeddingProvider, generate_deterministic_768_vector
from app.ai.providers.ollama_provider import OllamaProvider
from app.semantic_search import cosine_similarity


def test_ollama_config_defaults():
    """Verify default Ollama parameters and 768 dimensions."""
    assert ai_config.embedding_dimensions == 768
    assert ai_config.embedding_model == "nomic-embed-text"
    assert ai_config.llm_model == "llama3.2:3b"
    assert "11434" in ai_config.ollama_base_url
    assert ai_config.api_key == ""


def test_deterministic_768_vector():
    """Verify deterministic 768-dim test vector generation."""
    v1 = generate_deterministic_768_vector("Senior Full Stack Developer")
    v2 = generate_deterministic_768_vector("Senior Full Stack Developer")
    assert len(v1) == 768
    assert v1 == v2
    # Verify L2 normalization
    norm = math.sqrt(sum(x * x for x in v1))
    assert math.isclose(norm, 1.0, rel_tol=1e-5)


def test_dimension_mismatch_protection():
    """Verify cosine similarity rejects or prevents comparing vectors of differing lengths."""
    v_768 = generate_deterministic_768_vector("Cloud Engineer")
    v_2048 = [0.1] * 2048
    with pytest.raises((ValueError, AssertionError)):
        cosine_similarity(v_768, v_2048)


def test_ollama_provider_embeddings_live_or_mocked():
    """Test generating embeddings through OllamaProvider."""
    provider = OllamaProvider(config=ai_config)
    if provider.is_available():
        vec = provider.embeddings("FastAPI and Python test query")
        assert len(vec) == 768
        assert all(math.isfinite(x) for x in vec)
        assert any(x != 0.0 for x in vec)
    else:
        # Mock test if Ollama not running in CI
        with patch("httpx.Client.post") as mock_post:
            mock_post.return_value.status_code = 200
            mock_post.return_value.json.return_value = {"embedding": [0.01] * 768}
            vec = provider.embeddings("Test text")
            assert len(vec) == 768


def test_ollama_provider_offline_handling():
    """Verify clear AIOllamaUnavailableError when Ollama is unreachable."""
    provider = OllamaProvider(base_url="http://127.0.0.1:9999")  # Unused port
    with pytest.raises(AIOllamaUnavailableError) as exc_info:
        provider.embeddings("Test text", timeout_seconds=1.0)
    assert "unavailable" in str(exc_info.value).lower()


def test_ollama_embedding_provider_validation():
    """Verify OllamaEmbeddingProvider rejects invalid dimensions and non-finite values."""
    embedder = OllamaEmbeddingProvider()
    with pytest.raises(AIEmbeddingError):
        embedder.validate_vector([0.1] * 512)  # Wrong dimension

    with pytest.raises(AIEmbeddingError):
        embedder.validate_vector([float("nan")] * 768)  # NaN

    valid = embedder.validate_vector([0.1] * 768)
    assert len(valid) == 768
