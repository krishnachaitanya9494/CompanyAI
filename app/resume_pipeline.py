# Import hashing, filesystem traversal, and path normalization for safe local processing.
import hashlib
import logging
import os
import time
from pathlib import Path
from tempfile import TemporaryDirectory
# Import callable and sequence contracts for injectable extraction and embedding providers.
from collections.abc import Callable, Sequence
# Import dataclasses for immutable, privacy-conscious processing reports.
from dataclasses import dataclass
# Import SQLAlchemy lookup helpers for email-based candidate deduplication.
from sqlalchemy import func, select
from sqlalchemy.orm import Session
# Import HTTPX exception types so only safe transient provider errors are retried.
import httpx
# Reuse the configured OpenRouter embedding service and model metadata.
from app.embedding_service import OPENROUTER_API_KEY, OPENROUTER_EMBEDDING_MODEL, generate_embedding
# Reuse the existing DOC converter and text extractor through lazy imports where needed.
from app.resume_extractor import extract_resume_text
# Reuse existing resume-file discovery constants and race-safe content hashing.
from app.resume_ingestion import SUPPORTED_RESUME_EXTENSIONS, _hash_file
# Reuse the local PII redaction gate before sending resume text to the embedding provider.
from app.resume_privacy import redact_pii, validate_outbound_text
# Reuse the candidate-profile parser and the existing SQLite storage/models.
from app.resume_profile_parser import ParsedResumeProfile, parse_resume_profile
from database.embedding_storage import store_resume_embedding, validate_embedding_vector
from database.models import Candidate, Resume, ResumeEmbedding, ResumeIngestionStatus


# Identify a safe processing failure without retaining source text or exception messages.
class ResumeProcessingError(ValueError):
    # Keep an explicit machine-readable error code for CLI summaries and status records.
    def __init__(self, code: str, message: str) -> None:
        # Initialize the normal exception message with a fixed, non-personal explanation.
        super().__init__(message)
        # Store the safe code separately so callers never need to log a raw exception.
        self.code = code


# Describe one processed file without exposing candidate names, emails, or resume text.
@dataclass(frozen=True)
class ResumeFileResult:
    # Number files in stable discovery order for a privacy-conscious CLI label.
    index: int
    # Report the lowercase source extension for operational triage.
    extension: str
    # Report imported, skipped, failed, or preview status for this file.
    status: str
    # Store an opaque reason code for safe failure and skip explanations.
    reason_code: str | None
    # Store only extracted skill names, which are safe to display in a preview.
    skills: tuple[str, ...]
    # Indicate whether parsing found a name without returning that personal value.
    has_name: bool
    # Indicate whether parsing found an email without returning that personal value.
    has_email: bool
    # Return canonical database identifiers only after an actual successful import.
    candidate_id: int | None = None
    resume_id: int | None = None


# Summarize one run without printing any source paths or candidate identity fields.
@dataclass(frozen=True)
class ResumeIngestionSummary:
    # Record whether the operation was a non-mutating preview or an actual import.
    dry_run: bool
    # Count every discovered regular file, including unsupported extensions.
    discovered: int
    # Count new candidate/resume/embedding sets committed successfully.
    imported: int
    # Count already-imported content, duplicates, and unsupported files.
    skipped: int
    # Count files that failed hashing, conversion, extraction, parsing, embedding, or storage.
    failed: int
    # Keep the per-file privacy-safe statuses available for the CLI and tests.
    files: tuple[ResumeFileResult, ...]
    # Count candidate and resume records prepared without requesting external embeddings.
    prepared: int = 0


