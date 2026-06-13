"use client";

import { AgentCard } from "@/app/lib/api";
import Card from "@leafygreen-ui/card";
import Badge from "@leafygreen-ui/badge";
import { Body, Description, InlineCode } from "@leafygreen-ui/typography";

const AGENT_BORDER: Record<string, string> = {
  PlannerAgent: "border-green-500",
  ProductAgent: "border-blue-500",
  ProfileAgent: "border-purple-500",
};

const AGENT_BG: Record<string, string> = {
  PlannerAgent: "#f0fdf4",
  ProductAgent: "#eff6ff",
  ProfileAgent: "#faf5ff",
};

const AGENT_BADGE_VARIANT: Record<string, "green" | "blue" | "lightgray"> = {
  PlannerAgent: "green",
  ProductAgent: "blue",
  ProfileAgent: "lightgray",
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
        const borderClass = AGENT_BORDER[agent.name] ?? "border-gray-300";
        const bgColor = AGENT_BG[agent.name] ?? "#f9fafb";
        const badgeVariant = AGENT_BADGE_VARIANT[agent.name] ?? "darkgray";

        return (
          <Card
            key={agent.name}
            className={`!p-3 border-l-4 ${borderClass} transition-all duration-300 ${
              isActive ? "shadow-md scale-[1.01]" : "opacity-80"
            }`}
            style={{ backgroundColor: bgColor }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">{AGENT_ICONS[agent.name] ?? "🤖"}</span>
                <Body weight="medium">{agent.name}</Body>
                <Description className="font-mono">v{agent.version}</Description>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant={badgeVariant}>{agent.name.replace("Agent", "")}</Badge>
                {isActive && (
                  <>
                    <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <Badge variant="green">active</Badge>
                  </>
                )}
              </div>
            </div>
            <Body className="mb-2">{agent.description}</Body>
            <div className="space-y-1.5">
              {agent.skills.map((skill) => (
                <div key={skill.name} className="flex items-center gap-1.5">
                  <Badge variant="lightgray">skill</Badge>
                  <InlineCode>{skill.name}</InlineCode>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <Description className="font-mono">{agent.endpoint}</Description>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
