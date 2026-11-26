"""Centralized State Schemas for CompanyAI LangGraph Workflows.

Defines typed states for single-requisition sourcing, multi-requisition batches,
and multi-turn conversational recruiter dialogues.
"""

from typing import Any, Dict, List, Optional, TypedDict


class RecruitmentState(TypedDict, total=False):
    """Central state for an end-to-end recruitment workflow on a single requisition."""

    # Workflow Identifiers & Provenance
    workflow_id: str
    thread_id: str
    conversation_id: Optional[str]
    recruiter_id: Optional[str]

    # Requisition Context (grounded in SQLite Job record)
    job_id: int
    job_title: str
    job_description: str
    department: Optional[str]
    location: Optional[str]
    min_experience_years: Optional[float]
    openings_count: int
    requisition_status: str

    # Structured JD Intelligence
    domain_id: str
    domain_label: str
    mandatory_skills: List[str]
    preferred_skills: List[str]
    domain_terms: List[str]

    # Sourcing Intelligence
    ecosystem_name: str
    sourcing_strategy: str
    strategy_rationale: str
    target_companies: List[Dict[str, Any]]
    boolean_queries: Dict[str, Any]

    # Market Supply & Internal Talent Insights
    talent_supply: Dict[str, Any]
    hiring_difficulty_score: int
    hiring_difficulty_tier: str
    supply_bottleneck: str

    # Candidate Retrieval & Canonical Matching
    retrieved_candidate_ids: List[int]
    match_results: List[Dict[str, Any]]
    ranked_shortlist: List[Dict[str, Any]]

    # Recruiter Synthesis & Explanations
    executive_summary: str
    recommendation_notes: str

    # Workflow Governance & Human Approval
    current_stage: str
    status: str  # "pending" | "running" | "awaiting_approval" | "completed" | "failed"
    approval_status: str  # "not_requested" | "pending" | "approved" | "rejected"
    approval_request_id: Optional[int]
    approval_comment: Optional[str]

    # Observability & Errors
    errors: List[str]
    warnings: List[str]
    created_at: str
    updated_at: str


class MultiRequisitionState(TypedDict, total=False):
    """Parent batch state coordinating workflows across all open requisitions."""

    batch_workflow_id: str
    thread_id: str
    target_job_ids: List[int]

    # Requisition-level results (isolated per job)
    processed_requisitions: List[Dict[str, Any]]

    # Aggregated Metrics
    total_requisitions: int
    successful_count: int
    failed_count: int
    skipped_count: int

    # Executive Roll-Up
    status: str  # "pending" | "running" | "completed" | "failed" | "cancelled"
    overall_summary: str
    errors: List[Dict[str, Any]]

    created_at: str
    completed_at: Optional[str]


class ConversationState(TypedDict, total=False):
    """State for multi-turn conversational recruiter interactions."""

    session_id: str
    thread_id: str
    user_query: str
    intent: Optional[str]

    # Contextual entity bindings
    active_job_id: Optional[int]
    active_candidate_id: Optional[int]

    # Conversational messages log
    messages: List[Dict[str, str]]

    # Sourcing & Candidate Evidence
    candidates: List[Dict[str, Any]]
    tools_called: List[Dict[str, Any]]
    follow_up_suggestions: List[str]

    # Output Response
    response_text: str
    trace_id: str
    latency_ms: int


class TargetCompanyState(TypedDict, total=False):
    """Typed LangGraph state for the Intelligent Target Company Sourcing workflow.

    Isolated per requisition thread (`target-company-job-{job_id}`) to prevent
    cross-requisition state contamination.
    """

    # Workflow & Thread Provenance
    workflow_id: str
    thread_id: str
    job_id: int

    # Requisition & JD Context (Node 1: Load Requisition)
    job_title: str
    job_description: str
    location: Optional[str]
    department: Optional[str]
    min_experience_years: Optional[float]
    max_experience_years: Optional[float]

    # Caller / Recruiter Overrides
    selected_strategy: Optional[str]
    custom_companies: List[Dict[str, Any]]
    excluded_companies: List[str]
    off_limits_companies: List[str]

    # JD Analysis (Node 2: Analyze Job Description)
    extracted_requirements: Dict[str, Any]
    primary_domain: str
    secondary_domains: List[str]
    classification_evidence: List[str]
    classification_confidence: float

    # Ecosystem Selection (Node 3: Select Corporate Sourcing Ecosystem)
    selected_ecosystem: Dict[str, Any]

    # Catalog & Relevance Evaluation (Nodes 4 & 5)
    company_candidates: List[Dict[str, Any]]
    company_relevance_scores: Dict[str, Dict[str, Any]]

    # Tier Classification (Node 6)
    tier_classifications: Dict[str, List[str]]

    # Sourcing Strategy & Grounded Explanations (Node 7)
    sourcing_strategy: str
    strategy_rationale: str
    allow_llm: bool
    ollama_used: bool
    ollama_status: str

    # Validation & Final Output (Nodes 8 & 9)
    validation_results: Dict[str, Any]
    final_result: Dict[str, Any]

    # Execution Status & Fault Tolerance
    status: str  # "pending" | "running" | "completed" | "failed"
    errors: List[str]
    warnings: List[str]
    retry_count: int
    created_at: str
    updated_at: str
