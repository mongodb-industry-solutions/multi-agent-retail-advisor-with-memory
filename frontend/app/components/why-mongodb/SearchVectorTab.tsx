"use client";

import Image from "next/image";
import { Description } from "@leafygreen-ui/typography";
import { Code } from "@leafygreen-ui/code";
import { Callout } from "@leafygreen-ui/callout";
import { palette } from "@leafygreen-ui/palette";

const VECTOR_PIPELINE = `{
  "$vectorSearch": {
    "index": "product_vector_index",
    "path": "search_text",
    "query": "<user query>",
    "numCandidates": 200,
    "limit": 5,
    "filter": {
      "price": { "$lte": 150 },
      "category": "hiking_boots"
    }
  }
}`;

const TEXT_PIPELINE = `{
  "$search": {
    "index": "product_text_index",
    "compound": {
      "should": [
        {
          "text": {
            "query": "<user query>",
            "path": ["name", "description", "brand"]
          }
        }
      ]
    }
  }
}`;

export function SearchVectorTab() {

  return (
    <div className="p-6 space-y-5">
      <p className="text-sm text-gray-700">
        Semantic search and full-text search. Same collection. Zero extra infrastructure. Automatic fallback.
      </p>

      {/* Flow diagram — image or inline fallback */}
      <div
        className="rounded-xl border border-gray-100 overflow-hidden flex items-center justify-center"
        style={{ minHeight: 140, backgroundColor: "#f9fafb" }}
      >
          <Image
            src="/images/search-and-vector-search.png"
            alt="Vector search and text search fallback flow"
            width={700}
            height={300}
            style={{ width: "100%", height: "auto" }}
          />
       
      </div>

      {/* Stacked pipelines */}
      <div className="space-y-2">
        <Description className="uppercase tracking-wide text-gray-500">Primary — Vector Search</Description>
        <div className="overflow-auto">
          <Code language="json" showLineNumbers>{VECTOR_PIPELINE}</Code>
        </div>

        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 border-t border-dashed border-gray-300" />
          <span
            className="text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full"
            style={{ color: "#92400e", backgroundColor: "#fefce8", border: "1px solid #fde68a" }}
          >
            fallback — if vector search unavailable
          </span>
          <div className="flex-1 border-t border-dashed border-gray-300" />
        </div>

        <Description className="uppercase tracking-wide text-gray-500">Fallback — Full-Text Search</Description>
        <div className="overflow-auto">
          <Code language="json" showLineNumbers>{TEXT_PIPELINE}</Code>
        </div>
      </div>

      <Callout variant="tip">
        The fallback is automatic — the agent never knows the difference, and your data never moves.
      </Callout>
    </div>
  );
}
