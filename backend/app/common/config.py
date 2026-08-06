"""Centralized configuration, loaded from environment (.env in local dev).

Covers MongoDB, the LLM gateway (LLM_MODEL), the Voyage retrieval models, and the
A2A service endpoints the orchestrator needs to discover the specialist agents.
"""
from __future__ import annotations

import os

from dotenv import load_dotenv

# Load .env for local development; silently ignored when the file is absent
# (e.g. in Docker, where env vars come from the compose env_file / environment).
load_dotenv()

# --- MongoDB (the agentic data plane) ---
MONGODB_URI: str = os.environ.get("MONGODB_URI", "")
MONGODB_DATABASE: str = os.environ.get("MONGODB_DATABASE", "multi-agent-retail-advisor")

# --- LLM gateway (Anthropic via Azure API Management) ---
# The gateway requires an "api-key" header instead of the standard x-api-key;
# see common.model.build_model for how that is wired through LiteLLM.
LLM_API_KEY: str = os.environ.get("LLM_API_KEY", "")
LLM_BASE_URL: str = os.environ.get("LLM_BASE_URL", "")
# Provider-agnostic chat model. If the value carries a provider prefix
# (e.g. "openai/gpt-4o"), build_model uses it verbatim; otherwise it is treated
# as an Anthropic model.
LLM_MODEL: str = os.environ.get("LLM_MODEL", "claude-sonnet-4-5")

# --- Retrieval models (Voyage 4 asymmetric embedding + native reranking) ---
# Documents are embedded once with the flagship model; on-the-run queries use a
# lighter, cheaper model from the same shared embedding space (asymmetric
# retrieval). Native reranking then restores top-end quality on the candidates.
VOYAGE_DOC_MODEL: str = os.environ.get("VOYAGE_DOC_MODEL", "voyage-4-large")
VOYAGE_QUERY_MODEL: str = os.environ.get("VOYAGE_QUERY_MODEL", "voyage-4-lite")
RERANK_MODEL: str = os.environ.get("RERANK_MODEL", "rerank-2.5")
RERANK_CANDIDATES: int = int(os.environ.get("RERANK_CANDIDATES", "25"))

# --- A2A topology ---
# Base URLs where each agent publishes its A2A card. In docker-compose these
# resolve to the service DNS names; locally they default to loopback ports.
# Every agent hop in this system is a real A2A call:
#   orchestrator (/api) --A2A--> planner --A2A--> {profile, product}
PLANNER_AGENT_URL: str = os.environ.get("PLANNER_AGENT_URL", "http://localhost:8081")
PROFILE_AGENT_URL: str = os.environ.get("PROFILE_AGENT_URL", "http://localhost:9091")
PRODUCT_AGENT_URL: str = os.environ.get("PRODUCT_AGENT_URL", "http://localhost:9092")

# Host advertised in an agent's own A2A card `url` (what callers will dial back).
# In docker-compose set this to the service name so cross-container calls resolve.
A2A_HOST: str = os.environ.get("A2A_HOST", "localhost")

# --- Ports ---
PORT: int = int(os.environ.get("PORT", "8080"))
PLANNER_AGENT_PORT: int = int(os.environ.get("PLANNER_AGENT_PORT", "8081"))
PROFILE_AGENT_PORT: int = int(os.environ.get("PROFILE_AGENT_PORT", "9091"))
PRODUCT_AGENT_PORT: int = int(os.environ.get("PRODUCT_AGENT_PORT", "9092"))

# Port advertised in each agent's own A2A card `url` — this is what other pods
# actually dial for every call, which is not necessarily the container's bind
# port above: a Kubernetes Service can map an external port (e.g. 80) to a
# different container targetPort, so the two need to be independently
# configurable. Defaults to the bind port, matching local/docker-compose where
# there's no such indirection.
PLANNER_A2A_PORT: int = int(os.environ.get("PLANNER_A2A_PORT", str(PLANNER_AGENT_PORT)))
PROFILE_A2A_PORT: int = int(os.environ.get("PROFILE_A2A_PORT", str(PROFILE_AGENT_PORT)))
PRODUCT_A2A_PORT: int = int(os.environ.get("PRODUCT_A2A_PORT", str(PRODUCT_AGENT_PORT)))

# --- CORS (frontend origins) ---
CORS_ORIGINS: list[str] = [
    o.strip()
    for o in os.environ.get(
        "CORS_ORIGINS", "http://localhost:3000,http://localhost:3001"
    ).split(",")
    if o.strip()
]