# Walk one resume directory without following symlinks or silently swallowing access errors.
def discover_resume_files(folder: str | Path) -> list[Path]:
    # Resolve the user-selected root and require it to exist before traversal.
    root = Path(folder).expanduser().resolve(strict=True)
    # Reject ordinary files so directory traversal never guesses a parent folder.
    if not root.is_dir():
        raise NotADirectoryError("Resume source must be a directory.")
    # Collect regular non-symlink files in deterministic order.
    discovered: list[Path] = []
    # Turn walk errors into explicit failures instead of silently omitting directories.
    def raise_walk_error(error: OSError) -> None:
        # Surface only the exception type so local paths remain private in CLI output.
        raise OSError(f"Resume discovery failed ({type(error).__name__}).") from None
    # Traverse without following symlink directories so the selected root remains the boundary.
    for current_directory, directory_names, file_names in os.walk(
        root,
        followlinks=False,
        onerror=raise_walk_error,
    ):
        # Sort directory traversal and exclude symbolic links before descending.
        current_path = Path(current_directory)
        directory_names[:] = sorted(
            name for name in directory_names if not (current_path / name).is_symlink()
        )
        # Add sorted regular files while refusing linked files that point outside the tree.
        discovered.extend(
            current_path / file_name
            for file_name in sorted(file_names)
            if not (current_path / file_name).is_symlink()
            and (current_path / file_name).is_file()
        )
    # Return stable absolute paths for database status identity and predictable previews.
    return discovered


# Convert a local extraction result into a stable processing failure when text is unusable.
def _extract_text(
    path: Path,
    extractor: Callable[[str | Path], dict[str, object]],
    converter: Callable[[str | Path, str | Path], dict[str, object]] | None,
) -> str:
    # Convert legacy DOC files into a temporary DOCX without changing the original file.
    if path.suffix.lower() == ".doc":
        # Load the existing Word automation utility only when a DOC actually needs conversion.
        if converter is None:
            try:
                # Keep Windows-only Word automation optional for PDF, DOCX, and TXT users.
                from app.word_converter import convert_doc_to_docx as active_converter
            except (ImportError, OSError) as error:
                # Describe missing Word automation without leaking system paths or source content.
                raise ResumeProcessingError(
                    "doc_conversion_unavailable",
                    "Legacy DOC conversion is unavailable on this system.",
                ) from error
        else:
            # Allow tests and supported deployments to provide a controlled converter.
            active_converter = converter
        # Keep converted bytes in a temporary directory that is removed after extraction.
        with TemporaryDirectory(prefix="companyai-resume-") as temporary_directory:
            # Convert the original file to a new temporary DOCX output.
            try:
                # Keep converter failures inside this file's retryable processing outcome.
                conversion = active_converter(path, temporary_directory)
            except Exception as error:
                # Hide Word, COM, and path details while preserving a stable failure category.
                raise ResumeProcessingError(
                    "doc_conversion_failed",
                    "Legacy DOC conversion failed on this system.",
                ) from error
            # Require a successful conversion result and an explicit output path.
            converted_path = conversion.get("converted_path")
            if conversion.get("status") != "converted" or not isinstance(converted_path, str):
                raise ResumeProcessingError(
                    "doc_conversion_failed",
                    "Legacy DOC conversion did not produce a readable DOCX file.",
                )
            # Extract text from the temporary DOCX through the existing extractor.
            extraction = extractor(converted_path)
    elif path.suffix.lower() == ".pdf":
        # Temporarily suppress recoverable PDF cross-reference warnings from console output.
        pdf_logger = logging.getLogger("pypdf._reader")
        previous_log_level = pdf_logger.level
        pdf_logger.setLevel(logging.ERROR)
        try:
            # Extract selectable PDF text while leaving any raised parse error visible as a file status.
            extraction = extractor(path)
        finally:
            # Restore application logging so this local ingestion setting does not leak to callers.
            pdf_logger.setLevel(previous_log_level)
    else:
        # Extract supported DOCX or TXT content with the existing project utility.
        extraction = extractor(path)
    # Convert unsupported, OCR-required, and empty extraction outcomes into explicit failures.
    status = extraction.get("status")
    if status == "ocr_required":
        raise ResumeProcessingError("ocr_required", "This PDF needs OCR before it can be ingested.")
    if status == "conversion_required":
        raise ResumeProcessingError("doc_conversion_required", "Legacy DOC conversion is required.")
    if status == "unsupported_format":
        raise ResumeProcessingError("unsupported_format", "The text extractor does not support this format.")
    # Require actual non-whitespace text before profile parsing or any provider request.
    extracted_text = extraction.get("text")
    if status != "extracted" or not isinstance(extracted_text, str) or not extracted_text.strip():
        raise ResumeProcessingError("empty_text", "No readable resume text was extracted.")
    # Return trimmed text while retaining all source details only in process memory.
    return extracted_text.strip()


