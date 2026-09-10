from __future__ import annotations

import sys
from pathlib import Path


def resource_root() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent.parent


PACKAGE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = resource_root()
WEB_DIR = resource_root() / "web"
DATA_DIR = Path.home() / ".yosman"
WORKSPACE_FILE = DATA_DIR / "workspace.json"
