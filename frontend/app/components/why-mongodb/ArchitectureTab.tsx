"use client";

import { useState } from "react";
import { Body } from "@leafygreen-ui/typography";
import { palette } from "@leafygreen-ui/palette";

const FLOW = ["Client", "Orchestrator (ADK + A2A)", "LLM (Claude)", "MongoDB Atlas"];

export function ArchitectureTab() {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="p-6 space-y-5">
      <Body>
        Every tool call, memory read, and state transition flows through MongoDB — it&apos;s not just
        storage, it&apos;s what makes agents stateful.
      </Body>

      <div
        className="rounded-xl border border-gray-100 overflow-hidden flex items-center justify-center"
        style={{ minHeight: 220, backgroundColor: "#f9fafb" }}
      >
        {!imgError ? (
          <img
            src="/images/arch-coming-soon"
            alt="Reference architecture diagram"
            className="w-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <p className="text-sm text-gray-400 italic">Architecture diagram coming soon</p>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 flex-wrap">
        {FLOW.map((label, i) => (
          <span key={label} className="flex items-center gap-2">
            <span
              className="px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                backgroundColor: palette.green.light3,
                color: palette.green.dark2,
                border: `1px solid ${palette.green.light2}`,
              }}
            >
              {label}
            </span>
            {i < FLOW.length - 1 && <span className="text-gray-400 text-sm">→</span>}
          </span>
        ))}
      </div>

      <div
        className="rounded-lg px-4 py-3"
        style={{ backgroundColor: palette.green.light3, border: `1px solid ${palette.green.light2}` }}
      >
        <Body style={{ color: palette.green.dark2 }}>
          ADK + A2A are the <strong>control plane</strong> — MongoDB is the <strong>data plane</strong>.
        </Body>
      </div>
    </div>
  );
}
