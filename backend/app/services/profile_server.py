"""ProfileAgent as a standalone A2A server.

``to_a2a`` builds a Starlette app that serves the agent's card at
``/.well-known/agent-card.json`` and handles A2A ``message/send`` over JSON-RPC.
We wrap it so the inbound session id is captured for the tool audit log.

Run: ``uvicorn app.services.profile_server:app --host 0.0.0.0 --port 9091``
"""
from __future__ import annotations

from google.adk.a2a.utils.agent_to_a2a import to_a2a

from ..agents.profile_agent import root_agent
from ..common import config
from .session_middleware import SessionHeaderMiddleware

app = SessionHeaderMiddleware(
    to_a2a(root_agent, host=config.A2A_HOST, port=config.PROFILE_A2A_PORT)
)
