"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  sendChat,
  getTrace,
  getAgents,
  getProfile,
  ChatResponse,
  TraceResponse,
  AgentCard,
  ProfileResponse,
  SessionSummary,
} from "@/app/lib/api";
import { AgentCards } from "@/app/components/AgentCards";
import { TracePanel } from "@/app/components/TracePanel";
import { MongoDocViewer } from "@/app/components/MongoDocViewer";
import { ChatNavbar } from "@/app/components/ChatNavbar";
import { CustomerTab } from "@/app/components/CustomerTab";
import Button from "@leafygreen-ui/button";
import { Tabs, Tab } from "@leafygreen-ui/tabs";
import { Icon } from "@leafygreen-ui/icon";
import { Description, InlineCode } from "@leafygreen-ui/typography";
import { Pipeline, Stage } from "@leafygreen-ui/pipeline";
import { Spinner } from "@leafygreen-ui/loading-indicator";
import { Avatar } from "@leafygreen-ui/avatar";
import { BasicEmptyState } from "@leafygreen-ui/empty-state";
import Banner from "@leafygreen-ui/banner";
import ReactMarkdown from "react-markdown";
import WhyMongoDBBanner from "../components/WhyMongoDBBanner";
import WhyMongoDBModal from "../components/WhyMongoDBModal";
import Image from "next/image";

interface Message {
  role: "user" | "assistant";
  content: string;
  sessionId?: string;
  toolCallCount?: number;
}

const USERS = [
  { id: "user001", name: "Alice Chen", label: "Outdoor enthusiast" },
  { id: "user002", name: "Bob Martinez", label: "Budget traveler" },
  { id: "user003", name: "Carol Kim", label: "Sustainability-focused" },
];

const SAMPLE_QUERIES_BY_USER: Record<string, string[]> = {
  user001: [
    "Recommend me a full kit based on what you know about me",
    "I need waterproof hiking boots under $150, size 10, preferably sustainable brands",
    "What's the best rain jacket for a weekend backpacking trip?",
    "Find me trekking poles and a base layer under $200 total",
  ],
  user002: [
    "Recommend me a full kit based on what you know about me",
    "What gear do I need for my first overnight hike?",
    "I'm looking for hiking boots under $100 for wide feet",
    "What's a good beginner backpack for weekend camping?",
  ],
  user003: [
    "Recommend me a full kit based on what you know about me",
    "Compare the Patagonia Nano Puff vs Arc'teryx Cerium for alpine starts",
    "I need trail running shoes that can handle technical Vermont terrain",
    "What base layers work best for mountaineering in cold, wet conditions?",
  ],
};

