"""Governance, approval checkpoint, and workflow termination nodes."""

from datetime import datetime, timezone
from typing import Any, Dict
import logging

from database.sqlite_connection import get_db
from database.models import ApprovalRequest, Job
from app.agent.workflows.state import RecruitmentState

logger = logging.getLogger("companyai.workflows.governance")


def request_recruiter_approval_node(state: RecruitmentState) -> Dict[str, Any]:
    """Node 13: Create or check human-in-the-loop recruiter review request for shortlisted candidates."""
    job_id = state.get("job_id")
    title = state.get("job_title", f"Job #{job_id}")
    shortlist = state.get("ranked_shortlist", [])

    if not shortlist:
        return {
            "approval_status": "not_requested",
            "current_stage": "finalize_workflow",
            "status": "completed",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    # If already approved by human action, proceed to finalize
    if state.get("approval_status") == "approved":
        return {
            "current_stage": "finalize_workflow",
            "status": "running",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    # Record or link to an official ApprovalRequest in SQLite
    db = next(get_db())
    try:
        cand_names = [f"{c['name']} ({c['match_score']}%)" for c in shortlist[:3]]
        desc = f"Recruiter Shortlist Review for {title}: Top candidates [{', '.join(cand_names)}]."

        # Check if an approval already exists for this job
        existing = (
            db.query(ApprovalRequest)
            .filter(
                ApprovalRequest.operation_type == "shortlist_review",
                ApprovalRequest.description.contains(title),
                ApprovalRequest.status == "pending",
            )
            .first()
        )

        if existing:
            app_id = existing.id
        else:
            new_app = ApprovalRequest(
                operation_type="shortlist_review",
                description=desc,
                proposed_payload={
                    "job_id": job_id,
                    "workflow_id": state.get("workflow_id"),
                    "shortlist_count": len(shortlist),
                    "top_candidates": shortlist[:5],
                },
                status="pending",
                requester="CompanyAI LangGraph Agent",
            )
            db.add(new_app)
            db.commit()
            db.refresh(new_app)
            app_id = new_app.id

        return {
            "approval_request_id": app_id,
            "approval_status": "pending",
            "current_stage": "awaiting_recruiter_approval",
            "status": "awaiting_approval",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        logger.warning(f"Could not persist approval request to SQLite: {exc}")
        return {
            "approval_status": "pending",
            "current_stage": "awaiting_recruiter_approval",
            "status": "awaiting_approval",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()


def finalize_workflow_node(state: RecruitmentState) -> Dict[str, Any]:
    """Node 14: Finalize the recruitment workflow and mark as successfully completed."""
    return {
        "status": "completed",
        "current_stage": "completed",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def handle_workflow_error_node(state: RecruitmentState) -> Dict[str, Any]:
    """Node 15: Handle workflow errors gracefully without crashing or fabricating outputs."""
    errors = state.get("errors", [])
    if not errors:
        errors = ["Workflow encountered an unspecified error."]

    return {
        "status": "failed",
        "current_stage": "failed",
        "errors": errors,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
