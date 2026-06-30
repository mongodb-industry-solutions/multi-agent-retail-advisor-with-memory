"use client";

import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { SessionSummary, listSessions, setSessionStar } from "@/app/lib/api";
import { Popover } from "@leafygreen-ui/popover";
import Card from "@leafygreen-ui/card";
import Badge from "@leafygreen-ui/badge";
import { Body, Description } from "@leafygreen-ui/typography";
import { Spinner } from "@leafygreen-ui/loading-indicator";
import { BasicEmptyState } from "@leafygreen-ui/empty-state";
import { DatePicker } from "@leafygreen-ui/date-picker";
import Image from "next/image";
import {Button} from "@leafygreen-ui/button";

interface Props {
  userId: string;
  onResume: (session: SessionSummary) => void;
  latestSession?: SessionSummary | null;
}

function relativeDate(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 py-1 bg-gray-50 border-b border-gray-100 text-xs text-gray-400 font-semibold uppercase tracking-wide">
      {children}
    </div>
  );
}

export function SessionPickerPopover({
  userId,
  onResume,
  latestSession,
}: Props) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !popoverRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  useEffect(() => {
    setOpen(false);
    setSessions([]);
    setDateFilter(null);
  }, [userId]);

  // Prepend new session to already-loaded list when it arrives
  useEffect(() => {
    if (!latestSession) return;
    setSessions((prev) => {
      if (prev.some((s) => s.sessionId === latestSession.sessionId))
        return prev;
      return [latestSession, ...prev];
    });
  }, [latestSession?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOpen() {
    const opening = !open;
    setOpen(opening);
    if (opening) {
      setLoading(true);
      listSessions(userId)
        .then((list) => {
          // merge latestSession if it hasn't been persisted yet
          if (
            latestSession &&
            !list.some((s) => s.sessionId === latestSession.sessionId)
          ) {
            setSessions([latestSession, ...list]);
          } else {
            setSessions(list);
          }
        })
        .catch(() => setSessions([]))
        .finally(() => setLoading(false));
    }
  }

  async function handleToggleStar(s: SessionSummary) {
    const newStarred = !s.starred;
    setSessions((prev) =>
      prev.map((x) =>
        x.sessionId === s.sessionId ? { ...x, starred: newStarred } : x,
      ),
    );
    try {
      await setSessionStar(s.sessionId, newStarred);
    } catch {
      setSessions((prev) =>
        prev.map((x) =>
          x.sessionId === s.sessionId ? { ...x, starred: s.starred } : x,
        ),
      );
    }
  }

  const filtered = sessions.filter((s) => {
    if (!dateFilter) return true;
    return s.updatedAt.slice(0, 10) === dateFilter.toISOString().slice(0, 10);
  });

  const pinned = filtered.filter((s) => s.starred);
  const regular = filtered.filter((s) => !s.starred);

  function SessionRow({ s }: { s: SessionSummary }) {
    return (
      <div className="flex items-start gap-1 px-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
        <button
          onClick={() => handleToggleStar(s)}
          className={`shrink-0 mt-0.5 text-base leading-none ${
            s.starred
              ? "text-yellow-400"
              : "text-gray-200 hover:text-yellow-300"
          }`}
          aria-label={s.starred ? "Unstar session" : "Star session"}
        >
          {s.starred ? "★" : "☆"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            onResume(s);
          }}
          className="flex-1 text-left min-w-0"
        >
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-xs text-gray-400 shrink-0">
              {relativeDate(s.updatedAt)}
            </span>
            <Badge variant="lightgray">
              {s.messageCount} msg{s.messageCount !== 1 ? "s" : ""}
            </Badge>
          </div>
          <p className="text-xs text-gray-700 leading-snug line-clamp-2">
            {s.preview || (
              <span className="italic text-gray-400">No messages</span>
            )}
          </p>
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Button
        size="small"
        variant="default"
        ref={triggerRef}
        onClick={handleOpen}
        className="whitespace-nowrap"
        aria-label="View session history"
      >
        Customer Conversations History
      </Button>

      <Popover
        active={open}
        refEl={triggerRef}
        align="bottom"
        justify="end"
        spacing={8}
      >
        <div ref={popoverRef}>
          <Card className="!p-0 w-80 shadow-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <Body weight="medium" className="text-sm">
                Customer Conversations History
              </Body>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner size={24} description="Loading sessions…" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-4">
                <BasicEmptyState
                  title="No sessions yet"
                  description="Past sessions will appear here after you chat"
                  graphic={
                    <Image
                      src="/icons/data.png"
                      alt="No invocations"
                      width={150}
                      height={150}
                      style={{ width: 150, height: "auto" }}
                    />
                  }
                />
              </div>
            ) : (
              <>
                <div className="px-3 py-2 border-b border-gray-100 space-y-1">
                  <DatePicker
                    label="Last activity"
                    size="small"
                    value={dateFilter}
                    onDateChange={(val) => {
                      setDateFilter(val instanceof Date ? val : null);
                    }}
                  />
                  {dateFilter && (
                    <button
                      onClick={() => setDateFilter(null)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto max-h-72">
                  {filtered.length === 0 ? (
                    <div className="px-4 py-4 text-center">
                      <Description>No sessions on this date</Description>
                    </div>
                  ) : (
                    <>
                      {pinned.length > 0 && (
                        <>
                          <SectionLabel>📌 Pinned</SectionLabel>
                          {pinned.map((s) => (
                            <SessionRow key={s.sessionId} s={s} />
                          ))}
                        </>
                      )}
                      {regular.length > 0 && (
                        <>
                          {pinned.length > 0 && (
                            <SectionLabel>All sessions</SectionLabel>
                          )}
                          {regular.map((s) => (
                            <SessionRow key={s.sessionId} s={s} />
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      </Popover>
    </div>
  );
}
