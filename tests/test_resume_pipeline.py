# Import temporary-path, mock, pytest, and SQLAlchemy helpers for isolated pipeline coverage.
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
import httpx
import pytest
from sqlalchemy import create_engine, select, func
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker
# Import the extraction module and pipeline symbols under test.
from app import resume_extractor
from app import resume_pipeline
from app.resume_pipeline import ingest_resume_folder, prepare_resume_folder
# Import persisted SQLite models and the isolated declarative schema.
from database.models import Candidate, Resume, ResumeEmbedding, ResumeIngestionStatus
from database.sqlite_connection import Base, SQLITE_CONNECT_ARGS, _enable_sqlite_foreign_keys


# Create a temporary SQLite schema and session factory for each pipeline test.
@pytest.fixture
def ingestion_db(tmp_path):
    # Place the test database beneath pytest's isolated temporary workspace.
    engine = create_engine(URL.create("sqlite", database=str(tmp_path / "ingestion.db")), connect_args=SQLITE_CONNECT_ARGS)
    # Apply the production foreign-key rule to this private test engine.
    from sqlalchemy import event
    event.listen(engine, "connect", _enable_sqlite_foreign_keys)
    # Create all current tables only in the temporary test database.
    Base.metadata.create_all(engine)
    # Provide one session factory for independent read and write transactions.
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    # Yield the factory and release every database resource after the test.
    yield factory
    engine.dispose()


# Provide a deterministic embedding mock with explicit compatibility metadata.
class MockEmbeddingProvider:
    # Identify the model used by all synthetic vectors in these tests.
    model_name = "mock-embedding-model"
    # Initialize a fixed vector and capture safe provider input for privacy assertions.
    def __init__(self, vector=(1.0, 0.0), failure=None):
        self.vector = list(vector)
        self.failure = failure
        self.calls = 0
        self.last_input = None
    # Return a fresh vector or raise the requested synthetic provider error.
    def __call__(self, text):
        self.calls += 1
        self.last_input = text
        if self.failure is not None:
            raise self.failure
        return list(self.vector)


# Provide a sequential mock for timeout and HTTP rate-limit retry verification.
class RecoveringEmbeddingProvider:
    # Identify the configured test model for stored-vector compatibility checks.
    model_name = "mock-embedding-model"
    # Initialize transient failures and track provider attempts.
    def __init__(self, failures):
        self.failures = list(failures)
        self.calls = 0
    # Raise one configured transient error per attempt before returning a valid vector.
    def __call__(self, text):
        self.calls += 1
        if self.failures:
            raise self.failures.pop(0)
        return [1.0, 0.0]


# Write one synthetic resume file without placing personal data in test output.
def write_resume(folder: Path, filename: str, body: str) -> Path:
    # Ensure the test resume source directory exists before writing fixture text.
    folder.mkdir(parents=True, exist_ok=True)
    # Write the controlled UTF-8 payload used by the injected text extractor.
    path = folder / filename
    path.write_text(body, encoding="utf-8")
    # Return the source path for pipeline invocation and immutability checks.
    return path


