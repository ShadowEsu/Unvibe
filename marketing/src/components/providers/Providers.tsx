"use client";

import { VisitBeacon } from "@/components/VisitBeacon";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <VisitBeacon />
      {children}
    </>
  );
}
