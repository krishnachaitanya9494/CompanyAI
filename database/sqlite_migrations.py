# Import Connection to describe the caller-owned SQLAlchemy migration connection.
from sqlalchemy.engine import Connection, Engine

# Define only the nullable storage columns added after the original SQLite schema.
_RESUME_EMBEDDING_COLUMNS = (
    ("embedding_vector", "JSON"),  # Keep old embedding rows readable without vector data.
    ("input_hash", "VARCHAR(64)"),  # Store the exact embedding-input SHA-256 digest.
    ("requested_model", "VARCHAR(255)"),  # Store the model identifier sent to the provider.
    ("returned_model", "VARCHAR(255)"),  # Store the model identifier returned by the provider.
    ("preprocessing_version", "VARCHAR(255)"),  # Record the embedding text preparation version.
    ("generation_method", "VARCHAR(64) DEFAULT 'provenance_unknown'"),  # Track provenance: nemotron_api vs provenance_unknown vs synthetic_fallback.
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

# Define additive columns for JobDescription for versioning, extraction, and OCR tracking.
_JOB_DESCRIPTION_COLUMNS = (
    # Incremental version identifier for revisions.
    ("version", "INTEGER NOT NULL DEFAULT 1"),
    # Extraction and pipeline status tracking.
    ("status", "VARCHAR(32) NOT NULL DEFAULT 'extracted'"),
    # Hash of normalized plain text for duplicate checks.
    ("normalized_text_hash", "VARCHAR(64)"),
    # Separate storage for extracted text.
    ("extracted_text", "TEXT"),
    # Lineage pointer to parent version.
    ("parent_jd_id", "INTEGER"),
    # Scanned PDF OCR indicator flag.
    ("ocr_needed", "INTEGER NOT NULL DEFAULT 0"),
)

# Define additive columns for Job operational metadata.
_JOB_METADATA_COLUMNS = (
    # Client or hiring organization name.
    ("client_name", "VARCHAR(255)"),
    # Job code or requisition identifier.
    ("job_code", "VARCHAR(64)"),
    # Work arrangement model (Remote, Hybrid, On-site).
    ("work_mode", "VARCHAR(64)"),
    # Contract or employment type.
    ("employment_type", "VARCHAR(64)"),
    # Stated compensation or salary band.
    ("salary_range", "VARCHAR(128)"),
    # Target headcount openings.
    ("openings_count", "INTEGER NOT NULL DEFAULT 1"),
    # Department or business unit.
    ("department", "VARCHAR(128)"),
    # Assigned recruiter or requisition owner.
    ("recruiter_owner", "VARCHAR(128)"),
    # Requisition urgency priority level.
    ("priority", "VARCHAR(32) NOT NULL DEFAULT 'Medium'"),
    # Ingestion source channel.
    ("source", "VARCHAR(64) NOT NULL DEFAULT 'manual_upload'"),
    # Revision version number.
    ("version", "INTEGER NOT NULL DEFAULT 1"),
    # Foreign key reference to underlying source JobDescription.
    ("job_description_id", "INTEGER"),
    # JD-synchronized mandatory skills for clean reapproval isolation.
    ("synced_mandatory_skills", "JSON"),
    # JD-synchronized preferred skills for clean reapproval isolation.
    ("synced_preferred_skills", "JSON"),
)

# Define additive columns for JobRequirement tracking provenance.
_JOB_REQUIREMENT_COLUMNS = (
    # Source origin: ai_model, heuristic_fallback, recruiter_added, recruiter_edited.
    ("source_origin", "VARCHAR(32) DEFAULT 'ai_extracted'"),
)

# Define additive columns for JDSegmentation for 12-section scope and deep intelligence data.
_JD_SEGMENTATION_COLUMNS = (
    ("structured_scope", "JSON"),
    ("intelligence_data", "JSON"),
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


# Add 12-section scope and deep intelligence data columns to jd_segmentation.
def migrate_jd_segmentation_columns(connection: Connection) -> tuple[str, ...]:
    table_info = connection.exec_driver_sql("PRAGMA table_info(jd_segmentation)").all()
    if not table_info:
        return ()
    existing_columns = {row[1] for row in table_info}
    added_columns: list[str] = []
    for column_name, column_type in _JD_SEGMENTATION_COLUMNS:
        if column_name in existing_columns:
            continue
        connection.exec_driver_sql(
            f"ALTER TABLE jd_segmentation ADD COLUMN {column_name} {column_type} NULL"
        )
        added_columns.append(column_name)
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


# Add 12-section scope and deep intelligence data columns to jd_segmentation.
def migrate_jd_segmentation_columns(connection: Connection) -> tuple[str, ...]:
    table_info = connection.exec_driver_sql("PRAGMA table_info(jd_segmentation)").all()
    if not table_info:
        return ()
    existing_columns = {row[1] for row in table_info}
    added_columns: list[str] = []
    for column_name, column_type in _JD_SEGMENTATION_COLUMNS:
        if column_name in existing_columns:
            continue
        connection.exec_driver_sql(
            f"ALTER TABLE jd_segmentation ADD COLUMN {column_name} {column_type} NULL"
        )
        added_columns.append(column_name)
    return tuple(added_columns)


# Add additive columns to job_description table without altering existing data.
def migrate_job_description_columns(connection: Connection) -> tuple[str, ...]:
    # Inspect the job_description table schema.
    table_info = connection.exec_driver_sql("PRAGMA table_info(job_description)").all()
    # If table does not exist yet, return cleanly.
    if not table_info:
        return ()
    # Collect existing column names.
    existing_columns = {row[1] for row in table_info}
    # Track newly added columns.
    added_columns: list[str] = []
    # Iterate through declared additive columns.
    for column_name, column_definition in _JOB_DESCRIPTION_COLUMNS:
        # Skip if column already present.
        if column_name in existing_columns:
            continue
        # Execute ALTER TABLE to add missing column.
        connection.exec_driver_sql(
            f"ALTER TABLE job_description ADD COLUMN {column_name} {column_definition}"
        )
        # Record added column name.
        added_columns.append(column_name)
    # Return tuple of added columns.
    return tuple(added_columns)


# Add additive columns to job table without dropping existing rows.
def migrate_job_metadata_columns(connection: Connection) -> tuple[str, ...]:
    # Inspect the job table schema.
    table_info = connection.exec_driver_sql("PRAGMA table_info(job)").all()
    # If table does not exist yet, return cleanly.
    if not table_info:
        return ()
    # Collect existing column names.
    existing_columns = {row[1] for row in table_info}
    # Track newly added columns.
    added_columns: list[str] = []
    # Iterate through declared additive columns.
    for column_name, column_definition in _JOB_METADATA_COLUMNS:
        # Skip if column already present.
        if column_name in existing_columns:
            continue
        # Execute ALTER TABLE to add missing column.
        connection.exec_driver_sql(
            f"ALTER TABLE job ADD COLUMN {column_name} {column_definition}"
        )
        # Record added column name.
        added_columns.append(column_name)
    # Return tuple of added columns.
    return tuple(added_columns)


# Add 12-section scope and deep intelligence data columns to jd_segmentation.
def migrate_jd_segmentation_columns(connection: Connection) -> tuple[str, ...]:
    table_info = connection.exec_driver_sql("PRAGMA table_info(jd_segmentation)").all()
    if not table_info:
        return ()
    existing_columns = {row[1] for row in table_info}
    added_columns: list[str] = []
    for column_name, column_type in _JD_SEGMENTATION_COLUMNS:
        if column_name in existing_columns:
            continue
        connection.exec_driver_sql(
            f"ALTER TABLE jd_segmentation ADD COLUMN {column_name} {column_type} NULL"
        )
        added_columns.append(column_name)
    return tuple(added_columns)


# Add additive columns to job_requirement table without altering existing requirements.
def migrate_job_requirement_columns(connection: Connection) -> tuple[str, ...]:
    # Inspect the job_requirement table schema.
    table_info = connection.exec_driver_sql("PRAGMA table_info(job_requirement)").all()
    if not table_info:
        return ()
    existing_columns = {row[1] for row in table_info}
    added_columns: list[str] = []
    for column_name, column_definition in _JOB_REQUIREMENT_COLUMNS:
        if column_name in existing_columns:
            continue
        connection.exec_driver_sql(
            f"ALTER TABLE job_requirement ADD COLUMN {column_name} {column_definition}"
        )
        added_columns.append(column_name)
    return tuple(added_columns)


# Add 12-section scope and deep intelligence data columns to jd_segmentation.
def migrate_jd_segmentation_columns(connection: Connection) -> tuple[str, ...]:
    table_info = connection.exec_driver_sql("PRAGMA table_info(jd_segmentation)").all()
    if not table_info:
        return ()
    existing_columns = {row[1] for row in table_info}
    added_columns: list[str] = []
    for column_name, column_type in _JD_SEGMENTATION_COLUMNS:
        if column_name in existing_columns:
            continue
        connection.exec_driver_sql(
            f"ALTER TABLE jd_segmentation ADD COLUMN {column_name} {column_type} NULL"
        )
        added_columns.append(column_name)
    return tuple(added_columns)


# Ensure job_embedding table and indexes exist without modifying existing tables or data.
def migrate_job_embedding_table(connection: Connection) -> tuple[str, ...]:
    # Check whether the job_embedding table exists.
    table_exists = connection.exec_driver_sql(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='job_embedding'"
    ).first()

    # If the table does not exist, create it with all required columns, constraints, and types.
    if not table_exists:
        connection.exec_driver_sql(
            """
            CREATE TABLE job_embedding (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                job_id INTEGER NOT NULL,
                segmentation_id INTEGER NOT NULL,
                requirement_id INTEGER,
                embedding_type VARCHAR(64) NOT NULL,
                input_hash VARCHAR(64) NOT NULL,
                model_name VARCHAR(255) NOT NULL DEFAULT 'nvidia/nemotron-3-embed-1b:free',
                dimensions INTEGER NOT NULL DEFAULT 2048,
                embedding_vector JSON NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_id) REFERENCES job (id) ON DELETE CASCADE,
                FOREIGN KEY (segmentation_id) REFERENCES jd_segmentation (id) ON DELETE CASCADE,
                FOREIGN KEY (requirement_id) REFERENCES job_requirement (id) ON DELETE CASCADE
            )
            """
        )

    # Ensure all required indexes exist for optimal query performance and deduplication lookups.
    connection.exec_driver_sql(
        "CREATE INDEX IF NOT EXISTS ix_job_embedding_job_id ON job_embedding (job_id)"
    )
    connection.exec_driver_sql(
        "CREATE INDEX IF NOT EXISTS ix_job_embedding_segmentation_id ON job_embedding (segmentation_id)"
    )
    connection.exec_driver_sql(
        "CREATE INDEX IF NOT EXISTS ix_job_embedding_requirement_id ON job_embedding (requirement_id)"
    )
    connection.exec_driver_sql(
        "CREATE INDEX IF NOT EXISTS ix_job_embedding_embedding_type ON job_embedding (embedding_type)"
    )
    connection.exec_driver_sql(
        "CREATE INDEX IF NOT EXISTS ix_job_embedding_input_hash ON job_embedding (input_hash)"
    )

    # Add generation_method column to job_embedding if missing.
    cols = connection.exec_driver_sql("PRAGMA table_info(job_embedding)").all()
    col_names = {c[1] for c in cols}
    if "generation_method" not in col_names:
        connection.exec_driver_sql(
            "ALTER TABLE job_embedding ADD COLUMN generation_method VARCHAR(64) DEFAULT 'provenance_unknown'"
        )

    # Return status indicator tuple.
    return ("job_embedding",) if not table_exists else ()


# Enforce SQLite partial unique indexes on job_embedding after inspecting for duplicates.
def migrate_job_embedding_uniqueness(connection: Connection) -> tuple[str, ...]:
    """Verify absence of duplicates and apply partial unique indexes to job_embedding."""
    # Confirm table exists before inspecting records or attempting index creation.
    table_exists = connection.exec_driver_sql(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'job_embedding'"
    ).first()
    # If the table does not exist yet, skip index creation safely.
    if not table_exists:
        return ()

    # Check for duplicate requirement-level embeddings before adding uniqueness constraint.
    duplicate_requirements = connection.exec_driver_sql(
        """
        SELECT segmentation_id, requirement_id, count(*) AS duplicate_count
        FROM job_embedding
        WHERE requirement_id IS NOT NULL
        GROUP BY segmentation_id, requirement_id
        HAVING duplicate_count > 1
        """
    ).fetchall()
    # Abort migration safely without modifying data if requirement duplicates exist.
    if duplicate_requirements:
        raise RuntimeError(
            f"Cannot create unique index on job_embedding: duplicate requirement embeddings detected: {duplicate_requirements}. "
            f"Preserving existing records and aborting migration safely."
        )

    # Check for duplicate full JD scope embeddings before adding uniqueness constraint.
    duplicate_full_jds = connection.exec_driver_sql(
        """
        SELECT segmentation_id, count(*) AS duplicate_count
        FROM job_embedding
        WHERE embedding_type = 'full_jd' AND requirement_id IS NULL
        GROUP BY segmentation_id
        HAVING duplicate_count > 1
        """
    ).fetchall()
    # Abort migration safely without modifying data if full JD duplicates exist.
    if duplicate_full_jds:
        raise RuntimeError(
            f"Cannot create unique index on job_embedding: duplicate full JD embeddings detected: {duplicate_full_jds}. "
            f"Preserving existing records and aborting migration safely."
        )

    # Create partial unique index guaranteeing at most one embedding per requirement within a segmentation.
    connection.exec_driver_sql(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_job_embedding_segmentation_requirement
        ON job_embedding (segmentation_id, requirement_id)
        WHERE requirement_id IS NOT NULL
        """
    )

    # Create partial unique index guaranteeing at most one full JD embedding per segmentation.
    connection.exec_driver_sql(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_job_embedding_segmentation_full_jd
        ON job_embedding (segmentation_id)
        WHERE embedding_type = 'full_jd' AND requirement_id IS NULL
        """
    )

    # Return registered index identifiers for migration auditing.
    return (
        "uq_job_embedding_segmentation_requirement",
        "uq_job_embedding_segmentation_full_jd",
    )


# Safely drop partial unique indexes to revert schema to previous unconstrained state.
def rollback_job_embedding_uniqueness(connection: Connection) -> tuple[str, ...]:
    """Safely drop partial unique indexes on job_embedding without touching stored table data."""
    # Drop granular requirement partial unique index if it exists.
    connection.exec_driver_sql("DROP INDEX IF EXISTS uq_job_embedding_segmentation_requirement")
    # Drop full JD scope partial unique index if it exists.
    connection.exec_driver_sql("DROP INDEX IF EXISTS uq_job_embedding_segmentation_full_jd")
    # Return reverted index identifiers.
    return ("uq_job_embedding_segmentation_requirement", "uq_job_embedding_segmentation_full_jd")


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
        # Extend job description table with versioning and extraction columns.
        jd_columns = migrate_job_description_columns(connection)
        # Extend job table with full recruitment metadata columns.
        job_columns = migrate_job_metadata_columns(connection)
        # Extend job requirement table with provenance origin column.
        req_columns = migrate_job_requirement_columns(connection)
        # Extend jd_segmentation table with 12-section scope and intelligence data.
        seg_columns = migrate_jd_segmentation_columns(connection)
        # Ensure job_embedding table and indexes exist idempotently.
        embedding_table = migrate_job_embedding_table(connection)
        # Enforce partial unique indexes on job_embedding scopes idempotently.
        uniqueness_indexes = migrate_job_embedding_uniqueness(connection)

    # Report every column added without changing or deleting any existing table rows.
    return (
        tuple(f"candidate.{name}" for name in candidate_columns)
        + tuple(f"resume_embedding.{name}" for name in embedding_columns)
        + tuple(f"resume_ingestion_status.{name}" for name in ingestion_columns)
        + tuple(f"job_description.{name}" for name in jd_columns)
        + tuple(f"job.{name}" for name in job_columns)
        + tuple(f"job_requirement.{name}" for name in req_columns)
        + tuple(f"jd_segmentation.{name}" for name in seg_columns)
        + tuple(f"table.{name}" for name in embedding_table)
        + tuple(f"index.{name}" for name in uniqueness_indexes)
    )
