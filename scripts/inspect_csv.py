# Import Python's built-in CSV module to read CSV files.
import csv

# Import Path to create file paths independently of the terminal's location.
from pathlib import Path

# Import Counter to count repeated rows.
from collections import Counter

# Find the root project directory from this script's location.
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Define the location of the original CSV file.
CSV_FILE = PROJECT_ROOT / "data" / "Sample.csv"

# Use a dictionary to store the inspection results.
report = {}

# Open the CSV using CP1252 encoding, which supports this sample file.
with CSV_FILE.open("r", encoding="cp1252", newline="") as file:

    # Read each CSV row as a dictionary using its header names.
    reader = csv.DictReader(file)

    # Save the column names from the CSV header.
    headers = reader.fieldnames

    # Read all records without modifying their original values.
    records = list(reader)

# Store the total number of columns in the report.
report["column_count"] = len(headers)

# Store the total number of data records in the report.
report["record_count"] = len(records)

# Store the original CSV column names in the report.
report["headers"] = headers

# Count empty values in each column without displaying personal data.
report["empty_values"] = {
    column: sum(
        1 for record in records
        if not (record.get(column) or "").strip()
    )
    for column in headers
}

# Convert each record into a tuple for exact duplicate detection.
row_signatures = [
    tuple((record.get(column) or "") for column in headers)
    for record in records
]

# Count the number of records that are exact duplicates.
report["duplicate_rows"] = sum(
    count - 1
    for count in Counter(row_signatures).values()
    if count > 1
)

# Print the structural inspection report without printing candidate details.
print("\n========== CSV INSPECTION REPORT ==========")

# Display the total number of columns.
print(f"Total columns: {report['column_count']}")

# Display the total number of records.
print(f"Total records: {report['record_count']}")

# Display the original column headers.
print("\nColumn headers:")

# Print each column name separately.
for header in report["headers"]:
    print(f"- {header}")

# Display the empty-value count for each column.
print("\nEmpty values by column:")

# Print each column's empty-value count.
for column, count in report["empty_values"].items():
    print(f"- {column}: {count}")

# Display the number of exact duplicate rows.
print(f"\nExact duplicate rows: {report['duplicate_rows']}")

# Indicate that the inspection has finished.
print("\nCSV inspection completed successfully.")
