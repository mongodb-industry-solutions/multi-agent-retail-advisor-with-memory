export interface ChatRequest {
  userId: string;
  message: string;
  sessionId?: string;
}

export interface ChatResponse {
  reply: string;
  sessionId: string;
  toolCallCount: number;
}

export interface ToolInvocation {
  session_id: string;
  agent_name: string;
  tool_name: string;
  input: string;
  output: string;
  latency_ms: number;
  timestamp: string;
  error?: string;
}

export interface TraceResponse {
  session: Record<string, unknown>;
  agentState: Record<string, unknown>;
  toolInvocations: ToolInvocation[];
}

export interface AgentSkill {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputDescription: string;
}

export interface AgentCard {
  name: string;
  description: string;
  version: string;
  endpoint: string;
  skills: AgentSkill[];
}

export async function sendChat(req: ChatRequest): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
  return res.json();
}

export async function getTrace(sessionId: string): Promise<TraceResponse> {
  const res = await fetch(`/api/trace/${sessionId}`);
  if (!res.ok) throw new Error(`Trace failed: ${res.status}`);
  return res.json();
}

export async function getAgents(): Promise<AgentCard[]> {
  const res = await fetch("/api/agents");
  if (!res.ok) throw new Error(`Agents fetch failed: ${res.status}`);
  return res.json();
}

export interface ProfileResponse {
  user: Record<string, unknown>;
  memory: Record<string, unknown>;
}

export async function getProfile(userId: string): Promise<ProfileResponse> {
  const res = await fetch(`/api/profile/${userId}`);
  if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
  return res.json();
}
