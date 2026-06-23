"use client";

import { useState } from "react";
import Button from "@leafygreen-ui/button";
import { Code } from "@leafygreen-ui/code";
import { InlineCode } from "@leafygreen-ui/typography";
import { BasicEmptyState } from "@leafygreen-ui/empty-state";
import { OrderedList, OrderedListItem } from "@leafygreen-ui/ordered-list";
import WhyMongoDBBanner from "./WhyMongoDBBanner";
import Image from "next/image";

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

const whyMongoBanner = () => (
  <WhyMongoDBBanner title="🍃 One Platform - 5 data needs">
    <OrderedList>
      <OrderedListItem
        title={<span><strong>Short Term Memory: </strong><InlineCode>sessions</InlineCode> — per-interaction chat history & working memory.</span>}
      />
      <OrderedListItem
        title={<span><strong>Long Term Memory: </strong><InlineCode>user_memory</InlineCode> — distilled facts that outlast a session.</span>}
      />
      <OrderedListItem
        title={<span><strong>Knowledge: </strong><InlineCode>products</InlineCode> — catalog with 2048-dim vector embeddings (Voyage AI).</span>}
      />
      <OrderedListItem
        title={<span><strong>Agent State: </strong><InlineCode>agent_state</InlineCode> — orchestration checkpoints & decisions.</span>}
      />
      <OrderedListItem
        title={<span><strong>Observability: </strong><InlineCode>tool_invocations</InlineCode> — full audit log with latency.</span>}
      />
    </OrderedList>
  </WhyMongoDBBanner>
);

export function MongoDocViewer({
  session,
  agentState,
  user = {},
  memory = {},
}: Props) {
  const [activeDoc, setActiveDoc] = useState<DocKey>("session");

  const docs: Record<DocKey, Record<string, unknown>> = {
    session,
    state: agentState,
    user,
    memory,
  };

  const allEmpty = [session, agentState, user, memory].every(
    (d) => !d || Object.keys(d).length === 0,
  );

  if (allEmpty) {
    return (
      <>
        {whyMongoBanner()}
        <BasicEmptyState
          title="No documents yet"
          description="Tool invocations will appear here after you get a response"
          graphic={<Image src="/icons/data.png" alt="No invocations" width={150} height={150} style={{ width: 150, height: "auto" }} />}
        />
      </>
    );
  }

  return (
    <div>
      {whyMongoBanner()}
      <div className="flex gap-1 mb-2 mt-2 flex-wrap">
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
        <div className="overflow-auto">
          <Code language="json" darkMode>
            {JSON.stringify(docs[activeDoc], null, 2)}
          </Code>
        </div>
      </div>
    </div>
  );
}
