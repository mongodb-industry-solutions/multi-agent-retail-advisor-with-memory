"use client";

import { useState } from "react";
import Button from "@leafygreen-ui/button";
import { Code } from "@leafygreen-ui/code";
import { InlineCode } from "@leafygreen-ui/typography";
import { BasicEmptyState } from "@leafygreen-ui/empty-state";

type DocKey = "session" | "state" | "user" | "memory";

interface Props {
  session: Record<string, unknown>;
  agentState: Record<string, unknown>;
  user?: Record<string, unknown>;
  memory?: Record<string, unknown>;
}

const LABELS: Record<DocKey, string> = {
  session: "sessions",
  state: "agent_state",
  user: "users",
  memory: "user_memory",
};

export function MongoDocViewer({ session, agentState, user = {}, memory = {} }: Props) {
  const [activeDoc, setActiveDoc] = useState<DocKey>("user");

  const docs: Record<DocKey, Record<string, unknown>> = {
    session,
    state: agentState,
    user,
    memory,
  };

  const allEmpty = [session, agentState, user, memory].every(
    (d) => !d || Object.keys(d).length === 0
  );

  if (allEmpty) {
    return (
      <BasicEmptyState
        title="No documents yet"
        description="MongoDB documents will appear here after a response"
      />
    );
  }

  return (
    <div>
      <div className="flex gap-1 mb-2 flex-wrap">
        {(Object.keys(LABELS) as DocKey[]).map((key) => {
          const isEmpty = !docs[key] || Object.keys(docs[key]).length === 0;
          return (
            <Button
              key={key}
              size="small"
              variant={activeDoc === key ? "primary" : "default"}
              onClick={() => setActiveDoc(key)}
              disabled={isEmpty}
            >
              {LABELS[key]}
            </Button>
          );
        })}
      </div>
      <div className="relative">
        <div className="absolute top-2 right-2 z-10">
          <InlineCode>MongoDB Atlas</InlineCode>
        </div>
        <div className="max-h-56 overflow-auto">
          <Code language="json" darkMode>
            {JSON.stringify(docs[activeDoc], null, 2)}
          </Code>
        </div>
      </div>
    </div>
  );
}
