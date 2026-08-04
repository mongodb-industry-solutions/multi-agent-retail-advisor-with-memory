# Setup

## Prerequisites

- Docker Desktop running
- MongoDB Atlas cluster **M10 or higher** (required for Auto-Embeddings vector search)
- Access to an **Anthropic-compatible LLM endpoint** (API key + base URL)

---

## 1. Create `backend/.env`

```bash
cp backend/.env.example backend/.env
```

Fill in the values:

```bash
# MongoDB Atlas
MONGODB_URI=<your-mongodb-connection-string-with-credentials>
MONGODB_DATABASE=<your-database-name>

# LLM API (Anthropic-compatible endpoint + key)
LLM_API_KEY=<your-llm-api-key>
LLM_BASE_URL=<your-llm-base-url>
LLM_MODEL=<your-model-id>          # e.g. claude-sonnet-4-5 (or prefixed openai/gpt-4o).

# Optional — retrieval models (defaults shown). Voyage 4 asymmetric embedding + native reranking.
# VOYAGE_DOC_MODEL=voyage-4-large    # embeds the catalog (also read by seed.py)
# VOYAGE_QUERY_MODEL=voyage-4-lite   # embeds queries at run time (cheaper)
# RERANK_MODEL=rerank-2.5
```

> **Native reranking prerequisites:** an Atlas cluster on **MongoDB 8.3+** (Latest version with auto-upgrades) with **Native Reranking** enabled under Project Settings (Preview). If reranking isn't enabled, the demo still runs — `search_products` degrades to vector-only, then text search.

---

## 2. Seed data (first run only)

```bash
pip install -r helpers/requirements.txt
python helpers/seed.py
```

This inserts 135 outdoor apparel products + sample users into MongoDB and creates both Atlas search indexes. Atlas auto-embeds the `search_text` field in the background (~1–2 min). Only needed once — all data lives in MongoDB afterwards. Use `--force` to drop and re-seed the products collection.

---

## 3. Start the stack

```bash
docker compose up -d
```

This starts **five services**: `orchestrator` (:8080, the REST API), `planner-agent-service` (:8081), `profile-agent-service` (:9091), `product-agent-service` (:9092), and `frontend` (:3000). The four backend services share one Python image, built from source — first build takes ~5–10 minutes (installing the ADK + A2A + LiteLLM stack). Subsequent builds use Docker layer cache.

```bash
# Watch all logs
docker compose logs -f

# Watch the orchestrator (REST API) only
docker compose logs -f orchestrator

# Confirm the A2A cards are being served
curl http://localhost:8081/.well-known/agent-card.json   # planner
curl http://localhost:9091/.well-known/agent-card.json   # profile
curl http://localhost:9092/.well-known/agent-card.json   # product
```

---

## 4. Open the UI

`http://localhost:3000`

---

## Useful commands

```bash
# Rebuild after code changes
docker compose build && docker compose up -d

# Rebuild only the backend image (shared by all four backend services)
docker compose build orchestrator && docker compose up -d

# Restart a single A2A service
docker compose up -d --force-recreate product-agent-service

# Rebuild only frontend
docker compose build frontend && docker compose up -d frontend

# Stop everything
docker compose down

# Re-run seeding
python helpers/seed.py
```

### Local dev without Docker

One-time setup:

```bash
cd backend
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Then run each backend service in its own terminal. The venv activation is per-shell, so **every terminal** needs it (each server reads `backend/.env`):

```bash
# Terminal 1
cd backend && source .venv/bin/activate
uvicorn app.services.profile_server:app --port 9091

# Terminal 2
cd backend && source .venv/bin/activate
uvicorn app.services.product_server:app --port 9092

# Terminal 3
cd backend && source .venv/bin/activate
uvicorn app.services.planner_server:app --port 8081

# Terminal 4
cd backend && source .venv/bin/activate
uvicorn app.services.orchestrator:app  --port 8080
```

Finally, start the frontend in a fifth terminal:

```bash
# Terminal 5
cd frontend
npm install    # first run only
npm run dev
```

The frontend proxies `/api/*` to `BACKEND_URL` (defaults to `http://localhost:8080`, the local orchestrator), so no extra configuration is needed. Open `http://localhost:3000`.

> **Note:** don't mix this with `docker compose up` — the containers would collide with the local servers on the same ports.
