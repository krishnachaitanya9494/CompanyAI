"""Job Description (JD) text extraction and upload validation service for CompanyAI 2.0."""

# Import hashlib for SHA-256 integrity and duplicate-detection digests.
import hashlib
# Import re for regex-based text normalization and sanitization.
import re
# Import Path for safe filesystem path handling.
from pathlib import Path
# Import Any, Optional, Dict, Tuple from typing for robust type annotations.
from typing import Any, Optional, Dict, Tuple
# Import pypdf for PDF text extraction.
from pypdf import PdfReader
# Import Document from docx for Word docx extraction.
from docx import Document
# Import Session from sqlalchemy.orm to query duplicate records.
from sqlalchemy.orm import Session
# Import JobDescription and Job models for duplicate detection queries.
from database.models import JobDescription, Job

# Define maximum allowed file size (25 Megabytes).
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024

# Define supported file extensions for manual JD upload.
SUPPORTED_JD_EXTENSIONS = {".pdf", ".docx", ".txt"}

# Define magic byte signatures for MIME verification.
MAGIC_SIGNATURES = {
    ".pdf": b"%PDF",
    ".docx": b"PK\x03\x04",
}


def sanitize_filename(filename: str) -> str:
    """Sanitize uploaded filename to prevent directory traversal and invalid characters."""
    # Strip any directory path components.
    base_name = Path(filename).name
    # Remove control characters, quotes, and directory separators.
    cleaned = re.sub(r'[\/\\:\*\?"<>\|\x00-\x1f]', '_', base_name)
    # Strip leading dots or whitespace to avoid hidden files.
    cleaned = cleaned.strip(". ")
    # Fallback to default name if stripped completely.
    return cleaned if cleaned else "uploaded_job_description.txt"


def compute_normalized_text_hash(text: str) -> str:
    """Compute a SHA-256 digest of normalized text (lowercase, alphanumeric, collapsed spaces)."""
    # Convert text to lowercase.
    lowered = text.lower()
    # Replace non-alphanumeric characters with spaces so punctuation acts as word boundary.
    cleaned = re.sub(r'[^a-z0-9]', ' ', lowered)
    # Collapse all whitespace sequences to a single space and strip leading/trailing spaces.
    normalized = re.sub(r'\s+', ' ', cleaned).strip()
    # Compute and return SHA-256 hex digest.
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()


def validate_file_upload(filename: str, content_bytes: bytes) -> Dict[str, Any]:
    """Validate uploaded JD file size, extension, and binary signatures."""
    # Check file size against 25MB maximum limit.
    size_bytes = len(content_bytes)
    if size_bytes == 0:
        return {"valid": False, "error": "The uploaded file is empty (0 bytes)."}
    if size_bytes > MAX_FILE_SIZE_BYTES:
        return {
            "valid": False,
            "error": f"File size exceeds the 25 MB limit ({size_bytes / (1024 * 1024):.2f} MB).",
        }

    # Extract lowercase file extension.
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_JD_EXTENSIONS:
        return {
            "valid": False,
            "error": f"Unsupported file type '{extension}'. Supported formats are: PDF, DOCX, TXT.",
        }

    # Check magic byte signatures for binary formats.
    if extension == ".pdf":
        if not content_bytes.startswith(MAGIC_SIGNATURES[".pdf"]):
            return {"valid": False, "error": "Invalid PDF file: Missing %PDF file signature."}
    elif extension == ".docx":
        if not content_bytes.startswith(MAGIC_SIGNATURES[".docx"]):
            return {"valid": False, "error": "Invalid DOCX file: Missing ZIP/DOCX file signature."}
    elif extension == ".txt":
        # Disallow files with high concentration of null bytes (likely binary masked as txt).
        null_byte_count = content_bytes.count(b"\x00")
        if null_byte_count > 5:
            return {"valid": False, "error": "Invalid TXT file: Binary content detected."}

    return {"valid": True, "size_bytes": size_bytes, "extension": extension}


