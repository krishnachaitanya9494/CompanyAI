"""Centralized Chat & Text Generation Provider for CompanyAI."""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from app.ai.config import ai_config
from app.ai.exceptions import AIGenerationError
from app.ai.providers.openrouter_provider import openrouter_provider

logger = logging.getLogger("companyai.ai.chat")


class NemotronChatProvider:
    """Provides conversational responses, explanations, and structured schema reasoning."""

    def __init__(self, config=ai_config, provider=openrouter_provider):
        self.config = config
        self.provider = provider
        self.model_name = self.config.chat_model

    def complete(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 2000,
        response_format: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Generate a chat completion response from the configured OpenRouter model."""
        payload: Dict[str, Any] = {
            "model": self.model_name,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format

        try:
            data = self.provider.post(self.config.chat_url, payload)
            choices = data.get("choices", [])
            if not choices or not choices[0].get("message"):
                raise AIGenerationError("Empty response from chat completion provider.")

            message = choices[0]["message"]
            raw_text = message.get("content") or ""
            return {
                "content": raw_text.strip(),
                "model": data.get("model", self.model_name),
                "usage": data.get("usage", {}),
                "latency_ms": data.get("_latency_ms", 0),
            }
        except Exception as exc:
            logger.warning(f"Live chat generation failed: {exc}")
            raise AIGenerationError(f"Chat completion provider error: {exc}") from exc

    def extract_json(
        self,
        prompt: str,
        system_prompt: str = "You are a recruitment extraction assistant. Output strictly valid JSON.",
    ) -> Dict[str, Any]:
        """Extract validated JSON data from prompt using LLM reasoning with markdown cleaning."""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ]
        result = self.complete(messages, temperature=0.1)
        content = result["content"]

        # Strip possible markdown ```json ... ``` tags
        cleaned = re.sub(r"^```(?:json)?\s*", "", content, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned).strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as err:
            raise AIGenerationError(f"Failed to parse model JSON: {err}") from err


# Shared instance.
chat_provider = NemotronChatProvider()
