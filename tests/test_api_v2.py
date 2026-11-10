"""Integration tests for CompanyAI 2.0 API routes and routers."""

# Import TestClient from fastapi.testclient.
from fastapi.testclient import TestClient
# Import FastAPI app.
from app.main import app

# Instantiate test client.
client = TestClient(app)


def test_root_and_health():
    """Verify root and health endpoints respond with success."""
    r_root = client.get("/")
    assert r_root.status_code == 200
    assert "CompanyAI 2.0" in r_root.json()["message"]

    r_health = client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "ok"


def test_candidates_api():
    """Verify candidates list and details endpoints."""
    r = client.get("/api/candidates")
    assert r.status_code == 200
    cands = r.json()
    assert len(cands) >= 7
    first_id = cands[0]["id"]

    r_det = client.get(f"/api/candidates/{first_id}")
    assert r_det.status_code == 200
    assert r_det.json()["name"] == cands[0]["name"]


def test_jobs_api():
    """Verify jobs list and matching endpoints."""
    r = client.get("/api/jobs")
    assert r.status_code == 200
    jobs = r.json()
    assert len(jobs) >= 7

    first_job_id = jobs[0]["id"]
    r_matches = client.get(f"/api/jobs/{first_job_id}/matches")
    assert r_matches.status_code == 200
    assert len(r_matches.json()) > 0


def test_requests_api():
    """Verify recruitment requests list and update endpoints."""
    r = client.get("/api/requests")
    assert r.status_code == 200
    reqs = r.json()
    assert len(reqs) >= 5

    first_req_id = reqs[0]["id"]
    r_patch = client.patch(f"/api/requests/{first_req_id}", json={"priority": "Urgent"})
    assert r_patch.status_code == 200
    assert r_patch.json()["priority"] == "Urgent"


def test_analytics_dashboard_api():
    """Verify dashboard metrics endpoint returns real KPIs and pipeline counts."""
    r = client.get("/api/analytics/dashboard")
    assert r.status_code == 200
    data = r.json()
    assert data["kpis"]["totalCandidates"] >= 7
    assert len(data["pipelineStages"]) == 5
    assert len(data["activities"]) > 0


def test_search_api():
    """Verify unified search endpoint."""
    r = client.get("/api/search?q=oracle")
    assert r.status_code == 200
    data = r.json()
    assert data["totalResults"] > 0


def test_ai_agent_chat_api():
    """Verify AI agent chat execution and trace logging."""
    r = client.post("/api/ai/chat", json={"query": "Find Teamcenter PLM consultants"})
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "success"
    assert len(data["candidates"]) > 0
    assert "tools_called" in data["trace"]

    r_traces = client.get("/api/ai/traces")
    assert r_traces.status_code == 200
    assert len(r_traces.json()) > 0


def test_approvals_api():
    """Verify human-in-the-loop approval workflow."""
    # Propose sensitive action.
    r_prop = client.post("/api/approvals", json={
        "action_type": "update_candidate_stage",
        "description": "Promote candidate to Offered stage",
        "payload": {"candidate_id": 1, "new_stage": "Offer Extended"},
    })
    assert r_prop.status_code == 201
    approval_id = r_prop.json()["approval_id"]

    # Check pending list.
    r_pending = client.get("/api/approvals/pending")
    assert r_pending.status_code == 200
    assert any(a["id"] == approval_id for a in r_pending.json())

    # Approve action.
    r_app = client.post(f"/api/approvals/{approval_id}/approve", json={"approver": "Test Recruiter"})
    assert r_app.status_code == 200
    assert r_app.json()["status"] == "approved"


def test_full_recruitment_workflow_e2e():
    """Verify complete end-to-end recruitment lifecycle from matching to hiring."""
    # Step 1: Candidate Profile & Resume Inspection.
    cand_res = client.get("/api/candidates/1")
    assert cand_res.status_code == 200
    candidate = cand_res.json()
    assert candidate["numeric_id"] == 1
    assert len(candidate["primarySkills"]) > 0

    # Step 2: Analyze Job Description with Nemotron.
    jd_res = client.post("/api/jobs/1/analyze")
    assert jd_res.status_code == 200
    analysis = jd_res.json()
    assert "status" in analysis

    # Step 3: Match and Rank Candidates using semantic vector search.
    match_res = client.get("/api/jobs/1/matches")
    assert match_res.status_code == 200
    matches = match_res.json()
    assert len(matches) > 0
    top_candidate = matches[0]
    assert "matchScore" in top_candidate

    # Step 4: Schedule an Interview for candidate.
    interview_payload = {
        "round_name": "Technical Round 1",
        "interviewer": "Vikram Malhotra (VP Eng)",
        "scheduled_at": "2026-11-15T14:30:00",
        "notes": "Evaluate system architecture and Teamcenter PLM integration."
    }
    interview_res = client.post(f"/api/candidates/{candidate['id']}/interviews", json=interview_payload)
    assert interview_res.status_code == 200

    # Step 5: Propose and execute sensitive stage transition via Human-in-the-Loop governance.
    approval_res = client.post("/api/approvals", json={
        "action_type": "update_candidate_stage",
        "description": f"Extend job offer to {candidate['name']}",
        "payload": {"candidate_id": 1, "new_stage": "Offer Extended"},
        "requester": "Nemotron AI Agent"
    })
    assert approval_res.status_code == 201
    approval_id = approval_res.json()["approval_id"]

    confirm_res = client.post(f"/api/approvals/{approval_id}/approve", json={"approver": "Recruiter Admin"})
    assert confirm_res.status_code == 200
    assert confirm_res.json()["status"] == "approved"

    # Step 6: Verify Dashboard Reflects Pipeline Progress.
    dashboard_res = client.get("/api/analytics/dashboard")
    assert dashboard_res.status_code == 200
    dashboard = dashboard_res.json()
    assert dashboard["kpis"]["totalCandidates"] >= 7
    assert dashboard["kpis"]["activeJobs"] >= 7
