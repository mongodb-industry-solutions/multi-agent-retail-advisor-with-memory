"use client";

import { useState } from "react";
import { ToolInvocation } from "@/app/lib/api";
import Badge from "@leafygreen-ui/badge";
import Banner from "@leafygreen-ui/banner";
import { Code } from "@leafygreen-ui/code";
import Icon from "@leafygreen-ui/icon";
import { Body } from "@leafygreen-ui/typography";
import { BasicEmptyState } from "@leafygreen-ui/empty-state";

interface Props {
  invocations: ToolInvocation[];
}

const AGENT_BADGE_VARIANT: Record<string, "green" | "blue" | "lightgray"> = {
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

export function TracePanel({ invocations }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (invocations.length === 0) {
    return (
      <BasicEmptyState
        title="No invocations yet"
        description="Tool invocations will appear here after a response"
      />
    );
  }

  return (
    <div className="space-y-2">
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
                <div>
                  <Body weight="medium" className="mb-1 block text-xs uppercase tracking-wide text-gray-500">Input</Body>
                  <div className="max-h-40 overflow-auto">
                    <Code language="json">{formatJson(inv.input)}</Code>
                  </div>
                </div>
                <div>
                  <Body weight="medium" className="mb-1 block text-xs uppercase tracking-wide text-gray-500">Output</Body>
                  <div className="max-h-60 overflow-auto">
                    <Code language="json">{formatJson(inv.output)}</Code>
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
