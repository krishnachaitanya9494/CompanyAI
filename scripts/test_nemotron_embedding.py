"""Make one synthetic live embedding request to Nemotron through OpenRouter."""

# Import environment access so the script can read only its named settings.
import os

# Import a performance timer for measuring one HTTP request.
from time import perf_counter

# Import Path so the project's .env is found from any shell directory.
from pathlib import Path

# Import HTTPX for the single OpenRouter embeddings request.
import httpx

# Import python-dotenv to load the existing project .env file.
from dotenv import load_dotenv


# Resolve the repository root from this script's location.
PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Point dotenv at the existing project environment file without displaying it.
ENV_FILE = PROJECT_ROOT / ".env"

# Load .env values only when an operating-system variable is not already set.
load_dotenv(ENV_FILE, override=False)

# Use the OpenRouter embeddings endpoint specified for this connectivity check.
EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings"

# Keep the requested synthetic input independent from all local JD or resume files.
SYNTHETIC_INPUT = "Java developer with three years of experience in Selenium automation testing."

# Use a finite timeout so the connectivity check cannot wait indefinitely.
REQUEST_TIMEOUT_SECONDS = 45.0


# Run one request and print only status, model, vector summary, and elapsed time.
def main() -> int:
    """Check embedding connectivity without reading any resume or JD content."""

    # Read the existing OpenRouter API key without ever printing its value.
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip().strip('"').strip("'")

    # Read the configured embedding model without using the separate chat model.
    model = os.getenv("OPENROUTER_EMBEDDING_MODEL", "").strip()

    # Stop before a request if a required setting is missing or still a placeholder.
    if (
        not api_key
        or api_key == "YOUR_OPENROUTER_API_KEY"
        or not model
    ):
        print("Configuration error: set OPENROUTER_API_KEY and OPENROUTER_EMBEDDING_MODEL in .env.")
        return 1

    # Prepare bearer authentication privately without logging request headers.
    request_headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Use only the synthetic input and the configured embedding model in the payload.
    request_payload = {
        "input": SYNTHETIC_INPUT,
        "model": model,
    }

    # Start timing immediately before the one HTTP request.
    request_started_at = perf_counter()

    # Make exactly one live request with no retry loop or secondary call.
    try:
        response = httpx.post(
            EMBEDDINGS_URL,
            headers=request_headers,
            json=request_payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except httpx.TimeoutException:
        # Report the timeout without printing the request, headers, or API key.
        print("HTTP status code: unavailable")
        print("Model identifier returned: unavailable")
        print("Embedding vector dimensions: unavailable")
        print("First five embedding values: unavailable")
        print(f"Response time: {perf_counter() - request_started_at:.2f} seconds")
        print("API error: the OpenRouter embedding request timed out.")
        return 1
    except httpx.RequestError as error:
        # Report only the exception class, never its request details or headers.
        print("HTTP status code: unavailable")
        print("Model identifier returned: unavailable")
        print("Embedding vector dimensions: unavailable")
        print("First five embedding values: unavailable")
        print(f"Response time: {perf_counter() - request_started_at:.2f} seconds")
        print(f"API error: network request failed ({type(error).__name__}).")
        return 1

    # Stop the timer as soon as the single HTTP response is received.
    response_time = perf_counter() - request_started_at

    # Print the numeric HTTP status returned by OpenRouter.
    print(f"HTTP status code: {response.status_code}")

    # Parse response JSON when possible without printing an error response body.
    try:
        response_data = response.json()
    except ValueError:
        response_data = {}

    # Find the returned model identifier at the response or first-data-item level.
    returned_model = response_data.get("model") if isinstance(response_data, dict) else None
    if not isinstance(returned_model, str) and isinstance(response_data, dict):
        data_items = response_data.get("data")
        if isinstance(data_items, list) and data_items and isinstance(data_items[0], dict):
            returned_model = data_items[0].get("model")

    # Print a returned model identifier only when it is a non-empty string.
    if isinstance(returned_model, str) and returned_model.strip():
        print(f"Model identifier returned: {returned_model.replace(chr(10), ' ').strip()}")
    else:
        print("Model identifier returned: unavailable")

    # Handle invalid credentials without exposing response bodies or credentials.
    if response.status_code in {401, 403}:
        print("Embedding vector dimensions: unavailable")
        print("First five embedding values: unavailable")
        print(f"Response time: {response_time:.2f} seconds")
        print("API error: authentication was rejected; check the OpenRouter key.")
        return 1

    # Handle rate limiting separately from authentication and other API errors.
    if response.status_code == 429:
        print("Embedding vector dimensions: unavailable")
        print("First five embedding values: unavailable")
        print(f"Response time: {response_time:.2f} seconds")
        print("API error: OpenRouter rate limit reached; try again later.")
        return 1

    # Handle all other non-success status codes without exposing their response body.
    if not 200 <= response.status_code < 300:
        print("Embedding vector dimensions: unavailable")
        print("First five embedding values: unavailable")
        print(f"Response time: {response_time:.2f} seconds")
        print(f"API error: OpenRouter returned HTTP {response.status_code}.")
        return 1

    # Read the first returned embedding vector from the response structure.
    try:
        data_items = response_data["data"]
        embedding = data_items[0]["embedding"]
    except (KeyError, IndexError, TypeError):
        embedding = None

    # Require the returned embedding to be a non-empty list of numeric values.
    if (
        not isinstance(embedding, list)
        or not embedding
        or any(not isinstance(value, (int, float)) or isinstance(value, bool) for value in embedding)
    ):
        print("Embedding vector dimensions: unavailable")
        print("First five embedding values: unavailable")
        print(f"Response time: {response_time:.2f} seconds")
        print("API error: OpenRouter returned an unexpected embedding response format.")
        return 1

    # Print only the vector length and the first five numeric values.
    print(f"Embedding vector dimensions: {len(embedding)}")
    print(f"First five embedding values: {embedding[:5]}")

    # Print elapsed time after a successful embedding response.
    print(f"Response time: {response_time:.2f} seconds")

    # Return success when a valid embedding vector was received.
    return 0


# Run the one-request test only when this file is executed directly.
if __name__ == "__main__":
    # Exit with the status returned by the connectivity test.
    raise SystemExit(main())
