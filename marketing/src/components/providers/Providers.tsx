"use client";

import { VisitBeacon } from "@/components/VisitBeacon";
import { CopyToastProvider } from "@/components/paper/CopyToast";
import { MixpanelInit } from "@/components/providers/MixpanelInit";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <CopyToastProvider>
        <MixpanelInit />
        <VisitBeacon />
        {children}
      </CopyToastProvider>
    </ThemeProvider>
  );
}
