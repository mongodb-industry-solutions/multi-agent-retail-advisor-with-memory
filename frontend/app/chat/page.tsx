"use client";

import { useState, useEffect, useRef } from "react";
import {
  sendChat,
  getTrace,
  getAgents,
  getProfile,
  ChatResponse,
  TraceResponse,
  AgentCard,
  ProfileResponse,
} from "@/app/lib/api";
import { AgentCards } from "@/app/components/AgentCards";
import { TracePanel } from "@/app/components/TracePanel";
import { MongoDocViewer } from "@/app/components/MongoDocViewer";
import { ProfilePopover } from "@/app/components/ProfilePopover";
import Button from "@leafygreen-ui/button";
import { Select, Option } from "@leafygreen-ui/select";
import TextArea from "@leafygreen-ui/text-area";
import { Tabs, Tab } from "@leafygreen-ui/tabs";
import { Code } from "@leafygreen-ui/code";
import { Description, InlineCode } from "@leafygreen-ui/typography";
import { Pipeline, Stage } from "@leafygreen-ui/pipeline";
import { Spinner } from "@leafygreen-ui/loading-indicator";
import { Avatar } from "@leafygreen-ui/avatar";
import { BasicEmptyState } from "@leafygreen-ui/empty-state";
import { useToast } from "@leafygreen-ui/toast";

interface Message {
  role: "user" | "assistant";
  content: string;
  sessionId?: string;
  toolCallCount?: number;
}

const USERS = [
  { id: "user001", name: "Alice Chen", label: "Alice (outdoor enthusiast)" },
  { id: "user002", name: "Bob Martinez", label: "Bob (budget traveler)" },
  { id: "user003", name: "Carol Kim", label: "Carol (sustainability-focused)" },
];

const SAMPLE_QUERIES = [
  "I need waterproof hiking boots under $150, size 10, preferably sustainable brands",
  "What's the best rain jacket for a weekend backpacking trip?",
  "I'm looking for eco-friendly outdoor gear for a beginner hiker",
  "Find me trekking poles and a base layer under $200 total",
];

