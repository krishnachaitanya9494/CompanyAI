# Import APIRouter, Depends, HTTPException, Query, status from FastAPI.
from fastapi import APIRouter, Depends, HTTPException, Query, status
# Import Session from SQLAlchemy.
from sqlalchemy.orm import Session
# Import typing helpers.
from typing import Any, Optional
# Import Pydantic models.
from pydantic import BaseModel, Field
# Import database session dependency.
from database.sqlite_connection import get_db
# Import database models.
from database.models import ApprovalRequest, Candidate, RecruitmentRequest, ActivityEvent
# Import datetime.
from datetime import datetime, timezone

# Create router for human-in-the-loop approvals.
router = APIRouter(prefix="/api/approvals", tags=["Approvals"])


# Schema for proposing a sensitive action.
class ProposeActionSchema(BaseModel):
    action_type: str = Field(..., description="Action type, e.g. update_candidate_stage, offer_candidate, reject_candidate, create_requisition")
    description: str = Field(..., description="Human-readable description of the operation")
    payload: dict[str, Any] = Field(default_factory=dict, description="Parameters to execute upon approval")
    requester: str = Field(default="Nemotron AI Agent", description="Initiator of the action")


# Schema for approving or rejecting.
class ResolveApprovalSchema(BaseModel):
    approver: str = Field(default="Recruiter Admin", description="Name of the person resolving the action")


@router.get("/pending")
def list_pending_approvals(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """Retrieve all operations awaiting human approval before execution."""
    approvals = db.query(ApprovalRequest).filter(ApprovalRequest.status == "pending").order_by(ApprovalRequest.created_at.desc()).all()
    results = []
    for a in approvals:
        results.append({
            "id": a.id,
            "actionType": a.action_type,
            "description": a.description,
            "payload": a.payload,
            "requester": a.requester,
            "status": a.status,
            "createdAt": a.created_at.strftime("%I:%M %p, %b %d") if a.created_at else "Recent",
        })
    return results


@router.get("/all")
def list_all_approvals(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """Retrieve full audit log of approved, rejected, and pending actions."""
    approvals = db.query(ApprovalRequest).order_by(ApprovalRequest.created_at.desc()).all()
    results = []
    for a in approvals:
        results.append({
            "id": a.id,
            "actionType": a.action_type,
            "description": a.description,
            "payload": a.payload,
            "requester": a.requester,
            "status": a.status,
            "executionResult": a.execution_result,
            "createdAt": a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else "",
            "resolvedAt": a.resolved_at.strftime("%Y-%m-%d %H:%M") if a.resolved_at else None,
            "resolvedBy": a.resolved_by,
        })
    return results


@router.post("", status_code=status.HTTP_201_CREATED)
def propose_action(
    payload: ProposeActionSchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Submit a sensitive operation to the approval queue."""
    approval = ApprovalRequest(
        action_type=payload.action_type,
        description=payload.description,
        payload=payload.payload,
        requester=payload.requester,
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(approval)
    db.commit()
    db.refresh(approval)

    return {
        "status": "pending_approval",
        "message": "Operation queued for human confirmation.",
        "approval_id": approval.id,
        "description": approval.description,
    }


@router.post("/{approval_id}/approve")
def approve_action(
    approval_id: int,
    payload: ResolveApprovalSchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Confirm and execute a queued sensitive action."""
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found.")
    if approval.status != "pending":
        raise HTTPException(status_code=400, detail=f"Approval request is already {approval.status}.")

    execution_msg = "Action executed successfully."

    # Execute backend mutation based on action_type.
    if approval.action_type == "update_candidate_stage":
        cand_id = approval.payload.get("candidate_id")
        new_stage = approval.payload.get("new_stage")
        candidate = db.query(Candidate).filter(Candidate.id == cand_id).first()
        if candidate:
            candidate.stage = new_stage
            execution_msg = f"Candidate {candidate.name} stage updated to {new_stage}."
            db.add(ActivityEvent(
                event_type="approval_executed",
                summary=f"Approved action: {execution_msg}",
                entity_type="candidate",
                entity_id=str(candidate.id),
                created_at=datetime.now(timezone.utc),
            ))

    elif approval.action_type == "offer_candidate":
        cand_id = approval.payload.get("candidate_id")
        candidate = db.query(Candidate).filter(Candidate.id == cand_id).first()
        if candidate:
            candidate.stage = "Offer Extended"
            execution_msg = f"Formal offer approved and extended to {candidate.name}."
            db.add(ActivityEvent(
                event_type="offer_approved",
                summary=execution_msg,
                entity_type="candidate",
                entity_id=str(candidate.id),
                created_at=datetime.now(timezone.utc),
            ))

    elif approval.action_type == "reject_candidate":
        cand_id = approval.payload.get("candidate_id")
        candidate = db.query(Candidate).filter(Candidate.id == cand_id).first()
        if candidate:
            candidate.stage = "Rejected"
            execution_msg = f"Candidate {candidate.name} archived/rejected."

    # Mark approval resolved.
    approval.status = "approved"
    approval.resolved_at = datetime.now(timezone.utc)
    approval.resolved_by = payload.approver
    approval.execution_result = execution_msg

    db.commit()

    return {
        "status": "approved",
        "message": execution_msg,
        "approval_id": approval.id,
    }


@router.post("/{approval_id}/reject")
def reject_action(
    approval_id: int,
    payload: ResolveApprovalSchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Reject and cancel a queued sensitive action."""
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found.")
    if approval.status != "pending":
        raise HTTPException(status_code=400, detail=f"Approval request is already {approval.status}.")

    approval.status = "rejected"
    approval.resolved_at = datetime.now(timezone.utc)
    approval.resolved_by = payload.approver
    approval.execution_result = "Rejected by recruiter."

    db.commit()

    return {
        "status": "rejected",
        "message": "Operation rejected and cancelled.",
        "approval_id": approval.id,
    }
