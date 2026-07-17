"""Orchestrator service — the frontend-facing REST API (port 8080).

Preserves the exact HTTP contract the Next.js frontend depends on
(``/api/chat``, ``/api/trace``, ``/api/agents``, ``/api/profile``, ``/api/sessions``).

The chat workflow is a faithful port of the Java ``WorkflowOrchestrator``: it does
the MongoDB bookkeeping (sessions, agent_state) and then delegates to the Planner
— but now the Planner is reached over **A2A** (RemoteA2aAgent), not in-process.
Every hop from here on is a real network A2A call:

    orchestrator --A2A--> planner --A2A--> {profile, product}

Run: ``uvicorn app.services.orchestrator:app --host 0.0.0.0 --port 8080``
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

import httpx
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from google.adk.agents.remote_a2a_agent import AGENT_CARD_WELL_KNOWN_PATH, RemoteA2aAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel, Field

from ..common import config, context, mongo
from ..common.a2a import make_session_forwarding_client

APP_NAME = "retail-advisor"

# --- The orchestrator is an A2A client of the Planner ----------------------
_httpx_client = make_session_forwarding_client()
_remote_planner = RemoteA2aAgent(
    name="PlannerAgent",
    description="Retail advisor orchestrator agent.",
    agent_card=f"{config.PLANNER_AGENT_URL}{AGENT_CARD_WELL_KNOWN_PATH}",
    httpx_client=_httpx_client,
    use_legacy=False,
)
_session_service = InMemorySessionService()
_runner = Runner(app_name=APP_NAME, agent=_remote_planner, session_service=_session_service)


async def _run_planner(input_text: str, user_id: str) -> str:
    """Run the remote Planner via A2A and return its final synthesized text."""
    session = await _session_service.create_session(app_name=APP_NAME, user_id=user_id)
    final: Optional[str] = None
    async for event in _runner.run_async(
        user_id=user_id,
        session_id=session.id,
        new_message=types.Content(role="user", parts=[types.Part(text=input_text)]),
    ):
        if event.is_final_response() and event.content and event.content.parts:
            text = event.content.parts[0].text
            if text and text.strip():
                final = text.strip()
    return final or "I was unable to generate a response."


# --- API models (mirror the Java records / frontend TS interfaces) ---------
class ChatRequest(BaseModel):
    userId: str = Field(..., max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    message: str = Field(..., min_length=1, max_length=2000)
    sessionId: Optional[str] = Field(default=None, pattern=r"^[0-9a-fA-F-]{36}$")


class ChatResponse(BaseModel):
    reply: str
    sessionId: str
    toolCallCount: int


# --- helpers ---------------------------------------------------------------
def _clean(doc: Optional[dict]) -> dict:
    if not doc:
        return {}
    out = dict(doc)
    out.pop("_id", None)
    return out


def _iso(value: Any) -> str:
    return value.isoformat() if isinstance(value, datetime) else ""


# --- app -------------------------------------------------------------------
app = FastAPI(title="Retail Advisor — A2A Orchestrator")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    session_id = req.sessionId or str(uuid.uuid4())

    mongo.init_session(session_id, req.userId)
    mongo.append_message(session_id, "user", req.message)
    mongo.create_agent_state(session_id, "product_advisor")
    mongo.update_step(session_id, "planning")

    full_input = f"User ID: {req.userId}\nUser message: {req.message}"

    # Stamp the session id so the A2A client forwards it downstream (X-Session-Id),
    # letting the specialist tools correlate their tool_invocations to this session.
    context.set_session_id(session_id)
    try:
        mongo.update_step(session_id, "executing")
        reply = await _run_planner(full_input, req.userId)
        mongo.update_step(session_id, "synthesizing")
    except Exception as e:  # noqa: BLE001
        mongo.fail_agent_state(session_id, str(e))
        reply = "I'm sorry, I encountered an issue while processing your request. Please try again."
    finally:
        context.clear_session_id()

    mongo.append_message(session_id, "assistant", reply)

    tool_count = len(mongo.find_tool_invocations(session_id))
    mongo.complete_agent_state(
        session_id,
        {
            "tool_calls": tool_count,
            "agents_invoked": ["PlannerAgent", "ProductAgent", "ProfileAgent"],
        },
    )
    return ChatResponse(reply=reply, sessionId=session_id, toolCallCount=tool_count)


@app.get("/api/trace/{session_id}")
def get_trace(session_id: str) -> dict:
    return {
        "session": _clean(mongo.find_session(session_id)),
        "agentState": _clean(mongo.find_agent_state(session_id)),
        "toolInvocations": [_clean(t) for t in mongo.find_tool_invocations(session_id)],
    }


@app.get("/api/agents")
def list_agents() -> list[dict]:
    """A2A discovery: fetch each agent's real, spec-shaped card from its
    well-known endpoint and adapt it to the shape the frontend renders."""
    cards: list[dict] = []
    for base_url in (
        config.PLANNER_AGENT_URL,
        config.PROFILE_AGENT_URL,
        config.PRODUCT_AGENT_URL,
    ):
        try:
            resp = httpx.get(f"{base_url}{AGENT_CARD_WELL_KNOWN_PATH}", timeout=5.0)
            resp.raise_for_status()
            cards.append(_adapt_card(resp.json()))
        except Exception:  # noqa: BLE001 — a specialist may be starting up
            continue
    return cards


def _card_endpoint(card: dict) -> str:
    # a2a-sdk (protocol 0.3+) advertises the reachable endpoint via
    # supportedInterfaces; older/simple cards may use a top-level url.
    for iface in card.get("supportedInterfaces") or []:
        if iface.get("url"):
            return iface["url"]
    return card.get("url", "")


def _adapt_card(card: dict) -> dict:
    skills = [
        {
            "name": s.get("name", ""),
            "description": s.get("description", ""),
            "inputSchema": {},
            "outputDescription": "",
        }
        for s in (card.get("skills") or [])
        # Drop ADK's synthetic "model" skill; keep the real tool-backed skills.
        if s.get("name") and s.get("name") != "model"
    ]
    return {
        "name": card.get("name", ""),
        "description": card.get("description", ""),
        "version": card.get("version", ""),
        "endpoint": _card_endpoint(card),
        "skills": skills,
    }


@app.get("/api/profile/{user_id}")
def get_profile(user_id: str) -> dict:
    user = mongo.col(mongo.USERS).find_one({"_id": user_id})
    memory = mongo.col(mongo.USER_MEMORY).find_one({"user_id": user_id})
    return {"user": _clean(user), "memory": _clean(memory)}


@app.delete("/api/profile/{user_id}/memory", status_code=204)
def reset_memory(user_id: str) -> Response:
    mongo.col(mongo.USER_MEMORY).delete_one({"user_id": user_id})
    return Response(status_code=204)


@app.get("/api/sessions/user/{user_id}")
def list_sessions(user_id: str) -> list[dict]:
    result: list[dict] = []
    cursor = (
        mongo.col(mongo.SESSIONS)
        .find({"user_id": user_id})
        .sort("updated_at", mongo.DESCENDING)
        .limit(20)
    )
    for doc in cursor:
        messages = doc.get("messages") or []
        preview = ""
        for msg in messages:
            if msg.get("role") == "user":
                content = msg.get("content") or ""
                preview = content[:120] + "…" if len(content) > 120 else content
                break
        result.append(
            {
                "sessionId": doc.get("session_id"),
                "preview": preview,
                "messageCount": len(messages),
                "createdAt": _iso(doc.get("created_at")),
                "updatedAt": _iso(doc.get("updated_at")),
                "starred": bool(doc.get("starred")),
            }
        )
    return result


@app.put("/api/sessions/{session_id}/star", status_code=204)
def star_session(session_id: str, starred: bool) -> Response:
    mongo.col(mongo.SESSIONS).update_one(
        {"session_id": session_id}, {"$set": {"starred": starred}}
    )
    return Response(status_code=204)
