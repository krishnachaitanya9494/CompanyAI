import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.agent.workflows.recruitment_graph import build_recruitment_graph
from app.agent.workflows.state import RecruitmentState
from app.agent.workflows.checkpoint import get_sqlite_checkpointer

def test_workflow():
    print("Testing LangGraph recruitment workflow node-by-node...")
    checkpointer = get_sqlite_checkpointer()
    compiled_graph = build_recruitment_graph(checkpointer=checkpointer)

    initial_state = {
        "job_id": 42,
        "workflow_id": "wf-job-42",
        "thread_id": "thread-job-42",
        "errors": [],
        "warnings": [],
        "status": "pending",
        "current_stage": "initialized",
    }
    config = {"configurable": {"thread_id": "thread-job-42"}}

    for event in compiled_graph.stream(initial_state, config=config):
        for node_name, node_output in event.items():
            print(f"-> Node completed: {node_name} | Stage: {node_output.get('current_stage')} | Status: {node_output.get('status')}")
            if node_name == "load_requisition":
                print(f"   Job Title: {node_output.get('job_title')}")
            elif node_name == "recommend_target_companies":
                print(f"   Target Companies: {len(node_output.get('target_companies', []))} companies")
            elif node_name == "evaluate_candidate_matches":
                print(f"   Matches: {len(node_output.get('match_results', []))} evaluated candidates")
            elif node_name == "generate_recruiter_explanation":
                print(f"   Executive Summary generated ({len(node_output.get('executive_summary', ''))} chars)")
            elif node_name == "request_recruiter_approval":
                print(f"   Approval Request ID: {node_output.get('approval_request_id')}")

if __name__ == "__main__":
    test_workflow()
