# Sample data

`sample.csv` is a small, synthetic dataset for local development and tests.
Its columns are:

- `company`: company name
- `department`: department associated with the employee count
- `employee_count`: example number of employees in that department

The CSV contains a header row followed by one record per company department.
Keep explanatory text in this file rather than adding comment rows to the CSV,
so standard CSV readers can load the data without special options.
