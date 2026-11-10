
"""Test the conversion of legacy DOC resumes into DOCX files."""

# Import sys to access Python's module search paths.
import sys

# Import Path to work with resume file and folder paths.
from pathlib import Path

# Add the project root to Python's module search path.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Import our DOC-to-DOCX conversion function.
from app.word_converter import convert_doc_to_docx

# Import our existing resume text extraction function.
from app.resume_extractor import extract_resume_text


# Identify the folder containing the original resume files.
SOURCE_FOLDER = Path("data/resumes")

# Identify the separate folder for converted DOCX files.
OUTPUT_FOLDER = Path("data/converted_resumes")


# Define the main function that performs the conversion test.
def main() -> None:

    # Find all legacy DOC files inside the source folder.
    doc_files = sorted(SOURCE_FOLDER.rglob("*.doc"))

    # Display how many legacy DOC files were discovered.
    print(f"\nLegacy DOC files found: {len(doc_files)}")

    # Stop the test if there are no DOC files to convert.
    if not doc_files:
        print("No legacy DOC files found.")
        return

    # Process each legacy DOC file individually.
    for doc_file in doc_files:

        # Display the filename without exposing resume contents.
        print(f"\nConverting: {doc_file.name}")

        # Convert the original DOC file into a separate DOCX file.
        conversion_result = convert_doc_to_docx(
            source_path=doc_file,
            output_directory=OUTPUT_FOLDER,
        )

        # Display the conversion status and destination path.
        print(f"Conversion status: {conversion_result['status']}")
        print(f"Converted file: {conversion_result['converted_path']}")

        # Extract text from the newly converted DOCX file.
        extraction_result = extract_resume_text(
            conversion_result["converted_path"]
        )

        # Display extraction status and character count only.
        print(f"Extraction status: {extraction_result['status']}")
        print(f"Extracted characters: {extraction_result['character_count']}")

    # Display a completion message after processing all files.
    print("\nDOC conversion test completed successfully.")


# Run the main function when this script is executed directly.
if __name__ == "__main__":
    main()
