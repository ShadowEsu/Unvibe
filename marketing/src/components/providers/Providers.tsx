"use client";

import { VisitBeacon } from "@/components/VisitBeacon";
import { CopyToastProvider } from "@/components/paper/CopyToast";
import { MixpanelInit } from "@/components/providers/MixpanelInit";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CopyToastProvider>
      <MixpanelInit />
      <VisitBeacon />
      {children}
    </CopyToastProvider>
  );
}
