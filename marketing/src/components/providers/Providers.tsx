"use client";

import { VisitBeacon } from "@/components/VisitBeacon";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <VisitBeacon />
      {children}
    </ThemeProvider>
  );
}
