"use client";

import type { ReactNode } from "react";
import LeafyGreenProvider from "@leafygreen-ui/leafygreen-provider";

export function Providers({ children }: { children: ReactNode }) {
  return <LeafyGreenProvider>{children}</LeafyGreenProvider>;
}
