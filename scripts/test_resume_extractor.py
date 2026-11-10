
"""Test the CompanyAI resume text extraction component."""

# Import Path to locate the resume folder and inspect its files.
from pathlib import Path
import sys

# Add the repository root so this script can import the app package when run directly.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

# Import the extraction function that we created.
from app.resume_extractor import extract_resume_text


# Identify the folder containing the sample resumes.
RESUME_FOLDER = PROJECT_ROOT / "data" / "resumes"


# Define the main function that runs the extraction tests.
def main() -> None:

    # Check whether the sample resume folder exists.
    if not RESUME_FOLDER.is_dir():
        raise FileNotFoundError(f"Resume folder not found: {RESUME_FOLDER}")

    # Find every file inside the resume folder and its subfolders.
    resume_files = sorted(
        file_path
        for file_path in RESUME_FOLDER.rglob("*")
        if file_path.is_file()
    )

    # Display how many files will be checked.
    print(f"\nTotal files found: {len(resume_files)}")

    # Display a heading before printing extraction results.
    print("\nRESUME EXTRACTION RESULTS")
    print("-" * 65)

    # Process each resume file individually.
    for resume_path in resume_files:

        # Extract text and metadata from the current resume.
        result = extract_resume_text(resume_path)

        # Display only the filename, status, and character count.
        # This avoids printing personal information from resumes.
        print(
            f"File: {resume_path.name} | "
            f"Status: {result['status']} | "
            f"Characters: {result['character_count']}"
        )

    # Display a closing separator after all files are processed.
    print("-" * 65)


# Run the main function when this script is executed directly.
if __name__ == "__main__":
    main()
