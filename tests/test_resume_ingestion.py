"""Tests for local resume discovery, hashing, duplicate detection, and metadata."""

import hashlib
import json
from pathlib import Path

import pytest

from app.resume_ingestion import scan_resume_folder


def test_scan_identifies_supported_files_and_records_metadata(
    tmp_path: Path,
) -> None:
    """Hash supported resume files and ignore unrelated file types."""
    resume_folder = tmp_path / "resumes"
    resume_folder.mkdir()
    pdf_resume = resume_folder / "Candidate.PDF"
    pdf_resume.write_bytes(b"synthetic pdf bytes")
    (resume_folder / "notes.csv").write_text("not a resume", encoding="utf-8")
    (resume_folder / "readme").write_text("no extension", encoding="utf-8")
    manifest_path = tmp_path / "metadata" / "resume_ingestion.json"

    result = scan_resume_folder(resume_folder, manifest_path)

    assert result.total_files == 3
    assert result.ignored_files == 2
    assert len(result.records) == 1
    record = result.records[0]
    assert record.relative_path == "Candidate.PDF"
    assert record.extension == ".pdf"
    assert record.size_bytes == len(b"synthetic pdf bytes")
    assert record.sha256 == hashlib.sha256(b"synthetic pdf bytes").hexdigest()
    assert record.status == "ingested"
    assert record.duplicate_of is None
    assert result.ingested_count == 1
    assert result.duplicate_count == 0
    assert result.error_count == 0

    saved_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert saved_manifest["schema_version"] == 1
    assert len(saved_manifest["files"]) == 1


def test_scan_detects_duplicates_in_folder_and_previous_manifest(
    tmp_path: Path,
) -> None:
    """Detect identical contents both within a scan and across separate scans."""
    first_folder = tmp_path / "first"
    first_folder.mkdir()
    first_file = first_folder / "original.docx"
    first_file.write_bytes(b"same resume content")
    manifest_path = tmp_path / "resume_ingestion.json"

    first_result = scan_resume_folder(first_folder, manifest_path)
    assert first_result.ingested_count == 1

    second_folder = tmp_path / "second"
    second_folder.mkdir()
    duplicate_file = second_folder / "copy.doc"
    duplicate_file.write_bytes(first_file.read_bytes())
    second_result = scan_resume_folder(second_folder, manifest_path)

    assert second_result.duplicate_count == 1
    assert second_result.records[0].duplicate_of == str(first_file)


def test_scan_preserves_first_seen_time_when_rescanning_file(
    tmp_path: Path,
) -> None:
    """Update scan metadata without resetting the original discovery time."""
    resume_folder = tmp_path / "resumes"
    resume_folder.mkdir()
    resume_file = resume_folder / "resume.txt"
    resume_file.write_text("synthetic resume", encoding="utf-8")
    manifest_path = tmp_path / "resume_ingestion.json"

    first_record = scan_resume_folder(resume_folder, manifest_path).records[0]
    second_record = scan_resume_folder(resume_folder, manifest_path).records[0]

    assert second_record.first_seen_at == first_record.first_seen_at
    assert second_record.last_scanned_at >= first_record.last_scanned_at
    assert second_record.status == "ingested"


def test_scan_does_not_follow_symbolic_linked_resume(
    tmp_path: Path,
) -> None:
    """Skip a linked file so scanning cannot escape the selected folder."""
    resume_folder = tmp_path / "resumes"
    resume_folder.mkdir()
    outside_file = tmp_path / "outside.txt"
    outside_file.write_text("synthetic resume", encoding="utf-8")
    linked_file = resume_folder / "linked.txt"

    try:
        linked_file.symlink_to(outside_file)
    except (NotImplementedError, OSError) as error:
        pytest.skip(f"Symbolic links are unavailable: {type(error).__name__}")

    result = scan_resume_folder(resume_folder, tmp_path / "manifest.json")

    assert result.total_files == 0
    assert result.records == ()


def test_scan_requires_an_existing_directory(tmp_path: Path) -> None:
    """Reject missing folders and paths that are not directories."""
    missing_folder = tmp_path / "missing"
    with pytest.raises(FileNotFoundError):
        scan_resume_folder(missing_folder, tmp_path / "manifest.json")

    ordinary_file = tmp_path / "file.txt"
    ordinary_file.write_text("not a folder", encoding="utf-8")
    with pytest.raises(NotADirectoryError):
        scan_resume_folder(ordinary_file, tmp_path / "manifest.json")


def test_scan_rejects_malformed_manifest(tmp_path: Path) -> None:
    """Report manifest corruption rather than overwriting unknown metadata."""
    resume_folder = tmp_path / "resumes"
    resume_folder.mkdir()
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text("{invalid", encoding="utf-8")

    with pytest.raises(ValueError, match="invalid JSON"):
        scan_resume_folder(resume_folder, manifest_path)
