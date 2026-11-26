# Shim entrypoint aliasing 'backend.app.main:app' to root 'app.main:app'
from app.main import app

__all__ = ["app"]
