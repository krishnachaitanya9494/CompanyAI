
# Import os so Python can read environment variables.
import os

# Import time for retry backoff sleeping.
import time

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


# Define a reusable function that converts text into an embedding vector with retry support.
def generate_embedding(
    text: str,
    max_retries: int = 3,
    initial_backoff_seconds: float = 0.5,
) -> list[float]:
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

    # Track the last exception encountered across retry attempts.
    last_error: Exception | None = None

    # Retry loop with exponential backoff for transient provider failures.
    for attempt in range(1, max_retries + 1):
        try:
            # Send the request with a timeout so the application cannot hang indefinitely.
            with httpx.Client(timeout=60.0) as client:
                # Submit the text to OpenRouter and receive the HTTP response.
                response = client.post(
                    OPENROUTER_EMBEDDING_URL,
                    headers=headers,
                    json=payload,
                )

                # Explain authentication failures immediately without wasting retries.
                if response.status_code == 401:
                    raise RuntimeError(
                        "OpenRouter rejected OPENROUTER_API_KEY (401 Unauthorized). "
                        "Check that .env contains a current OpenRouter API key."
                    )

                # Check if the status indicates a transient server error or rate limiting.
                if response.status_code in (429, 500, 502, 503, 504):
                    if attempt < max_retries:
                        backoff = initial_backoff_seconds * (2 ** (attempt - 1))
                        time.sleep(backoff)
                        continue

                # Raise an informative HTTP error if OpenRouter rejected the request.
                response.raise_for_status()

                # Decode the JSON response returned by OpenRouter.
                response_data = response.json()

            # Check that the response contains an embedding record list.
            records = response_data.get("data")
            if not isinstance(records, list) or not records or not isinstance(records[0], dict):
                raise RuntimeError("OpenRouter returned an invalid embedding response.")

            # Extract the first embedding vector from the returned response.
            embedding = records[0].get("embedding")

            # Check that the API returned a non-empty list of numbers.
            if not isinstance(embedding, list) or not embedding:
                raise RuntimeError("OpenRouter returned an invalid embedding vector.")

            # Convert every vector coordinate to a Python float before returning it.
            return [float(value) for value in embedding]

        except (httpx.TransportError, httpx.HTTPStatusError) as exc:
            # Record error for possible retry.
            last_error = exc
            # If attempts remain, backoff and retry.
            if attempt < max_retries:
                backoff = initial_backoff_seconds * (2 ** (attempt - 1))
                time.sleep(backoff)
            else:
                # Raise descriptive failure on final attempt.
                raise RuntimeError(f"OpenRouter embedding generation failed after {max_retries} attempts: {exc}") from exc

    # If the retry loop exhausted without returning, re-raise the recorded error.
    if last_error:
        raise RuntimeError(f"OpenRouter embedding generation failed: {last_error}") from last_error
    raise RuntimeError("OpenRouter embedding generation failed unexpectedly.")
