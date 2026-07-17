"""The four MongoDB-backed ADK tools.

A faithful port of the Java ``tools`` package. Each tool writes an audit record
to ``tool_invocations`` stamped with the originating session id, which in this
distributed A2A topology arrives via the ``X-Session-Id`` header set by the
orchestrator and stashed in a contextvar (see ``services`` + ``common.context``).

Tools are plain **synchronous** functions so ADK runs them in a worker thread —
that keeps the synchronous PyMongo calls off the asyncio event loop. A parameter
annotated ``tool_context: ToolContext`` is injected by ADK and hidden from the LLM.
"""
from __future__ import annotations

import json
import time
from typing import Any, Optional

from google.adk.tools import ToolContext

from . import context, mongo


# --- helpers ---------------------------------------------------------------
def _resolve_session_id(tool_context: Optional[ToolContext]) -> Optional[str]:
    """Session id for the audit log: header-propagated contextvar first, then
    fall back to the ADK invocation's session id if present."""
    sid = context.get_session_id()
    if sid:
        return sid
    try:
        if tool_context is not None and tool_context.session is not None:
            return tool_context.session.id
    except Exception:
        pass
    return None


def _dumps(value: Any) -> str:
    return json.dumps(value, default=str)


def _sanitize(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


def _audit(
    tool_context: Optional[ToolContext],
    agent_name: str,
    tool_name: str,
    args: dict,
    result: str,
    start: float,
    error: Optional[str],
) -> None:
    latency_ms = int((time.time() - start) * 1000)
    session_id = _resolve_session_id(tool_context)
    if session_id:
        mongo.log_tool_invocation(
            session_id, agent_name, tool_name, _dumps(args), result, latency_ms, error
        )


# --- ProductAgent tool -----------------------------------------------------
def _build_filters(
    max_price: Optional[float],
    size: Optional[str],
    waterproof: Optional[bool],
    eco_friendly: Optional[bool],
    category: Optional[str],
) -> list[dict]:
    filters: list[dict] = []
    if max_price is not None:
        filters.append({"price": {"$lte": max_price}})
    if size is not None:
        filters.append({"size_options": size})
    if waterproof is True:
        filters.append({"attributes.waterproof": True})
    if eco_friendly is True:
        filters.append({"attributes.eco_friendly": True})
    if category is not None:
        filters.append({"category": category})
    return filters


def _execute_and_serialize(pipeline: list[dict]) -> str:
    results = list(mongo.col(mongo.PRODUCTS).aggregate(pipeline))
    for doc in results:
        doc.pop("_id", None)
    return _dumps(results)


def _vector_search(query, max_price, size, waterproof, eco_friendly, category) -> str:
    pre_filters = _build_filters(max_price, size, waterproof, eco_friendly, category)
    vector_stage: dict = {
        "index": mongo.VECTOR_INDEX_NAME,
        "path": "search_text",
        "query": query,
        "numCandidates": 200,
        "limit": 5,
    }
    if pre_filters:
        vector_stage["filter"] = {"$and": pre_filters}
    pipeline = [
        {"$vectorSearch": vector_stage},
        {"$addFields": {"score": {"$meta": "vectorSearchScore"}}},
        {"$project": {"_id": 0, "search_text": 0}},
    ]
    return _execute_and_serialize(pipeline)


def _text_search(query, max_price, size, waterproof, eco_friendly, category) -> str:
    filters = _build_filters(max_price, size, waterproof, eco_friendly, category)
    pipeline: list[dict] = [
        {
            "$search": {
                "index": mongo.SEARCH_INDEX_NAME,
                "compound": {
                    "should": [
                        {"text": {"query": query, "path": ["name", "description", "brand"]}}
                    ]
                },
            }
        }
    ]
    if filters:
        pipeline.append({"$match": {"$and": filters}})
    pipeline.append({"$limit": 5})
    pipeline.append({"$project": {"_id": 0, "search_text": 0}})
    return _execute_and_serialize(pipeline)


def search_products(
    query: str,
    max_price: Optional[float] = None,
    size: Optional[str] = None,
    waterproof: Optional[bool] = None,
    eco_friendly: Optional[bool] = None,
    category: Optional[str] = None,
    tool_context: ToolContext = None,
) -> dict:
    """Search the product catalog using semantic vector search combined with structured filters.

    Returns the most relevant products matching the query and filters.

    Args:
        query: Natural language search query for product discovery.
        max_price: Maximum price in USD (optional).
        size: Shoe size or clothing size (optional, e.g. '10' or 'M').
        waterproof: Filter for waterproof products (optional).
        eco_friendly: Filter for eco-friendly / sustainable products (optional).
        category: Product category slug (optional): rain_jackets, fleece_jackets,
            down_jackets, softshell_jackets, hiking_pants, trail_shorts, base_layers,
            hiking_boots, trail_shoes, approach_shoes, sandals, backpacks,
            trekking_poles, headlamps, socks, sleeping_bags, gloves_headwear.
    """
    start = time.time()
    args = {
        "query": query,
        "max_price": max_price,
        "size": size,
        "waterproof": waterproof,
        "eco_friendly": eco_friendly,
        "category": category,
    }
    error = None
    try:
        try:
            result = _vector_search(query, max_price, size, waterproof, eco_friendly, category)
        except Exception as e:  # noqa: BLE001 — vector search unavailable → text fallback
            result = _text_search(query, max_price, size, waterproof, eco_friendly, category)
    except Exception as e:  # noqa: BLE001
        error = str(e)
        result = '{"error": "Product search failed"}'
    _audit(tool_context, "ProductAgent", "search_products", args, result, start, error)
    return {"result": result}


# --- ProfileAgent tools ----------------------------------------------------
def get_user_profile(user_id: str, tool_context: ToolContext = None) -> dict:
    """Retrieve a user's profile including their preferences, sizes, experience level, and favorite brands.

    Args:
        user_id: The user's unique identifier.
    """
    start = time.time()
    error = None
    try:
        user = mongo.col(mongo.USERS).find_one({"_id": user_id})
        if user is None:
            result = '{"error": "User not found"}'
        else:
            result = _dumps(_sanitize(user))
    except Exception as e:  # noqa: BLE001
        error = str(e)
        result = '{"error": "Failed to retrieve user profile"}'
    _audit(tool_context, "ProfileAgent", "get_user_profile", {"user_id": user_id}, result, start, error)
    return {"result": result}


def get_user_memory(user_id: str, tool_context: ToolContext = None) -> dict:
    """Retrieve long-term memory facts about a user — past preferences, purchase history hints, stated interests, and prior interaction context.

    Args:
        user_id: The user's unique identifier.
    """
    start = time.time()
    error = None
    try:
        memories = list(mongo.col(mongo.USER_MEMORY).find({"user_id": user_id}))
        if not memories:
            result = _dumps(
                {"user_id": user_id, "facts": [], "note": "No memory stored for this user yet"}
            )
        else:
            result = _dumps(_sanitize(memories[0]))
    except Exception as e:  # noqa: BLE001
        error = str(e)
        result = '{"error": "Failed to retrieve user memory"}'
    _audit(tool_context, "ProfileAgent", "get_user_memory", {"user_id": user_id}, result, start, error)
    return {"result": result}


def update_user_memory(
    user_id: str, new_facts: list[str], tool_context: ToolContext = None
) -> dict:
    """Persist new facts about the user into long-term memory.

    Call this when you learn something meaningful: a new preference, size, brand
    interest, activity, or budget constraint.

    Args:
        user_id: The user's unique identifier.
        new_facts: List of concise fact strings to add to the user's long-term memory.
    """
    start = time.time()
    args = {"user_id": user_id, "new_facts": new_facts}
    error = None
    try:
        facts = [str(f) for f in (new_facts or [])]
        mongo.col(mongo.USER_MEMORY).update_one(
            {"user_id": user_id},
            {
                "$push": {"facts": {"$each": facts}},
                "$set": {"updated_at": mongo._now()},
            },
            upsert=True,
        )
        result = _dumps({"status": "ok", "user_id": user_id, "facts_added": len(facts)})
    except Exception as e:  # noqa: BLE001
        error = str(e)
        result = '{"error": "Failed to update user memory"}'
    _audit(tool_context, "ProfileAgent", "update_user_memory", args, result, start, error)
    return {"result": result}
