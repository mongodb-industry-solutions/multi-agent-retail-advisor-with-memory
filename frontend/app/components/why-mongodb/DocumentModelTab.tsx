"use client";

import { Body, InlineCode, Description } from "@leafygreen-ui/typography";
import { Code } from "@leafygreen-ui/code";
import Badge from "@leafygreen-ui/badge";
import { Icon } from "@leafygreen-ui/icon";
import { palette } from "@leafygreen-ui/palette";

const DIY_ITEMS = [
  { label: "Embedding Vendor", tag: "External API" },
  { label: "Reranker", tag: "External API" },
  { label: "Vector Database", tag: "Separate System" },
  { label: "Search Index", tag: "Separate System" },
  { label: "Session Store", tag: "Separate System" },
  { label: "Memory Store", tag: "Separate System" },
  { label: "Audit Log", tag: "Separate System" },
];

const MONGO_ITEMS: { label: string; tag: string; newest?: boolean; code?: boolean }[] = [
  { label: "Voyage Embeddings", tag: "Best-in-class" },
  { label: "Auto Embedding", tag: "Native Atlas", newest: true },
  { label: "Voyage Rerankers", tag: "Integrated" },
  { label: "Vector Search", tag: "Semantic Retrieval" },
  { label: "Text Search", tag: "Hybrid Search" },
];

const COLLECTIONS: { name: string; glyph: string; desc: string }[] = [
  { name: "sessions", glyph: "Clock", desc: "Short-term memory: chat history per interaction" },
  { name: "user_memory", glyph: "Save", desc: "Long-term memory: distilled facts across sessions" },
  { name: "products", glyph: "Tag", desc: "Knowledge: catalog with auto-embedded vectors" },
  { name: "agent_state", glyph: "Diagram", desc: "State: orchestration lifecycle & decisions" },
  { name: "tool_invocations", glyph: "ActivityFeed", desc: "Observability: every tool call, input, output, latency" },
  { name: "users", glyph: "Person", desc: "Profile: preferences, sizes, favorite brands" },
];

const AGENT_STATE_SAMPLE = `{
  "sessionId": "a1b2c3d4e5f6...",
  "userId": "user001",
  "status": "completed",
  "workflow": "retail_advisor",
  "startedAt": "2025-06-28T10:30:00.000Z",
  "completedAt": "2025-06-28T10:30:04.231Z",
  "agentsInvoked": [
    "PlannerAgent",
    "ProfileAgent",
    "ProductAgent"
  ],
  "toolCallCount": 3,
  "plannerDecision": "User needs waterproof boots. Fetch profile first, then search products."
}`;

export function DocumentModelTab() {
  return (
    <div className="p-6 space-y-5">
      <Body>
        Most agentic stacks bolt together 4–5 <strong>technologies</strong>. MongoDB handles all of it in one.
      </Body>

      {/* DIY vs MongoDB comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* DIY Stack */}
        <div className="rounded-lg overflow-hidden" style={{ border: "2px solid #fecaca" }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#fef2f2", borderBottom: "1px solid #fecaca" }}>
                <th className="text-left px-3 py-2.5 font-bold text-red-900" colSpan={2}>
                  DIY Stack
                </th>
              </tr>
            </thead>
            <tbody>
              {DIY_ITEMS.map(({ label, tag }) => (
                <tr key={label} style={{ borderTop: "1px solid #f3f4f6" }}>
                  <td className="px-3 py-2.5 text-gray-800">{label}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Badge variant="red">{tag}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* MongoDB */}
        <div className="rounded-lg overflow-hidden" style={{ border: `2px solid ${palette.green.light1}` }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: palette.green.light3, borderBottom: `1px solid ${palette.green.light1}` }}>
                <th className="text-left px-3 py-2.5 font-bold" style={{ color: palette.green.dark2 }} colSpan={2}>
                  MongoDB
                </th>
              </tr>
            </thead>
            <tbody>
              {MONGO_ITEMS.map(({ label, tag, newest }) => (
                <tr key={label} style={{ borderTop: "1px solid #f3f4f6" }}>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-800">{label}</span>
                      {newest && <Badge variant="blue">NEWEST</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Badge variant="green">{tag}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collection cards */}
      <div>
        <Description style={{ margin: "0 0 8px 0", display: "block" }} className="uppercase tracking-wide text-gray-500">
          Collections in this demo
        </Description>
        <div className="grid grid-cols-2 gap-2">
          {COLLECTIONS.map(({ name, glyph, desc }) => (
            <div key={name} className="flex items-start gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50">
              <Icon glyph={glyph} size={16} style={{ color: palette.green.dark1, marginTop: 2, flexShrink: 0 }} />
              <div className="min-w-0">
                <InlineCode>{name}</InlineCode>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* agent_state sample */}
      <div>
        <Description style={{ marginBottom: 6, display: "block" }} className="uppercase tracking-wide text-gray-500">
          Example: <InlineCode>agent_state</InlineCode> document — shape varies per run, no migrations needed
        </Description>
        <div className="overflow-auto">
          <Code language="json" showLineNumbers>{AGENT_STATE_SAMPLE}</Code>
        </div>
      </div>

      {/* Callout */}
      <div className="rounded-lg px-4 py-3" style={{ backgroundColor: palette.green.light3, border: `1px solid ${palette.green.light2}` }}>
        <Body style={{ color: palette.green.dark2 }}>
          The document model absorbs heterogeneous agent state. No schema migrations as the system evolves.
        </Body>
      </div>
    </div>
  );
}
