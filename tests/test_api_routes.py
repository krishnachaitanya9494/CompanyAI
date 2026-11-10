"""Exercise SQLite-backed API resources against an isolated temporary database."""

# Import pytest fixtures and FastAPI's in-process HTTP client for route checks.
import pytest
import httpx
from fastapi.testclient import TestClient
# Import SQLAlchemy helpers and the exact app dependency replaced by this test module.
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
# Import the registered application, database dependency, and schema registry.
from app.main import app
from app import api_routes
from database.models import Base
from database.models import Candidate, Resume, ResumeIngestionStatus
from database.sqlite_connection import get_db


# Create a fresh SQLite schema for each test without touching the configured project database.
@pytest.fixture
def api_client():
    # Keep an in-memory database shared across the test's SQLite connections.
    test_engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    # Enable foreign-key constraints just as the production SQLite engine does.
    @event.listens_for(test_engine, "connect")
    def enable_foreign_keys(connection, record):
        # Turn on SQLite relationship enforcement for every temporary connection.
        connection.execute("PRAGMA foreign_keys=ON")
    # Create all registered application tables in the isolated test database.
    Base.metadata.create_all(test_engine)
    # Build sessions that use the temporary database engine.
    testing_session = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)
    # Override the request dependency so no endpoint can reach the project database.
    def override_get_db():
        # Yield one temporary session and always close it after request handling.
        with testing_session() as database_session:
            yield database_session
    # Install the temporary dependency before making any HTTP request.
    app.dependency_overrides[get_db] = override_get_db
    # Provide a client that does not enter application startup or initialize production SQLite.
    with TestClient(app) as client:
        # Yield the client to the route test while its isolated DB remains available.
        yield client
    # Restore global FastAPI state after each test to avoid leaking fixture behavior.
    app.dependency_overrides.pop(get_db, None)
    # Dispose the in-memory engine when this test has finished.
    test_engine.dispose()


# Verify candidate creation, listing, updating, and duplicate-email protection end to end.
def test_candidate_crud_uses_sqlite_and_rejects_duplicate_email(api_client):
    # Create a candidate through the public validated API schema.
    created = api_client.post("/api/candidates", json={"name": "Example", "email": "example@test.invalid", "skills": ["Python"]})
    # Confirm the API persisted the candidate and returned its SQLite key.
    assert created.status_code == 201
    # Read the created candidate through the detail route.
    candidate_id = created.json()["id"]
    # Confirm the list route returns the same stored identity.
    assert api_client.get("/api/candidates").json()[0]["id"] == candidate_id
    # Update a recruiter-managed field with a partial request.
    # Confirm the active modular API accepts a candidate stage update successfully.
    assert api_client.patch(f"/api/candidates/{candidate_id}", json={"stage": "Screening"}).status_code == 200
    # Reject a second record with the same normalized email address.
    duplicate = api_client.post("/api/candidates", json={"email": "EXAMPLE@test.invalid"})
    # Confirm duplicate protection uses the documented email policy.
    assert duplicate.status_code == 409


# Verify job, requisition, and dashboard data are stored and returned from SQLite.
def test_jobs_requests_and_dashboard_use_stored_records(api_client):
    # Create a real managed job with the fields used by matching and UI listings.
    job = api_client.post("/api/jobs", json={"title": "Engineer", "description": "Python role", "required_skills": ["Python"]})
    # Confirm the job was committed and its identifier can be linked to a request.
    assert job.status_code == 201
    # Create a recruitment request linked to the stored job row.
    request = api_client.post("/api/requests", json={"role_title": "Engineer", "job_id": job.json()["id"], "req_number": "REQ-TEST"})
    # Confirm the request route returns the persisted requisition.
    assert request.status_code == 201
    # Read dashboard totals from the same temporary SQLite database.
    dashboard = api_client.get("/api/dashboard")
    # Assert the counts reflect the created job and open request.
    assert dashboard.json()["total_jobs"] == 1
    # Assert the request is counted as open from stored status.
    assert dashboard.json()["open_requests"] == 1


# Verify semantic search receives no live provider call when no embeddings exist.
def test_empty_candidate_semantic_search_returns_no_results(api_client):
    # Send a valid query through the existing Phase 3 search endpoint.
    response = api_client.post("/api/candidates/search", json={"query": "Python engineer", "limit": 5})
    # Confirm the empty local database returns a successful empty result set.
    assert response.status_code == 200
    # Confirm provider credentials are not needed when there are no stored embeddings.
    assert response.json() == []


