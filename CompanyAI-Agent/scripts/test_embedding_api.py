
# Import Path so the project root can be located regardless of the launch path.
from pathlib import Path

# Import sys to make project packages importable when this script runs directly.
import sys

# Add the project root to Python's import search path.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Import the function that calls OpenRouter's embedding API.
from app.embedding_service import generate_embedding


def main() -> None:
    """Request a sample embedding and print a small, non-sensitive summary."""
    # Define a fictional candidate profile without personal information.
    dummy_profile = (
        "Python developer with Django, REST API, and backend development experience."
    )

    # Request an embedding for the sample candidate profile.
    embedding = generate_embedding(dummy_profile)

    # Print the number of dimensions returned by the embedding model.
    print(f"Embedding dimensions: {len(embedding)}")

    # Print only a few numbers to confirm that the vector contains data.
    print(f"First five vector values: {embedding[:5]}")

    # Confirm that the embedding request completed successfully.
    print("OpenRouter embedding API test completed successfully.")


# Run the external API request only when this file is executed directly.
if __name__ == "__main__":
    main()
