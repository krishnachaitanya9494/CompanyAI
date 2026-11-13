"""Global pytest fixtures and test database isolation configuration for CompanyAI."""

# Import Path to handle absolute and relative filesystem paths safely.
from pathlib import Path

# Import tempfile to create isolated temporary working directories.
import tempfile

# Import sqlite3 to perform non-blocking, fully checkpointed database backups.
import sqlite3

# Import pytest for defining session and function test fixtures.
import pytest

# Import SQLAlchemy components for creating isolated SQLite engines and events.
from sqlalchemy import create_engine, event

# Import URL for constructing platform-neutral SQLite connection strings.
from sqlalchemy.engine import URL

# Import production SQLite module references that require isolation during tests.
from database import sqlite_connection

# Import the FastAPI application instance for dependency override management.
from app.main import app

# Import router modules whose file upload directories must be redirected during tests.
from app.routers import candidates, jobs

# Preserve the original production database path for restoration and configuration verification.
ORIGINAL_DATABASE_PATH = sqlite_connection.DATABASE_PATH

# Preserve the original production database URL.
ORIGINAL_DATABASE_URL = sqlite_connection.DATABASE_URL

# Preserve the original production SQLAlchemy engine.
ORIGINAL_ENGINE = sqlite_connection.engine

# Preserve the original production resume upload directory.
ORIGINAL_RESUMES_DIR = candidates.RESUMES_UPLOAD_DIR

# Preserve the original production job description upload directory.
ORIGINAL_JDS_DIR = jobs.JOB_DESCRIPTIONS_UPLOAD_DIR


@pytest.fixture(scope="session", autouse=True)
def isolated_test_database():
    """Create an isolated temporary SQLite database and redirected storage directories for tests."""

    # Allocate an isolated temporary directory on disk for the duration of the test session.
    temp_dir_obj = tempfile.TemporaryDirectory(prefix="companyai_test_session_")

    # Resolve the temporary directory path.
    temp_dir_path = Path(temp_dir_obj.name)

    # Establish the isolated SQLite database path inside the temporary directory.
    isolated_db_path = temp_dir_path / "companyai_test.db"

    # Open the production SQLite source database for snapshot backup.
    source_connection = sqlite3.connect(str(ORIGINAL_DATABASE_PATH))

    # Open the destination connection in the isolated temporary file.
    destination_connection = sqlite3.connect(str(isolated_db_path))

    # Perform a consistent online backup from the production SQLite file to the temporary database.
    source_connection.backup(destination_connection)

    # Close the destination connection handle following completion of the backup.
    destination_connection.close()

    # Close the source database connection handle.
    source_connection.close()

    # Construct the platform-safe SQLite URL pointing to the isolated temporary file.
    isolated_db_url = URL.create("sqlite", database=str(isolated_db_path))

    # Build a dedicated SQLAlchemy engine bound exclusively to the temporary database.
    isolated_engine = create_engine(
        isolated_db_url,
        connect_args=sqlite_connection.SQLITE_CONNECT_ARGS,
        pool_pre_ping=True,
    )

    # Register the foreign keys and busy timeout event hook on the isolated engine.
    event.listen(isolated_engine, "connect", sqlite_connection._enable_sqlite_foreign_keys)

    # Rebind the shared SessionLocal factory to the isolated engine in-place.
    sqlite_connection.SessionLocal.configure(bind=isolated_engine)

    # Update the module-level engine reference to point to the isolated engine.
    sqlite_connection.engine = isolated_engine

    # Update the module-level database path to point to the temporary database file.
    sqlite_connection.DATABASE_PATH = isolated_db_path

    # Update the module-level database URL to point to the temporary database.
    sqlite_connection.DATABASE_URL = isolated_db_url

    # Establish isolated temporary subdirectories for candidate resumes and job descriptions.
    isolated_resumes_dir = temp_dir_path / "resumes"
    isolated_jds_dir = temp_dir_path / "job_descriptions"
    isolated_resumes_dir.mkdir(parents=True, exist_ok=True)
    isolated_jds_dir.mkdir(parents=True, exist_ok=True)

    # Redirect candidate resume uploads to the isolated temporary resumes folder.
    candidates.RESUMES_UPLOAD_DIR = isolated_resumes_dir

    # Redirect job description uploads to the isolated temporary job descriptions folder.
    jobs.JOB_DESCRIPTIONS_UPLOAD_DIR = isolated_jds_dir

    # Define the dependency override function to yield sessions from the isolated database.
    def _override_get_db():
        # Open an isolated database session.
        session = sqlite_connection.SessionLocal()
        try:
            # Yield the isolated session to the requesting route or test.
            yield session
        finally:
            # Always close the session to avoid dangling SQLite connection locks.
            session.close()

    # Install the dependency override globally on the FastAPI application instance.
    app.dependency_overrides[sqlite_connection.get_db] = _override_get_db

    # Execute test session within a guarded try block to guarantee absolute resource cleanup.
    try:
        # Yield control and temporary environment metadata to pytest runners.
        yield {
            "temp_dir": temp_dir_path,
            "database_path": isolated_db_path,
            "engine": isolated_engine,
        }
    finally:
        # Dispose of all active connection pools on the isolated engine before teardown.
        isolated_engine.dispose()

        # Remove the global FastAPI dependency override upon completion of the test suite.
        app.dependency_overrides.pop(sqlite_connection.get_db, None)

        # Rebind SessionLocal to the original production engine.
        sqlite_connection.SessionLocal.configure(bind=ORIGINAL_ENGINE)

        # Restore the production engine reference on the sqlite_connection module.
        sqlite_connection.engine = ORIGINAL_ENGINE

        # Restore the production database path on the sqlite_connection module.
        sqlite_connection.DATABASE_PATH = ORIGINAL_DATABASE_PATH

        # Restore the production database URL on the sqlite_connection module.
        sqlite_connection.DATABASE_URL = ORIGINAL_DATABASE_URL

        # Restore the production resume upload folder on the candidates router.
        candidates.RESUMES_UPLOAD_DIR = ORIGINAL_RESUMES_DIR

        # Restore the production job description upload folder on the jobs router.
        jobs.JOB_DESCRIPTIONS_UPLOAD_DIR = ORIGINAL_JDS_DIR

        # Clean up and permanently remove the temporary directory and all test artifacts.
        temp_dir_obj.cleanup()


