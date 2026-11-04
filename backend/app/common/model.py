"""LLM model factory.

Builds the Anthropic Claude model for ADK via LiteLLM. Works against the
Anthropic API directly or any Anthropic-compatible endpoint, authenticated with
the standard ``x-api-key`` header that LiteLLM derives from ``api_key`` — no
placeholder / ``extra_headers`` workaround is needed.

``LLM_BASE_URL`` is optional: when set, LiteLLM appends ``/v1/messages`` to it;
when unset, LiteLLM falls back to ``https://api.anthropic.com``.
"""
from __future__ import annotations

from google.adk.models.lite_llm import LiteLlm

from . import config


def _model_string() -> str:
    """Provider-agnostic model id for LiteLLM.

    If LLM_MODEL already carries a provider prefix (e.g. "openai/gpt-4o" or
    "anthropic/claude-..."), use it as-is; otherwise treat it as an Anthropic
    model. Swapping providers becomes a pure env change.
    """
    model = config.LLM_MODEL
    return model if "/" in model else f"anthropic/{model}"


def build_model() -> LiteLlm:
    kwargs: dict = {"api_key": config.LLM_API_KEY}
    if config.LLM_BASE_URL:
        kwargs["api_base"] = config.LLM_BASE_URL
    return LiteLlm(model=_model_string(), **kwargs)
