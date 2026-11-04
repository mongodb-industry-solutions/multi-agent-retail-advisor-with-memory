"""MongoDB-backed ADK session service.

Persists ADK sessions and their events in the same MongoDB the rest of the demo
uses, so a conversation's model context lives in the agentic data plane rather
than only in each process's memory — it survives restarts and is shared across
replicas.

Two collections, to keep session documents small and bounded:

* ``adk_sessions`` — one document per ``(app_name, user_id, session_id)`` holding
  the session state and last-update time.
* ``adk_events`` — one document per event, keyed by the same triple and ordered
  by ``timestamp``. (Storing events as an ever-growing array inside the session
  document would risk the 16 MB limit for long conversations.)

Every service uses this: the orchestrator keys sessions by the app's own
``sessionId``, and each A2A agent keys them by the A2A ``context_id`` — so the
model's short-term context and the app's transcript are the same conversation.

Note: only session-scoped state is persisted; the demo doesn't use the
``app:``/``user:``/``temp:`` state prefixes.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

import anyio
from google.adk.errors.already_exists_error import AlreadyExistsError
from google.adk.events.event import Event
from google.adk.platform import uuid as platform_uuid
from google.adk.runners import Runner
from google.adk.sessions.base_session_service import (
    BaseSessionService,
    GetSessionConfig,
    ListSessionsResponse,
)
from google.adk.sessions.session import Session

from . import mongo

ADK_SESSIONS = "adk_sessions"
ADK_EVENTS = "adk_events"


def _now() -> datetime:
    return datetime.now(timezone.utc)


class MongoSessionService(BaseSessionService):
    """ADK session service backed by MongoDB.

    PyMongo is synchronous, so each database call is offloaded to a worker
    thread — the same pattern the orchestrator uses for its own Mongo access.
    """

    def __init__(
        self,
        sessions_collection: str = ADK_SESSIONS,
        events_collection: str = ADK_EVENTS,
    ) -> None:
        self._sessions_name = sessions_collection
        self._events_name = events_collection
        self._sessions = None
        self._events = None
        self._indexes_ensured = False

    # --- lazy handles (don't touch Mongo at import time) -------------------
    def _sessions_col(self):
        if self._sessions is None:
            self._sessions = mongo.col(self._sessions_name)
        return self._sessions

    def _events_col(self):
        if self._events is None:
            self._events = mongo.col(self._events_name)
        return self._events

    def _ensure_indexes(self) -> None:
        if self._indexes_ensured:
            return
        self._sessions_col().create_index(
            [("app_name", 1), ("user_id", 1), ("session_id", 1)],
            unique=True,
            name="uniq_app_user_session",
        )
        self._events_col().create_index(
            [("app_name", 1), ("user_id", 1), ("session_id", 1), ("timestamp", 1)],
            name="events_by_session",
        )
        self._indexes_ensured = True

    @staticmethod
    def _key(app_name: str, user_id: str, session_id: str) -> dict[str, str]:
        return {"app_name": app_name, "user_id": user_id, "session_id": session_id}

    # --- BaseSessionService ------------------------------------------------
    async def create_session(
        self,
        *,
        app_name: str,
        user_id: str,
        state: Optional[dict[str, Any]] = None,
        session_id: Optional[str] = None,
    ) -> Session:
        def _create() -> Session:
            self._ensure_indexes()
            sid = (session_id or "").strip() or platform_uuid.new_uuid()
            if self._sessions_col().find_one(self._key(app_name, user_id, sid)):
                raise AlreadyExistsError(f"Session with id {sid} already exists.")
            initial_state = state or {}
            self._sessions_col().insert_one(
                {
                    **self._key(app_name, user_id, sid),
                    "state": initial_state,
                    "last_update_time": 0.0,
                    "created_at": _now(),
                    "updated_at": _now(),
                }
            )
            return Session(
                id=sid,
                app_name=app_name,
                user_id=user_id,
                state=initial_state,
                events=[],
                last_update_time=0.0,
            )

        return await anyio.to_thread.run_sync(_create)

    async def get_session(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str,
        config: Optional[GetSessionConfig] = None,
    ) -> Optional[Session]:
        def _get() -> Optional[Session]:
            doc = self._sessions_col().find_one(
                self._key(app_name, user_id, session_id)
            )
            if doc is None:
                return None
            events = self._load_events(app_name, user_id, session_id, config)
            return Session(
                id=doc["session_id"],
                app_name=doc["app_name"],
                user_id=doc["user_id"],
                state=doc.get("state") or {},
                events=events,
                last_update_time=doc.get("last_update_time", 0.0),
            )

        return await anyio.to_thread.run_sync(_get)

    def _load_events(
        self,
        app_name: str,
        user_id: str,
        session_id: str,
        config: Optional[GetSessionConfig],
    ) -> list[Event]:
        query: dict[str, Any] = self._key(app_name, user_id, session_id)
        if config and config.after_timestamp is not None:
            query["timestamp"] = {"$gte": config.after_timestamp}
        events = [
            Event.model_validate(doc["event_data"])
            for doc in self._events_col().find(query)
        ]
        events.sort(key=lambda event: event.timestamp)
        if config and config.num_recent_events is not None:
            n = config.num_recent_events
            events = events[-n:] if n > 0 else []
        return events

    async def list_sessions(
        self, *, app_name: str, user_id: Optional[str] = None
    ) -> ListSessionsResponse:
        def _list() -> ListSessionsResponse:
            query: dict[str, Any] = {"app_name": app_name}
            if user_id is not None:
                query["user_id"] = user_id
            return ListSessionsResponse(
                sessions=[
                    Session(
                        id=doc["session_id"],
                        app_name=doc["app_name"],
                        user_id=doc["user_id"],
                        state=doc.get("state") or {},
                        events=[],
                        last_update_time=doc.get("last_update_time", 0.0),
                    )
                    for doc in self._sessions_col().find(query)
                ]
            )

        return await anyio.to_thread.run_sync(_list)

    async def delete_session(
        self, *, app_name: str, user_id: str, session_id: str
    ) -> None:
        def _delete() -> None:
            key = self._key(app_name, user_id, session_id)
            self._sessions_col().delete_one(key)
            self._events_col().delete_many(key)

        await anyio.to_thread.run_sync(_delete)

    async def append_event(self, session: Session, event: Event) -> Event:
        if event.partial:
            return event
        # Apply temp state / state delta and append to the in-memory session.
        await super().append_event(session=session, event=event)
        session.last_update_time = event.timestamp

        def _persist() -> None:
            self._ensure_indexes()
            key = self._key(session.app_name, session.user_id, session.id)
            self._events_col().insert_one(
                {
                    **key,
                    "event_id": event.id,
                    "timestamp": event.timestamp,
                    "event_data": event.model_dump(mode="json"),
                }
            )
            self._sessions_col().update_one(
                key,
                {
                    "$set": {
                        "state": session.state,
                        "last_update_time": event.timestamp,
                        "updated_at": _now(),
                    }
                },
            )

        await anyio.to_thread.run_sync(_persist)
        return event


def build_a2a_runner(agent) -> Runner:
    """Build a Runner whose sessions persist in MongoDB.

    Mirrors ``to_a2a``'s default runner (in-memory artifact/memory/credential
    services) but swaps the session service, so each A2A agent's conversation —
    addressed by the A2A ``context_id`` — is stored in the data plane.
    """
    from google.adk.artifacts.in_memory_artifact_service import InMemoryArtifactService
    from google.adk.auth.credential_service.in_memory_credential_service import (
        InMemoryCredentialService,
    )
    from google.adk.memory.in_memory_memory_service import InMemoryMemoryService

    return Runner(
        app_name=agent.name,
        agent=agent,
        session_service=MongoSessionService(),
        artifact_service=InMemoryArtifactService(),
        memory_service=InMemoryMemoryService(),
        credential_service=InMemoryCredentialService(),
    )
