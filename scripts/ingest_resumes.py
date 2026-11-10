# Import argparse for explicit preview, schema setup, and apply command options.
import argparse
# Import sqlite3 so preview can verify schema through a read-only database URI.
import sqlite3
# Import Path for a stable project-relative default resume directory.
from pathlib import Path
# Import the configured SQLite database path and session factory.
from database.sqlite_connection import DATABASE_PATH, SessionLocal, initialize_database
# Import the independent ingestion service and its privacy-safe report types.
from app.resume_pipeline import ResumeIngestionSummary, ingest_resume_folder


# Resolve the repository root from this script so commands work from any directory.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
# Require the initialized SQLite tables that the ingestion service reads and writes.
REQUIRED_TABLES = frozenset({"candidate", "resume", "resume_embedding", "resume_ingestion_status"})


# Check schema readiness without creating a missing database or changing its tables.
def _schema_is_ready() -> bool:
    # Refuse to create a new SQLite file during preview or before write confirmation.
    if not DATABASE_PATH.is_file():
        return False
    # Open the configured file through SQLite's read-only URI mode.
    connection = sqlite3.connect(DATABASE_PATH.resolve().as_uri() + "?mode=ro", uri=True)
    try:
        # Read only table names so the CLI never leaks schema data or candidate records.
        table_names = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        # Require all core ingestion tables before the service opens an ORM session.
        return REQUIRED_TABLES.issubset(table_names)
    finally:
        # Close the read-only connection before any optional confirmed workflow begins.
        connection.close()


# Print summary totals and per-file states without revealing personal candidate data.
def _print_summary(summary: ResumeIngestionSummary) -> None:
    # Distinguish preview estimates from committed import counts in the console report.
    planned_imports = sum(item.status.startswith("preview_") for item in summary.files)
    planned_candidates = sum(item.status == "preview_new_candidate" for item in summary.files)
    planned_links = sum(item.status == "preview_existing_candidate" for item in summary.files)
    duplicate_previews = sum(
        bool(item.reason_code and item.reason_code.startswith("duplicate_content"))
        for item in summary.files
    )
    print(f"Mode: {'dry run' if summary.dry_run else 'apply'}")
    print(f"Files discovered: {summary.discovered}")
    if summary.dry_run:
        print(f"New resumes previewed: {planned_imports}")
        print(f"New candidates previewed: {planned_candidates}")
        print(f"Resumes previewed for existing candidates: {planned_links}")
        print(f"Existing-content duplicates: {duplicate_previews}")
    else:
        print(f"Files imported: {summary.imported}")
    print(f"Files skipped: {summary.skipped}")
    print(f"Files failed: {summary.failed}")
    # Show an index and safe processing details for each file without displaying its path.
    for item in summary.files:
        print(f"File {item.index:03d} [{item.extension}]: {item.status}")
        if item.reason_code:
            print(f"  Reason: {item.reason_code}")
        if item.has_name or item.has_email:
            print(f"  Parsed identity fields: name={'yes' if item.has_name else 'no'}, email={'yes' if item.has_email else 'no'}")
        if item.skills:
            print(f"  Skills: {', '.join(item.skills)}")


# Parse options, require confirmation for writes, and invoke the reusable service.
def main(argv: list[str] | None = None) -> int:
    # Build a command parser whose default action is a no-write preview.
    parser = argparse.ArgumentParser(
        description="Preview or explicitly import PDF, DOCX, DOC, and TXT resumes into SQLite."
    )
    # Accept an optional local source directory with a project-relative default.
    parser.add_argument(
        "folder",
        nargs="?",
        type=Path,
        default=PROJECT_ROOT / "data" / "resumes",
        help="Resume folder to scan; defaults to data/resumes.",
    )
    # Require this flag before prompting for a separate exact write confirmation.
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Import records after typing the confirmation phrase shown by the CLI.",
    )
    # Offer explicit schema initialization as a separate operation from resume ingestion.
    parser.add_argument(
        "--initialize-db",
        action="store_true",
        help="Create missing SQLite model tables after a separate confirmation prompt.",
    )
    # Parse user-supplied arguments without relying on global process state in tests.
    arguments = parser.parse_args(argv)
    # Prevent combining schema setup with ingestion so each database write is explicit.
    if arguments.initialize_db and arguments.apply:
        parser.error("Use --initialize-db separately from --apply.")
    # Initialize schema only after an explicit initialization phrase is confirmed.
    if arguments.initialize_db:
        try:
            confirmation = input("This creates missing tables in the configured SQLite database. Type INITIALIZE to continue: ")
        except EOFError:
            confirmation = ""
        if confirmation != "INITIALIZE":
            print("Schema initialization cancelled; no database changes were made.")
            return 2
        initialized_path = initialize_database()
        print(f"SQLite schema initialized at: {initialized_path}")
        return 0
    # Verify the schema through read-only inspection before opening any ORM session.
    if not _schema_is_ready():
        print("SQLite schema is missing; run this command separately with --initialize-db first.")
        return 2
    # Require an explicit phrase after --apply before allowing per-file database writes.
    confirmed = False
    if arguments.apply:
        try:
            confirmation = input(
                "This sends redacted resume text to the configured embedding provider and writes SQLite records. "
                "Type INGEST to continue: "
            )
        except EOFError:
            confirmation = ""
        if confirmation != "INGEST":
            print("Resume ingestion cancelled; no database records were changed.")
            return 2
        confirmed = True
    # Run a preview by default or a confirmed apply through the same ingestion service.
    try:
        summary = ingest_resume_folder(
            arguments.folder,
            SessionLocal,
            dry_run=not arguments.apply,
            confirm_writes=confirmed,
        )
    except (OSError, ValueError, PermissionError) as error:
        # Print only fixed errors or exception types so source paths and content remain private.
        print(f"Resume ingestion could not start ({type(error).__name__}).")
        return 1
    # Display aggregate and per-file outcomes after the service returns.
    _print_summary(summary)
    # Return a nonzero exit status when at least one file failed processing.
    return 1 if summary.failed else 0


# Run the CLI only when invoked as a command-line module or script.
if __name__ == "__main__":
    # Return the status code to Windows PowerShell and automation callers.
    raise SystemExit(main())
