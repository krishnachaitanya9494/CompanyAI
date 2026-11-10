"""Make one synthetic live connectivity request to Nemotron through OpenRouter."""

# Import environment access so the script can read only its named settings.
import os

# Import a performance timer for measuring one request.
from time import perf_counter

# Import Path so the project's .env is found regardless of the shell directory.
from pathlib import Path

# Import HTTPX for the single OpenRouter chat-completions request.
import httpx

# Import python-dotenv to load the existing project .env file.
from dotenv import load_dotenv


# Resolve the repository root from this script's location.
PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Point dotenv at the existing project environment file without printing it.
ENV_FILE = PROJECT_ROOT / ".env"

# Load .env values only when an operating-system variable has not already been set.
load_dotenv(ENV_FILE, override=False)

# Use OpenRouter's documented chat-completions endpoint.
CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"

# Keep the test prompt synthetic and exactly as requested.
SYNTHETIC_PROMPT = "Reply with exactly: CompanyAI Nemotron is working."

# Use a finite timeout so a connectivity check cannot hang indefinitely.
REQUEST_TIMEOUT_SECONDS = 45.0


# Run one request and print only status, model, response, and elapsed time.
def main() -> int:
    """Check OpenRouter connectivity without using any JD or resume content."""

    # Read the existing OpenRouter key without ever printing its value.
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip().strip('"').strip("'")

    # Read the separate Nemotron chat model setting without using the embedding model.
    model = os.getenv("OPENROUTER_LLM_MODEL", "").strip()

    # Stop before making a request if either required setting is missing or a placeholder.
    if (
        not api_key
        or api_key == "YOUR_OPENROUTER_API_KEY"
        or not model
    ):
        print("Configuration error: set OPENROUTER_API_KEY and OPENROUTER_LLM_MODEL in .env.")
        return 1

    # Prepare bearer authentication privately without logging request headers.
    request_headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Send only the exact synthetic prompt as one user message.
    request_payload = {
        "model": model,
        "messages": [{"role": "user", "content": SYNTHETIC_PROMPT}],
        "temperature": 0,
        "stream": False,
    }

    # Start timing immediately before the single HTTP request.
    request_started_at = perf_counter()

    # Make exactly one live request with no retry loop or secondary call.
    try:
        response = httpx.post(
            CHAT_COMPLETIONS_URL,
            headers=request_headers,
            json=request_payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except httpx.TimeoutException:
        # Report timeout status without printing the request, headers, or API key.
        print("HTTP status code: unavailable")
        print("Model identifier returned: unavailable")
        print("Generated response: unavailable")
        print(f"Response time: {perf_counter() - request_started_at:.2f} seconds")
        print("API error: the OpenRouter request timed out.")
        return 1
    except httpx.RequestError as error:
        # Report only the exception class, never its request details or headers.
        print("HTTP status code: unavailable")
        print("Model identifier returned: unavailable")
        print("Generated response: unavailable")
        print(f"Response time: {perf_counter() - request_started_at:.2f} seconds")
        print(f"API error: network request failed ({type(error).__name__}).")
        return 1

    # Stop the timer as soon as the one HTTP response is received.
    response_time = perf_counter() - request_started_at

    # Print the numeric HTTP status returned by OpenRouter.
    print(f"HTTP status code: {response.status_code}")

    # Parse JSON when available, but never print an error response body.
    try:
        response_data = response.json()
    except ValueError:
        response_data = {}

    # Read and safely display the returned model identifier when it is a string.
    returned_model = response_data.get("model") if isinstance(response_data, dict) else None
    if isinstance(returned_model, str) and returned_model.strip():
        print(f"Model identifier returned: {returned_model.replace(chr(10), ' ').strip()}")
    else:
        print("Model identifier returned: unavailable")

    # Handle authentication errors without exposing credentials or response bodies.
    if response.status_code in {401, 403}:
        print("Generated response: unavailable")
        print(f"Response time: {response_time:.2f} seconds")
        print("API error: authentication was rejected; check the OpenRouter key.")
        return 1

    # Handle rate limits separately so the user can distinguish them from auth errors.
    if response.status_code == 429:
        print("Generated response: unavailable")
        print(f"Response time: {response_time:.2f} seconds")
        print("API error: OpenRouter rate limit reached; try again later.")
        return 1

    # Handle all other non-success responses without printing their bodies.
    if not 200 <= response.status_code < 300:
        print("Generated response: unavailable")
        print(f"Response time: {response_time:.2f} seconds")
        print(f"API error: OpenRouter returned HTTP {response.status_code}.")
        return 1

    # Extract the assistant's generated text from a successful chat response.
    try:
        choices = response_data["choices"]
        generated_response = choices[0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        generated_response = None

    # Print generated text only when the response contains a plain text value.
    if isinstance(generated_response, str):
        print(f"Generated response: {generated_response}")
    else:
        print("Generated response: unavailable")
        print(f"Response time: {response_time:.2f} seconds")
        print("API error: OpenRouter returned an unexpected response format.")
        return 1

    # Print elapsed request time after the successful response.
    print(f"Response time: {response_time:.2f} seconds")

    # Return success only when the service returned a text response.
    return 0


# Run the one-request test only when this file is executed directly.
if __name__ == "__main__":
    # Exit with the status returned by the connectivity test.
    raise SystemExit(main())
