"""Centralized Local Ollama Adapter for LangGraph Workflows.

Adapts CompanyAI's existing OllamaChatProvider to LangChain's BaseChatModel interface
without creating redundant client connections or external dependencies.
"""

from typing import Any, List, Optional
from pydantic import Field

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_core.callbacks.manager import CallbackManagerForLLMRun

from app.ai.config import ai_config
from app.ai.providers.chat_provider import chat_provider, OllamaChatProvider


class ChatOllamaAdapter(BaseChatModel):
    """LangChain BaseChatModel implementation backed strictly by local Ollama."""

    model_name: str = Field(default_factory=lambda: ai_config.llm_model)
    temperature: float = Field(default=0.2)
    max_tokens: int = Field(default=2000)

    @property
    def _llm_type(self) -> str:
        return "companyai_local_ollama"

    def _convert_messages(self, messages: List[BaseMessage]) -> List[dict[str, str]]:
        """Map LangChain BaseMessage objects into role/content dictionaries for Ollama."""
        formatted = []
        for m in messages:
            if isinstance(m, SystemMessage):
                role = "system"
            elif isinstance(m, HumanMessage):
                role = "user"
            elif isinstance(m, AIMessage):
                role = "assistant"
            elif isinstance(m, ToolMessage):
                role = "user"
            else:
                role = "user"
            formatted.append({"role": role, "content": str(m.content)})
        return formatted

    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        """Execute chat completion via centralized local OllamaChatProvider."""
        payload_messages = self._convert_messages(messages)
        temp = kwargs.get("temperature", self.temperature)
        tokens = kwargs.get("max_tokens", self.max_tokens)

        # Call centralized provider
        res = chat_provider.complete(
            messages=payload_messages,
            temperature=temp,
            max_tokens=tokens,
        )
        content = res.get("content", "")
        message = AIMessage(content=content)
        generation = ChatGeneration(message=message)
        return ChatResult(generations=[generation])


# Shared adapter instance
local_chat_llm = ChatOllamaAdapter()
