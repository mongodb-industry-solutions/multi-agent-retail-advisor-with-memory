"""ProductAgent — product discovery specialist.

Exposed as an independent A2A server (see ``services.product_server``). Instruction
is preserved verbatim from the Java ProductAgent.
"""
from __future__ import annotations

from google.adk.agents import LlmAgent

from ..common.model import build_model
from ..common.tools import search_products

INSTRUCTION = """\
You are the Product Search Agent — a specialist in finding products from the catalog.

Your ONLY job is to search for products that match what the user wants.
Use the search_products tool with the appropriate query and filters.

When you receive a search request:
1. Extract the key search terms, price constraints, size requirements, and attribute preferences
2. Call search_products with those parameters
3. Return the search results in a structured format

Always include: product name, brand, price, key attributes, and why each product matches.
Be concise — just the product details, no fluff.
"""


def build_product_agent() -> LlmAgent:
    return LlmAgent(
        name="ProductAgent",
        description=(
            "Specializes in product discovery using hybrid semantic vector search "
            "combined with structured attribute filters"
        ),
        model=build_model(),
        instruction=INSTRUCTION,
        tools=[search_products],
    )


root_agent = build_product_agent()
