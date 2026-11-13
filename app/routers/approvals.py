# Import APIRouter, Depends, HTTPException, Query, Header, status from FastAPI.
from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
# Import Session from SQLAlchemy.
from sqlalchemy.orm import Session
# Import typing helpers.
from typing import Any, Optional
# Import Pydantic models for strict payload validation.
from pydantic import BaseModel, Field
# Import SQLite database session dependency.
from database.sqlite_connection import get_db
# Import SQLAlchemy models for execution and audit logging.
from database.models import (
    ApprovalRequest,
    Candidate,
    Job,
    JDSegmentation,
    RecruitmentRequest,
    ActivityEvent,
)
# Import UTC timestamp helper.
from datetime import datetime, timezone

# Create router for human-in-the-loop approvals.
router = APIRouter(prefix="/api/approvals", tags=["Approvals"])

# Roles authorized to resolve sensitive hiring, offer, requisition, and segmentation approvals.
AUTHORIZED_REVIEWER_ROLES = {"Recruiter Admin", "Hiring Manager", "Lead Recruiter", "Talent Lead"}


# Schema for proposing a sensitive action.
class ProposeActionSchema(BaseModel):
    # Action type identifier covering hiring stages, offers, shortlists, requisitions, and JD approvals.
    action_type: str = Field(..., description="Operation type (e.g. shortlist_candidate, update_candidate_stage, offer_candidate, reject_candidate, submit_candidate_to_client, approve_requisition, approve_jd_segmentation)")
    # Clear explanation of what is requested and why human approval is needed.
    description: str = Field(..., min_length=3, description="Human-readable description of the operation")
    # Structured payload carrying entity IDs, target stages, comments, and workflow context.
    payload: dict[str, Any] = Field(default_factory=dict, description="Parameters to execute upon approval")
    # Submitter identity.
    requester: str = Field(default="Nemotron AI Agent", description="Initiator of the action")


# Schema for approving, rejecting, or requesting changes on a queued approval.
class ResolveApprovalSchema(BaseModel):
    # Authorized reviewer identity resolving the request.
    approver: str = Field(default="Recruiter Admin", description="Name of the authorized reviewer resolving the action")
    # Optional role label used with header verification for permission enforcement.
    reviewer_role: str = Field(default="Recruiter Admin", description="Role of the reviewer (Recruiter Admin, Lead Recruiter, Hiring Manager, Viewer)")
    # Optional reviewer comments recorded in the audit decision trail.
    comment: Optional[str] = Field(default=None, description="Reviewer decision rationale or change instructions")


def _enrich_approval_record(a: ApprovalRequest, db: Session) -> dict[str, Any]:
    """Serialize ApprovalRequest along with grounded candidate, job, or requisition context."""
    payload = dict(a.payload or {})
    related_context: dict[str, Any] = {}

    # Load linked candidate summary if candidate_id exists in payload.
    cand_id = payload.get("candidate_id")
    if cand_id:
        cand = db.query(Candidate).filter(Candidate.id == cand_id).first()
        if cand:
            related_context["candidate"] = {
                "id": cand.id,
                "name": cand.name,
                "stage": cand.stage,
                "location": cand.location,
                "experience_years": cand.experience_years,
            }

    # Load linked job summary if job_id exists in payload.
    job_id = payload.get("job_id")
    if job_id:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            related_context["job"] = {
                "id": job.id,
                "title": job.title,
                "job_code": job.job_code,
                "status": job.status,
                "client_name": job.client_name,
            }

    # Load linked recruitment request summary if request_id exists in payload.
    req_id = payload.get("request_id")
    if req_id:
        req = db.query(RecruitmentRequest).filter(RecruitmentRequest.id == req_id).first()
        if req:
            related_context["request"] = {
                "id": req.id,
                "req_number": req.req_number,
                "role_title": req.role_title,
                "priority": req.priority,
                "status": req.status,
            }

    # Explain clearly why this operation triggers a governance gate.
    why_required_map = {
        "offer_candidate": "Extending a formal compensation offer commits company headcount and requires executive approval.",
        "reject_candidate": "Archiving or rejecting an applicant terminates candidate consideration and requires audit confirmation.",
        "shortlist_candidate": "Formal client shortlisting advances candidate into client review.",
        "submit_candidate_to_client": "Submitting candidate profile externally shares PII and requires recruiter lead sign-off.",
        "approve_requisition": "Activating a hiring requisition allocates budget and headcount SLA targets.",
        "approve_jd_segmentation": "Approving JD segmentation locks mandatory hiring criteria used in scoring and embeddings.",
        "update_candidate_stage": "Stage transitions into gated selection rounds require verified audit sign-off.",
    }

    return {
        "id": a.id,
        "actionType": a.action_type,
        "description": a.description,
        "whyRequired": why_required_map.get(a.action_type, "Controlled enterprise recruitment state transition."),
        "payload": payload,
        "relatedContext": related_context,
        "assignedReviewer": payload.get("assigned_reviewer") or "Lead Recruiter / Recruiter Admin",
        "requester": a.requester,
        "status": a.status,
        "executionResult": a.execution_result,
        "reviewerComment": payload.get("reviewer_comment"),
        "createdAt": a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else "",
        "createdAtDisplay": a.created_at.strftime("%I:%M %p, %b %d") if a.created_at else "Recent",
        "resolvedAt": a.resolved_at.strftime("%Y-%m-%d %H:%M") if a.resolved_at else None,
        "resolvedBy": a.resolved_by,
    }


