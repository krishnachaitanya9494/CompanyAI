"""Persistent SQLite Checkpoint Manager for CompanyAI LangGraph Workflows.

Maintains execution checkpoints and conversation threads in a dedicated SQLite database
to ensure fault-tolerance and support human-in-the-loop pauses/resumes.
"""

import sqlite3
from pathlib import Path
from typing import Optional
from langgraph.checkpoint.sqlite import SqliteSaver

from app.ai.config import ai_config

_CHECKPOINTER: Optional[SqliteSaver] = None
_CONNECTION: Optional[sqlite3.Connection] = None


def get_sqlite_checkpointer(db_path: Optional[Path] = None) -> SqliteSaver:
    """Return a shared SqliteSaver checkpointer instance connected to the dedicated checkpoints DB."""
    global _CHECKPOINTER, _CONNECTION
    if _CHECKPOINTER is None:
        target_path = db_path or ai_config.checkpoint_db_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        # Use check_same_thread=False for FastAPI concurrency
        _CONNECTION = sqlite3.connect(str(target_path), check_same_thread=False)
        _CHECKPOINTER = SqliteSaver(_CONNECTION)
        _CHECKPOINTER.setup()
    return _CHECKPOINTER