# Verify local preparation creates tracked resume rows without calling the embedding provider.
def test_prepare_resume_folder_tracks_supported_unsupported_and_retries_without_embeddings(ingestion_db, tmp_path):
    # Create one readable supported text resume and one unsupported image placeholder.
    source = tmp_path / "prepare-source"
    resume_path = write_resume(source, "first.txt", "Name: Sample Candidate\nEmail: sample@example.test\nPython FastAPI")
    unsupported_path = write_resume(source, "unsupported.png", "not a resume")
    # Inject deterministic extraction so the test exercises orchestration without document dependencies.
    extractor = lambda path: {"status": "extracted", "text": Path(path).read_text(encoding="utf-8")}
    # Require explicit write authorization before preparing local SQLite records.
    with pytest.raises(PermissionError):
        prepare_resume_folder(source, ingestion_db, extractor=extractor)
    # Prepare records locally and confirm no provider is involved in this function contract.
    summary = prepare_resume_folder(source, ingestion_db, confirm_writes=True, extractor=extractor)
    # Confirm the supported file is represented while the unsupported file is status-only.
    assert summary.discovered == 2
    assert summary.prepared == 1
    assert summary.skipped == 1
    assert summary.imported == 0
    # Inspect persisted rows without exposing fixture identity through test output.
    with ingestion_db() as session:
        assert session.scalar(select(func.count()).select_from(Candidate)) == 1
        assert session.scalar(select(func.count()).select_from(Resume)) == 1
        assert session.scalar(select(func.count()).select_from(ResumeEmbedding)) == 0
        statuses = {Path(row.source_path).name: row for row in session.scalars(select(ResumeIngestionStatus)).all()}
        assert statuses[resume_path.name].status == "awaiting_embedding"
        assert statuses[resume_path.name].extraction_status == "extracted"
        assert statuses[resume_path.name].parsing_status == "parsed"
        assert statuses[resume_path.name].embedding_status == "awaiting_authorization"
        assert statuses[unsupported_path.name].status == "unsupported"
        assert statuses[unsupported_path.name].extraction_status == "unsupported"
    # Repeat the same source scan and verify successful preparation remains idempotent.
    repeated = prepare_resume_folder(source, ingestion_db, confirm_writes=True, extractor=extractor)
    assert repeated.prepared == 0
    assert repeated.skipped == 2
    with ingestion_db() as session:
        assert session.scalar(select(func.count()).select_from(Candidate)) == 1
        assert session.scalar(select(func.count()).select_from(Resume)) == 1
        assert session.scalar(select(func.count()).select_from(ResumeEmbedding)) == 0


# Extract synthetic PDF, DOCX, and TXT samples through their existing format branches.
def test_existing_extractor_handles_pdf_docx_and_txt(tmp_path, monkeypatch):
    # Create placeholder source files whose contents are read only by the test doubles.
    pdf_path = tmp_path / "synthetic.pdf"
    docx_path = tmp_path / "synthetic.docx"
    txt_path = tmp_path / "synthetic.txt"
    pdf_path.write_bytes(b"synthetic pdf")
    docx_path.write_bytes(b"synthetic docx")
    txt_path.write_text("Name: Demo Candidate\nPython", encoding="utf-8")
    # Replace the PDF reader with one predictable page and no external document content.
    monkeypatch.setattr(resume_extractor, "PdfReader", lambda path: SimpleNamespace(pages=[SimpleNamespace(extract_text=lambda: "Name: Demo Candidate\nPython")]))
    # Replace DOCX parsing with representative paragraph and table objects.
    monkeypatch.setattr(resume_extractor, "Document", lambda path: SimpleNamespace(paragraphs=[SimpleNamespace(text="Name: Demo Candidate")], tables=[]))
    # Confirm each existing branch reports extracted text without exposing source names.
    assert resume_extractor.extract_resume_text(pdf_path)["status"] == "extracted"
    assert resume_extractor.extract_resume_text(docx_path)["status"] == "extracted"
    assert resume_extractor.extract_resume_text(txt_path)["text"].endswith("Python")


# Parse a labeled identity, normalized email, and several curated technical skills.
def test_profile_parser_extracts_identity_and_skills():
    # Supply fully synthetic text and avoid using any project resume content.
    profile = resume_pipeline.parse_resume_profile("Name: Demo Candidate\nEmail: Demo.User@example.test\nPython FastAPI PostgreSQL AWS")
    # Confirm email normalization and stable canonical skill extraction.
    assert profile.name == "Demo Candidate"
    assert profile.email == "demo.user@example.test"
    assert profile.skills == ("AWS", "FastAPI", "PostgreSQL", "Python")


