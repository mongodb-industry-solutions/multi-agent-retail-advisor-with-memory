"use client";

import { useState } from "react";
import { ToolInvocation } from "@/app/lib/api";

interface Props {
  invocations: ToolInvocation[];
}

const AGENT_COLOR: Record<string, string> = {
  PlannerAgent: "text-green-700 bg-green-100",
  ProductAgent: "text-blue-700 bg-blue-100",
  ProfileAgent: "text-purple-700 bg-purple-100",
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
      <div className="text-center py-8 text-gray-400 text-sm">
        Tool invocations will appear here after a response
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {invocations.map((inv, idx) => {
        const isExpanded = expanded === idx;
        const agentColorClass = AGENT_COLOR[inv.agent_name] ?? "text-gray-700 bg-gray-100";
        const icon = TOOL_ICON[inv.tool_name] ?? "⚙️";
        const hasError = !!inv.error;

        return (
          <div key={idx} className={`border rounded-lg overflow-hidden ${hasError ? "border-red-300" : "border-gray-200"}`}>
            <button
              onClick={() => setExpanded(isExpanded ? null : idx)}
              className="w-full flex items-center justify-between p-2.5 hover:bg-gray-50 text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">{icon}</span>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${agentColorClass} shrink-0`}>
                  {inv.agent_name}
                </span>
                <span className="text-xs font-mono text-gray-700 truncate">{inv.tool_name}</span>
                {hasError && <span className="text-xs text-red-500 shrink-0">⚠ error</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-xs text-gray-400 font-mono">{inv.latency_ms}ms</span>
                <span className="text-gray-400 text-xs">{isExpanded ? "▲" : "▼"}</span>
              </div>
            </button>
            {isExpanded && (
              <div className="border-t border-gray-100 p-3 space-y-3 bg-gray-50">
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Input</div>
                  <pre className="text-xs bg-white border border-gray-200 rounded p-2 overflow-auto max-h-40 text-gray-700">
                    {formatJson(inv.input)}
                  </pre>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Output</div>
                  <pre className="text-xs bg-white border border-gray-200 rounded p-2 overflow-auto max-h-60 text-gray-700">
                    {formatJson(inv.output)}
                  </pre>
                </div>
                {hasError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                    {inv.error}
                  </div>
                )}
                <div className="text-xs text-gray-400 font-mono">
                  {new Date(inv.timestamp).toLocaleTimeString()}
                </div>
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
