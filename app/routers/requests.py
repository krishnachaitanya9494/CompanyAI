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
from database.models import RecruitmentRequest, ActivityEvent
# Import datetime.
from datetime import datetime, timezone, date

# Create router for recruitment requests.
router = APIRouter(prefix="/api/requests", tags=["Requests"])


# Schema for creating a new recruitment request.
class RequestCreateSchema(BaseModel):
    role_title: str = Field(..., description="Role title to recruit")
    department: str = Field(default="Engineering", description="Hiring department")
    hiring_manager: str = Field(default="Hiring Manager", description="Hiring manager name")
    assigned_recruiter: str = Field(default="Ananya Sharma", description="Assigned recruiter")
    priority: str = Field(default="Medium", description="Urgent, High, Medium, or Low")
    status: str = Field(default="Open", description="Open, In Progress, Fulfilled, On Hold")
    target_positions: int = Field(default=1, description="Total target openings")
    location: Optional[str] = Field(default="Bangalore / Remote", description="Location")
    notes: Optional[str] = Field(default="", description="Recruiter notes")


# Schema for updating a request.
class RequestUpdateSchema(BaseModel):
    priority: Optional[str] = Field(default=None, description="Urgent, High, Medium, Low")
    status: Optional[str] = Field(default=None, description="Open, In Progress, Fulfilled, On Hold")
    assigned_recruiter: Optional[str] = Field(default=None, description="Assigned recruiter")
    notes: Optional[str] = Field(default=None, description="Notes")
    filled_positions: Optional[int] = Field(default=None, description="Filled count")


@router.get("")
def list_requests(
    priority: Optional[str] = Query(default=None, description="Filter by priority"),
    status: Optional[str] = Query(default=None, description="Filter by status"),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """List all recruitment requests with priority and assigned recruiters."""
    query = db.query(RecruitmentRequest)

    if priority and priority != "All":
        query = query.filter(RecruitmentRequest.priority == priority)
    if status and status != "All":
        query = query.filter(RecruitmentRequest.status == status)

    requests = query.order_by(RecruitmentRequest.id.asc()).all()
    results = []

    for req in requests:
        sla_str = req.sla_deadline.strftime("%Y-%m-%d") if req.sla_deadline else "2026-11-30"
        results.append({
            "id": f"req-{req.id:03d}",
            "numeric_id": req.id,
            "reqNumber": req.req_number,
            "roleTitle": req.role_title,
            "jobId": f"job-{req.job_id:03d}" if req.job_id else "job-001",
            "department": req.department or "Enterprise Cloud Solutions",
            "hiringManager": req.hiring_manager or "Vikram Malhotra",
            "assignedRecruiter": req.assigned_recruiter or "Ananya Sharma",
            "priority": req.priority or "Medium",
            "status": req.status or "Open",
            "targetPositions": req.target_positions or 1,
            "filledPositions": req.filled_positions or 0,
            "createdAt": req.created_at.strftime("%Y-%m-%d") if req.created_at else "2026-11-01",
            "slaDeadline": sla_str,
            "location": req.location or "Bangalore",
            "notes": req.notes or "",
        })

    return results


@router.get("/{request_id}")
def get_request(request_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Retrieve details for one recruitment request."""
    raw_id = request_id.replace("req-", "").lstrip("0") or "0"
    try:
        r_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request ID format.")

    req = db.query(RecruitmentRequest).filter(RecruitmentRequest.id == r_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found.")

    sla_str = req.sla_deadline.strftime("%Y-%m-%d") if req.sla_deadline else "2026-11-30"
    return {
        "id": f"req-{req.id:03d}",
        "numeric_id": req.id,
        "reqNumber": req.req_number,
        "roleTitle": req.role_title,
        "jobId": f"job-{req.job_id:03d}" if req.job_id else "job-001",
        "department": req.department or "Enterprise Cloud Solutions",
        "hiringManager": req.hiring_manager or "Vikram Malhotra",
        "assignedRecruiter": req.assigned_recruiter or "Ananya Sharma",
        "priority": req.priority or "Medium",
        "status": req.status or "Open",
        "targetPositions": req.target_positions or 1,
        "filledPositions": req.filled_positions or 0,
        "createdAt": req.created_at.strftime("%Y-%m-%d") if req.created_at else "2026-11-01",
        "slaDeadline": sla_str,
        "location": req.location or "Bangalore",
        "notes": req.notes or "",
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_request(
    payload: RequestCreateSchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Create a new recruitment requisition."""
    count = db.query(RecruitmentRequest).count() + 1
    req_number = f"REQ-2026-{100 + count:03d}"

    req = RecruitmentRequest(
        req_number=req_number,
        role_title=payload.role_title,
        department=payload.department,
        hiring_manager=payload.hiring_manager,
        assigned_recruiter=payload.assigned_recruiter,
        priority=payload.priority,
        status=payload.status,
        target_positions=payload.target_positions,
        location=payload.location,
        notes=payload.notes,
        created_at=datetime.now(timezone.utc),
    )
    db.add(req)

    db.add(ActivityEvent(
        event_type="requisition_created",
        summary=f"New recruitment requisition created: {req_number} ({payload.role_title})",
        entity_type="recruitment_request",
        entity_id=str(count),
        created_at=datetime.now(timezone.utc),
    ))

    db.commit()
    db.refresh(req)

    return {"status": "success", "message": "Request created.", "reqNumber": req.req_number, "id": f"req-{req.id:03d}"}


@router.patch("/{request_id}")
def update_request(
    request_id: str,
    payload: RequestUpdateSchema,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Update priority, status, or assigned recruiter for a requisition."""
    raw_id = request_id.replace("req-", "").lstrip("0") or "0"
    try:
        r_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request ID format.")

    req = db.query(RecruitmentRequest).filter(RecruitmentRequest.id == r_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found.")

    if payload.priority is not None:
        req.priority = payload.priority
    if payload.status is not None:
        req.status = payload.status
    if payload.assigned_recruiter is not None:
        req.assigned_recruiter = payload.assigned_recruiter
    if payload.notes is not None:
        req.notes = payload.notes
    if payload.filled_positions is not None:
        req.filled_positions = payload.filled_positions

    db.add(ActivityEvent(
        event_type="requisition_updated",
        summary=f"Requisition {req.req_number} updated: priority {req.priority}, status {req.status}",
        entity_type="recruitment_request",
        entity_id=str(req.id),
        created_at=datetime.now(timezone.utc),
    ))

    db.commit()
    db.refresh(req)

    return {"status": "success", "message": f"Request {req.req_number} updated.", "priority": req.priority, "request_status": req.status}
