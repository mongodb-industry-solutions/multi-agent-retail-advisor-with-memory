"use client";

import { AgentCard } from "@/app/lib/api";

const AGENT_COLORS: Record<string, string> = {
  PlannerAgent: "border-green-500 bg-green-50",
  ProductAgent: "border-blue-500 bg-blue-50",
  ProfileAgent: "border-purple-500 bg-purple-50",
};

const AGENT_ICONS: Record<string, string> = {
  PlannerAgent: "🧠",
  ProductAgent: "🔍",
  ProfileAgent: "👤",
};

interface Props {
  agents: AgentCard[];
  activeAgent?: string;
}

export function AgentCards({ agents, activeAgent }: Props) {
  return (
    <div className="space-y-3">
      {agents.map((agent) => {
        const isActive = activeAgent === agent.name;
        const colorClass = AGENT_COLORS[agent.name] ?? "border-gray-300 bg-gray-50";
        return (
          <div
            key={agent.name}
            className={`border-l-4 rounded-lg p-3 transition-all duration-300 ${colorClass} ${
              isActive ? "shadow-md scale-[1.01]" : "opacity-80"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">{AGENT_ICONS[agent.name] ?? "🤖"}</span>
                <span className="font-semibold text-sm text-gray-800">{agent.name}</span>
                <span className="text-xs text-gray-400 font-mono">v{agent.version}</span>
              </div>
              {isActive && (
                <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  active
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 mb-2">{agent.description}</p>
            <div className="space-y-1">
              {agent.skills.map((skill) => (
                <div key={skill.name} className="text-xs bg-white/70 rounded px-2 py-1 font-mono text-gray-700">
                  <span className="text-gray-400">skill: </span>{skill.name}
                </div>
              ))}
            </div>
            <div className="mt-2">
              <span className="text-xs text-gray-400 font-mono">{agent.endpoint}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
