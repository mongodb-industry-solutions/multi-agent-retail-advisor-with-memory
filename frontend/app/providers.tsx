"use client";

import LeafyGreenProvider from "@leafygreen-ui/leafygreen-provider";
import { ToastProvider } from "@leafygreen-ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LeafyGreenProvider>
      <ToastProvider>{children}</ToastProvider>
    </LeafyGreenProvider>
  );
}