# Confirm experience and location are stored only when explicitly labeled in the resume.
def test_profile_parser_does_not_infer_missing_experience_or_location():
    # Parse an unlabeled narrative and require unknown structured values.
    unstructured = resume_pipeline.parse_resume_profile("Demo Candidate\nWorked in Pune for five years\nPython")
    # Parse explicitly labeled values to verify supported extraction without inference.
    labeled = resume_pipeline.parse_resume_profile("Name: Demo Candidate\nExperience: 5.5 years\nLocation: Pune\nPython")
    assert unstructured.experience_years is None
    assert unstructured.location is None
    assert labeled.experience_years == 5.5
    assert labeled.location == "Pune"


# Confirm dry-run previews profile extraction without database or provider changes.
def test_dry_run_previews_without_writes_or_embedding_calls(tmp_path, ingestion_db):
    # Add one synthetic text resume and preserve its original bytes for comparison.
    resume_path = write_resume(tmp_path / "resumes", "one.txt", "Name: Demo Candidate\nEmail: demo@example.test\nPython")
    original_bytes = resume_path.read_bytes()
    # Track unexpected API use even though the preview should never request a vector.
    provider = MockEmbeddingProvider()
    # Run the default non-mutating preview against the isolated database.
    result = ingest_resume_folder(tmp_path / "resumes", ingestion_db, embedding_provider=provider)
    # Confirm the parser preview and zero-write behavior are visible in the summary.
    assert (result.discovered, result.imported, result.skipped, result.failed) == (1, 0, 0, 0)
    assert result.files[0].status == "preview_new_candidate"
    assert result.files[0].skills == ("Python",)
    assert provider.calls == 0
    assert resume_path.read_bytes() == original_bytes
    # Confirm all canonical and status tables remain empty after preview.
    with ingestion_db() as session:
        assert session.scalar(select(func.count()).select_from(Candidate)) == 0
        assert session.scalar(select(func.count()).select_from(Resume)) == 0
        assert session.scalar(select(func.count()).select_from(ResumeIngestionStatus)) == 0


# Confirm preview forecasts candidate email reuse and within-batch content duplicates.
def test_dry_run_previews_deduplication_within_the_batch(tmp_path, ingestion_db):
    # Create distinct resumes for one email plus a byte-identical duplicate path.
    folder = tmp_path / "resumes"
    first = write_resume(folder, "first.txt", "Name: Demo Candidate\nEmail: batch@example.test\nPython")
    write_resume(folder, "second.txt", "Name: Demo Candidate\nEmail: BATCH@example.test\nFastAPI")
    write_resume(folder, "copy.txt", first.read_text(encoding="utf-8"))
    # Use a provider mock to prove the preview performs no network-oriented work.
    provider = MockEmbeddingProvider()
    result = ingest_resume_folder(folder, ingestion_db, embedding_provider=provider)
    # Forecast one new candidate, one linked resume, and one duplicate without writing rows.
    assert [item.status for item in result.files] == [
        "preview_new_candidate",
        "skipped",
        "preview_existing_candidate",
    ]
    assert result.files[1].reason_code == "duplicate_content_in_batch"
    assert provider.calls == 0
    with ingestion_db() as session:
        assert session.scalar(select(func.count()).select_from(Resume)) == 0


# Confirm actual writes require an explicit confirmation flag independent of the CLI.
def test_actual_ingestion_requires_write_confirmation(tmp_path, ingestion_db):
    # Create a synthetic resume that must not be touched when confirmation is absent.
    write_resume(tmp_path / "resumes", "one.txt", "Name: Demo Candidate\nPython")
    # Reject a write-mode call without an explicit confirmation argument.
    with pytest.raises(PermissionError, match="explicit write confirmation"):
        ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False)


# Confirm unsupported extensions are reported as skipped instead of disappearing.
def test_unsupported_file_is_reported_and_statused(tmp_path, ingestion_db):
    # Create one unsupported spreadsheet fixture alongside the temporary database.
    write_resume(tmp_path / "resumes", "notes.csv", "not a resume")
    # Run a confirmed import with a mock provider that should not be called.
    provider = MockEmbeddingProvider()
    result = ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False, confirm_writes=True, embedding_provider=provider)
    # Confirm the file is explicitly skipped and the unsupported status is persisted.
    assert (result.imported, result.skipped, result.failed) == (0, 1, 0)
    assert result.files[0].reason_code == "unsupported_extension"
    assert provider.calls == 0
    with ingestion_db() as session:
        assert session.scalar(select(ResumeIngestionStatus)).status == "unsupported"