# Normalize one source path so repeated attempts update a single status row on Windows.
def _normalized_source_path(path: Path) -> str:
    # Resolve case and separator differences using the host platform's filesystem rules.
    return os.path.normcase(str(path.resolve()))


# Update one source status row within the caller's transaction.
def _upsert_status(
    session: Session,
    path: Path,
    status: str,
    content_hash: str | None,
    reason_code: str | None,
    candidate_id: int | None = None,
    resume_id: int | None = None,
    source_extension: str | None = None,
    extraction_status: str | None = None,
    parsing_status: str | None = None,
    embedding_status: str | None = None,
) -> None:
    # Locate the stable source-path status row without changing candidate or resume records.
    source_path = _normalized_source_path(path)
    record = session.scalar(
        select(ResumeIngestionStatus).where(ResumeIngestionStatus.source_path == source_path)
    )
    # Create a status row for the first attempt or update the existing retry record.
    if record is None:
        record = ResumeIngestionStatus(source_path=source_path, status=status, attempts=0)
        session.add(record)
    # Increment the attempt count for every persisted outcome, including duplicate skips.
    record.attempts += 1
    # Keep the latest digest and safe status values for changed files and retry reporting.
    record.content_sha256 = content_hash
    record.status = status
    record.error_message = reason_code
    record.candidate_id = candidate_id
    record.resume_id = resume_id
    # Keep the detected file format beside its independent processing stages.
    record.source_extension = source_extension or path.suffix.lower()
    # Store extraction state only when the caller has an explicit stage result.
    if extraction_status is not None:
        record.extraction_status = extraction_status
    # Store parser state independently from successful file text extraction.
    if parsing_status is not None:
        record.parsing_status = parsing_status
    # Store provider state independently from successful candidate and resume creation.
    if embedding_status is not None:
        record.embedding_status = embedding_status


# Save a safe failed or skipped outcome in an isolated transaction.
def _persist_outcome(
    session_factory: Callable[[], Session],
    path: Path,
    status: str,
    content_hash: str | None,
    reason_code: str | None,
    candidate_id: int | None = None,
    resume_id: int | None = None,
    source_extension: str | None = None,
    extraction_status: str | None = None,
    parsing_status: str | None = None,
    embedding_status: str | None = None,
) -> None:
    # Open an independent session so previous per-file transactions cannot leak across files.
    with session_factory() as session:
        # Commit only this file's latest status while leaving all other records untouched.
        with session.begin():
            _upsert_status(
                session,
                path,
                status,
                content_hash,
                reason_code,
                candidate_id,
                resume_id,
                source_extension,
                extraction_status,
                parsing_status,
                embedding_status,
            )


# Resolve one candidate by normalized email, deliberately never by name alone.
def _find_or_create_candidate(session: Session, profile: ParsedResumeProfile) -> Candidate:
    # Reuse an existing candidate only when the parsed profile supplies a usable email.
    candidate = None
    if profile.email:
        candidate = session.scalar(
            select(Candidate).where(func.lower(Candidate.email) == profile.email.casefold())
        )
    # Create a new candidate whenever no email match exists, including profiles without email.
    if candidate is None:
        candidate = Candidate(
            name=profile.name,
            email=profile.email,
            skills=list(profile.skills),
            experience_years=profile.experience_years,
            location=profile.location,
        )
        session.add(candidate)
        session.flush()
        return candidate
    # Fill a missing display name but never use name values to merge candidate records.
    if not candidate.name and profile.name:
        candidate.name = profile.name
    # Fill experience only when the existing profile lacks an explicit parsed value.
    if candidate.experience_years is None and profile.experience_years is not None:
        candidate.experience_years = profile.experience_years
    # Fill location only when an explicitly labeled parsed value is available.
    if not candidate.location and profile.location:
        candidate.location = profile.location
    # Merge newly observed skills without duplicating case-insensitive entries.
    existing_skills = list(candidate.skills or [])
    existing_keys = {skill.casefold() for skill in existing_skills if isinstance(skill, str)}
    candidate.skills = existing_skills + [
        skill for skill in profile.skills if skill.casefold() not in existing_keys
    ]
    # Return the same candidate so additional resumes link to its existing identity.
    return candidate


