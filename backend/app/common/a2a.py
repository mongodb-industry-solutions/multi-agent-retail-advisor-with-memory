"""Shared A2A client plumbing.

Provides an httpx client that stamps every outbound A2A request with the current
session id (from the contextvar). Used by both the orchestrator (calling the
planner) and the planner (calling the specialists) so a single ``session_id``
flows through the whole chain and lands on every ``tool_invocations`` record.
"""
from __future__ import annotations

import httpx

from . import context


async def _inject_session_header(request: httpx.Request) -> None:
    session_id = context.get_session_id()
    if session_id:
        request.headers[context.SESSION_HEADER] = session_id


def make_session_forwarding_client(timeout: float = 600.0) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=timeout, event_hooks={"request": [_inject_session_header]}
    )
