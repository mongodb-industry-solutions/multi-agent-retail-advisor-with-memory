"""MongoDB access layer — the shared agentic data plane.

A faithful port of the Java ``mongodb`` package (MongoCollections + the three
repositories). Field names and document shapes are kept identical so existing
seeded data, the frontend, and the trace endpoint continue to work unchanged.

Uses the synchronous PyMongo driver; callers that touch these from async code
run them via ``def`` route handlers / sync ADK tools so Starlette/ADK offload
them to a worker thread rather than blocking the event loop.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from pymongo import ASCENDING, DESCENDING, MongoClient

from . import config

# --- Collection + index names (was MongoCollections.java) ---
PRODUCTS = "products"
USERS = "users"
USER_MEMORY = "user_memory"
SESSIONS = "sessions"
AGENT_STATE = "agent_state"
TOOL_INVOCATIONS = "tool_invocations"

VECTOR_INDEX_NAME = "product_vector_index"
SEARCH_INDEX_NAME = "product_text_index"

_client: Optional[MongoClient] = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(config.MONGODB_URI)
    return _client


def get_db():
    return get_client()[config.MONGODB_DATABASE]


def col(name: str):
    return get_db()[name]


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --- sessions (was SessionRepository) ---
def init_session(session_id: str, user_id: str) -> None:
    sessions = col(SESSIONS)
    if sessions.find_one({"session_id": session_id}) is None:
        sessions.insert_one(
            {
                "session_id": session_id,
                "user_id": user_id,
                "messages": [],
                "created_at": _now(),
                "updated_at": _now(),
            }
        )


def append_message(session_id: str, role: str, content: str) -> None:
    col(SESSIONS).update_one(
        {"session_id": session_id},
        {
            "$push": {"messages": {"role": role, "content": content, "timestamp": _now()}},
            "$set": {"updated_at": _now()},
        },
    )


def find_session(session_id: str) -> Optional[dict]:
    return col(SESSIONS).find_one({"session_id": session_id})


# --- agent_state (was AgentStateRepository) ---
def create_agent_state(session_id: str, workflow_type: str) -> None:
    # Upsert keyed by session_id: the frontend reuses a sessionId across turns, so
    # inserting unconditionally would create duplicate agent_state docs (and make
    # find_agent_state return an arbitrary one). Reset the state fields instead;
    # preserve created_at and clear any stale error from a prior failed turn.
    now = _now()
    col(AGENT_STATE).update_one(
        {"session_id": session_id},
        {
            "$set": {
                "workflow_type": workflow_type,
                "status": "running",
                "current_step": "initializing",
                "context": {},
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
            "$unset": {"error": ""},
        },
        upsert=True,
    )


def update_step(session_id: str, step: str) -> None:
    col(AGENT_STATE).update_one(
        {"session_id": session_id},
        {"$set": {"current_step": step, "updated_at": _now()}},
    )


def complete_agent_state(session_id: str, context: dict[str, Any]) -> None:
    col(AGENT_STATE).update_one(
        {"session_id": session_id},
        {
            "$set": {
                "status": "completed",
                "current_step": "done",
                "context": context,
                "updated_at": _now(),
            }
        },
    )


def fail_agent_state(session_id: str, error_message: str) -> None:
    col(AGENT_STATE).update_one(
        {"session_id": session_id},
        {"$set": {"status": "failed", "error": error_message, "updated_at": _now()}},
    )


def find_agent_state(session_id: str) -> Optional[dict]:
    return col(AGENT_STATE).find_one({"session_id": session_id})


# --- tool_invocations (was ToolInvocationRepository) ---
def log_tool_invocation(
    session_id: str,
    agent_name: str,
    tool_name: str,
    input_json: str,
    output: str,
    latency_ms: int,
    error: Optional[str] = None,
) -> None:
    doc = {
        "session_id": session_id,
        "agent_name": agent_name,
        "tool_name": tool_name,
        "input": input_json,
        "output": output,
        "latency_ms": latency_ms,
        "timestamp": _now(),
    }
    if error is not None:
        doc["error"] = error
    col(TOOL_INVOCATIONS).insert_one(doc)


def find_tool_invocations(session_id: str) -> list[dict]:
    return list(
        col(TOOL_INVOCATIONS)
        .find({"session_id": session_id})
        .sort("timestamp", ASCENDING)
    )
