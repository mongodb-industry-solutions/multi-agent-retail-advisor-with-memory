# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A retail product advisor **multi-agent demo** showcasing:
- **Google ADK (Python)** orchestration with a Planner delegating to specialist sub-agents
- **Real A2A (Agent-to-Agent) protocol** — each agent is an independent service that publishes a spec-compliant AgentCard at `/.well-known/agent-card.json` and communicates over **JSON-RPC 2.0**. Agents talk over the network, not via in-process calls.
- **MongoDB Atlas as the agentic data plane** — product catalog, user profiles, long-term memory, session history, orchestration state, and tool audit logs all live there
- **Anthropic** as the LLM, via LiteLLM through an Azure API Management gateway

The backend is Python (FastAPI + ADK + a2a-sdk); the frontend is Next.js. Everything runs via Docker Compose.

## Topology

Five services (see `docker-compose.yml`). Every agent hop is a real A2A JSON-RPC call:

```
frontend (:3000) → orchestrator (:8080) --A2A--> planner (:8081) --A2A--> profile (:9091)
                                                                    └----A2A--> product (:9092)
```

- **orchestrator** (`app.services.orchestrator`) — FastAPI, the frontend-facing `/api/*` REST API + MongoDB bookkeeping. An A2A *client* of the planner.
- **planner-agent-service** (`app.services.planner_server`) — PlannerAgent exposed via A2A; the external A2A entrypoint.
- **profile-agent-service** (`app.services.profile_server`) — ProfileAgent via A2A.
- **product-agent-service** (`app.services.product_server`) — ProductAgent via A2A.

All four backend services share one image (`backend/Dockerfile`) run with different uvicorn targets.

## Commands

### Running the stack

```bash
docker compose up -d
docker compose logs -f orchestrator
docker compose build && docker compose up -d      # rebuild after code changes
docker compose down
```

### Local dev (no Docker)

```bash
cd backend
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# each server reads backend/.env; run in separate terminals:
uvicorn app.services.profile_server:app --port 9091
uvicorn app.services.product_server:app --port 9092
uvicorn app.services.planner_server:app --port 8081
uvicorn app.services.orchestrator:app  --port 8080
```

### Data Seeding

```bash
pip install -r helpers/requirements.txt
python helpers/seed.py            # first run
python helpers/seed.py --force    # replace catalog
```

Only needed once — all data lives in MongoDB afterwards.

## Environment Setup

`backend/.env` holds secrets (see `backend/.env.example`):

| Variable | Description |
|---|---|
| `MONGODB_URI` | Atlas connection string |
| `MONGODB_DATABASE` | Database name |
| `LLM_API_KEY` | Azure API Management key for Claude |
| `LLM_BASE_URL` | Azure gateway URL |
| `ANTHROPIC_MODEL` | Model ID (e.g. `claude-sonnet-4-5`) |

The A2A topology vars (`PLANNER_AGENT_URL`, `PROFILE_AGENT_URL`, `PRODUCT_AGENT_URL`, `A2A_HOST`, ports) are injected per service by `docker-compose.yml`; locally they default to loopback (`app/common/config.py`).

**LLM header note:** the Azure gateway needs an `api-key` header instead of the standard `x-api-key`. `app/common/model.py` sends a placeholder api key and injects the real credential via LiteLLM `extra_headers`. If the gateway URL already includes `/v1/messages`, set `LITELLM_ANTHROPIC_DISABLE_URL_SUFFIX=true`.

## Architecture

### Backend package structure (`backend/app/`)

```
app/
├── common/          # framework-neutral shared layer
│   ├── config.py    # env-driven configuration
│   ├── mongo.py     # PyMongo client + collection names + repositories
│   ├── model.py     # LiteLlm(Anthropic) factory (Azure gateway header)
│   ├── tools.py     # the 4 ADK tools (search_products + 3 profile/memory tools)
│   ├── context.py   # contextvar carrying session_id across the request
│   └── a2a.py       # httpx client that forwards X-Session-Id downstream
├── agents/          # ADK agent definitions
│   ├── product_agent.py   # LlmAgent + search_products
│   ├── profile_agent.py   # LlmAgent + memory tools
│   └── planner_agent.py   # LlmAgent whose tools are RemoteA2aAgents (A2A client)
└── services/        # deployable ASGI apps (uvicorn targets)
    ├── orchestrator.py         # FastAPI: /api/* + calls planner over A2A
    ├── planner_server.py       # to_a2a(planner)
    ├── profile_server.py       # to_a2a(profile)
    ├── product_server.py       # to_a2a(product)
    └── session_middleware.py   # pure-ASGI: X-Session-Id header → contextvar
```

### Request flow

`POST /api/chat` → orchestrator writes `sessions` + `agent_state`, sets the `session_id` contextvar, then runs a `RemoteA2aAgent(planner)` via an ADK `Runner`. The planner (in its own service) fans out to Profile and Product over A2A. Each specialist tool writes to `tool_invocations`. The orchestrator counts them and completes `agent_state`.

### MongoDB Collections

| Collection | Purpose |
|---|---|
| `products` | Catalog with `search_text` auto-embedded by Atlas Vector Search |
| `users` | User preferences, sizes, favorite brands |
| `user_memory` | Long-term facts the agents learn per user |
| `sessions` | Full conversation history per sessionId |
| `agent_state` | Workflow lifecycle: running → completed/failed |
| `tool_invocations` | Audit log: every tool call with input, output, latency_ms |

### Search Indexes Required in Atlas

- **Vector index** `product_vector_index` on `products.search_text` — Atlas Auto-Embeddings, `voyage-3-large` (M10+ required)
- **Text index** `product_text_index` on `products` (name, description, brand, category, search_text)

`helpers/seed.py` creates both automatically.

### Key Design Decisions

- **Every agent is an independent A2A service.** `to_a2a(agent, ...)` (ADK) turns each `LlmAgent` into a Starlette app that serves its card at `/.well-known/agent-card.json` and handles `message/send` over JSON-RPC. The planner consumes the specialists with ADK's `RemoteA2aAgent` (which resolves the well-known card and calls it).
- **Session correlation across processes.** Since tools run in separate services from the planner, the originating `session_id` rides an `X-Session-Id` HTTP header (injected by `common/a2a.py` from a contextvar, read back by `session_middleware.py`). Tools stamp `tool_invocations` with it so the trace endpoint reconstructs the whole cross-service run.
- **Tools are synchronous** functions so ADK offloads them to a worker thread, keeping the sync PyMongo calls off the event loop.
- **SearchProductsTool** tries Atlas Vector Search first (auto-embeddings), falling back to `$search` text search on failure.
- The **orchestrator preserves the exact REST contract** the frontend depends on (`/api/chat`, `/api/trace`, `/api/agents`, `/api/profile`, `/api/sessions`); the frontend is unchanged by the rewrite.
