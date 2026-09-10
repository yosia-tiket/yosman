from __future__ import annotations

import asyncio
import socket
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from yosman.http_client import SendPayload, send_request
from yosman.paths import WEB_DIR
from yosman.store import (
    find_collection,
    load_workspace,
    match_mock_request,
    save_workspace,
)

app = FastAPI(title="Yosman", version="1.0.0", docs_url=None, redoc_url=None)


def _index() -> Path:
    return WEB_DIR / "index.html"


@app.get("/")
async def root() -> FileResponse:
    return FileResponse(_index())


@app.get("/api/workspace")
async def get_workspace() -> dict[str, Any]:
    return load_workspace()


@app.put("/api/workspace")
async def put_workspace(request: Request) -> dict[str, str]:
    data = await request.json()
    save_workspace(data)
    return {"status": "saved"}


@app.post("/api/send")
async def proxy_send(payload: SendPayload) -> dict[str, Any]:
    result = await send_request(payload)
    return result.model_dump()


@app.api_route("/mock/{collection_id}/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
async def mock_endpoint(collection_id: str, path: str, request: Request) -> Response:
    workspace = load_workspace()
    collection = find_collection(workspace, collection_id)
    if collection is None:
        return JSONResponse({"error": "Unknown collection"}, status_code=404)

    incoming = "/" + path.lstrip("/")
    node = match_mock_request(collection, request.method, incoming)
    if node is None:
        return JSONResponse(
            {
                "error": "No mock matched this route",
                "method": request.method,
                "path": incoming,
                "hint": "Enable Mock on a request whose URL path matches this path.",
            },
            status_code=404,
        )

    delay_ms = int(node.get("mock_delay_ms") or 0)
    if delay_ms > 0:
        await asyncio.sleep(min(delay_ms, 10_000) / 1000)

    headers = {}
    for item in node.get("mock_headers") or []:
        if item.get("enabled", True) and item.get("key"):
            headers[str(item["key"])] = str(item.get("value") or "")
    body = node.get("mock_body") or ""
    status = int(node.get("mock_status") or 200)
    media = headers.pop("Content-Type", None) or headers.pop("content-type", None)
    if media is None:
        media = "application/json" if body.lstrip().startswith(("{", "[")) else "text/plain"
    return Response(content=body, status_code=status, media_type=media, headers=headers)


@app.api_route("/mock/{collection_id}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
async def mock_root(collection_id: str, request: Request) -> Response:
    return await mock_endpoint(collection_id, "", request)


if WEB_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(WEB_DIR)), name="static")


def find_free_port(start: int = 8765) -> int:
    for port in range(start, start + 30):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(("127.0.0.1", port))
            except OSError:
                continue
            return port
    raise RuntimeError("No free port found in range 8765-8794")


def wait_until_ready(url: str, timeout: float = 8.0) -> None:
    deadline = time.time() + timeout
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=0.4)
            return
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_error = exc
            time.sleep(0.08)
    raise RuntimeError(f"Yosman server did not start: {last_error}")


def start_background_server(port: int) -> uvicorn.Server:
    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level="warning",
        access_log=False,
    )
    server = uvicorn.Server(config)
    server.install_signal_handlers = False

    def _run() -> None:
        asyncio.run(server.serve())

    thread = threading.Thread(target=_run, name="yosman-http", daemon=True)
    thread.start()
    wait_until_ready(f"http://127.0.0.1:{port}/")
    return server


def main() -> None:
    from yosman.desktop import main as desktop_main

    desktop_main()


if __name__ == "__main__":
    main()
