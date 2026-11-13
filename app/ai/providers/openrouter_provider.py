"""Centralized HTTP client and request handler for OpenRouter API."""

import logging
import time
from typing import Any, Dict, Optional
import httpx

from app.ai.config import ai_config
from app.ai.exceptions import (
    AIAuthenticationError,
    AIProviderError,
    AIRateLimitError,
)

logger = logging.getLogger("companyai.ai.openrouter")


class OpenRouterProvider:
    """Manages robust communication with OpenRouter with unified authentication, headers, and retries."""

    def __init__(self, config=ai_config):
        self.config = config

    def _get_headers(self) -> Dict[str, str]:
        """Construct standard OpenRouter authentication and application identification headers."""
        if not self.config.api_key or self.config.api_key == "YOUR_OPENROUTER_API_KEY":
            raise AIAuthenticationError("Missing or placeholder OPENROUTER_API_KEY in .env configuration.")
        return {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "HTTP-Referer": "https://companyai.local",
            "X-Title": "CompanyAI Recruitment Intelligence",
        }

    def post(
        self,
        endpoint_url: str,
        payload: Dict[str, Any],
        timeout_seconds: Optional[float] = None,
        max_retries: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Send a JSON POST request to OpenRouter with automatic backoff, rate-limit parsing, and timing."""
        timeout = timeout_seconds or self.config.request_timeout_seconds
        retries = max_retries or self.config.max_retries
        headers = self._get_headers()

        last_exception: Optional[Exception] = None

        for attempt in range(1, retries + 1):
            try:
                start_time = time.perf_counter()
                with httpx.Client(timeout=timeout) as client:
                    response = client.post(endpoint_url, headers=headers, json=payload)

                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

                # Check for invalid credentials immediately without retrying.
                if response.status_code == 401:
                    raise AIAuthenticationError(
                        "OpenRouter rejected OPENROUTER_API_KEY (401 Unauthorized). Verify your API key."
                    )

                # Check for rate limiting (HTTP 429).
                if response.status_code == 429:
                    err_body = response.text or ""
                    # Check if free tier daily limit has been exhausted.
                    if "free-models-per-day" in err_body or "daily_limit" in err_body:
                        raise AIRateLimitError(
                            "OpenRouter free-tier daily model quota reached (50/50). Upgrade or await reset."
                        )

                    if attempt < retries:
                        retry_after = response.headers.get("Retry-After")
                        try:
                            delay = float(retry_after) if retry_after else (self.config.initial_backoff_seconds * (2 ** (attempt - 1)))
                        except (ValueError, TypeError):
                            delay = self.config.initial_backoff_seconds * (2 ** (attempt - 1))
                        time.sleep(max(1.5, delay))
                        continue
                    else:
                        raise AIRateLimitError(f"OpenRouter rate limit persisted after {retries} attempts.")

                # Check for transient server errors (500, 502, 503, 504).
                if response.status_code in (500, 502, 503, 504):
                    if attempt < retries:
                        delay = self.config.initial_backoff_seconds * (2 ** (attempt - 1))
                        time.sleep(delay)
                        continue

                response.raise_for_status()
                result_data = response.json()
                result_data["_latency_ms"] = latency_ms
                return result_data

            except (httpx.TransportError, httpx.HTTPStatusError) as exc:
                last_exception = exc
                err_str = str(exc)
                # If host is unreachable or DNS resolution fails, fail fast without retry delay
                if "getaddrinfo failed" in err_str or "ConnectError" in str(type(exc)) or "NameResolutionError" in err_str:
                    raise AIProviderError(f"OpenRouter host unreachable: {exc}") from exc

                if attempt < retries:
                    delay = self.config.initial_backoff_seconds * (2 ** (attempt - 1))
                    time.sleep(delay)
                else:
                    break

        raise AIProviderError(f"OpenRouter request to {endpoint_url} failed after {retries} attempts: {last_exception}") from last_exception


# Shared OpenRouter provider instance.
openrouter_provider = OpenRouterProvider()
