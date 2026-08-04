# Multi-Agent Retail Advisor with Memory

A retail product advisor multi-agent system demonstrating:

- **Google ADK** agent patterns (a Planner orchestrating specialist sub-agents)
- **A2A (Agent-to-Agent) protocol** — each agent is an independent service that publishes a spec-compliant AgentCard at `/.well-known/agent-card.json` and communicates over **JSON-RPC 2.0**. Every agent hop is a real network call, not an in-process function call.
- **MongoDB as the agentic data plane** — product catalog, user profiles, long-term memory, session history, orchestration state, and tool audit log all live in MongoDB Atlas

The LLM is provider-agnostic via LiteLLM — swap `LLM_MODEL` (e.g. `claude-sonnet-4-5`, or a prefixed `openai/gpt-4o`) to change.

→ **[Setup instructions](docs/SETUP.md)** · **[Demo flow](docs/DEMO.md)**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.13 |
| Agent framework | Google ADK 2.5 (Python) |
| Agent-to-agent | A2A protocol via `a2a-sdk` (JSON-RPC 2.0 over HTTP) |
| API layer | FastAPI (orchestrator) · Starlette/uvicorn (A2A servers) |
| LLM | Anthropic (Claude) via LiteLLM → Azure API Management gateway |
| Embeddings | Atlas Auto-Embeddings — Voyage 4 asymmetric (`voyage-4-large` docs / `voyage-4-lite` queries) + native `$rerank` (`rerank-2.5`) |
| Database | MongoDB Atlas (Vector Search + full-text Search) |
| Frontend | Next.js 16 · React 18 · TypeScript · Tailwind CSS 4 |

---

## How It Works

### Real A2A: every agent is an independent service

There are **four backend services**, each an independent A2A agent (except the orchestrator, which is the A2A client / REST gateway):

| Service | Port | Role |
|---|---|---|
| `orchestrator` | 8080 | Frontend-facing REST API (`/api/*`) + MongoDB bookkeeping. Calls the Planner over A2A. |
| `planner-agent-service` | 8081 | **PlannerAgent** — the orchestration agent, exposed as an A2A entrypoint. Fans out to the specialists over A2A. |
| `profile-agent-service` | 9091 | **ProfileAgent** — user profile + long-term memory. |
| `product-agent-service` | 9092 | **ProductAgent** — catalog search (vector + text). |

