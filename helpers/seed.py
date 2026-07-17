#!/usr/bin/env python3
"""
Seed MongoDB with products and users for the retail advisor demo.

Usage:
    pip install "pymongo[srv]>=4.6" python-dotenv
    python helpers/seed.py [--force]

  --force  Drop and re-seed the products collection (needed to replace old catalog).

Reads backend/.env for connection details (or plain env vars).
Atlas auto-embeddings: no Voyage API key required. Atlas vectorizes the
`search_text` field automatically once the vector index is created.
"""

import argparse
import json
import os
import sys
from pathlib import Path

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

# Flagship Voyage 4 model used to embed the catalog (documents) once. Queries use
# a lighter, cheaper model at run time (see VOYAGE_QUERY_MODEL in the backend).
VOYAGE_DOC_MODEL = os.environ.get("VOYAGE_DOC_MODEL", "voyage-4-large")

DATA_DIR = ROOT / "helpers" / "data"

VECTOR_INDEX_NAME = "product_vector_index"
SEARCH_INDEX_NAME = "product_text_index"

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

if not MONGODB_URI:
    print("ERROR: missing required env var: MONGODB_URI")
    print("Set it in backend/.env or export it before running.")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def index_exists(collection, name: str) -> bool:
    return any(idx.get("name") == name for idx in collection.list_search_indexes())


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Seed the retail advisor demo database.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Drop and re-seed the products collection (required when replacing catalog).",
    )
    args = parser.parse_args()

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

    if args.force:
        products_col.drop()
        print("Products collection dropped (--force).")

    if products_col.count_documents({}) > 0:
        print(f"Products already seeded ({products_col.count_documents({})} docs). Skipping. Use --force to replace.")
    else:
        # Ensure each product has a search_text field (defensive fallback)
        docs = []
        for p in products:
            doc = dict(p)
            if "search_text" not in doc:
                doc["search_text"] = f"{doc['name']}. {doc['brand']}. Category: {doc['category']}. {doc['description']}"
            docs.append(doc)

        print(f"Inserting {len(docs)} products...")
        products_col.insert_many(docs)
        print(f"Products seeded: {len(docs)} documents (no embedding field — Atlas will vectorize automatically).")

    # -- Atlas Vector Search index (auto-embeddings) -------------------------
    if index_exists(products_col, VECTOR_INDEX_NAME):
        print(f"Vector search index '{VECTOR_INDEX_NAME}' already exists.")
    else:
        definition = {
            "fields": [
                # Automated Embedding: Atlas embeds `search_text` with the flagship
                # Voyage 4 model at index time (and re-embeds on insert/update).
                {"type": "autoEmbed", "modality": "text", "path": "search_text", "model": VOYAGE_DOC_MODEL},
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
            print("  Atlas will begin vectorizing documents automatically (~1-2 min to become READY).")
        except Exception as e:
            print(f"Warning: could not create vector index (requires Atlas M10+): {e}")

    # -- Atlas text search index ---------------------------------------------
    if index_exists(products_col, SEARCH_INDEX_NAME):
        print(f"Text search index '{SEARCH_INDEX_NAME}' already exists.")
    else:
        definition = {
            "mappings": {
                "dynamic": False,
                "fields": {
                    "name":        [{"type": "string"}],
                    "description": [{"type": "string"}],
                    "brand":       [{"type": "string"}],
                    "category":    [{"type": "string"}],
                    "search_text": [{"type": "string"}],
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
