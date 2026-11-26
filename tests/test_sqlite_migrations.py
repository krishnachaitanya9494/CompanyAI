# Import SQLAlchemy helpers for an isolated temporary migration database.
from sqlalchemy import create_engine, inspect, text
# Import URL to build a platform-safe temporary SQLite database URL.
from sqlalchemy.engine import URL
# Import the idempotent migration function for older resume_embedding tables.
from database.sqlite_migrations import migrate_candidate_match_score_availability, migrate_candidate_profile_columns, migrate_resume_embedding_storage, migrate_resume_ingestion_stage_columns


# Verify the migration adds nullable columns without discarding legacy references.
def test_resume_embedding_migration_preserves_legacy_row_and_is_idempotent(tmp_path):
    # Place the simulated legacy database in pytest's temporary directory.
    database_path = tmp_path / "legacy-schema.db"
    # Open a dedicated engine that cannot reach the project production database.
    engine = create_engine(URL.create("sqlite", database=str(database_path)))
    # Create the pre-migration table shape with the existing non-nullable fields.
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE resume_embedding ("
                "id INTEGER PRIMARY KEY, "
                "resume_id INTEGER NOT NULL UNIQUE, "
                "vector_id VARCHAR(255) NOT NULL UNIQUE, "
                "collection_name VARCHAR(255) NOT NULL, "
                "model_name VARCHAR(255) NOT NULL, "
                "dimensions INTEGER, "
                "embedding_metadata JSON NOT NULL, "
                "created_at DATETIME NOT NULL)"
            )
        )
        # Insert one legacy reference row to verify migration preserves its values.
        connection.execute(
            text(
                "INSERT INTO resume_embedding "
                "(id, resume_id, vector_id, collection_name, model_name, dimensions, embedding_metadata, created_at) "
                "VALUES (1, 7, 'legacy-vector', 'resume-profiles', 'legacy-model', 2048, '{}', '2026-01-01')"
            )
        )
    # Add all new nullable columns to the temporary legacy schema.
    with engine.begin() as connection:
        added = migrate_resume_embedding_storage(connection)
    # Confirm the migration adds the storage, cache, and generation_method columns.
    assert added == (
        "embedding_vector",
        "input_hash",
        "requested_model",
        "returned_model",
        "preprocessing_version",
        "generation_method",
    )
    # Confirm a second run recognizes the current schema and changes nothing.
    with engine.begin() as connection:
        assert migrate_resume_embedding_storage(connection) == ()
        # Read the legacy row after migration without exposing or changing project data.
        legacy_row = connection.execute(
            text(
                "SELECT vector_id, collection_name, model_name, dimensions, embedding_metadata, "
                "embedding_vector, input_hash, requested_model, returned_model, preprocessing_version "
                "FROM resume_embedding WHERE id = 1"
            )
        ).one()
    # Confirm all existing Chroma references and metadata remain unchanged.
    assert legacy_row[:5] == (
        "legacy-vector",
        "resume-profiles",
        "legacy-model",
        2048,
        "{}",
    )
    # Confirm the new columns are nullable and existing rows receive null values.
    assert legacy_row[5:] == (None, None, None, None, None)
    # Confirm SQLite exposes every new column in the temporary schema.
    assert {
        "embedding_vector",
        "input_hash",
        "requested_model",
        "returned_model",
        "preprocessing_version",
    }.issubset({column["name"] for column in inspect(engine).get_columns("resume_embedding")})
    # Dispose of temporary database connections after the assertions complete.
    engine.dispose()


