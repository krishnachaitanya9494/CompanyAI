"""Focused tests for CompanyAI's local SQLite connection module."""

# Import Path so the configuration test can compare the resolved database file.
from pathlib import Path

# Import SQLAlchemy helpers to provide isolated temporary SQLite engines.
from sqlalchemy import create_engine, inspect

# Import URL to construct Windows-safe URLs for the temporary test databases.
from sqlalchemy.engine import URL

# Import sessionmaker so the isolated test engine can back test sessions.
from sqlalchemy.orm import sessionmaker

# Import pytest for fixtures and temporary-directory support.
import pytest

# Import the SQLite module whose initialization and sessions are under test.
from database import sqlite_connection


# Create an isolated engine so tests never write to the project's real database.
@pytest.fixture
def isolated_sqlite(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    """Bind the module functions to a temporary database file."""

    # Place the test database in a nested directory that does not yet exist.
    temporary_path = tmp_path / "nested" / "companyai-test.db"

    # Build a separate SQLite engine using the same thread setting as production.
    temporary_engine = create_engine(
        URL.create("sqlite", database=str(temporary_path)),
        connect_args=sqlite_connection.SQLITE_CONNECT_ARGS,
    )

    # Point initialization at the temporary database path.
    monkeypatch.setattr(sqlite_connection, "DATABASE_PATH", temporary_path)

    # Point connectivity checks at the temporary engine.
    monkeypatch.setattr(sqlite_connection, "engine", temporary_engine)

    # Point session creation at the same temporary engine.
    monkeypatch.setattr(
        sqlite_connection,
        "SessionLocal",
        sessionmaker(bind=temporary_engine, autocommit=False, autoflush=False),
    )

    # Yield the isolated path and engine to each test using this fixture.
    yield temporary_path, temporary_engine

    # Dispose of temporary connections after each test finishes.
    temporary_engine.dispose()


# Confirm production configuration selects the requested database path and thread mode.
def test_sqlite_configuration_uses_project_path_and_fastapi_thread_setting() -> None:
    """Keep the configured file at data/companyai.db with cross-thread checks off."""

    # Resolve the expected path without creating or opening the database file.
    expected_path = Path(__file__).resolve().parent.parent / "data" / "companyai.db"

    # Confirm the module points to the requested project-local database file.
    assert sqlite_connection.DATABASE_PATH == expected_path

    # Confirm the engine URL uses SQLite and resolves to that same file.
    assert sqlite_connection.DATABASE_URL.drivername == "sqlite"
    assert Path(sqlite_connection.DATABASE_URL.database) == expected_path

    # Confirm the engine is configured for FastAPI's multi-threaded request handling.
    assert sqlite_connection.SQLITE_CONNECT_ARGS == {"check_same_thread": False}

    # Confirm the reusable session factory is bound to the production engine.
    assert sqlite_connection.SessionLocal.kw["bind"] is sqlite_connection.engine


# Confirm initialization creates nested parent folders and all registered SQLite tables.
def test_initialize_database_creates_parent_directory_and_file(isolated_sqlite) -> None:
    """Initialize a new file database without requiring a separate manual schema step."""

    # Unpack the isolated path and engine provided by the fixture.
    temporary_path, temporary_engine = isolated_sqlite

    # Initialize the database and create its first application schema.
    initialized_path = sqlite_connection.initialize_database()

    # Confirm initialization returns the configured temporary path.
    assert initialized_path == temporary_path

    # Confirm initialization created both the previously absent parent and file.
    assert temporary_path.parent.is_dir()
    assert temporary_path.is_file()

    # Confirm initialization creates every current SQLite model table, including status tracking.
    assert set(inspect(temporary_engine).get_table_names()) == {
        "candidate",
        "resume",
        "resume_embedding",
        "job_description",
        "jd_analysis",
        "import_batch",
        "resume_ingestion_status",
        "job",
        "recruitment_request",
        "activity_event",
        "interview",  # Include the existing interview workflow table.
        "approval_request",  # Include the existing approval workflow table.
        "agent_trace",  # Include existing agent execution telemetry storage.
        "jd_segmentation",  # Include Phase 3 JD segmentation table.
        "job_requirement",  # Include Phase 3 granular recruitment requirement table.
        "job_embedding",  # Include Phase 5B job embedding table.
    }


# Confirm repeating initialization preserves existing schema and remains idempotent.
def test_initialize_database_is_idempotent(isolated_sqlite) -> None:
    # Initialize the isolated database once and remember its registered table names.
    _, temporary_engine = isolated_sqlite
    sqlite_connection.initialize_database()
    first_tables = set(inspect(temporary_engine).get_table_names())

    # Initialize the same database again without dropping or replacing any tables.
    sqlite_connection.initialize_database()
    second_tables = set(inspect(temporary_engine).get_table_names())

    # Confirm both setup calls leave the same complete schema in place.
    assert second_tables == first_tables


# Confirm the public connectivity function returns true for the initialized database.
def test_sqlite_connectivity_test_returns_true(isolated_sqlite) -> None:
    """Execute the simple SELECT 1 check against an isolated local database."""

    # Initialize and verify the temporary database through the public helper.
    assert sqlite_connection.test_connection() is True


# Confirm the reusable session factory returns a session bound to the SQLite engine.
def test_sqlite_session_factory_creates_bound_session(isolated_sqlite) -> None:
    """Create and close a session without requiring application tables."""

    # Unpack the temporary engine associated with this test session.
    _, temporary_engine = isolated_sqlite

    # Create a session through the module-level reusable factory.
    database_session = sqlite_connection.SessionLocal()

    # Confirm the new session is bound to the temporary SQLite engine.
    assert database_session.get_bind() is temporary_engine

    # Close the session explicitly so the test leaves no open connection.
    database_session.close()
