
# Import csv to read recruitment records from the CSV file.
import csv

# Import Path to locate the CSV file independently of the terminal directory.
from pathlib import Path

# Import SQLAlchemy's text function to execute parameterized SQL queries.
from sqlalchemy import text

# Import the existing PostgreSQL engine from our database connection module.
from database.connection import engine

# Find the root project directory from this script's location.
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Define the location of the source recruitment CSV file.
CSV_FILE = PROJECT_ROOT / "data" / "Sample.csv"

# Define the database table used to track CSV imports.
BATCH_TABLE = "import_batches"

# Define the database table used to store original recruitment records.
SUBMISSION_TABLE = "recruitment_submissions_raw"

# Map each original CSV header to its corresponding database column.
COLUMN_MAPPING = {
    "s.no": "source_serial_number",
    "Recruiter Name": "recruiter_name",
    "Work Date": "work_date",
    "Candidate Name": "candidate_name",
    "Contact Number": "contact_number",
    "alt number": "alternate_number",
    "Email ID": "email_id",
    "alt mail id": "alternate_email_id",
    "Education Qualification": "education_qualification",
    "D.O.B": "date_of_birth",
    "Skill Set": "skill_set",
    "Current Company": "current_company",
    "Current Work Location": "current_work_location",
    "Preferred Work Location": "preferred_work_location",
    "Total Experience": "total_experience",
    "Relevant Experience": "relevant_experience",
    "CurrentCTC": "current_ctc",
    "ExpectedCTC": "expected_ctc",
    "Candidate Availability": "candidate_availability",
    "Profile Source": "profile_source",
    "Addl. Notes/Comments": "additional_notes_comments",
    "Profile Archieved to Server": "profile_archived_to_server",
}

# Define the SQL statement that creates an import batch.
CREATE_BATCH_SQL = text("""
    INSERT INTO import_batches (
        source_file_name,
        record_count,
        import_status
    )
    VALUES (
        :source_file_name,
        :record_count,
        'completed'
    )
    RETURNING import_batch_id
""")

# Define the SQL statement that inserts one recruitment submission.
INSERT_SUBMISSION_SQL = text("""
    INSERT INTO recruitment_submissions_raw (
        import_batch_id,
        source_row_number,
        source_serial_number,
        recruiter_name,
        work_date,
        candidate_name,
        contact_number,
        alternate_number,
        email_id,
        alternate_email_id,
        education_qualification,
        date_of_birth,
        skill_set,
        current_company,
        current_work_location,
        preferred_work_location,
        total_experience,
        relevant_experience,
        current_ctc,
        expected_ctc,
        candidate_availability,
        profile_source,
        additional_notes_comments,
        profile_archived_to_server
    )
    VALUES (
        :import_batch_id,
        :source_row_number,
        :source_serial_number,
        :recruiter_name,
        :work_date,
        :candidate_name,
        :contact_number,
        :alternate_number,
        :email_id,
        :alternate_email_id,
        :education_qualification,
        :date_of_birth,
        :skill_set,
        :current_company,
        :current_work_location,
        :preferred_work_location,
        :total_experience,
        :relevant_experience,
        :current_ctc,
        :expected_ctc,
        :candidate_availability,
        :profile_source,
        :additional_notes_comments,
        :profile_archived_to_server
    )
""")

# Define the main function responsible for importing the CSV.
def import_csv():

    # Stop the import if the source CSV file does not exist.
    if not CSV_FILE.exists():
        raise FileNotFoundError(f"CSV file not found: {CSV_FILE}")

    # Open the CSV using its detected Windows-1252 encoding.
    with CSV_FILE.open("r", encoding="cp1252", newline="") as file:

        # Read CSV rows using their original header names.
        reader = csv.DictReader(file)

        # Verify that every expected CSV header is present.
        if reader.fieldnames != list(COLUMN_MAPPING.keys()):
            raise ValueError(
                "CSV headers do not match the expected column mapping."
            )

        # Read every CSV record into memory without changing its values.
        records = list(reader)

    # Reject an empty CSV file before opening a database transaction.
    if not records:
        raise ValueError("The CSV file contains no recruitment records.")

    # Open one database transaction for the complete import.
    with engine.begin() as connection:

        # Create the import batch and retrieve its generated ID.
        batch_result = connection.execute(
            CREATE_BATCH_SQL,
            {
                "source_file_name": CSV_FILE.name,
                "record_count": len(records),
            },
        )

        # Store the generated batch ID for all submission records.
        batch_id = batch_result.scalar_one()

        # Process every CSV record separately.
        for row_number, record in enumerate(records, start=2):

            # Convert blank CSV fields to SQL NULL while preserving other text.
            submission = {
                database_column: (
                    record[csv_column]
                    if record[csv_column] != ""
                    else None
                )
                for csv_column, database_column in COLUMN_MAPPING.items()
            }

            # Add the import batch ID to the submission.
            submission["import_batch_id"] = batch_id

            # Preserve the original CSV line number, including the header offset.
            submission["source_row_number"] = row_number

            # Insert the original recruitment record into PostgreSQL.
            connection.execute(INSERT_SUBMISSION_SQL, submission)

    # Display the successful import summary after the transaction commits.
    print("\n========== CSV IMPORT SUCCESS ==========")

    # Display the source filename.
    print(f"Source file: {CSV_FILE.name}")

    # Display the generated import batch ID.
    print(f"Import batch ID: {batch_id}")

    # Display the total number of imported records.
    print(f"Records imported: {len(records)}")

    # Confirm that the transaction completed successfully.
    print("Import status: completed")


# Run the importer only when this file is executed directly.    
if __name__ == "__main__":

    # Execute the CSV import process.
    import_csv()
