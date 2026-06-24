"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { ProfileResponse, getProfile, resetMemory } from "@/app/lib/api";
import Button from "@leafygreen-ui/button";
import Badge from "@leafygreen-ui/badge";
import Card from "@leafygreen-ui/card";
import { Description, InlineCode, Body } from "@leafygreen-ui/typography";
import { Skeleton } from "@leafygreen-ui/skeleton-loader";
import { palette } from "@leafygreen-ui/palette";
import WhyMongoDBBanner from "@/app/components/WhyMongoDBBanner";
import { Callout } from "@leafygreen-ui/callout";

interface User {
  id: string;
  name: string;
  label: string;
}

interface CustomerTabProps {
  users: User[];
  selectedUser: User;
  onSelectUser: (user: User) => void;
  onMemoryReset: () => void;
  loading: boolean;
  profile: ProfileResponse | null;
  profileLoading: boolean;
}

const USER_IMAGES: Record<string, string> = {
  user001: "/users/user001.png",
  user002: "/users/user002.png",
  user003: "/users/user003.png",
};

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Description
      className="block text-xs uppercase tracking-wide"
      style={{ color: palette.gray.dark1, margin: "1rem 0 0.5rem 0" }}
    >
      {children}
    </Description>
  );
}

export function CustomerTab({
  users,
  selectedUser,
  onSelectUser,
  onMemoryReset,
  loading,
  profile,
  profileLoading,
}: CustomerTabProps) {
  const [allProfiles, setAllProfiles] = useState<
    Record<string, ProfileResponse>
  >({});
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    users.forEach((u) => {
      getProfile(u.id)
        .then((p) => setAllProfiles((prev) => ({ ...prev, [u.id]: p })))
        .catch(() => {});
    });
  }, [users]);

  useEffect(() => { setConfirming(false); }, [selectedUser.id]);

  async function handleReset() {
    setResetting(true);
    try {
      await resetMemory(selectedUser.id);
      onMemoryReset();
    } finally {
      setResetting(false);
      setConfirming(false);
    }
  }

  const user = profile?.user ?? {};
  const memory = profile?.memory ?? {};
  const userProfile = user.profile as Record<string, unknown> | undefined;
  const preferences = user.preferences as Record<string, unknown> | undefined;
  const facts = (memory.facts as string[] | undefined) ?? [];
  const priceRange = preferences?.price_range as
    | { min: number; max: number }
    | undefined;
  const sizes = preferences?.sizes as
    | { shoes?: string; clothing?: string }
    | undefined;
  const memoryUpdatedAt = memory.updated_at as string | undefined;

  return (
    <div className="pb-6 space-y-1">
      <WhyMongoDBBanner title="Pick a customer to advise">
        Each profile lives in MongoDB&apos;s{" "}
        <InlineCode>user_profiles</InlineCode> collection. Switch customers to
        see how different preferences, expertise levels, and accumulated memory
        shape the recommendations — same query, different person, different
        answer.
      </WhyMongoDBBanner>

      {/* --- Customer cards --- */}
      <SectionLabel>Select Customer Profile</SectionLabel>
      <div className="grid grid-cols-3 gap-3">
        {users.map((u) => {
          const isSelected = u.id === selectedUser.id;
          const cp = allProfiles[u.id];
          const cpProfile = (cp?.user?.profile ?? {}) as Record<
            string,
            unknown
          >;
          const cpPrefs = (cp?.user?.preferences ?? {}) as Record<
            string,
            unknown
          >;
          const cpPriceRange = cpPrefs.price_range as
            | { min: number; max: number }
            | undefined;
          const cpActivities = cpProfile.activities as string[] | undefined;

          return (
            <button
              key={u.id}
              disabled={loading}
              onClick={() => !isSelected && onSelectUser(u)}
              className="text-left rounded-lg p-3 transition-all w-full"
              style={{
                border: isSelected
                  ? `2px solid ${palette.green.dark2}`
                  : `1px solid ${palette.gray.light2}`,
                backgroundColor: isSelected
                  ? palette.green.light3
                  : palette.white,
                cursor: loading
                  ? "not-allowed"
                  : isSelected
                    ? "default"
                    : "pointer",
                opacity: loading && !isSelected ? 0.6 : 1,
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-3">
                  <div
                    className="relative w-20 h-20 rounded-full overflow-hidden shrink-0"
                    style={{ backgroundColor: palette.gray.light2 }}
                  >
                    <Image
                      src={USER_IMAGES[u.id] ?? "/icons/agent.png"}
                      alt={u.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-col gap-1 pt-1">
                    <Body
                      weight="medium"
                      className="text-sm leading-tight block"
                    >
                      {u.name}
                    </Body>
                    <Description
                      className="text-xs leading-tight block"
                      style={{ color: palette.gray.dark1 }}
                    >
                      {u.label}
                    </Description>
                    {Boolean(cpProfile.experience) && (
                      <Badge variant="green">
                        {String(cpProfile.experience)}
                      </Badge>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                    style={{ backgroundColor: palette.green.dark2 }}
                  />
                )}
              </div>

              {cpActivities && cpActivities.length > 0 && (
                <Description
                  className="text-xs block mb-1"
                  style={{ color: palette.gray.dark2 }}
                >
                  {cpActivities.join(" · ")}
                </Description>
              )}

              {cpPriceRange && (
                <Description
                  className="text-xs block"
                  style={{ color: palette.gray.dark1 }}
                >
                  ${cpPriceRange.min}–${cpPriceRange.max}
                </Description>
              )}
            </button>
          );
        })}
      </div>

      <Callout variant="tip" title="Why this matters for MongoDB" className="mt-2 mb-2">
        Customers accumulate memory across sessions — facts like budget
        constraints, preferred brands, and shoe sizes are written to{" "}
        <InlineCode>user_memory</InlineCode> automatically by the agents.
        That&apos;s persistent, evolving context no traditional database handles
        without custom code.
      </Callout>
      {/* --- Profile detail --- */}
      <SectionLabel>
        {selectedUser.name.toUpperCase()} — Profile Detail
      </SectionLabel>

      <Card className="!p-0 overflow-hidden">
        <div
          className="px-3 py-2 border-b"
          style={{ borderColor: palette.gray.light2, backgroundColor: palette.gray.light3 }}
        >
          <Description className="font-mono text-xs" style={{ color: palette.gray.dark1 }}>
            <InlineCode>user_profiles</InlineCode>{" "}
            <span style={{ color: palette.gray.base }}>{selectedUser.id}</span>
          </Description>
        </div>

        <div className="grid grid-cols-2">
          {/* Left column */}
          <div className="px-4 py-3 space-y-3 border-r" style={{ borderColor: palette.gray.light2 }}>
            {(["Experience", "Location", "Budget", "Shoe size", "Clothing"] as const).map((label) => (
              <div key={label} className="flex items-center justify-between">
                <Description className="text-xs" style={{ color: palette.gray.dark1 }}>{label}</Description>
                {profileLoading ? (
                  <Skeleton style={{ width: label === "Experience" ? 72 : label === "Location" ? 110 : label === "Budget" ? 80 : 32, height: 16 }} />
                ) : (
                  <>
                    {label === "Experience" && Boolean(userProfile?.experience) && <Badge variant="green">{String(userProfile!.experience)}</Badge>}
                    {label === "Location" && Boolean(userProfile?.location) && <Body className="text-xs">{String(userProfile!.location)}</Body>}
                    {label === "Budget" && priceRange && <Body className="text-xs">${priceRange.min}–${priceRange.max}</Body>}
                    {label === "Shoe size" && sizes?.shoes && <Body className="text-xs">{sizes.shoes}</Body>}
                    {label === "Clothing" && sizes?.clothing && <Body className="text-xs">{sizes.clothing}</Body>}
                  </>
                )}
              </div>
            ))}
            <div>
              <Description className="text-xs mb-1.5 block" style={{ color: palette.gray.dark1 }}>Brands</Description>
              {profileLoading ? (
                <div className="flex gap-1">
                  <Skeleton style={{ width: 72, height: 18 }} />
                  <Skeleton style={{ width: 60, height: 18 }} />
                  <Skeleton style={{ width: 50, height: 18 }} />
                </div>
              ) : (
                preferences && Array.isArray(preferences.brands) && (
                  <div className="flex flex-wrap gap-1">
                    {(preferences.brands as string[]).map((b) => <Badge key={b} variant="blue">{b}</Badge>)}
                  </div>
                )
              )}
            </div>
            <div>
              <Description className="text-xs mb-1.5 block" style={{ color: palette.gray.dark1 }}>Categories</Description>
              {profileLoading ? (
                <div className="flex gap-1">
                  <Skeleton style={{ width: 90, height: 18 }} />
                  <Skeleton style={{ width: 80, height: 18 }} />
                  <Skeleton style={{ width: 70, height: 18 }} />
                </div>
              ) : (
                preferences && Array.isArray(preferences.categories) && (
                  <div className="flex flex-wrap gap-1">
                    {(preferences.categories as string[]).map((c) => <Badge key={c} variant="lightgray">{c}</Badge>)}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="px-4 py-3 space-y-3">
            <div>
              <Description className="text-xs mb-1.5 block" style={{ color: palette.gray.dark1 }}>Activities</Description>
              {profileLoading ? (
                <div className="space-y-1.5">
                  <Skeleton style={{ width: 100, height: 14 }} />
                  <Skeleton style={{ width: 90, height: 14 }} />
                  <Skeleton style={{ width: 80, height: 14 }} />
                </div>
              ) : (
                userProfile && Array.isArray(userProfile.activities) && (
                  <div className="space-y-1">
                    {(userProfile.activities as string[]).map((a) => <Body key={a} className="text-xs block">{a}</Body>)}
                  </div>
                )
              )}
            </div>
            <div>
              <Description className="text-xs mb-0.5 block" style={{ color: palette.gray.dark1 }}>Email</Description>
              {profileLoading
                ? <Skeleton style={{ width: 140, height: 14 }} />
                : Boolean(user.email) && <Body className="text-xs" style={{ color: palette.gray.dark2 }}>{String(user.email)}</Body>
              }
            </div>
          </div>
        </div>
      </Card>

      {/* --- AI Memory --- */}
      <div className="flex items-center justify-between" style={{ margin: "1rem 0 0.5rem 0" }}>
        <Description
          className="text-xs uppercase tracking-wide"
          style={{ color: palette.gray.dark1 }}
        >
          AI-Learned Memory{facts.length > 0 ? ` — ${facts.length} Facts` : ""}
        </Description>
        {!profileLoading && (
          !confirming ? (
            <Button size="small" variant="danger" onClick={() => setConfirming(true)}>
              Reset memory
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Description className="text-xs" style={{ color: palette.gray.dark2 }}>
                Delete all facts for {selectedUser.name}?
              </Description>
              <Button size="xsmall" variant="danger" onClick={handleReset} disabled={resetting}>
                {resetting ? "Deleting…" : "Confirm"}
              </Button>
              <Button size="xsmall" variant="default" onClick={() => setConfirming(false)} disabled={resetting}>
                Cancel
              </Button>
            </div>
          )
        )}
      </div>

      <Card className="!p-0 overflow-hidden">
          <div
            className="px-3 py-2 flex items-center justify-between border-b"
            style={{ borderColor: palette.gray.light2, backgroundColor: palette.gray.light3 }}
          >
            <Description className="font-mono text-xs" style={{ color: palette.gray.dark1 }}>
              <InlineCode>user_memory</InlineCode>{" "}
              <span style={{ color: palette.gray.base }}>{selectedUser.id}</span>
            </Description>
            {!profileLoading && memoryUpdatedAt && (
              <Description className="text-xs" style={{ color: palette.gray.base }}>
                {new Date(memoryUpdatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC
              </Description>
            )}
          </div>

          {profileLoading ? (
            <ul className="divide-y" style={{ borderColor: palette.gray.light2 }}>
              {[160, 130, 180, 145].map((w) => (
                <li key={w} className="flex items-start gap-2.5 px-4 py-2.5">
                  <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: palette.gray.light2 }} />
                  <Skeleton style={{ width: w, height: 14 }} />
                </li>
              ))}
            </ul>
          ) : facts.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Description className="italic" style={{ color: palette.gray.base }}>
                No memory yet — start chatting to build memory
              </Description>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: palette.gray.light2 }}>
              {facts.map((fact, i) => (
                <li key={i} className="flex items-start gap-2.5 px-4 py-2.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0 mt-1"
                    style={{ backgroundColor: palette.green.dark1 }}
                  />
                  <Body className="text-xs leading-relaxed">{fact}</Body>
                </li>
              ))}
            </ul>
          )}

        </Card>
    </div>
  );
}
