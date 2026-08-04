"""ProductAgent as a standalone A2A server.

Serves the agent card at ``/.well-known/agent-card.json`` and handles A2A
``message/send``. See ``profile_server`` for the session-id capture rationale.

Run: ``uvicorn app.services.product_server:app --host 0.0.0.0 --port 9092``
"""
from __future__ import annotations

from google.adk.a2a.utils.agent_to_a2a import to_a2a

from ..agents.product_agent import root_agent
from ..common import config
from .session_middleware import SessionHeaderMiddleware

app = SessionHeaderMiddleware(
    to_a2a(root_agent, host=config.A2A_HOST, port=config.PRODUCT_AGENT_PORT)
)
