"""Tests for local JD extraction, separation, provenance, and deduplication."""

import hashlib
import json
from pathlib import Path
from unittest.mock import Mock

import pytest

from app.jd_importer import (
    TAILORED_JD_TITLES,
    import_combined_jd_file,
    import_jd_document,
)


def _combined_source() -> tuple[bytes, list[bytes]]:
    """Build seven synthetic JD sections with unique content and separators."""
    sections = [
        f"{title}\r\n{'=' * len(title)}\r\nUnique JD body {index + 1}.\r\n".encode("utf-8")
        for index, title in enumerate(TAILORED_JD_TITLES)
    ]
    expected_sections = [
        section + (b"\r\n" if index + 1 < len(sections) else b"")
        for index, section in enumerate(sections)
    ]
    combined = b""
    for index, section in enumerate(sections):
        if index:
            combined += b"\r\n" + (b"#" * 80) + b"\r\n\r\n"
        combined += section
    return combined, expected_sections


def test_import_splits_seven_jds_exactly_and_records_provenance(
    tmp_path: Path,
) -> None:
    """Save exact section bytes separately and retain source traceability."""
    source_content, expected_sections = _combined_source()
    source_path = tmp_path / "All_7_Tailored_JDs.txt"
    source_path.write_bytes(source_content)
    output_directory = tmp_path / "data" / "jds"
    manifest_path = output_directory / "jd_sources.json"

    records = import_combined_jd_file(
        source_path,
        output_directory=output_directory,
        manifest_path=manifest_path,
    )

    assert len(records) == 7
    for index, (record, expected_content) in enumerate(zip(records, expected_sections)):
        saved_path = output_directory / Path(record["local_extracted_file_path"]).name
        saved_content = saved_path.read_bytes()
        assert saved_content == expected_content
        assert record["job_title"] == TAILORED_JD_TITLES[index]
        assert record["jd_id"] == f"JD-{index + 1:03d}"
        assert record["source_filename"] == "All_7_Tailored_JDs.txt"
        assert record["source_sha256"] == hashlib.sha256(source_content).hexdigest()
        assert record["content_sha256"] == hashlib.sha256(expected_content).hexdigest()
        assert record["import_status"] == "imported"
        assert "Unique JD body" in saved_content.decode("utf-8")
        assert f"Unique JD body {index + 1}." in saved_content.decode("utf-8")
        assert f"Unique JD body {((index + 1) % 7) + 1}." not in saved_content.decode("utf-8")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert len(manifest["sources"]) == 7
    assert manifest["sources"][0]["source_start_line"] == 1
    assert manifest["sources"][0]["local_extracted_file_path"].endswith(
        "jd_001_oracle_epm_hyperion_planning_consultant.txt"
    )


def test_reimport_is_idempotent_and_does_not_duplicate_manifest_records(
    tmp_path: Path,
) -> None:
    """Importing the same source again reuses its existing seven records."""
    source_content, _ = _combined_source()
    source_path = tmp_path / "All_7_Tailored_JDs.txt"
    source_path.write_bytes(source_content)
    manifest_path = tmp_path / "data" / "jds" / "jd_sources.json"
    output_directory = manifest_path.parent

    first_import = import_combined_jd_file(
        source_path, output_directory=output_directory, manifest_path=manifest_path
    )
    second_import = import_combined_jd_file(
        source_path, output_directory=output_directory, manifest_path=manifest_path
    )

    assert second_import == first_import
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert len(manifest["sources"]) == 7


@pytest.mark.parametrize("extension", [".txt", ".pdf", ".docx", ".doc"])
def test_single_jd_import_reuses_existing_extraction_and_conversion(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    extension: str,
) -> None:
    """Route supported formats through the existing extraction/conversion code."""
    source_path = tmp_path / f"sample{extension}"
    source_path.write_bytes(b"synthetic source file")
    extracted_text = "Synthetic local JD text."
    extract_mock = Mock(return_value={"status": "extracted", "text": extracted_text})
    monkeypatch.setattr("app.jd_importer.extract_resume_text", extract_mock)
    conversion_path = tmp_path / "converted" / "sample.docx"

    if extension == ".doc":
        monkeypatch.setattr(
            "app.word_converter.convert_doc_to_docx",
            Mock(return_value={"converted_path": str(conversion_path)}),
        )

    manifest_path = tmp_path / "jd_sources.json"
    output_directory = tmp_path / "jds"
    result = import_jd_document(
        source_path,
        jd_id="SAMPLE-1",
        job_title="Synthetic Engineer",
        output_directory=output_directory,
        manifest_path=manifest_path,
    )

    assert result["import_status"] == "imported"
    assert result["source_filename"] == source_path.name
    saved_path = output_directory / Path(result["local_extracted_file_path"]).name
    assert saved_path.read_text(encoding="utf-8") == extracted_text
    extract_mock.assert_called_once()
    expected_extraction_path = conversion_path if extension == ".doc" else source_path
    assert Path(extract_mock.call_args.args[0]) == expected_extraction_path


def test_content_hash_prevents_duplicate_jd_records(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Treat identical extracted JD text as a duplicate even with another ID."""
    source_a = tmp_path / "first.txt"
    source_b = tmp_path / "copy.txt"
    source_a.write_text("first source", encoding="utf-8")
    source_b.write_text("second source", encoding="utf-8")
    monkeypatch.setattr(
        "app.jd_importer.extract_resume_text",
        Mock(return_value={"status": "extracted", "text": "Same JD content."}),
    )
    manifest_path = tmp_path / "jd_sources.json"
    output_directory = tmp_path / "jds"

    original = import_jd_document(
        source_a,
        "JD-ORIGINAL",
        "Original title",
        output_directory=output_directory,
        manifest_path=manifest_path,
    )
    duplicate = import_jd_document(
        source_b,
        "JD-COPY",
        "Copied title",
        output_directory=output_directory,
        manifest_path=manifest_path,
    )

    assert original["import_status"] == "imported"
    assert duplicate["import_status"] == "duplicate"
    assert duplicate["duplicate_of"] == "JD-ORIGINAL"
    saved_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert len(saved_manifest["sources"]) == 1


def test_combined_import_rejects_missing_title_without_writing_manifest(
    tmp_path: Path,
) -> None:
    """Fail closed when the source is missing one of the seven JD boundaries."""
    source_path = tmp_path / "incomplete.txt"
    source_path.write_text("Only one section", encoding="utf-8")
    manifest_path = tmp_path / "jd_sources.json"

    with pytest.raises(ValueError, match="Expected one section titled"):
        import_combined_jd_file(
            source_path,
            output_directory=tmp_path / "jds",
            manifest_path=manifest_path,
        )

    assert not manifest_path.exists()
