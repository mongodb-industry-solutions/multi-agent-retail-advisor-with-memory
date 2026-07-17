"""Per-request session correlation.

Replaces the Java ``AgentContext`` ThreadLocal. In the specialist A2A services the
session id arrives on the inbound A2A request and is stashed here so the MongoDB
tools can stamp every ``tool_invocations`` audit record with the originating
session — even though the tool now runs in a different process than the planner.

``contextvars`` (unlike thread-locals) propagate correctly across the asyncio
tasks ADK uses, so the value set at request-entry is visible inside the tool call.
"""
from __future__ import annotations

from contextvars import ContextVar
from typing import Optional

# HTTP header used to carry the originating session id across A2A hops.
SESSION_HEADER = "X-Session-Id"

_session_id: ContextVar[Optional[str]] = ContextVar("session_id", default=None)


def set_session_id(session_id: Optional[str]) -> None:
    _session_id.set(session_id)


def get_session_id() -> Optional[str]:
    return _session_id.get()


def clear_session_id() -> None:
    _session_id.set(None)