# Confirm duplicate file content is skipped before extraction and embedding.
def test_duplicate_resume_content_is_not_reimported(tmp_path, ingestion_db):
    # Create two separate paths with the same synthetic resume bytes.
    first_path = write_resume(tmp_path / "resumes", "first.txt", "Name: Demo Candidate\nEmail: demo@example.test\nPython")
    second_path = write_resume(tmp_path / "resumes", "second.txt", first_path.read_text(encoding="utf-8"))
    # Use one provider instance so the test can count calls across both files.
    provider = MockEmbeddingProvider()
    # Ingest both files and rely on the stored content digest for duplicate detection.
    result = ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False, confirm_writes=True, embedding_provider=provider)
    # Confirm exactly one resume is imported and the identical file is skipped.
    assert (result.discovered, result.imported, result.skipped, result.failed) == (2, 1, 1, 0)
    assert provider.calls == 1
    with ingestion_db() as session:
        assert session.scalar(select(func.count()).select_from(Candidate)) == 1
        assert session.scalar(select(func.count()).select_from(Resume)) == 1
        assert session.scalar(select(func.count()).select_from(ResumeEmbedding)) == 1


# Confirm multiple distinct resumes with one normalized email link to one candidate.
def test_same_email_links_multiple_resumes_to_one_candidate(tmp_path, ingestion_db):
    # Create two different resume bodies with the same normalized email address.
    write_resume(tmp_path / "resumes", "first.txt", "Name: Demo Candidate\nEmail: SAME@example.test\nPython")
    write_resume(tmp_path / "resumes", "second.txt", "Name: Demo Candidate\nEmail: same@example.test\nFastAPI")
    # Generate deterministic vectors without making real network requests.
    provider = MockEmbeddingProvider()
    # Import the two distinct content hashes through the actual per-file transactions.
    result = ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False, confirm_writes=True, embedding_provider=provider)
    # Confirm both resumes and vectors exist while one candidate owns both resumes.
    assert result.imported == 2
    assert provider.calls == 2
    with ingestion_db() as session:
        assert session.scalar(select(func.count()).select_from(Candidate)) == 1
        assert session.scalar(select(func.count()).select_from(Resume)) == 2
        assert session.scalar(select(func.count()).select_from(ResumeEmbedding)) == 2
        candidate = session.scalar(select(Candidate))
        assert candidate.email == "same@example.test"
        assert set(candidate.skills) == {"Python", "FastAPI"}


# Confirm identical names without matching emails never merge distinct candidates.
def test_candidate_deduplication_never_uses_name_alone(tmp_path, ingestion_db):
    # Create distinct resume content with the same name but no email identifiers.
    write_resume(tmp_path / "resumes", "first.txt", "Name: Demo Candidate\nPython")
    write_resume(tmp_path / "resumes", "second.txt", "Name: Demo Candidate\nFastAPI")
    # Use mocked vectors so the test remains independent of API configuration.
    provider = MockEmbeddingProvider()
    # Process both files under the explicit email-only candidate matching policy.
    result = ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False, confirm_writes=True, embedding_provider=provider)
    # Confirm equal names did not collapse either candidate or resume record.
    assert result.imported == 2
    with ingestion_db() as session:
        assert session.scalar(select(func.count()).select_from(Candidate)) == 2
        assert session.scalar(select(func.count()).select_from(Resume)) == 2


