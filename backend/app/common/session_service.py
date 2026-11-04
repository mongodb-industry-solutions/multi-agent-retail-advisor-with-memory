"""MongoDB-backed ADK session service.

Persists the model's conversation context in the same MongoDB the rest of the
demo uses, so it lives in the agentic data plane rather than in each process's
memory — surviving restarts and shared across replicas.

There is a single ``adk_events`` collection: one document per ADK event (user
message, model reply, tool call/response), keyed by ``(app_name, user_id,
session_id)`` and ordered by ``timestamp``. No separate session document is
needed — the demo doesn't use ADK ``state``, so a session is fully described by
its events (existence, history, last update). One document per event also keeps
each write bounded, so a long conversation can't hit MongoDB's 16 MB document
limit.

Every service uses this: the orchestrator keys sessions by the app's own
``sessionId``, and each A2A agent keys them by the A2A ``context_id`` — so the
model's short-term context and the app's transcript are the same conversation.
"""

from __future__ import annotations

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

ADK_EVENTS = "adk_events"


class MongoSessionService(BaseSessionService):
    """ADK session service backed by the ``adk_events`` collection.

    A session is derived entirely from its events — there is no session
    document. PyMongo is synchronous, so each database call is offloaded to a
    worker thread (the same pattern the orchestrator uses for its Mongo access).
    """

    def __init__(self, events_collection: str = ADK_EVENTS) -> None:
        self._events_name = events_collection
        self._events = None
        self._index_ensured = False

    # --- lazy handle (don't touch Mongo at import time) --------------------
    def _events_col(self):
        if self._events is None:
            self._events = mongo.col(self._events_name)
        return self._events

    def _ensure_index(self) -> None:
        if self._index_ensured:
            return
        self._events_col().create_index(
            [("app_name", 1), ("user_id", 1), ("session_id", 1), ("timestamp", 1)],
            name="events_by_session",
        )
        self._index_ensured = True

    @staticmethod
    def _key(app_name: str, user_id: str, session_id: str) -> dict[str, str]:
        return {"app_name": app_name, "user_id": user_id, "session_id": session_id}

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

    def _latest(self, app_name: str, user_id: str, session_id: str) -> Optional[dict]:
        return self._events_col().find_one(
            self._key(app_name, user_id, session_id),
            sort=[("timestamp", -1)],
            projection={"timestamp": 1},
        )

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
            self._ensure_index()
            sid = (session_id or "").strip() or platform_uuid.new_uuid()
            # A session is defined by its events; existing events for this id
            # mean the session already exists (mirrors the in-memory contract).
            if self._events_col().find_one(self._key(app_name, user_id, sid)):
                raise AlreadyExistsError(f"Session with id {sid} already exists.")
            return Session(
                id=sid,
                app_name=app_name,
                user_id=user_id,
                state=state or {},
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
            latest = self._latest(app_name, user_id, session_id)
            if latest is None:
                return None  # no events => the session doesn't exist yet
            return Session(
                id=session_id,
                app_name=app_name,
                user_id=user_id,
                state={},
                events=self._load_events(app_name, user_id, session_id, config),
                last_update_time=latest.get("timestamp", 0.0),
            )

        return await anyio.to_thread.run_sync(_get)

    async def list_sessions(
        self, *, app_name: str, user_id: Optional[str] = None
    ) -> ListSessionsResponse:
        def _list() -> ListSessionsResponse:
            match: dict[str, Any] = {"app_name": app_name}
            if user_id is not None:
                match["user_id"] = user_id
            pipeline = [
                {"$match": match},
                {
                    "$group": {
                        "_id": {"session_id": "$session_id", "user_id": "$user_id"},
                        "last_update_time": {"$max": "$timestamp"},
                    }
                },
            ]
            return ListSessionsResponse(
                sessions=[
                    Session(
                        id=doc["_id"]["session_id"],
                        app_name=app_name,
                        user_id=doc["_id"]["user_id"],
                        state={},
                        events=[],
                        last_update_time=doc.get("last_update_time", 0.0),
                    )
                    for doc in self._events_col().aggregate(pipeline)
                ]
            )

        return await anyio.to_thread.run_sync(_list)

    async def delete_session(
        self, *, app_name: str, user_id: str, session_id: str
    ) -> None:
        await anyio.to_thread.run_sync(
            lambda: self._events_col().delete_many(
                self._key(app_name, user_id, session_id)
            )
        )

    async def append_event(self, session: Session, event: Event) -> Event:
        if event.partial:
            return event
        # Apply temp state / state delta and append to the in-memory session.
        await super().append_event(session=session, event=event)
        session.last_update_time = event.timestamp

        def _persist() -> None:
            self._ensure_index()
            self._events_col().insert_one(
                {
                    **self._key(session.app_name, session.user_id, session.id),
                    "event_id": event.id,
                    "timestamp": event.timestamp,
                    "event_data": event.model_dump(mode="json"),
                }
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
        # No session document exists until there are events, so the Runner must
        # create the session on first use.
        auto_create_session=True,
    )