# Convert an unexpected exception into a stable safe error code without its message.
def _safe_error_code(error: Exception) -> str:
    # Preserve explicit pipeline categories for actionable retry and operator messages.
    if isinstance(error, ResumeProcessingError):
        return error.code
    # Avoid exposing provider response bodies, local paths, or source text in status records.
    return f"processing_{type(error).__name__.lower()}"


# Generate one vector with bounded retries for transient network and provider throttling failures.
def _generate_embedding_with_retry(
    provider: Callable[[str], Sequence[int | float]],
    text: str,
    *,
    max_attempts: int = 3,
) -> Sequence[int | float]:
    # Retry only short network failures and explicit transient provider status codes.
    retryable_statuses = {408, 429, 500, 502, 503, 504}
    # Make no more than the fixed attempt count so batch processing cannot stall indefinitely.
    for attempt in range(max_attempts):
        try:
            # Call the configured provider with the already-redacted text only.
            return provider(text)
        except Exception as error:
            # Retry transport errors such as timeouts and connection resets.
            retryable = isinstance(error, httpx.TransportError)
            # Retry only documented throttling and temporary server responses.
            if isinstance(error, httpx.HTTPStatusError):
                retryable = error.response.status_code in retryable_statuses
            # Re-raise permanent failures and the final transient failure to the per-file handler.
            if not retryable or attempt + 1 >= max_attempts:
                raise
            # Honor a numeric Retry-After value while bounding any provider-directed wait.
            retry_after = None
            if isinstance(error, httpx.HTTPStatusError):
                try:
                    retry_after = float(error.response.headers.get("Retry-After", ""))
                except (TypeError, ValueError):
                    retry_after = None
            # Use bounded exponential backoff when the response has no numeric retry hint.
            delay = min(30.0, max(0.0, retry_after)) if retry_after is not None else min(8.0, 0.5 * (2**attempt))
            # Wait briefly before the next provider attempt without logging response details.
            time.sleep(delay)
    # Keep the return type total even though the bounded retry loop always returns or raises.
    raise RuntimeError("Embedding retry loop ended unexpectedly.")


