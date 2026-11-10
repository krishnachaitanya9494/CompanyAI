"""Scan a local folder and record supported resume-file metadata."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

# Allow this script to run directly from any current working directory.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.resume_ingestion import DEFAULT_MANIFEST_PATH, scan_resume_folder


def main() -> int:
    """Parse command-line options and print a privacy-conscious scan summary."""
    parser = argparse.ArgumentParser(
        description=(
            "Scan a local folder for PDF, DOCX, DOC, and TXT resumes. "
            "Files are hashed but not parsed or uploaded."
        )
    )
    parser.add_argument(
        "folder",
        type=Path,
        help="Local folder to scan recursively.",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST_PATH,
        help=(
            "Local JSON metadata file "
            f"(default: {DEFAULT_MANIFEST_PATH})."
        ),
    )
    arguments = parser.parse_args()

    try:
        result = scan_resume_folder(arguments.folder, arguments.manifest)
    except (OSError, ValueError) as error:
        parser.exit(status=1, message=f"Resume scan failed: {error}\n")

    print(f"Resume folder: {result.root_path}")
    print(f"Metadata manifest: {result.manifest_path}")
    print(f"Files found: {result.total_files}")
    print(f"Supported resumes: {len(result.records)}")
    print(f"Ignored files: {result.ignored_files}")
    print(f"Unique resumes hashed: {result.ingested_count}")
    print(f"Duplicates detected: {result.duplicate_count}")
    print(f"Files that could not be hashed: {result.error_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
