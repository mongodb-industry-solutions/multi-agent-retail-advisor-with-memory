"""PlannerAgent as a standalone A2A server — the external A2A entrypoint.

This is what makes the README's claim true: any A2A-compatible orchestrator can
discover this card and delegate to the Planner, which in turn fans out to the
Profile and Product agents over A2A. The captured session id is forwarded onward
by the planner's own A2A client (see ``common.a2a``).

Run: ``uvicorn app.services.planner_server:app --host 0.0.0.0 --port 8081``
"""
from __future__ import annotations

from google.adk.a2a.utils.agent_to_a2a import to_a2a

from ..agents.planner_agent import root_agent
from ..common import config
from .session_middleware import SessionHeaderMiddleware

app = SessionHeaderMiddleware(
    to_a2a(root_agent, host=config.A2A_HOST, port=config.PLANNER_AGENT_PORT)
)
