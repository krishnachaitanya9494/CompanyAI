"""API router for dynamic JD-grounded interview screening kits and scorecards."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.services import interview_intelligence_service as kit_service
from database.models import InterviewKit, Job
from database.sqlite_connection import get_db

logger = logging.getLogger("companyai.routers.interview_kits")

router = APIRouter(prefix="/api/interview-kits", tags=["Interview Kits"])


class GenerateKitSchema(BaseModel):
    question_count: int = Field(default=5, ge=3, le=15)
    candidate_id: Optional[int] = None
    force_refresh: bool = False


class UpdateKitSchema(BaseModel):
    questions: Optional[List[Dict[str, Any]]] = None
    overall_scorecard: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


class RegenerateQuestionSchema(BaseModel):
    question_id: str
    target_skill: Optional[str] = None
    difficulty: Optional[str] = None


class SaveScorecardSchema(BaseModel):
    scores: Dict[str, int]
    candidate_notes: Optional[str] = None
    recommendation: Optional[str] = None


class ExportKitSchema(BaseModel):
    format: str = "pdf"  # "pdf", "docx", "txt"
    candidate_facing: bool = False


@router.get("/jobs/{job_id}")
def get_job_interview_kit(
    job_id: int,
    candidate_id: Optional[int] = Query(None, description="Optional candidate-specific kit"),
    auto_generate: bool = Query(True, description="Auto-generate if not yet existing"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve the active interview screening kit for a job, or auto-generate if missing."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found.")

    kit = (
        db.query(InterviewKit)
        .filter(
            InterviewKit.job_id == job_id,
            InterviewKit.candidate_id == candidate_id,
            InterviewKit.status == "active",
        )
        .order_by(InterviewKit.kit_version.desc())
        .first()
    )

    if kit and kit.questions:
        # Guarantee 5-question recruiter screening format for all positions
        if len(kit.questions) != 5:
            try:
                return kit_service.generate_interview_kit(
                    db=db,
                    job_id=job_id,
                    candidate_id=candidate_id,
                    question_count=5,
                    force_refresh=True,
                )
            except Exception as e:
                logger.warning(f"Failed to refresh kit {kit.id} to 5 questions: {e}")
                kit.questions = kit.questions[:5]
                kit.question_count = len(kit.questions)
                for q in kit.questions:
                    q["weight"] = 20
                db.commit()
                db.refresh(kit)
        return kit_service._kit_to_dict(kit)

    if auto_generate:
        try:
            return kit_service.generate_interview_kit(
                db=db,
                job_id=job_id,
                candidate_id=candidate_id,
                question_count=5,
                force_refresh=False,
            )
        except Exception as exc:
            logger.error(f"Failed to auto-generate interview kit for job {job_id}: {exc}")
            raise HTTPException(status_code=500, detail=str(exc))

    raise HTTPException(status_code=404, detail="No interview kit generated yet for this position.")


@router.post("/jobs/{job_id}/generate", status_code=status.HTTP_201_CREATED)
def generate_job_interview_kit(
    job_id: int,
    payload: GenerateKitSchema,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Generate or regenerate a source-grounded interview screening kit with Nemotron AI."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found.")

    try:
        return kit_service.generate_interview_kit(
            db=db,
            job_id=job_id,
            candidate_id=payload.candidate_id,
            question_count=payload.question_count,
            force_refresh=payload.force_refresh,
        )
    except Exception as exc:
        logger.error(f"Interview kit generation failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate interview kit: {exc}")


@router.put("/{kit_id}")
def update_kit(
    kit_id: int,
    payload: UpdateKitSchema,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Update question content, add custom questions, or modify evaluation rubrics."""
    try:
        return kit_service.update_interview_kit(
            db=db,
            kit_id=kit_id,
            updates=payload.model_dump(exclude_unset=True),
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{kit_id}/regenerate-question")
def regenerate_question(
    kit_id: int,
    payload: RegenerateQuestionSchema,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Regenerate a single question in the kit for a specific skill or difficulty."""
    try:
        return kit_service.regenerate_single_question(
            db=db,
            kit_id=kit_id,
            question_id=payload.question_id,
            target_skill=payload.target_skill,
            difficulty=payload.difficulty,
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{kit_id}/scorecard")
def save_scorecard(
    kit_id: int,
    payload: SaveScorecardSchema,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Record 1-5 interview question scores, candidate notes, and overall recommendation."""
    try:
        return kit_service.save_scorecard_evaluation(
            db=db,
            kit_id=kit_id,
            scores=payload.scores,
            candidate_notes=payload.candidate_notes,
            recommendation=payload.recommendation,
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{kit_id}/export")
def export_kit(
    kit_id: int,
    payload: ExportKitSchema,
    db: Session = Depends(get_db),
) -> Response:
    """Export the interview kit as PDF, DOCX (Word), or TXT."""
    kit = db.query(InterviewKit).filter(InterviewKit.id == kit_id).first()
    if not kit:
        raise HTTPException(status_code=404, detail=f"Interview kit {kit_id} not found.")

    try:
        content_bytes, media_type, filename = kit_service.export_interview_kit_bytes(
            kit=kit,
            format=payload.format,
            candidate_facing=payload.candidate_facing,
        )
        return Response(
            content=content_bytes,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as exc:
        logger.error(f"Export interview kit failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Export failed: {exc}")
