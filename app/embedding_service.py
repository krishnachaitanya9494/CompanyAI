
# Import os so Python can read environment variables.
import os

# Import httpx to send HTTP requests to OpenRouter's hosted API.
import httpx

# Import Path to locate the project .env file independently of the working directory.
from pathlib import Path

# Import load_dotenv to load settings from the project's .env file.
from dotenv import load_dotenv

# Locate the project root and load its environment variables.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(
    PROJECT_ROOT / ".env",
    override=not bool(os.getenv("OPENROUTER_API_KEY", "").strip()),
)

# Read the OpenRouter API key without hardcoding the secret in this file.
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()

# Read the configured embedding model, defaulting to OpenRouter's free NVIDIA model.
OPENROUTER_EMBEDDING_MODEL = os.getenv(
    "OPENROUTER_EMBEDDING_MODEL",
    "nvidia/nemotron-3-embed-1b:free",
)

# Store the OpenRouter embeddings endpoint.
OPENROUTER_EMBEDDING_URL = "https://openrouter.ai/api/v1/embeddings"


# Define a reusable function that converts text into an embedding vector.
def generate_embedding(text: str) -> list[float]:
    # Stop immediately if the API key is missing from the environment.
    if not OPENROUTER_API_KEY or OPENROUTER_API_KEY == "YOUR_OPENROUTER_API_KEY":
        raise RuntimeError("Set OPENROUTER_API_KEY in .env to a valid OpenRouter API key.")

    # Reject empty or whitespace-only input before calling the API.
    if not text or not text.strip():
        raise ValueError("Text must not be empty.")

    # Prepare the authentication and content-type headers for OpenRouter.
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Prepare the request body using OpenRouter's embeddings API format.
    payload = {
        "input": text.strip(),
        "model": OPENROUTER_EMBEDDING_MODEL,
    }

    # Send the request with a timeout so the application cannot wait forever.
    with httpx.Client(timeout=60.0) as client:
        # Submit the text to OpenRouter and receive the HTTP response.
        response = client.post(
            OPENROUTER_EMBEDDING_URL,
            headers=headers,
            json=payload,
        )

        # Explain authentication failures without exposing the configured key.
        if response.status_code == 401:
            raise RuntimeError(
                "OpenRouter rejected OPENROUTER_API_KEY (401 Unauthorized). "
                "Check that .env contains a current OpenRouter API key."
            )

        # Raise an informative HTTP error if OpenRouter rejects the request.
        response.raise_for_status()

        # Decode the JSON response returned by OpenRouter.
        response_data = response.json()

    # Check that the response contains an embedding record.
    records = response_data.get("data")
    if not isinstance(records, list) or not records or not isinstance(records[0], dict):
        raise RuntimeError("OpenRouter returned an invalid embedding response.")

    # Extract the first embedding vector from the returned response.
    embedding = records[0].get("embedding")

    # Check that the API returned a non-empty list of numbers.
    if not isinstance(embedding, list) or not embedding:
        raise RuntimeError("OpenRouter returned an invalid embedding vector.")

    # Convert every vector value to a Python float before returning it.
    return [float(value) for value in embedding]