const TAB_ORDER = ["customer", "agents", "trace", "mongo"] as const;
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
  const [latestSession, setLatestSession] = useState<SessionSummary | null>(
    null,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showWhyModal, setShowWhyModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeTabIndex = TAB_ORDER.indexOf(activeTab);
  const traceCount = trace?.toolInvocations.length ?? 0;
  const sampleQueries =
    SAMPLE_QUERIES_BY_USER[selectedUser.id] ?? SAMPLE_QUERIES_BY_USER.user001;

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    getAgents()
      .then(setAgents)
      .catch(() => {});
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setProfile(null);
    setProfileLoading(true);
    getProfile(selectedUser.id, controller.signal)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setProfileLoading(false));
    return () => controller.abort();
  }, [selectedUser.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    const isNewSession = !sessionId;
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

      if (isNewSession) {
        const now = new Date().toISOString();
        setLatestSession({
          sessionId: response.sessionId,
          preview: userMessage,
          messageCount: 2,
          createdAt: now,
          updatedAt: now,
          starred: false,
        });
      }

      const [traceResult, profileResult] = await Promise.allSettled([
        getTrace(response.sessionId),
        getProfile(selectedUser.id),
      ]);
      if (traceResult.status === "fulfilled") setTrace(traceResult.value);
      if (profileResult.status === "fulfilled") setProfile(profileResult.value);
    } catch {
      setErrorMsg("Backend unreachable — make sure the Java server is running on port 8080.");
    } finally {
      setLoading(false);
      setActiveAgent(undefined);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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
    setLatestSession(null);
  }

  async function handleResumeSession(summary: SessionSummary) {
    try {
      const traceData = await getTrace(summary.sessionId);
      const raw =
        (traceData.session.messages as Array<{
          role: string;
          content: string;
        }>) ?? [];
      setMessages(
        raw.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      );
      setSessionId(summary.sessionId);
      setTrace(traceData);
      setActiveTab("trace");
    } catch {
      setErrorMsg("Could not load session — please try again.");
    }
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 overflow-hidden">
      <ChatNavbar
        selectedUser={selectedUser}
        onUserClick={() => setActiveTab("customer")}
        onResume={handleResumeSession}
        latestSession={latestSession}
        onNewChat={newSession}
        loading={loading}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Chat panel */}
        <div className="flex flex-col w-[55%] border-r border-gray-200 bg-white">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ backgroundColor: "#E8F5EE" }}>
              <svg width="22" height="22" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 28L13 12L19 22L23 16L32 28H4Z" fill="#00684A" fillOpacity="0.85" />
                <circle cx="27" cy="11" r="3.5" fill="#00ED64" />
              </svg>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-gray-900 text-sm">The Trail Store</span>
              <span className="text-xs text-gray-500">Outdoor gear for every trail</span>
            </div>
          </div>

        </div>

        {/* Error banner */}
        {errorMsg && (
          <div className="px-5 pt-3">
            <Banner variant="danger" onClose={() => setErrorMsg(null)}>
              {errorMsg}
            </Banner>
          </div>
        )}

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
          style={{ backgroundColor: "#f9faf9" }}
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="mb-3 flex items-center justify-center w-16 h-16 rounded-2xl" style={{ backgroundColor: "#E8F5EE" }}>
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 28L13 12L19 22L23 16L32 28H4Z" fill="#00684A" fillOpacity="0.85" />
                  <circle cx="27" cy="11" r="3.5" fill="#00ED64" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900 mt-3 mb-1">
                The Trail Store
              </h1>
              <p className="text-sm text-gray-500 max-w-s mb-5 leading-relaxed">
                Chat with our retail store AI assistant. Not a search bar. An advisor that knows your trails, your brands, and your size.
              </p>
              <h2 className="font-semibold text-gray-700 mb-1">
                Suggested questions:
              </h2>

              <div className="space-y-2 w-full max-w-sm">
                {sampleQueries.map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="suggestion"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="mr-2 shrink-0 mt-0.5">
                  <Avatar format="mongodb" sizeOverride={28} />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-base leading-relaxed ${
                  msg.role === "user"
                    ? "bg-green-600 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => (
                        <p className="mb-2 last:mb-0 leading-relaxed">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc pl-4 mb-2 space-y-0.5">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal pl-4 mb-2 space-y-0.5">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="leading-snug">{children}</li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold">{children}</strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic">{children}</em>
                      ),
                      h1: ({ children }) => (
                        <h1 className="font-bold text-base mb-1 mt-2">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="font-semibold mb-1 mt-2">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="font-semibold mb-1 mt-1">{children}</h3>
                      ),
                      code: ({ className, children }) =>
                        className?.includes("language-") ? (
                          <code className="block bg-black/10 rounded px-2 py-1.5 font-mono text-xs mb-2 whitespace-pre-wrap">
                            {children}
                          </code>
                        ) : (
                          <code className="bg-black/10 rounded px-1 py-0.5 font-mono text-xs">
                            {children}
                          </code>
                        ),
                      pre: ({ children }) => (
                        <pre className="mb-2 overflow-x-auto">{children}</pre>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-gray-400 pl-3 italic mb-2 text-gray-600">
                          {children}
                        </blockquote>
                      ),
                      hr: () => <hr className="border-gray-300 my-2" />,
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          className="underline text-green-700 hover:text-green-800"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
                {msg.toolCallCount !== undefined && (
                  <div className="mt-2 text-xs opacity-60">
                    {msg.toolCallCount} tool call
                    {msg.toolCallCount !== 1 ? "s" : ""} • session:{" "}
                    <span className="font-mono">
                      {msg.sessionId?.slice(0, 8)}
                    </span>
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="ml-2 shrink-0 mt-0.5">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full" style={{ backgroundColor: "#00684A" }}>
                    <Icon glyph="Person" size={16} style={{ color: "#FFFFFF" }} />
                  </div>
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
                <Spinner
                  size={16}
                  description="Agents working…"
                  direction="horizontal"
                />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-5 pt-2 pb-3 border-t border-gray-100">
          <div className="flex gap-2 items-end">
            <div className="flex-1 min-w-0">
              <input
                aria-label="Your message"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about outdoor gear…"
                disabled={loading}
                style={{
                  flexGrow: 1,
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "10px",
                  marginRight: "10px",
                  width: "100%",
                }}
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
                <span>
                  session: <InlineCode>{sessionId.slice(0, 8)}</InlineCode>
                </span>
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
              <Tab name={<span className="flex items-center gap-1.5"><Icon glyph="Person" size={14} />Customer</span>}>
                <div className="p-4 pt-3">
                  <CustomerTab
                    users={USERS}
                    selectedUser={selectedUser}
                    onSelectUser={(user) => {
                      setSelectedUser(user);
                      newSession();
                    }}
                    onMemoryReset={() => {
                      setProfileLoading(true);
                      getProfile(selectedUser.id)
                        .then(setProfile)
                        .catch(() => {})
                        .finally(() => setProfileLoading(false));
                    }}
                    loading={loading}
                    profile={profile}
                    profileLoading={profileLoading}
                  />
                </div>
              </Tab>

              <Tab name={<span className="flex items-center gap-1.5"><Icon glyph="AIModel" size={14} />Agents</span>}>
                <div className="p-4 pt-3">
                  <WhyMongoDBBanner title="🍃 Why MongoDB for Agentic AI">
                    One platform replaces vector store, session store, memory
                    store & audit log — no stitching. Flexible document model
                    absorbs heterogeneous agent state — no schema migrations.
                    Atlas Vector Search (Voyage AI) + Full-Text Search in the
                    same collection, automatic fallback
                  </WhyMongoDBBanner>
                  <Description
                    className="mb-2 mt-2 block text-xs uppercase tracking-wide text-gray-500"
                    style={{ margin: "1rem 0 0 0" }}
                  >
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
                  <Description className="mb-2 block text-xs uppercase tracking-wide text-gray-500" style={{ margin: '1rem 0 0 0' }}>
                    Three agents work together to assist customers, they
                    communicate between eachother through A2A protocol.
                  </Description>
                  {agents.length > 0 ? (
                    <AgentCards
                      agents={agents}
                      activeAgent={loading ? activeAgent : undefined}
                    />
                  ) : (
                    <BasicEmptyState
                      title="No agents loaded"
                      description="Connect to the Java backend to load agent cards"
                      graphic={<Image src="/icons/agent.png" alt="No invocations" width={150} height={150} />}
                    />
                  )}
                </div>
              </Tab>

              <Tab name={<span className="flex items-center gap-1.5"><Icon glyph="MagnifyingGlass" size={14} />Trace{traceCount > 0 ? ` (${traceCount})` : ""}</span>}>
                <div className="p-4 pt-3">
                  <TracePanel invocations={trace?.toolInvocations ?? []} />
                </div>
              </Tab>

              <Tab name={<span className="flex items-center gap-1.5"><Icon glyph="Database" size={14} />MongoDB</span>}>
                <div className="p-4 pt-3">
                  <MongoDocViewer
                    session={trace?.session ?? {}}
                    agentState={trace?.agentState ?? {}}
                    user={profile?.user ?? {}}
                    memory={profile?.memory ?? {}}
                    onLearnMore={() => setShowWhyModal(true)}
                  />
                </div>
              </Tab>
            </Tabs>
          )}
        </div>

        </div>
      </div>

      <WhyMongoDBModal open={showWhyModal} onClose={() => setShowWhyModal(false)} />
    </div>
  );
}
