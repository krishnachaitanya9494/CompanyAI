# Import Path so the project root can be found from this script's location.
from pathlib import Path

# Import sys to add the project root to Python's module search path.
import sys

# Make project packages such as "tools" importable when this file is run directly.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Import the candidate search function from our recruitment tool.
from tools.candidate_search import search_candidates

# Search for recruitment submissions containing the skill Java.
results = search_candidates(skill="Java", limit=10)

# Display the total number of matching submissions returned.
print(f"\nMatching submissions: {len(results)}")

# Print each matching submission without exposing candidate contact details.
for candidate in results:
    # Display the safe, non-identifying recruitment information.
    print(candidate)