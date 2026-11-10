# Import lightweight CLI report types and pytest monkeypatch support.
from app.resume_pipeline import ResumeIngestionSummary
import pytest
# Import the CLI module and its argument entry point.
from scripts import ingest_resumes


# Confirm normal CLI invocation selects a no-write preview by default.
def test_cli_defaults_to_preview(tmp_path, monkeypatch, capsys):
    # Pretend the schema already exists so the CLI reaches the service call.
    monkeypatch.setattr(ingest_resumes, "_schema_is_ready", lambda: True)
    # Capture the service invocation and return an empty synthetic preview result.
    calls = []
    def fake_ingest(folder, session_factory, **options):
        calls.append((folder, options))
        return ResumeIngestionSummary(True, 0, 0, 0, 0, ())
    monkeypatch.setattr(ingest_resumes, "ingest_resume_folder", fake_ingest)
    # Invoke the command with a harmless temporary directory and no apply flag.
    assert ingest_resumes.main([str(tmp_path)]) == 0
    # Require dry-run semantics and no explicit write authorization.
    assert calls[0][1]["dry_run"] is True
    assert calls[0][1]["confirm_writes"] is False
    assert "Mode: dry run" in capsys.readouterr().out


# Confirm declining the CLI phrase prevents the ingestion service from running.
def test_cli_apply_decline_performs_no_writes(tmp_path, monkeypatch, capsys):
    # Make schema readiness independent from the user's actual SQLite database.
    monkeypatch.setattr(ingest_resumes, "_schema_is_ready", lambda: True)
    # Supply a refusal and a service spy that would expose an accidental invocation.
    monkeypatch.setattr("builtins.input", lambda prompt: "NO")
    ingest_spy = lambda *args, **kwargs: pytest.fail("Ingestion must not start after refusal")
    monkeypatch.setattr(ingest_resumes, "ingest_resume_folder", ingest_spy)
    # Require a cancelled result and confirm the refusal message contains no file data.
    assert ingest_resumes.main([str(tmp_path), "--apply"]) == 2
    assert "cancelled" in capsys.readouterr().out


# Confirm schema initialization also stops before DDL when its separate phrase is declined.
def test_cli_schema_initialization_requires_confirmation(monkeypatch, capsys):
    # Decline schema setup and intercept initialization to detect any attempted database write.
    monkeypatch.setattr("builtins.input", lambda prompt: "NO")
    monkeypatch.setattr(
        ingest_resumes,
        "initialize_database",
        lambda: pytest.fail("Schema initialization must not run after refusal"),
    )
    # Require a cancelled status without touching the configured database.
    assert ingest_resumes.main(["--initialize-db"]) == 2
    assert "no database changes" in capsys.readouterr().out
