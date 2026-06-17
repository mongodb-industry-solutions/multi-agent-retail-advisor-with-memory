"use client";

import type { ReactNode } from "react";
import LeafyGreenProvider from "@leafygreen-ui/leafygreen-provider";
import { ToastProvider } from "@leafygreen-ui/toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LeafyGreenProvider>
      <ToastProvider>{children}</ToastProvider>
    </LeafyGreenProvider>
  );
}
