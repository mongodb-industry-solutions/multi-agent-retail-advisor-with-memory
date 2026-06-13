"use client";

import { useState, useRef, useEffect } from "react";
import { ProfileResponse } from "@/app/lib/api";
import { Popover } from "@leafygreen-ui/popover";
import Card from "@leafygreen-ui/card";
import Badge from "@leafygreen-ui/badge";
import { Body, Description, InlineCode } from "@leafygreen-ui/typography";
import { Avatar } from "@leafygreen-ui/avatar";
import { Spinner } from "@leafygreen-ui/loading-indicator";

interface Props {
  userName: string;
  profile: ProfileResponse | null;
  loading: boolean;
}

export function ProfilePopover({ userName, profile, loading }: Props) {
  const [open, setOpen] = useState(false);
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

  // Close popover when profile changes (user switched)
  useEffect(() => { setOpen(false); }, [profile]);

  const user = profile?.user ?? {};
  const memory = profile?.memory ?? {};
  const preferences = user.preferences as Record<string, unknown> | undefined;
  const userProfile = user.profile as Record<string, unknown> | undefined;
  const facts = (memory.facts as string[] | undefined) ?? [];
  const priceRange = preferences?.price_range as { min: number; max: number } | undefined;
  const sizes = preferences?.sizes as { shoes?: string; clothing?: string } | undefined;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
        aria-label={`View ${userName}'s profile`}
      >
        <Avatar format="text" text={userName} sizeOverride={28} />
      </button>

      <Popover active={open} refEl={triggerRef} align="bottom" justify="end" spacing={8}>
        <div ref={popoverRef}>
          <Card className="!p-0 w-72 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2.5">
                <Avatar format="text" text={userName} sizeOverride={36} />
                <div>
                  <Body weight="medium">{String(user.name ?? userName)}</Body>
                  <Description className="font-mono block">
                    {String(user.email ?? "")}
                  </Description>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner size={24} description="Loading…" />
              </div>
            ) : (
              <div className="px-4 py-3 space-y-3 max-h-80 overflow-y-auto">
                {/* Profile */}
                {userProfile && (
                  <div>
                    <Description className="uppercase tracking-wide text-xs font-semibold mb-1.5 block text-gray-500">
                      Profile
                    </Description>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {Boolean(userProfile.experience) && (
                        <Badge variant="green">{String(userProfile.experience)}</Badge>
                      )}
                      {Boolean(userProfile.location) && (
                        <Badge variant="lightgray">{String(userProfile.location)}</Badge>
                      )}
                    </div>
                    {Array.isArray(userProfile.activities) && (
                      <div className="flex flex-wrap gap-1">
                        {(userProfile.activities as string[]).map((a) => (
                          <Badge key={a} variant="lightgray">{a}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Preferences */}
                {preferences && (
                  <div>
                    <Description className="uppercase tracking-wide text-xs font-semibold mb-1.5 block text-gray-500">
                      Preferences
                    </Description>
                    {Array.isArray(preferences.brands) && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(preferences.brands as string[]).map((b) => (
                          <Badge key={b} variant="blue">{b}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                      {Boolean(sizes?.shoes) && (
                        <span>Shoes <InlineCode>{sizes!.shoes}</InlineCode></span>
                      )}
                      {Boolean(sizes?.clothing) && (
                        <span>Clothing <InlineCode>{sizes!.clothing}</InlineCode></span>
                      )}
                      {Boolean(priceRange) && (
                        <span>Budget <InlineCode>${priceRange!.min}–${priceRange!.max}</InlineCode></span>
                      )}
                    </div>
                  </div>
                )}

                {/* Memory */}
                <div>
                  <Description className="uppercase tracking-wide text-xs font-semibold mb-1.5 block text-gray-500">
                    🧠 AI-learned memory
                  </Description>
                  {facts.length === 0 ? (
                    <Description className="block italic text-gray-400">
                      No memory yet — start chatting
                    </Description>
                  ) : (
                    <ul className="space-y-1">
                      {facts.map((fact, i) => (
                        <li key={i} className="flex gap-1.5 text-xs text-gray-700">
                          <span className="text-gray-400 shrink-0 mt-0.5">•</span>
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Source label */}
                <div className="border-t border-gray-100 pt-2">
                  <Description className="font-mono text-gray-400">
                    <InlineCode>users</InlineCode> + <InlineCode>user_memory</InlineCode>
                  </Description>
                </div>
              </div>
            )}
          </Card>
        </div>
      </Popover>
    </div>
  );
}
