
"""Convert legacy Microsoft Word DOC files into modern DOCX files."""

# Import Path to handle source and destination file paths safely.
from pathlib import Path

# Import Any for the function's structured dictionary return type.
from typing import Any

# Import win32com lazily so modules that do not require DOC conversion remain importable.
try:
    import win32com.client
except ModuleNotFoundError:  # pragma: no cover - exercised when Word automation is unavailable.
    win32com = None


# Define the Word file format number used when saving as DOCX.
WORD_DOCX_FORMAT = 16

# Define the Word option that closes a document without saving changes.
WORD_DO_NOT_SAVE = 0


# Define a function that converts one DOC file into a DOCX file.
def convert_doc_to_docx(
    source_path: str | Path,
    output_directory: str | Path,
) -> dict[str, Any]:
    """Convert a DOC resume and return its conversion details."""

    # Convert the supplied source path into a standard Path object.
    source = Path(source_path)

    # Convert the supplied output folder into a standard Path object.
    output_folder = Path(output_directory)

    # Check whether the original resume exists.
    if not source.is_file():
        raise FileNotFoundError(f"Source resume not found: {source}")

    # Ensure that the source file is a legacy DOC document.
    if source.suffix.lower() != ".doc":
        raise ValueError("Only legacy .doc files can be converted.")

    # Create the output folder and its parent folders if necessary.
    output_folder.mkdir(parents=True, exist_ok=True)

    # Build the destination filename using the original filename.
    destination = output_folder / f"{source.stem}.docx"

    # Prevent accidentally overwriting an existing converted resume.
    if destination.exists():
        raise FileExistsError(f"Converted file already exists: {destination}")

    if win32com is None:
        raise RuntimeError("DOC conversion requires the Windows win32com package and Microsoft Word.")

    # Initialize the Word application reference for cleanup.
    word = None

    # Initialize the Word document reference for cleanup.
    document = None

    try:
        # Start a separate Microsoft Word application instance.
        word = win32com.client.DispatchEx("Word.Application")

        # Keep the Word application hidden during conversion.
        word.Visible = False

        # Disable Word alerts to avoid interactive conversion popups.
        word.DisplayAlerts = 0

        # Open the original DOC file in read-only mode.
        document = word.Documents.Open(
            FileName=str(source.resolve()),
            ReadOnly=True,
            AddToRecentFiles=False,
            ConfirmConversions=False,
            NoEncodingDialog=True,
        )

        # Save the opened document as a new DOCX file.
        document.SaveAs2(
            FileName=str(destination.resolve()),
            FileFormat=WORD_DOCX_FORMAT,
        )

        # Return the source and destination details after successful conversion.
        return {
            "source_path": str(source),
            "converted_path": str(destination),
            "status": "converted",
        }

    finally:
        # Close the opened document without changing the original DOC file.
        if document is not None:
            document.Close(SaveChanges=WORD_DO_NOT_SAVE)

        # Shut down the Word instance created by this conversion.
        if word is not None:
            word.Quit(SaveChanges=WORD_DO_NOT_SAVE)
