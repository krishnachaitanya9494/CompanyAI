"""HTTP API entry point for the CompanyAI 2.0 Enterprise Agent."""

# Import FastAPI framework.
from fastapi import FastAPI
from contextlib import asynccontextmanager
# Import CORS middleware to allow cross-origin requests from Vite frontend.
from fastapi.middleware.cors import CORSMiddleware

# Import all modular CompanyAI 2.0 domain routers.
from app.routers import (
    candidates,
    jobs,
    requests,
    analytics,
    search,
    approvals,
    agent,
    ingestion,
    intelligence,
)
# Import fallback SQLite resources router for file downloads and legacy upload endpoints.
from app.api_routes import router as sqlite_resources_router
from database.sqlite_connection import initialize_database

# Initialize missing SQLite tables before serving registered routes.
@asynccontextmanager
async def lifespan(application: FastAPI):
    initialize_database()
    yield


# Initialize FastAPI application with title, version, and additive schema startup.
app = FastAPI(
    title="CompanyAI 2.0 — Enterprise AI Recruitment & Operations Platform",
    description="Backend API for candidate search, JD intelligence, recruitment requests, Nemotron AI agent, and approval workflows.",
    version="2.0.0",
    lifespan=lifespan,
)

# Enable CORS for local Vite frontend across all local dev ports.
app.add_middleware(
    CORSMiddleware,
    # Allow all origins so local frontend ports (5173, 5174, 3000) connect seamlessly.
    allow_origins=["*"],
    # Disable credential cookies when wildcard origin matching is active.
    allow_credentials=False,
    # Allow all HTTP methods for RESTful actions.
    allow_methods=["*"],
    # Allow all headers for flexible API client requests.
    allow_headers=["*"],
)

# Mount the CompanyAI 2.0 modular domain routers first for primary API contracts.
app.include_router(candidates.router)
app.include_router(jobs.router)
app.include_router(requests.router)
app.include_router(analytics.router)
app.include_router(search.router)
app.include_router(approvals.router)
app.include_router(agent.router)
app.include_router(ingestion.router)
app.include_router(intelligence.router)

# Mount fallback SQLite resource endpoints for file downloads and legacy operations.
app.include_router(sqlite_resources_router)


@app.get("/")
def read_root() -> dict[str, str]:
    """Provide a welcome response at the API root with platform status."""
    return {
        "message": "CompanyAI 2.0 Enterprise API is running",
        "version": "2.0.0",
        "docs_url": "/docs",
    }


@app.get("/health")
def health_check() -> dict[str, str]:
    """Report that the API process and database connectivity are healthy."""
    return {"status": "ok", "platform": "CompanyAI 2.0"}
