
"""Verify that Python can communicate with Microsoft Word."""

# Import win32com.client to communicate with Windows applications.
__test__ = False

try:
    import win32com.client
except ModuleNotFoundError:
    win32com = None

if __name__ == "__main__":
    if win32com is None:
        raise RuntimeError("win32com is not installed; Microsoft Word automation is unavailable.")

    # Create a connection to the Microsoft Word application.
    word = win32com.client.Dispatch("Word.Application")

    # Keep Microsoft Word hidden during the connection test.
    word.Visible = False

    # Print a confirmation message with the installed Word version.
    print(f"Microsoft Word connected successfully. Version: {word.Version}")

    # Close the Word application without saving any documents.
    word.Quit()

    # Confirm that the connection test has completed.
    print("Word connection test completed.")