const TAB_ORDER = ["agents", "trace", "mongo"] as const;
type TabName = (typeof TAB_ORDER)[number];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedUser, setSelectedUser] = useState(USERS[0]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<AgentCard[]>([]);
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>("agents");
  const [activeAgent, setActiveAgent] = useState<string | undefined>();
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { pushToast } = useToast();

  const activeTabIndex = TAB_ORDER.indexOf(activeTab);
  const traceCount = trace?.toolInvocations.length ?? 0;

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    getAgents().then(setAgents).catch(() => {});
  }, []);
  useEffect(() => {
    setProfile(null);
    setProfileLoading(true);
    getProfile(selectedUser.id)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [selectedUser.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);
    setActiveAgent("PlannerAgent");
    setActiveTab("trace");

    try {
      const response: ChatResponse = await sendChat({
        userId: selectedUser.id,
        message: userMessage,
        sessionId: sessionId ?? undefined,
      });

      setSessionId(response.sessionId);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.reply,
          sessionId: response.sessionId,
          toolCallCount: response.toolCallCount,
        },
      ]);

      const [traceData, freshProfile] = await Promise.all([
        getTrace(response.sessionId),
        getProfile(selectedUser.id),
      ]);
      setTrace(traceData);
      setProfile(freshProfile);
    } catch {
      pushToast({
        title: "Backend unreachable",
        description: "Make sure the Java server is running on port 8080.",
        variant: "important",
      });
    } finally {
      setLoading(false);
      setActiveAgent(undefined);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function newSession() {
    setMessages([]);
    setSessionId(null);
    setTrace(null);
    setInput("");
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* LEFT: Chat panel */}
      <div className="flex flex-col w-[55%] border-r border-gray-200 bg-white">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="font-semibold text-gray-800 text-sm">Multi-Agent Retail Advisor</span>
          </div>
          <span className="text-xs text-gray-400 hidden lg:block shrink-0">ADK · A2A · MongoDB · Anthropic</span>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <Select
              size="small"
              aria-label="Select user"
              value={selectedUser.id}
              onChange={(value) => {
                setSelectedUser(USERS.find((u) => u.id === value)!);
                newSession();
              }}
            >
              {USERS.map((u) => (
                <Option key={u.id} value={u.id}>
                  {u.label}
                </Option>
              ))}
            </Select>
            <ProfilePopover
              userName={selectedUser.name}
              profile={profile}
              loading={profileLoading}
            />
            <Button size="small" variant="default" onClick={newSession} className="whitespace-nowrap">
              New chat
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-3">🏔️</div>
              <h2 className="font-semibold text-gray-700 mb-1">Retail Advisor Agent</h2>
              <Description className="max-w-xs mb-6 block">
                Powered by Anthropic LLM, Google ADK &amp; A2A patterns, and MongoDB as the memory layer.
              </Description>
              <div className="space-y-2 w-full max-w-sm">
                {SAMPLE_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="w-full text-left text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 transition-colors leading-snug"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="mr-2 shrink-0 mt-0.5">
                  <Avatar format="mongodb" sizeOverride={28} />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-green-600 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.toolCallCount !== undefined && (
                  <div className="mt-2 text-xs opacity-60">
                    {msg.toolCallCount} tool call{msg.toolCallCount !== 1 ? "s" : ""} • session:{" "}
                    <span className="font-mono">{msg.sessionId?.slice(0, 8)}</span>
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="ml-2 shrink-0 mt-0.5">
                  <Avatar format="text" text={selectedUser.name} sizeOverride={28} />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex justify-start items-center gap-2">
              <div className="shrink-0">
                <Avatar format="mongodb" sizeOverride={28} />
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <Spinner size={16} description="Agents working…" direction="horizontal" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-5 pt-2 pb-3 border-t border-gray-100">
          <div className="flex gap-2 items-end">
            <div className="flex-1 min-w-0">
              <TextArea
                label="Your message"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown as React.KeyboardEventHandler<HTMLTextAreaElement>}
                placeholder="Ask about outdoor gear…"
                disabled={loading}
                rows={2}
              />
            </div>
            <Button
              variant="primary"
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              {loading ? "…" : "Send"}
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
            <span>Enter to send</span>
            <span>·</span>
            <span>Shift+Enter for newline</span>
            {sessionId && (
              <>
                <span>·</span>
                <span>session: <InlineCode>{sessionId.slice(0, 8)}</InlineCode></span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Debug panel */}
      <div className="flex flex-col w-[45%] bg-white overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {mounted && (
          <Tabs
            value={activeTabIndex}
            onValueChange={(idx) => setActiveTab(TAB_ORDER[idx as number])}
            aria-label="Debug panel"
          >
            <Tab name="🤖 Agents">
              <div className="p-4 pt-3">
                <Description className="mb-2 block text-xs uppercase tracking-wide text-gray-500">
                  Orchestration flow
                </Description>
                <div className="mb-4">
                  <Pipeline size="small">
                    <Stage>User Query</Stage>
                    <Stage>PlannerAgent</Stage>
                    <Stage>ProfileAgent</Stage>
                    <Stage>ProductAgent</Stage>
                    <Stage>Response</Stage>
                  </Pipeline>
                </div>
                <Description className="mb-3 block">
                  A2A Agent Cards — each agent advertises its skills and capabilities:
                </Description>
                {agents.length > 0 ? (
                  <AgentCards agents={agents} activeAgent={loading ? activeAgent : undefined} />
                ) : (
                  <BasicEmptyState
                    title="No agents loaded"
                    description="Connect to the Java backend to load agent cards"
                  />
                )}
              </div>
            </Tab>

            <Tab name={`🔎 Trace${traceCount > 0 ? ` (${traceCount})` : ""}`}>
              <div className="p-4 pt-3">
                <Description className="mb-3 block">
                  Tool invocations logged to MongoDB{" "}
                  <InlineCode>tool_invocations</InlineCode> collection:
                </Description>
                <TracePanel invocations={trace?.toolInvocations ?? []} />
              </div>
            </Tab>

            <Tab name="🍃 MongoDB">
              <div className="p-4 pt-3">
                <Description className="mb-3 block">
                  Live documents from MongoDB Atlas{" "}
                  <InlineCode>retail_advisor_demo</InlineCode> database:
                </Description>
                <MongoDocViewer
                  session={trace?.session ?? {}}
                  agentState={trace?.agentState ?? {}}
                  user={profile?.user ?? {}}
                  memory={profile?.memory ?? {}}
                />
                {trace && (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                      tool_invocations ({trace.toolInvocations.length})
                    </div>
                    <div className="max-h-64 overflow-auto">
                      <Code language="json" darkMode>
                        {JSON.stringify(trace.toolInvocations, null, 2)}
                      </Code>
                    </div>
                  </div>
                )}
              </div>
            </Tab>
          </Tabs>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span>MongoDB Atlas</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span>Anthropic LLM</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Voyage AI</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
