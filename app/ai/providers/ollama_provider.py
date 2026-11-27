"""Centralized HTTP client and request handler for local Ollama API."""

import logging
import time
from typing import Any, Dict, List, Optional
import httpx

from app.ai.config import ai_config
from app.ai.exceptions import (
    AIProviderError,
    AIOllamaUnavailableError,
    AIGenerationError,
    AIEmbeddingError,
)
from app.ai.services.ai_telemetry import record_ai_call

logger = logging.getLogger("companyai.ai.ollama")


class OllamaProvider:
    """Manages robust communication with the locally hosted Ollama instance."""

    def __init__(self, config=ai_config, base_url: Optional[str] = None):
        self.config = config
        self._base_url = base_url

    @property
    def base_url(self) -> str:
        return self._base_url or self.config.ollama_base_url

    def is_available(self, timeout_seconds: float = 3.0) -> bool:
        """Check if local Ollama daemon is active and responsive."""
        try:
            with httpx.Client(timeout=timeout_seconds) as client:
                res = client.get(f"{self.base_url}/api/tags")
                return res.status_code == 200
        except Exception:
            return False

    def list_models(self, timeout_seconds: float = 5.0) -> List[Dict[str, Any]]:
        """List all models currently installed in the local Ollama instance."""
        try:
            with httpx.Client(timeout=timeout_seconds) as client:
                res = client.get(f"{self.base_url}/api/tags")
                res.raise_for_status()
                return res.json().get("models", [])
        except (httpx.ConnectError, httpx.TimeoutException) as exc:
            raise AIOllamaUnavailableError(
                f"Local Ollama server is unavailable at {self.base_url}. Start Ollama and retry."
            ) from exc
        except Exception as exc:
            raise AIProviderError(f"Failed to query Ollama models: {exc}") from exc

    def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.2,
        format_json: bool = False,
        timeout_seconds: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Send chat messages to Ollama /api/chat with timing and error handling."""
        model_name = model or self.config.llm_model
        timeout = timeout_seconds or self.config.request_timeout_seconds
        payload: Dict[str, Any] = {
            "model": model_name,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
            },
        }
        if format_json:
            payload["format"] = "json"

        start_time = time.perf_counter()
        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.post(f"{self.base_url}/api/chat", json=payload)
                response.raise_for_status()
                data = response.json()
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                data["_latency_ms"] = latency_ms
                tokens = int(data.get("eval_count") or 0) + int(data.get("prompt_eval_count") or 0)
                record_ai_call(model=model_name, operation="chat", latency_ms=latency_ms, status="success", tokens=tokens)
                return data
        except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
            record_ai_call(model=model_name, operation="chat", latency_ms=(time.perf_counter() - start_time) * 1000, status="error")
            raise AIOllamaUnavailableError(
                f"Local Ollama server is unavailable at {self.base_url}. Start Ollama and retry."
            ) from exc
        except httpx.TimeoutException as exc:
            record_ai_call(model=model_name, operation="chat", latency_ms=(time.perf_counter() - start_time) * 1000, status="error")
            raise AIProviderError(
                f"Ollama inference timed out after {timeout}s for model '{model_name}'."
            ) from exc
        except Exception as exc:
            record_ai_call(model=model_name, operation="chat", latency_ms=(time.perf_counter() - start_time) * 1000, status="error")
            raise AIProviderError(f"Ollama chat completion failed: {exc}") from exc

    def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.2,
        format_json: bool = False,
        timeout_seconds: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Send single-turn completion prompt to Ollama /api/generate."""
        model_name = model or self.config.llm_model
        timeout = timeout_seconds or self.config.request_timeout_seconds
        payload: Dict[str, Any] = {
            "model": model_name,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
            },
        }
        if system:
            payload["system"] = system
        if format_json:
            payload["format"] = "json"

        start_time = time.perf_counter()
        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.post(f"{self.base_url}/api/generate", json=payload)
                response.raise_for_status()
                data = response.json()
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                data["_latency_ms"] = latency_ms
                return data
        except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
            raise AIOllamaUnavailableError(
                f"Local Ollama server is unavailable at {self.base_url}. Start Ollama and retry."
            ) from exc
        except httpx.TimeoutException as exc:
            raise AIProviderError(
                f"Ollama inference timed out after {timeout}s for model '{model_name}'."
            ) from exc
        except Exception as exc:
            raise AIProviderError(f"Ollama generation failed: {exc}") from exc

    def embeddings(
        self,
        prompt: str,
        model: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
    ) -> List[float]:
        """Generate dense vector embedding using Ollama /api/embeddings with context safety truncation."""
        model_name = model or self.config.embedding_model
        timeout = timeout_seconds or self.config.embedding_timeout_seconds
        # Truncate to context length limit of nomic-embed-text (2048 tokens ~ 6000 chars) and sanitize surrogates
        clean_prompt = (prompt or "").encode("utf-8", "ignore").decode("utf-8").strip()[:6000]
        if not clean_prompt:
            raise AIEmbeddingError("Cannot generate embedding for empty text.")

        payload = {
            "model": model_name,
            "prompt": clean_prompt,
        }
        start_emb = time.perf_counter()
        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.post(f"{self.base_url}/api/embeddings", json=payload)
                response.raise_for_status()
                data = response.json()
                emb = data.get("embedding")
                if not isinstance(emb, list) or not emb:
                    raise AIEmbeddingError("Ollama returned empty embedding vector.")
                record_ai_call(
                    model=model_name,
                    operation="embeddings",
                    latency_ms=(time.perf_counter() - start_emb) * 1000,
                    status="success",
                )
                return [float(x) for x in emb]
        except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
            record_ai_call(model=model_name, operation="embeddings", latency_ms=(time.perf_counter() - start_emb) * 1000, status="error")
            raise AIOllamaUnavailableError(
                f"Local Ollama server is unavailable at {self.base_url}. Start Ollama and retry."
            ) from exc
        except httpx.TimeoutException as exc:
            record_ai_call(model=model_name, operation="embeddings", latency_ms=(time.perf_counter() - start_emb) * 1000, status="error")
            raise AIEmbeddingError(
                f"Ollama embedding generation timed out after {timeout}s."
            ) from exc
        except Exception as exc:
            record_ai_call(model=model_name, operation="embeddings", latency_ms=(time.perf_counter() - start_emb) * 1000, status="error")
            if isinstance(exc, (AIEmbeddingError, AIOllamaUnavailableError)):
                raise
            raise AIEmbeddingError(f"Ollama embedding generation failed: {exc}") from exc

    def embed_batch(
        self,
        prompts: Sequence[str],
        model: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
    ) -> List[List[float]]:
        """Generate dense vector embeddings in batch using Ollama /api/embed with context safety truncation."""
        if not prompts:
            return []
        model_name = model or self.config.embedding_model
        # Truncate each prompt to safe context length (6000 chars) and sanitize surrogates
        clean_prompts = [(p or "").encode("utf-8", "ignore").decode("utf-8").strip()[:6000] for p in prompts]
        timeout = timeout_seconds or max(60.0, 5.0 * len(prompts))
        payload = {
            "model": model_name,
            "input": clean_prompts,
        }
        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.post(f"{self.base_url}/api/embed", json=payload)
                if response.status_code == 200:
                    data = response.json()
                    embs = data.get("embeddings")
                    if isinstance(embs, list) and len(embs) == len(clean_prompts):
                        return [[float(x) for x in emb] for emb in embs]
        except Exception as exc:
            logger.warning(f"Batch embed via /api/embed encountered issue ({exc}); falling back to sequential.")

        # Fallback to individual embeddings
        return [self.embeddings(p, model=model_name, timeout_seconds=timeout_seconds) for p in clean_prompts]


# Shared provider singleton.
ollama_provider = OllamaProvider()
