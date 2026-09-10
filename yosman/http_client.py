from __future__ import annotations

import time
from typing import Any

import httpx
from pydantic import BaseModel, Field


class SendPayload(BaseModel):
    method: str
    url: str
    headers: dict[str, str] = Field(default_factory=dict)
    body: str | None = None
    timeout: float = 30.0
    follow_redirects: bool = True
    verify: bool = True


class SendResult(BaseModel):
    ok: bool
    status: int | None = None
    reason: str | None = None
    headers: list[list[str]] = Field(default_factory=list)
    body: str = ""
    content_type: str = ""
    time_ms: float = 0.0
    size: int = 0
    error: str | None = None


def _decode_body(response: httpx.Response) -> str:
    try:
        return response.text
    except Exception:
        return "<binary response>"


async def send_request(payload: SendPayload) -> SendResult:
    timeout = httpx.Timeout(payload.timeout)
    limits = httpx.Limits(max_keepalive_connections=5, max_connections=10)
    started = time.perf_counter()

    try:
        async with httpx.AsyncClient(
            follow_redirects=payload.follow_redirects,
            timeout=timeout,
            verify=payload.verify,
            limits=limits,
        ) as client:
            content: Any = payload.body.encode("utf-8") if payload.body else None
            response = await client.request(
                method=payload.method.upper(),
                url=payload.url,
                headers=payload.headers or None,
                content=content,
            )
            elapsed = (time.perf_counter() - started) * 1000
            body = _decode_body(response)
            return SendResult(
                ok=True,
                status=response.status_code,
                reason=response.reason_phrase,
                headers=[[k, v] for k, v in response.headers.items()],
                body=body,
                content_type=response.headers.get("content-type", ""),
                time_ms=round(elapsed, 2),
                size=len(response.content),
            )
    except httpx.TimeoutException:
        elapsed = (time.perf_counter() - started) * 1000
        return SendResult(ok=False, time_ms=round(elapsed, 2), error="Request timed out")
    except Exception as exc:
        elapsed = (time.perf_counter() - started) * 1000
        return SendResult(ok=False, time_ms=round(elapsed, 2), error=str(exc))
