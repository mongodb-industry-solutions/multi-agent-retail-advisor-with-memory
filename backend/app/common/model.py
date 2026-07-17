"""LLM model factory.

Builds the Anthropic Claude model for ADK via LiteLLM, routed through the Azure
API Management gateway. The gateway requires the credential in an ``api-key``
header instead of Anthropic's default ``x-api-key`` — so, exactly like the Java
``AppConfig``, we send a placeholder API key (to satisfy the client) and inject
the real credential through ``extra_headers``.

If the gateway's base URL already includes the ``/v1/messages`` suffix that
LiteLLM would otherwise append, set ``LITELLM_ANTHROPIC_DISABLE_URL_SUFFIX=true``
in the environment.
"""
from __future__ import annotations

from google.adk.models.lite_llm import LiteLlm

from . import config


def build_model() -> LiteLlm:
    kwargs: dict = {
        "api_key": "placeholder",
        "extra_headers": {"api-key": config.LLM_API_KEY},
    }
    if config.LLM_BASE_URL:
        kwargs["api_base"] = config.LLM_BASE_URL
    return LiteLlm(model=f"anthropic/{config.ANTHROPIC_MODEL}", **kwargs)