def extract_text_from_bytes(filename: str, content_bytes: bytes) -> Dict[str, Any]:
    """Extract readable text from file content bytes based on extension."""
    # Determine extension.
    extension = Path(filename).suffix.lower()
    extracted_text = ""
    is_scanned_pdf = False
    page_count = 0

    try:
        if extension == ".pdf":
            # Use io.BytesIO to read PDF in-memory without saving temporary files.
            import io
            pdf_stream = io.BytesIO(content_bytes)
            reader = PdfReader(pdf_stream)
            page_count = len(reader.pages)
            # Extract text page-by-page.
            text_pieces = []
            for page in reader.pages:
                page_text = page.extract_text() or ""
                text_pieces.append(page_text.strip())
            extracted_text = "\n\n".join([p for p in text_pieces if p]).strip()

            # Detect scanned PDF: pages exist but total extracted characters are less than 30.
            if page_count > 0 and len(extracted_text) < 30:
                is_scanned_pdf = True

        elif extension == ".docx":
            import io
            docx_stream = io.BytesIO(content_bytes)
            doc = Document(docx_stream)
            paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
            for table in doc.tables:
                for row in table.rows:
                    cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if cells:
                        paragraphs.append(" | ".join(cells))
            extracted_text = "\n\n".join(paragraphs).strip()

        elif extension == ".txt":
            try:
                extracted_text = content_bytes.decode("utf-8").strip()
            except UnicodeDecodeError:
                extracted_text = content_bytes.decode("latin-1", errors="replace").strip()

    except Exception as exc:
        return {
            "status": "failed",
            "error": f"Extraction error: {str(exc)}",
            "text": "",
            "character_count": 0,
            "word_count": 0,
            "ocr_needed": False,
        }

    # Determine status.
    if is_scanned_pdf:
        status = "ocr_required"
    elif not extracted_text:
        status = "empty_text"
    else:
        status = "extracted"

    words = len(extracted_text.split()) if extracted_text else 0

    return {
        "status": status,
        "text": extracted_text,
        "character_count": len(extracted_text),
        "word_count": words,
        "page_count": page_count,
        "ocr_needed": is_scanned_pdf,
    }


def check_for_duplicates(
    db: Session,
    content_sha256: str,
    normalized_text_hash: str,
) -> Optional[Dict[str, Any]]:
    """Check database for duplicate job descriptions by exact file hash or normalized text."""
    # Check exact content SHA256 match in JobDescription.
    exact_match = db.query(JobDescription).filter(
        JobDescription.content_sha256 == content_sha256
    ).first()

    if exact_match:
        # Locate corresponding operational job if linked.
        op_job = db.query(Job).filter(Job.job_description_id == exact_match.id).first()
        if not op_job:
            op_job = db.query(Job).filter(Job.title == exact_match.title).first()
        return {
            "is_duplicate": True,
            "duplicate_type": "exact_file_hash",
            "message": f"An identical file has already been uploaded for job '{exact_match.title}'.",
            "existing_jd_id": exact_match.id,
            "existing_job_id": op_job.id if op_job else None,
            "existing_title": exact_match.title,
            "created_at": exact_match.created_at.isoformat() if exact_match.created_at else None,
        }

    # Check normalized text match.
    if normalized_text_hash:
        text_match = db.query(JobDescription).filter(
            JobDescription.normalized_text_hash == normalized_text_hash
        ).first()

        if text_match:
            op_job = db.query(Job).filter(Job.job_description_id == text_match.id).first()
            if not op_job:
                op_job = db.query(Job).filter(Job.title == text_match.title).first()
            return {
                "is_duplicate": True,
                "duplicate_type": "normalized_text_match",
                "message": f"Matching JD content was previously uploaded for job '{text_match.title}'.",
                "existing_jd_id": text_match.id,
                "existing_job_id": op_job.id if op_job else None,
                "existing_title": text_match.title,
                "created_at": text_match.created_at.isoformat() if text_match.created_at else None,
            }

    return None
