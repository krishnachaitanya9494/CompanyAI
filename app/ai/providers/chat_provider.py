"""Centralized Chat & Text Generation Provider for CompanyAI using local Ollama."""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from app.ai.config import ai_config
from app.ai.exceptions import AIGenerationError
from app.ai.providers.ollama_provider import ollama_provider

logger = logging.getLogger("companyai.ai.chat")


class OllamaChatProvider:
    """Provides conversational responses, explanations, and structured schema reasoning via Ollama."""

    def __init__(self, config=ai_config, provider=ollama_provider):
        self.config = config
        self.provider = provider
        self.model_name = self.config.llm_model

    def is_available(self) -> bool:
        """Check if local Ollama daemon is reachable and model is available."""
        return self.provider.is_available()

    def complete_text(
        self,
        prompt: str,
        system_prompt: str = "You are a recruitment assistant.",
        max_tokens: int = 1000,
        temperature: float = 0.2,
    ) -> str:
        """Convenience method to return generated text response string."""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ]
        res = self.complete(messages, temperature=temperature, max_tokens=max_tokens)
        return res.get("content", "").strip()

    def complete(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 2000,
        response_format: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Generate a chat completion response from the local Ollama model."""
        format_json = bool(response_format and response_format.get("type") == "json_object")
        try:
            data = self.provider.chat(
                messages=messages,
                model=self.model_name,
                temperature=temperature,
                format_json=format_json,
            )
            message = data.get("message", {})
            raw_text = message.get("content") or ""
            return {
                "content": raw_text.strip(),
                "model": data.get("model", self.model_name),
                "usage": {
                    "prompt_eval_count": data.get("prompt_eval_count", 0),
                    "eval_count": data.get("eval_count", 0),
                },
                "latency_ms": data.get("_latency_ms", 0),
            }
        except Exception as exc:
            logger.warning(f"Local Ollama chat generation failed: {exc}")
            raise AIGenerationError(f"Ollama chat completion error: {exc}") from exc

    def extract_json(
        self,
        prompt: str,
        system_prompt: str = "You are a recruitment extraction assistant. Output strictly valid JSON.",
    ) -> Dict[str, Any]:
        """Extract validated JSON data from prompt using local Ollama reasoning with markdown cleaning."""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ]
        result = self.complete(messages, temperature=0.1, response_format={"type": "json_object"})
        content = result["content"]

        # Strip possible markdown ```json ... ``` tags
        cleaned = re.sub(r"^```(?:json)?\s*", "", content, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned).strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Fallback regex extraction if model wrapped JSON in conversational text
            match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", cleaned)
            if match:
                try:
                    return json.loads(match.group(1))
                except json.JSONDecodeError:
                    pass
            raise AIGenerationError(f"Failed to parse model output as valid JSON: {content[:200]}")


# Backward compatibility alias
NemotronChatProvider = OllamaChatProvider

# Shared instance
chat_provider = OllamaChatProvider()
