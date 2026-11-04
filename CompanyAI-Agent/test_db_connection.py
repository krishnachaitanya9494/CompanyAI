# Import the PostgreSQL connection verification function.
from database.connection import test_connection as check_connection

# Run the database connection test when this file is executed.
if __name__ == "__main__":
    # Check whether PostgreSQL responds to the test query.
    if check_connection():
        # Display a success message when the connection works.
        print("PostgreSQL connection successful!")