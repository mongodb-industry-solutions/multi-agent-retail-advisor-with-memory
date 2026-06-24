"use client";

import { MongoDBLogoMark } from "@leafygreen-ui/logo";
import Badge from "@leafygreen-ui/badge";
import Button from "@leafygreen-ui/button";
import { Icon } from "@leafygreen-ui/icon";
import { SessionPickerPopover } from "@/app/components/SessionPickerPopover";
import type { SessionSummary } from "@/app/lib/api";

interface ChatNavbarProps {
  selectedUser: { id: string; name: string; label: string };
  onUserClick: () => void;
  onResume: (session: SessionSummary) => void;
  latestSession: SessionSummary | null;
  onNewChat: () => void;
  loading: boolean;
}

const PILLS = ["Google ADK", "A2A", "Anthropic", "MongoDB", "VoyageAI", "Autoembedding"] as const;


export function ChatNavbar({
  selectedUser,
  onUserClick,
  onResume,
  latestSession,
  onNewChat,
  loading,
}: ChatNavbarProps) {
  return (
    <header
      className="h-14 shrink-0"
      style={{ backgroundColor: "#00684A" }}
    >
      <nav
        className="mx-auto flex h-full w-full max-w-[1800px] items-center justify-between px-5"
        aria-label="Primary"
      >
        {/* Left: logo + product name + tech stack pills */}
        <div className="flex items-center gap-3">
          <MongoDBLogoMark color="white" height={28} />
          <span className="text-sm font-semibold text-white tracking-tight whitespace-nowrap">
            Multi-Agent Retail Advisor
          </span>
          <div className="hidden items-center gap-1.5 md:flex">
            {PILLS.map((label) => (
              <Badge
                key={label}
                variant="green"
                style={{
                  backgroundColor: "#00ED64",
                  borderColor: "#00ED64",
                  color: "#001E2B",
                }}
              >
                {label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Right: user chip + history + new chat */}
        <div className="flex items-center gap-2">
          <button
            onClick={onUserClick}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-white/10"
            aria-label={`Open customer profile for ${selectedUser.name}`}
          >
            <div
                className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
                style={{ backgroundColor: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
              >
                <Icon glyph="Person" size={16} style={{ color: "#FFFFFF" }} />
              </div>
            <span className="hidden md:flex md:flex-col whitespace-nowrap items-start">
              <span className="text-sm font-medium text-white leading-tight">
                {selectedUser.name}
              </span>
              <span className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.65)" }}>
                {selectedUser.label}
              </span>
            </span>
          </button>

          <div
            className="h-5 w-px"
            style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
          />

          <SessionPickerPopover
            userId={selectedUser.id}
            onResume={onResume}
            latestSession={latestSession}
          />

          <Button
            size="small"
            variant="default"
            onClick={onNewChat}
            disabled={loading}
            className="whitespace-nowrap"
          >
            + New chat
          </Button>
        </div>
      </nav>
    </header>
  );
}
