# Import APIRouter, Depends, and Query from FastAPI.
from fastapi import APIRouter, Depends, Query
# Import Session from SQLAlchemy.
from sqlalchemy.orm import Session
# Import typing helpers.
from typing import Any, Optional
# Import Collections Counter and Path for analytics aggregation.
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
import os
# Import database session dependency.
from database.sqlite_connection import get_db
# Import database models for analytics queries.
from database.models import (
    Candidate,
    Resume,
    ResumeEmbedding,
    Job,
    JDSegmentation,
    JobRequirement,
    JobEmbedding,
    RecruitmentRequest,
    ActivityEvent,
    ApprovalRequest,
    Interview,
)
# Import configured model names without reading sensitive API credentials.
from app.embedding_service import OPENROUTER_EMBEDDING_MODEL
# Import semantic matching engine for grounded matching distribution metrics.
from app.services.matching_engine_service import search_and_match_candidates

# Create router for dashboard analytics.
router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/dashboard")
def get_dashboard_metrics(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Retrieve high-level KPIs, dynamic pipeline funnel counts, and live activity feed."""
    total_candidates = db.query(Candidate).count()
    total_resumes = db.query(Resume).count()
    # Count active jobs case-insensitively to include active and open requisitions.
    active_jobs = db.query(Job).filter(Job.status.in_(["Active", "active", "Open", "open"])).count()
    pending_requests = db.query(RecruitmentRequest).filter(RecruitmentRequest.status != "Fulfilled").count()
    urgent_requests = db.query(RecruitmentRequest).filter(RecruitmentRequest.priority == "Urgent").count()

    # Calculate dynamic pipeline stages from candidate table.
    candidates = db.query(Candidate).all()
    tot = max(total_candidates, 1)
    screened = sum(1 for c in candidates if c.stage != "Rejected")
    shortlisted = sum(1 for c in candidates if c.stage in ["Shortlisted", "Technical Round 1", "Technical Round 2", "Manager Round", "HR Discussion", "Interviewing", "Offer Extended", "Offered", "Hired"])
    interviewing = sum(1 for c in candidates if c.stage in ["Technical Round 1", "Technical Round 2", "Manager Round", "HR Discussion", "Interviewing"])
    offered = sum(1 for c in candidates if c.stage in ["Offer Extended", "Offered", "Hired"])

    pipeline_stages = [
        {"stage": "Resumes Ingested", "count": total_resumes, "percentage": 100, "color": "bg-slate-400"},
        {"stage": "Screened & Verified", "count": screened, "percentage": round((screened / tot) * 100), "color": "bg-brand-500"},
        {"stage": "Shortlisted", "count": shortlisted, "percentage": round((shortlisted / tot) * 100), "color": "bg-emerald-600"},
        {"stage": "Interview Stage", "count": interviewing, "percentage": round((interviewing / tot) * 100), "color": "bg-blue-600"},
        {"stage": "Offer / Hired Stage", "count": offered, "percentage": round((offered / tot) * 100), "color": "bg-teal-600"},
    ]

    # Fetch recent activities.
    recent_events = db.query(ActivityEvent).order_by(ActivityEvent.created_at.desc()).limit(8).all()
    activities_feed = []
    for ev in recent_events:
        activities_feed.append({
            "id": f"act-{ev.id}",
            "type": ev.event_type,
            "title": ev.event_type.replace("_", " ").title(),
            "description": ev.summary,
            "time": ev.created_at.strftime("%I:%M %p") if ev.created_at else "Recent",
            "accent": "brand" if "match" in ev.event_type or "stage" in ev.event_type else "navy",
            "actor": "CompanyAI System",
        })

    # Compute real grounded AI intelligence insights directly from current SQLite records.
    all_jobs = db.query(Job).all()
    total_embeddings = db.query(ResumeEmbedding).count()
    pending_approvals_count = db.query(ApprovalRequest).filter(ApprovalRequest.status == "pending").count()
    approved_seg_job_ids = {
        row[0]
        for row in db.query(JDSegmentation.job_id).filter(JDSegmentation.is_approved == 1).distinct().all()
    }
    embedded_job_ids = {row[0] for row in db.query(JobEmbedding.job_id).distinct().all()}
    primary_active_job = next((j for j in all_jobs if j.status == "Active"), None)
    unembedded_active_jobs = [
        j for j in all_jobs if j.status in ("Active", "Open", "open") and j.id not in embedded_job_ids
    ]

    insights = []
    # Insight 1: Surface pending human-in-the-loop approvals or primary active matching job.
    if pending_approvals_count > 0:
        insights.append({
            "id": "ins-approvals",
            "type": "urgent",
            "title": f"{pending_approvals_count} Pending Approval Request{'s' if pending_approvals_count != 1 else ''}",
            "description": "Recruiter actions await human sign-off before stage progression or offer finalization.",
            "actionText": "Review Queue",
            "targetTab": "approvals",
        })
    elif primary_active_job:
        insights.append({
            "id": "ins-active-job",
            "type": "urgent",
            "title": f"Active Role Ready: {primary_active_job.title}",
            "description": f"{total_candidates} candidates indexed across {total_resumes} resumes for semantic requirement matching.",
            "actionText": "Open Matching",
            "targetJobId": f"job-{primary_active_job.id:03d}",
        })

    # Insight 2: Report real JD embedding readiness gap if active/open jobs lack JD vectors.
    if unembedded_active_jobs:
        sample_job = unembedded_active_jobs[0]
        insights.append({
            "id": "ins-jd-embed",
            "type": "recommendation",
            "title": f"{len(unembedded_active_jobs)} Jobs Awaiting JD Vectors",
            "description": f"Approve JD segmentation and generate 2048-dim vectors for {sample_job.title} and remaining open roles.",
            "actionText": "Inspect Requirements",
            "targetJobId": f"job-{sample_job.id:03d}",
        })

    # Insight 3: Report live resume embedding coverage without legacy 7-resume copy.
    insights.append({
        "id": "ins-vector-health",
        "type": "verification",
        "title": "Resume & Vector Index Health",
        "description": f"{total_embeddings} of {total_resumes} resumes have active 2048-dim semantic embeddings across {len(approved_seg_job_ids)} approved JD segmentations.",
        "actionText": "View Analytics",
        "targetTab": "analytics",
    })

    # Separate strict active vs open sourcing vs under review counts for transparent reporting.
    active_strict = sum(1 for j in all_jobs if (j.status or "").strip() == "Active")
    open_sourcing = sum(1 for j in all_jobs if (j.status or "").strip().lower() == "open")
    under_review_jobs = sum(1 for j in all_jobs if (j.status or "").strip().lower() == "under review")

    return {
        "kpis": {
            "totalCandidates": total_candidates,
            "totalResumes": total_resumes,
            "activeJobs": active_jobs,
            "activeJobsStrict": active_strict,
            "openSourcingJobs": open_sourcing,
            "underReviewJobs": under_review_jobs,
            "totalJobs": len(all_jobs),
            "pendingRequests": pending_requests,
            "urgentRequests": urgent_requests,
        },
        "pipelineStages": pipeline_stages,
        "activities": activities_feed,
        "aiInsights": insights,
    }


@router.get("/activities")
def list_activity_events(
    limit: int = Query(default=50, ge=1, le=500, description="Maximum activity events to retrieve"),
    entity_type: Optional[str] = Query(default=None, description="Filter by entity type (candidate, job, request, approval)"),
    entity_id: Optional[str] = Query(default=None, description="Filter by specific entity record ID"),
    event_type: Optional[str] = Query(default=None, description="Filter by event category"),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Retrieve full audit log of recruitment activity events with optional entity filtering."""
    # Build query on ActivityEvent model.
    query = db.query(ActivityEvent)
    # Apply optional entity type filter, matching both legacy request and recruitment_request values.
    if entity_type:
        if entity_type.lower() in {"request", "recruitment_request"}:
            query = query.filter(ActivityEvent.entity_type.in_(["request", "recruitment_request"]))
        else:
            query = query.filter(ActivityEvent.entity_type == entity_type)
    # Apply optional entity ID filter if supplied.
    if entity_id:
        query = query.filter(ActivityEvent.entity_id == entity_id)
    # Apply optional event type category filter if supplied.
    if event_type:
        query = query.filter(ActivityEvent.event_type == event_type)
    # Order by chronological timestamp descending to present latest occurrences first.
    events = query.order_by(ActivityEvent.created_at.desc()).limit(limit).all()
    # Format and return serialized event descriptors.
    results = []
    for ev in events:
        results.append({
            "id": ev.id,
            "eventType": ev.event_type,
            "title": ev.event_type.replace("_", " ").title(),
            "summary": ev.summary,
            "entityType": ev.entity_type,
            "entityId": ev.entity_id,
            "timestamp": ev.created_at.isoformat() if ev.created_at else None,
            "formattedTime": ev.created_at.strftime("%I:%M %p, %b %d") if ev.created_at else "Recent",
        })
    return results


@router.get("/stats")
def get_extended_recruitment_stats(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Retrieve grounded analytics metrics across embeddings, pipeline distribution, jobs, and requests."""
    # Query candidate population counts.
    total_candidates = db.query(Candidate).count()
    total_resumes = db.query(Resume).count()
    # Query resume embedding coverage counts.
    total_embeddings = db.query(ResumeEmbedding).count()
    # Calculate vector coverage percentage based on database resume count.
    coverage_pct = round((total_embeddings / max(total_resumes, 1)) * 100, 1)
    # Query job counts by status.
    all_jobs = db.query(Job).all()
    active_jobs = [j for j in all_jobs if j.status in ["Active", "active", "Open", "open"]]
    # Query recruitment requests counts.
    total_requests = db.query(RecruitmentRequest).count()
    urgent_requests = db.query(RecruitmentRequest).filter(RecruitmentRequest.priority == "Urgent").count()
    # Query candidate pipeline distribution across all stored candidates.
    candidates = db.query(Candidate).all()
    stages_count: dict[str, int] = {}
    for c in candidates:
        stg = c.stage or "New"
        stages_count[stg] = stages_count.get(stg, 0) + 1
    # Query placement candidates (Offer Extended or Hired).
    placements_count = sum(1 for c in candidates if c.stage in ["Offer Extended", "Hired", "Offered"])
    # Query approval count metrics.
    total_approvals = db.query(ApprovalRequest).count()
    pending_approvals = db.query(ApprovalRequest).filter(ApprovalRequest.status == "pending").count()
    # Query scheduled interviews count.
    total_interviews = db.query(Interview).count()
    # Query active job segmentations and job requirement embeddings.
    total_segmentations = db.query(JDSegmentation).count()
    total_job_embeddings = db.query(JobEmbedding).count()

    return {
        "overview": {
            "totalCandidates": total_candidates,
            "totalResumes": total_resumes,
            "totalEmbeddings": total_embeddings,
            "embeddingCoveragePercent": coverage_pct,
            "embeddingDimension": 2048,
            "embeddingModel": OPENROUTER_EMBEDDING_MODEL,
            "totalJobs": len(all_jobs),
            "activeJobs": len(active_jobs),
            "totalRequests": total_requests,
            "urgentRequests": urgent_requests,
            "placementsCount": placements_count,
            "totalApprovals": total_approvals,
            "pendingApprovals": pending_approvals,
            "totalInterviews": total_interviews,
            "totalSegmentations": total_segmentations,
            "totalJobEmbeddings": total_job_embeddings,
        },
        "pipelineDistribution": stages_count,
        "aiHealth": {
            "status": "healthy",
            "provider": "OpenRouter / NVIDIA",
            "embeddingModel": OPENROUTER_EMBEDDING_MODEL,
            "llmModel": os.getenv("OPENROUTER_LLM_MODEL", "nvidia/nemotron-4-340b-instruct"),
            "vectorDimensions": 2048,
            "databaseType": "SQLite",
            "databaseFile": "data/companyai.db",
        },
    }


@router.get("/intelligence")
def get_analytics_intelligence(
    days: Optional[int] = Query(default=None, ge=1, le=3650, description="Lookback window in days"),
    job_id: Optional[int] = Query(default=None, description="Optional numeric job ID scope"),
    client: Optional[str] = Query(default=None, description="Optional client filter"),
    stage: Optional[str] = Query(default=None, description="Optional pipeline stage filter"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return full real database aggregations for all enterprise recruitment analytics visualizations."""
    # Establish optional UTC cutoff date when a lookback window (7d, 30d, 90d) is supplied.
    cutoff_dt: Optional[datetime] = None
    if days is not None:
        cutoff_dt = datetime.now(timezone.utc) - timedelta(days=days)

    # Helper to safely normalize naive or aware SQLite timestamps into UTC-aware datetimes.
    def _to_utc(dt_val: Optional[datetime]) -> Optional[datetime]:
        if dt_val is None:
            return None
        return dt_val if dt_val.tzinfo is not None else dt_val.replace(tzinfo=timezone.utc)

    # Load all jobs and apply client / job_id filters cleanly.
    all_jobs = db.query(Job).order_by(Job.id.asc()).all()
    filtered_jobs = [
        j for j in all_jobs
        if (job_id is None or j.id == job_id)
        and (not client or client == "All" or (j.client_name or "").strip().lower() == client.strip().lower())
    ]

    # Load candidates filtered optionally by stage and lookback window.
    all_candidates = db.query(Candidate).all()
    filtered_candidates = [
        c for c in all_candidates
        if (not stage or stage == "All" or (c.stage or "New").strip().lower() == stage.strip().lower())
        and (cutoff_dt is None or _to_utc(c.created_at) is None or _to_utc(c.created_at) >= cutoff_dt)
    ]

    # 1. Pipeline Funnel across standard ordered stages without guessing missing stages.
    ordered_stages = [
        "New",
        "Shortlisted",
        "Technical Round 1",
        "Technical Round 2",
        "Manager Round",
        "HR Discussion",
        "Offer Extended",
        "Hired",
        "Rejected",
    ]
    stage_counts: Counter[str] = Counter((c.stage or "New") for c in filtered_candidates)
    pipeline_funnel = [
        {"stage": stg, "count": stage_counts.get(stg, 0)}
        for stg in ordered_stages
    ]
    # Append any custom stages stored in SQLite outside the standard list so totals reconcile cleanly.
    for stg, cnt in stage_counts.items():
        if stg not in ordered_stages:
            pipeline_funnel.append({"stage": stg, "count": cnt})

    # 2. Recruitment Trends over time from real ActivityEvent, Candidate, and Interview timestamps.
    all_events = db.query(ActivityEvent).order_by(ActivityEvent.created_at.asc()).all()
    all_interviews = db.query(Interview).all()
    trend_buckets: dict[str, dict[str, Any]] = {}
    # Aggregate activity events per ISO date inside optional date window.
    for ev in all_events:
        ev_dt = _to_utc(ev.created_at)
        if not ev_dt or (cutoff_dt and ev_dt < cutoff_dt):
            continue
        day_key = ev_dt.strftime("%Y-%m-%d")
        bucket = trend_buckets.setdefault(day_key, {"date": day_key, "activities": 0, "candidates": 0, "interviews": 0})
        bucket["activities"] += 1
    # Aggregate candidate creation dates.
    for c in filtered_candidates:
        c_dt = _to_utc(c.created_at)
        if not c_dt or (cutoff_dt and c_dt < cutoff_dt):
            continue
        day_key = c_dt.strftime("%Y-%m-%d")
        bucket = trend_buckets.setdefault(day_key, {"date": day_key, "activities": 0, "candidates": 0, "interviews": 0})
        bucket["candidates"] += 1
    # Aggregate interview dates.
    for iv in all_interviews:
        iv_dt = _to_utc(iv.created_at)
        if not iv_dt or (cutoff_dt and iv_dt < cutoff_dt):
            continue
        day_key = iv_dt.strftime("%Y-%m-%d")
        bucket = trend_buckets.setdefault(day_key, {"date": day_key, "activities": 0, "candidates": 0, "interviews": 0})
        bucket["interviews"] += 1
    recruitment_trends = sorted(trend_buckets.values(), key=lambda x: x["date"])[-21:]

    # 3. Job Status Distribution normalizing case variants without double-counting.
    status_buckets: Counter[str] = Counter()
    for j in filtered_jobs:
        raw_st = (j.status or "Unknown").strip().lower()
        if raw_st == "active":
            status_buckets["Active"] += 1
        elif raw_st == "open":
            status_buckets["Open / Sourcing"] += 1
        elif raw_st == "under review":
            status_buckets["Under Review"] += 1
        elif raw_st in {"closed", "filled"}:
            status_buckets["Closed / Filled"] += 1
        else:
            status_buckets[raw_st.title()] += 1
    job_status_distribution = [
        {"status": k, "count": v}
        for k, v in status_buckets.items()
    ]

    # 4. Top Skills Intelligence: Candidate Supply vs Job Demand counts from SQLite.
    supply_counts: Counter[str] = Counter()
    canonical_display: dict[str, str] = {}
    for c in filtered_candidates:
        seen_cand_skills: set[str] = set()
        for sk in (c.skills or []):
            tok = str(sk).strip()
            if not tok or len(tok) > 45:
                continue
            key = tok.lower()
            if key not in seen_cand_skills:
                seen_cand_skills.add(key)
                supply_counts[key] += 1
                canonical_display.setdefault(key, tok)

    demand_counts: Counter[str] = Counter()
    for j in filtered_jobs:
        seen_job_skills: set[str] = set()
        for sk in (j.required_skills or []) + (j.preferred_skills or []):
            tok = str(sk).strip()
            if not tok or tok.startswith(("SyncMandatorySkill_", "SyncPreferredSkill_", "JDSkillV2_", "ManualRecruiterSkill_")):
                continue
            key = tok.lower()
            if key not in seen_job_skills:
                seen_job_skills.add(key)
                demand_counts[key] += 1
                canonical_display.setdefault(key, tok)

    # Combine top skills ordered by combined demand + supply prominence.
    combined_keys = sorted(
        set(list(supply_counts.keys()) + list(demand_counts.keys())),
        key=lambda k: (demand_counts[k] * 5 + supply_counts[k]),
        reverse=True,
    )[:12]
    skills_intelligence = [
        {
            "skill": canonical_display.get(k, k),
            "supplyCount": supply_counts.get(k, 0),
            "demandCount": demand_counts.get(k, 0),
        }
        for k in combined_keys
    ]

    # 5 & 6. Matching Score Distribution & Job-wise Matching Performance across evaluated jobs.
    # Prioritize explicitly requested job_id or Active jobs to keep response latency bounded.
    eval_jobs = [j for j in filtered_jobs if job_id is not None or j.status == "Active"][:6]
    if not eval_jobs and filtered_jobs:
        eval_jobs = filtered_jobs[:3]

    score_bins = [
        {"bucket": "90-100%", "min": 90, "max": 100, "count": 0},
        {"bucket": "80-89%", "min": 80, "max": 89, "count": 0},
        {"bucket": "70-79%", "min": 70, "max": 79, "count": 0},
        {"bucket": "60-69%", "min": 60, "max": 69, "count": 0},
        {"bucket": "50-59%", "min": 50, "max": 59, "count": 0},
        {"bucket": "<50%", "min": 0, "max": 49, "count": 0},
    ]
    job_matching_performance = []
    for ej in eval_jobs:
        try:
            res = search_and_match_candidates(db=db, job_id=ej.id, page=1, page_size=250)
            matches = res.get("matches", [])
            summary = res.get("summary", {})
            raw_scores = [float(m.get("raw_score", m.get("match_score", 0)) or 0) for m in matches]
            # Bin scores from the primary scoped job (first job when unscoped, or matching target job).
            if len(job_matching_performance) == 0:
                for sc in raw_scores:
                    for b in score_bins:
                        if b["min"] <= sc <= b["max"] or (b["min"] == 0 and sc < 50):
                            b["count"] += 1
                            break
            job_matching_performance.append({
                "jobId": f"job-{ej.id:03d}",
                "numericId": ej.id,
                "title": ej.title,
                "status": ej.status,
                "evaluatedCount": res.get("total_evaluated", len(matches)),
                "avgScore": round(sum(raw_scores) / len(raw_scores), 1) if raw_scores else 0.0,
                "strongCount": summary.get("strong_matches", 0),
                "potentialCount": summary.get("potential_matches", 0),
                "needsReviewCount": summary.get("needs_review", 0),
            })
        except Exception:
            # Skip failing job evaluation gracefully without breaking full analytics response.
            continue

    # 7. Resume File Format Distribution from persisted Resume records.
    all_resumes = db.query(Resume).all()
    ext_counts: Counter[str] = Counter()
    for r in all_resumes:
        fname = (r.source_filename or "").strip()
        ext = Path(fname).suffix.lower() if fname else ""
        label = ext.lstrip(".").upper() if ext else "UNKNOWN"
        ext_counts[label] += 1
    resume_formats = [
        {"format": fmt, "count": cnt}
        for fmt, cnt in ext_counts.most_common()
    ]

    # 8. Embedding Coverage & JD Vector Readiness.
    total_resumes = len(all_resumes)
    total_resume_embeddings = db.query(ResumeEmbedding).count()
    embedded_job_ids = {row[0] for row in db.query(JobEmbedding.job_id).distinct().all()}
    approved_seg_job_ids = {
        row[0]
        for row in db.query(JDSegmentation.job_id).filter(JDSegmentation.is_approved == 1).distinct().all()
    }
    total_job_reqs = db.query(JobRequirement).count()
    total_job_embeddings = db.query(JobEmbedding).count()

    # 9. Recruitment Requests Status & Priority breakdown.
    all_requests = db.query(RecruitmentRequest).all()
    req_status_counts: Counter[str] = Counter((r.status or "Open") for r in all_requests)
    req_priority_counts: Counter[str] = Counter((r.priority or "Medium") for r in all_requests)
    request_analytics = {
        "totalRequests": len(all_requests),
        "totalTargetPositions": sum((r.target_positions or 0) for r in all_requests),
        "totalFilledPositions": sum((r.filled_positions or 0) for r in all_requests),
        "byStatus": [{"status": k, "count": v} for k, v in req_status_counts.items()],
        "byPriority": [{"priority": k, "count": v} for k, v in req_priority_counts.items()],
    }

    # 10. Offer, Placement, Interview, and Approval counts cleanly separated.
    offer_extended_count = sum(1 for c in filtered_candidates if c.stage in {"Offer Extended", "Offered"})
    hired_count = sum(1 for c in filtered_candidates if c.stage == "Hired")
    rejected_count = sum(1 for c in filtered_candidates if c.stage == "Rejected")
    all_approvals = db.query(ApprovalRequest).all()
    approval_counts: Counter[str] = Counter((a.status or "pending").lower() for a in all_approvals)

    # Distinct clients list for analytics filter dropdowns.
    distinct_clients = sorted({(j.client_name or "").strip() for j in all_jobs if (j.client_name or "").strip()})

    return {
        "filtersApplied": {
            "days": days,
            "job_id": job_id,
            "client": client,
            "stage": stage,
        },
        "availableFilters": {
            "clients": distinct_clients,
            "jobs": [{"id": j.id, "label": f"job-{j.id:03d} — {j.title}", "status": j.status} for j in all_jobs[:35]],
            "stages": ordered_stages,
        },
        "pipelineFunnel": pipeline_funnel,
        "recruitmentTrends": recruitment_trends,
        "jobStatusDistribution": job_status_distribution,
        "skillsIntelligence": skills_intelligence,
        "matchingScoreDistribution": {
            "scopedJobId": job_matching_performance[0]["jobId"] if job_matching_performance else None,
            "scopedJobTitle": job_matching_performance[0]["title"] if job_matching_performance else None,
            "buckets": score_bins,
        },
        "jobMatchingPerformance": job_matching_performance,
        "resumeFormatDistribution": resume_formats,
        "embeddingCoverage": {
            "totalResumes": total_resumes,
            "embeddedResumes": total_resume_embeddings,
            "unembeddedResumes": max(0, total_resumes - total_resume_embeddings),
            "resumeCoveragePercent": round((total_resume_embeddings / max(total_resumes, 1)) * 100, 1),
            "totalJobs": len(all_jobs),
            "jobsWithApprovedSegmentation": len(approved_seg_job_ids),
            "jobsWithEmbeddings": len(embedded_job_ids),
            "totalJobRequirements": total_job_reqs,
            "totalJobEmbeddings": total_job_embeddings,
            "vectorDimensions": 2048,
        },
        "requestAnalytics": request_analytics,
        "placementAndOfferStats": {
            "offerExtendedCount": offer_extended_count,
            "hiredCount": hired_count,
            "rejectedCount": rejected_count,
            "scheduledInterviewsCount": len(all_interviews),
            "approvalsPending": approval_counts.get("pending", 0),
            "approvalsApproved": approval_counts.get("approved", 0),
            "approvalsRejected": approval_counts.get("rejected", 0),
            "approvalsChangesRequested": approval_counts.get("changes_requested", 0),
        },
    }
