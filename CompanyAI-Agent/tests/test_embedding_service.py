from unittest.mock import Mock, patch

import pytest

from app import embedding_service


def test_generate_embedding_uses_openrouter_request(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(embedding_service, "OPENROUTER_API_KEY", "test-key")
    response = Mock()
    response.json.return_value = {"data": [{"embedding": [0.1, 0.2]}]}

    with patch("app.embedding_service.httpx.Client") as client_class:
        client = client_class.return_value.__enter__.return_value
        client.post.return_value = response

        result = embedding_service.generate_embedding(" sample text ")

    assert result == [0.1, 0.2]
    client.post.assert_called_once_with(
        embedding_service.OPENROUTER_EMBEDDING_URL,
        headers={
            "Authorization": "Bearer test-key",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json={
            "input": "sample text",
            "model": embedding_service.OPENROUTER_EMBEDDING_MODEL,
        },
    )
    response.raise_for_status.assert_called_once()


@pytest.mark.parametrize("api_key", [None, "", "YOUR_OPENROUTER_API_KEY"])
def test_generate_embedding_requires_valid_api_key(
    monkeypatch: pytest.MonkeyPatch,
    api_key: str | None,
) -> None:
    monkeypatch.setattr(embedding_service, "OPENROUTER_API_KEY", api_key)

    with pytest.raises(RuntimeError, match="valid OpenRouter API key"):
        embedding_service.generate_embedding("sample text")


def test_generate_embedding_rejects_empty_text(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(embedding_service, "OPENROUTER_API_KEY", "test-key")

    with pytest.raises(ValueError, match="must not be empty"):
        embedding_service.generate_embedding("  ")


def test_generate_embedding_rejects_invalid_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(embedding_service, "OPENROUTER_API_KEY", "test-key")
    response = Mock()
    response.json.return_value = {"data": []}

    with patch("app.embedding_service.httpx.Client") as client_class:
        client_class.return_value.__enter__.return_value.post.return_value = response

        with pytest.raises(RuntimeError, match="invalid embedding response"):
            embedding_service.generate_embedding("sample text")


def test_generate_embedding_reports_unauthorized_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(embedding_service, "OPENROUTER_API_KEY", "test-key")
    response = Mock(status_code=401)

    with patch("app.embedding_service.httpx.Client") as client_class:
        client_class.return_value.__enter__.return_value.post.return_value = response

        with pytest.raises(RuntimeError, match="OpenRouter rejected OPENROUTER_API_KEY"):
            embedding_service.generate_embedding("sample text")