# Verify ingestion-stage migration adds independent state columns without replacing source rows.
def test_resume_ingestion_stage_migration_preserves_rows_and_is_idempotent(tmp_path):
    # Create a private legacy SQLite database with the original tracking-table shape.
    engine = create_engine(URL.create("sqlite", database=str(tmp_path / "legacy-ingestion.db")))
    # Insert a prior status record before applying the additive schema migration.
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE resume_ingestion_status (id INTEGER PRIMARY KEY, source_path TEXT UNIQUE NOT NULL, content_sha256 VARCHAR(64), status VARCHAR(32) NOT NULL, attempts INTEGER NOT NULL, error_message TEXT, candidate_id INTEGER, resume_id INTEGER, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)"))
        connection.execute(text("INSERT INTO resume_ingestion_status (id, source_path, content_sha256, status, attempts, created_at, updated_at) VALUES (1, 'safe-path', 'a', 'failed', 2, '2026-01-01', '2026-01-01')"))
    # Add stage metadata without deleting or rewriting the earlier tracking record.
    with engine.begin() as connection:
        added = migrate_resume_ingestion_stage_columns(connection)
        preserved = connection.execute(text("SELECT source_path, status, attempts FROM resume_ingestion_status WHERE id=1")).one()
    # Confirm all four stage columns were added and prior tracking values remain intact.
    assert set(added) == {"source_extension", "extraction_status", "parsing_status", "embedding_status"}
    assert tuple(preserved) == ("safe-path", "failed", 2)
    # Confirm a second invocation does not try to add the same columns again.
    with engine.begin() as connection:
        assert migrate_resume_ingestion_stage_columns(connection) == ()
    # Release the isolated database after verifying idempotency.
    engine.dispose()


# Verify a migration run is harmless when the embedding table does not yet exist.
def test_resume_embedding_migration_skips_missing_table(tmp_path):
    # Create an empty temporary SQLite database rather than opening the project file.
    engine = create_engine(URL.create("sqlite", database=str(tmp_path / "empty.db")))
    # Return no additions when no embedding table has been created yet.
    with engine.begin() as connection:
        assert migrate_resume_embedding_storage(connection) == ()
    # Release the temporary database resources after the no-op check.
    engine.dispose()


# Verify additive candidate fields preserve existing rows and apply only once.
def test_candidate_profile_migration_preserves_existing_candidates(tmp_path):
    # Create an isolated database that contains the original candidate table shape.
    engine = create_engine(URL.create("sqlite", database=str(tmp_path / "candidate-legacy.db")))
    with engine.begin() as connection:
        # Build only the legacy columns that existed before profile APIs were added.
        connection.execute(text("CREATE TABLE candidate (id INTEGER PRIMARY KEY, name VARCHAR(255), email VARCHAR(320), skills JSON NOT NULL, created_at DATETIME NOT NULL)"))
        # Insert one synthetic row to verify additive changes preserve existing data.
        connection.execute(text("INSERT INTO candidate (id, name, email, skills, created_at) VALUES (1, 'Synthetic', 'synthetic@example.test', '[\"Python\"]', '2026-01-01')"))
    with engine.begin() as connection:
        # Add only the supported new nullable/defaulted fields to the old table.
        added = migrate_candidate_profile_columns(connection)
    assert added == ("phone", "experience_years", "location", "availability", "stage", "summary")
    with engine.begin() as connection:
        # Confirm a second migration call is a no-op and the original row still exists.
        assert migrate_candidate_profile_columns(connection) == ()
        preserved = connection.execute(text("SELECT name, email, skills, stage FROM candidate WHERE id = 1")).one()
    assert preserved == ("Synthetic", "synthetic@example.test", '["Python"]', "New")
    # Close the isolated migration database after its preservation checks.
    engine.dispose()


def test_match_score_availability_migration_preserves_history_and_is_idempotent(tmp_path):
    """Test the additive score flag only in a synthetic temporary database copy."""
    engine = create_engine(URL.create("sqlite", database=str(tmp_path / "legacy-match-history.db")))
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE candidate_job_match_result (id INTEGER PRIMARY KEY, overall_score INTEGER NOT NULL)"))
        connection.execute(text("INSERT INTO candidate_job_match_result (id, overall_score) VALUES (41, 73)"))
        assert migrate_candidate_match_score_availability(connection) == ("score_available",)
    with engine.begin() as connection:
        row = connection.execute(text("SELECT id, overall_score, score_available FROM candidate_job_match_result WHERE id = 41")).one()
        assert tuple(row) == (41, 73, 1)
        assert migrate_candidate_match_score_availability(connection) == ()
    engine.dispose()
