"""HTTP API entry point for the CompanyAI Agent."""

from fastapi import FastAPI

# FastAPI uses this title in the generated OpenAPI documentation.
app = FastAPI(title="CompanyAI Agent")


@app.get("/")
def read_root() -> dict[str, str]:
    """Provide a simple welcome response at the API root."""
    return {"message": "CompanyAI Agent API is running"}


@app.get("/health")
def health_check() -> dict[str, str]:
    """Report that the API process is responding to requests."""
    return {"status": "ok"}
