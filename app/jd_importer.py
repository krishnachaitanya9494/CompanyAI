"""Import local job descriptions without sending their content to external APIs."""

from __future__ import annotations

import hashlib
import re
import tempfile
from pathlib import Path
from typing import Any

from app.jd_sources import (
    DEFAULT_MANIFEST_PATH,
    MANIFEST_SCHEMA_VERSION,
    PROJECT_ROOT,
    _read_manifest,
    _write_manifest,
)
from app.resume_extractor import extract_resume_text


# Keep imported JD text under the project's dedicated data directory.
DEFAULT_JD_DIRECTORY = PROJECT_ROOT / "data" / "jds"
_SAFE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")

# Use the exact heading text found in the supplied combined JDs document.
TAILORED_JD_TITLES = (
    "ORACLE EPM / HYPERION PLANNING CONSULTANT",
    "SIEMENS TEAMCENTER PLM CONSULTANT / ENGINEER",
    "PMO / PROJECT FINANCIAL MANAGEMENT CONSULTANT – SAP PS",
    "SAP CPI / INTEGRATION SUITE & PI/PO CONSULTANT",
    "JAVA PRODUCTION SUPPORT ENGINEER / APPLICATION SUPPORT ENGINEER",
    "SAP SECURITY & GRC CONSULTANT – S/4HANA / FIORI",
    "ORACLE FCCS / HFM CONSULTANT – FINANCIAL CONSOLIDATION",
)

# Record only domains stated in the source titles, not assumed employers.
_JD_DOMAINS = (
    "Oracle EPM / Hyperion",
    "Siemens Teamcenter / PLM",
    "PMO / SAP PS",
    "SAP Integration Suite / PI/PO",
    "Java Production Support",
    "SAP Security / GRC",
    "Oracle FCCS / HFM",
)

# Give the seven imported sections stable IDs and readable local filenames.
_JD_FILENAMES = (
    "jd_001_oracle_epm_hyperion_planning_consultant.txt",
    "jd_002_siemens_teamcenter_plm_consultant_engineer.txt",
    "jd_003_pmo_project_financial_management_sap_ps_consultant.txt",
    "jd_004_sap_cpi_integration_suite_pi_po_consultant.txt",
    "jd_005_java_production_support_application_support_engineer.txt",
    "jd_006_sap_security_grc_s4hana_fiori_consultant.txt",
    "jd_007_oracle_fccs_hfm_financial_consolidation_consultant.txt",
)


def _sha256(content: bytes) -> str:
    """Return the lowercase SHA-256 digest for a byte string."""
    return hashlib.sha256(content).hexdigest()


def _decode_line(line: bytes) -> str:
    """Decode one UTF-8 source line without its newline characters."""
    return line.decode("utf-8-sig").rstrip("\r\n")


def _split_combined_text(raw_content: bytes) -> list[dict[str, Any]]:
    """Split the known seven-title document while preserving section bytes."""
    lines = raw_content.splitlines(keepends=True)
    offsets: list[int] = []
    current_offset = 0
    decoded_lines: list[str] = []

    # Track every byte offset so saved sections remain byte-for-byte exact.
    for line in lines:
        offsets.append(current_offset)
        decoded_lines.append(_decode_line(line))
        current_offset += len(line)

    # Require every expected title exactly once to avoid silent content mixing.
    title_line_indexes: list[int] = []
    for title in TAILORED_JD_TITLES:
        matching_lines = [
            index
            for index, line in enumerate(decoded_lines)
            if line.strip() == title
        ]
        if len(matching_lines) != 1:
            raise ValueError(
                f"Expected one section titled '{title}', found {len(matching_lines)}."
            )
        title_line_indexes.append(matching_lines[0])

    if title_line_indexes != sorted(title_line_indexes):
        raise ValueError("The seven JD sections are not in the expected source order.")

    sections: list[dict[str, Any]] = []
    for index, title in enumerate(TAILORED_JD_TITLES):
        start_line_index = title_line_indexes[index]
        start_offset = offsets[start_line_index]

        # Exclude the hash-only visual divider that precedes the next JD.
        if index + 1 < len(TAILORED_JD_TITLES):
            next_title_line_index = title_line_indexes[index + 1]
            divider_indexes = [
                line_index
                for line_index in range(start_line_index + 1, next_title_line_index)
                if re.fullmatch(r"\s*#{3,}\s*", decoded_lines[line_index])
            ]
            end_line_index = divider_indexes[0] if divider_indexes else next_title_line_index
            end_offset = offsets[end_line_index]
            end_line_number = end_line_index
        else:
            end_offset = len(raw_content)
            end_line_number = len(lines)

        section_bytes = raw_content[start_offset:end_offset]
        if not section_bytes.strip():
            raise ValueError(f"JD section '{title}' has no content.")

        sections.append(
            {
                "job_title": title,
                "domain": _JD_DOMAINS[index],
                "jd_id": f"JD-{index + 1:03d}",
                "filename": _JD_FILENAMES[index],
                "content": section_bytes,
                "source_start_line": start_line_index + 1,
                "source_end_line": end_line_number,
            }
        )

    return sections


