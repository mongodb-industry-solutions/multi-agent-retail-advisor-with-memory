"use client";

import { useState, useEffect, useRef } from "react";
import {
  sendChat,
  getTrace,
  getAgents,
  ChatResponse,
  TraceResponse,
  AgentCard,
} from "@/app/lib/api";
import { AgentCards } from "@/app/components/AgentCards";
import { TracePanel } from "@/app/components/TracePanel";
import { MongoDocViewer } from "@/app/components/MongoDocViewer";

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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedUser, setSelectedUser] = useState(USERS[0]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<AgentCard[]>([]);
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"trace" | "agents" | "mongo">("agents");
  const [activeAgent, setActiveAgent] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAgents().then(setAgents).catch(() => {});
  }, []);

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

      // Fetch trace
      const traceData = await getTrace(response.sessionId);
      setTrace(traceData);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ Failed to reach the backend. Make sure the Java server is running on port 8080.",
        },
      ]);
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
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="font-semibold text-gray-800 text-sm">Multi-Agent Retail Advisor with Memory</span>
            </div>
            <span className="text-xs text-gray-400 hidden sm:block">ADK + A2A + MongoDB + Anthropic</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedUser.id}
              onChange={(e) => {
                setSelectedUser(USERS.find((u) => u.id === e.target.value)!);
                newSession();
              }}
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              {USERS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
            <button
              onClick={newSession}
              className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
            >
              New chat
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-3">🏔️</div>
              <h2 className="font-semibold text-gray-700 mb-1">Retail Advisor Agent</h2>
              <p className="text-sm text-gray-400 max-w-xs mb-6">
                Powered by Anthropic LLM, Google ADK & A2A patterns, and MongoDB as the memory layer.
              </p>
              <div className="space-y-2 w-full max-w-sm">
                {SAMPLE_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="w-full text-left text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 transition-colors"
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
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-sm mr-2 shrink-0 mt-0.5">
                  🤖
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
                <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-xs text-white ml-2 shrink-0 mt-0.5 font-medium">
                  {selectedUser.name[0]}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-sm mr-2 shrink-0">
                🤖
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                  <span>Agents working…</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-5 py-3 border-t border-gray-100">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about outdoor gear…"
              rows={2}
              className="flex-1 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-gray-400"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="self-end px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "…" : "Send"}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
            <span>Enter to send</span>
            <span>·</span>
            <span>Shift+Enter for newline</span>
            {sessionId && (
              <>
                <span>·</span>
                <span className="font-mono">session: {sessionId.slice(0, 8)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Debug panel */}
      <div className="flex flex-col w-[45%] bg-white overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center px-4 pt-3 pb-0 border-b border-gray-100 gap-1">
          {(["agents", "trace", "mongo"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-xs font-medium px-3 py-2 rounded-t-lg transition-colors border-b-2 ${
                activeTab === tab
                  ? "border-green-600 text-green-700 bg-green-50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab === "agents" ? "🤖 Agents" : tab === "trace" ? "🔎 Trace" : "🍃 MongoDB"}
              {tab === "trace" && trace && trace.toolInvocations.length > 0 && (
                <span className="ml-1.5 bg-green-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {trace.toolInvocations.length}
                </span>
              )}
            </button>
          ))}
          <div className="ml-auto text-xs text-gray-400 pb-2">
            {sessionId && (
              <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                {sessionId.slice(0, 8)}
              </span>
            )}
          </div>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "agents" && (
            <div>
              <p className="text-xs text-gray-500 mb-3">
                A2A Agent Cards — each agent advertises its skills and capabilities:
              </p>
              {agents.length > 0 ? (
                <AgentCards agents={agents} activeAgent={loading ? activeAgent : undefined} />
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Connect to the Java backend to load agent cards
                </div>
              )}
            </div>
          )}

          {activeTab === "trace" && (
            <div>
              <p className="text-xs text-gray-500 mb-3">
                Tool invocations logged to MongoDB <code className="bg-gray-100 px-1 rounded">tool_invocations</code> collection:
              </p>
              <TracePanel invocations={trace?.toolInvocations ?? []} />
            </div>
          )}

          {activeTab === "mongo" && (
            <div>
              <p className="text-xs text-gray-500 mb-3">
                Live documents from MongoDB Atlas <code className="bg-gray-100 px-1 rounded">retail_advisor_demo</code> database:
              </p>
              <MongoDocViewer
                session={trace?.session ?? {}}
                agentState={trace?.agentState ?? {}}
              />
              {trace && (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                    tool_invocations ({trace.toolInvocations.length})
                  </div>
                  <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-3 overflow-auto max-h-64 font-mono">
                    {JSON.stringify(trace.toolInvocations, null, 2)}
                  </pre>
                </div>
              )}
            </div>
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