# Confirm embeddings and model metadata are persisted with the successful resume.
def test_embedding_vector_and_model_metadata_are_stored(tmp_path, ingestion_db):
    # Create a synthetic resume containing a direct identity for the privacy gate.
    write_resume(tmp_path / "resumes", "one.txt", "Name: Demo Candidate\nEmail: demo@example.test\nPython FastAPI")
    # Capture the provider input to confirm identifiers are removed before external calls.
    provider = MockEmbeddingProvider(vector=(0.6, 0.8))
    # Import through the production pipeline with a mocked embedding API response.
    result = ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False, confirm_writes=True, embedding_provider=provider)
    # Confirm the profile's parsed identifiers are not present in provider-bound text.
    assert result.imported == 1
    assert "Demo Candidate" not in provider.last_input
    assert "demo@example.test" not in provider.last_input
    with ingestion_db() as session:
        record = session.scalar(select(ResumeEmbedding))
        assert record.embedding_vector == [0.6, 0.8]
        assert record.dimensions == 2
        assert record.requested_model == "mock-embedding-model"
        assert record.preprocessing_version == "resume-pii-redaction-v1"


# Confirm a missing configured API key creates a visible failure without calling the provider.
def test_missing_api_key_is_recorded_without_provider_call(tmp_path, ingestion_db, monkeypatch):
    # Add a synthetic resume that would otherwise be eligible for embedding.
    write_resume(tmp_path / "resumes", "one.txt", "Name: Demo Candidate\nPython")
    # Mark the built-in provider credential as missing without showing any secret values.
    monkeypatch.setattr(resume_pipeline, "OPENROUTER_API_KEY", "")
    # Execute an explicitly confirmed run and require a safe missing-key error code.
    result = ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False, confirm_writes=True)
    assert result.failed == 1
    assert result.files[0].reason_code == "embedding_api_key_missing"
    with ingestion_db() as session:
        assert session.scalar(select(func.count()).select_from(Candidate)) == 0
        assert session.scalar(select(ResumeIngestionStatus)).status == "failed"


# Confirm provider failures are recorded and candidates are not partially created.
def test_embedding_api_failure_is_retryable(tmp_path, ingestion_db):
    # Create one eligible resume and a provider mock that raises a safe synthetic error.
    write_resume(tmp_path / "resumes", "one.txt", "Name: Demo Candidate\nPython")
    provider = MockEmbeddingProvider(failure=RuntimeError("synthetic provider failure"))
    # The service should turn the failure into a per-file status rather than abort the batch.
    result = ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False, confirm_writes=True, embedding_provider=provider)
    assert result.failed == 1
    assert result.files[0].status == "failed"
    with ingestion_db() as session:
        assert session.scalar(select(func.count()).select_from(Candidate)) == 0
        assert session.scalar(select(ResumeIngestionStatus)).attempts == 1


# Confirm transport timeouts and HTTP 429 rate limits receive bounded retries.
def test_embedding_rate_limit_and_timeout_retry_succeed(tmp_path, ingestion_db, monkeypatch):
    # Create one synthetic resume and mock a timeout followed by a zero-delay 429 response.
    write_resume(tmp_path / "resumes", "one.txt", "Name: Demo Candidate\nPython")
    request = httpx.Request("POST", "https://openrouter.invalid/embeddings")
    response = httpx.Response(429, request=request, headers={"Retry-After": "0"})
    rate_limit = httpx.HTTPStatusError("synthetic rate limit", request=request, response=response)
    provider = RecoveringEmbeddingProvider([httpx.ReadTimeout("synthetic timeout"), rate_limit])
    # Avoid real waiting while still exercising the bounded backoff branch.
    monkeypatch.setattr(resume_pipeline.time, "sleep", Mock())
    # Import after two temporary failures and verify the final embedding commits normally.
    result = ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False, confirm_writes=True, embedding_provider=provider)
    assert result.imported == 1
    assert provider.calls == 3
    with ingestion_db() as session:
        assert session.scalar(select(func.count()).select_from(ResumeEmbedding)) == 1


# Confirm provider output dimensions are validated before canonical records are written.
def test_invalid_embedding_dimensions_fail_before_writes(tmp_path, ingestion_db):
    # Create one resume and a provider whose vector violates the configured dimension count.
    write_resume(tmp_path / "resumes", "one.txt", "Name: Demo Candidate\nPython")
    provider = MockEmbeddingProvider(vector=(1.0, 0.0))
    # Require three dimensions so the two-value mock must be rejected safely.
    result = ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False, confirm_writes=True, embedding_provider=provider, expected_dimensions=3)
    assert result.failed == 1
    with ingestion_db() as session:
        assert session.scalar(select(func.count()).select_from(Candidate)) == 0
        assert session.scalar(select(func.count()).select_from(Resume)) == 0


