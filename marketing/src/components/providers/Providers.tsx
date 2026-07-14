"use client";

import { ThemeProvider } from "./ThemeProvider";

/**
 * Client provider tree for the marketing site. Currently just theme, kept as a single
 * wrapper so additional client-only providers can be added without touching the layout.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
