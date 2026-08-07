"""Pure-ASGI middleware that lifts the ``X-Session-Id`` header off an inbound A2A
request into the session contextvar.

It must be *pure ASGI* (not Starlette's BaseHTTPMiddleware): BaseHTTPMiddleware
runs the downstream app in a separate task, so a contextvar set there would not
be visible to the agent/tool execution. A pure-ASGI wrapper sets the value in the
same async context the request is handled in, so the value propagates down to the
tool call (and, via anyio's thread offloading, to the synchronous MongoDB tools).
"""
from __future__ import annotations

from ..common import context

_HEADER = context.SESSION_HEADER.lower().encode()


class SessionHeaderMiddleware:
    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return
        token = None
        for key, value in scope.get("headers") or []:
            if key == _HEADER:
                token = context.set_session_id(value.decode())
                break
        try:
            await self.app(scope, receive, send)
        finally:
            # Restore the previous value so a session id can't leak into
            # unrelated work if the underlying task/context is reused.
            if token is not None:
                context.reset_session_id(token)
