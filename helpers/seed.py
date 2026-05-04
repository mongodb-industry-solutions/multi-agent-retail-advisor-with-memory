#!/usr/bin/env python3
"""
Seed MongoDB with products (+ embeddings) and users for the retail advisor demo.

Usage:
    pip install "pymongo[srv]>=4.6" requests python-dotenv
    python helpers/seed.py

Reads backend/.env for connection details (or plain env vars).
"""

import json
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.operations import SearchIndexModel

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / "backend" / ".env")

MONGODB_URI      = os.environ.get("MONGODB_URI")
MONGODB_DATABASE = os.environ.get("MONGODB_DATABASE", "retail_advisor_demo")
VOYAGE_API_KEY   = os.environ.get("VOYAGE_API_KEY")
VOYAGE_MODEL     = os.environ.get("VOYAGE_MODEL", "voyage-3-large")

VOYAGE_URL = "https://ai.mongodb.com/v1/embeddings"

DATA_DIR = ROOT / "helpers" / "data"

VECTOR_INDEX_NAME = "product_vector_index"
SEARCH_INDEX_NAME = "product_text_index"

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

missing = [v for v in ("MONGODB_URI", "VOYAGE_API_KEY") if not os.environ.get(v)]
if missing:
    print(f"ERROR: missing required env vars: {', '.join(missing)}")
    print("Set them in backend/.env or export them before running.")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def embed_batch(texts: list[str]) -> list[list[float]]:
    resp = requests.post(
        VOYAGE_URL,
        headers={"Authorization": f"Bearer {VOYAGE_API_KEY}"},
        json={"model": VOYAGE_MODEL, "input": texts, "input_type": "document"},
        timeout=120,
    )
    if not resp.ok:
        print(f"ERROR: Voyage AI {resp.status_code}: {resp.text}")
        sys.exit(1)
    return [item["embedding"] for item in resp.json()["data"]]


def index_exists(collection, name: str) -> bool:
    return any(idx.get("name") == name for idx in collection.list_search_indexes())


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    products = json.loads((DATA_DIR / "products.json").read_text())
    users    = json.loads((DATA_DIR / "users.json").read_text())
    print(f"Loaded {len(users)} users, {len(products)} products")

    client = MongoClient(MONGODB_URI)
    db = client[MONGODB_DATABASE]

    # -- Users ---------------------------------------------------------------
    users_col = db["users"]
    inserted = skipped = 0
    for user in users:
        if users_col.find_one({"_id": user["_id"]}) is None:
            users_col.insert_one(user)
            inserted += 1
        else:
            skipped += 1
    print(f"Seeding users... {inserted} inserted ({skipped} already existed)")

    # -- Products ------------------------------------------------------------
    products_col = db["products"]
    if products_col.count_documents({}) > 0:
        print(f"Products already seeded ({products_col.count_documents({})} docs). Skipping.")
    else:
        texts = [f"{p['name']} - {p['description']}" for p in products]
        print(f"Generating embeddings for {len(texts)} products (batch)...")
        embeddings = embed_batch(texts)

        docs = []
        for product, embedding in zip(products, embeddings):
            doc = dict(product)
            doc["embedding"] = embedding
            docs.append(doc)

        print(f"Inserting {len(docs)} products with embeddings...")
        products_col.insert_many(docs)
        print(f"Products seeded: {len(docs)} documents")

    # -- Atlas Vector Search index -------------------------------------------
    if index_exists(products_col, VECTOR_INDEX_NAME):
        print(f"Vector search index '{VECTOR_INDEX_NAME}' already exists")
    else:
        definition = {
            "fields": [
                {"type": "vector", "path": "embedding", "numDimensions": 2048, "similarity": "cosine"},
                {"type": "filter", "path": "price"},
                {"type": "filter", "path": "size_options"},
                {"type": "filter", "path": "attributes.waterproof"},
                {"type": "filter", "path": "attributes.eco_friendly"},
                {"type": "filter", "path": "category"},
            ]
        }
        model = SearchIndexModel(definition=definition, name=VECTOR_INDEX_NAME, type="vectorSearch")
        try:
            products_col.create_search_index(model)
            print(f"Creating vector search index '{VECTOR_INDEX_NAME}'... initiated")
        except Exception as e:
            print(f"Warning: could not create vector index (may need Atlas M10+): {e}")

    # -- Atlas text search index ---------------------------------------------
    if index_exists(products_col, SEARCH_INDEX_NAME):
        print(f"Text search index '{SEARCH_INDEX_NAME}' already exists")
    else:
        definition = {
            "mappings": {
                "dynamic": False,
                "fields": {
                    "name":        [{"type": "string"}],
                    "description": [{"type": "string"}],
                    "brand":       [{"type": "string"}],
                    "category":    [{"type": "string"}],
                },
            }
        }
        model = SearchIndexModel(definition=definition, name=SEARCH_INDEX_NAME, type="search")
        try:
            products_col.create_search_index(model)
            print(f"Creating text search index '{SEARCH_INDEX_NAME}'... initiated")
        except Exception as e:
            print(f"Warning: could not create text search index: {e}")

    client.close()
    print("\nDone. Atlas indexes take ~1 minute to become active.")


if __name__ == "__main__":
    main()
