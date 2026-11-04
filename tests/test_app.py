"""HTTP-level tests for the FastAPI application and its public endpoints."""

from fastapi.testclient import TestClient  # Provides an in-process client for making test requests.

from app.main import app  # Imports the FastAPI instance whose routes these tests exercise.

client = TestClient(app)  # Connects test requests to the app without starting a network server.


def test_root_returns_welcome_message() -> None:  # Names a pytest test for the API root route.
    """Verify that the root route responds with its expected welcome message."""
    response = client.get("/")  # Sends a GET request to the root URL.

    assert response.status_code == 200  # Confirms the server reports a successful request.
    assert response.json() == {"message": "CompanyAI Agent API is running"}  # Checks the exact JSON payload.


def test_health_check() -> None:  # Names a pytest test for the health-check route.
    """Verify that the health route reports the application as operational."""
    response = client.get("/health")  # Sends a GET request to the health-check URL.

    assert response.status_code == 200  # Confirms the health request succeeded.
    assert response.json() == {"status": "ok"}  # Confirms the endpoint returns the expected healthy status.
