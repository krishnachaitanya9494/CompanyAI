
# Import os to read database configuration from environment variables.
import os

# Import Generator to describe the database session dependency.
from typing import Generator

# Import load_dotenv to load configuration from the .env file.
from dotenv import load_dotenv

# Import SQLAlchemy components for database connections and sessions.
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

# Load environment variables from the project's .env file.
load_dotenv()

# Read the PostgreSQL username from the environment.
DB_USER = os.getenv("DB_USER")

# Read the PostgreSQL password from the environment.
DB_PASSWORD = os.getenv("DB_PASSWORD")

# Read the PostgreSQL host, defaulting to the local computer.
DB_HOST = os.getenv("DB_HOST", "localhost")

# Read the PostgreSQL port, defaulting to port 5432.
DB_PORT = int(os.getenv("DB_PORT", "5432"))

# Read the name of our project database.
DB_NAME = os.getenv("DB_NAME")

# Stop execution if required database credentials are missing.
if not all([DB_USER, DB_PASSWORD, DB_NAME]):
    raise RuntimeError("Missing PostgreSQL configuration in .env")

# Build the database URL safely, including passwords with special characters.
DATABASE_URL = URL.create(
    # Select PostgreSQL with the Psycopg 3 driver.
    drivername="postgresql+psycopg",
    # Supply the PostgreSQL login username.
    username=DB_USER,
    # Supply the PostgreSQL login password.
    password=DB_PASSWORD,
    # Connect to the local PostgreSQL server.
    host=DB_HOST,
    # Connect through the configured PostgreSQL port.
    port=DB_PORT,
    # Select our CompanyAI project database.
    database=DB_NAME,
)

# Create the SQLAlchemy engine that manages database connections.
engine = create_engine(
    # Provide the PostgreSQL connection configuration.
    DATABASE_URL,
    # Enable connection health checks before reusing connections.
    pool_pre_ping=True,
)

# Create a reusable factory for PostgreSQL database sessions.
SessionLocal = sessionmaker(
    # Bind every session to our PostgreSQL engine.
    bind=engine,
    # Disable automatic commits after individual operations.
    autocommit=False,
    # Disable automatic flushing before every query.
    autoflush=False,
)

# Define the base class for future SQLAlchemy database models.
class Base(DeclarativeBase):
    # Keep the base class ready for our future database tables.
    pass

# Provide a database session to FastAPI endpoints when requested.
def get_db() -> Generator[Session, None, None]:
    # Create a new database session for the current request.
    db = SessionLocal()
    try:
        # Yield the session so the endpoint can use the database.
        yield db
    finally:
        # Always close the session after the request finishes.
        db.close()

# Test whether our application can communicate with PostgreSQL.
def test_connection() -> bool:
    # Open a temporary connection using the SQLAlchemy engine.
    with engine.connect() as connection:
        # Execute a simple SQL query to verify database communication.
        result = connection.execute(text("SELECT 1"))
        # Return True when PostgreSQL responds with the expected result.
        return result.scalar_one() == 1
