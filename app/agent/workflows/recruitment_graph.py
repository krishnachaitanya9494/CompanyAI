"""Single-Requisition Automated Recruitment Workflow Graph for CompanyAI.

Orchestrates end-to-end recruitment lifecycle from JD analysis through canonical candidate matching
and human recruiter approval using LangGraph and local Ollama.
"""

from typing import Any, Dict, Literal
from langgraph.graph import StateGraph, START, END

from app.agent.workflows.state import RecruitmentState
from app.agent.workflows.nodes.requisition_nodes import (
    load_requisition_node,
    validate_requisition_node,
    analyze_job_description_node,
    identify_recruitment_strategy_node,
)
from app.agent.workflows.nodes.sourcing_nodes import (
    generate_boolean_queries_node,
    recommend_target_companies_node,
    analyze_talent_supply_node,
)
from app.agent.workflows.nodes.candidate_nodes import (
    retrieve_internal_candidates_node,
    evaluate_candidate_matches_node,
    rank_candidate_results_node,
    generate_recruiter_explanation_node,
    prepare_shortlist_node,
)
from app.agent.workflows.nodes.governance_nodes import (
    request_recruiter_approval_node,
    finalize_workflow_node,
    handle_workflow_error_node,
)
from app.agent.workflows.checkpoint import get_sqlite_checkpointer


def route_after_validation(state: RecruitmentState) -> Literal["analyze_job_description", "handle_workflow_error"]:
    """Conditional edge: Route to JD analysis if valid, or error handler if requisition is invalid/closed."""
    if state.get("status") == "failed" or bool(state.get("errors")):
        return "handle_workflow_error"
    return "analyze_job_description"


def route_after_approval(state: RecruitmentState) -> Literal["finalize_workflow", "__end__"]:
    """Conditional edge: Finalize if approved/completed; pause at checkpointer if waiting for human action."""
    status = state.get("status")
    app_status = state.get("approval_status")
    if app_status == "approved" or status == "completed":
        return "finalize_workflow"
    # When awaiting recruiter action, pause execution gracefully
    return "__end__"


def build_recruitment_graph(checkpointer=None, with_interrupt: bool = False) -> Any:
    """Construct and compile the single-requisition recruitment StateGraph."""
    graph = StateGraph(RecruitmentState)

    # 1. Add all functional nodes
    graph.add_node("load_requisition", load_requisition_node)
    graph.add_node("validate_requisition", validate_requisition_node)
    graph.add_node("analyze_job_description", analyze_job_description_node)
    graph.add_node("identify_recruitment_strategy", identify_recruitment_strategy_node)
    graph.add_node("generate_boolean_queries", generate_boolean_queries_node)
    graph.add_node("recommend_target_companies", recommend_target_companies_node)
    graph.add_node("analyze_talent_supply", analyze_talent_supply_node)
    graph.add_node("retrieve_internal_candidates", retrieve_internal_candidates_node)
    graph.add_node("evaluate_candidate_matches", evaluate_candidate_matches_node)
    graph.add_node("rank_candidate_results", rank_candidate_results_node)
    graph.add_node("generate_recruiter_explanation", generate_recruiter_explanation_node)
    graph.add_node("prepare_shortlist", prepare_shortlist_node)
    graph.add_node("request_recruiter_approval", request_recruiter_approval_node)
    graph.add_node("finalize_workflow", finalize_workflow_node)
    graph.add_node("handle_workflow_error", handle_workflow_error_node)

    # 2. Add sequential and conditional edges
    graph.add_edge(START, "load_requisition")
    graph.add_edge("load_requisition", "validate_requisition")

    graph.add_conditional_edges(
        "validate_requisition",
        route_after_validation,
        {
            "analyze_job_description": "analyze_job_description",
            "handle_workflow_error": "handle_workflow_error",
        },
    )

    graph.add_edge("analyze_job_description", "identify_recruitment_strategy")
    graph.add_edge("identify_recruitment_strategy", "generate_boolean_queries")
    graph.add_edge("generate_boolean_queries", "recommend_target_companies")
    graph.add_edge("recommend_target_companies", "analyze_talent_supply")
    graph.add_edge("analyze_talent_supply", "retrieve_internal_candidates")
    graph.add_edge("retrieve_internal_candidates", "evaluate_candidate_matches")
    graph.add_edge("evaluate_candidate_matches", "rank_candidate_results")
    graph.add_edge("rank_candidate_results", "generate_recruiter_explanation")
    graph.add_edge("generate_recruiter_explanation", "prepare_shortlist")
    graph.add_edge("prepare_shortlist", "request_recruiter_approval")

    graph.add_conditional_edges(
        "request_recruiter_approval",
        route_after_approval,
        {
            "finalize_workflow": "finalize_workflow",
            "__end__": END,
        },
    )

    graph.add_edge("finalize_workflow", END)
    graph.add_edge("handle_workflow_error", END)

    # Compile with optional checkpointer and interrupt configuration
    compile_kwargs = {}
    if checkpointer is not None:
        compile_kwargs["checkpointer"] = checkpointer
    if with_interrupt:
        compile_kwargs["interrupt_before"] = ["finalize_workflow"]

    return graph.compile(**compile_kwargs)


# Shared workflow executor helper
def execute_requisition_workflow(job_id: int, with_checkpoint: bool = True) -> Dict[str, Any]:
    """Execute the recruitment graph for a single requisition and return final state."""
    checkpointer = get_sqlite_checkpointer() if with_checkpoint else None
    compiled_graph = build_recruitment_graph(checkpointer=checkpointer)

    initial_state: RecruitmentState = {
        "job_id": job_id,
        "workflow_id": f"wf-job-{job_id}",
        "thread_id": f"thread-job-{job_id}",
        "errors": [],
        "warnings": [],
        "status": "pending",
        "current_stage": "initialized",
    }

    config = {"configurable": {"thread_id": f"thread-job-{job_id}"}}
    result_state = compiled_graph.invoke(initial_state, config=config)
    return result_state
