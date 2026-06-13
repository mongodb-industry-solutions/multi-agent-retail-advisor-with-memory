"use client";

import { useState } from "react";
import Button from "@leafygreen-ui/button";
import { Code } from "@leafygreen-ui/code";
import { Description, InlineCode } from "@leafygreen-ui/typography";

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
      <Description className="text-center py-6 block">
        MongoDB documents will appear here after a response
      </Description>
    );
  }

  return (
    <div>
      <div className="flex gap-1 mb-2">
        {(["session", "state"] as const).map((key) => (
          <Button
            key={key}
            size="small"
            variant={activeDoc === key ? "primary" : "default"}
            onClick={() => setActiveDoc(key)}
          >
            {labels[key]}
          </Button>
        ))}
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