def _authorize_reviewer(approval: ApprovalRequest, payload: ResolveApprovalSchema, header_role: Optional[str]) -> None:
    """Enforce reviewer identity and prohibit unauthorized self-approval."""
    reviewer_name = (payload.approver or "").strip()
    if not reviewer_name:
        raise HTTPException(status_code=400, detail="Approver identity is required.")

    effective_role = (header_role or payload.reviewer_role or "Recruiter Admin").strip()
    # Reject explicitly unprivileged roles such as ReadOnly or Viewer.
    if effective_role not in AUTHORIZED_REVIEWER_ROLES:
        raise HTTPException(
            status_code=403,
            detail=f"Permission denied: role '{effective_role}' is not authorized to resolve approvals.",
        )

    # Prevent submitters from approving or resolving their own requests.
    if reviewer_name.casefold() == (approval.requester or "").strip().casefold():
        raise HTTPException(
            status_code=403,
            detail="Self-approval is prohibited: a different authorized reviewer must review this request.",
        )


@router.get("/pending")
def list_pending_approvals(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """Retrieve all operations awaiting human confirmation or changes."""
    approvals = (
        db.query(ApprovalRequest)
        .filter(ApprovalRequest.status.in_(["pending", "changes_requested"]))
        .order_by(ApprovalRequest.created_at.desc())
        .all()
    )
    return [_enrich_approval_record(a, db) for a in approvals]


@router.get("/all")
def list_all_approvals(
    status_filter: Optional[str] = Query(default=None, alias="status", description="Filter by status (pending, approved, rejected, changes_requested)"),
    action_type: Optional[str] = Query(default=None, description="Filter by action type"),
    requester: Optional[str] = Query(default=None, description="Filter by requester substring"),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Retrieve complete approval audit log with optional status, type, and submitter filters."""
    query = db.query(ApprovalRequest)
    if status_filter and status_filter.lower() != "all":
        query = query.filter(ApprovalRequest.status == status_filter.lower())
    if action_type and action_type.lower() != "all":
        query = query.filter(ApprovalRequest.action_type == action_type)
    if requester and requester.strip():
        query = query.filter(ApprovalRequest.requester.ilike(f"%{requester.strip()}%"))

    approvals = query.order_by(ApprovalRequest.created_at.desc()).all()
    return [_enrich_approval_record(a, db) for a in approvals]


@router.get("/{approval_id}")
def get_approval_detail(approval_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Retrieve detailed approval record with live related candidate, job, or requisition context."""
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found.")
    return _enrich_approval_record(approval, db)


@router.post("", status_code=status.HTTP_201_CREATED)
def propose_action(
    payload: ProposeActionSchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Submit a sensitive operation to the human approval queue and record audit activity."""
    approval = ApprovalRequest(
        action_type=payload.action_type,
        description=payload.description,
        payload=payload.payload,
        requester=payload.requester,
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(approval)
    db.flush()

    # Log approval submission into activity audit timeline.
    db.add(ActivityEvent(
        event_type="approval_proposed",
        summary=f"Approval #{approval.id} submitted by {payload.requester}: {payload.description[:160]}",
        entity_type="approval",
        entity_id=str(approval.id),
        created_at=datetime.now(timezone.utc),
    ))
    db.commit()
    db.refresh(approval)

    return {
        "status": "pending_approval",
        "message": "Operation queued for human confirmation.",
        "approval_id": approval.id,
        "description": approval.description,
        "approval": _enrich_approval_record(approval, db),
    }


@router.post("/{approval_id}/approve")
def approve_action(
    approval_id: int,
    payload: ResolveApprovalSchema,
    x_recruiter_role: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Authorize, confirm, and execute a queued sensitive action."""
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found.")
    if approval.status not in ("pending", "changes_requested"):
        raise HTTPException(status_code=400, detail=f"Approval request is already {approval.status}.")

    # Verify authorization and prohibit self-approval.
    _authorize_reviewer(approval, payload, x_recruiter_role)

    execution_msg = "Action approved and executed successfully."
    req_payload = dict(approval.payload or {})

    # Execute verified backend mutation matching approved action_type.
    if approval.action_type in ("update_candidate_stage", "shortlist_candidate", "submit_candidate_to_client"):
        cand_id = req_payload.get("candidate_id")
        new_stage = req_payload.get("new_stage") or ("Shortlisted" if approval.action_type == "shortlist_candidate" else None)
        candidate = db.query(Candidate).filter(Candidate.id == cand_id).first()
        if candidate and new_stage:
            candidate.stage = new_stage
            execution_msg = f"Candidate {candidate.name} stage updated to {new_stage}."
        elif candidate and approval.action_type == "submit_candidate_to_client":
            execution_msg = f"Approved client submission of {candidate.name} ({req_payload.get('client_name', 'Client Account')})."
        if candidate:
            db.add(ActivityEvent(
                event_type="approval_executed",
                summary=f"Approved #{approval.id}: {execution_msg}",
                entity_type="candidate",
                entity_id=str(candidate.id),
                created_at=datetime.now(timezone.utc),
            ))

    elif approval.action_type == "offer_candidate":
        cand_id = req_payload.get("candidate_id")
        target_stage = req_payload.get("new_stage") or "Offer Extended"
        candidate = db.query(Candidate).filter(Candidate.id == cand_id).first()
        if candidate:
            candidate.stage = target_stage
            execution_msg = f"Formal offer approved and candidate {candidate.name} moved to {target_stage}."
            db.add(ActivityEvent(
                event_type="offer_approved",
                summary=execution_msg,
                entity_type="candidate",
                entity_id=str(candidate.id),
                created_at=datetime.now(timezone.utc),
            ))

    elif approval.action_type == "reject_candidate":
        cand_id = req_payload.get("candidate_id")
        candidate = db.query(Candidate).filter(Candidate.id == cand_id).first()
        if candidate:
            candidate.stage = "Rejected"
            execution_msg = f"Candidate {candidate.name} moved to Rejected."
            db.add(ActivityEvent(
                event_type="approval_executed",
                summary=f"Approved #{approval.id}: {execution_msg}",
                entity_type="candidate",
                entity_id=str(candidate.id),
                created_at=datetime.now(timezone.utc),
            ))

    elif approval.action_type == "approve_requisition":
        req_id = req_payload.get("request_id")
        new_req_status = req_payload.get("new_status") or "in_progress"
        req_obj = db.query(RecruitmentRequest).filter(RecruitmentRequest.id == req_id).first()
        if req_obj:
            req_obj.status = new_req_status
            execution_msg = f"Requisition {req_obj.req_number} approved and updated to '{new_req_status}'."
            db.add(ActivityEvent(
                event_type="approval_executed",
                summary=f"Approved #{approval.id}: {execution_msg}",
                entity_type="recruitment_request",
                entity_id=str(req_obj.id),
                created_at=datetime.now(timezone.utc),
            ))

    elif approval.action_type == "approve_jd_segmentation":
        job_id = req_payload.get("job_id")
        seg = (
            db.query(JDSegmentation)
            .filter(JDSegmentation.job_id == job_id)
            .order_by(JDSegmentation.version.desc())
            .first()
        )
        if seg:
            seg.status = "approved"
            seg.is_approved = 1
            seg.approved_by = payload.approver
            seg.approved_at = datetime.now(timezone.utc)
            execution_msg = f"JD Segmentation v{seg.version} for Job #{job_id} approved."
            db.add(ActivityEvent(
                event_type="segmentation_approved",
                summary=f"Approved #{approval.id}: {execution_msg}",
                entity_type="job",
                entity_id=str(job_id),
                created_at=datetime.now(timezone.utc),
            ))

    # Persist reviewer comment alongside execution metadata.
    if payload.comment:
        req_payload["reviewer_comment"] = payload.comment.strip()
        approval.payload = req_payload
        execution_msg = f"{execution_msg} Note: {payload.comment.strip()}"

    approval.status = "approved"
    approval.resolved_at = datetime.now(timezone.utc)
    approval.resolved_by = payload.approver
    approval.execution_result = execution_msg

    db.commit()

    return {
        "status": "approved",
        "message": execution_msg,
        "approval_id": approval.id,
        "approval": _enrich_approval_record(approval, db),
    }


@router.post("/{approval_id}/reject")
def reject_action(
    approval_id: int,
    payload: ResolveApprovalSchema,
    x_recruiter_role: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Reject and cancel a queued sensitive action with reviewer comment logging."""
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found.")
    if approval.status not in ("pending", "changes_requested"):
        raise HTTPException(status_code=400, detail=f"Approval request is already {approval.status}.")

    _authorize_reviewer(approval, payload, x_recruiter_role)

    req_payload = dict(approval.payload or {})
    if payload.comment:
        req_payload["reviewer_comment"] = payload.comment.strip()
        approval.payload = req_payload

    note = f" Reason: {payload.comment.strip()}" if payload.comment else ""
    approval.status = "rejected"
    approval.resolved_at = datetime.now(timezone.utc)
    approval.resolved_by = payload.approver
    approval.execution_result = f"Rejected by {payload.approver}.{note}"

    db.add(ActivityEvent(
        event_type="approval_rejected",
        summary=f"Approval #{approval.id} rejected by {payload.approver}.{note}",
        entity_type="approval",
        entity_id=str(approval.id),
        created_at=datetime.now(timezone.utc),
    ))
    db.commit()

    return {
        "status": "rejected",
        "message": "Operation rejected and cancelled.",
        "approval_id": approval.id,
        "approval": _enrich_approval_record(approval, db),
    }


@router.post("/{approval_id}/request-changes")
def request_changes_action(
    approval_id: int,
    payload: ResolveApprovalSchema,
    x_recruiter_role: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return a pending approval to submitter for revision with explicit feedback."""
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found.")
    if approval.status != "pending":
        raise HTTPException(status_code=400, detail=f"Only pending approvals can request changes (current: {approval.status}).")

    _authorize_reviewer(approval, payload, x_recruiter_role)

    req_payload = dict(approval.payload or {})
    comment_text = (payload.comment or "Additional justification or interview feedback requested.").strip()
    req_payload["reviewer_comment"] = comment_text
    approval.payload = req_payload
    approval.status = "changes_requested"
    approval.resolved_by = payload.approver
    approval.resolved_at = datetime.now(timezone.utc)
    approval.execution_result = f"Changes requested by {payload.approver}: {comment_text}"

    db.add(ActivityEvent(
        event_type="approval_changes_requested",
        summary=f"Changes requested on Approval #{approval.id} by {payload.approver}: {comment_text[:120]}",
        entity_type="approval",
        entity_id=str(approval.id),
        created_at=datetime.now(timezone.utc),
    ))
    db.commit()

    return {
        "status": "changes_requested",
        "message": f"Changes requested on Approval #{approval.id}.",
        "approval_id": approval.id,
        "approval": _enrich_approval_record(approval, db),
    }
