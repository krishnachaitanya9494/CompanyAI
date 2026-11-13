
"""Extract readable text from supported resume files."""

# Import Path to work safely with file and folder paths.
from pathlib import Path

# Import Any so the function can return a structured dictionary.
from typing import Any
# Import logging to configure third-party library log levels safely.
import logging

# Silence verbose non-fatal parsing warnings emitted by pypdf for damaged PDF streams.
logging.getLogger("pypdf").setLevel(logging.ERROR)

# Import pypdf to extract text from PDF documents without native DLLs.
from pypdf import PdfReader

# Import Document to read paragraphs and tables from DOCX files.
from docx import Document


# Define the file formats this extractor can process directly.
SUPPORTED_FORMATS = {".pdf", ".docx", ".txt"}


# Define one function that chooses the correct extraction method.
def extract_resume_text(file_path: str | Path) -> dict[str, Any]:
    """Extract text from a PDF, DOCX, or TXT resume."""

    # Convert the supplied path into a standard Path object.
    path = Path(file_path)

    # Check whether the requested resume file exists.
    if not path.is_file():
        raise FileNotFoundError(f"Resume file not found: {path}")

    # Read the file extension and convert it to lowercase.
    extension = path.suffix.lower()

    # Handle legacy DOC files separately because python-docx cannot read them.
    if extension == ".doc":
        return {
            "file_path": str(path),
            "file_type": extension,
            "status": "conversion_required",
            "text": "",
            "character_count": 0,
        }

    # Reject file formats that this first version does not support.
    if extension not in SUPPORTED_FORMATS:
        return {
            "file_path": str(path),
            "file_type": extension,
            "status": "unsupported_format",
            "text": "",
            "character_count": 0,
        }

    # Start with an empty string to collect the extracted resume text.
    extracted_text = ""

    # Extract text from a PDF document.
    if extension == ".pdf":

        # Open the PDF document and collect selectable text from every page.
        pdf_document = PdfReader(path)
        extracted_text = "\n".join(
            page.extract_text() or ""
            for page in pdf_document.pages
        )

    # Extract text from a Word DOCX document.
    elif extension == ".docx":

        # Open the Word document using python-docx.
        word_document = Document(path)

        # Collect text from all non-empty paragraphs.
        paragraphs = [
            paragraph.text
            for paragraph in word_document.paragraphs
            if paragraph.text.strip()
        ]

        # Collect text from every table in the Word document.
        for table in word_document.tables:

            # Visit each row in the current table.
            for row in table.rows:

                # Join the text from every cell in the current row.
                row_text = " | ".join(
                    cell.text.strip()
                    for cell in row.cells
                )

                # Add the non-empty table row to the paragraph collection.
                if row_text.strip():
                    paragraphs.append(row_text)

        # Combine the paragraph and table content into one text string.
        extracted_text = "\n".join(paragraphs)

    # Extract text from a plain-text TXT document.
    elif extension == ".txt":

        # Read the TXT file while replacing invalid UTF-8 characters safely.
        extracted_text = path.read_text(
            encoding="utf-8",
            errors="replace",
        )

    # Remove unnecessary whitespace from the beginning and end.
    extracted_text = extracted_text.strip()

    # Detect PDFs or documents that contain no extractable text.
    if not extracted_text:
        status = "ocr_required" if extension == ".pdf" else "empty_text"
    else:
        status = "extracted"

    # Return the extraction result and useful file metadata.
    return {
        "file_path": str(path),
        "file_type": extension,
        "status": status,
        "text": extracted_text,
        "character_count": len(extracted_text),
    }
