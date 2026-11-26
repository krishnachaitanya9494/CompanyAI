import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

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
)

state = {
    "job_id": 42,
    "workflow_id": "wf-job-42",
    "thread_id": "thread-job-42",
    "errors": [],
    "warnings": [],
    "status": "pending",
    "current_stage": "initialized",
}

print("1. load_requisition_node...", flush=True)
state.update(load_requisition_node(state))
print(f"   Job Title: {state.get('job_title')}", flush=True)

print("2. validate_requisition_node...", flush=True)
state.update(validate_requisition_node(state))
print(f"   Valid: {state.get('status')}", flush=True)

print("3. analyze_job_description_node...", flush=True)
state.update(analyze_job_description_node(state))
print(f"   Domain: {state.get('domain_label')}", flush=True)

print("4. identify_recruitment_strategy_node...", flush=True)
state.update(identify_recruitment_strategy_node(state))
print(f"   Strategy: {state.get('sourcing_strategy')}", flush=True)

print("5. generate_boolean_queries_node...", flush=True)
state.update(generate_boolean_queries_node(state))
print(f"   Boolean queries generated: {len(state.get('boolean_queries', {}))}", flush=True)

print("6. recommend_target_companies_node...", flush=True)
state.update(recommend_target_companies_node(state))
print(f"   Target companies: {len(state.get('target_companies', []))}", flush=True)

print("7. analyze_talent_supply_node...", flush=True)
state.update(analyze_talent_supply_node(state))
print(f"   Hiring difficulty: {state.get('hiring_difficulty_tier')}", flush=True)

print("8. retrieve_internal_candidates_node...", flush=True)
state.update(retrieve_internal_candidates_node(state))
print(f"   Candidates: {len(state.get('retrieved_candidate_ids', []))}", flush=True)

print("9. evaluate_candidate_matches_node...", flush=True)
state.update(evaluate_candidate_matches_node(state))
print(f"   Matches: {len(state.get('match_results', []))}", flush=True)

print("10. rank_candidate_results_node...", flush=True)
state.update(rank_candidate_results_node(state))
print(f"   Ranked: {len(state.get('ranked_shortlist', []))}", flush=True)

print("11. generate_recruiter_explanation_node...", flush=True)
state.update(generate_recruiter_explanation_node(state))
print(f"   Summary: {state.get('executive_summary')[:100]}...", flush=True)

print("12. prepare_shortlist_node...", flush=True)
state.update(prepare_shortlist_node(state))
print(f"   Shortlist ready: {len(state.get('shortlist_details', []))}", flush=True)

print("13. request_recruiter_approval_node...", flush=True)
state.update(request_recruiter_approval_node(state))
print(f"   Approval Request ID: {state.get('approval_request_id')}", flush=True)

print("ALL 13 NODES PASSED CLEANLY!", flush=True)
