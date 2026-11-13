"""Manage CompanyAI's local SQLite database and reusable SQLAlchemy objects."""

# Import Path so the database file is anchored to the project rather than the shell.
from pathlib import Path

# Import Generator to type the FastAPI-compatible database dependency.
from typing import Generator

# Import SQLAlchemy's event hook, engine factory, and a harmless connectivity query.
from sqlalchemy import create_engine, event, text

# Import URL so Windows paths are encoded correctly in the SQLite URL.
from sqlalchemy.engine import URL

# Import the session factory, session type, and declarative model base.
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# Resolve the project root from this module's stable filesystem location.
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Store the local database under the project's data directory.
DATABASE_PATH = PROJECT_ROOT / "data" / "companyai.db"

# Build a SQLite URL from the absolute database path.
DATABASE_URL = URL.create("sqlite", database=str(DATABASE_PATH))

# Disable SQLite's per-thread connection restriction for FastAPI worker threads.
SQLITE_CONNECT_ARGS = {"check_same_thread": False}

# Create one shared SQLAlchemy engine without opening the database during import.
engine = create_engine(
    DATABASE_URL,
    connect_args=SQLITE_CONNECT_ARGS,
    pool_pre_ping=True,
)

# Enable SQLite foreign-key enforcement and busy timeout on each newly opened DBAPI connection.
@event.listens_for(engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection: object, connection_record: object) -> None:
    """Turn on SQLite foreign-key checks and set busy timeout for concurrency."""

    # Create a cursor from the SQLite DBAPI connection.
    cursor = dbapi_connection.cursor()

    # Enable declared foreign keys before any transaction begins.
    cursor.execute("PRAGMA foreign_keys=ON")

    # Set busy timeout so concurrent connections wait up to 10 seconds rather than locking immediately.
    cursor.execute("PRAGMA busy_timeout=10000")

    # Close the setup cursor while leaving the pooled DBAPI connection open.
    cursor.close()


# Create the reusable session factory for SQLite-backed application code.
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


# Define a separate declarative base for future SQLite models.
class Base(DeclarativeBase):
    """Provide metadata for tables that will be added in a later task."""

    # Keep this base empty until SQLite models are introduced.
    pass


# Create the database schema and confirm that SQLite can respond.
def initialize_database() -> Path:
    """Create missing SQLite tables, apply additive migrations, and check access."""

    # Create data/ or any missing parent folders before opening SQLite.
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Import schema setup lazily to avoid a module cycle through the ORM models.
    from database.sqlite_migrations import initialize_sqlite_schema

    # Create absent model tables and preserve existing tables and records.
    initialize_sqlite_schema(engine)

    # Execute a lightweight query after schema setup to verify SQLite access.
    with engine.connect() as connection:
        # Enable Write-Ahead Logging to permit concurrent reads and non-blocking transactions.
        connection.execute(text("PRAGMA journal_mode=WAL"))
        # Keep the health check independent of application data contents.
        connection.execute(text("SELECT 1"))

    # Return the configured location so callers can display it if needed.
    return DATABASE_PATH


# Provide a session dependency that FastAPI can close after each request.
def get_db() -> Generator[Session, None, None]:
    """Yield one SQLite session and always close it after use."""

    # Create a session from the shared SQLite session factory.
    database_session = SessionLocal()

    # Yield the session to the route or service that requested it.
    try:
        yield database_session
    # Close the session whether request handling succeeds or raises an error.
    finally:
        database_session.close()


# Check basic connectivity without creating application tables.
def test_connection() -> bool:
    """Return whether SQLite can execute a simple query successfully."""

    # Initialize the path first so this test also works on a fresh checkout.
    initialize_database()

    # Open a short-lived connection for the read-only connectivity query.
    with engine.connect() as connection:
        # Return true only when SQLite returns the expected scalar value.
        return connection.execute(text("SELECT 1")).scalar_one() == 1
