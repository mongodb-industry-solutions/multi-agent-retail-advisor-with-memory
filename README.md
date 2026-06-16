# Multi-Agent Retail Advisor with Memory

A retail product advisor multi-agent system demonstrating:

- **Google ADK** agent patterns (Planner → sub-agents via tool delegation)
- **A2A** agent discovery (each agent publishes an AgentCard)
- **MongoDB as the agentic data plane** — product catalog, user profiles, long-term memory, session history, orchestration state, and tool audit log all live in MongoDB Atlas

The LLM behind the agents is Anthropic (model-agnostic architecture — swap `ANTHROPIC_MODEL` to change).

→ **[Setup instructions](docs/SETUP.md)** · **[Demo flow](docs/DEMO.md)**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 21, Spring Boot 3.3.5 |
| Agent framework | Google ADK 1.1.0 (with native Anthropic support) |
| LLM | Anthropic via Azure API Management gateway |
| Embeddings | Atlas Vector Search Auto-Embeddings (`voyage-3-large`, server-side) |
| Database | MongoDB Atlas (Vector Search + full-text Search) |
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 |
| Async runtime | RxJava 3 (ADK agent execution) |

---

## How It Works

### Agents and tool delegation

The **PlannerAgent** is the orchestrator. It receives the user's message and decides — via the LLM — which sub-agents to call and in what order. Sub-agents are exposed to the Planner as tools (Google ADK's `AgentTool` pattern), so the LLM drives the delegation without hardcoded routing logic.

Each sub-agent owns a slice of the problem:

- **ProfileAgent** — fetches the user's stored preferences and any long-term memory facts, and can write new facts back after the conversation.
- **ProductAgent** — runs a hybrid search against the product catalog: Atlas Vector Search first (semantic similarity via Atlas Auto-Embeddings), with automatic fallback to Atlas full-text search if the vector query fails.

### A2A (Agent-to-Agent) discovery

Every agent publishes an **AgentCard** — a structured descriptor listing its skills, input schema, and output description. Cards are served at `GET /api/agents`. Any A2A-compatible orchestrator can discover and call these agents without knowing their internals.

### MongoDB as the data and memory plane

MongoDB Atlas is not just the product database — it is the substrate the entire agent system runs on:

- **Vector Search** powers semantic product retrieval with pre-filter support (price, size, waterproof, category).
- **user_memory** gives agents persistent, updateable long-term memory per user — facts learned in one session survive to the next.
- **agent_state** tracks the workflow lifecycle, making executions inspectable and resumable.
- **tool_invocations** is a full audit log of every tool call with inputs, outputs, and latency — a built-in replay buffer and fine-tuning dataset.

### Search: vector-first with text fallback

When the ProductAgent searches the catalog, it runs two possible paths:

**Primary — Atlas Vector Search (Auto-Embeddings):**
The user's query is passed as plain text to `$vectorSearch`. Atlas handles vectorization server-side using `voyage-3-large` — no embedding API calls from the application. Structured filters (price, size, waterproof, eco-friendly, category) are pushed inside the `$vectorSearch` stage, so MongoDB filters at the index level before computing similarity. This means "sustainable hiking footwear" finds "eco-conscious trail runner" even without keyword overlap.

**Fallback — Atlas full-text Search:**
If vector search fails (index not ready, cluster tier too low), the tool automatically retries with `$search` using keyword matching across `name`, `description`, `brand`, and `search_text` fields. The demo stays functional either way; the Trace panel reveals which path was taken.

Both indexes live in the same Atlas cluster alongside all agent memory and session data — no separate vector database or search infrastructure needed.

### The UI

The chat interface is split into two panels:

- **Left** — chat window for sending messages and reading responses.
- **Right** — live debug panel with three tabs:
  - **Agents** — AgentCards showing each agent's declared capabilities.
  - **Trace** — every tool invocation from the last query, with expandable input/output and latency badges.
  - **MongoDB** — the raw documents written to Atlas during the request.

The debug panel is the demo's key visual: it makes the agentic machinery transparent to the audience.

---

## Architecture

```
User message
    │
    ▼
PlannerAgent  ──── call_product_agent ────▶  ProductAgent
    │                                            └─ SearchProductsTool (Atlas Vector Search → text fallback)
    └──── call_profile_agent  ────────────▶  ProfileAgent
                                                 ├─ GetUserProfileTool
                                                 ├─ GetUserMemoryTool
                                                 └─ UpdateUserMemoryTool
```

**MongoDB collections used per request:**

| Collection | What goes in |
|---|---|
| `sessions` | Full conversation history (append per turn) |
| `agent_state` | Workflow status: running → completed |
| `tool_invocations` | Every tool call: agent, tool, input, output, latency_ms |
| `user_memory` | Long-term facts learned about the user (upserted) |
| `products` | Product catalog with `search_text` field auto-embedded by Atlas (read-only at query time) |
| `users` | User profiles (read-only at query time) |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat` | Send a message: `{userId, message, sessionId?}` |
| `GET` | `/api/trace/{sessionId}` | Full trace: session + tool invocations + agent state |
| `GET` | `/api/agents` | A2A agent card discovery |
