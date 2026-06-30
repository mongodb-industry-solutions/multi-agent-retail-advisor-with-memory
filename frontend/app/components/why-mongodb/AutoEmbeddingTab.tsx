"use client";

import { Body, InlineCode, Description } from "@leafygreen-ui/typography";
import { Code } from "@leafygreen-ui/code";
import { palette } from "@leafygreen-ui/palette";

const INDEX_DEFINITION = `{
  "fields": [
    {
      "type": "text",
      "path": "search_text",
      "model": "voyage-3-large"
    },
    { "type": "filter", "path": "price" },
    { "type": "filter", "path": "size_options" },
    { "type": "filter", "path": "attributes.waterproof" },
    { "type": "filter", "path": "attributes.eco_friendly" },
    { "type": "filter", "path": "category" }
  ]
}`;

const BEFORE_STEPS = [
  "Prepare product text",
  "Call Voyage AI API",
  "Voyage AI returns vector embedding",
  "Insert document + vector embedding into Atlas",
  "Run $vectorSearch with pre-computed vector",
];

const AFTER_STEPS = [
  "Insert product text into Atlas",
  "Atlas calls Voyage AI → stores embedding internally",
  "Run $vectorSearch with plain text — Atlas embeds the query too",
];

const BULLETS = [
  "Configured once in the Atlas UI or API — no infra to maintain",
  "Embeddings stored internally by Atlas, separate from your application data",
  "New documents are embedded automatically on insert — the catalog stays current",
];

export function AutoEmbeddingTab() {
  return (
    <div className="p-6 space-y-5">
      <Body>
        One index definition. Atlas generates and maintains embeddings automatically — when documents
        are inserted and when queries run. No embedding code in your app.
      </Body>

      {/* Before / After */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-4" style={{ background: "#f8fafc", border: "2px solid #e2e8f0" }}>
          <p className="text-sm font-semibold text-gray-600 mb-3">Without Auto Embedding</p>
          <ol className="space-y-2">
            {BEFORE_STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="font-bold text-gray-400 shrink-0">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-xl p-4" style={{ background: "#f8fafc", border: "2px solid #e2e8f0" }}>
          <p className="text-sm font-semibold text-gray-600 mb-3">With Auto Embedding</p>
          <ol className="space-y-2">
            {AFTER_STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="font-bold text-gray-400 shrink-0">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Real index definition */}
      <div>
        <Description className="uppercase tracking-wide text-gray-500" style={{ marginBottom: 6, display: "block" }}>
          Atlas Vector Search index — <InlineCode>products</InlineCode> collection (from{" "}
          <InlineCode>seed.py</InlineCode>)
        </Description>
        <div className="overflow-auto">
          <Code language="json" showLineNumbers>{INDEX_DEFINITION}</Code>
        </div>
      </div>

      {/* Explanation note */}
      <div className="rounded-lg px-4 py-3 space-y-1.5 text-sm text-gray-700" style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <p>
          The <InlineCode>&quot;type&quot;: &quot;text&quot;</InlineCode> field on{" "}
          <InlineCode>search_text</InlineCode> is what activates auto-embedding.
        </p>
        <p>
          The <InlineCode>&quot;filter&quot;</InlineCode> fields are what make structured filters
          (price, size, waterproof, etc.) work inside <InlineCode>$vectorSearch</InlineCode> — those
          map directly to the filter conditions in <InlineCode>SearchProductsTool.java</InlineCode>.
        </p>
      </div>

      {/* Bullets */}
      <ul className="space-y-1.5">
        {BULLETS.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-gray-700">
            <span style={{ color: palette.green.dark1 }} className="shrink-0">✓</span>
            {b}
          </li>
        ))}
      </ul>

      {/* Callout */}
      <div className="rounded-lg px-4 py-3" style={{ backgroundColor: palette.green.light3, border: `1px solid ${palette.green.light2}` }}>
        <Body style={{ color: palette.green.dark2 }}>
          In this demo: the <InlineCode>search_text</InlineCode> field on every product is
          auto-embedded by Atlas using <InlineCode>voyage-3-large</InlineCode>. The Spring Boot app
          never calls an embedding API.
        </Body>
      </div>
    </div>
  );
}
