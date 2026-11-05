"""Shared LLM error handling for the agents.

When a model call fails — an unreachable or misconfigured gateway, an expired
key, a provider outage, a broken dependency — ADK re-raises the provider
exception. Left alone, that raw traceback (including LiteLLM's own "file a bug"
banner) travels back through A2A and is rendered verbatim in the chat UI.

Registering :func:`on_model_error` as an agent's ``on_model_error_callback``
short-circuits that path: ADK yields the returned ``LlmResponse`` instead of
re-raising (see ``google.adk.flows.llm_flows.base_llm_flow``). The user gets a
short, friendly message; the real error is logged server-side for debugging.
"""
from __future__ import annotations

import logging

from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.genai import types

log = logging.getLogger("retail_advisor.llm")

# Deliberately generic: the end user is a shopper, not an operator. Provider
# details (status codes, hostnames, stack traces) belong in the logs below.
USER_FACING_ERROR = (
    "Sorry — I couldn't reach the language model just now. "
    "Please try again in a moment."
)


def on_model_error(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
    error: Exception,
) -> LlmResponse:
    """ADK ``on_model_error`` callback: log the real error, return a clean reply.

    ADK invokes this with the keyword arguments ``callback_context``,
    ``llm_request`` and ``error``, and suppresses the re-raise whenever a
    response is returned.
    """
    log.error(
        "LLM call failed for agent %s: %s",
        getattr(callback_context, "agent_name", "agent"),
        error,
        exc_info=error,
    )
    return LlmResponse(
        content=types.Content(role="model", parts=[types.Part(text=USER_FACING_ERROR)])
    )