# Confirm a storage failure rolls back candidate and resume inserts but records the failure.
def test_database_transaction_rolls_back_on_embedding_storage_failure(tmp_path, ingestion_db, monkeypatch):
    # Add a resume and return a valid synthetic vector before the database transaction.
    write_resume(tmp_path / "resumes", "one.txt", "Name: Demo Candidate\nPython")
    provider = MockEmbeddingProvider()
    # Simulate a database-side embedding failure after candidate and resume rows are pending.
    monkeypatch.setattr(resume_pipeline, "store_resume_embedding", Mock(side_effect=RuntimeError("synthetic storage failure")))
    # Run the import and require all canonical rows to roll back atomically.
    result = ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False, confirm_writes=True, embedding_provider=provider)
    assert result.failed == 1
    with ingestion_db() as session:
        assert session.scalar(select(func.count()).select_from(Candidate)) == 0
        assert session.scalar(select(func.count()).select_from(Resume)) == 0
        assert session.scalar(select(func.count()).select_from(ResumeEmbedding)) == 0
        assert session.scalar(select(ResumeIngestionStatus)).status == "failed"


# Confirm a failed file can be retried and its single status row counts both attempts.
def test_failed_resume_can_be_retried_without_duplicate_records(tmp_path, ingestion_db):
    # Create one resume with enough synthetic profile text for the parser.
    write_resume(tmp_path / "resumes", "one.txt", "Name: Demo Candidate\nEmail: retry@example.test\nPython")
    # Fail once, then use a good provider on the next run of the same source path.
    first = ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False, confirm_writes=True, embedding_provider=MockEmbeddingProvider(failure=RuntimeError("temporary failure")))
    second = ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False, confirm_writes=True, embedding_provider=MockEmbeddingProvider())
    # Confirm the retry succeeds and records one import plus two processing attempts.
    assert first.failed == 1
    assert second.imported == 1
    with ingestion_db() as session:
        status = session.scalar(select(ResumeIngestionStatus))
        assert status.attempts == 2
        assert status.status == "imported"
        assert session.scalar(select(func.count()).select_from(Candidate)) == 1
        assert session.scalar(select(func.count()).select_from(Resume)) == 1


# Confirm a DOC conversion failure is visible and never modifies its source file.
def test_doc_conversion_failure_is_reported_without_changing_source(tmp_path, ingestion_db):
    # Create one placeholder DOC file and retain its original bytes for safety assertions.
    doc_path = write_resume(tmp_path / "resumes", "legacy.doc", "synthetic doc bytes")
    original_bytes = doc_path.read_bytes()
    # Inject a converter that fails without invoking Windows Word automation.
    def failing_converter(source, output):
        # Simulate a conversion dependency failure using a non-sensitive exception.
        raise RuntimeError("synthetic converter failure")
    # Run the confirmed pipeline with an extractor stub that must never receive DOC bytes.
    result = ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False, confirm_writes=True, embedding_provider=MockEmbeddingProvider(), converter=failing_converter)
    # Confirm conversion failure is visible and leaves original document bytes intact.
    assert result.failed == 1
    assert result.files[0].reason_code == "doc_conversion_failed"
    assert doc_path.read_bytes() == original_bytes


# Confirm OCR-required PDFs are reported as failures without calling the embedding provider.
def test_ocr_required_pdf_is_reported(tmp_path, ingestion_db):
    # Create a placeholder PDF that the injected extractor classifies as image-only.
    write_resume(tmp_path / "resumes", "scan.pdf", "synthetic pdf bytes")
    # Return an explicit extraction state without reading or exposing any source content.
    extractor = Mock(return_value={"status": "ocr_required", "text": ""})
    provider = MockEmbeddingProvider()
    # Run the ingestion service and surface the unsupported OCR requirement clearly.
    result = ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False, confirm_writes=True, embedding_provider=provider, extractor=extractor)
    assert result.failed == 1
    assert result.files[0].reason_code == "ocr_required"
    assert provider.calls == 0