# Run a preview or confirmed resume import using one transaction per source file.
def ingest_resume_folder(
    folder: str | Path,
    session_factory: Callable[[], Session],
    *,
    dry_run: bool = True,
    confirm_writes: bool = False,
    embedding_provider: Callable[[str], Sequence[int | float]] | None = None,
    embedding_model: str | None = None,
    expected_dimensions: int | None = None,
    extractor: Callable[[str | Path], dict[str, object]] = extract_resume_text,
    converter: Callable[[str | Path, str | Path], dict[str, object]] | None = None,
) -> ResumeIngestionSummary:
    # Require a separate explicit confirmation flag before any persistent record writes.
    if not dry_run and not confirm_writes:
        raise PermissionError("Actual ingestion requires explicit write confirmation.")
    # Discover all regular files so unsupported extensions appear as visible skipped results.
    paths = discover_resume_files(folder)
    # Select the existing configured provider unless tests or callers inject a mock.
    provider = embedding_provider or generate_embedding
    # Resolve model metadata from the configured function or an explicit mock-provider identifier.
    active_model = embedding_model or getattr(provider, "model_name", None)
    if provider is generate_embedding:
        active_model = OPENROUTER_EMBEDDING_MODEL
    # Require model identity for stored vectors so future Phase 3 queries can verify compatibility.
    if not isinstance(active_model, str) or not active_model.strip():
        raise ValueError("Embedding model metadata is missing or unverifiable.")
    # Prepare privacy-safe item reports and aggregate run counters.
    file_results: list[ResumeFileResult] = []
    imported_count = 0
    skipped_count = 0
    failed_count = 0
    # Track content and email identities within previews to estimate this batch's deduplication.
    preview_hashes: set[str] = set()
    preview_emails: set[str] = set()
    # Process each file sequentially so each database transaction and error is isolated.
    for index, path in enumerate(paths, start=1):
        # Normalize the extension before applying the configured supported-format allowlist.
        extension = path.suffix.lower()
        if extension not in SUPPORTED_RESUME_EXTENSIONS:
            # Persist unsupported-file status only during an explicitly confirmed write run.
            if not dry_run:
                _persist_outcome(session_factory, path, "unsupported", None, "unsupported_extension")
            # Count the unsupported file as skipped and expose its reason without its name.
            skipped_count += 1
            file_results.append(ResumeFileResult(index, extension or "<none>", "skipped", "unsupported_extension", (), False, False))
            continue
        # Hash the file while checking that it did not change during the read.
        try:
            content_hash, _ = _hash_file(path)
        except OSError as error:
            # Keep file access failures visible and persist only a safe exception category.
            reason = f"file_read_{type(error).__name__.lower()}"
            if not dry_run:
                _persist_outcome(session_factory, path, "failed", None, reason)
            failed_count += 1
            file_results.append(ResumeFileResult(index, extension, "failed", reason, (), False, False))
            continue
        # Check exact content hashes before extraction or embedding to make retries idempotent.
        with session_factory() as session:
            existing_resume = session.scalar(
                select(Resume).where(Resume.content_sha256 == content_hash)
            )
            existing_candidate_id = existing_resume.candidate_id if existing_resume else None
            existing_resume_id = existing_resume.id if existing_resume else None
        # Detect duplicate content within a preview batch even though dry runs do not write rows.
        if dry_run and content_hash in preview_hashes:
            skipped_count += 1
            file_results.append(ResumeFileResult(index, extension, "skipped", "duplicate_content_in_batch", (), False, False))
            continue
        if existing_resume is not None:
            # Update the source status without creating a second resume or re-embedding content.
            if not dry_run:
                _persist_outcome(
                    session_factory,
                    path,
                    "duplicate",
                    content_hash,
                    "content_hash_already_imported",
                    existing_candidate_id,
                    existing_resume_id,
                )
            # Report the existing content match without displaying candidate identity information.
            skipped_count += 1
            file_results.append(ResumeFileResult(index, extension, "skipped", "duplicate_content", (), False, False, existing_candidate_id if not dry_run else None, existing_resume_id if not dry_run else None))
            continue
        # Extract, parse, redact, and validate the outbound vector text before writing canonical rows.
        try:
            extracted_text = _extract_text(path, extractor, converter)
            profile = parse_resume_profile(extracted_text)
            # Redact direct identifiers and parsed identity values before external embedding requests.
            identifiers = tuple(value for value in (profile.name, profile.email) if value)
            embedding_input = validate_outbound_text(redact_pii(extracted_text, identifiers))
            # Dry runs stop before provider calls so preview never consumes API credits.
            if dry_run:
                with session_factory() as session:
                    existing_candidate = None
                    if profile.email:
                        existing_candidate = session.scalar(
                            select(Candidate).where(func.lower(Candidate.email) == profile.email.casefold())
                        )
                # Treat a previous previewed file with the same email as the same planned candidate.
                already_planned = bool(profile.email and profile.email.casefold() in preview_emails)
                candidate_match = existing_candidate is not None or already_planned
                file_status = "preview_existing_candidate" if candidate_match else "preview_new_candidate"
                file_results.append(
                    ResumeFileResult(
                        index,
                        extension,
                        file_status,
                        "would_link_by_email" if candidate_match else "would_create_candidate",
                        profile.skills,
                        bool(profile.name),
                        bool(profile.email),
                    )
                )
                # Count a previewed digest so later identical files are shown as batch duplicates.
                preview_hashes.add(content_hash)
                # Track the normalized email for subsequent candidates in the same dry-run batch.
                if profile.email:
                    preview_emails.add(profile.email.casefold())
                continue
            # Fail clearly before HTTP work when the built-in provider has no configured credential.
            if provider is generate_embedding and (
                not OPENROUTER_API_KEY or OPENROUTER_API_KEY == "YOUR_OPENROUTER_API_KEY"
            ):
                raise ResumeProcessingError(
                    "embedding_api_key_missing",
                    "The configured embedding API key is unavailable.",
                )
            # Generate and validate exactly one embedding for this new resume's redacted text.
            vector = validate_embedding_vector(
                _generate_embedding_with_retry(provider, embedding_input),
                expected_dimensions,
            )
        except Exception as error:
            # Persist failures only during confirmed writes; previews must never alter any table.
            reason = _safe_error_code(error)
            if not dry_run:
                # Keep actual failures retryable without storing source content or raw exception text.
                _persist_outcome(session_factory, path, "failed", content_hash, reason)
            failed_count += 1
            file_results.append(ResumeFileResult(index, extension, "failed", reason, (), False, False))
            continue
        # Commit one candidate, resume, vector, and imported status atomically for this file.
        try:
            with session_factory() as session:
                with session.begin():
                    candidate = _find_or_create_candidate(session, profile)
                    resume = Resume(
                        candidate_id=candidate.id,
                        source_filename=path.name,
                        file_path=str(path.resolve()),
                        content_sha256=content_hash,
                    )
                    session.add(resume)
                    session.flush()
                    # Reuse the validated storage helper and preserve the exact configured model metadata.
                    store_resume_embedding(
                        session,
                        resume.id,
                        vector,
                        dimensions=len(vector),
                        input_hash=hashlib.sha256(embedding_input.encode("utf-8")).hexdigest(),
                        requested_model=active_model,
                        preprocessing_version="resume-pii-redaction-v1",
                        metadata={"source": "resume_ingestion", "privacy_redacted": True},
                    )
                    # Store the success status in the same transaction as the canonical records.
                    _upsert_status(
                        session,
                        path,
                        "imported",
                        content_hash,
                        None,
                        candidate.id,
                        resume.id,
                    )
                    candidate_id = candidate.id
                    resume_id = resume.id
            # Count only fully committed candidate, resume, embedding, and status transactions.
            imported_count += 1
            file_results.append(
                ResumeFileResult(
                    index,
                    extension,
                    "imported",
                    None,
                    profile.skills,
                    bool(profile.name),
                    bool(profile.email),
                    candidate_id,
                    resume_id,
                )
            )
        except Exception as error:
            # The file transaction has rolled back; record the failure in a separate safe transaction.
            reason = _safe_error_code(error)
            _persist_outcome(session_factory, path, "failed", content_hash, reason)
            failed_count += 1
            file_results.append(ResumeFileResult(index, extension, "failed", reason, (), False, False))
    # Return counts and per-file summaries without printing personal data or source paths.
    return ResumeIngestionSummary(
        dry_run=dry_run,
        discovered=len(paths),
        imported=imported_count,
        skipped=skipped_count,
        failed=failed_count,
        files=tuple(file_results),
    )


