from __future__ import annotations

import argparse
import os
import sys
import threading
import time
import webbrowser

import webview

from yosman.paths import DATA_DIR
from yosman.server import find_free_port, start_background_server


def _window_settings(url: str) -> dict:
    return {
        "title": "Yosman",
        "url": url,
        "width": 1360,
        "height": 860,
        "min_size": (980, 640),
        "background_color": "#0b0b0b",
        "text_select": True,
        "confirm_close": False,
    }


def run_desktop() -> None:
    if getattr(sys, "frozen", False):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        os.environ.setdefault("WEBVIEW2_USER_DATA_FOLDER", str(DATA_DIR / "webview2"))
    port = find_free_port()
    url = f"http://127.0.0.1:{port}"
    server = start_background_server(port)
    webview.create_window(**_window_settings(url))
    try:
        webview.start()
    finally:
        server.should_exit = True


def run_in_browser() -> None:
    port = find_free_port()
    url = f"http://127.0.0.1:{port}"
    server = start_background_server(port)
    print(f"\n  Yosman is running at {url}")
    print("  Close this terminal to quit.\n")
    threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        while True:
            time.sleep(0.4)
    except KeyboardInterrupt:
        pass
    finally:
        server.should_exit = True


def main() -> None:
    parser = argparse.ArgumentParser(prog="yosman")
    parser.add_argument(
        "--web",
        action="store_true",
        help="Open in a browser instead of the desktop window",
    )
    args, _unknown = parser.parse_known_args()
    if args.web:
        run_in_browser()
    else:
        run_desktop()