@pytest.fixture(autouse=True)
def ensure_test_isolation_and_handle_config_tests(request, isolated_test_database):
    """Ensure per-test database dependency safety and handle configuration assertion tests."""

    # Check whether the current test is verifying production module default configuration.
    if request.node.name == "test_sqlite_configuration_uses_project_path_and_fastapi_thread_setting":
        # Temporarily restore production module attributes for the assertion-only test.
        sqlite_connection.DATABASE_PATH = ORIGINAL_DATABASE_PATH
        sqlite_connection.DATABASE_URL = ORIGINAL_DATABASE_URL
        sqlite_connection.engine = ORIGINAL_ENGINE
        sqlite_connection.SessionLocal.configure(bind=ORIGINAL_ENGINE)
        try:
            # Execute the configuration test against production module attributes.
            yield
        finally:
            # Rebind back to the isolated test database immediately following the test.
            sqlite_connection.DATABASE_PATH = isolated_test_database["database_path"]
            sqlite_connection.DATABASE_URL = URL.create("sqlite", database=str(isolated_test_database["database_path"]))
            sqlite_connection.engine = isolated_test_database["engine"]
            sqlite_connection.SessionLocal.configure(bind=isolated_test_database["engine"])
    else:
        # Re-verify that the FastAPI dependency override is present if another test popped it.
        def _override_get_db():
            # Open an isolated session.
            session = sqlite_connection.SessionLocal()
            try:
                # Yield the session to the requesting route.
                yield session
            finally:
                # Close the session after request completion.
                session.close()

        # Re-attach the dependency override for each standard test.
        app.dependency_overrides[sqlite_connection.get_db] = _override_get_db

        # Execute the test.
        yield
