"""CompanyAI LangGraph Workflow Orchestration Package.

Provides stateful, explainable recruitment workflows and conversational agent graphs
powered by local Ollama and authoritative CompanyAI recruitment services.
"""

from app.agent.workflows.state import RecruitmentState, MultiRequisitionState, ConversationState

__all__ = [
    "RecruitmentState",
    "MultiRequisitionState",
    "ConversationState",
]