def _extract_document_text(source_path: Path) -> str:
    """Extract a supported local JD, reusing the existing resume modules."""
    extension = source_path.suffix.lower()
    if extension not in {".txt", ".pdf", ".docx", ".doc"}:
        raise ValueError("Supported JD files are TXT, PDF, DOCX, and DOC.")

    if extension == ".doc":
        # Convert legacy Word files in a temporary directory without overwriting.
        from app.word_converter import convert_doc_to_docx

        with tempfile.TemporaryDirectory(prefix="companyai-jd-convert-") as temp_dir:
            conversion = convert_doc_to_docx(source_path, temp_dir)
            extraction = extract_resume_text(conversion["converted_path"])
    else:
        # Reuse the existing PDF, DOCX, and TXT resume extraction logic.
        extraction = extract_resume_text(source_path)

    if extraction.get("status") != "extracted" or not extraction.get("text", "").strip():
        status = extraction.get("status", "unknown")
        raise ValueError(f"JD text extraction did not succeed (status: {status}).")
    return extraction["text"]


def _record_import(
    *,
    jd_id: str,
    job_title: str,
    company_name: str | None,
    domain: str | None,
    source_path: Path,
    source_hash: str,
    content: bytes,
    output_filename: str,
    output_directory: Path,
    manifest_path: Path,
    source_start_line: int | None = None,
    source_end_line: int | None = None,
) -> dict[str, Any]:
    """Save one JD file and persist its provenance unless it is a duplicate."""
    if not _SAFE_ID_PATTERN.fullmatch(jd_id):
        raise ValueError("JD ID contains unsupported characters.")
    if not job_title.strip() or not content.strip():
        raise ValueError("JD title and content must not be empty.")

    content_hash = _sha256(content)
    manifest = _read_manifest(manifest_path)
    records = manifest["sources"]

    # Return an existing same-ID record unchanged when the content is identical.
    for record in records:
        if record["jd_id"] == jd_id:
            if record.get("content_sha256") == content_hash:
                return record
            raise ValueError(f"JD ID {jd_id} already exists with different content.")

    # Use the content digest to prevent duplicates across filenames and IDs.
    for record in records:
        if record.get("content_sha256") == content_hash:
            return {
                "jd_id": jd_id,
                "job_title": job_title,
                "import_status": "duplicate",
                "duplicate_of": record["jd_id"],
                "content_sha256": content_hash,
            }

    output_directory.mkdir(parents=True, exist_ok=True)
    output_path = output_directory / output_filename
    if output_path.exists():
        existing_hash = _sha256(output_path.read_bytes())
        if existing_hash != content_hash:
            raise FileExistsError(f"Refusing to overwrite a different JD file: {output_path}")
    else:
        output_path.write_bytes(content)

    try:
        local_path = output_path.resolve().relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        local_path = str(output_path.resolve())

    record = {
        "jd_id": jd_id,
        "job_title": job_title,
        "company_name": company_name,
        "domain": domain,
        "source_type": "local_file",
        "source_filename": source_path.name,
        "source_path": str(source_path.resolve()),
        "source_sha256": source_hash,
        "source_start_line": source_start_line,
        "source_end_line": source_end_line,
        "local_extracted_file_path": local_path,
        "content_sha256": content_hash,
        "import_status": "imported",
    }
    records.append(record)
    manifest["schema_version"] = MANIFEST_SCHEMA_VERSION
    _write_manifest(manifest_path, manifest)
    return record


def import_combined_jd_file(
    source_file: str | Path,
    output_directory: str | Path = DEFAULT_JD_DIRECTORY,
    manifest_path: str | Path = DEFAULT_MANIFEST_PATH,
) -> list[dict[str, Any]]:
    """Split and import the seven titled JDs from one supported source file."""
    source_path = Path(source_file).expanduser().resolve(strict=True)
    if not source_path.is_file():
        raise FileNotFoundError(f"JD source file is not a regular file: {source_path}")

    source_hash = _sha256(source_path.read_bytes())
    if source_path.suffix.lower() == ".txt":
        # Split TXT bytes directly so wording, punctuation, and line endings survive.
        source_content = source_path.read_bytes()
    else:
        # Reuse existing extractors for PDF, DOCX, and legacy DOC source files.
        source_content = _extract_document_text(source_path).encode("utf-8")

    sections = _split_combined_text(source_content)
    results = []
    for section in sections:
        results.append(
            _record_import(
                jd_id=section["jd_id"],
                job_title=section["job_title"],
                company_name=None,
                domain=section["domain"],
                source_path=source_path,
                source_hash=source_hash,
                content=section["content"],
                output_filename=section["filename"],
                output_directory=Path(output_directory),
                manifest_path=Path(manifest_path),
                source_start_line=section["source_start_line"],
                source_end_line=section["source_end_line"],
            )
        )
    return results


def import_jd_document(
    source_file: str | Path,
    jd_id: str,
    job_title: str,
    company_name: str | None = None,
    domain: str | None = None,
    output_directory: str | Path = DEFAULT_JD_DIRECTORY,
    manifest_path: str | Path = DEFAULT_MANIFEST_PATH,
) -> dict[str, Any]:
    """Extract and import one local TXT, PDF, DOCX, or DOC job description."""
    source_path = Path(source_file).expanduser().resolve(strict=True)
    if not source_path.is_file():
        raise FileNotFoundError(f"JD source file is not a regular file: {source_path}")

    source_hash = _sha256(source_path.read_bytes())
    extracted_text = _extract_document_text(source_path)
    extracted_bytes = extracted_text.encode("utf-8")
    output_filename = f"{jd_id.lower().replace('-', '_')}.txt"
    return _record_import(
        jd_id=jd_id,
        job_title=job_title,
        company_name=company_name,
        domain=domain,
        source_path=source_path,
        source_hash=source_hash,
        content=extracted_bytes,
        output_filename=output_filename,
        output_directory=Path(output_directory),
        manifest_path=Path(manifest_path),
    )