# Prepare SQLite candidate and resume rows locally while keeping vectors ungenerated.
def prepare_resume_folder(
    folder: str | Path,
    session_factory: Callable[[], Session],
    *,
    confirm_writes: bool = False,
    extractor: Callable[[str | Path], dict[str, object]] = extract_resume_text,
    converter: Callable[[str | Path, str | Path], dict[str, object]] | None = None,
) -> ResumeIngestionSummary:
    # Require a separate explicit confirmation before writing local candidate or status records.
    if not confirm_writes:
        raise PermissionError("Local preparation requires explicit write confirmation.")
    # Discover every regular file so supported and unsupported items both receive tracking rows.
    paths = discover_resume_files(folder)
    # Keep safe per-file outcomes and counts without returning paths or candidate identities.
    results: list[ResumeFileResult] = []
    prepared_count = 0
    skipped_count = 0
    failed_count = 0
    # Process files in stable order with one independent transaction per path.
    for index, path in enumerate(paths, start=1):
        # Normalize the current extension once for status rows and file result summaries.
        extension = path.suffix.lower()
        # Calculate source-file bytes hash before content parsing or database writes.
        try:
            content_hash, _ = _hash_file(path)
        except OSError as error:
            # Persist a retryable status even when the file cannot be hashed safely.
            reason = f"file_read_{type(error).__name__.lower()}"
            _persist_outcome(
                session_factory,
                path,
                "failed",
                None,
                reason,
                source_extension=extension,
                extraction_status="not_started",
                parsing_status="not_started",
                embedding_status="not_started",
            )
            failed_count += 1
            results.append(ResumeFileResult(index, extension, "failed", reason, (), False, False))
            continue
        # Resolve an existing status and path-linked resume before deciding whether to retry.
        normalized_path = _normalized_source_path(path)
        with session_factory() as session:
            prior_status = session.scalar(
                select(ResumeIngestionStatus).where(ResumeIngestionStatus.source_path == normalized_path)
            )
            stored_resumes = session.scalars(select(Resume)).all()
            path_resume = next(
                (resume for resume in stored_resumes if _normalized_source_path(Path(resume.file_path)) == normalized_path),
                None,
            )
            content_resume = session.scalar(
                select(Resume).where(Resume.content_sha256 == content_hash)
            )
            path_candidate_id = path_resume.candidate_id if path_resume else None
            path_resume_id = path_resume.id if path_resume else None
            prior_hash = prior_status.content_sha256 if prior_status else None
            prior_state = prior_status.status if prior_status else None
        # Skip unchanged terminal records so repeated preparation does not redo local extraction.
        if prior_status and prior_hash == content_hash and prior_state in {
            "awaiting_embedding",
            "legacy_embedding_unverified",
            "duplicate",
            "unsupported",
            "manual_review",
        }:
            skipped_count += 1
            results.append(ResumeFileResult(index, extension, "skipped", "already_prepared", (), False, False, path_candidate_id, path_resume_id))
            continue
        # Persist unsupported formats in the same tracking table without inventing resumes.
        if extension not in SUPPORTED_RESUME_EXTENSIONS:
            _persist_outcome(
                session_factory,
                path,
                "unsupported",
                content_hash,
                "unsupported_extension",
                source_extension=extension,
                extraction_status="unsupported",
                parsing_status="not_applicable",
                embedding_status="not_applicable",
            )
            skipped_count += 1
            results.append(ResumeFileResult(index, extension, "skipped", "unsupported_extension", (), False, False))
            continue
        # Extract local text through the existing PDF, DOCX, DOC-conversion, and TXT utilities.
        try:
            extracted_text = _extract_text(path, extractor, converter)
            # Parse only explicitly available profile facts without using names to merge candidates.
            profile = parse_resume_profile(extracted_text)
            # Run the same PII redaction and safety validation locally without sending text externally.
            identifiers = tuple(value for value in (profile.name, profile.email) if value)
            validate_outbound_text(redact_pii(extracted_text, identifiers))
        except Exception as error:
            # Keep failures retryable and preserve a path-linked legacy record when one exists.
            reason = _safe_error_code(error)
            _persist_outcome(
                session_factory,
                path,
                "failed",
                content_hash,
                reason,
                path_candidate_id,
                path_resume_id,
                extension,
                "failed",
                "not_completed",
                "not_started",
            )
            failed_count += 1
            results.append(ResumeFileResult(index, extension, "failed", reason, (), False, False, path_candidate_id, path_resume_id))
            continue
        # Commit resume identity reconciliation or new candidate and resume rows atomically.
        try:
            with session_factory() as session:
                with session.begin():
                    # Recheck identities inside the write transaction to make retries race-safe.
                    current_path_resume = session.scalar(
                        select(Resume).where(func.lower(Resume.file_path) == normalized_path.casefold())
                    )
                    if current_path_resume is None:
                        # Compare normalized paths in Python for Windows separator and case variants.
                        current_path_resume = next(
                            (resume for resume in session.scalars(select(Resume)).all() if _normalized_source_path(Path(resume.file_path)) == normalized_path),
                            None,
                        )
                    current_hash_resume = session.scalar(
                        select(Resume).where(Resume.content_sha256 == content_hash)
                    )
                    if current_path_resume is not None:
                        # Preserve the existing candidate-resume link while correcting its file-byte hash.
                        if current_path_resume.content_sha256 != content_hash and current_hash_resume is None:
                            current_path_resume.content_sha256 = content_hash
                        candidate_id = current_path_resume.candidate_id
                        resume_id = current_path_resume.id
                        has_vector = current_path_resume.embedding is not None and bool(current_path_resume.embedding.embedding_vector)
                        row_status = "legacy_embedding_unverified" if has_vector else "awaiting_embedding"
                        embedding_stage = "legacy_unverified" if has_vector else "awaiting_authorization"
                        result_status = "reconciled_existing"
                    elif current_hash_resume is not None:
                        # Link repeated file content to the existing canonical record without duplication.
                        candidate_id = current_hash_resume.candidate_id
                        resume_id = current_hash_resume.id
                        row_status = "duplicate"
                        embedding_stage = "duplicate_reference"
                        result_status = "duplicate"
                    else:
                        # Deduplicate candidates only by the existing normalized-email policy.
                        candidate = _find_or_create_candidate(session, profile)
                        resume = Resume(
                            candidate_id=candidate.id,
                            source_filename=path.name,
                            file_path=str(path.resolve()),
                            content_sha256=content_hash,
                        )
                        session.add(resume)
                        session.flush()
                        candidate_id = candidate.id
                        resume_id = resume.id
                        row_status = "awaiting_embedding"
                        embedding_stage = "awaiting_authorization"
                        result_status = "prepared"
                    # Link each discovered path to its exact local-stage result in this same commit.
                    _upsert_status(
                        session,
                        path,
                        row_status,
                        content_hash,
                        None,
                        candidate_id,
                        resume_id,
                        extension,
                        "extracted",
                        "parsed",
                        embedding_stage,
                    )
                    result_candidate_id = candidate_id
                    result_resume_id = resume_id
            # Count prepared or reconciled records separately from external embedding imports.
            if result_status in {"prepared", "reconciled_existing"}:
                prepared_count += 1
            elif result_status == "duplicate":
                skipped_count += 1
            # Report available skills and safe state without any personal profile values.
            results.append(
                ResumeFileResult(
                    index,
                    extension,
                    result_status,
                    "embedding_pending_approval" if result_status != "duplicate" else "duplicate_content",
                    profile.skills,
                    bool(profile.name),
                    bool(profile.email),
                    result_candidate_id,
                    result_resume_id,
                )
            )
        except Exception as error:
            # Roll back canonical writes first, then save the retryable failure independently.
            reason = _safe_error_code(error)
            _persist_outcome(
                session_factory,
                path,
                "failed",
                content_hash,
                reason,
                path_candidate_id,
                path_resume_id,
                extension,
                "extracted",
                "parsed",
                "failed",
            )
            failed_count += 1
            results.append(ResumeFileResult(index, extension, "failed", reason, (), False, False, path_candidate_id, path_resume_id))
    # Return the exact batch accounting without reporting names or sending external requests.
    return ResumeIngestionSummary(
        dry_run=False,
        discovered=len(paths),
        imported=0,
        skipped=skipped_count,
        failed=failed_count,
        files=tuple(results),
        prepared=prepared_count,
    )
