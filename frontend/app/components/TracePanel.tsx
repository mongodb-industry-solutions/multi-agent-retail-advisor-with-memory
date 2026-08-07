"use client";

import { useState } from "react";
import { ToolInvocation } from "@/app/lib/api";
import Badge from "@leafygreen-ui/badge";
import Banner from "@leafygreen-ui/banner";
import { Code } from "@leafygreen-ui/code";
import Icon from "@leafygreen-ui/icon";
import { Body, Description, InlineCode } from "@leafygreen-ui/typography";
import { BasicEmptyState } from "@leafygreen-ui/empty-state";
import WhyMongoDBBanner from "./WhyMongoDBBanner";
import Image from "next/image";

interface Props {
  invocations: ToolInvocation[];
}

const AGENT_BADGE_VARIANT: Record<string, "green" | "blue" | "lightgray" | "darkgray"> = {
  PlannerAgent: "green",
  ProductAgent: "blue",
  ProfileAgent: "lightgray",
};

const TOOL_ICON: Record<string, string> = {
  search_products: "🔍",
  get_user_profile: "👤",
  get_user_memory: "🧠",
  update_user_memory: "💾",
  call_product_agent: "↗️",
  call_profile_agent: "↗️",
};

const whyMongoBanner = () => (
  <WhyMongoDBBanner title="🍃 MongoDB powers this trace">
    Tool invocations logged to MongoDB{" "}<InlineCode>tool_invocations</InlineCode> collection. Each invocation document includes input, output & latency in ms. The aggregation pipeline joins sessions + agent_state in a single query for instant audit replay.
  </WhyMongoDBBanner>
);

export function TracePanel({ invocations }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (invocations.length === 0) {
    return (
      <>
        {whyMongoBanner()}
        <BasicEmptyState
          title="No invocations yet"
          description="Tool invocations will appear here after a response"
          graphic={<Image src="/icons/archive-paper.png" alt="No invocations" width={150} height={150} />}
        />
      </>
    );
  }

  return (
    <div className="space-y-2">
      {whyMongoBanner()}
      {invocations.map((inv, idx) => {
        const isExpanded = expanded === idx;
        const badgeVariant = AGENT_BADGE_VARIANT[inv.agent_name] ?? "darkgray";
        const icon = TOOL_ICON[inv.tool_name] ?? "⚙️";
        const hasError = !!inv.error;

        return (
          <div
            key={idx}
            className={`border rounded-lg overflow-hidden ${hasError ? "border-red-300" : "border-gray-200"}`}
          >
            <button
              onClick={() => setExpanded(isExpanded ? null : idx)}
              className="w-full flex items-center justify-between p-2.5 hover:bg-gray-50 text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">{icon}</span>
                <Badge variant={badgeVariant}>{inv.agent_name}</Badge>
                <span className="text-xs font-mono text-gray-700 truncate">{inv.tool_name}</span>
                {hasError && <span className="text-xs text-red-500 shrink-0">⚠ error</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-xs text-gray-400 font-mono">{inv.latency_ms}ms</span>
                <Icon glyph={isExpanded ? "ChevronUp" : "ChevronDown"} size="small" />
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100 p-3 space-y-3 bg-gray-50">
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0">
                    <Body weight="medium" className="mb-1 block text-xs uppercase tracking-wide text-gray-500">Input</Body>
                    <div className="max-h-60 overflow-auto">
                      <Code language="json" showLineNumbers>{formatJson(inv.input)}</Code>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <Body weight="medium" className="mb-1 block text-xs uppercase tracking-wide text-gray-500">Output</Body>
                    <div className="max-h-60 overflow-auto">
                      <Code language="json" showLineNumbers>{formatJson(inv.output)}</Code>
                    </div>
                  </div>
                </div>
                {hasError && <Banner variant="danger">{inv.error}</Banner>}
                <Description className="font-mono block">
                  {new Date(inv.timestamp).toLocaleTimeString()}
                </Description>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
