"""Root conftest — ensures app imports work from the tests/ directory."""

from __future__ import annotations

import sys
from pathlib import Path

# Add backend root to sys.path so `from app.xxx import ...` works
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
