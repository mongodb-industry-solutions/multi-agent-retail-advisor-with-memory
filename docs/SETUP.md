# Setup

## Prerequisites

- Docker Desktop running
- MongoDB Atlas cluster with:
  - A **Vector Search index** named `product_vector_index` on `products.embedding` (2048 dims, cosine)
  - A **Search index** named `product_text_index` on `products` (fields: `name`, `description`, `brand`, `category`)
- A **Voyage AI API key** (from Atlas AI Models section) for generating embeddings
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

# Voyage AI embeddings
VOYAGE_API_KEY=<your-voyage-api-key>
VOYAGE_MODEL=<your-voyage-model>
```

---

## 2. Seed data (first run only)

```bash
pip install -r helpers/requirements.txt
python helpers/seed.py
```

This inserts 20 outdoor products + 3 sample users into MongoDB, generates Voyage AI embeddings for each product, and creates both Atlas search indexes. Only needed once — all data lives in MongoDB afterwards.

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
