# Import Connection to describe the caller-owned SQLAlchemy migration connection.
from sqlalchemy.engine import Connection, Engine

# Define only the nullable storage columns added after the original SQLite schema.
_RESUME_EMBEDDING_COLUMNS = (
    ("embedding_vector", "JSON"),  # Keep old embedding rows readable without vector data.
    ("input_hash", "VARCHAR(64)"),  # Store the exact embedding-input SHA-256 digest.
    ("requested_model", "VARCHAR(255)"),  # Store the model identifier sent to the provider.
    ("returned_model", "VARCHAR(255)"),  # Store the model identifier returned by the provider.
    ("preprocessing_version", "VARCHAR(255)"),  # Record the embedding text preparation version.
)

# Define nullable candidate profile fields added after the original SQLite candidate table.
_CANDIDATE_PROFILE_COLUMNS = (
    # Candidate telephone contact field.
    ("phone", "VARCHAR(64)"),
    ("experience_years", "FLOAT"),
    ("location", "VARCHAR(255)"),
    ("availability", "VARCHAR(128)"),
    ("stage", "VARCHAR(64) NOT NULL DEFAULT 'New'"),
    ("summary", "TEXT"),
)

# Add file-stage tracking fields without rebuilding or replacing ingestion status rows.
_RESUME_INGESTION_STATUS_COLUMNS = (
    ("source_extension", "VARCHAR(16)"),
    ("extraction_status", "VARCHAR(32)"),
    ("parsing_status", "VARCHAR(32)"),
    ("embedding_status", "VARCHAR(32)"),
)


# Add missing nullable embedding columns while preserving every existing row and field.
def migrate_resume_embedding_storage(connection: Connection) -> tuple[str, ...]:
    # Read the current table definition through SQLite's built-in schema pragma.
    table_info = connection.exec_driver_sql("PRAGMA table_info(resume_embedding)").all()
    # Return cleanly when this database does not yet contain the embedding table.
    if not table_info:
        return ()
    # Build a set of current column names so repeated migration runs are idempotent.
    existing_columns = {row[1] for row in table_info}
    # Track only columns added by this invocation for clear operational reporting.
    added_columns: list[str] = []
    # Add each known column only when it is absent from the current schema.
    for column_name, column_type in _RESUME_EMBEDDING_COLUMNS:
        # Leave columns already created by the current ORM schema unchanged.
        if column_name in existing_columns:
            continue
        # Use only the module's fixed identifiers and nullable SQL types in this statement.
        connection.exec_driver_sql(
            f"ALTER TABLE resume_embedding ADD COLUMN {column_name} {column_type} NULL"
        )
        # Record the successful addition for the caller and its migration log.
        added_columns.append(column_name)
    # Return the added names, or an empty tuple when the schema was already current.
    return tuple(added_columns)


# Add nullable and defaulted profile fields without replacing existing candidate rows.
def migrate_candidate_profile_columns(connection: Connection) -> tuple[str, ...]:
    # Inspect the candidate schema before constructing any additive DDL.
    table_info = connection.exec_driver_sql("PRAGMA table_info(candidate)").all()
    # Leave databases without a candidate table unchanged until create_all runs.
    if not table_info:
        return ()
    # Track current columns so the migration is safe to run repeatedly.
    existing_columns = {row[1] for row in table_info}
    # Record only candidate fields added by this invocation.
    added_columns: list[str] = []
    # Add each fixed column definition only when the existing table lacks it.
    for column_name, column_definition in _CANDIDATE_PROFILE_COLUMNS:
        # Preserve all columns already created by a current or partially migrated schema.
        if column_name in existing_columns:
            continue
        # Use only the module's constant column definitions in this additive statement.
        connection.exec_driver_sql(
            f"ALTER TABLE candidate ADD COLUMN {column_name} {column_definition}"
        )
        # Record the new column name for migration reporting and tests.
        added_columns.append(column_name)
    # Return the newly added names, or an empty tuple on an already-current schema.
    return tuple(added_columns)


# Add independent extraction, parsing, and embedding states to existing file-status rows.
def migrate_resume_ingestion_stage_columns(connection: Connection) -> tuple[str, ...]:
    # Inspect the tracking table before applying its fixed additive column definitions.
    table_info = connection.exec_driver_sql("PRAGMA table_info(resume_ingestion_status)").all()
    # Leave databases without the status table alone until metadata.create_all runs.
    if not table_info:
        return ()
    # Collect existing names so this migration remains safe to repeat.
    existing_columns = {row[1] for row in table_info}
    # Record only fields introduced by this migration invocation.
    added_columns: list[str] = []
    # Add each stage column only when it is missing from the existing SQLite schema.
    for column_name, column_type in _RESUME_INGESTION_STATUS_COLUMNS:
        # Preserve fields already present in a current or partially migrated database.
        if column_name in existing_columns:
            continue
        # Use only constant identifiers and SQL types from the module definition.
        connection.exec_driver_sql(
            f"ALTER TABLE resume_ingestion_status ADD COLUMN {column_name} {column_type} NULL"
        )
        # Keep a precise migration report for tests and local startup diagnostics.
        added_columns.append(column_name)
    # Return only new columns so repeated startup does not imply a new change.
    return tuple(added_columns)


# Create missing model tables and run additive migrations without dropping stored data.
def initialize_sqlite_schema(engine: Engine) -> tuple[str, ...]:
    # Import every SQLite model so SQLAlchemy registers its table definitions on Base.
    from database import models

    # Reuse the project's single declarative registry for all SQLite tables.
    from database.sqlite_connection import Base

    # Retain the import binding because it performs the required model registration.
    _ = models

    # Create only tables that do not already exist in the selected SQLite database.
    Base.metadata.create_all(bind=engine)

    # Apply known additive migrations within one database transaction.
    with engine.begin() as connection:
        # Add profile fields for candidate tables created by an older application version.
        candidate_columns = migrate_candidate_profile_columns(connection)
        # Keep the existing local embedding migration idempotent and data-preserving.
        embedding_columns = migrate_resume_embedding_storage(connection)
        # Extend file tracking while preserving all existing source-status rows.
        ingestion_columns = migrate_resume_ingestion_stage_columns(connection)

    # Report every column added without changing or deleting any existing table rows.
    return (
        tuple(f"candidate.{name}" for name in candidate_columns)
        + tuple(f"resume_embedding.{name}" for name in embedding_columns)
        + tuple(f"resume_ingestion_status.{name}" for name in ingestion_columns)
    )
