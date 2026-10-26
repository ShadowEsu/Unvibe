import { JetBrains_Mono } from "next/font/google";

/**
 * The code face for the /explain pages. The layout holds JetBrains Mono back until the first scroll, tap
 * or key press (or 4 s after load) to keep it off the home page's first paint. Here the Try it box is on
 * the first screen, so the box would show the fallback face, without the ligatures home's box has.
 * Loading it on these routes (preloaded, same face and options) makes the box render as it does on home.
 */
export const explainMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
  variable: "--explain-mono-face",
});
