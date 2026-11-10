"""Local resume-folder scanning and ingestion metadata management."""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

# Limit ingestion to resume formats that later pipeline phases will parse.
SUPPORTED_RESUME_EXTENSIONS = frozenset({".pdf", ".docx", ".doc", ".txt"})
MANIFEST_SCHEMA_VERSION = 1
HASH_CHUNK_SIZE = 1024 * 1024
DEFAULT_MANIFEST_PATH = (
    Path(__file__).resolve().parent.parent
    / ".companyai"
    / "resume_ingestion.json"
)

IngestionStatus = Literal["ingested", "duplicate", "error"]


@dataclass(frozen=True)
class ResumeFileMetadata:
    """Describe a discovered resume without storing its contents."""

    source_path: str
    relative_path: str
    extension: str
    size_bytes: int | None
    modified_at: str | None
    sha256: str | None
    status: IngestionStatus
    duplicate_of: str | None
    error: str | None
    first_seen_at: str
    last_scanned_at: str


@dataclass(frozen=True)
class ResumeScanResult:
    """Summarize one folder scan and its supported resume records."""

    root_path: str
    manifest_path: str
    total_files: int
    ignored_files: int
    records: tuple[ResumeFileMetadata, ...]

    @property
    def ingested_count(self) -> int:
        """Return the number of unique, successfully hashed resumes."""
        return sum(record.status == "ingested" for record in self.records)

    @property
    def duplicate_count(self) -> int:
        """Return the number of files matching a known resume hash."""
        return sum(record.status == "duplicate" for record in self.records)

    @property
    def error_count(self) -> int:
        """Return the number of supported files that could not be hashed."""
        return sum(record.status == "error" for record in self.records)


def _utc_timestamp() -> str:
    """Return a timezone-aware ISO 8601 timestamp for the manifest."""
    return datetime.now(timezone.utc).isoformat()


def _path_key(path: Path) -> str:
    """Normalize absolute paths for reliable manifest lookups on Windows."""
    return os.path.normcase(str(path.resolve()))


def _discover_files(root: Path) -> tuple[list[Path], int]:
    """Find supported regular files without following symbolic links."""
    supported_files: list[Path] = []
    total_files = 0

    def raise_walk_error(error: OSError) -> None:
        """Surface directory traversal failures instead of silently skipping folders."""
        raise error

    for current_directory, directory_names, file_names in os.walk(
        root,
        followlinks=False,
        onerror=raise_walk_error,
    ):
        current_path = Path(current_directory)
        directory_names[:] = sorted(
            name
            for name in directory_names
            if not (current_path / name).is_symlink()
        )

        for file_name in sorted(file_names):
            file_path = current_path / file_name
            if file_path.is_symlink() or not file_path.is_file():
                continue

            total_files += 1
            if file_path.suffix.lower() in SUPPORTED_RESUME_EXTENSIONS:
                supported_files.append(file_path)

    return supported_files, total_files


def _load_manifest(manifest_path: Path) -> dict[str, ResumeFileMetadata]:
    """Load and validate prior ingestion metadata, if it exists."""
    if not manifest_path.exists():
        return {}

    try:
        manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValueError(
            f"Resume ingestion manifest contains invalid JSON: {manifest_path}"
        ) from error

    if (
        not isinstance(manifest_data, dict)
        or manifest_data.get("schema_version") != MANIFEST_SCHEMA_VERSION
        or not isinstance(manifest_data.get("files"), dict)
    ):
        raise ValueError(
            f"Resume ingestion manifest has an unsupported structure: {manifest_path}"
        )

    records: dict[str, ResumeFileMetadata] = {}
    for path_key, record_data in manifest_data["files"].items():
        if not isinstance(path_key, str) or not isinstance(record_data, dict):
            raise ValueError(
                f"Resume ingestion manifest contains an invalid file record: {manifest_path}"
            )
        try:
            records[path_key] = ResumeFileMetadata(**record_data)
        except TypeError as error:
            raise ValueError(
                f"Resume ingestion manifest contains an invalid file record: {manifest_path}"
            ) from error

    return records


