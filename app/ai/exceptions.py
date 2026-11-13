"""Standardized AI exceptions hierarchy for CompanyAI platform."""


class AIPlatformError(Exception):
    """Base exception for all CompanyAI AI platform errors."""
    pass


class AIProviderError(AIPlatformError):
    """Raised when an external AI provider fails or is unreachable."""
    pass


class AIRateLimitError(AIProviderError):
    """Raised when AI provider rate limits (HTTP 429) are encountered."""
    pass


class AIAuthenticationError(AIProviderError):
    """Raised when AI provider credentials or API keys are rejected (HTTP 401)."""
    pass


class AIEmbeddingError(AIPlatformError):
    """Raised when embedding generation, formatting, or dimensionality validation fails."""
    pass


class AIGenerationError(AIPlatformError):
    """Raised when text generation, chat completion, or schema extraction fails."""
    pass