# Confirm dry-run extraction failures remain visible without persisting a status row.
def test_dry_run_failure_does_not_write_status(tmp_path, ingestion_db):
    # Add a supported PDF whose mocked extraction result requires unavailable OCR.
    write_resume(tmp_path / "resumes", "scan.pdf", "synthetic pdf bytes")
    # Return an explicit failure state without invoking a real document parser.
    extractor = Mock(return_value={"status": "ocr_required", "text": ""})
    # Run a default dry-run and verify the failure stays in the in-memory preview only.
    result = ingest_resume_folder(tmp_path / "resumes", ingestion_db, extractor=extractor)
    assert result.failed == 1
    assert result.files[0].reason_code == "ocr_required"
    with ingestion_db() as session:
        assert session.scalar(select(func.count()).select_from(ResumeIngestionStatus)) == 0


# Confirm corrupted PDF extraction errors become safe per-file failures.
def test_corrupted_pdf_is_reported_without_provider_call(tmp_path, ingestion_db):
    # Create bytes that cannot form a valid PDF document.
    write_resume(tmp_path / "resumes", "corrupt.pdf", "not a pdf document")
    # Use the real PDF extractor and a mock provider that must remain unused.
    provider = MockEmbeddingProvider()
    # Process the corrupt file and require a failure status without exposing parser details.
    result = ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False, confirm_writes=True, embedding_provider=provider)
    assert result.failed == 1
    assert result.files[0].status == "failed"
    assert provider.calls == 0
    with ingestion_db() as session:
        assert session.scalar(select(ResumeIngestionStatus)).status == "failed"


# Confirm file read failures are counted and persisted without aborting discovery.
def test_unreadable_resume_is_reported(tmp_path, ingestion_db, monkeypatch):
    # Create one supported path whose file hash operation will be simulated as unreadable.
    write_resume(tmp_path / "resumes", "unreadable.txt", "synthetic resume")
    # Replace the race-safe hasher with a permission failure without changing OS policies.
    monkeypatch.setattr(resume_pipeline, "_hash_file", Mock(side_effect=PermissionError("synthetic read denial")))
    # Process the directory and expose only the safe failure category.
    result = ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False, confirm_writes=True, embedding_provider=MockEmbeddingProvider())
    assert result.failed == 1
    assert result.files[0].reason_code == "file_read_permissionerror"
    with ingestion_db() as session:
        assert session.scalar(select(ResumeIngestionStatus)).status == "failed"


# Confirm newly stored records are directly searchable by the existing Phase 3 service.
def test_ingested_embedding_works_with_phase_three_search(tmp_path, ingestion_db):
    # Import existing search only after the temporary model schema has been created.
    from app.candidate_search_service import search_candidates
    # Add one resume with a skill that the Phase 3 result should expose.
    write_resume(tmp_path / "resumes", "search.txt", "Name: Demo Candidate\nEmail: search@example.test\nPython FastAPI")
    # Store one vector through the pipeline using a model-compatible mock provider.
    ingest_provider = MockEmbeddingProvider(vector=(1.0, 0.0))
    ingestion = ingest_resume_folder(tmp_path / "resumes", ingestion_db, dry_run=False, confirm_writes=True, embedding_provider=ingest_provider)
    # Search with a separate mock advertising the same model and a matching query direction.
    query_provider = MockEmbeddingProvider(vector=(1.0, 0.0))
    with ingestion_db() as session:
        results = search_candidates("Python API developer", session, query_provider)
    # Confirm the existing semantic service can rank the imported resume and its skills.
    assert ingestion.imported == 1
    assert len(results) == 1
    assert results[0].similarity == pytest.approx(1.0)
    assert "Python" in results[0].skills