Each agent publishes a spec-shaped AgentCard at `http://<host>:<port>/.well-known/agent-card.json` and accepts A2A `message/send` calls over JSON-RPC 2.0. The Planner **discovers** the specialists from their well-known cards (ADK's `RemoteA2aAgent` + `A2ACardResolver`) and calls them as remote tools — a genuine network hop between opaque agents.

Because the Planner is itself an A2A service, **any A2A-compatible orchestrator can discover and call it** — the claim is now backed by a real, spec-compliant endpoint.

### Agents and delegation

The **PlannerAgent** receives the user's message and decides — via the LLM — which specialists to call and in what order. Each specialist is exposed to the Planner as a remote tool, so the LLM drives delegation without hardcoded routing.

- **ProfileAgent** — fetches the user's stored preferences and long-term memory facts, and writes new facts back after the conversation.
- **ProductAgent** — runs a hybrid search against the catalog: Atlas Vector Search first (semantic similarity via Atlas Auto-Embeddings), with automatic fallback to Atlas full-text search if the vector query fails.

### Session correlation across services

Because tools now run in separate processes from the Planner, the originating chat `session_id` is propagated across every A2A hop via an `X-Session-Id` HTTP header. Each specialist stamps that id onto its `tool_invocations` audit records, so the Trace panel reconstructs the full cross-service execution from one session id.

### MongoDB as the data and memory plane

MongoDB Atlas is not just the product database — it is the substrate the entire agent system runs on:

- **Vector Search** powers semantic product retrieval with pre-filter support (price, size, waterproof, category).
- **user_memory** gives agents persistent, updateable long-term memory per user — facts learned in one session survive to the next.
- **agent_state** tracks the workflow lifecycle, making executions inspectable.
- **tool_invocations** is a full audit log of every tool call with inputs, outputs, and latency — written by whichever specialist service ran the tool, correlated by session id.

### Search: vector-first with text fallback

**Primary — Atlas Vector Search with Voyage 4 asymmetric embedding:** the query is passed as plain text to `$vectorSearch`; Atlas vectorizes server-side — no embedding API calls from the app. The catalog is embedded once with the flagship **`voyage-4-large`**, while each query is embedded with the ~6× cheaper **`voyage-4-lite`** via the stage's `model` override (valid because Voyage 4 models share one embedding space). Structured filters are pushed inside the `$vectorSearch` stage.

**Then — native reranking:** a `$rerank` stage reorders the vector-search candidates with a Voyage reranker (**`rerank-2.5`**) — entirely inside the aggregation pipeline, no external API — before returning the top matches. Each result carries both `vectorScore` and `rerankScore`.

**Fallback — Atlas full-text Search:** if vector search or reranking is unavailable (index not migrated, reranking Preview not enabled, tier too low), the tool degrades gracefully — vector-only, then `$search` across `name`, `description`, and `brand`. The Trace panel reveals which path was taken.

> Model names are env-configurable (`VOYAGE_DOC_MODEL`, `VOYAGE_QUERY_MODEL`, `RERANK_MODEL`). Native reranking needs an Atlas cluster on MongoDB 8.3+ with the **Native Reranking Preview** enabled in Project Settings; re-seed with `python helpers/seed.py --force` after changing the embedding model.

### The UI

The chat interface is split into two panels: a chat window (left) and a live debug panel (right) with **Agents** (live-discovered AgentCards), **Trace** (every tool invocation), and **MongoDB** (raw documents) tabs. The frontend is unchanged by the rewrite — it talks to the orchestrator over the same REST contract.

---

## Architecture

```
Frontend (Next.js :3000)
    │  POST /api/chat, GET /api/trace, GET /api/agents, ...
    ▼
orchestrator (:8080)  ── MongoDB bookkeeping (sessions, agent_state)
    │  A2A: message/send  (X-Session-Id forwarded)
    ▼
planner-agent-service (:8081)   PlannerAgent
    │                        ├── A2A ──▶ profile-agent-service (:9091)  ProfileAgent
    │                        │             ├─ get_user_profile   → users
    │                        │             ├─ get_user_memory    → user_memory
    │                        │             └─ update_user_memory → user_memory
    │                        └── A2A ──▶ product-agent-service (:9092)  ProductAgent
    │                                      └─ search_products (Atlas Vector Search → text fallback) → products
    ▼
MongoDB Atlas  ── tool_invocations written by each specialist, keyed by session_id
```

**MongoDB collections used per request:**

| Collection | What goes in |
|---|---|
| `sessions` | Full conversation history (append per turn) |
| `agent_state` | Workflow status: running → completed |
| `tool_invocations` | Every tool call: agent, tool, input, output, latency_ms |
| `user_memory` | Long-term facts learned about the user (upserted) |
| `products` | Catalog with `search_text` auto-embedded by Atlas (read-only at query time) |
| `users` | User profiles (read-only at query time) |

---

## Running

```bash
docker compose up -d          # builds + starts all 5 services
docker compose logs -f orchestrator
```

Then open http://localhost:3000. See **[docs/SETUP.md](docs/SETUP.md)** for environment configuration and one-time data seeding.

The A2A cards are curl-able directly:

```bash
curl http://localhost:8081/.well-known/agent-card.json   # planner
curl http://localhost:9091/.well-known/agent-card.json   # profile
curl http://localhost:9092/.well-known/agent-card.json   # product
```

---

## REST API (orchestrator, :8080)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat` | Send a message: `{userId, message, sessionId?}` |
| `GET` | `/api/trace/{sessionId}` | Full trace: session + tool invocations + agent state |
| `GET` | `/api/agents` | Live A2A discovery — fetches each agent's real well-known card |
| `GET` | `/api/profile/{userId}` | User profile + memory |
| `DELETE` | `/api/profile/{userId}/memory` | Reset a user's long-term memory |
| `GET` | `/api/sessions/user/{userId}` | Recent sessions for a user |
| `PUT` | `/api/sessions/{sessionId}/star` | Star/unstar a session |