def _save_manifest(
    manifest_path: Path,
    records: dict[str, ResumeFileMetadata],
) -> None:
    """Atomically persist metadata so an interrupted scan cannot corrupt it."""
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_data = {
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "files": {
            path_key: asdict(record)
            for path_key, record in sorted(records.items())
        },
    }

    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=manifest_path.parent,
            prefix=f"{manifest_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            json.dump(manifest_data, temporary_file, indent=2)
            temporary_file.write("\n")

        os.replace(temporary_path, manifest_path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()


def _hash_file(file_path: Path) -> tuple[str, os.stat_result]:
    """Hash a file in bounded memory and reject files changed during the read."""
    initial_stat = file_path.stat()
    hasher = hashlib.sha256()
    bytes_read = 0

    with file_path.open("rb") as resume_file:
        opened_stat = os.fstat(resume_file.fileno())
        if (
            opened_stat.st_size != initial_stat.st_size
            or opened_stat.st_mtime_ns != initial_stat.st_mtime_ns
        ):
            raise OSError("File changed before hashing began.")

        while chunk := resume_file.read(HASH_CHUNK_SIZE):
            hasher.update(chunk)
            bytes_read += len(chunk)

        final_stat = os.fstat(resume_file.fileno())

    if (
        bytes_read != initial_stat.st_size
        or final_stat.st_size != initial_stat.st_size
        or final_stat.st_mtime_ns != initial_stat.st_mtime_ns
    ):
        raise OSError("File changed while it was being hashed.")

    return hasher.hexdigest(), final_stat


def scan_resume_folder(
    folder_path: str | Path,
    manifest_path: str | Path = DEFAULT_MANIFEST_PATH,
) -> ResumeScanResult:
    """Scan a local folder, hash supported resumes, and persist metadata.

    The scanner never extracts file contents; it reads bytes only to calculate
    SHA-256 hashes and does not send files or metadata to external services.
    """
    root = Path(folder_path).expanduser().resolve(strict=True)
    if not root.is_dir():
        raise NotADirectoryError(f"Resume source is not a directory: {root}")

    manifest = Path(manifest_path).expanduser().resolve()
    discovered_files, total_files = _discover_files(root)
    existing_records = _load_manifest(manifest)

    current_path_keys = {_path_key(file_path) for file_path in discovered_files}
    known_hashes: dict[str, str] = {}
    for path_key, record in sorted(existing_records.items()):
        if path_key in current_path_keys or not record.sha256:
            continue
        canonical_path = (
            record.duplicate_of
            if record.status == "duplicate" and record.duplicate_of
            else record.source_path
        )
        known_hashes.setdefault(record.sha256, canonical_path)

    scanned_at = _utc_timestamp()
    scan_records: list[ResumeFileMetadata] = []

    for file_path in discovered_files:
        path_key = _path_key(file_path)
        previous_record = existing_records.get(path_key)
        relative_path = file_path.relative_to(root).as_posix()

        try:
            file_hash, file_stat = _hash_file(file_path)
            duplicate_path = known_hashes.get(file_hash)
            status: IngestionStatus = (
                "duplicate" if duplicate_path is not None else "ingested"
            )
            if duplicate_path is None:
                known_hashes[file_hash] = str(file_path)

            record = ResumeFileMetadata(
                source_path=str(file_path),
                relative_path=relative_path,
                extension=file_path.suffix.lower(),
                size_bytes=file_stat.st_size,
                modified_at=datetime.fromtimestamp(
                    file_stat.st_mtime,
                    tz=timezone.utc,
                ).isoformat(),
                sha256=file_hash,
                status=status,
                duplicate_of=duplicate_path,
                error=None,
                first_seen_at=(
                    previous_record.first_seen_at
                    if previous_record
                    else scanned_at
                ),
                last_scanned_at=scanned_at,
            )
        except OSError as error:
            # Keep failures explicit while avoiding OS messages that can expose local paths.
            record = ResumeFileMetadata(
                source_path=str(file_path),
                relative_path=relative_path,
                extension=file_path.suffix.lower(),
                size_bytes=None,
                modified_at=None,
                sha256=None,
                status="error",
                duplicate_of=None,
                error=f"Unable to read file ({type(error).__name__}).",
                first_seen_at=(
                    previous_record.first_seen_at
                    if previous_record
                    else scanned_at
                ),
                last_scanned_at=scanned_at,
            )

        existing_records[path_key] = record
        scan_records.append(record)

    _save_manifest(manifest, existing_records)

    return ResumeScanResult(
        root_path=str(root),
        manifest_path=str(manifest),
        total_files=total_files,
        ignored_files=total_files - len(discovered_files),
        records=tuple(scan_records),
    )
