"use client";

import { useState } from "react";

interface Props {
  session: Record<string, unknown>;
  agentState: Record<string, unknown>;
}

export function MongoDocViewer({ session, agentState }: Props) {
  const [activeDoc, setActiveDoc] = useState<"session" | "state">("session");

  const docs: Record<string, Record<string, unknown>> = {
    session,
    state: agentState,
  };

  const labels: Record<string, string> = {
    session: "sessions",
    state: "agent_state",
  };

  if (!session || Object.keys(session).length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 text-xs">
        MongoDB documents will appear here after a response
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-1 mb-2">
        {(["session", "state"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setActiveDoc(key)}
            className={`text-xs font-mono px-2 py-1 rounded transition-colors ${
              activeDoc === key
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {labels[key]}
          </button>
        ))}
      </div>
      <div className="relative">
        <div className="absolute top-2 right-2 text-xs text-gray-400 font-mono bg-white px-1 rounded">
          MongoDB Atlas
        </div>
        <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-3 overflow-auto max-h-56 font-mono">
          {JSON.stringify(docs[activeDoc], null, 2)}
        </pre>
      </div>
    </div>
  );
}
