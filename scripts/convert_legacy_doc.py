"""Run the legacy DOC conversion utility from the scripts directory."""

import sys
from pathlib import Path

# Make the repository root importable when this file is run directly.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.convert_legacy_doc import main


if __name__ == "__main__":
    main()