# Verify the fixed static ingestion-errors path resolves before the numeric status path.
def test_ingestion_error_list_returns_safe_retry_records(api_client):
    # Create one failed status through the isolated database dependency.
    # Open the fixture's dependency generator and obtain its temporary SQLAlchemy session.
    override_dependency = next(iter(app.dependency_overrides.values()))
    dependency_generator = override_dependency()
    database_session = next(dependency_generator)
    # Store no source path or personal details in this test failure row.
    database_session.add(ResumeIngestionStatus(source_path="/private/test.txt", status="failed", attempts=1, error_message="text_extraction_failed"))
    # Commit the fixture row so the HTTP route reads persisted state.
    database_session.commit()
    # Close the dependency generator so it releases its temporary session.
    dependency_generator.close()
    # Request the literal errors collection path that overlaps the integer route prefix.
    response = api_client.get("/api/ingestion/errors")
    # Confirm static route order returns the failed record instead of a path validation error.
    assert response.status_code == 200
    # Confirm only safe identifiers and error codes are returned.
    assert response.json()[0]["error_code"] == "text_extraction_failed"


# Verify provider connection errors become a safe service response without leaking transport details.
def test_semantic_search_translates_embedding_provider_connection_errors(api_client, monkeypatch):
    # Replace the embedding-backed search service with a deterministic network failure.
    def fail_search(query, session, limit):
        # Raise the same HTTPX base error produced by blocked provider connectivity.
        raise httpx.ConnectError("private transport details")
    # Install the mocked service before issuing the API request.
    monkeypatch.setattr(api_routes, "search_candidates", fail_search)
    # Submit a valid semantic request through the public candidate search endpoint.
    response = api_client.post("/api/candidates/search", json={"query": "Python engineer", "limit": 5})
    # Confirm provider outages return an explicit retryable service-unavailable status.
    assert response.status_code == 503
    # Confirm no transport internals escape in the public response.
    assert response.json()["detail"] == "The configured embedding service is unavailable."


# Verify filesystem discovery reports pending files separately from indexed resume records.
def test_resume_discovery_counts_supported_indexed_and_unsupported_files(api_client, monkeypatch, tmp_path):
    # Create a local fixture directory with two supported files and one unsupported file.
    resume_root = tmp_path / "data" / "resumes"
    resume_root.mkdir(parents=True)
    indexed_file = resume_root / "already-indexed.pdf"
    indexed_file.write_bytes(b"fixture bytes")
    (resume_root / "awaiting-review.docx").write_bytes(b"fixture bytes")
    (resume_root / "unsupported.png").write_bytes(b"fixture bytes")
    # Point discovery at this isolated directory rather than the user's resume files.
    monkeypatch.setattr(api_routes, "PROJECT_ROOT", tmp_path)
    # Seed one resume path through the fixture's temporary database dependency.
    override_dependency = next(iter(app.dependency_overrides.values()))
    dependency_generator = override_dependency()
    database_session = next(dependency_generator)
    # Create the required candidate foreign-key parent for the indexed resume fixture.
    candidate = Candidate(name="Example", skills=[])
    database_session.add(candidate)
    database_session.flush()
    # Store a synthetic text digest while the route intentionally matches source paths only.
    database_session.add(Resume(candidate_id=candidate.id, source_filename=indexed_file.name, file_path=str(indexed_file), content_sha256="a" * 64))
    # Seed one explicit processing record to verify database accounting is separate from path-only resume links.
    database_session.add(ResumeIngestionStatus(source_path=str(indexed_file.resolve()), status="awaiting_embedding", attempts=1, embedding_status="awaiting_authorization"))
    database_session.commit()
    dependency_generator.close()
    # Request aggregate discovery results without exposing any discovered filenames.
    response = api_client.get("/api/resumes/discovery")
    # Confirm supported and unsupported local files are distinguished accurately.
    assert response.status_code == 200
    assert response.json()["total_files"] == 3
    assert response.json()["supported_files"] == 2
    assert response.json()["indexed_files"] == 1
    assert response.json()["path_matched_files"] == 1
    assert response.json()["indexed_records"] == 1
    assert response.json()["records_without_local_file"] == 0
    assert response.json()["waiting_for_ingestion"] == 1
    assert response.json()["unsupported_files"] == 1
    # Confirm the response reports persisted status coverage and stage counts independently.
    assert response.json()["accounted_files"] == 1
    assert response.json()["supported_resume_records"] == 1
    assert response.json()["candidate_records"] == 1
    assert response.json()["awaiting_embedding"] == 1
    assert response.json()["successfully_embedded"] == 0
    assert "fixture bytes" not in response.text
    # Confirm the optional local inventory exposes filename and status but never file contents.
    assert response.json()["files"] == [
        {"filename": "already-indexed.pdf", "extension": ".pdf", "indexed": True, "path_record_found": True, "supported": True, "accounted": True, "processing_status": "awaiting_embedding", "extraction_status": None, "embedding_status": "awaiting_authorization", "error_code": None},
        {"filename": "awaiting-review.docx", "extension": ".docx", "indexed": False, "path_record_found": False, "supported": True, "accounted": False, "processing_status": "untracked", "extraction_status": None, "embedding_status": None, "error_code": None},
        {"filename": "unsupported.png", "extension": ".png", "indexed": False, "path_record_found": False, "supported": False, "accounted": False, "processing_status": "untracked", "extraction_status": None, "embedding_status": None, "error_code": None},
    ]
