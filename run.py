"""Launch the Yosman desktop app: python run.py"""

from __future__ import annotations

import multiprocessing
import sys
from pathlib import Path

multiprocessing.freeze_support()


def _prepare_stdio() -> None:
    if sys.stdout is not None and sys.stderr is not None:
        return
    log_dir = Path.home() / ".yosman"
    log_dir.mkdir(parents=True, exist_ok=True)
    stream = open(log_dir / "yosman.log", "a", encoding="utf-8")
    if sys.stdout is None:
        sys.stdout = stream
    if sys.stderr is None:
        sys.stderr = stream


_prepare_stdio()

from yosman.desktop import main

if __name__ == "__main__":
    main()
