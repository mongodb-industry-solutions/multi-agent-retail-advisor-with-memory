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
ANTHROPIC_MODEL=<your-model-id>
```

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

Both images are built from source. First build takes ~10–20 minutes (Maven downloads all dependencies). Subsequent builds use Docker layer cache and are much faster.

```bash
# Watch all logs
docker compose logs -f

# Watch backend only
docker compose logs -f backend
```

---

## 4. Open the UI

`http://localhost:3000`

---

## Useful commands

```bash
# Rebuild after code changes
docker compose build && docker compose up -d

# Rebuild only backend
docker compose build backend && docker compose up -d backend

# Rebuild only frontend
docker compose build frontend && docker compose up -d frontend

# Stop everything
docker compose down

# Re-run seeding
python helpers/seed.py
```
