"""Centralized configuration, loaded from environment (.env in local dev).

Mirrors the config keys the Java backend used (MONGODB_URI, MONGODB_DATABASE,
LLM_API_KEY, LLM_BASE_URL, ANTHROPIC_MODEL) and adds the A2A service endpoints
the orchestrator needs to discover the specialist agents.
"""
from __future__ import annotations

import os

from dotenv import load_dotenv

# Load .env for local development; silently ignored when the file is absent
# (e.g. in Docker, where env vars come from the compose env_file / environment).
load_dotenv()

# --- MongoDB (the agentic data plane) ---
MONGODB_URI: str = os.environ.get("MONGODB_URI", "")
MONGODB_DATABASE: str = os.environ.get("MONGODB_DATABASE", "retail_advisor_demo")

# --- LLM gateway (Anthropic via Azure API Management) ---
# The gateway requires an "api-key" header instead of the standard x-api-key;
# see common.model.build_model for how that is wired through LiteLLM.
LLM_API_KEY: str = os.environ.get("LLM_API_KEY", "")
LLM_BASE_URL: str = os.environ.get("LLM_BASE_URL", "")
ANTHROPIC_MODEL: str = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")

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

# --- CORS (frontend origins) ---
CORS_ORIGINS: list[str] = [
    o.strip()
    for o in os.environ.get(
        "CORS_ORIGINS", "http://localhost:3000,http://localhost:3001"
    ).split(",")
    if o.strip()
]
