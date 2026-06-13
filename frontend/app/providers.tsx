"use client";

import LeafyGreenProvider from "@leafygreen-ui/leafygreen-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <LeafyGreenProvider>{children}</LeafyGreenProvider>;
}
