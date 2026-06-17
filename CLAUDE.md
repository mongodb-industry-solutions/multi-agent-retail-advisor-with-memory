# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A retail product advisor **multi-agent demo** showcasing:
- **Google ADK** (Agent Development Kit) orchestration with tool delegation
- **A2A** (Agent-to-Agent) discovery via AgentCards
- **MongoDB Atlas as the agentic data plane** — all persistence lives there: product catalog, user profiles, long-term memory, session history, agent orchestration state, and tool audit logs
- **Anthropic** as LLM, accessed via an Azure API Management gateway

The backend is Java/Spring Boot; the frontend is Next.js. Both run together via Docker Compose.

## Commands

### Running the stack

```bash
# Start everything
docker compose up -d

# Rebuild backend after Java changes
docker compose build backend && docker compose up -d backend

# Watch logs
docker compose logs -f backend
docker compose logs -f

# Stop
docker compose down
```

### Backend (Maven)

```bash
cd backend
mvn package -DskipTests        # Build JAR
mvn package                    # Build + run tests
mvn test -Dtest=ClassName      # Run a single test class
```

### Frontend (npm)

```bash
cd frontend
npm run dev      # Dev server with hot reload (port 3000)
npm run build    # Production build
npm start        # Serve production build
```

### Data Seeding

```bash
# Requires Python + pip install "pymongo[srv]>=4.6" python-dotenv
python helpers/seed.py          # first run
python helpers/seed.py --force  # replace catalog (drops products collection)
```

Only needed once — all data lives in MongoDB afterwards.

## Environment Setup

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Description |
|---|---|
| `MONGODB_URI` | Atlas connection string |
| `MONGODB_DATABASE` | Database name (e.g. `retail_advisor_demo`) |
| `LLM_API_KEY` | Azure API Management key for Claude |
| `LLM_BASE_URL` | Azure gateway URL (not a direct Anthropic URL) |
| `ANTHROPIC_MODEL` | Model ID (e.g. `claude-sonnet-4-5`) |

**Note on LLM headers:** The Azure API Management gateway requires `api-key` header instead of the standard `x-api-key`. This custom injection is wired in `AppConfig.java`.

## Architecture

### Request Flow

```
POST /api/chat
    └─> WorkflowOrchestrator
            ├─ Creates session doc + agent_state doc in MongoDB
            └─> PlannerAgent (Google ADK InMemoryRunner via RxJava)
                    ├─> ProfileAgent
                    │       ├─ GetUserProfileTool    → users collection
                    │       ├─ GetUserMemoryTool     → user_memory collection
                    │       └─ UpdateUserMemoryTool  → user_memory collection (upsert)
                    └─> ProductAgent
                            └─ SearchProductsTool    → products collection
                                                       (vector search → text fallback)
            └─ Writes all tool calls to tool_invocations collection
            └─ Returns {reply, sessionId, toolCallCount}
```

### Backend Package Structure

```
com.mongodb.demo.retail/
├── agents/          # PlannerAgent, ProductAgent, ProfileAgent, AgentCard, AgentRegistry
├── tools/           # SearchProductsTool, GetUserProfileTool, GetUserMemoryTool, UpdateUserMemoryTool
├── controller/      # ChatController, TraceController, AgentCardController
├── orchestration/   # WorkflowOrchestrator — the central coordinator
├── mongodb/         # SessionRepository, AgentStateRepository, ToolInvocationRepository, MongoCollections
├── service/         # AnthropicService (LLM streaming utilities)
├── config/          # AppConfig (Spring beans, Azure client), AgentContext (thread-local session ID)
└── model/           # ChatRequest, ChatResponse, TraceResponse
```

### MongoDB Collections

| Collection | Purpose |
|---|---|
| `products` | Catalog with `search_text` field auto-embedded by Atlas Vector Search |
| `users` | User preferences, sizes, favorite brands |
| `user_memory` | Long-term facts the agents learn per user |
| `sessions` | Full conversation history per sessionId |
| `agent_state` | Workflow lifecycle: `initializing → executing → completed/failed` |
| `tool_invocations` | Audit log: every tool call with input, output, latency_ms |

### Search Indexes Required in Atlas

- **Vector index** `product_vector_index` on `products.search_text` — type `text`, model `voyage-3-large` (Atlas Auto-Embeddings, M10+ required)
- **Text index** `product_text_index` on `products` (name, description, brand, category, search_text)

`helpers/seed.py` creates both indexes automatically. Atlas vectorizes documents in the background (~1–2 min after seeding).

### Frontend

Next.js app on port 3000 proxies to backend on port 8080. Main page (`/chat`) has a split layout: chat panel (55%) + debug panel (45%) with Agents/Trace/MongoDB tabs.

- `app/chat/page.tsx` — main UI
- `app/components/AgentCards.tsx` — renders A2A capability cards from `GET /api/agents`
- `app/components/TracePanel.tsx` — expandable tool invocation viewer
- `app/lib/api.ts` — typed fetch wrappers for all backend endpoints

### REST API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat` | Send `{userId, message, sessionId?}`, get `{reply, sessionId, toolCallCount}` |
| `GET` | `/api/trace/{sessionId}` | Full trace: session history + agent state + tool invocations |
| `GET` | `/api/agents` | A2A agent discovery — returns all AgentCards |

### Key Design Decisions

- **AgentContext** is a thread-local that carries `sessionId` into every tool so tool audit logs can be correlated without passing session state through every method signature.
- **SearchProductsTool** tries vector search first, falls back to text search automatically on failure.
- **PlannerAgent** calls ProfileAgent and ProductAgent as sub-agents via `AgentTool` — Google ADK handles the inner agent execution loop.
- All agent state transitions are persisted to MongoDB so the trace endpoint can reconstruct the full execution history.
